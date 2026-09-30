export type LayerId = "nwell" | "pwell" | "ndiff" | "pdiff" | "poly" | "contact" | "metal1" | "via" | "metal2";

export interface LayoutRect {
  id: string;
  layer: LayerId;
  net: string;
  x: number;
  y: number;
  w: number;
  h: number;
  purpose: string;
}

export interface LayoutDevice {
  id: string;
  kind: "nmos" | "pmos";
  gate: string;
  diffusion: string;
}

export const LAYER_LABEL: Record<LayerId, string> = {
  nwell: "N-well",
  pwell: "P-substrate",
  ndiff: "N-diffusion",
  pdiff: "P-diffusion",
  poly: "Polysilicon",
  contact: "Contact",
  metal1: "Metal1",
  via: "Via",
  metal2: "Metal2",
};

/** Educational normalized rules. Not a foundry design-rule deck. */
export const EDU_RULES = {
  label: "Educational technology rules",
  polyWidth: 2,
  polySpace: 3,
  polyOverlap: 2,
  metalWidth: 3,
  metalSpace: 3,
  diffWidth: 4,
  diffSpace: 3,
  contactSize: 2,
  contactEnclose: 1,
  wellSpaceToNdiff: 3,
  wellEnclosePdiff: 2,
};

export function intersects(a: LayoutRect, b: LayoutRect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

export function overlapBox(a: LayoutRect, b: LayoutRect): { w: number; h: number } | null {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  if (w <= 0 || h <= 0) return null;
  return { w, h };
}

function contains(outer: LayoutRect, inner: LayoutRect, margin: number): boolean {
  return inner.x >= outer.x + margin
    && inner.y >= outer.y + margin
    && inner.x + inner.w <= outer.x + outer.w - margin
    && inner.y + inner.h <= outer.y + outer.h - margin;
}

/** Poly crossing diffusion is the transistor channel. */
export function devicesFromLayout(rects: LayoutRect[]): LayoutDevice[] {
  const poly = rects.filter((rect) => rect.layer === "poly");
  const diffusion = rects.filter((rect) => rect.layer === "ndiff" || rect.layer === "pdiff");
  const found: LayoutDevice[] = [];
  for (const gate of poly) {
    for (const active of diffusion) {
      if (!intersects(gate, active)) continue;
      found.push({
        id: `${gate.id}:${active.id}`,
        kind: active.layer === "ndiff" ? "nmos" : "pmos",
        gate: gate.net,
        diffusion: active.net,
      });
    }
  }
  return found;
}

export function pmosInsideWell(rects: LayoutRect[]): boolean {
  const wells = rects.filter((rect) => rect.layer === "nwell");
  const pdiffs = rects.filter((rect) => rect.layer === "pdiff");
  if (pdiffs.length === 0) return false;
  return pdiffs.every((diff) => wells.some((well) => contains(well, diff, 0)));
}

export interface DrcViolation {
  id: string;
  rule: string;
  shapeId: string;
  measured: number;
  required: number;
  suggestion: string;
}

function axisGap(a: LayoutRect, b: LayoutRect): number | null {
  const xOverlap = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const yOverlap = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  if (xOverlap > 0 && yOverlap > 0) return null;
  if (xOverlap > 0) return Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h);
  if (yOverlap > 0) return Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w);
  return null;
}

