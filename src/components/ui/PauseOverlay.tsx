import styles from "./PauseOverlay.module.css";
import Button from "./Button";

interface PauseOverlayProps {
  onResume: () => void;
  onSimulate: () => void;
  onExploreMissions: () => void;
  onControls: () => void;
}

export default function PauseOverlay({
  onResume,
  onSimulate,
  onExploreMissions,
  onControls,
}: PauseOverlayProps) {
  return (
    <div className={styles.overlay}>
      <div className={styles.content}>
        <div className={styles.title}>Paused</div>
        <div className={styles.buttonGroup}>
          <Button onClick={onResume}>Resume</Button>
          <Button onClick={onSimulate} subtle>
            Simulate Landing
          </Button>
          <Button onClick={onExploreMissions} subtle>
            Explore Missions
          </Button>
          <Button onClick={onControls} subtle>
            Controls
          </Button>
        </div>
      </div>
    </div>
  );
}
