import { runTrace, type CacheAccess } from "./cache";
import { decompose, geometryOf, type CacheConfig } from "./mapping";
import { amat, missRate } from "./metrics";

export interface TraceEntry {
  address: number;
  op: "read" | "write";
}

export function parseTrace(text: string): { entries: TraceEntry[]; errors: string[] } {
  const entries: TraceEntry[] = [];
  const errors: string[] = [];
  text.split(/\r?\n/).forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const match = /^(0x[0-9a-fA-F]+|\d+)(?:\s+([RWrw]))?$/.exec(trimmed);
    if (!match?.[1]) {
      errors.push(`Line ${index + 1} is not an address.`);
      return;
    }
    const address = match[1].toLowerCase().startsWith("0x") ? Number.parseInt(match[1], 16) : Number.parseInt(match[1], 10);
    if (!Number.isFinite(address) || address < 0) {
      errors.push(`Line ${index + 1} is out of range.`);
      return;
    }
    entries.push({ address, op: match[2]?.toUpperCase() === "W" ? "write" : "read" });
  });
  return { entries, errors };
}

export function formatTrace(entries: TraceEntry[]): string {
  return entries.map((entry) => `0x${entry.address.toString(16).toUpperCase().padStart(8, "0")} ${entry.op === "write" ? "W" : "R"}`).join("\n");
}

export const SIM_EXAMPLE: TraceEntry[] = [
  { address: 0x1000, op: "read" },
  { address: 0x1004, op: "read" },
  { address: 0x2000, op: "read" },
  { address: 0x1008, op: "read" },
  { address: 0x3000, op: "read" },
  { address: 0x1000, op: "read" },
];

export function sequentialTrace(count: number, start = 0, stride = 1): TraceEntry[] {
  return Array.from({ length: Math.max(0, count) }, (_, index) => ({ address: start + index * stride, op: "read" as const }));
}

export function repeatedTrace(loop: number, repeats: number, stride = 4): TraceEntry[] {
  const width = Math.max(1, loop);
  const entries: TraceEntry[] = [];
  for (let turn = 0; turn < Math.max(0, repeats); turn += 1) {
    for (let index = 0; index < width; index += 1) entries.push({ address: index * stride, op: "read" });
  }
  return entries;
}

export function stridedTrace(count: number, stride: number, start = 0): TraceEntry[] {
  return sequentialTrace(count, start, Math.max(1, stride));
}

export function randomTrace(count: number, span: number, seed: number): TraceEntry[] {
  let state = seed >>> 0 || 1;
  const limit = Math.max(1, span);
  return Array.from({ length: Math.max(0, count) }, () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return { address: state % limit, op: "read" as const };
  });
}

export function matrixTrace(rows: number, cols: number, order: "row" | "column"): TraceEntry[] {
  const entries: TraceEntry[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const index = order === "row" ? row * cols + col : col * rows + row;
      entries.push({ address: index * 4, op: "read" });
    }
  }
  return entries;
}

export function memoryByte(address: number): number {
  return (Math.imul(address, 73) + 0xde) & 0xff;
}

export function blockPreview(address: number, blockBytes: number): string[] {
  const base = address & ~(Math.max(1, blockBytes) - 1);
  const pairs: string[] = [];
  for (let index = 0; index < Math.min(8, blockBytes); index += 2) {
    const hi = memoryByte(base + index);
    const lo = memoryByte(base + index + 1);
    pairs.push(`${hi.toString(16).toUpperCase().padStart(2, "0")}${lo.toString(16).toUpperCase().padStart(2, "0")}`);
  }
  return pairs;
}

export interface ClassifiedAccess extends CacheAccess {
  klass: "hit" | "compulsory" | "conflict" | "capacity";
}

export function classifyTrace(config: CacheConfig, entries: TraceEntry[]): { rows: ClassifiedAccess[]; machine: ReturnType<typeof runTrace>["machine"] } {
  const real = runTrace(config, entries);
  const lines = Math.max(1, Math.round(config.cacheBytes / config.blockBytes));
  const shadow = runTrace({ ...config, associativity: lines, replacement: "lru" }, entries);
  const rows = real.results.map((result, index) => {
    const other = shadow.results[index];
    let klass: ClassifiedAccess["klass"] = "hit";
    if (!result.hit) {
      if (other && !other.hit && other.kind === "compulsory") klass = "compulsory";
      else if (other?.hit) klass = "conflict";
      else klass = "capacity";
    }
    return { ...result, klass };
  });
  return { rows, machine: real.machine };
}

