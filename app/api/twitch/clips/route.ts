import { NextRequest, NextResponse } from "next/server";
import { getClips, getClipsForLogins, getFeaturedClips } from "@/lib/twitch/helix";
import { twitchErrorResponse, twitchJson } from "@/lib/twitch/http";

export async function GET(request: NextRequest) {
  const first = Number(request.nextUrl.searchParams.get("first") || 12);
  const days = Number(request.nextUrl.searchParams.get("days") || 7);
  const after = request.nextUrl.searchParams.get("after") || undefined;
  const gameId = request.nextUrl.searchParams.get("game_id") || undefined;
  const broadcasterId = request.nextUrl.searchParams.get("broadcaster_id") || undefined;
  const featured = request.nextUrl.searchParams.get("featured") === "1";
  const logins = request.nextUrl.searchParams.getAll("user_login").filter(Boolean);

  if (!Number.isFinite(first) || first < 1 || first > 40 || logins.length > 20) {
    return NextResponse.json({ error: "Invalid clips query." }, { status: 400 });
  }

  try {
    if (featured) {
      const result = await getFeaturedClips({ first, days });
      return twitchJson(result, "public, s-maxage=90, stale-while-revalidate=180");
    }
    if (logins.length) {
      const result = await getClipsForLogins({ logins, limit: first, days, firstPerChannel: Math.max(2, Math.ceil(first / logins.length)) });
      return twitchJson(result, "public, s-maxage=90, stale-while-revalidate=180");
    }
    if (broadcasterId || gameId) {
      const startedAt = new Date(Date.now() - Math.min(Math.max(days, 1), 30) * 24 * 60 * 60 * 1000).toISOString();
      const result = await getClips({ broadcasterId, gameId, first, after, startedAt });
      return twitchJson(result, "public, s-maxage=90, stale-while-revalidate=180");
    }
    return NextResponse.json({ error: "Provide featured=1, user_login, broadcaster_id, or game_id." }, { status: 400 });
  } catch (error) {
    return twitchErrorResponse(error);
  }
}
