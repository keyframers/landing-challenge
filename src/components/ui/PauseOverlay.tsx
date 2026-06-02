import styles from "./PauseOverlay.module.css";

interface PauseOverlayProps {
  onResume: () => void;
  onQuit: () => void;
}

export function PauseOverlay({ onResume, onQuit }: PauseOverlayProps) {
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
            onClick={onQuit}
            className={`${styles.button} ${styles.secondaryButton}`}
          >
            Quit
          </button>
        </div>
      </div>
    </div>
  );
}
