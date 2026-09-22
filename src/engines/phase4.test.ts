import { describe, expect, it } from "vitest";
import { assemble } from "./isa/assembler";
import { architecturalRun, signalsFor, stepStage } from "./isa/cpu";
import { runPipe, speedup, updatePredictor } from "./isa/pipeline";
import { evalRtl, hardwired, parseRtl, stepMicro } from "./isa/rtl";
import { binaryWord, decode, encodeI, encodeR, fieldsOf, OP } from "./isa/spec";

const SAMPLE = `
ADDI R1, R0, 5
ADDI R2, R0, 3
ADD R3, R1, R2
STORE R3, 8(R0)
LOAD R4, 8(R0)
BEQ R4, R3, OK
ADDI R5, R0, 1
OK:
HALT
`;

describe("educational ISA", () => {
  it("round-trips register and immediate encodings", () => {
    const add = encodeR("ADD", 3, 1, 2);
    const decoded = decode(add);
    expect(decoded.mnemonic).toBe("ADD");
    expect(decoded.rd).toBe(3);
    expect(decoded.rs1).toBe(1);
    expect(decoded.rs2).toBe(2);
    expect(decode(encodeI(OP.ADDI, 1, 0, 5)).imm).toBe(5);
    expect(decode(encodeI(OP.ADDI, 1, 0, -2)).imm).toBe(-2);
    expect(fieldsOf(decoded).map((field) => field.name)).toEqual(["opcode", "rd", "rs1", "rs2", "funct"]);
    expect(binaryWord(add)).toHaveLength(16);
  });

  it("rejects an unknown opcode as NOP and keeps defined opcodes", () => {
    expect(decode(0).mnemonic).toBe("NOP");
    expect(decode(0xf000).mnemonic).toBe("NOP");
  });
});

describe("assembler", () => {
  it("assembles labels, comments, and hex immediates", () => {
    const built = assemble("LOOP:\n  ADDI R1, R0, 0x10 ; comment\n  BEQ R1, R0, LOOP\n  J LOOP\n");
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.labels.LOOP).toBe(0);
    expect(decode(built.words[0] ?? 0).imm).toBe(16);
    expect(decode(built.words[1] ?? 0).imm).toBe(-1);
  });

  it("reports unknown mnemonics, bad registers, ranges, and label errors", () => {
    expect(assemble("FOO R1, R2, R3").ok).toBe(false);
    expect(assemble("ADD R8, R0, R1").ok).toBe(false);
    expect(assemble("ADDI R1, R0, 99").ok).toBe(false);
    expect(assemble("L: ADD R1, R0, R0\nL: NOP").ok).toBe(false);
    expect(assemble("BEQ R0, R0, MISSING").ok).toBe(false);
  });
});

describe("cpu execution", () => {
  it("runs arithmetic, logic, shifts, load, store, branches, and halt", () => {
    const state = architecturalRun(`
      ADDI R1, R0, 5
      ADDI R2, R0, 3
      ADD R3, R1, R2
      SUB R6, R3, R2
      AND R7, R3, R1
      OR R7, R7, R2
      ADDI R2, R0, 1
      SLL R6, R2, R2
      STORE R3, 8(R0)
      LOAD R4, 8(R0)
      BEQ R4, R3, TAKEN
      ADDI R5, R0, 9
    TAKEN:
      BNE R0, R4, SKIP
      ADDI R5, R0, 4
    SKIP:
      J END
      ADDI R5, R0, 7
    END:
      HALT
    `);
    expect(state.regs[3]).toBe(8);
    expect(state.regs[4]).toBe(8);
    expect(state.regs[5]).toBe(0);
    expect(state.dmem[8]).toBe(8);
    expect(state.halted).toBe(true);
    expect(state.regs[6]).toBe(2);
  });

  it("takes five cycles per instruction in the multi-cycle model", () => {
    let state = architecturalRun("ADDI R1, R0, 1\nHALT");
    expect(state.retired).toBe(2);
    expect(state.cycles).toBe(10);
    const loaded = architecturalRun("LOAD R1, 4(R0)\nHALT", { 4: 9 });
    expect(loaded.regs[1]).toBe(9);
    const signals = signalsFor(loaded.decoded, "WB");
    expect(signals.regWrite).toBe(0);
    void stepStage;
  });
});

