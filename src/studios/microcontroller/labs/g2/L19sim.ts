import type { Mcu } from "../core/mcu";

export const CLK19 = 72e6;

export const DEMO = `#include "stm32f4xx.h"
// SYSCLK 72 MHz (HSE 8 MHz, PLL VCO 288 MHz / 4); APB1 = 36 MHz, so TIM2 runs at 2 x 36 = 72 MHz

volatile uint32_t overflow_count = 0;
volatile uint32_t compare_count = 0;

void TIM2_IRQHandler(void)
{
    if (TIM2->SR & TIM_SR_UIF)         // update event: CNT wrapped ARR -> 0
    {
        TIM2->SR = ~TIM_SR_UIF;        // rc_w0: write 0 to clear
        overflow_count++;
        GPIOA->ODR ^= (1 << 5);        // LD2 toggles on every overflow
    }
    if (TIM2->SR & TIM_SR_CC1IF)       // compare: CNT reached CCR1
    {
        TIM2->SR = ~TIM_SR_CC1IF;
        compare_count++;
    }
}

int main(void)
{
    RCC->AHB1ENR |= RCC_AHB1ENR_GPIOAEN;
    RCC->APB1ENR |= RCC_APB1ENR_TIM2EN;
    GPIOA->MODER |= (1 << (5*2));

    TIM2->PSC = 7199;                  // 72 MHz / (7199 + 1) = 10 kHz
    TIM2->ARR = 4999;                  // (4999 + 1) / 10 kHz = 500 ms
    TIM2->CCR1 = 2500;                 // compare point half way
    TIM2->DIER |= TIM_DIER_UIE;        // update interrupt on
    TIM2->EGR = TIM_EGR_UG;            // load the PSC preload now, CNT = 0
    TIM2->SR = 0;
    TIM2->CR1 |= TIM_CR1_CEN;
    NVIC_EnableIRQ(TIM2_IRQn);

    while (1)
    {
    }
}
`;

export const POLLING = DEMO
  .replace(/void TIM2_IRQHandler\(void\)\n\{[\s\S]*?\n\}\n\n/, "")
  .replace("    TIM2->DIER |= TIM_DIER_UIE;        // update interrupt on\n", "")
  .replace("    NVIC_EnableIRQ(TIM2_IRQn);\n", "")
  .replace("    while (1)\n    {\n    }\n", "    while (1)\n    {\n        if (TIM2->SR & TIM_SR_UIF)     // poll the update flag\n        {\n            TIM2->SR = ~TIM_SR_UIF;\n            overflow_count++;\n            GPIOA->ODR ^= (1 << 5);\n        }\n    }\n");
export const OFF_BY_ONE = DEMO
  .replace("    TIM2->PSC = 7199;                  // 72 MHz / (7199 + 1) = 10 kHz\n", "    TIM2->PSC = 7200;                  // BUG: should be 7200 - 1\n")
  .replace("    TIM2->ARR = 4999;                  // (4999 + 1) / 10 kHz = 500 ms\n", "    TIM2->ARR = 5000;                  // BUG: should be 5000 - 1\n");
export const NO_CEN = DEMO.replace("    TIM2->CR1 |= TIM_CR1_CEN;\n", "    // BUG: TIM2->CR1 |= TIM_CR1_CEN; was forgotten\n");

const LINE = {
  psc: /^( {4}TIM2->PSC = )(\d+)(;.*)$/m,
  arr: /^( {4}TIM2->ARR = )(\d+)(;.*)$/m,
  ccr: /^( {4}TIM2->CCR1 = )(\d+)(;.*)$/m,
};
export function codeValue(src: string, k: keyof typeof LINE): number | null {
  const m = LINE[k].exec(src);
  return m ? Number(m[2]) : null;
}
/** Rewrite the PSC / ARR / CCR1 assignment, keeping its comment. Returns the source unchanged if the line is absent. */
export function setCodeValue(src: string, k: keyof typeof LINE, v: number): string {
  return src.replace(LINE[k], (_, a: string, _b: string, c: string) => `${a}${v}${c}`);
}
const CC1IE_LINE = "    TIM2->DIER |= TIM_DIER_CC1IE;      // compare CH1 interrupt on\n";
export function setCompareIrq(src: string, on: boolean): string {
  const has = src.includes(CC1IE_LINE);
  if (on && !has) return src.replace(/( {4}TIM2->DIER \|= TIM_DIER_UIE;.*\n)/, `$1${CC1IE_LINE}`);
  if (!on && has) return src.replace(CC1IE_LINE, "");
  return src;
}

export type P19 = { noClock: boolean; halfClock: boolean };
export const P19_DEFAULT: P19 = { noClock: false, halfClock: false };

/** Piecewise-linear history of CNT: each entry starts a segment at time t from cnt0 at rate f (0 while stopped). */
export interface Seg19 { t: number; cnt0: number; f: number; arr: number }
interface Bench19 {
  hist: Seg19[];
  updates: number[];
  compares: number[];
  seenUpdates: number;
  seenCompares: number;
  last: { psc: number; arr: number; cen: boolean; cnt: number };
  pscPending: number | null;
  log: Array<{ t: number; text: string }>;
}
const BENCH = new WeakMap<Mcu, Bench19>();
export function bench19(m: Mcu): Bench19 {
  let b = BENCH.get(m);
  if (!b) { b = { hist: [], updates: [], compares: [], seenUpdates: 0, seenCompares: 0, last: { psc: -1, arr: -1, cen: false, cnt: 0 }, pscPending: null, log: [] }; BENCH.set(m, b); }
  return b;
}
const push = <T,>(a: T[], v: T, max: number) => { a.push(v); if (a.length > max) a.splice(0, a.length - max); };
const logEv = (b: Bench19, t: number, text: string) => push(b.log, { t, text }, 40);

