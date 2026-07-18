"use client";

import { useEffect, useMemo, useReducer } from "react";
import type { Layout } from "react-resizable-panels";
import type { Streamer } from "@/lib/data";

export type LayoutTemplate = "auto" | "equal" | "focus";
export type ChatPlacement = "side" | "between";

export type LayoutNode =
  | { type: "pane"; id: string; streamId: string }
  | { type: "split"; id: string; orientation: "horizontal" | "vertical"; first: LayoutNode; second: LayoutNode };

export interface WorkspaceState {
  streams: Streamer[];
  template: LayoutTemplate;
  focusedId?: string;
  muted: Record<string, boolean>;
  paused: Record<string, boolean>;
  volume: Record<string, number>;
  captions: Record<string, boolean>;
  drawerOpen: boolean;
  chatVisible: boolean;
  /** Ordered open Twitch chat panes (stream ids). */
  chatStreamIds: string[];
  /** For two streams: chat on the outer side column, or stacked between the two panes. */
  chatPlacement: ChatPlacement;
  /** True once the user (or a saved/share payload) chose a placement — blocks compact auto-default. */
  chatPlacementExplicit: boolean;
  layouts: Record<string, Layout>;
  /** Preferred orientation of the root split, updated by drop position when reorganizing. */
  rootOrientation?: "horizontal" | "vertical";
}

type Action =
  | { type: "hydrate"; state: Partial<WorkspaceState> & { chatStreamId?: string } }
  | { type: "load"; streams: Streamer[]; template: LayoutTemplate; chatStreamIds?: string[]; chatStreamId?: string; chatPlacement?: ChatPlacement; rootOrientation?: "horizontal" | "vertical" }
  | { type: "add"; stream: Streamer; captions?: boolean }
  | { type: "remove"; id: string }
  | { type: "reorder"; activeId: string; overId: string; orientation?: "horizontal" | "vertical" }
  | { type: "template"; template: LayoutTemplate }
  | { type: "focus"; id?: string }
  | { type: "muted"; id: string; value: boolean }
  | { type: "paused"; id: string; value: boolean }
  | { type: "volume"; id: string; value: number }
  | { type: "captions"; id: string; value: boolean }
  | { type: "muteAll"; value: boolean }
  | { type: "pauseAll"; value: boolean }
  | { type: "drawer"; value: boolean }
  | { type: "chat"; visible: boolean }
  | { type: "chatPlacement"; placement: ChatPlacement; explicit?: boolean }
  | { type: "addChat"; id: string }
  | { type: "removeChat"; id: string }
  | { type: "reorderChats"; activeId: string; overId: string }
  | { type: "layout"; id: string; layout: Layout }
  | { type: "resetLayouts" };

export function normalizeChatPlacement(value?: string): ChatPlacement {
  return value === "between" ? "between" : "side";
}

/** True when chat should sit between the two stream panes. */
export function canPlaceChatBetween(streams: Streamer[], template: LayoutTemplate) {
  return streams.length === 2 && template !== "focus";
}

const STORAGE_KEY = "scu-multistream-workspace-v2";

function firstTwitchId(streams: Streamer[]) {
  return streams.find((stream) => stream.platform === "Twitch")?.id;
}

/** Prefer chatStreamIds; fall back to legacy singular chatStreamId. */
export function normalizeChatStreamIds(
  streams: Streamer[],
  chatStreamIds?: string[],
  chatStreamId?: string,
): string[] {
  const twitchIds = new Set(streams.filter((stream) => stream.platform === "Twitch").map((stream) => stream.id));
  const raw = chatStreamIds?.length
    ? chatStreamIds
    : chatStreamId
      ? [chatStreamId]
      : [];
  const seen = new Set<string>();
  const next: string[] = [];
  for (const id of raw) {
    if (!twitchIds.has(id) || seen.has(id)) continue;
    seen.add(id);
    next.push(id);
  }
  return next;
}

