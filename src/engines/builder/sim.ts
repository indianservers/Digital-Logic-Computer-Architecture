import { alu, type AluOp } from "../digital/arithmetic";
import { fromUnsigned, toUnsigned } from "../digital/vector";
import { accessCache, createCache, type CacheMachine } from "../cache/cache";
import { mesiStep, presetCache, type MesiState } from "../arch/coherence";
import { assemble, decodeWord } from "./isa";
import { maskBits, patchNode, portsOf, type ArchNode, type CpuDesign } from "./model";
import { combinationalLoops } from "./validate";

export const HISTORY = 64;
const ALU_CODE: AluOp[] = ["ADD", "SUB", "AND", "OR", "XOR", "NOT", "SHL", "SHR", "CMP", "INC", "DEC"];

export interface Controls {
  RegWrite: 0 | 1;
  ALUSrc: 0 | 1;
  MemRead: 0 | 1;
  MemWrite: 0 | 1;
  MemToReg: 0 | 1;
  Branch: 0 | 1;
  ALUOp: AluOp;
}

export interface ExecTrace {
  cycle: number;
  pc: number;
  ir: number;
  mnemonic: string;
  opcode: number;
  aluA: number;
  aluB: number;
  aluY: number;
  flags: { z: 0 | 1; n: 0 | 1; c: 0 | 1; v: 0 | 1 };
  memOp: string;
  controls: Controls;
  halt: boolean;
  reason: string;
}

export interface SimSnap {
  nodes: ArchNode[];
  cycle: number;
  trace: ExecTrace | null;
}

export interface WaveSample {
  cycle: number;
  clock: number;
  values: Record<string, number>;
}

export interface GraphView {
  values: Map<string, number>;
  active: Set<string>;
  loop: string | null;
}

function findKind(design: CpuDesign, kind: ArchNode["kind"]): ArchNode | undefined {
  return design.nodes.find((node) => node.kind === kind);
}

export function aluNum(a: number, b: number, op: AluOp, width: number): { y: number; z: 0 | 1; n: 0 | 1; c: 0 | 1; v: 0 | 1 } {
  const mask = maskBits(width);
  const result = alu(fromUnsigned(a & mask, width), fromUnsigned(b & mask, width), op);
  const y = toUnsigned(result.result) ?? 0;
  return { y: y & mask, z: result.zero, n: result.negative, c: result.carry, v: result.overflow };
}

function portKey(id: string, port: string): string {
  return `${id}:${port}`;
}

function readReg(node: ArchNode | undefined, index: number): number {
  if (!node) return 0;
  if (node.kind === "acc") return node.value;
  return node.values[index] ?? 0;
}

function writeReg(node: ArchNode, index: number, data: number, we: boolean): ArchNode {
  if (!we) return node;
  const mask = maskBits(node.width);
  if (node.kind === "acc") return { ...node, value: data & mask };
  const values = node.values.slice();
  if (index >= 0 && index < values.length) values[index] = data & mask;
  return { ...node, values };
}

export function controlsOf(mnemonic: string, isa: CpuDesign["isa"]): Controls {
  const instr = isa.instructions.find((item) => item.mnemonic === mnemonic);
  if (!instr) return { RegWrite: 0, ALUSrc: 0, MemRead: 0, MemWrite: 0, MemToReg: 0, Branch: 0, ALUOp: "ADD" };
  return {
    RegWrite: instr.regWrite ? 1 : 0,
    ALUSrc: instr.aluSrc === "imm" ? 1 : 0,
    MemRead: instr.mem === "load" ? 1 : 0,
    MemWrite: instr.mem === "store" ? 1 : 0,
    MemToReg: instr.memToReg ? 1 : 0,
    Branch: instr.pc === "branchEq" || instr.pc === "branchNe" || instr.pc === "jump" ? 1 : 0,
    ALUOp: instr.aluOp,
  };
}

