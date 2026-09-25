export type AcaOp = { text: string; dest: string; srcs: string[]; latency: number; fu: "alu" | "load" | "div" };

export const SCHEDULE_OPS: AcaOp[] = [
  { text: "LW R2, 0(R1)", dest: "R2", srcs: ["R1"], latency: 2, fu: "load" },
  { text: "ADD R4, R2, R3", dest: "R4", srcs: ["R2", "R3"], latency: 1, fu: "alu" },
  { text: "SUB R6, R5, R7", dest: "R6", srcs: ["R5", "R7"], latency: 1, fu: "alu" },
  { text: "ADD R8, R4, R6", dest: "R8", srcs: ["R4", "R6"], latency: 1, fu: "alu" },
];

export const SCORE_OPS: AcaOp[] = [
  { text: "DIV R1, R2, R3", dest: "R1", srcs: ["R2", "R3"], latency: 4, fu: "div" },
  { text: "ADD R4, R1, R5", dest: "R4", srcs: ["R1", "R5"], latency: 1, fu: "alu" },
  { text: "SUB R1, R6, R7", dest: "R1", srcs: ["R6", "R7"], latency: 1, fu: "load" },
  { text: "AND R8, R1, R4", dest: "R8", srcs: ["R1", "R4"], latency: 1, fu: "alu" },
];

export function staticCycles(ops: AcaOp[]): { cycles: number; stalls: number; issue: number[] } {
  const done = new Map<string, number>();
  const issue: number[] = [];
  let stalls = 0;
  let cycle = 0;
  for (const op of ops) {
    const ready = op.srcs.reduce((max, src) => Math.max(max, done.get(src) ?? 0), 0);
    if (ready > cycle) {
      stalls += ready - cycle;
      cycle = ready;
    }
    issue.push(cycle);
    done.set(op.dest, cycle + op.latency);
    cycle += 1;
  }
  let finish = 0;
  done.forEach((value) => { finish = Math.max(finish, value); });
  return { cycles: finish, stalls, issue };
}

export function listSchedule(ops: AcaOp[]): AcaOp[] {
  const left = ops.slice();
  const out: AcaOp[] = [];
  const doneAt = new Map<string, number>();
  let cycle = 0;
  const readyAt = (op: AcaOp) => op.srcs.reduce((max, src) => Math.max(max, doneAt.get(src) ?? 0), 0);
  while (left.length) {
    let index = left.findIndex((op) => readyAt(op) <= cycle);
    if (index < 0) {
      const soonest = Math.min(...left.map(readyAt));
      cycle = soonest;
      index = left.findIndex((op) => readyAt(op) <= cycle);
    }
    const op = left.splice(Math.max(0, index), 1)[0];
    if (!op) break;
    out.push(op);
    doneAt.set(op.dest, cycle + op.latency);
    cycle += 1;
  }
  return out;
}

function withRename(ops: AcaOp[]): AcaOp[] {
  const map = new Map<string, string>();
  let next = 0;
  return ops.map((op) => {
    const srcs = op.srcs.map((src) => map.get(src) ?? src);
    next += 1;
    const dest = `${op.dest}#${next}`;
    map.set(op.dest, dest);
    return { ...op, dest, srcs };
  });
}

type Stage = "q" | "i" | "e" | "w" | "d";

