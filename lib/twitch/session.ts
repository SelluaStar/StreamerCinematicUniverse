import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { EncryptJWT, jwtDecrypt } from "jose";
import { cookies } from "next/headers";
import { getTwitchConfig } from "@/lib/twitch/config";
import type { TwitchSession } from "@/lib/twitch/types";

export const TWITCH_SESSION_COOKIE = "scu_twitch_session";
export const TWITCH_STATE_COOKIE = "scu_twitch_oauth_state";

function encryptionKey() {
  return createHash("sha256").update(getTwitchConfig().SESSION_SECRET).digest();
}

export function createOAuthState() {
  return randomBytes(32).toString("hex");
}

export async function sealSession(session: TwitchSession) {
  return new EncryptJWT({ session })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .encrypt(encryptionKey());
}

export async function unsealSession(value: string): Promise<TwitchSession | null> {
  try {
    const { payload } = await jwtDecrypt(value, encryptionKey());
    return payload.session as TwitchSession;
  } catch {
    return null;
  }
}

export async function readTwitchSession() {
  const store = await cookies();
  const value = store.get(TWITCH_SESSION_COOKIE)?.value;
  return value ? unsealSession(value) : null;
}

export const secureCookie = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};
