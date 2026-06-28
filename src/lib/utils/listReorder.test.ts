import { describe, expect, it } from "vitest";
import {
  draggedOffsetPx,
  gapIndexFromPointerY,
  gapPositionFromPointerY,
  previewOrderAtGap,
  reorderByGap,
  reorderFinalChaptersInLibrary,
  reorderTargetIndex,
  shiftOffsetPx,
} from "./listReorder";

describe("listReorder", () => {
  const list = [
    { id: "a" },
    { id: "b" },
    { id: "c" },
    { id: "d" },
  ];

  it("reorders down by gap index", () => {
    expect(reorderByGap(list, "a", 2)?.map((x) => x.id)).toEqual([
      "b",
      "a",
      "c",
      "d",
    ]);
    expect(reorderByGap(list, "a", 3)?.map((x) => x.id)).toEqual([
      "b",
      "c",
      "a",
      "d",
    ]);
  });

  it("reorders up by gap index", () => {
    expect(reorderByGap(list, "d", 1)?.map((x) => x.id)).toEqual([
      "a",
      "d",
      "b",
      "c",
    ]);
  });

  it("returns null when position unchanged", () => {
    expect(reorderByGap(list, "b", 1)).toBeNull();
  });

  it("shows preview order during drag, not original index", () => {
    expect(previewOrderAtGap(list, "a", null, 0)).toBe(1);
    expect(previewOrderAtGap(list, "d", "a", 2)).toBe(4);
    expect(previewOrderAtGap(list, "a", "a", 2)).toBe(2);
    expect(previewOrderAtGap(list, "b", "d", 1)).toBe(3);
    expect(previewOrderAtGap(list, "b", "b", 1)).toBe(2);
  });

  it("shifts rows between source and gap", () => {
    expect(shiftOffsetPx(1, 0, 2, 40)).toBe(-40);
    expect(shiftOffsetPx(2, 0, 2, 40)).toBe(0);
    expect(shiftOffsetPx(1, 3, 1, 40)).toBe(40);
  });

  it("moves dragged row preview offset", () => {
    expect(draggedOffsetPx(0, 2, 36)).toBe(72);
  });

  it("maps pointer y to gap index", () => {
    const rects = [
      { top: 100, height: 40 },
      { top: 140, height: 40 },
      { top: 180, height: 40 },
    ];
    expect(gapIndexFromPointerY(110, rects)).toBe(0);
    expect(gapIndexFromPointerY(150, rects)).toBe(1);
    expect(gapIndexFromPointerY(210, rects)).toBe(3);
  });

  it("maps pointer y to continuous gap position", () => {
    const rects = [{ top: 100, height: 40 }, { top: 140, height: 40 }];
    expect(gapPositionFromPointerY(110, rects)).toBeCloseTo(0.25, 2);
    expect(gapPositionFromPointerY(150, rects)).toBeCloseTo(1.25, 2);
  });

  it("adjusts target index after removal", () => {
    expect(reorderTargetIndex(0, 2)).toBe(1);
    expect(reorderTargetIndex(3, 1)).toBe(1);
  });

  it("reorders final chapters without moving drafts", () => {
    const full = [
      { id: "a", status: "draft" },
      { id: "b", status: "final" },
      { id: "c", status: "draft" },
      { id: "d", status: "final" },
    ];
    expect(
      reorderFinalChaptersInLibrary(full, "d", 0)?.map((x) => x.id),
    ).toEqual(["a", "d", "c", "b"]);
  });
});