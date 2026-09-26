export interface MemAccess {
  address: number;
  op: "read" | "write";
  core: number;
}

export interface MshrConfig {
  mshrs: number;
  missLatency: number;
  cacheBytes: number;
  blockBytes: number;
  associativity: number;
  replacement: "lru" | "fifo";
  blocking: boolean;
  hitUnderMiss: boolean;
  missUnderMiss: boolean;
}

export interface MshrEntry {
  id: number;
  block: number | null;
  remaining: number;
  waiters: number;
  core: number | null;
  op: string;
  busy: boolean;
}

export interface AccessRow {
  index: number;
  cycle: number;
  address: number;
  op: "read" | "write";
  core: number;
  status: "Waiting" | "Hit" | "Miss" | "Merged" | "Stalled" | "Completed";
  complete: number | null;
}

export interface MshrShot {
  cycle: number;
  event: string;
  entries: MshrEntry[];
  rows: AccessRow[];
  outstanding: Array<{ block: number; arrival: number; age: number; state: string }>;
  queued: number;
  hits: number;
  misses: number;
  merged: number;
  allocations: number;
  exhausted: number;
  hitUnderMiss: number;
  missUnderMiss: number;
  avgOutstanding: number;
  peakOutstanding: number;
  avgLatency: number;
  blocked: boolean;
}

export interface MshrResult {
  shots: MshrShot[];
  final: MshrShot;
}

export const MSHR_DEFAULTS: MshrConfig = {
  mshrs: 4,
  missLatency: 8,
  cacheBytes: 256,
  blockBytes: 64,
  associativity: 1,
  replacement: "lru",
  blocking: false,
  hitUnderMiss: true,
  missUnderMiss: true,
};

interface Slot {
  id: number;
  block: number | null;
  remaining: number;
  waiters: number[];
  core: number | null;
  op: string;
  busy: boolean;
  allocatedAt: number;
}

interface Line {
  block: number;
  tick: number;
  order: number;
}

export function blockOf(address: number, blockBytes: number) {
  const size = Math.max(1, blockBytes);
  return Math.floor(address / size) * size;
}

function setsOf(config: MshrConfig) {
  const assoc = Math.max(1, config.associativity);
  const bytes = Math.max(config.blockBytes, config.cacheBytes);
  return Math.max(1, Math.floor(bytes / (Math.max(1, config.blockBytes) * assoc)));
}

