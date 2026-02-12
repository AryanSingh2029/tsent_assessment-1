import type { Locator } from "playwright";

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export async function humanPause(minMs = 60, maxMs = 220) {
  const ms = randInt(minMs, maxMs);
  await new Promise((r) => setTimeout(r, ms));
}

export async function humanScrollIntoView(locator: Locator) {
  await locator.scrollIntoViewIfNeeded();
  await humanPause(80, 200);
}

export async function humanHoverThenClick(locator: Locator) {
  await humanScrollIntoView(locator);
  await locator.hover({ timeout: 10_000 });
  await humanPause(50, 160);
  await locator.click({ timeout: 10_000 });
  await humanPause(80, 220);
}

export async function humanType(locator: Locator, text: string) {
  await humanScrollIntoView(locator);
  await locator.click({ timeout: 10_000 });
  // Clear any existing text (safe)
  await locator.fill("");

  for (const ch of text) {
    const slow = /[^a-zA-Z\s]/.test(ch); // numbers/special chars slower
    const delay = slow ? randInt(55, 140) : randInt(10, 35);
    await locator.type(ch, { delay });
  }
  await humanPause(80, 200);
}
export async function readingPause() {
  // Simulates “reading/thinking” time between sections/steps
  await humanPause(600, 1600);
}
