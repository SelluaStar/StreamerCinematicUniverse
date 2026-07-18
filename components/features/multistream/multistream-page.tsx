"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { closestCenter, DndContext, DragOverlay, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Group, Panel, Separator } from "react-resizable-panels";
import { AlertCircle, Check, ChevronDown, Keyboard, Share2, Star, Trash2 } from "lucide-react";
import { getStudentLogins, type Streamer } from "@/lib/data";
import { channelSearchToStreamer, searchTwitchChannels, useTwitchStreams } from "@/components/features/twitch/use-twitch-data";
import { useStreamLanguage } from "@/components/features/preferences/stream-language-provider";
import { DiscoveryDrawer } from "@/components/features/multistream/discovery-drawer";
import { SplitLayout } from "@/components/features/multistream/split-layout";
import { ChatSideDock, TwitchChat } from "@/components/features/multistream/twitch-chat";
import { WorkspaceControls, type MobileViewMode } from "@/components/features/multistream/workspace-controls";
import {
  canPlaceChatBetween,
  CHAT_DOCK_DROP_ID,
  parseChatDragId,
  parseChatPanelDropId,
  useWorkspace,
} from "@/components/features/multistream/use-workspace";
import { parseSharedWorkspace, serializeSharedWorkspace } from "@/components/features/multistream/share-state";
import { getSavedWorkspace, listSavedWorkspaces, deleteSavedWorkspace, saveWorkspace, WATCHSPACES_CHANGE_EVENT, type SavedWorkspace } from "@/lib/multistream/saved-workspaces";
import { StreamAvatar } from "@/components/features/multistream/stream-avatar";
import { preferCaptionsEnabled } from "@/lib/preferences/account-prefs";
import { useWatchMinutes } from "@/lib/watch-stats/use-watch-minutes";
import styles from "./multistream.module.css";

const SHORTCUTS: Array<{ key: string; label: string }> = [
  { key: "D", label: "Toggle stream drawer" },
  { key: "C", label: "Toggle chat panel" },
  { key: "M", label: "Mute / unmute all" },
  { key: "P", label: "Pause / resume all" },
  { key: "F", label: "Toggle focus layout" },
  { key: "1–6", label: "Jump to a stream" },
  { key: "?", label: "Toggle this menu" },
];

function useMedia(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    queueMicrotask(update);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);
  return matches;
}

