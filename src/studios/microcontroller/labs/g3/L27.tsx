import { useEffect, useState } from "react";
import { useLab } from "../core/useLab";
import type { Mcu } from "../core/mcu";
import type { LabMeta } from "../registry";
import { CodeEditor } from "../ui/CodeEditor";
import { HwDefs, NucleoBoard, Wire } from "../ui/Hardware";
import { Icon } from "../ui/Icon";
import { Panel, Toggle } from "../ui/Panels";
import { LabShell } from "../ui/Shell";
import { NumIn } from "./NumIn";
import {
  BUG_ALIGN, BUG_NOSTART, CH, codeVal, DC_ONLY, DEMO, history, loadGain, P27_DEFAULT, pinVolts, RATES, setCodeVal, shape, SQUARE, vrefOf, WAVES, world27,
  type CodeKey, type DacSample, type P27,
} from "./L27sim";

const W = 520, H = 300;
const BX = 14, BY = 12, BS = 0.84;
/** PA4 = CN8 A2 (drawn as children), PA5 = CN5 D13 on the right Arduino header, in scene units. */
const PA4 = { x: BX + 25.3 * BS, y: BY + 200.5 * BS };
const PA5 = { x: BX + 161.3 * BS, y: BY + 141.7 * BS };
const BLK = { x: 252, y: 104, w: 86, h: 60 };
const SPAN = 0.05;
const VARIANTS = [DEMO, DC_ONLY, SQUARE, BUG_NOSTART, BUG_ALIGN];

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

const hex = (c: number) => `0x${Math.max(0, Math.round(c)).toString(16).toUpperCase().padStart(4, "0")}`;
const rateLabel = (r: number) => (r >= 1000 ? `${r / 1000} kHz` : `${r} Hz`);

