import { useRef } from "react";
import { AcaIcon, type AcaIconName } from "../icons/AcaIcon";
import { motionDuration, useStepMotion } from "./acaMotion";

export function ArithmeticFlow({
  stages,
  index,
  note,
  speed,
  cycle,
}: {
  stages: Array<{ icon: AcaIconName; label: string; tip: string }>;
  index: number;
  note: string;
  speed: number;
  cycle: number;
}) {
  const root = useRef<HTMLDivElement>(null);
  useStepMotion(root, cycle, speed, (timeline) => {
    timeline.fromTo(".aca-stage.on", { scale: 0.96 }, { scale: 1, duration: motionDuration(speed) });
  });
  return (
    <div className="aca-flow" ref={root}>
      {stages.map((stage, cursor) => (
        <span key={stage.label} className={`aca-stage ${cursor === index ? "on" : ""} ${cursor < index ? "done" : ""}`} title={stage.tip}>
          <AcaIcon name={stage.icon} decorative />
          {stage.label}
        </span>
      ))}
      <p>{note}</p>
    </div>
  );
}
