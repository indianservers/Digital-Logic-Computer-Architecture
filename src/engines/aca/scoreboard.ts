export type ScoreFu = "Integer" | "Multiplier" | "Adder" | "Load/Store" | "Reserve";

export interface ScoreOp {
  text: string;
  comment: string;
  dest: string | null;
  srcs: string[];
  fu: ScoreFu;
  latency: number;
  op: string;
}

export interface ScoreRow {
  issue: number | null;
  read: number | null;
  execStart: number | null;
  execEnd: number | null;
  write: number | null;
  state: "Waiting" | "Issued" | "Reading" | "Executing" | "Write" | "Completed";
}

export interface FuView {
  name: ScoreFu;
  busy: boolean;
  op: string;
  fi: string;
  fj: string;
  fk: string;
  qj: string;
  qk: string;
  rj: boolean;
  rk: boolean;
  remain: number | null;
}

export interface ScoreEvent {
  cycle: number;
  kind: "issue" | "read" | "execute" | "write" | "stall";
  text: string;
  hazard: "RAW" | "WAR" | "WAW" | "Structural" | null;
}

export interface ScoreSnapshot {
  cycle: number;
  rows: ScoreRow[];
  units: FuView[];
  registers: Array<{ name: string; fu: string }>;
  events: ScoreEvent[];
  done: boolean;
}

interface Live {
  stage: "q" | "i" | "r" | "e" | "w" | "d";
  issue: number | null;
  read: number | null;
  execStart: number | null;
  execEnd: number | null;
  write: number | null;
  remain: number;
  fu: ScoreFu | null;
  fj: string;
  fk: string;
  qj: string;
  qk: string;
  rj: boolean;
  rk: boolean;
}

const ALU: ScoreFu[] = ["Integer", "Adder", "Reserve"];

export function parseScore(text: string, comment = ""): ScoreOp {
  const clean = text.replace(/,/g, " ").replace(/\s+/g, " ").trim();
  const parts = clean.split(" ");
  const op = (parts[0] ?? "NOP").toUpperCase();
  if (op === "LD" || op === "LW" || op === "SW" || op === "SD") {
    const dest = op.startsWith("S") ? null : (parts[1] ?? "x1");
    const addr = parts[op.startsWith("S") ? 2 : 2] ?? "0(x2)";
    const base = addr.includes("(") ? addr.slice(addr.indexOf("(") + 1, addr.indexOf(")")) : "x2";
    const data = op.startsWith("S") ? (parts[1] ?? "x1") : null;
    const srcs = [base, data].filter((reg): reg is string => Boolean(reg) && reg !== "x0");
    return { text, comment, dest, srcs, fu: "Load/Store", latency: 3, op };
  }
  const dest = parts[1] ?? "x1";
  const srcs = parts.slice(2).filter((reg) => reg && Number.isNaN(Number(reg)) && reg !== "x0");
  if (op.startsWith("MUL")) return { text, comment, dest, srcs, fu: "Multiplier", latency: 4, op };
  if (op.startsWith("DIV")) return { text, comment, dest, srcs, fu: "Multiplier", latency: 8, op };
  return { text, comment, dest, srcs, fu: "Adder", latency: 2, op };
}

function blank(ops: ScoreOp[]): Live[] {
  return ops.map((op) => ({
    stage: "q",
    issue: null,
    read: null,
    execStart: null,
    execEnd: null,
    write: null,
    remain: op.latency,
    fu: null,
    fj: op.srcs[0] ?? "-",
    fk: op.srcs[1] ?? "-",
    qj: "-",
    qk: "-",
    rj: false,
    rk: false,
  }));
}

function rowOf(live: Live): ScoreRow {
  const state = live.stage === "d" ? "Completed" : live.stage === "e" ? "Executing" : live.stage === "w" ? "Write" : live.stage === "r" ? "Reading" : live.stage === "i" ? "Issued" : "Waiting";
  return { issue: live.issue, read: live.read, execStart: live.execStart, execEnd: live.execEnd, write: live.write, state };
}

