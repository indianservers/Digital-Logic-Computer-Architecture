import { useEffect, useState, type ReactNode } from "react";
import { useLab } from "../core/useLab";
import type { LabMeta } from "../registry";
import { CodeEditor } from "../ui/CodeEditor";
import { Icon } from "../ui/Icon";
import { Panel, Toggle } from "../ui/Panels";
import { LabShell } from "../ui/Shell";
import { NumIn } from "./NumIn";
import {
  AMPS, BUG_ACD, BUG_NO_SEI, DEMO, expectedDuty, FREQS, front, levelAt, P28_DEFAULT, PINS, POLLING, refAt, RISING, SPANS, WAVES, world28,
  type Board, type Front, type P28, type Wave,
} from "./L28sim";

const VARIANTS = [DEMO, RISING, POLLING, BUG_NO_SEI, BUG_ACD];

function Plot({ f, now, span, led, p }: { f: Front; now: number; span: number; led: ReadonlyArray<readonly [number, number]>; p: P28 }) {
  const pw = 640, l = 46, r = 12, w = pw - l - r;
  const at = 26, ah = 196, dt0 = at + ah + 30, lane = 26, dh = lane * 2 + 18, ph = dt0 + dh + 30;
  const S = span / 1000, start = now - S;
  const X = (t: number) => l + ((Math.max(start, Math.min(now, t)) - start) / S) * w;
  const YA = (v: number) => at + ah - (Math.max(0, Math.min(5, v)) / 5) * ah;
  const pts = f.trace.filter(([t]) => t >= start && t <= now);
  const k = Math.max(1, Math.ceil(pts.length / 1400));
  let vin = "", ref = "";
  for (let i = 0; i < pts.length; i += k) { const [t, v, rv] = pts[i]!; vin += `${i ? "L" : "M"}${X(t).toFixed(1)} ${YA(v).toFixed(1)}`; ref += `${i ? "L" : "M"}${X(t).toFixed(1)} ${YA(rv).toFixed(1)}`; }
  const band = p.hyst > 0 && !p.refOpen;
  const steps = (log: ReadonlyArray<readonly [number, number]>, y1: number, y0: number) => {
    let lv = levelAt(log, start);
    let d = `M${l} ${lv ? y1 : y0}`;
    for (const [t, v] of log) { if (t <= start || t > now) continue; d += ` L${X(t).toFixed(1)} ${lv ? y1 : y0} L${X(t).toFixed(1)} ${v ? y1 : y0}`; lv = v; }
    return `${d} L${l + w} ${lv ? y1 : y0}`;
  };
  const cross = f.edges.filter(([t]) => t > start && t <= now);
  const ticks = Array.from({ length: 6 }, (_, i) => (span / 5) * i);
  const c1 = dt0 + 4, c0 = dt0 + lane, l1 = dt0 + lane + 18, l0 = dt0 + lane * 2 + 10;
  return (
    <svg viewBox={`0 0 ${pw} ${ph}`} className="mcl-l28-plot" role="img" aria-label={`Comparator input and output over the last ${span} ms, ${cross.length} output transitions`}>
      <g className="mcl-l28-legend" fontSize="10" fill="#33496b">
        <line x1={150} x2={172} y1={10} y2={10} stroke="#1677ff" strokeWidth={2} /><text x={177} y={13}>Input Voltage (Vin)</text>
        <line x1={292} x2={314} y1={10} y2={10} stroke="#e5484d" strokeWidth={2} strokeDasharray="5 3" /><text x={319} y={13}>Reference (Vref)</text>
        <line x1={420} x2={442} y1={10} y2={10} stroke="#16a34a" strokeWidth={2.4} /><text x={447} y={13}>Comparator Output</text>
        <line x1={556} x2={578} y1={10} y2={10} stroke="#f59e0b" strokeWidth={2} /><text x={583} y={13}>LED PB0</text>
      </g>
      {[0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map((v) => <g key={v}><line x1={l} x2={l + w} y1={YA(v)} y2={YA(v)} stroke="#edf2f8" /><text x={l - 6} y={YA(v) + 3} textAnchor="end" fontSize="9" fill="#64748b">{v.toFixed(1)}</text></g>)}
      {ticks.map((ms) => <line key={ms} x1={l + (ms / span) * w} x2={l + (ms / span) * w} y1={at} y2={at + ah} stroke="#f1f5fa" />)}
      <rect x={l} y={at} width={w} height={ah} fill="none" stroke="#cbd5e1" />
      <text x={12} y={at + ah / 2} textAnchor="middle" fontSize="9.5" fill="#33496b" transform={`rotate(-90 12 ${at + ah / 2})`}>Voltage (V)</text>
      {band ? <rect x={l} y={YA(p.vref + p.hyst / 2)} width={w} height={Math.max(0.5, YA(p.vref - p.hyst / 2) - YA(p.vref + p.hyst / 2))} fill="#e5484d" opacity={0.1} /> : null}
      {cross.length <= 60 ? cross.map(([t]) => <line key={t} x1={X(t)} x2={X(t)} y1={at} y2={l0} stroke="#94a3b8" strokeDasharray="3 3" strokeWidth={0.8} />) : null}
      <path d={ref} fill="none" stroke="#e5484d" strokeWidth={1.6} strokeDasharray="6 4" />
      <path d={vin} fill="none" stroke="#1677ff" strokeWidth={1.3} strokeLinejoin="round" />
      <rect x={l} y={dt0} width={w} height={dh} fill="#fbfdff" stroke="#cbd5e1" />
      <text x={l - 6} y={c1 + 3} textAnchor="end" fontSize="9" fill="#33496b">HIGH (5V)</text>
      <text x={l - 6} y={c0 + 3} textAnchor="end" fontSize="9" fill="#33496b">LOW (0V)</text>
      <text x={l - 6} y={(l1 + l0) / 2 + 3} textAnchor="end" fontSize="8.5" fill="#b45309">LED</text>
      <line x1={l} x2={l + w} y1={(c0 + l1) / 2} y2={(c0 + l1) / 2} stroke="#e8eef6" />
      <path d={steps(f.edges, c1, c0)} fill="none" stroke="#16a34a" strokeWidth={2.2} />
      <path d={steps(led, l1, l0)} fill="none" stroke="#f59e0b" strokeWidth={1.8} />
      {ticks.map((ms) => <text key={ms} x={l + (ms / span) * w} y={dt0 + dh + 13} textAnchor="middle" fontSize="9" fill="#64748b">{Math.round(ms)}</text>)}
      <text x={l + w / 2} y={ph - 3} textAnchor="middle" fontSize="9.5" fill="#33496b">Time (ms)</text>
      {!pts.length ? <text x={l + w / 2} y={at + ah / 2} textAnchor="middle" fontSize="11" fill="#94a3b8">Press Run to start the simulation.</text> : null}
    </svg>
  );
}

function Block({ vin, ref, out, off }: { vin: number; ref: number; out: number; off: boolean }) {
  return (
    <svg viewBox="0 0 270 130" className="mcl-l28-block" role="img" aria-label={`Comparator: Vin ${vin.toFixed(2)} V, Vref ${ref.toFixed(2)} V, output ${off ? "off" : out ? "high" : "low"}`}>
      <path d="M118 22 L118 108 L188 65 Z" fill="#fff" stroke="#0f2547" strokeWidth={1.8} strokeLinejoin="round" />
      <text x={126} y={48} fontSize="15" fontWeight="700" fill="#0f2547">+</text>
      <text x={127} y={93} fontSize="15" fontWeight="700" fill="#0f2547">−</text>
      <line x1={60} x2={118} y1={44} y2={44} stroke="#1677ff" strokeWidth={1.6} />
      <line x1={60} x2={118} y1={88} y2={88} stroke="#e5484d" strokeWidth={1.6} />
      <circle cx={60} cy={44} r={4.5} fill="#1677ff" /><circle cx={60} cy={88} r={4.5} fill="#e5484d" />
      <text x={6} y={34} fontSize="10" fontWeight="600" fill="#0f2547">Vin</text>
      <text x={6} y={46} fontSize="8.5" fill="#5c7190">AIN0 / PD6</text>
      <text x={6} y={58} fontSize="9" fontWeight="700" fill="#1677ff">{vin.toFixed(2)} V</text>
      <text x={6} y={84} fontSize="10" fontWeight="600" fill="#0f2547">Vref</text>
      <text x={6} y={96} fontSize="8.5" fill="#5c7190">AIN1 / PD7</text>
      <text x={6} y={108} fontSize="9" fontWeight="700" fill="#e5484d">{ref.toFixed(2)} V</text>
      <line x1={188} x2={214} y1={65} y2={65} stroke={off ? "#94a3b8" : "#16a34a"} strokeWidth={1.6} />
      <circle cx={214} cy={65} r={4.5} fill={off ? "#cbd5e1" : out ? "#16a34a" : "#bbf7d0"} stroke="#15803d" strokeWidth={0.8} />
      <text x={222} y={46} fontSize="9.5" fontWeight="600" fill="#0f2547">Digital</text>
      <text x={222} y={57} fontSize="9.5" fontWeight="600" fill="#0f2547">Output</text>
      <text x={222} y={69} fontSize="8.5" fill="#5c7190">(ACO)</text>
      <text x={222} y={84} fontSize="9.5" fontWeight="800" fill={off ? "#94a3b8" : out ? "#15803d" : "#64748b"}>{off ? "OFF" : out ? "1" : "0"}</text>
    </svg>
  );
}

function Slider({ label, value, min, max, step, unit = "V", onChange, sub, title }: { label: string; value: number; min: number; max: number; step: number; unit?: string; onChange: (v: number) => void; sub?: ReactNode; title?: string }) {
  const snap = (v: number) => Math.round(Math.max(min, Math.min(max, v)) / step) * step;
  return (
    <div className="mcl-l28-field" title={title}>
      <div className="mcl-l28-row">
        <span>{label}{title ? <i className="mcl-l28-q" aria-label={title}>?</i> : null}</span>
        <NumIn value={Number(value.toFixed(2))} min={min} max={max} step={step} label={`${label} value`} width={66} onCommit={(v) => onChange(Number(snap(v).toFixed(2)))} />
        <small>{unit}</small>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} aria-label={label} onChange={(e) => onChange(Number(e.target.value))} />
      {sub ? <div className="mcl-l28-subrow">{sub}</div> : null}
    </div>
  );
}

