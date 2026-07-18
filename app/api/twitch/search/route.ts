import { NextRequest, NextResponse } from "next/server";
import { searchChannels } from "@/lib/twitch/helix";
import { twitchErrorResponse, twitchJson } from "@/lib/twitch/http";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() || "";
  if (query.length < 2 || query.length > 100) {
    return NextResponse.json({ error: "Search must contain 2 to 100 characters." }, { status: 400 });
  }
  try {
    return twitchJson(await searchChannels(query), "public, s-maxage=20, stale-while-revalidate=30");
  } catch (error) {
    return twitchErrorResponse(error);
  }
}
