import { spatialReuse, temporalReuse, type Latencies } from "./hierarchy";

export const DEFAULT_LATENCIES: Latencies = { register: 1, l1: 3, l2: 10, ram: 80, storage: 1_000_000 };

export function acceptLatency(raw: string, previous: number): { ok: true; value: number } | { ok: false; error: string } {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return { ok: false, error: "Enter a positive number of cycles." };
  if (value > 1_000_000_000) return { ok: false, error: "That latency is too large for this lab." };
  return { ok: true, value: Math.round(value) || previous };
}

export function parseHexAddress(text: string): { ok: true; value: number } | { ok: false; error: string } {
  const cleaned = text.trim().replace(/^0x/i, "");
  if (!/^[0-9a-f]+$/i.test(cleaned)) return { ok: false, error: "Enter a hexadecimal address." };
  const value = Number.parseInt(cleaned, 16);
  if (!Number.isFinite(value) || value < 0 || value > 0xffffffff) return { ok: false, error: "That address does not fit in 32 bits." };
  return { ok: true, value };
}

export interface AmatRates {
  l1Miss: number;
  l2Miss: number;
  ramMiss: number;
}

/** Nested teaching AMAT. Rates are assumptions you edit, not a measurement from one trace. */
export function hierarchyAmat(latencies: Latencies, rates: AmatRates): number {
  const ram = latencies.ram + clamp01(rates.ramMiss) * latencies.storage;
  const l2 = latencies.l2 + clamp01(rates.l2Miss) * ram;
  return latencies.l1 + clamp01(rates.l1Miss) * l2;
}

export interface LevelMemory {
  registers: number[];
  l1: number[];
  l2: number[];
  blockBytes: number;
  ramBytes: number;
  levelCapacity: number;
}

export function freshLevelMemory(): LevelMemory {
  const blockBytes = 16;
  return {
    registers: [],
    l1: [Math.floor(0x1a3f / blockBytes)],
    l2: [],
    blockBytes,
    ramBytes: 65_536,
    levelCapacity: 4,
  };
}

export interface AccessTrace {
  address: number;
  operation: "read" | "write";
  level: "Registers" | "L1" | "L2" | "RAM" | "Storage";
  cycles: number;
  path: Array<{ name: string; outcome: "hit" | "miss" | "skipped" }>;
  filled: string[];
  memory: LevelMemory;
}

export function traceHierarchyAccess(memory: LevelMemory, address: number, operation: "read" | "write", latencies: Latencies): AccessTrace {
  const block = Math.floor(address / memory.blockBytes);
  const path: AccessTrace["path"] = [];
  const next: LevelMemory = {
    ...memory,
    registers: memory.registers.slice(),
    l1: memory.l1.slice(),
    l2: memory.l2.slice(),
  };
  if (next.registers.includes(address)) {
    path.push({ name: "Registers", outcome: "hit" });
    return finish(next, address, operation, "Registers", latencies.register, path, []);
  }
  path.push({ name: "Registers", outcome: "miss" });
  if (next.l1.includes(block)) {
    path.push({ name: "L1", outcome: "hit" });
    return finish(next, address, operation, "L1", latencies.l1, path, []);
  }
  path.push({ name: "L1", outcome: "miss" });
  if (next.l2.includes(block)) {
    path.push({ name: "L2", outcome: "hit" });
    remember(next.l1, block, next.levelCapacity);
    return finish(next, address, operation, "L2", latencies.l2, path, ["L1"]);
  }
  path.push({ name: "L2", outcome: "miss" });
  if (address >= 0 && address < next.ramBytes) {
    path.push({ name: "RAM", outcome: "hit" });
    remember(next.l1, block, next.levelCapacity);
    remember(next.l2, block, next.levelCapacity);
    return finish(next, address, operation, "RAM", latencies.ram, path, ["L1", "L2"]);
  }
  path.push({ name: "RAM", outcome: "miss" });
  path.push({ name: "Storage", outcome: "hit" });
  remember(next.l1, block, next.levelCapacity);
  remember(next.l2, block, next.levelCapacity);
  return finish(next, address, operation, "Storage", latencies.storage, path, ["L1", "L2"]);
}

