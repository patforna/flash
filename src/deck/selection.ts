export function toggle(selected: ReadonlySet<string>, label: string): Set<string> {
  return new Set([...selected, label]);
}
