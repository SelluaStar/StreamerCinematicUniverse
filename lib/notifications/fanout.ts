import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type FanoutPayload = {
  userId: string;
  type: string;
  title: string;
  body?: string;
  link?: string;
  dedupeKey: string;
  email?: { to: string; subject: string; html: string };
};

async function alreadySent(userId: string, type: string, dedupeKey: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("scu_notification_log")
    .select("id")
    .eq("user_id", userId)
    .eq("type", type)
    .eq("dedupe_key", dedupeKey)
    .maybeSingle();
  return Boolean(data);
}

async function markSent(userId: string, type: string, dedupeKey: string) {
  const admin = createAdminClient();
  await admin.from("scu_notification_log").upsert({
    user_id: userId,
    type,
    dedupe_key: dedupeKey,
  }, { onConflict: "user_id,type,dedupe_key" });
}

async function sendWebPush(userId: string, title: string, body: string, url: string) {
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("push_notifications").eq("id", userId).maybeSingle();
  if (profile && profile.push_notifications === false) return;

  const { data: subs } = await admin.from("scu_push_subscriptions").select("*").eq("user_id", userId);
  if (!subs?.length) return;

  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  if (!vapidPublic || !vapidPrivate) return;

  try {
    const webpush = await import("web-push");
    webpush.setVapidDetails("mailto:support@scu.app", vapidPublic, vapidPrivate);
    const payload = JSON.stringify({ title, body, url });
    await Promise.allSettled(
      subs.map((sub) =>
        webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload,
        ),
      ),
    );
  } catch (error) {
    console.error("web-push failed", error);
  }
}

async function sendEmail(to: string, subject: string, html: string) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "SCU <onboarding@resend.dev>";
  if (!key) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html }),
    });
  } catch (error) {
    console.error("email failed", error);
  }
}

/** Create in-app row + optional push + optional email (email only if profile.email_notifications). */
export async function fanoutNotification(input: FanoutPayload) {
  if (await alreadySent(input.userId, input.type, input.dedupeKey)) return false;
  const admin = createAdminClient();

  await admin.from("notifications").insert({
    user_id: input.userId,
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    link: input.link ?? null,
    read: false,
  });

  await sendWebPush(input.userId, input.title, input.body || "", input.link || "/");

  const { data: profile } = await admin
    .from("profiles")
    .select("email_notifications")
    .eq("id", input.userId)
    .maybeSingle();

  if (profile?.email_notifications && input.email) {
    await sendEmail(input.email.to, input.email.subject, input.email.html);
  }

  await markSent(input.userId, input.type, input.dedupeKey);
  return true;
}
