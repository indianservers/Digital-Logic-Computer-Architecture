import type { LogicBit, LogicVector } from "../../types/logic";

export function isBit(value: LogicBit): value is 0 | 1 {
  return value === 0 || value === 1;
}

export function zeros(width: number): LogicVector {
  return Array.from({ length: width }, () => 0);
}

export function fromUnsigned(value: number, width: number): LogicVector {
  const bits: LogicVector = [];
  let rest = Math.trunc(Math.abs(value));
  for (let i = width - 1; i >= 0; i -= 1) {
    const weight = 2 ** i;
    const bit: 0 | 1 = rest >= weight ? 1 : 0;
    if (bit) rest -= weight;
    bits.push(bit);
  }
  return bits;
}

export function toUnsigned(vector: LogicVector): number | null {
  if (vector.some((bit) => !isBit(bit))) return null;
  return vector.reduce<number>((sum, bit, index) => sum + (bit === 1 ? 2 ** (vector.length - 1 - index) : 0), 0);
}

export function toSigned(vector: LogicVector): number | null {
  const unsigned = toUnsigned(vector);
  if (unsigned === null || vector.length === 0) return null;
  const sign = vector[0] === 1 ? -(2 ** (vector.length - 1)) : 0;
  const rest = vector.slice(1).reduce<number>((sum, bit, index) => sum + (bit === 1 ? 2 ** (vector.length - 2 - index) : 0), 0);
  return sign + rest;
}

export function toBinary(vector: LogicVector): string {
  return vector.map((bit) => (bit === 0 || bit === 1 ? String(bit) : bit)).join("");
}

export function toHex(vector: LogicVector): string {
  const padded = [...zeros((4 - (vector.length % 4)) % 4), ...vector];
  let text = "";
  for (let i = 0; i < padded.length; i += 4) {
    const nibble = padded.slice(i, i + 4);
    const value = toUnsigned(nibble);
    text += value === null ? "X" : value.toString(16).toUpperCase();
  }
  return text;
}

export function parseBinary(text: string, width?: number): LogicVector | null {
  const cleaned = text.trim().replace(/\s/g, "");
  if (!/^[01]+$/.test(cleaned)) return null;
  const bits = [...cleaned].map((ch) => (ch === "1" ? 1 : 0)) as LogicVector;
  if (width === undefined) return bits;
  if (bits.length > width) return bits.slice(bits.length - width);
  return [...zeros(width - bits.length), ...bits];
}

export function sliceVector(vector: LogicVector, start: number, end: number): LogicVector {
  return vector.slice(start, end);
}

export function concatVectors(...parts: LogicVector[]): LogicVector {
  return parts.flat();
}

export function zeroExtend(vector: LogicVector, width: number): LogicVector {
  if (vector.length >= width) return vector.slice(vector.length - width);
  return [...zeros(width - vector.length), ...vector];
}

export function signExtend(vector: LogicVector, width: number): LogicVector {
  if (vector.length === 0) return zeros(width);
  if (vector.length >= width) return vector.slice(vector.length - width);
  const sign = vector[0] === 1 ? 1 : 0;
  return [...Array.from({ length: width - vector.length }, () => sign), ...vector];
}

export function invert(vector: LogicVector): LogicVector {
  return vector.map((bit) => (bit === 0 ? 1 : bit === 1 ? 0 : "X"));
}

export function sameWidth(a: LogicVector, b: LogicVector): boolean {
  return a.length === b.length && a.length > 0;
}
