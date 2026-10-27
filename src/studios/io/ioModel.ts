export const FIFO = [
  0x4a, 0x7f, 0x3c, 0x91, 0xb6, 0x2d, 0x18, 0xe0, 0x5a, 0xc3, 0x7e, 0x11, 0x82,
  0x49, 0xa5, 0x6d,
];
export function hex(value: number, width = 2) {
  return `0x${Math.max(0, value).toString(16).toUpperCase().padStart(width, "0")}`;
}
export function parseHex(value: string, max: number): number | null {
  if (!/^(0x)?[\da-f]+$/i.test(value.trim())) return null;
  const number = parseInt(value.replace(/^0x/i, ""), 16);
  return Number.isFinite(number) && number <= max ? number : null;
}
export function decodeAddress(address: number) {
  return address < 0x8000 ? "RAM" : address <= 0x800f ? "GPIO" : "Unmapped";
}
export function pollState(cycle: number, latency: number, interval: number) {
  const receiveAt = Math.ceil(latency / interval) * interval;
  const received = cycle >= receiveAt;
  const reads = Math.floor(Math.min(cycle, receiveAt) / interval);
  return {
    ready: cycle >= latency,
    received,
    reads,
    wasted: Math.max(0, reads - (received ? 1 : 0)),
    receiveAt,
  };
}
export function dmaBurst(
  memory: number[],
  cursor: number,
  length: number,
  burst: number,
) {
  const end = Math.min(length, cursor + burst);
  const next = memory.slice();
  for (let i = cursor; i < end; i++) next[i] = FIFO[i % FIFO.length]!;
  return { memory: next, cursor: end, done: end === length };
}
export type Master = "CPU" | "DMA";
export interface BusState {
  owner: Master | null;
  requests: Record<Master, boolean>;
  last: Master;
  elapsed: number;
  completed: Record<Master, number>;
  cycle: number;
}
export function nextBus(
  state: BusState,
  mode: "round" | "fixed",
  wait: number,
): BusState {
  const next = {
    ...state,
    requests: { ...state.requests },
    completed: { ...state.completed },
    cycle: state.cycle + 1,
  };
  if (next.owner) {
    if (next.elapsed >= wait + 1) {
      next.completed[next.owner]++;
      next.last = next.owner;
      next.requests[next.owner] = false;
      next.owner = null;
      next.elapsed = 0;
    } else {
      next.elapsed++;
      return next;
    }
  }
  const first: Master =
    mode === "fixed" ? "CPU" : next.last === "CPU" ? "DMA" : "CPU";
  const second: Master = first === "CPU" ? "DMA" : "CPU";
  next.owner = next.requests[first]
    ? first
    : next.requests[second]
      ? second
      : null;
  next.elapsed = next.owner ? 1 : 0;
  return next;
}
