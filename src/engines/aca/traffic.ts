import { runCoherence, type Access, type LineCopy, type Protocol } from "./coherenceLab";
import { runDirectory, type DirRequest } from "./directory";
import { SHARE_BASE, lineId, runFalseShare, type ShareOp, type ShareVar } from "./falseSharing";

export const CONTROL_BYTES = 8;

export type TrafficCategory = "read" | "write" | "invalidation" | "upgrade" | "writeback" | "data" | "ack" | "migration" | "directory" | "silent" | "hit";

export interface TrafficOptions {
  lineBytes?: number;
  writeAllocate?: boolean;
  silentUpgrades?: boolean;
}

export interface TrafficRow {
  cycle: number;
  core: number;
  op: string;
  address: number;
  message: string;
  source: string;
  destination: string;
  bytes: number;
  controlBytes: number;
  dataBytes: number;
  before: string;
  after: string;
  cause: string;
  category: TrafficCategory;
}

export interface CoreTraffic {
  core: number;
  sent: number;
  received: number;
  invalidationsSent: number;
  invalidationsReceived: number;
  dataSent: number;
  dataReceived: number;
  acquired: number;
  lost: number;
  writebacks: number;
  read: number;
  write: number;
  upgrade: number;
  invalidate: number;
}

export interface LineTraffic {
  address: number;
  messages: number;
  invalidations: number;
  migrations: number;
}

export interface TrafficReport {
  protocol: string;
  rows: TrafficRow[];
  cores: CoreTraffic[];
  lines: LineTraffic[];
  hotspot: LineTraffic | null;
  messages: number;
  reads: number;
  writes: number;
  invalidations: number;
  upgrades: number;
  writebacks: number;
  dataTransfers: number;
  cacheToCache: number;
  migrations: number;
  controlBytes: number;
  dataBytes: number;
  totalBytes: number;
}

const EMPTY: Omit<TrafficReport, "protocol" | "rows" | "cores" | "lines" | "hotspot"> = {
  messages: 0, reads: 0, writes: 0, invalidations: 0, upgrades: 0, writebacks: 0, dataTransfers: 0, cacheToCache: 0, migrations: 0, controlBytes: 0, dataBytes: 0, totalBytes: 0,
};

function row(partial: Omit<TrafficRow, "bytes">): TrafficRow {
  return { ...partial, bytes: partial.controlBytes + partial.dataBytes };
}

function exclusiveOwner(copies: LineCopy[]) {
  const modified = copies.findIndex((copy) => copy.state === "M");
  if (modified >= 0) return modified;
  const exclusive = copies.findIndex((copy) => copy.state === "E");
  if (exclusive >= 0) return exclusive;
  const owned = copies.findIndex((copy) => copy.state === "O");
  return owned >= 0 ? owned : null;
}

function finish(protocol: string, cores: number, rows: TrafficRow[], acquired: number[], lost: number[]): TrafficReport {
  const report: TrafficReport = { protocol, rows, cores: [], lines: [], hotspot: null, ...EMPTY };
  const byCore = Array.from({ length: cores }, (_, core) => ({
    core, sent: 0, received: 0, invalidationsSent: 0, invalidationsReceived: 0, dataSent: 0, dataReceived: 0, acquired: acquired[core] ?? 0, lost: lost[core] ?? 0, writebacks: 0, read: 0, write: 0, upgrade: 0, invalidate: 0,
  }));
  const byLine = new Map<number, LineTraffic>();
  rows.forEach((item) => {
    if (item.bytes > 0) {
      report.messages += 1;
      report.controlBytes += item.controlBytes;
      report.dataBytes += item.dataBytes;
      report.totalBytes += item.bytes;
    }
    if (item.category === "read") report.reads += 1;
    if (item.category === "write") report.writes += 1;
    if (item.category === "invalidation") report.invalidations += 1;
    if (item.category === "upgrade") report.upgrades += 1;
    if (item.category === "writeback") report.writebacks += 1;
    if (item.category === "data") report.dataTransfers += 1;
    if (item.category === "data" && item.source.startsWith("Core")) report.cacheToCache += 1;
    if (item.category === "migration") report.migrations += 1;
    const line = byLine.get(item.address) ?? { address: item.address, messages: 0, invalidations: 0, migrations: 0 };
    if (item.bytes > 0) line.messages += 1;
    if (item.category === "invalidation") line.invalidations += 1;
    if (item.category === "migration") line.migrations += 1;
    byLine.set(item.address, line);
    const source = /^Core (\d+)$/.exec(item.source);
    const destination = /^Core (\d+)$/.exec(item.destination);
    const actor = source ? byCore[Number(source[1])] : undefined;
    if (actor && item.bytes > 0) actor.sent += 1;
    const receiver = destination ? byCore[Number(destination[1])] : undefined;
    if (receiver && item.bytes > 0) receiver.received += 1;
    if (item.category === "invalidation") {
      const sender = byCore[item.core];
      if (sender) sender.invalidationsSent += 1;
      if (receiver) receiver.invalidationsReceived += 1;
      if (sender) sender.invalidate += 1;
    }
    if (item.category === "data") {
      if (actor) actor.dataSent += item.dataBytes;
      if (receiver) receiver.dataReceived += item.dataBytes;
    }
    if (item.category === "writeback" && actor) actor.writebacks += 1;
    if (item.category === "read" && actor) actor.read += 1;
    if (item.category === "write" && actor) actor.write += 1;
    if (item.category === "upgrade" && actor) actor.upgrade += 1;
  });
  report.cores = byCore;
  report.lines = [...byLine.values()].sort((left, right) => right.messages - left.messages || right.invalidations - left.invalidations);
  report.hotspot = report.lines[0] ?? null;
  return report;
}

