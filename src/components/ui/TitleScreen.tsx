import { useEffect, useRef } from "react";
import gsap from "gsap";
import SplitText from "gsap/SplitText";

import { useGSAP } from "@gsap/react";
import styles from "./TitleScreen.module.css";
import { CustomEase } from "gsap/CustomEase";
import PhysicsPropsPlugin from "gsap/PhysicsPropsPlugin";
import Physics2DPlugin from "gsap/Physics2DPlugin";
import Button from "./Button";
import { RoughEase } from "gsap/EasePack";
import { useModalKeyboard } from "./useModalKeyboard";

gsap.registerPlugin(useGSAP, SplitText, CustomEase, RoughEase, PhysicsPropsPlugin, Physics2DPlugin);

interface TitleScreenProps {
  onLaunch: () => void;
  onExploreMissions: () => void;
}

export default function TitleScreen({
  onLaunch,
  onExploreMissions,
}: TitleScreenProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  useModalKeyboard(containerRef);

  function focusLaunchButton() {
    containerRef.current
      ?.querySelector<HTMLButtonElement>("[data-primary='true']")
      ?.focus();
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Escape") {
        tlRef.current?.timeScale(7);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const tlRef = useRef<gsap.core.Timeline | null>(null);

  useGSAP(
    () => {
      if (!containerRef.current) return;

      const tl = gsap.timeline();
      tlRef.current = tl;

      tl.set(`.${styles.buttonGroup} button`, { opacity: 0, y: 20 });
      requestAnimationFrame(focusLaunchButton);

      tl.addLabel("title-start");

      let title = SplitText.create(`.${styles.title}`, { type: "chars" });
      tl.from(
        title.chars,
        {
          y: -80,
          autoAlpha: 0,
          rotationZ: "random(-10,10)",
          rotationX: 40,
          ease: CustomEase.create(
            "custom",
            "M0,0 C0.126,0.382 0.187,0.558 0.317,0.732 0.429,0.883 0.596,1.036 0.657,1 0.779,0.923 0.881,1 1,1 "
          ),
          /*CustomEase.create(
          "custom",
          "M0,0 C0.644,0.017 0.497,1.066 0.859,0.979 0.924,0.963 0.942,0.963 1,1 ",
        )*/
          // physicsProps: {
          //   // x: { velocity: 10, acceleration: 20 },
          //   y: { velocity: -50, acceleration: 10 },
          // },
          // physics2D: { velocity: 60, angle: -90, gravity: 100 },
          duration: 4.5,
          // scaleY: 0,
          stagger: {
            from: "edges", //"center",
            amount: 0.8,
          },
        },
        "start"
      );

      tl.to(
        title.chars,
        {
          duration: 1.5,
          textShadow: "-1px 0.05em 0.1em orange, 1px 0.2em 0.2em red",
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
        "title-start"
      );

      tl.addLabel("title-end");

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
        "title-end-=2"
      );

      const subtitleChars = SplitText.create(`.${styles.subtitle}`, {
        type: "chars",
      });

      tl.from(
        subtitleChars.chars,
        {
          autoAlpha: 0,
          y: -10,
          rotationX: 85,
          duration: 2,
          stagger: {
            from: "edges", //"center",
            amount: 0.4,
          },
        },
        "title-end-=1"
      );

      tl.to(
        `.${styles.buttonGroup} button`,
        {
          y: 0,
          duration: 1.5,
          autoAlpha: 1,
          ease: "power2.out",
          stagger: 0.4,
          onStart: focusLaunchButton,
          onComplete: focusLaunchButton,
        },
        "-=2"
      );

      // TODO: CASSIE -- Can we add a Click to speed up the timeline?
    },
    { scope: containerRef }
  );

  return (
    <div
      ref={containerRef}
      onClick={() => tlRef.current?.timeScale(7)}
      className={styles.container}
    >
      <div className={styles.subtitle}>Explore the Apollo Missions</div>
      <h1 className={styles.title}>Lunar Landing</h1>
      <div className={styles.buttonGroup}>
        <Button onClick={onLaunch} large data-primary="true">
          Launch
        </Button>
        <Button onClick={onExploreMissions} subtle>
          Explore
        </Button>
      </div>
    </div>
  );
}
