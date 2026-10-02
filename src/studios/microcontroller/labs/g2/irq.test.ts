import { describe, expect, it } from "vitest";
import { Mcu } from "../core/mcu";
import { breakdown, CORE_HZ, CRITICAL, DEMO, ENTRY_CYC, LONG_ISR, NO_CLEAR, P16_DEFAULT, pend, pendingReason, setup16, state16, stepPhase, world16, type P16 } from "./L16sim";

function boot(src: string, p: Partial<P16> = {}) {
  const params = { ...P16_DEFAULT, ...p };
  const m = new Mcu({ ips: 120_000, clock: CORE_HZ });
  setup16(m);
  expect(m.load(src)).toEqual([]);
  const run = (s: number) => { for (let t = 0; t < s; t += 0.001) { world16(m, 0.001, params); m.tick(0.001); } expect(m.fw?.error).toBeUndefined(); };
  return { m, params, run };
}

describe("lab 16 interrupts", () => {
  it("TIM2 update interrupts preempt main and are timed in cycles", () => {
    const { m, run } = boot(DEMO);
    run(1.2);
    const s = state16(m);
    expect(s.events.length).toBe(2);
    expect(m.fw!.num("ticks")).toBe(2);
    const b = breakdown(s.events[0]!);
    expect(b.entry).toBe(ENTRY_CYC);
    expect(b.isr).toBeGreaterThanOrEqual(12);
    expect(b.heldUs).toBeLessThan(10);
    expect(s.events[0]!.line).toBeGreaterThanOrEqual(27);
  });

  it("software pend through NVIC->ISPR runs the handler immediately", () => {
    const { m, run } = boot(DEMO);
    run(0.1);
    pend(m);
    run(0.01);
    const ev = state16(m).events.at(-1)!;
    expect(ev.src).toBe("software");
    expect(m.fw!.num("ticks")).toBe(1);
  });

  it("a request inside __disable_irq waits until PRIMASK clears", () => {
    const { m, run } = boot(CRITICAL);
    run(0.3);
    const ev = state16(m).events.find((e) => e.src === "timer" || e.src === "software")!;
    expect(breakdown(ev).heldUs).toBeGreaterThan(100);
  });

  it("PRIMASK fault holds a request pending; clearing it services the IRQ", () => {
    const { m, params, run } = boot(DEMO, { primask: true });
    run(0.1);
    pend(m);
    run(0.05);
    expect(m.fw!.num("ticks")).toBe(0);
    expect(pendingReason(m)).toContain("PRIMASK");
    params.primask = false;
    run(0.01);
    expect(m.fw!.num("ticks")).toBe(1);
    expect(breakdown(state16(m).events.at(-1)!).heldUs).toBeGreaterThan(40_000);
  });

  it("NVIC disable keeps the timer IRQ pending forever", () => {
    const { m, run } = boot(DEMO, { nvicOff: true });
    run(1.2);
    expect(m.fw!.num("ticks")).toBe(0);
    expect(pendingReason(m)).toContain("NVIC_ISER0");
  });

  it("an uncleared UIF re-enters the ISR and starves main", () => {
    const { m, run } = boot(NO_CLEAR);
    run(0.6);
    const w1 = m.fw!.num("work");
    run(0.2);
    expect(m.fw!.num("work")).toBe(w1);
    expect(state16(m).events.length).toBeGreaterThan(50);
  });

  it("a long ISR costs many more cycles", () => {
    const a = boot(DEMO); a.run(0.6);
    const b = boot(LONG_ISR); b.run(0.6);
    expect(breakdown(state16(b.m).events[0]!).isr).toBeGreaterThan(breakdown(state16(a.m).events[0]!).isr * 10);
  });

  it("steps request, stacking, each ISR statement and return", () => {
    const { m, params, run } = boot(DEMO);
    run(0.1);
    m.fw!.pause();
    const world = () => world16(m, 0.001, params);
    const q = state16(m).seq;
    q.pend = true;
    expect(stepPhase(m, world)).toBe("");
    expect(q.phase).toBe("request");
    stepPhase(m, world);
    expect(q.phase).toBe("stacking");
    expect(q.cycles).toBe(12);
    stepPhase(m, world);
    expect(q.phase).toBe("isr");
    expect(m.fw!.line).toBe(9);
    expect(q.isrStmts).toBe(1);
    let guard = 0;
    while (q.phase === "isr" && guard++ < 10) stepPhase(m, world);
    expect(q.phase).toBe("return");
    expect(m.fw!.num("ticks")).toBe(1);
    expect(q.cycles).toBe(12 + q.isrStmts * 4 + 10);
    stepPhase(m, world);
    expect(q.phase).toBe("main");
  });
});
