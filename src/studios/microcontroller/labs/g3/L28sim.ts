import type { Mcu } from "../core/mcu";

export const DEMO = `// Lab 28: Analog Comparator
// Mirror the comparator output on the LED (PB0) using the interrupt
#include <avr/io.h>
#include <avr/interrupt.h>

volatile uint8_t cmp_flag = 0;
volatile uint16_t edges = 0;

ISR(ANALOG_COMP_vect) {
  cmp_flag = 1;                       // Set flag on comparator interrupt
  edges++;
  if (ACSR & (1 << ACO)) PORTB |= (1 << PB0);   // AIN0 > AIN1: LED on
  else PORTB &= ~(1 << PB0);                    // AIN0 < AIN1: LED off
}

int main(void) {
  // Configure LED on PB0 (Arduino D8)
  DDRB |= (1 << PB0);

  // Configure Analog Comparator: AIN0 (PD6) is +, AIN1 (PD7) is -
  DIDR1 = (1 << AIN1D) | (1 << AIN0D);  // digital input buffers off
  ACSR = (1 << ACIE);                   // ACIS1:0 = 00: interrupt on every toggle
  sei();                                // Enable global interrupts

  while (1) {
    if (cmp_flag) {
      cmp_flag = 0;                     // edge handled
    }
  }
}
`;

export const RISING = DEMO
  .replace("// Mirror the comparator output on the LED (PB0) using the interrupt", "// Toggle LED when Vin rises above Vref using interrupt")
  .replace("  if (ACSR & (1 << ACO)) PORTB |= (1 << PB0);   // AIN0 > AIN1: LED on\n  else PORTB &= ~(1 << PB0);                    // AIN0 < AIN1: LED off\n", "  PORTB ^= (1 << PB0);                // toggle on every rising edge\n")
  .replace("ACSR = (1 << ACIE);                   // ACIS1:0 = 00: interrupt on every toggle", "ACSR = (1 << ACIE) | (1 << ACIS1) | (1 << ACIS0); // rising edge only");

export const POLLING = `// Lab 28: Analog Comparator - polling ACO instead of the interrupt
#include <avr/io.h>
#include <util/delay.h>

volatile uint16_t edges = 0;

int main(void) {
  DDRB |= (1 << PB0);
  DIDR1 = (1 << AIN1D) | (1 << AIN0D);
  ACSR = 0;                             // comparator on, no interrupt
  uint8_t last = 0;

  while (1) {
    uint8_t now = (ACSR & (1 << ACO)) ? 1 : 0;
    if (now != last) { edges++; last = now; }
    if (now) PORTB |= (1 << PB0); else PORTB &= ~(1 << PB0);
    _delay_ms(4);                       // slow loop: short pulses are missed
  }
}
`;

export const BUG_NO_SEI = DEMO.replace("  sei();                                // Enable global interrupts\n", "  // BUG: sei() is missing, so ANALOG_COMP_vect never runs\n");
export const BUG_ACD = DEMO.replace("ACSR = (1 << ACIE);                   // ACIS1:0 = 00: interrupt on every toggle", "ACSR = (1 << ACD) | (1 << ACIE);      // BUG: ACD switches the comparator off");

export type Wave = "sine" | "tri" | "square" | "dc";
export const WAVES: Array<{ v: Wave; label: string }> = [{ v: "sine", label: "Sine Wave" }, { v: "tri", label: "Triangle Wave" }, { v: "square", label: "Square Wave" }, { v: "dc", label: "DC (Manual)" }];
export const SPANS = [10, 20, 30, 50, 100] as const;
export const FREQS = [10, 25, 50, 100, 200, 500] as const;
export const AMPS = [0.5, 1, 1.5, 2, 2.5] as const;
export type Board = "uno" | "nano" | "dip";

export type P28 = {
  wave: Wave; vin: number; amp: number; freq: number; vref: number; hyst: number; noise: number; span: number;
  board: Board; refOpen: boolean; hum: boolean;
};
export const P28_DEFAULT: P28 = { wave: "sine", vin: 2.5, amp: 2, freq: 100, vref: 2.5, hyst: 0.1, noise: 0.05, span: 30, board: "uno", refOpen: false, hum: false };

export const STEP = 10e-6;
const KEEP = 0.12;

/** Deterministic zero-mean, unit-variance noise for sample index k. */
function gauss(k: number) {
  let s = 0;
  for (let j = 0; j < 4; j++) {
    let x = (k * 4 + j + 1) | 0;
    x = Math.imul(x ^ (x >>> 16), 0x45d9f3b); x = Math.imul(x ^ (x >>> 16), 0x45d9f3b); x ^= x >>> 16;
    s += (x >>> 0) / 0xffffffff - 0.5;
  }
  return s * 1.732;
}

