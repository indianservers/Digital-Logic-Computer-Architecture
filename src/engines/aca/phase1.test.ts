import { describe, expect, it } from "vitest";
import { HAZARD_EXAMPLE, findDeps, parsePipe, runPipeline, scheduleOps } from "./hazards";
import { parseScore, runScoreboard } from "./scoreboard";
import { parseTomasulo, runTomasulo, snapshotTomasulo } from "./tomasulo";

describe("lab 1 pipeline hazards", () => {
  const raw = [parsePipe("ADD x1, x2, x3"), parsePipe("SUB x4, x1, x5")];
  const war = [parsePipe("ADD x4, x1, x3"), parsePipe("SUB x1, x5, x6")];
  const waw = [parsePipe("ADD x1, x2, x3"), parsePipe("MUL x1, x4, x5")];
  const load = [parsePipe("LW x1, 0(x2)"), parsePipe("ADD x3, x1, x4")];

  it("classifies RAW, WAR, and WAW", () => {
    expect(findDeps(raw).some((edge) => edge.type === "RAW" && edge.reg === "x1")).toBe(true);
    expect(findDeps(war).some((edge) => edge.type === "WAR" && edge.reg === "x1")).toBe(true);
    expect(findDeps(waw).some((edge) => edge.type === "WAW" && edge.reg === "x1")).toBe(true);
    expect(findDeps([parsePipe("ADD x1, x2, x3"), parsePipe("SUB x4, x5, x6")])).toHaveLength(0);
  });

  it("forwards an ALU result and still stalls a load-use", () => {
    expect(runPipeline(raw, true).stalls).toBe(0);
    expect(runPipeline(raw, false).stalls).toBe(2);
    expect(runPipeline(load, true).stalls).toBe(1);
    expect(runPipeline(load, true).forwards.some((item) => item.path.includes("MEM/WB"))).toBe(true);
  });

  it("starts the default chain in IF on cycle 1 and finishes in 5 + N - 1 cycles", () => {
    const run = runPipeline(HAZARD_EXAMPLE, true);
    expect(run.stalls).toBe(0);
    expect(run.cycles).toBe(10);
    expect(run.cells[0]?.[0]).toBe("IF");
    expect(run.cells[5]?.[9]).toBe("WB");
  });

  it("schedules an independent instruction ahead of a stalled consumer", () => {
    const ops = [parsePipe("LW x1, 0(x2)"), parsePipe("ADD x3, x1, x4"), parsePipe("ADD x5, x6, x7")];
    const order = scheduleOps(ops);
    expect(order[1]).toBe(2);
    const scheduled = order.map((index) => ops[index]).filter((op) => op != null);
    expect(runPipeline(scheduled, true).stalls).toBeLessThan(runPipeline(ops, true).stalls);
  });
});

describe("lab 2 scoreboard", () => {
  it("blocks issue on a busy functional unit and on WAW", () => {
    const structural = runScoreboard([parseScore("MUL x1, x2, x3"), parseScore("MUL x4, x5, x6")]);
    expect(structural.some((shot) => shot.events.some((event) => event.hazard === "Structural"))).toBe(true);
    const waw = runScoreboard([parseScore("LD x1, 0(x2)"), parseScore("ADD x1, x3, x4")]);
    expect(waw.some((shot) => shot.events.some((event) => event.hazard === "WAW"))).toBe(true);
  });

  it("waits to read a RAW operand and to write through a WAR", () => {
    const raw = runScoreboard([parseScore("LD x1, 0(x2)"), parseScore("ADD x3, x1, x4")]);
    const add = raw.at(-1)?.rows[1];
    expect((add?.read ?? 0) > (raw.at(-1)?.rows[0]?.write ?? 99)).toBe(false);
    expect(raw.some((shot) => shot.events.some((event) => event.hazard === "RAW"))).toBe(true);
    const sub = parseScore("SUB x8, x5, x6");
    sub.latency = 1;
    const war = runScoreboard([
      parseScore("LD x1, 0(x2)"),
      parseScore("ADD x4, x1, x8"),
      sub,
    ]);
    expect(war.some((shot) => shot.events.some((event) => event.hazard === "WAR"))).toBe(true);
    const last = war.at(-1);
    expect(last?.rows.every((row) => row.state === "Completed")).toBe(true);
  });
});

describe("lab 3 tomasulo", () => {
  const chain = [
    parseTomasulo("LD F1, 0(R2)"),
    parseTomasulo("ADD.D F4, F1, F2"),
  ];

  it("tags a destination and keeps the source pending", () => {
    const mid = snapshotTomasulo(chain, 1);
    expect(mid.stations.find((station) => station.name === "Load1")?.busy).toBe(true);
    expect(mid.regs.find((reg) => reg.name === "F1")?.qi).toBe("Load1");
    const waiting = snapshotTomasulo(chain, 2);
    const add = waiting.stations.find((station) => station.name === "Add1");
    expect(add?.qj).toBe("Load1");
    expect(add?.vk).not.toBe("-");
  });

  it("wakes the station from the common data bus and preserves RAW", () => {
    const done = runTomasulo(chain);
    const addWrite = done.write[1] ?? 0;
    const loadWrite = done.write[0] ?? 0;
    expect(addWrite).toBeGreaterThan(loadWrite);
    expect(done.cdb.filter((event) => event.cycle === loadWrite)).toHaveLength(1);
  });

  it("renames a later write without changing the earlier reader", () => {
    const ops = [parseTomasulo("ADD.D F4, F2, F2"), parseTomasulo("MUL.D F6, F4, F2"), parseTomasulo("SUB.D F4, F2, F2")];
    const shot = snapshotTomasulo(ops, 3);
    expect(shot.regs.find((reg) => reg.name === "F4")?.qi).toBe("Add2");
    expect(shot.stations.find((station) => station.name === "Mul1")?.qj).toBe("Add1");
  });

  it("broadcasts only one result when several stations finish together", () => {
    const ops = [parseTomasulo("ADD.D F4, F2, F2"), parseTomasulo("ADD.D F6, F2, F2"), parseTomasulo("SUB.D F8, F2, F2")];
    const done = runTomasulo(ops);
    const counts = new Map<number, number>();
    done.cdb.forEach((event) => counts.set(event.cycle, (counts.get(event.cycle) ?? 0) + 1));
    expect([...counts.values()].every((count) => count === 1)).toBe(true);
    expect(done.cdb.length).toBe(3);
  });

  it("stalls issue when only one add station is available", () => {
    const ops = [parseTomasulo("ADD.D F4, F2, F2"), parseTomasulo("ADD.D F6, F2, F2")];
    const narrow = runTomasulo(ops, { F2: 8 }, { add: 1, mul: 2, div: 1, load: 2, store: 2 });
    const wide = runTomasulo(ops, { F2: 8 });
    expect(narrow.stalls).toBeGreaterThan(wide.stalls);
    expect(narrow.stations.filter((station) => station.kind === "add")).toHaveLength(1);
  });
});
