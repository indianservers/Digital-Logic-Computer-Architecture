import type { LogicBit } from "../../types/logic";
import { quineMcCluskey } from "../kmap/quine";
import { fromUnsigned, toBinary, toUnsigned } from "./vector";

export type Level = 0 | 1 | "X";
export type Edge = "rise" | "fall";

export interface PairState {
  q: Level;
  qn: Level;
  label: "hold" | "set" | "reset" | "invalid" | "transparent" | "toggle";
}

function pair(q: Level, label: PairState["label"]): PairState {
  return { q, qn: q === "X" ? "X" : q === 1 ? 0 : 1, label };
}

export function rising(prev: LogicBit, next: LogicBit): boolean {
  return prev === 0 && next === 1;
}

export function falling(prev: LogicBit, next: LogicBit): boolean {
  return prev === 1 && next === 0;
}

export function activeEdge(prev: LogicBit, next: LogicBit, edge: Edge): boolean {
  return edge === "rise" ? rising(prev, next) : falling(prev, next);
}

/** Cross-coupled NOR. S and R are active high. S=R=1 forces both outputs low. */
export function srNor(s: LogicBit, r: LogicBit, q: Level): PairState {
  if (s === "X" || s === "Z" || r === "X" || r === "Z") return pair("X", "invalid");
  if (s === 1 && r === 1) return { q: 0, qn: 0, label: "invalid" };
  if (s === 1 && r === 0) return pair(1, "set");
  if (s === 0 && r === 1) return pair(0, "reset");
  if (q === "X") return pair("X", "hold");
  return pair(q, "hold");
}

/** Cross-coupled NAND. Inputs are active low. Both low is invalid. */
export function srNand(sBar: LogicBit, rBar: LogicBit, q: Level): PairState {
  if (sBar === "X" || sBar === "Z" || rBar === "X" || rBar === "Z") return pair("X", "invalid");
  if (sBar === 0 && rBar === 0) return { q: 1, qn: 1, label: "invalid" };
  if (sBar === 0 && rBar === 1) return pair(1, "set");
  if (sBar === 1 && rBar === 0) return pair(0, "reset");
  if (q === "X") return pair("X", "hold");
  return pair(q, "hold");
}

export function gatedSr(s: LogicBit, r: LogicBit, enable: LogicBit, q: Level): PairState {
  if (enable === 0) return q === "X" ? pair("X", "hold") : pair(q, "hold");
  if (enable !== 1) return pair("X", "invalid");
  return srNor(s, r, q);
}

export function dLatch(d: LogicBit, enable: LogicBit, q: Level): PairState {
  if (enable === 1) {
    if (d !== 0 && d !== 1) return pair("X", "transparent");
    return pair(d, "transparent");
  }
  if (enable === 0) return q === "X" ? pair("X", "hold") : pair(q, "hold");
  return pair("X", "invalid");
}

export function dFlipFlop(d: LogicBit, clock: LogicBit, prevClock: LogicBit, q: Level, edge: Edge, reset: LogicBit = 0): PairState {
  if (reset === 1) return pair(0, "reset");
  if (!activeEdge(prevClock, clock, edge)) return q === "X" ? pair("X", "hold") : pair(q, "hold");
  if (d !== 0 && d !== 1) return pair("X", "invalid");
  return pair(d, "set");
}

export function srFlipFlop(s: LogicBit, r: LogicBit, clock: LogicBit, prevClock: LogicBit, q: Level, edge: Edge): PairState {
  if (!activeEdge(prevClock, clock, edge)) return q === "X" ? pair("X", "hold") : pair(q, "hold");
  return srNor(s, r, q);
}

export function jkFlipFlop(j: LogicBit, k: LogicBit, clock: LogicBit, prevClock: LogicBit, q: Level, edge: Edge): PairState {
  if (!activeEdge(prevClock, clock, edge)) return q === "X" ? pair("X", "hold") : pair(q, "hold");
  if (j === 0 && k === 0) return q === "X" ? pair("X", "hold") : pair(q, "hold");
  if (j === 0 && k === 1) return pair(0, "reset");
  if (j === 1 && k === 0) return pair(1, "set");
  if (j === 1 && k === 1) {
    if (q === "X") return pair("X", "toggle");
    return pair(q === 1 ? 0 : 1, "toggle");
  }
  return pair("X", "invalid");
}

