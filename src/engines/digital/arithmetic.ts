import type { LogicBit, LogicVector } from "../../types/logic";
import { fromUnsigned, invert, isBit, toBinary, toSigned, toUnsigned, zeros } from "./vector";

export interface BitSum {
  sum: LogicBit;
  carry: LogicBit;
}

export function halfAdder(a: LogicBit, b: LogicBit): BitSum {
  if (!isBit(a) || !isBit(b)) return { sum: "X", carry: "X" };
  return { sum: (a ^ b) as 0 | 1, carry: (a & b) as 0 | 1 };
}

export function fullAdder(a: LogicBit, b: LogicBit, cin: LogicBit): { sum: LogicBit; cout: LogicBit } {
  if (!isBit(a) || !isBit(b) || !isBit(cin)) return { sum: "X", cout: "X" };
  const sum = ((a ^ b ^ cin) & 1) as 0 | 1;
  const cout = ((a & b) | (a & cin) | (b & cin)) === 1 ? 1 : 0;
  return { sum, cout };
}

export interface AdderResult {
  sum: LogicVector;
  carries: LogicBit[];
  cout: LogicBit;
  depth: number;
}

function bitsOrNull(vector: LogicVector): Array<0 | 1> | null {
  if (vector.some((bit) => !isBit(bit))) return null;
  return vector as Array<0 | 1>;
}

export function rippleAdd(a: LogicVector, b: LogicVector, cin: LogicBit = 0): AdderResult {
  const width = Math.max(a.length, b.length);
  const aa = bitsOrNull(a);
  const bb = bitsOrNull(b);
  if (!aa || !bb || !isBit(cin) || aa.length !== bb.length) {
    return { sum: zeros(width).map(() => "X"), carries: [cin], cout: "X", depth: width };
  }
  const sum: Array<0 | 1> = Array.from({ length: width }, () => 0);
  const carries: LogicBit[] = [cin];
  let carry: 0 | 1 = cin;
  for (let index = width - 1; index >= 0; index -= 1) {
    const stage = fullAdder(aa[index] ?? 0, bb[index] ?? 0, carry);
    sum[index] = stage.sum === 1 ? 1 : 0;
    carry = stage.cout === 1 ? 1 : 0;
    carries.push(carry);
  }
  return { sum, carries, cout: carry, depth: width };
}

export interface ClaStage {
  bit: number;
  g: 0 | 1;
  p: 0 | 1;
  cin: 0 | 1;
  sum: 0 | 1;
  cout: 0 | 1;
}

/** 4-bit carry look-ahead. Wider words chain 4-bit blocks. */
export function carryLookahead(a: LogicVector, b: LogicVector, cin: LogicBit = 0): { sum: LogicVector; stages: ClaStage[]; cout: LogicBit; depth: number } {
  const aa = bitsOrNull(a);
  const bb = bitsOrNull(b);
  if (!aa || !bb || aa.length !== bb.length || !isBit(cin)) {
    return { sum: a.map(() => "X"), stages: [], cout: "X", depth: 0 };
  }
  const width = aa.length;
  const sum: Array<0 | 1> = Array.from({ length: width }, () => 0);
  const stages: ClaStage[] = [];
  let blockCin: 0 | 1 = cin;
  const blocks = Math.ceil(width / 4);
  for (let block = blocks - 1; block >= 0; block -= 1) {
    const start = block * 4;
    const g: Array<0 | 1> = [0, 0, 0, 0];
    const p: Array<0 | 1> = [0, 0, 0, 0];
    for (let local = 0; local < 4; local += 1) {
      const index = width - 1 - (start + local);
      if (index < 0) continue;
      const av = aa[index] ?? 0;
      const bv = bb[index] ?? 0;
      g[local] = (av & bv) as 0 | 1;
      p[local] = ((av ^ bv) & 1) as 0 | 1;
    }
    const g0 = g[0] ?? 0;
    const g1 = g[1] ?? 0;
    const g2 = g[2] ?? 0;
    const g3 = g[3] ?? 0;
    const p0 = p[0] ?? 0;
    const p1 = p[1] ?? 0;
    const p2 = p[2] ?? 0;
    const p3 = p[3] ?? 0;
    const c0: 0 | 1 = blockCin;
    const c1: 0 | 1 = (g0 || (p0 && c0)) ? 1 : 0;
    const c2: 0 | 1 = (g1 || (p1 && c1)) ? 1 : 0;
    const c3: 0 | 1 = (g2 || (p2 && c2)) ? 1 : 0;
    const c4: 0 | 1 = (g3 || (p3 && c3)) ? 1 : 0;
    const c: Array<0 | 1> = [c0, c1, c2, c3, c4];
    for (let local = 0; local < 4; local += 1) {
      const index = width - 1 - (start + local);
      if (index < 0) continue;
      const bitSum = (((p[local] ?? 0) ^ (c[local] ?? 0)) & 1) as 0 | 1;
      sum[index] = bitSum;
      stages.push({ bit: start + local, g: g[local] ?? 0, p: p[local] ?? 0, cin: c[local] ?? 0, sum: bitSum, cout: c[local + 1] ?? 0 });
    }
    blockCin = c[4] ?? 0;
  }
  return { sum, stages: stages.sort((left, right) => left.bit - right.bit), cout: blockCin, depth: 4 };
}

