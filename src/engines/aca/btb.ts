export type BtbPolicy = "lru" | "fifo";

export interface BtbAccess {
  pc: number;
  taken: boolean;
  target: number;
  text: string;
  kind: "conditional" | "jump" | "call" | "return";
}

export interface BtbConfig {
  entries: number;
  ways: number;
  policy: BtbPolicy;
  enabled: boolean;
}

export interface BtbEntry {
  valid: boolean;
  tag: number;
  pc: number;
  target: number;
  kind: string;
  lastUsed: number;
  order: number;
}

export interface BtbShot {
  cycle: number;
  pc: number;
  taken: boolean;
  actualTarget: number;
  text: string;
  kind: string;
  index: number;
  tag: number;
  hit: boolean;
  predictedTarget: number | null;
  targetCorrect: boolean;
  nextPc: number;
  evicted: { pc: number; target: number } | null;
  installed: boolean;
  sets: BtbEntry[][];
  lookups: number;
  hits: number;
  misses: number;
  evictions: number;
  targetHits: number;
}

const SHIFT = 3;

export function btbGeometry(config: BtbConfig): { sets: number; indexBits: number } {
  const ways = Math.max(1, config.ways);
  const sets = Math.max(1, Math.floor(config.entries / ways));
  return { sets, indexBits: Math.round(Math.log2(sets)) };
}

export function btbIndex(pc: number, indexBits: number): number {
  return (pc >>> SHIFT) & ((1 << indexBits) - 1);
}

export function btbTag(pc: number, indexBits: number): number {
  return pc >>> (SHIFT + indexBits);
}

function blank(ways: number): BtbEntry[] {
  return Array.from({ length: ways }, () => ({ valid: false, tag: 0, pc: 0, target: 0, kind: "", lastUsed: 0, order: 0 }));
}

function clone(sets: BtbEntry[][]): BtbEntry[][] {
  return sets.map((set) => set.map((entry) => ({ ...entry })));
}

export function lookupEntry(sets: BtbEntry[][], pc: number, indexBits: number): { index: number; tag: number; way: number } {
  const index = btbIndex(pc, indexBits);
  const tag = btbTag(pc, indexBits);
  const set = sets[index] ?? [];
  const way = set.findIndex((entry) => entry.valid && entry.tag === tag);
  return { index, tag, way };
}

export function runBtb(accesses: BtbAccess[], config: BtbConfig, seed: BtbAccess[] = []): BtbShot[] {
  const { sets: setCount, indexBits } = btbGeometry(config);
  const sets = Array.from({ length: setCount }, () => blank(config.ways));
  let stamp = 1;
  const install = (access: BtbAccess, cycle: number): { evicted: { pc: number; target: number } | null; installed: boolean } => {
    if (!config.enabled || !access.taken || access.kind === "return") return { evicted: null, installed: false };
    const found = lookupEntry(sets, access.pc, indexBits);
    const set = sets[found.index];
    if (!set) return { evicted: null, installed: false };
    if (found.way >= 0) {
      const entry = set[found.way];
      if (!entry) return { evicted: null, installed: false };
      entry.target = access.target;
      entry.pc = access.pc;
      entry.kind = access.kind;
      entry.lastUsed = cycle;
      return { evicted: null, installed: false };
    }
    let victim = set.findIndex((entry) => !entry.valid);
    let evicted: { pc: number; target: number } | null = null;
    if (victim < 0) {
      victim = config.policy === "fifo"
        ? set.reduce((best, entry, index) => (entry.order < (set[best]?.order ?? Infinity) ? index : best), 0)
        : set.reduce((best, entry, index) => (entry.lastUsed < (set[best]?.lastUsed ?? Infinity) ? index : best), 0);
      const old = set[victim];
      if (old?.valid) evicted = { pc: old.pc, target: old.target };
    }
    const slot = set[victim];
    if (!slot) return { evicted: null, installed: false };
    slot.valid = true;
    slot.tag = found.tag;
    slot.pc = access.pc;
    slot.target = access.target;
    slot.kind = access.kind;
    slot.lastUsed = cycle;
    slot.order = stamp;
    stamp += 1;
    return { evicted, installed: true };
  };
  seed.forEach((access, index) => install(access, index + 1));
  const shots: BtbShot[] = [];
  let lookups = 0;
  let hits = 0;
  let misses = 0;
  let evictions = 0;
  let targetHits = 0;
  accesses.forEach((access, index) => {
    lookups += 1;
    const found = lookupEntry(sets, access.pc, indexBits);
    const hit = config.enabled && found.way >= 0;
    const entry = hit ? sets[found.index]?.[found.way] : undefined;
    if (hit && entry) entry.lastUsed = index + seed.length + 1;
    if (hit) hits += 1;
    else misses += 1;
    const predictedTarget = entry?.target ?? null;
    const targetCorrect = predictedTarget != null && predictedTarget === access.target;
    if (targetCorrect) targetHits += 1;
    const update = install(access, index + seed.length + 1);
    if (update.evicted) evictions += 1;
    const nextPc = hit && access.taken && predictedTarget != null ? predictedTarget : access.pc + 4;
    shots.push({
      cycle: index + 1,
      pc: access.pc,
      taken: access.taken,
      actualTarget: access.target,
      text: access.text,
      kind: access.kind,
      index: found.index,
      tag: found.tag,
      hit,
      predictedTarget,
      targetCorrect,
      nextPc,
      evicted: update.evicted,
      installed: update.installed,
      sets: clone(sets),
      lookups,
      hits,
      misses,
      evictions,
      targetHits,
    });
  });
  return shots;
}

