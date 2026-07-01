/**
 * Self-contained canvas graph view: rendering + interaction controller on top
 * of `Simulation`. Framework-agnostic — the host provides a canvas and
 * callbacks; all DOM chrome (context menus, sliders) lives in the host.
 *
 * Interaction state machine (`mode`):
 *   idle → dragNode (left-down on node)
 *        → rectSelect (left-down on background)
 *        → pan (middle-down)
 * plus a sticky `linkSourceId` for Ctrl/Cmd-click linking, which survives
 * across clicks until completed or cancelled.
 */

import { ALPHA_MIN, Simulation } from "./simulation";
import { missingCliqueLinks, missingStarLinks, pairKey } from "./linkOps";
import {
  nodeRadius,
  type GraphLink,
  type GraphLinkInput,
  type GraphNode,
  type GraphNodeInput,
  type GraphParams,
} from "./types";

export interface GraphContextMenuInfo {
  clientX: number;
  clientY: number;
  /** Node under the cursor, if any. */
  nodeId: string | null;
  worldX: number;
  worldY: number;
  selectedIds: string[];
}

export interface GraphViewCallbacks {
  onOpenNode(node: GraphNode): void;
  onContextMenu(info: GraphContextMenuInfo): void;
  /** Anything worth persisting changed (drag end, link, pin, settle). */
  onGraphMutated(): void;
  onViewChanged(zoom: number): void;
  onSelectionChanged(ids: ReadonlySet<string>): void;
  onLinkModeChanged(active: boolean): void;
}

type Mode =
  | { kind: "drag"; node: GraphNode; dx: number; dy: number; moved: boolean }
  | { kind: "rect"; x0: number; y0: number; x1: number; y1: number; moved: boolean; additive: boolean }
  | { kind: "pan"; startX: number; startY: number; camX: number; camY: number; moved: boolean }
  | null;

const CLICK_SLOP = 4; // px of screen movement before a press becomes a drag
const LINK_GROW_MS = 160;
const PULSE_MS = 200;
const POP_MS = 160;
const ZOOM_MIN = 0.15;
const ZOOM_MAX = 2.5;

interface Theme {
  bg: string;
  edge: string;
  edgeActive: string;
  label: string;
  pin: string;
  select: string;
  sections: Record<string, string>;
}

export class GraphView {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private cb: GraphViewCallbacks;
  readonly sim: Simulation;

  private byId = new Map<string, GraphNode>();
  private linkKeys = new Set<string>();
  private selected = new Set<string>();
  private linkSourceId: string | null = null;

  private cam = { x: 0, y: 0, z: 1 };
  private mode: Mode = null;
  private mouseWorld = { x: 0, y: 0 };
  private dirty = true;
  private fitted = false;
  private wasActive = false;
  private raf: number | null = null;
  private theme: Theme;
  private disposers: Array<() => void> = [];

