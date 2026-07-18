import "server-only";
import { type Event, type Platform, type Streamer } from "@/lib/data";
import { getEventFromDb, listEventsFromDb } from "@/lib/events/repository";
import { getLiveStreams, searchChannels } from "@/lib/twitch/helix";
import type { ScuLiveStream } from "@/lib/twitch/types";

export interface ScuRepository {
  listLiveStreams(): Promise<Streamer[]>;
  listEvents(): Promise<Event[]>;
  getEvent(slug: string): Promise<Event | null>;
  getStreamer(id: string): Promise<Streamer | null>;
}

const TWITCH_PLATFORM: Platform = "Twitch";

function toStreamer(stream: ScuLiveStream): Streamer {
  return {
    id: stream.channel.id,
    userId: stream.channel.id,
    name: stream.channel.displayName,
    handle: stream.channel.login,
    login: stream.channel.login,
    initials: stream.channel.displayName.slice(0, 2).toUpperCase(),
    platform: TWITCH_PLATFORM,
    category: stream.gameName,
    viewers: stream.viewerCount,
    live: true,
    color: "#9146ff",
    verified: true,
    title: stream.title,
    profileImageUrl: stream.channel.profileImageUrl,
    thumbnailUrl: stream.thumbnailUrl,
    startedAt: stream.startedAt,
    gameId: stream.gameId,
  };
}

export class TwitchScuRepository implements ScuRepository {
  async listLiveStreams() {
    return (await getLiveStreams({ first: 100 })).data.map(toStreamer);
  }

  async listEvents() {
    return listEventsFromDb();
  }

  async getEvent(slug: string) {
    return (await getEventFromDb(slug)) ?? null;
  }

  async getStreamer(login: string) {
    const live = (await getLiveStreams({ userLogins: [login], first: 1 })).data[0];
    if (live) return toStreamer(live);
    const exact = (await searchChannels(login, 20)).data.find((channel) => channel.login.toLowerCase() === login.toLowerCase());
    if (!exact) return null;
    return {
      id: exact.id,
      userId: exact.id,
      name: exact.displayName,
      handle: exact.login,
      login: exact.login,
      initials: exact.displayName.slice(0, 2).toUpperCase(),
      platform: TWITCH_PLATFORM,
      category: exact.gameName || "Offline",
      viewers: 0,
      live: exact.isLive,
      color: "#9146ff",
      verified: true,
      title: exact.description,
      profileImageUrl: exact.profileImageUrl,
      gameId: exact.gameId,
    };
  }
}

export const scuRepository: ScuRepository = new TwitchScuRepository();
