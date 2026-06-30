<script lang="ts">
  /**
   * Word-style margin comment balloons: each active thread floats in the right
   * gutter, vertically aligned to its anchored text, stacked to avoid overlap.
   * Lives inside `.editor-scroller` so balloons scroll with the content.
   */
  import { tick } from "svelte";
  import { app } from "$lib/stores/app.svelte";
  import { reviewStore } from "$lib/stores/review.svelte";

  interface Props {
    /** The scroll container the balloons are positioned within. */
    scroller: HTMLElement | null;
    /** Bumped when the document reloads, to force a reflow. */
    revision: number;
  }

  let { scroller, revision }: Props = $props();

  const GAP = 8;

  let replyText = $state<Record<string, string>>({});
  let balloonEls = $state<Record<string, HTMLElement>>({});
  let tops = $state<Record<string, number>>({});

  /** Only show balloons in Review mode when markup reveals comments. */
  const visible = $derived(
    app.mode === "editor" &&
      !app.focusMode &&
      (app.effectiveMarkupMode === "all" || app.effectiveMarkupMode === "simple"),
  );

  const threads = $derived(visible ? reviewStore.activeThreads : []);

  function formatTime(iso: string) {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function anchorEl(markId: string): HTMLElement | null {
    if (!scroller) return null;
    try {
      return scroller.querySelector<HTMLElement>(
        `[data-comment-id="${CSS.escape(markId)}"]`,
      );
    } catch {
      return null;
    }
  }

  /** Compute each balloon's vertical slot: anchor-aligned, then pushed to avoid overlap. */
  async function reflow() {
    if (!scroller || threads.length === 0) {
      tops = {};
      return;
    }
    const scRect = scroller.getBoundingClientRect();
    const base: { markId: string; y: number }[] = [];
    for (const thread of threads) {
      const el = anchorEl(thread.markId);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      base.push({ markId: thread.markId, y: r.top - scRect.top + scroller.scrollTop });
    }
    base.sort((a, b) => a.y - b.y);

    // First pass with anchor-aligned tops so heights can be measured.
    const next: Record<string, number> = {};
    for (const b of base) next[b.markId] = b.y;
    tops = next;
    await tick();

    // Second pass: push overlapping balloons down using measured heights.
    let cursor = -Infinity;
    const resolved: Record<string, number> = {};
    for (const b of base) {
      let top = b.y;
      if (top < cursor) top = cursor;
      resolved[b.markId] = top;
      const h = balloonEls[b.markId]?.offsetHeight ?? 96;
      cursor = top + h + GAP;
    }
    tops = resolved;
  }

  function highlightAnchor(markId: string, on: boolean) {
    const el = anchorEl(markId);
    if (el) el.classList.toggle("dt-comment-active", on);
  }

  // Reflow whenever the thread set, document, or layout changes.
  $effect(() => {
    // Touch reactive deps so the effect re-runs on change.
    void threads;
    void revision;
    void scroller;
    if (!visible) {
      tops = {};
      return;
    }
    void reflow();

    if (!scroller) return;
    const onResize = () => void reflow();
    window.addEventListener("resize", onResize);
    const ro = new ResizeObserver(() => void reflow());
    const prose = scroller.querySelector(".chapter-prose");
    if (prose) ro.observe(prose);
    return () => {
      window.removeEventListener("resize", onResize);
      ro.disconnect();
    };
  });
</script>

{#if visible}
  <div class="balloon-layer" aria-label="Comment balloons">
    {#each threads as thread (thread.id)}
      {#if tops[thread.markId] !== undefined}
        <div
          class="balloon"
          style="top: {tops[thread.markId]}px"
          bind:this={balloonEls[thread.markId]}
          onmouseenter={() => highlightAnchor(thread.markId, true)}
          onmouseleave={() => highlightAnchor(thread.markId, false)}
          role="group"
        >
          <button
            type="button"
            class="anchor"
            title="Jump to comment in text"
            onclick={() => app.scrollToComment(thread.markId)}
          >
            “{thread.anchorText}”
          </button>
          {#each thread.replies as reply (reply.id)}
            <div class="reply">
              <span class="meta">{reply.author} · {formatTime(reply.createdAt)}</span>
              <p>{reply.text}</p>
            </div>
          {/each}
          <div class="actions">
            <input
              class="reply-input"
              type="text"
              placeholder="Reply…"
              bind:value={replyText[thread.id]}
              onkeydown={(e) => {
                if (e.key === "Enter" && replyText[thread.id]?.trim()) {
                  void app.replyToThread(thread.id, replyText[thread.id].trim());
                  replyText[thread.id] = "";
                }
              }}
            />
            <button class="small" onclick={() => void app.resolveThread(thread.id)}>
              Resolve
            </button>
          </div>
        </div>
      {/if}
    {/each}
  </div>
{/if}

<style>
  .balloon-layer {
    position: absolute;
    top: 0;
    right: 12px;
    width: 244px;
    pointer-events: none;
    z-index: 5;
  }

  .balloon {
    position: absolute;
    right: 0;
    width: 244px;
    padding: 8px 10px;
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    border-left: 3px solid var(--status-refine);
    border-radius: 4px;
    box-shadow: var(--shadow-sm);
    pointer-events: auto;
    transition: top 0.12s ease, box-shadow 0.12s ease;
  }

  .balloon:hover {
    box-shadow: var(--shadow-md);
    border-color: var(--border);
  }

  .anchor {
    display: block;
    width: 100%;
    text-align: left;
    font-size: 10px;
    font-style: italic;
    color: var(--text-muted);
    background: none;
    border: none;
    padding: 0 0 4px;
    cursor: pointer;
  }

  .anchor:hover {
    color: var(--accent-hover);
  }

  .reply {
    margin-bottom: 5px;
  }

  .meta {
    font-size: 9px;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  .reply p {
    font-size: 12px;
    color: var(--text-secondary);
    margin-top: 1px;
    white-space: pre-wrap;
  }

  .actions {
    display: flex;
    gap: 4px;
    margin-top: 4px;
  }

  .reply-input {
    flex: 1;
    min-width: 0;
    font-size: 11px;
    padding: 3px 6px;
    background: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    border-radius: 3px;
    color: var(--text-primary);
  }

  .small {
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 3px;
    color: var(--text-muted);
    background: var(--bg-hover);
  }

  .small:hover {
    color: var(--text-primary);
  }
</style>
