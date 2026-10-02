import type { Mcu } from "../core/mcu";
import { hx } from "../g1/thumb";
import { CLOCK, cpuTime, mmioPath, P37_DEFAULT, setup37, sim37, world37, type P37 } from "./L37sim";

export const DEMO = `/* Lab 38: bare metal - no HAL, no CMSIS headers, every register is a raw address */
#include <stdint.h>

#define PSC_VALUE   15999       /* 16 MHz / (15999 + 1) = 1 kHz timer clock */
#define ARR_VALUE   249         /* update every 250 ticks = 4 Hz */

int main(void) {
    *(volatile uint32_t*)0x40023830 |= 1;           /* RCC_AHB1ENR: GPIOA clock on */
    *(volatile uint32_t*)0x40020000 |= (1 << 10);   /* GPIOA_MODER: PA5 = output */
    *(volatile uint32_t*)0x40020014 |= (1 << 5);    /* GPIOA_ODR: PA5 high */

    *(volatile uint32_t*)0x40023840 |= 1;           /* RCC_APB1ENR: TIM2 clock on */
    *(volatile uint32_t*)0x40000028 = PSC_VALUE;    /* TIM2_PSC */
    *(volatile uint32_t*)0x4000002C = ARR_VALUE;    /* TIM2_ARR */
    *(volatile uint32_t*)0x40000000 |= 1;           /* TIM2_CR1: CEN, start counting */

    while (1) {
        if (*(volatile uint32_t*)0x40000010 & 1) {      /* TIM2_SR: update flag UIF set? */
            *(volatile uint32_t*)0x40000010 = 0;        /* clear UIF (write 0) */
            *(volatile uint32_t*)0x40020014 ^= (1 << 5); /* toggle PA5 */
        }
    }
}
`;

const header = (src: string, text: string) => src.replace(/^\/\*.*\*\/$/m, `/* ${text} */`);
export const TIMCLK_LINE = "    *(volatile uint32_t*)0x40023840 |= 1;           /* RCC_APB1ENR: TIM2 clock on */\n";
export const UIF_LINE = "            *(volatile uint32_t*)0x40000010 = 0;        /* clear UIF (write 0) */\n";
export const BUG_TIMCLK = header(DEMO.replace(TIMCLK_LINE, ""), "Lab 38 bug: the LED lights but never blinks");
export const BUG_UIF = header(DEMO.replace(UIF_LINE, ""), "Lab 38 bug: the LED looks dim and flickers");
export const BUG_PORT = header(DEMO.replace("0x40020014 ^= (1 << 5)", "0x40020414 ^= (1 << 5)"), "Lab 38 bug: the toggle goes nowhere");
export const BUG_MODER = header(DEMO.replace("0x40020000 |= (1 << 10);  ", "0x40020000 |= (1 << 5);   "), "Lab 38 bug: ODR is high but the LED is dark");

export const VARIANTS = [
  { label: "C (raw registers)", code: DEMO },
  { label: "Bug: TIM2 clock off", code: BUG_TIMCLK },
  { label: "Bug: UIF never cleared", code: BUG_UIF },
  { label: "Bug: wrong port address", code: BUG_PORT },
  { label: "Bug: MODER field wrong", code: BUG_MODER },
];

