import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getPublicAppUrl } from "@/lib/twitch/config";
import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/supabase/env";
import { exchangeAuthorizationCode, validateUserToken } from "@/lib/twitch/helix";
import {
  sealSession,
  secureCookie,
  TWITCH_SESSION_COOKIE,
  TWITCH_STATE_COOKIE,
} from "@/lib/twitch/session";

/** Shared Twitch OAuth callback used by both registered redirect paths. */
export async function handleTwitchCallback(request: NextRequest) {
  const appUrl = getPublicAppUrl();
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const denied = request.nextUrl.searchParams.get("error");
  const expectedState = request.cookies.get(TWITCH_STATE_COOKIE)?.value;

  if (denied === "redirect_mismatch") {
    return NextResponse.redirect(`${appUrl}/dashboard/connections?twitch=redirect_mismatch`);
  }
  if (denied) {
    return NextResponse.redirect(`${appUrl}/dashboard/connections?twitch=denied`);
  }
  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(`${appUrl}/dashboard/connections?twitch=invalid_state`);
  }

  try {
    const token = await exchangeAuthorizationCode(code);
    if (!token.refresh_token) throw new Error("Twitch did not provide a refresh token.");
    const validation = await validateUserToken(token.access_token);
    const sealed = await sealSession({
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: Date.now() + token.expires_in * 1000,
      userId: validation.user_id,
      login: validation.login,
      scopes: validation.scopes,
    });

    const response = NextResponse.redirect(`${appUrl}/dashboard/connections?twitch=connected`);
    response.cookies.delete(TWITCH_STATE_COOKIE);
    response.cookies.set(TWITCH_SESSION_COOKIE, sealed, { ...secureCookie, maxAge: 30 * 24 * 60 * 60 });

    // Best-effort link to the signed-in SCU user. Cookie session is the source of truth for Helix.
    try {
      const supabase = createServerClient(getSupabaseUrl(), getSupabasePublishableKey(), {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options);
            });
          },
        },
      });
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase.from("linked_accounts").upsert(
          {
            user_id: user.id,
            provider: "twitch",
            provider_user_id: validation.user_id,
            provider_login: validation.login,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,provider" },
        );
        if (error) console.error("linked_accounts upsert failed", error.message);
      }
    } catch (linkError) {
      console.error("Twitch link to SCU account failed", linkError);
    }

    return response;
  } catch (error) {
    console.error("Twitch OAuth callback failed", error);
    return NextResponse.redirect(`${appUrl}/dashboard/connections?twitch=failed`);
  }
}
