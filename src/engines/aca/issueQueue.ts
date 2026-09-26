export interface IqOp {
  pc: number;
  text: string;
  dest: string | null;
  srcs: string[];
  fu: "load" | "alu" | "mul";
  latency: number;
}

export interface IqConfig {
  window: number;
  issueWidth: number;
  alu: number;
  mul: number;
  load: number;
  dispatch: number;
}

export interface IqEntry {
  index: number;
  pc: number;
  text: string;
  srcs: string[];
  readySrcs: boolean[];
  waiting: string[];
  ready: boolean;
  state: "absent" | "waiting" | "ready" | "selected" | "issued" | "exec" | "wb" | "done";
  age: number;
  selected: boolean;
}

export interface IqEdge { from: number; to: number; reg: string }

export interface IqShot {
  cycle: number;
  entries: IqEntry[];
  issuedNow: number[];
  woken: number[];
  dispatched: number[];
  occupancy: number;
  readyCount: number;
  waitingCount: number;
  issuedTotal: number;
  cells: Array<Array<string | null>>;
  event: string;
}

export interface IqResult {
  shots: IqShot[];
  cycles: number;
  issued: number;
  edges: IqEdge[];
  ipc: number;
  occupancy: number;
  stalls: number;
}

interface Live {
  seen: number | null;
  disp: number | null;
  issue: number | null;
  exEnd: number | null;
  wb: number | null;
  readySrcs: boolean[];
}

function producer(ops: IqOp[], index: number, reg: string): number | null {
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    if (ops[cursor]?.dest === reg) return cursor;
  }
  return null;
}

export function issueEdges(ops: IqOp[]): IqEdge[] {
  const edges: IqEdge[] = [];
  ops.forEach((op, index) => {
    op.srcs.forEach((reg) => {
      const from = producer(ops, index, reg);
      if (from != null) edges.push({ from, to: index, reg });
    });
  });
  return edges;
}

export function runIssue(ops: IqOp[], config: IqConfig): IqResult {
  const live: Live[] = ops.map(() => ({
    seen: null,
    disp: null,
    issue: null,
    exEnd: null,
    wb: null,
    readySrcs: [],
  }));
  ops.forEach((op, index) => {
    const row = live[index];
    if (!row) return;
    row.readySrcs = op.srcs.map((reg) => producer(ops, index, reg) == null);
  });
  const cells = ops.map(() => [] as Array<string | null>);
  const shots: IqShot[] = [];
  const edges = issueEdges(ops);
  let issuedTotal = 0;
  let occupancySum = 0;
  let stalls = 0;
  const stamp = (index: number, cycle: number, token: string) => {
    const row = cells[index];
    if (row && row[cycle - 1] == null) row[cycle - 1] = token;
  };
  for (let cycle = 1; cycle <= 160; cycle += 1) {
    const woken: number[] = [];
    live.forEach((item, index) => {
      const op = ops[index];
      if (!op || item.issue == null || item.wb != null) return;
      if ((item.exEnd ?? Infinity) < cycle) {
        item.wb = cycle;
        stamp(index, cycle, "WB");
        if (!op.dest) return;
        ops.forEach((other, otherIndex) => {
          const consumer = live[otherIndex];
          if (!consumer || consumer.issue != null || otherIndex === index) return;
          other.srcs.forEach((reg, srcIndex) => {
            if (reg === op.dest && producer(ops, otherIndex, reg) === index && !consumer.readySrcs[srcIndex]) {
              consumer.readySrcs[srcIndex] = true;
              if (!woken.includes(otherIndex)) woken.push(otherIndex);
            }
          });
        });
      } else if ((item.issue ?? cycle) < cycle) stamp(index, cycle, "EX");
    });
    const busy = { alu: 0, mul: 0, load: 0 };
    live.forEach((item, index) => {
      const op = ops[index];
      if (!op || item.issue == null || item.wb != null || (item.exEnd ?? 0) <= cycle) return;
      busy[op.fu] += 1;
    });
    const limits = { alu: config.alu, mul: config.mul, load: config.load };
    const issuedNow: number[] = [];
    const readyIndexes = ops.map((_, index) => index).filter((index) => {
      const item = live[index];
      const op = ops[index];
      return Boolean(item && op && item.disp != null && item.issue == null && item.readySrcs.every(Boolean));
    });
    readyIndexes.forEach((index) => {
      const op = ops[index];
      const item = live[index];
      if (!op || !item || issuedNow.length >= config.issueWidth || busy[op.fu] >= limits[op.fu]) return;
      item.issue = cycle;
      item.exEnd = cycle + op.latency;
      busy[op.fu] += 1;
      issuedNow.push(index);
      issuedTotal += 1;
      stamp(index, cycle, "IS");
    });
    const inWindow = live.filter((item) => item.disp != null && item.wb == null).length;
    const waitingOutside = live.some((item) => item.seen != null && item.disp == null);
    if (waitingOutside && inWindow >= config.window) stalls += 1;
    const dispatched: number[] = [];
    let seenNow = 0;
    for (let index = 0; index < ops.length; index += 1) {
      const item = live[index];
      if (!item || item.disp != null) continue;
      if (item.seen == null) {
        if (seenNow < config.dispatch) {
          item.seen = cycle;
          seenNow += 1;
          stamp(index, cycle, "IF");
        }
        continue;
      }
      if (item.seen >= cycle || dispatched.length >= config.dispatch || inWindow + dispatched.length >= config.window) continue;
      item.disp = cycle;
      dispatched.push(index);
      stamp(index, cycle, "IW");
    }
    const entries: IqEntry[] = ops.map((op, index) => {
      const item = live[index];
      const waiting = op.srcs.filter((_, srcIndex) => !item?.readySrcs[srcIndex]);
      const ready = Boolean(item?.disp != null && item.issue == null && item.readySrcs.every(Boolean));
      let state: IqEntry["state"] = "absent";
      if (item?.wb != null) state = "done";
      else if (item?.issue != null && (item.exEnd ?? 0) < cycle) state = "wb";
      else if (item?.issue != null) state = issuedNow.includes(index) ? "issued" : "exec";
      else if (issuedNow.includes(index)) state = "selected";
      else if (ready) state = "ready";
      else if (item?.disp != null) state = "waiting";
      return {
        index,
        pc: op.pc,
        text: op.text,
        srcs: op.srcs,
        readySrcs: item?.readySrcs.slice() ?? [],
        waiting,
        ready,
        state,
        age: index,
        selected: issuedNow.includes(index),
      };
    });
    const occupancy = entries.filter((entry) => entry.state === "waiting" || entry.state === "ready" || entry.state === "issued" || entry.state === "exec").length;
    occupancySum += occupancy;
    const readyCount = entries.filter((entry) => entry.ready || entry.selected).length;
    const waitingCount = entries.filter((entry) => entry.state === "waiting").length;
    shots.push({
      cycle,
      entries,
      issuedNow,
      woken,
      dispatched,
      occupancy,
      readyCount,
      waitingCount,
      issuedTotal,
      cells: cells.map((row) => row.slice()),
      event: issuedNow.length ? `Issued ${issuedNow.map((index) => `I${index + 1}`).join(", ")}` : woken.length ? `Woke ${woken.map((index) => `I${index + 1}`).join(", ")}` : dispatched.length ? "Dispatched into the window" : "Waiting on operands or a free unit",
    });
    if (live.every((item) => item.wb != null)) break;
  }
  return {
    shots,
    cycles: shots.length,
    issued: issuedTotal,
    edges,
    ipc: issuedTotal / Math.max(1, shots.length),
    occupancy: shots.length ? occupancySum / shots.length : 0,
    stalls,
  };
}

