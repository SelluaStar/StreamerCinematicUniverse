"use client";

type CacheEntry = { expires: number; payload: unknown };

const memoryCache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<unknown>>();

const DEFAULT_TTL_MS = 45_000;

export async function cachedJsonFetch<T>(
  url: string,
  options: { ttlMs?: number; force?: boolean } = {},
): Promise<T> {
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const now = Date.now();
  if (!options.force) {
    const hit = memoryCache.get(url);
    if (hit && hit.expires > now) return hit.payload as T;
    const pending = inflight.get(url);
    if (pending) return pending as Promise<T>;
  }

  const request = fetch(url)
    .then(async (response) => {
      const payload = await response.json();
      if (!response.ok) {
        const message = typeof payload?.error === "string" ? payload.error : `Request failed (${response.status})`;
        throw new Error(message);
      }
      memoryCache.set(url, { expires: Date.now() + ttlMs, payload });
      return payload as T;
    })
    .finally(() => {
      inflight.delete(url);
    });

  inflight.set(url, request);
  return request;
}

export function peekCachedJson<T>(url: string): T | undefined {
  const hit = memoryCache.get(url);
  if (!hit || hit.expires <= Date.now()) return undefined;
  return hit.payload as T;
}
