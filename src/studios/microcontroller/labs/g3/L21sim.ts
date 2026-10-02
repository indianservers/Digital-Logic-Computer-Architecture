import type { Mcu } from "../core/mcu";

export const CLK21 = 72e6;

export const DEMO = `/*
 * Lab 21: PWM Generator
 * Generate a PWM signal with the STM32 HAL and control LED brightness
 */
#include "main.h"

TIM_HandleTypeDef htim1;
TIM_OC_InitTypeDef sConfigOC;
GPIO_InitTypeDef g;

static void MX_GPIO_Init(void)
{
    __HAL_RCC_GPIOA_CLK_ENABLE();
    g.Pin = GPIO_PIN_8 | GPIO_PIN_9;          // PA8 = TIM1_CH1, PA9 = TIM1_CH2
    g.Mode = GPIO_MODE_AF_PP;
    g.Speed = GPIO_SPEED_FREQ_HIGH;
    HAL_GPIO_Init(GPIOA, &g);
}

static void MX_TIM1_Init(void)
{
    __HAL_RCC_TIM1_CLK_ENABLE();
    htim1.Instance = TIM1;
    htim1.Init.Prescaler = 71;               // 72 MHz / (71 + 1) = 1 MHz timer clock
    htim1.Init.CounterMode = TIM_COUNTERMODE_UP;
    htim1.Init.Period = 999;                 // 1 MHz / (999 + 1) = 1 kHz PWM
    HAL_TIM_PWM_Init(&htim1);

    sConfigOC.OCPolarity = TIM_OCPOLARITY_HIGH;
    sConfigOC.OCMode = TIM_OCMODE_PWM1;      // CH1 mode
    sConfigOC.Pulse = 500;                   // CH1 duty
    HAL_TIM_PWM_ConfigChannel(&htim1, &sConfigOC, TIM_CHANNEL_1);
    sConfigOC.OCMode = TIM_OCMODE_PWM1;      // CH2 mode
    sConfigOC.Pulse = 250;                   // CH2 duty
    HAL_TIM_PWM_ConfigChannel(&htim1, &sConfigOC, TIM_CHANNEL_2);
}

int main(void)
{
    HAL_Init();
    SystemClock_Config();
    MX_GPIO_Init();
    MX_TIM1_Init();

    /* Start PWM on channel 1 */
    HAL_TIM_PWM_Start(&htim1, TIM_CHANNEL_1);
    // HAL_TIM_PWM_Start(&htim1, TIM_CHANNEL_2);   // CH2 on PA9

    while (1)
    {
    }
}
`;

export const BREATHING = DEMO.replace(
  "    while (1)\n    {\n    }\n",
  `    int duty = 0;
    int step = 10;
    while (1)
    {
        __HAL_TIM_SET_COMPARE(&htim1, TIM_CHANNEL_1, duty);   // breathing LED
        duty += step;
        if (duty >= 1000 || duty <= 0) step = -step;
        HAL_Delay(10);
    }
`);
export const ARR_BUG = DEMO.replace("    htim1.Init.Period = 999;                 // 1 MHz / (999 + 1) = 1 kHz PWM", "    htim1.Init.Period = 1000;                // BUG: should be 1000 - 1");
export const CCR_BUG = DEMO.replace("    sConfigOC.Pulse = 500;                   // CH1 duty", "    sConfigOC.Pulse = 1200;                  // CH1 duty  BUG: larger than ARR");

const RE = {
  psc: /^( {4}htim1\.Init\.Prescaler = )(\d+)(;.*)$/m,
  arr: /^( {4}htim1\.Init\.Period = )(\d+)(;.*)$/m,
  ccr1: /^( {4}sConfigOC\.Pulse = )(\d+)(;\s*\/\/ CH1 duty.*)$/m,
  ccr2: /^( {4}sConfigOC\.Pulse = )(\d+)(;\s*\/\/ CH2 duty.*)$/m,
  mode1: /^( {4}sConfigOC\.OCMode = TIM_OCMODE_PWM)([12])(;\s*\/\/ CH1 mode.*)$/m,
  mode2: /^( {4}sConfigOC\.OCMode = TIM_OCMODE_PWM)([12])(;\s*\/\/ CH2 mode.*)$/m,
};
const EN_RE = { 1: /^( {4})(\/\/ )?(HAL_TIM_PWM_Start\(&htim1, TIM_CHANNEL_1\);.*)$/m, 2: /^( {4})(\/\/ )?(HAL_TIM_PWM_Start\(&htim1, TIM_CHANNEL_2\);.*)$/m } as const;

