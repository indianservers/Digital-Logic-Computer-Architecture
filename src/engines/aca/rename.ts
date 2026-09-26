import { findDeps, parsePipe, type PipeOp } from "./hazards";
import { parseScore, runScoreboard, type ScoreOp, type ScoreSnapshot } from "./scoreboard";

export interface PhysMap { arch: string; phys: string; valid: boolean }
export interface RenameRow { text: string; archDest: string; physDest: string; archSrcs: string; physSrcs: string }
export interface RenameResult {
  rows: RenameRow[];
  map: PhysMap[];
  inUse: string[];
  free: string[];
  recent: string[];
  waw: number;
  war: number;
  raw: number;
  renameStalls: number;
  baselineCycles: number;
  baselineStalls: number;
  renamedCycles: number;
  renamedStalls: number;
  baselineCells: Array<Array<string | null>>;
  renamedCells: Array<Array<string | null>>;
}

const FREE = ["P1", "P4", "P5", "P8", "P10", "P15", "P3", "P13", "P14", "P16"];

function boardOf(shots: ScoreSnapshot[], ops: ScoreOp[]): { cycles: number; stalls: number; cells: Array<Array<string | null>> } {
  const last = shots.at(-1);
  const cycles = last?.cycle ?? 0;
  const cells = ops.map(() => Array.from({ length: cycles }, () => null as string | null));
  shots.forEach((shot) => {
    if (shot.cycle === 0) return;
    const column = shot.cycle - 1;
    shot.rows.forEach((row, index) => {
      const line = cells[index];
      if (!line) return;
      if (row.write === shot.cycle) line[column] = "WB";
      else if (row.execStart != null && shot.cycle >= row.execStart && (row.execEnd == null || shot.cycle <= row.execEnd)) line[column] = "EX";
      else if (row.read === shot.cycle) line[column] = "ID";
      else if (row.issue === shot.cycle) line[column] = "IF";
    });
    shot.events.forEach((event) => {
      if (event.kind !== "stall") return;
      const index = ops.findIndex((op) => event.text.startsWith(op.text));
      const line = cells[index];
      if (line && line[column] == null) line[column] = "STALL";
    });
  });
  const stalls = shots.reduce((sum, shot) => sum + shot.events.filter((event) => event.kind === "stall").length, 0);
  return { cycles, stalls, cells };
}

export const RENAME_EXAMPLE: PipeOp[] = [
  parsePipe("ADD x1, x2, x3", "# x1 = x2 + x3"),
  parsePipe("SUB x4, x1, x5", "# x4 = x1 - x5"),
  parsePipe("ADD x1, x6, x7", "# x1 = x6 + x7"),
  parsePipe("OR x8, x1, x9", "# x8 = x1 | x9"),
  parsePipe("ADD x4, x10, x11", "# x4 = x10 + x11"),
  parsePipe("SW x4, 0(x12)", "# MEM[x12] = x4"),
];

export function runRename(ops: PipeOp[], poolSize = 10): RenameResult {
  const map = new Map<string, string>([["x0", "P0"], ["x2", "P2"], ["x3", "P3"], ["x5", "P6"], ["x6", "P7"], ["x7", "P9"], ["x9", "P11"], ["x10", "P12"], ["x11", "P13"], ["x12", "P14"]]);
  const free = FREE.slice(0, Math.max(1, poolSize));
  const recent: string[] = [];
  const rows: RenameRow[] = [];
  const renamed: PipeOp[] = [];
  let renameStalls = 0;
  ops.forEach((op) => {
    const physSrcs = op.srcs.map((reg) => map.get(reg) ?? reg);
    let physDest = "—";
    if (op.dest) {
      const next = free.shift();
      if (!next) {
        renameStalls += 1;
        physDest = "stall";
      } else {
        map.set(op.dest, next);
        physDest = next;
        recent.push(next);
      }
    }
    rows.push({ text: op.text, archDest: op.dest ?? "—", physDest, archSrcs: op.srcs.join(", ") || "—", physSrcs: physSrcs.join(", ") || "—" });
    renamed.push({ ...op, dest: physDest === "stall" ? op.dest : (op.dest ? physDest : null), srcs: physSrcs, text: op.text });
  });
  const deps = findDeps(ops);
  const baseOps = ops.map((op) => parseScore(op.text, op.comment));
  const renamedOps = renamed.map((op, index) => {
    const parsed = baseOps[index] ?? parseScore(op.text, op.comment);
    return { ...parsed, dest: op.dest, srcs: op.srcs };
  });
  const baseShots = runScoreboard(baseOps, 80, 3);
  const renamedShots = runScoreboard(renamedOps, 80, 3);
  const baseBoard = boardOf(baseShots, baseOps);
  const renamedBoard = boardOf(renamedShots, renamedOps);
  const pool = ["P0", "P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8", "P9", "P10", "P11", "P12", "P13", "P14", "P15"];
  const used = new Set<string>(["P0"]);
  map.forEach((phys) => used.add(phys));
  rows.forEach((row) => row.physSrcs.split(", ").forEach((name) => { if (name !== "—") used.add(name); }));
  return {
    rows,
    map: [...map.entries()].map(([arch, phys]) => ({ arch, phys, valid: arch !== "x0" })).sort((a, b) => a.arch.localeCompare(b.arch, undefined, { numeric: true })),
    inUse: pool.filter((name) => used.has(name) && !recent.includes(name)),
    free: pool.filter((name) => !used.has(name)),
    recent,
    waw: deps.filter((edge) => edge.type === "WAW").length,
    war: deps.filter((edge) => edge.type === "WAR").length,
    raw: deps.filter((edge) => edge.type === "RAW").length,
    renameStalls,
    baselineCycles: baseBoard.cycles,
    baselineStalls: baseBoard.stalls,
    renamedCycles: renamedBoard.cycles,
    renamedStalls: renamedBoard.stalls,
    baselineCells: baseBoard.cells,
    renamedCells: renamedBoard.cells,
  };
}
