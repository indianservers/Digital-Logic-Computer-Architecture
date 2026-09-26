export type DirState = "U" | "S" | "M";
export type CacheState = "M" | "S" | "I";
export type DirOp = "read" | "write";

export interface DirRequest {
  core: number;
  op: DirOp;
  address: number;
  value?: number;
}

export interface DirMessage {
  cycle: number;
  kind: "GetS" | "GetM" | "Lookup" | "Inv" | "InvAck" | "FwdGetS" | "FwdGetM" | "Data" | "PutM" | "Grant" | "Update";
  source: string;
  destination: string;
  detail: string;
  address: number;
  network: boolean;
}

export interface DirCopy {
  state: CacheState;
  value: number;
}

export interface DirLineView {
  address: number;
  state: DirState;
  owner: number | null;
  sharers: number[];
  memory: number;
  dirty: boolean;
  copies: DirCopy[];
  pending: string;
  acks: number;
}

export interface DirShot {
  cycle: number;
  lines: DirLineView[];
  messages: DirMessage[];
  step: DirMessage[];
  event: string;
  requester: number | null;
  previousOwner: number | null;
  nextOwner: number | null;
  invalidated: number[];
  transfer: string;
  lookups: number;
  reads: number;
  writes: number;
  invalidations: number;
  acks: number;
  transfers: number;
  dataResponses: number;
  memoryReads: number;
  writebacks: number;
  pointToPoint: number;
  avoided: number;
  avgLatency: number;
  avgSharers: number;
  maxSharers: number;
}

export interface DirResult {
  shots: DirShot[];
  final: DirShot;
}

interface Line {
  memory: number;
  state: DirState;
  owner: number | null;
  sharers: number[];
  copies: DirCopy[];
}

interface Totals {
  lookups: number;
  reads: number;
  writes: number;
  invalidations: number;
  acks: number;
  transfers: number;
  dataResponses: number;
  memoryReads: number;
  writebacks: number;
  pointToPoint: number;
  avoided: number;
  latencySum: number;
  requests: number;
}

export const DIR_LINES = [0x1000, 0x1040, 0x1080, 0x10c0, 0x1100, 0x1140];

const A = 0x1000;

export function writeTraffic(cores: number, sharers: number) {
  const targeted = Math.max(0, sharers);
  return { snoop: Math.max(0, cores - 1), directory: 2 + 2 * targeted };
}

export function scalingSeries(sharers: number, widths = [2, 4, 8, 16]) {
  return widths.map((cores) => ({ cores, ...writeTraffic(cores, sharers) }));
}

export function validHolders(line: { state: DirState; owner: number | null; sharers: number[] }) {
  if (line.state === "M" && line.owner !== null) return [line.owner];
  if (line.state === "S") return line.sharers.slice();
  return [];
}

export function directoryAgrees(line: DirLineView) {
  if (line.state === "U") {
    return line.owner === null && line.sharers.length === 0 && line.copies.every((copy) => copy.state === "I");
  }
  if (line.state === "S") {
    if (line.owner !== null || line.sharers.length === 0) return false;
    return line.copies.every((copy, core) => (line.sharers.includes(core) ? copy.state === "S" && copy.value === line.memory : copy.state === "I"));
  }
  if (line.owner === null || line.sharers.length > 0 || validHolders(line).length !== 1) return false;
  return line.copies.every((copy, core) => (core === line.owner ? copy.state === "M" : copy.state === "I"));
}

function blank(cores: number, memory: number): Line {
  return { memory, state: "U", owner: null, sharers: [], copies: Array.from({ length: cores }, () => ({ state: "I" as CacheState, value: memory })) };
}

function clone(line: Line): Line {
  return { memory: line.memory, state: line.state, owner: line.owner, sharers: line.sharers.slice(), copies: line.copies.map((copy) => ({ ...copy })) };
}

function view(lines: Map<number, Line>, messages: DirMessage[], cycle: number, step: DirMessage[], event: string, focus: { requester: number | null; previousOwner: number | null; nextOwner: number | null; invalidated: number[]; transfer: string }, totals: Totals): DirShot {
  const listed = [...lines.entries()].sort((left, right) => left[0] - right[0]).map(([address, line]) => ({
    address,
    state: line.state,
    owner: line.owner,
    sharers: line.sharers.slice(),
    memory: line.memory,
    dirty: line.state === "M" && line.owner !== null && (line.copies[line.owner]?.value ?? line.memory) !== line.memory,
    copies: line.copies.map((copy) => ({ ...copy })),
    pending: "",
    acks: 0,
  }));
  const active = listed.filter((line) => line.state !== "U");
  const counts = active.map((line) => validHolders(line).length);
  const avgSharers = counts.length ? counts.reduce((sum, count) => sum + count, 0) / counts.length : 0;
  return {
    cycle,
    lines: listed,
    messages: messages.slice(),
    step,
    event,
    ...focus,
    lookups: totals.lookups,
    reads: totals.reads,
    writes: totals.writes,
    invalidations: totals.invalidations,
    acks: totals.acks,
    transfers: totals.transfers,
    dataResponses: totals.dataResponses,
    memoryReads: totals.memoryReads,
    writebacks: totals.writebacks,
    pointToPoint: totals.pointToPoint,
    avoided: totals.avoided,
    avgLatency: totals.requests ? totals.latencySum / totals.requests : 0,
    avgSharers,
    maxSharers: counts.reduce((max, count) => Math.max(max, count), 0),
  };
}

