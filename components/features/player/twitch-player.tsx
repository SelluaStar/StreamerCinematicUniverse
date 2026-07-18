"use client";

import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState } from "react";
import { getTwitchEmbedParents } from "@/lib/twitch/embed-parents";

interface TwitchPlayerInstance {
  play(): void;
  pause(): void;
  setMuted(value: boolean): void;
  getMuted(): boolean;
  setVolume(value: number): void;
  getVolume(): number;
  enableCaptions(): void;
  disableCaptions(): void;
  isPaused(): boolean;
  getQualities(): Array<{ group: string; name: string }>;
  setQuality(group: string): void;
  destroy(): void;
  addEventListener(event: string, callback: () => void): void;
}

interface TwitchConstructor {
  new (id: string, options: Record<string, unknown>): TwitchPlayerInstance;
  READY: string;
  PLAY: string;
  PAUSE: string;
  ONLINE: string;
  OFFLINE: string;
  PLAYBACK_BLOCKED: string;
}

declare global {
  interface Window {
    Twitch?: { Player: TwitchConstructor };
  }
}

export interface TwitchPlayerHandle {
  play(): void;
  pause(): void;
  setMuted(value: boolean): void;
  getMuted(): boolean;
  setVolume(value: number): void;
  getVolume(): number;
  /** Force mute + volume onto the embed even when React props did not change. */
  applyAudio(muted: boolean, volume: number): void;
  setCaptions(value: boolean): void;
  isPaused(): boolean;
  getQualities(): Array<{ group: string; name: string }>;
  setQuality(group: string): void;
  requestFullscreen(): Promise<void>;
}

interface TwitchPlayerProps {
  channel: string;
  muted: boolean;
  volume?: number;
  paused?: boolean;
  captions?: boolean;
  onReady?: () => void;
  onPlayingChange?: (playing: boolean) => void;
  onOnlineChange?: (online: boolean) => void;
  onBlocked?: () => void;
  /** Fired when the embed mute state drifts from our prop (e.g. Twitch native controls). */
  onMutedChange?: (muted: boolean) => void;
}

let scriptPromise: Promise<void> | undefined;

function loadTwitchScript() {
  if (window.Twitch?.Player) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      if (ok && window.Twitch?.Player) {
        resolve();
        return;
      }
      scriptPromise = undefined;
      reject(new Error("Twitch player failed to load."));
    };
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://player.twitch.tv/js/embed/v1.js"]');
    if (existing) {
      if (window.Twitch?.Player || existing.dataset.loaded === "true") {
        finish(Boolean(window.Twitch?.Player));
        return;
      }
      existing.addEventListener("load", () => { existing.dataset.loaded = "true"; finish(true); }, { once: true });
      existing.addEventListener("error", () => finish(false), { once: true });
      queueMicrotask(() => { if (window.Twitch?.Player) finish(true); });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://player.twitch.tv/js/embed/v1.js";
    script.async = true;
    script.addEventListener("load", () => { script.dataset.loaded = "true"; finish(true); }, { once: true });
    script.addEventListener("error", () => finish(false), { once: true });
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/**
 * Browser zoom / DPR changes can push Chromium video into a blown-out HDR color path — remount resets it.
 * Only react to real scale/DPR shifts (not visualViewport scroll / chrome show-hide noise).
 */
function useZoomRemountKey() {
  const [zoomKey, setZoomKey] = useState(0);
  useEffect(() => {
    const viewport = window.visualViewport;
    let lastScale = viewport?.scale ?? 1;
    let lastDpr = window.devicePixelRatio;
    let timer = 0;
    const check = () => {
      const scale = window.visualViewport?.scale ?? 1;
      const dpr = window.devicePixelRatio;
      // Ignore sub-percent viewport chrome jitter; require a real zoom/DPR change.
      if (Math.abs(scale - lastScale) < 0.05 && Math.abs(dpr - lastDpr) < 0.01) return;
      lastScale = scale;
      lastDpr = dpr;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setZoomKey((value) => value + 1), 220);
    };
    viewport?.addEventListener("resize", check);
    window.addEventListener("resize", check);
    return () => {
      window.clearTimeout(timer);
      viewport?.removeEventListener("resize", check);
      window.removeEventListener("resize", check);
    };
  }, []);
  return zoomKey;
}

