import { useState } from "react";
import { useLab } from "../core/useLab";
import type { LabMeta } from "../registry";
import { CodeEditor } from "../ui/CodeEditor";
import { Breadboard, HwDefs, SvgLed, Wire } from "../ui/Hardware";
import { Icon } from "../ui/Icon";
import { LearningNotes, Panel, Toggle } from "../ui/Panels";
import { LabShell } from "../ui/Shell";
import { BenchChip } from "./Bench";
import { BSRR_DEMO, editorWrite, GPIOA_BASE, MODES, P14_DEFAULT, PULLS, REGS, RMW_DEMO, setup14, stepToWrite, SWD_BUG, trace14, world14, type P14, type RegName } from "./L14sim";

const EDIT_REGS: RegName[] = ["MODER", "OTYPER", "PUPDR", "ODR", "BSRR"];
const hex = (v: number, w = 8) => `0x${(v >>> 0).toString(16).toUpperCase().padStart(w, "0")}`;
const MODE_CLS = ["m0", "m1", "m2", "m3"];

function options(reg: RegName): string[] {
  if (reg === "MODER") return MODES.map((m, k) => `${k.toString(2).padStart(2, "0")} ${m}`);
  if (reg === "PUPDR") return PULLS.slice(0, 3).map((m, k) => `${k.toString(2).padStart(2, "0")} ${m}`);
  if (reg === "OTYPER") return ["0 Push-pull", "1 Open-drain"];
  if (reg === "BSRR") return ["BR Reset", "BS Set"];
  return ["0 Low", "1 High"];
}
function cStatement(reg: RegName, n: number, k: number) {
  if (reg === "MODER" || reg === "PUPDR") return `GPIOA->${reg} = (GPIOA->${reg} & ~(3U << ${2 * n})) | (${k}U << ${2 * n});`;
  if (reg === "BSRR") return k ? `GPIOA->BSRR = (1U << ${n});` : `GPIOA->BSRR = (1U << (${n} + 16));`;
  return k ? `GPIOA->${reg} |= (1U << ${n});` : `GPIOA->${reg} &= ~(1U << ${n});`;
}

