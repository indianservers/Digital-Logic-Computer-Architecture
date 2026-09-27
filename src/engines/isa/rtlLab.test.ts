import { describe, expect, it } from "vitest";
import { evalRtl, parseRtl } from "./rtl";
import { applyBusWrite, busValue, controlWord, mask16, previewRtl, stagesFor } from "./rtlLab";

const REGS = [0, 5, 3, 0, 0, 0, 0, 0];

describe("register transfer lab", () => {
  it("executes add, sub, and, or, xor, and move in 16 bits", () => {
    expect(evalRtl(REGS, "R3 <- R1 + R2").regs[3]).toBe(8);
    expect(evalRtl(REGS, "R4 <- R2 - R1").regs[4]).toBe(mask16(3 - 5));
    expect(evalRtl([0, 5, 3, 0, 0, 0, 0, 0], "R5 <- R1 & R2").regs[5]).toBe(5 & 3);
    expect(evalRtl(REGS, "R6 <- R1 | R2").regs[6]).toBe(5 | 3);
    expect(evalRtl(REGS, "R7 <- R1 ^ R2").regs[7]).toBe(5 ^ 3);
    expect(evalRtl(REGS, "R3 ← R1").regs[3]).toBe(5);
    expect(evalRtl(REGS, "R3 <- R1 + R2").regs[1]).toBe(5);
    expect(evalRtl([0, 0xffff, 1, 0, 0, 0, 0, 0], "R3 <- R1 + R2").regs[3]).toBe(0);
  });

  it("rejects a bad expression and does not invent a result", () => {
    const bad = previewRtl(REGS, "R3 <- R1 * R2");
    expect("error" in bad).toBe(true);
    expect(parseRtl("nope")).toHaveProperty("error");
  });

  it("encodes R3 ← R1 + R2 and keeps ADD off for a move", () => {
    const add = controlWord(REGS, "R3 <- R1 + R2");
    expect("error" in add).toBe(false);
    if ("error" in add) return;
    expect(add.grouped).toBe("001 010 011 000 0 1");
    expect(add.signals.find((signal) => signal.label === "ALU_ADD")?.on).toBe(true);
    expect(add.signals.find((signal) => signal.label === "MEM_READ")?.on).toBe(false);
    expect(add.signals.find((signal) => signal.label === "MEM_WRITE")?.on).toBe(false);
    expect(add.after).toBe(8);
    const move = controlWord(REGS, "R4 <- R6");
    if ("error" in move) throw new Error(move.error);
    expect(move.aluName).toBe("PASS");
    expect(move.signals.find((signal) => signal.label === "ALU_ADD")?.on).toBe(false);
    expect(move.signals.find((signal) => signal.label === "ALU_PASS")?.on).toBe(true);
    expect(stagesFor("MOVE")).toEqual(["read-a", "drive", "write", "done"]);
    expect(stagesFor("ADD")).toContain("read-b");
  });

  it("drives one register, rejects two drivers, and writes only the load-enabled destination", () => {
    const one = busValue([{ name: "R1", enabled: true, value: 12 }, { name: "R2", enabled: false, value: 25 }]);
    expect(one.value).toBe(12);
    const clash = busValue([{ name: "R1", enabled: true, value: 12 }, { name: "R2", enabled: true, value: 25 }]);
    expect(clash.contention).toBe(true);
    expect(clash.value).toBe("X");
    const regs = [0, 12, 25, 0, 0, 0, 0, 0];
    const written = applyBusWrite(regs, 4, one);
    expect(written.regs[4]).toBe(12);
    expect(written.regs[1]).toBe(12);
    expect(applyBusWrite(regs, 4, clash).regs).toEqual(regs);
    expect(applyBusWrite(regs, null, one).regs).toEqual(regs);
  });
});
