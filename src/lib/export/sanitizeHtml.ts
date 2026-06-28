/** Remove executable content before rendering untrusted library HTML. */
export function sanitizeHtmlForDisplay(html: string): string {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  doc
    .querySelectorAll(
      "script, iframe, object, embed, link, meta, style, svg, math, base, form, input, button, textarea, select, video, audio, template, noscript, applet, marquee, frame, frameset, xmp, iframe, embed, object, param, style, link, meta, base, noscript, keygen, area, map, wbr, bdo, rp, rt, ruby, output, progress, meter, details, summary, dialog, command, menuitem, keygen, canvas, video, audio, embed, object, iframe, marquee, frame, frameset, xmp, iframe, embed, object, param, style, link, meta, base, noscript, keygen, area, map, wbr, bdo, rp, rt, ruby, output, progress, meter, details, summary, dialog, command, menuitem"
    )
    .forEach((el) => {
      el.remove();
    });
  doc.body.querySelectorAll("*").forEach((el) => {
    // el.attributes is a live NamedNodeMap; removeAttribute() below would mutate
    // it mid-iteration and skip entries if we iterated it directly.
    // oxlint-disable-next-line unicorn/no-useless-spread
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim().toLowerCase();
      if (name.startsWith("on")) {
        el.removeAttribute(attr.name);
        continue;
      }
      if (
        value.startsWith("javascript:") ||
        value.startsWith("data:text/html") ||
        value.startsWith("vbscript:")
      ) {
        el.removeAttribute(attr.name);
        continue;
      }
      if (name === "srcdoc") {
        el.removeAttribute(attr.name);
        continue;
      }
      if ((name === "href" || name === "src" || name === "xlink:href") && value.startsWith("data:")) {
        el.removeAttribute(attr.name);
      }
    }
  });
  return doc.body.innerHTML;
}
