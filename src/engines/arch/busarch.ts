import { driveBus, type BusDriver } from "../cpu/buses";

export function addressReach(width: number): { expression: string; count: number | null } {
  if (width < 0 || width > 53) return { expression: `2^${width}`, count: null };
  return { expression: `2^${width}`, count: 2 ** width };
}

export function bandwidthBytes(widthBits: number, frequencyHz: number, efficiency: number): number {
  return (widthBits / 8) * frequencyHz * Math.min(1, Math.max(0, efficiency));
}

export interface BusMaster {
  name: string;
  request: boolean;
  priority: number;
}

export function grantBus(mode: "daisy" | "central" | "distributed", masters: BusMaster[], lastGrant: number): { index: number; name: string } | null {
  const requesting = masters.map((master, index) => ({ master, index })).filter((item) => item.master.request);
  if (requesting.length === 0) return null;
  if (mode === "daisy") {
    const first = requesting[0];
    return first ? { index: first.index, name: first.master.name } : null;
  }
  if (mode === "central") {
    const ranked = requesting.slice().sort((left, right) => left.master.priority - right.master.priority || left.index - right.index);
    const winner = ranked[0];
    return winner ? { index: winner.index, name: winner.master.name } : null;
  }
  const count = masters.length;
  for (let step = 1; step <= count; step += 1) {
    const index = ((lastGrant % count) + step) % count;
    const master = masters[index];
    if (master?.request) return { index, name: master.name };
  }
  return null;
}

export function transferValue(drivers: BusDriver[]): ReturnType<typeof driveBus> {
  return driveBus(drivers);
}

export function syncEdge(high: boolean): { moved: boolean; explain: string } {
  return high
    ? { moved: true, explain: "The synchronous bus moves data on this clock edge." }
    : { moved: false, explain: "The clock is low, so the synchronous transfer waits." };
}

export function asyncHandshake(request: boolean, acknowledge: boolean): { moved: boolean; explain: string } {
  if (!request) return { moved: false, explain: "The master has not asserted request." };
  if (!acknowledge) return { moved: false, explain: "Request is waiting for acknowledge." };
  return { moved: true, explain: "Request and acknowledge completed the transfer." };
}

export function activeControls(signals: Record<string, boolean>): string[] {
  return Object.entries(signals).filter((entry) => entry[1]).map((entry) => entry[0]);
}
