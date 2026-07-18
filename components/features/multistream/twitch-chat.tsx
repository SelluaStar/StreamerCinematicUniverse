"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useDroppable, type DraggableAttributes, type DraggableSyntheticListeners } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Columns2, GripVertical, MessageSquareText, PanelRight, Plus, X } from "lucide-react";
import type { Streamer } from "@/lib/data";
import {
  CHAT_DOCK_DROP_ID,
  chatDragId,
  chatPanelDropId,
  type ChatPlacement,
} from "@/components/features/multistream/use-workspace";
import { getTwitchEmbedParentQuery } from "@/lib/twitch/embed-parents";
import { SelectMenu } from "@/components/ui/select-menu";
import styles from "./multistream.module.css";

export function TwitchChat({
  panelId,
  streams,
  chatStreamIds,
  occupiedChatIds,
  chatPlacement,
  canChatBetween,
  compact,
  tileSortable,
  onAdd,
  onRemove,
  onHide,
  onChatPlacement,
}: {
  panelId: string;
  streams: Streamer[];
  /** Chats stacked in this panel. */
  chatStreamIds: string[];
  /** All open chats across panels — used to hide already-open options in Add. */
  occupiedChatIds?: string[];
  chatPlacement?: ChatPlacement;
  canChatBetween?: boolean;
  /** Narrow middle-column / inline styling. */
  compact?: boolean;
  /** When true, the panel shell can be reordered among canvas tiles. */
  tileSortable?: boolean;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  onHide: () => void;
  onChatPlacement?: (placement: ChatPlacement) => void;
}) {
  const twitchStreams = streams.filter((stream) => stream.platform === "Twitch");
  const openChats = useMemo(
    () => chatStreamIds
      .map((id) => twitchStreams.find((stream) => stream.id === id))
      .filter((stream): stream is Streamer => Boolean(stream)),
    [chatStreamIds, twitchStreams],
  );
  const taken = new Set(occupiedChatIds ?? chatStreamIds);
  const addable = twitchStreams.filter((stream) => !taken.has(stream.id));
  const [embed, setEmbed] = useState({ parentQuery: "parent=localhost", dark: false });

  useEffect(() => {
    const update = () => setEmbed({
      parentQuery: getTwitchEmbedParentQuery(),
      dark: document.documentElement.dataset.theme !== "light",
    });
    queueMicrotask(update);
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  const placementToggle = canChatBetween && onChatPlacement ? (
    <button
      type="button"
      onClick={() => onChatPlacement(chatPlacement === "between" ? "side" : "between")}
      aria-pressed={chatPlacement === "between"}
      aria-label={chatPlacement === "between" ? "Move chat to side" : "Move chat between streams"}
      title={chatPlacement === "between" ? "Move chat to side" : "Move chat between streams"}
    >
      {chatPlacement === "between" ? <PanelRight size={16} /> : <Columns2 size={16} />}
    </button>
  ) : null;

  if (!twitchStreams.length) {
    return (
      <aside className={`${styles.chatPanel} ${compact ? styles.chatPanelCompact : ""}`}>
        <div className={styles.emptyChat}><MessageSquareText /><b>No Twitch chat available</b><span>Add a Twitch channel to open chat.</span></div>
      </aside>
    );
  }

  const bodyProps = {
    panelId,
    openChats,
    addable,
    embed,
    placementToggle,
    onAdd,
    onRemove,
    onHide,
  };

  if (tileSortable) {
    return (
      <SortableChatShell panelId={panelId} compact={compact}>
        {(tileHandle) => <ChatPanelBody {...bodyProps} tileHandle={tileHandle} />}
      </SortableChatShell>
    );
  }

  return (
    <DroppableChatShell panelId={panelId} compact={compact}>
      <ChatPanelBody {...bodyProps} />
    </DroppableChatShell>
  );
}

function DroppableChatShell({
  panelId,
  compact,
  children,
}: {
  panelId: string;
  compact?: boolean;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: chatPanelDropId(panelId) });
  return (
    <aside
      ref={setNodeRef}
      className={`${styles.chatPanel} ${compact ? styles.chatPanelCompact : ""} ${isOver ? styles.chatPanelDropOver : ""}`}
      aria-label="Twitch chats"
      data-chat-panel={panelId}
    >
      {children}
    </aside>
  );
}

function SortableChatShell({
  panelId,
  compact,
  children,
}: {
  panelId: string;
  compact?: boolean;
  children: (tileHandle: { attributes: DraggableAttributes; listeners: DraggableSyntheticListeners }) => ReactNode;
}) {
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: chatPanelDropId(panelId) });
  const tile = useSortable({
    id: panelId,
    animateLayoutChanges: () => false,
  });
  const setRef = (el: HTMLElement | null) => {
    setDropRef(el);
    tile.setNodeRef(el);
  };
  return (
    <aside
      ref={setRef}
      className={`${styles.chatPanel} ${compact ? styles.chatPanelCompact : ""} ${isOver ? styles.chatPanelDropOver : ""} ${tile.isDragging ? styles.chatPaneDragging : ""}`}
      style={tile.isDragging ? { opacity: 0.35, transition: tile.transition } : undefined}
      aria-label="Twitch chats"
      data-chat-panel={panelId}
    >
      {children({ attributes: tile.attributes, listeners: tile.listeners })}
    </aside>
  );
}