export function runMshr(accesses: MemAccess[], config: MshrConfig = MSHR_DEFAULTS, warm: number[] = []): MshrResult {
  const sets = Array.from({ length: setsOf(config) }, () => [] as Line[]);
  const assoc = Math.max(1, config.associativity);
  let order = 1;
  const install = (block: number, cycle: number) => {
    const set = Math.floor(block / Math.max(1, config.blockBytes)) % sets.length;
    const lines = sets[set] ?? [];
    const found = lines.find((line) => line.block === block);
    if (found) {
      if (config.replacement === "lru") found.tick = cycle;
      return;
    }
    if (lines.length >= assoc) {
      const victim = config.replacement === "fifo"
        ? lines.reduce((oldest, line) => line.order < oldest.order ? line : oldest)
        : lines.reduce((oldest, line) => line.tick < oldest.tick ? line : oldest);
      const index = lines.indexOf(victim);
      if (index >= 0) lines.splice(index, 1);
    }
    lines.push({ block, tick: cycle, order: order++ });
    sets[set] = lines;
  };
  const hit = (block: number, cycle: number) => {
    const set = Math.floor(block / Math.max(1, config.blockBytes)) % sets.length;
    const found = sets[set]?.find((line) => line.block === block);
    if (found && config.replacement === "lru") found.tick = cycle;
    return Boolean(found);
  };
  warm.forEach((address) => install(blockOf(address, config.blockBytes), 0));
  const slots: Slot[] = Array.from({ length: Math.max(1, config.mshrs) }, (_, id) => ({ id, block: null, remaining: 0, waiters: [], core: null, op: "", busy: false, allocatedAt: 0 }));
  const rows: AccessRow[] = accesses.map((access, index) => ({ index, cycle: index, address: access.address, op: access.op, core: access.core, status: "Waiting", complete: null }));
  const seenStall = new Set<number>();
  const totals = { hits: 0, misses: 0, merged: 0, allocations: 0, exhausted: 0, hitUnderMiss: 0, missUnderMiss: 0, outstandingSum: 0, peak: 0, latencySum: 0, finished: 0 };
  const shots: MshrShot[] = [];
  let next = 0;
  let cycle = 0;
  const view = (event: string): MshrShot => {
    const busy = slots.filter((slot) => slot.busy);
    return {
      cycle,
      event,
      entries: slots.map((slot) => ({ id: slot.id, block: slot.block, remaining: slot.remaining, waiters: slot.waiters.length, core: slot.core, op: slot.op, busy: slot.busy })),
      rows: rows.map((row) => ({ ...row })),
      outstanding: busy.map((slot) => ({ block: slot.block ?? 0, arrival: slot.allocatedAt, age: cycle - slot.allocatedAt, state: "In MSHR" })),
      queued: Math.max(0, rows.length - next),
      hits: totals.hits,
      misses: totals.misses,
      merged: totals.merged,
      allocations: totals.allocations,
      exhausted: totals.exhausted,
      hitUnderMiss: totals.hitUnderMiss,
      missUnderMiss: totals.missUnderMiss,
      avgOutstanding: cycle ? totals.outstandingSum / cycle : 0,
      peakOutstanding: totals.peak,
      avgLatency: totals.finished ? totals.latencySum / totals.finished : 0,
      blocked: config.blocking && busy.length > 0,
    };
  };
  const finish = (index: number, status: AccessRow["status"]) => {
    const row = rows[index];
    if (!row || row.complete !== null) return;
    row.status = status;
    row.complete = cycle;
    totals.finished += 1;
    totals.latencySum += Math.max(0, cycle - row.cycle);
  };
  shots.push(view("Cache is ready"));
  const limit = accesses.length * (Math.max(1, config.missLatency) + 3) + 8;
  while ((next < rows.length || slots.some((slot) => slot.busy)) && cycle < limit) {
    cycle += 1;
    let event = "Clock";
    slots.forEach((slot) => {
      if (!slot.busy) return;
      slot.remaining -= 1;
      if (slot.remaining <= 0 && slot.block !== null) {
        install(slot.block, cycle);
        slot.waiters.forEach((index) => finish(index, "Completed"));
        event = `Fill 0x${slot.block.toString(16)}`;
        slot.busy = false;
        slot.block = null;
        slot.waiters = [];
        slot.core = null;
        slot.op = "";
      }
    });
    const busy = slots.filter((slot) => slot.busy).length;
    totals.outstandingSum += busy;
    totals.peak = Math.max(totals.peak, busy);
    const request = rows[next];
    const blocked = config.blocking && busy > 0;
    if (request && !blocked) {
      const block = blockOf(request.address, config.blockBytes);
      if (hit(block, cycle)) {
        if (!config.hitUnderMiss && busy > 0) {
          request.status = "Stalled";
          if (!seenStall.has(request.index)) { seenStall.add(request.index); totals.exhausted += 1; }
          event = "Hit waits behind the outstanding miss";
        } else {
          if (busy > 0) totals.hitUnderMiss += 1;
          totals.hits += 1;
          finish(request.index, "Hit");
          next += 1;
          event = `Hit 0x${block.toString(16)}`;
        }
      } else {
        const same = slots.find((slot) => slot.busy && slot.block === block);
        if (same) {
          same.waiters.push(request.index);
          totals.merged += 1;
          request.status = "Merged";
          next += 1;
          event = `Merged into MSHR ${same.id}`;
        } else if (!config.missUnderMiss && busy > 0) {
          request.status = "Stalled";
          event = "Miss-under-miss is disabled";
        } else {
          const free = slots.find((slot) => !slot.busy);
          if (!free) {
            request.status = "Stalled";
            if (!seenStall.has(request.index)) { seenStall.add(request.index); totals.exhausted += 1; }
            event = "MSHR full";
          } else {
            if (busy > 0) totals.missUnderMiss += 1;
            free.busy = true;
            free.block = block;
            free.remaining = Math.max(1, config.missLatency);
            free.waiters = [request.index];
            free.core = request.core;
            free.op = request.op;
            free.allocatedAt = cycle;
            totals.misses += 1;
            totals.allocations += 1;
            request.status = "Miss";
            next += 1;
            event = `Miss 0x${block.toString(16)} → MSHR ${free.id}`;
          }
        }
      }
    }
    shots.push(view(event));
  }
  return { shots, final: shots[shots.length - 1] ?? shots[0]! };
}

export function compareBlocking(accesses: MemAccess[], config: MshrConfig, warm: number[] = []) {
  const blocking = runMshr(accesses, { ...config, blocking: true, hitUnderMiss: false, missUnderMiss: false }, warm);
  const relaxed = runMshr(accesses, { ...config, blocking: false }, warm);
  const base = blocking.final.cycle || 1;
  return { blocking, relaxed, stallReduction: Math.round(((blocking.final.cycle - relaxed.final.cycle) / base) * 100) };
}

const load = (address: number, core = 0): MemAccess => ({ address, op: "read", core });

export const MSHR_PRESETS: Array<{ id: string; label: string; accesses: MemAccess[]; warm: number[]; config: Partial<MshrConfig> }> = [
  { id: "single", label: "Single miss", accesses: [load(0x1000)], warm: [], config: {} },
  { id: "hum", label: "Hit under miss", accesses: [load(0x1000), load(0x2000)], warm: [0x2000], config: { hitUnderMiss: true } },
  { id: "two", label: "Two independent misses", accesses: [load(0x1000), load(0x2000)], warm: [], config: { missUnderMiss: true } },
  { id: "merge", label: "Merged same-line misses", accesses: [load(0x1000), load(0x1010), load(0x1020)], warm: [], config: {} },
  { id: "full", label: "MSHR exhaustion", accesses: [0x1000, 0x2000, 0x3000].map((address) => load(address)), warm: [], config: { mshrs: 1, missLatency: 6 } },
  { id: "mlp", label: "High memory-level parallelism", accesses: [0x1000, 0x2000, 0x3000, 0x4000].map((address) => load(address)), warm: [], config: { mshrs: 4 } },
  { id: "versus", label: "Blocking versus non-blocking", accesses: [load(0x1000), load(0x2000), load(0x1040)], warm: [0x2000], config: {} },
];
