export type StationKind = "add" | "mul" | "div" | "load" | "store";

export interface TomaOp {
  text: string;
  comment: string;
  dest: string | null;
  srcs: string[];
  kind: StationKind;
  latency: number;
  op: string;
  address: string;
  loadValue: number | null;
}

export interface StationView {
  name: string;
  kind: StationKind;
  busy: boolean;
  op: string;
  vj: string;
  vk: string;
  qj: string;
  qk: string;
  address: string;
  remain: number | null;
  dest: string;
}

export interface RegView {
  name: string;
  value: string;
  qi: string;
}

export interface CdbEvent {
  cycle: number;
  tag: string;
  value: string;
  dest: string;
}

export interface TomaResult {
  cycles: number;
  stations: StationView[];
  regs: RegView[];
  cdb: CdbEvent[];
  cells: Array<Array<string | null>>;
  issue: number[];
  exec: number[];
  write: number[];
  stalls: number;
}

export interface TomaShape {
  add: number;
  mul: number;
  div: number;
  load: number;
  store: number;
}

export const TOMA_SHAPE: TomaShape = { add: 3, mul: 2, div: 1, load: 2, store: 2 };

const PREFIX: Record<StationKind, string> = { add: "Add", mul: "Mul", div: "Div", load: "Load", store: "Store" };

const LATENCY: Record<StationKind, number> = { add: 2, mul: 6, div: 12, load: 2, store: 1 };

export function parseTomasulo(text: string, comment = ""): TomaOp {
  const clean = text.replace(/,/g, " ").replace(/\s+/g, " ").trim();
  const parts = clean.split(" ");
  const op = (parts[0] ?? "NOP").toUpperCase();
  const address = parts.find((part) => part.includes("(")) ?? "";
  if (op === "LD" || op === "LW") {
    return { text, comment, dest: parts[1] ?? "F1", srcs: [], kind: "load", latency: LATENCY.load, op: "LD", address, loadValue: address.startsWith("8") ? 8 : 12 };
  }
  if (op === "SD" || op === "SW") {
    return { text, comment, dest: null, srcs: [parts[1] ?? "F8"].filter(Boolean), kind: "store", latency: LATENCY.store, op: "SD", address, loadValue: null };
  }
  const dest = parts[1] ?? "F0";
  const srcs = parts.slice(2).filter((reg) => reg && Number.isNaN(Number(reg)));
  if (op.startsWith("MUL")) return { text, comment, dest, srcs, kind: "mul", latency: LATENCY.mul, op: "MUL", address: "", loadValue: null };
  if (op.startsWith("DIV")) return { text, comment, dest, srcs, kind: "div", latency: LATENCY.div, op: "DIV", address: "", loadValue: null };
  if (op.startsWith("SUB")) return { text, comment, dest, srcs, kind: "add", latency: LATENCY.add, op: "SUB", address: "", loadValue: null };
  return { text, comment, dest, srcs, kind: "add", latency: LATENCY.add, op: "ADD", address: "", loadValue: null };
}

interface Station {
  name: string;
  kind: StationKind;
  busy: boolean;
  op: string;
  vj: number | null;
  vk: number | null;
  qj: string;
  qk: string;
  address: string;
  remain: number;
  running: boolean;
  ready: boolean;
  dest: string;
  owner: number;
  issue: number;
}

interface Reg {
  value: number | null;
  qi: string;
}

function freshStations(shape: TomaShape = TOMA_SHAPE): Station[] {
  return (Object.keys(PREFIX) as StationKind[]).flatMap((kind) => Array.from({ length: Math.max(1, Math.min(4, shape[kind])) }, (_, index) => ({
    name: `${PREFIX[kind]}${index + 1}`, kind, busy: false, op: "-", vj: null, vk: null, qj: "", qk: "", address: "", remain: 0, running: false, ready: false, dest: "", owner: -1, issue: 0,
  })));
}

function fmt(value: number | null): string {
  if (value == null) return "-";
  return Number.isInteger(value) ? value.toFixed(1) : value.toFixed(2);
}

