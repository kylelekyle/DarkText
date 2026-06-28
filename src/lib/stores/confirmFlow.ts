import { chapterStore } from "$lib/stores/chapter.svelte";
import type { ConfirmDialogState } from "$lib/types";
import { waitForPaint } from "$lib/utils/idle";

export interface ConfirmFlowSlice {
  confirmDialog: ConfirmDialogState | null;
  confirmGeneration: number;
  confirmResolver: ((ok: boolean) => void) | null;
}

export async function showConfirm(
  slice: ConfirmFlowSlice,
  message: string,
  title = "Unsaved changes",
  labels?: { confirm?: string; cancel?: string; destructive?: boolean },
): Promise<boolean> {
  await waitForPaint();
  if (slice.confirmResolver) return false;
  return new Promise((resolve) => {
    slice.confirmResolver = resolve;
    slice.confirmGeneration++;
    slice.confirmDialog = {
      title,
      message,
      confirmLabel: labels?.confirm ?? "Discard & continue",
      cancelLabel: labels?.cancel ?? "Stay",
      destructive: labels?.destructive ?? false,
    };
  });
}

export function resolveConfirmSlice(slice: ConfirmFlowSlice, ok: boolean): void {
  const resolver = slice.confirmResolver;
  slice.confirmResolver = null;
  slice.confirmDialog = null;
  resolver?.(ok);
}

export async function guardUnsavedChanges(
  slice: ConfirmFlowSlice,
  hasUnsaved: boolean,
  confirmOnClose: boolean,
  action: () => void | Promise<void>,
): Promise<void> {
  if (hasUnsaved && confirmOnClose) {
    const ok = await showConfirm(
      slice,
      "You have unsaved changes in the current chapter. Discard them and continue?",
    );
    if (!ok) return;
    chapterStore.discardUnsaved();
  }
  await action();
}

export async function tryCloseAppConfirm(
  slice: ConfirmFlowSlice,
  opts: {
    closeConfirmed: boolean;
    hasUnsaved: boolean;
    confirmOnClose: boolean;
    onConfirmed: () => void;
  },
): Promise<boolean> {
  if (opts.closeConfirmed) return true;
  if (!opts.hasUnsaved || !opts.confirmOnClose) return true;

  const message =
    "You have unsaved changes. Close anyway? Unsaved text will be lost.";
  let ok = false;

  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    try {
      const { confirm: tauriConfirm } = await import("@tauri-apps/plugin-dialog");
      ok = await tauriConfirm(message, {
        title: "Close DarkText?",
        kind: "warning",
        okLabel: "Close anyway",
        cancelLabel: "Keep editing",
      });
    } catch {
      ok = window.confirm(message);
    }
  } else {
    ok = await showConfirm(slice, message, "Close DarkText?", {
      confirm: "Close anyway",
      cancel: "Keep editing",
    });
  }

  if (ok) {
    opts.onConfirmed();
  }
  return ok;
}