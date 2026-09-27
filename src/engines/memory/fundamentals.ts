/** Pure teaching models for the Memory Fundamentals studio. UI reads these results; it does not invent them. */

export type Endian = "little" | "big";
export type SramMode = "hold" | "read" | "write0" | "write1";
export type DramOp = "write1" | "write0" | "hold" | "read" | "refresh";
export type RomVariant = "rom" | "prom" | "eprom" | "eeprom";
export type FlashCell = "slc" | "mlc" | "tlc" | "qlc";
export type FlashKind = "nand" | "nor";
export type PreloadKind = "zero" | "increment" | "random" | "alternate" | "ascii" | "program" | "custom";

export interface AccessStep {
  id: string;
  title: string;
  signal: string;
  part: string;
  explain: string;
}

export const READ_STEPS: AccessStep[] = [
  { id: "address", title: "CPU places address on address bus", signal: "Address", part: "mar", explain: "The address bits leave the CPU and sit on the address bus." },
  { id: "decode", title: "Address decoder selects memory location", signal: "Address", part: "decoder", explain: "Exactly one decoder output goes high. That line is the selected cell." },
  { id: "ce", title: "CE asserted", signal: "CE", part: "decoder", explain: "Chip enable qualifies the array. Without CE the chip ignores the bus." },
  { id: "oe", title: "OE/RD asserted", signal: "OE", part: "cell", explain: "Output enable lets the selected cell drive the data pins." },
  { id: "drive", title: "Memory drives data bus", signal: "Data Out", part: "dbus", explain: "The stored byte travels from the cell onto D7–D0." },
  { id: "sample", title: "CPU samples data", signal: "Data Out", part: "mdr", explain: "The memory data register captures the byte. The read is complete." },
];

export const WRITE_STEPS: AccessStep[] = [
  { id: "address", title: "CPU places address on address bus", signal: "Address", part: "mar", explain: "The write still begins with a stable address." },
  { id: "data", title: "CPU places data on data bus", signal: "Data In", part: "mdr", explain: "The new byte is driven from the CPU onto D7–D0." },
  { id: "decode", title: "Decoder selects location", signal: "Address", part: "decoder", explain: "The decoder picks the one cell that will change." },
  { id: "ce", title: "CE asserted", signal: "CE", part: "decoder", explain: "Chip enable arms the selected cell." },
  { id: "we", title: "WE asserted", signal: "WE", part: "cell", explain: "Write enable stores the bus value into that cell." },
  { id: "stored", title: "Cell stores new value", signal: "Data In", part: "dbus", explain: "The cell now holds the new byte. A later read returns it." },
];

export const MAP_REGIONS = [
  { id: "boot", start: 0x00, end: 0x0f, name: "System / Boot", note: "Reset vectors and the first instructions." },
  { id: "vars", start: 0x10, end: 0x1f, name: "Variables", note: "Named values the program reads and writes." },
  { id: "code", start: 0x20, end: 0x2f, name: "Program Code", note: "Instructions fetched by the CPU." },
  { id: "user", start: 0x30, end: 0x3f, name: "User Data", note: "Buffers and values owned by the program." },
] as const;

const PROGRAM = [0x3c, 0x12, 0xa5, 0xff, 0x10, 0x20, 0x00, 0x1c, 0x08, 0x00, 0x7e, 0x91, 0x00, 0x40, 0x00, 0x00];
const ASCII = "HELLO MEMORY".split("").map((char) => char.charCodeAt(0));

export function addressCount(bits: number): number {
  const width = Math.max(1, Math.min(16, Math.floor(bits)));
  return 2 ** width;
}

export function hexDigits(width: number): number {
  return Math.max(1, Math.ceil(width / 4));
}

export function formatHex(value: number, digits: number): string {
  const safe = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  return safe.toString(16).toUpperCase().padStart(Math.max(1, digits), "0");
}

export function toBinary(value: number, width: number): string {
  const bits = Math.max(1, width);
  const mask = bits >= 31 ? value >>> 0 : value & ((1 << bits) - 1);
  return mask.toString(2).padStart(bits, "0").slice(-bits);
}

export function parseHexStrict(text: string, max: number): { ok: true; value: number } | { ok: false; error: string } {
  const raw = text.trim().replace(/^0x/i, "");
  if (!raw || !/^[0-9a-fA-F]+$/.test(raw)) return { ok: false, error: "Enter a hexadecimal value." };
  const value = Number.parseInt(raw, 16);
  if (value > max) return { ok: false, error: `Must be 0x${formatHex(0, hexDigits(Math.ceil(Math.log2(max + 1) || 1)))}–0x${formatHex(max, hexDigits(Math.ceil(Math.log2(max + 1) || 1)))}.` };
  return { ok: true, value };
}

