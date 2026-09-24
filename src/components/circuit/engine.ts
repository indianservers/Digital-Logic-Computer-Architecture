import { defaultParams, getComponent, nodeFrame, nodeSize } from "./registry";
import type { Bit, CircuitDoc, CircuitNode, CircuitWire, ParamValue, SimFrame, SimResult, TruthReport } from "./types";

const MAX_EVENTS = 500;

export function emptyDoc(): CircuitDoc {
  return { nodes: [], wires: [], nextId: 1 };
}

function sameBits(left: Bit[] | undefined, right: Bit[] | undefined): boolean {
  if (!left || !right || left.length !== right.length) return false;
  return left.every((bit, index) => bit === right[index]);
}

export function addNode(doc: CircuitDoc, type: string, x: number, y: number, label?: string, params?: Record<string, number | string>): CircuitDoc {
  const spec = getComponent(type);
  if (!spec) return doc;
  const id = `n${doc.nextId}`;
  const node: CircuitNode = {
    id,
    type,
    x,
    y,
    label: label ?? spec.displayName,
    params: { ...defaultParams(spec), ...params },
    state: [],
  };
  return { ...doc, nextId: doc.nextId + 1, nodes: [...doc.nodes, node] };
}

export function connect(doc: CircuitDoc, from: string, fromPort: string, to: string, toPort: string): { doc: CircuitDoc; error?: string } {
  const source = doc.nodes.find((node) => node.id === from);
  const sink = doc.nodes.find((node) => node.id === to);
  if (!source || !sink) return { doc, error: "Missing component" };
  const sourceSpec = getComponent(source.type);
  const sinkSpec = getComponent(sink.type);
  if (!sourceSpec || !sinkSpec) return { doc, error: "Unknown component" };
  const out = sourceSpec.ports(source.params).find((port) => port.id === fromPort);
  const inp = sinkSpec.ports(sink.params).find((port) => port.id === toPort);
  if (!out || !inp) return { doc, error: "Unknown pin" };
  if (out.dir !== "out" || inp.dir !== "in") return { doc, error: "Connect an output pin to an input pin" };
  if (doc.wires.some((wire) => wire.to === to && wire.toPort === toPort)) {
    return { doc, error: "That input already has a driver" };
  }
  const wire: CircuitWire = { id: `w${doc.nextId}`, from, fromPort, to, toPort };
  return { doc: { ...doc, nextId: doc.nextId + 1, wires: [...doc.wires, wire] } };
}

export function moveNodes(doc: CircuitDoc, ids: string[], dx: number, dy: number): CircuitDoc {
  const moving = new Set(ids);
  return {
    ...doc,
    nodes: doc.nodes.map((node) => (moving.has(node.id) && !node.locked ? { ...node, x: node.x + dx, y: node.y + dy } : node)),
  };
}

export function deleteNodes(doc: CircuitDoc, ids: string[]): CircuitDoc {
  const drop = new Set(ids);
  return {
    ...doc,
    nodes: doc.nodes.filter((node) => !drop.has(node.id)),
    wires: doc.wires.filter((wire) => !drop.has(wire.from) && !drop.has(wire.to)),
  };
}

export function deleteWires(doc: CircuitDoc, ids: string[]): CircuitDoc {
  const drop = new Set(ids);
  return { ...doc, wires: doc.wires.filter((wire) => !drop.has(wire.id)) };
}

/** Split a wire and place a one-input, one-output part between its ends. */
export function insertOnWire(doc: CircuitDoc, wireId: string, type: string, x: number, y: number): { doc: CircuitDoc; error?: string } {
  const wire = doc.wires.find((item) => item.id === wireId);
  const spec = getComponent(type);
  if (!wire || !spec) return { doc, error: "That part cannot be inserted here" };
  const ports = spec.ports({});
  const input = ports.find((port) => port.dir === "in");
  const output = ports.find((port) => port.dir === "out");
  if (!input || !output || ports.filter((port) => port.dir === "in").length !== 1) {
    return { doc, error: "Drop a NOT, buffer, or delay onto a wire" };
  }
  const placed = addNode(deleteWires(doc, [wireId]), type, x, y);
  const node = placed.nodes[placed.nodes.length - 1];
  if (!node) return { doc, error: "Could not place that part" };
  const first = connect(placed, wire.from, wire.fromPort, node.id, input.id);
  if (first.error) return first;
  return connect(first.doc, node.id, output.id, wire.to, wire.toPort);
}

