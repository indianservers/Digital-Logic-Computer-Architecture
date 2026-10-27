import { aluNum } from "../../engines/builder/sim";
import { mesiStep, type MesiState } from "../../engines/arch/coherence";
import type { AluOp } from "../../engines/digital/arithmetic";
export type SandboxPage =
  | "circuit"
  | "datapath"
  | "memory"
  | "cpu"
  | "multicore"
  | "library"
  | "probes"
  | "breaks"
  | "history"
  | "templates";
export const PAGES: {
  id: SandboxPage;
  label: string;
  icon: string;
  project: string;
}[] = [
  {
    id: "circuit",
    label: "Circuit",
    icon: "circuit",
    project: "4-bit Ripple Carry Adder",
  },
  {
    id: "datapath",
    label: "Datapath",
    icon: "datapath",
    project: "Build an 8-bit Datapath",
  },
  {
    id: "memory",
    label: "Memory",
    icon: "memory",
    project: "Cache Mapping Explorer",
  },
  { id: "cpu", label: "CPU", icon: "cpu", project: "Build Your Own CPU" },
  {
    id: "multicore",
    label: "Multicore",
    icon: "multicore",
    project: "MESI Coherence Workbench",
  },
  {
    id: "library",
    label: "Components",
    icon: "components",
    project: "Component Library",
  },
  {
    id: "probes",
    label: "Probes",
    icon: "probe",
    project: "Probe & Waveform Analyzer",
  },
  {
    id: "breaks",
    label: "Breakpoints",
    icon: "breakpoint",
    project: "Debug a CPU Program",
  },
  {
    id: "history",
    label: "History",
    icon: "history",
    project: "Execution Time Machine",
  },
  {
    id: "templates",
    label: "Templates",
    icon: "templates",
    project: "Experiment Templates",
  },
];
export const hx = (n: number, w = 2) =>
  `0x${(n >>> 0).toString(16).toUpperCase().padStart(w, "0")}`;
export const bn = (n: number, w = 4) => (n >>> 0).toString(2).padStart(w, "0");
export function readHex(value: string, max = 65535) {
  if (!/^(0x)?[0-9a-f]+$/i.test(value.trim())) return null;
  const n = parseInt(value.replace(/^0x/i, ""), 16);
  return n <= max ? n : null;
}
export type PartKind =
  | "fa"
  | "and"
  | "or"
  | "xor"
  | "not"
  | "nand"
  | "register"
  | "alu"
  | "mux"
  | "memory"
  | "clock"
  | "constant"
  | "led"
  | "counter"
  | "decoder"
  | "probe";
