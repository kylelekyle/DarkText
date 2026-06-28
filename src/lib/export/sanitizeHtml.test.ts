import { describe, expect, it } from "vitest";
import {
  isBlockedNavUrl,
  isSafeLibraryImagePath,
  pasteContainsExternalImages,
  prepareHtmlForPaste,
  sanitizeHtmlForDisplay,
} from "./sanitizeHtml";

describe("isSafeLibraryImagePath", () => {
  it("accepts library-relative image paths", () => {
    expect(isSafeLibraryImagePath("images/abc-123.png")).toBe(true);
    expect(isSafeLibraryImagePath("images/photo.jpeg")).toBe(true);
  });

  it("rejects traversal and absolute paths", () => {
    expect(isSafeLibraryImagePath("images/../secret.png")).toBe(false);
    expect(isSafeLibraryImagePath("asset://localhost/C:/x.png")).toBe(false);
    expect(isSafeLibraryImagePath("https://evil.test/x.png")).toBe(false);
    expect(isSafeLibraryImagePath("images/sub/file.png")).toBe(false);
  });
});

describe("isBlockedNavUrl", () => {
  it("blocks remote and local schemes", () => {
    expect(isBlockedNavUrl("https://evil.test")).toBe(true);
    expect(isBlockedNavUrl("asset://localhost/C:/x")).toBe(true);
    expect(isBlockedNavUrl("file:///C:/x")).toBe(true);
    expect(isBlockedNavUrl("blob:abc")).toBe(true);
    expect(isBlockedNavUrl("javascript:alert(1)")).toBe(true);
  });
});

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

  it("strips asset, file, and blob URLs", () => {
    const html =
      '<img src="asset://localhost/C:/secret.png">' +
      '<a href="file:///C:/x">f</a>' +
      '<a href="blob:abc">b</a>';
    const out = sanitizeHtmlForDisplay(html);
    expect(out).not.toContain("asset://");
    expect(out).not.toContain("file://");
    expect(out).not.toContain("blob:");
  });

  it("keeps safe library image paths", () => {
    const html = '<p><img src="images/abc.png" data-rel-path="images/abc.png" alt="ok"></p>';
    const out = sanitizeHtmlForDisplay(html);
    expect(out).toContain('src="images/abc.png"');
    expect(out).toContain('data-rel-path="images/abc.png"');
  });

  it("strips javascript: hrefs after HTML parsing", () => {
    const html = '<a href="javascript:alert(1)">click</a>';
    const out = sanitizeHtmlForDisplay(html);
    expect(out.toLowerCase()).not.toContain("javascript:");
    expect(out).toContain("click");
  });

  it("removes clipboard fragment comments and empty images", () => {
    const html =
      '<!--StartFragment--><img alt="example" src="https://evil.test/x.png">';
    const out = sanitizeHtmlForDisplay(html);
    expect(out).not.toContain("StartFragment");
    expect(out).not.toContain("<img");
  });
});

describe("prepareHtmlForPaste", () => {
  it("flags external images and drops clipboard markup", () => {
    const html =
      '<!--StartFragment--><img alt="how to disable" src="https://google.com/x.png">';
    expect(pasteContainsExternalImages(html)).toBe(true);
    const { html: safe, blockedImages } = prepareHtmlForPaste(html);
    expect(blockedImages).toBe(true);
    expect(safe).not.toContain("StartFragment");
    expect(safe).not.toContain("<img");
  });

  it("keeps safe library images", () => {
    const html = '<p><img src="images/photo.png" alt="ok"></p>';
    const { html: safe, blockedImages } = prepareHtmlForPaste(html);
    expect(blockedImages).toBe(false);
    expect(safe).toContain('src="images/photo.png"');
  });
});