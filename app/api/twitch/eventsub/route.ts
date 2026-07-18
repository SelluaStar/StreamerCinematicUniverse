import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fanoutNotification } from "@/lib/notifications/fanout";

function verifyTwitchSignature(request: Request, rawBody: string) {
  const secret = process.env.TWITCH_EVENTSUB_SECRET;
  if (!secret) return false;
  const messageId = request.headers.get("twitch-eventsub-message-id") || "";
  const timestamp = request.headers.get("twitch-eventsub-message-timestamp") || "";
  const signature = request.headers.get("twitch-eventsub-message-signature") || "";
  const hmac = createHmac("sha256", secret);
  hmac.update(messageId + timestamp + rawBody);
  const expected = `sha256=${hmac.digest("hex")}`;
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const messageType = request.headers.get("twitch-eventsub-message-type");

  // Allow challenge without signature in some setups; still verify when secret set
  if (process.env.TWITCH_EVENTSUB_SECRET && !verifyTwitchSignature(request, rawBody)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  const body = JSON.parse(rawBody) as {
    challenge?: string;
    subscription?: { type?: string; status?: string };
    event?: { broadcaster_user_id?: string; broadcaster_user_login?: string; broadcaster_user_name?: string };
  };

  if (messageType === "webhook_callback_verification" && body.challenge) {
    return new NextResponse(body.challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }

  if (messageType === "notification" && body.subscription?.type === "stream.online") {
    const twitchUserId = body.event?.broadcaster_user_id;
    const login = body.event?.broadcaster_user_login || "";
    const name = body.event?.broadcaster_user_name || login;
    if (!twitchUserId) return NextResponse.json({ ok: true });

    const admin = createAdminClient();
    const { data: follows } = await admin
      .from("follows")
      .select("follower_id")
      .eq("twitch_user_id", twitchUserId);

    const followerIds = [...new Set((follows || []).map((row) => row.follower_id as string))];
    if (!followerIds.length) return NextResponse.json({ ok: true });

    const { data: profiles } = await admin
      .from("profiles")
      .select("id, live_alerts, email_notifications")
      .in("id", followerIds)
      .eq("live_alerts", true);

    // Resolve emails from auth.users via admin API when needed
    for (const profile of profiles || []) {
      let emailTo: string | undefined;
      if (profile.email_notifications) {
        try {
          const { data } = await admin.auth.admin.getUserById(profile.id);
          emailTo = data.user?.email || undefined;
        } catch {
          emailTo = undefined;
        }
      }
      await fanoutNotification({
        userId: profile.id,
        type: "scu_live",
        title: `${name} is live`,
        body: `Jump into their stream on SCU`,
        link: `/streamers/${login}`,
        dedupeKey: `live:${twitchUserId}:${new Date().toISOString().slice(0, 13)}`,
        email: emailTo
          ? {
              to: emailTo,
              subject: `${name} just went live`,
              html: `<p><strong>${name}</strong> is live on Twitch.</p><p><a href="${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/streamers/${login}">Watch on SCU</a></p>`,
            }
          : undefined,
      });
    }
  }

  return NextResponse.json({ ok: true });
}
