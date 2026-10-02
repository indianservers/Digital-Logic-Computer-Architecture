import { useEffect, useRef, useState } from "react";
import { useLab } from "../core/useLab";
import type { LabMeta } from "../registry";
import { CodeEditor } from "../ui/CodeEditor";
import { Breadboard, HwDefs, NucleoBoard, SvgLed, Wire } from "../ui/Hardware";
import { Icon } from "../ui/Icon";
import { LearningNotes, Panel, Seg, hex } from "../ui/Panels";
import { LabShell } from "../ui/Shell";

const GPIO = `#include "stm32f4xx.h"

// Lab 6 - Registers & Special Function Registers
// Configure PA0..PA3 as outputs and set PA0 and PA2 HIGH

void setup_registers(void) {
    // Enable GPIOA clock (RCC register)
    RCC->AHB1ENR |= (1 << 0);       // GPIOAEN

    // Set PA0..PA3 as outputs (MODER = 01 for each pin)
    GPIOA->MODER &= ~((3 << 0) | (3 << 2) | (3 << 4) | (3 << 6));  // Clear bits
    GPIOA->MODER |=  ((1 << 0) | (1 << 2) | (1 << 4) | (1 << 6));  // Output mode

    // Set PA0 and PA2 HIGH (ODR)
    GPIOA->ODR |= (1 << 0) | (1 << 2);
}

int main(void) {
    setup_registers();
    while (1) { /* Loop */ }
}
`;
const PERIPH = `#include "stm32f4xx.h"

// Lab 6 - Timer + ADC registers drive the LEDs on PA0..PA3
int main(void) {
    RCC->AHB1ENR |= RCC_AHB1ENR_GPIOAEN;
    RCC->APB1ENR |= RCC_APB1ENR_TIM2EN;
    RCC->APB2ENR |= RCC_APB2ENR_ADC1EN;
    GPIOA->MODER = (GPIOA->MODER & ~0xFF) | 0x55;   // PA0..PA3 outputs
    GPIOA->MODER |= (3 << (4 * 2));                 // PA4 analog (ADC1_IN4)

    TIM2->PSC = 8399;            // 84 MHz / 8400 = 10 kHz
    TIM2->ARR = 9999;            // 1 s period
    TIM2->CR1 |= TIM_CR1_CEN;    // start the counter

    ADC1->SQR3 = 4;              // channel 4 (PA4)
    ADC1->CR2 |= ADC_CR2_ADON;   // power up the ADC

    while (1) {
        ADC1->CR2 |= ADC_CR2_SWSTART;          // start a conversion
        while (!(ADC1->SR & ADC_SR_EOC)) { }
        uint32_t level = ADC1->DR >> 10;       // 0..3
        uint32_t bars = (1 << (level + 1)) - 1;
        if (TIM2->CNT > 5000) bars = bars & 0x7;  // blink the top LED
        GPIOA->ODR = (GPIOA->ODR & ~0xF) | bars;
    }
}
`;

