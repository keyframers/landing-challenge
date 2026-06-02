import { useEffect, useRef } from "react";
import gsap from "gsap";
import styles from "./CrashOverlay.module.css";

interface CrashOverlayProps {
  type: "crashed" | "missed";
  onRetry: () => void;
  onSimulate: () => void;
  onExplore: () => void;
  onControls: () => void;
}

export default function CrashOverlay({
  type,
  onRetry,
  onSimulate,
  onExplore,
  onControls,
}: CrashOverlayProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    gsap.from(ref.current, {
      y: 30,
      opacity: 0,
      duration: 0.5,
      ease: "power3.out",
    });
  }, []);

  const title = type === "crashed" ? "Mission Failed" : "Off Target";
  const subtitle =
    type === "crashed"
      ? "The lander was destroyed on impact."
      : "You landed safely, but outside the designated zone.";

  return (
    <div className={styles.overlay}>
      <div ref={ref} className={styles.content}>
        <div className={styles.title}>{title}</div>
        <p className={styles.subtitle}>{subtitle}</p>
        <div className={styles.buttonGroup}>
          <button
            onClick={onRetry}
            className={`${styles.button} ${styles.primaryButton}`}
          >
            Try Again
          </button>
          <button
            onClick={onSimulate}
            className={`${styles.button} ${styles.secondaryButton}`}
          >
            Simulate Landing
          </button>
          <button
            onClick={onExplore}
            className={`${styles.button} ${styles.secondaryButton}`}
          >
            Explore Missions
          </button>
          <button
            onClick={onControls}
            className={`${styles.button} ${styles.secondaryButton}`}
          >
            Controls
          </button>
        </div>
      </div>
    </div>
  );
}
