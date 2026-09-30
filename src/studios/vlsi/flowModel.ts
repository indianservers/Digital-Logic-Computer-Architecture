import { algebraicSimplify, type SimplifyStep } from "../../engines/boolean/simplify";
import { formatAst, gateCount, logicDepth, parseBoolean } from "../../engines/boolean/ast";
import { binaryWidth, encodeStates } from "../../engines/fsm/encoding";
import type { FsmMachine } from "../../engines/fsm/stateMachine";
import { sizeCell, type CellName, type Drive } from "./cellLibrary";

export interface GenericGate {
  id: string;
  op: "and" | "or" | "not" | "xor" | "buf";
  inputs: string[];
  output: string;
}

export interface MappedInstance {
  id: string;
  cell: CellName;
  drive: Drive;
  inputs: string[];
  output: string;
  replaced: string[];
}

export type MapTarget = "area" | "timing" | "power" | "balanced";

function driveFor(target: MapTarget): Drive {
  if (target === "timing") return 4;
  if (target === "balanced") return 2;
  return 1;
}

export function designGates(design: "adder" | "mux" | "counter"): GenericGate[] {
  if (design === "adder") {
    return [
      { id: "g-sum", op: "xor", inputs: ["a", "b"], output: "sum" },
      { id: "g-cout", op: "and", inputs: ["a", "b"], output: "cout" },
    ];
  }
  if (design === "counter") {
    return [
      { id: "g-n0", op: "xor", inputs: ["q0", "one"], output: "n0" },
      { id: "g-c", op: "and", inputs: ["q0", "one"], output: "carry" },
      { id: "g-n1", op: "xor", inputs: ["q1", "carry"], output: "n1" },
    ];
  }
  return [
    { id: "g-ns", op: "not", inputs: ["s"], output: "ns" },
    { id: "g-a", op: "and", inputs: ["a", "ns"], output: "ta" },
    { id: "g-b", op: "and", inputs: ["b", "s"], output: "tb" },
    { id: "g-y", op: "or", inputs: ["ta", "tb"], output: "y" },
  ];
}

export function evalGeneric(gates: GenericGate[], pins: Record<string, 0 | 1>, output: string): 0 | 1 {
  const values: Record<string, 0 | 1> = { ...pins };
  for (const gate of gates) {
    const a = values[gate.inputs[0] ?? ""] ?? 0;
    const b = values[gate.inputs[1] ?? ""] ?? 0;
    if (gate.op === "not" || gate.op === "buf") values[gate.output] = gate.op === "not" ? (a === 1 ? 0 : 1) : a;
    else if (gate.op === "and") values[gate.output] = a === 1 && b === 1 ? 1 : 0;
    else if (gate.op === "or") values[gate.output] = a === 1 || b === 1 ? 1 : 0;
    else values[gate.output] = a === b ? 0 : 1;
  }
  return values[output] ?? 0;
}

function fanout(gates: GenericGate[], signal: string): number {
  return gates.filter((gate) => gate.inputs.includes(signal)).length;
}

