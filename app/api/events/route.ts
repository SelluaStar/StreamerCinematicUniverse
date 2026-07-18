import { NextResponse } from "next/server";
import { seedEventsIfEmpty, listEventsFromDb, eventToRow, getEventFromDb } from "@/lib/events/repository";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncTwitchRivals } from "@/lib/events/twitch-rivals-sync";
import type { Event } from "@/lib/data";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", auth.user.id).maybeSingle();
  if (profile?.role !== "admin" && profile?.role !== "owner") return null;
  return auth.user;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("seed") === "1") {
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const force = url.searchParams.get("force") === "1";
    const result = await seedEventsIfEmpty({ force });
    return NextResponse.json(result);
  }
  if (url.searchParams.get("syncTwitchRivals") === "1") {
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const result = await syncTwitchRivals({ force: true });
    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  }
  const slug = url.searchParams.get("slug");
  if (slug) {
    const event = await getEventFromDb(slug);
    return NextResponse.json({ event: event ?? null });
  }
  const events = await listEventsFromDb();
  return NextResponse.json({ events });
}

export async function POST(request: Request) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json() as { event: Event; startsAt?: string | null };
  if (!body.event?.slug) return NextResponse.json({ error: "Missing event" }, { status: 400 });
  const admin = createAdminClient();
  const row = eventToRow(body.event, body.startsAt);
  const { error } = await admin.from("scu_events").upsert(row, { onConflict: "slug" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json() as { slug?: string };
  if (!body.slug) return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  const admin = createAdminClient();
  const { error } = await admin.from("scu_events").delete().eq("slug", body.slug);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
