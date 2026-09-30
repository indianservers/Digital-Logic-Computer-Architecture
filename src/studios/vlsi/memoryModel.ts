import { decodeAddress } from "../../engines/memory/addressDecoder";
import {
  CELL_STATES,
  applySram,
  decayCharge,
  eepromWrite,
  flashProgramAllowed,
  restoreCharge,
  romRead,
  romRejectWrite,
  senseDram,
  type FlashCell,
  type SramMode,
} from "../../engines/memory/fundamentals";

export function sram6t(stored: 0 | 1, mode: SramMode, writeStrength: number, cellStrength: number, pulse: number): {
  q: 0 | 1;
  bl: 0 | 1;
  blb: 0 | 1;
  wl: 0 | 1;
  preserved: boolean;
  wrote: boolean;
  failed: boolean;
  snm: number;
  disturb: number;
} {
  const next = applySram({ q: stored, wl: 0, bl: stored, blb: stored ? 0 : 1, mode: "hold", stable: true }, mode);
  const writing = mode === "write0" || mode === "write1";
  const strong = writeStrength >= cellStrength && pulse >= 1;
  const q = writing && !strong ? stored : next.q;
  return {
    q,
    bl: next.bl,
    blb: next.blb,
    wl: next.wl,
    preserved: mode === "read" && q === stored,
    wrote: writing && strong && q !== stored,
    failed: writing && !strong,
    snm: 120 * cellStrength,
    disturb: mode === "read" ? Math.max(0, 1 - cellStrength) : 0,
  };
}

export function decodeMemory(address: number, rows: number, cols: number): {
  row: number;
  col: number;
  rowBits: string;
  colBits: string;
  activeRows: number;
} {
  const colBits = Math.max(1, Math.round(Math.log2(cols)));
  const rowBits = Math.max(1, Math.round(Math.log2(rows)));
  const col = address & ((1 << colBits) - 1);
  const rowAddress = (address >> colBits) & ((1 << rowBits) - 1);
  const decoded = decodeAddress(rowAddress, rowBits);
  return {
    row: decoded.index,
    col,
    rowBits: rowAddress.toString(2).padStart(rowBits, "0"),
    colBits: col.toString(2).padStart(colBits, "0"),
    activeRows: 1,
  };
}

export function sramReadWave(stored: 0 | 1, capFf: number, senseAt: number): {
  wl: number[];
  bl: number[];
  blb: number[];
  sense: number[];
  data: number[];
  deltaMv: number;
} {
  const cell = applySram({ q: stored, wl: 0, bl: 1, blb: 1, mode: "hold", stable: true }, "read");
  const droop = Math.min(0.25, 8 / Math.max(2, capFf));
  const wl: number[] = [];
  const bl: number[] = [];
  const blb: number[] = [];
  const sense: number[] = [];
  const data: number[] = [];
  for (let sample = 0; sample < 20; sample += 1) {
    const word = sample >= 4 && sample <= 14 ? 1 : 0;
    wl.push(word);
    const fall = word ? droop * Math.min(1, (sample - 4) / 4) : 0;
    bl.push(cell.bl === 0 ? 1 - fall : 1);
    blb.push(cell.blb === 0 ? 1 - fall : 1);
    const enabled = sample >= senseAt ? 1 : 0;
    sense.push(enabled);
    data.push(enabled && sample >= senseAt + 1 ? stored : 0);
  }
  const at = Math.max(0, Math.min(19, Math.round(senseAt)));
  const deltaMv = Math.abs((bl[at] ?? 1) - (blb[at] ?? 1)) * 1000;
  return { wl, bl, blb, sense, data, deltaMv };
}

export function sramWrite(stored: 0 | 1, value: 0 | 1, strength: number, cell: number, pulse: number): {
  q: number[];
  bl: number[];
  blb: number[];
  wl: number[];
  success: boolean;
  final: 0 | 1;
} {
  const mode: SramMode = value === 1 ? "write1" : "write0";
  const result = sram6t(stored, mode, strength, cell, pulse);
  const q: number[] = [];
  const bl: number[] = [];
  const blb: number[] = [];
  const wl: number[] = [];
  for (let sample = 0; sample < 16; sample += 1) {
    const driving = sample >= 2;
    const word = sample >= 4 && sample < 4 + pulse * 4;
    wl.push(word ? 1 : 0);
    bl.push(driving ? value : 0.5);
    blb.push(driving ? (value === 1 ? 0 : 1) : 0.5);
    const flipped = word && result.wrote && sample > 6;
    q.push(flipped ? value : stored);
  }
  return { q, bl, blb, wl, success: !result.failed && (result.wrote || value === stored), final: result.q };
}

export function senseAmplifier(deltaMv: number, offsetMv: number, noiseMv: number): {
  bit: 0 | 1;
  time: number;
  resolved: boolean;
} {
  const effective = deltaMv - offsetMv;
  const resolved = Math.abs(effective) > noiseMv;
  const bit: 0 | 1 = effective >= 0 ? 1 : 0;
  const time = 40 / Math.max(1, Math.abs(effective));
  return { bit: resolved ? bit : 0, time, resolved };
}

export function dramCycle(charge: number, stored: 0 | 1, leakage: number, op: "hold" | "read" | "refresh" | "write0" | "write1"): {
  charge: number;
  stored: 0 | 1;
  bit: 0 | 1;
  reliable: boolean;
} {
  if (op === "write0" || op === "write1") {
    const next: 0 | 1 = op === "write1" ? 1 : 0;
    return { charge: restoreCharge(next), stored: next, bit: next, reliable: true };
  }
  if (op === "refresh") {
    const sensed = senseDram(charge, stored);
    return { charge: restoreCharge(sensed.bit), stored: sensed.bit, bit: sensed.bit, reliable: sensed.reliable };
  }
  if (op === "read") {
    const sensed = senseDram(charge, stored);
    return { charge: restoreCharge(sensed.bit), stored: sensed.bit, bit: sensed.bit, reliable: sensed.reliable };
  }
  const nextCharge = decayCharge(charge, leakage);
  const sensed = senseDram(nextCharge, stored);
  return { charge: nextCharge, stored, bit: sensed.bit, reliable: sensed.reliable };
}

export function nonvolatileView(kind: "rom" | "eeprom" | "nor" | "nand", flash: FlashCell): {
  title: string;
  program: string;
  erase: string;
  read: string;
  levels: number;
  programOk: boolean;
  stored: number;
} {
  if (kind === "rom") {
    const read = romRead([0x3c, 0x12], 0);
    const write = romRejectWrite([0x3c], 0);
    return { title: "Mask ROM", program: "Fixed at manufacture", erase: "None", read: read.explain, levels: 2, programOk: write.ok, stored: read.data };
  }
  if (kind === "eeprom") {
    const cell = eepromWrite({ value: 0xff, cycles: 1 }, 0xa5);
    return { title: "EEPROM", program: "Byte electrical program", erase: "Byte electrical erase", read: `Byte is 0x${cell.value.toString(16)} after ${cell.cycles} cycles.`, levels: 2, programOk: true, stored: cell.value };
  }
  const info = CELL_STATES[flash];
  const check = flashProgramAllowed(kind === "nand" ? 0xa5 : 0xff, 0x5a);
  return {
    title: kind === "nand" ? "NAND Flash" : "NOR Flash",
    program: kind === "nand" ? "Page program after block erase" : "Byte or word program",
    erase: "Block erase",
    read: `${info.label} stores ${info.bits} bits with ${info.levels} threshold levels.`,
    levels: info.levels,
    programOk: check.ok,
    stored: check.ok ? 0x5a : 0xa5,
  };
}
