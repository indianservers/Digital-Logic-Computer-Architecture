import { describe, expect, it } from "vitest";
import { Mcu } from "../core/mcu";
import { hx } from "../g1/thumb";
import {
  BUG_CLOCK, BUG_MODER, BUG_PIN, CODE_BASE, cpuTime, DEMO, format, FUNCS, lineOf, mcu37, P37_DEFAULT, PRINTF, program37, setup37, sim37, STACK_TOP, step37, VARIANTS, world37, blinkHz, type P37,
} from "./L37sim";

function boot(src: string, over: Partial<P37> = {}) {
  const p: P37 = { ...P37_DEFAULT, ...over };
  const m = new Mcu(mcu37());
  setup37(m, src);
  expect(m.load(src)).toEqual([]);
  expect(program37(src).diagnostics).toEqual([]);
  const s = sim37(m)!;
  const run = (sec: number) => { for (let t = 0; t < sec - 1e-9; t += 0.001) { if (m.fw?.paused) return; world37(m, 0.001, p); m.tick(0.001); } };
  const counter = () => s.cpu.read(s.cpu.prog.globals.find((g) => g.name === "counter")!.addr);
  return { m, p, s, run, counter };
}

describe("lab 37 Thumb execution with the STM32 register model", () => {
  it("compiles every variant for both the interpreter and the Thumb model", () => {
    for (const v of VARIANTS) {
      expect(program37(v.code).diagnostics).toEqual([]);
      expect(new Mcu(mcu37()).load(v.code)).toEqual([]);
    }
    const prog = program37(DEMO);
    expect(prog.labels.get("Reset_Handler")).toBe(CODE_BASE);
    expect(prog.ins.some((i) => i.text.startsWith("LDR   R1, =0x40020014"))).toBe(true);
    expect(prog.globals[0]).toMatchObject({ name: "counter", addr: 0x20000000 });
    expect(format("c=%d x=%04X %s%%", [-3, 0x2a, 0], () => "ok")).toBe("c=-3 x=002A ok%");
  });

  it("blinks PA5 every 100 ms of CPU time and counts loops", () => {
    const b = boot(DEMO);
    b.run(1.05);
    expect(b.counter()).toBeGreaterThanOrEqual(10);
    expect(b.counter()).toBeLessThanOrEqual(11);
    expect(b.m.pin("PA5").mode).toBe("out");
    expect(blinkHz(b.s)).toBeCloseTo(5, 1);
    expect(b.s.cpu.r[13]).toBe(STACK_TOP - 4);
    expect(b.s.trace.some((x) => x.kind === "store" && x.text.startsWith("GPIOA ODR changed"))).toBe(true);
    expect(b.s.lib.delay_ms!.calls).toBe(b.counter());
    expect(Math.abs(cpuTime(b.s) - b.m.time)).toBeLessThan(0.11);
    b.run(30);
    const recent = b.s.trace.slice(-40);
    expect(recent.some((x) => x.kind === "store")).toBe(true);
    expect(recent.some((x) => x.kind === "var" && /^counter \d+ → \d+$/.test(x.text))).toBe(true);
    expect(recent.some((x) => x.kind === "lib" && x.text.startsWith("delay_ms(100): 100 ms"))).toBe(true);
  });

  it("stops at a breakpoint, steps a line and an instruction", () => {
    const b = boot(DEMO);
    const toggle = DEMO.split("\n").findIndex((l) => l.includes("GPIOA->ODR ^=")) + 1;
    b.s.bps = new Set([toggle]);
    b.run(0.5);
    expect(b.m.fw?.paused).toBe(true);
    expect(lineOf(b.s)).toBe(toggle);
    expect(b.counter()).toBe(1);
    const odr = b.m.peek("GPIOA.ODR");
    step37(b.m, "over", b.p);
    expect(b.m.peek("GPIOA.ODR")).toBe(odr ^ 0x20);
    expect(lineOf(b.s)).toBe(toggle + 1);
    const pc = b.s.cpu.r[15]!;
    step37(b.m, "ins", b.p);
    expect(b.s.cpu.r[15]).not.toBe(pc);
    step37(b.m, "over", b.p);
    expect(lineOf(b.s)).toBeLessThan(toggle);
    expect(hx(b.s.cpu.r[15]!, 8)).toMatch(/^0x0800/);
  });

  it("steps into and out of a user function", () => {
    const b = boot(FUNCS);
    const body = FUNCS.split("\n").findIndex((l) => l.includes("GPIOA->ODR ^= (1 << pin)")) + 1;
    const call = FUNCS.split("\n").findIndex((l) => l.includes("blink(LED_PIN)")) + 1;
    b.s.bps = new Set([call]);
    b.run(0.2);
    expect(lineOf(b.s)).toBe(call);
    step37(b.m, "into", b.p);
    for (let i = 0; i < 4 && lineOf(b.s) !== body; i++) step37(b.m, "into", b.p);
    expect(lineOf(b.s)).toBe(body);
    expect(b.s.cpu.calls.length).toBe(2);
    step37(b.m, "out", b.p);
    expect(b.s.cpu.calls.length).toBe(1);
  });

  it("prints over USART2 and charges the UART time", () => {
    const b = boot(PRINTF);
    b.run(0.35);
    expect(b.s.console).toContain("counter=10\ncounter=20\n");
    expect(b.s.lastPrintf!.chars).toBe(11);
    expect(b.s.lastPrintf!.cycles / 16e6).toBeGreaterThan(0.00095);
  });

  it("reproduces the clock, MODER and pin bugs", () => {
    const clk = boot(BUG_CLOCK);
    clk.run(0.5);
    expect(clk.s.faults.some((f) => f.includes("clock disabled"))).toBe(true);
    expect(clk.s.ledEdges.length).toBe(0);
    const mod = boot(BUG_MODER);
    mod.run(0.5);
    expect(mod.m.pin("PA5").mode).not.toBe("out");
    expect(mod.m.peek("GPIOA.ODR") & 0x20 || mod.s.trace.some((x) => x.text.startsWith("GPIOA ODR"))).toBeTruthy();
    expect(mod.s.ledEdges.length).toBe(0);
    const pin = boot(BUG_PIN);
    pin.run(0.5);
    expect(pin.s.ledEdges.length).toBe(0);
    expect(pin.m.pin("PA6").mode).toBe("out");
  });

  it("animates line by line without running ahead", () => {
    const b = boot(DEMO, { mode: "l5" });
    b.run(1);
    expect(b.s.steps).toBe(0);
    expect(b.counter()).toBeLessThanOrEqual(2);
    expect(b.s.trace.filter((x) => x.kind === "line").length).toBeGreaterThanOrEqual(4);
  });
});
