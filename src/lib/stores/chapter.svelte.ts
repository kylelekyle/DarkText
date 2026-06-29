import type { Editor } from "@tiptap/core";
import * as api from "$lib/api";
import { libraryStore } from "$lib/stores/library.svelte";
import { countWords, estimatePages, htmlToPlain, statsFromHtml } from "$lib/utils/stats";
import { sanitizeHtmlForDisplay } from "$lib/export/sanitizeHtml";
import { formatError } from "$lib/utils/errors";
import { defaultAppSettings, type AppSettings } from "$lib/utils/appSettings";
import type { ChapterContent, ChapterMeta, ChapterSection } from "$lib/types";

export type ChapterToast = (msg: string) => void;
export type OnHtmlChange = (html: string) => void;

export class ChapterStore {
  activeChapterId = $state<string | null>(null);
  activeSection = $state<ChapterSection>("chapters");
  activeChapterMeta = $state<ChapterMeta | null>(null);
  activeChapterHtml = $state("");
  pendingHtml = $state<string | null>(null);
  saveStatus = $state<"saved" | "saving" | "unsaved">("saved");
  wordCount = $state(0);
  charCount = $state(0);
  editorRevision = $state(0);

  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private statsTimer: ReturnType<typeof setTimeout> | null = null;
  private saveGen = 0;
  private chapterOpenGen = 0;
  private saveInFlight = false;
  private saveQueued = false;
  private toast: ChapterToast = () => {};
  private onHtmlChange: OnHtmlChange = () => {};
  private getSettings: () => AppSettings = () => ({ ...defaultAppSettings });
  private getEditor: () => Editor | null = () => null;

  bindToast(fn: ChapterToast) {
    this.toast = fn;
  }

  bindOnHtmlChange(fn: OnHtmlChange) {
    this.onHtmlChange = fn;
  }

  bindSettings(getter: () => AppSettings) {
    this.getSettings = getter;
  }

  bindEditor(getter: () => Editor | null) {
    this.getEditor = getter;
  }

  get hasUnsavedChanges(): boolean {
    return this.saveStatus === "unsaved";
  }

  get chapterCharCount(): number {
    return this.charCount;
  }

  get chapterPages(): number {
    return estimatePages(this.wordCount);
  }

