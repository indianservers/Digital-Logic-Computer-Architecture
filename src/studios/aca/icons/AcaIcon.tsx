import type { ReactNode } from "react";

export type AcaIconName =
  | "fetch" | "decode" | "rename" | "dispatch" | "issue" | "execute" | "memory" | "writeback" | "commit"
  | "rob" | "station" | "register" | "rat" | "free" | "queue" | "lsq" | "btb" | "predictor" | "cache" | "branch" | "unit"
  | "stall" | "hazard" | "forward" | "replay" | "flush" | "broadcast" | "mispredict" | "hit" | "miss"
  | "play" | "pause" | "step" | "previous" | "reset" | "speed"
  | "width" | "wakeup" | "agu" | "port" | "line" | "bus" | "directory" | "owner" | "sharer" | "invalidate" | "pad"
  | "mshr" | "dram" | "lock" | "fence" | "counter";

const TIP: Record<AcaIconName, string> = {
  fetch: "Fetch reads the instruction at the program counter.",
  decode: "Decode reads the opcode and register names.",
  rename: "Rename maps an architectural register to a physical register.",
  dispatch: "Dispatch places the instruction into the window.",
  issue: "Issue sends a ready instruction to a functional unit.",
  execute: "Execute computes the result.",
  memory: "Memory reads or writes a data address.",
  writeback: "Writeback publishes the result.",
  commit: "Commit retires the instruction in program order.",
  rob: "The reorder buffer holds in-flight instructions until they can retire in order.",
  station: "A reservation station holds an operation, its operands, or the tags it is waiting for.",
  register: "The register file holds architectural values.",
  rat: "The rename map points each architectural register at its current physical register.",
  free: "The free list holds physical registers that can be allocated.",
  queue: "The issue queue holds instructions that are waiting for operands or a unit.",
  lsq: "The load-store queue keeps memory operations in program order.",
  btb: "The branch target buffer stores a predicted target for a branch PC.",
  predictor: "The predictor guesses taken or not taken before the branch resolves.",
  cache: "A cache keeps a tagged copy of a memory block.",
  branch: "The branch unit resolves the direction and the target.",
  unit: "A functional unit executes one class of operation.",
  stall: "A stall is a cycle where a stage cannot accept new work.",
  hazard: "A hazard is a dependence that can change when an instruction may proceed.",
  forward: "Forwarding supplies a result before it is written back to the register file.",
  replay: "Replay runs an instruction again after a bad speculation.",
  flush: "A flush discards work that must not become architectural state.",
  broadcast: "The common data bus broadcasts one completed result and its producer tag.",
  mispredict: "A misprediction means the guessed direction was wrong.",
  hit: "A hit means the looked-up entry was present.",
  miss: "A miss means the looked-up entry was absent.",
  play: "Play",
  pause: "Pause",
  step: "Step one cycle",
  previous: "Previous cycle",
  reset: "Reset",
  speed: "Simulation speed",
  width: "Stage width is how many instructions that stage can accept in one cycle.",
  wakeup: "Wakeup marks a waiting source ready when its producer completes.",
  agu: "The address-generation unit computes a memory address.",
  port: "An execution port accepts one operation that matches its capabilities.",
  line: "A cache line is the block coherence moves as a unit.",
  bus: "The shared bus carries a coherence request or a data response.",
  directory: "The directory records the owner and the sharers of a line.",
  owner: "The owner holds the authoritative copy of a line.",
  sharer: "A sharer holds a readable copy and is listed by the directory.",
  invalidate: "An invalidation drops a copy that is no longer allowed.",
  pad: "Padding moves the next variable onto its own cache line.",
  mshr: "A miss-status holding register tracks one outstanding cache miss.",
  dram: "The DRAM controller opens a row, then reads or writes a column.",
  lock: "A lock admits one thread to the critical section.",
  fence: "A fence keeps later memory operations from passing it.",
  counter: "A performance counter is a raw sample. Derived metrics come from those samples.",
};

