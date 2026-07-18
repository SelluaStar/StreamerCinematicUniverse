import { createClient } from "@/lib/supabase/client";
import { listSavedEventSlugs, isEventReminded } from "@/lib/saved-events";
import { listSavedWorkspaces } from "@/lib/multistream/saved-workspaces";
import { readLocalAccountPrefs } from "@/lib/preferences/account-prefs";
import type { ScuProfile, ScuFollow } from "@/lib/auth/types";

export async function downloadAccountExport(input: {
  profile: ScuProfile | null;
  follows: ScuFollow[];
  userEmail?: string | null;
}) {
  const payload = {
    exportedAt: new Date().toISOString(),
    email: input.userEmail ?? null,
    profile: input.profile,
    preferences: readLocalAccountPrefs(),
    follows: input.follows,
    savedEvents: listSavedEventSlugs().map((slug) => ({
      slug,
      remind: isEventReminded(slug),
    })),
    watchspaces: listSavedWorkspaces(),
  };

  try {
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (auth.user) {
      const [{ data: saved }, { data: spaces }, { data: stats }] = await Promise.all([
        supabase.from("scu_saved_events").select("*").eq("user_id", auth.user.id),
        supabase.from("scu_watchspaces").select("*").eq("user_id", auth.user.id),
        supabase.from("scu_watch_stats").select("*").eq("user_id", auth.user.id).maybeSingle(),
      ]);
      Object.assign(payload, {
        cloudSavedEvents: saved,
        cloudWatchspaces: spaces,
        watchStats: stats,
      });
    }
  } catch {
    // local export still useful
  }

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `scu-export-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