function initialState(initialStreams: Streamer[]): WorkspaceState {
  const seedChat = firstTwitchId(initialStreams);
  return {
    streams: initialStreams,
    template: "auto",
    muted: Object.fromEntries(initialStreams.map((stream, index) => [stream.id, index > 0])),
    paused: {},
    volume: Object.fromEntries(initialStreams.map((stream) => [stream.id, 0.7])),
    captions: {},
    drawerOpen: true,
    chatVisible: Boolean(seedChat),
    chatStreamIds: seedChat ? [seedChat] : [],
    chatPlacement: "side",
    chatPlacementExplicit: false,
    layouts: {},
  };
}

function reducer(state: WorkspaceState, action: Action): WorkspaceState {
  switch (action.type) {
    case "hydrate": {
      const streams = action.state.streams?.length ? action.state.streams : state.streams;
      const chatStreamIds = normalizeChatStreamIds(
        streams,
        action.state.chatStreamIds,
        action.state.chatStreamId,
      );
      const { chatStreamId: _legacy, ...rest } = action.state;
      const hadPlacement = rest.chatPlacement !== undefined;
      return {
        ...state,
        ...rest,
        streams,
        chatStreamIds,
        chatPlacement: hadPlacement ? normalizeChatPlacement(rest.chatPlacement) : state.chatPlacement,
        chatPlacementExplicit: hadPlacement || Boolean(rest.chatPlacementExplicit) || state.chatPlacementExplicit,
        chatVisible: rest.chatVisible === undefined
          ? Boolean(chatStreamIds.length)
          : Boolean(rest.chatVisible) && Boolean(chatStreamIds.length),
      };
    }
    case "load": {
      const streams = action.streams;
      const chatStreamIds = normalizeChatStreamIds(streams, action.chatStreamIds, action.chatStreamId);
      const hadPlacement = action.chatPlacement !== undefined;
      return {
        streams,
        template: action.template,
        focusedId: action.template === "focus" ? streams[0]?.id : undefined,
        muted: Object.fromEntries(streams.map((stream, index) => [stream.id, index > 0])),
        paused: {},
        volume: Object.fromEntries(streams.map((stream) => [stream.id, 0.7])),
        captions: {},
        drawerOpen: state.drawerOpen,
        chatVisible: Boolean(chatStreamIds.length),
        chatStreamIds,
        chatPlacement: hadPlacement ? normalizeChatPlacement(action.chatPlacement) : state.chatPlacement,
        chatPlacementExplicit: hadPlacement || state.chatPlacementExplicit,
        layouts: {},
        rootOrientation: action.rootOrientation ?? state.rootOrientation,
      };
    }
    case "add": {
      if (state.streams.some((stream) => stream.id === action.stream.id)) return state;
      const streams = [...state.streams, action.stream];
      const chatStreamIds = state.chatStreamIds.length
        ? state.chatStreamIds
        : action.stream.platform === "Twitch"
          ? [action.stream.id]
          : [];
      return {
        ...state,
        streams,
        muted: { ...state.muted, [action.stream.id]: true },
        paused: { ...state.paused, [action.stream.id]: false },
        volume: { ...state.volume, [action.stream.id]: 0.7 },
        captions: { ...state.captions, [action.stream.id]: Boolean(action.captions) },
        chatStreamIds,
        chatVisible: state.chatVisible || Boolean(chatStreamIds.length),
      };
    }
    case "remove": {
      const streams = state.streams.filter((stream) => stream.id !== action.id);
      const muted = { ...state.muted };
      const paused = { ...state.paused };
      const volume = { ...state.volume };
      const captions = { ...state.captions };
      delete muted[action.id];
      delete paused[action.id];
      delete volume[action.id];
      delete captions[action.id];
      let chatStreamIds = state.chatStreamIds.filter((id) => id !== action.id);
      if (!chatStreamIds.length) {
        const fallback = firstTwitchId(streams);
        if (fallback) chatStreamIds = [fallback];
      }
      return {
        ...state,
        streams,
        muted,
        paused,
        volume,
        captions,
        // Drop saved split sizes — count/topology changed and stale keys remount panels incorrectly.
        layouts: {},
        focusedId: state.focusedId === action.id ? streams[0]?.id : state.focusedId,
        chatStreamIds,
        chatVisible: Boolean(chatStreamIds.length) && state.chatVisible,
      };
    }
    case "reorder": {
      const from = state.streams.findIndex((stream) => stream.id === action.activeId);
      const to = state.streams.findIndex((stream) => stream.id === action.overId);
      const orientationChanged = Boolean(action.orientation) && action.orientation !== (state.rootOrientation || "horizontal");
      if (from < 0 || to < 0 || (from === to && !orientationChanged)) {
        return orientationChanged ? { ...state, rootOrientation: action.orientation, layouts: {} } : state;
      }
      const streams = [...state.streams];
      const [moved] = streams.splice(from, 1);
      streams.splice(to, 0, moved);
      return {
        ...state,
        streams,
        rootOrientation: action.orientation || state.rootOrientation,
        // Topology/orientation changed — stale split sizes would remount panels incorrectly.
        layouts: orientationChanged ? {} : state.layouts,
      };
    }
    case "template": return { ...state, template: action.template, focusedId: action.template === "focus" ? state.focusedId || state.streams[0]?.id : state.focusedId };
    case "focus": return { ...state, focusedId: action.id, template: action.id ? "focus" : state.template === "focus" ? "auto" : state.template };
    case "muted":
      if (state.muted[action.id] === action.value) return state;
      return { ...state, muted: { ...state.muted, [action.id]: action.value } };
    case "paused":
      if (state.paused[action.id] === action.value) return state;
      return { ...state, paused: { ...state.paused, [action.id]: action.value } };
    case "volume":
      if (state.volume[action.id] === action.value) return state;
      return { ...state, volume: { ...state.volume, [action.id]: action.value } };
    case "captions":
      if (state.captions[action.id] === action.value) return state;
      return { ...state, captions: { ...state.captions, [action.id]: action.value } };
    case "muteAll": return { ...state, muted: Object.fromEntries(state.streams.map((stream) => [stream.id, action.value])) };
    case "pauseAll": return { ...state, paused: Object.fromEntries(state.streams.map((stream) => [stream.id, action.value])) };
    case "drawer": return { ...state, drawerOpen: action.value };
    case "chat": {
      if (!action.visible) return { ...state, chatVisible: false };
      if (state.chatStreamIds.length) return { ...state, chatVisible: true };
      const seed = firstTwitchId(state.streams);
      if (!seed) return { ...state, chatVisible: false };
      return { ...state, chatVisible: true, chatStreamIds: [seed] };
    }
    case "chatPlacement":
      return {
        ...state,
        chatPlacement: action.placement,
        chatPlacementExplicit: action.explicit === false ? state.chatPlacementExplicit : true,
      };
    case "addChat": {
      if (state.chatStreamIds.includes(action.id)) return { ...state, chatVisible: true };
      const stream = state.streams.find((item) => item.id === action.id);
      if (!stream || stream.platform !== "Twitch") return state;
      return {
        ...state,
        chatVisible: true,
        chatStreamIds: [...state.chatStreamIds, action.id],
      };
    }
    case "removeChat": {
      const chatStreamIds = state.chatStreamIds.filter((id) => id !== action.id);
      return {
        ...state,
        chatStreamIds,
        chatVisible: Boolean(chatStreamIds.length) && state.chatVisible,
      };
    }
    case "reorderChats": {
      const from = state.chatStreamIds.indexOf(action.activeId);
      const to = state.chatStreamIds.indexOf(action.overId);
      if (from < 0 || to < 0 || from === to) return state;
      const chatStreamIds = [...state.chatStreamIds];
      const [moved] = chatStreamIds.splice(from, 1);
      chatStreamIds.splice(to, 0, moved);
      return { ...state, chatStreamIds };
    }
    case "layout": return { ...state, layouts: { ...state.layouts, [action.id]: action.layout } };
    case "resetLayouts": return { ...state, layouts: {} };
    default: return state;
  }
}

