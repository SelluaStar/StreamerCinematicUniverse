"use client";

import { Columns2, Grid2X2, LayoutPanelTop, List, MessageSquareText, Minimize2, PanelLeft, PanelRight, Pause, Play, RotateCcw, Scan, Square, Volume2, VolumeX } from "lucide-react";
import type { ChatPlacement, LayoutTemplate } from "@/components/features/multistream/use-workspace";
import { SelectMenu } from "@/components/ui/select-menu";
import styles from "./multistream.module.css";

export type MobileViewMode = "tabs" | "stack" | "split";

export function WorkspaceControls({
  count,
  limit,
  template,
  drawerOpen,
  chatVisible,
  chatPlacement,
  canChatBetween,
  allMuted,
  allPaused,
  isMobile,
  mobileView,
  onDrawer,
  onChat,
  onChatPlacement,
  onTemplate,
  onMobileView,
  onReset,
  onMuteAll,
  onPauseAll,
  onLimit,
}: {
  count: number;
  limit: number;
  template: LayoutTemplate;
  drawerOpen: boolean;
  chatVisible: boolean;
  chatPlacement?: ChatPlacement;
  canChatBetween?: boolean;
  allMuted: boolean;
  allPaused: boolean;
  isMobile?: boolean;
  mobileView?: MobileViewMode;
  onDrawer: () => void;
  onChat: () => void;
  onChatPlacement?: (placement: ChatPlacement) => void;
  onTemplate: (template: LayoutTemplate) => void;
  onMobileView?: (view: MobileViewMode) => void;
  onReset: () => void;
  onMuteAll: () => void;
  onPauseAll: () => void;
  onLimit: (limit: number) => void;
}) {
  return (
    <footer className={styles.workspaceControls}>
      <div className={styles.controlGroup}>
        <button onClick={onDrawer} aria-pressed={drawerOpen}><PanelLeft /> <span>Streams</span></button>
        <strong>{count}/</strong>
        <label className={styles.limitControl}>
          <span className="sr-only">Max simultaneous streams</span>
          <SelectMenu
            ariaLabel="Max simultaneous streams"
            value={String(limit)}
            onChange={(next) => onLimit(Number(next))}
            options={[{ value: "2", label: "2" }, { value: "4", label: "4" }, { value: "6", label: "6" }]}
            size="sm"
            triggerClassName={styles.limitTrigger}
          />
        </label>
      </div>
      {isMobile && onMobileView && (
        <div className={`${styles.controlGroup} ${styles.mobileViewGroup}`} aria-label="Mobile view">
          <button aria-pressed={mobileView === "split"} onClick={() => onMobileView("split")} aria-label="Side by side streams">
            <Columns2 /><span>Split</span>
          </button>
          <button aria-pressed={mobileView === "tabs"} onClick={() => onMobileView("tabs")} aria-label="One stream per tab">
            <Square /><span>1-up</span>
          </button>
          <button aria-pressed={mobileView === "stack"} onClick={() => onMobileView("stack")} aria-label="Vertical stream list">
            <List /><span>List</span>
          </button>
        </div>
      )}
      <div className={`${styles.controlGroup} ${isMobile ? styles.hideOnMobileTabs : ""}`} aria-label="Layout">
        <button aria-pressed={template === "auto"} onClick={() => onTemplate("auto")}><LayoutPanelTop /><span>Smart</span></button>
        <button aria-pressed={template === "equal"} onClick={() => onTemplate("equal")}><Grid2X2 /><span>Equal</span></button>
        <button aria-pressed={template === "focus"} aria-label={template === "focus" ? "Exit focus layout" : "Focus layout"} onClick={() => onTemplate(template === "focus" ? "auto" : "focus")}>{template === "focus" ? <Minimize2 /> : <Scan />}<span>{template === "focus" ? "Exit focus" : "Focus"}</span></button>
        <button onClick={onReset} aria-label="Reset split sizes"><RotateCcw /></button>
      </div>
      <div className={styles.controlGroup}>
        <button onClick={onMuteAll}>{allMuted ? <Volume2 /> : <VolumeX />}<span>{allMuted ? "Unmute all" : "Mute all"}</span></button>
        <button onClick={onPauseAll}>{allPaused ? <Play /> : <Pause />}<span>{allPaused ? "Play all" : "Pause all"}</span></button>
        <button onClick={onChat} aria-pressed={chatVisible}><MessageSquareText /><span>Chat</span></button>
        {canChatBetween && chatVisible && onChatPlacement && (
          <button
            onClick={() => onChatPlacement(chatPlacement === "between" ? "side" : "between")}
            aria-pressed={chatPlacement === "between"}
            aria-label={chatPlacement === "between" ? "Move chat to side" : "Move chat between streams"}
          >
            {chatPlacement === "between" ? <PanelRight /> : <Columns2 />}
            <span>{chatPlacement === "between" ? "Chat side" : "Chat mid"}</span>
          </button>
        )}
      </div>
    </footer>
  );
}
