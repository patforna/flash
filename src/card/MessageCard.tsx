import styles from "./card.module.css";

export interface MessageCardProps {
  title: string;
  hint?: string;
  tone?: "pencil" | "error";
  onTap?(): void;
}

export function MessageCard({ title, hint, tone = "pencil" }: MessageCardProps) {
  return (
    <div data-tone={tone}>
      <span className={styles.title}>{title}</span>
      {hint && (
        <>
          {" "}
          <span className={styles.hint}>{hint}</span>
        </>
      )}
    </div>
  );
}
