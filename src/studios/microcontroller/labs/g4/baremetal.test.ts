import { describe, expect, it } from "vitest";
import { Mcu } from "../core/mcu";
import { mcu37, program37, sim37 } from "./L37sim";
import { addrOf, BUG_MODER, BUG_PORT, BUG_TIMCLK, BUG_UIF, DEMO, effects, P38_DEFAULT, pinRate, poke38, REGS, setup38, sim38, VARIANTS, world38 } from "./L38sim";

function boot(src: string) {
  const m = new Mcu(mcu37());
  setup38(m, src);
  expect(m.load(src)).toEqual([]);
  expect(program37(src).diagnostics).toEqual([]);
  const run = (sec: number) => { for (let t = 0; t < sec - 1e-9; t += 0.001) { world38(m, 0.001, P38_DEFAULT); m.tick(0.001); } };
  return { m, run, s: sim38(m)!, s37: sim37(m)! };
}

describe("lab 38 bare-metal registers", () => {
  it("compiles every variant and maps every workbench register", () => {
    for (const v of VARIANTS) expect(program37(v.code).diagnostics).toEqual([]);
    expect(REGS.map((r) => addrOf(r.path))).toEqual([0x40023830, 0x40023840, 0x40020000, 0x40020014, 0x40000000, 0x40000028, 0x4000002c, 0x40000010]);
  });

  it("blinks PA5 from TIM2 at 4 Hz updates and logs the bus", () => {
    const b = boot(DEMO);
    b.run(2.1);
    const fx = effects(b.m);
    expect(fx).toMatchObject({ gpioaClk: true, tim2Clk: true, pa5Mode: "output", cen: true, irq: "disabled" });
    expect(fx.tickHz).toBe(1000);
    expect(fx.updHz).toBe(4);
    expect(pinRate(b.m, 2)).toBe(4);
    expect(b.s.uifEdges.length).toBeGreaterThan(10);
    const writes = b.s.bus.filter((e) => e.rw === "W").map((e) => e.path);
    expect(writes.slice(0, 7)).toEqual(["RCC.AHB1ENR", "GPIOA.MODER", "GPIOA.ODR", "RCC.APB1ENR", "TIM2.PSC", "TIM2.ARR", "TIM2.CR1"]);
    expect(b.s.bus.some((e) => e.rw === "R" && e.path === "TIM2.SR" && e.n > 100)).toBe(true);
  });

  it("applies workbench edits live, but not to a clock-gated peripheral", () => {
    const b = boot(DEMO);
    b.run(0.5);
    poke38(b.m, "TIM2.PSC", 7999);
    b.run(1.5);
    expect(effects(b.m).updHz).toBe(8);
    expect(pinRate(b.m, 1)).toBeGreaterThanOrEqual(7);
    const g = boot(BUG_TIMCLK);
    g.run(0.3);
    poke38(g.m, "TIM2.CR1", 1);
    expect(g.s.bus[g.s.bus.length - 1]).toMatchObject({ src: "edit", ignored: true });
    poke38(g.m, "RCC.APB1ENR", 1);
    poke38(g.m, "TIM2.PSC", 15999);
    poke38(g.m, "TIM2.ARR", 249);
    poke38(g.m, "TIM2.CR1", 1);
    expect(g.s.bus[g.s.bus.length - 1]!.ignored).toBe(false);
    g.run(1.2);
    expect(pinRate(g.m, 1)).toBeGreaterThanOrEqual(3);
  });

  it("reproduces each bug", () => {
    const clk = boot(BUG_TIMCLK);
    clk.run(1);
    expect(effects(clk.m)).toMatchObject({ led: true, cen: false });
    expect(clk.s37.faults.some((f) => f.includes("TIM2"))).toBe(true);
    expect(pinRate(clk.m)).toBe(0);
    const uif = boot(BUG_UIF);
    uif.run(0.3);
    expect(pinRate(uif.m, 0.04)).toBeGreaterThan(10000);
    expect(uif.m.peek("TIM2.SR") & 1).toBe(1);
    const port = boot(BUG_PORT);
    port.run(1);
    expect(port.s37.faults.some((f) => f.includes("GPIOB"))).toBe(true);
    expect(pinRate(port.m)).toBe(0);
    const mod = boot(BUG_MODER);
    mod.run(1);
    expect(effects(mod.m)).toMatchObject({ pa5Mode: "input", led: false });
  });
});