export function MultistreamPage({ announce }: { announce: (message: string) => void }) {
  useWatchMinutes();
  const studentLogins = useMemo(() => getStudentLogins(), []);
  const { preference: streamLanguage } = useStreamLanguage();
  const twitch = useTwitchStreams({ first: 30, language: streamLanguage });
  const initial = useMemo(() => [] as Streamer[], []);
  const { state, dispatch, tree } = useWorkspace(initial);
  const campus = useTwitchStreams({
    first: 100,
    userLogins: studentLogins,
    enabled: state.drawerOpen,
  });
  const [mobileActiveId, setMobileActiveId] = useState<string>();
  const [mobileView, setMobileView] = useState<MobileViewMode>("split");
  const [showSaved, setShowSaved] = useState(false);
  const [playerLimit, setPlayerLimit] = useState(6);
  const [activeDragId, setActiveDragId] = useState<string>();
  const [savedWorkspaces, setSavedWorkspaces] = useState<SavedWorkspace[]>([]);
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string>();
  const [currentWorkspaceName, setCurrentWorkspaceName] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [savedMenuOpen, setSavedMenuOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const shareLoaded = useRef(false);
  const savedMenuRef = useRef<HTMLDivElement>(null);
  const savedTriggerRef = useRef<HTMLButtonElement>(null);
  const shortcutsRef = useRef<HTMLDivElement>(null);
  const shortcutsTriggerRef = useRef<HTMLButtonElement>(null);
  const chatSheetRef = useRef<HTMLDivElement>(null);
  const isMobile = useMedia("(max-width: 700px)");
  const isCompact = useMedia("(max-width: 1000px)");
  const isConstrained = useMedia("(max-width: 1400px)");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const available = twitch.streams;
  const eventStreams = campus.streams;
  const chatBetweenCapable = canPlaceChatBetween(state.streams, state.template);
  const chatBetweenActive = chatBetweenCapable && state.chatVisible && Boolean(state.betweenChatPanelId);
  const sideChatPanels = state.sideChatPanelIds
    .map((id) => state.chatPanels.find((panel) => panel.id === id))
    .filter((panel): panel is NonNullable<typeof panel> => Boolean(panel));
  const useTabFocus = isMobile
    ? mobileView === "tabs"
    : (isConstrained && state.streams.length > 2 && !chatBetweenActive);
  const showStreamTray = useTabFocus && state.streams.length > 0;
  const mobileStack = isMobile && mobileView === "stack";
  const showSideChat = state.chatVisible && !isMobile && sideChatPanels.length > 0;
  const showChatSheet = state.chatVisible && isMobile && sideChatPanels.length > 0;
  const activeChatDrag = activeDragId ? parseChatDragId(activeDragId) : null;
  const activeDragStream = activeChatDrag
    ? state.streams.find((stream) => stream.id === activeChatDrag.streamId)
    : state.streams.find((stream) => stream.id === activeDragId);
  const activeDragPreview = !activeChatDrag && activeDragStream
    ? (activeDragStream.thumbnailUrl || (activeDragStream.platform === "Twitch"
      ? `https://static-cdn.jtvnw.net/previews-ttv/live_user_${encodeURIComponent(activeDragStream.login || activeDragStream.handle)}-640x360.jpg`
      : undefined))
    : undefined;
  const canvasSortableIds = state.canvasTiles.map((tile) => tile.id);
  const allMuted = state.streams.length > 0 && state.streams.every((stream) => state.muted[stream.id]);
  const allPaused = state.streams.length > 0 && state.streams.every((stream) => state.paused[stream.id]);

  const refreshSaved = useCallback(() => setSavedWorkspaces(listSavedWorkspaces()), []);
  useEffect(() => {
    refreshSaved();
    window.addEventListener(WATCHSPACES_CHANGE_EVENT, refreshSaved);
    const onStorage = (event: StorageEvent) => {
      if (event.key === "scu-multistream-saved-v1") refreshSaved();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(WATCHSPACES_CHANGE_EVENT, refreshSaved);
      window.removeEventListener("storage", onStorage);
    };
  }, [refreshSaved]);

  useEffect(() => {
    const saved = Number(localStorage.getItem("scu-player-limit") || 6);
    const savedView = localStorage.getItem("scu-mobile-view");
    queueMicrotask(() => {
      setPlayerLimit([2, 4, 6].includes(saved) ? saved : 6);
      if (savedView === "stack" || savedView === "tabs" || savedView === "split") setMobileView(savedView);
    });
  }, []);

  // Compact viewports: side-by-side streams with chat in the middle by default.
  useEffect(() => {
    if (!isCompact || !chatBetweenCapable || state.chatPlacementExplicit) return;
    const oriented = (state.rootOrientation || "horizontal") === "horizontal";
    if (state.chatPlacement === "between" && oriented && state.chatVisible) return;
    queueMicrotask(() => {
      if (state.chatPlacement !== "between") {
        dispatch({ type: "chatPlacement", placement: "between", explicit: false });
      }
      if (!state.chatVisible && state.chatStreamIds.length) {
        dispatch({ type: "chat", visible: true });
      }
      const first = state.streams[0];
      if (first && state.rootOrientation !== "horizontal") {
        dispatch({ type: "reorder", activeId: first.id, overId: first.id, orientation: "horizontal" });
      }
    });
  }, [chatBetweenCapable, dispatch, isCompact, state.chatPlacement, state.chatPlacementExplicit, state.chatStreamIds.length, state.chatVisible, state.rootOrientation, state.streams]);

  useEffect(() => {
    if (shareLoaded.current) return;
    shareLoaded.current = true;
    const params = new URLSearchParams(window.location.search);
    const loadId = params.get("load");
    if (loadId) {
      const saved = getSavedWorkspace(loadId);
      if (!saved) {
        announce("That saved watchspace could not be found");
        return;
      }
      dispatch({
        type: "load",
        streams: saved.streams,
        template: saved.template,
        chatPanels: saved.chatPanels,
        sideChatPanelIds: saved.sideChatPanelIds,
        betweenChatPanelId: saved.betweenChatPanelId,
        canvasTiles: saved.canvasTiles,
        chatStreamIds: saved.chatStreamIds,
        chatStreamId: saved.chatStreamId,
        chatPlacement: saved.chatPlacement,
      });
      setCurrentWorkspaceId(saved.id);
      setCurrentWorkspaceName(saved.name);
      setNameDraft(saved.name);
      setMobileActiveId(saved.streams[0]?.id);
      announce(`Loaded “${saved.name}”`);
      return;
    }
    const shared = parseSharedWorkspace(window.location.search);
    const logins = shared.logins;
    if (!logins.length) return;
    void Promise.all(logins.map(async (login) => {
      const channels = await searchTwitchChannels(login);
      return channels.find((channel) => channel.login.toLowerCase() === login);
    })).then((channels) => {
      const streams = channels.filter((channel) => channel !== undefined).map(channelSearchToStreamer);
      if (!streams.length) {
        announce("Shared channels could not be loaded");
        return;
      }
      const chatPanels = (shared.chatPanels?.length ? shared.chatPanels : [shared.chats.length ? shared.chats : shared.chat ? [shared.chat] : []])
        .map((loginsInPanel) => loginsInPanel
          .map((login) => streams.find((stream) => stream.login === login || stream.handle === login)?.id)
          .filter((id): id is string => Boolean(id)))
        .filter((ids) => ids.length)
        .map((streamIds, index) => ({ id: `cp-share-${index}`, streamIds }));
      const fallbackChat = streams.find((stream) => stream.platform === "Twitch")?.id;
      const panels = chatPanels.length
        ? chatPanels
        : fallbackChat
          ? [{ id: "cp-share-0", streamIds: [fallbackChat] }]
          : [];
      dispatch({
        type: "load",
        streams,
        template: shared.layout,
        chatPanels: panels,
        sideChatPanelIds: shared.chatPlacement === "between" && panels[0] ? panels.slice(1).map((panel) => panel.id) : panels.map((panel) => panel.id),
        betweenChatPanelId: shared.chatPlacement === "between" ? panels[0]?.id : undefined,
        chatPlacement: shared.chatPlacement,
      });
      setMobileActiveId(streams[0]?.id);
    }).catch(() => announce("Some shared channels could not be loaded"));
  }, [announce, dispatch]);

  useEffect(() => {
    if (!state.streams.some((stream) => stream.id === mobileActiveId)) {
      queueMicrotask(() => setMobileActiveId(state.streams[0]?.id));
    }
  }, [mobileActiveId, state.streams]);

  useEffect(() => {
    if (isMobile && state.drawerOpen && state.chatVisible && !chatBetweenActive) {
      queueMicrotask(() => dispatch({ type: "chat", visible: false }));
    }
  }, [chatBetweenActive, dispatch, isMobile, state.chatVisible, state.drawerOpen]);

  useEffect(() => {
    if (!savedMenuOpen && !shortcutsOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (savedMenuOpen && !savedMenuRef.current?.contains(target) && !savedTriggerRef.current?.contains(target)) setSavedMenuOpen(false);
      if (shortcutsOpen && !shortcutsRef.current?.contains(target) && !shortcutsTriggerRef.current?.contains(target)) setShortcutsOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [savedMenuOpen, shortcutsOpen]);

  useEffect(() => {
    if (!showChatSheet) return;
    const sheet = chatSheetRef.current;
    if (!sheet) return;
    const getFocusable = () => [...sheet.querySelectorAll<HTMLElement>("button, a[href], input, select")].filter((el) => !el.hasAttribute("disabled"));
    getFocusable()[0]?.focus();
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const items = getFocusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    sheet.addEventListener("keydown", trapFocus);
    return () => sheet.removeEventListener("keydown", trapFocus);
  }, [showChatSheet]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = Boolean(target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable));
      if (event.key === "Escape") {
        if (savedMenuOpen) setSavedMenuOpen(false);
        if (shortcutsOpen) setShortcutsOpen(false);
        return;
      }
      if (typing || event.metaKey || event.ctrlKey || event.altKey) return;
      switch (event.key.toLowerCase()) {
        case "d":
          event.preventDefault();
          dispatch({ type: "drawer", value: !state.drawerOpen });
          break;
        case "c":
          if (!state.streams.some((stream) => stream.platform === "Twitch") && !state.chatStreamIds.length) break;
          event.preventDefault();
          dispatch({ type: "chat", visible: !state.chatVisible });
          break;
        case "m":
          if (!state.streams.length) break;
          event.preventDefault();
          dispatch({ type: "muteAll", value: !allMuted });
          announce(allMuted ? "Unmuted all streams" : "Muted all streams");
          break;
        case "p":
          if (!state.streams.length) break;
          event.preventDefault();
          dispatch({ type: "pauseAll", value: !allPaused });
          announce(allPaused ? "Resumed all streams" : "Paused all streams");
          break;
        case "f":
          if (!state.streams.length) break;
          event.preventDefault();
          dispatch({ type: "template", template: state.template === "focus" ? "auto" : "focus" });
          break;
        case "?":
          if (isMobile) break;
          event.preventDefault();
          setShortcutsOpen((value) => !value);
          break;
        default: {
          const n = Number(event.key);
          if (Number.isInteger(n) && n >= 1 && n <= state.streams.length) {
            event.preventDefault();
            const stream = state.streams[n - 1];
            setMobileActiveId(stream.id);
            if (state.template === "focus") dispatch({ type: "focus", id: stream.id });
          }
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [allMuted, allPaused, announce, dispatch, isMobile, savedMenuOpen, shortcutsOpen, state.chatStreamIds, state.chatVisible, state.drawerOpen, state.streams, state.template]);

  const addStream = (stream: Streamer) => {
    if (state.streams.length >= playerLimit) return announce(`${playerLimit}-stream limit reached`);
    dispatch({ type: "add", stream, captions: preferCaptionsEnabled() });
    setMobileActiveId(stream.id);
    announce(`${stream.name} added`);
  };
  const dropOrientation = (active: DragEndEvent["active"], over: NonNullable<DragEndEvent["over"]>) => {
    const activeRect = active.rect.current.translated;
    const overRect = over.rect;
    if (!activeRect || !overRect) return undefined;
    const dx = activeRect.left + activeRect.width / 2 - (overRect.left + overRect.width / 2);
    const dy = activeRect.top + activeRect.height / 2 - (overRect.top + overRect.height / 2);
    return Math.abs(dy) > Math.abs(dx) ? "vertical" as const : "horizontal" as const;
  };
  const dragEnded = ({ active, over }: DragEndEvent) => {
    setActiveDragId(undefined);
    if (!over || active.id === over.id) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    const chatActive = parseChatDragId(activeId);
    const orientation = dropOrientation(active, over);

    if (chatActive) {
      const overChat = parseChatDragId(overId);
      const overPanelId = overChat?.panelId || parseChatPanelDropId(overId);
      if (overPanelId) {
        if (overPanelId === chatActive.panelId && overChat) {
          dispatch({
            type: "reorderChats",
            panelId: chatActive.panelId,
            activeId: chatActive.streamId,
            overId: overChat.streamId,
          });
          return;
        }
        dispatch({
          type: "moveChat",
          streamId: chatActive.streamId,
          toPanelId: overPanelId,
          beforeStreamId: overChat?.streamId,
        });
        announce("Chats combined");
        return;
      }
      if (overId === CHAT_DOCK_DROP_ID) {
        dispatch({ type: "detachChat", streamId: chatActive.streamId, placement: "side" });
        announce("Chat panel moved to side");
        return;
      }
      // Dropped on a stream (or canvas tile) → new / moved inline chat panel.
      const anchorId = state.canvasTiles.some((tile) => tile.id === overId)
        ? overId
        : state.streams.some((stream) => stream.id === overId)
          ? overId
          : undefined;
      if (anchorId || state.streams.some((stream) => stream.id === overId)) {
        dispatch({
          type: "detachChat",
          streamId: chatActive.streamId,
          placement: "inline",
          anchorId: anchorId || overId,
          orientation,
        });
        announce(orientation === "vertical" ? "Chat panel stacked with stream" : "Chat panel placed beside stream");
        return;
      }
      return;
    }

    // Canvas tile reorder (streams and inline chat panels).
    dispatch({ type: "reorder", activeId, overId, orientation });
    announce(orientation === "vertical" ? "Layout stacked vertically" : "Layout arranged side by side");
  };
  const dragStarted = ({ active }: DragStartEvent) => {
    const id = String(active.id);
    setActiveDragId(id);
    const chat = parseChatDragId(id);
    if (chat) {
      announce(`Moving ${state.streams.find((stream) => stream.id === chat.streamId)?.name || "chat"}`);
      return;
    }
    announce(`Moving ${state.streams.find((stream) => stream.id === id)?.name || "panel"}`);
  };
  const share = async () => {
    const chatPanels = state.chatPanels.map((panel) => panel.streamIds
      .map((id) => state.streams.find((stream) => stream.id === id))
      .filter((stream): stream is Streamer => Boolean(stream))
      .map((stream) => stream.login || stream.handle));
    const chats = chatPanels.flat();
    const query = serializeSharedWorkspace({
      logins: state.streams.map((stream) => stream.login || stream.handle),
      layout: state.template,
      chats,
      chatPanels,
      chat: chats[0],
      chatPlacement: state.chatPlacement,
    });
    const url = `${window.location.origin}/multistream?${query}`;
    await navigator.clipboard.writeText(url);
    announce("Share link copied");
  };
  const renderChatPanel = (panelId: string, compact = false, tileSortable = false) => {
    const panel = state.chatPanels.find((item) => item.id === panelId);
    if (!panel) return null;
    return (
      <TwitchChat
        panelId={panel.id}
        streams={state.streams}
        chatStreamIds={panel.streamIds}
        occupiedChatIds={state.chatStreamIds}
        chatPlacement={state.chatPlacement}
        canChatBetween={chatBetweenCapable}
        compact={compact}
        tileSortable={tileSortable}
        onAdd={(id) => dispatch({ type: "addChat", id, panelId: panel.id })}
        onRemove={(id) => dispatch({ type: "removeChat", id })}
        onHide={() => dispatch({ type: "chat", visible: false })}
        onChatPlacement={(placement) => {
          dispatch({ type: "chatPlacement", placement });
          announce(placement === "between" ? "Chat between streams" : "Chat on the side");
        }}
      />
    );
  };
  const renderSideChats = (compact = false) => (
    <ChatSideDock className={styles.chatSideStack}>
      {sideChatPanels.map((panel) => (
        <div key={panel.id} className={styles.chatSideStackItem}>
          {renderChatPanel(panel.id, compact)}
        </div>
      ))}
    </ChatSideDock>
  );
  const flashSaved = () => {
    setShowSaved(true);
    window.setTimeout(() => setShowSaved(false), 2600);
  };
  const saveCurrent = () => {
    if (!state.streams.length) return announce("Add a stream before saving");
    const record = saveWorkspace({
      id: currentWorkspaceId,
      name: nameDraft || currentWorkspaceName,
      streams: state.streams,
      template: state.template,
      chatPanels: state.chatPanels,
      sideChatPanelIds: state.sideChatPanelIds,
      betweenChatPanelId: state.betweenChatPanelId,
      canvasTiles: state.canvasTiles,
      chatStreamIds: state.chatStreamIds,
      chatPlacement: state.chatPlacement,
    });
    setCurrentWorkspaceId(record.id);
    setCurrentWorkspaceName(record.name);
    setNameDraft(record.name);
    refreshSaved();
    flashSaved();
    announce(`Saved “${record.name}”`);
    setSavedMenuOpen(false);
  };
  const saveAsNew = () => {
    if (!state.streams.length) return announce("Add a stream before saving");
    const record = saveWorkspace({
      name: nameDraft || "Untitled watchspace",
      streams: state.streams,
      template: state.template,
      chatPanels: state.chatPanels,
      sideChatPanelIds: state.sideChatPanelIds,
      betweenChatPanelId: state.betweenChatPanelId,
      canvasTiles: state.canvasTiles,
      chatStreamIds: state.chatStreamIds,
      chatPlacement: state.chatPlacement,
    });
    setCurrentWorkspaceId(record.id);
    setCurrentWorkspaceName(record.name);
    setNameDraft(record.name);
    refreshSaved();
    flashSaved();
    announce(`Saved as “${record.name}”`);
    setSavedMenuOpen(false);
  };
  const loadSaved = (saved: SavedWorkspace) => {
    dispatch({
      type: "load",
      streams: saved.streams,
      template: saved.template,
      chatPanels: saved.chatPanels,
      sideChatPanelIds: saved.sideChatPanelIds,
      betweenChatPanelId: saved.betweenChatPanelId,
      canvasTiles: saved.canvasTiles,
      chatStreamIds: saved.chatStreamIds,
      chatStreamId: saved.chatStreamId,
      chatPlacement: saved.chatPlacement,
    });
    setCurrentWorkspaceId(saved.id);
    setCurrentWorkspaceName(saved.name);
    setNameDraft(saved.name);
    setMobileActiveId(saved.streams[0]?.id);
    announce(`Loaded “${saved.name}”`);
    setSavedMenuOpen(false);
  };
  const removeSaved = (id: string, name: string) => {
    deleteSavedWorkspace(id);
    refreshSaved();
    if (id === currentWorkspaceId) {
      setCurrentWorkspaceId(undefined);
      setCurrentWorkspaceName("");
    }
    announce(`“${name}” deleted`);
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div><span>Live workspace{currentWorkspaceName ? ` · ${currentWorkspaceName}` : ""}</span><h1>Multistream</h1>{twitch.error && <small><AlertCircle /> Twitch unavailable · {twitch.error}</small>}</div>
        <div>
          {!isMobile && (
            <div className={styles.menuWrap} ref={shortcutsRef}>
              <button
                ref={shortcutsTriggerRef}
                type="button"
                className={styles.iconTrigger}
                aria-haspopup="menu"
                aria-expanded={shortcutsOpen}
                aria-label="Keyboard shortcuts"
                onClick={() => { setShortcutsOpen((value) => !value); setSavedMenuOpen(false); }}
              ><Keyboard /></button>
              {shortcutsOpen && (
                <div className={styles.popover} role="menu">
                  <div className={styles.shortcutsList}>
                    <b>Keyboard shortcuts</b>
                    {SHORTCUTS.map((item) => (
                      <div className={styles.shortcutRow} key={item.key}><span className={styles.kbd}>{item.key}</span><span>{item.label}</span></div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <button className="button secondary" onClick={() => void share()}><Share2 /> Share</button>
          <div className={styles.menuWrap} ref={savedMenuRef}>
            <button
              ref={savedTriggerRef}
              type="button"
              className={`button primary ${styles.savedTrigger}`}
              aria-haspopup="menu"
              aria-expanded={savedMenuOpen}
              onClick={() => { setSavedMenuOpen((value) => !value); setShortcutsOpen(false); }}
            ><Star /> {currentWorkspaceId ? "Saved" : "Save"} <ChevronDown /></button>
            {savedMenuOpen && (
              <div className={styles.popover} role="menu">
                <label className={styles.popoverNameRow}>
                  <span>Watchspace name</span>
                  <input value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} placeholder="Untitled watchspace" maxLength={60} />
                </label>
                <div className={styles.popoverActions}>
                  <button type="button" className="button primary" onClick={saveCurrent}>{currentWorkspaceId ? "Update" : "Save"}</button>
                  {currentWorkspaceId && <button type="button" className="button secondary" onClick={saveAsNew}>Save as new</button>}
                </div>
                <div className={styles.popoverDivider} />
                <div className={styles.savedList}>
                  {!savedWorkspaces.length && <p className={styles.savedEmpty}>No saved watchspaces yet.</p>}
                  {savedWorkspaces.map((saved) => (
                    <div key={saved.id} className={`${styles.savedItem} ${saved.id === currentWorkspaceId ? styles.savedItemActive : ""}`}>
                      <button type="button" onClick={() => loadSaved(saved)}><b>{saved.name}</b><small>{saved.streams.length} stream{saved.streams.length === 1 ? "" : "s"}</small></button>
                      <button type="button" onClick={() => removeSaved(saved.id, saved.name)} aria-label={`Delete ${saved.name}`}><Trash2 /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className={styles.workspace}>
        <DiscoveryDrawer
          open={state.drawerOpen}
          available={available}
          eventStreams={eventStreams}
          activeIds={state.streams.map((stream) => stream.id)}
          onOpenChange={(value) => {
            dispatch({ type: "drawer", value });
            if (isMobile && value) dispatch({ type: "chat", visible: false });
          }}
          onAdd={addStream}
        />

        <section className={`${styles.stage} ${showStreamTray ? styles.stageWithTray : ""} ${mobileStack ? styles.stageStack : ""}`}>
          {showStreamTray && (
            <div className={`${styles.mobileTabs} ${!isMobile ? styles.desktopTray : ""}`} role="tablist" aria-label="Active streams">
              {state.streams.map((stream) => (
                <button key={stream.id} type="button" role="tab" aria-selected={mobileActiveId === stream.id} onClick={() => { setMobileActiveId(stream.id); if (state.template === "focus") dispatch({ type: "focus", id: stream.id }); }}>
                  <StreamAvatar stream={stream} size={25} />
                  <span>{stream.name}</span>
                </button>
              ))}
            </div>
          )}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={dragStarted} onDragCancel={() => setActiveDragId(undefined)} onDragEnd={dragEnded}>
            <Group orientation="horizontal" className={styles.outerGroup}>
              <Panel id="watchspace" minSize={showSideChat ? "55%" : "100%"}>
                <SortableContext items={canvasSortableIds} strategy={rectSortingStrategy}>
                  <div className={styles.canvas}>
                    {tree ? (
                      <SplitLayout
                        tree={tree}
                        state={state}
                        mobileActiveId={useTabFocus ? mobileActiveId : undefined}
                        mobileStack={mobileStack}
                        chatBetween={chatBetweenActive}
                        chatNode={chatBetweenActive && state.betweenChatPanelId
                          ? renderChatPanel(state.betweenChatPanelId, true)
                          : undefined}
                        renderChatPanel={(panelId, compact) => renderChatPanel(panelId, compact, true)}
                        onState={(action) => dispatch(action as Parameters<typeof dispatch>[0])}
                        onRemove={(id) => dispatch({ type: "remove", id })}
                        onFocus={(id) => dispatch({ type: "focus", id })}
                        onLayout={(id, layout) => dispatch({ type: "layout", id, layout })}
                      />
                    ) : <div className={styles.emptyCanvas}><b>Your watchspace is empty</b><span>Open Streams and add a Twitch channel.</span></div>}
                  </div>
                </SortableContext>
              </Panel>
              {showSideChat && <>
                <Separator className={styles.chatResize}><span /></Separator>
                <Panel id="chat" defaultSize="340px" minSize="280px" maxSize="520px" groupResizeBehavior="preserve-pixel-size">
                  {renderSideChats(false)}
                </Panel>
              </>}
            </Group>

            {showChatSheet && (
              <div className={styles.mobileSheet} ref={chatSheetRef} role="dialog" aria-modal="true" aria-label="Twitch chats">
                {renderSideChats(false)}
              </div>
            )}

            <DragOverlay dropAnimation={{ duration: 180, easing: "ease-out" }}>
              {activeDragStream && (
                <div className={styles.dragOverlay} aria-hidden="true">
                  {activeDragPreview && <img src={activeDragPreview} alt="" referrerPolicy="no-referrer" decoding="async" />}
                  <div>
                    <span>{activeChatDrag ? "CHAT" : "LIVE"}</span>
                    <b>{activeDragStream.name}</b>
                    <small>{activeChatDrag ? "Twitch chat" : activeDragStream.category}</small>
                  </div>
                </div>
              )}
            </DragOverlay>
          </DndContext>

          <WorkspaceControls
            count={state.streams.length}
            limit={playerLimit}
            template={state.template}
            drawerOpen={state.drawerOpen}
            chatVisible={state.chatVisible}
            chatPlacement={state.chatPlacement}
            canChatBetween={chatBetweenCapable}
            allMuted={allMuted}
            allPaused={allPaused}
            isMobile={isMobile}
            mobileView={mobileView}
            onDrawer={() => {
              const open = !state.drawerOpen;
              dispatch({ type: "drawer", value: open });
              if (isMobile && open && !chatBetweenActive) dispatch({ type: "chat", visible: false });
            }}
            onChat={() => {
              const visible = !state.chatVisible;
              dispatch({ type: "chat", visible });
              if (isMobile && visible && !chatBetweenActive) dispatch({ type: "drawer", value: false });
            }}
            onChatPlacement={(placement) => {
              dispatch({ type: "chatPlacement", placement });
              announce(placement === "between" ? "Chat between streams" : "Chat on the side");
            }}
            onMobileView={(view) => {
              setMobileView(view);
              localStorage.setItem("scu-mobile-view", view);
              announce(view === "stack" ? "Vertical list on" : view === "split" ? "Side-by-side layout" : "One stream per tab");
            }}
            onTemplate={(template) => {
              dispatch({ type: "template", template });
              if (template === "focus" && mobileActiveId) dispatch({ type: "focus", id: mobileActiveId });
            }}
            onReset={() => dispatch({ type: "resetLayouts" })}
            onMuteAll={() => dispatch({ type: "muteAll", value: !allMuted })}
            onPauseAll={() => dispatch({ type: "pauseAll", value: !allPaused })}
            onLimit={(value) => {
              setPlayerLimit(value);
              localStorage.setItem("scu-player-limit", String(value));
              announce(`Player limit set to ${value}`);
            }}
          />
        </section>
      </div>
      {showSaved && <div className={styles.savedToast}><Check /> Saved “{currentWorkspaceName || nameDraft || "Untitled watchspace"}”</div>}
    </div>
  );
}
