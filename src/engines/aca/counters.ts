export interface CounterProfile {
  id: string;
  label: string;
  instructions: number;
  cpi: number;
  frequencyHz: number;
  threads: number;
  branchPerInst: number;
  mispredictRate: number;
  l1AccessPerInst: number;
  l1MissRate: number;
  l2MissOfL1: number;
  llcMissOfL2: number;
  dtlbMissRate: number;
  itlbMissRate: number;
  iAccessPerInst: number;
  iMissRate: number;
  frontendShare: number;
  memoryShare: number;
  lineBytes: number;
}

export interface CounterTotals {
  cycles: number;
  instructions: number;
  branches: number;
  mispredictions: number;
  l1Accesses: number;
  l1Misses: number;
  l2Accesses: number;
  l2Misses: number;
  llcAccesses: number;
  llcMisses: number;
  dtlbAccesses: number;
  dtlbMisses: number;
  itlbAccesses: number;
  itlbMisses: number;
  iAccesses: number;
  iMisses: number;
  frontendStalls: number;
  backendStalls: number;
  memoryStalls: number;
  bytes: number;
  time: number;
}

export interface DerivedCounters {
  ipc: number;
  cpi: number;
  mispredictRate: number;
  branchMpki: number;
  l1MissRate: number;
  l1Mpki: number;
  llcMissRate: number;
  llcMpki: number;
  dtlbMissRate: number;
  itlbMissRate: number;
  tlbMpki: number;
  bandwidth: number;
  stallShare: { frontend: number; backend: number; memory: number };
}

export const COUNTER_DEFAULTS: CounterProfile = {
  id: "mixed",
  label: "Mixed workload",
  instructions: 1_000_000,
  cpi: 1.25,
  frequencyHz: 3e9,
  threads: 4,
  branchPerInst: 0.15,
  mispredictRate: 0.04,
  l1AccessPerInst: 0.4,
  l1MissRate: 0.05,
  l2MissOfL1: 0.4,
  llcMissOfL2: 0.5,
  dtlbMissRate: 0.002,
  itlbMissRate: 0.001,
  iAccessPerInst: 0.25,
  iMissRate: 0.01,
  frontendShare: 0.15,
  memoryShare: 0.25,
  lineBytes: 64,
};

