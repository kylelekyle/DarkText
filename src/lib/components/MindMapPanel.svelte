<script lang="ts">
  import { app } from "$lib/stores/app.svelte";
  import { mindmapStore, WORLD_H, WORLD_W } from "$lib/stores/mindmap.svelte";
  import {
    linkPath,
    mindmapLibraryFingerprint,
    NODE_W,
    nodeCenter,
    nodeKey,
  } from "$lib/utils/mindmapUtils";

  let viewportEl = $state<HTMLDivElement | null>(null);
  let worldEl = $state<HTMLDivElement | null>(null);

  mindmapStore.bindViewport(() => viewportEl);
  $effect(() => {
    mindmapStore.bindWorld(worldEl);
  });

  $effect(() => {
    mindmapStore.onShowChanged(app.showMindMap, app.library?.path ?? null);
  });

  const libraryFingerprint = $derived(
    app.showMindMap && app.library
      ? mindmapLibraryFingerprint(
          app.library.chapters,
          app.researchChapters,
          app.characterChapters,
        )
      : "",
  );

  $effect(() => {
    if (libraryFingerprint) {
      mindmapStore.onLibraryDataChanged(libraryFingerprint);
    }
  });

  const edges = $derived.by(() => {
    const pos = mindmapStore.nodePositionByKey;
    const out: {
      id: string;
      d: string;
      active: boolean;
      research: boolean;
    }[] = [];
    for (const link of mindmapStore.mindmap.links) {
      const fromKey = nodeKey(link.from.section, link.from.id);
      const toKey = nodeKey(link.to.section, link.to.id);
      const fromPos = pos.get(fromKey);
      const toPos = pos.get(toKey);
      if (!fromPos || !toPos) continue;
      const c1 = nodeCenter(fromPos.x, fromPos.y);
      const c2 = nodeCenter(toPos.x, toPos.y);
      out.push({
        id: link.id,
        d: linkPath(c1.cx, c1.cy, c2.cx, c2.cy),
        active: mindmapStore.edgeActive(link),
        research:
          link.from.section === "research" || link.to.section === "research",
      });
    }
    return out;
  });

  const footer = $derived(mindmapStore.footerCounts);

  const screenPositions = $derived.by(() => {
    const live = mindmapStore.dragLive;
    const out = new Map<string, { x: number; y: number }>();
    for (const n of mindmapStore.nodes) {
      if (live && live.key === n.key) out.set(n.key, live);
      else out.set(n.key, { x: n.x, y: n.y });
    }
    return out;
  });
</script>

<svelte:window
  onclick={() => mindmapStore.closeContextMenu()}
  onpointermove={(e) => mindmapStore.onPointerMove(e)}
  onpointerup={(e) => mindmapStore.onPointerUp(e)}
  onpointercancel={(e) => mindmapStore.onPointerUp(e)}
  onkeydown={(e) => {
    if (e.key === "Escape") {
      if (mindmapStore.contextMenu) mindmapStore.closeContextMenu();
      else app.showMindMap = false;
    }
  }}
/>

