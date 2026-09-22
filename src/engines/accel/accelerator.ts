export type Matrix = number[][];

export function mac(a: number, b: number, acc: number): number {
  return a * b + acc;
}

export function macRepeat(a: number, b: number, acc: number, times: number): { acc: number; steps: Array<{ a: number; b: number; before: number; product: number; after: number }> } {
  const steps = [];
  let value = acc;
  const count = Math.max(0, Math.floor(times));
  for (let index = 0; index < count; index += 1) {
    const product = a * b;
    const after = product + value;
    steps.push({ a, b, before: value, product, after });
    value = after;
  }
  return { acc: value, steps };
}

export function zeroMatrix(rows: number, cols: number): Matrix {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0));
}

export function cloneMatrix(matrix: Matrix): Matrix {
  return matrix.map((row) => row.slice());
}

export function matMul(a: Matrix, b: Matrix): Matrix {
  const rows = a.length;
  const inner = a[0]?.length ?? 0;
  const cols = b[0]?.length ?? 0;
  if (inner !== b.length) throw new Error("Inner dimensions must match for matrix multiplication.");
  const c = zeroMatrix(rows, cols);
  for (let i = 0; i < rows; i += 1) {
    for (let j = 0; j < cols; j += 1) {
      let sum = 0;
      for (let k = 0; k < inner; k += 1) sum += (a[i]?.[k] ?? 0) * (b[k]?.[j] ?? 0);
      const row = c[i];
      if (row) row[j] = sum;
    }
  }
  return c;
}

export interface MatMulStep {
  cycle: number;
  i: number;
  j: number;
  k: number;
  a: number;
  b: number;
  product: number;
  acc: number;
  mode: "scalar" | "vector" | "systolic";
}

export function matMulScalarSteps(a: Matrix, b: Matrix): { result: Matrix; steps: MatMulStep[] } {
  const rows = a.length;
  const inner = a[0]?.length ?? 0;
  const cols = b[0]?.length ?? 0;
  const result = zeroMatrix(rows, cols);
  const steps: MatMulStep[] = [];
  let cycle = 0;
  for (let i = 0; i < rows; i += 1) {
    for (let j = 0; j < cols; j += 1) {
      for (let k = 0; k < inner; k += 1) {
        const av = a[i]?.[k] ?? 0;
        const bv = b[k]?.[j] ?? 0;
        const product = av * bv;
        const row = result[i] ?? [];
        const acc = (row[j] ?? 0) + product;
        row[j] = acc;
        result[i] = row;
        steps.push({ cycle, i, j, k, a: av, b: bv, product, acc, mode: "scalar" });
        cycle += 1;
      }
    }
  }
  return { result, steps };
}

export function matMulVectorSteps(a: Matrix, b: Matrix): { result: Matrix; steps: MatMulStep[] } {
  const rows = a.length;
  const inner = a[0]?.length ?? 0;
  const cols = b[0]?.length ?? 0;
  const result = zeroMatrix(rows, cols);
  const steps: MatMulStep[] = [];
  let cycle = 0;
  for (let i = 0; i < rows; i += 1) {
    for (let k = 0; k < inner; k += 1) {
      for (let j = 0; j < cols; j += 1) {
        const av = a[i]?.[k] ?? 0;
        const bv = b[k]?.[j] ?? 0;
        const product = av * bv;
        const row = result[i] ?? [];
        const acc = (row[j] ?? 0) + product;
        row[j] = acc;
        result[i] = row;
        steps.push({ cycle, i, j, k, a: av, b: bv, product, acc, mode: "vector" });
      }
      cycle += 1;
    }
  }
  return { result, steps };
}

export function matMulSystolicSteps(a: Matrix, b: Matrix): { result: Matrix; steps: MatMulStep[] } {
  const rows = a.length;
  const inner = a[0]?.length ?? 0;
  const cols = b[0]?.length ?? 0;
  const result = zeroMatrix(rows, cols);
  const steps: MatMulStep[] = [];
  for (let k = 0; k < inner; k += 1) {
    for (let i = 0; i < rows; i += 1) {
      for (let j = 0; j < cols; j += 1) {
        const av = a[i]?.[k] ?? 0;
        const bv = b[k]?.[j] ?? 0;
        const product = av * bv;
        const row = result[i] ?? [];
        const acc = (row[j] ?? 0) + product;
        row[j] = acc;
        result[i] = row;
        steps.push({ cycle: k, i, j, k, a: av, b: bv, product, acc, mode: "systolic" });
      }
    }
  }
  return { result, steps };
}

export interface SystolicCell {
  i: number;
  j: number;
  a: number | null;
  b: number | null;
  c: number;
  product: number | null;
}

export function systolicCells(a: Matrix, b: Matrix, cycle: number): { cells: SystolicCell[][]; result: Matrix; complete: boolean } {
  const n = a.length;
  const result = zeroMatrix(n, n);
  const cells: SystolicCell[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (__, j) => ({ i, j, a: null, b: null, c: 0, product: null })),
  );
  const lastUseful = 3 * n - 2;
  const maxCycle = Math.max(0, cycle);
  for (let t = 0; t <= maxCycle; t += 1) {
    for (let i = 0; i < n; i += 1) {
      for (let j = 0; j < n; j += 1) {
        const k = t - i - j;
        const cell = cells[i]?.[j];
        const row = result[i];
        if (!cell || !row) continue;
        if (k >= 0 && k < n) {
          const av = a[i]?.[k] ?? 0;
          const bv = b[k]?.[j] ?? 0;
          const product = av * bv;
          row[j] = (row[j] ?? 0) + product;
          cell.a = av;
          cell.b = bv;
          cell.product = product;
          cell.c = row[j] ?? 0;
        } else if (t === maxCycle) {
          cell.a = null;
          cell.b = null;
          cell.product = null;
        }
      }
    }
  }
  return { cells, result, complete: maxCycle >= lastUseful };
}

