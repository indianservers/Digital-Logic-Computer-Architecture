export interface DramTiming {
  tRCD: number;
  tCL: number;
  tRP: number;
  tRAS: number;
  ageThreshold: number;
}

export interface DramConfig {
  channels: number;
  ranks: number;
  banks: number;
  rows: number;
  columns: number;
  policy: "fcfs" | "frfcfs";
  timing: DramTiming;
}

export interface DramAccess {
  address: number;
  op: "read" | "write";
  arrival: number;
}

export interface DramLocation {
  channel: number;
  rank: number;
  bank: number;
  row: number;
  column: number;
  unit: number;
}

export interface DramRow {
  id: number;
  address: number;
  op: "read" | "write";
  arrival: number;
  channel: number;
  rank: number;
  bank: number;
  row: number;
  column: number;
  kind: "hit" | "closed" | "conflict" | null;
  state: "queued" | "PRE" | "ACT" | "RD" | "WR" | "done";
  issue: number | null;
  complete: number | null;
}

export interface BankView {
  unit: number;
  channel: number;
  bank: number;
  open: number | null;
  command: string;
  remaining: number;
  queued: number;
}

export interface DramShot {
  cycle: number;
  event: string;
  banks: BankView[];
  rows: DramRow[];
  hits: number;
  closed: number;
  conflicts: number;
  reads: number;
  writes: number;
  avgLatency: number;
  maxLatency: number;
  throughput: number;
  queue: number;
  blp: number;
  bankUtil: number;
  active: number;
}

export interface DramResult {
  shots: DramShot[];
  commands: string[][];
  active: number[];
  final: DramShot;
  rows: DramRow[];
}

export const DRAM_TIMING: DramTiming = { tRCD: 2, tCL: 2, tRP: 2, tRAS: 2, ageThreshold: 0 };

export const DRAM_DEFAULTS: DramConfig = {
  channels: 1,
  ranks: 1,
  banks: 4,
  rows: 256,
  columns: 256,
  policy: "frfcfs",
  timing: DRAM_TIMING,
};

function fieldBits(count: number) {
  const width = Math.max(1, count);
  return Math.round(Math.log2(width));
}

export function decodeAddress(address: number, config: Pick<DramConfig, "channels" | "ranks" | "banks" | "rows" | "columns">): DramLocation {
  let shift = 0;
  const take = (count: number) => {
    const bits = fieldBits(count);
    const value = (address >>> shift) & (Math.max(1, count) - 1);
    shift += bits;
    return value;
  };
  const column = take(config.columns);
  const bank = take(config.banks);
  const row = take(config.rows);
  const rank = take(config.ranks);
  const channel = take(config.channels);
  return { channel, rank, bank, row, column, unit: channel * config.banks + bank };
}

interface Live extends DramRow {
  stage: "queued" | "pre" | "act" | "data" | "done";
  unit: number;
}

interface Unit {
  open: number | null;
  openedAt: number;
  remaining: number;
  command: string;
  stage: "idle" | "pre" | "act" | "data";
  serving: number | null;
  channel: number;
  bank: number;
}

function cloneRow(row: Live): DramRow {
  return {
    id: row.id, address: row.address, op: row.op, arrival: row.arrival, channel: row.channel, rank: row.rank,
    bank: row.bank, row: row.row, column: row.column, kind: row.kind, state: row.state, issue: row.issue, complete: row.complete,
  };
}

