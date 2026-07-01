<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { app } from "$lib/stores/app.svelte";
  import { libraryStore } from "$lib/stores/library.svelte";
  import { GraphView, type GraphContextMenuInfo } from "$lib/graph/GraphView";
  import {
    clampParam,
    DEFAULT_PARAMS,
    PARAM_RANGES,
    seedPosition,
    type GraphNodeInput,
    type GraphParams,
    type GraphSection,
    type NumericParam,
  } from "$lib/graph/types";
  import { loadMindMapData, MINDMAP_VERSION, persistMindMapData } from "$lib/mindmap/persist";
  import { mindmapLibraryFingerprint, nodeKey, parseNodeKey } from "$lib/utils/mindmapUtils";
  import type { MindMapData } from "$lib/types";

  const PARAMS_KEY = "darktext-graph-params";

  let canvasEl = $state<HTMLCanvasElement | null>(null);
  let view = $state<GraphView | null>(null);

  let params = $state<GraphParams>(loadParams());
  let showForces = $state(false);
  let zoom = $state(1);
  let selectionCount = $state(0);
  let linkMode = $state(false);
  let counts = $state({ chapters: 0, research: 0, characters: 0, links: 0 });
  let ctxMenu = $state<GraphContextMenuInfo | null>(null);

  let loadedData: MindMapData | null = null;
  let loadFailed = false;
  let ready = $state(false);
  let seedIndex = 0;
  let seedOrigin = { x: 0, y: 0 };
  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  function loadParams(): GraphParams {
    try {
      const raw = localStorage.getItem(PARAMS_KEY);
      if (!raw) return { ...DEFAULT_PARAMS };
      const saved = JSON.parse(raw) as Partial<GraphParams>;
      const out = { ...DEFAULT_PARAMS };
      for (const key of Object.keys(PARAM_RANGES) as NumericParam[]) {
        out[key] = clampParam(key, saved[key] ?? DEFAULT_PARAMS[key]);
      }
      out.showLabels = saved.showLabels ?? true;
      return out;
    } catch {
      return { ...DEFAULT_PARAMS };
    }
  }

  function setParam(key: NumericParam, value: number) {
    params = { ...params, [key]: clampParam(key, value) };
    applyParams();
  }

  function toggleLabels() {
    params = { ...params, showLabels: !params.showLabels };
    applyParams();
  }

  function applyParams() {
    view?.setParams({ ...params });
    try {
      localStorage.setItem(PARAMS_KEY, JSON.stringify(params));
    } catch {
      /* storage unavailable */
    }
  }

  // --- Library data → graph nodes -------------------------------------------

  const fingerprint = $derived(
    app.library
      ? mindmapLibraryFingerprint(
          app.library.chapters,
          app.researchChapters,
          app.characterChapters,
        )
      : "",
  );

  $effect(() => {
    void fingerprint;
    if (ready) rebuild();
  });

  function buildNodeInputs(): GraphNodeInput[] {
    const lib = app.library;
    if (!lib) return [];
    const groups: Array<[GraphSection, { id: string; title: string }[]]> = [
      ["chapters", lib.chapters],
      ["research", app.researchChapters],
      ["characters", app.characterChapters],
    ];
    const saved = loadedData?.nodes ?? {};
    const out: GraphNodeInput[] = [];
    for (const [section, chapters] of groups) {
      for (const ch of chapters) {
        const id = nodeKey(section, ch.id);
        const s = saved[id];
        const pos = s ?? seedPosition(seedIndex++, seedOrigin.x, seedOrigin.y);
        out.push({
          id,
          label: ch.title,
          section,
          x: pos.x,
          y: pos.y,
          pinned: s?.pinned ?? false,
        });
      }
    }
    return out;
  }

  function rebuild() {
    view?.setNodes(buildNodeInputs());
    refreshCounts();
  }

  function refreshCounts() {
    if (!view) return;
    const c = view.counts();
    counts = {
      chapters: c.bySection.chapters ?? 0,
      research: c.bySection.research ?? 0,
      characters: c.bySection.characters ?? 0,
      links: c.links,
    };
  }

  // --- Persistence ------------------------------------------------------------

  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      void saveNow();
    }, 600);
  }

  async function saveNow() {
    if (!view || loadFailed) return;
    const path = libraryStore.library?.path;
    if (!path) return;
    const g = view.getGraph();
    const nodes: MindMapData["nodes"] = {};
    for (const n of g.nodes) nodes[n.id] = { x: n.x, y: n.y, pinned: n.pinned };
    const links: MindMapData["links"] = [];
    for (const l of g.links) {
      const from = parseNodeKey(l.sourceId);
      const to = parseNodeKey(l.targetId);
      if (!from || !to) continue;
      links.push({ id: l.id, from, to });
    }
    const data: MindMapData = {
      version: MINDMAP_VERSION,
      globalPinned: loadedData?.globalPinned ?? false,
      nodes,
      links,
      view: loadedData?.view ?? { panX: 0, panY: 0, zoom: 1 },
    };
    try {
      await persistMindMapData(path, data);
    } catch (e) {
      app.showToast(String(e));
    }
  }

  // --- Actions -----------------------------------------------------------------

  function openNode(id: string, section: GraphSection) {
    const parsed = parseNodeKey(id);
    if (!parsed) return;
    void app.openChapter(parsed.id, section);
    app.showMindMap = false;
  }

  async function createAt(section: GraphSection, wx: number, wy: number) {
    ctxMenu = null;
    const content = await libraryStore.newChapter(undefined, section);
    if (!content) return;
    rebuild();
    view?.placeNode(nodeKey(section, content.meta.id), wx, wy);
    scheduleSave();
  }

  function linkClique() {
    view?.linkSelectedClique();
    ctxMenu = null;
  }

  function linkStarTo(nodeId: string) {
    view?.linkSelectedTo(nodeId);
    ctxMenu = null;
  }

  function togglePinFromMenu() {
    if (!view || !ctxMenu?.nodeId) return;
    const ids = ctxMenu.selectedIds.length > 1 ? ctxMenu.selectedIds : [ctxMenu.nodeId];
    view.togglePin(ids);
    ctxMenu = null;
  }

  function onKeydownCapture(e: KeyboardEvent) {
    if (e.key === "Escape") {
      // Consume Escape for graph-local dismissals; otherwise let AppShell
      // close the whole overlay.
      if (view?.linkModeActive) view.cancelLinkMode();
      else if (ctxMenu) ctxMenu = null;
      else if (showForces) showForces = false;
      else return;
      e.preventDefault();
      e.stopPropagation();
    } else if (e.key === "p" || e.key === "P") {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      view?.togglePinSelected();
    }
  }

  onMount(() => {
    if (!canvasEl) return;
    view = new GraphView(canvasEl, { ...params }, {
      onOpenNode: (node) => openNode(node.id, node.section),
      onContextMenu: (info) => (ctxMenu = info),
      onGraphMutated: () => {
        refreshCounts();
        scheduleSave();
      },
      onViewChanged: (z) => (zoom = z),
      onSelectionChanged: (ids) => (selectionCount = ids.size),
      onLinkModeChanged: (active) => (linkMode = active),
    });
    window.addEventListener("keydown", onKeydownCapture, true);

    void (async () => {
      const path = libraryStore.library?.path;
      if (path) {
        try {
          loadedData = await loadMindMapData(path);
        } catch (e) {
          // Never save over a file we couldn't read.
          loadFailed = true;
          app.showToast(String(e));
        }
      }
      // Seed unplaced nodes around the centroid of the saved layout.
      const saved = Object.values(loadedData?.nodes ?? {});
      if (saved.length > 0) {
        seedOrigin = {
          x: saved.reduce((s, p) => s + p.x, 0) / saved.length,
          y: saved.reduce((s, p) => s + p.y, 0) / saved.length,
        };
      }
      rebuild();
      if (loadedData) {
        view?.setLinks(
          loadedData.links.map((l) => ({
            id: l.id,
            sourceId: nodeKey(l.from.section, l.from.id),
            targetId: nodeKey(l.to.section, l.to.id),
          })),
        );
      }
      refreshCounts();
      view?.fitView();
      ready = true;
    })();
  });

  onDestroy(() => {
    window.removeEventListener("keydown", onKeydownCapture, true);
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
      void saveNow();
    }
    view?.destroy();
    view = null;
  });
