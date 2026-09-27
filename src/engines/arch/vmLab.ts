/** Teaching virtual-memory helpers for the studio. The Phase 5 `translate` API stays in vm.ts. */

export interface LabPte {
  vpn: number;
  valid: boolean;
  frame: number;
  dirty: boolean;
  referenced: boolean;
  read: boolean;
  write: boolean;
  execute: boolean;
  user: boolean;
}

export interface AddressParts {
  virtualAddress: number;
  vpn: number;
  offset: number;
  vpnBits: number;
  offsetBits: number;
}

export type AccessKind = "read" | "write" | "exec";
export type Privilege = "user" | "kernel";
export type TlbAssoc = "full" | "direct" | "2" | "4";
export type TlbPolicy = "lru" | "fifo" | "random";

export interface LabTlbEntry {
  valid: boolean;
  vpn: number;
  pfn: number;
  asid: number;
  global: boolean;
  set: number;
  way: number;
  age: number;
  seq: number;
  dirty: boolean;
  read: boolean;
  write: boolean;
  execute: boolean;
  user: boolean;
}

export interface TlbGeometry {
  entries: number;
  ways: number;
  sets: number;
}

export type LabStatus = "tlb-hit" | "page-hit" | "fault" | "protection" | "privilege";

export interface TranslationEvent {
  stage: string;
  detail: string;
}

export interface LabTranslation {
  status: LabStatus;
  tlbHit: boolean;
  pageFault: boolean;
  protectionFault: boolean;
  privilegeFault: boolean;
  vpn: number;
  offset: number;
  pfn: number | null;
  physical: number | null;
  set: number;
  way: number | null;
  cycles: number;
  note: string;
  events: TranslationEvent[];
  tlb: LabTlbEntry[];
  victim: number | null;
}

export function nextSeed(seed: number): number {
  return (Math.imul(seed >>> 0, 1664525) + 1013904223) >>> 0;
}

export function calculatePageSize(offsetBits: number): number {
  const bits = clampInt(offsetBits, 0, 20);
  return 2 ** bits;
}

export function calculateVPNBits(addressBits: number, offsetBits: number): number {
  return Math.max(0, clampInt(addressBits, 1, 32) - clampInt(offsetBits, 0, 20));
}

export function formatHex(value: number, digits = 0): string {
  const text = (value >>> 0).toString(16).toUpperCase();
  return `0x${digits > 0 ? text.padStart(digits, "0") : text}`;
}

export function formatBinary(value: number, bits: number): string {
  const width = clampInt(bits, 1, 32);
  return (value >>> 0).toString(2).padStart(width, "0").slice(-width);
}

export function parseHexAddress(text: string, addressBits: number): { ok: true; value: number } | { ok: false; error: string } {
  const cleaned = text.trim().replace(/^0x/i, "");
  if (!/^[0-9a-f]+$/i.test(cleaned)) return { ok: false, error: "Enter a hexadecimal address." };
  const value = Number.parseInt(cleaned, 16);
  if (!Number.isFinite(value) || value < 0) return { ok: false, error: "That address is not a number." };
  const limit = addressBits >= 32 ? 0xffffffff : 2 ** clampInt(addressBits, 1, 31) - 1;
  if (value > limit) return { ok: false, error: `Address does not fit in ${addressBits} bits.` };
  return { ok: true, value };
}

export function splitVirtualAddress(virtualAddress: number, offsetBits: number, addressBits = 32): AddressParts {
  const bits = clampInt(offsetBits, 0, 20);
  const page = calculatePageSize(bits);
  const address = virtualAddress >>> 0;
  return {
    virtualAddress: address,
    vpn: Math.floor(address / page),
    offset: address % page,
    vpnBits: calculateVPNBits(addressBits, bits),
    offsetBits: bits,
  };
}

export function combinePhysicalAddress(pfn: number, offset: number, offsetBits: number): number {
  const page = calculatePageSize(offsetBits);
  return (Math.max(0, pfn) * page + (offset % page)) >>> 0;
}

export function blankPte(vpn: number): LabPte {
  return { vpn, valid: false, frame: 0, dirty: false, referenced: false, read: false, write: false, execute: false, user: true };
}

/** Default 8-page teaching table used by the Page Table tab (address 103, 16-byte pages). */
export function demoPageTable(): LabPte[] {
  const row = (vpn: number, valid: boolean, frame: number, dirty: boolean, referenced: boolean, write: boolean): LabPte => ({
    vpn, valid, frame, dirty, referenced, read: valid, write: valid && write, execute: false, user: true,
  });
  return [
    row(0, true, 1, false, true, false),
    row(1, true, 3, true, false, true),
    row(2, false, 0, false, false, false),
    row(3, true, 0, false, true, false),
    row(4, false, 0, false, false, false),
    row(5, true, 2, true, true, true),
    row(6, true, 1, false, true, false),
    row(7, false, 0, false, false, false),
  ];
}