export function runTomasulo(ops: TomaOp[], seed: Record<string, number> = { F2: 8 }, shape: TomaShape = TOMA_SHAPE): TomaResult {
  const stations = freshStations(shape);
  const regs = new Map<string, Reg>();
  const touch = (name: string) => {
    if (!regs.has(name)) regs.set(name, { value: seed[name] ?? null, qi: "" });
    return regs.get(name) as Reg;
  };
  Object.keys(seed).forEach((name) => touch(name));
  const cells: Array<Array<string | null>> = ops.map(() => []);
  const issue: number[] = [];
  const exec: number[] = [];
  const write: number[] = [];
  const cdb: CdbEvent[] = [];
  let fetch = 0;
  let cycle = 0;
  let stalls = 0;
  const limit = 80;

  const capture = (regName: string): { v: number | null; q: string } => {
    const reg = touch(regName);
    if (reg.qi) return { v: null, q: reg.qi };
    return { v: reg.value, q: "" };
  };

  while (cycle < limit) {
    const pending = stations.some((station) => station.busy) || fetch < ops.length;
    if (!pending) break;
    cycle += 1;
    const broadcaster = stations
      .filter((station) => station.ready)
      .sort((a, b) => a.issue - b.issue)[0];
    if (broadcaster) {
      const value = broadcaster.kind === "load" ? (ops[broadcaster.owner]?.loadValue ?? 0) : compute(broadcaster);
      stations.forEach((station) => {
        if (station.qj === broadcaster.name) { station.vj = value; station.qj = ""; }
        if (station.qk === broadcaster.name) { station.vk = value; station.qk = ""; }
      });
      regs.forEach((reg) => {
        if (reg.qi === broadcaster.name) { reg.value = value; reg.qi = ""; }
      });
      cdb.push({ cycle, tag: broadcaster.name, value: fmt(value), dest: broadcaster.dest || "mem" });
      if (broadcaster.owner >= 0) write[broadcaster.owner] = cycle;
      const row = cells[broadcaster.owner];
      if (row) row[cycle - 1] = "WB";
      broadcaster.busy = false;
      broadcaster.ready = false;
      broadcaster.running = false;
    }
    stations.forEach((station) => {
      if (!station.busy || station.qj || station.qk || station.ready) return;
      if (!station.running) {
        station.running = true;
        station.remain = ops[station.owner]?.latency ?? 1;
        if (station.owner >= 0 && exec[station.owner] == null) exec[station.owner] = cycle;
      }
      station.remain -= 1;
      const row = cells[station.owner];
      if (row && row[cycle - 1] == null) row[cycle - 1] = "EX";
      if (station.remain <= 0) station.ready = true;
    });
    const op = ops[fetch];
    const home = stations.find((station) => station.kind === op?.kind && !station.busy);
    if (op && home) {
      const left = op.srcs[0] ? capture(op.srcs[0]) : { v: op.loadValue, q: "" };
      const right = op.srcs[1] ? capture(op.srcs[1]) : { v: null, q: "" };
      home.busy = true;
      home.op = op.op;
      home.vj = left.v;
      home.vk = op.kind === "load" ? null : right.v;
      home.qj = left.q;
      home.qk = op.kind === "load" || op.srcs.length < 2 ? "" : right.q;
      home.address = op.address;
      home.dest = op.dest ?? "";
      home.owner = fetch;
      home.issue = cycle;
      home.running = false;
      home.ready = false;
      if (op.dest) touch(op.dest).qi = home.name;
      issue[fetch] = cycle;
      const row = cells[fetch];
      if (row) {
        if (cycle > 2) row[cycle - 3] = "IF";
        if (cycle > 1) row[cycle - 2] = "ID";
        row[cycle - 1] = "IS";
      }
      fetch += 1;
    } else if (op) stalls += 1;
  }

  const order = ["F0", "F1", "F2", "F3", "F4", "F6", "F8", "F10", "F12"];
  order.forEach((name) => touch(name));
  return {
    cycles: cycle,
    stations: stations.map((station) => ({
      name: station.name,
      kind: station.kind,
      busy: station.busy,
      op: station.busy ? station.op : "-",
      vj: station.busy ? fmt(station.vj) : "-",
      vk: station.busy ? fmt(station.vk) : "-",
      qj: station.busy && station.qj ? station.qj : "-",
      qk: station.busy && station.qk ? station.qk : "-",
      address: station.busy ? station.address || "-" : "-",
      remain: station.busy && station.running ? station.remain : null,
      dest: station.dest,
    })),
    regs: order.map((name) => {
      const reg = touch(name);
      return { name, value: reg.qi ? "-" : fmt(reg.value), qi: reg.qi || "-" };
    }),
    cdb,
    cells,
    issue,
    exec,
    write,
    stalls,
  };
}