export type PatternKind = "sequential" | "repeated" | "strided" | "loop" | "random" | "row" | "column";

export function buildPattern(kind: PatternKind, start: number, stride: number, count: number, seed = 1): number[] {
  const n = clampInt(count, 1, 64);
  const step = Math.max(0, Math.trunc(stride));
  const origin = Math.max(0, Math.trunc(start));
  if (kind === "repeated") return Array.from({ length: n }, () => origin);
  if (kind === "loop") {
    const window = [origin, origin + 1, origin + 2, origin + 3];
    return Array.from({ length: n }, (_, index) => window[index % window.length] ?? origin);
  }
  if (kind === "random") {
    let cursor = seed >>> 0 || 1;
    return Array.from({ length: n }, () => {
      cursor = (Math.imul(cursor, 1664525) + 1013904223) >>> 0;
      return origin + (cursor % 97);
    });
  }
  if (kind === "row") return Array.from({ length: n }, (_, index) => origin + index);
  if (kind === "column") return Array.from({ length: n }, (_, index) => origin + index * Math.max(4, step || 4));
  return Array.from({ length: n }, (_, index) => origin + index * (kind === "sequential" ? Math.max(1, step || 1) : Math.max(1, step || 1)));
}

export function localityReport(trace: number[], blockBytes: number): { temporal: number; spatial: number; repeats: number; nearby: number; estimate: number } {
  const bytes = Math.max(1, blockBytes);
  let nearby = 0;
  for (let index = 1; index < trace.length; index += 1) {
    const previous = Math.floor((trace[index - 1] ?? 0) / bytes);
    const current = Math.floor((trace[index] ?? 0) / bytes);
    if (Math.abs(current - previous) <= 1) nearby += 1;
  }
  const seen = new Set<number>();
  let repeats = 0;
  for (const address of trace) {
    if (seen.has(address)) repeats += 1;
    seen.add(address);
  }
  const estimate = teachingHitRate(trace, bytes, 4);
  return {
    temporal: temporalReuse(trace),
    spatial: trace.length < 2 ? 0 : nearby / (trace.length - 1),
    repeats,
    nearby,
    estimate,
  };
}

export type MissKind = "hit" | "compulsory" | "conflict" | "capacity";
export type ReplacePolicy = "lru" | "fifo" | "random";

export interface MiniLine {
  valid: boolean;
  tag: number;
  block: number;
  age: number;
  seq: number;
}

export interface MiniCache {
  lines: number;
  blockBytes: number;
  ways: number;
  sets: number;
  policy: ReplacePolicy;
  rows: MiniLine[][];
  shadow: MiniLine[];
  seen: number[];
  clock: number;
}

export interface CacheStep {
  address: number;
  block: number;
  set: number;
  tag: number;
  hit: boolean;
  kind: MissKind;
  loaded: number | null;
  evicted: number | null;
  note: string;
  cache: MiniCache;
  seed: number;
}

export function createMiniCache(lines: number, blockBytes: number, ways: number, policy: ReplacePolicy): MiniCache {
  const count = clampInt(lines, 1, 16);
  const width = clampInt(ways, 1, count);
  const sets = Math.max(1, Math.floor(count / width));
  const actualWays = Math.max(1, Math.floor(count / sets));
  const blank = (): MiniLine => ({ valid: false, tag: 0, block: 0, age: 0, seq: 0 });
  return {
    lines: sets * actualWays,
    blockBytes: clampInt(blockBytes, 1, 256),
    ways: actualWays,
    sets,
    policy,
    rows: Array.from({ length: sets }, () => Array.from({ length: actualWays }, blank)),
    shadow: Array.from({ length: sets * actualWays }, blank),
    seen: [],
    clock: 0,
  };
}

