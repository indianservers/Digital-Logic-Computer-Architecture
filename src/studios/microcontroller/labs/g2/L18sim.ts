import type { Mcu } from "../core/mcu";
import { state16, trackIrqs, trackRequests, type IrqEvent } from "./L16sim";

export const DEMO = `#include "stm32f4xx.h"

volatile uint32_t n_exti = 0, n_tim = 0, n_uart = 0, n_tick = 0;
volatile uint8_t last_rx = 0;

void USART2_IRQHandler(void)           // P2: parse a received byte
{
    last_rx = USART2->DR;              // reading DR clears RXNE
    for (volatile uint32_t i = 0; i < 14; i++) { }
    n_uart++;
}

void TIM2_IRQHandler(void)             // P1: periodic control tick
{
    TIM2->SR = ~TIM_SR_UIF;
    for (volatile uint32_t i = 0; i < 8; i++) { }
    n_tim++;
}

void EXTI0_IRQHandler(void)            // P0: emergency-stop button
{
    EXTI->PR = EXTI_PR_PR0;
    GPIOA->ODR ^= (1 << 5);
    n_exti++;
}

void SysTick_Handler(void)             // P3: 10 ms housekeeping
{
    n_tick++;
}

int main(void)
{
    RCC->AHB1ENR |= RCC_AHB1ENR_GPIOAEN;
    RCC->APB1ENR |= RCC_APB1ENR_TIM2EN | RCC_APB1ENR_USART2EN;
    RCC->APB2ENR |= RCC_APB2ENR_SYSCFGEN;
    GPIOA->MODER |= (1 << (5*2));
    GPIOA->PUPDR |= (2 << (0*2));

    EXTI->RTSR |= EXTI_RTSR_TR0;
    EXTI->IMR  |= EXTI_IMR_MR0;
    TIM2->PSC = 15999;                 // 16 MHz / 16000 = 1 kHz
    TIM2->ARR = 249;                   // update every 250 ms
    TIM2->DIER |= TIM_DIER_UIE;
    TIM2->CR1 |= TIM_CR1_CEN;
    USART2->BRR = 0x8B;                // 115200 baud at 16 MHz
    USART2->CR1 |= USART_CR1_UE | USART_CR1_RE | USART_CR1_RXNEIE;
    SysTick_Config(SystemCoreClock / 100);

    // Lower number = higher preemption priority (4 bits, group 4: no sub-priority)
    NVIC_SetPriority(EXTI0_IRQn, 0);
    NVIC_SetPriority(TIM2_IRQn, 1);
    NVIC_SetPriority(USART2_IRQn, 2);
    NVIC_SetPriority(SysTick_IRQn, 3);
    NVIC_EnableIRQ(EXTI0_IRQn);
    NVIC_EnableIRQ(TIM2_IRQn);
    NVIC_EnableIRQ(USART2_IRQn);

    while (1)
    {
        // Trigger events close together and inspect nesting
    }
}
`;

export type IrqKey = "EXTI0" | "TIM2" | "USART2" | "SysTick";
export const IRQS: Array<{ key: IrqKey; label: string; handler: string; color: string; lane: string }> = [
  { key: "USART2", label: "USART2", handler: "USART2_IRQHandler", color: "#16a34a", lane: "UART IRQ" },
  { key: "TIM2", label: "TIM2", handler: "TIM2_IRQHandler", color: "#f5a524", lane: "TIM2 IRQ" },
  { key: "EXTI0", label: "EXTI0", handler: "EXTI0_IRQHandler", color: "#e5484d", lane: "EXTI IRQ" },
  { key: "SysTick", label: "SysTick", handler: "SysTick_Handler", color: "#7c5cff", lane: "SysTick" },
];
export const EDITOR_ORDER: IrqKey[] = ["EXTI0", "TIM2", "USART2", "SysTick"];

const prioRe = (k: IrqKey) => new RegExp(`(NVIC_SetPriority\\(${k}_IRQn,\\s*)(\\d+)(\\))`);
export function priorityOf(src: string, k: IrqKey): number | null {
  const m = prioRe(k).exec(src);
  return m ? Number(m[2]) : null;
}
export function setPriority(src: string, k: IrqKey, p: number): string | null {
  if (!prioRe(k).test(src)) return null;
  return src.replace(prioRe(k), `$1${Math.max(0, Math.min(15, Math.round(p)))}$3`);
}
const withPrios = (p: Record<IrqKey, number>) => EDITOR_ORDER.reduce((s, k) => setPriority(s, k, p[k]) ?? s, DEMO);
export const EQUAL = withPrios({ EXTI0: 2, TIM2: 2, USART2: 2, SysTick: 2 });
export const INVERTED = withPrios({ EXTI0: 2, TIM2: 1, USART2: 0, SysTick: 3 });
export const CRITICAL = DEMO.replace(
  "        // Trigger events close together and inspect nesting\n",
  "        __disable_irq();               // non-atomic update of shared data\n        for (volatile uint32_t i = 0; i < 40; i++) { }\n        __enable_irq();\n        HAL_Delay(30);\n",
);

export type P18 = { primask: boolean; extiOff: boolean };
export const P18_DEFAULT: P18 = { primask: false, extiOff: false };

/** Offsets of the three burst sources, in seconds after the button press. */
export const BURST = { USART2: 0, TIM2: 90e-6, EXTI0: 170e-6 } as const;
export interface Seg { thread: string; t0: number; t1: number }
export interface Snapshot { t0: number; t1: number; events: IrqEvent[]; segs: Seg[]; switches: number }
interface Bench18 { burstT: number; snap: Snapshot | null; bursts: number; forced: boolean }
const BENCH = new WeakMap<Mcu, Bench18>();
export function bench18(m: Mcu): Bench18 {
  let b = BENCH.get(m);
  if (!b) { b = { burstT: -1, snap: null, bursts: 0, forced: false }; BENCH.set(m, b); }
  return b;
}

