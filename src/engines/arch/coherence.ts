import { accessCache, createCache, type CacheMachine } from "../cache/cache";
import { decompose, type CacheConfig } from "../cache/mapping";

export type MesiState = "M" | "E" | "S" | "I";
export type MsiState = "M" | "S" | "I";
export type MoesiState = "M" | "O" | "E" | "S" | "I";

export interface CoherenceStep<T extends string> {
  states: T[];
  bus: string;
  invalidations: number;
}

function copy<T>(states: T[]): T[] {
  return states.slice();
}

export function mesiStep(states: MesiState[], core: number, op: "read" | "write"): CoherenceStep<MesiState> {
  const next = copy(states);
  const mine = next[core] ?? "I";
  let bus = "hit";
  let invalidations = 0;
  const other = (state: MesiState) => next.some((item, index) => index !== core && item === state);
  if (op === "read") {
    if (mine === "I") {
      if (other("M")) {
        bus = "BusRd + WriteBack";
        next.forEach((state, index) => {
          if (index !== core && state === "M") next[index] = "S";
        });
        next[core] = "S";
      } else if (other("S") || other("E")) {
        bus = "BusRd";
        next.forEach((state, index) => {
          if (index !== core && state === "E") next[index] = "S";
        });
        next[core] = "S";
      } else {
        bus = "BusRd";
        next[core] = "E";
      }
    }
  } else if (mine === "E") {
    next[core] = "M";
    bus = "silent upgrade";
  } else if (mine !== "M") {
    bus = mine === "I" ? "BusRdX" : "Invalidate";
    next.forEach((state, index) => {
      if (index !== core && state !== "I") {
        next[index] = "I";
        invalidations += 1;
      }
    });
    next[core] = "M";
  }
  return { states: next, bus, invalidations };
}

export function moesiStep(states: MoesiState[], core: number, op: "read" | "write"): CoherenceStep<MoesiState> {
  const next = copy(states);
  const mine = next[core] ?? "I";
  let bus = "hit";
  let invalidations = 0;
  const other = (state: MoesiState) => next.some((item, index) => index !== core && item === state);
  if (op === "read") {
    if (mine === "I") {
      if (other("M") || other("O")) {
        bus = "BusRd + owner supplies";
        next.forEach((state, index) => {
          if (index !== core && state === "M") next[index] = "O";
        });
        next[core] = "S";
      } else if (other("S") || other("E")) {
        bus = "BusRd";
        next.forEach((state, index) => {
          if (index !== core && state === "E") next[index] = "S";
        });
        next[core] = "S";
      } else {
        bus = "BusRd";
        next[core] = "E";
      }
    }
  } else if (mine === "E" || mine === "M") {
    next[core] = "M";
    bus = mine === "E" ? "silent upgrade" : "hit";
  } else {
    bus = mine === "O" ? "BusUpgr + WriteBack" : "BusRdX";
    next.forEach((state, index) => {
      if (index !== core && state !== "I") {
        next[index] = "I";
        invalidations += 1;
      }
    });
    next[core] = "M";
  }
  return { states: next, bus, invalidations };
}

export function msiStep(states: MsiState[], core: number, op: "read" | "write"): CoherenceStep<MsiState> {
  const next = copy(states);
  const mine = next[core] ?? "I";
  let bus = "hit";
  let invalidations = 0;
  if (op === "read" && mine === "I") {
    const modified = next.some((state, index) => index !== core && state === "M");
    bus = modified ? "BusRd + WriteBack" : "BusRd";
    next.forEach((state, index) => {
      if (index !== core && state === "M") next[index] = "S";
    });
    next[core] = "S";
  }
  if (op === "write" && mine !== "M") {
    bus = "BusRdX";
    next.forEach((state, index) => {
      if (index !== core && state !== "I") {
        next[index] = "I";
        invalidations += 1;
      }
    });
    next[core] = "M";
  }
  return { states: next, bus, invalidations };
}

export interface DirectoryEntry {
  owner: number | null;
  sharers: number[];
}

export function directoryRead(entry: DirectoryEntry, core: number): DirectoryEntry {
  if (entry.owner !== null && entry.owner !== core) {
    return { owner: null, sharers: [...new Set([...entry.sharers, entry.owner, core])] };
  }
  return { owner: entry.owner, sharers: entry.sharers.includes(core) ? entry.sharers : [...entry.sharers, core] };
}

export function directoryWrite(entry: DirectoryEntry, core: number): { entry: DirectoryEntry; invalidated: number } {
  const invalidated = entry.sharers.filter((sharer) => sharer !== core).length + (entry.owner !== null && entry.owner !== core ? 1 : 0);
  return { entry: { owner: core, sharers: [] }, invalidated };
}

export function falseShareInvalidations(lineBytes: number, writes: Array<{ core: number; address: number }>): number {
  const shift = Math.round(Math.log2(Math.max(1, lineBytes)));
  const cores = writes.reduce((max, write) => Math.max(max, write.core + 1), 0);
  const lines = new Map<number, MesiState[]>();
  let invalidations = 0;
  for (const write of writes) {
    const line = write.address >>> shift;
    const current = lines.get(line) ?? Array.from({ length: cores }, () => "I" as MesiState);
    const stepped = mesiStep(current, write.core, "write");
    invalidations += stepped.invalidations;
    lines.set(line, stepped.states);
  }
  return invalidations;
}

export function readShared(model: "shared" | "distributed", core: number, address: number, shared: number[], locals: number[][]): { value: number; where: string } {
  if (model === "shared") return { value: shared[address] ?? 0, where: "shared memory" };
  return { value: locals[core]?.[address] ?? 0, where: `memory ${core}` };
}

export function invalidateCached(machine: CacheMachine, address: number): CacheMachine {
  const parts = decompose(address, machine.config);
  return {
    ...machine,
    sets: machine.sets.map((set, index) => index === parts.index
      ? set.map((line) => line.valid && line.tag === parts.tag ? { ...line, valid: false } : line)
      : set),
  };
}

export function presetCache(): CacheConfig {
  return {
    addressBits: 8, memoryBytes: 256, cacheBytes: 32, blockBytes: 4, associativity: 1,
    replacement: "lru", writePolicy: "through", allocation: "allocate", seed: 3,
  };
}

export function warmCache(address: number): CacheMachine {
  return accessCache(createCache(presetCache()), address, "read").machine;
}
