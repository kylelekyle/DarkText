<script lang="ts">
  import Modal from "../Modal.svelte";
  import ExportOptionsFields from "../export/ExportOptionsFields.svelte";
  import { app } from "$lib/stores/app.svelte";
  import { formatError } from "$lib/utils/errors";
  import { outputHint, presetStyleFor, type ExportPresetId } from "$lib/export/exportPresets";
  import type { ExportFormat } from "$lib/types";

  type ExportScope = "current" | "selected" | "all";

  let preset = $state<ExportPresetId>("custom");
  let format = $state<ExportFormat>("html");
  let scope = $state<ExportScope>("current");
  let combined = $state(true);
  let outputDir = $state("");
  let filename = $state("");
  let exporting = $state(false);
  let result = $state<string | null>(null);
  let error = $state<string | null>(null);
  let selectedIds = $state<Set<string>>(new Set());

  const chapters = $derived(app.library?.chapters ?? []);
  const filteredChapters = $derived(app.filteredChapters);

  const canExportCurrent = $derived(!!app.activeChapterId);

  const canExport = $derived.by(() => {
    if (scope === "selected") return selectedIds.size > 0;
    if (scope === "current") return canExportCurrent;
    return chapters.length > 0;
  });

  $effect(() => {
    if (scope === "current" && !canExportCurrent) {
      scope = chapters.length > 0 ? "all" : "selected";
    }
  });

  const defaultFilename = $derived.by(() => {
    if (scope === "current" && app.activeChapterMeta) {
      return `${app.activeChapterMeta.title}.${format}`;
    }
    const title = app.bookSettings.title.trim() || app.library?.name || "export";
    return combined ? `${title}.${format}` : `${title}-chapters`;
  });

  const hint = $derived(outputHint(app.library?.path, outputDir));

  function toggleChapter(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selectedIds = next;
  }

  function selectAll() {
    selectedIds = new Set(chapters.map((c) => c.id));
  }

  function exportSection(): import("$lib/types").ChapterSection {
    if (scope === "current") return app.activeSection;
    return "chapters";
  }

  function chapterIdsForExport(): string[] {
    if (scope === "current" && app.activeChapterId) return [app.activeChapterId];
    if (scope === "selected") return [...selectedIds];
    return chapters.map((c) => c.id);
  }

  async function exportIt() {
    const ids = chapterIdsForExport();
    if (ids.length === 0) {
      error = "No chapters selected";
      return;
    }
    exporting = true;
    error = null;
    result = null;
    try {
      const name = filename.trim() || defaultFilename;
      const dir = outputDir.trim() || undefined;
      const style = presetStyleFor(preset);
      const res = await app.exportChapters(
        ids,
        format,
        combined,
        dir,
        name,
        style,
        exportSection(),
      );
      result = res.path;
      if (res.preview && ids.length > 1 && !combined) {
        result += ` (${res.preview})`;
      }
      app.showToast("Export complete");
    } catch (e) {
      error = formatError(e);
    } finally {
      exporting = false;
    }
  }
</script>

<Modal title="Export as…" wide onClose={() => app.closeDialog()}>
  <div class="form">
    <p class="hint">
      Export to <code>{hint}</code>
    </p>

    <ExportOptionsFields
      {preset}
      {format}
      {outputDir}
      {filename}
      {defaultFilename}
      libraryPath={app.library?.path}
      onPresetChange={(p) => (preset = p)}
      onFormatChange={(f) => (format = f)}
      onOutputDirChange={(d) => (outputDir = d)}
      onFilenameChange={(n) => (filename = n)}
    />

    <fieldset class="scope">
      <legend>Scope</legend>
      <label class="radio">
        <input type="radio" bind:group={scope} value="current" disabled={!canExportCurrent} />
        Current chapter
        {#if app.activeChapterMeta}
          <span class="sub">({app.activeChapterMeta.title})</span>
        {/if}
      </label>
      <label class="radio">
        <input type="radio" bind:group={scope} value="selected" />
        Selected chapters
      </label>
      <label class="radio">
        <input type="radio" bind:group={scope} value="all" />
        All chapters ({chapters.length})
      </label>
    </fieldset>

    {#if scope === "selected"}
      <div class="chapter-pick">
        <div class="pick-header">
          <span class="label">Chapters</span>
          <button type="button" class="link-btn" onclick={selectAll}>Select all</button>
        </div>
        <ul>
          {#each filteredChapters as ch (ch.id)}
            <li>
              <label>
                <input
                  type="checkbox"
                  checked={selectedIds.has(ch.id)}
                  onchange={() => toggleChapter(ch.id)}
                />
                {ch.title}
              </label>
            </li>
          {/each}
        </ul>
      </div>
    {/if}

    {#if scope !== "current"}
      <label class="combine">
        <input type="checkbox" bind:checked={combined} />
        Combine into single file
      </label>
    {/if}

    {#if error}<p class="error">{error}</p>{/if}
    {#if result}<p class="success">{result}</p>{/if}

    <div class="actions">
      <button class="btn" onclick={() => app.closeDialog()}>Close</button>
      <button class="btn primary" disabled={exporting || !canExport} onclick={() => void exportIt()}>
        {exporting ? "Exporting…" : "Export"}
      </button>
    </div>
  </div>
</Modal>

<style>
  .hint {
    font-size: 12px;
    color: var(--text-secondary);
    margin-bottom: 12px;
  }

  .hint code {
    font-size: 11px;
    color: var(--text-muted);
  }

  .label {
    font-size: 10px;
    text-transform: uppercase;
    color: var(--text-muted);
    display: block;
    margin-bottom: 6px;
  }

  .scope {
    border: none;
    margin-bottom: 12px;
    padding: 0;
  }

  .scope legend {
    font-size: 11px;
    text-transform: uppercase;
    color: var(--text-muted);
    margin-bottom: 6px;
  }

  .radio {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--text-secondary);
    padding: 4px 0;
    cursor: pointer;
  }

  .sub {
    color: var(--text-muted);
    font-size: 11px;
  }

  .chapter-pick {
    margin-bottom: 12px;
    max-height: 120px;
    overflow-y: auto;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius);
    padding: 8px;
  }

  .pick-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 6px;
  }

  .link-btn {
    font-size: 10px;
    color: var(--accent);
  }

  .chapter-pick ul {
    list-style: none;
  }

  .chapter-pick li label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    padding: 2px 0;
    color: var(--text-secondary);
    cursor: pointer;
  }

  .combine {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--text-secondary);
    margin-bottom: 12px;
    cursor: pointer;
  }

  .error {
    color: var(--danger);
    font-size: 12px;
  }

  .success {
    color: var(--status-final);
    font-size: 11px;
    word-break: break-all;
    margin-top: 8px;
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