export function randomPageTable(pages: number, frames: number, seed: number): { table: LabPte[]; seed: number } {
  const count = clampInt(pages, 1, 64);
  const frameCount = clampInt(frames, 1, 64);
  let cursor = seed >>> 0;
  const table: LabPte[] = [];
  for (let vpn = 0; vpn < count; vpn += 1) {
    cursor = nextSeed(cursor);
    const valid = cursor % 5 !== 0;
    cursor = nextSeed(cursor);
    const frame = cursor % frameCount;
    cursor = nextSeed(cursor);
    table.push({
      vpn,
      valid,
      frame,
      dirty: valid && cursor % 3 === 0,
      referenced: valid && cursor % 2 === 0,
      read: valid,
      write: valid && cursor % 2 === 1,
      execute: false,
      user: true,
    });
  }
  return { table, seed: cursor };
}

export function lookupPageTable(table: LabPte[], vpn: number): LabPte | null {
  return table.find((entry) => entry.vpn === vpn) ?? null;
}

export function handleFault(table: LabPte[], vpn: number, frames: number): { table: LabPte[]; frame: number; replaced: number | null } {
  const next = table.map((entry) => ({ ...entry }));
  const target = next.find((entry) => entry.vpn === vpn) ?? blankPte(vpn);
  if (!next.some((entry) => entry.vpn === vpn)) next.push(target);
  const used = new Set(next.filter((entry) => entry.valid).map((entry) => entry.frame));
  let frame = 0;
  let replaced: number | null = null;
  const limit = Math.max(1, frames);
  while (frame < limit && used.has(frame)) frame += 1;
  if (frame >= limit) {
    frame = 0;
    replaced = 0;
    for (const entry of next) {
      if (entry.valid && entry.frame === 0 && entry.vpn !== vpn) entry.valid = false;
    }
  }
  const slot = next.find((entry) => entry.vpn === vpn);
  if (slot) {
    slot.valid = true;
    slot.frame = frame;
    slot.read = true;
    slot.referenced = true;
    slot.user = true;
  }
  return { table: next, frame, replaced };
}

export function tlbGeometry(entries: number, assoc: TlbAssoc): TlbGeometry {
  const count = clampInt(entries, 1, 64);
  const ways = assoc === "full" ? count : assoc === "direct" ? 1 : assoc === "4" ? Math.min(4, count) : Math.min(2, count);
  return { entries: count, ways, sets: Math.max(1, Math.floor(count / ways)) };
}

export function setIndex(vpn: number, geometry: TlbGeometry): number {
  return geometry.sets <= 1 ? 0 : Math.abs(vpn) % geometry.sets;
}

export function emptyTlb(geometry: TlbGeometry): LabTlbEntry[] {
  const rows: LabTlbEntry[] = [];
  for (let set = 0; set < geometry.sets; set += 1) {
    for (let way = 0; way < geometry.ways; way += 1) {
      rows.push({ valid: false, vpn: 0, pfn: 0, asid: 0, global: false, set, way, age: 0, seq: 0, dirty: false, read: false, write: false, execute: false, user: true });
    }
  }
  return rows;
}

export function lookupTLB(tlb: LabTlbEntry[], vpn: number, asid: number, geometry: TlbGeometry): LabTlbEntry | null {
  const set = setIndex(vpn, geometry);
  return tlb.find((entry) => entry.valid && entry.set === set && entry.vpn === vpn && (entry.global || entry.asid === asid)) ?? null;
}

export function selectTLBVictim(tlb: LabTlbEntry[], set: number, policy: TlbPolicy, seed: number): { index: number; seed: number } {
  const indexes = tlb.map((entry, index) => ({ entry, index })).filter((row) => row.entry.set === set);
  const free = indexes.find((row) => !row.entry.valid);
  if (free) return { index: free.index, seed };
  if (policy === "random") {
    const next = nextSeed(seed);
    const pick = indexes[next % indexes.length];
    return { index: pick ? pick.index : 0, seed: next };
  }
  const ranked = indexes.slice().sort((a, b) => (policy === "fifo" ? a.entry.seq - b.entry.seq : a.entry.age - b.entry.age));
  return { index: ranked[0]?.index ?? 0, seed };
}

