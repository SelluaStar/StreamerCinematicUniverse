import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTwitchConfig, getPublicAppUrl } from "@/lib/twitch/config";
import { createOAuthState, secureCookie, TWITCH_STATE_COOKIE } from "@/lib/twitch/session";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.redirect(`${getPublicAppUrl()}/login?next=${encodeURIComponent("/dashboard/connections")}`);
    }

    const config = getTwitchConfig();
    const state = createOAuthState();
    const authorize = new URL("https://id.twitch.tv/oauth2/authorize");
    authorize.search = new URLSearchParams({
      response_type: "code",
      client_id: config.TWITCH_CLIENT_ID,
      redirect_uri: config.TWITCH_REDIRECT_URI,
      scope: "user:read:follows",
      state,
    }).toString();
    const response = NextResponse.redirect(authorize);
    response.cookies.set(TWITCH_STATE_COOKIE, state, { ...secureCookie, maxAge: 10 * 60 });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Twitch is not configured.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
