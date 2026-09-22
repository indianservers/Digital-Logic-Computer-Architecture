import { must } from "../../utils/assert";

const DIGITS = "0123456789ABCDEF";

export function digitValue(ch: string): number {
  const index = DIGITS.indexOf(ch.toUpperCase());
  if (index < 0) return -1;
  return index;
}

export function isValidInBase(text: string, base: number): boolean {
  const cleaned = text.trim().replace(/[\s_]/g, "");
  if (!cleaned || base < 2 || base > 16) return false;
  return [...cleaned].every((ch) => {
    const v = digitValue(ch);
    return v >= 0 && v < base;
  });
}

export function parseBase(text: string, base: number): number | null {
  const cleaned = text.trim().replace(/[\s_]/g, "");
  if (!isValidInBase(cleaned, base)) return null;
  if (cleaned.length > 16 && base === 2) {
    let value = 0;
    for (const ch of cleaned) {
      value = value * base + digitValue(ch);
      if (!Number.isSafeInteger(value)) return null;
    }
    return value;
  }
  const value = parseInt(cleaned, base);
  return Number.isSafeInteger(value) ? value : null;
}

export function formatBase(value: number, base: number): string {
  if (!Number.isFinite(value) || value < 0 || base < 2 || base > 16) {
    throw new Error("Only non-negative integers in bases 2–16 are supported");
  }
  const rounded = Math.trunc(value);
  if (rounded === 0) return "0";
  let n = rounded;
  let out = "";
  while (n > 0) {
    out = must(DIGITS[n % base]) + out;
    n = Math.floor(n / base);
  }
  return out;
}

export function padBits(binary: string, width: number): string {
  const cleaned = binary.replace(/^0+/, "") || "0";
  if (cleaned.length > width) return cleaned.slice(-width);
  return cleaned.padStart(width, "0");
}

export interface PlaceValue {
  digit: string;
  weight: number;
  contribution: number;
  active: boolean;
}

export function placeValues(text: string, base: number): PlaceValue[] {
  const cleaned = text.trim().replace(/[\s_]/g, "").toUpperCase();
  const chars = [...cleaned];
  return chars.map((digit, index) => {
    const power = chars.length - 1 - index;
    const weight = base ** power;
    const dv = digitValue(digit);
    return {
      digit,
      weight,
      contribution: dv * weight,
      active: dv > 0,
    };
  });
}

export function contributionSum(places: PlaceValue[]): string {
  const parts = places.filter((p) => p.active).map((p) => String(p.contribution));
  if (parts.length === 0) return "0";
  return parts.join(" + ");
}

export interface DivisionStep {
  dividend: number;
  divisor: number;
  quotient: number;
  remainder: number;
}

/** Repeated division used by the decimal-to-binary walkthrough. Remainders are read bottom to top. */
export function divisionSteps(value: number, base: number): DivisionStep[] {
  if (value < 0 || base < 2) return [];
  if (value === 0) return [{ dividend: 0, divisor: base, quotient: 0, remainder: 0 }];
  const steps: DivisionStep[] = [];
  let n = Math.trunc(value);
  while (n > 0) {
    const remainder = n % base;
    const quotient = Math.floor(n / base);
    steps.push({ dividend: n, divisor: base, quotient, remainder });
    n = quotient;
  }
  return steps;
}

export function bitsOf(value: number, width: number): Array<0 | 1> {
  const out: Array<0 | 1> = [];
  let n = Math.abs(Math.trunc(value));
  for (let i = width - 1; i >= 0; i -= 1) {
    const weight = 2 ** i;
    if (n >= weight) {
      out.push(1);
      n -= weight;
    } else {
      out.push(0);
    }
  }
  return out;
}

export function valueFromBits(bits: Array<0 | 1>): number {
  return bits.reduce<number>((sum, bit, index) => sum + bit * 2 ** (bits.length - 1 - index), 0);
}

export function toggleBit(bits: Array<0 | 1>, index: number): Array<0 | 1> {
  return bits.map((bit, i) => (i === index ? (bit === 1 ? 0 : 1) : bit));
}
