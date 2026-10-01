import { TTSProvider } from "@/lib/providers/types"

function silentWav(ms = 150, sampleRate = 8000): ArrayBuffer {
  const n = Math.floor((sampleRate * ms) / 1000)
  const buf = new ArrayBuffer(44 + n * 2)
  const v = new DataView(buf)
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)) }
  w(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); w(8, "WAVE"); w(12, "fmt ")
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true)
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true)
  v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, n * 2, true)
  return buf
}

export class MockTtsProvider implements TTSProvider {
  async synthesize(_text: string): Promise<ArrayBuffer> {
    return silentWav()
  }
}
