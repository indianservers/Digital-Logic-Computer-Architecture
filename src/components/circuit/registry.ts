import { fullAdder, halfAdder, halfSubtractor, fullSubtractor } from "../../engines/digital/arithmetic";
import { decoder, mux } from "../../engines/digital/routing";
import { dFlipFlop, dLatch, jkFlipFlop, srNor, tFlipFlop } from "../../engines/digital/sequential";
import { evalGate } from "../../simulation/digital/gates";
import type { Bit, CircuitNode, ComponentSpec, EvalInput, EvalOutput, ParamValue, PortSpec } from "./types";

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

function num(params: Record<string, ParamValue>, id: string, fallback: number): number {
  const value = params[id];
  return typeof value === "number" ? value : fallback;
}

function bit(value: Bit | undefined): Bit {
  return value ?? "X";
}

function echo(ids: string[], input: EvalInput): EvalOutput {
  return { outputs: Object.fromEntries(ids.map((id) => [id, bit(input.inputs[id])])) };
}

function pins(ids: Array<[string, string]>): PortSpec[] {
  return ids.map(([id, name]) => ({ id, name, dir: "in" as const }));
}

/** 0–F from D3…D0. Any open, X, or Z pin reads as X. This does not decode a 7-segment. */
export function hexDigit(values: Record<string, Bit | undefined>): string {
  const bits = ["D3", "D2", "D1", "D0"].map((id) => values[id]);
  if (bits.some((value) => value !== 0 && value !== 1)) return "X";
  const nibble = bits.reduce<number>((acc, value, index) => acc + (value === 1 ? 2 ** (3 - index) : 0), 0);
  return nibble.toString(16).toUpperCase();
}

function level(value: Bit): 0 | 1 | "X" {
  if (value === 1) return 1;
  if (value === 0) return 0;
  return "X";
}

function gatePorts(kind: string, params: Record<string, ParamValue>): PortSpec[] {
  const count = kind === "NOT" || kind === "BUF" ? 1 : Math.min(8, Math.max(2, num(params, "inputs", 2)));
  const inputs = LETTERS.slice(0, count).map((name) => ({ id: name, name, dir: "in" as const }));
  return [...inputs, { id: "Y", name: "Y", dir: "out" }];
}

function gateEval(kind: "AND" | "OR" | "NOT" | "NAND" | "NOR" | "XOR" | "XNOR" | "BUF", input: EvalInput): EvalOutput {
  const names = Object.keys(input.inputs);
  const values = names.map((name) => input.inputs[name] ?? "X");
  return { outputs: { Y: evalGate(kind, values) } };
}

function display(type: string, displayName: string, description: string, width: number, height: number, ports: ComponentSpec["ports"], params: ComponentSpec["params"] = []): ComponentSpec {
  return {
    type,
    category: "displays",
    displayName,
    description,
    delay: 0,
    width,
    height,
    params,
    ports,
    evaluate: (input) => echo(ports(input.params).map((port) => port.id), input),
  };
}

function gate(type: string, category: string, displayName: string, kind: "AND" | "OR" | "NOT" | "NAND" | "NOR" | "XOR" | "XNOR" | "BUF", description: string, expression: (names: string[]) => string): ComponentSpec {
  const unary = kind === "NOT" || kind === "BUF";
  return {
    type,
    category,
    displayName,
    description,
    delay: 1,
    width: 86,
    height: 64,
    params: unary ? [] : [{ id: "inputs", label: "Inputs", kind: "number", min: 2, max: 8, default: 2 }],
    ports: (params) => gatePorts(unary ? "NOT" : "AND", params),
    evaluate: (input) => gateEval(kind, input),
    expression,
  };
}

function source(type: string, displayName: string, description: string, extra: ComponentSpec["params"] = []): ComponentSpec {
  return {
    type,
    category: "io",
    displayName,
    description,
    delay: 0,
    width: 72,
    height: 48,
    params: extra,
    ports: () => [{ id: "Y", name: "Y", dir: "out" }],
    evaluate: (input) => ({ outputs: { Y: bit(input.inputs.Y) } }),
  };
}

function hold(state: Bit[], next: Bit): Bit[] {
  return [next === "Z" ? state[0] ?? "X" : next];
}

