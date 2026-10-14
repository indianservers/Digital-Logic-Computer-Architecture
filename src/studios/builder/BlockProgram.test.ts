import { describe, expect, it } from "vitest";
import { compileBlocks } from "./BlockProgram";
import { CPU_TEMPLATES } from "../../engines/builder/templates";
import { loadProgram, stepInstruction } from "../../engines/builder/sim";
describe("block programs", () => {
  it("compiles blocks and executes register arithmetic and memory writes", () => {
    const program = compileBlocks([
      { id: 1, mnemonic: "LOADI", args: ["R1", "5"], repeat: 1 },
      { id: 2, mnemonic: "LOADI", args: ["R2", "7"], repeat: 1 },
      { id: 3, mnemonic: "ADD", args: ["R3", "R1", "R2"], repeat: 1 },
      { id: 4, mnemonic: "STORE", args: ["R3", "20"], repeat: 1 },
      { id: 5, mnemonic: "HALT", args: [], repeat: 1 },
    ]);
    const template = CPU_TEMPLATES[2]!;
    const loaded = loadProgram({ ...template.build(), program });
    expect(loaded.error).toBeNull();
    let design = loaded.design;
    for (let cycle = 1; cycle <= 5; cycle++) design = stepInstruction(design, cycle).design;
    expect(design.nodes.find(n => n.kind === "regfile")?.values[3]).toBe(12);
    expect(design.nodes.find(n => n.kind === "dmem")?.mem[20]).toBe(12);
  });
  it("expands repeat blocks in program order and bounds their size", () => {
    expect(compileBlocks([{ id: 1, mnemonic: "ADD", args: ["R1", "R1", "R2"], repeat: 2 }])).toBe("ADD R1, R1, R2\nADD R1, R1, R2\n");
    expect(compileBlocks([{ id: 1, mnemonic: "HALT", args: [], repeat: 100 }]).trim().split("\n")).toHaveLength(64);
  });
});
