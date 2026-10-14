import { fieldsOf, type IsaField, type IsaInstruction, type IsaSpec } from "./model";

export interface FormatIssue { level: "error" | "warning"; message: string; field?: string }
export interface AsmLine { line: number; text: string; word: number; mnemonic: string; fields: Record<string, number>; address: number }
export interface AsmError { line: number; message: string }
export type AssembleResult =
  | { ok: true; words: number[]; listing: AsmLine[]; symbols: Record<string, number> }
  | { ok: false; errors: AsmError[] };

export function fieldMask(width: number): number {
  if (width >= 32) return 0xffffffff;
  return width <= 0 ? 0 : (1 << width) - 1;
}

export function readField(word: number, field: IsaField): number {
  return (word >>> field.lo) & fieldMask(field.width);
}

export function writeField(word: number, field: IsaField, value: number): number {
  const mask = fieldMask(field.width) << field.lo;
  return (word & ~mask) | ((value & fieldMask(field.width)) << field.lo);
}

export function validateFields(fields: IsaField[], instrWidth: number): FormatIssue[] {
  const issues: FormatIssue[] = [];
  const names = new Map<string, number>();
  const covered = Array.from({ length: instrWidth }, () => false);
  for (const field of fields) {
    if (!Number.isInteger(field.lo) || !Number.isInteger(field.width) || field.width <= 0) issues.push({ level: "error", message: `Field ${field.name} has impossible width ${field.width}.`, field: field.name });
    if (field.lo < 0 || field.lo + field.width > instrWidth) {
      issues.push({ level: "error", message: `Field ${field.name} (${field.lo}+${field.width}) does not fit in a ${instrWidth}-bit word.`, field: field.name });
    }
    const seen = names.get(field.name);
    if (seen !== undefined && field.valueOffset === undefined) issues.push({ level: "error", message: `Duplicate field name ${field.name}.`, field: field.name });
    names.set(field.name, (seen ?? 0) + 1);
    for (let bit = field.lo; bit < field.lo + field.width && bit < instrWidth; bit += 1) {
      if (covered[bit]) issues.push({ level: "error", message: `Overlapping fields share bit ${bit} (${field.name}).`, field: field.name });
      covered[bit] = true;
    }
  }
  const holes = covered.map((bit, index) => (bit ? -1 : index)).filter((index) => index >= 0);
  if (holes.length) issues.push({ level: "warning", message: `Uncovered bits: ${holes.join(", ")}.` });
  return issues;
}

export function validateIsa(isa: IsaSpec): FormatIssue[] {
  const issues = [
    ...validateFields(isa.fieldsR, isa.instrWidth),
    ...validateFields(isa.fieldsI, isa.instrWidth),
    ...validateFields(isa.fieldsJ, isa.instrWidth),
    ...validateFields(isa.fieldsB, isa.instrWidth),
  ];
  const opcodeField = isa.fieldsR.find((field) => field.purpose === "opcode") ?? isa.fieldsI.find((field) => field.purpose === "opcode");
  const opcodeBits = opcodeField?.width ?? 4;
  const maxOp = fieldMask(opcodeBits);
  const used = new Map<number, string>();
  const names = new Set<string>();
  if(![1,4,8,16,32].includes(isa.dataWidth)||!Number.isInteger(isa.regs)||isa.regs<1||isa.regs>8)issues.push({level:"error",message:"ISA requires a supported data width and 1–8 registers."});
  for (const instr of isa.instructions) {
    if(!["ADD","SUB","AND","OR","XOR","NOT","SHL","SHR","CMP","INC","DEC"].includes(instr.aluOp)||typeof instr.regWrite!=="boolean"||typeof instr.memToReg!=="boolean"||!['inc','branchEq','branchNe','jump','halt'].includes(instr.pc)||!['none','load','store'].includes(instr.mem)||!['reg','imm'].includes(instr.aluSrc))issues.push({level:"error",message:`${instr.mnemonic}: unsupported or invalid declarative semantics.`});
    const key = instr.mnemonic.toUpperCase();
    if (names.has(key)) issues.push({ level: "error", message: `Duplicate mnemonic ${instr.mnemonic}.` });
    names.add(key);
    if (!Number.isInteger(instr.opcode) || instr.opcode < 0 || instr.opcode > maxOp) issues.push({ level: "error", message: `Opcode ${instr.opcode} for ${instr.mnemonic} is too wide for a ${opcodeBits}-bit opcode field.` });
    const owner = used.get(instr.opcode);
    if (owner) issues.push({ level: "error", message: `Opcode conflict: ${owner} and ${instr.mnemonic} both use ${instr.opcode.toString(2).padStart(opcodeBits, "0")}.` });
    used.set(instr.opcode, instr.mnemonic);
    const layout = fieldsOf(isa, instr.format);
    for (const operand of instr.operands) if (!layout.some(f => f.purpose === operand)) issues.push({ level: "error", message: `${instr.mnemonic}: format is missing ${operand}.` });
    if (!layout.some(f => f.purpose === "opcode")) issues.push({ level: "error", message: `${instr.mnemonic}: format has no opcode.` });
    if(layout.filter(f=>f.purpose==="opcode").length!==1)issues.push({level:"error",message:`${instr.mnemonic}: use exactly one contiguous opcode field.`});
    if (instr.memToReg && instr.mem !== "load") issues.push({ level: "error", message: `${instr.mnemonic}: memory writeback requires a load operation.` });
    const rd = fieldsOf(isa, instr.format).find((field) => field.purpose === "rd");
    if (rd && isa.regs > fieldMask(rd.width) + 1) {
      issues.push({ level: "error", message: `Register field ${rd.name} is too small for ${isa.regs} registers.` });
    }
  }
  for(let a=0;a<isa.instructions.length;a++)for(let b=a+1;b<isa.instructions.length;b++){const left=isa.instructions[a]!,right=isa.instructions[b]!;const lf=fieldsOf(isa,left.format).find(f=>f.purpose==="opcode"),rf=fieldsOf(isa,right.format).find(f=>f.purpose==="opcode");if(!lf||!rf)continue;const common=(fieldMask(lf.width)<<lf.lo)&(fieldMask(rf.width)<<rf.lo);if(((left.opcode<<lf.lo)&common)===((right.opcode<<rf.lo)&common)&&left.opcode!==right.opcode)issues.push({level:"error",message:`Ambiguous decode: ${left.mnemonic} and ${right.mnemonic} can match the same word because their opcode fields differ.`});}
  return issues;
}

