export class AudioQueue {
  private chain: Promise<void> = Promise.resolve()
  constructor(private readonly play: (buf: ArrayBuffer) => Promise<void>) {}

  enqueue(fetchAudio: () => Promise<ArrayBuffer | null>): void {
    this.chain = this.chain.then(async () => {
      const buf = await fetchAudio().catch(() => null)
      if (!buf || buf.byteLength === 0) return
      await this.play(buf).catch(() => undefined)
    })
  }

  get idle(): Promise<void> {
    return this.chain
  }
}
