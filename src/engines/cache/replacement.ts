export interface Slot {
  valid: boolean;
  tag: number;
  dirty: boolean;
  data: number;
  lastUsed: number;
  inserted: number;
}

export function emptyLine(): Slot {
  return { valid: false, tag: 0, dirty: false, data: 0, lastUsed: 0, inserted: 0 };
}

export function nextRandom(seed: number): { value: number; seed: number } {
  const next = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return { value: next, seed: next };
}

export function chooseVictim(ways: Slot[], policy: "lru" | "fifo" | "random", randomValue: number): number {
  const empty = ways.findIndex((way) => !way.valid);
  if (empty >= 0) return empty;
  if (policy === "random") return randomValue % ways.length;
  if (policy === "fifo") {
    let best = 0;
    ways.forEach((way, index) => {
      const chosen = ways[best];
      if (chosen && way.inserted < chosen.inserted) best = index;
    });
    return best;
  }
  let best = 0;
  ways.forEach((way, index) => {
    const chosen = ways[best];
    if (chosen && way.lastUsed < chosen.lastUsed) best = index;
  });
  return best;
}