export function runDirectory(cores: number, requests: DirRequest[], seed: Record<number, number> = {}): DirResult {
  const width = Math.max(1, cores);
  const lines = new Map<number, Line>();
  const ensure = (address: number) => {
    const found = lines.get(address);
    if (found) return found;
    const created = blank(width, seed[address] ?? 0);
    lines.set(address, created);
    return created;
  };
  DIR_LINES.forEach((address) => ensure(address));
  Object.keys(seed).forEach((key) => ensure(Number(key)));
  const messages: DirMessage[] = [];
  const totals: Totals = { lookups: 0, reads: 0, writes: 0, invalidations: 0, acks: 0, transfers: 0, dataResponses: 0, memoryReads: 0, writebacks: 0, pointToPoint: 0, avoided: 0, latencySum: 0, requests: 0 };
  const idle = { requester: null, previousOwner: null, nextOwner: null, invalidated: [] as number[], transfer: "None" };
  const shots: DirShot[] = [view(lines, messages, 0, [], "Directory starts uncached", idle, totals)];
  requests.forEach((request, index) => {
    const cycle = index + 1;
    const step: DirMessage[] = [];
    const push = (kind: DirMessage["kind"], source: string, destination: string, detail: string, network: boolean) => {
      const message = { cycle, kind, source, destination, detail, address: request.address, network };
      step.push(message);
      messages.push(message);
      if (network) totals.pointToPoint += 1;
    };
    const line = ensure(request.address);
    const mine = line.copies[request.core];
    if (!mine || request.core < 0 || request.core >= width) {
      shots.push(view(lines, messages, cycle, step, "Ignored core", idle, totals));
      return;
    }
    const focus = { requester: request.core, previousOwner: line.owner, nextOwner: line.owner, invalidated: [] as number[], transfer: "None" };
    const hit = (request.op === "read" && mine.state !== "I") || (request.op === "write" && mine.state === "M");
    if (hit) {
      if (request.op === "write") mine.value = request.value ?? mine.value;
      shots.push(view(lines, messages, cycle, step, request.op === "write" ? "Write hit on the owner. The directory is not consulted." : "Read hit. The directory is not consulted.", focus, totals));
      return;
    }
    totals.requests += 1;
    totals.lookups += 1;
    if (request.op === "read") totals.reads += 1;
    else totals.writes += 1;
    push(request.op === "read" ? "GetS" : "GetM", `Core ${request.core}`, "Directory", request.op === "read" ? "Read request" : "Write request", true);
    push("Lookup", "Directory", "Directory", `State ${line.state}, owner ${line.owner === null ? "none" : `Core ${line.owner}`}, sharers {${line.sharers.join(", ")}}`, false);
    if (request.op === "read") {
      if (line.state === "M" && line.owner !== null && line.owner !== request.core) {
        const ownerCopy = line.copies[line.owner];
        const value = ownerCopy?.value ?? line.memory;
        push("FwdGetS", "Directory", `Core ${line.owner}`, "Forward the read to the owner", true);
        push("Data", `Core ${line.owner}`, `Core ${request.core}`, `Owner supplies 0x${value.toString(16)}`, true);
        push("PutM", `Core ${line.owner}`, "Memory", `Writeback 0x${value.toString(16)} so the line can be shared`, true);
        line.memory = value;
        if (ownerCopy) ownerCopy.state = "S";
        mine.state = "S";
        mine.value = value;
        line.sharers = [line.owner, request.core];
        line.owner = null;
        line.state = "S";
        totals.writebacks += 1;
        totals.dataResponses += 1;
        totals.transfers += 1;
        focus.transfer = "Share";
        focus.nextOwner = null;
        push("Update", "Directory", "Directory", "Modified becomes Shared", false);
      } else {
        mine.value = line.memory;
        mine.state = "S";
        if (!line.sharers.includes(request.core)) line.sharers.push(request.core);
        line.state = "S";
        line.owner = null;
        totals.memoryReads += 1;
        totals.dataResponses += 1;
        push("Data", "Memory", `Core ${request.core}`, `Memory supplies 0x${line.memory.toString(16)}`, true);
        push("Update", "Directory", "Directory", `Sharers {${line.sharers.join(", ")}}`, false);
      }
      push("Grant", "Directory", `Core ${request.core}`, "Shared copy installed", true);
    } else if (line.state === "M" && line.owner !== null && line.owner !== request.core) {
      const ownerCopy = line.copies[line.owner];
      const value = request.value ?? ownerCopy?.value ?? line.memory;
      push("FwdGetM", "Directory", `Core ${line.owner}`, "Request the line from the owner", true);
      push("Data", `Core ${line.owner}`, `Core ${request.core}`, "Owner transfers the line and drops its copy", true);
      push("InvAck", `Core ${line.owner}`, "Directory", "Owner acknowledges the transfer", true);
      if (ownerCopy) ownerCopy.state = "I";
      focus.invalidated = [line.owner];
      mine.state = "M";
      mine.value = value;
      line.owner = request.core;
      line.sharers = [];
      line.state = "M";
      totals.invalidations += 1;
      totals.acks += 1;
      totals.transfers += 1;
      totals.dataResponses += 1;
      totals.avoided += Math.max(0, width - 1 - 1);
      focus.transfer = "Write";
      focus.nextOwner = request.core;
      push("Update", "Directory", "Directory", `Owner is now Core ${request.core}`, false);
      push("Grant", "Directory", `Core ${request.core}`, "Exclusive ownership granted", true);
    } else {
      const targets = line.sharers.filter((sharer) => sharer !== request.core);
      targets.forEach((sharer) => {
        push("Inv", "Directory", `Core ${sharer}`, "Invalidate this sharer only", true);
        const copy = line.copies[sharer];
        if (copy && copy.state !== "I") copy.state = "I";
        totals.invalidations += 1;
      });
      targets.forEach((sharer) => {
        push("InvAck", `Core ${sharer}`, "Directory", "Invalidation acknowledged", true);
        totals.acks += 1;
      });
      if (mine.state === "I") {
        mine.value = line.memory;
        totals.memoryReads += 1;
        totals.dataResponses += 1;
        push("Data", "Memory", `Core ${request.core}`, `Memory supplies 0x${line.memory.toString(16)}`, true);
      }
      mine.state = "M";
      mine.value = request.value ?? mine.value;
      line.owner = request.core;
      line.sharers = [];
      line.state = "M";
      totals.avoided += Math.max(0, width - 1 - targets.length);
      focus.invalidated = targets;
      focus.transfer = targets.length ? "Write" : "Fill";
      focus.nextOwner = request.core;
      push("Update", "Directory", "Directory", `Owner Core ${request.core}, sharers {}`, false);
      push("Grant", "Directory", `Core ${request.core}`, "Exclusive ownership granted", true);
    }
    totals.latencySum += step.filter((message) => message.network).length;
    const current = lines.get(request.address);
    if (current) {
      const pending = step.filter((message) => message.kind === "Inv").length;
      lines.set(request.address, clone(current));
      const shot = view(lines, messages, cycle, step, step.at(-1)?.detail ?? "Directory updated", focus, totals);
      const touched = shot.lines.find((item) => item.address === request.address);
      if (touched) {
        touched.pending = pending ? `${pending} invalidations` : "";
        touched.acks = step.filter((message) => message.kind === "InvAck").length;
      }
      shots.push(shot);
      return;
    }
    shots.push(view(lines, messages, cycle, step, step.at(-1)?.detail ?? "Directory updated", focus, totals));
  });
  return { shots, final: shots[shots.length - 1] ?? shots[0]! };
}

