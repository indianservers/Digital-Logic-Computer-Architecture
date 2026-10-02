import type { Mcu } from "../core/mcu";

export const DEMO = `/*
 * Lab 25: ADC Lab
 * Read an analog voltage using ADC and print the results.
 */

#include "stm32f4xx_hal.h"
#include <stdio.h>

#define VREF 3.3f                           // volts at full scale (VDDA)

ADC_HandleTypeDef hadc1;
ADC_ChannelConfTypeDef sConfig;

uint32_t resolution = ADC_RESOLUTION_12B;   // 12 / 10 / 8 / 6 bit
uint32_t channel = ADC_CHANNEL_0;           // PA0 = potentiometer wiper
uint32_t samplePeriod = 5;                  // ms between samples (200 S/s)

uint32_t adcValue = 0;
float voltage = 0;
uint32_t samples = 0;

static void MX_ADC1_Init(void)
{
  hadc1.Instance = ADC1;
  hadc1.Init.ClockPrescaler = ADC_CLOCK_SYNC_PCLK_DIV4;
  hadc1.Init.Resolution = resolution;
  hadc1.Init.DataAlign = ADC_DATAALIGN_RIGHT;
  hadc1.Init.ExternalTrigConv = ADC_SOFTWARE_START;
  hadc1.Init.NbrOfConversion = 1;
  HAL_ADC_Init(&hadc1);

  sConfig.Channel = channel;
  sConfig.Rank = 1;
  sConfig.SamplingTime = ADC_SAMPLETIME_84CYCLES;
  HAL_ADC_ConfigChannel(&hadc1, &sConfig);
}

int main(void)
{
  HAL_Init();
  SystemClock_Config();
  MX_ADC1_Init();

  printf("ADC Lab - Reading analog input...\\r\\n");

  while (1)
  {
    // Settings changed? Re-initialise the ADC before the next conversion
    if (hadc1.Init.Resolution != resolution || sConfig.Channel != channel) MX_ADC1_Init();

    HAL_ADC_Start(&hadc1);
    HAL_ADC_PollForConversion(&hadc1, HAL_MAX_DELAY);
    adcValue = HAL_ADC_GetValue(&hadc1);
    HAL_ADC_Stop(&hadc1);

    uint32_t maxCount = (1 << (12 - 2 * (resolution >> 24))) - 1;
    voltage = adcValue * VREF / maxCount;
    samples++;

    if (samples % 40 == 0) printf("ADC: %lu  Voltage: %.3f V\\r\\n", adcValue, voltage);
    HAL_Delay(samplePeriod);
  }
}
`;

export const AVERAGE = DEMO.replace(`    HAL_ADC_Start(&hadc1);
    HAL_ADC_PollForConversion(&hadc1, HAL_MAX_DELAY);
    adcValue = HAL_ADC_GetValue(&hadc1);
    HAL_ADC_Stop(&hadc1);`, `    // Oversample: average 16 conversions to cut random noise by 4x
    uint32_t sum = 0;
    for (int i = 0; i < 16; i++)
    {
      HAL_ADC_Start(&hadc1);
      HAL_ADC_PollForConversion(&hadc1, HAL_MAX_DELAY);
      sum += HAL_ADC_GetValue(&hadc1);
    }
    adcValue = (sum + 8) / 16;`);

export const NO_REINIT = DEMO.replace(`    // Settings changed? Re-initialise the ADC before the next conversion
    if (hadc1.Init.Resolution != resolution || sConfig.Channel != channel) MX_ADC1_Init();
`, `    // BUG: settings are never re-applied, so the ADC keeps its start-up resolution and channel
`);

export const WRONG_SCALE = DEMO.replace("    voltage = adcValue * VREF / maxCount;", "    voltage = adcValue * 5.0f / maxCount;   // BUG: copied from a 5 V Arduino sketch");

export const RES_CONST = ["ADC_RESOLUTION_12B", "ADC_RESOLUTION_10B", "ADC_RESOLUTION_8B", "ADC_RESOLUTION_6B"] as const;
export const resValue = (bits: number) => ((12 - bits) / 2) * 0x1000000;
export const resBits = (v: number) => 12 - 2 * ((v >>> 24) & 3);
export const CHANNELS = [
  { ch: 0, label: "ADC1_IN0 (PA0)", what: "Potentiometer wiper" },
  { ch: 1, label: "ADC1_IN1 (PA1)", what: "Not connected (floating)" },
  { ch: 16, label: "ADC1_IN16 (Temp sensor)", what: "Internal temperature sensor" },
  { ch: 17, label: "ADC1_IN17 (VREFINT)", what: "Internal 1.21 V reference" },
] as const;
export const RATES = [{ ms: 1, label: "1 kS/s" }, { ms: 5, label: "200 S/s" }, { ms: 10, label: "100 S/s" }, { ms: 20, label: "50 S/s" }, { ms: 50, label: "20 S/s" }] as const;
export const VREFS = [{ v: 3.3, label: "3.3 V (VDDA, internal)" }, { v: 2.5, label: "2.5 V (external VREF+)" }, { v: 2.048, label: "2.048 V (external VREF+)" }] as const;
export const SOURCES = ["dc", "sine", "tri"] as const;
export type Source = (typeof SOURCES)[number];

