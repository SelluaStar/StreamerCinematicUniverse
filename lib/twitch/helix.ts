import "server-only";
import { getTwitchConfig } from "@/lib/twitch/config";
import {
  type PaginatedResult,
  type ScuCategory,
  type ScuChannel,
  type ScuLiveStream,
  type TwitchChannelSearchDto,
  type TwitchChannelInfoDto,
  type TwitchClipDto,
  type TwitchGameDto,
  type TwitchResponse,
  type TwitchStreamDto,
  type TwitchTokenResponse,
  type TwitchTokenValidation,
  type TwitchUserDto,
  type ScuClip,
  TwitchApiError,
} from "@/lib/twitch/types";

const HELIX = "https://api.twitch.tv/helix";
const OAUTH = "https://id.twitch.tv/oauth2";

let appToken: { value: string; expiresAt: number } | undefined;
let appTokenRequest: Promise<string> | undefined;

async function requestAppToken(force = false): Promise<string> {
  if (!force && appToken && appToken.expiresAt > Date.now() + 60_000) return appToken.value;
  if (!force && appTokenRequest) return appTokenRequest;

  const request = (async () => {
    const config = getTwitchConfig();
    const body = new URLSearchParams({
      client_id: config.TWITCH_CLIENT_ID,
      client_secret: config.TWITCH_CLIENT_SECRET,
      grant_type: "client_credentials",
    });
    const response = await fetch(`${OAUTH}/token`, { method: "POST", body, cache: "no-store" });
    if (!response.ok) throw new TwitchApiError("Unable to authenticate SCU with Twitch.", response.status);
    const token = await response.json() as TwitchTokenResponse;
    appToken = { value: token.access_token, expiresAt: Date.now() + token.expires_in * 1000 };
    return token.access_token;
  })();
  appTokenRequest = request;
  try {
    return await request;
  } finally {
    appTokenRequest = undefined;
  }
}

function rateLimitFrom(response: Response) {
  const number = (name: string) => {
    const value = response.headers.get(name);
    return value ? Number(value) : undefined;
  };
  return {
    limit: number("Ratelimit-Limit"),
    remaining: number("Ratelimit-Remaining"),
    reset: number("Ratelimit-Reset"),
  };
}

async function helix<T>(
  path: string,
  options: { userToken?: string; retry?: boolean } = {},
): Promise<{ body: TwitchResponse<T>; response: Response }> {
  const config = getTwitchConfig();
  const token = options.userToken || await requestAppToken();
  const response = await fetch(`${HELIX}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Client-Id": config.TWITCH_CLIENT_ID,
    },
    cache: "no-store",
  });

  if (response.status === 401 && !options.userToken && options.retry !== false) {
    await requestAppToken(true);
    return helix<T>(path, { retry: false });
  }
  if (response.status === 503 && options.retry !== false) {
    return helix<T>(path, { ...options, retry: false });
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { message?: string } | null;
    const reset = response.headers.get("Ratelimit-Reset");
    throw new TwitchApiError(
      payload?.message || `Twitch request failed with ${response.status}.`,
      response.status,
      reset ? Number(reset) : undefined,
    );
  }
  return { body: await response.json() as TwitchResponse<T>, response };
}

const thumbnail = (url: string, width = 640, height = 360) =>
  url.replace("{width}", String(width)).replace("{height}", String(height));

function mapChannel(user: TwitchUserDto): ScuChannel {
  return {
    id: user.id,
    login: user.login,
    displayName: user.display_name,
    description: user.description,
    profileImageUrl: user.profile_image_url,
    offlineImageUrl: user.offline_image_url,
    channelUrl: `https://twitch.tv/${user.login}`,
  };
}

async function getUsersByLogins(logins: string[]) {
  if (!logins.length) return new Map<string, ScuChannel>();
  const unique = [...new Set(logins.map((login) => login.toLowerCase()))].slice(0, 100);
  const params = new URLSearchParams();
  unique.forEach((login) => params.append("login", login));
  const { body } = await helix<TwitchUserDto>(`/users?${params}`);
  return new Map(body.data.map((user) => [user.login.toLowerCase(), mapChannel(user)]));
}

/** Helix /streams omits profile images, so fetch them by broadcaster id (batched, up to 100). */
async function getUserProfilesByIds(ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))].slice(0, 100);
  if (!unique.length) return new Map<string, { profileImageUrl: string; description: string; offlineImageUrl: string }>();
  const params = new URLSearchParams();
  unique.forEach((id) => params.append("id", id));
  try {
    const { body } = await helix<TwitchUserDto>(`/users?${params}`);
    return new Map(body.data.map((user) => [user.id, {
      profileImageUrl: user.profile_image_url,
      description: user.description,
      offlineImageUrl: user.offline_image_url,
    }]));
  } catch {
    // Avatars are non-critical — fall back to initials rather than failing the whole stream list.
    return new Map<string, { profileImageUrl: string; description: string; offlineImageUrl: string }>();
  }
}

