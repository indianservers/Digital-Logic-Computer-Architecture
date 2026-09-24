import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import { Icon } from "../../design-system/icons";
import { Toggle } from "../../design-system/ui";
import { CIRCUIT_EXAMPLES } from "./examples";
import { attachProbe, connect, deleteWires, disconnectNode, duplicateNodes, explainNode, insertOnWire, moveNodes, patchNode, portPosition, routeWire, signalOf, truthTable } from "./engine";
import { canInsert, freeInputs, hitNode, hitPort, isTypingTarget, marqueeHits, nearestWire, pointerTravel, snapPoint, workspaceCursor, zoomAround, DRAG_THRESHOLD, type SnapStrength } from "./interact";
import { PropertiesPane } from "./inspector";
import { getComponent, hexDigit, nodeFrame, nodeSize } from "./registry";
import { SelectionOverlay } from "./selection";
import { ComponentBody, ComponentGlyph, DisplayView, isDisplay } from "./symbols";
import type { Bit, CircuitNode } from "./types";
import type { CircuitSession } from "./useCircuit";

export { PalettePanel } from "./palette";

gsap.registerPlugin(useGSAP, MotionPathPlugin);

type VizMode = "normal" | "current" | "voltage" | "signal" | "fields" | "timing" | "power";

type Gesture =
  | { kind: "move"; ox: number; oy: number; sx: number; sy: number; dx: number; dy: number; ids: string[]; duplicate: boolean; pressing?: boolean; armed: boolean; cycle: boolean }
  | { kind: "wire"; x: number; y: number; sourceId: string; sourcePort: string; sinkId?: string; sinkPort?: string; rewireId?: string; dragging: "source" | "sink" }
  | { kind: "pan"; sx: number; sy: number; vx: number; vy: number }
  | { kind: "box"; x: number; y: number; dx: number; dy: number; sx: number; sy: number; additive: boolean };

type HoverKind = "none" | "node" | "port" | "wire";
type MenuState = { x: number; y: number; kind: "node" | "wire" | "canvas"; id: string };

const VIZ_MODES: Array<{ id: VizMode; label: string }> = [
  { id: "normal", label: "Normal" },
  { id: "current", label: "Current Flow" },
  { id: "voltage", label: "Voltage Map" },
  { id: "signal", label: "Signal Flow" },
  { id: "fields", label: "Fields" },
  { id: "timing", label: "Timing" },
  { id: "power", label: "Power" },
];

function colorOf(bit: Bit | undefined): string {
  if (bit === 1) return "#ef4444";
  if (bit === 0) return "#3b82f6";
  if (bit === "Z") return "#8b7cf6";
  return "#f59e0b";
}

function hueOf(id: string): number {
  let hash = 0;
  for (const char of id) hash = (hash * 33 + char.charCodeAt(0)) % 360;
  return hash;
}

function wirePaint(id: string, bit: Bit | undefined): { stroke: string; halo: string } {
  const hue = hueOf(id);
  const halo = `hsl(${hue} 90% 88%)`;
  if (bit === 1) return { stroke: `hsl(${hue} 72% 42%)`, halo };
  if (bit === 0) return { stroke: `hsl(${hue} 36% 58%)`, halo };
  if (bit === "Z") return { stroke: `hsl(${hue} 16% 50%)`, halo };
  return { stroke: `hsl(${hue} 70% 50%)`, halo };
}

function rangesOverlap(a0: number, a1: number, b0: number, b1: number): boolean {
  const [loA, hiA] = a0 < a1 ? [a0, a1] : [a1, a0];
  const [loB, hiB] = b0 < b1 ? [b0, b1] : [b1, b0];
  return hiA - 6 > loB && hiB - 6 > loA;
}

function routesOverlap(a: { x1: number; y1: number; x2: number; y2: number }, b: { x1: number; y1: number; x2: number; y2: number }): boolean {
  const amid = a.x1 + Math.max(18, (a.x2 - a.x1) / 2);
  const bmid = b.x1 + Math.max(18, (b.x2 - b.x1) / 2);
  const vertical = Math.abs(amid - bmid) < 8 && rangesOverlap(a.y1, a.y2, b.y1, b.y2);
  const top = rangesOverlap(a.x1, amid, b.x1, bmid) && Math.abs(a.y1 - b.y1) < 8;
  const bottom = rangesOverlap(amid, a.x2, bmid, b.x2) && Math.abs(a.y2 - b.y2) < 8;
  return vertical || top || bottom;
}

export function CircuitCanvas({ circuit, dockProperties = false, propertiesHost = null }: { circuit: CircuitSession; dockProperties?: boolean; propertiesHost?: HTMLElement | null }) {
  return <SandboxPanel circuit={circuit} bare dockProperties={dockProperties} propertiesHost={propertiesHost} />;
}

