export const CORE_COUNTS = [1, 2, 4, 8, 16, 32, 64];

export interface ScaleInput {
  cores: number;
  serial: number;
  commPerCore: number;
  syncPerBarrier: number;
  barriers: number;
  imbalance: number;
  mode: "strong" | "weak";
  includeComm: boolean;
  includeSync: boolean;
}

export interface ScalePoint {
  cores: number;
  ideal: number;
  amdahl: number;
  speedup: number;
  efficiency: number;
  serial: number;
  parallel: number;
  communication: number;
  synchronization: number;
  idle: number;
  time: number;
}

export const SCALE_DEFAULTS: ScaleInput = {
  cores: 16,
  serial: 0.05,
  commPerCore: 0.02,
  syncPerBarrier: 0.01,
  barriers: 1,
  imbalance: 0,
  mode: "strong",
  includeComm: true,
  includeSync: true,
};

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function amdahlSpeedup(serial: number, cores: number) {
  const n = Math.max(1, cores);
  const fraction = clamp01(serial);
  if (fraction === 0) return n;
  return 1 / (fraction + (1 - fraction) / n);
}

export function theoreticalLimit(serial: number) {
  const fraction = clamp01(serial);
  if (fraction === 0) return Number.POSITIVE_INFINITY;
  return 1 / fraction;
}

export function scaleAt(input: ScaleInput, cores: number): ScalePoint {
  const n = Math.max(1, cores);
  const fraction = clamp01(input.serial);
  const communication = n <= 1 || !input.includeComm ? 0 : Math.max(0, input.commPerCore);
  const synchronization = n <= 1 || !input.includeSync ? 0 : Math.max(0, input.syncPerBarrier) * Math.max(0, input.barriers);
  const imbalance = Math.max(0, input.imbalance);
  if (input.mode === "weak") {
    const parallel = (1 - fraction) * (1 + imbalance);
    const idle = (1 - fraction) * imbalance;
    const time = fraction + parallel + communication + synchronization;
    const speedup = time === 0 ? n : (fraction + (1 - fraction) * n) / time;
    return {
      cores: n,
      ideal: n,
      amdahl: amdahlSpeedup(fraction, n),
      speedup,
      efficiency: speedup / n,
      serial: fraction,
      parallel: 1 - fraction,
      communication,
      synchronization,
      idle,
      time,
    };
  }
  const parallel = (1 - fraction) / n;
  const idle = parallel * imbalance;
  const time = fraction + parallel + idle + communication + synchronization;
  const speedup = time === 0 ? n : 1 / time;
  return {
    cores: n,
    ideal: n,
    amdahl: amdahlSpeedup(fraction, n),
    speedup,
    efficiency: speedup / n,
    serial: fraction,
    parallel,
    communication,
    synchronization,
    idle,
    time,
  };
}

export function scaleSeries(input: ScaleInput) {
  return CORE_COUNTS.map((cores) => scaleAt(input, cores));
}

export const SCALE_PRESETS: Array<{ id: string; label: string; input: Partial<ScaleInput> }> = [
  { id: "ideal", label: "Ideal parallel workload", input: { serial: 0, commPerCore: 0, syncPerBarrier: 0, imbalance: 0, includeComm: false, includeSync: false, mode: "strong" } },
  { id: "five", label: "5% serial fraction", input: { serial: 0.05, includeComm: false, includeSync: false, imbalance: 0, mode: "strong" } },
  { id: "ten", label: "10% serial fraction", input: { serial: 0.1, includeComm: false, includeSync: false, imbalance: 0, mode: "strong" } },
  { id: "comm", label: "Communication-heavy", input: { serial: 0.05, commPerCore: 0.15, includeComm: true, includeSync: false, imbalance: 0, mode: "strong" } },
  { id: "sync", label: "Synchronization-heavy", input: { serial: 0.05, barriers: 8, syncPerBarrier: 0.02, includeComm: false, includeSync: true, imbalance: 0, mode: "strong" } },
  { id: "skew", label: "Load-imbalanced", input: { serial: 0.05, imbalance: 0.6, includeComm: false, includeSync: true, mode: "strong" } },
  { id: "weak", label: "Weak scaling", input: { serial: 0.05, mode: "weak", includeComm: true, includeSync: true, commPerCore: 0.002 } },
  { id: "strong", label: "Strong scaling", input: { serial: 0.05, mode: "strong", includeComm: true, includeSync: true, commPerCore: 0.002 } },
];
