/** Shared URL/path rules for library HTML (display, paste, export). */

const BLOCKED_SCHEME = /^(javascript|data|file|asset|blob|vbscript):/i;

/** Library images are stored as `images/<filename>` with no traversal. */
export function isSafeLibraryImagePath(path: string): boolean {
  const trimmed = path.trim();
  if (!trimmed || trimmed.includes("\\") || trimmed.includes("..")) return false;
  if (!trimmed.startsWith("images/")) return false;
  const filename = trimmed.slice("images/".length);
  if (!filename || filename.includes("/")) return false;
  return /^[a-zA-Z0-9._-]+$/.test(filename);
}

export function isBlockedNavUrl(value: string): boolean {
  const trimmed = value.trim().replace(/\0/g, "");
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  if (lower.startsWith("//")) return true;
  if (/^https?:/i.test(lower)) return true;
  return BLOCKED_SCHEME.test(lower);
}

function isSafeFragmentHref(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.startsWith("#") && !trimmed.slice(1).includes(":");
}

function scrubUrlAttribute(name: string, value: string): "keep" | "drop" {
  const lowerName = name.toLowerCase();
  if (lowerName.startsWith("on") || lowerName === "srcdoc") return "drop";

  if (lowerName === "src" && isSafeLibraryImagePath(value)) return "keep";
  if (lowerName === "data-rel-path" && isSafeLibraryImagePath(value)) return "keep";
  if (lowerName === "data-library-rel" && isSafeLibraryImagePath(value)) return "keep";

  if (lowerName === "href" && isSafeFragmentHref(value)) return "keep";

  if (
    lowerName === "href" ||
    lowerName === "src" ||
    lowerName === "xlink:href" ||
    lowerName === "data-rel-path" ||
    lowerName === "data-library-rel"
  ) {
    return "drop";
  }

  if (isBlockedNavUrl(value)) return "drop";
  return "keep";
}

const REMOVED_TAGS =
  "script, iframe, object, embed, link, meta, style, svg, math, base, form, input, button, textarea, select, video, audio, template, noscript, applet, marquee, frame, frameset, xmp, param, keygen, area, map, canvas, dialog, command, menuitem";

function removeCommentNodes(doc: Document, root: ParentNode): void {
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
  const comments: Comment[] = [];
  while (walker.nextNode()) {
    comments.push(walker.currentNode as Comment);
  }
  for (const comment of comments) {
    comment.remove();
  }
}

function scrubDocumentBody(doc: Document): void {
  doc.querySelectorAll(REMOVED_TAGS).forEach((el) => {
    el.remove();
  });
  doc.body.querySelectorAll("*").forEach((el) => {
    // el.attributes is a live NamedNodeMap; removeAttribute() below would mutate
    // it mid-iteration and skip entries if we iterated it directly.
    // oxlint-disable-next-line unicorn/no-useless-spread
    for (const attr of [...el.attributes]) {
      if (scrubUrlAttribute(attr.name, attr.value) === "drop") {
        el.removeAttribute(attr.name);
      }
    }
  });
  doc.body.querySelectorAll("img").forEach((img) => {
    const src = img.getAttribute("src") ?? "";
    const rel = img.getAttribute("data-rel-path") ?? "";
    if (!isSafeLibraryImagePath(src) && !isSafeLibraryImagePath(rel)) {
      img.remove();
    }
  });
  removeCommentNodes(doc, doc.body);
}

/** True when HTML includes an image that is not a safe library path. */
export function pasteContainsExternalImages(html: string): boolean {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  for (const img of doc.querySelectorAll("img")) {
    const src = (img.getAttribute("src") ?? "").trim();
    const rel = (img.getAttribute("data-rel-path") ?? "").trim();
    if (isSafeLibraryImagePath(src) || isSafeLibraryImagePath(rel)) continue;
    if (src || rel) return true;
  }
  return false;
}

/** Sanitize clipboard HTML for editor paste; flags blocked remote/library images. */
export function prepareHtmlForPaste(html: string): {
  html: string;
  blockedImages: boolean;
} {
  const blockedImages = pasteContainsExternalImages(html);
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  scrubDocumentBody(doc);
  return { html: doc.body.innerHTML.trim(), blockedImages };
}

/** Remove executable content before rendering untrusted library HTML. */
export function sanitizeHtmlForDisplay(html: string): string {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  scrubDocumentBody(doc);
  return doc.body.innerHTML;
}