export function averageReuse(addresses: number[]): number {
  const last = new Map<number, number>();
  const gaps: number[] = [];
  addresses.forEach((address, index) => {
    const previous = last.get(address);
    if (previous !== undefined) gaps.push(index - previous);
    last.set(address, index);
  });
  if (gaps.length === 0) return 0;
  return gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
}

export function uniqueCount(addresses: number[]): number {
  return new Set(addresses).size;
}

export interface TimelineEvent {
  title: string;
  tone: "read" | "miss" | "hit" | "mem" | "fill" | "write";
}

export function timelineFor(result: CacheAccess, blockBytes: number): TimelineEvent[] {
  const base = result.address & ~(Math.max(1, blockBytes) - 1);
  const end = base + blockBytes - 1;
  const hex = `0x${result.address.toString(16).toUpperCase().padStart(8, "0")}`;
  const verb = result.op === "write" ? "write" : "read";
  const events: TimelineEvent[] = [
    { title: `CPU ${verb} ${hex}`, tone: "read" },
    { title: `Tag 0x${result.tag.toString(16).toUpperCase()} · set ${result.set} · offset ${result.offset}`, tone: "read" },
  ];
  if (result.hit) {
    events.push({ title: `Cache hit in set ${result.set}, way ${result.way}`, tone: "hit" });
  } else {
    events.push({ title: `Cache miss (set ${result.set}, tag 0x${result.tag.toString(16).toUpperCase()})`, tone: "miss" });
    if (result.dirtyEvict) events.push({ title: "Dirty victim written back to memory", tone: "write" });
    if (result.way >= 0) {
      events.push({ title: `Fetch block 0x${base.toString(16).toUpperCase()}–0x${end.toString(16).toUpperCase()}`, tone: "mem" });
      events.push({ title: `Fill set ${result.set}, way ${result.way}`, tone: "fill" });
    } else {
      events.push({ title: "Write miss bypasses the cache", tone: "write" });
    }
  }
  events.push({ title: result.op === "write" ? "Store completes" : "Return data to CPU", tone: result.hit ? "hit" : "fill" });
  return events;
}

export function teachingAmat(stats: { accesses: number; hits: number; misses: number; reads: number; writes: number; evictions: number; writeBacks: number; memoryWrites: number }, hitTime = 1, penalty = 100): number {
  return amat(hitTime, stats, penalty);
}

export function missPercent(stats: { accesses: number; misses: number }): number {
  return Math.round(missRate({ ...stats, hits: stats.accesses - stats.misses, reads: 0, writes: 0, evictions: 0, writeBacks: 0, memoryWrites: 0 }) * 100);
}

export function nestedAmat(levels: Array<{ latency: number; missRate: number }>, memoryLatency: number): number {
  let penalty = memoryLatency;
  for (let index = levels.length - 1; index >= 0; index -= 1) {
    const level = levels[index];
    if (!level) continue;
    penalty = level.latency + level.missRate * penalty;
  }
  return penalty;
}

export function requestPath(address: number, levels: Array<{ name: string; hitPercent: number }>): { hit: string; stops: string[] } {
  const stops = ["CPU"];
  for (let index = 0; index < levels.length; index += 1) {
    const level = levels[index];
    if (!level) continue;
    stops.push(level.name);
    const bucket = (address + index * 17) >>> 0;
    if (bucket % 100 < level.hitPercent) return { hit: level.name, stops };
  }
  stops.push("Main Memory");
  return { hit: "Main Memory", stops };
}

export function configSummary(config: CacheConfig): { blocks: number; sets: number; ways: number; offsetBits: number; indexBits: number; tagBits: number } {
  const geo = geometryOf(config);
  return { blocks: geo.lines, sets: geo.sets, ways: geo.ways, offsetBits: geo.offsetBits, indexBits: geo.indexBits, tagBits: geo.tagBits };
}

export function splitFields(address: number, config: CacheConfig): { binary: string; tag: string; index: string; offset: string; parts: ReturnType<typeof decompose> } {
  const parts = decompose(address, config);
  return { binary: parts.binary, tag: parts.tagBits, index: parts.indexBits, offset: parts.offsetBits, parts };
}