export function optimizeNetwork(gates: GenericGate[], primary: string[]): { gates: GenericGate[]; steps: string[] } {
  const steps: string[] = [];
  let folded = false;
  let current = gates.map((gate) => {
    if (gate.op === "and" && gate.inputs.includes("1")) {
      folded = true;
      const other = gate.inputs.find((input) => input !== "1") ?? "0";
      return { ...gate, op: "buf" as const, inputs: [other] };
    }
    if (gate.op === "and" && gate.inputs.includes("0")) {
      folded = true;
      return { ...gate, op: "buf" as const, inputs: ["0"] };
    }
    return { ...gate, inputs: [...gate.inputs] };
  });
  if (folded) steps.push("Constant propagation");
  const rewritten: GenericGate[] = [];
  const skip = new Set<string>();
  for (const gate of current) {
    if (gate.op !== "not") continue;
    const source = current.find((item) => item.output === gate.inputs[0] && item.op === "not");
    if (!source) continue;
    skip.add(source.id);
    skip.add(gate.id);
    for (const other of current) {
      other.inputs = other.inputs.map((input) => (input === gate.output ? (source.inputs[0] ?? input) : input));
    }
    steps.push("Involution removed a double inversion");
  }
  current = current.filter((gate) => !skip.has(gate.id));
  const seen = new Map<string, string>();
  const cseSkip = new Set<string>();
  for (const gate of current) {
    const key = `${gate.op}|${gate.inputs.join(",")}`;
    const first = seen.get(key);
    if (first && first !== gate.output) {
      cseSkip.add(gate.id);
      for (const other of current) {
        other.inputs = other.inputs.map((input) => (input === gate.output ? first : input));
      }
      steps.push("Common subexpression reused");
    } else {
      seen.set(key, gate.output);
    }
  }
  current = current.filter((gate) => !cseSkip.has(gate.id));
  const live = new Set(primary);
  let grew = true;
  while (grew) {
    grew = false;
    for (const gate of current) {
      if (!live.has(gate.output)) continue;
      for (const input of gate.inputs) {
        if (!live.has(input)) {
          live.add(input);
          grew = true;
        }
      }
    }
  }
  const kept = current.filter((gate) => live.has(gate.output));
  if (kept.length < current.length) steps.push("Dead logic removed");
  rewritten.push(...kept);
  if (steps.length === 0) steps.push("No further educational rewrite applied");
  return { gates: rewritten, steps };
}

export function synthesisDemo(): { before: GenericGate[]; after: GenericGate[]; steps: string[] } {
  const before: GenericGate[] = [
    { id: "n1", op: "not", inputs: ["a"], output: "t1" },
    { id: "n2", op: "not", inputs: ["t1"], output: "t2" },
    { id: "dup", op: "and", inputs: ["a", "b"], output: "same" },
    { id: "use", op: "buf", inputs: ["same"], output: "kept" },
    { id: "dead", op: "and", inputs: ["a", "b"], output: "unused" },
    { id: "fold", op: "and", inputs: ["kept", "1"], output: "y2" },
    { id: "y", op: "buf", inputs: ["t2"], output: "y" },
  ];
  const optimized = optimizeNetwork(before, ["y", "y2"]);
  return { before, after: optimized.gates, steps: optimized.steps };
}

export function networkMetrics(gates: GenericGate[]): { count: number; depth: number; area: number; delay: number } {
  const depthOf = new Map<string, number>();
  let depth = 0;
  for (const gate of gates) {
    const incoming = gate.inputs.map((input) => depthOf.get(input) ?? 0);
    const here = 1 + Math.max(0, ...incoming);
    depthOf.set(gate.output, here);
    depth = Math.max(depth, here);
  }
  return { count: gates.length, depth, area: gates.length * 1.6, delay: depth * 12 };
}

export function mapNetwork(gates: GenericGate[], target: MapTarget): MappedInstance[] {
  const drive = driveFor(target);
  const consumed = new Set<string>();
  const mapped: MappedInstance[] = [];
  for (const gate of gates) {
    if (gate.op !== "not") continue;
    const source = gates.find((item) => item.output === gate.inputs[0] && item.op === "and");
    if (!source || fanout(gates, source.output) !== 1) continue;
    consumed.add(source.id);
    consumed.add(gate.id);
    mapped.push({
      id: `map-${gate.id}`,
      cell: "NAND2",
      drive,
      inputs: [...source.inputs],
      output: gate.output,
      replaced: [source.id, gate.id],
    });
  }
  for (const gate of gates) {
    if (consumed.has(gate.id)) continue;
    if (gate.op === "and" || gate.op === "or") {
      const cell: CellName = gate.op === "and" ? "NAND2" : "NOR2";
      const mid = `${gate.output}_n`;
      mapped.push({ id: `map-${gate.id}`, cell, drive, inputs: [...gate.inputs], output: mid, replaced: [gate.id] });
      mapped.push({ id: `map-${gate.id}-inv`, cell: "INV", drive, inputs: [mid], output: gate.output, replaced: [gate.id] });
    } else if (gate.op === "not") {
      mapped.push({ id: `map-${gate.id}`, cell: "INV", drive, inputs: [...gate.inputs], output: gate.output, replaced: [gate.id] });
    } else if (gate.op === "xor") {
      mapped.push({ id: `map-${gate.id}`, cell: "XOR2", drive, inputs: [...gate.inputs], output: gate.output, replaced: [gate.id] });
    } else {
      mapped.push({ id: `map-${gate.id}`, cell: "BUF", drive, inputs: [...gate.inputs], output: gate.output, replaced: [gate.id] });
    }
  }
  return mapped;
}

