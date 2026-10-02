import { useRef, useState } from "react";
import { activity, sampleActivity } from "../core/activity";
import type { Mcu } from "../core/mcu";
import { sizeOf } from "../core/cinterp";
import { useLab } from "../core/useLab";
import type { LabMeta } from "../registry";
import { CodeEditor } from "../ui/CodeEditor";
import { Icon } from "../ui/Icon";
import { LearningNotes, Panel, Seg, Toggle, hex } from "../ui/Panels";
import { LabShell } from "../ui/Shell";
import { PIN_NAMES, modeShort as modeOf } from "./stm32f1";

const REGS = `/* Core Lab 2 - Inside a Microcontroller */
/* Example: Configure Timer 2 to toggle an LED (PA5) */
#include "stm32f10x.h"

void timer2_init(void) {
    RCC->APB1ENR |= RCC_APB1ENR_TIM2EN;   // Enable Timer 2 clock
    TIM2->PSC = 7199;                      // 72 MHz / 7200 = 10 kHz
    TIM2->ARR = 4999;                      // 10 kHz / 5000 = 2 Hz
    TIM2->DIER |= TIM_DIER_UIE;            // Update interrupt
    TIM2->CR1 = TIM_CR1_CEN;               // Start timer
    NVIC_EnableIRQ(TIM2_IRQn);
}

void TIM2_IRQHandler(void) {
    if (TIM2->SR & TIM_SR_UIF) {
        TIM2->SR &= ~TIM_SR_UIF;           // clear flag
        GPIOA->ODR ^= (1 << 5);            // toggle LED
    }
}

int main(void) {
    SystemInit();
    // Configure PA5 as output (LED)
    RCC->APB2ENR |= RCC_APB2ENR_IOPAEN;
    GPIOA->CRL &= ~(0xF << 20);
    GPIOA->CRL |=  (0x2 << 20);            // output, 2 MHz, push-pull
    timer2_init();
    while (1) {
        __WFI();                           // sleep until an interrupt
    }
}
`;
const POLL = `/* Core Lab 2 - same LED, but the CPU polls the timer flag */
#include "stm32f10x.h"

int main(void) {
    RCC->APB2ENR |= RCC_APB2ENR_IOPAEN;
    GPIOA->CRL &= ~(0xF << 20);
    GPIOA->CRL |=  (0x2 << 20);
    RCC->APB1ENR |= RCC_APB1ENR_TIM2EN;
    TIM2->PSC = 7199;
    TIM2->ARR = 4999;
    TIM2->CR1 = TIM_CR1_CEN;
    while (1) {
        if (TIM2->SR & TIM_SR_UIF) {       // busy-wait on the flag
            TIM2->SR &= ~TIM_SR_UIF;
            GPIOA->ODR ^= (1 << 5);
        }
    }
}
`;
const UART = `/* Core Lab 2 - add a UART heartbeat on USART1 (PA9) */
#include "stm32f10x.h"

int ticks = 0;

void TIM2_IRQHandler(void) {
    TIM2->SR &= ~TIM_SR_UIF;
    GPIOA->ODR ^= (1 << 5);
    ticks++;
    printf("tick %d\\r\\n", ticks);
}

int main(void) {
    RCC->APB2ENR |= RCC_APB2ENR_IOPAEN | RCC_APB2ENR_USART1EN;
    GPIOA->CRL = (GPIOA->CRL & ~(0xF << 20)) | (0x2 << 20);
    RCC->APB1ENR |= RCC_APB1ENR_TIM2EN;
    TIM2->PSC = 7199;
    TIM2->ARR = 4999;
    TIM2->DIER |= TIM_DIER_UIE;
    TIM2->CR1 = TIM_CR1_CEN;
    NVIC_EnableIRQ(TIM2_IRQn);
    while (1) { __WFI(); }
}
`;

type P = { hseFail: boolean; gpioGate: boolean };
type Sub = "core" | "flash" | "sram" | "gpio" | "timers" | "adc" | "uart" | "spi" | "i2c" | "clock" | "nvic" | "bus";

