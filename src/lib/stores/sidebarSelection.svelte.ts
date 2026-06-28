import type { ChapterMeta, ChapterSection } from "$lib/types";

export class SidebarSelectionStore {
  section = $state<ChapterSection>("chapters");
  selectedIds = $state<Set<string>>(new Set());
  anchorId = $state<string | null>(null);

  count = $derived(this.selectedIds.size);
  hasSelection = $derived(this.selectedIds.size > 0);
  isMulti = $derived(this.selectedIds.size > 1);

  isSelected(id: string): boolean {
    return this.selectedIds.has(id);
  }

  setSection(section: ChapterSection) {
    if (this.section === section) return;
    this.section = section;
    this.clear();
  }

  clear() {
    this.selectedIds = new Set();
    this.anchorId = null;
  }

  selectSingle(id: string) {
    this.selectedIds = new Set([id]);
    this.anchorId = id;
  }

  toggle(id: string) {
    const next = new Set(this.selectedIds);
    if (next.has(id)) {
      next.delete(id);
      if (this.anchorId === id) {
        this.anchorId = next.size > 0 ? [...next].at(-1) ?? null : null;
      }
    } else {
      next.add(id);
      this.anchorId = id;
    }
    this.selectedIds = next;
  }

  setRange(items: ChapterMeta[], fromId: string, toId: string, additive: boolean) {
    const fromIdx = items.findIndex((c) => c.id === fromId);
    const toIdx = items.findIndex((c) => c.id === toId);
    if (fromIdx < 0 || toIdx < 0) return;

    const lo = Math.min(fromIdx, toIdx);
    const hi = Math.max(fromIdx, toIdx);
    const rangeIds = items.slice(lo, hi + 1).map((c) => c.id);
    const next = additive ? new Set(this.selectedIds) : new Set<string>();
    for (const id of rangeIds) next.add(id);
    this.selectedIds = next;
    this.anchorId = fromId;
  }

  pruneMissing(validIds: Set<string>) {
    const next = new Set([...this.selectedIds].filter((id) => validIds.has(id)));
    if (next.size === this.selectedIds.size) return;
    this.selectedIds = next;
    if (this.anchorId && !next.has(this.anchorId)) {
      this.anchorId = next.size > 0 ? [...next].at(-1) ?? null : null;
    }
  }
}

export const sidebarSelection = new SidebarSelectionStore();