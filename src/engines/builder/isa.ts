import { fieldsOf, type IsaField, type IsaInstruction, type IsaSpec } from "./model";

export interface FormatIssue { level: "error" | "warning"; message: string; field?: string }
export interface AsmLine { line: number; text: string; word: number; mnemonic: string; fields: Record<string, number> }
export interface AsmError { line: number; message: string }
export type AssembleResult =
  | { ok: true; words: number[]; listing: AsmLine[] }
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
    if (field.width <= 0) issues.push({ level: "error", message: `Field ${field.name} has impossible width ${field.width}.`, field: field.name });
    if (field.lo < 0 || field.lo + field.width > instrWidth) {
      issues.push({ level: "error", message: `Field ${field.name} (${field.lo}+${field.width}) does not fit in a ${instrWidth}-bit word.`, field: field.name });
    }
    const seen = names.get(field.name);
    if (seen !== undefined) issues.push({ level: "error", message: `Duplicate field name ${field.name}.`, field: field.name });
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
  for (const instr of isa.instructions) {
    const key = instr.mnemonic.toUpperCase();
    if (names.has(key)) issues.push({ level: "error", message: `Duplicate mnemonic ${instr.mnemonic}.` });
    names.add(key);
    if (instr.opcode > maxOp) issues.push({ level: "error", message: `Opcode ${instr.opcode} for ${instr.mnemonic} is too wide for a ${opcodeBits}-bit opcode field.` });
    const owner = used.get(instr.opcode);
    if (owner) issues.push({ level: "error", message: `Opcode conflict: ${owner} and ${instr.mnemonic} both use ${instr.opcode.toString(2).padStart(opcodeBits, "0")}.` });
    used.set(instr.opcode, instr.mnemonic);
    const rd = fieldsOf(isa, instr.format).find((field) => field.purpose === "rd");
    if (rd && isa.regs > fieldMask(rd.width) + 1) {
      issues.push({ level: "error", message: `Register field ${rd.name} is too small for ${isa.regs} registers.` });
    }
  }
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
  const opcodeField = isa.fieldsR.find((field) => field.purpose === "opcode") ?? isa.fieldsI.find((field) => field.purpose === "opcode");
  const opcode = opcodeField ? readField(word, opcodeField) : (word >>> 12) & 0xf;
  const instr = isa.instructions.find((item) => item.opcode === opcode) ?? null;
  const fields: Record<string, number> = { opcode };
  if (instr) {
    for (const field of fieldsOf(isa, instr.format)) fields[field.purpose] = readField(word, field);
  }
  return { instr, fields };
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

function parseImm(token: string, labels: Map<string, number>, pc: number, width: number): { value: number } | { error: string } {
  const clean = token.trim();
  if (/^[-+]?\d+$/.test(clean) || /^0x[0-9a-f]+$/i.test(clean)) {
    const value = Number(clean);
    const max = fieldMask(width);
    const min = width >= 32 ? -0x80000000 : -(1 << (width - 1));
    if (value > max || value < min) return { error: `Immediate ${value} does not fit in a ${width}-bit field.` };
    return { value: value & max };
  }
  const target = labels.get(clean.toUpperCase().replace(/:$/, ""));
  if (target === undefined) return { error: `Unknown immediate or label ${clean}.` };
  return { value: (target - pc) & fieldMask(width) };
}

export function assemble(isa: IsaSpec, source: string): AssembleResult {
  const raw = source.split(/\r?\n/);
  const labels = new Map<string, number>();
  const rows: Array<{ line: number; mnemonic: string; args: string[]; text: string }> = [];
  let pc = 0;
  raw.forEach((text, index) => {
    const trimmed = text.replace(/;.*$/, "").trim();
    if (!trimmed) return;
    const labeled = /^([A-Za-z_]\w*):(?:\s*(.*))?$/.exec(trimmed);
    let rest = trimmed;
    if (labeled) {
      const name = labeled[1];
      if (!name) return;
      labels.set(name.toUpperCase(), pc);
      rest = (labeled[2] ?? "").trim();
      if (!rest) return;
    }
    const [mnemonic, ...argText] = rest.replace(/,/g, " ").split(/\s+/);
    if (!mnemonic) return;
    rows.push({ line: index + 1, mnemonic: mnemonic.toUpperCase(), args: argText.filter(Boolean), text: rest });
    pc += 1;
  });
  const errors: AsmError[] = [];
  const listing: AsmLine[] = [];
  const words: number[] = [];
  rows.forEach((row, address) => {
    const instr = isa.instructions.find((item) => item.mnemonic === row.mnemonic);
    if (!instr) {
      errors.push({ line: row.line, message: `Unknown mnemonic ${row.mnemonic}.` });
      return;
    }
    if (row.args.length !== instr.operands.length) {
      errors.push({ line: row.line, message: `${instr.mnemonic} expects ${instr.operands.length} operand(s), found ${row.args.length}.` });
      return;
    }
    const layout = fieldsOf(isa, instr.format);
    let word = 0;
    const opcodeField = layout.find((field) => field.purpose === "opcode");
    if (opcodeField) word = writeField(word, opcodeField, instr.opcode);
    const fields: Record<string, number> = { opcode: instr.opcode };
    instr.operands.forEach((operand, index) => {
      const token = row.args[index] ?? "";
      const field = layout.find((item) => item.purpose === operand);
      if (!field) {
        errors.push({ line: row.line, message: `Instruction format is missing a ${operand} field.` });
        return;
      }
      if (operand === "imm") {
        const parsed = parseImm(token, labels, address, field.width);
        if ("error" in parsed) {
          errors.push({ line: row.line, message: parsed.error });
          return;
        }
        word = writeField(word, field, parsed.value);
        fields.imm = parsed.value;
        return;
      }
      const reg = parseReg(token, isa.regs);
      if (reg === null) {
        errors.push({ line: row.line, message: `Invalid register ${token}. Use R0–R${isa.regs - 1}.` });
        return;
      }
      word = writeField(word, field, reg);
      fields[operand] = reg;
    });
    listing.push({ line: row.line, text: row.text, word, mnemonic: instr.mnemonic, fields });
    words.push(word);
  });
  if (errors.length) return { ok: false, errors };
  return { ok: true, words, listing };
}

export function formatWord(isa: IsaSpec, word: number, format: IsaInstruction["format"]): string {
  const layout = fieldsOf(isa, format).slice().sort((a, b) => b.lo - a.lo);
  return layout.map((field) => readField(word, field).toString(2).padStart(field.width, "0")).join(" ");
}
