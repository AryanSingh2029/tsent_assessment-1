import type { Page } from "playwright";
import path from "node:path";
import fs from "node:fs";
import { renderTemplate } from "../core/template";
import type { ApplicationResult, UserProfile } from "../types";
import type { AtsAdapter } from "./AtsAdapter";
import { retry } from "../core/retry";
import { info } from "../core/logger";

import {
  humanHoverThenClick,
  humanPause,
  humanType,
  humanScrollIntoView,
  readingPause,
} from "../core/human";


export class GlobexAdapter implements AtsAdapter {
  public readonly id = "globex";
 private async setSalarySlider(page: Page, salary: string) {
  const slider = page.locator("#g-salary");
  await humanScrollIntoView(slider);

  const desired = Number(String(salary).replace(/[^\d]/g, ""));
  if (!Number.isFinite(desired)) return;

  // snap to step so it never rounds to 80000 accidentally
  const snapped = await slider.evaluate((el, v) => {
    const i = el as HTMLInputElement;
    const min = Number(i.min || 0);
    const max = Number(i.max || 0);
    const step = Number(i.step || 1);

    const clamped = Math.max(min, Math.min(max, v));
    const snapped = min + Math.round((clamped - min) / step) * step;

    i.value = String(snapped);
    i.dispatchEvent(new Event("input", { bubbles: true }));  // updates display via oninput
    i.dispatchEvent(new Event("change", { bubbles: true }));
    return snapped;
  }, desired);

  const after = Number(await slider.inputValue());
  info(this.id, "additional", "salary set", { desired, snapped, after });

  if (after !== snapped) {
    throw new Error(`Salary slider mismatch: wanted ${snapped}, got ${after}`);
  }

  await humanPause(120, 260);
}

  async canHandle(page: Page): Promise<boolean> {
    const url = page.url();
    if (url.includes("/globex.html")) return true;

    const header = page.locator(".globex-header h1");
    return (await header.count()) > 0 && (await header.first().innerText()).includes("Globex");
  }

  async apply(page: Page, profile: UserProfile): Promise<ApplicationResult> {
    const start = Date.now();
    const screenshotsDir = path.resolve(process.cwd(), "screenshots");
    fs.mkdirSync(screenshotsDir, { recursive: true });

    const shot = (name: string) =>
      path.join(screenshotsDir, `globex-${Date.now()}-${name}.png`);

    try {
      await page.waitForSelector("form#globex-form", { timeout: 15_000 });

      // Open all accordion sections (safe + matches their inline validation behavior)
      await this.openAllSections(page);

      // ---------------------------
      // Section: Contact Details
      // ---------------------------
      await humanType(page.locator("#g-fname"), profile.firstName);
      await humanType(page.locator("#g-lname"), profile.lastName);
      await humanType(page.locator("#g-email"), profile.email);
      await humanType(page.locator("#g-phone"), profile.phone);

      // Profile has location like "San Francisco, CA" but field expects "City"
      const cityOnly = profile.location.split(",")[0].trim();
      await humanType(page.locator("#g-city"), cityOnly || profile.location);

      if (profile.linkedIn) await humanType(page.locator("#g-linkedin"), profile.linkedIn);
      if (profile.portfolio) await humanType(page.locator("#g-website"), profile.portfolio);
      await readingPause();

      // ---------------------------
      // Section: Qualifications
      // ---------------------------
      const resumePath = path.resolve(process.cwd(), "fixtures", "sample-resume.pdf");
      await page.locator("#g-resume").setInputFiles(resumePath);
      await humanPause(150, 350);

      // Experience mapping (profile -> globex option value)
      await humanScrollIntoView(page.locator("#g-experience"));
      await page.locator("#g-experience").selectOption(this.mapExperience(profile.experienceLevel));
      await humanPause(80, 200);

      // Degree mapping (profile -> globex option value)
      await humanScrollIntoView(page.locator("#g-degree"));
      await page.locator("#g-degree").selectOption(this.mapDegree(profile.education));
      await humanPause(80, 200);

      // Async typeahead school (MOST IMPORTANT → retry here)
      await retry(
        async () => this.selectUniversityAsync(page, profile.school),
        {
          ats: this.id,
          step: "qualifications",
          actionName: "select university (async typeahead)",
          tries: 5,
          baseDelayMs: 300,
          maxDelayMs: 2000,
          jitterMs: 200,
        }
      );

      // Skills chips mapping
      await this.selectSkillChips(page, profile.skills);
      await readingPause();

      // ---------------------------
      // Section: Additional Information
      // ---------------------------
      // Work auth toggle: OFF by default (data-value="false")
      await this.setToggle(page, "#g-work-auth-toggle", profile.workAuthorized);

      // Visa toggle only if requiresVisa true (and block visible)
      if (profile.workAuthorized) {
        if (profile.requiresVisa) {
          // ensure visa block visible (it appears when workAuth is toggled ON)
          const visaBlock = page.locator("#g-visa-block");
          await visaBlock.waitFor({ state: "visible", timeout: 5_000 }).catch(() => {});
          await this.setToggle(page, "#g-visa-toggle", true);
        }
      }

      // Start date required
      await humanScrollIntoView(page.locator("#g-start-date"));
      await page.locator("#g-start-date").fill(profile.earliestStartDate);
      await humanPause(80, 200);
      // Salary slider (optional)
if (profile.salaryExpectation) {
  await this.setSalarySlider(page, profile.salaryExpectation);
}

      // Source required (profile.referralSource maps nicely for this mock)
      await humanScrollIntoView(page.locator("#g-source"));
      await page.locator("#g-source").selectOption(profile.referralSource);
      await humanPause(120, 280);

      if (profile.referralSource === "other") {
        const other = page.locator("#g-source-other");
        if (await other.count()) {
          await humanType(other, "Other");
        }
      }

      // Motivation required (reuse cover letter text)
      const motivation = renderTemplate(profile.coverLetter, { company: "Globex Corporation" });
      await humanType(page.locator("#g-motivation"), motivation);

      // Consent required
      const consent = page.locator("#g-consent");
      await humanScrollIntoView(consent);
      if (!(await consent.isChecked())) {
        await humanHoverThenClick(consent);
      }

      // Submit
      await readingPause();
      await humanHoverThenClick(page.locator("#globex-submit"));

      // Success
      const confirm = page.locator("#globex-confirmation");
      await confirm.waitFor({ state: "visible", timeout: 25_000 });

      const ref = page.locator("#globex-ref");
      await ref.waitFor({ state: "visible", timeout: 10_000 });

      const confirmationId = (await ref.innerText()).trim();

      const finalShot = shot("success");
      await page.screenshot({ path: finalShot, fullPage: true });

      return {
        success: true,
        confirmationId,
        screenshotPath: finalShot,
        durationMs: Date.now() - start,
      };
    } catch (err: any) {
      const failShot = shot("failure");
      try {
        await page.screenshot({ path: failShot, fullPage: true });
      } catch {
        // ignore
      }

      return {
        success: false,
        error: err?.message ?? String(err),
        screenshotPath: failShot,
        durationMs: Date.now() - start,
      };
    }
  }

