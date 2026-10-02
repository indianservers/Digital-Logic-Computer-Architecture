import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLab } from "../core/useLab";
import type { LabMeta } from "../registry";
import { CodeEditor } from "../ui/CodeEditor";
import { Icon } from "../ui/Icon";
import { Panel, Seg, Toggle } from "../ui/Panels";
import { LabShell } from "../ui/Shell";
import { NumIn } from "./NumIn";
import {
  adcRef, BITS16, BITS8, BUG_U8, BUG_VREF, codeDefine, DEMO, enob, fmtV, ideal, idealSnr, lsb, mcu26, OVERSAMPLE, P26_DEFAULT, quantize, RATES, RES_COLOR, RESOLUTIONS,
  rmsQuantError, run26, setCodeDefine, WAVES, window26, WINDOW, world26, type P26, type Wave, type Window26,
} from "./L26sim";

type Tab = "concepts" | "formulas" | "tradeoffs" | "real" | "check";
const CHECKED: Record<number, keyof P26> = { 8: "c8", 10: "c10", 12: "c12", 16: "c16" };
const binary = (code: number, bits: number) => Math.max(0, code).toString(2).padStart(bits, "0");

function Field({ label, value, min, max, step, onCommit, scale, children }: { label: ReactNode; value: number; min: number; max: number; step: number; onCommit: (v: number) => void; scale: [string, string]; children?: ReactNode }) {
  return (
    <div className="mcl-l26-field">
      <span>{label}</span>
      <NumIn value={value} min={min} max={max} step={step} label={typeof label === "string" ? label : "value"} width={120} onCommit={onCommit} />
      {children ?? <input type="range" min={min} max={max} step={step} value={value} aria-label={`${typeof label === "string" ? label : "value"} slider`} onChange={(e) => onCommit(Number(e.target.value))} />}
      <div className="mcl-l26-scale"><span>{scale[0]}</span><span>{scale[1]}</span></div>
    </div>
  );
}

