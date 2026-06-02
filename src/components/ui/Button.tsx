import { forwardRef, useRef, type HTMLAttributes } from "react";
import gsap from "gsap";
import SplitText from "gsap/SplitText";
import classNames from "classnames";

import { useGSAP } from "@gsap/react";
import styles from "./Button.module.css";
import { CustomEase } from "gsap/CustomEase";
import PhysicsPropsPlugin from "gsap/PhysicsPropsPlugin";
import Physics2DPlugin from "gsap/Physics2DPlugin";

gsap.registerPlugin(useGSAP, SplitText, CustomEase, PhysicsPropsPlugin, Physics2DPlugin);

type ButtonProps = HTMLAttributes<HTMLButtonElement> & {
  large?: boolean;
  subtle?: boolean;
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, large, subtle, children, ...props },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!containerRef.current) return;
    },
    { scope: containerRef }
  );

  return (
    <button
      className={classNames(styles.root, className)}
      data-large={large}
      data-subtle={subtle}
      ref={ref}
      {...props}
    >
      {children}
    </button>
  );
});

export default Button;
