import { useEffect, useState } from "react";
import { activity, sampleActivity } from "../core/activity";
import { useLab } from "../core/useLab";
import type { LabMeta } from "../registry";
import { CodeEditor } from "../ui/CodeEditor";
import { Icon } from "../ui/Icon";
import { LearningNotes, Panel, Seg, Toggle, hex } from "../ui/Panels";
import { LabShell } from "../ui/Shell";
import { LQFP48, isGpio, pinConfig, pinFunction, togglePin } from "./stm32f1";

const SYSTICK = `/* Core Lab 3 - MCU Architecture Explorer */
#include "stm32f10x.h"

// Simple program: toggle LED and use timer interrupt
volatile uint32_t msTicks = 0;

void SysTick_Handler(void) {
    msTicks++;                       // Interrupt handler (triggered by timer)
}

int main(void) {
    // Initialize GPIO (PA5 = LED)
    RCC->APB2ENR |= RCC_APB2ENR_IOPAEN;
    GPIOA->CRL &= ~(0xF << 20);      // Clear PA5
    GPIOA->CRL |=  (0x1 << 20);      // Output mode (10 MHz)

    // Configure SysTick timer (1 ms interrupt)
    SysTick->LOAD = 72000 - 1;       // 72 MHz / 1000
    SysTick->VAL = 0;
    SysTick->CTRL = SysTick_CTRL_CLKSOURCE_Msk |
                    SysTick_CTRL_TICKINT_Msk |
                    SysTick_CTRL_ENABLE_Msk;

    uint32_t last = 0;
    while (1) {
        if (msTicks - last >= 500) { // every 500 ms
            last = msTicks;
            GPIOA->ODR ^= (1 << 5);  // toggle LED
        }
    }
}
`;
const SERIAL = `/* Core Lab 3 - exercise the serial interface path */
#include "stm32f10x.h"

volatile uint32_t msTicks = 0;
void SysTick_Handler(void) { msTicks++; }

int main(void) {
    RCC->APB2ENR |= RCC_APB2ENR_IOPAEN | RCC_APB2ENR_USART1EN;
    GPIOA->CRL = (GPIOA->CRL & ~(0xF << 20)) | (0x1 << 20);
    USART1->BRR = 0x271;             // 115200 baud @ 72 MHz
    USART1->CR1 = USART_CR1_UE | USART_CR1_TE;
    SysTick->LOAD = 72000 - 1;
    SysTick->CTRL = 7;
    uint32_t last = 0;
    char c = 'A';
    while (1) {
        if (msTicks - last >= 250) {
            last = msTicks;
            while (!(USART1->SR & USART_SR_TXE)) { }
            USART1->DR = c;          // System bus -> APB2 -> USART1
            c = (c == 'Z') ? 'A' : c + 1;
            GPIOA->ODR ^= (1 << 5);
        }
    }
}
`;

type P = { clockMHz: number };
type Stage = "fetch" | "decode" | "execute" | "memory" | "periph" | "irq";
type Hl = Record<"fetch" | "decode" | "execute" | "memory" | "periph" | "irq", boolean>;

function perBlock(path: string): "gpio" | "timers" | "adc" | "serial" | "nvic" | "rcc" {
  if (path.startsWith("GPIO")) return "gpio";
  if (path.startsWith("TIM")) return "timers";
  if (path.startsWith("ADC")) return "adc";
  if (/^(USART|SPI|I2C)/.test(path)) return "serial";
  if (/^(NVIC|SysTick|SCB|EXTI)/.test(path)) return "nvic";
  return "rcc";
}

