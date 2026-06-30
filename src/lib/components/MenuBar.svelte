<script lang="ts">
  import type { Editor } from "@tiptap/core";
  import { app } from "$lib/stores/app.svelte";
  import { chapterStore } from "$lib/stores/chapter.svelte";
  import { reviewStore } from "$lib/stores/review.svelte";
  import { buildMenuActions, MENU_STRUCTURE } from "$lib/menu/actions";
  import type { MenuAction } from "$lib/types";

  interface Props {
    editor?: Editor | null;
  }

  let { editor = null }: Props = $props();

  let menuBarEl = $state<HTMLElement | null>(null);
  let openMenu = $state<string | null>(null);
  let openSubmenu = $state<string | null>(null);
  let openQuickExport = $state(false);
  let suppressOutsideClose = false;

  const hasLibrary = $derived(!!app.library);
  const hasChapter = $derived(!!app.activeChapterId);
  const activeSection = $derived(chapterStore.activeSection);
  const sidebarTab = $derived(app.sidebarTab);

  /**
   * Strict environment separation: the Author environment hides review tools,
   * the Editor environment hides authoring tools (Format / Insert).
   */
  const visibleMenus = $derived(
    MENU_STRUCTURE.filter((m) =>
      app.mode === "author"
        ? m.group !== "Review"
        : m.group !== "Format" && m.group !== "Insert",
    ),
  );

  const actions = $derived(
    buildMenuActions({
      editor,
      hasLibrary,
      hasChapter,
      pendingCount:
        openMenu === "Review" ? reviewStore.pendingChanges.length : 0,
      activeSection,
      sidebarTab,
      canUndo:
        openMenu === "Edit" ? (editor?.can().undo() ?? false) : false,
      canRedo:
        openMenu === "Edit" ? (editor?.can().redo() ?? false) : false,
    }),
  );
  const actionMap = $derived(new Map(actions.map((a) => [a.id, a])));

  function getItem(id: string): MenuAction | undefined {
    return actionMap.get(id);
  }

  function toggle(menu: string) {
    openMenu = openMenu === menu ? null : menu;
    openSubmenu = null;
    openQuickExport = false;
    suppressOutsideClose = true;
    queueMicrotask(() => {
      suppressOutsideClose = false;
    });
  }

  function closeMenus() {
    if (openMenu === null && openSubmenu === null && !openQuickExport) return;
    openMenu = null;
    openSubmenu = null;
    openQuickExport = false;
  }

  function handleOutsidePointer(e: MouseEvent) {
    if (suppressOutsideClose) return;
    if (app.activeDialog || app.confirmDialog) return;
    const target = e.target as Node;
    if (menuBarEl?.contains(target)) return;
    const el = target instanceof Element ? target : null;
    if (el?.closest(".overlay, .context-menu")) return;
    closeMenus();
  }

  function runAction(action: MenuAction | undefined) {
    if (!action || action.disabled) return;
    action.run?.();
    closeMenus();
  }

  function isBookCompileSection(items: string[] | undefined, index: number): boolean {
    const id = items?.[index];
    return !!id && id.startsWith("book.compile.") && id !== "book.compile.html";
  }

  function isFileExportSection(items: string[] | undefined, index: number): boolean {
    const id = items?.[index];
    return !!id && id.startsWith("file.export.") && id !== "file.export.html";
  }

  const EXPORT_SUBMENU_IDS = [
    "file.export.html",
    "file.export.md",
    "file.export.docx",
    "file.export.text",
  ] as const;

  function shouldSep(items: string[], index: number): boolean {
    const sepBefore = ["file.save", "edit.selectAll", "fmt.justify", "review.track", "review.summary", "book.settings", "view.spell"];
    return sepBefore.includes(items[index]);
  }
</script>

<svelte:window onmousedown={handleOutsidePointer} />

