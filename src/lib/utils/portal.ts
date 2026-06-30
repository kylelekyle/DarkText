/** Move an element to document.body so fixed positioning is never clipped by app layout. */
export function portal(node: HTMLElement) {
  document.body.appendChild(node);
  return {
    destroy() {
      node.remove();
    },
  };
}