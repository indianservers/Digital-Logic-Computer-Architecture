export type FsmKind = "moore" | "mealy";

export interface FsmState {
  id: string;
  name: string;
  x: number;
  y: number;
  output: string;
}

export interface FsmTransition {
  id: string;
  from: string;
  to: string;
  when: string;
  output: string;
}

export interface FsmMachine {
  name: string;
  kind: FsmKind;
  inputs: string[];
  states: FsmState[];
  transitions: FsmTransition[];
  initialId: string;
}

let seq = 1;

export function nextId(prefix: string): string {
  seq += 1;
  return `${prefix}${seq}`;
}

export function blankMachine(): FsmMachine {
  const s0 = "s0";
  const s1 = "s1";
  return {
    name: "New machine",
    kind: "moore",
    inputs: ["x"],
    states: [
      { id: s0, name: "S0", x: 80, y: 120, output: "0" },
      { id: s1, name: "S1", x: 260, y: 120, output: "1" },
    ],
    transitions: [
      { id: "t0", from: s0, to: s1, when: "1", output: "0" },
      { id: "t1", from: s1, to: s0, when: "0", output: "1" },
      { id: "t2", from: s0, to: s0, when: "0", output: "0" },
      { id: "t3", from: s1, to: s1, when: "1", output: "1" },
    ],
    initialId: s0,
  };
}

export function stateById(machine: FsmMachine, id: string): FsmState | undefined {
  return machine.states.find((state) => state.id === id);
}

export function symbolsOf(machine: FsmMachine): string[] {
  const width = Math.max(1, machine.inputs.length);
  return Array.from({ length: 2 ** width }, (_, value) => value.toString(2).padStart(width, "0"));
}

export function addState(machine: FsmMachine, name?: string): FsmMachine {
  const id = nextId("s");
  const state: FsmState = {
    id,
    name: name ?? `S${machine.states.length}`,
    x: 40 + (machine.states.length % 5) * 120,
    y: 80 + Math.floor(machine.states.length / 5) * 90,
    output: "0",
  };
  return { ...machine, states: [...machine.states, state] };
}

export function removeState(machine: FsmMachine, id: string): FsmMachine {
  const states = machine.states.filter((state) => state.id !== id);
  const initialId = machine.initialId === id ? (states[0]?.id ?? "") : machine.initialId;
  return {
    ...machine,
    states,
    initialId,
    transitions: machine.transitions.filter((edge) => edge.from !== id && edge.to !== id),
  };
}

export function renameState(machine: FsmMachine, id: string, name: string): FsmMachine {
  return { ...machine, states: machine.states.map((state) => (state.id === id ? { ...state, name } : state)) };
}

export function setOutput(machine: FsmMachine, id: string, output: string): FsmMachine {
  return { ...machine, states: machine.states.map((state) => (state.id === id ? { ...state, output } : state)) };
}

export function moveState(machine: FsmMachine, id: string, x: number, y: number): FsmMachine {
  return { ...machine, states: machine.states.map((state) => (state.id === id ? { ...state, x, y } : state)) };
}

export function setInitial(machine: FsmMachine, id: string): FsmMachine {
  return { ...machine, initialId: id };
}

export function addTransition(machine: FsmMachine, from: string, to: string, when: string, output = "0"): FsmMachine {
  const edge: FsmTransition = { id: nextId("t"), from, to, when, output };
  return { ...machine, transitions: [...machine.transitions, edge] };
}

export function updateTransition(machine: FsmMachine, id: string, patch: Partial<Pick<FsmTransition, "when" | "output" | "to" | "from">>): FsmMachine {
  return {
    ...machine,
    transitions: machine.transitions.map((edge) => (edge.id === id ? { ...edge, ...patch } : edge)),
  };
}

export function removeTransition(machine: FsmMachine, id: string): FsmMachine {
  return { ...machine, transitions: machine.transitions.filter((edge) => edge.id !== id) };
}
