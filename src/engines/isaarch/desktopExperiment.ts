/** Generic educational package model; parameters are assumptions, not vendor measurements. */
export const DESKTOP_MODEL_VERSION = "desktop-package-1";
export const DESKTOP_JOBS = [
  { id: "single", name: "Single-thread", threads: 1, load: 100, gpu: 0, bytes: 8 },
  { id: "render", name: "CPU rendering", threads: 16, load: 100, gpu: 0, bytes: 8 },
  { id: "game", name: "CPU + integrated GPU", threads: 8, load: 75, gpu: 85, bytes: 16 },
  { id: "memory", name: "Memory streaming", threads: 16, load: 100, gpu: 0, bytes: 128 },
  { id: "idle", name: "Idle", threads: 1, load: 0, gpu: 0, bytes: 8 },
] as const;
export interface DesktopConfig {
  workload: string; cores: number; threads: number; load: number; gpu: number; bytes: number;
  smt: boolean; bandwidth: number; sustained: number; burst: number; burstSeconds: number;
  ambient: number; resistance: number; capacitance: number; fan: number; thermalLimit: number; maxGHz: number;
}
export const DESKTOP_DEFAULTS: DesktopConfig = {
  workload: "render", cores: 8, threads: 16, load: 100, gpu: 0, bytes: 8, smt: true,
  bandwidth: 40, sustained: 65, burst: 125, burstSeconds: 10,
  ambient: 25, resistance: 0.55, capacitance: 60, fan: 70, thermalLimit: 90, maxGHz: 5,
};
export interface DesktopSample {
  time: number; temperature: number; frequency: number; power: number; cpuPower: number; gpuPower: number;
  uncorePower: number; leakage: number; throughput: number; bandwidth: number; utilization: number;
  activeCores: number; powerLimit: number; memoryLimited: boolean; powerLimited: boolean; thermalLimited: boolean;
}
export interface DesktopState {
  time: number; temperature: number; energy: number; work: number;
  sample: DesktopSample; samples: DesktopSample[]; applied: DesktopConfig;
}
const clamp = (value: number, min: number, max: number, fallback: number) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : fallback));
export function desktopConfig(c: DesktopConfig): DesktopConfig {
  const d = DESKTOP_DEFAULTS;
  const sustained = clamp(c.sustained, 15, 250, d.sustained);
  return {
    workload: typeof c.workload === "string" ? c.workload : "custom",
    cores: Math.round(clamp(c.cores, 1, 16, d.cores)), threads: Math.round(clamp(c.threads, 1, 32, d.threads)),
    load: clamp(c.load, 0, 100, d.load), gpu: clamp(c.gpu, 0, 100, d.gpu), bytes: clamp(c.bytes, 1, 256, d.bytes),
    smt: !!c.smt, bandwidth: clamp(c.bandwidth, 5, 120, d.bandwidth),
    sustained, burst: clamp(c.burst, sustained, 300, Math.max(sustained, d.burst)), burstSeconds: clamp(c.burstSeconds, 0, 60, d.burstSeconds),
    ambient: clamp(c.ambient, 10, 45, d.ambient), resistance: clamp(c.resistance, 0.15, 1.5, d.resistance),
    capacitance: clamp(c.capacitance, 10, 200, d.capacitance), fan: clamp(c.fan, 20, 100, d.fan),
    thermalLimit: clamp(c.thermalLimit, 60, 105, d.thermalLimit), maxGHz: clamp(c.maxGHz, 1, 6, d.maxGHz),
  };
}
export function desktopJob(c: DesktopConfig, id: string): DesktopConfig {
  const job = DESKTOP_JOBS.find(j => j.id === id);
  return job ? desktopConfig({ ...c, workload: id, threads: job.threads, load: job.load, gpu: job.gpu, bytes: job.bytes }) : c;
}
export function thermalResistance(c: DesktopConfig) { return c.resistance / (0.4 + 0.6 * c.fan / 100); }
export function desktopOperatingPoint(c: DesktopConfig, time: number, temperature: number): DesktopSample {
  const active = c.load > 0 ? Math.min(c.cores, c.threads) : 0;
  const smt = c.smt ? 1 + Math.min(1, Math.max(0, (c.threads - active) / Math.max(1, active))) * 0.2 : 1;
  const limit = time < c.burstSeconds ? c.burst : c.sustained;
  const thermalCap = Math.max(0.4, c.maxGHz * Math.min(1, Math.max(0.08, 1 - Math.max(0, temperature - (c.thermalLimit - 5)) * 0.15)));
  function point(frequency: number, activity = 1) {
    const cpuRate = 250 * active * frequency * smt * (c.load / 100) * activity;
    const memoryRate = c.bandwidth * 1000 / c.bytes;
    const throughput = Math.min(cpuRate, memoryRate);
    const memoryLimited = cpuRate > memoryRate + 1e-8;
    const utilization = c.load / 100 * activity * (cpuRate > 0 ? 0.35 + 0.65 * throughput / cpuRate : 0);
    const voltage = 0.65 + frequency * 0.1;
    const cpuPower = 3.5 * active * frequency * voltage * voltage * utilization;
    const gpuPower = 40 * c.gpu / 100 * activity;
    const bandwidth = throughput * c.bytes / 1000;
    const uncorePower = 6 + bandwidth * 0.18;
    const leakage = 2 + Math.max(0, temperature - c.ambient) * 0.08;
    return { frequency: active || c.gpu > 0 ? frequency : 0, cpuPower, gpuPower, uncorePower, leakage,
      power: cpuPower + gpuPower + uncorePower + leakage, throughput, bandwidth, utilization, memoryLimited };
  }
  let low = 0.4, high = thermalCap;
  for (let i = 0; i < 32; i++) { const mid = (low + high) / 2; if (point(mid).power <= limit) low = mid; else high = mid; }
  let result = point(low);
  if (result.power > limit) {
    let a = 0, b = 1;
    for (let i = 0; i < 32; i++) { const mid = (a + b) / 2; if (point(0.4, mid).power <= limit) a = mid; else b = mid; }
    result = point(0.4, a);
  }
  return { ...result, time, temperature, activeCores: active, powerLimit: limit,
    powerLimited: point(thermalCap).power > limit + 1e-5, thermalLimited: thermalCap < c.maxGHz - 1e-5 };
}
export function initialDesktop(config: DesktopConfig): DesktopState {
  const c = desktopConfig(config), sample = desktopOperatingPoint(c, 0, c.ambient);
  return { time: 0, temperature: c.ambient, energy: 0, work: 0, sample, samples: [sample], applied: c };
}
export function advanceDesktop(state: DesktopState, config: DesktopConfig, seconds: number): DesktopState {
  const c = desktopConfig(config), duration = clamp(seconds, 0, 600, 0);
  if (!duration) return state;
  let time = state.time, temperature = state.temperature, energy = state.energy, work = state.work;
  const samples = state.samples.slice(), end = Number((time + duration).toFixed(6)), resistance = thermalResistance(c);
  while (time < end - 1e-8) {
    const dt = Math.min(0.1, end - time);
    const operating = desktopOperatingPoint(c, time, temperature);
    const decay = Math.exp(-dt / (resistance * c.capacitance));
    temperature = c.ambient + (temperature - c.ambient) * decay + operating.power * resistance * (1 - decay);
    energy += operating.power * dt; work += operating.throughput * dt;
    time = Number((time + dt).toFixed(6));
    samples.push({ ...operating, time, temperature });
  }
  return { time, temperature, energy, work, sample: samples[samples.length - 1]!, samples: samples.slice(-1200), applied: c };
}
