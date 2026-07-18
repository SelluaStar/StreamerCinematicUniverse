import { createClient } from "@/lib/supabase/client";

const STORAGE_KEY = "scu-saved-events-v1";
const REMIND_KEY = "scu-saved-event-reminders-v1";
const MERGED_KEY = "scu-saved-events-merged";

/** Fired whenever the saved-events list changes, so any mounted page can refresh without prop drilling. */
export const SAVED_EVENTS_CHANGE_EVENT = "scu:saved-events-changed";

export type SavedEventRecord = { slug: string; remind: boolean };

function readLocalSlugs(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function readLocalReminders(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(REMIND_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed as Record<string, boolean> : {};
  } catch {
    return {};
  }
}

function writeLocal(slugs: string[], reminders: Record<string, boolean>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(slugs));
  window.localStorage.setItem(REMIND_KEY, JSON.stringify(reminders));
  window.dispatchEvent(new CustomEvent(SAVED_EVENTS_CHANGE_EVENT));
}

export function listSavedEventSlugs(): string[] {
  return readLocalSlugs();
}

export function isEventSaved(slug: string): boolean {
  return readLocalSlugs().includes(slug);
}

export function isEventReminded(slug: string): boolean {
  return Boolean(readLocalReminders()[slug]);
}

/** Toggles the saved state for an event slug and returns the new saved state. */
export function toggleSavedEvent(slug: string): boolean {
  const all = readLocalSlugs();
  const reminders = readLocalReminders();
  const has = all.includes(slug);
  if (has) {
    delete reminders[slug];
    writeLocal(all.filter((item) => item !== slug), reminders);
    void syncToggleToCloud(slug, false, false);
    return false;
  }
  writeLocal([...all, slug], reminders);
  void syncToggleToCloud(slug, true, false);
  return true;
}

/** Save (or keep saved) and set remind flag. Returns whether the event is now saved. */
export function setEventReminder(slug: string, remind = true): boolean {
  const all = readLocalSlugs();
  const reminders = { ...readLocalReminders(), [slug]: remind };
  const next = all.includes(slug) ? all : [...all, slug];
  writeLocal(next, reminders);
  void syncToggleToCloud(slug, true, remind);
  return true;
}

async function syncToggleToCloud(slug: string, saved: boolean, remind: boolean) {
  try {
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    if (!saved) {
      await supabase.from("scu_saved_events").delete().eq("user_id", auth.user.id).eq("event_slug", slug);
      return;
    }
    await supabase.from("scu_saved_events").upsert({
      user_id: auth.user.id,
      event_slug: slug,
      remind,
    });
  } catch {
    // Guests / offline — localStorage is enough.
  }
}

/** Hydrate local cache from cloud after sign-in; merges local → cloud once. */
export async function hydrateSavedEventsFromCloud(): Promise<string[]> {
  if (typeof window === "undefined") return [];
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return readLocalSlugs();

  const { data, error } = await supabase
    .from("scu_saved_events")
    .select("event_slug, remind")
    .eq("user_id", auth.user.id);
  if (error) return readLocalSlugs();

  const cloud = (data || []) as Array<{ event_slug: string; remind: boolean }>;
  const cloudSlugs = new Set(cloud.map((row) => row.event_slug));
  const localSlugs = readLocalSlugs();
  const localReminders = readLocalReminders();
  const merged = !window.localStorage.getItem(MERGED_KEY);

  if (merged) {
    for (const slug of localSlugs) {
      if (!cloudSlugs.has(slug)) {
        await supabase.from("scu_saved_events").upsert({
          user_id: auth.user.id,
          event_slug: slug,
          remind: Boolean(localReminders[slug]),
        });
        cloudSlugs.add(slug);
        cloud.push({ event_slug: slug, remind: Boolean(localReminders[slug]) });
      }
    }
    window.localStorage.setItem(MERGED_KEY, "1");
  }

  const slugs = cloud.map((row) => row.event_slug);
  const reminders = Object.fromEntries(cloud.map((row) => [row.event_slug, row.remind]));
  writeLocal(slugs, reminders);
  return slugs;
}
