import { describe, expect, it } from "vitest";
import { mac, macRepeat, matMul, matMulScalarSteps, quantizeTensor, systolicCells, bytesPerValue } from "./accel/accelerator";
import { CONCEPTS_113_200 } from "../data/architecture";
import { autoRoute, offload, schedule, syncTimeline, WORKLOADS } from "./hetero/hetero";
import { clientAccess, createSystemCache, nextPower, shortestPath, contention } from "./soc/soc";
import { assemble8, load8, run8, formatReg, microStep } from "./cpu8/cpu8";
import { compareWidths, load16, popReg, pushReg, requestIrq, serviceInterrupt, step16 } from "./cpu16/cpu16";
import { architecturalRun } from "./isa/cpu";

describe("AI accelerator", () => {
  it("accumulates a × b + acc and repeats", () => {
    expect(mac(3, 4, 5)).toBe(17);
    expect(macRepeat(3, 4, 5, 2).acc).toBe(29);
  });

  it("multiplies the teaching 2×2 and matches systolic drain", () => {
    const a = [[1, 2], [3, 4]];
    const b = [[5, 6], [7, 8]];
    expect(matMul(a, b)).toEqual([[19, 22], [43, 50]]);
    expect(matMulScalarSteps(a, b).result).toEqual([[19, 22], [43, 50]]);
    expect(systolicCells(a, b, 8).result).toEqual([[19, 22], [43, 50]]);
    expect(systolicCells(a, b, 8).complete).toBe(true);
  });

  it("quantizes INT8 and reports educational FP16/BF16 footprints", () => {
    const values = [0.15, -0.72, 1.24, 3.81];
    const int8 = quantizeTensor(values, "int8");
    expect(int8.bytes).toBe(4);
    expect(int8.stored.every((item) => item >= -128 && item <= 127)).toBe(true);
    expect(int8.maxError).toBeGreaterThan(0);
    expect(quantizeTensor(values, "fp32").bytes).toBe(16);
    expect(bytesPerValue("fp16")).toBe(2);
    expect(bytesPerValue("bf16")).toBe(2);
    const recovered = int8.recovered[3] ?? 0;
    expect(Math.abs(recovered - 3.81)).toBeLessThan(0.1);
  });
});

describe("heterogeneous computing", () => {
  it("routes neural inference to the NPU and resets queues", () => {
    const routed = autoRoute("infer");
    expect(routed.unit).toBe("NPU");
    expect(routed.reason).toMatch(/tensor/i);
    const busy = schedule(WORKLOADS.map((item) => ({ id: item.id, unit: item.recommended })));
    expect(busy.find((item) => item.unit === "NPU")?.jobs.length).toBeGreaterThan(0);
    const idle = schedule([]);
    expect(idle.every((item) => item.jobs.length === 0 && item.time === 0)).toBe(true);
  });

  it("shows transfer dominating tiny offloads and completes a fence timeline", () => {
    const tiny = offload(20, 2);
    expect(tiny.transferDominates).toBe(true);
    expect(offload(2, 40).transferDominates).toBe(false);
    expect(syncTimeline().map((item) => item.phase)).toEqual(["run", "complete", "fence", "next"]);
  });
});

describe("SoC", () => {
  it("routes a packet, contends on overlap, hits then misses cache, and cycles power", () => {
    const path = shortestPath({ r: 0, c: 0 }, { r: 2, c: 2 });
    expect(path[0]).toEqual({ r: 0, c: 0 });
    expect(path[path.length - 1]).toEqual({ r: 2, c: 2 });
    const other = shortestPath({ r: 0, c: 0 }, { r: 2, c: 0 });
    expect(contention([path, other]).contested).toBe(true);
    let cache = createSystemCache();
    const first = clientAccess(cache, "CPU", 0);
    expect(first.last).toBe("miss");
    const second = clientAccess(first.cache, "GPU", 0);
    expect(second.last).toBe("hit");
    expect(nextPower("Active")).toBe("Idle");
    expect(nextPower("Power Gated")).toBe("Active");
  });
});

describe("8-bit teaching CPU", () => {
  const ADD = `
LDI A, 5
LDI B, 3
ADD A, B
STORE A, 20
HLT
`;

  it("assembles, steps, and computes 5 + 3 = 8", () => {
    const built = assemble8(ADD);
    expect(built.ok).toBe(true);
    const loaded = load8(ADD);
    expect("ok" in loaded).toBe(false);
    const halted = run8(ADD);
    expect(halted.halted).toBe(true);
    expect(halted.a).toBe(8);
    expect(halted.ram[20]).toBe(8);
    expect(formatReg(halted.a).binary).toBe("00001000");
  });

  it("reports assembler and runtime errors without throwing", () => {
    const bad = assemble8("FOO A, 1");
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors[0]?.message).toBe("Invalid instruction.");
    expect(assemble8("LDI A, 300").ok).toBe(false);
    expect(assemble8("LDI C, 1").ok).toBe(false);
    const state = load8("HLT");
    if ("ok" in state) throw new Error(state.error);
    const next = microStep(state);
    expect(next.stage).toBe("IR←MEM");
  });

  it("takes JZ when zero is set", () => {
    const program = `
LDI A, 1
LDI B, 1
SUB A, B
JZ SKIP
LDI A, 9
SKIP:
HLT
`;
    expect(run8(program).a).toBe(0);
  });
});

describe("16-bit teaching CPU", () => {
  it("reuses LogicLab-16 for CALL/RET and register-file ALU", () => {
    const state = architecturalRun(`
      ADDI R7, R0, 20
      ADDI R1, R0, 5
      CALL SUB
      HALT
    SUB:
      ADDI R2, R1, 3
      RET
    `);
    expect(state.halted).toBe(true);
    expect(state.regs[2]).toBe(8);
    expect(state.regs[7]).toBe(20);
  });

  it("pushes, pops, and runs an educational interrupt", () => {
    const loaded = load16(`
      ADDI R7, R0, 20
      ADDI R1, R0, 4
      ADDI R2, R0, 0
      HALT
      ADDI R3, R0, 1
      RET
    `);
    if ("error" in loaded) throw new Error(loaded.error);
    const ready = { ...loaded.cpu, regs: loaded.cpu.regs.slice() };
    ready.regs[7] = 20;
    ready.regs[1] = 4;
    const pushed = pushReg(ready, 1);
    if ("error" in pushed) throw new Error(pushed.error);
    expect(pushed.regs[7]).toBe(19);
    const popped = popReg(pushed, 4);
    if ("error" in popped) throw new Error(popped.error);
    expect(popped.regs[4]).toBe(4);
    let lab = { ...loaded, handler: 4 };
    lab = step16(lab);
    lab = requestIrq(lab);
    lab = serviceInterrupt(lab);
    expect(lab.inHandler).toBe(true);
    expect(lab.cpu.pc).toBe(4);
  });

  it("maps concepts 113–200 onto interactive labs", () => {
    expect(CONCEPTS_113_200).toHaveLength(88);
    expect(CONCEPTS_113_200.every((item) => item.interactive && item.route.startsWith("/architecture/"))).toBe(true);
    expect(compareWidths().length).toBeGreaterThan(5);
  });
});
