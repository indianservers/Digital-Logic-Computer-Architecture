import type { Mcu } from "../core/mcu";

export const PATTERN = `#include "stm32f4xx.h"

#define RELAY   (1 << 4)        // PB4 -> relay driver
#define BUZZER  (1 << 5)        // PB5 -> buzzer driver

void relay_set(bool on)  { GPIOB->BSRR = on ? RELAY : (RELAY << 16); }
void buzzer_set(bool on) { GPIOB->BSRR = on ? BUZZER : (BUZZER << 16); }

int main(void)
{
    RCC->AHB1ENR |= (1 << 1);          // GPIOB clock on
    GPIOB->MODER &= ~0xFFF;            // PB3/PB4 reset as JTAG pins (MODER = 0x280): clear first
    GPIOB->MODER |= 0x555;             // PB0..PB5 general-purpose outputs
    GPIOB->OTYPER = 0x00;              // push-pull (bit = 1 -> open-drain)

    while (1)
    {
        GPIOB->ODR = 0b00001010;       // LED bank 1010
        relay_set(true);
        buzzer_set(false);
        delay_ms(250);

        GPIOB->ODR = 0b00000101;       // LED bank 0101 (also clears PB4, PB5)
        relay_set(false);
        buzzer_set(true);
        delay_ms(250);
    }
}
`;

export const SCANNER = `#include "stm32f4xx_hal.h"

int main(void)
{
    HAL_Init();
    __HAL_RCC_GPIOB_CLK_ENABLE();

    GPIO_InitTypeDef out = {0};
    out.Pin = GPIO_PIN_0 | GPIO_PIN_1 | GPIO_PIN_2 | GPIO_PIN_3 | GPIO_PIN_4 | GPIO_PIN_5;
    out.Mode = GPIO_MODE_OUTPUT_PP;    // try GPIO_MODE_OUTPUT_OD
    HAL_GPIO_Init(GPIOB, &out);

    int pos = 0;
    int dir = 1;
    while (1)
    {
        HAL_GPIO_WritePin(GPIOB, GPIO_PIN_0 | GPIO_PIN_1 | GPIO_PIN_2 | GPIO_PIN_3, GPIO_PIN_RESET);
        HAL_GPIO_WritePin(GPIOB, 1 << pos, GPIO_PIN_SET);
        HAL_GPIO_WritePin(GPIOB, GPIO_PIN_4, pos == 3 ? GPIO_PIN_SET : GPIO_PIN_RESET);   // relay at the end
        HAL_GPIO_WritePin(GPIOB, GPIO_PIN_5, pos == 0 ? GPIO_PIN_SET : GPIO_PIN_RESET);   // beep at the start
        pos += dir;
        if (pos == 3 || pos == 0) dir = -dir;
        HAL_Delay(150);
    }
}
`;

export const SINK = `#include "stm32f4xx.h"

// Set the LED wiring to "Sink": 3V3 -> LED -> resistor -> pin.
// Open-drain can only pull LOW, so a 0 in ODR turns an LED on.

int main(void)
{
    RCC->AHB1ENR |= (1 << 1);
    GPIOB->MODER &= ~0xFFF;
    GPIOB->MODER |= 0x555;
    GPIOB->OTYPER = 0x0F;              // PB0..PB3 open-drain, PB4/PB5 push-pull

    int n = 0;
    while (1)
    {
        GPIOB->ODR = (~n) & 0x0F;      // LED k on when bit k of n is 1
        n = (n + 1) & 0x0F;
        delay_ms(200);
    }
}
`;

export type Drive = "npn" | "direct";
export type P13 = { ledR: number; sink: boolean; drive: Drive; shortR: boolean; noDiode: boolean };
export const P13_DEFAULT: P13 = { ledR: 330, sink: false, drive: "npn", shortR: false, noDiode: false };

export const VDD = 3.3, R_OUT = 50, PIN_MAX = 25e-3, PORT_MAX = 120e-3;
export const LEDS = [
  { key: "PB0", color: "red", hex: "#ef4444", vf: 2.0 },
  { key: "PB1", color: "green", hex: "#16a34a", vf: 2.1 },
  { key: "PB2", color: "yellow", hex: "#eab308", vf: 2.05 },
  { key: "PB3", color: "blue", hex: "#2563eb", vf: 3.0 },
] as const;
const R_BASE = 1000, VBE = 0.7, COIL_R = 70, PULL_IN_V = 3.75, PULL_IN_S = 0.008, DROP_OUT_S = 0.004, LED_BURN_A = 25e-3, LED_BURN_S = 1.5;