function Compare({ p, w, rows }: { p: P26; w: Window26; rows: number[] }) {
  const box = useRef<SVGSVGElement>(null);
  const [PW, setPW] = useState(640);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => { const wd = Math.round(e?.contentRect.width ?? 0); if (wd > 0) setPW(Math.max(360, wd)); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const L = 84, R = 8, RH = 78, top = 6;
  const pw = PW - L - R;
  const H = top + rows.length * RH + 24;
  const X = (t: number) => L + ((t - w.start) / WINDOW) * pw;
  const fine = Array.from({ length: 241 }, (_, i) => w.start + (i / 240) * WINDOW);
  const fineV = fine.map((t) => ideal(p, t));
  let lo = 0, hi = p.vref;
  if (p.view === "fit") {
    const a = Math.max(0, Math.min(...fineV, ...w.vin)), b = Math.min(p.vref, Math.max(...fineV, ...w.vin));
    const pad = Math.max(0.03, (b - a) * 0.1);
    lo = a - pad; hi = b + pad;
  }
  const dense = w.ts.length > 120;
  return (
    <svg ref={box} viewBox={`0 0 ${PW} ${H}`} className="mcl-l26-cmp" role="img" aria-label={`Quantized waveforms for ${rows.join(", ")}-bit over 20 ms`}>
      {rows.map((b, ri) => {
        const y0 = top + ri * RH, h = RH - 16;
        const q = lsb(b, p.vref), color = RES_COLOR[b] ?? "#0f2547";
        const codes = w.vin.map((v) => quantize(v, b, p));
        const rec = codes.map((c) => c * q);
        const err = p.view === "error";
        const Y = err ? (e: number) => y0 + h / 2 - (Math.max(-1, Math.min(1, e / q)) * h) / 2 : (v: number) => y0 + h - ((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * h;
        const ticks = err ? [-1, -0.5, 0, 0.5, 1] : [lo, (lo + hi) / 2, hi];
        let stair = "";
        if (!err) rec.forEach((v, k) => { const x = X(w.ts[k]!), y = Y(v); stair += k ? ` H${x.toFixed(1)} V${y.toFixed(1)}` : `M${x.toFixed(1)} ${y.toFixed(1)}`; });
        if (!err && rec.length) stair += ` H${X(w.start + WINDOW).toFixed(1)}`;
        return (
          <g key={b}>
            <text x={2} y={y0 + h / 2 - 4} fontSize="12" fontWeight="800" fill="#0f2547">{b}-bit</text>
            <text x={2} y={y0 + h / 2 + 10} fontSize="10" fill="#5c7190">({(2 ** b).toLocaleString()} levels)</text>
            <rect x={L} y={y0} width={pw} height={h} fill="#fbfdff" stroke="#e5ecf5" />
            {ticks.map((v, i) => (
              <g key={i}>
                <line x1={L} x2={L + pw} y1={Y(err ? v * q : v)} y2={Y(err ? v * q : v)} stroke={err && Math.abs(v) === 0.5 ? "#f59e0b" : "#edf2f8"} strokeDasharray={err && Math.abs(v) === 0.5 ? "4 3" : undefined} />
                <text x={L - 4} y={Y(err ? v * q : v) + 3} textAnchor="end" fontSize="9" fill="#64748b">{err ? (v === 0 ? "0" : `${v > 0 ? "+" : ""}${v}`) : v.toFixed(hi - lo < 0.5 ? 2 : 1)}</text>
              </g>
            ))}
            {err ? (
              <>
                <text x={L + pw - 4} y={y0 + 11} textAnchor="end" fontSize="9.5" fill="#b45309">±½ LSB = ±{fmtV(q / 2)}</text>
                {w.ts.map((t, k) => <circle key={k} cx={X(t)} cy={Y(rec[k]! - Math.max(0, Math.min(adcRef(p), w.vin[k]!)))} r={dense ? 1.2 : 2} fill={color} />)}
              </>
            ) : (
              <>
                <polyline points={fine.map((t, i) => `${X(t).toFixed(1)},${Y(fineV[i]!).toFixed(1)}`).join(" ")} fill="none" stroke="#94a3b8" strokeWidth={1.2} />
                <path d={stair} fill="none" stroke={color} strokeWidth={1.6} />
                {w.ts.length <= 220 ? w.ts.map((t, k) => <circle key={k} cx={X(t)} cy={Y(rec[k]!)} r={dense ? 1.3 : 2.1} fill="#0f172a" />) : null}
              </>
            )}
          </g>
        );
      })}
      {[0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20].filter((ms) => pw > 500 || ms % 4 === 0).map((ms) => <text key={ms} x={L + (ms / 20) * pw} y={H - 12} textAnchor="middle" fontSize="9.5" fill="#64748b">{ms}</text>)}
      <text x={L + pw / 2} y={H - 1} textAnchor="middle" fontSize="10" fill="#33496b">Time (ms)</text>
    </svg>
  );
}

export default function L26({ meta }: { meta: LabMeta }) {
  const lab = useLab<P26>({ slug: meta.slug, code: DEMO, params: P26_DEFAULT, mcu: mcu26, world: world26 });
  const { mcu, params: p } = lab;
  const fw = mcu.fw;
  const run = run26(mcu);
  const [tab, setTab] = useState<Tab>("concepts");
  const [autoScroll, setAutoScroll] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  useEffect(() => { if (pending !== null && lab.code === pending) { setPending(null); lab.run(); } }, [pending, lab]);

  const now = mcu.now;
  const w = window26(p, now);
  const rows = RESOLUTIONS.filter((b) => p[CHECKED[b]!]);
  const codeBits = codeDefine(lab.compiledCode, "ADC_BITS");
  const codeVref = codeDefine(lab.compiledCode, "VREF");
  const fwBits = fw ? mcu.adcBits : codeBits ?? 12;
  const tableRows = [...rows, ...(fw && !rows.includes(fwBits as 8) ? [fwBits] : [])];
  const sample = run?.last ?? { t: now, v: ideal(p, now), code: quantize(ideal(p, now), fwBits, p) };

  const uartLines = mcu.uart.text.split("\n").filter(Boolean).slice(-200);
  const lastPrinted = [...uartLines].reverse().map((l) => /ADC:\s+(\d+)/.exec(l)).find(Boolean);
  const printedCode = lastPrinted ? Number(lastPrinted[1]) : null;
  const truncated = printedCode !== null && run?.last && run.last.code > 255 && printedCode === (run.last.code & 0xff) && fwBits > 8;
  const serial = useRef<HTMLDivElement>(null);
  useEffect(() => { if (autoScroll && serial.current) serial.current.scrollTop = serial.current.scrollHeight; }, [mcu.uart.text, autoScroll]);

  const fineV = Array.from({ length: 200 }, (_, i) => ideal(p, w.start + (i / 199) * WINDOW));
  const vMin = Math.min(...fineV) - 2 * p.noise, vMax = Math.max(...fineV) + 2 * p.noise;
  const clipping = vMin < 0 || vMax > p.vref;
  const aliasing = p.wave !== "dc" && p.freq > p.fs / 2;
  const writeDefine = (k: "ADC_BITS" | "VREF", v: number) => { const next = setCodeDefine(lab.code, k, v); lab.setCode(next); setPending(next); };
  const topBits = rows.length ? Math.max(...rows) : 12;
  const eff = enob(topBits, p);

  const [seen, setSeen] = useState({ ran: false, bits: false, clip: false, alias: false, noise: false, fault: false });
  const active = lab.running && !!fw;
  const flags = {
    ran: active && uartLines.some((l) => l.startsWith("ADC:")), bits: active && codeBits !== null && codeBits !== 12,
    clip: active && clipping, alias: active && aliasing, noise: active && p.noise >= lsb(8, p.vref), fault: active && (p.sag || p.stuck),
  };
  useEffect(() => {
    if ((Object.keys(flags) as Array<keyof typeof flags>).some((k) => flags[k] && !seen[k]))
      setSeen((o) => ({ ran: o.ran || flags.ran, bits: o.bits || flags.bits, clip: o.clip || flags.clip, alias: o.alias || flags.alias, noise: o.noise || flags.noise, fault: o.fault || flags.fault }));
  });
  const shellLab = { ...lab, resetLab: () => { lab.resetLab(); setTab("concepts"); setAutoScroll(true); setPending(null); setSeen({ ran: false, bits: false, clip: false, alias: false, noise: false, fault: false }); } };
  const set = <K extends keyof P26>(k: K, v: P26[K]) => lab.setParam(k, v);
  const logF = Math.log10(Math.max(1, p.freq));

  return (
    <LabShell meta={meta} lab={shellLab} subtitle="Explore how ADC resolution affects quantization, accuracy, and digital representation of analog signals."
      components={["Generic MCU ADC with selectable 8 / 10 / 12 / 16-bit resolution", "Function generator: sine, triangle, square, sawtooth or DC with added Gaussian noise", "Adjustable reference voltage (1 - 5 V)", "Serial monitor at 115200 baud"]}>
      <div className="mcl-l26-grid">
        <div className="mcl-l26-col">
          <Panel title="Input Signal & ADC Settings" icon="wave" className="mcl-l26-set">
            <div className="mcl-l26-setwrap">
              <div className="mcl-l26-fields">
                <div className="mcl-l26-field">
                  <span>Waveform Type</span>
                  <select value={p.wave} onChange={(e) => set("wave", e.target.value as Wave)} aria-label="Waveform type">{WAVES.map((x) => <option key={x.v} value={x.v}>{x.label}</option>)}</select>
                </div>
                <Field label="Amplitude (V p-p)" value={p.amp} min={0} max={5} step={0.01} onCommit={(v) => set("amp", v)} scale={["0", "5 V"]} />
                <Field label="DC Offset (V)" value={p.offset} min={-5} max={5} step={0.01} onCommit={(v) => set("offset", v)} scale={["-5", "5 V"]} />
                <Field label="Frequency (Hz)" value={p.freq} min={1} max={5000} step={1} onCommit={(v) => set("freq", Math.round(v))} scale={["1 Hz", "5 kHz"]}>
                  <input type="range" min={0} max={Math.log10(5000)} step={0.005} value={logF} aria-label="Frequency slider" onChange={(e) => set("freq", Math.max(1, Math.round(10 ** Number(e.target.value))))} />
                </Field>
                <Field label="Noise (V RMS)" value={p.noise} min={0} max={1} step={0.001} onCommit={(v) => set("noise", v)} scale={["0", "1 V"]} />
                <Field label="Reference Voltage (V)" value={p.vref} min={1} max={5} step={0.01} onCommit={(v) => set("vref", v)} scale={["1", "5 V"]} />
                <div className="mcl-l26-field">
                  <span>Sample Rate</span>
                  <select value={p.fs} onChange={(e) => set("fs", Number(e.target.value))} aria-label="Sample rate">{RATES.map((r) => <option key={r} value={r}>{r >= 1000 ? `${r / 1000} kS/s` : `${r} S/s`}</option>)}</select>
                  <div className="mcl-l26-scale"><span>{(WINDOW * p.fs + 1).toFixed(0)} samples / 20 ms</span></div>
                </div>
              </div>
              <div className="mcl-l26-cmpsel">
                <b>ADC Resolutions to Compare</b>
                {RESOLUTIONS.map((b) => (
                  <label key={b}><input type="checkbox" checked={!!p[CHECKED[b]!]} onChange={(e) => set(CHECKED[b]!, e.target.checked)} />{b}-bit ({(2 ** b).toLocaleString()} levels)</label>
                ))}
                <div className="mcl-g2-faults">
                  <b><Icon name="bug" size={14} />Fault injection</b>
                  <Toggle label="Vref sags 10 %" checked={p.sag} onChange={(v) => set("sag", v)} hint="The converter's real reference drops to 90 %: every code reads about 11 % high" />
                  <Toggle label="ADC bit 2 stuck low" checked={p.stuck} onChange={(v) => set("stuck", v)} hint="Missing codes: the staircase skips every other group of 4 levels" />
                </div>
              </div>
            </div>
          </Panel>

          <Panel title="ADC Quantization Comparison" icon="activity" className="mcl-l26-cmpp"
            tools={<Seg size="sm" label="Plot view" value={p.view} onChange={(v) => set("view", v)} options={[{ value: "full", label: "Full scale" }, { value: "fit", label: "Fit signal" }, { value: "error", label: "Error" }]} />}>
            <div className="mcl-l26-legend">
              <span><i style={{ background: "#94a3b8" }} />Analog Input (ideal)</span>
              {rows.map((b) => <span key={b}><i style={{ background: RES_COLOR[b] }} />{b}-bit (Δ={fmtV(lsb(b, p.vref))})</span>)}
              <span><i className="dot" />Sample Points</span>
            </div>
            {rows.length ? <Compare p={p} w={w} rows={rows} /> : <p className="mcl-l26-empty">Tick at least one resolution to compare.</p>}
            {clipping ? <p className="mcl-g2-hint"><Icon name="alert" size={14} />The input swings {vMin.toFixed(2)} – {vMax.toFixed(2)} V, outside 0 – {p.vref} V: codes clip at 0 and 2<sup>N</sup> − 1.</p> : null}
            {aliasing ? <p className="mcl-g2-hint"><Icon name="alert" size={14} />{p.freq} Hz is above fs/2 = {p.fs / 2} Hz: the samples trace a false, slower wave (aliasing).</p> : null}
            {p.sag ? <p className="mcl-g2-hint"><Icon name="alert" size={14} />The converter's reference is really {adcRef(p).toFixed(2)} V, but the codes are scaled by {p.vref} V: every reconstruction reads {((1 / 0.9 - 1) * 100).toFixed(0)} % high.</p> : null}
            {p.stuck ? <p className="mcl-g2-hint"><Icon name="alert" size={14} />Bit 2 is stuck at 0: codes 4 – 7, 12 – 15, … never appear (missing codes), so the error jumps to 4 LSB.</p> : null}
          </Panel>

          <div className="mcl-l26-codewrap">
            <CodeEditor lab={lab} title="Code Editor (C - Read ADC and Print Values)" languages={[
              { label: "C (Embedded)", code: DEMO }, { label: "8-bit", code: BITS8 }, { label: "16-bit", code: BITS16 },
              { label: "Oversample 16x (+2 bits)", code: OVERSAMPLE }, { label: "Bug: uint8_t result", code: BUG_U8 }, { label: "Bug: VREF 3.3 V", code: BUG_VREF },
            ]} />
            <section className="mcl-l26-serial" aria-label="Serial monitor">
              <div className="mcl-l26-serial-head">
                <b><Icon name="terminal" size={14} />Serial Monitor</b>
                <label><input type="checkbox" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} />Auto-scroll</label>
              </div>
              <div className="mcl-l26-serial-body" ref={serial} role="log">
                {uartLines.length ? uartLines.map((l, i) => <div key={i}>{l}</div>) : <div className="mute">No output yet: press Run.</div>}
              </div>
              <div className="mcl-l26-serial-foot">
                <label>Code ADC_BITS
                  <select value={codeBits ?? ""} disabled={codeBits === null} onChange={(e) => writeDefine("ADC_BITS", Number(e.target.value))} aria-label="Code ADC_BITS">
                    {codeBits !== null && !RESOLUTIONS.includes(codeBits as 8) ? <option value={codeBits}>{codeBits}-bit</option> : null}
                    {RESOLUTIONS.map((b) => <option key={b} value={b}>{b}-bit</option>)}
                  </select>
                </label>
                <span>VREF {codeVref ?? "?"} V · {fw ? `${mcu.adcBits}-bit ADC running` : "stopped"}</span>
              </div>
              {codeVref !== null && Math.abs(codeVref - p.vref) > 0.001 ? (
                <p className="mcl-g2-hint mcl-l19-drift"><Icon name="alert" size={14} />The code scales with VREF = {codeVref} V but the reference is {p.vref} V: printed voltages are {((codeVref / p.vref - 1) * 100).toFixed(0)} % off.<button type="button" onClick={() => writeDefine("VREF", p.vref)}>Write VREF into code &amp; Run</button></p>
              ) : null}
              {truncated ? <p className="mcl-g2-hint"><Icon name="alert" size={14} />The ADC returned {run!.last!.code} but the code printed {printedCode}: the variable keeps only the low 8 bits ({run!.last!.code} &amp; 0xFF). Use uint16_t.</p> : null}
            </section>
          </div>
        </div>

        <div className="mcl-l26-col">
          <Panel title="Live Digital Output (Current Sample)" icon="table" className="mcl-l26-live" tools={<span className="mcl-l26-at">Sample @ {sample.t < 1 ? `${(sample.t * 1000).toFixed(2)} ms` : `${sample.t.toFixed(3)} s`}</span>}>
            <table className="mcl-l26-table">
              <thead><tr><th>Resolution</th><th>Digital Output (Decimal)</th><th>Digital Output (Binary)</th><th>Reconstructed Voltage (V)</th></tr></thead>
              <tbody>
                {tableRows.map((b) => {
                  const c = b === fwBits && run?.last ? run.last.code : quantize(sample.v, b, p);
                  return (
                    <tr key={b} className={b === fwBits && fw ? "fw" : ""}>
                      <td style={{ color: RES_COLOR[b] ?? "#0f2547" }}>{b}-bit{b === fwBits && fw ? <em>code</em> : null}</td>
                      <td>{c}</td><td className="bin">{binary(c, b)}</td><td>{(c * lsb(b, p.vref)).toFixed(4)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mcl-l26-sub">Input at this instant: {sample.v.toFixed(4)} V (signal + noise).</p>
          </Panel>

          <Panel title="Quantization Metrics (Live)" icon="gauge" className="mcl-l26-met">
            <table className="mcl-l26-table">
              <thead><tr><th>Resolution</th><th>LSB Size (ΔV)</th><th>RMS Quant. Error</th><th>SNR (Ideal)</th></tr></thead>
              <tbody>
                {rows.map((b) => (
                  <tr key={b}><td style={{ color: RES_COLOR[b] }}>{b}-bit</td><td>{fmtV(lsb(b, p.vref))}</td><td>{fmtV(rmsQuantError(w, b, p))}</td><td>{idealSnr(b).toFixed(1)} dB</td></tr>
                ))}
              </tbody>
            </table>
            <p className={`mcl-l26-sub ${p.noise > lsb(topBits, p.vref) ? "warn" : ""}`}>
              {p.noise > lsb(topBits, p.vref)
                ? `${fmtV(p.noise)} RMS noise is ${(p.noise / lsb(topBits, p.vref)).toFixed(0)} LSB at ${topBits}-bit: only ~${eff.toFixed(1)} effective bits, the rest digitize noise.`
                : `Noise is below 1 LSB at ${topBits}-bit: ~${eff.toFixed(1)} effective bits.`}
            </p>
          </Panel>

          <Panel title="Learning Notes" icon="book" className="mcl-l26-notes">
            <div className="mcl-tabs mcl-l26-tabs" role="tablist">
              {([["concepts", "Key Concepts"], ["formulas", "Formulas"], ["tradeoffs", "Tradeoffs"], ["real", "Real-World"], ["check", "Check Yourself"]] as const).map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>)}
            </div>
            <div className="mcl-l26-learn">
              {tab === "concepts" ? (
                <>
                  <h3>Quantization and Resolution</h3>
                  <p>An ADC converts a continuous analog voltage into a discrete digital value. The resolution (number of bits) determines how many discrete levels are available, and thus the size of each quantization step (LSB).</p>
                  <div className="mcl-l26-formula">LSB (ΔV) = <span className="mcl-l25-frac"><span>V<sub>ref</sub></span><span>2<sup>N</sup></span></span><small>= {p.vref} V / {(2 ** fwBits).toLocaleString()} = {fmtV(lsb(fwBits, p.vref))} at {fwBits}-bit</small></div>
                  <ul>
                    <li>Higher resolution (more bits) gives smaller quantization steps and better fidelity.</li>
                    <li>Quantization error is the difference between the actual analog value and the reconstructed value.</li>
                    <li>Each additional bit improves the theoretical SNR by about 6 dB.</li>
                    <li>Choose resolution based on signal dynamics, noise, and application requirements.</li>
                  </ul>
                  <p className="mcl-l26-info"><Icon name="help" size={15} />In practice, other error sources (noise, reference accuracy, non-linearity) also affect overall ADC performance. Try the faults.</p>
                </>
              ) : null}
              {tab === "formulas" ? (
                <dl className="mcl-l26-fx">
                  <div><dt>Step size</dt><dd>LSB = V<sub>ref</sub> / 2<sup>N</sup> = {fmtV(lsb(fwBits, p.vref))}</dd></div>
                  <div><dt>Code</dt><dd>code = round(V<sub>in</sub> / LSB), clipped to 0 … 2<sup>N</sup> − 1 = {(2 ** fwBits - 1).toLocaleString()}</dd></div>
                  <div><dt>Reconstruction</dt><dd>V = code × LSB = {sample.code} × {fmtV(lsb(fwBits, p.vref))} = {(sample.code * lsb(fwBits, p.vref)).toFixed(4)} V</dd></div>
                  <div><dt>RMS error</dt><dd>e<sub>rms</sub> = LSB / √12 = {fmtV(lsb(fwBits, p.vref) / Math.sqrt(12))} (measured {fmtV(rmsQuantError(w, fwBits, p))})</dd></div>
                  <div><dt>Ideal SNR</dt><dd>SNR = 6.02 N + 1.76 dB = {idealSnr(fwBits).toFixed(1)} dB</dd></div>
                  <div><dt>ENOB</dt><dd>(SINAD − 1.76) / 6.02 = {enob(fwBits, p).toFixed(2)} bits with {fmtV(p.noise)} noise</dd></div>
                  <div><dt>Nyquist</dt><dd>f<sub>signal</sub> &lt; f<sub>s</sub> / 2 = {p.fs / 2} Hz</dd></div>
                </dl>
              ) : null}
              {tab === "tradeoffs" ? (
                <ul className="mcl-l26-trade">
                  <li><b>Speed:</b> SAR converters spend one clock per bit, so 16-bit conversions take longer than 8-bit.</li>
                  <li><b>Noise:</b> bits below the noise floor only record noise. Here {fmtV(p.noise)} RMS limits you to ~{enob(16, p).toFixed(1)} useful bits.</li>
                  <li><b>Reference:</b> a 0.1 % reference error is already 4 LSB at 12 bits; resolution is not accuracy.</li>
                  <li><b>Memory and bandwidth:</b> 16-bit samples need twice the storage of 8-bit ones.</li>
                  <li><b>Oversampling:</b> averaging 4<sup>k</sup> noisy samples adds k bits, trading sample rate for resolution.</li>
                </ul>
              ) : null}
              {tab === "real" ? (
                <ul className="mcl-l26-trade">
                  <li><b>Arduino Uno (ATmega328P):</b> 10-bit SAR, 5 V reference, LSB 4.88 mV.</li>
                  <li><b>STM32F4:</b> 12-bit SAR (selectable 6 / 8 / 10 / 12), 3.3 V, up to 2.4 MS/s.</li>
                  <li><b>ESP32:</b> 12-bit but noticeably non-linear near the rails; calibrate it.</li>
                  <li><b>STM32H7 / ADS1115:</b> 16-bit converters for precision sensors.</li>
                  <li><b>Audio codecs:</b> 24-bit sigma-delta, where noise and the reference set ~18 – 20 effective bits.</li>
                </ul>
              ) : null}
              {tab === "check" ? (
                <>
                  <ol className="mcl-steps">
                    {([
                      ["Observe", "Run the code: the serial monitor prints a 12-bit reading every 100 ms, and the 12-bit row is marked 'code'."],
                      ["Try", "Untick resolutions, switch to the Error view, and compare how big each staircase step is."],
                      ["Measure", `Now: 8-bit error ${fmtV(rmsQuantError(w, 8, p))} vs 16-bit ${fmtV(rmsQuantError(w, 16, p))} RMS; noise ${fmtV(p.noise)}.`],
                      ["Modify", "Set ADC_BITS to 8 or 16 and Run. Raise the frequency past fs/2, or push the offset until it clips."],
                      ["Run Again", "Load Bug: uint8_t result and Bug: VREF 3.3 V, read the hints, fix them and Run again."],
                    ] as const).map(([k, v]) => <li key={k}><b>{k}</b><span>{v}</span></li>)}
                  </ol>
                  <ul className="mcl-checks">
                    {([["Ran the code and read the serial output", seen.ran], ["Changed ADC_BITS in the code", seen.bits], ["Made the input clip", seen.clip], ["Made the signal alias", seen.alias], ["Raised noise above an 8-bit LSB", seen.noise], ["Injected a converter fault", seen.fault]] as const)
                      .map(([l, d]) => <li key={l} className={d ? "done" : ""}><Icon name={d ? "check" : "target"} size={14} />{l}</li>)}
                  </ul>
                  <p className="mcl-challenge"><b>Challenge:</b> What resolution do you need to see a 1 mV change with a 5 V reference? (Hint: LSB ≤ 1 mV.)</p>
                </>
              ) : null}
            </div>
          </Panel>
        </div>
      </div>
    </LabShell>
  );
}
