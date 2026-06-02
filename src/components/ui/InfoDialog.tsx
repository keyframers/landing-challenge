import { useEffect, useRef } from "react";
import gsap from "gsap";
import styles from "./InfoDialog.module.css";
import Button from "./Button";
import { useModalKeyboard } from "./useModalKeyboard";

interface InfoDialogProps {
  onClose: () => void;
}

export default function InfoDialog({ onClose }: InfoDialogProps) {
  const ref = useRef<HTMLDivElement>(null);
  useModalKeyboard(ref);

  useEffect(() => {
    if (!ref.current) return;
    gsap.from(ref.current, {
      scale: 0.95,
      opacity: 0,
      duration: 0.4,
      ease: "power3.out",
    });
  }, []);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div ref={ref} onClick={(e) => e.stopPropagation()} className={styles.content}>
        <h2 className={styles.title}>Controls</h2>
        <div className={styles.controlsList}>
          <ControlRow keys="←" desc="Rotate left" />
          <ControlRow keys="→" desc="Rotate right" />
          <ControlRow keys="↑ / A" desc="Main thrust" />
          <ControlRow keys="Esc / Enter" desc="Pause" />
        </div>
        <p className={styles.description}>
          Land the lunar module on the highlighted landing zone. Control your descent speed and
          angle — too fast or too tilted and you'll crash. Each mission takes you to a new Apollo
          landing site.
        </p>
        <Button onClick={onClose} className={styles.closeButton}>
          Got it
        </Button>
      </div>
    </div>
  );
}

function ControlRow({ keys, desc }: { keys: string; desc: string }) {
  return (
    <div className={styles.controlRow}>
      <code className={styles.keyBadge}>{keys}</code>
      <span className={styles.controlDescription}>{desc}</span>
    </div>
  );
}
