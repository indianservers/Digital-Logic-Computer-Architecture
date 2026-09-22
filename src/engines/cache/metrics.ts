export interface CacheStats {
  accesses: number;
  reads: number;
  writes: number;
  hits: number;
  misses: number;
  evictions: number;
  writeBacks: number;
  memoryWrites: number;
}

export function emptyStats(): CacheStats {
  return { accesses: 0, reads: 0, writes: 0, hits: 0, misses: 0, evictions: 0, writeBacks: 0, memoryWrites: 0 };
}

export function hitRate(stats: CacheStats): number {
  if (stats.accesses === 0) return 0;
  return stats.hits / stats.accesses;
}

export function missRate(stats: CacheStats): number {
  if (stats.accesses === 0) return 0;
  return stats.misses / stats.accesses;
}

export function amat(hitTime: number, stats: CacheStats, missPenalty: number): number {
  return hitTime + missRate(stats) * missPenalty;
}

export function hierarchicalAmat(levels: Array<{ hitCycles: number; accesses: number; misses: number }>, ramCycles: number): number {
  let penalty = ramCycles;
  for (let index = levels.length - 1; index >= 0; index -= 1) {
    const level = levels[index];
    if (!level) continue;
    const rate = level.accesses === 0 ? 0 : level.misses / level.accesses;
    penalty = level.hitCycles + rate * penalty;
  }
  return penalty;
}
