import { describe, expect, it } from "vitest";
import { ARCH_STUDIOS, CONCEPTS_113_200, CONCEPTS_201_328, CONCEPTS_329_392 } from "../data/architecture";
import { MASTER_CONCEPTS, auditCurriculum } from "../data/master";
import { STUDIOS } from "../data/curriculum";
import { addNode, connect, defaultIsa, emptyDesign, type CpuDesign } from "./builder/model";
import { assemble, validateIsa } from "./builder/isa";
import { loadProgram, parseDesignJson, resetCpu, stepInstruction } from "./builder/sim";
import { combinationalLoops, validateDesign } from "./builder/validate";
import { CPU_TEMPLATES, SANDBOX_TEMPLATES } from "./builder/templates";

function run(source: string, steps: number, base?: CpuDesign): CpuDesign {
  let design = base ?? CPU_TEMPLATES.find((item) => item.id === "loadstore")?.build() ?? emptyDesign();
  design = { ...design, program: source };
  design = resetCpu(loadProgram(design).design);
  for (let i = 0; i < steps; i += 1) design = stepInstruction(design, i + 1).design;
  return design;
}

describe("Build Your Own CPU", () => {
  it("assembles LOADI/ADD/STORE and writes 12 to R3 and memory 20", () => {
    const program = "LOADI R1, 5\nLOADI R2, 7\nADD R3, R1, R2\nSTORE R3, 20\nHALT\n";
    const assembled = assemble(defaultIsa(16, 8), program);
    expect(assembled.ok).toBe(true);
    const design = run(program, 5);
    const rf = design.nodes.find((node) => node.kind === "regfile");
    const dmem = design.nodes.find((node) => node.kind === "dmem");
    expect(rf?.values[1]).toBe(5);
    expect(rf?.values[2]).toBe(7);
    expect(rf?.values[3]).toBe(12);
    expect(dmem?.mem[20]).toBe(12);
    const halt = stepInstruction(design, 6);
    expect(halt.trace.halt).toBe(true);
    expect(halt.trace.mnemonic).toBe("HALT");
  });

  it("rejects width mismatch and duplicate opcodes", () => {
    let design = emptyDesign();
    design = addNode(design, "const", 0, 0, 8);
    design = addNode(design, "gpr", 80, 0, 16);
    const [a, b] = design.nodes;
    const linked = connect(design, a!.id, "y", b!.id, "d");
    expect(linked.error).toMatch(/Width mismatch/);
    const isa = defaultIsa(16, 8);
    isa.instructions = [...isa.instructions, { ...isa.instructions[2]!, mnemonic: "PLUS", opcode: 2 }];
    const issues = validateIsa(isa);
    expect(issues.some((item) => item.message.includes("Opcode conflict"))).toBe(true);
  });

  it("detects combinational loops and assembler immediate overflow", () => {
    let design = emptyDesign();
    design = addNode(design, "alu", 0, 0, 16);
    design = addNode(design, "mux", 120, 0, 16);
    const [alu, mux] = design.nodes;
    design = connect(design, alu!.id, "y", mux!.id, "i0").design;
    design = connect(design, mux!.id, "y", alu!.id, "a").design;
    expect(combinationalLoops(design)[0]?.length).toBeGreaterThan(1);
    const bad = assemble(defaultIsa(16, 8), "LOADI R1, 4000");
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors[0]?.message).toMatch(/does not fit/);
  });

  it("runs the accumulator template 5+7=12", () => {
    const acc = CPU_TEMPLATES.find((item) => item.id === "acc")?.build();
    expect(acc).toBeTruthy();
    const design = run("LOADI 5\nADD 7\nSTORE 20\nHALT\n", 4, acc);
    const node = design.nodes.find((item) => item.kind === "acc");
    const dmem = design.nodes.find((item) => item.kind === "dmem");
    expect(node?.value).toBe(12);
    expect(dmem?.mem[20]).toBe(12);
  });

  it("rejects malformed project JSON", () => {
    expect(parseDesignJson("{not json").ok).toBe(false);
    expect(parseDesignJson("{\"kind\":\"nope\"}").ok).toBe(false);
    const exported = parseDesignJson(JSON.stringify({ version: 1, kind: "logiclab-cpu", design: emptyDesign() }));
    expect(exported.ok).toBe(true);
  });
});

describe("Architecture sandbox templates", () => {
  it("builds every sandbox template with nodes", () => {
    for (const template of SANDBOX_TEMPLATES) {
      const design = template.build();
      expect(design.nodes.length).toBeGreaterThan(1);
    }
    expect(SANDBOX_TEMPLATES).toHaveLength(8);
    expect(CPU_TEMPLATES).toHaveLength(6);
  });
});

describe("Master curriculum 1-392", () => {
  it("maps every master number with valid studio routes", () => {
    const report = auditCurriculum();
    expect(MASTER_CONCEPTS).toHaveLength(392);
    expect(report.missingNumbers).toEqual([]);
    expect(report.duplicateMasters).toEqual([]);
    expect(report.duplicateIds).toEqual([]);
    expect(report.invalidRoute).toEqual([]);
    expect(report.placeholder).toEqual([]);
    expect(report.unimplementedInteractive).toEqual([]);
    expect(report.advancedCount).toBeGreaterThanOrEqual(140);
    expect(CONCEPTS_113_200).toHaveLength(88);
    expect(CONCEPTS_201_328).toHaveLength(128);
    expect(CONCEPTS_329_392).toHaveLength(64);
    expect(MASTER_CONCEPTS[0]?.masterNumber).toBe(1);
    expect(MASTER_CONCEPTS[391]?.masterNumber).toBe(392);
  });

  it("registers builder and sandbox labs without duplicate paths", () => {
    const paths = ARCH_STUDIOS.flatMap((studio) => studio.labs.map((lab) => `${studio.path}/${lab.id}`));
    expect(new Set(paths).size).toBe(paths.length);
    expect(STUDIOS.find((item) => item.id === "builder")?.active).toBe(true);
    expect(STUDIOS.find((item) => item.id === "sandbox")?.active).toBe(true);
    expect(validateDesign(CPU_TEMPLATES[2]!.build()).some((item) => item.level === "error" && item.message.includes("Missing clock"))).toBe(false);
  });
});
