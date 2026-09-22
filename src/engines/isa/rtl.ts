import { operate } from "./spec";
import { decode, OP } from "./spec";

export interface RtlOp {
  dest: number;
  op: string;
  left: number;
  right: number | null;
  text: string;
}

export function parseRtl(line: string): RtlOp | { error: string } {
  const text = line.trim().toUpperCase().replace(/←/g, "<-");
  const match = text.match(/^R([0-7])\s*<-\s*R([0-7])(?:\s*([+\-&|^])\s*R([0-7]))?$/);
  if (!match) return { error: "Use R1 <- R2 or R3 <- R1 + R4. Supported operators are + - & | ^." };
  const op = match[3] ?? "MOVE";
  const mapped = op === "+" ? "ADD" : op === "-" ? "SUB" : op === "&" ? "AND" : op === "|" ? "OR" : op === "^" ? "XOR" : "MOVE";
  return {
    dest: Number(match[1]),
    op: mapped,
    left: Number(match[2]),
    right: match[4] === undefined ? null : Number(match[4]),
    text,
  };
}

export function evalRtl(regs: number[], line: string): { regs: number[]; explain: string; error?: string } {
  const parsed = parseRtl(line);
  if ("error" in parsed) return { regs, explain: parsed.error, error: parsed.error };
  const left = regs[parsed.left] ?? 0;
  const right = parsed.right === null ? 0 : (regs[parsed.right] ?? 0);
  const value = parsed.op === "MOVE" ? left : operate(parsed.op, left, right).result;
  const next = regs.slice();
  next[parsed.dest] = value & 0xffff;
  const explain = parsed.op === "MOVE"
    ? `R${parsed.dest} receives the value in R${parsed.left}.`
    : `R${parsed.left} and R${parsed.right} enter the ALU. The result is written to R${parsed.dest}.`;
  return { regs: next, explain };
}

export interface MicroWord {
  addr: number;
  name: string;
  signals: string;
  next: number | "dispatch";
  horizontal: string;
  vertical: string;
}

export const MICROPROGRAM: MicroWord[] = [
  { addr: 0, name: "FETCH_MAR", signals: "MAR ← PC", next: 1, horizontal: "1 0 0 0 0 0 0 1", vertical: "FETCH" },
  { addr: 1, name: "FETCH_READ", signals: "MDR ← Mem[MAR]", next: 2, horizontal: "0 1 0 0 0 0 0 1", vertical: "FETCH" },
  { addr: 2, name: "FETCH_IR", signals: "IR ← MDR", next: 3, horizontal: "0 0 1 0 0 0 0 1", vertical: "FETCH" },
  { addr: 3, name: "FETCH_PC", signals: "PC ← PC + 1", next: "dispatch", horizontal: "0 0 0 1 0 0 0 1", vertical: "FETCH" },
  { addr: 4, name: "ADD_EXEC", signals: "ALU ← Rs1 + Rs2", next: 5, horizontal: "0 0 0 0 1 0 0 1", vertical: "ALU-ADD" },
  { addr: 5, name: "ADD_WB", signals: "Rd ← ALU", next: 0, horizontal: "0 0 0 0 0 1 0 0", vertical: "REGWRITE" },
  { addr: 6, name: "LOAD_ADDR", signals: "ALU ← Rs1 + imm", next: 7, horizontal: "0 0 0 0 1 0 0 1", vertical: "ALU-ADD" },
  { addr: 7, name: "LOAD_READ", signals: "MDR ← Mem[ALU]", next: 8, horizontal: "0 1 0 0 0 0 0 1", vertical: "MEMREAD" },
  { addr: 8, name: "LOAD_WB", signals: "Rd ← MDR", next: 0, horizontal: "0 0 0 0 0 1 1 0", vertical: "REGWRITE" },
];

export function dispatchMicro(opcode: number): number {
  if (opcode === OP.LOAD) return 6;
  if (opcode === OP.ALU) return 4;
  return 0;
}

export function stepMicro(addr: number, opcode: number): number {
  const word = MICROPROGRAM.find((item) => item.addr === addr) ?? MICROPROGRAM[0];
  if (!word) return 0;
  if (word.next === "dispatch") return dispatchMicro(opcode);
  return word.next;
}

export function hardwired(mnemonic: string): Record<string, string> {
  const decoded = decode(mnemonic === "LOAD" ? OP.LOAD << 12 : mnemonic === "STORE" ? OP.STORE << 12 : mnemonic === "ADDI" ? OP.ADDI << 12 : mnemonic === "BEQ" ? OP.BEQ << 12 : 1 << 12);
  const real = mnemonic === "ADD" || mnemonic === "SUB" ? { ...decoded, mnemonic, regWrite: true, memRead: false, memWrite: false, aluSrc: "reg" as const, aluOp: mnemonic } : decoded;
  return {
    RegWrite: real.regWrite ? "1" : "0",
    MemRead: real.memRead ? "1" : "0",
    MemWrite: real.memWrite ? "1" : "0",
    ALUSrc: real.aluSrc,
    ALUOp: real.aluOp,
  };
}
