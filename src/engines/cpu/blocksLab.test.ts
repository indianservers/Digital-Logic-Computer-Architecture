import { describe, expect, it } from "vitest";
import {
  applyAlu,
  captureBus,
  executeAlu,
  freshClock,
  freshCpu,
  parseWord,
  presetRegisters,
  rotateLeftBits,
  rotateRightBits,
  shiftLeftBits,
  shiftRightArithmeticBits,
  shiftRightLogicalBits,
  signExtendBits,
  stepClock,
  toBinary,
  toHex,
  toSigned,
  u32,
  writeRegister,
  zeroExtendBits,
} from "./blocksLab";

describe("cpu building blocks", () => {
  it("writes, masks, and resets a register", () => {
    const cpu = writeRegister(freshCpu(), 0, 0x1ffffffff);
    expect(cpu.regs[0]).toBe(0xffffffff);
    expect(u32(-1)).toBe(0xffffffff);
    expect(toHex(16)).toBe("0x00000010");
    expect(toBinary(0b1010, 4)).toBe("1010");
    expect(presetRegisters("zero").every((value) => value === 0)).toBe(true);
    expect(parseWord("zz", "hex").ok).toBe(false);
  });

  it("adds, subtracts, and sets flags", () => {
    const wrap = executeAlu("add", 0xffffffff, 1);
    expect(wrap.result).toBe(0);
    expect(wrap.z).toBe(1);
    expect(wrap.c).toBe(1);
    const overflow = executeAlu("add", 0x7fffffff, 1);
    expect(overflow.result).toBe(0x80000000);
    expect(overflow.n).toBe(1);
    expect(overflow.v).toBe(1);
    expect(overflow.c).toBe(0);
    const negative = executeAlu("sub", 0, 1);
    expect(negative.result).toBe(0xffffffff);
    expect(negative.n).toBe(1);
    expect(negative.c).toBe(0);
    const written = applyAlu(writeRegister(writeRegister(freshCpu(), 1, 10), 2, 20), "add", 10, 20, 3);
    expect(written.result).toBe(30);
    expect(written.cpu.regs[3]).toBe(30);
    expect(written.cpu.regs[1]).toBe(10);
  });

  it("transfers one bus driver and rejects none or two", () => {
    const ok = captureBus([{ name: "Registers", enabled: true, value: 30 }, { name: "PC", enabled: false, value: 4 }]);
    expect(ok.value).toBe(30);
    expect(ok.contention).toBe(false);
    expect(captureBus([{ name: "PC", enabled: false, value: 1 }]).value).toBe("Z");
    const clash = captureBus([{ name: "PC", enabled: true, value: 1 }, { name: "Registers", enabled: true, value: 2 }]);
    expect(clash.value).toBe("X");
    expect(clash.contention).toBe(true);
  });

  it("extends, shifts, and rotates", () => {
    expect(signExtendBits(0b1010, 4, 8)).toBe(0b11111010);
    expect(toSigned(signExtendBits(0b1010, 4, 8), 8)).toBe(-6);
    expect(signExtendBits(0b0010, 4, 8)).toBe(0b0010);
    expect(zeroExtendBits(0b1010, 4, 8)).toBe(0b00001010);
    expect(shiftLeftBits(0b0001, 8, 2).result).toBe(0b0100);
    expect(shiftRightLogicalBits(0b11110000, 8, 2).result).toBe(0b00111100);
    expect(shiftRightArithmeticBits(0b11110000, 8, 2).result).toBe(0b11111100);
    expect(rotateLeftBits(0b10000001, 8, 1)).toBe(0b00000011);
    expect(rotateRightBits(0b10000001, 8, 1)).toBe(0b11000000);
  });

  it("captures only on the selected edge when enable is high", () => {
    const start = { ...freshClock(), data: 0x5, enable: true, mode: "rising" as const };
    const between = { ...start, data: 0x9 };
    expect(between.q).toBe(0);
    const rising = stepClock(start, 0x5, true);
    expect(rising.edge).toBe("rising");
    expect(rising.captured).toBe(true);
    expect(rising.machine.q).toBe(0x5);
    const falling = stepClock(rising.machine, 0x7, true);
    expect(falling.edge).toBe("falling");
    expect(falling.captured).toBe(false);
    expect(falling.machine.q).toBe(0x5);
    const blocked = stepClock({ ...freshClock(), mode: "rising" }, 0x5, false);
    expect(blocked.captured).toBe(false);
    expect(blocked.machine.q).toBe(0);
    const fallMode = stepClock({ ...freshClock(), level: 1, mode: "falling", data: 0x3 }, 0x3, true);
    expect(fallMode.edge).toBe("falling");
    expect(fallMode.machine.q).toBe(0x3);
  });
});
