const KEY = "flash:v1:topics";

export function toggle(selected: ReadonlySet<string>, label: string): Set<string> {
  const out = new Set(selected);
  if (out.has(label)) out.delete(label);
  else out.add(label);
  return out;
}

export function loadSelection(s: Pick<Storage, "getItem"> | null, _known: readonly string[]): Set<string> {
  return new Set(JSON.parse(s?.getItem(KEY) ?? "[]"));
}
