import { createContext, useContext, useEffect, useId, useMemo, useRef, useSyncExternalStore, type ReactNode } from "react";
import { evidenceValue, type SimulatorEvidence } from "./experimentEvidence";

type Source = { name: string; version: string; read: () => unknown; active?: () => boolean };
export class SimulatorRegistry {
  private sources = new Map<string, Source>();
  private listeners = new Set<() => void>();
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  count = () => this.sources.size;
  register(id: string, source: Source) {
    this.sources.set(id, source); this.listeners.forEach(listener => listener());
    return () => { if (this.sources.get(id) === source) { this.sources.delete(id); this.listeners.forEach(listener => listener()); } };
  }
  capture(route: string, root: HTMLElement | null): SimulatorEvidence {
    const budget = { remaining: 18000, truncated: false };
    const sources = [...this.sources.values()].filter(source => source.active?.() !== false).sort((a, b) => a.name.localeCompare(b.name)).map(source => {
      try { return { name: source.name, version: source.version, state: evidenceValue(source.read(), budget) }; }
      catch { return { name: source.name, version: source.version, state: "Capture unavailable" }; }
    });
    const controls = root ? [...root.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input,select,textarea")]
      .filter(el => !["password", "file", "search", "hidden"].includes(el.type) && !el.disabled && !el.closest("[hidden],[inert]"))
      .slice(0, 200).map(el => ({
        label: el.getAttribute("aria-label") || el.labels?.[0]?.textContent?.trim().slice(0, 200) || el.name || el.id || el.type,
        value: el instanceof HTMLInputElement && ["checkbox", "radio"].includes(el.type) ? String(el.checked) : el.value.slice(0, 16000),
      })) : [];
    // Only clone at capture time: no observers or snapshot serialization in the simulation loop.
    const text = root?.innerText ?? "";
    return { version: 1, route, capturedAt: new Date().toISOString(), sources, controls, readouts: text.slice(0, 24000), truncated: budget.truncated || text.length > 24000 };
  }
}
const CaptureContext = createContext<SimulatorRegistry | null>(null);
const ActiveCaptureContext = createContext(true);
export function SimulatorCaptureScope({ active, children }: { active: boolean; children: ReactNode }) {
  const parentActive = useContext(ActiveCaptureContext);
  return <ActiveCaptureContext.Provider value={active && parentActive}>{children}</ActiveCaptureContext.Provider>;
}
export function SimulatorCaptureProvider({ children }: { children: ReactNode }) {
  const registry = useMemo(() => new SimulatorRegistry(), []);
  return <CaptureContext.Provider value={registry}>{children}</CaptureContext.Provider>;
}
/** Register a lazy reader of committed engine state; capture never runs or resets the engine. */
export function useSimulatorCapture(name: string, read: () => unknown, version = "1") {
  const registry = useContext(CaptureContext), active = useContext(ActiveCaptureContext), id = useId(), reader = useRef(read), enabled = useRef(active);
  useEffect(() => { reader.current = read; enabled.current = active; });
  useEffect(() => registry?.register(id, { name, version, read: () => reader.current(), active: () => enabled.current }), [registry, id, name, version]);
}
export function useCaptureSimulator() {
  const registry = useContext(CaptureContext);
  return (route: string) => (registry ?? new SimulatorRegistry()).capture(route, document.getElementById("studio-simulator-content"));
}
const noSubscribe = () => () => {};
const zero = () => 0;
export function useSimulatorSourceCount() {
  const registry = useContext(CaptureContext);
  return useSyncExternalStore(registry?.subscribe ?? noSubscribe, registry?.count ?? zero, zero);
}
