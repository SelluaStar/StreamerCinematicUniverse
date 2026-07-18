export interface AwardsYearRecord {
  yearLabel: string;
  edition: string;
  slug: string;
  date: string;
  venue: string;
  hosts: string[];
  streamerOfTheYear: string;
  peakViewers?: string;
  highlights: string[];
  status: "upcoming" | "ended";
}

/** Archive curated from Wikipedia + thestreamerawards.com / Win.gg (as of Jul 2026). */
export const streamerAwardsLibrary: AwardsYearRecord[] = [
  {
    yearLabel: "2026",
    edition: "6th Annual",
    slug: "streamer-awards",
    date: "November 12, 2026",
    venue: "TBA · Los Angeles area (Thursday before TwitchCon San Diego)",
    hosts: ["QTCinderella", "TBA"],
    streamerOfTheYear: "TBA",
    highlights: [
      "Date locked for Nov 12, 2026 — the Thursday before TwitchCon.",
      "QTCinderella teased a hard pivot and structural changes after 2025 feedback.",
      "Venue and full host lineup still TBA.",
    ],
    status: "upcoming",
  },
  {
    yearLabel: "2025",
    edition: "5th Annual",
    slug: "streamer-awards-2025",
    date: "December 6, 2025",
    venue: "The Wiltern · Los Angeles",
    hosts: ["QTCinderella", "Maya Higa"],
    streamerOfTheYear: "IShowSpeed",
    peakViewers: "1,028,321",
    highlights: [
      "Peak viewership crossed one million for the first time.",
      "Kai Cenat took the most awards of the night (4).",
      "Streamer University won Best Streamed Event.",
      "Legacy Award went to Doublelift; Streamers’ Choice to JasonTheWeen.",
    ],
    status: "ended",
  },
  {
    yearLabel: "2024",
    edition: "4th Annual",
    slug: "streamer-awards-2024",
    date: "December 7, 2024",
    venue: "Mayan Theater · Los Angeles",
    hosts: ["QTCinderella", "TinaKitten"],
    streamerOfTheYear: "IShowSpeed",
    peakViewers: "525,708",
    highlights: [
      "Moved to a late-year schedule ahead of future TwitchCon-adjacent timing.",
      "IShowSpeed and Kai Cenat tied for most awards (3).",
      "Legacy Award went to shroud.",
    ],
    status: "ended",
  },
  {
    yearLabel: "2023",
    edition: "3rd Annual",
    slug: "streamer-awards-2023",
    date: "February 17, 2024",
    venue: "The Wiltern · Los Angeles",
    hosts: ["QTCinderella", "Pokimane"],
    streamerOfTheYear: "Kai Cenat",
    peakViewers: "645,166",
    highlights: [
      "Originally billed under a different year label before retroactive renumbering.",
      "Sapphire Award introduced era continued with Valkyrae.",
      "Legacy Award went to Maximilian_DOOD.",
    ],
    status: "ended",
  },
  {
    yearLabel: "2022",
    edition: "2nd Annual",
    slug: "streamer-awards-2022",
    date: "March 11, 2023",
    venue: "The Wiltern · Los Angeles",
    hosts: ["QTCinderella", "Valkyrae"],
    streamerOfTheYear: "Kai Cenat",
    peakViewers: "580,159",
    highlights: [
      "Kai Cenat’s first Streamer of the Year win.",
      "Legacy Award went to Jerma985.",
      "Streamers’ Choice went to PaymoneyWubby.",
    ],
    status: "ended",
  },
  {
    yearLabel: "2021",
    edition: "1st Annual",
    slug: "streamer-awards-2021",
    date: "March 12, 2022",
    venue: "The Fonda Theatre · Los Angeles",
    hosts: ["QTCinderella", "Maya Higa"],
    streamerOfTheYear: "Ludwig Ahgren",
    peakViewers: "381,436",
    highlights: [
      "Inaugural Streamer Awards founded by QTCinderella.",
      "Legacy Award went to Pokimane.",
      "Established the fan-vote + panel hybrid format.",
    ],
    status: "ended",
  },
];

export const streamerAwardsFacts = [
  "Founded by QTCinderella in 2022 (first show covered 2021).",
  "Nominees come from fan voting; winners use ~70% popular vote + ~30% panel.",
  "Trophy is a Peepo-style statue.",
  "Official site: thestreamerawards.com",
  "Typically streams on Twitch/YouTube via QTCinderella.",
];

export const streamerAwardsWatch = [
  "Twitch · twitch.tv/qtcinderella",
  "YouTube · @QTCinderella/live",
  "Red carpet + main show segments",
  "Follow @StreamerAwards for voting windows",
];

export function getAwardsYearBySlug(slug: string) {
  return streamerAwardsLibrary.find((year) => year.slug === slug);
}

export function getAwardsArchive() {
  return streamerAwardsLibrary.filter((year) => year.status === "ended");
}
