import { useEffect, useState } from "react";
import { useLab } from "../core/useLab";
import type { LabMeta } from "../registry";
import { CodeEditor } from "../ui/CodeEditor";
import { HwDefs, NucleoBoard, SvgLed } from "../ui/Hardware";
import { Icon } from "../ui/Icon";
import { LearningNotes, Panel, Seg, Toggle } from "../ui/Panels";
import { fmtHz, fmtSec } from "../ui/Scope";
import { LabShell } from "../ui/Shell";
import { NumIn } from "./NumIn";
import {
  applyConfig, ARR_BUG, BREATHING, CCR_BUG, channel, CLK21, codeConfig, DEMO, liveConfig, P21_DEFAULT, setArr, setDuty, setEnabled, setFreq, setMode, setPsc, setup21, world21,
  type Chan21, type P21,
} from "./L21sim";

const PIN = { 1: { key: "PA8", ard: "D7" }, 2: { key: "PA9", ard: "D8" } } as const;
/** 1-2-5 time/div that puts the screen (10 divisions) closest to five periods. */
const divFor = (period: number) => {
  const target = (period * 5) / 10, p = 10 ** Math.floor(Math.log10(target));
  return [1, 2, 5, 10].map((m) => m * p).reduce((a, b) => (Math.abs(Math.log(b / target)) < Math.abs(Math.log(a / target)) ? b : a));
};
/** Fixed three-decimal reading in the unit the mockup uses (ms below 1 s, µs below 1 ms). */
const fix3 = (s: number, unitOf = s) => (unitOf >= 1 ? `${s.toFixed(3)} s` : unitOf >= 1e-3 ? `${(s * 1e3).toFixed(3)} ms` : `${(s * 1e6).toFixed(3)} µs`);
const fix3Hz = (f: number) => (f >= 1e6 ? `${(f / 1e6).toFixed(3)} MHz` : f >= 1e3 ? `${(f / 1e3).toFixed(3)} kHz` : `${f.toFixed(3)} Hz`);

