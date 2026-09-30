export const MATERIALS = {
  silicon: { name: "Silicon", color: "#64748b" },
  oxide: { name: "SiO2", color: "#bfdbfe" },
  nitride: { name: "Si3N4", color: "#86efac" },
  resist: { name: "Photoresist", color: "#f472b6" },
  poly: { name: "Polysilicon", color: "#fb7185" },
  ndiff: { name: "N-type", color: "#38bdf8" },
  pdiff: { name: "P-type", color: "#f9a8d4" },
  nwell: { name: "N-well", color: "#0e7490" },
  pwell: { name: "P-well", color: "#9f1239" },
  dielectric: { name: "Dielectric", color: "#1e3a5f" },
  contact: { name: "Contact", color: "#e2e8f0" },
  metal: { name: "Metal", color: "#fbbf24" },
  via: { name: "Via", color: "#fde68a" },
  passivation: { name: "Passivation", color: "#334155" },
} as const;

export type MaterialId = keyof typeof MATERIALS;

export interface ProcessLayer {
  id: string;
  material: MaterialId;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
}

export interface FabStep {
  id: string;
  title: string;
  action: string;
  mask: string;
  adds: string;
  removes: string;
}

export const FAB_STEPS: FabStep[] = [
  { id: "wafer", title: "Starting wafer", action: "Begin with a silicon wafer.", mask: "None", adds: "Silicon substrate", removes: "Nothing" },
  { id: "oxidation", title: "Oxidation", action: "Grow a field oxide.", mask: "None", adds: "SiO2", removes: "A little silicon is consumed" },
  { id: "resist", title: "Photoresist", action: "Coat the wafer with resist.", mask: "None", adds: "Resist", removes: "Nothing" },
  { id: "lithography", title: "Lithography", action: "Expose and develop the resist.", mask: "Active-area mask", adds: "A patterned resist", removes: "Exposed or unexposed resist" },
  { id: "etch", title: "Etching", action: "Open the oxide where the resist is gone.", mask: "The resist is the mask", adds: "Nothing", removes: "Exposed oxide" },
  { id: "well", title: "Well formation", action: "Implant and drive in the well.", mask: "Well mask", adds: "N-well", removes: "Nothing" },
  { id: "implant", title: "Ion implantation", action: "Dope the open silicon.", mask: "Implant mask", adds: "Dopant", removes: "Nothing" },
  { id: "gate-oxide", title: "Gate oxide", action: "Grow the thin gate oxide.", mask: "None", adds: "Thin SiO2", removes: "A little silicon" },
  { id: "gate", title: "Gate formation", action: "Deposit and pattern polysilicon.", mask: "Poly mask", adds: "Polysilicon gate", removes: "Unwanted poly" },
  { id: "source-drain", title: "Source/drain", action: "Implant source and drain beside the gate.", mask: "The gate blocks the channel", adds: "Source and drain", removes: "Nothing" },
  { id: "dielectric", title: "Dielectric", action: "Deposit insulator over the devices.", mask: "None", adds: "Dielectric", removes: "Nothing" },
  { id: "contacts", title: "Contacts", action: "Etch and fill contacts.", mask: "Contact mask", adds: "Contact plugs", removes: "Dielectric in the holes" },
  { id: "metal", title: "Metallization", action: "Deposit and pattern metal.", mask: "Metal mask", adds: "Metal", removes: "Unwanted metal" },
  { id: "passivation", title: "Passivation", action: "Seal the chip, leaving pads open.", mask: "Pad mask", adds: "Passivation", removes: "Passivation over pads" },
];

