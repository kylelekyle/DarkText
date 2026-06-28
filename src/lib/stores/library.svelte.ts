import * as api from "$lib/api";
import { fontStore } from "$lib/stores/fonts.svelte";
import { addRecentLibrary } from "$lib/utils/recentLibraries";
import { formatError } from "$lib/utils/errors";
import { loadChapterStats, statsFromHtml } from "$lib/utils/stats";
import {
  findChapterSection,
  getSectionList,
  mapSectionList,
  type SectionLists,
} from "$lib/utils/sectionOps";
import { open } from "@tauri-apps/plugin-dialog";
import type { AppSettings } from "$lib/utils/appSettings";
import {
  preferencesFromSettings,
  settingsFromPreferences,
} from "$lib/utils/libraryPrefs";
import type {
  BookSettings,
  ChapterMeta,
  ChapterSection,
  ChapterStats,
  ChapterStatus,
  LibraryManifest,
} from "$lib/types";

export const defaultBookSettings: BookSettings = {
  title: "",
  author: "",
  includeFrontMatter: true,
  includeBackMatter: false,
  wordGoal: 0,
};

export type LibraryToast = (msg: string) => void;

export class LibraryStore {
  library = $state<LibraryManifest | null>(null);
  researchChapters = $state<ChapterMeta[]>([]);
  characterChapters = $state<ChapterMeta[]>([]);
  researchFilter = $state("");
  characterFilter = $state("");
  chapterFilter = $state("");
  bookSettings = $state<BookSettings>({ ...defaultBookSettings });
  chapterStats = $state<Record<string, ChapterStats>>({});
  error = $state<string | null>(null);

  private reorderTimer: ReturnType<typeof setTimeout> | null = null;
  private toast: LibraryToast = () => {};

  bindToast(fn: LibraryToast) {
    this.toast = fn;
  }

  showToast(msg: string) {
    this.toast(msg);
  }

  private sectionLists(): SectionLists {
    return {
      chapters: this.library?.chapters ?? [],
      research: this.researchChapters,
      characters: this.characterChapters,
    };
  }

  private applySectionLists(lists: SectionLists) {
    if (this.library) {
      this.library = { ...this.library, chapters: lists.chapters };
    }
    this.researchChapters = lists.research;
    this.characterChapters = lists.characters;
  }

  get filteredResearch(): ChapterMeta[] {
    const q = this.researchFilter.trim().toLowerCase();
    if (!q) return this.researchChapters;
    return this.researchChapters.filter((c) =>
      c.title.toLowerCase().includes(q),
    );
  }

  get filteredChapters(): ChapterMeta[] {
    const q = this.chapterFilter.trim().toLowerCase();
    const list = this.library?.chapters ?? [];
    if (!q) return list;
    return list.filter((c) => c.title.toLowerCase().includes(q));
  }

  get filteredCharacters(): ChapterMeta[] {
    const q = this.characterFilter.trim().toLowerCase();
    if (!q) return this.characterChapters;
    return this.characterChapters.filter((c) =>
      c.title.toLowerCase().includes(q),
    );
  }

  get finalChapters(): ChapterMeta[] {
    return (this.library?.chapters ?? []).filter((c) => c.status === "final");
  }

  reset() {
    if (this.reorderTimer) clearTimeout(this.reorderTimer);
    this.reorderTimer = null;
    this.library = null;
    this.researchChapters = [];
    this.characterChapters = [];
    this.chapterFilter = "";
    this.researchFilter = "";
    this.characterFilter = "";
    this.bookSettings = { ...defaultBookSettings };
    this.chapterStats = {};
    this.error = null;
    fontStore.setLibraryPath(null);
  }

  async loadBookSettings() {
    if (!this.library) return;
    this.bookSettings = await api.getBookSettings(this.library.path);
  }

  async saveBookSettings(settings: BookSettings) {
    if (!this.library) return;
    this.bookSettings = await api.saveBookSettings(this.library.path, settings);
  }

  async syncPreferencesToBook(appSettings: AppSettings) {
    if (!this.library) return;
    const settings: BookSettings = {
      ...this.bookSettings,
      preferences: preferencesFromSettings(appSettings),
    };
    this.bookSettings = await api.saveBookSettings(this.library.path, settings);
  }