type NTab = "overview" | "threshold" | "irq" | "try";
const NO_SEEN = { switching: false, duty: false, chatter: false, fixed: false, variant: false, fault: false };

export default function L28({ meta }: { meta: LabMeta }) {
  const lab = useLab<P28>({
    slug: meta.slug, code: DEMO, params: P28_DEFAULT,
    mcu: () => ({ family: "avr" }),
    world: world28,
  });
  const { mcu, params: p } = lab;
  const fw = mcu.fw;
  const f = front(mcu);
  const [tab, setTab] = useState<NTab>("overview");
  const now = mcu.now;
  const S = p.span / 1000;
  const last = f.trace[f.trace.length - 1];
  const vinNow = last ? last[1] : 0;
  const refNow = last ? last[2] : refAt(p, now);
  const acsr = mcu.peek("ACSR");
  const off = (acsr & 0x80) !== 0;
  const out = mcu.acOut;
  const led = mcu.edges.get("PB0") ?? [];
  const ledOn = levelAt(led, now) === 1;
  const inWin = f.edges.filter(([t]) => t > now - S && t <= now);
  const irqTotal = mcu.irqCount.get("ANALOG_COMP") ?? 0;
  const fwEdges = fw ? fw.num("edges", -1) : -1;
  const running = lab.running && !!fw && f.trace.length > 10;

  let highTime = 0;
  if (running) { let lv = levelAt(f.edges, now - S); let tPrev = now - S; for (const [t, v] of inWin) { if (lv) highTime += t - tPrev; lv = v; tPrev = t; } if (lv) highTime += now - tPrev; }
  const duty = running ? highTime / S : 0;
  const expDuty = expectedDuty(p);
  const cycles = p.wave === "dc" ? 0 : p.freq * S;
  const expectedEdges = cycles * 2;
  const chatter = running && p.wave !== "dc" && inWin.length > Math.max(6, expectedEdges * 1.8 + 2);
  const lo = p.wave === "dc" ? p.vin : p.vin - p.amp, hi = p.wave === "dc" ? p.vin : p.vin + p.amp;
  const noCross = running && p.wave !== "dc" && !p.refOpen && (p.vref - p.hyst / 2 > hi || p.vref + p.hyst / 2 < lo);
  const clipped = p.wave !== "dc" && (hi > 5 || lo < 0);
  const noSei = running && !!fw && !fw.globalIrqEnabled && (acsr & 0x08) !== 0 && (acsr & 0x10) !== 0;
  const missed = running && fwEdges >= 0 && !fw?.hasFunction("ISR_ANALOG_COMP_vect") && f.count > 10 && fwEdges < f.count * 0.6;

  const [seen, setSeen] = useState(NO_SEEN);
  const flags = {
    switching: running && inWin.length >= 2 && !off,
    duty: running && Math.abs(p.vref - 2.5) > 0.3 && inWin.length >= 2,
    chatter: running && chatter && p.hyst < 0.05,
    fixed: running && seen.chatter && !chatter && p.hyst >= 0.05 && p.noise >= 0.05 && inWin.length >= 2,
    variant: running && (lab.compiledCode === RISING || lab.compiledCode === POLLING),
    fault: running && (p.refOpen || p.hum),
  };
  useEffect(() => {
    if ((Object.keys(flags) as Array<keyof typeof flags>).some((k) => flags[k] && !seen[k]))
      setSeen((o) => ({ switching: o.switching || flags.switching, duty: o.duty || flags.duty, chatter: o.chatter || flags.chatter, fixed: o.fixed || flags.fixed, variant: o.variant || flags.variant, fault: o.fault || flags.fault }));
  });
  const shellLab = { ...lab, resetLab: () => { lab.resetLab(); setTab("overview"); setSeen(NO_SEEN); } };

  const pins = PINS[p.board];
  const waveLabel = WAVES.find((w) => w.v === p.wave)?.label ?? "Sine Wave";
  const bit = (b: number) => (acsr >> b) & 1;
  const mode = acsr & 3;
  const modeText = ["Toggle (both edges)", "Reserved", "Falling edge", "Rising edge"][mode]!;
  const custom = running && !VARIANTS.includes(lab.compiledCode);

  return (
    <LabShell meta={meta} lab={shellLab} subtitle="Detect when an analog signal crosses a reference threshold"
      components={["ATmega328P (Arduino Uno) at 16 MHz", "Signal generator on AIN0 / PD6 (Arduino D6)", "Reference divider on AIN1 / PD7 (Arduino D7)", "LED with 220 Ω on PB0 (Arduino D8)"]}>
      <div className="mcl-grid mcl-l28-top">
        <Panel title="Analog Comparator Simulator" icon="activity" className="mcl-l28-sim">
          <Plot f={f} now={now} span={p.span} led={led} p={p} />
          {chatter ? <p className="mcl-g2-hint"><Icon name="alert" size={14} />{inWin.length} output transitions in {p.span} ms where a clean signal gives about {Math.round(expectedEdges)}: noise is making the output chatter near Vref. Add hysteresis.</p> : null}
          {noCross ? <p className="mcl-g2-hint"><Icon name="alert" size={14} />Vin stays between {Math.max(0, lo).toFixed(2)} V and {Math.min(5, hi).toFixed(2)} V and never crosses the threshold band at {p.vref.toFixed(2)} V, so the output never switches.</p> : null}
          {clipped ? <p className="mcl-l28-sub">The input is clipped to the 0 – 5 V supply rails (offset ± amplitude goes beyond them).</p> : null}
        </Panel>

        <div className="mcl-l28-mid">
          <Panel title="Comparator Block Diagram" className="mcl-l28-blk">
            <Block vin={vinNow} ref={refNow} out={out} off={off} />
          </Panel>
          <Panel title="Live Status" className="mcl-l28-status">
            <div className={`mcl-l28-out ${off ? "off" : out ? "hi" : "lo"}`}><i />Output: <b>{off ? "OFF (ACD = 1)" : out ? "HIGH" : "LOW"}</b></div>
            <dl className="mcl-l28-kv">
              <div><dt>Vin:</dt><dd>{vinNow.toFixed(2)} V</dd></div>
              <div><dt>Vref:</dt><dd>{refNow.toFixed(2)} V</dd></div>
              <div><dt>State:</dt><dd className="mono">{off ? "comparator off" : out ? "Vin > Vref" : "Vin < Vref"}</dd></div>
              <div><dt>Edges:</dt><dd>{inWin.length} in {p.span} ms</dd></div>
              <div><dt>IRQs:</dt><dd>{irqTotal} requested{fwEdges >= 0 ? ` · edges = ${fwEdges}` : ""}</dd></div>
              <div><dt>LED PB0:</dt><dd className={ledOn ? "on" : ""}>{ledOn ? "ON" : "OFF"}</dd></div>
            </dl>
          </Panel>
        </div>

        <Panel title="Simulation Controls" icon="sliders" className="mcl-l28-ctl">
          <Slider label={p.wave === "dc" ? "Input Voltage (DC)" : `Input Offset (${waveLabel})`} value={p.vin} min={0} max={5} step={0.01} onChange={(v) => lab.setParam("vin", v)}
            sub={p.wave === "dc" ? <span>Drag across Vref to switch the output</span> : (
              <>
                <label>Amplitude<select value={p.amp} onChange={(e) => lab.setParam("amp", Number(e.target.value))} aria-label="Amplitude">{AMPS.map((a) => <option key={a} value={a}>{a.toFixed(1)} V</option>)}</select></label>
                <span>Offset: {p.vin.toFixed(1)} V</span>
                <label>Freq<select value={p.freq} onChange={(e) => lab.setParam("freq", Number(e.target.value))} aria-label="Frequency">{FREQS.map((x) => <option key={x} value={x}>{x} Hz</option>)}</select></label>
              </>
            )} />
          <Slider label="Reference Threshold (Vref)" value={p.vref} min={0} max={5} step={0.01} onChange={(v) => lab.setParam("vref", v)} />
          <Slider label="Hysteresis (Schmitt Trigger)" value={p.hyst} min={0} max={1} step={0.01} onChange={(v) => lab.setParam("hyst", v)}
            title="The ATmega328P comparator has almost no built-in hysteresis; real circuits add it with a positive-feedback resistor. Here it is modelled as an ideal ±H/2 window around Vref." />
          <Slider label="Noise (RMS)" value={p.noise} min={0} max={0.5} step={0.01} onChange={(v) => lab.setParam("noise", v)} />
          <div className="mcl-l28-pair">
            <label className="mcl-l28-field"><span>Waveform Type</span>
              <select value={p.wave} onChange={(e) => lab.setParam("wave", e.target.value as Wave)} aria-label="Waveform type">{WAVES.map((w) => <option key={w.v} value={w.v}>{w.label}</option>)}</select></label>
            <label className="mcl-l28-field"><span>Time Scale</span>
              <select value={p.span} onChange={(e) => lab.setParam("span", Number(e.target.value))} aria-label="Time scale">{SPANS.map((s) => <option key={s} value={s}>{s} ms</option>)}</select></label>
          </div>
          <div className="mcl-g2-faults">
            <b><Icon name="bug" size={14} />Fault injection</b>
            <Toggle label="AIN1 wire open (Vref floats)" checked={p.refOpen} onChange={(v) => lab.setParam("refOpen", v)} hint="A floating input wanders and picks up 50 Hz hum: the threshold moves and the output switches at random points" />
            <Toggle label="50 Hz hum on the input (0.4 V)" checked={p.hum} onChange={(v) => lab.setParam("hum", v)} hint="Mains pickup on the signal wire shifts every crossing" />
          </div>
        </Panel>
      </div>

      <div className="mcl-grid mcl-l28-bot">
        <CodeEditor lab={lab} languages={[{ label: "C (AVR)", code: DEMO }, { label: "Rising edge toggle", code: RISING }, { label: "Polling ACO", code: POLLING }, { label: "Bug: no sei()", code: BUG_NO_SEI }, { label: "Bug: ACD set", code: BUG_ACD }]} />

        <Panel title="Hardware Mapping" icon="chip" className="mcl-l28-map">
          <label className="mcl-l28-board"><span>Target Board:</span>
            <select value={p.board} onChange={(e) => lab.setParam("board", e.target.value as Board)} aria-label="Target board">
              {(Object.keys(PINS) as Board[]).map((b) => <option key={b} value={b}>{PINS[b].boardName}</option>)}
            </select></label>
          <table className="mcl-l22-table mcl-l28-table">
            <thead><tr><th>Signal</th><th>MCU Pin</th><th>{pins.col}</th><th>Description</th></tr></thead>
            <tbody>
              <tr><td>Vin (AIN0)</td><td>PD6</td><td>{pins.ain0}</td><td>Analog input (+)</td></tr>
              <tr><td>Vref (AIN1)</td><td>PD7</td><td>{pins.ain1}</td><td>Analog input (−){p.refOpen ? " · open!" : ""}</td></tr>
              <tr><td>AC0 Output</td><td>Internal</td><td>—</td><td>ACSR.ACO = {off ? 0 : out}</td></tr>
              <tr><td>Interrupt</td><td>ANALOG_COMP_vect</td><td>—</td><td>ISR vector · {irqTotal} requests</td></tr>
              <tr><td>LED (Demo)</td><td>PB0</td><td>{pins.led}</td><td><i className={`mcl-l28-dot ${ledOn ? "on" : ""}`} />{ledOn ? "On" : "Off"}</td></tr>
            </tbody>
          </table>
          <p className="mcl-l28-tip"><Icon name="bulb" size={15} /><span><b>Tip:</b> On ATmega328P, the analog comparator can generate an interrupt on output change. Use ACSR to configure the interrupt mode (rising, falling, or toggle). Setting ACME in ADCSRB lets an ADC pin (A0 – A7) replace AIN1.</span></p>
        </Panel>

        <Panel title="Learning Notes" icon="book" className="mcl-l28-notes">
          <div className="mcl-tabs mcl-l28-tabs" role="tablist">
            {([["overview", "Overview"], ["threshold", "Threshold Detection"], ["irq", "Interrupts"], ["try", "Try This"]] as const).map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>)}
          </div>
          {noSei ? <p className="mcl-g2-hint"><Icon name="alert" size={14} />ACI is set and ACIE is on, but the global interrupt flag (SREG.I) is clear: ANALOG_COMP_vect never runs. Call sei() after configuring ACSR.</p> : null}
          {running && off ? <p className="mcl-g2-hint"><Icon name="alert" size={14} />ACSR.ACD = 1 powers the comparator down: ACO reads 0 and no interrupts fire. Clear ACD.</p> : null}
          {missed ? <p className="mcl-g2-hint"><Icon name="alert" size={14} />The polling loop counted {fwEdges} edges but the comparator switched {f.count} times: output pulses shorter than the 4 ms loop are missed. Use the interrupt.</p> : null}

          {tab === "overview" ? (
            <div className="mcl-l28-learn">
              <h3>What is an Analog Comparator?</h3>
              <p>An analog comparator compares two analog voltages and produces a digital output. When the input voltage (Vin) is higher or lower than the reference voltage (Vref), the output switches state (HIGH or LOW).</p>
              <h4>Key Concepts</h4>
              <ul>
                <li><b>Threshold detection:</b> Output changes when Vin crosses Vref.</li>
                <li><b>Hysteresis:</b> Adds a small margin to prevent noise-induced chattering (Schmitt trigger).</li>
                <li><b>Interrupts:</b> The comparator can trigger an interrupt on output change for fast, responsive detection.</li>
                <li><b>Applications:</b> Zero-crossing detection, level sensing, window comparators, and more.</li>
              </ul>
              <p className="mcl-l28-ok"><Icon name="check" size={15} />You're on Lab 28! Explore how comparators can make your projects more responsive and efficient.</p>
            </div>
          ) : null}

          {tab === "threshold" ? (
            <div className="mcl-l28-learn">
              <div className="mcl-l28-eq">ACO = 1 when V<sub>AIN0</sub> &gt; V<sub>AIN1</sub></div>
              <p>With hysteresis H, the output goes HIGH above V<sub>ref</sub> + H/2 and only returns LOW below V<sub>ref</sub> − H/2. Inside that window it keeps its last state, so noise smaller than H cannot flip it.</p>
              <dl className="mcl-l28-fx">
                <div><dt>Thresholds</dt><dd>rise at {(p.vref + p.hyst / 2).toFixed(2)} V · fall at {(p.vref - p.hyst / 2).toFixed(2)} V</dd></div>
                <div><dt>Input range</dt><dd>{Math.max(0, lo).toFixed(2)} – {Math.min(5, hi).toFixed(2)} V{p.wave === "dc" ? " (DC)" : ` · ${p.freq} Hz ${waveLabel.toLowerCase()}`}</dd></div>
                <div><dt>Duty (HIGH)</dt><dd>{running ? `${(duty * 100).toFixed(1)} % measured` : "-"}{expDuty !== null ? ` · ${(expDuty * 100).toFixed(1)} % expected without noise` : ""}</dd></div>
                <div><dt>Edges</dt><dd>{inWin.length} in {p.span} ms{p.wave !== "dc" ? ` · ${Math.round(expectedEdges)} for a clean signal` : ""}</dd></div>
              </dl>
              <p className="mcl-l28-sub">Raising Vref shortens the HIGH part of each cycle; for a sine the HIGH fraction is acos((Vref − offset) / amplitude) / π.</p>
            </div>
          ) : null}

          {tab === "irq" ? (
            <div className="mcl-l28-learn">
              <table className="mcl-l22-table mcl-l28-bits">
                <thead><tr><th colSpan={8}>ACSR = 0x{acsr.toString(16).toUpperCase().padStart(2, "0")}</th></tr><tr>{["ACD", "ACBG", "ACO", "ACI", "ACIE", "ACIC", "ACIS1", "ACIS0"].map((b) => <th key={b}>{b}</th>)}</tr></thead>
                <tbody><tr>{[7, 6, 5, 4, 3, 2, 1, 0].map((b) => <td key={b} className={bit(b) ? "on" : ""}>{bit(b)}</td>)}</tr></tbody>
              </table>
              <dl className="mcl-l28-fx">
                <div><dt>Mode</dt><dd>ACIS1:0 = {(mode >> 1) & 1}{mode & 1} → {modeText}</dd></div>
                <div><dt>Enabled</dt><dd>ACIE = {bit(3)} · SREG.I = {fw?.globalIrqEnabled ? 1 : 0}</dd></div>
                <div><dt>Requests</dt><dd>{irqTotal} total{fwEdges >= 0 ? ` · the ISR counted ${fwEdges}` : ""} · {f.count} comparator edges since Run</dd></div>
              </dl>
              <p>ACI is set by hardware on the selected edge and cleared when the vector runs (or by writing a 1 to it). With ACIS = 11 the LED toggles once per cycle; with 00 the ISR runs on both edges and can copy ACO to the pin.</p>
            </div>
          ) : null}

          {tab === "try" ? (
            <div className="mcl-l28-learn">
              <ol className="mcl-steps">
                {([
                  ["Observe", "Run the example: a 100 Hz sine from 0.5 to 4.5 V against 2.5 V switches the output twice per cycle and the LED follows it."],
                  ["Try", "Move Vref up to 3.5 V: the HIGH part of each cycle shrinks to about a third."],
                  ["Measure", `Now: ${inWin.length} edges in ${p.span} ms, HIGH ${running ? (duty * 100).toFixed(1) : "-"} %, ${irqTotal} interrupt requests.`],
                  ["Modify", "Set hysteresis to 0 and noise to 0.15 V: watch the chatter, then raise hysteresis until it stops."],
                  ["Run Again", "Load Rising edge toggle, Polling ACO and the two bug examples; read the hints, fix the code and Run again."],
                ] as const).map(([k, v]) => <li key={k}><b>{k}</b><span>{v}</span></li>)}
              </ol>
              <ul className="mcl-checks">
                {([
                  ["Watched the output switch at the crossings", seen.switching], ["Changed Vref to change the duty", seen.duty], ["Made the output chatter with noise", seen.chatter],
                  ["Stopped the chatter with hysteresis", seen.fixed], ["Ran the rising-edge or polling version", seen.variant], ["Reproduced an input fault", seen.fault],
                ] as const).map(([l, d]) => <li key={l} className={d ? "done" : ""}><Icon name={d ? "check" : "target"} size={14} />{l}</li>)}
              </ul>
              {custom ? <p className="mcl-l28-sub">Running your own version of the program.</p> : null}
              <p className="mcl-challenge"><b>Challenge:</b> Build a window comparator: use ACME to switch AIN1 between two ADC pins and light the LED only while Vin is between them.</p>
            </div>
          ) : null}
        </Panel>
      </div>
    </LabShell>
  );
}
