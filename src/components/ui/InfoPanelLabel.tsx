import { useRef, type HTMLAttributes } from "react";
import gsap from "gsap";
import SplitText from "gsap/SplitText";
import classNames from "classnames";

import { useGSAP } from "@gsap/react";
import styles from "./InfoPanelLabel.module.css";
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

type LabelProps = HTMLAttributes<HTMLDivElement>;

export default function InfoPanelLabel({
  className,
  children,
  ...props
}: LabelProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!containerRef.current) return;
    },
    { scope: containerRef },
  );

  return (
    <div className={classNames(styles.root, className)} {...props}>
      <span className={styles.slash}>/</span>
      <span className={styles.slash}>/</span>
      <span className={styles.text}>{children}</span>
    </div>
  );
}