export function runDrc(rects: LayoutRect[]): DrcViolation[] {
  const violations: DrcViolation[] = [];
  const widthRule: Partial<Record<LayerId, number>> = {
    poly: EDU_RULES.polyWidth,
    metal1: EDU_RULES.metalWidth,
    metal2: EDU_RULES.metalWidth,
    ndiff: EDU_RULES.diffWidth,
    pdiff: EDU_RULES.diffWidth,
  };
  for (const rect of rects) {
    const minimum = widthRule[rect.layer];
    if (minimum === undefined) continue;
    const measured = Math.min(rect.w, rect.h);
    if (measured + 1e-9 < minimum) {
      violations.push({
        id: `width-${rect.id}`,
        rule: `Minimum ${LAYER_LABEL[rect.layer]} width`,
        shapeId: rect.id,
        measured,
        required: minimum,
        suggestion: `Increase the narrow side of ${rect.id} from ${measured.toFixed(1)} to at least ${minimum.toFixed(1)}.`,
      });
    }
  }
  const spaceRule: Partial<Record<LayerId, number>> = {
    poly: EDU_RULES.polySpace,
    metal1: EDU_RULES.metalSpace,
    ndiff: EDU_RULES.diffSpace,
    pdiff: EDU_RULES.diffSpace,
  };
  const layers = Object.keys(spaceRule) as LayerId[];
  for (const layer of layers) {
    const group = rects.filter((rect) => rect.layer === layer);
    const minimum = spaceRule[layer] ?? 0;
    for (let left = 0; left < group.length; left += 1) {
      for (let right = left + 1; right < group.length; right += 1) {
        const a = group[left];
        const b = group[right];
        if (!a || !b) continue;
        const gap = axisGap(a, b);
        if (gap === null || gap + 1e-9 >= minimum) continue;
        violations.push({
          id: `space-${a.id}-${b.id}`,
          rule: `Minimum ${LAYER_LABEL[layer]} spacing`,
          shapeId: a.id,
          measured: gap,
          required: minimum,
          suggestion: `Move ${a.id} and ${b.id} apart from ${gap.toFixed(1)} to at least ${minimum.toFixed(1)}.`,
        });
      }
    }
  }
  const contacts = rects.filter((rect) => rect.layer === "contact");
  const metals = rects.filter((rect) => rect.layer === "metal1" || rect.layer === "metal2");
  const actives = rects.filter((rect) => rect.layer === "ndiff" || rect.layer === "pdiff" || rect.layer === "poly");
  for (const contact of contacts) {
    const metal = metals.find((shape) => contains(shape, contact, EDU_RULES.contactEnclose));
    const active = actives.find((shape) => contains(shape, contact, EDU_RULES.contactEnclose));
    if (!metal || !active) {
      const measured = Math.min(contact.w, contact.h);
      violations.push({
        id: `enc-${contact.id}`,
        rule: "Contact enclosure",
        shapeId: contact.id,
        measured: metal && active ? EDU_RULES.contactEnclose : 0,
        required: EDU_RULES.contactEnclose,
        suggestion: `Enlarge the metal or diffusion around ${contact.id} so it encloses the contact by ${EDU_RULES.contactEnclose.toFixed(1)} on every side. Contact size is ${measured.toFixed(1)}.`,
      });
    }
  }
  const wells = rects.filter((rect) => rect.layer === "nwell");
  const ndiffs = rects.filter((rect) => rect.layer === "ndiff");
  for (const well of wells) {
    for (const diff of ndiffs) {
      const gap = axisGap(well, diff);
      if (gap === null || gap + 1e-9 >= EDU_RULES.wellSpaceToNdiff) continue;
      violations.push({
        id: `well-${well.id}-${diff.id}`,
        rule: "N-well to N-diffusion spacing",
        shapeId: well.id,
        measured: gap,
        required: EDU_RULES.wellSpaceToNdiff,
        suggestion: `Separate ${well.id} from ${diff.id} by at least ${EDU_RULES.wellSpaceToNdiff.toFixed(1)}. Measured gap is ${gap.toFixed(1)}.`,
      });
    }
  }
  const poly = rects.filter((rect) => rect.layer === "poly");
  const diffusion = rects.filter((rect) => rect.layer === "ndiff" || rect.layer === "pdiff");
  for (const gate of poly) {
    for (const active of diffusion) {
      const box = overlapBox(gate, active);
      if (!box) continue;
      const measured = Math.min(box.w, box.h);
      if (measured + 1e-9 >= EDU_RULES.polyOverlap) continue;
      violations.push({
        id: `ov-${gate.id}-${active.id}`,
        rule: "Minimum poly overlap of diffusion",
        shapeId: gate.id,
        measured,
        required: EDU_RULES.polyOverlap,
        suggestion: `Extend ${gate.id} across ${active.id} so the overlap is at least ${EDU_RULES.polyOverlap.toFixed(1)}. Measured overlap is ${measured.toFixed(1)}.`,
      });
    }
  }
  return violations;
}

