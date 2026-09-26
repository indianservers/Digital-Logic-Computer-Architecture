export interface OooOp {
  text: string;
  dest: string | null;
  srcs: string[];
  latency: number;
  fu: "alu" | "mul" | "mem";
  fault?: boolean;
}

export interface RobEntry {
  index: number;
  text: string;
  dest: string;
  value: string;
  state: "WAIT" | "ISSUED" | "EXE" | "WB" | "C" | "FLUSH";
  ready: boolean;
  committed: boolean;
}

export interface OooShot {
  cycle: number;
  entries: RobEntry[];
  units: Array<{ name: string; busy: string; remain: string }>;
  window: Array<{ text: string; state: string; ready: boolean; waiting: string }>;
  writeback: string;
  commit: string;
  exception: string;
  flushed: number;
  committed: number;
  cells: Array<Array<string | null>>;
  done: boolean;
}

export const OOO_EXAMPLE: OooOp[] = [
  { text: "LD x1, 0(x2)", dest: "x1", srcs: ["x2"], latency: 3, fu: "mem" },
  { text: "ADD x3, x1, x4", dest: "x3", srcs: ["x1", "x4"], latency: 1, fu: "alu" },
  { text: "MUL x5, x3, x6", dest: "x5", srcs: ["x3", "x6"], latency: 3, fu: "mul" },
  { text: "SUB x7, x8, x9", dest: "x7", srcs: ["x8", "x9"], latency: 1, fu: "alu" },
  { text: "AND x10, x5, x11", dest: "x10", srcs: ["x5", "x11"], latency: 1, fu: "alu" },
  { text: "OR x12, x7, x13", dest: "x12", srcs: ["x7", "x13"], latency: 1, fu: "alu" },
  { text: "ADDI x14, x12, 1", dest: "x14", srcs: ["x12"], latency: 1, fu: "alu" },
  { text: "SD x4, 8(x2)", dest: null, srcs: ["x4", "x2"], latency: 3, fu: "mem" },
];

interface Live {
  dispatch: number | null;
  exStart: number | null;
  exEnd: number | null;
  wb: number | null;
  commit: number | null;
  flushed: boolean;
  remain: number;
  phys: string;
}

