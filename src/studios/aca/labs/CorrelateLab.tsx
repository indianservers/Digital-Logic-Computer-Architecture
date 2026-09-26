import { useMemo, useState } from "react";
import { CORR_PRESETS, bitList, runCorrelate, tally, type BranchEvent } from "../../../engines/aca/correlate";
import { twoName, type Two } from "../../../engines/aca/predictor";
import { LabChrome, Toggle, Transport, usePlayback } from "./HazardLab";
import { GshareFlow } from "../animation/motionViews";
import { useGuideFocus } from "../guide/focus";

const hex = (value: number) => `0x${value.toString(16).toUpperCase()}`;

function counterText(state: Two): string {
  return `${state.toString(2).padStart(2, "0")} ${twoName(state)}`;
}

export function CorrelateLab() {
  const [events, setEvents] = useState<BranchEvent[]>(CORR_PRESETS[0]?.events ?? []);
  const [ghrBits, setGhrBits] = useState(4);
  const [phtBits, setPhtBits] = useState(4);
  const [localBits, setLocalBits] = useState(3);
  const [initial, setInitial] = useState<Two>(1);
  const [update, setUpdate] = useState(true);
  const [showGlobal, setShowGlobal] = useState(true);
  const [showLocal, setShowLocal] = useState(true);
  const [showBimodal, setShowBimodal] = useState(true);
  const [details, setDetails] = useState(false);
  const [highlight, setHighlight] = useState(true);
  const result = useMemo(() => runCorrelate(events, { ghrBits, phtBits, localBits, initial, update }), [events, ghrBits, phtBits, localBits, initial, update]);
  const play = usePlayback(result.steps.length);
  const step = play.cycle > 0 ? result.steps[play.cycle - 1] : undefined;
  const seen = result.steps.slice(0, play.cycle);
  const gshare = step?.gshare ?? result.initialGshare;
  const locals = step?.locals ?? [];
  const ghr = step?.ghrAfter ?? 0;
  const globalScore = tally(seen.map((item) => item.gshareCorrect));
  const localScore = tally(seen.map((item) => item.localCorrect));
  const bimodalScore = tally(seen.map((item) => item.bimodalCorrect));
  const byPc = new Map<number, { correct: number; total: number }>();
  seen.forEach((item) => {
    const row = byPc.get(item.pc) ?? { correct: 0, total: 0 };
    row.total += 1;
    if (item.gshareCorrect) row.correct += 1;
    byPc.set(item.pc, row);
  });
  const edit = (index: number, patch: Partial<BranchEvent>) => {
    setEvents(events.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
    play.reset();
  };
  const { id: guideFocus } = useGuideFocus();
  const mark = (id: string) => guideFocus === id ? "aca-guide-on" : undefined;
  const hint = step?.aliasPc != null
    ? "Two branches are training the same PHT entry. That is aliasing, not a new kind of branch."
    : step
      ? "Read the GHR, then the PC XOR GHR index, then the counter that index selected."
      : "Load a trace and Step. The first branch updates the GHR for the next index.";
  return (
    <LabChrome lab="correlating-predictor" hint={hint} kicker="Labs > Lab 7" title="Lab 7 — Correlating Branch Predictor" subtitle="Use global and local branch history to study correlation-based prediction." badge="RISC-V (5-Stage Pipeline)">
      <div className="vl-cards three">
        <article><h2>Learning Objective</h2><p>A bimodal counter sees only this branch’s PC. A local history remembers this branch’s own recent outcomes. GShare indexes the pattern table with PC XOR the global history, so one branch’s outcome can change the next branch’s prediction.</p></article>
        <article><h2>Experiment Status</h2><p>{play.cycle === 0 ? "Ready to run" : play.cycle >= result.steps.length ? "Completed" : `Branch ${play.cycle} / ${result.steps.length}`}</p></article>
        <article><h2>Correlation</h2><p>Branches are not independent. The low bit of the history is the most recent outcome: 1 is taken, 0 is not taken.</p></article>
      </div>
      <div className="vl-cards three">
        <section className={`vl-panel ${mark("ghr") ?? ""}`}>
          <header><h2>Global History Register</h2>
            <label>History bits <select aria-label="Global history bits" value={ghrBits} onChange={(event) => { setGhrBits(Number(event.target.value)); play.reset(); }}>{[2, 3, 4, 6, 8].map((bits) => <option key={bits} value={bits}>{bits}</option>)}</select></label>
          </header>
          <div className="vl-bits">{bitList(ghr, ghrBits).map((bit, index) => <span key={ghrBits - index}><small>b{ghrBits - 1 - index}{index === ghrBits - 1 ? " now" : ""}</small>{bit}</span>)}</div>
          <p>Global history value: {ghr} ({ghr.toString(2).padStart(ghrBits, "0")}). Updated after each resolved branch.</p>
        </section>
        <section className="vl-panel">
          <header><h2>Local History Table</h2>
            <label>History bits <select aria-label="Local history bits" value={localBits} onChange={(event) => { setLocalBits(Number(event.target.value)); play.reset(); }}>{[2, 3, 4].map((bits) => <option key={bits} value={bits}>{bits}</option>)}</select></label>
          </header>
          <table>
            <thead><tr><th>PC</th><th>Local history</th><th>Value</th></tr></thead>
            <tbody>{locals.length ? locals.map((item) => <tr key={item.pc} className={step?.pc === item.pc ? "on" : ""}><td>{hex(item.pc)}</td><td>{bitList(item.hist, localBits).join(" ")}</td><td>{item.hist}</td></tr>) : <tr><td colSpan={3}>No branch has resolved yet.</td></tr>}</tbody>
          </table>
          <p>Each PC keeps its own history. That is not the global register.</p>
        </section>
        <section className={`vl-panel ${mark("pht") ?? ""}`}>
          <header><h2>Pattern History Table</h2>
            <label>Entries <select aria-label="Pattern table entries" value={1 << phtBits} onChange={(event) => { setPhtBits(Math.round(Math.log2(Number(event.target.value)))); play.reset(); }}>{[8, 16, 32, 64].map((count) => <option key={count} value={count}>{count}</option>)}</select></label>
          </header>
          <div className="vl-scroll">
            <table>
              <thead><tr><th>Index</th><th>2-bit</th><th>Prediction</th></tr></thead>
              <tbody>{gshare.map((state, index) => <tr key={index} className={step?.gshareIndex === index ? "on" : ""}><td>{index}</td><td>{state.toString(2).padStart(2, "0")}</td><td className={state >= 2 ? "vl-ok" : "vl-bad"}>{twoName(state)}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      </div>
      <div className="vl-split">
        <section className="vl-panel">
          <h2>Correlating Predictor (GShare)</h2>
          {step ? (
            <>
              <div className="vl-flow">
                <span>PC {hex(step.pc)}<br />bits {bitList(step.pcBits, phtBits).join("")}</span>
                <span>GHR {bitList(step.ghrBitsUsed, phtBits).join("")}</span>
                <span>XOR<br />index {step.gshareIndex}</span>
                <span className={step.gsharePred ? "commit" : "writeback"}>{step.gsharePred ? "Taken" : "Not taken"}<br />{counterText(step.gshareBefore)}</span>
              </div>
              <p>Index = (PC XOR global history) masked to {1 << phtBits} entries. Counter before this branch was {counterText(step.gshareBefore)}. After the update it is {counterText(step.gshareAfter)}.</p>
              {step.aliasPc != null ? <p>Aliasing: {hex(step.aliasPc)} previously used PHT entry {step.gshareIndex}. These branches interfere.</p> : <p>No earlier branch has used this GShare index.</p>}
              <GshareFlow history={bitList(step.ghrBitsUsed, phtBits).join("")} index={step.gshareIndex} aliased={step.aliasPc != null} speed={play.speed} cycle={play.cycle} />
            </>
          ) : <p>Press Step. The index is formed before the history shifts.</p>}
        </section>
        <section className="vl-panel">
          <header><h2>Branch Sequence</h2>
            <select aria-label="Load example" value="" onChange={(event) => { const preset = CORR_PRESETS.find((item) => item.id === event.target.value); if (!preset) return; setEvents(preset.events); play.reset(); }}>
              <option value="">Load example</option>
              {CORR_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
            </select>
            <button type="button" onClick={() => { setEvents([]); play.reset(); }}>Clear</button>
          </header>
          <div className="vl-scroll">
            <table>
              <thead><tr><th>#</th><th>PC</th><th>Instruction</th><th>Actual</th></tr></thead>
              <tbody>{events.slice(0, 40).map((item, index) => <tr key={`${item.pc}-${index}`} className={play.cycle === index + 1 ? "on" : ""}><td>{index + 1}</td><td><input aria-label={`PC ${index + 1}`} value={hex(item.pc)} onChange={(event) => edit(index, { pc: Number.parseInt(event.target.value.replace(/[^0-9a-f]/gi, ""), 16) || 0 })} /></td><td><input aria-label={`Instruction ${index + 1}`} value={item.text} onChange={(event) => edit(index, { text: event.target.value })} /></td><td><select aria-label={`Outcome ${index + 1}`} value={item.taken ? "T" : "N"} onChange={(event) => edit(index, { taken: event.target.value === "T" })}><option value="T">T</option><option value="N">N</option></select></td></tr>)}</tbody>
            </table>
          </div>
          {events.length > 40 ? <p>Showing the first 40 of {events.length} branches.</p> : null}
          <button type="button" onClick={() => { setEvents([...events, { pc: 0x18, text: "BEQ", taken: true, comment: "" }]); play.reset(); }}>Add row</button>
        </section>
      </div>
      <div className="vl-cards three">
        <article>
          <h2>Simulation Controls</h2>
          <label>Initial counter <select aria-label="Initial counter" value={initial} onChange={(event) => { setInitial(Number(event.target.value) as Two); play.reset(); }}><option value={0}>Strongly not taken</option><option value={1}>Weakly not taken</option><option value={2}>Weakly taken</option><option value={3}>Strongly taken</option></select></label>
          <Toggle on={showGlobal} label="Global Predictor (GShare)" onChange={setShowGlobal} />
          <Toggle on={showLocal} label="Local Predictor" onChange={setShowLocal} />
          <Toggle on={showBimodal} label="Bimodal Predictor" onChange={setShowBimodal} />
          <Toggle on={update} label="Update on Each Branch" onChange={(next) => { setUpdate(next); play.reset(); }} />
          <Toggle on={highlight} label="Highlight Mispredictions" onChange={setHighlight} />
          <Transport playing={play.playing} speed={play.speed} onSpeed={play.setSpeed} onPlay={() => play.setPlaying((value) => !value)} onStep={() => play.setCycle((value) => Math.min(result.steps.length, value + 1))} onBack={() => play.setCycle((value) => Math.max(0, value - 1))} onReset={play.reset} />
        </article>
        <article>
          <h2>Accuracy Analyzer</h2>
          <table>
            <thead><tr><th>Predictor</th><th>Correct</th><th>Misses</th><th>Accuracy</th></tr></thead>
            <tbody>
              {showBimodal ? <tr><td>Bimodal</td><td>{bimodalScore.correct}</td><td>{bimodalScore.total - bimodalScore.correct}</td><td>{bimodalScore.percent}%</td></tr> : null}
              {showLocal ? <tr><td>Local</td><td>{localScore.correct}</td><td>{localScore.total - localScore.correct}</td><td>{localScore.percent}%</td></tr> : null}
              {showGlobal ? <tr><td>Global (GShare)</td><td>{globalScore.correct}</td><td>{globalScore.total - globalScore.correct}</td><td>{globalScore.percent}%</td></tr> : null}
            </tbody>
          </table>
          <button type="button" onClick={() => setDetails((value) => !value)}>{details ? "Hide details" : "View details"}</button>
          {details ? <ul>{[...byPc.entries()].map(([pc, row]) => <li key={pc}>{hex(pc)} GShare {row.correct}/{row.total}</li>)}</ul> : null}
        </article>
        <article>
          <h2>Key Insight</h2>
          {step ? <p className={highlight && !step.gshareCorrect ? "vl-bad" : ""}>Branch {play.cycle}: actual {step.taken ? "T" : "N"}. GShare predicted {step.gsharePred ? "T" : "N"} ({step.gshareCorrect ? "correct" : "incorrect"}). Local predicted {step.localPred ? "T" : "N"}. Bimodal predicted {step.bimodalPred ? "T" : "N"}.</p> : <p>Step a correlated pair. GShare can learn that the second branch copies the first. A bimodal counter at each PC has to learn that pattern alone.</p>}
          <p>Which predictor is ahead depends on this trace. The percentages above are the branches resolved so far.</p>
        </article>
      </div>
    </LabChrome>
  );
}