const specs: ComponentSpec[] = [
  {
    ...source("input", "Input", "A switch the learner toggles. Drives one net."),
    evaluate: (input) => ({ outputs: { Y: num(input.params, "value", 0) === 1 ? 1 : 0 } }),
    params: [{ id: "value", label: "Value", kind: "number", min: 0, max: 1, default: 0 }],
  },
  {
    ...source("const", "Constant", "Tied 0 or tied 1."),
    evaluate: (input) => ({ outputs: { Y: num(input.params, "value", 0) === 1 ? 1 : 0 } }),
    params: [{ id: "value", label: "Value", kind: "number", min: 0, max: 1, default: 0 }],
  },
  {
    ...source("button", "Button", "Momentary 1 while pressed, otherwise 0."),
    evaluate: (input) => {
      const down = num(input.params, "pressed", 0) === 1;
      const closed = num(input.params, "mode", 0) === 1;
      return { outputs: { Y: down === closed ? 0 : 1 } };
    },
    params: [
      { id: "pressed", label: "Pressed", kind: "number", min: 0, max: 1, default: 0 },
      { id: "mode", label: "Normally closed", kind: "number", min: 0, max: 1, default: 0 },
    ],
  },
  {
    ...source("clock", "Clock", "Square wave. Pauses when the simulator is paused."),
    category: "timing",
    evaluate: (input) => ({ outputs: { Y: num(input.params, "level", 0) === 1 ? 1 : 0 } }),
    params: [
      { id: "level", label: "Level", kind: "number", min: 0, max: 1, default: 0 },
      { id: "hold", label: "Hold (steps)", kind: "number", min: 1, max: 8, default: 1 },
    ],
    expression: () => "CLK",
  },
  {
    type: "output",
    category: "io",
    displayName: "Output",
    description: "Primary output. The truth table reads this pin.",
    delay: 0,
    width: 64,
    height: 48,
    params: [],
    ports: () => [{ id: "A", name: "A", dir: "in" }],
    evaluate: (input) => ({ outputs: { A: bit(input.inputs.A) } }),
  },
  {
    type: "led",
    category: "displays",
    displayName: "LED",
    description: "Lights when the input matches the active level. Active-high by default.",
    delay: 0,
    width: 56,
    height: 48,
    params: [{ id: "active", label: "Active high", kind: "number", min: 0, max: 1, default: 1 }],
    ports: () => [{ id: "A", name: "A", dir: "in" }],
    evaluate: (input) => ({ outputs: { A: bit(input.inputs.A) } }),
  },
  {
    type: "probe",
    category: "io",
    displayName: "Probe",
    description: "Names a net and shows its live value.",
    delay: 0,
    width: 72,
    height: 44,
    params: [],
    ports: () => [{ id: "A", name: "A", dir: "in" }],
    evaluate: (input) => ({ outputs: { A: bit(input.inputs.A) } }),
  },
  display("bulb", "Bulb", "Round lamp. Glows when the input is 1.", 56, 64, () => pins([["A", "A"]])),
  display("buzzer", "Buzzer", "Speaker that pulses while the input is 1.", 64, 56, () => pins([["A", "A"]])),
  display("bicolor", "Bi-color LED", "Red from R, green from G. Both pins light yellow.", 72, 64, () => pins([["R", "R"], ["G", "G"]])),
  display("rgb", "RGB LED", "Color is the R, G, and B bits. No hidden mixer.", 72, 72, () => pins([["R", "R"], ["G", "G"], ["B", "B"]])),
  display("bar", "LED Bar", "One lamp per pin. Use 4 on a decoder, or 8.", 96, 88, (params) => {
    const count = Math.min(8, Math.max(4, num(params, "lamps", 4)));
    return pins(Array.from({ length: count }, (_, index) => [`L${index}`, `L${index}`]));
  }, [{ id: "lamps", label: "Lamps", kind: "number", min: 4, max: 8, default: 4 }]),
  display("hex", "Hex Digit", "Shows 0–F from D3…D0. Any unconnected pin shows X.", 80, 88, () => pins([["D3", "D3"], ["D2", "D2"], ["D1", "D1"], ["D0", "D0"]])),
  display("seg7", "7-Segment", "Each segment follows its own wire. It does not decode a number.", 108, 150, (params) => {
    const names: Array<[string, string]> = [["a", "a"], ["b", "b"], ["c", "c"], ["d", "d"], ["e", "e"], ["f", "f"], ["g", "g"]];
    if (num(params, "dp", 1) !== 0) names.push(["dp", "DP"]);
    return pins(names);
  }, [{ id: "dp", label: "Decimal point pin", kind: "number", min: 0, max: 1, default: 1 }]),
  display("traffic", "Traffic Lamp", "Three lamps, R, Y, and G, in one housing.", 72, 120, () => pins([["R", "R"], ["Y", "Y"], ["G", "G"]])),
  display("lights", "Traffic Lights", "North/south and east/west lamps for a junction lab.", 150, 132, () => pins([["NSR", "NS R"], ["NSY", "NS Y"], ["NSG", "NS G"], ["EWR", "EW R"], ["EWY", "EW Y"], ["EWG", "EW G"]])),
  display("motor", "Motor", "The rotor turns while the input is 1.", 72, 72, () => pins([["A", "A"]])),
  display("relay", "Relay", "The contact closes on 1. The coil is only a display.", 96, 64, () => pins([["A", "A"]])),
  gate("buf", "basic", "BUF", "BUF", "Copies its input.", (names) => names[0] ?? "A"),
  gate("not", "basic", "NOT", "NOT", "Inverts a single input.", (names) => `${names[0] ?? "A"}'`),
  gate("and", "basic", "AND", "AND", "1 only when every input is 1.", (names) => names.join(" · ")),
  gate("or", "basic", "OR", "OR", "1 when at least one input is 1.", (names) => names.join(" + ")),
  gate("xor", "special", "XOR", "XOR", "1 when an odd number of inputs are 1.", (names) => names.join(" ⊕ ")),
  gate("nand", "universal", "NAND", "NAND", "AND, then invert.", (names) => `(${names.join(" · ")})'`),
  gate("nor", "universal", "NOR", "NOR", "OR, then invert.", (names) => `(${names.join(" + ")})'`),
  gate("xnor", "special", "XNOR", "XNOR", "1 when the inputs match.", (names) => `(${names.join(" ⊕ ")})'`),
  {
    type: "ha",
    category: "combinational",
    displayName: "Half adder",
    description: "Sum = A ⊕ B. Carry = A · B.",
    delay: 2,
    width: 96,
    height: 72,
    params: [],
    ports: () => [
      { id: "A", name: "A", dir: "in" }, { id: "B", name: "B", dir: "in" },
      { id: "S", name: "S", dir: "out" }, { id: "C", name: "C", dir: "out" },
    ],
    evaluate: (input) => {
      const result = halfAdder(bit(input.inputs.A), bit(input.inputs.B));
      return { outputs: { S: result.sum, C: result.carry } };
    },
    expression: () => "S = A ⊕ B, C = A · B",
  },
  {
    type: "fa",
    category: "combinational",
    displayName: "Full adder",
    description: "Sum and carry of A, B, and Cin.",
    delay: 2,
    width: 104,
    height: 84,
    params: [],
    ports: () => [
      { id: "A", name: "A", dir: "in" }, { id: "B", name: "B", dir: "in" }, { id: "CIN", name: "Cin", dir: "in" },
      { id: "S", name: "S", dir: "out" }, { id: "COUT", name: "Cout", dir: "out" },
    ],
    evaluate: (input) => {
      const result = fullAdder(bit(input.inputs.A), bit(input.inputs.B), bit(input.inputs.CIN));
      return { outputs: { S: result.sum, COUT: result.cout } };
    },
    expression: () => "S = A ⊕ B ⊕ Cin",
  },
  {
    type: "hsub",
    category: "arithmetic",
    displayName: "Half subtractor",
    description: "Difference and borrow of A minus B.",
    delay: 2,
    width: 110,
    height: 72,
    params: [],
    ports: () => [
      { id: "A", name: "A", dir: "in" }, { id: "B", name: "B", dir: "in" },
      { id: "D", name: "D", dir: "out" }, { id: "BO", name: "Bout", dir: "out" },
    ],
    evaluate: (input) => {
      const result = halfSubtractor(bit(input.inputs.A), bit(input.inputs.B));
      return { outputs: { D: result.diff, BO: result.borrow } };
    },
  },
  {
    type: "fsub",
    category: "arithmetic",
    displayName: "Full subtractor",
    description: "Difference and borrow with borrow-in.",
    delay: 2,
    width: 116,
    height: 84,
    params: [],
    ports: () => [
      { id: "A", name: "A", dir: "in" }, { id: "B", name: "B", dir: "in" }, { id: "BIN", name: "Bin", dir: "in" },
      { id: "D", name: "D", dir: "out" }, { id: "BOUT", name: "Bout", dir: "out" },
    ],
    evaluate: (input) => {
      const result = fullSubtractor(bit(input.inputs.A), bit(input.inputs.B), bit(input.inputs.BIN));
      return { outputs: { D: result.diff, BOUT: result.bout } };
    },
  },
  {
    type: "mux2",
    category: "combinational",
    displayName: "MUX 2:1",
    description: "Y follows I0 when S is 0, and I1 when S is 1.",
    delay: 2,
    width: 96,
    height: 78,
    params: [],
    ports: () => [
      { id: "I0", name: "I0", dir: "in" }, { id: "I1", name: "I1", dir: "in" }, { id: "S", name: "S", dir: "in" },
      { id: "Y", name: "Y", dir: "out" },
    ],
    evaluate: (input) => ({ outputs: { Y: mux([bit(input.inputs.I0), bit(input.inputs.I1)], [bit(input.inputs.S)]).y } }),
    expression: () => "Y = S'·I0 + S·I1",
  },
  {
    type: "dec2",
    category: "combinational",
    displayName: "Decoder 2:4",
    description: "One of Y0–Y3 is 1 for the binary address AB.",
    delay: 2,
    width: 110,
    height: 96,
    params: [],
    ports: () => [
      { id: "A", name: "A", dir: "in" }, { id: "B", name: "B", dir: "in" },
      { id: "Y0", name: "Y0", dir: "out" }, { id: "Y1", name: "Y1", dir: "out" }, { id: "Y2", name: "Y2", dir: "out" }, { id: "Y3", name: "Y3", dir: "out" },
    ],
    evaluate: (input) => {
      const outs = decoder([bit(input.inputs.A), bit(input.inputs.B)]);
      return { outputs: { Y0: outs[0] ?? "X", Y1: outs[1] ?? "X", Y2: outs[2] ?? "X", Y3: outs[3] ?? "X" } };
    },
  },
  {
    type: "sr",
    category: "sequential",
    displayName: "SR latch",
    description: "NOR latch. S sets Q, R clears Q. S=R=1 is invalid.",
    delay: 1,
    width: 96,
    height: 72,
    params: [],
    ports: () => [
      { id: "S", name: "S", dir: "in" }, { id: "R", name: "R", dir: "in" },
      { id: "Q", name: "Q", dir: "out" }, { id: "QN", name: "Q'", dir: "out" },
    ],
    evaluate: (input) => {
      const current = level(input.state[0] ?? "X");
      const next = srNor(bit(input.inputs.S), bit(input.inputs.R), current);
      const q: Bit = next.q === 1 ? 1 : next.q === 0 ? 0 : "X";
      const qn: Bit = q === 1 ? 0 : q === 0 ? 1 : "X";
      return { outputs: { Q: q, QN: qn }, state: hold(input.state, q), note: next.label === "invalid" ? "S and R are both 1." : undefined };
    },
  },
  {
    type: "dlatch",
    category: "sequential",
    displayName: "D latch",
    description: "Transparent while EN is 1. Holds Q while EN is 0.",
    delay: 1,
    width: 96,
    height: 72,
    params: [],
    ports: () => [
      { id: "D", name: "D", dir: "in" }, { id: "EN", name: "EN", dir: "in" },
      { id: "Q", name: "Q", dir: "out" }, { id: "QN", name: "Q'", dir: "out" },
    ],
    evaluate: (input) => {
      const current = level(input.state[0] ?? 0);
      const next = dLatch(bit(input.inputs.D), bit(input.inputs.EN), current);
      const q: Bit = next.q === 1 ? 1 : next.q === 0 ? 0 : "X";
      return { outputs: { Q: q, QN: q === 1 ? 0 : q === 0 ? 1 : "X" }, state: [q] };
    },
  },
  {
    type: "dff",
    category: "sequential",
    displayName: "D flip-flop",
    description: "Copies D to Q on the rising clock edge. CLR forces Q to 0.",
    delay: 1,
    width: 104,
    height: 84,
    params: [{ id: "edge", label: "Rising edge", kind: "number", min: 0, max: 1, default: 1 }],
    ports: () => [
      { id: "D", name: "D", dir: "in" }, { id: "CLK", name: "CLK", dir: "in" }, { id: "CLR", name: "CLR", dir: "in" },
      { id: "Q", name: "Q", dir: "out" }, { id: "QN", name: "Q'", dir: "out" },
    ],
    evaluate: (input) => {
      const q0 = level(input.state[0] ?? 0);
      const prev = input.state[1] === 0 || input.state[1] === 1 ? input.state[1] : 0;
      const clk = bit(input.inputs.CLK);
      const clr = bit(input.inputs.CLR);
      const next = dFlipFlop(bit(input.inputs.D), clk, prev, q0, num(input.params, "edge", 1) === 0 ? "fall" : "rise", clr === 1 ? 1 : 0);
      const q: Bit = next.q === 1 ? 1 : next.q === 0 ? 0 : "X";
      const seen: Bit = clk === 1 ? 1 : 0;
      return { outputs: { Q: q, QN: q === 1 ? 0 : q === 0 ? 1 : "X" }, state: [q, seen] };
    },
    expression: () => "Q* = D on CLK↑",
  },
  {
    type: "jkff",
    category: "sequential",
    displayName: "JK flip-flop",
    description: "Rising-edge JK. J=K=1 toggles Q.",
    delay: 1,
    width: 104,
    height: 84,
    params: [{ id: "edge", label: "Rising edge", kind: "number", min: 0, max: 1, default: 1 }],
    ports: () => [
      { id: "J", name: "J", dir: "in" }, { id: "K", name: "K", dir: "in" }, { id: "CLK", name: "CLK", dir: "in" },
      { id: "Q", name: "Q", dir: "out" },
    ],
    evaluate: (input) => {
      const q0 = level(input.state[0] ?? 0);
      const prev = input.state[1] === 0 || input.state[1] === 1 ? input.state[1] : 0;
      const clk = bit(input.inputs.CLK);
      const next = jkFlipFlop(bit(input.inputs.J), bit(input.inputs.K), clk, prev, q0, num(input.params, "edge", 1) === 0 ? "fall" : "rise");
      const q: Bit = next.q === 1 ? 1 : next.q === 0 ? 0 : "X";
      return { outputs: { Q: q }, state: [q, clk === 1 ? 1 : 0] };
    },
  },
  {
    type: "tff",
    category: "sequential",
    displayName: "T flip-flop",
    description: "Toggles Q on the rising clock when T is 1.",
    delay: 1,
    width: 96,
    height: 72,
    params: [{ id: "edge", label: "Rising edge", kind: "number", min: 0, max: 1, default: 1 }],
    ports: () => [
      { id: "T", name: "T", dir: "in" }, { id: "CLK", name: "CLK", dir: "in" },
      { id: "Q", name: "Q", dir: "out" },
    ],
    evaluate: (input) => {
      const q0 = level(input.state[0] ?? 0);
      const prev = input.state[1] === 0 || input.state[1] === 1 ? input.state[1] : 0;
      const clk = bit(input.inputs.CLK);
      const next = tFlipFlop(bit(input.inputs.T), clk, prev, q0, num(input.params, "edge", 1) === 0 ? "fall" : "rise");
      const q: Bit = next.q === 1 ? 1 : next.q === 0 ? 0 : "X";
      return { outputs: { Q: q }, state: [q, clk === 1 ? 1 : 0] };
    },
  },
  {
    type: "delay",
    category: "timing",
    displayName: "Delay",
    description: "Passes the input through after an extra delay.",
    delay: 2,
    width: 80,
    height: 48,
    params: [{ id: "extra", label: "Extra delay", kind: "number", min: 1, max: 8, default: 2 }],
    ports: () => [{ id: "A", name: "A", dir: "in" }, { id: "Y", name: "Y", dir: "out" }],
    evaluate: (input) => ({ outputs: { Y: bit(input.inputs.A) } }),
  },
  {
    type: "high",
    category: "inputs",
    displayName: "Logic HIGH",
    description: "A constant 1. The output never changes.",
    delay: 0,
    width: 56,
    height: 48,
    params: [],
    ports: () => [{ id: "Y", name: "Y", dir: "out" }],
    evaluate: () => ({ outputs: { Y: 1 } }),
  },
  {
    type: "low",
    category: "inputs",
    displayName: "Logic LOW",
    description: "A constant 0. The output never changes.",
    delay: 0,
    width: 56,
    height: 48,
    params: [],
    ports: () => [{ id: "Y", name: "Y", dir: "out" }],
    evaluate: () => ({ outputs: { Y: 0 } }),
  },
  {
    type: "tri",
    category: "special",
    displayName: "Tri-state Buffer",
    description: "Passes DATA while enable is active. Otherwise the output is Z.",
    delay: 1,
    width: 96,
    height: 64,
    params: [{ id: "active", label: "Active high enable", kind: "number", min: 0, max: 1, default: 1 }],
    ports: () => [
      { id: "A", name: "D", dir: "in" },
      { id: "EN", name: "EN", dir: "in" },
      { id: "Y", name: "Y", dir: "out" },
    ],
    evaluate: (input) => {
      const enable = bit(input.inputs.EN);
      const activeHigh = num(input.params, "active", 1) !== 0;
      if (enable === "X" || enable === "Z") return { outputs: { Y: "X" } };
      const enabled = activeHigh ? enable === 1 : enable === 0;
      return { outputs: { Y: enabled ? bit(input.inputs.A) : "Z" } };
    },
  },
];

