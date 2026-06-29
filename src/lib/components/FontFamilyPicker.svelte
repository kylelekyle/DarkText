<script lang="ts">
  import { tick } from "svelte";
  import { fontStore } from "$lib/stores/fonts.svelte";
  import { portal } from "$lib/utils/platform";
  import { primaryFamily } from "$lib/utils/typography";

  interface Props {
    value: string;
    onchange: (cssValue: string) => void;
    class?: string;
    compact?: boolean;
  }

  let { value, onchange, class: className = "", compact = false }: Props = $props();

  let open = $state(false);
  let filter = $state("");
  let rootEl = $state<HTMLDivElement | null>(null);
  let triggerEl = $state<HTMLButtonElement | null>(null);
  let popoverEl = $state<HTMLDivElement | null>(null);
  let popoverTop = $state(0);
  let popoverLeft = $state(0);
  let popoverWidth = $state(240);

  const displayLabel = $derived.by(() => {
    const family = primaryFamily(value);
    const match = fontStore.options.find(
      (o) => o.family.toLowerCase() === family.toLowerCase() || o.cssValue === value,
    );
    return match?.label ?? (family || "Font");
  });

  const filteredGroups = $derived.by(() => {
    const q = filter.trim().toLowerCase();
    return fontStore.groupedOptions
      .map((group) => ({
        ...group,
        options: q
          ? group.options.filter(
              (o) =>
                o.label.toLowerCase().includes(q) || o.family.toLowerCase().includes(q),
            )
          : group.options,
      }))
      .filter((g) => g.options.length > 0);
  });

  const flatFiltered = $derived(filteredGroups.flatMap((g) => g.options));

  function syncPosition() {
    if (!triggerEl) return;
    const rect = triggerEl.getBoundingClientRect();
    const maxWidth = compact ? 240 : 280;
    popoverTop = rect.bottom + 4;
    popoverLeft = rect.left;
    popoverWidth = Math.min(maxWidth, window.innerWidth - rect.left - 8);
  }

  function pick(cssValue: string) {
    open = false;
    filter = "";
    onchange(cssValue);
  }

  async function toggle(e: MouseEvent) {
    e.stopPropagation();
    open = !open;
    if (open) {
      filter = "";
      await tick();
      syncPosition();
    }
  }

  function onWindowClick(e: MouseEvent) {
    if (!open) return;
    const target = e.target as Node;
    if (rootEl?.contains(target) || popoverEl?.contains(target)) return;
    open = false;
    filter = "";
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === "Escape" && open) {
      open = false;
      filter = "";
    }
  }

  $effect(() => {
    if (!open) return;
    syncPosition();
    const onReposition = () => syncPosition();
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  });
</script>

<svelte:window onclick={onWindowClick} onkeydown={onKeydown} />

<div class="font-picker {className}" class:compact bind:this={rootEl}>
  <button
    type="button"
    class="trigger"
    class:open
    title={displayLabel}
    bind:this={triggerEl}
    onclick={toggle}
  >
    <span class="trigger-label" style="font-family: {value}">{displayLabel}</span>
    <span class="chevron" aria-hidden="true">▾</span>
  </button>
</div>

{#if open}
  <div
    class="popover"
    class:compact
    role="listbox"
    tabindex="-1"
    bind:this={popoverEl}
    use:portal
    style="top: {popoverTop}px; left: {popoverLeft}px; width: {popoverWidth}px;"
    onmousedown={(e) => e.stopPropagation()}
  >
    <div class="list">
      {#if fontStore.loading && flatFiltered.length === 0}
        <p class="status">Loading fonts…</p>
      {:else if flatFiltered.length === 0}
        <p class="status">No matching fonts</p>
      {:else}
        {#each filteredGroups as group}
          <div class="group">
            <span class="group-label">{group.label}</span>
            {#each group.options as option (option.cssValue + (option.path ?? ""))}
              <button
                type="button"
                role="option"
                aria-selected={option.cssValue === value}
                class="option"
                class:selected={option.cssValue === value}
                style="font-family: {option.cssValue}"
                onclick={() => pick(option.cssValue)}
              >
                {option.label}
              </button>
            {/each}
          </div>
        {/each}
      {/if}
    </div>
    {#if !compact && fontStore.options.length > 12}
      <input
        type="text"
        class="search"
        placeholder="Filter fonts…"
        bind:value={filter}
      />
    {/if}
  </div>
{/if}

<style>
  .font-picker {
    position: relative;
    min-width: 0;
  }

  .font-picker.compact {
    max-width: 140px;
  }

  .trigger {
    display: flex;
    align-items: center;
    gap: 4px;
    width: 100%;
    max-width: 180px;
    padding: 3px 6px;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius);
    background: var(--bg-elevated);
    color: var(--text-secondary);
    font-size: 11px;
    cursor: pointer;
    text-align: left;
  }

  .font-picker.compact .trigger {
    max-width: 140px;
  }

  .trigger:hover,
  .trigger.open {
    border-color: var(--border);
    background: var(--bg-hover);
  }

  .trigger-label {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .chevron {
    flex-shrink: 0;
    font-size: 9px;
    opacity: 0.6;
  }

  .popover {
    position: fixed;
    z-index: 400;
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
    overflow: hidden;
  }

  .search {
    width: 100%;
    padding: 6px 10px;
    border: none;
    border-top: 1px solid var(--border-subtle);
    background: var(--bg-elevated);
    color: var(--text-primary);
    font-size: 11px;
    outline: none;
  }

  .list {
    max-height: 280px;
    overflow-y: auto;
  }

  .popover.compact .list {
    max-height: 320px;
  }

  .group-label {
    display: block;
    padding: 6px 10px 4px;
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    position: sticky;
    top: 0;
    background: var(--bg-surface);
  }

  .option {
    display: block;
    width: 100%;
    padding: 7px 12px;
    border: none;
    background: transparent;
    color: var(--text-primary);
    font-size: 15px;
    line-height: 1.3;
    text-align: left;
    cursor: pointer;
  }

  .popover.compact .option {
    font-size: 16px;
    padding: 8px 12px;
  }

  .option:hover {
    background: var(--bg-hover);
  }

  .option.selected {
    background: var(--accent-subtle);
    color: var(--text-primary);
  }

  .status {
    padding: 12px;
    font-size: 12px;
    color: var(--text-muted);
    text-align: center;
  }
</style>