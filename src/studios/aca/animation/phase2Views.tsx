import { useRef } from "react";
import { AcaIcon, type AcaIconName } from "../icons/AcaIcon";
import { motionDuration, useStepMotion } from "./acaMotion";

function Lanes({ width, active }: { width: number; active: number }) {
  return (
    <span className="aca-lanes" aria-hidden="true">
      {Array.from({ length: width }, (_, index) => <i key={index} className={index < active ? "on" : "wait"} />)}
    </span>
  );
}

export function WidthFlow({
  stages, bottleneck, note, speed, cycle,
}: {
  stages: Array<{ label: string; icon: AcaIconName; width: number; active: number }>;
  bottleneck: string;
  note: string;
  speed: number;
  cycle: number;
}) {
  const root = useRef<HTMLDivElement>(null);
  useStepMotion(root, cycle, speed, (timeline) => {
    timeline.fromTo(".aca-token", { x: 0 }, { x: 72, duration: motionDuration(speed) }, 0);
    timeline.fromTo(".aca-stage.warn", { scale: 0.96 }, { scale: 1, duration: motionDuration(speed) }, 0);
  });
  return (
    <div className="aca-flow" ref={root} title="A later narrow stage limits how much a wide front end can retire.">
      {stages.map((stage) => (
        <span key={stage.label} className={`aca-stage ${stage.label === bottleneck ? "warn" : ""} ${stage.active > 0 ? "on" : ""}`}>
          <AcaIcon name={stage.icon} />
          {stage.label}
          <Lanes width={stage.width} active={stage.active} />
        </span>
      ))}
      <svg viewBox="0 0 80 28" className="aca-flow-svg" aria-hidden="true">
        <path className="aca-flow-line" d="M4 14 H76" />
        <circle className="aca-token" cx="8" cy="14" r="4" />
      </svg>
      <p>{bottleneck === "balanced" ? `No stage is narrower than the others. ${note}` : `Current bottleneck: ${bottleneck}. ${note}`}</p>
    </div>
  );
}

export function WakeupPulse({
  woken, selected, readyWaiting, speed, cycle,
}: {
  woken: string[];
  selected: string[];
  readyWaiting: number;
  speed: number;
  cycle: number;
}) {
  const root = useRef<HTMLDivElement>(null);
  useStepMotion(root, cycle, speed, (timeline) => {
    if (woken.length) timeline.fromTo(".aca-token", { x: 0, autoAlpha: 1 }, { x: 110, duration: motionDuration(speed) }, 0);
    if (selected.length) timeline.fromTo(".aca-stage.on", { scale: 0.94 }, { scale: 1, duration: motionDuration(speed) }, 0);
  });
  return (
    <div className="aca-flow" ref={root} title="Wakeup delivers a completed tag. Select then chooses among ready instructions.">
      <span className="aca-end"><AcaIcon name="broadcast" /> Producer</span>
      <svg viewBox="0 0 120 28" className="aca-flow-svg" aria-hidden="true">
        <path className="aca-flow-line" d="M4 14 H116" />
        <circle className="aca-token" cx="8" cy="14" r="4" />
      </svg>
      <span className={`aca-stage ${woken.length ? "on" : ""}`}><AcaIcon name="wakeup" /> {woken.length ? woken.join(", ") : "No wakeup"}</span>
      <span className={`aca-stage ${selected.length ? "on" : ""}`}><AcaIcon name="issue" /> {selected.length ? selected.join(", ") : "None selected"}</span>
      <p>{readyWaiting > 0 ? `${readyWaiting} instruction${readyWaiting === 1 ? " is" : "s are"} ready but waiting: operands are ready, and a unit or the issue width is not.` : woken.length ? "Matching sources became ready and can be selected." : "No producer completed a tag that a waiting source needed."}</p>
    </div>
  );
}

export function PrfFlow({
  allocated, reclaimed, stalled, free, speed, cycle,
}: {
  allocated: string;
  reclaimed: boolean;
  stalled: boolean;
  free: number;
  speed: number;
  cycle: number;
}) {
  const root = useRef<HTMLDivElement>(null);
  useStepMotion(root, cycle, speed, (timeline) => {
    const distance = stalled ? 0 : reclaimed ? -90 : allocated ? 110 : 0;
    timeline.fromTo(".aca-token", { x: 0 }, { x: distance, duration: motionDuration(speed) });
  });
  return (
    <div className={`aca-flow ${stalled ? "warn" : ""}`} ref={root} title="Rename takes a physical register from the free list. Commit returns the previous one.">
      <span className="aca-end"><AcaIcon name="register" /> Arch</span>
      <span className="aca-stage"><AcaIcon name="rat" /> RAT</span>
      <span className={`aca-stage ${stalled ? "warn" : ""}`}><AcaIcon name="free" /> Free {free}</span>
      <svg viewBox="0 0 120 28" className="aca-flow-svg" aria-hidden="true">
        <path className="aca-flow-line" d="M4 14 H116" />
        <circle className="aca-token" cx="8" cy="14" r="4" />
      </svg>
      <span className={`aca-end ${reclaimed ? "done" : ""}`}><AcaIcon name="commit" /> {reclaimed ? "Reclaim" : allocated || "PRF"}</span>
      <p>{stalled ? "Rename is stalled because no physical register is available. Retirement must reclaim one first." : reclaimed ? "Commit returned a previous physical register to the free list." : allocated ? `${allocated} left the free list and became the active RAT mapping.` : "No allocation or reclaim on this step."}</p>
    </div>
  );
}

