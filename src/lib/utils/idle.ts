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