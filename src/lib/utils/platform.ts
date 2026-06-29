// Combined from: isTauriRuntime.ts, suppressNativeContextMenu.ts, idle.ts, portal.ts, windowClose.ts

export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** Block the browser/WebView default context menu (e.g. Inspect Element). */
export function suppressNativeContextMenu(event: MouseEvent): void {
  const target = event.target;
  if (!(target instanceof Element)) return;

  if (target.closest("input, textarea, [contenteditable='true']")) return;

  event.preventDefault();
}

/** Run work after the browser has had a chance to paint and handle input. */
export function deferHeavyWork(fn: () => void, timeoutMs = 80): void {
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(() => fn(), { timeout: timeoutMs });
  } else {
    setTimeout(fn, 0);
  }
}

/** Wait until the next couple of animation frames (past click/dialog teardown). */
export function waitForPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

/** Move an element to a portal host (default: document.body) so it escapes overflow clipping. */
export function portal(node: HTMLElement, target: string | HTMLElement = "body") {
  const host =
    typeof target === "string"
      ? document.querySelector<HTMLElement>(target)
      : target;
  if (host) host.appendChild(node);
  return {
    destroy() {
      node.remove();
    },
  };
}

let closeHandlerReady = false;

export function isTauriApp(): boolean {
  return isTauriRuntime();
}

/** Register before first paint so × and Alt+F4 always have a handler. */
export function initWindowCloseHandler(): void {
  if (!isTauriApp() || closeHandlerReady) return;
  closeHandlerReady = true;

  void (async () => {
    const [{ getCurrentWindow }, { app }] = await Promise.all([
      import("@tauri-apps/api/window"),
      import("$lib/stores/app.svelte"),
    ]);
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
  const [{ getCurrentWindow }, { app }] = await Promise.all([
    import("@tauri-apps/api/window"),
    import("$lib/stores/app.svelte"),
  ]);
  const win = getCurrentWindow();
  const ok = await app.tryCloseApp();
  if (ok) await win.destroy();
}