export function inverterTemplate(): LayoutRect[] {
  return [
    { id: "nwell", layer: "nwell", net: "VDD", x: 10, y: 6, w: 44, h: 30, purpose: "N-well holds the PMOS body" },
    { id: "pdiff", layer: "pdiff", net: "OUT", x: 20, y: 12, w: 24, h: 16, purpose: "P-diffusion active of the pull-up" },
    { id: "ndiff", layer: "ndiff", net: "OUT", x: 20, y: 48, w: 24, h: 16, purpose: "N-diffusion active of the pull-down" },
    { id: "poly", layer: "poly", net: "A", x: 28, y: 8, w: 8, h: 62, purpose: "Poly gate crosses both diffusions" },
    { id: "c-ps", layer: "contact", net: "VDD", x: 22, y: 16, w: 4, h: 4, purpose: "Source contact of PMOS to VDD" },
    { id: "c-pd", layer: "contact", net: "OUT", x: 38, y: 16, w: 4, h: 4, purpose: "Drain contact of PMOS" },
    { id: "c-nd", layer: "contact", net: "OUT", x: 38, y: 52, w: 4, h: 4, purpose: "Drain contact of NMOS" },
    { id: "c-ns", layer: "contact", net: "GND", x: 22, y: 52, w: 4, h: 4, purpose: "Source contact of NMOS to GND" },
    { id: "m-vdd", layer: "metal1", net: "VDD", x: 8, y: 14, w: 20, h: 8, purpose: "VDD rail ties the PMOS source" },
    { id: "m-gnd", layer: "metal1", net: "GND", x: 8, y: 50, w: 20, h: 8, purpose: "GND rail ties the NMOS source" },
    { id: "m-out", layer: "metal1", net: "OUT", x: 36, y: 14, w: 8, h: 44, purpose: "Output metal joins both drains" },
    { id: "m-in", layer: "metal1", net: "A", x: 28, y: 70, w: 8, h: 8, purpose: "Input metal lands on poly" },
  ];
}

export const INVERTER_STEPS = [
  "Place N-well",
  "Place P-diffusion",
  "Place N-diffusion",
  "Draw poly gate",
  "Add contacts",
  "Add VDD and GND rails",
  "Route output",
  "Route input",
  "Validate layout",
] as const;

export function inverterStepShapes(step: number): LayoutRect[] {
  const all = inverterTemplate();
  if (step <= 0) return all.filter((shape) => shape.id === "nwell");
  if (step === 1) return all.filter((shape) => shape.id === "nwell" || shape.id === "pdiff");
  if (step === 2) return all.filter((shape) => ["nwell", "pdiff", "ndiff"].includes(shape.id));
  if (step === 3) return all.filter((shape) => ["nwell", "pdiff", "ndiff", "poly"].includes(shape.id));
  if (step === 4) return all.filter((shape) => shape.layer !== "metal1");
  if (step === 5) return all.filter((shape) => shape.id !== "m-out" && shape.id !== "m-in");
  if (step === 6) return all.filter((shape) => shape.id !== "m-in");
  return all;
}

export interface LayoutStats {
  area: number;
  diffusionBreaks: number;
  contacts: number;
  devices: LayoutDevice[];
  pInWell: boolean;
}

export function layoutStats(rects: LayoutRect[]): LayoutStats {
  const diffusion = rects.filter((rect) => rect.layer === "ndiff" || rect.layer === "pdiff");
  const area = diffusion.reduce((sum, rect) => sum + rect.w * rect.h, 0);
  return {
    area,
    diffusionBreaks: Math.max(0, diffusion.length - 2),
    contacts: rects.filter((rect) => rect.layer === "contact").length,
    devices: devicesFromLayout(rects),
    pInWell: pmosInsideWell(rects),
  };
}

function diffusionIslands(layer: "pdiff" | "ndiff", y: number, shared: boolean, series: boolean): LayoutRect[] {
  const purpose = shared
    ? series ? "Series transistors share one diffusion" : "Parallel transistors share one diffusion"
    : series ? "Separate diffusion islands break the series stack" : "Separate diffusion islands for each parallel device";
  if (shared) {
    return [{ id: layer, layer, net: "OUT", x: 18, y, w: 34, h: 12, purpose }];
  }
  return [
    { id: `${layer}-a`, layer, net: "OUT", x: 12, y, w: 18, h: 16, purpose },
    { id: `${layer}-b`, layer, net: "OUT", x: 40, y, w: 18, h: 16, purpose },
  ];
}

