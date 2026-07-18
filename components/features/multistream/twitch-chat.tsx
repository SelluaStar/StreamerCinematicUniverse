"use client";

import { useEffect, useMemo, useState } from "react";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Columns2, GripVertical, MessageSquareText, PanelRight, Plus, X } from "lucide-react";
import type { Streamer } from "@/lib/data";
import type { ChatPlacement } from "@/components/features/multistream/use-workspace";
import { getTwitchEmbedParentQuery } from "@/lib/twitch/embed-parents";
import { SelectMenu } from "@/components/ui/select-menu";
import styles from "./multistream.module.css";

export function TwitchChat({
  streams,
  chatStreamIds,
  chatPlacement,
  canChatBetween,
  compact,
  onAdd,
  onRemove,
  onReorder,
  onHide,
  onChatPlacement,
}: {
  streams: Streamer[];
  chatStreamIds: string[];
  chatPlacement?: ChatPlacement;
  canChatBetween?: boolean;
  /** Narrow middle-column styling. */
  compact?: boolean;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  onReorder: (activeId: string, overId: string) => void;
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
  const addable = twitchStreams.filter((stream) => !chatStreamIds.includes(stream.id));
  const [embed, setEmbed] = useState({ parentQuery: "parent=localhost", dark: false });
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

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

  if (!openChats.length) {
    return (
      <aside className={`${styles.chatPanel} ${compact ? styles.chatPanelCompact : ""}`} aria-label="Twitch chats">
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
      </aside>
    );
  }

  const dragEnded = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    onReorder(String(active.id), String(over.id));
  };

  return (
    <aside className={`${styles.chatPanel} ${compact ? styles.chatPanelCompact : ""}`} aria-label="Twitch chats">
      <div className={styles.chatColumnHeader}>
        <span>Chats</span>
        <strong>{openChats.length}</strong>
        <div className={styles.chatColumnActions}>
          {placementToggle}
          <button type="button" onClick={onHide} aria-label="Hide chat"><X size={18} /></button>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={dragEnded}>
        <SortableContext items={openChats.map((stream) => stream.id)} strategy={verticalListSortingStrategy}>
          <div className={styles.chatStack}>
            {openChats.map((stream) => (
              <SortableChatPane
                key={stream.id}
                stream={stream}
                parentQuery={embed.parentQuery}
                dark={embed.dark}
                onRemove={() => onRemove(stream.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

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
    </aside>
  );
}

function SortableChatPane({
  stream,
  parentQuery,
  dark,
  onRemove,
}: {
  stream: Streamer;
  parentQuery: string;
  dark: boolean;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transition, isDragging } = useSortable({
    id: stream.id,
    animateLayoutChanges: () => false,
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
        <button type="button" className={styles.chatDragHandle} {...attributes} {...listeners} aria-label={`Reorder ${stream.name} chat`}>
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
