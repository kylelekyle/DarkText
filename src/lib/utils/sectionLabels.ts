import type { ChapterSection } from "$lib/types";

function sectionNoun(section: ChapterSection): string {
  switch (section) {
    case "chapters":
      return "Chapter";
    case "research":
      return "Research";
    case "characters":
      return "Character";
  }
}

export function sectionItemLabel(
  section: ChapterSection,
  action: "new" | "rename" | "duplicate" | "delete" | "snapshots",
): string {
  const noun = sectionNoun(section);
  switch (action) {
    case "new":
      return `New ${noun}`;
    case "rename":
      return `Rename ${noun}…`;
    case "duplicate":
      return `Duplicate ${noun}`;
    case "delete":
      return `Delete ${noun}`;
    case "snapshots":
      return `${noun} snapshots…`;
  }
}