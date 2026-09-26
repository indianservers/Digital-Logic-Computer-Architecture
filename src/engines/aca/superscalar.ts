export interface SuperOp {
  text: string;
  comment: string;
  dest: string | null;
  srcs: string[];
  latency: number;
  fu: "alu" | "mul" | "mem";
}

export interface SuperWidths {
  fetch: number;
  decode: number;
  dispatch: number;
  execute: number;
  retire: number;
}

export interface SuperResult {
  cycles: number;
  retired: number;
  ipc: number;
  cells: Array<Array<string | null>>;
  lanes: number[];
  retireAt: Array<number | null>;
  used: { fetch: number; decode: number; dispatch: number; execute: number; retire: number };
  ipcHistory: number[];
}

const EMPTY: SuperWidths = { fetch: 1, decode: 1, dispatch: 1, execute: 1, retire: 1 };

function producer(ops: SuperOp[], index: number, reg: string): number | null {
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    if (ops[cursor]?.dest === reg) return cursor;
  }
  return null;
}

export function runSuper(ops: SuperOp[], widths: SuperWidths): SuperResult {
  const fetchAt = ops.map(() => null as number | null);
  const decodeAt = ops.map(() => null as number | null);
  const dispatchAt = ops.map(() => null as number | null);
  const exStart = ops.map(() => null as number | null);
  const exEnd = ops.map(() => null as number | null);
  const wbAt = ops.map(() => null as number | null);
  const retireAt = ops.map(() => null as number | null);
  const lanes = ops.map(() => 0);
  const cells = ops.map(() => [] as Array<string | null>);
  const used = { fetch: 0, decode: 0, dispatch: 0, execute: 0, retire: 0 };
  const ipcHistory: number[] = [];
  const stamp = (index: number, cycle: number, token: string) => {
    const row = cells[index];
    if (row && row[cycle - 1] == null) row[cycle - 1] = token;
  };
  let cycles = 0;
  for (let cycle = 1; cycle <= 240; cycle += 1) {
    cycles = cycle;
    let retireN = 0;
    for (let index = 0; index < ops.length && retireN < widths.retire; index += 1) {
      if (retireAt[index] != null) continue;
      if (wbAt[index] == null || (wbAt[index] ?? 0) >= cycle) break;
      retireAt[index] = cycle;
      retireN += 1;
      stamp(index, cycle, "WB");
    }
    used.retire += retireN;
    let executeN = 0;
    const busy = exStart.filter((start, index) => start != null && (exEnd[index] ?? 0) >= cycle).length;
    for (let index = 0; index < ops.length && executeN + busy < widths.execute; index += 1) {
      if (exStart[index] != null) continue;
      if (dispatchAt[index] == null || (dispatchAt[index] ?? 0) >= cycle) break;
      const op = ops[index];
      if (!op) break;
      const ready = op.srcs.every((reg) => {
        const from = producer(ops, index, reg);
        return from == null || (exEnd[from] ?? Infinity) < cycle;
      });
      if (!ready) break;
      exStart[index] = cycle;
      exEnd[index] = cycle + op.latency - 1;
      wbAt[index] = cycle + op.latency;
      executeN += 1;
      stamp(index, cycle, "EX");
    }
    used.execute += executeN;
    let dispatchN = 0;
    const queued = dispatchAt.filter((at, index) => at != null && exStart[index] == null).length;
    for (let index = 0; index < ops.length && dispatchN < widths.dispatch && queued + dispatchN < Math.max(widths.dispatch, 4); index += 1) {
      if (dispatchAt[index] != null) continue;
      if (decodeAt[index] == null || (decodeAt[index] ?? 0) >= cycle) break;
      dispatchAt[index] = cycle;
      dispatchN += 1;
      stamp(index, cycle, "DIS");
    }
    used.dispatch += dispatchN;
    let decodeN = 0;
    const decodedWaiting = decodeAt.filter((at, index) => at != null && dispatchAt[index] == null).length;
    for (let index = 0; index < ops.length && decodeN < widths.decode && decodedWaiting + decodeN < widths.decode * 2; index += 1) {
      if (decodeAt[index] != null) continue;
      if (fetchAt[index] == null || (fetchAt[index] ?? 0) >= cycle) break;
      decodeAt[index] = cycle;
      decodeN += 1;
      stamp(index, cycle, "ID");
    }
    used.decode += decodeN;
    let fetchN = 0;
    const fetchedWaiting = fetchAt.filter((at, index) => at != null && decodeAt[index] == null).length;
    for (let index = 0; index < ops.length && fetchN < widths.fetch && fetchedWaiting + fetchN < widths.fetch * 2; index += 1) {
      if (fetchAt[index] != null) continue;
      fetchAt[index] = cycle;
      lanes[index] = fetchN;
      fetchN += 1;
      stamp(index, cycle, "IF");
    }
    used.fetch += fetchN;
    const retired = retireAt.filter((at) => at != null).length;
    ipcHistory.push(retired / cycle);
    if (retired === ops.length) break;
  }
  const retired = retireAt.filter((at) => at != null).length;
  return { cycles, retired, ipc: retired / Math.max(1, cycles), cells, lanes, retireAt, used, ipcHistory };
}

