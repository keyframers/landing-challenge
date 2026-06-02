import { useEffect, type RefObject } from "react";

export function useModalKeyboard(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    function getButtons() {
      return Array.from(
        root.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"),
      );
    }

    requestAnimationFrame(() => {
      getButtons()[0]?.focus();
    });

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      const buttons = getButtons();
      if (buttons.length === 0) return;

      event.preventDefault();
      const currentIndex = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const direction = event.key === "ArrowDown" ? 1 : -1;
      const nextIndex =
        currentIndex === -1
          ? 0
          : (currentIndex + direction + buttons.length) % buttons.length;
      buttons[nextIndex]?.focus();
    }

    root.addEventListener("keydown", handleKeyDown);
    return () => root.removeEventListener("keydown", handleKeyDown);
  }, [ref]);
}