const LIBRARY: Record<string, Partial<ComponentSpec>> = {
  input: { category: "inputs", displayName: "Toggle Switch", shortLabel: "SW", summary: "Click to toggle 0 / 1", keywords: ["switch", "input", "toggle", "binary"] },
  high: { shortLabel: "1", summary: "Constant 1", keywords: ["high", "constant", "one", "vcc", "logic 1"] },
  low: { shortLabel: "0", summary: "Constant 0", keywords: ["low", "constant", "zero", "ground", "logic 0"] },
  const: { listed: false, category: "inputs", summary: "Tied 0 or 1", keywords: ["constant"] },
  button: { category: "inputs", displayName: "Push Button", shortLabel: "BTN", summary: "HIGH only while held", keywords: ["button", "push", "momentary", "press"] },
  clock: { displayName: "Clock Generator", shortLabel: "CLK", summary: "Square wave", keywords: ["clock", "clk", "oscillator", "pulse", "timing"] },
  output: { category: "outputs", displayName: "Logic Indicator", shortLabel: "Y", summary: "Shows 0, 1, X, or Z", keywords: ["output", "indicator", "lamp", "logic"] },
  led: { category: "outputs", displayName: "LED", shortLabel: "LED", summary: "Lights when the input is 1", keywords: ["led", "light", "output", "lamp"] },
  bulb: { category: "outputs", shortLabel: "Bulb", summary: "Round lamp, on when 1", keywords: ["bulb", "lamp", "light", "output"] },
  buzzer: { category: "outputs", shortLabel: "Buzz", summary: "Pulses while the input is 1", keywords: ["buzzer", "speaker", "alarm", "sound"] },
  bicolor: { category: "outputs", shortLabel: "RG", summary: "Red and green pins", keywords: ["bicolor", "bi-color", "red", "green", "led"] },
  rgb: { category: "outputs", shortLabel: "RGB", summary: "Three color pins", keywords: ["rgb", "color", "led"] },
  bar: { category: "outputs", shortLabel: "Bar", summary: "4 or 8 lamps", keywords: ["bar", "bargraph", "lamps", "decoder"] },
  hex: { category: "outputs", shortLabel: "Hex", summary: "0–F from four bits", keywords: ["hex", "digit", "display", "nibble"] },
  seg7: { category: "outputs", shortLabel: "7-Seg", summary: "Raw a–g pins", keywords: ["seven", "segment", "7-segment", "display"] },
  traffic: { category: "outputs", shortLabel: "Lamp", summary: "Red, yellow, green", keywords: ["traffic", "signal", "light"] },
  lights: { category: "outputs", shortLabel: "Junction", summary: "NS and EW traffic lamps", keywords: ["traffic", "junction", "intersection", "lights"] },
  motor: { category: "outputs", shortLabel: "Motor", summary: "Turns while the input is 1", keywords: ["motor", "actuator"] },
  relay: { category: "outputs", shortLabel: "Relay", summary: "Contact closes on 1", keywords: ["relay", "coil", "contact"] },
  probe: { category: "probes", displayName: "Logic Probe", shortLabel: "Probe", summary: "Reads a net", keywords: ["probe", "measure", "monitor", "test"] },
  buf: { displayName: "Buffer", shortLabel: "BUF", summary: "Q = A", keywords: ["buffer", "buf", "delay"] },
  not: { displayName: "NOT Gate", shortLabel: "NOT", summary: "Q = not A", keywords: ["not", "inverter", "invert"] },
  and: { displayName: "AND Gate", shortLabel: "AND", summary: "2–8 inputs", keywords: ["and", "conjunction"] },
  or: { displayName: "OR Gate", shortLabel: "OR", summary: "2–8 inputs", keywords: ["or", "disjunction"] },
  xor: { category: "basic", displayName: "XOR Gate", shortLabel: "XOR", summary: "1 when an odd number of inputs are 1", keywords: ["xor", "exclusive"] },
  nand: { displayName: "NAND Gate", shortLabel: "NAND", summary: "AND, then invert", keywords: ["nand", "universal"] },
  nor: { displayName: "NOR Gate", shortLabel: "NOR", summary: "OR, then invert", keywords: ["nor", "universal"] },
  xnor: { category: "special", displayName: "XNOR Gate", shortLabel: "XNOR", summary: "1 when the inputs match", keywords: ["xnor", "equivalence"] },
  tri: { shortLabel: "TRI", summary: "DATA or Z", keywords: ["tri", "tristate", "tri-state", "enable", "high-z", "z"] },
  ha: { category: "arithmetic", displayName: "Half Adder", shortLabel: "HA", summary: "Sum and carry", keywords: ["half", "adder", "add", "sum"] },
  fa: { category: "arithmetic", displayName: "Full Adder", shortLabel: "FA", summary: "A, B, and Cin", keywords: ["full", "adder", "add", "carry"] },
  hsub: { displayName: "Half Subtractor", shortLabel: "HS", summary: "Difference and borrow", keywords: ["half", "subtractor", "subtract"] },
  fsub: { displayName: "Full Subtractor", shortLabel: "FS", summary: "Difference with borrow-in", keywords: ["full", "subtractor", "subtract"] },
  mux2: { category: "multiplexing", displayName: "2:1 Multiplexer", shortLabel: "MUX", summary: "Y follows I0 or I1", keywords: ["mux", "multiplexer", "selector", "2:1"] },
  dec2: { category: "multiplexing", displayName: "2-to-4 Decoder", shortLabel: "DEC", summary: "One output follows the address", keywords: ["decoder", "decode", "2-to-4"] },
  sr: { displayName: "SR Latch", shortLabel: "SR", summary: "S sets Q, R clears Q", keywords: ["sr", "latch", "flip", "flip-flop", "ff"] },
  dlatch: { displayName: "D Latch", shortLabel: "DL", summary: "Transparent while EN is 1", keywords: ["d", "latch", "enable", "transparent"] },
  dff: { displayName: "D Flip-Flop", shortLabel: "DFF", summary: "Copies D on the rising clock", keywords: ["dff", "d", "flip", "flip-flop", "flip flop", "ff", "edge"] },
  jkff: { displayName: "JK Flip-Flop", shortLabel: "JK", summary: "J=K=1 toggles Q", keywords: ["jk", "jkff", "flip", "flip-flop", "flip flop", "ff"] },
  tff: { displayName: "T Flip-Flop", shortLabel: "TFF", summary: "Toggles on the rising clock", keywords: ["t", "tff", "toggle", "flip", "flip-flop", "ff"] },
  delay: { displayName: "Delay Block", shortLabel: "DLY", summary: "Extra propagation delay", keywords: ["delay", "propagation", "timing"] },
};