function views(ops: ScoreOp[], live: Live[], result: Map<string, string>): { units: FuView[]; registers: Array<{ name: string; fu: string }> } {
  const names: ScoreFu[] = ["Integer", "Multiplier", "Adder", "Load/Store"];
  const units = names.map((name) => {
    const index = live.findIndex((item, itemIndex) => item.fu === name && item.stage !== "d" && item.stage !== "q" && ops[itemIndex]);
    const item = index >= 0 ? live[index] : undefined;
    const op = index >= 0 ? ops[index] : undefined;
    return {
      name,
      busy: Boolean(item && item.stage !== "q"),
      op: op?.op ?? "-",
      fi: op?.dest ?? "-",
      fj: item?.fj ?? "-",
      fk: item?.fk ?? "-",
      qj: item?.qj ?? "-",
      qk: item?.qk ?? "-",
      rj: item?.rj ?? false,
      rk: item?.rk ?? false,
      remain: item && item.stage === "e" ? item.remain : null,
    };
  });
  const regs = [...result.keys()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return { units, registers: regs.map((name) => ({ name, fu: result.get(name) ?? "-" })) };
}

export function runScoreboard(ops: ScoreOp[], until = 80, aluSlots = 2): ScoreSnapshot[] {
  const live = blank(ops);
  const result = new Map<string, string>();
  const events: ScoreEvent[] = [];
  const shots: ScoreSnapshot[] = [];
  const fuBusy = new Map<ScoreFu, number>();

  const grab = (op: ScoreOp): ScoreFu | null => {
    const choices = op.fu === "Adder" ? ALU.slice(0, aluSlots) : [op.fu];
    return choices.find((name) => !fuBusy.has(name)) ?? null;
  };

  const publish = (cycle: number) => {
    const view = views(ops, live, result);
    shots.push({ cycle, rows: live.map(rowOf), units: view.units, registers: view.registers, events: events.filter((event) => event.cycle === cycle), done: live.every((item) => item.stage === "d") });
  };

  publish(0);
  for (let cycle = 1; cycle <= until; cycle += 1) {
    if (live.every((item) => item.stage === "d")) break;
    let wroteThisCycle = false;
    for (let index = 0; index < ops.length; index += 1) {
      const item = live[index];
      const op = ops[index];
      if (!item || !op || item.stage !== "w") continue;
      const war = ops.some((earlier, earlierIndex) => earlierIndex < index && live[earlierIndex]?.stage === "i" && earlier.srcs.includes(op.dest ?? ""));
      if (war) {
        events.push({ cycle, kind: "stall", text: `${op.text} cannot write ${op.dest}. An earlier instruction has not read it.`, hazard: "WAR" });
        continue;
      }
      if (wroteThisCycle) continue;
      item.stage = "d";
      item.write = cycle;
      if (item.fu) fuBusy.delete(item.fu);
      if (op.dest && result.get(op.dest) === item.fu) result.delete(op.dest);
      const tag = item.fu ?? "";
      live.forEach((other) => {
        if (other.qj === tag) { other.qj = "-"; other.rj = true; }
        if (other.qk === tag) { other.qk = "-"; other.rk = true; }
      });
      events.push({ cycle, kind: "write", text: `${op.text} writes ${op.dest ?? "memory"}.`, hazard: null });
      wroteThisCycle = true;
    }
    live.forEach((item, index) => {
      if (item.stage !== "e") return;
      item.remain -= 1;
      if (item.remain <= 0) {
        item.stage = "w";
        item.execEnd = cycle;
        events.push({ cycle, kind: "execute", text: `${ops[index]?.text ?? ""} finishes execution.`, hazard: null });
      }
    });
    for (let index = 0; index < ops.length; index += 1) {
      const item = live[index];
      const op = ops[index];
      if (!item || !op || item.stage !== "i") continue;
      if (!item.rj || !item.rk) {
        events.push({ cycle, kind: "stall", text: `${op.text} waits for ${!item.rj ? item.fj : item.fk}.`, hazard: "RAW" });
        continue;
      }
      item.stage = "e";
      item.read = cycle;
      item.execStart = cycle + 1;
      item.remain = op.latency;
      events.push({ cycle, kind: "read", text: `${op.text} reads operands.`, hazard: null });
      break;
    }
    const next = live.findIndex((item) => item.stage === "q");
    const op = ops[next];
    const item = live[next];
    if (next >= 0 && op && item) {
      const unit = grab(op);
      if (!unit) events.push({ cycle, kind: "stall", text: `${op.text} cannot issue. ${op.fu} is busy.`, hazard: "Structural" });
      else if (op.dest && result.has(op.dest)) events.push({ cycle, kind: "stall", text: `${op.text} cannot issue. WAW on ${op.dest}.`, hazard: "WAW" });
      else {
        item.stage = "i";
        item.issue = cycle;
        item.fu = unit;
        fuBusy.set(unit, next);
        item.qj = op.srcs[0] && result.get(op.srcs[0]) ? result.get(op.srcs[0]) ?? "-" : "-";
        item.qk = op.srcs[1] && result.get(op.srcs[1]) ? result.get(op.srcs[1]) ?? "-" : "-";
        item.rj = item.qj === "-";
        item.rk = item.qk === "-";
        if (op.dest) result.set(op.dest, unit);
        events.push({ cycle, kind: "issue", text: `${op.text} issues to ${unit}.`, hazard: null });
      }
    }
    publish(cycle);
  }
  return shots;
}

export const SCORE_EXAMPLE: ScoreOp[] = [
  parseScore("LD x1, 0(x2)", "# x1 = Mem[x2 + 0]"),
  parseScore("ADD x3, x1, x4", "# x3 = x1 + x4"),
  parseScore("MUL x5, x3, x6", "# x5 = x3 * x6"),
  parseScore("ADD x7, x5, x8", "# x7 = x5 + x8"),
  parseScore("LD x9, 8(x2)", "# x9 = Mem[x2 + 8]"),
  parseScore("ADD x10, x9, x1", "# x10 = x9 + x1"),
  parseScore("MUL x11, x10, x3", "# x11 = x10 * x3"),
  parseScore("ADD x12, x11, x5", "# x12 = x11 + x5"),
];