export function fabStack(step: number): ProcessLayer[] {
  const index = Math.max(0, Math.min(FAB_STEPS.length - 1, Math.round(step)));
  const layers: ProcessLayer[] = [
    { id: "substrate", material: "silicon", x: 20, y: 150, w: 280, h: 40, label: "Substrate" },
  ];
  if (index >= 1 && index < 4) layers.push({ id: "field-ox", material: "oxide", x: 20, y: 136, w: 280, h: 14, label: "Field oxide" });
  if (index === 2) layers.push({ id: "resist", material: "resist", x: 20, y: 122, w: 280, h: 14, label: "Resist" });
  if (index === 3) {
    layers.push({ id: "resist-open", material: "resist", x: 40, y: 122, w: 70, h: 14, label: "Resist remains" });
    layers.push({ id: "resist-open-2", material: "resist", x: 180, y: 122, w: 100, h: 14, label: "Resist remains" });
  }
  if (index >= 4) layers.push({ id: "ox-left", material: "oxide", x: 20, y: 136, w: 70, h: 14, label: "Remaining oxide" }, { id: "ox-right", material: "oxide", x: 190, y: 136, w: 110, h: 14, label: "Remaining oxide" });
  if (index >= 5) layers.push({ id: "nwell", material: "nwell", x: 150, y: 150, w: 130, h: 28, label: "N-well" });
  if (index >= 6) layers.push({ id: "doped", material: "ndiff", x: 48, y: 150, w: 80, h: 12, label: "Implant" });
  if (index >= 7) layers.push({ id: "gox", material: "oxide", x: 90, y: 142, w: 50, h: 6, label: "Gate oxide" });
  if (index >= 8) layers.push({ id: "poly", material: "poly", x: 100, y: 124, w: 30, h: 18, label: "Gate" });
  if (index >= 9) layers.push({ id: "source", material: "ndiff", x: 48, y: 146, w: 42, h: 14, label: "Source" }, { id: "drain", material: "ndiff", x: 140, y: 146, w: 42, h: 14, label: "Drain" });
  if (index >= 10) layers.push({ id: "ild", material: "dielectric", x: 20, y: 96, w: 280, h: 28, label: "Dielectric" });
  if (index >= 11) layers.push({ id: "contact", material: "contact", x: 58, y: 96, w: 10, h: 50, label: "Contact" });
  if (index >= 12) layers.push({ id: "metal", material: "metal", x: 40, y: 78, w: 180, h: 16, label: "Metal" });
  if (index >= 13) layers.push({ id: "passivation", material: "passivation", x: 20, y: 62, w: 220, h: 14, label: "Passivation" });
  return layers;
}

export function finfetMetrics(fins: number, height: number, width: number): { weff: number; drive: number; leak: number } {
  const count = Math.max(1, fins);
  const weff = count * (2 * height + width);
  const control = height / Math.max(0.2, width);
  return { weff, drive: weff, leak: 1 / Math.max(0.4, control) };
}

export function planarMetrics(width: number): { weff: number; drive: number; leak: number } {
  return { weff: width, drive: width, leak: 1.6 };
}

export function gaaMetrics(sheets: number, width: number, thickness: number): { weff: number; drive: number; leak: number } {
  const count = Math.max(1, sheets);
  const weff = count * 2 * (width + thickness);
  return { weff, drive: weff, leak: 0.45 / count };
}

export type ScaledDevice = "planar" | "finfet" | "gaa";

export interface ScaleNode {
  id: string;
  label: string;
  device: ScaledDevice;
  density: number;
  vdd: number;
  leak: number;
  wire: number;
  power: number;
}

export const SCALE_NODES: ScaleNode[] = [
  { id: "180", label: "180 nm", device: "planar", density: 1, vdd: 1.8, leak: 0.15, wire: 0.15, power: 0.25 },
  { id: "130", label: "130 nm", device: "planar", density: 1.8, vdd: 1.5, leak: 0.22, wire: 0.22, power: 0.32 },
  { id: "90", label: "90 nm", device: "planar", density: 3.2, vdd: 1.2, leak: 0.35, wire: 0.32, power: 0.4 },
  { id: "65", label: "65 nm", device: "planar", density: 5, vdd: 1.1, leak: 0.5, wire: 0.42, power: 0.5 },
  { id: "45", label: "45 nm", device: "planar", density: 8, vdd: 1, leak: 0.7, wire: 0.55, power: 0.62 },
  { id: "32", label: "32/28 nm", device: "planar", density: 12, vdd: 0.95, leak: 0.9, wire: 0.68, power: 0.74 },
  { id: "22", label: "22/20 nm", device: "planar", density: 18, vdd: 0.9, leak: 1.1, wire: 0.8, power: 0.86 },
  { id: "16", label: "16/14 nm", device: "finfet", density: 28, vdd: 0.8, leak: 0.55, wire: 0.9, power: 0.78 },
  { id: "10", label: "10 nm", device: "finfet", density: 40, vdd: 0.75, leak: 0.62, wire: 1, power: 0.84 },
  { id: "7", label: "7 nm", device: "finfet", density: 55, vdd: 0.7, leak: 0.7, wire: 1.15, power: 0.92 },
  { id: "5", label: "5 nm", device: "finfet", density: 72, vdd: 0.7, leak: 0.78, wire: 1.28, power: 1 },
  { id: "3", label: "3 nm", device: "gaa", density: 95, vdd: 0.65, leak: 0.5, wire: 1.4, power: 0.9 },
  { id: "2", label: "2 nm conceptual", device: "gaa", density: 120, vdd: 0.6, leak: 0.48, wire: 1.55, power: 0.95 },
];

