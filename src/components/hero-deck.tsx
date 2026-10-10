"use client";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
type CSSVars = React.CSSProperties & Record<`--${string}`, string>;
export type DeckFounder = { slug: string; name: string; accent: string };
const MOBILE = "(max-width: 767.98px)";
const REDUCED = "(prefers-reduced-motion: reduce)";
const CYCLE_MS = 4000;
function useMedia(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const m = matchMedia(query);
      m.addEventListener("change", onChange);
      return () => m.removeEventListener("change", onChange);
    },
    () => matchMedia(query).matches,
    () => false,
  );
}
// Index of the [data-deck] slot an event came from, or -1.
function slotIndex(target: EventTarget) {
  const slot = (target as Element).closest?.("[data-deck]");
  return slot ? Number(slot.getAttribute("data-deck")) : -1;
}
// On mobile the founder cards (server-rendered children carrying data-deck)
// share one spot and cycle; data-active tells the CSS which one is in front.
// On desktop the stage renders as before and nothing here intercepts.
export function HeroDeck({
  founders,
  children,
}: {
  founders: DeckFounder[];
  children: React.ReactNode;
}) {
  const deck = useMedia(MOBILE) && founders.length > 1;
  const reduced = useMedia(REDUCED);
  const [active, setActive] = useState(0);
  // Arc animation only after the first swap, so nothing animates on load.
  const [animate, setAnimate] = useState(false);
  const [focused, setFocused] = useState(false);
  const [touching, setTouching] = useState(false);
  const show = useCallback(
    (i: number) => {
      setActive(i);
      setAnimate(!reduced);
    },
    [reduced],
  );
  // Re-armed whenever the front card changes, so a manual pick restarts it.
  useEffect(() => {
    if (!deck || reduced || focused || touching) return;
    const t = setTimeout(() => show((active + 1) % founders.length), CYCLE_MS);
    return () => clearTimeout(t);
  }, [deck, reduced, focused, touching, active, founders.length, show]);
  return (
    <div
      className="hero-stage"
      data-active={active}
      data-animate={animate || undefined}
      // One founder: the company card stacks behind it at every width.
      data-single={founders.length === 1 || undefined}
      // Tapping the back card brings it forward instead of opening it.
      onClickCapture={(e) => {
        const i = slotIndex(e.target);
        if (deck && i >= 0 && i !== active) {
          e.preventDefault();
          show(i);
        }
      }}
      // Keyboard focus pauses the cycle and brings that card forward.
      onFocus={(e) => {
        const i = slotIndex(e.target);
        if (i < 0 || !(e.target as Element).matches(":focus-visible")) return;
        setFocused(true);
        if (deck && i !== active) show(i);
      }}
      onBlur={(e) => {
        if (slotIndex(e.target) >= 0) setFocused(false);
      }}
      onTouchStart={(e) => {
        if (slotIndex(e.target) >= 0) setTouching(true);
      }}
      onTouchEnd={() => setTouching(false)}
      onTouchCancel={() => setTouching(false)}
    >
      {children}
      {founders.length > 1 && (
        <div className="hero-dots">
          {founders.map((f, i) => (
            <button
              key={f.slug}
              type="button"
              className="hero-dot"
              aria-label={`Show ${f.name}'s card`}
              aria-pressed={i === active}
              style={{ "--accent": f.accent } as CSSVars}
              onClick={() => show(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
