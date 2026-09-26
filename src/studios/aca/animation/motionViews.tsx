import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { AcaIcon, type AcaIconName } from "../icons/AcaIcon";
import { motionDuration, useStepMotion } from "./acaMotion";

export function SmoothNumber({ value, speed, digits = 0 }: { value: number; speed: number; digits?: number }) {
  const ref = useRef<HTMLElement>(null);
  const shown = useRef(value);
  useGSAP(() => {
    const state = { n: shown.current };
    gsap.to(state, {
      n: value,
      duration: motionDuration(speed),
      ease: "power1.out",
      overwrite: "auto",
      onUpdate: () => {
        shown.current = state.n;
        if (ref.current) ref.current.textContent = state.n.toFixed(digits);
      },
    });
  }, { dependencies: [value, speed, digits], revertOnUpdate: true });
  return <strong ref={ref}>{value.toFixed(digits)}</strong>;
}

export function StageLegend({ names }: { names: Array<{ icon: AcaIconName; label: string }> }) {
  return (
    <p className="vl-legend aca-legend">
      {names.map((item) => (
        <span key={item.label} className={`aca-stage stage-${item.label.toLowerCase()}`} title={item.label}>
          <AcaIcon name={item.icon} size={16} />
          {item.label}
        </span>
      ))}
    </p>
  );
}

export function ForwardPath({ active, text, speed, cycle }: { active: boolean; text: string; speed: number; cycle: number }) {
  const root = useRef<HTMLDivElement>(null);
  useStepMotion(root, cycle, speed, (timeline) => {
    if (!active) return;
    timeline.fromTo(".aca-token", { x: 0 }, { x: 168, duration: motionDuration(speed) }, 0);
    timeline.fromTo(".aca-flow-line", { strokeDashoffset: 160 }, { strokeDashoffset: 0, duration: motionDuration(speed) }, 0);
    timeline.to(".aca-end", { scale: 1.08, duration: motionDuration(speed) * 0.4, yoyo: true, repeat: 1 }, ">");
  });
  return (
    <div className={`aca-flow ${active ? "on" : ""}`} ref={root}>
      <span className="aca-end"><AcaIcon name="execute" /> Producer</span>
      <svg viewBox="0 0 180 28" className="aca-flow-svg" aria-hidden="true">
        <path className="aca-flow-line" d="M8 14 H172" />
        <circle className="aca-token" cx="12" cy="14" r="4" />
      </svg>
      <span className="aca-end"><AcaIcon name="forward" /> Consumer</span>
      <p>{active ? text : "No value is taking the forwarding path on this cycle."}</p>
    </div>
  );
}

export function ScoreboardFlow({ state, unit, speed, cycle, blocked }: { state: string; unit: string; speed: number; cycle: number; blocked: string }) {
  const root = useRef<HTMLDivElement>(null);
  const stages = ["Issue", "Read", "Execute", "Write"];
  const index = state === "Write" ? 3 : state === "Executing" ? 2 : state === "Reading" ? 1 : state === "Issued" ? 0 : -1;
  useStepMotion(root, cycle, speed, (timeline) => {
    timeline.fromTo(".aca-stage.on", { scale: 0.96 }, { scale: 1, duration: motionDuration(speed) });
  });
  return (
    <div className="aca-flow" ref={root}>
      {stages.map((label, cursor) => (
        <span key={label} className={`aca-stage ${cursor === index ? "on" : ""} ${cursor < index ? "done" : ""}`}>
          <AcaIcon name={cursor === 3 ? "writeback" : cursor === 2 ? "execute" : cursor === 1 ? "register" : "issue"} />
          {label}
        </span>
      ))}
      <p>{unit} is {state || "idle"}. {blocked}</p>
    </div>
  );
}

