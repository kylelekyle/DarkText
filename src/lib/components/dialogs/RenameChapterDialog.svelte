<script lang="ts">
  import { onMount } from "svelte";
  import Modal from "../Modal.svelte";
  import { app } from "$lib/stores/app.svelte";

  const targetId = $derived(app.renameChapterTargetId ?? app.activeChapterId);
  const section = $derived(app.renameChapterSection ?? app.activeSection);

  const dialogTitle = $derived(
    section === "research"
      ? "Rename Research"
      : section === "characters"
        ? "Rename Character"
        : "Rename Chapter",
  );

  const fieldLabel = $derived(
    section === "research"
      ? "Research title"
      : section === "characters"
        ? "Character name"
        : "Chapter title",
  );

  const targetMeta = $derived.by(() => {
    if (!targetId) return null;
    if (section === "chapters") {
      return app.library?.chapters.find((c) => c.id === targetId) ?? null;
    }
    if (section === "research") {
      return app.researchChapters.find((c) => c.id === targetId) ?? null;
    }
    return app.characterChapters.find((c) => c.id === targetId) ?? null;
  });

  let title = $state("");
  let titleInput = $state<HTMLInputElement | null>(null);

  onMount(() => {
    title = targetMeta?.title ?? "";
    requestAnimationFrame(() => {
      titleInput?.focus();
      titleInput?.select();
    });
  });

  function save() {
    if (!targetId || !title.trim()) return;
    app.updateChapterTitle(targetId, title.trim(), section);
    app.closeDialog();
  }
</script>

<Modal title={dialogTitle} onClose={() => app.closeDialog()}>
  <div class="form">
    <label>
      <span>{fieldLabel}</span>
      <input
        type="text"
        bind:this={titleInput}
        bind:value={title}
        onkeydown={(e) => e.key === "Enter" && save()}
      />
    </label>
    <div class="actions">
      <button class="btn" onclick={() => app.closeDialog()}>Cancel</button>
      <button class="btn primary" onclick={save} disabled={!title.trim()}>Rename</button>
    </div>
  </div>
</Modal>

<style>
  label span {
    display: block;
    font-size: 11px;
    text-transform: uppercase;
    color: var(--text-muted);
    margin-bottom: 4px;
  }

  input {
    width: 100%;
    padding: 8px 10px;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 12px;
  }

  .btn {
    padding: 6px 14px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    font-size: 12px;
    background: var(--bg-surface);
  }

  .btn.primary {
    background: var(--accent-dim);
    border-color: var(--accent-dim);
    color: var(--text-primary);
  }
</style>