import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Event, LiveState } from "@/lib/data";

/** Parent hub slug for the entire Twitch Rivals series. */
export const TWITCH_RIVALS_PARENT_SLUG = "twitch-rivals";

/**
 * Schedule timestamps from schedule.twitchrivals.com use Eastern offsets (-04:00 / -05:00).
 * Status “today” checks use America/New_York so they match the site’s calendar day.
 */
export const TWITCH_RIVALS_TIMEZONE = "America/New_York";

const FEED_URL = "https://schedule.twitchrivals.com/events.json";
const PARENT_ID = "twitch-rivals";
const BRAND_COLOR = "#9146ff";
const SOURCE_HOME = "https://schedule.twitchrivals.com";

/** In-process fetch cache so cron + on-read refresh do not hammer the feed. */
const FETCH_CACHE_MS = 30 * 60 * 1000;
/** Re-sync when parent row is older than this (cron is primary; this is a safety net). */
const STALE_SYNC_MS = 3 * 60 * 60 * 1000;

type ChallongeSeries = {
  id: string;
  type: string;
  attributes: {
    name: string;
    description?: string | null;
    startsAt: string;
    endsAt?: string | null;
    slug: string;
    location?: string | null;
    venue?: string | null;
    discordUrl?: string | null;
  };
};

type FeedCache = { at: number; series: ChallongeSeries[] };
let feedCache: FeedCache | null = null;
let syncInFlight: Promise<TwitchRivalsSyncResult> | null = null;

export type TwitchRivalsSyncResult = {
  ok: boolean;
  fetched: number;
  upserted: number;
  markedEnded: number;
  parentStatus: LiveState;
  skipped?: boolean;
  reason?: string;
  error?: string;
};

function nyDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TWITCH_RIVALS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Live if any calendar day in [startsAt, endsAt] is today (America/New_York). */
export function statusForScheduleRange(startsAt: string, endsAt?: string | null, now = new Date()): LiveState {
  const today = nyDateKey(now);
  const startDay = nyDateKey(new Date(startsAt));
  const endDay = nyDateKey(new Date(endsAt || startsAt));
  if (today >= startDay && today <= endDay) return "live";
  if (startDay > today) return "upcoming";
  return "ended";
}

function formatNyDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TWITCH_RIVALS_TIMEZONE,
    month: "short",
    day: "numeric",
  })
    .format(date)
    .toUpperCase()
    .replace(",", "");
}

function formatNyTime(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TWITCH_RIVALS_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function dateLabel(startsAt: string, endsAt?: string | null): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt || startsAt);
  const startLabel = formatNyDate(start);
  const endLabel = formatNyDate(end);
  if (nyDateKey(start) === nyDateKey(end)) return startLabel;
  return `${startLabel}–${endLabel}`;
}

function timeLabel(startsAt: string, endsAt?: string | null): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt || startsAt);
  if (nyDateKey(start) === nyDateKey(end)) {
    return `${formatNyTime(start)}–${formatNyTime(end)} ET`;
  }
  return `From ${formatNyTime(start)} ET`;
}

function eyebrowFor(status: LiveState): string {
  if (status === "live") return "Live on Twitch Rivals";
  if (status === "upcoming") return "Upcoming tournament";
  return "Past tournament";
}

function childSlug(series: ChallongeSeries): string {
  return series.attributes.slug?.trim() || `twitch-rivals-${series.id}`;
}

function seriesToChildEvent(series: ChallongeSeries, now = new Date()): { event: Event; startsAt: string } {
  const attrs = series.attributes;
  const status = statusForScheduleRange(attrs.startsAt, attrs.endsAt, now);
  const slug = childSlug(series);
  const description =
    (attrs.description && attrs.description.trim() && attrs.description.trim() !== "More info coming soon!"
      ? attrs.description.trim()
      : `${attrs.name} on the official Twitch Rivals schedule.`) +
    (attrs.location ? ` Regions: ${attrs.location}.` : "");

  return {
    event: {
      id: `tr-${series.id}`,
      slug,
      title: attrs.name,
      eyebrow: eyebrowFor(status),
      description,
      date: dateLabel(attrs.startsAt, attrs.endsAt),
      time: timeLabel(attrs.startsAt, attrs.endsAt),
      status,
      category: "Twitch Rivals",
      color: BRAND_COLOR,
      attendees: attrs.location || "Twitch Rivals",
      twitchParticipants: ["twitchrivals"],
      series: "twitch-rivals",
      parentSlug: TWITCH_RIVALS_PARENT_SLUG,
      location: attrs.venue || attrs.location || undefined,
      sources: [`${SOURCE_HOME}/events/${attrs.slug}`, SOURCE_HOME],
      dayLabel: status === "live" ? "Happening now" : status === "upcoming" ? "Scheduled" : "Archive",
    },
    startsAt: attrs.startsAt,
  };
}

