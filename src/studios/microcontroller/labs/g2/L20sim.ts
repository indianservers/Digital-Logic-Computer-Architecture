import type { Mcu } from "../core/mcu";

export const CLK20 = 80e6;

export const DEMO = `#include "stm32f4xx.h"
// SYSCLK 80 MHz; APB1 40 MHz, so TIM3 is clocked at 2 x 40 = 80 MHz
#define TICK_NS 100                     // must match PSC below

volatile uint32_t rise_ccr = 0;
volatile uint32_t fall_ccr = 0;
volatile uint32_t prev_rise = 0;
volatile uint32_t pulse_ticks = 0;
volatile uint32_t period_ticks = 0;
volatile uint32_t pulse_us = 0;
volatile uint32_t captures = 0;
volatile uint32_t compare_events = 0;

void TIM3_IRQHandler(void)
{
    if (TIM3->SR & TIM_SR_CC1IF)            // CH1 latched CNT into CCR1
    {
        TIM3->SR = ~TIM_SR_CC1IF;
        uint32_t ccr = TIM3->CCR1;
        if (GPIOA->IDR & (1 << 6))          // pin is high now: that was a rising edge
        {
            period_ticks = (ccr - prev_rise) & 0xFFFF;
            prev_rise = ccr;
            rise_ccr = ccr;
        }
        else
        {
            fall_ccr = ccr;
            pulse_ticks = (fall_ccr - rise_ccr) & 0xFFFF;
            pulse_us = pulse_ticks * TICK_NS / 1000;
        }
        captures++;
    }
    if (TIM3->SR & TIM_SR_CC2IF)            // CNT reached CCR2
    {
        TIM3->SR = ~TIM_SR_CC2IF;
        compare_events++;
    }
}

int main(void)
{
    RCC->AHB1ENR |= RCC_AHB1ENR_GPIOAEN;
    RCC->APB1ENR |= RCC_APB1ENR_TIM3EN;
    GPIOA->MODER |= (2 << (6*2)) | (2 << (7*2));   // PA6, PA7 alternate function
    GPIOA->AFR[0] |= (2 << (6*4)) | (2 << (7*4));  // AF2 = TIM3_CH1, TIM3_CH2

    TIM3->PSC = 7;                          // 80 MHz / (7 + 1) = 10 MHz tick
    TIM3->ARR = 0xFFFF;                     // free-running 16-bit counter
    TIM3->CCMR1 = TIM_CCMR1_CC1S_0          // CC1S = 01: CH1 is an input on TI1
                | (3 << 12);                // OC2M = 011: CH2 toggles on match
    TIM3->CCER = TIM_CCER_CC1E | TIM_CCER_CC1P | TIM_CCER_CC1NP   // capture rising + falling
               | TIM_CCER_CC2E;             // CH2 drives PA7
    TIM3->CCR2 = 35000;                     // compare point in each counter cycle
    TIM3->DIER = TIM_DIER_CC1IE | TIM_DIER_CC2IE;
    TIM3->CR1 |= TIM_CR1_CEN;
    NVIC_EnableIRQ(TIM3_IRQn);

    while (1)
    {
    }
}
`;

