import { stateById, type FsmMachine } from "./stateMachine";
import { chosenTransition } from "./transition";

export interface FsmStep {
  fromId: string;
  fromName: string;
  symbol: string;
  toId: string;
  toName: string;
  output: string;
  transitionId: string | null;
  explain: string;
  stalled: boolean;
}

export function outputOf(machine: FsmMachine, stateId: string, symbol: string | null): string {
  const state = stateById(machine, stateId);
  if (machine.kind === "moore") return state?.output ?? "0";
  if (symbol === null) return "0";
  return chosenTransition(machine, stateId, symbol)?.output ?? "0";
}

export function stepMachine(machine: FsmMachine, stateId: string, symbol: string): FsmStep {
  const from = stateById(machine, stateId);
  const edge = chosenTransition(machine, stateId, symbol);
  const to = stateById(machine, edge?.to ?? stateId);
  const stalled = edge === null;
  const output = machine.kind === "moore" ? (to?.output ?? "0") : (edge?.output ?? "0");
  const fromName = from?.name ?? stateId;
  const toName = to?.name ?? stateId;
  const explain = stalled
    ? `No transition from ${fromName} matches input ${symbol}, so the machine stays in ${fromName}.`
    : machine.kind === "moore"
      ? `Input ${symbol} takes ${fromName} → ${toName}. Moore output ${output} comes from ${toName}.`
      : `Input ${symbol} takes ${fromName} → ${toName}. Mealy output ${output} comes from that transition.`;
  return {
    fromId: stateId,
    fromName,
    symbol,
    toId: to?.id ?? stateId,
    toName,
    output,
    transitionId: edge?.id ?? null,
    explain,
    stalled,
  };
}

export function runSequence(machine: FsmMachine, symbols: string[], startId = machine.initialId): FsmStep[] {
  const steps: FsmStep[] = [];
  let current = startId;
  for (const symbol of symbols) {
    const step = stepMachine(machine, current, symbol);
    steps.push(step);
    current = step.toId;
  }
  return steps;
}

export function parseStream(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.includes(",") || trimmed.includes(" ")) {
    return trimmed.split(/[\s,]+/).filter(Boolean);
  }
  return trimmed.split("");
}
