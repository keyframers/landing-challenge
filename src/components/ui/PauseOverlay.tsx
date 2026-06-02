import styles from "./PauseOverlay.module.css";

interface PauseOverlayProps {
  onResume: () => void;
  onSimulate: () => void;
  onExploreMissions: () => void;
}

export default function PauseOverlay({
  onResume,
  onSimulate,
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
            onClick={onSimulate}
            className={`${styles.button} ${styles.secondaryButton}`}
          >
            Simulate Landing
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
