"use client";

import { useState } from "react";
import type { Streamer } from "@/lib/data";
import styles from "./multistream.module.css";

/** Twitch CDN avatars often fail without no-referrer; fall back to initials when the image errors. */
export function StreamAvatar({
  stream,
  className,
  size = 38,
}: {
  stream: Pick<Streamer, "name" | "initials" | "color" | "profileImageUrl">;
  className?: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(stream.profileImageUrl) && !failed;

  if (showImage) {
    return (
      <img
        className={className}
        src={stream.profileImageUrl}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <span className={`${styles.avatarFallback} ${className || ""}`} style={{ background: stream.color, width: size, height: size }} aria-hidden="true">
      {stream.initials || stream.name.slice(0, 2).toUpperCase()}
    </span>
  );
}
