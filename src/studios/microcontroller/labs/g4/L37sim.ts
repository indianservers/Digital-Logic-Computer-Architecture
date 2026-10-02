import { Mcu, type McuOptions } from "../core/mcu";
import { compileThumb, hx, ThumbCpu, type ThumbHost, type ThumbProgram } from "../g1/thumb";

/* ---------------- firmware ---------------- */

export const DEMO = `/* Lab 37: Embedded C execution - every line below runs on a modelled Cortex-M4 */
#include "stm32f4xx.h"

#define LED_PIN    5            /* user LED LD2 is on PA5 */
#define BLINK_MS   100          /* time between toggles */

volatile uint32_t counter = 0;

int main(void) {
    RCC->AHB1ENR |= (1 << 0);                   /* clock GPIOA */
    GPIOA->MODER |= (1 << (LED_PIN * 2));       /* PA5 = general-purpose output */
    while (1) {
        counter++;
        GPIOA->ODR ^= (1 << LED_PIN);           /* toggle the LED */
        delay_ms(BLINK_MS);
    }
}
`;

const swap = (from: string, to: string, header: string) => DEMO.replace(from, to).replace(/^\/\*.*\*\/$/m, `/* ${header} */`);

export const PRINTF = `/* Lab 37: change code, compile, run and watch the state update */
#include "stm32f4xx.h"
#include <stdio.h>

#define LED_PIN    5
#define BLINK_MS   100

volatile uint32_t counter = 0;

int main(void) {
    RCC->AHB1ENR |= (1 << 0);
    GPIOA->MODER |= (1 << (LED_PIN * 2));
    while (1) {
        counter += 10;
        GPIOA->ODR ^= (1 << LED_PIN);
        printf("counter=%d\\n", counter);       /* goes out on USART2 at 115200 baud */
        delay_ms(BLINK_MS);
    }
}
`;

export const FUNCS = `/* Lab 37: function calls - step into blink() and watch LR, SP and the stack */
#include "stm32f4xx.h"

#define LED_PIN    5
#define BLINK_MS   100

volatile uint32_t counter = 0;

int blink(int pin) {
    GPIOA->ODR ^= (1 << pin);
    return pin;
}

int main(void) {
    RCC->AHB1ENR |= (1 << 0);
    GPIOA->MODER |= (1 << (LED_PIN * 2));
    while (1) {
        counter = counter + blink(LED_PIN);
        delay_ms(BLINK_MS);
    }
}
`;

export const CLOCK_LINE = "    RCC->AHB1ENR |= (1 << 0);                   /* clock GPIOA */\n";
export const MODER_GOOD = "GPIOA->MODER |= (1 << (LED_PIN * 2));";
export const BUG_CLOCK = swap(CLOCK_LINE, "", "Lab 37 bug: the LED never lights");
export const BUG_MODER = swap(MODER_GOOD, "GPIOA->MODER |= (1 << LED_PIN);    ", "Lab 37 bug: ODR changes but PA5 stays dark");
export const BUG_PIN = swap("#define LED_PIN    5 ", "#define LED_PIN    6 ", "Lab 37 bug: the wrong pin blinks");

export const VARIANTS = [
  { label: "C (bare-metal STM32)", code: DEMO },
  { label: "C (printf in the loop)", code: PRINTF },
  { label: "C (function call)", code: FUNCS },
  { label: "Bug: GPIO clock off", code: BUG_CLOCK },
  { label: "Bug: MODER field wrong", code: BUG_MODER },
  { label: "Bug: wrong LED pin", code: BUG_PIN },
];

