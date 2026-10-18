export interface EnqueueHooks {
  timeoutMs?: number
  onSynthDone?: () => void
  onPlayStart?: () => void
  onSettle?: () => void
}

export class AudioQueue {
  private chain: Promise<void> = Promise.resolve()
  constructor(private readonly play: (buf: ArrayBuffer) => Promise<void>) {}

  enqueue(fetchAudio: () => Promise<ArrayBuffer | null>, opts?: EnqueueHooks): void {
    const timeoutMs = opts?.timeoutMs ?? 60000
    this.chain = this.chain
      .then(async () => {
        const buf = await fetchAudio().catch(() => null)
        if (!buf || buf.byteLength === 0) {
          opts?.onSettle?.()
          return
        }
        opts?.onSynthDone?.()
        let timer: ReturnType<typeof setTimeout> | null = null
        opts?.onPlayStart?.()
        await Promise.race([
          this.play(buf).catch(() => undefined),
          new Promise<void>(resolve => {
            timer = setTimeout(resolve, timeoutMs)
          }),
        ])
        if (timer) clearTimeout(timer)
        opts?.onSettle?.()
      })
      .catch(() => undefined)
  }

  get idle(): Promise<void> {
    return this.chain
  }
}
