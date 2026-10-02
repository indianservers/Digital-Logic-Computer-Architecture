import { useEffect, useState } from "react";
import { useLab } from "../core/useLab";
import type { LabMeta } from "../registry";
import { CodeEditor } from "../ui/CodeEditor";
import { Icon } from "../ui/Icon";
import { LearningNotes, Panel, Toggle } from "../ui/Panels";
import { fmtHz, fmtSec, Scope } from "../ui/Scope";
import { LabShell } from "../ui/Shell";
import {
  bench19, CLK19, cntAt, codeValue, DEMO, measuredPeriod, NO_CEN, OFF_BY_ONE, overflowS, P19_DEFAULT, POLLING, resetCnt, setCodeValue, setCompare,
  setCompareIrq, setup19, start, timerHz, world19, writeArr, writeCcr, writePsc, type P19,
} from "./L19sim";

function NumField({ label, value, max, onCommit, pending }: { label: string; value: number; max: number; onCommit: (v: number) => void; pending?: boolean }) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const v = Number(draft);
    setDraft(null);
    if (Number.isFinite(v) && v >= 0 && v <= max && Math.round(v) !== value) onCommit(Math.round(v));
  };
  return (
    <label className="mcl-g2-row mcl-l19-field"><span>{label}</span>
      <input className={`mcl-l19-num ${pending ? "pending" : ""}`} type="number" min={0} max={max} step={1} aria-label={label}
        value={draft ?? String(value)} onChange={(e) => setDraft(e.target.value)} onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setDraft(null); }} />
    </label>
  );
}

