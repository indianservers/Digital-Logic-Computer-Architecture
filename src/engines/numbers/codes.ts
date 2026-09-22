import { bitsOf, formatBase, valueFromBits } from "./convert";

export function toBcd(decimalText: string): string[] | null {
  const cleaned = decimalText.trim();
  if (!/^\d+$/.test(cleaned)) return null;
  return [...cleaned].map((digit) => bitsOf(Number(digit), 4).join(""));
}

export function bcdToDecimal(groups: string[]): string | null {
  if (groups.some((group) => !/^[01]{4}$/.test(group))) return null;
  const digits = groups.map((group) => {
    const value = valueFromBits(group.split("").map((b) => (b === "1" ? 1 : 0)));
    return value;
  });
  if (digits.some((d) => d > 9)) return null;
  return digits.join("");
}

export function excess3FromDecimal(decimalText: string): string[] | null {
  const cleaned = decimalText.trim();
  if (!/^\d+$/.test(cleaned)) return null;
  return [...cleaned].map((digit) => bitsOf(Number(digit) + 3, 4).join(""));
}

export function binaryToGray(value: number): number {
  const n = Math.trunc(Math.abs(value));
  return n ^ (n >>> 1);
}

export function grayToBinary(gray: number): number {
  let n = Math.trunc(Math.abs(gray));
  let mask = n >>> 1;
  while (mask) {
    n ^= mask;
    mask >>>= 1;
  }
  return n >>> 0;
}

export function grayBits(binaryBits: Array<0 | 1>): Array<0 | 1> {
  const value = valueFromBits(binaryBits);
  return bitsOf(binaryToGray(value), binaryBits.length);
}

export function adjacentGray(width: number): Array<{ value: number; binary: string; gray: string }> {
  const count = 2 ** Math.min(width, 8);
  const rows = [];
  for (let value = 0; value < count; value += 1) {
    const gray = binaryToGray(value);
    rows.push({
      value,
      binary: bitsOf(value, width).join(""),
      gray: bitsOf(gray, width).join(""),
    });
  }
  return rows;
}

export function hammingDistance(a: string, b: string): number {
  let distance = 0;
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i += 1) {
    if ((a[i] ?? "0") !== (b[i] ?? "0")) distance += 1;
  }
  return distance;
}

export interface CharacterCode {
  character: string;
  codePoint: number;
  decimal: number;
  hex: string;
  binary: string;
  utf8: string;
  note: string;
}

export function inspectCharacter(character: string): CharacterCode | null {
  if (!character) return null;
  const codePoint = character.codePointAt(0);
  if (codePoint === undefined) return null;
  const hex = formatBase(codePoint, 16);
  const binary = codePoint.toString(2).padStart(codePoint > 255 ? 16 : 8, "0");
  let note = "This is an ASCII code point. The low 7 bits are the classic ASCII encoding.";
  if (codePoint > 0x10ffff) note = "Outside the Unicode range.";
  else if (codePoint > 0xffff) note = "Supplementary plane code point. UTF-16 stores it as a surrogate pair; the code point itself is one number.";
  else if (codePoint > 127) note = "Beyond ASCII, still inside the Basic Multilingual Plane. Unicode assigns this code point; UTF-8 uses more than one byte.";
  return {
    character: String.fromCodePoint(codePoint),
    codePoint,
    decimal: codePoint,
    hex,
    binary,
    utf8: utf8Bytes(codePoint),
    note,
  };
}

function utf8Bytes(codePoint: number): string {
  if (codePoint < 0x80) return bitsOf(codePoint, 8).join("");
  const bytes: number[] = [];
  if (codePoint < 0x800) bytes.push(0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f));
  else if (codePoint < 0x10000) bytes.push(0xe0 | (codePoint >> 12), 0x80 | ((codePoint >> 6) & 0x3f), 0x80 | (codePoint & 0x3f));
  else bytes.push(0xf0 | (codePoint >> 18), 0x80 | ((codePoint >> 12) & 0x3f), 0x80 | ((codePoint >> 6) & 0x3f), 0x80 | (codePoint & 0x3f));
  return bytes.map((b) => bitsOf(b, 8).join("")).join(" ");
}

export function parityBit(data: Array<0 | 1>, odd: boolean): 0 | 1 {
  const xor = data.reduce<number>((sum, bit) => sum ^ bit, 0);
  const evenBit = (xor & 1) as 0 | 1;
  return odd ? (evenBit === 1 ? 0 : 1) : evenBit;
}

export function parityCheck(frame: Array<0 | 1>, odd: boolean): { ok: boolean; expected: 0 | 1; actual: 0 | 1 } {
  if (frame.length === 0) return { ok: true, expected: 0, actual: 0 };
  const data = frame.slice(0, -1);
  const actual = frame[frame.length - 1] ?? 0;
  const expected = parityBit(data, odd);
  return { ok: actual === expected, expected, actual };
}
