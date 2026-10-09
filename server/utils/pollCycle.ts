// Bound each awaited stage, rather than racing the entire worker and leaving
// its continuation alive. A late underlying operation may finish, but cannot
// resume the caller after the stage timeout.
export class PollStageTimeout extends Error {
  constructor(public readonly stage: string) {
    super(`Poll cycle timed out at ${stage}`);
    this.name = 'PollStageTimeout';
  }
}

export class PollCycle {
  private readonly startedAt = Date.now();
  private stage = 'start';
  private closed = false;
  private readonly heartbeat: ReturnType<typeof setInterval>;
  constructor(private readonly report: (event: string) => void,
    private readonly budgetMs = 120_000, heartbeatMs = 30_000) {
    report('start');
    this.heartbeat = setInterval(() => report(`heartbeat stage=${this.stage} elapsedMs=${Date.now() - this.startedAt}`), heartbeatMs);
  }

  async step<T>(stage: string, action: () => Promise<T>, limitMs = 15_000): Promise<T> {
    this.stage = stage;
    const remaining = this.budgetMs - (Date.now() - this.startedAt);
    if (this.closed || remaining <= 0) throw new PollStageTimeout(stage);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        Promise.resolve().then(action),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new PollStageTimeout(stage)), Math.min(limitMs, remaining));
        }),
      ]);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }

  finish(outcome: string) {
    this.closed = true;
    clearInterval(this.heartbeat);
    this.report(`end outcome=${outcome} stage=${this.stage} elapsedMs=${Date.now() - this.startedAt}`);
  }
}
