import type { CampusPerson } from "@/lib/su-roster";

export type { CampusPerson } from "@/lib/su-roster";

export type Platform = "Twitch" | "YouTube";
export type LiveState = "live" | "upcoming" | "ended";

export interface Streamer {
  id: string;
  userId?: string;
  name: string;
  handle: string;
  login?: string;
  initials: string;
  platform: Platform;
  category: string;
  event?: string;
  viewers: number;
  live: boolean;
  color: string;
  verified?: boolean;
  title?: string;
  profileImageUrl?: string;
  thumbnailUrl?: string;
  startedAt?: string;
  gameId?: string;
}

export interface Event {
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
  attendees: string;
  twitchParticipants: string[];
  series?: "streamer-university" | "streamer-awards" | "twitch-rivals";
  parentSlug?: string;
  location?: string;
  sources?: string[];
  dayLabel?: string;
  revealLocked?: boolean;
}

export interface ScheduleItem {
  time: string;
  title: string;
  host: string;
  status: "live" | "next" | "upcoming" | "ended";
  slug?: string;
}

export interface CampusMoment {
  title: string;
  detail: string;
  day: string;
}

/** Live creators come from Twitch Helix — no mock streamer fixtures. */
export const streamers: Streamer[] = [];

/** Runtime catalog override (hydrated from `scu_events` via `/api/events`). */
let eventsCatalog: Event[] | null = null;

export function setEventsCatalog(next: Event[] | null) {
  eventsCatalog = next?.length ? next : null;
}

export function getEventsCatalog(): Event[] {
  return eventsCatalog ?? events;
}

/**
 * Streamer University curated from primary coverage (Wikipedia, Complex, Tubefilter,
 * Win.gg, KATV / NWA Democrat-Gazette / FOX16 local reporting). Status relative to Jul 17, 2026.
 */
