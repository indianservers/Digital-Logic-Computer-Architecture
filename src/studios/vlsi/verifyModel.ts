import { devicesFromLayout, type LayoutRect } from "./layoutModel";

export interface TerminalDevice {
  id: string;
  kind: "nmos" | "pmos";
  gate: string;
  source: string;
  drain: string;
  layoutIds: string[];
}

export interface ConnectivityGraph {
  name: string;
  devices: TerminalDevice[];
}

export interface LvsMismatch {
  id: string;
  kind: "missing" | "extra" | "pin" | "short" | "open";
  message: string;
  deviceId: string;
  net: string;
  layoutIds: string[];
}

function terminalKey(device: TerminalDevice): string {
  const pins = [device.source, device.drain].sort().join(",");
  return `${device.kind}|${device.gate}|${pins}`;
}

function takeMatch(pool: TerminalDevice[], device: TerminalDevice): TerminalDevice | undefined {
  const exact = pool.findIndex((item) => terminalKey(item) === terminalKey(device));
  if (exact >= 0) return pool.splice(exact, 1)[0];
  return undefined;
}

/** Graph comparison of schematic terminals against extracted terminals. */
export function compareGraphs(schematic: ConnectivityGraph, extracted: ConnectivityGraph): { pass: boolean; mismatches: LvsMismatch[] } {
  const pool = extracted.devices.map((device) => ({ ...device }));
  const mismatches: LvsMismatch[] = [];
  const paired: Array<{ schematic: TerminalDevice; extracted: TerminalDevice }> = [];
  for (const device of schematic.devices) {
    const exact = takeMatch(pool, device);
    if (exact) {
      paired.push({ schematic: device, extracted: exact });
      continue;
    }
    const sameKind = pool.findIndex((item) => item.kind === device.kind);
    const partial = sameKind >= 0 ? pool.splice(sameKind, 1)[0] : undefined;
    if (!partial) {
      mismatches.push({
        id: `missing-${device.id}`,
        kind: "missing",
        message: `Missing ${device.kind.toUpperCase()} ${device.id}. The schematic has this device and the layout extract does not.`,
        deviceId: device.id,
        net: device.gate,
        layoutIds: device.layoutIds,
      });
      continue;
    }
    paired.push({ schematic: device, extracted: partial });
    const gateWrong = partial.gate !== device.gate;
    mismatches.push({
      id: `pin-${device.id}`,
      kind: "pin",
      message: gateWrong
        ? `Gate of ${device.id} is tied to ${partial.gate}. The schematic ties it to ${device.gate}.`
        : `Source/drain of ${device.id} connect ${partial.source} and ${partial.drain}. The schematic connects ${device.source} and ${device.drain}.`,
      deviceId: device.id,
      net: gateWrong ? partial.gate : partial.drain,
      layoutIds: partial.layoutIds,
    });
  }
  for (const extra of pool) {
    mismatches.push({
      id: `extra-${extra.id}`,
      kind: "extra",
      message: `Extra ${extra.kind.toUpperCase()} ${extra.id} is in the layout and not in the schematic.`,
      deviceId: extra.id,
      net: extra.gate,
      layoutIds: extra.layoutIds,
    });
  }
  const extractedBySchematicNet = new Map<string, Set<string>>();
  for (const pair of paired) {
    const swapped = pair.schematic.source === pair.extracted.drain && pair.schematic.drain === pair.extracted.source;
    const links: Array<[string, string]> = swapped
      ? [
        [pair.schematic.gate, pair.extracted.gate],
        [pair.schematic.source, pair.extracted.drain],
        [pair.schematic.drain, pair.extracted.source],
      ]
      : [
        [pair.schematic.gate, pair.extracted.gate],
        [pair.schematic.source, pair.extracted.source],
        [pair.schematic.drain, pair.extracted.drain],
      ];
    for (const [schematicNet, extractedNet] of links) {
      const set = extractedBySchematicNet.get(schematicNet) ?? new Set<string>();
      set.add(extractedNet);
      extractedBySchematicNet.set(schematicNet, set);
    }
  }
  for (const [schematicNet, extractedNets] of extractedBySchematicNet) {
    if (extractedNets.size > 1) {
      mismatches.push({
        id: `open-${schematicNet}`,
        kind: "open",
        message: `Net ${schematicNet} is split across ${[...extractedNets].join(" and ")} in the extract.`,
        deviceId: "",
        net: schematicNet,
        layoutIds: [],
      });
    }
  }
  const owners = new Map<string, string[]>();
  for (const [schematicNet, extractedNets] of extractedBySchematicNet) {
    for (const extractedNet of extractedNets) {
      const list = owners.get(extractedNet) ?? [];
      if (!list.includes(schematicNet)) list.push(schematicNet);
      owners.set(extractedNet, list);
    }
  }
  for (const [extractedNet, schematicNets] of owners) {
    if (schematicNets.length < 2) continue;
    mismatches.push({
      id: `short-${extractedNet}`,
      kind: "short",
      message: `Extracted net ${extractedNet} shorts schematic nets ${schematicNets.join(" and ")}.`,
      deviceId: "",
      net: extractedNet,
      layoutIds: [],
    });
  }
  return { pass: mismatches.length === 0, mismatches };
}

