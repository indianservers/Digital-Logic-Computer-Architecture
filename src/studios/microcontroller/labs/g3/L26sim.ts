import { toNum, Wait, type Val } from "../core/cinterp";
import type { Mcu, McuOptions } from "../core/mcu";

export const DEMO = `// Lab 26: ADC Resolution & Quantization
// Read the ADC and print each value over serial (generic MCU)
#include <stdio.h>
#include "adc.h"

#define ADC_BITS 12                  // resolution: 8, 10, 12 or 16
#define VREF 5.0f                    // reference voltage (V)

int main(void) {
    adc_init(ADC_BITS);
    printf("ADC Reading (%d-bit):\\n", ADC_BITS);

    while (1) {
        uint16_t adc = read_adc();                       // 0 .. 2^N - 1
        float voltage = adc * VREF / (1 << ADC_BITS);    // code x LSB
        printf("ADC: %5u  Voltage: %.4f V\\n", adc, voltage);
        delay_ms(100);
    }
}
`;

export const BITS8 = DEMO.replace("#define ADC_BITS 12 ", "#define ADC_BITS 8  ");
export const BITS16 = DEMO.replace("#define ADC_BITS 12 ", "#define ADC_BITS 16 ");

export const OVERSAMPLE = DEMO.replace(`        uint16_t adc = read_adc();                       // 0 .. 2^N - 1
        float voltage = adc * VREF / (1 << ADC_BITS);    // code x LSB`, `        // Oversample 16x and keep 2 extra bits: works because noise dithers the LSB
        uint32_t sum = 0;
        for (int i = 0; i < 16; i++) sum += read_adc();
        uint32_t adc = sum >> 2;                         // (ADC_BITS + 2)-bit result
        float voltage = adc * VREF / (1 << (ADC_BITS + 2));`);

export const BUG_U8 = DEMO.replace("        uint16_t adc = read_adc();                       // 0 .. 2^N - 1", "        uint8_t adc = read_adc();                        // BUG: 8-bit variable for a 12-bit result");

export const BUG_VREF = DEMO.replace("#define VREF 5.0f                    // reference voltage (V)", "#define VREF 3.3f                    // BUG: copied from a 3.3 V board");

export const RESOLUTIONS = [8, 10, 12, 16] as const;
export const RES_COLOR: Record<number, string> = { 8: "#e5484d", 10: "#1677ff", 12: "#16a34a", 16: "#8b5cf6" };
export const WAVES = [{ v: "sine", label: "Sine Wave" }, { v: "tri", label: "Triangle" }, { v: "square", label: "Square" }, { v: "saw", label: "Sawtooth" }, { v: "dc", label: "DC Level" }] as const;
export type Wave = (typeof WAVES)[number]["v"];
export const RATES = [1000, 2000, 5000, 10000, 20000] as const;
export const WINDOW = 0.02;

export type P26 = {
  wave: Wave; amp: number; offset: number; freq: number; noise: number; vref: number; fs: number;
  c8: boolean; c10: boolean; c12: boolean; c16: boolean; view: "full" | "fit" | "error"; sag: boolean; stuck: boolean;
};
export const P26_DEFAULT: P26 = { wave: "sine", amp: 2, offset: 1.5, freq: 100, noise: 0.01, vref: 5, fs: 2000, c8: true, c10: true, c12: true, c16: true, view: "fit", sag: false, stuck: false };

