import { blockAddress, decompose, geometryOf, type CacheConfig } from "./mapping";
import { emptyStats, type CacheStats } from "./metrics";
import { chooseVictim, emptyLine, nextRandom, type Slot } from "./replacement";
import { applyWrite, evictionWritesBack } from "./writePolicy";

export interface CacheMachine {
  config: CacheConfig;
  sets: Slot[][];
  clock: number;
  seen: number[];
  stats: CacheStats;
  memory: Record<string, number>;
  random: number;
}

export interface CacheAccess {
  address: number;
  op: "read" | "write";
  hit: boolean;
  kind: "hit" | "compulsory" | "conflict";
  set: number;
  way: number;
  evicted: boolean;
  dirtyEvict: boolean;
  tag: number;
  index: number;
  offset: number;
  explain: string;
}

export function createCache(config: CacheConfig): CacheMachine {
  const geo = geometryOf(config);
  return {
    config,
    sets: Array.from({ length: geo.sets }, () => Array.from({ length: geo.ways }, () => emptyLine())),
    clock: 0,
    seen: [],
    stats: emptyStats(),
    memory: {},
    random: config.seed >>> 0,
  };
}

function bump(stats: CacheStats, op: "read" | "write", hit: boolean): CacheStats {
  return {
    ...stats,
    accesses: stats.accesses + 1,
    reads: stats.reads + (op === "read" ? 1 : 0),
    writes: stats.writes + (op === "write" ? 1 : 0),
    hits: stats.hits + (hit ? 1 : 0),
    misses: stats.misses + (hit ? 0 : 1),
  };
}

export function accessCache(machine: CacheMachine, address: number, op: "read" | "write", data = 0): { machine: CacheMachine; result: CacheAccess } {
  const parts = decompose(address, machine.config);
  const set = machine.sets[parts.index]?.map((line) => ({ ...line })) ?? [];
  const hitWay = set.findIndex((line) => line.valid && line.tag === parts.tag);
  const hadEmpty = set.some((line) => !line.valid);
  const block = blockAddress(address, machine.config);
  const seenBefore = machine.seen.includes(block);
  let stats = machine.stats;
  let memory = { ...machine.memory };
  let random = machine.random;
  let evicted = false;
  let dirtyEvict = false;
  let way = hitWay;
  const clock = machine.clock + 1;
  if (hitWay >= 0) {
    const line = set[hitWay];
    if (line) {
      if (op === "write") {
        const effect = applyWrite({ ...line, lastUsed: clock }, data, machine.config.writePolicy);
        set[hitWay] = effect.line;
        if (effect.wroteMemory) {
          memory[String(block)] = data;
          stats = { ...stats, memoryWrites: stats.memoryWrites + 1 };
        }
      } else {
        set[hitWay] = { ...line, lastUsed: clock };
      }
    }
    stats = bump(stats, op, true);
  } else if (op === "write" && machine.config.allocation === "no-allocate") {
    memory[String(block)] = data;
    stats = { ...bump(stats, op, false), memoryWrites: stats.memoryWrites + 1 };
    way = -1;
  } else {
    const drawn = nextRandom(random);
    random = drawn.seed;
    way = chooseVictim(set, machine.config.replacement, drawn.value);
    const victim = set[way] ?? emptyLine();
    if (victim.valid) {
      evicted = true;
      stats = { ...stats, evictions: stats.evictions + 1 };
      if (evictionWritesBack(victim, machine.config.writePolicy)) {
        dirtyEvict = true;
        memory[`${victim.tag}:${parts.index}`] = victim.data;
        stats = { ...stats, writeBacks: stats.writeBacks + 1, memoryWrites: stats.memoryWrites + 1 };
      }
    }
    let installed: Slot = { valid: true, tag: parts.tag, dirty: false, data: memory[String(block)] ?? 0, lastUsed: clock, inserted: clock };
    if (op === "write") {
      const effect = applyWrite(installed, data, machine.config.writePolicy);
      installed = effect.line;
      if (effect.wroteMemory) {
        memory[String(block)] = data;
        stats = { ...stats, memoryWrites: stats.memoryWrites + 1 };
      }
    }
    set[way] = installed;
    stats = bump(stats, op, false);
  }
  const sets = machine.sets.slice();
  sets[parts.index] = set;
  const conflict = hitWay < 0 && (!hadEmpty || seenBefore);
  const kind = hitWay >= 0 ? "hit" : conflict ? "conflict" : "compulsory";
  const explain = hitWay >= 0
    ? `Index ${parts.index} matched and tag ${parts.tag} matched, so this access is a hit.`
    : conflict
      ? `Index ${parts.index} matched, but the tag is different, so this access is a conflict miss.`
      : `The block is not currently present in set ${parts.index}, so this access is a compulsory miss.`;
  return {
    machine: {
      ...machine,
      sets,
      clock,
      seen: seenBefore ? machine.seen : [...machine.seen, block],
      stats,
      memory,
      random,
    },
    result: {
      address,
      op,
      hit: hitWay >= 0,
      kind,
      set: parts.index,
      way,
      evicted,
      dirtyEvict,
      tag: parts.tag,
      index: parts.index,
      offset: parts.offset,
      explain,
    },
  };
}

export function runTrace(config: CacheConfig, trace: Array<{ address: number; op?: "read" | "write"; data?: number }>): { machine: CacheMachine; results: CacheAccess[] } {
  let machine = createCache(config);
  const results: CacheAccess[] = [];
  for (const item of trace) {
    const step = accessCache(machine, item.address, item.op ?? "read", item.data ?? 0);
    machine = step.machine;
    results.push(step.result);
  }
  return { machine, results };
}

export interface CacheLevel {
  name: string;
  hitCycles: number;
  config: CacheConfig;
  machine: CacheMachine;
}

export function createHierarchy(levels: Array<{ name: string; hitCycles: number; config: CacheConfig }>, _ramCycles: number): CacheLevel[] {
  return levels.map((level) => ({ ...level, machine: createCache(level.config) }));
}

export function accessHierarchy(levels: CacheLevel[], ramCycles: number, address: number, op: "read" | "write", data = 0): { levels: CacheLevel[]; latency: number; explain: string; hitLevel: string } {
  const next = levels.map((level) => ({ ...level, machine: level.machine }));
  const notes: string[] = [];
  for (let index = 0; index < next.length; index += 1) {
    const level = next[index];
    if (!level) continue;
    const step = accessCache(level.machine, address, op, data);
    next[index] = { ...level, machine: step.machine };
    notes.push(`${level.name} ${step.result.hit ? "hit" : "miss"}`);
    if (step.result.hit) {
      return { levels: next, latency: level.hitCycles, explain: notes.join(" → "), hitLevel: level.name };
    }
  }
  return { levels: next, latency: ramCycles, explain: `${notes.join(" → ")} → RAM`, hitLevel: "RAM" };
}
