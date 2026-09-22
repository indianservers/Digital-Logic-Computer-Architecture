export type MobileBlock = "P-core" | "E-core" | "GPU" | "NPU" | "ISP" | "DSP" | "Media" | "Cache" | "MC" | "Modem" | "I/O" | "PMU";

export const MOBILE_BLOCKS: Array<{ id: MobileBlock; purpose: string; data: string }> = [
  { id: "P-core", purpose: "High-performance CPU cores for latency-sensitive work.", data: "Interactive threads" },
  { id: "E-core", purpose: "Efficiency CPU cores for background and light work.", data: "Deferred tasks" },
  { id: "GPU", purpose: "Graphics and wide data-parallel shaders.", data: "Tiles, command buffers" },
  { id: "NPU", purpose: "On-device neural inference.", data: "Tensors" },
  { id: "ISP", purpose: "Camera pipeline.", data: "Raw frames" },
  { id: "DSP", purpose: "Audio and sensor streaming.", data: "Samples" },
  { id: "Media", purpose: "Video encode/decode.", data: "Bitstreams" },
  { id: "Cache", purpose: "Shared system cache.", data: "Lines" },
  { id: "MC", purpose: "LPDDR memory controller.", data: "DRAM bursts" },
  { id: "Modem", purpose: "Cellular/Wi-Fi subsystem conceptually.", data: "Packets to memory" },
  { id: "I/O", purpose: "Display, storage, sensors.", data: "Peripheral traffic" },
  { id: "PMU", purpose: "Power and thermal policy.", data: "State commands" },
];

export interface MobileWork {
  id: string;
  name: string;
  latency: boolean;
  compute: number;
  background: boolean;
  parallel: boolean;
  ai: boolean;
  recommend: MobileBlock;
  reason: string;
}

export const MOBILE_WORKS: MobileWork[] = [
  { id: "ui", name: "UI animation", latency: true, compute: 4, background: false, parallel: true, ai: false, recommend: "P-core", reason: "Latency-sensitive foreground UI." },
  { id: "sync", name: "Background sync", latency: false, compute: 2, background: true, parallel: false, ai: false, recommend: "E-core", reason: "Background, low intensity." },
  { id: "compile", name: "Compilation", latency: false, compute: 9, background: false, parallel: false, ai: false, recommend: "P-core", reason: "Burst integer work." },
  { id: "video", name: "Video playback", latency: true, compute: 6, background: false, parallel: true, ai: false, recommend: "Media", reason: "Dedicated media engine." },
  { id: "game", name: "Game logic", latency: true, compute: 8, background: false, parallel: false, ai: false, recommend: "P-core", reason: "Interactive game thread." },
  { id: "infer", name: "AI inference", latency: false, compute: 10, background: false, parallel: true, ai: true, recommend: "NPU", reason: "Tensor-heavy inference." },
];

export function autoMobile(id: string): MobileWork | undefined {
  return MOBILE_WORKS.find((item) => item.id === id);
}

export function thermal(cpu: number, gpu: number, npu: number, ambient: number): { temp: number; throttle: boolean; freq: number; migrate: boolean } {
  const temp = Math.round(ambient + cpu * 0.35 + gpu * 0.3 + npu * 0.2);
  const throttle = temp >= 85;
  return { temp, throttle, freq: throttle ? 0.7 : 1, migrate: throttle && cpu > 60 };
}

export const CAMERA_FLOW = ["Sensor", "ISP", "Memory", "NPU", "GPU / Display"];
export const MEMORY_CLIENTS = ["CPU", "GPU", "NPU", "ISP"] as const;
