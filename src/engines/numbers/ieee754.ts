export type FloatClass = "zero" | "subnormal" | "normal" | "infinity" | "nan";

export interface FloatParts {
  width: 32 | 64;
  bits: string;
  sign: 0 | 1;
  exponentBits: string;
  fractionBits: string;
  biasedExponent: number;
  trueExponent: number | null;
  significand: string;
  classification: FloatClass;
  valueText: string;
  formula: string;
}

const SPECS = {
  32: { exp: 8, frac: 23, bias: 127 },
  64: { exp: 11, frac: 52, bias: 1023 },
} as const;

export function decodeFloatBits(bits: string): FloatParts {
  const width = bits.length === 64 ? 64 : 32;
  const spec = SPECS[width];
  const padded = bits.replace(/[^01]/g, "").padStart(width, "0").slice(-width);
  const sign = (padded[0] === "1" ? 1 : 0) as 0 | 1;
  const exponentBits = padded.slice(1, 1 + spec.exp);
  const fractionBits = padded.slice(1 + spec.exp);
  const biased = Number.parseInt(exponentBits, 2);
  const fracValue = fractionBits.split("").reduce((sum, bit, index) => sum + (bit === "1" ? 2 ** -(index + 1) : 0), 0);
  const signText = sign === 1 ? "−" : "+";

  if (biased === 0 && !fractionBits.includes("1")) {
    return pack(width, padded, sign, exponentBits, fractionBits, biased, null, "0.0", "zero", `${signText}0`, "All-zero exponent and fraction encode zero. The sign bit still distinguishes +0 from −0.");
  }
  if (biased === 0) {
    const exp = 1 - spec.bias;
    const value = (sign === 1 ? -1 : 1) * fracValue * 2 ** exp;
    return pack(
      width,
      padded,
      sign,
      exponentBits,
      fractionBits,
      biased,
      exp,
      fracValue.toFixed(6),
      "subnormal",
      formatNumber(value),
      `${signText}0.${fractionBits} × 2^${exp}. The hidden bit is 0, so this is a subnormal.`,
    );
  }
  const maxExp = 2 ** spec.exp - 1;
  if (biased === maxExp && !fractionBits.includes("1")) {
    return pack(width, padded, sign, exponentBits, fractionBits, biased, null, "∞", "infinity", sign === 1 ? "−Infinity" : "+Infinity", "A full exponent with a zero fraction encodes infinity.");
  }
  if (biased === maxExp) {
    return pack(width, padded, sign, exponentBits, fractionBits, biased, null, "NaN", "nan", "NaN", "A full exponent with a nonzero fraction encodes Not a Number. The payload is the fraction bits.");
  }
  const trueExp = biased - spec.bias;
  const significand = 1 + fracValue;
  const value = (sign === 1 ? -1 : 1) * significand * 2 ** trueExp;
  return pack(
    width,
    padded,
    sign,
    exponentBits,
    fractionBits,
    biased,
    trueExp,
    significand.toPrecision(8),
    "normal",
    formatNumber(value),
    `(${sign === 1 ? "−1" : "+1"}) × ${significand.toPrecision(6)} × 2^${trueExp}`,
  );
}

function pack(
  width: 32 | 64,
  bits: string,
  sign: 0 | 1,
  exponentBits: string,
  fractionBits: string,
  biasedExponent: number,
  trueExponent: number | null,
  significand: string,
  classification: FloatClass,
  valueText: string,
  formula: string,
): FloatParts {
  return { width, bits, sign, exponentBits, fractionBits, biasedExponent, trueExponent, significand, classification, valueText, formula };
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return value > 0 ? "+Infinity" : "−Infinity";
  if (Object.is(value, -0)) return "−0";
  const abs = Math.abs(value);
  if (abs !== 0 && (abs < 1e-6 || abs >= 1e7)) return value.toExponential(6);
  return String(Math.round(value * 1e9) / 1e9);
}

export function numberToFloatBits(value: number, width: 32 | 64): string {
  const buffer = new ArrayBuffer(width / 8);
  const view = new DataView(buffer);
  if (width === 32) view.setFloat32(0, value, false);
  else view.setFloat64(0, value, false);
  let hex = "";
  for (let i = 0; i < buffer.byteLength; i += 1) {
    hex += (view.getUint8(i) ?? 0).toString(16).padStart(2, "0");
  }
  return BigInt(`0x${hex}`).toString(2).padStart(width, "0");
}

export function floatBitsToNumber(bits: string): number {
  const width = bits.length >= 64 ? 64 : 32;
  const padded = bits.padStart(width, "0").slice(-width);
  const buffer = new ArrayBuffer(width / 8);
  const view = new DataView(buffer);
  const hex = BigInt(`0b${padded}`).toString(16).padStart(width / 4, "0");
  for (let i = 0; i < width / 8; i += 1) {
    view.setUint8(i, Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16));
  }
  return width === 32 ? view.getFloat32(0, false) : view.getFloat64(0, false);
}

export function toggleFloatBit(bits: string, index: number): string {
  const chars = [...bits];
  const current = chars[index];
  if (current === undefined) return bits;
  chars[index] = current === "1" ? "0" : "1";
  return chars.join("");
}

export const FLOAT_PRESETS: Array<{ label: string; value: number | "nan" | "negzero" }> = [
  { label: "+0", value: 0 },
  { label: "−0", value: "negzero" },
  { label: "+1", value: 1 },
  { label: "6.5", value: 6.5 },
  { label: "+∞", value: Number.POSITIVE_INFINITY },
  { label: "−∞", value: Number.NEGATIVE_INFINITY },
  { label: "NaN", value: "nan" },
];

export function presetBits(preset: (typeof FLOAT_PRESETS)[number]["value"], width: 32 | 64): string {
  if (preset === "nan") return numberToFloatBits(Number.NaN, width);
  if (preset === "negzero") return numberToFloatBits(-0, width);
  return numberToFloatBits(preset, width);
}
