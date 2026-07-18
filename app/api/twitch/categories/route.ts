import { NextRequest, NextResponse } from "next/server";
import { getTopCategories } from "@/lib/twitch/helix";
import { twitchErrorResponse, twitchJson } from "@/lib/twitch/http";

export async function GET(request: NextRequest) {
  const first = Number(request.nextUrl.searchParams.get("first") || 20);
  if (!Number.isFinite(first) || first < 1 || first > 100) {
    return NextResponse.json({ error: "Invalid category query." }, { status: 400 });
  }
  try {
    return twitchJson(await getTopCategories(first), "public, s-maxage=300, stale-while-revalidate=600");
  } catch (error) {
    return twitchErrorResponse(error);
  }
}
