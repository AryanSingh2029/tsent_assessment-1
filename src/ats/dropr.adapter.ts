import type { Page } from "playwright";
import path from "node:path";
import type { ApplicationResult, UserProfile } from "../types";
import type { AtsAdapter } from "./AtsAdapter";
import { info } from "../core/logger";
import { retry } from "../core/retry";

import {
  humanHoverThenClick,
  humanPause,
  readingPause,
  humanScrollIntoView,
  humanType,
} from "../core/human";
import { renderTemplate } from "../core/template";

export class DroprAdapter implements AtsAdapter {
  public readonly id = "dropr";

  async canHandle(page: Page): Promise<boolean> {
    const url = page.url();
    if (url.includes("/dropr.html")) return true;
    return (await page.locator("#dropr-form").count()) > 0;
  }

  async apply(page: Page, profile: UserProfile): Promise<ApplicationResult> {
    const start = Date.now();

    try {
      info(this.id, "start", "begin apply", { url: page.url() });

      // ---- CONTACT ----
      info(this.id, "contact", "filling contact fields");
      await this.fillContact(page, profile);

      info(this.id, "contact", "click next-to-work");
      await humanHoverThenClick(page.locator("#next-to-work"));

      // ---- WORK ----
      info(this.id, "work", "filling work fields");
      await this.fillWork(page, profile);

      info(this.id, "work", "click next-to-uploads");
      await humanHoverThenClick(page.locator("#next-to-uploads"));

      // ---- UPLOADS ----
      info(this.id, "uploads", "uploading files");
      await this.fillUploads(page);

      info(this.id, "uploads", "click next-to-final");
      await humanHoverThenClick(page.locator("#next-to-final"));

      // ---- FINAL ----
      info(this.id, "final", "checking consent");
      await this.fillFinal(page);

      info(this.id, "final", "click submit");
      await humanHoverThenClick(page.locator("#dropr-submit"));

      // ---- CONFIRM (with retry) ----
      info(this.id, "confirm", "waiting for confirmation (with retry)");
      await retry(
        async () => {
          const success = page.locator("#dropr-success");
          await success.waitFor({ state: "visible", timeout: 5_000 });

          const ref = page.locator("#dropr-ref");
          await ref.waitFor({ state: "visible", timeout: 5_000 });

          // Wait until it isn't empty
          await page.waitForFunction(
            () => {
              const el = document.getElementById("dropr-ref");
              return !!el && !!el.textContent && el.textContent.trim().length > 0;
            },
            { timeout: 5_000 }
          );
        },
        { ats: this.id, step: "confirm", actionName: "wait for confirmation" }
      );

      const confirmationId =
        (await page.locator("#dropr-ref").textContent())?.trim() || "DR-UNKNOWN";
      info(this.id, "confirm", "got confirmation", { confirmationId });

      return {
        success: true,
        confirmationId,
        durationMs: Date.now() - start,
      };
    } catch (e: any) {
      info(this.id, "error", "apply failed", { message: e?.message ?? String(e) });
      return {
        success: false,
        error: e?.message ?? String(e),
        durationMs: Date.now() - start,
      };
    } finally {
      await humanPause(200, 500);
    }
  }

  private async fillContact(page: Page, profile: UserProfile) {
    await readingPause();

    info(this.id, "contact", "type field", { field: "firstName" });
    await humanType(page.locator("#d-first"), profile.firstName);

    info(this.id, "contact", "type field", { field: "lastName" });
    await humanType(page.locator("#d-last"), profile.lastName);

    info(this.id, "contact", "type field", { field: "email" });
    await humanType(page.locator("#d-email"), profile.email);

    info(this.id, "contact", "type field", { field: "phone" });
    await humanType(page.locator("#d-phone"), profile.phone);

    info(this.id, "contact", "type field", { field: "location" });
    await humanType(page.locator("#d-location"), profile.location);
  }

  private mapExperienceToDropr(profileLevel: UserProfile["experienceLevel"]) {
    // dropr values: intern, junior, mid, senior, staff
    switch (profileLevel) {
      case "0-1":
        return "intern";
      case "1-3":
        return "junior";
      case "3-5":
        return "mid";
      case "5-10":
        return "senior";
      case "10+":
        return "staff";
      default:
        return "junior";
    }
  }

  private async fillWork(page: Page, profile: UserProfile) {
    // Open listbox
    const expBtn = page.locator("#d-exp-btn");
    info(this.id, "work", "open experience listbox");
    await humanHoverThenClick(expBtn);

    // pick option
    const expValue = this.mapExperienceToDropr(profile.experienceLevel);
    info(this.id, "work", "select experience option", { value: expValue });
    const expOption = page.locator(
      `#d-exp-menu .option[data-value="${expValue}"]`
    );
    await humanHoverThenClick(expOption);

    // Experience cards: first card exists by default
    const firstTitle = page.locator("#exp-container .d-exp-title").first();
    const firstCompany = page.locator("#exp-container .d-exp-company").first();

    info(this.id, "work", "type experience entry", { field: "roleTitle" });
    await humanType(firstTitle, "Software Engineering Intern");

    info(this.id, "work", "type experience entry", { field: "company" });
    await humanType(firstCompany, "Sample Company");

    // Start date
    info(this.id, "work", "fill date", { field: "startDate" });
    await humanScrollIntoView(page.locator("#d-start-date"));
    await page.locator("#d-start-date").fill(profile.earliestStartDate);
    await humanPause(80, 180);

    // Salary (optional)
    if (profile.salaryExpectation) {
      info(this.id, "work", "type field", { field: "salary" });
      await humanType(page.locator("#d-salary"), profile.salaryExpectation);
    }

    // Note (required) — use template so company becomes Dropr
    const note = renderTemplate(profile.coverLetter, { company: "Dropr" });
    const clipped = note.length > 1100 ? note.slice(0, 1100) : note;

    await readingPause();
    info(this.id, "work", "type field", { field: "note" });
    await humanType(page.locator("#d-note"), clipped);
  }

  private async fillUploads(page: Page) {
    const resumePath = path.resolve("fixtures", "sample-resume.pdf");

    const resume = page.locator("#d-resume");
    await humanScrollIntoView(resume);
    info(this.id, "uploads", "setInputFiles", { field: "resume" });
    await resume.setInputFiles(resumePath);
    await humanPause(150, 350);

    const cover = page.locator("#d-cover");
    await humanScrollIntoView(cover);
    info(this.id, "uploads", "setInputFiles", { field: "coverFile" });
    await cover.setInputFiles(resumePath);
    await humanPause(150, 350);
  }

  private async fillFinal(page: Page) {
    const consent = page.locator("#d-consent");
    await humanScrollIntoView(consent);

    if (!(await consent.isChecked())) {
      info(this.id, "final", "check consent");
      await humanHoverThenClick(consent);
    }

    await readingPause();
  }
}
