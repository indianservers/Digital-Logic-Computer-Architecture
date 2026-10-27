import { describe, expect, it } from "vitest";
import { arbitratedTransfer, transferValue, type BusMaster } from "./busarch";

const masters: BusMaster[] = [{ name: "CPU", request: true, priority: 1 }, { name: "DMA", request: true, priority: 0 }, { name: "GPU", request: true, priority: 2 }];
describe("bus arbitration drives only the grant winner", () => {
  it("prevents contention even when all masters request access", () => {
    expect(transferValue(masters.map((master, index) => ({ name: master.name, enabled: true, value: index })))).toMatchObject({ value: "X", contention: true });
    expect(arbitratedTransfer("daisy", masters, -1).bus).toMatchObject({ source: "CPU", value: 0x11, contention: false });
    expect(arbitratedTransfer("central", masters, -1).bus).toMatchObject({ source: "DMA", value: 0x22, contention: false });
  });
  it("rotates completed distributed grants and floats when nobody requests", () => {
    let last = -1;
    const sequence = Array.from({ length: 4 }, () => {
      const result = arbitratedTransfer("distributed", masters, last);
      last = result.grant!.index;
      expect(result.bus.contention).toBe(false);
      return result.bus.source;
    });
    expect(sequence).toEqual(["CPU", "DMA", "GPU", "CPU"]);
    expect(arbitratedTransfer("central", masters.map((master) => ({ ...master, request: false })), 0)).toMatchObject({ grant: null, bus: { value: "Z", source: null, contention: false } });
  });
});