const SUBS: Record<Sub, { label: string; type: string; arch: string; features: string[]; desc: string; color: string }> = {
  core: { label: "CPU Core (Cortex-M3)", type: "ARM Cortex-M3 (32-bit)", arch: "ARMv7-M (Thumb-2)", color: "#3b82f6", features: ["32-bit RISC processor", "3-stage pipeline", "NVIC interrupt controller", "Low power modes (Sleep / Stop / Standby)", "Single-cycle I/O access"], desc: "The CPU core executes program instructions, coordinates all peripherals, and handles interrupts. It communicates with memory and peripherals through the AHB/APB bus matrix." },
  flash: { label: "Flash Memory (512 KB)", type: "Embedded NOR Flash", arch: "64-bit prefetch buffer, 0x0800 0000", color: "#3b82f6", features: ["Holds the vector table and program code", "Wait states set in FLASH->ACR", "Retains data without power", "Erased in 2 KB pages"], desc: "Flash stores your compiled program. On reset the core reads the initial stack pointer and the reset vector from the first two words." },
  sram: { label: "SRAM (64 KB)", type: "Static RAM", arch: "Zero-wait-state, 0x2000 0000", color: "#22c55e", features: ["Global and static variables", "The stack (grows downward)", "Heap (if used)", "Lost when power is removed"], desc: "SRAM holds data that changes while the program runs: variables, the stack used by function calls and interrupts, and buffers." },
  gpio: { label: "GPIO (Ports A–E)", type: "General-purpose I/O", arch: "APB2, CRL/CRH/IDR/ODR/BSRR/BRR", color: "#3b82f6", features: ["Each pin: input, output, alternate or analog", "4-bit config nibble per pin (MODE + CNF)", "Atomic set/reset via BSRR / BRR", "5 V-tolerant pins"], desc: "GPIO pins connect the chip to LEDs, buttons and other devices. Software writes ODR to drive outputs and reads IDR to sense inputs." },
  timers: { label: "Timers (TIM1, TIM2, …)", type: "16-bit timers", arch: "APB1 / APB2, PSC + ARR + CCRx", color: "#f97316", features: ["Prescaler divides the timer clock", "Auto-reload sets the period", "Update / capture / compare interrupts", "PWM generation"], desc: "Timers count clock pulses independently of the CPU. An update event every (PSC+1)×(ARR+1) clocks can raise an interrupt." },
  adc: { label: "ADC (12-bit)", type: "Successive-approximation ADC", arch: "APB2, ADCCLK = PCLK2 / 6", color: "#a855f7", features: ["16 external channels", "1 µs conversion at 14 MHz", "Single, continuous and scan modes", "DMA support"], desc: "The ADC converts an analog voltage on a pin into a 12-bit number (0–4095) that software can read from ADC1->DR." },
  uart: { label: "UART (USART1/2/3)", type: "Universal sync/async transceiver", arch: "USART1 on APB2, USART2/3 on APB1", color: "#06b6d4", features: ["Baud rate from BRR", "8/9 data bits, parity, stop bits", "TXE / RXNE interrupts", "Hardware flow control"], desc: "USARTs send and receive serial bytes — the usual way to print debug messages to a PC terminal." },
  spi: { label: "SPI (SPI1/2)", type: "Serial Peripheral Interface", arch: "SPI1 on APB2, SPI2 on APB1", color: "#22c55e", features: ["Full duplex, up to 18 Mbit/s", "Master or slave", "4 clock modes (CPOL/CPHA)", "DMA support"], desc: "SPI is a fast 4-wire bus for displays, flash chips and sensors." },
  i2c: { label: "I²C (I2C1/2)", type: "Inter-Integrated Circuit", arch: "APB1, open-drain SDA/SCL", color: "#f59e0b", features: ["100 / 400 kHz", "7- and 10-bit addressing", "Multi-master", "SMBus support"], desc: "I²C is a 2-wire bus that lets many sensors share the same two pins, each with its own address." },
  clock: { label: "Clock System (PLL)", type: "RCC: HSE / HSI / PLL", arch: "8 MHz HSE × 9 = 72 MHz SYSCLK", color: "#38bdf8", features: ["8 MHz external crystal (HSE)", "8 MHz internal RC (HSI) fallback", "PLL multiplier ×2…×16", "AHB / APB1 / APB2 prescalers"], desc: "The clock system creates every clock in the chip. If the crystal fails, the Clock Security System falls back to the 8 MHz HSI and everything slows down." },
  nvic: { label: "Interrupt Controller (NVIC)", type: "Nested Vectored Interrupt Controller", arch: "60 maskable IRQs, 16 priority levels", color: "#ef4444", features: ["Hardware vectoring to *_IRQHandler", "Priority and pre-emption", "Tail-chaining", "Enable via ISER registers"], desc: "The NVIC decides which interrupt runs next and jumps directly to its handler — no polling needed." },
  bus: { label: "AHB / APB Bus Matrix", type: "Multi-layer AMBA bus", arch: "AHB 72 MHz, APB1 36 MHz, APB2 72 MHz", color: "#94a3b8", features: ["Connects core, DMA, memories and bridges", "APB1 limited to 36 MHz", "Bridges convert AHB → APB", "Arbitration between masters"], desc: "Every load or store the CPU makes to memory or a peripheral register travels across this bus matrix." },
};

function vectorImage(mcu: Mcu, source: string) {
  const handlers = new Set([...source.matchAll(/void\s+(\w+_(?:IRQ)?Handler)\s*\(/g)].map((m) => m[1]!));
  const names = ["_estack", "Reset_Handler", "NMI_Handler", "HardFault_Handler", "MemManage_Handler", "BusFault_Handler", "UsageFault_Handler", "", "", "", "", "SVC_Handler", "DebugMon_Handler", "", "PendSV_Handler", "SysTick_Handler"];
  const irqs: Record<number, string> = { 6: "EXTI0_IRQHandler", 18: "ADC1_2_IRQHandler", 28: "TIM2_IRQHandler", 29: "TIM3_IRQHandler", 37: "USART1_IRQHandler", 38: "USART2_IRQHandler", 40: "EXTI15_10_IRQHandler" };
  const words: Array<{ addr: number; value: number; name: string }> = [];
  let next = 0x08000140;
  for (let i = 0; i < 76; i++) {
    const name = i < 16 ? names[i]! : irqs[i - 16] ?? "";
    let value = 0;
    if (i === 0) value = 0x20010000;
    else if (name && (handlers.has(name) || name === "Reset_Handler")) { value = (next | 1) >>> 0; next += 0x40; }
    else if (name || i >= 16) value = 0x080001f1;
    words.push({ addr: 0x08000000 + i * 4, value, name: name || (i >= 16 ? `IRQ${i - 16}` : "reserved") });
  }
  void mcu;
  return words;
}

function Block({ x, y, w, h, color, title, sub, active, selected, onClick, big }: { x: number; y: number; w: number; h: number; color: string; title: string; sub?: string; active: boolean; selected: boolean; onClick: () => void; big?: boolean }) {
  return (
    <g className="mcl-l02-block" role="button" tabIndex={0} aria-pressed={selected} aria-label={`${title} block`} onClick={onClick} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}>
      {active ? <rect x={x - 3} y={y - 3} width={w + 6} height={h + 6} rx={10} fill="none" stroke={color} strokeWidth={4} opacity={0.55} filter="url(#l02-glow)" /> : null}
      <rect x={x} y={y} width={w} height={h} rx={8} fill={active ? `${color}55` : `${color}26`} stroke={selected ? "#fde047" : color} strokeWidth={selected ? 2.6 : 1.6} />
      <text x={x + w / 2} y={y + h / 2 + (sub ? (big ? -6 : -2) : 4)} textAnchor="middle" fill="#fff" fontSize={big ? 20 : 12} fontWeight={800}>{title}</text>
      {sub ? <text x={x + w / 2} y={y + h / 2 + (big ? 16 : 11)} textAnchor="middle" fill="#dbe7ff" fontSize={big ? 12 : 8.5}>{sub}</text> : null}
    </g>
  );
}