export function carrySelect(a: LogicVector, b: LogicVector, cin: LogicBit = 0, group = 4): { sum: LogicVector; cout: LogicBit; paths: Array<{ assume: 0 | 1; sum: LogicVector; cout: LogicBit; selected: boolean }> } {
  const width = a.length;
  const paths: Array<{ assume: 0 | 1; sum: LogicVector; cout: LogicBit; selected: boolean }> = [];
  const sum: LogicVector = zeros(width);
  let carry: LogicBit = isBit(cin) ? cin : "X";
  for (let offset = 0; offset < width; offset += group) {
    const sliceA = a.slice(Math.max(0, width - offset - group), width - offset);
    const sliceB = b.slice(Math.max(0, width - offset - group), width - offset);
    if (offset === 0) {
      const stage = rippleAdd(sliceA, sliceB, carry);
      stage.sum.forEach((bit, index) => {
        sum[width - offset - sliceA.length + index] = bit;
      });
      carry = stage.cout;
      paths.push({ assume: isBit(cin) ? cin : 0, sum: stage.sum, cout: stage.cout, selected: true });
    } else {
      const low = rippleAdd(sliceA, sliceB, 0);
      const high = rippleAdd(sliceA, sliceB, 1);
      const chosen: AdderResult = carry === 1 ? high : low;
      chosen.sum.forEach((bit, index) => {
        sum[width - offset - sliceA.length + index] = bit;
      });
      paths.push({ assume: 0, sum: low.sum, cout: low.cout, selected: carry === 0 });
      paths.push({ assume: 1, sum: high.sum, cout: high.cout, selected: carry === 1 });
      carry = chosen.cout;
    }
  }
  return { sum, cout: carry, paths };
}

export function halfSubtractor(a: LogicBit, b: LogicBit): { diff: LogicBit; borrow: LogicBit } {
  if (!isBit(a) || !isBit(b)) return { diff: "X", borrow: "X" };
  return { diff: (a ^ b) as 0 | 1, borrow: ((!a && b) ? 1 : 0) as 0 | 1 };
}

export function fullSubtractor(a: LogicBit, b: LogicBit, bin: LogicBit): { diff: LogicBit; bout: LogicBit } {
  if (!isBit(a) || !isBit(b) || !isBit(bin)) return { diff: "X", bout: "X" };
  const diff = ((a ^ b ^ bin) & 1) as 0 | 1;
  const bout = ((!a && b) || (!(a ^ b) && bin)) ? 1 : 0;
  return { diff, bout };
}

export function addSub(a: LogicVector, b: LogicVector, mode: 0 | 1): AdderResult & { bEffective: LogicVector } {
  const flipped = b.map((bit) => (mode === 1 ? (bit === 0 ? 1 : bit === 1 ? 0 : "X") : bit));
  const added = rippleAdd(a, flipped, mode);
  return { ...added, bEffective: flipped };
}

export function increment(vector: LogicVector): AdderResult {
  const one = zeros(vector.length);
  const last = one.length - 1;
  if (last >= 0) one[last] = 1;
  return rippleAdd(vector, one, 0);
}

