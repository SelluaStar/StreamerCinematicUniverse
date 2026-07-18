import { NextResponse } from "next/server";
import { refreshUserToken, validateUserToken } from "@/lib/twitch/helix";
import {
  readTwitchSession,
  sealSession,
  secureCookie,
  TWITCH_SESSION_COOKIE,
} from "@/lib/twitch/session";

export async function GET() {
  const session = await readTwitchSession();
  if (!session) return NextResponse.json({ connected: false });

  try {
    let current = session;
    let rotated = false;
    if (session.expiresAt <= Date.now() + 60_000) {
      const token = await refreshUserToken(session.refreshToken);
      current = {
        ...session,
        accessToken: token.access_token,
        refreshToken: token.refresh_token || session.refreshToken,
        expiresAt: Date.now() + token.expires_in * 1000,
        scopes: token.scope || session.scopes,
      };
      rotated = true;
    }
    const validation = await validateUserToken(current.accessToken);
    const response = NextResponse.json({
      connected: true,
      user: { id: validation.user_id, login: validation.login },
      scopes: validation.scopes,
    });
    if (rotated) {
      response.cookies.set(TWITCH_SESSION_COOKIE, await sealSession(current), {
        ...secureCookie,
        maxAge: 30 * 24 * 60 * 60,
      });
    }
    return response;
  } catch {
    const response = NextResponse.json({ connected: false, expired: true }, { status: 401 });
    response.cookies.delete(TWITCH_SESSION_COOKIE);
    return response;
  }
}