export function compareSuper(ops: SuperOp[], widths: SuperWidths): { scalar: SuperResult; wide: SuperResult } {
  return { scalar: runSuper(ops, { ...EMPTY, fetch: 1, decode: 1, dispatch: 1, execute: 1, retire: 1 }), wide: runSuper(ops, widths) };
}

function alu(text: string, comment: string): SuperOp {
  const parts = text.replace(/,/g, " ").split(/\s+/);
  const dest = parts[1] ?? null;
  const srcs = parts.slice(2).filter((reg) => reg && Number.isNaN(Number(reg)) && reg !== "x0");
  const op = (parts[0] ?? "").toUpperCase();
  if (op.startsWith("MUL")) return { text, comment, dest, srcs, latency: 3, fu: "mul" };
  if (op === "LD" || op === "LW" || op === "SD" || op === "SW") {
    const store = op.startsWith("S");
    const base = (parts[store ? 2 : 2] ?? "0(x0)").match(/\(([^)]+)\)/)?.[1] ?? "x0";
    const data = store ? (parts[1] ?? "x0") : null;
    return { text, comment, dest: store ? null : (parts[1] ?? "x1"), srcs: [base, data].filter((reg): reg is string => Boolean(reg) && reg !== "x0"), latency: 2, fu: "mem" };
  }
  return { text, comment, dest, srcs, latency: 1, fu: "alu" };
}

export const SUPER_PRESETS: Array<{ id: string; label: string; ops: SuperOp[]; widths: SuperWidths }> = [
  {
    id: "free",
    label: "Independent instructions",
    widths: { fetch: 4, decode: 4, dispatch: 4, execute: 4, retire: 4 },
    ops: [1, 2, 3, 4, 5, 6, 7, 8].map((index) => alu(`ADD x${index}, x${index + 10}, x${index + 20}`, "independent")),
  },
  {
    id: "chain",
    label: "Dependency chain",
    widths: { fetch: 4, decode: 4, dispatch: 4, execute: 4, retire: 4 },
    ops: [alu("ADD x1, x2, x3", "start"), alu("ADD x4, x1, x5", "uses x1"), alu("ADD x6, x4, x7", "uses x4"), alu("ADD x8, x6, x9", "uses x6")],
  },
  {
    id: "mixed",
    label: "Mixed graph",
    widths: { fetch: 4, decode: 4, dispatch: 4, execute: 4, retire: 4 },
    ops: [
      alu("LD x1, 0(x2)", "load A"),
      alu("LD x3, 0(x4)", "load B"),
      alu("ADD x5, x1, x3", "A + B"),
      alu("MUL x6, x5, x7", "product"),
      alu("SUB x8, x9, x10", "independent"),
      alu("LD x11, 0(x12)", "load E"),
      alu("ADD x13, x11, x6", "join"),
      alu("SD x13, 0(x14)", "store"),
    ],
  },
  {
    id: "long",
    label: "Long-latency operation",
    widths: { fetch: 2, decode: 2, dispatch: 2, execute: 2, retire: 2 },
    ops: [alu("MUL x1, x2, x3", "slow"), alu("ADD x4, x5, x6", "beside it"), alu("ADD x7, x1, x8", "waits")],
  },
  {
    id: "front",
    label: "Front-end bottleneck",
    widths: { fetch: 4, decode: 1, dispatch: 1, execute: 4, retire: 4 },
    ops: [1, 2, 3, 4, 5, 6, 7, 8].map((index) => alu(`ADD x${index}, x${index + 10}, x${index + 20}`, "decode limited")),
  },
  {
    id: "back",
    label: "Back-end bottleneck",
    widths: { fetch: 4, decode: 4, dispatch: 4, execute: 1, retire: 4 },
    ops: [1, 2, 3, 4, 5, 6, 7, 8].map((index) => alu(`ADD x${index}, x${index + 10}, x${index + 20}`, "issue limited")),
  },
];