export function setup19(m: Mcu, p: P19) {
  if (p.noClock) m.gateStuck.add("TIM2");
  m.timerClockOf = (tim) => (tim === "TIM2" && p.halfClock ? CLK19 / 2 : undefined);
}

export const timerHz = (m: Mcu) => m.timerClock("TIM2") / (m.peek("TIM2.PSC") + 1);
export const overflowS = (m: Mcu) => (m.peek("TIM2.ARR") + 1) / timerHz(m);

function mark(m: Mcu, b: Bench19, t: number) {
  const cen = (m.peek("TIM2.CR1") & 1) === 1;
  push(b.hist, { t, cnt0: m.timerRun("TIM2").cnt, f: cen ? timerHz(m) : 0, arr: m.peek("TIM2.ARR") }, 4000);
}

export function world19(m: Mcu, _dt: number, _p: P19) {
  const b = bench19(m);
  const run = m.timerRun("TIM2");
  if (run.updates > b.seenUpdates) {
    const n = run.updates - b.seenUpdates;
    b.seenUpdates = run.updates;
    if (b.pscPending !== null) { m.write("TIM2.PSC", b.pscPending); logEv(b, run.lastUpdate, `PSC preload → ${b.pscPending} took effect`); b.pscPending = null; }
    for (let k = 0; k < Math.min(n, 8); k++) push(b.updates, run.lastUpdate, 400);
    logEv(b, run.lastUpdate, `Update event #${run.updates} (CNT ${m.peek("TIM2.ARR")} → 0)`);
    push(b.hist, { t: run.lastUpdate, cnt0: 0, f: (m.peek("TIM2.CR1") & 1) ? timerHz(m) : 0, arr: m.peek("TIM2.ARR") }, 4000);
  }
  const comp = m.fw?.num("compare_count") ?? 0;
  if (comp > b.seenCompares) {
    b.seenCompares = comp;
    push(b.compares, m.time, 400);
    logEv(b, m.time, `Compare CH1 match #${comp} (CNT = CCR1 = ${m.peek("TIM2.CCR1")})`);
  }
  const now = { psc: m.peek("TIM2.PSC"), arr: m.peek("TIM2.ARR"), cen: (m.peek("TIM2.CR1") & 1) === 1, cnt: m.peek("TIM2.CNT") };
  if (now.cen !== b.last.cen) logEv(b, m.time, now.cen ? "CEN = 1: counter started" : "CEN = 0: counter stopped");
  if (now.psc !== b.last.psc || now.arr !== b.last.arr || now.cen !== b.last.cen) mark(m, b, m.time);
  b.last = now;
}

/** CNT at time t reconstructed from the history (exact between events, independent of the 1 ms world step). */
export function cntAt(b: Bench19, t: number): number {
  const h = b.hist;
  let lo = 0, hi = h.length - 1, k = -1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (h[mid]!.t <= t) { k = mid; lo = mid + 1; } else hi = mid - 1; }
  if (k < 0) return 0;
  const s = h[k]!;
  return Math.min(s.arr, s.cnt0 + (t - s.t) * s.f);
}

/** Live-edit the prescaler like a debugger: PSC is preloaded and only takes effect at the next update event. */
export function writePsc(m: Mcu, v: number) {
  const b = bench19(m);
  b.pscPending = Math.max(0, Math.min(0xffff, Math.round(v)));
  logEv(b, m.time, `PSC preload written: ${b.pscPending} (waits for the next update)`);
}
/** ARR without ARPE takes effect at once. */
export function writeArr(m: Mcu, v: number) {
  const b = bench19(m);
  const arr = Math.max(1, Math.round(v));
  const overrun = m.peek("TIM2.CNT") > arr;
  m.write("TIM2.ARR", arr);
  mark(m, b, m.time);
  logEv(b, m.time, overrun ? `ARR → ${arr} below CNT: real TIM2 would count on to 0xFFFFFFFF before wrapping` : `ARR → ${arr} (no ARPE: immediate)`);
  return overrun;
}
export function writeCcr(m: Mcu, v: number) { m.write("TIM2.CCR1", Math.max(0, Math.round(v))); logEv(bench19(m), m.time, `CCR1 → ${Math.round(v)}`); }
export function setCompare(m: Mcu, on: boolean) { const d = m.peek("TIM2.DIER"); m.write("TIM2.DIER", on ? d | 2 : d & ~2); logEv(bench19(m), m.time, `CC1IE = ${on ? 1 : 0}`); }
export function start(m: Mcu, on: boolean) { const c = m.peek("TIM2.CR1"); m.write("TIM2.CR1", on ? c | 1 : c & ~1); }
export function resetCnt(m: Mcu) {
  const b = bench19(m);
  if (b.pscPending !== null) { m.write("TIM2.PSC", b.pscPending); b.pscPending = null; }
  m.write("TIM2.EGR", 1);
  mark(m, b, m.time);
  logEv(b, m.time, "EGR.UG: CNT = 0, preloads loaded");
}

/** Mean of the last few overflow intervals, or null until two updates have been seen. */
export function measuredPeriod(b: Bench19): number | null {
  const u = b.updates;
  if (u.length < 3) return null;
  const k = Math.min(4, u.length - 1);
  return (u[u.length - 1]! - u[u.length - 1 - k]!) / k;
}
