const KEY = "flash:v1:topics";

export function toggle(selected: ReadonlySet<string>, label: string): Set<string> {
  const out = new Set(selected);
  if (out.has(label)) out.delete(label);
  else out.add(label);
  return out;
}

export function loadSelection(s: Pick<Storage, "getItem"> | null, known: readonly string[]): Set<string> {
  const stored: unknown[] = JSON.parse(s?.getItem(KEY) ?? "[]");
  return new Set(known.filter((t) => stored.includes(t)));
}
