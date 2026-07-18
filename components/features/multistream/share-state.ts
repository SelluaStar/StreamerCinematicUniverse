import type { ChatPlacement, LayoutTemplate } from "./use-workspace";

export interface SharedWorkspace {
  logins: string[];
  layout: LayoutTemplate;
  /** @deprecated Prefer chats; kept for older share links. */
  chat?: string;
  /** Flattened chat logins (compat). */
  chats: string[];
  /** Panel stacks — each inner array is one chat panel's logins. */
  chatPanels?: string[][];
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

function parseChatPanelsParam(raw: string | null, fallbackChats: string[]): string[][] {
  if (!raw) return fallbackChats.length ? [fallbackChats] : [];
  const panels = raw
    .split("|")
    .map((group) => [...new Set(group.split(",").map(parseTwitchLogin).filter((login): login is string => Boolean(login)))])
    .filter((group) => group.length);
  return panels.length ? panels : (fallbackChats.length ? [fallbackChats] : []);
}

export function parseSharedWorkspace(search: string, limit = 6): SharedWorkspace {
  const params = new URLSearchParams(search);
  const logins = [...new Set((params.get("streams") || "").split(",").map(parseTwitchLogin).filter((login): login is string => Boolean(login)))].slice(0, Math.min(Math.max(limit, 1), 6));
  const requestedLayout = params.get("layout");
  const layout: LayoutTemplate = requestedLayout === "equal" || requestedLayout === "focus" ? requestedLayout : "auto";
  const fromChats = (params.get("chats") || "").split(",").map(parseTwitchLogin).filter((login): login is string => Boolean(login));
  const fromChat = params.get("chat") ? parseTwitchLogin(params.get("chat")!) : null;
  const chats = [...new Set(fromChats.length ? fromChats : fromChat ? [fromChat] : [])].filter((login) => logins.includes(login));
  const chatPanels = parseChatPanelsParam(params.get("chatPanels"), chats)
    .map((panel) => panel.filter((login) => logins.includes(login)))
    .filter((panel) => panel.length);
  const rawPlace = params.get("chatPlace");
  const chatPlacement = rawPlace ? normalizeChatPlacement(rawPlace) : undefined;
  return {
    logins,
    layout,
    chats: chatPanels.length ? chatPanels.flat() : chats,
    chat: (chatPanels[0] || chats)[0],
    chatPanels: chatPanels.length ? chatPanels : undefined,
    chatPlacement,
  };
}

export function serializeSharedWorkspace(value: SharedWorkspace) {
  const params = new URLSearchParams({
    streams: value.logins.slice(0, 6).join(","),
    layout: value.layout,
  });
  const panels = (value.chatPanels?.length
    ? value.chatPanels
    : (value.chats?.length ? [value.chats] : value.chat ? [[value.chat]] : []))
    .map((panel) => panel.filter((login) => value.logins.includes(login)))
    .filter((panel) => panel.length);
  const chats = panels.flat();
  if (chats.length) {
    params.set("chats", chats.join(","));
    params.set("chat", chats[0]);
  }
  // Multi-panel layouts need an explicit boundary marker; single-panel stays on chats=.
  if (panels.length > 1) {
    params.set("chatPanels", panels.map((panel) => panel.join(",")).join("|"));
  }
  if (value.chatPlacement === "between") params.set("chatPlace", "between");
  return params.toString();
}
