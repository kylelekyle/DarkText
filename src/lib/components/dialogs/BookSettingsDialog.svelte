<script lang="ts">
  import Modal from "../Modal.svelte";
  import { app } from "$lib/stores/app.svelte";

  let title = $state(app.bookSettings.title);
  let author = $state(app.bookSettings.author);
  let includeFrontMatter = $state(app.bookSettings.includeFrontMatter);
  let includeBackMatter = $state(app.bookSettings.includeBackMatter);
  let wordGoal = $state(app.bookSettings.wordGoal ? String(app.bookSettings.wordGoal) : "");

  const presets = [
    { label: "50k", value: 50000 },
    { label: "80k", value: 80000 },
    { label: "100k", value: 100000 },
  ];

  async function save() {
    const parsed = parseInt(wordGoal.replace(/,/g, ""), 10);
    await app.saveBookSettings({
      title,
      author,
      includeFrontMatter,
      includeBackMatter,
      wordGoal: Number.isFinite(parsed) && parsed > 0 ? parsed : 0,
    });
    app.closeDialog();
  }
</script>

<Modal title="Book Settings" onClose={() => app.closeDialog()}>
  <div class="form">
    <label>
      <span>Title</span>
      <input type="text" bind:value={title} placeholder="Book title" />
    </label>
    <label>
      <span>Author</span>
      <input type="text" bind:value={author} placeholder="Author name" />
    </label>
    <label>
      <span>Word goal</span>
      <div class="goal-row">
        <input
          type="text"
          inputmode="numeric"
          bind:value={wordGoal}
          placeholder="No goal"
        />
        <div class="presets">
          {#each presets as preset (preset.value)}
            <button
              type="button"
              class="preset-btn"
              onclick={() => (wordGoal = String(preset.value))}
            >
              {preset.label}
            </button>
          {/each}
        </div>
      </div>
      <p class="hint">Shown in the status bar and sidebar. Leave empty for no goal.</p>
    </label>
    <label class="check">
      <input type="checkbox" bind:checked={includeFrontMatter} />
      <span>Include front matter (title page)</span>
    </label>
    <label class="check">
      <input type="checkbox" bind:checked={includeBackMatter} />
      <span>Include back matter</span>
    </label>
    <div class="actions">
      <button class="btn" onclick={() => app.closeDialog()}>Cancel</button>
      <button class="btn primary" onclick={() => void save()}>Save</button>
    </div>
  </div>
</Modal>

<style>
  .form {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  label span {
    display: block;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    margin-bottom: 4px;
  }

  label input[type="text"] {
    width: 100%;
    padding: 8px 10px;
  }

  .goal-row {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .presets {
    display: flex;
    gap: 4px;
  }

  .preset-btn {
    padding: 3px 8px;
    font-size: 10px;
    color: var(--text-muted);
    border: 1px solid var(--border-subtle);
    border-radius: 4px;
    background: var(--bg-surface);
  }

  .preset-btn:hover {
    color: var(--accent-hover);
    border-color: var(--accent-dim);
    background: var(--accent-subtle);
  }

  .hint {
    font-size: 10px;
    color: var(--text-faint);
    margin-top: 4px;
    font-style: italic;
  }

  .check {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--text-secondary);
  }

  .check span {
    margin: 0;
    text-transform: none;
    letter-spacing: normal;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 8px;
  }

  .btn {
    padding: 6px 14px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    font-size: 12px;
    color: var(--text-secondary);
    background: var(--bg-surface);
  }

  .btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .btn.primary {
    border-color: var(--accent-dim);
    background: var(--accent-dim);
    color: var(--text-primary);
  }
</style>