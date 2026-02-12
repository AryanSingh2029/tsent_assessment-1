import { info, warn } from "./logger";

export type RetryOptions = {
  tries?: number;          // default 3
  baseDelayMs?: number;    // default 250
  maxDelayMs?: number;     // default 1200
  jitterMs?: number;       // default 120
  ats?: string;            // for logging
  step?: string;           // for logging
  actionName?: string;     // for logging
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export async function retry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {}
): Promise<T> {
  const {
    tries = 3,
    baseDelayMs = 250,
    maxDelayMs = 1200,
    jitterMs = 120,
    ats = "core",
    step = "retry",
    actionName = "action",
  } = opts;

  let lastErr: unknown;

  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      if (attempt === 1) {
        info(ats, step, `try ${actionName}`, { attempt, tries });
      } else {
        warn(ats, step, `retrying ${actionName}`, { attempt, tries });
      }
      return await fn();
    } catch (e) {
      lastErr = e;

      if (attempt === tries) break;

      const backoff = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt - 1));
      const delay = backoff + randInt(0, jitterMs);

      warn(ats, step, `${actionName} failed; waiting before retry`, {
        attempt,
        delayMs: delay,
        error: (e as any)?.message ?? String(e),
      });

      await sleep(delay);
    }
  }

  throw lastErr;
}
