import "server-only";
import { z } from "zod";

const schema = z.object({
  TWITCH_CLIENT_ID: z.string().min(1),
  TWITCH_CLIENT_SECRET: z.string().min(1),
  TWITCH_REDIRECT_URI: z.string().url(),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32),
});

export type TwitchConfig = z.infer<typeof schema>;

let cached: TwitchConfig | undefined;

export function getTwitchConfig(): TwitchConfig {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const names = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Missing or invalid Twitch configuration: ${names}. See docs/TWITCH_SETUP.md.`);
  }
  cached = parsed.data;
  return cached;
}

export function getPublicAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

export function getEmbedParent() {
  return new URL(getPublicAppUrl()).hostname;
}
