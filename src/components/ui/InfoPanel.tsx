import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import type { MissionData } from '../../data/missions';
import styles from './InfoPanel.module.css';
import SplitText from 'gsap/SplitText';
import InfoPanelLabel from './InfoPanelLabel';
import Button from './Button';

interface InfoPanelProps {
  mission: MissionData;
  onContinue: () => void;
  onExploreMissions?: () => void;
  onDriveRover?: () => void;
  showRoverButton: boolean;
}
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP, SplitText);

export default function InfoPanel({
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

      const tl = gsap.timeline();

      tl.from(
        `.${styles.panelBackground}`,
        {
          transformOrigin: 'top center',
          y: '-100%',
          skewY: -20,
          duration: 2,
          ease: 'power4.out',
        },
        0,
      );

      tl.from(
        `.${styles.titleLine}`,
        {
          transformOrigin: 'center right',
          x: '100%',
          skewX: -20,
          duration: 2,
          ease: 'power3.out',
          stagger: 0.5,
        },
        0,
      );

      let titleText = SplitText.create(`.${styles.titleText}`, {
        type: 'chars',
      });
      tl.from(
        titleText.chars,
        {
          // x: -80,
          // autoAlpha: 0,
          y: '100%',
          transformOrigin: 'bottom center',
          ease: 'expo.out',
          stagger: -0.05,
        },
        '-=1.75',
      );
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

      <InfoPanelLabel>Crew</InfoPanelLabel>
      <div className={styles.crew}>{mission.crew.join(' · ')}</div>

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

      <div className={styles.buttonGroup}>
        {showRoverButton && (
          <Button onClick={onDriveRover} className={styles.roverButton}>
            Drive Rover
          </Button>
        )}
        {onExploreMissions && (
          <Button onClick={onExploreMissions} className={styles.roverButton}>
            Explore
          </Button>
        )}
        <Button onClick={onContinue} className={styles.continueButton}>
          Continue →
        </Button>
      </div>
    </div>
  );
}
