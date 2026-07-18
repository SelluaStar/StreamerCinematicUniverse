"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Accessibility, Bell, CalendarDays, Check, ChevronDown, ChevronRight, CircleUserRound,
  Clock3, Command, Compass, Eye, Grid2X2, Heart, Home, LayoutDashboard, LogOut,
  Menu, MessageSquareText, MonitorPlay, Moon, PanelLeftClose, PanelLeftOpen, Pause, Play, Plus, Radio,
  Search, Settings, Share2, ShieldCheck, Sun, TrendingUp, Trash2, Trophy, Tv2,
  UserRound, UsersRound, Volume2, VolumeX, WandSparkles
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SelectMenu } from "@/components/ui/select-menu";
import {
  alumniRevealSlots,
  categories,
  formatViewers,
  getEventBySlug,
  getEventChildren,
  getEventsCatalog,
  getStudentLogins,
  getSuBoardEvents,
  getTopLevelEvents,
  schedule,
  setEventsCatalog,
  suClubDirectors,
  suCurriculum,
  suMoments,
  suProfessors,
  suSponsors,
  suStaff,
  suStudents,
  type CampusPerson,
  type Event,
  type Streamer,
} from "@/lib/data";
import {
  getAwardsYearBySlug,
  streamerAwardsFacts,
  streamerAwardsLibrary,
  streamerAwardsWatch,
} from "@/lib/streamer-awards";
import { useTheme, type Theme } from "@/components/theme-provider";
import { MultistreamPage as TwitchMultistreamPage } from "@/components/features/multistream/multistream-page";
import { TwitchPlayer, type TwitchPlayerHandle } from "@/components/features/player/twitch-player";
import { channelSearchToStreamer, searchTwitchChannels, useTwitchCategories, useTwitchStreams } from "@/components/features/twitch/use-twitch-data";
import { ClipsSection } from "@/components/features/clips/clips-section";
import { AuthRoute } from "@/components/auth/auth-route";
import { useAuth } from "@/components/auth/auth-provider";
import { useStreamLanguage } from "@/components/features/preferences/stream-language-provider";
import { STREAM_LANGUAGE_OPTIONS, streamLanguageLabel } from "@/lib/preferences/stream-language";
import { createClient } from "@/lib/supabase/client";
import { profileInitials, type ScuProfile, isScuAdmin } from "@/lib/auth/types";
import { deleteSavedWorkspace, listSavedWorkspaces, WATCHSPACES_CHANGE_EVENT, type SavedWorkspace } from "@/lib/multistream/saved-workspaces";
import { listSavedEventSlugs, toggleSavedEvent, setEventReminder, SAVED_EVENTS_CHANGE_EVENT } from "@/lib/saved-events";
import { getTwitchEmbedParentQuery } from "@/lib/twitch/embed-parents";
import { prefsFromProfile, saveAccountPrefs, type AccountPrefs } from "@/lib/preferences/account-prefs";
import { downloadAccountExport } from "@/lib/account/export-data";
import { NotificationsBell } from "@/components/features/notifications/notifications-bell";
import { personalizeStreams } from "@/lib/discovery/personalize";
import { HelpPage } from "@/components/features/help/help-page";
import { AdminEventsPage } from "@/components/features/admin/admin-events-page";
import { FirstRunTour } from "@/components/features/onboarding/first-run-tour";
import { useWatchMinutes } from "@/lib/watch-stats/use-watch-minutes";
import { serializeSharedWorkspace } from "@/components/features/multistream/share-state";

const nav = [
  { href: "/", label: "Home", icon: Home },
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/events", label: "Events", icon: CalendarDays },
  { href: "/multistream", label: "Multistream", icon: Grid2X2 },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
];

const mobileNav = [nav[0], nav[2], nav[3], { href: "/search", label: "Search", icon: Search }, { href: "/settings", label: "Profile", icon: UserRound }];

function routeActive(route: string, href: string) {
  return href === "/" ? route === "/" : route === href || route.startsWith(`${href}/`);
}