export type FieldKey = "psc" | "arr";
const FIELD: Record<FieldKey, RegExp> = { psc: /^(#define\s+PSC_VALUE\s+)(\S+)/m, arr: /^(#define\s+ARR_VALUE\s+)(\S+)/m };
export const codeField = (src: string, k: FieldKey) => src.match(FIELD[k])?.[2] ?? null;
export const setCodeField = (src: string, k: FieldKey, v: string) => src.replace(FIELD[k], (_, a: string, old: string) => `${a}${v}${" ".repeat(Math.max(0, old.length - v.length))}`);

/* ---------------- registers on the workbench ---------------- */

export interface Field { name: string; lo: number; bits: number; values?: string[]; note: string }
export interface RegDef { key: string; path: string; label: string; fields: Field[]; ro?: number }
export const REGS: RegDef[] = [
  { key: "ahb1", path: "RCC.AHB1ENR", label: "RCC_AHB1ENR", fields: [{ name: "GPIOAEN", lo: 0, bits: 1, note: "GPIOA clock" }, { name: "GPIOBEN", lo: 1, bits: 1, note: "GPIOB clock" }, { name: "GPIOCEN", lo: 2, bits: 1, note: "GPIOC clock" }] },
  { key: "apb1", path: "RCC.APB1ENR", label: "RCC_APB1ENR", fields: [{ name: "TIM2EN", lo: 0, bits: 1, note: "TIM2 clock" }, { name: "TIM3EN", lo: 1, bits: 1, note: "TIM3 clock" }] },
  { key: "moder", path: "GPIOA.MODER", label: "GPIOA_MODER", fields: [{ name: "MODER5", lo: 10, bits: 2, values: ["input", "output", "alt fn", "analog"], note: "PA5 mode" }, { name: "MODER2", lo: 4, bits: 2, values: ["input", "output", "alt fn", "analog"], note: "PA2 mode (USART2 TX)" }] },
  { key: "odr", path: "GPIOA.ODR", label: "GPIOA_ODR", fields: [{ name: "ODR5", lo: 5, bits: 1, note: "PA5 output level" }] },
  { key: "cr1", path: "TIM2.CR1", label: "TIM2_CR1", fields: [{ name: "CEN", lo: 0, bits: 1, note: "counter enable" }, { name: "DIR", lo: 4, bits: 1, values: ["up", "down"], note: "count direction" }] },
  { key: "psc", path: "TIM2.PSC", label: "TIM2_PSC", fields: [{ name: "PSC", lo: 0, bits: 16, note: "timer clock = 16 MHz / (PSC + 1)" }] },
  { key: "arr", path: "TIM2.ARR", label: "TIM2_ARR", fields: [{ name: "ARR", lo: 0, bits: 32, note: "update every ARR + 1 ticks" }] },
  { key: "sr", path: "TIM2.SR", label: "TIM2_SR", fields: [{ name: "UIF", lo: 0, bits: 1, note: "update flag, cleared by writing 0" }] },
];
export const fieldOf = (v: number, f: Field) => (f.bits >= 32 ? v >>> 0 : (v >>> f.lo) & ((1 << f.bits) - 1));

/* ---------------- run state ---------------- */

export interface BusEntry { id: number; t: number; rw: "R" | "W"; path: string; addr: number; value: number; from?: number; src: "cpu" | "edit"; ignored?: boolean; n: number }
export interface Sim38 { bus: BusEntry[]; nextId: number; uifEdges: Array<[number, number]>; uif: number; edits: number; lastEdit: { path: string; t: number } | null; writes: number; reads: number }
const SIMS = new WeakMap<Mcu, Sim38>();
export const sim38 = (m: Mcu) => SIMS.get(m);
export type P38 = { bus: string };
export const P38_DEFAULT: P38 = { bus: "w" };
const RUN: P37 = { ...P37_DEFAULT, trace: false };

export function setup38(m: Mcu, src: string) {
  setup37(m, src);
  const s: Sim38 = { bus: [], nextId: 1, uifEdges: [], uif: 0, edits: 0, lastEdit: null, writes: 0, reads: 0 };
  SIMS.set(m, s);
  const s37 = sim37(m)!;
  m.busTap = (e) => {
    const t = s37 ? cpuTime(s37) : m.time;
    if (e.rw === "W") s.writes++; else s.reads++;
    if (e.path === "TIM2.SR") uifEdge(s, t, e.rw === "R" ? e.value & 1 : e.value & s.uif);
    const last = s.bus[s.bus.length - 1];
    /* A polling loop reads the same register thousands of times: fold repeats into one row. */
    if (e.rw === "R" && last && last.rw === "R" && last.path === e.path && last.value === e.value && last.src === "cpu") { last.n++; last.t = t; return; }
    s.bus.push({ id: s.nextId++, t, rw: e.rw, path: e.path, addr: e.addr, value: e.value >>> 0, src: "cpu", n: 1 });
    if (s.bus.length > 300) s.bus.splice(0, s.bus.length - 300);
  };
  s37.onSkip = (iters, perIter) => {
    const reads = iters * perIter;
    s.reads += reads;
    const last = s.bus[s.bus.length - 1];
    if (last && last.rw === "R" && last.src === "cpu") { last.n += reads; last.t = cpuTime(s37); }
  };
}

/** Debugger-style write from the workbench: goes through the same bus, so clock gating still applies. */
export function poke38(m: Mcu, path: string, value: number) {
  const s = sim38(m);
  const from = m.peek(path);
  const nEv = m.events.length;
  const tap = m.busTap;
  m.busTap = undefined;
  m.write(path, value >>> 0);
  m.busTap = tap;
  if (!s) return;
  const ignored = m.events.slice(nEv).some((e) => e.kind === "fault");
  s.bus.push({ id: s.nextId++, t: m.time, rw: "W", path, addr: addrOf(path), value: value >>> 0, from, src: "edit", ignored, n: 1 });
  s.edits++;
  s.lastEdit = { path, t: m.time };
}

const ADDR = new Map<string, number>();
export function addrOf(path: string) {
  let a = ADDR.get(path);
  if (a === undefined) {
    for (let x = 0x40000000; x < 0x40024000 && a === undefined; x += 4) if (mmioPath(x) === path) a = x;
    a ??= 0;
    ADDR.set(path, a);
  }
  return a;
}

export function world38(m: Mcu, dt: number, _p: P38) {
  const s = sim38(m);
  world37(m, dt, RUN);
  if (!s) return;
  uifEdge(s, m.time, m.peek("TIM2.SR") & 1);
}

/** UIF is usually set and cleared inside one 1 ms step, so it is also tracked from the bus accesses that see it. */
function uifEdge(s: Sim38, t: number, u: number) {
  if (u === s.uif) return;
  s.uif = u;
  const last = s.uifEdges[s.uifEdges.length - 1];
  s.uifEdges.push([Math.max(t, last?.[0] ?? 0), u]);
  if (s.uifEdges.length > 600) s.uifEdges.splice(0, s.uifEdges.length - 600);
}

/* ---------------- derived values ---------------- */

export interface Effects { gpioaClk: boolean; tim2Clk: boolean; pa5Mode: string; pa5: number; led: boolean; cen: boolean; tickHz: number; updHz: number; cnt: number; irq: "disabled" | "enabled" | "pending"; }
export function effects(m: Mcu): Effects {
  const ahb = m.peek("RCC.AHB1ENR"), apb = m.peek("RCC.APB1ENR");
  const pin = m.pin("PA5");
  const psc = m.peek("TIM2.PSC") & 0xffff, arr = m.peek("TIM2.ARR") >>> 0;
  const cen = (m.peek("TIM2.CR1") & 1) === 1 && (apb & 1) === 1;
  const tickHz = CLOCK / (psc + 1);
  const uie = (m.peek("TIM2.DIER") & 1) === 1, nvic = ((m.peek("NVIC.ISER0") >>> 28) & 1) === 1;
  return {
    gpioaClk: (ahb & 1) === 1, tim2Clk: (apb & 1) === 1, pa5Mode: ["input", "output", "alt fn", "analog"][(m.peek("GPIOA.MODER") >>> 10) & 3]!,
    pa5: pin.mode === "out" ? pin.level : 0, led: pin.mode === "out" && pin.level === 1, cen, tickHz, updHz: arr ? tickHz / (arr + 1) : 0, cnt: m.peek("TIM2.CNT") >>> 0,
    irq: uie && nvic ? ((m.peek("TIM2.SR") & 1) ? "pending" : "enabled") : "disabled",
  };
}

/** Toggle rate of PA5 over the last `win` seconds of edges. */
export function pinRate(m: Mcu, win = 1) {
  const e = m.edges.get("PA5") ?? [];
  const t = m.time;
  let n = 0;
  for (let i = e.length - 1; i >= 0 && e[i]![0] > t - win; i--) n++;
  return n / win;
}

export const regText = (e: BusEntry) => `${e.path.replace(".", "_")}`;
export const fmtBus = (e: BusEntry) => `${e.rw === "W" ? "W" : "R"} ${hx(e.addr, 8)} ${regText(e)} ${e.rw === "W" ? "←" : "→"} ${hx(e.value, 8)}`;
