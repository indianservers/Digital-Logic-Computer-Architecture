export type PrefetcherKind = "none" | "next" | "stride" | "stream" | "correlation";

export interface PrefetchOptions {
  degree: number;
  confidence: number;
  distance: number;
  queueSize: number;
  blockBytes: number;
  cacheLines: number;
  missLatency: number;
  filterPollution: boolean;
}

export interface PrefetchEvent {
  cycle: number;
  address: number;
  kind: "demand" | "prefetch";
  result: "hit" | "miss" | "useful" | "late" | "useless" | "drop" | "issued";
  detail: string;
}

export interface PrefetchResult {
  kind: PrefetcherKind;
  events: PrefetchEvent[];
  issuedAddresses: number[];
  demandAccesses: number;
  demandHits: number;
  demandMisses: number;
  issued: number;
  useful: number;
  useless: number;
  late: number;
  dropped: number;
  pollution: number;
  accuracy: number;
  coverage: number;
  hitRate: number;
  demandBytes: number;
  prefetchBytes: number;
  usefulBytes: number;
  wastedBytes: number;
  missReduction: number;
  series: number[];
  baselineMisses: number;
}

export const PREFETCH_DEFAULTS: PrefetchOptions = {
  degree: 1,
  confidence: 0.5,
  distance: 1,
  queueSize: 4,
  blockBytes: 64,
  cacheLines: 4,
  missLatency: 0,
  filterPollution: false,
};

interface Line {
  block: number;
  source: "demand" | "prefetch";
  used: boolean;
  tick: number;
}

interface Flight {
  block: number;
  arrival: number;
  kind: "demand" | "prefetch";
  late: boolean;
}

const KINDS: PrefetcherKind[] = ["none", "next", "stride", "stream", "correlation"];

export function blockOf(address: number, blockBytes: number) {
  const size = Math.max(1, blockBytes);
  return Math.floor(address / size) * size;
}

function ratio(part: number, whole: number) {
  if (whole <= 0) return 0;
  return part / whole;
}

