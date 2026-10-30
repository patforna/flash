import type { ReactNode } from "react";

export interface TopicPanelProps {
  topics: readonly string[];
  counts: ReadonlyMap<string, number>;
  total: number;
  selected: ReadonlySet<string>;
  onToggle(label: string): void;
  onAll(): void;
  colourOf(topic: string): string;
  lead?: ReactNode;
}

export function TopicPanel(_props: TopicPanelProps) {
  return <fieldset aria-label="Topics" />;
}
