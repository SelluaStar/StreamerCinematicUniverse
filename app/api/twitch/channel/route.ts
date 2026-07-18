import { NextRequest, NextResponse } from "next/server";
import { getChannel } from "@/lib/twitch/helix";
import { twitchErrorResponse } from "@/lib/twitch/http";

export async function GET(request: NextRequest) {
  const login = request.nextUrl.searchParams.get("login")?.trim().toLowerCase() || "";
  if (!/^[a-z0-9_]{2,25}$/.test(login)) {
    return NextResponse.json({ error: "Invalid Twitch login." }, { status: 400 });
  }
  try {
    const channel = await getChannel(login);
    if (!channel) return NextResponse.json({ error: "Channel not found." }, { status: 404 });
    return NextResponse.json(channel, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
    });
  } catch (error) {
    return twitchErrorResponse(error);
  }
}
