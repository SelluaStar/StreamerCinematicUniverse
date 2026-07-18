import type { ScuProfile } from "@/lib/auth/types";
import { createClient } from "@/lib/supabase/client";

export type AccountPrefs = {
  eventReminders: boolean;
  liveAlerts: boolean;
  emailNotifications: boolean;
  pushNotifications: boolean;
  preferCaptions: boolean;
  personalization: boolean;
};

const LOCAL_KEYS = {
  eventReminders: "scu-event-reminders",
  liveAlerts: "scu-live-alerts",
  emailNotifications: "scu-email-notifications",
  pushNotifications: "scu-push-notifications",
  preferCaptions: "scu-captions",
  personalization: "scu-personalization",
} as const;

function readLocalBool(key: string, fallback: boolean) {
  if (typeof window === "undefined") return fallback;
  const value = localStorage.getItem(key);
  return value === null ? fallback : value === "true";
}

export function readLocalAccountPrefs(): AccountPrefs {
  return {
    eventReminders: readLocalBool(LOCAL_KEYS.eventReminders, true),
    liveAlerts: readLocalBool(LOCAL_KEYS.liveAlerts, false),
    emailNotifications: readLocalBool(LOCAL_KEYS.emailNotifications, false),
    pushNotifications: readLocalBool(LOCAL_KEYS.pushNotifications, true),
    preferCaptions: readLocalBool(LOCAL_KEYS.preferCaptions, false),
    personalization: readLocalBool(LOCAL_KEYS.personalization, true),
  };
}

export function prefsFromProfile(profile: ScuProfile | null | undefined): AccountPrefs {
  const local = readLocalAccountPrefs();
  if (!profile) return local;
  return {
    eventReminders: profile.event_reminders ?? local.eventReminders,
    liveAlerts: profile.live_alerts ?? local.liveAlerts,
    emailNotifications: profile.email_notifications ?? local.emailNotifications,
    pushNotifications: profile.push_notifications ?? local.pushNotifications,
    preferCaptions: profile.prefer_captions ?? local.preferCaptions,
    personalization: profile.personalization ?? local.personalization,
  };
}

export function writeLocalAccountPrefs(prefs: Partial<AccountPrefs>) {
  if (typeof window === "undefined") return;
  if (prefs.eventReminders !== undefined) localStorage.setItem(LOCAL_KEYS.eventReminders, `${prefs.eventReminders}`);
  if (prefs.liveAlerts !== undefined) localStorage.setItem(LOCAL_KEYS.liveAlerts, `${prefs.liveAlerts}`);
  if (prefs.emailNotifications !== undefined) localStorage.setItem(LOCAL_KEYS.emailNotifications, `${prefs.emailNotifications}`);
  if (prefs.pushNotifications !== undefined) localStorage.setItem(LOCAL_KEYS.pushNotifications, `${prefs.pushNotifications}`);
  if (prefs.preferCaptions !== undefined) localStorage.setItem(LOCAL_KEYS.preferCaptions, `${prefs.preferCaptions}`);
  if (prefs.personalization !== undefined) localStorage.setItem(LOCAL_KEYS.personalization, `${prefs.personalization}`);
}

export async function saveAccountPrefs(prefs: Partial<AccountPrefs>) {
  writeLocalAccountPrefs(prefs);
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;
  const patch: Record<string, boolean> = {};
  if (prefs.eventReminders !== undefined) patch.event_reminders = prefs.eventReminders;
  if (prefs.liveAlerts !== undefined) patch.live_alerts = prefs.liveAlerts;
  if (prefs.emailNotifications !== undefined) patch.email_notifications = prefs.emailNotifications;
  if (prefs.pushNotifications !== undefined) patch.push_notifications = prefs.pushNotifications;
  if (prefs.preferCaptions !== undefined) patch.prefer_captions = prefs.preferCaptions;
  if (prefs.personalization !== undefined) patch.personalization = prefs.personalization;
  if (!Object.keys(patch).length) return;
  await supabase.from("profiles").update(patch).eq("id", auth.user.id);
}

export function preferCaptionsEnabled() {
  return readLocalAccountPrefs().preferCaptions;
}

export function personalizationEnabled() {
  return readLocalAccountPrefs().personalization;
}
