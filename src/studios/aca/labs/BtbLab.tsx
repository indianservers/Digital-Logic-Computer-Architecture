import { useMemo, useState } from "react";
import { BTB_PRESETS, BTB_SEED, btbGeometry, lookupEntry, runBtb, type BtbPolicy } from "../../../engines/aca/btb";
import { LabChrome, Toggle, Transport, usePlayback } from "./HazardLab";

const hex = (value: number) => `0x${value.toString(16).toUpperCase().padStart(4, "0")}`;

export function BtbLab() {
  const [presetId, setPresetId] = useState(BTB_PRESETS[0]?.id ?? "hot");
  const [ways, setWays] = useState(1);
  const [policy, setPolicy] = useState<BtbPolicy>("lru");
  const [enabled, setEnabled] = useState(true);
  const [details, setDetails] = useState(true);
  const [lookupText, setLookupText] = useState("0x4118");
  const preset = BTB_PRESETS.find((item) => item.id === presetId) ?? BTB_PRESETS[0];
  const config = useMemo(() => ({ entries: 8, ways, policy, enabled }), [ways, policy, enabled]);
  const geometry = btbGeometry(config);
  const shots = useMemo(() => runBtb(preset?.accesses ?? [], config, preset?.seed ? BTB_SEED : []), [preset, config]);
  const warm = useMemo(() => runBtb(preset?.seed ? BTB_SEED : [], config).at(-1), [preset, config]);
  const play = usePlayback(shots.length);
  const shot = play.cycle > 0 ? shots[play.cycle - 1] : undefined;
  const sets = shot?.sets ?? warm?.sets ?? [];
  const typed = Number.parseInt(lookupText.replace(/[^0-9a-f]/gi, ""), 16);
  const queryPc = Number.isNaN(typed) ? (shot?.pc ?? 0x4118) : typed;
  const query = lookupEntry(sets, queryPc, geometry.indexBits);
  const queryEntry = query.way >= 0 ? sets[query.index]?.[query.way] : undefined;
  const lookups = shot?.lookups ?? 0;
  const hits = shot?.hits ?? 0;
  return (
    <LabChrome lab="branch-target-buffer" kicker="Labs > Lab 8" title="Lab 8 — Branch Target Buffer Explorer" subtitle="Investigate how processors predict branch destinations before the branch executes." badge="RISC-V (5-Stage Pipeline)">
      <div className="vl-cards three">
        <article><h2>Learning Objective</h2><p>A direction predictor answers taken or not taken. The BTB answers a different question: if this branch is predicted taken, where should fetch continue? A hit supplies a target. It does not decide the direction.</p></article>
        <article><h2>Experiment Status</h2><p>{shot ? (play.cycle >= shots.length ? "Completed" : `Lookup ${shot.cycle} / ${shots.length}`) : "Ready to run"}</p></article>
        <article><h2>Fetch</h2><p>On a hit that is actually taken, the next PC is the stored target. On a miss, or when the branch is not taken, fetch continues at PC + 4. A return is not installed here; real CPUs usually use a return-address stack for that.</p></article>
      </div>
      <div className="vl-cards three">
        <section className="vl-panel">
          <header><h2>BTB Structure</h2><span>{config.entries} entries, {ways}-way, {geometry.sets} sets</span></header>
          <div className="vl-scroll">
            <table>
              <thead><tr><th>Set</th><th>Way</th><th>Tag</th><th>Target</th><th>Valid</th></tr></thead>
              <tbody>
                {sets.map((set, index) => set.map((entry, way) => (
                  <tr key={`${index}-${way}`} className={shot?.index === index ? "on" : ""}>
                    <td>{index}</td><td>{way}</td><td>{entry.valid ? hex(entry.tag) : "—"}</td><td>{entry.valid ? hex(entry.target) : "—"}</td><td className={entry.valid ? "vl-ok" : "vl-bad"}>{entry.valid ? "valid" : "empty"}</td>
                  </tr>
                )))}
              </tbody>
            </table>
          </div>
          <p>Index uses PC[{2 + geometry.indexBits}:{3}], tag uses the bits above that. PC[2:0] is the ignored alignment field.</p>
        </section>
        <section className="vl-panel">
          <h2>Lookup</h2>
          <label>Branch PC <input aria-label="Lookup PC" value={lookupText} onChange={(event) => setLookupText(event.target.value)} /></label>
          <p>Index {query.index} · tag {hex(query.tag)}</p>
          <p className={queryEntry ? "vl-ok" : "vl-bad"}>{queryEntry ? `BTB hit in set ${query.index}, way ${query.way}` : "BTB miss. No target is available yet."}</p>
          {details && shot ? <p>Trace PC {hex(shot.pc)} is a {shot.kind}. Actual direction {shot.taken ? "taken" : "not taken"}. Actual target {hex(shot.actualTarget)}.</p> : null}
          <p>Stored target {queryEntry ? hex(queryEntry.target) : "—"}</p>
        </section>
        <section className="vl-panel">
          <h2>Target Prediction</h2>
          <p><b>{shot?.predictedTarget != null ? hex(shot.predictedTarget) : "—"}</b> {shot?.hit ? "from the BTB" : "not predicted"}</p>
          <p>Next PC {shot ? hex(shot.nextPc) : "—"}. This uses the stored target only when the trace says the branch is taken and the BTB hit.</p>
          <h2>Replacement</h2>
          <label>Organization <select aria-label="Associativity" value={ways} onChange={(event) => { setWays(Number(event.target.value)); play.reset(); }}><option value={1}>Direct-mapped</option><option value={2}>2-way</option></select></label>
          <label>Policy <select aria-label="Replacement policy" value={policy} onChange={(event) => { setPolicy(event.target.value as BtbPolicy); play.reset(); }} disabled={ways === 1}><option value="lru">Least recently used</option><option value="fifo">FIFO</option></select></label>
          <p>{ways === 1 ? "Direct-mapped replacement overwrites the single line in the set." : policy === "lru" ? "The least recently used valid line in the set is the victim." : "The oldest installed line in the set is the victim."}</p>
          {shot?.evicted ? <p>Victim PC {hex(shot.evicted.pc)}, old target {hex(shot.evicted.target)}, replaced by {hex(shot.pc)} → {hex(shot.actualTarget)}.</p> : <p>No eviction on this lookup.</p>}
        </section>
      </div>
      <div className="vl-split">
        <section className="vl-panel">
          <h2>Hit / Miss</h2>
          <div className="vl-flow">
            <span className={shot?.hit ? "commit" : ""}>Hit<br />{shot?.hit ? "entry found" : "—"}</span>
            <span className={shot && !shot.hit ? "writeback" : ""}>Miss<br />{shot && !shot.hit ? "target unknown until the branch resolves" : "—"}</span>
          </div>
          <p>{shot?.installed ? "This taken branch allocated a new line." : shot?.hit ? "The line was already present and its target was refreshed if the branch was taken." : "A not-taken miss does not allocate, because the BTB still has no target to store."}</p>
        </section>
        <section className="vl-panel">
          <h2>Fetch-to-Branch Flow</h2>
          <div className="vl-flow">
            <span className="fetch">1. Fetch<br />{shot ? hex(shot.pc) : "PC"}</span>
            <span className="decode">2. BTB lookup<br />set {shot?.index ?? query.index}</span>
            <span className="execute">3. Prediction<br />{shot?.hit ? "use target" : "use PC + 4"}</span>
            <span className="commit">4. Next PC<br />{shot ? hex(shot.nextPc) : "—"}</span>
          </div>
        </section>
      </div>
      <div className="vl-cards three">
        <article>
          <h2>Simulation Controls</h2>
          <label>Trace <select aria-label="BTB trace" value={presetId} onChange={(event) => { setPresetId(event.target.value); play.reset(); }}>{BTB_PRESETS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <Toggle on={enabled} label="Enable BTB" onChange={(next) => { setEnabled(next); play.reset(); }} />
          <Toggle on={details} label="Show Lookup Details" onChange={setDetails} />
          <Transport playing={play.playing} speed={play.speed} onSpeed={play.setSpeed} onPlay={() => play.setPlaying((value) => !value)} onStep={() => play.setCycle((value) => Math.min(shots.length, value + 1))} onBack={() => play.setCycle((value) => Math.max(0, value - 1))} onReset={play.reset} />
        </article>
        <article>
          <h2>Results</h2>
          <div className="vl-metrics">
            <div><span>Predicted target</span><strong>{shot?.predictedTarget != null ? hex(shot.predictedTarget) : "—"}</strong></div>
            <div><span>Next PC</span><strong>{shot ? hex(shot.nextPc) : "—"}</strong></div>
            <div><span>Hit rate</span><strong>{lookups ? Math.round((hits / lookups) * 1000) / 10 : 0}%</strong><span>{hits} / {lookups}</span></div>
          </div>
          <p>Target matches {shot?.targetHits ?? 0}. Evictions {shot?.evictions ?? 0}. Hit rate counts tag matches. It is not a taken/not-taken accuracy.</p>
        </article>
        <article>
          <h2>Trace row</h2>
          {shot ? <p>{shot.text} at {hex(shot.pc)}. {shot.targetCorrect ? "The stored target matches the resolved target." : shot.hit ? "The stored target differs from the resolved target, so this hit is still a wrong redirect." : "Miss: the resolved target is learned only if the branch is taken."}</p> : <p>The hot-loop preset starts from three installed lines. Other presets start empty. Step to watch allocation.</p>}
        </article>
      </div>
    </LabChrome>
  );
}
