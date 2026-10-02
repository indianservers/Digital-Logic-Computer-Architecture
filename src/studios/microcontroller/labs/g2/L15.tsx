import { useEffect, useState } from "react";
import { useLab } from "../core/useLab";
import type { LabMeta } from "../registry";
import { CodeEditor } from "../ui/CodeEditor";
import { Icon } from "../ui/Icon";
import { LearningNotes, Panel, Toggle } from "../ui/Panels";
import { LabShell } from "../ui/Shell";
import { AF, analyse, clockOn, DEMO, genMux, HAL_DEMO, LEFT, P15_DEFAULT, periphOf, RIGHT, route, setup15, world15, type Fix, type P15, type PinState } from "./L15sim";

const hex = (v: number) => `0x${(v >>> 0).toString(16).toUpperCase().padStart(8, "0")}`;
const COLORS: Record<string, string> = { USART: "#2563eb", SPI: "#7c3aed", I2C: "#0891b2", TIM: "#ea580c", ADC: "#16a34a", I2S: "#db2777" };
const colorOf = (per: string) => COLORS[per.replace(/\d+$/, "")] ?? "#64748b";

const valueOf = (s: PinState) => (s.mode === 0 ? "in" : s.mode === 1 ? "out" : s.mode === 3 ? "an" : `af:${s.af}`);
function parse(v: string): { mode: number; af?: number } {
  if (v === "in") return { mode: 0 };
  if (v === "out") return { mode: 1 };
  if (v === "an") return { mode: 3 };
  return { mode: 2, af: Number(v.slice(3)) };
}