export interface Code21 { psc: number | null; arr: number | null; ccr1: number | null; ccr2: number | null; mode1: number | null; mode2: number | null; en1: boolean | null; en2: boolean | null }
export function codeConfig(src: string): Code21 {
  const n = (re: RegExp) => { const m = re.exec(src); return m ? Number(m[2]) : null; };
  const en = (re: RegExp) => { const m = re.exec(src); return m ? !m[2] : null; };
  return { psc: n(RE.psc), arr: n(RE.arr), ccr1: n(RE.ccr1), ccr2: n(RE.ccr2), mode1: n(RE.mode1), mode2: n(RE.mode2), en1: en(EN_RE[1]), en2: en(EN_RE[2]) };
}
/** Rewrite the HAL init lines to match the given values. Missing lines are left alone. */
export function applyConfig(src: string, c: Partial<Code21>): string {
  let out = src;
  for (const k of ["psc", "arr", "ccr1", "ccr2", "mode1", "mode2"] as const) {
    const v = c[k];
    if (v === undefined || v === null) continue;
    out = out.replace(RE[k], (_, a: string, _b: string, rest: string) => `${a}${v}${rest}`);
  }
  for (const ch of [1, 2] as const) {
    const v = c[ch === 1 ? "en1" : "en2"];
    if (v === undefined || v === null) continue;
    out = out.replace(EN_RE[ch], (_, ind: string, _c: string, call: string) => `${ind}${v ? "" : "// "}${call}`);
  }
  const now = codeConfig(out);
  if (now.psc !== null) {
    const tick = CLK21 / (now.psc + 1);
    const arr = now.arr;
    out = out.replace(/^( {4}htim1\.Init\.Prescaler = \d+;\s*\/\/ )72 MHz \/ \(\d+ \+ 1\) = .* timer clock$/m, (_, head: string) => `${head}72 MHz / (${now.psc} + 1) = ${hz(tick)} timer clock`);
    if (arr !== null) out = out.replace(/^( {4}htim1\.Init\.Period = \d+;\s*\/\/ ).* \/ \(\d+ \+ 1\) = .* PWM$/m, (_, head: string) => `${head}${hz(tick)} / (${arr} + 1) = ${hz(tick / (arr + 1))} PWM`);
  }
  return out;
}
const hz = (f: number) => {
  const [v, u] = f >= 1e6 ? [f / 1e6, "MHz"] : f >= 1e3 ? [f / 1e3, "kHz"] : [f, "Hz"];
  return `${Number(v.toFixed(3))} ${u}`;
};

export type P21 = { halfClock: boolean; polarity: boolean };
export const P21_DEFAULT: P21 = { halfClock: false, polarity: false };

export function setup21(m: Mcu, p: P21) {
  m.timerClockOf = (tim) => (tim === "TIM1" && p.halfClock ? CLK21 / 2 : undefined);
}
const POL = new WeakMap<Mcu, boolean>();
/** Fault: CC1P stuck at 1 (output polarity inverted) while the fault is active. */
export function world21(m: Mcu, _dt: number, p: P21) {
  const was = POL.get(m) ?? false;
  if (p.polarity) m.write("TIM1.CCER", m.peek("TIM1.CCER") | 2);
  else if (was) m.write("TIM1.CCER", m.peek("TIM1.CCER") & ~2);
  POL.set(m, p.polarity);
}