describe("control", () => {
  it("raises memory read for LOAD and keeps register write off for STORE", () => {
    expect(hardwired("LOAD")).toMatchObject({ MemRead: "1", RegWrite: "1", MemWrite: "0" });
    expect(hardwired("STORE")).toMatchObject({ MemWrite: "1", RegWrite: "0", MemRead: "0" });
    expect(hardwired("ADD").ALUOp).toBe("ADD");
    expect(stepMicro(3, OP.LOAD)).toBe(6);
    expect(stepMicro(3, OP.ALU)).toBe(4);
  });
});

describe("rtl", () => {
  it("moves and adds registers", () => {
    const parsed = parseRtl("R3 <- R1 + R2");
    expect("error" in parsed).toBe(false);
    const step = evalRtl([0, 5, 3, 0, 0, 0, 0, 0], "R3 <- R1 + R2");
    expect(step.regs[3]).toBe(8);
    const bad = parseRtl("nope");
    expect("error" in bad ? bad.error : "").toBeTruthy();
  });
});

describe("pipeline", () => {
  it("matches the multi-cycle architectural result", () => {
    const scalar = architecturalRun(SAMPLE);
    const piped = runPipe(SAMPLE, { forwarding: true, policy: "not-taken" });
    expect(piped.regs.slice(0, 6)).toEqual(scalar.regs.slice(0, 6));
    expect(piped.dmem[8]).toBe(scalar.dmem[8]);
    expect(piped.halted).toBe(true);
  });

  it("forwards an ALU dependency and still stalls a load-use", () => {
    const raw = runPipe("ADDI R1, R0, 5\nADDI R2, R0, 3\nADD R3, R1, R2\nHALT", { forwarding: true });
    const stalled = runPipe("ADDI R1, R0, 5\nADDI R2, R0, 3\nADD R3, R1, R2\nHALT", { forwarding: false });
    expect(raw.regs[3]).toBe(8);
    expect(stalled.regs[3]).toBe(8);
    expect(stalled.stalls).toBeGreaterThan(raw.stalls);
    const load = runPipe("ADDI R2, R0, 4\nLOAD R1, 0(R2)\nADD R3, R1, R0\nHALT", { forwarding: true, data: { 4: 9 } });
    expect(load.regs[1]).toBe(9);
    expect(load.regs[3]).toBe(9);
    expect(load.stalls).toBeGreaterThan(0);
  });

  it("stalls a unified memory and flushes a mispredicted branch", () => {
    const split = runPipe("LOAD R1, 20(R0)\nHALT", { unified: false, data: { 20: 4 } });
    const unified = runPipe("LOAD R1, 20(R0)\nHALT", { unified: true, data: { 20: 4 } });
    expect(unified.stalls).toBeGreaterThan(split.stalls);
    const missed = runPipe("ADDI R1, R0, 1\nBEQ R1, R0, END\nADDI R2, R0, 5\nEND:\nHALT", { policy: "taken", forwarding: true });
    expect(missed.regs[2]).toBe(5);
    expect(missed.mispredicts).toBeGreaterThan(0);
    expect(speedup(10, 5)).toBe(2);
  });

  it("walks the 1-bit and 2-bit predictors", () => {
    expect(updatePredictor(0, true, "one-bit")).toBe(1);
    expect(updatePredictor(1, false, "one-bit")).toBe(0);
    expect(updatePredictor(0, true, "two-bit")).toBe(1);
    expect(updatePredictor(1, true, "two-bit")).toBe(2);
    expect(updatePredictor(3, false, "two-bit")).toBe(2);
  });
});
