import type { LogicBit, LogicVector, SimulationEvent } from "../../types/logic";
import { evalGate } from "../../simulation/digital/gates";
import type { GateKind } from "../../types/logic";
import { compareMagnitude, fullAdder, halfAdder, rippleAdd } from "./arithmetic";
import { decoder, mux } from "./routing";
import { dFlipFlop, dLatch, jkFlipFlop } from "./sequential";
import { schedule } from "./schedule";
import { isBit } from "./vector";

export type CanvasType =
  | "TOGGLE" | "BUTTON" | "CONST" | "BUS" | "CLOCK"
  | "AND" | "OR" | "NOT" | "NAND" | "NOR" | "XOR" | "XNOR" | "BUF"
  | "HA" | "FA" | "ADD4" | "CMP4" | "MUX2" | "MUX4" | "DEC2"
  | "LED" | "HEX" | "PROBE"
  | "DLATCH" | "DFF" | "JKFF" | "REG4";

export interface CircuitNode {
  id: string;
  type: CanvasType;
  x: number;
  y: number;
  bits: LogicVector;
}

export interface CircuitWire {
  id: string;
  from: string;
  fromPort: string;
  to: string;
  toPort: string;
}

export interface CircuitDoc {
  nodes: CircuitNode[];
  wires: CircuitWire[];
  nextId: number;
}

export interface PortSpec {
  id: string;
  name: string;
  dir: "in" | "out";
  width: number;
}

const GATE: Record<string, GateKind> = {
  AND: "AND", OR: "OR", NOT: "NOT", NAND: "NAND", NOR: "NOR", XOR: "XOR", XNOR: "XNOR", BUF: "BUF",
};

export function portsOf(node: CircuitNode): PortSpec[] {
  const w = Math.max(1, node.bits.length);
  switch (node.type) {
    case "TOGGLE":
    case "BUTTON":
    case "CONST":
    case "CLOCK":
      return [{ id: "Y", name: "Y", dir: "out", width: 1 }];
    case "BUS":
      return [{ id: "Y", name: "Y", dir: "out", width: w }];
    case "NOT":
    case "BUF":
      return [{ id: "A", name: "A", dir: "in", width: 1 }, { id: "Y", name: "Y", dir: "out", width: 1 }];
    case "AND":
    case "OR":
    case "NAND":
    case "NOR":
    case "XOR":
    case "XNOR":
      return [{ id: "A", name: "A", dir: "in", width: 1 }, { id: "B", name: "B", dir: "in", width: 1 }, { id: "Y", name: "Y", dir: "out", width: 1 }];
    case "HA":
      return [{ id: "A", name: "A", dir: "in", width: 1 }, { id: "B", name: "B", dir: "in", width: 1 }, { id: "SUM", name: "S", dir: "out", width: 1 }, { id: "CARRY", name: "C", dir: "out", width: 1 }];
    case "FA":
      return [
        { id: "A", name: "A", dir: "in", width: 1 }, { id: "B", name: "B", dir: "in", width: 1 }, { id: "CIN", name: "Cin", dir: "in", width: 1 },
        { id: "SUM", name: "S", dir: "out", width: 1 }, { id: "COUT", name: "Cout", dir: "out", width: 1 },
      ];
    case "ADD4":
      return [
        { id: "A", name: "A", dir: "in", width: 4 }, { id: "B", name: "B", dir: "in", width: 4 }, { id: "CIN", name: "Cin", dir: "in", width: 1 },
        { id: "S", name: "S", dir: "out", width: 4 }, { id: "COUT", name: "Cout", dir: "out", width: 1 },
      ];
    case "CMP4":
      return [
        { id: "A", name: "A", dir: "in", width: 4 }, { id: "B", name: "B", dir: "in", width: 4 },
        { id: "EQ", name: "=", dir: "out", width: 1 }, { id: "GT", name: ">", dir: "out", width: 1 }, { id: "LT", name: "<", dir: "out", width: 1 },
      ];
    case "MUX2":
      return [{ id: "I0", name: "I0", dir: "in", width: 1 }, { id: "I1", name: "I1", dir: "in", width: 1 }, { id: "S", name: "S", dir: "in", width: 1 }, { id: "Y", name: "Y", dir: "out", width: 1 }];
    case "MUX4":
      return [
        { id: "I0", name: "I0", dir: "in", width: 1 }, { id: "I1", name: "I1", dir: "in", width: 1 }, { id: "I2", name: "I2", dir: "in", width: 1 }, { id: "I3", name: "I3", dir: "in", width: 1 },
        { id: "S1", name: "S1", dir: "in", width: 1 }, { id: "S0", name: "S0", dir: "in", width: 1 }, { id: "Y", name: "Y", dir: "out", width: 1 },
      ];
    case "DEC2":
      return [
        { id: "A", name: "A", dir: "in", width: 1 }, { id: "B", name: "B", dir: "in", width: 1 },
        { id: "Y0", name: "Y0", dir: "out", width: 1 }, { id: "Y1", name: "Y1", dir: "out", width: 1 }, { id: "Y2", name: "Y2", dir: "out", width: 1 }, { id: "Y3", name: "Y3", dir: "out", width: 1 },
      ];
    case "LED":
      return [{ id: "A", name: "A", dir: "in", width: 1 }];
    case "HEX":
      return [{ id: "D", name: "D", dir: "in", width: 4 }];
    case "PROBE":
      return [{ id: "A", name: "A", dir: "in", width: 0 }];
    case "DLATCH":
      return [{ id: "D", name: "D", dir: "in", width: 1 }, { id: "EN", name: "EN", dir: "in", width: 1 }, { id: "Q", name: "Q", dir: "out", width: 1 }];
    case "DFF":
      return [{ id: "D", name: "D", dir: "in", width: 1 }, { id: "CLK", name: "CLK", dir: "in", width: 1 }, { id: "RST", name: "R", dir: "in", width: 1 }, { id: "Q", name: "Q", dir: "out", width: 1 }];
    case "JKFF":
      return [{ id: "J", name: "J", dir: "in", width: 1 }, { id: "K", name: "K", dir: "in", width: 1 }, { id: "CLK", name: "CLK", dir: "in", width: 1 }, { id: "Q", name: "Q", dir: "out", width: 1 }];
    case "REG4":
      return [{ id: "D", name: "D", dir: "in", width: 4 }, { id: "CLK", name: "CLK", dir: "in", width: 1 }, { id: "Q", name: "Q", dir: "out", width: 4 }];
    default:
      return [];
  }
}

