export interface TwitchPagination {
  cursor?: string;
}

export interface TwitchResponse<T> {
  data: T[];
  pagination?: TwitchPagination;
}

export interface TwitchStreamDto {
  id: string;
  user_id: string;
  user_login: string;
  user_name: string;
  game_id: string;
  game_name: string;
  type: string;
  title: string;
  tags?: string[];
  viewer_count: number;
  started_at: string;
  language: string;
  thumbnail_url: string;
  is_mature: boolean;
}

export interface TwitchUserDto {
  id: string;
  login: string;
  display_name: string;
  type: string;
  broadcaster_type: string;
  description: string;
  profile_image_url: string;
  offline_image_url: string;
  view_count: number;
  created_at: string;
}

export interface TwitchGameDto {
  id: string;
  name: string;
  box_art_url: string;
  igdb_id?: string;
}

export interface TwitchChannelSearchDto {
  broadcaster_language: string;
  broadcaster_login: string;
  display_name: string;
  game_id: string;
  game_name: string;
  id: string;
  is_live: boolean;
  tags?: string[];
  thumbnail_url: string;
  title: string;
  started_at: string;
}

export interface TwitchChannelInfoDto {
  broadcaster_id: string;
  broadcaster_login: string;
  broadcaster_name: string;
  broadcaster_language: string;
  game_id: string;
  game_name: string;
  title: string;
  delay: number;
  tags?: string[];
  content_classification_labels?: string[];
  is_branded_content: boolean;
}

export interface TwitchTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string[];
  token_type: "bearer";
}

export interface TwitchTokenValidation {
  client_id: string;
  login: string;
  scopes: string[];
  user_id: string;
  expires_in: number;
}

export interface TwitchSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  userId: string;
  login: string;
  scopes: string[];
}

export interface ScuChannel {
  id: string;
  login: string;
  displayName: string;
  description: string;
  profileImageUrl: string;
  offlineImageUrl: string;
  channelUrl: string;
}

export interface ScuLiveStream {
  id: string;
  channel: ScuChannel;
  title: string;
  gameId: string;
  gameName: string;
  viewerCount: number;
  startedAt: string;
  language: string;
  thumbnailUrl: string;
  isMature: boolean;
  tags: string[];
  platform: "Twitch";
}

export interface TwitchClipDto {
  id: string;
  url: string;
  embed_url: string;
  broadcaster_id: string;
  broadcaster_name: string;
  creator_id: string;
  creator_name: string;
  video_id: string;
  game_id: string;
  language: string;
  title: string;
  view_count: number;
  created_at: string;
  thumbnail_url: string;
  duration: number;
  vod_offset: number | null;
  is_featured: boolean;
}

export interface ScuClip {
  id: string;
  url: string;
  embedUrl: string;
  title: string;
  viewCount: number;
  createdAt: string;
  thumbnailUrl: string;
  duration: number;
  broadcasterId: string;
  broadcasterName: string;
  broadcasterLogin?: string;
  creatorName: string;
  gameId: string;
  language: string;
  isFeatured: boolean;
}

export interface ScuCategory {
  id: string;
  name: string;
  imageUrl: string;
}

export interface PaginatedResult<T> {
  data: T[];
  cursor?: string;
  rateLimit?: {
    limit?: number;
    remaining?: number;
    reset?: number;
  };
}

export class TwitchApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly retryAt?: number,
  ) {
    super(message);
    this.name = "TwitchApiError";
  }
}
