import { useEffect, useRef } from "react";
import gsap from "gsap";
import styles from "./TitleScreen.module.css";

interface TitleScreenProps {
  onLaunch: () => void;
  onBrowse: () => void;
  onInfo: () => void;
}

export function TitleScreen({ onLaunch, onBrowse, onInfo }: TitleScreenProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const els = containerRef.current.children;
    gsap.from(els, {
      y: 40,
      opacity: 0,
      duration: 0.8,
      stagger: 0.15,
      ease: "power3.out",
    });
  }, []);

  return (
    <div ref={containerRef} className={styles.container}>
      <div className={styles.subtitle}>Explore the Apollo Missions</div>
      <h1 className={styles.title}>Lunar Landing</h1>
      <div className={styles.buttonGroup}>
        <button onClick={onLaunch} className={styles.primaryButton}>
          Launch Mission
        </button>
        <div className={styles.secondaryButtonGroup}>
          <button onClick={onBrowse} className={styles.secondaryButton}>
            Browse Missions
          </button>
          <button onClick={onInfo} className={styles.secondaryButton}>
            Controls
          </button>
        </div>
      </div>
    </div>
  );
}