export function runDram(accesses: DramAccess[], config: DramConfig = DRAM_DEFAULTS): DramResult {
  const units: Unit[] = [];
  for (let channel = 0; channel < config.channels; channel += 1) {
    for (let bank = 0; bank < config.banks; bank += 1) {
      units.push({ open: null, openedAt: 0, remaining: 0, command: "idle", stage: "idle", serving: null, channel, bank });
    }
  }
  const rows: Live[] = accesses.map((access, id) => {
    const place = decodeAddress(access.address, config);
    return {
      id, address: access.address, op: access.op, arrival: access.arrival, ...place, unit: place.unit,
      kind: null, state: "queued", issue: null, complete: null, stage: "queued",
    };
  });
  const timing = config.timing;
  const commands: string[][] = [];
  const activeSeries: number[] = [];
  const shots: DramShot[] = [];
  const totals = { hits: 0, closed: 0, conflicts: 0, latencySum: 0, finished: 0, maxLatency: 0, queueSum: 0, activeSum: 0, busySum: 0 };
  const view = (cycle: number, event: string): DramShot => {
    const pending = rows.filter((row) => row.complete === null && row.arrival <= cycle);
    const span = Math.max(1, cycle);
    return {
      cycle,
      event,
      banks: units.map((unit, index) => ({
        unit: index,
        channel: unit.channel,
        bank: unit.bank,
        open: unit.open,
        command: unit.command,
        remaining: unit.remaining,
        queued: rows.filter((row) => row.unit === index && row.complete === null && row.arrival <= cycle).length,
      })),
      rows: rows.map(cloneRow),
      hits: totals.hits,
      closed: totals.closed,
      conflicts: totals.conflicts,
      reads: rows.filter((row) => row.op === "read" && row.complete !== null).length,
      writes: rows.filter((row) => row.op === "write" && row.complete !== null).length,
      avgLatency: totals.finished ? totals.latencySum / totals.finished : 0,
      maxLatency: totals.maxLatency,
      throughput: totals.finished / span,
      queue: pending.length,
      blp: cycle ? totals.activeSum / cycle : 0,
      bankUtil: units.length && cycle ? totals.busySum / (cycle * units.length) : 0,
      active: units.filter((unit) => unit.stage !== "idle").length,
    };
  };
  const finishData = (row: Live, unit: Unit, cycle: number) => {
    row.stage = "done";
    row.state = "done";
    row.complete = cycle;
    unit.stage = "idle";
    unit.command = "idle";
    unit.serving = null;
    unit.remaining = 0;
    totals.finished += 1;
    const latency = Math.max(0, cycle - row.arrival);
    totals.latencySum += latency;
    totals.maxLatency = Math.max(totals.maxLatency, latency);
  };
  const advance = (unit: Unit, cycle: number) => {
    if (unit.remaining <= 0 || unit.serving === null) return;
    unit.remaining -= 1;
    if (unit.remaining > 0) return;
    const row = rows[unit.serving];
    if (!row) return;
    if (unit.stage === "pre") {
      unit.open = null;
      unit.stage = "act";
      unit.command = "ACT";
      unit.remaining = Math.max(1, timing.tRCD);
      row.stage = "act";
      row.state = "ACT";
      return;
    }
    if (unit.stage === "act") {
      unit.open = row.row;
      unit.openedAt = cycle;
      unit.stage = "data";
      unit.command = row.op === "write" ? "WR" : "RD";
      unit.remaining = Math.max(1, timing.tCL);
      row.stage = "data";
      row.state = row.op === "write" ? "WR" : "RD";
      return;
    }
    finishData(row, unit, cycle);
  };
  const pick = (unitIndex: number, cycle: number) => {
    const waiting = rows.filter((row) => row.stage === "queued" && row.unit === unitIndex && row.arrival <= cycle);
    if (waiting.length === 0) return null;
    const oldest = (list: Live[]) => list.reduce((best, row) => row.arrival < best.arrival || (row.arrival === best.arrival && row.id < best.id) ? row : best);
    if (config.policy === "fcfs") return oldest(waiting);
    const unit = units[unitIndex];
    const starved = timing.ageThreshold > 0 ? waiting.filter((row) => cycle - row.arrival >= timing.ageThreshold && unit?.open !== row.row) : [];
    if (starved.length > 0) return oldest(starved);
    const hits = unit ? waiting.filter((row) => unit.open === row.row) : [];
    if (hits.length > 0) return oldest(hits);
    return oldest(waiting);
  };
  const start = (row: Live, unit: Unit, cycle: number) => {
    row.issue = cycle;
    if (unit.open === row.row) {
      row.kind = "hit";
      totals.hits += 1;
      unit.stage = "data";
      unit.command = row.op === "write" ? "WR" : "RD";
      unit.remaining = Math.max(1, timing.tCL);
      row.stage = "data";
      row.state = unit.command as DramRow["state"];
    } else if (unit.open === null) {
      row.kind = "closed";
      totals.closed += 1;
      unit.stage = "act";
      unit.command = "ACT";
      unit.remaining = Math.max(1, timing.tRCD);
      row.stage = "act";
      row.state = "ACT";
    } else {
      row.kind = "conflict";
      totals.conflicts += 1;
      const held = Math.max(0, timing.tRAS - (cycle - unit.openedAt));
      unit.stage = "pre";
      unit.command = "PRE";
      unit.remaining = Math.max(1, timing.tRP + held);
      row.stage = "pre";
      row.state = "PRE";
    }
    unit.serving = row.id;
  };
  shots.push(view(0, "Controller queue is empty"));
  let cycle = 0;
  const limit = Math.max(8, accesses.length * (timing.tRP + timing.tRCD + timing.tCL + timing.tRAS + 2) + 4);
  while (rows.some((row) => row.complete === null) && cycle < limit) {
    units.forEach((unit) => advance(unit, cycle));
    units.forEach((unit, index) => {
      if (unit.stage !== "idle") return;
      const row = pick(index, cycle);
      if (row) start(row, unit, cycle);
    });
    const busy = units.filter((unit) => unit.stage !== "idle").length;
    totals.activeSum += busy;
    totals.busySum += busy;
    activeSeries.push(busy);
    commands.push(units.map((unit) => unit.command === "idle" ? "" : unit.command));
    const queued = rows.filter((row) => row.complete === null && row.arrival <= cycle).length;
    totals.queueSum += queued;
    cycle += 1;
    const event = rows.find((row) => row.complete === cycle)?.id;
    shots.push(view(cycle, event === undefined ? "Schedule" : `Request ${event} completed`));
  }
  const final = shots[shots.length - 1] ?? shots[0];
  return {
    shots,
    commands,
    active: activeSeries,
    final: { ...final!, queue: totals.queueSum / Math.max(1, cycle), blp: cycle ? totals.activeSum / cycle : 0 },
    rows: rows.map(cloneRow),
  };
}