const pane = (streamId: string): LayoutNode => ({ type: "pane", id: `pane-${streamId}`, streamId });
const split = (id: string, orientation: "horizontal" | "vertical", first: LayoutNode, second: LayoutNode): LayoutNode =>
  ({ type: "split", id, orientation, first, second });

/** Stable split ids from membership (sorted) so reordering does not remount the shell. */
function splitKey(orientation: "horizontal" | "vertical", ids: string[]) {
  return `split-${orientation}-${[...ids].sort().join("~")}`;
}

export function buildLayoutTree(
  streamIds: string[],
  template: LayoutTemplate,
  focusedId?: string,
  rootOrientation?: "horizontal" | "vertical",
): LayoutNode | null {
  if (!streamIds.length) return null;
  if (template === "focus") return pane(focusedId && streamIds.includes(focusedId) ? focusedId : streamIds[0]);
  const p = streamIds.map((id) => pane(id));
  if (p.length === 1) return p[0];

  // `primary` is the orientation the user last dropped into; `cross` is its perpendicular.
  // Flipping it transposes the whole topology so drops feel like real reorganization.
  const primary = rootOrientation || "horizontal";
  const cross = primary === "horizontal" ? "vertical" : "horizontal";

  if (p.length === 2) return split(splitKey(primary, streamIds), primary, p[0], p[1]);
  if (p.length === 3) {
    return split(
      splitKey(primary, streamIds),
      primary,
      p[0],
      split(splitKey(cross, streamIds.slice(1)), cross, p[1], p[2]),
    );
  }
  if (p.length === 4) {
    return split(
      splitKey(cross, streamIds),
      cross,
      split(splitKey(primary, streamIds.slice(0, 2)), primary, p[0], p[1]),
      split(splitKey(primary, streamIds.slice(2)), primary, p[2], p[3]),
    );
  }
  if (p.length === 5) {
    return split(
      splitKey(primary, streamIds),
      primary,
      p[0],
      split(
        splitKey(cross, streamIds.slice(1)),
        cross,
        split(splitKey(primary, streamIds.slice(1, 3)), primary, p[1], p[2]),
        split(splitKey(primary, streamIds.slice(3)), primary, p[3], p[4]),
      ),
    );
  }
  return split(
    splitKey(cross, streamIds),
    cross,
    split(
      splitKey(primary, streamIds.slice(0, 3)),
      primary,
      p[0],
      split(splitKey(primary, streamIds.slice(1, 3)), primary, p[1], p[2]),
    ),
    split(
      splitKey(primary, streamIds.slice(3)),
      primary,
      p[3],
      split(splitKey(primary, streamIds.slice(4)), primary, p[4], p[5]),
    ),
  );
}

export function useWorkspace(initialStreams: Streamer[]) {
  const [state, dispatch] = useReducer(reducer, initialStreams, initialState);
  useEffect(() => {
    // URL-driven workspaces own the first paint — don't fight them with the last local session.
    const params = new URLSearchParams(window.location.search);
    if (params.get("streams") || params.get("load")) return;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const saved = JSON.parse(raw) as Partial<WorkspaceState> & { chatStreamId?: string };
      queueMicrotask(() => dispatch({ type: "hydrate", state: saved }));
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);
  const tree = useMemo(
    () => buildLayoutTree(state.streams.map((stream) => stream.id), state.template, state.focusedId, state.rootOrientation),
    [state.focusedId, state.streams, state.template, state.rootOrientation],
  );
  return { state, dispatch, tree };
}
