/**
 * Standalone Twitch Rivals sync (no Next server-only imports).
 * Usage: node scripts/run-twitch-rivals-sync.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvLocal();

const TZ = "America/New_York";
const FEED = "https://schedule.twitchrivals.com/events.json";
const PARENT = "twitch-rivals";
const COLOR = "#9146ff";

function nyDateKey(date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function statusFor(startsAt, endsAt, now = new Date()) {
  const today = nyDateKey(now);
  const startDay = nyDateKey(new Date(startsAt));
  const endDay = nyDateKey(new Date(endsAt || startsAt));
  if (today >= startDay && today <= endDay) return "live";
  if (startDay > today) return "upcoming";
  return "ended";
}

function formatNyDate(date) {
  return new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "short", day: "numeric" })
    .format(date)
    .toUpperCase()
    .replace(",", "");
}

function formatNyTime(date) {
  return new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" }).format(date);
}

function dateLabel(startsAt, endsAt) {
  const start = new Date(startsAt);
  const end = new Date(endsAt || startsAt);
  const a = formatNyDate(start);
  const b = formatNyDate(end);
  return nyDateKey(start) === nyDateKey(end) ? a : `${a}–${b}`;
}

function timeLabel(startsAt, endsAt) {
  const start = new Date(startsAt);
  const end = new Date(endsAt || startsAt);
  if (nyDateKey(start) === nyDateKey(end)) return `${formatNyTime(start)}–${formatNyTime(end)} ET`;
  return `From ${formatNyTime(start)} ET`;
}

function rowFromEvent(event, startsAt) {
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
    reveal_locked: false,
    starts_at: startsAt ?? null,
    published: true,
    updated_at: new Date().toISOString(),
  };
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing Supabase URL or secret key in env");
  process.exit(1);
}

const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const now = new Date();
const series = await (await fetch(FEED, { headers: { Accept: "application/json" } })).json();
const children = [];
const childMeta = [];

for (const item of series) {
  if (item?.type !== "series" || !item.attributes?.startsAt || !item.attributes?.slug) continue;
  const a = item.attributes;
  const status = statusFor(a.startsAt, a.endsAt, now);
  const slug = String(a.slug);
  const event = {
    id: `tr-${item.id}`,
    slug,
    title: a.name,
    eyebrow: status === "live" ? "Live on Twitch Rivals" : status === "upcoming" ? "Upcoming tournament" : "Past tournament",
    description:
      (a.description && a.description.trim() && a.description.trim() !== "More info coming soon!"
        ? a.description.trim()
        : `${a.name} on the official Twitch Rivals schedule.`) + (a.location ? ` Regions: ${a.location}.` : ""),
    date: dateLabel(a.startsAt, a.endsAt),
    time: timeLabel(a.startsAt, a.endsAt),
    status,
    category: "Twitch Rivals",
    color: COLOR,
    attendees: a.location || "Twitch Rivals",
    twitchParticipants: ["twitchrivals"],
    series: "twitch-rivals",
    parentSlug: PARENT,
    location: a.venue || a.location || undefined,
    sources: [`https://schedule.twitchrivals.com/events/${a.slug}`, "https://schedule.twitchrivals.com"],
    dayLabel: status === "live" ? "Happening now" : status === "upcoming" ? "Scheduled" : "Archive",
  };
  children.push(event);
  childMeta.push({ status, startsAt: a.startsAt, slug });
}

const live = children.filter((c) => c.status === "live");
const upcoming = children.filter((c) => c.status === "upcoming");
const parentStatus = live.length ? "live" : upcoming.length ? "upcoming" : "ended";
const nextChild = live[0] || upcoming[0] || children[0];
const preferred = childMeta
  .filter((r) => r.status === "live" || r.status === "upcoming")
  .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
const parentStarts = preferred[0]?.startsAt ?? null;

const parent = {
  id: PARENT,
  slug: PARENT,
  title: "Twitch Rivals",
  eyebrow:
    parentStatus === "live"
      ? live.length === 1
        ? `Live · ${live[0].title}`
        : `Live · ${live.length} tournaments today`
      : parentStatus === "upcoming" && upcoming[0]
        ? `Next · ${upcoming[0].title}`
        : "Archive · Twitch Rivals",
  description:
    parentStatus === "live"
      ? `Twitch Rivals has tournament${live.length === 1 ? "" : "s"} on the board today. Open the hub for brackets and related shows synced from schedule.twitchrivals.com.`
      : parentStatus === "upcoming"
        ? `Competitive creator tournaments from Twitch Rivals. Next up: ${upcoming[0]?.title || "TBA"}. Schedule auto-syncs from schedule.twitchrivals.com.`
        : "Competitive creator tournaments from Twitch Rivals. Past shows stay archived under this hub.",
  date: nextChild?.date || "Schedule TBA",
  time: nextChild?.time || "See tournament pages",
  status: parentStatus,
  category: "Twitch Rivals",
  color: COLOR,
  attendees: `${(live.length + upcoming.length) || children.length} tournaments`,
  twitchParticipants: ["twitchrivals"],
  series: "twitch-rivals",
  location: "Twitch · Multi-region",
  sources: ["https://schedule.twitchrivals.com", "https://twitchrivals.com/"],
  dayLabel: parentStatus === "live" ? "Happening today" : parentStatus === "upcoming" ? "Upcoming slate" : "Past series",
};

const rows = [rowFromEvent(parent, parentStarts), ...children.map((c, i) => rowFromEvent(c, childMeta[i].startsAt))];
const { error } = await admin.from("scu_events").upsert(rows, { onConflict: "slug" });
if (error) {
  console.error(error);
  process.exit(1);
}

const feedSlugs = new Set(children.map((c) => c.slug));
const { data: existing } = await admin
  .from("scu_events")
  .select("slug, status")
  .eq("series", "twitch-rivals")
  .eq("parent_slug", PARENT);
const stale = (existing || []).filter((row) => !feedSlugs.has(row.slug) && row.status !== "ended");
let markedEnded = 0;
if (stale.length) {
  const { error: endError } = await admin
    .from("scu_events")
    .update({ status: "ended", eyebrow: "Past tournament", day_label: "Archive", updated_at: new Date().toISOString() })
    .in(
      "slug",
      stale.map((r) => r.slug),
    );
  if (!endError) markedEnded = stale.length;
}

console.log(
  JSON.stringify(
    {
      ok: true,
      fetched: series.length,
      upserted: rows.length,
      markedEnded,
      parentStatus,
      live: live.map((c) => c.title),
      upcoming: upcoming.map((c) => c.title),
    },
    null,
    2,
  ),
);
