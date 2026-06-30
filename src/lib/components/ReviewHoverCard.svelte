<script lang="ts">
  /** Word-style hover tooltip over tracked changes: "Author inserted/deleted … · time". */
  import { reviewStore } from "$lib/stores/review.svelte";
  import { colorForAuthor } from "$lib/utils/reviewColors";

  interface Card {
    x: number;
    y: number;
    author: string;
    color: string;
    verb: string;
    text: string;
    time: string;
  }

  let card = $state<Card | null>(null);
  let activeMarkId = "";

  const changesById = $derived.by(() => {
    const map = new Map<string, (typeof reviewStore.chapterComments.changes)[number]>();
    for (const c of reviewStore.chapterComments.changes) map.set(c.markId, c);
    return map;
  });

  function formatTime(iso: string) {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function onOver(e: MouseEvent) {
    const target = e.target as HTMLElement | null;
    const el = target?.closest<HTMLElement>(".dt-insertion, .dt-deletion");
    if (!el) {
      if (card) {
        card = null;
        activeMarkId = "";
      }
      return;
    }
    const markId = el.getAttribute("data-change-id") ?? "";
    if (markId && markId === activeMarkId) return;
    activeMarkId = markId;

    const isDeletion = el.classList.contains("dt-deletion");
    const change = markId ? changesById.get(markId) : undefined;
    const author =
      el.getAttribute("data-author") ?? change?.author ?? "Unknown";
    const text = (change?.text ?? el.textContent ?? "").slice(0, 80);
    const rect = el.getBoundingClientRect();
    card = {
      x: Math.round(rect.left),
      y: Math.round(rect.top),
      author,
      color: colorForAuthor(author),
      verb: isDeletion ? "deleted" : "inserted",
      text,
      time: change?.createdAt ? formatTime(change.createdAt) : "",
    };
  }

  function dismiss() {
    if (card) card = null;
    activeMarkId = "";
  }
</script>

<svelte:window onmouseover={onOver} onscroll={dismiss} onwheel={dismiss} />

{#if card}
  <div
    class="hover-card"
    style="left:{card.x}px; top:{card.y}px; --rev-color:{card.color};"
    role="tooltip"
  >
    <span class="who">{card.author}</span>
    <span class="verb">{card.verb}</span>
    {#if card.text}
      <span class="snippet">“{card.text}”</span>
    {/if}
    {#if card.time}
      <span class="time">· {card.time}</span>
    {/if}
  </div>
{/if}

<style>
  .hover-card {
    position: fixed;
    transform: translateY(calc(-100% - 6px));
    z-index: 500;
    max-width: 320px;
    padding: 6px 9px;
    border-radius: 5px;
    border: 1px solid var(--border);
    border-left: 3px solid var(--rev-color, var(--accent-dim));
    background: var(--bg-surface);
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
    font-size: 11px;
    line-height: 1.35;
    color: var(--text-secondary);
    pointer-events: none;
    white-space: normal;
  }

  .who {
    font-weight: 600;
    color: var(--rev-color, var(--text-primary));
  }

  .verb {
    color: var(--text-muted);
  }

  .snippet {
    color: var(--text-primary);
  }

  .time {
    color: var(--text-muted);
  }
</style>
