import { useEffect, useMemo, useState } from "react";
import { SUPER_PRESETS, runSuper, type SuperWidths } from "../../../engines/aca/superscalar";
import { LabChrome, Toggle, Transport, usePlayback } from "./HazardLab";
import { WidthFlow } from "../animation/phase2Views";
import { useGuideFocus } from "../guide/focus";

const SCALAR: SuperWidths = { fetch: 1, decode: 1, dispatch: 1, execute: 1, retire: 1 };

function line(values: number[], width: number, height: number, max: number) {
  if (values.length === 0) return "";
  return values.map((value, index) => {
    const x = values.length === 1 ? 0 : (index / (values.length - 1)) * width;
    const y = height - 16 - (value / max) * (height - 28);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

export function SuperscalarLab() {
  const [presetId, setPresetId] = useState(SUPER_PRESETS[2]?.id ?? "mixed");
  const [widths, setWidths] = useState<SuperWidths>(SUPER_PRESETS[2]?.widths ?? { fetch: 4, decode: 4, dispatch: 4, execute: 4, retire: 4 });
  const [bubbles, setBubbles] = useState(true);
  const [lanesOn, setLanesOn] = useState(true);
  const [ids, setIds] = useState(true);
  const [autoReset, setAutoReset] = useState(false);
  const [selected, setSelected] = useState(0);
  const preset = SUPER_PRESETS.find((item) => item.id === presetId) ?? SUPER_PRESETS[0];
  const wide = useMemo(() => runSuper(preset?.ops ?? [], widths), [preset, widths]);
  const scalar = useMemo(() => runSuper(preset?.ops ?? [], SCALAR), [preset]);
  const play = usePlayback(Math.max(0, wide.cycles - 1));
  useEffect(() => {
    if (!autoReset || play.cycle === 0 || play.cycle < wide.cycles - 1) return;
    play.setPlaying(false);
    play.setCycle(0);
  }, [autoReset, play, wide.cycles]);
  const { id: guideFocus, setId: setGuideFocus } = useGuideFocus();
  if (!preset) return null;
  const shown = Math.min(play.cycle + 1, wide.cycles);
  const retiredNow = wide.retireAt.filter((cycle) => cycle != null && cycle <= shown).length;
  const speedup = wide.cycles === 0 ? 0 : scalar.cycles / wide.cycles;
  const maxIpc = Math.max(1, ...wide.ipcHistory, ...scalar.ipcHistory);
  const widthOrder = [
    ["Fetch", widths.fetch],
    ["Decode", widths.decode],
    ["Dispatch", widths.dispatch],
    ["Execute", widths.execute],
    ["Retire", widths.retire],
  ] as const;
  const narrowest = Math.min(...widthOrder.map((item) => item[1]));
  const limited = widthOrder.filter((item) => item[1] === narrowest);
  const bottleneck = limited.length === widthOrder.length ? "balanced" : limited[limited.length - 1]?.[0] ?? "Fetch";
  const hint = bottleneck === "balanced"
    ? "No stage is narrower than the others. IPC still depends on the dependences in this instruction stream."
    : `Watch ${bottleneck} — it is currently limiting throughput.`;
  const setWidth = (key: keyof SuperWidths, value: number) => setWidths((current) => ({ ...current, [key]: value }));
  const apply = (next: SuperWidths) => { setWidths(next); play.reset(); };
  return (
    <LabChrome lab="superscalar" kicker="Labs > Lab 11" title="Lab 11 — Superscalar Pipeline Explorer" subtitle="Experiment with fetch, decode, dispatch, execution, and retirement width to see how superscalar processors increase IPC." badge="RISC-V (5-Stage Pipeline)" hint={hint}>
      <div className="vl-cards three">
        <article><h2>Learning Objective</h2><p>Understand how a superscalar processor moves multiple instructions per cycle, and why dependencies and the narrowest stage limit the instructions that actually retire.</p></article>
        <article><h2>Experiment Status</h2><p>{play.cycle === 0 ? "Ready to run" : `Cycle ${shown}. Retired ${retiredNow} of ${preset.ops.length}.`}</p><p>This model issues in order and retires in order. Width is a cap, not a guaranteed IPC.</p></article>
        <article>
          <h2>Scalar vs Superscalar</h2>
          <p>Scalar IPC {(scalar.retired / Math.max(1, scalar.cycles)).toFixed(2)} in {scalar.cycles} cycles.</p>
          <p>Superscalar IPC {wide.ipc.toFixed(2)} in {wide.cycles} cycles. Relative time {(wide.cycles / Math.max(1, scalar.cycles)).toFixed(2)}x.</p>
        </article>
      </div>
      <section className={guideFocus === "widths" ? "vl-panel aca-guide-on" : "vl-panel"}>
        <header>
          <h2>Pipeline Width Configuration</h2>
          <div className="vl-chips">
            <button type="button" className={same(widths, SCALAR) ? "on" : ""} onClick={() => apply(SCALAR)}>Scalar (1)</button>
            <button type="button" className={same(widths, { fetch: 2, decode: 2, dispatch: 2, execute: 2, retire: 2 }) ? "on" : ""} onClick={() => apply({ fetch: 2, decode: 2, dispatch: 2, execute: 2, retire: 2 })}>Dual Issue (2)</button>
            <button type="button" className={same(widths, { fetch: 4, decode: 4, dispatch: 4, execute: 4, retire: 4 }) ? "on" : ""} onClick={() => apply({ fetch: 4, decode: 4, dispatch: 4, execute: 4, retire: 4 })}>Quad Issue (4)</button>
          </div>
        </header>
        <div className="vl-widths">
          {(["fetch", "decode", "dispatch", "execute", "retire"] as const).map((key) => (
            <label key={key}>{key[0]?.toUpperCase()}{key.slice(1)} width
              <span>
                <button type="button" aria-label={`Decrease ${key} width`} onClick={() => { setWidth(key, Math.max(1, widths[key] - 1)); play.reset(); }}>−</button>
                <b>{widths[key]}</b>
                <button type="button" aria-label={`Increase ${key} width`} onClick={() => { setWidth(key, Math.min(4, widths[key] + 1)); play.reset(); }}>+</button>
              </span>
            </label>
          ))}
        </div>
      </section>
      <div className="vl-split">
        <section className="vl-panel">
          <header>
            <h2>Instruction Stream</h2>
            <select aria-label="Load example" value={preset.id} onChange={(event) => {
              const next = SUPER_PRESETS.find((item) => item.id === event.target.value);
              setPresetId(event.target.value);
              if (next) setWidths(next.widths);
              play.reset();
            }}>
              {SUPER_PRESETS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </header>
          <table>
            <thead><tr><th>#</th><th>Instruction</th><th>Comment</th></tr></thead>
            <tbody>
              {preset.ops.map((op, index) => <tr key={`${op.text}-${index}`} className={selected === index ? "on" : ""} onClick={() => setSelected(index)}><td>{index + 1}</td><td>{op.text}</td><td>{op.comment}</td></tr>)}
            </tbody>
          </table>
          <p>I{selected + 1} uses lane {wide.lanes[selected] ?? 0}. It retires at cycle {wide.retireAt[selected] ?? "—"}. A younger instruction cannot retire ahead of it.</p>
        </section>
        <section className={guideFocus === "pipeline" ? "vl-panel aca-guide-on" : "vl-panel"}>
          <header><h2>Superscalar Pipeline Visualization</h2><b>Cycle {shown} / {wide.cycles}</b></header>
          {lanesOn ? (
            <div className="vl-scroll">
              <table className="vl-time">
                <thead><tr><th>Lane</th>{Array.from({ length: shown }, (_, index) => <th key={index} className={index + 1 === shown ? "now" : ""}>{index + 1}</th>)}</tr></thead>
                <tbody>
                  {Array.from({ length: widths.fetch }, (_, lane) => (
                    <tr key={lane}>
                      <td>Lane {lane}</td>
                      {Array.from({ length: shown }, (_, cell) => {
                        const owner = preset.ops.findIndex((_, index) => wide.lanes[index] === lane && wide.cells[index]?.[cell]);
                        const token = owner >= 0 ? wide.cells[owner]?.[cell] : null;
                        const bubble = bubbles && !token && preset.ops.some((_, index) => wide.lanes[index] === lane && (wide.cells[index]?.slice(cell + 1).some(Boolean) ?? false) && (wide.cells[index]?.slice(0, cell).some(Boolean) ?? false));
                        return <td key={cell}>{token ? <span className={`st ${token}`}>{ids && owner >= 0 ? owner + 1 : token}</span> : bubble ? <span className="st STALL">•</span> : ""}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p>Lane view is hidden.</p>}
          <p className="vl-legend"><i className="st IF" /> IF <i className="st ID" /> ID <i className="st DIS" /> DIS <i className="st EX" /> EX <i className="st MEM" /> MEM <i className="st WB" /> WB</p>
          <WidthFlow
            stages={([
              ["Fetch", "fetch", "fetch", "IF"],
              ["Decode", "decode", "decode", "ID"],
              ["Dispatch", "dispatch", "dispatch", "DIS"],
              ["Execute", "execute", "execute", "EX"],
              ["Retire", "commit", "retire", "WB"],
            ] as const).map(([label, icon, key, code]) => ({
              label,
              icon,
              width: widths[key],
              active: preset.ops.filter((_, index) => wide.cells[index]?.[Math.max(0, shown - 1)] === code).length,
            }))}
            bottleneck={bottleneck}
            note={widths.fetch > Math.min(widths.decode, widths.dispatch, widths.execute, widths.retire) ? `Fetch width is ${widths.fetch}. A later stage is narrower, so the extra fetched instructions cannot all retire in the same cycle.` : `Cycle ${shown} places an instruction only in a lane the engine actually used.`}
            speed={play.speed}
            cycle={play.cycle}
          />
        </section>
      </div>
      <div className="vl-split">
        <section className="vl-panel">
          <header><h2>IPC Explorer</h2><b>Current {(retiredNow / Math.max(1, shown)).toFixed(2)}</b></header>
          <svg viewBox="0 0 280 120" role="img" aria-label="IPC versus cycle">
            <polyline fill="none" stroke="#2563eb" strokeWidth="2" points={line(wide.ipcHistory.slice(0, shown), 280, 120, maxIpc)} />
            <polyline fill="none" stroke="#22c55e" strokeWidth="2" points={line(scalar.ipcHistory.slice(0, shown), 280, 120, maxIpc)} />
          </svg>
          <p className="vl-legend"><i className="st IF" /> Superscalar <i className="st WB" /> Scalar</p>
        </section>
        <section className="vl-panel">
          <h2>Simulation Controls</h2>
          <Toggle on={bubbles} label="Show Pipeline Bubbles" onChange={setBubbles} />
          <Toggle on={lanesOn} label="Highlight Active Lanes" onChange={setLanesOn} />
          <Toggle on={ids} label="Show Instruction IDs" onChange={setIds} />
          <Toggle on={autoReset} label="Auto Reset on Completion" onChange={setAutoReset} />
          <Transport playing={play.playing} speed={play.speed} onSpeed={play.setSpeed} onPlay={() => play.setPlaying((value) => !value)} onStep={() => play.setCycle((value) => Math.min(wide.cycles - 1, value + 1))} onBack={() => play.setCycle((value) => Math.max(0, value - 1))} onReset={() => { setGuideFocus(""); play.reset(); }} />
        </section>
      </div>
      <div className="vl-metrics">
        <div><span>Instructions completed</span><strong>{wide.retired}</strong></div>
        <div><span>Total cycles</span><strong>{wide.cycles}</strong></div>
        <div><span>Average IPC</span><strong>{wide.ipc.toFixed(2)}</strong></div>
        <div><span>Speedup vs scalar</span><strong>{speedup.toFixed(2)}x</strong></div>
        <div><span>Fetch utilization</span><strong>{pct(wide.used.fetch, wide.cycles, widths.fetch)}</strong></div>
        <div><span>Execute utilization</span><strong>{pct(wide.used.execute, wide.cycles, widths.execute)}</strong></div>
      </div>
    </LabChrome>
  );
}

function same(left: SuperWidths, right: SuperWidths) {
  return left.fetch === right.fetch && left.decode === right.decode && left.dispatch === right.dispatch && left.execute === right.execute && left.retire === right.retire;
}

function pct(used: number, cycles: number, width: number) {
  return `${Math.round((100 * used) / Math.max(1, cycles * width))}%`;
}
