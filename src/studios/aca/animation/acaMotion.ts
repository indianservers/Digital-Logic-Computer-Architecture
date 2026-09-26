import { useRef, type RefObject } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

export function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Duration in seconds. The simulator speed slider shortens the transition. */
export function motionDuration(speed: number) {
  if (reducedMotion()) return 0.05;
  return Math.min(0.45, Math.max(0.16, 0.32 / Math.max(speed, 0.25)));
}

export function useStepMotion(
  scope: RefObject<HTMLElement | null>,
  cycle: number,
  speed: number,
  build: (timeline: gsap.core.Timeline) => void,
) {
  const timeline = useRef<gsap.core.Timeline | null>(null);
  useGSAP(() => {
    timeline.current?.kill();
    const next = gsap.timeline({ defaults: { ease: "power2.out", overwrite: "auto" } });
    timeline.current = next;
    build(next);
  }, { scope, dependencies: [cycle, speed], revertOnUpdate: true });
  return timeline;
}
