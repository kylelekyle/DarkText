<script lang="ts">
  import { open } from "@tauri-apps/plugin-dialog";
  import { COMPILE_FORMATS } from "$lib/export/exportPresets";
  import type { ExportFormat } from "$lib/types";

  interface Props {
    format: ExportFormat;
    outputDir: string;
    filename: string;
    defaultFilename: string;
    libraryPath?: string;
    onFormatChange: (format: ExportFormat) => void;
    onOutputDirChange: (dir: string) => void;
    onFilenameChange: (name: string) => void;
  }

  let {
    format,
    outputDir,
    filename,
    defaultFilename,
    libraryPath,
    onFormatChange,
    onOutputDirChange,
    onFilenameChange,
  }: Props = $props();

  async function pickOutputDir() {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Choose output folder",
      defaultPath: libraryPath,
    });
    if (typeof selected === "string") onOutputDirChange(selected);
  }
</script>

<label>
  <span>Export as</span>
  <select
    value={format}
    onchange={(e) => onFormatChange((e.currentTarget as HTMLSelectElement).value as ExportFormat)}
  >
    {#each COMPILE_FORMATS as f (f.value)}
      <option value={f.value}>{f.label}</option>
    {/each}
  </select>
</label>

<label>
  <span>Filename</span>
  <input
    type="text"
    value={filename}
    placeholder={defaultFilename}
    oninput={(e) => onFilenameChange((e.currentTarget as HTMLInputElement).value)}
  />
</label>

<label>
  <span>Output folder <span class="optional">(optional)</span></span>
  <div class="path-row">
    <input
      type="text"
      placeholder="Library/exports (default)"
      value={outputDir}
      oninput={(e) => onOutputDirChange((e.currentTarget as HTMLInputElement).value)}
    />
    <button type="button" class="btn" onclick={() => void pickOutputDir()}>Browse…</button>
  </div>
</label>

<style>
  label {
    display: block;
    margin-bottom: 12px;
  }

  label > span {
    display: block;
    font-size: 11px;
    text-transform: uppercase;
    color: var(--text-muted);
    margin-bottom: 4px;
  }

  .optional {
    text-transform: none;
    font-size: 10px;
    color: var(--text-faint);
  }

  select,
  input[type="text"] {
    width: 100%;
    padding: 8px 10px;
  }

  .path-row {
    display: flex;
    gap: 8px;
  }

  .path-row input {
    flex: 1;
  }

  .btn {
    padding: 6px 14px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    font-size: 12px;
    background: var(--bg-surface);
    color: var(--text-secondary);
    white-space: nowrap;
  }
</style>