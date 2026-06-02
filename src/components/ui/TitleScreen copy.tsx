import { useRef } from "react";
import gsap from "gsap";
import SplitText from "gsap/SplitText";

import { useGSAP } from "@gsap/react";
import styles from "./TitleScreen.module.css";
import { CustomEase } from "gsap/CustomEase";
import PhysicsPropsPlugin from "gsap/PhysicsPropsPlugin";
import Physics2DPlugin from "gsap/Physics2DPlugin";

gsap.registerPlugin(
  useGSAP,
  SplitText,
  CustomEase,
  PhysicsPropsPlugin,
  Physics2DPlugin,
);

interface TitleScreenProps {
  onLaunch: () => void;
  onBrowse: () => void;
  onInfo: () => void;
}

export function TitleScreen({ onLaunch, onBrowse, onInfo }: TitleScreenProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!containerRef.current) return;

      let title = SplitText.create(`.${styles.title}`, { type: "chars" });

      const tl = gsap.timeline();

      tl.from(title.chars, {
        // y: -80,
        autoAlpha: 0,
        rotationZ: "random(-10,10)",
        rotationX: 40,
        ease: CustomEase.create(
          "custom",
          "M0,0 C0.644,0.017 0.497,1.066 0.859,0.979 0.924,0.963 0.942,0.963 1,1 ",
        ),
        physicsProps: {
          // x: { velocity: 10, acceleration: 20 },
          y: { velocity: -30, acceleration: 10 },
        },
        // physics2D: { velocity: 60, angle: -90, gravity: 100 },
        duration: 4,
        // scaleY: 0,
        stagger: {
          from: "edges", //"center",
          amount: 0.8,
        },
      });

      tl.to(
        title.chars,
        {
          duration: 1.5,
          textShadow: "-1px 6px 5px orange, 1px 9px 8px red",
          stagger: {
            from: "edges", //"center",
            amount: 0.8,
          },
          ease: `rough({
template:none.out,
strength: 1,
points:20,
taper:none,
randomize:true,
clamp:false
})`,
        },
        "-=3.5",
      );

      tl.to(
        title.chars,
        {
          duration: 0.75,
          textShadow: "0px 0px 0px orange, 0px 0px 0px red",
          stagger: {
            from: "edges", //"center",
            amount: 0.8,
          },
          ease: `rough({
template:none.out,
strength: 1,
points:10,
taper:none,
randomize:true,
clamp:false
})`,
        },
        "-=1.25",
      );

      tl.from(`.${styles.subtitle}`, {
        duration: 2,
        autoAlpha: 0,
        y: -10,
        ease: "power3.out",
      });
    },
    { scope: containerRef },
  );

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