export const DIR_PRESETS: Array<{ id: string; label: string; cores: number; seed: Record<number, number>; requests: DirRequest[] }> = [
  { id: "cold", label: "Cold read", cores: 4, seed: { [A]: 10 }, requests: [{ core: 0, op: "read", address: A }] },
  { id: "readers", label: "Multiple readers", cores: 4, seed: { [A]: 10 }, requests: [0, 1, 2].map((core) => ({ core, op: "read" as const, address: A })) },
  { id: "writer", label: "Shared line, then a writer", cores: 4, seed: { [A]: 10 }, requests: [{ core: 0, op: "read", address: A }, { core: 2, op: "read", address: A }, { core: 1, op: "write", address: A, value: 40 }] },
  { id: "owner-read", label: "Modified owner, then a reader", cores: 4, seed: { [A]: 10 }, requests: [{ core: 0, op: "write", address: A, value: 25 }, { core: 3, op: "read", address: A }] },
  { id: "owner-write", label: "Modified owner, then a new writer", cores: 4, seed: { [A]: 10 }, requests: [{ core: 2, op: "write", address: A, value: 25 }, { core: 0, op: "write", address: A, value: 70 }] },
  { id: "few", label: "Many cores, few sharers", cores: 8, seed: { [A]: 10 }, requests: [{ core: 0, op: "read", address: A }, { core: 2, op: "read", address: A }, { core: 4, op: "read", address: A }, { core: 1, op: "write", address: A, value: 9 }] },
  { id: "migration", label: "Ownership migration", cores: 4, seed: { [A]: 10 }, requests: [{ core: 0, op: "write", address: A, value: 11 }, { core: 1, op: "write", address: A, value: 22 }, { core: 3, op: "write", address: A, value: 33 }] },
];
