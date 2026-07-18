import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { events as fallbackEvents, type Event, type LiveState } from "@/lib/data";
import { ensureTwitchRivalsFresh } from "@/lib/events/twitch-rivals-sync";

type ScuEventRow = {
  id: string;
  slug: string;
  title: string;
  eyebrow: string;
  description: string;
  date: string;
  time: string;
  status: LiveState;
  category: string;
  color: string;
  attendees: number | string;
  twitch_participants: string[] | null;
  series: Event["series"] | null;
  parent_slug: string | null;
  location: string | null;
  sources: string[] | null;
  day_label: string | null;
  reveal_locked: boolean | null;
  starts_at: string | null;
  published: boolean;
};

function rowToEvent(row: ScuEventRow): Event {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    eyebrow: row.eyebrow,
    description: row.description,
    date: row.date,
    time: row.time,
    status: row.status,
    category: row.category,
    color: row.color,
    attendees: String(row.attendees ?? ""),
    twitchParticipants: row.twitch_participants || [],
    series: row.series || undefined,
    parentSlug: row.parent_slug || undefined,
    location: row.location || undefined,
    sources: row.sources || undefined,
    dayLabel: row.day_label || undefined,
    revealLocked: row.reveal_locked || undefined,
  };
}

export function eventToRow(event: Event, startsAt?: string | null) {
  return {
    id: event.id,
    slug: event.slug,
    title: event.title,
    eyebrow: event.eyebrow,
    description: event.description,
    date: event.date,
    time: event.time,
    status: event.status,
    category: event.category,
    color: event.color,
    attendees: Number.parseInt(String(event.attendees).replace(/[^\d]/g, ""), 10) || 0,
    twitch_participants: event.twitchParticipants,
    series: event.series ?? null,
    parent_slug: event.parentSlug ?? null,
    location: event.location ?? null,
    sources: event.sources ?? null,
    day_label: event.dayLabel ?? null,
    reveal_locked: Boolean(event.revealLocked),
    starts_at: startsAt ?? null,
    published: true,
    updated_at: new Date().toISOString(),
  };
}

export async function listEventsFromDb(): Promise<Event[]> {
  try {
    await ensureTwitchRivalsFresh().catch(() => undefined);
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("scu_events")
      .select("*")
      .eq("published", true)
      .order("starts_at", { ascending: true, nullsFirst: false });
    if (error || !data?.length) return fallbackEvents;
    return (data as ScuEventRow[]).map(rowToEvent);
  } catch {
    return fallbackEvents;
  }
}

export async function getEventFromDb(slug: string): Promise<Event | undefined> {
  try {
    await ensureTwitchRivalsFresh().catch(() => undefined);
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("scu_events")
      .select("*")
      .eq("slug", slug)
      .eq("published", true)
      .maybeSingle();
    if (error || !data) return fallbackEvents.find((event) => event.slug === slug);
    return rowToEvent(data as ScuEventRow);
  } catch {
    return fallbackEvents.find((event) => event.slug === slug);
  }
}

export async function seedEventsIfEmpty(options?: { force?: boolean }) {
  const admin = createAdminClient();
  if (!options?.force) {
    const { count } = await admin.from("scu_events").select("*", { count: "exact", head: true });
    if ((count || 0) > 0) return { seeded: 0 };
  }
  const rows = fallbackEvents.map((event) => eventToRow(event));
  const { error } = await admin.from("scu_events").upsert(rows, { onConflict: "slug" });
  if (error) throw error;
  return { seeded: rows.length };
}
