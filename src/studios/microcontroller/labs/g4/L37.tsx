import { useEffect, useRef, useState } from "react";
import { useLab } from "../core/useLab";
import { hx, type Ins } from "../g1/thumb";
import type { LabMeta } from "../registry";
import { CodeEditor } from "../ui/CodeEditor";
import { Icon } from "../ui/Icon";
import { LearningNotes, Panel, Toggle } from "../ui/Panels";
import { LabShell } from "../ui/Shell";
import {
  blinkHz, CLOCK, CLOCK_LINE, codeField, cpuTime, DEMO, lineOf, mcu37, MODER_GOOD, MODES, P37_DEFAULT, program37, setCodeField, setup37, sim37, snapshot,
  STACK_TOP, step37, UART_BAUD, VARIANTS, world37, type FieldKey, type P37, type StepKind, type TraceKind,
} from "./L37sim";

const RECENT = 8;
const BLINKS = [10, 50, 100, 250, 500, 1000];
const FILTERS: Array<{ v: string; label: string; kinds: TraceKind[] }> = [
  { v: "all", label: "Everything", kinds: ["line", "store", "var", "lib", "out", "bp", "fault", "info"] },
  { v: "io", label: "Registers & variables", kinds: ["store", "var", "fault"] },
  { v: "line", label: "Lines & breakpoints", kinds: ["line", "bp", "fault"] },
  { v: "lib", label: "Calls & output", kinds: ["lib", "out", "fault", "info"] },
];
const fmtTime = (s: number) => (s >= 1 ? `${s.toFixed(3)} s` : `${(s * 1e3).toFixed(s < 0.01 ? 2 : 1)} ms`);
const fmtCycles = (n: number) => Math.round(n).toLocaleString("en-US");

const NO_SEEN = { run: false, bp: false, step: false, ins: false, edit: false, fix: false, printf: false, mem: false };
type Seen = typeof NO_SEEN;

