import { useRef, useState } from "react";
import type { BusAccess, Mcu } from "../core/mcu";
import { useLab } from "../core/useLab";
import type { LabMeta } from "../registry";
import { CodeEditor } from "../ui/CodeEditor";
import { HwDefs, NucleoBoard, Potentiometer, SvgButton, SvgLed, Wire } from "../ui/Hardware";
import { Icon } from "../ui/Icon";
import { LearningNotes, Panel, Seg, Toggle, hex } from "../ui/Panels";
import { LabShell } from "../ui/Shell";

const DEMO = `// Core Lab 9 - Memory-Mapped I/O (STM32F401, no HAL)
#include "stm32f4xx.h"
#include <stdio.h>

// Every peripheral register is just an address on the bus
#define RCC_AHB1ENR  (*(volatile uint32_t *)0x40023830)
#define RCC_APB1ENR  (*(volatile uint32_t *)0x40023840)
#define RCC_APB2ENR  (*(volatile uint32_t *)0x40023844)

#define GPIOA_BASE   0x40020000
#define GPIOB_BASE   0x40020400
#define GPIOC_BASE   0x40020800
#define GPIOA_MODER  (*(volatile uint32_t *)(GPIOA_BASE + 0x00))
#define GPIOA_PUPDR  (*(volatile uint32_t *)(GPIOA_BASE + 0x0C))
#define GPIOA_IDR    (*(volatile uint32_t *)(GPIOA_BASE + 0x10))
#define GPIOA_AFRL   (*(volatile uint32_t *)(GPIOA_BASE + 0x20))
#define GPIOB_MODER  (*(volatile uint32_t *)(GPIOB_BASE + 0x00))
#define GPIOB_ODR    (*(volatile uint32_t *)(GPIOB_BASE + 0x14))
#define GPIOC_MODER  (*(volatile uint32_t *)(GPIOC_BASE + 0x00))
#define GPIOC_ODR    (*(volatile uint32_t *)(GPIOC_BASE + 0x14))

#define TIM2_CR1     (*(volatile uint32_t *)0x40000000)
#define TIM2_CNT     (*(volatile uint32_t *)0x40000024)
#define TIM2_PSC     (*(volatile uint32_t *)0x40000028)
#define TIM2_ARR     (*(volatile uint32_t *)0x4000002C)

#define ADC1_SR      (*(volatile uint32_t *)0x40012000)
#define ADC1_CR2     (*(volatile uint32_t *)0x40012008)
#define ADC1_SQR3    (*(volatile uint32_t *)0x40012034)
#define ADC1_DR      (*(volatile uint32_t *)0x4001204C)

#define USART2_SR    (*(volatile uint32_t *)0x40004400)
#define USART2_DR    (*(volatile uint32_t *)0x40004404)
#define USART2_BRR   (*(volatile uint32_t *)0x40004408)
#define USART2_CR1   (*(volatile uint32_t *)0x4000440C)

const uint8_t SEG[10] = {0x3F, 0x06, 0x5B, 0x4F, 0x66, 0x6D, 0x7D, 0x07, 0x7F, 0x6F};
char line[40];

void uart_print(void) {
    for (int i = 0; line[i] != 0; i++) {
        while (!(USART2_SR & (1 << 7))) {}   // wait for TXE
        USART2_DR = line[i];
    }
}

void delay_us(uint32_t us) {
    uint32_t t0 = TIM2_CNT;
    while (TIM2_CNT - t0 < us) {}           // poll the free-running timer
}

int main(void) {
    RCC_AHB1ENR |= 0x7;                     // clock GPIOA, GPIOB, GPIOC
    RCC_APB1ENR |= (1 << 0) | (1 << 17);    // clock TIM2, USART2
    RCC_APB2ENR |= (1 << 8);                // clock ADC1

    GPIOB_MODER = (GPIOB_MODER & ~0xFF) | 0x55;      // PB0-PB3 outputs (LEDs)
    GPIOC_MODER = (GPIOC_MODER & ~0xFFFF) | 0x5555;  // PC0-PC7 outputs (7-seg)
    GPIOA_MODER &= ~(0xFF << 16);                    // PA8-PA11 inputs (switches)
    GPIOA_PUPDR |= (0x55 << 16);                     // pull-ups: pressed reads 0
    GPIOA_MODER |= (3 << 0) | (2 << 4);              // PA0 analog, PA2 alternate
    GPIOA_AFRL |= (7 << 8);                          // PA2 = AF7 (USART2_TX)

    TIM2_PSC = 83;                          // 84 MHz / 84 = 1 MHz tick
    TIM2_ARR = 0xFFFFFFFF;
    TIM2_CR1 = 1;                           // CEN: start counting
    ADC1_SQR3 = 0;                          // channel 0 = PA0
    ADC1_CR2 = 1;                           // ADON
    USART2_BRR = 0x16D;                     // 42 MHz / 115200
    USART2_CR1 = (1 << 13) | (1 << 3);      // UE + TE

    uint32_t loops = 0;
    while (1) {
        uint32_t sw = (~GPIOA_IDR >> 8) & 0xF;  // pressed switches -> 1
        GPIOB_ODR = sw;                         // mirror them on the LEDs

        ADC1_CR2 |= (1 << 30);                  // SWSTART
        while (!(ADC1_SR & (1 << 1))) {}        // wait for EOC
        uint32_t adc = ADC1_DR;
        GPIOC_ODR = SEG[adc * 10 / 4096];       // 0-9 on the display

        if (++loops % 10 == 0) {
            sprintf(line, "LEDs=0x%02X ADC=%lu\\r\\n", sw, adc);
            uart_print();
        }
        delay_us(50000);                        // 50 ms
    }
}
`;
const BSRR = `// Atomic set/reset with BSRR instead of read-modify-write on ODR
#include "stm32f4xx.h"

#define RCC_AHB1ENR  (*(volatile uint32_t *)0x40023830)
#define GPIOB_MODER  (*(volatile uint32_t *)0x40020400)
#define GPIOB_ODR    (*(volatile uint32_t *)0x40020414)
#define GPIOB_BSRR   (*(volatile uint32_t *)0x40020418)
#define TIM2_CR1     (*(volatile uint32_t *)0x40000000)
#define TIM2_CNT     (*(volatile uint32_t *)0x40000024)
#define TIM2_PSC     (*(volatile uint32_t *)0x40000028)
#define RCC_APB1ENR  (*(volatile uint32_t *)0x40023840)

void delay_ms(uint32_t ms) {
    uint32_t t0 = TIM2_CNT;
    while (TIM2_CNT - t0 < ms * 1000) {}
}

int main(void) {
    RCC_AHB1ENR |= (1 << 1);
    RCC_APB1ENR |= 1;
    TIM2_PSC = 83;
    TIM2_CR1 = 1;
    GPIOB_MODER = (GPIOB_MODER & ~0xFF) | 0x55;

    int led = 0;
    while (1) {
        GPIOB_BSRR = (1 << led);            // set one bit: no read needed
        delay_ms(200);
        GPIOB_BSRR = (1 << (led + 16));     // reset it again
        led = (led + 1) % 4;
    }
}
`;

