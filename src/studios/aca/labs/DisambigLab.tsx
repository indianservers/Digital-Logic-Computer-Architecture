import { useMemo, useState } from "react";
import { DISAMBIG_PRESETS, MEM_IMAGE, MEM_REGS, comparePolicies, runLsq, type LsqOp, type MemPolicy } from "../../../engines/aca/lsq";
import { LabChrome, Toggle, Transport, usePlayback } from "./HazardLab";
import { PolicyPath } from "../animation/phase2Views";
import { useGuideFocus } from "../guide/focus";

const POLICIES: Array<{ id: MemPolicy; label: string }> = [
  { id: "storeSet", label: "Store Set Predictor" },
  { id: "counter", label: "2-bit Saturating Counter" },
  { id: "bypass", label: "Always Bypass" },
  { id: "conservative", label: "Conservative" },
];

function parseMem(text: string): LsqOp[] {
  const ops: LsqOp[] = [];
  text.split("\n").forEach((line, index) => {
    const trimmed = line.trim();
    const load = trimmed.match(/^LD\s+(x\d+)\s*,\s*(-?\d+)\((x\d+)\)/i);
    if (load?.[1] && load[2] && load[3]) {
      ops.push({ pc: 0x4000 + index * 4, text: trimmed, comment: "edited", kind: "load", dest: load[1], dataReg: null, immData: null, base: load[3], offset: Number(load[2]), latency: 0 });
      return;
    }
    const store = trimmed.match(/^SD\s+(x\d+)\s*,\s*(-?\d+)\((x\d+)\)/i);
    if (store?.[1] && store[2] && store[3]) {
      ops.push({ pc: 0x4000 + index * 4, text: trimmed, comment: "edited", kind: "store", dest: null, dataReg: store[1], immData: null, base: store[3], offset: Number(store[2]), latency: 0 });
    }
  });
  return ops;
}

function points(values: number[]) {
  if (!values.length) return "0,32 100,32";
  return values.map((value, index) => `${values.length === 1 ? 0 : (index / (values.length - 1)) * 100},${36 - value * 32}`).join(" ");
}

