import { describe, expect, it } from "vitest";
import { DIR_PRESETS, directoryAgrees, runDirectory, scalingSeries, validHolders } from "./directory";
import { SHARE_PRESETS, lineId, placeVars, repeatOps, runFalseShare, sameLine, shareReduction } from "./falseSharing";
import { analyzeBus, analyzeDirectory, analyzeLayout, filterTraffic } from "./traffic";

function preset<T extends { id: string }>(list: readonly T[], id: string): T {
  const found = list.find((item) => item.id === id);
  if (!found) throw new Error(id);
  return found;
}

describe("lab 19 directory coherence", () => {
  it("fills a cold line as Shared from memory", () => {
    const item = preset(DIR_PRESETS, "cold");
    const result = runDirectory(item.cores, item.requests, item.seed);
    const line = result.final.lines.find((entry) => entry.address === 0x1000);
    expect(line?.state).toBe("S");
    expect(line?.sharers).toEqual([0]);
    expect(line?.owner).toBeNull();
    expect(line?.copies[0]?.value).toBe(10);
    expect(line?.memory).toBe(10);
    expect(result.final.invalidations).toBe(0);
    result.shots.forEach((shot) => shot.lines.forEach((entry) => expect(directoryAgrees(entry)).toBe(true)));
  });

  it("adds a second reader and invalidates only current sharers on a write", () => {
    const item = preset(DIR_PRESETS, "writer");
    const result = runDirectory(item.cores, item.requests, item.seed);
    const shared = result.shots[2]?.lines.find((entry) => entry.address === 0x1000);
    expect(shared?.sharers.slice().sort()).toEqual([0, 2]);
    const line = result.final.lines.find((entry) => entry.address === 0x1000);
    expect(line?.state).toBe("M");
    expect(line?.owner).toBe(1);
    expect(line?.copies[1]?.state).toBe("M");
    expect(line?.copies[1]?.value).toBe(40);
    expect(line?.copies[0]?.state).toBe("I");
    expect(line?.copies[2]?.state).toBe("I");
    expect(line?.copies[3]?.state).toBe("I");
    expect(result.final.invalidations).toBe(2);
    expect(result.final.acks).toBe(2);
    const targets = result.final.step.filter((message) => message.kind === "Inv").map((message) => message.destination);
    expect(targets).toEqual(["Core 0", "Core 2"]);
    expect(result.final.avoided).toBeGreaterThan(0);
  });

  it("supplies the owner's value on a remote read and transfers ownership on a remote write", () => {
    const read = preset(DIR_PRESETS, "owner-read");
    const readResult = runDirectory(read.cores, read.requests, read.seed);
    const written = readResult.shots[1]?.lines.find((entry) => entry.address === 0x1000);
    expect(written?.copies[0]?.value).toBe(25);
    expect(written?.memory).toBe(10);
    const shared = readResult.final.lines.find((entry) => entry.address === 0x1000);
    expect(shared?.copies[3]?.value).toBe(25);
    expect(shared?.memory).toBe(25);
    expect(shared?.state).toBe("S");
    expect(validHolders(shared ?? { state: "U", owner: null, sharers: [] })).toEqual([0, 3]);
    const moved = preset(DIR_PRESETS, "owner-write");
    const movedResult = runDirectory(moved.cores, moved.requests, moved.seed);
    const line = movedResult.final.lines.find((entry) => entry.address === 0x1000);
    expect(line?.owner).toBe(0);
    expect(line?.copies[0]?.value).toBe(70);
    expect(line?.copies[2]?.state).toBe("I");
    expect(line?.memory).toBe(10);
    expect(movedResult.final.transfers).toBe(1);
    movedResult.shots.forEach((shot) => shot.lines.forEach((entry) => expect(directoryAgrees(entry)).toBe(true)));
  });

  it("does not broadcast invalidations to cores that never shared the line", () => {
    const item = preset(DIR_PRESETS, "few");
    const result = runDirectory(item.cores, item.requests, item.seed);
    expect(result.final.invalidations).toBe(3);
    const destinations = result.final.step.filter((message) => message.kind === "Inv").map((message) => message.destination);
    expect(destinations).not.toContain("Core 1");
    expect(destinations).not.toContain("Core 3");
    expect(scalingSeries(3).map((bar) => bar.directory)).toEqual([8, 8, 8, 8]);
    expect(scalingSeries(3)[3]?.snoop).toBe(15);
    const again = runDirectory(item.cores, item.requests, item.seed);
    expect(JSON.stringify(again.final.messages)).toBe(JSON.stringify(result.final.messages));
  });
});

