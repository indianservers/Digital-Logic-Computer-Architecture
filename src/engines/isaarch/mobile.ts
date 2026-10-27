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

export interface ThermalParameters {
  ambient: number; junctionCapacity: number; caseCapacity: number;
  junctionResistance: number; ambientResistance: number; limit: number; hysteresis: number;
}
export interface ThermalState { time: number; junction: number; enclosure: number; power: number; energy: number; throttle: boolean; frequency: number }
export interface ThermalLoad { cpu: number; gpu: number; npu: number }
export type ThermalProfile = "sustained" | "burst" | "cooldown";
export const THERMAL_DEFAULTS: ThermalParameters = { ambient: 25, junctionCapacity: 8, caseCapacity: 45, junctionResistance: 3, ambientResistance: 7, limit: 80, hysteresis: 5 };
export const initialThermal = (ambient: number): ThermalState => ({ time: 0, junction: ambient, enclosure: ambient, power: 0, energy: 0, throttle: false, frequency: 1 });
export function profileLoad(load: ThermalLoad, time: number, profile: ThermalProfile): ThermalLoad {
  const scale = profile === "burst" ? (time % 60 < 15 ? 1 : 0.05) : profile === "cooldown" && time >= 120 ? 0 : 1;
  return { cpu: load.cpu * scale, gpu: load.gpu * scale, npu: load.npu * scale };
}
/** Two lumped heat capacities: Cj dTj/dt=P-(Tj-Tc)/Rjc; Cc dTc/dt=(Tj-Tc)/Rjc-(Tc-Ta)/Rca.
 * Generic assumed coefficients, not calibrated to a handset. Small substeps keep integration stable.
 */
export function stepThermal(state: ThermalState, load: ThermalLoad, parameters: ThermalParameters, seconds = 1, profile: ThermalProfile = "sustained"): ThermalState {
  if (!Number.isFinite(seconds) || seconds < 0 || seconds > 3600 || !Object.values(parameters).every(Number.isFinite)
    || parameters.junctionCapacity <= 0 || parameters.caseCapacity <= 0 || parameters.junctionResistance <= 0 || parameters.ambientResistance <= 0 || parameters.hysteresis < 0) throw new RangeError("Invalid thermal parameters or time step");
  let next = { ...state };
  const steps = Math.ceil(seconds / Math.min(0.1, parameters.junctionCapacity * parameters.junctionResistance / 10, parameters.caseCapacity * parameters.ambientResistance / 10));
  const dt = seconds / Math.max(1, steps);
  for (let i = 0; i < steps; i++) {
    const active = profileLoad(load, next.time, profile);
    const throttle = next.throttle ? next.junction > parameters.limit - parameters.hysteresis : next.junction >= parameters.limit;
    const frequency = throttle ? 0.55 : 1;
    const utilization = (value: number) => Math.min(100, Math.max(0, value)) / 100;
    const dynamic = 5 * utilization(active.cpu) + 6 * utilization(active.gpu) + 3 * utilization(active.npu);
    const power = 0.4 + dynamic * frequency ** 3;
    const toCase = (next.junction - next.enclosure) / parameters.junctionResistance;
    const toAir = (next.enclosure - parameters.ambient) / parameters.ambientResistance;
    next = { time: next.time + dt, junction: next.junction + (power - toCase) * dt / parameters.junctionCapacity,
      enclosure: next.enclosure + (toCase - toAir) * dt / parameters.caseCapacity, power, energy: next.energy + power * dt, throttle, frequency };
  }
  return next;
}