export function emptyDoc(): CircuitDoc {
  return { nodes: [], wires: [], nextId: 1 };
}

export function addNode(doc: CircuitDoc, type: CanvasType, x: number, y: number, bits?: LogicVector): CircuitDoc {
  const id = `n${doc.nextId}`;
  const width = type === "BUS" || type === "ADD4" || type === "CMP4" || type === "HEX" || type === "REG4" ? 4 : 1;
  const node: CircuitNode = { id, type, x, y, bits: bits ?? (type === "CONST" ? [1] : Array.from({ length: width }, () => 0)) };
  return { ...doc, nextId: doc.nextId + 1, nodes: [...doc.nodes, node] };
}

export function connect(doc: CircuitDoc, from: string, fromPort: string, to: string, toPort: string): { doc: CircuitDoc; error?: string } {
  const source = doc.nodes.find((node) => node.id === from);
  const sink = doc.nodes.find((node) => node.id === to);
  if (!source || !sink) return { doc, error: "Missing component" };
  const out = portsOf(source).find((port) => port.id === fromPort);
  const inp = portsOf(sink).find((port) => port.id === toPort);
  if (!out || !inp) return { doc, error: "Unknown port" };
  if (out.dir !== "out" || inp.dir !== "in") return { doc, error: "Connect an output to an input" };
  if (from === to) return { doc, error: "A component cannot drive itself directly" };
  if (inp.width !== 0 && out.width !== inp.width) return { doc, error: `Width ${out.width} does not match width ${inp.width}` };
  const wires = doc.wires.filter((wire) => !(wire.to === to && wire.toPort === toPort));
  return { doc: { ...doc, wires: [...wires, { id: `w${doc.nextId}`, from, fromPort, to, toPort }], nextId: doc.nextId + 1 } };
}

function key(id: string, port: string): string {
  return `${id}.${port}`;
}

