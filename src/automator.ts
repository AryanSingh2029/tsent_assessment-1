import { chromium } from "playwright";
import { sampleProfile } from "./profile";
import type { ApplicationResult, UserProfile } from "./types";

import { ATS_REGISTRY } from "./ats/registry";

const BASE_URL = "http://localhost:3939";

async function applyToJob(url: string, profile: UserProfile): Promise<ApplicationResult> {
  const startTime = Date.now();

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: "domcontentloaded" });

    // Pick adapter
    const adapter = await findAdapter(page);
    if (!adapter) {
      return {
        success: false,
        error: `No ATS adapter found for url=${url}`,
        durationMs: Date.now() - startTime,
      };
    }

    const result = await adapter.apply(page, profile);

    // Ensure durationMs is always set correctly
    return {
      ...result,
      durationMs: Date.now() - startTime,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message ?? String(err),
      durationMs: Date.now() - startTime,
    };
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

async function findAdapter(page: import("playwright").Page) {
  for (const adapter of ATS_REGISTRY) {
    try {
      if (await adapter.canHandle(page)) return adapter;
    } catch {
      // ignore adapter detection errors
    }
  }
  return null;
}

// ── Entry point ──────────────────────────────────────────────
async function main() {
  const targets = [
    { name: "Acme Corp", url: `${BASE_URL}/acme.html` },
    { name: "Globex Corporation", url: `${BASE_URL}/globex.html` },
    { name: "Tsent (YC-style)", url: `${BASE_URL}/ycombinator.html` },
    { name: "Dropr ATS", url: `${BASE_URL}/dropr.html` },
  ];

  for (const target of targets) {
    console.log(`\n--- Applying to ${target.name} ---`);

    try {
      const result = await applyToJob(target.url, sampleProfile);

      if (result.success) {
        console.log(`  Application submitted!`);
        console.log(`  Confirmation: ${result.confirmationId}`);
        console.log(`  Duration: ${result.durationMs}ms`);
      } else {
        console.error(`  Failed: ${result.error}`);
      }
    } catch (err) {
      console.error(`  Fatal error:`, err);
    }
  }
}

main();
