import { libraryStore } from "$lib/stores/library.svelte";
import { createLinksBetweenNodes, hasLink } from "$lib/mindmap/links";
import { buildMindMapNodes, liveNodePositions } from "$lib/mindmap/nodes";
import {
  emptyMindMap,
  loadMindMapData,
  mindMapSnapshot,
  persistMindMapData,
} from "$lib/mindmap/persist";
import type {
  ChapterSection,
  ChapterStatus,
  MindMapData,
  MindMapLink,
  MindMapNode,
} from "$lib/types";
import { nodeKey } from "$lib/utils/mindmapLayout";
import { statusLabelShort } from "$lib/utils/statusLabel";

export const WORLD_W = 1800;
export const WORLD_H = 1400;

export type MindMapToast = (msg: string) => void;
export type OnOpenChapter = (chapterId: string, section: ChapterSection) => void | Promise<void>;
export type CloseMindMap = () => void;

export class MindMapStore {
  mindmap = $state<MindMapData>(emptyMindMap());
  nodes = $state<MindMapNode[]>([]);
  selected = $state<Set<string>>(new Set());
  contextMenu = $state<{
    x: number;
    y: number;
    kind: "canvas" | "node";
    nodeKey?: string;
  } | null>(null);

  panX = $state(0);
  panY = $state(0);
  zoom = $state(1);
  globalPinned = $state(false);

  dragNodeKey = $state<string | null>(null);
  dragLive = $state<{ key: string; x: number; y: number } | null>(null);
  panning = $state(false);
  interacting = $state(false);
  loaded = $state(false);

  private dragOffsetX = 0;
  private dragOffsetY = 0;
  private panStartX = 0;
  private panStartY = 0;
  private panOriginX = 0;
  private panOriginY = 0;
  private panMoved = false;
  private panClickX = 0;
  private panClickY = 0;
  private livePanX = 0;
  private livePanY = 0;

  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private wheelSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private mindMapLoadedFor: string | null = null;
  private wasMindMapVisible = false;
  private libraryFingerprint = "";

  private viewportRect: DOMRect | null = null;
  private worldEl: HTMLDivElement | null = null;
  private rafId: number | null = null;
  private pendingMove: PointerEvent | null = null;
  private dragMoved = false;
  private captureEl: Element | null = null;

  private toast: MindMapToast = () => {};
  private getLibraryPath: () => string | null = () => null;
  private getViewport: () => HTMLDivElement | null = () => null;
  private onOpenChapter: OnOpenChapter = () => {};
  private closeMindMap: CloseMindMap = () => {};

  bindToast(fn: MindMapToast) {
    this.toast = fn;
  }

  bindLibraryPath(getter: () => string | null) {
    this.getLibraryPath = getter;
  }

  bindViewport(getter: () => HTMLDivElement | null) {
    this.getViewport = getter;
  }

  bindWorld(el: HTMLDivElement | null) {
    this.worldEl = el;
    this.applyWorldTransform();
  }

  bindOnOpenChapter(fn: OnOpenChapter) {
    this.onOpenChapter = fn;
  }

  bindCloseMindMap(fn: CloseMindMap) {
    this.closeMindMap = fn;
  }

  statusLabel(status: ChapterStatus): string {
    return statusLabelShort(status);
  }

  private refreshViewportRect() {
    this.viewportRect = this.getViewport()?.getBoundingClientRect() ?? null;
  }

  private applyWorldTransform(px = this.panX, py = this.panY, z = this.zoom) {
    if (!this.worldEl) return;
    this.worldEl.style.transform = `translate(${px}px, ${py}px) scale(${z})`;
  }

  buildNodes() {
    if (!libraryStore.library) {
      this.nodes = [];
      return;
    }

    const { nodes, links } = buildMindMapNodes({
      chapters: libraryStore.library.chapters,
      research: libraryStore.researchChapters,
      characters: libraryStore.characterChapters,
      savedNodes: this.mindmap.nodes,
      existingNodes: this.nodes,
      links: this.mindmap.links,
    });

    if (links.length !== this.mindmap.links.length) {
      this.mindmap = { ...this.mindmap, links };
    }

    this.nodes = nodes;
  }

