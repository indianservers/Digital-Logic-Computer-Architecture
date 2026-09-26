import { useMemo, useState } from "react";
import { SHARE_BASE, SHARE_PRESETS, lineId, repeatOps, runFalseShare, shareReduction, type ShareVar } from "../../../engines/aca/falseSharing";
import { LabChrome, Toggle, Transport, usePlayback } from "./HazardLab";
import { PingPong } from "../animation/phase2Views";
import { useGuideFocus } from "../guide/focus";

const COLORS = ["#dbeafe", "#dcfce7", "#fef3c7", "#f3e8ff"];

export function FalseShareLab() {
  const initial = SHARE_PRESETS[1];
  const [presetId, setPresetId] = useState(initial?.id ?? "same");
  const [variables, setVariables] = useState<ShareVar[]>(initial?.variables ?? []);
  const [extra, setExtra] = useState<number[]>(initial?.extra ?? []);
  const [lineBytes, setLineBytes] = useState(initial?.lineBytes ?? 64);
  const [padding, setPadding] = useState(initial?.padding ?? false);
  const [rounds, setRounds] = useState(initial?.rounds ?? 8);
  const [mode, setMode] = useState(initial?.mode ?? "false");
  const [showAddr, setShowAddr] = useState(true);
  const [showInv, setShowInv] = useState(true);
  const [showState, setShowState] = useState(true);
  const [auto, setAuto] = useState(true);
  const ops = useMemo(() => repeatOps(variables, rounds, "inc", extra), [variables, rounds, extra]);
  const result = useMemo(() => runFalseShare(variables, ops, lineBytes, padding), [variables, ops, lineBytes, padding]);
  const compared = useMemo(() => shareReduction(variables, rounds, lineBytes, extra), [variables, rounds, lineBytes, extra]);
  const play = usePlayback(Math.max(0, result.shots.length - 1));
  const { id: guideFocus, setId: setGuideFocus } = useGuideFocus();
  const shot = result.shots[Math.min(play.cycle, result.shots.length - 1)];
  if (!shot) return null;
  const focus = result.placed[0];
  const focusLine = focus ? lineId(focus.offset, lineBytes) : 0;
  const onLine = result.placed.filter((item) => lineId(item.offset, lineBytes) === focusLine);
  const threads = [...new Set([...result.placed.map((item) => item.core), ...extra])];
  const ratio = compared.padded.final.cycles === 0 ? 1 : compared.plain.final.cycles / compared.padded.final.cycles;
  const pingPong = mode === "false" && !padding && Boolean(shot.events.at(-1)?.migration);
  const hint = pingPong
    ? "The protocol moves the entire line even though each core modifies a different variable."
    : padding && mode === "false"
      ? "Padding is on. Compare migrations with the same writes and padding off."
      : mode === "true"
        ? "Both cores write the same variable. These transfers are true sharing."
        : "Run false sharing, then turn on Add cache-line padding and compare migrations.";
  const owner = shot.owners[focusLine];
  return (
    <LabChrome lab="false-sharing" kicker="Labs > Lab 20" title="Lab 20 — False Sharing Visualizer" subtitle="See how independent variables in one cache line create unnecessary coherence traffic, and how padding fixes it." badge="RISC-V (5-Stage Pipeline)" hint={hint}>
      <div className="vl-cards three">
        <article><h2>Learning Objective</h2><p>Understand false sharing, observe coherence traffic caused by independent variables in the same cache line, and see how padding removes that traffic. True sharing is different: both cores really use one variable.</p></article>
        <article><h2>Experiment Status</h2><p>{play.cycle === 0 ? "Ready to run" : shot.event}</p><p>Local hit costs 1. A cold fill costs 4. An ownership transfer costs 12. These are lab units, not a chip's cycle time.</p></article>
        <article><h2>Sharing</h2><p>{mode === "true" ? "This trace writes one variable from two cores. The transfers are necessary." : mode === "none" ? "These variables already sit on different lines." : "These variables are different locations. The line still bounces because coherence moves the whole line."}</p></article>
      </div>
      <div className="vl-cards two">
        <article className={guideFocus === "line" ? "aca-guide-on" : undefined}>
          <header>
            <h2>Cache Line Layout</h2>
            <label>Cache line size
              <select aria-label="Cache line size" value={lineBytes} onChange={(event) => { setLineBytes(Number(event.target.value)); play.reset(); }}>
                <option value={32}>32 bytes</option>
                <option value={64}>64 bytes</option>
                <option value={128}>128 bytes</option>
              </select>
            </label>
          </header>
          <div className="vl-pills">
            <button type="button" className={mode === "false" ? "on" : ""} onClick={() => { const next = SHARE_PRESETS[1]; if (!next) return; setPresetId(next.id); setVariables(next.variables); setExtra(next.extra); setPadding(false); setMode("false"); play.reset(); }}>False sharing</button>
            <button type="button" className={mode === "true" ? "on" : ""} onClick={() => { const next = SHARE_PRESETS[2]; if (!next) return; setPresetId(next.id); setVariables(next.variables); setExtra(next.extra); setPadding(false); setMode("true"); play.reset(); }}>True sharing</button>
          </div>
          <p>Cache line ({lineBytes} bytes){showAddr ? ` at 0x${(SHARE_BASE + (focus?.offset ?? 0)).toString(16)}` : ""}</p>
          <div className="vl-bytes" aria-label="Cache line bytes">
            {onLine.map((item) => (
              <span key={item.name} style={{ background: COLORS[item.core] ?? "#e2e8f0", flex: item.bytes }}>
                Core {item.core}<br />{item.name}<br />{item.bytes} B{showState ? ` = ${shot.values[item.name] ?? 0}` : ""}
              </span>
            ))}
            <span style={{ background: "#f1f5f9", flex: Math.max(1, lineBytes - onLine.reduce((sum, item) => sum + item.bytes, 0)) }}>{onLine.length ? "rest of the line" : "empty"}</span>
          </div>
          <p>{onLine.length > 1 ? "These variables share this line, so a write by one core invalidates the other." : "This line holds one of the variables. The other sits on a different line."} {showState && owner !== null && owner !== undefined ? `Owner now: Core ${owner}.` : ""}</p>
          <PingPong from={shot.events.at(-1)?.ownerBefore == null ? "Memory" : `Core ${shot.events.at(-1)?.ownerBefore}`} to={shot.events.at(-1)?.ownerAfter == null ? "Memory" : `Core ${shot.events.at(-1)?.ownerAfter}`} moved={Boolean(shot.events.at(-1)?.migration)} padding={padding} shared={onLine.length > 1} speed={play.speed} cycle={play.cycle} />
          <label>Example
            <select aria-label="Load example" value={presetId} onChange={(event) => {
              const next = SHARE_PRESETS.find((item) => item.id === event.target.value);
              setPresetId(event.target.value);
              if (next) { setVariables(next.variables); setExtra(next.extra); setLineBytes(next.lineBytes); setPadding(next.padding); setRounds(next.rounds); setMode(next.mode); }
              play.reset();
            }}>
              {SHARE_PRESETS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
        </article>
        <article>
          <h2>Thread Activity</h2>
          <div className="vl-cores">
            {threads.map((core) => {
              const variable = result.placed.find((item) => item.core === core) ?? result.placed[0];
              return (
                <div key={core} style={{ background: COLORS[core] ?? "#e2e8f0" }}>
                  <b>Thread {core} (Core {core})</b>
                  <span>Variable {variable?.name}</span>
                  {showAddr ? <span>0x{(SHARE_BASE + (variable?.offset ?? 0)).toString(16)}</span> : null}
                  <span>Increment × {rounds}</span>
                  <span>{play.cycle === 0 ? "Ready" : "Running"}</span>
                </div>
              );
            })}
          </div>
          <h2>Padding</h2>
          <Toggle on={padding} label="Add cache-line padding between variables" onChange={(next) => { setPadding(next); play.reset(); }} />
          <p>Padding places each variable at the start of its own {lineBytes}-byte line. The values stay independent either way. Padding changes the line, not the variable.</p>
          <label>Iterations
            <input aria-label="Iterations" type="number" min={1} max={200} value={rounds} onChange={(event) => { setRounds(Math.max(1, Math.min(200, Number(event.target.value) || 1))); play.reset(); }} />
          </label>
        </article>
      </div>
      <div className="vl-cards three">
        <article className={guideFocus === "traffic" ? "aca-guide-on" : undefined}>
          <h2>Coherence Traffic Counters</h2>
          <div className="vl-metrics">
            <div><strong>{shot.invalidations}</strong><span>Invalidations</span></div>
            <div><strong>{shot.transfers}</strong><span>Line transfers</span></div>
            <div><strong>{shot.invalidations + shot.transfers + shot.misses}</strong><span>Bus transactions</span></div>
          </div>
          <p>False-sharing events {shot.falseEvents}. True-sharing events {shot.trueEvents}. Writes {shot.writes}. Reads {shot.reads}. Migrations {shot.migrations}. Estimated cycles {shot.cycles}.</p>
        </article>
        <article>
          <h2>Performance Comparison</h2>
          <div className="vl-bars">
            <b>No padding<i style={{ height: `${Math.min(80, ratio * 40)}px`, background: "#f87171" }} />{ratio.toFixed(2)}×</b>
            <b>With padding<i className="two" style={{ height: "40px", background: "#4ade80" }} />1.00×</b>
          </div>
          <p>Same increments. No padding costs {compared.plain.final.cycles} units. Padding costs {compared.padded.final.cycles}. Invalidations fall by {compared.reduction}%.</p>
        </article>
        <article>
          <h2>Padding</h2>
          <p>{compared.reduction > 0 ? "Separating the variables removes the invalidations that came from sharing a line." : "Padding does not remove traffic when both cores update the same variable, or when the variables were already on different lines."}</p>
        </article>
      </div>
      <div className="vl-cards three">
        <article>
          <h2>Invalidation Timeline</h2>
          <table>
            <thead><tr><th>Event</th><th>What happened</th><th>Kind</th></tr></thead>
            <tbody>
              {shot.events.filter((item) => !showInv || item.kind !== "local").slice(-8).map((item) => (
                <tr key={item.index} className={item.index === play.cycle ? "on" : ""}>
                  <td>{item.index}</td>
                  <td>C{item.core} {item.op} {item.name}{item.invalidated.length ? ` · invalidates C${item.invalidated.join(", C")}` : ""}</td>
                  <td>{item.kind}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="vl-legend"><i className="recent" /> write <i className="used" /> invalidation <i className="free" /> shared or exclusive owner</p>
        </article>
        <article>
          <h2>Simulation Controls</h2>
          <Toggle on={showAddr} label="Show Memory Addresses" onChange={setShowAddr} />
          <Toggle on={showInv} label="Show Invalidations" onChange={setShowInv} />
          <Toggle on={showState} label="Show Cache Line State" onChange={setShowState} />
          <Toggle on={auto} label="Auto Replay" onChange={setAuto} />
          <Transport playing={play.playing} onPlay={() => { if (!auto) { play.setCycle((value) => Math.min(result.shots.length - 1, value + 1)); return; } play.setPlaying((value) => !value); }} onStep={() => play.setCycle((value) => Math.min(result.shots.length - 1, value + 1))} onBack={() => play.setCycle((value) => Math.max(0, value - 1))} onReset={() => { setGuideFocus(""); play.reset(); }} speed={play.speed} onSpeed={play.setSpeed} />
        </article>
        <article>
          <h2>Results & Insights</h2>
          <div className="vl-metrics">
            <div><strong>{(compared.plain.final.cycles / Math.max(1, compared.padded.final.cycles)).toFixed(2)}×</strong><span>No padding</span></div>
            <div><strong>1.00×</strong><span>With padding</span></div>
            <div><strong>{compared.reduction}%</strong><span>Fewer invalidations</span></div>
          </div>
          <p>Values now: {Object.entries(shot.values).map(([name, value]) => `${name}=${value}`).join(", ") || "none"}. A false-sharing write never stores through the other variable's bytes.</p>
        </article>
      </div>
    </LabChrome>
  );
}
