<script lang="ts">
  import { onMount } from "svelte";
  import { open } from "@tauri-apps/plugin-dialog";
  import { documentDir, join } from "@tauri-apps/api/path";
  import { app } from "$lib/stores/app.svelte";
  import { formatError } from "$lib/utils/errors";
  import { getAppSettings } from "$lib/utils/appSettings";
  import WelcomeFirstRun from "./welcome/WelcomeFirstRun.svelte";
  import WelcomeRecentList from "./welcome/WelcomeRecentList.svelte";
  import WelcomeLibraryContextMenu from "./welcome/WelcomeLibraryContextMenu.svelte";
  import WelcomeDeleteLibraryDialog from "./welcome/WelcomeDeleteLibraryDialog.svelte";
  import * as api from "$lib/api/library";
  import {
    getPrefs,
    refreshRecentLibraries,
    removeRecentLibrary,
    savePrefs,
    type AppPrefs,
  } from "$lib/utils/recentLibraries";
  import { clearWorkspaceSessionForLibrary } from "$lib/utils/workspaceSession";

  let libraryName = $state("");
  let loading = $state(false);
  let localError = $state<string | null>(null);
  let recent = $state<string[]>([]);
  let lastLibrary = $state<string | null>(null);
  let showFirstRun = $state(false);
  let prefs = $state<AppPrefs>(getPrefs());
  let removeTarget = $state<string | null>(null);
  let removingLibrary = $state(false);
  let libraryContextMenu = $state<{ path: string; x: number; y: number } | null>(null);

  function openLibraryContextMenu(e: MouseEvent, path: string) {
    e.preventDefault();
    if (loading) return;
    libraryContextMenu = { path, x: e.clientX, y: e.clientY };
  }

  function closeLibraryContextMenu() {
    libraryContextMenu = null;
  }

  onMount(() => {
    void (async () => {
      prefs = getPrefs();
      showFirstRun = !prefs.firstRunComplete;
      recent = await refreshRecentLibraries();
      lastLibrary = recent[0] ?? null;

      if (prefs.openLastOnLaunch && lastLibrary) {
        void handleOpenLibrary(lastLibrary, true);
      }
    })();
  });

  async function completeFirstRun(type: "portable" | "install") {
    prefs = { ...prefs, installType: type, firstRunComplete: true };
    savePrefs(prefs);
    const settings = getAppSettings();
    const next = {
      ...settings,
      installType: type,
      firstRunComplete: true,
      openLastOnLaunch: type === "install" ? settings.openLastOnLaunch : false,
    };
    if (type === "install") {
      try {
        const docs = await documentDir();
        next.defaultLibraryFolder = await join(docs, "DarkText");
      } catch {
        /* path API unavailable */
      }
    } else {
      next.defaultLibraryFolder = "";
    }
    app.applySettings(next);
    showFirstRun = false;
  }

  function toggleOpenLast() {
    prefs = { ...prefs, openLastOnLaunch: !prefs.openLastOnLaunch };
    savePrefs(prefs);
  }

  function libraryLabel(path: string): string {
    return path.split(/[/\\]/).pop() || path;
  }

  async function handleCreateLibrary() {
    localError = null;
    const settings = getAppSettings();
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Choose folder for new Library",
      defaultPath: settings.defaultLibraryFolder || undefined,
    });
    if (!selected || typeof selected !== "string") return;

    const name = libraryName.trim() || selected.split(/[/\\]/).pop() || "My Library";
    loading = true;
    try {
      await app.createLibrary(selected, name);
    } catch (e) {
      localError = formatError(e);
    } finally {
      loading = false;
    }
  }

  async function handleOpenLibrary(path?: string, silent = false) {
    if (!silent) localError = null;
    let selected = path;
    if (!selected) {
      const picked = await open({
        directory: true,
        multiple: false,
        title: "Open Library",
      });
      if (!picked || typeof picked !== "string") return;
      selected = picked;
    }

    loading = true;
    try {
      await app.openLibrary(selected);
    } catch (e) {
      const msg = formatError(e);
      if (silent) {
        removeRecentLibrary(selected);
        recent = await refreshRecentLibraries();
        lastLibrary = recent[0] ?? null;
        app.showToast(`Could not open last library: ${msg}`);
      } else {
        localError = msg;
      }
    } finally {
      loading = false;
    }
  }

  function requestRemoveLibrary(path: string) {
    removeTarget = path;
  }

  function cancelRemoveLibrary() {
    if (removingLibrary) return;
    removeTarget = null;
  }

  async function confirmRemoveLibrary(removeFromDisk: boolean) {
    if (!removeTarget) return;
    const path = removeTarget;
    removingLibrary = true;
    localError = null;
    try {
      if (removeFromDisk) {
        await api.trashLibraryFolder(path);
      }
      removeRecentLibrary(path);
      clearWorkspaceSessionForLibrary(path);
      recent = await refreshRecentLibraries();
      lastLibrary = recent[0] ?? null;
      removeTarget = null;
      app.showToast(
        removeFromDisk
          ? "Library moved to Recycle Bin"
          : "Removed from recent libraries",
      );
    } catch (e) {
      localError = formatError(e);
    } finally {
      removingLibrary = false;
    }
  }

  async function handleNewChapter() {
    localError = null;
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Choose Library folder for new Chapter",
    });
    if (!selected || typeof selected !== "string") return;

    loading = true;
    try {
      try {
        await app.openLibrary(selected);
      } catch {
        const libName = selected.split(/[/\\]/).pop() || "Library";
        await app.createLibrary(selected, libName);
      }
      await app.newChapter();
    } catch (e) {
      localError = formatError(e);
    } finally {
      loading = false;
    }
  }