export type Edge20 = "rising" | "falling" | "both" | "off";
const CCER_RE = /^( {4}TIM3->CCER = ).*$/m;
const CCER_LINE: Record<Edge20, string> = {
  rising: "TIM_CCER_CC1E                                  // capture rising edges",
  falling: "TIM_CCER_CC1E | TIM_CCER_CC1P                  // capture falling edges",
  both: "TIM_CCER_CC1E | TIM_CCER_CC1P | TIM_CCER_CC1NP   // capture rising + falling",
  off: "0                                              // CH1 capture disabled",
};
const OC2M_RE = /^( {16}\| \()(\d)( << 12\);\s*\/\/ ).*$/m;
const OC2M_TEXT: Record<number, string> = { 3: "OC2M = 011: CH2 toggles on match", 0: "OC2M = 000: frozen, compare only raises CC2IF" };
const PSC_RE = /^( {4}TIM3->PSC = )(\d+)(;\s*\/\/ ).*$/m;
const TICK_RE = /^(#define TICK_NS )(\d+)(.*)$/m;
const CCR2_RE = /^( {4}TIM3->CCR2 = )(\d+)(;.*)$/m;

export const RISING_ONLY = DEMO.replace(CCER_RE, (_, a: string) => a + CCER_LINE.rising);
export const NO_WRAP = DEMO
  .replace("            period_ticks = (ccr - prev_rise) & 0xFFFF;", "            period_ticks = ccr - prev_rise;     // BUG: no 16-bit wrap")
  .replace("            pulse_ticks = (fall_ccr - rise_ccr) & 0xFFFF;", "            pulse_ticks = fall_ccr - rise_ccr;  // BUG: no 16-bit wrap");
export const FROZEN = DEMO.replace(OC2M_RE, (_, a: string, _d: string, c: string) => `${a}0${c}${OC2M_TEXT[0]}`);

export interface Config20 { edge: Edge20 | null; oc2m: number | null; psc: number | null; tickNs: number | null; ccr2: number | null }
export function codeConfig(src: string): Config20 {
  const ccer = CCER_RE.exec(src)?.[0] ?? "";
  const edge: Edge20 | null = !ccer ? null : !ccer.includes("TIM_CCER_CC1E") ? "off" : ccer.includes("CC1NP") ? "both" : ccer.includes("CC1P") ? "falling" : "rising";
  const num = (re: RegExp) => { const m = re.exec(src); return m ? Number(m[2]) : null; };
  return { edge, oc2m: num(OC2M_RE), psc: num(PSC_RE), tickNs: num(TICK_RE), ccr2: num(CCR2_RE) };
}
export const TICKS: Array<{ ns: number; psc: number; label: string }> = [
  { ns: 50, psc: 3, label: "50 ns" }, { ns: 100, psc: 7, label: "100 ns" }, { ns: 1000, psc: 79, label: "1 µs" },
];
/** Rewrite the register lines behind a channel setting. Returns null when the code no longer has the line. */
export function applyConfig(src: string, c: { edge?: Edge20; oc2m?: number; tickNs?: number; ccr2?: number }): string | null {
  let out = src;
  const sub = (re: RegExp, fn: (...g: string[]) => string) => { if (!re.test(out)) return false; out = out.replace(re, fn as (s: string, ...a: string[]) => string); return true; };
  if (c.edge && !sub(CCER_RE, (_, a) => a + CCER_LINE[c.edge!])) return null;
  if (c.oc2m !== undefined && !sub(OC2M_RE, (_, a, _d, cm) => `${a}${c.oc2m}${cm}${OC2M_TEXT[c.oc2m!] ?? ""}`)) return null;
  if (c.tickNs !== undefined) {
    const t = TICKS.find((x) => x.ns === c.tickNs);
    if (!t) return null;
    if (!sub(PSC_RE, (_, a, _p, cm) => `${a}${t.psc}${cm}80 MHz / (${t.psc} + 1) = ${fmtTickHz(CLK20 / (t.psc + 1))} tick`)) return null;
    if (!sub(TICK_RE, (_, a, _n, rest) => `${a}${t.ns}${rest}`)) return null;
  }
  if (c.ccr2 !== undefined && !sub(CCR2_RE, (_, a, _v, rest) => `${a}${Math.round(c.ccr2!)}${rest}`)) return null;
  return out;
}
const fmtTickHz = (f: number) => (f >= 1e6 ? `${+(f / 1e6).toFixed(2)} MHz` : `${+(f / 1e3).toFixed(2)} kHz`);

export type P20 = { freq: number; width: number; glitch: boolean; noClock: boolean };
export const P20_DEFAULT: P20 = { freq: 244.1, width: 1.84e-3, glitch: false, noClock: false };

export interface Capture20 { t: number; ccr: number; rising: boolean }
interface Anchor { t: number; c0: number; f: number; period: number }
interface Bench20 {
  nextRise: number;
  scheduledTo: number;
  captures: Capture20[];
  seenCaptures: number;
  anchor: Anchor;
  out: Array<[number, number]>;
  outLevel: number;
  lastT: number;
  key: string;
  cycles: number;
}
const BENCH = new WeakMap<Mcu, Bench20>();
export function bench20(m: Mcu): Bench20 {
  let b = BENCH.get(m);
  if (!b) {
    b = { nextRise: 0.0004, scheduledTo: 0, captures: [], seenCaptures: 0, anchor: { t: 0, c0: 0, f: 0, period: 65536 }, out: [], outLevel: 0, lastT: 0, key: "", cycles: 0 };
    BENCH.set(m, b);
  }
  return b;
}
const push = <T,>(a: T[], v: T, max: number) => { a.push(v); if (a.length > max) a.splice(0, a.length - max); };

export function setup20(m: Mcu, p: P20) {
  if (p.noClock) m.gateStuck.add("TIM3");
  m.setInput("PA6", 0);
}

export const tickS = (m: Mcu) => (m.peek("TIM3.PSC") + 1) / m.timerClock("TIM3");

function edgeAt(m: Mcu, b: Bench20, t: number, lv: number) {
  m.schedule(t, () => {
    const run = m.timerRun("TIM3");
    const before = run.captures ?? 0;
    m.setInput("PA6", lv);
    if ((run.captures ?? 0) > before) push(b.captures, { t, ccr: m.peek("TIM3.CCR1"), rising: lv === 1 }, 400);
  });
}

/** CNT at time t from the current anchor (exact while PSC/ARR/CEN are unchanged). */
export function cntAt(b: Bench20, t: number): number {
  const a = b.anchor;
  const v = a.c0 + (t - a.t) * a.f;
  return ((v % a.period) + a.period) % a.period;
}

export function world20(m: Mcu, _dt: number, p: P20) {
  const b = bench20(m);
  const now = m.time;
  // Signal generator: schedule edges a little ahead so each one lands on its exact time.
  const horizon = now + 0.0015;
  while (b.nextRise < horizon) {
    const T = b.nextRise, period = 1 / Math.max(1, p.freq);
    const w = Math.min(Math.max(2e-6, p.width), period - 2e-6);
    edgeAt(m, b, T, 1);
    if (p.glitch && w > 20e-6) { edgeAt(m, b, T + w * 0.45, 0); edgeAt(m, b, T + w * 0.45 + 1.5e-6, 1); }
    edgeAt(m, b, T + w, 0);
    b.nextRise = T + period;
    b.cycles++;
  }

  // CNT anchor: re-anchor when the timer configuration changes or CNT is written.
  const cen = (m.peek("TIM3.CR1") & 1) === 1;
  const f = cen ? m.timerClock("TIM3") / (m.peek("TIM3.PSC") + 1) : 0;
  const period = m.peek("TIM3.ARR") + 1;
  const run = m.timerRun("TIM3");
  const key = `${f}|${period}`;
  if (key !== b.key || Math.abs(cntAt(b, now) - run.cnt) > 2 && Math.abs(cntAt(b, now) - run.cnt) < period - 2) {
    b.anchor = { t: now, c0: run.cnt, f, period };
    b.key = key;
  }

  // CH2 output compare in toggle mode: every CNT crossing of CCR2 flips PA7.
  const oc2m = (m.peek("TIM3.CCMR1") >> 12) & 7;
  const ccr2 = m.peek("TIM3.CCR2");
  const driving = cen && ((m.peek("TIM3.CCER") >> 4) & 1) === 1 && !m.ccInput("TIM3", 2) && oc2m === 3 && ccr2 < period && f > 0;
  if (driving) {
    const a = b.anchor;
    let j = Math.ceil(((b.lastT - a.t) * a.f + a.c0 - ccr2) / period - 1e-9);
    for (let k = 0; k < 64; k++, j++) {
      const t = a.t + (ccr2 + j * period - a.c0) / a.f;
      if (t <= b.lastT + 1e-12) continue;
      if (t > now + 1e-12) break;
      b.outLevel ^= 1;
      push(b.out, [t, b.outLevel], 2000);
    }
  }
  b.lastT = now;
}

export interface Readout20 { pulseS: number | null; freqHz: number | null; compareS: number | null; tickNs: number }
/** What the firmware has measured, converted with the TICK_NS it believes in. */
export function readout(m: Mcu, tickNs: number): Readout20 {
  const fw = m.fw;
  const pulse = fw?.num("pulse_ticks") ?? 0, per = fw?.num("period_ticks") ?? 0;
  const ccr2 = m.peek("TIM3.CCR2");
  return {
    pulseS: pulse ? (pulse * tickNs) / 1e9 : null,
    freqHz: per ? 1e9 / (per * tickNs) : null,
    compareS: (ccr2 * tickNs) / 1e9,
    tickNs,
  };
}

/** Last rising/falling capture pair from the bench log. */
export function lastPair(b: Bench20): { rise?: Capture20; fall?: Capture20 } {
  const c = b.captures;
  let fall: Capture20 | undefined, rise: Capture20 | undefined;
  for (let i = c.length - 1; i >= 0; i--) {
    const e = c[i]!;
    if (!fall && !e.rising) fall = e;
    else if (fall && e.rising && e.t < fall.t) { rise = e; break; }
  }
  return { rise, fall };
}

/** Live debugger write to CCR2 (compare register, no preload in this lab). */
export function writeCcr2(m: Mcu, v: number) { m.write("TIM3.CCR2", Math.max(0, Math.min(0xffff, Math.round(v)))); }