export function evaluateGraph(design: CpuDesign): GraphView {
  const values = new Map<string, number>();
  const loops = combinationalLoops(design);
  for (const node of design.nodes) {
    if (node.kind === "const" || node.kind === "clock") values.set(portKey(node.id, "y"), node.value);
    if (node.kind === "pc" || node.kind === "acc" || node.kind === "gpr" || node.kind === "ir" || node.kind === "mar" || node.kind === "mdr" || node.kind === "sp" || node.kind === "dff" || node.kind === "counter") {
      values.set(portKey(node.id, "q"), node.value);
    }
    if (node.kind === "regfile") {
      values.set(portKey(node.id, "a"), node.values[0] ?? 0);
      values.set(portKey(node.id, "b"), node.values[1] ?? 0);
    }
    if (node.kind === "imem" || node.kind === "dmem" || node.kind === "umem") {
      values.set(portKey(node.id, "q"), node.mem[node.value] ?? 0);
    }
    if (node.kind === "flags") values.set(portKey(node.id, "qz"), node.value & 1);
  }
  const inputOf = (id: string, port: string): number => {
    const wire = design.wires.find((item) => item.to === id && item.toPort === port);
    if (!wire) return 0;
    return values.get(portKey(wire.from, wire.fromPort)) ?? 0;
  };
  for (let pass = 0; pass < 24; pass += 1) {
    let changed = false;
    for (const node of design.nodes) {
      const write = (port: string, value: number) => {
        const key = portKey(node.id, port);
        const masked = value & maskBits(portsOf(node).find((item) => item.id === port)?.width ?? node.width);
        if (values.get(key) !== masked) {
          values.set(key, masked);
          changed = true;
        }
      };
      if (node.kind === "mux") write("y", inputOf(node.id, "s") ? inputOf(node.id, "i1") : inputOf(node.id, "i0"));
      if (node.kind === "alu") {
        const op = ALU_CODE[inputOf(node.id, "op")] ?? node.op;
        write("y", aluNum(inputOf(node.id, "a"), inputOf(node.id, "b"), op, node.width).y);
        write("z", aluNum(inputOf(node.id, "a"), inputOf(node.id, "b"), op, node.width).z);
      }
      if (node.kind === "buf" || node.kind === "sext") write("y", inputOf(node.id, "a"));
      if (node.kind === "inc") write("y", (inputOf(node.id, "a") + 1) & maskBits(node.width));
      if (node.kind === "shifter") write("y", (inputOf(node.id, "a") << 1) & maskBits(node.width));
      if (node.kind === "cmp") write("eq", inputOf(node.id, "a") === inputOf(node.id, "b") ? 1 : 0);
      if (node.kind === "bus") write("y", inputOf(node.id, "en") ? inputOf(node.id, "a") : 0);
      if (node.kind === "and") write("y", inputOf(node.id, "a") & inputOf(node.id, "b"));
      if (node.kind === "or") write("y", inputOf(node.id, "a") | inputOf(node.id, "b"));
      if (node.kind === "nand") write("y", (inputOf(node.id, "a") & inputOf(node.id, "b")) ? 0 : 1);
      if (node.kind === "xor") write("y", inputOf(node.id, "a") ^ inputOf(node.id, "b"));
      if (node.kind === "not") write("y", inputOf(node.id, "a") ? 0 : 1);
      if (node.kind === "split") {
        const half = Math.max(1, Math.floor(node.width / 2));
        const a = inputOf(node.id, "a");
        write("lo", a & maskBits(half));
        write("hi", (a >>> half) & maskBits(half));
      }
      if (node.kind === "join") {
        const half = Math.max(1, Math.floor(node.width / 2));
        write("y", ((inputOf(node.id, "hi") & maskBits(half)) << half) | (inputOf(node.id, "lo") & maskBits(half)));
      }
      if (node.kind === "led" || node.kind === "probe" || node.kind === "hex" || node.kind === "num" || node.kind === "bin") {
        write("a", inputOf(node.id, "a"));
      }
    }
    if (!changed) break;
  }
  const active = new Set<string>();
  for (const wire of design.wires) {
    if ((values.get(portKey(wire.from, wire.fromPort)) ?? 0) !== 0) active.add(wire.id);
  }
  return { values, active, loop: loops[0] ? loops[0].join(" → ") : null };
}

export function loadProgram(design: CpuDesign): { design: CpuDesign; error: string | null } {
  const assembled = assemble(design.isa, design.program);
  if (!assembled.ok) return { design, error: assembled.errors.map((item) => `Line ${item.line}: ${item.message}`).join(" ") };
  const imem = findKind(design, "imem") ?? findKind(design, "umem");
  if (!imem) return { design, error: "Instruction memory is missing." };
  const mem = imem.mem.slice().fill(0);
  assembled.words.forEach((word, index) => {
    if (index < mem.length) mem[index] = word;
  });
  return { design: patchNode(design, imem.id, { mem }), error: null };
}