export function ScuApp({ route }: { route: string }) {
  const { ready, user, profile, signOut } = useAuth();
  const router = useRouter();
  const isAuthRoute = route === "/login" || route === "/signup" || route === "/onboarding" || route === "/logout";
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const profileTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("scu-sidebar-collapsed");
    if (saved === "1") queueMicrotask(() => setSidebarCollapsed(true));
    else if (saved == null && window.matchMedia("(max-width: 1180px)").matches) {
      // Small/tablet screens: start collapsed so watch layouts get horizontal room.
      queueMicrotask(() => setSidebarCollapsed(true));
    }
  }, []);

  const setSidebarCollapsedPref = useCallback((collapsed: boolean) => {
    setSidebarCollapsed(collapsed);
    localStorage.setItem("scu-sidebar-collapsed", collapsed ? "1" : "0");
  }, []);

  const announce = useCallback((message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  }, []);
  const [, setEventsTick] = useState(0);

  useEffect(() => {
    let active = true;
    void fetch("/api/events")
      .then(async (res) => {
        if (!res.ok) return;
        const json = await res.json() as { events?: Event[] };
        if (!active || !json.events?.length) return;
        setEventsCatalog(json.events);
        setEventsTick((tick) => tick + 1);
      })
      .catch(() => {
        // Keep static fallback from lib/data.ts
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!ready || isAuthRoute) return;
    if (user && profile && !profile.onboarding_completed) {
      window.location.replace("/onboarding");
    }
  }, [ready, user, profile, isAuthRoute]);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    window.setTimeout(() => searchButtonRef.current?.focus(), 0);
  }, []);
  const openMobileMenu = useCallback(() => {
    setMobileOpen(true);
    window.setTimeout(() => sidebarRef.current?.querySelector<HTMLElement>("a")?.focus(), 0);
  }, []);
  const closeMobileMenu = useCallback(() => {
    setMobileOpen(false);
    window.setTimeout(() => menuButtonRef.current?.focus(), 0);
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === "Escape") {
        if (searchOpen) closeSearch();
        if (mobileOpen) closeMobileMenu();
        if (profileMenuOpen) setProfileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [searchOpen, mobileOpen, profileMenuOpen, closeSearch, closeMobileMenu]);

  useEffect(() => {
    if (!profileMenuOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      const menu = profileMenuRef.current;
      const trigger = profileTriggerRef.current;
      const target = event.target as Node;
      if (menu?.contains(target) || trigger?.contains(target)) return;
      setProfileMenuOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [profileMenuOpen]);

  const handleSignOut = useCallback(() => {
    setProfileMenuOpen(false);
    void signOut().then(() => {
      router.push("/");
      router.refresh();
      announce("Signed out");
    });
  }, [signOut, router, announce]);

  useEffect(() => {
    const sidebar = sidebarRef.current;
    if (!mobileOpen || !sidebar) return;
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const focusable = [...sidebar.querySelectorAll<HTMLElement>("a[href], button:not([disabled])")];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    sidebar.addEventListener("keydown", trapFocus);
    return () => sidebar.removeEventListener("keydown", trapFocus);
  }, [mobileOpen]);

  if (isAuthRoute) {
    if (route === "/login") return <AuthRoute kind="login" />;
    if (route === "/signup") return <AuthRoute kind="signup" />;
    if (route === "/onboarding") return <AuthRoute kind="onboarding" />;
    return <AuthRoute kind="logout" />;
  }

  const displayName = profile?.display_name || profile?.username || "Guest";
  const handleLabel = profile?.username ? `@${profile.username}` : user ? "Complete profile" : "Sign in";
  const initials = profileInitials(profile);

  return (
    <div className={`app-frame ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <div className="ambient ambient-one" aria-hidden="true" />
      <div className="ambient ambient-two" aria-hidden="true" />
      <aside ref={sidebarRef} id="primary-sidebar" className={`sidebar ${mobileOpen ? "mobile-open" : ""}`} aria-label="Primary navigation">
        <div className="sidebar-top">
          <Link href="/" className="brand" aria-label="SCU home">
            <span className="brand-mark"><span /></span>
            <span><b>SCU</b><small>Streamer universe</small></span>
          </Link>
          <button
            type="button"
            className="icon-button subtle sidebar-collapse"
            aria-label="Hide navigation"
            onClick={() => { setSidebarCollapsedPref(true); closeMobileMenu(); }}
          >
            <PanelLeftClose size={18} />
          </button>
        </div>
        <nav className="side-nav">
          <p className="nav-label">Universe</p>
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} aria-current={routeActive(route, item.href) ? "page" : undefined} className={routeActive(route, item.href) ? "active" : ""} onClick={() => { if (mobileOpen) closeMobileMenu(); }}>
                <Icon size={19} strokeWidth={2} />
                <span>{item.label}</span>
                {item.label === "Events" && <i>{getTopLevelEvents().filter((event) => event.status !== "ended").length}</i>}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-live">
          <span className="eyebrow"><i className="live-dot" /> Live pulse</span>
          <strong>Discover creators</strong>
          <span>Browse categories, events, and multistreams</span>
          <Link href="/discover" className="button secondary full" onClick={() => { if (mobileOpen) closeMobileMenu(); }}>Open Discover</Link>
        </div>
        <div className="side-bottom">
          <Link href="/settings"><Settings size={18} /> Settings</Link>
          <Link href="/help"><CircleUserRound size={18} /> Help & support</Link>
          {isScuAdmin(profile) && <Link href="/admin/events"><Trophy size={18} /> Admin events</Link>}
          {user ? (
            <button onClick={handleSignOut}><LogOut size={18} /> Sign out</button>
          ) : (
            <Link href="/login"><UserRound size={18} /> Sign in</Link>
          )}
        </div>
      </aside>

      {mobileOpen && <button className="scrim" aria-label="Close menu" onClick={closeMobileMenu} />}

      <div className="app-main">
        <header className="topbar">
          <button ref={menuButtonRef} className="icon-button mobile-menu" aria-controls="primary-sidebar" aria-expanded={mobileOpen} onClick={openMobileMenu} aria-label="Open navigation"><Menu /></button>
          <button
            type="button"
            className="icon-button sidebar-toggle"
            aria-controls="primary-sidebar"
            aria-pressed={!sidebarCollapsed}
            aria-label={sidebarCollapsed ? "Show navigation" : "Hide navigation"}
            onClick={() => setSidebarCollapsedPref(!sidebarCollapsed)}
          >
            {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
          <button ref={searchButtonRef} className="search-trigger" onClick={() => setSearchOpen(true)}>
            <Search size={18} /><span>Search events, streamers, categories...</span><kbd><Command size={12} /> K</kbd>
          </button>
          <div className="top-actions">
            <ThemeQuickToggle />
            <NotificationsBell announce={announce} />
            {user ? (
              <div className="profile-menu-wrap">
                <button
                  ref={profileTriggerRef}
                  type="button"
                  className="profile-chip"
                  aria-haspopup="menu"
                  aria-expanded={profileMenuOpen}
                  onClick={() => setProfileMenuOpen((value) => !value)}
                >
                  <span>{profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : initials}</span>
                  <div><b>{displayName}</b><small>{handleLabel}</small></div>
                  <ChevronDown size={15} />
                </button>
                {profileMenuOpen && (
                  <div ref={profileMenuRef} className="profile-menu" role="menu">
                    <Link role="menuitem" href="/settings" onClick={() => setProfileMenuOpen(false)}><CircleUserRound size={16} /> Settings</Link>
                    <Link role="menuitem" href="/dashboard/connections" onClick={() => setProfileMenuOpen(false)}><Radio size={16} /> Connections</Link>
                    <button role="menuitem" onClick={handleSignOut}><LogOut size={16} /> Sign out</button>
                  </div>
                )}
              </div>
            ) : (
              <Link href="/login" className="button secondary">Sign in</Link>
            )}
          </div>
        </header>

        <main id="main-content" tabIndex={-1}>
          <PageRouter route={route} announce={announce} />
        </main>
      </div>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        {mobileNav.map((item) => {
          const Icon = item.icon;
          const special = item.href === "/multistream";
          return <Link href={item.href} key={item.href} aria-current={routeActive(route, item.href) ? "page" : undefined} className={`${routeActive(route, item.href) ? "active" : ""} ${special ? "mobile-primary" : ""}`}><Icon size={special ? 23 : 20} /><span>{item.label}</span></Link>;
        })}
      </nav>

      {searchOpen && <SearchPalette onClose={closeSearch} />}
      <FirstRunTour />
      <div className="toast-region" aria-live="polite">{notice && <div className="toast"><Check size={17} />{notice}</div>}</div>
    </div>
  );
}

function PageRouter({ route, announce }: { route: string; announce: (message: string) => void }) {
  if (route === "/") return <HomePage announce={announce} />;
  if (route === "/discover") return <DiscoverPage announce={announce} />;
  if (route === "/events") return <EventsPage announce={announce} />;
  if (route.startsWith("/events/")) return <EventPage slug={route.split("/")[2]} announce={announce} />;
  if (route.startsWith("/categories/")) return <CategoryPage slug={route.split("/")[2]} announce={announce} />;
  if (route.startsWith("/streamers/")) return <StreamerPage slug={route.split("/")[2]} announce={announce} />;
  if (route === "/search") return <SearchPage />;
  if (route === "/multistream") return <TwitchMultistreamPage announce={announce} />;
  if (route === "/dashboard/calendar") return <CalendarPage announce={announce} />;
  if (route === "/dashboard/saved") return <SavedPage announce={announce} />;
  if (route === "/dashboard/connections") return <ConnectionsPage announce={announce} />;
  if (route === "/dashboard") return <DashboardPage announce={announce} />;
  if (route === "/settings") return <SettingsPage announce={announce} />;
  if (route === "/help") return <HelpPage announce={announce} />;
  if (route === "/admin/events") return <AdminEventsPage announce={announce} />;
  if (route === "/login") return <AuthRoute kind="login" />;
  if (route === "/signup") return <AuthRoute kind="signup" />;
  if (route === "/onboarding") return <AuthRoute kind="onboarding" />;
  if (route === "/logout") return <AuthRoute kind="logout" />;
  return <NotFound />;
}

function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: React.ReactNode }) {
  return <div className="page-header">
    <div>{eyebrow && <span className="eyebrow purple">{eyebrow}</span>}<h1>{title}</h1>{description && <p>{description}</p>}</div>
    {actions && <div className="page-actions">{actions}</div>}
  </div>;
}

function SectionTitle({ title, subtitle, href }: { title: string; subtitle?: string; href?: string }) {
  return <div className="section-title"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{href && <Link href={href}>View all <ChevronRight size={16} /></Link>}</div>;
}

function multistreamAddHref(streamer: Streamer) {
  return `/multistream?streams=${encodeURIComponent(streamer.login || streamer.handle)}`;
}

/** Client-side saved-events slugs, kept in sync across every mounted page via a storage change event. */
function useSavedEventSlugs() {
  const [slugs, setSlugs] = useState<string[]>(() => (typeof window === "undefined" ? [] : listSavedEventSlugs()));
  useEffect(() => {
    const refresh = () => setSlugs(listSavedEventSlugs());
    refresh();
    window.addEventListener(SAVED_EVENTS_CHANGE_EVENT, refresh);
    const onStorage = (event: StorageEvent) => {
      if (event.key === "scu-saved-events-v1") refresh();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(SAVED_EVENTS_CHANGE_EVENT, refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return slugs;
}

async function copyPageLink(announce: (message: string) => void, label = "Link copied") {
  try {
    await navigator.clipboard.writeText(window.location.href);
    announce(label);
  } catch {
    announce("Couldn’t copy link — copy from the address bar");
  }
}

async function toggleStreamerFollow(streamer: Streamer, options: {
  userId?: string;
  existingFollowId?: string;
  refreshFollows: () => Promise<unknown>;
  announce: (message: string) => void;
  redirectPath: string;
}) {
  const { userId, existingFollowId, refreshFollows, announce, redirectPath } = options;
  if (!userId) {
    window.location.href = `/login?next=${encodeURIComponent(redirectPath)}`;
    return;
  }
  const supabase = createClient();
  if (existingFollowId) {
    const { error } = await supabase.from("follows").delete().eq("id", existingFollowId);
    if (error) { announce(error.message); return; }
    announce(`Unfollowed ${streamer.name}`);
  } else {
    const { error } = await supabase.from("follows").insert({
      follower_id: userId,
      twitch_user_id: streamer.userId || streamer.id,
      twitch_login: streamer.login || streamer.handle,
      display_name: streamer.name,
      profile_image_url: streamer.profileImageUrl || null,
    });
    if (error) { announce(error.message); return; }
    announce(`Following ${streamer.name}`);
  }
  await refreshFollows();
  window.dispatchEvent(new Event("scu:follows-changed"));
}

function HomePage({ announce }: { announce: (message: string) => void }) {
  const router = useRouter();
  const { follows } = useAuth();
  const { preference: streamLanguage } = useStreamLanguage();
  const topLive = useTwitchStreams({ first: 12, language: streamLanguage });
  const twitchCategories = useTwitchCategories(12);
  const liveStreams = personalizeStreams(topLive.streams, follows.map((f) => f.twitch_login));
  const liveCategories = twitchCategories.categories.length
    ? twitchCategories.categories.map((category, index) => ({
        name: category.name,
        count: "Live on Twitch",
        color: ["#8b5cf6", "#ef4444", "#22c55e", "#ec4899", "#f59e0b", "#3b82f6", "#06b6d4", "#f97316"][index % 8],
        glyph: "◇",
      }))
    : categories;
  const liveWatching = liveStreams.reduce((total, stream) => total + stream.viewers, 0);
  const spotlight = liveStreams[0];
  const featuredEvent = getTopLevelEvents().find((event) => event.status === "live") || getTopLevelEvents()[0];

  return <div className="page page-home">
    <section className="hero">
      <div className="hero-grid" aria-hidden="true" />
      <div className="hero-orbit orbit-a" aria-hidden="true" />
      <div className="hero-orbit orbit-b" aria-hidden="true" />
      <div className="hero-content">
        <span className="live-pill"><i /> Live now across Twitch</span>
        <p className="hero-kicker">Streamer Cinematic Universe</p>
        <h1 className="hero-brand">SCU</h1>
        <p className="hero-tagline">Watch the <em>whole scene</em></p>
        <p className="hero-copy">Discover live creators, follow major events, and build a multistream of whatever’s happening across the streamer world.</p>
        <div className="hero-actions">
          <Link href="/discover" className="button primary"><Play size={17} fill="currentColor" /> Discover live</Link>
          <Link href="/multistream" className="button glass"><Grid2X2 size={17} /> Build multistream</Link>
        </div>
        <div className="hero-meta"><span><b>{liveWatching ? formatViewers(liveWatching) : "—"}</b> on top live</span><span className="separator" /><span>{liveCategories.length || categories.length} categories</span><span className="separator" /><span>{getTopLevelEvents().length} events</span></div>
      </div>
      <div className="hero-card">
        {spotlight ? (
          <>
            <span className="eyebrow"><i className="live-dot" /> Watching now</span>
            <div className="hero-card-title"><b>{spotlight.name}</b><small>{spotlight.category}</small></div>
            <div className="progress"><span /></div>
            <div className="hero-card-foot"><span>{formatViewers(spotlight.viewers)} viewers</span><Link href={`/streamers/${spotlight.login || spotlight.id}`}>Open channel <ChevronRight size={14} /></Link></div>
          </>
        ) : featuredEvent ? (
          <>
            <span className="eyebrow"><i className="live-dot" /> On the calendar</span>
            <div className="hero-card-title"><b>{featuredEvent.title}</b><small>{featuredEvent.date}</small></div>
            <div className="progress"><span /></div>
            <div className="hero-card-foot"><span>{featuredEvent.status}</span><Link href={`/events/${featuredEvent.slug}`}>Open event <ChevronRight size={14} /></Link></div>
          </>
        ) : (
          <>
            <span className="eyebrow">Start here</span>
            <div className="hero-card-title"><b>Multistream</b><small>Watch several angles at once</small></div>
            <div className="progress"><span /></div>
            <div className="hero-card-foot"><span>Workspace</span><Link href="/multistream">Open <ChevronRight size={14} /></Link></div>
          </>
        )}
      </div>
    </section>

    <section className="section-block">
      <SectionTitle title="Browse categories" subtitle="Jump into what’s live across Twitch right now" href="/discover" />
      <div className="category-grid">
        {(liveCategories.length ? liveCategories : categories).slice(0, 8).map((category) => (
          <Link
            href={`/categories/${category.name.toLowerCase().replaceAll(" ", "-").replace("&-", "")}`}
            key={category.name}
            className="category-card"
            style={{ "--category": category.color } as React.CSSProperties}
          >
            <span>{category.glyph}</span>
            <div><b>{category.name}</b><small>{category.count}</small></div>
            <ChevronRight />
          </Link>
        ))}
      </div>
    </section>

    <section className="section-block">
      <SectionTitle title="Live now" subtitle="Top Twitch channels right now" href="/discover" />
      {liveStreams.length ? (
        <div className="stream-grid">{liveStreams.slice(0, 6).map((s, index) => <StreamCard streamer={s} key={s.id} featured={index === 0} announce={announce} onAdd={() => { announce(`${s.name} added to multistream`); router.push(multistreamAddHref(s)); }} />)}</div>
      ) : (
        <div className="empty-state"><Tv2 /><h2>{topLive.loading ? "Loading Twitch…" : "No live channels yet"}</h2><p>Check Discover once Twitch is connected.</p></div>
      )}
    </section>

    <ClipsSection
      title="Featured clips"
      subtitle="Recent popular highlights from channels climbing the live board"
      href="/discover"
      featured
      first={6}
      days={7}
    />

    <div className="two-column">
      <section className="section-block">
        <SectionTitle title="Events" subtitle="Major streamer moments and series" href="/events" />
        <div className="event-board-panel">
          {getTopLevelEvents().slice(0, 4).map((event) => <EventRow event={event} key={event.id} />)}
        </div>
      </section>
      <section className="section-block pulse-panel">
        <div className="pulse-head"><div><span className="eyebrow purple">SCU pulse</span><h2>Trending now</h2></div><TrendingUp size={22} /></div>
        {liveStreams.slice(0, 5).length ? liveStreams.slice(0, 5).map((s, index) => (
          <Link href={`/streamers/${s.login || s.id}`} className="rank-row" key={s.id}>
            <b>0{index + 1}</b><Avatar streamer={s} /><div><strong>{s.name}</strong><small>{s.category}</small></div><span className="up">{formatViewers(s.viewers)}</span>
          </Link>
        )) : <p className="empty-copy">Ranks appear when Twitch top live is available.</p>}
      </section>
    </div>
  </div>;
}

function AlumniRevealBoard({ announce, compact }: { announce: (message: string) => void; compact?: boolean }) {
  const { user } = useAuth();
  const slots = compact ? alumniRevealSlots.slice(0, 4) : alumniRevealSlots;
  return (
    <section className={`section-block alumni-reveal ${compact ? "compact" : ""}`}>
      <div className="alumni-reveal-head">
        <div>
          <span className="eyebrow purple">Upcoming · Jul 18</span>
          <h2>Alumni reveal board</h2>
          <p>Homecoming brings selected Class of 2025 alumni back to campus. Names stay blurred until Kai unlocks the official reveal.</p>
        </div>
        <div className="hero-actions">
          <Link href="/events/su-homecoming-alumni" className="button secondary">Open Homecoming</Link>
          <button className="button glass" onClick={() => {
            setEventReminder("su-homecoming-alumni", true);
            announce(user ? "You’ll get a reminder when alumni unlock" : "Reminder saved on this device — sign in to sync");
          }}>Notify me</button>
        </div>
      </div>
      <div className="alumni-board" aria-label="Locked alumni reveal board">
        {slots.map((slot) => (
          <article key={slot.label} className="alumni-card">
            <div className="alumni-blur" aria-hidden="true">
              <span /><span /><span />
              <b>??????</b>
              <small>Class of 2025</small>
            </div>
            <div className="alumni-meta"><strong>{slot.label}</strong><span>{slot.hint}</span></div>
          </article>
        ))}
      </div>
    </section>
  );
}

function StreamCard({ streamer, featured, onAdd, announce }: { streamer: Streamer; featured?: boolean; onAdd?: () => void; announce: (message: string) => void }) {
  const { user, follows, refreshFollows } = useAuth();
  const [pending, setPending] = useState(false);
  const login = streamer.login || streamer.handle;
  const href = `/streamers/${encodeURIComponent(login)}`;
  const existingFollow = follows.find((follow) => follow.twitch_user_id === (streamer.userId || streamer.id) || follow.twitch_login.toLowerCase() === login.toLowerCase());
  const isFollowing = Boolean(existingFollow);
  const previewUrl = streamer.thumbnailUrl || (streamer.platform === "Twitch"
    ? `https://static-cdn.jtvnw.net/previews-ttv/live_user_${encodeURIComponent(login)}-640x360.jpg`
    : undefined);
  const toggleFollow = () => {
    setPending(true);
    void toggleStreamerFollow(streamer, {
      userId: user?.id,
      existingFollowId: existingFollow?.id,
      refreshFollows,
      announce,
      redirectPath: href,
    }).finally(() => setPending(false));
  };
  return <article className={`stream-card ${featured ? "featured" : ""}`}>
    <Link href={href} className="stream-thumb" style={{ "--stream-color": streamer.color } as React.CSSProperties}>
      <div className="stream-preview-fallback"><span>{streamer.platform}</span><strong>{streamer.name}</strong><small>{streamer.category}</small></div>
      {previewUrl && <img className="stream-photo" src={previewUrl} alt={`Live preview of ${streamer.name}`} loading="lazy" referrerPolicy="no-referrer" onError={event => { event.currentTarget.hidden = true; }} />}
      <div className="stream-pattern" />
      <span className="live-badge">LIVE</span>
      <span className="viewer-badge"><Eye size={13} /> {formatViewers(streamer.viewers)}</span>
      <span className="play-hover"><Play fill="currentColor" /></span>
    </Link>
    <div className="stream-info">
      <Avatar streamer={streamer} />
      <div><Link href={href}>{streamer.name}{streamer.verified && <i className="verified">✓</i>}</Link><small>{streamer.title || streamer.event || streamer.category}</small></div>
      <button className="icon-button subtle" onClick={toggleFollow} disabled={pending} aria-pressed={isFollowing} aria-label={isFollowing ? `Unfollow ${streamer.name}` : `Follow ${streamer.name}`}><Heart size={18} fill={isFollowing ? "currentColor" : "none"} /></button>
      {onAdd && <button className="icon-button subtle" onClick={onAdd} aria-label={`Add ${streamer.name} to multistream`}><Plus size={18} /></button>}
    </div>
  </article>;
}

function Avatar({ streamer, small, giant }: { streamer: Streamer; small?: boolean; giant?: boolean }) {
  const [failedSrc, setFailedSrc] = useState<string>();
  const showImage = Boolean(streamer.profileImageUrl) && streamer.profileImageUrl !== failedSrc;
  return (
    <span className={`avatar ${small ? "small" : ""} ${giant ? "giant" : ""}`} style={{ "--avatar": streamer.color } as React.CSSProperties}>
      {showImage
        ? <img src={streamer.profileImageUrl} alt="" referrerPolicy="no-referrer" loading="lazy" decoding="async" onError={() => setFailedSrc(streamer.profileImageUrl)} />
        : streamer.initials}
    </span>
  );
}

function EventRow({ event }: { event: Event }) {
  const dateParts = event.date.replace(",", "").split(/\s+/);
  const primary = dateParts[1] || dateParts[0];
  const secondary = dateParts[0];
  return <Link href={`/events/${event.slug}`} className={`event-row board-row ${event.revealLocked ? "locked" : ""} ${event.status}`}>
    <div className="date-block"><b>{primary}</b><span>{secondary}</span></div>
    <span className="event-color" style={{ background: event.color }} />
    <div><strong>{event.title}</strong><small>{event.time} · {event.dayLabel || event.category}{event.revealLocked ? " · Reveal locked" : ""}</small></div>
    <span className={`board-status-pill ${event.status}`}>{event.status}</span>
    <span className="attendees"><UsersRound size={15} /> {event.attendees}</span><ChevronRight size={18} />
  </Link>;
}

function PersonChip({ person }: { person: CampusPerson }) {
  const content = (
    <>
      <span className="person-chip-role">{person.role}</span>
      <b>{person.name}</b>
      <small>{person.detail}</small>
    </>
  );
  if (person.login) {
    return <Link href={`/streamers/${person.login}`} className="person-chip">{content}</Link>;
  }
  return <button type="button" className="person-chip" disabled>{content}</button>;
}

function ChipCloud({ items }: { items: string[] }) {
  return <div className="chip-cloud">{items.map((item) => <button type="button" className="info-chip" key={item}>{item}</button>)}</div>;
}

function LiveCampusRail({ streams, loading, announce, emptyTitle, emptyBody }: {
  streams: Streamer[];
  loading: boolean;
  announce: (message: string) => void;
  emptyTitle?: string;
  emptyBody?: string;
}) {
  const router = useRouter();
  if (!streams.length) {
    return (
      <div className="empty-state compact">
        <Tv2 />
        <h2>{loading ? "Scanning live channels…" : (emptyTitle || "No mapped channels live right now")}</h2>
        <p>{emptyBody || "When linked creators go live, they fill this rail."}</p>
      </div>
    );
  }
  return (
    <div className="live-campus-shell">
      <div className="live-campus-rail" aria-label="Live Class of 2026 students">
        {streams.map((s) => (
          <div className="live-campus-card" key={s.id}>
            <StreamCard streamer={s} announce={announce} onAdd={() => { announce(`${s.name} added to multistream`); router.push(multistreamAddHref(s)); }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function PeopleDirectory() {
  const [group, setGroup] = useState("Staff");
  const groups = [
    { label: "Staff", people: suStaff },
    { label: "Professors", people: suProfessors },
    { label: "Club directors", people: suClubDirectors },
    { label: "Students", people: suStudents },
  ] as const;
  const active = groups.find((item) => item.label === group) || groups[0];
  return (
    <section className="section-block people-directory">
      <SectionTitle title="Campus people & streamers" subtitle={`${suStaff.length} staff · ${suProfessors.length} professors · ${suClubDirectors.length} club directors · ${suStudents.length} students`} />
      <div className="filter-bar" aria-label="Campus roster group">
        {groups.map((item) => (
          <button key={item.label} aria-pressed={group === item.label} className={group === item.label ? "active" : ""} onClick={() => setGroup(item.label)}>
            {item.label} <em>{item.people.length}</em>
          </button>
        ))}
      </div>
      <div className="person-chip-grid">
        {active.people.map((person) => <PersonChip key={`${person.role}-${person.name}`} person={person} />)}
      </div>
    </section>
  );
}

function DiscoverPage({ announce }: { announce: (message: string) => void }) {
  const router = useRouter();
  const { follows } = useAuth();
  const [filter, setFilter] = useState("All live");
  const { preference: streamLanguage, setPreference: setStreamLanguage } = useStreamLanguage();
  const twitch = useTwitchStreams({ first: 48, language: streamLanguage });
  const filters = ["All live", "IRL", "Gaming", "Just Chatting"];
  const filtered = twitch.streams.filter(s => filter === "All live" || s.category.toLowerCase().includes(filter.toLowerCase()));
  const list = personalizeStreams(filtered, follows.map((f) => f.twitch_login));
  return <div className="page">
    <PageHeader eyebrow="Live directory" title="Discover what’s happening" description="Live Twitch discovery across categories and creators." actions={<Link href="/events" className="button secondary">Browse events</Link>} />
    <div className="filter-bar" aria-label="Stream filters">{filters.map(item => <button aria-pressed={filter === item} className={filter === item ? "active" : ""} key={item} onClick={() => setFilter(item)}>{item}</button>)}</div>
    <div className="directory-summary"><span><i className="live-dot" /> {list.length} channels live{twitch.error ? ` · ${twitch.error}` : ""}</span><span className="directory-language"><span>Language</span><SelectMenu ariaLabel="Stream language" size="sm" value={streamLanguage} onChange={setStreamLanguage} options={STREAM_LANGUAGE_OPTIONS.map((option) => ({ value: option.value, label: option.label }))} /></span></div>
    {list.length ? <div className="discover-grid">{list.map(s => <StreamCard key={s.id} streamer={s} announce={announce} onAdd={() => { announce(`${s.name} added to multistream`); router.push(multistreamAddHref(s)); }} />)}</div> : <div className="empty-state"><Tv2 /><h2>{twitch.loading ? "Loading Twitch…" : "No live channels yet"}</h2><p>Check your Twitch API configuration if this stays empty.</p></div>}
    {twitch.loadMore && <button className="button secondary" onClick={twitch.loadMore}>Load more Twitch channels</button>}
    <ClipsSection
      title="Popular clips"
      subtitle="Most-viewed recent clips from channels trending live right now"
      featured
      first={8}
      days={7}
    />
  </div>;
}

function EventsPage({ announce }: { announce: (message: string) => void }) {
  const [tab, setTab] = useState("Live now");
  const savedSlugs = useSavedEventSlugs();
  const topLevel = getTopLevelEvents();
  const visibleEvents = useMemo(() => {
    if (tab === "Live now") return topLevel.filter((event) => event.status === "live");
    if (tab === "Upcoming") return topLevel.filter((event) => event.status === "upcoming");
    // Past: ended hubs plus ended child moments (most archives live under a parent hub).
    const endedTop = topLevel.filter((event) => event.status === "ended");
    // Twitch Rivals archives live under the hub — don't flood Past with every tournament.
    const endedChildren = getEventsCatalog().filter(
      (event) => event.parentSlug && event.status === "ended" && event.series !== "twitch-rivals",
    );
    const seen = new Set<string>();
    return [...endedTop, ...endedChildren].filter((event) => {
      if (seen.has(event.id)) return false;
      seen.add(event.id);
      return true;
    });
  }, [tab, topLevel]);
  return <div className="page">
    <PageHeader
      eyebrow="Events"
      title="What’s on across the universe"
      description="Major streamer events and series. Open any event hub to see its schedule and related moments."
      actions={<Link href="/multistream" className="button primary">Watch in Multistream <ChevronRight size={16} /></Link>}
    />
    <div className="filter-bar big" aria-label="Event status">
      {["Live now", "Upcoming", "Past"].map((item) => (
        <button aria-pressed={tab === item} className={tab === item ? "active" : ""} key={item} onClick={() => setTab(item)}>
          {item}{item === "Live now" && <i className="live-dot" />}
        </button>
      ))}
    </div>
    <div className="event-board upgraded">
      {visibleEvents.length ? visibleEvents.map((event, index) => {
        const children = getEventChildren(event.slug);
        const liveKids = children.filter((child) => child.status === "live").length;
        const saved = savedSlugs.includes(event.slug);
        return (
          <article className={`event-card-large ${event.revealLocked ? "locked-event" : ""} ${event.status}`} key={event.id} style={{ "--event": event.color } as React.CSSProperties}>
            <div className="event-art">
              <span className="event-number">0{index + 1}</span>
              <div className="rings" />
              <Trophy />
              {event.revealLocked && <span className="lock-chip">Reveal locked</span>}
              <span className={`board-status-pill ${event.status}`}>{event.status}</span>
            </div>
            <div className="event-card-body">
              <span className={`status ${event.status}`}>{event.status === "live" && <i className="live-dot" />}{event.eyebrow}</span>
              <h2>{event.title}</h2>
              <p>{event.description}</p>
                  {children.length > 0 && (
                <p className="event-subcount">
                  {event.series === "streamer-awards"
                    ? `${children.length} past shows in the library`
                    : event.series === "twitch-rivals"
                      ? `${children.length} tournaments on the schedule`
                      : `${children.length} related moments`}
                  {liveKids ? ` · ${liveKids} live now` : ""}
                </p>
              )}
              <div className="event-detail-line">
                <span><CalendarDays />{event.date}</span>
                <span><Clock3 />{event.time}</span>
                <span><UsersRound />{event.attendees}</span>
              </div>
              <div className="card-actions">
                <Link href={`/events/${event.slug}`} className="button primary">
                  {children.length ? "Open event hub" : event.status === "live" ? "Watch now" : "View event"} <ChevronRight size={16} />
                </Link>
                <button
                  className="icon-button subtle"
                  aria-pressed={saved}
                  aria-label={saved ? `Remove ${event.title} from saved` : `Save ${event.title}`}
                  onClick={() => announce(toggleSavedEvent(event.slug) ? `${event.title} saved` : `${event.title} removed from saved`)}
                ><Heart size={18} fill={saved ? "currentColor" : "none"} /></button>
              </div>
            </div>
          </article>
        );
      }) : (
        <div className="empty-state">
          <CalendarDays />
          <h2>Nothing in this tab</h2>
          <p>Switch between live, upcoming, and past events. Series with multiple moments open into their own hub.</p>
        </div>
      )}
    </div>
  </div>;
}

function AwardsYearLibrary({ activeSlug }: { activeSlug?: string }) {
  return (
    <div className="awards-year-grid">
      {streamerAwardsLibrary.map((year) => {
        const active = year.slug === activeSlug;
        return (
          <Link
            key={year.slug}
            href={`/events/${year.slug}`}
            className={`awards-year-card ${year.status} ${active ? "active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <div className="awards-year-top">
              <b>{year.yearLabel}</b>
              <span className={`board-status-pill ${year.status}`}>{year.status === "upcoming" ? "Upcoming" : "Archive"}</span>
            </div>
            <small>{year.edition}</small>
            <p>{year.date}</p>
            <div className="awards-year-meta">
              <span>Hosts · {year.hosts.join(", ")}</span>
              <span>SotY · {year.streamerOfTheYear}</span>
              {year.peakViewers && <span>Peak · {year.peakViewers}</span>}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function EventPage({ slug, announce }: { slug: string; announce: (message: string) => void }) {
  const event = getEventBySlug(slug);
  const savedSlugs = useSavedEventSlugs();
  const studentLogins = useMemo(() => getStudentLogins(), []);
  const participantLogins = useMemo(() => event?.twitchParticipants || [], [event]);
  const isSuHub = event?.slug === "streamer-university";
  const isAwardsHub = event?.slug === "streamer-awards";
  const isTrHub = event?.slug === "twitch-rivals";
  const isAwards = event?.series === "streamer-awards";
  const isSu = event?.series === "streamer-university";
  const isTr = event?.series === "twitch-rivals";
  const awardsYear = getAwardsYearBySlug(slug);
  const liveQueryLogins = isSuHub ? studentLogins : (participantLogins.length ? participantLogins : undefined);
  const [liveReady, setLiveReady] = useState(() => !isSuHub);
  useEffect(() => {
    if (!isSuHub) {
      setLiveReady(true);
      return;
    }
    const timer = window.setTimeout(() => setLiveReady(true), 200);
    return () => window.clearTimeout(timer);
  }, [isSuHub]);
  const twitch = useTwitchStreams({
    first: 100,
    userLogins: liveQueryLogins,
    enabled: liveReady && Boolean(liveQueryLogins?.length),
  });
  const clipLogins = useMemo(() => participantLogins.slice(0, 6), [participantLogins]);
  if (!event) return <NotFound />;
  const eventStreams = twitch.streams;
  const eventViewers = eventStreams.reduce((total, stream) => total + stream.viewers, 0);
  const hubSlug = isSuHub || isAwardsHub || isTrHub ? event.slug : event.parentSlug;
  const children = hubSlug ? getEventChildren(hubSlug) : [];
  const siblings = children.filter((item) => item.slug !== event.slug);
  const showBoard = siblings.length > 0 || isSuHub || isAwardsHub || isTrHub;
  const multistreamSeed = (eventStreams.length
    ? eventStreams.map((stream) => stream.login || stream.handle)
    : (liveQueryLogins || [])).filter(Boolean).slice(0, 6);
  const watchLiveHref = multistreamSeed.length
    ? `/multistream?streams=${encodeURIComponent(multistreamSeed.join(","))}`
    : "/multistream";

  return <div className="page event-detail" style={{ "--event": event.color } as React.CSSProperties}>
    <section className="event-hero">
      <div className="event-hero-symbol"><Trophy /></div>
      <div>
        <span className="live-pill"><i /> {event.eyebrow}</span>
        <h1>{event.title}</h1>
        <p>{event.description}</p>
        {event.location && <p className="event-location">{event.location}</p>}
        <div className="hero-actions">
          <Link href={watchLiveHref} className="button primary"><Play fill="currentColor" size={17} /> Watch live</Link>
          {event.parentSlug && <Link href={`/events/${event.parentSlug}`} className="button glass">Back to event hub</Link>}
          <button className="button glass" onClick={() => {
            setEventReminder(event.slug, true);
            announce(`Reminder set for ${event.title}`);
          }}><Bell size={17} /> Remind me</button>
          <button
            className="icon-button glass"
            aria-pressed={savedSlugs.includes(event.slug)}
            aria-label={savedSlugs.includes(event.slug) ? `Remove ${event.title} from saved` : `Save ${event.title}`}
            onClick={() => announce(toggleSavedEvent(event.slug) ? `${event.title} saved` : `${event.title} removed from saved`)}
          ><Heart size={17} fill={savedSlugs.includes(event.slug) ? "currentColor" : "none"} /></button>
          <button className="icon-button glass" aria-label={`Share ${event.title}`} onClick={() => void copyPageLink(announce, "Event link copied")}><Share2 /></button>
        </div>
      </div>
      <div className="event-stats">
        <span><b>{eventViewers ? formatViewers(eventViewers) : "—"}</b><small>{isSuHub ? "Live students" : "Mapped channels"}</small></span>
        <span><b>{isSuHub ? suStudents.length : isAwardsHub ? streamerAwardsLibrary.length : event.attendees}</b><small>{isSuHub ? "Class of 2026" : isAwardsHub ? "Years logged" : "Scale"}</small></span>
        <span><b>{awardsYear?.streamerOfTheYear || event.dayLabel || event.status}</b><small>{isAwards ? "Streamer of the Year" : "Board status"}</small></span>
      </div>
    </section>

    {(event.revealLocked || isSuHub) && (
      <AlumniRevealBoard announce={announce} compact={isSuHub && !event.revealLocked} />
    )}

    {isAwards && (
      <section className="section-block">
        <SectionTitle
          title="Year library"
          subtitle="Every Streamer Awards edition with hosts, Streamer of the Year, and peak viewers"
        />
        <AwardsYearLibrary activeSlug={event.slug} />
      </section>
    )}

    {awardsYear && (
      <section className="section-block awards-year-detail">
        <SectionTitle title={`${awardsYear.yearLabel} show notes`} subtitle={`${awardsYear.edition} · ${awardsYear.venue}`} />
        <div className="awards-highlight-grid">
          <article className="awards-fact-card">
            <span className="eyebrow">Hosts</span>
            <b>{awardsYear.hosts.join(" · ")}</b>
          </article>
          <article className="awards-fact-card">
            <span className="eyebrow">Streamer of the Year</span>
            <b>{awardsYear.streamerOfTheYear}</b>
          </article>
          {awardsYear.peakViewers && (
            <article className="awards-fact-card">
              <span className="eyebrow">Peak viewers</span>
              <b>{awardsYear.peakViewers}</b>
            </article>
          )}
        </div>
        <div className="moment-list">
          {awardsYear.highlights.map((highlight) => (
            <button type="button" className="moment-chip" key={highlight} onClick={() => announce(highlight)}>
              <span>{awardsYear.yearLabel}</span>
              <div><b>Highlight</b><p>{highlight}</p></div>
            </button>
          ))}
        </div>
      </section>
    )}

    <section className="section-block">
      <SectionTitle
        title={isSuHub ? "Live from campus · students only" : isAwards ? "Hosts & related live" : "Live from the event"}
        subtitle={isSuHub ? "Two-row rail of Class of 2026 creators who are live right now — scroll sideways" : "Mapped Twitch perspectives — add them to Multistream"}
      />
      <LiveCampusRail
        streams={eventStreams}
        loading={twitch.loading}
        announce={announce}
        emptyTitle={isSuHub ? "No students live right now" : isAwards ? "Hosts aren’t live right now" : undefined}
        emptyBody={isSuHub ? "When Class of 2026 creators go live, they fill this two-row campus rail." : isAwards ? "QTCinderella and related hosts will appear here when live." : undefined}
      />
    </section>

    {(isSuHub || isAwardsHub || ((isSu || isAwards) && clipLogins.length > 0)) && (
      <ClipsSection
        title={isSuHub || isSu ? "Popular Streamer University clips" : "Popular Streamer Awards clips"}
        subtitle={isSuHub || isSu ? "Recent highlights from Kai and campus-linked creators" : "Recent highlights from awards hosts and stages"}
        userLogins={clipLogins}
        first={6}
        days={14}
      />
    )}

    {isSu && (
      <div className="detail-grid">
        <section>
          {showBoard && <>
            <SectionTitle title="Campus board" subtitle="Every Streamer University moment with its own page" />
            <div className="campus-board-panel">{(isSuHub ? children : siblings).map((item) => <EventRow event={item} key={item.id} />)}</div>
          </>}
        </section>
        <aside className="schedule-panel campus-schedule">
          <div className="panel-head"><div><span className="eyebrow purple">Week schedule</span><h2>SU board</h2></div><CalendarDays /></div>
          {schedule.map(item => (
            <div className={`schedule-row ${item.status}`} key={`${item.time}-${item.title}`}>
              <time>{item.time}</time>
              <span />
              <div>
                {item.slug ? <Link href={`/events/${item.slug}`}><b>{item.title}</b></Link> : <b>{item.title}</b>}
                <small>{item.host}</small>
              </div>
              {item.status === "live" && <i>LIVE</i>}
            </div>
          ))}
          <Link href="/events" className="button secondary full">All board events <ChevronRight size={16} /></Link>
        </aside>
      </div>
    )}

    {isAwards && showBoard && !isAwardsHub && (
      <section className="section-block">
        <SectionTitle title="Other years" subtitle="Jump across the Streamer Awards archive" />
        <div className="campus-board-panel awards-board">{siblings.map((item) => <EventRow event={item} key={item.id} />)}</div>
      </section>
    )}

    {isAwardsHub && (
      <div className="two-column">
        <section className="section-block">
          <SectionTitle title="About the awards" subtitle="Community-powered trophies founded by QTCinderella" />
          <ChipCloud items={streamerAwardsFacts} />
        </section>
        <section className="section-block">
          <SectionTitle title="How to watch 2026" subtitle="Official streams and voting windows" />
          <ChipCloud items={streamerAwardsWatch} />
          <div className="watch-card">
            <h3>Nov 12, 2026</h3>
            <p>Thursday before TwitchCon San Diego. Venue TBA — QTCinderella has teased a production pivot after 2025 crossed one million peak viewers.</p>
            <a className="button primary" href="https://thestreamerawards.com/" target="_blank" rel="noreferrer">Official site</a>
          </div>
        </section>
      </div>
    )}

    {isSuHub && <>
      <section className="section-block">
        <SectionTitle title="Campus curriculum" subtitle="What students are studying between the chaos" />
        <ChipCloud items={suCurriculum} />
      </section>
      <section className="section-block">
        <SectionTitle title="Campus staff" subtitle="Dean, SU Police, janitors, librarian, and guidance" />
        <div className="person-chip-grid">{suStaff.map((person) => <PersonChip key={person.name} person={person} />)}</div>
      </section>
      <section className="section-block">
        <SectionTitle title="Professors" subtitle="Confirmed 2026 faculty from the class reveal" />
        <div className="person-chip-grid">{suProfessors.map((person) => <PersonChip key={person.name} person={person} />)}</div>
      </section>
      <section className="section-block">
        <SectionTitle title="Club directors" subtitle="Extracurriculars beyond the classroom" />
        <div className="person-chip-grid">{suClubDirectors.map((person) => <PersonChip key={person.name} person={person} />)}</div>
      </section>
      <PeopleDirectory />
      <section className="section-block">
        <SectionTitle title={`Full Class of 2026 · ${suStudents.length} students`} subtitle="Complete roster from the official reveal coverage" />
        <div className="person-chip-grid dense">{suStudents.map((person) => <PersonChip key={person.name} person={person} />)}</div>
      </section>
      <div className="two-column">
        <section className="section-block">
          <SectionTitle title="Day 1 moments" subtitle="Already on the record from opening day" />
          <div className="moment-list">{suMoments.map((moment) => <button type="button" className="moment-chip" key={moment.title}><span>{moment.day}</span><div><b>{moment.title}</b><p>{moment.detail}</p></div></button>)}</div>
        </section>
        <section className="section-block">
          <SectionTitle title="Campus stack" subtitle="Sponsors and activations reported around Day 1" />
          <ChipCloud items={suSponsors} />
          <div className="watch-card">
            <h3>How to watch</h3>
            <p>Kai streams the event on Twitch and YouTube, with daily coverage typically starting around 3:00 PM ET. Build a Multistream of live Class of 2026 students for more angles.</p>
            <Link href="/multistream" className="button primary">Open Multistream</Link>
          </div>
        </section>
      </div>
      <section className="section-block">
        <SectionTitle title="Past semester" subtitle="The inaugural class that made SU annual" />
        <div className="campus-board-panel"><EventRow event={getEventBySlug("streamer-university-2025")!} /></div>
      </section>
    </>}

    {!isSu && !isAwards && showBoard && (
      <section className="section-block">
        <SectionTitle
          title={isTr || isTrHub ? "Tournament schedule" : "Related moments"}
          subtitle={isTr || isTrHub ? "Synced from schedule.twitchrivals.com — live, upcoming, and recent shows" : "Other pages in this series"}
        />
        <div className="campus-board-panel">
          {(hubSlug === event.slug ? children : siblings)
            .slice()
            .sort((a, b) => {
              const rank = (status: Event["status"]) => (status === "live" ? 0 : status === "upcoming" ? 1 : 2);
              return rank(a.status) - rank(b.status) || a.date.localeCompare(b.date);
            })
            .map((item) => <EventRow event={item} key={item.id} />)}
        </div>
      </section>
    )}
  </div>;
}

function CategoryPage({ slug, announce }: { slug: string; announce: (message: string) => void }) {
  const router = useRouter();
  const isSu = slug === "streamer-university";
  const isAwards = slug === "streamer-awards";
  const name = slug.split("-").map(word => word[0]?.toUpperCase() + word.slice(1)).join(" ");
  const studentLogins = useMemo(() => getStudentLogins(), []);
  const twitchCategories = useTwitchCategories(100);
  const selectedCategory = twitchCategories.categories.find((category) => category.name.toLowerCase().replaceAll(" ", "-") === slug);
  const awardsLogins = useMemo(() => getEventBySlug("streamer-awards")?.twitchParticipants || [], []);
  const { preference: streamLanguage } = useStreamLanguage();
  const twitch = useTwitchStreams({
    first: 100,
    gameId: isSu || isAwards ? undefined : selectedCategory?.id,
    userLogins: isSu ? studentLogins : isAwards ? awardsLogins : undefined,
    language: streamLanguage,
  });
  const live = twitch.streams;
  if (isSu) {
    return <div className="page">
      <section className="category-hero"><span className="category-symbol">✦</span><div><span className="eyebrow purple">Event category</span><h1>Streamer University</h1><p>Campus hub for the 2026 bootcamp at Hendrix College — Picture Day, Homecoming alumni reveal, Fashion Show, Talent Show, and the Class of 2025 archive.</p></div><div className="category-stat"><b>{suStudents.length}</b><small>students</small></div></section>
      <SectionTitle title="Campus board" subtitle="Sub-events inside Streamer University" href="/events" />
      <div className="campus-board-panel">{getEventChildren("streamer-university").map((event) => <EventRow event={event} key={event.id} />)}</div>
      <SectionTitle title="Live Class of 2026" subtitle="Students who are live right now" />
      <LiveCampusRail streams={live} loading={twitch.loading} announce={announce} />
      <div className="hero-actions" style={{ marginTop: 18 }}><Link href="/events/streamer-university" className="button primary">Open 2026 hub</Link><Link href="/events/su-homecoming-alumni" className="button secondary">Alumni reveal</Link></div>
    </div>;
  }
  if (isAwards) {
    return <div className="page">
      <section className="category-hero"><span className="category-symbol">✦</span><div><span className="eyebrow purple">Event category</span><h1>Streamer Awards</h1><p>QTCinderella’s fan-voted awards — 2026 countdown plus the full year library from the inaugural show through 2025.</p></div><div className="category-stat"><b>{streamerAwardsLibrary.length}</b><small>years</small></div></section>
      <SectionTitle title="Year library" subtitle="Jump into any edition" href="/events/streamer-awards" />
      <AwardsYearLibrary activeSlug="streamer-awards" />
      <SectionTitle title="Hosts live now" subtitle="Mapped awards channels" />
      <LiveCampusRail streams={live} loading={twitch.loading} announce={announce} />
      <div className="hero-actions" style={{ marginTop: 18 }}><Link href="/events/streamer-awards" className="button primary">Open 2026 hub</Link><Link href="/events/streamer-awards-2025" className="button secondary">2025 archive</Link></div>
    </div>;
  }
  return <div className="page">
    <section className="category-hero"><span className="category-symbol">◇</span><div><span className="eyebrow purple">Explore category</span><h1>{selectedCategory?.name || name}</h1><p>Live moments and creators from Twitch category discovery.</p></div><div className="category-stat"><b>{live.length}</b><small>channels loaded</small></div></section>
    <SectionTitle title={`Trending in ${name}`} subtitle="Sorted by current viewers" />
    {live.length ? <div className="discover-grid">{live.map(s => <StreamCard key={s.id} streamer={s} announce={announce} onAdd={() => { announce(`${s.name} added to multistream`); router.push(multistreamAddHref(s)); }} />)}</div> : <div className="empty-state"><Tv2 /><h2>{twitch.loading ? "Loading Twitch…" : "No live channels in this category"}</h2><p>Try another category or check Discover.</p></div>}
    <section className="section-block"><SectionTitle title="Related events" /><div className="event-list">{getTopLevelEvents().slice(0, 4).map(event => <EventRow event={event} key={event.id} />)}</div></section>
  </div>;
}

function StreamerPage({ slug, announce }: { slug: string; announce: (message: string) => void }) {
  const login = slug.toLowerCase();
  const { user, follows, refreshFollows } = useAuth();
  const liveLookup = useTwitchStreams({ first: 1, userLogins: [login] });
  const [profile, setProfile] = useState<Streamer | null>(null);
  const [profileError, setProfileError] = useState<string>();
  const [profileLoading, setProfileLoading] = useState(true);
  const [followPending, setFollowPending] = useState(false);
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);
  const [showChat, setShowChat] = useState(true);
  const [chatEmbed, setChatEmbed] = useState({ parentQuery: "parent=localhost", dark: true });
  const playerRef = useRef<TwitchPlayerHandle>(null);

  useEffect(() => {
    let active = true;
    setProfileLoading(true);
    setProfileError(undefined);
    fetch(`/api/twitch/channel?login=${encodeURIComponent(login)}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as {
          error?: string;
          channel?: { id: string; login: string; displayName: string; description: string; profileImageUrl: string };
          title?: string;
          gameName?: string;
          live?: { viewerCount: number; thumbnailUrl: string; title: string; gameName: string; startedAt: string } | null;
        };
        if (!response.ok) throw new Error(payload.error || "Channel not found.");
        if (!active || !payload.channel) return;
        const live = payload.live;
        setProfile({
          id: payload.channel.id,
          userId: payload.channel.id,
          name: payload.channel.displayName,
          handle: payload.channel.login,
          login: payload.channel.login,
          initials: payload.channel.displayName.slice(0, 2).toUpperCase(),
          platform: "Twitch",
          category: live?.gameName || payload.gameName || "Twitch",
          viewers: live?.viewerCount || 0,
          live: Boolean(live),
          color: "#9146ff",
          verified: true,
          title: live?.title || payload.title || payload.channel.description,
          profileImageUrl: payload.channel.profileImageUrl,
          thumbnailUrl: live?.thumbnailUrl,
          startedAt: live?.startedAt,
        });
      })
      .catch(async (reason) => {
        try {
          const channels = await searchTwitchChannels(login);
          const match = channels.find((channel) => channel.login.toLowerCase() === login) || channels[0];
          if (!active) return;
          if (!match) throw reason;
          setProfile(channelSearchToStreamer(match));
        } catch {
          if (active) setProfileError(reason instanceof Error ? reason.message : "Channel not found.");
        }
      })
      .finally(() => { if (active) setProfileLoading(false); });
    return () => { active = false; };
  }, [login]);

  useEffect(() => {
    const update = () => setChatEmbed({
      parentQuery: getTwitchEmbedParentQuery(),
      dark: document.documentElement.dataset.theme !== "light",
    });
    queueMicrotask(update);
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  const streamer = liveLookup.streams[0] || profile;
  if ((liveLookup.loading || profileLoading) && !streamer) {
    return <div className="page"><div className="skeleton skeleton-title" /><div className="skeleton skeleton-copy" /><div className="skeleton skeleton-player" /></div>;
  }
  if (!streamer) return <NotFound />;

  const related = getTopLevelEvents().slice(0, 2);
  const channelLogin = streamer.login || streamer.handle || login;
  const chatSrc = `https://www.twitch.tv/embed/${encodeURIComponent(channelLogin)}/chat?${chatEmbed.parentQuery}${chatEmbed.dark ? "&darkpopout" : ""}`;
  const multistreamHref = `/multistream?streams=${encodeURIComponent(channelLogin)}`;
  const existingFollow = follows.find((follow) => follow.twitch_user_id === (streamer.userId || streamer.id) || follow.twitch_login.toLowerCase() === channelLogin.toLowerCase());
  const isFollowing = Boolean(existingFollow);
  const toggleFollow = () => {
    setFollowPending(true);
    void toggleStreamerFollow(streamer, {
      userId: user?.id,
      existingFollowId: existingFollow?.id,
      refreshFollows,
      announce,
      redirectPath: `/streamers/${channelLogin}`,
    }).finally(() => setFollowPending(false));
  };

  return (
    <div className="page creator-page" style={{ "--creator": streamer.color } as React.CSSProperties}>
      <section className="creator-hero">
        <Avatar streamer={streamer} giant />
        <div>
          <span className="live-pill"><i /> {streamer.live ? `Live now on ${streamer.platform}` : `Offline on ${streamer.platform}`}</span>
          <h1>{streamer.name}{streamer.verified && <i className="verified">✓</i>}</h1>
          <p>@{streamer.handle} · {streamer.category}</p>
          <div className="hero-actions">
            <button className="button primary" onClick={() => { setPaused(false); announce(`Playing ${streamer.name}`); }}>
              <Play fill="currentColor" size={17} /> Watch here
            </button>
            <Link href={multistreamHref} className="button glass"><Grid2X2 size={17} /> Add to multistream</Link>
            <button
              className="button glass"
              disabled={followPending}
              aria-pressed={isFollowing}
              onClick={toggleFollow}
            >
              <Heart size={17} fill={isFollowing ? "currentColor" : "none"} /> {isFollowing ? "Following" : "Follow"}
            </button>
            <button className="icon-button glass" aria-label={`Share ${streamer.name}'s profile`} onClick={() => void copyPageLink(announce, "Profile link copied")}><Share2 /></button>
          </div>
        </div>
        <div className="creator-numbers">
          <span><b>{streamer.live ? formatViewers(streamer.viewers) : "—"}</b><small>{streamer.live ? "watching now" : "offline"}</small></span>
          <span><b>Twitch</b><small>live platform</small></span>
        </div>
      </section>

      {profileError && !streamer.live && <p className="empty-copy">{profileError}</p>}

      <section className={`creator-watch ${showChat ? "with-chat" : ""}`} aria-label={`${streamer.name} player`}>
        <div className="creator-player-shell">
          <div className="creator-player">
            <TwitchPlayer
              ref={playerRef}
              channel={channelLogin}
              muted={muted}
              paused={paused}
              volume={0.7}
              onMutedChange={(value) => { if (value !== muted) setMuted(value); }}
            />
          </div>
          <div className="creator-player-bar">
            <button type="button" onClick={() => setPaused((value) => !value)} aria-label={paused ? "Play" : "Pause"}>
              {paused ? <Play size={16} /> : <Pause size={16} />}
              <span>{paused ? "Play" : "Pause"}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                let currentlyMuted = muted;
                try {
                  currentlyMuted = playerRef.current?.getMuted() ?? muted;
                } catch {
                  currentlyMuted = muted;
                }
                const next = !currentlyMuted;
                playerRef.current?.applyAudio(next, 0.7);
                setMuted(next);
              }}
              aria-label={muted ? "Unmute" : "Mute"}
            >
              {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              <span>{muted ? "Unmute" : "Mute"}</span>
            </button>
            <button type="button" aria-pressed={showChat} onClick={() => setShowChat((value) => !value)}>
              <MessageSquareText size={16} />
              <span>{showChat ? "Hide chat" : "Show chat"}</span>
            </button>
            <Link href={multistreamHref} className="button secondary">Open in Multistream</Link>
          </div>
        </div>
        {showChat && (
          <aside className="creator-chat" aria-label={`${streamer.name} chat`}>
            <iframe title={`${streamer.name} Twitch chat`} src={chatSrc} />
          </aside>
        )}
      </section>

      <div className="detail-grid creator-meta-grid">
        <section className="section-block">
          <SectionTitle title="About this stream" />
          <div className="profile-panel flat">
            <p>{streamer.title || `${streamer.name} on Twitch.`}</p>
            <div className="linked-row"><span>Twitch</span><b>@{streamer.handle}</b><Check size={15} /></div>
            <div className="linked-row"><span>Category</span><b>{streamer.category}</b><span /></div>
          </div>
        </section>
        <section className="section-block">
          <SectionTitle title="Featured events" />
          <div className="event-list">{related.map((event) => <EventRow event={event} key={event.id} />)}</div>
        </section>
      </div>
    </div>
  );
}

function DashboardTabs({ active }: { active: string }) {
  const items = [{ href: "/dashboard", label: "Overview", icon: LayoutDashboard }, { href: "/dashboard/calendar", label: "Calendar", icon: CalendarDays }, { href: "/dashboard/saved", label: "Saved", icon: Heart }, { href: "/dashboard/connections", label: "Connections", icon: Radio }];
  return <nav className="dashboard-tabs" aria-label="Dashboard sections">{items.map(item => { const Icon = item.icon; const isActive = active === item.label; return <Link href={item.href} aria-current={isActive ? "page" : undefined} className={isActive ? "active" : ""} key={item.href}><Icon size={15} />{item.label}</Link>; })}</nav>;
}

/** Shared atmospheric header band used across all dashboard sub-pages. Pass `children` for a fully custom hero (Overview); otherwise a standard title row is rendered above the tabs. */
function DashboardHeader({ active, eyebrow, title, description, actions, children }: {
  active: string;
  eyebrow?: string;
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="dashboard-band">
      <div className="dashboard-band-aurora" aria-hidden="true" />
      {children ?? (
        <div className="dashboard-band-top">
          <div>
            {eyebrow && <span className="eyebrow purple">{eyebrow}</span>}
            <h1>{title}</h1>
            {description && <p>{description}</p>}
          </div>
          {actions && <div className="page-actions">{actions}</div>}
        </div>
      )}
      <DashboardTabs active={active} />
    </div>
  );
}

const dashboardShortcuts = [
  { name: "Discover live", description: "Browse categories and creators streaming right now.", href: "/discover", icon: Compass, tint: "#8b6cff" },
  { name: "Browse events", description: "Every SCU event, past, live, and upcoming.", href: "/events", icon: CalendarDays, tint: "#f472b6" },
  { name: "Open Multistream", description: "Build a custom multi-channel watch layout.", href: "/multistream", icon: Grid2X2, tint: "#60a5fa" },
];

function DashboardPage({ announce }: { announce: (message: string) => void }) {
  const router = useRouter();
  const { profile, user, follows } = useAuth();
  const minutesWatched = useWatchMinutes();
  const followed = useTwitchStreams({ followed: true, first: 8 });
  const followedLive = followed.streams;
  const greetingName = profile?.display_name || profile?.username || (user ? "there" : "guest");
  const [watchspaceCount, setWatchspaceCount] = useState(0);
  useEffect(() => {
    const refresh = () => setWatchspaceCount(listSavedWorkspaces().length);
    refresh();
    window.addEventListener(WATCHSPACES_CHANGE_EVENT, refresh);
    return () => window.removeEventListener(WATCHSPACES_CHANGE_EVENT, refresh);
  }, []);
  const followingCount = follows.length || followedLive.length;
  const upcomingEvents = getTopLevelEvents().filter((event) => event.status !== "ended");
  const comingUp = upcomingEvents.filter((event) => event.status === "upcoming" || event.status === "live").slice(0, 4);

  return (
    <div className="page">
      <DashboardHeader active="Overview">
        <div className="dashboard-hero-inner">
          <div className="dashboard-hero-copy">
            <span className="eyebrow purple"><Radio size={12} /> Your universe</span>
            <h1>Welcome back, <em>{greetingName}</em></h1>
            <p>Here’s what’s live from your follows, what’s next on the board, and everything you’ve saved.</p>
            <div className="hero-actions">
              <Link href="/multistream" className="button primary"><Plus size={17} /> New multistream</Link>
              <Link href="/discover" className="button secondary">Discover creators</Link>
            </div>
            {followedLive.length > 0 && (
              <span className="live-pill dashboard-live-pill"><i /> {followedLive.length} of your follows {followedLive.length === 1 ? "is" : "are"} live now</span>
            )}
          </div>
          <aside className="dashboard-signal-card">
            <span className="dashboard-signal-card-title">Your signals</span>
            <div className="dashboard-signal-row"><span className="stat-icon pink"><Heart /></span><div><b>{followingCount}</b><small>Following</small></div></div>
            <div className="dashboard-signal-row"><span className="stat-icon amber"><Grid2X2 /></span><div><b>{watchspaceCount}</b><small>Watchspaces</small></div></div>
            <div className="dashboard-signal-row"><span className="stat-icon blue"><CalendarDays /></span><div><b>{upcomingEvents.length}</b><small>Upcoming events</small></div></div>
            <div className="dashboard-signal-row"><span className="stat-icon green"><Clock3 /></span><div><b>{minutesWatched}</b><small>Minutes watched</small></div></div>
          </aside>
        </div>
      </DashboardHeader>

      <div className="two-column dashboard-columns">
        <section className="section-block">
          <SectionTitle title="Live from your follows" subtitle={followedLive.length ? `${followedLive.length} streaming now` : undefined} href="/discover" />
          {followed.error && <Link className="button secondary" href="/dashboard/connections">Connect Twitch for live follows</Link>}
          {followedLive.length ? (
            <div className="stream-grid compact">{followedLive.slice(0, 2).map(s => <StreamCard key={s.id} streamer={s} announce={announce} onAdd={() => { announce(`${s.name} added to multistream`); router.push(multistreamAddHref(s)); }} />)}</div>
          ) : (
            <div className="empty-state compact"><Heart /><h2>No followed lives yet</h2><p>Connect Twitch or follow creators on SCU.</p></div>
          )}
        </section>
        <section className="section-block">
          <SectionTitle title="Coming up" href="/dashboard/calendar" />
          {comingUp.length ? (
            <div className="event-list">{comingUp.map(e => <EventRow key={e.id} event={e} />)}</div>
          ) : (
            <div className="empty-state compact"><CalendarDays /><h2>Nothing on the board</h2><p>Check back soon for new events.</p></div>
          )}
        </section>
      </div>

      <section className="section-block">
        <SectionTitle title="Shortcuts" subtitle="Jump back into the universe" />
        <div className="dashboard-shortcut-grid">
          {dashboardShortcuts.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.name} href={item.href} className="dashboard-shortcut-card" style={{ "--tint": item.tint } as React.CSSProperties}>
                <span className="dashboard-shortcut-icon"><Icon size={20} /></span>
                <div><b>{item.name}</b><small>{item.description}</small></div>
                <ChevronRight size={17} />
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function CalendarPage({ announce }: { announce: (message: string) => void }) {
  const [month, setMonth] = useState(new Date(2026, 6, 1));
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstWeekday = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const previousMonthDays = new Date(year, monthIndex, 0).getDate();
  const cellCount = firstWeekday + daysInMonth > 35 ? 42 : 35;
  const suDays: Record<number, { label: string; href: string }> = year === 2026 && monthIndex === 6
    ? {
        15: { label: "Opening Day", href: "/events/su-opening-day" },
        16: { label: "Classes & clubs", href: "/events/streamer-university" },
        17: { label: "Picture Day", href: "/events/su-picture-day" },
        18: { label: "Homecoming", href: "/events/su-homecoming-alumni" },
        19: { label: "Talent / Spelling", href: "/events/su-talent-show" },
        20: { label: "Closing", href: "/events/su-closing-ceremony" },
      }
    : year === 2026 && monthIndex === 10
      ? { 12: { label: "Streamer Awards", href: "/events/streamer-awards" } }
      : {};
  const moveMonth = (offset: number) => setMonth(new Date(year, monthIndex + offset, 1));
  const boardEvents = getTopLevelEvents().filter((event) => event.status !== "ended");
  const suWeekEvents = getSuBoardEvents().filter((event) => event.slug !== "streamer-university-2025");
  return (
    <div className="page">
      <DashboardHeader
        active="Calendar"
        eyebrow="Dashboard"
        title="Event calendar"
        description="Track SCU events and Streamer University week at a glance."
        actions={<Link href="/events" className="button primary"><CalendarDays size={17} /> Browse events</Link>}
      />
      <div className="two-column">
        <div className="calendar-shell">
          <div className="calendar-head">
            <button className="icon-button subtle" aria-label="Previous month" onClick={() => moveMonth(-1)}>‹</button>
            <h2>{month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</h2>
            <button className="icon-button subtle" aria-label="Next month" onClick={() => moveMonth(1)}>›</button>
            <button className="button secondary" onClick={() => setMonth(new Date(2026, 6, 1))}>Today</button>
          </div>
          <div className="week-labels">{["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map(d => <span key={d}>{d}</span>)}</div>
          <div className="calendar-grid">
            {Array.from({ length: cellCount }, (_, index) => {
              const rawDay = index - firstWeekday + 1;
              const outside = rawDay < 1 || rawDay > daysInMonth;
              const displayDay = rawDay < 1 ? previousMonthDays + rawDay : rawDay > daysInMonth ? rawDay - daysInMonth : rawDay;
              const marker = !outside ? suDays[rawDay] : undefined;
              return (
                <div className={`${rawDay === 17 && monthIndex === 6 && year === 2026 ? "today" : ""} ${outside ? "muted-day" : ""}`} key={index}>
                  <b>{displayDay}</b>
                  {marker && <Link href={marker.href} onClick={() => announce(`${marker.label} opened`)}><i /><span>{marker.label}</span></Link>}
                </div>
              );
            })}
          </div>
        </div>
        <aside className="dashboard-rail">
          <section className="section-block">
            <SectionTitle title="Upcoming on the board" />
            {boardEvents.length ? (
              <div className="event-list">{boardEvents.map((event) => <EventRow key={event.id} event={event} />)}</div>
            ) : (
              <div className="empty-state compact"><CalendarDays /><h2>Nothing upcoming</h2><p>The board is clear for now.</p></div>
            )}
          </section>
          <section className="section-block">
            <SectionTitle title="Streamer University week" />
            <div className="event-list">{suWeekEvents.map((event) => <EventRow key={event.id} event={event} />)}</div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function SavedPage({ announce }: { announce: (message: string) => void }) {
  const { user, follows, refreshFollows } = useAuth();
  const [filter, setFilter] = useState<"all" | "events" | "creators" | "watchspaces">("all");
  const savedSlugs = useSavedEventSlugs();
  const savedEvents = useMemo(
    () => getEventsCatalog().filter((event) => savedSlugs.includes(event.slug)),
    [savedSlugs],
  );
  const [watchspaces, setWatchspaces] = useState<SavedWorkspace[]>(() => (typeof window === "undefined" ? [] : listSavedWorkspaces()));

  useEffect(() => {
    const onChange = () => { void refreshFollows(); };
    window.addEventListener("scu:follows-changed", onChange);
    return () => window.removeEventListener("scu:follows-changed", onChange);
  }, [refreshFollows]);

  useEffect(() => {
    const refresh = () => setWatchspaces(listSavedWorkspaces());
    refresh();
    window.addEventListener(WATCHSPACES_CHANGE_EVENT, refresh);
    const onStorage = (event: StorageEvent) => {
      if (event.key === "scu-multistream-saved-v1") refresh();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(WATCHSPACES_CHANGE_EVENT, refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const removeWatchspace = (id: string, name: string) => {
    deleteSavedWorkspace(id);
    setWatchspaces(listSavedWorkspaces());
    announce(`“${name}” deleted`);
  };

  const unfollow = async (followId: string, name: string) => {
    const { error } = await createClient().from("follows").delete().eq("id", followId);
    if (error) {
      announce(error.message);
      return;
    }
    await refreshFollows();
    announce(`${name} removed from saved`);
  };

  const showEvents = filter === "all" || filter === "events";
  const showCreators = filter === "all" || filter === "creators";
  const showWatchspaces = filter === "all" || filter === "watchspaces";
  const totalSaved = savedEvents.length + follows.length + watchspaces.length;
  const tabs: Array<{ id: typeof filter; label: string; count: number }> = [
    { id: "all", label: "All saved", count: totalSaved },
    { id: "events", label: "Events", count: savedEvents.length },
    { id: "creators", label: "Creators", count: follows.length },
    { id: "watchspaces", label: "Watchspaces", count: watchspaces.length },
  ];

  return (
    <div className="page">
      <DashboardHeader
        active="Saved"
        eyebrow="Dashboard"
        title="Saved for later"
        description="Events, creators, and multistream layouts you’ve pinned."
      />
      <div className="filter-bar" aria-label="Saved item type">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            aria-pressed={filter === tab.id}
            className={filter === tab.id ? "active" : ""}
            onClick={() => setFilter(tab.id)}
          >
            {tab.label}
            <em>{tab.count}</em>
          </button>
        ))}
      </div>

      {filter === "all" && totalSaved === 0 && (
        <div className="empty-state">
          <Heart />
          <h2>Nothing saved yet</h2>
          <p>Follow creators, heart events, or save a Multistream layout — they’ll show up here.</p>
          <div className="hero-actions" style={{ marginTop: 14, justifyContent: "center" }}>
            <Link href="/discover" className="button primary">Discover creators</Link>
            <Link href="/events" className="button secondary">Browse events</Link>
            <Link href="/multistream" className="button secondary">Open Multistream</Link>
          </div>
        </div>
      )}

      {showEvents && (savedEvents.length > 0 || filter === "events") && (
        <section className="section-block">
          {filter === "all" && <SectionTitle title="Events" subtitle={`${savedEvents.length} saved`} href="/events" />}
          {savedEvents.length ? (
            <div className="saved-grid">
              {savedEvents.map((event) => (
                <article key={event.id} className="saved-card" style={{ "--event": event.color } as React.CSSProperties}>
                  <div className="saved-art"><Trophy /></div>
                  <span className="eyebrow purple">{event.date}</span>
                  <h2>{event.title}</h2>
                  <p>{event.description}</p>
                  <div>
                    <Link href={`/events/${event.slug}`} className="button secondary">View event</Link>
                    <button
                      type="button"
                      className="icon-button subtle"
                      aria-label={`Remove ${event.title} from saved`}
                      onClick={() => { toggleSavedEvent(event.slug); announce(`${event.title} removed from saved`); }}
                    ><Heart fill="currentColor" /></button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state compact">
              <CalendarDays />
              <h2>No saved events yet</h2>
              <p>Tap the heart on any event to pin it here.</p>
              <Link href="/events" className="button primary" style={{ marginTop: 12 }}>Browse events</Link>
            </div>
          )}
        </section>
      )}

      {showCreators && (follows.length > 0 || filter === "creators") && (
        <section className="section-block">
          {filter === "all" && <SectionTitle title="Creators" subtitle={`${follows.length} following`} href="/discover" />}
          {!user ? (
            <div className="empty-state compact">
              <UserRound />
              <h2>Sign in to save creators</h2>
              <p>Follow creators from Discover or stream pages after you sign in.</p>
              <Link href="/login?next=/dashboard/saved" className="button primary" style={{ marginTop: 12 }}>Sign in</Link>
            </div>
          ) : follows.length ? (
            <div className="saved-grid">
              {follows.map((follow) => (
                <article key={follow.id} className="saved-card" style={{ "--event": "#9146ff" } as React.CSSProperties}>
                  <div className="saved-art">
                    {follow.profile_image_url
                      ? <img src={follow.profile_image_url} alt="" referrerPolicy="no-referrer" loading="lazy" decoding="async" />
                      : <UserRound />}
                  </div>
                  <span className="eyebrow purple">Twitch</span>
                  <h2>{follow.display_name || follow.twitch_login}</h2>
                  <p>@{follow.twitch_login}</p>
                  <div>
                    <Link href={`/streamers/${follow.twitch_login}`} className="button secondary">Open</Link>
                    <button
                      type="button"
                      className="icon-button subtle"
                      aria-label={`Unfollow ${follow.display_name || follow.twitch_login}`}
                      onClick={() => void unfollow(follow.id, follow.display_name || follow.twitch_login)}
                    ><Heart fill="currentColor" /></button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state compact">
              <UserRound />
              <h2>No saved creators yet</h2>
              <p>Follow creators from Discover or stream pages.</p>
              <Link href="/discover" className="button primary" style={{ marginTop: 12 }}>Discover</Link>
            </div>
          )}
        </section>
      )}

      {showWatchspaces && (watchspaces.length > 0 || filter === "watchspaces") && (
        <section className="section-block">
          {filter === "all" && <SectionTitle title="Watchspaces" subtitle={`${watchspaces.length} saved`} href="/multistream" />}
          {watchspaces.length ? (
            <div className="saved-grid">
              {watchspaces.map((ws) => (
                <article key={ws.id} className="saved-card" style={{ "--event": "#8b5cf6" } as React.CSSProperties}>
                  <div className="saved-art"><Grid2X2 /></div>
                  <span className="eyebrow purple">{ws.streams.length} stream{ws.streams.length === 1 ? "" : "s"} · {ws.template}</span>
                  <h2>{ws.name}</h2>
                  <p>{ws.streams.map((s) => s.name).join(", ") || "Empty layout"}</p>
                  <div>
                    <Link href={`/multistream?load=${encodeURIComponent(ws.id)}`} className="button secondary">Load</Link>
                    <button
                      type="button"
                      className="button glass"
                      onClick={() => {
                        const chatPanels = (ws.chatPanels?.length
                          ? ws.chatPanels.map((panel) => panel.streamIds)
                          : [(ws.chatStreamIds?.length
                            ? ws.chatStreamIds
                            : ws.chatStreamId
                              ? [ws.chatStreamId]
                              : [])])
                          .map((ids) => ids
                            .map((id) => ws.streams.find((stream) => stream.id === id))
                            .filter((stream): stream is NonNullable<typeof stream> => Boolean(stream))
                            .map((stream) => stream.login || stream.handle))
                          .filter((panel) => panel.length);
                        const chats = chatPanels.flat();
                        const query = serializeSharedWorkspace({
                          logins: ws.streams.map((stream) => stream.login || stream.handle),
                          layout: ws.template,
                          chats,
                          chatPanels,
                          chat: chats[0],
                          chatPlacement: ws.chatPlacement,
                        });
                        void navigator.clipboard.writeText(`${window.location.origin}/multistream?${query}`).then(() => announce("Share link copied"));
                      }}
                    ><Share2 size={15} /> Share</button>
                    <button
                      type="button"
                      className="icon-button subtle"
                      aria-label={`Delete ${ws.name}`}
                      onClick={() => removeWatchspace(ws.id, ws.name)}
                    ><Trash2 size={18} /></button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state compact">
              <Grid2X2 />
              <h2>No saved watchspaces yet</h2>
              <p>Save a layout from Multistream to pin it here.</p>
              <Link href="/multistream" className="button primary" style={{ marginTop: 12 }}>Open Multistream</Link>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function ConnectionsPage({ announce }: { announce: (message: string) => void }) {
  const { user, ready } = useAuth();
  const [session, setSession] = useState<{ loading: boolean; connected: boolean; login?: string; error?: string }>({ loading: true, connected: false });
  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get("twitch");
    const statusMessage = status === "denied"
      ? "Twitch authorization was cancelled."
      : status === "invalid_state"
        ? "The Twitch authorization request expired. Please try again."
        : status === "failed"
          ? "Twitch could not complete the connection."
          : status === "redirect_mismatch"
            ? "Twitch redirect URI mismatch. Use http://localhost:3000/api/auth/callback/twitch in the Twitch Developer Console."
            : status === "login_required"
              ? "Sign in to SCU before connecting Twitch."
              : undefined;
    fetch("/api/auth/twitch/session", { cache: "no-store" })
      .then(async (response) => ({ response, payload: await response.json() as { connected?: boolean; user?: { login: string }; error?: string } }))
      .then(({ response, payload }) => setSession({
        loading: false,
        connected: response.ok && Boolean(payload.connected),
        login: payload.user?.login,
        error: statusMessage || (status === "connected" ? undefined : payload.error),
      }))
      .catch(() => setSession({ loading: false, connected: false, error: "Unable to check Twitch connection." }));
  }, []);
  const disconnect = async () => {
    await fetch("/api/auth/twitch/logout", { method: "POST" });
    if (user) {
      await createClient().from("linked_accounts").delete().eq("user_id", user.id).eq("provider", "twitch");
    }
    setSession({ loading: false, connected: false });
    announce("Twitch disconnected");
  };
  const connectHref = ready && !user
    ? `/login?next=${encodeURIComponent("/dashboard/connections")}`
    : "/api/auth/twitch/start";
  return (
    <div className="page">
      <DashboardHeader
        active="Connections"
        eyebrow="Dashboard"
        title="Connected accounts"
        description="Link Twitch after you sign in to SCU. You control what we can access."
      />
      <div className="connections-list">
        <article className="connection-card">
          <span className="provider-logo" style={{ background: "#9146ff" }}>T</span>
          <div>
            <h2>Twitch{session.connected && <span className="connected-badge"><Check /> Connected</span>}</h2>
            <p>{session.loading ? "Checking connection…" : session.connected ? `Connected as ${session.login}` : session.error || (user ? "Connect Twitch to load your followed live channels." : "Sign in to SCU, then connect Twitch.")}</p>
            <small>Access: public profile and followed channels (`user:read:follows`)</small>
          </div>
          {session.connected ? <button className="button secondary" onClick={() => void disconnect()}>Disconnect</button> : <a className="button primary" href={connectHref}>{user ? "Connect" : "Sign in to connect"}</a>}
        </article>
        <article className="connection-card">
          <span className="provider-logo" style={{ background: "#ff0033" }}>▶</span>
          <div>
            <h2>YouTube</h2>
            <p>YouTube integration will be added after Twitch.</p>
            <small>No access requested</small>
          </div>
          <button className="button secondary" disabled>Coming next</button>
        </article>
        <div className="security-note"><ShieldCheck /><div><b>Your credentials stay private</b><p>SCU never stores your provider password. Connections use secure OAuth and can be revoked at any time.</p></div></div>
      </div>
    </div>
  );
}

function AccountFields({ userId, userEmail, profile, refreshProfile, announce }: { userId: string; userEmail: string | undefined; profile: ScuProfile | null; refreshProfile: () => Promise<ScuProfile | null>; announce: (message: string) => void }) {
  const [username, setUsername] = useState(profile?.username || "");
  const [displayName, setDisplayName] = useState(profile?.display_name || "");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [accountSaving, setAccountSaving] = useState(false);

  const saveAccount = async () => {
    setAccountSaving(true);
    const supabase = createClient();
    let avatarUrl = profile?.avatar_url ?? null;
    if (avatarFile) {
      const ext = avatarFile.name.split(".").pop() || "jpg";
      const path = `${userId}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(path, avatarFile, {
        upsert: true,
        contentType: avatarFile.type,
      });
      if (uploadError) {
        setAccountSaving(false);
        announce(uploadError.message);
        return;
      }
      avatarUrl = `${supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl}?t=${Date.now()}`;
    }
    const normalized = username.trim().toLowerCase();
    const { error } = await supabase.from("profiles").update({
      username: normalized || null,
      display_name: displayName.trim() || normalized || null,
      avatar_url: avatarUrl,
      updated_at: new Date().toISOString(),
    }).eq("id", userId);
    setAccountSaving(false);
    if (error) {
      announce(error.message.includes("duplicate") ? "That username is taken." : error.message);
      return;
    }
    await refreshProfile();
    announce("Account saved");
  };

  return (
    <>
      <div className="setting-row"><div><b>Email</b><small>{userEmail}</small></div></div>
      <div className="setting-row"><div><b>Username</b><small>3–24 characters, lowercase.</small></div><input aria-label="Username" value={username} onChange={(e) => setUsername(e.target.value)} /></div>
      <div className="setting-row"><div><b>Display name</b><small>Shown in the top bar.</small></div><input aria-label="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></div>
      <div className="setting-row"><div><b>Profile picture</b><small>Optional. PNG, JPG, WebP, or GIF.</small></div><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)} /></div>
      <div className="setting-row"><div><b>Save account</b><small>Update your public profile details.</small></div><button className="button secondary" disabled={accountSaving} onClick={() => void saveAccount()}>{accountSaving ? "Saving…" : "Save account"}</button></div>
      <div className="setting-row"><div><b>Sign out</b><small>Ends your SCU session on this device.</small></div><Link href="/logout" className="button secondary">Sign out</Link></div>
    </>
  );
}

function SettingsPage({ announce }: { announce: (message: string) => void }) {
  const { theme, setTheme, highContrast, setHighContrast, reducedMotion, setReducedMotion } = useTheme();
  const { user, profile, follows, refreshProfile } = useAuth();
  const { preference: streamLanguage, setPreference: setStreamLanguage } = useStreamLanguage();
  const [prefs, setPrefs] = useState<AccountPrefs>(() => prefsFromProfile(null));
  const [textSize, setTextSize] = useState("default");
  const [playerLimit, setPlayerLimit] = useState("6");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setPrefs(prefsFromProfile(profile));
      const savedTextSize = localStorage.getItem("scu-text-size") || "default";
      const savedLimit = localStorage.getItem("scu-player-limit") || "6";
      setTextSize(savedTextSize);
      setPlayerLimit(savedLimit);
      document.documentElement.dataset.textSize = savedTextSize;
    });
  }, [profile]);

  const patchPref = (key: keyof AccountPrefs) => (value: boolean) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
    void saveAccountPrefs({ [key]: value });
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      await saveAccountPrefs(prefs);
      await refreshProfile();
      announce("Preferences saved");
    } catch {
      announce("Couldn’t save preferences");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <PageHeader
        eyebrow="Preferences"
        title="Settings"
        description="Make your universe look, feel, and behave the way you want."
        actions={<button className="button primary" disabled={saving} onClick={() => void saveAll()}><Check size={17} /> {saving ? "Saving…" : "Save changes"}</button>}
      />
      <div className="settings-layout">
        <nav className="settings-nav">
          <a href="#account"><CircleUserRound />Account</a>
          <a href="#appearance"><WandSparkles />Appearance</a>
          <a href="#accessibility"><Accessibility />Accessibility</a>
          <a href="#playback"><MonitorPlay />Playback</a>
          <a href="#notifications"><Bell />Notifications</a>
          <a href="#privacy"><ShieldCheck />Privacy</a>
        </nav>
        <div className="settings-content">
          <SettingsSection id="account" icon={<CircleUserRound />} title="Account" description="Your SCU identity, username, and sign-out.">
            {user ? (
              <AccountFields key={profile?.username ?? user.id} userId={user.id} userEmail={user.email} profile={profile} refreshProfile={refreshProfile} announce={announce} />
            ) : (
              <div className="setting-row"><div><b>Not signed in</b><small>Create an account to sync follows and connections.</small></div><Link href="/login" className="button primary">Sign in</Link></div>
            )}
          </SettingsSection>
          <SettingsSection id="appearance" icon={<WandSparkles />} title="Appearance" description="Choose a visual mode. Event colors adapt within every theme.">
            <div className="theme-grid">{(["night", "light", "midnight"] as Theme[]).map((item) => (
              <button key={item} aria-pressed={theme === item} className={theme === item ? "selected" : ""} onClick={() => setTheme(item)}>
                <span className={`theme-preview ${item}`}><i /><i /><i /></span>
                <b>{item === "night" ? "SCU Night" : item === "light" ? "Editorial Light" : "Midnight OLED"}</b>
                <small>{item === "night" ? "Recommended" : item === "light" ? "Bright and crisp" : "Deepest contrast"}</small>
                {theme === item && <Check />}
              </button>
            ))}</div>
          </SettingsSection>
          <SettingsSection id="accessibility" icon={<Accessibility />} title="Accessibility" description="Adjust readability and motion across SCU.">
            <SettingToggle title="High contrast" description="Strengthen borders and text contrast." value={highContrast} onChange={setHighContrast} />
            <SettingToggle title="Reduce motion" description="Remove ambient and layout animations." value={reducedMotion} onChange={setReducedMotion} />
            <div className="setting-row">
              <div><b>Text size</b><small>Scale interface text without changing browser zoom.</small></div>
              <SelectMenu ariaLabel="Text size" triggerClassName="setting-select" value={textSize} onChange={(value) => { setTextSize(value); localStorage.setItem("scu-text-size", value); document.documentElement.dataset.textSize = value; }} options={[{ value: "default", label: "Default" }, { value: "large", label: "Large" }, { value: "extra-large", label: "Extra large" }]} />
            </div>
          </SettingsSection>
          <SettingsSection id="playback" icon={<MonitorPlay />} title="Playback" description="Control how streams behave in your watchspaces.">
            <SettingToggle title="Prefer captions" description="Enable captions by default when you add streams to Multistream." value={prefs.preferCaptions} onChange={patchPref("preferCaptions")} />
            <div className="setting-row">
              <div><b>Stream language</b><small>Prioritize popular and top-live streams in this language. Current: {streamLanguageLabel(streamLanguage)}.</small></div>
              <SelectMenu ariaLabel="Stream language" triggerClassName="setting-select" value={streamLanguage} onChange={setStreamLanguage} options={STREAM_LANGUAGE_OPTIONS.map((option) => ({ value: option.value, label: option.label }))} />
            </div>
            <div className="setting-row">
              <div><b>Simultaneous player limit</b><small>Lower values use less memory and network data.</small></div>
              <SelectMenu ariaLabel="Player limit" triggerClassName="setting-select" value={playerLimit} onChange={(value) => { setPlayerLimit(value); localStorage.setItem("scu-player-limit", value); }} options={[{ value: "6", label: "6 streams" }, { value: "4", label: "4 streams" }, { value: "2", label: "2 streams" }]} />
            </div>
          </SettingsSection>
          <SettingsSection id="notifications" icon={<Bell />} title="Notifications" description="Choose what deserves your attention.">
            <SettingToggle title="Event reminders" description="Get notified before saved events begin." value={prefs.eventReminders} onChange={patchPref("eventReminders")} />
            <SettingToggle title="Followed creators go live" description="Alert when creators you follow go live." value={prefs.liveAlerts} onChange={patchPref("liveAlerts")} />
            <SettingToggle title="Browser push" description="PC notifications when this browser is allowed." value={prefs.pushNotifications} onChange={async (value) => {
              patchPref("pushNotifications")(value);
              if (value && typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
                await Notification.requestPermission();
              }
              if (value) {
                const { subscribePush } = await import("@/lib/notifications/push-client");
                await subscribePush();
              }
            }} />
            <SettingToggle title="Email notifications" description="Only send email when this is on (go-live and event reminders)." value={prefs.emailNotifications} onChange={patchPref("emailNotifications")} />
          </SettingsSection>
          <SettingsSection id="privacy" icon={<ShieldCheck />} title="Privacy and data" description="Control personalization and the data saved to your account.">
            <SettingToggle title="Personalized recommendations" description="Boost followed creators and saved-event participants in discovery." value={prefs.personalization} onChange={patchPref("personalization")} />
            <div className="setting-row">
              <div><b>Download your data</b><small>Export profile, follows, saved events, and watchspaces as JSON.</small></div>
              <button className="button secondary" onClick={() => {
                void downloadAccountExport({ profile, follows, userEmail: user?.email }).then(() => announce("Export downloaded"));
              }}>Download export</button>
            </div>
          </SettingsSection>
        </div>
      </div>
    </div>
  );
}

function SettingsSection({ id, icon, title, description, children }: { id: string; icon: React.ReactNode; title: string; description: string; children: React.ReactNode }) {
  return <section className="settings-section" id={id}><div className="settings-section-head"><span>{icon}</span><div><h2>{title}</h2><p>{description}</p></div></div>{children}</section>;
}

function SettingToggle({ title, description, value, onChange }: { title: string; description: string; value: boolean; onChange: (value: boolean) => void }) {
  return <div className="setting-row"><div><b>{title}</b><small>{description}</small></div><button role="switch" aria-label={title} aria-checked={value} className={`switch ${value ? "on" : ""}`} onClick={() => onChange(!value)}><span /></button></div>;
}

function SearchPage() {
  const { follows } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Streamer[]>([]);
  const [categoriesHits, setCategoriesHits] = useState<Array<{ id: string; name: string }>>([]);
  const [clipsHits, setClipsHits] = useState<Array<{ id: string; title: string; url: string; broadcasterName: string }>>([]);
  const [searching, setSearching] = useState(false);
  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 2) {
      queueMicrotask(() => {
        setResults([]);
        setCategoriesHits([]);
        setClipsHits([]);
      });
      return;
    }
    const timer = window.setTimeout(() => {
      setSearching(true);
      Promise.all([
        searchTwitchChannels(normalized).then((channels) => channels.map(channelSearchToStreamer)).catch(() => [] as Streamer[]),
        fetch(`/api/twitch/categories?first=100`).then(async (res) => {
          if (!res.ok) return [];
          const json = await res.json() as { data?: Array<{ id: string; name: string }> };
          const q = normalized.toLowerCase();
          return (json.data || []).filter((cat) => cat.name.toLowerCase().includes(q)).slice(0, 6);
        }).catch(() => []),
        fetch(`/api/twitch/clips?first=12&days=7&featured=1`).then(async (res) => {
          if (!res.ok) return [];
          const json = await res.json() as { data?: Array<{ id: string; title: string; url: string; broadcasterName: string }> };
          const q = normalized.toLowerCase();
          return (json.data || []).filter((clip) => clip.title.toLowerCase().includes(q) || clip.broadcasterName.toLowerCase().includes(q)).slice(0, 6);
        }).catch(() => []),
      ]).then(([channels, cats, clips]) => {
        setResults(personalizeStreams(channels, follows.map((f) => f.twitch_login)));
        setCategoriesHits(cats);
        setClipsHits(clips);
      }).finally(() => setSearching(false));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query, follows]);
  const eventHits = query.trim().length >= 2
    ? getEventsCatalog().filter((event) => [event.title, event.description, event.category, event.eyebrow].some((value) => value.toLowerCase().includes(query.toLowerCase())))
    : [];
  const savedWatchspaces = query.trim().length >= 2
    ? listSavedWorkspaces().filter((ws) => ws.name.toLowerCase().includes(query.toLowerCase()))
    : [];
  const savedEventHits = query.trim().length >= 2
    ? listSavedEventSlugs()
      .map((slug) => getEventBySlug(slug))
      .filter((event): event is Event => Boolean(event && event.title.toLowerCase().includes(query.toLowerCase())))
    : [];

  return (
    <div className="page">
      <PageHeader eyebrow="Universal search" title="Find your next moment" description="Search channels, events, categories, clips, and your saved items." />
      <label className="search-page-input"><span className="sr-only">Search SCU</span><Search /><input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search Twitch, events, categories..." /><kbd>{searching ? "…" : "ESC"}</kbd></label>
      <div className="search-sections">
        <section>
          <SectionTitle title={query ? `Results for “${query}”` : "Trending searches"} />
          {query ? (
            <>
              {eventHits.length > 0 && <><h3 className="search-group-title">Events</h3><div className="search-results">{eventHits.map((event) => <Link href={`/events/${event.slug}`} key={event.id}><Trophy /><div><b>{event.title}</b><small>{event.category} · {event.date}</small></div><ChevronRight /></Link>)}</div></>}
              {categoriesHits.length > 0 && <><h3 className="search-group-title">Categories</h3><div className="search-results">{categoriesHits.map((cat) => <Link href={`/categories/${cat.name.toLowerCase().replaceAll(" ", "-")}`} key={cat.id}><Compass /><div><b>{cat.name}</b><small>Category</small></div><ChevronRight /></Link>)}</div></>}
              {results.length > 0 && <><h3 className="search-group-title">Channels</h3><div className="search-results">{results.map((s) => <Link href={`/streamers/${s.login || s.id}`} key={s.id}><Avatar streamer={s} /><div><b>{s.name}</b><small>Twitch · {s.category}</small></div>{s.live && <span className="live-badge">LIVE</span>}<ChevronRight /></Link>)}</div></>}
              {clipsHits.length > 0 && <><h3 className="search-group-title">Clips</h3><div className="search-results">{clipsHits.map((clip) => <a href={clip.url} target="_blank" rel="noreferrer" key={clip.id}><Play /><div><b>{clip.title}</b><small>{clip.broadcasterName}</small></div><ChevronRight /></a>)}</div></>}
              {(savedWatchspaces.length > 0 || savedEventHits.length > 0) && <><h3 className="search-group-title">Saved</h3><div className="search-results">
                {savedEventHits.map((event) => <Link href={`/events/${event.slug}`} key={`saved-${event.id}`}><Heart /><div><b>{event.title}</b><small>Saved event</small></div><ChevronRight /></Link>)}
                {savedWatchspaces.map((ws) => <Link href={`/multistream?load=${encodeURIComponent(ws.id)}`} key={ws.id}><Grid2X2 /><div><b>{ws.name}</b><small>Watchspace · {ws.streams.length} streams</small></div><ChevronRight /></Link>)}
              </div></>}
            </>
          ) : (
            <div className="trend-tags">{["Just Chatting", "IRL", "Valorant", "Music", "Multistream"].map((tag, i) => <button onClick={() => setQuery(tag)} key={tag}><b>0{i + 1}</b>{tag}<TrendingUp /></button>)}</div>
          )}
        </section>
        <aside>
          <SectionTitle title="Events" />
          <div className="search-category-list">{getTopLevelEvents().map((event) => <Link href={`/events/${event.slug}`} key={event.id}><span style={{ color: event.color }}>✦</span><b>{event.title}</b><small>{event.dayLabel || event.status}</small></Link>)}</div>
        </aside>
      </div>
    </div>
  );
}

function SearchPalette({ onClose }: { onClose: () => void }) {
  const { follows } = useAuth();
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<Streamer[]>([]);
  const [eventMatches, setEventMatches] = useState<Event[]>([]);
  const [categoryMatches, setCategoryMatches] = useState<Array<{ id: string; name: string }>>([]);
  const [clipMatches, setClipMatches] = useState<Array<{ id: string; title: string; url: string; broadcasterName: string }>>([]);
  const [savedMatches, setSavedMatches] = useState<Array<{ href: string; title: string; subtitle: string; kind: "event" | "watchspace" }>>([]);
  const paletteRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (query.trim().length < 2) {
      queueMicrotask(() => {
        setMatches([]);
        setEventMatches([]);
        setCategoryMatches([]);
        setClipMatches([]);
        setSavedMatches([]);
      });
      return;
    }
    const timer = window.setTimeout(() => {
      const normalized = query.trim();
      const q = normalized.toLowerCase();
      searchTwitchChannels(normalized)
        .then((channels) => setMatches(personalizeStreams(channels.slice(0, 4).map(channelSearchToStreamer), follows.map((f) => f.twitch_login))))
        .catch(() => setMatches([]));
      setEventMatches(getEventsCatalog().filter((event) => event.title.toLowerCase().includes(q)).slice(0, 3));
      void fetch(`/api/twitch/categories?first=100`).then(async (res) => {
        if (!res.ok) return [];
        const json = await res.json() as { data?: Array<{ id: string; name: string }> };
        return (json.data || []).filter((cat) => cat.name.toLowerCase().includes(q)).slice(0, 3);
      }).then(setCategoryMatches).catch(() => setCategoryMatches([]));
      void fetch(`/api/twitch/clips?first=12&days=7&featured=1`).then(async (res) => {
        if (!res.ok) return [];
        const json = await res.json() as { data?: Array<{ id: string; title: string; url: string; broadcasterName: string }> };
        return (json.data || []).filter((clip) => clip.title.toLowerCase().includes(q) || clip.broadcasterName?.toLowerCase().includes(q)).slice(0, 3);
      }).then(setClipMatches).catch(() => setClipMatches([]));
      const savedEvents = listSavedEventSlugs()
        .map((slug) => getEventBySlug(slug))
        .filter((event): event is Event => Boolean(event && event.title.toLowerCase().includes(q)))
        .slice(0, 2)
        .map((event) => ({ href: `/events/${event.slug}`, title: event.title, subtitle: "Saved event", kind: "event" as const }));
      const savedWs = listSavedWorkspaces()
        .filter((ws) => ws.name.toLowerCase().includes(q))
        .slice(0, 2)
        .map((ws) => ({ href: `/multistream?load=${encodeURIComponent(ws.id)}`, title: ws.name, subtitle: `Watchspace · ${ws.streams.length}`, kind: "watchspace" as const }));
      setSavedMatches([...savedEvents, ...savedWs]);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query, follows]);
  useEffect(() => {
    const modal = paletteRef.current;
    if (!modal) return;
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const focusable = [...modal.querySelectorAll<HTMLElement>("button, a[href], input")].filter((element) => !element.hasAttribute("disabled"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    modal.addEventListener("keydown", trapFocus);
    return () => modal.removeEventListener("keydown", trapFocus);
  }, []);
  return (
    <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Search SCU" onMouseDown={onClose}>
      <div ref={paletteRef} className="search-palette" onMouseDown={(e) => e.stopPropagation()}>
        <div className="palette-search">
          <label htmlFor="palette-query" className="sr-only">Search SCU</label>
          <Search />
          <input id="palette-query" autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search channels, events, clips..." />
          <button onClick={onClose} aria-label="Close search">ESC</button>
        </div>
        <div className="palette-body">
          <span>{query ? "Results" : "Jump to"}</span>
          {query ? (
            <>
              {eventMatches.map((event) => (
                <Link href={`/events/${event.slug}`} onClick={onClose} key={event.id}><Trophy /><div><b>{event.title}</b><small>Event</small></div><ChevronRight /></Link>
              ))}
              {categoryMatches.map((cat) => (
                <Link href={`/categories/${cat.name.toLowerCase().replaceAll(" ", "-")}`} onClick={onClose} key={cat.id}><Compass /><div><b>{cat.name}</b><small>Category</small></div><ChevronRight /></Link>
              ))}
              {matches.map((s) => (
                <Link href={`/streamers/${s.login || s.id}`} onClick={onClose} key={s.id}><Avatar streamer={s} /><div><b>{s.name}</b><small>{s.category}{s.live ? " · Live now" : ""}</small></div><ChevronRight /></Link>
              ))}
              {clipMatches.map((clip) => (
                <a href={clip.url} target="_blank" rel="noreferrer" onClick={onClose} key={clip.id}><Play /><div><b>{clip.title}</b><small>{clip.broadcasterName}</small></div><ChevronRight /></a>
              ))}
              {savedMatches.map((item) => (
                <Link href={item.href} onClick={onClose} key={`${item.kind}-${item.href}`}>
                  {item.kind === "event" ? <Heart /> : <Grid2X2 />}
                  <div><b>{item.title}</b><small>{item.subtitle}</small></div>
                  <ChevronRight />
                </Link>
              ))}
            </>
          ) : (
            nav.slice(1).map((item) => {
              const Icon = item.icon;
              return <Link href={item.href} onClick={onClose} key={item.href}><span className="result-icon"><Icon /></span><div><b>{item.label}</b><small>Open {item.label.toLowerCase()}</small></div><ChevronRight /></Link>;
            })
          )}
        </div>
        <footer><span>↑↓ Navigate</span><span>↵ Open</span><span>ESC Close</span></footer>
      </div>
    </div>
  );
}

function ThemeQuickToggle() {
  const { theme, setTheme } = useTheme();
  return <button className="icon-button" aria-label="Toggle color theme" onClick={() => setTheme(theme === "light" ? "night" : "light")}>{theme === "light" ? <Moon size={19} /> : <Sun size={19} />}</button>;
}

function NotFound() {
  return <div className="not-found"><span>404</span><div className="orbit-404" /><Tv2 /><h1>Lost in the universe?</h1><p>This page drifted out of range, but the live moments are still happening.</p><Link href="/" className="button primary">Return home</Link></div>;
}
