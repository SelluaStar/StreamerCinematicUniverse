import type { NextRequest } from "next/server";
import { handleTwitchCallback } from "@/lib/twitch/oauth-callback";

/** Legacy path kept so older Twitch console entries still work. */
export async function GET(request: NextRequest) {
  return handleTwitchCallback(request);
}