export function insertTLBEntry(
  tlb: LabTlbEntry[],
  vpn: number,
  pfn: number,
  asid: number,
  geometry: TlbGeometry,
  policy: TlbPolicy,
  seed: number,
  dirty = false,
  rights: Pick<LabPte, "read" | "write" | "execute" | "user"> = { read: true, write: true, execute: true, user: true },
): { tlb: LabTlbEntry[]; victim: number | null; way: number; set: number; seed: number } {
  const set = setIndex(vpn, geometry);
  const existing = tlb.findIndex((entry) => entry.valid && entry.set === set && entry.vpn === vpn && (entry.global || entry.asid === asid));
  const clock = tlb.reduce((max, entry) => Math.max(max, entry.age, entry.seq), 0) + 1;
  const next = tlb.map((entry) => ({ ...entry }));
  const chosen = existing >= 0 ? { index: existing, seed } : selectTLBVictim(next, set, policy, seed);
  const slot = next[chosen.index];
  const victim = slot?.valid && existing < 0 ? chosen.index : null;
  if (slot) {
    slot.valid = true;
    slot.vpn = vpn;
    slot.pfn = pfn;
    slot.asid = asid;
    slot.global = false;
    slot.dirty = dirty;
    slot.read = rights.read;
    slot.write = rights.write;
    slot.execute = rights.execute;
    slot.user = rights.user;
    slot.age = clock;
    if (existing < 0) slot.seq = clock;
  }
  return { tlb: next, victim, way: slot?.way ?? 0, set, seed: chosen.seed };
}

export function touchTLB(tlb: LabTlbEntry[], index: number): LabTlbEntry[] {
  const clock = tlb.reduce((max, entry) => Math.max(max, entry.age), 0) + 1;
  return tlb.map((entry, at) => (at === index ? { ...entry, age: clock } : entry));
}

export interface TranslateInput {
  virtualAddress: number;
  offsetBits: number;
  addressBits?: number;
  table: LabPte[];
  tlb: LabTlbEntry[];
  geometry: TlbGeometry;
  policy: TlbPolicy;
  asid: number;
  access: AccessKind;
  privilege?: Privilege;
  seed?: number;
  tlbCycles?: number;
  walkCycles?: number;
  install?: boolean;
}

export function checkProtection(entry: LabPte | null, access: AccessKind, privilege: Privilege): LabStatus | "ok" {
  if (!entry || !entry.valid) return "fault";
  if (privilege === "user" && !entry.user) return "privilege";
  if (access === "write" && !entry.write) return "protection";
  if (access === "exec" && !entry.execute) return "protection";
  if (access === "read" && !entry.read) return "protection";
  return "ok";
}

export function translateAddress(input: TranslateInput): LabTranslation {
  const parts = splitVirtualAddress(input.virtualAddress, input.offsetBits, input.addressBits ?? 32);
  const tlbCycles = input.tlbCycles ?? 1;
  const walkCycles = input.walkCycles ?? 100;
  const privilege = input.privilege ?? "kernel";
  const set = setIndex(parts.vpn, input.geometry);
  const events: TranslationEvent[] = [
    { stage: "split", detail: `VPN ${formatHex(parts.vpn)} offset ${formatHex(parts.offset)}` },
    { stage: "tlb", detail: `Set ${set}` },
  ];
  const hit = lookupTLB(input.tlb, parts.vpn, input.asid, input.geometry);
  if (hit) {
    const index = input.tlb.indexOf(hit);
    const tlb = touchTLB(input.tlb, index);
    const status = checkProtection(pteFromTlb(hit), input.access, privilege);
    if (status !== "ok") {
      return finish(parts, status, true, hit.pfn, null, set, hit.way, tlbCycles, events, tlb, null, reason(status, input.access));
    }
    const physical = combinePhysicalAddress(hit.pfn, parts.offset, input.offsetBits);
    events.push({ stage: "frame", detail: `TLB frame ${formatHex(hit.pfn)}` });
    return finish(parts, "tlb-hit", true, hit.pfn, physical, set, hit.way, tlbCycles, events, tlb, null, `Found in TLB entry ${index}`);
  }
  events.push({ stage: "walk", detail: "Page-table walk" });
  const pte = lookupPageTable(input.table, parts.vpn);
  const status = checkProtection(pte, input.access, privilege);
  if (status === "fault" || !pte) {
    return finish(parts, "fault", false, null, null, set, null, tlbCycles + walkCycles, events, input.tlb, null, "Page not present");
  }
  if (status !== "ok") {
    return finish(parts, status, false, pte.frame, null, set, null, tlbCycles + walkCycles, events, input.tlb, null, reason(status, input.access));
  }
  const installed = input.install === false
    ? { tlb: input.tlb, victim: null, way: null as number | null, seed: input.seed ?? 1 }
    : insertTLBEntry(input.tlb, parts.vpn, pte.frame, input.asid, input.geometry, input.policy, input.seed ?? 1, pte.dirty, pte);
  const physical = combinePhysicalAddress(pte.frame, parts.offset, input.offsetBits);
  const note = installed.victim === null ? "TLB miss; page-table walk" : `TLB miss; evicted entry ${installed.victim}`;
  events.push({ stage: "fill", detail: note });
  return finish(parts, "page-hit", false, pte.frame, physical, set, installed.way, tlbCycles + walkCycles, events, installed.tlb, installed.victim, note);
}

