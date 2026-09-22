import { chosenTransition } from "./transition";
import { addTransition, stateById, symbolsOf, type FsmMachine, type FsmState } from "./stateMachine";

export interface PartitionStep {
  label: string;
  blocks: string[][];
}

export interface MinimizationResult {
  ok: boolean;
  reason: string;
  steps: PartitionStep[];
  machine: FsmMachine | null;
  merged: number;
}

function blockKey(ids: string[]): string {
  return [...ids].sort().join("+");
}

function signature(machine: FsmMachine, stateId: string, symbols: string[], blockOf: Map<string, number>, mealy: boolean): string | null {
  const parts: string[] = [];
  for (const symbol of symbols) {
    const edge = chosenTransition(machine, stateId, symbol);
    if (!edge) return null;
    const extra = mealy ? edge.output : "";
    parts.push(`${blockOf.get(edge.to) ?? -1}:${extra}`);
  }
  return parts.join("|");
}

export function minimizeMachine(machine: FsmMachine): MinimizationResult {
  const symbols = symbolsOf(machine);
  for (const state of machine.states) {
    for (const symbol of symbols) {
      const matches = machine.transitions.filter((edge) => edge.from === state.id && (edge.when === symbol || edge.when === "*" || edge.when === "1" || edge.when === "0"));
      if (!chosenTransition(machine, state.id, symbol)) {
        return { ok: false, reason: `${state.name} has no transition for input ${symbol}.`, steps: [], machine: null, merged: 0 };
      }
      void matches;
    }
  }
  const mealy = machine.kind === "mealy";
  const initial = new Map<string, FsmState[]>();
  for (const state of machine.states) {
    const key = mealy
      ? symbols.map((symbol) => chosenTransition(machine, state.id, symbol)?.output ?? "").join("|")
      : state.output;
    initial.set(key, [...(initial.get(key) ?? []), state]);
  }
  let blocks = [...initial.values()].map((group) => group.map((state) => state.id));
  const steps: PartitionStep[] = [{ label: mealy ? "Grouped by transition outputs" : "Grouped by Moore output", blocks: blocks.map((block) => [...block]) }];
  let changed = true;
  let round = 0;
  while (changed && round < machine.states.length + 1) {
    changed = false;
    round += 1;
    const blockOf = new Map<string, number>();
    blocks.forEach((block, index) => block.forEach((id) => blockOf.set(id, index)));
    const next: string[][] = [];
    for (const block of blocks) {
      const buckets = new Map<string, string[]>();
      for (const id of block) {
        const sig = signature(machine, id, symbols, blockOf, false);
        if (sig === null) return { ok: false, reason: "The machine is not complete for every input symbol.", steps, machine: null, merged: 0 };
        buckets.set(sig, [...(buckets.get(sig) ?? []), id]);
      }
      if (buckets.size > 1) changed = true;
      next.push(...buckets.values());
    }
    blocks = next;
    if (changed) steps.push({ label: `Refinement ${round}`, blocks: blocks.map((block) => [...block]) });
  }
  const names = new Map(blocks.map((block) => [blockKey(block), block.map((id) => stateById(machine, id)?.name ?? id).join("/")]));
  let reduced: FsmMachine = {
    ...machine,
    name: `${machine.name} minimized`,
    states: [],
    transitions: [],
    initialId: "",
  };
  const idOf = new Map<string, string>();
  blocks.forEach((block, index) => {
    const id = `m${index}`;
    const sample = stateById(machine, block[0] ?? "");
    reduced = {
      ...reduced,
      states: [...reduced.states, {
        id,
        name: names.get(blockKey(block)) ?? `M${index}`,
        x: 70 + (index % 4) * 130,
        y: 90 + Math.floor(index / 4) * 100,
        output: sample?.output ?? "0",
      }],
    };
    for (const old of block) idOf.set(old, id);
  });
  reduced.initialId = idOf.get(machine.initialId) ?? reduced.states[0]?.id ?? "";
  const seen = new Set<string>();
  for (const block of blocks) {
    const from = idOf.get(block[0] ?? "") ?? "";
    for (const symbol of symbols) {
      const edge = chosenTransition(machine, block[0] ?? "", symbol);
      if (!edge) continue;
      const to = idOf.get(edge.to) ?? from;
      const key = `${from}|${symbol}|${to}|${edge.output}`;
      if (seen.has(key)) continue;
      seen.add(key);
      reduced = addTransition(reduced, from, to, symbol, edge.output);
    }
  }
  return {
    ok: true,
    reason: blocks.length === machine.states.length ? "No equivalent states. The machine is already minimal." : `Merged ${machine.states.length - blocks.length} equivalent state${machine.states.length - blocks.length === 1 ? "" : "s"}.`,
    steps,
    machine: reduced,
    merged: machine.states.length - blocks.length,
  };
}
