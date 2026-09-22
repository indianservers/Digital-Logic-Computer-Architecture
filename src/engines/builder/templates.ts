import { addNode, connect, defaultIsa, emptyDesign, patchNode, type CpuDesign, type IsaSpec, type NodeKind, type Width } from "./model";

export interface CpuTemplate {
  id: string;
  title: string;
  description: string;
  isa: string;
  width: Width;
  level: string;
  build: () => CpuDesign;
}

export type SandboxMode = "circuit" | "datapath" | "memory" | "cpu" | "multicore";

export interface SandboxTemplate {
  id: string;
  title: string;
  mode: SandboxMode;
  description: string;
  build: () => CpuDesign;
}

function accIsa(): IsaSpec {
  const isa = defaultIsa(16, 1);
  isa.name = "ACC-8";
  isa.dataWidth = 8;
  isa.regs = 1;
  isa.instructions = [
    { mnemonic: "HALT", opcode: 0, format: "N", operands: [], aluOp: "AND", aluSrc: "reg", mem: "none", memToReg: false, regWrite: false, pc: "halt" },
    { mnemonic: "LOADI", opcode: 1, format: "I", operands: ["imm"], aluOp: "ADD", aluSrc: "imm", mem: "none", memToReg: false, regWrite: true, pc: "inc" },
    { mnemonic: "ADD", opcode: 2, format: "I", operands: ["imm"], aluOp: "ADD", aluSrc: "imm", mem: "none", memToReg: false, regWrite: true, pc: "inc" },
    { mnemonic: "STORE", opcode: 7, format: "I", operands: ["imm"], aluOp: "ADD", aluSrc: "imm", mem: "store", memToReg: false, regWrite: false, pc: "inc" },
  ];
  return isa;
}

function named(design: CpuDesign, kind: NodeKind, x: number, y: number, name: string, width?: Width): CpuDesign {
  const next = addNode(design, kind, x, y, width);
  const node = next.nodes[next.nodes.length - 1];
  return node ? patchNode(next, node.id, { name }) : next;
}

function idOf(design: CpuDesign, name: string): string {
  return design.nodes.find((node) => node.name === name)?.id ?? "";
}

function link(design: CpuDesign, from: string, fromPort: string, to: string, toPort: string): CpuDesign {
  const result = connect(design, idOf(design, from), fromPort, idOf(design, to), toPort);
  return result.design;
}

function coreCpu(width: Width, withRf: boolean, name: string, isa: IsaSpec, program: string): CpuDesign {
  let d = emptyDesign(name);
  d.isa = isa;
  d.program = program;
  const instrW: Width = 16;
  d = named(d, "clock", 16, 16, "CLK", 1);
  d = named(d, "pc", 16, 80, "PC", instrW);
  d = named(d, "imem", 176, 80, "IMEM", instrW);
  d = named(d, "ir", 336, 80, "IR", instrW);
  d = named(d, "cu", 336, 220, "CU", instrW);
  d = named(d, withRf ? "regfile" : "acc", 512, 80, withRf ? "RF" : "ACC", width);
  d = named(d, "alu", 688, 80, "ALU", width);
  d = named(d, "dmem", 864, 80, "DMEM", width);
  d = named(d, "mux", 1040, 80, "WB", width);
  d = named(d, "inc", 16, 220, "PC+1", instrW);
  d = named(d, "flags", 688, 220, "FLAGS", 1);
  d = named(d, "probe", 1040, 220, "RESULT", width);
  d = link(d, "CLK", "y", "PC", "clk");
  d = link(d, "CLK", "y", withRf ? "RF" : "ACC", "clk");
  d = link(d, "CLK", "y", "IR", "clk");
  d = link(d, "CLK", "y", "DMEM", "clk");
  d = link(d, "PC", "q", "IMEM", "addr");
  d = link(d, "IMEM", "q", "IR", "d");
  d = link(d, "IR", "q", "CU", "ir");
  d = link(d, "PC", "q", "PC+1", "a");
  d = link(d, "PC+1", "y", "PC", "d");
  d = link(d, "CU", "regwrite", withRf ? "RF" : "ACC", "we");
  d = link(d, "ALU", "y", "WB", "i0");
  d = link(d, "DMEM", "q", "WB", "i1");
  d = link(d, "CU", "memtoreg", "WB", "s");
  d = link(d, "WB", "y", withRf ? "RF" : "ACC", "d");
  d = link(d, "ALU", "y", "DMEM", "addr");
  d = link(d, "CU", "memwrite", "DMEM", "we");
  d = link(d, "CU", "memread", "DMEM", "re");
  d = link(d, "ALU", "z", "FLAGS", "z");
  d = link(d, "WB", "y", "RESULT", "a");
  if (withRf) {
    d = link(d, "RF", "a", "ALU", "a");
    d = link(d, "RF", "b", "ALU", "b");
  } else {
    d = link(d, "ACC", "q", "ALU", "a");
  }
  return d;
}

const LOADSTORE = `LOADI R1, 5
LOADI R2, 7
ADD R3, R1, R2
STORE R3, 20
HALT
`;

