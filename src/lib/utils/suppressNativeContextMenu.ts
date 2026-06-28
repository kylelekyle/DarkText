/** Block the browser/WebView default context menu (e.g. Inspect Element). */
export function suppressNativeContextMenu(event: MouseEvent): void {
  const target = event.target;
  if (!(target instanceof Element)) return;

  if (target.closest("input, textarea, [contenteditable='true']")) return;

  event.preventDefault();
}