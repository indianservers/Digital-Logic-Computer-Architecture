import { describe, expect, it } from "vitest";
import {
  addressCount,
  applySram,
  bitsNeeded,
  capacityFromPins,
  chipNotation,
  chooseWearBlock,
  combineWord,
  decayCharge,
  depthChips,
  eepromWrite,
  eraseBlockCells,
  flashProgramAllowed,
  formatBytes,
  formatHex,
  interleaveBank,
  isAligned,
  pageSpan,
  parseHexStrict,
  preloadCells,
  rangeEnd,
  rangeSize,
  regionFor,
  regionIssues,
  restoreCharge,
  romRead,
  romRejectWrite,
  senseDram,
  toBinary,
  totalChips,
  validateAddress,
  validateData,
  widthChips,
} from "./fundamentals";

describe("memory fundamentals", () => {
  it("parses hex, rejects junk, and formats binary", () => {
    expect(parseHexStrict("0x12", 255)).toEqual({ ok: true, value: 0x12 });
    expect(parseHexStrict("a5", 255)).toEqual({ ok: true, value: 0xa5 });
    expect(parseHexStrict("GG", 255).ok).toBe(false);
    expect(formatHex(0x12, 2)).toBe("12");
    expect(toBinary(0x3c, 8)).toBe("00111100");
    expect(toBinary(0x12, 6)).toBe("010010");
  });

  it("limits addresses to the chip and bytes to 00–FF", () => {
    expect(addressCount(6)).toBe(64);
    expect(validateAddress("00", 6)).toEqual({ ok: true, value: 0 });
    expect(validateAddress("3F", 6)).toEqual({ ok: true, value: 0x3f });
    expect(validateAddress("40", 6).ok).toBe(false);
    expect(validateData("00", 8).ok).toBe(true);
    expect(validateData("FF", 8)).toEqual({ ok: true, value: 255 });
    expect(validateData("100", 8).ok).toBe(false);
    expect(regionFor(0x12)?.name).toBe("Variables");
    expect(regionFor(0x00)?.name).toBe("System / Boot");
  });

  it("steps an SRAM cell through hold, write, and read", () => {
    const hold = applySram({ q: 0, wl: 0, bl: 0, blb: 1, mode: "hold", stable: true }, "hold");
    expect(hold.wl).toBe(0);
    const one = applySram(hold, "write1");
    expect(one).toMatchObject({ q: 1, bl: 1, blb: 0, wl: 1 });
    const zero = applySram(one, "write0");
    expect(zero).toMatchObject({ q: 0, bl: 0, blb: 1 });
    const read = applySram(one, "read");
    expect(read.q).toBe(1);
    expect(read.bl).toBe(1);
    expect(read.blb).toBe(0);
  });

  it("decays DRAM charge and restores it on refresh", () => {
    expect(decayCharge(80, 30)).toBe(50);
    expect(decayCharge(10, 40)).toBe(0);
    expect(senseDram(72, 1).reliable).toBe(true);
    expect(senseDram(10, 1)).toMatchObject({ bit: 0, reliable: false });
    expect(restoreCharge(1)).toBe(100);
    expect(restoreCharge(0)).toBeLessThan(40);
  });

  it("keeps ROM read-only", () => {
    const cells = [0x3c, 0x12];
    expect(romRead(cells, 1)).toMatchObject({ ok: true, data: 0x12 });
    expect(romRejectWrite(cells, 1).ok).toBe(false);
    expect(cells[1]).toBe(0x12);
  });

  it("counts EEPROM writes and page membership", () => {
    expect(eepromWrite({ value: 0xff, cycles: 2 }, 0xa5)).toEqual({ value: 0xa5, cycles: 3 });
    expect(pageSpan(5, 4, 256)).toEqual([4, 5, 6, 7]);
  });

  it("requires a flash erase before a second program", () => {
    expect(flashProgramAllowed(0xff, 0xa5).ok).toBe(true);
    expect(flashProgramAllowed(0xa5, 0x5a).ok).toBe(false);
    const erased = eraseBlockCells([0xa5, 0x11, 0xff, 0x00], 0, 1, 4);
    expect(erased.cells).toEqual([0xff, 0xff, 0xff, 0xff]);
    expect(chooseWearBlock([3, 1, 4], true, 0)).toBe(1);
    expect(chooseWearBlock([3, 1, 4], false, 0)).toBe(0);
  });

  it("calculates ranges, alignment, and address bits", () => {
    expect(rangeEnd(0x10, 0x20)).toBe(0x2f);
    expect(rangeSize(0x10, 0x2f)).toBe(0x20);
    expect(isAligned(0x2d, 4)).toBe(false);
    expect(isAligned(0x2c, 4)).toBe(true);
    expect(bitsNeeded(1024)).toBe(10);
    expect(bitsNeeded(4096)).toBe(12);
    expect(regionIssues([{ id: "a", name: "Boot", start: 0, end: 10 }, { id: "b", name: "Code", start: 8, end: 20 }], 32).some((note) => note.includes("overlaps"))).toBe(true);
  });

  it("expands chips by width, depth, and both", () => {
    expect(widthChips(8, 4)).toBe(2);
    expect(depthChips(2048, 1024)).toBe(2);
    expect(totalChips(2, 2)).toBe(4);
    expect(capacityFromPins(10, 8)).toEqual({ locations: 1024, bits: 8192, bytes: 1024 });
    expect(formatBytes(1024)).toBe("1 KiB");
    expect(chipNotation(1024, 8)).toBe("1K × 8");
    expect(combineWord(0x10, 0x20, "little")).toBe(0x2010);
    expect(combineWord(0x10, 0x20, "big")).toBe(0x1020);
  });

  it("spreads sequential addresses across banks", () => {
    expect([0, 1, 2, 3, 4, 5].map((address) => interleaveBank(address, 4))).toEqual([0, 1, 2, 3, 0, 1]);
    const increment = preloadCells("increment", 4, 8);
    expect(increment).toEqual([0, 1, 2, 3]);
    expect(preloadCells("alternate", 2, 8)).toEqual([0xaa, 0x55]);
  });
});
