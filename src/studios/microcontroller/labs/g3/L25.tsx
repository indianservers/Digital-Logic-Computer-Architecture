import { useEffect, useRef, useState } from "react";
import { useLab } from "../core/useLab";
import type { LabMeta } from "../registry";
import { CodeEditor } from "../ui/CodeEditor";
import { HwDefs, NucleoBoard, Potentiometer, Wire } from "../ui/Hardware";
import { Icon } from "../ui/Icon";
import { Panel, Seg, Toggle } from "../ui/Panels";
import { LabShell } from "../ui/Shell";
import { NumIn } from "./NumIn";
import {
  adc, AVERAGE, CHANNELS, codeVal, DEMO, idealCode, NO_REINIT, P25_DEFAULT, RATES, resBits, resValue, setCodeVal, VREFS, world25, WRONG_SCALE,
  type Adc25, type CodeKey, type P25, type Source,
} from "./L25sim";

const W = 500, H = 400;
const BX = 170, BY = 24, BS = 1.05;
/** CN6 power header and the CN8 analog header drawn below it, in scene units. */
const PIN = { x: BX + 25.3 * BS, v33: BY + 141.1 * BS, v5: BY + 147.7 * BS, gnd: BY + 154.3 * BS, a0: BY + 187.3 * BS };
const POT = { x: 70, y: 190 };
const LEG = [POT.x - 12, POT.x, POT.x + 12] as const;
const LEG_END = POT.y + 50;
const FREQS = [1, 2, 5, 10, 25, 50, 120];
const BITS = [12, 10, 8, 6];
const CH_PIN: Record<number, number> = { 0: 0, 1: 1, 16: 2, 17: 3 };

