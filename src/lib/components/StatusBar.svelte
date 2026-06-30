<script lang="ts">
  import { app } from "$lib/stores/app.svelte";
  import { chapterStore } from "$lib/stores/chapter.svelte";
  import { libraryStore } from "$lib/stores/library.svelte";
  import { reviewStore } from "$lib/stores/review.svelte";
  import { deriveBookTotals, formatCompact } from "$lib/utils/stats";
  import { statusLabelShort } from "$lib/utils/chapterDisplay";
  import GoalProgress from "./GoalProgress.svelte";

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
</script>

<footer class="status-bar" class:has-goal={!!libraryStore.bookSettings.wordGoal}>
  <div class="status-left">
    <span class="mode-badge" class:editor={app.mode === "editor"}>
      {app.mode === "author" ? "Author" : "Editor"}
    </span>

    {#if chapterStore.activeChapterMeta}
      <span class="status-chip badge-{chapterStore.activeChapterMeta.status}">
        {statusLabelShort(chapterStore.activeChapterMeta.status)}
      </span>
      <span class="chapter-info" title={chapterStore.activeChapterMeta.title}>
        {chapterStore.activeChapterMeta.title}
      </span>
    {/if}
  </div>

  <div class="status-stats">
    {#if chapterStore.activeChapterId && chapterStore.activeSection === "chapters"}
      <span
        class="stat-group"
        title="Chapter: {chapterStore.wordCount.toLocaleString()} words, {chapterStore.chapterCharCount.toLocaleString()} characters, ~{chapterStore.chapterPages} pages"
      >
        <span class="stat-label">Ch</span>
        <span class="stat-value">{formatCompact(chapterStore.wordCount)}w</span>
        <span class="stat-sep">·</span>
        <span class="stat-value">{formatCompact(chapterStore.chapterCharCount)}c</span>
        <span class="stat-sep">·</span>
        <span class="stat-value">{chapterStore.chapterPages}pg</span>
      </span>
    {/if}

    {#if libraryStore.library}
      <span
        class="stat-group book"
        title="Book: {bookTotals.words.toLocaleString()} words, {bookTotals.chars.toLocaleString()} characters, ~{bookTotals.pages} pages"
      >
        <span class="stat-label">Book</span>
        <span class="stat-value">{formatCompact(bookTotals.words)}w</span>
        <span class="stat-sep">·</span>
        <span class="stat-value">{formatCompact(bookTotals.chars)}c</span>
        <span class="stat-sep">·</span>
        <span class="stat-value">{bookTotals.pages}pg</span>
      </span>
    {/if}
  </div>

  <div class="status-right">
    {#if libraryStore.bookSettings.wordGoal > 0}
      <div class="goal-wrap">
        <GoalProgress
          current={bookTotals.words}
          goal={libraryStore.bookSettings.wordGoal}
          compact
        />
      </div>
    {/if}

    {#if app.mode === "editor" && app.reviewPanelDismissed}
      <button
        type="button"
        class="review-panel-cta"
        onclick={() => app.openReviewPanel()}
      >
        Show review panel
      </button>
    {/if}

    {#if reviewStore.trackChanges}
      <span class="track-on">Tracking</span>
    {/if}

    <span class="compile-hint" title="Only Final chapters compile">
      Compile: {libraryStore.finalChapters.length}
    </span>

    {#if reviewStore.pendingChanges.length > 0}
      <span class="changes-hint">{reviewStore.pendingChanges.length} changes</span>
    {/if}

    {#if libraryStore.library}
      {#if app.libraryReviewTotalsLoading}
        <span class="review-totals loading">Review…</span>
      {:else if app.libraryReviewTotals && (app.libraryReviewTotals.openComments > 0 || app.libraryReviewTotals.pendingChanges > 0)}
        <button
          type="button"
          class="review-totals"
          title="Open manuscript review summary"
          onclick={() => app.openDialog("libraryReview")}
        >
          {#if app.libraryReviewTotals.openComments > 0}
            {app.libraryReviewTotals.openComments} comment{app.libraryReviewTotals.openComments === 1 ? "" : "s"}
          {/if}
          {#if app.libraryReviewTotals.openComments > 0 && app.libraryReviewTotals.pendingChanges > 0}
            ·
          {/if}
          {#if app.libraryReviewTotals.pendingChanges > 0}
            {app.libraryReviewTotals.pendingChanges} change{app.libraryReviewTotals.pendingChanges === 1 ? "" : "s"}
          {/if}
        </button>
      {/if}
    {/if}

    <span
      class="save"
      class:unsaved={chapterStore.saveStatus === "unsaved"}
      class:saving={chapterStore.saveStatus === "saving"}
    >
      {chapterStore.saveStatus === "saved"
        ? "Saved"
        : chapterStore.saveStatus === "saving"
          ? "Saving…"
          : "Unsaved"}
    </span>
  </div>
</footer>

<style>
  .status-bar {
    display: flex;
    align-items: center;
    gap: 14px;
    height: 28px;
    padding: 0 14px;
    background: var(--bg-chrome);
    border-top: 1px solid var(--border-subtle);
    font-size: 11px;
    color: var(--text-faint);
    transition: height var(--transition-smooth);
  }

  .status-bar.has-goal {
    height: 32px;
  }

  .status-left,
  .status-stats,
  .status-right {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  .status-stats {
    flex: 1;
    justify-content: center;
    gap: 16px;
  }

  .status-right {
    flex-shrink: 0;
    gap: 12px;
  }

  .mode-badge {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--accent-hover);
    font-weight: 600;
    padding: 1px 6px;
    border-radius: 4px;
    background: var(--accent-subtle);
    flex-shrink: 0;
  }

  .mode-badge.editor {
    color: var(--status-refine);
    background: rgba(229, 168, 75, 0.12);
  }

  .status-chip {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 1px 5px;
    border-radius: 3px;
    flex-shrink: 0;
  }

  .badge-draft {
    background: rgba(122, 122, 138, 0.2);
    color: var(--status-draft);
  }

  .badge-needs-refine {
    background: rgba(201, 162, 39, 0.15);
    color: var(--status-refine);
  }

  .badge-final {
    background: rgba(61, 154, 106, 0.15);
    color: var(--status-final);
  }

  .chapter-info {
    color: var(--text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 140px;
  }

  .stat-group {
    display: flex;
    align-items: center;
    gap: 4px;
    font-variant-numeric: tabular-nums;
    color: var(--text-muted);
    white-space: nowrap;
  }

  .stat-group.book {
    color: var(--text-secondary);
  }

  .stat-label {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-faint);
    margin-right: 2px;
  }

  .stat-value {
    color: inherit;
  }

  .stat-sep {
    color: var(--text-faint);
    opacity: 0.6;
  }

  .goal-wrap {
    width: 120px;
    flex-shrink: 0;
  }

  .review-panel-cta {
    color: var(--accent);
    font-size: 10px;
    font-weight: 500;
    padding: 2px 8px;
    border: 1px solid var(--accent-dim);
    border-radius: var(--radius-sm);
    flex-shrink: 0;
  }

  .review-panel-cta:hover {
    background: var(--accent-subtle);
    color: var(--accent-hover);
  }

  .track-on {
    color: var(--status-refine);
    font-size: 9px;
    text-transform: uppercase;
    flex-shrink: 0;
  }

  .compile-hint,
  .changes-hint {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    flex-shrink: 0;
  }

  .changes-hint {
    color: var(--status-refine);
  }

  .review-totals {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--accent-hover);
    flex-shrink: 0;
    border: none;
    background: transparent;
    padding: 0;
    cursor: pointer;
  }

  .review-totals:hover {
    color: var(--text-primary);
    text-decoration: underline;
  }

  .review-totals.loading {
    cursor: default;
    color: var(--text-faint);
    animation: pulse 1.2s ease infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 0.4;
    }
    50% {
      opacity: 1;
    }
  }

  .save {
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--status-final);
    min-width: 48px;
    text-align: right;
    flex-shrink: 0;
  }

  .save.unsaved {
    color: var(--status-refine);
  }

  .save.saving {
    color: var(--text-muted);
  }

  @media (max-width: 900px) {
    .status-stats {
      display: none;
    }
  }
</style>