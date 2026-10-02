import { useEffect, useRef, useState } from "react";
import { useLab } from "../core/useLab";
import { hx } from "../g1/thumb";
import type { LabMeta } from "../registry";
import { CodeEditor } from "../ui/CodeEditor";
import { Icon } from "../ui/Icon";
import { LearningNotes, Panel } from "../ui/Panels";
import { Scope, type Trace } from "../ui/Scope";
import { LabShell } from "../ui/Shell";
import { CLOCK, mcu37, program37, sim37 } from "./L37sim";
import {
  addrOf, codeField, DEMO, effects, fieldOf, P38_DEFAULT, pinRate, poke38, REGS, setCodeField, setup38, sim38, TIMCLK_LINE, UIF_LINE, VARIANTS, world38,
  type BusEntry, type FieldKey, type P38, type RegDef,
} from "./L38sim";

const RECENT = 8;
const PSCS = [1599, 7999, 15999, 31999];
const ARRS = [49, 99, 249, 499, 999];
const fmtHz = (hz: number) => (hz >= 1e6 ? `${(hz / 1e6).toFixed(hz >= 1e7 ? 0 : 1)} MHz` : hz >= 995 ? `${(hz / 1000).toFixed(hz >= 1e4 ? 0 : 1)} kHz` : `${hz >= 10 ? hz.toFixed(0) : hz.toFixed(hz >= 1 ? 1 : 2)} Hz`);
const fmtT = (s: number) => `${s.toFixed(3)} s`;
const regLabel = (path: string) => REGS.find((r) => r.path === path)?.label ?? path.replace(".", "_");

const NO_SEEN = { pa5: false, timer: false, blink: false, edit: false, ignored: false, reads: false, fix: false };
type Seen = typeof NO_SEEN;