export const events: Event[] = [
  {
    id: "su-2026",
    slug: "streamer-university",
    title: "Streamer University 2026",
    eyebrow: "Campus live · Day 3",
    description:
      "Kai Cenat’s second annual creator bootcamp is live at Hendrix College in Conway, Arkansas. About 120 students live on campus through the morning of July 20 for classes, clubs, challenges, and nonstop Twitch/YouTube coverage.",
    date: "JUL 15–20",
    time: "Daily from 3:00 PM ET",
    status: "live",
    category: "Streamer University",
    color: "#7c3aed",
    attendees: "~120 students",
    twitchParticipants: ["kaicenat", "fanum", "stableronaldo", "plaqueboymax", "jasontheween"],
    series: "streamer-university",
    location: "Hendrix College · Conway, Arkansas",
    sources: [
      "https://en.wikipedia.org/wiki/Streamer_University",
      "https://win.gg/kai-cenats-streamer-university-2026-has-begun/",
      "https://katv.com/news/local/streamer-university-bring-millions-of-viewers-to-hendrix-college-spotlighting-conway",
      "https://www.nwaonline.com/news/2026/jul/16/hendrix-college-gets-online-spotlight-from-twitch/",
    ],
    dayLabel: "Day 3 of 6",
  },
  {
    id: "su-opening",
    slug: "su-opening-day",
    title: "Opening Day & Move-In",
    eyebrow: "Completed · Day 1",
    description:
      "Orientation opened the Class of 2026 with campus move-in, Drake’s welcome video, and OVO care packages left in dorm rooms. Fanum and Walton returned in campus security roles as the week kicked off.",
    date: "JUL 15",
    time: "From 3:00 PM ET",
    status: "ended",
    category: "Streamer University",
    color: "#6d28d9",
    attendees: "Class of 2026",
    twitchParticipants: ["kaicenat", "fanum"],
    series: "streamer-university",
    parentSlug: "streamer-university",
    location: "Hendrix College",
    dayLabel: "Day 1",
  },
  {
    id: "su-picture-day",
    slug: "su-picture-day",
    title: "Picture Day",
    eyebrow: "On the board · Day 3",
    description:
      "Official campus portraits and class photos for the Streamer University yearbook look. Listed on the Day 1 board reveal (Win.gg) and scheduled Friday afternoon for the Class of 2026.",
    date: "JUL 17",
    time: "3:00–5:00 PM ET",
    status: "live",
    category: "Streamer University",
    color: "#8b5cf6",
    attendees: "Full class",
    twitchParticipants: ["kaicenat"],
    series: "streamer-university",
    parentSlug: "streamer-university",
    location: "Hendrix College",
    dayLabel: "Day 3",
  },
  {
    id: "su-karaoke-pool",
    slug: "su-karaoke-pool",
    title: "Pool Party & Karaoke",
    eyebrow: "Campus night life",
    description:
      "After-hours campus energy from the official SU board: pool party and karaoke sessions that turn dorm-week chaos into primetime collab content.",
    date: "JUL 16–17",
    time: "Evening / night block",
    status: "live",
    category: "Streamer University",
    color: "#2563eb",
    attendees: "Open campus",
    twitchParticipants: ["kaicenat", "fanum"],
    series: "streamer-university",
    parentSlug: "streamer-university",
    location: "Hendrix College",
    dayLabel: "Days 2–3",
  },
  {
    id: "su-homecoming",
    slug: "su-homecoming-alumni",
    title: "Homecoming · Alumni Reveal",
    eyebrow: "Reveal locked",
    description:
      "Selected Class of 2025 alumni are expected to return for Homecoming. The trailer teased alumni coming back — names stay blurred here until Kai unlocks the official reveal on stream.",
    date: "JUL 18",
    time: "Saturday homecoming block",
    status: "upcoming",
    category: "Streamer University",
    color: "#db2777",
    attendees: "Alumni TBA",
    twitchParticipants: ["kaicenat"],
    series: "streamer-university",
    parentSlug: "streamer-university",
    location: "Hendrix College",
    dayLabel: "Day 4",
    revealLocked: true,
  },
  {
    id: "su-fashion",
    slug: "su-fashion-show",
    title: "Fashion Show",
    eyebrow: "Upcoming on the board",
    description:
      "Campus fashion show from the revealed SU schedule. Fans have speculated a Vivet moment, but the runway itself is the confirmed board item.",
    date: "JUL 18–19",
    time: "Evening showcase",
    status: "upcoming",
    category: "Streamer University",
    color: "#c026d3",
    attendees: "Student runway",
    twitchParticipants: ["kaicenat"],
    series: "streamer-university",
    parentSlug: "streamer-university",
    location: "Hendrix College",
    dayLabel: "Weekend block",
  },
  {
    id: "su-talent",
    slug: "su-talent-show",
    title: "Talent Show",
    eyebrow: "Upcoming on the board",
    description:
      "Student talent showcase from Kai’s Day 1 schedule reveal — a stage night for breakout campus performances.",
    date: "JUL 19",
    time: "Evening showcase",
    status: "upcoming",
    category: "Streamer University",
    color: "#ea580c",
    attendees: "Performers TBA",
    twitchParticipants: ["kaicenat"],
    series: "streamer-university",
    parentSlug: "streamer-university",
    location: "Hendrix College",
    dayLabel: "Day 5",
  },
  {
    id: "su-spelling",
    slug: "su-spelling-bee",
    title: "Spelling Bee",
    eyebrow: "Upcoming on the board",
    description:
      "Competitive spelling bee listed on the official Streamer University extracurricular board for the 2026 campus week.",
    date: "JUL 19",
    time: "Afternoon / evening",
    status: "upcoming",
    category: "Streamer University",
    color: "#0891b2",
    attendees: "Competing students",
    twitchParticipants: ["kaicenat"],
    series: "streamer-university",
    parentSlug: "streamer-university",
    location: "Hendrix College",
    dayLabel: "Day 5",
  },
  {
    id: "su-closing",
    slug: "su-closing-ceremony",
    title: "Closing Ceremony",
    eyebrow: "Week wrap",
    description:
      "Streamer University 2026 wraps the morning of July 20 after five days of classes, clubs, and campus events. Expect awards energy similar to last year’s MVP / Worst Behavior / Best Roommates night.",
    date: "JUL 20",
    time: "Morning wrap",
    status: "upcoming",
    category: "Streamer University",
    color: "#4c1d95",
    attendees: "Full campus",
    twitchParticipants: ["kaicenat"],
    series: "streamer-university",
    parentSlug: "streamer-university",
    location: "Hendrix College",
    dayLabel: "Finale",
  },
  {
    id: "su-2025",
    slug: "streamer-university-2025",
    title: "Streamer University 2025",
    eyebrow: "Inaugural class · Past",
    description:
      "The first Streamer University ran May 22–25, 2025 at the University of Akron with 17 professors and about 120 students. The week drove roughly 23–27 million Twitch watch hours and closed with Drake’s message. It later won Best Streamed Event at The Streamer Awards.",
    date: "MAY 22–25, 2025",
    time: "Three-day campus",
    status: "ended",
    category: "Streamer University",
    color: "#5b21b6",
    attendees: "120 students · 17 professors",
    twitchParticipants: ["kaicenat"],
    series: "streamer-university",
    parentSlug: "streamer-university",
    location: "University of Akron · Akron, Ohio",
    sources: ["https://en.wikipedia.org/wiki/Streamer_University", "https://www.tubefilter.com/"],
    dayLabel: "Class of 2025",
  },
  {
    id: "sg-2026",
    slug: "streamer-games",
    title: "Streamer Games 2026",
    eyebrow: "Upcoming · 3rd Annual",
    description:
      "Ludwig’s Olympic-style creator competition returns August 1–2 at USC’s Allyson Felix Track & Field Complex. Streamers race, throw, and compete in chaos events for team gold — with a live fan fest and tickets at streamergames.gg.",
    date: "AUG 1–2, 2026",
    time: "Weekend track meet · PT window TBA",
    status: "upcoming",
    category: "Streamer Games",
    color: "#ca8a04",
    attendees: "Creator teams · Live audience",
    twitchParticipants: ["ludwig", "mogulmoves"],
    location: "Allyson Felix Track & Field Complex · USC, Los Angeles",
    sources: [
      "https://streamergames.gg/",
      "https://www.inkl.com/news/ludwigs-streamer-games-2026-event-dates-livestream-venue-tickets-and-creator-lineup",
      "https://streamscharts.com/news/ludwigs-streamer-games-2025",
    ],
    dayLabel: "Countdown",
  },
  {
    id: "twitch-rivals",
    slug: "twitch-rivals",
    title: "Twitch Rivals",
    eyebrow: "Official tournament series",
    description:
      "Competitive creator tournaments from Twitch Rivals. Individual shows sync automatically from schedule.twitchrivals.com whenever new dates land.",
    date: "See schedule",
    time: "ET windows per tournament",
    status: "upcoming",
    category: "Twitch Rivals",
    color: "#9146ff",
    attendees: "Multi-region",
    twitchParticipants: ["twitchrivals"],
    series: "twitch-rivals",
    location: "Twitch · Multi-region",
    sources: ["https://schedule.twitchrivals.com", "https://twitchrivals.com/"],
    dayLabel: "Synced schedule",
  },
  {
    id: "awards-2026",
    slug: "streamer-awards",
    title: "Streamer Awards 2026",
    eyebrow: "Upcoming · 6th Annual",
    description:
      "QTCinderella’s community-powered awards return November 12, 2026 — the Thursday before TwitchCon San Diego. Venue TBA; the host has teased a hard pivot and bigger production after 2025 crossed one million peak viewers.",
    date: "NOV 12, 2026",
    time: "Evening show · PT window TBA",
    status: "upcoming",
    category: "Streamer Awards",
    color: "#e11d48",
    attendees: "Industry night · Fan voted",
    twitchParticipants: ["qtcinderella", "maya"],
    series: "streamer-awards",
    location: "Los Angeles area · Venue TBA",
    sources: [
      "https://en.wikipedia.org/wiki/The_Streamer_Awards",
      "https://thestreamerawards.com/",
      "https://win.gg/qtcinderella-announces-streamer-awards-2026/",
    ],
    dayLabel: "Countdown",
  },
  {
    id: "awards-2025",
    slug: "streamer-awards-2025",
    title: "Streamer Awards 2025",
    eyebrow: "Archive · 5th Annual",
    description:
      "Held Dec 6, 2025 at The Wiltern with QTCinderella and Maya Higa. IShowSpeed won Streamer of the Year; the broadcast peaked above one million concurrent viewers.",
    date: "DEC 6, 2025",
    time: "From ~3:00 PM PT",
    status: "ended",
    category: "Streamer Awards",
    color: "#be123c",
    attendees: "1.0M+ peak viewers",
    twitchParticipants: ["qtcinderella", "maya"],
    series: "streamer-awards",
    parentSlug: "streamer-awards",
    location: "The Wiltern · Los Angeles",
    sources: ["https://en.wikipedia.org/wiki/2025_Streamer_Awards", "https://thestreamerawards.com/"],
    dayLabel: "2025 show",
  },
  {
    id: "awards-2024",
    slug: "streamer-awards-2024",
    title: "Streamer Awards 2024",
    eyebrow: "Archive · 4th Annual",
    description:
      "December 7, 2024 at the Mayan Theater with QTCinderella and TinaKitten. IShowSpeed took Streamer of the Year; shroud received the Legacy Award.",
    date: "DEC 7, 2024",
    time: "Awards night",
    status: "ended",
    category: "Streamer Awards",
    color: "#9f1239",
    attendees: "525K peak viewers",
    twitchParticipants: ["qtcinderella"],
    series: "streamer-awards",
    parentSlug: "streamer-awards",
    location: "Mayan Theater · Los Angeles",
    sources: ["https://en.wikipedia.org/wiki/2024_Streamer_Awards"],
    dayLabel: "2024 show",
  },
  {
    id: "awards-2023",
    slug: "streamer-awards-2023",
    title: "Streamer Awards 2023",
    eyebrow: "Archive · 3rd Annual",
    description:
      "February 17, 2024 at The Wiltern with QTCinderella and Pokimane. Kai Cenat won Streamer of the Year; Maximilian_DOOD took Legacy.",
    date: "FEB 17, 2024",
    time: "Awards night",
    status: "ended",
    category: "Streamer Awards",
    color: "#881337",
    attendees: "645K peak viewers",
    twitchParticipants: ["qtcinderella", "pokimane"],
    series: "streamer-awards",
    parentSlug: "streamer-awards",
    location: "The Wiltern · Los Angeles",
    sources: ["https://en.wikipedia.org/wiki/2023_Streamer_Awards"],
    dayLabel: "2023 show",
  },
  {
    id: "awards-2022",
    slug: "streamer-awards-2022",
    title: "Streamer Awards 2022",
    eyebrow: "Archive · 2nd Annual",
    description:
      "March 11, 2023 at The Wiltern with QTCinderella and Valkyrae. Kai Cenat’s first Streamer of the Year; Jerma985 won Legacy.",
    date: "MAR 11, 2023",
    time: "Awards night",
    status: "ended",
    category: "Streamer Awards",
    color: "#7f1d1d",
    attendees: "580K peak viewers",
    twitchParticipants: ["qtcinderella", "valkyrae"],
    series: "streamer-awards",
    parentSlug: "streamer-awards",
    location: "The Wiltern · Los Angeles",
    sources: ["https://en.wikipedia.org/wiki/2022_Streamer_Awards"],
    dayLabel: "2022 show",
  },
  {
    id: "awards-2021",
    slug: "streamer-awards-2021",
    title: "Streamer Awards 2021",
    eyebrow: "Archive · Inaugural",
    description:
      "The first Streamer Awards (March 12, 2022) at The Fonda Theatre launched the series. Ludwig Ahgren won Streamer of the Year; Pokimane received Legacy.",
    date: "MAR 12, 2022",
    time: "Awards night",
    status: "ended",
    category: "Streamer Awards",
    color: "#450a0a",
    attendees: "381K peak viewers",
    twitchParticipants: ["qtcinderella", "maya"],
    series: "streamer-awards",
    parentSlug: "streamer-awards",
    location: "The Fonda Theatre · Los Angeles",
    sources: ["https://en.wikipedia.org/wiki/The_Streamer_Awards"],
    dayLabel: "2021 show",
  },
];

