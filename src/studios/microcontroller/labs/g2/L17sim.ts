import type { Mcu } from "../core/mcu";
import { rng } from "./Bench";
import { breakdown, CORE_HZ, CYC_PER_STMT, ENTRY_CYC, state16, trackIrqs, trackRequests, type IrqEvent } from "./L16sim";

export const DEMO = `#include "stm32f4xx.h"

#define DEBOUNCE_MS 20

volatile uint32_t event_count = 0;   // presses accepted by the ISR
volatile uint32_t raw_irqs = 0;      // every entry into EXTI0_IRQHandler
volatile uint8_t locked = 0;         // set by the first edge of a press
uint32_t low_since = 0;

void EXTI0_IRQHandler(void)
{
    EXTI->PR = EXTI_PR_PR0;            // clear pending: write 1 to clear
    raw_irqs++;
    if (!locked)
    {
        locked = 1;                    // ignore the rest of this press
        event_count++;
        GPIOA->ODR ^= (1 << 5);        // toggle LD2
    }
}

int main(void)
{
    RCC->AHB1ENR |= RCC_AHB1ENR_GPIOAEN | RCC_AHB1ENR_GPIOBEN;
    RCC->APB2ENR |= RCC_APB2ENR_SYSCFGEN;
    GPIOA->MODER |= (1 << (5*2));      // PA5 LED output
    GPIOA->PUPDR |= (2 << (0*2));      // PA0 pull-down, SW1 to 3V3
    GPIOB->PUPDR |= (2 << (0*2));      // PB0 pull-down, SW2 to 3V3

    SYSCFG->EXTICR[0] = (SYSCFG->EXTICR[0] & ~0xF) | 0;   // EXTI0 <- PA0
    EXTI->RTSR |= EXTI_RTSR_TR0;       // rising edge
    EXTI->FTSR &= ~EXTI_FTSR_TR0;      // falling edge off
    EXTI->IMR |= EXTI_IMR_MR0;         // line 0 unmasked
    NVIC_EnableIRQ(EXTI0_IRQn);

    while (1)
    {
        // Unlock only after the input has been low and quiet for DEBOUNCE_MS,
        // so release bounce cannot count as a new press.
        if (locked && !(GPIOA->IDR & 1))
        {
            if (HAL_GetTick() - low_since >= DEBOUNCE_MS) locked = 0;
        }
        else low_since = HAL_GetTick();
    }
}
`;

export const NO_DEBOUNCE = DEMO
  .replace("    if (!locked)\n    {\n        locked = 1;                    // ignore the rest of this press\n        event_count++;\n        GPIOA->ODR ^= (1 << 5);        // toggle LD2\n    }\n", "    event_count++;                     // every bounce counts\n    GPIOA->ODR ^= (1 << 5);\n");

export const NO_PR_CLEAR = DEMO.replace("    EXTI->PR = EXTI_PR_PR0;            // clear pending: write 1 to clear\n", "    // BUG: EXTI->PR is never cleared\n");

export const HAL_DEMO = `#include "stm32f4xx_hal.h"

#define DEBOUNCE_MS 20

volatile uint32_t event_count = 0;
volatile uint32_t raw_irqs = 0;
volatile uint8_t locked = 0;
uint32_t low_since = 0;

void HAL_GPIO_EXTI_Callback(uint16_t pin)
{
    if (pin != GPIO_PIN_0) return;
    raw_irqs++;
    if (!locked)
    {
        locked = 1;
        event_count++;
        HAL_GPIO_TogglePin(GPIOA, GPIO_PIN_5);
    }
}

int main(void)
{
    HAL_Init();
    __HAL_RCC_GPIOA_CLK_ENABLE();
    __HAL_RCC_SYSCFG_CLK_ENABLE();

    GPIO_InitTypeDef g = {0};
    g.Pin = GPIO_PIN_5;
    g.Mode = GPIO_MODE_OUTPUT_PP;
    HAL_GPIO_Init(GPIOA, &g);

    g.Pin = GPIO_PIN_0;
    g.Mode = GPIO_MODE_IT_RISING;      // try GPIO_MODE_IT_FALLING
    g.Pull = GPIO_PULLDOWN;
    HAL_GPIO_Init(GPIOA, &g);

    HAL_NVIC_SetPriority(EXTI0_IRQn, 2, 0);
    HAL_NVIC_EnableIRQ(EXTI0_IRQn);

    while (1)
    {
        if (locked && !HAL_GPIO_ReadPin(GPIOA, GPIO_PIN_0))
        {
            if (HAL_GetTick() - low_since >= DEBOUNCE_MS) locked = 0;
        }
        else low_since = HAL_GetTick();
    }
}
`;