export function analyzeBus(protocol: Protocol, cores: number, accesses: Access[], seed: Record<number, number> = {}, options: TrafficOptions = {}): TrafficReport {
  const lineBytes = options.lineBytes ?? 64;
  const writeAllocate = options.writeAllocate ?? true;
  const silentUpgrades = options.silentUpgrades ?? true;
  const result = runCoherence(protocol, cores, accesses, seed);
  const rows: TrafficRow[] = [];
  const acquired = Array.from({ length: cores }, () => 0);
  const lost = Array.from({ length: cores }, () => 0);
  accesses.forEach((access, index) => {
    const prev = result.shots[index];
    const shot = result.shots[index + 1];
    const event = shot?.log[index];
    if (!prev || !shot || !event) return;
    const beforeLine = prev.lines.find((item) => item.address === access.address);
    const afterLine = shot.lines.find((item) => item.address === access.address);
    const before = beforeLine?.copies ?? [];
    const after = afterLine?.copies ?? [];
    const mineBefore = before[access.core]?.state ?? "I";
    const mineAfter = after[access.core]?.state ?? "I";
    const cause = event.detail;
    const base = { cycle: event.cycle, core: access.core, op: access.op, address: access.address, before: mineBefore, after: mineAfter };
    const control = (category: TrafficCategory, message: string, source: string, destination: string) => rows.push(row({ ...base, category, message, source, destination, cause, controlBytes: CONTROL_BYTES, dataBytes: 0 }));
    const data = (source: string, destination: string, message: string) => rows.push(row({ ...base, category: "data", message, source, destination, cause, controlBytes: 0, dataBytes: lineBytes }));
    if (event.bus === "Hit") {
      rows.push(row({ ...base, category: "hit", message: "Hit", source: `Core ${access.core}`, destination: `Core ${access.core}`, cause, controlBytes: 0, dataBytes: 0 }));
    } else if (event.bus === "Silent") {
      const counted = !silentUpgrades;
      rows.push(row({ ...base, category: counted ? "upgrade" : "silent", message: counted ? "Upgrade" : "Silent", source: `Core ${access.core}`, destination: counted ? "Bus" : `Core ${access.core}`, cause: counted ? `${cause} Counted as an upgrade because silent upgrades are off in this estimate.` : cause, controlBytes: counted ? CONTROL_BYTES : 0, dataBytes: 0 }));
    } else if (event.bus === "Evict") {
      rows.push(row({ ...base, category: "hit", message: "Clean evict", source: `Core ${access.core}`, destination: "Memory", cause, controlBytes: 0, dataBytes: 0 }));
    } else if (event.bus === "Writeback") {
      rows.push(row({ ...base, category: "writeback", message: "Writeback", source: `Core ${access.core}`, destination: "Memory", cause, controlBytes: CONTROL_BYTES, dataBytes: lineBytes }));
    } else if (event.bus === "BusRd") {
      control("read", "BusRd", `Core ${access.core}`, "Bus");
      data(event.source === "memory" ? "Memory" : event.source, `Core ${access.core}`, "Data");
      if (shot.writebacks > prev.writebacks) {
        const owner = exclusiveOwner(before);
        rows.push(row({ ...base, category: "writeback", message: "Writeback", source: owner === null ? "Memory" : `Core ${owner}`, destination: "Memory", cause, controlBytes: CONTROL_BYTES, dataBytes: lineBytes }));
      }
    } else if (event.bus === "BusRdX") {
      control("write", "BusRdX", `Core ${access.core}`, "Bus");
      if (writeAllocate) data(event.source.startsWith("Core") ? event.source : "Memory", `Core ${access.core}`, "Line fill");
    } else if (event.bus === "BusUpgr") {
      control("upgrade", "BusUpgr", `Core ${access.core}`, "Bus");
    }
    before.forEach((copy, core) => {
      const next = after[core];
      if (core !== access.core && copy.state !== "I" && next?.state === "I") {
        rows.push(row({ ...base, category: "invalidation", message: "Inv", source: `Core ${access.core}`, destination: `Core ${core}`, cause: `Core ${core} drops ${copy.state}`, controlBytes: CONTROL_BYTES, dataBytes: 0 }));
      }
    });
    const previousOwner = exclusiveOwner(before);
    const nextOwner = exclusiveOwner(after);
    if (previousOwner !== null && nextOwner !== null && previousOwner !== nextOwner) {
      rows.push(row({ ...base, category: "migration", message: "Migrate", source: `Core ${previousOwner}`, destination: `Core ${nextOwner}`, cause: "Exclusive owner changed", controlBytes: 0, dataBytes: 0 }));
      const winner = acquired[nextOwner] ?? 0;
      const loser = lost[previousOwner] ?? 0;
      acquired[nextOwner] = winner + 1;
      lost[previousOwner] = loser + 1;
    }
  });
  return finish(protocol, cores, rows, acquired, lost);
}

