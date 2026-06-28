import { describe, expect, it } from "vitest";
import { sanitizeFilenameLocal } from "./sanitize";

describe("sanitizeFilenameLocal", () => {
  it("replaces unsafe characters with underscores", () => {
    expect(sanitizeFilenameLocal("My Chapter!")).toBe("My_Chapter");
  });

  it("collapses repeated underscores", () => {
    expect(sanitizeFilenameLocal("a   b")).toBe("a_b");
  });

  it("returns export for empty result", () => {
    expect(sanitizeFilenameLocal("!!!")).toBe("export");
  });

  it("preserves alphanumeric hyphen underscore", () => {
    expect(sanitizeFilenameLocal("Book-1_final")).toBe("Book-1_final");
  });
});