export function runPrefetch(kind: PrefetcherKind, addresses: number[], options: PrefetchOptions = PREFETCH_DEFAULTS, baselineMisses?: number): PrefetchResult {
  const blockBytes = Math.max(1, options.blockBytes);
  const cache: Line[] = [];
  const outstanding = new Map<number, Flight>();
  const displaced = new Set<number>();
  const events: PrefetchEvent[] = [];
  const issuedAddresses: number[] = [];
  const series: number[] = [];
  let cycle = 0;
  let tick = 1;
  let demandAccesses = 0;
  let demandHits = 0;
  let demandMisses = 0;
  let issued = 0;
  let useful = 0;
  let late = 0;
  let dropped = 0;
  let pollution = 0;
  let last: number | null = null;
  let delta = 0;
  let confidence = 0;
  const links = new Map<number, Map<number, number>>();
  const find = (block: number) => cache.find((line) => line.block === block);
  const complete = (now: number) => {
    [...outstanding.values()].filter((flight) => flight.arrival <= now).forEach((flight) => {
      outstanding.delete(flight.block);
      install(flight.block, flight.kind === "demand" || flight.late ? "demand" : "prefetch", flight.kind === "prefetch");
    });
  };
  const install = (block: number, source: "demand" | "prefetch", fromPrefetch: boolean) => {
    if (find(block)) return;
    if (fromPrefetch && options.filterPollution && cache.length >= options.cacheLines && cache.some((line) => line.source === "demand")) {
      dropped += 1;
      events.push({ cycle, address: block, kind: "prefetch", result: "drop", detail: "Filtered to avoid evicting a demand line" });
      return;
    }
    if (cache.length >= Math.max(1, options.cacheLines)) {
      const victim = cache.reduce((oldest, line) => line.tick < oldest.tick ? line : oldest);
      const index = cache.indexOf(victim);
      if (index >= 0) cache.splice(index, 1);
      if (fromPrefetch && victim.source === "demand") displaced.add(victim.block);
    }
    cache.push({ block, source, used: false, tick: tick++ });
  };
  const launch = (block: number, prefetch: boolean) => {
    if (find(block) || outstanding.has(block)) return false;
    if (prefetch && outstanding.size >= Math.max(1, options.queueSize)) {
      dropped += 1;
      events.push({ cycle, address: block, kind: "prefetch", result: "drop", detail: "Prefetch queue is full" });
      return false;
    }
    const arrival = cycle + Math.max(0, options.missLatency);
    outstanding.set(block, { block, arrival, kind: prefetch ? "prefetch" : "demand", late: false });
    if (options.missLatency <= 0) complete(cycle);
    if (prefetch) {
      issued += 1;
      issuedAddresses.push(block);
      events.push({ cycle, address: block, kind: "prefetch", result: "issued", detail: "Prefetch issued" });
    }
    return true;
  };
  const predict = (block: number): number[] => {
    const degree = Math.max(0, options.degree);
    const distance = Math.max(1, options.distance);
    if (kind === "next") return Array.from({ length: degree }, (_, index) => block + blockBytes * (distance + index));
    if (kind === "stride" && confidence >= options.confidence && delta !== 0) {
      return Array.from({ length: degree }, (_, index) => block + delta * (distance + index));
    }
    if (kind === "stream" && last !== null && (block - last === blockBytes || block - last === -blockBytes)) {
      const direction = block - last > 0 ? 1 : -1;
      return Array.from({ length: degree }, (_, index) => block + direction * blockBytes * (distance + index));
    }
    if (kind === "correlation") {
      const row = links.get(block);
      if (!row) return [];
      return [...row.entries()].filter((entry) => entry[1] >= 2).sort((left, right) => right[1] - left[1]).slice(0, degree).map((entry) => entry[0]);
    }
    return [];
  };
  addresses.forEach((address) => {
    cycle += 1;
    complete(cycle);
    const block = blockOf(address, blockBytes);
    demandAccesses += 1;
    const resident = find(block);
    if (resident) {
      resident.tick = tick++;
      if (resident.source === "prefetch" && !resident.used) {
        resident.used = true;
        resident.source = "demand";
        useful += 1;
        demandHits += 1;
        events.push({ cycle, address: block, kind: "demand", result: "useful", detail: "Demand hit a line installed by prefetch" });
      } else {
        demandHits += 1;
        events.push({ cycle, address: block, kind: "demand", result: "hit", detail: "Demand hit" });
      }
    } else {
      const flight = outstanding.get(block);
      if (flight && flight.kind === "prefetch") {
        flight.late = true;
        late += 1;
        demandMisses += 1;
        events.push({ cycle, address: block, kind: "demand", result: "late", detail: "Demand arrived before the prefetch" });
      } else if (!flight) {
        if (displaced.has(block)) { pollution += 1; displaced.delete(block); }
        demandMisses += 1;
        launch(block, false);
        events.push({ cycle, address: block, kind: "demand", result: "miss", detail: "Demand miss" });
      } else {
        demandMisses += 1;
        events.push({ cycle, address: block, kind: "demand", result: "miss", detail: "Demand merged with its own fill" });
      }
    }
    if (last !== null) {
      const nextDelta = block - last;
      if (kind === "stride") {
        if (nextDelta === delta && nextDelta !== 0) confidence = Math.min(1, confidence + 0.25);
        else { delta = nextDelta; confidence = nextDelta === 0 ? 0 : 0.25; }
      }
      const row = links.get(last) ?? new Map<number, number>();
      row.set(block, (row.get(block) ?? 0) + 1);
      links.set(last, row);
    }
    predict(block).forEach((target) => launch(target, true));
    last = block;
    series.push(demandAccesses ? demandHits / demandAccesses : 0);
  });
  complete(cycle + Math.max(0, options.missLatency));
  const useless = Math.max(0, issued - useful - late);
  const base = baselineMisses ?? demandMisses;
  const eliminated = base - demandMisses;
  return {
    kind,
    events,
    issuedAddresses,
    demandAccesses,
    demandHits,
    demandMisses,
    issued,
    useful,
    useless,
    late,
    dropped,
    pollution,
    accuracy: ratio(useful, issued),
    coverage: ratio(Math.max(0, eliminated), base),
    hitRate: ratio(demandHits, demandAccesses),
    demandBytes: demandMisses * blockBytes,
    prefetchBytes: issued * blockBytes,
    usefulBytes: useful * blockBytes,
    wastedBytes: useless * blockBytes,
    missReduction: base === 0 ? 0 : eliminated / base,
    series,
    baselineMisses: base,
  };
}

export function comparePrefetchers(addresses: number[], options: PrefetchOptions = PREFETCH_DEFAULTS) {
  const baseline = runPrefetch("none", addresses, options);
  const results = Object.fromEntries(KINDS.map((kind) => [kind, runPrefetch(kind, addresses, options, baseline.demandMisses)])) as Record<PrefetcherKind, PrefetchResult>;
  return { baseline, results };
}

function range(start: number, count: number, step: number) {
  return Array.from({ length: count }, (_, index) => start + index * step);
}

export const PREFETCH_PRESETS: Array<{ id: string; label: string; kind: PrefetcherKind; addresses: number[] }> = [
  { id: "sequential", label: "Sequential", kind: "next", addresses: range(0x1000, 12, 0x40) },
  { id: "stride", label: "Fixed stride", kind: "stride", addresses: range(0x1000, 8, 0x80) },
  { id: "reverse", label: "Reverse stream", kind: "stream", addresses: range(0x1000, 8, 0x40).reverse() },
  { id: "multi", label: "Multiple streams", kind: "stream", addresses: [0x1000, 0x3000, 0x1040, 0x3040, 0x1080, 0x3080, 0x10c0, 0x30c0] },
  { id: "irregular", label: "Irregular", kind: "none", addresses: [0x1000, 0x5000, 0x1040, 0x2200, 0x1080, 0x8000] },
  { id: "correlated", label: "Correlated", kind: "correlation", addresses: [0x1000, 0x1800, 0x1000, 0x1800, 0x1000, 0x1800] },
  { id: "random", label: "Random seeded", kind: "none", addresses: (() => { let seed = 7; return Array.from({ length: 12 }, () => { seed = (seed * 17 + 3) % 8; return 0x1000 + seed * 0x40; }); })() },
  { id: "phase", label: "Phase changing", kind: "next", addresses: [...range(0x1000, 6, 0x40), ...range(0x3000, 6, 0x80)] },
];