function mapClip(clip: TwitchClipDto, login?: string): ScuClip {
  return {
    id: clip.id,
    url: clip.url,
    embedUrl: clip.embed_url,
    title: clip.title,
    viewCount: clip.view_count,
    createdAt: clip.created_at,
    thumbnailUrl: clip.thumbnail_url,
    duration: clip.duration,
    broadcasterId: clip.broadcaster_id,
    broadcasterName: clip.broadcaster_name,
    broadcasterLogin: login,
    creatorName: clip.creator_name,
    gameId: clip.game_id,
    language: clip.language,
    isFeatured: clip.is_featured,
  };
}

export async function getClips(input: {
  broadcasterId?: string;
  gameId?: string;
  first?: number;
  after?: string;
  startedAt?: string;
  endedAt?: string;
} = {}): Promise<PaginatedResult<ScuClip>> {
  if (!input.broadcasterId && !input.gameId) {
    throw new TwitchApiError("Clips require a broadcaster or game.", 400);
  }
  const params = new URLSearchParams({ first: String(Math.min(Math.max(input.first || 12, 1), 100)) });
  if (input.broadcasterId) params.set("broadcaster_id", input.broadcasterId);
  if (input.gameId) params.set("game_id", input.gameId);
  if (input.after) params.set("after", input.after);
  if (input.startedAt) params.set("started_at", input.startedAt);
  if (input.endedAt) params.set("ended_at", input.endedAt);
  const { body, response } = await helix<TwitchClipDto>(`/clips?${params}`);
  return {
    data: body.data.map((clip) => mapClip(clip)),
    cursor: body.pagination?.cursor,
    rateLimit: rateLimitFrom(response),
  };
}

export async function getClipsForLogins(input: {
  logins: string[];
  firstPerChannel?: number;
  limit?: number;
  days?: number;
}): Promise<PaginatedResult<ScuClip>> {
  const days = Math.min(Math.max(input.days || 7, 1), 30);
  const startedAt = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const users = await getUsersByLogins(input.logins);
  const perChannel = Math.min(Math.max(input.firstPerChannel || 4, 1), 20);
  const limit = Math.min(Math.max(input.limit || 12, 1), 40);
  const batches = await Promise.all([...users.values()].map(async (channel) => {
    try {
      const result = await getClips({ broadcasterId: channel.id, first: perChannel, startedAt });
      return result.data.map((clip) => ({ ...clip, broadcasterLogin: channel.login }));
    } catch {
      return [] as ScuClip[];
    }
  }));
  const merged = batches.flat().sort((a, b) => b.viewCount - a.viewCount).slice(0, limit);
  return { data: merged };
}

export async function getFeaturedClips(input: { first?: number; days?: number } = {}): Promise<PaginatedResult<ScuClip>> {
  const limit = Math.min(Math.max(input.first || 12, 1), 24);
  const days = Math.min(Math.max(input.days || 7, 1), 30);
  const startedAt = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const live = await getLiveStreams({ first: 8 });
  const channels = live.data.slice(0, 5).map((stream) => stream.channel);
  const batches = await Promise.all(channels.map(async (channel) => {
    try {
      const result = await getClips({ broadcasterId: channel.id, first: 2, startedAt });
      return result.data.map((clip) => ({ ...clip, broadcasterLogin: channel.login }));
    } catch {
      return [] as ScuClip[];
    }
  }));
  const merged = batches.flat().sort((a, b) => b.viewCount - a.viewCount).slice(0, limit);
  return { data: merged, rateLimit: live.rateLimit };
}

async function normalizeStreams(
  streams: TwitchStreamDto[],
): Promise<ScuLiveStream[]> {
  // Enrich with profile images — Helix /streams doesn't include them, so avatars would otherwise be blank.
  const profiles = await getUserProfilesByIds(streams.map((stream) => stream.user_id));
  return streams.map((stream) => ({
    id: stream.id,
    channel: {
      id: stream.user_id,
      login: stream.user_login,
      displayName: stream.user_name,
      description: profiles.get(stream.user_id)?.description || "",
      profileImageUrl: profiles.get(stream.user_id)?.profileImageUrl || "",
      offlineImageUrl: profiles.get(stream.user_id)?.offlineImageUrl || "",
      channelUrl: `https://twitch.tv/${stream.user_login}`,
    },
    title: stream.title,
    gameId: stream.game_id,
    gameName: stream.game_name,
    viewerCount: stream.viewer_count,
    startedAt: stream.started_at,
    language: stream.language,
    thumbnailUrl: thumbnail(stream.thumbnail_url),
    isMature: stream.is_mature,
    tags: stream.tags || [],
    platform: "Twitch" as const,
  }));
}