interface RegDef { path: string; name: string; fields: string; fieldSub: string; desc: string; reset: number; ro?: boolean; bits: number; names: Record<number, string> }
const pa = (prefix = "PA") => Object.fromEntries(Array.from({ length: 16 }, (_, i) => [i, `${prefix}${i}`]));
const REGS: RegDef[] = [
  { path: "GPIOA.ODR", name: "GPIOA_ODR", fields: "ODR[15:0]", fieldSub: "Output Data", reset: 0, bits: 16, names: pa(), desc: "Port A output data register. Controls the output level of GPIO pins PA15..PA0. For pins configured as output (MODER = 01), each bit drives the pin level." },
  { path: "GPIOA.MODER", name: "GPIOA_MODER", fields: "MODER[15:0]", fieldSub: "GPIO Mode Register", reset: 0xa8000000, bits: 32, names: Object.fromEntries(Array.from({ length: 32 }, (_, i) => [i, `M${i >> 1}[${i & 1}]`])), desc: "Two bits per pin: 00 = input, 01 = general-purpose output, 10 = alternate function, 11 = analog. Reset value keeps the debug pins PA13–PA15 in AF mode." },
  { path: "GPIOA.IDR", name: "GPIOA_IDR", fields: "IDR[15:0]", fieldSub: "Input Data (read-only)", reset: 0, ro: true, bits: 16, names: pa(), desc: "Port A input data register. Reflects the actual logic level on every pin — also for outputs, so it confirms what ODR drives." },
  { path: "RCC.AHB1ENR", name: "RCC_AHB1ENR", fields: "GPIOAEN, GPIOBEN, GPIOCEN", fieldSub: "AHB1 Clock Enable", reset: 0, bits: 8, names: { 0: "GPIOAEN", 1: "GPIOBEN", 2: "GPIOCEN", 3: "GPIODEN", 4: "GPIOEEN", 7: "GPIOHEN" }, desc: "Peripheral clock gating for the AHB1 bus. A GPIO port ignores writes until its clock enable bit is set." },
  { path: "TIM2.CR1", name: "TIM2_CR1", fields: "CEN, DIR, ARPE", fieldSub: "Timer Control Register 1", reset: 0, bits: 8, names: { 0: "CEN", 1: "UDIS", 2: "URS", 3: "OPM", 4: "DIR", 7: "ARPE" }, desc: "TIM2 control register 1. CEN starts and stops the counter, DIR selects up/down counting, ARPE buffers ARR." },
  { path: "TIM2.CNT", name: "TIM2_CNT", fields: "CNT[31:0]", fieldSub: "Counter Value", reset: 0, bits: 16, names: {}, desc: "Current value of the TIM2 counter. It counts at the prescaled clock and wraps at ARR, generating an update event." },
  { path: "ADC1.CR2", name: "ADC1_CR2", fields: "ADON, CONT, SWSTART", fieldSub: "ADC Control Register 2", reset: 0, bits: 32, names: { 0: "ADON", 1: "CONT", 11: "ALIGN", 30: "SWSTART" }, desc: "ADC1 control register 2. ADON powers the converter, SWSTART (self-clearing) starts a regular conversion." },
  { path: "ADC1.DR", name: "ADC1_DR", fields: "DATA[11:0]", fieldSub: "ADC Data (read-only)", reset: 0, ro: true, bits: 16, names: {}, desc: "Result of the last regular conversion (12-bit, right aligned). Reading it clears EOC." },
];

type P = { pot: number };
type Fmt = "hex" | "dec";

