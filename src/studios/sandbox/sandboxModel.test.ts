import { describe, it, expect } from "vitest";
import {
  rippleCircuit,
  fullAdderCircuit,
  evaluateCircuit,
  connectCircuit,
  blankCpu,
  cpuStep,
  breakpointHit,
  DEBUG_PROGRAM,
  demoCpu,
  demoHistory,
  emptyCache,
  cacheRead,
  demoMesi,
  mesiAccess,
} from "./sandboxModel";
describe("Architecture sandbox simulation", () => {
  it("evaluates an editable five-gate full adder for all eight inputs", () => {
    const c = fullAdderCircuit();
    for (let a = 0; a < 2; a++)
      for (let b = 0; b < 2; b++)
        for (let cin = 0; cin < 2; cin++) {
          const v = evaluateCircuit(c, a, b, cin);
          expect(v.sum).toBe((a + b + cin) & 1);
          expect(v.carry).toBe((a + b + cin) >> 1);
        }
  });
  it("evaluates all 512 ripple adder combinations from connected wires", () => {
    const c = rippleCircuit();
    for (let a = 0; a < 16; a++)
      for (let b = 0; b < 16; b++)
        for (let cin = 0; cin < 2; cin++) {
          const v = evaluateCircuit(c, a, b, cin);
          expect(v.sum).toBe((a + b + cin) & 15);
          expect(v.carry).toBe((a + b + cin) >> 4);
        }
  });
  it("reports unknown after disconnecting an input, and rejects feedback", () => {
    const c = rippleCircuit();
    expect(
      evaluateCircuit(
        { ...c, wires: c.wires.filter((w) => w.id !== "A0") },
        5,
        3,
        0,
      ).sum,
    ).toBeNull();
    expect(connectCircuit(c, "FA3", "Cout", "FA0", "Cin").error).toContain(
      "loop",
    );
    expect(connectCircuit(c, "FA0", "S", "FA0", "A").error).toContain(
      "own input",
    );
  });
  it("executes assembly with overflow and memory writes", () => {
    const p = "LDI R1, 255\nLDI R2, 1\nADD R3, R1, R2\nSTORE R3, [0x20]\nHALT";
    let c = blankCpu();
    for (let i = 0; i < 5; i++) c = cpuStep(c, p);
    expect(c.registers[3]).toBe(0);
    expect(c.flags.c).toBe(1);
    expect(c.flags.z).toBe(1);
    expect(c.memory[32]).toBe(0);
    expect(c.halted).toBe(true);
  });
  it("hits a write watchpoint before committing the store", () => {
    const c = demoCpu(true);
    expect(c.pc).toBe(6);
    expect(c.memory[32]).toBeUndefined();
    expect(
      breakpointHit(c, DEBUG_PROGRAM, [
        {
          id: "write",
          signal: "Memory write",
          operator: "==",
          value: 32,
          enabled: true,
        },
      ]),
    ).toBeTruthy();
    expect(cpuStep(c, DEBUG_PROGRAM).memory[32]).toBe(8);
  });
  it("keeps independent history snapshots with the ADD at cycle six", () => {
    const h = demoHistory();
    expect(h[6]!.cycle).toBe(6);
    expect(h[6]!.cpu.registers[3]).toBe(8);
    expect(h[5]!.cpu.registers[3]).toBe(0);
    expect(h[0]!.cpu.registers[1]).toBe(0);
  });
  it("distinguishes compulsory, hit, and conflict accesses", () => {
    let r = cacheRead(emptyCache(), 36, 4);
    expect(r.hit).toBe(false);
    expect(r.data).toEqual([222, 173, 190, 239]);
    r = cacheRead(r.cache, 39, 4);
    expect(r.hit).toBe(true);
    expect(cacheRead(r.cache, 68, 4).kind).toBe("Conflict miss");
  });
  it("preserves a modified cache on a local read and writes it back on snoop", () => {
    let m = demoMesi();
    m = mesiAccess(m, 0, "read", 4096, 0);
    expect(m.cores[0]!.value).toBe(43);
    expect(m.memory[4096]).toBe(42);
    m = mesiAccess(m, 1, "read", 4096, 0);
    expect(m.memory[4096]).toBe(43);
    expect(m.cores.map((c) => c.state)).toEqual(["S", "S"]);
    m = mesiAccess(m, 1, "write", 4096, 99);
    expect(m.cores.map((c) => c.state)).toEqual(["I", "M"]);
    expect(m.cores[1]!.value).toBe(99);
  });
});
