import { describe, expect, it } from "vitest";
import { pruneRecentLibraryList } from "./recentLibraries";

describe("pruneRecentLibraryList", () => {
  it("keeps only paths that still exist", () => {
    const valid = new Set(["C:\\Books\\Novel", "C:\\Books\\Poems"]);
    const result = pruneRecentLibraryList(
      ["C:\\Books\\Novel", "C:\\Desktop\\MissingLibrary", "C:\\Books\\Poems"],
      (path) => valid.has(path),
    );
    expect(result).toEqual(["C:\\Books\\Novel", "C:\\Books\\Poems"]);
  });

  it("returns an empty list when every path is gone", () => {
    expect(pruneRecentLibraryList(["C:\\gone"], () => false)).toEqual([]);
  });
});