export interface DirectoryEntry {
  index: number;
  present: boolean;
  tableBase: number;
}

export interface SecondEntry {
  index: number;
  present: boolean;
  pfn: number;
  read: boolean;
  write: boolean;
  execute: boolean;
}

export interface TwoLevelMachine {
  directoryBits: number;
  tableBits: number;
  offsetBits: number;
  directory: DirectoryEntry[];
  tables: Map<number, SecondEntry[]>;
}

export function splitTwoLevelFields(address: number, directoryBits: number, tableBits: number, offsetBits: number): { pdi: number; pti: number; offset: number; vpn: number } | { error: string } {
  const dir = clampInt(directoryBits, 1, 16);
  const table = clampInt(tableBits, 1, 16);
  const offset = clampInt(offsetBits, 0, 16);
  if (dir + table + offset > 32) return { error: "Directory, table, and offset bits must sum to at most 32." };
  const parts = splitVirtualAddress(address, offset, dir + table + offset);
  const tableMask = (2 ** table) - 1;
  return { pdi: Math.floor(parts.vpn / (2 ** table)) & ((2 ** dir) - 1), pti: parts.vpn & tableMask, offset: parts.offset, vpn: parts.vpn };
}

export function demoTwoLevel(): TwoLevelMachine {
  const directoryBits = 10;
  const tableBits = 10;
  const offsetBits = 12;
  const fields = splitTwoLevelFields(0x16ca300, directoryBits, tableBits, offsetBits);
  const pdi = "error" in fields ? 5 : fields.pdi;
  const pti = "error" in fields ? 0x2ca : fields.pti;
  const directory: DirectoryEntry[] = [];
  for (let index = 0; index < 8; index += 1) {
    const at = pdi - 2 + index;
    directory.push({ index: at, present: at === pdi, tableBase: at === pdi ? 0x23f000 : 0 });
  }
  const rows: SecondEntry[] = [];
  for (let index = 0; index < 5; index += 1) {
    const at = pti - 2 + index;
    rows.push({ index: at, present: at === pti, pfn: at === pti ? 0x1a3 : 0, read: true, write: at === pti, execute: false });
  }
  return { directoryBits, tableBits, offsetBits, directory, tables: new Map([[0x23f000, rows]]) };
}

export function walkTwoLevelPageTable(machine: TwoLevelMachine, address: number): {
  pdi: number;
  pti: number;
  offset: number;
  pde: DirectoryEntry | null;
  pte: SecondEntry | null;
  pfn: number | null;
  physical: number | null;
  status: "ok" | "fault";
  note: string;
} {
  const fields = splitTwoLevelFields(address, machine.directoryBits, machine.tableBits, machine.offsetBits);
  if ("error" in fields) return { pdi: 0, pti: 0, offset: 0, pde: null, pte: null, pfn: null, physical: null, status: "fault", note: fields.error };
  const pde = machine.directory.find((entry) => entry.index === fields.pdi) ?? null;
  if (!pde?.present) {
    return { ...fields, pde, pte: null, pfn: null, physical: null, status: "fault", note: "Page directory entry is not present." };
  }
  const table = machine.tables.get(pde.tableBase) ?? [];
  const pte = table.find((entry) => entry.index === fields.pti) ?? null;
  if (!pte?.present) {
    return { ...fields, pde, pte, pfn: null, physical: null, status: "fault", note: "Second-level entry is not present." };
  }
  const physical = combinePhysicalAddress(pte.pfn, fields.offset, machine.offsetBits);
  return { ...fields, pde, pte, pfn: pte.pfn, physical, status: "ok", note: "Page walk complete." };
}

export function pageTableBytes(directoryBits: number, tableBits: number, allocatedFraction: number, entryBytes = 4): { single: number; hierarchical: number } {
  const pages = 2 ** (clampInt(directoryBits, 1, 12) + clampInt(tableBits, 1, 12));
  const directory = 2 ** clampInt(directoryBits, 1, 12);
  const inner = 2 ** clampInt(tableBits, 1, 12);
  const fraction = Math.min(1, Math.max(0, allocatedFraction));
  const usedTables = Math.max(0, Math.round(directory * fraction));
  return { single: pages * entryBytes, hierarchical: directory * entryBytes + usedTables * inner * entryBytes };
}

