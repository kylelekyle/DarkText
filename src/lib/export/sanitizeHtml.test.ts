import { describe, expect, it } from "vitest";
import { sanitizeHtmlForDisplay } from "./sanitizeHtml";

describe("sanitizeHtmlForDisplay", () => {
  it("removes script tags", () => {
    const html = '<p>Hi</p><script>alert(1)</script>';
    expect(sanitizeHtmlForDisplay(html)).not.toContain("script");
    expect(sanitizeHtmlForDisplay(html)).toContain("Hi");
  });

  it("strips inline event handlers", () => {
    const html = '<p onclick="evil()">Text</p>';
    const out = sanitizeHtmlForDisplay(html);
    expect(out).not.toContain("onclick");
    expect(out).toContain("Text");
  });

  it("removes base and form elements", () => {
    const html = '<base href="https://evil.test"><form action="evil"><input></form><p>ok</p>';
    const out = sanitizeHtmlForDisplay(html);
    expect(out).not.toContain("<base");
    expect(out).not.toContain("<form");
    expect(out).toContain("ok");
  });

  it("removes style tags and data:text/html hrefs", () => {
    const html =
      '<style>body{background:red}</style><a href="data:text/html,<script>1</script>">x</a>';
    const out = sanitizeHtmlForDisplay(html);
    expect(out).not.toContain("<style");
    expect(out).not.toContain("data:text/html");
  });

  it("strips remote image and link URLs", () => {
    const html =
      '<p><img src="https://evil.test/track.png" alt="x"></p><a href="http://evil.test">link</a>';
    const out = sanitizeHtmlForDisplay(html);
    expect(out).not.toContain("https://evil.test");
    expect(out).not.toContain("http://evil.test");
  });
});