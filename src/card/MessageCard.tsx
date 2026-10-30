import styles from "./card.module.css";

export interface MessageCardProps {
  title: string;
  hint?: string;
  tone?: "pencil" | "error";
  onTap?(): void;
}

// Loading, error and empty: a card with a line or two of writing. When it can be tapped, the whole card is the button.
export function MessageCard({ title, hint, tone = "pencil", onTap }: MessageCardProps) {
  const Face = onTap ? "button" : "div";
  return (
    <Face type={onTap ? "button" : undefined} data-tone={tone} onClick={onTap}>
      <span className={styles.title}>{title}</span>
      {hint && (
        <>
          {" "}
          <span className={styles.hint}>{hint}</span>
        </>
      )}
    </Face>
  );
}