function Waveform({ c, other, otherLabel }: { c: Chan21; other?: Chan21; otherLabel?: string }) {
  const W = 560, H = 250, X0 = 40, X1 = W - 12, HI = 84, LO = 196;
  const div = divFor(1 / c.freq), win = div * 10;
  const tx = (t: number) => X0 + (t / win) * (X1 - X0);
  const off = win * 0.06;
  const path = (ch: Chan21, hi: number, lo: number) => {
    if (!ch.enabled || ch.duty <= 0) return `M${X0} ${lo} H${X1}`;
    if (ch.duty >= 1) return `M${X0} ${hi} H${X1}`;
    let d = `M${X0} ${lo}`;
    for (let k = -1; ; k++) {
      const r = off + k * ch.period, f = r + ch.pulse;
      if (r > win) break;
      if (f > 0) d += ` H${tx(Math.max(0, r))} V${hi} H${tx(Math.min(win, f))} V${lo}`;
    }
    return `${d} H${X1}`;
  };
  const r1 = off + c.period, f1 = r1 + c.pulse, r2 = r1 + c.period;
  const showAnn = c.enabled && c.duty > 0 && c.duty < 1 && r2 < win;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mcl-l21-wave" role="img" aria-label={`PWM waveform: ${(c.duty * 100).toFixed(1)} percent duty at ${fmtHz(c.freq)}`}>
      <rect x={X0} y={20} width={X1 - X0} height={H - 44} fill="#0b1626" rx={4} />
      {Array.from({ length: 11 }, (_, i) => <line key={`v${i}`} x1={X0 + i * (X1 - X0) / 10} x2={X0 + i * (X1 - X0) / 10} y1={20} y2={H - 24} stroke="#1c2b42" />)}
      {Array.from({ length: 7 }, (_, i) => <line key={`h${i}`} x1={X0} x2={X1} y1={20 + i * (H - 44) / 6} y2={20 + i * (H - 44) / 6} stroke="#1c2b42" />)}
      <text x={X0 - 6} y={HI + 4} textAnchor="end" fontSize="11" fill="#475569">3.3V</text>
      <text x={X0 - 6} y={LO + 4} textAnchor="end" fontSize="11" fill="#475569">0V</text>
      {other ? <path d={path(other, HI + 22, LO - 4)} fill="none" stroke="#a78bfa" strokeWidth={1.6} strokeDasharray="5 3" opacity={0.85} /> : null}
      <path d={path(c, HI, LO)} fill="none" stroke="#3b9bff" strokeWidth={2.4} />
      {showAnn ? (
        <g fontSize="11" fill="#e2e8f0">
          <line x1={tx(r1)} x2={tx(r1)} y1={36} y2={HI} stroke="#e2e8f0" strokeDasharray="3 3" />
          <line x1={tx(f1)} x2={tx(f1)} y1={58} y2={HI} stroke="#e2e8f0" strokeDasharray="3 3" />
          <line x1={tx(r2)} x2={tx(r2)} y1={36} y2={HI} stroke="#e2e8f0" strokeDasharray="3 3" />
          <path d={`M${tx(r1) + 3} 42 H${tx(r2) - 3} M${tx(r1) + 8} 38 L${tx(r1) + 3} 42 L${tx(r1) + 8} 46 M${tx(r2) - 8} 38 L${tx(r2) - 3} 42 L${tx(r2) - 8} 46`} stroke="#e2e8f0" fill="none" />
          <text x={(tx(r1) + tx(r2)) / 2} y={35} textAnchor="middle" fontWeight="700">Period (T)</text>
          <path d={`M${tx(r1) + 3} 66 H${tx(f1) - 3} M${tx(r1) + 7} 63 L${tx(r1) + 3} 66 L${tx(r1) + 7} 69 M${tx(f1) - 7} 63 L${tx(f1) - 3} 66 L${tx(f1) - 7} 69`} stroke="#e2e8f0" fill="none" />
          <text x={(tx(r1) + tx(f1)) / 2} y={60} textAnchor="middle" fontSize="10">Pulse Width (Ton)</text>
        </g>
      ) : null}
      {!c.enabled ? <text x={(X0 + X1) / 2} y={(HI + LO) / 2} textAnchor="middle" fontSize="13" fill="#94a3b8">Channel output disabled: pin idles low</text> : null}
      {c.enabled && c.duty >= 1 ? <text x={(X0 + X1) / 2} y={(HI + LO) / 2 + 30} textAnchor="middle" fontSize="12" fill="#fbbf24">CCR ≥ ARR + 1: output never goes low (100 %)</text> : null}
      <text x={X1 - 6} y={H - 30} textAnchor="end" fontSize="11" fill="#cbd5e1">Time: {fmtSec(div)}/div</text>
      {other && otherLabel ? <text x={X0 + 8} y={H - 30} fontSize="10.5" fill="#a78bfa">- - {otherLabel}</text> : null}
    </svg>
  );
}

