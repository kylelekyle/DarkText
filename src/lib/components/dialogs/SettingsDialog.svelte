<script lang="ts">
  import { open } from "@tauri-apps/plugin-dialog";
  import Modal from "../Modal.svelte";
  import { app } from "$lib/stores/app.svelte";
  import {
    defaultAppSettings,
    getAppSettings,
    saveAppSettings,
    type AppSettings,
  } from "$lib/utils/appSettings";
  import type { CompilePreset, ExportFormat } from "$lib/types";
  import { FONT_SIZES, fontSizeLabel } from "$lib/utils/typography";
  import FontFamilyPicker from "../FontFamilyPicker.svelte";

  type Tab = "general" | "editor" | "compile" | "library";

  let tab = $state<Tab>("general");
  let draft = $state<AppSettings>({ ...getAppSettings() });
  let saved = $state(false);

  const compilePresets: CompilePreset[] = ["manuscript", "ebook", "web", "custom"];
  const formats: ExportFormat[] = ["docx", "html", "markdown", "text"];

  function reset() {
    draft = { ...defaultAppSettings, firstRunComplete: true };
  }

  function save() {
    saveAppSettings(draft);
    app.applySettings(draft);
    saved = true;
    setTimeout(() => (saved = false), 2000);
  }

  async function pickLibraryFolder() {
    const selected = await open({ directory: true, multiple: false, title: "Default Library folder" });
    if (typeof selected === "string") draft.defaultLibraryFolder = selected;
  }
</script>

<Modal title="Settings" wide onClose={() => app.closeDialog()}>
  <div class="settings">
    <nav class="tabs">
      {#each [
        { id: "general", label: "General" },
        { id: "editor", label: "Editor" },
        { id: "compile", label: "Compile" },
        { id: "library", label: "Library" },
      ] as t}
        <button
          type="button"
          class="tab"
          class:active={tab === t.id}
          onclick={() => (tab = t.id as Tab)}
        >
          {t.label}
        </button>
      {/each}
    </nav>

    <div class="panel">
      {#if tab === "general"}
        <label>
          <span>Auto-save delay</span>
          <select bind:value={draft.autoSaveMs}>
            <option value={400}>Fast (400 ms)</option>
            <option value={600}>Normal (600 ms)</option>
            <option value={1000}>Relaxed (1 s)</option>
            <option value={2000}>Slow (2 s)</option>
          </select>
        </label>
        <label class="check">
          <input type="checkbox" bind:checked={draft.confirmOnClose} />
          Confirm before closing with unsaved changes
        </label>
        <label class="check">
          <input type="checkbox" bind:checked={draft.openLastOnLaunch} />
          Open last Library on startup
        </label>
        <label>
          <span>Author name (comments)</span>
          <input type="text" bind:value={draft.authorDisplayName} placeholder="Author" />
        </label>
        <label>
          <span>Reviewer name (comments)</span>
          <input type="text" bind:value={draft.reviewerDisplayName} placeholder="Editor" />
        </label>
      {:else if tab === "editor"}
        <label class="font-field">
          <span>Default font</span>
          <FontFamilyPicker
            value={draft.defaultFontFamily}
            onchange={(v) => (draft.defaultFontFamily = v)}
          />
        </label>
        <label>
          <span>Default size</span>
          <select bind:value={draft.defaultFontSize}>
            {#each FONT_SIZES as size}
              <option value={size}>{fontSizeLabel(size)} pt</option>
            {/each}
          </select>
        </label>
        <label class="check">
          <input type="checkbox" bind:checked={draft.spellcheck} />
          Spellcheck enabled by default
        </label>
      {:else if tab === "compile"}
        <label>
          <span>Default preset</span>
          <select bind:value={draft.defaultCompilePreset}>
            {#each compilePresets as p}
              <option value={p}>{p}</option>
            {/each}
          </select>
        </label>
        <label>
          <span>Default format</span>
          <select bind:value={draft.defaultCompileFormat}>
            {#each formats as f}
              <option value={f}>{f}</option>
            {/each}
          </select>
        </label>
        <label class="check">
          <input type="checkbox" bind:checked={draft.includeResearchInCompile} />
          Include Research folder in compile by default
        </label>
        <label class="check">
          <input type="checkbox" bind:checked={draft.includeCharactersInCompile} />
          Include Characters cast list in compile by default
        </label>
      {:else if tab === "library"}
        <label>
          <span>Default folder for new Libraries</span>
          <div class="path-row">
            <input type="text" placeholder="Not set" bind:value={draft.defaultLibraryFolder} readonly />
            <button type="button" class="btn" onclick={() => void pickLibraryFolder()}>Browse…</button>
          </div>
        </label>
        <p class="hint">Used as the starting location when you create a new Library.</p>
        <p class="hint">
          Editor, compile, and auto-save preferences are saved in each Library's <code>book.json</code> when a book is open — copy the folder to move your settings with your manuscript.
        </p>
        <p class="hint">
          Chapter snapshots are stored under <code>snapshots/</code> in each Library (File → Chapter snapshots).
        </p>
      {/if}
    </div>

    <div class="actions">
      {#if saved}<span class="saved-msg">Saved</span>{/if}
      <button type="button" class="btn" onclick={reset}>Reset defaults</button>
      <button type="button" class="btn" onclick={() => app.closeDialog()}>Close</button>
      <button type="button" class="btn primary" onclick={save}>Save</button>
    </div>
  </div>
</Modal>

<style>
  .settings {
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-height: 280px;
  }

  .tabs {
    display: flex;
    gap: 4px;
    border-bottom: 1px solid var(--border-subtle);
    padding-bottom: 8px;
  }

  .tab {
    padding: 6px 12px;
    font-size: 12px;
    color: var(--text-muted);
    border-radius: var(--radius-sm);
  }

  .tab:hover {
    background: var(--bg-hover);
    color: var(--text-secondary);
  }

  .tab.active {
    background: var(--accent-subtle);
    color: var(--accent-hover);
  }

  .panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  label > span {
    display: block;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    margin-bottom: 4px;
  }

  .font-field :global(.font-picker) {
    width: 100%;
    max-width: none;
  }

  .font-field :global(.trigger) {
    max-width: none;
  }

  select,
  input[type="text"] {
    width: 100%;
  }

  .check {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--text-secondary);
    cursor: pointer;
  }

  .path-row {
    display: flex;
    gap: 8px;
  }

  .path-row input {
    flex: 1;
  }

  .hint {
    font-size: 11px;
    color: var(--text-faint);
    line-height: 1.4;
  }

  .actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 4px;
  }

  .saved-msg {
    margin-right: auto;
    font-size: 11px;
    color: var(--status-final);
  }

  .btn {
    padding: 6px 14px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    font-size: 12px;
    background: var(--bg-surface);
    color: var(--text-secondary);
  }

  .btn.primary {
    background: var(--accent-subtle);
    border-color: var(--accent-dim);
    color: var(--text-primary);
  }
</style>