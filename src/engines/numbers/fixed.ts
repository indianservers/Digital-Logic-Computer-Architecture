import { bitsOf, valueFromBits } from "./convert";
import { decodeSigned, encodeSigned } from "./signed";

export interface FixedPoint {
  bits: Array<0 | 1>;
  integerBits: number;
  fractionalBits: number;
  signed: boolean;
  value: number;
  rangeMin: number;
  rangeMax: number;
  precision: number;
  pointAfter: number;
}

export function analyzeFixedPoint(
  bits: Array<0 | 1>,
  integerBits: number,
  fractionalBits: number,
  signed: boolean,
): FixedPoint {
  const width = integerBits + fractionalBits;
  const used = bits.slice(0, width);
  while (used.length < width) used.push(0);
  const precision = 2 ** -fractionalBits;
  if (!signed) {
    const raw = valueFromBits(used);
    return {
      bits: used,
      integerBits,
      fractionalBits,
      signed,
      value: raw * precision,
      rangeMin: 0,
      rangeMax: (2 ** width - 1) * precision,
      precision,
      pointAfter: integerBits,
    };
  }
  const raw = decodeSigned(used, "twos") ?? 0;
  return {
    bits: used,
    integerBits,
    fractionalBits,
    signed,
    value: raw * precision,
    rangeMin: -(2 ** (width - 1)) * precision,
    rangeMax: (2 ** (width - 1) - 1) * precision,
    precision,
    pointAfter: integerBits,
  };
}

export function fixedFromValue(value: number, integerBits: number, fractionalBits: number, signed: boolean): FixedPoint {
  const width = integerBits + fractionalBits;
  const scaled = Math.round(value * 2 ** fractionalBits);
  const bits = signed ? encodeSigned(scaled, width, "twos") ?? bitsOf(0, width) : bitsOf(Math.max(0, scaled), width);
  return analyzeFixedPoint(bits, integerBits, fractionalBits, signed);
}
