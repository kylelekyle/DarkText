<script lang="ts">
  import { onMount } from "svelte";
  import Modal from "../Modal.svelte";
  import CompileChapterOrganizer from "../compile/CompileChapterOrganizer.svelte";
  import CompileOutputFields from "../compile/CompileOutputFields.svelte";
  import { app } from "$lib/stores/app.svelte";
  import { formatError } from "$lib/utils/errors";
  import { outputHint } from "$lib/export/exportPresets";
  import { mergeFinalChapterOrder } from "$lib/utils/compileUtils";
  import type { CompileOptions, ExportFormat } from "$lib/types";

  let format = $state<ExportFormat>(app.settings.defaultCompileFormat);
  let outputDir = $state("");
  let filename = $state("");
  let compiling = $state(false);
  let result = $state<string | null>(null);
  let error = $state<string | null>(null);

  const chapters = $derived(app.finalChapters);

  const defaultFilename = $derived.by(() => {
    const title = app.bookSettings.title.trim();
    const base = title || app.library?.name || "book";
    return `${base}.${format}`;
  });

  const hint = $derived(outputHint(app.library?.path, outputDir));

  function buildOptions(): CompileOptions {
    const name = filename.trim() || defaultFilename;
    return {
      format,
      filename: name,
      outputDir: outputDir.trim() || undefined,
      style: "default",
    };
  }

  function handleChapterReorder(reorderedFinalIds: string[]) {
    const full = app.library?.chapters ?? [];
    const merged = mergeFinalChapterOrder(full, chapters, reorderedFinalIds);
    if (!merged) return;
    app.reorderChapters(merged.map((c) => c.id));
  }

  onMount(() => {
    const requested = app.compileFormat;
    if (requested) {
      format = requested;
      app.compileFormat = null;
    }
  });

  async function compile() {
    compiling = true;
    error = null;
    result = null;
    try {
      const res = await app.compileBook(buildOptions());
      result = res.path;
      app.showToast("Book compiled");
    } catch (e) {
      error = formatError(e);
    } finally {
      compiling = false;
    }
  }
</script>

<Modal title="Compile Book" wide onClose={() => app.closeDialog()}>
  <div class="compile">
    <p class="dest-hint">
      Saves to <code>{hint}</code>
    </p>

    <CompileChapterOrganizer {chapters} onSave={handleChapterReorder} />

    <CompileOutputFields
      {format}
      {outputDir}
      {filename}
      {defaultFilename}
      libraryPath={app.library?.path}
      onFormatChange={(f) => (format = f)}
      onOutputDirChange={(d) => (outputDir = d)}
      onFilenameChange={(n) => (filename = n)}
    />

    {#if error}<p class="error">{error}</p>{/if}
    {#if result}<p class="success">Saved: {result}</p>{/if}

    <div class="actions">
      <button class="btn" onclick={() => app.closeDialog()}>Close</button>
      <button
        class="btn primary"
        disabled={compiling || chapters.length === 0}
        onclick={() => void compile()}
      >
        {compiling ? "Exporting…" : "Export"}
      </button>
    </div>
  </div>
</Modal>

<style>
  .dest-hint {
    font-size: 12px;
    color: var(--text-secondary);
    margin-bottom: 12px;
  }

  .dest-hint code {
    font-size: 11px;
    color: var(--text-muted);
  }

  .error {
    color: var(--danger);
    font-size: 12px;
    margin-top: 8px;
  }

  .success {
    color: var(--status-final);
    font-size: 11px;
    margin-top: 8px;
    word-break: break-all;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 16px;
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
    opacity: 0.5;
  }
</style>