export function decrement(vector: LogicVector): AdderResult {
  return addSub(vector, fromUnsigned(1, vector.length), 1);
}

export interface CompareResult {
  eq: 0 | 1;
  gt: 0 | 1;
  lt: 0 | 1;
  steps: Array<{ bit: number; a: 0 | 1; b: 0 | 1; decision: string }>;
}

export function compareMagnitude(a: LogicVector, b: LogicVector): CompareResult {
  const aa = bitsOrNull(a);
  const bb = bitsOrNull(b);
  if (!aa || !bb || aa.length !== bb.length) return { eq: 0, gt: 0, lt: 0, steps: [] };
  const steps: CompareResult["steps"] = [];
  for (let index = 0; index < aa.length; index += 1) {
    const av = aa[index] ?? 0;
    const bv = bb[index] ?? 0;
    if (av !== bv) {
      const gt = av === 1;
      steps.push({ bit: aa.length - 1 - index, a: av, b: bv, decision: gt ? "A is greater at this bit" : "B is greater at this bit" });
      return { eq: 0, gt: gt ? 1 : 0, lt: gt ? 0 : 1, steps };
    }
    steps.push({ bit: aa.length - 1 - index, a: av, b: bv, decision: "Bits match, continue" });
  }
  return { eq: 1, gt: 0, lt: 0, steps };
}

export type ShiftKind = "logical-left" | "logical-right" | "arithmetic-right" | "rotate-left" | "rotate-right";

export function shiftVector(vector: LogicVector, kind: ShiftKind, amount: number): { result: LogicVector; shiftedOut: LogicBit } {
  const width = vector.length;
  const steps = ((amount % width) + width) % width;
  if (!bitsOrNull(vector) || steps === 0) return { result: [...vector], shiftedOut: 0 };
  if (kind === "rotate-left") {
    return { result: [...vector.slice(steps), ...vector.slice(0, steps)], shiftedOut: vector[steps - 1] ?? 0 };
  }
  if (kind === "rotate-right") {
    return { result: [...vector.slice(width - steps), ...vector.slice(0, width - steps)], shiftedOut: vector[width - steps] ?? 0 };
  }
  if (kind === "logical-left") {
    const out = vector[steps - 1] ?? 0;
    return { result: [...vector.slice(steps), ...zeros(steps)], shiftedOut: out };
  }
  const fill = kind === "arithmetic-right" && vector[0] === 1 ? 1 : 0;
  const out = vector[width - steps] ?? 0;
  return { result: [...Array.from({ length: steps }, () => fill), ...vector.slice(0, width - steps)], shiftedOut: out };
}

export type AluOp = "ADD" | "SUB" | "AND" | "OR" | "XOR" | "NOT" | "SHL" | "SHR" | "CMP" | "INC" | "DEC";

export interface AluResult {
  result: LogicVector;
  zero: 0 | 1;
  negative: 0 | 1;
  carry: 0 | 1;
  overflow: 0 | 1;
  active: "arithmetic" | "logic" | "shift" | "compare";
}

function flagsOf(result: LogicVector, carry: 0 | 1, overflow: 0 | 1): Pick<AluResult, "zero" | "negative" | "carry" | "overflow"> {
  const bits = bitsOrNull(result);
  return {
    zero: bits && bits.every((bit) => bit === 0) ? 1 : 0,
    negative: result[0] === 1 ? 1 : 0,
    carry,
    overflow,
  };
}

export function signedOverflow(a: LogicVector, b: LogicVector, result: LogicVector, subtract: boolean): 0 | 1 {
  const aSign = a[0] === 1;
  const bSign = b[0] === 1;
  const rSign = result[0] === 1;
  if (subtract) return aSign !== bSign && rSign !== aSign ? 1 : 0;
  return aSign === bSign && rSign !== aSign ? 1 : 0;
}