function compute(station: Station): number {
  const left = station.vj ?? 0;
  const right = station.vk ?? 0;
  if (station.op === "SUB") return left - right;
  if (station.op === "MUL") return left * right;
  if (station.op === "DIV") return right === 0 ? 0 : left / right;
  return left + right;
}

export function snapshotTomasulo(ops: TomaOp[], cycle: number, seed?: Record<string, number>, shape: TomaShape = TOMA_SHAPE): TomaResult {
  const full = runTomasulo(ops, seed, shape);
  if (cycle >= full.cycles) return full;
  const stations = freshStations(shape);
  const regs = new Map<string, Reg>();
  const touch = (name: string) => {
    if (!regs.has(name)) regs.set(name, { value: (seed ?? { F2: 8 })[name] ?? null, qi: "" });
    return regs.get(name) as Reg;
  };
  const replay = runUntil(ops, cycle, stations, regs, touch);
  return replay;
}

function runUntil(ops: TomaOp[], stop: number, stations: Station[], regs: Map<string, Reg>, touch: (name: string) => Reg): TomaResult {
  let fetch = 0;
  const cdb: CdbEvent[] = [];
  const cells: Array<Array<string | null>> = ops.map(() => []);
  const issue: number[] = [];
  const exec: number[] = [];
  const write: number[] = [];
  for (let cycle = 1; cycle <= stop; cycle += 1) {
    const broadcaster = stations.filter((station) => station.ready).sort((a, b) => a.issue - b.issue)[0];
    if (broadcaster) {
      const value = broadcaster.kind === "load" ? (ops[broadcaster.owner]?.loadValue ?? 0) : compute(broadcaster);
      stations.forEach((station) => {
        if (station.qj === broadcaster.name) { station.vj = value; station.qj = ""; }
        if (station.qk === broadcaster.name) { station.vk = value; station.qk = ""; }
      });
      regs.forEach((reg) => { if (reg.qi === broadcaster.name) { reg.value = value; reg.qi = ""; } });
      cdb.push({ cycle, tag: broadcaster.name, value: fmt(value), dest: broadcaster.dest || "mem" });
      if (broadcaster.owner >= 0) write[broadcaster.owner] = cycle;
      broadcaster.busy = false;
      broadcaster.ready = false;
    }
    stations.forEach((station) => {
      if (!station.busy || station.qj || station.qk || station.ready) return;
      if (!station.running) {
        station.running = true;
        station.remain = ops[station.owner]?.latency ?? 1;
        if (exec[station.owner] == null) exec[station.owner] = cycle;
      }
      station.remain -= 1;
      const row = cells[station.owner];
      if (row) row[cycle - 1] = "EX";
      if (station.remain <= 0) station.ready = true;
    });
    const op = ops[fetch];
    const home = stations.find((station) => station.kind === op?.kind && !station.busy);
    if (op && home) {
      const left = op.srcs[0] ? { v: touch(op.srcs[0]).qi ? null : touch(op.srcs[0]).value, q: touch(op.srcs[0]).qi } : { v: op.loadValue, q: "" };
      const right = op.srcs[1] ? { v: touch(op.srcs[1]).qi ? null : touch(op.srcs[1]).value, q: touch(op.srcs[1]).qi } : { v: null, q: "" };
      home.busy = true;
      home.op = op.op;
      home.vj = left.v;
      home.vk = op.kind === "load" ? null : right.v;
      home.qj = left.q;
      home.qk = op.kind === "load" || op.srcs.length < 2 ? "" : right.q;
      home.address = op.address;
      home.dest = op.dest ?? "";
      home.owner = fetch;
      home.issue = cycle;
      home.running = false;
      home.ready = false;
      if (op.dest) touch(op.dest).qi = home.name;
      issue[fetch] = cycle;
      const row = cells[fetch];
      if (row) {
        if (cycle > 2) row[cycle - 3] = "IF";
        if (cycle > 1) row[cycle - 2] = "ID";
        row[cycle - 1] = "IS";
      }
      fetch += 1;
    }
  }
  const order = ["F0", "F1", "F2", "F3", "F4", "F6", "F8", "F10", "F12"];
  return {
    cycles: stop,
    stations: stations.map((station) => ({
      name: station.name, kind: station.kind, busy: station.busy, op: station.busy ? station.op : "-",
      vj: station.busy ? fmt(station.vj) : "-", vk: station.busy ? fmt(station.vk) : "-",
      qj: station.busy && station.qj ? station.qj : "-", qk: station.busy && station.qk ? station.qk : "-",
      address: station.busy ? station.address || "-" : "-", remain: station.running ? station.remain : null, dest: station.dest,
    })),
    regs: order.map((name) => ({ name, value: touch(name).qi ? "-" : fmt(touch(name).value), qi: touch(name).qi || "-" })),
    cdb, cells, issue, exec, write, stalls: 0,
  };
}