type P = { sw: number; pot: number; noClock: boolean; floating: boolean; openLed: boolean };
type Txn = BusAccess & { master: "CPU" | "DBG"; n: number };
type BusRec = { rows: Txn[]; total: number; reads: number; writes: number };

const SPACE: Array<{ per: string; lo: number; hi: number; desc: string; mem?: boolean }> = [
  { per: "Flash", lo: 0x08000000, hi: 0x0807ffff, desc: "Program memory (512 KB)", mem: true },
  { per: "SRAM", lo: 0x20000000, hi: 0x20017fff, desc: "Data memory (96 KB)", mem: true },
  { per: "TIM2", lo: 0x40000000, hi: 0x400003ff, desc: "Timer / Counter (32-bit)" },
  { per: "TIM3", lo: 0x40000400, hi: 0x400007ff, desc: "Timer / Counter (16-bit)" },
  { per: "USART2", lo: 0x40004400, hi: 0x400047ff, desc: "UART / Serial Interface" },
  { per: "ADC1", lo: 0x40012000, hi: 0x400123ff, desc: "Analog to Digital Converter" },
  { per: "EXTI", lo: 0x40013c00, hi: 0x40013fff, desc: "External Interrupts" },
  { per: "GPIOA", lo: 0x40020000, hi: 0x400203ff, desc: "General Purpose I/O" },
  { per: "GPIOB", lo: 0x40020400, hi: 0x400207ff, desc: "General Purpose I/O" },
  { per: "GPIOC", lo: 0x40020800, hi: 0x40020bff, desc: "General Purpose I/O" },
  { per: "RCC", lo: 0x40023800, hi: 0x40023bff, desc: "Reset & Clock Control" },
];
const LED_COLORS = ["red", "green", "yellow", "blue"] as const;
const SEG_NAMES = ["a", "b", "c", "d", "e", "f", "g", "dp"];
const DIGITS = [0x3f, 0x06, 0x5b, 0x4f, 0x66, 0x6d, 0x7d, 0x07, 0x7f, 0x6f];

