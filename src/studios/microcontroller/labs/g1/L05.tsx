import { useEffect, useRef, useState } from "react";
import type { Family } from "../core/mcu";
import { useLab } from "../core/useLab";
import type { LabMeta } from "../registry";
import { CodeEditor } from "../ui/CodeEditor";
import { ArduinoUno, HwDefs, LaunchPad, NucleoBoard } from "../ui/Hardware";
import { Icon } from "../ui/Icon";
import { LearningNotes, Panel, Seg, Toggle } from "../ui/Panels";
import { LabShell } from "../ui/Shell";

const AVR = `// Lab 5 - 8-bit AVR Example: Blink LED
#include <avr/io.h>
#include <util/delay.h>

int main(void) {
    DDRB |= (1 << PB5);        // Set pin 13 (PB5) as output
    while (1) {
        PORTB ^= (1 << PB5);   // Toggle LED
        _delay_ms(500);        // Wait 500 ms
    }
    return 0;
}
`;
const MSP = `// Lab 5 - 16-bit MSP430 Example: Blink LED
#include <msp430.h>

int main(void) {
    WDTCTL = WDTPW | WDTHOLD;      // Stop the watchdog (it runs after reset!)
    BCSCTL1 = CALBC1_16MHZ;        // DCO = 16 MHz
    DCOCTL = CALDCO_16MHZ;
    P1DIR |= BIT0;                 // P1.0 (red LED1) as output
    while (1) {
        P1OUT ^= BIT0;             // Toggle LED
        __delay_cycles(8000000);   // 8 M cycles = 0.5 s at 16 MHz
    }
}
`;
const ARM = `// Lab 5 - 32-bit ARM Cortex-M4 Example: Blink LED
#include "stm32f4xx.h"

int main(void) {
    RCC->AHB1ENR |= RCC_AHB1ENR_GPIOAEN;   // Clock GPIOA
    GPIOA->MODER |= (1 << (5 * 2));        // PA5 (LD2) as output
    while (1) {
        GPIOA->ODR ^= (1 << 5);            // Toggle LED
        HAL_Delay(500);                    // Wait 500 ms
    }
}
`;

type Board = "avr" | "msp" | "arm";
type P = { avrMHz: number; mspMHz: number; armMHz: number; bench: string; useCase: string; priority: string; req: string; rec: string };

export const familyOf = (src: string): Family => /avr\/io\.h|\bDDR[B-D]\b|\bPORT[B-D]\b/.test(src) ? "avr" : /msp430\.h|\bWDTCTL\b|\bP[12](DIR|OUT)\b/.test(src) ? "msp430" : "stm32";
const boardOfFamily = (f: Family): Board => (f === "avr" ? "avr" : f === "msp430" ? "msp" : "arm");

const INFO: Record<Board, { name: string; bits: number; title: string; tag: string; chips: string[]; color: string; soft: string; pin: string; flash: string; ram: string; code: string; label: string }> = {
  avr: { name: "Arduino Uno (ATmega328P)", bits: 8, title: "8-bit MCU", tag: "Classic & Reliable", chips: ["Popular", "Low Cost"], color: "#ef4444", soft: "#fdeeee", pin: "PB5", flash: "32 KB", ram: "2 KB", code: AVR, label: "C (AVR - 8-bit)" },
  msp: { name: "TI MSP430 LaunchPad (MSP430G2553)", bits: 16, title: "16-bit MCU", tag: "More Performance", chips: ["Low Power", "Industrial"], color: "#16a34a", soft: "#eaf8ef", pin: "P1.0", flash: "16 KB", ram: "512 B", code: MSP, label: "C (MSP430 - 16-bit)" },
  arm: { name: "STM32 Nucleo (STM32F401RE)", bits: 32, title: "32-bit MCU", tag: "High Performance & Feature Rich", chips: ["High Performance", "Versatile"], color: "#7c3aed", soft: "#f3edff", pin: "PA5", flash: "512 KB", ram: "96 KB", code: ARM, label: "C (ARM - 32-bit)" },
};

