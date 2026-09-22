export function bits(word: number, hi: number, lo: number): number {
  return (word >>> lo) & ((1 << (hi - lo + 1)) - 1);
}

export function signExtend(value: number, width: number): number {
  const mask = (1 << width) - 1;
  const masked = value & mask;
  const sign = 1 << (width - 1);
  return (masked ^ sign) - sign;
}

export function toHex32(word: number): string {
  return `0x${(word >>> 0).toString(16).toUpperCase().padStart(8, "0")}`;
}

export function toBin32(word: number): string {
  return (word >>> 0).toString(2).padStart(32, "0");
}

export function toHex(word: number, width = 32): string {
  const nibbles = Math.ceil(width / 4);
  const mask = width >= 32 ? 0xffffffff : (1 << width) - 1;
  return (word & mask).toString(16).toUpperCase().padStart(nibbles, "0");
}

export function toBin(word: number, width: number): string {
  const mask = width >= 32 ? 0xffffffff : (1 << width) - 1;
  return (word & mask).toString(2).padStart(width, "0");
}

export function u32(value: number): number {
  return value >>> 0;
}

export interface FieldSlice {
  name: string;
  hi: number;
  lo: number;
  value: number;
  bits: string;
  meaning: string;
  color: string;
}

export function slice(word: number, name: string, hi: number, lo: number, meaning: string, color: string): FieldSlice {
  const value = bits(word, hi, lo);
  return { name, hi, lo, value, bits: toBin(value, hi - lo + 1), meaning, color };
}
