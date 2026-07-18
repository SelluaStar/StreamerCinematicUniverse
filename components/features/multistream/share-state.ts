import type { ChatPlacement, LayoutTemplate } from "./use-workspace";

export interface SharedWorkspace {
  logins: string[];
  layout: LayoutTemplate;
  /** @deprecated Prefer chats; kept for older share links. */
  chat?: string;
  chats: string[];
  /** Present only when the share URL includes chatPlace. */
  chatPlacement?: ChatPlacement;
}

function normalizeChatPlacement(value?: string): ChatPlacement {
  return value === "between" ? "between" : "side";
}

export function parseTwitchLogin(value: string) {
  const login = value.trim().replace(/^https?:\/\/(www\.)?twitch\.tv\//i, "").split(/[/?#]/)[0].toLowerCase();
  return /^[a-z0-9_]{2,25}$/.test(login) ? login : null;
}

export function parseSharedWorkspace(search: string, limit = 6): SharedWorkspace {
  const params = new URLSearchParams(search);
  const logins = [...new Set((params.get("streams") || "").split(",").map(parseTwitchLogin).filter((login): login is string => Boolean(login)))].slice(0, Math.min(Math.max(limit, 1), 6));
  const requestedLayout = params.get("layout");
  const layout: LayoutTemplate = requestedLayout === "equal" || requestedLayout === "focus" ? requestedLayout : "auto";
  const fromChats = (params.get("chats") || "").split(",").map(parseTwitchLogin).filter((login): login is string => Boolean(login));
  const fromChat = params.get("chat") ? parseTwitchLogin(params.get("chat")!) : null;
  const chats = [...new Set(fromChats.length ? fromChats : fromChat ? [fromChat] : [])].filter((login) => logins.includes(login));
  const rawPlace = params.get("chatPlace");
  const chatPlacement = rawPlace ? normalizeChatPlacement(rawPlace) : undefined;
  return { logins, layout, chats, chat: chats[0], chatPlacement };
}

export function serializeSharedWorkspace(value: SharedWorkspace) {
  const params = new URLSearchParams({
    streams: value.logins.slice(0, 6).join(","),
    layout: value.layout,
  });
  const chats = (value.chats?.length ? value.chats : value.chat ? [value.chat] : [])
    .filter((login) => value.logins.includes(login));
  if (chats.length) {
    params.set("chats", chats.join(","));
    params.set("chat", chats[0]);
  }
  if (value.chatPlacement === "between") params.set("chatPlace", "between");
  return params.toString();
}