export function evalMapped(instances: MappedInstance[], pins: Record<string, 0 | 1>, output: string): 0 | 1 {
  const values: Record<string, 0 | 1> = { ...pins };
  for (const instance of instances) {
    const local: Record<string, 0 | 1> = {};
    instance.inputs.forEach((input, index) => {
      const name = index === 0 ? "A" : index === 1 ? "B" : "C";
      local[name] = values[input] ?? 0;
    });
    if (instance.cell === "INV") values[instance.output] = (local.A ?? 0) === 1 ? 0 : 1;
    else if (instance.cell === "BUF") values[instance.output] = local.A ?? 0;
    else if (instance.cell === "NAND2") values[instance.output] = (local.A ?? 0) === 1 && (local.B ?? 0) === 1 ? 0 : 1;
    else if (instance.cell === "NOR2") values[instance.output] = (local.A ?? 0) === 1 || (local.B ?? 0) === 1 ? 0 : 1;
    else values[instance.output] = (local.A ?? 0) === (local.B ?? 0) ? 0 : 1;
  }
  return values[output] ?? 0;
}

export function truthEquivalent(gates: GenericGate[], mapped: MappedInstance[], names: string[], output: string): boolean {
  const limit = 1 << names.length;
  for (let mask = 0; mask < limit; mask += 1) {
    const pins: Record<string, 0 | 1> = {};
    names.forEach((name, index) => {
      pins[name] = (mask & (1 << index)) === 0 ? 0 : 1;
    });
    if (evalGeneric(gates, pins, output) !== evalMapped(mapped, pins, output)) return false;
  }
  return true;
}

export function mappedCost(instances: MappedInstance[], loadFf: number): { count: number; area: number; delay: number; power: number } {
  let area = 0;
  let delay = 0;
  let power = 0;
  for (const instance of instances) {
    const sized = sizeCell(instance.cell, instance.drive, loadFf);
    area += sized.area;
    delay += sized.risePs;
    power += sized.leakageUw + sized.dynamicFj * 0.01;
  }
  return { count: instances.length, area, delay, power };
}

export interface RtlBlock {
  id: string;
  kind: "logic" | "mux" | "adder" | "register" | "comparator" | "fsm";
  label: string;
}

export interface RtlExample {
  id: string;
  title: string;
  lines: Array<{ line: number; text: string; block: string }>;
  blocks: RtlBlock[];
}

