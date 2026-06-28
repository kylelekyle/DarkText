/** Target index in the reordered array (after the dragged item is removed). */
export function reorderTargetIndex(fromIdx: number, gapIndex: number): number {
  let toIdx = gapIndex;
  if (fromIdx < toIdx) toIdx -= 1;
  return toIdx;
}

export function reorderByGap<T extends { id: string }>(
  list: T[],
  dragId: string,
  gapIndex: number,
): T[] | null {
  const fromIdx = list.findIndex((c) => c.id === dragId);
  if (fromIdx < 0) return null;
  const toIdx = reorderTargetIndex(fromIdx, gapIndex);
  if (fromIdx === toIdx) return null;
  const result = [...list];
  const [moved] = result.splice(fromIdx, 1);
  result.splice(toIdx, 0, moved);
  return result;
}

/** Reorder Final chapters while keeping draft chapters at their indices. */
export function reorderFinalChaptersInLibrary<T extends { id: string; status: string }>(
  fullList: T[],
  dragId: string,
  gapIndex: number,
): T[] | null {
  const finalIndices: number[] = [];
  const finals: T[] = [];
  for (let i = 0; i < fullList.length; i++) {
    if (fullList[i].status === "final") {
      finalIndices.push(i);
      finals.push(fullList[i]);
    }
  }
  const reordered = reorderByGap(finals, dragId, gapIndex);
  if (!reordered) return null;
  const result = [...fullList];
  finalIndices.forEach((idx, i) => {
    result[idx] = reordered[i];
  });
  return result;
}

/** Vertical shift for a row that stays in DOM order while previewing a drop gap. */
export function shiftOffsetPx(
  itemIndex: number,
  fromIdx: number,
  gapIndex: number,
  itemHeight: number,
): number {
  if (fromIdx === gapIndex) return 0;
  if (fromIdx < gapIndex) {
    if (itemIndex > fromIdx && itemIndex < gapIndex) return -itemHeight;
  } else if (itemIndex >= gapIndex && itemIndex < fromIdx) {
    return itemHeight;
  }
  return 0;
}

export function draggedOffsetPx(
  fromIdx: number,
  gapIndex: number,
  itemHeight: number,
): number {
  return (gapIndex - fromIdx) * itemHeight;
}

export function gapIndexFromPointerY(
  clientY: number,
  rowRects: { top: number; height: number }[],
): number {
  for (let i = 0; i < rowRects.length; i++) {
    const { top, height } = rowRects[i];
    if (clientY < top + height / 2) return i;
  }
  return rowRects.length;
}

/** Continuous insert position (0..n) for smooth drag preview. */
export function gapPositionFromPointerY(
  clientY: number,
  rowRects: { top: number; height: number }[],
): number {
  if (rowRects.length === 0) return 0;
  if (clientY <= rowRects[0].top) return 0;
  for (let i = 0; i < rowRects.length; i++) {
    const { top, height } = rowRects[i];
    const bottom = top + height;
    if (clientY <= bottom) {
      const t = Math.min(1, Math.max(0, (clientY - top) / height));
      return i + t;
    }
  }
  return rowRects.length;
}