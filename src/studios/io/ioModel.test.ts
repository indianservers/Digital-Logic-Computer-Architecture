import { describe, expect, it } from "vitest";
import {
  decodeAddress,
  dmaBurst,
  FIFO,
  nextBus,
  parseHex,
  pollState,
  type BusState,
} from "./ioModel";
describe("I/O lab hardware behavior", () => {
  it("decodes the memory map boundaries and rejects invalid bytes", () => {
    expect(decodeAddress(0x7fff)).toBe("RAM");
    expect(decodeAddress(0x8000)).toBe("GPIO");
    expect(decodeAddress(0x800f)).toBe("GPIO");
    expect(decodeAddress(0x8010)).toBe("Unmapped");
    expect(parseHex("0xA5", 255)).toBe(165);
    expect(parseHex("0x100", 255)).toBeNull();
    expect(parseHex("0x4G", 255)).toBeNull();
  });
  it("does not receive before readiness, and counts actual polling checks", () => {
    expect(pollState(10, 12, 2)).toMatchObject({
      received: false,
      reads: 5,
      wasted: 5,
    });
    expect(pollState(12, 12, 2)).toMatchObject({
      received: true,
      reads: 6,
      wasted: 5,
    });
    expect(pollState(12, 12, 8)).toMatchObject({
      received: false,
      reads: 1,
      receiveAt: 16,
    });
    expect(pollState(16, 12, 8)).toMatchObject({
      received: true,
      reads: 2,
      wasted: 1,
    });
  });
  it("copies partial final DMA bursts without writing past transfer length", () => {
    const original = Array<number>(16).fill(0);
    const first = dmaBurst(original, 0, 6, 4);
    expect(first.memory.slice(0, 4)).toEqual(FIFO.slice(0, 4));
    expect(first.cursor).toBe(4);
    expect(first.done).toBe(false);
    const last = dmaBurst(first.memory, 4, 6, 4);
    expect(last.cursor).toBe(6);
    expect(last.done).toBe(true);
    expect(last.memory.slice(0, 6)).toEqual(FIFO.slice(0, 6));
    expect(last.memory[6]).toBe(0);
    expect(original.every((v) => v === 0)).toBe(true);
  });
  it("holds an exclusive grant until READY, then serves the other master", () => {
    let bus: BusState = {
      owner: null,
      requests: { CPU: true, DMA: true },
      last: "DMA",
      elapsed: 0,
      completed: { CPU: 0, DMA: 0 },
      cycle: 0,
    };
    bus = nextBus(bus, "round", 2);
    expect(bus.owner).toBe("CPU");
    bus = nextBus(bus, "round", 2);
    bus = nextBus(bus, "round", 2);
    expect(bus.completed.CPU).toBe(0);
    expect(bus.owner).toBe("CPU");
    bus = nextBus(bus, "round", 2);
    expect(bus.completed.CPU).toBe(1);
    expect(bus.owner).toBe("DMA");
    for (let i = 0; i < 3; i++) bus = nextBus(bus, "round", 2);
    expect(bus.completed).toEqual({ CPU: 1, DMA: 1 });
    expect(bus.owner).toBeNull();
  });
  it("fixed priority grants CPU first even after its previous turn", () => {
    const bus: BusState = {
      owner: null,
      requests: { CPU: true, DMA: true },
      last: "CPU",
      elapsed: 0,
      completed: { CPU: 0, DMA: 0 },
      cycle: 0,
    };
    expect(nextBus(bus, "fixed", 0).owner).toBe("CPU");
    expect(nextBus(bus, "round", 0).owner).toBe("DMA");
  });
});