export default function L19({ meta }: { meta: LabMeta }) {
  const lab = useLab<P19>({
    slug: meta.slug, code: DEMO, params: P19_DEFAULT, rebuildOn: ["noClock", "halfClock"],
    mcu: () => ({ ips: 120_000, clock: CLK19, strictClock: true }),
    setup: (m, p) => setup19(m, p),
    world: world19,
  });
  const { mcu, params } = lab;
  const fw = mcu.fw;
  const b = bench19(mcu);
  const psc = mcu.peek("TIM2.PSC"), arr = mcu.peek("TIM2.ARR"), ccr = mcu.peek("TIM2.CCR1");
  const cnt = mcu.peek("TIM2.CNT");
  const cen = (mcu.peek("TIM2.CR1") & 1) === 1;
  const dier = mcu.peek("TIM2.DIER");
  const nvicOn = mcu.nvicEnabled("TIM2");
  const uie = (dier & 1) === 1, cc1ie = (dier & 2) === 2;
  const inClk = mcu.timerClock("TIM2");
  const fTick = timerHz(mcu), period = overflowS(mcu);
  const measured = measuredPeriod(b);
  const overflows = fw?.num("overflow_count") ?? 0, compares = fw?.num("compare_count") ?? 0;
  const ledOn = mcu.pin("PA5").level === 1;
  const lastCompare = b.compares[b.compares.length - 1] ?? -Infinity;
  const compareHot = mcu.time - lastCompare < Math.min(0.15, period / 3);
  const lastUpdate = b.updates[b.updates.length - 1] ?? -Infinity;
  const updateHot = mcu.time - lastUpdate < Math.min(0.06, period / 3);

  const [pending, setPending] = useState<string | null>(null);
  const [seen, setSeen] = useState({ preload: false, arr: false, compare: false, bug: false });
  useEffect(() => { if (pending !== null && lab.code === pending) { setPending(null); lab.run(); } }, [pending, lab]);

  const code = lab.compiledCode;
  const codePsc = codeValue(code, "psc"), codeArr = codeValue(code, "arr"), codeCcr = codeValue(code, "ccr");
  const livePsc = b.pscPending ?? psc;
  const codeCc1 = code.includes("TIM_DIER_CC1IE");
  const drift = codePsc !== null && codeArr !== null && (codePsc !== livePsc || codeArr !== arr || (codeCcr !== null && codeCcr !== ccr) || codeCc1 !== cc1ie);
  const syncCode = () => {
    let next = lab.code;
    next = setCodeValue(next, "psc", livePsc);
    next = setCodeValue(next, "arr", arr);
    next = setCodeValue(next, "ccr", ccr);
    next = setCompareIrq(next, cc1ie);
    lab.setCode(next); setPending(next);
  };

  const [overrun, setOverrun] = useState(false);
  const onStart = () => { start(mcu, true); if (!lab.running) lab.toggle(); };
  const preloadSeen = b.log.some((e) => e.text.includes("took effect"));
  const arrSeen = arr !== 4999 && measured !== null && b.updates.length >= 3 && Math.abs(measured - period) / period < 0.02;
  const compareSeen = compares > 0;
  const bugSeen = (code === OFF_BY_ONE && measured !== null) || (code === NO_CEN && mcu.time > 0.5) || ((params.noClock || params.halfClock) && mcu.time > 0.5);
  useEffect(() => {
    if ((preloadSeen && !seen.preload) || (arrSeen && !seen.arr) || (compareSeen && !seen.compare) || (bugSeen && !seen.bug))
      setSeen((x) => ({ preload: x.preload || preloadSeen, arr: x.arr || arrSeen, compare: x.compare || compareSeen, bug: x.bug || bugSeen }));
  }, [preloadSeen, arrSeen, compareSeen, bugSeen, seen]);

  const R = 74, C = 2 * Math.PI * R;
  const frac = Math.max(0, Math.min(1, cnt / (arr + 1)));
  const ccrAng = (Math.min(ccr, arr + 1) / (arr + 1)) * 2 * Math.PI - Math.PI / 2;
  const win = Math.max(0.02, Math.min(8, period * 2.5));
  const expected = ((arr + 1) * (psc + 1)) / CLK19;
  const status = !fw ? "stopped" : params.noClock ? "no clock" : !cen ? "stopped (CEN = 0)" : "counting up";

  const rows: Array<[string, string, string?]> = [
    ["Input Clock", fmtHz(inClk), params.halfClock ? "bad" : params.noClock ? "warn" : ""],
    ["Prescaler", b.pscPending !== null ? `${psc} → ${b.pscPending}` : String(psc), b.pscPending !== null ? "warn" : ""],
    ["Timer Clock", fmtHz(fTick)],
    ["ARR", String(arr)],
    ["Overflow", fmtSec(period)],
  ];

  return (
    <LabShell meta={meta} lab={lab} subtitle="Configure prescaler, auto-reload, compare and overflow while watching the counter live."
      components={["NUCLEO-F401RE (STM32F401RE) with SYSCLK 72 MHz from the PLL", "APB1 36 MHz, so TIM2 is clocked at 2 × 36 = 72 MHz", "TIM2: 32-bit general-purpose timer, up-counting, IRQ 28", "LD2 green LED on PA5 toggled by the update interrupt"]}>
      <div className="mcl-g2-grid">
        <Panel title="Timer / Counter Visualizer" icon="clock" className="mcl-sim g-bench" tools={
          <span className={`mcl-chip ${params.noClock || !cen ? "mcl-chip-warn" : "mcl-chip-live"}`}>TIM2 · {status}</span>
        }>
          <div className="mcl-l19-viz">
            <svg viewBox="0 0 220 220" className="mcl-l19-ring" role="img" aria-label={`TIM2 counter ${cnt} of ${arr + 1}`}>
              <circle cx={110} cy={110} r={R} fill="none" stroke="#dbe4ef" strokeWidth={16} />
              <circle cx={110} cy={110} r={R} fill="none" stroke={updateHot ? "#16a34a" : "#1677ff"} strokeWidth={16} strokeDasharray={`${frac * C} ${C}`} transform="rotate(-90 110 110)" />
              <g aria-hidden>
                <line x1={110 + Math.cos(ccrAng) * (R - 13)} y1={110 + Math.sin(ccrAng) * (R - 13)} x2={110 + Math.cos(ccrAng) * (R + 13)} y2={110 + Math.sin(ccrAng) * (R + 13)}
                  stroke={cc1ie ? (compareHot ? "#dc2626" : "#f59e0b") : "#94a3b8"} strokeWidth={4} strokeLinecap="round" />
                <text x={110 + Math.cos(ccrAng) * (R + 25)} y={110 + Math.sin(ccrAng) * (R + 25) + 4} textAnchor="middle" fontSize="10" fontWeight="700" fill={cc1ie ? "#b45309" : "#94a3b8"}>CCR1</text>
              </g>
              <text x={110} y={112} textAnchor="middle" fontSize="30" fontWeight="800" fill="#1b2f4e" style={{ fontVariantNumeric: "tabular-nums" }}>{cnt.toLocaleString("en-US")}</text>
              <text x={110} y={136} textAnchor="middle" fontSize="12" fontWeight="700" fill="#64748b">CNT</text>
              <text x={110} y={152} textAnchor="middle" fontSize="10" fill="#94a3b8">0 … {arr.toLocaleString("en-US")}</text>
            </svg>
            <div className="mcl-l19-rows">
              {rows.map(([k, v, cls]) => <div key={k}><span>{k}</span><b className={cls}>{v}</b></div>)}
              <div><span>LD2 (PA5)</span><b className={`mcl-l19-led ${ledOn ? "on" : ""}`}><i />{ledOn ? "ON" : "off"}</b></div>
            </div>
          </div>
          <p className="mcl-l19-formula">
            <span>f<sub>update</sub> = {fmtHz(inClk)} ÷ (PSC + 1) ÷ (ARR + 1) = {fmtHz(inClk)} ÷ {(psc + 1).toLocaleString("en-US")} ÷ {(arr + 1).toLocaleString("en-US")} = <b>{fmtHz(1 / period)}</b></span>
            <span>Measured period: <b className={measured !== null && Math.abs(measured - expected) / expected > 0.001 ? "bad" : ""}>{measured !== null ? fmtSec(measured) : "waiting for 3 updates"}</b>{measured !== null && params.halfClock ? " (code assumed 72 MHz)" : ""}</span>
          </p>
        </Panel>

        <Panel title="Counter Controls" icon="sliders" className="g-ctl">
          <div className="mcl-l19-ctl">
            <button type="button" className="go" onClick={onStart} disabled={!fw || (cen && lab.running)}>Start</button>
            <button type="button" onClick={() => start(mcu, false)} disabled={!fw || !cen}>Pause</button>
            <button type="button" onClick={() => resetCnt(mcu)} disabled={!fw}>Reset CNT</button>
          </div>
          <NumField label="Prescaler" value={livePsc} max={65535} pending={b.pscPending !== null} onCommit={(v) => writePsc(mcu, v)} />
          <NumField label="Auto Reload" value={arr} max={0xffffff} onCommit={(v) => setOverrun(writeArr(mcu, v))} />
          <NumField label="Compare CCR1" value={ccr} max={0xffffff} onCommit={(v) => writeCcr(mcu, v)} />
          <div className="mcl-g2-row"><span>Compare CH1 IRQ</span>
            <button type="button" className={`mcl-l17-pill ${cc1ie ? "" : "off"}`} aria-pressed={cc1ie} disabled={!fw} onClick={() => setCompare(mcu, !cc1ie)}>{cc1ie ? "CC1IE on" : "CC1IE off"}</button>
          </div>
          {b.pscPending !== null ? <p className="mcl-g2-hint"><Icon name="clock" size={14} />PSC is buffered: {b.pscPending} loads at the next update event (or press Reset CNT to force EGR.UG).</p> : null}
          {overrun ? <p className="mcl-g2-hint warn"><Icon name="alert" size={14} />ARR was set below CNT. Without ARPE a real TIM2 would count on to 0xFFFFFFFF before wrapping; this model clamps at ARR and wraps at once.</p> : null}
          {drift ? (
            <p className="mcl-g2-hint mcl-l19-drift"><Icon name="edit" size={14} />Registers were changed live and no longer match the code.
              <button type="button" onClick={syncCode}>Write values into code &amp; Run</button></p>
          ) : null}
        </Panel>

        <Panel title="Counter Waveform" icon="wave" className="g-scope" tools={<span className="mcl-chip">{fmtSec(win)} window</span>}>
          <Scope traces={[
            { label: "TIM2 CNT", color: "#3b82f6", sample: (t) => cntAt(b, t), min: 0, max: Math.max(arr, ccr) * 1.08 + 1 },
            { label: "LD2 PA5", color: "#22c55e", edges: mcu.edges.get("PA5") ?? [], initial: 0 },
          ]} lanes now={mcu.time} window={win} height={150} frame={lab.frame} ariaLabel="TIM2 counter sawtooth and the LED toggled on every overflow"
            thresholds={[{ value: ccr, color: cc1ie ? "#f59e0b" : "#64748b", label: "CCR1", trace: 0 }]} />
          <p className="mcl-l16-note">CNT ramps from 0 to ARR at the timer clock, then the update event resets it and toggles LD2. The dashed line is CCR1; with CC1IE on, every crossing raises TIM2_IRQHandler with CC1IF.</p>
        </Panel>

        <CodeEditor lab={lab} className="g-code" languages={[{ label: "Update interrupt", code: DEMO }, { label: "Polling UIF", code: POLLING }, { label: "Bug: off by one", code: OFF_BY_ONE }, { label: "Bug: CEN missing", code: NO_CEN }]} />

        <div className="g-tasks mcl-l13-side">
          <Panel title="Live Events" icon="activity">
            <div className="mcl-l19-live">
              <div><span>CNT</span><b>{cnt.toLocaleString("en-US")}</b></div>
              <div><span>Overflow count</span><b className={updateHot ? "ok" : ""}>{overflows}</b></div>
              <div><span>Update IRQ</span><b className={uie && nvicOn ? "ok" : "warn"}>{uie && nvicOn ? "enabled" : uie ? "UIE on, NVIC off" : code.includes("TIM_DIER_UIE") ? "UIE write dropped" : "disabled (polled)"}</b></div>
              <div><span>Compare CH1</span><b className={cc1ie ? (compareHot ? "bad" : "ok") : ""}>{cc1ie ? (compareHot ? "MATCH" : `armed · ${compares} hits`) : "inactive"}</b></div>
            </div>
            <ol className="mcl-l19-log" aria-label="Timer event log">
              {b.log.slice(-6).reverse().map((e, i) => <li key={`${e.t}-${i}`}><time>{e.t.toFixed(3)} s</time>{e.text}</li>)}
              {!b.log.length ? <li><time>—</time>Run the firmware to see timer events.</li> : null}
            </ol>
            <div className="mcl-g2-faults">
              <b><Icon name="bug" size={14} />Fault injection</b>
              <Toggle label="TIM2 clock not enabled" checked={params.noClock} onChange={(v) => lab.setParam("noClock", v)} hint="RCC_APB1ENR.TIM2EN stays 0: every TIM2 register write is dropped and CNT never moves" />
              <Toggle label="Timer clock halved (36 MHz)" checked={params.halfClock} onChange={(v) => lab.setParam("halfClock", v)} hint="The APB1 x2 timer multiplier is lost, so TIM2 runs at 36 MHz while the code still divides as if it had 72 MHz" />
            </div>
          </Panel>
          <LearningNotes variant="tasks" title="Learning Tasks" notes={{
            takeaways: [],
            observe: "Watch the ring fill from 0 to ARR. Each wrap is an update event: the overflow count steps, LD2 toggles and the waveform drops back to 0.",
            tryIt: "Type 3599 into Prescaler. Nothing changes until the next wrap, because PSC is preloaded. Then the ramp is twice as steep.",
            measure: measured !== null ? `Measured overflow period ${fmtSec(measured)} vs formula ${fmtSec(period)}; ${overflows} overflows, ${compares} compare matches.` : "Let three overflows happen, then compare the measured period with the formula.",
            modify: "Set Auto Reload to 999 and turn CC1IE on with CCR1 at 500. The compare marker sits half way round the ring.",
            runAgain: "Load \"Bug: off by one\" and Run: 7201 × 5001 ticks makes 500.2 ms instead of 500 ms, which drifts by 34.6 s a day.",
            challenge: "Why does the polling version still count overflows correctly, and what does it cost the CPU compared with the interrupt version?",
            checks: [
              { label: "Saw a PSC preload take effect at the update", done: seen.preload },
              { label: "Changed ARR and measured the new period", done: seen.arr },
              { label: "Caught a compare CH1 interrupt", done: seen.compare },
              { label: "Reproduced a timing bug or clock fault", done: seen.bug },
            ],
          }} />
        </div>
      </div>
    </LabShell>
  );
}
