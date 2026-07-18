import type { NextRequest } from "next/server";
import { handleTwitchCallback } from "@/lib/twitch/oauth-callback";

/** Canonical callback matching the Twitch Developer Console redirect URI. */
export async function GET(request: NextRequest) {
  return handleTwitchCallback(request);
}