export function resetCpu(design: CpuDesign): CpuDesign {
  let next = design;
  for (const node of design.nodes) {
    if (node.kind === "regfile") next = patchNode(next, node.id, { values: node.values.map(() => 0), value: 0 });
    else if (node.kind === "imem") continue;
    else if (node.kind === "dmem" || node.kind === "umem") next = patchNode(next, node.id, { mem: node.mem.map(() => 0), value: 0 });
    else if (node.kind === "const" || node.kind === "clock") continue;
    else next = patchNode(next, node.id, { value: 0 });
  }
  return loadProgram(next).design;
}

export function stepInstruction(design: CpuDesign, cycle: number): { design: CpuDesign; trace: ExecTrace } {
  const width = design.isa.dataWidth;
  const mask = maskBits(width);
  const pcNode = findKind(design, "pc");
  const imem = findKind(design, "imem") ?? findKind(design, "umem");
  const dmem = findKind(design, "dmem") ?? findKind(design, "umem");
  const rf = findKind(design, "regfile") ?? findKind(design, "acc");
  const aluNode = findKind(design, "alu");
  const irNode = findKind(design, "ir");
  const flags = findKind(design, "flags");
  const pc = pcNode?.value ?? 0;
  const ir = imem?.mem[pc] ?? 0;
  const decoded = decodeWord(design.isa, ir);
  const instr = decoded.instr;
  const mnemonic = instr?.mnemonic ?? "UNK";
  const controls = controlsOf(mnemonic, design.isa);
  const rs1 = decoded.fields.rs1 ?? 0;
  const rs2 = decoded.fields.rs2 ?? 0;
  const rd = decoded.fields.rd ?? 0;
  const imm = decoded.fields.imm ?? 0;
  const a = !instr
    ? 0
    : instr.operands.includes("rs1")
      ? readReg(rf, rs1)
      : instr.mem !== "none" || instr.mnemonic === "LOADI"
        ? 0
        : readReg(rf, rd);
  const b = controls.ALUSrc ? imm : readReg(rf, rs2);
  const aluRes = aluNum(a, b, controls.ALUOp, width);
  let memOp = "none";
  let writeData = aluRes.y;
  let nextDesign = design;
  if (irNode) nextDesign = patchNode(nextDesign, irNode.id, { value: ir });
  if (aluNode) nextDesign = patchNode(nextDesign, aluNode.id, { value: aluRes.y, op: controls.ALUOp });
  if (dmem && controls.MemRead) {
    writeData = dmem.mem[aluRes.y & (dmem.mem.length - 1)] ?? 0;
    memOp = `load [${aluRes.y}] → ${writeData}`;
    nextDesign = patchNode(nextDesign, dmem.id, { value: writeData });
  }
  if (dmem && controls.MemWrite) {
    const data = readReg(rf, rd);
    const mem = (findKind(nextDesign, dmem.kind)?.mem ?? dmem.mem).slice();
    const addr = aluRes.y & (mem.length - 1);
    mem[addr] = data & mask;
    memOp = `store ${data} → [${addr}]`;
    nextDesign = patchNode(nextDesign, dmem.id, { mem, value: data });
  }
  if (rf) {
    const current = findKind(nextDesign, rf.kind) ?? rf;
    nextDesign = patchNode(nextDesign, rf.id, writeReg(current, rd, writeData, Boolean(controls.RegWrite)));
  }
  if (flags) nextDesign = patchNode(nextDesign, flags.id, { value: aluRes.z });
  let nextPc = (pc + 1) & mask;
  let halt = false;
  if (instr?.pc === "halt") {
    nextPc = pc;
    halt = true;
  } else if (instr?.pc === "jump") nextPc = imm & mask;
  else if (instr?.pc === "branchEq" && aluRes.z) nextPc = (pc + signImm(imm, 6)) & mask;
  else if (instr?.pc === "branchNe" && !aluRes.z) nextPc = (pc + signImm(imm, 6)) & mask;
  if (pcNode) nextDesign = patchNode(nextDesign, pcNode.id, { value: nextPc });
  const cu = findKind(nextDesign, "cu") ?? findKind(nextDesign, "decoder");
  if (cu) nextDesign = patchNode(nextDesign, cu.id, { value: ir, note: mnemonic });
  return {
    design: nextDesign,
    trace: {
      cycle, pc, ir, mnemonic, opcode: decoded.fields.opcode ?? 0,
      aluA: a, aluB: b, aluY: aluRes.y,
      flags: { z: aluRes.z, n: aluRes.n, c: aluRes.c, v: aluRes.v },
      memOp, controls, halt,
      reason: halt ? "HALT" : `${mnemonic} committed at PC=${pc}`,
    },
  };
}