const RE = {
  resolution: /^(uint32_t resolution = )(ADC_RESOLUTION_\d+B)(;.*)$/m,
  channel: /^(uint32_t channel = )(ADC_CHANNEL_\d+)(;.*)$/m,
  samplePeriod: /^(uint32_t samplePeriod = )(\d+)(;.*)$/m,
} as const;
export type CodeKey = keyof typeof RE;
/** Value the sketch starts with, in the same units as the firmware global. */
export function codeVal(src: string, k: CodeKey): number | null {
  const m = RE[k].exec(src);
  if (!m) return null;
  const v = m[2]!;
  if (k === "resolution") return resValue(Number(v.replace(/\D/g, "")));
  if (k === "channel") return Number(v.replace(/\D/g, ""));
  return Number(v);
}
export function setCodeVal(src: string, k: CodeKey, v: number): string {
  const text = k === "resolution" ? `ADC_RESOLUTION_${resBits(v)}B` : k === "channel" ? `ADC_CHANNEL_${v}` : String(Math.round(v));
  return src.replace(RE[k], (_, h: string, _v: string, rest: string) => `${h}${text}${rest}`);
}

export type P25 = { pot: number; vref: number; source: Source; freq: number; open: boolean; noisy: boolean; fiveVolt: boolean };
export const P25_DEFAULT: P25 = { pot: 1.65, vref: 0, source: "dc", freq: 10, open: false, noisy: false, fiveVolt: false };

export interface Sample { t: number; code: number; volts: number; vin: number }
export interface Adc25 { vin: number; trace: Array<[number, number]>; samples: Sample[]; lastCount: number; pinV: number[] }
const ST = new WeakMap<Mcu, Adc25>();
export function adc(m: Mcu): Adc25 { return ST.get(m) ?? { vin: 0, trace: [], samples: [], lastCount: -1, pinV: [0, 0, 0, 0] }; }

const KEEP = 0.5;
/** Repeatable pseudo-noise from time, so runs are deterministic. */
const hash = (x: number) => { const s = Math.sin(x * 12.9898) * 43758.5453; return s - Math.floor(s); };

/** Voltage arriving at PA0 from the pot or the signal generator. */
export function sourceVolts(p: P25, t: number): number {
  const supply = p.fiveVolt ? 5 : 3.3;
  const scale = supply / 3.3;
  const base = p.pot * scale;
  if (p.source === "dc") return base;
  const amp = 1.2 * scale;
  const ph = (t * p.freq) % 1;
  const w = p.source === "sine" ? Math.sin(2 * Math.PI * ph) : ph < 0.5 ? 4 * ph - 1 : 3 - 4 * ph;
  return Math.max(0, Math.min(supply, base + amp * w));
}

export function world25(m: Mcu, _dt: number, p: P25) {
  const prev = adc(m);
  const t = m.now;
  const vref = VREFS[p.vref]?.v ?? 3.3;
  m.vref = vref;
  const bits = m.adcBits;
  m.adcNoise = p.noisy ? (0.012 * ((1 << bits) - 1)) / vref : 0;
  const pa0 = p.open ? 1.1 + 0.55 * Math.sin(2 * Math.PI * 50 * t) + 0.35 * (hash(Math.floor(t * 1000)) - 0.5) : sourceVolts(p, t);
  const pa1 = 0.9 + 0.4 * Math.sin(2 * Math.PI * 50 * t + 1) + 0.3 * (hash(Math.floor(t * 1000) + 7) - 0.5);
  const temp = 0.76 + 0.0025 * (31 - 25);
  m.setAnalog(0, pa0);
  m.setAnalog(1, pa1);
  m.setAnalog(16, temp);
  m.setAnalog(17, 1.21);
  // A conversion found now happened during the last tick, against the voltage set on the previous call.
  const last = prev.trace[prev.trace.length - 1];
  let samples = prev.samples;
  let lastCount = prev.lastCount;
  const fw = m.fw;
  if (fw && typeof fw.globalValue("samples") === "number") {
    const n = fw.num("samples");
    if (n !== lastCount) {
      lastCount = n;
      if (n > 0 && last) samples = [...samples.filter((s) => t - s.t < KEEP), { t: last[0], code: fw.num("adcValue"), volts: fw.num("voltage"), vin: last[1] }];
    }
  }
  const trace = [...prev.trace.filter(([tt]) => t - tt < KEEP), [t, pa0] as [number, number]];
  ST.set(m, { vin: pa0, trace, samples, lastCount, pinV: [pa0, pa1, temp, 1.21] });
}

/** Ideal conversion of a voltage for a given resolution and reference. */
export function idealCode(v: number, bits: number, vref: number) { const max = (1 << bits) - 1; return Math.round((Math.max(0, Math.min(vref, v)) / vref) * max); }
