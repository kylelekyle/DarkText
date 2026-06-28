import type { BookSettings, ExportResult } from "$lib/types";
import { buildDocxBlob, type DocxReviewContext } from "./htmlToDocx";
import {
  buildMarkedDocxSections,
  collectReviewMarkIdsFromSections,
  filterHandoffThreads,
} from "./markedHandoff";
import { loadHandoffBundle } from "./pipeline";
import { sanitizeFilename } from "./sanitize";
import { writeExportBytes } from "./writeExport";
import { Paragraph, TextRun, type ICommentOptions } from "docx";
import type { CommentThread } from "$lib/types";

function buildCommentMaps(threads: CommentThread[], authorFallback: string) {
  const open = threads.filter((t) => !t.resolved);
  const commentIdByMarkId = new Map<string, number>();
  const commentDefs: ICommentOptions[] = [];

  open.forEach((thread, index) => {
    commentIdByMarkId.set(thread.markId, index);
    const first = thread.replies[0];
    commentDefs.push({
      id: index,
      author: first?.author ?? authorFallback,
      date: first?.createdAt ? new Date(first.createdAt) : new Date(),
      children: thread.replies.map(
        (reply) =>
          new Paragraph({
            children: [
              new TextRun({
                text: `${reply.author}: ${reply.text}`,
                size: 20,
              }),
            ],
          }),
      ),
    });
  });

  return { commentIdByMarkId, commentDefs };
}

export async function exportMarkedManuscriptAsDocx(
  libraryPath: string,
  bookSettings: BookSettings,
  reviewerName: string,
  options: { outputDir?: string; filename?: string } = {},
): Promise<ExportResult> {
  const bundle = await loadHandoffBundle(libraryPath, reviewerName);
  const docxSections = buildMarkedDocxSections(bundle);
  if (docxSections.length === 0) {
    throw new Error("No content to export");
  }

  const markIds = collectReviewMarkIdsFromSections(docxSections);
  const threads = filterHandoffThreads(bundle.threads, markIds.commentIds);
  const changeMetaByMarkId = new Map(
    [...bundle.changeMetaByMarkId].filter(([id]) => markIds.changeIds.has(id)),
  );

  const authorFallback =
    bookSettings.author.trim() || reviewerName || "Author";
  const { commentIdByMarkId, commentDefs } = buildCommentMaps(
    threads,
    authorFallback,
  );
  let revisionSeq = 1;
  const review: DocxReviewContext = {
    revisionAuthor: reviewerName,
    commentIdByMarkId,
    changeMetaByMarkId,
    nextRevisionId: () => revisionSeq++,
  };

  const title = bookSettings.title.trim();
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const safeTitle = await sanitizeFilename(title || "marked-manuscript");
  const base = options.filename?.trim() || `${safeTitle}-marked-${stamp}`;
  const filename = base.endsWith(".docx") ? base : `${await sanitizeFilename(base)}.docx`;

  const blob = await buildDocxBlob(
    docxSections,
    { title: title || undefined, author: bookSettings.author.trim() || undefined },
    "manuscript",
    libraryPath,
    { review, comments: commentDefs },
  );

  const bytes = new Uint8Array(await blob.arrayBuffer());
  const result = await writeExportBytes(libraryPath, filename, bytes, options.outputDir);
  return {
    ...result,
    preview: `${bundle.chapters.length + bundle.research.length + bundle.characters.length} items with Word track changes and comments`,
  };
}