type Edge = [number, number];
export interface Load13 {
  ledA: number[]; burnt: boolean[]; overT: number[];
  pinA: Record<string, number>; port: number;
  coil: boolean; coilSince: number; contact: boolean; contactEdges: Edge[];
  q1Short: boolean; spikes: Array<{ t: number; v: number }>;
  buzzer: boolean; directCoilV: number;
}
const LOADS = new WeakMap<Mcu, Load13>();
export function load13(m: Mcu): Load13 {
  let s = LOADS.get(m);
  if (!s) {
    s = { ledA: [0, 0, 0, 0], burnt: [false, false, false, false], overT: [0, 0, 0, 0, 0, 0], pinA: {}, port: 0, coil: false, coilSince: 0, contact: false, contactEdges: [], q1Short: false, spikes: [], buzzer: false, directCoilV: 0 };
    LOADS.set(m, s);
  }
  return s;
}

const drivesHigh = (m: Mcu, key: string) => { const p = m.pin(key); return p.mode === "out" && !p.od && p.out === 1; };
const drivesLow = (m: Mcu, key: string) => { const p = m.pin(key); return p.mode === "out" && p.out === 0; };

/** Electrical model of port B: LED currents, transistor base drive, relay coil and contact timing, flyback events. */
export function world13(m: Mcu, dt: number, p: P13) {
  const s = load13(m);
  const pinA: Record<string, number> = {};
  LEDS.forEach((l, i) => {
    const r = i === 0 && p.shortR ? 0 : p.ledR;
    const on = (p.sink ? drivesLow(m, l.key) : drivesHigh(m, l.key)) && !s.burnt[i];
    const a = on ? Math.max(0, (VDD - l.vf) / (r + R_OUT)) : 0;
    s.ledA[i] = a;
    pinA[l.key] = p.sink ? -a : a;
    if (a > LED_BURN_A) {
      s.overT[i]! += dt;
      if (s.overT[i]! >= LED_BURN_S && !s.burnt[i]) { s.burnt[i] = true; m.log("fault", `${l.color} LED on ${l.key} burnt out after ${(a * 1000).toFixed(0)} mA`); }
    }
  });

  const pb4 = drivesHigh(m, "PB4");
  let coil = false;
  s.directCoilV = 0;
  if (p.drive === "direct") {
    pinA.PB4 = pb4 ? VDD / (COIL_R + R_OUT) : 0;
    s.directCoilV = pb4 ? VDD * COIL_R / (COIL_R + R_OUT) : 0;
    coil = s.directCoilV >= PULL_IN_V;
  } else {
    pinA.PB4 = pb4 ? (VDD - VBE) / (R_BASE + R_OUT) : 0;
    coil = pb4 || s.q1Short;
  }
  if (coil !== s.coil) {
    if (!coil && s.contact && p.drive === "npn") {
      if (p.noDiode) {
        const v = -(60 + Math.round(((m.time * 7919) % 1) * 40));
        s.spikes = [...s.spikes, { t: m.time, v }].slice(-20);
        m.log("fault", `Q1 collector kicked to ${v} V at turn-off (no flyback diode)`);
        if (s.spikes.filter((x) => x.v < 0).length >= 3 && !s.q1Short) { s.q1Short = true; coil = true; m.log("fault", "Q1 failed short after repeated over-voltage: relay stuck ON"); }
      } else s.spikes = [...s.spikes, { t: m.time, v: 5.7 }].slice(-20);
    }
    s.coil = coil; s.coilSince = m.time;
  }
  const want = s.coil ? m.time - s.coilSince >= PULL_IN_S : !(m.time - s.coilSince >= DROP_OUT_S) && s.contact;
  if (want !== s.contact) { s.contact = want; s.contactEdges.push([m.time, want ? 1 : 0]); if (s.contactEdges.length > 400) s.contactEdges.splice(0, 200); }

  const pb5 = drivesHigh(m, "PB5");
  pinA.PB5 = pb5 ? (VDD - VBE) / (R_BASE + R_OUT) : 0;
  s.buzzer = pb5;

  ["PB4", "PB5"].forEach((k, j) => { if (Math.abs(pinA[k] ?? 0) > PIN_MAX) s.overT[4 + j]! += dt; });
  s.pinA = pinA;
  s.port = Object.values(pinA).reduce((a, v) => a + Math.abs(v), 0);
}