export default function L15({ meta }: { meta: LabMeta }) {
  const lab = useLab<P15>({
    slug: meta.slug, code: DEMO, params: P15_DEFAULT, rebuildOn: ["spiGated"],
    mcu: () => ({ ips: 120_000, strictClock: true }),
    setup: (m, p) => setup15(m, p),
    world: world15,
  });
  const { mcu, params } = lab;
  const a = analyse(mcu);
  const errors = a.issues.filter((i) => i.sev === "error").length;
  const badPins = new Set(a.issues.flatMap((i) => (i.sev === "error" ? i.pins.filter((p) => a.states.find((s) => s.pin === p)?.mode === 2) : [])));
  const warnPins = new Set(a.issues.flatMap((i) => (i.sev === "warn" ? i.pins : [])));
  const [sel, setSel] = useState("PA2");
  const [pending, setPending] = useState<string | null>(null);
  const [seen, setSeen] = useState({ conflict: false, resolved: false, copied: false, fixed: false });

  useEffect(() => { if (pending !== null && lab.code === pending) { setPending(null); lab.run(); } }, [pending, lab]);
  useEffect(() => {
    if (errors > 0 && !seen.conflict) setSeen((s) => ({ ...s, conflict: true }));
    else if (seen.conflict && !seen.resolved && a.issues.length === 0 && a.required.length > 0) setSeen((s) => ({ ...s, resolved: true }));
  }, [errors, a.issues.length, a.required.length, seen.conflict, seen.resolved]);

  const apply = (pin: string, mode: number, af?: number, od?: boolean) => {
    if (!route(mcu, pin, mode, af, od)) { lab.setNotice(`GPIO${pin[1]} has no clock, so the write was ignored. Enable RCC_AHB1ENR_GPIO${pin[1]}EN in the code first.`); return false; }
    lab.advance(0);
    return true;
  };
  const applyFix = (f: Fix) => { if (apply(f.pin, f.mode, f.af, f.od) && f.od) setSeen((s) => ({ ...s, fixed: true })); setSel(f.pin); };
  const makeConflict = () => { if (apply("PA5", 2, 1)) { setSel("PA5"); lab.setNotice("PA5 now selects AF1 (TIM2_CH1). SPI1 is still enabled but has lost its clock pin."); } };
  const copyToCode = () => {
    const next = genMux(mcu, lab.code);
    if (!next) { lab.setNotice("The code has no \"// --- pin mux ---\" / \"// --- peripherals ---\" markers, so the mux block cannot be regenerated. Load the register example."); return; }
    lab.setCode(next);
    setPending(next);
    setSeen((s) => ({ ...s, copied: true }));
  };

  const state = (p: string) => a.states.find((s) => s.pin === p)!;
  const periphs: string[] = [];
  for (const s of a.states) if (s.signal) { const per = periphOf(s.signal); if (!periphs.includes(per)) periphs.push(per); }
  const missing: string[] = [];
  for (const sig of a.required) { const per = periphOf(sig); if (!a.routed.has(sig) && !periphs.includes(per) && !missing.includes(per)) missing.push(per); }
  const blocks = [...periphs, ...missing];
  const step = blocks.length > 1 ? Math.min(34, 196 / (blocks.length - 1)) : 0;
  const by = (per: string) => 92 + blocks.indexOf(per) * step + (blocks.length > 1 ? 0 : 98);
  const pinY = (side: "l" | "r", i: number) => (side === "l" ? 56 + i * 32 : 72 + i * 40);

  const pinRow = (p: string, i: number, side: "l" | "r") => {
    const s = state(p), y = pinY(side, i), left = side === "l";
    const per = s.signal ? periphOf(s.signal) : "";
    const bad = badPins.has(p), warn = !bad && warnPins.has(p);
    const col = bad ? "#dc2626" : per ? colorOf(per) : "#94a3b8";
    const edge = left ? 214 : 446, stub = left ? 184 : 476;
    const level = mcu.pin(p).level;
    const live = s.mode === 2 && /_CH\d$/.test(s.signal) && clockOn(mcu, per) && level === 1;
    return (
      <g key={p} className={`mcl-g2-pin ${sel === p ? "sel" : ""}`} role="button" tabIndex={0} aria-label={`${p} ${s.label}`} onClick={() => setSel(p)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSel(p); } }}>
        <line x1={stub} y1={y} x2={edge} y2={y} stroke={col} strokeWidth={sel === p ? 4 : 2.5} strokeLinecap="round" />
        {per && blocks.includes(per) ? (
          <path d={left ? `M${edge} ${y} C ${edge + 40} ${y}, 252 ${by(per)}, 284 ${by(per)}` : `M${edge} ${y} C ${edge - 40} ${y}, 408 ${by(per)}, 376 ${by(per)}`}
            fill="none" stroke={col} strokeWidth={sel === p ? 2.6 : 1.6} strokeDasharray={bad || warn ? "5 3" : undefined} opacity={0.95} />
        ) : null}
        <circle cx={stub} cy={y} r={4} fill={live ? "#22c55e" : s.mode === 0 ? "#fff" : col} stroke={col} strokeWidth={1.5} />
        <text x={left ? stub - 9 : stub + 9} y={y + 3.5} textAnchor={left ? "end" : "start"} fontSize="10.5" fontWeight="800" fill="#1e3a5f">{p}</text>
        <rect x={left ? 30 : 512} y={y - 9} width={118} height={18} rx={9} fill={bad ? "#fef2f2" : s.signal ? "#eef5ff" : "#f8fafc"} stroke={bad ? "#fca5a5" : warn ? "#fcd34d" : "#d6e4f5"} />
        <text x={left ? 89 : 571} y={y + 3.5} textAnchor="middle" fontSize="9" fontWeight="700" fill={bad ? "#b42318" : s.signal ? col : "#64748b"}>{s.label}{s.od ? " · OD" : ""}</text>
      </g>
    );
  };

  return (
    <LabShell meta={meta} lab={lab} subtitle="Route UART, SPI, PWM and ADC functions to MCU pins and detect conflicts."
      components={["NUCLEO-F401RE (STM32F401RE)", "USART2 on PA2/PA3 (ST-LINK virtual COM port)", "SPI1 on PA5/PA6/PA7, I2C1 on PB6/PB7 with 4.7 kΩ pull-ups", "TIM2 PWM output on PA0"]}>
      <div className="mcl-l15-grid">
        <Panel title="Pin Multiplexer Explorer" icon="grid" className="g-explorer" tools={<span className={`mcl-chip ${errors ? "mcl-chip-bad" : a.issues.length ? "mcl-chip-warn" : "mcl-chip-live"}`}>{errors ? `${errors} conflict${errors > 1 ? "s" : ""}` : a.issues.length ? `${a.issues.length} warning${a.issues.length > 1 ? "s" : ""}` : "mux clean"}</span>}>
          <div className="mcl-g2-mat mcl-l15-mat">
            <svg viewBox="0 0 660 336" className="mcl-svg" role="img" aria-label="STM32F4 pin multiplexer with routing lines from pins to peripherals">
              <rect x={214} y={24} width={232} height={292} rx={16} fill="#24344d" stroke="#0f1b2d" strokeWidth={2} />
              <text x={330} y={58} textAnchor="middle" fontSize="20" fontWeight="800" fill="#fff">STM32F4</text>
              {blocks.map((per) => {
                const y = by(per), on = clockOn(mcu, per), miss = missing.includes(per), col = colorOf(per);
                return (
                  <g key={per}>
                    <rect x={284} y={y - 12} width={92} height={24} rx={6} fill={miss ? "#3b2330" : "#1b2a40"} stroke={miss ? "#f87171" : col} strokeWidth={1.5} strokeDasharray={miss ? "4 3" : undefined} />
                    <text x={324} y={y + 4} textAnchor="middle" fontSize="10" fontWeight="800" fill={miss ? "#fecaca" : "#e2ecfb"}>{per}</text>
                    <circle cx={364} cy={y} r={3.5} fill={on ? "#22c55e" : "#64748b"}><title>{on ? "clock on" : "no clock"}</title></circle>
                  </g>
                );
              })}
              {!blocks.length ? <text x={330} y={180} textAnchor="middle" fontSize="10" fill="#9fb3cf">No peripheral routed yet</text> : null}
              {LEFT.map((p, i) => pinRow(p, i, "l"))}
              {RIGHT.map((p, i) => pinRow(p, i, "r"))}
            </svg>
          </div>
          <div className="mcl-g2-kv mcl-l15-kv">
            <div><small>GPIOA.MODER</small><b className="mcl-mono">{hex(mcu.peek("GPIOA.MODER"))}</b></div>
            <div><small>GPIOA.AFRL (AFR[0])</small><b className="mcl-mono">{hex(mcu.peek("GPIOA.AFRL"))}</b></div>
            <div><small>GPIOB.AFRL / OTYPER</small><b className="mcl-mono">{hex(mcu.peek("GPIOB.AFRL"))} / {(mcu.peek("GPIOB.OTYPER") & 0xffff).toString(16).toUpperCase()}</b></div>
          </div>
        </Panel>

        <Panel title="Alternate Function Routing" icon="sliders" className="g-routing" tools={
          <div className="mcl-l14-tools">
            <button type="button" onClick={makeConflict}>Create conflict</button>
            <button type="button" className="go" onClick={copyToCode}>Write mux to code</button>
          </div>
        }>
          <div className="mcl-l15-rows">
            {[...LEFT, ...RIGHT].map((p) => {
              const s = state(p), t = AF[p]!;
              const bad = badPins.has(p), warn = !bad && warnPins.has(p);
              return (
                <div key={p} className={`mcl-l15-row ${sel === p ? "sel" : ""} ${bad ? "bad" : warn ? "warn" : ""}`} onClick={() => setSel(p)}>
                  <b>{p}</b>
                  <select aria-label={`${p} function`} value={valueOf(s)} className={s.signal ? "on" : ""}
                    onChange={(e) => { const r = parse(e.target.value); apply(p, r.mode, r.af); setSel(p); }}>
                    <option value="in">GPIO input</option>
                    <option value="out">GPIO output</option>
                    {t.adc ? <option value="an">Analog · {t.adc}</option> : <option value="an">Analog</option>}
                    {Object.entries(t.af).map(([n, sig]) => <option key={n} value={`af:${n}`}>AF{n} · {sig}</option>)}
                    {s.mode === 2 && !s.signal ? <option value={`af:${s.af}`}>AF{s.af} · (no function)</option> : null}
                  </select>
                  <button type="button" className={s.od ? "on" : ""} disabled={s.mode !== 2} title="Output type (OTYPER)" onClick={(e) => { e.stopPropagation(); apply(p, s.mode, undefined, !s.od); }}>{s.od ? "OD" : "PP"}</button>
                </div>
              );
            })}
          </div>
          <p className="mcl-g2-hint"><Icon name="bulb" size={14} />Each choice writes MODER, AFRL/AFRH and OTYPER exactly as firmware would. Write mux to code regenerates the pin-mux block so Reset Simulation keeps your routing.</p>
        </Panel>

        <CodeEditor lab={lab} className="g-code" languages={[{ label: "Registers", code: DEMO }, { label: "HAL", code: HAL_DEMO }]} />

        <div className="g-conflict mcl-l13-side">
          <Panel title="Conflict Detector" icon="alert">
            <p className="mcl-l15-intro">Assign two incompatible peripherals to the same pin to trigger a visible mux conflict. Resolve it by selecting a valid alternate-function mapping.</p>
            <div className="mcl-l15-sigs">
              {a.required.length ? a.required.map((sig) => {
                const pins = a.routed.get(sig) ?? [];
                const ok = pins.length === 1 && clockOn(mcu, periphOf(sig));
                return <span key={sig} className={ok ? "ok" : pins.length ? "warn" : "bad"} style={{ borderColor: ok ? colorOf(periphOf(sig)) : undefined }}>{sig} → {pins.length ? pins.join(", ") : "none"}</span>;
              }) : <span>No peripheral enabled yet: press Run.</span>}
            </div>
            {a.issues.length ? (
              <ul className="mcl-l15-issues">
                {a.issues.map((i) => (
                  <li key={i.text} className={i.sev}>
                    <Icon name={i.sev === "error" ? "alert" : "bulb"} size={13} />
                    <span>{i.text}</span>
                    {i.fix ? <button type="button" onClick={() => applyFix(i.fix!)}>{i.fix.label}</button> : null}
                  </li>
                ))}
              </ul>
            ) : <p className="mcl-l15-ok"><Icon name="target" size={13} />{a.required.length ? `All ${a.required.length} enabled signals have exactly one pin and a clocked peripheral.` : "Nothing to check until the firmware enables a peripheral."}</p>}
            <div className="mcl-g2-faults">
              <b><Icon name="bug" size={14} />Fault injection</b>
              <Toggle label="SPI1 clock gate stuck off" checked={params.spiGated} onChange={(v) => lab.setParam("spiGated", v)} hint="RCC_APB2ENR_SPI1EN reads back 1 but SPI1 never clocks: its pins are routed yet idle" />
              <Toggle label="Firmware forgets I2C open-drain" checked={params.i2cPushPull} onChange={(v) => lab.setParam("i2cPushPull", v)} hint="PB6/PB7 stay push-pull, so an I2C slave pulling SDA low shorts against the MCU" />
            </div>
          </Panel>
          <LearningNotes variant="tasks" title="Learning Tasks" notes={{
            takeaways: [],
            observe: "Each pin's colour shows the peripheral its AF number connects to. PA0 blinks green with the TIM2 PWM output.",
            tryIt: "Press Create conflict (or set PA5 to AF1 · TIM2_CH1) and read the detector: SPI1 loses SCK and TIM2_CH1 now drives two pins.",
            measure: `GPIOA.AFRL = ${hex(mcu.peek("GPIOA.AFRL"))}: nibble 5 (PA5) = ${(mcu.peek("GPIOA.AFRL") >>> 20) & 0xf}, nibble 2 (PA2) = ${(mcu.peek("GPIOA.AFRL") >>> 8) & 0xf}.`,
            modify: "Change g.Alternate in the HAL example to GPIO_AF5_SPI1 and Run: PA2/PA3 select an AF with no function on those pins.",
            runAgain: "Fix the routing, press Write mux to code, then Reset Simulation: the routing survives because it is now in the firmware.",
            challenge: "TIM2_CH1 exists on PA0, PA5 and PA15. Why does the demo use PA0 instead of PA5?",
            checks: [
              { label: "Triggered a mux conflict", done: seen.conflict },
              { label: "Resolved it with a valid AF mapping", done: seen.resolved },
              { label: "Wrote the mux back to the code", done: seen.copied },
              { label: "Repaired a push-pull I2C pin", done: seen.fixed },
            ],
          }} />
        </div>
      </div>
    </LabShell>
  );
}