/** Cycles per unit of work for each benchmark, from published instruction timings of each core. */
const BENCH: Record<string, { label: string; unit: string; cycles: Record<Board, number>; scale: number }> = {
  dhrystone: { label: "Dhrystone (Relative)", unit: "DMIPS", cycles: { avr: 1580, msp: 1960, arm: 455 }, scale: 1 / 1757 },
  int32: { label: "32-bit Multiply-Accumulate", unit: "M MAC/s", cycles: { avr: 42, msp: 160, arm: 1 }, scale: 1e-6 },
  gpio: { label: "GPIO Toggle Rate", unit: "MHz", cycles: { avr: 4, msp: 6, arm: 6 }, scale: 1e-6 },
  float: { label: "Floating-Point Multiply", unit: "MFLOPS", cycles: { avr: 140, msp: 390, arm: 3 }, scale: 1e-6 },
};

const SPECS: Array<[string, string, string, string]> = [
  ["Word Size", "8 bits", "16 bits", "32 bits"],
  ["Registers", "32 (8-bit)", "16 (16-bit)", "16+ (32-bit)"],
  ["Address Space", "64 KB", "1 MB", "4 GB"],
  ["Typical Clock Speed", "1 – 16 MHz", "1 – 25 MHz", "16 – 168 MHz"],
  ["RAM (Typical)", "2 KB", "2 – 8 KB", "32 – 512 KB"],
  ["Flash (Typical)", "32 KB", "16 – 256 KB", "256 KB – 2 MB"],
  ["Power Consumption", "Low (mW)", "Very Low (µW–mW)", "Moderate (mW)"],
  ["Peripherals", "Basic (GPIO, ADC, UART)", "Enhanced (ADC, UART, SPI, I²C)", "Rich (ADC, DAC, PWM, USB, CAN, etc.)"],
  ["Common Use Cases", "Hobby, simple control", "Low-power, embedded sensing", "IoT, robotics, advanced applications"],
];

const USE_CASES: Record<string, Record<Board, number>> = {
  "IoT Sensor Node": { avr: 1, msp: 2, arm: 3 }, "Battery Wearable": { avr: 1, msp: 3, arm: 2 }, "Hobby LED Project": { avr: 3, msp: 2, arm: 1 },
  "Motor Controller": { avr: 2, msp: 1, arm: 3 }, "Audio / DSP": { avr: 0, msp: 1, arm: 3 }, "Industrial Sensor": { avr: 1, msp: 3, arm: 2 },
};
const PRIORITY: Record<string, Record<Board, number>> = { "Lowest Power": { avr: 1, msp: 3, arm: 1 }, "Lowest Cost": { avr: 3, msp: 2, arm: 1 }, "Highest Performance": { avr: 0, msp: 1, arm: 3 }, "Ease of Use": { avr: 3, msp: 1, arm: 2 } };
const REQ: Record<string, Record<Board, number>> = { "Wireless Communication": { avr: 0, msp: 1, arm: 3 }, "Floating-Point Math": { avr: 0, msp: 0, arm: 3 }, "Many PWM Channels": { avr: 1, msp: 1, arm: 3 }, "Years on a Coin Cell": { avr: 0, msp: 3, arm: 1 }, None: { avr: 0, msp: 0, arm: 0 } };

export function recommend(useCase: string, priority: string, req: string): Board {
  const score = (b: Board) => (USE_CASES[useCase]?.[b] ?? 0) * 2 + (PRIORITY[priority]?.[b] ?? 0) * 1.5 + (REQ[req]?.[b] ?? 0);
  return (["avr", "msp", "arm"] as Board[]).reduce((best, b) => (score(b) > score(best) ? b : best), "avr");
}

function Gauge({ ratio, max, color, label }: { ratio: number; max: number; color: string; label: string }) {
  const f = Math.max(0.04, Math.min(1, Math.log10(1 + ratio * 9) / Math.log10(1 + max * 9)));
  const a = Math.PI * (1 - f), r = 46;
  const x = 60 + r * Math.cos(a), y = 62 - r * Math.sin(a);
  return (
    <svg viewBox="0 0 120 74" className="mcl-svg" role="img" aria-label={`${label}: ${ratio.toFixed(1)} times baseline`}>
      <path d="M14 62 A46 46 0 0 1 106 62" fill="none" stroke="#e6ecf4" strokeWidth="11" strokeLinecap="round" />
      <path d={`M14 62 A46 46 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)}`} fill="none" stroke={color} strokeWidth="11" strokeLinecap="round" />
      <text x="60" y="56" textAnchor="middle" fontSize="17" fontWeight="800" fill="#0f2547">{ratio.toFixed(1)}x</text>
      <text x="60" y="70" textAnchor="middle" fontSize="8.5" fill="#4b6283">{label}</text>
    </svg>
  );
}