export function cmosGateLayout(gate: "nand" | "nor", shared: boolean): LayoutRect[] {
  const seriesIsN = gate === "nand";
  const p = diffusionIslands("pdiff", 12, shared, !seriesIsN);
  const n = diffusionIslands("ndiff", 48, shared, seriesIsN);
  const poly: LayoutRect[] = [
    { id: "poly-a", layer: "poly", net: "A", x: 22, y: 8, w: 6, h: 60, purpose: "Input A gate" },
    { id: "poly-b", layer: "poly", net: "B", x: 40, y: 8, w: 6, h: 60, purpose: "Input B gate" },
  ];
  const well: LayoutRect = { id: "nwell", layer: "nwell", net: "VDD", x: 8, y: 4, w: 52, h: 30, purpose: "N-well around the PMOS" };
  const contacts: LayoutRect[] = shared
    ? [
      { id: "c1", layer: "contact", net: "VDD", x: 18, y: 16, w: 4, h: 4, purpose: "VDD contact" },
      { id: "c2", layer: "contact", net: "OUT", x: 32, y: 16, w: 4, h: 4, purpose: "Output contact" },
      { id: "c3", layer: "contact", net: "GND", x: 18, y: 52, w: 4, h: 4, purpose: "GND contact" },
      { id: "c4", layer: "contact", net: "OUT", x: 44, y: 52, w: 4, h: 4, purpose: "Shared drain or source contact" },
    ]
    : [
      { id: "c1", layer: "contact", net: "VDD", x: 18, y: 16, w: 4, h: 4, purpose: "VDD contact" },
      { id: "c2", layer: "contact", net: "OUT", x: 26, y: 16, w: 4, h: 4, purpose: "Output contact" },
      { id: "c3", layer: "contact", net: "VDD", x: 40, y: 16, w: 4, h: 4, purpose: "Extra VDD contact" },
      { id: "c4", layer: "contact", net: "OUT", x: 46, y: 16, w: 4, h: 4, purpose: "Extra output contact" },
      { id: "c5", layer: "contact", net: "GND", x: 18, y: 52, w: 4, h: 4, purpose: "GND contact" },
      { id: "c6", layer: "contact", net: "OUT", x: 26, y: 52, w: 4, h: 4, purpose: "Output contact" },
      { id: "c7", layer: "contact", net: "GND", x: 40, y: 52, w: 4, h: 4, purpose: "Extra GND contact" },
      { id: "c8", layer: "contact", net: "OUT", x: 46, y: 52, w: 4, h: 4, purpose: "Extra output contact" },
    ];
  return [well, ...p, ...n, ...poly, ...contacts];
}

export function drcDemo(polyWidth: number, metalGap: number, enclosure: number): LayoutRect[] {
  return [
    { id: "poly-narrow", layer: "poly", net: "A", x: 8, y: 8, w: polyWidth, h: 40, purpose: "Poly finger used for the width rule" },
    { id: "m-a", layer: "metal1", net: "N1", x: 20, y: 8, w: 16, h: 8, purpose: "Metal run A" },
    { id: "m-b", layer: "metal1", net: "N2", x: 36 + metalGap, y: 8, w: 16, h: 8, purpose: "Metal run B" },
    { id: "ndiff-c", layer: "ndiff", net: "N1", x: 20, y: 28, w: 16, h: 14, purpose: "Diffusion under the contact" },
    { id: "contact-c", layer: "contact", net: "N1", x: 24, y: 32, w: 4, h: 4, purpose: "Contact whose enclosure is checked" },
    { id: "m-c", layer: "metal1", net: "N1", x: 24 - enclosure, y: 32 - enclosure, w: 4 + enclosure * 2, h: 4 + enclosure * 2, purpose: "Metal cover around the contact" },
  ];
}

export function snap(value: number): number {
  return Math.round(value / 2) * 2;
}
