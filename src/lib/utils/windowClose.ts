import { app } from "$lib/stores/app.svelte";

let closeHandlerReady = false;

export function isTauriApp(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** Register before first paint so × and Alt+F4 always have a handler. */
export function initWindowCloseHandler(): void {
  if (!isTauriApp() || closeHandlerReady) return;
  closeHandlerReady = true;

  void (async () => {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const win = getCurrentWindow();
    await win.onCloseRequested(async (event) => {
      const ok = await app.tryCloseApp();
      if (!ok) event.preventDefault();
    });
  })();
}

/** Title bar × — guard first, then force-close (avoids double-handler deadlock). */
export async function requestAppClose(): Promise<void> {
  if (!isTauriApp()) return;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  const win = getCurrentWindow();
  const ok = await app.tryCloseApp();
  if (ok) await win.destroy();
}