export type PortClass = "int-alu" | "int-mul" | "int-div" | "fp-add" | "fp-mul" | "load" | "store" | "branch";
export type SchedPolicy = "first" | "least" | "oldest" | "flexible";

export interface PortOp {
  text: string;
  kind: PortClass;
  dest: string | null;
  srcs: string[];
}

export interface PortConfig {
  policy: SchedPolicy;
  issueWidth: number;
  scheduling: boolean;
}

export interface PortDef {
  id: number;
  label: string;
  units: string;
  classes: PortClass[];
}

export const PORTS: PortDef[] = [
  { id: 0, label: "Port 0", units: "ALU INT", classes: ["int-alu"] },
  { id: 1, label: "Port 1", units: "ALU INT/MUL", classes: ["int-alu", "int-mul", "int-div"] },
  { id: 2, label: "Port 2", units: "FP ADD/MUL", classes: ["fp-add", "fp-mul"] },
  { id: 3, label: "Port 3", units: "Load/Store", classes: ["load", "store"] },
  { id: 4, label: "Port 4", units: "Branch", classes: ["branch"] },
];

export const LATENCY: Record<PortClass, number> = {
  "int-alu": 1,
  "int-mul": 3,
  "int-div": 8,
  "fp-add": 3,
  "fp-mul": 4,
  load: 2,
  store: 2,
  branch: 1,
};

export const PIPELINED: Record<PortClass, boolean> = {
  "int-alu": true,
  "int-mul": true,
  "int-div": false,
  "fp-add": true,
  "fp-mul": true,
  load: true,
  store: true,
  branch: true,
};

export const POLICY_LABEL: Record<SchedPolicy, string> = {
  first: "First available",
  least: "Least contended",
  oldest: "Oldest ready",
  flexible: "Flexible first",
};

interface Live {
  index: number;
  issue: number | null;
  complete: number | null;
  port: number | null;
  reason: string;
}

export interface PortRow {
  index: number;
  text: string;
  kind: PortClass;
  compatible: number[];
  port: number | null;
  state: "Waiting" | "Ready" | "Scheduled" | "Executing" | "Completed";
  reason: string;
  latency: number;
}

export interface PortShot {
  cycle: number;
  rows: PortRow[];
  heat: number[][];
  completed: number[];
  issued: number;
  busy: number[];
  stalls: number;
  depStalls: number;
  portStalls: number;
  event: string;
}

export interface PortResult {
  shots: PortShot[];
  cycles: number;
  ipc: number;
  utilization: number;
  busy: number[];
  idle: number[];
  bottleneck: string;
  assignments: Array<{ index: number; port: number; compatible: number[] }>;
}

const DEFAULTS: PortConfig = { policy: "least", issueWidth: 3, scheduling: true };

function producer(ops: PortOp[], index: number, reg: string) {
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    if (ops[cursor]?.dest === reg) return cursor;
  }
  return null;
}

export function compatiblePorts(kind: PortClass) {
  return PORTS.filter((port) => port.classes.includes(kind)).map((port) => port.id);
}

function readyAt(lives: Live[], ops: PortOp[], index: number) {
  const op = ops[index];
  if (!op) return 0;
  return op.srcs.reduce((max, reg) => {
    const writer = producer(ops, index, reg);
    if (writer == null) return max;
    const done = lives[writer]?.complete;
    return Math.max(max, done ?? Number.POSITIVE_INFINITY);
  }, 0);
}

