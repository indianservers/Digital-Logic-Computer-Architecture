export interface Machine {
  peak: number;
  bandwidth: number;
  lineBytes: number;
}

export interface Workload {
  id: string;
  name: string;
  flops: number;
  bytes: number;
  observed: number | null;
}

export const MACHINE_DEFAULTS: Machine = { peak: 1000, bandwidth: 100, lineBytes: 64 };

export function arithmeticIntensity(flops: number, bytes: number) {
  if (bytes <= 0) return flops > 0 ? Number.POSITIVE_INFINITY : 0;
  if (flops <= 0) return 0;
  return flops / bytes;
}

export function ridgePoint(machine: Machine) {
  if (machine.bandwidth <= 0) return Number.POSITIVE_INFINITY;
  return machine.peak / machine.bandwidth;
}

export function ceilings(ai: number, machine: Machine) {
  const memory = Number.isFinite(ai) ? ai * machine.bandwidth : Number.POSITIVE_INFINITY;
  const roof = Math.min(machine.peak, memory);
  return { memory, roof };
}

export type Bound = "memory" | "compute" | "transition" | "idle";

export function classify(ai: number, machine: Machine): Bound {
  if (ai === 0) return "idle";
  const ridge = ridgePoint(machine);
  if (!Number.isFinite(ridge) || !Number.isFinite(ai)) return "compute";
  if (ai < ridge * 0.98) return "memory";
  if (ai > ridge * 1.02) return "compute";
  return "transition";
}

export function analyzeWorkload(workload: Workload, machine: Machine) {
  const ai = arithmeticIntensity(workload.flops, workload.bytes);
  const { memory, roof } = ceilings(ai, machine);
  const observed = workload.observed;
  const inconsistent = observed !== null && Number.isFinite(roof) && observed > roof + 1e-9;
  const used = observed === null ? roof : Math.min(observed, roof);
  return {
    ai,
    memory,
    roof,
    observed,
    inconsistent,
    headroom: Number.isFinite(roof) ? Math.max(0, roof - (observed ?? roof)) : 0,
    efficiency: observed === null || roof <= 0 ? 1 : Math.min(1, observed / roof),
    bound: classify(ai, machine),
    attained: used,
  };
}

export function applyOptimizations(workload: Workload, options: { blocking: boolean; locality: boolean }): Workload {
  let bytes = workload.bytes;
  if (options.blocking) bytes *= 0.5;
  if (options.locality) bytes *= 0.8;
  return { ...workload, bytes: Math.max(0, bytes) };
}

export const ROOF_PRESETS: Workload[] = [
  { id: "vector", name: "Vector add", flops: 1e8, bytes: 8e8, observed: null },
  { id: "saxpy", name: "SAXPY", flops: 2e8, bytes: 2.4e9, observed: null },
  { id: "gemm", name: "Dense matrix multiply", flops: 2.15e9, bytes: 1.075e9, observed: null },
  { id: "spmv", name: "Sparse matrix-vector", flops: 2e8, bytes: 2e9, observed: null },
  { id: "stencil", name: "Stencil", flops: 3.4e8, bytes: 6.8e8, observed: null },
  { id: "reduction", name: "Reduction", flops: 1e8, bytes: 8e8, observed: null },
  { id: "custom", name: "User defined", flops: 1e8, bytes: 1e8, observed: null },
];
