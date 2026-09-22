export type ArithmeticOp = "add" | "sub" | "mul" | "div";

export interface BitStep {
  label: string;
  rows: string[];
  note: string;
}

export interface ArithmeticResult {
  bitWidth: number;
  a: number;
  b: number;
  patternA: string;
  patternB: string;
  resultPattern: string;
  unsigned: number;
  signed: number;
  overflow: boolean;
  divZero: boolean;
  remainderPattern?: string;
  steps: BitStep[];
}

function mask(width: number): number {
  return width >= 32 ? 0xffffffff : 2 ** width - 1;
}

function bits(value: number, width: number): Array<0 | 1> {
  const out: Array<0 | 1> = [];
  let n = ((value % 2 ** width) + 2 ** width) % 2 ** width;
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

function fromBits(valueBits: Array<0 | 1>): number {
  return valueBits.reduce<number>((sum, bit, index) => sum + bit * 2 ** (valueBits.length - 1 - index), 0);
}

function join(valueBits: Array<0 | 1 | " " | "·">): string {
  return valueBits.join("");
}

function signedOf(unsigned: number, width: number): number {
  const half = 2 ** (width - 1);
  return unsigned >= half ? unsigned - 2 ** width : unsigned;
}

export function binaryArithmetic(a: number, b: number, width: number, op: ArithmeticOp): ArithmeticResult {
  const m = mask(width);
  const ua = ((a % (m + 1)) + (m + 1)) % (m + 1);
  const ub = ((b % (m + 1)) + (m + 1)) % (m + 1);
  const patternA = join(bits(ua, width));
  const patternB = join(bits(ub, width));

  if (op === "add") return finish(width, ua, ub, patternA, patternB, addSteps(ua, ub, width));
  if (op === "sub") return finish(width, ua, ub, patternA, patternB, subSteps(ua, ub, width));
  if (op === "mul") return finish(width, ua, ub, patternA, patternB, mulSteps(ua, ub, width));
  return finish(width, ua, ub, patternA, patternB, divSteps(ua, ub, width));
}

function finish(
  width: number,
  ua: number,
  ub: number,
  patternA: string,
  patternB: string,
  built: { pattern: string; unsigned: number; overflow: boolean; steps: BitStep[]; remainder?: string; divZero?: boolean },
): ArithmeticResult {
  return {
    bitWidth: width,
    a: ua,
    b: ub,
    patternA,
    patternB,
    resultPattern: built.pattern,
    unsigned: built.unsigned,
    signed: signedOf(built.unsigned, built.pattern.length),
    overflow: built.overflow,
    divZero: built.divZero ?? false,
    remainderPattern: built.remainder,
    steps: built.steps,
  };
}

function addSteps(a: number, b: number, width: number) {
  const ba = bits(a, width);
  const bb = bits(b, width);
  const sum: Array<0 | 1> = [];
  const carryRow: Array<0 | 1> = new Array(width).fill(0);
  let carry = 0;
  for (let i = width - 1; i >= 0; i -= 1) {
    const total = (ba[i] ?? 0) + (bb[i] ?? 0) + carry;
    sum[i] = (total & 1) as 0 | 1;
    carry = total >> 1;
    if (i > 0) carryRow[i - 1] = carry as 0 | 1;
  }
  const unsigned = fromBits(sum);
  const raw = a + b;
  const signA = (ba[0] ?? 0) === 1;
  const signB = (bb[0] ?? 0) === 1;
  const signS = (sum[0] ?? 0) === 1;
  const signedOverflow = signA === signB && signA !== signS;
  const steps: BitStep[] = [
    {
      label: "Column sum",
      rows: [`Carry  ${join(carryRow)}`, `       ${join(ba)}`, `     + ${join(bb)}`, `       ${"-".repeat(width)}`, `       ${join(sum)}${carry ? "  (carry out 1)" : ""}`],
      note: signedOverflow
        ? "The two operands share a sign, but the sum sign flipped. That is signed overflow."
        : carry
          ? "A carry left the top bit. Unsigned arithmetic wrapped; check the signed reading separately."
          : "Each column is bit + bit + carry. The carry moves one place to the left.",
    },
  ];
  return { pattern: join(sum), unsigned, overflow: signedOverflow || raw > mask(width), steps };
}

function subSteps(a: number, b: number, width: number) {
  const ba = bits(a, width);
  const bb = bits(b, width);
  const diff: Array<0 | 1> = [];
  const borrowRow: Array<0 | 1> = new Array(width).fill(0);
  let borrow = 0;
  for (let i = width - 1; i >= 0; i -= 1) {
    let d = (ba[i] ?? 0) - (bb[i] ?? 0) - borrow;
    if (d < 0) {
      d += 2;
      borrow = 1;
    } else {
      borrow = 0;
    }
    diff[i] = d as 0 | 1;
    if (i > 0) borrowRow[i - 1] = borrow as 0 | 1;
  }
  const unsigned = fromBits(diff);
  const steps: BitStep[] = [
    {
      label: "Borrow",
      rows: [`Borrow ${join(borrowRow)}`, `       ${join(ba)}`, `     − ${join(bb)}`, `       ${"-".repeat(width)}`, `       ${join(diff)}`],
      note: borrow
        ? "A borrow escaped the top bit, so the unsigned result wrapped. In two's complement this is still a valid negative difference."
        : "When the top bit is smaller than the bit being subtracted, it borrows 2 from the next column.",
    },
  ];
  return { pattern: join(diff), unsigned, overflow: borrow === 1 && a < b, steps };
}

function mulSteps(a: number, b: number, width: number) {
  const bb = bits(b, width);
  const partials: string[] = [];
  let acc = 0n;
  const bigA = BigInt(a);
  bb.forEach((bit, index) => {
    const shift = width - 1 - index;
    if (bit === 1) {
      acc += bigA << BigInt(shift);
      partials.push(`${bits(a, width).join("")} << ${shift}`);
    }
  });
  const fullWidth = width * 2;
  const product = acc;
  const lowMask = (1n << BigInt(width)) - 1n;
  const truncated = Number(product & lowMask);
  const pattern = product.toString(2).padStart(fullWidth, "0");
  const steps: BitStep[] = [
    {
      label: "Shift and add",
      rows: [
        partials.length ? partials.join("\n") : "All multiplier bits are 0",
        `Product ${pattern}`,
        `Low ${width} bits ${bits(truncated, width).join("")}`,
      ],
      note:
        product >= 1n << BigInt(width)
          ? "The full product needs more bits than the configured width. The low bits are what a fixed-width multiplier keeps."
          : "Each 1 in the multiplier adds a shifted copy of the multiplicand.",
    },
  ];
  return {
    pattern: bits(truncated, width).join(""),
    unsigned: truncated,
    overflow: product >= 1n << BigInt(width),
    steps,
  };
}

function divSteps(a: number, b: number, width: number) {
  if (b === 0) {
    return {
      pattern: "·".repeat(width),
      unsigned: 0,
      overflow: true,
      divZero: true,
      steps: [
        {
          label: "Undefined",
          rows: ["Divisor is 0"],
          note: "Division by zero has no binary quotient. The operation is left undefined.",
        },
      ],
    };
  }
  let remainder = 0;
  const quotient: Array<0 | 1> = [];
  const rows: string[] = [];
  const ba = bits(a, width);
  for (let i = 0; i < width; i += 1) {
    remainder = remainder * 2 + (ba[i] ?? 0);
    if (remainder >= b) {
      remainder -= b;
      quotient.push(1);
      rows.push(`Bit ${i}: remainder fits, quotient bit 1, remainder ${remainder}`);
    } else {
      quotient.push(0);
      rows.push(`Bit ${i}: remainder ${remainder} < ${b}, quotient bit 0`);
    }
  }
  const q = fromBits(quotient);
  return {
    pattern: quotient.join(""),
    unsigned: q,
    overflow: false,
    remainder: bits(remainder, width).join(""),
    steps: [
      {
        label: "Restoring division",
        rows: [...rows, `Quotient ${quotient.join("")}`, `Remainder ${bits(remainder, width).join("")}`],
        note: "The dividend is consumed from the left. Whenever the running remainder can hold the divisor, a quotient 1 is written.",
      },
    ],
  };
}