function share(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function totalsFor(profile: CounterProfile): CounterTotals {
  const instructions = Math.max(0, profile.instructions);
  const cycles = instructions * Math.max(0, profile.cpi);
  const branches = instructions * Math.max(0, profile.branchPerInst);
  const mispredictions = branches * share(profile.mispredictRate);
  const l1Accesses = instructions * Math.max(0, profile.l1AccessPerInst);
  const l1Misses = l1Accesses * share(profile.l1MissRate);
  const l2Accesses = l1Misses;
  const l2Misses = l2Accesses * share(profile.l2MissOfL1);
  const llcAccesses = l2Misses;
  const llcMisses = llcAccesses * share(profile.llcMissOfL2);
  const iAccesses = instructions * Math.max(0, profile.iAccessPerInst);
  const iMisses = iAccesses * share(profile.iMissRate);
  const dtlbAccesses = l1Accesses;
  const dtlbMisses = dtlbAccesses * share(profile.dtlbMissRate);
  const itlbAccesses = iAccesses;
  const itlbMisses = itlbAccesses * share(profile.itlbMissRate);
  const frontendShare = share(profile.frontendShare);
  const memoryShare = share(profile.memoryShare);
  const used = Math.min(1, frontendShare + memoryShare);
  const backendShare = Math.max(0, 1 - used) * 0.35;
  return {
    cycles,
    instructions,
    branches,
    mispredictions,
    l1Accesses,
    l1Misses,
    l2Accesses,
    l2Misses,
    llcAccesses,
    llcMisses,
    dtlbAccesses,
    dtlbMisses,
    itlbAccesses,
    itlbMisses,
    iAccesses,
    iMisses,
    frontendStalls: cycles * frontendShare,
    backendStalls: cycles * backendShare,
    memoryStalls: cycles * Math.min(memoryShare, 1 - frontendShare),
    bytes: llcMisses * Math.max(1, profile.lineBytes),
    time: profile.frequencyHz <= 0 ? 0 : cycles / profile.frequencyHz,
  };
}

function ratio(part: number, whole: number) {
  if (whole <= 0) return 0;
  return part / whole;
}

export function derive(totals: CounterTotals): DerivedCounters {
  const stall = totals.frontendStalls + totals.backendStalls + totals.memoryStalls;
  return {
    ipc: ratio(totals.instructions, totals.cycles),
    cpi: ratio(totals.cycles, totals.instructions),
    mispredictRate: ratio(totals.mispredictions, totals.branches),
    branchMpki: ratio(totals.mispredictions, totals.instructions) * 1000,
    l1MissRate: ratio(totals.l1Misses, totals.l1Accesses),
    l1Mpki: ratio(totals.l1Misses, totals.instructions) * 1000,
    llcMissRate: ratio(totals.llcMisses, totals.llcAccesses),
    llcMpki: ratio(totals.llcMisses, totals.instructions) * 1000,
    dtlbMissRate: ratio(totals.dtlbMisses, totals.dtlbAccesses),
    itlbMissRate: ratio(totals.itlbMisses, totals.itlbAccesses),
    tlbMpki: ratio(totals.dtlbMisses + totals.itlbMisses, totals.instructions) * 1000,
    bandwidth: totals.time <= 0 ? 0 : totals.bytes / totals.time / 1e9,
    stallShare: {
      frontend: ratio(totals.frontendStalls, stall),
      backend: ratio(totals.backendStalls, stall),
      memory: ratio(totals.memoryStalls, stall),
    },
  };
}

function scaleTotals(totals: CounterTotals, factor: number, wallTime?: number): CounterTotals {
  return {
    cycles: totals.cycles * factor,
    instructions: totals.instructions * factor,
    branches: totals.branches * factor,
    mispredictions: totals.mispredictions * factor,
    l1Accesses: totals.l1Accesses * factor,
    l1Misses: totals.l1Misses * factor,
    l2Accesses: totals.l2Accesses * factor,
    l2Misses: totals.l2Misses * factor,
    llcAccesses: totals.llcAccesses * factor,
    llcMisses: totals.llcMisses * factor,
    dtlbAccesses: totals.dtlbAccesses * factor,
    dtlbMisses: totals.dtlbMisses * factor,
    itlbAccesses: totals.itlbAccesses * factor,
    itlbMisses: totals.itlbMisses * factor,
    iAccesses: totals.iAccesses * factor,
    iMisses: totals.iMisses * factor,
    frontendStalls: totals.frontendStalls * factor,
    backendStalls: totals.backendStalls * factor,
    memoryStalls: totals.memoryStalls * factor,
    bytes: totals.bytes * factor,
    time: wallTime ?? totals.time * factor,
  };
}

export function sampleAt(profile: CounterProfile, fraction: number) {
  const full = totalsFor(profile);
  const t = Math.min(1, Math.max(0, fraction));
  const totals = scaleTotals(full, t);
  return { totals, derived: derive(totals) };
}

export function interval(before: CounterTotals, after: CounterTotals) {
  const delta = scaleTotals(after, 1);
  (Object.keys(delta) as Array<keyof CounterTotals>).forEach((key) => {
    delta[key] = after[key] - before[key];
  });
  return { delta, derived: derive(delta) };
}

export function perCore(profile: CounterProfile) {
  const full = totalsFor(profile);
  const width = Math.max(1, profile.threads);
  const weights = Array.from({ length: width }, (_, index) => 1 + index * 0.02);
  const sum = weights.reduce((total, weight) => total + weight, 0);
  return weights.map((weight, core) => {
    const totals = scaleTotals(full, weight / sum, full.time);
    return { core, totals, derived: derive(totals) };
  });
}

export function evidence(profile: CounterProfile) {
  const derived = derive(totalsFor(profile));
  const notes: string[] = [];
  if (derived.llcMpki > 5 && derived.stallShare.memory > 0.3) notes.push("LLC misses and memory-stall share are both high, so the memory subsystem is a plausible contributor.");
  if (derived.mispredictRate > 0.05 && derived.branchMpki > 5) notes.push("Branch mispredictions are frequent enough to be a plausible contributor.");
  if (derived.stallShare.frontend > derived.stallShare.memory && derived.stallShare.frontend > derived.stallShare.backend) notes.push("Front-end stall cycles are the largest exclusive stall share in this model.");
  if (derived.dtlbMissRate > 0.01 || derived.itlbMissRate > 0.01) notes.push("TLB miss rates are elevated. Address translation is a plausible contributor.");
  if (notes.length === 0) notes.push("No single counter crosses the lab thresholds. IPC alone does not name a cause.");
  return { derived, notes };
}

export function toCsv(rows: Array<Record<string, number | string>>) {
  const header = Object.keys(rows[0] ?? {});
  const body = rows.map((row) => header.map((key) => row[key]).join(","));
  return [header.join(","), ...body].join("\n");
}

export const COUNTER_PRESETS: CounterProfile[] = [
  { ...COUNTER_DEFAULTS, id: "compute", label: "Compute heavy", cpi: 0.6, branchPerInst: 0.05, mispredictRate: 0.01, l1MissRate: 0.01, l2MissOfL1: 0.2, llcMissOfL2: 0.1, memoryShare: 0.05, frontendShare: 0.05 },
  { ...COUNTER_DEFAULTS, id: "branch", label: "Branch heavy", cpi: 1.8, branchPerInst: 0.22, mispredictRate: 0.12, memoryShare: 0.08, frontendShare: 0.2 },
  { ...COUNTER_DEFAULTS, id: "stream", label: "Streaming memory", cpi: 2.4, l1AccessPerInst: 0.5, l1MissRate: 0.2, l2MissOfL1: 0.8, llcMissOfL2: 0.9, memoryShare: 0.55, frontendShare: 0.05, branchPerInst: 0.02, mispredictRate: 0.01 },
  { ...COUNTER_DEFAULTS, id: "random", label: "Random memory", cpi: 3, l1MissRate: 0.15, l2MissOfL1: 0.7, llcMissOfL2: 0.85, dtlbMissRate: 0.02, memoryShare: 0.5, frontendShare: 0.08 },
  { ...COUNTER_DEFAULTS, id: "friendly", label: "Cache friendly", cpi: 0.8, l1MissRate: 0.01, l2MissOfL1: 0.1, llcMissOfL2: 0.05, memoryShare: 0.04, frontendShare: 0.08 },
  { ...COUNTER_DEFAULTS, id: "tlb", label: "TLB stress", cpi: 1.6, dtlbMissRate: 0.04, itlbMissRate: 0.02, memoryShare: 0.2, frontendShare: 0.15 },
  { ...COUNTER_DEFAULTS, id: "front", label: "Front-end heavy", cpi: 1.7, iMissRate: 0.08, iAccessPerInst: 0.4, frontendShare: 0.45, memoryShare: 0.08, mispredictRate: 0.03 },
  { ...COUNTER_DEFAULTS, id: "mixed", label: "Mixed workload" },
];
