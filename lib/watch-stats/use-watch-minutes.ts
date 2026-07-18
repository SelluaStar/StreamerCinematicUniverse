"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/auth-provider";

const LOCAL_KEY = "scu-minutes-watched";

export function useWatchMinutes() {
  const { user } = useAuth();
  const [minutes, setMinutes] = useState(0);
  const started = useRef<number | null>(null);

  useEffect(() => {
    const local = Number(localStorage.getItem(LOCAL_KEY) || 0);
    setMinutes(Number.isFinite(local) ? local : 0);
    if (!user) return;
    const supabase = createClient();
    void supabase
      .from("scu_watch_stats")
      .select("minutes_watched")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (typeof data?.minutes_watched === "number") {
          setMinutes(data.minutes_watched);
          localStorage.setItem(LOCAL_KEY, `${data.minutes_watched}`);
        }
      });
  }, [user]);

  useEffect(() => {
    started.current = Date.now();
    const tick = window.setInterval(() => {
      setMinutes((prev) => {
        const next = prev + 1;
        localStorage.setItem(LOCAL_KEY, `${next}`);
        return next;
      });
    }, 60_000);

    const flush = () => {
      if (!user || !started.current) return;
      const elapsed = Math.max(0, Math.floor((Date.now() - started.current) / 60_000));
      started.current = Date.now();
      if (!elapsed) return;
      const supabase = createClient();
      void supabase.from("scu_watch_stats").upsert({
        user_id: user.id,
        minutes_watched: Number(localStorage.getItem(LOCAL_KEY) || 0),
        updated_at: new Date().toISOString(),
      });
    };

    window.addEventListener("beforeunload", flush);
    const flushTimer = window.setInterval(flush, 5 * 60_000);
    return () => {
      window.clearInterval(tick);
      window.clearInterval(flushTimer);
      window.removeEventListener("beforeunload", flush);
      flush();
    };
  }, [user]);

  return minutes;
}
