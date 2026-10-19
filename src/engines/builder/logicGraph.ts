import type { LogicBit, LogicVector } from "../../types/logic";
import { fromUnsigned, toUnsigned } from "../digital/vector";
import { portsOf, type CpuDesign, type ArchNode } from "./model";
import { evaluateGraph, aluNum } from "./sim";
import { behaviorValues, flattenCircuit } from "./construction";
export interface LogicGraph { values: Map<string, LogicVector>; diagnostics: string[]; events: number; }
const vec = (bit: LogicBit, width: number): LogicVector => Array.from({ length: width }, () => bit);
const known = (v: LogicVector) => toUnsigned(v);
function gate(a: LogicBit, b: LogicBit, op: string): LogicBit {
  if (op === "and") return a === 0 || b === 0 ? 0 : a === 1 && b === 1 ? 1 : "X";
  if (op === "or") return a === 1 || b === 1 ? 1 : a === 0 && b === 0 ? 0 : "X";
  return typeof a === "number" && typeof b === "number" ? (a ^ b) as 0 | 1 : "X";
}
export function evaluateLogicGraph(design: CpuDesign, overrides?:Record<string,0|1|"instruction">): LogicGraph {
  if(design.nodes.some(n=>n.circuit)||design.engineering?.construction?.nets?.length){const flat=flattenCircuit(design);const view=evaluateLogicGraph(flat.design,overrides);for(const [key,value] of flat.aliases)view.values.set(key,view.values.get(value)??[]);return view;}
  const values = new Map<string, LogicVector>(); const diagnostics: string[] = []; const numeric = evaluateGraph(design,overrides);
  const output = (n: ArchNode, port: string, v: LogicVector) => { values.set(`${n.id}:${port}`, v); };
  const input = (n: ArchNode, port: string): LogicVector => {
    const def = portsOf(n).find(p => p.id === port); const wires = design.wires.filter(w => w.to === n.id && w.toPort === port);
    if (!wires.length) return vec("Z", def?.width ?? n.width);
    const drivers = wires.map(w => values.get(`${w.from}:${w.fromPort}`) ?? vec("X", def?.width ?? n.width));
    return vec("Z", def?.width ?? n.width).map((_, index) => { const bits = drivers.map(d => d[index] ?? "X").filter(b => b !== "Z"); return !bits.length ? "Z" : bits.every(b => b === bits[0]) ? bits[0]! : "X"; });
  };
  const sequential = new Set(["pc", "ir", "gpr", "acc", "mar", "mdr", "sp", "dff", "counter", "flags"]);
  for (const n of design.nodes) for (const p of portsOf(n).filter(p => p.dir === "out")) output(n, p.id, fromUnsigned((n.kind === "flags" ? (n.value>>>({qz:0,qn:1,qc:2,qv:3}[p.id as "qz"|"qn"|"qc"|"qv"]??0))&1 : n.kind === "const" || n.kind === "clock" || sequential.has(n.kind) ? n.value : 0) >>> 0, p.width));
  const queue = [...design.nodes]; const queued = new Set(queue.map(n => n.id)); let events = 0; const limit = Math.max(128, design.nodes.length * (design.wires.length + 1) * 4);
  while (queue.length && events++ < limit) {
    const n = queue.shift()!; queued.delete(n.id); if (sequential.has(n.kind) || n.kind === "const" || n.kind === "clock") continue;
    const before = portsOf(n).filter(p => p.dir === "out").map(p => (values.get(`${n.id}:${p.id}`) ?? []).join("")).join("|");
    const a = input(n, "a"); const b = input(n, "b"); const an = known(a); const bn = known(b); const writeNumber = (port: string, v: number | null) => { const width = portsOf(n).find(p => p.id === port)?.width ?? n.width; output(n, port, v === null ? vec("X", width) : fromUnsigned(v >>> 0, width)); };
    if(n.behavior){try{const outputs=behaviorValues(n,port=>known(input(n,port))??NaN);for(const [port,value] of Object.entries(outputs))writeNumber(port,value);}catch{for(const p of portsOf(n).filter(p=>p.dir==="out"))output(n,p.id,vec("X",p.width));}}
    else if (n.kind === "bus") { const en = known(input(n, "en")); output(n, "y", en === 0 ? vec("Z", n.width) : en === 1 ? a : vec("X", n.width)); }
    else if (n.kind === "mux") { const select = known(input(n, "s")); output(n, "y", select === 0 ? input(n, "i0") : select === 1 ? input(n, "i1") : vec("X", n.width)); }
    else if (["and", "or", "xor", "nand"].includes(n.kind)) { const bit = gate(a[0] ?? "X", b[0] ?? "X", n.kind === "nand" ? "and" : n.kind); output(n, "y", [n.kind === "nand" ? bit === 0 ? 1 : bit === 1 ? 0 : "X" : bit]); }
    else if (n.kind === "not") output(n, "y", [a[0] === 0 ? 1 : a[0] === 1 ? 0 : "X"]);
    else if (n.kind === "alu") { const op = known(input(n, "op")); const ops = ["ADD", "SUB", "AND", "OR", "XOR", "NOT", "SHL", "SHR", "CMP", "INC", "DEC"] as const; const result = an === null || bn === null || op === null || !ops[op] ? null : aluNum(an, bn, ops[op]!, n.width); writeNumber("y", result?.y ?? null); writeNumber("z", result?.z ?? null);writeNumber("n",result?.n??null);writeNumber("c",result?.c??null);writeNumber("v",result?.v??null); }
    else if (n.kind === "inc") writeNumber("y", an === null ? null : an + 1);
    else if (n.kind === "shifter") writeNumber("y", an === null ? null : an << 1);
    else if (n.kind === "cmp") writeNumber("eq", an === null || bn === null ? null : an === bn ? 1 : 0);
    else if (n.kind === "buf") output(n, "y", a);
    else if (n.kind === "sext") output(n, "y", [...vec(a[0] === "Z" ? "X" : a[0] ?? "X", Math.max(0, n.width - a.length)), ...a]);
    else if (n.kind === "split") { const half = Math.floor(n.width / 2); output(n, "hi", a.slice(0, half)); output(n, "lo", a.slice(half)); }
    else if (n.kind === "join") output(n, "y", [...input(n, "hi"), ...input(n, "lo")]);
    else if (["imem", "dmem", "umem"].includes(n.kind)) { const address = known(input(n, "addr"));const read=known(input(n,"re"));writeNumber("q", n.kind==="dmem"&&read===0 ? 0 : n.kind==="dmem"&&read===null || address === null || address >= n.mem.length ? null : n.mem[address] ?? 0); }
    else if (n.kind === "regfile") { const ra = known(input(n, "ra")); const rb = known(input(n, "rb")); writeNumber("a", ra === null ? null : n.values[ra] ?? null); writeNumber("b", rb === null ? null : n.values[rb] ?? null); }
    else if (n.kind === "cu" || n.kind === "decoder") { const instruction = known(input(n, "ir")); for (const p of portsOf(n).filter(p => p.dir === "out")) writeNumber(p.id, p.id==="one"?1:instruction === null || p.id==="pcnext"&&(known(input(n,"pc"))===null||known(input(n,"zero"))===null) ? null : numeric.values.get(`${n.id}:${p.id}`) ?? 0); }
    else if (["probe", "led", "hex", "num", "bin"].includes(n.kind)) output(n, "a", a);
    const after = portsOf(n).filter(p => p.dir === "out").map(p => (values.get(`${n.id}:${p.id}`) ?? []).join("")).join("|");
    if (before !== after) for (const w of design.wires.filter(w => w.from === n.id)) { const dst = design.nodes.find(node => node.id === w.to); if (dst && !queued.has(dst.id)) { queued.add(dst.id); queue.push(dst); } }
  }
  if (queue.length) diagnostics.push("Event scheduler did not settle: investigate a combinational loop.");
  for (const w of design.wires) if (values.get(`${w.from}:${w.fromPort}`)?.some(b => b === "X" || b === "Z")) diagnostics.push(`${w.id}: unknown or high-impedance signal.`);
  return { values, diagnostics, events };
}