function Scene({ m, p, chIdx, running, hasFw }: { m: Mcu; p: P27; chIdx: number; running: boolean; hasFw: boolean }) {
  const v = pinVolts(m, p, chIdx ? 0x10 : 0);
  const v2 = pinVolts(m, p, 0x10);
  const ld2 = v2 > 1.8 ? Math.min(1, (v2 - 1.8) / 1.4) : 0;
  const on = (i: number) => m.dacEnabled[i] === true;
  const specs: Array<[string, string]> = [
    ["Resolution", "12-bit (0 – 4095)"], ["Reference", `${vrefOf(p).toFixed(1)} V (VREF+)${p.sag ? " sagging" : ""}`], ["Channels", "2 (DAC1, DAC2)"],
    ["Output Range", `0 – ${vrefOf(p).toFixed(1)} V`], ["Settling Time", "~3 µs"], ["Output Buffer", p.load ? "OFF (15 kΩ source)" : "ON"],
  ];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mcl-svg mcl-l27-scene" role="img" aria-label={`DAC output ${v.toFixed(3)} volts on ${CH[chIdx]!.pin}`}>
      <HwDefs id="l27" />
      <NucleoBoard id="l27" x={BX} y={BY} scale={BS} power={hasFw} chipLabel="STM32F446RE" model="NUCLEO-F446RE" ld2={ld2}>
        <rect x={22} y={184} width={13.2} height={39.6} rx={1.2} fill="#2a2d33" />
        {Array.from({ length: 12 }, (_, i) => <rect key={i} x={22 + 6.6 * ((i % 2) + 0.5) - 1.4} y={184 + 6.6 * (Math.floor(i / 2) + 0.5) - 1.4} width={2.8} height={2.8} fill="#d4af37" />)}
        <text x={28.6} y={232} textAnchor="middle" className="mcl-svg-silk">CN8</text>
        <text x={38} y={203} className="mcl-svg-silk">A2 PA4</text>
        <text x={152} y={144} textAnchor="end" className="mcl-svg-silk">PA5 D13</text>
      </NucleoBoard>
      <g opacity={on(0) ? 1 : 0.35}>
        <Wire d={poly([[PA4.x, PA4.y], [6, PA4.y], [6, 3], [214, 3], [214, BLK.y + 18], [BLK.x, BLK.y + 18]])} color="#dc2626" width={2.6} live={running && on(0)} />
      </g>
      <g opacity={on(1) ? 1 : 0.35}>
        <Wire d={poly([[PA5.x, PA5.y], [230, PA5.y], [230, BLK.y + 42], [BLK.x, BLK.y + 42]])} color="#16a34a" width={2.6} live={running && on(1)} />
      </g>
      <text x={BLK.x - 4} y={BLK.y + 14} textAnchor="end" fontSize="8.5" fontWeight="700" fill="#b42318">DAC1 · PA4</text>
      <text x={BLK.x - 4} y={BLK.y + 56} textAnchor="end" fontSize="8.5" fontWeight="700" fill="#15803d">DAC2 · PA5</text>
      <rect x={BLK.x} y={BLK.y} width={BLK.w} height={BLK.h} rx={6} fill="#1659c7" stroke="#0f3f8f" />
      <text x={BLK.x + BLK.w / 2} y={BLK.y + 27} textAnchor="middle" fontSize="15" fontWeight="800" fill="#fff">DAC</text>
      <text x={BLK.x + BLK.w / 2} y={BLK.y + 44} textAnchor="middle" fontSize="10.5" fill="#dbe8ff">(12-bit)</text>
      <path d={`M${BLK.x + BLK.w} ${BLK.y + 30} H${BLK.x + BLK.w + 26}`} stroke="#0f2547" strokeWidth={1.6} />
      <path d={`M${BLK.x + BLK.w + 26} ${BLK.y + 26} l7 4 -7 4z`} fill="#0f2547" />
      <text x={BLK.x + BLK.w + 38} y={BLK.y + 24} fontSize="11" fontWeight="700" fill="#0f2547">Analog Output</text>
      <text x={BLK.x + BLK.w + 38} y={BLK.y + 38} fontSize="10" fill="#33496b">(0 – {vrefOf(p).toFixed(1)} V)</text>
      <text x={BLK.x + BLK.w + 38} y={BLK.y + 58} fontSize="15" fontWeight="800" fill={on(chIdx) ? "#1677ff" : "#94a3b8"}>{v.toFixed(3)} V</text>
      {p.load ? <text x={BLK.x + BLK.w + 38} y={BLK.y + 72} fontSize="8.5" fontWeight="700" fill="#b45309">10 kΩ load, buffer off</text> : null}
      <g transform="translate(252 192)">
        <rect width={258} height={100} rx={7} fill="#fff" stroke="#d6e1ef" />
        <text x={10} y={15} fontSize="10" fontWeight="800" fill="#0f2547">DAC Specs (STM32F446RE)</text>
        {specs.map(([k, val], i) => (
          <g key={k}>
            <line x1={10} x2={248} y1={21 + i * 13} y2={21 + i * 13} stroke="#edf2f8" />
            <text x={10} y={31 + i * 13} fontSize="8.8" fill="#33496b">{k}</text>
            <text x={124} y={31 + i * 13} fontSize="8.8" fill={(k === "Reference" && p.sag) || (k === "Output Buffer" && p.load) ? "#b45309" : "#0f2547"} fontWeight="600">{val}</text>
          </g>
        ))}
      </g>
      {ld2 > 0 ? <text x={BX + 66 * BS} y={BY + 168 * BS} textAnchor="middle" fontSize="7" fill="#15803d">LD2 lit by PA5</text> : null}
    </svg>
  );
}

