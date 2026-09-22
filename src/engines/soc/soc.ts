import { accessCache, createCache, type CacheMachine } from "../cache/cache";
import { L1_PRESET } from "../arch/hierarchy";

export interface SocBlock {
  id: string;
  name: string;
  purpose: string;
  paths: string[];
  data: string;
}

export const SOC_BLOCKS: SocBlock[] = [
  { id: "cpu", name: "CPU cluster", purpose: "General-purpose control and OS work.", paths: ["interconnect", "cache", "npu"], data: "Instructions, page tables, task state" },
  { id: "gpu", name: "GPU", purpose: "Parallel shading and wide vector kernels.", paths: ["interconnect", "cache", "display"], data: "Tiles, textures, command buffers" },
  { id: "npu", name: "NPU", purpose: "Tensor inference with a MAC array.", paths: ["interconnect", "cache", "isp"], data: "Weights, activations" },
  { id: "dsp", name: "DSP", purpose: "Streaming signal and audio filters.", paths: ["interconnect", "io"], data: "PCM samples, filter coefficients" },
  { id: "isp", name: "ISP", purpose: "Camera pipeline: demosaic, denoise, color.", paths: ["npu", "cache", "display"], data: "Raw Bayer frames" },
  { id: "mc", name: "Memory controller", purpose: "Schedules DRAM transactions.", paths: ["cache", "interconnect"], data: "Cache-line fills and writebacks" },
  { id: "cache", name: "System cache", purpose: "Shared last-level buffer for SoC clients.", paths: ["cpu", "gpu", "npu", "isp", "mc"], data: "Shared lines" },
  { id: "io", name: "I/O", purpose: "Peripheral and storage endpoints.", paths: ["interconnect", "codec"], data: "USB, flash, sensors" },
  { id: "codec", name: "Media codec", purpose: "Video encode and decode.", paths: ["cache", "display", "io"], data: "Compressed bitstreams" },
  { id: "sec", name: "Security engine", purpose: "Key storage and cryptographic offload. Educational block only.", paths: ["cpu", "interconnect"], data: "Keys, sealed blobs" },
  { id: "display", name: "Display engine", purpose: "Composes frames for the panel.", paths: ["gpu", "isp", "codec"], data: "Scanout buffers" },
  { id: "interconnect", name: "Interconnect / NoC", purpose: "Routes packets among blocks.", paths: ["cpu", "gpu", "npu", "dsp", "mc"], data: "Request and response packets" },
  { id: "pmu", name: "Power management", purpose: "Clock and power-domain control.", paths: ["cpu", "gpu", "codec"], data: "Power-state commands" },
];

export function blockById(id: string): SocBlock | undefined {
  return SOC_BLOCKS.find((item) => item.id === id);
}

export type FlowId = "camera" | "video" | "ai";

export const SOC_FLOWS: Record<FlowId, { title: string; steps: string[] }> = {
  camera: { title: "Camera Capture", steps: ["isp", "cache", "npu", "gpu", "display"] },
  video: { title: "Video Playback", steps: ["io", "codec", "cache", "display"] },
  ai: { title: "AI Camera", steps: ["isp", "npu", "cpu", "display"] },
};

export type Point = { r: number; c: number };

export function manhattan(a: Point, b: Point): number {
  return Math.abs(a.r - b.r) + Math.abs(a.c - b.c);
}

export function shortestPath(src: Point, dst: Point): Point[] {
  const path: Point[] = [{ ...src }];
  let r = src.r;
  let c = src.c;
  while (r !== dst.r) {
    r += r < dst.r ? 1 : -1;
    path.push({ r, c });
  }
  while (c !== dst.c) {
    c += c < dst.c ? 1 : -1;
    path.push({ r, c });
  }
  return path;
}

export function linksOf(path: Point[]): string[] {
  const links: string[] = [];
  for (let index = 1; index < path.length; index += 1) {
    const a = path[index - 1];
    const b = path[index];
    if (!a || !b) continue;
    const key = a.r === b.r
      ? `h:${a.r}:${Math.min(a.c, b.c)}`
      : `v:${Math.min(a.r, b.r)}:${a.c}`;
    links.push(key);
  }
  return links;
}

export function contention(paths: Point[][]): { busy: string[]; contested: boolean } {
  const counts = new Map<string, number>();
  paths.forEach((path) => {
    linksOf(path).forEach((link) => counts.set(link, (counts.get(link) ?? 0) + 1));
  });
  const busy = [...counts.entries()].filter((entry) => entry[1] > 1).map((entry) => entry[0]);
  return { busy, contested: busy.length > 0 };
}

export type SocClient = "CPU" | "GPU" | "NPU" | "ISP";

export interface SystemCacheLab {
  cache: CacheMachine;
  last: "hit" | "miss";
  dram: boolean;
  client: SocClient;
}

export function createSystemCache(): CacheMachine {
  return createCache({ ...L1_PRESET, associativity: 2, cacheBytes: 32 });
}

export function clientAccess(cache: CacheMachine, client: SocClient, address: number): SystemCacheLab {
  const next = accessCache(cache, address, "read");
  return { cache: next.machine, last: next.result.hit ? "hit" : "miss", dram: !next.result.hit, client };
}

export type PowerState = "Active" | "Idle" | "Clock Gated" | "Power Gated";
export type ClockDomain = "CPU" | "GPU" | "Media" | "Always-on";

export const DOMAIN_BLOCKS: Record<ClockDomain, string[]> = {
  CPU: ["cpu", "cache"],
  GPU: ["gpu"],
  Media: ["isp", "codec", "display"],
  "Always-on": ["pmu", "io", "sec"],
};

export function nextPower(state: PowerState): PowerState {
  if (state === "Active") return "Idle";
  if (state === "Idle") return "Clock Gated";
  if (state === "Clock Gated") return "Power Gated";
  return "Active";
}
