<script lang="ts">
  import Modal from "../Modal.svelte";
  import CompileChapterList from "./CompileChapterList.svelte";
  import { app } from "$lib/stores/app.svelte";
  import { showConfirm } from "$lib/stores/confirmFlow";
  import type { ChapterMeta } from "$lib/types";

  interface Props {
    chapters: ChapterMeta[];
    showNumbers?: boolean;
    showTitles?: boolean;
    onSave: (chapterIds: string[]) => void;
    onClose: () => void;
  }

  let {
    chapters,
    showNumbers = true,
    showTitles = true,
    onSave,
    onClose,
  }: Props = $props();

  let draftChapters = $state<ChapterMeta[]>([...chapters]);
  const baselineIds = chapters.map((c) => c.id);

  const isDirty = $derived(
    draftChapters.map((c) => c.id).join("\0") !== baselineIds.join("\0"),
  );

  function applyDraftReorder(reorderedIds: string[]) {
    const byId = new Map(draftChapters.map((c) => [c.id, c]));
    const next = reorderedIds
      .map((id) => byId.get(id))
      .filter((c): c is ChapterMeta => !!c);
    if (next.length === draftChapters.length) {
      draftChapters = next;
    }
  }

  async function requestClose() {
    if (isDirty) {
      const discard = await showConfirm(
        app,
        "Any unsaved changes to the layout will be lost.",
        "Discard layout changes?",
        { confirm: "Close", cancel: "Keep editing", destructive: true },
      );
      if (!discard) return;
    }
    onClose();
  }

  function save() {
    onSave(draftChapters.map((c) => c.id));
    onClose();
  }
</script>

<Modal title="Organize chapters" wide stacked onClose={() => void requestClose()}>
  <div class="organizer">
    <p class="hint">Drag chapters to set compile order. Save applies the layout to your book.</p>

    <CompileChapterList
      items={draftChapters}
      {showNumbers}
      {showTitles}
      showHeader={false}
      onReorder={applyDraftReorder}
    />

    <div class="actions">
      <button type="button" class="btn" onclick={() => void requestClose()}>Close</button>
      <button type="button" class="btn primary" disabled={!isDirty} onclick={save}>
        Save
      </button>
    </div>
  </div>
</Modal>

<style>
  .hint {
    font-size: 12px;
    color: var(--text-muted);
    line-height: 1.45;
    margin-bottom: 12px;
  }

  .organizer :global(.chapter-list-wrap) {
    margin-bottom: 0;
  }

  .organizer :global(.chapter-list) {
    max-height: min(50vh, 360px);
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 16px;
    padding-top: 12px;
    border-top: 1px solid var(--border-subtle);
  }

  .btn {
    padding: 6px 14px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    font-size: 12px;
    background: var(--bg-surface);
    color: var(--text-secondary);
  }

  .btn.primary {
    border-color: var(--accent-dim);
    background: var(--accent-dim);
    color: var(--text-primary);
  }

  .btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
</style>