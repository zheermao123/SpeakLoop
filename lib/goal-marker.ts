export function parseGoalMarker(text: string): { clean: string; goals: number[] } {
  const goals: number[] = []
  const clean = text
    .replace(/ ?\[GOAL_DONE:(\d+)\]/g, (_, n: string) => {
      goals.push(Number(n))
      return ""
    })
    .replace(/ {2,}/g, " ")
    .trim()
  return { clean, goals }
}