export function validateAddress(text: string, addressBits: number): { ok: true; value: number } | { ok: false; error: string } {
  return parseHexStrict(text, addressCount(addressBits) - 1);
}

export function validateData(text: string, dataBits: number): { ok: true; value: number } | { ok: false; error: string } {
  const bits = Math.max(1, Math.min(16, dataBits));
  return parseHexStrict(text, bits >= 16 ? 0xffff : (1 << bits) - 1);
}

export function regionFor(address: number) {
  return MAP_REGIONS.find((item) => address >= item.start && address <= item.end) ?? null;
}

export function regionBytes(start: number, end: number): number {
  return Math.max(0, end - start + 1);
}

export function combineWord(lowAddressByte: number, highAddressByte: number, endian: Endian): number {
  const lo = lowAddressByte & 0xff;
  const hi = highAddressByte & 0xff;
  return endian === "little" ? (hi << 8) | lo : (lo << 8) | hi;
}

export function preloadCells(kind: PreloadKind, words: number, dataBits: number, custom = 0): number[] {
  const count = Math.max(1, words);
  const mask = dataBits >= 16 ? 0xffff : (1 << Math.max(1, dataBits)) - 1;
  const random = mulberry32(0x5eed);
  return Array.from({ length: count }, (_, index) => {
    if (kind === "zero") return 0;
    if (kind === "increment") return index & mask;
    if (kind === "random") return Math.floor(random() * (mask + 1)) & mask;
    if (kind === "alternate") return (index % 2 === 0 ? 0xaa : 0x55) & mask;
    if (kind === "ascii") return (ASCII[index % ASCII.length] ?? 0) & mask;
    if (kind === "custom") return custom & mask;
    return (PROGRAM[index % PROGRAM.length] ?? 0) & mask;
  });
}

export function signalHigh(steps: AccessStep[], cursor: number, name: string): boolean {
  const index = steps.findIndex((step) => step.signal === name);
  if (index < 0) return false;
  return cursor >= index;
}

export interface SramCell {
  q: 0 | 1;
  wl: 0 | 1;
  bl: 0 | 1;
  blb: 0 | 1;
  mode: SramMode;
  stable: boolean;
}

export function applySram(cell: SramCell, mode: SramMode): SramCell {
  if (mode === "hold") return { ...cell, wl: 0, mode, stable: true };
  if (mode === "write1") return { q: 1, wl: 1, bl: 1, blb: 0, mode, stable: true };
  if (mode === "write0") return { q: 0, wl: 1, bl: 0, blb: 1, mode, stable: true };
  return { q: cell.q, wl: 1, bl: cell.q, blb: cell.q ? 0 : 1, mode: "read", stable: true };
}

export function decayCharge(charge: number, leakage: number, ticks = 1): number {
  return Math.max(0, Math.min(100, charge - leakage * ticks));
}

export function senseDram(charge: number, stored: 0 | 1, threshold = 40): { bit: 0 | 1; reliable: boolean } {
  if (stored === 0) return { bit: 0, reliable: charge <= threshold };
  const bit: 0 | 1 = charge >= threshold ? 1 : 0;
  return { bit, reliable: charge >= threshold + 15 };
}

export function restoreCharge(stored: 0 | 1): number {
  return stored ? 100 : 8;
}

export const DRAM_READ = [
  "Bitline is precharged.",
  "Wordline rises and the access transistor turns on.",
  "The capacitor shares charge with the bitline.",
  "The sense amplifier resolves the bit.",
  "The cell is restored, because the read disturbed the charge.",
] as const;

export function romRead(cells: number[], address: number): { ok: boolean; data: number; explain: string } {
  if (address < 0 || address >= cells.length) return { ok: false, data: 0, explain: "That address is outside this ROM." };
  const data = cells[address] ?? 0;
  return { ok: true, data, explain: `ROM address ${formatHex(address, 2)} drives ${formatHex(data, 2)}. A write cannot change a burned cell.` };
}

export function romRejectWrite(cells: number[], address: number): { ok: false; data: number; explain: string } {
  const data = cells[address] ?? 0;
  return { ok: false, data, explain: "This ROM is read-only. Return to Design ROM to change the pattern, then burn it again." };
}

export interface EepromCell {
  value: number;
  cycles: number;
}

export function eepromWrite(cell: EepromCell, value: number): EepromCell {
  return { value: value & 0xff, cycles: cell.cycles + 1 };
}

export function pageSpan(address: number, pageSize: number, length: number): number[] {
  const size = Math.max(1, pageSize);
  const start = Math.floor(address / size) * size;
  const out: number[] = [];
  for (let index = start; index < start + size && index < length; index += 1) out.push(index);
  return out;
}

