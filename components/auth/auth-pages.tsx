"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { USERNAME_PATTERN, normalizeUsername } from "@/lib/auth/types";
import { useAuth } from "@/components/auth/auth-provider";
import { useStreamLanguage } from "@/components/features/preferences/stream-language-provider";
import {
  DEFAULT_STREAM_LANGUAGE,
  STREAM_LANGUAGE_OPTIONS,
  fromProfileColumns,
  normalizeStreamLanguage,
  toProfileColumns,
} from "@/lib/preferences/stream-language";
import type { ScuProfile } from "@/lib/auth/types";
import type { User } from "@supabase/supabase-js";
import { SelectMenu } from "@/components/ui/select-menu";

function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="auth-page">
      <div className="auth-art">
        <Link href="/" className="brand">
          <span className="brand-mark">
            <span />
          </span>
          <span>
            <b>SCU</b>
            <small>Streamer universe</small>
          </span>
        </Link>
        <div>
          <span className="eyebrow">Your front row seat</span>
          <h1>
            Every stream.
            <br />
            Every moment.
            <br />
            <em>One universe.</em>
          </h1>
          <p>Follow the people, events, and live moments shaping creator culture.</p>
        </div>
        <div className="auth-quote">“Finally, a home page for the entire streaming world.”</div>
      </div>
      <main className="auth-form">
        <div>
          <span className="auth-icon">
            <Sparkles />
          </span>
          <h2>{title}</h2>
          <p>{subtitle}</p>
          {children}
        </div>
      </main>
    </div>
  );
}

export function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";
  const supabase = useMemo(() => createClient(), []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const signInWithPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      setError("Signed in, but profile could not be loaded.");
      return;
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", authData.user.id)
      .maybeSingle();
    router.push(profile?.onboarding_completed ? next : "/onboarding");
    router.refresh();
  };

  const signInWithGoogle = async () => {
    setError("");
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (oauthError) setError(oauthError.message);
  };

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to sync your profile, follows, and connected accounts.">
      {searchParams.get("error") && <p className="auth-error">Sign-in could not be completed. Try again.</p>}
      {error && <p className="auth-error">{error}</p>}
      <form className="auth-fields" onSubmit={signInWithPassword}>
        <label>
          <span>Email</span>
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          <span>Password</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button className="button primary full" type="submit" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <button className="provider-button google" type="button" onClick={() => void signInWithGoogle()}>
        <b>G</b> Continue with Google
      </button>
      <div className="auth-divider">
        <span>new here?</span>
      </div>
      <Link href={`/signup?next=${encodeURIComponent(next)}`} className="button secondary full">
        Create an account
      </Link>
      <Link href="/" className="button ghost full">
        Continue as guest
      </Link>
    </AuthShell>
  );
}

export function SignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";
  const supabase = useMemo(() => createClient(), []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const signUp = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/onboarding")}`,
      },
    });
    setLoading(false);
    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    if (data.session) {
      router.push("/onboarding");
      router.refresh();
      return;
    }
    setError("Check your email to confirm your account, then continue onboarding.");
  };

  const signUpWithGoogle = async () => {
    setError("");
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/onboarding")}`;
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (oauthError) setError(oauthError.message);
  };

  return (
    <AuthShell title="Join SCU" subtitle="Create an account, then pick a username. Profile photo is optional.">
      {error && <p className="auth-error">{error}</p>}
      <form className="auth-fields" onSubmit={signUp}>
        <label>
          <span>Email</span>
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          <span>Password</span>
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button className="button primary full" type="submit" disabled={loading}>
          {loading ? "Creating…" : "Continue"}
        </button>
      </form>
      <button className="provider-button google" type="button" onClick={() => void signUpWithGoogle()}>
        <b>G</b> Continue with Google
      </button>
      <div className="auth-divider">
        <span>already have an account?</span>
      </div>
      <Link href={`/login?next=${encodeURIComponent(next)}`} className="button secondary full">
        Sign in
      </Link>
    </AuthShell>
  );
}

export function OnboardingPage() {
  const router = useRouter();
  const { user, profile, ready } = useAuth();

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace("/login?next=/onboarding");
      return;
    }
    if (profile?.onboarding_completed) router.replace("/");
  }, [ready, user, profile?.onboarding_completed, router]);

  if (!ready || !user || profile?.onboarding_completed) {
    return (
      <AuthShell title="Finish your profile" subtitle="Choose a username. Add a photo if you want — you can change it later.">
        <p className="empty-copy">Loading…</p>
      </AuthShell>
    );
  }

  // Keyed by the loaded profile so the form always initializes from the current username.
  return <OnboardingForm key={profile?.username ?? user.id} user={user} profile={profile} />;
}