export function analyzeDirectory(cores: number, requests: DirRequest[], seed: Record<number, number> = {}, options: TrafficOptions = {}): TrafficReport {
  const lineBytes = options.lineBytes ?? 64;
  const result = runDirectory(cores, requests, seed);
  const rows: TrafficRow[] = [];
  const acquired = Array.from({ length: cores }, () => 0);
  const lost = Array.from({ length: cores }, () => 0);
  result.shots.slice(1).forEach((shot) => {
    shot.step.forEach((message) => {
      if (!message.network) return;
      const category: TrafficCategory = message.kind === "GetS" ? "read"
        : message.kind === "GetM" ? "write"
          : message.kind === "Inv" ? "invalidation"
            : message.kind === "InvAck" ? "ack"
              : message.kind === "Data" ? "data"
                : message.kind === "PutM" ? "writeback"
                  : "directory";
      const dataBytes = message.kind === "Data" || message.kind === "PutM" ? lineBytes : 0;
      const controlBytes = dataBytes > 0 ? CONTROL_BYTES : CONTROL_BYTES;
      const coreMatch = /^Core (\d+)$/.exec(message.source);
      rows.push(row({
        cycle: message.cycle,
        core: coreMatch ? Number(coreMatch[1]) : shot.requester ?? 0,
        op: message.kind,
        address: message.address,
        message: message.kind,
        source: message.source,
        destination: message.destination,
        controlBytes: message.kind === "Data" || message.kind === "PutM" ? CONTROL_BYTES : controlBytes,
        dataBytes,
        before: "",
        after: "",
        cause: message.detail,
        category,
      }));
    });
    if (shot.previousOwner !== null && shot.nextOwner !== null && shot.previousOwner !== shot.nextOwner) {
      rows.push(row({ cycle: shot.cycle, core: shot.nextOwner, op: "write", address: shot.step[0]?.address ?? 0, message: "Migrate", source: `Core ${shot.previousOwner}`, destination: `Core ${shot.nextOwner}`, controlBytes: 0, dataBytes: 0, before: "M", after: "M", cause: "Directory owner changed", category: "migration" }));
      acquired[shot.nextOwner] = (acquired[shot.nextOwner] ?? 0) + 1;
      lost[shot.previousOwner] = (lost[shot.previousOwner] ?? 0) + 1;
    }
  });
  return finish("directory", cores, rows, acquired, lost);
}

