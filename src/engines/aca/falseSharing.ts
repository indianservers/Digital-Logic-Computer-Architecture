export const SHARE_BASE = 0x10000000;
export const LOCAL_COST = 1;
export const MISS_COST = 4;
export const TRANSFER_COST = 12;

export interface ShareVar {
  name: string;
  offset: number;
  bytes: number;
  core: number;
  value: number;
}

export interface ShareOp {
  core: number;
  name: string;
  op: "read" | "write" | "inc";
  value?: number;
}

export type ShareKind = "local" | "cold" | "true" | "false";

export interface ShareEvent {
  index: number;
  core: number;
  name: string;
  op: ShareOp["op"];
  address: number;
  line: number;
  kind: ShareKind;
  invalidated: number[];
  ownerBefore: number | null;
  ownerAfter: number | null;
  migration: boolean;
  cost: number;
}

export interface ShareShot {
  cycle: number;
  events: ShareEvent[];
  values: Record<string, number>;
  owners: Record<number, number | null>;
  event: string;
  writes: number;
  reads: number;
  invalidations: number;
  transfers: number;
  migrations: number;
  misses: number;
  falseEvents: number;
  trueEvents: number;
  cycles: number;
}

export interface ShareResult {
  shots: ShareShot[];
  final: ShareShot;
  placed: ShareVar[];
  sample: ShareEvent[];
}

interface LineOwn {
  owner: number | null;
  lastName: string | null;
  lastCore: number | null;
}

export function lineId(offset: number, lineBytes: number, base = SHARE_BASE) {
  const size = Math.max(1, lineBytes);
  return Math.floor((base + offset) / size);
}

export function placeVars(variables: ShareVar[], lineBytes: number, padding: boolean): ShareVar[] {
  if (!padding) return variables.map((item) => ({ ...item }));
  return variables.map((item, index) => ({ ...item, offset: index * Math.max(1, lineBytes) }));
}

export function sameLine(left: number, right: number, lineBytes: number) {
  return lineId(left, lineBytes) === lineId(right, lineBytes);
}

function snapshot(cycle: number, events: ShareEvent[], values: Map<string, number>, owners: Map<number, number | null>, event: string, totals: Omit<ShareShot, "cycle" | "events" | "values" | "owners" | "event">): ShareShot {
  return {
    cycle,
    events: events.slice(),
    values: Object.fromEntries(values),
    owners: Object.fromEntries(owners),
    event,
    ...totals,
  };
}

export function runFalseShare(variables: ShareVar[], ops: ShareOp[], lineBytes = 64, padding = false, sampleLimit = 50): ShareResult {
  const placed = placeVars(variables, lineBytes, padding);
  const byName = new Map(placed.map((item) => [item.name, item]));
  const values = new Map(placed.map((item) => [item.name, item.value]));
  const lines = new Map<number, LineOwn>();
  const owners = new Map<number, number | null>();
  placed.forEach((item) => owners.set(lineId(item.offset, lineBytes), null));
  const sample: ShareEvent[] = [];
  const totals = { writes: 0, reads: 0, invalidations: 0, transfers: 0, migrations: 0, misses: 0, falseEvents: 0, trueEvents: 0, cycles: 0 };
  const shots: ShareShot[] = [snapshot(0, sample, values, owners, "Variables are placed. No core owns a line yet.", totals)];
  ops.forEach((op, index) => {
    const variable = byName.get(op.name);
    if (!variable) {
      shots.push(snapshot(index + 1, sample, values, owners, "Ignored operation", totals));
      return;
    }
    const address = SHARE_BASE + variable.offset;
    const line = lineId(variable.offset, lineBytes);
    const own = lines.get(line) ?? { owner: null, lastName: null, lastCore: null };
    const ownerBefore = own.owner;
    let kind: ShareKind = "local";
    let cost = LOCAL_COST;
    const invalidated: number[] = [];
    let migration = false;
    if (op.op === "read") totals.reads += 1;
    else totals.writes += 1;
    if (op.op !== "read" && own.owner !== op.core) {
      if (own.owner === null) {
        kind = "cold";
        cost = MISS_COST;
        totals.misses += 1;
      } else {
        kind = own.lastName === variable.name ? "true" : "false";
        cost = TRANSFER_COST;
        invalidated.push(own.owner);
        totals.invalidations += 1;
        totals.transfers += 1;
        totals.migrations += 1;
        migration = true;
        if (kind === "true") totals.trueEvents += 1;
        else totals.falseEvents += 1;
      }
      own.owner = op.core;
    } else if (op.op === "read" && own.owner !== null && own.owner !== op.core) {
      kind = own.lastName === variable.name ? "true" : "false";
      cost = MISS_COST;
      totals.misses += 1;
      if (kind === "true") totals.trueEvents += 1;
      else totals.falseEvents += 1;
    }
    if (op.op === "inc") values.set(variable.name, (values.get(variable.name) ?? 0) + 1);
    if (op.op === "write") values.set(variable.name, op.value ?? values.get(variable.name) ?? 0);
    if (op.op !== "read") {
      own.lastName = variable.name;
      own.lastCore = op.core;
    }
    lines.set(line, own);
    owners.set(line, own.owner);
    totals.cycles += cost;
    const record: ShareEvent = { index: index + 1, core: op.core, name: variable.name, op: op.op, address, line, kind, invalidated, ownerBefore, ownerAfter: own.owner, migration, cost };
    if (sample.length < sampleLimit) sample.push(record);
    const note = kind === "false"
      ? `${variable.name} is a different variable on the same line. Core ${ownerBefore} is invalidated.`
      : kind === "true"
        ? `${variable.name} is the same variable. The transfer is true sharing.`
        : kind === "cold"
          ? `${variable.name} misses into Core ${op.core}.`
          : `${variable.name} hits in Core ${op.core}.`;
    shots.push(snapshot(index + 1, sample, values, owners, note, totals));
  });
  return { shots, final: shots[shots.length - 1] ?? shots[0]!, placed, sample };
}