export type DataflowKind = "weight" | "output" | "activation";

export function dataflow(kind: DataflowKind): {
  stays: string;
  moves: string;
  reuse: string;
  traffic: number;
  note: string;
} {
  if (kind === "weight") {
    return {
      stays: "Weights remain in the MAC array.",
      moves: "Activations stream through. Partial sums drain to output buffers.",
      reuse: "Each weight is reused across many activations.",
      traffic: 2,
      note: "Useful when the same weights serve a large batch of activations. No strategy is universally best.",
    };
  }
  if (kind === "output") {
    return {
      stays: "Partial sums stay in each processing element until the output is complete.",
      moves: "Weights and activations both stream into the array.",
      reuse: "Each output location reuses its local accumulator.",
      traffic: 3,
      note: "Useful when reducing writes of unfinished results. Choice depends on tensor shapes.",
    };
  }
  return {
    stays: "Activations remain local in the array.",
    moves: "Weights stream through. Partial sums move toward output storage.",
    reuse: "Each activation is reused against many weights.",
    traffic: 2,
    note: "Useful when the activation tile is small enough to keep on-chip. Implementation details vary.",
  };
}

export const ACCEL_LEVELS = [
  { id: "dram", name: "Off-Chip DRAM", latency: 100, bandwidth: 1, role: "Weight and activation backing store" },
  { id: "sram", name: "On-Chip SRAM", latency: 10, bandwidth: 8, role: "Activation and weight tiles" },
  { id: "regs", name: "Registers / Local Buffers", latency: 1, bandwidth: 32, role: "PE-local reuse" },
  { id: "mac", name: "MAC / Tensor Engine", latency: 1, bandwidth: 64, role: "Multiply-accumulate compute" },
] as const;

export function reuseTraffic(tile: number, reuse: number): { loads: number; compute: number; intensity: number } {
  const loads = Math.max(1, tile);
  const compute = loads * Math.max(1, reuse);
  return { loads, compute, intensity: compute / loads };
}

export type NumericFormat = "fp32" | "fp16" | "bf16" | "int8";

export function bytesPerValue(format: NumericFormat): number {
  if (format === "int8") return 1;
  if (format === "fp16" || format === "bf16") return 2;
  return 4;
}

export function roundMantissa(value: number, mantissaBits: number): number {
  if (!Number.isFinite(value) || value === 0) return value;
  const sign = value < 0 ? -1 : 1;
  const abs = Math.abs(value);
  const exp = Math.floor(Math.log2(abs));
  const scale = 2 ** (exp - mantissaBits);
  return sign * Math.round(abs / scale) * scale;
}

export function represent(value: number, format: NumericFormat, scale: number): { stored: number; recovered: number } {
  if (format === "fp32") return { stored: value, recovered: value };
  if (format === "fp16") {
    const rounded = roundMantissa(value, 10);
    return { stored: rounded, recovered: rounded };
  }
  if (format === "bf16") {
    const rounded = roundMantissa(value, 7);
    return { stored: rounded, recovered: rounded };
  }
  const q = Math.max(-128, Math.min(127, Math.round(value / scale)));
  return { stored: q, recovered: q * scale };
}

export function quantizeTensor(values: number[], format: NumericFormat): {
  format: NumericFormat;
  bytes: number;
  scale: number;
  stored: number[];
  recovered: number[];
  error: number[];
  maxError: number;
} {
  const maxAbs = Math.max(1e-12, ...values.map((value) => Math.abs(value)));
  const scale = format === "int8" ? maxAbs / 127 : 1;
  const stored: number[] = [];
  const recovered: number[] = [];
  const error: number[] = [];
  values.forEach((value) => {
    const item = represent(value, format, scale);
    stored.push(item.stored);
    recovered.push(item.recovered);
    error.push(item.recovered - value);
  });
  return {
    format,
    bytes: values.length * bytesPerValue(format),
    scale,
    stored,
    recovered,
    error,
    maxError: error.reduce((best, item) => Math.max(best, Math.abs(item)), 0),
  };
}

export function mixedPrecision(compute: NumericFormat, accum: NumericFormat): {
  storage: number;
  density: number;
  precision: string;
  use: string;
} {
  const storage = bytesPerValue(compute);
  const density = 4 / storage;
  const precision = `${compute.toUpperCase()} compute, ${accum.toUpperCase()} accumulate`;
  const use = compute === "int8"
    ? "Typical for inference when range is known."
    : compute === "fp16" || compute === "bf16"
      ? "Typical mixed-precision training or inference."
      : "Reference arithmetic and weight updates.";
  return { storage, density, precision, use };
}

export const NPU_BLOCKS = [
  { id: "controller", name: "Controller", role: "Decodes the inference request and sequences the engine." },
  { id: "dma", name: "DMA", role: "Moves tensors between DRAM and on-chip SRAM." },
  { id: "sram", name: "On-Chip SRAM", role: "Holds activation and weight tiles for reuse." },
  { id: "engine", name: "Tensor / MAC Engine", role: "Performs matrix and convolution MACs." },
  { id: "activation", name: "Activation Unit", role: "Applies ReLU or similar pointwise functions." },
  { id: "output", name: "Output Buffer", role: "Collects results before writeback." },
] as const;

export const NPU_FLOW = ["controller", "dma", "sram", "engine", "activation", "output"] as const;

export const NET_STAGES = [
  { id: "input", name: "Input" },
  { id: "dense1", name: "Dense / Conv" },
  { id: "act", name: "Activation" },
  { id: "dense2", name: "Dense" },
  { id: "output", name: "Output" },
] as const;
