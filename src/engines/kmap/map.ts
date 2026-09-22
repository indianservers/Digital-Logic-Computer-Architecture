import type { Implicant } from "./quine";
import { maskToMinterms, termFromMask } from "./quine";

export type CellValue = 0 | 1 | "X";

export interface KMapLayout {
  variables: number;
  maps: number;
  rows: number;
  cols: number;
  rowBits: number;
  colBits: number;
}

export function grayCodes(bits: number): number[] {
  const count = 1 << bits;
  const codes: number[] = [];
  for (let i = 0; i < count; i += 1) codes.push(i ^ (i >> 1));
  return codes;
}

export function kmapLayout(variables: number): KMapLayout {
  if (variables <= 1) return { variables, maps: 1, rows: 1, cols: 2, rowBits: 0, colBits: 1 };
  if (variables === 2) return { variables, maps: 1, rows: 2, cols: 2, rowBits: 1, colBits: 1 };
  if (variables === 3) return { variables, maps: 1, rows: 2, cols: 4, rowBits: 1, colBits: 2 };
  if (variables === 4) return { variables, maps: 1, rows: 4, cols: 4, rowBits: 2, colBits: 2 };
  if (variables === 5) return { variables, maps: 2, rows: 4, cols: 4, rowBits: 2, colBits: 2 };
  return { variables: 6, maps: 4, rows: 4, cols: 4, rowBits: 2, colBits: 2 };
}

export function cellMinterm(variables: number, map: number, row: number, col: number): number {
  const layout = kmapLayout(variables);
  const rowCode = grayCodes(layout.rowBits)[row] ?? 0;
  const colCode = grayCodes(layout.colBits)[col] ?? 0;
  const inner = layout.rowBits + layout.colBits;
  return ((map << inner) | (rowCode << layout.colBits) | colCode) >>> 0;
}

export function headerBits(bits: number): string[] {
  return grayCodes(bits).map((code) => code.toString(2).padStart(bits, "0"));
}

export interface VisualRect {
  map: number;
  row: number;
  col: number;
  rowSpan: number;
  colSpan: number;
  label: string;
  wrap: boolean;
}

export function rectsForImplicant(implicant: Implicant, variables: number, label: string): VisualRect[] {
  const layout = kmapLayout(variables);
  const minterms = maskToMinterms(implicant.mask.padStart(variables, "0"));
  const byMap = new Map<number, Array<{ row: number; col: number }>>();
  for (const minterm of minterms) {
    const innerBits = layout.rowBits + layout.colBits;
    const map = minterm >> innerBits;
    const inner = minterm & ((1 << innerBits) - 1);
    const rowValue = inner >> layout.colBits;
    const colValue = inner & ((1 << layout.colBits) - 1);
    const row = grayCodes(layout.rowBits).indexOf(rowValue);
    const col = grayCodes(layout.colBits).indexOf(colValue);
    const list = byMap.get(map) ?? [];
    list.push({ row, col });
    byMap.set(map, list);
  }
  const rects: VisualRect[] = [];
  for (const [map, cells] of byMap) {
    rects.push(...rectangles(map, cells, layout.rows, layout.cols, label));
  }
  return rects;
}

function rectangles(
  map: number,
  cells: Array<{ row: number; col: number }>,
  rows: number,
  cols: number,
  label: string,
): VisualRect[] {
  const rowArc = arc(cells.map((cell) => cell.row), rows);
  const colArc = arc(cells.map((cell) => cell.col), cols);
  if (!rowArc || !colArc || rowArc.length * colArc.length !== cells.length) {
    return cells.map((cell) => ({ map, row: cell.row, col: cell.col, rowSpan: 1, colSpan: 1, label, wrap: false }));
  }
  return splitArc(map, rowArc, rows, colArc, cols, label);
}

interface Arc {
  start: number;
  length: number;
  wraps: boolean;
}

function arc(indices: number[], mod: number): Arc | null {
  if (mod <= 1) return { start: 0, length: 1, wraps: false };
  const uniq = [...new Set(indices)].sort((a, b) => a - b);
  if (uniq.length === 0) return null;
  if (uniq.length === mod) return { start: 0, length: mod, wraps: true };
  let maxGap = -1;
  let after = 0;
  for (let i = 0; i < uniq.length; i += 1) {
    const current = uniq[i] ?? 0;
    const next = uniq[(i + 1) % uniq.length] ?? 0;
    const gap = (next - current + mod) % mod;
    if (gap > maxGap) {
      maxGap = gap;
      after = i;
    }
  }
  const start = uniq[(after + 1) % uniq.length] ?? 0;
  for (let k = 0; k < uniq.length; k += 1) {
    if (!uniq.includes((start + k) % mod)) return null;
  }
  return { start, length: uniq.length, wraps: start + uniq.length > mod };
}

function splitArc(map: number, rowArc: Arc, rows: number, colArc: Arc, cols: number, label: string): VisualRect[] {
  const rowParts = parts(rowArc, rows);
  const colParts = parts(colArc, cols);
  const wrap = rowArc.wraps || colArc.wraps;
  const rects: VisualRect[] = [];
  for (const row of rowParts) {
    for (const col of colParts) {
      rects.push({ map, row: row.start, col: col.start, rowSpan: row.length, colSpan: col.length, label, wrap });
    }
  }
  return rects;
}

function parts(span: Arc, mod: number): Array<{ start: number; length: number }> {
  if (!span.wraps || span.length === mod) return [{ start: span.start % mod, length: span.length === mod ? mod : span.length }];
  const first = mod - span.start;
  return [
    { start: span.start, length: first },
    { start: 0, length: span.length - first },
  ];
}

export function describeImplicant(mask: string, variables: string[]): { term: string; kept: string; eliminated: string; covered: number[] } {
  const kept: string[] = [];
  const eliminated: string[] = [];
  [...mask].forEach((bit, index) => {
    const name = variables[index];
    if (!name) return;
    if (bit === "-") eliminated.push(name);
    else kept.push(bit === "1" ? `${name}=1` : `${name}=0`);
  });
  return {
    term: termFromMask(mask, variables),
    kept: kept.join(", ") || "every variable changed",
    eliminated: eliminated.join(", ") || "none",
    covered: maskToMinterms(mask),
  };
}
