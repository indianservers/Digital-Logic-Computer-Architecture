import { describe, expect, it } from "vitest";
import { polling, dma, watchdog } from "./acquisitionModels";
import { sleep, brownout, rtc } from "./powerModels";
import { fsm, cooperative, rtos, synchronization, inversion } from "./schedulerModels";
import { bootloader, crc32, debuggerModel, firmwareImage } from "./firmwareModels";
import { logicAnalyzer, oscilloscope, analogMeasurement, powerAnalyzer } from "./instrumentModels";
import { MODELS } from "./models";
import { sanitizeParams, type Model, type Params } from "./model";

function run(model: Model, ms: number, patch: Params = {}) {
  const p = sanitizeParams(model, { ...model.defaults, ...patch });
  return { p, s: model.step(model.create(p), p, ms) };
}
describe("remaining Microcontroller simulation models", () => {
  it("provides a bounded executable model for every system and instrument lab", () => {
    expect(MODELS.map((model) => model.number)).toEqual(Array.from({ length: 16 }, (_, i) => i + 39));
    for (const model of MODELS) {
      const { s, p } = run(model, model.number >= 52 && model.number <= 53 ? 10 : 100);
      expect(s.time, String(model.number)).toBeGreaterThanOrEqual(0);
      expect(Object.values(s.values).every(Number.isFinite), String(model.number)).toBe(true);
      expect(s.events.length).toBeLessThanOrEqual(100);
      expect(s.samples.length).toBeLessThanOrEqual(512);
      expect(model.metrics(s, p).length).toBeGreaterThanOrEqual(4);
      expect(model.checks(s, p).length).toBeGreaterThanOrEqual(3);
    }
  });
  it("39: misses short pulses by polling and retains only one masked pending edge", () => {
    const slow = run(polling, 100), fast = run(polling, 100, { poll: 1 });
    expect(slow.s.values).toMatchObject({ generated: 5, polled: 0, interrupts: 5, missed: 5 });
    expect(fast.s.values).toMatchObject({ polled: 5, missed: 0 });
    const masked = run(polling, 100, { masked: true });
    expect(masked.s.values).toMatchObject({ pending: 1, interrupts: 0, coalesced: 4 });
    expect(polling.step(masked.s, { ...masked.p, masked: false }, 1).values.interrupts).toBe(1);
  });
  it("40: transfers ordered samples, exposes MINC overwrite, and reloads circular NDTR", () => {
    expect(run(dma, 10).s.memory).toEqual(Array.from({ length: 8 }, (_, i) => (i * 37 + 11) & 255));
    expect(run(dma, 10, { increment: false }).s.memory.slice(1)).toEqual(new Array(7).fill(0));
    expect(run(dma, 20, { circular: true }).s.values).toMatchObject({ transferred: 20, complete: 2, NDTR: 4 });
    expect(run(dma, 20, { enabled: false }).s.values.transferred).toBe(0);
    expect(run(dma, 10, { mode: "CPU copy" }).s.values).toMatchObject({ cpuFree: 0, cpuCopy: 8 });
  });
  it("41: resets at the watchdog deadline and not at every display update", () => {
    const healthyThenHang = run(watchdog, 350).s;
    expect(healthyThenHang.values).toMatchObject({ feeds: 6, resets: 1, lastReset: 340, uptime: 10 });
    expect(run(watchdog, 200, { timeout: 50, refresh: 100 }).s.values).toMatchObject({ feeds: 0, resets: 4 });
  });
  it("42: preserves RTC wake, stops APB wake, and distinguishes standby reboot", () => {
    const stopped = run(sleep, 300), broken = run(sleep, 300, { wake: "APB timer" });
    expect(stopped.s.values.wakes).toBe(2);
    expect(stopped.s.values.charge).toBeLessThan(300 * 4);
    expect(broken.s.values).toMatchObject({ wakes: 0, blockedWakes: 2 });
    expect(run(sleep, 300, { mode: "Standby" }).s.values.reboots).toBe(2);
  });
  it("43: filters short dips, holds reset with hysteresis, and resumes after release", () => {
    const p = brownout.defaults;
    let s = brownout.action!(brownout.create(p), p, "dip");
    s = brownout.step(s, p, 20);
    expect(s.values).toMatchObject({ resets: 1, held: 0, unsafeWrites: 2 });
    let held = run(brownout, 10, { supply: 2.6 }).s;
    held = brownout.step(held, { ...p, supply: 2.75 }, 10);
    expect(held.values.held).toBe(1);
    held = brownout.step(held, { ...p, supply: 3.3 }, 10);
    expect(held.values.held).toBe(0);
    const short = { ...p, dip: 1 };
    expect(brownout.step(brownout.action!(brownout.create(short), short, "dip"), short, 10).values.resets).toBe(0);
  });
  it("44: produces nominal seconds, ppm drift, alarm, and backup-domain loss", () => {
    const timed = run(rtc, 60000);
    expect(timed.s.values.elapsedRtc).toBeCloseTo(60.0012, 6);
    expect(timed.s.values.alarm).toBe(1);
    expect(run(rtc, 1000, { main: false }).s.values.elapsedRtc).toBeGreaterThan(1);
    const lost = run(rtc, 1000, { main: false, battery: false });
    expect(lost.s.values).toMatchObject({ elapsedRtc: 0, lost: 1 });
  });
  it("45: maintains output interlocks and latches demand until clearance", () => {
    const p = { ...fsm.defaults, green: 200, yellow: 100, clearance: 100 };
    const s = fsm.step(fsm.action!(fsm.create(p), p, "pedestrian"), p, 800);
    expect(s.values).toMatchObject({ cycles: 1, served: 1, violations: 0 });
    expect(s.samples.every((point) => !(point.channels[0] && point.channels[1]))).toBe(true);
    expect(fsm.step(s, { ...p, emergency: true }, 1).values).toMatchObject({ ns: 0, ew: 0 });
    expect(run(fsm, 800, { ...p, interlock: false }).s.values.violations).toBeGreaterThan(0);
  });
  it("46–47: completes nominal work, detects overload, and preempts a lower-priority job", () => {
    expect(run(cooperative, 100).s.values.misses).toBe(0);
    expect(run(cooperative, 100, { cost: 15 }).s.values.misses).toBeGreaterThan(0);
    const preemptive = run(rtos, 100, { period: 13, cost: 6 });
    expect(preemptive.s.values.preemptions).toBeGreaterThan(0);
    const roundRobin = run(rtos, 100, { policy: "Round robin", quantum: 1 });
    expect([0, 1, 2].every((task) => roundRobin.s.values["done" + task]! > 0)).toBe(true);
  });
  it("48: reproduces lost updates and repairs them using exclusive access", () => {
    expect(run(synchronization, 40).s.values).toMatchObject({ operations: 8, counter: 4 });
    expect(run(synchronization, 40, { primitive: "Mutex" }).s.values).toMatchObject({ operations: 8, counter: 8, occupied: 0 });
    expect(run(synchronization, 40, { primitive: "Semaphore", capacity: 2 }).s.values.counter).toBeLessThan(8);
    expect(run(synchronization, 40, { primitive: "Mutex", release: false }).s.phase).toContain("Blocked");
  });
  it("49: bounds priority inversion by running the lock owner at inherited priority", () => {
    expect(run(inversion, 40).s.values.highResponse).toBe(13);
    expect(run(inversion, 40, { inheritance: true }).s.values).toMatchObject({ highResponse: 5, mediumAtHighCompletion: 8 });
  });
  it("50: validates standard CRC32 and commits only a complete valid inactive bank", () => {
    expect(crc32(Array.from("123456789", (c) => c.charCodeAt(0)))).toBe(0xcbf43926);
    const p = bootloader.defaults;
    const s = bootloader.step(bootloader.action!(bootloader.create(p), p, "start"), p, 8);
    expect(s.values).toMatchObject({ activeVersion: 2, activeBank: 1, committed: 1 });
    expect(s.memory.slice(32)).toEqual(firmwareImage(2));
    for (const fault of [{ corrupt: true }, { vectors: false }] as Params[]) {
      const cfg = { ...p, ...fault };
      const rejected = bootloader.step(bootloader.action!(bootloader.create(cfg), cfg, "start"), cfg, 8);
      expect(rejected.values).toMatchObject({ activeVersion: 1, rejected: 1, committed: 0 });
    }
    let interrupted = bootloader.step(bootloader.action!(bootloader.create(p), p, "start"), p, 3);
    interrupted = bootloader.action!(interrupted, p, "cut");
    expect(bootloader.step(interrupted, p, 20).values).toMatchObject({ activeVersion: 1, activeBank: 0, committed: 0, powerCuts: 1 });
  });
  it("51: executes actual compiled instructions, stops on a breakpoint, and returns 6", () => {
    const p = debuggerModel.defaults;
    let s = debuggerModel.step(debuggerModel.create(p), p, 1000);
    expect(s.values.breaks).toBe(1);
    s = debuggerModel.action!(s, p, "resume");
    s = debuggerModel.step(s, p, 1000);
    expect(s.cpu?.fault).toBe("");
    expect(s.cpu?.stopped).toBe(true);
    expect(s.values.R0).toBe(6);
    expect(debuggerModel.create(p, "int main( {").events[0]?.event).toBe("Compile error");
  });
  it("52: decodes sampled UART, detects a bad stop bit, and exposes incomplete acquisition", () => {
    expect(run(logicAnalyzer, 20).s.values).toMatchObject({ decoded: 85, framing: 0 });
    expect(run(logicAnalyzer, 20, { byte: 0xa6 }).s.values.decoded).toBe(0xa6);
    expect(run(logicAnalyzer, 20, { stop: false }).s.values.framing).toBe(1);
    expect(run(logicAnalyzer, 20, { rate: 1000000, depth: "128" }).s.values.decoded).toBe(-1);
  });
  it("53: derives measurements from sampled RC output and detects clipping", () => {
    const normal = run(oscilloscope, 20), m = analogMeasurement(normal.s, 1.65);
    expect(normal.s.samples).toHaveLength(256);
    expect(m.frequency).toBeCloseTo(1000, -1);
    expect(m.peakToPeak).toBeGreaterThan(1.5);
    expect(m.peakToPeak).toBeLessThan(2);
    expect(normal.s.values.clipped).toBe(0);
    expect(run(oscilloscope, 20, { amplitude: 3, tau: 0.01 }).s.values.clipped).toBeGreaterThan(0);
  });
  it("54: integrates physical workload charge and exposes clipped or bypassed measurements", () => {
    const normal = run(powerAnalyzer, 100);
    expect(normal.s.values.actualCharge).toBeCloseTo(284.8, 5);
    expect(Math.abs(normal.s.values.measuredCharge! - 284.8) / 284.8).toBeLessThan(0.05);
    expect(powerAnalyzer.checks(normal.s, normal.p).every((c) => c.passed)).toBe(true);
    expect(run(powerAnalyzer, 100, { shunt: 10, gain: 100 }).s.values.clipped).toBeGreaterThan(0);
    expect(run(powerAnalyzer, 100, { bypass: true }).s.values.measuredCharge).toBe(0);
  });
  it("52–53: acquisition results are independent of UI step size at low sample rates", () => {
    for (const [model, rate] of [[logicAnalyzer, 2000], [oscilloscope, 5000]] as const) {
      const p = { ...model.defaults, rate };
      const whole = model.step(model.create(p), p, 10);
      let sliced = model.create(p);
      for (let i = 0; i < 100; i++) sliced = model.step(sliced, p, 0.1);
      expect(sliced.time).toBeCloseTo(whole.time, 8);
      expect(sliced.memory).toEqual(whole.memory);
      expect(sliced.samples).toEqual(whole.samples);
      expect(sliced.values).toEqual(whole.values);
    }
  });
});
