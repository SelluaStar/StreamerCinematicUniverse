import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fanoutNotification } from "@/lib/notifications/fanout";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = Date.now();
  const windows = [
    { hours: 24, label: "in 24 hours", key: "24h" },
    { hours: 1, label: "in 1 hour", key: "1h" },
  ];

  let sent = 0;
  for (const window of windows) {
    const target = new Date(now + window.hours * 60 * 60 * 1000);
    const from = new Date(target.getTime() - 15 * 60 * 1000).toISOString();
    const to = new Date(target.getTime() + 15 * 60 * 1000).toISOString();

    const { data: events } = await admin
      .from("scu_events")
      .select("slug, title, starts_at")
      .eq("published", true)
      .gte("starts_at", from)
      .lte("starts_at", to);

    for (const event of events || []) {
      const { data: saved } = await admin
        .from("scu_saved_events")
        .select("user_id")
        .eq("event_slug", event.slug)
        .eq("remind", true);

      const userIds = [...new Set((saved || []).map((row) => row.user_id as string))];
      if (!userIds.length) continue;

      const { data: profiles } = await admin
        .from("profiles")
        .select("id, event_reminders, email_notifications")
        .in("id", userIds)
        .eq("event_reminders", true);

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
        const ok = await fanoutNotification({
          userId: profile.id,
          type: "scu_event_reminder",
          title: `${event.title} starts ${window.label}`,
          body: "Your saved event is coming up.",
          link: `/events/${event.slug}`,
          dedupeKey: `event:${event.slug}:${window.key}`,
          email: emailTo
            ? {
                to: emailTo,
                subject: `Reminder: ${event.title}`,
                html: `<p><strong>${event.title}</strong> starts ${window.label}.</p><p><a href="${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/events/${event.slug}">Open on SCU</a></p>`,
              }
            : undefined,
        });
        if (ok) sent += 1;
      }
    }
  }

  return NextResponse.json({ ok: true, sent });
}
