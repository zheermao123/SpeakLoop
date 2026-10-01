import { STTProvider, STTResult } from "@/lib/providers/types"

export class MockSttProvider implements STTProvider {
  async transcribe(_audio: Blob): Promise<STTResult> {
    return { text: "This is a mock transcription for local development." }
  }
}