export default function L21({ meta }: { meta: LabMeta }) {
  const lab = useLab<P21>({
    slug: meta.slug, code: DEMO, params: P21_DEFAULT, rebuildOn: ["halfClock"],
    mcu: () => ({ part: "F103", clock: CLK21, ips: 120_000 }),
    setup: (m, p) => setup21(m, p),
    world: world21,
  });
  const { mcu, params } = lab;
  const fw = mcu.fw;
  const [tab, setTab] = useState<1 | 2>(1);
  const [info, setInfo] = useState(false);
  const c = channel(mcu, tab), c1 = channel(mcu, 1), c2 = channel(mcu, 2);
  const other = tab === 1 ? c2 : c1;
  const psc = mcu.peek("TIM1.PSC"), arr = mcu.peek("TIM1.ARR");
  const fTim = mcu.timerClock("TIM1") / (psc + 1);
  const cc = codeConfig(lab.compiledCode);
  const live = liveConfig(mcu);
  const drift = !!fw && lab.running && (["psc", "arr", "ccr1", "ccr2", "mode1", "mode2", "en1", "en2"] as const).some((k) => cc[k] !== null && cc[k] !== live[k]);
  const [pending, setPending] = useState<string | null>(null);
  useEffect(() => { if (pending !== null && lab.code === pending) { setPending(null); lab.run(); } }, [pending, lab]);
  const writeCode = () => { const next = applyConfig(lab.code, live); lab.setCode(next); setPending(next); };
  const shellLab = { ...lab, resetLab: () => { lab.resetLab(); setTab(1); setInfo(false); setPending(null); } };
  const dutyPct = c.enabled ? (c.ccr / (arr + 1)) * 100 : (mcu.peek(`TIM1.CCR${tab}`) / (arr + 1)) * 100;
  const shownDuty = Math.min(100, Math.round(dutyPct * 10) / 10);
  const steps = arr + 1;
  const ledDuty = c1.duty;

  const breathing = lab.compiledCode.includes("__HAL_TIM_SET_COMPARE") && lab.running;
  const checks = [
    { label: "Changed the duty cycle and saw the LED dim", done: c1.enabled && Math.abs(c1.duty - 0.5) > 0.05 },
    { label: "Tried another frequency (e.g. 500 Hz or 5 kHz)", done: c1.enabled && Math.abs(c1.freq - 1000) > 50 },
    { label: "Modified the prescaler or auto-reload", done: psc !== 71 || (cc.psc !== null && cc.psc !== 71) },
    { label: "Enabled CH2 on PA9 and compared outputs", done: c2.enabled },
    { label: "Ran a breathing-LED loop", done: breathing },
  ];

  return (
    <LabShell meta={meta} lab={shellLab} subtitle="Learn to generate PWM signals using STM32 timers, and control LED brightness with variable duty cycle."
      components={["STM32 Nucleo-F103RB (STM32F103RBT6, Cortex-M3, 72 MHz)", "Red LED + 330 Ω on PA8 (TIM1_CH1, Arduino D7)", "Optional second LED on PA9 (TIM1_CH2, D8)", "TIM1: 16-bit advanced-control timer on APB2 (72 MHz)"]}>
      <div className="mcl-grid mcl-l21-top">
        <Panel title="STM32 Simulator" icon="cpu" className="mcl-sim" tools={<>
          <span className="mcl-l21-board">STM32 Nucleo-F103RB</span>
          <button type="button" className={`mcl-small-btn ${info ? "on" : ""}`} aria-pressed={info} onClick={() => setInfo((v) => !v)}><Icon name="chip" size={13} /> Board Info</button>
        </>}>
          <div className="mcl-l21-sim">
            <svg viewBox="0 0 230 330" className="mcl-svg" role="img" aria-label="Nucleo-F103RB board">
              <HwDefs id="l21" />
              <NucleoBoard id="l21" x={6} y={6} scale={0.92} model="NUCLEO-F103RB" chipLabel="STM32F103" power={!!fw} onReset={lab.resetSim} />
            </svg>
            <div className="mcl-l21-side">
              {info ? (
                <div className="mcl-l21-pins">
                  <b>Timer pins</b>
                  <div><span>PA8 · D7</span><em>TIM1_CH1</em><i className={c1.enabled ? "on" : ""}>{c1.enabled ? `${(c1.duty * 100).toFixed(0)} %` : "off"}</i></div>
                  <div><span>PA9 · D8</span><em>TIM1_CH2</em><i className={c2.enabled ? "on" : ""}>{c2.enabled ? `${(c2.duty * 100).toFixed(0)} %` : "off"}</i></div>
                  <div><span>PA10 · D2</span><em>TIM1_CH3</em><i>free</i></div>
                  <div><span>PA11</span><em>TIM1_CH4</em><i>free</i></div>
                  <p>TIM1 is an advanced timer on APB2: its outputs also need BDTR.MOE, which HAL_TIM_PWM_Start sets for you.</p>
                </div>
              ) : (
                <div className="mcl-l21-led">
                  <b>LED (PA8 - TIM1_CH1)</b>
                  <svg viewBox="0 0 80 90" aria-hidden><HwDefs id="l21l" /><SvgLed id="l21l" x={40} y={34} r={16} on={ledDuty > 0.001} brightness={Math.pow(ledDuty, 0.55)} color="red" /><line x1={33} y1={52} x2={33} y2={86} stroke="#94a3b8" strokeWidth={2.4} /><line x1={47} y1={52} x2={47} y2={80} stroke="#94a3b8" strokeWidth={2.4} /></svg>
                  <small>PWM Output</small>
                  <div className="mcl-l21-bar"><i style={{ width: `${ledDuty * 100}%` }} /></div>
                  <small>Brightness: {(ledDuty * 100).toFixed(0)}%</small>
                </div>
              )}
              <dl className="mcl-l21-kv">
                <div><dt>Board:</dt><dd>Nucleo-F103RB</dd></div>
                <div><dt>MCU:</dt><dd>STM32F103RBT6</dd></div>
                <div><dt>Clock:</dt><dd className={params.halfClock ? "bad" : ""}>{params.halfClock ? "36 MHz (TIM1)" : "72 MHz"}</dd></div>
                <div><dt>Toolchain:</dt><dd>STM32Cube HAL</dd></div>
              </dl>
            </div>
          </div>
        </Panel>

        <Panel title={`PWM Waveform (CH${tab} - ${PIN[tab].key})`} icon="wave" tools={<span className={`mcl-chip ${c.enabled ? "mcl-chip-live" : "mcl-chip-warn"}`}>{!fw ? "Stopped" : c.enabled ? (lab.running ? "Running" : "Paused") : "Output off"}</span>}>
          <Waveform c={c} other={other.enabled ? other : undefined} otherLabel={`CH${tab === 1 ? 2 : 1} (${PIN[tab === 1 ? 2 : 1].key})`} />
          <div className="mcl-l21-sl">
            <span>Duty Cycle: <b>{shownDuty.toFixed(shownDuty % 1 ? 1 : 0)}%</b></span>
            <input type="range" min={0} max={100} step={1} value={Math.round(shownDuty)} disabled={!fw} aria-label="Duty cycle" onChange={(e) => setDuty(mcu, tab, Number(e.target.value))} />
            <NumIn value={Math.round(shownDuty)} min={0} max={100} label="Duty cycle percent" onCommit={(v) => setDuty(mcu, tab, v)} /><em>%</em>
          </div>
          <div className="mcl-l21-sl">
            <span>Frequency: <b>{fmtHz(c1.freq)}</b></span>
            <input type="range" min={1.3} max={5} step={0.01} value={Math.log10(Math.max(20, c1.freq))} disabled={!fw} aria-label="Frequency (log scale)" onChange={(e) => setFreq(mcu, 10 ** Number(e.target.value))} />
            <NumIn value={Math.round(c1.freq)} min={16} max={100000} label="Frequency in hertz" onCommit={(v) => setFreq(mcu, v)} /><em>Hz</em>
          </div>
          <div className="mcl-l21-metrics">
            <div><small>Duty Cycle</small><b>{(c.duty * 100).toFixed(1)} %</b></div>
            <div><small>Period (T)</small><b>{fix3(c.period)}</b></div>
            <div><small>Frequency</small><b className="blue">{fix3Hz(c.freq)}</b></div>
            <div><small>Pulse Width (Ton)</small><b>{fix3(c.pulse, c.period)}</b></div>
          </div>
          <p className="mcl-l21-res">Resolution: ARR + 1 = {steps.toLocaleString("en-US")} steps ({Math.log2(steps).toFixed(1)} bits){steps < 100 ? " - duty can only move in coarse steps; lower PSC for finer control" : ""}</p>
        </Panel>

        <Panel title="Channel Settings" icon="sliders" className="mcl-l21-chan">
          <div className="mcl-l21-chanmain">
          <Seg value={tab} onChange={(v) => setTab(v)} options={[{ value: 1, label: "CH1 (PA8)" }, { value: 2, label: "CH2 (PA9)" }]} />
          <div className="mcl-l21-set">
            <Toggle label="Enable Channel" checked={(mcu.peek("TIM1.CCER") >> ((tab - 1) * 4) & 1) === 1} onChange={(v) => setEnabled(mcu, tab, v)} />
            <label><span>Timer</span><b className="mcl-l21-pill">TIM1</b></label>
            <label><span>Mode</span>
              <select className="mcl-l21-sel" aria-label="PWM mode" value={c.mode} disabled={!fw} onChange={(e) => setMode(mcu, tab, Number(e.target.value) as 1 | 2)}>
                <option value={1}>PWM Mode 1</option><option value={2}>PWM Mode 2</option>
              </select>
            </label>
            <label className="wide"><span>Duty Cycle</span>
              <input type="range" min={0} max={100} value={Math.round(shownDuty)} disabled={!fw} aria-label="Channel duty cycle" onChange={(e) => setDuty(mcu, tab, Number(e.target.value))} />
              <NumIn value={Math.round(shownDuty)} min={0} max={100} label="Channel duty percent" width={52} onCommit={(v) => setDuty(mcu, tab, v)} /><em>%</em>
            </label>
            <label className="wide"><span>Frequency</span>
              <input type="range" min={1.3} max={5} step={0.01} value={Math.log10(Math.max(20, c1.freq))} disabled={!fw} aria-label="Channel frequency (log scale)" onChange={(e) => setFreq(mcu, 10 ** Number(e.target.value))} />
              <NumIn value={Math.round(c1.freq)} min={16} max={100000} label="Channel frequency hertz" width={64} onCommit={(v) => setFreq(mcu, v)} /><em>Hz</em>
            </label>
            <label><span>Prescaler (PSC)</span><NumIn value={psc} min={0} max={65535} label="Prescaler" width={96} onCommit={(v) => setPsc(mcu, v)} /></label>
            <label><span>Auto-reload (ARR)</span><NumIn value={arr} min={1} max={65535} label="Auto-reload" width={96} onCommit={(v) => setArr(mcu, v)} /></label>
          </div>
          </div>
          <div className="mcl-l21-chanside">
          <div className="mcl-l21-info">
            <Icon name="bulb" size={14} />
            <div>
              <b>PWM Output: {PIN[tab].key} ({PIN[tab].ard})</b>
              <span>Timer Clock: {fmtHz(fTim)} ({fmtHz(mcu.timerClock("TIM1"))} / {psc + 1})</span>
              <span>Update Event: {fmtHz(c1.freq)}</span>
            </div>
          </div>
          {drift ? <p className="mcl-g2-hint mcl-l19-drift"><Icon name="edit" size={14} />Registers changed live; main.c still has the old values.<button type="button" onClick={writeCode}>Write into code &amp; Run</button></p> : null}
          <div className="mcl-g2-faults">
            <b><Icon name="bug" size={14} />Fault injection</b>
            <Toggle label="APB2 timer clock halved" checked={params.halfClock} onChange={(v) => lab.setParam("halfClock", v)} hint="TIM1 gets 36 MHz instead of 72 MHz: every frequency is half of what the code computed" />
            <Toggle label="CC1P stuck at 1" checked={params.polarity} onChange={(v) => lab.setParam("polarity", v)} hint="Output polarity inverted on CH1: the LED is bright when the code asks for dim" />
          </div>
          </div>
        </Panel>
      </div>

      <div className="mcl-grid mcl-l21-bot">
        <CodeEditor lab={lab} languages={[{ label: "main.c (HAL)", code: DEMO }, { label: "Breathing LED", code: BREATHING }, { label: "Bug: Period = 1000", code: ARR_BUG }, { label: "Bug: Pulse > Period", code: CCR_BUG }]} />
        <LearningNotes title="Learning Notes & Tasks" notes={{
          takeaways: [
            "PWM (Pulse Width Modulation) switches a pin fully on and off; the average voltage follows the duty cycle.",
            "Frequency = timer clock / (PSC + 1) / (ARR + 1). Duty = CCR / (ARR + 1).",
            "PWM Mode 1 is high while CNT < CCR; Mode 2 is the inverse.",
            "ARR also sets the resolution: ARR + 1 steps of duty.",
            "Real-world uses: LED dimming, motor speed, servo position, DC-DC converters.",
          ],
          observe: "Run the simulation and watch the waveform: high for Ton, low for the rest of the period. The LED brightness follows the duty cycle.",
          tryIt: "Drag the duty slider from 10 % to 90 %. Then try 500 Hz, 1 kHz and 5 kHz: the duty stays put because CCR is rescaled with ARR.",
          measure: `CH1 now: ${(c1.duty * 100).toFixed(1)} % at ${fmtHz(c1.freq)}, Ton = ${fmtSec(c1.pulse)}, ${steps} duty steps.`,
          modify: "Set PSC to 35 (2 MHz timer clock) and ARR to 1999: same 1 kHz, twice the resolution. Then Write into code and Run.",
          runAgain: "Enable CH2 (PA9) in the CH2 tab: both channels share PSC and ARR, so they always have the same frequency but independent duty.",
          challenge: "Create a breathing LED by sweeping the compare value with __HAL_TIM_SET_COMPARE (or load the Breathing LED example).",
          checks,
        }} />
      </div>
    </LabShell>
  );
}
