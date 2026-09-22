import type { AluOp } from "../digital/arithmetic";

export type Width = 1 | 4 | 8 | 16 | 32;
export type NodeKind =
  | "pc" | "acc" | "gpr" | "regfile" | "ir" | "mar" | "mdr" | "flags" | "sp"
  | "imem" | "dmem" | "umem"
  | "alu" | "shifter" | "cmp" | "inc" | "sext"
  | "mux" | "bus" | "split" | "join" | "const" | "buf"
  | "decoder" | "cu" | "clock"
  | "probe" | "led" | "hex" | "num" | "bin"
  | "and" | "or" | "not" | "nand" | "xor" | "dff" | "counter"
  | "cache" | "core";

export type PortDir = "in" | "out";
export interface PortDef { id: string; name: string; dir: PortDir; width: number; role: "data" | "control" | "clock" }

export interface ArchNode {
  id: string;
  kind: NodeKind;
  name: string;
  x: number;
  y: number;
  width: Width;
  value: number;
  values: number[];
  mem: number[];
  we: boolean;
  op: AluOp;
  sel: number;
  note: string;
}

export interface ArchWire {
  id: string;
  from: string;
  fromPort: string;
  to: string;
  toPort: string;
}

export type FieldPurpose = "opcode" | "rd" | "rs1" | "rs2" | "imm" | "funct" | "other";
export interface IsaField { name: string; lo: number; width: number; purpose: FieldPurpose }
export type PcBehavior = "inc" | "branchEq" | "branchNe" | "jump" | "halt";
export interface IsaInstruction {
  mnemonic: string;
  opcode: number;
  format: "R" | "I" | "J" | "B" | "N";
  operands: Array<"rd" | "rs1" | "rs2" | "imm">;
  aluOp: AluOp;
  aluSrc: "reg" | "imm";
  mem: "none" | "load" | "store";
  memToReg: boolean;
  regWrite: boolean;
  pc: PcBehavior;
}

export interface IsaSpec {
  name: string;
  instrWidth: number;
  dataWidth: Width;
  regs: number;
  fieldsR: IsaField[];
  fieldsI: IsaField[];
  fieldsJ: IsaField[];
  fieldsB: IsaField[];
  instructions: IsaInstruction[];
}

export interface Breakpoint {
  id: string;
  kind: "pc" | "reg" | "memwrite" | "mnemonic" | "flag" | "signal";
  enabled: boolean;
  address?: number;
  reg?: number;
  value?: number;
  mnemonic?: string;
  flag?: "z" | "n" | "c" | "v";
  signal?: string;
}

export interface CpuDesign {
  name: string;
  nodes: ArchNode[];
  wires: ArchWire[];
  isa: IsaSpec;
  program: string;
  nextId: number;
  pan: { x: number; y: number; k: number };
  breakpoints: Breakpoint[];
  probes: string[];
  overlay: "data" | "control" | "both";
}

export function maskBits(width: number): number {
  if (width >= 32) return 0xffffffff;
  if (width <= 0) return 0;
  return (1 << width) - 1;
}

export function snap(value: number): number {
  return Math.round(value / 16) * 16;
}

