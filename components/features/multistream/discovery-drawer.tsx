"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, ChevronLeft, ChevronRight, ExternalLink, LoaderCircle, Plus, Search, UsersRound, X } from "lucide-react";
import { getEventBySlug, getEventChildren, getStudentLogins, getTopLevelEvents, type Streamer } from "@/lib/data";
import { channelSearchToStreamer, searchTwitchChannels, useTwitchStreams } from "@/components/features/twitch/use-twitch-data";
import { parseTwitchLogin } from "@/components/features/multistream/share-state";
import { StreamAvatar } from "@/components/features/multistream/stream-avatar";
import { SelectMenu, type SelectMenuGroup } from "@/components/ui/select-menu";
import styles from "./multistream.module.css";

export function DiscoveryDrawer({
  open,
  available,
  activeIds,
  eventStreams,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  available: Streamer[];
  activeIds: string[];
  eventStreams: Streamer[];
  onOpenChange: (open: boolean) => void;
  onAdd: (stream: Streamer) => void;
}) {
  const [tab, setTab] = useState<"top" | "followed" | "events">("top");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Streamer[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string>();
  const [categoryFilter, setCategoryFilter] = useState("All categories");
  const [eventFilter, setEventFilter] = useState("all");
  const followed = useTwitchStreams({ followed: true, first: 100, enabled: open && tab === "followed" });
  const studentLogins = useMemo(() => getStudentLogins(), []);
  const topLevelEvents = useMemo(() => getTopLevelEvents().filter((event) => event.status !== "ended"), []);
  const selectedEvent = eventFilter === "all" ? null : getEventBySlug(eventFilter);

  const selectedEventLogins = useMemo(() => {
    if (!selectedEvent) return [];
    if (selectedEvent.slug === "streamer-university") return studentLogins;
    if (selectedEvent.twitchParticipants.length) return selectedEvent.twitchParticipants;
    return [];
  }, [selectedEvent, studentLogins]);

  const filteredEventLive = useTwitchStreams({
    first: 100,
    userLogins: selectedEventLogins.length ? selectedEventLogins : undefined,
    enabled: open && tab === "events" && selectedEventLogins.length > 0 && !(selectedEvent?.slug === "streamer-university" && eventStreams.length > 0),
  });

  useEffect(() => {
    const normalized = parseTwitchLogin(query);
    if (!normalized) {
      queueMicrotask(() => {
        setResults([]);
        setSearchError(undefined);
      });
      return;
    }
    const timer = window.setTimeout(() => {
      setSearching(true);
      searchTwitchChannels(normalized)
        .then((channels) => { setResults(channels.map(channelSearchToStreamer)); setSearchError(undefined); })
        .catch((error) => setSearchError(error instanceof Error ? error.message : "Search failed."))
        .finally(() => setSearching(false));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const baseList = useMemo(() => {
    if (query.trim().length >= 2) return results;
    if (tab === "followed") return followed.streams;
    if (tab === "events") {
      if (eventFilter === "all") return [];
      if (selectedEvent?.slug === "streamer-university") return eventStreams.length ? eventStreams : filteredEventLive.streams;
      return filteredEventLive.streams;
    }
    return available;
  }, [available, eventFilter, eventStreams, filteredEventLive.streams, followed.streams, query, results, selectedEvent?.slug, tab]);

  const categories = useMemo(() => {
    const unique = Array.from(new Set(baseList.map((stream) => stream.category).filter(Boolean))).sort();
    return ["All categories", ...unique];
  }, [baseList]);

  useEffect(() => {
    if (categoryFilter !== "All categories" && !categories.includes(categoryFilter)) {
      setCategoryFilter("All categories");
    }
  }, [categories, categoryFilter]);

  useEffect(() => {
    setCategoryFilter((current) => (current === "All categories" ? current : "All categories"));
  }, [tab, eventFilter]);

  const list = useMemo(() => {
    if (categoryFilter === "All categories") return baseList;
    return baseList.filter((stream) => stream.category.toLowerCase() === categoryFilter.toLowerCase());
  }, [baseList, categoryFilter]);

  const categoryOptions = useMemo(() => categories.map((category) => ({ value: category, label: category })), [categories]);

  const eventGroups = useMemo<SelectMenuGroup[]>(() => [
    { options: [{ value: "all", label: "Choose an event" }] },
    ...topLevelEvents.map((event) => ({
      label: event.title,
      options: [
        { value: event.slug, label: event.title },
        ...getEventChildren(event.slug)
          .filter((child) => child.status !== "ended")
          .map((child) => ({ value: child.slug, label: `↳ ${child.title}`, indent: true })),
      ],
    })),
  ], [topLevelEvents]);

  if (!open) {
    return <aside className={styles.drawerRail}><button onClick={() => onOpenChange(true)} aria-label="Open stream discovery"><ChevronRight /><Search /><span>Add streams</span></button></aside>;
  }

  return (
    <aside className={styles.drawer}>
      <header className={styles.drawerHeader}>
        <div><b>Add a stream</b><span>{list.length} channels</span></div>
        <button onClick={() => onOpenChange(false)} aria-label="Minimize stream discovery"><ChevronLeft /></button>
      </header>
      <label className={styles.drawerSearch}>
        <span className="sr-only">Search Twitch channels</span>
        <Search />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Channel name or Twitch URL" />
        {searching ? <LoaderCircle className={styles.spin} /> : query && <button type="button" onClick={() => setQuery("")} aria-label="Clear search"><X /></button>}
      </label>
      <div className={styles.drawerTabs} aria-label="Stream source">
        <button aria-pressed={tab === "top"} onClick={() => setTab("top")}>Top live</button>
        <button aria-pressed={tab === "followed"} onClick={() => setTab("followed")}>Following</button>
        <button aria-pressed={tab === "events"} onClick={() => setTab("events")}>Events</button>
      </div>
      <div className={styles.drawerFilters}>
        <label>
          <span>Category</span>
          <SelectMenu
            value={categoryFilter}
            onChange={setCategoryFilter}
            options={categoryOptions}
            ariaLabel="Filter by category"
            fullWidth
            size="sm"
          />
        </label>
        <label>
          <span>Event</span>
          <SelectMenu
            value={eventFilter}
            onChange={(next) => {
              setEventFilter(next);
              setTab("events");
            }}
            groups={eventGroups}
            ariaLabel="Filter by event from Events"
            fullWidth
            size="sm"
          />
        </label>
      </div>
      {tab === "events" && (
        <Link href={selectedEvent ? `/events/${selectedEvent.slug}` : "/events"} className={styles.drawerNotice} onClick={() => onOpenChange(false)}>
          <ExternalLink size={12} /> Open in Events{selectedEvent ? ` · ${selectedEvent.title}` : ""}
        </Link>
      )}
      {tab === "followed" && followed.error && <a className={styles.drawerNotice} href="/api/auth/twitch/start">Connect Twitch to load followed channels</a>}
      {searchError && <p className={styles.drawerError} role="alert">{searchError}</p>}
      <div className={styles.drawerList}>
        {list.map((stream) => {
          const selected = activeIds.includes(stream.id);
          return (
            <button key={stream.id} type="button" disabled={selected} onClick={() => onAdd(stream)} className={styles.drawerItem}>
              <StreamAvatar stream={stream} size={40} className={styles.drawerAvatar} />
              <div className={styles.drawerItemCopy}>
                <b>{stream.name}</b>
                <small>{stream.live ? `${stream.viewers ? stream.viewers.toLocaleString() : "Live"} viewers` : "Channel"} · {stream.category || "Twitch"}</small>
              </div>
              <span className={styles.drawerItemAction} aria-hidden="true">{selected ? <Check size={16} /> : <Plus size={16} />}</span>
            </button>
          );
        })}
        {!list.length && !searching && (
          <div className={styles.drawerEmpty}>
            <UsersRound size={28} />
            <b>No channels found</b>
            <span>{tab === "events" ? (eventFilter === "all" ? "Pick an event from the Events list above." : "No mapped creators live for this event right now.") : "Try another search, category, or event."}</span>
          </div>
        )}
      </div>
    </aside>
  );
}
