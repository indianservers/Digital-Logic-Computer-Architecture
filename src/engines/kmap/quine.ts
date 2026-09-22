import { must } from "../../utils/assert";

export interface Implicant {
  mask: string;
  minterms: number[];
  prime: boolean;
  essential: boolean;
  selected: boolean;
}

export interface QmStage {
  title: string;
  rows: string[];
}

export interface Minimized {
  variables: string[];
  expression: string;
  implicants: Implicant[];
  selected: Implicant[];
  stages: QmStage[];
  constant: 0 | 1 | null;
}

interface Term {
  mask: string;
  minterms: number[];
}

function bitCount(mask: string): number {
  return [...mask].filter((ch) => ch === "1").length;
}

function toMask(value: number, width: number): string {
  return value.toString(2).padStart(width, "0");
}

function combine(a: string, b: string): string | null {
  if (a.length !== b.length) return null;
  let diffs = 0;
  let out = "";
  for (let i = 0; i < a.length; i += 1) {
    const ca = a[i];
    const cb = b[i];
    if (ca === cb) out += ca ?? "-";
    else if (ca === "-" || cb === "-") return null;
    else {
      diffs += 1;
      out += "-";
    }
  }
  return diffs === 1 ? out : null;
}

function uniq(nums: number[]): number[] {
  return [...new Set(nums)].sort((a, b) => a - b);
}

function termKey(term: Term): string {
  return `${term.mask}:${term.minterms.join(",")}`;
}

export function quineMcCluskey(minterms: number[], dontCares: number[], variableCount: number, variables?: string[]): Minimized {
  const names = variables ?? defaultNames(variableCount);
  const width = variableCount;
  const required = uniq(minterms);
  const optional = uniq(dontCares.filter((d) => !required.includes(d)));
  const stages: QmStage[] = [];

  if (required.length === 0) {
    return { variables: names, expression: "0", implicants: [], selected: [], stages, constant: 0 };
  }

  const universe = 1 << width;
  if (required.length + optional.length >= universe && required.length === universe) {
    return { variables: names, expression: "1", implicants: [], selected: [], stages, constant: 1 };
  }

  let current: Term[] = [...required, ...optional].map((m) => ({ mask: toMask(m, width), minterms: [m] }));
  stages.push({
    title: "Group by number of 1s",
    rows: groupRows(current),
  });

  const primes: Term[] = [];
  let round = 1;
  while (current.length > 0) {
    const used = new Set<number>();
    const next: Term[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < current.length; i += 1) {
      for (let j = i + 1; j < current.length; j += 1) {
        const left = must(current[i]);
        const right = must(current[j]);
        const merged = combine(left.mask, right.mask);
        if (!merged) continue;
        used.add(i);
        used.add(j);
        const term = { mask: merged, minterms: uniq([...left.minterms, ...right.minterms]) };
        const key = termKey(term);
        if (!seen.has(key)) {
          seen.add(key);
          next.push(term);
        }
      }
    }
    current.forEach((term, index) => {
      if (!used.has(index)) primes.push(term);
    });
    if (next.length > 0) {
      stages.push({
        title: `Combine pairs — round ${round}`,
        rows: next.map((term) => `${term.mask}  covers ${term.minterms.join(", ")}`),
      });
    }
    current = next;
    round += 1;
  }

  const uniquePrimes = dedupe(primes);
  const chartRows = uniquePrimes.map((term) => {
    const marks = required.map((m) => (term.minterms.includes(m) ? "X" : "·")).join(" ");
    return `${term.mask}  ${marks}`;
  });
  stages.push({
    title: "Prime implicant chart",
    rows: [`terms vs minterms ${required.join(" ")}`, ...chartRows],
  });

  const selectedIdx = cover(uniquePrimes, required);
  const implicants: Implicant[] = uniquePrimes.map((term, index) => ({
    mask: term.mask,
    minterms: term.minterms.filter((m) => required.includes(m) || optional.includes(m)),
    prime: true,
    essential: isEssential(index, uniquePrimes, required),
    selected: selectedIdx.includes(index),
  }));
  const selected = implicants.filter((im) => im.selected);
  const expression = sopFromImplicants(selected, names);
  stages.push({
    title: "Selected cover",
    rows: selected.length ? selected.map((im) => `${im.mask} → ${termFromMask(im.mask, names) || "1"}`) : ["0"],
  });

  return { variables: names, expression, implicants, selected, stages, constant: expression === "1" || expression === "0" ? (expression === "1" ? 1 : 0) : null };
}