const stamp = (t: number) => { const ms = Math.floor(t * 1000); const m = Math.floor(ms / 60000), s = Math.floor(ms / 1000) % 60; return `[${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(ms % 1000).padStart(3, "0")}]`; };

export default function L05({ meta }: { meta: LabMeta }) {
  const lab = useLab<P>({
    slug: meta.slug, code: AVR,
    params: { avrMHz: 16, mspMHz: 16, armMHz: 84, bench: "dhrystone", useCase: "IoT Sensor Node", priority: "Lowest Power", req: "Wireless Communication", rec: "" },
    mcu: (p, src) => { const family = familyOf(src); return family === "avr" ? { family, clock: p.avrMHz * 1e6 } : family === "msp430" ? { family } : { family: "stm32", clock: p.armMHz * 1e6 }; },
  });
  const { mcu, params } = lab;
  const [view, setView] = useState<"overview" | "details" | "block">("overview");
  const [specView, setSpecView] = useState<"side" | "table">("side");
  const [autoScroll, setAutoScroll] = useState(true);
  const [clearedAt, setClearedAt] = useState(-1);
  const [pendingRun, setPendingRun] = useState("");
  const monitor = useRef<HTMLDivElement>(null);

  const running = boardOfFamily(mcu.family);
  const editing = boardOfFamily(familyOf(lab.code));
  const select = (b: Board) => { lab.setCode(INFO[b].code); setPendingRun(INFO[b].code); };
  useEffect(() => { if (pendingRun && lab.code === pendingRun) { lab.run(); setPendingRun(""); } }, [pendingRun, lab]);
  const [ran, setRan] = useState<Set<Board>>(() => new Set());
  useEffect(() => { if (mcu.time > 0.5) setRan((s) => (s.has(running) ? s : new Set(s).add(running))); }, [running, mcu.time]);

  const bench = BENCH[params.bench] ?? BENCH.dhrystone!;
  const mhz: Record<Board, number> = { avr: params.avrMHz, msp: params.mspMHz, arm: params.armMHz };
  const perf = (b: Board) => (mhz[b] * 1e6 / bench.cycles[b]) * bench.scale;
  const base = perf("avr");
  const ratios: Record<Board, number> = { avr: 1, msp: perf("msp") / base, arm: perf("arm") / base };
  const maxRatio = Math.max(ratios.msp, ratios.arm, 1);

  const pinEdges = mcu.edges.get(INFO[running].pin) ?? [];
  const recent = pinEdges.filter(([t]) => t > mcu.time - 3);
  const period = recent.length >= 3 ? (recent[recent.length - 1]![0] - recent[recent.length - 3]![0]) : 0;
  const led = mcu.pins.has(INFO[running].pin) ? mcu.level(INFO[running].pin) : 0;
  const ledOf = (b: Board) => (b === running ? led : 0);

  const rec = params.rec as Board | "";
  const lines: Array<{ t: number; text: string }> = [
    { t: 0, text: "Lab 5 - MCU Comparison Demo" },
    { t: 0, text: `Board: ${INFO[running].name}` },
    { t: 0, text: `MCU Class: ${INFO[running].bits}-bit` },
    { t: 0, text: `Clock: ${(mcu.clock / 1e6).toFixed(mcu.clock < 1e7 ? 1 : 0)} MHz` },
    { t: 0, text: `Flash: ${INFO[running].flash}  |  RAM: ${INFO[running].ram}` },
  ];
  if (mcu.time > 0.3) lines.push({ t: 0.3, text: "Starting benchmark..." }, { t: 0.3, text: `Running ${bench.label.replace(" (Relative)", "")} test...` });
  if (mcu.time > 0.8) lines.push({ t: 0.8, text: `Result: ${fmt(perf(running))} ${bench.unit} (${ratios[running].toFixed(1)}x ${running === "avr" ? "baseline" : "AVR"})` });
  if (mcu.time > 1.6) lines.push({ t: 1.6, text: pinEdges.length >= 2 ? `LED Toggle Test: OK (${INFO[running].pin}, period ${(period * 1000 || 0).toFixed(0)} ms)` : `LED Toggle Test: FAIL - no edges on ${INFO[running].pin}` });
  if (mcu.time > 1.7) lines.push({ t: 1.7, text: "Demo complete." });
  for (const e of mcu.events.filter((ev) => ev.kind === "reset" || ev.kind === "fault")) lines.push({ t: e.t, text: e.text });
  const printed = mcu.fw?.printed.join("") ?? "";
  if (printed) printed.split("\n").filter(Boolean).slice(-8).forEach((txt) => lines.push({ t: mcu.time, text: txt }));
  const shown = lines.filter((l) => l.t > clearedAt).sort((a, b) => a.t - b.t);
  useEffect(() => { if (autoScroll && monitor.current) monitor.current.scrollTop = monitor.current.scrollHeight; }, [shown.length, autoScroll]);

  const boardSvg = (b: Board) => (
    <svg viewBox="-16 -12 300 216" className="mcl-svg" role="img" aria-label={INFO[b].name}>
      <HwDefs id={`l05${b}`} />
      {b === "avr" ? <ArduinoUno x={8} y={0} l={ledOf("avr")} id={`l05${b}`} onReset={running === "avr" ? lab.resetSim : undefined} />
        : b === "msp" ? <LaunchPad x={4} y={2} led1={ledOf("msp")} id={`l05${b}`} />
          : <g transform="translate(82 -10) rotate(0)"><NucleoBoard scale={0.6} ld2={ledOf("arm")} id={`l05${b}`} chipLabel="STM32F401" onReset={running === "arm" ? lab.resetSim : undefined} /></g>}
    </svg>
  );

  return (
    <LabShell meta={meta} lab={lab} subtitle="Compare architecture, performance, memory, and applications across MCU classes."
      components={["Arduino Uno (ATmega328P, 8-bit AVR)", "MSP-EXP430G2 LaunchPad (MSP430G2553, 16-bit)", "NUCLEO-F401RE (STM32F401, 32-bit Cortex-M4)"]}>
      <div className="mcl-grid mcl-l05-grid">
        <Panel title="MCU Comparison" icon="cpu" className="mcl-sim mcl-l05-cmp" tools={<Seg size="sm" value={view} onChange={setView} options={[{ value: "overview", label: "Overview" }, { value: "details", label: "Details" }, { value: "block", label: "Block Diagram" }]} />}>
          <div className="mcl-l05-cards">
            {(["avr", "msp", "arm"] as Board[]).map((b) => (
              <button type="button" key={b} className={`mcl-l05-card ${running === b ? "run" : ""}`} style={{ background: INFO[b].soft, borderColor: running === b ? INFO[b].color : undefined }} onClick={() => select(b)} aria-label={`Run the ${INFO[b].bits}-bit example on ${INFO[b].name}`}>
                <span className="mcl-l05-card-h"><i style={{ background: INFO[b].color }}><Icon name="chip" size={14} /></i><span><b style={{ color: INFO[b].color }}>{INFO[b].title}</b><small>{INFO[b].tag}</small></span>{running === b ? <em>running</em> : null}</span>
                {view === "overview" ? boardSvg(b) : view === "details" ? (
                  <span className="mcl-l05-det" onClick={(e) => e.stopPropagation()} role="presentation">
                    <label>Clock <b>{mhz[b]} MHz</b>
                      <input type="range" min={b === "arm" ? 16 : 1} max={b === "avr" ? 20 : b === "msp" ? 16 : 84} value={mhz[b]} onChange={(e) => lab.setParam(b === "avr" ? "avrMHz" : b === "msp" ? "mspMHz" : "armMHz", Number(e.target.value))} aria-label={`${INFO[b].title} clock`} />
                    </label>
                    <span>Word: {INFO[b].bits} bits · Flash {INFO[b].flash} · RAM {INFO[b].ram}</span>
                    <span>{bench.label.replace(" (Relative)", "")}: <b>{fmt(perf(b))} {bench.unit}</b></span>
                    <span>32-bit add: {b === "avr" ? "4 instructions" : b === "msp" ? "2 instructions" : "1 instruction"}</span>
                    <span>LED pin {INFO[b].pin}: {b === running ? (led ? "HIGH" : "LOW") : "board idle"}</span>
                  </span>
                ) : (
                  <svg viewBox="0 0 220 150" className="mcl-svg" role="img" aria-label={`${INFO[b].bits}-bit datapath`}>
                    <rect x="70" y="10" width="80" height="44" rx="6" fill="#1f2a3a" /><text x="110" y="30" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="800">{INFO[b].bits}-bit ALU</text><text x="110" y="44" textAnchor="middle" fill="#b9c6d8" fontSize="8">{b === "avr" ? "AVR RISC" : b === "msp" ? "MSP430 CPU" : "Cortex-M4 + FPU"}</text>
                    {Array.from({ length: INFO[b].bits / 4 }, (_, i) => <line key={i} x1={22 + i * (176 / (INFO[b].bits / 4))} y1="70" x2={22 + i * (176 / (INFO[b].bits / 4))} y2="92" stroke={INFO[b].color} strokeWidth="2" opacity={b === running && led ? 1 : 0.55} />)}
                    <text x="110" y="66" textAnchor="middle" fontSize="8.5" fill="#2a4672">{INFO[b].bits}-bit data bus</text>
                    <rect x="14" y="98" width="88" height="40" rx="5" fill="#fff" stroke="#c9d6e6" /><text x="58" y="116" textAnchor="middle" fontSize="9" fontWeight="700">Flash {INFO[b].flash}</text><text x="58" y="129" textAnchor="middle" fontSize="8" fill="#4b6283">program</text>
                    <rect x="118" y="98" width="88" height="40" rx="5" fill="#fff" stroke="#c9d6e6" /><text x="162" y="116" textAnchor="middle" fontSize="9" fontWeight="700">SRAM {INFO[b].ram}</text><text x="162" y="129" textAnchor="middle" fontSize="8" fill="#4b6283">data</text>
                  </svg>
                )}
                <span className="mcl-l05-name">{INFO[b].name.replace(/ \(/, "\n(")}</span>
                <span className="mcl-l05-chips">{INFO[b].chips.map((c) => <span key={c} className="mcl-chip" style={{ color: INFO[b].color }}>{c}</span>)}</span>
              </button>
            ))}
          </div>
        </Panel>

        <Panel title="Key Specifications" icon="table" className="mcl-l05-spec" tools={<Seg size="sm" value={specView} onChange={setSpecView} options={[{ value: "side", label: "Side-by-side" }, { value: "table", label: "Table View" }]} />}>
          {specView === "side" ? (
            <table className="mcl-table mcl-l05-spectable">
              <thead><tr><th>Feature</th><th className="a">8-bit (AVR)</th><th className="m">16-bit (MSP430)</th><th className="r">32-bit (ARM Cortex-M)</th></tr></thead>
              <tbody>{SPECS.map(([f, ...v]) => <tr key={f}><td>{f}</td>{v.map((c, i) => <td key={i} className={(["avr", "msp", "arm"] as Board[])[i] === running ? "cur" : ""}>{c}</td>)}</tr>)}</tbody>
            </table>
          ) : (
            <table className="mcl-table mcl-l05-spectable">
              <thead><tr><th>MCU</th><th>Word</th><th>Clock (set)</th><th>RAM</th><th>{bench.unit}</th></tr></thead>
              <tbody>{(["avr", "msp", "arm"] as Board[]).map((b) => <tr key={b} className={b === running ? "hl" : ""}><td>{INFO[b].name}</td><td>{INFO[b].bits}-bit</td><td>{mhz[b]} MHz</td><td>{INFO[b].ram}</td><td>{fmt(perf(b))}</td></tr>)}</tbody>
            </table>
          )}
        </Panel>

        <Panel title="Performance Benchmark" icon="gauge" className="mcl-l05-bench" tools={<select className="mcl-input mcl-l05-sel" value={params.bench} onChange={(e) => lab.setParam("bench", e.target.value)} aria-label="Benchmark">{Object.entries(BENCH).map(([k, b]) => <option key={k} value={k}>{b.label}</option>)}</select>}>
          <div className="mcl-l05-gauges">
            {(["avr", "msp", "arm"] as Board[]).map((b) => (
              <div key={b} className={b === running ? "run" : ""}>
                <b>{INFO[b].bits}-bit ({b === "avr" ? "AVR" : b === "msp" ? "MSP430" : "ARM Cortex-M"})</b>
                <Gauge ratio={ratios[b]} max={maxRatio} color={b === "avr" ? "#94a3b8" : INFO[b].color} label={b === "avr" ? "Baseline" : ratios[b] >= 8 ? "Much Faster" : ratios[b] >= 1.05 ? "Faster" : ratios[b] <= 0.95 ? "Slower" : "Similar"} />
                <small>{mhz[b]} MHz</small>
                <small>≈ {fmt(perf(b))} {bench.unit}</small>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Use-Case Matcher" icon="target" className="mcl-l05-match" tools={<button type="button" className="mcl-small-btn" onClick={() => document.querySelector(".mcl-l05-rec")?.scrollIntoView({ behavior: "smooth", block: "nearest" })}><Icon name="search" size={13} /> Find the right MCU</button>}>
          <div className="mcl-l05-matchgrid">
            <label className="mcl-field"><span>What are you building?</span><select className="mcl-input" value={params.useCase} onChange={(e) => lab.setParam("useCase", e.target.value)}>{Object.keys(USE_CASES).map((k) => <option key={k}>{k}</option>)}</select></label>
            <label className="mcl-field"><span>Key priority:</span><select className="mcl-input" value={params.priority} onChange={(e) => lab.setParam("priority", e.target.value)}>{Object.keys(PRIORITY).map((k) => <option key={k}>{k}</option>)}</select></label>
            <label className="mcl-field"><span>Other requirement:</span><select className="mcl-input" value={params.req} onChange={(e) => lab.setParam("req", e.target.value)}>{Object.keys(REQ).map((k) => <option key={k}>{k}</option>)}</select></label>
            <button type="button" className="mcl-btn mcl-btn-run mcl-l05-recbtn" onClick={() => lab.setParam("rec", recommend(params.useCase, params.priority, params.req))}><Icon name="target" />Recommend MCU</button>
          </div>
          <div className={`mcl-l05-rec ${rec ? "on" : ""}`}>
            {rec ? (
              <>
                <b><Icon name="check" /> Recommended: {INFO[rec].bits}-bit MCU</b>
                <span>{INFO[rec].name} — best match for a {params.useCase.toLowerCase()} where {params.priority.toLowerCase()} matters{params.req !== "None" ? ` and you need ${params.req.toLowerCase()}` : ""}.</span>
                <button type="button" className="mcl-small-btn primary" onClick={() => select(rec)}>Load its example</button>
              </>
            ) : <span className="mcl-muted">Choose your project and press Recommend MCU.</span>}
          </div>
        </Panel>

        <div className="mcl-l05-code">
          <div className="mcl-l05-tabs" role="tablist" aria-label="Example program">
            {(["avr", "msp", "arm"] as Board[]).map((b) => <button key={b} type="button" role="tab" aria-selected={editing === b} className={editing === b ? "on" : ""} onClick={() => select(b)}>{INFO[b].label}{running === b ? <i /> : null}</button>)}
          </div>
          <CodeEditor lab={lab} languages={[{ label: "Arduino (ATmega328P)", code: AVR }, { label: "MSP430G2553", code: MSP }, { label: "STM32F401RE", code: ARM }]} />
        </div>

        <Panel title="Serial Monitor" icon="terminal" className="mcl-l05-serial" tools={<>
          <button type="button" className="mcl-small-btn" onClick={() => setClearedAt(mcu.time)}>Clear</button>
          <Toggle label="Auto Scroll" checked={autoScroll} onChange={setAutoScroll} />
        </>}>
          <div className="mcl-l05-monitor" ref={monitor} role="log">
            {shown.map((l, i) => <div key={i}><time>{stamp(l.t)}</time> {l.text}</div>)}
          </div>
        </Panel>

        <div className="mcl-l05-notes">
          <LearningNotes notes={{
            takeaways: ["Understand word size and its impact", "Compare memory architecture (RAM, Flash, address space)", "Analyze performance and power consumption", "Explore real-world applications for each MCU class", "Experiment with example code on different boards", "Try changing the clock speed and observe performance"],
            observe: "The running board's LED blinks from its own firmware — AVR PB5, MSP430 P1.0, STM32 PA5.",
            tryIt: "Click another board card: its example is loaded, compiled for that family and flashed.",
            measure: "Switch the benchmark to 32-bit multiply: the 8-bit AVR needs ~42 cycles per MAC, the Cortex-M4 one.",
            modify: "Delete the WDTCTL line in the MSP430 example and Run — the watchdog resets the chip every few ms.",
            runAgain: "Change each clock in the Details tab and compare the gauges again.",
            challenge: "Find a benchmark where the 16-bit MCU is slower than the 8-bit one at the same clock, and explain why.",
            checks: [{ label: `Ran code on all three architectures (${ran.size}/3)`, done: ran.size === 3 }, { label: "Got a recommendation", done: !!rec }],
            question: "Pro Tip: A larger word size doesn't always mean \"better\" — choose the right MCU for your application's needs!",
          }} />
        </div>
      </div>
    </LabShell>
  );
}

function fmt(v: number) { return v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v >= 1 ? v.toFixed(2) : v.toFixed(3); }
