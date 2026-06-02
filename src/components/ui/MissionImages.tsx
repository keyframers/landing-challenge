import { useRef } from "react";
import type { MissionData } from "../../data/missions";
import styles from "./MissionImages.module.css";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";
import classNames from "classnames";

gsap.registerPlugin(ScrollTrigger);

interface MissionImagesProps {
  mission: MissionData;
  className?: string;
}

export default function MissionImages({ mission, className }: MissionImagesProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      gsap.from(`.${styles.image}`, {
        opacity: 0,
        duration: 1,
        stagger: -0.2,
      });

      gsap.from(`.${styles.image}`, {
        background: "red",
        duration: 1,
        delay: 0.5,
        stagger: -0.2,
      });
    },
    { scope: containerRef }
  );

  return (
    <div ref={containerRef} className={classNames(styles.images, className)}>
      {mission.images.map((img, i) => (
        <div key={i} className={styles.image}>
          <img src={img.src} alt={img.caption} />
        </div>
      ))}
    </div>
  );
}
