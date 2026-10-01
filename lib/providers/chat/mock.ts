import { ChatProvider } from "@/lib/providers/types"

export class MockChatProvider implements ChatProvider {
  async chat(system: string, messages: { role: "user" | "assistant"; content: string }[]): Promise<string> {
    const last = messages[messages.length - 1]?.content ?? ""
    if (system.includes("report analyzer")) {
      const m = last.match(/\[([^\]]+)\]\s*(.+)/s)
      const turnId = m?.[1] ?? "unknown"
      const original = m?.[2]?.split("\n")[0] ?? "I go yesterday"
      return JSON.stringify({
        summary: "Mock 报告：整体表达清晰，注意时态与介词的使用。",
        highlights: ["能够主动展开话题", "语速与流利度良好"],
        corrections: [
          { turnId, original, type: "grammar", improved: "I went there yesterday.", explanation: "yesterday 提示过去时间，动词需用过去式。" },
        ],
        vocabCandidates: [{ word: "blocker", translation: "阻碍；卡点", example: "We hit a blocker in the API integration." }],
      })
    }
    if (system.includes("simpler English")) return "OK, simply: what do you mean? Please say it again in short words."
    if (system.includes("sentence pattern")) return "提示：表达建议时可以说 —— I'd suggest we ... / How about ...ing?"
    const userCount = messages.filter(x => x.role === "user").length
    if (userCount <= 1) return "Hi! Nice to meet you. Let's get started — tell me a bit about yourself."
    if (userCount === 2) return "That sounds good. Could you tell me more about it? [GOAL_DONE:0]"
    if (userCount >= 4) return "Great, I think we've covered a lot today. Thanks! [GOAL_DONE:1]"
    return "Interesting. Please go on."
  }
}
