import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { ChapterMeta, ChapterContent, LibraryManifest } from "$lib/types";

vi.mock("$lib/api", () => ({
  readChapter: vi.fn(),
  saveChapter: vi.fn(),
}));

vi.mock("$lib/stores/library.svelte", () => ({
  libraryStore: {
    library: null as LibraryManifest | null,
    chapterStats: {},
    error: null as string | null,
    patchActiveChapterStats: vi.fn(),
    syncChapterInLists: vi.fn((updated: ChapterMeta) => updated),
    saveManifest: vi.fn(async () => {}),
    chapterExists: vi.fn(() => true),
  },
}));

import * as api from "$lib/api";
import { libraryStore } from "$lib/stores/library.svelte";
import { ChapterStore } from "./chapter.svelte";

function meta(overrides: Partial<ChapterMeta> = {}): ChapterMeta {
  return {
    id: "ch-1",
    title: "Chapter One",
    status: "draft",
    order: 0,
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function fakeEditor(html: string) {
  return {
    getHTML: () => html,
    getText: () => html.replace(/<[^>]+>/g, ""),
  } as any;
}

describe("ChapterStore autosave + generation guard", () => {
  let store: ChapterStore;

  beforeEach(() => {
    vi.useFakeTimers();
    store = new ChapterStore();
    (libraryStore as any).library = { name: "Lib", version: 1, path: "/lib", chapters: [] };
    (libraryStore as any).chapterStats = {};
    (libraryStore as any).error = null;
    vi.mocked(api.readChapter).mockReset();
    vi.mocked(api.saveChapter).mockReset();
    vi.mocked(libraryStore.patchActiveChapterStats).mockClear();
    vi.mocked(libraryStore.syncChapterInLists).mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function openWithContent(content: ChapterContent) {
    (libraryStore as any).library = {
      name: "Lib",
      version: 1,
      path: "/lib",
      chapters: content.section === "chapters" ? [content.meta] : [],
    };
    vi.mocked(libraryStore.chapterExists).mockReturnValue(true);
    vi.mocked(api.readChapter).mockResolvedValue(content);
    await store.openChapter(content.meta.id);
  }

  it("does not schedule a flush until autoSaveMs has elapsed", async () => {
    await openWithContent({ meta: meta(), html: "<p>start</p>", section: "chapters" });
    vi.mocked(api.saveChapter).mockResolvedValue(meta());

    store.scheduleAutoSave(fakeEditor("<p>edited</p>"));
    await vi.advanceTimersByTimeAsync(500);
    expect(api.saveChapter).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(200);
    expect(api.saveChapter).toHaveBeenCalledTimes(1);
  });

  it("debounces rapid successive edits into a single save", async () => {
    await openWithContent({ meta: meta(), html: "<p>start</p>", section: "chapters" });
    vi.mocked(api.saveChapter).mockResolvedValue(meta());

    store.scheduleAutoSave(fakeEditor("<p>a</p>"));
    await vi.advanceTimersByTimeAsync(300);
    store.scheduleAutoSave(fakeEditor("<p>ab</p>"));
    await vi.advanceTimersByTimeAsync(300);
    store.scheduleAutoSave(fakeEditor("<p>abc</p>"));
    await vi.advanceTimersByTimeAsync(700);

    expect(api.saveChapter).toHaveBeenCalledTimes(1);
  });

  it("ignores a stale save response once a newer save has started", async () => {
    await openWithContent({ meta: meta(), html: "<p>start</p>", section: "chapters" });

    let resolveFirst!: (m: ChapterMeta) => void;
    vi.mocked(api.saveChapter).mockImplementationOnce(
      () => new Promise((resolve) => (resolveFirst = resolve)),
    );

    // First save: in flight, not yet resolved.
    store.bindEditor(() => fakeEditor("<p>v1</p>"));
    store.scheduleAutoSave(fakeEditor("<p>v1</p>"));
    await vi.advanceTimersByTimeAsync(600);
    expect(api.saveChapter).toHaveBeenCalledTimes(1);
    expect(store.saveStatus).toBe("saving");

    // A second edit arrives and queues behind the in-flight save.
    store.bindEditor(() => fakeEditor("<p>v2</p>"));
    store.scheduleAutoSave(fakeEditor("<p>v2</p>"));
    await vi.advanceTimersByTimeAsync(600);

    // The queued save can't start until the first one finishes, so still 1 call.
    expect(api.saveChapter).toHaveBeenCalledTimes(1);

    vi.mocked(api.saveChapter).mockResolvedValueOnce(meta({ title: "v2 saved" }));
    resolveFirst(meta({ title: "v1 saved" }));
    await vi.runOnlyPendingTimersAsync();
    await Promise.resolve();
    await Promise.resolve();

    // The queued v2 save should now have fired and won, not been clobbered by v1.
    expect(api.saveChapter).toHaveBeenCalledTimes(2);
    expect(store.saveStatus).toBe("saved");
  });

  it("stays unsaved when editor advanced past an in-flight save", async () => {
    await openWithContent({ meta: meta(), html: "<p>start</p>", section: "chapters" });

    let resolveFirst!: (m: ChapterMeta) => void;
    vi.mocked(api.saveChapter).mockImplementationOnce(
      () => new Promise((resolve) => (resolveFirst = resolve)),
    );

    store.bindEditor(() => fakeEditor("<p>v1</p>"));
    store.scheduleAutoSave(fakeEditor("<p>v1</p>"));
    await vi.advanceTimersByTimeAsync(600);
    expect(store.saveStatus).toBe("saving");

    store.bindEditor(() => fakeEditor("<p>v2</p>"));
    store.scheduleAutoSave(fakeEditor("<p>v2</p>"));

    resolveFirst(meta());
    await Promise.resolve();
    await Promise.resolve();

    expect(store.saveStatus).toBe("unsaved");
  });

  it("blocks openChapter when flush fails during prepareChapterSwitch", async () => {
    await openWithContent({ meta: meta(), html: "<p>start</p>", section: "chapters" });

    store.bindEditor(() => fakeEditor("<p>edited</p>"));
    store.pendingHtml = "<p>edited</p>";
    store.saveStatus = "unsaved";

    vi.mocked(api.saveChapter).mockRejectedValueOnce(new Error("disk full"));
    vi.mocked(api.readChapter).mockClear();
    const result = await store.openChapter("other-id");
    expect(result).toBeNull();
    expect(api.readChapter).not.toHaveBeenCalled();
    expect(store.activeChapterId).toBe("ch-1");
    expect(store.saveStatus).toBe("unsaved");
  });
});
