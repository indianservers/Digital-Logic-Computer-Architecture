export type BoothBit = 0 | 1;
export type BoothAction = "add" | "sub" | "nop";
export type BoothRadix = "signed" | 2 | 16;

export const BOOTH_WIDTHS = [4, 5, 6, 8] as const;

export interface BoothStep {
  cycle: number;
  aBefore: BoothBit[];
  qBefore: BoothBit[];
  qMinus1Before: BoothBit;
  q0: BoothBit;
  action: BoothAction;
  aAfterOp: BoothBit[];
  opSign: BoothBit;
  opValue: number;
  aAfter: BoothBit[];
  qAfter: BoothBit[];
  qMinus1After: BoothBit;
}

export interface BoothTrace {
  width: number;
  m: number;
  q: number;
  mBits: BoothBit[];
  qBits: BoothBit[];
  negM: BoothBit[];
  negMValue: number;
  negMFits: boolean;
  initialA: BoothBit[];
  initialQ: BoothBit[];
  steps: BoothStep[];
  productBits: BoothBit[];
  product: number;
  reference: number;
  additions: number;
  subtractions: number;
  noOps: number;
  error: string;
}

export function signedRange(width: number): { min: number; max: number } {
  return { min: -(2 ** (width - 1)), max: 2 ** (width - 1) - 1 };
}

export function toBits(value: number, width: number): BoothBit[] {
  const span = 2 ** width;
  const wrapped = ((value % span) + span) % span;
  return Array.from({ length: width }, (_, index) => (((wrapped >> index) & 1) === 1 ? 1 : 0));
}

export function fromBits(bits: readonly BoothBit[]): number {
  const width = bits.length;
  const unsigned = bits.reduce<number>((total, bit, index) => total + bit * 2 ** index, 0);
  const sign = bits[width - 1] ?? 0;
  return sign === 1 ? unsigned - 2 ** width : unsigned;
}

export function signExtend(bits: readonly BoothBit[], width: number): BoothBit[] {
  const sign = bits[bits.length - 1] ?? 0;
  return Array.from({ length: width }, (_, index) => bits[index] ?? sign);
}

export function addBits(left: readonly BoothBit[], right: readonly BoothBit[]): { bits: BoothBit[]; carry: BoothBit } {
  const width = left.length;
  const bits: BoothBit[] = [];
  let carry = 0;
  for (let index = 0; index < width; index += 1) {
    const sum = (left[index] ?? 0) + (right[index] ?? 0) + carry;
    bits.push((sum & 1) === 1 ? 1 : 0);
    carry = sum >> 1;
  }
  return { bits, carry: carry === 1 ? 1 : 0 };
}

export function negateBits(bits: readonly BoothBit[]): BoothBit[] {
  const inverted = bits.map((bit) => (bit === 1 ? 0 : 1));
  return addBits(inverted, toBits(1, bits.length)).bits;
}

export function arithmeticShiftRight(bits: readonly BoothBit[]): BoothBit[] {
  const sign = bits[bits.length - 1] ?? 0;
  return Array.from({ length: bits.length }, (_, index) => (index === bits.length - 1 ? sign : (bits[index + 1] ?? 0)));
}

export function bitsToHex(bits: readonly BoothBit[]): string {
  const unsigned = bits.reduce<number>((total, bit, index) => total + bit * 2 ** index, 0);
  return `0x${unsigned.toString(16).toUpperCase()}`;
}

export function msbString(bits: readonly BoothBit[]): string {
  return bits.slice().reverse().join("");
}

export function boothAction(q0: BoothBit, qMinus1: BoothBit): BoothAction {
  if (q0 === 0 && qMinus1 === 1) return "add";
  if (q0 === 1 && qMinus1 === 0) return "sub";
  return "nop";
}

export function actionLabel(action: BoothAction): string {
  if (action === "add") return "A = A + M";
  if (action === "sub") return "A = A − M";
  return "No operation";
}

export function formatBooth(value: number, radix: BoothRadix, width: number): string {
  if (radix === "signed") return String(value);
  if (radix === 2) return msbString(toBits(value, width));
  const unsigned = toBits(value, width).reduce<number>((total, bit, index) => total + bit * 2 ** index, 0);
  return unsigned.toString(16).toUpperCase();
}

