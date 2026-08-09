import { useCallback } from "react";

/**
 * Returns a keydown handler that moves focus (and activates) the previous/next
 * enabled button inside a pill toggle group when the user presses ArrowLeft or
 * ArrowRight.  Attach to the container element's `onKeyDown`.
 *
 * Usage:
 *   const handleArrowKey = useArrowKeyNav();
 *   <div role="group" onKeyDown={handleArrowKey}>…</div>
 */
export function useArrowKeyNav() {
  return useCallback((e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;

    const container = e.currentTarget;
    const buttons = Array.from(
      container.querySelectorAll<HTMLButtonElement>("button:not([disabled])")
    );
    if (buttons.length === 0) return;

    const idx = buttons.indexOf(e.target as HTMLButtonElement);
    if (idx === -1) return;

    e.preventDefault();

    const next =
      e.key === "ArrowRight"
        ? (idx + 1) % buttons.length
        : (idx - 1 + buttons.length) % buttons.length;

    buttons[next].focus();
    buttons[next].click();
  }, []);
}