export function runScoreboard(ops: AcaOp[], rename: boolean): { cycles: number; waw: number; war: number; raw: number; log: string[] } {
  const prog = rename ? withRename(ops) : ops.map((op) => ({ ...op }));
  const stage: Stage[] = prog.map(() => "q");
  const left = prog.map(() => 0);
  const fu = new Map<string, number>();
  const writer = new Map<string, number>();
  let waw = 0;
  let war = 0;
  let raw = 0;
  const log: string[] = [];
  let cycle = 0;
  while (stage.some((item) => item !== "d") && cycle < 48) {
    for (let index = 0; index < prog.length; index += 1) {
      if (stage[index] !== "w") continue;
      const op = prog[index];
      if (!op) continue;
      const blocked = prog.some((other, otherIndex) => otherIndex < index && stage[otherIndex] === "i" && other.srcs.includes(op.dest));
      if (blocked) {
        war += 1;
        log.push(`c${cycle} WAR holds ${op.text}`);
        continue;
      }
      stage[index] = "d";
      if (fu.get(op.fu) === index) fu.delete(op.fu);
      if (writer.get(op.dest) === index) writer.delete(op.dest);
      log.push(`c${cycle} write ${op.text}`);
      break;
    }
    for (let index = 0; index < prog.length; index += 1) {
      if (stage[index] !== "e") continue;
      left[index] = (left[index] ?? 1) - 1;
      if ((left[index] ?? 0) <= 0) stage[index] = "w";
    }
    for (let index = 0; index < prog.length; index += 1) {
      if (stage[index] !== "i") continue;
      const op = prog[index];
      if (!op) continue;
      if (op.srcs.some((src) => writer.has(src))) {
        raw += 1;
        continue;
      }
      stage[index] = "e";
      left[index] = op.latency;
      log.push(`c${cycle} read ${op.text}`);
      break;
    }
    const next = stage.findIndex((item) => item === "q");
    const op = prog[next];
    if (next >= 0 && op) {
      if (fu.has(op.fu)) log.push(`c${cycle} structural ${op.text}`);
      else if (writer.has(op.dest)) {
        waw += 1;
        log.push(`c${cycle} WAW ${op.text}`);
      } else {
        stage[next] = "i";
        fu.set(op.fu, next);
        writer.set(op.dest, next);
        log.push(`c${cycle} issue ${op.text}`);
      }
    }
    cycle += 1;
  }
  return { cycles: cycle, waw, war, raw, log };
}

export function runTomasulo(ops: AcaOp[]): { cycles: number; waw: number; stations: string[]; log: string[] } {
  const board = runScoreboard(ops, true);
  const stations = ops.map((op, index) => `${op.fu === "div" ? "Mul" : op.fu === "load" ? "Load" : "Add"}${(index % 2) + 1}: ${op.text}`);
  return { cycles: board.cycles, waw: board.waw, stations, log: ["Reservation stations capture operands or tags. The register file keeps the latest tag.", ...board.log] };
}

export function runRob(ops: AcaOp[]): { execOrder: string[]; commitOrder: string[]; finish: number[]; commit: number[] } {
  const renamed = withRename(ops);
  const produced = new Map<string, number>();
  const finish = renamed.map((op, index) => {
    const begin = Math.max(index, op.srcs.reduce((max, src) => Math.max(max, produced.get(src) ?? 0), 0));
    const end = begin + op.latency;
    produced.set(op.dest, end);
    return end;
  });
  const commit: number[] = [];
  let time = 0;
  finish.forEach((end) => {
    time = Math.max(time, end);
    commit.push(time);
    time += 1;
  });
  const execOrder = ops
    .map((op, index) => ({ text: op.text, end: finish[index] ?? 0, index }))
    .sort((left, right) => left.end - right.end || left.index - right.index)
    .map((item) => item.text);
  return { execOrder, commitOrder: ops.map((op) => op.text), finish, commit };
}

export function branchScore(trace: boolean[], kind: "one" | "two" | "correlating"): { correct: number; total: number } {
  let bit = 0;
  let two = 2;
  const table = [1, 1, 1, 1];
  let history = 0;
  let correct = 0;
  for (const taken of trace) {
    const counter = table[history] ?? 1;
    const prediction = kind === "one" ? bit === 1 : kind === "two" ? two >= 2 : counter >= 2;
    if (prediction === taken) correct += 1;
    if (kind === "one") bit = taken ? 1 : 0;
    else if (kind === "two") two = taken ? Math.min(3, two + 1) : Math.max(0, two - 1);
    else {
      table[history] = taken ? Math.min(3, counter + 1) : Math.max(0, counter - 1);
      history = ((history << 1) | (taken ? 1 : 0)) & 3;
    }
  }
  return { correct, total: trace.length };
}

export const LOOP_TRACE: boolean[] = Array.from({ length: 8 }, () => [true, true, false]).flat();

export function roofline(flops: number, bytes: number, peakGflops: number, bandwidthGBs: number): { intensity: number; ridge: number; achieved: number; bound: "memory" | "compute" } {
  const intensity = bytes <= 0 ? peakGflops : flops / bytes;
  const ridge = bandwidthGBs <= 0 ? peakGflops : peakGflops / bandwidthGBs;
  const achieved = Math.min(peakGflops, intensity * bandwidthGBs);
  return { intensity, ridge, achieved, bound: intensity < ridge ? "memory" : "compute" };
}