export function stepMiniCache(cache: MiniCache, address: number, seed = 1): CacheStep {
  const block = Math.floor(Math.max(0, address) / cache.blockBytes);
  const set = cache.sets <= 1 ? 0 : block % cache.sets;
  const tag = Math.floor(block / cache.sets);
  const next = cloneCache(cache);
  next.clock += 1;
  const row = next.rows[set] ?? [];
  const hitIndex = row.findIndex((line) => line.valid && line.tag === tag);
  if (hitIndex >= 0) {
    const line = row[hitIndex];
    if (line) line.age = next.clock;
    touchShadow(next, block);
    return { address, block, set, tag, hit: true, kind: "hit", loaded: null, evicted: null, note: "Already in the cache.", cache: next, seed };
  }
  const first = !next.seen.includes(block);
  const shadowHit = next.shadow.some((line) => line.valid && line.block === block);
  const kind: MissKind = first ? "compulsory" : shadowHit ? "conflict" : "capacity";
  const victim = chooseVictim(row, next.policy, seed);
  const evicted = row[victim.index]?.valid ? row[victim.index]?.block ?? null : null;
  const slot = row[victim.index];
  if (slot) {
    slot.valid = true;
    slot.tag = tag;
    slot.block = block;
    slot.age = next.clock;
    slot.seq = next.clock;
  }
  if (!next.seen.includes(block)) next.seen.push(block);
  insertShadow(next, block);
  const note = kind === "compulsory"
    ? "First use of this block."
    : kind === "conflict"
      ? "The block was evicted by this cache's mapping."
      : "The cache is full of other blocks.";
  return { address, block, set, tag, hit: false, kind, loaded: block, evicted, note, cache: next, seed: victim.seed };
}

export function runMiniCache(lines: number, blockBytes: number, ways: number, policy: ReplacePolicy, addresses: number[], seed = 1): CacheStep[] {
  let cache = createMiniCache(lines, blockBytes, ways, policy);
  let cursor = seed;
  return addresses.map((address) => {
    const step = stepMiniCache(cache, address, cursor);
    cache = step.cache;
    cursor = step.seed;
    return step;
  });
}

export function spatialScore(trace: number[], blockBytes: number): number {
  return spatialReuse(trace, blockBytes);
}

function teachingHitRate(trace: number[], blockBytes: number, lines: number): number {
  const steps = runMiniCache(lines, blockBytes, 1, "lru", trace, 1);
  if (steps.length === 0) return 0;
  return steps.filter((step) => step.hit).length / steps.length;
}

function finish(memory: LevelMemory, address: number, operation: "read" | "write", level: AccessTrace["level"], cycles: number, path: AccessTrace["path"], filled: string[]): AccessTrace {
  return { address, operation, level, cycles, path, filled, memory };
}

function remember(list: number[], block: number, capacity: number) {
  if (list.includes(block)) return;
  list.push(block);
  while (list.length > capacity) list.shift();
}

function chooseVictim(row: MiniLine[], policy: ReplacePolicy, seed: number): { index: number; seed: number } {
  const free = row.findIndex((line) => !line.valid);
  if (free >= 0) return { index: free, seed };
  if (policy === "random") {
    const next = (Math.imul(seed >>> 0 || 1, 1664525) + 1013904223) >>> 0;
    return { index: next % Math.max(1, row.length), seed: next };
  }
  const ranked = row.map((line, index) => ({ line, index })).sort((a, b) => (policy === "fifo" ? a.line.seq - b.line.seq : a.line.age - b.line.age));
  return { index: ranked[0]?.index ?? 0, seed };
}

function insertShadow(cache: MiniCache, block: number) {
  if (cache.shadow.some((line) => line.valid && line.block === block)) {
    touchShadow(cache, block);
    return;
  }
  const free = cache.shadow.find((line) => !line.valid);
  const victim = free ?? cache.shadow.slice().sort((a, b) => a.age - b.age)[0];
  if (!victim) return;
  victim.valid = true;
  victim.block = block;
  victim.tag = block;
  victim.age = cache.clock;
  victim.seq = cache.clock;
}

function touchShadow(cache: MiniCache, block: number) {
  const line = cache.shadow.find((entry) => entry.valid && entry.block === block);
  if (line) line.age = cache.clock;
}

function cloneCache(cache: MiniCache): MiniCache {
  return {
    ...cache,
    rows: cache.rows.map((set) => set.map((line) => ({ ...line }))),
    shadow: cache.shadow.map((line) => ({ ...line })),
    seen: cache.seen.slice(),
  };
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}