const buses = new WeakMap<Mcu, BusRec>();
let debuggerAccess = false;
const busOf = (m: Mcu): BusRec => { let b = buses.get(m); if (!b) { b = { rows: [], total: 0, reads: 0, writes: 0 }; buses.set(m, b); } return b; };
function record(m: Mcu, e: BusAccess) {
  const b = busOf(m), master = debuggerAccess ? "DBG" : "CPU";
  b.total++;
  if (e.rw === "R") b.reads++; else b.writes++;
  const last = b.rows[b.rows.length - 1];
  if (last && e.rw === "R" && last.rw === "R" && last.path === e.path && last.master === master) { last.n++; last.value = e.value; return; }
  b.rows.push({ ...e, master, n: 1 });
  if (b.rows.length > 240) b.rows.splice(0, b.rows.length - 240);
}
const busName = (a: number) => (a >= 0xe0000000 ? "PPB" : a >= 0x40020000 ? "AHB1" : a >= 0x40010000 ? "APB2" : a >= 0x40000000 ? "APB1" : a >= 0x20000000 ? "S-bus" : "I-Code");
const fmtAddr = (a: number) => hex(a, 8).replace(/^0x(....)/, "0x$1_");
const arrow = (path: string) => path.replace(".", "->");
const compact = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e4 ? `${Math.round(n / 1e3)}k` : String(n));

function SevenSeg({ x, y, bits, h = 64 }: { x: number; y: number; bits: number; h?: number }) {
  const w = h * 0.55, t = h * 0.11, on = (i: number) => ((bits >> i) & 1) === 1;
  const hz = (i: number, yy: number) => <rect key={i} x={x + t * 0.8} y={yy - t / 2} width={w - t * 1.6} height={t} rx={t / 2} fill={on(i) ? "#ff3b30" : "#3a1414"} />;
  const vt = (i: number, xx: number, yy: number) => <rect key={i} x={xx - t / 2} y={yy + t * 0.7} width={t} height={h / 2 - t * 1.4} rx={t / 2} fill={on(i) ? "#ff3b30" : "#3a1414"} />;
  return (
    <g>
      <rect x={x - 8} y={y - 8} width={w + 22} height={h + 16} rx={4} fill="#111" />
      {hz(0, y)}{vt(1, x + w, y)}{vt(2, x + w, y + h / 2)}{hz(3, y + h)}{vt(4, x, y + h / 2)}{vt(5, x, y)}{hz(6, y + h / 2)}
      <circle cx={x + w + 7} cy={y + h} r={t / 2} fill={on(7) ? "#ff3b30" : "#3a1414"} />
    </g>
  );
}

