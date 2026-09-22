import { quineMcCluskey } from "../kmap/quine";
import { encodeStates } from "./encoding";
import { chosenTransition } from "./transition";
import { symbolsOf, type FsmMachine } from "./stateMachine";

export interface SynthesisResult {
  ok: boolean;
  reason: string;
  encoding: string[];
  variables: string[];
  equations: Array<{ signal: string; expression: string }>;
  flipFlops: number;
  rows: Array<{ present: string; input: string; next: string; output: string }>;
}

function bitString(value: number, width: number): string {
  return value.toString(2).padStart(width, "0");
}

export function synthesizeD(machine: FsmMachine): SynthesisResult {
  const symbols = symbolsOf(machine);
  const encoding = encodeStates(machine, "binary");
  const codeOf = new Map(encoding.states.map((state) => [state.id, state.code]));
  const indexOf = new Map(machine.states.map((state, index) => [state.id, index]));
  const inputBits = symbols[0]?.length ?? 1;
  const stateBits = encoding.width;
  const width = stateBits + inputBits;
  if (width > 8 || machine.states.length === 0) {
    return { ok: false, reason: "Synthesis is shown for machines of up to 8 encoding bits.", encoding: [], variables: [], equations: [], flipFlops: 0, rows: [] };
  }
  for (const state of machine.states) {
    for (const symbol of symbols) {
      if (!chosenTransition(machine, state.id, symbol)) {
        return { ok: false, reason: `${state.name} needs a transition for ${symbol} before D flip-flop equations can be built.`, encoding: [], variables: [], equations: [], flipFlops: stateBits, rows: [] };
      }
    }
  }
  const names = [
    ...Array.from({ length: stateBits }, (_, index) => `Q${stateBits - 1 - index}`),
    ...(machine.inputs.length === inputBits ? machine.inputs : Array.from({ length: inputBits }, (_, index) => `x${index}`)),
  ];
  const rows: SynthesisResult["rows"] = [];
  const ones: number[][] = Array.from({ length: stateBits }, () => []);
  const outputOnes: number[][] = [];
  const outputWidth = Math.max(...machine.states.map((state) => state.output.length), ...machine.transitions.map((edge) => edge.output.length), 1);
  for (let bit = 0; bit < outputWidth; bit += 1) outputOnes.push([]);
  const used = new Set<number>();
  for (const state of machine.states) {
    const present = indexOf.get(state.id) ?? 0;
    for (const symbol of symbols) {
      const edge = chosenTransition(machine, state.id, symbol);
      const nextIndex = indexOf.get(edge?.to ?? state.id) ?? 0;
      const inputValue = Number.parseInt(symbol, 2);
      const minterm = (present << inputBits) | inputValue;
      used.add(minterm);
      const nextCode = bitString(nextIndex, stateBits);
      const output = machine.kind === "moore" ? state.output.padStart(outputWidth, "0") : (edge?.output ?? "0").padStart(outputWidth, "0");
      rows.push({ present: codeOf.get(state.id) ?? bitString(present, stateBits), input: symbol, next: nextCode, output });
      nextCode.split("").forEach((bit, index) => {
        if (bit === "1") ones[index]?.push(minterm);
      });
      output.split("").forEach((bit, index) => {
        if (bit === "1") outputOnes[index]?.push(minterm);
      });
    }
  }
  const donts = Array.from({ length: 2 ** width }, (_, index) => index).filter((index) => !used.has(index));
  const equations = ones.map((minterms, index) => ({
    signal: `D${stateBits - 1 - index}`,
    expression: quineMcCluskey(minterms, donts, width, names).expression,
  }));
  outputOnes.forEach((minterms, index) => {
    equations.push({
      signal: outputWidth === 1 ? "Y" : `Y${outputWidth - 1 - index}`,
      expression: quineMcCluskey(minterms, donts, width, names).expression,
    });
  });
  return {
    ok: true,
    reason: `${stateBits} D flip-flop${stateBits === 1 ? "" : "s"} store the binary state code. Each D input is the next value of that bit.`,
    encoding: encoding.states.map((state) => `${state.name} = ${state.code}`),
    variables: names,
    equations,
    flipFlops: stateBits,
    rows,
  };
}
