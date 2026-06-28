import JSZip from "jszip";
import * as api from "$lib/api";
import type { BookSettings, CompileOptions, ExportResult } from "$lib/types";
import { compileChapterHeading } from "$lib/utils/compileDisplayPrefs";
import { loadChaptersBulk, stripForPublish } from "./pipeline";
import { sanitizeFilename } from "./sanitize";
import { writeExportBytes } from "./writeExport";

interface EpubSection {
  title: string;
  html: string;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function buildEpubBlob(
  sections: EpubSection[],
  meta: { title?: string; author?: string },
): Promise<Blob> {
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  zip.file(
    "META-INF/container.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`,
  );

  const bookTitle = meta.title?.trim() || "Untitled";
  const author = meta.author?.trim() || "Unknown";
  let manifestItems = "";
  let spineItems = "";
  let navItems = "";

  sections.forEach((sec, i) => {
    const id = `ch${i + 1}`;
    const fname = `${id}.xhtml`;
    const xhtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <title>${escapeXml(sec.title)}</title>
  <link rel="stylesheet" type="text/css" href="stylesheet.css"/>
</head>
<body>
  <h1>${escapeXml(sec.title)}</h1>
  ${sec.html}
</body>
</html>`;
    zip.file(`OEBPS/${fname}`, xhtml);
    manifestItems += `    <item id="${id}" href="${fname}" media-type="application/xhtml+xml"/>\n`;
    spineItems += `    <itemref idref="${id}"/>\n`;
    navItems += `      <li><a href="${fname}">${escapeXml(sec.title)}</a></li>\n`;
  });

  const stylesheet = `body {
  font-family: Georgia, "Iowan Old Style", "Palatino Linotype", serif;
  line-height: 1.65;
  margin: 1.2em;
}
h1 {
  font-size: 1.35em;
  margin: 0 0 1em;
}
p { margin: 0 0 0.9em; }`;

  zip.file("OEBPS/stylesheet.css", stylesheet);
  manifestItems += `    <item id="css" href="stylesheet.css" media-type="text/css"/>\n`;
  manifestItems += `    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>\n`;

  zip.file(
    "OEBPS/nav.xhtml",
    `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>Contents</title></head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>Contents</h1>
    <ol>
${navItems}    </ol>
  </nav>
</body>
</html>`,
  );

  const uid = crypto.randomUUID();
  zip.file(
    "OEBPS/content.opf",
    `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid">urn:uuid:${uid}</dc:identifier>
    <dc:title>${escapeXml(bookTitle)}</dc:title>
    <dc:creator>${escapeXml(author)}</dc:creator>
    <dc:language>en</dc:language>
  </metadata>
  <manifest>
${manifestItems}  </manifest>
  <spine>
${spineItems}  </spine>
</package>`,
  );

  return zip.generateAsync({ type: "blob", mimeType: "application/epub+zip" });
}

async function resolveEpubFilename(raw: string): Promise<string> {
  const trimmed = raw.trim();
  if (!trimmed) return "export.epub";
  if (trimmed.toLowerCase().endsWith(".epub")) {
    const stem = trimmed.slice(0, -".epub".length);
    return `${await sanitizeFilename(stem)}.epub`;
  }
  return `${await sanitizeFilename(trimmed)}.epub`;
}

export async function compileBookAsEpub(
  libraryPath: string,
  options: CompileOptions,
  bookSettings: BookSettings,
): Promise<ExportResult> {
  const finals = await api.getCompileChapters(libraryPath);
  if (finals.length === 0) {
    throw new Error("No Final chapters to compile. Mark chapters as Final in the sidebar.");
  }

  const loaded = await loadChaptersBulk(libraryPath, finals, "chapters");
  const prefs = bookSettings.preferences;
  const sections: EpubSection[] = await Promise.all(
    loaded.map(async (c, index) => ({
      title:
        compileChapterHeading(index + 1, c.meta.title, prefs) ??
        `Chapter ${index + 1}`,
      html: await stripForPublish(c.html),
    })),
  );

  const title = bookSettings.title.trim();
  const author = bookSettings.author.trim();
  const base =
    options.filename?.trim() ||
    `${await sanitizeFilename(title || "book")}.epub`;
  const filename = await resolveEpubFilename(base);

  const blob = await buildEpubBlob(sections, {
    title: bookSettings.includeFrontMatter && title ? title : title || undefined,
    author: bookSettings.includeFrontMatter && author ? author : author || undefined,
  });

  const bytes = new Uint8Array(await blob.arrayBuffer());
  const preview = finals.map((c) => c.title).join(", ");
  const result = await writeExportBytes(libraryPath, filename, bytes, options.outputDir);
  return { ...result, preview };
}