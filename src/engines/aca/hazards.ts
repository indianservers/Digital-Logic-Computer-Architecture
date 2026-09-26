export type PipeKind = "alu" | "load" | "store";
export type HazardType = "RAW" | "WAR" | "WAW";

export interface PipeOp {
  text: string;
  comment: string;
  dest: string | null;
  srcs: string[];
  kind: PipeKind;
}

export interface DepEdge {
  from: number;
  to: number;
  reg: string;
  type: HazardType;
}

export interface ForwardEvent {
  from: number;
  to: number;
  reg: string;
  path: string;
}

export interface PipeResult {
  cycles: number;
  stalls: number;
  cells: Array<Array<string | null>>;
  forwards: ForwardEvent[];
  deps: DepEdge[];
}

const ZERO = new Set(["x0", "zero"]);

export function parsePipe(text: string, comment = ""): PipeOp {
  const clean = text.replace(/,/g, " ").replace(/\s+/g, " ").trim();
  const parts = clean.split(" ");
  const op = (parts[0] ?? "NOP").toUpperCase();
  if (op === "SW" || op === "SD" || op === "STORE") {
    const data = parts[1] ?? "x0";
    const addr = parts[2] ?? "0(x0)";
    const base = addr.includes("(") ? addr.slice(addr.indexOf("(") + 1, addr.indexOf(")")) : addr;
    return { text, comment, dest: null, srcs: [base, data].filter((reg) => !ZERO.has(reg)), kind: "store" };
  }
  if (op === "LW" || op === "LD" || op === "LOAD") {
    const dest = parts[1] ?? "x1";
    const addr = parts[2] ?? "0(x0)";
    const base = addr.includes("(") ? addr.slice(addr.indexOf("(") + 1, addr.indexOf(")")) : "x0";
    return { text, comment, dest, srcs: ZERO.has(base) ? [] : [base], kind: "load" };
  }
  const dest = parts[1] ?? null;
  const srcs = parts.slice(2).filter((reg) => reg && !reg.startsWith("#") && Number.isNaN(Number(reg)) && !ZERO.has(reg));
  return { text, comment, dest, srcs, kind: "alu" };
}

export function findDeps(ops: PipeOp[]): DepEdge[] {
  const deps: DepEdge[] = [];
  for (let to = 1; to < ops.length; to += 1) {
    for (let from = 0; from < to; from += 1) {
      const earlier = ops[from];
      const later = ops[to];
      if (!earlier || !later) continue;
      if (earlier.dest && later.srcs.includes(earlier.dest)) {
        const hidden = ops.slice(from + 1, to).some((op) => op.dest === earlier.dest);
        if (!hidden) deps.push({ from, to, reg: earlier.dest, type: "RAW" });
      }
      if (later.dest && earlier.srcs.includes(later.dest)) deps.push({ from, to, reg: later.dest, type: "WAR" });
      if (earlier.dest && later.dest === earlier.dest) deps.push({ from, to, reg: earlier.dest, type: "WAW" });
    }
  }
  return deps;
}

function producer(ops: PipeOp[], index: number, reg: string): number | null {
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    if (ops[cursor]?.dest === reg) return cursor;
  }
  return null;
}