export function compareSchedulers(accesses: DramAccess[], config: DramConfig = DRAM_DEFAULTS) {
  const fcfs = runDram(accesses, { ...config, policy: "fcfs", timing: { ...config.timing, ageThreshold: 0 } });
  const ready = runDram(accesses, { ...config, policy: "frfcfs" });
  return { fcfs, ready };
}

const read = (address: number, arrival = 0): DramAccess => ({ address, op: "read", arrival });
const write = (address: number, arrival = 0): DramAccess => ({ address, op: "write", arrival });

export const DRAM_PRESETS: Array<{ id: string; label: string; accesses: DramAccess[]; config: Partial<DramConfig> }> = [
  { id: "hits", label: "All row hits", accesses: [0x0000, 0x0010, 0x0020, 0x0030].map((address) => read(address)), config: {} },
  { id: "conflicts", label: "Repeated row conflicts", accesses: [0x0000, 0x0400, 0x0000, 0x0400].map((address) => read(address)), config: {} },
  { id: "same", label: "Same bank, different rows", accesses: [0x0000, 0x0400, 0x0800].map((address) => read(address)), config: {} },
  { id: "parallel", label: "Different banks", accesses: [0x0000, 0x0100, 0x0200, 0x0300].map((address) => read(address)), config: {} },
  { id: "mixed", label: "Mixed locality", accesses: [read(0x0000), write(0x0010), read(0x0400), read(0x0100), read(0x0110)], config: {} },
  { id: "ready", label: "FR-FCFS advantage", accesses: [read(0x0000), read(0x0400), read(0x0001), read(0x0002)], config: { policy: "frfcfs" } },
  { id: "starve", label: "Potential starvation", accesses: [read(0x0000), read(0x0400), read(0x0001), read(0x0002), read(0x0003), read(0x0004)], config: { policy: "frfcfs", timing: { ...DRAM_TIMING, ageThreshold: 4 } } },
];
