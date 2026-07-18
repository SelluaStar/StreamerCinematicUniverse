"use client";

import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Group, Panel, Separator, type Layout } from "react-resizable-panels";
import { PlayerPane } from "@/components/features/multistream/player-pane";
import type { LayoutNode, WorkspaceState } from "@/components/features/multistream/use-workspace";
import styles from "./multistream.module.css";

interface SplitLayoutProps {
  tree: LayoutNode | null;
  state: WorkspaceState;
  mobileActiveId?: string;
  mobileStack?: boolean;
  /** When true with exactly two streams, render chat in the middle column. */
  chatBetween?: boolean;
  chatNode?: ReactNode;
  onState: (action: {
    type: "muted" | "paused" | "volume" | "captions";
    id: string;
    value: boolean | number;
  }) => void;
  onRemove: (id: string) => void;
  onFocus: (id?: string) => void;
  onLayout: (id: string, layout: Layout) => void;
}

/**
 * Layout shells (resizable splits / tabs) are separate from players.
 * Players portal into slot elements (or a park while slots remount) so removing a stream
 * does not tear down remaining Twitch embeds.
 */
export function SplitLayout(props: SplitLayoutProps) {
  const slotsRef = useRef<Map<string, HTMLElement>>(new Map());
  const [parkEl, setParkEl] = useState<HTMLDivElement | null>(null);
  const [, bump] = useState(0);

  // Mutate only — never setState here. Inline ref callbacks change identity every render;
  // bumping from them causes null→el→bump→re-render loops.
  const setSlot = useCallback((id: string, el: HTMLElement | null) => {
    const map = slotsRef.current;
    if (el) {
      if (map.get(id) === el) return;
      map.set(id, el);
      return;
    }
    if (!map.has(id)) return;
    map.delete(id);
  }, []);

  const streamKey = props.state.streams.map((stream) => stream.id).join("\0");
  const chatBetween = Boolean(props.chatBetween && props.state.streams.length === 2 && props.chatNode);
  const shellKey = props.mobileStack
    ? `stack:${streamKey}`
    : props.mobileActiveId
      ? `tabs:${props.mobileActiveId}:${streamKey}`
      : chatBetween
        ? `between:${props.state.rootOrientation ?? "horizontal"}:${streamKey}`
        : `tree:${props.state.template}:${props.state.focusedId ?? ""}:${props.state.rootOrientation ?? ""}:${streamKey}`;

  // After the shell commits, refs have populated slotsRef — one re-render moves portals into place.
  useLayoutEffect(() => {
    bump((value) => value + 1);
  }, [shellKey]);

  if (!props.tree) return null;

  let shell: React.ReactNode;
  if (props.mobileStack) {
    shell = (
      <div className={styles.verticalStack} aria-label="Vertical stream list">
        {props.state.streams.map((stream) => (
          <PaneSlot key={stream.id} id={stream.id} className={styles.paneSlot} setSlot={setSlot} />
        ))}
      </div>
    );
  } else if (props.mobileActiveId) {
    shell = (
      <>
        {props.state.streams.map((stream) => {
          const active = stream.id === props.mobileActiveId;
          return (
            <PaneSlot
              key={stream.id}
              id={stream.id}
              className={active ? styles.paneSlot : styles.paneSlotParked}
              setSlot={setSlot}
              aria-hidden={!active}
            />
          );
        })}
      </>
    );
  } else if (chatBetween) {
    const [first, second] = props.state.streams;
    const orientation = props.state.rootOrientation || "horizontal";
    const groupId = `chat-between-${orientation}-${first.id}~${second.id}`;
    const defaultLayout = props.state.layouts[groupId] || (
      orientation === "horizontal"
        ? { [`${groupId}-first`]: 38, [`${groupId}-chat`]: 24, [`${groupId}-second`]: 38 }
        : { [`${groupId}-first`]: 36, [`${groupId}-chat`]: 28, [`${groupId}-second`]: 36 }
    );
    shell = (
      <Group
        id={groupId}
        orientation={orientation}
        className={styles.panelGroup}
        defaultLayout={defaultLayout}
        onLayoutChanged={(layout, meta) => { if (meta.isUserInteraction) props.onLayout(groupId, layout); }}
      >
        <Panel id={`${groupId}-first`} minSize="18%">
          <PaneSlot id={first.id} className={styles.paneSlot} setSlot={setSlot} />
        </Panel>
        <Separator className={`${styles.resizeHandle} ${orientation === "vertical" ? styles.horizontalResizeHandle : styles.verticalResizeHandle}`}>
          <span />
        </Separator>
        <Panel id={`${groupId}-chat`} minSize="16%" maxSize="42%" className={styles.chatBetweenPanel}>
          {props.chatNode}
        </Panel>
        <Separator className={`${styles.resizeHandle} ${orientation === "vertical" ? styles.horizontalResizeHandle : styles.verticalResizeHandle}`}>
          <span />
        </Separator>
        <Panel id={`${groupId}-second`} minSize="18%">
          <PaneSlot id={second.id} className={styles.paneSlot} setSlot={setSlot} />
        </Panel>
      </Group>
    );
  } else {
    shell = <Node node={props.tree} setSlot={setSlot} state={props.state} onLayout={props.onLayout} />;
  }

  return (
    <>
      {shell}
      <div ref={setParkEl} className={styles.playerPark} aria-hidden="true" />
      {props.state.streams.map((stream) => {
        const target = slotsRef.current.get(stream.id) || parkEl;
        if (!target) return null;
        return createPortal(
          <PlayerPane
            stream={stream}
            muted={Boolean(props.state.muted[stream.id])}
            paused={Boolean(props.state.paused[stream.id])}
            volume={props.state.volume[stream.id] ?? 0.7}
            captions={Boolean(props.state.captions[stream.id])}
            focused={props.state.template === "focus" && props.state.focusedId === stream.id}
            onMuted={(value) => props.onState({ type: "muted", id: stream.id, value })}
            onPaused={(value) => props.onState({ type: "paused", id: stream.id, value })}
            onVolume={(value) => props.onState({ type: "volume", id: stream.id, value })}
            onCaptions={(value) => props.onState({ type: "captions", id: stream.id, value })}
            onRemove={() => props.onRemove(stream.id)}
            onFocus={() => props.onFocus(props.state.template === "focus" && props.state.focusedId === stream.id ? undefined : stream.id)}
          />,
          target,
          stream.id,
        );
      })}
    </>
  );
}

