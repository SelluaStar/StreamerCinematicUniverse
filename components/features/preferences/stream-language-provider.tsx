"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/auth-provider";
import {
  DEFAULT_STREAM_LANGUAGE,
  STREAM_LANGUAGE_STORAGE_KEY,
  STREAM_REGION_STORAGE_KEY,
  fromProfileColumns,
  normalizeStreamLanguage,
  toProfileColumns,
  type StreamLanguagePreference,
} from "@/lib/preferences/stream-language";

type StreamLanguageContextValue = {
  /** Resolved preference: "any" | "other" | ISO 639-1 code. */
  preference: StreamLanguagePreference;
  /** Persist a new preference (localStorage + profile when signed in). */
  setPreference: (value: StreamLanguagePreference) => void;
  /** True once the stored preference has been read (localStorage/profile). */
  ready: boolean;
};

const StreamLanguageContext = createContext<StreamLanguageContextValue | null>(null);

function persistLocal(value: StreamLanguagePreference) {
  try {
    const { preferred_language } = toProfileColumns(value);
    localStorage.setItem(STREAM_REGION_STORAGE_KEY, value);
    localStorage.setItem(STREAM_LANGUAGE_STORAGE_KEY, preferred_language ?? value);
  } catch {
    // Ignore storage failures (private mode, quota, etc.).
  }
}

export function StreamLanguageProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const [preference, setPreferenceState] = useState<StreamLanguagePreference>(DEFAULT_STREAM_LANGUAGE);
  const [ready, setReady] = useState(false);
  const appliedProfileFor = useRef<string | null>(null);

  // Guests (and initial paint): hydrate from localStorage.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STREAM_REGION_STORAGE_KEY);
      if (stored) setPreferenceState(normalizeStreamLanguage(stored));
    } catch {
      // Ignore.
    }
    setReady(true);
  }, []);

  // Signed-in users: the profile is the source of truth once it loads.
  useEffect(() => {
    if (!user) {
      appliedProfileFor.current = null;
      return;
    }
    if (!profile || appliedProfileFor.current === user.id) return;
    // Only override once per session load, and only if the profile actually
    // carries a preference (avoids clobbering a guest pick with a blank row).
    if (profile.region_mode || profile.preferred_language) {
      const resolved = fromProfileColumns({
        region_mode: profile.region_mode,
        preferred_language: profile.preferred_language,
      });
      setPreferenceState(resolved);
      persistLocal(resolved);
    }
    appliedProfileFor.current = user.id;
    setReady(true);
  }, [user, profile]);

  const setPreference = useCallback((value: StreamLanguagePreference) => {
    const normalized = normalizeStreamLanguage(value);
    setPreferenceState(normalized);
    persistLocal(normalized);
    if (user) {
      const columns = toProfileColumns(normalized);
      void supabase
        .from("profiles")
        .update({ ...columns, updated_at: new Date().toISOString() })
        .eq("id", user.id)
        .then(({ error }) => {
          if (error) console.error("Failed to save stream language preference", error.message);
        });
    }
  }, [supabase, user]);

  const value = useMemo<StreamLanguageContextValue>(
    () => ({ preference, setPreference, ready }),
    [preference, setPreference, ready],
  );

  return <StreamLanguageContext.Provider value={value}>{children}</StreamLanguageContext.Provider>;
}

export function useStreamLanguage() {
  const ctx = useContext(StreamLanguageContext);
  if (!ctx) throw new Error("useStreamLanguage must be used within StreamLanguageProvider");
  return ctx;
}
