"use client";

import { useEffect, useMemo, useReducer } from "react";
import type { Layout } from "react-resizable-panels";
import type { Streamer } from "@/lib/data";

export type LayoutTemplate = "auto" | "equal" | "focus";
export type ChatPlacement = "side" | "between";

/** One chat stack that can sit in the side dock, between two streams, or inline in the canvas. */
export interface ChatPanel {
  id: string;
  streamIds: string[];
}

export type CanvasTile =
  | { kind: "stream"; id: string }
  | { kind: "chat"; id: string };

export type LayoutNode =
  | { type: "pane"; id: string; streamId: string }
  | { type: "chat"; id: string; panelId: string }
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
  /** Source of truth for open chats — each panel is its own stack. */
  chatPanels: ChatPanel[];
  /** Panels docked in the side/sheet column (top → bottom). */
  sideChatPanelIds: string[];
  /** Panel rendered between exactly two streams (excluded from side/canvas). */
  betweenChatPanelId?: string;
  /** Canvas order: streams plus inline chat panels. */
  canvasTiles: CanvasTile[];
  /** Flattened chat stream ids (compat for share/save/shortcuts). */
  chatStreamIds: string[];
  /** UI placement for the primary between/side toggle. */
  chatPlacement: ChatPlacement;
  /** True once the user (or a saved/share payload) chose a placement — blocks compact auto-default. */
  chatPlacementExplicit: boolean;
  layouts: Record<string, Layout>;
  /** Preferred orientation of the root split, updated by drop position when reorganizing. */
  rootOrientation?: "horizontal" | "vertical";
}

type Action =
  | { type: "hydrate"; state: Partial<WorkspaceState> & { chatStreamId?: string } }
  | {
    type: "load";
    streams: Streamer[];
    template: LayoutTemplate;
    chatPanels?: ChatPanel[];
    sideChatPanelIds?: string[];
    betweenChatPanelId?: string;
    canvasTiles?: CanvasTile[];
    chatStreamIds?: string[];
    chatStreamId?: string;
    chatPlacement?: ChatPlacement;
    rootOrientation?: "horizontal" | "vertical";
  }
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
  | { type: "addChat"; id: string; panelId?: string }
  | { type: "removeChat"; id: string }
  | { type: "reorderChats"; panelId: string; activeId: string; overId: string }
  | { type: "moveChat"; streamId: string; toPanelId: string; beforeStreamId?: string }
  | {
    type: "detachChat";
    streamId: string;
    placement: "side" | "between" | "inline";
    anchorId?: string;
    orientation?: "horizontal" | "vertical";
  }
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