/** Tap a wire with a probe without breaking the existing connection. */
export function attachProbe(doc: CircuitDoc, wireId: string, x: number, y: number): { doc: CircuitDoc; error?: string } {
  const wire = doc.wires.find((item) => item.id === wireId);
  if (!wire) return { doc, error: "No wire there" };
  const placed = addNode(doc, "probe", x, y, "Probe");
  const node = placed.nodes[placed.nodes.length - 1];
  if (!node) return { doc, error: "Could not place the probe" };
  return connect(placed, wire.from, wire.fromPort, node.id, "A");
}

export function disconnectNode(doc: CircuitDoc, id: string): CircuitDoc {
  return { ...doc, wires: doc.wires.filter((wire) => wire.from !== id && wire.to !== id) };
}

export function patchNode(doc: CircuitDoc, id: string, patch: Partial<Pick<CircuitNode, "label" | "params" | "state" | "x" | "y" | "width" | "height" | "rotation" | "locked" | "labelAt" | "showPorts" | "showLabel" | "delay">>): CircuitDoc {
  return {
    ...doc,
    nodes: doc.nodes.map((node) => {
      if (node.id !== id) return node;
      return { ...node, ...patch, params: patch.params ? { ...node.params, ...patch.params } : node.params };
    }),
    wires: doc.wires.filter((wire) => {
      if (wire.from !== id && wire.to !== id) return true;
      const node = doc.nodes.find((item) => item.id === id);
      if (!node) return false;
      const spec = getComponent(node.type);
      if (!spec) return false;
      const params = id === node.id && patch.params ? { ...node.params, ...patch.params } : node.params;
      const ports = new Set(spec.ports(params).map((port) => port.id));
      if (wire.from === id && !ports.has(wire.fromPort)) return false;
      if (wire.to === id && !ports.has(wire.toPort)) return false;
      return true;
    }),
  };
}

export function duplicateNodes(doc: CircuitDoc, ids: string[]): CircuitDoc {
  let next = doc;
  const map = new Map<string, string>();
  for (const id of ids) {
    const node = doc.nodes.find((item) => item.id === id);
    if (!node) continue;
    const created = addNode(next, node.type, node.x + 36, node.y + 36, node.label, { ...node.params });
    const added = created.nodes[created.nodes.length - 1];
    if (!added) continue;
    created.nodes[created.nodes.length - 1] = {
      ...added,
      state: [...node.state],
      rotation: node.rotation,
      width: node.width,
      height: node.height,
      labelAt: node.labelAt,
      showPorts: node.showPorts,
      showLabel: node.showLabel,
      delay: node.delay,
    };
    map.set(id, added.id);
    next = created;
  }
  for (const wire of doc.wires) {
    const from = map.get(wire.from);
    const to = map.get(wire.to);
    if (!from || !to) continue;
    next = connect(next, from, wire.fromPort, to, wire.toPort).doc;
  }
  return next;
}

function signalKey(id: string, port: string): string {
  return `${id}.${port}`;
}

function driver(doc: CircuitDoc, nodeId: string, portId: string): CircuitWire | undefined {
  return doc.wires.find((wire) => wire.to === nodeId && wire.toPort === portId);
}

