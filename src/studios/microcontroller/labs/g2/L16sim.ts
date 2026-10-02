import type { Firmware } from "../core/cinterp";
import type { Mcu } from "../core/mcu";

export const DEMO = `#include "stm32f4xx.h"

volatile uint32_t ticks = 0;
volatile uint32_t work = 0;

void TIM2_IRQHandler(void)
{
    TIM2->SR &= ~TIM_SR_UIF;          // clear the update flag first
    GPIOA->ODR ^= (1 << 5);           // toggle LD2
    ticks++;
}

int main(void)
{
    RCC->AHB1ENR |= RCC_AHB1ENR_GPIOAEN;
    RCC->APB1ENR |= RCC_APB1ENR_TIM2EN;
    GPIOA->MODER |= (1 << (5*2));

    TIM2->PSC = 15999;                // 16 MHz / 16000 = 1 kHz
    TIM2->ARR = 499;                  // update event every 500 ms
    TIM2->DIER |= TIM_DIER_UIE;
    TIM2->CR1 |= TIM_CR1_CEN;

    NVIC_SetPriority(TIM2_IRQn, 2);
    NVIC_EnableIRQ(TIM2_IRQn);

    while (1)
    {
        work++;                       // the thread that gets interrupted
    }
}
`;

export const NO_CLEAR = DEMO.replace("    TIM2->SR &= ~TIM_SR_UIF;          // clear the update flag first\n", "    // BUG: UIF is never cleared, so the IRQ stays pending\n");

export const LONG_ISR = DEMO.replace("    ticks++;\n}", "    ticks++;\n    for (uint32_t i = 0; i < 40; i++) { __NOP(); }   // too much work in the ISR\n}");

export const CRITICAL = DEMO.replace(
  "        work++;                       // the thread that gets interrupted\n",
  "        __disable_irq();              // PRIMASK = 1: critical section\n        NVIC_SetPendingIRQ(TIM2_IRQn);  // request arrives inside it\n        for (uint32_t i = 0; i < 30; i++) { work++; }\n        __enable_irq();               // pending IRQ is taken here\n        HAL_Delay(200);\n",
);

/** Cortex-M4 exception timing with zero-wait-state memory. */
export const ENTRY_CYC = 12, EXIT_CYC = 10, TAIL_CYC = 6;
/** Modelled cost of one simple C statement (load, modify, store) in core cycles. */
export const CYC_PER_STMT = 4;
/** No SystemClock_Config in these examples, so the core stays on the 16 MHz HSI after reset. */
export const CORE_HZ = 16e6;
export const IRQN = 28, EXC_NUM = 16 + IRQN;
export const MSP_THREAD = 0x20017ff8;
export const pcOf = (line: number) => (0x08000200 + line * 8) >>> 0;

export type Phase = "main" | "request" | "stacking" | "isr" | "return";
export const PHASES: Array<{ key: Phase; label: string }> = [
  { key: "main", label: "Main Code" }, { key: "request", label: "IRQ Request" }, { key: "stacking", label: "Stacking" }, { key: "isr", label: "ISR" }, { key: "return", label: "Return" },
];

/** `blocked`: something architectural (PRIMASK, NVIC enable, another active ISR) held the request off when it arrived. */
export interface IrqEvent { id: number; name: string; tReq: number; t0: number; t1: number; stmts: number; line: number; tail: boolean; nested: boolean; src: "timer" | "software"; blocked: boolean }
export interface Seq { phase: Phase; pend: boolean; stackedLine: number; isrStmts: number; cycles: number }
interface St16 {
  events: IrqEvent[];
  open: IrqEvent[];
  req: Map<string, { t: number; line: number; src: "timer" | "software"; blocked: boolean }>;
  nextSrc: "timer" | "software";
  seq: Seq;
  primaskForced: boolean;
  seqId: number;
  patched: WeakSet<Firmware>;
}
const STATE = new WeakMap<Mcu, St16>();
export function state16(m: Mcu): St16 {
  let s = STATE.get(m);
  if (!s) {
    s = { events: [], open: [], req: new Map(), nextSrc: "timer", seq: { phase: "main", pend: false, stackedLine: 0, isrStmts: 0, cycles: 0 }, primaskForced: false, seqId: 0, patched: new WeakSet() };
    STATE.set(m, s);
  }
  return s;
}

export const mainLine = (m: Mcu) => m.fw?.threads.find((t) => t.kind === "main")?.line ?? 0;
export const isrActive = (m: Mcu) => !!m.fw?.threads.some((t) => t.kind === "isr" && t.state !== "done");

export type P16 = { primask: boolean; nvicOff: boolean };
export const P16_DEFAULT: P16 = { primask: false, nvicOff: false };

/** Record when each IRQ is requested (the NVIC sets its pending bit), even if PRIMASK or the enable bit holds it off. */
export function trackRequests(m: Mcu) {
  const s = state16(m);
  const orig = m.deliver.bind(m);
  m.deliver = (irq, handler, args, prio, cb, cbArgs) => {
    const key = handler || cb || irq;
    if (!s.req.has(key)) {
      const blocked = !!m.fw && (!m.fw.globalIrqEnabled || isrActive(m) || (irq !== "SysTick" && !m.nvicEnabled(irq)));
      s.req.set(key, { t: m.now, line: mainLine(m), src: s.nextSrc, blocked });
    }
    s.nextSrc = "timer";
    orig(irq, handler, args, prio, cb, cbArgs);
  };
}

export const setup16 = trackRequests;

