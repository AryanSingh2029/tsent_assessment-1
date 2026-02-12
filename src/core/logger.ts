type LogLevel = "info" | "warn" | "error";

type LogMeta = Record<string, string | number | boolean | undefined>;

function ts() {
  return new Date().toISOString();
}

function fmtMeta(meta?: LogMeta) {
  if (!meta) return "";
  const parts = Object.entries(meta)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${String(v)}`);
  return parts.length ? " " + parts.join(" ") : "";
}

export function log(
  level: LogLevel,
  ats: string,
  step: string,
  message: string,
  meta?: LogMeta
) {
  const line = `${ts()} [${level.toUpperCase()}] [${ats}] [${step}] ${message}${fmtMeta(meta)}`;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

// Convenience wrappers
export const info = (ats: string, step: string, msg: string, meta?: LogMeta) =>
  log("info", ats, step, msg, meta);

export const warn = (ats: string, step: string, msg: string, meta?: LogMeta) =>
  log("warn", ats, step, msg, meta);

export const error = (ats: string, step: string, msg: string, meta?: LogMeta) =>
  log("error", ats, step, msg, meta);
