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