  async loadMindMap() {
    const path = this.getLibraryPath();
    if (!path) return;
    this.loaded = false;
    try {
      const data = await loadMindMapData(path);
      this.mindmap = data;
      this.globalPinned = data.globalPinned;
      this.panX = data.view?.panX ?? 0;
      this.panY = data.view?.panY ?? 0;
      this.zoom = data.view?.zoom ?? 1;
      this.livePanX = this.panX;
      this.livePanY = this.panY;
      this.buildNodes();
      this.applyWorldTransform();
    } finally {
      this.loaded = true;
    }
  }

  scheduleSave() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => void this.persist(), 600);
  }

  async persist() {
    const path = this.getLibraryPath();
    if (!path) return;
    const snapshot = mindMapSnapshot(
      this.mindmap,
      this.nodes,
      this.globalPinned,
      this.panX,
      this.panY,
      this.zoom,
    );
    this.mindmap = snapshot;
    try {
      this.mindmap = await persistMindMapData(path, snapshot);
    } catch (e) {
      this.toast(String(e));
    }
  }

  screenToWorld(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.viewportRect;
    if (!rect) return { x: 0, y: 0 };
    const panX = this.panning ? this.livePanX : this.panX;
    const panY = this.panning ? this.livePanY : this.panY;
    return {
      x: (clientX - rect.left - panX) / this.zoom,
      y: (clientY - rect.top - panY) / this.zoom,
    };
  }

  isDraggable(node: MindMapNode): boolean {
    return !this.globalPinned && !node.pinned;
  }

  onNodePointerDown(e: PointerEvent, node: MindMapNode) {
    if (e.button !== 0) return;
    e.stopPropagation();
    this.closeContextMenu();
    this.refreshViewportRect();
    this.dragMoved = false;

    if (e.ctrlKey || e.metaKey) return;

    if (!this.isDraggable(node)) return;
    this.dragNodeKey = node.key;
    this.dragLive = { key: node.key, x: node.x, y: node.y };
    this.interacting = true;
    const world = this.screenToWorld(e.clientX, e.clientY);
    this.dragOffsetX = world.x - node.x;
    this.dragOffsetY = world.y - node.y;
    this.captureEl = e.currentTarget as HTMLElement;
    this.captureEl.setPointerCapture(e.pointerId);
  }

  onWorldPointerDown(e: PointerEvent) {
    if ((e.target as HTMLElement).closest(".node-wrap")) return;
    this.onCanvasPointerDown(e);
  }

  onCanvasPointerDown(e: PointerEvent) {
    if (e.button !== 0 && e.button !== 1) return;
    this.closeContextMenu();
    this.refreshViewportRect();
    this.panning = true;
    this.interacting = true;
    this.panMoved = false;
    this.panClickX = e.clientX;
    this.panClickY = e.clientY;
    this.panStartX = e.clientX;
    this.panStartY = e.clientY;
    this.panOriginX = this.panX;
    this.panOriginY = this.panY;
    this.livePanX = this.panX;
    this.livePanY = this.panY;
    this.captureEl = this.getViewport();
    this.captureEl?.setPointerCapture(e.pointerId);
  }

  onPointerMove(e: PointerEvent) {
    if (!this.dragNodeKey && !this.panning) return;
    this.pendingMove = e;
    if (this.rafId !== null) return;
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      const ev = this.pendingMove;
      this.pendingMove = null;
      if (ev) this.applyPointerMove(ev);
    });
  }

  private applyPointerMove(e: PointerEvent) {
    if (this.dragNodeKey) {
      const world = this.screenToWorld(e.clientX, e.clientY);
      const nx = world.x - this.dragOffsetX;
      const ny = world.y - this.dragOffsetY;
      const live = this.dragLive;
      if (live && live.x === nx && live.y === ny) return;
      this.dragMoved = true;
      this.dragLive = { key: this.dragNodeKey, x: nx, y: ny };
      return;
    }

    if (this.panning) {
      const dx = e.clientX - this.panClickX;
      const dy = e.clientY - this.panClickY;
      if (Math.hypot(dx, dy) > 3) this.panMoved = true;
      this.livePanX = this.panOriginX + (e.clientX - this.panStartX);
      this.livePanY = this.panOriginY + (e.clientY - this.panStartY);
      this.applyWorldTransform(this.livePanX, this.livePanY, this.zoom);
    }
  }

  onPointerUp(e: PointerEvent) {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.pendingMove) {
      this.applyPointerMove(this.pendingMove);
      this.pendingMove = null;
    }

    const wasDragging = !!this.dragNodeKey;
    if (this.dragNodeKey) {
      const key = this.dragNodeKey;
      const live = this.dragLive;
      if (live && live.key === key) {
        const idx = this.nodes.findIndex((n) => n.key === key);
        if (idx >= 0) {
          const node = this.nodes[idx];
          const next = [...this.nodes];
          next[idx] = { ...node, x: live.x, y: live.y };
          this.nodes = next;
        }
      }
      this.dragNodeKey = null;
      this.dragLive = null;
      this.scheduleSave();
    }

    if (this.panning) {
      if (!this.panMoved && !wasDragging) this.selected = new Set();
      if (this.panMoved) {
        this.panX = this.livePanX;
        this.panY = this.livePanY;
        this.scheduleSave();
      }
      this.panning = false;
      this.applyWorldTransform();
      this.panMoved = false;
    }

    this.interacting = false;

    this.releasePointerCapture(e);
  }

  private releasePointerCapture(e: PointerEvent) {
    const el = this.captureEl;
    if (el?.hasPointerCapture(e.pointerId)) {
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        /* released */
      }
    }
    this.captureEl = null;
  }

  onWheel(e: WheelEvent) {
    e.preventDefault();
    this.refreshViewportRect();
    const rect = this.viewportRect;
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const factor = e.deltaY > 0 ? 0.92 : 1.08;
    const nextZoom = Math.min(2.2, Math.max(0.35, this.zoom * factor));
    const wx = (mx - this.panX) / this.zoom;
    const wy = (my - this.panY) / this.zoom;
    this.panX = mx - wx * nextZoom;
    this.panY = my - wy * nextZoom;
    this.livePanX = this.panX;
    this.livePanY = this.panY;
    this.zoom = nextZoom;
    this.applyWorldTransform();
    if (this.wheelSaveTimer) clearTimeout(this.wheelSaveTimer);
    this.wheelSaveTimer = setTimeout(() => {
      this.wheelSaveTimer = null;
      this.scheduleSave();
    }, 500);
  }

  selectNode(node: MindMapNode, additive = false) {
    if (additive) {
      const next = new Set(this.selected);
      if (next.has(node.key)) next.delete(node.key);
      else next.add(node.key);
      this.selected = next;
      return;
    }
    this.selected = new Set([node.key]);
  }

  onNodeClick(e: MouseEvent, node: MindMapNode) {
    e.stopPropagation();
    if (this.panMoved || this.dragMoved) return;
    this.selectNode(node, e.ctrlKey || e.metaKey);
  }

  onNodeKeydown(e: KeyboardEvent, node: MindMapNode) {
    if (e.key === "Enter") {
      e.preventDefault();
      this.onNodeDblClick(node);
    } else if (e.key === " ") {
      e.preventDefault();
      this.selectNode(node, e.ctrlKey || e.metaKey);
    }
  }

  onNodeDblClick(node: MindMapNode) {
    void this.onOpenChapter(node.id, node.section);
    this.closeMindMap();
  }

  onNodeContextMenu(e: MouseEvent, node: MindMapNode) {
    e.preventDefault();
    e.stopPropagation();
    if (!this.selected.has(node.key)) this.selected = new Set([node.key]);
    this.contextMenu = { x: e.clientX, y: e.clientY, kind: "node", nodeKey: node.key };
  }

  onCanvasContextMenu(e: MouseEvent) {
    e.preventDefault();
    this.contextMenu = { x: e.clientX, y: e.clientY, kind: "canvas" };
  }

  closeContextMenu() {
    this.contextMenu = null;
  }

  onCtxMenuKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      this.closeContextMenu();
    }
  }

  hasLinkBetween(a: string, b: string): boolean {
    return hasLink(this.mindmap.links, a, b);
  }

  linkSelected() {
    const keys = [...this.selected];
    if (keys.length < 2) return;
    const newLinks = createLinksBetweenNodes(keys, this.nodes, this.mindmap.links);
    if (newLinks.length === this.mindmap.links.length) return;
    this.mindmap = { ...this.mindmap, links: newLinks };
    this.scheduleSave();
    this.closeContextMenu();
    this.toast("Links created");
  }

  toggleNodePin(key: string) {
    const idx = this.nodes.findIndex((n) => n.key === key);
    if (idx < 0) return;
    const node = this.nodes[idx];
    const next = [...this.nodes];
    next[idx] = { ...node, pinned: !node.pinned };
    this.nodes = next;
    this.scheduleSave();
    this.closeContextMenu();
  }

  toggleGlobalPin() {
    this.globalPinned = !this.globalPinned;
    this.mindmap = { ...this.mindmap, globalPinned: this.globalPinned };
    this.toast(this.globalPinned ? "All nodes pinned" : "Nodes free to move");
    this.scheduleSave();
  }

  zoomBy(factor: number) {
    this.refreshViewportRect();
    const rect = this.viewportRect;
    if (!rect) return;
    const mx = rect.width / 2;
    const my = rect.height / 2;
    const nextZoom = Math.min(2.2, Math.max(0.35, this.zoom * factor));
    const wx = (mx - this.panX) / this.zoom;
    const wy = (my - this.panY) / this.zoom;
    this.panX = mx - wx * nextZoom;
    this.panY = my - wy * nextZoom;
    this.livePanX = this.panX;
    this.livePanY = this.panY;
    this.zoom = nextZoom;
    this.applyWorldTransform();
    this.scheduleSave();
  }

  resetView() {
    this.panX = 0;
    this.panY = 0;
    this.livePanX = 0;
    this.livePanY = 0;
    this.zoom = 1;
    this.applyWorldTransform();
    this.scheduleSave();
  }

  async createOnCanvas(section: ChapterSection) {
    this.closeContextMenu();
    const content = await libraryStore.newChapter(undefined, section);
    if (!content) return;
    this.buildNodes();
    this.scheduleSave();
    void this.onOpenChapter(content.meta.id, section);
  }

  openSelected(key?: string) {
    const k = key ?? [...this.selected][0];
    const node = this.nodes.find((n) => n.key === k);
    if (!node) return;
    void this.onOpenChapter(node.id, node.section);
    this.closeMindMap();
    this.closeContextMenu();
  }

  get nodePositionByKey(): Map<string, { x: number; y: number }> {
    const map = liveNodePositions(this.nodes);
    const live = this.dragLive;
    if (live) map.set(live.key, { x: live.x, y: live.y });
    return map;
  }

  edgeActive(link: MindMapLink): boolean {
    const f = nodeKey(link.from.section, link.from.id);
    const t = nodeKey(link.to.section, link.to.id);
    return this.selected.has(f) || this.selected.has(t);
  }

  get footerCounts() {
    let chapters = 0;
    let research = 0;
    let characters = 0;
    for (const n of this.nodes) {
      if (n.section === "chapters") chapters++;
      else if (n.section === "research") research++;
      else if (n.section === "characters") characters++;
    }
    return { chapters, research, characters, links: this.mindmap.links.length };
  }

  onShowChanged(show: boolean, libraryPath: string | null) {
    const opened = show && !this.wasMindMapVisible;
    const libraryChanged =
      show && libraryPath !== null && libraryPath !== this.mindMapLoadedFor;
    this.wasMindMapVisible = show;
    if (show && libraryPath && (opened || libraryChanged)) {
      this.mindMapLoadedFor = libraryPath;
      this.libraryFingerprint = "";
      void this.loadMindMap();
    }
    if (!show) {
      this.mindMapLoadedFor = null;
      this.libraryFingerprint = "";
      this.interacting = false;
      this.panning = false;
      this.dragNodeKey = null;
      this.dragLive = null;
      this.panMoved = false;
      this.dragMoved = false;
    }
  }

  onLibraryDataChanged(fingerprint: string) {
    if (!this.loaded || this.interacting) return;
    if (fingerprint === this.libraryFingerprint) return;
    this.libraryFingerprint = fingerprint;
    this.buildNodes();
  }
}

export const mindmapStore = new MindMapStore();