export function parseBooth(text: string, radix: BoothRadix, width: number): { ok: true; value: number } | { ok: false; error: string } {
  const trimmed = text.trim();
  const range = signedRange(width);
  if (!trimmed) return { ok: false, error: "Enter a value." };
  if (radix === "signed") {
    if (!/^-?\d+$/.test(trimmed)) return { ok: false, error: "Use a signed decimal integer." };
    const value = Number(trimmed);
    if (!Number.isFinite(value) || value < range.min || value > range.max) return { ok: false, error: `Valid range is ${range.min} to +${range.max}.` };
    return { ok: true, value };
  }
  if (radix === 2) {
    if (!/^[01]+$/.test(trimmed)) return { ok: false, error: "Binary uses digits 0 and 1." };
    if (trimmed.length > width) return { ok: false, error: `Use at most ${width} bits.` };
    return { ok: true, value: fromBits(toBits(Number.parseInt(trimmed, 2), width)) };
  }
  if (!/^[0-9a-fA-F]+$/.test(trimmed)) return { ok: false, error: "Hexadecimal uses digits 0–9 and A–F." };
  const parsed = Number.parseInt(trimmed, 16);
  if (parsed >= 2 ** width) return { ok: false, error: `That pattern needs more than ${width} bits.` };
  return { ok: true, value: fromBits(toBits(parsed, width)) };
}

export function examplePair(width: number): { m: number; q: number } {
  const range = signedRange(width);
  return { m: Math.max(range.min, Math.min(range.max, -3)), q: Math.max(range.min, Math.min(range.max, 5)) };
}

function shiftPair(accumulator: BoothBit[], quotient: BoothBit[]): { accumulator: BoothBit[]; quotient: BoothBit[]; qMinus1: BoothBit } {
  const shifted = arithmeticShiftRight(accumulator);
  const width = quotient.length;
  const qMinus1 = quotient[0] ?? 0;
  const nextQ = Array.from({ length: width }, (_, index) => (index === width - 1 ? (accumulator[0] ?? 0) : (quotient[index + 1] ?? 0)));
  return { accumulator: shifted, quotient: nextQ, qMinus1 };
}

export function buildBooth(input: { width: number; m: number; q: number }): BoothTrace {
  const width = input.width;
  const range = signedRange(width);
  const m = Math.max(range.min, Math.min(range.max, input.m));
  const q = Math.max(range.min, Math.min(range.max, input.q));
  const mBits = toBits(m, width);
  const qBits = toBits(q, width);
  const mExt = signExtend(mBits, width + 1);
  const negM = negateBits(mExt);
  const negMValue = fromBits(negM);
  let accumulator = toBits(0, width + 1);
  let quotient = qBits.slice();
  let qMinus1: BoothBit = 0;
  const steps: BoothStep[] = [];
  for (let cycle = 1; cycle <= width; cycle += 1) {
    const aBefore = accumulator.slice(0, width);
    const qBefore = quotient.slice();
    const q0 = quotient[0] ?? 0;
    const action = boothAction(q0, qMinus1);
    let operated = accumulator.slice();
    if (action === "add") operated = addBits(accumulator, mExt).bits;
    if (action === "sub") operated = addBits(accumulator, negM).bits;
    const shifted = shiftPair(operated, quotient);
    steps.push({
      cycle,
      aBefore,
      qBefore,
      qMinus1Before: qMinus1,
      q0,
      action,
      aAfterOp: operated.slice(0, width),
      opSign: operated[width] ?? 0,
      opValue: fromBits(operated),
      aAfter: shifted.accumulator.slice(0, width),
      qAfter: shifted.quotient,
      qMinus1After: shifted.qMinus1,
    });
    accumulator = shifted.accumulator;
    quotient = shifted.quotient;
    qMinus1 = shifted.qMinus1;
  }
  const productBits = [...quotient, ...accumulator.slice(0, width)];
  const product = fromBits(productBits);
  const reference = m * q;
  return {
    width,
    m,
    q,
    mBits,
    qBits,
    negM,
    negMValue,
    negMFits: negMValue >= range.min && negMValue <= range.max,
    initialA: toBits(0, width),
    initialQ: qBits,
    steps,
    productBits,
    product,
    reference,
    additions: steps.filter((step) => step.action === "add").length,
    subtractions: steps.filter((step) => step.action === "sub").length,
    noOps: steps.filter((step) => step.action === "nop").length,
    error: product === reference ? "" : `Booth product ${product} does not match ${reference}`,
  };
}

export function viewAt(trace: BoothTrace, cycle: number): { cycle: number; a: BoothBit[]; q: BoothBit[]; qMinus1: BoothBit; step: BoothStep | null } {
  const clamped = Math.max(0, Math.min(cycle, trace.width));
  if (clamped === 0) return { cycle: 0, a: trace.initialA, q: trace.initialQ, qMinus1: 0, step: null };
  const step = trace.steps[clamped - 1] ?? null;
  return { cycle: clamped, a: step?.aAfter ?? trace.initialA, q: step?.qAfter ?? trace.initialQ, qMinus1: step?.qMinus1After ?? 0, step };
}