<div class="mindmap-overlay" role="presentation">
  <div class="mindmap-panel">
    <header class="mindmap-header">
      <div class="header-left">
        <h2>Mind-map</h2>
        <p class="hint">
          Drag nodes · scroll to zoom · Ctrl+click multi-select · right-click for actions
        </p>
      </div>
      <div class="header-tools">
        <button
          class="tool-btn"
          class:active={mindmapStore.globalPinned}
          title="Pin all nodes"
          onclick={() => mindmapStore.toggleGlobalPin()}
        >
          {mindmapStore.globalPinned ? "Pinned" : "Free float"}
        </button>
        <button class="tool-btn" title="Zoom out" onclick={() => mindmapStore.zoomBy(0.85)}>−</button>
        <span class="zoom-label">{Math.round(mindmapStore.zoom * 100)}%</span>
        <button class="tool-btn" title="Zoom in" onclick={() => mindmapStore.zoomBy(1.15)}>+</button>
        <button class="tool-btn" title="Reset view" onclick={() => mindmapStore.resetView()}>Reset</button>
        <button class="close-btn" title="Close (Esc)" onclick={() => (app.showMindMap = false)}>×</button>
      </div>
    </header>

    <div
      class="mindmap-viewport"
      class:interacting={mindmapStore.interacting}
      bind:this={viewportEl}
      role="application"
      aria-label="Mind-map canvas"
      onwheel={(e) => mindmapStore.onWheel(e)}
    >
      <div
        class="mindmap-world"
        bind:this={worldEl}
        role="group"
        aria-label="Mind-map nodes"
        style="width: {WORLD_W}px; height: {WORLD_H}px;"
        onpointerdown={(e) => mindmapStore.onWorldPointerDown(e)}
        oncontextmenu={(e) => mindmapStore.onCanvasContextMenu(e)}
      >
        <div class="canvas-grid" aria-hidden="true"></div>

        <svg class="connections" width={WORLD_W} height={WORLD_H} aria-hidden="true">
          {#each edges as edge (edge.id)}
            <path
              d={edge.d}
              class="edge"
              class:active={edge.active}
              class:research={edge.research}
            />
          {/each}
        </svg>

        {#if mindmapStore.nodes.length === 0}
          <p class="empty">No items yet — right-click the canvas to create a chapter</p>
        {:else}
          {#each mindmapStore.nodes as node (node.key)}
            <div
              class="node-wrap"
              class:selected={mindmapStore.selected.has(node.key)}
              class:dragging={mindmapStore.dragNodeKey === node.key}
              class:pinned={node.pinned || mindmapStore.globalPinned}
              class:research={node.section === "research"}
              class:character={node.section === "characters"}
              style="transform: translate({screenPositions.get(node.key)?.x ?? node.x}px, {screenPositions.get(node.key)?.y ?? node.y}px); width: {NODE_W}px;"
              onpointerdown={(e) => mindmapStore.onNodePointerDown(e, node)}
              onclick={(e) => mindmapStore.onNodeClick(e, node)}
              onkeydown={(e) => mindmapStore.onNodeKeydown(e, node)}
              ondblclick={() => mindmapStore.onNodeDblClick(node)}
              oncontextmenu={(e) => mindmapStore.onNodeContextMenu(e, node)}
              role="button"
              tabindex="0"
              aria-label="{node.title} ({node.section})"
            >
              <div class="node">
                {#if node.pinned}
                  <span class="pin-badge" title="Pinned"></span>
                {/if}
                <span
                  class="node-kind"
                  class:research={node.section === "research"}
                  class:character={node.section === "characters"}
                >
                  {node.section === "research" ? "◆" : node.section === "characters" ? "◎" : "○"}
                </span>
                <span class="node-title">{node.title}</span>
                <span class="node-status">{mindmapStore.statusLabel(node.status)}</span>
              </div>
            </div>
          {/each}
        {/if}
      </div>
    </div>

    <footer class="mindmap-footer">
      <span>{footer.chapters} chapters</span>
      <span class="sep">·</span>
      <span>{footer.research} research</span>
      <span class="sep">·</span>
      <span>{footer.characters} characters</span>
      <span class="sep">·</span>
      <span>{footer.links} links</span>
      {#if mindmapStore.selected.size > 0}
        <span class="sep">·</span>
        <span class="sel">{mindmapStore.selected.size} selected</span>
      {/if}
    </footer>
  </div>
</div>

{#if mindmapStore.contextMenu}
  <div
    class="ctx-menu"
    style="left: {mindmapStore.contextMenu.x}px; top: {mindmapStore.contextMenu.y}px"
    role="menu"
    tabindex="-1"
    onmousedown={(e) => e.stopPropagation()}
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => mindmapStore.onCtxMenuKeydown(e)}
  >
    {#if mindmapStore.contextMenu.kind === "canvas"}
      <button type="button" role="menuitem" onclick={() => void mindmapStore.createOnCanvas("chapters")}>New Chapter</button>
      <button type="button" role="menuitem" onclick={() => void mindmapStore.createOnCanvas("research")}>New Research</button>
      <button type="button" role="menuitem" onclick={() => void mindmapStore.createOnCanvas("characters")}>New Character</button>
      {#if mindmapStore.selected.size >= 2}
        <div class="ctx-sep" role="separator"></div>
        <button type="button" role="menuitem" onclick={() => mindmapStore.linkSelected()}>Link selected items</button>
      {/if}
    {:else}
      {@const ctxKey = mindmapStore.contextMenu.nodeKey}
      <button type="button" role="menuitem" onclick={() => mindmapStore.openSelected(ctxKey)}>Open</button>
      {#if ctxKey}
        <button type="button" role="menuitem" onclick={() => mindmapStore.toggleNodePin(ctxKey)}>
          {mindmapStore.nodes.find((n) => n.key === ctxKey)?.pinned ? "Unpin position" : "Pin position"}
        </button>
      {/if}
      {#if mindmapStore.selected.size >= 2}
        <div class="ctx-sep" role="separator"></div>
        <button type="button" role="menuitem" onclick={() => mindmapStore.linkSelected()}>Link selected items</button>
      {/if}
    {/if}
  </div>
{/if}

<style>
  .mindmap-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.92);
    z-index: 180;
    display: flex;
  }

  .mindmap-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: var(--bg-deep);
    overflow: hidden;
  }

  .mindmap-header {
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

  .mindmap-viewport {
    flex: 1;
    overflow: hidden;
    cursor: grab;
    position: relative;
    background: var(--bg-deep);
    touch-action: none;
  }

  .mindmap-viewport:active {
    cursor: grabbing;
  }

  .mindmap-world {
    position: absolute;
    top: 0;
    left: 0;
    transform-origin: 0 0;
    will-change: transform;
    contain: layout style;
  }

  .mindmap-viewport.interacting .edge,
  .mindmap-viewport.interacting .node {
    transition: none !important;
  }

  .canvas-grid {
    position: absolute;
    inset: 0;
    background-image: radial-gradient(circle, rgba(139, 124, 248, 0.07) 1px, transparent 1px);
    background-size: 24px 24px;
    pointer-events: none;
  }

  .connections {
    position: absolute;
    top: 0;
    left: 0;
    pointer-events: none;
    overflow: visible;
  }

  .edge {
    fill: none;
    stroke: rgba(255, 255, 255, 0.08);
    stroke-width: 1.5;
  }

  .edge.research {
    stroke: rgba(157, 126, 216, 0.2);
  }

  .edge.active {
    stroke: var(--accent-dim);
    stroke-width: 2;
    opacity: 1;
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

  .node-wrap {
    position: absolute;
    top: 0;
    left: 0;
    z-index: 2;
    cursor: grab;
    user-select: none;
    will-change: transform;
  }

  .node-wrap.pinned {
    cursor: default;
  }

  .node-wrap.dragging {
    z-index: 10;
  }

  .node {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 3px;
    min-height: 72px;
    padding: 10px 12px;
    background: rgba(15, 15, 15, 0.92);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.45);
    transition: border-color 0.12s, box-shadow 0.12s;
  }

  .node-wrap:hover .node {
    border-color: rgba(139, 124, 248, 0.35);
  }

  .node-wrap.selected .node {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px rgba(139, 124, 248, 0.25), 0 4px 20px rgba(127, 109, 242, 0.2);
  }

  .node-wrap.research .node {
    border-color: rgba(157, 126, 216, 0.3);
    background: rgba(20, 16, 28, 0.92);
  }

  .node-wrap.research.selected .node {
    border-color: var(--research-accent);
    box-shadow: 0 0 0 1px rgba(157, 126, 216, 0.3), 0 4px 20px rgba(157, 126, 216, 0.15);
  }

  .node-wrap.character .node {
    border-color: rgba(142, 180, 200, 0.3);
    background: rgba(14, 18, 22, 0.92);
  }

  .node-wrap.character.selected .node {
    border-color: var(--character-accent);
    box-shadow: 0 0 0 1px rgba(142, 180, 200, 0.3), 0 4px 20px rgba(142, 180, 200, 0.15);
  }

  .node-wrap.dragging .node {
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.55);
  }

  .pin-badge {
    position: absolute;
    top: 6px;
    right: 8px;
    width: 6px;
    height: 6px;
    border: 1.5px solid var(--accent-dim);
    border-radius: 1px;
    transform: rotate(45deg);
    opacity: 0.8;
  }

  .node-kind {
    font-size: 8px;
    color: var(--text-faint);
    line-height: 1;
  }

  .node-kind.research {
    color: var(--research-accent);
  }

  .node-kind.character {
    color: var(--character-accent);
  }

  .node-title {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-primary);
    line-height: 1.3;
    word-break: break-word;
    max-width: 100%;
  }

  .node-status {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-faint);
  }

  .mindmap-footer {
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
    min-width: 168px;
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