export function SandboxPanel({ circuit, bare = false, dockProperties = false, propertiesHost = null }: { circuit: CircuitSession; bare?: boolean; dockProperties?: boolean; propertiesHost?: HTMLElement | null }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const [gesture, setGesture] = useState<Gesture | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [strength, setStrength] = useState<SnapStrength>("normal");
  const [ghost, setGhost] = useState<{ type: string; x: number; y: number; extra?: Record<string, number | string> } | null>(null);
  const [pending, setPending] = useState<{ sourceId: string; sourcePort: string } | null>(null);
  const [chooser, setChooser] = useState<{ sourceId: string; sourcePort: string; nodeId: string; rewireId?: string } | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CircuitNode | null>(null);
  const [propsOpen, setPropsOpen] = useState(false);
  const [pendingEdit, setPendingEdit] = useState<{ id: string; count: number; key?: string } | null>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [selectedWire, setSelectedWire] = useState<string | null>(null);
  const [trashOn, setTrashOn] = useState(false);
  const [space, setSpace] = useState(false);
  const [hoverKind, setHoverKind] = useState<HoverKind>("none");
  const [wireOk, setWireOk] = useState(true);
  const [focus, setFocus] = useState(false);
  const spaceRef = useRef(false);
  const toolsRef = useRef(false);
  toolsRef.current = Boolean(circuit.armed || pending || chooser || ghost || renameId || menu || gestureRef.current);
  const wireSel = useRef<string | null>(null);
  const [mode, setMode] = useState<VizMode>("current");
  const [electron, setElectron] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const exampleGroups = useMemo(() => [...new Set(CIRCUIT_EXAMPLES.map((example) => example.category))], []);

  useEffect(() => {
    document.documentElement.classList.toggle("cwb-app-focus", focus);
    return () => document.documentElement.classList.remove("cwb-app-focus");
  }, [focus]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (isTypingTarget(event.target)) return;
      const key = event.key.toLowerCase();
      if (event.key === " " && !event.repeat) {
        event.preventDefault();
        spaceRef.current = true;
        setSpace(true);
        return;
      }
      if ((event.ctrlKey || event.metaKey) && key === "a") {
        event.preventDefault();
        circuit.setSelected(circuit.doc.nodes.map((node) => node.id));
        setSelectedWire(null);
        wireSel.current = null;
      }
      else if ((event.ctrlKey || event.metaKey) && key === "x") {
        event.preventDefault();
        circuit.copy();
        circuit.removeSelection();
      }
      else if ((event.ctrlKey || event.metaKey) && key === "z" && event.shiftKey) { event.preventDefault(); circuit.redo(); }
      else if ((event.ctrlKey || event.metaKey) && key === "z") { event.preventDefault(); circuit.undo(); }
      else if ((event.ctrlKey || event.metaKey) && key === "y") { event.preventDefault(); circuit.redo(); }
      else if ((event.ctrlKey || event.metaKey) && key === "c") circuit.copy();
      else if ((event.ctrlKey || event.metaKey) && key === "v") circuit.paste();
      else if ((event.ctrlKey || event.metaKey) && key === "d") { event.preventDefault(); circuit.duplicate(); }
      else if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        const rewire = gestureRef.current?.kind === "wire" ? gestureRef.current.rewireId : undefined;
        if (rewire) {
          circuit.commit(deleteWires(circuit.doc, [rewire]));
          gestureRef.current = null;
          setGesture(null);
        } else if (wireSel.current) {
          circuit.commit(deleteWires(circuit.doc, [wireSel.current]));
          wireSel.current = null;
          setSelectedWire(null);
        } else circuit.removeSelection();
      }
      else if (event.key === "Escape") cancelActive(toolsRef.current);
      else if (!event.ctrlKey && !event.metaKey && key === "r") {
        circuit.update((doc) => ({ ...doc, nodes: doc.nodes.map((node) => circuit.selected.includes(node.id) && !node.locked ? { ...node, rotation: ((node.rotation ?? 0) + 1) % 4 } : node) }));
      }
      else if (key === "p") { event.preventDefault(); setPropsOpen((value) => !value); }
      else if (event.key === "Enter" && (event.target as HTMLElement | null)?.tagName !== "BUTTON" && circuit.selected.length === 1) setRenameId(circuit.selected[0] ?? null);
      else if (event.key.startsWith("Arrow")) {
        const step = event.shiftKey ? 160 : 16;
        const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
        const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
        if (dx || dy) { event.preventDefault(); circuit.nudge(dx, dy); }
      }
    }
    function onKeyUp(event: KeyboardEvent) {
      if (event.key !== " ") return;
      spaceRef.current = false;
      setSpace(false);
    }
    function onBlur() {
      spaceRef.current = false;
      setSpace(false);
      gestureRef.current = null;
      setGesture(null);
      setHover(null);
      setTrashOn(false);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [circuit]);

  useEffect(() => {
    function onPalette(event: Event) {
      const detail = (event as CustomEvent<{ phase: "move" | "up"; type: string; x: number; y: number }>).detail;
      const rect = svgRef.current?.getBoundingClientRect();
      if (!detail || !rect) return;
      const inside = detail.x >= rect.left && detail.x <= rect.right && detail.y >= rect.top && detail.y <= rect.bottom;
      const point = {
        x: (detail.x - rect.left - circuit.view.x) / circuit.view.zoom,
        y: (detail.y - rect.top - circuit.view.y) / circuit.view.zoom,
      };
      if (!inside) {
        if (detail.phase === "move") setGhost(null);
        return;
      }
      const at = snapPoint(point.x, point.y, strength, circuit.doc.nodes);
      if (detail.phase === "move") {
        setGhost({ type: detail.type, x: at.x, y: at.y });
        return;
      }
      setGhost(null);
      const wire = nearestWire(circuit.doc, point.x, point.y);
      if (wire && detail.type === "probe") {
        const added = attachProbe(circuit.doc, wire.id, at.x, at.y);
        if (added.error) circuit.setError(added.error);
        else circuit.commit(added.doc);
        return;
      }
      if (wire && canInsert(detail.type)) {
        const added = insertOnWire(circuit.doc, wire.id, detail.type, at.x, at.y);
        if (added.error) circuit.setError(added.error);
        else circuit.commit(added.doc);
        return;
      }
      circuit.place(detail.type, at.x, at.y, undefined, true);
    }
    window.addEventListener("cwb-palette", onPalette);
    function onCenter(event: Event) {
      const detail = (event as CustomEvent<{ type: string }>).detail;
      const rect = svgRef.current?.getBoundingClientRect();
      if (!detail?.type || !rect) return;
      const x = (rect.width / 2 - circuit.view.x) / circuit.view.zoom;
      const y = (rect.height / 2 - circuit.view.y) / circuit.view.zoom;
      const at = snapPoint(x, y, strength, circuit.doc.nodes);
      circuit.place(detail.type, at.x, at.y, undefined, true);
    }
    window.addEventListener("cwb-place-center", onCenter);
    return () => {
      window.removeEventListener("cwb-palette", onPalette);
      window.removeEventListener("cwb-place-center", onCenter);
    };
  }, [circuit, strength]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    function onWheel(event: WheelEvent) {
      event.preventDefault();
      const rect = svg?.getBoundingClientRect();
      if (!rect) return;
      const pointerX = event.clientX - rect.left;
      const pointerY = event.clientY - rect.top;
      if (event.ctrlKey || event.metaKey) {
        circuit.setView(zoomAround(circuit.view, pointerX, pointerY, event.deltaY < 0 ? 1.1 : 0.9));
        return;
      }
      const dx = event.shiftKey ? event.deltaY : event.deltaX;
      const dy = event.shiftKey ? 0 : event.deltaY;
      circuit.setView({ ...circuit.view, x: circuit.view.x - dx, y: circuit.view.y - dy });
    }
    function blockNative(event: Event) {
      event.preventDefault();
    }
    svg.addEventListener("wheel", onWheel, { passive: false });
    svg.addEventListener("selectstart", blockNative);
    svg.addEventListener("dragstart", blockNative);
    return () => {
      svg.removeEventListener("wheel", onWheel);
      svg.removeEventListener("selectstart", blockNative);
      svg.removeEventListener("dragstart", blockNative);
    };
  }, [circuit]);

  function world(event: { clientX: number; clientY: number }) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (event.clientX - rect.left - circuit.view.x) / circuit.view.zoom,
      y: (event.clientY - rect.top - circuit.view.y) / circuit.view.zoom,
    };
  }

  function setG(next: Gesture | null) {
    gestureRef.current = next;
    setGesture(next);
  }

  function cancelActive(keepSelection: boolean) {
    circuit.setArmed(null);
    circuit.setRepeat(false);
    gestureRef.current = null;
    setGesture(null);
    setPending(null);
    setChooser(null);
    setGhost(null);
    setRenameId(null);
    setMenu(null);
    setHover(null);
    setTrashOn(false);
    setWireOk(true);
    if (!keepSelection) {
      circuit.setSelected([]);
      setSelectedWire(null);
      wireSel.current = null;
    }
  }

  function releasePointer(event: { pointerId: number }) {
    try { svgRef.current?.releasePointerCapture(event.pointerId); } catch { /* already released */ }
  }

  function snapped(x: number, y: number, ignore: string[] = []) {
    return snapPoint(x, y, strength, circuit.doc.nodes.filter((node) => !ignore.includes(node.id)));
  }

  function finishWire(sourceId: string, sourcePort: string, x: number, y: number, rewireId?: string) {
    const doc = rewireId ? deleteWires(circuit.doc, [rewireId]) : circuit.doc;
    const port = hitPort(doc, x, y, "in", 36, (id, pin) => doc.wires.some((wire) => wire.to === id && wire.toPort === pin));
    if (port) {
      const linked = connect(doc, sourceId, sourcePort, port.node.id, port.port.id);
      if (linked.error) circuit.setError(linked.error);
      else { circuit.commit(linked.doc); circuit.setError(""); setPending(null); }
      return;
    }
    const body = hitNode(doc, x, y);
    if (!body || body.id === sourceId) {
      if (!rewireId) setPending({ sourceId, sourcePort });
      circuit.setError(rewireId ? "Drop the end on an input." : "Click an input, or drop near one.");
      return;
    }
    const open = freeInputs(doc, body);
    const only = open.length === 1 ? open[0] : undefined;
    if (only) {
      const linked = connect(doc, sourceId, sourcePort, body.id, only.id);
      if (linked.error) circuit.setError(linked.error);
      else { circuit.commit(linked.doc); circuit.setError(""); setPending(null); }
      return;
    }
    if (open.length > 1) {
      setChooser({ sourceId, sourcePort, nodeId: body.id, rewireId });
      circuit.setError("");
      return;
    }
    circuit.setError("That part has no free input.");
  }

  function readHover(target: Element): HoverKind {
    if (target.closest("[data-port]") || target.closest("[data-wire-end]")) return "port";
    if (target.closest("[data-wire]")) return "wire";
    if (target.closest("[data-node]")) return "node";
    return "none";
  }

  function cycleAt(id: string, point: { x: number; y: number }) {
    const hits = circuit.doc.nodes.filter((item) => {
      const frame = nodeFrame(item);
      return point.x >= frame.x && point.x <= frame.x + frame.width && point.y >= frame.y && point.y <= frame.y + frame.height;
    });
    const index = hits.findIndex((item) => item.id === id);
    const next = hits[(index + 1) % Math.max(hits.length, 1)];
    if (next) circuit.setSelected([next.id]);
  }

  function onPointerDown(event: React.PointerEvent<SVGSVGElement>) {
    const point = world(event);
    const target = event.target as Element;
    const end = target.closest("[data-wire-end]");
    const port = target.closest("[data-port]");
    const node = target.closest("[data-node]");
    const wireHit = target.closest("[data-wire]");
    try { svgRef.current?.setPointerCapture(event.pointerId); } catch { /* pointer already released */ }
    if (spaceRef.current || event.button === 1) {
      if (event.button === 1) event.preventDefault();
      setMenu(null);
      setG({ kind: "pan", sx: event.clientX, sy: event.clientY, vx: circuit.view.x, vy: circuit.view.y });
      return;
    }
    if (event.button !== 0) return;
    if (end) {
      const wireId = end.getAttribute("data-wire-end") ?? "";
      const which = end.getAttribute("data-end");
      const wire = circuit.doc.wires.find((item) => item.id === wireId);
      if (!wire) return;
      if (which === "from") setG({ kind: "wire", x: point.x, y: point.y, sourceId: "", sourcePort: "", sinkId: wire.to, sinkPort: wire.toPort, rewireId: wire.id, dragging: "source" });
      else setG({ kind: "wire", x: point.x, y: point.y, sourceId: wire.from, sourcePort: wire.fromPort, rewireId: wire.id, dragging: "sink" });
      return;
    }
    if (port) {
      const id = port.getAttribute("data-node-id") ?? "";
      const portId = port.getAttribute("data-port") ?? "";
      const dir = port.getAttribute("data-dir");
      if (dir === "in" && pending) {
        const linked = connect(circuit.doc, pending.sourceId, pending.sourcePort, id, portId);
        if (linked.error) circuit.setError(linked.error);
        else { circuit.commit(linked.doc); circuit.setError(""); setPending(null); }
        setPending(null);
        return;
      }
      if (dir === "out") setG({ kind: "wire", x: point.x, y: point.y, sourceId: id, sourcePort: portId, dragging: "sink" });
      return;
    }
    if (circuit.armed && !node) {
      const at = snapped(point.x, point.y);
      const wire = nearestWire(circuit.doc, point.x, point.y);
      if (wire && circuit.armed === "probe") {
        const added = attachProbe(circuit.doc, wire.id, at.x, at.y);
        if (added.error) circuit.setError(added.error);
        else circuit.commit(added.doc);
      } else if (wire && canInsert(circuit.armed)) {
        const added = insertOnWire(circuit.doc, wire.id, circuit.armed, at.x, at.y);
        if (added.error) circuit.setError(added.error);
        else circuit.commit(added.doc);
      } else circuit.place(circuit.armed, at.x, at.y, undefined, true);
      return;
    }
    if (node) {
      const id = node.getAttribute("data-node") ?? "";
      if (event.metaKey || event.ctrlKey) {
        const next = circuit.selected.includes(id) ? circuit.selected.filter((item) => item !== id) : [...circuit.selected, id];
        circuit.setSelected(next);
        setSelectedWire(null);
        wireSel.current = null;
        setPropsOpen(true);
        return;
      }
      const ids = event.shiftKey ? [...new Set([...circuit.selected, id])] : circuit.selected.includes(id) ? circuit.selected : [id];
      circuit.setSelected(ids);
      setSelectedWire(null);
      wireSel.current = null;
      setPropsOpen(true);
      const clicked = circuit.doc.nodes.find((item) => item.id === id);
      const movable = ids.filter((item) => !circuit.doc.nodes.find((entry) => entry.id === item)?.locked);
      const cycle = event.altKey;
      if (clicked?.locked) {
        const pressingLocked = clicked.type === "button" && !event.metaKey && !event.ctrlKey && !event.shiftKey && !cycle;
        if (pressingLocked) circuit.update((doc) => patchNode(doc, id, { params: { pressed: 1 } }));
        setG({ kind: "move", ox: point.x, oy: point.y, sx: event.clientX, sy: event.clientY, dx: 0, dy: 0, ids: [id], duplicate: false, pressing: pressingLocked, armed: false, cycle });
        return;
      }
      const pressing = clicked?.type === "button" && !cycle && !event.metaKey && !event.ctrlKey && !event.shiftKey;
      if (pressing) circuit.update((doc) => patchNode(doc, id, { params: { pressed: 1 } }));
      if (movable.length === 0) return;
      setG({ kind: "move", ox: point.x, oy: point.y, sx: event.clientX, sy: event.clientY, dx: 0, dy: 0, ids: movable, duplicate: cycle, pressing, armed: false, cycle });
      return;
    }
    if (wireHit) {
      const wireId = wireHit.getAttribute("data-wire");
      wireSel.current = wireId;
      setSelectedWire(wireId);
      circuit.setSelected([]);
      setPropsOpen(true);
      return;
    }
    if (!event.shiftKey) {
      circuit.setSelected([]);
      setSelectedWire(null);
      wireSel.current = null;
    }
    setPending(null);
    setMenu(null);
    setG({ kind: "box", x: point.x, y: point.y, dx: point.x, dy: point.y, sx: event.clientX, sy: event.clientY, additive: event.shiftKey });
  }

  function onPointerMove(event: React.PointerEvent<SVGSVGElement>) {
    const point = world(event);
    setCursor(point);
    const current = gestureRef.current;
    if (!current) {
      setHoverKind(readHover(event.target as Element));
      setHoverId(hitNode(circuit.doc, point.x, point.y)?.id ?? null);
      if (circuit.armed) {
        const at = snapped(point.x, point.y);
        setGhost({ type: circuit.armed, x: at.x, y: at.y });
      }
      return;
    }
    const rect = svgRef.current?.getBoundingClientRect();
    if (rect && (current.kind === "move" || current.kind === "wire")) {
      const edge = 28;
      let panX = 0;
      let panY = 0;
      if (event.clientX - rect.left < edge) panX = 12;
      else if (rect.right - event.clientX < edge) panX = -12;
      if (event.clientY - rect.top < edge) panY = 12;
      else if (rect.bottom - event.clientY < edge) panY = -12;
      if (panX || panY) circuit.setView({ ...circuit.view, x: circuit.view.x + panX, y: circuit.view.y + panY });
    }
    if (current.kind === "wire") {
      const magnet = current.dragging === "sink"
        ? hitPort(circuit.doc, point.x, point.y, "in", 36, (id, pin) => circuit.doc.wires.some((wire) => wire.id !== current.rewireId && wire.to === id && wire.toPort === pin))
        : hitPort(circuit.doc, point.x, point.y, "out", 36);
      const body = hitNode(circuit.doc, point.x, point.y);
      setWireOk(Boolean(magnet) || !body);
      const at = magnet ? portPosition(magnet.node, magnet.port.id, current.dragging === "sink" ? "in" : "out") : point;
      setG({ ...current, x: at.x, y: at.y });
    }
    if (current.kind === "move") {
      if (!current.armed && pointerTravel(current.sx, current.sy, event.clientX, event.clientY) < DRAG_THRESHOLD) return;
      const primary = circuit.doc.nodes.find((node) => node.id === current.ids[0]);
      const rawX = (primary?.x ?? 0) + point.x - current.ox;
      const rawY = (primary?.y ?? 0) + point.y - current.oy;
      const bypass = event.altKey && !current.duplicate;
      const at = bypass ? { x: rawX, y: rawY } : snapped(rawX, rawY, current.ids);
      const dx = at.x - (primary?.x ?? 0);
      const dy = at.y - (primary?.y ?? 0);
      setG({ ...current, armed: true, dx, dy });
      const box = svgRef.current?.getBoundingClientRect();
      setTrashOn(!!box && event.clientX > box.right - 72 && event.clientY > box.bottom - 64);
      setHover(document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-palette]") ? "palette" : "move");
    }
    if (current.kind === "pan") circuit.setView({ ...circuit.view, x: current.vx + event.clientX - current.sx, y: current.vy + event.clientY - current.sy });
    if (current.kind === "box" && pointerTravel(current.sx, current.sy, event.clientX, event.clientY) >= DRAG_THRESHOLD) setG({ ...current, dx: point.x, dy: point.y });
  }

  function onPointerUp(event: React.PointerEvent<SVGSVGElement>) {
    const point = world(event);
    const current = gestureRef.current;
    releasePointer(event);
    setG(null);
    setHover(null);
    setTrashOn(false);
    setWireOk(true);
    if (!current) return;
    if (current.kind === "move" && !current.armed) {
      if (current.pressing) circuit.update((doc) => patchNode(doc, current.ids[0] ?? "", { params: { pressed: 0 } }));
      else if (current.cycle) cycleAt(current.ids[0] ?? "", point);
      else {
        const node = circuit.doc.nodes.find((item) => item.id === current.ids[0]);
        if (node && (node.type === "input" || node.type === "const")) {
          const value = node.params.value === 1 ? 0 : 1;
          circuit.commit(patchNode(circuit.doc, node.id, { params: { value } }));
        }
      }
      return;
    }
    if (current.kind === "move" && current.pressing) {
      circuit.update((doc) => {
        const released = patchNode(doc, current.ids[0] ?? "", { params: { pressed: 0 } });
        return moveNodes(released, current.ids, current.dx, current.dy);
      });
      return;
    }
    if (current.kind === "move") {
      const overPalette = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-palette]");
      const box = svgRef.current?.getBoundingClientRect();
      const overTrash = !!box && event.clientX > box.right - 72 && event.clientY > box.bottom - 64;
      if ((overPalette || overTrash) && (Math.abs(current.dx) > 8 || Math.abs(current.dy) > 8)) {
        circuit.commit({ ...circuit.doc, nodes: circuit.doc.nodes.filter((node) => !current.ids.includes(node.id)), wires: circuit.doc.wires.filter((wire) => !current.ids.includes(wire.from) && !current.ids.includes(wire.to)) });
        circuit.setSelected([]);
        return;
      }
      if (current.duplicate) {
        const copied = duplicateNodes(circuit.doc, current.ids);
        const created = copied.nodes.filter((node) => !circuit.doc.nodes.some((item) => item.id === node.id)).map((node) => node.id);
        circuit.commit(moveNodes(copied, created, current.dx, current.dy));
        circuit.setSelected(created);
      } else circuit.commit(moveNodes(circuit.doc, current.ids, current.dx, current.dy));
      return;
    }
    if (current.kind === "wire" && current.dragging === "sink") finishWire(current.sourceId, current.sourcePort, point.x, point.y, current.rewireId);
    if (current.kind === "wire" && current.dragging === "source" && current.sinkId && current.sinkPort) {
      const doc = current.rewireId ? deleteWires(circuit.doc, [current.rewireId]) : circuit.doc;
      const port = hitPort(doc, point.x, point.y, "out", 36);
      if (!port) circuit.setError("Drop this end on an output.");
      else {
        const linked = connect(doc, port.node.id, port.port.id, current.sinkId, current.sinkPort);
        if (linked.error) circuit.setError(linked.error);
        else { circuit.commit(linked.doc); circuit.setError(""); setPending(null); }
      }
    }
    if (current.kind === "box") {
      if (pointerTravel(current.sx, current.sy, event.clientX, event.clientY) < DRAG_THRESHOLD) return;
      const hits = circuit.doc.nodes.filter((node) => marqueeHits(nodeFrame(node), current.x, current.y, current.dx, current.dy)).map((node) => node.id);
      circuit.setSelected(current.additive ? [...new Set([...circuit.selected, ...hits])] : hits);
    }
  }

  function onPointerCancel(event: React.PointerEvent<SVGSVGElement>) {
    releasePointer(event);
    gestureRef.current = null;
    setGesture(null);
    setHover(null);
    setTrashOn(false);
    setWireOk(true);
  }

  const moving = gesture?.kind === "move" && gesture.armed && !gesture.duplicate ? gesture : null;
  const cursorMode = workspaceCursor({
    space,
    gesture: gesture?.kind === "move" ? (gesture.armed ? "move" : "idle") : gesture?.kind ?? (circuit.armed || ghost ? "place" : "idle"),
    hover: hoverKind,
    wireValid: wireOk,
  });
  const insertWire = ghost && (ghost.type === "probe" || canInsert(ghost.type)) ? nearestWire(circuit.doc, ghost.x, ghost.y)?.id : undefined;
  const drawn = (node: CircuitNode) => shift(draft?.id === node.id ? draft : node, moving);
  const chooserNode = circuit.doc.nodes.find((node) => node.id === chooser?.nodeId) ?? null;

  return (
    <section className={`lgx-card lgx-sandbox ${bare ? "cwb-bare" : ""}`}
      onDragOver={(event) => {
        event.preventDefault();
        const point = world(event);
        const at = snapped(point.x, point.y);
        if (circuit.armed) setGhost({ type: circuit.armed, x: at.x, y: at.y });
      }}
      onDrop={(event) => {
        event.preventDefault();
        const type = event.dataTransfer.getData("text/circuit-type") || circuit.armed || "";
        setGhost(null);
        if (!type) return;
        const raw = event.dataTransfer.getData("text/circuit-params");
        let extra: Record<string, number | string> | undefined;
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as Record<string, number | string>;
            if (parsed && typeof parsed === "object") extra = parsed;
          } catch { /* drag payload is optional */ }
        }
        const point = world(event);
        const at = snapped(point.x, point.y);
        const wire = nearestWire(circuit.doc, point.x, point.y);
        if (wire && type === "probe") {
          const added = attachProbe(circuit.doc, wire.id, at.x, at.y);
          if (added.error) circuit.setError(added.error);
          else circuit.commit(added.doc);
          return;
        }
        if (wire && canInsert(type)) {
          const added = insertOnWire(circuit.doc, wire.id, type, at.x, at.y);
          if (added.error) circuit.setError(added.error);
          else circuit.commit(added.doc);
          return;
        }
        circuit.place(type, at.x, at.y, extra, true);
      }}
    >
      {bare ? null : <div className="lgx-card-bar">
        <h3><i>2</i> Circuit Sandbox</h3>
        <span className="lgx-inline">Show Propagation <Toggle on={circuit.showProp} showLabel={false} onChange={circuit.setShowProp} label="Show propagation" tone="primary" /></span>
      </div>}
      {bare ? null : <div className="lgx-toolbar">
        <button className="lgx-play" onClick={() => circuit.setPlaying(true)}><Icon name="play" size={14} /> Play</button>
        <button className="lgx-tool" onClick={() => circuit.setPlaying(false)}><Icon name="pause" size={14} /> Pause</button>
        <button className="lgx-tool" title="One clock edge" onClick={() => circuit.commit({ ...circuit.doc, nodes: circuit.doc.nodes.map((node) => node.type === "clock" ? { ...node, params: { ...node.params, level: node.params.level === 1 ? 0 : 1 } } : node) })}>Step</button>
        <button className="lgx-tool" onClick={circuit.reset}><Icon name="reset" size={14} /> Reset</button>
        <label>Speed
          <select aria-label="Simulation speed" value={String(circuit.speed)} onChange={(event) => circuit.setSpeed(Number(event.target.value))}>
            {[0.25, 0.5, 1, 2, 4, 8].map((value) => <option key={value} value={value}>{value}×</option>)}
          </select>
        </label>
        <button className="lgx-tool" title="Undo" onClick={circuit.undo} disabled={!circuit.canUndo}>Undo</button>
        <button className="lgx-tool" title="Redo" onClick={circuit.redo} disabled={!circuit.canRedo}>Redo</button>
        <button className="lgx-tool" title="Fit circuit" onClick={() => fitView(circuit)}>Fit</button>
        <button className="lgx-tool" title="Maximize the circuit workspace" aria-pressed={focus} onClick={() => setFocus((value) => !value)}>{focus ? "Exit focus" : "Focus"}</button>
        <label>Snap
          <select aria-label="Snap strength" value={strength} onChange={(event) => {
            const next = event.target.value as SnapStrength;
            setStrength(next);
            circuit.setSnap(next !== "off");
          }}>
            <option value="off">Off</option>
            <option value="light">Light</option>
            <option value="normal">Normal</option>
            <option value="strong">Strong</option>
          </select>
        </label>
        <ExampleSelect circuit={circuit} groups={exampleGroups} />
        <button className="lgx-tool" onClick={() => download(circuit)}>Export</button>
        <button className="lgx-tool" onClick={() => fileRef.current?.click()}>Import</button>
        <input ref={fileRef} hidden type="file" accept="application/json" aria-label="Import circuit JSON" onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          void file.text().then((text) => circuit.importText(text));
          event.target.value = "";
        }} />
      </div>}
      {bare ? null : <div className="cwb-modes" role="toolbar" aria-label="Live visualization">
        {VIZ_MODES.map((item) => (
          <button key={item.id} className={mode === item.id ? "on" : ""} aria-pressed={mode === item.id} onClick={() => setMode(item.id)}>{item.label}</button>
        ))}
        {mode === "current" ? (
          <button className={electron ? "on" : ""} aria-pressed={electron} onClick={() => setElectron((value) => !value)}>{electron ? "Electron" : "Conventional"}</button>
        ) : null}
      </div>}
      {bare ? <div className="cwb-examples"><ExampleSelect circuit={circuit} groups={exampleGroups} /></div> : null}
      <BuzzerAudio circuit={circuit} />
      {circuit.error ? <p className="cwb-error">{circuit.error}</p> : null}
      {circuit.sim.warning ? <p className="cwb-error">{circuit.sim.warning}</p> : null}
      <div className={`lgx-canvas ${ghost ? "cwb-drop" : ""}`} style={{ backgroundSize: `${18 * circuit.view.zoom}px ${18 * circuit.view.zoom}px`, backgroundPosition: `${circuit.view.x}px ${circuit.view.y}px` }}>
        <svg ref={svgRef} className={`cwb-svg cwb-cur-${cursorMode}`} role="application" aria-label="Circuit sandbox" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel} onAuxClick={(event) => { if (event.button === 1) event.preventDefault(); }} onContextMenu={(event) => {
          event.preventDefault();
          const target = event.target as Element;
          const nodeId = target.closest("[data-node]")?.getAttribute("data-node");
          const wireId = target.closest("[data-wire]")?.getAttribute("data-wire");
          const rect = svgRef.current?.getBoundingClientRect();
          if (!rect) return;
          const at = {
            x: Math.min(Math.max(8, event.clientX - rect.left), rect.width - 188),
            y: Math.min(Math.max(8, event.clientY - rect.top), rect.height - 220),
          };
          if (nodeId) {
            if (!circuit.selected.includes(nodeId)) circuit.setSelected([nodeId]);
            setSelectedWire(null);
            setMenu({ ...at, kind: "node", id: nodeId });
          } else if (wireId) {
            circuit.setSelected([]);
            setSelectedWire(wireId);
            wireSel.current = wireId;
            setMenu({ ...at, kind: "wire", id: wireId });
          } else setMenu({ ...at, kind: "canvas", id: "" });
        }} onDoubleClick={(event) => {
          const text = event.target as Element;
          if (text.tagName.toLowerCase() !== "text" || !text.hasAttribute("data-label")) return;
          const id = text.closest("[data-node]")?.getAttribute("data-node");
          if (id) setRenameId(id);
        }}>
          <g transform={`translate(${circuit.view.x} ${circuit.view.y}) scale(${circuit.view.zoom})`}>
            <defs>
              <radialGradient id="cwb-led-on" cx="38%" cy="35%" r="65%">
                <stop offset="0%" stopColor="#fff7ed" />
                <stop offset="42%" stopColor="#fb7185" />
                <stop offset="100%" stopColor="#9f1239" />
              </radialGradient>
              <radialGradient id="cwb-led-off" cx="40%" cy="35%" r="70%">
                <stop offset="0%" stopColor="#e2e8f0" />
                <stop offset="100%" stopColor="#64748b" />
              </radialGradient>
              <filter id="cwb-glow" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="2.2" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            {circuit.doc.wires.filter((wire) => wire.id !== (gesture?.kind === "wire" ? gesture.rewireId : undefined)).map((wire, index, wires) => {
              const from = circuit.doc.nodes.find((node) => node.id === wire.from);
              const to = circuit.doc.nodes.find((node) => node.id === wire.to);
              if (!from || !to) return null;
              const start = portPosition(drawn(from), wire.fromPort, "out");
              const end = portPosition(drawn(to), wire.toPort, "in");
              const value = signalOf(circuit.shown, wire.from, wire.fromPort);
              const previous = circuit.sim.frames[Math.max(0, circuit.frame - 1)]?.signals[`${wire.from}.${wire.fromPort}`];
              const propagating = circuit.showProp && previous !== undefined && previous !== value;
              const d = routeWire(start.x, start.y, end.x, end.y);
              const live = value === 1;
              const width = mode === "voltage" || mode === "power" ? (live ? 3.4 : 1.7) : 2.4;
              const paint = wirePaint(wire.id, value);
              const route = { x1: start.x, y1: start.y, x2: end.x, y2: end.y };
              const crowded = wires.some((other, otherIndex) => {
                if (otherIndex >= index) return false;
                const otherFrom = circuit.doc.nodes.find((node) => node.id === other.from);
                const otherTo = circuit.doc.nodes.find((node) => node.id === other.to);
                if (!otherFrom || !otherTo) return false;
                const otherStart = portPosition(drawn(otherFrom), other.fromPort, "out");
                const otherEnd = portPosition(drawn(otherTo), other.toPort, "in");
                return routesOverlap(route, { x1: otherStart.x, y1: otherStart.y, x2: otherEnd.x, y2: otherEnd.y });
              });
              const focus = circuit.doc.wires.find((item) => item.id === selectedWire);
              const sameNet = focus !== undefined && wire.id !== focus.id && wire.from === focus.from && wire.fromPort === focus.fromPort;
              const picked = selectedWire === wire.id || insertWire === wire.id;
              return (
                <g key={wire.id}>
                  <path data-wire={wire.id} d={d} fill="none" stroke="transparent" strokeWidth={18} />
                  {sameNet ? <path d={d} fill="none" stroke="#2f6fed" strokeWidth={width + 5} opacity={0.35} /> : null}
                  <path d={d} fill="none" stroke={paint.halo} strokeWidth={width + (crowded ? 5 : 3)} strokeLinecap="round" />
                  <path data-wire-line="" d={d} className={mode === "signal" && propagating ? "cwb-flow" : ""} fill="none" stroke={picked ? "#2f6fed" : paint.stroke} strokeWidth={picked ? width + 1.4 : width} strokeDasharray={crowded ? "7 4" : undefined} strokeLinecap="round" opacity={mode === "voltage" && !live ? 0.55 : 1}>
                    <title>{`${from.label} → ${to.label} = ${value}. Drag either end to rewire.`}</title>
                  </path>
                  <circle data-wire-end={wire.id} data-end="from" cx={start.x} cy={start.y} r={11} fill="transparent" />
                  <circle data-wire-end={wire.id} data-end="to" cx={end.x} cy={end.y} r={11} fill="transparent" />
                  {mode === "current" ? <ChargePulse d={d} live={live} reverse={electron} speed={circuit.speed} /> : null}
                  {mode === "signal" && propagating ? <ChargePulse d={d} live speed={circuit.speed} once /> : null}
                </g>
              );
            })}
            {gesture?.kind === "wire" ? <WirePreview doc={circuit.doc} gesture={gesture} /> : null}
            {ghost ? <Ghost type={ghost.type} x={ghost.x} y={ghost.y} inserting={insertWire !== undefined} /> : null}
            {gesture?.kind === "move" && gesture.armed && gesture.duplicate ? (
              <g opacity={0.5} pointerEvents="none">
                {circuit.doc.nodes.filter((node) => gesture.ids.includes(node.id)).map((node) => (
                  <NodeView key={`copy-${node.id}`} node={{ ...node, id: `copy-${node.id}`, x: node.x + gesture.dx, y: node.y + gesture.dy }} circuit={circuit} wiring={false} magnet={null} mode={mode} active={false} />
                ))}
              </g>
            ) : null}
            {gesture?.kind === "box" && (gesture.dx !== gesture.x || gesture.dy !== gesture.y) ? <rect x={Math.min(gesture.x, gesture.dx)} y={Math.min(gesture.y, gesture.dy)} width={Math.abs(gesture.dx - gesture.x)} height={Math.abs(gesture.dy - gesture.y)} fill={gesture.dx < gesture.x ? "rgba(47,111,237,0.16)" : "rgba(47,111,237,0.08)"} stroke="#2f6fed" strokeDasharray={gesture.dx < gesture.x ? "4 3" : undefined} /> : null}
            {circuit.doc.nodes.map((node) => (
              <NodeView key={node.id} node={drawn(node)} circuit={circuit} wiring={gesture?.kind === "wire"} magnet={gesture?.kind === "wire" ? { x: gesture.x, y: gesture.y, dir: gesture.dragging === "source" ? "out" : "in" } : null} mode={mode} active={mode === "timing" && circuit.sim.frames[circuit.frame]?.nodeId === node.id} />
            ))}
          </g>
        </svg>
        <div className="lgx-zoom">
          <button onClick={() => circuit.setView({ ...circuit.view, zoom: Math.max(0.1, circuit.view.zoom - 0.1) })}>−</button>
          <span>{Math.round(circuit.view.zoom * 100)}%</span>
          <button onClick={() => circuit.setView({ ...circuit.view, zoom: Math.min(4, circuit.view.zoom + 0.1) })}>+</button>
          <button onClick={() => fitView(circuit)} aria-label="Fit canvas">⛶</button>
        </div>
        <div className="lgx-legend">
          <span><i className="low" /> 0</span>
          <span><i className="high" /> 1</span>
          <span><i className="prop" /> X / propagating</span>
        </div>
        <SelectionOverlay
          circuit={circuit}
          hoverId={hoverId}
          renameId={renameId}
          draft={draft}
          onDraft={setDraft}
          onRename={(id, label) => {
            const trimmed = label.trim().slice(0, 16);
            if (trimmed) circuit.update((doc) => patchNode(doc, id, { label: trimmed }));
            setRenameId(null);
          }}
          onCancelRename={() => setRenameId(null)}
          onToggleProps={() => setPropsOpen(true)}
          onBlocked={(id, count) => { setPendingEdit({ id, count }); setPropsOpen(true); }}
          onMenu={setMenu}
        />
        {(() => {
          const pane = <PropertiesPane docked={dockProperties} circuit={circuit} open={propsOpen} onToggle={() => setPropsOpen((value) => !value)} wireId={circuit.selected.length === 0 ? selectedWire : null} onFocusWire={(id) => { wireSel.current = id; setSelectedWire(id); circuit.setSelected([]); }} pending={pendingEdit} onPending={(id, count, key) => setPendingEdit({ id, count, key })} onClearPending={() => setPendingEdit(null)} />;
          if (!dockProperties) return pane;
          return propertiesHost ? createPortal(pane, propertiesHost) : null;
        })()}
        {menu ? <SelectionMenu circuit={circuit} menu={menu} onClose={() => setMenu(null)} onRename={setRenameId} onProps={() => setPropsOpen(true)} onFit={() => fitView(circuit)} onResetView={() => circuit.setView({ x: 12, y: 8, zoom: 1 })} /> : null}
        <p className="cwb-hud">
          <span>{hudMode(gesture, space, Boolean(circuit.armed || ghost), Boolean(renameId), Boolean(pending))}</span>
          <span>{statusLine(circuit) || "Nothing selected"}</span>
          <span>Zoom {Math.round(circuit.view.zoom * 100)}%</span>
          <span>Snap {strength}</span>
        </p>
        {trashOn || gesture?.kind === "move" ? <div className={`cwb-trash ${trashOn ? "on" : ""}`}>Drop to delete</div> : null}
        {chooser && chooserNode ? (
          <div className="cwb-chooser" style={{ left: circuit.view.x + chooserNode.x * circuit.view.zoom, top: circuit.view.y + chooserNode.y * circuit.view.zoom }}>
            <b>Connect to</b>
            {freeInputs(circuit.doc, chooserNode).map((port) => (
              <button key={port.id} type="button" onClick={() => {
                const base = chooser.rewireId ? deleteWires(circuit.doc, [chooser.rewireId]) : circuit.doc;
                const linked = connect(base, chooser.sourceId, chooser.sourcePort, chooser.nodeId, port.id);
                if (linked.error) circuit.setError(linked.error);
                else { circuit.commit(linked.doc); circuit.setError(""); setPending(null); }
                setChooser(null);
              }}>{port.name}</button>
            ))}
          </div>
        ) : null}
      </div>
      {cursor && circuit.armed ? <p className="tiny">Drop on the canvas. Drop a NOT, buffer, delay, or probe onto a wire to insert it. Escape cancels.</p> : null}
      {pending ? <p className="tiny">Click the input you want to connect. Escape cancels.</p> : null}
      {hover === "palette" ? <p className="tiny">Release over the palette to remove the part.</p> : null}
    </section>
  );
}