export async function getLiveStreams(input: {
  first?: number;
  after?: string;
  gameId?: string;
  userLogins?: string[];
  language?: string;
} = {}): Promise<PaginatedResult<ScuLiveStream>> {
  const params = new URLSearchParams({ first: String(Math.min(Math.max(input.first || 24, 1), 100)) });
  if (input.after) params.set("after", input.after);
  if (input.gameId) params.append("game_id", input.gameId);
  if (input.language) params.append("language", input.language);
  input.userLogins?.slice(0, 100).forEach((login) => params.append("user_login", login));
  const { body, response } = await helix<TwitchStreamDto>(`/streams?${params}`);
  return {
    data: await normalizeStreams(body.data),
    cursor: body.pagination?.cursor,
    rateLimit: rateLimitFrom(response),
  };
}

export async function getFollowedStreams(userId: string, userToken: string, after?: string) {
  const params = new URLSearchParams({ user_id: userId, first: "100" });
  if (after) params.set("after", after);
  const { body, response } = await helix<TwitchStreamDto>(`/streams/followed?${params}`, { userToken });
  return {
    data: await normalizeStreams(body.data),
    cursor: body.pagination?.cursor,
    rateLimit: rateLimitFrom(response),
  } satisfies PaginatedResult<ScuLiveStream>;
}

export async function searchChannels(query: string, first = 20) {
  const params = new URLSearchParams({ query, first: String(Math.min(Math.max(first, 1), 100)), live_only: "false" });
  const { body, response } = await helix<TwitchChannelSearchDto>(`/search/channels?${params}`);
  return {
    data: body.data.map((channel) => ({
      id: channel.id,
      login: channel.broadcaster_login,
      displayName: channel.display_name,
      description: channel.title,
      profileImageUrl: channel.thumbnail_url,
      offlineImageUrl: channel.thumbnail_url,
      channelUrl: `https://twitch.tv/${channel.broadcaster_login}`,
      isLive: channel.is_live,
      gameId: channel.game_id,
      gameName: channel.game_name,
      startedAt: channel.started_at,
    })),
    cursor: body.pagination?.cursor,
    rateLimit: rateLimitFrom(response),
  };
}

export async function getChannel(login: string) {
  const users = await helix<TwitchUserDto>(`/users?login=${encodeURIComponent(login)}`);
  const user = users.body.data[0];
  if (!user) return null;
  const info = await helix<TwitchChannelInfoDto>(`/channels?broadcaster_id=${encodeURIComponent(user.id)}`);
  const channel = info.body.data[0];
  const live = (await getLiveStreams({ userLogins: [user.login], first: 1 })).data[0] || null;
  return {
    channel: mapChannel(user),
    title: channel?.title || "",
    gameId: channel?.game_id || "",
    gameName: channel?.game_name || "",
    language: channel?.broadcaster_language || "",
    tags: channel?.tags || [],
    live,
  };
}

export async function getTopCategories(first = 20): Promise<PaginatedResult<ScuCategory>> {
  const { body, response } = await helix<TwitchGameDto>(`/games/top?first=${Math.min(Math.max(first, 1), 100)}`);
  return {
    data: body.data.map((game) => ({ id: game.id, name: game.name, imageUrl: thumbnail(game.box_art_url, 285, 380) })),
    cursor: body.pagination?.cursor,
    rateLimit: rateLimitFrom(response),
  };
}

export async function validateUserToken(token: string) {
  const response = await fetch(`${OAUTH}/validate`, {
    headers: { Authorization: `OAuth ${token}` },
    cache: "no-store",
  });
  if (!response.ok) throw new TwitchApiError("Twitch authorization is no longer valid.", response.status);
  return response.json() as Promise<TwitchTokenValidation>;
}

export async function exchangeAuthorizationCode(code: string) {
  const config = getTwitchConfig();
  const body = new URLSearchParams({
    client_id: config.TWITCH_CLIENT_ID,
    client_secret: config.TWITCH_CLIENT_SECRET,
    code,
    grant_type: "authorization_code",
    redirect_uri: config.TWITCH_REDIRECT_URI,
  });
  const response = await fetch(`${OAUTH}/token`, { method: "POST", body, cache: "no-store" });
  if (!response.ok) throw new TwitchApiError("Unable to complete Twitch authorization.", response.status);
  return response.json() as Promise<TwitchTokenResponse>;
}

export async function refreshUserToken(refreshToken: string) {
  const config = getTwitchConfig();
  const body = new URLSearchParams({
    client_id: config.TWITCH_CLIENT_ID,
    client_secret: config.TWITCH_CLIENT_SECRET,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const response = await fetch(`${OAUTH}/token`, { method: "POST", body, cache: "no-store" });
  if (!response.ok) throw new TwitchApiError("Unable to refresh Twitch authorization.", response.status);
  return response.json() as Promise<TwitchTokenResponse>;
}