export function analyzeLayout(variables: ShareVar[], ops: ShareOp[], lineBytes = 64, padding = false): TrafficReport {
  const result = runFalseShare(variables, ops, lineBytes, padding, ops.length);
  const rows: TrafficRow[] = [];
  const acquired = [0, 0, 0, 0];
  const lost = [0, 0, 0, 0];
  result.sample.forEach((event) => {
    const address = lineId(event.address - SHARE_BASE, lineBytes) * lineBytes;
    const base = { cycle: event.index, core: event.core, op: event.op, address, before: "", after: "", cause: event.kind };
    if (event.kind === "cold") rows.push(row({ ...base, category: "read", message: "Fill", source: "Memory", destination: `Core ${event.core}`, controlBytes: CONTROL_BYTES, dataBytes: lineBytes }));
    if (event.migration) {
      event.invalidated.forEach((core) => rows.push(row({ ...base, category: "invalidation", message: "Inv", source: `Core ${event.core}`, destination: `Core ${core}`, controlBytes: CONTROL_BYTES, dataBytes: 0, cause: event.kind === "false" ? "False sharing" : "True sharing" })));
      rows.push(row({ ...base, category: "data", message: "Data", source: event.ownerBefore === null ? "Memory" : `Core ${event.ownerBefore}`, destination: `Core ${event.core}`, controlBytes: 0, dataBytes: lineBytes, cause: event.kind }));
      rows.push(row({ ...base, category: "migration", message: "Migrate", source: `Core ${event.ownerBefore}`, destination: `Core ${event.core}`, controlBytes: 0, dataBytes: 0, cause: event.kind }));
      if (event.ownerBefore !== null) lost[event.ownerBefore] = (lost[event.ownerBefore] ?? 0) + 1;
      acquired[event.core] = (acquired[event.core] ?? 0) + 1;
    }
  });
  return finish("layout", 4, rows, acquired, lost);
}

export function filterTraffic(rows: TrafficRow[], filter: { core?: number | null; address?: number | null; category?: TrafficCategory | "all" }) {
  return rows.filter((item) => {
    if (item.category === "hit") return false;
    if (filter.core !== undefined && filter.core !== null && item.core !== filter.core) return false;
    if (filter.address !== undefined && filter.address !== null && item.address !== filter.address) return false;
    if (filter.category && filter.category !== "all" && item.category !== filter.category) return false;
    return true;
  });
}

const A = 0x1000;

export const TRAFFIC_PRESETS: Array<{ id: string; label: string; protocol: Protocol | "directory"; accesses: Access[]; seed?: Record<number, number> }> = [
  { id: "private", label: "Private data", protocol: "mesi", accesses: [{ core: 0, op: "read", address: A }, { core: 0, op: "write", address: A, value: 20 }] },
  { id: "share", label: "Read sharing", protocol: "mesi", accesses: [{ core: 0, op: "read", address: A }, { core: 1, op: "read", address: A }, { core: 2, op: "read", address: A }] },
  { id: "producer", label: "Producer / consumer", protocol: "mesi", seed: { [A]: 10 }, accesses: [{ core: 0, op: "read", address: A }, { core: 0, op: "write", address: A, value: 25 }, { core: 1, op: "read", address: A }] },
  { id: "true", label: "True sharing", protocol: "mesi", accesses: [{ core: 0, op: "write", address: A, value: 1 }, { core: 1, op: "read", address: A }, { core: 1, op: "write", address: A, value: 2 }] },
  { id: "false", label: "False sharing", protocol: "directory", accesses: [] },
  { id: "ping", label: "Ping-pong ownership", protocol: "mesi", accesses: [{ core: 0, op: "write", address: A, value: 1 }, { core: 1, op: "write", address: A, value: 2 }, { core: 0, op: "write", address: A, value: 3 }] },
  { id: "readmostly", label: "Read-mostly", protocol: "mesi", accesses: [{ core: 0, op: "read", address: A }, { core: 1, op: "read", address: A }, { core: 2, op: "read", address: A }, { core: 3, op: "read", address: A }, { core: 0, op: "write", address: A, value: 4 }] },
  { id: "write", label: "Write-intensive", protocol: "mesi", accesses: [{ core: 0, op: "write", address: A, value: 1 }, { core: 1, op: "write", address: A, value: 2 }, { core: 2, op: "write", address: A, value: 3 }, { core: 3, op: "write", address: A, value: 4 }] },
];
