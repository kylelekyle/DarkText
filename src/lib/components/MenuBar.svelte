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
  let suppressOutsideClose = false;

  const hasLibrary = $derived(!!app.library);
  const hasChapter = $derived(!!app.activeChapterId);
  const activeSection = $derived(chapterStore.activeSection);
  const sidebarTab = $derived(app.sidebarTab);

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
    suppressOutsideClose = true;
    queueMicrotask(() => {
      suppressOutsideClose = false;
    });
  }

  function closeMenus() {
    if (openMenu === null && openSubmenu === null) return;
    openMenu = null;
    openSubmenu = null;
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

  function shouldSep(items: string[], index: number): boolean {
    const sepBefore = ["file.save", "edit.selectAll", "fmt.justify", "review.track", "review.summary", "book.settings", "view.spell"];
    return sepBefore.includes(items[index]);
  }
</script>

<svelte:window onmousedown={handleOutsidePointer} />

<header class="menu-bar" bind:this={menuBarEl}>
  <nav class="menus">
    {#each MENU_STRUCTURE as menu}
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
              {#if itemId === "book.compile.html"}
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
    <button
      type="button"
      class="quick-btn"
      disabled={getItem("file.export")?.disabled}
      onclick={() => runAction(getItem("file.export"))}
    >
      Export as…
    </button>
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

  .has-sub .arrow {
    margin-left: auto;
    color: var(--text-muted);
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