export default function L37({ meta }: { meta: LabMeta }) {
  const lab = useLab<P37>({
    slug: meta.slug, code: DEMO, params: P37_DEFAULT, mcu: mcu37,
    setup: (m, _p, src) => setup37(m, src),
    validate: (src) => program37(src).diagnostics,
    world: world37,
  });
  const { mcu, params: p } = lab;
  const fw = mcu.fw;
  const s = sim37(mcu);
  if (s) s.bps = lab.breakpoints;
  const cpu = s?.cpu;
  const [pending, setPending] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [seen, setSeen] = useState<Seen>(NO_SEEN);
  const [failSeen, setFailSeen] = useState(false);
  const [memEdit, setMemEdit] = useState<{ addr: number; text: string } | null>(null);
  const traceRef = useRef<HTMLOListElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  useEffect(() => { if (pending !== null && lab.code === pending) { setPending(null); lab.run(); } }, [pending, lab]);
  useEffect(() => { if (!msg) return; const id = window.setTimeout(() => setMsg(""), 4000); return () => window.clearTimeout(id); }, [msg]);

  const loadCode = (next: string) => { if (next === lab.code) { lab.run(); return; } lab.setCode(next); setPending(next); };
  const cf = (k: FieldKey) => codeField(lab.code, k);
  const edit = (k: FieldKey, v: string) => {
    if (cf(k) === null) { setMsg("This setting was not found in the code: edit the #define lines directly."); return; }
    const next = setCodeField(lab.code, k, v);
    if (next !== lab.code) loadCode(next);
  };
  const blinkMs = Number(cf("blink") ?? NaN);
  const blinkOpts = Number.isFinite(blinkMs) && !BLINKS.includes(blinkMs) ? [...BLINKS, blinkMs].sort((a, b) => a - b) : BLINKS;

  /* ---------------- execution control ---------------- */
  const halted = lab.status === "halted";
  const active = lab.running && !halted && !!fw && !fw.error;
  const stopped = !cpu || cpu.stopped;
  const doStep = (kind: StepKind) => {
    if (!cpu || stopped) return;
    step37(mcu, kind, p);
    setSeen((o) => (kind === "ins" ? { ...o, ins: true } : { ...o, step: true }));
  };
  const runCtl = () => { if (lab.dirty || !fw || stopped) loadCode(lab.code); else if (!active) lab.toggle(); };
  const pauseCtl = () => { if (active) lab.toggle(); };
  const animate = p.mode !== "rt";
  const showLine = !active || animate;
  const line = s ? lineOf(s) : -1;
  const curIns = cpu?.current;

  /* ---------------- derived state ---------------- */
  const prog = cpu?.prog;
  const globals = prog?.globals ?? [];
  const pa5 = mcu.pin("PA5");
  const ledOn = pa5.mode === "out" && pa5.level === 1;
  const odr = mcu.peek("GPIOA.ODR"), moder = mcu.peek("GPIOA.MODER"), ahb1 = mcu.peek("RCC.AHB1ENR");
  const hz = s ? blinkHz(s) : 0;
  const tCpu = s ? cpuTime(s) : 0;
  const changed = (r: number) => !!s && !active && s.prev.r[r] !== cpu?.r[r];
  const gChanged = (addr: number) => !!s && !active && s.prev.values.has(addr) && s.prev.values.get(addr) !== cpu?.read(addr);
  const pinCode = cf("pin");
  const lastFaultT = s ? s.trace.reduce((t, x) => (x.kind === "fault" ? x.t : t), -99) : -99;
  const recentFault = !!s?.faults.length && tCpu - lastFaultT < RECENT;
  const clockFault = !!s && s.faults.some((f) => f.includes("clock disabled"));
  const moderWrong = !!s && !clockFault && s.odrWrites > 0 && pa5.mode !== "out" && pinCode === "5";
  const wrongPin = !!s && !clockFault && s.odrWrites > 0 && s.ledEdges.length === 0 && pinCode !== null && pinCode !== "5";
  const pf = s?.lastPrintf;

  const hints: Array<{ text: string; tone?: "info"; fix?: Array<[string, () => void]> }> = [];
  if (!fw) hints.push({ text: "Press Run: the C program is compiled to Thumb-2 instructions, flashed at 0x08000000 and executed on a Cortex-M4 model wired to the STM32F401 register map.", tone: "info" });
  if (cpu?.fault) hints.push({ text: `HardFault: ${cpu.fault}. The core stopped at ${hx(cpu.r[15]!, 8)}.`, fix: [["Reset simulation", lab.resetSim]] });
  if (clockFault) hints.push({ text: "The LED never lights: GPIOA's clock is off, so every write to GPIOA->MODER and GPIOA->ODR is ignored (see the faults in Execution Trace). A peripheral only accepts register writes after its enable bit in RCC->AHB1ENR is set.", fix: [["Enable the GPIOA clock", () => loadCode(lab.code.includes("int main(void) {\n") && !lab.code.includes("RCC->AHB1ENR") ? lab.code.replace("int main(void) {\n", `int main(void) {\n${CLOCK_LINE}`) : DEMO)]] });
  if (moderWrong) hints.push({ text: `GPIOA->ODR bit 5 toggles (${s!.odrWrites} writes) but PA5 is still an ${pa5.mode === "in" ? "input" : pa5.mode === "af" ? "alternate-function pin" : "analog pin"}: MODER has two bits per pin, so PA5's field is bits 11:10 and needs (1 << (5 * 2)). (1 << 5) set a bit in PA2's field instead.`, fix: [["Use (1 << (LED_PIN * 2))", () => loadCode(lab.code.includes("GPIOA->MODER |= (1 << LED_PIN);") ? lab.code.replace(/GPIOA->MODER \|= \(1 << LED_PIN\); {4}/, MODER_GOOD).replace("GPIOA->MODER |= (1 << LED_PIN);", MODER_GOOD) : DEMO)]] });
  if (wrongPin) hints.push({ text: `The program toggles PA${pinCode}, but the user LED LD2 on the Nucleo board is wired to PA5. The firmware is right for a different board; the pin number has to match the schematic.`, fix: [["LED_PIN = 5", () => edit("pin", "5")]] });
  if (cpu?.halted && !cpu.fault) hints.push({ text: `main() returned (${cpu.halted}). Bare-metal firmware has nowhere to return to, which is why it ends in while (1).`, tone: "info" });
  if (pf && fw) hints.push({ text: `printf sent ${pf.chars} characters over USART2 and blocked for ${fmtTime(pf.cycles / CLOCK)} (${fmtCycles(pf.cycles)} cycles): 10 bits per character at ${UART_BAUD.toLocaleString("en-US")} baud. That is longer than ${fmtCycles(pf.cycles / 2)} plain C statements.`, tone: "info" });
  const problems = hints.filter((x) => x.tone !== "info");
  useEffect(() => { if (problems.length) setFailSeen(true); }, [problems.length]);

  const custom = !VARIANTS.some((x) => x.code === lab.compiledCode);
  const flags: Seen = {
    run: !!cpu && cpu.executed > 20,
    bp: !!s && s.bpHits > 0,
    step: seen.step,
    ins: seen.ins,
    edit: custom && !!cpu && cpu.executed > 20,
    fix: failSeen && !problems.length && !!fw && !!s && s.odrWrites > 1 && s.ledEdges.length > 0,
    printf: !!s?.lib.printf?.calls,
    mem: seen.mem,
  };
  useEffect(() => {
    const ks = Object.keys(flags) as Array<keyof Seen>;
    if (ks.some((k) => flags[k] && !seen[k])) setSeen((o) => { const n = { ...o }; for (const k of ks) n[k] = o[k] || flags[k]; return n; });
  });

  const kinds = (FILTERS.find((f) => f.v === p.filter) ?? FILTERS[0]!).kinds;
  const trace = (s?.trace ?? []).filter((x) => kinds.includes(x.kind)).slice(-60);
  const traceKey = `${trace.length}:${trace[trace.length - 1]?.id ?? 0}`;
  useEffect(() => { const el = traceRef.current; if (el) el.scrollTop = el.scrollHeight; }, [traceKey]);
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(".cur");
    const box = listRef.current;
    if (!el || !box) return;
    const top = el.offsetTop - box.offsetTop;
    if (top < box.scrollTop + 8 || top > box.scrollTop + box.clientHeight - 40) box.scrollTop = Math.max(0, top - box.clientHeight / 3);
  }, [line, showLine, p.view]);

  const commitMem = () => {
    if (!memEdit || !cpu || !s) return;
    const t = memEdit.text.trim();
    const v = /^0x[0-9a-f]+$/i.test(t) ? parseInt(t, 16) : /^-?\d+$/.test(t) ? Number(t) : NaN;
    setMemEdit(null);
    if (!Number.isFinite(v)) { setMsg(`"${t}" is not a number: type a decimal value or 0x followed by hex digits.`); return; }
    const g = globals.find((x) => x.addr === memEdit.addr);
    snapshot(s);
    cpu.mem.set(memEdit.addr, v >>> 0);
    s.trace.push({ id: s.nextId++, t: tCpu, kind: "var", text: `You wrote ${g?.name ?? hx(memEdit.addr, 8)} = ${v >>> 0} in SRAM` });
    setSeen((o) => ({ ...o, mem: true }));
  };

  const shellLab = {
    ...lab,
    step: (k: "into" | "over" | "out") => doStep(k),
    resetLab: () => { lab.resetLab(); setPending(null); setSeen(NO_SEEN); setFailSeen(false); setMemEdit(null); },
  };

  /* ---------------- listing ---------------- */
  const srcLines = lab.compiledCode.split("\n");
  const insByLine = new Map<number, Ins[]>();
  for (const i of prog?.ins ?? []) { const a = insByLine.get(i.line); if (a) a.push(i); else insByLine.set(i.line, [i]); }
  const listing = srcLines.map((text, i) => ({ n: i + 1, text })).filter((l) => l.text.trim() && !/^\s*(\/\*.*\*\/|\/\/.*|#include.*)\s*$/.test(l.text));

  const bpList = [...lab.breakpoints].sort((a, b) => a - b);
  const modeLabel = MODES.find((x) => x.v === p.mode)?.label ?? MODES[0]!.label;
  const statusLine = [
    halted ? `${fw?.pauseReason === "breakpoint" ? "Breakpoint" : "Halted"} at line ${line}` : bpList.length ? `Breakpoint${bpList.length > 1 ? "s" : ""} at line ${bpList.join(", ")}` : "No breakpoints",
    `Speed: ${lab.speed}×`,
    p.trace ? "Trace variables enabled" : "Variable trace off",
  ].join(" · ");

  const notesData = {
    takeaways: [
      "The compiler turns each C statement into a few Thumb-2 instructions in flash; the Program Counter walks through them one by one.",
      "Globals live in SRAM from 0x20000000; the startup code copies their initial values there before main() runs.",
      "A peripheral register is just an address: GPIOA->ODR is a load and store to 0x40020014, which the GPIO hardware turns into a pin level.",
      "Nothing happens on a peripheral until its clock is enabled in RCC, and every pin field must be configured before it drives anything.",
      "Library calls cost time: delay_ms burns cycles on purpose, and printf blocks until the UART has sent every character.",
    ],
    observe: "Press Run and watch counter count up and PA5 toggle every 100 ms. Then click the gutter next to the GPIOA->ODR line to set a breakpoint.",
    tryIt: "At the breakpoint, press Step and watch GPIOA_ODR flip and LED output change. Use 1 instruction to see the LDR / EORS / STR that line compiles to.",
    measure: `Now: ${cpu ? `PC ${hx(cpu.r[15]!, 8)}, ${fmtCycles(cpu.cycles)} cycles (${fmtTime(cpu.cycles / CLOCK)} of CPU time), counter = ${globals[0] ? cpu.read(globals[0].addr) : "–"}, LED ${hz ? `${hz.toFixed(1)} Hz` : ledOn ? "on" : "off"}` : "press Run"}.`,
    modify: "Change BLINK_MS, edit counter in the Memory panel while halted, or load the printf example and compare how long one loop takes.",
    runAgain: "Load each bug example, read the hint and fix it, then check that PA5 blinks at 1000 / (2 × BLINK_MS) Hz.",
    challenge: "Make the LED blink at exactly 2 Hz with the printf example still printing every toggle. How much of each period does printf use?",
    question: "Why does GPIOA->ODR ^= (1 << 5) take three instructions, and what could go wrong if an interrupt changed ODR between them?",
  };
  const checks = [
    { label: "Run the program", done: seen.run },
    { label: "Stop at a breakpoint", done: seen.bp },
    { label: "Step a C line", done: seen.step },
    { label: "Step one instruction", done: seen.ins },
    { label: "Edit memory while halted", done: seen.mem },
    { label: "Change the code and run again", done: seen.edit },
    { label: "Measure what printf costs", done: seen.printf },
    { label: "Find and fix a bug", done: seen.fix },
  ];

  const stateRows: Array<{ k: string; v: string; hot?: boolean; title?: string }> = cpu ? [
    { k: "PC", v: hx(cpu.r[15]!, 8), hot: changed(15), title: curIns ? `${curIns.text} (line ${curIns.line}, ${curIns.fn})` : undefined },
    { k: "R0", v: hx(cpu.r[0]!, 8), hot: changed(0) },
    { k: "R1", v: hx(cpu.r[1]!, 8), hot: changed(1) },
    { k: "SP", v: hx(cpu.r[13]!, 8), hot: changed(13), title: `${STACK_TOP - cpu.r[13]!} bytes of stack in use` },
    { k: "LR", v: hx(cpu.r[14]!, 8), hot: changed(14) },
    ...globals.map((g) => ({ k: g.name, v: String(cpu.read(g.addr)), hot: gChanged(g.addr), title: `${hx(g.addr, 8)} in SRAM` })),
    { k: "PA5", v: pa5.mode !== "out" ? `${pa5.mode === "in" ? "INPUT" : pa5.mode.toUpperCase()}` : pa5.level ? "HIGH" : "LOW", hot: ledOn },
  ] : [];

  return (
    <LabShell meta={meta} lab={shellLab} subtitle="Edit C code and watch registers, memory, GPIO and peripherals change live."
      components={["STM32 Nucleo-F401RE, Cortex-M4 at 16 MHz (HSI)", "User LED LD2 on PA5 (active high)", "USART2 to the ST-LINK virtual COM port, 115200 baud", "Thumb-2 compiler model: C subset, globals in SRAM, MMIO through the STM32F401 register map"]}>
      <div className="mcl-grid mcl-l37-grid">
        <Panel title="Embedded C Live Execution" icon="cpu" className="mcl-l37-exec"
          tools={<label className="mcl-l31-inline"><span className="mcl-l31-lbl">View:</span><select value={p.view} aria-label="Listing view" onChange={(e) => lab.setParam("view", e.target.value)}><option value="c">C source</option><option value="mixed">C + Thumb-2</option></select></label>}>
          <div className="mcl-l37-live">
            <div className="mcl-l37-src">
              <div className="mcl-l37-srchead"><b>main.c</b><span>{prog ? `${prog.ins.length} instructions · ${hx(prog.ins[0]?.addr ?? 0, 8)}` : ""}</span></div>
              <ol ref={listRef} aria-label="Compiled program. Click a line number to toggle a breakpoint">
                {listing.map((l) => {
                  const cur = showLine && l.n === line;
                  const bp = lab.breakpoints.has(l.n);
                  const ins = p.view === "mixed" ? insByLine.get(l.n) ?? [] : [];
                  return (
                    <li key={l.n} className={`${cur ? "cur" : ""} ${bp ? "bp" : ""} ${insByLine.has(l.n) ? "code" : ""}`}>
                      <button type="button" className="mcl-l37-ln" aria-label={`${bp ? "Remove" : "Set"} breakpoint at line ${l.n}`} aria-pressed={bp} onClick={() => lab.toggleBreakpoint(l.n)}>{l.n}</button>
                      <code>{l.text.replace(/\s+\/\*.*\*\/\s*$/, "")}</code>
                      {ins.length ? (
                        <span className="mcl-l37-asm">
                          {ins.map((i) => <span key={i.addr} className={showLine && curIns?.addr === i.addr ? "pc" : ""}><em>{hx(i.addr, 8)}</em>{i.text}</span>)}
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            </div>
            <div className="mcl-l37-state">
              <b className="mcl-l37-h">Runtime State</b>
              <dl>
                {stateRows.map((r) => <div key={r.k} className={r.hot ? "hot" : ""} title={r.title}><dt>{r.k}</dt><dd>{r.v}</dd></div>)}
                {!cpu ? <p className="mcl-l31-sub">Press Run to start the core.</p> : null}
              </dl>
              <p className="mcl-l37-now">
                {curIns && showLine ? <><span>Next:</span><code>{curIns.text}</code></> : <><span>{cpu ? `${fmtCycles(cpu.cycles)} cycles` : ""}</span><code>{cpu ? fmtTime(tCpu) : ""}</code></>}
              </p>
            </div>
          </div>
        </Panel>

        <Panel title="Execution Controls" icon="sliders" className="mcl-l37-ctl">
          <div className="mcl-l37-btns">
            <button type="button" className="go" onClick={runCtl} disabled={active && !lab.dirty}><Icon name="play" size={13} />{lab.dirty ? "Build & run" : halted || !lab.running ? "Run" : "Running"}</button>
            <button type="button" onClick={() => doStep("over")} disabled={stopped} title="Step over (F10)">Step</button>
            <button type="button" onClick={pauseCtl} disabled={!active}><Icon name="pause" size={13} />Pause</button>
          </div>
          <div className="mcl-l37-btns sub">
            <button type="button" onClick={() => doStep("into")} disabled={stopped} title="Step into (F11)">Step into</button>
            <button type="button" onClick={() => doStep("out")} disabled={stopped || (cpu?.calls.length ?? 0) < 2}>Step out</button>
            <button type="button" onClick={() => doStep("ins")} disabled={stopped}>1 instruction</button>
          </div>
          <p className="mcl-l37-line">{statusLine}</p>
          <div className="mcl-l37-opts">
            <label><span>Execution</span><select value={p.mode} aria-label="Execution speed" onChange={(e) => lab.setParam("mode", e.target.value)}>{MODES.map((m) => <option key={m.v} value={m.v}>{m.label}</option>)}</select></label>
            <label><span>BLINK_MS</span><select value={Number.isFinite(blinkMs) ? blinkMs : ""} disabled={!Number.isFinite(blinkMs)} aria-label="BLINK_MS" onChange={(e) => edit("blink", e.target.value)}>{blinkOpts.map((v) => <option key={v} value={v}>{v} ms</option>)}</select></label>
            <Toggle label="Trace variables" checked={p.trace} onChange={(x) => lab.setParam("trace", x)} hint="Log every change of a global variable in Execution Trace" />
          </div>
          <div className="mcl-l37-bps">
            <span>Breakpoints:</span>
            {bpList.length ? bpList.map((n) => <button key={n} type="button" className="mcl-l37-chip" aria-label={`Remove breakpoint at line ${n}`} onClick={() => lab.toggleBreakpoint(n)}>line {n}<Icon name="x" size={11} /></button>) : <em>click a line number</em>}
            {bpList.length > 1 ? <button type="button" className="mcl-l31-btn" onClick={() => bpList.forEach((n) => lab.toggleBreakpoint(n))}>Clear</button> : null}
          </div>
          <div className={`mcl-l31-status ${!fw ? "off" : problems.length ? "warn" : "ok"}`}>
            <Icon name={fw && !problems.length ? "check" : "alert"} size={16} />
            <div>
              <b>{!fw ? "Core stopped" : problems.length ? `${problems.length} problem${problems.length === 1 ? "" : "s"}` : cpu?.halted ? "Program ended" : halted ? `Halted at line ${line}` : active ? (ledOn || hz ? "Running, LED blinking" : "Running") : "Paused"}</b>
              <span>{cpu ? `${modeLabel} · ${fmtCycles(cpu.executed)} instructions · ${hz ? `PA5 ${hz.toFixed(1)} Hz` : `PA5 ${ledOn ? "on" : "off"}`}` : "Press Run to flash the board."}</span>
            </div>
          </div>
          {msg ? <p className="mcl-l31-hint"><Icon name="alert" size={14} /><span>{msg}</span></p> : null}
          {hints.slice(0, 2).map((x) => (
            <p key={x.text} className={`mcl-l31-hint ${x.tone ?? ""}`}><Icon name={x.tone === "info" ? "bulb" : "alert"} size={14} /><span>{x.text}</span>{x.fix?.map(([l, fn]) => <button key={l} type="button" onClick={fn}>{l}</button>)}</p>
          ))}
          <ul className="mcl-checks mcl-l37-checks">{checks.map((c) => <li key={c.label} className={c.done ? "done" : ""}><Icon name={c.done ? "check" : "target"} size={14} />{c.label}</li>)}</ul>
        </Panel>

        <Panel title="Memory & GPIO" icon="memory" className="mcl-l37-mem">
          <table className="mcl-l37-memt">
            <thead><tr><th>Address</th><th>Name</th><th>Value</th></tr></thead>
            <tbody>
              {globals.map((g) => {
                const v = cpu!.read(g.addr);
                const editing = memEdit?.addr === g.addr;
                return (
                  <tr key={g.addr} className={gChanged(g.addr) ? "hot" : ""}>
                    <td>{hx(g.addr, 8)}</td><td>{g.name} <small>SRAM</small></td>
                    <td>{editing ? (
                      <input autoFocus value={memEdit.text} aria-label={`New value for ${g.name}`} onChange={(e) => setMemEdit({ addr: g.addr, text: e.target.value })} onBlur={commitMem} onKeyDown={(e) => { if (e.key === "Enter") commitMem(); else if (e.key === "Escape") setMemEdit(null); }} />
                    ) : (
                      <button type="button" className="mcl-l37-val" disabled={active} title={active ? "Pause or halt to edit memory" : "Click to edit"} onClick={() => setMemEdit({ addr: g.addr, text: String(v) })}>{hx(v, 8)} <small>= {v}</small><Icon name="edit" size={11} /></button>
                    )}</td>
                  </tr>
                );
              })}
              <tr><td>0x40023830</td><td>RCC_AHB1ENR</td><td><code>{hx(ahb1, 8)}</code> <small>{ahb1 & 1 ? "GPIOA clock on" : "GPIOA clock off"}</small></td></tr>
              <tr><td>0x40020000</td><td>GPIOA_MODER</td><td><code>{hx(moder, 8)}</code> <small>PA5 = {["input", "output", "alt fn", "analog"][(moder >> 10) & 3]}</small></td></tr>
              <tr className={ledOn ? "hot" : ""}><td>0x40020014</td><td>GPIOA_ODR</td><td><code>{hx(odr, 2)}</code> <small>bit 5 = {(odr >> 5) & 1}</small></td></tr>
            </tbody>
          </table>
          <div className="mcl-l37-led">
            <svg viewBox="0 0 40 40" width={34} height={34} aria-hidden="true">
              <circle cx={20} cy={20} r={15} fill={ledOn ? "#22c55e" : "#d8e2ee"} stroke={ledOn ? "#15803d" : "#9fb0c6"} strokeWidth={2} />
              {ledOn ? <circle cx={20} cy={20} r={19} fill="none" stroke="#22c55e" strokeOpacity={0.35} strokeWidth={3} /> : null}
            </svg>
            <div><b>LED output = {ledOn ? "ON" : "OFF"}</b><span>LD2 on PA5 · {hz ? `${hz.toFixed(1)} Hz blink` : "steady"}{recentFault ? " · write ignored" : ""}</span></div>
          </div>
          {s?.console ? <pre className="mcl-l37-console" aria-label="USART2 output">{s.console.split("\n").slice(-4).join("\n")}</pre> : null}
        </Panel>

        <CodeEditor lab={shellLab} className="mcl-l37-code" languages={VARIANTS} currentLine={showLine && fw ? line : -1} />

        <Panel title="Execution Trace" icon="list" className="mcl-l37-trace"
          tools={<>
            <select value={p.filter} aria-label="Trace filter" onChange={(e) => lab.setParam("filter", e.target.value)}>{FILTERS.map((f) => <option key={f.v} value={f.v}>{f.label}</option>)}</select>
            <button type="button" className="mcl-l31-btn" disabled={!s?.trace.length} onClick={() => { if (s) s.trace.length = 0; setMsg(""); }}>Clear</button>
          </>}>
          <ol className="mcl-l37-tr" ref={traceRef} aria-label="Execution trace" aria-live="off">
            {trace.map((x) => <li key={x.id} className={x.kind}><small>{fmtTime(x.t)}</small><span>{x.text}</span></li>)}
            {!trace.length ? <li className="empty">{fw ? (active && p.mode === "rt" ? "Nothing logged with this filter yet." : "Step or run to fill the trace.") : "Press Run to start the core."}</li> : null}
          </ol>
          <p className="mcl-l31-sub">{lab.dirty && !pending ? "The editor has unflashed changes: press Run to apply them. " : ""}{s ? `${s.trace.length} entries · ${s.odrWrites} ODR changes · ${s.faults.length} fault${s.faults.length === 1 ? "" : "s"}` : ""}{custom && fw ? " · running your own version" : ""}</p>
        </Panel>

        <div className="mcl-l37-notes"><LearningNotes notes={notesData} /></div>
      </div>
    </LabShell>
  );
}