function parseIq(pc: number, text: string): IqOp {
  const parts = text.replace(/,/g, " ").replace(/\s+/g, " ").trim().split(" ");
  const opcode = (parts[0] ?? "ADD").toUpperCase();
  if (opcode === "LD" || opcode === "LW") {
    const base = (parts[2] ?? "0(x0)").match(/\(([^)]+)\)/)?.[1] ?? "x0";
    return { pc, text, dest: parts[1] ?? "x1", srcs: base === "x0" ? [] : [base], fu: "load", latency: 3 };
  }
  const dest = parts[1] ?? null;
  const srcs = parts.slice(2).filter((reg) => reg && Number.isNaN(Number(reg)) && reg !== "x0");
  if (opcode.startsWith("MUL")) return { pc, text, dest, srcs, fu: "mul", latency: 3 };
  return { pc, text, dest, srcs, fu: "alu", latency: 1 };
}

export const IQ_DEFAULT: IqConfig = { window: 8, issueWidth: 2, alu: 1, mul: 1, load: 1, dispatch: 2 };

export const IQ_PRESETS: Array<{ id: string; label: string; ops: IqOp[]; config: IqConfig }> = [
  {
    id: "mixed",
    label: "Mixed dependency graph",
    config: IQ_DEFAULT,
    ops: [
      "LD x1, 0(x2)",
      "ADD x3, x1, x4",
      "MUL x5, x3, x6",
      "LD x7, 0(x8)",
      "ADD x9, x7, x10",
      "SUB x11, x5, x9",
      "AND x12, x11, x13",
      "OR x14, x12, x1",
    ].map((text, index) => parseIq(0x1000 + index * 4, text)),
  },
  {
    id: "free",
    label: "Independent instructions",
    config: { ...IQ_DEFAULT, alu: 2 },
    ops: [1, 2, 3, 4, 5, 6].map((index) => parseIq(0x2000 + index * 4, `ADD x${index}, x${index + 10}, x${index + 20}`)),
  },
  {
    id: "chain",
    label: "RAW chain",
    config: IQ_DEFAULT,
    ops: ["ADD x1, x2, x3", "ADD x4, x1, x5", "ADD x6, x4, x7", "ADD x8, x6, x9"].map((text, index) => parseIq(0x3000 + index * 4, text)),
  },
  {
    id: "alu",
    label: "Competing ALU instructions",
    config: { ...IQ_DEFAULT, alu: 1, issueWidth: 4 },
    ops: [1, 2, 3, 4].map((index) => parseIq(0x4000 + index * 4, `ADD x${index}, x${index + 8}, x${index + 12}`)),
  },
  {
    id: "long",
    label: "Long-latency producer",
    config: IQ_DEFAULT,
    ops: ["MUL x1, x2, x3", "ADD x4, x5, x6", "ADD x7, x8, x9", "ADD x10, x1, x11"].map((text, index) => parseIq(0x5000 + index * 4, text)),
  },
  {
    id: "small",
    label: "Small window",
    config: { ...IQ_DEFAULT, window: 2, dispatch: 1 },
    ops: ["MUL x1, x2, x3", "ADD x4, x5, x6", "ADD x7, x8, x9", "ADD x10, x11, x12", "ADD x13, x1, x14"].map((text, index) => parseIq(0x6000 + index * 4, text)),
  },
];
