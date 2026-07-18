import { NextRequest, NextResponse } from "next/server";
import { getLiveStreams } from "@/lib/twitch/helix";
import { twitchErrorResponse, twitchJson } from "@/lib/twitch/http";

export async function GET(request: NextRequest) {
  const first = Number(request.nextUrl.searchParams.get("first") || 24);
  const after = request.nextUrl.searchParams.get("after") || undefined;
  const gameId = request.nextUrl.searchParams.get("game_id") || undefined;
  const languageParam = (request.nextUrl.searchParams.get("language") || "").trim().toLowerCase();
  // Twitch language codes are ISO 639-1 (two letters, optionally with a region suffix like "zh-hant").
  const language = /^[a-z]{2}(-[a-z]{2,4})?$/.test(languageParam) ? languageParam : undefined;
  const logins = request.nextUrl.searchParams.getAll("user_login").filter(Boolean);
  if (!Number.isFinite(first) || first < 1 || first > 100 || logins.length > 100) {
    return NextResponse.json({ error: "Invalid stream query." }, { status: 400 });
  }
  try {
    const result = await getLiveStreams({ first, after, gameId, userLogins: logins, language });
    return twitchJson(result, "public, s-maxage=45, stale-while-revalidate=120");
  } catch (error) {
    return twitchErrorResponse(error);
  }
}