export const categories = [
  { name: "Just Chatting", count: "Twitch live", color: "#f59e0b", glyph: "◌" },
  { name: "IRL", count: "Twitch live", color: "#ef4444", glyph: "◎" },
  { name: "Gaming", count: "Twitch live", color: "#22c55e", glyph: "◇" },
  { name: "Music", count: "Twitch live", color: "#ec4899", glyph: "♪" },
];

export const schedule: ScheduleItem[] = [
  { time: "JUL 15", title: "Opening Day & Move-In", host: "Kai Cenat + Drake welcome", status: "ended", slug: "su-opening-day" },
  { time: "JUL 16", title: "Classes · Clubs · Campus nights", host: "Professors & club directors", status: "ended" },
  { time: "JUL 17 · 3–5 PM ET", title: "Picture Day", host: "Full class portraits", status: "live", slug: "su-picture-day" },
  { time: "JUL 17", title: "Pool Party & Karaoke", host: "Open campus", status: "next", slug: "su-karaoke-pool" },
  { time: "JUL 18", title: "Homecoming · Alumni Reveal", host: "Selected Class of 2025", status: "upcoming", slug: "su-homecoming-alumni" },
  { time: "JUL 18–19", title: "Fashion Show", host: "Student runway", status: "upcoming", slug: "su-fashion-show" },
  { time: "JUL 19", title: "Talent Show", host: "Campus stage", status: "upcoming", slug: "su-talent-show" },
  { time: "JUL 19", title: "Spelling Bee", host: "Competing students", status: "upcoming", slug: "su-spelling-bee" },
  { time: "JUL 20", title: "Closing Ceremony", host: "Full campus wrap", status: "upcoming", slug: "su-closing-ceremony" },
];

