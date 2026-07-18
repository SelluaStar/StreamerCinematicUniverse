"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Clapperboard, Eye, Play, X } from "lucide-react";
import type { ScuClip } from "@/lib/twitch/types";
import { formatViewers } from "@/lib/data";
import { cachedJsonFetch, peekCachedJson } from "@/components/features/twitch/client-cache";

function formatClipAge(iso: string) {
  const delta = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(delta / 3_600_000);
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

function formatDuration(seconds: number) {
  const whole = Math.max(1, Math.round(seconds));
  const mins = Math.floor(whole / 60);
  const secs = whole % 60;
  return mins ? `${mins}:${String(secs).padStart(2, "0")}` : `0:${String(secs).padStart(2, "0")}`;
}

function clipsUrl(params: {
  featured?: boolean;
  userLogins?: string[];
  gameId?: string;
  first?: number;
  days?: number;
}) {
  const query = new URLSearchParams({ first: String(params.first || 12), days: String(params.days || 7) });
  if (params.featured) query.set("featured", "1");
  if (params.gameId) query.set("game_id", params.gameId);
  params.userLogins?.forEach((login) => query.append("user_login", login));
  return `/api/twitch/clips?${query}`;
}

export function useTwitchClips(params: {
  featured?: boolean;
  userLogins?: string[];
  gameId?: string;
  first?: number;
  days?: number;
  enabled?: boolean;
} = {}) {
  const enabled = params.enabled !== false;
  const loginKey = params.userLogins?.join(",") || "";
  const url = clipsUrl({
    featured: params.featured,
    gameId: params.gameId,
    first: params.first,
    days: params.days,
    userLogins: loginKey ? loginKey.split(",").filter(Boolean) : undefined,
  });
  const cached = peekCachedJson<{ data?: ScuClip[] }>(url);
  const [clips, setClips] = useState<ScuClip[]>(() => cached?.data || []);
  const [loading, setLoading] = useState(() => enabled && !cached);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    let active = true;
    if (!peekCachedJson(url)) setLoading(true);
    setError(undefined);
    cachedJsonFetch<{ data?: ScuClip[] }>(url, { ttlMs: 90_000 })
      .then((payload) => { if (active) setClips(payload.data || []); })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : "Clips unavailable.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [enabled, url]);

  return { clips, loading: enabled ? loading : false, error };
}

function ClipCard({ clip, onPlay }: { clip: ScuClip; onPlay: (clip: ScuClip) => void }) {
  const href = clip.broadcasterLogin ? `/streamers/${clip.broadcasterLogin}` : clip.url;
  return (
    <article className="clip-card">
      <button type="button" className="clip-thumb" onClick={() => onPlay(clip)} aria-label={`Play clip: ${clip.title}`}>
        <img src={clip.thumbnailUrl} alt="" loading="lazy" decoding="async" />
        <span className="clip-duration">{formatDuration(clip.duration)}</span>
        <span className="viewer-badge"><Eye size={13} /> {formatViewers(clip.viewCount)}</span>
        <span className="play-hover"><Play fill="currentColor" /></span>
      </button>
      <div className="clip-info">
        <button type="button" className="clip-title" onClick={() => onPlay(clip)}>{clip.title}</button>
        <small>
          <Link href={href}>{clip.broadcasterName}</Link>
          <span>· {formatClipAge(clip.createdAt)}</span>
        </small>
      </div>
    </article>
  );
}

function ClipPlayerModal({ clip, onClose }: { clip: ScuClip; onClose: () => void }) {
  const parent = typeof window !== "undefined" ? window.location.hostname : "localhost";
  const src = `https://clips.twitch.tv/embed?clip=${encodeURIComponent(clip.id)}&parent=${encodeURIComponent(parent)}&autoplay=true`;
  const [elapsed, setElapsed] = useState(0);
  const duration = Math.max(1, Math.round(clip.duration || 1));

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const timer = window.setInterval(() => {
      setElapsed((value) => (value >= duration ? duration : value + 1));
    }, 1000);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearInterval(timer);
    };
  }, [onClose, duration]);

  const pct = Math.min(100, (elapsed / duration) * 100);

  return (
    <div className="modal-layer clip-modal" role="dialog" aria-modal="true" aria-label={clip.title}>
      <button type="button" className="clip-modal-scrim" aria-label="Close clip" onClick={onClose} />
      <div className="clip-modal-panel">
        <header>
          <div>
            <b>{clip.title}</b>
            <small>{clip.broadcasterName} · {formatViewers(clip.viewCount)} views</small>
          </div>
          <button type="button" className="icon-button subtle" aria-label="Close" onClick={onClose}><X size={18} /></button>
        </header>
        <div className="clip-modal-frame">
          <iframe title={clip.title} src={src} allowFullScreen />
        </div>
        <div className="clip-progress" aria-label="Clip progress (display only — seek in Twitch player)">
          <div className="clip-progress-track"><span style={{ width: `${pct}%` }} /></div>
          <small>{formatDuration(elapsed)} / {formatDuration(duration)} · seek with Twitch controls</small>
        </div>
        <footer>
          <a className="button secondary" href={clip.url} target="_blank" rel="noreferrer">Open on Twitch</a>
          {clip.broadcasterLogin && (
            <Link className="button glass" href={`/streamers/${clip.broadcasterLogin}`} onClick={onClose}>View channel</Link>
          )}
        </footer>
      </div>
    </div>
  );
}

export function ClipsSection({
  title,
  subtitle,
  href,
  featured,
  userLogins,
  gameId,
  first = 8,
  days = 7,
}: {
  title: string;
  subtitle?: string;
  href?: string;
  featured?: boolean;
  userLogins?: string[];
  gameId?: string;
  first?: number;
  days?: number;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const { clips, loading, error } = useTwitchClips({
    featured,
    userLogins,
    gameId,
    first,
    days,
    enabled: visible && (featured || Boolean(gameId) || Boolean(userLogins?.length)),
  });
  const [active, setActive] = useState<ScuClip>();
  const empty = useMemo(() => visible && !loading && !clips.length, [clips.length, loading, visible]);

  useEffect(() => {
    const node = sectionRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "240px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className="section-block clips-section">
      <div className="section-title">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {href && <Link href={href}>View all <span aria-hidden>›</span></Link>}
      </div>

      {(!visible || (loading && !clips.length)) && (
        <div className="clip-grid">
          {Array.from({ length: Math.min(first, 4) }, (_, index) => (
            <div className="clip-card skeleton-clip" key={index}>
              <div className="skeleton skeleton-media" />
              <div className="skeleton skeleton-line" />
              <div className="skeleton skeleton-short" />
            </div>
          ))}
        </div>
      )}

      {visible && !loading && empty && (
        <div className="empty-state compact">
          <Clapperboard />
          <h2>{error ? "Clips unavailable" : "No recent popular clips"}</h2>
          <p>{error || "Check back once creators drop new highlights."}</p>
        </div>
      )}

      {clips.length > 0 && (
        <div className="clip-grid">
          {clips.map((clip) => <ClipCard key={clip.id} clip={clip} onPlay={setActive} />)}
        </div>
      )}

      {active && <ClipPlayerModal clip={active} onClose={() => setActive(undefined)} />}
    </section>
  );
}