export function alu(a: LogicVector, b: LogicVector, op: AluOp): AluResult {
  const width = a.length;
  const blank = { result: zeros(width), zero: 1 as const, negative: 0 as const, carry: 0 as const, overflow: 0 as const, active: "logic" as const };
  const aa = bitsOrNull(a);
  const bb = bitsOrNull(b);
  if (!aa || !bb || aa.length !== width) return { ...blank, result: a.map(() => "X"), zero: 0 };
  if (op === "ADD" || op === "SUB" || op === "INC" || op === "DEC") {
    const math = op === "ADD" ? addSub(aa, bb ?? zeros(width), 0) : op === "SUB" ? addSub(aa, bb ?? zeros(width), 1) : op === "INC" ? increment(aa) : decrement(aa);
    const carry = math.cout === 1 ? 1 : 0;
    const other = op === "INC" ? fromUnsigned(1, width) : op === "DEC" ? fromUnsigned(1, width) : bb ?? zeros(width);
    return { result: math.sum, active: "arithmetic", ...flagsOf(math.sum, carry, signedOverflow(aa, other, math.sum, op === "SUB" || op === "DEC")) };
  }
  if (op === "AND" || op === "OR" || op === "XOR") {
    const result = aa.map((bit, index) => {
      const right = bb?.[index] ?? 0;
      if (op === "AND") return (bit & right) as 0 | 1;
      if (op === "OR") return ((bit | right) & 1) as 0 | 1;
      return ((bit ^ right) & 1) as 0 | 1;
    });
    return { result, active: "logic", ...flagsOf(result, 0, 0) };
  }
  if (op === "NOT") {
    const result = invert(aa);
    return { result, active: "logic", ...flagsOf(result, 0, 0) };
  }
  if (op === "SHL" || op === "SHR") {
    const moved = shiftVector(aa, op === "SHL" ? "logical-left" : "logical-right", 1);
    const carry = moved.shiftedOut === 1 ? 1 : 0;
    return { result: moved.result, active: "shift", ...flagsOf(moved.result, carry, 0) };
  }
  const cmp = compareMagnitude(aa, bb ?? zeros(width));
  const result = zeros(width);
  if (result.length > 0) result[result.length - 1] = cmp.gt;
  const signed = (toSigned(aa) ?? 0) < (toSigned(bb ?? zeros(width)) ?? 0);
  return { result, active: "compare", zero: cmp.eq, negative: signed ? 1 : 0, carry: cmp.lt, overflow: 0 };
}

export interface MulStep {
  shift: number;
  row: string;
  include: boolean;
}

export function multiplySteps(a: LogicVector, b: LogicVector): { steps: MulStep[]; product: LogicVector } {
  const aa = bitsOrNull(a) ?? zeros(a.length);
  const bb = bitsOrNull(b) ?? zeros(b.length);
  const width = aa.length + bb.length;
  const steps: MulStep[] = [];
  let product = 0n;
  const aValue = BigInt(toUnsigned(aa) ?? 0);
  bb.forEach((bit, index) => {
    const shift = bb.length - 1 - index;
    const include = bit === 1;
    const partial = include ? aValue << BigInt(shift) : 0n;
    product += partial;
    const row = fromUnsigned(Number(partial), width);
    steps.push({ shift, row: toBinary(row), include });
  });
  return { steps, product: fromUnsigned(Number(product), width) };
}

export interface DivStep {
  remainder: number;
  bit: 0 | 1;
  quotientBit: 0 | 1;
  note: string;
}

export function divideSteps(dividend: LogicVector, divisor: LogicVector): { steps: DivStep[]; quotient: LogicVector; remainder: number; error?: string } {
  const div = toUnsigned(divisor) ?? 0;
  const width = dividend.length;
  if (div === 0) return { steps: [], quotient: zeros(width), remainder: 0, error: "Division by zero" };
  let remainder = 0;
  const quotient: Array<0 | 1> = [];
  const steps: DivStep[] = [];
  for (const bit of dividend) {
    if (!isBit(bit)) break;
    remainder = remainder * 2 + bit;
    const take = remainder >= div;
    if (take) remainder -= div;
    quotient.push(take ? 1 : 0);
    steps.push({ remainder, bit, quotientBit: take ? 1 : 0, note: take ? "Remainder covers the divisor, write 1" : "Remainder is smaller, write 0" });
  }
  return { steps, quotient, remainder };
}

export function binaryText(vector: LogicVector): string {
  return toBinary(vector);
}
