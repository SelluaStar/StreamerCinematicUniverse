"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { ScuFollow, ScuProfile } from "@/lib/auth/types";
import { hydrateSavedEventsFromCloud } from "@/lib/saved-events";
import { hydrateWatchspacesFromCloud } from "@/lib/multistream/saved-workspaces";
import { prefsFromProfile, writeLocalAccountPrefs } from "@/lib/preferences/account-prefs";

type AuthContextValue = {
  ready: boolean;
  session: Session | null;
  user: User | null;
  profile: ScuProfile | null;
  follows: ScuFollow[];
  refreshProfile: () => Promise<ScuProfile | null>;
  refreshFollows: () => Promise<ScuFollow[]>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ScuProfile | null>(null);
  const [follows, setFollows] = useState<ScuFollow[]>([]);

  const refreshProfile = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setProfile(null);
      return null;
    }
    const { data, error } = await supabase.from("profiles").select("*").eq("id", auth.user.id).maybeSingle();
    if (error) {
      console.error("Failed to load profile", error.message);
      setProfile(null);
      return null;
    }
    const next = (data as ScuProfile | null) ?? null;
    setProfile(next);
    if (next) writeLocalAccountPrefs(prefsFromProfile(next));
    return next;
  }, [supabase]);

  const refreshFollows = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setFollows([]);
      return [];
    }
    const { data, error } = await supabase
      .from("follows")
      .select("*")
      .eq("follower_id", auth.user.id)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Failed to load follows", error.message);
      setFollows([]);
      return [];
    }
    const next = (data as ScuFollow[]) ?? [];
    setFollows(next);
    return next;
  }, [supabase]);

  useEffect(() => {
    let active = true;
    const sync = async (nextSession: Session | null) => {
      if (!active) return;
      setSession(nextSession);
      if (!nextSession) {
        setProfile(null);
        setFollows([]);
        setReady(true);
        return;
      }
      await Promise.all([
        refreshProfile(),
        refreshFollows(),
        hydrateSavedEventsFromCloud(),
        hydrateWatchspacesFromCloud(),
      ]);
      if (active) setReady(true);
    };

    supabase.auth.getSession().then(({ data }) => sync(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void sync(nextSession);
    });

    const onFollowsChanged = () => {
      void refreshFollows();
    };
    window.addEventListener("scu:follows-changed", onFollowsChanged);

    return () => {
      active = false;
      sub.subscription.unsubscribe();
      window.removeEventListener("scu:follows-changed", onFollowsChanged);
    };
  }, [supabase, refreshProfile, refreshFollows]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setFollows([]);
  }, [supabase]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ready,
      session,
      user: session?.user ?? null,
      profile,
      follows,
      refreshProfile,
      refreshFollows,
      signOut,
    }),
    [ready, session, profile, follows, refreshProfile, refreshFollows, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
