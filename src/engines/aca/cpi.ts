export interface StallRates {
  instructions: number;
  baseCpi: number;
  frontendPerInst: number;
  branchFrequency: number;
  mispredictRate: number;
  branchPenalty: number;
  executionPerInst: number;
  l1MissRate: number;
  l1Penalty: number;
  memoryRatio: number;
  memoryPenalty: number;
}

export interface StallCycles {
  useful: number;
  frontend: number;
  branch: number;
  execution: number;
  cache: number;
  memory: number;
}

export interface CpiResult {
  cycles: StallCycles;
  totalCycles: number;
  cpi: number;
  ipc: number;
  stallCycles: number;
  stallShare: number;
  largest: keyof Omit<StallCycles, "useful">;
  parts: Array<{ id: keyof Omit<StallCycles, "useful">; cycles: number; cpi: number; share: number }>;
}

export const CPI_RATES: StallRates = {
  instructions: 100000,
  baseCpi: 1,
  frontendPerInst: 0.15,
  branchFrequency: 0.2,
  mispredictRate: 0.08,
  branchPenalty: 12,
  executionPerInst: 0.1,
  l1MissRate: 0.05,
  l1Penalty: 8,
  memoryRatio: 0.02,
  memoryPenalty: 40,
};

const STALL_KEYS = ["frontend", "branch", "execution", "cache", "memory"] as const;

export function cyclesFromRates(rates: StallRates): StallCycles {
  const n = Math.max(1, rates.instructions);
  return {
    useful: n * Math.max(0, rates.baseCpi),
    frontend: n * Math.max(0, rates.frontendPerInst),
    branch: n * Math.max(0, rates.branchFrequency) * Math.max(0, rates.mispredictRate) * Math.max(0, rates.branchPenalty),
    execution: n * Math.max(0, rates.executionPerInst),
    cache: n * Math.max(0, rates.l1MissRate) * Math.max(0, rates.l1Penalty),
    memory: n * Math.max(0, rates.memoryRatio) * Math.max(0, rates.memoryPenalty),
  };
}

export function analyzeCpi(cycles: StallCycles, instructions: number): CpiResult {
  const retired = Math.max(1, instructions);
  const totalCycles = cycles.useful + cycles.frontend + cycles.branch + cycles.execution + cycles.cache + cycles.memory;
  const stallCycles = totalCycles - cycles.useful;
  const largest = STALL_KEYS.reduce((best, key) => cycles[key] > cycles[best] ? key : best, "frontend" as (typeof STALL_KEYS)[number]);
  return {
    cycles,
    totalCycles,
    cpi: totalCycles / retired,
    ipc: retired / totalCycles,
    stallCycles,
    stallShare: totalCycles === 0 ? 0 : stallCycles / totalCycles,
    largest,
    parts: STALL_KEYS.map((id) => ({
      id,
      cycles: cycles[id],
      cpi: cycles[id] / retired,
      share: stallCycles === 0 ? 0 : cycles[id] / stallCycles,
    })),
  };
}

export interface WhatIf {
  frontend: number;
  branch: number;
  execution: number;
  cache: number;
  memory: number;
}

export const WHAT_IF_NONE: WhatIf = { frontend: 1, branch: 1, execution: 1, cache: 1, memory: 1 };

export function applyWhatIf(cycles: StallCycles, factors: WhatIf): StallCycles {
  return {
    useful: cycles.useful,
    frontend: cycles.frontend * factors.frontend,
    branch: cycles.branch * factors.branch,
    execution: cycles.execution * factors.execution,
    cache: cycles.cache * factors.cache,
    memory: cycles.memory * factors.memory,
  };
}

export function speedup(before: number, after: number) {
  if (after <= 0) return Number.POSITIVE_INFINITY;
  return before / after;
}

export const CPI_PRESETS: Array<{ id: string; label: string; rates: Partial<StallRates> }> = [
  { id: "compute", label: "Compute bound", rates: { frontendPerInst: 0.02, branchFrequency: 0.05, mispredictRate: 0.02, executionPerInst: 0.4, l1MissRate: 0.01, memoryRatio: 0.002 } },
  { id: "branch", label: "Branch heavy", rates: { branchFrequency: 0.25, mispredictRate: 0.2, branchPenalty: 15, frontendPerInst: 0.05, executionPerInst: 0.05, l1MissRate: 0.01, memoryRatio: 0.002 } },
  { id: "front", label: "Front-end limited", rates: { frontendPerInst: 0.8, branchFrequency: 0.1, mispredictRate: 0.04, executionPerInst: 0.05, l1MissRate: 0.01, memoryRatio: 0.002 } },
  { id: "cache", label: "Cache sensitive", rates: { l1MissRate: 0.12, l1Penalty: 12, memoryRatio: 0.005, frontendPerInst: 0.05, executionPerInst: 0.05 } },
  { id: "memory", label: "Memory bound", rates: { memoryRatio: 0.08, memoryPenalty: 50, l1MissRate: 0.04, frontendPerInst: 0.05, executionPerInst: 0.05, branchFrequency: 0.1, mispredictRate: 0.04 } },
  { id: "balanced", label: "Balanced workload", rates: {} },
  { id: "custom", label: "User defined", rates: {} },
];
