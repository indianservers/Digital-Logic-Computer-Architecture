import { describe, expect, it } from "vitest";
import { loadProgram, signalsFor, stepStage } from "../../engines/isa/cpu";
describe("connected CPU datapath", () => {
  it("performs actual ALU writeback and a memory store through distinct control stages", () => {
    let cpu = loadProgram("ADDI R1, R0, 3\nADDI R2, R0, 4\nADD R3, R1, R2\nSTORE R3, 16(R0)\nHALT");
    if ("error" in cpu) throw new Error(cpu.error);
    let storeSeen = false;
    for (let i = 0; i < 100 && !cpu.halted; i++) {
      if (cpu.stage === "MEM" && cpu.decoded?.mnemonic === "STORE") {
        storeSeen = true; expect(cpu.dmem[16]).toBe(0);
        const signals = signalsFor(cpu.decoded, cpu.stage);
        expect(signals.memWrite).toBe(1); expect(signals.regWrite).toBe(0);
      }
      cpu = stepStage(cpu);
    }
    expect(storeSeen).toBe(true); expect(cpu.halted).toBe(true);
    expect(cpu.regs[3]).toBe(7); expect(cpu.dmem[16]).toBe(7); expect(cpu.dmem[17]).toBe(0);
  });
  it("loads real initialized memory and branches over the skipped instruction", () => {
    for (const [source, expected] of [
      ["LOAD R1, 8(R0)\nADD R2, R1, R1\nSTORE R2, 16(R0)\nHALT", 12],
      ["ADDI R1, R0, 1\nBEQ R1, R1, 2\nADDI R2, R0, 31\nADDI R2, R0, 7\nSTORE R2, 16(R0)\nHALT", 7],
    ] as const) {
      let cpu = loadProgram(source, { 8: 6 }); if ("error" in cpu) throw new Error(cpu.error);
      for (let i = 0; i < 100 && !cpu.halted; i++) cpu = stepStage(cpu);
      expect(cpu.dmem[16]).toBe(expected); expect(cpu.regs[0]).toBe(0);
    }
  });
});
