/**
 * Smoke test: build a DOCX with basic formatting and verify ZIP signature.
 * Run: node scripts/test-docx-export.mjs
 */
import { writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
  UnderlineType,
} from "docx";

const outPath = join(process.cwd(), "test-chapter-export.docx");

const doc = new Document({
  sections: [
    {
      children: [
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: "Test Chapter", bold: true })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "Centered paragraph", italics: true })],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Bold ", bold: true }),
            new TextRun({ text: "italic ", italics: true }),
            new TextRun({ text: "underline", underline: { type: UnderlineType.SINGLE } }),
          ],
        }),
      ],
    },
  ],
});

const buffer = await Packer.toBuffer(doc);
writeFileSync(outPath, buffer);

const sig = buffer.subarray(0, 2).toString("utf8");
if (sig !== "PK") {
  console.error("Invalid DOCX: missing ZIP signature");
  process.exit(1);
}

console.log(`OK: wrote ${outPath} (${buffer.length} bytes, ZIP signature valid)`);
unlinkSync(outPath);