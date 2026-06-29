import * as api from "$lib/api";
import type {
  ChapterComments,
  ChapterMeta,
  ChapterSection,
  CommentThread,
  LibraryManifest,
} from "$lib/types";
import { isTauriRuntime } from "$lib/utils/platform";
import { stripReviewMarks as stripReviewMarksLocal } from "./stripReviewMarks";

export interface LoadedChapter {
  meta: ChapterMeta;
  html: string;
  section: ChapterSection;
}

export interface HandoffBundle {
  manifest: LibraryManifest;
  chapters: LoadedChapter[];
  research: LoadedChapter[];
  characters: LoadedChapter[];
  threads: CommentThread[];
  changeMetaByMarkId: Map<string, { author: string; date: string }>;
}

/** Prefer Rust compile::strip_review_marks when running inside Tauri. */
export async function stripForPublish(html: string): Promise<string> {
  if (isTauriRuntime()) {
    return api.stripReviewMarksHtml(html);
  }
  return stripReviewMarksLocal(html);
}

export async function stripManyForPublish(htmlChunks: string[]): Promise<string[]> {
  if (htmlChunks.length === 0) return [];
  return Promise.all(htmlChunks.map((html) => stripForPublish(html)));
}

export async function loadChaptersBulk(
  libraryPath: string,
  metas: ChapterMeta[],
  section: ChapterSection,
): Promise<LoadedChapter[]> {
  if (!metas.length) return [];
  const contents = await api.readChaptersBulk(
    libraryPath,
    metas.map((m) => m.id),
    section,
  );
  return contents.map((c) => ({
    meta: c.meta,
    html: c.html,
    section: c.section,
  }));
}

export async function loadCommentsBulk(
  libraryPath: string,
  metas: ChapterMeta[],
  section: ChapterSection,
): Promise<Map<string, ChapterComments>> {
  const map = new Map<string, ChapterComments>();
  if (!metas.length) return map;
  const rows = await api.readCommentsBulk(
    libraryPath,
    metas.map((m) => m.id),
    section,
  );
  for (const row of rows) {
    map.set(row.chapterId, row.comments);
  }
  return map;
}

function mergeChangeMeta(
  comments: ChapterComments,
  reviewerName: string,
  target: Map<string, { author: string; date: string }>,
) {
  for (const change of comments.changes) {
    if (change.status !== "pending") continue;
    target.set(change.markId, {
      author: reviewerName,
      date: change.createdAt,
    });
  }
}

export async function loadHandoffBundle(
  libraryPath: string,
  reviewerName: string,
): Promise<HandoffBundle> {
  const manifest = await api.openLibrary(libraryPath);
  const researchMetas = await api.listResearchChapters(libraryPath);
  const characterMetas = await api.listCharacterChapters(libraryPath);

  const [chapters, research, characters] = await Promise.all([
    loadChaptersBulk(libraryPath, manifest.chapters, "chapters"),
    loadChaptersBulk(libraryPath, researchMetas, "research"),
    loadChaptersBulk(libraryPath, characterMetas, "characters"),
  ]);

  const threads: CommentThread[] = [];
  const changeMetaByMarkId = new Map<string, { author: string; date: string }>();

  for (const section of ["chapters", "research", "characters"] as const) {
    const metas =
      section === "chapters"
        ? manifest.chapters
        : section === "research"
          ? researchMetas
          : characterMetas;
    const commentsMap = await loadCommentsBulk(libraryPath, metas, section);
    for (const data of commentsMap.values()) {
      threads.push(...data.threads);
      mergeChangeMeta(data, reviewerName, changeMetaByMarkId);
    }
  }

  return {
    manifest,
    chapters,
    research,
    characters,
    threads,
    changeMetaByMarkId,
  };
}