export function scalingNode(id: string): ScaleNode {
  return SCALE_NODES.find((node) => node.id === id) ?? SCALE_NODES[0]!;
}

export function resistPattern(kind: "positive" | "negative", dose: number, clear: boolean[]): boolean[] {
  return clear.map((opening) => {
    const exposed = opening && dose >= 0.35;
    if (kind === "positive") return !exposed;
    return exposed;
  });
}

export function implantProfile(energy: number, dose: number, anneal: number): { depth: number; points: Array<{ depth: number; concentration: number }> } {
  const range = 0.04 * energy;
  const sigma = 0.08 + energy * 0.004 + anneal * 0.15;
  const peak = dose / Math.max(0.05, sigma);
  const span = Math.max(1.2, range + 3 * sigma);
  const points = Array.from({ length: 32 }, (_, index) => {
    const depth = (index / 31) * span;
    const concentration = peak * Math.exp(-((depth - range) ** 2) / (2 * sigma * sigma));
    return { depth, concentration };
  });
  return { depth: range, points };
}

export function wellFit(well: "n" | "p" | "twin", device: "pmos" | "nmos", region: "well" | "substrate"): { ok: boolean; note: string } {
  if (well === "twin") return { ok: true, note: "Twin-well gives each device its own well." };
  if (well === "n" && device === "pmos" && region === "well") return { ok: true, note: "PMOS belongs in the N-well." };
  if (well === "n" && device === "nmos" && region === "substrate") return { ok: true, note: "NMOS stays in the P-type substrate." };
  if (well === "p" && device === "nmos" && region === "well") return { ok: true, note: "NMOS belongs in the P-well." };
  if (well === "p" && device === "pmos" && region === "substrate") return { ok: true, note: "PMOS can sit in an N-type substrate beside a P-well." };
  return { ok: false, note: "That device is in the wrong well." };
}

export function filmGrowth(method: "oxidation" | "cvd" | "pvd", time: number, celsius: number): { thickness: number; consumed: number; rate: number } {
  const rate = method === "oxidation" ? 0.015 * Math.exp(0.012 * (celsius - 800)) : method === "cvd" ? 0.09 : 0.06;
  const thickness = Math.max(0, rate * time);
  return { thickness, consumed: method === "oxidation" ? 0.44 * thickness : 0, rate };
}

export function etchProfile(mode: "isotropic" | "anisotropic", time: number, rate: number, selectivity: number, target: number): {
  vertical: number;
  undercut: number;
  state: "under" | "target" | "over";
} {
  const vertical = rate * time * Math.min(1.4, Math.max(0.2, selectivity));
  const undercut = mode === "isotropic" ? vertical * 0.85 : vertical * 0.12;
  const state = vertical < target * 0.85 ? "under" : vertical > target * 1.2 ? "over" : "target";
  return { vertical, undercut, state };
}

export function cmpSurface(time: number, rate: number, roughness: number): { before: number[]; after: number[]; variation: number; state: "under" | "target" | "dish" } {
  const before = [roughness, roughness * 0.72, roughness * 0.4, roughness * 0.15];
  const cut = time * rate;
  const tallest = Math.max(...before);
  const dish = Math.max(0, cut - tallest) * 0.35;
  const after = before.map((height, index) => {
    const lowered = Math.max(0, height - cut * (0.45 + 0.55 * (height / Math.max(0.01, tallest))));
    return index % 2 === 0 ? lowered - dish : lowered;
  });
  const variation = Math.max(...after) - Math.min(...after);
  const state = dish > 0.05 ? "dish" : variation > roughness * 0.35 ? "under" : "target";
  return { before, after, variation, state };
}

export function viaConnects(fromLayer: number, toLayer: number, vias: boolean[]): boolean {
  if (Math.abs(fromLayer - toLayer) !== 1) return false;
  return vias[Math.min(fromLayer, toLayer)] === true;
}

