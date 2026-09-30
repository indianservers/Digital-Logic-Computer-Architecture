/** Educational standard-cell library. Not a foundry liberty file. */

export type Drive = 1 | 2 | 4;
export type CellName = "INV" | "BUF" | "NAND2" | "NOR2" | "AOI21" | "OAI21" | "DFF" | "MUX2" | "XOR2";

export interface PinDef {
  name: string;
  direction: "in" | "out" | "clk";
}

export interface CellSpec {
  name: CellName;
  function: string;
  pins: PinDef[];
  areaUnit: number;
  cinFf: number;
  pullKohm: number;
  fallRatio: number;
  leakageUw: number;
  dynamicFj: number;
}

export interface SizedCell {
  name: CellName;
  drive: Drive;
  function: string;
  pins: PinDef[];
  area: number;
  cinFf: number;
  risePs: number;
  fallPs: number;
  leakageUw: number;
  dynamicFj: number;
  maxLoadFf: number;
}

export const CELL_LIBRARY: Record<CellName, CellSpec> = {
  INV: { name: "INV", function: "Y = !A", pins: [{ name: "A", direction: "in" }, { name: "Y", direction: "out" }], areaUnit: 1.2, cinFf: 1.4, pullKohm: 2.4, fallRatio: 0.9, leakageUw: 0.02, dynamicFj: 1.1 },
  BUF: { name: "BUF", function: "Y = A", pins: [{ name: "A", direction: "in" }, { name: "Y", direction: "out" }], areaUnit: 2.0, cinFf: 1.4, pullKohm: 2.2, fallRatio: 1, leakageUw: 0.03, dynamicFj: 1.6 },
  NAND2: { name: "NAND2", function: "Y = !(A & B)", pins: [{ name: "A", direction: "in" }, { name: "B", direction: "in" }, { name: "Y", direction: "out" }], areaUnit: 1.6, cinFf: 1.5, pullKohm: 2.8, fallRatio: 1.15, leakageUw: 0.03, dynamicFj: 1.5 },
  NOR2: { name: "NOR2", function: "Y = !(A | B)", pins: [{ name: "A", direction: "in" }, { name: "B", direction: "in" }, { name: "Y", direction: "out" }], areaUnit: 1.6, cinFf: 1.6, pullKohm: 3.4, fallRatio: 0.85, leakageUw: 0.035, dynamicFj: 1.6 },
  AOI21: { name: "AOI21", function: "Y = !(A | (B & C))", pins: [{ name: "A", direction: "in" }, { name: "B", direction: "in" }, { name: "C", direction: "in" }, { name: "Y", direction: "out" }], areaUnit: 2.4, cinFf: 1.7, pullKohm: 3.6, fallRatio: 1.1, leakageUw: 0.05, dynamicFj: 2.2 },
  OAI21: { name: "OAI21", function: "Y = !(A & (B | C))", pins: [{ name: "A", direction: "in" }, { name: "B", direction: "in" }, { name: "C", direction: "in" }, { name: "Y", direction: "out" }], areaUnit: 2.4, cinFf: 1.7, pullKohm: 3.8, fallRatio: 1.05, leakageUw: 0.05, dynamicFj: 2.2 },
  DFF: { name: "DFF", function: "Q <= D on rising CLK", pins: [{ name: "D", direction: "in" }, { name: "CLK", direction: "clk" }, { name: "Q", direction: "out" }], areaUnit: 6.5, cinFf: 2.2, pullKohm: 2.6, fallRatio: 1, leakageUw: 0.12, dynamicFj: 4.8 },
  MUX2: { name: "MUX2", function: "Y = S ? B : A", pins: [{ name: "A", direction: "in" }, { name: "B", direction: "in" }, { name: "S", direction: "in" }, { name: "Y", direction: "out" }], areaUnit: 2.8, cinFf: 1.8, pullKohm: 3.2, fallRatio: 1, leakageUw: 0.05, dynamicFj: 2.4 },
  XOR2: { name: "XOR2", function: "Y = A ^ B", pins: [{ name: "A", direction: "in" }, { name: "B", direction: "in" }, { name: "Y", direction: "out" }], areaUnit: 3.2, cinFf: 2.4, pullKohm: 4.2, fallRatio: 1, leakageUw: 0.07, dynamicFj: 3.1 },
};

export const CELL_NAMES = Object.keys(CELL_LIBRARY) as CellName[];

/** Higher drive is wider: more area, more pin cap, less resistance, more leakage. */
export function sizeCell(name: CellName, drive: Drive, loadFf: number): SizedCell {
  const spec = CELL_LIBRARY[name];
  const cinFf = spec.cinFf * drive;
  const load = Math.max(0.2, loadFf);
  const risePs = 0.69 * (spec.pullKohm / drive) * (load + 0.15 * cinFf);
  return {
    name,
    drive,
    function: spec.function,
    pins: spec.pins,
    area: spec.areaUnit * drive,
    cinFf,
    risePs,
    fallPs: risePs * spec.fallRatio,
    leakageUw: spec.leakageUw * drive,
    dynamicFj: spec.dynamicFj * drive * (load / spec.cinFf),
    maxLoadFf: 16 * drive,
  };
}

export function evalCell(name: CellName, pins: Record<string, 0 | 1>): 0 | 1 {
  const a = pins.A ?? 0;
  const b = pins.B ?? 0;
  const c = pins.C ?? 0;
  const s = pins.S ?? 0;
  if (name === "INV") return a === 1 ? 0 : 1;
  if (name === "BUF" || name === "DFF") return a === 1 || pins.D === 1 ? (name === "DFF" ? (pins.D ?? 0) : a) : 0;
  if (name === "NAND2") return a === 1 && b === 1 ? 0 : 1;
  if (name === "NOR2") return a === 1 || b === 1 ? 0 : 1;
  if (name === "AOI21") return a === 1 || (b === 1 && c === 1) ? 0 : 1;
  if (name === "OAI21") return a === 1 && (b === 1 || c === 1) ? 0 : 1;
  if (name === "MUX2") return s === 1 ? b : a;
  return a === b ? 0 : 1;
}
