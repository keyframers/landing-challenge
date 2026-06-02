import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import type { MissionData } from "../../data/missions";
import styles from "./InfoPanel.module.css";

interface InfoPanelProps {
  mission: MissionData;
  onContinue: () => void;
  onDriveRover?: () => void;
  showRoverButton: boolean;
}

export function InfoPanel({
  mission,
  onContinue,
  onDriveRover,
  showRoverButton,
}: InfoPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);

  useEffect(() => {
    if (!panelRef.current) return;
    gsap.from(panelRef.current, {
      x: 100,
      opacity: 0,
      duration: 0.6,
      ease: "power3.out",
    });
  }, []);

  return (
    <div ref={panelRef} className={styles.panel}>
      <div className={styles.badge}>★ Mission Unlocked</div>
      <h2 className={styles.title}>{mission.name}</h2>
      <div className={styles.subtitle}>{mission.subtitle}</div>
      <div className={styles.date}>{mission.date}</div>
      <p className={styles.description}>{mission.description}</p>

      <div className={styles.crewLabel}>Crew</div>
      <div className={styles.crew}>{mission.crew.join(" · ")}</div>

      {/* Carousel */}
      <div className={styles.carousel}>
        {mission.images.map((img, i) => (
          <div
            key={i}
            onClick={() => setCarouselIndex(i)}
            className={`${styles.carouselItem} ${i === carouselIndex ? styles.selected : styles.unselected}`}
          >
            <div className={styles.carouselCaption}>{img.caption}</div>
          </div>
        ))}
      </div>

      <div className={styles.dots}>
        {mission.images.map((_, i) => (
          <div
            key={i}
            className={`${styles.dot} ${i === carouselIndex ? styles.active : styles.inactive}`}
          />
        ))}
      </div>

      <div className={styles.buttonGroup}>
        {showRoverButton && (
          <button onClick={onDriveRover} className={styles.roverButton}>
            Drive Rover
          </button>
        )}
        <button onClick={onContinue} className={styles.continueButton}>
          Continue →
        </button>
      </div>
    </div>
  );
}