export interface EvalResult {
  signals: Record<string, LogicVector>;
  warning: string | null;
  nodes: CircuitNode[];
  events: SimulationEvent[];
}

function read(signals: Record<string, LogicVector>, id: string, port: string, width: number): LogicVector {
  return signals[key(id, port)] ?? Array.from({ length: width }, () => "X" as LogicBit);
}

function bit0(vector: LogicVector | undefined): LogicBit {
  return vector?.[0] ?? "X";
}

export function evaluate(doc: CircuitDoc, clock: 0 | 1, prevClock: 0 | 1): EvalResult {
  const signals: Record<string, LogicVector> = {};
  const events: SimulationEvent[] = [];
  for (const node of doc.nodes) {
    if (node.type === "TOGGLE" || node.type === "BUTTON" || node.type === "CONST") signals[key(node.id, "Y")] = [bit0(node.bits) === 1 ? 1 : 0];
    if (node.type === "BUS") signals[key(node.id, "Y")] = node.bits.map((bit) => (bit === 1 ? 1 : 0));
    if (node.type === "CLOCK") signals[key(node.id, "Y")] = [clock];
    if (node.type === "DLATCH" || node.type === "DFF" || node.type === "JKFF") signals[key(node.id, "Q")] = [node.bits[0] === 1 ? 1 : node.bits[0] === "X" ? "X" : 0];
    if (node.type === "REG4") signals[key(node.id, "Q")] = node.bits.slice(0, 4).map((bit) => (bit === 1 ? 1 : 0));
  }
  for (const wire of doc.wires) {
    const driven = signals[key(wire.from, wire.fromPort)];
    if (driven) signals[key(wire.to, wire.toPort)] = driven;
  }

  const pending = new Set(doc.nodes.filter((node) => !(node.type === "TOGGLE" || node.type === "BUTTON" || node.type === "CONST" || node.type === "BUS" || node.type === "CLOCK" || node.type === "LED" || node.type === "HEX" || node.type === "PROBE" || node.type === "DLATCH" || node.type === "DFF" || node.type === "JKFF" || node.type === "REG4")).map((node) => node.id));
  let guard = 0;
  while (pending.size > 0 && guard < doc.nodes.length + 2) {
    guard += 1;
    let progress = false;
    for (const id of [...pending]) {
      const node = doc.nodes.find((item) => item.id === id);
      if (!node) continue;
      const inputs = portsOf(node).filter((port) => port.dir === "in");
      if (inputs.some((port) => signals[key(node.id, port.id)] === undefined)) continue;
      const produced = produce(node, signals);
      Object.entries(produced).forEach(([port, value]) => {
        signals[key(node.id, port)] = value;
      });
      pending.delete(id);
      progress = true;
      for (const wire of doc.wires.filter((item) => item.from === id)) {
        const value = signals[key(id, wire.fromPort)];
        if (value) signals[key(wire.to, wire.toPort)] = value;
      }
    }
    if (!progress) break;
  }
  const warning = pending.size > 0 ? "Combinational loop. Those outputs are marked X instead of oscillating." : null;
  for (const id of pending) {
    const node = doc.nodes.find((item) => item.id === id);
    if (!node) continue;
    portsOf(node).filter((port) => port.dir === "out").forEach((port) => {
      signals[key(id, port.id)] = Array.from({ length: Math.max(1, port.width) }, () => "X");
    });
  }

  const nodes: CircuitNode[] = doc.nodes.map((node): CircuitNode => {
    if (node.type === "DLATCH") {
      const next = dLatch(bit0(read(signals, node.id, "D", 1)), bit0(read(signals, node.id, "EN", 1)), node.bits[0] === 1 ? 1 : 0);
      signals[key(node.id, "Q")] = [next.q === 1 ? 1 : next.q === "X" ? "X" : 0];
      return { ...node, bits: [signals[key(node.id, "Q")]?.[0] ?? 0] };
    }
    if (node.type === "DFF") {
      const prev = node.bits[1] === 0 || node.bits[1] === 1 ? node.bits[1] : prevClock;
      const clk = bit0(signals[key(node.id, "CLK")]);
      const next = dFlipFlop(bit0(read(signals, node.id, "D", 1)), clk, prev, node.bits[0] === 1 ? 1 : 0, "rise", bit0(signals[key(node.id, "RST")]));
      if (next.q !== node.bits[0]) events.push({ time: 1, componentId: node.id, portId: "Q", value: next.q === "X" ? "X" : [next.q === 1 ? 1 : 0], eventType: "clock-rise" });
      const stored: LogicBit = next.q === 1 ? 1 : next.q === "X" ? "X" : 0;
      signals[key(node.id, "Q")] = [stored];
      return { ...node, bits: [stored, clk === 1 ? 1 : 0] };
    }
    if (node.type === "JKFF") {
      const prev = node.bits[1] === 0 || node.bits[1] === 1 ? node.bits[1] : prevClock;
      const clk = bit0(signals[key(node.id, "CLK")]);
      const next = jkFlipFlop(bit0(read(signals, node.id, "J", 1)), bit0(read(signals, node.id, "K", 1)), clk, prev, node.bits[0] === 1 ? 1 : 0, "rise");
      signals[key(node.id, "Q")] = [next.q === 1 ? 1 : 0];
      return { ...node, bits: [signals[key(node.id, "Q")]?.[0] ?? 0, clk === 1 ? 1 : 0] };
    }
    if (node.type === "REG4") {
      const prev = node.bits[4] === 0 || node.bits[4] === 1 ? node.bits[4] : prevClock;
      const clk = bit0(signals[key(node.id, "CLK")]);
      const data = read(signals, node.id, "D", 4);
      const stored: LogicVector = risingClock(prev, clk) && data.every(isBit) ? data.map((bit) => (bit === 1 ? 1 : 0)) : node.bits.slice(0, 4).map((bit) => (bit === 1 ? 1 : 0));
      signals[key(node.id, "Q")] = stored;
      return { ...node, bits: [...stored, clk === 1 ? 1 : 0] };
    }
    return node;
  });
  for (const wire of doc.wires) {
    const driven = signals[key(wire.from, wire.fromPort)];
    if (driven) signals[key(wire.to, wire.toPort)] = driven;
  }
  return { signals, warning, nodes, events: events.reduce<SimulationEvent[]>((queue, event) => schedule(queue, event), []) };
}

