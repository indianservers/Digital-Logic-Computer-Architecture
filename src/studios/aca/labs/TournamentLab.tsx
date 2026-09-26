import { useMemo, useState } from "react";
import { TOUR_PRESETS, chooserName, prefer, runTournament, type Chooser } from "../../../engines/aca/tournament";
import { twoName } from "../../../engines/aca/predictor";
import { tally, type BranchEvent } from "../../../engines/aca/correlate";
import { LabChrome, Toggle, Transport, usePlayback } from "./HazardLab";

const hex = (value: number) => `0x${value.toString(16).toUpperCase()}`;

function parseEvents(text: string): BranchEvent[] {
  return text.split(/\n/).flatMap((line) => {
    const match = line.trim().match(/^(0x[0-9a-f]+|\d+)\s+([TNtn])/);
    if (!match?.[1] || !match[2]) return [];
    return [{ pc: Number.parseInt(match[1], match[1].startsWith("0x") ? 16 : 10), text: "BEQ", taken: match[2].toUpperCase() === "T", comment: "" }];
  });
}

function seriesPath(flags: boolean[], width: number, height: number): string {
  if (!flags.length) return "";
  return flags.map((flag, index) => {
    const x = flags.length === 1 ? 0 : (index / (flags.length - 1)) * width;
    const y = flag ? 8 : height - 8;
    return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

export function TournamentLab() {
  const [text, setText] = useState(() => (TOUR_PRESETS.find((item) => item.id === "mixed")?.events ?? []).map((item) => `${hex(item.pc)} ${item.taken ? "T" : "N"}`).join("\n"));
  const [localBits, setLocalBits] = useState(2);
  const [ghrBits, setGhrBits] = useState(4);
  const [phtBits, setPhtBits] = useState(4);
  const [bimodalBits, setBimodalBits] = useState(4);
  const [chooser0, setChooser0] = useState<Chooser>(2);
  const [showLocal, setShowLocal] = useState(true);
  const [showGlobal, setShowGlobal] = useState(true);
  const [showChooser, setShowChooser] = useState(true);
  const [highlight, setHighlight] = useState(true);
  const events = useMemo(() => parseEvents(text), [text]);
  const result = useMemo(() => runTournament(events, { localBits, ghrBits, phtBits, bimodalBits, initial: 1, chooser: chooser0, update: true }), [events, localBits, ghrBits, phtBits, bimodalBits, chooser0]);
  const play = usePlayback(result.steps.length);
  const step = play.cycle > 0 ? result.steps[play.cycle - 1] : undefined;
  const seen = result.steps.slice(0, play.cycle);
  const scores = {
    local: tally(seen.map((item) => item.localCorrect)),
    global: tally(seen.map((item) => item.globalCorrect)),
    bimodal: tally(seen.map((item) => item.bimodalCorrect)),
    tournament: tally(seen.map((item) => item.finalCorrect)),
  };
  const plotted = seen.slice(-64);
  const localRows = step?.locals ?? [];
  const globalRows = (step?.globalPht ?? []).map((state, index) => ({ index, state })).filter((row) => step != null && Math.abs(row.index - step.gshareIndex) <= 2);
  const bimodalRows = (step?.bimodalPht ?? []).map((state, index) => ({ index, state })).filter((row) => step != null && Math.abs(row.index - step.bimodalIndex) <= 2);
  return (
    <LabChrome lab="tournament-predictor" kicker="Labs > Lab 9" title="Lab 9 — Tournament & Hybrid Predictor" subtitle="Compare local and global predictors and let a chooser select between them before the outcome is known." badge="RISC-V (5-Stage Pipeline)">
      <div className="vl-cards three">
        <article><h2>Learning Objective</h2><p>The chooser picks local or global before the branch resolves. It moves only when one of those two was right and the other was wrong. It is not a taken/not-taken counter. Bimodal is the history-free baseline and is not one of the chooser’s options.</p></article>
        <article><h2>Experiment Status</h2><p>{play.cycle === 0 ? "Ready to run" : play.cycle >= result.steps.length ? "Completed" : `Branch ${play.cycle} / ${result.steps.length}`}</p></article>
        <article><h2>Hybrid</h2><p>Different traces favor different components. The accuracy table names whoever is ahead on the branches seen so far. It is not a fixed winner.</p></article>
      </div>
      <div className="vl-cards three">
        {showLocal ? <section className="vl-panel">
          <header><h2>Local Predictor</h2>
            <label>History bits <select aria-label="Local history bits" value={localBits} onChange={(event) => { setLocalBits(Number(event.target.value)); play.reset(); }}>{[2, 3, 4].map((bits) => <option key={bits} value={bits}>{bits}</option>)}</select></label>
          </header>
          <table>
            <thead><tr><th>PC</th><th>History</th><th>Counter</th><th>Prediction</th></tr></thead>
            <tbody>{localRows.length ? localRows.map((item) => {
              const current = step?.pc === item.pc;
              const hist = current ? step.localHist : item.hist;
              const state = current ? step.localBefore : (step?.localPht[item.hist & ((1 << localBits) - 1)] ?? 1);
              return <tr key={item.pc} className={current ? "on" : ""}><td>{hex(item.pc)}</td><td>{hist.toString(2).padStart(localBits, "0")}</td><td>{state.toString(2).padStart(2, "0")}</td><td className={state >= 2 ? "vl-ok" : "vl-bad"}>{state >= 2 ? "Taken" : "Not taken"}</td></tr>;
            }) : <tr><td colSpan={4}>Step to fill a per-branch history.</td></tr>}</tbody>
          </table>
        </section> : <article><h2>Local Predictor</h2><p>Hidden.</p></article>}
        {showGlobal ? <section className="vl-panel">
          <header><h2>Global Predictor (GShare)</h2>
            <label>History bits <select aria-label="Global history bits" value={ghrBits} onChange={(event) => { setGhrBits(Number(event.target.value)); play.reset(); }}>{[2, 3, 4, 6, 8].map((bits) => <option key={bits} value={bits}>{bits}</option>)}</select></label>
          </header>
          <p>Index = PC XOR GHR, masked to {1 << phtBits} entries. <select aria-label="Global table entries" value={1 << phtBits} onChange={(event) => { setPhtBits(Math.round(Math.log2(Number(event.target.value)))); play.reset(); }}>{[8, 16, 32].map((count) => <option key={count} value={count}>{count}</option>)}</select></p>
          <table>
            <thead><tr><th>Index</th><th>Counter</th><th>Prediction</th></tr></thead>
            <tbody>{globalRows.length ? globalRows.map((row) => <tr key={row.index} className={step?.gshareIndex === row.index ? "on" : ""}><td>{row.index}</td><td>{row.state.toString(2).padStart(2, "0")}</td><td className={row.state >= 2 ? "vl-ok" : "vl-bad"}>{twoName(row.state)}</td></tr>) : <tr><td colSpan={3}>{step ? `Selected index ${step.gshareIndex} is still ${twoName(step.globalBefore)}` : "Waiting for the first branch."}</td></tr>}</tbody>
          </table>
        </section> : <article><h2>Global Predictor</h2><p>Hidden.</p></article>}
        <section className="vl-panel">
          <header><h2>Bimodal Predictor</h2>
            <label>Entries <select aria-label="Bimodal entries" value={1 << bimodalBits} onChange={(event) => { setBimodalBits(Math.round(Math.log2(Number(event.target.value)))); play.reset(); }}>{[8, 16, 32].map((count) => <option key={count} value={count}>{count}</option>)}</select></label>
          </header>
          <p>Indexed by PC bits only. No history.</p>
          <table>
            <thead><tr><th>Index</th><th>Counter</th><th>Prediction</th></tr></thead>
            <tbody>{bimodalRows.length ? bimodalRows.map((row) => <tr key={row.index}><td>{row.index}</td><td>{row.state.toString(2).padStart(2, "0")}</td><td className={row.state >= 2 ? "vl-ok" : "vl-bad"}>{twoName(row.state)}</td></tr>) : <tr><td colSpan={3}>Counters still at the initial weakly-not-taken state.</td></tr>}</tbody>
          </table>
        </section>
      </div>
      <div className="vl-cards three">
        {showChooser ? <section className="vl-panel">
          <h2>Chooser</h2>
          <div className="vl-flow">
            <span className={step?.selected === "local" ? "commit" : ""}>Local<br />{step ? (step.localPred ? "T" : "N") : "—"}</span>
            <span className={step?.selected === "global" ? "commit" : ""}>Global<br />{step ? (step.globalPred ? "T" : "N") : "—"}</span>
            <span className="execute">Chooser<br />{chooserName(step?.chooserBefore ?? chooser0)}</span>
            <span className="dispatch">Final<br />{step ? (step.finalPred ? "T" : "N") : "—"}</span>
          </div>
          <p>{step ? `Bimodal this branch: ${step.bimodalPred ? "T" : "N"}. ${step.disagree ? "Local and global disagree, so the chooser can move after the outcome." : "Local and global agree, so the chooser does not change the direction and does not move."}` : "Step to see which component the chooser selects."}</p>
          <label>Initial chooser <select aria-label="Initial chooser" value={chooser0} onChange={(event) => { setChooser0(Number(event.target.value) as Chooser); play.reset(); }}>{([0, 1, 2, 3] as Chooser[]).map((state) => <option key={state} value={state}>{chooserName(state)}</option>)}</select></label>
        </section> : <article><h2>Chooser</h2><p>Hidden. The final prediction still uses {prefer(step?.chooserBefore ?? chooser0)}.</p></article>}
        <section className="vl-panel">
          <header><h2>Branch Trace</h2>
            <select aria-label="Load example" value="" onChange={(event) => { const found = TOUR_PRESETS.find((item) => item.id === event.target.value); if (!found) return; setText(found.events.map((item) => `${hex(item.pc)} ${item.taken ? "T" : "N"}`).join("\n")); play.reset(); }}>
              <option value="">Load example</option>
              {TOUR_PRESETS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </header>
          <textarea aria-label="Branch trace" rows={8} value={text} onChange={(event) => { setText(event.target.value); play.reset(); }} />
          <p>{events.length} branches. One <code>PC T</code> or <code>PC N</code> per line.</p>
        </section>
        <article>
          <h2>Simulation Controls</h2>
          <Toggle on={showLocal} label="Show Local History" onChange={setShowLocal} />
          <Toggle on={showGlobal} label="Show Global History" onChange={setShowGlobal} />
          <Toggle on={showChooser} label="Show Chooser" onChange={setShowChooser} />
          <Toggle on={highlight} label="Highlight Mispredictions" onChange={setHighlight} />
          <Transport playing={play.playing} speed={play.speed} onSpeed={play.setSpeed} onPlay={() => play.setPlaying((value) => !value)} onStep={() => play.setCycle((value) => Math.min(result.steps.length, value + 1))} onBack={() => play.setCycle((value) => Math.max(0, value - 1))} onReset={play.reset} />
        </article>
      </div>
      <div className="vl-cards three">
        <section className="vl-panel">
          <h2>Prediction Comparison</h2>
          <svg viewBox="0 0 320 90" role="img" aria-label="Predictor comparison">
            <path d={seriesPath(plotted.map((item) => item.localPred), 320, 90)} fill="none" stroke="#2563eb" strokeWidth="2" />
            <path d={seriesPath(plotted.map((item) => item.globalPred), 320, 90)} fill="none" stroke="#16a34a" strokeWidth="2" />
            <path d={seriesPath(plotted.map((item) => item.bimodalPred), 320, 90)} fill="none" stroke="#7c3aed" strokeWidth="2" />
            <path d={seriesPath(plotted.map((item) => item.finalPred), 320, 90)} fill="none" stroke="#dc2626" strokeWidth="2" />
            <path d={seriesPath(plotted.map((item) => item.taken), 320, 90)} fill="none" stroke="#64748b" strokeDasharray="4 3" strokeWidth="2" />
          </svg>
          <p className="vl-legend"><i className="st IF" /> Local <i className="st WB" /> Global <i className="st ID" /> Bimodal <i className="st MEM" /> Tournament <i className="st STALL" /> Actual</p>
        </section>
        <article>
          <h2>Final Prediction</h2>
          {step ? <p className={highlight && !step.finalCorrect ? "vl-bad" : "vl-ok"}>{step.finalCorrect ? "Correct" : "Incorrect"}: predicted {step.finalPred ? "T" : "N"} from the {step.selected} predictor. Actual {step.taken ? "T" : "N"}.</p> : <p>Press Step.</p>}
          <p>PC {step ? hex(step.pc) : "—"}. Chooser {chooserName(step?.chooserBefore ?? chooser0)} → {chooserName(step?.chooserAfter ?? chooser0)}.</p>
          {step ? (step.disagree ? <p>Disagreement: local {step.localPred ? "T" : "N"}, global {step.globalPred ? "T" : "N"}. The chooser {step.chooserAfter === step.chooserBefore ? "stayed" : step.chooserAfter < step.chooserBefore ? "moved toward local" : "moved toward global"}.</p> : <p>The components agreed, so the selection did not change the predicted direction.</p>) : null}
        </article>
        <article>
          <h2>Accuracy Statistics</h2>
          <table>
            <thead><tr><th>Predictor</th><th>Correct</th><th>Total</th><th>Accuracy</th></tr></thead>
            <tbody>
              <tr><td>Local</td><td>{scores.local.correct}</td><td>{scores.local.total}</td><td>{scores.local.percent}%</td></tr>
              <tr><td>Global</td><td>{scores.global.correct}</td><td>{scores.global.total}</td><td>{scores.global.percent}%</td></tr>
              <tr><td>Bimodal</td><td>{scores.bimodal.correct}</td><td>{scores.bimodal.total}</td><td>{scores.bimodal.percent}%</td></tr>
              <tr><td>Tournament</td><td>{scores.tournament.correct}</td><td>{scores.tournament.total}</td><td>{scores.tournament.percent}%</td></tr>
            </tbody>
          </table>
          <p>Chooser selections so far: local {seen.filter((item) => item.selected === "local").length}, global {seen.filter((item) => item.selected === "global").length}. Full-trace tournament accuracy is {result.tournament.percent}%.</p>
        </article>
      </div>
    </LabChrome>
  );
}
