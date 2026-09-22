export interface IoDevice {
  name: string;
  irq: number;
  priority: number;
  vector: number;
  pending: boolean;
  status: number;
  data: number;
}

export const MMIO = { status: 0xffff0000, data: 0xffff0004 };

export function addressSpace(mode: "mapped" | "isolated", address: number): "memory" | "io" {
  if (mode === "isolated") return address >= 0xff00 ? "io" : "memory";
  return address === MMIO.status || address === MMIO.data ? "io" : "memory";
}

export function pollTransfer(readyAfterPolls: number): { polls: number; wasted: number; transferred: boolean } {
  const polls = Math.max(0, readyAfterPolls);
  return { polls: polls + 1, wasted: polls, transferred: true };
}

export interface TimelineStep {
  pc: number;
  phase: "run" | "save" | "handler" | "return";
  note: string;
}

export function interruptTimeline(userPcs: number[], breakIndex: number, handlerPcs: number[]): TimelineStep[] {
  const steps: TimelineStep[] = [];
  userPcs.forEach((pc, index) => {
    if (index === breakIndex) {
      steps.push({ pc, phase: "save", note: `Saved PC ${pc} before the device handler.` });
      handlerPcs.forEach((handler) => steps.push({ pc: handler, phase: "handler", note: "Interrupt handler." }));
      steps.push({ pc, phase: "return", note: `Restored PC ${pc}.` });
    }
    steps.push({ pc, phase: "run", note: "User instruction." });
  });
  return steps;
}

export function highestPriority(devices: IoDevice[]): IoDevice | null {
  const pending = devices.filter((device) => device.pending).sort((left, right) => left.priority - right.priority || left.irq - right.irq);
  return pending[0] ?? null;
}

export function handlerFor(table: Array<{ irq: number; handler: number }>, irq: number): number | null {
  return table.find((row) => row.irq === irq)?.handler ?? null;
}

export function classifyException(kind: "div0" | "illegal" | "protect"): { name: string; vector: number; resumes: boolean } {
  if (kind === "div0") return { name: "Divide by zero", vector: 0, resumes: false };
  if (kind === "illegal") return { name: "Invalid instruction", vector: 1, resumes: false };
  return { name: "Protection fault", vector: 2, resumes: false };
}

export interface DmaState {
  memory: number[];
  device: number[];
  source: number;
  dest: number;
  size: number;
  direction: "to-memory" | "to-device";
  cursor: number;
  owner: "cpu" | "dma";
  cpuCycles: number;
  transferred: number;
  done: boolean;
  interrupt: boolean;
}

export function createDma(memory: number[], device: number[], source: number, dest: number, size: number, direction: DmaState["direction"]): DmaState {
  return { memory: memory.slice(), device: device.slice(), source, dest, size, direction, cursor: 0, owner: "cpu", cpuCycles: 0, transferred: 0, done: size <= 0, interrupt: false };
}

export function stepDma(state: DmaState): DmaState {
  if (state.done) return state;
  if (state.owner === "cpu") return { ...state, owner: "dma", cpuCycles: state.cpuCycles + 1 };
  const memory = state.memory.slice();
  const device = state.device.slice();
  const from = state.source + state.cursor;
  const to = state.dest + state.cursor;
  if (state.direction === "to-memory") memory[to] = device[from] ?? 0;
  else device[to] = memory[from] ?? 0;
  const transferred = state.transferred + 1;
  const done = transferred >= state.size;
  return {
    ...state,
    memory,
    device,
    cursor: state.cursor + 1,
    transferred,
    done,
    owner: done ? "cpu" : "dma",
    interrupt: done,
    cpuCycles: state.cpuCycles + (done ? 1 : 0),
  };
}

export function cpuCopy(memory: number[], device: number[], dest: number, size: number): { memory: number[]; cpuCycles: number } {
  const next = memory.slice();
  for (let index = 0; index < size; index += 1) next[dest + index] = device[index] ?? 0;
  return { memory: next, cpuCycles: size * 2 };
}
