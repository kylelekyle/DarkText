<script lang="ts">
  import Modal from "../Modal.svelte";
  import { app } from "$lib/stores/app.svelte";
  import * as api from "$lib/api";
  import { formatError } from "$lib/utils/errors";

  let busy = $state<string | null>(null);
  let result = $state<string | null>(null);
  let error = $state<string | null>(null);

  async function exportClean() {
    if (!app.library) return;
    app.compileFormat = "docx";
    app.closeDialog();
    app.openDialog("compile");
  }

  async function exportMarkedHtml() {
    if (!app.library) return;
    busy = "marked-html";
    error = null;
    result = null;
    try {
      const res = await api.exportMarkedManuscript(app.library.path);
      result = res.path;
      app.showToast("Marked HTML exported");
    } catch (e) {
      error = formatError(e);
    } finally {
      busy = null;
    }
  }

  async function exportMarkedDocx() {
    if (!app.library) return;
    busy = "marked-docx";
    error = null;
    result = null;
    try {
      const { exportMarkedManuscriptAsDocx } = await import("$lib/export/markedDocxExport");
      const res = await exportMarkedManuscriptAsDocx(
        app.library.path,
        app.bookSettings,
        app.settings.reviewerDisplayName || "Editor",
      );
      result = res.path;
      app.showToast("Marked Word document exported");
    } catch (e) {
      error = formatError(e);
    } finally {
      busy = null;
    }
  }

  async function exportReport() {
    if (!app.library) return;
    busy = "report";
    error = null;
    result = null;
    try {
      const res = await api.exportCommentsReport(app.library.path);
      result = res.path;
      app.showToast("Comments report exported");
    } catch (e) {
      error = formatError(e);
    } finally {
      busy = null;
    }
  }
</script>

<Modal title="Editor Handoff" wide onClose={() => app.closeDialog()}>
  <div class="handoff">
    <p class="lead">
      Choose how to share your manuscript with an editor. Standard compile/export produces a
      <strong>clean</strong> file — all review marks are removed for publisher-ready output.
    </p>

    <section class="option">
      <h3>Clean manuscript (recommended for publishers)</h3>
      <p>Final chapters → Word (.docx) with no comments or track-changes markup.</p>
      <button class="btn primary" onclick={() => void exportClean()}>Open Compile as Word…</button>
    </section>

    <section class="option">
      <h3>Marked Word for review (recommended for editors)</h3>
      <p>
        All chapters as a .docx with Word Track Changes — insertions, deletions, and comment
        balloons editors can accept or reject in Microsoft Word.
      </p>
      <button class="btn" disabled={busy !== null} onclick={() => void exportMarkedDocx()}>
        {busy === "marked-docx" ? "Exporting…" : "Export marked Word (.docx)"}
      </button>
    </section>

    <section class="option">
      <h3>Marked HTML for review</h3>
      <p>
        Same markup as visible highlights in a browser-friendly HTML file — useful when your
        editor does not use Word.
      </p>
      <button class="btn" disabled={busy !== null} onclick={() => void exportMarkedHtml()}>
        {busy === "marked-html" ? "Exporting…" : "Export marked HTML"}
      </button>
    </section>

    <section class="option">
      <h3>Comments-only report</h3>
      <p>Markdown file listing every open comment thread and pending change, grouped by chapter.</p>
      <button class="btn" disabled={busy !== null} onclick={() => void exportReport()}>
        {busy === "report" ? "Exporting…" : "Export comments report"}
      </button>
    </section>

    <p class="note">
      Marked Word uses native Track Changes and comment balloons. Round-trip editing in DarkText
      after an editor returns a Word file is not supported — use clean compile for final delivery.
    </p>

    {#if error}<p class="error">{error}</p>{/if}
    {#if result}<p class="success">Saved: {result}</p>{/if}
  </div>
</Modal>

<style>
  .lead {
    font-size: 13px;
    color: var(--text-secondary);
    line-height: 1.55;
    margin-bottom: 16px;
  }

  .option {
    margin-bottom: 16px;
    padding-bottom: 14px;
    border-bottom: 1px solid var(--border-subtle);
  }

  .option h3 {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary);
    margin-bottom: 4px;
  }

  .option p {
    font-size: 12px;
    color: var(--text-muted);
    line-height: 1.5;
    margin-bottom: 8px;
  }

  .note {
    font-size: 11px;
    color: var(--text-faint);
    line-height: 1.5;
    margin-top: 8px;
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
</style>