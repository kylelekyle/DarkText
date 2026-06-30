<script lang="ts">
  import { onMount } from "svelte";
  import { app } from "$lib/stores/app.svelte";
  import { fontStore } from "$lib/stores/fonts.svelte";
  import { getAppSettings } from "$lib/utils/appSettings";
  import { initWindowCloseHandler } from "$lib/utils/platform";
  import { restoreWorkspaceSession } from "$lib/utils/workspaceSession";
  import TitleBar from "$lib/components/TitleBar.svelte";
  import WelcomeScreen from "$lib/components/WelcomeScreen.svelte";
  import AppShell from "$lib/components/AppShell.svelte";
  import ReviewPanelAside from "$lib/components/ReviewPanelAside.svelte";
  initWindowCloseHandler();

  onMount(() => {
    app.applySettings(getAppSettings());
    void fontStore.init();
    void restoreWorkspaceSession();
    return () => fontStore.destroy();
  });
</script>

<div
  class="app-root"
  class:review-panel-open={app.screen === "workspace" &&
    app.mode === "editor" &&
    !app.focusMode &&
    !app.reviewPanelDismissed}
>
  <TitleBar />
  {#if app.screen === "welcome"}
    <WelcomeScreen />
  {:else}
    <AppShell />
  {/if}
</div>

<ReviewPanelAside />

<style>
  .app-root {
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
    background: var(--bg-deep);
  }

  .app-root.review-panel-open :global(.editor-area) {
    margin-right: 280px;
    transition: margin-right var(--transition-smooth);
  }
</style>