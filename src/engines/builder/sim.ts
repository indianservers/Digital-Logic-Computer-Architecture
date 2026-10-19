import { alu, type AluOp } from "../digital/arithmetic";
import { fromUnsigned, toUnsigned } from "../digital/vector";
import { accessCache, createCache, type CacheMachine } from "../cache/cache";
import { mesiStep, presetCache, type MesiState } from "../arch/coherence";
import { assemble, decodeWord, immediateWidth, signedImmediate } from "./isa";
import { fieldsOf, maskBits, patchNode, portsOf, type ArchNode, type CpuDesign } from "./model";
import { canonicalJson, migrateProject, engineeringOf } from "./project";
import { evaluateLogicGraph } from "./logicGraph";
import { combinationalLoops, validateDesign } from "./validate";
import { behaviorValues, expression, flattenCircuit } from "./construction";

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
  design?: CpuDesign;
  clock?: 0 | 1;
}

export interface WaveSample {
  cycle: number;
  clock: number;
  values: Record<string, number>;
  logic?: Record<string, string>;
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
  const result = alu(fromUnsigned((a & mask) >>> 0, width), fromUnsigned((b & mask) >>> 0, width), op);
  const y = toUnsigned(result.result) ?? 0;
  return { y: (y & mask) >>> 0, z: result.zero, n: result.negative, c: result.carry, v: result.overflow };
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
  if (node.kind === "acc") return { ...node, value: (data & mask) >>> 0 };
  const values = node.values.slice();
  if (index >= 0 && index < values.length) values[index] = (data & mask) >>> 0;
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

export function evaluateGraph(design: CpuDesign, controlOverrides?: Record<string, 0 | 1 | "instruction">): GraphView {
  if(design.nodes.some(n=>n.circuit)||design.engineering?.construction?.nets?.length){const flat=flattenCircuit(design);const view=evaluateGraph(flat.design,controlOverrides);for(const [key,value] of flat.aliases)view.values.set(key,view.values.get(value)??0);return view;}
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
    if (node.kind === "flags") { for(const [port,bit] of [["qz",0],["qn",1],["qc",2],["qv",3]] as const) values.set(portKey(node.id,port),(node.value>>>bit)&1); }
  }
  const inputOf = (id: string, port: string): number => {
    const wire = design.wires.find((item) => item.to === id && item.toPort === port);
    if (!wire) return 0;
    return values.get(portKey(wire.from, wire.fromPort)) ?? 0;
  };
  for (let pass = 0; pass < Math.max(24, design.nodes.length + 2); pass += 1) {
    let changed = false;
    for (const node of design.nodes) {
      const write = (port: string, value: number) => {
        const key = portKey(node.id, port);
        const masked = (value & maskBits(portsOf(node).find((item) => item.id === port)?.width ?? node.width)) >>> 0;
        if (values.get(key) !== masked) {
          values.set(key, masked);
          changed = true;
        }
      };
      if(node.behavior){try{for(const [port,value] of Object.entries(behaviorValues(node,port=>inputOf(node.id,port))))write(port,value);}catch{/* Four-state inspection reports invalid/unknown custom outputs. */}continue;}
      if (node.kind === "regfile") {
        write("a", node.values[inputOf(node.id, "ra")] ?? 0); write("b", node.values[inputOf(node.id, "rb")] ?? 0);
      }
      if (node.kind === "imem" || node.kind === "dmem" || node.kind === "umem") {
        const addr = inputOf(node.id, "addr"); write("q", node.kind === "dmem" && !inputOf(node.id,"re") ? 0 : node.mem[addr] ?? 0);
      }
      if (node.kind === "cu" || node.kind === "decoder") {
        const decoded = decodeWord(design.isa, inputOf(node.id, "ir")); const i = decoded.instr;
        const c = controlsOf(i?.mnemonic ?? "", design.isa); const f = decoded.fields;
        const config = engineeringOf(design); const overrides = controlOverrides ?? (config.mode === "multi" ? config.control.find(s => s.id === config.state)?.signals ?? {} : {});
        const signal = (key: keyof Controls): number => { const v = overrides[key]; return v === 0 || v === 1 ? v : Number(c[key]); };
        write("regwrite", signal("RegWrite")); write("alusrc", signal("ALUSrc")); write("memread", signal("MemRead")); write("memwrite", signal("MemWrite")); write("memtoreg", signal("MemToReg")); write("branch", signal("Branch"));
        write("aluop", ALU_CODE.indexOf(c.ALUOp));
        write("ra", i?.operandA === "rd" ? f.rd ?? 0 : i?.operands.includes("rs1") ? f.rs1 ?? 0 : f.rd ?? 0); write("rb", i?.mem === "store" ? f.rd ?? 0 : f.rs2 ?? 0); write("rd", f.rd ?? 0);
        const bits = i ? immediateWidth(design.isa, i) : 0; const imm = f.imm ?? 0;
        write("imm", i && fieldsOf(design.isa, i.format).some(fld => fld.purpose === "imm" && fld.signed) ? signedImmediate(imm, bits) : imm);
        write("azero", (i?.operandA ?? (i?.mem !== "none" || i?.mnemonic === "LOADI" ? "zero" : "rd")) === "zero" ? 1 : 0);
        const pc = inputOf(node.id,"pc"); const zero = inputOf(node.id,"zero")===1;
        const branchEnabled=signal("Branch")!==0;
        const nextPc = i?.pc === "halt" ? pc : i?.pc === "jump" && branchEnabled ? imm : branchEnabled && (i?.pc === "branchEq" && zero || i?.pc === "branchNe" && !zero) ? pc + signedImmediate(imm, bits) : pc + 1;
        write("pcnext", nextPc); write("one", 1);
      }
      if (node.kind === "mux") write("y", inputOf(node.id, "s") ? inputOf(node.id, "i1") : inputOf(node.id, "i0"));
      if (node.kind === "alu") {
        const op = ALU_CODE[inputOf(node.id, "op")] ?? node.op;
        write("y", aluNum(inputOf(node.id, "a"), inputOf(node.id, "b"), op, node.width).y);
        const flags=aluNum(inputOf(node.id,"a"),inputOf(node.id,"b"),op,node.width);
        write("z",flags.z);write("n",flags.n);write("c",flags.c);write("v",flags.v);
      }
      if (node.kind === "buf") write("y", inputOf(node.id, "a"));
      if (node.kind === "sext") write("y", signedImmediate(inputOf(node.id, "a"), node.inputWidth ?? node.width));
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
  if (assembled.words.length > imem.mem.length) return { design, error: `Program needs ${assembled.words.length} words, but instruction memory holds ${imem.mem.length}.` };
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
  next = { ...next, engineering: { ...engineeringOf(next), state: engineeringOf(next).startState, cycle: 0, pendingSignals: undefined } };
  return loadProgram(next).design;
}

function faultTrace(design: CpuDesign, cycle: number, reason: string): { design: CpuDesign; trace: ExecTrace } {
  return { design, trace: { cycle, pc: findKind(design, "pc")?.value ?? 0, ir: 0, mnemonic: "FAULT", opcode: 0, aluA: 0, aluB: 0, aluY: 0, flags: { z: 0, n: 0, c: 0, v: 0 }, memOp: "none", controls: controlsOf("", design.isa), halt: true, reason } };
}
function wiredInput(design: CpuDesign, view: GraphView, node: ArchNode, port: string): number | undefined {
  const wires = design.wires.filter(w => w.to === node.id && w.toPort === port);
  if (wires.length !== 1) return undefined;
  const wire = wires[0]!; return view.values.get(`${wire.from}:${wire.fromPort}`);
}
export function stepInstruction(design: CpuDesign, cycle: number): { design: CpuDesign; trace: ExecTrace } {
  if(engineeringOf(design).construction?.execution==="circuit"){
    let current=design;for(let i=0;i<1024;i++){const result=stepMicroCycle(current,engineeringOf(current).cycle+1);current=result.design;const config=engineeringOf(current).construction;if(result.trace.halt||!config?.useMicrocode||result.trace.reason.includes("Instruction boundary"))return result;}return faultTrace(current,cycle,"No instruction boundary within 1024 circuit cycles.");
  }
  if (engineeringOf(design).mode === "multi") {
    let current = design;
    for (let i = 0; i < 64; i++) { const committing=engineeringOf(current).control.find(s=>s.id===engineeringOf(current).state)?.action==="writeback";const result = stepMicroCycle(current, engineeringOf(current).cycle + 1); current = result.design; if (result.trace.halt || committing) return result; }
    return faultTrace(current, cycle, "Execution deadlock: instruction did not finish in 64 cycles.");
  }
  return executeWiredInstruction(design, cycle);
}
function executeWiredInstruction(design: CpuDesign, cycle: number, overrides?: Record<string, 0 | 1 | "instruction">): { design: CpuDesign; trace: ExecTrace } {
  const pc = findKind(design, "pc"); const imem = findKind(design, "imem") ?? findKind(design, "umem"); const rf = findKind(design, "regfile") ?? findKind(design, "acc"); const aluNode = findKind(design, "alu"); const irNode = findKind(design, "ir");
  if (!pc || !imem || !rf || !aluNode || !irNode || !findKind(design, "clock")) return faultTrace(design, cycle, "Missing PC, instruction memory, register architecture, ALU, IR or clock.");
  const errors = validateDesign(design).filter(i => i.level === "error");
  if (errors.length) return faultTrace(design, cycle, errors.slice(0,3).map(e => e.message).join(" "));
  if (combinationalLoops(design).length) return faultTrace(design, cycle, "Combinational loop prevents execution.");
  const fetch = evaluateGraph(design); const address = wiredInput(design, fetch, imem, "addr");
  if(engineeringOf(design).unknown==="strict"){
    const logic=evaluateLogicGraph(design,overrides);
    for(const [node,port] of [[imem,"addr"],[irNode,"d"],[irNode,"we"]] as const){const wire=design.wires.find(w=>w.to===node.id&&w.toPort===port);const bits=wire&&logic.values.get(`${wire.from}:${wire.fromPort}`);if(!bits||bits.some(b=>b==="X"||b==="Z"))return faultTrace(design,cycle,`Unknown or high-impedance value on ${node.name}.${port}.`);}
  }
  if (address === undefined || address < 0 || address >= imem.mem.length) return faultTrace(design, cycle, "Instruction address is undriven or out of bounds.");
  const fetchedWord = wiredInput(design, fetch, irNode, "d"); if (fetchedWord === undefined) return faultTrace(design, cycle, "IR data input has no instruction-memory driver.");
  const irEnable = wiredInput(design, fetch, irNode, "we");
  if (irEnable === undefined) return faultTrace(design,cycle,"IR write-enable is undriven.");
  const word = irEnable ? fetchedWord : irNode.value;
  const decoded = decodeWord(design.isa, word); const instr = decoded.instr;
  if (!instr) return faultTrace(design, cycle, `Unknown opcode at word address ${address}.`);
  for (const n of [pc, irNode, rf]) if (!design.wires.some(w => w.to === n.id && w.toPort === "clk" && design.nodes.find(src => src.id === w.from)?.kind === "clock")) return faultTrace(design, cycle, `${n.name} has no clock source.`);
  let next = patchNode(design, irNode.id, { value: word });
  const c = controlsOf(instr.mnemonic, design.isa);
  if (overrides) for (const key of ["RegWrite", "ALUSrc", "MemRead", "MemWrite", "MemToReg", "Branch"] as const) { const value = overrides[key]; if (value === 0 || value === 1) c[key] = value; }
  let view = evaluateGraph(next, overrides);
  if (engineeringOf(design).unknown === "strict") {
    const logical = evaluateLogicGraph(next,overrides);
    for (const port of ["a","b","op"]) { const source = next.wires.find(w => w.to === aluNode.id && w.toPort === port); const vector = source && logical.values.get(`${source.from}:${source.fromPort}`); if (!vector || vector.some(bit => bit === "X" || bit === "Z")) return faultTrace(design, cycle, `Unknown or high-impedance value on ${aluNode.name}.${port}.`); }
  }
  const a = wiredInput(next, view, aluNode, "a"); const b = wiredInput(next, view, aluNode, "b"); const op = wiredInput(next, view, aluNode, "op");
  if (a === undefined || b === undefined || op === undefined) return faultTrace(design, cycle, "ALU operand or operation input is undriven.");
  if(!ALU_CODE[op])return faultTrace(design,cycle,`Unsupported ALU control code ${op}.`);
  const result = aluNum(a, b, ALU_CODE[op] ?? aluNode.op, aluNode.width);
  if (aluNode.operations && !aluNode.operations.includes(ALU_CODE[op] ?? aluNode.op)) return faultTrace(design, cycle, "Selected ALU does not support this operation.");
  next = patchNode(next, aluNode.id, { value: result.y, op: ALU_CODE[op] ?? aluNode.op }); view = evaluateGraph(next, overrides);
  const mem = findKind(next, "dmem") ?? findKind(next, "umem"); let memOp = "none";
  const en = wiredInput(next, view, rf, "we"); const wd = wiredInput(next, view, rf, "d");
  const logical=engineeringOf(design).unknown==="strict"?evaluateLogicGraph(next,overrides):null;
  const unknown=(node:ArchNode,port:string)=>{const wire=next.wires.find(w=>w.to===node.id&&w.toPort===port);const bits=wire&&logical?.values.get(`${wire.from}:${wire.fromPort}`);return logical&&(!bits||bits.some(b=>b==="X"||b==="Z"));};
  for(const [node,port] of [[pc,"we"],[pc,"d"],[rf,"we"],...(en?[[rf,"d"],...(rf.kind==="regfile"?[[rf,"rd"]]:[])]:[])] as [ArchNode,string][])if(unknown(node,port))return faultTrace(design,cycle,`Unknown or high-impedance value on ${node.name}.${port}.`);
  if (instr.regWrite && (en === undefined || wd === undefined)) return faultTrace(design, cycle, "Register write-enable or writeback data is undriven.");
  if (instr.mem !== "none" && !mem) return faultTrace(design,cycle,"The instruction requires data memory.");
  if (mem) {
    if (!mem) return faultTrace(design, cycle, "The instruction requires data memory.");
    const addr = wiredInput(next, view, mem, "addr"); const write=wiredInput(next,view,mem,"we");const read=wiredInput(next,view,mem,"re");
    if(instr.mem!=="none"&&unknown(mem,instr.mem==="store"?"we":"re"))return faultTrace(design,cycle,"Unknown memory access control.");
    if((write||read)&&(unknown(mem,"addr")||write&&unknown(mem,"d")))return faultTrace(design,cycle,"Unknown memory address or write data.");
    if ((write||read)&&(addr === undefined || addr < 0 || addr >= mem.mem.length)) return faultTrace(design, cycle, "Memory address is undriven or out of bounds.");
    const region = engineeringOf(next).regions.find(r => r.nodeId === mem.id);
    const clocked=next.wires.some(w=>w.to===mem.id&&w.toPort==="clk"&&next.nodes.find(n=>n.id===w.from)?.kind==="clock");
    if (write && clocked && addr!==undefined) { if (region?.permission === "r") return faultTrace(design, cycle, "Write to read-only memory."); const data = wiredInput(next, view, mem, "d"); if (data === undefined) return faultTrace(design, cycle, "Memory write data is undriven."); const contents = mem.mem.slice(); contents[addr] = (data & maskBits(mem.width)) >>> 0; next = patchNode(next, mem.id, { mem: contents, value: addr }); memOp = `store ${data} → [${addr}]`; }
    else if (read&&addr!==undefined) { next = patchNode(next, mem.id, { value: addr }); memOp = `load [${addr}] → ${mem.mem[addr] ?? 0}`; }
  }
  // All additional enabled storage elements capture the same pre-commit datapath snapshot.
  for(const node of next.nodes.filter(n=>["gpr","mar","mdr","sp","dff","counter"].includes(n.kind))){
    if(!next.wires.some(w=>w.to===node.id&&w.toPort==="clk"&&next.nodes.find(n=>n.id===w.from)?.kind==="clock"))continue;
    if(node.kind==="counter"){next=patchNode(next,node.id,{value:((node.value+1)&maskBits(node.width))>>>0});continue;}
    if(node.kind!=="dff"&&!wiredInput(next,view,node,"we"))continue;
    if(unknown(node,"d")||node.kind!=="dff"&&unknown(node,"we"))return faultTrace(design,cycle,`Unknown storage input on ${node.name}.`);
    const data=wiredInput(next,view,node,"d");if(data===undefined)return faultTrace(design,cycle,`${node.name} storage data is undriven.`);
    next=patchNode(next,node.id,{value:(data&maskBits(node.width))>>>0});
  }
  if (en && wd !== undefined) { const index = rf.kind === "acc" ? 0 : wiredInput(next, view, rf, "rd"); if (index === undefined || index < 0 || index >= (rf.kind === "acc" ? 1 : rf.values.length)) return faultTrace(design, cycle, "Register destination is invalid or undriven."); next = patchNode(next, rf.id, writeReg(rf, index, wd, true)); }
  const nextPc = wiredInput(next, view, pc, "d"); if (nextPc === undefined) return faultTrace(design, cycle, "PC update input is undriven.");
  const flags = findKind(next, "flags"); if (flags&&next.wires.some(w=>w.to===flags.id&&w.toPort==="clk"&&next.nodes.find(n=>n.id===w.from)?.kind==="clock")){for(const port of ["z","n","c","v"])if(unknown(flags,port))return faultTrace(design,cycle,`Unknown flag input ${flags.name}.${port}.`);const z=wiredInput(next,view,flags,"z"),n=wiredInput(next,view,flags,"n"),carry=wiredInput(next,view,flags,"c"),v=wiredInput(next,view,flags,"v");if(z!==undefined&&n!==undefined&&carry!==undefined&&v!==undefined)next=patchNode(next,flags.id,{value:z|n<<1|carry<<2|v<<3});}
  const pcEnable = wiredInput(next, view, pc, "we");
  if (pcEnable === undefined) return faultTrace(design,cycle,"PC write-enable is undriven.");
  next = patchNode(next, pc.id, { value: pcEnable ? nextPc : pc.value }); const cu = findKind(next, "cu"); if (cu) next = patchNode(next, cu.id, { value: word, note: instr.mnemonic });
  const config = engineeringOf(next); next = { ...next, engineering: { ...config, cycle } };
  return { design: next, trace: { cycle, pc: address, ir: word, mnemonic: instr.mnemonic, opcode: instr.opcode, aluA: a, aluB: b, aluY: result.y, flags: result, memOp, controls: c, halt: instr.pc === "halt", reason: instr.pc === "halt" ? "HALT" : `${instr.mnemonic} committed through the wired datapath at PC=${address}` } };
}
export function stepMicroCycle(design: CpuDesign, cycle: number): { design: CpuDesign; trace: ExecTrace } {
  const config = engineeringOf(design);
  if(config.construction?.execution==="circuit")return circuitCycle(design,cycle);
  if (config.mode === "single") return executeWiredInstruction(design, cycle);
  const state = config.control.find(s => s.id === config.state);
  if (!state || !state.guard&&!config.control.some(s => s.id === state.next)) return faultTrace(design, cycle, "Control state has an undefined transition.");
  const pc = findKind(design, "pc"); const imem = findKind(design, "imem")??findKind(design,"umem"); const ir = findKind(design, "ir");
  if (!pc || !imem || !ir) return faultTrace(design, cycle, "Fetch hardware is incomplete.");
  let next = design;
  const pendingSignals={...(state.action==="fetch" ? {RegWrite:0 as const,MemRead:0 as const,MemWrite:0 as const} : config.pendingSignals??{}),...state.signals};
  const successor=(current:CpuDesign)=>{if(!state.guard)return state.next;const decoded=decodeWord(current.isa,findKind(current,"ir")?.value??0);const condition=state.guard.kind==="memory" ? !!decoded.instr&&decoded.instr.mem!=="none" : state.guard.kind==="zero" ? findKind(current,"alu")?.value===0 : decoded.instr?.opcode===state.guard.equals;return condition?state.guard.whenTrue:state.guard.whenFalse;};
  if(state.guard && (!config.control.some(s=>s.id===state.guard?.whenTrue)||!config.control.some(s=>s.id===state.guard?.whenFalse)))return faultTrace(design,cycle,"Conditional transition targets an undefined state.");
  if (state.action === "fetch") { const view = evaluateGraph(design); const word = wiredInput(design, view, ir, "d");const address=wiredInput(design,view,imem,"addr");const enable=wiredInput(design,view,ir,"we"); if (word === undefined||enable===undefined||address===undefined||address>=imem.mem.length) return faultTrace(design, cycle, "Instruction fetch wire, enable or address is invalid."); if(enable)next = patchNode(design, ir.id, { value: word }); }
  // Architectural writes happen atomically at writeback. The selected state's signal overrides are honored.
  if (state.action === "writeback") {
    const allSignals = pendingSignals;
    const completed = executeWiredInstruction(next, cycle, allSignals);
    return { ...completed, design: { ...completed.design, engineering: { ...engineeringOf(completed.design), state: successor(completed.design), cycle, pendingSignals:undefined } } };
  }
  const word = findKind(next, "ir")?.value ?? 0; const decoded = decodeWord(next.isa, word); const controls = controlsOf(decoded.instr?.mnemonic ?? "", next.isa); for(const key of ["RegWrite","ALUSrc","MemRead","MemWrite","MemToReg","Branch"] as const){const v=pendingSignals[key];if(v===0||v===1)controls[key]=v;}
  const graph = evaluateGraph(next,pendingSignals); const aNode = findKind(next, "alu"); const a = aNode ? wiredInput(next, graph, aNode, "a") ?? 0 : 0; const b = aNode ? wiredInput(next, graph, aNode, "b") ?? 0 : 0; const arithmetic = aluNum(a, b, controls.ALUOp, next.isa.dataWidth);
  if (aNode && state.action === "execute") next = patchNode(next, aNode.id, { value: arithmetic.y, op: controls.ALUOp });
  next = { ...next, engineering: { ...config, state: successor(next), cycle, pendingSignals } };
  return { design: next, trace: { cycle, pc: pc.value, ir: word, mnemonic: decoded.instr?.mnemonic ?? "FETCH", opcode: decoded.fields.opcode ?? 0, aluA: a, aluB: b, aluY: arithmetic.y, flags: arithmetic, memOp: "none", controls, halt: false, reason: `${state.name}: ${state.action} → ${engineeringOf(next).state}` } };
}

function circuitCycle(design:CpuDesign,cycle:number):{design:CpuDesign;trace:ExecTrace} {
  try {
    const construction=engineeringOf(design).construction!;const flat=flattenCircuit(design);let prepared=flat.design;
    const word=construction.useMicrocode?construction.microcode?.[construction.microPc??0]:undefined;
    if(construction.useMicrocode&&!word)return faultTrace(design,cycle,"Microprogram counter is outside control ROM.");
    const before=evaluateGraph(prepared);const logic=evaluateLogicGraph(prepared);
    const resolve=(reference:string,input:boolean)=>{const cut=reference.lastIndexOf(".");const name=reference.slice(0,cut),port=reference.slice(cut+1);const root=design.nodes.find(n=>n.id===name||n.name===name);const exposed=root?.circuit?.ports.find(p=>p.id===port);const id=root?.circuit?`${root.id}::${port}`:root?.id??name;const n=root?.circuit&&exposed?.dir!==(input?"in":"out")?undefined:prepared.nodes.find(n=>n.id===id)??(!root?prepared.nodes.find(n=>n.name===name):undefined);return {n,port:root?.circuit?(input?"a":"y"):port};};
    const read=(reference:string)=>{const {n,port}=resolve(reference,false);const bits=n&&logic.values.get(`${n.id}:${port}`);if(!n||!bits||bits.some(b=>b==="X"||b==="Z"))throw new Error(`Unknown signal ${reference}.`);return before.values.get(`${n.id}:${port}`)??NaN;};
    const targets=new Set<string>();
    for(const [i,drive] of (word?.drives??[]).entries()){
      const resolved=resolve(drive.target,true);const n=resolved.n;const port=n&&portsOf(n).find(p=>p.id===resolved.port&&p.dir==="in");
      if(!n||!port)throw new Error(`Micro-operation target ${drive.target} must be an input port.`);
      const key=`${n.id}:${port.id}`;if(targets.has(key))throw new Error(`Duplicate micro-operation target ${drive.target}.`);targets.add(key);
      const value=expression(drive.expression,read);const driver:ArchNode={...n,id:`$micro${i}`,kind:"const",circuit:undefined,behavior:undefined,width:port.width as ArchNode["width"],value,mem:[],values:[]};
      prepared={...prepared,nodes:[...prepared.nodes,driver],wires:[...prepared.wires.filter(w=>w.to!==n.id||w.toPort!==port.id),{id:`$drive${i}`,from:driver.id,fromPort:"y",to:n.id,toPort:port.id}]};
    }
    const structural=validateDesign(prepared).filter(issue=>issue.level==="error");
    if(structural.length)throw new Error(structural.slice(0,3).map(i=>i.message).join(" "));
    if(evaluateGraph(prepared).loop)throw new Error("Combinational loop prevents a deterministic circuit clock.");
    const low=stepClock(prepared,0,1);
    const high={...low,nodes:low.nodes.map(n=>n.kind==="clock"?{...n,value:1}:n)};const highLogic=evaluateLogicGraph(high);
    if(engineeringOf(design).unknown==="strict")for(const n of high.nodes){const clk= n.behavior?.clock??"clk";const clockWire=high.wires.find(w=>w.to===n.id&&w.toPort===clk);if(!clockWire)continue;const clockBits=highLogic.values.get(`${clockWire.from}:${clockWire.fromPort}`);if(clockBits?.join("")!=="1")continue;
      const ports=n.behavior?portsOf(n).filter(p=>p.dir==="in").map(p=>p.id):["counter"].includes(n.kind)?["clk"]:n.kind==="dff"?["clk","d"]:n.kind==="flags"?["clk","z","n","c","v"]:["clk","we",...(high.wires.some(w=>w.to===n.id&&w.toPort==="we"&&highLogic.values.get(`${w.from}:${w.fromPort}`)?.join("")!=="0")?["d",...(n.kind==="regfile"?["rd"]:["dmem","umem"].includes(n.kind)?["addr"]:[])]:[])];
      for(const port of ports){const w=high.wires.find(w=>w.to===n.id&&w.toPort===port);const bits=w&&highLogic.values.get(`${w.from}:${w.fromPort}`);if(!bits||bits.some(b=>b==="X"||b==="Z"))throw new Error(`${n.name}.${port}: unknown or disconnected active storage input.`);}
    }
    const captured=stepClock(low,1,0);let next=flat.restore(captured.nodes);
    const nextAddress=word?(word.condition&&readExpression(word.condition,read)?word.alternate??word.next:word.next):construction.microPc??0;
    next={...next,engineering:{...engineeringOf(next),cycle,construction:{...construction,microPc:nextAddress}}};
    const view=evaluateGraph(next);const halted=!!word?.halt||next.nodes.some(n=>n.name.toUpperCase()==="HALT"&&view.values.get(`${n.id}:a`)===1||portsOf(n).some(p=>p.dir==="out"&&p.id==="halted"&&p.width===1&&view.values.get(`${n.id}:${p.id}`)===1));
    return {design:next,trace:{cycle,pc:findKind(next,"pc")?.value??0,ir:findKind(next,"ir")?.value??0,mnemonic:word?.name??"CIRCUIT",opcode:0,aluA:0,aluB:0,aluY:0,flags:{z:0,n:0,c:0,v:0},controls:controlsOf("",next.isa),memOp:"Clocked circuit state",halt:halted,reason:`${word?.commit?"Instruction boundary · ":""}${word?.name??"Circuit"}: all enabled storage captured the same rising-edge snapshot${halted?" · HALT":""}.`}};
  } catch(e){return faultTrace(design,cycle,e instanceof Error?e.message:String(e));}
}
function readExpression(source:string,read:(name:string)=>number){return expression(source,read)!==0;}

export function stepClock(design: CpuDesign, clock: 0 | 1, prev: 0 | 1): CpuDesign {
  if(design.nodes.some(n=>n.circuit)||design.engineering?.construction?.nets?.length){const flat=flattenCircuit(design);return flat.restore(stepClock(flat.design,clock,prev).nodes);}
  let next={...design,nodes:design.nodes.map(n=>n.kind==="clock"?{...n,value:clock}:n)};
  const view=evaluateGraph(next);
  const logical=engineeringOf(next).unknown==="strict"?evaluateLogicGraph(next):null;
  const prior=evaluateGraph({...design,nodes:design.nodes.map(n=>n.kind==="clock"?{...n,value:prev}:n)});
  for(const node of design.nodes){
    const din=(port:string)=>wiredInput(next,view,node,port);
    if(node.behavior){const b=node.behavior;const read=(key:string)=>key in (b.registers??{})?b.registers![key]!:key==="value"?node.value:din(key)??NaN;const cw=b.clock&&next.wires.find(w=>w.to===node.id&&w.toPort===b.clock);if(!cw||prior.values.get(`${cw.from}:${cw.fromPort}`)!==0||view.values.get(`${cw.from}:${cw.fromPort}`)!==1)continue;
      const registers={...b.registers};for(const [key,formula] of Object.entries(b.next??{}))registers[key]=b.reset&&din(b.reset)?b.initial?.[key]??0:expression(formula,read,node.mem);
      let mem=node.mem;let text=b.text??"";if(b.write&&expression(b.write.enable,read,node.mem)){const addr=expression(b.write.address,read,node.mem),data=expression(b.write.data,read,node.mem);if(b.device==="terminal")text+=String.fromCharCode(data&255);else {if(addr>=mem.length)throw new Error(`${node.name}: write address ${addr} exceeds memory capacity.`);mem=mem.slice();mem[addr]=data;}}
      next=patchNode(next,node.id,{behavior:{...b,registers,text},mem});continue;
    }
    const clockWire=next.wires.find(w=>w.to===node.id&&w.toPort==="clk"); if(!clockWire||prior.values.get(`${clockWire.from}:${clockWire.fromPort}`)!==0||view.values.get(`${clockWire.from}:${clockWire.fromPort}`)!==1)continue;
    const required=["clk",...(node.kind==="counter"?[]:node.kind==="flags"?["z","n","c","v"]:node.kind==="dff"?["d"]:["we",...(din("we")?["d",...(node.kind==="regfile"?["rd"]:["dmem","umem"].includes(node.kind)?["addr"]:[])]:[])])];
    if(logical&&required.some(port=>{const wire=next.wires.find(w=>w.to===node.id&&w.toPort===port);const bits=wire&&logical.values.get(`${wire.from}:${wire.fromPort}`);return !bits||bits.some(b=>b==="X"||b==="Z");}))continue;
    if(node.kind==="dff"&&din("d")!==undefined)next=patchNode(next,node.id,{value:din("d")!&1});
    if(node.kind==="counter")next=patchNode(next,node.id,{value:((node.value+1)&maskBits(node.width))>>>0});
    if(["gpr","mdr","mar","sp","pc","ir","acc"].includes(node.kind)&&din("we")&&din("d")!==undefined)next=patchNode(next,node.id,{value:(din("d")!&maskBits(node.width))>>>0});
    if(node.kind==="regfile"&&din("we")){const index=din("rd");const data=din("d");if(index!==undefined&&data!==undefined)next=patchNode(next,node.id,writeReg(node,index,data,true));}
    if(node.kind==="flags"&&["z","n","c","v"].every(port=>din(port)!==undefined))next=patchNode(next,node.id,{value:din("z")!|din("n")!<<1|din("c")!<<2|din("v")!<<3});
    if(["dmem","umem"].includes(node.kind)&&din("we")&&engineeringOf(next).regions.find(r=>r.nodeId===node.id)?.permission!=="r"){const address=din("addr");const data=din("d");if(address!==undefined&&data!==undefined&&address>=0&&address<node.mem.length){const mem=node.mem.slice();mem[address]=(data&maskBits(node.width))>>>0;next=patchNode(next,node.id,{mem});}}
  }
  return next;
}

export function hitBreakpoint(design: CpuDesign, trace: ExecTrace, prev: CpuDesign): string | null {
  for (const point of design.breakpoints) {
    if (!point.enabled) continue;
    if (point.kind === "pc" && trace.pc === (point.address ?? 0)) return `PC equals ${trace.pc}.`;
    if (point.kind === "mnemonic" && trace.mnemonic === (point.mnemonic ?? "").toUpperCase()) return `Instruction ${trace.mnemonic} reached.`;
    if(point.kind==="flag" && point.flag){const bit={z:0,n:1,c:2,v:3}[point.flag];if(trace.flags[point.flag]!==(((findKind(prev,"flags")?.value??0)>>>bit)&1))return `${point.flag.toUpperCase()} flag changed.`;}
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
  for(const [key,value] of view.values) values[key]=value;
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
  const logic=Object.fromEntries([...evaluateLogicGraph(design).values].map(([key,bits])=>[key,bits.join("")]));
  return { cycle, clock, values, logic };
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

export function designJson(design: CpuDesign): string { return canonicalJson(design); }
export function parseDesignJson(raw: string): { ok: true; design: CpuDesign } | { ok: false; error: string } {
  try { return { ok: true, design: migrateProject(JSON.parse(raw)) }; }
  catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Invalid project JSON." }; }
}