  reset() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = null;
    this.chapterOpenGen++;
    this.saveGen++;
    this.activeChapterId = null;
    this.activeSection = "chapters";
    this.activeChapterMeta = null;
    this.activeChapterHtml = "";
    this.pendingHtml = null;
    this.saveStatus = "saved";
    this.wordCount = 0;
    this.charCount = 0;
    this.editorRevision = 0;
    this.saveInFlight = false;
    this.saveQueued = false;
  }

  /** Invalidate any in-flight open/switch (e.g. before delete). */
  cancelPendingOpen() {
    this.chapterOpenGen++;
  }

  clearActiveChapter() {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    if (this.statsTimer) {
      clearTimeout(this.statsTimer);
      this.statsTimer = null;
    }
    this.saveInFlight = false;
    this.saveQueued = false;
    this.chapterOpenGen++;
    this.activeChapterId = null;
    this.activeSection = "chapters";
    this.activeChapterMeta = null;
    this.activeChapterHtml = "";
    this.pendingHtml = null;
    this.saveStatus = "saved";
    this.wordCount = 0;
    this.charCount = 0;
    this.editorRevision++;
  }

  /** Cancel pending/in-flight saves so a delete cannot be undone by a late auto-save. */
  abortSavesForDeletedChapter(chapterId: string, section: ChapterSection) {
    if (this.activeChapterId !== chapterId || this.activeSection !== section) return;
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    if (this.statsTimer) {
      clearTimeout(this.statsTimer);
      this.statsTimer = null;
    }
    this.saveGen++;
    this.saveInFlight = false;
    this.saveQueued = false;
    this.pendingHtml = null;
    this.saveStatus = "saved";
  }

  private capturePendingHtml(): string | null {
    const editor = this.getEditor();
    if (!editor || editor.isDestroyed) return this.pendingHtml;
    const html = editor.getHTML();
    this.pendingHtml = html;
    this.onHtmlChange(html);
    return html;
  }

  applyEditorStyles(spellcheck: boolean, fontFamily: string, fontSize: string) {
    requestAnimationFrame(() => {
      const el = document.querySelector(".chapter-prose") as HTMLElement | null;
      if (!el) return;
      el.spellcheck = spellcheck;
      el.style.fontFamily = fontFamily;
      el.style.fontSize = fontSize;
    });
  }

  async prepareChapterSwitch(): Promise<boolean> {
    if (
      (this.saveStatus === "unsaved" || this.saveStatus === "saving") &&
      this.activeChapterMeta
    ) {
      if (this.saveTimer) {
        clearTimeout(this.saveTimer);
        this.saveTimer = null;
      }
      const ok = await this.flushSave();
      if (!ok) return false;
    }
    return true;
  }

  private commitChapterContent(
    content: ChapterContent,
    gen: number,
  ): { gen: number; content: ChapterContent } {
    this.activeChapterId = content.meta.id;
    this.activeSection = content.section;
    this.activeChapterMeta = content.meta;
    const safeHtml = sanitizeHtmlForDisplay(content.html);
    this.activeChapterHtml = safeHtml;
    this.pendingHtml = safeHtml;
    this.saveStatus = "saved";
    this.editorRevision++;
    const plain = htmlToPlain(content.html);
    this.wordCount = countWords(plain);
    this.charCount = plain.length;
    libraryStore.patchActiveChapterStats(
      this.activeChapterId,
      this.activeSection,
      this.wordCount,
      this.charCount,
    );

    const settings = this.getSettings();
    this.applyEditorStyles(
      settings.spellcheck,
      settings.defaultFontFamily,
      settings.defaultFontSize,
    );

    return { gen, content };
  }

  applyChapterContent(
    content: ChapterContent,
  ): { gen: number; content: ChapterContent } | null {
    const gen = ++this.chapterOpenGen;
    return this.commitChapterContent(content, gen);
  }

  async openChapter(chapterId: string, section: ChapterSection = "chapters") {
    if (!libraryStore.library) return;

    if (!(await this.prepareChapterSwitch())) return null;

    const gen = ++this.chapterOpenGen;
    const libraryPath = libraryStore.library.path;

    try {
      const content = await api.readChapter(libraryPath, chapterId, section);
      if (gen !== this.chapterOpenGen) return null;
      return this.commitChapterContent(content, gen);
    } catch (e) {
      if (gen === this.chapterOpenGen) {
        libraryStore.error = formatError(e);
        this.toast(formatError(e));
      }
      return null;
    }
  }

  scheduleAutoSave(editor: Editor) {
    this.saveStatus = "unsaved";

    if (this.statsTimer) clearTimeout(this.statsTimer);
    const statsChapterId = this.activeChapterId;
    const statsSection = this.activeSection;
    this.statsTimer = setTimeout(() => {
      this.statsTimer = null;
      if (
        this.activeChapterId !== statsChapterId ||
        this.activeSection !== statsSection
      ) {
        return;
      }
      const stats = statsFromHtml(editor.getHTML());
      this.wordCount = stats.words;
      this.charCount = stats.chars;
      libraryStore.patchActiveChapterStats(
        statsChapterId,
        statsSection,
        this.wordCount,
        this.charCount,
      );
    }, 200);

    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      void this.flushSave();
    }, this.getSettings().autoSaveMs);
  }

  async flushSave(): Promise<boolean> {
    if (!libraryStore.library || !this.activeChapterMeta || !this.activeChapterId) {
      return true;
    }
    if (
      !libraryStore.chapterExists(this.activeChapterId, this.activeSection)
    ) {
      return true;
    }
    if (this.saveStatus === "unsaved") {
      if (!this.capturePendingHtml()) return false;
    } else if (this.pendingHtml === null) {
      return true;
    }
    if (this.saveInFlight) {
      this.saveQueued = true;
      while (this.saveInFlight) {
        await new Promise((r) => setTimeout(r, 0));
      }
      if (this.saveStatus === "unsaved") {
        return this.flushSave();
      }
      return this.saveStatus === "saved";
    }

    const gen = ++this.saveGen;
    const html = this.pendingHtml;
    if (!html) return true;

    const meta = this.activeChapterMeta;
    const section = this.activeSection;
    const path = libraryStore.library.path;

    this.saveInFlight = true;
    this.saveStatus = "saving";

    let ok = false;
    try {
      const updated = await api.saveChapter(path, meta, html, section);
      if (gen !== this.saveGen || html !== this.pendingHtml) {
        this.saveStatus = "unsaved";
        ok = false;
      } else {
        this.activeChapterMeta = libraryStore.syncChapterInLists(
          updated,
          this.activeChapterMeta,
        );
        if (this.activeSection === "chapters" && updated.id) {
          libraryStore.chapterStats = {
            ...libraryStore.chapterStats,
            [updated.id]: {
              words: updated.wordCount ?? 0,
              chars: updated.charCount ?? 0,
            },
          };
        }
        libraryStore.patchActiveChapterStats(
          this.activeChapterId,
          this.activeSection,
          updated.wordCount ?? this.wordCount,
          updated.charCount ?? this.charCount,
        );
        this.activeChapterHtml = html;
        const liveHtml = this.getEditor()?.getHTML();
        if (liveHtml && liveHtml !== html) {
          this.saveStatus = "unsaved";
          ok = false;
        } else {
          this.saveStatus = "saved";
          ok = true;
        }
      }
    } catch (e) {
      if (gen === this.saveGen) {
        this.saveStatus = "unsaved";
        if (
          !this.activeChapterId ||
          libraryStore.chapterExists(this.activeChapterId, this.activeSection)
        ) {
          libraryStore.error = formatError(e);
          this.toast(formatError(e));
        }
      }
      ok = false;
    } finally {
      this.saveInFlight = false;
    }

    if (this.saveQueued) {
      this.saveQueued = false;
      return this.flushSave();
    }
    return ok;
  }

  async saveAll() {
    await this.flushSave();
    try {
      await libraryStore.saveManifest();
      if (this.saveStatus !== "unsaved") this.saveStatus = "saved";
    } catch (e) {
      this.saveStatus = "unsaved";
      libraryStore.error = formatError(e);
      this.toast(formatError(e));
      throw e;
    }
  }

  discardUnsaved() {
    this.pendingHtml = null;
    this.saveStatus = "saved";
    if (this.activeChapterMeta) this.editorRevision++;
  }

  isOpenGeneration(gen: number): boolean {
    return gen === this.chapterOpenGen;
  }

  getOpenGeneration(): number {
    return this.chapterOpenGen;
  }
}

export const chapterStore = new ChapterStore();