import { NextRequest, NextResponse } from "next/server";
import { getFollowedStreams, refreshUserToken } from "@/lib/twitch/helix";
import { twitchErrorResponse, twitchJson } from "@/lib/twitch/http";
import {
  readTwitchSession,
  sealSession,
  secureCookie,
  TWITCH_SESSION_COOKIE,
} from "@/lib/twitch/session";
import { TwitchApiError } from "@/lib/twitch/types";

export async function GET(request: NextRequest) {
  let session = await readTwitchSession();
  if (!session) return NextResponse.json({ error: "Connect Twitch to see followed streams." }, { status: 401 });

  try {
    let rotated = false;
    if (session.expiresAt <= Date.now() + 60_000) {
      const token = await refreshUserToken(session.refreshToken);
      session = {
        ...session,
        accessToken: token.access_token,
        refreshToken: token.refresh_token || session.refreshToken,
        expiresAt: Date.now() + token.expires_in * 1000,
        scopes: token.scope || session.scopes,
      };
      rotated = true;
    }
    const result = await getFollowedStreams(
      session.userId,
      session.accessToken,
      request.nextUrl.searchParams.get("after") || undefined,
    );
    const response = twitchJson(result, "private, no-store");
    if (rotated) {
      response.cookies.set(TWITCH_SESSION_COOKIE, await sealSession(session), {
        ...secureCookie,
        maxAge: 30 * 24 * 60 * 60,
      });
    }
    return response;
  } catch (error) {
    if (error instanceof TwitchApiError && error.status === 401) {
      const response = NextResponse.json({ error: "Twitch authorization expired. Reconnect Twitch." }, { status: 401 });
      response.cookies.delete(TWITCH_SESSION_COOKIE);
      return response;
    }
    return twitchErrorResponse(error);
  }
}
