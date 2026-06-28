import type { CommentThread } from "$lib/types";
import type { HandoffBundle } from "./pipeline";
import type { DocxSection } from "./htmlToDocx";

export interface ReviewMarkIds {
  changeIds: Set<string>;
  commentIds: Set<string>;
}

/** Collect review mark ids present in chapter HTML. */
export function collectReviewMarkIds(html: string): ReviewMarkIds {
  const changeIds = new Set<string>();
  const commentIds = new Set<string>();
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  for (const el of doc.querySelectorAll("[data-change-id]")) {
    const id = el.getAttribute("data-change-id");
    if (id) changeIds.add(id);
  }
  for (const el of doc.querySelectorAll("[data-comment-id]")) {
    const id = el.getAttribute("data-comment-id");
    if (id) commentIds.add(id);
  }
  return { changeIds, commentIds };
}

export function collectReviewMarkIdsFromSections(
  sections: DocxSection[],
): ReviewMarkIds {
  const changeIds = new Set<string>();
  const commentIds = new Set<string>();
  for (const section of sections) {
    const ids = collectReviewMarkIds(section.html);
    for (const id of ids.changeIds) changeIds.add(id);
    for (const id of ids.commentIds) commentIds.add(id);
  }
  return { changeIds, commentIds };
}

export function buildMarkedDocxSections(bundle: HandoffBundle): DocxSection[] {
  const sections: DocxSection[] = [];

  for (const ch of bundle.chapters) {
    sections.push({ title: ch.meta.title, html: ch.html });
  }

  if (bundle.research.length > 0) {
    sections.push({
      title: "Research",
      html: "<p><em>Research notes (review marks preserved)</em></p>",
    });
    for (const item of bundle.research) {
      sections.push({ title: item.meta.title, html: item.html });
    }
  }

  if (bundle.characters.length > 0) {
    sections.push({
      title: "Characters",
      html: "<p><em>Character sheets (review marks preserved)</em></p>",
    });
    for (const item of bundle.characters) {
      sections.push({ title: item.meta.title, html: item.html });
    }
  }

  return sections;
}

export function filterHandoffThreads(
  threads: CommentThread[],
  commentIds: Set<string>,
): CommentThread[] {
  return threads.filter((t) => !t.resolved && commentIds.has(t.markId));
}