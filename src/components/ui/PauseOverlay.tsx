import { useRef } from "react";
import styles from "./PauseOverlay.module.css";
import Button from "./Button";
import { useModalKeyboard } from "./useModalKeyboard";

interface PauseOverlayProps {
  onResume: () => void;
  onRestart: () => void;
  onSimulate: () => void;
  onExploreMissions: () => void;
  onControls: () => void;
}

export default function PauseOverlay({
  onResume,
  onRestart,
  onSimulate,
  onExploreMissions,
  onControls,
}: PauseOverlayProps) {
  const ref = useRef<HTMLDivElement>(null);
  useModalKeyboard(ref);

  return (
    <div className={styles.overlay}>
      <div ref={ref} className={styles.content}>
        <div className={styles.title}>Paused</div>
        <div className={styles.buttonGroup}>
          <Button onClick={onResume} large data-primary="true">
            Resume
          </Button>
          <Button onClick={onRestart} subtle>
            Restart
          </Button>
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
