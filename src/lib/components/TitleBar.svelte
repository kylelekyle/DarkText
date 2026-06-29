<script lang="ts">
  import { onMount } from "svelte";
  import { isTauriApp, requestAppClose } from "$lib/utils/platform";

  let maximized = $state(false);

  onMount(async () => {
    if (!isTauriApp()) return;
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      maximized = await getCurrentWindow().isMaximized();
    } catch {
      maximized = false;
    }
  });

  async function withWindow(fn: (win: import("@tauri-apps/api/window").Window) => Promise<void>) {
    if (!isTauriApp()) return;
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await fn(getCurrentWindow());
  }

  async function minimize() {
    await withWindow((w) => w.minimize());
  }

  async function toggleMaximize() {
    await withWindow(async (w) => {
      await w.toggleMaximize();
      maximized = await w.isMaximized();
    });
  }
</script>

<header class="titlebar">
  <div class="drag-region" data-tauri-drag-region>
    <span class="app-icon" aria-hidden="true"></span>
    <span class="app-title">DarkText</span>
  </div>
  <div class="window-controls">
    <button class="win-btn" title="Minimize" onclick={() => void minimize()}>─</button>
    <button class="win-btn" title={maximized ? "Restore" : "Maximize"} onclick={() => void toggleMaximize()}>
      {maximized ? "❐" : "□"}
    </button>
    <button class="win-btn close" title="Close" onclick={() => void requestAppClose()}>×</button>
  </div>
</header>

<style>
  .titlebar {
    display: flex;
    align-items: stretch;
    height: var(--titlebar-height);
    background: var(--bg-chrome);
    border-bottom: 1px solid var(--border-subtle);
    flex-shrink: 0;
    user-select: none;
  }

  .drag-region {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    padding-left: 12px;
    min-width: 0;
  }

  .app-icon {
    width: 14px;
    height: 14px;
    border-radius: 4px;
    background: linear-gradient(135deg, var(--accent) 0%, #8a7040 100%);
    opacity: 0.9;
    flex-shrink: 0;
    box-shadow: 0 1px 6px rgba(201, 165, 92, 0.2);
  }

  .app-title {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-muted);
    letter-spacing: 0.02em;
  }

  .window-controls {
    display: flex;
    align-items: stretch;
    flex-shrink: 0;
  }

  .win-btn {
    width: 46px;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    color: var(--text-muted);
    transition: background var(--transition-fast), color var(--transition-fast);
  }

  .win-btn:hover {
    background: var(--bg-hover);
    color: var(--text-secondary);
  }

  .win-btn.close:hover {
    background: #c42b1c;
    color: #fff;
  }
</style>