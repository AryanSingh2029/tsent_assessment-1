import { test, expect } from "@playwright/test";
import { ATS_REGISTRY } from "../../src/ats/registry";
import { sampleProfile } from "../../src/profile";

type Target = {
  name: string;
  url: string;
  prefix: string;
  successSelector: string;
};

const BASE = "http://localhost:3939";

const TARGETS: Target[] = [
  { name: "Acme", url: `${BASE}/acme.html`, prefix: "ACM-", successSelector: ".success-page" },
  { name: "Globex", url: `${BASE}/globex.html`, prefix: "GX-", successSelector: "#globex-confirmation" },
  { name: "Tsent", url: `${BASE}/ycombinator.html`, prefix: "TS-", successSelector: "#confirmView" },
  { name: "Dropr", url: `${BASE}/dropr.html`, prefix: "DR-", successSelector: "#dropr-success" },
];

async function resolveAdapter(page: any) {
  for (const a of ATS_REGISTRY) {
    if (await a.canHandle(page)) return a;
  }
  throw new Error("No adapter found for this page");
}

for (const t of TARGETS) {
  test(`E2E: apply on ${t.name}`, async ({ page }) => {
    await page.goto(t.url, { waitUntil: "domcontentloaded" });

    const adapter = await resolveAdapter(page);
    const result = await adapter.apply(page, sampleProfile);

    // Core correctness asserts
    expect(result.success).toBe(true);
    expect(result.confirmationId).toBeTruthy();
    expect(result.confirmationId!.startsWith(t.prefix)).toBe(true);

    // UI correctness: success screen visible
    await expect(page.locator(t.successSelector)).toBeVisible();

    // Extra correctness: Globex salary slider value should match 85000 (your bug)
    if (t.name === "Globex") {
      const val = await page.locator("#g-salary").inputValue();
      expect(Number(val)).toBe(85000);
    }
  });
}
