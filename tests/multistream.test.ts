import { describe, expect, it } from "vitest";
import {
  buildLayoutTree,
  canPlaceChatBetween,
  normalizeChatPlacement,
  normalizeChatStreamIds,
  type LayoutNode,
} from "../components/features/multistream/use-workspace";
import {
  parseSharedWorkspace,
  parseTwitchLogin,
  serializeSharedWorkspace,
} from "../components/features/multistream/share-state";
import type { Streamer } from "../lib/data";

function paneIds(node: LayoutNode | null): string[] {
  if (!node) return [];
  return node.type === "pane" ? [node.streamId] : [...paneIds(node.first), ...paneIds(node.second)];
}

describe("multistream layout templates", () => {
  it("keeps every stream in stable order for one through six panes", () => {
    for (let count = 1; count <= 6; count += 1) {
      const ids = Array.from({ length: count }, (_, index) => `stream-${index}`);
      expect(paneIds(buildLayoutTree(ids, "auto"))).toEqual(ids);
    }
  });

  it("creates a hero plus stacked pair for three streams", () => {
    const tree = buildLayoutTree(["hero", "second", "third"], "auto");
    expect(tree).toMatchObject({
      type: "split",
      orientation: "horizontal",
      first: { type: "pane", streamId: "hero" },
      second: { type: "split", orientation: "vertical" },
    });
  });

  it("focuses the selected stream", () => {
    expect(buildLayoutTree(["one", "two"], "focus", "two")).toMatchObject({ type: "pane", streamId: "two" });
  });
});

describe("multi-chat workspace helpers", () => {
  const streams = [
    { id: "a", platform: "Twitch" as const },
    { id: "b", platform: "Twitch" as const },
    { id: "c", platform: "YouTube" as const },
  ] as unknown as Streamer[];

  it("prefers chatStreamIds and drops missing or non-Twitch ids", () => {
    expect(normalizeChatStreamIds(streams, ["b", "a", "b", "c", "missing"], "a")).toEqual(["b", "a"]);
  });

  it("falls back to legacy chatStreamId", () => {
    expect(normalizeChatStreamIds(streams, undefined, "a")).toEqual(["a"]);
  });

  it("allows chat-between only for two-pane non-focus layouts", () => {
    const two = [{ id: "a" }, { id: "b" }] as Streamer[];
    expect(canPlaceChatBetween(two, "auto")).toBe(true);
    expect(canPlaceChatBetween(two, "focus")).toBe(false);
    expect(canPlaceChatBetween([{ id: "a" }] as Streamer[], "auto")).toBe(false);
    expect(normalizeChatPlacement("between")).toBe("between");
    expect(normalizeChatPlacement("side")).toBe("side");
    expect(normalizeChatPlacement(undefined)).toBe("side");
  });
});

describe("share state and Twitch channel parsing", () => {
  it("accepts Twitch URLs and canonical logins", () => {
    expect(parseTwitchLogin("https://www.twitch.tv/KaiCenat/videos")).toBe("kaicenat");
    expect(parseTwitchLogin("hasanabi")).toBe("hasanabi");
    expect(parseTwitchLogin("not a channel")).toBeNull();
  });

  it("deduplicates, validates, and caps shared channels", () => {
    const parsed = parseSharedWorkspace("?streams=one,two,one,three,four,five,six,seven,bad%20login&layout=equal&chat=two");
    expect(parsed.logins).toEqual(["one", "two", "three", "four", "five", "six"]);
    expect(parsed.layout).toBe("equal");
    expect(parsed.chat).toBe("two");
    expect(parsed.chats).toEqual(["two"]);
  });

  it("parses multiple chats from share links", () => {
    const parsed = parseSharedWorkspace("?streams=one,two,three&chats=three,one&layout=auto");
    expect(parsed.chats).toEqual(["three", "one"]);
    expect(parsed.chat).toBe("three");
  });

  it("round-trips a valid workspace without selecting an absent chat", () => {
    const query = serializeSharedWorkspace({ logins: ["one", "two"], layout: "focus", chats: ["missing"], chat: "missing" });
    expect(parseSharedWorkspace(query)).toEqual({ logins: ["one", "two"], layout: "focus", chats: [], chat: undefined, chatPlacement: undefined });
  });

  it("round-trips chat-between placement in share links", () => {
    const query = serializeSharedWorkspace({
      logins: ["one", "two"],
      layout: "auto",
      chats: ["one"],
      chatPlacement: "between",
    });
    expect(parseSharedWorkspace(query)).toMatchObject({
      logins: ["one", "two"],
      chats: ["one"],
      chatPlacement: "between",
    });
  });
});
