import type { Streamer } from "@/lib/data";
import type { CanvasTile, ChatPanel, ChatPlacement, LayoutTemplate } from "@/components/features/multistream/use-workspace";
import { createClient } from "@/lib/supabase/client";

function normalizeChatPlacement(value?: string): ChatPlacement {
  return value === "between" ? "between" : "side";
}

export interface SavedWorkspace {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  streams: Streamer[];
  template: LayoutTemplate;
  /** Panel-based chat layout (preferred). */
  chatPanels?: ChatPanel[];
  sideChatPanelIds?: string[];
  betweenChatPanelId?: string;
  canvasTiles?: CanvasTile[];
  /** Flattened open chat panes (compat). */
  chatStreamIds?: string[];
  /** @deprecated Prefer chatStreamIds / chatPanels; kept for older saved payloads. */
  chatStreamId?: string;
  chatPlacement?: ChatPlacement;
}

const STORAGE_KEY = "scu-multistream-saved-v1";
const MERGED_KEY = "scu-watchspaces-merged";
const MAX_SAVED = 24;

/** Fired whenever the saved-watchspace list changes, so any mounted page can refresh without prop drilling. */
export const WATCHSPACES_CHANGE_EVENT = "scu:watchspaces-changed";

function isWorkspace(value: unknown): value is SavedWorkspace {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<SavedWorkspace>;
  return Boolean(
    typeof record.id === "string"
    && typeof record.name === "string"
    && Array.isArray(record.streams)
    && (record.template === "auto" || record.template === "equal" || record.template === "focus"),
  );
}

function readAll(): SavedWorkspace[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isWorkspace);
  } catch {
    return [];
  }
}

function writeAll(workspaces: SavedWorkspace[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(workspaces));
  window.dispatchEvent(new CustomEvent(WATCHSPACES_CHANGE_EVENT));
}

function toPayload(workspace: SavedWorkspace) {
  return {
    streams: workspace.streams,
    template: workspace.template,
    chatPanels: workspace.chatPanels,
    sideChatPanelIds: workspace.sideChatPanelIds,
    betweenChatPanelId: workspace.betweenChatPanelId,
    canvasTiles: workspace.canvasTiles,
    chatStreamIds: workspace.chatStreamIds,
    chatStreamId: workspace.chatStreamIds?.[0] ?? workspace.chatStreamId,
    chatPlacement: workspace.chatPlacement,
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt,
  };
}

function fromRow(row: { id: string; name: string; payload: Record<string, unknown>; created_at: string; updated_at: string }): SavedWorkspace | null {
  const payload = row.payload || {};
  const candidate = {
    id: row.id,
    name: row.name,
    streams: payload.streams,
    template: payload.template,
    chatPanels: payload.chatPanels as ChatPanel[] | undefined,
    sideChatPanelIds: payload.sideChatPanelIds as string[] | undefined,
    betweenChatPanelId: payload.betweenChatPanelId as string | undefined,
    canvasTiles: payload.canvasTiles as CanvasTile[] | undefined,
    chatStreamIds: payload.chatStreamIds,
    chatStreamId: payload.chatStreamId,
    chatPlacement: payload.chatPlacement !== undefined
      ? normalizeChatPlacement(payload.chatPlacement as string)
      : undefined,
    createdAt: (payload.createdAt as string) || row.created_at,
    updatedAt: (payload.updatedAt as string) || row.updated_at,
  };
  return isWorkspace(candidate) ? candidate : null;
}

async function cloudUpsert(workspace: SavedWorkspace) {
  try {
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    await supabase.from("scu_watchspaces").upsert({
      id: workspace.id,
      user_id: auth.user.id,
      name: workspace.name,
      payload: toPayload(workspace),
      created_at: workspace.createdAt,
      updated_at: workspace.updatedAt,
    });
  } catch {
    // local-only fallback
  }
}

