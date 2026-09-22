export type Processor = "CPU" | "GPU" | "NPU" | "DSP";

export const PROCESSOR_ROLES: Record<Processor, { strengths: string[]; typical: string }> = {
  CPU: {
    strengths: ["Control-heavy work", "Serial and general-purpose code", "Operating-system tasks"],
    typical: "Branchy logic, scheduling, and orchestration.",
  },
  GPU: {
    strengths: ["Highly parallel arithmetic", "Graphics pipelines", "Large vector workloads"],
    typical: "Data-parallel kernels with regular control flow.",
  },
  NPU: {
    strengths: ["Neural inference", "Tensor / MAC arrays", "Quantized matrix work"],
    typical: "Dense and convolution layers once weights are loaded.",
  },
  DSP: {
    strengths: ["Signal processing", "Audio filtering", "Fixed-rate streaming"],
    typical: "FIR/IIR filters and sample-by-sample transforms.",
  },
};

export interface Workload {
  id: string;
  name: string;
  kind: "control" | "graphics" | "tensor" | "signal" | "parallel" | "serial";
  recommended: Processor;
  reason: string;
  parallelism: number;
  latencySensitive: boolean;
  compute: number;
}

export const WORKLOADS: Workload[] = [
  { id: "ui", name: "UI logic", kind: "control", recommended: "CPU", reason: "control-heavy serial work", parallelism: 1, latencySensitive: true, compute: 2 },
  { id: "audio", name: "Audio processing", kind: "signal", recommended: "DSP", reason: "fixed-rate signal filtering", parallelism: 2, latencySensitive: true, compute: 4 },
  { id: "infer", name: "Neural inference", kind: "tensor", recommended: "NPU", reason: "high tensor-operation intensity", parallelism: 8, latencySensitive: false, compute: 12 },
  { id: "matmul", name: "Matrix multiplication", kind: "tensor", recommended: "NPU", reason: "dense MAC array mapping", parallelism: 8, latencySensitive: false, compute: 10 },
  { id: "compress", name: "Background compression", kind: "serial", recommended: "CPU", reason: "irregular bit-level control", parallelism: 2, latencySensitive: false, compute: 5 },
  { id: "render", name: "Graphics rendering", kind: "graphics", recommended: "GPU", reason: "wide data-parallel shading", parallelism: 16, latencySensitive: true, compute: 14 },
  { id: "image", name: "Image processing", kind: "parallel", recommended: "GPU", reason: "regular pixel-parallel filters", parallelism: 12, latencySensitive: false, compute: 8 },
  { id: "control", name: "Control logic", kind: "control", recommended: "CPU", reason: "branchy decision making", parallelism: 1, latencySensitive: true, compute: 2 },
];

export function workloadById(id: string): Workload | undefined {
  return WORKLOADS.find((item) => item.id === id);
}

export function autoRoute(id: string): { unit: Processor; reason: string } {
  const work = workloadById(id);
  if (!work) return { unit: "CPU", reason: "unknown workload defaults to the general-purpose CPU" };
  return { unit: work.recommended, reason: work.reason };
}

export interface Assignment {
  id: string;
  unit: Processor;
}

export interface QueueSnapshot {
  unit: Processor;
  jobs: string[];
  time: number;
  energy: number;
  utilization: number;
}

const MATCH: Record<Processor, Record<Workload["kind"], number>> = {
  CPU: { control: 1, serial: 1.1, graphics: 3, tensor: 4, signal: 2, parallel: 2.2 },
  GPU: { control: 4, serial: 3.5, graphics: 0.6, tensor: 1.2, signal: 1.6, parallel: 0.7 },
  NPU: { control: 5, serial: 4, graphics: 3, tensor: 0.5, signal: 2.5, parallel: 1.4 },
  DSP: { control: 3, serial: 2, graphics: 4, tensor: 2.8, signal: 0.55, parallel: 1.8 },
};

export function estimate(work: Workload, unit: Processor): { time: number; energy: number } {
  const factor = MATCH[unit][work.kind];
  const time = Math.max(1, Math.round(work.compute * factor));
  const energy = Math.max(1, Math.round(time * (unit === "CPU" ? 1.2 : unit === "GPU" ? 1.6 : unit === "NPU" ? 0.7 : 0.9)));
  return { time, energy };
}

