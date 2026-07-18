import type { Platform } from "@/lib/data";

export type PlayerState = "idle" | "ready" | "playing" | "paused" | "blocked" | "offline";

export interface PlayerControls {
  play(): void;
  pause(): void;
  mute(): void;
  unmute(): void;
  setVolume(volume: number): void;
  setCaptions(enabled: boolean): void;
  getQualities(): Array<{ group: string; name: string }>;
  setQuality(group: string): void;
  reload(): void;
  requestFullscreen(): Promise<void>;
  isPaused(): boolean;
  destroy(): void;
}

export interface PlayerAdapter {
  platform: Platform;
  minimumWidth: number;
  minimumHeight: number;
  supportsCaptions: boolean;
  active: boolean;
  createEmbedUrl(sourceId: string, origin: string): string;
}

export const twitchAdapter: PlayerAdapter = {
  platform: "Twitch",
  minimumWidth: 400,
  minimumHeight: 300,
  supportsCaptions: true,
  active: true,
  createEmbedUrl(channel, origin) {
    const parent = new URL(origin).hostname;
    const params = new URLSearchParams({
      channel,
      parent,
      autoplay: "false",
      muted: "true",
    });
    return `https://player.twitch.tv/?${params}`;
  },
};

export const youtubeAdapter: PlayerAdapter = {
  platform: "YouTube",
  minimumWidth: 200,
  minimumHeight: 200,
  supportsCaptions: true,
  active: false,
  createEmbedUrl(videoId, origin) {
    const params = new URLSearchParams({
      autoplay: "0",
      mute: "1",
      enablejsapi: "1",
      playsinline: "1",
      origin,
    });
    return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?${params}`;
  },
};

export const playerAdapters: Record<Platform, PlayerAdapter> = {
  Twitch: twitchAdapter,
  YouTube: youtubeAdapter,
};
