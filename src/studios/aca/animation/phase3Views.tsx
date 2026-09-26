import { useRef } from "react";
import { AcaIcon, type AcaIconName } from "../icons/AcaIcon";
import { motionDuration, useStepMotion } from "./acaMotion";

function Strip({
  title, stages, text, speed, cycle, travel, warn,
}: {
  title: string;
  stages: Array<{ icon: AcaIconName; label: string; on?: boolean; warn?: boolean }>;
  text: string;
  speed: number;
  cycle: number;
  travel: boolean;
  warn?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  useStepMotion(root, cycle, speed, (timeline) => {
    if (!travel) return;
    timeline.fromTo(".aca-token", { x: 0, autoAlpha: 1 }, { x: 96, duration: motionDuration(speed) }, 0);
    timeline.fromTo(".aca-stage.on", { scale: 0.96 }, { scale: 1, duration: motionDuration(speed) }, 0);
  });
  return (
    <div className={`aca-flow ${warn ? "warn" : ""}`} ref={root} title={title}>
      {stages.map((stage) => (
        <span key={stage.label} className={`aca-stage ${stage.on ? "on" : ""} ${stage.warn ? "warn" : ""}`}>
          <AcaIcon name={stage.icon} /> {stage.label}
        </span>
      ))}
      <svg viewBox="0 0 110 28" className="aca-flow-svg" aria-hidden="true">
        <path className="aca-flow-line" d="M4 14 H106" />
        <circle className="aca-token" cx="8" cy="14" r="4" />
      </svg>
      <p>{text}</p>
    </div>
  );
}

export function TrafficHop({ message, bytes, from, to, live, speed, cycle }: { message: string; bytes: number; from: string; to: string; live: boolean; speed: number; cycle: number }) {
  return (
    <Strip
      title="A coherence message moves a request, an invalidation, or a cache line."
      stages={[
        { icon: "cache", label: from || "Core", on: live },
        { icon: "bus", label: message || "Quiet", on: live },
        { icon: "memory", label: bytes > 0 ? `${bytes} B` : "Control", on: bytes > 0 },
        { icon: "owner", label: to || "Memory" },
      ]}
      text={live ? `${message || "Message"} ${from} → ${to}.${bytes > 0 ? ` Payload ${bytes} bytes.` : " No data payload on this message."}` : "No new coherence message on this step. A private hit stays inside one cache."}
      speed={speed}
      cycle={cycle}
      travel={live}
    />
  );
}

export function FabricPair({ snoop, directory, broadcasts, lookups, speed, cycle }: { snoop: string; directory: string; broadcasts: number; lookups: number; speed: number; cycle: number }) {
  const root = useRef<HTMLDivElement>(null);
  useStepMotion(root, cycle, speed, (timeline) => {
    timeline.fromTo(".aca-flow-line", { strokeDashoffset: 140 }, { strokeDashoffset: 0, duration: motionDuration(speed) });
  });
  return (
    <div className="aca-flow" ref={root} title="Snooping contacts every cache. The directory contacts the recorded participants.">
      <span className="aca-stage on"><AcaIcon name="bus" /> Snoop {snoop || "quiet"}</span>
      <span className="aca-stage"><AcaIcon name="broadcast" /> Broadcasts {broadcasts}</span>
      <span className="aca-stage on"><AcaIcon name="directory" /> Directory {directory || "quiet"}</span>
      <span className="aca-stage"><AcaIcon name="sharer" /> Lookups {lookups}</span>
      <p>Snooping asks every other cache. The directory asks the owner and the recorded sharers. Both sides are this same request.</p>
    </div>
  );
}

export function MshrPath({ mode, occupancy, merged, speed, cycle }: { mode: "merge" | "full" | "fill" | "miss" | "idle"; occupancy: number; merged: number; speed: number; cycle: number }) {
  const text = mode === "full"
    ? "The cache is non-blocking, but only while an MSHR is available."
    : mode === "merge"
      ? "This miss joined an MSHR that already owns the block. It did not start another memory request."
      : mode === "fill"
        ? "Returned data wakes every request waiting on that MSHR."
        : mode === "miss"
          ? "The miss took a free MSHR and a memory request left for that block."
          : "No new miss is allocating an MSHR on this step.";
  return (
    <Strip
      title="An MSHR holds one outstanding miss until its block returns."
      stages={[
        { icon: "fetch", label: "Request", on: mode !== "idle" },
        { icon: "mshr", label: `MSHR ${occupancy}`, on: occupancy > 0, warn: mode === "full" },
        { icon: "memory", label: mode === "merge" ? `Merged ${merged}` : "Memory", on: mode === "miss" || mode === "fill" },
      ]}
      text={text}
      speed={speed}
      cycle={cycle}
      travel={mode === "miss" || mode === "fill" || mode === "merge"}
      warn={mode === "full"}
    />
  );
}

export function PrefetchMark({ result, detail, speed, cycle }: { result: string; detail: string; speed: number; cycle: number }) {
  const late = result === "late";
  const useful = result === "useful";
  const useless = result === "useless" || result === "drop";
  return (
    <Strip
      title="A prefetch is a request issued before the demand that might use it."
      stages={[
        { icon: "predictor", label: result === "issued" ? "Prefetch" : "Demand", on: result !== "" },
        { icon: "cache", label: useful ? "Useful" : late ? "Late" : useless ? "Unused" : result || "Idle", on: useful, warn: late || useless },
        { icon: "memory", label: "Line" },
      ]}
      text={detail || "Step to see whether the next prefetch arrives before the demand."}
      speed={speed}
      cycle={cycle}
      travel={result === "issued" || useful || late}
      warn={late || useless}
    />
  );
}

export function DramStep({ command, kind, policy, queue, speed, cycle }: { command: string; kind: string; policy: string; queue: number; speed: number; cycle: number }) {
  const hit = kind === "hit";
  const conflict = kind === "conflict" || command === "PRE";
  return (
    <Strip
      title="The controller picks a queued request and drives one bank."
      stages={[
        { icon: "queue", label: `Queue ${queue}` },
        { icon: "dram", label: policy === "frfcfs" ? "FR-FCFS" : "FCFS", on: true },
        { icon: "memory", label: hit ? "ROW HIT" : conflict ? "PRE / ACT" : command || "Bank", on: hit, warn: conflict },
      ]}
      text={hit ? "The requested row is already open, so the column access starts." : conflict ? "The open row must be precharged before the new row is activated." : `${policy === "frfcfs" ? "FR-FCFS prefers a ready row hit over an older conflict." : "FCFS issues the oldest request for a free bank."} Command ${command || "idle"}.`}
      speed={speed}
      cycle={cycle}
      travel={Boolean(command)}
      warn={conflict}
    />
  );
}

export function OrderMove({ model, buffered, fences, speed, cycle }: { model: string; buffered: number; fences: number; speed: number; cycle: number }) {
  return (
    <Strip
      title="A store can sit in a thread's buffer before it becomes visible in shared memory."
      stages={[
        { icon: "execute", label: model.toUpperCase(), on: true },
        { icon: "queue", label: `Buffer ${buffered}`, on: buffered > 0 },
        { icon: "fence", label: `Fences ${fences}`, on: fences > 0 },
        { icon: "memory", label: "Shared memory" },
      ]}
      text={buffered > 0 ? "A store is visible to its own thread from the buffer before other threads can read it from shared memory." : "No store is waiting in a buffer on this step. A fence keeps a later operation from passing it."}
      speed={speed}
      cycle={cycle}
      travel={buffered > 0}
    />
  );
}

export function LockContest({ kind, owner, acquires, fails, speed, cycle }: { kind: string; owner: number | null; acquires: number; fails: number; speed: number; cycle: number }) {
  return (
    <Strip
      title="Threads contend for one synchronization object."
      stages={[
        { icon: "lock", label: kind.toUpperCase(), on: true },
        { icon: "owner", label: owner == null ? "Free" : `Thread ${owner}`, on: owner != null },
        { icon: "stall", label: `Fails ${fails}`, warn: fails > 0 },
        { icon: "commit", label: `Acquires ${acquires}`, on: acquires > 0 },
      ]}
      text={kind === "tas" ? "Test-and-set can let the thread that just released the lock win the next attempt." : kind === "ticket" ? "Each thread holds its own ticket. The lock serves them in ticket order." : kind === "llsc" ? "A store-conditional succeeds only while this thread's reservation is still valid." : `Successful acquisitions ${acquires}. Failed attempts ${fails}.`}
      speed={speed}
      cycle={cycle}
      travel={owner != null}
      warn={fails > acquires && fails > 0}
    />
  );
}

export function ScaleSplit({ cores, serial, parallel, overhead, speedup, speed, cycle }: { cores: number; serial: number; parallel: number; overhead: number; speedup: number; speed: number; cycle: number }) {
  const root = useRef<HTMLDivElement>(null);
  useStepMotion(root, cycle, speed, (timeline) => {
    timeline.fromTo(".aca-stage.on", { scale: 0.94 }, { scale: 1, stagger: 0.03, duration: motionDuration(speed) });
  });
  const lanes = Math.max(1, Math.min(8, cores));
  return (
    <div className="aca-flow" ref={root} title="Serial work stays in one lane. Parallel work splits. Overhead is extra time.">
      <span className="aca-stage warn"><AcaIcon name="stall" /> Serial {serial.toFixed(2)}</span>
      {Array.from({ length: lanes }, (_, index) => <span key={index} className="aca-stage on"><AcaIcon name="execute" /> C{index}</span>)}
      <span className="aca-stage"><AcaIcon name="broadcast" /> Overhead {overhead.toFixed(2)}</span>
      <p>{cores} cores. Parallel work {parallel.toFixed(2)} splits across them. Speedup {speedup.toFixed(2)}×. The serial region does not split, so more cores do not multiply the whole program.</p>
    </div>
  );
}

export function RoofPoint({ bound, intensity, attained, speed, cycle }: { bound: string; intensity: number; attained: number; speed: number; cycle: number }) {
  const memory = bound === "memory";
  return (
    <Strip
      title="The ridge is where the memory roof meets the compute roof."
      stages={[
        { icon: "memory", label: "Bandwidth", on: memory, warn: memory },
        { icon: "execute", label: bound === "compute" ? "Compute" : bound === "transition" ? "Ridge" : "Memory", on: true },
        { icon: "counter", label: `${attained.toFixed(2)}` },
      ]}
      text={memory ? `Arithmetic intensity ${intensity.toFixed(2)} FLOP/byte is left of the ridge, so bandwidth sets the roof.` : bound === "compute" ? `Arithmetic intensity ${intensity.toFixed(2)} FLOP/byte is right of the ridge, so peak compute sets the roof.` : `The workload is near the ridge at ${intensity.toFixed(2)} FLOP/byte.`}
      speed={speed}
      cycle={cycle}
      travel
    />
  );
}

export function CpiStack({ parts, highlight, cpi, ipc, speed, cycle }: { parts: Array<{ id: string; cycles: number }>; highlight: string; cpi: number; ipc: number; speed: number; cycle: number }) {
  const root = useRef<HTMLDivElement>(null);
  const total = parts.reduce((sum, part) => sum + part.cycles, 0) || 1;
  useStepMotion(root, cycle, speed, (timeline) => {
    timeline.fromTo(".aca-stage.warn", { scaleY: 0.82 }, { scaleY: 1, duration: motionDuration(speed), transformOrigin: "center" });
  });
  return (
    <div className="aca-flow" ref={root} title="Each segment is one exclusive stall bucket. CPI is their sum divided by instructions.">
      {parts.map((part) => (
        <span key={part.id} className={`aca-stage ${part.id === highlight ? "warn" : "on"}`} style={{ minWidth: `${Math.max(18, (part.cycles / total) * 160)}px` }}>
          {part.id} {(part.cycles / total * 100).toFixed(0)}%
        </span>
      ))}
      <p>The highlighted bucket is the largest stall. CPI {cpi.toFixed(2)} and IPC {ipc.toFixed(2)} are reciprocals of the same cycle and instruction counts.</p>
    </div>
  );
}

export function CounterDerive({ ipc, mpki, bandwidth, memoryShare, speed, cycle }: { ipc: number; mpki: number; bandwidth: number; memoryShare: number; speed: number; cycle: number }) {
  return (
    <Strip
      title="Derived metrics are ratios of the raw counters, not separate measurements."
      stages={[
        { icon: "counter", label: "Counters", on: true },
        { icon: "execute", label: `IPC ${ipc.toFixed(2)}`, on: true },
        { icon: "miss", label: `MPKI ${mpki.toFixed(2)}` },
        { icon: "memory", label: `${bandwidth.toFixed(2)} GB/s`, warn: memoryShare > 0.4 },
      ]}
      text={memoryShare > 0.4 ? "Memory-stall share is high on this sample. That points at misses only as far as these counters record stall cycles." : "Instructions and cycles produce IPC. Misses and instructions produce MPKI. Bytes and time produce bandwidth."}
      speed={speed}
      cycle={cycle}
      travel
      warn={memoryShare > 0.4}
    />
  );
}
