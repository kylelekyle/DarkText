#!/usr/bin/env node
/**
 * Generate a large DarkText library for stress testing.
 *
 * Usage:
 *   node scripts/generate-test-library.mjs [outputDir]
 *   node scripts/generate-test-library.mjs --double
 *   node scripts/generate-test-library.mjs --scale=4
 *   node scripts/generate-test-library.mjs --chapters=100 --words=7000
 *
 * Presets:
 *   default  —  50 chapters × ~3,500 words  (~175k words, 102 files)
 *   --double — 100 chapters × ~7,000 words  (~700k words, 202 files)
 *   --scale=N multiplies default chapter count and words-per-chapter by N
 */

import { mkdir, writeFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const root = fileURLToPath(new URL("..", import.meta.url));

const args = process.argv.slice(2);
const hasFlag = (name) => args.includes(`--${name}`);
const flag = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? Number(hit.split("=")[1]) : fallback;
};

const scale = hasFlag("double") ? 2 : Math.max(1, flag("scale", 1));
const explicitChapters = args.some((a) => a.startsWith("--chapters="));
const explicitWords = args.some((a) => a.startsWith("--words="));

const chapterCount = Math.max(
  1,
  explicitChapters ? flag("chapters", 50) : Math.round(50 * scale),
);
const targetWords = Math.max(
  500,
  explicitWords ? flag("words", 3500) : Math.round(3500 * scale),
);
const wordJitter = Math.min(
  Math.floor(targetWords * 0.25),
  Math.max(1500, Math.floor(targetWords * 0.1)),
);

const defaultFolder =
  scale > 1 ? `DarkText-TestLibrary-${scale}x` : "DarkText-TestLibrary";
const defaultOut = join(
  process.env.USERPROFILE ?? process.env.HOME ?? root,
  "Desktop",
  defaultFolder,
);
const positional = args.find((a) => !a.startsWith("--"));
const outDir = resolve(positional ?? defaultOut);

const STATUSES = ["draft", "draft", "draft", "review", "final"];

const SENTENCES = [
  "The harbour lights flickered across black water while the city held its breath.",
  "She traced the margin notes again, as if the ink might rearrange itself into answers.",
  "Every door in the old house seemed to open onto a different version of the same argument.",
  "Rain struck the workshop roof in steady sheets, turning metal tools into muted drums.",
  "He had promised to return before the clocks changed, and the clocks had changed twice.",
  "The manuscript box smelled of cedar, dust, and the faint sweetness of forgotten tea.",
  "No one spoke when the power failed; the silence had its own crowded vocabulary.",
  "A letter arrived without a postmark, folded so tightly the paper had split along one crease.",
  "They walked the ridge at dawn, boots sinking into ground that was still holding winter.",
  "The market square filled with voices, each one bargaining for time it did not own.",
  "Ink dried faster in this climate, which made every crossed-out line feel permanent.",
  "The archive keeper refused to look up until the question was asked in the old dialect.",
  "Somewhere below the station, a train exhaled and the platform tiles vibrated underfoot.",
  "She kept the map folded wrong on purpose, so unfolding it always felt like a decision.",
  "The orchard at the edge of town had been picked clean, but the wasps remained.",
  "His coat pockets held three keys, none of which matched the lock he needed tonight.",
  "Candle wax pooled on the desk and hardened into shapes that resembled small islands.",
  "The council met by lantern light and voted on matters no one would admit aloud.",
  "A dog barked once, then listened, as if expecting the night to answer back.",
  "The river had shifted course since the last survey, leaving the bridge oddly patient.",
  "Every chapter she finished seemed to begin another, hidden beneath the final paragraph.",
  "The typist's machine jammed on the letter q, which felt like a joke too specific to ignore.",
  "They measured the room in footsteps and found it longer on the return path.",
  "Snow erased the path but not the habit of walking it before breakfast.",
  "The photograph curled at the corners, showing two people who refused to face the lens.",
  "He wrote the date, crossed it out, and wrote it again with stubborn precision.",
  "The bell in the chapel tower rang late, as though time had stumbled on the stairs.",
  "Her notebook contained lists, diagrams, and one sentence repeated on every third page.",
  "The ferry captain said the crossing would be rough, then smiled as if that helped.",
  "Windows reflected windows until the street looked like a corridor of borrowed rooms.",
  "The garden gate stuck halfway, committed to neither open nor closed.",
  "Someone had chalked a message on the quarry wall and the rain had not washed it away.",
  "The clockmaker claimed he could hear gears thinking when the shop was empty.",
  "They shared the last lamp oil and pretended dawn was a choice they could schedule.",
  "The book's final page was blank, which felt less like an ending and more like permission.",
  "Footsteps on the stair paused, continued, paused again, then hurried away.",
  "The wind carried chimney smoke in ribbons that tied the rooftops together.",
  "She learned the town by its sounds: shutters, carts, distant hammering, a single piano.",
  "The envelope contained nothing but a pressed leaf and the memory of a name.",
  "He stacked stones by the trail marker, each one a small refusal to get lost.",
  "The courtroom emptied slowly, as if justice needed room to cool before it set.",
  "A moth circled the lamp until its wings looked worn thin as old linen.",
  "The cellar door breathed cold air that smelled of apples and damp stone.",
  "They argued about routes, then walked side by side without mentioning it again.",
  "The horizon line sharpened at dusk, cutting the sky from the wheat field cleanly.",
  "Every bench in the square had initials carved into the armrests like quiet claims.",
  "The radio hissed between stations until a voice appeared, mid-sentence, already urgent.",
  "She filed the pages by mood instead of date and found the system strangely accurate.",
  "The bridge toll keeper asked no questions and took the coin as if it were a confession.",
  "Morning fog made the town look provisional, like a set left up overnight.",
];

