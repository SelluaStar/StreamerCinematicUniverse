import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPublicAppUrl } from "@/lib/twitch/config";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/";
  const appUrl = getPublicAppUrl();

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("onboarding_completed")
          .eq("id", user.id)
          .maybeSingle();
        const target = profile?.onboarding_completed ? next : "/onboarding";
        return NextResponse.redirect(new URL(target, appUrl));
      }
      return NextResponse.redirect(new URL(next, appUrl));
    }
  }

  return NextResponse.redirect(new URL("/login?error=auth_callback", appUrl));
}
