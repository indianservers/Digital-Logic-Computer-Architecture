import { describe, expect, it } from "vitest";
import { SimulatorRegistry } from "./SimulatorCapture";
import { compareEvidence, evidenceValue, parseEvidence } from "./experimentEvidence";
import { emptyExperiment, experimentReport, parseExperiment } from "./experimentRecord";
describe("live simulator evidence", () => {
  it("preserves 64-bit register precision as decimal strings", () => {
    expect(evidenceValue({ rax: 0xffffffffffffffffn })).toEqual({ rax: "18446744073709551615" });
  });
  it("captures detached state, mutable registers, traces and versions without advancing the engine", () => {
    const registry = new SimulatorRegistry(), engine = { time: 0, registers: new Map([["PC", 3]]), memory: new Uint8Array([1, 2]), trace: [{ output: 7 }] };
    const remove = registry.register("cpu", { name: "CPU", version: "abc123", read: () => engine });
    const first = registry.capture("/cpu", null);
    engine.time = 1; engine.registers.set("PC", 4); engine.memory[0] = 8;
    const second = registry.capture("/cpu", null);
    expect(first.sources[0]?.state).toMatchObject({ time: 0, registers: { PC: 3 }, memory: [1, 2] });
    expect(second.sources[0]?.state).toMatchObject({ time: 1, registers: { PC: 4 }, memory: [8, 2] });
    expect(first.sources[0]?.version).toBe("abc123");
    expect(compareEvidence(first, second).map(d => d.field)).toContain("CPU[0].registers.PC");
    remove(); expect(registry.capture("/next", null).sources).toEqual([]);
  });
  it("bounds memory and circular references, and explicitly marks omitted ranges", () => {
    const object: Record<string, unknown> = { memory: Array.from({ length: 2000 }, (_, i) => i) }; object.self = object;
    const budget = { remaining: 18000, truncated: false }, value = evidenceValue(object, budget);
    expect(value).toMatchObject({ memory: { length: 2000, offset: 1488 }, self: "[shared reference]" });
    expect(budget.truncated).toBe(true);
  });
  it("excludes inactive retained lab panels without losing their state", () => {
    const registry = new SimulatorRegistry();
    let active = false;
    registry.register("retained", { name: "DRAM", version: "v1", read: () => ({ charge: 0.8 }), active: () => active });
    expect(registry.capture("/memory?tab=array", null).sources).toEqual([]);
    active = true;
    expect(registry.capture("/memory?tab=dram", null).sources[0]?.state).toEqual({ charge: 0.8 });
  });
  it("round-trips evidence alongside legacy notes and includes it in exported reports", () => {
    const registry = new SimulatorRegistry();
    registry.register("ram", { name: "RAM", version: "v1", read: () => ({ address: 2, value: 60 }) });
    const evidence = registry.capture("/memory?tab=array", null);
    const record = { ...emptyExperiment(), runs: [{ configuration: "auto", observation: "read", capturedAt: evidence.capturedAt, evidence }] };
    expect(parseExperiment(JSON.stringify(record))).toEqual(record);
    expect(experimentReport("RAM", "/memory", record, [], [])).toContain('"value": 60');
    expect(parseEvidence({ version: 1, sources: null })).toBeUndefined();
  });
});
