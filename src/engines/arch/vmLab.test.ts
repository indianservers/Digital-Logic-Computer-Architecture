import { describe, expect, it } from "vitest";
import {
  calculatePageSize,
  calculateVPNBits,
  checkProtection,
  combinePhysicalAddress,
  demoPageTable,
  emptyTlb,
  handleFault,
  insertTLBEntry,
  lookupPageTable,
  lookupTLB,
  nextSeed,
  parseHexAddress,
  protectionCheck,
  randomPageTable,
  selectTLBVictim,
  setIndex,
  splitTwoLevelFields,
  splitVirtualAddress,
  tlbGeometry,
  translateAddress,
  walkTwoLevelPageTable,
  demoTwoLevel,
  type LabPte,
} from "./vmLab";

const pte = (vpn: number, frame: number, extra: Partial<LabPte> = {}): LabPte => ({
  vpn, valid: true, frame, dirty: false, referenced: true, read: true, write: true, execute: true, user: true, ...extra,
});

describe("virtual memory lab", () => {
  it("derives page size, VPN, offset, and a physical address", () => {
    expect(calculatePageSize(8)).toBe(256);
    expect(calculatePageSize(12)).toBe(4096);
    expect(calculateVPNBits(16, 8)).toBe(8);
    const parts = splitVirtualAddress(0x6783, 8, 16);
    expect(parts.vpn).toBe(0x67);
    expect(parts.offset).toBe(0x83);
    expect(combinePhysicalAddress(0x3a, 0x83, 8)).toBe(0x3a83);
  });

  it("translates a valid PTE and faults an invalid one", () => {
    const table = [pte(1, 4, { write: false, execute: false }), { ...pte(2, 0), valid: false }];
    const geometry = tlbGeometry(4, "full");
    const hit = translateAddress({ virtualAddress: 0x103, offsetBits: 8, table, tlb: emptyTlb(geometry), geometry, policy: "lru", asid: 1, access: "read" });
    expect(hit.status).toBe("page-hit");
    expect(hit.physical).toBe((4 << 8) | 3);
    expect(hit.tlb.some((entry) => entry.valid && entry.vpn === 1)).toBe(true);
    const fault = translateAddress({ virtualAddress: 0x200, offsetBits: 8, table, tlb: emptyTlb(geometry), geometry, policy: "lru", asid: 1, access: "read" });
    expect(fault.status).toBe("fault");
    expect(fault.tlb.every((entry) => !entry.valid)).toBe(true);
  });

  it("hits, misses, and inserts TLB entries", () => {
    const geometry = tlbGeometry(4, "full");
    const table = [pte(1, 9)];
    const first = translateAddress({ virtualAddress: 0x100, offsetBits: 8, table, tlb: emptyTlb(geometry), geometry, policy: "lru", asid: 1, access: "read" });
    expect(first.tlbHit).toBe(false);
    const second = translateAddress({ virtualAddress: 0x100, offsetBits: 8, table, tlb: first.tlb, geometry, policy: "lru", asid: 1, access: "read" });
    expect(second.status).toBe("tlb-hit");
    expect(second.cycles).toBe(1);
    expect(lookupTLB(first.tlb, 1, 1, geometry)?.pfn).toBe(9);
  });

  it("picks LRU and FIFO victims", () => {
    const geometry = tlbGeometry(2, "full");
    let tlb = emptyTlb(geometry);
    let seed = 1;
    const first = insertTLBEntry(tlb, 1, 10, 1, geometry, "lru", seed);
    tlb = first.tlb;
    const second = insertTLBEntry(tlb, 2, 11, 1, geometry, "lru", seed);
    tlb = second.tlb.map((entry) => (entry.vpn === 1 ? { ...entry, age: 50 } : entry));
    const lru = selectTLBVictim(tlb, 0, "lru", seed);
    expect(tlb[lru.index]?.vpn).toBe(2);
    const fifo = selectTLBVictim(second.tlb, 0, "fifo", seed);
    expect(second.tlb[fifo.index]?.vpn).toBe(1);
    seed = fifo.seed;
    expect(seed).toBe(1);
  });

  it("keeps the same VPN apart by ASID", () => {
    const geometry = tlbGeometry(4, "full");
    const filled = insertTLBEntry(emptyTlb(geometry), 7, 3, 1, geometry, "lru", 1);
    expect(lookupTLB(filled.tlb, 7, 1, geometry)?.pfn).toBe(3);
    expect(lookupTLB(filled.tlb, 7, 2, geometry)).toBeNull();
    const other = insertTLBEntry(filled.tlb, 7, 8, 2, geometry, "lru", 1);
    expect(lookupTLB(other.tlb, 7, 2, geometry)?.pfn).toBe(8);
    expect(lookupTLB(other.tlb, 7, 1, geometry)?.pfn).toBe(3);
  });

  it("indexes direct-mapped and 2-way sets", () => {
    const direct = tlbGeometry(8, "direct");
    expect(direct.sets).toBe(8);
    expect(setIndex(11, direct)).toBe(3);
    const ways = tlbGeometry(8, "2");
    expect(ways.sets).toBe(4);
    expect(ways.ways).toBe(2);
    expect(setIndex(6, ways)).toBe(2);
    const placed = insertTLBEntry(emptyTlb(ways), 6, 4, 1, ways, "lru", 1);
    expect(placed.set).toBe(2);
    expect(lookupTLB(placed.tlb, 6, 1, ways)?.set).toBe(2);
  });

  it("splits a two-level address and builds the physical address", () => {
    const fields = splitTwoLevelFields(0x16ca300, 10, 10, 12);
    expect("error" in fields).toBe(false);
    if ("error" in fields) return;
    expect(fields.offset).toBe(0x300);
    expect(fields.pdi).toBe(0x16ca300 >>> 22);
    expect(fields.pti).toBe((0x16ca300 >>> 12) & 0x3ff);
    const machine = demoTwoLevel();
    const walked = walkTwoLevelPageTable(machine, 0x16ca300);
    expect(walked.status).toBe("ok");
    expect(walked.pfn).toBe(0x1a3);
    expect(walked.physical).toBe((0x1a3 << 12) | 0x300);
    const missing = walkTwoLevelPageTable(machine, 0);
    expect(missing.status).toBe("fault");
  });

  it("checks read, write, execute, and privilege", () => {
    const code = protectionCheck(0x00001000, "read", "user");
    expect(code.status).toBe("granted");
    expect(protectionCheck(0x00101000, "write", "user").status).toBe("granted");
    expect(protectionCheck(0x00001000, "write", "user").status).toBe("protection");
    expect(protectionCheck(0x00101000, "exec", "user").status).toBe("protection");
    expect(protectionCheck(0x00c01000, "read", "user").status).toBe("privilege");
    expect(protectionCheck(0x00c01000, "read", "kernel").status).toBe("granted");
    expect(protectionCheck(0x00e01000, "read", "user").status).toBe("fault");
    const entry = lookupPageTable([pte(1, 4, { write: false })], 1);
    expect(checkProtection(entry, "read", "user")).toBe("ok");
    expect(checkProtection(entry, "write", "user")).toBe("protection");
  });

  it("resets to the demo table, rejects a wide address, and reseeds deterministically", () => {
    const demo = demoPageTable();
    const faulted = handleFault(demo, 2, 4);
    expect(faulted.table[2]?.valid).toBe(true);
    expect(demoPageTable()[2]?.valid).toBe(false);
    expect(parseHexAddress("0x1FFFF", 16).ok).toBe(false);
    expect(parseHexAddress("0x6783", 16).ok).toBe(true);
    const a = randomPageTable(8, 4, 7);
    const b = randomPageTable(8, 4, 7);
    const c = randomPageTable(8, 4, 8);
    expect(a.table).toEqual(b.table);
    expect(a.table).not.toEqual(c.table);
    expect(a.table).toHaveLength(8);
    expect(nextSeed(1)).toBe(nextSeed(1));
    expect(randomPageTable(4, 2, 3).table).toHaveLength(4);
  });
});