</script>

<svelte:window onclick={() => (ctxMenu = null)} />

<div class="graph-overlay" role="presentation">
  <div class="graph-panel">
    <header class="graph-header">
      <div class="header-left">
        <h2>Graph</h2>
        <p class="hint">
          Drag nodes · drag canvas to pan · Ctrl-click two nodes to link ·
          Shift-click / Shift-drag to multi-select · P pins
        </p>
      </div>
      <div class="header-tools">
        <button
          class="tool-btn"
          class:active={showForces}
          title="Tune simulation forces"
          onclick={(e) => {
            e.stopPropagation();
            showForces = !showForces;
          }}
        >
          Forces
        </button>
        <button class="tool-btn" title="Zoom out" onclick={() => view?.zoomBy(0.85)}>−</button>
        <span class="zoom-label">{Math.round(zoom * 100)}%</span>
        <button class="tool-btn" title="Zoom in" onclick={() => view?.zoomBy(1.15)}>+</button>
        <button class="tool-btn" title="Fit graph in view" onclick={() => view?.fitView()}>Fit</button>
        <button class="close-btn" title="Close (Esc)" onclick={() => (app.showMindMap = false)}>×</button>
      </div>
    </header>

    {#if showForces}
      <div
        class="forces-pop"
        role="group"
        aria-label="Simulation settings"
        onpointerdown={(e) => e.stopPropagation()}
      >
        <label>
          <span>Repel <em>{Math.round(params.repel)}</em></span>
          <input
            type="range"
            min={PARAM_RANGES.repel.min}
            max={PARAM_RANGES.repel.max}
            step={PARAM_RANGES.repel.step}
            value={params.repel}
            oninput={(e) => setParam("repel", +e.currentTarget.value)}
          />
        </label>
        <label>
          <span>Link distance <em>{Math.round(params.linkDistance)}</em></span>
          <input
            type="range"
            min={PARAM_RANGES.linkDistance.min}
            max={PARAM_RANGES.linkDistance.max}
            step={PARAM_RANGES.linkDistance.step}
            value={params.linkDistance}
            oninput={(e) => setParam("linkDistance", +e.currentTarget.value)}
          />
        </label>
        <label>
          <span>Link strength <em>{params.linkStrength.toFixed(2)}</em></span>
          <input
            type="range"
            min={PARAM_RANGES.linkStrength.min}
            max={PARAM_RANGES.linkStrength.max}
            step={PARAM_RANGES.linkStrength.step}
            value={params.linkStrength}
            oninput={(e) => setParam("linkStrength", +e.currentTarget.value)}
          />
        </label>
        <label>
          <span>Damping <em>{params.damping.toFixed(2)}</em></span>
          <input
            type="range"
            min={PARAM_RANGES.damping.min}
            max={PARAM_RANGES.damping.max}
            step={PARAM_RANGES.damping.step}
            value={params.damping}
            oninput={(e) => setParam("damping", +e.currentTarget.value)}
          />
        </label>
        <label>
          <span>Center gravity <em>{params.center.toFixed(3)}</em></span>
          <input
            type="range"
            min={PARAM_RANGES.center.min}
            max={PARAM_RANGES.center.max}
            step={PARAM_RANGES.center.step}
            value={params.center}
            oninput={(e) => setParam("center", +e.currentTarget.value)}
          />
        </label>
        <label>
          <span>Speed <em>{params.speed.toFixed(1)}×</em></span>
          <input
            type="range"
            min={PARAM_RANGES.speed.min}
            max={PARAM_RANGES.speed.max}
            step={PARAM_RANGES.speed.step}
            value={params.speed}
            oninput={(e) => setParam("speed", +e.currentTarget.value)}
          />
        </label>
        <label class="check">
          <input type="checkbox" checked={params.showLabels} onchange={toggleLabels} />
          <span class="check-text">Show labels</span>
        </label>
      </div>
    {/if}

    <div class="graph-viewport">
      <canvas bind:this={canvasEl} class="graph-canvas"></canvas>
      {#if counts.chapters + counts.research + counts.characters === 0}
        <p class="empty">No items yet — right-click the canvas to create a chapter</p>
      {/if}
      {#if linkMode}
        <div class="link-banner">Linking: Ctrl-click a target node · Esc cancels</div>
      {/if}
    </div>

    <footer class="graph-footer">
      <span>{counts.chapters} chapters</span>
      <span class="sep">·</span>
      <span>{counts.research} research</span>
      <span class="sep">·</span>
      <span>{counts.characters} characters</span>
      <span class="sep">·</span>
      <span>{counts.links} links</span>
      {#if selectionCount > 0}
        <span class="sep">·</span>
        <span class="sel">{selectionCount} selected</span>
      {/if}
    </footer>
  </div>
</div>

{#if ctxMenu}
  <div
    class="ctx-menu"
    style="left: {ctxMenu.clientX}px; top: {ctxMenu.clientY}px"
    role="menu"
    tabindex="-1"
    onmousedown={(e) => e.stopPropagation()}
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => {
      if (e.key === "Escape") ctxMenu = null;
    }}
  >
    {#if ctxMenu.nodeId}
      {@const nodeId = ctxMenu.nodeId}
      <button type="button" role="menuitem" onclick={() => {
        const parsed = parseNodeKey(nodeId);
        if (parsed) openNode(nodeId, parsed.section);
        ctxMenu = null;
      }}>Open</button>
      <button type="button" role="menuitem" onclick={togglePinFromMenu}>
        {#if ctxMenu.selectedIds.length > 1}
          Pin / unpin {ctxMenu.selectedIds.length} selected
        {:else}
          {view?.isPinned(nodeId) ? "Unpin" : "Pin in place"}
        {/if}
      </button>
      {#if ctxMenu.selectedIds.length >= 2}
        <div class="ctx-sep" role="separator"></div>
        <button type="button" role="menuitem" onclick={linkClique}>
          Link all selected nodes together
        </button>
        <button type="button" role="menuitem" onclick={() => linkStarTo(nodeId)}>
          Link all selected to this node
        </button>
      {/if}
    {:else}
      {@const wx = ctxMenu.worldX}
      {@const wy = ctxMenu.worldY}
      <button type="button" role="menuitem" onclick={() => void createAt("chapters", wx, wy)}>New Chapter here</button>
      <button type="button" role="menuitem" onclick={() => void createAt("research", wx, wy)}>New Research here</button>
      <button type="button" role="menuitem" onclick={() => void createAt("characters", wx, wy)}>New Character here</button>
      {#if ctxMenu.selectedIds.length >= 2}
        <div class="ctx-sep" role="separator"></div>
        <button type="button" role="menuitem" onclick={linkClique}>
          Link all selected nodes together
        </button>
      {/if}
    {/if}
  </div>
{/if}

<style>
  .graph-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.92);
    z-index: 180;
    display: flex;
  }

  .graph-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: var(--bg-deep);
    overflow: hidden;
    position: relative;
  }

  .graph-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-subtle);
    background: var(--bg-chrome);
    flex-shrink: 0;
  }

  .header-left h2 {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
    margin-bottom: 2px;
  }

  .hint {
    font-size: 11px;
    color: var(--text-faint);
  }

  .header-tools {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .tool-btn {
    padding: 4px 10px;
    font-size: 11px;
    color: var(--text-muted);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    background: var(--bg-surface);
  }

  .tool-btn:hover {
    color: var(--text-secondary);
    border-color: var(--border);
    background: var(--bg-hover);
  }

  .tool-btn.active {
    color: var(--accent-hover);
    border-color: var(--accent-dim);
    background: var(--accent-subtle);
  }

  .zoom-label {
    font-size: 10px;
    color: var(--text-faint);
    min-width: 36px;
    text-align: center;
  }

  .close-btn {
    width: 28px;
    height: 28px;
    font-size: 18px;
    color: var(--text-muted);
    border-radius: var(--radius-sm);
    margin-left: 4px;
  }

  .close-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .forces-pop {
    position: absolute;
    top: 56px;
    right: 16px;
    z-index: 60;
    width: 212px;
    padding: 12px 14px;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: var(--shadow-md);
  }

  .forces-pop label {
    display: block;
    margin-bottom: 12px;
  }

  .forces-pop label:last-child {
    margin-bottom: 0;
  }

  .forces-pop span {
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    margin-bottom: 5px;
  }

  .forces-pop em {
    font-style: normal;
    color: var(--accent-hover);
  }

  .forces-pop input[type="range"] {
    width: 100%;
    accent-color: var(--accent);
  }

  .forces-pop .check {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .forces-pop .check-text {
    margin-bottom: 0;
    display: inline;
  }

  .graph-viewport {
    flex: 1;
    position: relative;
    overflow: hidden;
    background: var(--bg-deep);
  }

  .graph-canvas {
    width: 100%;
    height: 100%;
    display: block;
    touch-action: none;
    cursor: grab;
  }

  .empty {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: var(--text-muted);
    font-size: 13px;
    pointer-events: none;
  }

  .link-banner {
    position: absolute;
    bottom: 14px;
    left: 50%;
    transform: translateX(-50%);
    padding: 5px 14px;
    font-size: 11px;
    color: var(--accent-hover);
    background: var(--bg-elevated);
    border: 1px solid var(--accent-dim);
    border-radius: 999px;
    pointer-events: none;
  }

  .graph-footer {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    font-size: 10px;
    color: var(--text-faint);
    border-top: 1px solid var(--border-subtle);
    background: var(--bg-chrome);
    flex-shrink: 0;
  }

  .sep {
    opacity: 0.5;
  }

  .sel {
    color: var(--accent-hover);
  }

  .ctx-menu {
    position: fixed;
    z-index: 300;
    min-width: 188px;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    box-shadow: var(--shadow-md);
    padding: 4px;
  }

  .ctx-menu button {
    display: block;
    width: 100%;
    text-align: left;
    padding: 7px 12px;
    font-size: 12px;
    color: var(--text-secondary);
    border-radius: 4px;
  }

  .ctx-menu button:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .ctx-sep {
    height: 1px;
    background: var(--border-subtle);
    margin: 4px 0;
  }
</style>
