export interface PrfOp {
  text: string;
  dest: string | null;
  srcs: string[];
  latency: number;
  kind: "alu" | "load";
  imm: number;
}

export interface PrfConfig {
  recoverAt: number | null;
}

interface Row {
  index: number;
  text: string;
  srcPhys: number[];
  oldPhys: number | null;
  newPhys: number | null;
  renameCycle: number | null;
  readyCycle: number | null;
  commitCycle: number | null;
  execStart: number | null;
}

export interface PrfPhys {
  id: number;
  value: number;
  busy: boolean;
  ready: boolean;
  owner: string;
}

export interface PrfShot {
  cycle: number;
  rat: Array<{ arch: string; phys: number }>;
  commitMap: Array<{ arch: string; phys: number }>;
  phys: PrfPhys[];
  free: number[];
  rob: Array<{ index: number; text: string; dest: string; destPhys: string; status: string }>;
  phase: "fetch" | "rename" | "execute" | "commit" | "recover";
  focus: number | null;
  event: string;
  renameStalls: number;
  reclaimed: number;
  recovered: boolean;
}

export interface PrfResult {
  shots: PrfShot[];
  rows: Row[];
  cycles: number;
  renameStalls: number;
  reclaimed: number;
  raw: number;
  falseDeps: number;
  serialCycles: number;
  finalRegs: Array<{ name: string; value: number }>;
  sequential: Array<{ name: string; value: number }>;
}

export const ARCH = ["x0", "x1", "x2", "x3", "x4", "x5", "x6", "x7"] as const;
export const PHYS_COUNT = 16;
const ABI = ["zero", "ra", "sp", "gp", "tp", "t0", "t1", "t2"];

export const INITIAL_VALUES = [0, 0, 0x7ffffff0, 0x10000000, 0, 0xa, 0x14, 0];

export function abiName(reg: string) {
  const index = Number(reg.slice(1));
  return ABI[index] ? `${reg} (${ABI[index]})` : reg;
}

function producer(ops: PrfOp[], index: number, reg: string) {
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    if (ops[cursor]?.dest === reg) return cursor;
  }
  return null;
}

function dependencies(ops: PrfOp[]) {
  let raw = 0;
  let war = 0;
  let waw = 0;
  ops.forEach((op, index) => {
    op.srcs.forEach((src) => { if (producer(ops, index, src) != null) raw += 1; });
    if (!op.dest || op.dest === "x0") return;
    for (let older = 0; older < index; older += 1) {
      if (ops[older]?.dest === op.dest) waw += 1;
      if (ops[older]?.srcs.includes(op.dest)) war += 1;
    }
  });
  return { raw, falseDeps: war + waw };
}

function serialCycles(ops: PrfOp[]) {
  const ready = new Map<string, number>();
  let issue = 0;
  ops.forEach((op) => {
    const sourceReady = op.srcs.reduce((max, reg) => Math.max(max, ready.get(reg) ?? 0), 0);
    const start = Math.max(issue, sourceReady);
    const done = start + op.latency;
    if (op.dest) ready.set(op.dest, done);
    issue = start + 1;
  });
  return Math.max(issue, ...ready.values(), 0);
}

function combine(text: string, left: number, right: number, imm: number) {
  if (text.startsWith("SUB")) return (left - right) | 0;
  if (text.startsWith("AND")) return (left & right) | 0;
  if (text.startsWith("OR")) return (left | right) | 0;
  return (left + right + imm) | 0;
}

function valueOf(op: PrfOp, phys: number[], values: number[]) {
  if (op.kind === "load") return op.imm;
  return combine(op.text, values[phys[0] ?? 0] ?? 0, values[phys[1] ?? 0] ?? 0, op.imm);
}

export function sequentialRegs(ops: PrfOp[]) {
  const regs = new Map<string, number>(ARCH.map((name, index) => [name, INITIAL_VALUES[index] ?? 0]));
  ops.forEach((op) => {
    if (!op.dest || op.dest === "x0") return;
    if (op.kind === "load") regs.set(op.dest, op.imm);
    else regs.set(op.dest, combine(op.text, regs.get(op.srcs[0] ?? "") ?? 0, regs.get(op.srcs[1] ?? "") ?? 0, op.imm));
  });
  return ARCH.filter((name) => name !== "x0").map((name) => ({ name, value: regs.get(name) ?? 0 }));
}

