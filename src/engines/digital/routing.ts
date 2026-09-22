import type { LogicBit, LogicVector } from "../../types/logic";
import { grayBits } from "../numbers/codes";
import { fromUnsigned, isBit, toUnsigned, zeros } from "./vector";

export function selectIndex(select: LogicVector): number | null {
  const value = toUnsigned(select);
  return value;
}

export function mux(inputs: LogicBit[], select: LogicVector): { y: LogicBit; index: number | null } {
  const index = selectIndex(select);
  if (index === null || index < 0 || index >= inputs.length) return { y: "X", index: null };
  return { y: inputs[index] ?? "X", index };
}

export interface MuxStage {
  name: string;
  chosen: number;
}

/** 8:1 built from two 4:1 multiplexers and one 2:1, select is S2 S1 S0 MSB first. */
export function cascadedMux(inputs: LogicBit[], select: LogicVector): { y: LogicBit; stages: MuxStage[] } {
  const padded = [...inputs, ...Array.from({ length: Math.max(0, 8 - inputs.length) }, () => 0 as LogicBit)].slice(0, 8);
  const bits = select.length >= 3 ? select.slice(select.length - 3) : [...zeros(3 - select.length), ...select];
  const low = mux(padded.slice(0, 4), bits.slice(1));
  const high = mux(padded.slice(4), bits.slice(1));
  const top = mux([low.y, high.y], bits.slice(0, 1));
  return {
    y: top.y,
    stages: [
      { name: "Lower 4:1", chosen: low.index ?? -1 },
      { name: "Upper 4:1", chosen: high.index ?? -1 },
      { name: "Final 2:1", chosen: top.index ?? -1 },
    ],
  };
}

export function demux(data: LogicBit, select: LogicVector, outputs: number): LogicVector {
  const index = selectIndex(select);
  return Array.from({ length: outputs }, (_, slot) => {
    if (index === null) return "X";
    return slot === index ? data : 0;
  });
}

export function encoder(inputs: LogicBit[]): { y: LogicVector; valid: 0 | 1; invalid: boolean } {
  const width = Math.max(1, Math.ceil(Math.log2(Math.max(2, inputs.length))));
  const active = inputs.flatMap((bit, index) => (bit === 1 ? [index] : []));
  if (active.length !== 1) return { y: zeros(width).map(() => "X"), valid: 0, invalid: true };
  return { y: fromUnsigned(active[0] ?? 0, width), valid: 1, invalid: false };
}

export function priorityEncoder(inputs: LogicBit[]): { y: LogicVector; valid: 0 | 1; winner: number | null; ignored: number[] } {
  const width = Math.max(1, Math.ceil(Math.log2(Math.max(2, inputs.length))));
  let winner: number | null = null;
  for (let index = inputs.length - 1; index >= 0; index -= 1) {
    if (inputs[index] === 1) {
      winner = index;
      break;
    }
  }
  if (winner === null) return { y: zeros(width), valid: 0, winner: null, ignored: [] };
  const ignored = inputs.flatMap((bit, index) => (bit === 1 && index !== winner ? [index] : []));
  return { y: fromUnsigned(winner, width), valid: 1, winner, ignored };
}

export function decoder(select: LogicVector, enable: LogicBit = 1): LogicVector {
  const size = 2 ** select.length;
  if (enable === 0) return zeros(size);
  const index = selectIndex(select);
  if (index === null || enable === "X" || enable === "Z") return Array.from({ length: size }, () => "X");
  return Array.from({ length: size }, (_, slot) => (slot === index ? 1 : 0));
}

const SEVEN: Record<number, string> = {
  0: "1111110",
  1: "0110000",
  2: "1101101",
  3: "1111001",
  4: "0110011",
  5: "1011011",
  6: "1011111",
  7: "1110000",
  8: "1111111",
  9: "1111011",
};

export const SEGMENT_NAMES = ["a", "b", "c", "d", "e", "f", "g"] as const;

export function bcdToSeven(nibble: LogicVector): { segments: Array<0 | 1>; valid: boolean; digit: number | null } {
  const value = toUnsigned(nibble.slice(0, 4));
  if (value === null || value > 9) return { segments: [0, 0, 0, 0, 0, 0, 0], valid: false, digit: null };
  const pattern = SEVEN[value] ?? "0000000";
  return { segments: [...pattern].map((bit) => (bit === "1" ? 1 : 0)), valid: true, digit: value };
}

export function binaryToGrayCircuit(bits: Array<0 | 1>): { gray: Array<0 | 1>; gates: string[] } {
  const gray = grayBits(bits);
  const gates = bits.map((_, index) => (index === 0 ? `G${index} = B${index}` : `G${index} = B${index - 1} XOR B${index}`));
  return { gray, gates: gates.map((gate, index) => (index === 0 ? `MSB passes through (${bitLabel(bits[0] ?? 0)})` : gate)) };
}

function bitLabel(bit: 0 | 1): string {
  return bit === 1 ? "1" : "0";
}

export function excess3Circuit(digit: number): { bcd: LogicVector; plus3: LogicVector; result: LogicVector } | null {
  if (digit < 0 || digit > 9) return null;
  const bcd = fromUnsigned(digit, 4);
  const plus3 = fromUnsigned(3, 4);
  return { bcd, plus3, result: fromUnsigned(digit + 3, 4) };
}

export function muxImplements(mintermValues: Array<0 | 1 | "C" | "C'">): string[] {
  return mintermValues.map((value, index) => `I${index} = ${value}`);
}

export function knownBit(value: LogicBit): value is 0 | 1 {
  return isBit(value);
}