function buildParentEvent(children: Event[]): Event {
  const live = children.filter((c) => c.status === "live");
  const upcoming = children.filter((c) => c.status === "upcoming");
  const status: LiveState = live.length ? "live" : upcoming.length ? "upcoming" : "ended";

  const nextChild = live[0] || upcoming[0] || children[0];
  const activeCount = live.length + upcoming.length;

  let eyebrow = "Official tournament series";
  if (status === "live") {
    eyebrow = live.length === 1 ? `Live · ${live[0].title}` : `Live · ${live.length} tournaments today`;
  } else if (status === "upcoming" && upcoming[0]) {
    eyebrow = `Next · ${upcoming[0].title}`;
  } else if (status === "ended") {
    eyebrow = "Archive · Twitch Rivals";
  }

  const description =
    status === "live"
      ? `Twitch Rivals has tournament${live.length === 1 ? "" : "s"} on the board today. Open the hub for brackets and related shows synced from schedule.twitchrivals.com.`
      : status === "upcoming"
        ? `Competitive creator tournaments from Twitch Rivals. Next up: ${upcoming[0]?.title || "TBA"}. Schedule auto-syncs from schedule.twitchrivals.com.`
        : "Competitive creator tournaments from Twitch Rivals. Past shows stay archived under this hub.";

  return {
    id: PARENT_ID,
    slug: TWITCH_RIVALS_PARENT_SLUG,
    title: "Twitch Rivals",
    eyebrow,
    description,
    date: nextChild?.date || "Schedule TBA",
    time: nextChild?.time || "See tournament pages",
    status,
    category: "Twitch Rivals",
    color: BRAND_COLOR,
    attendees: `${activeCount || children.length} tournaments`,
    twitchParticipants: ["twitchrivals"],
    series: "twitch-rivals",
    location: "Twitch · Multi-region",
    sources: [SOURCE_HOME, "https://twitchrivals.com/"],
    dayLabel: status === "live" ? "Happening today" : status === "upcoming" ? "Upcoming slate" : "Past series",
  };
}