export function MemoryFlow({
  mode, text, speed, cycle,
}: {
  mode: "forward" | "replay" | "speculative" | "full" | "resolve" | "idle";
  text: string;
  speed: number;
  cycle: number;
}) {
  const root = useRef<HTMLDivElement>(null);
  useStepMotion(root, cycle, speed, (timeline) => {
    if (mode === "idle") return;
    timeline.fromTo(".aca-token", { x: mode === "replay" ? 100 : 0 }, { x: mode === "replay" ? 0 : 100, duration: motionDuration(speed) });
  });
  const label = mode === "forward" ? "Store → load" : mode === "replay" ? "Replay" : mode === "speculative" ? "Speculative load" : mode === "full" ? "Queue full" : mode === "resolve" ? "Address" : "Memory";
  return (
    <div className={`aca-flow ${mode === "replay" || mode === "full" ? "warn" : ""}`} ref={root}>
      <span className="aca-end"><AcaIcon name="agu" /> AGU</span>
      <span className="aca-stage"><AcaIcon name="lsq" /> Store queue</span>
      <svg viewBox="0 0 110 28" className="aca-flow-svg" aria-hidden="true">
        <path className="aca-flow-line" d="M4 14 H106" />
        <circle className="aca-token" cx="8" cy="14" r="4" />
      </svg>
      <span className={`aca-stage ${mode === "forward" ? "done" : mode === "replay" || mode === "speculative" || mode === "full" ? "warn" : ""}`}><AcaIcon name={mode === "replay" ? "replay" : "memory"} /> {label}</span>
      <p>{text}</p>
    </div>
  );
}

export function PolicyPath({
  action, replay, waits, bypasses, speed, cycle,
}: {
  action: string;
  replay: boolean;
  waits: number;
  bypasses: number;
  speed: number;
  cycle: number;
}) {
  const root = useRef<HTMLDivElement>(null);
  const waiting = action.toLowerCase().includes("wait");
  useStepMotion(root, cycle, speed, (timeline) => {
    timeline.fromTo(".aca-token", { x: 0 }, { x: waiting ? 40 : 100, duration: motionDuration(speed) });
  });
  return (
    <div className={`aca-flow ${replay ? "warn" : ""}`} ref={root} title="The policy chooses whether a load waits for an unknown older store.">
      <span className="aca-stage">Older stores?</span>
      <span className="aca-stage">Address known?</span>
      <span className={`aca-stage ${waiting ? "warn" : "on"}`}>{waiting ? "Wait" : action || "Policy"}</span>
      <svg viewBox="0 0 110 28" className="aca-flow-svg" aria-hidden="true">
        <path className="aca-flow-line" d="M4 14 H106" />
        <circle className="aca-token" cx="8" cy="14" r="4" />
      </svg>
      <span className={`aca-stage ${replay ? "warn" : "done"}`}><AcaIcon name={replay ? "replay" : "forward"} /> {replay ? "Replay" : "Proceed"}</span>
      <p>{replay ? "A later conflict invalidated the speculative load, so it replays." : `Waits ${waits}. Bypasses ${bypasses}. ${waiting ? "Conservative waiting holds the load behind an uncertain store." : "The policy let this load pass an older store."}`}</p>
    </div>
  );
}

export function PortFlow({
  ports, chosen, waiting, speed, cycle,
}: {
  ports: Array<{ id: number; label: string; hot: boolean }>;
  chosen: string;
  waiting: number;
  speed: number;
  cycle: number;
}) {
  const root = useRef<HTMLDivElement>(null);
  useStepMotion(root, cycle, speed, (timeline) => {
    timeline.fromTo(".aca-token", { x: 0 }, { x: 90, duration: motionDuration(speed) });
    if (waiting > 0) timeline.fromTo(".aca-stage.warn", { scale: 0.96 }, { scale: 1, duration: motionDuration(speed) }, 0);
  });
  return (
    <div className="aca-flow" ref={root} title="A µop issues onto one port that implements its operation.">
      <span className="aca-end"><AcaIcon name="queue" /> Scheduler</span>
      <svg viewBox="0 0 100 28" className="aca-flow-svg" aria-hidden="true">
        <path className="aca-flow-line" d="M4 14 H96" />
        <circle className="aca-token" cx="8" cy="14" r="4" />
      </svg>
      {ports.map((port) => (
        <span key={port.id} className={`aca-stage ${port.hot ? "on" : ""} ${port.hot && waiting > 0 ? "warn" : ""}`}>
          <AcaIcon name="port" /> P{port.id}
          <small>{port.label}</small>
        </span>
      ))}
      <p>{chosen ? `${chosen} is moving onto a compatible port.` : "No operation is issued this cycle."} {waiting > 0 ? `${waiting} ready operation${waiting === 1 ? "" : "s"} still wait because the compatible ports are busy.` : "Ready operations that match a free port can leave."}</p>
    </div>
  );
}

