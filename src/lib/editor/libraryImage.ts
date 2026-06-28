import Image from '@tiptap/extension-image';

declare module '@tiptap/extension-image' {
  interface ImageOptions {
    libraryPath?: string | null;
  }
}

function resolveLibraryImageSrc(src: string, libraryPath: string | null | undefined): string {
  if (!src || src.startsWith('data:') || src.startsWith('http://') || src.startsWith('https://')) {
    return src;
  }
  if (src.startsWith('images/') && libraryPath) {
    const normalized = libraryPath.replace(/\\/g, '/').replace(/\/$/, '');
    return `asset://localhost/${encodeURI(`${normalized}/${src}`)}`;
  }
  return src;
}

export const LibraryImage = Image.extend({
  addOptions() {
    const parent = this.parent?.();
    return {
      inline: parent?.inline ?? false,
      allowBase64: parent?.allowBase64 ?? false,
      HTMLAttributes: parent?.HTMLAttributes ?? {},
      resize: parent?.resize ?? false,
      libraryPath: null as string | null,
    };
  },

  addAttributes() {
    return {
      ...this.parent?.(),
      'data-rel-path': {
        default: null,
        parseHTML: (element) => element.getAttribute('data-rel-path'),
        renderHTML: (attributes) => {
          if (!attributes['data-rel-path']) return {};
          return { 'data-rel-path': attributes['data-rel-path'] };
        },
      },
    };
  },

  renderHTML({ HTMLAttributes }) {
    const rel = HTMLAttributes['data-rel-path'] as string | undefined;
    const src = (HTMLAttributes.src as string) || (rel ? `images/${rel.split('/').pop()}` : '');
    const resolved = resolveLibraryImageSrc(src, this.options.libraryPath);
    return ['img', { ...HTMLAttributes, src: resolved }];
  },
});

export function createLibraryImageExtension(libraryPath: string | null) {
  return LibraryImage.configure({ inline: true, libraryPath });
}