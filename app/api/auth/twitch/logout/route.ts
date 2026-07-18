import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPublicAppUrl } from "@/lib/twitch/config";
import { TWITCH_SESSION_COOKIE } from "@/lib/twitch/session";

async function clearLinkedTwitch() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("linked_accounts").delete().eq("user_id", user.id).eq("provider", "twitch");
    }
  } catch {
    // Best-effort; cookie clear still proceeds.
  }
}

export async function POST() {
  await clearLinkedTwitch();
  const response = NextResponse.json({ connected: false });
  response.cookies.delete(TWITCH_SESSION_COOKIE);
  return response;
}

export async function GET() {
  await clearLinkedTwitch();
  const response = NextResponse.redirect(`${getPublicAppUrl()}/dashboard/connections?twitch=disconnected`);
  response.cookies.delete(TWITCH_SESSION_COOKIE);
  return response;
}
