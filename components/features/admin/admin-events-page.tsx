"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/auth-provider";
import { isScuAdmin } from "@/lib/auth/types";
import type { Event, LiveState } from "@/lib/data";

const emptyEvent = (): Event => ({
  id: `evt-${Date.now()}`,
  slug: "",
  title: "",
  eyebrow: "",
  description: "",
  date: "",
  time: "",
  status: "upcoming",
  category: "Featured",
  color: "#8b6cff",
  attendees: "0",
  twitchParticipants: [],
});

export function AdminEventsPage({ announce }: { announce: (message: string) => void }) {
  const { profile, ready } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [draft, setDraft] = useState<Event>(emptyEvent());
  const [startsAt, setStartsAt] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/events");
    const json = await res.json() as { events?: Event[] };
    setEvents(json.events || []);
    setLoading(false);
  };

  useEffect(() => {
    if (ready && isScuAdmin(profile)) void load();
  }, [ready, profile]);

  if (!ready) return <div className="page"><p>Loading…</p></div>;
  if (!isScuAdmin(profile)) {
    return (
      <div className="page">
        <h1>Admin</h1>
        <p>You need an admin or owner role to manage events.</p>
        <Link href="/" className="button secondary">Home</Link>
      </div>
    );
  }

  const save = async () => {
    if (!draft.slug || !draft.title) {
      announce("Slug and title are required");
      return;
    }
    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: draft, startsAt: startsAt || null }),
    });
    if (!res.ok) {
      const json = await res.json() as { error?: string };
      announce(json.error || "Save failed");
      return;
    }
    announce("Event saved");
    setDraft(emptyEvent());
    setStartsAt("");
    await load();
  };

  const seed = async () => {
    const res = await fetch("/api/events?seed=1&force=1");
    const json = await res.json() as { seeded?: number; error?: string };
    if (!res.ok) {
      announce(json.error || "Seed failed");
      return;
    }
    announce(`Seeded ${json.seeded || 0} events`);
    await load();
  };

  const syncTwitchRivals = async () => {
    const res = await fetch("/api/events?syncTwitchRivals=1");
    const json = await res.json() as { ok?: boolean; upserted?: number; parentStatus?: string; error?: string };
    if (!res.ok) {
      announce(json.error || "Twitch Rivals sync failed");
      return;
    }
    announce(`Twitch Rivals synced (${json.upserted || 0} rows · ${json.parentStatus || "ok"})`);
    await load();
  };

  const remove = async (slug: string) => {
    const res = await fetch("/api/events", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
    });
    if (!res.ok) {
      announce("Delete failed");
      return;
    }
    announce("Event deleted");
    await load();
  };

  return (
    <div className="page admin-events">
      <div className="page-header">
        <div>
          <span className="eyebrow purple">Admin</span>
          <h1>Events CMS</h1>
          <p>Create and edit curated SCU events stored in Supabase.</p>
        </div>
        <div className="page-actions">
          <button type="button" className="button glass" onClick={() => void seed()}>Seed from code</button>
          <button type="button" className="button glass" onClick={() => void syncTwitchRivals()}>Sync Twitch Rivals</button>
          <button type="button" className="button primary" onClick={() => void save()}>Save event</button>
        </div>
      </div>

      <div className="admin-grid">
        <section className="admin-editor">
          <label>Title<input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label>
          <label>Slug<input value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} /></label>
          <label>Eyebrow<input value={draft.eyebrow} onChange={(e) => setDraft({ ...draft, eyebrow: e.target.value })} /></label>
          <label>Description<textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} rows={4} /></label>
          <label>Date<input value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} /></label>
          <label>Time<input value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })} /></label>
          <label>Status
            <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as LiveState })}>
              <option value="upcoming">upcoming</option>
              <option value="live">live</option>
              <option value="ended">ended</option>
            </select>
          </label>
          <label>Color<input value={draft.color} onChange={(e) => setDraft({ ...draft, color: e.target.value })} /></label>
          <label>Participants (comma logins)<input value={draft.twitchParticipants.join(",")} onChange={(e) => setDraft({ ...draft, twitchParticipants: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} /></label>
          <label>Starts at (ISO)<input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} /></label>
          <label>Parent slug<input value={draft.parentSlug || ""} onChange={(e) => setDraft({ ...draft, parentSlug: e.target.value || undefined })} /></label>
        </section>
        <section className="admin-list">
          <h2>{loading ? "Loading…" : `${events.length} events`}</h2>
          {events.map((event) => (
            <div key={event.id} className="admin-event-row">
              <div>
                <b>{event.title}</b>
                <small>{event.slug} · {event.status}</small>
              </div>
              <div>
                <button type="button" className="button glass" onClick={() => setDraft(event)}>Edit</button>
                <button type="button" className="button secondary" onClick={() => void remove(event.slug)}>Delete</button>
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
