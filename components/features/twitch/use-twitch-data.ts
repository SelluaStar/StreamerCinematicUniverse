"use client";

import { useCallback, useEffect, useState } from "react";
import type { ScuCategory, ScuLiveStream } from "@/lib/twitch/types";
import type { Streamer } from "@/lib/data";
import { cachedJsonFetch, peekCachedJson } from "@/components/features/twitch/client-cache";
import {
  CURATED_LANGUAGE_CODES,
  REGION_MODE_OTHER,
  helixLanguageParam,
  normalizeStreamLanguage,
} from "@/lib/preferences/stream-language";

export function liveStreamToStreamer(stream: ScuLiveStream): Streamer {
  const initials = stream.channel.displayName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  return {
    id: stream.channel.id,
    userId: stream.channel.id,
    name: stream.channel.displayName,
    handle: stream.channel.login,
    login: stream.channel.login,
    initials,
    platform: "Twitch",
    category: stream.gameName || "Twitch",
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

function streamsUrl(params: {
  gameId?: string;
  followed?: boolean;
  first?: number;
  userLogins?: string[];
  after?: string;
  language?: string;
  regionOther?: boolean;
}) {
  const query = new URLSearchParams({ first: String(params.first || 24) });
  if (params.gameId) query.set("game_id", params.gameId);
  if (params.language) query.set("language", params.language);
  // Distinguishes the "Other" request from an unfiltered one in the client cache.
  // The API ignores unknown params, so this only fetches without a language filter.
  if (params.regionOther) query.set("region", REGION_MODE_OTHER);
  params.userLogins?.forEach((login) => query.append("user_login", login));
  if (params.after) query.set("after", params.after);
  const endpoint = params.followed ? "/api/twitch/followed" : "/api/twitch/streams";
  return `${endpoint}?${query}`;
}

/** Drop streams whose content language is one of the curated codes (the "Other" region mode). */
function excludeCuratedLanguages(streams: ScuLiveStream[]): ScuLiveStream[] {
  return streams.filter((stream) => !CURATED_LANGUAGE_CODES.has((stream.language || "").toLowerCase()));
}

export function useTwitchStreams(params: {
  gameId?: string;
  followed?: boolean;
  first?: number;
  userLogins?: string[];
  enabled?: boolean;
  /**
   * Stream discovery preference ("any" | "other" | ISO 639-1 code). Only applied
   * to broad discovery queries — it is ignored for `followed` and specific
   * `userLogins` lookups, which target explicit channels.
   */
  language?: string;
} = {}) {
  const enabled = params.enabled !== false;
  const loginKey = params.userLogins?.join(",") || "";
  const hasLogins = Boolean(loginKey);
  // Language preferences only make sense for broad discovery, not specific-channel queries.
  const applyLanguage = !params.followed && !hasLogins;
  const helixLang = applyLanguage ? helixLanguageParam(params.language) : undefined;
  const regionOther = applyLanguage && normalizeStreamLanguage(params.language) === REGION_MODE_OTHER;
  const baseKey = streamsUrl({
    gameId: params.gameId,
    followed: params.followed,
    first: params.first,
    userLogins: loginKey ? loginKey.split(",").filter(Boolean) : undefined,
    language: helixLang,
    regionOther,
  });
  const cached = peekCachedJson<{ data?: ScuLiveStream[]; cursor?: string }>(baseKey);
  const [streams, setStreams] = useState<Streamer[]>(() => {
    const initial = cached?.data || [];
    return (regionOther ? excludeCuratedLanguages(initial) : initial).map(liveStreamToStreamer);
  });
  const [cursor, setCursor] = useState<string | undefined>(() => cached?.cursor);
  const [loading, setLoading] = useState(() => enabled && !cached);
  const [error, setError] = useState<string>();

  const load = useCallback(async (after?: string) => {
    if (!enabled) return;
    const logins = loginKey ? loginKey.split(",").filter(Boolean) : [];
    setError(undefined);
    if (!after) {
      const warm = peekCachedJson<{ data?: ScuLiveStream[]; cursor?: string }>(streamsUrl({
        gameId: params.gameId,
        followed: params.followed,
        first: params.first,
        userLogins: logins.length ? logins : undefined,
        language: helixLang,
        regionOther,
      }));
      if (!warm) setLoading(true);
    } else {
      setLoading(true);
    }

    try {
      if (logins.length > 100) {
        const chunks: string[][] = [];
        for (let i = 0; i < logins.length; i += 100) chunks.push(logins.slice(i, i + 100));
        const batches = await Promise.all(chunks.map(async (chunk) => {
          const url = streamsUrl({ first: Math.min(params.first || 100, 100), userLogins: chunk });
          const payload = await cachedJsonFetch<{ data?: ScuLiveStream[] }>(url, { ttlMs: 40_000 });
          return (payload.data || []).map(liveStreamToStreamer);
        }));
        const merged = batches.flat().sort((a, b) => b.viewers - a.viewers);
        setStreams(merged);
        setCursor(undefined);
        return;
      }

      const url = streamsUrl({
        gameId: params.gameId,
        followed: params.followed,
        first: params.first,
        userLogins: logins.length ? logins : undefined,
        after,
        language: helixLang,
        regionOther,
      });
      const payload = await cachedJsonFetch<{ data?: ScuLiveStream[]; cursor?: string }>(url, {
        ttlMs: params.followed ? 20_000 : 40_000,
        force: Boolean(after),
      });
      const rawData = payload.data || [];
      const next = (regionOther ? excludeCuratedLanguages(rawData) : rawData).map(liveStreamToStreamer);
      setStreams((current) => after ? [...current, ...next.filter((item) => !current.some((old) => old.id === item.id))] : next);
      setCursor(payload.cursor);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Twitch data is unavailable.");
    } finally {
      setLoading(false);
    }
  }, [enabled, loginKey, params.first, params.followed, params.gameId, helixLang, regionOther]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    void load();
  }, [enabled, load]);

  return {
    streams,
    cursor,
    loading: enabled ? loading : false,
    error,
    reload: () => load(),
    loadMore: cursor ? () => load(cursor) : undefined,
  };
}

export function useTwitchCategories(first = 12, enabled = true) {
  const url = `/api/twitch/categories?first=${first}`;
  const cached = peekCachedJson<{ data: ScuCategory[] }>(url);
  const [categories, setCategories] = useState<ScuCategory[]>(() => cached?.data || []);
  const [loading, setLoading] = useState(() => enabled && !cached);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    let active = true;
    if (!peekCachedJson(url)) setLoading(true);
    cachedJsonFetch<{ data: ScuCategory[] }>(url, { ttlMs: 5 * 60_000 })
      .then((payload) => { if (active) setCategories(payload.data || []); })
      .catch(() => undefined)
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [enabled, url]);

  return { categories, loading: enabled ? loading : false };
}

export interface TwitchChannelSearchResult {
  id: string;
  login: string;
  displayName: string;
  description: string;
  profileImageUrl: string;
  isLive: boolean;
  gameId: string;
  gameName: string;
}

export function channelSearchToStreamer(result: TwitchChannelSearchResult): Streamer {
  const initials = result.displayName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  return {
    id: result.id,
    userId: result.id,
    name: result.displayName,
    handle: result.login,
    login: result.login,
    initials,
    platform: "Twitch",
    category: result.gameName || "Twitch",
    viewers: 0,
    live: result.isLive,
    color: "#9146ff",
    verified: true,
    title: result.description,
    profileImageUrl: result.profileImageUrl,
    gameId: result.gameId,
  };
}

export async function searchTwitchChannels(query: string): Promise<TwitchChannelSearchResult[]> {
  const payload = await cachedJsonFetch<{ data?: TwitchChannelSearchResult[] }>(
    `/api/twitch/search?q=${encodeURIComponent(query)}`,
    { ttlMs: 20_000 },
  );
  return payload.data || [];
}