export function CoherenceBus({
  bus, from, to, detail, stale, live, speed, cycle,
}: {
  bus: string;
  from: string;
  to: string;
  detail: string;
  stale: boolean;
  live: boolean;
  speed: number;
  cycle: number;
}) {
  const root = useRef<HTMLDivElement>(null);
  useStepMotion(root, cycle, speed, (timeline) => {
    if (!live) return;
    timeline.fromTo(".aca-token", { x: 0, autoAlpha: 1 }, { x: 120, autoAlpha: 1, duration: motionDuration(speed) }, 0);
    timeline.fromTo(".aca-stage.on", { scale: 0.94 }, { scale: 1, duration: motionDuration(speed) * 0.6 }, ">");
  });
  return (
    <div className="aca-flow" ref={root} title="A coherence message travels the shared interconnect and changes a cache-line state.">
      <span className="aca-end"><AcaIcon name="cache" /> {from || "—"}</span>
      <svg viewBox="0 0 130 28" className="aca-flow-svg" aria-hidden="true">
        <path className="aca-flow-line" d="M4 14 H126" />
        <circle className="aca-token" cx="8" cy="14" r="4" />
      </svg>
      <span className="aca-stage"><AcaIcon name="bus" /> {live ? bus || "Quiet" : "Quiet"}</span>
      <span className={`aca-stage ${live ? "on" : ""}`}>{to || "—"}</span>
      <span className={`aca-stage ${stale ? "warn" : "done"}`}><AcaIcon name="memory" /> {stale ? "Memory stale" : "Memory current"}</span>
      <p>{live ? `${bus}: ${from} → ${to}. ${detail}` : "No new bus transaction on this step."}</p>
    </div>
  );
}

export function DirectoryFlow({
  kind, source, destination, sharers, owner, speed, cycle,
}: {
  kind: string;
  source: string;
  destination: string;
  sharers: number;
  owner: string;
  speed: number;
  cycle: number;
}) {
  const root = useRef<HTMLDivElement>(null);
  useStepMotion(root, cycle, speed, (timeline) => {
    if (!kind) return;
    timeline.fromTo(".aca-token", { x: 0 }, { x: 100, duration: motionDuration(speed) });
  });
  return (
    <div className="aca-flow" ref={root} title="Directory messages go only to the requester, the owner, or the recorded sharers.">
      <span className="aca-end"><AcaIcon name="cache" /> {source || "Core"}</span>
      <svg viewBox="0 0 110 28" className="aca-flow-svg" aria-hidden="true">
        <path className="aca-flow-line" d="M4 14 H106" />
        <circle className="aca-token" cx="8" cy="14" r="4" />
      </svg>
      <span className="aca-stage on"><AcaIcon name="directory" /> {kind || "Lookup"}</span>
      <span className="aca-end"><AcaIcon name={kind === "Inv" ? "invalidate" : "owner"} /> {destination || "Directory"}</span>
      <p>{kind ? `${kind} travels ${source} → ${destination}. This is a point-to-point message, not a bus broadcast.` : "The directory is idle on this step."} Owner {owner}. Sharers recorded: {sharers}.</p>
    </div>
  );
}

export function PingPong({
  from, to, moved, padding, shared, speed, cycle,
}: {
  from: string;
  to: string;
  moved: boolean;
  padding: boolean;
  shared: boolean;
  speed: number;
  cycle: number;
}) {
  const root = useRef<HTMLDivElement>(null);
  useStepMotion(root, cycle, speed, (timeline) => {
    if (!moved) return;
    timeline.fromTo(".aca-token", { x: 0 }, { x: 120, duration: motionDuration(speed) });
  });
  return (
    <div className={`aca-flow ${shared && moved ? "warn" : ""}`} ref={root} title="Coherence moves the whole line, even when the cores write different variables.">
      <span className="aca-end"><AcaIcon name="cache" /> {from}</span>
      <svg viewBox="0 0 130 28" className="aca-flow-svg" aria-hidden="true">
        <path className="aca-flow-line" d="M4 14 H126" />
        <circle className="aca-token" cx="8" cy="14" r="4" />
      </svg>
      <span className={`aca-stage ${shared ? "warn" : "done"}`}><AcaIcon name={padding ? "pad" : "line"} /> {padding ? "Separate lines" : "One line"}</span>
      <span className="aca-end"><AcaIcon name="owner" /> {to}</span>
      <p>{moved && shared ? `Ownership moved ${from} → ${to}. The other variable was not written, but it lost the line.` : padding || !shared ? "These variables do not share a line, so this access does not bounce the other core’s copy." : "The line stayed with the same owner."}</p>
    </div>
  );
}