export const RTL_EXAMPLES: RtlExample[] = [
  {
    id: "assign",
    title: "Combinational assign",
    lines: [
      { line: 1, text: "assign y = a & b;", block: "logic" },
    ],
    blocks: [{ id: "logic", kind: "logic", label: "AND" }],
  },
  {
    id: "mux",
    title: "if / else mux",
    lines: [
      { line: 1, text: "always @(*) begin", block: "mux" },
      { line: 2, text: "  if (s) y = b;", block: "mux" },
      { line: 3, text: "  else y = a;", block: "mux" },
      { line: 4, text: "end", block: "mux" },
    ],
    blocks: [{ id: "mux", kind: "mux", label: "MUX" }],
  },
  {
    id: "adder",
    title: "Adder",
    lines: [
      { line: 1, text: "assign sum = a + b;", block: "adder" },
      { line: 2, text: "assign cout = a & b;", block: "logic" },
    ],
    blocks: [
      { id: "adder", kind: "adder", label: "ADD" },
      { id: "logic", kind: "logic", label: "AND" },
    ],
  },
  {
    id: "register",
    title: "Register",
    lines: [
      { line: 1, text: "always @(posedge clk)", block: "register" },
      { line: 2, text: "  q <= d;", block: "register" },
    ],
    blocks: [{ id: "register", kind: "register", label: "REG" }],
  },
  {
    id: "counter",
    title: "Counter",
    lines: [
      { line: 1, text: "always @(posedge clk)", block: "register" },
      { line: 2, text: "  count <= count + 1;", block: "adder" },
    ],
    blocks: [
      { id: "register", kind: "register", label: "REG" },
      { id: "adder", kind: "adder", label: "ADD" },
    ],
  },
  {
    id: "fsm",
    title: "Simple FSM",
    lines: [
      { line: 1, text: "always @(posedge clk) begin", block: "register" },
      { line: 2, text: "  case (state)", block: "fsm" },
      { line: 3, text: "    S0: if (x == 1) state <= S1;", block: "comparator" },
      { line: 4, text: "    S1: state <= S0;", block: "fsm" },
      { line: 5, text: "  endcase", block: "fsm" },
      { line: 6, text: "end", block: "register" },
    ],
    blocks: [
      { id: "register", kind: "register", label: "REG" },
      { id: "fsm", kind: "fsm", label: "NEXT" },
      { id: "comparator", kind: "comparator", label: "CMP" },
    ],
  },
];

const UNSUPPORTED = ["fork", "generate", "interface", "$display", "class", "import", "assert", "bind"];

export function classifyRtl(source: string): { supported: boolean; reason: string; blocks: string[] } {
  const lower = source.toLowerCase();
  const hit = UNSUPPORTED.find((word) => lower.includes(word));
  if (hit) return { supported: false, reason: `${hit} is outside the educational Verilog subset.`, blocks: [] };
  if (!lower.includes("assign") && !lower.includes("always")) {
    return { supported: false, reason: "This subset expects assign or always.", blocks: [] };
  }
  const blocks: string[] = [];
  if (lower.includes("if") || lower.includes("?")) blocks.push("mux");
  if (lower.includes("+")) blocks.push("adder");
  if (lower.includes("<=") || lower.includes("posedge")) blocks.push("register");
  if (lower.includes("case")) blocks.push("fsm");
  if (lower.includes("==")) blocks.push("comparator");
  if (lower.includes("&") || lower.includes("|") || lower.includes("^")) blocks.push("logic");
  return { supported: true, reason: "Supported educational subset.", blocks };
}

export function optimizeBoolean(expression: string): {
  before: string;
  after: string;
  beforeGates: number;
  afterGates: number;
  beforeDepth: number;
  afterDepth: number;
  areaBefore: number;
  areaAfter: number;
  delayBefore: number;
  delayAfter: number;
  steps: SimplifyStep[];
} {
  const parsed = parseBoolean(expression);
  const simplified = algebraicSimplify(parsed.ast);
  const beforeGates = gateCount(parsed.ast);
  const afterGates = gateCount(simplified.ast);
  const beforeDepth = logicDepth(parsed.ast);
  const afterDepth = logicDepth(simplified.ast);
  return {
    before: formatAst(parsed.ast),
    after: formatAst(simplified.ast),
    beforeGates,
    afterGates,
    beforeDepth,
    afterDepth,
    areaBefore: beforeGates * 1.6,
    areaAfter: afterGates * 1.6,
    delayBefore: beforeDepth * 12,
    delayAfter: afterDepth * 12,
    steps: simplified.steps,
  };
}