export function runPipeline(ops: PipeOp[], forwarding: boolean, insertStalls = true): PipeResult {
  const deps = findDeps(ops);
  const cells: Array<Array<string | null>> = ops.map(() => []);
  const exEnd = new Map<number, number>();
  const memEnd = new Map<number, number>();
  const wbEnd = new Map<number, number>();
  const forwards: ForwardEvent[] = [];
  const noted = new Set<string>();
  let fetch = 0;
  let stageIf: number | null = null;
  let stageId: number | null = null;
  let stageEx: number | null = null;
  let stageMem: number | null = null;
  let stageWb: number | null = null;
  const seenId = new Set<number>();
  let cycle = 0;
  let stalls = 0;
  const limit = Math.max(12, ops.length * 12 + 6);
  if (ops.length > 0) {
    stageIf = 0;
    fetch = 1;
  }

  const ready = (consumer: number, reg: string): boolean => {
    if (ZERO.has(reg)) return true;
    const made = producer(ops, consumer, reg);
    if (made == null) return true;
    if (!forwarding) return made === stageWb || (wbEnd.get(made) ?? Infinity) < cycle;
    const kind = ops[made]?.kind;
    if (kind === "load") return made === stageMem || made === stageWb || (memEnd.get(made) ?? Infinity) < cycle;
    return made === stageEx || made === stageMem || made === stageWb || (exEnd.get(made) ?? Infinity) < cycle;
  };

  while (cycle < limit) {
    const live = stageIf !== null || stageId !== null || stageEx !== null || stageMem !== null || stageWb !== null || fetch < ops.length;
    if (!live) break;
    cycle += 1;
    const op: PipeOp | undefined = stageId == null ? undefined : ops[stageId];
    const stall: boolean = Boolean(insertStalls && op && op.srcs.some((reg) => !ready(stageId as number, reg)));
    const mark = (index: number | null, name: string) => {
      if (index == null) return;
      const row = cells[index];
      if (row) row[cycle - 1] = name;
    };
    mark(stageIf, "IF");
    if (stageId != null) {
      mark(stageId, stall && seenId.has(stageId) ? "STALL" : "ID");
      seenId.add(stageId);
    }
    mark(stageEx, "EX");
    mark(stageMem, "MEM");
    mark(stageWb, "WB");
    if (stageEx != null) {
      const current = ops[stageEx];
      current?.srcs.forEach((reg) => {
        const made = producer(ops, stageEx as number, reg);
        if (made == null || !forwarding) return;
        if ((wbEnd.get(made) ?? Infinity) < cycle) return;
        const key = `${made}-${stageEx}-${reg}`;
        if (noted.has(key)) return;
        noted.add(key);
        const path = ops[made]?.kind === "load" ? "MEM/WB → EX" : "EX/MEM → EX";
        forwards.push({ from: made, to: stageEx as number, reg, path });
      });
    }
    if (stageWb != null) wbEnd.set(stageWb, cycle);
    if (stageMem != null) memEnd.set(stageMem, cycle);
    if (stageEx != null) exEnd.set(stageEx, cycle);
    const nextWb = stageMem;
    const nextMem = stageEx;
    const nextEx = stall ? null : stageId;
    const nextId: number | null = stall ? stageId : stageIf;
    let nextIf: number | null = stageIf;
    if (!stall) {
      nextIf = fetch < ops.length ? fetch : null;
      if (nextIf != null) fetch += 1;
    } else stalls += 1;
    stageWb = nextWb;
    stageMem = nextMem;
    stageEx = nextEx;
    stageId = nextId;
    stageIf = nextIf;
  }

  ops.forEach((_, index) => {
    const row = cells[index];
    if (row && row.length < cycle) row.length = cycle;
  });
  return { cycles: cycle, stalls, cells, forwards, deps };
}

export function scheduleOps(ops: PipeOp[]): number[] {
  const deps = findDeps(ops);
  const need = ops.map((_, index) => deps.filter((edge) => edge.to === index).map((edge) => edge.from));
  const placed: number[] = [];
  const left = new Set(ops.map((_, index) => index));
  while (left.size) {
    const readySet = [...left].filter((index) => (need[index] ?? []).every((item) => placed.includes(item)));
    const last = placed.at(-1);
    const preferred = readySet.find((index) => !deps.some((edge) => edge.type === "RAW" && edge.from === last && edge.to === index));
    const readyIndex = preferred ?? readySet[0];
    if (readyIndex == null) break;
    placed.push(readyIndex);
    left.delete(readyIndex);
  }
  return placed;
}

export function reorder<T>(items: T[], order: number[]): T[] {
  return order.map((index) => items[index]).filter((item): item is T => item != null);
}

export const HAZARD_EXAMPLE: PipeOp[] = [
  parsePipe("ADD x1, x0, x5", "# x1 = x5"),
  parsePipe("SUB x2, x1, x6", "# x2 = x1 - x6"),
  parsePipe("AND x3, x2, x1", "# x3 = x2 & x1"),
  parsePipe("OR x4, x3, x7", "# x4 = x3 | x7"),
  parsePipe("ADDI x8, x4, 10", "# x8 = x4 + 10"),
  parsePipe("SW x8, 0(x9)", "# MEM[x9] = x8"),
];
