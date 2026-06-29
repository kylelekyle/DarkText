<script lang="ts">
  import "$lib/styles/global.css";
  import { suppressNativeContextMenu } from "$lib/utils/platform";
</script>

<svelte:window oncontextmenu={suppressNativeContextMenu} />

<slot />