export function schedule(assignments: Assignment[]): QueueSnapshot[] {
  const units: Processor[] = ["CPU", "GPU", "NPU", "DSP"];
  return units.map((unit) => {
    const jobs = assignments.filter((item) => item.unit === unit);
    let time = 0;
    let energy = 0;
    const names: string[] = [];
    jobs.forEach((job) => {
      const work = workloadById(job.id);
      if (!work) return;
      const cost = estimate(work, unit);
      time += cost.time;
      energy += cost.energy;
      names.push(work.name);
    });
    return { unit, jobs: names, time, energy, utilization: Math.min(100, time * 6) };
  });
}

export const CAMERA_TASKS: Workload[] = [
  { id: "cam-ui", name: "UI", kind: "control", recommended: "CPU", reason: "interactive control", parallelism: 1, latencySensitive: true, compute: 2 },
  { id: "cam-ctrl", name: "Camera control", kind: "control", recommended: "CPU", reason: "device sequencing", parallelism: 1, latencySensitive: true, compute: 2 },
  { id: "cam-isp", name: "Image signal processing", kind: "parallel", recommended: "DSP", reason: "pipeline filtering", parallelism: 6, latencySensitive: true, compute: 7 },
  { id: "cam-detect", name: "Object detection", kind: "tensor", recommended: "NPU", reason: "neural inference", parallelism: 8, latencySensitive: false, compute: 11 },
  { id: "cam-render", name: "Image rendering", kind: "graphics", recommended: "GPU", reason: "compositing and display", parallelism: 10, latencySensitive: true, compute: 8 },
  { id: "cam-audio", name: "Audio", kind: "signal", recommended: "DSP", reason: "microphone filtering", parallelism: 2, latencySensitive: true, compute: 3 },
  { id: "cam-file", name: "File compression", kind: "serial", recommended: "CPU", reason: "codec control loop", parallelism: 2, latencySensitive: false, compute: 5 },
];

export function offload(payloadWords: number, acceleratorCycles: number): {
  setup: number;
  transfer: number;
  compute: number;
  total: number;
  cpuOnly: number;
  transferDominates: boolean;
} {
  const setup = 4;
  const transfer = Math.max(0, payloadWords) * 2;
  const compute = Math.max(0, acceleratorCycles);
  const total = setup + transfer + compute;
  const cpuOnly = Math.max(1, payloadWords) * 3 + compute * 4;
  return { setup, transfer, compute, total, cpuOnly, transferDominates: transfer > compute };
}

export type MemoryModel = "separate" | "unified";

export function memoryModel(kind: MemoryModel): { left: string; right: string; copy: boolean; note: string } {
  if (kind === "separate") {
    return {
      left: "CPU Memory",
      right: "GPU Memory",
      copy: true,
      note: "A copy moves the buffer before the accelerator can use it. Implementation details vary widely.",
    };
  }
  return {
    left: "Shared addressable memory",
    right: "CPU ↔ GPU",
    copy: false,
    note: "Both processors can name the same addresses. Coherence and paging behavior still differ by platform.",
  };
}

export interface Packet {
  id: string;
  from: Processor;
  size: number;
}

export function interconnect(packets: Packet[]): { total: number; contention: boolean; shares: Record<Processor, number> } {
  const shares: Record<Processor, number> = { CPU: 0, GPU: 0, NPU: 0, DSP: 0 };
  let total = 0;
  packets.forEach((packet) => {
    shares[packet.from] += packet.size;
    total += packet.size;
  });
  return { total, contention: packets.length > 1, shares };
}

export type SyncPhase = "run" | "complete" | "fence" | "next";

export function syncTimeline(): Array<{ phase: SyncPhase; actor: Processor; text: string }> {
  return [
    { phase: "run", actor: "GPU", text: "GPU finishes a frame." },
    { phase: "complete", actor: "GPU", text: "Completion signal is posted." },
    { phase: "fence", actor: "CPU", text: "CPU waits on the fence / event." },
    { phase: "next", actor: "CPU", text: "CPU submits the next task." },
  ];
}