export interface Part {
  id: string;
  kind: PartKind;
  label: string;
  x: number;
  y: number;
  delay: number;
  width: number;
  value: number;
  op: AluOp;
}
export interface Connection {
  id: string;
  from: string;
  out: string;
  to: string;
  input: string;
}
export interface Circuit {
  parts: Part[];
  wires: Connection[];
}
export function partPorts(kind: PartKind) {
  return kind === "fa"
    ? { inputs: ["A", "B", "Cin"], outputs: ["S", "Cout"] }
    : kind === "constant" || kind === "clock"
      ? { inputs: [], outputs: ["Y"] }
      : kind === "led" || kind === "probe"
        ? { inputs: ["A"], outputs: [] }
        : kind === "not" || kind === "register" || kind === "counter"
          ? { inputs: ["A"], outputs: ["Y"] }
          : kind === "mux"
            ? { inputs: ["A", "B", "Sel"], outputs: ["Y"] }
            : { inputs: ["A", "B"], outputs: ["Y"] };
}
export function rippleCircuit(): Circuit {
  const parts: Part[] = Array.from({ length: 4 }, (_, i) => ({
    id: `FA${i}`,
    kind: "fa",
    label: `FA${i}`,
    x: 268 + i * 169,
    y: 320,
    delay: 10,
    width: 1,
    value: 0,
    op: "ADD",
  }));
  const wires: Connection[] = [];
  for (let i = 0; i < 4; i++) {
    for (const input of ["A", "B"])
      wires.push({
        id: `${input}${i}`,
        from: `${input}${i}`,
        out: "Y",
        to: `FA${i}`,
        input,
      });
    wires.push({
      id: `carry${i}`,
      from: i ? `FA${i - 1}` : "Cin",
      out: i ? "Cout" : "Y",
      to: `FA${i}`,
      input: "Cin",
    });
  }
  return { parts, wires };
}
export function fullAdderCircuit(label = "XOR1", delay = 1): Circuit {
  const make = (
    id: string,
    kind: PartKind,
    x: number,
    y: number,
    label = id,
  ): Part => ({ id, kind, label, x, y, width: 1, delay, value: 0, op: "ADD" });
  const parts = [
    make("XOR1", "xor", 285, 180, label),
    make("XOR2", "xor", 525, 200),
    make("AND1", "and", 285, 400),
    make("AND2", "and", 480, 510),
    make("OR1", "or", 690, 440),
    make("Sum", "led", 780, 200),
    make("Cout", "led", 825, 530),
  ];
  const links = [
    ["A0", "Y", "XOR1", "A"],
    ["B0", "Y", "XOR1", "B"],
    ["XOR1", "Y", "XOR2", "A"],
    ["Cin", "Y", "XOR2", "B"],
    ["A0", "Y", "AND1", "A"],
    ["B0", "Y", "AND1", "B"],
    ["XOR1", "Y", "AND2", "A"],
    ["Cin", "Y", "AND2", "B"],
    ["AND1", "Y", "OR1", "A"],
    ["AND2", "Y", "OR1", "B"],
    ["XOR2", "Y", "Sum", "A"],
    ["OR1", "Y", "Cout", "A"],
  ];
  return {
    parts,
    wires: links.map(([from, out, to, input], i) => ({
      id: `full-${i}`,
      from: from!,
      out: out!,
      to: to!,
      input: input!,
    })),
  };
}
export function connectCircuit(
  circuit: Circuit,
  from: string,
  out: string,
  to: string,
  input: string,
): { circuit: Circuit; error?: string } {
  if (from === to)
    return { circuit, error: "A component cannot feed its own input." };
  const a = circuit.parts.find((p) => p.id === from),
    b = circuit.parts.find((p) => p.id === to);
  if (!b) return { circuit, error: "Choose an input port." };
  if (a && a.width !== b.width)
    return {
      circuit,
      error: `Bus width mismatch: ${a.width} → ${b.width} bits.`,
    };
  const wires = circuit.wires.filter(
    (w) => !(w.to === to && w.input === input),
  );
  const next = {
    ...circuit,
    wires: [...wires, { id: `w-${Date.now()}`, from, out, to, input }],
  };
  const visited = new Set<string>();
  const path = (id: string): boolean => {
    if (id === from) return true;
    if (
      visited.has(id) ||
      next.parts.find((p) => p.id === id)?.kind === "register"
    )
      return false;
    visited.add(id);
    return next.wires.filter((w) => w.from === id).some((w) => path(w.to));
  };
  if (path(to))
    return {
      circuit,
      error: "Combinational loop: use a register to break feedback.",
    };
  return { circuit: next };
}
export function evaluateCircuit(
  circuit: Circuit,
  a: number,
  b: number,
  cin: number,
) {
  const values: Record<string, number | null> = {};
  const active = new Set<string>();
  function output(id: string, port: string): number | null {
    const key = `${id}.${port}`;
    if (key in values) return values[key]!;
    if (active.has(key)) return null;
    if (/^[AB]\d$/.test(id))
      return (values[key] = ((id[0] === "A" ? a : b) >>> Number(id[1])) & 1);
    if (id === "Cin") return (values[key] = cin & 1);
    const node = circuit.parts.find((p) => p.id === id);
    if (!node) return null;
    active.add(key);
    const input = (name: string) => {
      const wire = circuit.wires.find((w) => w.to === id && w.input === name);
      return wire ? output(wire.from, wire.out) : null;
    };
    const av = input("A"),
      bv = input("B");
    let result: number | null = null;
    if (
      node.kind === "constant" ||
      node.kind === "clock" ||
      node.kind === "register" ||
      node.kind === "counter"
    )
      result = node.value;
    else if (node.kind === "not")
      result = av === null ? null : ~av & ((1 << node.width) - 1);
    else if (node.kind === "led" || node.kind === "probe") result = av;
    else if (node.kind === "fa") {
      const cv = input("Cin");
      if (av !== null && bv !== null && cv !== null) {
        const sum = (av & 1) + (bv & 1) + (cv & 1);
        result = port === "Cout" ? sum >>> 1 : sum & 1;
      }
    } else if (av !== null && bv !== null) {
      if (node.kind === "and") result = av & bv;
      else if (node.kind === "or") result = av | bv;
      else if (node.kind === "xor") result = av ^ bv;
      else if (node.kind === "nand") result = ~(av & bv) & 1;
      else if (node.kind === "mux") result = input("Sel") ? bv : av;
      else result = aluNum(av, bv, node.op, node.width).y;
    }
    active.delete(key);
    values[key] = result;
    return result;
  }
  for (const node of circuit.parts) {
    const ports = partPorts(node.kind);
    for (const port of [...ports.outputs, "A"]) output(node.id, port);
  }
  let sum = 0,
    known = true;
  for (let i = 0; i < 4; i++) {
    const v = output(`FA${i}`, "S");
    if (v === null) known = false;
    else sum |= (v & 1) << i;
  }
  return {
    values,
    sum: circuit.parts.some((p) => p.id === "Sum")
      ? output("Sum", "A")
      : known
        ? sum
        : null,
    carry: circuit.parts.some((p) => p.id === "Cout")
      ? output("Cout", "A")
      : output("FA3", "Cout"),
    output,
  };
}
export const SIMPLE_PROGRAM = "LDI R1, 5\nLDI R2, 3\nADD R3, R1, R2\nHALT";
export const DEBUG_PROGRAM =
  "NOP\nLDI R1, 5\nLDI R2, 3\nADD R3, R1, R2\nSTORE R2, [0x10]\nLOAD R5, [0x10]\nSTORE R3, [0x20]\nNOP\nHALT";