export const setup18 = (m: Mcu) => trackRequests(m);

/** Three real sources inside 170 µs: a UART byte, a TIM2 update pended through NVIC->ISPR, and a PA0 rising edge. */
export function burst(m: Mcu) {
  const b = bench18(m);
  const t = m.time;
  b.burstT = t; b.snap = null; b.bursts++;
  m.schedule(t + BURST.USART2, () => m.uartReceive("A"));
  m.schedule(t + BURST.TIM2, () => { m.write("TIM2.SR", m.peek("TIM2.SR") | 1); state16(m).nextSrc = "software"; m.write("NVIC.ISPR0", 1 << 28); });
  m.schedule(t + BURST.EXTI0, () => m.setInput("PA0", 1));
  m.schedule(t + BURST.EXTI0 + 0.002, () => m.setInput("PA0", null));
}
export const pressButton = (m: Mcu) => { m.setInput("PA0", 1); m.schedule(m.time + 0.05, () => m.setInput("PA0", null)); };

const HANDLERS = new Set(IRQS.map((i) => i.handler));
export function world18(m: Mcu, _dt: number, p: P18) {
  const fw = m.fw;
  if (!fw) return;
  trackIrqs(m);
  const b = bench18(m);
  // Fault: main masks interrupts for 1.5 ms out of every 20 ms.
  if (p.primask) { const inWin = (m.time % 0.02) < 0.0015; if (inWin !== !fw.globalIrqEnabled) fw.globalIrqEnabled = !inWin; b.forced = true; }
  else if (b.forced) { fw.globalIrqEnabled = true; b.forced = false; }
  if (p.extiOff && (fw.irqEnabled.has("EXTI0") || m.nvicEnabled("EXTI0"))) { fw.irqEnabled.delete("EXTI0"); m.write("NVIC.ICER0", 1 << 6); }
  if (b.bursts === 0 && m.time > 0.06) burst(m);
  if (b.burstT >= 0 && !b.snap && m.time > b.burstT + 0.004) b.snap = snapshot(m, b.burstT, b.burstT + 0.004);
}

/** Capture the burst window: ISR runs that were requested inside it and the scheduler's execution segments. */
export function snapshot(m: Mcu, a: number, z: number): Snapshot {
  const fw = m.fw!;
  const raw = state16(m).events.filter((e) => HANDLERS.has(e.name) && e.tReq >= a - 1e-9 && e.tReq <= z);
  const end = raw.reduce((t, e) => Math.max(t, e.t1), a + 0.0002);
  const segs = fw.trace.filter((s) => s.t1 > a && s.t0 < end + 1e-9).map((s) => ({ thread: s.thread, t0: Math.max(a, s.t0), t1: Math.min(end, s.t1) }));
  // The interpreter queues an ISR thread the moment it is requested; it really starts at its first execution segment.
  const events = raw.map((e) => {
    const first = segs.find((g) => g.thread === e.name && g.t0 >= e.t0 - 1e-9 && g.t0 < e.t1);
    return { ...e, t0: first ? first.t0 : e.t0 };
  });
  for (const e of events) {
    e.nested = events.some((o) => o !== e && o.t0 < e.t0 && o.t1 > e.t0);
    e.blocked = e.t0 - e.tReq > 1.5 / fw.ips;
  }
  return { t0: a, t1: end, events, segs, switches: Math.max(0, segs.length - 1) };
}

export interface Metrics { preemptions: number; longestUs: number; longestName: string; depth: number; switches: number }
export function metrics(s: Snapshot | null): Metrics {
  if (!s) return { preemptions: 0, longestUs: 0, longestName: "", depth: 0, switches: 0 };
  let depth = 0, longestUs = 0, longestName = "";
  for (const e of s.events) {
    const d = s.events.filter((o) => o.t0 <= e.t0 + 1e-12 && o.t1 > e.t0).length;
    depth = Math.max(depth, d);
    const w = (e.t0 - e.tReq) * 1e6;
    if (e.blocked && w > longestUs) { longestUs = w; longestName = e.name; }
  }
  return { preemptions: s.events.filter((e) => e.nested).length, longestUs, longestName, depth, switches: s.switches };
}

export type Status = "Active" | "Preempted" | "Pending" | "Waiting";
/** What one IRQ was doing at time t inside the snapshot. */
export function statusAt(s: Snapshot | null, handler: string, t: number): Status {
  if (!s) return "Waiting";
  if (s.segs.some((g) => g.thread === handler && g.t0 <= t && t < g.t1)) return "Active";
  if (s.events.some((e) => e.name === handler && e.t0 <= t && t < e.t1)) return "Preempted";
  if (s.events.some((e) => e.name === handler && e.tReq <= t && t < e.t0)) return "Pending";
  return "Waiting";
}

/** The instant of deepest nesting, a good default cursor for the status column. */
export function peakTime(s: Snapshot | null): number {
  if (!s || !s.events.length) return s?.t0 ?? 0;
  let best = s.events[0]!.t0, bd = 0;
  for (const e of s.events) { const d = s.events.filter((o) => o.t0 <= e.t0 + 1e-12 && o.t1 > e.t0).length; if (d > bd) { bd = d; best = e.t0 + 1e-7; } }
  return best;
}
