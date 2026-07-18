"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { Captions, GripVertical, Maximize2, Minimize2, Pause, Play, RotateCw, Scan, Volume2, VolumeX, X } from "lucide-react";
import type { Streamer } from "@/lib/data";
import { TwitchPlayer, type TwitchPlayerHandle } from "@/components/features/player/twitch-player";
import { SelectMenu } from "@/components/ui/select-menu";
import styles from "./multistream.module.css";

export function PlayerPane({
  stream,
  muted,
  paused,
  volume,
  captions,
  focused,
  onMuted,
  onPaused,
  onVolume,
  onCaptions,
  onRemove,
  onFocus,
}: {
  stream: Streamer;
  muted: boolean;
  paused: boolean;
  volume: number;
  captions: boolean;
  focused: boolean;
  onMuted: (value: boolean) => void;
  onPaused: (value: boolean) => void;
  onVolume: (value: number) => void;
  onCaptions: (value: boolean) => void;
  onRemove: () => void;
  onFocus: () => void;
}) {
  const playerRef = useRef<TwitchPlayerHandle>(null);
  const [ready, setReady] = useState(false);
  const [online, setOnline] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const [playerKey, setPlayerKey] = useState(0);
  const [qualities, setQualities] = useState<Array<{ group: string; name: string }>>([]);
  const [quality, setQuality] = useState("auto");
  const { attributes, listeners, setNodeRef, transition, isDragging } = useSortable({
    id: stream.id,
    animateLayoutChanges: () => false,
  });
  const onlineChanged = useCallback((value: boolean) => setOnline(value), []);
  const blockedPlayback = useCallback(() => setBlocked(true), []);
  const readyPlayer = useCallback(() => {
    setReady(true);
    setBlocked(false);
    setQualities(playerRef.current?.getQualities() || []);
  }, []);

  const syncMutedFromEmbed = useCallback((value: boolean) => {
    if (value !== muted) onMuted(value);
  }, [muted, onMuted]);

  const toggleMuted = () => {
    // Prefer live embed state so a Twitch-native mute still toggles correctly in one click.
    let currentlyMuted = muted;
    try {
      currentlyMuted = playerRef.current?.getMuted() ?? muted;
    } catch {
      currentlyMuted = muted;
    }
    const next = !currentlyMuted;
    const level = next ? volume : Math.max(volume, 0.05);
    playerRef.current?.applyAudio(next, level);
    onMuted(next);
    if (!next && volume < 0.05) onVolume(level);
  };

  const channel = stream.login || stream.handle;
  useEffect(() => {
    setReady(false);
    setBlocked(false);
    setOnline(true);
    setQuality("auto");
    setQualities([]);
  }, [channel, playerKey]);

  return (
    <article
      ref={setNodeRef}
      className={`${styles.playerPane} ${isDragging ? styles.dragging : ""}`}
      style={isDragging ? { opacity: 0.2, transition } : undefined}
      aria-label={`${stream.name} stream`}
    >
      {stream.platform === "Twitch" ? (
        <TwitchPlayer
          key={`${channel}-${playerKey}`}
          ref={playerRef}
          channel={channel}
          muted={muted}
          paused={paused}
          volume={volume}
          captions={captions}
          onReady={readyPlayer}
          onOnlineChange={onlineChanged}
          onBlocked={blockedPlayback}
          onMutedChange={syncMutedFromEmbed}
        />
      ) : (
        <div className={styles.unsupported}>
          <b>{stream.platform} isn’t embedded yet</b>
          <span>Twitch channels play here. {stream.platform} support is next.</span>
        </div>
      )}

      <div className={styles.paneTop}>
        <button className={styles.dragHandle} {...attributes} {...listeners} aria-label={`Reorder ${stream.name}`}><GripVertical size={17} /></button>
        <span className={styles.liveBadge}>{online ? "LIVE" : "OFFLINE"}</span>
        <span className={styles.paneName}>{stream.name}</span>
        <button onClick={onRemove} aria-label={`Remove ${stream.name}`}><X size={17} /></button>
      </div>

      {blocked && <button className={styles.blocked} onClick={() => { setBlocked(false); onPaused(false); playerRef.current?.play(); }}><Play fill="currentColor" /> Click to start playback</button>}
      {!ready && <div className={styles.playerLoading}><span />Connecting to Twitch…</div>}

      <div className={styles.paneControls}>
        <div>
          <button onClick={() => onPaused(!paused)} aria-label={paused ? "Play stream" : "Pause stream"}>{paused ? <Play fill="currentColor" /> : <Pause fill="currentColor" />}</button>
          <div className={styles.audioControl}>
            <button onClick={toggleMuted} aria-label={muted ? "Unmute stream" : "Mute stream"}>{muted ? <VolumeX /> : <Volume2 />}</button>
            <label className={styles.volumeControl}>
              <span className="sr-only">Volume for {stream.name}</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={muted ? 0 : volume}
                style={{ "--volume-level": `${(muted ? 0 : volume) * 100}%` } as React.CSSProperties}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  const nextMuted = value <= 0;
                  playerRef.current?.applyAudio(nextMuted, nextMuted ? volume : value);
                  onVolume(value);
                  if (muted !== nextMuted) onMuted(nextMuted);
                }}
              />
              <output>{Math.round((muted ? 0 : volume) * 100)}%</output>
            </label>
          </div>
        </div>
        <div>
          <button className={captions ? styles.activeControl : ""} onClick={() => onCaptions(!captions)} aria-pressed={captions} aria-label="Toggle captions"><Captions /></button>
          <label className={styles.qualityControl}>
            <span className="sr-only">Video quality</span>
            <SelectMenu
              ariaLabel="Video quality"
              value={quality}
              onChange={(next) => { setQuality(next); playerRef.current?.setQuality(next); }}
              options={[{ value: "auto", label: "Auto" }, ...qualities.filter((item) => item.group !== "auto").map((item) => ({ value: item.group, label: item.name }))]}
              size="sm"
              triggerClassName={styles.qualityTrigger}
            />
          </label>
          <button onClick={() => { setReady(false); setPlayerKey((value) => value + 1); }} aria-label="Reload player"><RotateCw /></button>
          <button className={focused ? styles.activeControl : ""} onClick={onFocus} aria-pressed={focused} aria-label={focused ? `Exit focus for ${stream.name}` : `Focus ${stream.name}`}>{focused ? <Minimize2 /> : <Scan />}</button>
          <button onClick={() => void playerRef.current?.requestFullscreen()} aria-label={`Fullscreen ${stream.name}`}><Maximize2 /></button>
        </div>
      </div>
    </article>
  );
}
