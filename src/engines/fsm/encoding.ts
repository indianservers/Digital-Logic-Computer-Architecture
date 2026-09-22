import type { FsmMachine } from "./stateMachine";

export type EncodingKind = "binary" | "one-hot" | "custom";

export interface EncodedState {
  id: string;
  name: string;
  code: string;
}

export interface Encoding {
  kind: EncodingKind;
  width: number;
  flipFlops: number;
  states: EncodedState[];
  note: string;
}

function bits(value: number, width: number): string {
  return value.toString(2).padStart(width, "0");
}

export function binaryWidth(count: number): number {
  if (count <= 1) return 1;
  return Math.ceil(Math.log2(count));
}

export function encodeStates(machine: FsmMachine, kind: EncodingKind, custom: Record<string, string> = {}): Encoding {
  const count = machine.states.length;
  if (kind === "one-hot") {
    const states = machine.states.map((state, index) => {
      const code = Array.from({ length: Math.max(1, count) }, () => "0");
      code[Math.max(0, count - 1 - index)] = "1";
      return { id: state.id, name: state.name, code: code.join("") };
    });
    return {
      kind,
      width: Math.max(1, count),
      flipFlops: Math.max(1, count),
      states,
      note: "One-hot uses one flip-flop per state. Next-state logic is often simpler, and the register is wider.",
    };
  }
  if (kind === "custom") {
    const states = machine.states.map((state, index) => ({
      id: state.id,
      name: state.name,
      code: custom[state.id] ?? bits(index, binaryWidth(count)),
    }));
    const width = Math.max(1, ...states.map((state) => state.code.length));
    return {
      kind,
      width,
      flipFlops: width,
      states,
      note: "Custom assignment changes the next-state equations. It does not change the machine's behavior.",
    };
  }
  const width = binaryWidth(count);
  return {
    kind: "binary",
    width,
    flipFlops: width,
    states: machine.states.map((state, index) => ({ id: state.id, name: state.name, code: bits(index, width) })),
    note: "Binary encoding uses the fewest flip-flops. The combinational logic can be denser than one-hot.",
  };
}
