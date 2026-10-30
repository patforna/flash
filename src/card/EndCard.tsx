export interface EndCardProps {
  total: number;
}

export function EndCard({ total }: EndCardProps) {
  return (
    <div>
      <svg viewBox="0 0 120 100" aria-hidden="true">
        <path d="M14 58 C22 63 31 72 40 86 C55 58 76 32 108 12" />
      </svg>
      <p>That's all {total}.</p>
      <p>Tap or swipe to shuffle again.</p>
    </div>
  );
}