export function runOoo(ops: OooOp[], faultAt: number | null = null, robSize = 16): OooShot[] {
  const live: Live[] = ops.map((op, index) => ({ dispatch: null, exStart: null, exEnd: null, wb: null, commit: null, flushed: false, remain: op.latency, phys: `p${index + 1}` }));
  const produced = new Map<string, number>();
  const shots: OooShot[] = [];
  const cells: Array<Array<string | null>> = ops.map(() => []);
  let flushed = 0;
  const limits = { alu: 2, mul: 1, mem: 1 };
  for (let cycle = 1; cycle <= 80; cycle += 1) {
    const head = live.findIndex((item) => item.commit == null && !item.flushed);
    if (head >= 0 && live[head]?.wb != null && faultAt === head) {
      live.forEach((item, index) => { if (index >= head && item.commit == null) item.flushed = true; });
      flushed = ops.length - head;
    }
    const busy = { alu: 0, mul: 0, mem: 0 };
    live.forEach((item, index) => {
      const op = ops[index];
      if (!op || item.flushed || item.wb != null || item.exStart == null) return;
      busy[op.fu] += 1;
    });
    if (head >= 0 && live[head]?.wb != null && !live[head]?.flushed && faultAt !== head) live[head].commit = cycle;
    live.forEach((item, index) => {
      const op = ops[index];
      if (!op || item.flushed || item.exStart == null || item.wb != null) return;
      item.remain -= 1;
      const row = cells[index];
      if (row) row[cycle - 1] = "EX";
      if (item.remain <= 0) {
        item.exEnd = cycle;
        item.wb = cycle;
        if (op.dest) produced.set(op.dest, index);
        if (row) row[cycle - 1] = "WB";
      }
    });
    live.forEach((item, index) => {
      const op = ops[index];
      if (!op || item.flushed || item.dispatch == null || item.exStart != null) return;
      const ready = op.srcs.every((reg) => !ops.some((other) => other.dest === reg) || (produced.has(reg) && (live[produced.get(reg) ?? -1]?.wb ?? Infinity) < cycle));
      if (!ready || busy[op.fu] >= limits[op.fu]) return;
      item.exStart = cycle;
      item.remain = op.latency;
      busy[op.fu] += 1;
      const row = cells[index];
      if (row && row[cycle - 1] == null) row[cycle - 1] = "IS";
    });
    let dispatched = 0;
    live.forEach((item, index) => {
      if (item.dispatch != null || item.flushed || dispatched >= 2) return;
      const occupied = live.filter((row) => row.dispatch != null && row.commit == null && !row.flushed).length;
      if (occupied >= robSize) return;
      if (faultAt != null && live[faultAt]?.flushed) return;
      item.dispatch = cycle;
      dispatched += 1;
      const row = cells[index];
      if (row) {
        if (cycle > 2) row[cycle - 3] = "F";
        if (cycle > 1) row[cycle - 2] = "D";
        row[cycle - 1] = row[cycle - 1] ?? "D";
      }
    });
    live.forEach((item, index) => {
      const row = cells[index];
      if (item.commit === cycle && row) row[cycle - 1] = "C";
    });
    const committed = live.filter((item) => item.commit != null).length;
    const done = live.every((item) => item.commit != null || item.flushed);
    shots.push({
      cycle,
      entries: ops.map((op, index) => ({
        index,
        text: op.text,
        dest: op.dest ?? "mem",
        value: live[index]?.wb ? `v${index}` : "—",
        state: live[index]?.flushed ? "FLUSH" : live[index]?.commit ? "C" : live[index]?.wb ? "WB" : live[index]?.exStart ? "EXE" : live[index]?.dispatch ? "ISSUED" : "WAIT",
        ready: Boolean(live[index]?.dispatch && (ops[index]?.srcs.every((reg) => !ops.some((other) => other.dest === reg) || produced.has(reg)) ?? false)),
        committed: live[index]?.commit != null,
      })),
      units: [
        { name: "Integer ALU (2)", busy: ops.filter((op, index) => op.fu === "alu" && live[index]?.exStart != null && live[index]?.wb == null).map((op) => op.text).join(", ") || "—", remain: `${busy.alu}/2` },
        { name: "Multiply/Divide (1)", busy: ops.filter((op, index) => op.fu === "mul" && live[index]?.exStart != null && live[index]?.wb == null).map((op) => op.text).join(", ") || "—", remain: `${busy.mul}/1` },
        { name: "Load/Store (1)", busy: ops.filter((op, index) => op.fu === "mem" && live[index]?.exStart != null && live[index]?.wb == null).map((op) => op.text).join(", ") || "—", remain: `${busy.mem}/1` },
      ],
      window: ops.map((op, index) => ({
        text: op.text,
        state: live[index]?.commit ? "Committed" : live[index]?.wb ? "Writeback" : live[index]?.exStart ? "Executing" : live[index]?.dispatch ? "Issued" : "Waiting",
        ready: op.srcs.every((reg) => !ops.some((other) => other.dest === reg) || produced.has(reg)),
        waiting: op.srcs.filter((reg) => ops.some((other) => other.dest === reg) && !produced.has(reg)).join(", ") || "—",
      })),
      writeback: ops[live.findIndex((item) => item.wb === cycle)]?.text ?? "—",
      commit: ops[live.findIndex((item) => item.commit === cycle)]?.text ?? "—",
      exception: faultAt != null && live[faultAt]?.flushed ? `${ops[faultAt]?.text ?? "fault"} at ROB ${faultAt}` : "No exception",
      flushed,
      committed,
      cells,
      done,
    });
    if (done) break;
  }
  return shots;
}
