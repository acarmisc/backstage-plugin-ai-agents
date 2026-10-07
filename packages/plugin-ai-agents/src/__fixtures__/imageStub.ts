/**
 * jsdom never loads images, but BUI's `Avatar` shows the image only after a
 * real `load` event on `new Image()`. This stub fires `load` (or `error`, for
 * empty URLs and URLs matching `fails`) on the next tick.
 *
 * Returns a function that restores the previous `Image`.
 */
export function installImageStub(
  fails: (src: string) => boolean = () => false,
): () => void {
  const g = globalThis as any;
  const original = g.Image;
  class StubImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    private current = '';
    get src(): string {
      return this.current;
    }
    set src(value: string) {
      this.current = value;
      setTimeout(() => {
        if (!value || fails(value)) this.onerror?.();
        else this.onload?.();
      }, 0);
    }
  }
  g.Image = StubImage;
  return () => {
    g.Image = original;
  };
}
