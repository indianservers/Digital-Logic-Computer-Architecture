export type Bit = 0 | 1;

export interface HammingWord {
  /** Index 0 is position 1. Parity bits sit at power-of-two positions. */
  bits: Bit[];
  data: Bit[];
  parityPositions: number[];
  dataPositions: number[];
}

export interface SyndromeResult {
  syndrome: number;
  bits: string;
  corrected: Bit[];
  flippedIndex: number | null;
  groups: Array<{ parityPosition: number; covers: number[]; ok: boolean }>;
  explanation: string;
}

function isParityPosition(position: number): boolean {
  return position > 0 && (position & (position - 1)) === 0;
}

export function hammingLayout(dataBits: number): { total: number; parityPositions: number[]; dataPositions: number[] } {
  let parity = 0;
  while (2 ** parity < dataBits + parity + 1) parity += 1;
  const total = dataBits + parity;
  const parityPositions: number[] = [];
  const dataPositions: number[] = [];
  for (let position = 1; position <= total; position += 1) {
    if (isParityPosition(position)) parityPositions.push(position);
    else dataPositions.push(position);
  }
  return { total, parityPositions, dataPositions };
}

export function encodeHamming(data: Bit[]): HammingWord {
  const layout = hammingLayout(data.length);
  const bits: Bit[] = new Array(layout.total).fill(0);
  data.forEach((bit, index) => {
    const position = layout.dataPositions[index];
    if (position === undefined) return;
    bits[position - 1] = bit;
  });
  for (const position of layout.parityPositions) {
    bits[position - 1] = evenParity(bits, position);
  }
  return { bits, data: [...data], parityPositions: layout.parityPositions, dataPositions: layout.dataPositions };
}

function evenParity(bits: Bit[], parityPosition: number): Bit {
  let xor = 0;
  for (let position = 1; position <= bits.length; position += 1) {
    if (position === parityPosition) continue;
    if ((position & parityPosition) !== 0 && bits[position - 1] === 1) xor ^= 1;
  }
  return xor as Bit;
}

export function coverage(total: number, parityPosition: number): number[] {
  const covers: number[] = [];
  for (let position = 1; position <= total; position += 1) {
    if ((position & parityPosition) !== 0) covers.push(position);
  }
  return covers;
}

export function syndromeOf(bits: Bit[]): SyndromeResult {
  const parityPositions = hammingLayout(bits.filter((_, index) => !isParityPosition(index + 1)).length).parityPositions;
  let syndrome = 0;
  const groups = parityPositions.map((position) => {
    const covers = coverage(bits.length, position);
    let xor = 0;
    for (const covered of covers) {
      if (bits[covered - 1] === 1) xor ^= 1;
    }
    const ok = xor === 0;
    if (!ok) syndrome += position;
    return { parityPosition: position, covers, ok };
  });
  const corrected = [...bits];
  let flippedIndex: number | null = null;
  let explanation = "Every parity group checks out. No single-bit error is present.";
  if (syndrome > 0 && syndrome <= bits.length) {
    flippedIndex = syndrome - 1;
    const current = corrected[flippedIndex] ?? 0;
    corrected[flippedIndex] = current === 1 ? 0 : 1;
    explanation = `Parity groups that fail point at positions whose numbers add up to ${syndrome}. Position ${syndrome} is the only bit shared by exactly those failing groups.`;
  } else if (syndrome > bits.length) {
    explanation = "The syndrome does not name a bit inside this word. More than one bit may be wrong; Hamming(7,4) corrects only a single error.";
  }
  return {
    syndrome,
    bits: syndrome.toString(2).padStart(parityPositions.length, "0"),
    corrected,
    flippedIndex,
    groups,
    explanation,
  };
}

export function flipBit(bits: Bit[], index: number): Bit[] {
  return bits.map((bit, i) => (i === index ? (bit === 1 ? 0 : 1) : bit));
}