function OutPlot({ h, now, volts, enabled, view, vref }: { h: DacSample[]; now: number; volts: (c: number) => number; enabled: boolean; view: P27["view"]; vref: number }) {
  const pw = 380, ph = 236, l = 40, t = 24, w = pw - l - 12, hh = ph - t - 32;
  const start = now - SPAN;
  const X = (tt: number) => l + ((Math.max(start, tt) - start) / SPAN) * w;
  const top = view === "voltage" ? 3.3 : 4095;
  const val = (c: number) => (view === "voltage" ? (enabled ? volts(c) : 0) : c);
  const Y = (v: number) => t + hh - (Math.max(0, Math.min(top, v)) / top) * hh;
  let d = "";
  h.forEach((s, i) => {
    const x0 = X(s.t), x1 = X(h[i + 1]?.t ?? now), y = Y(val(s.code));
    d += `${i ? "L" : "M"}${x0.toFixed(1)} ${y.toFixed(1)} L${x1.toFixed(1)} ${y.toFixed(1)} `;
  });
  const ticks = view === "voltage" ? [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.3] : [0, 1024, 2048, 3072, 4095];
  const dots = view === "samples" && h.length <= 260 ? h.filter((s) => s.t >= start) : [];
  return (
    <svg viewBox={`0 0 ${pw} ${ph}`} className="mcl-l27-plot" role="img" aria-label={`DAC output over the last 50 ms, ${h.length} samples`}>
      <text x={l + w / 2} y={13} textAnchor="middle" fontSize="10" fontWeight="700" fill="#0f2547">DAC Output Waveform</text>
      {ticks.map((v) => <g key={v}><line x1={l} x2={l + w} y1={Y(v)} y2={Y(v)} stroke="#e8eef6" /><text x={l - 5} y={Y(v) + 3} textAnchor="end" fontSize="8" fill="#64748b">{view === "voltage" ? v.toFixed(1) : v}</text></g>)}
      {[0, 10, 20, 30, 40, 50].map((ms) => <g key={ms}><line x1={l + (ms / 50) * w} x2={l + (ms / 50) * w} y1={t} y2={t + hh} stroke="#f1f5fa" /><text x={l + (ms / 50) * w} y={t + hh + 12} textAnchor="middle" fontSize="8" fill="#64748b">{ms}</text></g>)}
      <rect x={l} y={t} width={w} height={hh} fill="none" stroke="#cbd5e1" />
      <text x={l + w / 2} y={ph - 4} textAnchor="middle" fontSize="8.5" fill="#33496b">Time (ms)</text>
      <text x={10} y={t + hh / 2} textAnchor="middle" fontSize="8.5" fill="#33496b" transform={`rotate(-90 10 ${t + hh / 2})`}>{view === "voltage" ? "Output Voltage (V)" : "DAC Code"}</text>
      {view === "voltage" && vref < 3.29 ? <g><line x1={l} x2={l + w} y1={Y(vref)} y2={Y(vref)} stroke="#f59e0b" strokeDasharray="4 3" /><text x={l + w - 3} y={Y(vref) - 3} textAnchor="end" fontSize="7.5" fill="#b45309">VREF+ {vref.toFixed(1)} V</text></g> : null}
      <path d={d} fill="none" stroke="#1677ff" strokeWidth={1.6} strokeLinejoin="round" />
      {dots.map((s) => <circle key={s.t} cx={X(s.t)} cy={Y(s.code)} r={dots.length > 120 ? 1.2 : 2} fill="#e5484d" />)}
      {!h.length ? <text x={l + w / 2} y={t + hh / 2} textAnchor="middle" fontSize="10" fill="#94a3b8">No samples yet: press Run.</text> : null}
    </svg>
  );
}

function Preview({ waveform, level, color }: { waveform: number; level: number; color: string }) {
  const pts = shape(waveform, level, 96);
  const pw = 220, ph = 64;
  const d = pts.map((c, i) => `${i ? "L" : "M"}${((i / (pts.length - 1)) * (pw - 8) + 4).toFixed(1)} ${(ph - 6 - (c / 4095) * (ph - 12)).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${pw} ${ph}`} className="mcl-l27-prev" role="img" aria-label={`${WAVES[waveform] ?? "Custom"} preview`}>
      <line x1={4} x2={pw - 4} y1={ph / 2} y2={ph / 2} stroke="#e8eef6" />
      <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
    </svg>
  );
}

type GTab = "pinout" | "periph";
type LTab = "overview" | "tasks" | "hints" | "quiz";
const QUIZ = [
  { q: "A 12-bit DAC with Vref = 3.3 V is given code 1024. What is Vout?", a: ["0.825 V", "1.024 V", "1.650 V", "3.300 V"], ok: 0 },
  { q: "The loop sends 50 samples per cycle. What happens when the update rate doubles?", a: ["The amplitude doubles", "The signal frequency doubles", "The resolution doubles", "Nothing changes"], ok: 1 },
  { q: "HAL_DAC_SetValue() runs every loop but PA4 stays at 0 V. The most likely cause?", a: ["Vref is too high", "The code is above 4095", "HAL_DAC_Start() was never called", "The update rate is too low"], ok: 2 },
  { q: "What is the smallest voltage step of a 12-bit DAC at 3.3 V?", a: ["3.3 mV", "12.9 mV", "0.806 mV", "0.081 mV"], ok: 2 },
];
const NO_SEEN = { dc: false, waves: 0, rate: false, samples: false, custom: false, fault: false };