describe("lab 20 false sharing", () => {
  it("maps offsets onto cache lines and keeps padded variables apart", () => {
    expect(sameLine(0, 8, 64)).toBe(true);
    expect(sameLine(0, 64, 64)).toBe(false);
    expect(lineId(0, 32)).not.toBe(lineId(40, 32));
    const placed = placeVars([{ name: "counter0", offset: 0, bytes: 4, core: 0, value: 0 }, { name: "counter1", offset: 8, bytes: 4, core: 1, value: 0 }], 64, true);
    expect(sameLine(placed[0]?.offset ?? 0, placed[1]?.offset ?? 0, 64)).toBe(false);
  });

  it("classifies same-line writes as false sharing and same-variable writes as true sharing", () => {
    const same = preset(SHARE_PRESETS, "same");
    const bounced = runFalseShare(same.variables, repeatOps(same.variables, 8), 64, false);
    expect(bounced.final.falseEvents).toBe(15);
    expect(bounced.final.trueEvents).toBe(0);
    expect(bounced.final.values.counter0).toBe(8);
    expect(bounced.final.values.counter1).toBe(8);
    expect(bounced.final.migrations).toBe(15);
    const apart = preset(SHARE_PRESETS, "apart");
    const quiet = runFalseShare(apart.variables, repeatOps(apart.variables, 8), 64, false);
    expect(quiet.final.invalidations).toBe(0);
    const truth = preset(SHARE_PRESETS, "true");
    const shared = runFalseShare(truth.variables, repeatOps(truth.variables, 8, "inc", truth.extra), 64, false);
    expect(shared.final.trueEvents).toBe(15);
    expect(shared.final.falseEvents).toBe(0);
    expect(shared.final.values.counter).toBe(16);
  });

  it("drops invalidations after padding and stays deterministic", () => {
    const same = preset(SHARE_PRESETS, "same");
    const compared = shareReduction(same.variables, 8, 64);
    expect(compared.plain.final.invalidations).toBeGreaterThan(0);
    expect(compared.padded.final.invalidations).toBe(0);
    expect(compared.reduction).toBe(100);
    expect(compared.padded.final.values.counter0).toBe(8);
    expect(compared.padded.final.values.counter1).toBe(8);
    const left = runFalseShare(same.variables, repeatOps(same.variables, 4), 64, false);
    const right = runFalseShare(same.variables, repeatOps(same.variables, 4), 64, false);
    expect(JSON.stringify(left.final.values)).toBe(JSON.stringify(right.final.values));
    expect(left.final.invalidations).toBe(right.final.invalidations);
  });
});

describe("lab 21 coherence traffic", () => {
  it("separates upgrades, writebacks, and clean evictions", () => {
    const upgrade = analyzeBus("mesi", 4, [
      { core: 0, op: "read", address: 0x1000 },
      { core: 1, op: "read", address: 0x1000 },
      { core: 0, op: "write", address: 0x1000, value: 40 },
    ]);
    expect(upgrade.upgrades).toBe(1);
    expect(upgrade.invalidations).toBe(1);
    expect(upgrade.rows.filter((item) => item.message === "BusUpgr" && item.dataBytes > 0)).toHaveLength(0);
    const producer = analyzeBus("mesi", 4, [
      { core: 0, op: "read", address: 0x1000 },
      { core: 0, op: "write", address: 0x1000, value: 25 },
      { core: 1, op: "read", address: 0x1000 },
    ], { 0x1000: 10 });
    expect(producer.writebacks).toBe(1);
    expect(producer.cacheToCache).toBe(1);
    expect(producer.rows.some((item) => item.cause.includes("0x19") || item.category === "data")).toBe(true);
    const clean = analyzeBus("mesi", 2, [{ core: 0, op: "read", address: 0x1000 }, { core: 0, op: "evict", address: 0x1000 }]);
    expect(clean.writebacks).toBe(0);
    const dirty = analyzeBus("mesi", 2, [{ core: 0, op: "read", address: 0x1000 }, { core: 0, op: "write", address: 0x1000, value: 25 }, { core: 0, op: "evict", address: 0x1000 }]);
    expect(dirty.writebacks).toBe(1);
    expect(dirty.totalBytes).toBe(dirty.controlBytes + dirty.dataBytes);
  });

  it("counts ownership movement and not a shared read", () => {
    const ping = analyzeBus("mesi", 4, [
      { core: 0, op: "write", address: 0x1000, value: 1 },
      { core: 1, op: "write", address: 0x1000, value: 2 },
      { core: 0, op: "write", address: 0x1000, value: 3 },
    ]);
    expect(ping.migrations).toBe(2);
    const shared = analyzeBus("mesi", 4, [{ core: 0, op: "read", address: 0x1000 }, { core: 1, op: "read", address: 0x1000 }]);
    expect(shared.migrations).toBe(0);
    const filtered = filterTraffic(ping.rows, { core: 1, category: "all" });
    expect(filtered.every((item) => item.core === 1)).toBe(true);
    expect(ping.hotspot?.address).toBe(0x1000);
    expect(ping.hotspot?.migrations).toBe(2);
    const again = analyzeBus("mesi", 4, [
      { core: 0, op: "write", address: 0x1000, value: 1 },
      { core: 1, op: "write", address: 0x1000, value: 2 },
      { core: 0, op: "write", address: 0x1000, value: 3 },
    ]);
    expect(JSON.stringify(again.rows)).toBe(JSON.stringify(ping.rows));
  });

  it("accounts for directory messages and false-sharing layout traffic", () => {
    const item = preset(DIR_PRESETS, "writer");
    const directory = analyzeDirectory(item.cores, item.requests, item.seed);
    expect(directory.invalidations).toBe(2);
    expect(directory.reads).toBe(2);
    expect(directory.writes).toBe(1);
    const same = preset(SHARE_PRESETS, "same");
    const layout = analyzeLayout(same.variables, repeatOps(same.variables, 4), 64, false);
    expect(layout.invalidations).toBe(7);
    expect(layout.migrations).toBe(7);
    const padded = analyzeLayout(same.variables, repeatOps(same.variables, 4), 64, true);
    expect(padded.invalidations).toBe(0);
  });
});