for (const spec of specs) Object.assign(spec, LIBRARY[spec.type] ?? {});

const byType = new Map(specs.map((spec) => [spec.type, spec]));

export const PALETTE_CATEGORIES = ["inputs", "outputs", "basic", "universal", "special", "arithmetic", "multiplexing", "sequential", "timing", "probes"] as const;

export const CIRCUIT_CATEGORIES = PALETTE_CATEGORIES;

export function registerCircuitComponent(spec: ComponentSpec): void {
  const index = specs.findIndex((item) => item.type === spec.type);
  if (index >= 0) specs[index] = spec;
  else specs.push(spec);
  byType.set(spec.type, spec);
}

export function getComponent(type: string): ComponentSpec | undefined {
  return byType.get(type);
}

export function listComponents(categories?: string[]): ComponentSpec[] {
  const listed = specs.filter((spec) => spec.listed !== false);
  if (!categories || categories.length === 0) return listed;
  const allow = new Set(categories);
  return listed.filter((spec) => allow.has(spec.category));
}

export function matchesComponent(spec: ComponentSpec, query: string): boolean {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const hay = [spec.displayName, spec.shortLabel, spec.type, spec.summary, spec.description, ...(spec.keywords ?? [])].join(" ").toLowerCase();
  return words.every((word) => hay.includes(word));
}

