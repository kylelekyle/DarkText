<script lang="ts">
  interface Props {
    onChoose: (type: "portable" | "install") => void;
  }

  let { onChoose }: Props = $props();
</script>

<div class="first-run-overlay">
  <div class="first-run-card">
    <div class="first-run-icon" aria-hidden="true">◇</div>
    <h2>Welcome to DarkText</h2>
    <p>Your writing lives in portable Library folders — plain HTML, fully offline.</p>
    <div class="first-run-options">
      <button class="option" onclick={() => onChoose("portable")}>
        <span class="option-title">Portable</span>
        <span class="option-desc">Pick any folder (USB, cloud sync) — no default path pinned</span>
      </button>
      <button class="option" onclick={() => onChoose("install")}>
        <span class="option-title">Installed</span>
        <span class="option-desc">New libraries default to Documents/DarkText on this PC</span>
      </button>
    </div>
  </div>
</div>

<style>
  .first-run-overlay {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.55);
    backdrop-filter: blur(4px);
  }

  .first-run-card {
    max-width: 420px;
    padding: 28px;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    text-align: center;
  }

  .first-run-icon {
    font-size: 28px;
    color: var(--accent-hover);
    margin-bottom: 12px;
  }

  .first-run-card h2 {
    font-size: 20px;
    font-weight: 500;
    margin-bottom: 8px;
  }

  .first-run-card p {
    font-size: 13px;
    color: var(--text-secondary);
    line-height: 1.5;
    margin-bottom: 20px;
  }

  .first-run-options {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .option {
    text-align: left;
    padding: 14px 16px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--bg-surface);
    cursor: pointer;
    transition: border-color var(--transition-smooth);
  }

  .option:hover {
    border-color: var(--accent-dim);
  }

  .option-title {
    display: block;
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
  }

  .option-desc {
    display: block;
    font-size: 12px;
    color: var(--text-muted);
    margin-top: 4px;
    line-height: 1.4;
  }
</style>