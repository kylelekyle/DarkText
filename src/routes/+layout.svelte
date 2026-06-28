<script lang="ts">
  import "$lib/styles/global.css";
  import { suppressNativeContextMenu } from "$lib/utils/suppressNativeContextMenu";
</script>

<svelte:window oncontextmenu={suppressNativeContextMenu} />

<slot />