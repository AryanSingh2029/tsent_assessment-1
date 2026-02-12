import type { Page } from "playwright";
import type { ApplicationResult, UserProfile } from "../types";
import type { AtsAdapter } from "./AtsAdapter";
import { renderTemplate } from "../core/template";
import { info } from "../core/logger";

import {
  humanHoverThenClick,
  humanPause,
  humanType,
  readingPause,
  humanScrollIntoView,
} from "../core/human";

export class TsentAdapter implements AtsAdapter {
  public readonly id = "tsent";

  async canHandle(page: Page): Promise<boolean> {
    const url = page.url();
    if (url.includes("/ycombinator.html")) return true;

    const openBtn = page.locator("#openModal");
    return (await openBtn.count()) > 0;
  }

  async apply(page: Page, profile: UserProfile): Promise<ApplicationResult> {
    const start = Date.now();

    try {
      info(this.id, "start", "begin apply", { url: page.url() });

      // 1) Open modal
      info(this.id, "modal", "open modal");
      const openBtn = page.locator("#openModal");
      await humanHoverThenClick(openBtn);

      // 2) Fill message (>= 50 chars)
      info(this.id, "message", "prepare message");
      const messageBox = page.locator("#message");
      await humanScrollIntoView(messageBox);

      const msgRaw = renderTemplate(profile.coverLetter, { company: "Tsenta" });

      let msg = msgRaw.trim();
      if (msg.length < 50) {
        msg =
          msg +
          " I'm excited to connect and share more details about my background and interest.";
      }

      await readingPause();
      info(this.id, "message", "type field", { field: "message", length: msg.length });
      await humanType(messageBox, msg);
      await readingPause();

      // 3) Send
      info(this.id, "submit", "click send");
      const sendBtn = page.locator("#sendBtn");
      await humanHoverThenClick(sendBtn);

      // 4) Wait for confirmation ref to update
      info(this.id, "confirm", "wait for reference");
      const ref = page.locator("#tsent-ref");
      await ref.waitFor({ state: "visible", timeout: 10_000 });

      await page.waitForFunction(() => {
        const el = document.getElementById("tsent-ref");
        return !!el && el.textContent && el.textContent.trim() !== "TS-000000";
      });

      const confirmationId = (await ref.textContent())?.trim() || "TS-UNKNOWN";
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
}