function risingClock(prev: LogicBit, next: LogicBit): boolean {
  return prev === 0 && next === 1;
}

function produce(node: CircuitNode, signals: Record<string, LogicVector>): Record<string, LogicVector> {
  const gate = GATE[node.type];
  if (gate) {
    const inputs = portsOf(node).filter((port) => port.dir === "in").map((port) => bit0(signals[key(node.id, port.id)]));
    return { Y: [evalGate(gate, inputs)] };
  }
  if (node.type === "HA") {
    const result = halfAdder(bit0(signals[key(node.id, "A")]), bit0(signals[key(node.id, "B")]));
    return { SUM: [result.sum], CARRY: [result.carry] };
  }
  if (node.type === "FA") {
    const result = fullAdder(bit0(signals[key(node.id, "A")]), bit0(signals[key(node.id, "B")]), bit0(signals[key(node.id, "CIN")]));
    return { SUM: [result.sum], COUT: [result.cout] };
  }
  if (node.type === "ADD4") {
    const added = rippleAdd(read(signals, node.id, "A", 4), read(signals, node.id, "B", 4), bit0(signals[key(node.id, "CIN")]));
    return { S: added.sum, COUT: [added.cout] };
  }
  if (node.type === "CMP4") {
    const result = compareMagnitude(read(signals, node.id, "A", 4), read(signals, node.id, "B", 4));
    return { EQ: [result.eq], GT: [result.gt], LT: [result.lt] };
  }
  if (node.type === "MUX2") {
    const result = mux([bit0(signals[key(node.id, "I0")]), bit0(signals[key(node.id, "I1")])], [bit0(signals[key(node.id, "S")])]);
    return { Y: [result.y] };
  }
  if (node.type === "MUX4") {
    const result = mux(
      [bit0(signals[key(node.id, "I0")]), bit0(signals[key(node.id, "I1")]), bit0(signals[key(node.id, "I2")]), bit0(signals[key(node.id, "I3")])],
      [bit0(signals[key(node.id, "S1")]), bit0(signals[key(node.id, "S0")])],
    );
    return { Y: [result.y] };
  }
  if (node.type === "DEC2") {
    const outs = decoder([bit0(signals[key(node.id, "A")]), bit0(signals[key(node.id, "B")])]);
    return { Y0: [outs[0] ?? 0], Y1: [outs[1] ?? 0], Y2: [outs[2] ?? 0], Y3: [outs[3] ?? 0] };
  }
  return {};
}