export default function L38({ meta }: { meta: LabMeta }) {
  const lab = useLab<P38>({
    slug: meta.slug, code: DEMO, params: P38_DEFAULT, mcu: mcu37,
    setup: (m, _p, src) => setup38(m, src),
    validate: (src) => program37(src).diagnostics,
    world: world38,
  });
  const { mcu, params: p } = lab;
  const fw = mcu.fw;
  const s = sim38(mcu);
  const s37 = sim37(mcu);
  const now = mcu.time;
  const [pending, setPending] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [seen, setSeen] = useState<Seen>(NO_SEEN);
  const [failSeen, setFailSeen] = useState(false);
  const [editing, setEditing] = useState<{ key: string; value: number; text: string } | null>(null);
  const busRef = useRef<HTMLOListElement>(null);
  useEffect(() => { if (pending !== null && lab.code === pending) { setPending(null); lab.run(); } }, [pending, lab]);
  useEffect(() => { if (!msg) return; const id = window.setTimeout(() => setMsg(""), 4000); return () => window.clearTimeout(id); }, [msg]);

  const loadCode = (next: string) => { if (next === lab.code) { lab.run(); return; } lab.setCode(next); setPending(next); };
  const cf = (k: FieldKey) => codeField(lab.code, k);
  const edit = (k: FieldKey, v: string) => {
    if (cf(k) === null) { setMsg("This setting was not found in the code: edit the #define lines directly."); return; }
    const next = setCodeField(lab.code, k, v);
    if (next !== lab.code) loadCode(next);
  };
  const num = (k: FieldKey) => { const v = Number(cf(k)); return Number.isFinite(v) ? v : NaN; };
  const opts = (list: number[], cur: number) => (Number.isFinite(cur) && !list.includes(cur) ? [...list, cur].sort((a, b) => a - b) : list);
  const pscCode = num("psc"), arrCode = num("arr");

  /* ---------------- derived state ---------------- */
  const fx = effects(mcu);
  const rate = pinRate(mcu, 2);
  const fastRate = pinRate(mcu, 0.02);
  const odr = mcu.peek("GPIOA.ODR");
  const faults = s37?.faults ?? [];
  const lastW = new Map<string, BusEntry>();
  for (const e of s?.bus ?? []) if (e.rw === "W") lastW.set(e.path, e);
  const ignoredSeen = faults.some((f) => f.includes("clock disabled")) || !!s?.bus.some((e) => e.ignored);
  const tim2Fault = faults.some((f) => f.startsWith("TIM2") && f.includes("clock disabled"));
  const gpiobFault = faults.some((f) => f.startsWith("GPIOB"));
  const uifStuck = fx.cen && (mcu.peek("TIM2.SR") & 1) === 1 && fastRate > 1000;
  const moderWrong = fx.gpioaClk && ((odr >> 5) & 1) === 1 && fx.pa5Mode !== "output" && lab.compiledCode.includes("0x40020000 |= (1 << 5)");
  const editLive = s?.lastEdit && now - s.lastEdit.t < RECENT ? s.lastEdit : null;

  const hints: Array<{ text: string; tone?: "info"; fix?: Array<[string, () => void]> }> = [];
  if (!fw) hints.push({ text: "Press Run: the program is compiled to Thumb-2 and every load and store to a 0x4000_0000 address goes to the STM32F401 peripheral model.", tone: "info" });
  if (tim2Fault) hints.push({ text: "PA5 lights but never toggles: TIM2's clock is off, so the writes to TIM2_PSC, TIM2_ARR and TIM2_CR1 are ignored and the timer never counts. TIM2 sits on APB1, so bit 0 of RCC_APB1ENR (0x40023840) must be set first.", fix: [["Enable the TIM2 clock", () => loadCode(lab.code.includes("0x40000028") && !lab.code.includes("0x40023840") ? lab.code.replace(/^(\s*\*\(volatile uint32_t\*\)0x40000028)/m, `${TIMCLK_LINE.trimEnd()}\n$1`) : DEMO)]] });
  if (uifStuck) hints.push({ text: `PA5 toggles ${fmtHz(fastRate / 2)} instead of ${fmtHz(fx.updHz / 2)}: UIF is set by the first update and never cleared, so the if() is true on every pass of the loop. Status flags like UIF stay set until software clears them (write 0 to the bit).`, fix: [["Clear UIF after reading it", () => loadCode(/if \(\*\(volatile uint32_t\*\)0x40000010 & 1\) \{.*\n/.test(lab.code) && !lab.code.includes("0x40000010 = 0") ? lab.code.replace(/(if \(\*\(volatile uint32_t\*\)0x40000010 & 1\) \{.*\n)/, `$1${UIF_LINE}`) : DEMO)]] });
  if (gpiobFault) hints.push({ text: "The toggle goes to 0x40020414, which is GPIOB_ODR (GPIOB starts at 0x40020400), not GPIOA_ODR at 0x40020014. GPIOB's clock is off, so the write is dropped and PA5 never changes. With raw addresses one wrong digit silently targets another peripheral.", fix: [["Use 0x40020014", () => loadCode(lab.code.split("0x40020414").join("0x40020014"))]] });
  if (moderWrong) hints.push({ text: `GPIOA_ODR bit 5 is 1 but PA5 is still an ${fx.pa5Mode === "input" ? "input" : fx.pa5Mode} pin: MODER uses two bits per pin, so PA5's field is bits 11:10 and output mode is (1 << 10). (1 << 5) changed PA2's field instead.`, fix: [["Use (1 << 10)", () => loadCode(lab.code.replace("0x40020000 |= (1 << 5);   ", "0x40020000 |= (1 << 10);  ").replace("0x40020000 |= (1 << 5);", "0x40020000 |= (1 << 10);"))]] });
  if (editLive && !hints.some((x) => x.tone !== "info")) hints.push({ text: `Your write to ${regLabel(editLive.path)} took effect immediately, exactly like a debugger poke. It is not in your code: Reset (simulation) reflashes the program and the value is gone.`, tone: "info", fix: [["Reset simulation", lab.resetSim]] });
  const problems = hints.filter((x) => x.tone !== "info");
  useEffect(() => { if (problems.length) setFailSeen(true); }, [problems.length]);

  const flags: Seen = {
    pa5: fx.led,
    timer: fx.cen && fx.updHz >= 0.5 && fx.updHz <= 50,
    blink: !!fw && rate > 0 && fx.updHz > 0 && Math.abs(rate - fx.updHz) <= Math.max(1, fx.updHz * 0.3),
    edit: !!s?.bus.some((e) => e.src === "edit" && !e.ignored),
    ignored: ignoredSeen,
    reads: p.bus === "all" && !!s?.bus.some((e) => e.rw === "R" && e.n > 10),
    fix: failSeen && !problems.length && !!fw && rate > 0,
  };
  useEffect(() => {
    const ks = Object.keys(flags) as Array<keyof Seen>;
    if (ks.some((k) => flags[k] && !seen[k])) setSeen((o) => { const n = { ...o }; for (const k of ks) n[k] = o[k] || flags[k]; return n; });
  });

  const bus = (s?.bus ?? []).filter((e) => p.bus === "all" || e.rw === "W").slice(-60);
  const busKey = `${bus.length}:${bus[bus.length - 1]?.id ?? 0}`;
  useEffect(() => { const el = busRef.current; if (el) el.scrollTop = el.scrollHeight; }, [busKey]);

  /* ---------------- workbench editing ---------------- */
  const startEdit = (r: RegDef) => { const v = mcu.peek(r.path) >>> 0; setEditing({ key: r.key, value: v, text: hx(v, 8) }); };
  const setEditValue = (v: number) => setEditing((e) => (e ? { ...e, value: v >>> 0, text: hx(v, 8) } : e));
  const commit = (r: RegDef) => {
    if (!editing) return;
    const t = editing.text.trim();
    const v = /^0x[0-9a-f]+$/i.test(t) ? parseInt(t, 16) : /^\d+$/.test(t) ? Number(t) : NaN;
    if (!Number.isFinite(v) || v > 0xffffffff) { setMsg(`"${t}" is not a 32-bit value: type 0x followed by hex digits, or a decimal number.`); return; }
    poke38(mcu, r.path, v);
    setEditing(null);
    const last = s?.bus[s.bus.length - 1];
    if (last?.ignored) setMsg(`${r.label} ignored the write: its peripheral clock is off in RCC.`);
  };

  const shellLab = { ...lab, resetLab: () => { lab.resetLab(); setPending(null); setSeen(NO_SEEN); setFailSeen(false); setEditing(null); } };
  const custom = !VARIANTS.some((x) => x.code === lab.compiledCode);

  /* ---------------- bus scope ---------------- */
  const win = Math.min(6, Math.max(0.004, 10 / Math.max(fx.updHz || 4, 0.5)));
  const traces: Trace[] = [
    { label: "PA5", color: "#2f86ff", edges: mcu.edges.get("PA5") ?? [], initial: 0 },
    { label: "TIM2 UIF", color: "#f5a524", edges: s?.uifEdges ?? [], initial: 0 },
  ];

  const notesData = {
    takeaways: [
      "Every peripheral register is a fixed address. *(volatile uint32_t*)0x40020014 is GPIOA_ODR: a store there changes the pin, a load reads it back.",
      "volatile tells the compiler that each access must really happen, in order. Without it the polling loop could read TIM2_SR once and never again.",
      "Nothing answers until its bus clock is on: RCC_AHB1ENR for the GPIO ports, RCC_APB1ENR for TIM2. Writes to a gated peripheral are simply dropped.",
      "A timer divides its clock twice: PSC + 1 gives the tick, ARR + 1 ticks give one update. 16 MHz / 16000 / 250 = 4 updates per second.",
      "Status flags such as UIF stay set until software clears them; the bus trace shows the read that sees the flag and the write that clears it.",
    ],
    observe: "Press Run. In Memory Bus Trace, the seven configuration writes appear first, then one TIM2_SR write and one GPIOA_ODR write every 250 ms.",
    tryIt: "Click Edit on GPIOA_ODR and clear bit 5, or on TIM2_PSC and write 7999. Watch Peripheral Effects and the waveform react without recompiling.",
    measure: `Now: ${fw ? `TIM2 tick ${fmtHz(fx.tickHz)}, update ${fx.updHz ? fmtHz(fx.updHz) : "–"}, PA5 toggles ${rate ? fmtHz(rate) : "–"}, ${s?.writes ?? 0} bus writes and ${(s?.reads ?? 0).toLocaleString("en-US")} reads` : "press Run"}.`,
    modify: "Change PSC_VALUE and ARR_VALUE, set the bus filter to All accesses to see the polling reads, and try writing TIM2_CR1 = 0 from the workbench.",
    runAgain: "Load each bug example, read the hint and fix it, then confirm PA5 toggles at the TIM2 update rate.",
    challenge: "Make PA5 blink at exactly 1 Hz (toggle every 500 ms) using only the PSC and ARR values, and prove it from the waveform.",
    question: "Why is UIF cleared by writing 0 rather than 1, and what would happen if the code used *SR &= ~1 instead of *SR = 0?",
  };
  const checks = [
    { label: "Turn PA5 on without HAL", done: seen.pa5 },
    { label: "Configure TIM2 directly", done: seen.timer },
    { label: "Blink PA5 from TIM2 updates", done: seen.blink },
    { label: "Write a register from the workbench", done: seen.edit },
    { label: "See a write dropped by a gated clock", done: seen.ignored },
    { label: "Show the polling reads in the bus trace", done: seen.reads },
    { label: "Find and fix a register bug", done: seen.fix },
  ];
  const statusOk = !!fw && !problems.length;

  return (
    <LabShell meta={meta} lab={shellLab} subtitle="Configure MCU peripherals directly through memory-mapped registers."
      components={["STM32 Nucleo-F401RE, Cortex-M4 at 16 MHz (HSI)", "User LED LD2 on PA5", "TIM2 general-purpose timer on APB1", "No HAL, no CMSIS: raw volatile pointers only"]}>
      <div className="mcl-grid mcl-l38-grid">
        <Panel title="Bare-Metal Register Workbench" icon="table" className="mcl-l38-bench"
          tools={<span className="mcl-l38-live"><i className={fw && lab.running ? "on" : ""} />{fw && lab.running ? "live" : "paused"}</span>}>
          <ul className="mcl-l38-regs">
            {REGS.map((r) => {
              const v = mcu.peek(r.path) >>> 0;
              const w = lastW.get(r.path);
              const hot = !!w && now - w.t < 0.6;
              const open = editing?.key === r.key;
              return (
                <li key={r.key} className={`${hot ? "hot" : ""} ${open ? "open" : ""}`}>
                  <div className="mcl-l38-row">
                    <b>{r.label}</b>
                    <code className="addr">{hx(addrOf(r.path), 8)}</code>
                    <code className="val">{hx(v, 8)}</code>
                    <span className="dec">{r.fields.map((f) => `${f.name} = ${f.values ? f.values[fieldOf(v, f)] : fieldOf(v, f)}`).join(" · ")}</span>
                    <button type="button" className="mcl-l38-edit" aria-expanded={open} onClick={() => (open ? setEditing(null) : startEdit(r))}>{open ? "Close" : "Edit"}</button>
                  </div>
                  {open && editing ? (
                    <div className="mcl-l38-editor">
                      <div className="bits" role="group" aria-label={`${r.label} bits 31 to 0`}>
                        {Array.from({ length: 32 }, (_, i) => 31 - i).map((bit) => {
                          const on = ((editing.value >>> bit) & 1) === 1;
                          const f = r.fields.find((x) => bit >= x.lo && bit < x.lo + Math.min(x.bits, 32));
                          return <button key={bit} type="button" className={`${on ? "on" : ""} ${f ? "field" : ""}`} title={`bit ${bit}${f ? ` · ${f.name}` : ""}`} aria-label={`Bit ${bit}${f ? ` ${f.name}` : ""}`} aria-pressed={on} onClick={() => setEditValue(editing.value ^ (2 ** bit))}>{on ? 1 : 0}</button>;
                        })}
                      </div>
                      <div className="fields">
                        {r.fields.map((f) => (
                          <label key={f.name}>
                            <span>{f.name}</span>
                            {f.values ? (
                              <select value={fieldOf(editing.value, f)} onChange={(e) => { const mask = ((1 << f.bits) - 1) << f.lo; setEditValue((editing.value & ~mask) | (Number(e.target.value) << f.lo)); }}>{f.values.map((x, i) => <option key={x} value={i}>{i} · {x}</option>)}</select>
                            ) : f.bits === 1 ? (
                              <select value={fieldOf(editing.value, f)} onChange={(e) => setEditValue(Number(e.target.value) ? editing.value | (1 << f.lo) : editing.value & ~(1 << f.lo))}><option value={0}>0</option><option value={1}>1</option></select>
                            ) : (
                              <input type="number" min={0} max={f.bits >= 32 ? 4294967295 : (1 << f.bits) - 1} value={fieldOf(editing.value, f)} onChange={(e) => { const x = Math.max(0, Math.floor(Number(e.target.value) || 0)); setEditValue(f.bits >= 32 ? x : (editing.value & ~(((1 << f.bits) - 1) << f.lo)) | ((x & ((1 << f.bits) - 1)) << f.lo)); }} />
                            )}
                            <small>{f.note}</small>
                          </label>
                        ))}
                      </div>
                      <div className="act">
                        <input value={editing.text} aria-label={`New value for ${r.label}`} onChange={(e) => setEditing({ ...editing, text: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") commit(r); else if (e.key === "Escape") setEditing(null); }} />
                        <button type="button" className="go" onClick={() => commit(r)}>Write {r.label}</button>
                        <button type="button" onClick={() => setEditing(null)}>Cancel</button>
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <p className="mcl-l31-sub">Values are read straight from the peripheral model. Edit writes through the same bus as the CPU, so clock gating applies to you too.</p>
        </Panel>

        <Panel title="Peripheral Effects" icon="bolt" className="mcl-l38-fx">
          <dl className="mcl-l38-effects">
            <div className={fx.gpioaClk ? "ok" : "off"}><dt>GPIOA clock</dt><dd>{fx.gpioaClk ? "ON" : "OFF"}</dd></div>
            <div className={fx.pa5Mode === "output" ? "ok" : "off"}><dt>PA5 mode</dt><dd>{fx.pa5Mode.toUpperCase()}</dd></div>
            <div className={fx.led ? "hi" : "off"}><dt>PA5 state</dt><dd><i className={`mcl-l38-led ${fx.led ? "on" : ""}`} />{fx.pa5Mode === "output" ? (fx.pa5 ? "HIGH" : "LOW") : "not driven"}</dd></div>
            <div className={fx.tim2Clk ? "ok" : "off"}><dt>TIM2 clock</dt><dd>{fx.tim2Clk ? "ON" : "OFF"}</dd></div>
            <div className={fx.cen ? "ok" : "off"}><dt>TIM2</dt><dd>{fx.cen ? `RUNNING · CNT ${fx.cnt}` : "STOPPED"}</dd></div>
            <div className={fx.irq === "disabled" ? "off" : "ok"}><dt>IRQ</dt><dd>{fx.irq}</dd></div>
          </dl>
          <p className="mcl-l38-rate">{fx.cen ? <>16 MHz ÷ {(mcu.peek("TIM2.PSC") & 0xffff) + 1} = <b>{fmtHz(fx.tickHz)}</b> tick ÷ {(mcu.peek("TIM2.ARR") >>> 0) + 1} = <b>{fmtHz(fx.updHz)}</b> update · PA5 toggles at <b>{rate ? fmtHz(rate) : fastRate ? fmtHz(fastRate) : "–"}</b></> : `Timer stopped: ${fx.tim2Clk ? "CEN is 0 in TIM2_CR1." : "no clock on APB1 for TIM2."}`}</p>
          <div className="mcl-l38-ctl">
            <label><span>PSC_VALUE</span><select value={Number.isFinite(pscCode) ? pscCode : ""} disabled={!Number.isFinite(pscCode)} aria-label="PSC_VALUE" onChange={(e) => edit("psc", e.target.value)}>{opts(PSCS, pscCode).map((v) => <option key={v} value={v}>{v} → {fmtHz(CLOCK / (v + 1))}</option>)}</select></label>
            <label><span>ARR_VALUE</span><select value={Number.isFinite(arrCode) ? arrCode : ""} disabled={!Number.isFinite(arrCode)} aria-label="ARR_VALUE" onChange={(e) => edit("arr", e.target.value)}>{opts(ARRS, arrCode).map((v) => <option key={v} value={v}>{v} → ÷{v + 1}</option>)}</select></label>
          </div>
        </Panel>

        <Panel title="Memory Bus Trace" icon="wave" className="mcl-l38-bus"
          tools={<>
            <select value={p.bus} aria-label="Bus filter" onChange={(e) => lab.setParam("bus", e.target.value)}><option value="w">Writes</option><option value="all">All accesses</option></select>
            <button type="button" className="mcl-l31-btn" disabled={!s?.bus.length} onClick={() => { if (s) s.bus.length = 0; setMsg(""); }}>Clear</button>
          </>}>
          <Scope traces={traces} now={now} window={win} lanes height={104} frame={lab.frame} ariaLabel="PA5 and the TIM2 update flag" />
          <ol className="mcl-l38-buslist" ref={busRef} aria-label="Peripheral bus transactions">
            {bus.map((e) => (
              <li key={e.id} className={`${e.rw === "W" ? "w" : "r"} ${e.src} ${e.ignored ? "ign" : ""}`}>
                <small>{fmtT(e.t)}</small>
                <b>{e.rw}</b>
                <span>{regLabel(e.path)}</span>
                <code>{e.rw === "W" ? "←" : "→"} {hx(e.value, 8)}</code>
                <em>{e.src === "edit" ? (e.ignored ? "you · dropped" : "you") : e.n > 1 ? `×${e.n.toLocaleString("en-US")}` : ""}</em>
              </li>
            ))}
            {!bus.length ? <li className="empty">{fw ? "No bus accesses with this filter yet." : "Press Run to see the bus."}</li> : null}
          </ol>
        </Panel>

        <CodeEditor lab={shellLab} className="mcl-l38-code" languages={VARIANTS} />

        <Panel title="Register Challenge" icon="target" className="mcl-l38-chal">
          <p className="mcl-l38-brief">Turn PA5 on without HAL. Configure TIM2 directly. Observe every memory-mapped write in the bus trace.</p>
          <div className={`mcl-l31-status ${!fw ? "off" : problems.length ? "warn" : "ok"}`}>
            <Icon name={statusOk ? "check" : "alert"} size={16} />
            <div>
              <b>{!fw ? "Firmware stopped" : problems.length ? `${problems.length} problem${problems.length === 1 ? "" : "s"}` : rate ? "PA5 blinking from TIM2" : fx.led ? "PA5 on" : "Running"}</b>
              <span>{fw ? `${s?.writes ?? 0} writes · ${(s?.reads ?? 0).toLocaleString("en-US")} reads · ${faults.length} dropped write${faults.length === 1 ? "" : "s"}` : "Press Run to flash the board."}</span>
            </div>
          </div>
          {msg ? <p className="mcl-l31-hint"><Icon name="alert" size={14} /><span>{msg}</span></p> : null}
          {hints.slice(0, 2).map((x) => (
            <p key={x.text} className={`mcl-l31-hint ${x.tone ?? ""}`}><Icon name={x.tone === "info" ? "bulb" : "alert"} size={14} /><span>{x.text}</span>{x.fix?.map(([l, fn]) => <button key={l} type="button" onClick={fn}>{l}</button>)}</p>
          ))}
          <ul className="mcl-checks mcl-l38-checks">{checks.map((c) => <li key={c.label} className={c.done ? "done" : ""}><Icon name={c.done ? "check" : "target"} size={14} />{c.label}</li>)}</ul>
          <p className="mcl-l31-sub">{lab.dirty && !pending ? "The editor has unflashed changes: press Run to apply them. " : ""}{custom && fw ? "Running your own version of the program." : ""}</p>
        </Panel>

        <div className="mcl-l38-notes"><LearningNotes notes={notesData} /></div>
      </div>
    </LabShell>
  );
}
