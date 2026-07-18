export type ScuProfile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  onboarding_completed: boolean;
  preferred_language: string | null;
  region_mode: string | null;
  event_reminders?: boolean;
  live_alerts?: boolean;
  email_notifications?: boolean;
  push_notifications?: boolean;
  prefer_captions?: boolean;
  personalization?: boolean;
  role?: "customer" | "developer" | "admin" | "owner";
  created_at: string;
  updated_at: string;
};

export type ScuFollow = {
  id: string;
  follower_id: string;
  twitch_user_id: string;
  twitch_login: string;
  display_name: string | null;
  profile_image_url: string | null;
  created_at: string;
};

export type LinkedAccount = {
  id: string;
  user_id: string;
  provider: "twitch";
  provider_user_id: string;
  provider_login: string;
  created_at: string;
  updated_at: string;
};

export type ScuNotification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
};

export const USERNAME_PATTERN = /^[a-z0-9_]{3,24}$/;

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

export function profileInitials(profile: Pick<ScuProfile, "username" | "display_name"> | null | undefined) {
  const source = profile?.display_name || profile?.username || "?";
  return source.slice(0, 2).toUpperCase();
}

export function isScuAdmin(profile: ScuProfile | null | undefined) {
  return profile?.role === "admin" || profile?.role === "owner";
}