export function DisambigLab() {
  const [presetId, setPresetId] = useState(DISAMBIG_PRESETS[6]?.id ?? "train");
  const [policy, setPolicy] = useState<MemPolicy>("storeSet");
  const [threshold, setThreshold] = useState(2);
  const [bypassOn, setBypassOn] = useState(true);
  const [unknownIndependent, setUnknownIndependent] = useState(false);
  const [forwardOn, setForwardOn] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [showAddress, setShowAddress] = useState(true);
  const [showReplay, setShowReplay] = useState(true);
  const [showStalls, setShowStalls] = useState(true);
  const [auto, setAuto] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [ops, setOps] = useState<LsqOp[]>(DISAMBIG_PRESETS[6]?.ops ?? []);
  const effective: MemPolicy = !enabled || !bypassOn ? "conservative" : unknownIndependent ? "bypass" : policy;
  const result = useMemo(() => runLsq(ops, MEM_REGS, MEM_IMAGE, { policy: effective, forwarding: forwardOn, checks: true, threshold }), [ops, effective, forwardOn, threshold]);
  const compared = useMemo(() => comparePolicies(ops, MEM_REGS, MEM_IMAGE, threshold), [ops, threshold]);
  const play = usePlayback(Math.max(0, result.shots.length - 1));
  const { id: guideFocus, setId: setGuideFocus } = useGuideFocus();
  const shot = result.shots[Math.min(play.cycle, Math.max(0, result.shots.length - 1))];
  if (!shot) return null;
  const replayRows = shot.log.filter((item) => showReplay || (item.event !== "Replay" && item.event !== "Violation")).slice(-6);
  const decided = result.correct + result.wrong;
  const accuracy = decided ? Math.round((result.correct / decided) * 100) : 0;
  const previous = result.shots[Math.min(play.cycle, result.shots.length - 1) - 1];
  const replayed = shot.replays > (previous?.replays ?? 0);
  const hint = replayed
    ? "A bypassed load matched an older store. That load is replaying."
    : effective === "conservative" && shot.waits > 0
      ? "Conservative mode is waiting on an older store whose address is still unknown."
      : effective === "bypass" && shot.bypasses > 0
        ? "Always Bypass let a load pass an unresolved older store."
        : "Compare waits and replays after you Reset and change the predictor.";
  const move = (index: number, delta: number) => {
    const next = index + delta;
    if (next < 0 || next >= ops.length) return;
    const copy = ops.slice();
    const [item] = copy.splice(index, 1);
    if (!item) return;
    copy.splice(next, 0, item);
    setOps(copy);
    play.reset();
  };
  return (
    <LabChrome lab="memory-disambiguation" kicker="Labs > Lab 15" title="Lab 15 — Memory Disambiguation" subtitle="Test how processors predict load-store dependencies and when speculative loads must be replayed." badge="RISC-V (5-Stage Pipeline)" hint={hint}>
      <div className="vl-cards three">
        <article><h2>Learning Objective</h2><p>Understand how memory disambiguation predicts load-store dependencies, explore unknown addresses and load bypassing, and see when speculative loads must be replayed.</p></article>
        <article><h2>Experiment Status</h2><p>{play.cycle === 0 ? "Ready to run" : shot.event}</p><p>Effective policy: {POLICIES.find((item) => item.id === effective)?.label}. A younger load waits only when the policy says an older unknown store might conflict.</p></article>
        <article><h2>Speculation</h2><p>Speculation lets a load pass an older store whose address is still unknown. If that store later matches, the load is wrong and must replay. No policy is best for every workload.</p></article>
      </div>
      <div className="vl-cards three">
        <article>
          <header>
            <h2>Instruction Sequence</h2>
            <button type="button" onClick={() => { setEditing((value) => !value); setDraft(ops.map((op) => op.text).join("\n")); }}>{editing ? "Close Editor" : "Edit Instructions"}</button>
            <select aria-label="Load example" value={presetId} onChange={(event) => {
              const next = DISAMBIG_PRESETS.find((item) => item.id === event.target.value);
              setPresetId(event.target.value);
              if (next) setOps(next.ops);
              play.reset();
            }}>
              {DISAMBIG_PRESETS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </header>
          {editing ? (
            <textarea aria-label="Instruction text" rows={8} value={draft} onChange={(event) => {
              setDraft(event.target.value);
              const parsed = parseMem(event.target.value);
              if (parsed.length) { setOps(parsed); play.reset(); }
            }} />
          ) : null}
          <table>
            <thead><tr><th>#</th><th>Instruction</th><th>Comment</th><th /></tr></thead>
            <tbody>
              {ops.map((op, index) => (
                <tr key={`${op.pc}-${index}`}>
                  <td>{index + 1}</td><td>{op.text}</td><td>{op.comment}</td>
                  <td><button type="button" className="vl-up" onClick={() => move(index, -1)}>Up</button> <button type="button" className="vl-down" onClick={() => move(index, 1)}>Down</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
        <article className={guideFocus === "policy" ? "aca-guide-on" : undefined}>
          <h2>Dependency Predictor</h2>
          <label>Predictor Type
            <select aria-label="Predictor type" value={policy} onChange={(event) => { setPolicy(event.target.value as MemPolicy); play.reset(); }}>
              {POLICIES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
          <label>Confidence Threshold {Math.round((threshold / 3) * 100)}%
            <input aria-label="Confidence threshold" type="range" min={0} max={3} step={1} value={threshold} onChange={(event) => { setThreshold(Number(event.target.value)); play.reset(); }} />
          </label>
          <p>The 2-bit counter starts at weakly bypass. Bypass is allowed when the counter is at least the threshold. 00 waits strongly, 11 bypasses strongly. A conflict trains toward wait. Independence trains toward bypass.</p>
          <table>
            <thead><tr><th>Load #</th><th>Predicted Dep?</th><th>Confidence</th><th>Action</th></tr></thead>
            <tbody>
              {shot.decisions.map((item) => (
                <tr key={item.index}><td>L{item.index} ({item.text})</td><td>{item.predictedDep ? "Yes" : "No"}</td><td>{Math.round(item.confidence * 100)}%</td><td className={item.action === "Speculate" ? "vl-ok" : "vl-bad"}>{item.action}</td></tr>
              ))}
            </tbody>
          </table>
        </article>
        <article>
          <h2>Unknown Address / Load Bypass</h2>
          <Toggle on={bypassOn} label="Enable Load Bypassing" onChange={(next) => { setBypassOn(next); play.reset(); }} />
          <Toggle on={unknownIndependent} label="Treat Unknown Addresses as Independent" onChange={(next) => { setUnknownIndependent(next); play.reset(); }} />
          <Toggle on={forwardOn} label="Use Store Queue for Forwarding" onChange={(next) => { setForwardOn(next); play.reset(); }} />
          {showAddress ? (
            <table>
              <thead><tr><th>Store</th><th>Address</th></tr></thead>
              <tbody>
                {shot.stores.map((entry) => <tr key={entry.index}><td>{entry.text}</td><td className={entry.address === "?" ? "vl-bad" : "vl-ok"}>{entry.address === "?" ? "Unknown" : entry.address}</td></tr>)}
              </tbody>
            </table>
          ) : null}
          <p>Loads that bypassed: {shot.bypasses}. Loads that waited: {shot.waits}. {showStalls ? `Stall events so far: ${shot.stalls}.` : ""}</p>
          <PolicyPath action={shot.decisions.at(-1)?.action ?? ""} replay={shot.replays > (result.shots[play.cycle - 1]?.replays ?? 0)} waits={shot.waits} bypasses={shot.bypasses} speed={play.speed} cycle={play.cycle} />
        </article>
      </div>
      <div className="vl-cards three">
        <article className={guideFocus === "replay" ? "aca-guide-on" : undefined}>
          <h2>Replay Log</h2>
          <table>
            <thead><tr><th>Cycle</th><th>Event</th><th>Instruction</th><th>Reason</th></tr></thead>
            <tbody>
              {replayRows.map((item, index) => (
                <tr key={`${item.cycle}-${index}`}><td>{item.cycle}</td><td>{item.event}</td><td>{item.detail}</td><td>{item.event === "Violation" ? "Older store resolved to the same address" : item.detail}</td></tr>
              ))}
            </tbody>
          </table>
        </article>
        <article>
          <h2>Predictor Accuracy</h2>
          <svg viewBox="0 0 100 40" role="img" aria-label="Predictor accuracy and misprediction rate">
            <polyline fill="none" stroke="#2563eb" strokeWidth="1.4" points={points(shot.accuracy)} />
            <polyline fill="none" stroke="#ef4444" strokeWidth="1.4" points={points(shot.misrate)} />
          </svg>
          <p className="vl-legend"><span className="vl-ok">Correct</span> <span className="vl-bad">Misprediction</span></p>
        </article>
        <article>
          <h2>Conflict Detection Results</h2>
          <table>
            <thead><tr><th>Load</th><th>Outcome</th><th>Result</th></tr></thead>
            <tbody>
              {shot.decisions.map((item) => (
                <tr key={item.index}><td>{item.text}</td><td>{item.outcome}</td><td className={item.outcome === "false-bypass" ? "vl-bad" : "vl-ok"}>{item.outcome}</td></tr>
              ))}
            </tbody>
          </table>
        </article>
      </div>
      <div className="vl-cards three">
        <article>
          <h2>Simulation Controls</h2>
          <Toggle on={enabled} label="Enable Memory Disambiguation" onChange={(next) => { setEnabled(next); play.reset(); }} />
          <Toggle on={showAddress} label="Show Address Resolution" onChange={setShowAddress} />
          <Toggle on={showReplay} label="Highlight Replays" onChange={setShowReplay} />
          <Toggle on={showStalls} label="Show Pipeline Stalls" onChange={setShowStalls} />
          <Toggle on={auto} label="Auto Advance Simulation" onChange={setAuto} />
          <Transport
            playing={play.playing}
            onPlay={() => { if (!auto) { play.setCycle((value) => Math.min(result.shots.length - 1, value + 1)); return; } play.setPlaying((value) => !value); }}
            onStep={() => play.setCycle((value) => Math.min(result.shots.length - 1, value + 1))}
            onBack={() => play.setCycle((value) => Math.max(0, value - 1))} onReset={() => { setGuideFocus(""); play.reset(); }}
            speed={play.speed}
            onSpeed={play.setSpeed}
          />
        </article>
        <article>
          <h2>Results & Insights</h2>
          <div className="vl-metrics">
            <div><strong>{result.correct}</strong><span>Correct Predictions ({accuracy}%)</span></div>
            <div><strong>{result.wrong}</strong><span>Mispredictions</span></div>
            <div><strong>{result.replays}</strong><span>Replays</span></div>
          </div>
          <table>
            <thead><tr><th>Policy</th><th>Cycles</th><th>Waits</th><th>Bypasses</th><th>Violations</th><th>Replays</th></tr></thead>
            <tbody>
              <tr><td>Conservative</td><td>{compared.conservative.cycles}</td><td>{compared.conservative.waits}</td><td>{compared.conservative.bypasses}</td><td>{compared.conservative.violations}</td><td>{compared.conservative.replays}</td></tr>
              <tr><td>Always Bypass</td><td>{compared.bypass.cycles}</td><td>{compared.bypass.waits}</td><td>{compared.bypass.bypasses}</td><td>{compared.bypass.violations}</td><td>{compared.bypass.replays}</td></tr>
              <tr><td>Predictor</td><td>{compared.predictor.cycles}</td><td>{compared.predictor.waits}</td><td>{compared.predictor.bypasses}</td><td>{compared.predictor.violations}</td><td>{compared.predictor.replays}</td></tr>
            </tbody>
          </table>
        </article>
        <article>
          <h2>Accurate disambiguation</h2>
          <p>The same instruction list is run under conservative, always-bypass, and the 2-bit predictor. Waiting avoids replays. Bypassing saves wait cycles when the addresses differ and pays a replay when they match.</p>
          <p>Store sets wait only for an older store PC that previously conflicted with this load PC. An empty set bypasses.</p>
        </article>
      </div>
    </LabChrome>
  );
}