function ChatPanelBody({
  panelId,
  openChats,
  addable,
  embed,
  placementToggle,
  tileHandle,
  onAdd,
  onRemove,
  onHide,
}: {
  panelId: string;
  openChats: Streamer[];
  addable: Streamer[];
  embed: { parentQuery: string; dark: boolean };
  placementToggle: ReactNode;
  tileHandle?: { attributes: DraggableAttributes; listeners: DraggableSyntheticListeners };
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  onHide: () => void;
}) {
  if (!openChats.length) {
    return (
      <>
        <div className={styles.chatColumnHeader}>
          <span>Chats</span>
          <div className={styles.chatColumnActions}>
            {placementToggle}
            <button type="button" onClick={onHide} aria-label="Hide chat"><X size={18} /></button>
          </div>
        </div>
        <div className={styles.emptyChat}>
          <MessageSquareText />
          <b>No chats open</b>
          <span>Add a channel chat below.</span>
        </div>
        {addable.length > 0 && (
          <div className={styles.chatAddRow}>
            <SelectMenu
              ariaLabel="Add Twitch chat"
              value=""
              placeholder="Add chat…"
              onChange={onAdd}
              options={addable.map((stream) => ({ value: stream.id, label: stream.name }))}
              triggerClassName={styles.chatSelectTrigger}
              size="sm"
              fullWidth
            />
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <div className={styles.chatColumnHeader}>
        {tileHandle && (
          <button type="button" className={styles.chatDragHandle} {...tileHandle.attributes} {...tileHandle.listeners} aria-label="Move chat panel">
            <GripVertical size={16} />
          </button>
        )}
        <span>Chats</span>
        <strong>{openChats.length}</strong>
        <div className={styles.chatColumnActions}>
          {placementToggle}
          <button type="button" onClick={onHide} aria-label="Hide chat"><X size={18} /></button>
        </div>
      </div>

      <SortableContext items={openChats.map((stream) => chatDragId(panelId, stream.id))} strategy={verticalListSortingStrategy}>
        <div className={styles.chatStack}>
          {openChats.map((stream) => (
            <SortableChatPane
              key={stream.id}
              panelId={panelId}
              stream={stream}
              parentQuery={embed.parentQuery}
              dark={embed.dark}
              onRemove={() => onRemove(stream.id)}
            />
          ))}
        </div>
      </SortableContext>

      {addable.length > 0 && (
        <div className={styles.chatAddRow}>
          <Plus size={14} aria-hidden="true" />
          <SelectMenu
            ariaLabel="Add Twitch chat"
            value=""
            placeholder="Add chat…"
            onChange={onAdd}
            options={addable.map((stream) => ({ value: stream.id, label: stream.name }))}
            triggerClassName={styles.chatSelectTrigger}
            size="sm"
            fullWidth
          />
        </div>
      )}
    </>
  );
}

function SortableChatPane({
  panelId,
  stream,
  parentQuery,
  dark,
  onRemove,
}: {
  panelId: string;
  stream: Streamer;
  parentQuery: string;
  dark: boolean;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transition, isDragging } = useSortable({
    id: chatDragId(panelId, stream.id),
    animateLayoutChanges: () => false,
    data: { type: "chat", panelId, streamId: stream.id },
  });
  const channel = stream.login || stream.handle;
  const src = `https://www.twitch.tv/embed/${encodeURIComponent(channel)}/chat?${parentQuery}${dark ? "&darkpopout" : ""}`;

  return (
    <section
      ref={setNodeRef}
      className={`${styles.chatPane} ${isDragging ? styles.chatPaneDragging : ""}`}
      style={isDragging ? { opacity: 0.35, transition } : undefined}
      aria-label={`${stream.name} chat`}
    >
      <div className={styles.chatHeader}>
        <button type="button" className={styles.chatDragHandle} {...attributes} {...listeners} aria-label={`Move ${stream.name} chat`}>
          <GripVertical size={16} />
        </button>
        <span className={styles.chatPaneName}>{stream.name}</span>
        <button type="button" onClick={onRemove} aria-label={`Close ${stream.name} chat`}><X size={16} /></button>
      </div>
      <iframe
        title={`${stream.name} Twitch chat`}
        src={src}
        className={styles.chatFrame}
        sandbox="allow-storage-access-by-user-activation allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals"
      />
    </section>
  );
}

/** Drop target for creating / docking a chat panel in the side column. */
export function ChatSideDock({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: CHAT_DOCK_DROP_ID });
  return (
    <div ref={setNodeRef} className={`${className || ""} ${isOver ? styles.chatDockDropOver : ""}`.trim()}>
      {children}
    </div>
  );
}
