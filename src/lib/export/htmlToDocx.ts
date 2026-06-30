import {
  AlignmentType,
  CommentRangeEnd,
  CommentRangeStart,
  CommentReference,
  DeletedTextRun,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  ImageRun,
  InsertedTextRun,
  LevelFormat,
  Packer,
  Paragraph,
  TextRun,
  UnderlineType,
  type ICommentOptions,
  type IParagraphOptions,
  type IRunOptions,
  type ParagraphChild,
} from "docx";
import * as api from "$lib/api";
import { isBlockedNavUrl, isSafeLibraryImagePath } from "$lib/export/sanitizeHtml";
import type { CompilePreset } from "$lib/types";

export interface DocxReviewContext {
  revisionAuthor: string;
  commentIdByMarkId: Map<string, number>;
  changeMetaByMarkId: Map<string, { author: string; date: string }>;
  nextRevisionId: () => number;
}

export interface DocxSection {
  title?: string;
  html: string;
}

export interface DocxBookMeta {
  title?: string;
  author?: string;
}

type InlineStyle = {
  bold?: boolean;
  italics?: boolean;
  underline?: boolean;
  sizeHalfPoints?: number;
};

function fontSizeHalfPointsFromStyle(style: string): number | undefined {
  const ptMatch = /font-size:\s*([\d.]+)\s*pt/i.exec(style);
  if (ptMatch) {
    const pt = Number(ptMatch[1]);
    if (Number.isFinite(pt) && pt > 0) return Math.round(pt * 2);
  }
  const pxMatch = /font-size:\s*([\d.]+)\s*px/i.exec(style);
  if (pxMatch) {
    const px = Number(pxMatch[1]);
    if (Number.isFinite(px) && px > 0) return Math.round((px * 72) / 48);
  }
  return undefined;
}

function inlineStyleFromElement(el: HTMLElement): Partial<InlineStyle> {
  const next: Partial<InlineStyle> = {};
  const halfPoints =
    fontSizeHalfPointsFromStyle(el.getAttribute("style") ?? "") ??
    fontSizeHalfPointsFromStyle(el.style.cssText);
  if (halfPoints) next.sizeHalfPoints = halfPoints;
  return next;
}

type BlockItem = Paragraph;

const BULLET_REF = "darktext-bullets";
const NUMBER_REF = "darktext-numbers";

function alignmentFromStyle(el: HTMLElement): (typeof AlignmentType)[keyof typeof AlignmentType] | undefined {
  const align = el.style.textAlign?.toLowerCase();
  if (align === "center") return AlignmentType.CENTER;
  if (align === "right") return AlignmentType.RIGHT;
  if (align === "justify") return AlignmentType.JUSTIFIED;
  if (align === "left") return AlignmentType.LEFT;
  return undefined;
}

function headingLevel(tag: string): (typeof HeadingLevel)[keyof typeof HeadingLevel] | undefined {
  const map: Record<string, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
    h1: HeadingLevel.HEADING_1,
    h2: HeadingLevel.HEADING_2,
    h3: HeadingLevel.HEADING_3,
    h4: HeadingLevel.HEADING_4,
    h5: HeadingLevel.HEADING_5,
    h6: HeadingLevel.HEADING_6,
  };
  return map[tag.toLowerCase()];
}

function stylePreset(preset: CompilePreset | "default"): {
  font: string;
  sizeHalfPoints: number;
  lineSpacing: number;
} {
  if (preset === "manuscript") {
    return { font: "Times New Roman", sizeHalfPoints: 24, lineSpacing: 480 };
  }
  return { font: "Georgia", sizeHalfPoints: 22, lineSpacing: 276 };
}

async function loadImageBytes(
  src: string,
  libraryPath?: string,
): Promise<Uint8Array | null> {
  const trimmed = src.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("data:")) {
    const comma = trimmed.indexOf(",");
    if (comma < 0) return null;
    const meta = trimmed.slice(0, comma);
    const data = trimmed.slice(comma + 1);
    if (meta.includes(";base64")) {
      const binary = atob(data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return bytes;
    }
    return new TextEncoder().encode(decodeURIComponent(data));
  }

  if (isBlockedNavUrl(trimmed)) return null;

  if (!libraryPath || !isSafeLibraryImagePath(trimmed)) return null;
  try {
    return await api.readFileBytes(libraryPath, trimmed);
  } catch {
    return null;
  }
}

