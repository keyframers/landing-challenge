import { useEffect, useRef } from "react";
import gsap from "gsap";
import styles from "./CrashOverlay.module.css";
import Button from "./Button";

interface CrashOverlayProps {
  type: "crashed" | "missed";
  onRetry: () => void;
  onSimulate: () => void;
}

export default function CrashOverlay({
  type,
  onRetry,
  onSimulate,
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
        <div className={`${styles.title} ${styles[type]}`}>{title}</div>
        <p className={styles.subtitle}>{subtitle}</p>
        <div className={styles.buttonGroup}>
          <Button onClick={onRetry} className={styles.primaryButton}>
            Try Again
          </Button>
          <Button onClick={onSimulate} className={styles.secondaryButton}>
            Simulate Landing
          </Button>
        </div>
      </div>
    </div>
  );
}
