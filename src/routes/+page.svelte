<script lang="ts">
  import { onMount } from "svelte";
  import { app } from "$lib/stores/app.svelte";
  import { fontStore } from "$lib/stores/fonts.svelte";
  import { getAppSettings } from "$lib/utils/appSettings";
  import { initWindowCloseHandler } from "$lib/utils/windowClose";
  import TitleBar from "$lib/components/TitleBar.svelte";
  import WelcomeScreen from "$lib/components/WelcomeScreen.svelte";
  import AppShell from "$lib/components/AppShell.svelte";
  initWindowCloseHandler();

  onMount(() => {
    app.applySettings(getAppSettings());
    void fontStore.init();
    return () => fontStore.destroy();
  });
</script>

<div class="app-root">
  <TitleBar />
  {#if app.screen === "welcome"}
    <WelcomeScreen />
  {:else}
    <AppShell />
  {/if}
</div>

<style>
  .app-root {
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
    background: var(--bg-deep);
  }
</style>