function access(pc: number, taken: boolean, target: number, text: string, kind: BtbAccess["kind"] = "conditional"): BtbAccess {
  return { pc, taken, target, text, kind };
}

export const BTB_SEED: BtbAccess[] = [
  access(0x4000, true, 0x1020, "BEQ loop", "conditional"),
  access(0x4010, true, 0x20f0, "JAL call", "call"),
  access(0x4058, true, 0x4100, "BEQ taken", "conditional"),
];

export const BTB_PRESETS: Array<{ id: string; label: string; accesses: BtbAccess[]; seed: boolean }> = [
  {
    id: "hot",
    label: "Hot loop",
    seed: true,
    accesses: Array.from({ length: 8 }, () => access(0x4000, true, 0x1020, "BEQ loop")),
  },
  {
    id: "two",
    label: "Two branch PCs",
    seed: false,
    accesses: Array.from({ length: 8 }, (_, index) => index % 2 === 0
      ? access(0x4000, true, 0x1020, "BEQ A")
      : access(0x4018, true, 0x1100, "BNE B")),
  },
  {
    id: "capacity",
    label: "Capacity pressure",
    seed: false,
    accesses: Array.from({ length: 12 }, (_, index) => access(0x4000 + index * 8, true, 0x5000 + index * 4, `BEQ ${index}`)),
  },
  {
    id: "conflict",
    label: "Conflict misses",
    seed: false,
    accesses: [
      access(0x4000, true, 0x1020, "BEQ A"),
      access(0x4040, true, 0x2200, "BEQ same set"),
      access(0x4000, true, 0x1020, "BEQ A again"),
      access(0x4040, true, 0x2200, "BEQ same set again"),
    ],
  },
  {
    id: "retarget",
    label: "Target change",
    seed: false,
    accesses: [
      access(0x4000, true, 0x1020, "BEQ old"),
      access(0x4000, true, 0x1020, "BEQ hit"),
      access(0x4000, true, 0x1800, "BEQ new target"),
      access(0x4000, true, 0x1800, "BEQ updated"),
    ],
  },
  {
    id: "assoc",
    label: "Associative replacement",
    seed: false,
    accesses: [
      access(0x4000, true, 0x1020, "way A"),
      access(0x4040, true, 0x2200, "way B"),
      access(0x4000, true, 0x1020, "touch A"),
      access(0x4080, true, 0x3300, "third in set"),
    ],
  },
];