export const HISTORY_PROGRAM =
  "LDI R1, 5\nLDI R2, 3\nADD R3, R1, R2\nNOP\nSTORE R3, [0x1000]\nHALT";
export interface CpuState {
  pc: number;
  registers: number[];
  memory: Record<number, number>;
  halted: boolean;
  cycle: number;
  last: string;
  lastWrite?: { address: number; value: number };
  flags: { z: number; c: number; n: number };
}
export function blankCpu(): CpuState {
  return {
    pc: 0,
    registers: Array<number>(32).fill(0),
    memory: {},
    halted: false,
    cycle: 0,
    last: "Reset",
    flags: { z: 0, c: 0, n: 0 },
  };
}
export function parseInstruction(line: string) {
  const clean = line
    .split(";")[0]!
    .trim()
    .replace(/[\[\],]/g, " ");
  const [op = "NOP", ...args] = clean.split(/\s+/);
  return { op: op.toUpperCase(), args };
}
function reg(token: string | undefined) {
  if (!/^R\d+$/i.test(token ?? ""))
    throw new Error(`Invalid register ${token ?? ""}`);
  const n = Number(token!.slice(1));
  if (n > 31) throw new Error("Register index must be 0–31.");
  return n;
}
function immediate(token: string | undefined) {
  if (!token || !/^(-?\d+|0x[\da-f]+)$/i.test(token))
    throw new Error(`Invalid immediate ${token ?? ""}`);
  return Number(token);
}
export function cpuStep(cpu: CpuState, program: string): CpuState {
  if (cpu.halted) return cpu;
  const lines = program
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (cpu.pc < 0 || cpu.pc >= lines.length)
    return { ...cpu, halted: true, last: "End of program" };
  const source = lines[cpu.pc]!,
    { op, args } = parseInstruction(source),
    next: CpuState = {
      ...cpu,
      pc: cpu.pc + 1,
      cycle: cpu.cycle + 2,
      registers: [...cpu.registers],
      memory: { ...cpu.memory },
      last: source,
      lastWrite: undefined,
    };
  const [r, a, b] = args;
  if (op === "HALT") next.halted = true;
  else if (op === "NOP") {
  } else if (op === "LDI" || op === "LOADI")
    next.registers[reg(r)] = immediate(a) & 255;
  else if (["ADD", "SUB", "AND", "OR", "XOR"].includes(op)) {
    const result = aluNum(
      cpu.registers[reg(a)]!,
      cpu.registers[reg(b)]!,
      op as AluOp,
      8,
    );
    next.registers[reg(r)] = result.y;
    next.flags = { z: result.z, c: result.c, n: result.n };
  } else if (op === "STORE") {
    const address = immediate(a);
    if (address < 0 || address > 65535)
      throw new Error("Memory address is outside 16-bit space.");
    const value = cpu.registers[reg(r)]!;
    next.memory[address] = value;
    next.lastWrite = { address, value };
  } else if (op === "LOAD")
    next.registers[reg(r)] = cpu.memory[immediate(a)] ?? 0;
  else if (op === "JMP") next.pc = immediate(r);
  else if (op === "BEQ") {
    if (cpu.registers[reg(r)] === cpu.registers[reg(a)]) next.pc = immediate(b);
  } else throw new Error(`Unknown instruction ${op}.`);
  return next;
}
export function demoCpu(debug = false) {
  let cpu = blankCpu();
  const program = debug ? DEBUG_PROGRAM : SIMPLE_PROGRAM;
  for (let i = 0; i < (debug ? 6 : 3); i++) cpu = cpuStep(cpu, program);
  return cpu;
}
export interface CpuSnapshot {
  cycle: number;
  cpu: CpuState;
  event: string;
  instruction: string;
}
export function demoHistory(): CpuSnapshot[] {
  let cpu = blankCpu();
  const history: CpuSnapshot[] = [
    { cycle: 0, cpu, event: "Reset", instruction: "NOP" },
  ];
  for (let i = 0; i < 6; i++) {
    const line = HISTORY_PROGRAM.split("\n")[cpu.pc]!;
    history.push({
      cycle: cpu.cycle + 1,
      cpu: { ...cpu, cycle: cpu.cycle + 1 },
      event: i === 3 ? "Execute" : "Decode",
      instruction: line,
    });
    cpu = cpuStep(cpu, HISTORY_PROGRAM);
    history.push({
      cycle: cpu.cycle,
      cpu,
      event: cpu.lastWrite ? "Write Memory" : "Write Back",
      instruction: line,
    });
  }
  return history;
}
export interface SandboxBreakpoint {
  id: string;
  enabled: boolean;
  signal: "PC" | "Memory write" | "R3" | "Counter";
  operator: "==" | "!=" | ">=";
  value: number;
}
export function breakpointHit(
  cpu: CpuState,
  program: string,
  breakpoints: SandboxBreakpoint[],
) {
  const parsed = parseInstruction(program.split("\n")[cpu.pc] ?? "HALT");
  for (const point of breakpoints) {
    if (!point.enabled) continue;
    const actual =
      point.signal === "PC"
        ? cpu.pc
        : point.signal === "R3"
          ? cpu.registers[3]!
          : point.signal === "Memory write" && parsed.op === "STORE"
            ? immediate(parsed.args[1])
            : null;
    if (actual === null) continue;
    const hit =
      point.operator === "=="
        ? actual === point.value
        : point.operator === "!="
          ? actual !== point.value
          : actual >= point.value;
    if (hit) return point;
  }
  return null;
}
export const RAM_BYTES: Record<number, number[]> = {
  32: [0x3a, 0x7f, 0x11, 0x90],
  36: [0xde, 0xad, 0xbe, 0xef],
  40: [0x12, 0x34, 0x56, 0x78],
  44: [0x9a, 0xbc, 0, 1],
  48: [0x55, 0xaa, 0x33, 0xcc],
  52: [0x10, 0x20, 0x30, 0x40],
  56: [0xfe, 0xdc, 0xba, 0x98],
  60: [1, 0x23, 0x45, 0x67],
};
export const memoryByte = (addr: number) =>
  RAM_BYTES[addr - (addr % 4)]?.[addr % 4] ?? (addr * 17 + 3) & 255;
