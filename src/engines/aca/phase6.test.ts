import { describe, expect, it } from "vitest";
import { MSI_PRESETS, MOESI_PRESETS, compareProtocols, invariants, runCoherence } from "./coherenceLab";
import { PORT_PRESETS, compatiblePorts, runPorts } from "./ports";

function preset<T extends { id: string }>(list: readonly T[], id: string): T {
  const found = list.find((item) => item.id === id);
  if (!found) throw new Error(id);
  return found;
}

function lineOf(protocol: "msi" | "mesi" | "moesi", accesses: Parameters<typeof runCoherence>[2], seed?: Record<number, number>) {
  const result = runCoherence(protocol, 4, accesses, seed);
  result.shots.forEach((shot) => {
    shot.lines.forEach((line) => expect(invariants(line.copies, protocol)).toBe(true));
  });
  return result;
}

describe("lab 16 execution ports", () => {
  it("never assigns an operation to an incompatible port", () => {
    PORT_PRESETS.forEach((item) => {
      const result = runPorts(item.ops, { policy: item.policy });
      result.assignments.forEach((assignment) => {
        const op = item.ops[assignment.index];
        expect(op).toBeTruthy();
        expect(compatiblePorts(op?.kind ?? "int-alu").includes(assignment.port)).toBe(true);
        expect(assignment.compatible.includes(assignment.port)).toBe(true);
      });
    });
  });

  it("lets first-available occupy the multiply port and least-contended share it", () => {
    const contend = preset(PORT_PRESETS, "contend").ops;
    const first = runPorts(contend, { policy: "first", issueWidth: 2 });
    const least = runPorts(contend, { policy: "least", issueWidth: 2 });
    const firstCycle = first.shots[1];
    const leastCycle = least.shots[1];
    expect(firstCycle?.rows[0]?.port).toBe(1);
    expect(firstCycle?.rows[1]?.port).toBeNull();
    expect(leastCycle?.rows[0]?.port).toBe(0);
    expect(leastCycle?.rows[1]?.port).toBe(1);
    expect(least.ipc).toBeGreaterThan(first.ipc);
  });

  it("respects issue width, readiness, pipelining, and a blocking divide", () => {
    const alu = preset(PORT_PRESETS, "alu").ops;
    expect(runPorts(alu, { policy: "least", issueWidth: 1 }).shots[1]?.issued).toBe(1);
    const chain = preset(PORT_PRESETS, "dep").ops;
    expect(runPorts(chain).shots[1]?.rows[1]?.state).toBe("Waiting");
    const muls = preset(PORT_PRESETS, "mul").ops;
    const pipelined = runPorts(muls, { policy: "first" });
    expect(pipelined.assignments[0]?.port).toBe(1);
    expect(pipelined.assignments[1]?.port).toBe(1);
    expect(pipelined.shots[2]?.rows[1]?.state).toBe("Scheduled");
    const divided = runPorts(preset(PORT_PRESETS, "div").ops, { policy: "first", issueWidth: 2 });
    expect(divided.shots[2]?.rows[1]?.state).not.toBe("Scheduled");
    expect(divided.shots[1]?.rows[2]?.port).toBe(0);
    expect(divided.utilization).toBeGreaterThan(0);
    expect(JSON.stringify(pipelined.assignments)).toBe(JSON.stringify(runPorts(muls, { policy: "first" }).assignments));
  });
});