function imageType(bytes: Uint8Array): "png" | "jpg" | "gif" | "bmp" | null {
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return "png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "jpg";
  if (bytes[0] === 0x47 && bytes[1] === 0x49) return "gif";
  if (bytes[0] === 0x42 && bytes[1] === 0x4d) return "bmp";
  return "png";
}

async function imageParagraph(
  img: HTMLImageElement,
  libraryPath?: string,
): Promise<Paragraph> {
  const rel =
    img.getAttribute("data-rel-path") ?? img.getAttribute("data-library-rel");
  const src = rel ?? img.getAttribute("src") ?? "";
  const bytes = await loadImageBytes(src, libraryPath);
  if (!bytes) {
    return new Paragraph({
      children: [
        new TextRun({
          text: "[Image could not be embedded]",
          italics: true,
          color: "888888",
        }),
      ],
    });
  }
  const type = imageType(bytes) ?? "png";
  const width = Math.min(400, Number(img.getAttribute("width")) || 320);
  const height = Math.min(400, Number(img.getAttribute("height")) || Math.round(width * 0.75));
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [
      new ImageRun({
        type,
        data: bytes,
        transformation: { width, height },
      }),
    ],
  });
}

function runOptions(
  text: string,
  style: InlineStyle,
  preset: ReturnType<typeof stylePreset>,
): IRunOptions {
  return {
    text,
    font: preset.font,
    size: style.sizeHalfPoints ?? preset.sizeHalfPoints,
    bold: style.bold,
    italics: style.italics,
    underline: style.underline ? { type: UnderlineType.SINGLE } : undefined,
  };
}

function revisionMeta(
  markId: string | null,
  ctx: DocxReviewContext | undefined,
): { id: number; author: string; date: string } {
  const meta = markId ? ctx?.changeMetaByMarkId.get(markId) : undefined;
  return {
    id: ctx?.nextRevisionId() ?? 1,
    author: meta?.author ?? ctx?.revisionAuthor ?? "Editor",
    date: meta?.date ?? new Date().toISOString(),
  };
}

function textRunsFromNode(
  node: Node,
  style: InlineStyle,
  preset: ReturnType<typeof stylePreset>,
  review?: DocxReviewContext,
): ParagraphChild[] {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? "";
    if (!text) return [];
    return [new TextRun(runOptions(text, style, preset))];
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return [];

  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();

  if (tag === "br") {
    return [new TextRun({ break: 1, font: preset.font, size: preset.sizeHalfPoints })];
  }

  const next: InlineStyle = { ...style };
  if (tag === "strong" || tag === "b") next.bold = true;
  if (tag === "em" || tag === "i") next.italics = true;
  if (tag === "u") next.underline = true;
  if (tag === "span") Object.assign(next, inlineStyleFromElement(el));

  if (tag === "span" && review) {
    if (el.classList.contains("dt-insertion")) {
      const markId = el.getAttribute("data-change-id");
      const rev = revisionMeta(markId, review);
      const text = el.textContent ?? "";
      if (!text) return [];
      return [
        new InsertedTextRun({
          ...runOptions(text, next, preset),
          id: rev.id,
          author: rev.author,
          date: rev.date,
        }),
      ];
    }
    if (el.classList.contains("dt-deletion")) {
      const markId = el.getAttribute("data-change-id");
      const rev = revisionMeta(markId, review);
      const text = el.textContent ?? "";
      if (!text) return [];
      return [
        new DeletedTextRun({
          ...runOptions(text, next, preset),
          id: rev.id,
          author: rev.author,
          date: rev.date,
          strike: true,
        }),
      ];
    }
    if (el.classList.contains("dt-comment")) {
      const markId = el.getAttribute("data-comment-id");
      const commentId = markId ? review.commentIdByMarkId.get(markId) : undefined;
      const inner = [...el.childNodes].flatMap((c) =>
        textRunsFromNode(c, next, preset, review),
      );
      if (commentId === undefined) return inner;
      return [
        new CommentRangeStart(commentId),
        ...inner,
        new CommentRangeEnd(commentId),
        new CommentReference(commentId),
      ];
    }
  }

  if (tag === "a") {
    const href = el.getAttribute("href") ?? "";
    const children = [...el.childNodes].flatMap((c) =>
      textRunsFromNode(c, next, preset, review),
    );
    if (!href) return children;
    return [
      new ExternalHyperlink({
        children: children.filter((c) => c instanceof TextRun) as TextRun[],
        link: href,
      }),
    ];
  }

  return [...el.childNodes].flatMap((c) => textRunsFromNode(c, next, preset, review));
}