export function deleteNodes(doc: CircuitDoc, ids: string[]): CircuitDoc {
  const drop = new Set(ids);
  return {
    ...doc,
    nodes: doc.nodes.filter((node) => !drop.has(node.id)),
    wires: doc.wires.filter((wire) => !drop.has(wire.from) && !drop.has(wire.to)),
  };
}

export function deleteWire(doc: CircuitDoc, id: string): CircuitDoc {
  return { ...doc, wires: doc.wires.filter((wire) => wire.id !== id) };
}

export function moveNode(doc: CircuitDoc, id: string, x: number, y: number): CircuitDoc {
  return { ...doc, nodes: doc.nodes.map((node) => (node.id === id ? { ...node, x, y } : node)) };
}

export function duplicateNodes(doc: CircuitDoc, ids: string[]): CircuitDoc {
  let next = doc;
  const map = new Map<string, string>();
  for (const id of ids) {
    const node = doc.nodes.find((item) => item.id === id);
    if (!node) continue;
    const created = addNode(next, node.type, node.x + 28, node.y + 28, [...node.bits]);
    const added = created.nodes[created.nodes.length - 1];
    if (added) map.set(id, added.id);
    next = created;
  }
  for (const wire of doc.wires) {
    const from = map.get(wire.from);
    const to = map.get(wire.to);
    if (!from || !to) continue;
    const linked = connect(next, from, wire.fromPort, to, wire.toPort);
    next = linked.doc;
  }
  return next;
}

export function twoGateTemplate(): CircuitDoc {
  let doc = emptyDoc();
  doc = addNode(doc, "TOGGLE", 40, 40, [0]);
  doc = addNode(doc, "TOGGLE", 40, 120, [1]);
  doc = addNode(doc, "AND", 180, 70);
  doc = addNode(doc, "NOT", 320, 70);
  doc = addNode(doc, "LED", 460, 70);
  const [a, b, and, not, led] = doc.nodes;
  if (!a || !b || !and || !not || !led) return doc;
  doc = connect(doc, a.id, "Y", and.id, "A").doc;
  doc = connect(doc, b.id, "Y", and.id, "B").doc;
  doc = connect(doc, and.id, "Y", not.id, "A").doc;
  doc = connect(doc, not.id, "Y", led.id, "A").doc;
  return doc;
}

export function majorityTemplate(): CircuitDoc {
  let doc = emptyDoc();
  doc = addNode(doc, "TOGGLE", 20, 20, [1]);
  doc = addNode(doc, "TOGGLE", 20, 90, [1]);
  doc = addNode(doc, "TOGGLE", 20, 160, [0]);
  doc = addNode(doc, "AND", 160, 20);
  doc = addNode(doc, "AND", 160, 90);
  doc = addNode(doc, "AND", 160, 160);
  doc = addNode(doc, "OR", 300, 40);
  doc = addNode(doc, "OR", 430, 100);
  doc = addNode(doc, "LED", 560, 100);
  const [a, b, c, ab, bc, ca, or1, or2, led] = doc.nodes;
  if (!a || !b || !c || !ab || !bc || !ca || !or1 || !or2 || !led) return doc;
  doc = connect(doc, a.id, "Y", ab.id, "A").doc;
  doc = connect(doc, b.id, "Y", ab.id, "B").doc;
  doc = connect(doc, b.id, "Y", bc.id, "A").doc;
  doc = connect(doc, c.id, "Y", bc.id, "B").doc;
  doc = connect(doc, c.id, "Y", ca.id, "A").doc;
  doc = connect(doc, a.id, "Y", ca.id, "B").doc;
  doc = connect(doc, ab.id, "Y", or1.id, "A").doc;
  doc = connect(doc, bc.id, "Y", or1.id, "B").doc;
  doc = connect(doc, or1.id, "Y", or2.id, "A").doc;
  doc = connect(doc, ca.id, "Y", or2.id, "B").doc;
  doc = connect(doc, or2.id, "Y", led.id, "A").doc;
  return doc;
}