/** Stable ref callback so parent re-renders do not detach/reattach the slot. */
function PaneSlot({
  id,
  className,
  setSlot,
  "aria-hidden": ariaHidden,
}: {
  id: string;
  className: string;
  setSlot: (id: string, el: HTMLElement | null) => void;
  "aria-hidden"?: boolean;
}) {
  const setSlotRef = useRef(setSlot);
  setSlotRef.current = setSlot;
  const idRef = useRef(id);
  idRef.current = id;

  const ref = useCallback((el: HTMLElement | null) => {
    setSlotRef.current(idRef.current, el);
  }, []);

  return <div className={className} ref={ref} aria-hidden={ariaHidden} />;
}

function Node({
  node,
  setSlot,
  state,
  onLayout,
}: {
  node: LayoutNode;
  setSlot: (id: string, el: HTMLElement | null) => void;
  state: WorkspaceState;
  onLayout: (id: string, layout: Layout) => void;
}) {
  if (node.type === "pane") {
    return <PaneSlot id={node.streamId} className={styles.paneSlot} setSlot={setSlot} />;
  }
  const countPanes = (value: LayoutNode): number => (value.type === "pane" ? 1 : countPanes(value.first) + countPanes(value.second));
  const firstSize = state.template === "equal"
    ? (countPanes(node.first) / countPanes(node)) * 100
    : 50;
  const defaultLayout = state.layouts[node.id] || {
    [`${node.id}-first`]: firstSize,
    [`${node.id}-second`]: 100 - firstSize,
  };
  return (
    <Group
      id={node.id}
      orientation={node.orientation}
      className={styles.panelGroup}
      defaultLayout={defaultLayout}
      onLayoutChanged={(layout, meta) => { if (meta.isUserInteraction) onLayout(node.id, layout); }}
    >
      <Panel id={`${node.id}-first`} minSize="20%">
        <Node node={node.first} setSlot={setSlot} state={state} onLayout={onLayout} />
      </Panel>
      <Separator className={`${styles.resizeHandle} ${node.orientation === "vertical" ? styles.horizontalResizeHandle : styles.verticalResizeHandle}`}>
        <span />
      </Separator>
      <Panel id={`${node.id}-second`} minSize="20%">
        <Node node={node.second} setSlot={setSlot} state={state} onLayout={onLayout} />
      </Panel>
    </Group>
  );
}
