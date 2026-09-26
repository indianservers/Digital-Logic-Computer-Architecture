import { runDirectory, type DirMessage, type DirRequest } from "./directory";

export const FABRIC_LATENCY = {
  bus: 4,
  probe: 1,
  lookup: 8,
  hop: 2,
  ack: 2,
  data: 6,
};

export interface FabricRequest {
  core: number;
  op: "read" | "write";
  address: number;
  value?: number;
}

export interface FabricEvent {
  cycle: number;
  core: number;
  model: "snoop" | "directory";
  event: string;
  detail: string;
}

export interface ScalePoint {
  cores: number;
  snoopMessages: number;
  directoryMessages: number;
  snoopLatency: number;
  directoryLatency: number;
}

export interface FabricShot {
  cycle: number;
  event: string;
  log: FabricEvent[];
  step: FabricEvent[];
  snoopMessages: number;
  directoryMessages: number;
  broadcasts: number;
  probes: number;
  lookups: number;
  invalidations: number;
  acks: number;
  dataTransfers: number;
  snoopLatency: number;
  directoryLatency: number;
  snoopBytes: number;
  directoryBytes: number;
  avgSharers: number;
  touched: number;
}

export interface FabricResult {
  shots: FabricShot[];
  final: FabricShot;
  memory: number;
  owner: number | null;
  value: number;
  scale: ScalePoint[];
  directoryBits: number;
  snoopBits: number;
}

const CONTROL = 8;
const DATA_BYTES = 64;
const A = 0x1000;
const B = 0x2000;

export function snoopLatency(cores: number, sharers: number, hit: boolean) {
  if (hit) return 1;
  return FABRIC_LATENCY.bus + FABRIC_LATENCY.probe * Math.max(0, cores - 1) + FABRIC_LATENCY.ack * sharers + FABRIC_LATENCY.data;
}

export function directoryLatency(cores: number, sharers: number, hit: boolean) {
  if (hit) return 1;
  const hops = Math.ceil(Math.log2(Math.max(2, cores)));
  return FABRIC_LATENCY.lookup + FABRIC_LATENCY.hop * hops + FABRIC_LATENCY.ack * sharers + FABRIC_LATENCY.data;
}

export function scaleTraffic(sharers: number, widths = [4, 8, 16, 32]): ScalePoint[] {
  const holders = Math.max(0, sharers);
  return widths.map((cores) => ({
    cores,
    snoopMessages: 1 + Math.max(0, cores - 1) + holders,
    directoryMessages: 2 + 2 * holders,
    snoopLatency: snoopLatency(cores, holders, false),
    directoryLatency: directoryLatency(cores, holders, false),
  }));
}

function snoopEvents(cores: number, request: FabricRequest, step: DirMessage[], invalidated: number[]): FabricEvent[] {
  const network = step.filter((message) => message.network);
  if (network.length === 0) {
    return [{ cycle: step[0]?.cycle ?? 0, core: request.core, model: "snoop", event: "Hit", detail: "L1 hit. The bus stays idle." }];
  }
  const cycle = network[0]?.cycle ?? 0;
  const events: FabricEvent[] = [
    { cycle, core: request.core, model: "snoop", event: request.op === "write" ? "BusRdX" : "BusRd", detail: `Broadcast to ${Math.max(0, cores - 1)} other caches` },
  ];
  if (invalidated.length) events.push({ cycle, core: request.core, model: "snoop", event: "Invalidate", detail: `Sharers respond: ${invalidated.map((core) => `C${core}`).join(", ")}` });
  if (step.some((message) => message.kind === "Data" || message.kind === "PutM")) {
    events.push({ cycle, core: request.core, model: "snoop", event: "Data", detail: "Data response on the shared bus" });
  }
  events.push({ cycle, core: request.core, model: "snoop", event: "Snoop done", detail: "Every cache has observed the request" });
  return events;
}

function directoryEvents(request: FabricRequest, step: DirMessage[]): FabricEvent[] {
  if (step.length === 0) return [{ cycle: 0, core: request.core, model: "directory", event: "Hit", detail: "L1 hit. The directory is not consulted." }];
  return step.filter((message) => message.network || message.kind === "Lookup").map((message) => ({
    cycle: message.cycle,
    core: request.core,
    model: "directory" as const,
    event: message.kind,
    detail: `${message.source} → ${message.destination}. ${message.detail}`,
  }));
}

