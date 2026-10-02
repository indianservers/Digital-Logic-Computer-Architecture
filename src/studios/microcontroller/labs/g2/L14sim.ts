import type { Mcu } from "../core/mcu";

export const BSRR_DEMO = `#include "stm32f4xx.h"

int main(void)
{
    RCC->AHB1ENR |= RCC_AHB1ENR_GPIOAEN;    // clock GPIOA first
    GPIOA->MODER |= (1 << 10);              // MODER[11:10] = 01 -> PA5 output
    GPIOA->BSRR = (1 << 5);                 // BS5: PA5 high, LED on
    GPIOA->BSRR = (1 << (5 + 16));          // BR5: PA5 low, LED off

    GPIOA->PUPDR |= (2 << 0);               // PA0 pull-down (switch to 3.3 V)
    int last = -1;
    while (1)
    {
        int sw = GPIOA->IDR & 1;            // read PA0
        if (sw != last)                     // write only when it changes
        {
            last = sw;
            if (sw) GPIOA->BSRR = (1 << 5);
            else    GPIOA->BSRR = (1 << 21);
        }
        delay_ms(5);
    }
}
`;

export const RMW_DEMO = `#include "stm32f4xx.h"

int main(void)
{
    RCC->AHB1ENR |= RCC_AHB1ENR_GPIOAEN;
    GPIOA->MODER &= ~(3 << 10);             // clear MODER[11:10]
    GPIOA->MODER |= (1 << 10);              // PA5 output
    GPIOA->MODER &= ~(3 << 12);
    GPIOA->MODER |= (1 << 12);              // PA6 output

    while (1)
    {
        GPIOA->ODR ^= (1 << 5);             // read-modify-write: toggle PA5
        delay_ms(250);
        GPIOA->ODR ^= (1 << 6);             // toggle PA6 at half the rate
        delay_ms(250);
    }
}
`;

export const SWD_BUG = `#include "stm32f4xx.h"

int main(void)
{
    RCC->AHB1ENR |= RCC_AHB1ENR_GPIOAEN;
    GPIOA->MODER = (1 << 10);               // BUG: plain '=' also clears PA13/PA14 (SWD)

    while (1)
    {
        GPIOA->BSRR = (1 << 5);
        delay_ms(200);
        GPIOA->BSRR = (1 << 21);
        delay_ms(200);
    }
}
`;

export type P14 = { sw: boolean; clockOff: boolean; miswired: boolean };
export const P14_DEFAULT: P14 = { sw: false, clockOff: false, miswired: false };

export const REGS = [
  { name: "MODER", off: 0x00, pins: 2 },
  { name: "PUPDR", off: 0x0c, pins: 2 },
  { name: "IDR", off: 0x10, pins: 1 },
  { name: "ODR", off: 0x14, pins: 1 },
  { name: "BSRR", off: 0x18, pins: 1 },
] as const;
export type RegName = (typeof REGS)[number]["name"] | "OTYPER";
export const GPIOA_BASE = 0x40020000;
export const MODES = ["Input", "Output", "Alternate", "Analog"];
export const PULLS = ["None", "Pull-up", "Pull-down", "Reserved"];

export interface TraceEntry { id: number; t: number; line: number; src: "code" | "editor"; path: string; value: number; old: number; note: string; ignored: boolean }
export interface Trace14 { entries: TraceEntry[]; count: number; src: "code" | "editor"; bsrr: number; seq: number }
const TRACES = new WeakMap<Mcu, Trace14>();
export function trace14(m: Mcu): Trace14 {
  let s = TRACES.get(m);
  if (!s) { s = { entries: [], count: 0, src: "code", bsrr: 0, seq: 0 }; TRACES.set(m, s); }
  return s;
}

const pinList = (mask: number) => Array.from({ length: 16 }, (_, n) => n).filter((n) => (mask >> n) & 1).map((n) => `PA${n}`);