  constructor(
    canvas: HTMLCanvasElement,
    params: GraphParams,
    callbacks: GraphViewCallbacks,
  ) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2d canvas context unavailable");
    this.ctx = ctx;
    this.cb = callbacks;
    this.sim = new Simulation(params);
    this.theme = this.resolveTheme();
    this.bindEvents();
    this.startLoop();
  }

  destroy(): void {
    if (this.raf !== null) cancelAnimationFrame(this.raf);
    this.raf = null;
    for (const d of this.disposers) d();
    this.disposers = [];
  }

  // --- Data -----------------------------------------------------------------

  /** Reconcile the node set. Existing nodes keep position/velocity/pin. */
  setNodes(inputs: GraphNodeInput[]): void {
    const next = new Map<string, GraphNode>();
    for (const input of inputs) {
      const prev = this.byId.get(input.id);
      if (prev) {
        prev.label = input.label;
        next.set(input.id, prev);
      } else {
        next.set(input.id, {
          id: input.id,
          label: input.label,
          section: input.section,
          x: input.x,
          y: input.y,
          vx: 0,
          vy: 0,
          fx: input.pinned ? input.x : null,
          fy: input.pinned ? input.y : null,
          pinned: input.pinned,
          degree: 0,
          r: nodeRadius(0),
          pulseAt: 0,
          popAt: 0,
        });
      }
    }
    this.byId = next;
    this.sim.nodes = [...next.values()];
    // Drop links and selection that reference removed nodes.
    this.sim.links = this.sim.links.filter(
      (l) => next.has(l.source.id) && next.has(l.target.id),
    );
    this.rebuildLinkIndex();
    let selectionChanged = false;
    for (const id of this.selected) {
      if (!next.has(id)) {
        this.selected.delete(id);
        selectionChanged = true;
      }
    }
    if (selectionChanged) this.cb.onSelectionChanged(this.selected);
    if (this.linkSourceId && !next.has(this.linkSourceId)) this.cancelLinkMode();
    this.recomputeDegrees();
    this.recenter();
    if (!this.fitted && inputs.length > 0) {
      this.fitted = true;
      this.fitView();
    }
    this.sim.reheat();
    this.dirty = true;
  }

  /** Replace the link set (used once at load; later links come from actions). */
  setLinks(inputs: GraphLinkInput[]): void {
    const links: GraphLink[] = [];
    for (const input of inputs) {
      const source = this.byId.get(input.sourceId);
      const target = this.byId.get(input.targetId);
      if (!source || !target || source === target) continue;
      links.push({ id: input.id, source, target, bornAt: 0 });
    }
    this.sim.links = links;
    this.rebuildLinkIndex();
    this.recomputeDegrees();
    this.sim.reheat();
    this.dirty = true;
  }

  /** Snapshot for persistence. */
  getGraph(): {
    nodes: Array<{ id: string; x: number; y: number; pinned: boolean }>;
    links: Array<{ id: string; sourceId: string; targetId: string }>;
  } {
    return {
      nodes: this.sim.nodes.map((n) => ({
        id: n.id,
        x: n.x,
        y: n.y,
        pinned: n.pinned,
      })),
      links: this.sim.links.map((l) => ({
        id: l.id,
        sourceId: l.source.id,
        targetId: l.target.id,
      })),
    };
  }

  counts(): { nodes: number; links: number; bySection: Record<string, number> } {
    const bySection: Record<string, number> = {};
    for (const n of this.sim.nodes) {
      bySection[n.section] = (bySection[n.section] ?? 0) + 1;
    }
    return { nodes: this.sim.nodes.length, links: this.sim.links.length, bySection };
  }

  /** Move a node to an exact spot (used for "create node here"). */
  placeNode(id: string, x: number, y: number): void {
    const node = this.byId.get(id);
    if (!node) return;
    node.x = x;
    node.y = y;
    node.vx = 0;
    node.vy = 0;
    if (node.pinned) {
      node.fx = x;
      node.fy = y;
    }
    this.sim.reheat(0.5);
    this.dirty = true;
  }

  // --- Actions ---------------------------------------------------------------

  setParams(params: GraphParams): void {
    this.sim.params = params;
    this.sim.reheat(0.5);
    this.dirty = true;
  }

  isPinned(id: string): boolean {
    return this.byId.get(id)?.pinned ?? false;
  }

  selectedIds(): string[] {
    return [...this.selected];
  }

  get linkModeActive(): boolean {
    return this.linkSourceId !== null;
  }

  cancelLinkMode(): void {
    if (this.linkSourceId === null) return;
    this.linkSourceId = null;
    this.cb.onLinkModeChanged(false);
    this.dirty = true;
  }

  /** Toggle pin on each of the given nodes (P key / context menu). */
  togglePin(ids: string[]): void {
    const now = performance.now();
    let changed = false;
    for (const id of ids) {
      const node = this.byId.get(id);
      if (!node) continue;
      node.pinned = !node.pinned;
      node.fx = node.pinned ? node.x : null;
      node.fy = node.pinned ? node.y : null;
      node.popAt = now;
      changed = true;
    }
    if (!changed) return;
    this.sim.reheat(0.4);
    this.dirty = true;
    this.cb.onGraphMutated();
  }

  togglePinSelected(): void {
    this.togglePin([...this.selected]);
  }

  /** Complete subgraph across the current selection. */
  linkSelectedClique(): void {
    this.addLinks(missingCliqueLinks([...this.selected], new Set(this.linkKeys)));
  }

  /** Star: every selected node linked to `hubId`. */
  linkSelectedTo(hubId: string): void {
    this.addLinks(
      missingStarLinks(hubId, [...this.selected], new Set(this.linkKeys)),
    );
  }

  zoomBy(factor: number): void {
    const rect = this.canvas.getBoundingClientRect();
    this.zoomAt(rect.width / 2, rect.height / 2, factor);
  }

  fitView(): void {
    const nodes = this.sim.nodes;
    const rect = this.canvas.getBoundingClientRect();
    if (nodes.length === 0 || rect.width === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x);
      maxY = Math.max(maxY, n.y);
    }
    const pad = 90;
    const w = maxX - minX + pad * 2;
    const h = maxY - minY + pad * 2;
    const z = Math.max(
      ZOOM_MIN,
      Math.min(1.4, Math.min(rect.width / w, rect.height / h)),
    );
    this.cam.z = z;
    this.cam.x = rect.width / 2 - ((minX + maxX) / 2) * z;
    this.cam.y = rect.height / 2 - ((minY + maxY) / 2) * z;
    this.cb.onViewChanged(z);
    this.dirty = true;
  }

  refreshTheme(): void {
    this.theme = this.resolveTheme();
    this.dirty = true;
  }

  // --- Internals --------------------------------------------------------------

  private addLinks(pairs: Array<[string, string]>): void {
    if (pairs.length === 0) return;
    const now = performance.now();
    for (const [a, b] of pairs) {
      const source = this.byId.get(a);
      const target = this.byId.get(b);
      if (!source || !target) continue;
      this.sim.links.push({
        id: crypto.randomUUID(),
        source,
        target,
        bornAt: now,
      });
      this.linkKeys.add(pairKey(a, b));
    }
    this.recomputeDegrees();
    this.sim.reheat(0.6);
    this.dirty = true;
    this.cb.onGraphMutated();
  }

  private createLinkPair(a: string, b: string): void {
    if (this.linkKeys.has(pairKey(a, b))) return;
    this.addLinks([[a, b]]);
  }

  private rebuildLinkIndex(): void {
    this.linkKeys = new Set(
      this.sim.links.map((l) => pairKey(l.source.id, l.target.id)),
    );
  }

  private recomputeDegrees(): void {
    for (const n of this.sim.nodes) n.degree = 0;
    for (const l of this.sim.links) {
      l.source.degree++;
      l.target.degree++;
    }
    for (const n of this.sim.nodes) n.r = nodeRadius(n.degree);
  }

  /** Center force targets the current centroid so old maps don't drift. */
  private recenter(): void {
    const nodes = this.sim.nodes;
    if (nodes.length === 0) return;
    let sx = 0, sy = 0;
    for (const n of nodes) {
      sx += n.x;
      sy += n.y;
    }
    this.sim.center = { x: sx / nodes.length, y: sy / nodes.length };
  }

  private resolveTheme(): Theme {
    const style = getComputedStyle(this.canvas);
    const v = (name: string, fallback: string) =>
      style.getPropertyValue(name).trim() || fallback;
    const accent = v("--accent", "#8b7cf8");
    return {
      bg: v("--bg-deep", "#0d0d12"),
      edge: "rgba(255, 255, 255, 0.12)",
      edgeActive: accent,
      label: v("--text-secondary", "#b6b6c2"),
      pin: "#ff9f43",
      select: accent,
      sections: {
        chapters: accent,
        research: v("--research-accent", "#9d7ed8"),
        characters: v("--character-accent", "#8eb4c8"),
      },
    };
  }

  // --- Camera ------------------------------------------------------------------

  private toWorld(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left - this.cam.x) / this.cam.z,
      y: (clientY - rect.top - this.cam.y) / this.cam.z,
    };
  }

  private zoomAt(sx: number, sy: number, factor: number): void {
    const z = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, this.cam.z * factor));
    if (z === this.cam.z) return;
    const wx = (sx - this.cam.x) / this.cam.z;
    const wy = (sy - this.cam.y) / this.cam.z;
    this.cam.x = sx - wx * z;
    this.cam.y = sy - wy * z;
    this.cam.z = z;
    this.cb.onViewChanged(z);
    this.dirty = true;
  }

  // --- Events --------------------------------------------------------------------

  private bindEvents(): void {
    const c = this.canvas;
    const on = <K extends keyof HTMLElementEventMap>(
      name: K,
      handler: (e: HTMLElementEventMap[K]) => void,
      options?: AddEventListenerOptions,
    ) => {
      c.addEventListener(name, handler as EventListener, options);
      this.disposers.push(() =>
        c.removeEventListener(name, handler as EventListener, options),
      );
    };
    on("pointerdown", (e) => this.onPointerDown(e));
    on("pointermove", (e) => this.onPointerMove(e));
    on("pointerup", (e) => this.onPointerUp(e));
    on("pointercancel", (e) => this.onPointerUp(e));
    on("wheel", (e) => this.onWheel(e), { passive: false });
    on("dblclick", (e) => this.onDblClick(e));
    on("contextmenu", (e) => this.onContextMenu(e));
  }

  private hitNode(wx: number, wy: number): GraphNode | null {
    // Topmost = last drawn; generous minimum hit radius at low zoom.
    const nodes = this.sim.nodes;
    const minR = 9 / this.cam.z;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      const r = Math.max(n.r + 3, minR);
      const dx = wx - n.x;
      const dy = wy - n.y;
      if (dx * dx + dy * dy <= r * r) return n;
    }
    return null;
  }

  private onPointerDown(e: PointerEvent): void {
    const world = this.toWorld(e.clientX, e.clientY);
    this.mouseWorld = world;

    if (e.button === 1) {
      e.preventDefault(); // no autoscroll
      this.canvas.setPointerCapture(e.pointerId);
      this.mode = {
        kind: "pan",
        startX: e.clientX,
        startY: e.clientY,
        camX: this.cam.x,
        camY: this.cam.y,
        moved: false,
      };
      this.canvas.style.cursor = "grabbing";
      return;
    }
    if (e.button !== 0) return;

    const node = this.hitNode(world.x, world.y);

    // Ctrl/Cmd-click: two-click link mode. Never starts a drag.
    if (e.ctrlKey || e.metaKey) {
      this.handleCtrlClick(node);
      return;
    }

    this.canvas.setPointerCapture(e.pointerId);
    if (node) {
      // Hold the node in place while pressed; released on pointerup.
      node.fx = node.x;
      node.fy = node.y;
      this.mode = {
        kind: "drag",
        node,
        dx: node.x - world.x,
        dy: node.y - world.y,
        moved: false,
      };
    } else if (e.shiftKey) {
      // Shift+drag on the background: rectangle multi-select.
      this.mode = {
        kind: "rect",
        x0: world.x,
        y0: world.y,
        x1: world.x,
        y1: world.y,
        moved: false,
        additive: true,
      };
    } else {
      // Plain drag on the background pans the viewport.
      this.mode = {
        kind: "pan",
        startX: e.clientX,
        startY: e.clientY,
        camX: this.cam.x,
        camY: this.cam.y,
        moved: false,
      };
      this.canvas.style.cursor = "grabbing";
    }
  }

  private handleCtrlClick(node: GraphNode | null): void {
    if (!node) {
      this.cancelLinkMode();
      return;
    }
    if (this.linkSourceId === null) {
      this.linkSourceId = node.id;
      this.cb.onLinkModeChanged(true);
    } else if (this.linkSourceId === node.id) {
      this.cancelLinkMode();
    } else {
      this.createLinkPair(this.linkSourceId, node.id);
      this.cancelLinkMode();
    }
    this.dirty = true;
  }

  private onPointerMove(e: PointerEvent): void {
    const world = this.toWorld(e.clientX, e.clientY);
    this.mouseWorld = world;
    if (this.linkSourceId) this.dirty = true; // live link line follows mouse

    const m = this.mode;
    if (!m) return;
    if (m.kind === "drag") {
      if (!m.moved) {
        const dx = e.movementX;
        // movementX can be 0 on some platforms; compare against grab point.
        const gx = (m.node.x - m.dx) * this.cam.z + this.cam.x;
        const gy = (m.node.y - m.dy) * this.cam.z + this.cam.y;
        const rect = this.canvas.getBoundingClientRect();
        const sdx = e.clientX - rect.left - gx;
        const sdy = e.clientY - rect.top - gy;
        if (dx !== 0 || Math.hypot(sdx, sdy) > CLICK_SLOP) m.moved = true;
      }
      if (m.moved) {
        m.node.fx = world.x + m.dx;
        m.node.fy = world.y + m.dy;
        this.sim.reheat(0.35);
        this.dirty = true;
      }
    } else if (m.kind === "rect") {
      m.x1 = world.x;
      m.y1 = world.y;
      if (
        Math.abs(m.x1 - m.x0) * this.cam.z > CLICK_SLOP ||
        Math.abs(m.y1 - m.y0) * this.cam.z > CLICK_SLOP
      ) {
        m.moved = true;
      }
      this.dirty = true;
    } else if (m.kind === "pan") {
      if (Math.hypot(e.clientX - m.startX, e.clientY - m.startY) > CLICK_SLOP) {
        m.moved = true;
      }
      this.cam.x = m.camX + (e.clientX - m.startX);
      this.cam.y = m.camY + (e.clientY - m.startY);
      this.dirty = true;
    }
  }

  private onPointerUp(e: PointerEvent): void {
    const m = this.mode;
    this.mode = null;
    this.canvas.style.cursor = "";
    if (this.canvas.hasPointerCapture(e.pointerId)) {
      this.canvas.releasePointerCapture(e.pointerId);
    }
    if (!m) return;

    if (m.kind === "drag") {
      const node = m.node;
      if (!m.moved) {
        // Plain click: select. Shift-click: toggle in/out of selection.
        if (e.shiftKey) this.toggleSelect(node.id);
        else this.selectOnly(node.id);
        if (!node.pinned) {
          node.fx = null;
          node.fy = null;
        }
      } else {
        if (node.pinned) {
          // Dragging a pinned node re-anchors it at the drop point.
          node.fx = node.x;
          node.fy = node.y;
        } else {
          node.fx = null;
          node.fy = null;
        }
        this.sim.reheat(0.5);
        this.cb.onGraphMutated();
      }
      this.dirty = true;
      return;
    }

    if (m.kind === "rect") {
      if (m.moved) {
        const minX = Math.min(m.x0, m.x1);
        const maxX = Math.max(m.x0, m.x1);
        const minY = Math.min(m.y0, m.y1);
        const maxY = Math.max(m.y0, m.y1);
        if (!m.additive) this.selected.clear();
        const now = performance.now();
        for (const n of this.sim.nodes) {
          if (n.x >= minX && n.x <= maxX && n.y >= minY && n.y <= maxY) {
            if (!this.selected.has(n.id)) {
              this.selected.add(n.id);
              n.pulseAt = now;
            }
          }
        }
        this.cb.onSelectionChanged(this.selected);
      }
      this.dirty = true;
      return;
    }

    if (m.kind === "pan" && !m.moved) {
      // Background click (no pan): clear selection, cancel a pending link source.
      if (this.selected.size > 0) {
        this.selected.clear();
        this.cb.onSelectionChanged(this.selected);
      }
      this.cancelLinkMode();
      this.dirty = true;
    }
  }

  private selectOnly(id: string): void {
    if (this.selected.size === 1 && this.selected.has(id)) return;
    this.selected.clear();
    this.selected.add(id);
    const node = this.byId.get(id);
    if (node) node.pulseAt = performance.now();
    this.cb.onSelectionChanged(this.selected);
    this.dirty = true;
  }

  private toggleSelect(id: string): void {
    if (this.selected.has(id)) {
      this.selected.delete(id);
    } else {
      this.selected.add(id);
      const node = this.byId.get(id);
      if (node) node.pulseAt = performance.now();
    }
    this.cb.onSelectionChanged(this.selected);
    this.dirty = true;
  }

  private onWheel(e: WheelEvent): void {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    this.zoomAt(
      e.clientX - rect.left,
      e.clientY - rect.top,
      e.deltaY > 0 ? 0.9 : 1.1,
    );
  }

  private onDblClick(e: MouseEvent): void {
    const world = this.toWorld(e.clientX, e.clientY);
    const node = this.hitNode(world.x, world.y);
    if (node) this.cb.onOpenNode(node);
  }

  private onContextMenu(e: MouseEvent): void {
    e.preventDefault();
    const world = this.toWorld(e.clientX, e.clientY);
    const node = this.hitNode(world.x, world.y);
    if (node && !this.selected.has(node.id)) this.selectOnly(node.id);
    this.cb.onContextMenu({
      clientX: e.clientX,
      clientY: e.clientY,
      nodeId: node?.id ?? null,
      worldX: world.x,
      worldY: world.y,
      selectedIds: [...this.selected],
    });
  }

  // --- Render loop ------------------------------------------------------------

  private startLoop(): void {
    const frame = () => {
      this.raf = requestAnimationFrame(frame);
      if (this.mode?.kind === "drag" && this.mode.moved) this.sim.reheat(0.35);
      const ticked = this.sim.tick();
      // Fire a persist when the simulation settles.
      if (this.wasActive && !this.sim.active) this.cb.onGraphMutated();
      this.wasActive = this.sim.active;
      if (ticked || this.dirty || this.hasTransientAnimation()) {
        this.dirty = false;
        this.draw();
      }
    };
    this.raf = requestAnimationFrame(frame);
  }

  private hasTransientAnimation(): boolean {
    const now = performance.now();
    for (const l of this.sim.links) {
      if (l.bornAt && now - l.bornAt < LINK_GROW_MS + 40) return true;
    }
    for (const n of this.sim.nodes) {
      if (n.pulseAt && now - n.pulseAt < PULSE_MS + 40) return true;
      if (n.popAt && now - n.popAt < POP_MS + 40) return true;
    }
    return false;
  }

  private resizeIfNeeded(): void {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(this.canvas.clientWidth * dpr);
    const h = Math.round(this.canvas.clientHeight * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  private draw(): void {
    this.resizeIfNeeded();
    const ctx = this.ctx;
    const dpr = window.devicePixelRatio || 1;
    const now = performance.now();
    const t = this.theme;
    const z = this.cam.z;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = t.bg;
    ctx.fillRect(0, 0, this.canvas.clientWidth, this.canvas.clientHeight);
    ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * this.cam.x, dpr * this.cam.y);

    // Edges: batch settled edges into one path; animated/active drawn solo.
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = t.edge;
    ctx.beginPath();
    const solo: GraphLink[] = [];
    for (const l of this.sim.links) {
      const growing = l.bornAt && now - l.bornAt < LINK_GROW_MS;
      const active =
        this.selected.has(l.source.id) || this.selected.has(l.target.id);
      if (growing || active) {
        solo.push(l);
        continue;
      }
      ctx.moveTo(l.source.x, l.source.y);
      ctx.lineTo(l.target.x, l.target.y);
    }
    ctx.stroke();

    for (const l of solo) {
      const growing = l.bornAt && now - l.bornAt < LINK_GROW_MS;
      let tx = l.target.x;
      let ty = l.target.y;
      if (growing) {
        // easeOutQuad grow from source to target (world space).
        const p = (now - l.bornAt) / LINK_GROW_MS;
        const ease = 1 - (1 - p) * (1 - p);
        tx = l.source.x + (l.target.x - l.source.x) * ease;
        ty = l.source.y + (l.target.y - l.source.y) * ease;
      }
      const active =
        this.selected.has(l.source.id) || this.selected.has(l.target.id);
      ctx.beginPath();
      ctx.strokeStyle = active || growing ? t.edgeActive : t.edge;
      ctx.lineWidth = active || growing ? 1.8 : 1.2;
      ctx.moveTo(l.source.x, l.source.y);
      ctx.lineTo(tx, ty);
      ctx.stroke();
    }

    // Link-mode preview line from source node to the mouse.
    if (this.linkSourceId) {
      const src = this.byId.get(this.linkSourceId);
      if (src) {
        ctx.beginPath();
        ctx.setLineDash([6 / z, 5 / z]);
        ctx.strokeStyle = t.edgeActive;
        ctx.lineWidth = 1.6;
        ctx.moveTo(src.x, src.y);
        ctx.lineTo(this.mouseWorld.x, this.mouseWorld.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Nodes.
    for (const n of this.sim.nodes) {
      let r = n.r;
      if (n.pulseAt) {
        const p = (now - n.pulseAt) / PULSE_MS;
        if (p < 1) r *= 1 + 0.08 * Math.sin(Math.PI * p);
        else n.pulseAt = 0;
      }
      if (n.popAt) {
        const p = (now - n.popAt) / POP_MS;
        if (p < 1) r *= 1 + 0.12 * Math.sin(Math.PI * p);
        else n.popAt = 0;
      }
      const isSelected = this.selected.has(n.id);
      const isLinkSource = this.linkSourceId === n.id;

      if (isSelected || isLinkSource) {
        // Glow ring.
        ctx.beginPath();
        ctx.arc(n.x, n.y, r + 4, 0, Math.PI * 2);
        ctx.strokeStyle = t.select;
        ctx.globalAlpha = isLinkSource ? 0.9 : 0.35;
        ctx.lineWidth = isLinkSource ? 2.5 : 4;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fillStyle = t.sections[n.section] ?? t.select;
      ctx.fill();
      if (isSelected) {
        ctx.strokeStyle = t.select;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      if (n.pinned) {
        // Distinct border + small filled dot = pinned anchor.
        ctx.beginPath();
        ctx.arc(n.x, n.y, r + 1.5, 0, Math.PI * 2);
        ctx.strokeStyle = t.pin;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(n.x, n.y, Math.max(1.6, r * 0.3), 0, Math.PI * 2);
        ctx.fillStyle = t.pin;
        ctx.fill();
      }
    }

    // Labels: fade out when zoomed away; skip ones that would collide.
    const labelAlpha = this.sim.params.showLabels
      ? Math.max(0, Math.min(1, (z - 0.45) / 0.3))
      : 0;
    if (labelAlpha > 0.02) {
      ctx.font = "11px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillStyle = t.label;
      ctx.globalAlpha = labelAlpha;
      const placed: Array<{ x: number; y: number; w: number }> = [];
      for (const n of this.sim.nodes) {
        const label =
          n.label.length > 28 ? `${n.label.slice(0, 27)}…` : n.label;
        const w = ctx.measureText(label).width;
        const y = n.y + n.r + 4;
        let collides = false;
        for (const p of placed) {
          if (Math.abs(p.y - y) < 13 && Math.abs(p.x - n.x) < (p.w + w) / 2 + 6) {
            collides = true;
            break;
          }
        }
        if (collides) continue;
        placed.push({ x: n.x, y, w });
        ctx.fillText(label, n.x, y);
      }
      ctx.globalAlpha = 1;
    }

    // Selection rectangle.
    if (this.mode?.kind === "rect" && this.mode.moved) {
      const m = this.mode;
      ctx.fillStyle = t.select;
      ctx.globalAlpha = 0.08;
      ctx.fillRect(
        Math.min(m.x0, m.x1),
        Math.min(m.y0, m.y1),
        Math.abs(m.x1 - m.x0),
        Math.abs(m.y1 - m.y0),
      );
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 1 / z;
      ctx.strokeStyle = t.select;
      ctx.strokeRect(
        Math.min(m.x0, m.x1),
        Math.min(m.y0, m.y1),
        Math.abs(m.x1 - m.x0),
        Math.abs(m.y1 - m.y0),
      );
      ctx.globalAlpha = 1;
    }
  }
}

export { ALPHA_MIN };