const ACC_PROG = `LOADI 5
ADD 7
STORE 20
HALT
`;

export const CPU_TEMPLATES: CpuTemplate[] = [
  {
    id: "acc",
    title: "Minimal Accumulator CPU",
    description: "One accumulator, immediate ALU, and a tiny store path.",
    isa: "ACC-8 · LOADI ADD STORE HALT",
    width: 8,
    level: "Intro",
    build: () => coreCpu(8, false, "Accumulator CPU", accIsa(), ACC_PROG),
  },
  {
    id: "cpu8",
    title: "Simple 8-bit CPU",
    description: "8-bit datapath with an 8-register file and 16-bit encodings.",
    isa: "Custom-16 on 8-bit data",
    width: 8,
    level: "Intro",
    build: () => {
      const isa = defaultIsa(16, 8);
      isa.dataWidth = 8;
      return coreCpu(8, true, "Simple 8-bit CPU", isa, LOADSTORE);
    },
  },
  {
    id: "cpu16",
    title: "Simple 16-bit CPU",
    description: "16-bit registers, ALU, and load/store memory.",
    isa: "Custom-16",
    width: 16,
    level: "Core",
    build: () => coreCpu(16, true, "Simple 16-bit CPU", defaultIsa(16, 8), LOADSTORE),
  },
  {
    id: "regreg",
    title: "Register-Register CPU",
    description: "ALU-centric machine. Memory is optional; arithmetic stays in the register file.",
    isa: "ADD SUB AND OR LOADI HALT",
    width: 16,
    level: "Core",
    build: () => {
      const isa = defaultIsa(16, 8);
      isa.instructions = isa.instructions.filter((item) => item.mem === "none");
      return coreCpu(16, true, "Register-Register CPU", isa, "LOADI R1, 5\nLOADI R2, 7\nADD R3, R1, R2\nHALT\n");
    },
  },
  {
    id: "loadstore",
    title: "Load/Store CPU",
    description: "Only loads and stores touch data memory. Arithmetic uses registers.",
    isa: "LOAD STORE ADD LOADI HALT",
    width: 16,
    level: "Core",
    build: () => coreCpu(16, true, "Load/Store CPU", defaultIsa(16, 8), LOADSTORE),
  },
  {
    id: "five",
    title: "Five-Stage Educational CPU",
    description: "IF, ID, EX, MEM, and WB latches around the same teaching ISA. One instruction still commits per instruction-step.",
    isa: "Custom-16 · five named stages",
    width: 16,
    level: "Advanced",
    build: () => {
      let d = coreCpu(16, true, "Five-stage CPU", defaultIsa(16, 8), LOADSTORE);
      d = named(d, "gpr", 176, 220, "IF/ID", 16);
      d = named(d, "gpr", 512, 220, "ID/EX", 16);
      d = named(d, "gpr", 688, 320, "EX/MEM", 16);
      d = named(d, "gpr", 864, 220, "MEM/WB", 16);
      d = link(d, "CLK", "y", "IF/ID", "clk");
      d = link(d, "CLK", "y", "ID/EX", "clk");
      d = link(d, "CLK", "y", "EX/MEM", "clk");
      d = link(d, "CLK", "y", "MEM/WB", "clk");
      d = link(d, "IR", "q", "IF/ID", "d");
      d = link(d, "IF/ID", "q", "ID/EX", "d");
      d = link(d, "ALU", "y", "EX/MEM", "d");
      d = link(d, "DMEM", "q", "MEM/WB", "d");
      return d;
    },
  },
];

export function templateById(id: string): CpuTemplate | undefined {
  return CPU_TEMPLATES.find((item) => item.id === id);
}