export function portsOf(node: ArchNode): PortDef[] {
  const w = node.width;
  switch (node.kind) {
    case "pc":
    case "acc":
    case "gpr":
    case "ir":
    case "mar":
    case "mdr":
    case "sp":
      return [
        { id: "d", name: "D", dir: "in", width: w, role: "data" },
        { id: "we", name: "WE", dir: "in", width: 1, role: "control" },
        { id: "clk", name: "CLK", dir: "in", width: 1, role: "clock" },
        { id: "q", name: "Q", dir: "out", width: w, role: "data" },
      ];
    case "flags":
      return [
        { id: "z", name: "Z", dir: "in", width: 1, role: "control" },
        { id: "n", name: "N", dir: "in", width: 1, role: "control" },
        { id: "c", name: "C", dir: "in", width: 1, role: "control" },
        { id: "v", name: "V", dir: "in", width: 1, role: "control" },
        { id: "clk", name: "CLK", dir: "in", width: 1, role: "clock" },
        { id: "qz", name: "Z", dir: "out", width: 1, role: "control" },
      ];
    case "regfile":
      return [
        { id: "ra", name: "A addr", dir: "in", width: 3, role: "data" },
        { id: "rb", name: "B addr", dir: "in", width: 3, role: "data" },
        { id: "rd", name: "W addr", dir: "in", width: 3, role: "data" },
        { id: "d", name: "W data", dir: "in", width: w, role: "data" },
        { id: "we", name: "WE", dir: "in", width: 1, role: "control" },
        { id: "clk", name: "CLK", dir: "in", width: 1, role: "clock" },
        { id: "a", name: "A", dir: "out", width: w, role: "data" },
        { id: "b", name: "B", dir: "out", width: w, role: "data" },
      ];
    case "imem":
    case "dmem":
    case "umem":
      return [
        { id: "addr", name: "Addr", dir: "in", width: w, role: "data" },
        { id: "d", name: "Din", dir: "in", width: w, role: "data" },
        { id: "re", name: "RE", dir: "in", width: 1, role: "control" },
        { id: "we", name: "WE", dir: "in", width: 1, role: "control" },
        { id: "clk", name: "CLK", dir: "in", width: 1, role: "clock" },
        { id: "q", name: "Dout", dir: "out", width: w, role: "data" },
      ];
    case "alu":
      return [
        { id: "a", name: "A", dir: "in", width: w, role: "data" },
        { id: "b", name: "B", dir: "in", width: w, role: "data" },
        { id: "op", name: "Op", dir: "in", width: 4, role: "control" },
        { id: "y", name: "Y", dir: "out", width: w, role: "data" },
        { id: "z", name: "Z", dir: "out", width: 1, role: "control" },
      ];
    case "shifter":
    case "inc":
    case "sext":
    case "buf":
      return [
        { id: "a", name: "A", dir: "in", width: w, role: "data" },
        { id: "y", name: "Y", dir: "out", width: w, role: "data" },
      ];
    case "cmp":
      return [
        { id: "a", name: "A", dir: "in", width: w, role: "data" },
        { id: "b", name: "B", dir: "in", width: w, role: "data" },
        { id: "eq", name: "EQ", dir: "out", width: 1, role: "control" },
      ];
    case "mux":
      return [
        { id: "i0", name: "I0", dir: "in", width: w, role: "data" },
        { id: "i1", name: "I1", dir: "in", width: w, role: "data" },
        { id: "s", name: "S", dir: "in", width: 1, role: "control" },
        { id: "y", name: "Y", dir: "out", width: w, role: "data" },
      ];
    case "bus":
      return [
        { id: "a", name: "A", dir: "in", width: w, role: "data" },
        { id: "en", name: "EN", dir: "in", width: 1, role: "control" },
        { id: "y", name: "Y", dir: "out", width: w, role: "data" },
      ];
    case "split":
      return [
        { id: "a", name: "A", dir: "in", width: w, role: "data" },
        { id: "hi", name: "Hi", dir: "out", width: Math.max(1, w / 2) as Width, role: "data" },
        { id: "lo", name: "Lo", dir: "out", width: Math.max(1, w / 2) as Width, role: "data" },
      ];
    case "join":
      return [
        { id: "hi", name: "Hi", dir: "in", width: Math.max(1, w / 2) as Width, role: "data" },
        { id: "lo", name: "Lo", dir: "in", width: Math.max(1, w / 2) as Width, role: "data" },
        { id: "y", name: "Y", dir: "out", width: w, role: "data" },
      ];
    case "const":
    case "clock":
      return [{ id: "y", name: "Y", dir: "out", width: node.kind === "clock" ? 1 : w, role: node.kind === "clock" ? "clock" : "data" }];
    case "decoder":
    case "cu":
      return [
        { id: "ir", name: "IR", dir: "in", width: 16, role: "data" },
        { id: "regwrite", name: "RegWrite", dir: "out", width: 1, role: "control" },
        { id: "alusrc", name: "ALUSrc", dir: "out", width: 1, role: "control" },
        { id: "memread", name: "MemRead", dir: "out", width: 1, role: "control" },
        { id: "memwrite", name: "MemWrite", dir: "out", width: 1, role: "control" },
        { id: "memtoreg", name: "MemToReg", dir: "out", width: 1, role: "control" },
        { id: "branch", name: "Branch", dir: "out", width: 1, role: "control" },
        { id: "aluop", name: "ALUOp", dir: "out", width: 4, role: "control" },
      ];
    case "probe":
    case "led":
    case "hex":
    case "num":
    case "bin":
      return [{ id: "a", name: "A", dir: "in", width: w, role: "data" }];
    case "and":
    case "or":
    case "nand":
    case "xor":
      return [
        { id: "a", name: "A", dir: "in", width: 1, role: "control" },
        { id: "b", name: "B", dir: "in", width: 1, role: "control" },
        { id: "y", name: "Y", dir: "out", width: 1, role: "control" },
      ];
    case "not":
      return [
        { id: "a", name: "A", dir: "in", width: 1, role: "control" },
        { id: "y", name: "Y", dir: "out", width: 1, role: "control" },
      ];
    case "dff":
      return [
        { id: "d", name: "D", dir: "in", width: 1, role: "control" },
        { id: "clk", name: "CLK", dir: "in", width: 1, role: "clock" },
        { id: "q", name: "Q", dir: "out", width: 1, role: "control" },
      ];
    case "counter":
      return [
        { id: "clk", name: "CLK", dir: "in", width: 1, role: "clock" },
        { id: "q", name: "Q", dir: "out", width: w, role: "data" },
      ];
    case "cache":
      return [
        { id: "addr", name: "Addr", dir: "in", width: 8, role: "data" },
        { id: "re", name: "RE", dir: "in", width: 1, role: "control" },
        { id: "hit", name: "Hit", dir: "out", width: 1, role: "control" },
        { id: "q", name: "Data", dir: "out", width: w, role: "data" },
      ];
    case "core":
      return [
        { id: "addr", name: "Addr", dir: "in", width: 8, role: "data" },
        { id: "we", name: "WE", dir: "in", width: 1, role: "control" },
        { id: "state", name: "State", dir: "out", width: 4, role: "control" },
      ];
    default:
      return [];
  }
}