export const suCurriculum = [
  "Content Creation 101",
  "Camera setup & lighting",
  "Audio & streaming gear",
  "Overlay / UI optimization",
  "Community management",
  "Chat moderation",
  "IRL streaming",
  "Gaming content",
  "Just Chatting strategies",
];

export const suProfessors: CampusPerson[] = [
  { name: "Agent00", role: "Professor", detail: "Creator curriculum", login: "agent00" },
  { name: "Duke Dennis", role: "Professor", detail: "Creator curriculum", login: "dukedennis" },
  { name: "Cinna", role: "Professor", detail: "Creator curriculum", login: "cinna" },
  { name: "The Sushi Dragon", role: "Professor", detail: "Creator curriculum", login: "thesushidragon" },
  { name: "Ludwig", role: "Professor", detail: "Creator curriculum", login: "ludwig" },
  { name: "Kaiya Cenat", role: "Professor", detail: "Creator curriculum" },
  { name: "Poudii", role: "Professor", detail: "Creator curriculum", login: "poudii" },
  { name: "Valkyrae", role: "Professor", detail: "Replaced Pokimane for family reasons", login: "valkyrae" },
  { name: "FaZe Adapt", role: "Professor", detail: "Creator curriculum", login: "adapt" },
  { name: "Lizzo", role: "Professor", detail: "Guest professor" },
];