export const TOMA_EXAMPLE: TomaOp[] = [
  parseTomasulo("LD F1, 0(R2)", "# F1 = Mem[R2]"),
  parseTomasulo("LD F3, 8(R2)", "# F3 = Mem[R2 + 8]"),
  parseTomasulo("ADD.D F4, F1, F3", "# F4 = F1 + F3"),
  parseTomasulo("MUL.D F6, F1, F2", "# F6 = F1 * F2"),
  parseTomasulo("SUB.D F8, F6, F1", "# F8 = F6 - F1"),
  parseTomasulo("SD F8, 0(R4)", "# Mem[R4] = F8"),
  parseTomasulo("ADD.D F10, F8, F3", "# F10 = F8 + F3"),
  parseTomasulo("DIV.D F12, F10, F2", "# F12 = F10 / F2"),
];

export const TOMA_PRESETS: Array<{ id: string; label: string; blurb: string; ops: TomaOp[] }> = [
  { id: "mixed", label: "Floating Point Chain (Default)", blurb: "A mix of loads, FP add/multiply/divide and a store.", ops: TOMA_EXAMPLE },
  { id: "raw", label: "Dependent Chain", blurb: "Each arithmetic instruction reads the previous result.", ops: [parseTomasulo("ADD.D F4, F2, F2"), parseTomasulo("MUL.D F6, F4, F2"), parseTomasulo("SUB.D F8, F6, F2")] },
  { id: "indep", label: "Independent Instructions", blurb: "No register is both written and read inside the block.", ops: [parseTomasulo("ADD.D F4, F2, F2"), parseTomasulo("MUL.D F6, F2, F2"), parseTomasulo("ADD.D F8, F2, F2")] },
  { id: "waw", label: "WAW Dependency", blurb: "Two instructions write F4. The second tag replaces the first.", ops: [parseTomasulo("ADD.D F4, F2, F2"), parseTomasulo("MUL.D F6, F4, F2"), parseTomasulo("SUB.D F4, F2, F2")] },
  { id: "war", label: "WAR Dependency", blurb: "A later write of F2 must not change the earlier read.", ops: [parseTomasulo("ADD.D F4, F2, F2"), parseTomasulo("MUL.D F2, F2, F2")] },
  { id: "cdb", label: "CDB Contention", blurb: "Two short adds finish together and share one result bus.", ops: [parseTomasulo("ADD.D F4, F2, F2"), parseTomasulo("ADD.D F6, F2, F2"), parseTomasulo("SUB.D F8, F2, F2")] },
];
