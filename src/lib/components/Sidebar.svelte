<script lang="ts">
  import { onDestroy } from "svelte";
  import { app } from "$lib/stores/app.svelte";
  import { chapterStore } from "$lib/stores/chapter.svelte";
  import { libraryStore } from "$lib/stores/library.svelte";
  import { sidebarSelection } from "$lib/stores/sidebarSelection.svelte";
  import { deriveBookTotals } from "$lib/utils/bookTotals";
  import type { ChapterMeta, ChapterSection } from "$lib/types";

  const bookTotals = $derived(
    deriveBookTotals(
      libraryStore.library?.chapters ?? [],
      libraryStore.chapterStats,
      chapterStore.activeChapterId,
      chapterStore.activeSection,
      chapterStore.wordCount,
      chapterStore.chapterCharCount,
    ),
  );
  import SidebarFooter from "./SidebarFooter.svelte";
  import SidebarChapterMenu from "./SidebarChapterMenu.svelte";
  import SidebarSectionPanel from "./SidebarSectionPanel.svelte";
  import GoalProgress from "./GoalProgress.svelte";

  let chapterFilterInput = $state<HTMLInputElement | null>(null);
  let isResizing = $state(false);
  let resizeMove: ((ev: MouseEvent) => void) | null = null;
  let resizeUp: (() => void) | null = null;
  let contextMenu = $state<{ chapter: ChapterMeta; section: ChapterSection; x: number; y: number } | null>(null);

  const tabs = [
    { id: "chapters" as const, label: "Chapters", icon: "≡" },
    { id: "research" as const, label: "Research", icon: "◆" },
    { id: "characters" as const, label: "Characters", icon: "◎" },
  ];

  function stopResize() {
    if (resizeMove) document.removeEventListener("mousemove", resizeMove);
    if (resizeUp) document.removeEventListener("mouseup", resizeUp);
    resizeMove = null;
    resizeUp = null;
    isResizing = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    app.commitSidebarWidth();
  }

  onDestroy(() => stopResize());

  $effect(() => {
    if (app.focusChapterSearch && chapterFilterInput && app.sidebarTab === "chapters") {
      chapterFilterInput.focus();
      chapterFilterInput.select();
      app.focusChapterSearch = false;
    }
  });

  function listForSection(section: ChapterSection): ChapterMeta[] {
    if (section === "chapters") return libraryStore.filteredChapters;
    if (section === "research") return libraryStore.filteredResearch;
    return libraryStore.filteredCharacters;
  }

  function openContextMenu(e: MouseEvent, chapter: ChapterMeta, section: ChapterSection) {
    e.preventDefault();
    if (sidebarSelection.section !== section || !sidebarSelection.isSelected(chapter.id)) {
      sidebarSelection.setSection(section);
      sidebarSelection.selectSingle(chapter.id);
    }
    contextMenu = { chapter, section, x: e.clientX, y: e.clientY };
  }

  const contextMenuSelection = $derived.by(() => {
    if (!contextMenu) return [];
    const list = listForSection(contextMenu.section);
    const ids =
      sidebarSelection.section === contextMenu.section
        ? [...sidebarSelection.selectedIds]
        : [contextMenu.chapter.id];
    return list.filter((c) => ids.includes(c.id));
  });

  function startResize(e: MouseEvent) {
    if (app.sidebarCollapsed) return;
    e.preventDefault();
    stopResize();
    isResizing = true;
    const startX = e.clientX;
    const startW = app.sidebarWidth;
    resizeMove = (ev: MouseEvent) => app.setSidebarWidth(startW + (ev.clientX - startX));
    resizeUp = () => stopResize();
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", resizeMove);
    document.addEventListener("mouseup", resizeUp);
  }
</script>

<svelte:window
  onclick={() => {
    contextMenu = null;
  }}
/>

<aside
  class="sidebar"
  class:collapsed={app.sidebarCollapsed}
  class:resizing={isResizing}
  style="--sidebar-width: {app.sidebarWidth}px"