export default function L03({ meta }: { meta: LabMeta }) {
  const lab = useLab<P>({
    slug: meta.slug, code: SYSTICK, params: { clockMHz: 72 },
    mcu: (p) => ({ part: "F103", clock: p.clockMHz * 1e6 }),
    world: (m) => sampleActivity(m), rebuildOn: ["clockMHz"],
  });
  const { mcu, params } = lab;
  const [mode, setMode] = useState<"live" | "step">("live");
  const [hl, setHl] = useState<Hl>({ fetch: true, decode: false, execute: false, memory: true, periph: true, irq: true });
  const [stepIdx, setStepIdx] = useState(0);
  const [pinTab, setPinTab] = useState<"pinout" | "list" | "map">("pinout");
  const [pin, setPin] = useState("PA5");
  const [seen, setSeen] = useState<Set<Stage>>(() => new Set());

  const fw = mcu.fw;
  const lines = lab.compiledCode.split("\n");
  const line = fw?.line ?? 0;
  const text = (lines[line - 1] ?? "").replace(/\/\/.*$/, "").trim();
  const inIsr = !!fw?.threads.some((t) => t.kind === "isr" && t.state !== "done");
  const lastBus = mcu.busLog.length ? mcu.busLog[mcu.busLog.length - 1]! : undefined;
  const writesVar = /^[A-Za-z_]\w*\s*(\+\+|--|[-+*/|&^]?=(?!=))/.test(text) && !text.includes("->");
  const order: Stage[] = ["fetch", "decode", "execute", text.includes("->") ? "periph" : writesVar ? "memory" : "execute"];
  if (inIsr) order.push("irq");
  const liveIdx = Math.floor(mcu.time * 2.5) % order.length;
  const stage: Stage = order[(mode === "live" ? liveIdx : stepIdx) % order.length]!;
  useEffect(() => { if (lab.status !== "stopped") setSeen((s) => (s.has(stage) ? s : new Set(s).add(stage))); }, [stage, lab.status]);
  const act = activity(mcu, 1);
  const cyc = 1e9 / mcu.clock;
  const ws = mcu.clock > 48e6 ? 2 : mcu.clock > 24e6 ? 1 : 0;
  const pc = 0x08000130 + Math.max(0, line) * 8;
  const msTicks = fw?.num("msTicks") ?? 0;
  const tickRate = act.window ? (mcu.irqCount.get("SysTick") ?? 0) / Math.max(1e-3, mcu.time) : 0;

  const on = (s: Stage) => stage === s && (s === "execute" ? hl.execute : hl[s]);
  const busBlock = lastBus ? perBlock(lastBus.path) : "rcc";
  const pBlock = (b: string) => on("periph") && busBlock === b;

  const details: Record<Stage, { title: string; step: string; desc: string; rows: Array<[string, string]>; bus: string; from: string; to: string }> = {
    fetch: { title: "Flash → CPU (Instruction Fetch)", step: "Instruction Fetch", desc: "The CPU reads an instruction from Flash memory via the I-Code bus. The instruction is loaded into the Instruction Register, then decoded and executed.", bus: "I-Code Bus", from: hex(pc), to: "Instruction Register",
      rows: [["Source", `Flash Memory (${hex(pc)})`], ["Destination", "CPU (Instruction Register)"], ["Bus", "I-Code Bus (AHB)"], ["Data Width", "32 bits (two 16-bit Thumb ops)"], ["C statement", text || "—"], ["Time (simulated)", `1 cycle (${(mcu.clock / 1e6).toFixed(0)} MHz → ${cyc.toFixed(1)} ns), ${ws} wait state${ws === 1 ? "" : "s"} on a prefetch miss`]] },
    decode: { title: "Instruction Register → Decoder", step: "Decode", desc: "The decoder works out which operation the Thumb-2 instruction performs and which registers it uses. On the Cortex-M3 this is the second pipeline stage.", bus: "Internal", from: "IR", to: "Decoder",
      rows: [["Pipeline", "3-stage: Fetch · Decode · Execute"], ["Statement kind", /^if|while|for/.test(text) ? "Compare + conditional branch" : text.includes("(") && !text.includes("=") ? "Function call (BL)" : text.includes("->") ? "Load/store to peripheral" : "Data processing"], ["C statement", text || "—"], ["Time (simulated)", `1 cycle (${cyc.toFixed(1)} ns)`]] },
    execute: { title: "Decoder → ALU / Registers", step: "Execute", desc: "The ALU performs the arithmetic or logic and writes the result back to a register (R0–R12). Branches update the Program Counter.", bus: "Internal", from: "Registers", to: "ALU",
      rows: [["PC (≈)", hex(pc)], ["SP (≈)", hex(0x20005000 - (fw?.threads[0]?.frames.length ?? 1) * 32 - (inIsr ? 32 : 0))], ["msTicks", String(msTicks)], ["Time (simulated)", `1 cycle (${cyc.toFixed(1)} ns)`]] },
    memory: { title: "CPU → SRAM (Data Access)", step: "Memory Access", desc: "A load or store moves data between a register and SRAM over the D-Code / System bus. Global variables such as msTicks live here.", bus: "D-Code Bus", from: "R0", to: "0x2000 0000",
      rows: [["Source", "CPU register"], ["Destination", "SRAM (0x2000 0000 region)"], ["Bus", "D-Code / System bus (AHB)"], ["Data Width", "32 bits"], ["C statement", text || "—"], ["Time (simulated)", `2 cycles (${(2 * cyc).toFixed(1)} ns)`]] },
    periph: { title: `CPU → ${lastBus ? lastBus.path.split(".")[0] : "Peripheral"} (Register Access)`, step: "Peripheral Access", desc: "Peripheral registers are memory-mapped. A store to their address travels over the System bus and an AHB→APB bridge to the peripheral.", bus: "System Bus", from: "CPU", to: lastBus ? hex(lastBus.addr) : "—",
      rows: [["Register", lastBus ? lastBus.path.replace(".", "->") : "—"], ["Address", lastBus ? hex(lastBus.addr) : "—"], ["Access", lastBus ? `${lastBus.rw === "W" ? "Write" : "Read"} ${hex(lastBus.value)}` : "—"], ["Bus", `System bus → ${lastBus && /^(TIM[2-4]|USART[23]|I2C)/.test(lastBus.path) ? "APB1" : "APB2"} bridge`], ["Accesses / s", act.busPerSec.toFixed(0)], ["Time (simulated)", `≈ 3 cycles (${(3 * cyc).toFixed(1)} ns)`]] },
    irq: { title: "NVIC → CPU (Exception Entry)", step: "Interrupt", desc: "The NVIC signals the core, which pushes R0–R3, R12, LR, PC and xPSR onto the stack and jumps to the handler from the vector table.", bus: "Control", from: "NVIC", to: "SysTick_Handler",
      rows: [["Source", "SysTick (exception 15)"], ["Handler", "SysTick_Handler"], ["Rate", `${tickRate.toFixed(0)} / s`], ["Entry latency", `12 cycles (${(12 * cyc).toFixed(0)} ns)`]] },
  };
  const d = details[stage];

  const box = (x: number, y: number, w: number, h: number, active: boolean, color: string) => (
    <rect x={x} y={y} width={w} height={h} rx={7} fill={active ? `${color}22` : "#fff"} stroke={active ? color : "#c9d6e6"} strokeWidth={active ? 2.4 : 1.2} className={active ? "mcl-l03-glow" : ""} />
  );
  const flow = (dPath: string, color: string, active: boolean, dashed = false) => <path d={dPath} fill="none" stroke={color} strokeWidth={active ? 3.2 : 1.6} strokeDasharray={dashed ? "6 4" : active ? "8 5" : undefined} opacity={active ? 1 : 0.55} className={active ? "mcl-l03-flow" : ""} markerEnd={`url(#l03-arrow-${color.slice(1)})`} />;
  const stageBox = (label: string, y: number, active: boolean) => (
    <g key={label}>
      <rect x={206} y={y} width={118} height={26} rx={5} fill={active ? "#1769e0" : "#f3f7fc"} stroke={active ? "#1769e0" : "#cfdcec"} />
      <text x={265} y={y + 17} textAnchor="middle" fontSize="10.5" fontWeight={active ? 800 : 600} fill={active ? "#fff" : "#2a4672"}>{label}</text>
    </g>
  );
  const colors = ["#1769e0", "#16a34a", "#f97316", "#ef4444"];
  const per = [
    { id: "gpio", t: "GPIO", s: "(Port A, B, C…)", y: 18 }, { id: "timers", t: "Timers", s: "(TIM1, TIM2, TIM3…)", y: 70 },
    { id: "adc", t: "ADC", s: "(Analog to Digital)", y: 122 }, { id: "serial", t: "Serial Interfaces", s: "(USART, SPI, I2C)", y: 174 }, { id: "nvic", t: "Interrupt Controller", s: "(NVIC)", y: 226 },
  ];

  const sel = pinConfig(mcu, pin);
  const pinLevel = isGpio(pin) ? mcu.level(pin) : 0;
  const advance = () => {
    if (lab.running) lab.toggle();
    const next = stepIdx + 1;
    if (next >= order.length) { setStepIdx(0); lab.step("into"); } else setStepIdx(next);
  };
  const regions = [
    { name: "Flash (code)", from: 0x08000000, to: 0x0801ffff, key: "" },
    { name: "SRAM", from: 0x20000000, to: 0x20004fff, key: "" },
    { name: "APB1 peripherals (TIM2–4, USART2/3, I2C)", from: 0x40000000, to: 0x40007fff, key: "apb1" },
    { name: "APB2 peripherals (GPIO, ADC1, TIM1, SPI1, USART1)", from: 0x40010000, to: 0x40013fff, key: "apb2" },
    { name: "AHB (RCC, DMA, Flash interface)", from: 0x40018000, to: 0x40023fff, key: "ahb" },
    { name: "Cortex-M3 private (NVIC, SysTick, SCB)", from: 0xe0000000, to: 0xe00fffff, key: "ppb" },
  ];
  const regionHits = (r: (typeof regions)[number]) => mcu.busLog.filter((b) => b.addr >= r.from && b.addr <= r.to).length;

  return (
    <LabShell meta={meta} lab={lab} subtitle="Interactively explore the internal architecture and signal flow of a microcontroller."
      components={["STM32F103C8T6 (Cortex-M3, LQFP48)", "128 KB Flash, 20 KB SRAM", "User LED on PA5"]}>
      <div className="mcl-grid mcl-l03-grid">
        <Panel title="MCU Architecture Explorer" icon="cpu" className="mcl-sim mcl-l03-exp" tools={<>
          <span className={`mcl-chip ${lab.status === "running" ? "mcl-chip-live" : ""}`}>{mode === "live" ? "Live Simulation" : "Step Mode"}</span>
          <span className="mcl-chip">STM32F103 (Cortex-M3)</span>
        </>}>
          <svg viewBox="0 0 640 336" className="mcl-svg" role="img" aria-label="Signal flow inside the microcontroller">
            <defs>{colors.map((c) => <marker key={c} id={`l03-arrow-${c.slice(1)}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill={c} /></marker>)}</defs>
            {box(10, 18, 132, 64, on("fetch"), "#1769e0")}
            <text x="34" y="44" fontSize="12" fontWeight="800" fill="#0f2547">Program Memory</text><text x="34" y="60" fontSize="10" fill="#4b6283">Flash (128 KB)</text>
            {box(10, 108, 132, 64, on("memory"), "#16a34a")}
            <text x="34" y="134" fontSize="12" fontWeight="800" fill="#0f2547">Data Memory</text><text x="34" y="150" fontSize="10" fill="#4b6283">SRAM (20 KB)</text>
            {box(10, 198, 132, 64, on("periph"), "#f97316")}
            <text x="34" y="224" fontSize="12" fontWeight="800" fill="#0f2547">Peripherals</text><text x="34" y="240" fontSize="10" fill="#4b6283">(Registers)</text>
            {[[50, "#1769e0"], [140, "#16a34a"], [230, "#f97316"]].map(([y, c]) => <rect key={String(y)} x="18" y={Number(y) - 14} width="10" height="28" rx="2" fill={String(c)} opacity=".85" />)}

            {flow("M142 44 H176 V73 H204", "#1769e0", on("fetch"), true)}
            {flow("M204 150 H176 V130 H142", "#16a34a", on("memory"))}
            {flow("M204 228 H176 V222 H142", "#f97316", on("periph"))}

            <rect x="190" y="10" width="150" height="276" rx="10" fill="#f8fbff" stroke={inIsr && hl.irq ? "#ef4444" : "#1769e0"} strokeWidth="1.8" />
            <text x="265" y="30" textAnchor="middle" fontSize="13" fontWeight="800" fill="#0f2547">CPU</text>
            <text x="265" y="45" textAnchor="middle" fontSize="11" fill="#2a4672">Cortex-M3</text>
            {stageBox("Instruction Fetch", 60, on("fetch"))}
            {stageBox("Decode", 94, on("decode"))}
            {stageBox("Execute", 128, on("execute"))}
            {stageBox("ALU", 162, on("execute"))}
            <rect x="206" y="198" width="118" height="78" rx="5" fill={on("execute") || on("memory") ? "#e8f1ff" : "#f3f7fc"} stroke="#cfdcec" />
            <text x="265" y="214" textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#2a4672">Registers</text>
            <text x="265" y="228" textAnchor="middle" fontSize="9" fill="#4b6283">(R0 – R15, SP, PC)</text>
            <text x="214" y="246" fontSize="8.5" fill="#0f2547" className="mcl-mono-svg">PC {hex(pc)}</text>
            <text x="214" y="259" fontSize="8.5" fill="#0f2547" className="mcl-mono-svg">msTicks {msTicks}</text>
            <text x="214" y="272" fontSize="8.5" fill={inIsr ? "#dc2626" : "#0f2547"} className="mcl-mono-svg">{inIsr ? "Handler mode" : "Thread mode"}</text>

            {[[364, "#1769e0", on("fetch")], [380, "#16a34a", on("memory")], [396, "#f97316", on("periph")]].map(([x, c, a]) => <rect key={String(x)} x={Number(x)} y="16" width="8" height="270" rx="3" fill={String(c)} opacity={a ? 1 : 0.35} />)}
            {flow("M340 74 H364", "#1769e0", on("fetch"))}
            {flow("M340 150 H380", "#16a34a", on("memory"))}
            <text x="412" y="24" fontSize="9.5" fontWeight="700" fill="#1769e0">I-Code Bus</text><text x="412" y="35" fontSize="8.5" fill="#4b6283">(instructions)</text>
            <text x="412" y="52" fontSize="9.5" fontWeight="700" fill="#16a34a">D-Code Bus</text><text x="412" y="63" fontSize="8.5" fill="#4b6283">(data)</text>
            <text x="412" y="80" fontSize="9.5" fontWeight="700" fill="#f97316">System Bus</text><text x="412" y="91" fontSize="8.5" fill="#4b6283">(peripherals)</text>
            {per.map((p) => {
              const a = p.id === "nvic" ? (on("irq") || pBlock("nvic")) : pBlock(p.id);
              return (
                <g key={p.id}>
                  {p.id === "nvic" ? flow(`M496 ${p.y + 30} H404 V282 H340`, "#ef4444", on("irq"), true) : null}
                  {flow(`M400 ${p.y + 23} H496`, "#f97316", a && p.id !== "nvic")}
                  {box(498, p.y, 136, 46, a, p.id === "nvic" ? "#ef4444" : "#f97316")}
                  <text x="540" y={p.y + 21} fontSize="11" fontWeight="800" fill="#0f2547">{p.t}</text>
                  <text x="540" y={p.y + 35} fontSize="8.5" fill="#4b6283">{p.s}</text>
                  <rect x="508" y={p.y + 11} width="24" height="24" rx="5" fill={p.id === "nvic" ? "#fee2e2" : "#e8f1ff"} />
                  <text x="520" y={p.y + 28} textAnchor="middle" fontSize="12">{({ gpio: "⌁", timers: "◷", adc: "∿", serial: "⇄", nvic: "!" } as Record<string, string>)[p.id]}</text>
                </g>
              );
            })}
            {[["Data Flow", "(instructions, read data)", "#1769e0", false], ["Data Flow", "(write data)", "#16a34a", false], ["Peripheral Bus", "(APB2 / APB1)", "#f97316", false], ["Control Flow", "(interrupts, control signals)", "#ef4444", true]].map(([t, s, c, dsh], i) => (
              <g key={i} transform={`translate(${12 + i * 158} 300)`}>
                <path d="M0 8 H34" stroke={String(c)} strokeWidth="2.4" strokeDasharray={dsh ? "5 3" : undefined} markerEnd={`url(#l03-arrow-${String(c).slice(1)})`} />
                <text x="42" y="8" fontSize="9.5" fontWeight="700" fill="#0f2547">{t}</text><text x="42" y="20" fontSize="8.5" fill="#4b6283">{s}</text>
              </g>
            ))}
          </svg>
        </Panel>

        <Panel title="Selected Path Details" icon="target" className="mcl-l03-det">
          <div className="mcl-l03-pathhead"><b>{d.title}</b><span>Current Step: <em>{d.step}</em></span></div>
          <p className="mcl-l03-desc">{d.desc}</p>
          <dl className="mcl-l02-dl">{d.rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd className={k === "C statement" ? "mcl-mono-dd" : ""}>{v}</dd></div>)}</dl>
          <div className="mcl-l03-signal">
            <b><i />Live Signal Activity</b>
            <div><span>{d.bus}</span><code>{d.from} → {d.to}</code></div>
            <small>{lab.status === "running" ? `${d.step} in progress…` : `${d.step} (simulation ${lab.status})`}</small>
          </div>
        </Panel>

        <Panel title="Simulation Controls" icon="sliders" className="mcl-l03-ctl">
          <div className="mcl-field"><span>View Mode</span><Seg size="sm" value={mode} onChange={(v) => { setMode(v); if (v === "step" && lab.running) lab.toggle(); if (v === "live" && !lab.running) lab.toggle(); }} options={[{ value: "live", label: "Live" }, { value: "step", label: "Step" }]} /></div>
          {([["fetch", "Highlight Instruction Fetch Path"], ["decode", "Highlight Decode Stage"], ["execute", "Highlight Execute Stage"], ["memory", "Highlight Memory Access"], ["periph", "Highlight Peripheral Access"], ["irq", "Highlight Interrupt Path"]] as const).map(([k, l]) => (
            <Toggle key={k} label={l} checked={hl[k]} onChange={(v) => setHl((h) => ({ ...h, [k]: v }))} />
          ))}
          <label className="mcl-l03-speed">Simulation Speed
            <input type="range" min={0} max={4} step={1} value={[0.01, 0.1, 0.25, 0.5, 1].indexOf(lab.speed) < 0 ? 4 : [0.01, 0.1, 0.25, 0.5, 1].indexOf(lab.speed)} onChange={(e) => lab.setSpeed([0.01, 0.1, 0.25, 0.5, 1][Number(e.target.value)]!)} aria-label="Simulation speed" />
            <span><small>Slow</small><b>{lab.speed}×</b><small>Fast</small></span>
          </label>
          <div className="mcl-field"><span>Clock Frequency</span>
            <select className="mcl-input" value={params.clockMHz} onChange={(e) => lab.setParam("clockMHz", Number(e.target.value))} aria-label="Clock frequency">{[8, 24, 48, 72].map((c) => <option key={c} value={c}>{c} MHz</option>)}</select>
          </div>
          {mode === "step" ? (
            <button type="button" className="mcl-btn mcl-btn-run mcl-l03-wide" onClick={advance}><Icon name="chevRight" />Step ({d.step})</button>
          ) : (
            <button type="button" className="mcl-btn mcl-btn-run mcl-l03-wide" onClick={lab.toggle}><Icon name={lab.running ? "pause" : "play"} />{lab.running ? "Pause Simulation" : "Resume Simulation"}</button>
          )}
          <small className="mcl-muted">SysTick: {tickRate.toFixed(0)} interrupts/s · LOAD = {mcu.peek("SysTick.LOAD")} → {mcu.peek("SysTick.LOAD") ? ((mcu.peek("SysTick.LOAD") + 1) / mcu.clock * 1000).toFixed(2) : "—"} ms</small>
        </Panel>

        <CodeEditor lab={lab} className="mcl-l03-code" languages={[{ label: "C (STM32)", code: SYSTICK }, { label: "C (Serial path)", code: SERIAL }]} />

        <Panel title="Pin and Peripheral Map" icon="grid" className="mcl-l03-pins">
          <Seg size="sm" value={pinTab} onChange={setPinTab} options={[{ value: "pinout", label: "Pinout View" }, { value: "list", label: "Peripheral List" }, { value: "map", label: "Memory Map" }]} />
          {pinTab === "pinout" ? (
            <div className="mcl-l03-pinwrap">
              <svg viewBox="0 0 300 260" className="mcl-svg" role="img" aria-label="STM32F103C8T6 LQFP48 pinout">
                <rect x="80" y="60" width="140" height="140" rx="6" fill="#1f2328" />
                <circle cx="94" cy="74" r="4" fill="#3b4048" />
                <text x="150" y="122" textAnchor="middle" fill="#d1d5db" fontSize="22" fontWeight="900" fontStyle="italic">ST</text>
                <text x="150" y="146" textAnchor="middle" fill="#e5e7eb" fontSize="9" fontWeight="700">STM32F103C8T6</text>
                <text x="150" y="160" textAnchor="middle" fill="#9ca3af" fontSize="8">LQFP48</text>
                {LQFP48.map((name, i) => {
                  const side = Math.floor(i / 12), k = i % 12, step = 140 / 12, off = step * (k + 0.5);
                  const [x, y, w, h, tx, ty, anchor] = side === 0 ? [72, 60 + off - 2.5, 8, 5, 68, 60 + off + 3, "end"] : side === 1 ? [80 + off - 2.5, 200, 5, 8, 80 + off, 214, "middle"] : side === 2 ? [220, 200 - off - 2.5, 8, 5, 232, 200 - off + 3, "start"] : [220 - off - 2.5, 52, 5, 8, 220 - off, 46, "middle"];
                  const gp = isGpio(name);
                  const lv = gp && mcu.pins.has(name) ? mcu.level(name) : 0;
                  const vertical = side === 1 || side === 3;
                  return (
                    <g key={i} className={gp ? "mcl-l03-pin" : ""} onClick={gp ? () => setPin(name) : undefined} role={gp ? "button" : undefined} tabIndex={gp ? 0 : undefined} aria-label={gp ? `Select pin ${name}` : undefined} onKeyDown={gp ? (e) => { if (e.key === "Enter") setPin(name); } : undefined}>
                      <rect x={Number(x)} y={Number(y)} width={Number(w)} height={Number(h)} fill={name === pin ? "#1769e0" : lv ? "#22c55e" : "#b8c0c8"} />
                      <text x={Number(tx)} y={Number(ty)} textAnchor={anchor as "end"} fontSize="7" fontWeight={name === pin ? 800 : 600} fill={name === pin ? "#1769e0" : gp ? "#23395b" : "#9aa6b6"} transform={vertical ? `rotate(-90 ${tx} ${ty})` : undefined}>{name}</text>
                    </g>
                  );
                })}
              </svg>
              <div className="mcl-l03-pinsel">
                <b><i className={pinLevel ? "hi" : ""} />Selected Pin: {pin}</b>
                <dl className="mcl-l02-dl">
                  <div><dt>Function</dt><dd>{pinFunction(pin)}</dd></div>
                  <div><dt>Mode</dt><dd>{sel.mode}</dd></div>
                  <div><dt>Speed</dt><dd>{sel.speed}</dd></div>
                  <div><dt>State</dt><dd>{pinLevel ? "High (3.3 V)" : "Low (0 V)"}</dd></div>
                </dl>
                <button type="button" className="mcl-small-btn primary" onClick={() => togglePin(mcu, pin)}>Toggle Pin</button>
                <div className="mcl-l03-conn"><small>Connected Peripheral</small><span>{pin === "PA5" ? "User LED (on board)" : pin === "PC13" ? "User button" : /PA9|PA10/.test(pin) ? "USART1 (serial monitor)" : "—"}</span></div>
              </div>
            </div>
          ) : pinTab === "list" ? (
            <table className="mcl-table">
              <thead><tr><th>Peripheral</th><th>Bus</th><th>Clock</th><th>Accesses</th></tr></thead>
              <tbody>{[["GPIOA", "APB2"], ["GPIOB", "APB2"], ["GPIOC", "APB2"], ["USART1", "APB2"], ["ADC1", "APB2"], ["TIM1", "APB2"], ["TIM2", "APB1"], ["SysTick", "PPB"], ["NVIC", "PPB"]].map(([p, b]) => {
                const a = mcu.access.get(p!);
                return <tr key={p}><td>{p}</td><td>{b}</td><td>{b === "PPB" ? "always" : mcu.clockEnabled(p!) ? "enabled" : "off"}</td><td>{a ? a.r + a.w : 0}</td></tr>;
              })}</tbody>
            </table>
          ) : (
            <table className="mcl-table mcl-mono">
              <thead><tr><th>Region</th><th>Range</th><th>Recent</th></tr></thead>
              <tbody>{regions.map((r) => <tr key={r.name}><td>{r.name}</td><td>{hex(r.from)}–{hex(r.to)}</td><td>{regionHits(r)}</td></tr>)}</tbody>
            </table>
          )}
        </Panel>

        <div className="mcl-col mcl-l03-side">
          <Panel title="Clock / Data / Control Flow Legend" icon="list">
            <ul className="mcl-l03-legend">
              {[["#1769e0", false, "Instruction/Data Flow", "Movement of instructions or data between blocks"], ["#16a34a", false, "Write Data Flow", "Data written to memory or peripherals"], ["#f97316", false, "Peripheral Bus (AHB/APB)", "Connection to on-chip peripherals"], ["#ef4444", true, "Control Flow", "Control signals, interrupts, bus arbitration"], ["#64748b", true, "Clock Signal", `System clock distribution (${params.clockMHz} MHz)`]].map(([c, dsh, t, s]) => (
                <li key={String(t)}><svg width="34" height="10" aria-hidden="true"><path d="M1 5 H30" stroke={String(c)} strokeWidth="2.4" strokeDasharray={dsh ? "5 3" : undefined} /></svg><b>{t}</b><span>{s}</span></li>
              ))}
            </ul>
          </Panel>
          <LearningNotes variant="tasks" notes={{
            takeaways: [],
            observe: "Explore how the CPU, memory, and peripherals work together.",
            tryIt: "Use the simulation controls to visualize different signal paths; switch to Step mode and click Step.",
            measure: "Observe how interrupts change the normal program flow (watch Handler mode in the CPU).",
            modify: "Modify the code — e.g. SysTick->LOAD = 7200 - 1 — and see how it affects the architecture activity.",
            runAgain: "Change the clock frequency and Run again: the SysTick period changes with it.",
            challenge: "Try enabling different peripherals (ADC, UART, Timer) and observe the data and control flow in real time.",
            checks: [
              { label: "Saw an instruction fetch", done: seen.has("fetch") },
              { label: "Saw a peripheral register access", done: seen.has("periph") },
              { label: "Saw an interrupt change program flow", done: seen.has("irq") },
              { label: "Used Step mode", done: mode === "step" && stepIdx > 0 },
            ],
          }} />
        </div>
      </div>
    </LabShell>
  );
}
