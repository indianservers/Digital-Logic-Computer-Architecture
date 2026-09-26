export type Protocol = "msi" | "mesi" | "moesi";
export type LineState = "M" | "O" | "E" | "S" | "I";
export type CoherenceOp = "read" | "write" | "evict";

export interface Access {
  core: number;
  op: CoherenceOp;
  address: number;
  value?: number;
}

export interface LineCopy {
  state: LineState;
  value: number;
}

export interface ProtocolEvent {
  cycle: number;
  core: number;
  address: number;
  bus: string;
  detail: string;
  from: LineState;
  to: LineState;
  source: string;
}

interface Line {
  memory: number;
  copies: LineCopy[];
}

export interface CoherenceShot {
  cycle: number;
  lines: Array<{ address: number; memory: number; stale: boolean; copies: LineCopy[] }>;
  log: ProtocolEvent[];
  event: string;
  readMisses: number;
  writeMisses: number;
  upgrades: number;
  invalidations: number;
  interventions: number;
  writebacks: number;
  memoryReads: number;
  cacheToCache: number;
  silent: number;
  messages: number;
  owned: number;
}

export interface CoherenceResult {
  shots: CoherenceShot[];
  final: CoherenceShot;
}

function blank(cores: number, memory: number): Line {
  return { memory, copies: Array.from({ length: cores }, () => ({ state: "I" as LineState, value: memory })) };
}

function cloneLine(line: Line): Line {
  return { memory: line.memory, copies: line.copies.map((copy) => ({ ...copy })) };
}

export function invariants(copies: LineCopy[], protocol: Protocol) {
  const count = (state: LineState) => copies.filter((copy) => copy.state === state).length;
  const modified = count("M");
  const owned = count("O");
  const exclusive = count("E");
  if (modified > 1 || owned > 1 || exclusive > 1) return false;
  if (protocol === "msi" && (owned > 0 || exclusive > 0)) return false;
  if (protocol === "mesi" && owned > 0) return false;
  if (modified === 1 && copies.some((copy) => copy.state !== "M" && copy.state !== "I")) return false;
  if (exclusive === 1 && copies.some((copy) => copy.state !== "E" && copy.state !== "I")) return false;
  if (owned === 1 && copies.some((copy) => copy.state !== "O" && copy.state !== "S" && copy.state !== "I")) return false;
  return true;
}

function view(lines: Map<number, Line>, log: ProtocolEvent[], cycle: number, event: string, totals: Omit<CoherenceShot, "cycle" | "lines" | "log" | "event">): CoherenceShot {
  return {
    cycle,
    lines: [...lines.entries()].sort((left, right) => left[0] - right[0]).map(([address, line]) => {
      const dirty = line.copies.some((copy) => copy.state === "M" || copy.state === "O");
      const owner = line.copies.find((copy) => copy.state === "M" || copy.state === "O");
      return { address, memory: line.memory, stale: Boolean(dirty && owner && owner.value !== line.memory), copies: line.copies.map((copy) => ({ ...copy })) };
    }),
    log: log.slice(),
    event,
    ...totals,
  };
}

