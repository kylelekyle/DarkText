import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { buildDocxBlob } from "./htmlToDocx";

const PNG_1X1_DATA_URI =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

async function documentXml(blob: Blob): Promise<string> {
  const zip = await JSZip.loadAsync(new Uint8Array(await blob.arrayBuffer()));
  const xml = await zip.file("word/document.xml")?.async("string");
  if (!xml) throw new Error("word/document.xml missing from generated docx");
  return xml;
}

describe("buildDocxBlob", () => {
  it("builds a non-empty DOCX blob from simple HTML", async () => {
    const blob = await buildDocxBlob(
      [{ title: "Chapter One", html: "<p>Hello <strong>world</strong></p>" }],
      { title: "Test Book", author: "Author Name" },
      "default",
      undefined,
    );
    expect(blob.size).toBeGreaterThan(1000);
    expect(blob.type).toContain("officedocument");
  });

  it("includes heading sections", async () => {
    const blob = await buildDocxBlob(
      [
        {
          title: "Part I",
          html: "<h2>Scene</h2><p>Body text here.</p>",
        },
      ],
      {},
      "manuscript",
      undefined,
    );
    expect(blob.size).toBeGreaterThan(500);
  });

  it("handles review mark spans without throwing", async () => {
    const blob = await buildDocxBlob(
      [
        {
          title: "Review",
          html: '<p>Before <span class="dt-insertion" data-change-id="i1">added</span> after</p>',
        },
      ],
      {},
      "default",
      undefined,
      {
        review: {
          revisionAuthor: "Editor",
          commentIdByMarkId: new Map(),
          changeMetaByMarkId: new Map([
            ["i1", { author: "Editor", date: "2026-06-26T00:00:00.000Z" }],
          ]),
          nextRevisionId: () => 1,
        },
      },
    );
    expect(blob.size).toBeGreaterThan(500);
  });

  it("maps h2/h3 to distinct DOCX heading styles", async () => {
    const blob = await buildDocxBlob(
      [
        {
          title: "Headings",
          html: "<h2>Section</h2><h3>Subsection</h3><p>Body.</p>",
        },
      ],
      {},
      "default",
      undefined,
    );
    const xml = await documentXml(blob);
    expect(xml).toContain('w:val="Heading2"');
    expect(xml).toContain('w:val="Heading3"');
  });

  it("renders nested lists across two levels with numbering refs", async () => {
    const blob = await buildDocxBlob(
      [
        {
          title: "Lists",
          html:
            "<ul><li>Top item<ul><li>Nested item</li></ul></li>" +
            "<li>Second top item</li></ul>",
        },
      ],
      {},
      "default",
      undefined,
    );
    const xml = await documentXml(blob);
    expect(xml).toContain("Top item");
    expect(xml).toContain("Nested item");
    expect(xml).toContain("Second top item");
    // Nested <li> renders at list level 1, the top-level items at level 0.
    expect(xml).toContain('<w:ilvl w:val="1"/>');
    expect(xml).toContain('<w:ilvl w:val="0"/>');
  });

  it("embeds an inline image from a data URI", async () => {
    const blob = await buildDocxBlob(
      [
        {
          title: "Image",
          html: `<p><img src="${PNG_1X1_DATA_URI}" width="100" height="100" /></p>`,
        },
      ],
      {},
      "default",
      undefined,
    );
    const zip = await JSZip.loadAsync(new Uint8Array(await blob.arrayBuffer()));
    const mediaFiles = Object.keys(zip.files).filter((name) =>
      name.startsWith("word/media/"),
    );
    expect(mediaFiles.length).toBeGreaterThan(0);
    const xml = await documentXml(blob);
    expect(xml).not.toContain("could not be embedded");
  });

  it("does not embed remote or asset-protocol images", async () => {
    const blob = await buildDocxBlob(
      [
        {
          title: "Remote",
          html:
            '<p><img src="https://evil.test/track.png" /></p>' +
            '<p><img src="asset://localhost/C:/secret.png" /></p>',
        },
      ],
      {},
      "default",
      undefined,
    );
    const xml = await documentXml(blob);
    expect(xml).toContain("could not be embedded");
    const zip = await JSZip.loadAsync(new Uint8Array(await blob.arrayBuffer()));
    const mediaFiles = Object.keys(zip.files).filter((name) =>
      name.startsWith("word/media/"),
    );
    expect(mediaFiles.length).toBe(0);
  });

  it("falls back to placeholder text when an image can't be loaded", async () => {
    const blob = await buildDocxBlob(
      [
        {
          title: "Broken Image",
          html: '<p><img src="not-a-real-relative-path.png" /></p>',
        },
      ],
      {},
      "default",
      undefined,
    );
    const xml = await documentXml(blob);
    expect(xml).toContain("could not be embedded");
  });

  it("exports inline pt font sizes to DOCX half-points", async () => {
    const blob = await buildDocxBlob(
      [
        {
          title: "Sizes",
          html: '<p>Normal <span style="font-size: 14pt">larger</span></p>',
        },
      ],
      {},
      "manuscript",
      undefined,
    );
    const xml = await documentXml(blob);
    expect(xml).toContain('w:val="24"');
    expect(xml).toContain('w:val="28"');
  });

  it("flattens an unsupported <table> into cell text without throwing or losing data", async () => {
    // DOCX export has no real table support (no `Table`/`TableRow`/`TableCell`
    // usage in htmlToDocx.ts) — a <table> falls through to the generic
    // container handler and each cell becomes its own paragraph. This test
    // documents that current behavior: it doesn't throw, and no cell text is
    // silently dropped, but the result has no real `w:tbl` structure.
    const blob = await buildDocxBlob(
      [
        {
          title: "Table",
          html:
            "<table><thead><tr><th>Name</th><th>Role</th></tr></thead>" +
            "<tbody><tr><td>Alice</td><td>Author</td></tr></tbody></table>",
        },
      ],
      {},
      "default",
      undefined,
    );
    const xml = await documentXml(blob);
    expect(xml).not.toContain("<w:tbl>");
    for (const cell of ["Name", "Role", "Alice", "Author"]) {
      expect(xml).toContain(cell);
    }
  });
});