function signImm(value: number, width: number): number {
  const sign = 1 << (width - 1);
  return (value & (sign - 1)) - (value & sign);
}

export function stepClock(design: CpuDesign, clock: 0 | 1, prev: 0 | 1): CpuDesign {
  if (!(prev === 0 && clock === 1)) return design;
  const view = evaluateGraph(design);
  let next = design;
  for (const node of design.nodes) {
    const din = (port: string) => {
      const wire = design.wires.find((item) => item.to === node.id && item.toPort === port);
      if (!wire) return 0;
      return view.values.get(`${wire.from}:${wire.fromPort}`) ?? 0;
    };
    if (node.kind === "dff") next = patchNode(next, node.id, { value: din("d") & 1 });
    if (node.kind === "counter") next = patchNode(next, node.id, { value: (node.value + 1) & maskBits(node.width) });
    if (node.kind === "gpr" || node.kind === "mdr" || node.kind === "mar" || node.kind === "sp") {
      if (din("we")) next = patchNode(next, node.id, { value: din("d") });
    }
  }
  return next;
}

export function hitBreakpoint(design: CpuDesign, trace: ExecTrace, prev: CpuDesign): string | null {
  for (const point of design.breakpoints) {
    if (!point.enabled) continue;
    if (point.kind === "pc" && trace.pc === (point.address ?? 0)) return `PC equals ${trace.pc}.`;
    if (point.kind === "mnemonic" && trace.mnemonic === (point.mnemonic ?? "").toUpperCase()) return `Instruction ${trace.mnemonic} reached.`;
    if (point.kind === "flag" && point.flag === "z" && trace.flags.z !== ((findKind(prev, "flags")?.value ?? 0) & 1)) return "Zero flag changed.";
    if (point.kind === "memwrite" && trace.controls.MemWrite) return "Memory write occurred.";
    if (point.kind === "reg") {
      const rf = findKind(design, "regfile") ?? findKind(design, "acc");
      const value = readReg(rf, point.reg ?? 0);
      if (value === (point.value ?? 0)) return `Register equals ${value}.`;
    }
  }
  return null;
}

export function sampleWave(design: CpuDesign, cycle: number, clock: number, view: GraphView): WaveSample {
  const values: Record<string, number> = { clock };
  const pc = findKind(design, "pc");
  const cu = findKind(design, "cu");
  if (pc) values.pc = pc.value;
  if (cu) {
    const controls = controlsOf(cu.note || "HALT", design.isa);
    values.RegWrite = controls.RegWrite;
    values.MemRead = controls.MemRead;
    values.MemWrite = controls.MemWrite;
  }
  for (const id of design.probes) {
    const node = design.nodes.find((item) => item.id === id);
    if (!node) continue;
    values[node.name] = view.values.get(`${id}:q`) ?? view.values.get(`${id}:y`) ?? node.value;
  }
  return { cycle, clock, values };
}

export function sandboxCacheAccess(machine: CacheMachine | null, address: number, op: "read" | "write"): { machine: CacheMachine; hit: boolean; explain: string } {
  const cache = machine ?? createCache(presetCache());
  const result = accessCache(cache, address, op, 1);
  return { machine: result.machine, hit: result.result.hit, explain: result.result.explain };
}

export function sandboxCoherence(states: MesiState[], core: number, op: "read" | "write"): { states: MesiState[]; bus: string } {
  const stepped = mesiStep(states, core, op);
  return { states: stepped.states, bus: stepped.bus };
}

export function designJson(design: CpuDesign): string {
  return JSON.stringify({ version: 1, kind: "logiclab-cpu", design }, null, 2);
}

export function parseDesignJson(raw: string): { ok: true; design: CpuDesign } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(raw) as { kind?: string; design?: CpuDesign };
    if (!parsed.design || !Array.isArray(parsed.design.nodes) || !Array.isArray(parsed.design.wires) || !parsed.design.isa) {
      return { ok: false, error: "That file is not a LogicLab CPU design. Expected a .cpu.json object with nodes, wires, and isa." };
    }
    return { ok: true, design: parsed.design };
  } catch {
    return { ok: false, error: "Could not parse the file. Check that it is valid JSON." };
  }
}
