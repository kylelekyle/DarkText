import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { buildDocxBlob, type DocxReviewContext } from "./htmlToDocx";

describe("buildDocxBlob with review marks", () => {
  it("produces a valid docx zip with track revisions", async () => {
    let revisionSeq = 1;
    const review: DocxReviewContext = {
      revisionAuthor: "Editor",
      commentIdByMarkId: new Map([["c1", 0]]),
      changeMetaByMarkId: new Map([
        ["i1", { author: "Editor", date: "2026-01-01T00:00:00.000Z" }],
        ["d1", { author: "Editor", date: "2026-01-01T00:00:00.000Z" }],
      ]),
      nextRevisionId: () => revisionSeq++,
    };

    const blob = await buildDocxBlob(
      [
        {
          title: "Chapter 1",
          html:
            '<p>Hello <span class="dt-insertion" data-change-id="i1">new</span> ' +
            '<span class="dt-deletion" data-change-id="d1">old</span> ' +
            '<span class="dt-comment" data-comment-id="c1">note</span></p>',
        },
      ],
      {},
      "default",
      undefined,
      {
        review,
        comments: [
          {
            id: 0,
            author: "Author",
            date: new Date("2026-01-01T00:00:00.000Z"),
            children: [],
          },
        ],
      },
    );

    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(String.fromCharCode(bytes[0], bytes[1])).toBe("PK");
    expect(bytes.length).toBeGreaterThan(1000);

    const zip = await JSZip.loadAsync(bytes);
    const documentXml = await zip.file("word/document.xml")?.async("string");
    expect(documentXml).toBeDefined();
    expect(documentXml).toContain("w:ins");
    expect(documentXml).toContain("w:del");
    expect(documentXml).toContain("w:commentRangeStart");
  });
});