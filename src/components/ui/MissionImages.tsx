import { useRef } from "react";
import type { MissionData } from "../../data/missions";
import styles from "./MissionImages.module.css";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

interface MissionImagesProps {
  mission: MissionData;
}

export default function MissionImages({ mission }: MissionImagesProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      gsap.from(`.${styles.image}`, {
        x: "100%",
        stagger: 0.1,
        duration: 1,
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top 80%",
          end: "bottom 20%",
          scrub: 1,
        },
      });
    },
    { scope: containerRef },
  );

  return (
    <div ref={containerRef} className={styles.images}>
      {mission.images.map((img, i) => (
        <div key={i} className={styles.image}>
          <img src={img.src} alt={img.caption} />
        </div>
      ))}
    </div>
  );
}
