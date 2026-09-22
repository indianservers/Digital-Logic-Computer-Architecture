import type { FsmMachine } from "./stateMachine";

function machine(partial: FsmMachine): FsmMachine {
  return partial;
}

export function sequenceDetector(pattern = "101", overlapping = true): FsmMachine {
  const length = pattern.length;
  const longest = (text: string) => {
    for (let size = Math.min(length, text.length); size >= 0; size -= 1) {
      if (pattern.startsWith(text.slice(text.length - size))) return size;
    }
    return 0;
  };
  const states = Array.from({ length: length + 1 }, (_, index) => ({
    id: `s${index}`,
    name: index === length ? "Found" : `S${index}`,
    x: 60 + index * 120,
    y: 130,
    output: index === length ? "1" : "0",
  }));
  const transitions: FsmMachine["transitions"] = [];
  let id = 1;
  for (let state = 0; state <= length; state += 1) {
    for (const bit of ["0", "1"]) {
      const next = state === length && !overlapping ? longest(bit) : longest(pattern.slice(0, state) + bit);
      transitions.push({ id: `t${id}`, from: `s${state}`, to: `s${next}`, when: bit, output: next === length ? "1" : "0" });
      id += 1;
    }
  }
  return machine({
    name: `${overlapping ? "Overlapping" : "Non-overlapping"} ${pattern} detector`,
    kind: "moore",
    inputs: ["x"],
    states,
    transitions,
    initialId: "s0",
  });
}

export function trafficLight(): FsmMachine {
  return {
    name: "Traffic light",
    kind: "moore",
    inputs: ["tick"],
    states: [
      { id: "ns", name: "NS Green", x: 80, y: 80, output: "NS-G" },
      { id: "nsy", name: "NS Yellow", x: 280, y: 80, output: "NS-Y" },
      { id: "ew", name: "EW Green", x: 280, y: 200, output: "EW-G" },
      { id: "ewy", name: "EW Yellow", x: 80, y: 200, output: "EW-Y" },
    ],
    transitions: [
      { id: "t1", from: "ns", to: "nsy", when: "1", output: "NS-Y" },
      { id: "t2", from: "nsy", to: "ew", when: "1", output: "EW-G" },
      { id: "t3", from: "ew", to: "ewy", when: "1", output: "EW-Y" },
      { id: "t4", from: "ewy", to: "ns", when: "1", output: "NS-G" },
    ],
    initialId: "ns",
  };
}

export function vendingMachine(cost = 15): FsmMachine {
  return {
    name: `Vending ${cost}`,
    kind: "moore",
    inputs: ["coin"],
    states: [
      { id: "c0", name: "0", x: 60, y: 120, output: "0" },
      { id: "c5", name: "5", x: 190, y: 120, output: "0" },
      { id: "c10", name: "10", x: 320, y: 120, output: "0" },
      { id: "c15", name: "Vend", x: 450, y: 120, output: "1" },
    ],
    transitions: [
      { id: "a", from: "c0", to: "c5", when: "5", output: "0" },
      { id: "b", from: "c0", to: "c10", when: "10", output: "0" },
      { id: "c", from: "c5", to: "c10", when: "5", output: "0" },
      { id: "d", from: "c5", to: "c15", when: "10", output: "1" },
      { id: "e", from: "c10", to: "c15", when: "5", output: "1" },
      { id: "f", from: "c10", to: "c15", when: "10", output: "1" },
      { id: "g", from: "c15", to: "c0", when: "5", output: "0" },
      { id: "h", from: "c15", to: "c0", when: "10", output: "0" },
    ],
    initialId: "c0",
  };
}

export function elevator(): FsmMachine {
  return {
    name: "Elevator",
    kind: "moore",
    inputs: ["call"],
    states: [
      { id: "f1", name: "Floor 1", x: 40, y: 160, output: "door" },
      { id: "up12", name: "Moving Up", x: 180, y: 60, output: "up" },
      { id: "f2", name: "Floor 2", x: 320, y: 160, output: "door" },
      { id: "up23", name: "Moving Up", x: 460, y: 60, output: "up" },
      { id: "f3", name: "Floor 3", x: 600, y: 160, output: "door" },
      { id: "down32", name: "Moving Down", x: 460, y: 250, output: "down" },
      { id: "down21", name: "Moving Down", x: 180, y: 250, output: "down" },
    ],
    transitions: [
      { id: "e1", from: "f1", to: "up12", when: "1", output: "up" },
      { id: "e2", from: "up12", to: "f2", when: "1", output: "door" },
      { id: "e3", from: "f2", to: "up23", when: "1", output: "up" },
      { id: "e4", from: "up23", to: "f3", when: "1", output: "door" },
      { id: "e5", from: "f3", to: "down32", when: "0", output: "down" },
      { id: "e6", from: "down32", to: "f2", when: "0", output: "door" },
      { id: "e7", from: "f2", to: "down21", when: "0", output: "down" },
      { id: "e8", from: "down21", to: "f1", when: "0", output: "door" },
      { id: "e9", from: "f1", to: "f1", when: "0", output: "door" },
      { id: "e10", from: "f3", to: "f3", when: "1", output: "door" },
    ],
    initialId: "f1",
  };
}

export function digitalLock(sequence = "1011"): FsmMachine {
  const states = [{ id: "s0", name: "Locked", x: 50, y: 130, output: "0" }];
  const transitions: FsmMachine["transitions"] = [];
  for (let i = 0; i < sequence.length; i += 1) {
    states.push({ id: `s${i + 1}`, name: i + 1 === sequence.length ? "Open" : `Got ${sequence.slice(0, i + 1)}`, x: 50 + (i + 1) * 120, y: 130, output: i + 1 === sequence.length ? "1" : "0" });
  }
  for (let i = 0; i < sequence.length; i += 1) {
    const bit = sequence[i] ?? "0";
    const other = bit === "1" ? "0" : "1";
    transitions.push({ id: `ok${i}`, from: `s${i}`, to: `s${i + 1}`, when: bit, output: i + 1 === sequence.length ? "1" : "0" });
    const restart = other === sequence[0] ? "s1" : "s0";
    transitions.push({ id: `bad${i}`, from: `s${i}`, to: restart, when: other, output: "0" });
  }
  transitions.push({ id: "stay1", from: `s${sequence.length}`, to: `s${sequence.length}`, when: "1", output: "1" });
  transitions.push({ id: "stay0", from: `s${sequence.length}`, to: "s0", when: "0", output: "0" });
  return { name: `Lock ${sequence}`, kind: "moore", inputs: ["x"], states, transitions, initialId: "s0" };
}

export const FSM_EXAMPLES: Array<{ id: string; label: string; build: () => FsmMachine }> = [
  { id: "overlap", label: "Detect 101 overlapping", build: () => sequenceDetector("101", true) },
  { id: "once", label: "Detect 101 once", build: () => sequenceDetector("101", false) },
  { id: "light", label: "Traffic light", build: trafficLight },
  { id: "vend", label: "Vending machine", build: () => vendingMachine(15) },
  { id: "lift", label: "Elevator", build: elevator },
  { id: "lock", label: "Digital lock", build: () => digitalLock("1011") },
];