/** Rows come from the component's own evaluate function, for gates with at most three inputs. */
export function componentTruth(type: string, params?: Record<string, ParamValue>): { inputs: string[]; outputs: string[]; rows: Array<{ input: Bit[]; output: Bit[] }> } | null {
  const spec = getComponent(type);
  if (!spec || spec.category === "sequential") return null;
  const resolved = { ...defaultParams(spec), ...params };
  const ports = spec.ports(resolved);
  const inputs = ports.filter((port) => port.dir === "in");
  const outputs = ports.filter((port) => port.dir === "out");
  if (inputs.length === 0 || inputs.length > 3 || outputs.length === 0) return null;
  const rows: Array<{ input: Bit[]; output: Bit[] }> = [];
  const count = 2 ** inputs.length;
  for (let mask = 0; mask < count; mask += 1) {
    const values: Record<string, Bit> = {};
    const input = inputs.map((port, index) => {
      const bit: Bit = (mask >> (inputs.length - 1 - index)) & 1 ? 1 : 0;
      values[port.id] = bit;
      return bit;
    });
    const result = spec.evaluate({ inputs: values, state: [], params: resolved });
    rows.push({ input, output: outputs.map((port) => result.outputs[port.id] ?? "X") });
  }
  return { inputs: inputs.map((port) => port.name), outputs: outputs.map((port) => port.name), rows };
}