export function portOf(node: ArchNode, id: string): PortDef | undefined {
  return portsOf(node).find((port) => port.id === id);
}

export const PALETTE: Array<{ kind: NodeKind; label: string; group: string }> = [
  { group: "Registers", kind: "pc", label: "PC" },
  { group: "Registers", kind: "gpr", label: "General register" },
  { group: "Registers", kind: "acc", label: "Accumulator" },
  { group: "Registers", kind: "regfile", label: "Register file" },
  { group: "Registers", kind: "ir", label: "IR" },
  { group: "Registers", kind: "mar", label: "MAR" },
  { group: "Registers", kind: "mdr", label: "MDR" },
  { group: "Registers", kind: "flags", label: "Status" },
  { group: "Registers", kind: "sp", label: "Stack pointer" },
  { group: "Memory", kind: "imem", label: "Instruction memory" },
  { group: "Memory", kind: "dmem", label: "Data memory" },
  { group: "Memory", kind: "umem", label: "Unified memory" },
  { group: "Processing", kind: "alu", label: "ALU" },
  { group: "Processing", kind: "shifter", label: "Shifter" },
  { group: "Processing", kind: "cmp", label: "Comparator" },
  { group: "Processing", kind: "inc", label: "Incrementer" },
  { group: "Processing", kind: "sext", label: "Sign extender" },
  { group: "Routing", kind: "bus", label: "Bus" },
  { group: "Routing", kind: "mux", label: "MUX" },
  { group: "Routing", kind: "split", label: "Splitter" },
  { group: "Routing", kind: "join", label: "Joiner" },
  { group: "Routing", kind: "const", label: "Constant" },
  { group: "Routing", kind: "buf", label: "Buffer" },
  { group: "Control", kind: "decoder", label: "Decoder" },
  { group: "Control", kind: "cu", label: "Control unit" },
  { group: "Control", kind: "clock", label: "Clock" },
  { group: "Observation", kind: "probe", label: "Probe" },
  { group: "Observation", kind: "led", label: "LED" },
  { group: "Observation", kind: "num", label: "Numeric" },
  { group: "Observation", kind: "bin", label: "Binary" },
  { group: "Observation", kind: "hex", label: "Hex" },
];

export const GATE_PALETTE: Array<{ kind: NodeKind; label: string; group: string }> = [
  { group: "Gates", kind: "and", label: "AND" },
  { group: "Gates", kind: "or", label: "OR" },
  { group: "Gates", kind: "not", label: "NOT" },
  { group: "Gates", kind: "nand", label: "NAND" },
  { group: "Gates", kind: "xor", label: "XOR" },
  { group: "Sequential", kind: "dff", label: "D flip-flop" },
  { group: "Sequential", kind: "counter", label: "Counter" },
  { group: "Routing", kind: "mux", label: "MUX" },
  { group: "Routing", kind: "const", label: "Constant" },
  { group: "Observation", kind: "led", label: "LED" },
  { group: "Observation", kind: "probe", label: "Probe" },
  { group: "Control", kind: "clock", label: "Clock" },
];

export const MEMORY_PALETTE: Array<{ kind: NodeKind; label: string; group: string }> = [
  { group: "Memory", kind: "dmem", label: "RAM" },
  { group: "Memory", kind: "cache", label: "Cache" },
  { group: "Memory", kind: "umem", label: "Backing store" },
  { group: "Registers", kind: "mar", label: "MAR" },
  { group: "Registers", kind: "mdr", label: "MDR" },
  { group: "Observation", kind: "probe", label: "Probe" },
];

