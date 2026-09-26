import { useEffect, useMemo, useState } from "react";
import { twoName, type Two } from "../../../engines/aca/predictor";
import { SPEC_PRESETS, parseSpecProgram, runSpeculation, type PredictorMode } from "../../../engines/aca/speculate";
import { LabChrome, Toggle, Transport, usePlayback } from "./HazardLab";
import { SpecPath } from "../animation/motionViews";
import { useGuideFocus } from "../guide/focus";

const pcOf = (index: number) => `0x${(0x00400000 + index * 4).toString(16).padStart(8, "0")}`;
const hex = (value: number) => `0x${(value >>> 0).toString(16).padStart(8, "0")}`;

export function SpeculateLab() {
  const [presetId, setPresetId] = useState(SPEC_PRESETS[0]?.id ?? "wrong");
  const [mode, setMode] = useState<PredictorMode>("two");
  const [initial, setInitial] = useState<Two>(1);
  const [predictOn, setPredictOn] = useState(true);
  const [bubbles, setBubbles] = useState(true);
  const [highlight, setHighlight] = useState(true);
  const [showRegs, setShowRegs] = useState(true);
  const [autoReset, setAutoReset] = useState(false);
  const [selected, setSelected] = useState(2);
  const [program, setProgram] = useState("");
  const [custom, setCustom] = useState(false);
  const [resolveAfter, setResolveAfter] = useState(0);
  const [windowSize, setWindowSize] = useState(4);
  const preset = SPEC_PRESETS.find((item) => item.id === presetId) ?? SPEC_PRESETS[0];
  const parsed = useMemo(() => (custom ? parseSpecProgram(program) : { ops: preset?.ops ?? [], errors: [] as string[] }), [custom, program, preset]);
  const ops = parsed.ops.length ? parsed.ops : (preset?.ops ?? []);
  const result = useMemo(() => {
    if (!preset || !ops.length) return null;
    return runSpeculation(ops, { mode, initial, fetchAhead: predictOn ? windowSize : 0, resolveAfter });
  }, [preset, ops, mode, initial, predictOn, windowSize, resolveAfter]);
  const play = usePlayback(Math.max(0, (result?.steps.length ?? 1) - 1));
  const { id: guideFocus } = useGuideFocus();
  useEffect(() => {
    if (!autoReset || play.cycle === 0 || !result || play.cycle < result.steps.length - 1) return;
    play.setPlaying(false);
    play.setCycle(0);
  }, [autoReset, play, result]);
  if (!preset || !result) return null;
  const step = result.steps[Math.min(play.cycle, result.steps.length - 1)] ?? result.steps[0];
  const previous = result.steps[Math.min(play.cycle, result.steps.length - 1) - 1];
  if (!step) return null;
  const mark = (id: string) => guideFocus === id ? "aca-guide-on" : undefined;
  const hint = !predictOn
    ? "Speculation is off, so fetch waits for the branch. Turn Enable speculation on to compare the squashed count."
    : step.squashed.some(Boolean)
      ? "Wrong-path instructions are squashed. Raise Branch resolution latency and Step again to see more of them enter first."
      : step.speculative.some(Boolean)
        ? "These instructions are speculative. They become architectural only if the prediction matches."
        : "Step until the branch resolves. Correct speculation keeps the work. A mismatch squashes the younger path.";
  const flushAt = result.steps.find((item) => item.flushed > 0)?.cycle ?? null;
  const resolved = [...result.steps].reverse().find((item) => item.cycle <= step.cycle && item.branchIndex != null) ?? null;
  const branch = resolved?.branchIndex ?? ops.findIndex((op) => op.kind === "branch");
  const chosen = ops[selected];
  const speedup = result.cycles === 0 ? 0 : result.baselineCycles / result.cycles;
  const load = (id: string) => {
    const next = SPEC_PRESETS.find((item) => item.id === id);
    setPresetId(id);
    if (next) {
      setMode(next.config.mode);
      setInitial(next.config.initial);
    }
      setSelected(2);
      setCustom(false);
      if (next) {
        setProgram(next.ops.map((op) => op.text).join("\n"));
        setWindowSize(next.config.fetchAhead);
      }
      play.reset();
  };
  return (
    <LabChrome lab="speculative-execution" hint={hint} kicker="Labs > Lab 10" title="Lab 10 — Speculative Execution & Recovery" subtitle="Experiment with branch speculation, checkpoints, misprediction recovery, and pipeline flush behavior." badge="RISC-V (5-Stage Pipeline)">
      <div className="vl-cards three">
        <article><h2>Learning Objective</h2><p>Understand how branch speculation keeps later instructions moving, and how a checkpoint restores architectural state when the prediction is wrong.</p></article>
        <article><h2>Experiment Status</h2><p>{play.cycle === 0 ? "Ready to run" : step.event}</p><p>{predictOn ? "Fetch continues down the predicted path." : "Fetch waits until the branch resolves."}</p></article>
        <article><h2>Recovery rule</h2><p>A not-taken prediction fetches the fall-through instructions. If the branch is actually taken, only those younger instructions are squashed. Older results stay committed.</p></article>
      </div>
      <SpecPath speculative={step.speculative.filter(Boolean).length} squashed={step.squashed.filter(Boolean).length} redirect={step.redirect != null} speed={play.speed} cycle={play.cycle} />
      <div className="vl-split">
        <section className={`vl-panel ${mark("stream") ?? ""}`}>
          <header>
            <h2>Speculative Instruction Stream</h2>
            <select aria-label="Load example" value={preset.id} onChange={(event) => load(event.target.value)}>
              {SPEC_PRESETS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </header>
          <table>
            <thead><tr><th>#</th><th>Instruction</th><th>Comment</th><th>Speculative?</th></tr></thead>
            <tbody>
              {ops.map((op, index) => (
                <tr key={op.text} className={selected === index ? "on" : ""} onClick={() => setSelected(index)}>
                  <td>{index + 1}</td>
                  <td>{op.text}</td>
                  <td>{op.comment}</td>
                  <td className={step.speculative[index] ? "vl-bad" : "vl-ok"}>{step.speculative[index] ? "Yes" : step.committed[index] || step.squashed[index] ? "No" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {chosen ? <p>I{selected + 1} is {step.committed[selected] ? "committed" : step.squashed[selected] ? "squashed" : step.speculative[selected] ? "speculative" : "not fetched"}. {chosen.kind === "branch" ? "This is the branch that owns the checkpoint." : chosen.dest ? `Destination ${chosen.dest} ${step.squashed[selected] ? "never becomes architectural state." : "updates architectural state only at writeback."}` : ""}</p> : null}
        </section>
        <section className="vl-panel">
          <header><h2>Pipeline Execution Timeline</h2><b>Cycle {step.cycle} / {result.cycles}</b></header>
          <div className="vl-scroll">
            <table className="vl-time">
              <thead>
                <tr>
                  <th>Inst.</th>
                  {Array.from({ length: step.cycle }, (_, index) => <th key={index} className={highlight && flushAt === index + 1 ? "flush" : index + 1 === step.cycle ? "now" : ""}>{index + 1}</th>)}
                </tr>
              </thead>
              <tbody>
                {ops.map((op, index) => (
                  <tr key={op.text} className={selected === index ? "on" : ""} onClick={() => setSelected(index)}>
                    <td>I{index + 1}</td>
                    {Array.from({ length: step.cycle }, (_, cell) => {
                      const token = step.cells[index]?.[cell];
                      const row = step.cells[index];
                      const bubble = bubbles && !token && (row?.slice(0, cell).some(Boolean) ?? false) && (row?.slice(cell + 1).some(Boolean) ?? false);
                      return <td key={cell}>{token ? <span className={`st ${token}`}>{token === "FLUSH" ? "FL" : token}</span> : bubble ? <span className="st STALL">•</span> : ""}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="vl-legend"><i className="st IF" /> IF <i className="st ID" /> ID <i className="st EX" /> EX <i className="st MEM" /> MEM <i className="st WB" /> WB <i className="st BR" /> BR <i className="st FLUSH" /> FLUSH</p>
        </section>
      </div>
      <div className="vl-cards three">
        <article>
          <h2>Branch Predictor & Outcome</h2>
          <label>Predictor type
            <select aria-label="Predictor type" value={mode} onChange={(event) => { setMode(event.target.value as PredictorMode); play.reset(); }}>
              <option value="two">2-bit Saturating Counter</option>
              <option value="one">1-bit Predictor</option>
              <option value="alwaysT">Always Taken</option>
              <option value="alwaysN">Always Not Taken</option>
            </select>
          </label>
          <label>Initial counter
            <select aria-label="Initial counter" value={initial} disabled={mode !== "two" && mode !== "one"} onChange={(event) => { setInitial(Number(event.target.value) as Two); play.reset(); }}>
              {[0, 1, 2, 3].map((value) => <option key={value} value={value}>{twoName(value as Two)}</option>)}
            </select>
          </label>
          <p>Branch at PC: {branch >= 0 ? `${pcOf(branch)} (${ops[branch]?.text})` : "—"}</p>
          <p>Predicted outcome: <b>{resolved ? (resolved.predicted ? "Taken" : "Not Taken") : "not resolved"}</b></p>
          <p>Actual outcome: <b>{resolved ? (resolved.actual ? "Taken" : "Not Taken") : "not resolved"}</b></p>
          <p className={resolved && resolved.predicted !== resolved.actual ? "vl-bad" : "vl-ok"}>{resolved ? (resolved.predicted === resolved.actual ? "CORRECT" : "MISPREDICTION") : "Waiting for the branch to reach writeback."}</p>
        </article>
        <article className={mark("checkpoint")}>
          <h2>Checkpoint / Register Snapshot</h2>
          {showRegs ? (
            <table>
              <thead><tr><th>Register</th><th>Value</th><th>Comment</th></tr></thead>
              <tbody>
                {step.regs.map((reg) => {
                  const changed = previous?.regs.find((item) => item.name === reg.name)?.value !== reg.value;
                  return <tr key={reg.name}><td>{reg.name}</td><td>{reg.note.includes("squashed") ? "0xXXXXXXXX" : hex(reg.value)}{changed ? " *" : ""}</td><td>{reg.note}</td></tr>;
                })}
                <tr><td>PC</td><td>{pcOf(Math.min(step.pc, Math.max(0, ops.length - 1)))}</td><td>{step.redirect != null ? "corrected PC / refetch" : "fetch PC"}</td></tr>
              </tbody>
            </table>
          ) : <p>Register changes are hidden.</p>}
          <p>Squashed destinations are discarded. The checkpoint keeps the values written by instructions older than the branch.</p>
        </article>
        <article>
          <h2>Simulation Controls</h2>
          <Toggle on={predictOn} label="Enable speculation" onChange={(next) => { setPredictOn(next); play.reset(); }} />
          <label>Program (BEQ x1 x3 7 means taken target is instruction 7)
            <textarea aria-label="Speculative program" rows={6} value={custom ? program : preset.ops.map((op) => op.text).join("\n")} onChange={(event) => { setCustom(true); setProgram(event.target.value); play.reset(); }} spellCheck={false} />
          </label>
          {parsed.errors[0] ? <p className="vl-bad">{parsed.errors[0]}</p> : null}
          <label>Resolve branch after N cycles
            <select aria-label="Branch resolution latency" value={resolveAfter} onChange={(event) => { setResolveAfter(Number(event.target.value)); play.reset(); }}>
              {[0, 1, 2, 4, 6].map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label>Speculative window
            <select aria-label="Speculative window" value={windowSize} onChange={(event) => { setWindowSize(Number(event.target.value)); play.reset(); }}>
              {[0, 1, 2, 4, 6].map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <Toggle on={bubbles} label="Show Pipeline Bubbles" onChange={setBubbles} />
          <Toggle on={highlight} label="Highlight Misprediction" onChange={setHighlight} />
          <Toggle on={showRegs} label="Show Register Changes" onChange={setShowRegs} />
          <Toggle on={autoReset} label="Auto Reset on Completion" onChange={setAutoReset} />
          <Transport playing={play.playing} speed={play.speed} onSpeed={play.setSpeed} onPlay={() => play.setPlaying((value) => !value)} onStep={() => play.setCycle((value) => Math.min(result.steps.length - 1, value + 1))} onBack={() => play.setCycle((value) => Math.max(0, value - 1))} onReset={play.reset} />
        </article>
      </div>
      <div className="vl-seq">
        {[
          ["1. Misprediction Detected", "The branch reaches writeback and the actual direction differs from the prediction.", flushAt != null && step.cycle >= flushAt],
          ["2. Flush Pipeline", `Squash the ${result.squashed} younger wrong-path instructions.`, flushAt != null && step.cycle >= flushAt],
          ["3. Recover from Checkpoint", "Restore the architectural registers captured for that branch.", flushAt != null && step.cycle >= flushAt],
          ["4. Resume Execution", "Fetch the correct target and continue.", flushAt != null && step.cycle > flushAt],
        ].map(([title, text, on]) => <article key={String(title)} className={on ? "on" : ""}><b>{title}</b><p>{text}</p></article>)}
      </div>
      <div className="vl-metrics">
        <div><span>Total cycles</span><strong>{result.cycles}</strong></div>
        <div><span>Ideal cycles</span><strong>{result.idealCycles}</strong></div>
        <div><span>Speedup vs stall</span><strong>{speedup.toFixed(2)}x</strong></div>
        <div><span>Mispredictions</span><strong>{result.mispredictions}</strong></div>
        <div><span>Squashed</span><strong>{result.squashed}</strong></div>
        <div><span>Wasted instructions</span><strong>{result.squashed}</strong></div>
        <div><span>Useful speculative fetches</span><strong>{Math.max(0, result.speculativeFetched - result.squashed)}</strong></div>
        <div><span>Branch penalty</span><strong>{result.recoveryCycles}</strong></div>
      </div>
      <p>{result.mispredictions > 0 ? `Wrong-path instructions were squashed at the checkpoint. Corrected PC refetches the resolved target. Wasted cycles ${result.recoveryCycles}.` : predictOn ? "The predicted path matched the branch, so speculative work was kept." : "Speculation is off, so fetch waits for the branch to resolve."}</p>
    </LabChrome>
  );
}
