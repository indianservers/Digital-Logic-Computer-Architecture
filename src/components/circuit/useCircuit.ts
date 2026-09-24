import { useEffect, useMemo, useRef, useState } from "react";
import { CIRCUIT_EXAMPLES } from "./examples";
import { applyState, connect, deserialize, duplicateNodes, moveNodes, serialize, simulate, starterAndOr } from "./engine";
import { getComponent } from "./registry";
import type { CircuitDoc, SimResult } from "./types";

const STORAGE = "logiclab.circuit.gates.v1";
const FAVORITES = "logiclab.palette.favorites.v1";
const RECENT = "logiclab.palette.recent.v1";

function readList(key: string): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? "");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function loadDoc(storage: string, starter: () => CircuitDoc): CircuitDoc {
  try {
    const saved = localStorage.getItem(storage);
    if (!saved) return starter();
    return deserialize(saved) ?? starter();
  } catch {
    return starter();
  }
}

export function useCircuit(options?: { storage?: string; starter?: () => CircuitDoc }) {
  const storage = options?.storage ?? STORAGE;
  const starterRef = useRef(options?.starter ?? starterAndOr);
  starterRef.current = options?.starter ?? starterAndOr;
  const armExtra = useRef<Record<string, number | string> | undefined>(undefined);
  const [doc, setDoc] = useState<CircuitDoc>(() => loadDoc(storage, starterRef.current));
  const [past, setPast] = useState<CircuitDoc[]>([]);
  const [future, setFuture] = useState<CircuitDoc[]>([]);
  const [showProp, setShowProp] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [armed, setArmed] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [frame, setFrame] = useState(Number.MAX_SAFE_INTEGER);
  const [snap, setSnap] = useState(true);
  const [favorites, setFavorites] = useState<string[]>(() => readList(FAVORITES));
  const [recent, setRecent] = useState<string[]>(() => readList(RECENT));
  const repeatRef = useRef(false);
  const [repeat, setRepeatState] = useState(false);
  const [view, setView] = useState({ x: 12, y: 8, zoom: 1 });
  const clip = useRef<CircuitDoc | null>(null);
  const docRef = useRef(doc);
  const settledSim = useRef<SimResult | null>(null);
  docRef.current = doc;
  const sim = useMemo(() => simulate(doc), [doc]);
  const shown: SimResult = showProp && sim.frames[frame] ? { ...sim, signals: sim.frames[frame]?.signals ?? sim.signals } : sim;

  useEffect(() => {
    const next = applyState(doc, sim);
    if (next !== doc) setDoc(next);
  }, [doc, sim]);

  useEffect(() => {
    const last = Math.max(0, sim.frames.length - 1);
    if (settledSim.current === null || settledSim.current === sim || !showProp || sim.frames.length < 2) {
      settledSim.current = sim;
      setFrame(last);
      return undefined;
    }
    settledSim.current = sim;
    setFrame(0);
    const id = window.setInterval(() => {
      setFrame((value) => (value + 1 >= sim.frames.length ? sim.frames.length - 1 : value + 1));
    }, Math.max(80, 280 / speed));
    return () => window.clearInterval(id);
  }, [sim, showProp, speed]);

  useEffect(() => {
    if (!playing) return undefined;
    let step = 0;
    const id = window.setInterval(() => {
      step += 1;
      setDoc((current) => ({
        ...current,
        nodes: current.nodes.map((node) => {
          if (node.type !== "clock") return node;
          const hold = Math.max(1, Math.min(8, Number(node.params.hold ?? 1)));
          if (step % hold !== 0) return node;
          return { ...node, params: { ...node.params, level: node.params.level === 1 ? 0 : 1 } };
        }),
      }));
    }, Math.max(120, 700 / speed));
    return () => window.clearInterval(id);
  }, [playing, speed]);

  useEffect(() => {
    const id = window.setTimeout(() => localStorage.setItem(storage, serialize(doc)), 200);
    return () => window.clearTimeout(id);
  }, [doc, storage]);

  useEffect(() => {
    localStorage.setItem(FAVORITES, JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem(RECENT, JSON.stringify(recent));
  }, [recent]);

  function commit(next: CircuitDoc) {
    const current = docRef.current;
    if (next === current) return;
    docRef.current = next;
    setPast((items) => [...items, current].slice(-60));
    setFuture([]);
    setError("");
    setDoc(next);
  }

  function undo() {
    const previous = past[past.length - 1];
    if (!previous) return;
    setPast((items) => items.slice(0, -1));
    setFuture((items) => [doc, ...items]);
    setDoc(previous);
  }

  function redo() {
    const next = future[0];
    if (!next) return;
    setFuture((items) => items.slice(1));
    setPast((items) => [...items, doc]);
    setDoc(next);
  }

  function place(type: string, x: number, y: number, extra?: Record<string, number | string>, raw = false) {
    const spec = getComponent(type);
    if (!spec) return;
    const current = docRef.current;
    const params = { ...extra, ...armExtra.current };
    armExtra.current = undefined;
    const gx = !raw && snap ? Math.round(x / 16) * 16 : x;
    const gy = !raw && snap ? Math.round(y / 16) * 16 : y;
    const label = spec.type === "input" ? nextName(current, "ABCDEFGH") : spec.type === "output" ? nextName(current, ["Y", "S", "C", "Q", "Z"]) : spec.type === "const" ? String(params.value ?? 0) : (spec.shortLabel ?? spec.displayName);
    const id = `n${current.nextId}`;
    commit({
      ...current,
      nextId: current.nextId + 1,
      nodes: [...current.nodes, { id, type, x: gx, y: gy, label, params: { ...Object.fromEntries(spec.params.map((param) => [param.id, param.default])), ...params }, state: [] }],
    });
    setRecent((items) => [type, ...items.filter((item) => item !== type)].slice(0, 8));
    setSelected([id]);
    if (!repeatRef.current) setArmed(null);
  }

  function update(recipe: (doc: CircuitDoc) => CircuitDoc) {
    commit(recipe(docRef.current));
  }

  function setRepeat(value: boolean) {
    repeatRef.current = value;
    setRepeatState(value);
  }

  return {
    doc, sim, shown, frame, showProp, setShowProp, speed, setSpeed, playing, setPlaying,
    selected, setSelected, armed, setArmed, error, setError, snap, setSnap, favorites, recent, repeat, view, setView,
    canUndo: past.length > 0, canRedo: future.length > 0,
    commit, update, undo, redo, place, setRepeat,
    arm(type: string | null, extra?: Record<string, number | string>) {
      armExtra.current = type ? extra : undefined;
      setArmed(type);
    },
    replace(next: CircuitDoc) {
      setPlaying(false);
      setPast([]);
      setFuture([]);
      setSelected([]);
      setError("");
      docRef.current = next;
      setDoc(next);
    },
    toggleFavorite(type: string) {
      setFavorites((items) => (items.includes(type) ? items.filter((item) => item !== type) : [...items, type]));
    },
    copy() {
      clip.current = { ...doc, nodes: doc.nodes.filter((node) => selected.includes(node.id)), wires: doc.wires.filter((wire) => selected.includes(wire.from) && selected.includes(wire.to)), nextId: 1 };
    },
    paste() {
      const copied = clip.current;
      if (!copied || copied.nodes.length === 0) return;
      let next = docRef.current;
      const before = new Set(next.nodes.map((node) => node.id));
      const map = new Map<string, string>();
      for (const node of copied.nodes) {
        const id = `n${next.nextId}`;
        map.set(node.id, id);
        next = { ...next, nextId: next.nextId + 1, nodes: [...next.nodes, { ...node, id, x: node.x + 36, y: node.y + 36, state: [...node.state] }] };
      }
      for (const wire of copied.wires) {
        const from = map.get(wire.from);
        const to = map.get(wire.to);
        if (from && to) next = connect(next, from, wire.fromPort, to, wire.toPort).doc;
      }
      commit(next);
      setSelected(next.nodes.filter((node) => !before.has(node.id)).map((node) => node.id));
    },
    duplicate() {
      if (selected.length === 0) return;
      const current = docRef.current;
      const next = duplicateNodes(current, selected);
      commit(next);
      setSelected(next.nodes.filter((node) => !current.nodes.some((item) => item.id === node.id)).map((node) => node.id));
    },
    removeSelection() {
      if (selected.length === 0) return;
      commit({ ...doc, nodes: doc.nodes.filter((node) => !selected.includes(node.id)), wires: doc.wires.filter((wire) => !selected.includes(wire.from) && !selected.includes(wire.to) && !selected.includes(wire.id)) });
      setSelected([]);
    },
    nudge(dx: number, dy: number) {
      if (selected.length === 0) return;
      commit(moveNodes(docRef.current, selected, dx, dy));
    },
    loadExample(id: string) {
      const example = CIRCUIT_EXAMPLES.find((item) => item.id === id);
      if (!example) return;
      if (past.length > 0 && !window.confirm("Replace the current circuit with this example?")) return;
      setPast([]);
      setFuture([]);
      setSelected([]);
      setDoc(example.build());
    },
    reset() {
      if (past.length > 0 && !window.confirm("Reset to the AND / OR starter circuit?")) return;
      setPlaying(false);
      setPast([]);
      setFuture([]);
      setSelected([]);
      setDoc(starterRef.current());
    },
    importText(text: string) {
      const next = deserialize(text);
      if (!next) {
        setError("That file is not a circuit this studio can open.");
        return;
      }
      commit(next);
    },
  };
}

function nextName(doc: CircuitDoc, names: string[] | string): string {
  const used = new Set(doc.nodes.map((node) => node.label));
  const list = typeof names === "string" ? names.split("") : names;
  return list.find((name) => !used.has(name)) ?? `N${doc.nextId}`;
}

export type CircuitSession = ReturnType<typeof useCircuit>;
