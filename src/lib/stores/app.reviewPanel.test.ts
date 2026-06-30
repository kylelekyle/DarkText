import { describe, expect, it, beforeEach } from "vitest";
import { app } from "./app.svelte";

describe("review panel state", () => {
  beforeEach(() => {
    app.setMode("author");
    app.reviewPanelDismissed = false;
    app.focusMode = false;
    app.screen = "workspace";
  });

  it("opens panel when entering review mode", () => {
    app.setMode("editor");
    expect(app.mode).toBe("editor");
    expect(app.reviewPanelDismissed).toBe(false);
    expect(app.showReviewPanel).toBe(true);
  });

  it("openReviewPanel clears dismissed flag", () => {
    app.reviewPanelDismissed = true;
    app.openReviewPanel();
    expect(app.reviewPanelDismissed).toBe(false);
  });

  it("toggleReviewPanel flips dismissed flag", () => {
    app.setMode("editor");
    app.toggleReviewPanel();
    expect(app.reviewPanelDismissed).toBe(true);
    app.toggleReviewPanel();
    expect(app.reviewPanelDismissed).toBe(false);
  });
});