export interface StackPart {
  id: string;
  zone: "feol" | "mol" | "beol";
  level: "device" | "cell" | "stack" | "full";
  name: string;
  material: MaterialId;
  purpose: string;
  y: number;
}

export const STACK_PARTS: StackPart[] = [
  { id: "channel", zone: "feol", level: "device", name: "Channel", material: "silicon", purpose: "The controlled current path.", y: 176 },
  { id: "gate", zone: "feol", level: "device", name: "Gate", material: "poly", purpose: "Sets the channel charge.", y: 156 },
  { id: "sd", zone: "feol", level: "cell", name: "Source / drain", material: "ndiff", purpose: "The device terminals.", y: 136 },
  { id: "contact", zone: "mol", level: "cell", name: "Contact", material: "contact", purpose: "Joins silicon or poly to local metal.", y: 116 },
  { id: "m0", zone: "mol", level: "stack", name: "Local interconnect", material: "metal", purpose: "Short connections inside a cell.", y: 96 },
  { id: "via1", zone: "beol", level: "stack", name: "Via", material: "via", purpose: "Vertical hop between metals.", y: 76 },
  { id: "m2", zone: "beol", level: "stack", name: "Metal 2", material: "metal", purpose: "Intermediate routes.", y: 56 },
  { id: "mtop", zone: "beol", level: "full", name: "Upper metal", material: "metal", purpose: "Wider global routes and power.", y: 36 },
  { id: "passivation", zone: "beol", level: "full", name: "Passivation", material: "passivation", purpose: "Seals the chip.", y: 16 },
];

export interface DieCell {
  col: number;
  row: number;
  x: number;
  y: number;
  kind: "good" | "failed" | "edge";
  defects: number;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), state | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

export function waferMap(input: { diameter: number; dieW: number; dieH: number; edge: number; density: number; seed: number }): {
  dies: DieCell[];
  gross: number;
  edge: number;
  good: number;
  failed: number;
  yield: number;
} {
  const radius = input.diameter / 2;
  const usable = Math.max(1, radius - input.edge);
  const rng = mulberry32(input.seed);
  const defects: Array<{ x: number; y: number }> = [];
  const count = Math.round(input.density * Math.PI * usable * usable);
  for (let index = 0; index < count; index += 1) {
    const angle = rng() * Math.PI * 2;
    const span = Math.sqrt(rng()) * usable;
    defects.push({ x: Math.cos(angle) * span, y: Math.sin(angle) * span });
  }
  const dies: DieCell[] = [];
  const cols = Math.ceil(input.diameter / input.dieW);
  const rows = Math.ceil(input.diameter / input.dieH);
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const x = -radius + col * input.dieW + input.dieW / 2;
      const y = -radius + row * input.dieH + input.dieH / 2;
      const corners = [
        [x - input.dieW / 2, y - input.dieH / 2],
        [x + input.dieW / 2, y - input.dieH / 2],
        [x - input.dieW / 2, y + input.dieH / 2],
        [x + input.dieW / 2, y + input.dieH / 2],
      ];
      const inside = corners.filter(([cx, cy]) => (cx ?? 0) ** 2 + (cy ?? 0) ** 2 <= usable ** 2).length;
      if (inside === 0) continue;
      const hits = defects.filter((defect) => Math.abs(defect.x - x) <= input.dieW / 2 && Math.abs(defect.y - y) <= input.dieH / 2).length;
      const kind: DieCell["kind"] = inside < 4 ? "edge" : hits > 0 ? "failed" : "good";
      dies.push({ col, row, x, y, kind, defects: hits });
    }
  }
  const gross = dies.filter((die) => die.kind !== "edge").length;
  const good = dies.filter((die) => die.kind === "good").length;
  const failed = dies.filter((die) => die.kind === "failed").length;
  const edge = dies.filter((die) => die.kind === "edge").length;
  return { dies, gross, edge, good, failed, yield: gross === 0 ? 0 : good / gross };
}

export function poissonYield(area: number, density: number): number {
  return Math.exp(-Math.max(0, area) * Math.max(0, density));
}

export function murphyYield(area: number, density: number): number {
  const product = Math.max(1e-6, area * density);
  return ((1 - Math.exp(-product)) / product) ** 2;
}