export function tFlipFlop(t: LogicBit, clock: LogicBit, prevClock: LogicBit, q: Level, edge: Edge): PairState {
  if (!activeEdge(prevClock, clock, edge)) return q === "X" ? pair("X", "hold") : pair(q, "hold");
  if (t === 0) return q === "X" ? pair("X", "hold") : pair(q, "hold");
  if (t === 1) {
    if (q === "X") return pair("X", "toggle");
    return pair(q === 1 ? 0 : 1, "toggle");
  }
  return pair("X", "invalid");
}

/** JK master follows while clock is high. Slave copies master on the falling edge. */
export function masterSlaveJk(j: LogicBit, k: LogicBit, clock: LogicBit, prevClock: LogicBit, master: Level, slave: Level): { master: Level; slave: Level; label: string } {
  let nextMaster = master;
  if (clock === 1) {
    const sampled = jkFlipFlop(j, k, 1, 0, slave, "rise");
    nextMaster = sampled.q;
  }
  if (falling(prevClock, clock)) {
    return { master: nextMaster, slave: nextMaster, label: "Slave copies the master" };
  }
  return { master: nextMaster, slave, label: clock === 1 ? "Master is transparent" : "Both stages hold" };
}

export const CHARACTERISTIC: Record<"SR" | "D" | "JK" | "T", string[][]> = {
  SR: [["S", "R", "Q+", "Note"], ["0", "0", "Q", "Hold"], ["0", "1", "0", "Reset"], ["1", "0", "1", "Set"], ["1", "1", "—", "Invalid"]],
  D: [["D", "Q+", "Note"], ["0", "0", "Copies D"], ["1", "1", "Copies D"]],
  JK: [["J", "K", "Q+", "Note"], ["0", "0", "Q", "Hold"], ["0", "1", "0", "Reset"], ["1", "0", "1", "Set"], ["1", "1", "Q'", "Toggle"]],
  T: [["T", "Q+", "Note"], ["0", "Q", "Hold"], ["1", "Q'", "Toggle"]],
};

export function excitation(kind: "SR" | "D" | "JK" | "T", q: 0 | 1, next: 0 | 1): Record<string, string> {
  if (kind === "D") return { D: String(next) };
  if (kind === "T") return { T: q === next ? "0" : "1" };
  if (kind === "JK") {
    if (q === 0 && next === 0) return { J: "0", K: "X" };
    if (q === 0 && next === 1) return { J: "1", K: "X" };
    if (q === 1 && next === 0) return { J: "X", K: "1" };
    return { J: "X", K: "0" };
  }
  if (q === 0 && next === 0) return { S: "0", R: "X" };
  if (q === 0 && next === 1) return { S: "1", R: "0" };
  if (q === 1 && next === 0) return { S: "0", R: "1" };
  return { S: "X", R: "0" };
}

export const CONVERSIONS: Array<{ id: string; source: string; target: string; equations: string[]; note: string }> = [
  { id: "jk-d", source: "JK", target: "D", equations: ["J = D", "K = D'"], note: "D drives J and the complement drives K, so the pair never asks for an invalid SR-style input." },
  { id: "d-t", source: "D", target: "T", equations: ["D = T XOR Q"], note: "T = 1 presents the complement of Q. T = 0 presents Q." },
  { id: "jk-t", source: "JK", target: "T", equations: ["J = T", "K = T"], note: "Tie J and K together. T = 1 toggles. T = 0 holds." },
  { id: "sr-d", source: "SR", target: "D", equations: ["S = D", "R = D'"], note: "Complementary S and R avoid the S = R = 1 input." },
];

export type RegOp = "hold" | "shift-left" | "shift-right" | "load" | "ring" | "johnson";

