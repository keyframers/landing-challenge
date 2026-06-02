import styles from "./LoadingScreen.module.css";

interface LoadingScreenProps {
  progress: number;
}

export function LoadingScreen({ progress }: LoadingScreenProps) {
  return (
    <div className={styles.container}>
      <div className={styles.label}>Initializing Systems</div>
      <div className={styles.progressBar}>
        <div
          className={styles.progressFill}
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      <div className={styles.percentage}>{Math.round(progress * 100)}%</div>
    </div>
  );
}
