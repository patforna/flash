export function toggle(selected: ReadonlySet<string>, label: string): Set<string> {
  const out = new Set(selected);
  if (out.has(label)) out.delete(label);
  else out.add(label);
  return out;
}
