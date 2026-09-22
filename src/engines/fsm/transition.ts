import { evalBoolean, parseBoolean } from "../boolean/ast";
import type { FsmMachine, FsmTransition } from "./stateMachine";

export function assignmentFor(machine: FsmMachine, symbol: string): Record<string, 0 | 1> {
  const assign: Record<string, 0 | 1> = {};
  const names = machine.inputs.length > 0 ? machine.inputs : ["x"];
  const bits = symbol.padStart(names.length, "0");
  names.forEach((name, index) => {
    assign[name] = bits[index] === "1" ? 1 : 0;
  });
  if (names.length === 1) {
    const name = names[0] ?? "x";
    assign[name] = symbol.endsWith("1") ? 1 : 0;
  }
  return assign;
}

export function conditionMatches(machine: FsmMachine, when: string, symbol: string): boolean {
  const text = when.trim();
  if (text === "*" || text.toLowerCase() === "true") return true;
  if (text.toLowerCase() === "false") return false;
  if (text === symbol) return true;
  const equality = text.match(/^([A-Za-z_]\w*)\s*={1,2}\s*([01]+)$/);
  if (equality) {
    const name = equality[1] ?? "";
    const expected = equality[2] ?? "";
    const names = machine.inputs.length > 0 ? machine.inputs : ["x"];
    if (names.length === 1 && names[0] === name) return symbol === expected || symbol.endsWith(expected);
    const assign = assignmentFor(machine, symbol);
    if (expected.length === 1) return assign[name] === (expected === "1" ? 1 : 0);
    const actual = names.map((input) => String(assign[input] ?? 0)).join("");
    return actual === expected;
  }
  if (text === "0" || text === "1") return symbol === text || (symbol.length === 1 && symbol === text);
  try {
    const parsed = parseBoolean(text.replace(/&&/g, " AND ").replace(/\|\|/g, " OR ").replace(/!/g, " NOT "));
    return evalBoolean(parsed.ast, assignmentFor(machine, symbol)) === 1;
  } catch {
    return false;
  }
}

export function transitionsFrom(machine: FsmMachine, stateId: string, symbol: string): FsmTransition[] {
  return machine.transitions.filter((edge) => edge.from === stateId && conditionMatches(machine, edge.when, symbol));
}

export function chosenTransition(machine: FsmMachine, stateId: string, symbol: string): FsmTransition | null {
  const matches = transitionsFrom(machine, stateId, symbol);
  return matches.find((edge) => edge.when.trim() === symbol) ?? matches[0] ?? null;
}
