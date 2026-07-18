import "server-only";
import { NextResponse } from "next/server";
import { TwitchApiError } from "@/lib/twitch/types";
import type { PaginatedResult } from "@/lib/twitch/types";

export function twitchJson<T>(result: PaginatedResult<T>, cacheControl: string) {
  const headers = new Headers({ "Cache-Control": cacheControl });
  if (result.rateLimit?.limit !== undefined) headers.set("Ratelimit-Limit", String(result.rateLimit.limit));
  if (result.rateLimit?.remaining !== undefined) headers.set("Ratelimit-Remaining", String(result.rateLimit.remaining));
  if (result.rateLimit?.reset !== undefined) headers.set("Ratelimit-Reset", String(result.rateLimit.reset));
  return NextResponse.json(result, { headers });
}

export function twitchErrorResponse(error: unknown) {
  if (error instanceof TwitchApiError) {
    return NextResponse.json(
      { error: error.message, retryAt: error.retryAt },
      {
        status: error.status,
        headers: error.retryAt ? { "Retry-After": String(Math.max(error.retryAt - Math.floor(Date.now() / 1000), 1)) } : undefined,
      },
    );
  }
  const message = error instanceof Error ? error.message : "Twitch is temporarily unavailable.";
  return NextResponse.json({ error: message }, { status: 503 });
}
