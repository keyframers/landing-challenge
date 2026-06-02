import styles from "./PauseOverlay.module.css";
import Button from "./Button";

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
          <Button
            onClick={onResume}
            className={`${styles.button} ${styles.primaryButton}`}
          >
            Resume
          </Button>
          <Button
            onClick={onSimulate}
            className={`${styles.button} ${styles.secondaryButton}`}
          >
            Simulate Landing
          </Button>
          <Button
            onClick={onExploreMissions}
            className={`${styles.button} ${styles.secondaryButton}`}
          >
            Explore Missions
          </Button>
        </div>
      </div>
    </div>
  );
}