export function defaultParams(spec: ComponentSpec): Record<string, ParamValue> {
  return Object.fromEntries(spec.params.map((param) => [param.id, param.default]));
}

export function nodeSize(spec: ComponentSpec, params: Record<string, ParamValue>, box?: { width?: number; height?: number }): { width: number; height: number } {
  const ports = spec.ports(params);
  const inputs = ports.filter((port) => port.dir === "in").length;
  const outputs = ports.filter((port) => port.dir === "out").length;
  const rows = Math.max(inputs, outputs, 1);
  const natural = { width: spec.width, height: Math.max(spec.height, 20 + rows * 16) };
  const minW = Math.max(48, Math.round(spec.width * 0.7));
  const minH = Math.max(36, 16 + rows * 14);
  const width = box?.width && box.width > 0 ? box.width : natural.width;
  const height = box?.height && box.height > 0 ? box.height : natural.height;
  return { width: Math.min(480, Math.max(minW, width)), height: Math.min(640, Math.max(minH, height)) };
}

export function nodeFrame(node: Pick<CircuitNode, "type" | "x" | "y" | "params" | "rotation" | "width" | "height">): { x: number; y: number; width: number; height: number } {
  const spec = getComponent(node.type);
  if (!spec) return { x: node.x, y: node.y, width: 40, height: 40 };
  const size = nodeSize(spec, node.params, node);
  const turns = ((node.rotation ?? 0) % 4 + 4) % 4;
  if (turns % 2 === 0) return { x: node.x, y: node.y, width: size.width, height: size.height };
  const cx = node.x + size.width / 2;
  const cy = node.y + size.height / 2;
  return { x: cx - size.height / 2, y: cy - size.width / 2, width: size.height, height: size.width };
}