export default function L14({ meta }: { meta: LabMeta }) {
  const lab = useLab<P14>({
    slug: meta.slug, code: BSRR_DEMO, params: P14_DEFAULT, rebuildOn: ["clockOff"],
    mcu: () => ({ ips: 120_000, strictClock: true }),
    setup: (m, p) => setup14(m, p),
    world: world14,
  });
  const { mcu, params } = lab;
  const tr = trace14(mcu);
  const [reg, setReg] = useState<RegName>("MODER");
  const [pin, setPin] = useState(5);
  const [raw, setRaw] = useState("");
  const [seen, setSeen] = useState({ steps: 0, moder: false, bsrr: false });

  const val = (r: RegName) => (r === "BSRR" ? tr.bsrr : mcu.peek(`GPIOA.${r}`));
  const field = (r: RegName, n: number) => {
    if (r === "MODER" || r === "PUPDR") return (val(r) >>> (2 * n)) & 3;
    if (r === "BSRR") return (mcu.peek("GPIOA.ODR") >> n) & 1;
    return (val(r) >> n) & 1;
  };
  const cur = field(reg, pin);
  const wide = reg === "MODER" || reg === "PUPDR";

  const writeField = (k: number) => {
    let v: number;
    if (wide) v = (val(reg) & ~(3 << (2 * pin))) | (k << (2 * pin));
    else if (reg === "BSRR") v = k ? 1 << pin : 1 << (pin + 16);
    else v = k ? val(reg) | (1 << pin) : val(reg) & ~(1 << pin);
    editorWrite(mcu, `GPIOA.${reg}`, v);
    lab.advance(0);
    if (reg === "MODER") setSeen((s) => ({ ...s, moder: true }));
    if (reg === "BSRR" && k && pin === (params.miswired ? 6 : 5)) setSeen((s) => ({ ...s, bsrr: true }));
  };
  const writeRaw = () => {
    const v = Number.parseInt(raw.replace(/^0x/i, ""), 16);
    if (!Number.isFinite(v)) { lab.setNotice("Enter a hexadecimal value such as 0x00000400."); return; }
    editorWrite(mcu, `GPIOA.${reg}`, v);
    lab.advance(0);
  };
  const nextWrite = () => {
    if (lab.running && !mcu.fw?.paused) lab.toggle();
    const ok = stepToWrite(mcu, () => world14(mcu, 0.001, params));
    lab.advance(0);
    if (ok) setSeen((s) => ({ ...s, steps: s.steps + 1 })); else lab.setNotice("No register write within 600 statements: the firmware is only reading or waiting.");
  };
  const paused = !!mcu.fw?.paused;
  const cont = () => { if (paused || !lab.running) lab.toggle(); };
  const restart = () => { lab.resetSim(); if (lab.running) lab.toggle(); lab.setNotice("Restarted and halted before the first statement. Press Next write to execute one register write at a time."); };

  const ledPin = params.miswired ? "PA6" : "PA5";
  const redOn = mcu.pin(ledPin).level === 1 && mcu.pin(ledPin).mode === "out";
  const greenOn = mcu.pin("PA6").level === 1 && mcu.pin("PA6").mode === "out" && !params.miswired;
  const swdLost = ((mcu.peek("GPIOA.MODER") >>> 26) & 0xf) !== 0xa;
  const clockOn = (mcu.peek("RCC.AHB1ENR") & 1) === 1 && !params.clockOff;
  const swdSeen = tr.entries.some((e) => e.note.includes("SWD"));

  return (
    <LabShell meta={meta} lab={lab} subtitle="Manipulate MODER, IDR, ODR and BSRR directly and see immediate hardware effects."
      components={["NUCLEO-F401RE (STM32F401RE)", "Red LED + 330 Ω on PA5 (green LED on PA6)", "Slide switch from PA0 to 3.3 V", "On-board ST-LINK on PA13 (SWDIO) / PA14 (SWCLK)"]}>
      <div className="mcl-g2-grid mcl-l14-grid">
        <Panel title="Live Register Inspector" icon="grid" className="g-bench" tools={<span className={`mcl-chip ${clockOn ? "mcl-chip-live" : "mcl-chip-warn"}`}>GPIOA clock {clockOn ? "on" : "off"}</span>}>
          <div className="mcl-l14-bits head"><span /><span /><span />{Array.from({ length: 16 }, (_, i) => <em key={i}>{15 - i}</em>)}</div>
          {REGS.map((r) => {
            const v = val(r.name);
            return (
              <div key={r.name} className={`mcl-l14-reg ${reg === r.name ? "sel" : ""}`}>
                <div className="mcl-l14-bits">
                  <b>{r.name}</b>
                  <span className="mcl-mono addr">{hex(GPIOA_BASE + r.off)}</span>
                  <span className="mcl-mono val">{hex(v)}{r.name === "BSRR" ? <small> last write</small> : null}</span>
                  {Array.from({ length: 16 }, (_, i) => {
                    const n = 15 - i;
                    let cls = "", txt = "", title = `PA${n}`;
                    if (r.pins === 2) { const f = (v >>> (2 * n)) & 3; cls = r.name === "MODER" ? MODE_CLS[f]! : `p${f}`; txt = f.toString(2).padStart(2, "0"); title += `: ${(r.name === "MODER" ? MODES : PULLS)[f]}`; }
                    else if (r.name === "BSRR") { const s = (v >> n) & 1, rr = (v >>> (n + 16)) & 1; cls = s ? "set" : rr ? "rst" : ""; txt = s ? "S" : rr ? "R" : ""; title += s ? ": BS (set)" : rr ? ": BR (reset)" : ""; }
                    else { const b = (v >> n) & 1; const fl = r.name === "IDR" && mcu.isFloating(`PA${n}`); cls = fl ? "fl" : b ? "one" : ""; txt = fl ? "?" : String(b); title += fl ? ": floating" : `: ${b}`; }
                    const click = r.name === "IDR" ? undefined : () => { setReg(r.name); setPin(n); if (r.name === "ODR") { editorWrite(mcu, "GPIOA.ODR", v ^ (1 << n)); lab.advance(0); } };
                    return (
                      <button key={n} type="button" className={`cell ${cls} ${reg === r.name && pin === n ? "focus" : ""}`} title={title} disabled={!click} onClick={click} aria-label={`${r.name} PA${n}`}>{txt}</button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <div className="mcl-l14-legend">
            <span><i className="m0" />00 Input</span><span><i className="m1" />01 Output</span><span><i className="m2" />10 Alternate</span><span><i className="m3" />11 Analog</span>
            <span><i className="one" />1</span><span><i className="set" />BS</span><span><i className="rst" />BR</span><span><i className="fl" />floating</span>
          </div>
          <p className="mcl-g2-hint"><Icon name="bulb" size={14} />Click a MODER or PUPDR cell to edit that field, click an ODR cell to flip the bit. IDR is read-only: it reflects the pins. BSRR is write-only and always reads 0, so the last value written is shown.</p>
          {swdLost ? <p className="mcl-g2-hint warn"><Icon name="alert" size={14} />PA13/PA14 are no longer in alternate-function mode: on real hardware the ST-LINK loses its SWD connection until you hold the board in reset.</p> : null}
        </Panel>

        <Panel title="Bit Field Editor" icon="sliders" className="g-ctl">
          <div className="mcl-l14-chips">{EDIT_REGS.map((r) => <button key={r} type="button" className={reg === r ? "on" : ""} onClick={() => setReg(r)}>{r}</button>)}</div>
          <div className="mcl-l14-pins">{Array.from({ length: 16 }, (_, n) => <button key={n} type="button" className={pin === n ? "on" : ""} onClick={() => setPin(n)}>PA{n}</button>)}</div>
          <div className="mcl-l14-field mcl-mono">GPIOA.{reg}{wide ? `[${2 * pin + 1}:${2 * pin}]` : reg === "BSRR" ? `[${pin + 16} / ${pin}]` : `[${pin}]`}</div>
          <div className={`mcl-g2-btns ${options(reg).length > 3 ? "four" : ""}`}>
            {options(reg).map((o, k) => <button key={o} type="button" className={reg !== "BSRR" && cur === k ? "on blue" : ""} onClick={() => writeField(k)}>{o}</button>)}
          </div>
          <code className="mcl-l14-c">{cStatement(reg, pin, reg === "BSRR" ? 1 - cur : wide ? cur : 1 - cur)}</code>
          <div className="mcl-l14-raw">
            <label htmlFor="l14-raw">Write GPIOA.{reg} =</label>
            <input id="l14-raw" className="mcl-mono" value={raw} placeholder={hex(val(reg))} onChange={(e) => setRaw(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") writeRaw(); }} />
            <button type="button" onClick={writeRaw}>Write</button>
          </div>
        </Panel>

        <Panel title="Immediate Hardware Effect" icon="bolt" className="g-scope">
          <div className="mcl-g2-mat">
            <svg viewBox="0 0 470 190" className="mcl-svg" role="img" aria-label="STM32 with LEDs on PA5 and PA6 and a switch on PA0">
              <HwDefs id="l14" />
              <BenchChip y={24} h={140} pins={[
                { key: "PA5", y: 52, level: mcu.pin("PA5").level, tag: MODES[field("MODER", 5)]![0], selected: pin === 5, onSelect: () => setPin(5) },
                { key: "PA6", y: 72, level: mcu.pin("PA6").level, tag: MODES[field("MODER", 6)]![0], selected: pin === 6, onSelect: () => setPin(6) },
                { key: "PA0", y: 110, level: mcu.isFloating("PA0") ? -1 : mcu.pin("PA0").level, tag: MODES[field("MODER", 0)]![0], selected: pin === 0, onSelect: () => setPin(0) },
                { key: "PA13", y: 136, level: swdLost ? -1 : 1, tag: swdLost ? "!" : "SWD" },
              ]} />
              <Breadboard x={290} y={24} w={168} h={140} cols={12} rows={7} />
              <Wire d={`M250 52 C 280 52, 300 ${params.miswired ? 92 : 62}, 330 ${params.miswired ? 92 : 62}`} color="#ef4444" live={redOn} />
              <Wire d="M250 72 C 290 72, 340 92, 380 92" color="#16a34a" live={greenOn || (params.miswired && redOn)} />
              <Wire d="M250 110 C 285 110, 300 134, 330 134" color="#2563eb" live={params.sw} />
              <SvgLed x={340} y={50} r={9} on={redOn} color="red" id="l14" />
              <text x={340} y={76} textAnchor="middle" fontSize="7.5" fill="#4b6283">LED {params.miswired ? "(on PA6!)" : "PA5"}</text>
              <SvgLed x={392} y={50} r={8} on={greenOn} color="green" id="l14" />
              <text x={392} y={76} textAnchor="middle" fontSize="7.5" fill="#4b6283">PA6</text>
              <g className="mcl-l14-switch" role="switch" aria-checked={params.sw} aria-label="PA0 switch" tabIndex={0} onClick={() => lab.setParam("sw", !params.sw)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); lab.setParam("sw", !params.sw); } }}>
                <rect x={332} y={124} width={40} height={20} rx={10} fill={params.sw ? "#1677ff" : "#94a3b8"} />
                <circle cx={params.sw ? 362 : 342} cy={134} r={8} fill="#fff" />
                <text x={352} y={158} textAnchor="middle" fontSize="7.5" fill="#4b6283">SW → 3V3</text>
              </g>
              {!clockOn ? <text x={140} y={180} textAnchor="middle" fontSize="9" fontWeight="700" fill="#b42318">GPIOA unclocked: writes are ignored</text> : null}
            </svg>
          </div>
        </Panel>

        <CodeEditor lab={lab} className="g-code" languages={[{ label: "BSRR + IDR", code: BSRR_DEMO }, { label: "ODR read-modify-write", code: RMW_DEMO }, { label: "Bug: MODER =", code: SWD_BUG }]} />

        <div className="g-tasks mcl-l13-side">
          <Panel title="Register Trace" icon="activity" tools={
            <div className="mcl-l14-tools">
              <button type="button" onClick={restart}>Restart</button>
              <button type="button" className="go" onClick={nextWrite}><Icon name="target" size={13} />Next write</button>
              <button type="button" onClick={cont} disabled={lab.running && !paused}>Continue</button>
              <button type="button" onClick={() => { tr.entries.length = 0; lab.advance(0); }}>Clear</button>
            </div>
          }>
            {tr.entries.length ? (
              <div className="mcl-l14-trace">
                <table className="mcl-table">
                  <thead><tr><th>t</th><th>From</th><th>Register</th><th>Value</th><th>Effect</th></tr></thead>
                  <tbody>
                    {tr.entries.slice(0, 40).map((e) => (
                      <tr key={e.id} className={e.ignored ? "bad" : e.src === "editor" ? "ed" : ""}>
                        <td className="mcl-mono">{(e.t * 1000).toFixed(e.t < 1 ? 2 : 0)} ms</td>
                        <td>{e.src === "editor" ? "editor" : `line ${e.line}`}</td>
                        <td className="mcl-mono">{e.path.replace(".", "->")}</td>
                        <td className="mcl-mono">{hex(e.value)}</td>
                        <td>{e.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="mcl-l14-empty">Edit a bit field or press Next write to execute the firmware one register write at a time. The LED, pin state and register table update from the same runtime state.</p>}
            <div className="mcl-g2-faults">
              <b><Icon name="bug" size={14} />Fault injection</b>
              <Toggle label="GPIOA clock gate stuck off" checked={params.clockOff} onChange={(v) => lab.setParam("clockOff", v)} hint="RCC->AHB1ENR can be set but the port never receives a clock, so every GPIOA write is dropped" />
              <Toggle label="Red LED miswired to PA6" checked={params.miswired} onChange={(v) => lab.setParam("miswired", v)} hint="The registers say PA5 is high, yet the LED stays dark: trust the trace, then check the wiring" />
            </div>
          </Panel>
          <LearningNotes variant="tasks" title="Learning Tasks" notes={{
            takeaways: [],
            observe: "Press Restart in the trace, then Next write four times: clock on, MODER5 = 01, BS5, BR5. Watch the LED follow each write.",
            tryIt: "Pick MODER and PA6, choose 01 Output, then set ODR6 by clicking its cell: the green LED lights.",
            measure: `MODER = ${hex(mcu.peek("GPIOA.MODER"))}: PA5 is ${MODES[field("MODER", 5)]}, PA13/PA14 are ${swdLost ? "NOT " : ""}in AF mode.`,
            modify: "Load \"Bug: MODER =\" and Run. Compare MODER before and after, and read the SWD warning.",
            runAgain: "Fix the bug with a read-modify-write (&= ~mask, then |=) and Run again.",
            challenge: "Why is BSRR safer than ODR ^= when an interrupt also writes the same port?",
            checks: [
              { label: "Stepped through 4 register writes", done: seen.steps >= 4 },
              { label: "Changed a MODER field from the editor", done: seen.moder },
              { label: "Lit the LED with an editor BSRR write", done: seen.bsrr },
              { label: "Reproduced the SWD-pin bug", done: swdSeen },
            ],
          }} />
        </div>
      </div>
    </LabShell>
  );
}