/** Repeatable uniform and Gaussian noise from an integer key. */
const hash = (x: number) => { const s = Math.sin(x * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };
export const gauss = (k: number) => Math.sqrt(-2 * Math.log(Math.max(1e-9, hash(k)))) * Math.cos(2 * Math.PI * hash(k + 0.5));

/** Noise-free input at time t (amplitude is peak-to-peak). */
export function ideal(p: P26, t: number): number {
  if (p.wave === "dc") return p.offset;
  const ph = (((t * p.freq) % 1) + 1) % 1;
  const w = p.wave === "sine" ? Math.sin(2 * Math.PI * ph) : p.wave === "tri" ? (ph < 0.5 ? 4 * ph - 1 : 3 - 4 * ph) : p.wave === "square" ? (ph < 0.5 ? 1 : -1) : 2 * ph - 1;
  return p.offset + (p.amp / 2) * w;
}

/** Reference the converter really uses (the sag fault pulls it 10 % low). */
export const adcRef = (p: P26) => (p.sag ? 0.9 * p.vref : p.vref);
export const lsb = (bits: number, vref: number) => vref / 2 ** bits;

/** Rounding quantizer: code = round(Vin / LSB), clipped to 0 … 2^N − 1. */
export function quantize(v: number, bits: number, p: P26): number {
  const max = 2 ** bits - 1;
  let code = Math.max(0, Math.min(max, Math.round(v / lsb(bits, adcRef(p)))));
  if (p.stuck && bits > 2) code &= ~4;
  return code;
}

interface Run26 { p: P26; reads: number; last: { t: number; v: number; code: number } | null }
const RUN = new WeakMap<Mcu, Run26>();
export const run26 = (m: Mcu) => RUN.get(m);

export function world26(m: Mcu, _dt: number, p: P26) {
  const r = RUN.get(m);
  if (r) r.p = p; else RUN.set(m, { p, reads: 0, last: null });
}

export const mcu26 = (p: P26): McuOptions => ({
  part: "F401", clock: 84e6, ips: 300_000,
  onCall: (name: string, args: Val[], m: Mcu) => {
    if (name === "adc_init") { m.adcBits = Math.max(1, Math.min(16, Math.round(toNum(args[0] ?? 12)))); return 0; }
    if (name === "delay_ms") return new Wait(Math.max(0, toNum(args[0] ?? 0)) / 1000);
    if (name === "read_adc") {
      let r = RUN.get(m);
      if (!r) { r = { p, reads: 0, last: null }; RUN.set(m, r); }
      r.reads++;
      const v = ideal(r.p, m.now) + r.p.noise * gauss(r.reads * 7.31);
      const code = quantize(v, m.adcBits, r.p);
      r.last = { t: m.now, v, code };
      return code;
    }
    return undefined;
  },
});

export interface Window26 { start: number; ts: number[]; vin: number[] }
/** Last 20 ms, triggered on a cycle start so periodic signals hold still. */
export function window26(p: P26, now: number): Window26 {
  const period = p.wave === "dc" || p.freq <= 0 ? WINDOW : 1 / p.freq;
  const start = Math.max(0, Math.floor((now - WINDOW) / period) * period);
  const n = Math.floor(WINDOW * p.fs + 1e-9);
  const ts: number[] = [], vin: number[] = [];
  for (let k = 0; k <= n; k++) {
    const t = start + k / p.fs;
    ts.push(t);
    vin.push(ideal(p, t) + p.noise * gauss(Math.round(t * 1e6) + 0.25));
  }
  return { start, ts, vin };
}

/** RMS of (reconstructed − input) over the window, using the converter's own reference and the clipped input. */
export function rmsQuantError(w: Window26, bits: number, p: P26): number {
  const ref = adcRef(p), q = lsb(bits, ref);
  let s = 0;
  for (const v of w.vin) { const c = Math.max(0, Math.min(ref - q, v)); const e = quantize(v, bits, p) * q - c; s += e * e; }
  return Math.sqrt(s / Math.max(1, w.vin.length));
}

export const idealSnr = (bits: number) => 6.02 * bits + 1.76;
/** Effective bits for a full-scale sine with this noise added to the quantization error. */
export function enob(bits: number, p: P26): number {
  const q = lsb(bits, p.vref);
  const sig = p.vref / (2 * Math.SQRT2);
  const nz = Math.sqrt(p.noise ** 2 + (q * q) / 12);
  return (20 * Math.log10(sig / nz) - 1.76) / 6.02;
}

export function fmtV(v: number): string {
  const a = Math.abs(v);
  if (a >= 1) return `${v.toFixed(3)} V`;
  if (a >= 1e-3) { const mv = v * 1e3; return `${mv.toFixed(Math.abs(mv) >= 100 ? 0 : 2)} mV`; }
  const uv = v * 1e6;
  return `${uv.toFixed(Math.abs(uv) >= 100 ? 0 : 1)} µV`;
}

export function codeDefine(src: string, k: "ADC_BITS" | "VREF"): number | null {
  const m = new RegExp(`^#define\\s+${k}\\s+([\\d.]+)f?`, "m").exec(src);
  return m ? Number(m[1]) : null;
}
export function setCodeDefine(src: string, k: "ADC_BITS" | "VREF", v: number): string {
  return src.replace(new RegExp(`^(#define\\s+${k}\\s+)([\\d.]+f?)`, "m"), (_, h: string) => `${h}${k === "VREF" ? `${Number(v.toFixed(3))}f` : Math.round(v)}`);
}