export function runPrf(ops: PrfOp[], config: PrfConfig = { recoverAt: null }): PrfResult {
  const rat = [0, 1, 2, 3, 4, 5, 6, 7];
  const commit = rat.slice();
  const values = Array.from({ length: PHYS_COUNT }, () => 0);
  const ready = Array.from({ length: PHYS_COUNT }, () => true);
  const busy = Array.from({ length: PHYS_COUNT }, () => false);
  ARCH.forEach((_, index) => {
    const phys = rat[index] ?? 0;
    values[phys] = INITIAL_VALUES[index] ?? 0;
    busy[phys] = true;
  });
  const free = Array.from({ length: PHYS_COUNT }, (_, index) => index).filter((index) => index !== 0 && !busy[index]);
  const rows: Row[] = ops.map((op, index) => ({
    index, text: op.text, srcPhys: [], oldPhys: null, newPhys: null, renameCycle: null, readyCycle: null, commitCycle: null, execStart: null,
  }));
  const shots: PrfShot[] = [];
  let renameStalls = 0;
  let reclaimed = 0;
  let recovered = false;
  let cursor = 0;
  const archIndex = (name: string) => ARCH.indexOf(name as typeof ARCH[number]);
  const snapshot = (cycle: number, phase: PrfShot["phase"], focus: number | null, event: string): PrfShot => ({
    cycle,
    rat: ARCH.map((arch, index) => ({ arch, phys: rat[index] ?? 0 })),
    commitMap: ARCH.map((arch, index) => ({ arch, phys: commit[index] ?? 0 })),
    phys: values.map((value, id) => ({
      id,
      value,
      busy: busy[id] ?? false,
      ready: ready[id] ?? false,
      owner: ARCH.find((_, index) => rat[index] === id) ?? (rows.find((row) => row.newPhys === id)?.text.split(" ")[0] ?? "—"),
    })),
    free: free.slice(),
    rob: rows.filter((row) => row.renameCycle != null).map((row) => ({
      index: row.index,
      text: row.text,
      dest: ops[row.index]?.dest ?? "—",
      destPhys: row.newPhys == null ? "—" : `P${row.newPhys}`,
      status: row.commitCycle != null ? "Committed" : row.readyCycle != null ? "Ready" : row.execStart != null ? "Executing" : "Waiting",
    })),
    phase,
    focus,
    event,
    renameStalls,
    reclaimed,
    recovered,
  });
  for (let cycle = 1; cycle <= 80; cycle += 1) {
    let phase: PrfShot["phase"] = "fetch";
    let event = "Pipeline advances";
    let focus: number | null = cursor < ops.length ? cursor : null;
    if (config.recoverAt === cycle && !recovered) {
      rows.forEach((row) => {
        if (row.renameCycle == null || row.commitCycle != null || row.newPhys == null) return;
        busy[row.newPhys] = false;
        ready[row.newPhys] = true;
        if (!free.includes(row.newPhys)) free.push(row.newPhys);
        row.srcPhys = [];
        row.oldPhys = null;
        row.newPhys = null;
        row.renameCycle = null;
        row.execStart = null;
        row.readyCycle = null;
      });
      commit.forEach((phys, index) => { rat[index] = phys; });
      free.sort((a, b) => a - b);
      cursor = rows.find((row) => row.commitCycle == null)?.index ?? cursor;
      recovered = true;
      phase = "recover";
      event = "Misprediction. RAT restored from the commit map.";
    }
    const head = rows.find((row) => row.renameCycle != null && row.commitCycle == null);
    if (head && head.readyCycle != null && head.readyCycle < cycle) {
      const op = ops[head.index];
      const dest = op?.dest;
      const destIndex = dest ? archIndex(dest) : -1;
      if (destIndex > 0 && head.oldPhys != null && head.oldPhys !== 0 && commit[destIndex] === head.oldPhys && rat[destIndex] !== head.oldPhys) {
        busy[head.oldPhys] = false;
        ready[head.oldPhys] = true;
        if (!free.includes(head.oldPhys)) free.push(head.oldPhys);
        free.sort((a, b) => a - b);
        reclaimed += 1;
      }
      if (destIndex >= 0 && head.newPhys != null) commit[destIndex] = head.newPhys;
      head.commitCycle = cycle;
      phase = "commit";
      focus = head.index;
      event = `Committed I${head.index + 1}. ${head.oldPhys != null && head.oldPhys !== 0 ? `P${head.oldPhys} returned to the free list.` : "No old mapping to reclaim."}`;
    }
    rows.forEach((row) => {
      const op = ops[row.index];
      if (!op || row.renameCycle == null || row.readyCycle != null || row.execStart == null) return;
      if (cycle < row.execStart + op.latency) return;
      if (row.newPhys != null) {
        values[row.newPhys] = valueOf(op, row.srcPhys, values);
        ready[row.newPhys] = true;
      }
      row.readyCycle = cycle;
      phase = "execute";
      focus = row.index;
      event = `P${row.newPhys} written by I${row.index + 1} and marked ready.`;
    });
    rows.forEach((row) => {
      if (row.renameCycle == null || row.execStart != null || row.readyCycle != null) return;
      const sourcesReady = row.srcPhys.every((phys) => ready[phys]);
      if (!sourcesReady) return;
      row.execStart = cycle;
      phase = "execute";
      focus = row.index;
    });
    const next = rows[cursor];
    const op = ops[cursor];
    if (next && op && next.renameCycle == null) {
      const sources = op.srcs.map((reg) => rat[archIndex(reg)] ?? 0);
      const needsDest = Boolean(op.dest && op.dest !== "x0");
      if (needsDest && free.length === 0) {
        renameStalls += 1;
        phase = "rename";
        event = "Free list empty. Rename stalls.";
      } else {
        next.srcPhys = sources;
        if (needsDest && op.dest) {
          const allocated = free.shift();
          if (allocated == null) {
            renameStalls += 1;
          } else {
            const destIndex = archIndex(op.dest);
            next.oldPhys = rat[destIndex] ?? 0;
            next.newPhys = allocated;
            rat[destIndex] = allocated;
            busy[allocated] = true;
            ready[allocated] = false;
            values[allocated] = 0;
          }
        }
        next.renameCycle = cycle;
        cursor += 1;
        phase = "rename";
        focus = next.index;
        event = `Renamed I${next.index + 1}. Sources ${next.srcPhys.map((phys) => `P${phys}`).join(", ") || "none"}.`;
      }
    }
    shots.push(snapshot(cycle, phase, focus, event));
    if (rows.every((row) => row.commitCycle != null || (ops[row.index]?.dest == null && row.renameCycle != null))) break;
  }
  const finalRegs = ARCH.filter((name) => name !== "x0").map((name, index) => {
    const phys = commit[index + 1] ?? 0;
    return { name, value: values[phys] ?? 0 };
  });
  const counted = dependencies(ops);
  return {
    shots,
    rows,
    cycles: shots.length,
    renameStalls,
    reclaimed,
    raw: counted.raw,
    falseDeps: counted.falseDeps,
    serialCycles: serialCycles(ops),
    finalRegs,
    sequential: sequentialRegs(ops),
  };
}