export interface Chan21 { enabled: boolean; mode: number; ccr: number; inverted: boolean; freq: number; duty: number; period: number; pulse: number }
/** What a scope on the channel pin would show, derived from the TIM1 registers. */
export function channel(m: Mcu, ch: 1 | 2): Chan21 {
  const psc = m.peek("TIM1.PSC"), arr = m.peek("TIM1.ARR");
  const ccer = m.peek("TIM1.CCER"), cen = (m.peek("TIM1.CR1") & 1) === 1;
  const mode = (m.peek("TIM1.CCMR1") >> (ch === 1 ? 4 : 12)) & 7;
  const ccr = m.peek(`TIM1.CCR${ch}`);
  const enabled = cen && ((ccer >> ((ch - 1) * 4)) & 1) === 1 && (mode === 6 || mode === 7);
  const inverted = ((ccer >> ((ch - 1) * 4 + 1)) & 1) === 1;
  const freq = m.timerClock("TIM1") / (psc + 1) / (arr + 1);
  let duty = Math.max(0, Math.min(1, ccr / (arr + 1)));
  if (mode === 7) duty = 1 - duty;
  if (inverted) duty = 1 - duty;
  if (!enabled) duty = 0;
  return { enabled, mode: mode === 7 ? 2 : 1, ccr, inverted, freq, duty, period: 1 / freq, pulse: duty / freq };
}

/** Live register writes, like __HAL_TIM_SET_COMPARE / SET_AUTORELOAD / SET_PRESCALER at run time. */
export function setDuty(m: Mcu, ch: 1 | 2, pct: number) { const arr = m.peek("TIM1.ARR"); m.write(`TIM1.CCR${ch}`, Math.round(Math.max(0, Math.min(100, pct)) / 100 * (arr + 1))); }
export function setFreq(m: Mcu, hz: number) {
  const fTim = m.timerClock("TIM1") / (m.peek("TIM1.PSC") + 1);
  const dutyPct = [1, 2].map((c) => m.peek(`TIM1.CCR${c}`) / (m.peek("TIM1.ARR") + 1) * 100);
  const arr = Math.max(1, Math.min(0xffff, Math.round(fTim / Math.max(1, hz)) - 1));
  m.write("TIM1.ARR", arr);
  setDuty(m, 1, dutyPct[0]!); setDuty(m, 2, dutyPct[1]!);
}
export function setPsc(m: Mcu, v: number) { m.write("TIM1.PSC", Math.max(0, Math.min(0xffff, Math.round(v)))); }
export function setArr(m: Mcu, v: number) { m.write("TIM1.ARR", Math.max(1, Math.min(0xffff, Math.round(v)))); }
export function setMode(m: Mcu, ch: 1 | 2, mode: 1 | 2) {
  const sh = ch === 1 ? 4 : 12;
  m.write("TIM1.CCMR1", (m.peek("TIM1.CCMR1") & ~(7 << sh)) | ((mode === 2 ? 7 : 6) << sh));
}
export function setEnabled(m: Mcu, ch: 1 | 2, on: boolean) {
  const bit = 1 << ((ch - 1) * 4);
  if (on) {
    const sh = ch === 1 ? 4 : 12;
    if (((m.peek("TIM1.CCMR1") >> sh) & 7) < 6) setMode(m, ch, 1);
    m.write("TIM1.CR1", m.peek("TIM1.CR1") | 1);
  }
  m.write("TIM1.CCER", on ? m.peek("TIM1.CCER") | bit : m.peek("TIM1.CCER") & ~bit);
}

/** Registers as a code snapshot, for the "write into code" prompt. */
export function liveConfig(m: Mcu): Code21 {
  const c1 = channel(m, 1), c2 = channel(m, 2);
  const ccer = m.peek("TIM1.CCER");
  return { psc: m.peek("TIM1.PSC"), arr: m.peek("TIM1.ARR"), ccr1: c1.ccr, ccr2: c2.ccr, mode1: c1.mode, mode2: c2.mode, en1: (ccer & 1) === 1, en2: (ccer & 0x10) === 0x10 };
}
