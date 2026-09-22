import { decode, encodeB, encodeI, encodeJ, encodeR, encodeS, fitSigned, OP, type Decoded } from "./spec";

export interface AsmLine {
  line: number;
  address: number;
  text: string;
  word: number;
  decoded: Decoded;
}

export interface AsmError {
  line: number;
  message: string;
}

export type AsmResult =
  | { ok: true; words: number[]; listing: AsmLine[]; labels: Record<string, number> }
  | { ok: false; errors: AsmError[] };

function strip(text: string): string {
  const cut = text.split(/[;#]/)[0] ?? "";
  return cut.trim();
}

function reg(token: string, line: number, errors: AsmError[]): number | null {
  const match = token.trim().toUpperCase().match(/^R([0-7])$/);
  if (!match) {
    errors.push({ line, message: `Invalid register "${token}". Use R0 through R7.` });
    return null;
  }
  return Number(match[1]);
}

function numberToken(token: string, line: number, errors: AsmError[]): number | null {
  const text = token.trim().toLowerCase();
  const value = text.startsWith("0x") ? Number.parseInt(text.slice(2), 16) : Number.parseInt(text, 10);
  if (!Number.isFinite(value)) {
    errors.push({ line, message: `Malformed immediate "${token}".` });
    return null;
  }
  return value;
}

function memOperand(token: string, line: number, errors: AsmError[]): { imm: number; base: number } | null {
  const match = token.trim().match(/^(-?(?:0x)?[0-9a-fA-F]+)\(\s*(R[0-7])\s*\)$/i);
  if (!match) {
    errors.push({ line, message: `Malformed memory operand "${token}". Use offset(Rn).` });
    return null;
  }
  const imm = numberToken(match[1] ?? "", line, errors);
  const base = reg(match[2] ?? "", line, errors);
  if (imm === null || base === null) return null;
  if (fitSigned(imm, 6) === null) {
    errors.push({ line, message: `Immediate ${imm} is outside the signed 6-bit range -32..31.` });
    return null;
  }
  return { imm, base };
}

export function assemble(source: string): AsmResult {
  const errors: AsmError[] = [];
  const raw = source.split(/\r?\n/);
  const labels: Record<string, number> = {};
  const pending: Array<{ line: number; text: string }> = [];
  let address = 0;
  raw.forEach((original, index) => {
    const line = index + 1;
    let text = strip(original);
    if (!text) return;
    const labeled = text.match(/^([A-Za-z_]\w*):(?:\s*(.*))?$/);
    if (labeled) {
      const name = (labeled[1] ?? "").toUpperCase();
      if (labels[name] !== undefined) errors.push({ line, message: `Duplicate label ${name}.` });
      else labels[name] = address;
      text = (labeled[2] ?? "").trim();
      if (!text) return;
    }
    pending.push({ line, text });
    address += 1;
  });
  const words: number[] = [];
  const listing: AsmLine[] = [];
  pending.forEach((item, addressIndex) => {
    const parts = item.text.split(/[\s,]+/).filter(Boolean);
    const mnemonic = (parts[0] ?? "").toUpperCase();
    const args = parts.slice(1);
    const word = encodeMnemonic(mnemonic, args, addressIndex, item.line, labels, errors);
    if (word === null) return;
    words[addressIndex] = word;
    listing.push({ line: item.line, address: addressIndex, text: item.text, word, decoded: decode(word) });
  });
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, words, listing, labels };
}

function encodeMnemonic(mnemonic: string, args: string[], address: number, line: number, labels: Record<string, number>, errors: AsmError[]): number | null {
  const need = (count: number) => {
    if (args.length !== count) {
      errors.push({ line, message: `${mnemonic} expects ${count} operand${count === 1 ? "" : "s"}.` });
      return false;
    }
    return true;
  };
  if (mnemonic === "NOP") return need(0) ? 0 : null;
  if (mnemonic === "HALT") return need(0) ? encodeJ(OP.HALT, 0) & 0xf000 : null;
  if (mnemonic === "RET") return need(0) ? OP.RET << 12 : null;
  if (["ADD", "SUB", "AND", "OR", "XOR", "SLL", "SRL", "SRA", "SLT"].includes(mnemonic)) {
    if (!need(3)) return null;
    const rd = reg(args[0] ?? "", line, errors);
    const rs1 = reg(args[1] ?? "", line, errors);
    const rs2 = reg(args[2] ?? "", line, errors);
    if (rd === null || rs1 === null || rs2 === null) return null;
    return mnemonic === "SLT" ? encodeR("SLT", rd, rs1, rs2) : encodeR(mnemonic, rd, rs1, rs2);
  }
  if (mnemonic === "ADDI") {
    if (!need(3)) return null;
    const rd = reg(args[0] ?? "", line, errors);
    const rs1 = reg(args[1] ?? "", line, errors);
    const imm = numberToken(args[2] ?? "", line, errors);
    if (rd === null || rs1 === null || imm === null) return null;
    if (fitSigned(imm, 6) === null) {
      errors.push({ line, message: `Immediate ${imm} is outside the signed 6-bit range -32..31.` });
      return null;
    }
    return encodeI(OP.ADDI, rd, rs1, imm);
  }
  if (mnemonic === "LOAD") {
    if (!need(2)) return null;
    const rd = reg(args[0] ?? "", line, errors);
    const mem = memOperand(args[1] ?? "", line, errors);
    if (rd === null || !mem) return null;
    return encodeI(OP.LOAD, rd, mem.base, mem.imm);
  }
  if (mnemonic === "STORE") {
    if (!need(2)) return null;
    const rs2 = reg(args[0] ?? "", line, errors);
    const mem = memOperand(args[1] ?? "", line, errors);
    if (rs2 === null || !mem) return null;
    return encodeS(rs2, mem.base, mem.imm);
  }
  if (mnemonic === "BEQ" || mnemonic === "BNE" || mnemonic === "J" || mnemonic === "CALL") {
    const opcode = mnemonic === "BEQ" ? OP.BEQ : mnemonic === "BNE" ? OP.BNE : mnemonic === "J" ? OP.J : OP.CALL;
    if (mnemonic === "J" || mnemonic === "CALL") {
      if (!need(1)) return null;
      const target = resolveTarget(args[0] ?? "", line, labels, errors);
      if (target === null) return null;
      const offset = target - address;
      if (fitSigned(offset, 12) === null) {
        errors.push({ line, message: `Jump offset ${offset} does not fit in 12 bits.` });
        return null;
      }
      return encodeJ(opcode, offset);
    }
    if (!need(3)) return null;
    const rs1 = reg(args[0] ?? "", line, errors);
    const rs2 = reg(args[1] ?? "", line, errors);
    const target = resolveTarget(args[2] ?? "", line, labels, errors);
    if (rs1 === null || rs2 === null || target === null) return null;
    const offset = target - address;
    if (fitSigned(offset, 6) === null) {
      errors.push({ line, message: `Branch offset ${offset} does not fit in 6 bits.` });
      return null;
    }
    return encodeB(opcode, rs1, rs2, offset);
  }
  errors.push({ line, message: `Unknown mnemonic ${mnemonic}.` });
  return null;
}

function resolveTarget(token: string, line: number, labels: Record<string, number>, errors: AsmError[]): number | null {
  if (/^-?\d+$/.test(token) || /^0x[0-9a-f]+$/i.test(token)) return numberToken(token, line, errors);
  const label = token.toUpperCase();
  const found = labels[label];
  if (found === undefined) {
    errors.push({ line, message: `Undefined label ${token}.` });
    return null;
  }
  return found;
}

export function formatInstruction(decoded: Decoded): string {
  const r = (index: number) => `R${index}`;
  switch (decoded.mnemonic) {
    case "NOP":
    case "HALT":
    case "RET":
      return decoded.mnemonic;
    case "ADDI":
      return `ADDI ${r(decoded.rd)}, ${r(decoded.rs1)}, ${decoded.imm}`;
    case "LOAD":
      return `LOAD ${r(decoded.rd)}, ${decoded.imm}(${r(decoded.rs1)})`;
    case "STORE":
      return `STORE ${r(decoded.rs2)}, ${decoded.imm}(${r(decoded.rs1)})`;
    case "BEQ":
    case "BNE":
      return `${decoded.mnemonic} ${r(decoded.rs1)}, ${r(decoded.rs2)}, ${decoded.imm}`;
    case "J":
    case "CALL":
      return `${decoded.mnemonic} ${decoded.imm}`;
    default:
      return `${decoded.mnemonic} ${r(decoded.rd)}, ${r(decoded.rs1)}, ${r(decoded.rs2)}`;
  }
}
