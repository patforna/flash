// What is being read, for the topics chip's accessible name: "all topics", the names of one or two, or the first two
// and how many more.
export function summarise(selected: readonly string[]): string {
  if (selected.length === 0) return "all topics";
  if (selected.length <= 2) return selected.join(", ");
  return `${selected.slice(0, 2).join(", ")} and ${selected.length - 2} more`;
}