</script>

<svelte:window onclick={closeLibraryContextMenu} />

<div class="welcome">
  <div class="bg-grid" aria-hidden="true"></div>
  <div class="bg-glow" aria-hidden="true"></div>

  {#if showFirstRun}
    <WelcomeFirstRun onChoose={(type) => void completeFirstRun(type)} />
  {/if}

  <div class="welcome-layout">
    <section class="welcome-hero">
      <div class="brand">
        <span class="brand-mark" aria-hidden="true"></span>
        <h1>DarkText</h1>
      </div>
      <p class="tagline">A calm, focused space for long-form writing.</p>

      {#if lastLibrary && !loading}
        <button
          class="continue-btn"
          onclick={() => handleOpenLibrary(lastLibrary!)}
          oncontextmenu={(e) => openLibraryContextMenu(e, lastLibrary!)}
          disabled={loading}
        >
          <span class="continue-label">Continue writing</span>
          <span class="continue-lib">{libraryLabel(lastLibrary)}</span>
        </button>
      {/if}

      <label class="launch-pref">
        <input
          type="checkbox"
          checked={prefs.openLastOnLaunch}
          onchange={toggleOpenLast}
        />
        Open last Library on startup
      </label>
    </section>

    <section class="welcome-actions">
      <div class="action-cards">
        <button class="action-card primary" onclick={handleCreateLibrary} disabled={loading}>
          <span class="card-icon" aria-hidden="true">+</span>
          <span class="card-title">Create new Library</span>
          <span class="card-desc">Start a fresh book in any folder</span>
        </button>
        <button class="action-card" onclick={() => handleOpenLibrary()} disabled={loading}>
          <span class="card-icon" aria-hidden="true">◎</span>
          <span class="card-title">Open existing Library</span>
          <span class="card-desc">Pick a folder with library.json</span>
        </button>
      </div>

      <div class="name-row">
        <label for="lib-name">Name for new Library</label>
        <input
          id="lib-name"
          type="text"
          placeholder="My Novel"
          bind:value={libraryName}
        />
      </div>

      <button class="quick-link" onclick={handleNewChapter} disabled={loading}>
        Jump in with a new Chapter →
      </button>

      <WelcomeRecentList
        {recent}
        {loading}
        {libraryLabel}
        onOpen={(path) => void handleOpenLibrary(path)}
        onRequestRemove={requestRemoveLibrary}
        onContextMenu={openLibraryContextMenu}
      />

      {#if libraryContextMenu}
        <WelcomeLibraryContextMenu
          path={libraryContextMenu.path}
          x={libraryContextMenu.x}
          y={libraryContextMenu.y}
          onOpen={(path) => void handleOpenLibrary(path)}
          onRequestRemove={requestRemoveLibrary}
          onClose={closeLibraryContextMenu}
        />
      {/if}

      {#if removeTarget}
        <WelcomeDeleteLibraryDialog
          libraryName={libraryLabel(removeTarget)}
          libraryPath={removeTarget}
          removing={removingLibrary}
          onClose={cancelRemoveLibrary}
          onConfirm={(removeFromDisk) => void confirmRemoveLibrary(removeFromDisk)}
        />
      {/if}

      {#if localError || app.error}
        <p class="error">{localError || app.error}</p>
      {/if}
    </section>
  </div>

  <footer class="welcome-footer">
    Offline · Portable · Plain HTML chapters
  </footer>
</div>

<style>
  .welcome {
    position: relative;
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    background: var(--bg-deep);
    overflow: hidden;
  }

  .bg-grid {
    position: absolute;
    inset: 0;
    background-image: radial-gradient(circle, rgba(201, 165, 92, 0.035) 1px, transparent 1px);
    background-size: 24px 24px;
    mask-image: radial-gradient(ellipse 80% 70% at 50% 40%, black 15%, transparent 75%);
    pointer-events: none;
  }

  .bg-glow {
    position: absolute;
    top: -20%;
    left: 50%;
    transform: translateX(-50%);
    width: 600px;
    height: 400px;
    background: radial-gradient(ellipse, rgba(201, 165, 92, 0.05) 0%, transparent 70%);
    pointer-events: none;
  }

  .welcome-layout {
    position: relative;
    flex: 1;
    display: grid;
    grid-template-columns: 1fr 1.1fr;
    gap: 48px;
    max-width: 920px;
    width: 100%;
    margin: 0 auto;
    padding: 64px 40px 32px;
    align-items: start;
  }

  .welcome-hero {
    padding-top: 24px;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 12px;
  }

  .brand-mark {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: linear-gradient(135deg, var(--accent) 0%, #8a7040 100%);
    box-shadow: 0 4px 20px rgba(201, 165, 92, 0.18);
  }

  .brand h1 {
    font-size: 28px;
    font-weight: 500;
    letter-spacing: -0.02em;
    color: var(--text-primary);
  }

  .tagline {
    font-size: 15px;
    color: var(--text-muted);
    line-height: 1.6;
    margin-bottom: 32px;
    max-width: 280px;
  }

  .continue-btn {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    width: 100%;
    max-width: 300px;
    padding: 16px 20px;
    margin-bottom: 16px;
    background: var(--accent-subtle);
    border: 1px solid var(--accent-dim);
    border-radius: var(--radius);
    text-align: left;
  }

  .continue-btn:hover:not(:disabled) {
    background: rgba(201, 165, 92, 0.14);
    border-color: var(--accent);
  }

  .continue-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--accent-hover);
    font-weight: 600;
  }

  .continue-lib {
    font-size: 16px;
    font-weight: 500;
    color: var(--text-primary);
  }

  .launch-pref {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--text-muted);
    cursor: pointer;
  }

  .launch-pref input {
    accent-color: var(--accent);
    width: 14px;
    height: 14px;
  }

  .welcome-actions {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .action-cards {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .action-card {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    padding: 20px;
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    text-align: left;
    min-height: 120px;
    transition: border-color var(--transition-normal), background var(--transition-normal),
      transform var(--transition-fast);
  }

  .action-card:hover:not(:disabled) {
    border-color: var(--text-faint);
    background: var(--bg-elevated);
    transform: translateY(-1px);
  }

  .action-card.primary {
    border-color: rgba(201, 165, 92, 0.22);
    background: linear-gradient(160deg, rgba(201, 165, 92, 0.06) 0%, var(--bg-surface) 60%);
  }

  .action-card.primary:hover:not(:disabled) {
    border-color: var(--accent-dim);
    background: linear-gradient(160deg, rgba(201, 165, 92, 0.1) 0%, var(--bg-elevated) 60%);
  }

  .card-icon {
    font-size: 22px;
    color: var(--accent);
    line-height: 1;
  }

  .card-title {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
  }

  .card-desc {
    font-size: 12px;
    color: var(--text-muted);
    line-height: 1.4;
  }

  .name-row label {
    display: block;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-faint);
    margin-bottom: 6px;
  }

  .name-row input {
    width: 100%;
    padding: 10px 12px;
    font-size: 14px;
  }

  .quick-link {
    align-self: flex-start;
    font-size: 12px;
    color: var(--text-muted);
    padding: 4px 0;
  }

  .quick-link:hover:not(:disabled) {
    color: var(--accent-hover);
  }

  .error {
    color: var(--danger);
    font-size: 12px;
    padding: 8px 12px;
    background: rgba(224, 108, 117, 0.1);
    border-radius: var(--radius-sm);
  }

  .welcome-footer {
    position: relative;
    text-align: center;
    padding: 16px;
    font-size: 11px;
    color: var(--text-faint);
    letter-spacing: 0.04em;
  }

  @media (max-width: 720px) {
    .welcome-layout {
      grid-template-columns: 1fr;
      padding: 40px 24px 24px;
      gap: 32px;
    }

    .action-cards {
      grid-template-columns: 1fr;
    }
  }
</style>