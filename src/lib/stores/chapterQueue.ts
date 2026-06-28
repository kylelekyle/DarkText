/** Serializes rapid chapter open/switch requests — only the latest queued open runs. */
export class ChapterOpenQueue {
  private queuedFn: (() => Promise<void>) | null = null;
  private drain: Promise<void> | null = null;

  cancel(): void {
    this.queuedFn = null;
  }

  async enqueue(run: () => Promise<void>): Promise<void> {
    this.queuedFn = run;
    if (!this.drain) {
      this.drain = this.drainQueue();
    }
    await this.drain;
  }

  private async drainQueue(): Promise<void> {
    try {
      while (this.queuedFn) {
        const next = this.queuedFn;
        this.queuedFn = null;
        await next();
      }
    } finally {
      this.drain = null;
      if (this.queuedFn) {
        this.drain = this.drainQueue();
      }
    }
  }
}