export function simulate(doc: CircuitDoc): SimResult {
  const signals: Record<string, Bit> = {};
  const state: Record<string, Bit[]> = {};
  for (const node of doc.nodes) state[node.id] = [...node.state];
  const frames: SimFrame[] = [];
  let warning: string | null = null;
  let seq = 1;
  const sources = doc.nodes.filter((node) => !doc.wires.some((wire) => wire.to === node.id && wire.from !== node.id));
  const queue: Array<{ time: number; nodeId: string; seq: number }> = (sources.length > 0 ? sources : doc.nodes).map((node) => ({ time: 0, nodeId: node.id, seq: seq++ }));
  const visits = new Map<string, number>();
  let events = 0;
  let spins = 0;
  const seen = new Set<string>();

  while (queue.length > 0 && events < MAX_EVENTS) {
    queue.sort((a, b) => a.time - b.time || a.seq - b.seq);
    const event = queue.shift();
    if (!event) break;
    const node = doc.nodes.find((item) => item.id === event.nodeId);
    const spec = node ? getComponent(node.type) : undefined;
    if (!node || !spec) continue;
    const incoming = doc.wires.filter((wire) => wire.to === node.id && wire.from !== node.id);
    const waiting = incoming.some((wire) => !seen.has(wire.from));
    if (waiting && spins < doc.nodes.length + 2) {
      queue.push({ time: event.time, nodeId: node.id, seq: seq++ });
      spins += 1;
      continue;
    }
    spins = 0;
    seen.add(node.id);
    events += 1;
    const visitsForNode = (visits.get(node.id) ?? 0) + 1;
    visits.set(node.id, visitsForNode);
    if (visitsForNode > 48) {
      warning = `Circuit did not reach a stable state after ${events} events.`;
      break;
    }
    const ports = spec.ports(node.params);
    const inputs: Record<string, Bit> = {};
    for (const port of ports.filter((item) => item.dir === "in")) {
      const wire = driver(doc, node.id, port.id);
      const driven = wire ? signals[signalKey(wire.from, wire.fromPort)] : undefined;
      inputs[port.id] = wire ? driven ?? 0 : "X";
    }
    const produced = spec.evaluate({ inputs, state: state[node.id] ?? [], params: node.params });
    if (produced.note) warning = produced.note;
    if (produced.state) state[node.id] = produced.state;
    let changed = false;
    for (const port of ports.filter((item) => item.dir === "out")) {
      const value = produced.outputs[port.id] ?? "X";
      const key = signalKey(node.id, port.id);
      if (signals[key] !== value) {
        signals[key] = value;
        changed = true;
      }
    }
    for (const port of ports.filter((item) => item.dir === "in")) {
      signals[signalKey(node.id, port.id)] = inputs[port.id] ?? "X";
    }
    if (changed || visitsForNode === 1) {
      frames.push({ time: event.time, nodeId: node.id, signals: { ...signals } });
    }
    if (!changed) continue;
    const extra = node.type === "delay" && node.delay === undefined ? numParam(node.params.extra, 0) : 0;
    const when = event.time + (node.delay ?? spec.delay) + extra;
    for (const wire of doc.wires.filter((item) => item.from === node.id)) {
      queue.push({ time: when, nodeId: wire.to, seq: seq++ });
    }
  }
  if (events >= MAX_EVENTS && !warning) warning = `Circuit did not reach a stable state after ${MAX_EVENTS} events.`;
  const time = frames[frames.length - 1]?.time ?? 0;
  return { signals, state, warning, frames, time };
}

function numParam(value: number | string | undefined, fallback: number): number {
  return typeof value === "number" ? value : fallback;
}

export function signalOf(result: SimResult, id: string, port: string): Bit {
  return result.signals[signalKey(id, port)] ?? "X";
}

export function applyState(doc: CircuitDoc, result: SimResult): CircuitDoc {
  let changed = false;
  const nodes = doc.nodes.map((node) => {
    const next = result.state[node.id] ?? [];
    if (sameBits(node.state, next)) return node;
    changed = true;
    return { ...node, state: [...next] };
  });
  return changed ? { ...doc, nodes } : doc;
}

export function truthTable(doc: CircuitDoc): TruthReport {
  const inputs = doc.nodes.filter((node) => node.type === "input");
  const outputs = doc.nodes.filter((node) => node.type === "output" || node.type === "led" || node.type === "probe");
  if (inputs.length > 10) {
    return { inputs: inputs.map(named), outputs: outputs.map(named), rows: [], tooBig: true, note: `${inputs.length} inputs would generate ${2 ** inputs.length} rows. Confirm before running that.` };
  }
  const rows = [];
  for (let index = 0; index < 2 ** inputs.length; index += 1) {
    const values: Bit[] = inputs.map((_, bit) => ((index >> (inputs.length - 1 - bit)) & 1) === 1 ? 1 : 0);
    const forced: CircuitDoc = {
      ...doc,
      nodes: doc.nodes.map((node) => {
        const place = inputs.findIndex((input) => input.id === node.id);
        if (place < 0) return node;
        return { ...node, params: { ...node.params, value: values[place] ?? 0 } };
      }),
    };
    const result = simulate(forced);
    const outs: Bit[] = outputs.map((node) => signalOf(result, node.id, node.type === "output" || node.type === "led" || node.type === "probe" ? "A" : "Y"));
    rows.push({ values, outputs: outs });
  }
  const note = inputs.length === 0 ? "Add input switches to build a truth table from the circuit." : "Each row is simulated on this circuit.";
  return { inputs: inputs.map(named), outputs: outputs.map(named), rows, tooBig: false, note };
}