function applyPaused(player: TwitchPlayerInstance, paused: boolean) {
  try {
    const isPaused = player.isPaused();
    if (paused && !isPaused) player.pause();
    else if (!paused && isPaused) player.play();
  } catch {
    if (paused) player.pause();
    else player.play();
  }
}

/** Twitch mute is independent of volume; always re-assert both so unmute is audible. */
function applyAudio(player: TwitchPlayerInstance, muted: boolean, volume: number) {
  const level = muted ? volume : Math.max(volume, 0.05);
  try {
    player.setMuted(muted);
    player.setVolume(level);
    // Re-assert after a tick — embed UI / autoplay policies sometimes ignore the first call.
    window.setTimeout(() => {
      try {
        player.setMuted(muted);
        player.setVolume(level);
      } catch {
        /* player may have been destroyed */
      }
    }, 0);
  } catch {
    try {
      player.setMuted(muted);
      player.setVolume(level);
    } catch {
      /* ignore */
    }
  }
}

export const TwitchPlayer = forwardRef<TwitchPlayerHandle, TwitchPlayerProps>(function TwitchPlayer(
  { channel, muted, volume = 0.7, paused, captions, onReady, onPlayingChange, onOnlineChange, onBlocked, onMutedChange },
  ref,
) {
  const reactId = useId();
  const zoomKey = useZoomRemountKey();
  const containerId = `twitch-player-${reactId.replaceAll(":", "")}-${zoomKey}`;
  const rootRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<TwitchPlayerInstance | null>(null);
  const callbacksRef = useRef({ onReady, onPlayingChange, onOnlineChange, onBlocked, onMutedChange });
  const settingsRef = useRef({ muted, volume, captions, paused });
  /** Ignore embed→React mute sync briefly after we push audio from the app. */
  const ignoreEmbedMuteUntilRef = useRef(0);
  const [error, setError] = useState<string>();

  const pushAudio = (nextMuted: boolean, nextVolume: number) => {
    const player = playerRef.current;
    if (!player) return;
    ignoreEmbedMuteUntilRef.current = Date.now() + 500;
    applyAudio(player, nextMuted, nextVolume);
  };

  useEffect(() => {
    callbacksRef.current = { onReady, onPlayingChange, onOnlineChange, onBlocked, onMutedChange };
    settingsRef.current = { muted, volume, captions, paused };
  }, [captions, muted, onBlocked, onMutedChange, onOnlineChange, onPlayingChange, onReady, paused, volume]);

  useImperativeHandle(ref, () => ({
    play: () => playerRef.current?.play(),
    pause: () => playerRef.current?.pause(),
    setMuted: (value) => {
      const level = settingsRef.current.volume;
      pushAudio(value, level);
    },
    getMuted: () => {
      try {
        return playerRef.current?.getMuted() ?? settingsRef.current.muted;
      } catch {
        return settingsRef.current.muted;
      }
    },
    setVolume: (value) => {
      pushAudio(settingsRef.current.muted, value);
    },
    getVolume: () => {
      try {
        return playerRef.current?.getVolume() ?? settingsRef.current.volume;
      } catch {
        return settingsRef.current.volume;
      }
    },
    applyAudio: (nextMuted, nextVolume) => {
      settingsRef.current = { ...settingsRef.current, muted: nextMuted, volume: nextVolume };
      pushAudio(nextMuted, nextVolume);
    },
    setCaptions: (value) => value ? playerRef.current?.enableCaptions() : playerRef.current?.disableCaptions(),
    isPaused: () => playerRef.current?.isPaused() ?? true,
    getQualities: () => playerRef.current?.getQualities() || [],
    setQuality: (group) => playerRef.current?.setQuality(group),
    requestFullscreen: async () => {
      const el = rootRef.current as (HTMLElement & {
        webkitRequestFullscreen?: () => void;
        msRequestFullscreen?: () => void;
      }) | null;
      if (!el) return;
      if (el.requestFullscreen) {
        await el.requestFullscreen();
        return;
      }
      el.webkitRequestFullscreen?.();
      el.msRequestFullscreen?.();
    },
  }), []);

  useEffect(() => {
    let active = true;
    void loadTwitchScript().then(() => {
      if (!active || !window.Twitch?.Player) return;
      const Player = window.Twitch.Player;
      const player = new Player(containerId, {
        width: "100%",
        height: "100%",
        channel,
        autoplay: true,
        muted: settingsRef.current.muted,
        parent: getTwitchEmbedParents(),
      });
      playerRef.current = player;
      player.addEventListener(Player.READY, () => {
        ignoreEmbedMuteUntilRef.current = Date.now() + 500;
        applyAudio(player, settingsRef.current.muted, settingsRef.current.volume);
        if (settingsRef.current.captions) player.enableCaptions();
        if (settingsRef.current.paused) player.pause();
        callbacksRef.current.onReady?.();
      });
      // Informational only — callers must not treat these as workspace pause intent
      // (Twitch emits PAUSE on buffer/park/visibility; writing that back stalls playback).
      player.addEventListener(Player.PLAY, () => callbacksRef.current.onPlayingChange?.(true));
      player.addEventListener(Player.PAUSE, () => callbacksRef.current.onPlayingChange?.(false));
      player.addEventListener(Player.ONLINE, () => callbacksRef.current.onOnlineChange?.(true));
      player.addEventListener(Player.OFFLINE, () => callbacksRef.current.onOnlineChange?.(false));
      player.addEventListener(Player.PLAYBACK_BLOCKED, () => callbacksRef.current.onBlocked?.());
    }).catch((reason) => {
      if (active) setError(reason instanceof Error ? reason.message : "Twitch player failed to load.");
    });
    return () => {
      active = false;
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [channel, containerId]);

  useEffect(() => {
    pushAudio(muted, volume);
  }, [muted, volume]);

  // Sync workspace mute UI when the viewer toggles mute on the Twitch embed itself.
  useEffect(() => {
    const id = window.setInterval(() => {
      const player = playerRef.current;
      const onChange = callbacksRef.current.onMutedChange;
      if (!player || !onChange || Date.now() < ignoreEmbedMuteUntilRef.current) return;
      try {
        const embedMuted = player.getMuted();
        if (embedMuted !== settingsRef.current.muted) onChange(embedMuted);
      } catch {
        /* player may not be ready */
      }
    }, 600);
    return () => window.clearInterval(id);
  }, [channel, containerId]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player || paused === undefined) return;
    applyPaused(player, paused);
  }, [paused]);
  useEffect(() => {
    if (!playerRef.current || captions === undefined) return;
    if (captions) playerRef.current.enableCaptions();
    else playerRef.current.disableCaptions();
  }, [captions]);

  // Resume after tab focus / portal unpark when the workspace still wants playback.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const resumeIfNeeded = () => {
      const player = playerRef.current;
      if (!player || settingsRef.current.paused) return;
      applyPaused(player, false);
    };

    const onVisibility = () => {
      if (!document.hidden) resumeIfNeeded();
    };

    const observer = typeof IntersectionObserver !== "undefined"
      ? new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting && entry.intersectionRatio > 0)) resumeIfNeeded();
      }, { threshold: 0.05 })
      : null;
    observer?.observe(root);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      observer?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [channel, containerId]);

  return (
    <div ref={rootRef} className="twitch-player-root">
      <div id={containerId} className="twitch-player-embed" key={zoomKey} />
      {error && <div className="twitch-player-error" role="alert">{error}</div>}
    </div>
  );
});
