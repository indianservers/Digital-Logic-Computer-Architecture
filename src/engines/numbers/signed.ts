import { bitsOf, valueFromBits } from "./convert";

export type SignedCode = "unsigned" | "sign-magnitude" | "ones" | "twos";

export function widthMask(width: number): number {
  if (width >= 32) return 0xffffffff;
  return 2 ** width - 1;
}

export function toBits(value: number, width: number): Array<0 | 1> {
  const masked = ((value % 2 ** width) + 2 ** width) % 2 ** width;
  return bitsOf(masked, width);
}

export function unsignedRange(width: number): { min: number; max: number } {
  return { min: 0, max: 2 ** width - 1 };
}

export function twosRange(width: number): { min: number; max: number } {
  return { min: -(2 ** (width - 1)), max: 2 ** (width - 1) - 1 };
}

export function signMagnitudeRange(width: number): { min: number; max: number } {
  return { min: -(2 ** (width - 1) - 1), max: 2 ** (width - 1) - 1 };
}

export function encodeSigned(value: number, width: number, code: SignedCode): Array<0 | 1> | null {
  if (!Number.isFinite(value) || !Number.isFinite(width) || width < 1) return null;
  if (width < 2 && code !== "unsigned") return null;
  if (code === "unsigned") {
    if (value < 0 || value > 2 ** width - 1) return null;
    return toBits(value, width);
  }
  const sign = value < 0 ? 1 : 0;
  const mag = Math.abs(value);
  if (code === "sign-magnitude" || code === "ones") {
    if (mag > 2 ** (width - 1) - 1) return null;
    const magnitude = toBits(mag, width);
    magnitude[0] = sign;
    if (code === "ones" && sign === 1) {
      for (let i = 1; i < magnitude.length; i += 1) {
        const bit = magnitude[i];
        if (bit === undefined) continue;
        magnitude[i] = bit === 1 ? 0 : 1;
      }
    }
    return magnitude;
  }
  const range = twosRange(width);
  if (value < range.min || value > range.max) return null;
  const wrapped = value < 0 ? 2 ** width + value : value;
  return toBits(wrapped, width);
}

export function decodeSigned(bits: Array<0 | 1>, code: SignedCode): number | null {
  const width = bits.length;
  if (width === 0) return null;
  if (code === "unsigned") return valueFromBits(bits);
  const sign = bits[0] ?? 0;
  if (code === "sign-magnitude") {
    const magBits = bits.map((b, i) => (i === 0 ? 0 : b));
    const mag = valueFromBits(magBits);
    if (sign === 1 && mag === 0) return null;
    return sign === 1 ? -mag : mag;
  }
  if (code === "ones") {
    if (bits.every((b) => b === 1)) return null;
    if (sign === 0) return valueFromBits(bits);
    const inverted = bits.map((b, i) => (i === 0 ? 0 : b === 1 ? 0 : 1));
    return -valueFromBits(inverted as Array<0 | 1>);
  }
  const unsigned = valueFromBits(bits);
  const signBit = 2 ** (width - 1);
  return unsigned >= signBit ? unsigned - 2 ** width : unsigned;
}

export interface NegationStep {
  label: string;
  bits: Array<0 | 1>;
  note: string;
}

export function twosNegationSteps(value: number, width: number): NegationStep[] | null {
  const positive = encodeSigned(Math.abs(value), width, "twos");
  if (!positive) return null;
  const inverted = positive.map((b) => (b === 1 ? 0 : 1)) as Array<0 | 1>;
  const plusOne = toBits(valueFromBits(inverted) + 1, width);
  return [
    {
      label: `${value >= 0 ? "+" : ""}${Math.abs(value)}`,
      bits: positive,
      note: "Start from the positive magnitude in two's complement.",
    },
    {
      label: "Invert",
      bits: inverted,
      note: "Flip every bit. This is the one's complement.",
    },
    {
      label: "Add 1",
      bits: plusOne,
      note: `Adding 1 finishes the two's complement. The pattern encodes ${value >= 0 ? -Math.abs(value) : Math.abs(value)}.`,
    },
  ];
}

export interface SignedOverflow {
  unsigned: number;
  signed: number;
  carryOut: boolean;
  signedOverflow: boolean;
  reason: string;
}

export function addTwos(a: number, b: number, width: number): SignedOverflow {
  const mask = 2 ** width;
  const raw = a + b;
  const unsigned = ((raw % mask) + mask) % mask;
  const signed = unsigned >= mask / 2 ? unsigned - mask : unsigned;
  const signA = a < 0;
  const signB = b < 0;
  const signS = signed < 0;
  const signedOverflow = signA === signB && signA !== signS;
  let reason = "The result fits in the signed range.";
  if (signedOverflow) {
    reason = signA
      ? "Both operands are negative, but the sum flipped positive. The carry into the sign bit and the carry out disagree."
      : "Both operands are positive, but the sum flipped negative. The true sum left the signed range.";
  } else if (raw >= mask) {
    reason = "Unsigned arithmetic wrapped because a carry left the top bit. The signed reading can still be valid.";
  }
  return { unsigned, signed, carryOut: raw >= mask, signedOverflow, reason };
}