export function runPorts(ops: PortOp[], config: Partial<PortConfig> = {}): PortResult {
  const cfg = { ...DEFAULTS, ...config };
  const width = cfg.scheduling ? cfg.issueWidth : 1;
  const policy: SchedPolicy = cfg.scheduling ? cfg.policy : "oldest";
  const lives: Live[] = ops.map((_, index) => ({ index, issue: null, complete: null, port: null, reason: "Waiting for a free compatible port" }));
  const blocked = PORTS.map(() => 0);
  const busy = PORTS.map(() => 0);
  const heat: number[][] = [];
  const completed: number[] = [0];
  const shots: PortShot[] = [];
  let depStalls = 0;
  let portStalls = 0;
  const rowOf = (cycle: number): PortRow[] => ops.map((op, index) => {
    const live = lives[index];
    let state: PortRow["state"] = "Waiting";
    if (live && live.complete != null && live.complete <= cycle) state = "Completed";
    else if (live && live.issue === cycle) state = "Scheduled";
    else if (live && live.issue != null && live.issue < cycle) state = "Executing";
    else if (readyAt(lives, ops, index) <= cycle) state = "Ready";
    return {
      index,
      text: op.text,
      kind: op.kind,
      compatible: compatiblePorts(op.kind),
      port: live?.port ?? null,
      state,
      reason: live?.reason ?? "",
      latency: LATENCY[op.kind],
    };
  });
  shots.push({ cycle: 0, rows: rowOf(0), heat: [], completed: [], issued: 0, busy: busy.slice(), stalls: 0, depStalls: 0, portStalls: 0, event: "Ready to schedule" });
  for (let cycle = 1; cycle <= 80; cycle += 1) {
    const ready = lives.filter((live) => live.issue == null && readyAt(lives, ops, live.index) <= cycle);
    const waiting = lives.filter((live) => live.issue == null && readyAt(lives, ops, live.index) > cycle);
    depStalls += waiting.length;
    const used = new Set<number>();
    const freeFor = (kind: PortClass) => compatiblePorts(kind).filter((port) => !used.has(port) && (blocked[port] ?? 0) <= cycle);
    const ordered = policy === "flexible"
      ? ready.slice().sort((left, right) => compatiblePorts(ops[left.index]?.kind ?? "int-alu").length - compatiblePorts(ops[right.index]?.kind ?? "int-alu").length || left.index - right.index)
      : ready.slice().sort((left, right) => left.index - right.index);
    let issued = 0;
    let event = "Ports idle";
    for (const live of ordered) {
      if (issued >= width) break;
      const op = ops[live.index];
      if (!op) continue;
      const choices = freeFor(op.kind);
      if (!choices.length) {
        if (policy === "oldest") break;
        portStalls += 1;
        live.reason = `No free ${compatiblePorts(op.kind).map((port) => `P${port}`).join("/")} this cycle`;
        continue;
      }
      const users = (port: number) => ordered.filter((other) => other.issue == null && other.index !== live.index && compatiblePorts(ops[other.index]?.kind ?? "int-alu").includes(port)).length;
      const leastPort = choices.slice().sort((left, right) => users(left) - users(right) || left - right)[0];
      const port = policy === "least" ? leastPort : policy === "first" ? choices[choices.length - 1] : choices[0];
      if (port == null) continue;
      used.add(port);
      live.port = port;
      live.issue = cycle;
      live.complete = cycle + LATENCY[op.kind];
      if (!PIPELINED[op.kind]) blocked[port] = live.complete;
      busy[port] = (busy[port] ?? 0) + 1;
      live.reason = `${POLICY_LABEL[policy]} selected P${port} from ${choices.map((item) => `P${item}`).join(", ")}`;
      issued += 1;
      event = `${op.text} → P${port}`;
    }
    ordered.forEach((live) => {
      if (live.issue == null) portStalls += policy === "oldest" ? 1 : 0;
    });
    const levels = PORTS.map((port) => {
      const occupied = used.has(port.id) || (blocked[port.id] ?? 0) > cycle;
      const waiters = ordered.filter((live) => live.issue == null && compatiblePorts(ops[live.index]?.kind ?? "int-alu").includes(port.id)).length;
      if (!occupied) return 0;
      if (waiters === 0) return 1;
      return waiters === 1 ? 2 : 3;
    });
    heat.push(levels);
    const done = lives.filter((live) => live.complete === cycle).length;
    completed.push(done);
    shots.push({ cycle, rows: rowOf(cycle), heat: heat.map((row) => row.slice()), completed: completed.slice(1), issued, busy: busy.slice(), stalls: depStalls + portStalls, depStalls, portStalls, event });
    if (lives.every((live) => live.complete != null && (live.complete ?? 0) <= cycle)) break;
  }
  const cycles = Math.max(1, shots.length - 1);
  const utilization = busy.reduce((sum, value) => sum + value, 0) / (cycles * PORTS.length);
  const idle = busy.map((value) => Math.max(0, cycles - value));
  const bottleneck = analyze(depStalls, portStalls, busy, ops);
  return {
    shots,
    cycles,
    ipc: ops.length / cycles,
    utilization,
    busy,
    idle,
    bottleneck,
    assignments: lives.filter((live) => live.port != null).map((live) => ({ index: live.index, port: live.port ?? 0, compatible: compatiblePorts(ops[live.index]?.kind ?? "int-alu") })),
  };
}

