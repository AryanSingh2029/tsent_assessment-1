import type { Page } from "playwright";
import path from "node:path";
import fs from "node:fs";
import { renderTemplate } from "../core/template";
import type { ApplicationResult, UserProfile } from "../types";
import type { AtsAdapter } from "./AtsAdapter";
import { readingPause } from "../core/human";

import {
  humanHoverThenClick,
  humanPause,
  humanType,
  humanScrollIntoView,
} from "../core/human";

export class AcmeAdapter implements AtsAdapter {
  public readonly id = "acme";

  async canHandle(page: Page): Promise<boolean> {
    const url = page.url();
    if (url.includes("/acme.html")) return true;
    // fallback: check visible header logo
    const logo = page.locator(".ats-header .logo");
    return (await logo.count()) > 0 && (await logo.first().innerText()).includes("Acme");
  }

  async apply(page: Page, profile: UserProfile): Promise<ApplicationResult> {
    const start = Date.now();
    const screenshotsDir = path.resolve(process.cwd(), "screenshots");
    fs.mkdirSync(screenshotsDir, { recursive: true });

    const shot = (name: string) =>
      path.join(screenshotsDir, `acme-${Date.now()}-${name}.png`);

    try {
      // Ensure we're on Acme
      await page.waitForSelector("form#application-form", { timeout: 15_000 });

      // ---------------------------
      // Step 1: Personal Info
      // ---------------------------
      await this.waitForActiveStep(page, 1);

      await humanType(page.locator("#first-name"), profile.firstName);
      await humanType(page.locator("#last-name"), profile.lastName);
      await humanType(page.locator("#email"), profile.email);
      await humanType(page.locator("#phone"), profile.phone);
      await humanType(page.locator("#location"), profile.location);

      if (profile.linkedIn) {
        await humanType(page.locator("#linkedin"), profile.linkedIn);
      }
      if (profile.portfolio) {
        await humanType(page.locator("#portfolio"), profile.portfolio);
      }

      await humanHoverThenClick(this.continueButtonForStep(page, 1));
      await readingPause();  // reading pause added at  last 
      await this.waitForActiveStep(page, 2);

      // ---------------------------
      // Step 2: Experience & Education
      // ---------------------------
      // Upload resume
      const resumePath = path.resolve(
        process.cwd(),
        "fixtures",
        "sample-resume.pdf"
      );
      await page.locator("#resume").setInputFiles(resumePath);
      await humanPause(150, 350);

      // Select experience + education (Acme values match profile directly)
      await humanScrollIntoView(page.locator("#experience-level"));
      await page.locator("#experience-level").selectOption(profile.experienceLevel);
      await humanPause(80, 200);

      await humanScrollIntoView(page.locator("#education"));
      await page.locator("#education").selectOption(profile.education);
      await humanPause(80, 200);

      // School typeahead: type then click suggestion
      await this.selectSchoolTypeahead(page, profile.school);

      // Skills checkboxes: value matches profile skills directly
      for (const skill of profile.skills) {
        const checkbox = page.locator(`input[type="checkbox"][name="skills"][value="${skill}"]`);
        if (await checkbox.count()) {
          await humanScrollIntoView(checkbox);
          if (!(await checkbox.isChecked())) {
            await humanHoverThenClick(checkbox);
          }
        }
      }

      await humanHoverThenClick(this.continueButtonForStep(page, 2));
      await readingPause();
      await this.waitForActiveStep(page, 3);

      // ---------------------------
      // Step 3: Additional Questions
      // ---------------------------
      // Work authorization radios: yes/no
      const workAuthValue = profile.workAuthorized ? "yes" : "no";
      const workAuthRadio = page.locator(`input[type="radio"][name="workAuth"][value="${workAuthValue}"]`);
      await humanHoverThenClick(workAuthRadio);

      // Visa sponsorship conditional shows only when workAuth === yes
      if (profile.workAuthorized) {
        // wait a moment for conditional group to appear
        await humanPause(150, 350);
        if (profile.requiresVisa !== undefined) {
          const visaValue = profile.requiresVisa ? "yes" : "no";
          const visaRadio = page.locator(`input[type="radio"][name="visaSponsorship"][value="${visaValue}"]`);
          if (await visaRadio.count()) {
            await humanHoverThenClick(visaRadio);
          }
        }
      }

      // Start date
      await humanScrollIntoView(page.locator("#start-date"));
      await page.locator("#start-date").fill(profile.earliestStartDate);
      await humanPause(80, 200);

      // Salary expectation optional
      if (profile.salaryExpectation) {
        await humanType(page.locator("#salary-expectation"), profile.salaryExpectation);
      }

      // Referral required
      await humanScrollIntoView(page.locator("#referral"));
      await page.locator("#referral").selectOption(profile.referralSource);
      await humanPause(120, 280);

      // If referral "other", fill required text
      if (profile.referralSource === "other") {
        const other = page.locator("#referral-other");
        if (await other.count()) {
          await humanType(other, "Other");
        }
      }

      // Cover letter required
      const cover = renderTemplate(profile.coverLetter, { company: "Acme Corp" });
      await humanType(page.locator("#cover-letter"), cover);

      await humanHoverThenClick(this.continueButtonForStep(page, 3));
      await readingPause();
      await this.waitForActiveStep(page, 4);

      // ---------------------------
      // Step 4: Review & Submit
      // ---------------------------
      const terms = page.locator("#terms-agree");
      await humanScrollIntoView(terms);
      if (!(await terms.isChecked())) {
        await humanHoverThenClick(terms);
      }

      await humanHoverThenClick(page.locator("#submit-btn"));

      // ---------------------------
      // Success: confirmation ID
      // ---------------------------
      const successPage = page.locator("#success-page");
      await successPage.waitFor({ state: "visible", timeout: 20_000 });

      const confirmation = page.locator("#confirmation-id");
      await confirmation.waitFor({ state: "visible", timeout: 10_000 });

      const confirmationId = (await confirmation.innerText()).trim();

      // Optional: final screenshot
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

  private continueButtonForStep(page: Page, step: 1 | 2 | 3) {
    // Each step has a "Continue" button with onclick="nextStep(step)"
    return page.locator(`section.form-step[data-step="${step}"] button.btn.btn-primary`);
  }

  private async waitForActiveStep(page: Page, step: 1 | 2 | 3 | 4) {
    const selector = `section.form-step[data-step="${step}"]`;
    const stepSection = page.locator(selector);
    await stepSection.waitFor({ state: "visible", timeout: 10_000 });

    // Wait until it has class "active"
    await page.waitForFunction(
      (sel) => document.querySelector(sel)?.classList.contains("active"),
      selector,
      { timeout: 10_000 }
    );
  }

  private async selectSchoolTypeahead(page: Page, schoolName: string) {
    const input = page.locator("#school");
    const dropdown = page.locator("#school-dropdown");

    // Type first 3-6 chars to trigger suggestions reliably
    const seed = schoolName.slice(0, Math.min(6, Math.max(3, schoolName.length)));
    await humanType(input, seed);

    // Wait for dropdown to show results
    await dropdown.waitFor({ state: "visible", timeout: 10_000 });

    const options = dropdown.locator("li");
    await options.first().waitFor({ state: "visible", timeout: 10_000 });

    // Prefer exact match, else contains, else first
    const exact = dropdown.locator("li", { hasText: schoolName });
    if (await exact.count()) {
      await humanHoverThenClick(exact.first());
      return;
    }

    const contains = dropdown.locator("li").filter({ hasText: schoolName.split(" ")[0] });
    if (await contains.count()) {
      await humanHoverThenClick(contains.first());
      return;
    }

    await humanHoverThenClick(options.first());
  }
}