export default function L06({ meta }: { meta: LabMeta }) {
  const lab = useLab<P>({ slug: meta.slug, code: GPIO, params: { pot: 2.1 }, world: (m, _dt, p) => m.setAnalog(4, p.pot) });
  const { mcu, params } = lab;
  const [sel, setSel] = useState("GPIOA.ODR");
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [tab, setTab] = useState<"gpio" | "timer" | "adc">("gpio");
  const [fmt, setFmt] = useState<Fmt>("hex");
  const [page, setPage] = useState(0);
  const [menu, setMenu] = useState(false);
  const [msg, setMsg] = useState("");
  const [snapshot, setSnapshot] = useState<Record<string, number> | null>(null);
  const [wrote, setWrote] = useState<Set<string>>(() => new Set());
  const prev = useRef<Record<string, { v: number; t: number }>>({});

  const live = (r: RegDef) => mcu.peek(r.path);
  const value = (r: RegDef) => (snapshot ? snapshot[r.path] ?? live(r) : live(r));
  const now = performance.now();
  for (const r of REGS) {
    const v = live(r), p = prev.current[r.path];
    if (!p || p.v !== v) prev.current[r.path] = { v, t: p ? now : 0 };
  }
  const changed = (r: RegDef) => now - (prev.current[r.path]?.t ?? 0) < 700;
  const reg = REGS.find((r) => r.path === sel) ?? REGS[0]!;
  const cur = value(reg);
  const show = (v: number, bits: number) => (fmt === "hex" ? `0x${(v >>> 0).toString(16).toUpperCase().padStart(bits > 16 ? 8 : bits > 8 ? 4 : 2, "0")}` : String(v >>> 0));
  useEffect(() => { setPage(0); }, [sel]);
  useEffect(() => { if (!msg) return; const id = window.setTimeout(() => setMsg(""), 3500); return () => window.clearTimeout(id); }, [msg]);

  const parse = (s: string) => { const t = s.trim().toLowerCase(); const v = t.startsWith("0b") ? parseInt(t.slice(2), 2) : t.startsWith("0x") ? parseInt(t.slice(2), 16) : Number(t); return Number.isFinite(v) ? v >>> 0 : NaN; };
  const writeReg = (r: RegDef, v: number) => {
    if (r.ro) { setMsg(`${r.name} is read-only — the write is ignored by hardware.`); return; }
    mcu.write(r.path, v);
    lab.advance(0);
    setSnapshot(null);
    setWrote((s) => new Set(s).add(r.path));
    setMsg(`Register update applied! ${r.name} = ${hex(mcu.peek(r.path), r.bits > 16 ? 8 : 4)}${r.path === "GPIOA.ODR" ? ` — ${[0, 1, 2, 3].filter((i) => mcu.level(`PA${i}`)).map((i) => `PA${i}`).join(", ") || "no LEDs"} HIGH` : ""}.`);
  };
  const commit = (r: RegDef) => { const s = draft[r.path]; if (s === undefined) return; const v = parse(s); if (Number.isNaN(v)) { setMsg(`"${s}" is not a number (use 0x.., 0b.. or decimal).`); return; } writeReg(r, v); setDraft((d) => { const n = { ...d }; delete n[r.path]; return n; }); setEditing(null); };
  const writeAll = () => { const pending = REGS.filter((r) => draft[r.path] !== undefined); if (!pending.length) { setMsg("Nothing to write — edit a value first (pencil icon)."); return; } pending.forEach(commit); };
  const toggleBit = (bit: number) => writeReg(reg, (cur ^ (1 << bit)) >>> 0);
  const modeOf = (pin: number) => ["Input", "GPIO Output", "Alternate Function", "Analog"][(mcu.peek("GPIOA.MODER") >> (pin * 2)) & 3]!;
  const tim = { psc: mcu.peek("TIM2.PSC"), arr: mcu.peek("TIM2.ARR"), cnt: mcu.peek("TIM2.CNT"), cen: mcu.peek("TIM2.CR1") & 1 };
  const adc = { on: mcu.peek("ADC1.CR2") & 1, dr: mcu.peek("ADC1.DR"), ch: mcu.peek("ADC1.SQR3") & 0x1f };
  const leds = [0, 1, 2, 3].map((i) => (mcu.pins.has(`PA${i}`) ? mcu.level(`PA${i}`) : 0));
  const bitsShown = Math.min(8, reg.bits);
  const pages = Math.ceil(reg.bits / 8);
  const base = page * 8;

  return (
    <LabShell meta={meta} lab={lab} subtitle="Inspect register values, bit fields, and peripheral control."
      components={["NUCLEO-F401RE (STM32F401RE)", "4 × LED + 330 Ω on PA0–PA3", "10 kΩ potentiometer on PA4 (ADC1_IN4)"]}>
      <div className="mcl-l06-wrap">
        <div className="mcl-col mcl-l06-left">
          <Panel title="Live Register Inspector" icon="table" className="mcl-sim mcl-l06-insp" tools={<>
            <span className={`mcl-chip ${snapshot ? "" : "mcl-chip-live"}`}>{snapshot ? "Snapshot" : "Real-time"}</span>
            <button type="button" className="mcl-small-btn" onClick={() => { setSnapshot(snapshot ? null : Object.fromEntries(REGS.map((r) => [r.path, mcu.read(r.path)]))); }} title="Read every register over the bus (Read All) or return to live view">{snapshot ? "Live View" : "Read All"}</button>
            <button type="button" className="mcl-small-btn" onClick={writeAll}>Write All{Object.keys(draft).length ? ` (${Object.keys(draft).length})` : ""}</button>
            <button type="button" className="mcl-icon-btn" onClick={() => setFmt(fmt === "hex" ? "dec" : "hex")} title="Toggle hex / decimal" aria-label="Toggle number format"><Icon name="sliders" /></button>
            <div className="mcl-menu-wrap">
              <button type="button" className="mcl-icon-btn" aria-label="More" onClick={() => setMenu((v) => !v)}><Icon name="more" /></button>
              {menu ? <div className="mcl-menu" role="menu" onMouseLeave={() => setMenu(false)}>
                <button type="button" role="menuitem" onClick={() => { setDraft({}); setEditing(null); setMenu(false); }}>Discard pending edits</button>
                <button type="button" role="menuitem" onClick={() => { void navigator.clipboard?.writeText(REGS.map((r) => `${r.name} = ${hex(live(r))}`).join("\n")); lab.setNotice("Register dump copied."); setMenu(false); }}>Copy register dump</button>
              </div> : null}
            </div>
          </>}>
            <table className="mcl-table mcl-l06-table">
              <thead><tr><th>Register Name</th><th>Address</th><th>Value ({fmt === "hex" ? "Hex" : "Dec"})</th><th>Binary ({reg.bits > 16 ? "31:0" : "15:0"} relevant)</th><th>Key Fields</th><th>Actions</th></tr></thead>
              <tbody>
                {REGS.map((r) => {
                  const v = value(r);
                  const bits = Math.min(16, r.bits);
                  const hi = r.bits > 16 ? 16 : 0;
                  const word = ((v >>> hi) & 0xffff).toString(2).padStart(16, "0").slice(-bits);
                  return (
                    <tr key={r.path} className={`${sel === r.path ? "sel" : ""} ${changed(r) ? "chg" : ""}`} onClick={() => setSel(r.path)}>
                      <td><b>{r.name}</b></td>
                      <td className="mcl-mono">{hex(mcu.addrOf(r.path) ?? 0, 8).replace(/^0x(\w{4})(\w{4})$/, "0x$1_$2")}</td>
                      <td className="mcl-mono">
                        {editing === r.path ? <input className="mcl-input mcl-l06-edit" autoFocus value={draft[r.path] ?? hex(v)} onChange={(e) => setDraft((d) => ({ ...d, [r.path]: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") commit(r); if (e.key === "Escape") setEditing(null); }} onClick={(e) => e.stopPropagation()} aria-label={`New value for ${r.name}`} />
                          : <b className={draft[r.path] !== undefined ? "pending" : ""}>{draft[r.path] ?? show(v, r.bits)}</b>}
                      </td>
                      <td className="mcl-mono mcl-l06-bin">{word.match(/.{1,4}/g)!.map((nib, i) => <span key={i} className={nib.includes("1") ? "on" : ""}>{nib}</span>)}{hi ? <small> (bits 31:16)</small> : null}</td>
                      <td><span>{r.fields}</span><small>{r.fieldSub}</small></td>
                      <td className="mcl-l06-act">
                        <button type="button" className="mcl-icon-btn" aria-label={`Edit ${r.name}`} disabled={r.ro} onClick={(e) => { e.stopPropagation(); setSel(r.path); setEditing(r.path); }}><Icon name="code" size={14} /></button>
                        <button type="button" className="mcl-icon-btn" aria-label={`Details of ${r.name}`} onClick={(e) => { e.stopPropagation(); setSel(r.path); document.querySelector(".mcl-l06-det")?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }}><Icon name="book" size={14} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Panel>
          <div className="mcl-l06-lower">
            <Panel title="Peripheral Effect (Live Simulation)" icon="bulb" className="mcl-l06-eff">
              <Seg value={tab} onChange={setTab} options={[{ value: "gpio", label: "GPIO Output" }, { value: "timer", label: "Timer Output" }, { value: "adc", label: "ADC Input" }]} />
              {tab === "gpio" ? (
                <svg viewBox="0 0 360 214" className="mcl-svg mcl-l06-bench" role="img" aria-label="Nucleo board with four LEDs on PA0 to PA3">
                  <HwDefs id="l06" />
                  <rect x="0" y="0" width="360" height="214" rx="8" fill="#e9ddc8" />
                  <Breadboard x={120} y={20} w={232} h={180} cols={20} rows={10} />
                  <NucleoBoard x={6} y={14} scale={0.55} ld2={mcu.pins.has("PA5") ? mcu.level("PA5") : 0} id="l06" chipLabel="STM32F401" onReset={lab.resetSim} />
                  {leds.map((on, i) => (
                    <g key={i}>
                      <Wire d={`M${104} ${78 + i * 9} C ${150} ${78 + i * 9}, ${170 + i * 44} ${150}, ${170 + i * 44} ${118}`} color={["#ef4444", "#f59e0b", "#22c55e", "#3b82f6"][i]!} live={!!on} />
                      <rect x={164 + i * 44} y={100} width={12} height={22} rx={1} fill="#ddd" stroke="#bbb" />
                      <SvgLed x={170 + i * 44} y={78} r={9} on={!!on} color="green" id="l06" />
                      <text x={170 + i * 44} y={60} textAnchor="middle" fontSize="11" fontWeight="800" fill="#1f2937">PA{i}</text>
                    </g>
                  ))}
                </svg>
              ) : tab === "timer" ? (
                <div className="mcl-l06-tim">
                  <dl className="mcl-kv"><div><dt>CR1.CEN</dt><dd>{tim.cen ? "1 — counting" : "0 — stopped"}</dd></div><div><dt>PSC / ARR</dt><dd>{tim.psc} / {tim.arr}</dd></div><div><dt>Tick rate</dt><dd>{(mcu.clock / (tim.psc + 1)).toLocaleString()} Hz</dd></div><div><dt>Update rate</dt><dd>{tim.arr ? (mcu.clock / (tim.psc + 1) / (tim.arr + 1)).toFixed(3) : "—"} Hz</dd></div></dl>
                  <div className="mcl-l06-cnt"><span>TIM2_CNT</span><div><i style={{ width: `${tim.arr ? (tim.cnt / (tim.arr + 1)) * 100 : 0}%` }} /></div><b className="mcl-mono">{tim.cnt}</b></div>
                  {!tim.cen ? <p className="mcl-warn-text">Counter stopped. Select TIM2_CR1 and switch bit 0 (CEN) on in the Bit Field View, or load the Timer + ADC example.</p> : <p className="mcl-muted">Updates so far: {mcu.timers.get("TIM2")?.updates ?? 0}</p>}
                </div>
              ) : (
                <div className="mcl-l06-adc">
                  <label className="mcl-slider"><span>Potentiometer on PA4 <b>{params.pot.toFixed(2)} V</b></span><input type="range" min={0} max={3.3} step={0.01} value={params.pot} onChange={(e) => lab.setParam("pot", Number(e.target.value))} /></label>
                  <dl className="mcl-kv"><div><dt>CR2.ADON</dt><dd>{adc.on ? "1 — powered" : "0 — off"}</dd></div><div><dt>Channel (SQR3)</dt><dd>{adc.ch}</dd></div><div><dt>DR</dt><dd className="mcl-mono">{adc.dr} ({((adc.dr / 4095) * 3.3).toFixed(2)} V)</dd></div></dl>
                  <button type="button" className="mcl-small-btn primary" onClick={() => { if (!adc.on) { setMsg("ADC1 is off — set CR2.ADON (bit 0) first."); return; } mcu.write("ADC1.SQR3", adc.ch || 4); mcu.write("ADC1.CR2", mcu.peek("ADC1.CR2") | (1 << 30)); lab.advance(0); setMsg(`Conversion done: ADC1_DR = ${mcu.peek("ADC1.DR")}`); }}>Write SWSTART (start conversion)</button>
                </div>
              )}
              <div className={`mcl-l06-msg ${msg ? "on" : ""}`}><Icon name={msg ? "check" : "bulb"} size={14} />{msg || (leds.some(Boolean) ? `${leds.map((l, i) => (l ? `PA${i}` : "")).filter(Boolean).join(" and ")} ${leds.filter(Boolean).length > 1 ? "are" : "is"} HIGH (LEDs ON).` : "All LEDs off — write GPIOA_ODR to change that.")}</div>
            </Panel>
            <CodeEditor lab={lab} className="mcl-l06-code" languages={[{ label: "C (STM32)", code: GPIO }, { label: "C (Timer + ADC)", code: PERIPH }]} />
          </div>
        </div>

        <div className="mcl-col mcl-l06-right">
          <Panel title="Selected Register Details" icon="cpu" className="mcl-l06-det" tools={<b className="mcl-l06-at">{reg.name} @ {hex(mcu.addrOf(reg.path) ?? 0, 8).replace(/^0x(\w{4})(\w{4})$/, "0x$1_$2")}</b>}>
            <dl className="mcl-l06-dl">
              <div><dt>Register Name</dt><dd><b>{reg.name}</b> <small className="mcl-mono">({reg.path.replace(".", "->")})</small></dd></div>
              <div><dt>Address</dt><dd className="mcl-mono">{hex(mcu.addrOf(reg.path) ?? 0, 8)}</dd></div>
              <div><dt>Current Value</dt><dd className="mcl-l06-write">
                <input className="mcl-input mcl-mono" value={draft[reg.path] ?? show(cur, reg.bits)} onChange={(e) => setDraft((d) => ({ ...d, [reg.path]: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") commit(reg); }} disabled={reg.ro} aria-label="Value to write" />
                <button type="button" className="mcl-btn mcl-btn-run" onClick={() => commit(reg)} disabled={reg.ro || draft[reg.path] === undefined}>Write</button>
              </dd></div>
              <div><dt>Description</dt><dd>{reg.desc}</dd></div>
              <div className="split"><dt>Reset Value</dt><dd className="mcl-mono">{hex(reg.reset, reg.bits > 16 ? 8 : 4)}</dd><dt>Access Type</dt><dd>{reg.ro ? "Read only" : "Read / Write"}</dd></div>
            </dl>
          </Panel>

          <Panel title={`Bit Field View (${reg.name})`} icon="grid" className="mcl-l06-bits" tools={<><span className="mcl-l06-key"><i className="hi" />1 (High)</span><span className="mcl-l06-key"><i />0 (Low)</span></>}>
            {pages > 1 ? <Seg size="sm" value={page} onChange={setPage} options={Array.from({ length: pages }, (_, i) => ({ value: i, label: `${i * 8 + 7}:${i * 8}` }))} /> : null}
            <table className="mcl-table mcl-l06-bittable">
              <tbody>
                <tr><th>Bit</th>{Array.from({ length: bitsShown }, (_, k) => base + bitsShown - 1 - k).map((b) => <td key={b}>{b}</td>)}</tr>
                <tr><th>Value</th>{Array.from({ length: bitsShown }, (_, k) => base + bitsShown - 1 - k).map((b) => (
                  <td key={b}><button type="button" role="switch" aria-checked={!!((cur >>> b) & 1)} aria-label={`Bit ${b}`} disabled={reg.ro} className={`mcl-l06-sw ${(cur >>> b) & 1 ? "on" : ""}`} onClick={() => toggleBit(b)}><i /></button></td>
                ))}</tr>
                <tr><th>Field Name</th>{Array.from({ length: bitsShown }, (_, k) => base + bitsShown - 1 - k).map((b) => <td key={b} className="mcl-l06-fname">{reg.names[b] ?? "—"}</td>)}</tr>
              </tbody>
            </table>
            <small className="mcl-muted">{reg.ro ? "Read-only register — bits follow the hardware." : "Click a switch to write the register with that bit flipped (read-modify-write)."}</small>
          </Panel>

          <Panel title="Hardware & GPIO Mapping" icon="link" className="mcl-l06-map" tools={<select className="mcl-input mcl-l06-boardsel" aria-label="Board" value="nucleo-f4" onChange={() => undefined}><option value="nucleo-f4">STM32 Nucleo (F4)</option></select>}>
            <table className="mcl-table">
              <thead><tr><th>Pin</th><th>MCU Pin</th><th>Function</th><th>Connected To</th></tr></thead>
              <tbody>{[0, 1, 2, 3].map((i) => <tr key={i}><td>PA{i}</td><td>PA{i}</td><td>{modeOf(i)}</td><td><span className={`mcl-l06-dot ${leds[i] ? "on" : ""}`} />LED {i + 1} ({leds[i] ? "On" : "Off"})</td></tr>)}
                <tr><td>PA4</td><td>PA4</td><td>{modeOf(4)}</td><td>Potentiometer ({params.pot.toFixed(2)} V)</td></tr></tbody>
            </table>
          </Panel>

          <LearningNotes notes={{
            takeaways: ["Registers control the behavior of on-chip peripherals.", "Each register contains bit fields with specific functions.", "Changes to registers immediately affect hardware behavior.", "Use header files and bit masks for readable and portable code.", "Common SFRs: GPIO, Timer (CR1/CNT), ADC, UART, RCC."],
            observe: "The inspector reads the live peripheral registers every frame; changed values flash.",
            tryIt: "Select GPIOA_ODR and switch bit 1 on — LED 2 lights immediately.",
            measure: "Set MODER for PA1 back to 00 (input): ODR bit 1 no longer reaches the pin. Compare ODR with IDR.",
            modify: "Change the code to set PA1 and PA3 instead, then Run.",
            runAgain: "Load the Timer + ADC example, turn the potentiometer and watch ADC1_DR and the LED bar.",
            challenge: "Start TIM2 purely from the inspector: write PSC, ARR and set CR1.CEN — then watch CNT count.",
            checks: [{ label: "Wrote a register from the inspector", done: wrote.size > 0 }, { label: "Started TIM2 from the inspector", done: wrote.has("TIM2.CR1") && tim.cen === 1 }, { label: "Lit LED 2 (PA1)", done: leds[1] === 1 }],
            question: "Pro Tip: Use bit masks and named bit fields (from device header files) instead of magic numbers for better code readability and maintainability.",
          }} />
        </div>
      </div>
    </LabShell>
  );
}
