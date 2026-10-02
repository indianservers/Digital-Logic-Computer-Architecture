import { describe, expect, it } from "vitest";
import { Mcu } from "../core/mcu";
import { CORE_HZ } from "./L16sim";
import { applyConfig, bench17, codeConfig, DEMO, tap, extiEvents, HAL_DEMO, liveConfig, NO_DEBOUNCE, NO_PR_CLEAR, noisyContact, P17_DEFAULT, setup17, timingOf, world17, type P17 } from "./L17sim";

function boot(src: string, p: Partial<P17> = {}) {
  const params = { ...P17_DEFAULT, ...p };
  const m = new Mcu({ ips: 120_000, clock: CORE_HZ, strictClock: true });
  setup17(m, params);
  expect(m.load(src)).toEqual([]);
  const run = (s: number) => { for (let t = 0; t < s; t += 0.001) { world17(m, 0.001, params); m.tick(0.001); } expect(m.fw?.error).toBeUndefined(); };
  const press = (key: "sw1" | "sw2", hold = 0.12) => { params[key] = true; run(hold); params[key] = false; run(0.12); };
  run(0.05);
  return { m, params, run, press };
}
const num = (m: Mcu, n: string) => m.fw!.num(n);

describe("lab 17 external interrupts", () => {
  it("a bouncy press raises several EXTI0 IRQs but the ISR accepts one", () => {
    const { m, press } = boot(DEMO);
    press("sw1");
    expect(num(m, "raw_irqs")).toBeGreaterThan(1);
    expect(num(m, "event_count")).toBe(1);
    expect(m.pin("PA5").level).toBe(1);
    const t = timingOf(extiEvents(m)[0])!;
    expect(t.latencyUs).toBeCloseTo(0.75, 1);
    expect(t.isrCyc).toBeGreaterThan(8);
  });

  it("without debounce every bounce counts", () => {
    const { m, press } = boot(NO_DEBOUNCE);
    press("sw1"); press("sw1");
    expect(num(m, "event_count")).toBeGreaterThan(2);
  });

  it("falling-edge trigger fires on release, both edges on press and release", () => {
    const f = boot(applyConfig(DEMO, { trigger: "falling" })!, { bounce: 0 });
    f.params.sw1 = true; f.run(0.1);
    expect(num(f.m, "raw_irqs")).toBe(0);
    f.params.sw1 = false; f.run(0.1);
    expect(num(f.m, "event_count")).toBe(1);
    expect(liveConfig(f.m).trigger).toBe("falling");
    const b = boot(applyConfig(DEMO, { trigger: "both" })!, { bounce: 0 });
    b.press("sw1");
    expect(num(b.m, "raw_irqs")).toBe(2);
    expect(num(b.m, "event_count")).toBe(1);
  });

  it("EXTICR selects the port: PB0 drives EXTI0 and PA0 no longer does", () => {
    const { m, press } = boot(applyConfig(DEMO, { port: 1 })!);
    press("sw1");
    expect(num(m, "raw_irqs")).toBe(0);
    press("sw2");
    expect(num(m, "event_count")).toBe(1);
    expect(liveConfig(m).port).toBe(1);
  });

  it("without the SYSCFG clock EXTICR stays 0: PA0 works by luck, PB0 never does", () => {
    const a = boot(DEMO, { syscfgOff: true });
    a.press("sw1");
    expect(num(a.m, "event_count")).toBe(1);
    const b = boot(applyConfig(DEMO, { port: 1 })!, { syscfgOff: true });
    b.press("sw2");
    expect(num(b.m, "raw_irqs")).toBe(0);
    expect(liveConfig(b.m).port).toBe(0);
  });

  it("a masked line ignores edges", () => {
    const { m, press } = boot(applyConfig(DEMO, { mask: false })!);
    press("sw1");
    expect(num(m, "raw_irqs")).toBe(0);
  });

  it("forgetting to clear EXTI->PR re-enters the handler forever", () => {
    const { m, params, run } = boot(NO_PR_CLEAR, { bounce: 0 });
    params.sw1 = true; run(0.05);
    expect(num(m, "raw_irqs")).toBeGreaterThan(100);
  });

  it("a floating input produces phantom interrupts; a noisy contact is filtered", () => {
    const fl = boot(DEMO, { floating: true });
    fl.run(3);
    expect(num(fl.m, "raw_irqs")).toBeGreaterThan(2);
    expect(bench17(fl.m).physical).toBe(0);
    const nz = boot(DEMO);
    nz.run(0.1);
    noisyContact(nz.m);
    nz.run(0.05);
    expect(num(nz.m, "raw_irqs")).toBeGreaterThan(4);
    expect(num(nz.m, "event_count")).toBe(1);
  });

  it("tap holds a switch for simulated time; codeConfig reads back what applyConfig wrote", () => {
    const { m, run } = boot(DEMO);
    tap(m, 0); run(0.3);
    expect(bench17(m).physical).toBe(1);
    expect(num(m, "event_count")).toBe(1);
    expect(codeConfig(applyConfig(DEMO, { port: 1, trigger: "both", mask: false })!)).toEqual({ port: 1, trigger: "both", mask: false, editable: true });
    expect(codeConfig(HAL_DEMO)).toMatchObject({ trigger: "rising", editable: false });
  });

  it("HAL callback version counts presses the same way", () => {
    const { m, press } = boot(HAL_DEMO);
    press("sw1");
    expect(num(m, "event_count")).toBe(1);
    expect(applyConfig(HAL_DEMO, { port: 1 })).toBeNull();
  });
});
