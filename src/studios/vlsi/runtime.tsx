import { createContext, useContext } from "react";

export type ControlValue = number | string;

export interface ControlSpec {
  label: string;
  kind: "range" | "choice" | "bit";
  initial: ControlValue;
  min?: number;
  max?: number;
  options?: string[];
  get: () => ControlValue;
  set: (value: ControlValue) => void;
}

export interface ControlEntry extends ControlSpec {
  key: string;
}

export interface PlayerSpec {
  isPlaying: () => boolean;
  toggle: () => void;
  step: () => void;
}

export type Snapshot = Record<string, ControlValue>;

export function paramName(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9µα]+/g, "-").replace(/^-|-$/g, "") || "c";
}

function clamp(value: number, min = -Infinity, max = Infinity) {
  return Math.min(max, Math.max(min, value));
}

function tidy(value: ControlValue): string {
  return typeof value === "number" ? String(Number(value.toPrecision(6))) : value;
}

export class LabRuntime {
  readonly slug: string;
  readonly linked = new Set<string>();
  takeaway = "";
  interacted = false;
  private readonly controls = new Map<string, ControlEntry>();
  private readonly players = new Set<PlayerSpec>();
  private readonly onTouch: () => void;
  private readonly onMeasure: (label: string, text: string) => void;

  constructor(slug: string, onTouch: () => void, onMeasure: (label: string, text: string) => void) {
    this.slug = slug;
    this.onTouch = onTouch;
    this.onMeasure = onMeasure;
  }

  register(spec: ControlSpec): { key: string; unregister: () => void } {
    let key = spec.label;
    for (let index = 2; this.controls.has(key); index += 1) key = `${spec.label} ${index}`;
    this.controls.set(key, { ...spec, key });
    this.onTouch();
    return {
      key,
      unregister: () => {
        this.controls.delete(key);
        this.linked.delete(key);
        this.onTouch();
      },
    };
  }

  update(key: string, spec: ControlSpec) {
    const entry = this.controls.get(key);
    if (entry) this.controls.set(key, { ...spec, key, initial: entry.initial });
  }

  entries(): ControlEntry[] {
    return [...this.controls.values()];
  }

  initialOf(key: string): ControlValue | undefined {
    return this.controls.get(key)?.initial;
  }

  changedCount(): number {
    return this.entries().filter((entry) => !same(entry.get(), entry.initial)).length;
  }

  emit(key: string, next: ControlValue) {
    const entry = this.controls.get(key);
    if (!entry) return;
    const prev = entry.get();
    this.interacted = true;
    if (entry.kind === "range" && this.linked.has(key) && typeof prev === "number" && typeof next === "number" && prev !== 0) {
      const ratio = next / prev;
      for (const otherKey of this.linked) {
        if (otherKey === key) continue;
        const other = this.controls.get(otherKey);
        const value = other?.get();
        if (other && typeof value === "number") other.set(clamp(value * ratio, other.min, other.max));
      }
    }
    entry.set(next);
    this.onTouch();
  }

  resetControl(key: string) {
    const entry = this.controls.get(key);
    if (entry) this.emit(key, entry.initial);
  }

  toggleLink(key: string) {
    if (this.linked.has(key)) this.linked.delete(key);
    else this.linked.add(key);
    this.onTouch();
  }

  snapshot(): Snapshot {
    const out: Snapshot = {};
    for (const entry of this.controls.values()) out[entry.key] = entry.get();
    return out;
  }

  apply(values: Snapshot, markInteracted = true) {
    for (const [key, raw] of Object.entries(values)) {
      const entry = this.controls.get(key);
      if (!entry) continue;
      const value = coerce(entry, raw);
      if (value !== undefined) entry.set(value);
    }
    if (markInteracted) this.interacted = true;
    this.onTouch();
  }

  applyParams(params: URLSearchParams) {
    const values: Snapshot = {};
    for (const entry of this.controls.values()) {
      const raw = params.get(paramName(entry.key));
      if (raw !== null) values[entry.key] = raw;
    }
    if (Object.keys(values).length > 0) this.apply(values, false);
  }

  toParams(): URLSearchParams {
    const params = new URLSearchParams();
    for (const entry of this.controls.values()) {
      const value = entry.get();
      if (!same(value, entry.initial)) params.set(paramName(entry.key), tidy(value));
    }
    return params;
  }

  addPlayer(player: PlayerSpec): () => void {
    this.players.add(player);
    this.onTouch();
    return () => {
      this.players.delete(player);
      this.onTouch();
    };
  }

  hasPlayer(): boolean {
    return this.players.size > 0;
  }

  isPlaying(): boolean {
    return [...this.players].some((player) => player.isPlaying());
  }

  togglePlay(): boolean {
    const first = [...this.players][0];
    if (!first) return false;
    first.toggle();
    this.interacted = true;
    this.onTouch();
    return true;
  }

  step(): boolean {
    const first = [...this.players][0];
    if (!first) return false;
    first.step();
    this.interacted = true;
    this.onTouch();
    return true;
  }

  touch() {
    this.onTouch();
  }

  reportMeasure(label: string, text: string) {
    this.onMeasure(label, text);
  }
}

function same(a: ControlValue, b: ControlValue): boolean {
  if (typeof a === "number" && typeof b === "number") return Math.abs(a - b) <= Math.max(1e-12, Math.abs(b) * 1e-9);
  return a === b;
}

function coerce(entry: ControlEntry, raw: ControlValue): ControlValue | undefined {
  if (entry.kind === "choice") {
    const text = String(raw);
    return !entry.options || entry.options.includes(text) ? text : undefined;
  }
  const value = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(value)) return undefined;
  if (entry.kind === "bit") return value >= 0.5 ? 1 : 0;
  return clamp(value, entry.min, entry.max);
}

export const RuntimeContext = createContext<LabRuntime | null>(null);

export interface RuntimeState {
  version: number;
  interacted: boolean;
  playing: boolean;
}

export const RuntimeStateContext = createContext<RuntimeState>({ version: 0, interacted: false, playing: false });

export function useLabRuntime(): LabRuntime | null {
  return useContext(RuntimeContext);
}

export function useRuntimeState(): RuntimeState {
  return useContext(RuntimeStateContext);
}