function ExampleSelect({ circuit, groups }: { circuit: CircuitSession; groups: string[] }) {
  return (
    <select aria-label="Example circuit" defaultValue="" onChange={(event) => { if (event.target.value) circuit.loadExample(event.target.value); event.target.value = ""; }}>
      <option value="">Examples ({CIRCUIT_EXAMPLES.length})</option>
      {groups.map((category) => (
        <optgroup key={category} label={category}>
          {CIRCUIT_EXAMPLES.filter((example) => example.category === category).map((example) => (
            <option key={example.id} value={example.id}>{example.name}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

function BuzzerAudio({ circuit }: { circuit: CircuitSession }) {
  const ctxRef = useRef<AudioContext | null>(null);
  const tones = useRef(new Map<string, OscillatorNode>());
  useEffect(() => {
    const active = circuit.doc.nodes.filter((node) => node.type === "buzzer" && signalOf(circuit.shown, node.id, "A") === 1);
    const live = new Set(active.map((node) => node.id));
    for (const [id, osc] of tones.current) {
      if (live.has(id)) continue;
      osc.stop();
      tones.current.delete(id);
    }
    if (active.length === 0) return;
    try {
      if (!ctxRef.current) ctxRef.current = new AudioContext();
    } catch {
      return;
    }
    const ctx = ctxRef.current;
    void ctx.resume();
    active.forEach((node, index) => {
      if (tones.current.has(node.id) || ctx.state === "closed") return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = 220 + (index % 5) * 55;
      gain.gain.value = 0.035;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      tones.current.set(node.id, osc);
    });
  }, [circuit.doc, circuit.shown]);
  useEffect(() => () => {
    for (const osc of tones.current.values()) osc.stop();
    tones.current.clear();
    void ctxRef.current?.close();
  }, []);
  return null;
}

function WirePreview({ doc, gesture }: { doc: CircuitSession["doc"]; gesture: Extract<Gesture, { kind: "wire" }> }) {
  if (gesture.dragging === "sink") {
    const node = doc.nodes.find((item) => item.id === gesture.sourceId);
    if (!node) return null;
    const start = portPosition(node, gesture.sourcePort, "out");
    return <path d={routeWire(start.x, start.y, gesture.x, gesture.y)} fill="none" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 4" />;
  }
  const sink = doc.nodes.find((item) => item.id === gesture.sinkId);
  if (!sink || !gesture.sinkPort) return null;
  const end = portPosition(sink, gesture.sinkPort, "in");
  return <path d={routeWire(gesture.x, gesture.y, end.x, end.y)} fill="none" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 4" />;
}

function Ghost({ type, x, y, inserting }: { type: string; x: number; y: number; inserting: boolean }) {
  const spec = getComponent(type);
  if (!spec) return null;
  const size = nodeSize(spec, {});
  return (
    <g pointerEvents="none" opacity={0.78} transform={`translate(${x} ${y})`}>
      <ComponentBody type={type} width={size.width} height={size.height} stroke={inserting ? "#067647" : "#2f6fed"} fill={inserting ? "#ecfdf3" : "#e8f1ff"} sw={1.6} />
    </g>
  );
}

function shift(node: CircuitNode, moving: { ids: string[]; dx: number; dy: number } | null): CircuitNode {
  if (!moving || !moving.ids.includes(node.id)) return node;
  return { ...node, x: node.x + moving.dx, y: node.y + moving.dy };
}

function fitView(circuit: CircuitSession) {
  if (circuit.doc.nodes.length === 0) return;
  const minX = Math.min(...circuit.doc.nodes.map((node) => node.x));
  const minY = Math.min(...circuit.doc.nodes.map((node) => node.y));
  circuit.setView({ x: 24 - minX, y: 16 - minY, zoom: 1 });
}

function download(circuit: CircuitSession) {
  const blob = new Blob([JSON.stringify(circuit.doc, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "circuit.json";
  link.click();
  URL.revokeObjectURL(url);
}

function ChargePulse({ d, live, reverse = false, speed, once = false }: { d: string; live: boolean; reverse?: boolean; speed: number; once?: boolean }) {
  const dot = useRef<SVGCircleElement>(null);
  const tail = useRef<SVGCircleElement>(null);
  useGSAP(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!live || reduce || !dot.current) return;
    const duration = Math.min(1.6, Math.max(0.35, 1.15 / Math.max(speed, 0.25)));
    const path = { path: d, alignOrigin: [0.5, 0.5] as [number, number], start: reverse ? 1 : 0, end: reverse ? 0 : 1 };
    gsap.to(dot.current, { motionPath: path, duration, repeat: once ? 0 : -1, ease: "none" });
    if (tail.current && !once) {
      gsap.to(tail.current, { motionPath: path, duration, repeat: -1, ease: "none", delay: duration * 0.45 });
    }
  }, { dependencies: [d, live, reverse, speed, once], revertOnUpdate: true });
  if (!live) return null;
  return (
    <g className="cwb-charge" pointerEvents="none">
      <circle ref={dot} r="3.1" fill="#fff" stroke="#b91c1c" strokeWidth="1.1" />
      {once ? null : <circle ref={tail} r="2.2" fill="#fecaca" opacity="0.9" />}
    </g>
  );
}

function NodeView({ node, circuit, wiring, magnet, mode, active }: { node: CircuitNode; circuit: CircuitSession; wiring: boolean; magnet: { x: number; y: number; dir: "in" | "out" } | null; mode: VizMode; active: boolean }) {
  const spec = getComponent(node.type);
  if (!spec) return null;
  const size = nodeSize(spec, node.params, node);
  const ports = spec.ports(node.params);
  const output = ports.find((port) => port.dir === "out");
  const shown = output ? signalOf(circuit.shown, node.id, output.id) : signalOf(circuit.shown, node.id, "A");
  const turns = ((node.rotation ?? 0) % 4 + 4) % 4;
  const cx = node.x + size.width / 2;
  const cy = node.y + size.height / 2;
  const frame = nodeFrame(node);
  const place = node.labelAt && node.labelAt !== "auto" ? node.labelAt : "top";
  const label = place === "bottom"
    ? { x: frame.x + frame.width / 2, y: frame.y + frame.height + 14, anchor: "middle" as const }
    : place === "left"
      ? { x: frame.x - 8, y: frame.y + frame.height / 2, anchor: "end" as const }
      : place === "right"
        ? { x: frame.x + frame.width + 8, y: frame.y + frame.height / 2, anchor: "start" as const }
        : place === "inside"
          ? { x: frame.x + frame.width / 2, y: frame.y + frame.height / 2 + 4, anchor: "middle" as const }
          : { x: frame.x + frame.width / 2, y: frame.y - 8, anchor: "middle" as const };
  return (
    <g data-node={node.id} className={active ? "cwb-timing" : ""} role="button" tabIndex={0} aria-label={`${node.label} is ${shown}. ${spec.displayName}`}>
      <rect x={frame.x} y={frame.y} width={frame.width} height={frame.height} fill="transparent" />
      <g pointerEvents="none" transform={turns ? `rotate(${turns * 90} ${cx} ${cy})` : undefined}>
        <Symbol node={node} width={size.width} height={size.height} value={shown} mode={mode} bits={Object.fromEntries(ports.map((port) => [port.id, signalOf(circuit.shown, node.id, port.id)]))} />
      </g>
      {mode === "fields" && shown === 1 ? <circle cx={node.x + size.width / 2} cy={node.y + size.height / 2} r={Math.max(size.width, size.height) * 0.55} fill="none" stroke="#fb923c" strokeOpacity="0.65" strokeWidth="1.3" pointerEvents="none" /> : null}
      {node.type === "mux2" && (mode === "signal" || mode === "fields") ? <MuxSelect node={node} width={size.width} height={size.height} select={signalOf(circuit.shown, node.id, "S")} /> : null}
      {node.showLabel === false ? null : <text data-label="name" x={label.x} y={label.y} textAnchor={label.anchor} fontSize="11" fontWeight="700" fill="#344054">{node.label}</text>}
      {ports.map((port) => {
        const point = portPosition(node, port.id, port.dir);
        const value = signalOf(circuit.shown, node.id, port.id);
        const aimed = magnet?.dir === port.dir && Math.hypot(point.x - magnet.x, point.y - magnet.y) < 2;
        const taken = port.dir === "in" && circuit.doc.wires.some((wire) => wire.to === node.id && wire.toPort === port.id);
        const dim = wiring && magnet !== null && port.dir !== magnet.dir;
        const outside = point.x <= frame.x + 2;
        return (
          <g key={port.id} data-port={port.id} data-dir={port.dir} data-node-id={node.id} opacity={dim || (wiring && taken && !aimed) ? 0.35 : 1}>
            <title>{port.name}</title>
            <circle cx={point.x} cy={point.y} r={14} fill="transparent" />
            {port.id === "CLK" ? <path d={`M${point.x - 5} ${point.y + 4} L${point.x} ${point.y - 5} L${point.x + 5} ${point.y + 4}`} fill={colorOf(value)} stroke="#fff" strokeWidth={1.2} /> : <circle cx={point.x} cy={point.y} r={aimed ? 8 : 4.5} fill={colorOf(value)} stroke={aimed || (wiring && port.dir === magnet?.dir) ? "#2f6fed" : "#fff"} strokeWidth={aimed ? 2.4 : 1.5} />}
            {node.showPorts !== false && circuit.view.zoom >= 0.55 ? <text x={point.x + (outside ? -8 : 8)} y={point.y - 7} textAnchor={outside ? "end" : "start"} fontSize="9" fill="#667085">{port.name}</text> : null}
          </g>
        );
      })}
    </g>
  );
}

function Symbol({ node, width, height, value, mode, bits }: { node: CircuitNode; width: number; height: number; value: Bit; mode: VizMode; bits: Record<string, Bit> }) {
  const stroke = "#122033";
  const sw = 1.6;
  const hot = value === 1;
  const body = mode === "power" ? (hot ? "#fff1e6" : "#f8fafc") : mode === "voltage" ? (hot ? "#fee2e2" : value === 0 ? "#dbeafe" : "#fff") : "#fff";
  if (node.type === "input" || node.type === "const" || node.type === "high" || node.type === "low" || node.type === "button" || node.type === "clock") {
    const on = value === 1;
    return (
      <g>
        <rect x={node.x} y={node.y} width={width} height={height} rx={12} fill={on ? "#22c55e" : "#fff"} stroke={on ? "#16a34a" : stroke} strokeWidth={sw} />
        <text x={node.x + width / 2} y={node.y + height / 2 + 5} textAnchor="middle" fontSize="16" fontWeight="800" fill={on ? "#fff" : "#2f6fed"}>{value}</text>
      </g>
    );
  }
  if (isDisplay(node.type)) return <DisplayView type={node.type} x={node.x} y={node.y} width={width} height={height} bits={bits} />;
  if (node.type === "led") {
    const activeHigh = node.params.active !== 0;
    const lamp = activeHigh ? value === 1 : value === 0;
    return <LedLamp x={node.x} y={node.y} width={width} height={height} on={lamp} unknown={value === "X" || value === "Z"} />;
  }
  if (node.type === "output" || node.type === "probe") {
    return (
      <g>
        <rect x={node.x} y={node.y} width={width} height={height} rx={10} fill={body} stroke={colorOf(value)} strokeWidth={2} />
        {node.type === "probe" ? <path d={`M${node.x + 8} ${node.y + height - 6} L${node.x + width / 2} ${node.y + 10}`} stroke={colorOf(value)} strokeWidth={1.6} /> : null}
        <text x={node.x + width / 2} y={node.y + height / 2 + 5} textAnchor="middle" fontSize="16" fontWeight="800" fill={colorOf(value)}>{value}</text>
      </g>
    );
  }
  return (
    <g transform={`translate(${node.x} ${node.y})`}>
      <ComponentBody type={node.type} width={width} height={height} stroke={activeStroke(stroke, mode, hot)} fill={body} sw={sw} />
    </g>
  );
}

function MuxSelect({ node, width, height, select }: { node: CircuitNode; width: number; height: number; select: Bit }) {
  const y = select === 1 ? node.y + height * 0.62 : node.y + height * 0.38;
  const faint = select !== 0 && select !== 1;
  return <path d={`M${node.x + 8} ${y} H${node.x + width - 8}`} stroke={faint ? "#f59e0b" : "#ef4444"} strokeWidth="3" strokeLinecap="round" opacity={faint ? 0.35 : 0.8} pointerEvents="none" />;
}

function activeStroke(stroke: string, mode: VizMode, hot: boolean): string {
  if (mode === "fields" && hot) return "#f97316";
  return stroke;
}

function LedLamp({ x, y, width, height, on, unknown }: { x: number; y: number; width: number; height: number; on: boolean; unknown: boolean }) {
  const halo = useRef<SVGCircleElement>(null);
  const cx = x + width / 2;
  const cy = y + height / 2 - 2;
  useGSAP(() => {
    if (!halo.current) return;
    gsap.to(halo.current, {
      opacity: on ? 0.9 : 0.08,
      scale: on ? 1.15 : 0.72,
      svgOrigin: `${cx} ${cy}`,
      duration: on ? 0.28 : 0.45,
      ease: "power2.out",
    });
  }, { dependencies: [on, cx, cy] });
  return (
    <g className={on ? "cwb-led on" : "cwb-led"}>
      <circle ref={halo} cx={cx} cy={cy} r={16} fill={unknown ? "#f59e0b" : "#fb7185"} opacity={0.08} filter="url(#cwb-glow)" />
      <path d={`M${x + 10} ${y + height - 8} h${width - 20}`} stroke="#94a3b8" strokeWidth="3" strokeLinecap="round" />
      <path d={`M${x + 14} ${y + height - 4} h${width - 28}`} stroke="#64748b" strokeWidth="2" strokeLinecap="round" />
      <path d={`M${cx - 7} ${cy + 8} L${cx - 4} ${cy - 2} H${cx + 4} L${cx + 7} ${cy + 8} Z`} fill="none" stroke="#9f1239" strokeWidth="1.4" />
      <path d={`M${cx - 8} ${cy + 1} H${cx + 8}`} stroke="#9f1239" strokeWidth="1.3" />
      <circle cx={cx} cy={cy - 1} r={11} fill={on ? "url(#cwb-led-on)" : "url(#cwb-led-off)"} stroke={on ? "#be123c" : "#475569"} strokeWidth="1.4" />
      <path d={`M${cx - 3} ${cy - 8} q5 -2 8 3`} fill="none" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" opacity={on ? 0.9 : 0.35} />
      {on ? (
        <g stroke="#fb7185" strokeWidth="1.2" strokeLinecap="round" opacity="0.85">
          <path d={`M${cx - 16} ${cy - 8} l-4 -3`} />
          <path d={`M${cx + 16} ${cy - 8} l4 -3`} />
          <path d={`M${cx} ${cy - 16} v-4`} />
        </g>
      ) : null}
    </g>
  );
}

export function Glyph({ type }: { type: string }) {
  return <ComponentGlyph type={type} />;
}

function SelectionMenu({ circuit, menu, onClose, onRename, onProps, onFit, onResetView }: { circuit: CircuitSession; menu: MenuState; onClose: () => void; onRename: (id: string) => void; onProps: () => void; onFit: () => void; onResetView: () => void }) {
  const node = circuit.doc.nodes.find((item) => item.id === menu.id);
  const wire = circuit.doc.wires.find((item) => item.id === menu.id);
  return (
    <div className="cwb-menu" style={{ left: menu.x, top: menu.y }} role="menu">
      {menu.kind === "canvas" ? (
        <>
          <button type="button" onClick={() => { circuit.paste(); onClose(); }}>Paste</button>
          <button type="button" onClick={() => { circuit.setSelected(circuit.doc.nodes.map((item) => item.id)); onClose(); }}>Select all</button>
          <button type="button" onClick={() => { onFit(); onClose(); }}>Fit circuit</button>
          <button type="button" onClick={() => { onResetView(); onClose(); }}>Reset view</button>
        </>
      ) : menu.kind === "node" ? (
        <>
          <button type="button" onClick={() => { onProps(); onClose(); }}>Properties</button>
          <button type="button" onClick={() => { onRename(menu.id); onClose(); }}>Rename</button>
          <button type="button" onClick={() => { circuit.duplicate(); onClose(); }}>Duplicate</button>
          <button type="button" onClick={() => { circuit.update((doc) => ({ ...doc, nodes: doc.nodes.map((item) => item.id === menu.id ? { ...item, rotation: ((item.rotation ?? 0) + 1) % 4 } : item) })); onClose(); }}>Rotate</button>
          <button type="button" onClick={() => { circuit.update((doc) => patchNode(doc, menu.id, { locked: !node?.locked })); onClose(); }}>{node?.locked ? "Unlock" : "Lock"}</button>
          <button type="button" onClick={() => { circuit.update((doc) => disconnectNode(doc, menu.id)); onClose(); }}>Disconnect all</button>
          <button type="button" onClick={() => { circuit.removeSelection(); onClose(); }}>Delete</button>
        </>
      ) : (
        <>
          <button type="button" onClick={() => { onProps(); onClose(); }}>Properties</button>
          <button type="button" onClick={() => {
            if (!wire) return;
            const from = circuit.doc.nodes.find((item) => item.id === wire.from);
            const to = circuit.doc.nodes.find((item) => item.id === wire.to);
            if (!from || !to) return;
            const start = portPosition(from, wire.fromPort, "out");
            const end = portPosition(to, wire.toPort, "in");
            const added = attachProbe(circuit.doc, wire.id, (start.x + end.x) / 2, (start.y + end.y) / 2 - 28);
            if (!added.error) circuit.commit(added.doc);
            onClose();
          }}>Add probe</button>
          <button type="button" onClick={() => { circuit.commit(deleteWires(circuit.doc, [menu.id])); onClose(); }}>Disconnect</button>
        </>
      )}
    </div>
  );
}

function statusLine(circuit: CircuitSession): string {
  if (circuit.selected.length > 1) return `${circuit.selected.length} components selected`;
  const node = circuit.doc.nodes.find((item) => item.id === circuit.selected[0]);
  if (!node) return "";
  const spec = getComponent(node.type);
  const ports = spec?.ports(node.params) ?? [];
  const out = ports.find((port) => port.dir === "out") ?? ports[0];
  if (node.type === "hex") {
    const nib = Object.fromEntries(["D3", "D2", "D1", "D0"].map((id) => [id, circuit.shown.signals[`${node.id}.${id}`] ?? "X"]));
    return `${node.label} · Hex Digit · ${hexDigit(nib)}`;
  }
  const bit = out ? circuit.shown.signals[`${node.id}.${out.id}`] ?? "X" : "";
  return `${node.label} · ${spec?.displayName ?? node.type}${out ? ` · ${out.name} = ${bit}` : ""}`;
}

function hudMode(gesture: Gesture | null, space: boolean, placing: boolean, renaming: boolean, connecting: boolean): string {
  if (renaming) return "Rename";
  if (gesture?.kind === "wire" || connecting) return "Connect — Esc cancels";
  if (gesture?.kind === "pan" || space) return "Pan";
  if (gesture?.kind === "box") return gesture.dx < gesture.x ? "Marquee crossing" : "Marquee";
  if (gesture?.kind === "move") return gesture.duplicate ? "Duplicate" : "Move";
  if (placing) return "Place — Esc cancels";
  return "Select";
}

export function InspectorPanel({ circuit }: { circuit: CircuitSession }) {
  const id = circuit.selected[0];
  const node = circuit.doc.nodes.find((item) => item.id === id);
  const spec = node ? getComponent(node.type) : undefined;
  if (!node || !spec) {
    return (
      <section className="lgx-card">
        <h3><i>3</i> Gate Properties</h3>
        <p className="tiny">{circuit.doc.nodes.length} components, {circuit.doc.wires.length} wires. Select a component to edit it.</p>
        <p className="tiny">{explainNode(circuit.doc, circuit.sim, circuit.doc.nodes.find((item) => item.type === "output")?.id ?? "")}</p>
      </section>
    );
  }
  const size = nodeSize(spec, node.params, node);
  return (
    <section className="lgx-card">
      <h3><i>3</i> Gate Properties</h3>
      <div className="lgx-prop-head">
        <Glyph type={node.type} />
        <div>
          <strong>{spec.displayName}</strong>
          <p>{spec.description}</p>
        </div>
      </div>
      <label>Label <input aria-label="Gate label" value={node.label} onChange={(event) => circuit.commit(patchNode(circuit.doc, node.id, { label: event.target.value.slice(0, 12) }))} /></label>
      {spec.params.map((param) => (
        <label key={param.id}>{param.label}
          <input aria-label={param.label} type={param.kind === "number" ? "number" : "text"} min={param.min} max={param.max} value={node.params[param.id] ?? param.default} onChange={(event) => {
            const value = param.kind === "number" ? Number(event.target.value) : event.target.value;
            circuit.commit(patchNode(circuit.doc, node.id, { params: { [param.id]: value } }));
          }} />
        </label>
      ))}
      <div className="lgx-pos">
        <span>Position</span>
        <label>X <input aria-label="Position X" value={Math.round(node.x)} onChange={(event) => circuit.commit({ ...circuit.doc, nodes: circuit.doc.nodes.map((item) => item.id === node.id ? { ...item, x: Number(event.target.value) } : item) })} /></label>
        <label>Y <input aria-label="Position Y" value={Math.round(node.y)} onChange={(event) => circuit.commit({ ...circuit.doc, nodes: circuit.doc.nodes.map((item) => item.id === node.id ? { ...item, y: Number(event.target.value) } : item) })} /></label>
      </div>
      <p className="tiny">{explainNode(circuit.doc, circuit.sim, node.id)}</p>
      <p className="tiny">Delay {spec.delay} ns. Size {size.width}×{size.height}.</p>
    </section>
  );
}

export function TruthPanel({ circuit }: { circuit: CircuitSession }) {
  const table = useMemo(() => truthTable(circuit.doc), [circuit.doc]);
  const live = table.inputs.map((input) => signalOf(circuit.sim, input.id, "Y"));
  return (
    <section className="lgx-card">
      <div className="lgx-card-bar">
        <h3><i>4</i> Truth Table</h3>
        <span className="tiny">Rows: {table.rows.length}</span>
      </div>
      <p className="tiny">{table.note}</p>
      {table.tooBig ? null : (
        <table className="lgx-table">
          <thead>
            <tr>{table.inputs.map((input) => <th key={input.id}>{input.label}</th>)}{table.outputs.map((output) => <th key={output.id}>{output.label}</th>)}</tr>
          </thead>
          <tbody>
            {table.rows.map((row, index) => {
              const active = row.values.every((value, bit) => value === live[bit]);
              return (
                <tr key={index} className={active ? "on" : ""} onClick={() => {
                  let next = circuit.doc;
                  table.inputs.forEach((input, bit) => {
                    next = patchNode(next, input.id, { params: { value: row.values[bit] === 1 ? 1 : 0 } });
                  });
                  circuit.commit(next);
                }}>
                  {row.values.map((value, bit) => <td key={`${index}-in-${bit}`}>{value}</td>)}
                  {row.outputs.map((value, bit) => <td key={`${index}-out-${bit}`} className={value === 1 ? "y1" : value === 0 ? "y0" : ""}>{value}</td>)}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

export function TimingPanel({ circuit }: { circuit: CircuitSession }) {
  const names = circuit.doc.nodes.filter((node) => node.type === "input" || node.type === "clock" || node.type === "output" || node.type === "probe").slice(0, 6);
  const frames = circuit.sim.frames.length > 0 ? circuit.sim.frames : [{ time: 0, nodeId: "", signals: circuit.sim.signals }];
  return (
    <section className="lgx-card">
      <div className="lgx-card-bar">
        <h3><i>5</i> Propagation</h3>
        <span className="tiny">t = {frames[Math.min(circuit.frame, frames.length - 1)]?.time ?? 0}</span>
      </div>
      <svg className="lgx-wave" viewBox="0 0 300 140" role="img" aria-label="Propagation waveform">
        {names.map((node, row) => {
          const port = node.type === "output" || node.type === "probe" ? "A" : "Y";
          const top = row * 22 + 8;
          let d = "";
          frames.forEach((frame, index) => {
            const value = frame.signals[`${node.id}.${port}`];
            const high = value === 1;
            const x = 28 + (index / Math.max(1, frames.length - 1)) * 250;
            const y = high ? top : top + 12;
            d += index === 0 ? `M ${x} ${y}` : ` H ${x} V ${y}`;
          });
          return (
            <g key={node.id}>
              <text x="0" y={top + 11} fontSize="10" fontWeight="700" fill="#667085">{node.label}</text>
              <path d={d} fill="none" stroke={node.type === "output" ? "#2f6fed" : "#34507a"} strokeWidth="1.8" />
            </g>
          );
        })}
      </svg>
    </section>
  );
}

export function SettingsPanel({ circuit }: { circuit: CircuitSession }) {
  return (
    <section className="lgx-card">
      <h3><i>6</i> Simulation Settings</h3>
      <label className="lgx-slider">Simulation Speed
        <input aria-label="Animation speed" type="range" min={0.25} max={8} step={0.25} value={circuit.speed} onChange={(event) => circuit.setSpeed(Number(event.target.value))} />
        <b>{circuit.speed}×</b>
      </label>
      <div className="lgx-inline">Show Propagation <Toggle on={circuit.showProp} showLabel={false} onChange={circuit.setShowProp} label="Show propagation in settings" tone="primary" /></div>
      <div className="lgx-inline">Snap to grid <Toggle on={circuit.snap} showLabel={false} onChange={circuit.setSnap} label="Snap to grid" tone="neutral" /></div>
      <p className="tiny">Play runs every clock. Pausing the simulator pauses those clocks. Scroll pans the canvas. Ctrl+scroll zooms toward the pointer. Hold Space or the middle button to pan. Drag a pin to connect. Delete removes the selection.</p>
      <button className="lgx-reset" onClick={circuit.reset}>Reset Simulation</button>
    </section>
  );
}
