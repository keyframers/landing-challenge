import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import type { MissionData } from "../../data/missions";
import styles from "./InfoPanel.module.css";

interface InfoPanelProps {
  mission: MissionData;
  onContinue: () => void;
  onExploreMissions?: () => void;
  onDriveRover?: () => void;
  showRoverButton: boolean;
}
import { useGSAP } from "@gsap/react";

export function InfoPanel({
  mission,
  onContinue,
  onExploreMissions,
  onDriveRover,
  showRoverButton,
}: InfoPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);

  useGSAP(
    () => {
      if (!panelRef.current) return;

      gsap.from(`.${styles.panelBackground}`, {
        transformOrigin: "top center",
        scaleY: 0,
        duration: 2,
        ease: "expo.out",
      });

      gsap.from(`.${styles.titleLine}`, {
        transformOrigin: "center left",
        scaleX: 0,
        duration: 2,
        ease: "expo.out",
        stagger: 0.5,
      });
    },
    { scope: panelRef },
  );

  return (
    <div ref={panelRef} className={styles.panel}>
      <div className={styles.panelBackground} />
      <div className={styles.badge}>★ Mission Unlocked</div>
      <h2 className={styles.title}>
        <span className={styles.titleText}>{mission.name}</span>

        <span className={styles.titleLine} />
        <span className={styles.titleLine} />
      </h2>
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
        {onExploreMissions && (
          <button onClick={onExploreMissions} className={styles.roverButton}>
            Explore
          </button>
        )}
        <button onClick={onContinue} className={styles.continueButton}>
          Continue →
        </button>
      </div>
    </div>
  );
}