export function repeatOps(variables: ShareVar[], rounds: number, op: ShareOp["op"] = "inc", extraCores: number[] = []): ShareOp[] {
  const ops: ShareOp[] = [];
  const shared = variables[0];
  for (let round = 0; round < rounds; round += 1) {
    variables.forEach((item) => ops.push({ core: item.core, name: item.name, op }));
    if (shared) extraCores.forEach((core) => ops.push({ core, name: shared.name, op }));
  }
  return ops;
}

export function shareReduction(variables: ShareVar[], rounds: number, lineBytes: number, extraCores: number[] = []) {
  const ops = repeatOps(variables, rounds, "inc", extraCores);
  const plain = runFalseShare(variables, ops, lineBytes, false);
  const padded = runFalseShare(variables, ops, lineBytes, true);
  const baseline = plain.final.invalidations;
  const reduction = baseline === 0 ? 0 : Math.round(((baseline - padded.final.invalidations) / baseline) * 100);
  const ratio = padded.final.cycles === 0 ? 1 : plain.final.cycles / padded.final.cycles;
  return { plain, padded, reduction, ratio };
}

const counter = (name: string, offset: number, core: number, bytes = 4): ShareVar => ({ name, offset, bytes, core, value: 0 });

export const SHARE_PRESETS: Array<{ id: string; label: string; mode: "false" | "true" | "none"; lineBytes: number; padding: boolean; rounds: number; extra: number[]; variables: ShareVar[] }> = [
  { id: "apart", label: "Separate cache lines", mode: "none", lineBytes: 64, padding: false, rounds: 8, extra: [], variables: [counter("counter0", 0, 0), counter("counter1", 64, 1)] },
  { id: "same", label: "Two counters, same line", mode: "false", lineBytes: 64, padding: false, rounds: 8, extra: [], variables: [counter("counter0", 0, 0), counter("counter1", 8, 1)] },
  { id: "true", label: "True-sharing counter", mode: "true", lineBytes: 64, padding: false, rounds: 8, extra: [1], variables: [counter("counter", 0, 0)] },
  { id: "padded", label: "Padded counters", mode: "false", lineBytes: 64, padding: true, rounds: 8, extra: [], variables: [counter("counter0", 0, 0), counter("counter1", 8, 1)] },
  { id: "three", label: "Three-thread false sharing", mode: "false", lineBytes: 64, padding: false, rounds: 6, extra: [], variables: [counter("counter0", 0, 0), counter("counter1", 8, 1), counter("counter2", 16, 2)] },
  { id: "array", label: "Array of counters", mode: "false", lineBytes: 64, padding: false, rounds: 4, extra: [], variables: [0, 1, 2, 3].map((core) => counter(`counter${core}`, core * 4, core)) },
  { id: "struct", label: "Packed structure", mode: "false", lineBytes: 64, padding: false, rounds: 8, extra: [], variables: [{ name: "flag", offset: 0, bytes: 1, core: 0, value: 0 }, counter("counter", 1, 1)] },
];
