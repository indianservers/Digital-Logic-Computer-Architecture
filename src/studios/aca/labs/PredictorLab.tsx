import { useMemo, useState } from "react";
import { PREDICT_PRESETS, accuracy, parseTrace, runTrace, twoName, type Bit, type Two } from "../../../engines/aca/predictor";
import { LabChrome, Toggle, Transport, usePlayback } from "./HazardLab";

const FSM = [
  { state: 0 as Two, label: "00 Strongly Not Taken", taken: false },
  { state: 1 as Two, label: "01 Weakly Not Taken", taken: false },
  { state: 2 as Two, label: "10 Weakly Taken", taken: true },
  { state: 3 as Two, label: "11 Strongly Taken", taken: true },
];

export function PredictorLab() {
  const [text, setText] = useState("T T T T N\nT T T T N\nT T T T N\nT T T T N");
  const [bit0, setBit0] = useState<Bit>(1);
  const [two0, setTwo0] = useState<Two>(3);
  const [highlightMiss, setHighlightMiss] = useState(true);
  const trace = useMemo(() => parseTrace(text), [text]);
  const rows = useMemo(() => runTrace(trace, bit0, two0), [trace, bit0, two0]);
  const play = usePlayback(rows.length);
  const seen = rows.slice(0, play.cycle);
  const current = play.cycle > 0 ? rows[play.cycle - 1] : undefined;
  const bitScore = accuracy(seen, "bit");
  const twoScore = accuracy(seen, "two");
  const finalBit = accuracy(rows, "bit");
  const finalTwo = accuracy(rows, "two");
  const twoState = current?.twoAfter ?? two0;
  const bitState = current?.bitAfter ?? bit0;
  return (
    <LabChrome lab="branch-predictor" kicker="Labs > Lab 6" title="Lab 6 — 1-Bit & 2-Bit Branch Predictor" subtitle="Experiment with branch traces and compare predictor state behavior and accuracy." badge="RISC-V (5-Stage Pipeline)">
      <div className="vl-cards three">
        <article><h2>Learning Objective</h2><p>A 1-bit predictor copies the last outcome, so one loop exit flips the next prediction. A 2-bit counter needs two misses in a row to change its guess.</p></article>
        <article><h2>Experiment Status</h2><p>{play.cycle === 0 ? "Ready to run" : play.cycle >= rows.length ? "Completed" : `Branch ${play.cycle} / ${rows.length}`}</p></article>
        <article><h2>Loop note</h2><p>On a repeated T T T T N loop the 1-bit predictor misses the exit and the next entry. The 2-bit predictor misses the exit and stays taken for the next entry. It is not better on every trace.</p></article>
      </div>
      <div className="vl-cards three">
        <section className="vl-panel">
          <header><h2>Branch Trace Input</h2>
            <button type="button" onClick={() => { setText(""); play.reset(); }}>Clear</button>
          </header>
          <textarea aria-label="Branch trace" value={text} onChange={(event) => { setText(event.target.value); play.reset(); }} rows={5} />
          <p>{trace.length} branches. T is taken, N is not taken.</p>
          <div className="vl-chips">
            {PREDICT_PRESETS.map((preset) => <button type="button" key={preset.id} onClick={() => { setText(preset.trace.map((bit) => (bit ? "T" : "N")).join(" ")); play.reset(); }}>{preset.label}</button>)}
          </div>
          <label>1-bit initial <select aria-label="1-bit initial state" value={bit0} onChange={(event) => { setBit0(Number(event.target.value) as Bit); play.reset(); }}><option value={1}>Taken</option><option value={0}>Not taken</option></select></label>
          <label>2-bit initial <select aria-label="2-bit initial state" value={two0} onChange={(event) => { setTwo0(Number(event.target.value) as Two); play.reset(); }}><option value={3}>Strongly taken</option><option value={2}>Weakly taken</option><option value={1}>Weakly not taken</option><option value={0}>Strongly not taken</option></select></label>
        </section>
        <section className="vl-panel">
          <h2>1-Bit Predictor</h2>
          <p>A single bit records the last outcome.</p>
          <p className={bitState ? "vl-ok" : "vl-bad"}><b>Current state: Predict {bitState ? "Taken (T)" : "Not Taken (N)"}</b></p>
          <p>Next state becomes the actual outcome of this branch.</p>
          <h2>2-Bit Predictor</h2>
          <div className="vl-fsm">
            {FSM.map((item) => <span key={item.state} className={`${item.taken ? "taken" : ""} ${twoState === item.state ? "on" : ""}`}>{item.label}</span>)}
          </div>
          <p>Taken moves 00→01→10→11 and stays at 11. Not-taken moves 11→10→01→00 and stays at 00. Prediction is taken only in 10 and 11. Current: {twoName(twoState)}.</p>
        </section>
        <section className="vl-panel">
          <h2>Loop Behavior Example</h2>
          <p>Typical loop: four iterations taken, then not taken.</p>
          <p><b>T T T T N</b> repeated.</p>
          <p>1-bit mispredicts the loop exit and the first branch of the next loop. 2-bit usually mispredicts only the exit, then stays taken. Compare the full-trace numbers on the right; they come from this trace and the initial states above.</p>
        </section>
      </div>
      <div className="vl-split">
        <section className="vl-panel">
          <h2>Prediction History</h2>
          <div className="vl-scroll">
            <table>
              <thead><tr><th>#</th><th>Actual</th><th>1-bit pred</th><th>1-bit</th><th>1-bit after</th><th>2-bit pred</th><th>2-bit</th><th>2-bit after</th></tr></thead>
              <tbody>
                {seen.map((row, index) => (
                  <tr key={`${row.actual}-${index}`} className={index === seen.length - 1 ? "on" : ""}>
                    <td>{index + 1}</td>
                    <td>{row.actual ? "T" : "N"}</td>
                    <td>{row.bitPred ? "T" : "N"}</td>
                    <td className={!row.bitCorrect && highlightMiss ? "vl-bad" : "vl-ok"}>{row.bitCorrect ? "Correct" : "Incorrect"}</td>
                    <td>{row.bitAfter ? "T" : "N"}</td>
                    <td>{row.twoPred ? "T" : "N"}</td>
                    <td className={!row.twoCorrect && highlightMiss ? "vl-bad" : "vl-ok"}>{row.twoCorrect ? "Correct" : "Incorrect"}</td>
                    <td>{row.twoAfter.toString(2).padStart(2, "0")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="vl-panel">
          <h2>Accuracy Comparison</h2>
          <div className="vl-bars">
            <b><i style={{ height: `${bitScore.percent}%` }} />{bitScore.percent}%<span>1-bit</span></b>
            <b><i className="two" style={{ height: `${twoScore.percent}%` }} />{twoScore.percent}%<span>2-bit</span></b>
          </div>
          <div className="vl-metrics">
            <div><span>1-bit so far</span><strong>{bitScore.percent}%</strong><span>{bitScore.correct} / {bitScore.total || 0}</span></div>
            <div><span>2-bit so far</span><strong>{twoScore.percent}%</strong><span>{twoScore.correct} / {twoScore.total || 0}</span></div>
          </div>
          <p>Full trace, same initial states: 1-bit {finalBit.correct}/{finalBit.total} ({finalBit.percent}%), 2-bit {finalTwo.correct}/{finalTwo.total} ({finalTwo.percent}%).</p>
        </section>
      </div>
      <div className="vl-cards three">
        <article>
          <h2>Simulation Controls</h2>
          <Toggle on={highlightMiss} label="Highlight Mispredictions" onChange={setHighlightMiss} />
          <Transport playing={play.playing} speed={play.speed} onSpeed={play.setSpeed} onPlay={() => play.setPlaying((value) => !value)} onStep={() => play.setCycle((value) => Math.min(rows.length, value + 1))} onBack={() => play.setCycle((value) => Math.max(0, value - 1))} onReset={play.reset} />
        </article>
        <article>
          <h2>Current Branch</h2>
          {current ? <p>Index {play.cycle} / {rows.length}. Actual {current.actual ? "T" : "N"}. 1-bit predicted {current.bitPred ? "T" : "N"} and was {current.bitCorrect ? "correct" : "incorrect"}. 2-bit predicted {current.twoPred ? "T" : "N"} and was {current.twoCorrect ? "correct" : "incorrect"}. State {twoName(current.twoBefore)} → {twoName(current.twoAfter)}.</p> : <p>Press Step to score the first branch.</p>}
        </article>
        <article>
          <h2>Key Takeaway</h2>
          <p>The 2-bit predictor is more resilient to a single surprising outcome. On an alternating trace it is not automatically more accurate. Change the preset and compare the two percentages.</p>
        </article>
      </div>
    </LabChrome>
  );
}