export const suClubDirectors: CampusPerson[] = [
  { name: "T-Pain", role: "Musical Arts", detail: "Theme song workshop" },
  { name: "Lethal Shooter", role: "Basketball", detail: "Athletics club" },
  { name: "Nick Nayersina", role: "Fraternity", detail: "Campus fraternity" },
  { name: "Gibson Hazard", role: "Film", detail: "Film club with Oliver Cannon" },
  { name: "Oliver Cannon", role: "Film", detail: "Film club with Gibson Hazard" },
  { name: "Proto", role: "Science & Engineering", detail: "STEM club" },
  { name: "Markus King", role: "Debate", detail: "Debate club" },
  { name: "Yonna Jay", role: "Drama", detail: "Drama club" },
  { name: "Markell Washington", role: "Cheerleading", detail: "Cheer club" },
];

export { suStaff, suStudents, getStudentLogins, getCampusPeople } from "@/lib/su-roster";

/** @deprecated Use suStudents — kept for older imports */
export { suStudents as suStudentsSpotlight } from "@/lib/su-roster";

export const suSponsors = [
  "Meta",
  "Dell",
  "Red Bull",
  "Shopify",
  "State Farm",
  "Epic Games / Fortnite",
  "MrBeast briefcase hunt",
];

export const suMoments: CampusMoment[] = [
  { day: "Day 1", title: "Drake + OVO dorm drops", detail: "Welcome video and care packages in student rooms." },
  { day: "Day 1", title: "Private jet for Kanel Joseph", detail: "Kai sent a jet after a missed flight post." },
  { day: "Day 1", title: "Sketch’s $20K chain gift", detail: "Kylie “Sketch” Cox gifted Kai the chain he was wearing." },
  { day: "Day 1", title: "Campus security bits", detail: "Fanum’s fake arrest of Silky became an early viral clip." },
];

export const alumniRevealSlots = [
  { label: "Alumni seat 01", hint: "Class of 2025" },
  { label: "Alumni seat 02", hint: "Class of 2025" },
  { label: "Alumni seat 03", hint: "Class of 2025" },
  { label: "Alumni seat 04", hint: "Class of 2025" },
  { label: "Alumni seat 05", hint: "Class of 2025" },
  { label: "Alumni seat 06", hint: "Class of 2025" },
  { label: "Alumni seat 07", hint: "Returning collaborator" },
  { label: "Alumni seat 08", hint: "Returning collaborator" },
];

export function getSuHub() {
  return getEventsCatalog().find((event) => event.slug === "streamer-university")!;
}

export function getAwardsHub() {
  return getEventsCatalog().find((event) => event.slug === "streamer-awards")!;
}

export function getSuBoardEvents() {
  return getEventsCatalog().filter((event) => event.series === "streamer-university");
}

export function getAwardsBoardEvents() {
  return getEventsCatalog().filter((event) => event.series === "streamer-awards");
}

/** Top-level events for the Events directory (hubs only, not sub-moments). */
export function getTopLevelEvents() {
  return getEventsCatalog().filter((event) => !event.parentSlug);
}

export function getEventChildren(parentSlug: string) {
  return getEventsCatalog().filter((event) => event.parentSlug === parentSlug);
}

export function getEventBySlug(slug: string) {
  return getEventsCatalog().find((event) => event.slug === slug);
}

export const formatViewers = (value: number) =>
  value >= 1000 ? `${(value / 1000).toFixed(value >= 100000 ? 0 : 1)}K` : `${value}`;