/** Clean input signal at time t (before noise / hum). */
export function signal(p: P28, t: number): number {
  if (p.wave === "dc") return p.vin;
  const ph = (t * p.freq) % 1;
  const s = p.wave === "sine" ? Math.sin(2 * Math.PI * ph) : p.wave === "tri" ? (ph < 0.5 ? 4 * ph - 1 : 3 - 4 * ph) : ph < 0.5 ? 1 : -1;
  return p.vin + p.amp * s;
}
/** Voltage on AIN1: the reference divider, or a floating pin wandering when its wire is open. */
export function refAt(p: P28, t: number): number {
  return p.refOpen ? 2.3 + 1.4 * Math.sin(2 * Math.PI * 0.9 * t) + 0.35 * Math.sin(2 * Math.PI * 50 * t) : p.vref;
}
const clamp5 = (v: number) => Math.max(0, Math.min(5, v));
const NODE = 100e-6;
/** Band-limited noise (~5 kHz, interpolated between 100 us nodes) plus a small white part, unit RMS. */
function noiseAt(t: number) {
  const x = t / NODE, k = Math.floor(x), a = x - k;
  const smooth = (gauss(k + 7_000_003) * (1 - a) + gauss(k + 7_000_004) * a) / Math.sqrt((1 - a) ** 2 + a ** 2);
  return 0.94 * smooth + 0.34 * gauss(Math.round(t / STEP));
}
export function vinAt(p: P28, t: number): number {
  return clamp5(signal(p, t) + p.noise * noiseAt(t) + (p.hum ? 0.4 * Math.sin(2 * Math.PI * 50 * t) : 0));
}

/** `count` = comparator edges since the current firmware instance started. */
export interface Front { trace: Array<[number, number, number]>; edges: Array<[number, number]>; out: number; t: number; count: number; fw: unknown }
const fronts = new WeakMap<Mcu, Front>();
export function front(m: Mcu): Front {
  let f = fronts.get(m);
  if (!f) { f = { trace: [], edges: [], out: 0, t: 0, count: 0, fw: null }; fronts.set(m, f); }
  return f;
}

/**
 * Pre-computes the next dt of the comparator front end at 10 us resolution and schedules every
 * output change at its crossing time, so ANALOG_COMP_vect runs when the signal actually crosses.
 */
export function world28(m: Mcu, dt: number, p: P28) {
  const f = front(m);
  let t0 = m.now;
  if (t0 < f.t - 5e-4) { f.trace = []; f.edges = []; f.out = 0; }
  else if (f.t > 0 && Math.abs(t0 - f.t) < 5e-4) t0 = f.t;
  if (f.fw !== (m.fw ?? null)) { f.fw = m.fw ?? null; f.count = 0; }
  const n = Math.max(1, Math.round(dt / STEP));
  for (let i = 0; i < n; i++) {
    const t = t0 + i * STEP;
    const vin = vinAt(p, t);
    const ref = refAt(p, t);
    const thr = f.out ? ref - p.hyst / 2 : ref + p.hyst / 2;
    const next = f.out ? (vin < thr ? 0 : 1) : (vin > thr ? 1 : 0);
    if (i % 2 === 0) f.trace.push([t, vin, ref]);
    if (next !== f.out) {
      f.out = next;
      f.count++;
      f.edges.push([t, next]);
      if (t <= m.now + 1e-12) m.setComparator(next); else m.schedule(t, () => m.setComparator(next));
    }
  }
  f.t = t0 + n * STEP;
  const cut = f.t - KEEP;
  let a = 0; while (a < f.trace.length && f.trace[a]![0] < cut) a++;
  if (a) f.trace.splice(0, a);
  let b = 0; while (b < f.edges.length - 1 && f.edges[b + 1]![0] < cut) b++;
  if (b) f.edges.splice(0, b);
}

/** Expected fraction of time the output is HIGH for a noiseless periodic input (hysteresis ignored). */
export function expectedDuty(p: P28): number | null {
  if (p.wave === "dc" || p.refOpen) return null;
  const x = (p.vref - p.vin) / p.amp;
  if (p.wave === "square") return x >= 1 ? 0 : x < -1 ? 1 : 0.5;
  if (x >= 1) return 0;
  if (x <= -1) return 1;
  return p.wave === "sine" ? Math.acos(x) / Math.PI : (1 - x) / 2;
}

/** Level of a stepped log at time t (log entries are [time, level]). */
export function levelAt(log: ReadonlyArray<readonly [number, number]>, t: number, initial = 0): number {
  let v = initial;
  for (const [tt, lv] of log) { if (tt > t) break; v = lv; }
  return v;
}

export const PINS: Record<Board, { ain0: string; ain1: string; led: string; boardName: string; col: string }> = {
  uno: { ain0: "D6", ain1: "D7", led: "D8", boardName: "Arduino Uno (ATmega328P)", col: "Arduino Pin" },
  nano: { ain0: "D6", ain1: "D7", led: "D8", boardName: "Arduino Nano (ATmega328P)", col: "Arduino Pin" },
  dip: { ain0: "pin 12", ain1: "pin 13", led: "pin 14", boardName: "ATmega328P-PU (DIP-28)", col: "DIP Pin" },
};