function paragraphFromElement(
  el: HTMLElement,
  preset: ReturnType<typeof stylePreset>,
  review?: DocxReviewContext,
  listRef?: string,
  listLevel?: number,
): Paragraph {
  const children = [...el.childNodes].flatMap((c) => textRunsFromNode(c, {}, preset, review));
  const align = alignmentFromStyle(el);
  const opts: IParagraphOptions = {
    children: children.length ? children : [new TextRun({ text: "", font: preset.font, size: preset.sizeHalfPoints })],
    spacing: { line: preset.lineSpacing, after: 120 },
    ...(align ? { alignment: align } : {}),
    ...(listRef !== undefined && listLevel !== undefined
      ? { numbering: { reference: listRef, level: listLevel } }
      : {}),
  };
  return new Paragraph(opts);
}

async function blocksFromElement(
  el: HTMLElement,
  preset: ReturnType<typeof stylePreset>,
  listLevel = 0,
  libraryPath?: string,
  review?: DocxReviewContext,
): Promise<BlockItem[]> {
  const tag = el.tagName.toLowerCase();

  if (tag === "img") {
    return [await imageParagraph(el as HTMLImageElement, libraryPath)];
  }

  if (tag === "hr") {
    return [
      new Paragraph({
        border: { bottom: { style: "single", size: 6, color: "cccccc" } },
        spacing: { before: 200, after: 200 },
      }),
    ];
  }

  if (tag === "ul" || tag === "ol") {
    const ref = tag === "ul" ? BULLET_REF : NUMBER_REF;
    const items: BlockItem[] = [];
    for (const child of el.children) {
      if (child.tagName.toLowerCase() !== "li") continue;
      const li = child as HTMLElement;
      const liChildren = [...li.children];
      const isListTag = (c: Element) => c.tagName.toLowerCase() === "ul" || c.tagName.toLowerCase() === "ol";
      const directP = liChildren.find((c) => c.tagName.toLowerCase() === "p") as
        | HTMLElement
        | undefined;
      const nestedLists = liChildren.filter(isListTag) as HTMLElement[];

      if (directP) {
        items.push(paragraphFromElement(directP, preset, review, ref, listLevel));
      } else {
        // Build the <li>'s own paragraph from only its non-list child nodes,
        // so a nested <ul>/<ol>'s text isn't duplicated into the parent's
        // paragraph (it gets its own paragraph(s) via the recursion below).
        const ownContent = li.cloneNode(true) as HTMLElement;
        // ownContent.children is live; remove() below would mutate it
        // mid-iteration and skip entries if we iterated it directly.
        // oxlint-disable-next-line unicorn/no-useless-spread
        for (const nested of [...ownContent.children]) {
          if (isListTag(nested)) nested.remove();
        }
        items.push(paragraphFromElement(ownContent, preset, review, ref, listLevel));
      }

      for (const nested of nestedLists) {
        items.push(
          ...(await blocksFromElement(nested, preset, listLevel + 1, libraryPath, review)),
        );
      }
    }
    return items;
  }

  const heading = headingLevel(tag);
  if (heading) {
    const children = [...el.childNodes].flatMap((c) =>
      textRunsFromNode(c, { bold: true }, preset, review),
    );
    return [
      new Paragraph({
        heading,
        children: children.length ? children : [new TextRun({ text: el.textContent ?? "", font: preset.font, size: preset.sizeHalfPoints })],
        alignment: alignmentFromStyle(el),
        spacing: { before: 240, after: 120 },
      }),
    ];
  }

  if (tag === "p" || tag === "blockquote" || tag === "div") {
    if (el.classList.contains("page-break") || el.dataset.pageBreak !== undefined) {
      return [new Paragraph({ children: [new TextRun({ text: "", break: 1 })] })];
    }
    if (el.classList.contains("scene-break")) {
      return [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 240, after: 240 },
          children: [new TextRun({ text: "* * *", font: preset.font, size: preset.sizeHalfPoints })],
        }),
      ];
    }
    const imgs = [...el.children].filter((c) => c.tagName.toLowerCase() === "img");
    if (imgs.length === 1 && el.childNodes.length === 1) {
      return [await imageParagraph(imgs[0] as HTMLImageElement, libraryPath)];
    }
    return [paragraphFromElement(el, preset, review)];
  }

  return blocksFromContainer(el, preset, listLevel, libraryPath, review);
}