function Spark({ edges, t1, span = 2, w = 90, h = 16, initial = 0 }: { edges: Array<[number, number]> | undefined; t1: number; span?: number; w?: number; h?: number; initial?: number }) {
  const t0 = t1 - span;
  const e = edges ?? [];
  let lv = initial;
  for (const [t, l] of e) { if (t > t0) break; lv = l; }
  const pts: string[] = [`0,${lv ? 2 : h - 2}`];
  for (const [t, l] of e) { if (t <= t0 || t > t1) continue; const x = ((t - t0) / span) * w; pts.push(`${x.toFixed(1)},${lv ? 2 : h - 2}`, `${x.toFixed(1)},${l ? 2 : h - 2}`); lv = l; }
  pts.push(`${w},${lv ? 2 : h - 2}`);
  return <svg width={w} height={h} className="mcl-l02-spark" aria-hidden="true"><polyline points={pts.join(" ")} fill="none" stroke="#1769e0" strokeWidth={1.5} /></svg>;
}

export default function L02({ meta }: { meta: LabMeta }) {
  const lab = useLab<P>({
    slug: meta.slug, code: REGS, params: { hseFail: false, gpioGate: false },
    mcu: { part: "F103", strictClock: true },
    world: (m, _dt, p) => {
      m.clock = p.hseFail ? 8e6 : 72e6;
      if (p.gpioGate && (m.r("RCC.APB2ENR") & 4)) m.regs.set("RCC.APB2ENR", m.r("RCC.APB2ENR") & ~4);
      sampleActivity(m);
    },
  });
  const { mcu, params } = lab;
  const [sel, setSel] = useState<Sub>("core");
  const [visited, setVisited] = useState<Set<Sub>>(() => new Set(["core"]));
  const [flow, setFlow] = useState(true);
  const [memTab, setMemTab] = useState<"flash" | "sram" | "regs">("flash");
  const [regsSeen, setRegsSeen] = useState(false);
  const [port, setPort] = useState<"A" | "B" | "C">("A");
  const [half, setHalf] = useState<0 | 8>(0);
  const prevRegs = useRef(new Map<string, { v: number; t: number }>());

  const pick = (s: Sub) => { setSel(s); setVisited((v) => new Set(v).add(s)); };
  const act = activity(mcu, 1);
  const now = mcu.time;
  const sys = mcu.clock;
  const recent = (per: string) => (mcu.access.get(per)?.last ?? -1) > now - 0.15;
  const gpioEdges = mcu.edges.get("PA5");
  const lastEdge = gpioEdges?.length ? gpioEdges[gpioEdges.length - 1]![0] : -1;
  const timOn = (mcu.peek("TIM2.CR1") & 1) === 1 || (mcu.peek("TIM3.CR1") & 1) === 1;
  const lastIsr = mcu.fw?.isrLog.length ? mcu.fw.isrLog[mcu.fw.isrLog.length - 1]! : undefined;
  const uartLast = mcu.uart.log.length ? mcu.uart.log[mcu.uart.log.length - 1]!.t : -1;
  const lastTxn = mcu.bus.length ? mcu.bus[mcu.bus.length - 1]! : undefined;
  const coreActive = !!mcu.fw && !mcu.fw.error && act.load > 0.0005;
  const on: Record<Sub, boolean> = {
    core: coreActive || (lastIsr ? lastIsr.t0 > now - 0.12 : false),
    flash: coreActive, sram: coreActive,
    gpio: recent("GPIOA") || recent("GPIOB") || recent("GPIOC") || lastEdge > now - 0.15,
    timers: timOn, adc: recent("ADC1"), uart: uartLast > now - 0.2,
    spi: !!lastTxn && lastTxn.bus === "spi" && lastTxn.t > now - 0.2, i2c: !!lastTxn && lastTxn.bus === "i2c" && lastTxn.t > now - 0.2,
    clock: !!mcu.fw, nvic: lastIsr ? lastIsr.t0 > now - 0.15 : false, bus: act.busPerSec > 0 || coreActive,
  };
  const ld = mcu.level("PA5");
  const tim2 = { psc: mcu.peek("TIM2.PSC"), arr: mcu.peek("TIM2.ARR"), cnt: mcu.peek("TIM2.CNT"), en: (mcu.peek("TIM2.CR1") & 1) === 1 };
  const tim2Hz = tim2.en ? sys / (tim2.psc + 1) / (tim2.arr + 1) : 0;
  const instrPerSec = act.load * sys * 0.8;
  const transactions = instrPerSec * 1.1 + act.busPerSec;
  const util = Math.min(1, act.load * 0.74 + (act.busPerSec * 3) / sys);
  const gpioRate = (act.perSec.GPIOA ?? 0) + (act.perSec.GPIOB ?? 0) + (act.perSec.GPIOC ?? 0);
  const uartBits = mcu.uart.log.filter((b) => b.t > now - 1 && b.dir === "tx").length * 10;
  const globals = mcu.fw?.globalsList() ?? [];
  const sramUsed = globals.reduce((s, [, , ty]) => s + sizeOf(ty), 0);
  const codeBytes = 1536 + (lab.compiledCode.match(/;/g)?.length ?? 0) * 6 + 304;
  const irqTotal = [...mcu.irqCount.values()].reduce((a, b) => a + b, 0);

  const live: Record<Sub, Array<[string, string]>> = {
    core: [["State", !mcu.fw ? "No firmware" : mcu.fw.error ? "HardFault" : mcu.sleep !== "run" || act.load < 0.01 ? "Sleeping (WFI)" : "Running"], ["CPU load", `${(act.load * 100).toFixed(1)} %`], ["Interrupts taken", String(irqTotal)]],
    flash: [["Used (est.)", `${(codeBytes / 1024).toFixed(1)} KB of 512 KB`], ["Wait states", sys > 48e6 ? "2" : sys > 24e6 ? "1" : "0"], ["Vector table", "0x0800 0000"]],
    sram: [["Globals", `${sramUsed} B in ${globals.length} variables`], ["Initial SP", "0x2001 0000"], ["Stack", "grows down from top of SRAM"]],
    gpio: [["GPIOA->CRL", hex(mcu.peek("GPIOA.CRL"))], ["GPIOA->ODR", hex(mcu.peek("GPIOA.ODR"), 4)], ["PA5 (LED)", ld ? "HIGH" : "LOW"], ["Clock (IOPAEN)", mcu.clockEnabled("GPIOA") ? "enabled" : "GATED"]],
    timers: [["TIM2 PSC / ARR", `${tim2.psc} / ${tim2.arr}`], ["TIM2 CNT", String(tim2.cnt)], ["Update rate", tim2.en ? `${tim2Hz.toFixed(3)} Hz` : "stopped"]],
    adc: [["ADC1->DR", String(mcu.peek("ADC1.DR"))], ["Accesses / s", (act.perSec.ADC1 ?? 0).toFixed(0)]],
    uart: [["Baud", String(mcu.uart.baud)], ["Bytes sent", String(mcu.uart.log.filter((b) => b.dir === "tx").length)], ["Last text", JSON.stringify(mcu.uart.text.slice(-18))]],
    spi: [["Transactions", String(mcu.bus.filter((b) => b.bus === "spi").length)]],
    i2c: [["Transactions", String(mcu.bus.filter((b) => b.bus === "i2c").length)]],
    clock: [["Source", params.hseFail ? "HSI 8 MHz (CSS fallback)" : "HSE 8 MHz × PLL 9"], ["SYSCLK", `${sys / 1e6} MHz`], ["APB1 / APB2", `${Math.min(36, sys / 1e6)} / ${sys / 1e6} MHz`]],
    nvic: [["NVIC->ISER0", hex(mcu.peek("NVIC.ISER0"))], ["TIM2 IRQs", String(mcu.irqCount.get("TIM2") ?? 0)], ["Last ISR", lastIsr ? `${lastIsr.name} @ ${(lastIsr.t0).toFixed(3)} s` : "—"]],
    bus: [["Utilization", `${(util * 100).toFixed(1)} %`], ["MMIO accesses / s", act.busPerSec.toFixed(1)]],
  };
  const clockOf: Record<Sub, number> = { core: sys, flash: sys, sram: sys, gpio: sys, timers: sys, adc: sys / 6, uart: Math.min(36e6, sys), spi: sys, i2c: Math.min(36e6, sys), clock: 8e6, nvic: sys, bus: sys };
  const d = SUBS[sel];

  const regRows = ["GPIOA.CRL", "GPIOA.ODR", "GPIOA.IDR", "TIM2.CR1", "TIM2.DIER", "TIM2.SR", "TIM2.CNT", "TIM2.PSC", "TIM2.ARR", "RCC.APB1ENR", "RCC.APB2ENR", "NVIC.ISER0"].map((p) => {
    const v = mcu.peek(p);
    const prev = prevRegs.current.get(p);
    if (!prev || prev.v !== v) prevRegs.current.set(p, { v, t: now });
    return { p, v, addr: mcu.addrOf(p) ?? 0, changed: (prevRegs.current.get(p)?.t ?? -1) > now - 0.3 && p !== "TIM2.CNT" };
  });
  const sramWords: Array<{ addr: number; words: number[]; ascii: string }> = [];
  {
    const bytes: number[] = [];
    for (const [, v, ty] of globals) { const n = Math.max(1, Math.min(16, sizeOf(ty))); const x = typeof v === "number" ? v : 0; for (let k = 0; k < n; k++) bytes.push(k < 4 ? (x >>> (8 * k)) & 0xff : 0); while (bytes.length % Math.min(4, n)) bytes.push(0); }
    while (bytes.length < 128) bytes.push(0);
    for (let r = 0; r < 8; r++) { const row = bytes.slice(r * 16, r * 16 + 16); sramWords.push({ addr: 0x20000000 + r * 16, words: [0, 1, 2, 3].map((w) => (row[w * 4]! | (row[w * 4 + 1]! << 8) | (row[w * 4 + 2]! << 16) | (row[w * 4 + 3]! << 24)) >>> 0), ascii: row.map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : ".")).join("") }); }
  }
  const vec = vectorImage(mcu, lab.compiledCode);

  const per = (y: number) => `M455 271 H466 V${y} H478`;
  const flowCls = (a: boolean) => (flow && a ? "mcl-l02-flow on" : "mcl-l02-flow");

  return (
    <LabShell meta={meta} lab={lab} subtitle="Explore the CPU core, memory, GPIO, timers, ADC, buses, and peripherals on a microcontroller. Click on each block to learn how it works."
      components={["STM32F103RE (Cortex-M3, 72 MHz, 512 KB Flash, 64 KB SRAM)", "8 MHz HSE crystal", "LED on PA5"]}>
      <div className="mcl-grid mcl-l02-grid">
        <Panel title="Microcontroller Architecture (Interactive)" icon="chip" className="mcl-sim mcl-l02-arch" tools={<span className={`mcl-chip ${lab.status === "running" ? "mcl-chip-live" : ""}`}>{lab.status === "running" ? "Real-time" : lab.status}</span>}>
          <div className="mcl-l02-stage">
            <svg viewBox="0 0 760 410" className="mcl-svg" role="img" aria-label="Interactive block diagram of the STM32F103 microcontroller">
              <defs>
                <filter id="l02-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5" /></filter>
                <linearGradient id="l02-bg" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#0b1324" /><stop offset="1" stopColor="#111c33" /></linearGradient>
                <linearGradient id="l02-xtal" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#e5e7eb" /><stop offset="1" stopColor="#8b95a1" /></linearGradient>
              </defs>
              <rect width="760" height="410" fill="url(#l02-bg)" />
              {Array.from({ length: 14 }, (_, i) => <path key={i} d={`M0 ${20 + i * 29} H${40 + (i % 3) * 30} l20 14 H150`} stroke="#1d2b47" fill="none" />)}
              <rect x="150" y="18" width="448" height="376" rx="16" fill="#0d1628" stroke="#33415c" strokeWidth="2" />
              {Array.from({ length: 22 }, (_, i) => <g key={i}><rect x={168 + i * 19} y="10" width="8" height="8" fill="#9aa4b2" /><rect x={168 + i * 19} y="394" width="8" height="8" fill="#9aa4b2" /></g>)}
              {Array.from({ length: 18 }, (_, i) => <g key={i}><rect x="142" y={34 + i * 19.5} width="8" height="8" fill="#9aa4b2" /><rect x="598" y={34 + i * 19.5} width="8" height="8" fill="#9aa4b2" /></g>)}
              <rect x="12" y="24" width="124" height="66" rx="8" fill="#0f172a" stroke="#475569" />
              <text x="22" y="46" fill="#fff" fontSize="14" fontWeight="800">STM32F103</text>
              <text x="22" y="64" fill="#cbd5e1" fontSize="12">Cortex-M3</text>
              <text x="22" y="81" fill={params.hseFail ? "#fbbf24" : "#cbd5e1"} fontSize="12">{sys / 1e6} MHz</text>

              <g className="mcl-l02-block" role="button" tabIndex={0} aria-label="8 MHz crystal" onClick={() => pick("clock")} onKeyDown={(e) => { if (e.key === "Enter") pick("clock"); }}>
                <rect x="40" y="170" width="62" height="34" rx="12" fill="url(#l02-xtal)" stroke={params.hseFail ? "#ef4444" : "#64748b"} strokeWidth={params.hseFail ? 2.4 : 1} />
                <text x="71" y="191" textAnchor="middle" fontSize="8" fill="#334155" fontWeight="700">{params.hseFail ? "FAILED" : "8.000"}</text>
                <rect x="34" y="214" width="74" height="34" rx="6" fill="#0f172a" stroke="#475569" />
                <text x="71" y="228" textAnchor="middle" fill="#e2e8f0" fontSize="10" fontWeight="700">8 MHz</text>
                <text x="71" y="241" textAnchor="middle" fill="#e2e8f0" fontSize="10">Crystal</text>
              </g>
              <path d="M71 248 V272" stroke="#38bdf8" strokeWidth="2" className={flowCls(!params.hseFail && on.clock)} />
              <Block x={14} y={274} w={124} h={52} color="#38bdf8" title="Clock System" sub={params.hseFail ? "(HSI fallback)" : "(PLL ×9)"} active={on.clock} selected={sel === "clock"} onClick={() => pick("clock")} />
              <path d="M138 300 H170 V180 H205" stroke="#38bdf8" strokeWidth="2" fill="none" className={flowCls(on.clock)} />

              <Block x={208} y={44} w={112} h={56} color="#3b82f6" title="Flash" sub="(512 KB)" active={on.flash} selected={sel === "flash"} onClick={() => pick("flash")} />
              <Block x={346} y={44} w={108} h={56} color="#22c55e" title="SRAM" sub="(64 KB)" active={on.sram} selected={sel === "sram"} onClick={() => pick("sram")} />
              <path d="M258 100 V128 M270 128 V100" stroke="#ef4444" strokeWidth="2.4" className={flowCls(on.flash)} />
              <path d="M394 100 V128 M406 128 V100" stroke="#22c55e" strokeWidth="2.4" className={flowCls(on.sram)} />
              <Block x={205} y={130} w={250} h={100} color="#3b82f6" title="ARM" sub="Cortex-M3 · CPU Core" big active={on.core} selected={sel === "core"} onClick={() => pick("core")} />
              <path d="M330 230 V256" stroke="#e2e8f0" strokeWidth="2.4" className={flowCls(on.bus)} />
              <Block x={205} y={258} w={250} h={28} color="#94a3b8" title="AHB / APB Bus Matrix" active={on.bus} selected={sel === "bus"} onClick={() => pick("bus")} />
              <path d="M330 286 V310" stroke="#ef4444" strokeWidth="2.4" className={flowCls(on.nvic)} />
              <Block x={268} y={312} w={124} h={58} color="#ef4444" title="Interrupt" sub="Controller (NVIC)" active={on.nvic} selected={sel === "nvic"} onClick={() => pick("nvic")} />

              {(["gpio", "timers", "adc", "uart", "spi", "i2c"] as const).map((s, i) => {
                const y = 40 + i * 56;
                const sub = { gpio: "(Ports A–E)", timers: "(TIM1, TIM2, …)", adc: "(12-bit)", uart: "(USART1/2/3)", spi: "(SPI1/2)", i2c: "(I2C1/2)" }[s];
                const title = { gpio: "GPIO", timers: "Timers", adc: "ADC", uart: "UART", spi: "SPI", i2c: "I²C" }[s];
                return (
                  <g key={s}>
                    <path d={per(y + 22)} stroke={SUBS[s].color} strokeWidth="2" fill="none" className={flowCls(on[s])} />
                    <Block x={478} y={y} w={108} h={44} color={SUBS[s].color} title={title} sub={sub} active={on[s]} selected={sel === s} onClick={() => pick(s)} />
                  </g>
                );
              })}
              <circle cx="618" cy="62" r="7" fill={ld ? "#22c55e" : "#1f2937"} stroke="#64748b" filter={ld ? "url(#l02-glow)" : undefined} />
              <circle cx="618" cy="62" r="5" fill={ld ? "#4ade80" : "#334155"} />
              <path d="M586 62 H611" stroke="#64748b" strokeDasharray="2 2" />
              <text x="632" y="66" fill="#cbd5e1" fontSize="10">PA5 LED</text>
              <text x="640" y="386" fill="#64748b" fontSize="22" fontWeight="900" fontStyle="italic">ST</text>
            </svg>
            <label className="mcl-l02-flowtoggle"><input type="checkbox" checked={flow} onChange={(e) => setFlow(e.target.checked)} /> Show Signal Flow</label>
          </div>
        </Panel>

        <Panel title="Subsystem Inspector" icon="target" className="mcl-l02-insp">
          <select className="mcl-input mcl-l02-select" value={sel} onChange={(e) => pick(e.target.value as Sub)} aria-label="Subsystem">
            {(Object.keys(SUBS) as Sub[]).map((s) => <option key={s} value={s}>{SUBS[s].label}</option>)}
          </select>
          <dl className="mcl-l02-dl">
            <div><dt>Type</dt><dd>{d.type}</dd></div>
            <div><dt>Clock Speed</dt><dd>{(clockOf[sel] / 1e6).toFixed(clockOf[sel] % 1e6 ? 1 : 0)} MHz</dd></div>
            <div><dt>Architecture</dt><dd>{d.arch}</dd></div>
            <div><dt>Key Features</dt><dd><ul>{d.features.map((f) => <li key={f}>{f}</li>)}</ul></dd></div>
          </dl>
          <p className="mcl-l02-desc">{d.desc}</p>
          <dl className="mcl-l02-live">{live[sel].map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
          <div className="mcl-l02-faults">
            <Toggle label="HSE crystal failure" checked={params.hseFail} onChange={(v) => lab.setParam("hseFail", v)} hint="Clock Security System falls back to the 8 MHz HSI" />
            <Toggle label="Gate GPIOA clock" checked={params.gpioGate} onChange={(v) => lab.setParam("gpioGate", v)} hint="Clears RCC->APB2ENR.IOPAEN — GPIOA writes are ignored" />
          </div>
          <p className="mcl-l02-tip"><Icon name="bulb" size={18} />Try clicking different blocks to explore each subsystem!</p>
        </Panel>

        <div className="mcl-col">
          <Panel title="Peripheral Activity" icon="wave" tools={<span className={`mcl-chip ${lab.status === "running" ? "mcl-chip-live" : ""}`}>Live</span>}>
            <table className="mcl-table mcl-l02-act">
              <thead><tr><th>Peripheral</th><th>Status</th><th>Activity</th></tr></thead>
              <tbody>
                <tr><td>CPU Core</td><td><i className={on.core ? "ok" : ""} />{mcu.sleep !== "run" || act.load < 0.01 ? "Sleep" : "Running"}</td><td><span className="mcl-bar"><i style={{ width: `${act.load * 100}%` }} /></span><em>{(act.load * 100).toFixed(0)}%</em></td></tr>
                <tr><td>Flash Memory</td><td><i className={on.flash ? "ok" : ""} />{on.flash ? "Active" : "Idle"}</td><td><span className="mcl-bar"><i style={{ width: `${act.load * 67}%` }} /></span><em>{(act.load * 67).toFixed(0)}%</em></td></tr>
                <tr><td>SRAM</td><td><i className={on.sram ? "ok" : ""} />{on.sram ? "Active" : "Idle"}</td><td><span className="mcl-bar"><i style={{ width: `${act.load * 45}%` }} /></span><em>{(act.load * 45).toFixed(0)}%</em></td></tr>
                <tr><td>GPIO</td><td><i className={on.gpio ? "ok" : ""} />{gpioRate > 0 || on.gpio ? "Toggle" : "Idle"}</td><td><Spark edges={gpioEdges} t1={now} /></td></tr>
                <tr><td>Timer 2</td><td><i className={tim2.en ? "ok" : ""} />{tim2.en ? "Counting" : "Stopped"}</td><td><span className="mcl-bar"><i style={{ width: `${tim2.arr ? (tim2.cnt / tim2.arr) * 100 : 0}%` }} /></span><em>{tim2.cnt}</em></td></tr>
                <tr><td>ADC</td><td><i className={on.adc ? "ok" : ""} />{on.adc ? "Converting" : "Idle"}</td><td><em>{(act.perSec.ADC1 ?? 0).toFixed(0)}/s</em></td></tr>
                <tr><td>UART</td><td><i className={on.uart ? "ok" : ""} />{on.uart ? `TX (${(uartBits / 1000).toFixed(2)} kbps)` : "Idle"}</td><td><span className="mcl-bar"><i style={{ width: `${Math.min(100, (uartBits / mcu.uart.baud) * 100)}%` }} /></span></td></tr>
                <tr><td>SPI</td><td><i className={on.spi ? "ok" : ""} />{on.spi ? "Active" : "Idle"}</td><td /></tr>
                <tr><td>I²C</td><td><i className={on.i2c ? "ok" : ""} />{on.i2c ? "Active" : "Idle"}</td><td /></tr>
              </tbody>
            </table>
          </Panel>
          <Panel title="Bus Traffic" icon="link" tools={<span className="mcl-l02-legend"><i className="ahb" />AHB <i className="apb" />APB</span>}>
            <svg viewBox="0 0 300 140" className="mcl-svg" role="img" aria-label="Bus traffic between CPU, bus matrix, memories and peripherals">
              {[["Flash", 70, 6, on.flash], ["SRAM", 140, 6, on.sram]].map(([n, x, y, a]) => <g key={String(n)}><path d={`M${Number(x) + 25} ${Number(y) + 20} V58`} stroke="#1769e0" strokeWidth={a ? 3 : 1.4} className={flowCls(Boolean(a))} /><rect x={Number(x)} y={Number(y)} width="50" height="20" rx="4" fill="#e8f1ff" stroke="#1769e0" /><text x={Number(x) + 25} y={Number(y) + 14} textAnchor="middle" fontSize="9" fontWeight="700" fill="#0f2547">{n}</text></g>)}
              <path d="M52 78 H90" stroke="#1769e0" strokeWidth={on.core ? 3 : 1.4} className={flowCls(on.core)} />
              <rect x="6" y="62" width="46" height="34" rx="5" fill="#1769e0" /><text x="29" y="77" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="800">CPU</text><text x="29" y="88" textAnchor="middle" fill="#dbeafe" fontSize="7">Cortex-M3</text>
              <rect x="90" y="58" width="96" height="40" rx="6" fill="#dbe7f7" stroke="#1769e0" /><text x="138" y="82" textAnchor="middle" fontSize="10" fontWeight="800" fill="#0f2547">Bus Matrix</text>
              {[["Timers", on.timers], ["UART", on.uart], ["GPIO", on.gpio], ["ADC", on.adc]].map(([n, a], i) => <g key={String(n)}><path d={`M186 78 H205 V${16 + i * 32} H238`} stroke="#f59e0b" strokeDasharray="4 3" strokeWidth={a ? 3 : 1.4} fill="none" className={flowCls(Boolean(a))} /><rect x="238" y={6 + i * 32} width="56" height="20" rx="4" fill="#fff7e6" stroke="#f59e0b" /><text x="266" y={20 + i * 32} textAnchor="middle" fontSize="9" fontWeight="700" fill="#7c4a03">{n}</text></g>)}
            </svg>
            <div className="mcl-l02-util">
              <span>Bus Utilization <b>{(util * 100).toFixed(0)}%</b></span>
              <span>Transactions/s <b>{transactions >= 1e6 ? `${(transactions / 1e6).toFixed(1)} M` : transactions >= 1e3 ? `${(transactions / 1e3).toFixed(1)} K` : transactions.toFixed(0)}</b></span>
            </div>
            <span className="mcl-bar"><i style={{ width: `${util * 100}%` }} /></span>
          </Panel>
        </div>

        <CodeEditor lab={lab} className="mcl-l02-code" languages={[{ label: "C (STM32)", code: REGS }, { label: "C (Polling)", code: POLL }, { label: "C (UART heartbeat)", code: UART }]} />

        <Panel title="Memory Snapshot" icon="memory" className="mcl-l02-mem">
          <Seg size="sm" value={memTab} onChange={(v) => { setMemTab(v); if (v === "regs") setRegsSeen(true); }} options={[{ value: "flash", label: "Flash" }, { value: "sram", label: "SRAM" }, { value: "regs", label: "Peripheral Regs" }]} />
          <div className="mcl-l02-hex">
            {memTab === "flash" ? (
              <table className="mcl-table mcl-mono">
                <thead><tr><th>Address</th><th>Word</th><th>Vector</th></tr></thead>
                <tbody>{vec.filter((w, i) => i < 16 || w.value !== 0x080001f1).slice(0, 18).map((w) => <tr key={w.addr} className={w.name === "TIM2_IRQHandler" ? "hl" : ""}><td>{hex(w.addr)}</td><td>{hex(w.value)}</td><td>{w.name}</td></tr>)}</tbody>
              </table>
            ) : memTab === "sram" ? (
              <table className="mcl-table mcl-mono">
                <thead><tr><th>Address</th><th>00</th><th>04</th><th>08</th><th>0C</th><th>ASCII</th></tr></thead>
                <tbody>{sramWords.map((r) => <tr key={r.addr}><td>{hex(r.addr)}</td>{r.words.map((w, i) => <td key={i}>{hex(w).slice(2)}</td>)}<td>{r.ascii}</td></tr>)}</tbody>
              </table>
            ) : (
              <table className="mcl-table mcl-mono">
                <thead><tr><th>Register</th><th>Address</th><th>Value</th></tr></thead>
                <tbody>{regRows.map((r) => <tr key={r.p} className={r.changed ? "hl" : ""}><td>{r.p.replace(".", "->")}</td><td>{hex(r.addr)}</td><td>{hex(r.v)}</td></tr>)}</tbody>
              </table>
            )}
          </div>
          <div className="mcl-l02-memfoot">
            {memTab === "sram" ? <><span>SRAM Size: <b>64 KB</b></span><span>Globals: <b>{sramUsed} B</b></span></> : <><span>Flash Size: <b>512 KB</b></span><span>Used (est.): <b>{(codeBytes / 1024).toFixed(1)} KB ({((codeBytes / 524288) * 100).toFixed(1)}%)</b></span></>}
          </div>
          <span className="mcl-bar"><i style={{ width: `${Math.max(1, memTab === "sram" ? (sramUsed / 65536) * 100 : (codeBytes / 524288) * 100)}%` }} /></span>
        </Panel>

        <Panel title="Pin Overview (GPIO Mapping)" icon="grid" className="mcl-l02-pins">
          <div className="mcl-row">
            <select className="mcl-input" value={port} onChange={(e) => setPort(e.target.value as "A" | "B" | "C")} aria-label="GPIO port">{(["A", "B", "C"] as const).map((p) => <option key={p} value={p}>Port {p}</option>)}</select>
            <Seg size="sm" value={half} onChange={setHalf} options={[{ value: 0, label: "0–7" }, { value: 8, label: "8–15" }]} />
          </div>
          <table className="mcl-table mcl-l02-pintable">
            <thead><tr><th>Pin</th><th>Name</th><th>Mode</th><th>State</th></tr></thead>
            <tbody>
              {Array.from({ length: 8 }, (_, i) => {
                const n = half + i, key = `P${port}${n}`;
                const nib = (mcu.peek(`GPIO${port}.${n < 8 ? "CRL" : "CRH"}`) >>> ((n & 7) * 4)) & 0xf;
                const mode = modeOf(nib);
                const lv = mcu.level(key);
                const input = (nib & 3) === 0;
                return (
                  <tr key={key} className={key === "PA5" ? "hl" : ""}>
                    <td>{key}</td><td>{PIN_NAMES[port]![n]}</td><td>{mode}</td>
                    <td>{input ? <button type="button" className={`mcl-l02-pinbtn ${lv ? "hi" : ""}`} title="Click to drive this input from outside" onClick={() => mcu.setInput(key, lv ? 0 : 1)}><i />{lv ? "High" : "Low"}</button> : <span className={`mcl-l02-pinst ${lv ? "hi" : ""}`}><i />{lv ? "High" : "Low"}</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>

        <LearningNotes variant="tasks" notes={{
          takeaways: [],
          observe: "Watch which blocks light up: the core sleeps in __WFI() and wakes only when TIM2 interrupts.",
          tryIt: "Click each block — Flash, SRAM, Timers, NVIC — and read its live values in the inspector.",
          measure: "Switch to the 'C (Polling)' variant and compare CPU load and bus utilization.",
          modify: "Change TIM2->ARR to 999 and Run — the LED and the Timer 2 activity bar speed up 5×.",
          runAgain: "Inject the HSE crystal failure: SYSCLK drops to 8 MHz and the LED slows down 9×.",
          challenge: "Tip: click on each block in the diagram to learn more, and try modifying the code to see how different peripherals work together!",
          checks: [
            { label: "Understand the main blocks inside a microcontroller (visit 4 blocks)", done: visited.size >= 4 },
            { label: "Learn how the CPU, memory, and peripherals communicate via buses", done: act.busPerSec > 0 && visited.has("bus") },
            { label: "Explore the role of the clock system and resets", done: visited.has("clock") && params.hseFail },
            { label: "See how interrupts connect peripherals to the CPU", done: (mcu.irqCount.get("TIM2") ?? 0) > 0 && visited.has("nvic") },
            { label: "Examine real register values while the system runs", done: regsSeen && lab.status === "running" },
          ],
        }} />
      </div>
    </LabShell>
  );
}
