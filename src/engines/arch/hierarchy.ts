import { accessCache, createCache, type CacheMachine } from "../cache/cache";
import { amat, hitRate, missRate } from "../cache/metrics";
import { validGeometry, type CacheConfig } from "../cache/mapping";

export interface MemoryLevel {
  name: string;
  capacity: string;
  latency: number;
  bandwidth: string;
  cost: string;
}

export interface Latencies {
  register: number;
  l1: number;
  l2: number;
  ram: number;
  storage: number;
}

export const LAB_LEVELS: MemoryLevel[] = [
  { name: "Registers", capacity: "8 words", latency: 1, bandwidth: "1 word / cycle", cost: "highest per bit" },
  { name: "L1", capacity: "32 bytes", latency: 3, bandwidth: "one line / cycle", cost: "high" },
  { name: "L2", capacity: "64 bytes", latency: 12, bandwidth: "shared with the core", cost: "medium" },
  { name: "RAM", capacity: "256 words", latency: 80, bandwidth: "bus width", cost: "low" },
  { name: "Storage", capacity: "lab disk", latency: 10000, bandwidth: "block transfer", cost: "lowest per bit" },
];

export const L1_PRESET: CacheConfig = {
  addressBits: 8, memoryBytes: 256, cacheBytes: 32, blockBytes: 4, associativity: 1,
  replacement: "lru", writePolicy: "through", allocation: "allocate", seed: 1,
};

export const L2_PRESET: CacheConfig = {
  addressBits: 8, memoryBytes: 256, cacheBytes: 64, blockBytes: 4, associativity: 1,
  replacement: "lru", writePolicy: "back", allocation: "allocate", seed: 2,
};

export interface AccessHop {
  address: number;
  level: string;
  cycles: number;
  penalty: number;
}

export function temporalReuse(trace: number[]): number {
  const seen = new Set<number>();
  let repeats = 0;
  for (const address of trace) {
    if (seen.has(address)) repeats += 1;
    seen.add(address);
  }
  return trace.length === 0 ? 0 : repeats / trace.length;
}

export function spatialReuse(trace: number[], lineBytes: number): number {
  if (trace.length < 2) return 0;
  let close = 0;
  for (let index = 1; index < trace.length; index += 1) {
    const previous = trace[index - 1] ?? 0;
    const current = trace[index] ?? 0;
    if (Math.abs(current - previous) < lineBytes) close += 1;
  }
  return close / (trace.length - 1);
}

export function walkTrace(
  trace: number[],
  registers: number[],
  ramLimit: number,
  latencies: Latencies,
  l1: CacheMachine = createCache(L1_PRESET),
  l2: CacheMachine = createCache(L2_PRESET),
): { hops: AccessHop[]; l1: CacheMachine; l2: CacheMachine; cycles: number; amat: number } {
  let primary = l1;
  let secondary = l2;
  const hops: AccessHop[] = [];
  let cycles = 0;
  for (const address of trace) {
    let level = "Storage";
    let cost = latencies.storage;
    if (registers.includes(address)) {
      level = "Registers";
      cost = latencies.register;
    } else {
      const first = accessCache(primary, address, "read");
      primary = first.machine;
      if (first.result.hit) {
        level = "L1";
        cost = latencies.l1;
      } else {
        const second = accessCache(secondary, address, "read");
        secondary = second.machine;
        if (second.result.hit) {
          level = "L2";
          cost = latencies.l2;
        } else if (address >= 0 && address < ramLimit) {
          level = "RAM";
          cost = latencies.ram;
        }
      }
    }
    cycles += cost;
    hops.push({ address, level, cycles: cost, penalty: cost - latencies.register });
  }
  return {
    hops,
    l1: primary,
    l2: secondary,
    cycles,
    amat: amat(latencies.l1, primary.stats, latencies.ram),
  };
}

export function cacheSummary(machine: CacheMachine, hitCycles: number, missPenalty: number): { hit: number; miss: number; amat: number; valid: boolean } {
  return {
    hit: hitRate(machine.stats),
    miss: missRate(machine.stats),
    amat: amat(hitCycles, machine.stats, missPenalty),
    valid: validGeometry(machine.config),
  };
}