describe("lab 17 MSI and MESI", () => {
  it("fills MSI as shared and MESI as exclusive, then shares and upgrades", () => {
    const share = preset(MSI_PRESETS, "share");
    const msi = lineOf("msi", share.accesses);
    const mesi = lineOf("mesi", share.accesses);
    expect(msi.shots[1]?.lines[0]?.copies[0]?.state).toBe("S");
    expect(mesi.shots[1]?.lines[0]?.copies[0]?.state).toBe("E");
    expect(mesi.shots[2]?.lines[0]?.copies[0]?.state).toBe("S");
    expect(mesi.shots[2]?.lines[0]?.copies[1]?.state).toBe("S");
    const upgrade = preset(MSI_PRESETS, "upgrade");
    const stepped = lineOf("msi", upgrade.accesses);
    expect(stepped.final.upgrades).toBe(1);
    expect(stepped.final.invalidations).toBeGreaterThan(0);
    expect(stepped.final.lines[0]?.copies[0]?.state).toBe("M");
    expect(stepped.final.lines[0]?.copies[1]?.state).toBe("I");
  });

  it("writes back a modified line on a remote read and keeps the new value", () => {
    const producer = preset(MSI_PRESETS, "producer");
    const mesi = lineOf("mesi", producer.accesses, producer.seed);
    expect(mesi.shots[2]?.lines[0]?.copies[0]?.state).toBe("M");
    expect(mesi.final.lines[0]?.copies[0]?.state).toBe("S");
    expect(mesi.final.lines[0]?.copies[1]?.state).toBe("S");
    expect(mesi.final.lines[0]?.copies[1]?.value).toBe(25);
    expect(mesi.final.lines[0]?.memory).toBe(25);
    expect(mesi.final.writebacks).toBe(1);
    const silent = lineOf("mesi", preset(MSI_PRESETS, "private").accesses);
    expect(silent.final.silent).toBe(1);
    expect(silent.final.lines[0]?.copies[0]?.state).toBe("M");
    expect(silent.shots[2]?.log.at(-1)?.bus).toBe("Silent");
  });
});

describe("lab 18 MOESI", () => {
  it("turns Modified into Owned and leaves memory stale", () => {
    const owned = preset(MOESI_PRESETS, "owned");
    const result = lineOf("moesi", owned.accesses, owned.seed);
    const final = result.final.lines[0];
    expect(final?.copies[0]?.state).toBe("O");
    expect(final?.copies[1]?.state).toBe("S");
    expect(final?.copies[1]?.value).toBe(25);
    expect(final?.memory).toBe(10);
    expect(final?.stale).toBe(true);
    expect(result.final.cacheToCache).toBe(1);
    expect(result.final.writebacks).toBe(0);
    const again = lineOf("moesi", preset(MOESI_PRESETS, "sharers").accesses, preset(MOESI_PRESETS, "sharers").seed);
    expect(again.final.lines[0]?.copies[0]?.state).toBe("O");
    expect(again.final.lines[0]?.copies[2]?.state).toBe("S");
    expect(again.final.lines[0]?.memory).toBe(10);
  });

  it("invalidates the owner on a write and writes back when the owner is evicted", () => {
    const taken = lineOf("moesi", preset(MOESI_PRESETS, "take").accesses, preset(MOESI_PRESETS, "take").seed);
    expect(taken.final.lines[0]?.copies[2]?.state).toBe("M");
    expect(taken.final.lines[0]?.copies[0]?.state).toBe("I");
    expect(taken.final.lines[0]?.copies[1]?.state).toBe("I");
    expect(taken.final.lines[0]?.copies[2]?.value).toBe(70);
    const evicted = lineOf("moesi", preset(MOESI_PRESETS, "evict").accesses, preset(MOESI_PRESETS, "evict").seed);
    expect(evicted.final.lines[0]?.memory).toBe(25);
    expect(evicted.final.lines[0]?.copies[0]?.state).toBe("I");
    expect(evicted.final.writebacks).toBe(1);
    const compared = compareProtocols(4, preset(MOESI_PRESETS, "owned").accesses, preset(MOESI_PRESETS, "owned").seed);
    expect(compared.mesi.final.writebacks).toBeGreaterThan(compared.moesi.final.writebacks);
    expect(JSON.stringify(evicted.final.lines)).toBe(JSON.stringify(lineOf("moesi", preset(MOESI_PRESETS, "evict").accesses, preset(MOESI_PRESETS, "evict").seed).final.lines));
  });
});