function counterMachine(): FsmMachine {
  const states = ["S0", "S1", "S2", "S3"].map((name, index) => ({
    id: `s${index}`,
    name,
    x: 40 + index * 70,
    y: 40,
    output: index >= 2 ? "1" : "0",
  }));
  return { name: "2-bit sequence", kind: "moore", inputs: ["x"], states, transitions: [], initialId: "s0" };
}

export type FsmEncode = "binary" | "one-hot" | "gray";

export function fsmHardware(kind: FsmEncode): {
  flipFlops: number;
  codes: string[];
  logicGates: number;
  area: number;
  delay: number;
  note: string;
} {
  const machine = counterMachine();
  if (kind === "gray") {
    const width = binaryWidth(machine.states.length);
    const codes = machine.states.map((_, index) => (index ^ (index >> 1)).toString(2).padStart(width, "0"));
    const logicGates = 7;
    return {
      flipFlops: width,
      codes,
      logicGates,
      area: width * 6.5 + logicGates * 1.6,
      delay: 24,
      note: "Gray changes one bit per adjacent state. Flip-flop count matches binary.",
    };
  }
  const encoded = encodeStates(machine, kind);
  const logicGates = kind === "one-hot" ? machine.states.length : 9;
  return {
    flipFlops: encoded.flipFlops,
    codes: encoded.states.map((state) => state.code),
    logicGates,
    area: encoded.flipFlops * 6.5 + logicGates * 1.6,
    delay: kind === "one-hot" ? 16 : 28,
    note: encoded.note,
  };
}

export const FLOW_STAGES = ["RTL", "Synthesized gates", "Mapped cells", "Floorplan", "Placement", "Routing", "Final layout"] as const;

export function flowSnapshot(design: "adder" | "mux" | "counter", stage: number, utilization: number): {
  title: string;
  input: string;
  transform: string;
  output: string;
  gateCount: number;
  cellCount: number;
  area: number;
  wire: number;
  delay: number;
  power: number;
} {
  const gates = designGates(design);
  const primary = design === "adder" ? ["sum", "cout"] : design === "counter" ? ["n0", "n1"] : ["y"];
  const optimized = optimizeNetwork(gates, primary);
  const mapped = mapNetwork(optimized.gates, "balanced");
  const cost = mappedCost(mapped, 8);
  const titles = FLOW_STAGES;
  const index = Math.max(0, Math.min(titles.length - 1, stage));
  const wire = (12 + mapped.length * 4) * (0.55 + utilization);
  const notes = [
    { input: "Educational Verilog subset", transform: "Parse into blocks", output: `${gates.length} operators implied` },
    { input: "Parsed operators", transform: "Elaborate a generic gate network", output: `${optimized.gates.length} generic gates` },
    { input: "Generic gates", transform: "Map onto the educational library", output: `${mapped.length} standard cells` },
    { input: "Cell area", transform: "Reserve a core for the mapped cells", output: `${cost.area.toFixed(1)} cell-area units` },
    { input: "Mapped cells", transform: "Pack rows at the chosen utilization", output: `wire estimate ${wire.toFixed(1)}` },
    { input: "Placed pins", transform: "Assign a coarse route per net", output: `routed length ${wire.toFixed(1)}` },
    { input: "Routes and cells", transform: "Stamp the same metrics into layout", output: "Layout view of this flow" },
  ];
  const note = notes[index] ?? notes[0];
  return {
    title: titles[index] ?? "RTL",
    input: note?.input ?? "",
    transform: note?.transform ?? "",
    output: note?.output ?? "",
    gateCount: optimized.gates.length,
    cellCount: mapped.length,
    area: cost.area,
    wire,
    delay: cost.delay,
    power: cost.power,
  };
}
