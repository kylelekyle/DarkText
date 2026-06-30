import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { LibraryManifest } from "$lib/types";

vi.mock("$lib/api", () => ({
  readChapterComments: vi.fn(),
  saveChapterComments: vi.fn(),
}));

vi.mock("$lib/stores/library.svelte", () => ({
  libraryStore: {
    library: null as LibraryManifest | null,
    chapterExists: vi.fn(() => true),
  },
}));

vi.mock("$lib/stores/chapter.svelte", () => ({
  chapterStore: {
    activeChapterId: "ch-1" as string | null,
    activeSection: "chapters" as const,
    isOpenGeneration: vi.fn(() => true),
  },
}));

import * as api from "$lib/api";
import { libraryStore } from "$lib/stores/library.svelte";
import { chapterStore } from "$lib/stores/chapter.svelte";
import { ReviewStore } from "./review.svelte";

describe("ReviewStore comment persistence", () => {
  let store: ReviewStore;

  beforeEach(() => {
    vi.useFakeTimers();
    store = new ReviewStore();
    (libraryStore as { library: LibraryManifest | null }).library = {
      name: "Lib",
      version: 1,
      path: "/lib",
      chapters: [],
    };
    (chapterStore as { activeChapterId: string | null }).activeChapterId = "ch-1";
    vi.mocked(libraryStore.chapterExists).mockReturnValue(true);
    vi.mocked(api.saveChapterComments).mockReset();
    vi.mocked(api.readChapterComments).mockReset();
    vi.mocked(api.saveChapterComments).mockResolvedValue({ threads: [], changes: [] });
    vi.mocked(api.readChapterComments).mockResolvedValue({ threads: [], changes: [] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("flushComments saves when debounce timer is still pending", async () => {
    store.onHtmlUpdated("<p>x</p>", { force: true });
    expect(api.saveChapterComments).not.toHaveBeenCalled();

    const ok = await store.flushComments();
    expect(ok).toBe(true);
    expect(api.saveChapterComments).toHaveBeenCalledTimes(1);
  });

  it("flushComments waits for an in-flight save before returning", async () => {
    let resolveSave!: (value: { threads: []; changes: [] }) => void;
    vi.mocked(api.saveChapterComments)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSave = resolve;
          }),
      )
      .mockResolvedValue({ threads: [], changes: [] });

    store.onHtmlUpdated("<p>x</p>", { force: true });
    await vi.advanceTimersByTimeAsync(800);
    expect(api.saveChapterComments).toHaveBeenCalledTimes(1);

    store.onHtmlUpdated("<p>y</p>", { force: true });
    const flushPromise = store.flushComments();
    resolveSave({ threads: [], changes: [] });
    await vi.advanceTimersByTimeAsync(0);
    const ok = await flushPromise;
    expect(ok).toBe(true);
    expect(api.saveChapterComments).toHaveBeenCalledTimes(2);
  });

  it("flushComments returns false when save fails", async () => {
    vi.mocked(api.saveChapterComments).mockRejectedValueOnce(new Error("disk full"));
    store.onHtmlUpdated("<p>x</p>", { force: true });

    const ok = await store.flushComments();
    expect(ok).toBe(false);
  });

  it("syncChangesPanelFromEditor syncs in review mode even when track is off", () => {
    store.trackChanges = false;
    store.showReviewPanel = true;
    const editor = {
      state: {
        doc: {
          descendants(fn: (node: { isText: boolean; text?: string; marks: { type: { name: string }; attrs: { markId: string } }[] }, pos: number) => void) {
            fn(
              {
                isText: true,
                text: "cut",
                marks: [{ type: { name: "deletion" }, attrs: { markId: "d1" } }],
              },
              1,
            );
          },
        },
      },
    } as unknown as import("@tiptap/core").Editor;

    store.syncChangesPanelFromEditor(editor);
    expect(store.chapterComments.changes).toHaveLength(1);
    expect(store.chapterComments.changes[0].type).toBe("deletion");
  });

  it("syncChangesPanelFromEditor enables flushComments to persist new changes", async () => {
    store.trackChanges = true;
    const editor = {
      state: {
        doc: {
          descendants(fn: (node: { isText: boolean; text?: string; marks: { type: { name: string }; attrs: { markId: string } }[] }, pos: number) => void) {
            fn(
              {
                isText: true,
                text: "new",
                marks: [{ type: { name: "insertion" }, attrs: { markId: "m1" } }],
              },
              1,
            );
          },
        },
      },
    } as unknown as import("@tiptap/core").Editor;

    store.syncChangesPanelFromEditor(editor);
    expect(store.chapterComments.changes).toHaveLength(1);
    const ok = await store.flushComments();
    expect(ok).toBe(true);
    expect(api.saveChapterComments).toHaveBeenCalledTimes(1);
  });

  it("tryLoadCommentsOnOpen clears stale state before applying fetched comments", async () => {
    store.chapterComments = {
      threads: [
        {
          id: "t1",
          markId: "m1",
          anchorText: "old",
          resolved: false,
          replies: [],
        },
      ],
      changes: [],
    };

    vi.mocked(api.readChapterComments).mockResolvedValueOnce({
      threads: [
        {
          id: "t2",
          markId: "m2",
          anchorText: "new",
          resolved: false,
          replies: [],
        },
      ],
      changes: [],
    });

    const ok = await store.tryLoadCommentsOnOpen(1);
    expect(ok).toBe(true);
    expect(store.chapterComments.threads).toHaveLength(1);
    expect(store.chapterComments.threads[0]?.id).toBe("t2");
  });
});