  mergeLibraryPreferences(appSettings: AppSettings): AppSettings {
    return settingsFromPreferences(this.bookSettings.preferences, appSettings);
  }

  async refreshResearch() {
    if (!this.library) return;
    this.researchChapters = await api.listResearchChapters(this.library.path);
  }

  async refreshCharacters() {
    if (!this.library) return;
    this.characterChapters = await api.listCharacterChapters(this.library.path);
  }

  syncChapterInLists(
    updated: ChapterMeta,
    activeChapterMeta: ChapterMeta | null,
  ): ChapterMeta | null {
    if (!this.library) return activeChapterMeta;
    const section = findChapterSection(updated.id, this.sectionLists());
    if (!section) return activeChapterMeta;
    const lists = this.sectionLists();
    const next = mapSectionList(section, lists, (chapters) =>
      chapters.map((ch) => (ch.id === updated.id ? updated : ch)),
    );
    this.applySectionLists(next);
    if (activeChapterMeta?.id === updated.id) return updated;
    return activeChapterMeta;
  }

  chapterExists(chapterId: string, section: ChapterSection): boolean {
    if (!this.library) return false;
    const lists = this.sectionLists();
    if (section === "chapters") {
      return lists.chapters.some((c) => c.id === chapterId);
    }
    if (section === "research") {
      return lists.research.some((c) => c.id === chapterId);
    }
    return lists.characters.some((c) => c.id === chapterId);
  }

  refreshBookStats(
    activeChapterId: string | null,
    activeSection: ChapterSection,
    pendingHtml: string | null,
    activeChapterHtml: string,
  ) {
    if (!this.library) return;
    const loaded = loadChapterStats(
      this.library.chapters,
      activeSection === "chapters" ? (activeChapterId ?? undefined) : undefined,
    );
    const merged = { ...loaded };
    if (activeChapterId && activeSection === "chapters") {
      const html = pendingHtml ?? activeChapterHtml;
      merged[activeChapterId] = statsFromHtml(html);
    }
    this.chapterStats = merged;
  }

  updateActiveChapterStats(
    activeChapterId: string | null,
    activeSection: ChapterSection,
    pendingHtml: string | null,
    activeChapterHtml: string,
  ) {
    if (!activeChapterId || activeSection !== "chapters") return;
    const html = pendingHtml ?? activeChapterHtml;
    this.chapterStats = {
      ...this.chapterStats,
      [activeChapterId]: statsFromHtml(html),
    };
  }

  patchActiveChapterStats(
    activeChapterId: string | null,
    activeSection: ChapterSection,
    words: number,
    chars: number,
  ) {
    if (!activeChapterId || activeSection !== "chapters") return;
    this.chapterStats = {
      ...this.chapterStats,
      [activeChapterId]: { words, chars },
    };
  }

  async createLibrary(path: string, name: string) {
    this.error = null;
    const manifest = await api.createLibrary(path, name);
    this.library = manifest;
    addRecentLibrary(path);
    await this.refreshResearch();
    await this.refreshCharacters();
    await this.loadBookSettings();
    fontStore.setLibraryPath(path);
    return manifest;
  }

  async openLibrary(path: string) {
    this.error = null;
    const manifest = await api.openLibrary(path);
    this.library = manifest;
    addRecentLibrary(path);
    await this.refreshResearch();
    await this.refreshCharacters();
    await this.loadBookSettings();
    fontStore.setLibraryPath(path);
    return manifest;
  }

  async importCustomFont() {
    if (!this.library) {
      this.toast("Open a Library first");
      return;
    }
    const selected = await open({
      multiple: false,
      title: "Load Custom Font",
      filters: [{ name: "Fonts", extensions: ["ttf", "otf", "woff", "woff2"] }],
    });
    if (typeof selected !== "string") return;
    try {
      const font = await api.importLibraryFont(this.library.path, selected);
      await fontStore.refreshLibrary(this.library.path);
      this.toast(`Added font: ${font.family}`);
    } catch (e) {
      this.toast(formatError(e));
    }
  }

  async newChapter(title: string | undefined, section: ChapterSection) {
    if (!this.library) return null;
    const content = await api.createChapter(this.library.path, title, section);
    const lists = this.sectionLists();
    const next = mapSectionList(section, lists, (chapters) => [
      ...chapters,
      content.meta,
    ]);
    this.applySectionLists(next);
    return content;
  }