export default function L27({ meta }: { meta: LabMeta }) {
  const lab = useLab<P27>({
    slug: meta.slug, code: DEMO, params: P27_DEFAULT,
    mcu: () => ({ part: "F401", clock: 84e6, ips: 3_000_000 }),
    world: world27,
  });
  const { mcu, params } = lab;
  const fw = mcu.fw;
  const [gtab, setGtab] = useState<GTab>("pinout");
  const [ltab, setLtab] = useState<LTab>("overview");
  const [quiz, setQuiz] = useState<Record<number, number>>({});
  const [pending, setPending] = useState<string | null>(null);
  useEffect(() => { if (pending !== null && lab.code === pending) { setPending(null); lab.run(); } }, [pending, lab]);

  const has = !!fw && ["channel", "waveform", "level", "updateRateHz", "code"].every((k) => typeof fw.globalValue(k) === "number");
  const g = (k: CodeKey, d: number) => (has ? fw.num(k) : codeVal(lab.code, k) ?? d);
  const set = (k: CodeKey, v: number) => {
    if (has) fw.setGlobal(k, v);
    else if (codeVal(lab.code, k) !== null) lab.setCode(setCodeVal(lab.code, k, v));
  };
  const channel = g("channel", 0);
  const ci = channel ? 1 : 0;
  const waveform = g("waveform", 1);
  const level = Math.max(0, Math.min(4095, g("level", 2048)));
  const rate = Math.max(1, g("updateRateHz", 1000));
  const vref = vrefOf(params);
  const gain = loadGain(params);
  const enabled = mcu.dacEnabled[ci] === true;
  const code = mcu.dac[ci] ?? 0;
  const vout = pinVolts(mcu, params, channel);
  const volts = (c: number) => (c / 4095) * vref * gain;
  const h = history(mcu, ci, SPAN);
  const inWin = h.filter((s) => s.t >= mcu.now - SPAN);
  const measured = inWin.length > 2 ? (inWin.length - 1) / (inWin[inWin.length - 1]!.t - inWin[0]!.t) : 0;
  const last8 = history(mcu, ci, 1).slice(-8);
  const fwCode = has ? fw.num("code") : 0;
  const color = ci ? "#16a34a" : "#1677ff";

  const drifted = (["channel", "waveform", "level", "updateRateHz"] as CodeKey[]).filter((k) => { const c = codeVal(lab.compiledCode, k); return has && c !== null && c !== fw.num(k); });
  const writeCode = () => { let next = lab.code; for (const k of drifted) next = setCodeVal(next, k, fw!.num(k)); lab.setCode(next); setPending(next); };
  const active = lab.running && has && mcu.now > 0.03;
  const writes = mcu.dacLog.some(([, c]) => c === ci);
  const noStart = active && writes && !enabled;
  const alignBug = active && enabled && writes && fwCode !== code && ((fwCode & 0xff) << 4) === code;
  const mismatch = active && enabled && writes && !alignBug && Math.abs(fwCode - code) > 1 && waveform === 0;
  const slow = active && measured > 0 && measured < rate * 0.93;
  const sigHz = (measured || rate) / 50;
  const lockHint = !fw ? "Press Run to start the DAC. The controls below edit the code until then." : !has ? "This program has no channel / waveform / level / updateRateHz / code globals, so the controls only show the result." : "";

  const [seen, setSeen] = useState(NO_SEEN);
  const flags = {
    dc: active && enabled && waveform === 0 && Math.abs(vout - volts(level)) < 0.002,
    wave: active && enabled ? 1 << Math.max(0, Math.min(4, waveform)) : 0,
    rate: active && rate !== 1000,
    samples: active && params.view === "samples",
    custom: active && !VARIANTS.includes(lab.compiledCode),
    fault: active && (params.load || params.sag),
  };
  useEffect(() => {
    const nextWaves = seen.waves | flags.wave;
    if ((flags.dc && !seen.dc) || nextWaves !== seen.waves || (flags.rate && !seen.rate) || (flags.samples && !seen.samples) || (flags.custom && !seen.custom) || (flags.fault && !seen.fault))
      setSeen((o) => ({ dc: o.dc || flags.dc, waves: o.waves | flags.wave, rate: o.rate || flags.rate, samples: o.samples || flags.samples, custom: o.custom || flags.custom, fault: o.fault || flags.fault }));
  });
  const waveCount = [0, 1, 2, 3, 4].filter((b) => (seen.waves >> b) & 1).length;
  const objectives: Array<[string, boolean]> = [
    ["Understand DAC resolution and reference voltage", seen.dc],
    ["Generate different analog waveforms", waveCount >= 3],
    ["Observe the effect of update rate on waveform quality", seen.rate],
    ["Measure and analyze the output voltage", seen.samples],
    ["Modify the code to generate a custom waveform", seen.custom],
  ];
  const shellLab = { ...lab, resetLab: () => { lab.resetLab(); setGtab("pinout"); setLtab("overview"); setQuiz({}); setPending(null); setSeen(NO_SEEN); } };

  const crReg = (mcu.dacEnabled[0] ? 1 : 0) | (mcu.dacEnabled[1] ? 1 << 16 : 0) | (params.load ? (1 << 1) | (1 << 17) : 0);
  const reg = (v: number) => `0x${(v >>> 0).toString(16).toUpperCase().padStart(8, "0")}`;
  const usesAlign8 = /DAC_ALIGN_8B_R/.test(lab.compiledCode);

  return (
    <LabShell meta={meta} lab={shellLab} subtitle="Generate analog output signals using the Digital-to-Analog Converter (DAC)"
      components={["NUCLEO-F446RE (STM32F446RE; the F401RE has no DAC). This lab runs the core at 84 MHz", "DAC1 channel 1 on PA4 (CN8 A2), channel 2 on PA5 (CN5 D13, shared with LD2)", "Output buffer on, VREF+ = VDDA = 3.3 V", "Software-timed sample loop (delay_us between HAL_DAC_SetValue calls)"]}>
      <div className="mcl-grid mcl-l27-top">
        <Panel title="Hardware Simulation" icon="sim" className="mcl-l27-hw">
          <Scene m={mcu} p={params} chIdx={ci} running={lab.running} hasFw={!!fw} />
          <p className="mcl-l27-board"><i className={fw ? "on" : ""} />Board: STM32 Nucleo-F446RE (Simulated)</p>
        </Panel>

        <Panel title="Live Output" icon="wave" className="mcl-l27-live"
          tools={<div className="mcl-l27-views" role="radiogroup" aria-label="Output view">
            {([["voltage", "Voltage View"], ["samples", "Samples View"]] as const).map(([v, l]) => <button key={v} type="button" role="radio" aria-checked={params.view === v} className={params.view === v ? "on" : ""} onClick={() => lab.setParam("view", v)}>{l}</button>)}
          </div>}>
          <OutPlot h={h} now={mcu.now} volts={volts} enabled={enabled} view={params.view} vref={vref} />
          <p className="mcl-l27-sub">{CH[ci]!.label} · {WAVES[waveform] ?? `waveform ${waveform}`} · set {rateLabel(rate)}{measured ? `, measured ${(measured / 1000).toFixed(2)} kS/s` : ""} · signal {sigHz.toFixed(sigHz >= 10 ? 1 : 2)} Hz (50 samples/cycle)</p>
          {noStart ? <p className="mcl-g2-hint"><Icon name="alert" size={14} />Codes are being written to {CH[ci]!.per}, but the channel is not enabled: {CH[ci]!.pin} stays at 0 V. Call HAL_DAC_Start(&amp;hdac, {ci ? "DAC_CHANNEL_2" : "DAC_CHANNEL_1"}) first.</p> : null}
          {slow ? <p className="mcl-l27-sub warn">The loop is software-timed: each pass adds its own run time to delay_us(), so the real rate is {(100 - (measured / rate) * 100).toFixed(0)} % below target. A timer-triggered DAC with DMA avoids this.</p> : null}
        </Panel>

        <Panel title="DAC Controls" icon="sliders" className="mcl-l27-ctl">
          <div className="mcl-l27-form">
            <label className="mcl-l27-field"><span>DAC Channel</span>
              <select value={channel} onChange={(e) => set("channel", Number(e.target.value))} aria-label="DAC channel">
                {CH.map((c) => <option key={c.v} value={c.v}>{c.label}</option>)}
              </select></label>
            <label className="mcl-l27-field"><span>Waveform Type</span>
              <select value={waveform} onChange={(e) => set("waveform", Number(e.target.value))} aria-label="Waveform type">
                {WAVES.some((_, i) => i === waveform) ? null : <option value={waveform}>Custom ({waveform})</option>}
                {WAVES.map((w, i) => <option key={w} value={i}>{w}</option>)}
              </select></label>
            <div className="mcl-l27-field"><span>DAC Value (0 - 4095)</span>
              <NumIn value={level} min={0} max={4095} step={1} label="DAC value" onCommit={(v) => set("level", Math.round(Math.max(0, Math.min(4095, v))))} />
              <input type="range" min={0} max={4095} step={1} value={level} aria-label="DAC value slider" onChange={(e) => set("level", Number(e.target.value))} />
              <small>{waveform === 0 ? "DC output code" : "Waveform centre; swing = min(level, 4095 − level)"}</small>
            </div>
            <label className="mcl-l27-field"><span>Update Rate</span>
              <select value={rate} onChange={(e) => set("updateRateHz", Number(e.target.value))} aria-label="Update rate">
                {(RATES as readonly number[]).includes(rate) ? null : <option value={rate}>{rateLabel(rate)}</option>}
                {RATES.map((r) => <option key={r} value={r}>{rateLabel(r)}</option>)}
              </select></label>
            <label className="mcl-l27-field"><span>Reference Voltage (V)</span>
              <input type="text" readOnly value={vref.toFixed(1)} aria-label="Reference voltage" className={params.sag ? "warn" : ""} /></label>
          </div>
          {lockHint ? <p className="mcl-g2-hint">{lockHint}</p> : null}
          {drifted.length ? <p className="mcl-g2-hint mcl-l19-drift"><Icon name="edit" size={14} />{drifted.join(", ")} changed live; the program still starts with its own values.<button type="button" onClick={writeCode}>Write into code &amp; Run</button></p> : null}
          <div className="mcl-g2-faults">
            <b><Icon name="bug" size={14} />Fault injection</b>
            <Toggle label="10 kΩ load, buffer off" checked={params.load} onChange={(v) => lab.setParam("load", v)} hint="The unbuffered DAC has ~15 kΩ output impedance: a 10 kΩ load divides Vout by 2.5" />
            <Toggle label="VREF+ sags to 3.0 V" checked={params.sag} onChange={(v) => lab.setParam("sag", v)} hint="Every code now maps to 3.0 V full scale: the whole output shrinks by 9 %" />
          </div>
        </Panel>
      </div>

      <div className="mcl-grid mcl-l27-mid">
        <Panel title="Digital Input (DAC Code)" className="mcl-l27-card">
          <b className="mcl-l27-big">{code}</b>
          <span className="mcl-l27-cap">{hex(code)} (12-bit){usesAlign8 ? " · written as 8-bit" : ""}</span>
        </Panel>
        <Panel title="Analog Output Voltage" className="mcl-l27-card">
          <b className={`mcl-l27-big blue ${enabled ? "" : "off"}`}>{vout.toFixed(3)} V</b>
          <span className="mcl-l27-cap">{enabled ? `(Vout = ${code} / 4095 × ${vref.toFixed(1)} V${gain < 1 ? ` × ${gain.toFixed(2)} load` : ""})` : `(${CH[ci]!.per} disabled)`}</span>
        </Panel>
        <Panel title="Waveform Preview" className="mcl-l27-card">
          <Preview waveform={waveform} level={level} color={color} />
          <span className="mcl-l27-cap">{WAVES[waveform] ?? "Custom"} · centre {level} · swing ±{Math.min(level, 4095 - level)}</span>
        </Panel>
        <Panel title="Sample History (Last 8)" className="mcl-l27-hist">
          {last8.length ? (
            <ol className="mcl-l27-histlist">
              {last8.map((s, i) => <li key={s.t}><span>{i + 1}</span><b>{s.code}</b><em>{(enabled ? volts(s.code) : 0).toFixed(3)} V</em></li>)}
            </ol>
          ) : <p className="mcl-l27-sub">No samples yet.</p>}
        </Panel>
      </div>

      <div className="mcl-grid mcl-l27-bot">
        <CodeEditor lab={lab} languages={[{ label: "C (STM32 HAL)", code: DEMO }, { label: "DC level 1.0 V", code: DC_ONLY }, { label: "Square 2 kS/s", code: SQUARE }, { label: "Bug: no DAC start", code: BUG_NOSTART }, { label: "Bug: 8-bit align", code: BUG_ALIGN }]} />

        <Panel title="GPIO/Hardware Mapping" icon="chip" className="mcl-l27-map">
          <div className="mcl-tabs" role="tablist">
            {([["pinout", "Pinout"], ["periph", "Peripherals"]] as const).map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={gtab === k} className={gtab === k ? "on" : ""} onClick={() => setGtab(k)}>{l}</button>)}
          </div>
          {gtab === "pinout" ? (
            <table className="mcl-l22-table mcl-l27-table">
              <thead><tr><th>Function</th><th>Pin</th><th>Peripheral</th><th>Status</th></tr></thead>
              <tbody>
                {CH.map((c, i) => <tr key={c.pin}><td>DAC{i + 1} OUT</td><td>{c.pin}</td><td>{c.per}</td><td><i className={`mcl-l27-dot ${mcu.dacEnabled[i] ? "ok" : ""}`} />{mcu.dacEnabled[i] ? "Active" : "Unused"}</td></tr>)}
                <tr><td>VREF+</td><td>3.3V</td><td>Analog</td><td><i className={`mcl-l27-dot ${params.sag ? "warn" : "ok"}`} />{params.sag ? "Sagging" : "OK"}</td></tr>
                <tr><td>GND</td><td>GND</td><td>—</td><td><i className="mcl-l27-dot ok" />Connected</td></tr>
              </tbody>
            </table>
          ) : (
            <table className="mcl-l22-table mcl-l27-table mono">
              <thead><tr><th>Register</th><th>Value</th><th>Meaning</th></tr></thead>
              <tbody>
                <tr><td>DAC_CR</td><td>{reg(crReg)}</td><td>EN1 = {mcu.dacEnabled[0] ? 1 : 0}, EN2 = {mcu.dacEnabled[1] ? 1 : 0}, BOFF = {params.load ? 1 : 0}</td></tr>
                <tr><td>DAC_DOR1</td><td>{reg(mcu.dac[0] ?? 0)}</td><td>PA4 code {mcu.dac[0] ?? 0}</td></tr>
                <tr><td>DAC_DOR2</td><td>{reg(mcu.dac[1] ?? 0)}</td><td>PA5 code {mcu.dac[1] ?? 0}</td></tr>
                <tr><td>Alignment</td><td>{usesAlign8 ? "8B_R" : "12B_R"}</td><td>{usesAlign8 ? "DHR8R: code & 0xFF shifted left 4" : "DHR12R: bits 11:0"}</td></tr>
              </tbody>
            </table>
          )}
          {gtab === "pinout" ? <p className="mcl-l27-sub">PA5 also drives the green LD2 LED, which starts to glow above ~1.8 V on DAC2.</p> : <p className="mcl-l27-sub">Register values are derived from the HAL calls the program made.</p>}
          <div className="mcl-l27-info">
            <Icon name="help" size={15} />
            <div>
              <p>The DAC converts a 12-bit digital value to an analog voltage:</p>
              <div className="mcl-l27-eq">V<sub>out</sub> = ( <span className="mcl-l25-frac"><span>Code</span><span>4095</span></span> ) × V<sub>ref</sub></div>
              <p>With V<sub>ref</sub> = {vref.toFixed(1)} V, each step ≈ {((vref / 4095) * 1000).toFixed(3)} mV · now {code} → {volts(code).toFixed(3)} V</p>
            </div>
          </div>
        </Panel>

        <Panel title="Lab Guide & Tasks" icon="book" className="mcl-l27-guide">
          <div className="mcl-tabs mcl-l27-tabs" role="tablist">
            {([["overview", "Overview"], ["tasks", "Tasks"], ["hints", "Hints"], ["quiz", "Quiz"]] as const).map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={ltab === k} className={ltab === k ? "on" : ""} onClick={() => setLtab(k)}>{l}</button>)}
          </div>
          {alignBug ? <p className="mcl-g2-hint"><Icon name="alert" size={14} />The program computes {fwCode} but the DAC holds {code}: DAC_ALIGN_8B_R keeps only the low 8 bits ({fwCode & 0xff}) and shifts them up. Use DAC_ALIGN_12B_R for 12-bit codes.</p> : null}
          {mismatch ? <p className="mcl-g2-hint"><Icon name="alert" size={14} />The program's code ({fwCode}) differs from the DAC output register ({code}).</p> : null}

          {ltab === "overview" ? (
            <div className="mcl-l27-learn">
              <h3>About This Lab</h3>
              <p>In this lab, you will learn how to use the microcontroller's built-in Digital-to-Analog Converter (DAC) to generate analog signals such as a DC voltage, a sine wave, and a square wave. You will explore different update rates and see how the digital input value affects the analog output.</p>
              <h4>Learning Objectives</h4>
              <ul className="mcl-checks">
                {objectives.map(([l, d]) => <li key={l} className={d ? "done" : ""}><Icon name={d ? "check" : "target"} size={14} />{l}</li>)}
              </ul>
              <p className="mcl-l27-tip"><Icon name="bulb" size={15} />Try changing the waveform type, update rate, or DAC value, then click Run or Simulate to see the results!</p>
            </div>
          ) : null}

          {ltab === "tasks" ? (
            <div className="mcl-l27-learn">
              <ol className="mcl-steps">
                {([
                  ["Observe", "Run the example: a 20 Hz sine (1 kS/s, 50 samples per cycle) swings PA4 between 0 and 3.3 V around code 2048."],
                  ["Try", "Pick DC Level and set the DAC value to 1241: the output reads 1.000 V. Then try square, triangle and sawtooth."],
                  ["Measure", `Now: ${CH[ci]!.pin} code ${code} = ${vout.toFixed(3)} V, ${rateLabel(rate)} set${measured ? `, ${(measured / 1000).toFixed(2)} kS/s measured` : ""}. Use Samples View to count the steps per cycle.`],
                  ["Modify", "Raise the update rate to 10 kHz: the signal speeds up, and the measured rate falls behind the target because the loop is software-timed."],
                  ["Run Again", "Load Bug: no DAC start and Bug: 8-bit align, read the hints, fix the code and Run again. Then write your own waveform."],
                ] as const).map(([k, v]) => <li key={k}><b>{k}</b><span>{v}</span></li>)}
              </ol>
              <ul className="mcl-checks">
                <li className={waveCount >= 3 ? "done" : ""}><Icon name={waveCount >= 3 ? "check" : "target"} size={14} />Waveforms generated: {waveCount} of 5</li>
                <li className={seen.fault ? "done" : ""}><Icon name={seen.fault ? "check" : "target"} size={14} />Reproduced an output fault (load or VREF sag)</li>
              </ul>
              <p className="mcl-challenge"><b>Challenge:</b> Add waveform 5: a staircase with 8 equal steps from 0 to 4095 per cycle.</p>
            </div>
          ) : null}

          {ltab === "hints" ? (
            <div className="mcl-l27-learn">
              <ul className="mcl-l27-hints">
                <li><b>No output?</b> Each channel needs HAL_DAC_Start() before HAL_DAC_SetValue() has any effect on the pin.</li>
                <li><b>Wrong voltage?</b> Vout = code / 4095 × VREF+. Check the alignment argument: DAC_ALIGN_12B_R for 0 – 4095.</li>
                <li><b>Signal frequency</b> = update rate / samples per cycle. At 1 kHz and 50 samples that is 20 Hz.</li>
                <li><b>Smoother waves</b> need more samples per cycle, which needs a faster update rate for the same frequency.</li>
                <li><b>Loaded output</b> drops when the output buffer is off; keep the buffer on (BOFF = 0) to drive low-impedance loads.</li>
              </ul>
            </div>
          ) : null}

          {ltab === "quiz" ? (
            <div className="mcl-l27-learn mcl-l27-quiz">
              {QUIZ.map((qq, qi) => (
                <fieldset key={qq.q}>
                  <legend>{qi + 1}. {qq.q}</legend>
                  {qq.a.map((a, ai) => {
                    const picked = quiz[qi] === ai;
                    return <label key={a} className={picked ? (ai === qq.ok ? "right" : "wrong") : ""}><input type="radio" name={`l27q${qi}`} checked={picked} onChange={() => setQuiz((o) => ({ ...o, [qi]: ai }))} />{a}</label>;
                  })}
                </fieldset>
              ))}
              <p className="mcl-l27-sub">Score: {QUIZ.filter((qq, qi) => quiz[qi] === qq.ok).length} / {QUIZ.length}</p>
            </div>
          ) : null}
        </Panel>
      </div>
    </LabShell>
  );
}