export type FieldKey = "pin" | "blink";
const FIELD: Record<FieldKey, RegExp> = { pin: /^(#define\s+LED_PIN\s+)(\S+)/m, blink: /^(#define\s+BLINK_MS\s+)(\S+)/m };
export const codeField = (src: string, k: FieldKey) => src.match(FIELD[k])?.[2] ?? null;
export const setCodeField = (src: string, k: FieldKey, v: string) => src.replace(FIELD[k], (_, a: string, old: string) => `${a}${v}${" ".repeat(Math.max(0, old.length - v.length))}`);

/* ---------------- memory map ---------------- */

export const CLOCK = 16e6;
/** STM32F401: 16 core + 85 peripheral vector words fill 0x08000000–0x08000193. */
export const CODE_BASE = 0x08000194;
export const DATA_BASE = 0x20000000;
export const STACK_TOP = 0x20018000;
export const STACK_LIMIT = STACK_TOP - 0x400;
export const UART_BAUD = 115200;
export const LIB = new Set(["delay_ms", "delay_us", "HAL_Delay", "printf", "SystemInit"]);

const MAP = new Mcu({ family: "stm32" });
/* Mcu.pathAt scans every peripheral; the CPU model asks on every load and store, so memoise it. */
const PATHS = new Map<number, string | null>();
export const mmioPath = (addr: number): string | undefined => {
  let p = PATHS.get(addr);
  if (p === undefined) { p = addr >= 0x40000000 ? MAP.pathAt(addr) ?? null : null; PATHS.set(addr, p); }
  return p ?? undefined;
};
const isPeriph = (addr: number) => addr >= 0x40000000 && addr < 0x60000000;
export const regName = (addr: number) => mmioPath(addr)?.replace(".", "->");

const cache = new Map<string, ThumbProgram>();
export function program37(src: string): ThumbProgram {
  let p = cache.get(src);
  if (!p) {
    p = compileThumb(src, { codeBase: CODE_BASE, dataBase: DATA_BASE, lib: LIB, mmio: (per, reg) => MAP.addrOf(`${per}.${reg}`), mmioName: regName });
    if (cache.size > 24) cache.clear();
    cache.set(src, p);
  }
  return p;
}

/* ---------------- run state ---------------- */

export type Mode = "rt" | "l20" | "l5" | "l1";
export const MODES: Array<{ v: Mode; label: string }> = [
  { v: "rt", label: "Real time (16 MHz)" },
  { v: "l20", label: "Animate · 20 lines/s" },
  { v: "l5", label: "Animate · 5 lines/s" },
  { v: "l1", label: "Animate · 1 line/s" },
];
const LINES_PER_S: Record<Mode, number> = { rt: 0, l20: 20, l5: 5, l1: 1 };

export type P37 = { mode: string; trace: boolean; view: string; filter: string };
export const P37_DEFAULT: P37 = { mode: "rt", trace: true, view: "c", filter: "all" };

export type TraceKind = "line" | "store" | "var" | "lib" | "out" | "bp" | "fault" | "info";
export interface TraceItem { id: number; t: number; kind: TraceKind; text: string; line?: number; pc?: number }
export type StepKind = "into" | "over" | "out" | "ins";

export interface Sim37 {
  cpu: ThumbCpu;
  /** Simulation time at which the CPU's cycle counter was zero. */
  base: number;
  mode: Mode;
  acc: number;
  lastLine: number;
  skipBp: boolean;
  bps: ReadonlySet<number>;
  trace: TraceItem[];
  nextId: number;
  console: string;
  lib: Record<string, { calls: number; cycles: number }>;
  lastPrintf: { chars: number; cycles: number } | null;
  lastLib: string;
  ledPin: number;
  ledLevel: number;
  ledEdges: Array<[number, number]>;
  odrWrites: number;
  faults: string[];
  eventsSeen: number;
  bpHits: number;
  steps: number;
  insSteps: number;
  prev: { pc: number; r: number[]; values: Map<number, number> };
  lineCycles: Map<number, number>;
  /** Loop-head snapshot used to detect a CPU spinning on a register that cannot change before the next tick. */
  spin: Spin | null;
  /** Loop iterations fast-forwarded because nothing could change; reads per iteration are reported to onSkip. */
  skipped: number;
  onSkip?: (iterations: number, busPerIteration: number) => void;
}
interface Spin { pc: number; from: number; cyc: number; ins: number; stores: number; libs: number; bus: number; flags: number; regs: number[] }

const SIMS = new WeakMap<Mcu, Sim37>();
export const sim37 = (m: Mcu) => SIMS.get(m);
export const cpuTime = (s: Sim37) => s.base + s.cpu.cycles / CLOCK;

function addTrace(s: Sim37, kind: TraceKind, text: string, extra: Partial<TraceItem> = {}) {
  s.trace.push({ id: s.nextId++, t: cpuTime(s), kind, text, ...extra });
  if (s.trace.length > 600) s.trace.splice(0, s.trace.length - 400);
}

/** printf subset: %d %i %u %x %X %c %s %% with optional 0-padding and width. */
export function format(fmt: string, args: number[], str: (addr: number) => string): string {
  let k = 0;
  return fmt.replace(/%(0?)(\d*)([diuxXcs%])/g, (_, zero: string, width: string, c: string) => {
    if (c === "%") return "%";
    const a = args[k++] ?? 0;
    let out = c === "d" || c === "i" ? String(a | 0) : c === "u" ? String(a >>> 0) : c === "x" ? (a >>> 0).toString(16) : c === "X" ? (a >>> 0).toString(16).toUpperCase() : c === "c" ? String.fromCharCode(a & 0xff) : str(a >>> 0);
    const w = Number(width || 0);
    if (out.length < w) out = (zero ? "0" : " ").repeat(w - out.length) + out;
    return out;
  });
}

function host(m: Mcu, s: () => Sim37): ThumbHost {
  return {
    load: (addr) => {
      const p = mmioPath(addr);
      if (p) return m.read(p);
      if (isPeriph(addr)) { m.log("fault", `Read from ${hx(addr, 8)}: no register there (reads as 0)`); return 0; }
      return undefined;
    },
    peek: (addr) => { const p = mmioPath(addr); return p ? m.peek(p) : isPeriph(addr) ? 0 : undefined; },
    store: (addr, v) => {
      const p = mmioPath(addr);
      if (p) { m.write(p, v); return true; }
      if (isPeriph(addr)) { m.log("fault", `Write to ${hx(addr, 8)} ignored: no register there`); return true; }
      return false;
    },
    call: (name, args, cpu) => {
      const st = s();
      const rec = st.lib[name] ?? (st.lib[name] = { calls: 0, cycles: 0 });
      let cycles = 12, text = "", ret: number | undefined;
      const a0 = (args[0] ?? 0) >>> 0;
      if (name === "delay_ms" || name === "HAL_Delay") { cycles = a0 * (CLOCK / 1000); text = `${a0} ms busy-wait = ${Math.round(cycles).toLocaleString("en-US")} cycles`; }
      else if (name === "delay_us") { cycles = a0 * (CLOCK / 1e6); text = `${a0} µs busy-wait`; }
      else if (name === "printf") {
        const out = format(cpu.prog.strings.get(a0) ?? "", args.slice(1), (a) => cpu.prog.strings.get(a) ?? "(null)");
        cycles = 300 + out.length * (10 / UART_BAUD) * CLOCK;
        st.console = (st.console + out).slice(-2000);
        st.lastPrintf = { chars: out.length, cycles };
        ret = out.length;
        text = `"${out.replace(/\n/g, "\\n")}" sent on USART2: ${out.length} chars, ${(cycles / CLOCK * 1000).toFixed(2)} ms`;
      } else if (name === "SystemInit") { cycles = 40; text = "clocks left at the 16 MHz HSI"; }
      rec.calls++; rec.cycles += cycles;
      st.lastLib = `${name}(${name === "printf" ? "…" : args.map((a) => a | 0).join(", ")}): ${text}`;
      return { cycles, text, ret };
    },
  };
}

export function mcu37(): McuOptions { return { family: "stm32", clock: CLOCK, strictClock: true }; }

/** useLab setup: idle the C interpreter, the Thumb model runs the firmware instead. */
export function setup37(m: Mcu, src: string) {
  m.cpuHalted = true;
  const ref: { s?: Sim37 } = {};
  const prog = program37(src);
  const cpu = new ThumbCpu(prog, STACK_TOP, STACK_LIMIT, host(m, () => ref.s!));
  cpu.verbose = false;
  const s: Sim37 = {
    cpu, base: 0, mode: "rt", acc: 0, lastLine: -1, skipBp: false, bps: new Set(), trace: [], nextId: 1, console: "", lib: {}, lastPrintf: null, lastLib: "",
    ledPin: 5, ledLevel: 0, ledEdges: [], odrWrites: 0, faults: [], eventsSeen: 0, bpHits: 0, steps: 0, insSteps: 0,
    prev: { pc: cpu.r[15]!, r: [...cpu.r], values: new Map() }, lineCycles: new Map(), spin: null, skipped: 0,
  };
  ref.s = s;
  SIMS.set(m, s);
  if (prog.globals.length) addTrace(s, "info", `Startup: copied ${prog.globals.length} word${prog.globals.length === 1 ? "" : "s"} of .data from flash to SRAM, then BL main`);
}

export const lineOf = (s: Sim37) => s.cpu.current?.line ?? -1;

function pause(m: Mcu, s: Sim37, line: number, reason: string) {
  if (m.fw) { m.fw.paused = true; m.fw.pauseReason = reason; m.fw.line = line; }
  s.skipBp = true;
}

function syncLed(m: Mcu, s: Sim37) {
  const pin = m.pin(`PA${s.ledPin}`);
  /* An input pin cannot source the LED current, so a floating PA5 leaves LD2 dark. */
  const lv = pin.mode === "out" && pin.level ? 1 : 0;
  if (lv !== s.ledLevel) {
    s.ledLevel = lv;
    s.ledEdges.push([cpuTime(s), lv]);
    if (s.ledEdges.length > 400) s.ledEdges.splice(0, s.ledEdges.length - 400);
  }
}

/** Execute one instruction with trace bookkeeping. Returns false if a breakpoint stopped it. */
function exec(m: Mcu, s: Sim37, p: P37, honourBp: boolean): boolean {
  const cpu = s.cpu;
  const ins = cpu.current;
  if (!ins) { cpu.step(cpuTime(s)); return false; }
  const entering = ins.line !== s.lastLine;
  if (honourBp && entering && s.bps.has(ins.line) && !s.skipBp) {
    s.bpHits++;
    addTrace(s, "bp", `Breakpoint hit at line ${ins.line}`, { line: ins.line, pc: ins.addr });
    pause(m, s, ins.line, "breakpoint");
    return false;
  }
  s.skipBp = false;
  if (entering) addTrace(s, "line", `PC ${hx(ins.addr, 8)} → line ${ins.line}`, { line: ins.line, pc: ins.addr });
  s.lastLine = ins.line;
  const nStores = cpu.storeCount;
  const c0 = cpu.cycles;
  cpu.step(cpuTime(s));
  s.lineCycles.set(ins.line, (s.lineCycles.get(ins.line) ?? 0) + (cpu.cycles - c0));
  const fresh = cpu.storeCount - nStores;
  for (const st of fresh ? cpu.stores.slice(-fresh) : []) {
    if (st.mmio && st.name === "GPIOA->ODR" && st.from !== st.to) s.odrWrites++;
    if (st.mmio) addTrace(s, "store", `${st.name.replace("->", " ")} changed ${hx(st.from, 2)} → ${hx(st.to, 2)}`, { line: ins.line, pc: st.pc });
    else if (p.trace && st.from !== st.to) addTrace(s, "var", `${st.name} ${st.from} → ${st.to}`, { line: ins.line, pc: st.pc });
  }
  if (ins.op === "LIB" && s.lastLib) { addTrace(s, "lib", s.lastLib, { line: ins.line, pc: ins.addr }); s.lastLib = ""; }
  if (cpu.fault) addTrace(s, "fault", cpu.fault, { line: ins.line, pc: ins.addr });
  else if (cpu.halted) addTrace(s, "info", `Halted: ${cpu.halted}`);
  const ev = m.events;
  for (let i = s.eventsSeen; i < ev.length; i++) if (ev[i]!.kind === "fault") { s.faults.push(ev[i]!.text); addTrace(s, "fault", ev[i]!.text, { line: ins.line }); }
  s.eventsSeen = ev.length;
  if (s.faults.length > 50) s.faults.splice(0, s.faults.length - 50);
  syncLed(m, s);
  return true;
}

/** Run until the source line changes (into), also past calls (over), until the function returns (out), or one instruction. */
export function step37(m: Mcu, kind: StepKind, p: P37): void {
  const s = sim37(m);
  if (!s || s.cpu.stopped) return;
  snapshot(s);
  const cpu = s.cpu;
  const start = lineOf(s), depth = cpu.calls.length;
  s.skipBp = true;
  if (kind === "ins") { exec(m, s, p, false); s.insSteps++; }
  else {
    for (let n = 0; n < 200000 && !cpu.stopped; n++) {
      if (!exec(m, s, p, n > 0)) break;
      const line = lineOf(s);
      if (kind === "out" ? cpu.calls.length < depth : kind === "over" ? line !== start && cpu.calls.length <= depth : line !== start) break;
    }
    s.steps++;
  }
  rebase(m, s);
  /* Stay halted on the new line like a debugger; Simulate resumes through fw.resume(). */
  if (!cpu.stopped) pause(m, s, lineOf(s), kind === "ins" ? "instruction step" : `step ${kind}`);
}

/**
 * Called on every backward branch. Peripherals only change on the 1 ms tick, so if a whole loop iteration
 * ends where it began with the same registers and flags, no stores and no library calls, every further
 * iteration until `end` is identical: account for their cycles at once instead of executing them.
 */
function spinCheck(m: Mcu, s: Sim37, from: number, end: number) {
  const c = s.cpu, pc = c.r[15]!;
  const flags = (c.n ? 1 : 0) | (c.z ? 2 : 0) | (c.c ? 4 : 0) | (c.v ? 8 : 0);
  let libs = 0;
  for (const k in s.lib) libs += s.lib[k]!.calls;
  const sp = s.spin;
  if (sp && sp.pc === pc && sp.from === from && sp.stores === c.storeCount && sp.libs === libs && sp.flags === flags && sp.regs.every((v, i) => v === c.r[i])) {
    const per = c.cycles - sp.cyc;
    const iters = per > 0 ? Math.floor(((end - cpuTime(s)) * CLOCK) / per) : 0;
    const bpInside = s.bps.size > 0 && c.prog.ins.some((i) => i.addr >= pc && i.addr <= from && s.bps.has(i.line));
    if (iters > 0 && !bpInside) {
      c.cycles += iters * per;
      c.executed += iters * (c.executed - sp.ins);
      s.skipped += iters;
      s.onSkip?.(iters, m.busCount - sp.bus);
    }
  }
  s.spin = { pc, from, cyc: c.cycles, ins: c.executed, stores: c.storeCount, libs, bus: m.busCount, flags, regs: c.r.slice() };
}

/** Line the sim clock up with the CPU clock without ever moving CPU time backwards. */
function rebase(m: Mcu, s: Sim37) { s.base = Math.max(s.base, m.time - s.cpu.cycles / CLOCK); }

/** Remember registers and watched values so the UI can highlight what the next step changes. */
export function snapshot(s: Sim37) {
  const values = new Map<number, number>();
  for (const g of s.cpu.prog.globals) values.set(g.addr, s.cpu.read(g.addr));
  s.prev = { pc: s.cpu.r[15]!, r: [...s.cpu.r], values };
}

export function world37(m: Mcu, dt: number, p: P37) {
  const s = sim37(m);
  if (!s || s.cpu.stopped) return;
  const mode = (LINES_PER_S[p.mode as Mode] !== undefined ? p.mode : "rt") as Mode;
  if (mode !== s.mode) { s.mode = mode; rebase(m, s); s.acc = 0; }
  if (mode === "rt") {
    const end = m.time + dt;
    if (cpuTime(s) < m.time - 0.25) s.base = m.time - s.cpu.cycles / CLOCK;
    s.spin = null;
    for (let n = 0; n < 60000 && !s.cpu.stopped && cpuTime(s) < end; n++) {
      const from = s.cpu.r[15]!;
      if (!exec(m, s, p, true)) return;
      if (s.cpu.r[15]! < from) spinCheck(m, s, from, end);
    }
    return;
  }
  s.acc += dt * LINES_PER_S[mode];
  while (s.acc >= 1 && !s.cpu.stopped) {
    s.acc -= 1;
    snapshot(s);
    const start = lineOf(s);
    for (let n = 0; n < 20000 && !s.cpu.stopped; n++) {
      if (!exec(m, s, p, true)) { s.acc = 0; return; }
      if (lineOf(s) !== start) break;
    }
  }
}
/* ---------------- derived values ---------------- */

export function blinkHz(s: Sim37): number {
  const e = s.ledEdges;
  if (e.length < 3) return 0;
  const t = cpuTime(s);
  const last = e[e.length - 1]!, prev = e[e.length - 3]!;
  if (t - last[0] > 3 * (last[0] - prev[0]) + 0.5) return 0;
  return 1 / (last[0] - prev[0]);
}
