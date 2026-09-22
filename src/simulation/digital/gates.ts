import type { GateKind, LogicValue } from "../../types/logic";

function bad(values: LogicValue[]): boolean {
  return values.some((value) => value === "X" || value === "Z");
}

export function evalGate(kind: GateKind, inputs: LogicValue[]): LogicValue {
  if (kind === "TRI") {
    const data = inputs[0] ?? "X";
    const enable = inputs[1] ?? "X";
    if (enable === 0) return "Z";
    if (enable === "X" || enable === "Z") return "X";
    return data;
  }
  if (kind === "BUF") return inputs[0] ?? "X";
  if (kind === "NOT") {
    const value = inputs[0] ?? "X";
    if (value === 0) return 1;
    if (value === 1) return 0;
    return "X";
  }
  if (bad(inputs) || inputs.length === 0) {
    if (kind === "AND" || kind === "NAND") {
      if (inputs.some((value) => value === 0)) return kind === "AND" ? 0 : 1;
    }
    if (kind === "OR" || kind === "NOR") {
      if (inputs.some((value) => value === 1)) return kind === "OR" ? 1 : 0;
    }
    return "X";
  }
  const bits = inputs as Array<0 | 1>;
  switch (kind) {
    case "AND":
      return bits.every((bit) => bit === 1) ? 1 : 0;
    case "NAND":
      return bits.every((bit) => bit === 1) ? 0 : 1;
    case "OR":
      return bits.some((bit) => bit === 1) ? 1 : 0;
    case "NOR":
      return bits.some((bit) => bit === 1) ? 0 : 1;
    case "XOR":
      return bits.reduce<number>((sum, bit) => sum ^ bit, 0) === 1 ? 1 : 0;
    case "XNOR":
      return bits.reduce<number>((sum, bit) => sum ^ bit, 0) === 1 ? 0 : 1;
    default:
      return "X";
  }
}

export function resolveDrivers(drivers: LogicValue[]): LogicValue {
  const driving = drivers.filter((value) => value !== "Z");
  if (driving.length === 0) return "Z";
  if (driving.every((value) => value === 0)) return 0;
  if (driving.every((value) => value === 1)) return 1;
  return "X";
}

export interface DelaySample {
  timeNs: number;
  output: LogicValue;
}

/** Educational timeline: the output changes `delayNs` after the input transition. */
export function propagateDelay(previous: LogicValue, next: LogicValue, delayNs: number, horizonNs: number): DelaySample[] {
  const samples: DelaySample[] = [{ timeNs: 0, output: previous }];
  if (next !== previous) samples.push({ timeNs: delayNs, output: next });
  if (horizonNs > (samples[samples.length - 1]?.timeNs ?? 0)) {
    samples.push({ timeNs: horizonNs, output: next });
  }
  return samples;
}

export const GATE_EXPRESSIONS: Record<GateKind, (names: string[]) => string> = {
  BUF: (n) => n[0] ?? "A",
  NOT: (n) => `${n[0] ?? "A"}'`,
  AND: (n) => n.join(" · "),
  OR: (n) => n.join(" + "),
  NAND: (n) => `(${n.join(" · ")})'`,
  NOR: (n) => `(${n.join(" + ")})'`,
  XOR: (n) => n.join(" ⊕ "),
  XNOR: (n) => `(${n.join(" ⊕ ")})'`,
  TRI: (n) => `${n[1] ?? "EN"} ? ${n[0] ?? "D"} : Z`,
};