function newPanelId() {
  return `cp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
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

export function flattenChatStreamIds(panels: ChatPanel[]): string[] {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const panel of panels) {
    for (const id of panel.streamIds) {
      if (seen.has(id)) continue;
      seen.add(id);
      next.push(id);
    }
  }
  return next;
}

export function findChatPanelId(panels: ChatPanel[], streamId: string) {
  return panels.find((panel) => panel.streamIds.includes(streamId))?.id;
}

function normalizePanelStreamIds(streams: Streamer[], streamIds: string[]) {
  return normalizeChatStreamIds(streams, streamIds);
}

/** Migrate legacy chatStreamIds / chatPanels payloads into panel + slot state. */
export function normalizeChatLayout(
  streams: Streamer[],
  input: {
    chatPanels?: ChatPanel[];
    sideChatPanelIds?: string[];
    betweenChatPanelId?: string;
    canvasTiles?: CanvasTile[];
    chatStreamIds?: string[];
    chatStreamId?: string;
    chatPlacement?: ChatPlacement;
  },
): Pick<WorkspaceState, "chatPanels" | "sideChatPanelIds" | "betweenChatPanelId" | "canvasTiles" | "chatStreamIds" | "chatPlacement"> {
  const twitchIds = new Set(streams.filter((stream) => stream.platform === "Twitch").map((stream) => stream.id));
  let panels = (input.chatPanels || [])
    .map((panel) => ({
      id: panel.id || newPanelId(),
      streamIds: normalizePanelStreamIds(streams, panel.streamIds || []),
    }))
    .filter((panel) => panel.streamIds.length);

  if (!panels.length) {
    const ids = normalizeChatStreamIds(streams, input.chatStreamIds, input.chatStreamId);
    if (ids.length) panels = [{ id: "cp-default", streamIds: ids }];
  }

  // Dedupe stream ids across panels (first panel wins).
  const claimed = new Set<string>();
  panels = panels
    .map((panel) => {
      const streamIds = panel.streamIds.filter((id) => {
        if (!twitchIds.has(id) || claimed.has(id)) return false;
        claimed.add(id);
        return true;
      });
      return { ...panel, streamIds };
    })
    .filter((panel) => panel.streamIds.length);

  const panelIds = new Set(panels.map((panel) => panel.id));
  let betweenChatPanelId = input.betweenChatPanelId && panelIds.has(input.betweenChatPanelId)
    ? input.betweenChatPanelId
    : undefined;
  const placement = normalizeChatPlacement(input.chatPlacement);
  if (!betweenChatPanelId && placement === "between" && panels[0] && canPlaceChatBetween(streams, "auto")) {
    betweenChatPanelId = panels[0].id;
  }

  let sideChatPanelIds = (input.sideChatPanelIds || []).filter((id) => panelIds.has(id) && id !== betweenChatPanelId);
  for (const panel of panels) {
    if (panel.id === betweenChatPanelId) continue;
    const inline = (input.canvasTiles || []).some((tile) => tile.kind === "chat" && tile.id === panel.id);
    if (!inline && !sideChatPanelIds.includes(panel.id)) sideChatPanelIds.push(panel.id);
  }
  // Legacy: if placement is between, don't also keep that panel on the side.
  if (betweenChatPanelId) {
    sideChatPanelIds = sideChatPanelIds.filter((id) => id !== betweenChatPanelId);
  }

  const canvasTiles = normalizeCanvasTiles(
    streams,
    panels,
    sideChatPanelIds,
    betweenChatPanelId,
    input.canvasTiles,
  );

  return {
    chatPanels: panels,
    sideChatPanelIds,
    betweenChatPanelId,
    canvasTiles,
    chatStreamIds: flattenChatStreamIds(panels),
    chatPlacement: betweenChatPanelId ? "between" : "side",
  };
}

export function normalizeCanvasTiles(
  streams: Streamer[],
  panels: ChatPanel[],
  sideChatPanelIds: string[],
  betweenChatPanelId: string | undefined,
  tiles?: CanvasTile[],
): CanvasTile[] {
  const streamIds = new Set(streams.map((stream) => stream.id));
  const inlinePanelIds = new Set(
    panels
      .map((panel) => panel.id)
      .filter((id) => id !== betweenChatPanelId && !sideChatPanelIds.includes(id)),
  );
  const usedStreams = new Set<string>();
  const usedChats = new Set<string>();
  const next: CanvasTile[] = [];

  for (const tile of tiles || []) {
    if (tile.kind === "stream") {
      if (!streamIds.has(tile.id) || usedStreams.has(tile.id)) continue;
      usedStreams.add(tile.id);
      next.push(tile);
      continue;
    }
    if (!inlinePanelIds.has(tile.id) || usedChats.has(tile.id)) continue;
    usedChats.add(tile.id);
    next.push(tile);
  }

  for (const stream of streams) {
    if (usedStreams.has(stream.id)) continue;
    next.push({ kind: "stream", id: stream.id });
  }
  for (const id of inlinePanelIds) {
    if (usedChats.has(id)) continue;
    next.push({ kind: "chat", id });
  }
  return next;
}

function withChatDerived(state: WorkspaceState, patch: Partial<WorkspaceState>): WorkspaceState {
  const chatPanels = patch.chatPanels ?? state.chatPanels;
  const sideChatPanelIds = patch.sideChatPanelIds ?? state.sideChatPanelIds;
  const betweenChatPanelId = patch.betweenChatPanelId !== undefined
    ? patch.betweenChatPanelId
    : state.betweenChatPanelId;
  const streams = patch.streams ?? state.streams;
  const canvasTiles = normalizeCanvasTiles(
    streams,
    chatPanels,
    sideChatPanelIds,
    betweenChatPanelId,
    patch.canvasTiles ?? state.canvasTiles,
  );
  const hasChats = Boolean(flattenChatStreamIds(chatPanels).length);
  return {
    ...state,
    ...patch,
    streams,
    chatPanels,
    sideChatPanelIds,
    betweenChatPanelId,
    canvasTiles,
    chatStreamIds: flattenChatStreamIds(chatPanels),
    chatPlacement: betweenChatPanelId ? "between" : "side",
    chatVisible: patch.chatVisible !== undefined
      ? Boolean(patch.chatVisible) && hasChats
      : state.chatVisible && hasChats,
  };
}

function removeStreamFromPanels(panels: ChatPanel[], streamId: string) {
  return panels
    .map((panel) => ({ ...panel, streamIds: panel.streamIds.filter((id) => id !== streamId) }))
    .filter((panel) => panel.streamIds.length);
}

function prunePanelSlots(
  panels: ChatPanel[],
  sideChatPanelIds: string[],
  betweenChatPanelId: string | undefined,
) {
  const ids = new Set(panels.map((panel) => panel.id));
  return {
    sideChatPanelIds: sideChatPanelIds.filter((id) => ids.has(id)),
    betweenChatPanelId: betweenChatPanelId && ids.has(betweenChatPanelId) ? betweenChatPanelId : undefined,
  };
}

function insertInlinePanel(
  tiles: CanvasTile[],
  panelId: string,
  anchorId: string | undefined,
  orientation: "horizontal" | "vertical" | undefined,
  rootOrientation: "horizontal" | "vertical" | undefined,
): { tiles: CanvasTile[]; rootOrientation?: "horizontal" | "vertical" } {
  const without = tiles.filter((tile) => !(tile.kind === "chat" && tile.id === panelId));
  const anchorIndex = anchorId
    ? without.findIndex((tile) => tile.id === anchorId)
    : -1;
  const insertAt = anchorIndex >= 0 ? anchorIndex + 1 : without.length;
  const next = [...without];
  next.splice(insertAt, 0, { kind: "chat", id: panelId });
  return {
    tiles: next,
    rootOrientation: orientation || rootOrientation,
  };
}

function initialState(initialStreams: Streamer[]): WorkspaceState {
  const seedChat = firstTwitchId(initialStreams);
  const panelId = "cp-default";
  const chatPanels = seedChat ? [{ id: panelId, streamIds: [seedChat] }] : [];
  return {
    streams: initialStreams,
    template: "auto",
    muted: Object.fromEntries(initialStreams.map((stream, index) => [stream.id, index > 0])),
    paused: {},
    volume: Object.fromEntries(initialStreams.map((stream) => [stream.id, 0.7])),
    captions: {},
    drawerOpen: true,
    chatVisible: Boolean(seedChat),
    chatPanels,
    sideChatPanelIds: seedChat ? [panelId] : [],
    betweenChatPanelId: undefined,
    canvasTiles: initialStreams.map((stream) => ({ kind: "stream" as const, id: stream.id })),
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
      const chat = normalizeChatLayout(streams, action.state);
      const { chatStreamId: _legacy, ...rest } = action.state;
      const hadPlacement = rest.chatPlacement !== undefined || rest.betweenChatPanelId !== undefined;
      return {
        ...state,
        ...rest,
        streams,
        ...chat,
        chatPlacementExplicit: hadPlacement || Boolean(rest.chatPlacementExplicit) || state.chatPlacementExplicit,
        chatVisible: rest.chatVisible === undefined
          ? Boolean(chat.chatStreamIds.length)
          : Boolean(rest.chatVisible) && Boolean(chat.chatStreamIds.length),
        canvasTiles: normalizeCanvasTiles(
          streams,
          chat.chatPanels,
          chat.sideChatPanelIds,
          chat.betweenChatPanelId,
          rest.canvasTiles || chat.canvasTiles,
        ),
      };
    }
    case "load": {
      const streams = action.streams;
      const chat = normalizeChatLayout(streams, action);
      const hadPlacement = action.chatPlacement !== undefined || action.betweenChatPanelId !== undefined;
      return {
        streams,
        template: action.template,
        focusedId: action.template === "focus" ? streams[0]?.id : undefined,
        muted: Object.fromEntries(streams.map((stream, index) => [stream.id, index > 0])),
        paused: {},
        volume: Object.fromEntries(streams.map((stream) => [stream.id, 0.7])),
        captions: {},
        drawerOpen: state.drawerOpen,
        chatVisible: Boolean(chat.chatStreamIds.length),
        ...chat,
        chatPlacementExplicit: hadPlacement || state.chatPlacementExplicit,
        layouts: {},
        rootOrientation: action.rootOrientation ?? state.rootOrientation,
      };
    }
    case "add": {
      if (state.streams.some((stream) => stream.id === action.stream.id)) return state;
      const streams = [...state.streams, action.stream];
      let chatPanels = state.chatPanels;
      let sideChatPanelIds = state.sideChatPanelIds;
      if (!chatPanels.length && action.stream.platform === "Twitch") {
        const panelId = newPanelId();
        chatPanels = [{ id: panelId, streamIds: [action.stream.id] }];
        sideChatPanelIds = [panelId];
      }
      return withChatDerived(state, {
        streams,
        muted: { ...state.muted, [action.stream.id]: true },
        paused: { ...state.paused, [action.stream.id]: false },
        volume: { ...state.volume, [action.stream.id]: 0.7 },
        captions: { ...state.captions, [action.stream.id]: Boolean(action.captions) },
        chatPanels,
        sideChatPanelIds,
        canvasTiles: [...state.canvasTiles, { kind: "stream", id: action.stream.id }],
        chatVisible: state.chatVisible || Boolean(chatPanels.length),
      });
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
      let chatPanels = removeStreamFromPanels(state.chatPanels, action.id);
      if (!chatPanels.length) {
        const fallback = firstTwitchId(streams);
        if (fallback) chatPanels = [{ id: newPanelId(), streamIds: [fallback] }];
      }
      const slots = prunePanelSlots(chatPanels, state.sideChatPanelIds, state.betweenChatPanelId);
      // Prefer keeping at least one side panel when between is no longer valid.
      let betweenChatPanelId = slots.betweenChatPanelId;
      let sideChatPanelIds = slots.sideChatPanelIds;
      if (betweenChatPanelId && !canPlaceChatBetween(streams, state.template)) {
        if (!sideChatPanelIds.includes(betweenChatPanelId)) sideChatPanelIds = [...sideChatPanelIds, betweenChatPanelId];
        betweenChatPanelId = undefined;
      }
      if (!sideChatPanelIds.length && !betweenChatPanelId && chatPanels[0]) {
        sideChatPanelIds = [chatPanels[0].id];
      }
      return withChatDerived(state, {
        streams,
        muted,
        paused,
        volume,
        captions,
        layouts: {},
        focusedId: state.focusedId === action.id ? streams[0]?.id : state.focusedId,
        chatPanels,
        sideChatPanelIds,
        betweenChatPanelId,
        canvasTiles: state.canvasTiles.filter((tile) => tile.id !== action.id),
        chatVisible: Boolean(flattenChatStreamIds(chatPanels).length) && state.chatVisible,
      });
    }
    case "reorder": {
      const from = state.canvasTiles.findIndex((tile) => tile.id === action.activeId);
      const to = state.canvasTiles.findIndex((tile) => tile.id === action.overId);
      const orientationChanged = Boolean(action.orientation) && action.orientation !== (state.rootOrientation || "horizontal");
      if (from < 0 || to < 0 || (from === to && !orientationChanged)) {
        return orientationChanged ? { ...state, rootOrientation: action.orientation, layouts: {} } : state;
      }
      const canvasTiles = [...state.canvasTiles];
      const [moved] = canvasTiles.splice(from, 1);
      canvasTiles.splice(to, 0, moved);
      const streamOrder = canvasTiles.filter((tile) => tile.kind === "stream").map((tile) => tile.id);
      const byId = new Map(state.streams.map((stream) => [stream.id, stream]));
      const streams = streamOrder.map((id) => byId.get(id)!).filter(Boolean);
      for (const stream of state.streams) {
        if (!streams.some((item) => item.id === stream.id)) streams.push(stream);
      }
      return {
        ...state,
        streams,
        canvasTiles,
        rootOrientation: action.orientation || state.rootOrientation,
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
      const panelId = newPanelId();
      return withChatDerived(state, {
        chatVisible: true,
        chatPanels: [{ id: panelId, streamIds: [seed] }],
        sideChatPanelIds: [panelId],
        betweenChatPanelId: undefined,
      });
    }
    case "chatPlacement": {
      const explicit = action.explicit === false ? state.chatPlacementExplicit : true;
      if (action.placement === "between") {
        if (!canPlaceChatBetween(state.streams, state.template)) {
          return { ...state, chatPlacementExplicit: explicit };
        }
        const panelId = state.betweenChatPanelId
          || state.sideChatPanelIds[0]
          || state.chatPanels[0]?.id;
        if (!panelId) return { ...state, chatPlacementExplicit: explicit };
        // Between shell owns the canvas — park every other chat panel on the side.
        const inlineIds = state.canvasTiles
          .filter((tile) => tile.kind === "chat" && tile.id !== panelId)
          .map((tile) => tile.id);
        const sideChatPanelIds = [
          ...state.sideChatPanelIds.filter((id) => id !== panelId),
          ...inlineIds.filter((id) => !state.sideChatPanelIds.includes(id)),
        ];
        return withChatDerived(state, {
          betweenChatPanelId: panelId,
          sideChatPanelIds,
          canvasTiles: state.canvasTiles.filter((tile) => tile.kind === "stream"),
          chatPlacementExplicit: explicit,
          chatVisible: true,
        });
      }
      // Move between panel back to the side dock.
      const betweenId = state.betweenChatPanelId;
      if (!betweenId) {
        return { ...state, chatPlacement: "side", chatPlacementExplicit: explicit };
      }
      return withChatDerived(state, {
        betweenChatPanelId: undefined,
        sideChatPanelIds: state.sideChatPanelIds.includes(betweenId)
          ? state.sideChatPanelIds
          : [...state.sideChatPanelIds, betweenId],
        chatPlacementExplicit: explicit,
      });
    }
    case "addChat": {
      const stream = state.streams.find((item) => item.id === action.id);
      if (!stream || stream.platform !== "Twitch") return state;
      if (state.chatStreamIds.includes(action.id)) return { ...state, chatVisible: true };
      const targetId = action.panelId
        || state.sideChatPanelIds[0]
        || state.betweenChatPanelId
        || state.chatPanels[0]?.id;
      if (targetId && state.chatPanels.some((panel) => panel.id === targetId)) {
        const chatPanels = state.chatPanels.map((panel) => (
          panel.id === targetId
            ? { ...panel, streamIds: [...panel.streamIds, action.id] }
            : panel
        ));
        return withChatDerived(state, { chatPanels, chatVisible: true });
      }
      const panelId = newPanelId();
      return withChatDerived(state, {
        chatPanels: [...state.chatPanels, { id: panelId, streamIds: [action.id] }],
        sideChatPanelIds: [...state.sideChatPanelIds, panelId],
        chatVisible: true,
      });
    }
    case "removeChat": {
      const chatPanels = removeStreamFromPanels(state.chatPanels, action.id);
      const slots = prunePanelSlots(chatPanels, state.sideChatPanelIds, state.betweenChatPanelId);
      return withChatDerived(state, {
        chatPanels,
        ...slots,
        chatVisible: Boolean(flattenChatStreamIds(chatPanels).length) && state.chatVisible,
      });
    }
    case "reorderChats": {
      const panel = state.chatPanels.find((item) => item.id === action.panelId);
      if (!panel) return state;
      const from = panel.streamIds.indexOf(action.activeId);
      const to = panel.streamIds.indexOf(action.overId);
      if (from < 0 || to < 0 || from === to) return state;
      const streamIds = [...panel.streamIds];
      const [moved] = streamIds.splice(from, 1);
      streamIds.splice(to, 0, moved);
      return withChatDerived(state, {
        chatPanels: state.chatPanels.map((item) => (item.id === panel.id ? { ...item, streamIds } : item)),
      });
    }
    case "moveChat": {
      const fromPanel = state.chatPanels.find((panel) => panel.streamIds.includes(action.streamId));
      const toPanel = state.chatPanels.find((panel) => panel.id === action.toPanelId);
      if (!fromPanel || !toPanel || fromPanel.id === toPanel.id) {
        if (fromPanel && toPanel && fromPanel.id === toPanel.id && action.beforeStreamId) {
          return reducer(state, {
            type: "reorderChats",
            panelId: fromPanel.id,
            activeId: action.streamId,
            overId: action.beforeStreamId,
          });
        }
        return state;
      }
      const fromIds = fromPanel.streamIds.filter((id) => id !== action.streamId);
      let toIds = toPanel.streamIds.filter((id) => id !== action.streamId);
      const insertAt = action.beforeStreamId ? toIds.indexOf(action.beforeStreamId) : -1;
      if (insertAt >= 0) toIds.splice(insertAt, 0, action.streamId);
      else toIds = [...toIds, action.streamId];

      let chatPanels = state.chatPanels
        .map((panel) => {
          if (panel.id === fromPanel.id) return { ...panel, streamIds: fromIds };
          if (panel.id === toPanel.id) return { ...panel, streamIds: toIds };
          return panel;
        })
        .filter((panel) => panel.streamIds.length);
      const slots = prunePanelSlots(chatPanels, state.sideChatPanelIds, state.betweenChatPanelId);
      return withChatDerived(state, {
        chatPanels,
        ...slots,
        chatVisible: true,
      });
    }
    case "detachChat": {
      const fromPanel = state.chatPanels.find((panel) => panel.streamIds.includes(action.streamId));
      if (!fromPanel) return state;
      // Already alone in a panel — re-place that panel instead of creating a duplicate.
      const alone = fromPanel.streamIds.length === 1;
      const panelId = alone ? fromPanel.id : newPanelId();
      let chatPanels = alone
        ? state.chatPanels
        : [
          ...state.chatPanels.map((panel) => (
            panel.id === fromPanel.id
              ? { ...panel, streamIds: panel.streamIds.filter((id) => id !== action.streamId) }
              : panel
          )),
          { id: panelId, streamIds: [action.streamId] },
        ].filter((panel) => panel.streamIds.length);

      // Clear the panel from every slot, then place it.
      let sideChatPanelIds = state.sideChatPanelIds.filter((id) => id !== panelId && (alone ? id !== fromPanel.id : true));
      let betweenChatPanelId = state.betweenChatPanelId === panelId || (alone && state.betweenChatPanelId === fromPanel.id)
        ? undefined
        : state.betweenChatPanelId;
      let canvasTiles = state.canvasTiles.filter((tile) => !(tile.kind === "chat" && (tile.id === panelId || (alone && tile.id === fromPanel.id))));
      let rootOrientation = state.rootOrientation;
      const orientationChanged = Boolean(action.orientation) && action.orientation !== (state.rootOrientation || "horizontal");

      if (action.placement === "side") {
        sideChatPanelIds = [...sideChatPanelIds, panelId];
      } else if (action.placement === "between" && canPlaceChatBetween(state.streams, state.template)) {
        if (betweenChatPanelId && betweenChatPanelId !== panelId) {
          sideChatPanelIds = sideChatPanelIds.includes(betweenChatPanelId)
            ? sideChatPanelIds
            : [...sideChatPanelIds, betweenChatPanelId];
        }
        betweenChatPanelId = panelId;
      } else if (action.placement === "inline" || action.placement === "between") {
        // "between" falls back to inline/side when not capable.
        if (action.placement === "between") {
          sideChatPanelIds = [...sideChatPanelIds, panelId];
        } else {
          const inserted = insertInlinePanel(
            canvasTiles,
            panelId,
            action.anchorId,
            action.orientation,
            state.rootOrientation,
          );
          canvasTiles = inserted.tiles;
          rootOrientation = inserted.rootOrientation;
        }
      }

      const slots = prunePanelSlots(chatPanels, sideChatPanelIds, betweenChatPanelId);
      return withChatDerived(state, {
        chatPanels,
        sideChatPanelIds: slots.sideChatPanelIds,
        betweenChatPanelId: slots.betweenChatPanelId,
        canvasTiles,
        rootOrientation,
        layouts: orientationChanged ? {} : state.layouts,
        chatVisible: true,
        chatPlacementExplicit: action.placement !== "inline" ? true : state.chatPlacementExplicit,
      });
    }
    case "layout": return { ...state, layouts: { ...state.layouts, [action.id]: action.layout } };
    case "resetLayouts": return { ...state, layouts: {} };
    default: return state;
  }
}

const streamPane = (streamId: string): LayoutNode => ({ type: "pane", id: `pane-${streamId}`, streamId });
const chatPane = (panelId: string): LayoutNode => ({ type: "chat", id: `chat-${panelId}`, panelId });
const split = (id: string, orientation: "horizontal" | "vertical", first: LayoutNode, second: LayoutNode): LayoutNode =>
  ({ type: "split", id, orientation, first, second });

/** Stable split ids from membership (sorted) so reordering does not remount the shell. */
function splitKey(orientation: "horizontal" | "vertical", ids: string[]) {
  return `split-${orientation}-${[...ids].sort().join("~")}`;
}

function leafNode(tile: CanvasTile): LayoutNode {
  return tile.kind === "stream" ? streamPane(tile.id) : chatPane(tile.id);
}

function leafIds(tiles: CanvasTile[]) {
  return tiles.map((tile) => `${tile.kind}:${tile.id}`);
}

export function buildLayoutTree(
  tiles: CanvasTile[] | string[],
  template: LayoutTemplate,
  focusedId?: string,
  rootOrientation?: "horizontal" | "vertical",
): LayoutNode | null {
  const canvasTiles: CanvasTile[] = Array.isArray(tiles) && typeof tiles[0] === "string"
    ? (tiles as string[]).map((id) => ({ kind: "stream" as const, id }))
    : (tiles as CanvasTile[]);

  if (!canvasTiles.length) return null;
  if (template === "focus") {
    const focus = focusedId && canvasTiles.some((tile) => tile.kind === "stream" && tile.id === focusedId)
      ? focusedId
      : canvasTiles.find((tile) => tile.kind === "stream")?.id;
    return focus ? streamPane(focus) : null;
  }

  const p = canvasTiles.map(leafNode);
  if (p.length === 1) return p[0];

  const ids = leafIds(canvasTiles);
  const primary = rootOrientation || "horizontal";
  const cross = primary === "horizontal" ? "vertical" : "horizontal";

  if (p.length === 2) return split(splitKey(primary, ids), primary, p[0], p[1]);
  if (p.length === 3) {
    return split(
      splitKey(primary, ids),
      primary,
      p[0],
      split(splitKey(cross, ids.slice(1)), cross, p[1], p[2]),
    );
  }
  if (p.length === 4) {
    return split(
      splitKey(cross, ids),
      cross,
      split(splitKey(primary, ids.slice(0, 2)), primary, p[0], p[1]),
      split(splitKey(primary, ids.slice(2)), primary, p[2], p[3]),
    );
  }
  if (p.length === 5) {
    return split(
      splitKey(primary, ids),
      primary,
      p[0],
      split(
        splitKey(cross, ids.slice(1)),
        cross,
        split(splitKey(primary, ids.slice(1, 3)), primary, p[1], p[2]),
        split(splitKey(primary, ids.slice(3)), primary, p[3], p[4]),
      ),
    );
  }
  return split(
    splitKey(cross, ids),
    cross,
    split(
      splitKey(primary, ids.slice(0, 3)),
      primary,
      p[0],
      split(splitKey(primary, ids.slice(1, 3)), primary, p[1], p[2]),
    ),
    split(
      splitKey(primary, ids.slice(3)),
      primary,
      p[3],
      split(splitKey(primary, ids.slice(4)), primary, p[4], p[5]),
    ),
  );
}

/** DnD id helpers — keep stream sortable ids unchanged for player panes. */
export function chatDragId(panelId: string, streamId: string) {
  return `chat:${panelId}:${streamId}`;
}

export function parseChatDragId(value: string): { panelId: string; streamId: string } | null {
  if (!value.startsWith("chat:")) return null;
  const parts = value.split(":");
  if (parts.length < 3) return null;
  return { panelId: parts[1], streamId: parts.slice(2).join(":") };
}

export function chatPanelDropId(panelId: string) {
  return `chat-panel:${panelId}`;
}

export function parseChatPanelDropId(value: string) {
  return value.startsWith("chat-panel:") ? value.slice("chat-panel:".length) : null;
}

export const CHAT_DOCK_DROP_ID = "chat-dock-side";

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
  const tree = useMemo(() => {
    const tiles = state.chatVisible
      ? state.canvasTiles
      : state.canvasTiles.filter((tile) => tile.kind === "stream");
    return buildLayoutTree(tiles, state.template, state.focusedId, state.rootOrientation);
  }, [state.canvasTiles, state.chatVisible, state.focusedId, state.template, state.rootOrientation]);
  return { state, dispatch, tree };
}
