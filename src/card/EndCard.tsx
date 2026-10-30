export interface EndCardProps {
  total: number;
}

export function EndCard({ total }: EndCardProps) {
  return (
    <div>
      <p>That's all {total}.</p>
      <p>Tap or swipe to shuffle again.</p>
    </div>
  );
}