/** Orthogonal polyline with rounded corners. */
function poly(pts: Array<[number, number]>, r = 6) {
  let d = `M${pts[0]![0]} ${pts[0]![1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i - 1]!, [cx, cy] = pts[i]!, [nx, ny] = pts[i + 1]!;
    const l1 = Math.hypot(cx - px, cy - py), l2 = Math.hypot(nx - cx, ny - cy);
    const k = Math.min(r, l1 / 2, l2 / 2);
    d += ` L${cx - ((cx - px) / l1) * k} ${cy - ((cy - py) / l1) * k} Q${cx} ${cy} ${cx + ((nx - cx) / l2) * k} ${cy + ((ny - cy) / l2) * k}`;
  }
  const last = pts[pts.length - 1]!;
  return `${d} L${last[0]} ${last[1]}`;
}

const groupBits = (code: number, bits: number) => {
  const s = Math.max(0, Math.round(code)).toString(2).padStart(bits, "0").slice(-Math.max(bits, 1));
  const out: string[] = [];
  for (let i = s.length; i > 0; i -= 4) out.unshift(s.slice(Math.max(0, i - 4), i));
  return out.join(" ");
};

function Scene({ p, a, running, hasFw, onPot }: { p: P25; a: Adc25; running: boolean; hasFw: boolean; onPot: (v: number) => void }) {
  const supply = p.fiveVolt ? 5 : 3.3;
  const top = p.fiveVolt ? PIN.v5 : PIN.v33;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mcl-svg mcl-l25-scene" role="img" aria-label={`Potentiometer wiper on PA0 of a Nucleo board, ${a.vin.toFixed(2)} volts`}>
      <HwDefs id="l25" />
      <text x={POT.x} y={POT.y - 50} textAnchor="middle" fontSize="11" fontWeight="700" fill="#0f2547">Potentiometer</text>
      <text x={POT.x} y={POT.y - 37} textAnchor="middle" fontSize="10" fill="#33496b">(0 – {supply} V)</text>
      {LEG.map((x) => <rect key={x} x={x - 1.6} y={POT.y + 22} width={3.2} height={LEG_END - POT.y - 21} rx={1} fill="#b8c0c8" stroke="#7d8790" strokeWidth={0.5} />)}
      <Potentiometer x={POT.x} y={POT.y} r={24} value={Math.min(1, p.pot / 3.3)} onChange={onPot} label="" />
      <Wire d={poly([[LEG[0], LEG_END], [LEG[0], 300], [150, 300], [150, top], [PIN.x, top]])} color="#dc2626" width={2.8} />
      <Wire d={poly([[LEG[2], LEG_END], [LEG[2], 262], [128, 262], [128, PIN.gnd], [PIN.x, PIN.gnd]])} color="#1f2937" width={2.8} />
      {p.open ? (
        <>
          <Wire d={poly([[LEG[1], LEG_END], [LEG[1], 280], [96, 280]])} color="#93c5fd" width={2.8} />
          <Wire d={poly([[112, 280], [139, 280], [139, PIN.a0], [PIN.x, PIN.a0]])} color="#2563eb" width={2.8} />
          <text x={104} y={284} textAnchor="middle" fontSize="12" fontWeight="800" fill="#b42318">×</text>
          <text x={104} y={320} textAnchor="middle" fontSize="10" fontWeight="700" fill="#b42318">wiper open</text>
        </>
      ) : <Wire d={poly([[LEG[1], LEG_END], [LEG[1], 280], [139, 280], [139, PIN.a0], [PIN.x, PIN.a0]])} color="#2563eb" width={2.8} live={running} />}
      <NucleoBoard id="l25" x={BX} y={BY} scale={BS} power={hasFw} chipLabel="STM32F401RE">
        <rect x={22} y={184} width={13.2} height={39.6} rx={1.2} fill="#2a2d33" />
        {Array.from({ length: 12 }, (_, i) => <rect key={i} x={22 + 6.6 * ((i % 2) + 0.5) - 1.4} y={184 + 6.6 * (Math.floor(i / 2) + 0.5) - 1.4} width={2.8} height={2.8} fill="#d4af37" />)}
        <text x={28.6} y={232} textAnchor="middle" className="mcl-svg-silk">CN8</text>
        <text x={40} y={190} className="mcl-svg-silk">A0</text>
        <text x={40} y={145} className="mcl-svg-silk">3V3</text>
        <text x={40} y={157} className="mcl-svg-silk">GND</text>
      </NucleoBoard>
      {([["#dc2626", p.fiveVolt ? "5V" : "3.3V", p.fiveVolt ? "pot supply (over VDDA)" : "pot supply", 150], ["#1f2937", "GND", "common ground", 196], ["#2563eb", "PA0 (ADC1_IN0)", `${a.pinV[0]!.toFixed(3)} V`, 242]] as const).map(([c, t, sub, y]) => (
        <g key={t}>
          <rect x={384} y={y} width={112} height={36} rx={5} fill="#fff" stroke="#d6e1ef" />
          <rect x={384} y={y} width={7} height={36} rx={2} fill={c} />
          <text x={398} y={y + 15} fontSize="10.5" fontWeight="800" fill="#0f2547">{t}</text>
          <text x={398} y={y + 28} fontSize="8.5" fill={t.startsWith("5V") ? "#b42318" : "#5c7190"}>{sub}</text>
        </g>
      ))}
      {p.noisy ? <text x={440} y={300} textAnchor="middle" fontSize="9" fontWeight="700" fill="#b45309"><tspan x={440}>noisy supply:</tspan><tspan x={440} dy={12}>±12 mV on the input</tspan></text> : null}
    </svg>
  );
}

function Plot({ a, axis, vref }: { a: Adc25; axis: number; vref: number }) {
  const pw = 360, ph = 170, l = 34, t = 8, w = pw - l - 8, h = ph - t - 26;
  const end = a.trace[a.trace.length - 1]?.[0] ?? 0;
  const start = end - 0.2;
  const X = (tt: number) => l + ((tt - start) / 0.2) * w;
  const Y = (v: number) => t + h - (Math.max(0, Math.min(axis, v)) / axis) * h;
  const line = a.trace.filter(([tt]) => tt >= start).map(([tt, v], i) => `${i ? "L" : "M"}${X(tt).toFixed(1)} ${Y(v).toFixed(1)}`).join(" ");
  const dots = a.samples.filter((s) => s.t >= start);
  const ticks = axis > 4 ? [0, 1, 2, 3, 4, 5] : [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.3];
  return (
    <svg viewBox={`0 0 ${pw} ${ph}`} className="mcl-l25-plot" role="img" aria-label={`Sampled waveform, ${dots.length} samples in the last 200 ms`}>
      {ticks.map((v) => <g key={v}><line x1={l} x2={l + w} y1={Y(v)} y2={Y(v)} stroke="#e8eef6" /><text x={l - 5} y={Y(v) + 3} textAnchor="end" fontSize="8" fill="#64748b">{v.toFixed(1)}</text></g>)}
      {[0, 50, 100, 150, 200].map((ms) => <text key={ms} x={l + (ms / 200) * w} y={t + h + 12} textAnchor="middle" fontSize="8" fill="#64748b">{ms}</text>)}
      <text x={l + w / 2} y={ph - 2} textAnchor="middle" fontSize="8.5" fill="#33496b">Time (ms)</text>
      <text x={9} y={t + h / 2} textAnchor="middle" fontSize="8.5" fill="#33496b" transform={`rotate(-90 9 ${t + h / 2})`}>Voltage (V)</text>
      {vref < axis - 0.01 ? <g><line x1={l} x2={l + w} y1={Y(vref)} y2={Y(vref)} stroke="#f59e0b" strokeDasharray="4 3" /><text x={l + w - 2} y={Y(vref) - 3} textAnchor="end" fontSize="7.5" fill="#b45309">Vref {vref} V (full scale)</text></g> : null}
      <path d={line} fill="none" stroke="#1677ff" strokeWidth={1.6} />
      {dots.map((s) => <circle key={s.t} cx={X(s.t)} cy={Y(s.volts)} r={dots.length > 90 ? 1.5 : 2.3} fill="#e5484d" />)}
    </svg>
  );
}

type Tab = "notes" | "regs" | "tasks";

export default function L25({ meta }: { meta: LabMeta }) {
  const lab = useLab<P25>({
    slug: meta.slug, code: DEMO, params: P25_DEFAULT,
    mcu: () => ({ part: "F401", clock: 84e6, ips: 400_000 }),
    world: world25,
  });
  const { mcu, params } = lab;
  const fw = mcu.fw;
  const a = adc(mcu);
  const [tab, setTab] = useState<Tab>("notes");
  const [auto, setAuto] = useState(true);
  const [frozen, setFrozen] = useState<{ vin: number; code: number; volts: number; bits: number } | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  useEffect(() => { if (pending !== null && lab.code === pending) { setPending(null); lab.run(); } }, [pending, lab]);

  const has = !!fw && ["resolution", "channel", "samplePeriod", "adcValue", "voltage"].every((k) => typeof fw.globalValue(k) === "number");
  const g = (k: CodeKey, d: number) => (has ? fw.num(k) : codeVal(lab.compiledCode, k) ?? d);
  const set = (k: CodeKey, v: number) => { if (has) fw.setGlobal(k, v); };
  const wantBits = resBits(g("resolution", 0));
  const channel = g("channel", 0);
  const period = Math.max(1, g("samplePeriod", 5));
  const fs = 1000 / period;
  const hwBits = mcu.adcBits;
  const hwCh = mcu.peek("ADC1.SQR3") & 0x1f;
  const vref = VREFS[params.vref]?.v ?? 3.3;
  const axis = params.fiveVolt ? 5 : 3.3;
  const lastSample = a.samples[a.samples.length - 1];
  const vinNow = hwCh === 0 && lastSample ? lastSample.vin : a.pinV[CH_PIN[hwCh] ?? 0] ?? 0;
  const live = { vin: vinNow, code: has ? fw.num("adcValue") : 0, volts: has ? fw.num("voltage") : 0, bits: hwBits };
  const shown = auto || !frozen ? live : frozen;
  const max = (1 << shown.bits) - 1;
  const expected = idealCode(shown.vin, shown.bits, vref);

  const drifted = (["resolution", "channel", "samplePeriod"] as CodeKey[]).filter((k) => { const c = codeVal(lab.compiledCode, k); return has && c !== null && c !== fw.num(k); });
  const writeCode = () => { let next = lab.code; for (const k of drifted) next = setCodeVal(next, k, fw!.num(k)); lab.setCode(next); setPending(next); };
  const defVref = /^#define\s+VREF\s+([\d.]+)f?/m.exec(lab.compiledCode);
  const codeVref = defVref ? Number(defVref[1]) : null;
  const writeVref = () => { const next = lab.code.replace(/^(#define\s+VREF\s+)([\d.]+)(f?)/m, (_, h: string) => `${h}${vref}f`); lab.setCode(next); setPending(next); };

  const mism = useRef<number | null>(null);
  const stale = has && lab.running && (wantBits !== hwBits || channel !== hwCh);
  if (!stale) mism.current = null; else if (mism.current === null) mism.current = mcu.now;
  const staleLong = stale && mism.current !== null && mcu.now - mism.current > (2 * period + 20) / 1000;
  const scaleOff = has && lab.running && a.samples.length > 0 && Math.abs(live.volts - (live.code * vref) / ((1 << hwBits) - 1)) > 0.02 * vref;
  const aliasing = params.source !== "dc" && params.freq > fs / 2;

  const [seen, setSeen] = useState({ read: false, sweep: false, lo: false, hi: false, res: false, vref: false, alias: false, fault: false });
  const active = lab.running && has && a.samples.length > 2;
  const flags = {
    read: active && params.source === "dc" && !params.open && Math.abs(live.code - idealCode(live.vin, hwBits, vref)) <= 2,
    lo: active && params.pot <= 0.2, hi: active && params.pot >= 3.1,
    res: active && hwBits !== 12, vref: active && params.vref !== 0,
    alias: active && aliasing, fault: active && (params.open || params.noisy || params.fiveVolt),
  };
  useEffect(() => {
    if ((Object.keys(flags) as Array<keyof typeof flags>).some((k) => flags[k] && !seen[k]))
      setSeen((o) => { const lo = o.lo || flags.lo, hi = o.hi || flags.hi; return { read: o.read || flags.read, lo, hi, sweep: lo && hi, res: o.res || flags.res, vref: o.vref || flags.vref, alias: o.alias || flags.alias, fault: o.fault || flags.fault }; });
  });
  const shellLab = { ...lab, resetLab: () => { lab.resetLab(); setTab("notes"); setAuto(true); setFrozen(null); setPending(null); setSeen({ read: false, sweep: false, lo: false, hi: false, res: false, vref: false, alias: false, fault: false }); } };

  const lockHint = !fw ? "Run the program to start converting." : !has ? "This program has no resolution / channel / samplePeriod / adcValue / voltage globals, so those controls only show the result." : "";
  const smp = mcu.peek("ADC1.SMPR2") & 7;
  const smpCycles = [3, 15, 28, 56, 84, 112, 144, 480][smp]!;
  const convUs = ((smpCycles + hwBits) / (mcu.clock / 4)) * 1e6;
  const uartLines = mcu.uart.text.split(/\r?\n/).filter(Boolean).slice(-3);

  return (
    <LabShell meta={meta} lab={shellLab} subtitle="Explore analog-to-digital conversion using the microcontroller's ADC."
      components={["NUCLEO-F401RE (STM32F401RE, 84 MHz)", "10 kΩ potentiometer: ends on 3.3 V and GND, wiper on PA0 (ADC1_IN0)", "Optional signal generator on PA0 (sine / triangle)", "ADC1, software-triggered single conversions"]}>
      <div className="mcl-grid mcl-l25-top">
        <Panel title="Simulation Setup" icon="sim" className="mcl-l25-sim">
          <Scene p={params} a={a} running={lab.running} hasFw={!!fw} onPot={(v) => lab.setParam("pot", Math.round(v * 330) / 100)} />
        </Panel>

        <Panel title="ADC Input & Configuration" icon="sliders" className="mcl-l25-cfg">
          <div className="mcl-l25-form">
            <div className="mcl-l25-field">
              <span>Analog Input Voltage (Potentiometer)</span>
              <div className="mcl-l25-pot">
                <input type="range" min={0} max={3.3} step={0.01} value={params.pot} aria-label="Potentiometer voltage" onChange={(e) => lab.setParam("pot", Number(e.target.value))} />
                <NumIn value={params.pot} min={0} max={3.3} step={0.01} label="Potentiometer voltage value" width={64} onCommit={(v) => lab.setParam("pot", Math.round(v * 100) / 100)} />
                <small>V</small>
              </div>
              <div className="mcl-l25-scale"><span>0.0 V</span><span>3.3 V</span></div>
            </div>
            <label className="mcl-l25-field"><span>Reference Voltage (V<sub>ref</sub>)</span>
              <select value={params.vref} onChange={(e) => lab.setParam("vref", Number(e.target.value))} aria-label="Reference voltage">
                {VREFS.map((r, i) => <option key={r.label} value={i}>{r.label}</option>)}
              </select></label>
            <label className="mcl-l25-field"><span>Sampling Rate</span>
              <select value={period} disabled={!has} onChange={(e) => set("samplePeriod", Number(e.target.value))} aria-label="Sampling rate">
                {RATES.some((r) => r.ms === period) ? null : <option value={period}>{fs.toFixed(1)} S/s ({period} ms)</option>}
                {RATES.map((r) => <option key={r.ms} value={r.ms}>{r.label} ({r.ms} ms)</option>)}
              </select></label>
            <label className="mcl-l25-field"><span>ADC Channel</span>
              <select value={channel} disabled={!has} onChange={(e) => set("channel", Number(e.target.value))} aria-label="ADC channel">
                {CHANNELS.some((c) => c.ch === channel) ? null : <option value={channel}>ADC1_IN{channel}</option>}
                {CHANNELS.map((c) => <option key={c.ch} value={c.ch}>{c.label}</option>)}
              </select></label>
            <label className="mcl-l25-field"><span>Resolution</span>
              <select value={wantBits} disabled={!has} onChange={(e) => set("resolution", resValue(Number(e.target.value)))} aria-label="Resolution">
                {BITS.map((b) => <option key={b} value={b}>{b} bits (0 – {(1 << b) - 1})</option>)}
              </select></label>
          </div>
          <p className="mcl-l25-sub">{CHANNELS.find((c) => c.ch === channel)?.what ?? "Unlisted channel"} · 1 LSB = {((vref / ((1 << hwBits) - 1)) * 1000).toFixed(2)} mV</p>
          {lockHint ? <p className="mcl-g2-hint">{lockHint}</p> : null}
          {drifted.length ? <p className="mcl-g2-hint mcl-l19-drift"><Icon name="edit" size={14} />{drifted.join(", ")} changed live; the program still starts with its own values.<button type="button" onClick={writeCode}>Write into code &amp; Run</button></p> : null}
          <div className="mcl-g2-faults">
            <b><Icon name="bug" size={14} />Fault injection</b>
            <Toggle label="Wiper wire open (PA0 floating)" checked={params.open} onChange={(v) => lab.setParam("open", v)} hint="PA0 picks up mains hum and drifts: the readings wander" />
            <Toggle label="Noisy supply" checked={params.noisy} onChange={(v) => lab.setParam("noisy", v)} hint="±12 mV of noise: the low bits flicker. Try the averaging example" />
            <Toggle label="Pot powered from 5 V" checked={params.fiveVolt} onChange={(v) => lab.setParam("fiveVolt", v)} hint="The top third of the pot travel is above Vref and clips at full scale" />
          </div>
        </Panel>

        <div className="mcl-l25-right">
          <Panel title="Live Readings" icon="gauge" className="mcl-l25-read" tools={<Toggle label="Auto-update" checked={auto} onChange={(v) => { setAuto(v); setFrozen(v ? null : live); }} />}>
            <dl className="mcl-l25-kv">
              <div><dt>Analog Input (Vin)</dt><dd className="mcl-l25-blue">{shown.vin.toFixed(2)}V</dd></div>
              <div><dt>ADC Count (Decimal)</dt><dd className="mcl-l25-green">{has ? shown.code : "-"}</dd></div>
              <div><dt>ADC Output (Binary)</dt><dd className="mcl-l25-purple">{has ? groupBits(shown.code, shown.bits) : "-"}</dd></div>
              <div><dt>Converted Voltage</dt><dd className="mcl-l25-orange">{has ? `${shown.volts.toFixed(3)} V` : "-"}</dd></div>
            </dl>
            {has && !auto ? <p className="mcl-l25-sub">Frozen at t = {mcu.now.toFixed(2)} s · turn Auto-update on to resume.</p> : null}
            {has ? <p className="mcl-l25-sub">Expected {expected} of {max} for {shown.vin.toFixed(3)} V against {vref} V.</p> : null}
          </Panel>
          <Panel title="Analog Input Waveform (Sampled)" icon="wave" className="mcl-l25-wave"
            tools={<Seg size="sm" label="Input signal" value={params.source} onChange={(v: Source) => lab.setParam("source", v)} options={[{ value: "dc", label: "Pot" }, { value: "sine", label: "Sine" }, { value: "tri", label: "Triangle" }]} />}>
            <div className="mcl-l25-legend">
              <span><i className="ln" />Analog Input (PA0)</span><span><i className="dot" />Sampled Points ({fs.toFixed(0)} S/s)</span>
              {params.source !== "dc" ? <label>Signal<select value={params.freq} onChange={(e) => lab.setParam("freq", Number(e.target.value))} aria-label="Signal frequency">{FREQS.map((f) => <option key={f} value={f}>{f} Hz</option>)}</select></label> : null}
            </div>
            <Plot a={a} axis={axis} vref={vref} />
            {aliasing ? <p className="mcl-l25-warn"><Icon name="alert" size={14} />{params.freq} Hz is above fs/2 = {(fs / 2).toFixed(1)} Hz: the samples alias into a slower false wave.</p> : null}
          </Panel>
        </div>
      </div>

      <div className="mcl-grid mcl-l25-bot">
        <CodeEditor lab={lab} languages={[{ label: "C (STM32 HAL)", code: DEMO }, { label: "Average 16 samples", code: AVERAGE }, { label: "Bug: no re-init", code: NO_REINIT }, { label: "Bug: 5 V scale", code: WRONG_SCALE }]} />
        <Panel title="Learning Notes" icon="book" className="mcl-l25-notes">
          <div className="mcl-tabs" role="tablist">
            {([["notes", "Learning Notes"], ["regs", "Register View"], ["tasks", "Tasks"]] as const).map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>)}
          </div>
          {staleLong ? <p className="mcl-g2-hint"><Icon name="alert" size={14} />The code asks for {wantBits}-bit on ADC1_IN{channel}, but the ADC is still set to {hwBits}-bit on ADC1_IN{hwCh}: HAL_ADC_Init / HAL_ADC_ConfigChannel never ran again.</p> : null}
          {codeVref !== null && Math.abs(codeVref - vref) > 0.001 ? (
            <p className="mcl-g2-hint mcl-l19-drift"><Icon name="alert" size={14} />The ADC reference is {vref} V but the code converts with VREF = {codeVref} V, so the converted voltage is off by {((codeVref / vref - 1) * 100).toFixed(0)} %.<button type="button" onClick={writeVref}>Write VREF into code &amp; Run</button></p>
          ) : scaleOff ? <p className="mcl-g2-hint"><Icon name="alert" size={14} />Converted voltage {live.volts.toFixed(3)} V does not match count × Vref / (2^N − 1) = {((live.code * vref) / ((1 << hwBits) - 1)).toFixed(3)} V: check the scale factor in the code.</p> : null}
          {shown.vin > vref + 0.005 ? <p className="mcl-g2-hint"><Icon name="alert" size={14} />Vin is above Vref ({vref} V): the ADC clips at {(1 << hwBits) - 1}.{params.fiveVolt ? " PA0 sees up to 5 V here, above VDDA; a real analog pin must stay within 0 – 3.3 V." : ""}</p> : null}

          {tab === "notes" ? (
            <div className="mcl-l25-learn">
              <h3>Understanding Analog-to-Digital Conversion</h3>
              <p>An Analog-to-Digital Converter (ADC) converts a continuous analog voltage into a discrete digital value. The microcontroller's ADC measures the input voltage relative to a reference voltage (V<sub>ref</sub>) and outputs a numerical count.</p>
              <div className="mcl-l25-formula">
                <div className="mcl-l25-eq">ADC Count = <span className="mcl-l25-frac"><span>V<sub>in</sub></span><span>V<sub>ref</sub></span></span> × (2<sup>N</sup> − 1)</div>
                <dl><div><dt>V<sub>in</sub></dt><dd>Analog input voltage (V)</dd></div><div><dt>V<sub>ref</sub></dt><dd>Reference voltage (V)</dd></div><div><dt>N</dt><dd>ADC resolution (bits)</dd></div></dl>
              </div>
              <p className="mcl-l25-now">Now: {shown.vin.toFixed(3)} / {vref} × {max} = <b>{expected}</b>{has ? <> · the ADC read <b>{shown.code}</b></> : null}</p>
              <h4>Key Points</h4>
              <ul>
                <li>The ADC samples the input voltage at a specific sampling rate.</li>
                <li>The result is a digital value between 0 and (2<sup>N</sup> − 1).</li>
                <li>Higher resolution gives finer steps; each extra 2 bits makes the step 4× smaller.</li>
                <li>The reference voltage (V<sub>ref</sub>) sets the full-scale input range.</li>
                <li>In this lab, a potentiometer gives a variable voltage (0 – 3.3 V) on PA0.</li>
                <li>A signal must be sampled faster than twice its frequency, or it aliases.</li>
              </ul>
              <div className="mcl-l25-try"><b><Icon name="bulb" size={15} />Try This</b>
                <ul><li>Adjust the potentiometer and watch the graph and readouts change.</li><li>Switch to a sine input, then lower the sampling rate until the samples stop following it.</li><li>Pick a 2.5 V reference and fix the VREF define the hint points at.</li></ul>
              </div>
            </div>
          ) : null}

          {tab === "regs" ? (
            <div className="mcl-l25-regs">
              <table className="mcl-l22-table">
                <thead><tr><th>Register</th><th>Value</th><th>Meaning</th></tr></thead>
                <tbody>
                  <tr><td>ADC1_CR1</td><td>0x{mcu.peek("ADC1.CR1").toString(16).toUpperCase().padStart(8, "0")}</td><td>RES = {((mcu.peek("ADC1.CR1") >>> 24) & 3).toString(2).padStart(2, "0")} → {hwBits}-bit</td></tr>
                  <tr><td>ADC1_SMPR2</td><td>0x{mcu.peek("ADC1.SMPR2").toString(16).toUpperCase().padStart(8, "0")}</td><td>SMP0 = {smp.toString(2).padStart(3, "0")} → {smpCycles} cycles</td></tr>
                  <tr><td>ADC1_SQR3</td><td>0x{mcu.peek("ADC1.SQR3").toString(16).toUpperCase().padStart(8, "0")}</td><td>SQ1 = {hwCh} → ADC1_IN{hwCh}</td></tr>
                  <tr><td>ADC1_DR</td><td>0x{mcu.peek("ADC1.DR").toString(16).toUpperCase().padStart(8, "0")}</td><td>Last result = {mcu.peek("ADC1.DR")}</td></tr>
                </tbody>
              </table>
              <p className="mcl-l25-sub">ADC clock = PCLK2 / 4 = {(mcu.clock / 4e6).toFixed(0)} MHz · conversion = ({smpCycles} + {hwBits}) cycles = {convUs.toFixed(2)} µs · {a.samples.length ? `${fs.toFixed(0)} conversions/s` : "idle"}</p>
              <div className="mcl-l25-uart"><b><Icon name="terminal" size={14} />UART (115200)</b>{uartLines.length ? uartLines.map((ln, i) => <code key={i}>{ln}</code>) : <code>No output yet: press Run.</code>}</div>
            </div>
          ) : null}

          {tab === "tasks" ? (
            <div className="mcl-l25-tasks">
              <ol className="mcl-steps">
                {([
                  ["Observe", "Run the example: 1.65 V on PA0 reads 2048 at 12 bit, and the converted voltage comes back as 1.650 V."],
                  ["Try", "Drag the pot (in the scene or the slider) from end to end and watch the count follow 0 – 4095."],
                  ["Measure", `Now: Vin ${live.vin.toFixed(3)} V, count ${has ? live.code : "-"}, ${hwBits}-bit, ${fs.toFixed(0)} S/s, 1 LSB = ${((vref / ((1 << hwBits) - 1)) * 1000).toFixed(2)} mV.`],
                  ["Modify", "Drop to 8 or 6 bits, pick a 2.5 V reference, or feed a 25 Hz sine at 20 S/s to see aliasing."],
                  ["Run Again", "Load Bug: no re-init and Bug: 5 V scale; change the resolution, read the hints, fix the code and Run again."],
                ] as const).map(([k, v]) => <li key={k}><b>{k}</b><span>{v}</span></li>)}
              </ol>
              <ul className="mcl-checks">
                {[
                  ["Read the pot and matched the expected count", seen.read], ["Swept the pot to both ends", seen.sweep], ["Changed the ADC resolution", seen.res],
                  ["Used an external reference voltage", seen.vref], ["Made a signal alias", seen.alias], ["Reproduced an input fault", seen.fault],
                ].map(([l, d]) => <li key={String(l)} className={d ? "done" : ""}><Icon name={d ? "check" : "target"} size={14} />{l}</li>)}
              </ul>
              <p className="mcl-challenge"><b>Challenge:</b> Print the voltage in millivolts using only integer maths: mV = adcValue × 3300 / 4095.</p>
            </div>
          ) : null}
        </Panel>
      </div>
    </LabShell>
  );
}