function dedupe(terms: Term[]): Term[] {
  const map = new Map<string, number[]>();
  for (const term of terms) {
    const prev = map.get(term.mask) ?? [];
    map.set(term.mask, uniq([...prev, ...term.minterms]));
  }
  return [...map.entries()].map(([mask, minterms]) => ({ mask, minterms }));
}

function groupRows(terms: Term[]): string[] {
  const buckets = new Map<number, string[]>();
  for (const term of terms) {
    const key = bitCount(term.mask);
    const list = buckets.get(key) ?? [];
    list.push(`${term.mask}  m${term.minterms.join(",")}`);
    buckets.set(key, list);
  }
  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .flatMap(([count, rows]) => [`${count} ones`, ...rows]);
}

function isEssential(index: number, primes: Term[], required: number[]): boolean {
  const term = primes[index];
  if (!term) return false;
  return required.some((m) => term.minterms.includes(m) && primes.filter((other) => other.minterms.includes(m)).length === 1);
}

function cover(primes: Term[], required: number[]): number[] {
  const selected: number[] = [];
  let remaining = [...required];
  let guard = 0;
  while (remaining.length > 0 && guard < primes.length + 2) {
    guard += 1;
    const essential = remaining
      .map((m) => primes.map((term, index) => (term.minterms.includes(m) ? index : -1)).filter((index) => index >= 0))
      .filter((list) => list.length === 1)
      .map((list) => list[0])
      .filter((index): index is number => index !== undefined);
    const fresh = [...new Set(essential)].filter((index) => !selected.includes(index));
    if (fresh.length > 0) {
      for (const index of fresh) selected.push(index);
      remaining = uncovered(primes, selected, remaining);
      continue;
    }
    let best = -1;
    let bestScore = -1;
    primes.forEach((term, index) => {
      if (selected.includes(index)) return;
      const score = remaining.filter((m) => term.minterms.includes(m)).length;
      const literals = [...term.mask].filter((ch) => ch !== "-").length;
      const rank = score * 100 - literals;
      if (score > 0 && rank > bestScore) {
        bestScore = rank;
        best = index;
      }
    });
    if (best < 0) break;
    selected.push(best);
    remaining = uncovered(primes, selected, remaining);
  }
  return selected;
}

function uncovered(primes: Term[], selected: number[], remaining: number[]): number[] {
  const covered = new Set<number>();
  for (const index of selected) {
    for (const m of primes[index]?.minterms ?? []) covered.add(m);
  }
  return remaining.filter((m) => !covered.has(m));
}

export function defaultNames(count: number): string[] {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return [...alphabet.slice(0, count)];
}

export function termFromMask(mask: string, variables: string[]): string {
  if ([...mask].every((ch) => ch === "-")) return "1";
  const parts: string[] = [];
  [...mask].forEach((bit, index) => {
    const name = variables[index];
    if (!name || bit === "-") return;
    parts.push(bit === "1" ? name : `${name}'`);
  });
  return parts.join("·") || "1";
}

export function sopFromImplicants(implicants: Implicant[], variables: string[]): string {
  if (implicants.length === 0) return "0";
  const terms = implicants.map((im) => termFromMask(im.mask, variables));
  if (terms.includes("1")) return "1";
  return terms.join(" + ");
}

export function maskToMinterms(mask: string): number[] {
  const floats = [...mask].map((ch, i) => (ch === "-" ? i : -1)).filter((i) => i >= 0);
  const count = 1 << floats.length;
  const minterms: number[] = [];
  for (let n = 0; n < count; n += 1) {
    const chars = [...mask];
    floats.forEach((pos, bit) => {
      chars[pos] = (n & (1 << (floats.length - 1 - bit))) !== 0 ? "1" : "0";
    });
    minterms.push(Number.parseInt(chars.join(""), 2));
  }
  return minterms.sort((a, b) => a - b);
}