/** Human-readable effect of one register write, from the value before and the value written. */
export function decode(path: string, old: number, v: number, odr: number): string {
  const [, reg] = path.split(".") as [string, string];
  if (path === "RCC.AHB1ENR") { const d = (old ^ v) & 1; return d ? `GPIOA clock ${v & 1 ? "ON" : "OFF"}` : "no change to GPIOA clock"; }
  if (reg === "MODER" || reg === "PUPDR") {
    const names = reg === "MODER" ? MODES : PULLS;
    const out: string[] = [];
    for (let n = 0; n < 16; n++) { const a = (old >>> (2 * n)) & 3, b = (v >>> (2 * n)) & 3; if (a !== b) out.push(`PA${n} ${names[a]}→${names[b]}`); }
    if (reg === "MODER" && ((v >>> 26) & 0xf) !== 0xa && ((old >>> 26) & 0xf) === 0xa) out.push("SWD pins left AF mode");
    return out.length ? out.join(", ") : "no change";
  }
  if (reg === "OTYPER") { const d = (old ^ v) & 0xffff; return d ? pinList(d).map((p) => `${p} ${(v >> Number(p.slice(2))) & 1 ? "open-drain" : "push-pull"}`).join(", ") : "no change"; }
  if (reg === "ODR") { const d = (old ^ v) & 0xffff; return d ? pinList(d).map((p) => `${p}=${(v >> Number(p.slice(2))) & 1}`).join(", ") : "no change"; }
  if (reg === "BSRR") {
    const set = v & 0xffff, rst = (v >>> 16) & ~set & 0xffff;
    const parts = [...(set ? [`set ${pinList(set).join(" ")}`] : []), ...(rst ? [`reset ${pinList(rst).join(" ")}`] : [])];
    const changed = ((odr & ~rst) | set) !== odr;
    return parts.length ? `${parts.join(", ")}${changed ? "" : " (already)"}` : "no bits";
  }
  return `= 0x${v.toString(16)}`;
}

export function setup14(m: Mcu, p: P14) {
  if (p.clockOff) m.gateStuck.add("GPIOA");
  const s = trace14(m);
  m.busTap = (e) => {
    if (e.rw !== "W" || !(e.path.startsWith("GPIOA.") || e.path === "RCC.AHB1ENR")) return;
    const old = e.path.endsWith("BSRR") ? 0 : m.peek(e.path);
    const gpioOff = e.path.startsWith("GPIOA.") && (m.gateStuck.has("GPIOA") || !(m.peek("RCC.AHB1ENR") & 1));
    if (e.path === "GPIOA.BSRR") s.bsrr = e.value;
    s.count++;
    s.entries.unshift({ id: ++s.seq, t: e.t, line: s.src === "code" ? m.fw?.line ?? 0 : 0, src: s.src, path: e.path, value: e.value, old, note: gpioOff ? "ignored: GPIOA has no clock" : decode(e.path, old, e.value, m.peek("GPIOA.ODR")), ignored: gpioOff });
    if (s.entries.length > 80) s.entries.length = 80;
  };
}

export function world14(m: Mcu, _dt: number, p: P14) {
  m.setInput("PA0", p.sw ? 1 : null);
}

/** Debugger write from the UI, tagged so the trace can tell it apart from firmware writes. */
export function editorWrite(m: Mcu, path: string, value: number) {
  const s = trace14(m);
  s.src = "editor";
  try { m.write(path, value >>> 0); } finally { s.src = "code"; }
}

/** Execute firmware statements one at a time until the next GPIOA/RCC register write lands (or a limit is hit). */
export function stepToWrite(m: Mcu, world: () => void, limit = 600): boolean {
  const fw = m.fw, s = trace14(m);
  if (!fw || fw.error) return false;
  const n = s.count;
  for (let i = 0; i < limit && s.count === n && !fw.error; i++) {
    fw.step("into");
    world();
    m.tick(0.001);
  }
  if (!fw.paused) fw.pause("Stepped to register write");
  return s.count !== n;
}
