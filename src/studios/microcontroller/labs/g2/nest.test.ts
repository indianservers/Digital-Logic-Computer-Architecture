import { describe, expect, it } from "vitest";
import { Mcu } from "../core/mcu";
import { CORE_HZ } from "./L16sim";
import { bench18, burst, CRITICAL, DEMO, EQUAL, INVERTED, metrics, P18_DEFAULT, peakTime, priorityOf, setPriority, setup18, statusAt, world18, type P18 } from "./L18sim";

function boot(src: string, p: Partial<P18> = {}) {
  const params = { ...P18_DEFAULT, ...p };
  const m = new Mcu({ ips: 120_000, clock: CORE_HZ });
  setup18(m);
  expect(m.load(src)).toEqual([]);
  const run = (s: number) => { for (let t = 0; t < s; t += 0.001) { world18(m, 0.001, params); m.tick(0.001); } expect(m.fw?.error).toBeUndefined(); };
  run(0.03);
  return { m, params, run };
}
const fire = (f: ReturnType<typeof boot>) => { f.run(0.0015); burst(f.m); f.run(0.01); return bench18(f.m).snap; };
const names = (s: NonNullable<ReturnType<typeof fire>>) => s.events.map((e) => e.name);

describe("lab 18 interrupt priority and nesting", () => {
  it("default priorities nest three deep: USART2 ← TIM2 ← EXTI0", () => {
    const f = boot(DEMO);
    const s = fire(f)!;
    expect(s).toBeTruthy();
    for (const n of ["USART2_IRQHandler", "TIM2_IRQHandler", "EXTI0_IRQHandler"]) expect(names(s)).toContain(n);
    const mt = metrics(s);
    expect(mt.depth).toBeGreaterThanOrEqual(3);
    expect(mt.preemptions).toBeGreaterThanOrEqual(2);
    expect(mt.switches).toBeGreaterThanOrEqual(5);
    const t = peakTime(s);
    expect(statusAt(s, "EXTI0_IRQHandler", t)).toBe("Active");
    expect(statusAt(s, "USART2_IRQHandler", t)).toBe("Preempted");
    expect(f.m.fw!.num("n_uart")).toBe(1);
    expect(f.m.fw!.num("last_rx")).toBe(65);
  });

  it("equal priorities never preempt: the handlers run back to back and EXTI0 waits", () => {
    const s = fire(boot(EQUAL))!;
    const mt = metrics(s);
    expect(mt.preemptions).toBe(0);
    expect(mt.depth).toBe(1);
    expect(mt.longestUs).toBeGreaterThan(50);
  });

  it("inverting priorities makes the urgent EXTI0 wait behind the UART parser", () => {
    const s = fire(boot(INVERTED))!;
    const exti = s.events.find((e) => e.name === "EXTI0_IRQHandler")!;
    const uart = s.events.find((e) => e.name === "USART2_IRQHandler")!;
    expect(exti.t0).toBeGreaterThanOrEqual(uart.t1 - 1e-9);
    expect(exti.blocked).toBe(true);
  });

  it("SysTick honours NVIC_SetPriority and the editor helpers round-trip", () => {
    const f = boot(DEMO);
    f.run(0.1);
    expect(f.m.fw!.num("n_tick")).toBeGreaterThanOrEqual(9);
    expect(priorityOf(DEMO, "TIM2")).toBe(1);
    expect(priorityOf(setPriority(DEMO, "TIM2", 3)!, "TIM2")).toBe(3);
    expect(setPriority("int main(){}", "TIM2", 1)).toBeNull();
  });

  it("a critical section in main delays every IRQ in the burst", () => {
    const f = boot(CRITICAL);
    let s = null;
    for (let k = 0; k < 6 && !(s && metrics(s).longestUs > 100); k++) s = fire(f);
    expect(metrics(s).longestUs).toBeGreaterThan(100);
  });

  it("EXTI0 disabled in the NVIC drops the button from the burst", () => {
    const s = fire(boot(DEMO, { extiOff: true }))!;
    expect(names(s)).not.toContain("EXTI0_IRQHandler");
    expect(names(s)).toContain("USART2_IRQHandler");
  });
});