export function CdbBroadcast({ tag, value, dest, speed, cycle, live }: { tag: string; value: string; dest: string; speed: number; cycle: number; live: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  useStepMotion(root, cycle, speed, (timeline) => {
    if (!live) return;
    timeline.fromTo(".aca-token", { x: 0, autoAlpha: 1 }, { x: 150, duration: motionDuration(speed), ease: "power1.inOut" }, "broadcast");
    timeline.fromTo(".aca-flow-line", { strokeDashoffset: 150 }, { strokeDashoffset: 0, duration: motionDuration(speed) }, "broadcast");
    timeline.to(".aca-end.sink", { boxShadow: "0 0 0 3px rgba(37,99,235,.25)", duration: motionDuration(speed) * 0.5 }, ">");
  });
  return (
    <div className="aca-flow" ref={root} title="The common data bus broadcasts a completed result and its producer tag to waiting consumers.">
      <span className="aca-end"><AcaIcon name="unit" /> {tag || "FU"}</span>
      <svg viewBox="0 0 160 28" className="aca-flow-svg" aria-hidden="true">
        <path className="aca-flow-line" d="M6 14 H154" />
        <circle className="aca-token" cx="10" cy="14" r="4" />
      </svg>
      <span className="aca-end sink"><AcaIcon name="broadcast" /> {dest || "waiters"}</span>
      <p>{live ? `${tag} broadcasts ${value} toward ${dest}. Waiting Qj/Qk entries that match this tag capture the value.` : "No broadcast on this cycle. One result can use the bus."}</p>
    </div>
  );
}

export function RenameTravel({ allocated, free, speed, cycle, stalled }: { allocated: string; free: number; speed: number; cycle: number; stalled: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  useStepMotion(root, cycle, speed, (timeline) => {
    timeline.fromTo(".aca-token", { x: stalled ? 0 : 0 }, { x: stalled ? 0 : 120, duration: motionDuration(speed) });
  });
  return (
    <div className={`aca-flow ${stalled ? "warn" : ""}`} ref={root} title="The rename map points each architectural register at its current physical register.">
      <span className="aca-end"><AcaIcon name="free" /> Free {free}</span>
      <svg viewBox="0 0 140 28" className="aca-flow-svg" aria-hidden="true">
        <path className="aca-flow-line" d="M6 14 H134" />
        <circle className="aca-token" cx="10" cy="14" r="4" />
      </svg>
      <span className="aca-end"><AcaIcon name="rat" /> {allocated || "RAT"}</span>
      <p>{stalled ? "Rename stalled: the free list has no physical register to give this destination." : allocated ? `${allocated} left the free list and became the new mapping.` : "No new physical register was allocated on this step."}</p>
    </div>
  );
}

export function RobLife({ state, flushed, committed, speed, cycle, text }: { state: string; flushed: number; committed: number; speed: number; cycle: number; text: string }) {
  const root = useRef<HTMLDivElement>(null);
  const flushing = flushed > 0 || state === "Flushed" || state === "FLUSH";
  useStepMotion(root, cycle, speed, (timeline) => {
    if (flushing) {
      timeline.to(".aca-flush", { x: 8, autoAlpha: 0.35, stagger: 0.04, duration: motionDuration(speed) });
    } else if (state === "Committed" || state === "C") {
      timeline.fromTo(".aca-commit", { scale: 0.94 }, { scale: 1, duration: motionDuration(speed) });
    } else {
      timeline.fromTo(".aca-stage.on", { y: 4 }, { y: 0, duration: motionDuration(speed) });
    }
  });
  const stages = [
    ["Issued", "issue"],
    ["Executing", "execute"],
    ["Waiting to Commit", "writeback"],
    ["Committed", "commit"],
  ] as const;
  return (
    <div className={`aca-flow ${flushing ? "flush" : ""}`} ref={root} title="The reorder buffer holds in-flight instructions until they retire from the head.">
      {stages.map(([label, icon]) => (
        <span key={label} className={`aca-stage ${state === label ? "on" : ""} ${flushing ? "aca-flush" : ""} ${label === "Committed" ? "aca-commit" : ""}`}>
          <AcaIcon name={icon} />
          {label}
        </span>
      ))}
      <p>{text} Committed {committed}. Flushed {flushed}. A finished younger instruction stays in the buffer until the head retires.</p>
    </div>
  );
}

export function PredictorMachine({ current, speed, cycle, bitLabel }: { current: number; speed: number; cycle: number; bitLabel: string }) {
  const root = useRef<HTMLDivElement>(null);
  const states = ["Strongly NT", "Weakly NT", "Weakly T", "Strongly T"];
  useStepMotion(root, cycle, speed, (timeline) => {
    timeline.fromTo(".aca-stage.on", { scale: 0.92 }, { scale: 1, duration: motionDuration(speed) });
  });
  return (
    <div className="aca-flow" ref={root}>
      <span className={`aca-stage ${bitLabel.includes("Not") ? "" : "on"}`}><AcaIcon name="predictor" /> 1-bit {bitLabel}</span>
      {states.map((label, index) => (
        <span key={label} className={`aca-stage ${index === current ? "on" : ""}`}>
          {label}
        </span>
      ))}
      <p>Taken walks the counter toward Strongly T. Not-taken walks it toward Strongly NT. The highlighted state is the engine’s counter after this step.</p>
    </div>
  );
}

export function GshareFlow({ history, index, aliased, speed, cycle }: { history: string; index: number; aliased: boolean; speed: number; cycle: number }) {
  const root = useRef<HTMLDivElement>(null);
  useStepMotion(root, cycle, speed, (timeline) => {
    timeline.fromTo(".aca-token", { x: 0 }, { x: 90, duration: motionDuration(speed) });
  });
  return (
    <div className={`aca-flow ${aliased ? "warn" : ""}`} ref={root}>
      <span className="aca-end"><AcaIcon name="fetch" /> PC</span>
      <span className="aca-stage on">XOR</span>
      <span className="aca-end"><AcaIcon name="predictor" /> GHR {history || "—"}</span>
      <svg viewBox="0 0 100 28" className="aca-flow-svg" aria-hidden="true">
        <path className="aca-flow-line" d="M4 14 H96" />
        <circle className="aca-token" cx="8" cy="14" r="4" />
      </svg>
      <span className="aca-end">PHT {index}</span>
      <p>{aliased ? "Aliasing: two different branches are training the same predictor counter." : `This branch indexes PHT entry ${index} from the PC mixed with history ${history || "0"}.`}</p>
    </div>
  );
}

export function BtbLookup({ hit, target, index, speed, cycle }: { hit: boolean; target: string; index: number; speed: number; cycle: number }) {
  const root = useRef<HTMLDivElement>(null);
  useStepMotion(root, cycle, speed, (timeline) => {
    timeline.fromTo(".aca-token", { x: 0 }, { x: hit ? 140 : 70, duration: motionDuration(speed) });
  });
  return (
    <div className="aca-flow" ref={root} title="The branch target buffer stores a predicted target for a branch PC.">
      <span className="aca-end"><AcaIcon name="fetch" /> PC</span>
      <span className="aca-stage on">Set {index}</span>
      <span className={`aca-stage ${hit ? "done" : "warn"}`}><AcaIcon name={hit ? "hit" : "miss"} /> {hit ? "Hit" : "Miss"}</span>
      <svg viewBox="0 0 150 28" className="aca-flow-svg" aria-hidden="true">
        <path className="aca-flow-line" d="M4 14 H146" />
        <circle className="aca-token" cx="8" cy="14" r="4" />
      </svg>
      <span className="aca-end">{hit ? target : "fall through"}</span>
      <p>{hit ? `Tag matched. Target ${target} returns to fetch.` : "No matching tag. Fetch continues at the fall-through PC, and a miss can allocate a new entry."}</p>
    </div>
  );
}

export function ChooserFlow({ local, global, choice, disagree, speed, cycle }: { local: string; global: string; choice: string; disagree: boolean; speed: number; cycle: number }) {
  const root = useRef<HTMLDivElement>(null);
  useStepMotion(root, cycle, speed, (timeline) => {
    timeline.fromTo(".aca-stage.on", { y: 3 }, { y: 0, duration: motionDuration(speed) });
  });
  return (
    <div className="aca-flow" ref={root}>
      <span className={`aca-stage ${choice === "local" ? "on" : ""}`}><AcaIcon name="predictor" /> Local {local}</span>
      <span className={`aca-stage ${choice === "global" ? "on" : ""}`}><AcaIcon name="branch" /> Global {global}</span>
      <span className="aca-stage on"><AcaIcon name="commit" /> Chooser {choice || "—"}</span>
      <p>{choice === "" ? "Step to see which component the chooser selects." : disagree ? "The components disagree. The chooser trains toward the one that was right." : "Both components agreed, so the chooser does not need to change its trust."}</p>
    </div>
  );
}

export function SpecPath({ speculative, squashed, redirect, speed, cycle }: { speculative: number; squashed: number; redirect: boolean; speed: number; cycle: number }) {
  const root = useRef<HTMLDivElement>(null);
  useStepMotion(root, cycle, speed, (timeline) => {
    if (squashed > 0 || redirect) {
      timeline.to(".aca-flush", { x: 10, autoAlpha: 0.4, stagger: 0.05, duration: motionDuration(speed) });
    } else {
      timeline.fromTo(".aca-stage.on", { scale: 0.96 }, { scale: 1, duration: motionDuration(speed) });
    }
  });
  return (
    <div className={`aca-flow ${squashed > 0 ? "flush" : ""}`} ref={root}>
      <span className="aca-stage"><AcaIcon name="predictor" /> Predict</span>
      <span className={`aca-stage ${speculative > 0 ? "on" : ""}`}>SPEC {speculative}</span>
      <span className={`aca-stage aca-flush ${squashed > 0 ? "warn" : ""}`}><AcaIcon name="flush" /> Squash {squashed}</span>
      <span className="aca-stage"><AcaIcon name="fetch" /> {redirect ? "Corrected PC" : "Fetch"}</span>
      <p>{squashed > 0 ? "The branch disagreed with the prediction. Wrong-path instructions leave, and fetch restarts at the corrected PC." : speculative > 0 ? "These instructions are still speculative. They keep a SPEC mark until the branch resolves." : "Nothing younger than an unresolved branch is in flight."}</p>
    </div>
  );
}