  async deleteChapter(
    chapterId: string,
    section: ChapterSection,
  ): Promise<LibraryManifest | null> {
    if (!this.library) return null;
    if (section === "chapters") {
      const manifest = await api.deleteChapter(this.library.path, chapterId, section);
      this.library = { ...manifest, chapters: [...manifest.chapters] };
      const { [chapterId]: _, ...rest } = this.chapterStats;
      this.chapterStats = rest;
      return manifest;
    }
    await api.deleteChapter(this.library.path, chapterId, section);
    const lists = this.sectionLists();
    const next = mapSectionList(section, lists, (chapters) =>
      chapters.filter((c) => c.id !== chapterId),
    );
    this.applySectionLists(next);
    return null;
  }

  async duplicateChapter(chapterId: string, section: ChapterSection) {
    if (!this.library) return null;
    const content = await api.duplicateChapter(this.library.path, chapterId, section);
    const lists = this.sectionLists();
    const next = mapSectionList(section, lists, (chapters) => [
      ...chapters,
      content.meta,
    ]);
    this.applySectionLists(next);
    if (section === "chapters") {
      this.chapterStats = {
        ...this.chapterStats,
        [content.meta.id]: statsFromHtml(content.html),
      };
    }
    return content;
  }

  getChapterStatus(
    chapterId: string,
    section: ChapterSection,
  ): ChapterStatus | null {
    const list = getSectionList(section, this.sectionLists());
    return list.find((ch) => ch.id === chapterId)?.status ?? null;
  }

  setChapterStatus(
    chapterId: string,
    status: ChapterStatus,
    section: ChapterSection,
    activeChapterMeta: ChapterMeta | null,
  ): ChapterMeta | null {
    if (!this.library) return activeChapterMeta;
    const lists = this.sectionLists();
    const next = mapSectionList(section, lists, (chapters) =>
      chapters.map((ch) => (ch.id === chapterId ? { ...ch, status } : ch)),
    );
    this.applySectionLists(next);
    if (activeChapterMeta?.id === chapterId) {
      return { ...activeChapterMeta, status };
    }
    return activeChapterMeta;
  }

  updateChapterTitle(
    chapterId: string,
    title: string,
    section: ChapterSection,
    activeChapterMeta: ChapterMeta | null,
  ): ChapterMeta | null {
    if (!this.library) return activeChapterMeta;
    const lists = this.sectionLists();
    const next = mapSectionList(section, lists, (chapters) =>
      chapters.map((ch) => (ch.id === chapterId ? { ...ch, title } : ch)),
    );
    this.applySectionLists(next);
    if (activeChapterMeta?.id === chapterId) {
      return { ...activeChapterMeta, title };
    }
    return activeChapterMeta;
  }

  reorderChapters(chapterIds: string[], section: ChapterSection) {
    if (!this.library) return;

    const reorder = (list: ChapterMeta[]) => {
      const map = new Map(list.map((c) => [c.id, c]));
      return chapterIds
        .map((id, order) => {
          const ch = map.get(id);
          return ch ? { ...ch, order } : null;
        })
        .filter((c): c is ChapterMeta => c !== null);
    };

    const lists = this.sectionLists();
    const next = mapSectionList(section, lists, reorder);
    const prevChapters = getSectionList(section, lists);
    this.applySectionLists(next);

    const path = this.library.path;
    if (this.reorderTimer) clearTimeout(this.reorderTimer);
    this.reorderTimer = setTimeout(() => {
      if (!this.library || this.library.path !== path) return;
      void api
        .reorderChapters(path, chapterIds, section)
        .then(async (manifest) => {
          if (this.library?.path !== path) return;
          if (section === "chapters") {
            this.library = manifest;
          } else if (section === "research") {
            await this.refreshResearch();
          } else {
            await this.refreshCharacters();
          }
        })
        .catch((e) => {
          const rollback = mapSectionList(section, this.sectionLists(), () => prevChapters);
          this.applySectionLists(rollback);
          this.toast(formatError(e));
        });
    }, 300);
  }

  async saveManifest() {
    if (!this.library) return;
    await api.saveLibraryManifest(this.library);
  }
}

export const libraryStore = new LibraryStore();