function named(node: CircuitNode): { id: string; label: string } {
  return { id: node.id, label: node.label };
}

export function explainNode(doc: CircuitDoc, result: SimResult, id: string): string {
  const node = doc.nodes.find((item) => item.id === id);
  const spec = node ? getComponent(node.type) : undefined;
  if (!node || !spec) return "";
  const ports = spec.ports(node.params);
  const names = ports.filter((port) => port.dir === "in").map((port) => {
    const value = signalOf(result, node.id, port.id);
    return `${port.name}=${value}`;
  });
  const outputs = ports.filter((port) => port.dir === "out").map((port) => `${port.name}=${signalOf(result, node.id, port.id)}`);
  const formula = spec.expression?.(ports.filter((port) => port.dir === "in").map((port) => port.name)) ?? spec.description;
  return `${spec.displayName}: ${names.join(", ") || "no inputs"} → ${outputs.join(", ") || "—"}. ${formula}`;
}

export function serialize(doc: CircuitDoc): string {
  return JSON.stringify(doc);
}

export function deserialize(text: string): CircuitDoc | null {
  try {
    const parsed = JSON.parse(text) as CircuitDoc;
    if (!parsed || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.wires) || typeof parsed.nextId !== "number") return null;
    if (parsed.nodes.some((node) => !getComponent(node.type))) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function portPosition(node: CircuitNode, portId: string, dir: "in" | "out"): { x: number; y: number } {
  const spec = getComponent(node.type);
  if (!spec) return { x: node.x, y: node.y };
  const size = nodeSize(spec, node.params, node);
  const ports = spec.ports(node.params).filter((port) => port.dir === dir);
  const index = Math.max(0, ports.findIndex((port) => port.id === portId));
  const y = node.y + ((index + 1) / (ports.length + 1)) * size.height;
  const point = { x: dir === "in" ? node.x : node.x + size.width, y };
  const turns = ((node.rotation ?? 0) % 4 + 4) % 4;
  if (turns === 0) return point;
  const cx = node.x + size.width / 2;
  const cy = node.y + size.height / 2;
  const dx = point.x - cx;
  const dy = point.y - cy;
  if (turns === 1) return { x: cx - dy, y: cy + dx };
  if (turns === 2) return { x: cx - dx, y: cy - dy };
  return { x: cx + dy, y: cy - dx };
}

export function routeWire(x1: number, y1: number, x2: number, y2: number): string {
  const mid = x1 + Math.max(18, (x2 - x1) / 2);
  return `M ${x1} ${y1} H ${mid} V ${y2} H ${x2}`;
}

function place(doc: CircuitDoc, type: string, x: number, y: number, label: string, params?: Record<string, number | string>): CircuitDoc {
  return addNode(doc, type, x, y, label, params);
}

export function starterAndOr(): CircuitDoc {
  let doc = emptyDoc();
  doc = place(doc, "input", 36, 36, "A", { value: 0 });
  doc = place(doc, "input", 36, 118, "B", { value: 1 });
  doc = place(doc, "input", 36, 200, "C", { value: 0 });
  doc = place(doc, "and", 190, 48, "U1");
  doc = place(doc, "and", 190, 176, "U2");
  doc = place(doc, "or", 380, 112, "U3");
  doc = place(doc, "output", 560, 128, "Y");
  const [a, b, c, and1, and2, or, y] = doc.nodes;
  if (!a || !b || !c || !and1 || !and2 || !or || !y) return doc;
  doc = connect(doc, a.id, "Y", and1.id, "A").doc;
  doc = connect(doc, b.id, "Y", and1.id, "B").doc;
  doc = connect(doc, b.id, "Y", and2.id, "A").doc;
  doc = connect(doc, c.id, "Y", and2.id, "B").doc;
  doc = connect(doc, and1.id, "Y", or.id, "A").doc;
  doc = connect(doc, and2.id, "Y", or.id, "B").doc;
  doc = connect(doc, or.id, "Y", y.id, "A").doc;
  return doc;
}

export function starterAbPlusC(): CircuitDoc {
  let doc = emptyDoc();
  doc = place(doc, "input", 36, 28, "A", { value: 1 });
  doc = place(doc, "input", 36, 112, "B", { value: 0 });
  doc = place(doc, "input", 36, 196, "C", { value: 0 });
  doc = place(doc, "and", 200, 40, "AND");
  doc = place(doc, "or", 390, 108, "OR");
  doc = place(doc, "output", 560, 120, "Y");
  const [a, b, c, and, or, y] = doc.nodes;
  if (!a || !b || !c || !and || !or || !y) return doc;
  doc = connect(doc, a.id, "Y", and.id, "A").doc;
  doc = connect(doc, b.id, "Y", and.id, "B").doc;
  doc = connect(doc, and.id, "Y", or.id, "A").doc;
  doc = connect(doc, c.id, "Y", or.id, "B").doc;
  doc = connect(doc, or.id, "Y", y.id, "A").doc;
  return doc;
}

export function muxChallengeBoard(): CircuitDoc {
  let doc = emptyDoc();
  doc = place(doc, "input", 36, 36, "A", { value: 0 });
  doc = place(doc, "input", 36, 120, "B", { value: 1 });
  doc = place(doc, "input", 36, 204, "S", { value: 0 });
  doc = place(doc, "output", 420, 110, "Y");
  return doc;
}

export function exampleHalfAdder(): CircuitDoc {
  let doc = emptyDoc();
  doc = place(doc, "input", 30, 40, "A", { value: 1 });
  doc = place(doc, "input", 30, 140, "B", { value: 1 });
  doc = place(doc, "xor", 200, 50, "SUM");
  doc = place(doc, "and", 200, 160, "CARRY");
  doc = place(doc, "output", 420, 60, "S");
  doc = place(doc, "output", 420, 170, "C");
  const [a, b, xor, and, s, c] = doc.nodes;
  if (!a || !b || !xor || !and || !s || !c) return doc;
  doc = connect(doc, a.id, "Y", xor.id, "A").doc;
  doc = connect(doc, b.id, "Y", xor.id, "B").doc;
  doc = connect(doc, a.id, "Y", and.id, "A").doc;
  doc = connect(doc, b.id, "Y", and.id, "B").doc;
  doc = connect(doc, xor.id, "Y", s.id, "A").doc;
  doc = connect(doc, and.id, "Y", c.id, "A").doc;
  return doc;
}

export function exampleFullAdder(): CircuitDoc {
  let doc = emptyDoc();
  doc = place(doc, "input", 24, 30, "A", { value: 1 });
  doc = place(doc, "input", 24, 110, "B", { value: 1 });
  doc = place(doc, "input", 24, 190, "Cin", { value: 1 });
  doc = place(doc, "fa", 200, 80, "FA");
  doc = place(doc, "output", 420, 70, "S");
  doc = place(doc, "output", 420, 160, "Cout");
  const [a, b, cin, fa, s, cout] = doc.nodes;
  if (!a || !b || !cin || !fa || !s || !cout) return doc;
  doc = connect(doc, a.id, "Y", fa.id, "A").doc;
  doc = connect(doc, b.id, "Y", fa.id, "B").doc;
  doc = connect(doc, cin.id, "Y", fa.id, "CIN").doc;
  doc = connect(doc, fa.id, "S", s.id, "A").doc;
  doc = connect(doc, fa.id, "COUT", cout.id, "A").doc;
  return doc;
}

export function exampleMux(): CircuitDoc {
  let doc = emptyDoc();
  doc = place(doc, "input", 24, 30, "I0", { value: 0 });
  doc = place(doc, "input", 24, 110, "I1", { value: 1 });
  doc = place(doc, "input", 24, 190, "S", { value: 1 });
  doc = place(doc, "mux2", 200, 80, "MUX");
  doc = place(doc, "output", 420, 100, "Y");
  const [i0, i1, s, mux, y] = doc.nodes;
  if (!i0 || !i1 || !s || !mux || !y) return doc;
  doc = connect(doc, i0.id, "Y", mux.id, "I0").doc;
  doc = connect(doc, i1.id, "Y", mux.id, "I1").doc;
  doc = connect(doc, s.id, "Y", mux.id, "S").doc;
  doc = connect(doc, mux.id, "Y", y.id, "A").doc;
  return doc;
}

export function exampleSr(): CircuitDoc {
  let doc = emptyDoc();
  doc = place(doc, "input", 24, 40, "S", { value: 1 });
  doc = place(doc, "input", 24, 140, "R", { value: 0 });
  doc = place(doc, "sr", 200, 70, "SR");
  doc = place(doc, "output", 420, 80, "Q");
  const [s, r, sr, q] = doc.nodes;
  if (!s || !r || !sr || !q) return doc;
  doc = connect(doc, s.id, "Y", sr.id, "S").doc;
  doc = connect(doc, r.id, "Y", sr.id, "R").doc;
  doc = connect(doc, sr.id, "Q", q.id, "A").doc;
  return doc;
}

export function exampleDff(): CircuitDoc {
  let doc = emptyDoc();
  doc = place(doc, "input", 24, 36, "D", { value: 1 });
  doc = place(doc, "clock", 24, 120, "CLK", { level: 0 });
  doc = place(doc, "const", 24, 200, "0", { value: 0 });
  doc = place(doc, "dff", 200, 70, "DFF");
  doc = place(doc, "output", 430, 90, "Q");
  const [d, clk, clr, ff, q] = doc.nodes;
  if (!d || !clk || !clr || !ff || !q) return doc;
  doc = connect(doc, d.id, "Y", ff.id, "D").doc;
  doc = connect(doc, clk.id, "Y", ff.id, "CLK").doc;
  doc = connect(doc, clr.id, "Y", ff.id, "CLR").doc;
  doc = connect(doc, ff.id, "Q", q.id, "A").doc;
  return doc;
}

export function nodeBox(node: CircuitNode): { width: number; height: number } {
  const spec = getComponent(node.type);
  return spec ? nodeSize(spec, node.params, node) : { width: 72, height: 48 };
}

const RATIO_LOCK = new Set(["and", "or", "xor", "nand", "nor", "xnor", "not", "buf"]);

/** Gates keep their current proportions when one side is edited. Larger blocks can change independently. */
export function sizedBox(node: CircuitNode, key: "width" | "height", value: number): { width: number; height: number } {
  const size = nodeBox(node);
  if (!RATIO_LOCK.has(node.type) || size.width <= 0 || size.height <= 0) {
    return key === "width" ? { width: value, height: size.height } : { width: size.width, height: value };
  }
  const ratio = size.width / size.height;
  if (key === "width") return { width: value, height: Math.max(36, Math.round(value / ratio)) };
  return { width: Math.max(48, Math.round(value * ratio)), height: value };
}

export type ResizeCorner = "nw" | "ne" | "sw" | "se";

/** Resize from a corner in world space. The opposite corner stays put. Gates keep their proportions. */
export function resizeNode(node: CircuitNode, corner: ResizeCorner, px: number, py: number): Pick<CircuitNode, "x" | "y" | "width" | "height"> {
  const frame = nodeFrame(node);
  const size = nodeBox(node);
  const turns = ((node.rotation ?? 0) % 4 + 4) % 4;
  const opposite = ({ nw: "se", ne: "sw", sw: "ne", se: "nw" } as const)[corner];
  const corners = {
    nw: { x: frame.x, y: frame.y },
    ne: { x: frame.x + frame.width, y: frame.y },
    sw: { x: frame.x, y: frame.y + frame.height },
    se: { x: frame.x + frame.width, y: frame.y + frame.height },
  };
  const anchor = corners[opposite];
  let left = Math.min(anchor.x, px);
  let right = Math.max(anchor.x, px);
  let top = Math.min(anchor.y, py);
  let bottom = Math.max(anchor.y, py);
  if (RATIO_LOCK.has(node.type) && size.height > 0) {
    const ratio = size.width / size.height;
    let fw = Math.max(36, right - left);
    let fh = Math.max(28, bottom - top);
    if (fw / fh > ratio) fh = fw / ratio;
    else fw = fh * ratio;
    if (px >= anchor.x) { left = anchor.x; right = anchor.x + fw; }
    else { right = anchor.x; left = anchor.x - fw; }
    if (py >= anchor.y) { top = anchor.y; bottom = anchor.y + fh; }
    else { bottom = anchor.y; top = anchor.y - fh; }
  }
  const fw = Math.max(36, right - left);
  const fh = Math.max(28, bottom - top);
  const width = turns % 2 === 1 ? fh : fw;
  const height = turns % 2 === 1 ? fw : fh;
  const cx = (left + right) / 2;
  const cy = (top + bottom) / 2;
  return { x: cx - width / 2, y: cy - height / 2, width, height };
}

export type AlignMode = "left" | "right" | "top" | "bottom" | "cx" | "cy" | "hgap" | "vgap" | "width" | "height";

export function alignNodes(doc: CircuitDoc, ids: string[], mode: AlignMode): CircuitDoc {
  const picked = doc.nodes.filter((node) => ids.includes(node.id) && !node.locked);
  if (picked.length < 2) return doc;
  const frames = picked.map((node) => ({ node, frame: nodeFrame(node) }));
  const shift = new Map<string, { x: number; y: number; width?: number; height?: number }>();
  if (mode === "width" || mode === "height") {
    const first = frames[0];
    if (!first) return doc;
    const box = nodeBox(first.node);
    for (const item of frames) shift.set(item.node.id, mode === "width" ? { x: 0, y: 0, width: box.width } : { x: 0, y: 0, height: box.height });
  } else if (mode === "hgap" || mode === "vgap") {
    const ordered = [...frames].sort((a, b) => mode === "hgap" ? a.frame.x - b.frame.x : a.frame.y - b.frame.y);
    const first = ordered[0];
    const last = ordered[ordered.length - 1];
    if (!first || !last || ordered.length < 3) return doc;
    const span = mode === "hgap" ? last.frame.x - first.frame.x : last.frame.y - first.frame.y;
    ordered.forEach((item, index) => {
      const target = (mode === "hgap" ? first.frame.x : first.frame.y) + (span * index) / (ordered.length - 1);
      const delta = target - (mode === "hgap" ? item.frame.x : item.frame.y);
      shift.set(item.node.id, mode === "hgap" ? { x: delta, y: 0 } : { x: 0, y: delta });
    });
  } else {
    const left = Math.min(...frames.map((item) => item.frame.x));
    const right = Math.max(...frames.map((item) => item.frame.x + item.frame.width));
    const top = Math.min(...frames.map((item) => item.frame.y));
    const bottom = Math.max(...frames.map((item) => item.frame.y + item.frame.height));
    for (const item of frames) {
      const dx = mode === "left" ? left - item.frame.x : mode === "right" ? right - (item.frame.x + item.frame.width) : mode === "cx" ? (left + right) / 2 - (item.frame.x + item.frame.width / 2) : 0;
      const dy = mode === "top" ? top - item.frame.y : mode === "bottom" ? bottom - (item.frame.y + item.frame.height) : mode === "cy" ? (top + bottom) / 2 - (item.frame.y + item.frame.height / 2) : 0;
      shift.set(item.node.id, { x: dx, y: dy });
    }
  }
  return {
    ...doc,
    nodes: doc.nodes.map((node) => {
      const delta = shift.get(node.id);
      if (!delta) return node;
      return { ...node, x: node.x + delta.x, y: node.y + delta.y, width: delta.width ?? node.width, height: delta.height ?? node.height };
    }),
  };
}

export function wiresDropped(doc: CircuitDoc, id: string, params: Record<string, ParamValue>): CircuitWire[] {
  const node = doc.nodes.find((item) => item.id === id);
  const spec = node ? getComponent(node.type) : undefined;
  if (!node || !spec) return [];
  const ports = new Set(spec.ports({ ...node.params, ...params }).map((port) => port.id));
  return doc.wires.filter((wire) => (wire.from === id && !ports.has(wire.fromPort)) || (wire.to === id && !ports.has(wire.toPort)));
}

export function patchWire(doc: CircuitDoc, id: string, patch: Partial<Pick<CircuitWire, "name">>): CircuitDoc {
  return { ...doc, wires: doc.wires.map((wire) => (wire.id === id ? { ...wire, ...patch } : wire)) };
}
