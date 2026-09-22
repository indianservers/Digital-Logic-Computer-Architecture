export interface MiniOp {
  text: string;
  dest: string;
  sources: string[];
}

export const FLYNN = [
  { id: "SISD", title: "Single instruction, single data", example: "One ALU steps through one stream. The Phase 4 CPU is this shape." },
  { id: "SIMD", title: "Single instruction, multiple data", example: "One add applies to every lane of two vectors." },
  { id: "MISD", title: "Multiple instruction, single data", example: "Several operations watch one data stream. Teaching example, rarely a product category." },
  { id: "MIMD", title: "Multiple instruction, multiple data", example: "Separate cores run different instruction streams." },
] as const;

export function independent(left: MiniOp, right: MiniOp): boolean {
  if (left.dest !== "" && (right.sources.includes(left.dest) || left.dest === right.dest)) return false;
  if (right.dest !== "" && left.sources.includes(right.dest)) return false;
  return true;
}

export function issueCycles(ops: MiniOp[], width: number): number[] {
  const readyAt = new Map<string, number>();
  const issued = new Map<number, number>();
  const limit = Math.max(1, width);
  return ops.map((op) => {
    let earliest = 0;
    for (const source of op.sources) earliest = Math.max(earliest, readyAt.get(source) ?? 0);
    let cycle = earliest;
    while ((issued.get(cycle) ?? 0) >= limit) cycle += 1;
    issued.set(cycle, (issued.get(cycle) ?? 0) + 1);
    if (op.dest !== "") readyAt.set(op.dest, cycle + 1);
    return cycle;
  });
}

export function renameOps(ops: MiniOp[]): Array<{ sources: string[]; dest: string }> {
  const map = new Map<string, string>();
  let next = 0;
  return ops.map((op) => {
    const sources = op.sources.map((source) => map.get(source) ?? source);
    if (op.dest === "") return { sources, dest: "" };
    next += 1;
    const dest = `p${next}`;
    map.set(op.dest, dest);
    return { sources, dest };
  });
}

export interface RobEntry {
  text: string;
  status: "wait" | "execute" | "done" | "retire";
}

export function stepRob(entries: RobEntry[]): RobEntry[] {
  const next = entries.map((entry) => ({ ...entry }));
  const executing = next.find((entry) => entry.status === "execute");
  if (executing) executing.status = "done";
  const waiting = next.find((entry) => entry.status === "wait");
  if (waiting && !next.some((entry) => entry.status === "execute")) waiting.status = "execute";
  const head = next.find((entry) => entry.status !== "retire");
  if (head?.status === "done") head.status = "retire";
  return next;
}

export function speculate(predictedTaken: boolean, actualTaken: boolean, wrongPathCount: number): { correct: boolean; flushed: number } {
  const correct = predictedTaken === actualTaken;
  return { correct, flushed: correct ? 0 : wrongPathCount };
}

export function vectorAdd(left: number[], right: number[]): number[] {
  const width = Math.max(left.length, right.length);
  return Array.from({ length: width }, (_, index) => (left[index] ?? 0) + (right[index] ?? 0));
}

export function smtIssue(slots: number, threadA: number, threadB: number): { cycles: number; issued: number; utilization: number } {
  const pending = [threadA, threadB];
  let cycles = 0;
  let issued = 0;
  while (pending.some((count) => count > 0)) {
    let room = Math.max(1, slots);
    for (let thread = 0; thread < pending.length && room > 0; thread += 1) {
      const have = pending[thread] ?? 0;
      const take = Math.min(room, have);
      pending[thread] = have - take;
      room -= take;
      issued += take;
    }
    cycles += 1;
  }
  return { cycles, issued, utilization: cycles === 0 ? 0 : issued / cycles };
}
