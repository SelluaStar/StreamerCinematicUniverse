export type BrowserHint = "opera" | "unknown";

/** Opera / Opera GX — saturation issues in embedded video are usually browser-side, not SCU. */
export function detectBrowser(): BrowserHint {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;
  if (ua.includes("OPR/") || ua.includes("Opera")) return "opera";
  return "unknown";
}

export function isOpera(): boolean {
  return detectBrowser() === "opera";
}
