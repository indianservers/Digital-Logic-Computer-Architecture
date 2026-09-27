import { describe, expect, it } from "vitest";
import { loadProgram } from "./cpu";
import { operate } from "./spec";
import { SAMPLE_ADD, SAMPLE_LOOP, runUntil, stepFetch, stepInstruction, stepOver, wordHex } from "./assemblyRun";

function boot(source: string) {
  const loaded = loadProgram(source);
  if ("error" in loaded) throw new Error(loaded.error);
  return loaded;
}

describe("assembly execution", () => {
  it("runs the sample add and store", () => {
    const ran = runUntil(boot(SAMPLE_ADD), []);
    expect(ran.state.regs[1]).toBe(5);
    expect(ran.state.regs[2]).toBe(3);
    expect(ran.state.regs[3]).toBe(8);
    expect(ran.state.dmem[8]).toBe(8);
    expect(ran.state.halted).toBe(true);
    expect(ran.rows.map((row) => row.text)).toEqual([
      "ADDI R1, R0, 5",
      "ADDI R2, R0, 3",
      "ADD R3, R1, R2",
      "STORE R3, 8(R0)",
      "HALT",
    ]);
    expect(ran.rows[2]?.regs.join(" ")).toContain("R3: 0 → 8");
    expect(ran.rows[3]?.mem.join(" ")).toContain("M[8]: 0 → 8");
    expect(ran.pausedAt).toBeNull();
  });

  it("fetches one word and advances the PC by one word", () => {
    const first = stepFetch(boot(SAMPLE_ADD));
    expect(first.state.stage).toBe("ID");
    expect(first.state.instPc).toBe(0);
    expect(first.state.pc).toBe(1);
    expect(wordHex(first.state.ir)).toMatch(/^0x[0-9A-F]{4}$/);
    const second = stepFetch(first.state);
    expect(second.row?.text).toBe("ADDI R1, R0, 5");
    expect(second.state.regs[1]).toBe(5);
    expect(second.state.instPc).toBe(1);
    expect(second.state.stage).toBe("ID");
  });

  it("pauses before a breakpointed store", () => {
    const ran = runUntil(boot(SAMPLE_ADD), [3]);
    expect(ran.pausedAt).toBe(3);
    expect(ran.state.regs[3]).toBe(8);
    expect(ran.state.dmem[8]).toBe(0);
    expect(ran.rows).toHaveLength(3);
  });

  it("sums the loop into R2 and memory", () => {
    const ran = runUntil(boot(SAMPLE_LOOP), []);
    expect(ran.state.regs[1]).toBe(0);
    expect(ran.state.regs[2]).toBe(15);
    expect(ran.state.dmem[8]).toBe(15);
    expect(ran.rows.some((row) => row.regs.some((change) => change.startsWith("PC:")))).toBe(true);
  });

  it("steps over CALL until the return address", () => {
    const source = "ADDI R1, R0, 1\nCALL SUB\nADDI R3, R0, 9\nHALT\nSUB:\nADDI R2, R0, 7\nRET\n";
    const first = stepInstruction(boot(source), 1);
    const over = stepOver(first.state, 2);
    expect(over.rows.map((row) => row.text)).toEqual(["CALL 3", "ADDI R2, R0, 7", "RET"]);
    expect(over.state.regs[2]).toBe(7);
    expect(over.state.regs[3]).toBe(0);
    expect(over.state.pc).toBe(2);
  });

  it("derives N, Z, C, and V from the 16-bit ALU", () => {
    const wrap = operate("ADD", 0xffff, 1);
    expect(wrap.result).toBe(0);
    expect(wrap.z).toBe(1);
    expect(wrap.c).toBe(1);
    const overflow = operate("ADD", 0x7fff, 1);
    expect(overflow.result).toBe(0x8000);
    expect(overflow.n).toBe(1);
    expect(overflow.v).toBe(1);
    const zero = operate("SUB", 5, 5);
    expect(zero.result).toBe(0);
    expect(zero.z).toBe(1);
    const negative = operate("SUB", 3, 5);
    expect(negative.n).toBe(1);
    expect(operate("AND", 0b1100, 0b1010).result).toBe(0b1000);
    expect(operate("OR", 0b1100, 0b1010).result).toBe(0b1110);
    expect(operate("XOR", 0b1100, 0b1010).result).toBe(0b0110);
  });
});