export type Trigger = "rising" | "falling" | "both";
const RE = {
  exticr: /^ {4}SYSCFG->EXTICR\[0\].*$/m,
  rtsr: /^ {4}EXTI->RTSR.*$/m,
  ftsr: /^ {4}EXTI->FTSR.*$/m,
  imr: /^ {4}EXTI->IMR.*$/m,
  deb: /#define\s+DEBOUNCE_MS\s+\d+/,
};
/** Rewrite the EXTI configuration lines of the register example. Returns null when the lines are not present. */
export function applyConfig(src: string, c: { port?: 0 | 1; trigger?: Trigger; mask?: boolean; debounce?: number }): string | null {
  let out = src;
  const need = (re: RegExp) => re.test(out);
  if (c.port !== undefined) { if (!need(RE.exticr)) return null; out = out.replace(RE.exticr, `    SYSCFG->EXTICR[0] = (SYSCFG->EXTICR[0] & ~0xF) | ${c.port};   // EXTI0 <- P${"AB"[c.port]}0`); }
  if (c.trigger !== undefined) {
    if (!need(RE.rtsr) || !need(RE.ftsr)) return null;
    const r = c.trigger !== "falling", f = c.trigger !== "rising";
    out = out.replace(RE.rtsr, r ? "    EXTI->RTSR |= EXTI_RTSR_TR0;       // rising edge" : "    EXTI->RTSR &= ~EXTI_RTSR_TR0;      // rising edge off");
    out = out.replace(RE.ftsr, f ? "    EXTI->FTSR |= EXTI_FTSR_TR0;       // falling edge" : "    EXTI->FTSR &= ~EXTI_FTSR_TR0;      // falling edge off");
  }
  if (c.mask !== undefined) { if (!need(RE.imr)) return null; out = out.replace(RE.imr, c.mask ? "    EXTI->IMR |= EXTI_IMR_MR0;         // line 0 unmasked" : "    EXTI->IMR &= ~EXTI_IMR_MR0;        // line 0 masked"); }
  if (c.debounce !== undefined) { if (!need(RE.deb)) return null; out = out.replace(RE.deb, `#define DEBOUNCE_MS ${Math.max(0, Math.min(200, Math.round(c.debounce)))}`); }
  return out;
}
/** What the source asks for, read from the same lines `applyConfig` rewrites (or the HAL GPIO mode). */
export function codeConfig(src: string): { port: 0 | 1 | null; trigger: Trigger | "none" | null; mask: boolean | null; editable: boolean } {
  const ex = RE.exticr.exec(src)?.[0], rt = RE.rtsr.exec(src)?.[0], ft = RE.ftsr.exec(src)?.[0], im = RE.imr.exec(src)?.[0];
  if (ex && rt && ft && im) {
    const port = /\|\s*([01])\s*;/.exec(ex)?.[1];
    const r = rt.includes("|="), f = ft.includes("|=");
    return { port: port === undefined ? null : (Number(port) as 0 | 1), trigger: r && f ? "both" : r ? "rising" : f ? "falling" : "none", mask: im.includes("|="), editable: true };
  }
  const hal = /GPIO_MODE_IT_(RISING_FALLING|RISING|FALLING)/.exec(src)?.[1];
  return { port: hal ? 0 : null, trigger: hal === "RISING_FALLING" ? "both" : hal === "RISING" ? "rising" : hal === "FALLING" ? "falling" : null, mask: hal ? true : null, editable: false };
}
export const debounceOf = (src: string) => Number(/#define\s+DEBOUNCE_MS\s+(\d+)/.exec(src)?.[1] ?? NaN);

export function liveConfig(m: Mcu) {
  const r = m.peek("EXTI.RTSR") & 1, f = m.peek("EXTI.FTSR") & 1;
  return {
    port: m.peek("SYSCFG.EXTICR1") & 0xf,
    trigger: (r && f ? "both" : r ? "rising" : f ? "falling" : "none") as Trigger | "none",
    mask: (m.peek("EXTI.IMR") & 1) === 1,
    pending: (m.peek("EXTI.PR") & 1) === 1,
  };
}

export type P17 = { sw1: boolean; sw2: boolean; bounce: number; floating: boolean; syscfgOff: boolean };
export const P17_DEFAULT: P17 = { sw1: false, sw2: false, bounce: 6, floating: false, syscfgOff: false };
type Edge = [number, number];
/** `tapUntil`: simulated time until which a tapped switch is held closed. */
interface Bench17 { r: () => number; last: [boolean, boolean]; physical: number; pressT: number; burstEnd: number; noise: Edge[]; tapUntil: [number, number]; noisy: number }
const BENCH = new WeakMap<Mcu, Bench17>();
export function bench17(m: Mcu): Bench17 {
  let b = BENCH.get(m);
  if (!b) { b = { r: rng(0x0e171), last: [false, false], physical: 0, pressT: -1, burstEnd: 0, noise: [], tapUntil: [-1, -1], noisy: 0 }; BENCH.set(m, b); }
  return b;
}
/** Press and release a switch for `hold` seconds of simulated time. */
export function tap(m: Mcu, which: 0 | 1, hold = 0.12) { bench17(m).tapUntil[which] = m.time + hold; }

export function setup17(m: Mcu, p: P17) {
  trackRequests(m);
  if (p.syscfgOff) m.gateStuck.add("SYSCFG");
}

/** SW1 closes PA0 to 3V3 through bouncing contacts: the pin alternates between driven high and released for `ms`. */
function burst(m: Mcu, b: Bench17, pressed: boolean, ms: number) {
  const settled = pressed ? 1 : null, open = pressed ? null : 1;
  if (ms <= 0) { m.setInput("PA0", settled); return; }
  const n = 2 * Math.max(1, Math.round(ms * (0.35 + b.r() * 0.3))) + 1;
  const ts = Array.from({ length: n }, () => b.r()).sort((a, c) => a - c);
  ts[0] = 0; ts[n - 1] = 1;
  ts.forEach((u, i) => m.schedule(m.time + u * ms / 1000, () => m.setInput("PA0", i % 2 === 0 ? settled : open)));
  b.burstEnd = m.time + ms / 1000;
}

/** A bumped or dirty contact: a train of short glitches on PA0 without a real press. */
export function noisyContact(m: Mcu) {
  const b = bench17(m);
  const n = 8 + Math.floor(b.r() * 6);
  for (let i = 0; i < n; i++) {
    const t = m.time + (i / n) * 0.008 + b.r() * 0.0004;
    m.schedule(t, () => { if (!b.last[0]) m.setInput("PA0", 1); });
    m.schedule(t + 0.00008 + b.r() * 0.0002, () => { if (!b.last[0]) m.setInput("PA0", null); });
  }
  b.pressT = m.time;
  b.noisy++;
}

export function world17(m: Mcu, dt: number, p: P17) {
  trackIrqs(m);
  const b = bench17(m);
  if (p.floating && m.peek("GPIOA.PUPDR") & 3) m.write("GPIOA.PUPDR", m.peek("GPIOA.PUPDR") & ~3);
  const sw1 = p.sw1 || m.time < b.tapUntil[0], sw2 = p.sw2 || m.time < b.tapUntil[1];
  if (sw1 !== b.last[0]) {
    b.last[0] = sw1;
    if (sw1) b.physical++;
    b.pressT = m.time;
    burst(m, b, sw1, p.bounce);
  } else if (!sw1 && p.floating && m.isFloating("PA0") && m.time > b.burstEnd && b.r() < dt * 4) {
    // An unterminated input picks up mains hum and crosstalk: occasional spikes above VIH.
    m.setInput("PA0", 1);
    m.schedule(m.time + 0.00005 + b.r() * 0.0003, () => { if (!b.last[0]) m.setInput("PA0", null); });
  }
  if (sw2 !== b.last[1]) { b.last[1] = sw2; if (sw2) b.physical++; b.pressT = m.time; m.setInput("PB0", sw2 ? 1 : null); }
}

export interface Timing { latencyUs: number; isrUs: number; isrCyc: number }
export function timingOf(e: IrqEvent | undefined): Timing | undefined {
  if (!e) return undefined;
  const isrCyc = e.stmts * CYC_PER_STMT;
  return { latencyUs: breakdown(e).heldUs + (ENTRY_CYC / CORE_HZ) * 1e6, isrUs: (isrCyc / CORE_HZ) * 1e6, isrCyc };
}
export const extiEvents = (m: Mcu) => state16(m).events.filter((e) => e.name === "EXTI0_IRQHandler" || e.name === "HAL_GPIO_EXTI_Callback");