export function stepRegister(q: Array<0 | 1>, op: RegOp, serialIn: 0 | 1, parallel?: Array<0 | 1>): { q: Array<0 | 1>; serialOut: 0 | 1 } {
  if (op === "load" && parallel && parallel.length === q.length) return { q: [...parallel], serialOut: q[q.length - 1] ?? 0 };
  if (op === "hold") return { q: [...q], serialOut: q[q.length - 1] ?? 0 };
  if (op === "shift-left") return { q: [...q.slice(1), serialIn], serialOut: q[0] ?? 0 };
  if (op === "shift-right") return { q: [serialIn, ...q.slice(0, -1)], serialOut: q[q.length - 1] ?? 0 };
  if (op === "ring") {
    const last = q[q.length - 1] ?? 0;
    return { q: [last, ...q.slice(0, -1)], serialOut: last };
  }
  const feedback = (q[q.length - 1] ?? 0) === 1 ? 0 : 1;
  return { q: [feedback, ...q.slice(0, -1)], serialOut: q[q.length - 1] ?? 0 };
}

export function nextCount(value: number, modulus: number, direction: "up" | "down"): number {
  const mod = Math.max(2, modulus);
  const current = ((value % mod) + mod) % mod;
  if (direction === "down") return current === 0 ? mod - 1 : current - 1;
  return (current + 1) % mod;
}

export function counterWidth(modulus: number): number {
  return Math.max(1, Math.ceil(Math.log2(Math.max(2, modulus))));
}

export function rippleDelays(before: number, after: number, width: number): Array<{ bit: number; delay: number }> {
  const delays: Array<{ bit: number; delay: number }> = [];
  for (let bit = 0; bit < width; bit += 1) {
    const mask = 1 << bit;
    if ((before & mask) !== (after & mask)) delays.push({ bit, delay: bit + 1 });
  }
  return delays;
}

export interface DesignedBit {
  name: string;
  expression: string;
  input: string;
}

export function designCounter(sequence: number[], width: number, kind: "D" | "JK"): { rows: Array<{ state: number; next: number }>; bits: DesignedBit[]; unused: number[] } {
  const limit = 2 ** width;
  const used = sequence.filter((state) => state >= 0 && state < limit);
  const nextOf = new Map(used.map((state, index) => [state, used[(index + 1) % used.length] ?? state]));
  const unused = Array.from({ length: limit }, (_, state) => state).filter((state) => !nextOf.has(state));
  const names = Array.from({ length: width }, (_, index) => `Q${width - 1 - index}`);
  const bits: DesignedBit[] = [];
  for (let bit = 0; bit < width; bit += 1) {
    const mask = 1 << bit;
    const ones: number[] = [];
    const dont: number[] = [...unused];
    for (const state of used) {
      const current = (state & mask) !== 0;
      const next = ((nextOf.get(state) ?? state) & mask) !== 0;
      if (kind === "D") {
        if (next) ones.push(state);
      } else if (!current && next) ones.push(state);
      else if (current) dont.push(state);
    }
    const input = kind === "D" ? "D" : "J";
    const solved = quineMcCluskey(ones, dont, width, names);
    bits.push({ name: `Q${bit}`, expression: solved.expression, input });
    if (kind === "JK") {
      const kOnes: number[] = [];
      const kDont: number[] = [...unused];
      for (const state of used) {
        const current = (state & mask) !== 0;
        const next = ((nextOf.get(state) ?? state) & mask) !== 0;
        if (current && !next) kOnes.push(state);
        else if (!current) kDont.push(state);
      }
      const kSolved = quineMcCluskey(kOnes, kDont, width, names);
      bits.push({ name: `Q${bit}`, expression: kSolved.expression, input: "K" });
    }
  }
  return {
    rows: used.map((state) => ({ state, next: nextOf.get(state) ?? state })),
    bits,
    unused,
  };
}

export function wordOf(value: number, width: number): string {
  return toBinary(fromUnsigned(value, width));
}

export function valueOf(bits: Array<0 | 1>): number {
  return toUnsigned(bits) ?? 0;
}