export const CPU_PALETTE = PALETTE.filter((item) => item.group === "Registers" || item.group === "Memory" || item.group === "Processing" || item.group === "Control");

export const MULTI_PALETTE: Array<{ kind: NodeKind; label: string; group: string }> = [
  { group: "Cores", kind: "core", label: "CPU core" },
  { group: "Memory", kind: "cache", label: "Private cache" },
  { group: "Memory", kind: "dmem", label: "Shared memory" },
  { group: "Routing", kind: "bus", label: "Interconnect" },
  { group: "Observation", kind: "probe", label: "Probe" },
];

function blankNode(kind: NodeKind, width: Width, id: string, x: number, y: number): ArchNode {
  const count = kind === "regfile" ? 8 : kind === "imem" || kind === "dmem" || kind === "umem" ? 64 : 0;
  return {
    id, kind, name: kind.toUpperCase(), x: snap(x), y: snap(y), width,
    value: kind === "const" ? 1 : 0,
    values: Array.from({ length: kind === "regfile" ? 8 : 0 }, () => 0),
    mem: Array.from({ length: count }, () => 0),
    we: false, op: "ADD", sel: 0, note: "",
  };
}

export function emptyDesign(name = "Untitled CPU"): CpuDesign {
  return {
    name, nodes: [], wires: [], nextId: 1,
    isa: defaultIsa(16, 8),
    program: "LOADI R1, 5\nLOADI R2, 7\nADD R3, R1, R2\nSTORE R3, 20\nHALT\n",
    pan: { x: 0, y: 0, k: 1 },
    breakpoints: [],
    probes: [],
    overlay: "both",
  };
}

export function defaultIsa(instrWidth: number, regs: number): IsaSpec {
  const fieldsR: IsaField[] = [
    { name: "opcode", lo: 12, width: 4, purpose: "opcode" },
    { name: "rd", lo: 9, width: 3, purpose: "rd" },
    { name: "rs1", lo: 6, width: 3, purpose: "rs1" },
    { name: "rs2", lo: 3, width: 3, purpose: "rs2" },
    { name: "funct", lo: 0, width: 3, purpose: "funct" },
  ];
  const fieldsI: IsaField[] = [
    { name: "opcode", lo: 12, width: 4, purpose: "opcode" },
    { name: "rd", lo: 9, width: 3, purpose: "rd" },
    { name: "imm", lo: 0, width: 9, purpose: "imm" },
  ];
  const fieldsJ: IsaField[] = [
    { name: "opcode", lo: 12, width: 4, purpose: "opcode" },
    { name: "imm", lo: 0, width: 12, purpose: "imm" },
  ];
  const fieldsB: IsaField[] = [
    { name: "opcode", lo: 12, width: 4, purpose: "opcode" },
    { name: "rs1", lo: 9, width: 3, purpose: "rs1" },
    { name: "rs2", lo: 6, width: 3, purpose: "rs2" },
    { name: "imm", lo: 0, width: 6, purpose: "imm" },
  ];
  const instructions: IsaInstruction[] = [
    { mnemonic: "HALT", opcode: 0, format: "N", operands: [], aluOp: "AND", aluSrc: "reg", mem: "none", memToReg: false, regWrite: false, pc: "halt" },
    { mnemonic: "LOADI", opcode: 1, format: "I", operands: ["rd", "imm"], aluOp: "ADD", aluSrc: "imm", mem: "none", memToReg: false, regWrite: true, pc: "inc" },
    { mnemonic: "ADD", opcode: 2, format: "R", operands: ["rd", "rs1", "rs2"], aluOp: "ADD", aluSrc: "reg", mem: "none", memToReg: false, regWrite: true, pc: "inc" },
    { mnemonic: "SUB", opcode: 3, format: "R", operands: ["rd", "rs1", "rs2"], aluOp: "SUB", aluSrc: "reg", mem: "none", memToReg: false, regWrite: true, pc: "inc" },
    { mnemonic: "AND", opcode: 4, format: "R", operands: ["rd", "rs1", "rs2"], aluOp: "AND", aluSrc: "reg", mem: "none", memToReg: false, regWrite: true, pc: "inc" },
    { mnemonic: "OR", opcode: 5, format: "R", operands: ["rd", "rs1", "rs2"], aluOp: "OR", aluSrc: "reg", mem: "none", memToReg: false, regWrite: true, pc: "inc" },
    { mnemonic: "LOAD", opcode: 6, format: "I", operands: ["rd", "imm"], aluOp: "ADD", aluSrc: "imm", mem: "load", memToReg: true, regWrite: true, pc: "inc" },
    { mnemonic: "STORE", opcode: 7, format: "I", operands: ["rd", "imm"], aluOp: "ADD", aluSrc: "imm", mem: "store", memToReg: false, regWrite: false, pc: "inc" },
    { mnemonic: "BEQ", opcode: 8, format: "B", operands: ["rs1", "rs2", "imm"], aluOp: "SUB", aluSrc: "reg", mem: "none", memToReg: false, regWrite: false, pc: "branchEq" },
    { mnemonic: "JUMP", opcode: 9, format: "J", operands: ["imm"], aluOp: "ADD", aluSrc: "imm", mem: "none", memToReg: false, regWrite: false, pc: "jump" },
  ];
  return { name: "Custom-16", instrWidth, dataWidth: 16, regs, fieldsR, fieldsI, fieldsJ, fieldsB, instructions };
}