function htmlToText(html) {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function countWords(text) {
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildParagraph(wordGoal) {
  const parts = [];
  let words = 0;
  while (words < wordGoal) {
    parts.push(pick(SENTENCES));
    words = countWords(parts.join(" "));
  }
  return `<p>${parts.join(" ")}</p>`;
}

function buildChapterHtml(chapterIndex, wordGoal) {
  const blocks = [
    `<h2>Chapter ${chapterIndex + 1}</h2>`,
    `<p><em>Generated stress-test prose for DarkText. Chapter index ${chapterIndex + 1}.</em></p>`,
  ];
  let words = countWords(htmlToText(blocks.join("")));
  const paraGoal = 180;
  while (words < wordGoal) {
    const remaining = wordGoal - words;
    const next = buildParagraph(Math.min(paraGoal, Math.max(80, remaining)));
    blocks.push(next);
    words = countWords(htmlToText(blocks.join("")));
  }
  return blocks.join("\n");
}

function chapterTitle(index) {
  const titles = [
    "The Harbour at Dusk",
    "Margin Notes",
    "House of Open Doors",
    "Workshop Rain",
    "Before the Clocks Change",
    "Cedar and Dust",
    "Crowded Silence",
    "Letter Without Postmark",
    "Winter Ridge",
    "Market Voices",
    "Permanent Lines",
    "Old Dialect",
    "Platform Vibration",
    "Folded Wrong",
    "Orchard Wasps",
    "Three Keys",
    "Wax Islands",
    "Lantern Council",
    "Night Answer",
    "Patient Bridge",
    "Hidden Chapter",
    "The Letter Q",
    "Measured Room",
    "Erased Path",
    "Curled Photograph",
    "Crossed Date",
    "Late Bell",
    "Repeated Sentence",
    "Rough Crossing",
    "Borrowed Rooms",
    "Half Gate",
    "Quarry Message",
    "Thinking Gears",
    "Shared Lamp Oil",
    "Blank Permission",
    "Hurried Steps",
    "Smoke Ribbons",
    "Town by Sound",
    "Pressed Leaf",
    "Refusal Stones",
    "Cooling Justice",
    "Thin Wings",
    "Cellar Breath",
    "Side by Side",
    "Sharpened Horizon",
    "Quiet Claims",
    "Mid-Sentence Voice",
    "Mood Filing",
    "Bridge Toll",
    "Provisional Town",
  ];
  const base = titles[index % titles.length];
  const cycle = Math.floor(index / titles.length);
  return cycle === 0 ? base : `${base} (${cycle + 1})`;
}

async function main() {
  if (existsSync(join(outDir, "library.json"))) {
    if (hasFlag("force")) {
      await rm(outDir, { recursive: true, force: true });
    } else {
      console.error(`Already exists: ${outDir}`);
      console.error("Delete it first, pass a different output path, or use --force.");
      process.exit(1);
    }
  }

  const chaptersDir = join(outDir, "chapters");
  await mkdir(chaptersDir, { recursive: true });

  const now = new Date().toISOString();
  const chapters = [];
  let totalWords = 0;

  const minWords = Math.max(500, Math.floor(targetWords * 0.7));

  for (let i = 0; i < chapterCount; i++) {
    const id = randomUUID();
    const jitter = Math.floor(Math.random() * wordJitter * 2) - wordJitter;
    const wordGoal = Math.max(minWords, targetWords + jitter);
    const html = buildChapterHtml(i, wordGoal);
    const plain = htmlToText(html);
    const wordCount = countWords(plain);
    const charCount = plain.length;
    totalWords += wordCount;

    const meta = {
      id,
      title: chapterTitle(i),
      status: STATUSES[i % STATUSES.length],
      order: i,
      updatedAt: now,
      wordCount,
      charCount,
    };

    chapters.push(meta);
    await writeFile(join(chaptersDir, `${id}.meta.json`), JSON.stringify(meta, null, 2));
    await writeFile(join(chaptersDir, `${id}.html`), html, "utf8");

    if ((i + 1) % 10 === 0 || i + 1 === chapterCount) {
      console.log(`  wrote ${i + 1}/${chapterCount} chapters…`);
    }
  }

  const manifest = {
    name: scale > 1 ? `DarkText Stress Test (${scale}x)` : "DarkText Stress Test",
    version: 1,
    path: outDir.replace(/\//g, "\\"),
    chapters,
  };

  const book = {
    title: scale > 1 ? `The Long Test Manuscript (${scale}x)` : "The Long Test Manuscript",
    author: "DarkText Generator",
    includeFrontMatter: true,
    includeBackMatter: false,
    wordGoal: totalWords,
    preferences: {},
  };

  await writeFile(join(outDir, "library.json"), JSON.stringify(manifest, null, 2));
  await writeFile(join(outDir, "book.json"), JSON.stringify(book, null, 2));

  const fileCount = chapterCount * 2 + 2;

  console.log(`Created test library at:\n  ${outDir}`);
  console.log(`Scale: ${scale}x`);
  console.log(`Chapters: ${chapterCount}`);
  console.log(`Files: ${fileCount} (${chapterCount} html + ${chapterCount} meta + library.json + book.json)`);
  console.log(`Total words: ${totalWords.toLocaleString()}`);
  console.log(`Avg words/chapter: ${Math.round(totalWords / chapterCount).toLocaleString()}`);
  console.log("\nOpen in DarkText: Create/Open Library → choose this folder.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});