export interface Region {
  id: string;
  name: string;
  start: number;
  end: number;
  read: boolean;
  write: boolean;
  execute: boolean;
  user: boolean;
  present: boolean;
  frame: number;
  role: string;
}

/** Educational map. These ranges are a lab picture, not a claim about one operating system. */
export const REGIONS: Region[] = [
  { id: "code", name: "Code / Text", start: 0x00000000, end: 0x000fffff, read: true, write: false, execute: true, user: true, present: true, frame: 0x0100, role: "Program code (read/execute)" },
  { id: "data", name: "Data", start: 0x00100000, end: 0x001fffff, read: true, write: true, execute: false, user: true, present: true, frame: 0x0200, role: "Global/static data (read/write)" },
  { id: "heap", name: "Heap", start: 0x00400000, end: 0x005fffff, read: true, write: true, execute: false, user: true, present: true, frame: 0x0120, role: "User heap (read/write)" },
  { id: "stack", name: "Stack", start: 0x00600000, end: 0x006fffff, read: true, write: true, execute: false, user: true, present: true, frame: 0x0120, role: "User stack (read/write)" },
  { id: "kernel", name: "Kernel Space", start: 0x00c00000, end: 0x00cfffff, read: true, write: true, execute: true, user: false, present: true, frame: 0x3f00, role: "Supervisor only" },
  { id: "reserved", name: "Reserved", start: 0x00e00000, end: 0x00efffff, read: false, write: false, execute: false, user: false, present: false, frame: 0, role: "Not mapped" },
];

export function regionAt(address: number): Region | null {
  return REGIONS.find((region) => address >= region.start && address <= region.end) ?? null;
}

export function pteForAddress(address: number, offsetBits = 12): LabPte {
  const parts = splitVirtualAddress(address, offsetBits, 32);
  const region = regionAt(address);
  if (!region) return blankPte(parts.vpn);
  return {
    vpn: parts.vpn,
    valid: region.present,
    frame: region.present ? (region.frame + (parts.vpn & 0xff)) : 0,
    dirty: false,
    referenced: region.present,
    read: region.read,
    write: region.write,
    execute: region.execute,
    user: region.user,
  };
}

export function protectionCheck(address: number, access: AccessKind, privilege: Privilege, offsetBits = 12): {
  pte: LabPte;
  region: Region | null;
  status: LabStatus | "granted";
  physical: number | null;
  reason: string;
} {
  const pte = pteForAddress(address, offsetBits);
  const region = regionAt(address);
  const status = checkProtection(pte, access, privilege);
  if (status === "ok") {
    const parts = splitVirtualAddress(address, offsetBits, 32);
    return { pte, region, status: "granted", physical: combinePhysicalAddress(pte.frame, parts.offset, offsetBits), reason: `The page is valid and ${access === "exec" ? "executable" : access === "write" ? "writable" : "readable"} in ${privilege} mode.` };
  }
  return { pte, region, status, physical: null, reason: reason(status, access) };
}

function pteFromTlb(entry: LabTlbEntry): LabPte {
  return { vpn: entry.vpn, valid: true, frame: entry.pfn, dirty: entry.dirty, referenced: true, read: entry.read, write: entry.write, execute: entry.execute, user: entry.user };
}

function reason(status: LabStatus | "ok" | "fault" | "protection" | "privilege", access: AccessKind): string {
  if (status === "fault") return "Page not present.";
  if (status === "privilege") return "User access requested but the page is supervisor-only.";
  if (status === "protection" && access === "write") return "Write requested but W=0.";
  if (status === "protection" && access === "exec") return "Execute requested but X=0.";
  if (status === "protection") return "Read requested but R=0.";
  return "Allowed.";
}

function finish(
  parts: AddressParts,
  status: LabStatus,
  tlbHit: boolean,
  pfn: number | null,
  physical: number | null,
  set: number,
  way: number | null,
  cycles: number,
  events: TranslationEvent[],
  tlb: LabTlbEntry[],
  victim: number | null,
  note: string,
): LabTranslation {
  return {
    status,
    tlbHit,
    pageFault: status === "fault",
    protectionFault: status === "protection",
    privilegeFault: status === "privilege",
    vpn: parts.vpn,
    offset: parts.offset,
    pfn,
    physical,
    set,
    way,
    cycles,
    note,
    events,
    tlb,
    victim,
  };
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}