function Glyph({ name }: { name: AcaIconName }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const paths: Record<AcaIconName, ReactNode> = {
    fetch: <path {...common} d="M5 7h9M5 12h14M5 17h9M16 5l3 2-3 2" />,
    decode: <path {...common} d="M7 6h10v12H7zM9 10h6M9 14h4" />,
    rename: <path {...common} d="M6 8h5l2 4-2 4H6M13 12h5" />,
    dispatch: <path {...common} d="M5 8h8v8H5zM13 12h6M16 9l3 3-3 3" />,
    issue: <path {...common} d="M6 12h10M13 8l4 4-4 4" />,
    execute: <path {...common} d="M8 16V8l8 4-8 4z" />,
    memory: <path {...common} d="M6 7h12v10H6zM6 11h12M6 15h12M9 7v10" />,
    writeback: <path {...common} d="M7 7h10v4H7zM8 15h8M12 11v4" />,
    commit: <path {...common} d="M6 12l4 4 8-8" />,
    rob: <path {...common} d="M5 6h14v3H5zM5 11h14v3H5zM5 16h14v3H5z" />,
    station: <path {...common} d="M6 6h12v12H6zM9 10h6M9 14h4" />,
    register: <path {...common} d="M5 8h14M5 12h14M5 16h14M8 6v12" />,
    rat: <path {...common} d="M5 8h6v8H5zM13 12h3M16 8l3 4-3 4" />,
    free: <path {...common} d="M8 8h8v8H8zM12 8v8M8 12h8" />,
    queue: <path {...common} d="M6 7h12M6 12h9M6 17h6" />,
    lsq: <path {...common} d="M6 6h12v5H6zM6 13h12v5H6z" />,
    btb: <path {...common} d="M6 6h12v12H6zM9 9h3v3H9zM14 14h2" />,
    predictor: <path {...common} d="M8 16a4 4 0 1 1 6-3.5L12 16" />,
    cache: <path {...common} d="M5 9h14v8H5zM8 9V7h8v2" />,
    branch: <path {...common} d="M7 6v12M7 8h6a3 3 0 0 1 0 6H7" />,
    unit: <path {...common} d="M7 7h10v10H7zM10 12h4" />,
    stall: <path {...common} d="M8 7v10M16 7v10" />,
    hazard: <path {...common} d="M12 5l7 13H5zM12 10v3M12 16h.01" />,
    forward: <path {...common} d="M5 16c4-8 10-8 14 0M15 7l4 2-2 4" />,
    replay: <path {...common} d="M7 8a6 6 0 1 1-1 4M7 5v4H3" />,
    flush: <path {...common} d="M6 8h12M8 12h8M10 16h4" />,
    broadcast: <path {...common} d="M8 15a5 5 0 0 1 0-6M12 17a8 8 0 0 0 0-10M6 12h.01" />,
    mispredict: <path {...common} d="M7 7l10 10M17 7L7 17" />,
    hit: <path {...common} d="M12 5v3M12 16v3M5 12h3M16 12h3M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" />,
    miss: <path {...common} d="M8 8l8 8M16 8l-8 8" />,
    play: <path {...common} d="M8 6l10 6-10 6z" />,
    pause: <path {...common} d="M8 6v12M16 6v12" />,
    step: <path {...common} d="M7 6v12M11 8l6 4-6 4z" />,
    previous: <path {...common} d="M17 6v12M13 8L7 12l6 4z" />,
    reset: <path {...common} d="M7 8a6 6 0 1 1-1 5M7 5v4h4" />,
    speed: <path {...common} d="M6 16a6 6 0 1 1 10 0M12 12l3-3" />,
    width: <path {...common} d="M5 8h3M10 8h3M15 8h4M5 16h14" />,
    wakeup: <path {...common} d="M8 15a4 4 0 1 1 6-3M16 8l2-2M16 5v3h3" />,
    agu: <path {...common} d="M6 16V8l6 4 6-4v8M12 12v5" />,
    port: <path {...common} d="M8 5v14M16 5v14M8 9h8M8 15h8" />,
    line: <path {...common} d="M4 9h16v6H4zM8 9v6M12 9v6M16 9v6" />,
    bus: <path {...common} d="M4 12h16M8 8v8M16 8v8" />,
    directory: <path {...common} d="M7 6h10v12H7zM10 10h4M10 14h4" />,
    owner: <path {...common} d="M8 10a4 4 0 1 1 8 0c0 3-4 7-4 7s-4-4-4-7z" />,
    sharer: <path {...common} d="M8 9a2 2 0 1 1 0 .01M16 9a2 2 0 1 1 0 .01M7 16c1-2 2-3 5-3s4 1 5 3" />,
    invalidate: <path {...common} d="M6 7h12v10H6zM9 10l6 6M15 10l-6 6" />,
    pad: <path {...common} d="M5 8h4v8H5zM15 8h4v8h-4zM9 12h6" />,
    mshr: <path {...common} d="M6 6h12v4H6zM6 12h12v6H6zM9 15h6" />,
    dram: <path {...common} d="M5 8h14v8H5zM8 8v8M12 8v8M16 8v8M7 5v3M17 5v3" />,
    lock: <path {...common} d="M8 11V8a4 4 0 0 1 8 0v3M7 11h10v7H7z" />,
    fence: <path {...common} d="M7 5v14M17 5v14M5 9h14M5 15h14" />,
    counter: <path {...common} d="M7 6h10v12H7zM10 10h4M10 14h4" />,
  };
  return paths[name];
}

export function AcaIcon({ name, size = 18, decorative = false }: { name: AcaIconName; size?: number; decorative?: boolean }) {
  return (
    <svg className={`aca-icon aca-icon-${name}`} width={size} height={size} viewBox="0 0 24 24" aria-hidden={decorative ? true : undefined} role={decorative ? undefined : "img"} aria-label={decorative ? undefined : TIP[name]}>
      {decorative ? null : <title>{TIP[name]}</title>}
      <Glyph name={name} />
    </svg>
  );
}