export function controlTable(isa: IsaSpec): Array<{ mnemonic: string; RegWrite: 0 | 1; ALUSrc: 0 | 1; MemRead: 0 | 1; MemWrite: 0 | 1; MemToReg: 0 | 1; Branch: 0 | 1; ALUOp: string }> {
  return isa.instructions.map((instr) => ({
    mnemonic: instr.mnemonic,
    RegWrite: instr.regWrite ? 1 : 0,
    ALUSrc: instr.aluSrc === "imm" ? 1 : 0,
    MemRead: instr.mem === "load" ? 1 : 0,
    MemWrite: instr.mem === "store" ? 1 : 0,
    MemToReg: instr.memToReg ? 1 : 0,
    Branch: instr.pc.startsWith("branch") || instr.pc === "jump" ? 1 : 0,
    ALUOp: instr.aluOp,
  }));
}

export function decodeWord(isa: IsaSpec, word: number): { instr: IsaInstruction | null; fields: Record<string, number> } {
  const instr = isa.instructions.find(i => { const op = fieldsOf(isa, i.format).find(f => f.purpose === "opcode"); return op && readField(word, op) === i.opcode; }) ?? null;
  const fields: Record<string, number> = {};
  if (instr) for (const field of fieldsOf(isa, instr.format)) {
    const value = readField(word, field);
    fields[field.purpose] = ((fields[field.purpose] ?? 0) | (value << (field.valueOffset ?? 0))) >>> 0;
  }
  return { instr, fields };
}
export function immediateWidth(isa: IsaSpec, instr: IsaInstruction): number {
  return Math.max(0, ...fieldsOf(isa, instr.format).filter(f => f.purpose === "imm").map(f => f.width + (f.valueOffset ?? 0)));
}
export function signedImmediate(value: number, width: number): number { return width === 32 ? value | 0 : value >= 2 ** (width - 1) ? value - 2 ** width : value; }
export function disassemble(isa: IsaSpec, word: number): string {
  const { instr, fields } = decodeWord(isa, word);
  if (!instr) return `.word 0x${(word >>> 0).toString(16)}`;
  const args = instr.operands.map(o => o === "imm" ? String(instr.pc.startsWith("branch") || fieldsOf(isa, instr.format).some(f => f.purpose === "imm" && f.signed) ? signedImmediate(fields[o] ?? 0, immediateWidth(isa, instr)) : fields[o] ?? 0) : `R${fields[o] ?? 0}`);
  return `${instr.mnemonic}${args.length ? " " + args.join(", ") : ""}`;
}

function parseReg(token: string, regs: number): number | null {
  const clean = token.trim().toUpperCase().replace(/^\$/, "");
  if (clean === "ACC" || clean === "A") return 0;
  const match = /^R?X?(\d+)$/.exec(clean);
  if (!match) return null;
  const index = Number(match[1]);
  if (index < 0 || index >= regs) return null;
  return index;
}

