<script lang="ts">
  import { open } from "@tauri-apps/plugin-dialog";
  import {
    EXPORT_FORMATS,
    EXPORT_PRESETS,
    applyExportPreset,
    type ExportPresetId,
  } from "$lib/export/exportPresets";
  import type { ExportFormat } from "$lib/types";

  interface Props {
    preset: ExportPresetId;
    format: ExportFormat;
    outputDir: string;
    filename: string;
    defaultFilename: string;
    libraryPath?: string;
    onPresetChange: (preset: ExportPresetId) => void;
    onFormatChange: (format: ExportFormat) => void;
    onOutputDirChange: (dir: string) => void;
    onFilenameChange: (name: string) => void;
  }

  let {
    preset,
    format,
    outputDir,
    filename,
    defaultFilename,
    libraryPath,
    onPresetChange,
    onFormatChange,
    onOutputDirChange,
    onFilenameChange,
  }: Props = $props();

  function applyPreset(p: ExportPresetId) {
    onPresetChange(p);
    if (p !== "custom") {
      const next = applyExportPreset(p);
      onFormatChange(next.format);
    }
  }

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

<div class="presets">
  <span class="label">Preset</span>
  <div class="preset-grid">
    {#each EXPORT_PRESETS as p (p.value)}
      <button
        type="button"
        class="preset-btn"
        class:active={preset === p.value}
        onclick={() => applyPreset(p.value)}
      >
        <span class="preset-label">{p.label}</span>
        <span class="preset-desc">{p.desc}</span>
      </button>
    {/each}
  </div>
</div>

<label>
  <span>Format</span>
  <select
    value={format}
    onchange={(e) => {
      onFormatChange((e.currentTarget as HTMLSelectElement).value as ExportFormat);
      onPresetChange("custom");
    }}
    disabled={preset !== "custom"}
  >
    {#each EXPORT_FORMATS as f (f.value)}
      <option value={f.value}>{f.label}{f.note ? ` (${f.note})` : ""}</option>
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
  <span>Output folder</span>
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
  .presets {
    margin-bottom: 12px;
  }

  .label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    display: block;
    margin-bottom: 6px;
  }

  .preset-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }

  .preset-btn {
    text-align: left;
    padding: 8px 10px;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius);
    background: var(--bg-surface);
    cursor: pointer;
    transition: border-color var(--transition-fast), background var(--transition-fast);
  }

  .preset-btn:active {
    transform: none;
  }

  .preset-btn:hover {
    border-color: var(--border);
    background: var(--bg-hover);
  }

  .preset-btn.active {
    border-color: var(--accent-dim);
    background: var(--accent-subtle);
  }

  .preset-label {
    display: block;
    font-size: 11px;
    color: var(--text-primary);
    margin-bottom: 2px;
  }

  .preset-desc {
    font-size: 10px;
    color: var(--text-muted);
  }

  label > span {
    display: block;
    font-size: 11px;
    text-transform: uppercase;
    color: var(--text-muted);
    margin-bottom: 4px;
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