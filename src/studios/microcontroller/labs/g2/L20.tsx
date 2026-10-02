import { useEffect, useState } from "react";
import { useLab } from "../core/useLab";
import type { LabMeta } from "../registry";
import { CodeEditor } from "../ui/CodeEditor";
import { Icon } from "../ui/Icon";
import { LearningNotes, Panel, Toggle } from "../ui/Panels";
import { fmtHz, fmtSec, Scope } from "../ui/Scope";
import { LabShell } from "../ui/Shell";
import {
  applyConfig, bench20, CLK20, cntAt, codeConfig, DEMO, FROZEN, lastPair, NO_WRAP, P20_DEFAULT, readout, RISING_ONLY, setup20, TICKS, tickS, world20, writeCcr2,
  type Edge20, type P20,
} from "./L20sim";

const EDGE_LABEL: Record<Edge20, string> = { rising: "Rising", falling: "Falling", both: "Rising + Falling", off: "—" };

export default function L20({ meta }: { meta: LabMeta }) {
  const lab = useLab<P20>({
    slug: meta.slug, code: DEMO, params: P20_DEFAULT, rebuildOn: ["noClock"],
    mcu: () => ({ ips: 120_000, clock: CLK20, strictClock: true }),
    setup: (m, p) => setup20(m, p),
    world: world20,
  });
  const { mcu, params } = lab;
  const fw = mcu.fw;
  const b = bench20(mcu);
  const cc = codeConfig(lab.compiledCode);
  const editable = cc.edge !== null && cc.oc2m !== null && cc.tickNs !== null;
  const ccer = mcu.peek("TIM3.CCER"), ccmr1 = mcu.peek("TIM3.CCMR1"), sr = mcu.peek("TIM3.SR"), dier = mcu.peek("TIM3.DIER");
  const liveEdge: Edge20 = !(ccer & 1) ? "off" : (ccer & 8) ? "both" : (ccer & 2) ? "falling" : "rising";
  const oc2m = (ccmr1 >> 12) & 7;
  const ccr1 = mcu.peek("TIM3.CCR1"), ccr2 = mcu.peek("TIM3.CCR2");
  const tick = tickS(mcu);
  const cycle = (mcu.peek("TIM3.ARR") + 1) * tick;
  const tickNs = cc.tickNs ?? 100;
  const r = readout(mcu, tickNs);
  const captures = fw?.num("captures") ?? 0, compares = fw?.num("compare_events") ?? 0;
  const pair = lastPair(b);
  const truePeriod = 1 / params.freq;
  const width = Math.min(params.width, truePeriod - 2e-6);
  const aliased = truePeriod > cycle;

  const [pending, setPending] = useState<string | null>(null);
  const [seen, setSeen] = useState({ width: false, ccr2: false, edge: false, bug: false });
  useEffect(() => { if (pending !== null && lab.code === pending) { setPending(null); lab.run(); } }, [pending, lab]);
  const edit = (c: Parameters<typeof applyConfig>[1]) => {
    const next = applyConfig(lab.code, c);
    if (!next) { lab.setNotice("These controls rewrite the TIM3 register lines. Restore them (or load \"Capture both edges\") to use the channel controls."); return; }
    lab.setCode(next); setPending(next);
  };
  const ccr2Drift = cc.ccr2 !== null && cc.ccr2 !== ccr2 && lab.running;

  // Oscilloscope-style trigger on the latest CH1 rising edge that leaves a full window behind it.
  const win = Math.max(0.002, Math.min(0.2, Math.max(3 / params.freq, 2.2 * cycle)));
  const pre = win * 0.08;
  const rises = (mcu.edges.get("PA6") ?? []).filter(([, lv]) => lv === 1);
  let trig = -1;
  for (let i = rises.length - 1; i >= 0; i--) { const t = rises[i]![0]; if (t + win - pre <= mcu.time) { trig = t; break; } }
  const view = trig >= 0 ? trig + win - pre : mcu.time;
  const inWin = b.captures.filter((c) => c.t > view - win && c.t <= view);
  const out0 = b.out.find(([t]) => t > view - win);
  const outInitial = out0 ? 1 - out0[1] : (b.out[b.out.length - 1]?.[1] ?? 0);

  const widthOk = Math.abs(params.width - P20_DEFAULT.width) > 1e-5 && r.pulseS !== null && Math.abs(r.pulseS - width) / width < 0.01 && cc.edge === "both";
  const ccr2Moved = ccr2 !== 35000 && compares > 0;
  const edgeTried = lab.compiledCode !== DEMO && (cc.edge !== "both" || cc.tickNs !== 100 || cc.oc2m !== 3) && captures + compares > 0;
  const bugSeen = (lab.compiledCode === NO_WRAP && r.pulseS !== null && Math.abs(r.pulseS - width) / width > 0.05) || (aliased && captures > 4) || (params.glitch && captures > 4) || (params.noClock && mcu.time > 0.2);
  useEffect(() => {
    if ((widthOk && !seen.width) || (ccr2Moved && !seen.ccr2) || (edgeTried && !seen.edge) || (bugSeen && !seen.bug))
      setSeen((x) => ({ width: x.width || widthOk, ccr2: x.ccr2 || ccr2Moved, edge: x.edge || edgeTried, bug: x.bug || bugSeen }));
  }, [widthOk, ccr2Moved, edgeTried, bugSeen, seen]);

  const regs: Array<[string, string, string?]> = [
    ["CCMR1.CC1S", `${ccmr1 & 3 ? "01 input TI1" : "00 output"}`, (ccmr1 & 3) === 1 ? "" : "warn"],
    ["CCER CC1P/NP", EDGE_LABEL[liveEdge], liveEdge === "off" ? "warn" : ""],
    ["CCMR1.OC2M", oc2m === 3 ? "011 toggle" : oc2m === 0 ? "000 frozen" : oc2m.toString(2).padStart(3, "0")],
    ["DIER CC1IE/CC2IE", `${(dier >> 1) & 1} / ${(dier >> 2) & 1}`],
    ["SR CC1IF/CC2IF", `${(sr >> 1) & 1} / ${(sr >> 2) & 1}`, sr & 6 ? "warn" : ""],
    ["SR CC1OF", String((sr >> 9) & 1), (sr >> 9) & 1 ? "bad" : ""],
  ];
  const fmtMs = (s: number | null) => (s === null ? "—" : `${(s * 1e3).toFixed(2)} ms`);

  return (
    <LabShell meta={meta} lab={lab} subtitle="Measure pulse widths and generate timed output events using timer capture/compare."
      components={["NUCLEO-F401RE (STM32F401RE), SYSCLK 80 MHz, TIM3 kernel clock 80 MHz", "Function generator → PA6 (TIM3_CH1, AF2), 0–3.3 V pulses", "PA7 (TIM3_CH2, AF2) output compare → scope channel 2", "TIM3: 16-bit general-purpose timer, IRQ 29"]}>
      <div className="mcl-l20-grid">
        <Panel title="Capture / Compare Timing Lab" icon="wave" className="mcl-sim g-timing" tools={
          <span className={`mcl-chip ${captures ? "mcl-chip-live" : "mcl-chip-warn"}`}>Trigger · CH1 rising · {fmtSec(win)}</span>
        }>
          <h4 className="mcl-l20-h">Input Signal (CH1 Capture)</h4>
          <Scope traces={[{ label: "PA6 TIM3_CH1", color: "#3b82f6", edges: mcu.edges.get("PA6") ?? [], initial: 0 }]}
            now={view} window={win} height={96} frame={lab.frame} ariaLabel="Input pulse train on PA6 with capture points"
            markers={inWin.slice(-8).map((c) => ({ t: c.t, label: `${c.rising ? "↑" : "↓"}${c.ccr}`, color: c.rising ? "#60a5fa" : "#f59e0b" }))} />
          <h4 className="mcl-l20-h">Output Compare (CH2)</h4>
          <Scope traces={[
            { label: "PA7 TIM3_CH2", color: "#f59e0b", edges: b.out, initial: outInitial },
            { label: "TIM3 CNT", color: "#64748b", sample: (t) => cntAt(b, t), min: 0, max: 65536 * 1.06 },
          ]} lanes now={view} window={win} height={124} frame={lab.frame} ariaLabel="CH2 output compare toggling at CCR2, with the TIM3 counter"
            thresholds={[{ value: ccr2, color: "#f59e0b", label: "CCR2", trace: 1 }]} />
          <p className="mcl-l20-read">
            <span>Measured pulse width: <b className={r.pulseS !== null && Math.abs(r.pulseS - width) / width > 0.02 ? "bad" : ""}>{fmtMs(r.pulseS)}</b></span>
            <span>Frequency: <b className={aliased ? "bad" : ""}>{r.freqHz === null ? "—" : fmtHz(r.freqHz)}</b></span>
            <span>Compare event: <b>{fmtMs(r.compareS)}</b></span>
            <span className="dim">Generator: {fmtMs(width)} @ {fmtHz(params.freq)}</span>
          </p>
          {aliased ? <p className="mcl-g2-hint warn"><Icon name="alert" size={14} />The input period ({fmtMs(truePeriod)}) is longer than one 16-bit counter cycle ({fmtMs(cycle)}): the capture difference wraps more than once and the frequency reads high. Use a 1 µs tick or count update events.</p> : null}
          {params.width >= truePeriod ? <p className="mcl-g2-hint warn"><Icon name="alert" size={14} />Pulse width is longer than the period; the generator clamps it just below 100% duty.</p> : null}
        </Panel>

        <Panel title="Timer Channels" icon="sliders" className="g-channels">
          <div className="mcl-g2-row"><span>CH1 Mode</span>
            <select className="mcl-l17-pill" aria-label="CH1 mode" value={(cc.edge ?? liveEdge) === "off" ? "off" : "ic"} disabled={!editable}
              onChange={(e) => edit({ edge: e.target.value === "off" ? "off" : "both" })}>
              <option value="ic">Input Capture</option><option value="off">Off</option>
            </select>
          </div>
          <div className="mcl-g2-row"><span>Edge</span>
            <select className="mcl-l17-pill" aria-label="Capture edge" value={(cc.edge ?? liveEdge) === "off" ? "both" : (cc.edge ?? liveEdge)} disabled={!editable || cc.edge === "off"}
              onChange={(e) => edit({ edge: e.target.value as Edge20 })}>
              <option value="rising">Rising</option><option value="falling">Falling</option><option value="both">Rising + Falling</option>
            </select>
          </div>
          <div className="mcl-g2-row"><span>CCR1</span><b className="mcl-l20-val">{ccr1.toLocaleString("en-US")}</b></div>
          <div className="mcl-g2-row"><span>CH2 Mode</span>
            <select className="mcl-l17-pill" aria-label="CH2 mode" value={cc.oc2m ?? oc2m} disabled={!editable} onChange={(e) => edit({ oc2m: Number(e.target.value) })}>
              <option value={3}>Output Compare</option><option value={0}>Frozen (IRQ only)</option>
            </select>
          </div>
          <div className="mcl-g2-row"><span>CCR2</span>
            <input className="mcl-l19-num" type="number" min={0} max={65535} step={100} aria-label="CCR2" value={ccr2} disabled={!fw}
              onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) writeCcr2(mcu, v); }} />
          </div>
          <div className="mcl-g2-row"><span>Timer Tick</span>
            <select className="mcl-l17-pill" aria-label="Timer tick" value={cc.tickNs ?? 100} disabled={!editable} onChange={(e) => edit({ tickNs: Number(e.target.value) })}>
              {TICKS.map((t) => <option key={t.ns} value={t.ns}>{t.label}</option>)}
            </select>
          </div>
          <div className="mcl-l17-regs" aria-label="Live TIM3 register readback">
            {regs.map(([k, v, cls]) => <div key={k}><span>{k}</span><b className={cls}>{v}</b></div>)}
          </div>
          {Math.abs(tick * 1e9 - tickNs) > 0.5 && fw ? <p className="mcl-g2-hint warn"><Icon name="alert" size={14} />TICK_NS says {tickNs} ns but PSC gives {(tick * 1e9).toFixed(1)} ns per tick: every converted time is off by ×{(tick * 1e9 / tickNs).toFixed(2)}.</p> : null}
          {ccr2Drift ? (
            <p className="mcl-g2-hint mcl-l19-drift"><Icon name="edit" size={14} />CCR2 was changed live ({ccr2}); the code still loads {cc.ccr2}.
              <button type="button" onClick={() => edit({ ccr2 })}>Write into code &amp; Run</button></p>
          ) : null}
          {!editable ? <p className="mcl-g2-hint"><Icon name="bulb" size={14} />The channel controls rewrite the TIM3 PSC / CCMR1 / CCER lines and TICK_NS. Those lines were edited by hand, so the controls are read-only.</p> : null}
        </Panel>

        <CodeEditor lab={lab} className="g-code" languages={[{ label: "Capture both edges", code: DEMO }, { label: "Rising only", code: RISING_ONLY }, { label: "Frozen compare", code: FROZEN }, { label: "Bug: no 16-bit wrap", code: NO_WRAP }]} />

        <div className="g-experiment mcl-l13-side">
          <Panel title="Experiment" icon="target">
            <p className="mcl-l15-intro">Move the input pulse-width slider. Capture timestamps should change automatically. Adjust CCR2 and see the output edge move on the timeline.</p>
            <label className="mcl-g2-range">Pulse width<input type="range" min={0.05} max={8} step={0.01} value={+(params.width * 1e3).toFixed(2)} onChange={(e) => lab.setParam("width", Number(e.target.value) / 1e3)} /><output>{(params.width * 1e3).toFixed(2)} ms</output></label>
            <label className="mcl-g2-range">Input frequency<input type="range" min={50} max={1000} step={0.1} value={params.freq} onChange={(e) => lab.setParam("freq", Number(e.target.value))} /><output>{params.freq.toFixed(1)} Hz</output></label>
            <label className="mcl-g2-range">CCR2<input type="range" min={0} max={65535} step={50} value={ccr2} disabled={!fw} onChange={(e) => writeCcr2(mcu, Number(e.target.value))} /><output>{ccr2.toLocaleString("en-US")}</output></label>
            <div className="mcl-l19-live mcl-l20-caps">
              <div><span>Rise CCR1</span><b>{pair.rise ? pair.rise.ccr.toLocaleString("en-US") : "—"}</b></div>
              <div><span>Fall CCR1</span><b>{pair.fall ? pair.fall.ccr.toLocaleString("en-US") : "—"}</b></div>
              <div><span>pulse_ticks</span><b>{(fw?.num("pulse_ticks") ?? 0).toLocaleString("en-US")}</b></div>
              <div><span>period_ticks</span><b className={aliased ? "bad" : ""}>{(fw?.num("period_ticks") ?? 0).toLocaleString("en-US")}</b></div>
              <div><span>Captures</span><b className="ok">{captures}</b></div>
              <div><span>Compare events</span><b>{compares}</b></div>
            </div>
            <div className="mcl-g2-faults">
              <b><Icon name="bug" size={14} />Fault injection</b>
              <Toggle label="Glitch on the input" checked={params.glitch} onChange={(v) => lab.setParam("glitch", v)} hint="A 1.5 µs dropout in the middle of every pulse adds two extra captures, so the firmware measures half a pulse. IC1F input filtering exists for exactly this." />
              <Toggle label="TIM3 clock not enabled" checked={params.noClock} onChange={(v) => lab.setParam("noClock", v)} hint="RCC_APB1ENR.TIM3EN stays 0: TIM3 register writes are dropped, nothing is captured and PA7 never toggles" />
            </div>
          </Panel>
          <LearningNotes variant="tasks" title="Learning Tasks" notes={{
            takeaways: [],
            observe: "Every input edge drops a marker labelled with the CNT value latched into CCR1. The difference between a rise and the next fall is the pulse width in ticks.",
            tryIt: "Drag the pulse-width slider: pulse_ticks follows at once, with no code change. Then drag CCR2 and watch the orange edge slide along the counter ramp.",
            measure: r.pulseS !== null ? `Firmware: ${fmtMs(r.pulseS)} pulse, ${r.freqHz ? fmtHz(r.freqHz) : "—"}. Generator: ${fmtMs(width)} @ ${fmtHz(params.freq)}. Resolution: ${(tick * 1e9).toFixed(0)} ns.` : "Run the firmware and wait for a rising and a falling capture.",
            modify: "Switch the edge to Rising only: frequency still works but the width never updates. Change the timer tick to 1 µs and compare the resolution.",
            runAgain: "Load \"Bug: no 16-bit wrap\" and Run. About one pulse in four straddles the counter wrap and its width comes out wildly wrong.",
            challenge: "Drop the input below 152.6 Hz with a 100 ns tick. Why does the frequency read high, and what two fixes are there?",
            checks: [
              { label: "Changed the pulse width and the capture followed", done: seen.width },
              { label: "Moved CCR2 and shifted the output edge", done: seen.ccr2 },
              { label: "Ran with a different edge, tick or CH2 mode", done: seen.edge },
              { label: "Reproduced a wrap, aliasing, glitch or clock fault", done: seen.bug },
            ],
          }} />
        </div>
      </div>
    </LabShell>
  );
}
