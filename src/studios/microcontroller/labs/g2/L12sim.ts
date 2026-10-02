import type { Mcu } from "../core/mcu";
import { rng } from "./Bench";

const HEAD = `#include "stm32f4xx_hal.h"

#define DEBOUNCE_MS 20

uint32_t rawEdges = 0;     // every level change seen on PA0
uint32_t presses = 0;      // presses accepted by the firmware
int stable = 1;            // debounced level (pull-up: idle = 1)
int lastRaw = 1;
`;
const INIT = `
    HAL_Init();
    __HAL_RCC_GPIOA_CLK_ENABLE();

    GPIO_InitTypeDef in = {0};
    in.Pin = GPIO_PIN_0 | GPIO_PIN_1 | GPIO_PIN_4;
    in.Mode = GPIO_MODE_INPUT;
    in.Pull = GPIO_PULLUP;             // buttons short the pins to GND
    HAL_GPIO_Init(GPIOA, &in);

    GPIO_InitTypeDef led = {0};
    led.Pin = GPIO_PIN_5;
    led.Mode = GPIO_MODE_OUTPUT_PP;
    HAL_GPIO_Init(GPIOA, &led);
`;
const TAIL = `
        if (!HAL_GPIO_ReadPin(GPIOA, GPIO_PIN_4))      // SW3 clears the counters
        {
            rawEdges = 0;
            presses = 0;
        }
        HAL_Delay(1);                                  // poll every 1 ms
    }
}
`;

export const TIMER = `${HEAD}uint32_t lastChange = 0;

int main(void)
{${INIT}
    while (1)
    {
        int raw = HAL_GPIO_ReadPin(GPIOA, GPIO_PIN_0);
        if (raw != lastRaw)
        {
            lastChange = HAL_GetTick();
            lastRaw = raw;
            rawEdges++;
        }
        if (HAL_GetTick() - lastChange > DEBOUNCE_MS && raw != stable)
        {
            stable = raw;
            if (!stable)                               // settled LOW = press
            {
                presses++;
                HAL_GPIO_TogglePin(GPIOA, GPIO_PIN_5);
            }
        }
${TAIL}`;

export const NAIVE = `${HEAD}
int main(void)
{${INIT}
    while (1)
    {
        int raw = HAL_GPIO_ReadPin(GPIOA, GPIO_PIN_0);
        if (raw != lastRaw)
        {
            rawEdges++;
            if (!raw)                                  // every falling edge counts
            {
                presses++;
                HAL_GPIO_TogglePin(GPIOA, GPIO_PIN_5);
            }
            lastRaw = raw;
        }
        stable = raw;                                  // no filtering at all
${TAIL}`;

export const INTEGRATOR = `${HEAD}int count = 0;             // 0 .. DEBOUNCE_MS, counts consecutive LOW samples

int main(void)
{${INIT}
    while (1)
    {
        int raw = HAL_GPIO_ReadPin(GPIOA, GPIO_PIN_0);
        if (raw != lastRaw) { rawEdges++; lastRaw = raw; }

        if (!raw) { if (count < DEBOUNCE_MS) count++; }
        else      { if (count > 0) count--; }

        if (count >= DEBOUNCE_MS && stable)
        {
            stable = 0;
            presses++;
            HAL_GPIO_TogglePin(GPIOA, GPIO_PIN_5);
        }
        if (count == 0 && !stable) stable = 1;
${TAIL}`;

export type P12 = { sw1: boolean; sw2: boolean; sw3: boolean; bounce: number; noPull: boolean; chatter: boolean };
export const P12_DEFAULT: P12 = { sw1: false, sw2: false, sw3: false, bounce: 6, noPull: false, chatter: false };
type Edge = [number, number];
export interface Bench12 { r: () => number; last: [boolean, boolean, boolean]; physical: number; deb: Edge[]; stable: number; pressT: number; burstEnd: number }
const BENCH = new WeakMap<Mcu, Bench12>();
export function bench12(m: Mcu): Bench12 {
  let b = BENCH.get(m);
  if (!b) { b = { r: rng(0x5eed12), last: [false, false, false], physical: 0, deb: [], stable: 1, pressT: -1, burstEnd: 0 }; BENCH.set(m, b); }
  return b;
}

/** Mechanical contact: the pin alternates between closed (0) and open (pull-up) for `ms` before settling. */
function burst(m: Mcu, b: Bench12, pressed: boolean, ms: number) {
  const settled = pressed ? 0 : null, open = pressed ? null : 0;
  if (ms <= 0) { m.setInput("PA0", settled); return; }
  const n = 2 * Math.max(1, Math.round(ms * (0.35 + b.r() * 0.3))) + 1;
  const ts = Array.from({ length: n }, () => b.r()).sort((a, c) => a - c);
  ts[0] = 0; ts[n - 1] = 1;
  ts.forEach((u, i) => m.schedule(m.time + u * ms / 1000, () => m.setInput("PA0", i % 2 === 0 ? settled : open)));
  b.burstEnd = m.time + ms / 1000;
}

export function world12(m: Mcu, dt: number, p: P12) {
  const b = bench12(m);
  if (p.noPull) m.write("GPIOA.PUPDR", m.peek("GPIOA.PUPDR") & ~3);
  if (p.sw1 !== b.last[0]) {
    b.last[0] = p.sw1;
    if (p.sw1) b.physical++;
    b.pressT = m.time;
    burst(m, b, p.sw1, p.bounce);
  } else if (p.sw1 && p.chatter && m.time > b.burstEnd && b.r() < dt * 30) {
    m.setInput("PA0", null);
    m.schedule(m.time + 0.0002 + b.r() * 0.0006, () => { if (b.last[0]) m.setInput("PA0", 0); });
  }
  if (p.sw2 !== b.last[1]) { b.last[1] = p.sw2; const v = p.sw2 ? 0 : null; m.schedule(m.time + 0.004, () => m.setInput("PA1", v)); }
  if (p.sw3 !== b.last[2]) { b.last[2] = p.sw3; m.setInput("PA4", p.sw3 ? 0 : null); if (p.sw3) b.physical = 0; }
  const s = m.fw?.field("stable") ?? 1;
  if (s !== b.stable) { b.stable = s; b.deb.push([m.time, s]); if (b.deb.length > 400) b.deb.splice(0, b.deb.length - 400); }
}

export const debounceOf = (src: string) => Number(/#define\s+DEBOUNCE_MS\s+(\d+)/.exec(src)?.[1] ?? NaN);
