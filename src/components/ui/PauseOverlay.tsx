import styles from "./PauseOverlay.module.css";

interface PauseOverlayProps {
  onResume: () => void;
  onExploreMissions: () => void;
}

export function PauseOverlay({
  onResume,
  onExploreMissions,
}: PauseOverlayProps) {
  return (
    <div className={styles.overlay}>
      <div className={styles.content}>
        <div className={styles.title}>Paused</div>
        <div className={styles.buttonGroup}>
          <button
            onClick={onResume}
            className={`${styles.button} ${styles.primaryButton}`}
          >
            Resume
          </button>
          <button
            onClick={onExploreMissions}
            className={`${styles.button} ${styles.secondaryButton}`}
          >
            Explore Missions
          </button>
        </div>
      </div>
    </div>
  );
}