export function parityTemplate(): CircuitDoc {
  let doc = emptyDoc();
  doc = addNode(doc, "TOGGLE", 20, 30, [1]);
  doc = addNode(doc, "TOGGLE", 20, 100, [0]);
  doc = addNode(doc, "TOGGLE", 20, 170, [1]);
  doc = addNode(doc, "XOR", 170, 50);
  doc = addNode(doc, "XOR", 320, 90);
  doc = addNode(doc, "LED", 470, 90);
  const [a, b, c, x1, x2, led] = doc.nodes;
  if (!a || !b || !c || !x1 || !x2 || !led) return doc;
  doc = connect(doc, a.id, "Y", x1.id, "A").doc;
  doc = connect(doc, b.id, "Y", x1.id, "B").doc;
  doc = connect(doc, x1.id, "Y", x2.id, "A").doc;
  doc = connect(doc, c.id, "Y", x2.id, "B").doc;
  doc = connect(doc, x2.id, "Y", led.id, "A").doc;
  return doc;
}

export const TEMPLATES: Array<{ id: string; name: string; build: () => CircuitDoc }> = [
  { id: "two-gate", name: "Two-gate chain", build: twoGateTemplate },
  { id: "majority", name: "Majority", build: majorityTemplate },
  { id: "parity", name: "Parity", build: parityTemplate },
  { id: "half", name: "Half adder", build: () => chainMath("HA") },
  { id: "full", name: "Full adder", build: () => chainMath("FA") },
  { id: "add4", name: "4-bit adder", build: () => busMath("ADD4") },
  { id: "cmp", name: "Comparator", build: () => busMath("CMP4") },
];

function chainMath(type: "HA" | "FA"): CircuitDoc {
  let doc = emptyDoc();
  doc = addNode(doc, "TOGGLE", 30, 30, [1]);
  doc = addNode(doc, "TOGGLE", 30, 100, [1]);
  if (type === "FA") doc = addNode(doc, "TOGGLE", 30, 170, [0]);
  doc = addNode(doc, type, 180, 80);
  doc = addNode(doc, "LED", 360, 60);
  doc = addNode(doc, "LED", 360, 130);
  const inputs = doc.nodes.filter((node) => node.type === "TOGGLE");
  const math = doc.nodes.find((node) => node.type === type);
  const leds = doc.nodes.filter((node) => node.type === "LED");
  if (!math || !leds[0] || !leds[1] || !inputs[0] || !inputs[1]) return doc;
  doc = connect(doc, inputs[0].id, "Y", math.id, "A").doc;
  doc = connect(doc, inputs[1].id, "Y", math.id, "B").doc;
  if (type === "FA" && inputs[2]) doc = connect(doc, inputs[2].id, "Y", math.id, "CIN").doc;
  doc = connect(doc, math.id, "SUM", leds[0].id, "A").doc;
  doc = connect(doc, math.id, type === "HA" ? "CARRY" : "COUT", leds[1].id, "A").doc;
  return doc;
}

function busMath(type: "ADD4" | "CMP4"): CircuitDoc {
  let doc = emptyDoc();
  doc = addNode(doc, "BUS", 30, 40, [1, 1, 0, 1]);
  doc = addNode(doc, "BUS", 30, 140, [0, 1, 1, 0]);
  doc = addNode(doc, type, 200, 80);
  doc = addNode(doc, type === "ADD4" ? "HEX" : "PROBE", 400, 80);
  const [a, b, math, out] = doc.nodes;
  if (!a || !b || !math || !out) return doc;
  doc = connect(doc, a.id, "Y", math.id, "A").doc;
  doc = connect(doc, b.id, "Y", math.id, "B").doc;
  if (type === "ADD4") doc = connect(doc, math.id, "S", out.id, "D").doc;
  return doc;
}

export function signalText(value: LogicVector | undefined): string {
  if (!value || value.length === 0) return "—";
  return value.map((bit) => (bit === 0 || bit === 1 ? String(bit) : bit)).join("");
}
