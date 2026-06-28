import { describe, expect, it } from "vitest";
import { mergeFinalChapterOrder } from "./compileChapterReorder";

describe("mergeFinalChapterOrder", () => {
  const full = [
    { id: "a", title: "A", status: "draft" as const, order: 0, updatedAt: "2026-01-01T00:00:00Z" },
    { id: "b", title: "B", status: "final" as const, order: 1, updatedAt: "2026-01-01T00:00:00Z" },
    { id: "c", title: "C", status: "draft" as const, order: 2, updatedAt: "2026-01-01T00:00:00Z" },
    { id: "d", title: "D", status: "final" as const, order: 3, updatedAt: "2026-01-01T00:00:00Z" },
  ];
  const finals = full.filter((c) => c.status === "final");

  it("reorders final chapters within the full list", () => {
    const merged = mergeFinalChapterOrder(full, finals, ["d", "b"]);
    expect(merged?.map((c) => c.id)).toEqual(["a", "d", "c", "b"]);
  });

  it("returns null when ids do not match finals", () => {
    expect(mergeFinalChapterOrder(full, finals, ["b"])).toBeNull();
  });
});