export function runCoherence(protocol: Protocol, cores: number, accesses: Access[], seed: Record<number, number> = {}): CoherenceResult {
  const lines = new Map<number, Line>();
  const ensure = (address: number) => {
    const found = lines.get(address);
    if (found) return found;
    const created = blank(cores, seed[address] ?? 0);
    lines.set(address, created);
    return created;
  };
  Object.keys(seed).forEach((key) => ensure(Number(key)));
  const log: ProtocolEvent[] = [];
  const totals = { readMisses: 0, writeMisses: 0, upgrades: 0, invalidations: 0, interventions: 0, writebacks: 0, memoryReads: 0, cacheToCache: 0, silent: 0, messages: 0, owned: 0 };
  const shots: CoherenceShot[] = [view(lines, log, 0, "Caches start invalid", totals)];
  accesses.forEach((access, index) => {
    const cycle = index + 1;
    const line = ensure(access.address);
    const mine = line.copies[access.core];
    if (!mine || access.core < 0 || access.core >= cores) {
      shots.push(view(lines, log, cycle, "Ignored core", totals));
      return;
    }
    const before = mine.state;
    let bus = "Hit";
    let detail = `${label(access)} hit in ${before}`;
    let source = `Core ${access.core}`;
    const others = () => line.copies.filter((_, core) => core !== access.core);
    const invalidate = () => {
      others().forEach((copy) => {
        if (copy.state !== "I") {
          copy.state = "I";
          totals.invalidations += 1;
        }
      });
    };
    if (access.op === "evict") {
      if (before === "M" || before === "O") {
        line.memory = mine.value;
        totals.writebacks += 1;
        bus = "Writeback";
        detail = `Core ${access.core} evicted a dirty line. Memory is now 0x${mine.value.toString(16)}.`;
        source = "writeback";
      } else {
        bus = "Evict";
        detail = `Core ${access.core} dropped a clean ${before} line.`;
      }
      mine.state = "I";
    } else if (access.op === "read") {
      if (before === "I") {
        totals.readMisses += 1;
        const owner = line.copies.findIndex((copy, core) => core !== access.core && (copy.state === "M" || copy.state === "O"));
        const ownerCopy = owner >= 0 ? line.copies[owner] : undefined;
        if (ownerCopy && (ownerCopy.state === "M" || ownerCopy.state === "O")) {
          totals.interventions += 1;
          totals.cacheToCache += 1;
          mine.value = ownerCopy.value;
          if (protocol === "moesi" && ownerCopy.state === "M") {
            ownerCopy.state = "O";
            bus = "BusRd";
            detail = `Core ${owner} supplies the dirty line and becomes Owned. Memory stays 0x${line.memory.toString(16)}.`;
            source = `Core ${owner}`;
          } else if (protocol === "moesi" && ownerCopy.state === "O") {
            bus = "BusRd";
            detail = `Owner Core ${owner} supplies 0x${ownerCopy.value.toString(16)} and stays Owned.`;
            source = `Core ${owner}`;
          } else {
            line.memory = ownerCopy.value;
            ownerCopy.state = "S";
            totals.writebacks += 1;
            bus = "BusRd";
            detail = `Core ${owner} writes back and shares. Requester receives 0x${mine.value.toString(16)}.`;
            source = `Core ${owner}`;
          }
          mine.state = "S";
          totals.messages += 1;
        } else if (others().some((copy) => copy.state === "S" || copy.state === "E")) {
          line.copies.forEach((copy, core) => {
            if (core !== access.core && copy.state === "E") copy.state = "S";
          });
          const supplier = line.copies.findIndex((copy, core) => core !== access.core && copy.state === "S");
          mine.value = supplier >= 0 ? (line.copies[supplier]?.value ?? line.memory) : line.memory;
          mine.state = "S";
          totals.cacheToCache += 1;
          bus = "BusRd";
          detail = "A sharer already has the line. Requester enters Shared.";
          source = supplier >= 0 ? `Core ${supplier}` : "memory";
          totals.messages += 1;
        } else {
          mine.value = line.memory;
          mine.state = protocol === "msi" ? "S" : "E";
          totals.memoryReads += 1;
          bus = "BusRd";
          detail = protocol === "msi" ? "Cold read. MSI fills Shared." : "Cold read. This is the only clean copy, so the line is Exclusive.";
          source = "memory";
          totals.messages += 1;
        }
      }
    } else if (before === "E") {
      mine.state = "M";
      mine.value = access.value ?? mine.value;
      totals.silent += 1;
      bus = "Silent";
      detail = "Exclusive to Modified. No other cache holds the line, so there is no bus invalidation.";
    } else if (before === "M") {
      mine.value = access.value ?? mine.value;
      bus = "Hit";
      detail = "Write hit on Modified.";
    } else {
      if (before === "I") totals.writeMisses += 1;
      else totals.upgrades += 1;
      invalidate();
      mine.state = "M";
      mine.value = access.value ?? mine.value;
      bus = before === "I" ? "BusRdX" : "BusUpgr";
      detail = before === "I" ? "Read for ownership. Other copies are invalidated." : "Upgrade. Shared copies are invalidated and no data fetch is required.";
      source = `Core ${access.core}`;
      totals.messages += 1;
    }
    totals.owned = [...lines.values()].reduce((sum, item) => sum + item.copies.filter((copy) => copy.state === "O").length, 0);
    log.push({ cycle, core: access.core, address: access.address, bus, detail, from: before, to: mine.state, source });
    const next = cloneLine(line);
    lines.set(access.address, next);
    shots.push(view(lines, log, cycle, detail, totals));
  });
  return { shots, final: shots[shots.length - 1] ?? shots[0]! };
}

