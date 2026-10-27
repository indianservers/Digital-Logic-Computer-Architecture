import { describe, expect, it } from "vitest";
import { emptyExperiment, experimentReport, experimentStorageKey, parseExperiment } from "./experimentRecord";

describe("experiment records", () => {
  it("recovers safely from missing, corrupt, or incompatible saved notes", () => {
    for (const raw of [null, "{", "null", "[]", '{"version":2}', '{"version":1,"runs":[null,7,{}],"reviewed":[3]}']) {
      expect(parseExperiment(raw)).toEqual(emptyExperiment());
    }
  });
  it("keeps the newest six valid comparison runs and sanitizes malformed fields", () => {
    const runs = Array.from({ length: 9 }, (_, index) => ({ configuration: `input ${index}`, observation: `output ${index}`, capturedAt: `time ${index}` }));
    const saved = parseExperiment(JSON.stringify({ version: 1, prediction: 42, configuration: "x".repeat(13000), runs: [null, {}, ...runs], reviewed: [null, "Read"] }));
    expect(saved.runs.map((run) => run.configuration)).toEqual(["input 3", "input 4", "input 5", "input 6", "input 7", "input 8"]);
    expect(saved.configuration).toHaveLength(12000);
    expect(saved.prediction).toBe("");
    expect(saved.reviewed).toEqual(["Read"]);
  });
  it("isolates notes by lab and exports the recorded evidence without claiming verification", () => {
    expect(experimentStorageKey("/studios/memory?tab=array")).not.toBe(experimentStorageKey("/studios/memory?tab=sram"));
    const record = { ...emptyExperiment(), prediction: "0x3C", observation: "Read returned 0x3C", reviewed: ["Write"], runs: [{ configuration: "Address 0x12", observation: "0x3C", capturedAt: "2026-10-28T00:00:00.000Z" }] };
    expect(parseExperiment(JSON.stringify(record))).toEqual(record);
    const report = experimentReport("RAM", "/studios/memory?tab=array", record, ["Write", "Read"], ["Read preserves data"], "What was stored?");
    expect(report).toContain("not an automated simulation certificate");
    expect(report).toContain("- [x] Write");
    expect(report).toContain("- [ ] Read");
    expect(report).toContain("Address 0x12");
    expect(report).toContain("Read returned 0x3C");
    expect(report).toContain("What was stored?");
  });
});
