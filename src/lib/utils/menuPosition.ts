/** Keep context menus within the viewport. */
export function clampMenuPosition(
  x: number,
  y: number,
  menuW = 200,
  menuH = 280,
): { x: number; y: number } {
  const pad = 8;
  const maxX = window.innerWidth - menuW - pad;
  const maxY = window.innerHeight - menuH - pad;
  return {
    x: Math.max(pad, Math.min(x, maxX)),
    y: Math.max(pad, Math.min(y, maxY)),
  };
}