function op(text: string, dest: string | null, srcs: string[], latency: number, kind: PrfOp["kind"], imm = 0): PrfOp {
  return { text, dest, srcs, latency, kind, imm };
}

export const PRF_PRESETS: Array<{ id: string; label: string; ops: PrfOp[]; config: PrfConfig }> = [
  {
    id: "mixed",
    label: "Mixed RAW, WAR, and WAW",
    config: { recoverAt: null },
    ops: [
      op("LD x1, 0(x2)", "x1", ["x2"], 3, "load", 0x11),
      op("ADD x5, x1, x6", "x5", ["x1", "x6"], 1, "alu"),
      op("SUB x5, x5, x3", "x5", ["x5", "x3"], 1, "alu"),
      op("AND x7, x6, x4", "x7", ["x6", "x4"], 1, "alu"),
      op("OR x1, x7, x4", "x1", ["x7", "x4"], 1, "alu"),
      op("ADDI x6, x6, 1", "x6", ["x6"], 1, "alu", 1),
    ],
  },
  {
    id: "raw",
    label: "RAW chain",
    config: { recoverAt: null },
    ops: [
      op("ADD x1, x2, x3", "x1", ["x2", "x3"], 1, "alu"),
      op("ADD x4, x1, x5", "x4", ["x1", "x5"], 1, "alu"),
      op("ADD x6, x4, x7", "x6", ["x4", "x7"], 1, "alu"),
    ],
  },
  {
    id: "war",
    label: "WAR removed by renaming",
    config: { recoverAt: null },
    ops: [
      op("ADD x4, x1, x2", "x4", ["x1", "x2"], 2, "alu"),
      op("ADD x1, x3, x5", "x1", ["x3", "x5"], 1, "alu"),
    ],
  },
  {
    id: "waw",
    label: "WAW removed by renaming",
    config: { recoverAt: null },
    ops: [
      op("ADD x1, x2, x3", "x1", ["x2", "x3"], 3, "alu"),
      op("ADD x1, x4, x5", "x1", ["x4", "x5"], 1, "alu"),
      op("ADD x6, x1, x7", "x6", ["x1", "x7"], 1, "alu"),
    ],
  },
  {
    id: "empty",
    label: "Free-list exhaustion",
    config: { recoverAt: null },
    ops: Array.from({ length: 9 }, (_, index) => op(`ADD x1, x2, x3  #${index + 1}`, "x1", ["x2", "x3"], 12, "alu")),
  },
  {
    id: "recover",
    label: "Commit-map recovery",
    config: { recoverAt: 4 },
    ops: [
      op("ADD x1, x2, x3", "x1", ["x2", "x3"], 8, "alu"),
      op("ADD x4, x5, x6", "x4", ["x5", "x6"], 8, "alu"),
      op("ADD x7, x2, x3", "x7", ["x2", "x3"], 1, "alu"),
    ],
  },
];
