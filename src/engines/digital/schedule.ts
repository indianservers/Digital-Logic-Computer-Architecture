import type { SimulationEvent } from "../../types/logic";

export function schedule(queue: SimulationEvent[], event: SimulationEvent): SimulationEvent[] {
  return [...queue, event].sort((a, b) => a.time - b.time || a.componentId.localeCompare(b.componentId) || a.eventType.localeCompare(b.eventType));
}

export function popNext(queue: SimulationEvent[]): { event: SimulationEvent | null; rest: SimulationEvent[] } {
  if (queue.length === 0) return { event: null, rest: [] };
  const [event, ...rest] = queue;
  return { event: event ?? null, rest };
}

/** Advance to the next distinct time and return every event that shares it. */
export function drainTime(queue: SimulationEvent[]): { time: number; events: SimulationEvent[]; rest: SimulationEvent[] } {
  const first = queue[0];
  if (!first) return { time: 0, events: [], rest: [] };
  const events = queue.filter((event) => event.time === first.time);
  return { time: first.time, events, rest: queue.filter((event) => event.time !== first.time) };
}
