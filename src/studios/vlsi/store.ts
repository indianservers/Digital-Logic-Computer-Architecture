import { useCallback, useSyncExternalStore } from "react";
import type { Preset } from "./content";

interface Store<T> {
  get: () => T;
  set: (next: T) => void;
  subscribe: (listener: () => void) => () => void;
}

function createStore<T>(key: string, fallback: T): Store<T> {
  let value = fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw) value = { ...fallback, ...(JSON.parse(raw) as Partial<T>) };
  } catch {
    value = fallback;
  }
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set(next) {
      value = next;
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // Storage can be full or disabled; the in-memory value still drives the UI.
      }
      listeners.forEach((listener) => listener());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export interface VlsiProgress {
  visited: string[];
  completed: string[];
  last: string | null;
}

const progressStore = createStore<VlsiProgress>("vlsi.progress.v1", { visited: [], completed: [], last: null });

export function visitLab(slug: string) {
  const current = progressStore.get();
  if (current.last === slug && current.visited.includes(slug)) return;
  progressStore.set({
    ...current,
    last: slug,
    visited: current.visited.includes(slug) ? current.visited : [...current.visited, slug],
  });
}

export function setLabComplete(slug: string, done: boolean) {
  const current = progressStore.get();
  const has = current.completed.includes(slug);
  if (has === done) return;
  progressStore.set({ ...current, completed: done ? [...current.completed, slug] : current.completed.filter((item) => item !== slug) });
}

export function useVlsiProgress(): VlsiProgress {
  return useSyncExternalStore(progressStore.subscribe, progressStore.get, progressStore.get);
}

export type LabStatus = "done" | "visited" | "new";

export function labStatus(progress: VlsiProgress, slug: string): LabStatus {
  if (progress.completed.includes(slug)) return "done";
  if (progress.visited.includes(slug)) return "visited";
  return "new";
}

const themeStore = createStore<{ theme: "light" | "dark" }>("vlsi.theme.v1", { theme: "light" });

export function useVlsiTheme(): ["light" | "dark", () => void] {
  const { theme } = useSyncExternalStore(themeStore.subscribe, themeStore.get, themeStore.get);
  const toggle = useCallback(() => themeStore.set({ theme: themeStore.get().theme === "dark" ? "light" : "dark" }), []);
  return [theme, toggle];
}

const presetStore = createStore<{ bySlug: Record<string, Preset[]> }>("vlsi.presets.v1", { bySlug: {} });

export function useUserPresets(slug: string) {
  const { bySlug } = useSyncExternalStore(presetStore.subscribe, presetStore.get, presetStore.get);
  const list = bySlug[slug] ?? [];
  const save = useCallback((preset: Preset) => {
    const current = presetStore.get().bySlug;
    const others = (current[slug] ?? []).filter((item) => item.name !== preset.name);
    presetStore.set({ bySlug: { ...current, [slug]: [...others, preset] } });
  }, [slug]);
  const remove = useCallback((name: string) => {
    const current = presetStore.get().bySlug;
    presetStore.set({ bySlug: { ...current, [slug]: (current[slug] ?? []).filter((item) => item.name !== name) } });
  }, [slug]);
  return { list, save, remove };
}