function label(access: Access) {
  const hex = `0x${access.address.toString(16)}`;
  if (access.op === "evict") return `C${access.core} evict ${hex}`;
  if (access.op === "write") return `C${access.core} write ${hex}=${access.value ?? 0}`;
  return `C${access.core} read ${hex}`;
}

export function compareProtocols(cores: number, accesses: Access[], seed: Record<number, number> = {}) {
  return {
    msi: runCoherence("msi", cores, accesses, seed),
    mesi: runCoherence("mesi", cores, accesses, seed),
    moesi: runCoherence("moesi", cores, accesses, seed),
  };
}

const A = 0x1000;
export const LINE_ADDRESSES = [0x0, 0x40, 0x80, 0xc0];

export const MSI_PRESETS: Array<{ id: string; label: string; accesses: Access[]; seed?: Record<number, number> }> = [
  { id: "private", label: "Private data", accesses: [{ core: 0, op: "read", address: A }, { core: 0, op: "write", address: A, value: 20 }] },
  { id: "share", label: "Read sharing", accesses: [{ core: 0, op: "read", address: A }, { core: 1, op: "read", address: A }, { core: 2, op: "read", address: A }] },
  { id: "producer", label: "Producer / consumer", seed: { [A]: 10 }, accesses: [{ core: 0, op: "read", address: A }, { core: 0, op: "write", address: A, value: 25 }, { core: 1, op: "read", address: A }] },
  { id: "writes", label: "Write sharing", accesses: [{ core: 0, op: "write", address: A, value: 20 }, { core: 1, op: "write", address: A, value: 30 }] },
  { id: "ping", label: "Ping-pong", accesses: [{ core: 0, op: "write", address: A, value: 1 }, { core: 1, op: "write", address: A, value: 2 }, { core: 0, op: "read", address: A }] },
  { id: "upgrade", label: "Upgrade", accesses: [{ core: 0, op: "read", address: A }, { core: 1, op: "read", address: A }, { core: 0, op: "write", address: A, value: 40 }] },
];

export const MOESI_PRESETS: Array<{ id: string; label: string; accesses: Access[]; seed?: Record<number, number> }> = [
  { id: "private", label: "Exclusive private line", seed: { [A]: 10 }, accesses: [{ core: 0, op: "read", address: A }, { core: 0, op: "write", address: A, value: 50 }] },
  { id: "owned", label: "M to O remote read", seed: { [A]: 10 }, accesses: [{ core: 0, op: "read", address: A }, { core: 0, op: "write", address: A, value: 25 }, { core: 1, op: "read", address: A }] },
  { id: "sharers", label: "O plus multiple sharers", seed: { [A]: 10 }, accesses: [{ core: 0, op: "read", address: A }, { core: 0, op: "write", address: A, value: 25 }, { core: 1, op: "read", address: A }, { core: 2, op: "read", address: A }] },
  { id: "take", label: "Write takeover", seed: { [A]: 10 }, accesses: [{ core: 0, op: "read", address: A }, { core: 0, op: "write", address: A, value: 25 }, { core: 1, op: "read", address: A }, { core: 2, op: "write", address: A, value: 70 }] },
  { id: "ping", label: "Ping-pong sharing", accesses: [{ core: 0, op: "write", address: A, value: 1 }, { core: 1, op: "read", address: A }, { core: 1, op: "write", address: A, value: 2 }, { core: 0, op: "read", address: A }] },
  { id: "evict", label: "Owner eviction", seed: { [A]: 10 }, accesses: [{ core: 0, op: "read", address: A }, { core: 0, op: "write", address: A, value: 25 }, { core: 1, op: "read", address: A }, { core: 0, op: "evict", address: A }] },
  { id: "then", label: "Shared readers then writer", accesses: [{ core: 0, op: "read", address: A }, { core: 1, op: "read", address: A }, { core: 2, op: "read", address: A }, { core: 3, op: "write", address: A, value: 9 }] },
];

export const STATE_TEXT: Record<LineState, string> = {
  M: "Modified. Dirty and exclusive. This cache must write the line back if it is replaced, unless a protocol supplies it another way.",
  O: "Owned. Dirty and shared. This cache supplies the newest data. Other caches may hold Shared copies. Memory can stay stale.",
  E: "Exclusive. Clean and the only copy. A local write can become Modified without a bus message.",
  S: "Shared. Clean. Several caches may hold it. A write needs an upgrade that invalidates the others.",
  I: "Invalid. This cache does not hold the line.",
};
