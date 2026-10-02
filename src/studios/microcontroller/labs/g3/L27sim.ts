import type { Mcu } from "../core/mcu";

export const DEMO = `/* Lab 27: DAC Lab - Generate a sine wave using DAC */
#include "stm32f4xx_hal.h"
#include <math.h>

#define DAC_MAX 4095
#define PI      3.1415926f

DAC_HandleTypeDef hdac;

uint32_t channel = DAC_CHANNEL_1;     // DAC_CHANNEL_1 = PA4, DAC_CHANNEL_2 = PA5
uint32_t waveform = 1;                // 0 DC, 1 sine, 2 square, 3 triangle, 4 sawtooth
uint32_t level = 2048;                // DC level / waveform centre (0 - 4095)
uint32_t updateRateHz = 1000;         // DAC samples per second
uint32_t samplesPerCycle = 50;        // samples in one period
uint32_t sampleIndex = 0;
uint32_t code = 0;

int main(void)
{
  HAL_Init();
  SystemClock_Config();
  MX_DAC_Init();
  uint32_t active = channel;
  HAL_DAC_Start(&hdac, active);

  while (1)
  {
    if (channel != active)            // switched channel: stop the old one, start the new one
    {
      HAL_DAC_Stop(&hdac, active);
      active = channel;
      HAL_DAC_Start(&hdac, active);
    }

    float phase = (float)sampleIndex / samplesPerCycle;
    float swing = level < DAC_MAX - level ? level : DAC_MAX - level;
    float s = 0;
    if (waveform == 1) s = sinf(2 * PI * phase);
    else if (waveform == 2) s = phase < 0.5f ? 1 : -1;
    else if (waveform == 3) s = phase < 0.5f ? 4 * phase - 1 : 3 - 4 * phase;
    else if (waveform == 4) s = 2 * phase - 1;
    code = (uint32_t)(level + swing * s + 0.5f);

    HAL_DAC_SetValue(&hdac, active, DAC_ALIGN_12B_R, code);
    sampleIndex = (sampleIndex + 1) % samplesPerCycle;
    delay_us(1000000 / updateRateHz);  // DWT microsecond delay from the board support code
  }
}
`;

export const DC_ONLY = DEMO.replace("uint32_t waveform = 1; ", "uint32_t waveform = 0; ").replace("uint32_t level = 2048; ", "uint32_t level = 1241; ");
export const SQUARE = DEMO.replace("uint32_t waveform = 1; ", "uint32_t waveform = 2; ").replace("uint32_t updateRateHz = 1000; ", "uint32_t updateRateHz = 2000; ");
export const BUG_NOSTART = DEMO.replace("  HAL_DAC_Start(&hdac, active);\n\n", "  // BUG: HAL_DAC_Start() was never called, so the output stage stays off\n\n");
export const BUG_ALIGN = DEMO.replace("HAL_DAC_SetValue(&hdac, active, DAC_ALIGN_12B_R, code);", "HAL_DAC_SetValue(&hdac, active, DAC_ALIGN_8B_R, code);   // BUG: 8-bit alignment for a 12-bit code");

export const WAVES = ["DC Level", "Sine Wave", "Square Wave", "Triangle Wave", "Sawtooth Wave"] as const;
export const RATES = [100, 500, 1000, 2000, 5000, 10000] as const;
export const CH = [{ v: 0, label: "DAC1 (PA4)", pin: "PA4", per: "DAC1_CH1" }, { v: 0x10, label: "DAC2 (PA5)", pin: "PA5", per: "DAC1_CH2" }] as const;

const RE = {
  channel: /^(uint32_t channel = )(DAC_CHANNEL_[12]|\d+)(;.*)$/m,
  waveform: /^(uint32_t waveform = )(\d+)(;.*)$/m,
  level: /^(uint32_t level = )(\d+)(;.*)$/m,
  updateRateHz: /^(uint32_t updateRateHz = )(\d+)(;.*)$/m,
} as const;
export type CodeKey = keyof typeof RE;
export function codeVal(src: string, k: CodeKey): number | null {
  const m = RE[k].exec(src);
  if (!m) return null;
  if (k === "channel") return m[2] === "DAC_CHANNEL_2" ? 0x10 : m[2] === "DAC_CHANNEL_1" ? 0 : Number(m[2]);
  return Number(m[2]);
}
export function setCodeVal(src: string, k: CodeKey, v: number): string {
  const text = k === "channel" ? (v ? "DAC_CHANNEL_2" : "DAC_CHANNEL_1") : String(Math.round(v));
  return src.replace(RE[k], (_, h: string, _v: string, rest: string) => `${h}${text}${rest}`);
}

export type P27 = { load: boolean; sag: boolean; view: "voltage" | "samples" };
export const P27_DEFAULT: P27 = { load: false, sag: false, view: "voltage" };

/** Effective reference and output scaling for the current faults. */
export const vrefOf = (p: P27) => (p.sag ? 3.0 : 3.3);
/** Output buffer off: ~15 kΩ source into a 10 kΩ load divides the voltage by 2.5. */
export const loadGain = (p: P27) => (p.load ? 10 / (10 + 15) : 1);

export function world27(m: Mcu, _dt: number, p: P27) { m.vref = vrefOf(p); }

/** Pin voltage for one channel right now (0 V when the channel is not enabled). */
export function pinVolts(m: Mcu, p: P27, ch: number): number {
  const i = ch ? 1 : 0;
  return m.dacEnabled[i] ? ((m.dac[i] ?? 0) / 4095) * vrefOf(p) * loadGain(p) : 0;
}

export interface DacSample { t: number; code: number }
/** Samples written to one channel within the last `span` seconds (plus the one before, to start the staircase). */
export function history(m: Mcu, ch: number, span: number): DacSample[] {
  const i = ch ? 1 : 0;
  const out: DacSample[] = [];
  const from = m.now - span;
  let before: DacSample | null = null;
  for (const [t, c, code] of m.dacLog) {
    if (c !== i) continue;
    if (t < from) before = { t, code }; else out.push({ t, code });
  }
  return before ? [before, ...out] : out;
}

/** One ideal period of the programmed shape, as codes, for the preview. */
export function shape(waveform: number, level: number, n = 64): number[] {
  const swing = Math.min(level, 4095 - level);
  return Array.from({ length: n }, (_, k) => {
    const ph = k / n;
    const s = waveform === 1 ? Math.sin(2 * Math.PI * ph) : waveform === 2 ? (ph < 0.5 ? 1 : -1) : waveform === 3 ? (ph < 0.5 ? 4 * ph - 1 : 3 - 4 * ph) : waveform === 4 ? 2 * ph - 1 : 0;
    return Math.max(0, Math.min(4095, Math.floor(level + swing * s + 0.5)));
  });
}