export function addNode(design: CpuDesign, kind: NodeKind, x: number, y: number, width?: Width): CpuDesign {
  const id = `n${design.nextId}`;
  const node = blankNode(kind, width ?? design.isa.dataWidth, id, x, y);
  return { ...design, nextId: design.nextId + 1, nodes: [...design.nodes, node] };
}

export function moveNode(design: CpuDesign, id: string, x: number, y: number): CpuDesign {
  return { ...design, nodes: design.nodes.map((node) => (node.id === id ? { ...node, x: snap(x), y: snap(y) } : node)) };
}

export function patchNode(design: CpuDesign, id: string, patch: Partial<ArchNode>): CpuDesign {
  return { ...design, nodes: design.nodes.map((node) => (node.id === id ? { ...node, ...patch, id: node.id, kind: node.kind } : node)) };
}

export function deleteNodes(design: CpuDesign, ids: string[]): CpuDesign {
  const drop = new Set(ids);
  return {
    ...design,
    nodes: design.nodes.filter((node) => !drop.has(node.id)),
    wires: design.wires.filter((wire) => !drop.has(wire.from) && !drop.has(wire.to)),
  };
}

export function connect(design: CpuDesign, from: string, fromPort: string, to: string, toPort: string): { design: CpuDesign; error: string | null } {
  if (from === to) return { design, error: "A port cannot connect to itself." };
  const src = design.nodes.find((node) => node.id === from);
  const dst = design.nodes.find((node) => node.id === to);
  if (!src || !dst) return { design, error: "Missing component." };
  const out = portOf(src, fromPort);
  const inn = portOf(dst, toPort);
  if (!out || out.dir !== "out") return { design, error: "Start the wire on an output port." };
  if (!inn || inn.dir !== "in") return { design, error: "Finish the wire on an input port." };
  if (out.width !== inn.width) {
    return { design, error: `Width mismatch: ${out.width}-bit output cannot directly drive a ${inn.width}-bit input.` };
  }
  if (design.wires.some((wire) => wire.to === to && wire.toPort === toPort)) {
    return { design, error: `Input ${dst.name}.${inn.name} already has a driver.` };
  }
  const id = `w${design.nextId}`;
  return { design: { ...design, nextId: design.nextId + 1, wires: [...design.wires, { id, from, fromPort, to, toPort }] }, error: null };
}

export function deleteWire(design: CpuDesign, id: string): CpuDesign {
  return { ...design, wires: design.wires.filter((wire) => wire.id !== id) };
}

export function duplicateNodes(design: CpuDesign, ids: string[]): CpuDesign {
  let next = design;
  const map = new Map<string, string>();
  for (const id of ids) {
    const node = design.nodes.find((item) => item.id === id);
    if (!node) continue;
    next = addNode(next, node.kind, node.x + 32, node.y + 32, node.width);
    const added = next.nodes[next.nodes.length - 1];
    if (!added) continue;
    map.set(id, added.id);
    next = patchNode(next, added.id, { name: `${node.name} copy`, value: node.value, op: node.op });
  }
  for (const wire of design.wires) {
    const from = map.get(wire.from);
    const to = map.get(wire.to);
    if (!from || !to) continue;
    const linked = connect(next, from, wire.fromPort, to, wire.toPort);
    next = linked.design;
  }
  return next;
}

export function fieldsOf(isa: IsaSpec, format: IsaInstruction["format"]): IsaField[] {
  if (format === "R") return isa.fieldsR;
  if (format === "I") return isa.fieldsI;
  if (format === "J") return isa.fieldsJ;
  if (format === "B") return isa.fieldsB;
  return isa.fieldsR.filter((field) => field.purpose === "opcode");
}
