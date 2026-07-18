/** Hostnames Twitch embed APIs accept as `parent` for the current page. */
export function getTwitchEmbedParents(): string[] {
  if (typeof window === "undefined") return ["localhost"];
  const host = window.location.hostname || "localhost";
  const parents = new Set<string>();
  // Twitch rejects some IPv6 host forms — prefer localhost aliases for local dev.
  if (host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "::1") {
    parents.add("localhost");
    parents.add("127.0.0.1");
  } else {
    parents.add(host);
  }
  return [...parents];
}

export function getTwitchEmbedParentQuery(): string {
  return getTwitchEmbedParents()
    .map((parent) => `parent=${encodeURIComponent(parent)}`)
    .join("&");
}