export interface CacheLine {
  valid: boolean;
  tag: number;
  data: number[];
}
export function emptyCache(lines = 8): CacheLine[] {
  return Array.from({ length: lines }, () => ({
    valid: false,
    tag: 0,
    data: [],
  }));
}
export function cacheDecode(address: number, lines: number, block: number) {
  return {
    offset: address % block,
    index: Math.floor(address / block) % lines,
    tag: Math.floor(address / (block * lines)),
    base: address - (address % block),
    indexBits: Math.log2(lines),
    offsetBits: Math.log2(block),
  };
}
export function cacheRead(cache: CacheLine[], address: number, block: number) {
  const decoded = cacheDecode(address, cache.length, block),
    old = cache[decoded.index]!,
    hit = old.valid && old.tag === decoded.tag;
  const next = cache.map((c) => ({ ...c, data: [...c.data] }));
  if (!hit)
    next[decoded.index] = {
      valid: true,
      tag: decoded.tag,
      data: Array.from({ length: block }, (_, i) =>
        memoryByte(decoded.base + i),
      ),
    };
  return {
    cache: next,
    hit,
    ...decoded,
    data: next[decoded.index]!.data,
    kind: hit ? "Hit" : old.valid ? "Conflict miss" : "Compulsory miss",
  };
}
export interface CoreCache {
  state: MesiState;
  address: number;
  value: number;
}
export interface MesiMachine {
  cores: CoreCache[];
  memory: Record<number, number>;
  bus: string;
  source: number;
  previous: MesiState[];
  write: boolean;
}
export function demoMesi(): MesiMachine {
  return {
    cores: [
      { state: "M", address: 4096, value: 43 },
      { state: "I", address: 4096, value: 42 },
    ],
    memory: { 4096: 42, 4160: 0 },
    bus: "BusUpgr (Invalidate)",
    source: 0,
    previous: ["S", "S"],
    write: true,
  };
}
export function mesiAccess(
  machine: MesiMachine,
  core: number,
  op: "read" | "write",
  address: number,
  value: number,
): MesiMachine {
  const cores = machine.cores.map((c) => ({ ...c })),
    memory = { ...machine.memory };
  const mine = cores[core]!;
  if (mine.address !== address) {
    if (mine.state === "M") memory[mine.address] = mine.value;
    mine.state = "I";
    mine.address = address;
  }
  const previous = cores.map((c) => (c.address === address ? c.state : "I"));
  const modified = cores.find((c) => c.address === address && c.state === "M");
  const hit = previous[core] !== "I";
  if (modified && modified !== mine) memory[address] = modified.value;
  const result = mesiStep(previous, core, op);
  cores.forEach((c, i) => {
    if (c.address === address) c.state = result.states[i]!;
  });
  mine.value =
    op === "write" ? value & 255 : hit ? mine.value : (memory[address] ?? 0);
  return {
    cores,
    memory,
    bus: result.bus === "Invalidate" ? "BusUpgr (Invalidate)" : result.bus,
    source: core,
    previous,
    write: op === "write",
  };
}
export const LIBRARY: {
  kind: PartKind;
  label: string;
  description: string;
  group: string;
}[] = [
  {
    kind: "and",
    label: "AND",
    description: "2-input AND gate",
    group: "Logic",
  },
  { kind: "or", label: "OR", description: "2-input OR gate", group: "Logic" },
  {
    kind: "xor",
    label: "XOR",
    description: "Exclusive OR gate",
    group: "Logic",
  },
  { kind: "not", label: "NOT", description: "Inverter", group: "Logic" },
  {
    kind: "fa",
    label: "Full Adder",
    description: "1-bit sum & carry",
    group: "Arithmetic",
  },
  {
    kind: "alu",
    label: "8-bit ALU",
    description: "Arithmetic / Logic Unit",
    group: "Arithmetic",
  },
  {
    kind: "register",
    label: "Register",
    description: "N-bit register with enable",
    group: "Storage",
  },
  {
    kind: "mux",
    label: "Multiplexer",
    description: "N:1 multiplexer",
    group: "Control",
  },
  {
    kind: "memory",
    label: "Memory",
    description: "Instruction or data memory",
    group: "Memory",
  },
  {
    kind: "clock",
    label: "Clock",
    description: "Clock source",
    group: "Control",
  },
  {
    kind: "constant",
    label: "Constant",
    description: "Constant value",
    group: "I/O",
  },
  {
    kind: "led",
    label: "LED",
    description: "Logic state indicator",
    group: "I/O",
  },
  {
    kind: "counter",
    label: "4-bit Counter",
    description: "Rising-edge counter",
    group: "Storage",
  },
  {
    kind: "decoder",
    label: "Decoder",
    description: "Instruction decoder",
    group: "Control",
  },
  {
    kind: "probe",
    label: "Probe",
    description: "Monitor a signal",
    group: "I/O",
  },
];
export const TEMPLATE_LIST = [
  { name: "Full Adder", description: "Combinational Logic", kind: "fa" },
  {
    name: "Ripple Carry Adder",
    description: "Multi-bit Arithmetic",
    kind: "fa",
  },
  {
    name: "Register & Counter",
    description: "Sequential Logic",
    kind: "register",
  },
  { name: "Single-Cycle CPU", description: "RISC-V Subset", kind: "alu" },
  { name: "Direct-Mapped Cache", description: "Memory System", kind: "memory" },
  { name: "MESI Two-Core", description: "Cache Coherence", kind: "cpu" },
];
