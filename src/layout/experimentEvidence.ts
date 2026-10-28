export type EvidenceValue = null | boolean | number | string | EvidenceValue[] | { [key: string]: EvidenceValue };
export interface SimulatorSource { name: string; version: string; state: EvidenceValue }
export interface SimulatorEvidence {
  version: 1;
  route: string;
  capturedAt: string;
  sources: SimulatorSource[];
  controls: Array<{ label: string; value: string }>;
  readouts: string;
  truncated: boolean;
}

/** Snapshots are detached, bounded data. Never retain engine references or executable code. */
export function evidenceValue(value: unknown, budget = { remaining: 18000, truncated: false }, depth = 0, seen = new WeakSet<object>()): EvidenceValue {
  if (--budget.remaining < 0 || depth > 9) { budget.truncated = true; return "[truncated]"; }
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : String(value);
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "boolean") return value;
  if (typeof value === "string") { if (value.length > 16000) budget.truncated = true; return value.slice(0, 16000); }
  if (typeof value !== "object") return "[unsupported]";
  if (seen.has(value)) return "[shared reference]";
  seen.add(value);
  if (Array.isArray(value) || ArrayBuffer.isView(value)) {
    const items = Array.from(value as unknown as ArrayLike<unknown>);
    if (items.length > 512) {
      budget.truncated = true;
      return { length: items.length, offset: items.length - 512, items: items.slice(-512).map(item => evidenceValue(item, budget, depth + 1, seen)) };
    }
    return items.map(item => evidenceValue(item, budget, depth + 1, seen));
  }
  if (value instanceof Map) {
    if (value.size > 256) budget.truncated = true;
    return evidenceValue(Object.fromEntries(Array.from(value.entries()).slice(0, 256).map(([key, item]) => [String(key), item])), budget, depth + 1, seen);
  }
  if (value instanceof Set) return evidenceValue([...value], budget, depth + 1, seen);
  if (value instanceof Date) return value.toISOString();
  // Exclude DOM nodes and React elements from engine snapshots.
  if ("nodeType" in value || "$$typeof" in value) return "[view]";
  const entries = Object.entries(value).filter(([, item]) => typeof item !== "function" && typeof item !== "symbol");
  if (entries.length > 256) budget.truncated = true;
  return Object.fromEntries(entries.slice(0, 256).map(([key, item]) => [key, evidenceValue(item, budget, depth + 1, seen)]));
}

export function compareEvidence(before: SimulatorEvidence, after: SimulatorEvidence): Array<{ field: string; before: string; after: string }> {
  const flatten = (evidence: SimulatorEvidence) => {
    const fields = new Map<string, string>();
    const walk = (value: EvidenceValue, path: string, depth = 0) => {
      if (depth > 5 || Array.isArray(value)) { fields.set(path, JSON.stringify(value)); return; }
      if (value && typeof value === "object") for (const [key, item] of Object.entries(value)) walk(item, path + "." + key, depth + 1);
      else fields.set(path, String(value));
    };
    for (const [i, control] of evidence.controls.entries()) fields.set("Control " + i + ": " + control.label, control.value);
    for (const [i, source] of evidence.sources.entries()) {
      const name = source.name + "[" + i + "]";
      fields.set(name + ".sourceVersion", source.version);
      walk(source.state, name);
    }
    return fields;
  };
  const a = flatten(before), b = flatten(after);
  return [...new Set([...a.keys(), ...b.keys()])].filter(key => a.get(key) !== b.get(key))
    .slice(0, 100).map(field => ({ field, before: (a.get(field) ?? "—").slice(0, 500), after: (b.get(field) ?? "—").slice(0, 500) }));
}

export function parseEvidence(value: unknown): SimulatorEvidence | undefined {
  if (!value || typeof value !== "object") return;
  const v = value as SimulatorEvidence;
  if (v.version !== 1 || typeof v.route !== "string" || typeof v.capturedAt !== "string" || !Array.isArray(v.sources) || !Array.isArray(v.controls) || typeof v.readouts !== "string") return;
  const budget = { remaining: 20000, truncated: false };
  return {
    version: 1, route: v.route.slice(0, 2000), capturedAt: v.capturedAt.slice(0, 100),
    sources: v.sources.slice(0, 100).filter(s => s && typeof s.name === "string" && typeof s.version === "string").map(s => ({ name: s.name.slice(0, 300), version: s.version.slice(0, 100), state: evidenceValue(s.state, budget) })),
    controls: v.controls.slice(0, 200).filter(c => c && typeof c.label === "string" && typeof c.value === "string").map(c => ({ label: c.label.slice(0, 500), value: c.value.slice(0, 16000) })),
    readouts: v.readouts.slice(0, 24000), truncated: !!v.truncated || budget.truncated,
  };
}