function analyze(depStalls: number, portStalls: number, busy: number[], ops: PortOp[]) {
  if (depStalls > portStalls && depStalls > 0) return "Dependencies, not ports";
  const peak = Math.max(...busy);
  const hot = busy.findIndex((value) => value === peak);
  const kinds = new Set(ops.map((op) => op.kind));
  if (kinds.size === 1 && (kinds.has("int-mul") || kinds.has("int-div"))) return `P${hot} multiplier`;
  if (kinds.has("load") && (busy[3] ?? 0) === peak && peak > 0) return "P3 load/store unit";
  if (portStalls === 0 && depStalls === 0) return "No structural stall";
  return `P${hot} ${PORTS[hot]?.units ?? "port"}`;
}

function op(text: string, kind: PortClass, dest: string | null, srcs: string[]): PortOp {
  return { text, kind, dest, srcs };
}

export const PORT_PRESETS: Array<{ id: string; label: string; ops: PortOp[]; policy: SchedPolicy }> = [
  { id: "alu", label: "Independent integer ALU", policy: "first", ops: [op("ADD x1, x2, x3", "int-alu", "x1", []), op("SUB x4, x5, x6", "int-alu", "x4", []), op("AND x7, x8, x9", "int-alu", "x7", []), op("OR x10, x11, x12", "int-alu", "x10", [])] },
  { id: "mul", label: "Multiply-heavy", policy: "first", ops: [op("MUL x1, x2, x3", "int-mul", "x1", []), op("MUL x4, x5, x6", "int-mul", "x4", []), op("MUL x7, x8, x9", "int-mul", "x7", [])] },
  { id: "load", label: "Load-heavy", policy: "first", ops: [op("LD x1, 0(x2)", "load", "x1", []), op("LD x3, 8(x2)", "load", "x3", []), op("LD x4, 16(x2)", "load", "x4", [])] },
  { id: "mixed", label: "Mixed ALU and load", policy: "least", ops: [op("LD x1, 0(x2)", "load", "x1", []), op("ADD x3, x4, x5", "int-alu", "x3", []), op("LD x6, 8(x2)", "load", "x6", []), op("ADD x7, x8, x9", "int-alu", "x7", [])] },
  { id: "contend", label: "Port contention", policy: "least", ops: [op("ADD x1, x2, x3", "int-alu", "x1", []), op("MUL x4, x5, x6", "int-mul", "x4", []), op("ADD x7, x8, x9", "int-alu", "x7", []), op("MUL x10, x11, x12", "int-mul", "x10", [])] },
  { id: "flex", label: "Flexible vs constrained", policy: "flexible", ops: [op("ADD x1, x2, x3", "int-alu", "x1", []), op("MUL x4, x5, x6", "int-mul", "x4", []), op("ADD x7, x8, x9", "int-alu", "x7", [])] },
  { id: "dep", label: "Dependency-limited", policy: "least", ops: [op("ADD x1, x2, x3", "int-alu", "x1", []), op("ADD x4, x1, x5", "int-alu", "x4", ["x1"]), op("ADD x6, x4, x7", "int-alu", "x6", ["x4"])] },
  { id: "div", label: "Non-pipelined divide", policy: "first", ops: [op("DIV x1, x2, x3", "int-div", "x1", []), op("MUL x4, x5, x6", "int-mul", "x4", []), op("ADD x7, x8, x9", "int-alu", "x7", [])] },
];