export function assemble(isa: IsaSpec, source: string): AssembleResult {
  const errors: AsmError[] = [];
  const schema = validateIsa(isa).filter(i => i.level === "error");
  if (schema.length) return { ok: false, errors: schema.map(i => ({ line: 0, message: i.message })) };
  const labels = new Map<string, number>();
  const rows: { line: number; address: number; mnemonic: string; args: string[]; text: string }[] = [];
  let address = 0;
  source.split(/\r?\n/).forEach((text, index) => {
    let rest = text.replace(/;.*$/, "").trim(); if (!rest) return;
    const labeled = /^([A-Za-z_]\w*):\s*(.*)$/.exec(rest);
    if (labeled) { const name = labeled[1]!.toUpperCase(); if (labels.has(name)) errors.push({ line: index + 1, message: `Duplicate label ${name}.` }); labels.set(name, address); rest = labeled[2]!.trim(); if (!rest) return; }
    const [token, ...args] = rest.replace(/,/g, " ").split(/\s+/); if (!token) return;
    const mnemonic = token.toUpperCase();
    if (mnemonic === ".ORG") { const target = Number(args[0]); if (!Number.isInteger(target) || target < address || target > 65535) errors.push({ line: index + 1, message: ".org must be a forward word address from 0 to 65535." }); else address = target; return; }
    if (mnemonic === ".EQU") { const name = args[0]?.toUpperCase(); const value = Number(args[1]); if (!name || !Number.isFinite(value) || labels.has(name)) errors.push({ line: index + 1, message: "Use .equ unique_name, numeric_value." }); else labels.set(name, value); return; }
    if (mnemonic === ".TEXT" || mnemonic === ".GLOBAL") return;
    rows.push({ line: index + 1, address, mnemonic, args, text: rest }); address++;
    if (address > 65536) errors.push({ line: index + 1, message: "Program exceeds 65536 words." });
  });
  const words = Array.from({ length: Math.min(address, 65536) }, () => 0);
  const listing: AsmLine[] = [];
  for (const row of rows) {
    if (row.mnemonic === ".WORD") { const token = row.args[0] ?? ""; const v = labels.get(token.toUpperCase()) ?? Number(token); if (row.args.length !== 1 || !Number.isInteger(v) || v < 0 || v > 2 ** isa.instrWidth - 1) errors.push({ line: row.line, message: ".word requires one value within the instruction width." }); else { words[row.address] = v >>> 0; listing.push({ ...row, word: v >>> 0, fields: {} }); } continue; }
    const instr = isa.instructions.find(i => i.mnemonic.toUpperCase() === row.mnemonic);
    if (!instr) { errors.push({ line: row.line, message: `Unknown mnemonic ${row.mnemonic}.` }); continue; }
    if (row.args.length !== instr.operands.length) { errors.push({ line: row.line, message: `${instr.mnemonic} expects ${instr.operands.length} operand(s), found ${row.args.length}.` }); continue; }
    const layout = fieldsOf(isa, instr.format); let word = 0;
    const op = layout.find(f => f.purpose === "opcode"); if (op) word = writeField(word, op, instr.opcode);
    const fields: Record<string, number> = { opcode: instr.opcode };
    instr.operands.forEach((operand, index) => {
      const token = row.args[index]!; const segments = layout.filter(f => f.purpose === operand); const field = segments[0]; if (!field) return;
      let value: number;
      if (operand === "imm") {
        const symbol = labels.get(token.toUpperCase()); value = symbol === undefined ? Number(token) : instr.pc.startsWith("branch") ? symbol - row.address : symbol;
        const bits = immediateWidth(isa, instr); const signed = field.signed || instr.pc.startsWith("branch");
        const max = signed ? 2 ** (bits - 1) - 1 : 2 ** bits - 1; const min = field.signed === false && !signed ? 0 : -(2 ** (bits - 1));
        if (!Number.isInteger(value) || value < min || value > max) { errors.push({ line: row.line, message: `Immediate ${token} does not fit in a ${bits}-bit ${signed ? "signed " : ""}field or is an unknown label.` }); return; }
      } else { const reg = parseReg(token, isa.regs); if (reg === null || reg >= 2 ** field.width) { errors.push({ line: row.line, message: `Invalid register ${token}. Use R0–R${isa.regs - 1}.` }); return; } value = reg; }
      fields[operand] = value;
      for (const segment of segments) word = writeField(word, segment, value >>> (segment.valueOffset ?? 0));
    });
    words[row.address] = word >>> 0; listing.push({ line: row.line, address: row.address, text: row.text, mnemonic: instr.mnemonic, word: word >>> 0, fields });
  }
  return errors.length ? { ok: false, errors } : { ok: true, words, listing, symbols: Object.fromEntries(labels) };
}

export function formatWord(isa: IsaSpec, word: number, format: IsaInstruction["format"]): string {
  const layout = fieldsOf(isa, format).slice().sort((a, b) => b.lo - a.lo);
  return layout.map((field) => readField(word, field).toString(2).padStart(field.width, "0")).join(" ");
}
