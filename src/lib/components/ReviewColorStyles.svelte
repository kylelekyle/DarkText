<script lang="ts">
  /**
   * Injects per-author `--rev-color` custom properties for tracked-change marks.
   * The change spans live inside ProseMirror (outside any component template),
   * so the rules must be global — emitted into a managed <style> in <head>.
   */
  import { reviewStore } from "$lib/stores/review.svelte";
  import { colorForAuthor } from "$lib/utils/reviewColors";

  const css = $derived.by(() => {
    const authors = new Set<string>();
    for (const change of reviewStore.chapterComments.changes) {
      if (change.author) authors.add(change.author);
    }
    const rules: string[] = [];
    for (const author of authors) {
      const sel = CSS.escape(author);
      rules.push(
        `.editor-mount [data-author="${sel}"]{--rev-color:${colorForAuthor(author)}}`,
      );
    }
    return rules.join("\n");
  });

  $effect(() => {
    const id = "dt-review-colors";
    let el = document.getElementById(id) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement("style");
      el.id = id;
      document.head.appendChild(el);
    }
    el.textContent = css;
    return () => {
      // Leave the element in place across remounts; just clear its rules.
      if (el) el.textContent = "";
    };
  });
</script>