>
  <div class="sidebar-header">
    {#if !app.sidebarCollapsed}
      <div class="tabs" role="tablist">
        {#each tabs as tab (tab.id)}
          <button
            class="tab"
            class:active={app.sidebarTab === tab.id}
            role="tab"
            aria-selected={app.sidebarTab === tab.id}
            title={tab.label}
            onclick={() => (app.sidebarTab = tab.id)}
          >
            <span class="tab-icon">{tab.icon}</span>
            <span class="tab-label">{tab.label}</span>
          </button>
        {/each}
      </div>
    {/if}
    <button
      class="collapse-btn"
      title={app.sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      onclick={() => (app.sidebarCollapsed = !app.sidebarCollapsed)}
    >
      {app.sidebarCollapsed ? "»" : "«"}
    </button>
  </div>

  {#if !app.sidebarCollapsed}
    <div class="sidebar-body">
      {#if app.sidebarTab === "chapters"}
        <SidebarSectionPanel
          section="chapters"
          items={libraryStore.filteredChapters}
          totalCount={libraryStore.library?.chapters.length ?? 0}
          bind:filter={libraryStore.chapterFilter}
          bind:filterInput={chapterFilterInput}
          placeholder="Search chapters…"
          addLabel="+ New Chapter"
          showStatus
          emptyLabel="No matching chapters"
          onItemContextMenu={(e, ch) => openContextMenu(e, ch, "chapters")}
        />
      {:else if app.sidebarTab === "research"}
        <SidebarSectionPanel
          section="research"
          panelClass="research-panel"
          items={libraryStore.filteredResearch}
          totalCount={libraryStore.researchChapters.length}
          bind:filter={libraryStore.researchFilter}
          placeholder="Search research…"
          addLabel="+ New Research"
          addClass="research-add"
          showStatus
          sectionDotClass="research-dot"
          sectionDotChar="◆"
          emptyLabel="No research items"
          onItemContextMenu={(e, ch) => openContextMenu(e, ch, "research")}
        />
      {:else}
        <SidebarSectionPanel
          section="characters"
          panelClass="characters-panel"
          items={libraryStore.filteredCharacters}
          totalCount={libraryStore.characterChapters.length}
          bind:filter={libraryStore.characterFilter}
          placeholder="Search characters…"
          addLabel="+ New Character"
          addClass="character-add"
          showStatus
          sectionDotClass="character-dot"
          sectionDotChar="◎"
          emptyLabel="No characters yet"
          onItemContextMenu={(e, ch) => openContextMenu(e, ch, "characters")}
        />
      {/if}
    </div>

    {#if app.sidebarTab === "chapters" && libraryStore.library}
      {@const total = libraryStore.library.chapters.length}
      {@const ready = libraryStore.finalChapters.length}
      <div class="compile-nudge" class:all-ready={ready > 0 && ready === total}>
        <span class="nudge-text">
          {#if total === 0}
            Add chapters to begin your manuscript
          {:else}
            <strong>{ready}</strong> of <strong>{total}</strong> ready to compile
          {/if}
        </span>
        {#if total > 0}
          <button class="nudge-btn" onclick={() => app.openDialog("compile")}>Compile</button>
        {/if}
      </div>
    {/if}

    {#if libraryStore.bookSettings.wordGoal > 0 && app.sidebarTab === "chapters"}
      <div class="sidebar-goal">
        <GoalProgress current={bookTotals.words} goal={libraryStore.bookSettings.wordGoal} compact />
        <button
          class="goal-settings-btn"
          title="Book settings"
          onclick={() => app.openDialog("bookSettings")}
        >
          ⚙
        </button>
      </div>
    {/if}

    <SidebarFooter />
  {/if}

  {#if !app.sidebarCollapsed}
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="resize-handle"
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      onmousedown={startResize}
    ></div>
  {/if}
</aside>

{#if contextMenu}
  <SidebarChapterMenu
    x={contextMenu.x}
    y={contextMenu.y}
    chapter={contextMenu.chapter}
    section={contextMenu.section}
    selectedChapters={contextMenuSelection}
    onClose={() => (contextMenu = null)}
  />
{/if}

<style>
  .sidebar {
    position: relative;
    width: var(--sidebar-width);
    min-width: var(--sidebar-width);
    max-width: var(--sidebar-width);
    height: 100%;
    background: var(--bg-surface);
    border-right: 1px solid var(--border-subtle);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    transition: width var(--transition-normal), min-width var(--transition-normal),
      max-width var(--transition-normal);
  }

  .sidebar.resizing {
    transition: none;
  }

  .sidebar.collapsed {
    width: 40px;
    min-width: 40px;
    max-width: 40px;
  }

  .resize-handle {
    position: absolute;
    top: 0;
    right: -3px;
    width: 6px;
    height: 100%;
    cursor: col-resize;
    z-index: 10;
  }

  .sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 8px 6px;
    border-bottom: 1px solid var(--border-subtle);
    gap: 4px;
    min-height: 40px;
    flex-shrink: 0;
  }

  .tabs {
    display: flex;
    gap: 1px;
    flex: 1;
    overflow: hidden;
  }

  .tab {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    padding: 4px 2px;
    font-size: 9px;
    color: var(--text-muted);
    border-radius: var(--radius-sm);
    min-width: 0;
  }

  .tab.active {
    color: var(--accent-hover);
    background: var(--accent-subtle);
  }

  .collapse-btn {
    color: var(--text-muted);
    padding: 2px 6px;
    font-size: 14px;
    flex-shrink: 0;
  }

  .sidebar-body {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .compile-nudge {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 8px 12px;
    border-top: 1px solid var(--border-subtle);
    background: var(--bg-chrome);
    flex-shrink: 0;
  }

  .compile-nudge.all-ready {
    background: rgba(74, 158, 114, 0.06);
  }

  .nudge-text {
    font-size: 11px;
    color: var(--text-muted);
    line-height: 1.4;
  }

  .nudge-text strong {
    color: var(--text-secondary);
    font-weight: 600;
  }

  .nudge-btn {
    font-size: 10px;
    padding: 4px 8px;
    border-radius: 4px;
    color: var(--accent-hover);
    border: 1px solid var(--accent-dim);
    background: var(--accent-subtle);
    flex-shrink: 0;
  }

  .nudge-btn:hover {
    background: rgba(201, 165, 92, 0.14);
  }

  .sidebar-goal {
    display: flex;
    align-items: flex-end;
    gap: 6px;
    padding: 8px 12px;
    border-top: 1px solid var(--border-subtle);
    background: var(--bg-chrome);
    flex-shrink: 0;
  }

  .sidebar-goal :global(.goal) {
    flex: 1;
    min-width: 0;
  }

  .goal-settings-btn {
    font-size: 12px;
    color: var(--text-muted);
    padding: 2px 4px;
    border-radius: 4px;
    flex-shrink: 0;
  }
</style>