function eventToRow(event: Event, startsAt?: string | null) {
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

/** Prefer earliest live / upcoming starts_at for parent reminders. */
function parentStartsAt(childRows: { status: LiveState; startsAt: string }[]): string | null {
  const preferred = childRows
    .filter((row) => row.status === "live" || row.status === "upcoming")
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  if (preferred[0]) return preferred[0].startsAt;
  const newest = [...childRows].sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  return newest[0]?.startsAt ?? null;
}

export async function fetchTwitchRivalsSeries(force = false): Promise<ChallongeSeries[]> {
  if (!force && feedCache && Date.now() - feedCache.at < FETCH_CACHE_MS) {
    return feedCache.series;
  }

  const res = await fetch(FEED_URL, {
    headers: { Accept: "application/json", "User-Agent": "StreamerCinematicUniverse/1.0 (+twitch-rivals-sync)" },
    next: { revalidate: 1800 },
  });
  if (!res.ok) {
    throw new Error(`Twitch Rivals feed HTTP ${res.status}`);
  }
  const data = (await res.json()) as ChallongeSeries[] | { data?: ChallongeSeries[] };
  const series = (Array.isArray(data) ? data : data.data || []).filter(
    (item) => item?.type === "series" && item.attributes?.startsAt && item.attributes?.slug,
  );
  feedCache = { at: Date.now(), series };
  return series;
}

export async function syncTwitchRivals(options?: { force?: boolean }): Promise<TwitchRivalsSyncResult> {
  if (syncInFlight) return syncInFlight;
  syncInFlight = runSync(options?.force ?? false).finally(() => {
    syncInFlight = null;
  });
  return syncInFlight;
}

async function runSync(force: boolean): Promise<TwitchRivalsSyncResult> {
  try {
    const admin = createAdminClient();
    const now = new Date();
    const series = await fetchTwitchRivalsSeries(force);
    const childMapped = series.map((item) => seriesToChildEvent(item, now));
    const children = childMapped.map((row) => row.event);
    const childStartMeta = childMapped.map((row) => ({
      status: row.event.status,
      startsAt: row.startsAt,
      slug: row.event.slug,
    }));

    const parentEvent = buildParentEvent(children);
    const parentRow = eventToRow(parentEvent, parentStartsAt(childStartMeta));
    const childRows = childMapped.map((row) => eventToRow(row.event, row.startsAt));
    const rows = [parentRow, ...childRows];

    const { error } = await admin.from("scu_events").upsert(rows, { onConflict: "slug" });
    if (error) throw error;

    // Children previously synced but missing from the current 100-item feed: keep history, mark ended.
    const feedSlugs = new Set(children.map((c) => c.slug));
    const { data: existing } = await admin
      .from("scu_events")
      .select("slug, status")
      .eq("series", "twitch-rivals")
      .eq("parent_slug", TWITCH_RIVALS_PARENT_SLUG);

    let markedEnded = 0;
    const stale = (existing || []).filter((row) => !feedSlugs.has(row.slug) && row.status !== "ended");
    if (stale.length) {
      const { error: endError } = await admin
        .from("scu_events")
        .update({
          status: "ended",
          eyebrow: "Past tournament",
          day_label: "Archive",
          updated_at: now.toISOString(),
        })
        .in(
          "slug",
          stale.map((row) => row.slug),
        );
      if (!endError) markedEnded = stale.length;
    }

    return {
      ok: true,
      fetched: series.length,
      upserted: rows.length,
      markedEnded,
      parentStatus: parentEvent.status,
    };
  } catch (error) {
    return {
      ok: false,
      fetched: 0,
      upserted: 0,
      markedEnded: 0,
      parentStatus: "upcoming",
      error: error instanceof Error ? error.message : "Twitch Rivals sync failed",
    };
  }
}

/** Sync when the parent hub is missing or older than STALE_SYNC_MS. */
export async function ensureTwitchRivalsFresh(): Promise<TwitchRivalsSyncResult | { skipped: true; reason: string }> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("scu_events")
      .select("updated_at, status")
      .eq("slug", TWITCH_RIVALS_PARENT_SLUG)
      .maybeSingle();

    if (data?.updated_at) {
      const age = Date.now() - new Date(data.updated_at).getTime();
      if (age < STALE_SYNC_MS) {
        return { skipped: true, reason: "fresh" };
      }
    }
    return syncTwitchRivals({ force: false });
  } catch (error) {
    return {
      ok: false,
      fetched: 0,
      upserted: 0,
      markedEnded: 0,
      parentStatus: "upcoming",
      error: error instanceof Error ? error.message : "Freshness check failed",
    };
  }
}

/** Static fallback parent when DB/sync is unavailable (no hardcoded tournaments). */
export function getTwitchRivalsFallbackParent(): Event {
  return {
    id: PARENT_ID,
    slug: TWITCH_RIVALS_PARENT_SLUG,
    title: "Twitch Rivals",
    eyebrow: "Official tournament series",
    description:
      "Competitive creator tournaments from Twitch Rivals. Individual shows sync automatically from schedule.twitchrivals.com.",
    date: "See schedule",
    time: "ET windows per tournament",
    status: "upcoming",
    category: "Twitch Rivals",
    color: BRAND_COLOR,
    attendees: "Multi-region",
    twitchParticipants: ["twitchrivals"],
    series: "twitch-rivals",
    location: "Twitch · Multi-region",
    sources: [SOURCE_HOME, "https://twitchrivals.com/"],
    dayLabel: "Synced schedule",
  };
}