export default function L09({ meta }: { meta: LabMeta }) {
  const lab = useLab<P>({
    slug: meta.slug, code: DEMO, params: { sw: 0, pot: 0.5, noClock: false, floating: false, openLed: false },
    rebuildOn: ["noClock", "floating"],
    mcu: (p) => ({ ips: 200_000, strictClock: p.noClock }),
    setup: (m, p) => { m.busTap = (e) => record(m, e); if (p.noClock) m.gateStuck.add("GPIOB"); },
    world: (m, _dt, p) => {
      for (let i = 0; i < 4; i++) {
        const key = m.pinKey("A", 8 + i);
        m.setInput(key, (p.sw >> i) & 1 ? 0 : null);
        if (p.floating) m.pin(key).pull = "none";
      }
      m.setAnalog(0, p.pot * 3.3);
      if (p.noClock) m.clockEnabled("GPIOB");
    },
  });
  const { mcu, params } = lab;
  const bus = busOf(mcu);
  const [sel, setSel] = useState("GPIOB");
  const [selReg, setSelReg] = useState("GPIOB.ODR");
  const [edit, setEdit] = useState<{ path: string; text: string } | null>(null);
  const [auto, setAuto] = useState(true);
  const [frozen, setFrozen] = useState<Txn[] | null>(null);
  const [filter, setFilter] = useState<"all" | "w" | "sel">("all");
  const [clearedAt, setClearedAt] = useState(0);
  const [dbgMsg, setDbgMsg] = useState("");
  const adcHist = useRef<number[]>([]);
  const digits = useRef(new Set<number>());
  const [seen, setSeen] = useState({ led: false, dbg: false, pot: false });

  const odrB = mcu.peek("GPIOB.ODR"), odrC = mcu.peek("GPIOC.ODR") & 0xff, idrA = mcu.peek("GPIOA.IDR");
  const leds = [0, 1, 2, 3].map((i) => mcu.level(mcu.pinKey("B", i)) === 1 && mcu.pin(mcu.pinKey("B", i)).mode === "out" && !(params.openLed && i === 1));
  const adc = mcu.peek("ADC1.DR") & 0xfff;
  const tim = mcu.peek("TIM2.CNT"), timOn = (mcu.peek("TIM2.CR1") & 1) === 1;
  const digit = DIGITS.indexOf(odrC & 0x7f);
  if (adcHist.current[adcHist.current.length - 1] !== adc || adcHist.current.length < 2) { adcHist.current.push(adc); if (adcHist.current.length > 60) adcHist.current.shift(); }
  if (digit >= 0) digits.current.add(digit);
  if (!seen.led && params.sw && leds.some(Boolean)) setSeen((s) => ({ ...s, led: true }));
  if (!seen.pot && digits.current.size >= 3) setSeen((s) => ({ ...s, pot: true }));
  const uartLines = mcu.uart.text.split(/\r?\n/).filter((l) => l.length).slice(-4);
  const lastLine = uartLines[uartLines.length - 1] ?? "";
  const hot = (per: string) => { const a = mcu.access.get(per); return a && mcu.now - a.last < 0.12; };

  const setSw = (i: number, down: boolean) => lab.setParam("sw", down ? params.sw | (1 << i) : params.sw & ~(1 << i));
  const dbgWrite = (path: string, text: string) => {
    const v = Number(text.trim());
    if (!Number.isFinite(v)) { setDbgMsg("Enter a number such as 0x0000000F."); return; }
    debuggerAccess = true;
    try { mcu.write(path, v >>> 0); } finally { debuggerAccess = false; }
    setEdit(null);
    setSeen((s) => ({ ...s, dbg: true }));
    setDbgMsg(`Debugger wrote ${hex(v >>> 0, 8)} to ${arrow(path)} at ${fmtAddr(mcu.addrOf(path) ?? 0)}${lab.running ? " — the running firmware may overwrite it; Pause to make it stick." : "."}`);
    lab.advance(0);
  };

  const space = SPACE.find((s) => s.per === sel)!;
  const regs = space.mem ? [] : mcu.registerList(sel);
  const rows = (frozen ?? bus.rows).filter((r) => r.t >= clearedAt && (filter === "all" || (filter === "w" ? r.rw === "W" : r.path.startsWith(`${sel}.`))));
  const shown = rows.slice(-60);
  const describe = (r: Txn) => {
    if (r.rw === "W") return `${arrow(r.path)} = ${hex(r.value, r.value > 0xffff ? 8 : 4)}`;
    return r.n > 1 ? `${arrow(r.path)} read ×${r.n} (polling)` : `${arrow(r.path)} -> ${hex(r.value, r.value > 0xffff ? 8 : 4)}`;
  };
  const gpioRows: Array<{ pin: string; sig: string; to: string; fn: string; kind: "mcu" | "per" | "ext"; live: string }> = [
    ...[0, 1, 2, 3].map((i) => ({ pin: `PB${i}`, sig: `GPIOB_${i}`, to: `LED${i + 1} (${["Red", "Green", "Yellow", "Blue"][i]})`, fn: "Output", kind: "mcu" as const, live: params.openLed && i === 1 ? "open" : (odrB >> i) & 1 ? "1" : "0" })),
    ...[0, 1, 2, 3].map((i) => ({ pin: `PA${8 + i}`, sig: `GPIOA_${8 + i}`, to: `SW${i + 1}`, fn: "Input (pull-up)", kind: "ext" as const, live: (idrA >> (8 + i)) & 1 ? "1" : "0" })),
    { pin: "PC0–PC7", sig: "GPIOC_0..7", to: "7-segment a–dp", fn: "Output", kind: "mcu", live: hex(odrC, 2) },
    { pin: "PA0", sig: "ADC1_IN0", to: "Potentiometer", fn: "Analog input", kind: "per", live: `${(params.pot * 3.3).toFixed(2)} V` },
    { pin: "PA2", sig: "USART2_TX", to: "Virtual terminal", fn: "Serial output (AF7)", kind: "per", live: mcu.now < mcu.uart.busyUntil ? "TX" : "idle" },
  ];
  const sw = (i: number) => ((params.sw >> i) & 1) === 1;

  return (
    <LabShell meta={meta} lab={lab} subtitle="Connect register addresses directly to LEDs, switches, timers, and peripherals."
      components={["NUCLEO-F401RE (STM32F401RE @ 84 MHz)", "4 LEDs on PB0–PB3", "4 push switches on PA8–PA11 (pull-ups)", "Common-cathode 7-segment display on PC0–PC7", "10 kΩ potentiometer on PA0 (ADC1_IN0)", "USART2 TX on PA2 → virtual terminal"]}>
      <div className="mcl-grid mcl-l09-grid">
        <Panel title="Live System View" icon="chip" className="mcl-sim mcl-l09-live" tools={<span className={`mcl-chip ${lab.running ? "mcl-chip-live" : ""}`}>{lab.running ? "Real-time" : "Paused"}</span>}>
          <svg viewBox="0 0 560 300" className="mcl-svg mcl-l09-svg" role="img" aria-label="Board with switches, LEDs, display, UART and ADC">
            <HwDefs id="l09" />
            <Wire d="M150 50 C 175 50, 180 128, 202 128" color="#2563eb" live={hot("GPIOA") && !!params.sw} />
            <Wire d="M150 214 C 176 214, 182 160, 202 160" color="#16a34a" live={hot("GPIOB") && leds.some(Boolean)} />
            <Wire d="M355 128 C 372 128, 372 52, 394 52" color="#dc2626" live={hot("GPIOC")} />
            <Wire d="M355 152 C 374 152, 376 150, 394 150" color="#1e293b" live={mcu.now < mcu.uart.busyUntil + 0.05} />
            <Wire d="M355 176 C 374 176, 376 246, 394 246" color="#f59e0b" live={hot("ADC1")} />

            <g className="mcl-l09-box">
              <rect x={6} y={8} width={146} height={84} rx={7} fill="#fff" stroke="#2563eb" />
              <rect x={6} y={8} width={146} height={18} rx={7} fill="#2563eb" /><rect x={6} y={18} width={146} height={8} fill="#2563eb" />
              <text x={14} y={21} fill="#fff" fontSize="10" fontWeight="700">Switches (GPIOA)</text>
              {[0, 1, 2, 3].map((i) => <SvgButton key={i} x={26 + i * 34} y={56} size={22} pressed={sw(i)} onPress={(d) => setSw(i, d)} label={`SW${i + 1}`} cap="#111827" color="#475569" />)}
            </g>
            <g className="mcl-l09-box">
              <rect x={6} y={160} width={146} height={112} rx={7} fill="#fff" stroke="#16a34a" />
              <rect x={6} y={160} width={146} height={18} rx={7} fill="#16a34a" /><rect x={6} y={170} width={146} height={8} fill="#16a34a" />
              <text x={14} y={173} fill="#fff" fontSize="10" fontWeight="700">LEDs (GPIOB)</text>
              {[0, 1, 2, 3].map((i) => (
                <g key={i}>
                  <SvgLed x={26 + i * 34} y={214} r={9} on={leds[i]!} color={LED_COLORS[i]} id="l09" label={`LED${i + 1}`} />
                  {params.openLed && i === 1 ? <text x={26 + i * 34} y={252} textAnchor="middle" fontSize="7.5" fill="#b42318" fontWeight="700">open</text> : null}
                </g>
              ))}
            </g>
            <NucleoBoard x={200} y={4} scale={0.86} id="l09" chipLabel="STM32F401" ld2={false} onReset={() => { mcu.hardReset("External reset (NRST button B2)"); lab.advance(0); }} />
            <g className="mcl-l09-box">
              <rect x={392} y={8} width={162} height={92} rx={7} fill="#fff" stroke="#dc2626" />
              <rect x={392} y={8} width={162} height={18} rx={7} fill="#dc2626" /><rect x={392} y={18} width={162} height={8} fill="#dc2626" />
              <text x={400} y={21} fill="#fff" fontSize="10" fontWeight="700">7-Segment Display (GPIOC)</text>
              <SevenSeg x={414} y={38} bits={mcu.pin(mcu.pinKey("C", 0)).mode === "out" ? odrC : 0} h={50} />
              {SEG_NAMES.map((n, i) => <text key={n} x={480 + (i >> 2) * 36} y={44 + (i % 4) * 13} fontSize="8.5" fill={(odrC >> i) & 1 ? "#dc2626" : "#94a3b8"} fontWeight="700">{n} PC{i}</text>)}
            </g>
            <g className="mcl-l09-box">
              <rect x={392} y={108} width={162} height={84} rx={7} fill="#fff" stroke="#1e293b" />
              <text x={400} y={122} fill="#0f2547" fontSize="10" fontWeight="700">UART (USART2) · {mcu.uart.baud} Bd</text>
              <rect x={400} y={128} width={146} height={56} rx={4} fill="#0b1220" />
              {uartLines.slice(-3).map((l, i) => <text key={i} x={406} y={144 + i * 14} fontSize="9" fill="#4ade80" className="mcl-mono-svg">{l.slice(0, 26)}</text>)}
              {!uartLines.length ? <text x={406} y={144} fontSize="9" fill="#64748b" className="mcl-mono-svg">waiting for TX…</text> : null}
            </g>
            <g className="mcl-l09-box">
              <rect x={392} y={200} width={162} height={92} rx={7} fill="#fff" stroke="#f59e0b" />
              <text x={400} y={214} fill="#0f2547" fontSize="10" fontWeight="700">Analog Input (ADC1 · PA0)</text>
              <Potentiometer x={428} y={250} r={20} value={params.pot} onChange={(v) => lab.setParam("pot", v)} label="10 kΩ" />
              <rect x={460} y={226} width={86} height={44} rx={5} fill="#eff6ff" stroke="#bfdbfe" />
              <text x={468} y={242} fontSize="9" fill="#26406a">ADC Value:</text>
              <text x={468} y={260} fontSize="12" fontWeight="800" fill="#0f2547">{adc}</text>
              <text x={500} y={260} fontSize="9" fill="#4b6283">({(adc / 4095 * 3.3).toFixed(2)} V)</text>
            </g>
          </svg>
        </Panel>

        <Panel title="Address Space Explorer" icon="memory" className="mcl-l09-exp">
          <table className="mcl-table mcl-l09-space">
            <thead><tr><th>Address Range</th><th>Peripheral</th><th>Description</th></tr></thead>
            <tbody>
              {SPACE.map((s) => {
                const a = mcu.access.get(s.per);
                return (
                  <tr key={s.per} className={`${sel === s.per ? "sel" : ""} ${hot(s.per) ? "hot" : ""}`} onClick={() => { setSel(s.per); setEdit(null); const first = s.mem ? "" : mcu.registerList(s.per)[0]?.path ?? ""; setSelReg(s.per === "GPIOB" ? "GPIOB.ODR" : first); }}>
                    <td className="mcl-mono">{fmtAddr(s.lo)} – {fmtAddr(s.hi)}</td>
                    <td><b>{s.per}</b>{!s.mem ? <small className="mcl-l09-cnt" title="Bus reads / writes">{compact(a?.r ?? 0)} R · {compact(a?.w ?? 0)} W</small> : null}</td>
                    <td>{s.desc}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>

        <Panel title="Register Address View" icon="sliders" className="mcl-l09-reg">
          <div className="mcl-l09-reghead">{space.mem ? `${sel} (memory, not registers)` : `${sel} Registers (Base: ${fmtAddr(space.lo)})`}</div>
          {space.mem ? (
            <p className="mcl-muted mcl-l09-memnote">{sel} is plain memory: the CPU fetches code from Flash and keeps variables in SRAM. Peripherals live in the 0x4000_0000 region — pick one to see its registers. Lab 8 explores Flash and SRAM in depth.</p>
          ) : (
            <table className="mcl-table mcl-l09-regs">
              <thead><tr><th>Offset</th><th>Address</th><th>Name</th><th>Value</th></tr></thead>
              <tbody>
                {regs.map((r) => {
                  const name = r.path.split(".")[1]!;
                  const editing = edit?.path === r.path;
                  return (
                    <tr key={r.path} className={selReg === r.path ? "sel" : ""} onClick={() => setSelReg(r.path)}>
                      <td className="mcl-mono">{hex(r.addr - space.lo, 2)}</td>
                      <td className="mcl-mono">{fmtAddr(r.addr)}</td>
                      <td>{name}</td>
                      <td className="mcl-mono">
                        {editing ? (
                          <form onSubmit={(e) => { e.preventDefault(); dbgWrite(r.path, edit.text); }} className="mcl-l09-edit">
                            <input className="mcl-input mcl-mono" autoFocus value={edit.text} onChange={(e) => setEdit({ path: r.path, text: e.target.value })} onKeyDown={(e) => { if (e.key === "Escape") setEdit(null); }} aria-label={`New value for ${name}`} />
                          </form>
                        ) : (
                          <span className="mcl-l09-val">{hex(r.value, 8)}
                            <button type="button" className="mcl-l09-pen" title={`Write ${name} from the debugger`} aria-label={`Edit ${name}`} onClick={(e) => { e.stopPropagation(); setEdit({ path: r.path, text: hex(r.value, 8) }); setSelReg(r.path); }}><Icon name="edit" /></button>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {selReg && !space.mem ? (
            <div className="mcl-l09-bits">
              <small>{arrow(selReg)} bits 15…0</small>
              <div>{Array.from({ length: 16 }, (_, k) => 15 - k).map((b) => <i key={b} className={(mcu.peek(selReg) >> b) & 1 ? "on" : ""} title={`bit ${b}`}>{(mcu.peek(selReg) >> b) & 1}</i>)}</div>
            </div>
          ) : null}
          {dbgMsg ? <p className="mcl-l09-dbg">{dbgMsg}</p> : null}
        </Panel>

        <CodeEditor lab={lab} className="mcl-l09-code" rows={25} languages={[{ label: "C (STM32)", code: DEMO }, { label: "C (BSRR)", code: BSRR }]} />

        <Panel title="Peripheral Response" icon="gauge" className="mcl-l09-per">
          <div className="mcl-l09-leds">
            {[0, 1, 2, 3].map((i) => (
              <div key={i}><svg viewBox="0 0 30 30" aria-hidden><HwDefs id={`l09p${i}`} /><SvgLed x={15} y={15} r={8} on={leds[i]!} color={LED_COLORS[i]} id={`l09p${i}`} /></svg>
                <small>LED{i + 1}<br />(PB{i})</small><b className={leds[i] ? "on" : ""}>{leds[i] ? "ON" : "OFF"}</b></div>
            ))}
          </div>
          <div className="mcl-l09-tiles">
            <div className="mcl-l09-tile">
              <h4>Switches (IDR)</h4>
              <div className="mcl-l09-sws">
                {[0, 1, 2, 3].map((i) => (
                  <button type="button" key={i} className={sw(i) ? "on" : ""} aria-pressed={sw(i)} onClick={() => setSw(i, !sw(i))} title="Click to latch the switch pressed">
                    <span className="knob" /><small>SW{i + 1}</small><b>{(idrA >> (8 + i)) & 1}</b>
                  </button>
                ))}
              </div>
              <small className="mcl-muted">IDR bit = 0 when pressed (pull-up)</small>
            </div>
            <div className="mcl-l09-tile">
              <h4>Timer (TIM2)</h4>
              <small>Counter Value</small>
              <b className="mcl-l09-big">{tim.toLocaleString()}</b>
              <div className="mcl-l09-tbar"><i style={{ width: `${(tim % 1_000_000) / 10_000}%` }} /></div>
              <small>Prescaler: {mcu.peek("TIM2.PSC")} · {(mcu.clock / (mcu.peek("TIM2.PSC") + 1) / 1e6).toFixed(2)} MHz</small>
              <small>Status: <b className={timOn ? "ok" : ""}>{timOn ? "Running" : "Stopped"}</b></small>
            </div>
            <div className="mcl-l09-tile">
              <h4>ADC1 (IN0)</h4>
              <svg viewBox="0 0 120 34" className="mcl-l09-spark" aria-hidden>
                <polyline fill="none" stroke="#2563eb" strokeWidth="1.6" points={adcHist.current.map((v, i) => `${(i / 59) * 120},${32 - (v / 4095) * 30}`).join(" ")} />
              </svg>
              <small>Raw Value <b>{adc}</b></small>
              <small>Voltage <b>{(adc / 4095 * 3.3).toFixed(2)} V</b></small>
            </div>
            <div className="mcl-l09-tile mcl-l09-term">
              <h4>UART2 (TX)</h4>
              <pre>{uartLines.join("\n") || "…"}</pre>
            </div>
          </div>
        </Panel>

        <div className="mcl-col mcl-l09-mid">
          <Panel title="Bus Transaction" icon="activity" tools={<>
            <Toggle label="Auto Scroll" checked={auto} onChange={(v) => { setAuto(v); setFrozen(v ? null : [...bus.rows]); }} />
            <button type="button" className="mcl-btn mcl-btn-sm" onClick={() => { setClearedAt(mcu.now); setFrozen(null); setAuto(true); }}>Clear</button>
          </>}>
            <div className="mcl-l09-bushead">
              <Seg size="sm" value={filter} options={[{ value: "all", label: "All" }, { value: "w", label: "Writes" }, { value: "sel", label: sel }]} onChange={setFilter} label="Filter" />
              <small className="mcl-muted">{bus.total.toLocaleString()} accesses · {bus.reads.toLocaleString()} R · {bus.writes.toLocaleString()} W</small>
            </div>
            <div className="mcl-l09-bus" ref={(el) => { if (el && auto) el.scrollTop = el.scrollHeight; }}>
              <table className="mcl-table">
                <thead><tr><th>Time (ms)</th><th>Bus</th><th>Address</th><th>Type</th><th>Data</th><th>Description</th></tr></thead>
                <tbody>
                  {shown.map((r, i) => (
                    <tr key={`${r.t}-${i}`} className={`${r.rw === "W" ? "w" : ""} ${r.master === "DBG" ? "dbg" : ""}`}>
                      <td className="mcl-mono">{(r.t * 1e3).toFixed(3)}</td>
                      <td>{r.master === "DBG" ? "DBG" : busName(r.addr)}</td>
                      <td className="mcl-mono">{hex(r.addr, 8)}</td>
                      <td><b className={r.rw === "W" ? "wr" : "rd"}>{r.rw === "W" ? "WRITE" : "READ"}</b></td>
                      <td className="mcl-mono">{hex(r.value, 8)}</td>
                      <td>{describe(r)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!shown.length ? <p className="mcl-muted">No transactions yet — press Run.</p> : null}
            </div>
          </Panel>
          <Panel title="Hardware & GPIO Mapping" icon="link" tools={<span className="mcl-l09-legend"><i className="mcu" />MCU <i className="per" />Peripheral <i className="ext" />External</span>}>
            <table className="mcl-table mcl-l09-map">
              <thead><tr><th>MCU Pin</th><th>Signal</th><th>Connected To</th><th>Function</th><th>Now</th></tr></thead>
              <tbody>
                {gpioRows.map((g) => (
                  <tr key={g.pin}><td><i className={`dot ${g.kind}`} />{g.pin}</td><td className="mcl-mono">{g.sig}</td><td>{g.to}</td><td>{g.fn}</td><td className={`mcl-mono live ${g.live === "1" || g.live === "TX" ? "hi" : g.live === "open" ? "bad" : ""}`}>{g.live}</td></tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </div>

        <div className="mcl-col mcl-l09-side">
          <LearningNotes notes={{
            takeaways: ["Understand the memory map concept.", "Access peripheral registers using addresses.", "Control GPIO, timers, ADC, and UART via registers.", "Observe real-time peripheral responses.", "Use pointer-based register access or HAL macros.", "Trace bus transactions and data flow."],
            observe: `GPIOB->ODR is ${hex(odrB & 0xffff, 4)} — each set bit drives one LED.`,
            tryIt: "Press SW1 and SW3: the CPU reads IDR, inverts it and writes the same pattern to GPIOB->ODR.",
            measure: `Last UART line: ${lastLine || "(none yet)"} · TIM2 ticks at ${(mcu.clock / (mcu.peek("TIM2.PSC") + 1) / 1e6).toFixed(2)} MHz.`,
            modify: "Pause, then click the pencil on GPIOB ODR and write 0x0000000F — all four LEDs light without any code.",
            runAgain: "Turn on 'GPIOB clock not enabled' and watch the ODR writes get ignored on the bus.",
            challenge: "Load the BSRR example: why does writing BSRR never need a read of ODR first?",
            question: "In a memory-mapped system, peripherals are accessed just like memory, using specific register addresses.",
            checks: [{ label: "Pressed a switch and saw its LED light", done: seen.led }, { label: "Wrote a register from the debugger", done: seen.dbg }, { label: "Turned the pot through 3+ display digits", done: seen.pot }],
          }} />
          <Panel title="Fault Injection" icon="bug">
            <div className="mcl-l09-faults">
              <Toggle label="GPIOB clock not enabled" checked={params.noClock} onChange={(v) => lab.setParam("noClock", v)} hint="RCC_AHB1ENR bit 1 stays 0 — writes to GPIOB are dropped" />
              <Toggle label="Pull-ups missing (floating inputs)" checked={params.floating} onChange={(v) => lab.setParam("floating", v)} hint="PA8–PA11 float: IDR returns random bits" />
              <Toggle label="LED2 wire open circuit" checked={params.openLed} onChange={(v) => lab.setParam("openLed", v)} hint="ODR bit 1 changes, but no current reaches LED2" />
            </div>
          </Panel>
        </div>
      </div>
    </LabShell>
  );
}