function OnboardingForm({ user, profile }: { user: User; profile: ScuProfile | null }) {
  const router = useRouter();
  const { refreshProfile } = useAuth();
  const { preference: currentLanguage, setPreference: setStreamLanguage } = useStreamLanguage();
  const supabase = useMemo(() => createClient(), []);
  const [username, setUsername] = useState(profile?.username || "");
  const [password, setPassword] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [streamLanguage, setStreamLanguageDraft] = useState(() =>
    profile?.region_mode || profile?.preferred_language
      ? fromProfileColumns({ region_mode: profile?.region_mode, preferred_language: profile?.preferred_language })
      : normalizeStreamLanguage(currentLanguage || DEFAULT_STREAM_LANGUAGE),
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Optional password step for Google-only accounts.
  const showPassword = useMemo(() => {
    const providers = (user.app_metadata?.providers as string[] | undefined) || [];
    return !providers.includes("email");
  }, [user]);

  const complete = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalized = normalizeUsername(username);
    if (!USERNAME_PATTERN.test(normalized)) {
      setError("Username must be 3–24 characters: lowercase letters, numbers, underscores.");
      return;
    }
    setLoading(true);
    setError("");

    if (showPassword && password.length >= 6) {
      const { error: pwError } = await supabase.auth.updateUser({ password });
      if (pwError) {
        setLoading(false);
        setError(pwError.message);
        return;
      }
    }

    let avatarUrl = profile?.avatar_url ?? null;
    if (avatarFile) {
      const ext = avatarFile.name.split(".").pop() || "jpg";
      const path = `${user.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(path, avatarFile, {
        upsert: true,
        contentType: avatarFile.type,
      });
      if (uploadError) {
        setLoading(false);
        setError(uploadError.message);
        return;
      }
      const { data: publicUrl } = supabase.storage.from("avatars").getPublicUrl(path);
      avatarUrl = `${publicUrl.publicUrl}?t=${Date.now()}`;
    }

    const languageColumns = toProfileColumns(streamLanguage);
    const { data: existing } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
    if (!existing) {
      const { error: insertError } = await supabase.from("profiles").insert({
        id: user.id,
        username: normalized,
        display_name: normalized,
        avatar_url: avatarUrl,
        onboarding_completed: true,
        ...languageColumns,
      });
      if (insertError) {
        setLoading(false);
        setError(insertError.message.includes("duplicate") ? "That username is taken." : insertError.message);
        return;
      }
    } else {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          username: normalized,
          display_name: normalized,
          avatar_url: avatarUrl,
          onboarding_completed: true,
          ...languageColumns,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (updateError) {
        setLoading(false);
        setError(updateError.message.includes("duplicate") ? "That username is taken." : updateError.message);
        return;
      }
    }

    setStreamLanguage(streamLanguage);
    setLoading(false);
    await refreshProfile();
    router.push("/");
    router.refresh();
  };

  return (
    <AuthShell title="Finish your profile" subtitle="Choose a username. Add a photo if you want — you can change it later.">
      {error && <p className="auth-error">{error}</p>}
      <form className="auth-fields" onSubmit={complete}>
        <label>
          <span>Username</span>
          <input
            required
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="your_handle"
          />
        </label>
        <label>
          <span>Preferred stream language</span>
          <SelectMenu
            ariaLabel="Preferred stream language"
            value={streamLanguage}
            onChange={(next) => setStreamLanguageDraft(normalizeStreamLanguage(next))}
            options={STREAM_LANGUAGE_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
            fullWidth
          />
          <small className="auth-hint">Popular streams are prioritized in this language. “Any” shows everything; “Other” shows languages outside the main list. You can change this later in Settings.</small>
        </label>
        {showPassword && (
          <label>
            <span>Password (optional)</span>
            <input
              type="password"
              autoComplete="new-password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Set a password for email sign-in"
            />
          </label>
        )}
        <label>
          <span>Profile picture (optional)</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <button className="button primary full" type="submit" disabled={loading}>
          {loading ? "Saving…" : (
            <>
              <Check size={17} /> Enter SCU
            </>
          )}
        </button>
      </form>
    </AuthShell>
  );
}

export function LogoutPage() {
  const router = useRouter();
  const { signOut, ready } = useAuth();
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!ready || done) return;
    void signOut().then(() => {
      setDone(true);
      router.replace("/");
      router.refresh();
    });
  }, [ready, done, signOut, router]);

  return (
    <AuthShell title="Signing out" subtitle="Clearing your SCU session…">
      <p className="empty-copy">One moment.</p>
    </AuthShell>
  );
}