export const SANDBOX_TEMPLATES: SandboxTemplate[] = [
  {
    id: "adder",
    title: "Full Adder Circuit",
    mode: "circuit",
    description: "Two XOR/AND fragments feeding a sum and carry LED.",
    build: () => {
      let d = emptyDesign("Full adder");
      d = named(d, "const", 16, 48, "A", 1);
      d = named(d, "const", 16, 128, "B", 1);
      d = named(d, "xor", 176, 48, "XOR1", 1);
      d = named(d, "and", 176, 160, "AND1", 1);
      d = named(d, "led", 336, 48, "SUM", 1);
      d = named(d, "led", 336, 160, "COUT", 1);
      d = patchNode(d, idOf(d, "A"), { value: 1 });
      d = patchNode(d, idOf(d, "B"), { value: 1 });
      d = link(d, "A", "y", "XOR1", "a");
      d = link(d, "B", "y", "XOR1", "b");
      d = link(d, "A", "y", "AND1", "a");
      d = link(d, "B", "y", "AND1", "b");
      d = link(d, "XOR1", "y", "SUM", "a");
      d = link(d, "AND1", "y", "COUT", "a");
      return d;
    },
  },
  {
    id: "reg4",
    title: "4-bit Register Datapath",
    mode: "datapath",
    description: "Constant → register → probe, clocked on the rising edge.",
    build: () => {
      let d = emptyDesign("4-bit register");
      d.isa.dataWidth = 4;
      d = named(d, "clock", 16, 16, "CLK", 1);
      d = named(d, "const", 16, 96, "DIN", 4);
      d = named(d, "const", 16, 176, "WE", 1);
      d = named(d, "gpr", 176, 96, "REG", 4);
      d = named(d, "probe", 336, 96, "OUT", 4);
      d = patchNode(d, idOf(d, "DIN"), { value: 10, width: 4 });
      d = patchNode(d, idOf(d, "WE"), { value: 1, width: 1 });
      d = patchNode(d, idOf(d, "REG"), { width: 4 });
      d = link(d, "CLK", "y", "REG", "clk");
      d = link(d, "DIN", "y", "REG", "d");
      d = link(d, "WE", "y", "REG", "we");
      d = link(d, "REG", "q", "OUT", "a");
      return d;
    },
  },
  {
    id: "alu",
    title: "Tiny ALU",
    mode: "datapath",
    description: "Two constants into an ALU with a numeric display.",
    build: () => {
      let d = emptyDesign("Tiny ALU");
      d = named(d, "const", 16, 48, "A", 8);
      d = named(d, "const", 16, 144, "B", 8);
      d = named(d, "alu", 192, 80, "ALU", 8);
      d = named(d, "num", 368, 80, "Y", 8);
      d = patchNode(d, idOf(d, "A"), { value: 5, width: 8 });
      d = patchNode(d, idOf(d, "B"), { value: 7, width: 8 });
      d = link(d, "A", "y", "ALU", "a");
      d = link(d, "B", "y", "ALU", "b");
      d = link(d, "ALU", "y", "Y", "a");
      return d;
    },
  },
  {
    id: "memcache",
    title: "Memory + Cache",
    mode: "memory",
    description: "Address register, cache, and backing RAM on one path.",
    build: () => {
      let d = emptyDesign("Memory + cache");
      d = named(d, "mar", 16, 80, "MAR", 8);
      d = named(d, "cache", 192, 80, "L1", 8);
      d = named(d, "dmem", 368, 80, "RAM", 8);
      d = named(d, "probe", 544, 80, "DATA", 8);
      d = link(d, "MAR", "q", "L1", "addr");
      d = link(d, "MAR", "q", "RAM", "addr");
      d = link(d, "RAM", "q", "DATA", "a");
      return d;
    },
  },
  {
    id: "cpumem",
    title: "Single CPU + Memory",
    mode: "cpu",
    description: "The 16-bit load/store CPU dropped into the sandbox.",
    build: () => CPU_TEMPLATES[4]?.build() ?? emptyDesign(),
  },
  {
    id: "pipe",
    title: "Simple Pipeline",
    mode: "cpu",
    description: "Five-stage latches around the teaching CPU.",
    build: () => CPU_TEMPLATES[5]?.build() ?? emptyDesign(),
  },
  {
    id: "dual",
    title: "Two-Core Shared Memory",
    mode: "multicore",
    description: "Two cores, two private caches, one shared RAM.",
    build: () => {
      let d = emptyDesign("Two-core shared memory");
      d = named(d, "core", 16, 64, "CORE0", 8);
      d = named(d, "core", 16, 176, "CORE1", 8);
      d = named(d, "cache", 192, 64, "L1-0", 8);
      d = named(d, "cache", 192, 176, "L1-1", 8);
      d = named(d, "dmem", 368, 112, "SHARED", 8);
      d = named(d, "bus", 280, 112, "BUS", 8);
      d = link(d, "CORE0", "state", "BUS", "en");
      d = link(d, "L1-0", "q", "BUS", "a");
      d = link(d, "BUS", "y", "SHARED", "d");
      return d;
    },
  },
  {
    id: "mesi",
    title: "Cache Coherence Demonstration",
    mode: "multicore",
    description: "Two cores sharing a line. Step reads and writes to watch MESI.",
    build: () => {
      let d = emptyDesign("MESI demo");
      d = named(d, "core", 32, 80, "CORE0", 8);
      d = named(d, "core", 32, 200, "CORE1", 8);
      d = named(d, "cache", 208, 80, "C0", 8);
      d = named(d, "cache", 208, 200, "C1", 8);
      d = named(d, "dmem", 384, 140, "MEM", 8);
      d = named(d, "probe", 560, 140, "LINE", 8);
      d = link(d, "MEM", "q", "LINE", "a");
      return d;
    },
  },
];

export function sandboxPalette(mode: SandboxMode) {
  if (mode === "circuit") return ["and", "or", "not", "nand", "xor", "mux", "dff", "counter", "const", "clock", "led", "probe"] as const;
  if (mode === "memory") return ["mar", "mdr", "dmem", "umem", "cache", "probe", "bus"] as const;
  if (mode === "multicore") return ["core", "cache", "dmem", "bus", "probe"] as const;
  if (mode === "cpu") return ["pc", "regfile", "alu", "imem", "dmem", "cu", "mux", "clock", "probe"] as const;
  return ["pc", "gpr", "regfile", "alu", "mux", "bus", "const", "dmem", "clock", "probe"] as const;
}