export function flashProgramAllowed(current: number, next: number): { ok: boolean; explain: string } {
  if (current === 0xff || current === (next & 0xff)) return { ok: true, explain: "The cell is erased, so the page program can store the new byte." };
  return { ok: false, explain: "Flash cannot overwrite a programmed cell. Erase the block first, then program." };
}

export function eraseBlockCells(cells: number[], block: number, pageCount: number, pageSize: number): { cells: number[]; start: number; end: number } {
  const span = Math.max(1, pageCount) * Math.max(1, pageSize);
  const start = block * span;
  const next = cells.slice();
  const end = Math.min(cells.length, start + span);
  for (let index = start; index < end; index += 1) next[index] = 0xff;
  return { cells: next, start, end: end - 1 };
}

export function chooseWearBlock(counts: number[], leveling: boolean, preferred: number): number {
  if (!leveling || counts.length === 0) return Math.min(counts.length - 1, Math.max(0, preferred));
  let best = 0;
  for (let index = 1; index < counts.length; index += 1) {
    if ((counts[index] ?? 0) < (counts[best] ?? 0)) best = index;
  }
  return best;
}

export const CELL_STATES: Record<FlashCell, { bits: number; levels: number; label: string }> = {
  slc: { bits: 1, levels: 2, label: "SLC" },
  mlc: { bits: 2, levels: 4, label: "MLC" },
  tlc: { bits: 3, levels: 8, label: "TLC" },
  qlc: { bits: 4, levels: 16, label: "QLC" },
};

export function rangeEnd(start: number, size: number): number {
  return start + Math.max(1, size) - 1;
}

export function rangeSize(start: number, end: number): number {
  return Math.max(0, end - start + 1);
}

export function isAligned(address: number, alignment: number): boolean {
  const unit = Math.max(1, alignment);
  return address % unit === 0;
}

export function bitsNeeded(locations: number): number {
  if (locations <= 1) return 1;
  return Math.ceil(Math.log2(locations));
}

export function widthChips(requiredWidth: number, chipWidth: number): number {
  if (chipWidth <= 0) return 0;
  return Math.ceil(requiredWidth / chipWidth);
}

export function depthChips(requiredLocations: number, chipLocations: number): number {
  if (chipLocations <= 0) return 0;
  return Math.ceil(requiredLocations / chipLocations);
}

export function totalChips(widthFactor: number, depthFactor: number): number {
  return Math.max(0, widthFactor) * Math.max(0, depthFactor);
}

export function capacityFromPins(addressPins: number, dataPins: number): { locations: number; bits: number; bytes: number } {
  const locations = addressCount(addressPins);
  const bits = locations * Math.max(1, dataPins);
  return { locations, bits, bytes: bits / 8 };
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 && bytes % (1024 * 1024) === 0) return `${bytes / (1024 * 1024)} MiB`;
  if (bytes >= 1024 && bytes % 1024 === 0) return `${bytes / 1024} KiB`;
  return `${bytes} B`;
}

export function chipNotation(locations: number, width: number): string {
  const label = locations % 1024 === 0 && locations >= 1024 ? `${locations / 1024}K` : String(locations);
  return `${label} × ${width}`;
}

export interface MapRegion {
  id: string;
  name: string;
  start: number;
  end: number;
}

export function regionIssues(regions: MapRegion[], space: number): string[] {
  const notes: string[] = [];
  regions.forEach((region, index) => {
    if (region.start < 0 || region.end >= space || region.end < region.start) notes.push(`${region.name} is outside 0x00–0x${formatHex(space - 1, 2)}.`);
    for (let other = index + 1; other < regions.length; other += 1) {
      const next = regions[other];
      if (!next) continue;
      if (region.start <= next.end && next.start <= region.end) notes.push(`${region.name} overlaps ${next.name}.`);
    }
  });
  const sorted = regions.filter((region) => region.end >= region.start).slice().sort((a, b) => a.start - b.start);
  let cursor = 0;
  sorted.forEach((region) => {
    if (region.start > cursor) notes.push(`Gap 0x${formatHex(cursor, 2)}–0x${formatHex(region.start - 1, 2)}.`);
    cursor = Math.max(cursor, region.end + 1);
  });
  if (sorted.length && cursor < space) notes.push(`Gap 0x${formatHex(cursor, 2)}–0x${formatHex(space - 1, 2)}.`);
  return notes;
}

export function interleaveBank(address: number, banks: number): number {
  const count = Math.max(1, banks);
  return ((address % count) + count) % count;
}

function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