<header class="menu-bar" bind:this={menuBarEl}>
  <nav class="menus">
    {#each visibleMenus as menu}
      <div class="menu-wrap">
        <button
          class="menu-btn"
          class:active={openMenu === menu.label}
          type="button"
          onmousedown={(e) => e.stopPropagation()}
          onclick={(e) => {
            e.stopPropagation();
            toggle(menu.label);
          }}
        >
          {menu.label}
        </button>
        {#if openMenu === menu.label}
          <div
            class="dropdown"
            role="menu"
            tabindex="-1"
            onmousedown={(e) => e.stopPropagation()}
            onclick={(e) => e.stopPropagation()}
            onkeydown={(e) => e.stopPropagation()}
          >
            {#each menu.items ?? [] as itemId, i}
              {@const action = getItem(itemId)}
              {#if itemId === "file.export.html"}
                <div
                  class="submenu-wrap"
                  role="group"
                  onmouseenter={() => (openSubmenu = "export")}
                  onmouseleave={() => (openSubmenu = null)}
                >
                  <button
                    type="button"
                    class="has-sub"
                    aria-haspopup="menu"
                    disabled={getItem("file.export.html")?.disabled}
                  >
                    <span>Export as…</span>
                    <span class="has-sub-meta">
                      {#if getItem("file.export")?.shortcut}
                        <span class="shortcut">{getItem("file.export")?.shortcut}</span>
                      {/if}
                      <span class="arrow">›</span>
                    </span>
                  </button>
                  {#if openSubmenu === "export"}
                    <div class="submenu" role="menu" tabindex="-1">
                      {#each EXPORT_SUBMENU_IDS as cid}
                        {@const ea = getItem(cid)}
                        <button
                          type="button"
                          role="menuitem"
                          disabled={ea?.disabled}
                          onclick={() => runAction(ea)}
                        >
                          {ea?.label}
                        </button>
                      {/each}
                    </div>
                  {/if}
                </div>
              {:else if isFileExportSection(menu.items, i)}
                <!-- skip individual export items, shown in submenu -->
              {:else if itemId === "book.compile.html"}
                <div
                  class="submenu-wrap"
                  role="group"
                  onmouseenter={() => (openSubmenu = "compile")}
                  onmouseleave={() => (openSubmenu = null)}
                >
                  <button type="button" class="has-sub" aria-haspopup="menu">
                    Compile as…
                    <span class="arrow">›</span>
                  </button>
                  {#if openSubmenu === "compile"}
                    <div class="submenu" role="menu" tabindex="-1">
                      {#each ["book.compile.html", "book.compile.md", "book.compile.txt", "book.compile.docx"] as cid}
                        {@const ca = getItem(cid)}
                        <button
                          type="button"
                          role="menuitem"
                          disabled={ca?.disabled}
                          onclick={() => runAction(ca)}
                        >
                          {ca?.label}
                        </button>
                      {/each}
                    </div>
                  {/if}
                </div>
              {:else if isBookCompileSection(menu.items, i)}
                <!-- skip individual compile items, shown in submenu -->
              {:else if action}
                {#if i > 0 && menu.items && shouldSep(menu.items, i)}
                  <div class="dropdown-sep"></div>
                {/if}
                <button
                  type="button"
                  role="menuitem"
                  disabled={action.disabled}
                  onclick={() => runAction(action)}
                >
                  <span>{action.label}</span>
                  {#if action.shortcut}
                    <span class="shortcut">{action.shortcut}</span>
                  {/if}
                </button>
              {/if}
            {/each}
          </div>
        {/if}
      </div>
    {/each}
  </nav>

  <div class="quick-actions">
    <div class="menu-wrap quick-export">
      <button
        type="button"
        class="quick-btn"
        disabled={getItem("file.export.html")?.disabled}
        onmousedown={(e) => e.stopPropagation()}
        onclick={(e) => {
          e.stopPropagation();
          openQuickExport = !openQuickExport;
          openMenu = null;
          openSubmenu = null;
        }}
      >
        Export as…
      </button>
      {#if openQuickExport}
        <div
          class="dropdown quick-export-menu"
          role="menu"
          tabindex="-1"
          onmousedown={(e) => e.stopPropagation()}
          onclick={(e) => e.stopPropagation()}
        >
          {#each EXPORT_SUBMENU_IDS as cid}
            {@const ea = getItem(cid)}
            <button
              type="button"
              role="menuitem"
              disabled={ea?.disabled}
              onclick={() => runAction(ea)}
            >
              {ea?.label}
            </button>
          {/each}
        </div>
      {/if}
    </div>
    <button
      type="button"
      class="quick-btn accent"
      onclick={() => runAction(getItem("file.save"))}
    >
      Save All
    </button>
  </div>
</header>

<style>
  .menu-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 12px;
    height: 36px;
    background: var(--bg-chrome);
    border-bottom: 1px solid var(--border-subtle);
  }

  .menus,
  .quick-actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .menu-wrap {
    position: relative;
  }

  .menu-btn {
    padding: 5px 10px;
    font-size: 12px;
    color: var(--text-muted);
    border-radius: var(--radius-sm);
    transition: background var(--transition-fast), color var(--transition-fast);
  }

  .menu-btn:hover,
  .menu-btn.active {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    margin-top: 4px;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 5px;
    min-width: 220px;
    z-index: 150;
    box-shadow: var(--shadow-md);
  }

  .dropdown button {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    text-align: left;
    padding: 6px 10px;
    font-size: 12px;
    color: var(--text-primary);
    border-radius: 4px;
    gap: 16px;
  }

  .dropdown button:hover:not(:disabled) {
    background: var(--bg-hover);
  }

  .dropdown button:disabled {
    opacity: 0.35;
  }

  .shortcut {
    font-size: 10px;
    color: var(--text-muted);
  }

  .dropdown-sep {
    height: 1px;
    background: var(--border);
    margin: 4px 0;
  }

  .submenu-wrap {
    position: relative;
  }

  .has-sub {
    gap: 8px;
  }

  .has-sub-meta {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-left: auto;
  }

  .has-sub .arrow {
    color: var(--text-muted);
  }

  .quick-export-menu {
    right: 0;
    left: auto;
    min-width: 140px;
  }

  .submenu {
    position: absolute;
    left: 100%;
    top: 0;
    margin-left: 2px;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 4px;
    min-width: 160px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
  }

  .quick-btn {
    padding: 4px 12px;
    font-size: 11px;
    font-weight: 500;
    color: var(--text-muted);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    background: var(--bg-deep);
  }

  .quick-btn.accent {
    border-color: var(--accent-dim);
    color: var(--accent-hover);
    background: var(--accent-subtle);
  }

  .quick-btn:hover:not(:disabled) {
    background: var(--bg-hover);
    color: var(--text-primary);
    border-color: var(--border);
  }

  .quick-btn.accent:hover:not(:disabled) {
    background: rgba(201, 165, 92, 0.14);
    border-color: var(--accent);
  }
</style>