async function blocksFromContainer(
  container: HTMLElement,
  preset: ReturnType<typeof stylePreset>,
  listLevel = 0,
  libraryPath?: string,
  review?: DocxReviewContext,
): Promise<BlockItem[]> {
  const blocks: BlockItem[] = [];
  for (const node of container.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent ?? "").trim();
      if (text) {
        blocks.push(
          new Paragraph({
            children: [new TextRun({ text, font: preset.font, size: preset.sizeHalfPoints })],
            spacing: { line: preset.lineSpacing, after: 120 },
          }),
        );
      }
      continue;
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      blocks.push(
        ...(await blocksFromElement(
          node as HTMLElement,
          preset,
          listLevel,
          libraryPath,
          review,
        )),
      );
    }
  }
  return blocks;
}

async function htmlToBlocks(
  html: string,
  preset: ReturnType<typeof stylePreset>,
  libraryPath?: string,
  review?: DocxReviewContext,
): Promise<BlockItem[]> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<body>${html}</body>`, "text/html");
  return blocksFromContainer(doc.body, preset, 0, libraryPath, review);
}

export interface BuildDocxOptions {
  review?: DocxReviewContext;
  comments?: ICommentOptions[];
}

export async function buildDocxBlob(
  sections: DocxSection[],
  meta: DocxBookMeta = {},
  style: CompilePreset | "default" = "default",
  libraryPath?: string,
  options: BuildDocxOptions = {},
): Promise<Blob> {
  const preset = stylePreset(style);
  const children: BlockItem[] = [];

  if (meta.title?.trim()) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: meta.title.trim(), font: preset.font, size: 32, bold: true })],
        spacing: { after: 200 },
      }),
    );
  }
  if (meta.author?.trim()) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: meta.author.trim(), font: preset.font, size: preset.sizeHalfPoints, italics: true })],
        spacing: { after: 400 },
      }),
    );
  }

  for (const section of sections) {
    if (section.title?.trim()) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: section.title.trim(), font: preset.font, size: 28, bold: true })],
          spacing: { before: 360, after: 200 },
        }),
      );
    }
    children.push(
      ...(await htmlToBlocks(section.html, preset, libraryPath, options.review)),
    );
  }

  const document = new Document({
    ...(options.comments?.length
      ? { comments: { children: options.comments } }
      : {}),
    ...(options.review ? { features: { trackRevisions: true } } : {}),
    numbering: {
      config: [
        {
          reference: BULLET_REF,
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "•",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } },
            },
            {
              level: 1,
              format: LevelFormat.BULLET,
              text: "◦",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 1440, hanging: 360 } } },
            },
          ],
        },
        {
          reference: NUMBER_REF,
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } },
            },
            {
              level: 1,
              format: LevelFormat.DECIMAL,
              text: "%2.",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 1440, hanging: 360 } } },
            },
          ],
        },
      ],
    },
    sections: [{ children }],
  });

  return Packer.toBlob(document);
}