function center(rect: LayoutRect): { x: number; y: number } {
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
}

function overlaps(a: LayoutRect, b: LayoutRect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** Poly over diffusion is a transistor. Contacts on each side of the poly name source and drain. */
export function extractFromLayout(rects: LayoutRect[]): ConnectivityGraph {
  const devices = devicesFromLayout(rects);
  const contacts = rects.filter((rect) => rect.layer === "contact");
  const extracted: TerminalDevice[] = devices.map((device) => {
    const poly = rects.find((rect) => rect.id === device.id.split(":")[0]);
    const diffusion = rects.find((rect) => rect.id === device.id.split(":")[1]);
    const polyCenter = poly ? center(poly).x : 0;
    const onDiffusion = contacts.filter((contact) => diffusion && overlaps(contact, diffusion));
    const left = onDiffusion.filter((contact) => center(contact).x < polyCenter).sort((a, b) => center(b).x - center(a).x)[0];
    const right = onDiffusion.filter((contact) => center(contact).x > polyCenter).sort((a, b) => center(a).x - center(b).x)[0];
    return {
      id: device.id,
      kind: device.kind,
      gate: device.gate,
      source: left?.net ?? "OPEN",
      drain: right?.net ?? "OPEN",
      layoutIds: [poly?.id ?? "", diffusion?.id ?? "", left?.id ?? "", right?.id ?? ""].filter((id) => id.length > 0),
    };
  });
  return { name: "Extracted layout", devices: extracted };
}

export function inverterSchematic(): ConnectivityGraph {
  return {
    name: "CMOS inverter",
    devices: [
      { id: "MP", kind: "pmos", gate: "A", source: "VDD", drain: "OUT", layoutIds: ["poly", "pdiff"] },
      { id: "MN", kind: "nmos", gate: "A", source: "GND", drain: "OUT", layoutIds: ["poly", "ndiff"] },
    ],
  };
}

/** Series NMOS with a middle contact, parallel PMOS with sources on the outside. */
export function nandLayout(): LayoutRect[] {
  return [
    { id: "nwell", layer: "nwell", net: "VDD", x: 8, y: 4, w: 56, h: 32, purpose: "N-well around the pull-up" },
    { id: "pdiff", layer: "pdiff", net: "OUT", x: 16, y: 12, w: 40, h: 16, purpose: "Parallel PMOS diffusion" },
    { id: "ndiff", layer: "ndiff", net: "OUT", x: 16, y: 48, w: 40, h: 16, purpose: "Series NMOS diffusion" },
    { id: "poly-a", layer: "poly", net: "A", x: 22, y: 8, w: 6, h: 60, purpose: "Input A" },
    { id: "poly-b", layer: "poly", net: "B", x: 42, y: 8, w: 6, h: 60, purpose: "Input B" },
    { id: "c-pa-s", layer: "contact", net: "VDD", x: 17, y: 16, w: 4, h: 4, purpose: "PMOS A source" },
    { id: "c-p-d", layer: "contact", net: "OUT", x: 32, y: 16, w: 4, h: 4, purpose: "Shared PMOS drain" },
    { id: "c-pb-s", layer: "contact", net: "VDD", x: 50, y: 16, w: 4, h: 4, purpose: "PMOS B source" },
    { id: "c-na-s", layer: "contact", net: "GND", x: 17, y: 52, w: 4, h: 4, purpose: "NMOS source to ground" },
    { id: "c-mid", layer: "contact", net: "MID", x: 32, y: 52, w: 4, h: 4, purpose: "Series intermediate node" },
    { id: "c-nb-d", layer: "contact", net: "OUT", x: 50, y: 52, w: 4, h: 4, purpose: "NMOS drain" },
  ];
}

export function nandSchematic(): ConnectivityGraph {
  return {
    name: "CMOS NAND2",
    devices: [
      { id: "MP1", kind: "pmos", gate: "A", source: "VDD", drain: "OUT", layoutIds: ["poly-a", "pdiff"] },
      { id: "MP2", kind: "pmos", gate: "B", source: "VDD", drain: "OUT", layoutIds: ["poly-b", "pdiff"] },
      { id: "MN1", kind: "nmos", gate: "A", source: "GND", drain: "MID", layoutIds: ["poly-a", "ndiff"] },
      { id: "MN2", kind: "nmos", gate: "B", source: "MID", drain: "OUT", layoutIds: ["poly-b", "ndiff"] },
    ],
  };
}

export type LvsFault = "none" | "missing-pmos" | "extra-nmos" | "output-short" | "wrong-gate";

export function applyFault(graph: ConnectivityGraph, fault: LvsFault): ConnectivityGraph {
  const devices = graph.devices.map((device) => ({ ...device, layoutIds: [...device.layoutIds] }));
  if (fault === "missing-pmos") return { ...graph, devices: devices.filter((device) => device.kind !== "pmos") };
  if (fault === "extra-nmos") {
    devices.push({ id: "MN-extra", kind: "nmos", gate: "A", source: "GND", drain: "OUT", layoutIds: ["ndiff"] });
    return { ...graph, devices };
  }
  if (fault === "output-short") {
    return { ...graph, devices: devices.map((device) => (device.drain === "OUT" ? { ...device, drain: "VDD" } : device)) };
  }
  if (fault === "wrong-gate") {
    return { ...graph, devices: devices.map((device) => (device.kind === "pmos" ? { ...device, gate: "B" } : device)) };
  }
  return { ...graph, devices };
}

export interface ParasiticNet {
  net: string;
  length: number;
  width: number;
  resistance: number;
  capacitance: number;
  coupling: number;
  contactResistance: number;
  delay: number;
  shapeIds: string[];
}

export function extractParasitics(rects: LayoutRect[], input: {
  rPerSquare: number;
  cPerArea: number;
  coupling: boolean;
  contactOhm: number;
}): ParasiticNet[] {
  const metals = rects.filter((rect) => rect.layer === "metal1" || rect.layer === "metal2");
  const byNet = new Map<string, LayoutRect[]>();
  for (const metal of metals) {
    const list = byNet.get(metal.net) ?? [];
    list.push(metal);
    byNet.set(metal.net, list);
  }
  const nets: ParasiticNet[] = [];
  for (const [net, shapes] of byNet) {
    const length = shapes.reduce((sum, shape) => sum + Math.max(shape.w, shape.h), 0);
    const width = shapes.reduce((sum, shape) => sum + Math.min(shape.w, shape.h), 0) / shapes.length;
    const resistance = input.rPerSquare * (length / Math.max(0.2, width));
    const area = shapes.reduce((sum, shape) => sum + shape.w * shape.h, 0);
    let coupling = 0;
    if (input.coupling) {
      for (const shape of shapes) {
        for (const other of metals) {
          if (other.net === net) continue;
          const xOverlap = Math.min(shape.x + shape.w, other.x + other.w) - Math.max(shape.x, other.x);
          const yOverlap = Math.min(shape.y + shape.h, other.y + other.h) - Math.max(shape.y, other.y);
          const gap = axisGap(shape, other);
          const span = xOverlap > 0 ? xOverlap : yOverlap;
          if (gap !== null && gap > 0 && gap < 12 && span > 0) coupling += input.cPerArea * span / gap;
        }
      }
    }
    const contacts = rects.filter((rect) => rect.layer === "contact" && rect.net === net).length;
    const capacitance = input.cPerArea * area + coupling;
    const contactResistance = contacts * input.contactOhm;
    nets.push({
      net,
      length,
      width,
      resistance,
      capacitance,
      coupling,
      contactResistance,
      delay: 0.69 * (resistance + contactResistance) * Math.max(capacitance, 1e-6),
      shapeIds: shapes.map((shape) => shape.id),
    });
  }
  return nets.sort((a, b) => a.net.localeCompare(b.net));
}

function axisGap(a: LayoutRect | undefined, b: LayoutRect): number | null {
  if (!a) return null;
  const xOverlap = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const yOverlap = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  if (xOverlap > 0 && yOverlap > 0) return null;
  if (xOverlap > 0) return Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h);
  if (yOverlap > 0) return Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w);
  return null;
}
