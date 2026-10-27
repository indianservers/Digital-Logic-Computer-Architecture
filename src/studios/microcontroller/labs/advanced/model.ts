import type { ThumbCpu } from "../g1/thumb";

export type Params = Record<string, number | string | boolean>;
export interface Event { t: number; event: string; detail: string }
export interface Sample { t: number; channels: number[] }
export interface Job { id: number; task: number; released: number; deadline: number; remaining: number; missed: boolean }
export interface Simulation {
  time: number;
  values: Record<string, number>;
  memory: number[];
  events: Event[];
  samples: Sample[];
  jobs: Job[];
  phase: string;
  finished: boolean;
  cpu?: ThumbCpu;
}
export interface Control { key: string; label: string; type: "range" | "number" | "select" | "toggle"; min?: number; max?: number; step?: number; unit?: string; options?: string[]; live?: boolean }
export interface Readout { label: string; value: string | number; unit?: string }
export interface Check { label: string; passed: boolean; why: string }
export interface Model {
  number: number;
  subtitle: string;
  objective: string;
  defaults: Params;
  controls: Control[];
  stepMs: number;
  plots: Array<{ label: string; min: number; max: number; unit?: string }>;
  create: (params: Params, source?: string) => Simulation;
  step: (state: Simulation, params: Params, ms: number) => Simulation;
  action?: (state: Simulation, params: Params, action: string) => Simulation;
  actions?: Array<{ id: string; label: string }>;
  metrics: (state: Simulation, params: Params) => Readout[];
  checks: (state: Simulation, params: Params) => Check[];
  guide: string[];
  expected: string;
  equation: string;
  limitation: string;
  presets: Array<{ label: string; params: Params }>;
  source?: string;
}
export const num = (p: Params, key: string) => Number(p[key]);
export const yes = (p: Params, key: string) => p[key] === true;
export const base = (values: Record<string, number> = {}, memory: number[] = []): Simulation => ({ time: 0, values, memory, events: [], samples: [], jobs: [], phase: "Ready", finished: false });
export const copy = (s: Simulation): Simulation => ({ ...s, values: { ...s.values }, memory: [...s.memory], events: [...s.events], samples: [...s.samples], jobs: s.jobs.map((job) => ({ ...job })) });
export function event(s: Simulation, name: string, detail: string) { s.events.push({ t: s.time, event: name, detail }); if (s.events.length > 100) s.events.splice(0, s.events.length - 100); }
export function sample(s: Simulation, ...channels: number[]) { s.samples.push({ t: s.time, channels }); if (s.samples.length > 512) s.samples.splice(0, s.samples.length - 512); }
export function milliseconds(s: Simulation, p: Params, ms: number, fn: (state: Simulation, params: Params) => void): Simulation {
  const out = copy(s);
  for (let i = 0; i < Math.round(ms) && !out.finished; i++) { fn(out, p); out.time += 1; }
  return out;
}
export const range = (key: string, label: string, min: number, max: number, step = 1, unit = "", live = false): Control => ({ key, label, type: "range", min, max, step, unit, live });
export const toggle = (key: string, label: string, live = false): Control => ({ key, label, type: "toggle", live });
export const select = (key: string, label: string, options: string[], live = false): Control => ({ key, label, type: "select", options, live });
export const check = (label: string, passed: boolean, why: string): Check => ({ label, passed, why });
export const metric = (label: string, value: string | number, unit?: string): Readout => ({ label, value, unit });
export const hex = (n: number, digits = 2) => `0x${(n >>> 0).toString(16).toUpperCase().padStart(digits, "0")}`;
export function sanitizeParams(model: Model, raw: unknown): Params {
  const values = raw && typeof raw === "object" ? raw as Params : {};
  return Object.fromEntries(Object.entries(model.defaults).map(([key, fallback]) => {
    const control = model.controls.find((item) => item.key === key), value = values[key];
    if (typeof fallback === "boolean") return [key, typeof value === "boolean" ? value : fallback];
    if (typeof fallback === "string") return [key, typeof value === "string" && (!control?.options || control.options.includes(value)) ? value : fallback];
    const n = typeof value === "number" && Number.isFinite(value) ? value : fallback;
    const clamped = Math.max(control?.min ?? -Infinity, Math.min(control?.max ?? Infinity, n));
    const step = control?.step ?? 1, origin = control?.min ?? 0;
    const snapped = origin + Math.round((clamped - origin) / step) * step;
    return [key, Number(snapped.toFixed(9))];
  }));
}