async function cloudDelete(id: string) {
  try {
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    await supabase.from("scu_watchspaces").delete().eq("user_id", auth.user.id).eq("id", id);
  } catch {
    // local-only fallback
  }
}

export function listSavedWorkspaces(): SavedWorkspace[] {
  return readAll().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getSavedWorkspace(id: string): SavedWorkspace | undefined {
  return readAll().find((workspace) => workspace.id === id);
}

export function saveWorkspace(input: {
  id?: string;
  name: string;
  streams: Streamer[];
  template: LayoutTemplate;
  chatPanels?: ChatPanel[];
  sideChatPanelIds?: string[];
  betweenChatPanelId?: string;
  canvasTiles?: CanvasTile[];
  chatStreamIds?: string[];
  chatStreamId?: string;
  chatPlacement?: ChatPlacement;
}): SavedWorkspace {
  const all = readAll();
  const now = new Date().toISOString();
  const existingIndex = input.id ? all.findIndex((workspace) => workspace.id === input.id) : -1;
  const chatStreamIds = input.chatStreamIds?.length
    ? input.chatStreamIds
    : input.chatPanels?.length
      ? input.chatPanels.flatMap((panel) => panel.streamIds)
      : input.chatStreamId
        ? [input.chatStreamId]
        : [];
  const record: SavedWorkspace = {
    id: existingIndex >= 0 && input.id ? input.id : `ws-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: input.name.trim().slice(0, 60) || "Untitled watchspace",
    streams: input.streams,
    template: input.template,
    chatPanels: input.chatPanels,
    sideChatPanelIds: input.sideChatPanelIds,
    betweenChatPanelId: input.betweenChatPanelId,
    canvasTiles: input.canvasTiles,
    chatStreamIds,
    chatStreamId: chatStreamIds[0],
    chatPlacement: normalizeChatPlacement(input.chatPlacement),
    createdAt: existingIndex >= 0 ? all[existingIndex].createdAt : now,
    updatedAt: now,
  };
  const next = existingIndex >= 0
    ? all.map((workspace, index) => (index === existingIndex ? record : workspace))
    : [record, ...all].slice(0, MAX_SAVED);
  writeAll(next);
  void cloudUpsert(record);
  return record;
}

export function renameSavedWorkspace(id: string, name: string) {
  const next = readAll().map((workspace) => workspace.id === id
    ? { ...workspace, name: name.trim().slice(0, 60) || workspace.name, updatedAt: new Date().toISOString() }
    : workspace);
  writeAll(next);
  const updated = next.find((workspace) => workspace.id === id);
  if (updated) void cloudUpsert(updated);
}

export function deleteSavedWorkspace(id: string) {
  writeAll(readAll().filter((workspace) => workspace.id !== id));
  void cloudDelete(id);
}

/** Hydrate local cache from cloud after sign-in; merges local → cloud once. */
export async function hydrateWatchspacesFromCloud(): Promise<SavedWorkspace[]> {
  if (typeof window === "undefined") return [];
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return listSavedWorkspaces();

  const { data, error } = await supabase
    .from("scu_watchspaces")
    .select("id, name, payload, created_at, updated_at")
    .eq("user_id", auth.user.id)
    .order("updated_at", { ascending: false });
  if (error) return listSavedWorkspaces();

  const cloud = ((data || []) as Array<{ id: string; name: string; payload: Record<string, unknown>; created_at: string; updated_at: string }>)
    .map(fromRow)
    .filter((row): row is SavedWorkspace => Boolean(row));
  const byId = new Map(cloud.map((workspace) => [workspace.id, workspace]));
  const local = readAll();
  const merged = !window.localStorage.getItem(MERGED_KEY);

  if (merged) {
    for (const workspace of local) {
      if (!byId.has(workspace.id)) {
        await cloudUpsert(workspace);
        byId.set(workspace.id, workspace);
      }
    }
    window.localStorage.setItem(MERGED_KEY, "1");
  }

  const next = [...byId.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, MAX_SAVED);
  writeAll(next);
  return next;
}
