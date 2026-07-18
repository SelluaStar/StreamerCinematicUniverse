/**
 * One-shot seed for scu_events from lib/data.ts fallback.
 * Run: node scripts/seed-scu-events.mjs
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY (or aliases) in env / .env.local
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY;

if (!url || !key) {
  console.error("Missing Supabase URL or secret key");
  process.exit(1);
}

const events = JSON.parse(
  readFileSync(resolve(process.cwd(), "scripts/scu-events-seed.json"), "utf8"),
);

const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { count, error: countError } = await admin
  .from("scu_events")
  .select("*", { count: "exact", head: true });

if (countError) {
  console.error(countError);
  process.exit(1);
}

if ((count || 0) > 0) {
  console.log(`scu_events already has ${count} rows — skip`);
  process.exit(0);
}

const { error } = await admin.from("scu_events").upsert(events, { onConflict: "slug" });
if (error) {
  console.error(error);
  process.exit(1);
}
console.log(`Seeded ${events.length} events`);
