const KEY = "flash:v1:topics";

export function toggle(selected: ReadonlySet<string>, label: string): Set<string> {
  const out = new Set(selected);
  if (out.has(label)) out.delete(label);
  else out.add(label);
  return out;
}

export function loadSelection(s: Pick<Storage, "getItem"> | null, known: readonly string[]): Set<string> {
  try {
    const stored: unknown = JSON.parse(s?.getItem(KEY) ?? "[]");
    return new Set(Array.isArray(stored) ? known.filter((t) => stored.includes(t)) : []);
  } catch {
    return new Set();
  }
}

export function saveSelection(s: Pick<Storage, "setItem"> | null, selected: ReadonlySet<string>): void {
  try {
    s?.setItem(KEY, JSON.stringify([...selected]));
  } catch {
    // Blocked or full storage: the selection just won't outlive the page.
  }
}