export function compareFabric(cores: number, requests: FabricRequest[], seed: Record<number, number> = {}): FabricResult {
  const width = Math.max(1, cores);
  const directory = runDirectory(width, requests.filter((item) => item.core < width) as DirRequest[], seed);
  const log: FabricEvent[] = [];
  const totals = { snoopMessages: 0, directoryMessages: 0, broadcasts: 0, probes: 0, lookups: 0, invalidations: 0, acks: 0, dataTransfers: 0, snoopLatency: 0, directoryLatency: 0, snoopBytes: 0, directoryBytes: 0, sharerSum: 0, transactions: 0, touched: 0 };
  const shots: FabricShot[] = [];
  const pushShot = (cycle: number, event: string, step: FabricEvent[]) => {
    shots.push({
      cycle,
      event,
      log: log.slice(),
      step,
      snoopMessages: totals.snoopMessages,
      directoryMessages: totals.directoryMessages,
      broadcasts: totals.broadcasts,
      probes: totals.probes,
      lookups: totals.lookups,
      invalidations: totals.invalidations,
      acks: totals.acks,
      dataTransfers: totals.dataTransfers,
      snoopLatency: totals.transactions ? totals.snoopLatency / totals.transactions : 0,
      directoryLatency: totals.transactions ? totals.directoryLatency / totals.transactions : 0,
      snoopBytes: totals.snoopBytes,
      directoryBytes: totals.directoryBytes,
      avgSharers: totals.transactions ? totals.sharerSum / totals.transactions : 0,
      touched: totals.touched,
    });
  };
  pushShot(0, "Both fabrics start from the same memory image", []);
  requests.forEach((request, index) => {
    const shot = directory.shots[index + 1];
    if (!shot || request.core >= width) return;
    const step = shot.step;
    const hit = step.length === 0 || step.every((message) => !message.network);
    const invalidated = shot.invalidated;
    const snoop = snoopEvents(width, request, step, invalidated);
    const directed = directoryEvents(request, step);
    const data = step.some((message) => message.kind === "Data" || message.kind === "PutM");
    totals.transactions += 1;
    totals.sharerSum += invalidated.length;
    if (hit) {
      totals.snoopLatency += 1;
      totals.directoryLatency += 1;
    } else {
      const probes = Math.max(0, width - 1);
      totals.broadcasts += 1;
      totals.probes += probes;
      totals.invalidations += invalidated.length;
      totals.acks += invalidated.length;
      totals.dataTransfers += data ? 1 : 0;
      totals.snoopMessages += 1 + probes + invalidated.length + (data ? 1 : 0);
      totals.snoopBytes += (1 + probes + invalidated.length) * CONTROL + (data ? DATA_BYTES : 0);
      totals.snoopLatency += snoopLatency(width, invalidated.length, false);
      const network = step.filter((message) => message.network);
      totals.directoryMessages += network.length;
      totals.lookups += 1;
      totals.directoryBytes += network.reduce((sum, message) => sum + (message.kind === "Data" || message.kind === "PutM" ? CONTROL + DATA_BYTES : CONTROL), 0);
      totals.directoryLatency += directoryLatency(width, invalidated.length, false);
      totals.touched += probes;
    }
    const combined = [...snoop, ...directed];
    combined.forEach((item) => log.push(item));
    pushShot(index + 1, shot.event, combined);
  });
  const focus = directory.final.lines.find((line) => line.address === (requests[0]?.address ?? A)) ?? directory.final.lines[0];
  const ownerCopy = focus?.owner !== null && focus?.owner !== undefined ? focus.copies[focus.owner] : undefined;
  const holders = focus ? (focus.state === "S" ? focus.sharers.length : focus.state === "M" ? 1 : 0) : 0;
  const final = shots[shots.length - 1] ?? shots[0];
  return {
    shots,
    final: final!,
    memory: focus?.memory ?? 0,
    owner: focus?.owner ?? null,
    value: ownerCopy?.value ?? focus?.copies.find((copy) => copy.state !== "I")?.value ?? focus?.memory ?? 0,
    scale: scaleTraffic(holders || Math.round(final?.avgSharers ?? 0)),
    directoryBits: width,
    snoopBits: 0,
  };
}

const read = (core: number, address = A): FabricRequest => ({ core, op: "read", address });
const write = (core: number, value: number, address = A): FabricRequest => ({ core, op: "write", address, value });

export const FABRIC_PRESETS: Array<{ id: string; label: string; cores: number; seed: Record<number, number>; requests: FabricRequest[] }> = [
  { id: "private", label: "Private data", cores: 8, seed: { [A]: 10 }, requests: [read(0), write(0, 20)] },
  { id: "share", label: "Read sharing", cores: 8, seed: { [A]: 10 }, requests: [0, 1, 2].map((core) => read(core)) },
  { id: "writer", label: "One writer, many sharers", cores: 8, seed: { [A]: 10 }, requests: [read(0), read(1), read(2), write(3, 40)] },
  { id: "ping", label: "Ping-pong ownership", cores: 8, seed: { [A]: 10 }, requests: [write(0, 1), write(1, 2), write(0, 3)] },
  { id: "sparse", label: "Sparse sharing", cores: 8, seed: { [A]: 10 }, requests: [read(0), read(2), write(1, 9)] },
  { id: "sparse-wide", label: "Many-core sparse sharing", cores: 16, seed: { [A]: 10, [B]: 4 }, requests: [read(0), read(4), write(1, 9), read(2, B), write(8, 7, B)] },
  { id: "dense", label: "Many-core dense sharing", cores: 8, seed: { [A]: 10 }, requests: [...[0, 1, 2, 3, 4, 5, 6].map((core) => read(core)), write(7, 11)] },
];