  // ---------------------------
  // Helpers
  // ---------------------------

  private async openAllSections(page: Page) {
    const headers = page.locator(".section-header");
    const count = await headers.count();
    for (let i = 0; i < count; i++) {
      const h = headers.nth(i);
      const isOpen = await h.evaluate((el) => el.classList.contains("open"));
      if (!isOpen) {
        await humanHoverThenClick(h);
        await humanPause(80, 200);
      }
    }
  }

  private mapExperience(level: UserProfile["experienceLevel"]): string {
    const mapping: Record<UserProfile["experienceLevel"], string> = {
      "0-1": "intern",
      "1-3": "junior",
      "3-5": "mid",
      "5-10": "senior",
      "10+": "staff",
    };
    return mapping[level];
  }

  private mapDegree(edu: UserProfile["education"]): string {
    const mapping: Record<UserProfile["education"], string> = {
      "high-school": "hs",
      associates: "assoc",
      bachelors: "bs",
      masters: "ms",
      phd: "phd",
    };
    return mapping[edu];
  }

  private async selectUniversityAsync(page: Page, university: string) {
    const input = page.locator("#g-school");
    const results = page.locator("#g-school-results");

    // IMPORTANT: reset between retries so stale text/results don't break next attempt
    await input.fill("");
    await humanPause(80, 150);

    // Type a short seed to trigger async fetch
    const seed = university.slice(0, Math.min(6, Math.max(3, university.length)));
    await humanType(input, seed);

    // Wait for dropdown to open and options to appear
    await page.waitForFunction(
      () => document.querySelector("#g-school-results")?.classList.contains("open"),
      null,
      { timeout: 10_000 }
    );

    const options = results.locator("li:not(.typeahead-no-results)");
    await options.first().waitFor({ state: "visible", timeout: 10_000 });

    // Prefer exact text match if present
    const exact = results.locator("li", { hasText: university });
    if (await exact.count()) {
      await humanHoverThenClick(exact.first());
      return;
    }

    // Else click first option (results are shuffled)
    await humanHoverThenClick(options.first());
  }

  private async selectSkillChips(page: Page, skills: string[]) {
    // Map Acme-style values to Globex chip codes
    const map: Record<string, string> = {
      javascript: "js",
      typescript: "ts",
      python: "py",
      react: "react",
      nodejs: "node",
      sql: "sql",
      git: "git",
      docker: "docker",
      aws: "aws",
      graphql: "graphql",
    };

    // Pick at least one (required) and try to match profile skills
    const codes = skills.map((s) => map[s]).filter(Boolean);

    // If mapping failed for all, pick js as default
    const finalCodes = codes.length ? codes : ["js"];

    for (const code of finalCodes) {
      const chip = page.locator(`#g-skills .chip[data-skill="${code}"]`);
      if (await chip.count()) {
        const selected = await chip.evaluate((el) => el.classList.contains("selected"));
        if (!selected) {
          await humanHoverThenClick(chip);
        }
      }
    }
  }

  private async setToggle(page: Page, selector: string, desired: boolean) {
    const toggle = page.locator(selector);
    await humanScrollIntoView(toggle);

    const current = await toggle.evaluate((el) => (el as HTMLElement).dataset.value === "true");
    if (current !== desired) {
      await humanHoverThenClick(toggle);
      await humanPause(100, 250);
    }
  }
}
