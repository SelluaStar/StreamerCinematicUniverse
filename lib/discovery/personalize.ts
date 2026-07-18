import type { Streamer } from "@/lib/data";
import { personalizationEnabled } from "@/lib/preferences/account-prefs";
import { listSavedEventSlugs } from "@/lib/saved-events";
import { getEventBySlug } from "@/lib/data";

/** Boost followed + saved-event participant streams to the front when personalization is on. */
export function personalizeStreams(streams: Streamer[], followedLogins: string[] = []): Streamer[] {
  if (!personalizationEnabled() || !streams.length) return streams;
  const boost = new Set(
    followedLogins.map((login) => login.toLowerCase()),
  );
  for (const slug of listSavedEventSlugs()) {
    const event = getEventBySlug(slug);
    for (const login of event?.twitchParticipants || []) boost.add(login.toLowerCase());
  }
  if (!boost.size) return streams;
  const ranked = [...streams];
  ranked.sort((a, b) => {
    const aBoost = boost.has((a.login || a.handle).toLowerCase()) ? 1 : 0;
    const bBoost = boost.has((b.login || b.handle).toLowerCase()) ? 1 : 0;
    return bBoost - aBoost;
  });
  return ranked;
}