/** Time every ISR run (entry, exit, statements executed). Safe to call every step; patches each firmware once. */
export function trackIrqs(m: Mcu) {
  const fw = m.fw;
  if (!fw) return;
  const s = state16(m);
  if (s.patched.has(fw)) return;
  s.patched.add(fw);
  const raise = fw.raise.bind(fw);
  fw.raise = (handler, prio, args) => {
    const ok = raise(handler, prio, args);
    if (!ok) return ok;
    const r = s.req.get(handler);
    s.req.delete(handler);
    const prev = s.events[s.events.length - 1];
    const nested = s.open.length > 0;
    const ev: IrqEvent = { id: ++s.seqId, name: handler, tReq: r?.t ?? fw.time, t0: fw.time, t1: NaN, stmts: fw.statements, line: r?.line ?? mainLine(m), tail: !nested && !!prev && Math.abs(prev.t1 - fw.time) < 1.5 / fw.ips, nested, src: r?.src ?? "timer", blocked: r?.blocked ?? false };
    s.open.push(ev);
    return ok;
  };
  const exit = fw.onIsrExit;
  fw.onIsrExit = (name) => {
    const k = s.open.map((e) => e.name).lastIndexOf(name);
    if (k >= 0) {
      const ev = s.open.splice(k, 1)[0]!;
      ev.t1 = fw.time;
      ev.stmts = Math.max(1, fw.statements - ev.stmts);
      s.events.push(ev);
      if (s.events.length > 60) s.events.splice(0, s.events.length - 60);
    }
    exit?.(name);
  };
}

export function world16(m: Mcu, _dt: number, p: P16) {
  const fw = m.fw;
  if (!fw) return;
  trackIrqs(m);
  const s = state16(m);
  if (p.primask) { fw.globalIrqEnabled = false; s.primaskForced = true; }
  else if (s.primaskForced) { fw.globalIrqEnabled = true; s.primaskForced = false; }
  if (p.nvicOff) {
    if (fw.irqEnabled.has("TIM2") || m.peek("NVIC.ISER0") & (1 << IRQN) || m.nvicEnabled("TIM2")) { fw.irqEnabled.delete("TIM2"); m.write("NVIC.ICER0", 1 << IRQN); }
  }
}

/** Software-pend TIM2 through NVIC->ISPR0, the same path NVIC_SetPendingIRQ uses. */
export function pend(m: Mcu) {
  state16(m).nextSrc = "software";
  m.write("NVIC.ISPR0", 1 << IRQN);
}

export interface Breakdown { heldUs: number; entry: number; isr: number; exit: number; total: number }
export function breakdown(e: IrqEvent): Breakdown {
  const entry = e.tail ? TAIL_CYC : ENTRY_CYC;
  const isr = e.stmts * CYC_PER_STMT;
  // Unblocked requests only wait for the interpreter's statement boundary, which is not real core latency.
  return { heldUs: e.blocked ? Math.max(0, e.t0 - e.tReq) * 1e6 : 0, entry, isr, exit: EXIT_CYC, total: entry + isr + EXIT_CYC };
}

/** Execute exactly one C statement of whichever thread the core picks next. */
export function stepOnce(m: Mcu, world: () => void, limitMs = 400) {
  const fw = m.fw;
  if (!fw || fw.error) return;
  fw.step("into");
  for (let k = 0; k < limitMs && !fw.paused && !fw.error; k++) { world(); m.tick(0.001); }
}

/** Advance the exception sequence by one phase (or one ISR statement). Returns a message when the core cannot proceed. */
export function stepPhase(m: Mcu, world: () => void): string {
  const fw = m.fw, s = state16(m), q = s.seq;
  if (!fw || fw.error) return "The firmware is not running.";
  switch (q.phase) {
    case "main":
      if (q.pend) { q.phase = "request"; q.cycles = 0; return ""; }
      stepOnce(m, world);
      if (isrActive(m)) { q.phase = "isr"; q.stackedLine = s.open[s.open.length - 1]?.line ?? mainLine(m); q.cycles = ENTRY_CYC; q.isrStmts = 0; }
      return "";
    case "request":
      if (!fw.globalIrqEnabled) return "PRIMASK = 1, so the NVIC keeps TIM2 pending. Clear PRIMASK and Step again.";
      if (!m.nvicEnabled("TIM2")) return "TIM2 is pending but disabled in NVIC_ISER0, so the core never takes it.";
      q.phase = "stacking"; q.stackedLine = mainLine(m); q.cycles = ENTRY_CYC;
      return "";
    case "stacking":
      q.phase = "isr"; q.pend = false;
      pend(m);
      stepOnce(m, world);
      q.isrStmts = 1; q.cycles += CYC_PER_STMT;
      if (!isrActive(m)) { q.phase = "return"; q.cycles += EXIT_CYC; }
      return "";
    case "isr":
      stepOnce(m, world);
      q.isrStmts++; q.cycles += CYC_PER_STMT;
      if (!isrActive(m)) { q.phase = "return"; q.cycles += EXIT_CYC; }
      return "";
    case "return":
      q.phase = "main";
      return "";
  }
}

/** Why a pending request has not been taken yet, or "" if nothing is pending. */
export function pendingReason(m: Mcu): string {
  const s = state16(m);
  if (!s.req.size && !s.seq.pend) return "";
  if (m.fw && !m.fw.globalIrqEnabled) return "PRIMASK = 1 masks it";
  if (!m.nvicEnabled("TIM2")) return "TIM2 is not enabled in NVIC_ISER0";
  return s.seq.pend ? "waiting for Step" : "about to be taken";
}
