import { useSimulatorCapture } from "../../../../layout/SimulatorCapture";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CORE_LAB_GROUPS, LAB_META, labByNumber, labPath, type LabMeta } from "../registry";
import { Metric, Panel } from "../ui/Panels";
import { Scope } from "../ui/Scope";
import { modelByNumber } from "./models";
import { hex, sanitizeParams, type Model, type Params, type Simulation } from "./model";
import "./advanced.css";

const colors = ["#2776ea", "#13a375", "#e59521"];
function download(name: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const link = document.createElement("a"); link.href = url; link.download = name; document.body.append(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function savedSettings(meta: LabMeta, model: Model) {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem("mcu.advanced." + meta.slug) ?? "null");
    const value = raw && typeof raw === "object" ? raw as { params?: unknown; source?: unknown } : {};
    return { params: sanitizeParams(model, value.params), source: typeof value.source === "string" ? value.source.slice(0, 20000) : model.source ?? "" };
  } catch { return { params: { ...model.defaults }, source: model.source ?? "" }; }
}

export default function AdvancedLab({ meta }: { meta: LabMeta }) {
  const model = modelByNumber(meta.n);
  return model ? <Workbench key={meta.slug} meta={meta} model={model} /> : <p>Lab configuration missing.</p>;
}

export function AdvancedNavigation({ meta }: { meta: LabMeta }) {
  return <aside className="mca-nav"><Link className="mca-brand" to="/studios/microcontroller"><span>µC</span><strong>Microcontroller<br />Studio</strong></Link><Link to="/studios/microcontroller">← Lab directory</Link>
    <p>FIRMWARE & SYSTEMS</p><nav aria-label="Microcontroller lab navigation">{LAB_META.filter((lab) => lab.n >= 39).map((lab) => <Link key={lab.n} aria-current={lab.n === meta.n ? "page" : undefined} to={labPath(lab)}><span>{lab.n}</span>{lab.title}</Link>)}</nav>
    <details><summary>Earlier core labs</summary>{CORE_LAB_GROUPS.filter((group) => group.first < 39).map((group) => { const lab = labByNumber(group.first); return lab ? <Link key={group.id} to={labPath(lab)}>Labs {group.first}–{group.last}</Link> : null; })}</details>
  </aside>;
}

function Workbench({ meta, model }: { meta: LabMeta; model: Model }) {
  useSimulatorCapture("studios/microcontroller/labs/advanced/AdvancedLab.tsx:Workbench", () => ({ initial, params, source, builtSource, simulation, state: state.current, paramRef: paramRef.current, running, speed, tab }), "f42657dd63f2");

  const [initial] = useState(() => savedSettings(meta, model));
  const [params, setParams] = useState(initial.params);
  const [source, setSource] = useState(initial.source);
  const [builtSource, setBuiltSource] = useState(initial.source);
  const [simulation, setSimulation] = useState(() => model.create(initial.params, initial.source));
  const state = useRef(simulation), paramRef = useRef(params);
  const [running, setRunning] = useState(false), [speed, setSpeed] = useState(5), [tab, setTab] = useState("workbench");
  const [checked, setChecked] = useState(false), [notice, setNotice] = useState("");
  const prev = labByNumber(meta.n - 1), next = labByNumber(meta.n + 1);
  function commit(value: Simulation) { state.current = value; setSimulation(value); if (value.finished) setRunning(false); }
  function advance(count = 1) {
    let value = state.current;
    if (model.number === 51 && count === 1 && model.action) value = model.action(value, paramRef.current, "step");
    else for (let i = 0; i < count && !value.finished; i++) value = model.step(value, paramRef.current, model.stepMs);
    commit(value);
  }
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      let value = state.current;
      for (let i = 0; i < speed && !value.finished; i++) value = model.step(value, paramRef.current, model.stepMs);
      state.current = value; setSimulation(value); if (value.finished) setRunning(false);
    }, 40);
    return () => window.clearInterval(timer);
  }, [running, speed, model]);
  function reset(nextParams = params, code = builtSource) { setRunning(false); setChecked(false); commit(model.create(nextParams, code)); }
  function change(key: string, value: number | string | boolean) {
    const nextParams = sanitizeParams(model, { ...paramRef.current, [key]: value });
    paramRef.current = nextParams; setParams(nextParams);
    if (model.controls.find((control) => control.key === key)?.live) setNotice(meta.n === 50 ? "Next image settings changed. Begin a new update to use them." : "Live input changed. Step or run to observe the response.");
    else { reset(nextParams); setNotice("Configuration changed; simulation reset for a comparable run."); }
  }
  function preset(patch: Params) { const nextParams = sanitizeParams(model, { ...model.defaults, ...patch }); paramRef.current = nextParams; setParams(nextParams); reset(nextParams); setNotice("Preset loaded. Run to collect evidence."); }
  function action(id: string) { if (model.action) { setRunning(false); commit(model.action(state.current, params, id)); } }
  function run() { if (state.current.finished && model.number === 51 && model.action) commit(model.action(state.current, params, "resume")); if (!state.current.finished) setRunning((value) => !value); }
  function save() { try { localStorage.setItem("mcu.advanced." + meta.slug, JSON.stringify({ params, source })); setNotice("Configuration and source saved on this device."); } catch { setNotice("Local save unavailable. Export your experiment to retain it."); } }
  const readings = model.metrics(simulation, params), checks = model.checks(simulation, params), span = simulation.samples.length > 1 ? (simulation.samples.at(-1)!.t - simulation.samples[0]!.t) / 1000 : model.stepMs * 100 / 1000;
  const vertical = meta.n === 53 ? { min: Math.min(-1, ...simulation.samples.flatMap((point) => point.channels)), max: Math.max(5, ...simulation.samples.flatMap((point) => point.channels)) } : undefined;
  const traces = model.plots.map((plot, index) => ({ label: plot.label, color: colors[index % colors.length]!, min: vertical?.min ?? plot.min, max: vertical?.max ?? plot.max, unit: plot.unit, points: simulation.samples.map((point) => [point.t / 1000, point.channels[index] ?? 0] as [number, number]) }));
  const cursors = meta.n === 53 ? [simulation.samples[Number(params.cursorA)], simulation.samples[Number(params.cursorB)]].flatMap((point) => point ? [point.t / 1000] : []) : undefined;
  return <div className="mcl-root mcl-pro mca-root"><AdvancedNavigation meta={meta} /><main className="mca-main">
    <header className="mca-heading"><div><span className="mca-eyebrow">CORE LAB {meta.n} · LIVE SIMULATOR</span><h1>{meta.title}</h1><p>{model.subtitle}</p></div><div className="mca-neighbors">{prev && <Link to={labPath(prev)}>← {prev.n}</Link>}{next && <Link to={labPath(next)}>{next.n} →</Link>}</div></header>
    <div className="mca-tabs" role="group" aria-label="Lab view">{[["workbench", "Experiment workbench"], ["guide", "Guide & model"]].map(([id, label]) => <button key={id} type="button" aria-pressed={tab === id} onClick={() => setTab(id!)}>{label}</button>)}</div>
    <div className="mca-toolbar" role="group" aria-label="Simulator controls">
      <button type="button" className="mca-primary" onClick={run} disabled={simulation.finished && meta.n !== 51}>{running ? "Pause" : "Run"}</button>
      <button type="button" onClick={() => advance()} disabled={running || (simulation.finished && meta.n !== 51)}>Step {meta.n === 51 ? "instruction" : model.stepMs + " ms"}</button>
      <button type="button" onClick={() => advance(100)} disabled={running || (simulation.finished && meta.n !== 51)}>Advance 100 steps</button>
      <button type="button" onClick={() => reset()}>Reset simulation</button>
      <label>Steps/frame <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>{[1, 5, 20].map((n) => <option key={n}>{n}</option>)}</select></label>
      <span className={"mca-status " + (running ? "running" : "")}>{running ? "Running" : simulation.finished ? "Stopped" : "Paused"} · {simulation.time.toFixed(meta.n >= 52 && meta.n <= 53 ? 3 : 0)} ms</span>
    </div>
    {notice && <p className="mca-notice" role="status">{notice}</p>}
    <p className="mca-objective"><strong>Objective</strong> {model.objective}</p>
    {tab === "workbench" ? <>
      <div className="mca-metrics">{readings.map((reading) => <Metric key={reading.label} label={reading.label} value={reading.value} unit={reading.unit} />)}</div>
      <div className="mca-grid"><div className="mca-results">
        <Panel title="Live signals & measurements" tools={<span className="mca-phase">{simulation.phase}</span>}>
          <Scope traces={traces} now={simulation.samples.at(-1)?.t ? simulation.samples.at(-1)!.t / 1000 : simulation.time / 1000} window={Math.max(span, model.stepMs / 1000)} height={240} theme="light" lanes={meta.n !== 53 && meta.n !== 54} cursors={cursors} thresholds={meta.n === 53 ? [{ value: 0, color: "#bd774a", trace: 1 }, { value: 3.3, color: "#bd774a", trace: 1 }] : undefined} ariaLabel={meta.title + " measured signal traces"} />
          <p className="mca-caption">Signals are generated by the current simulation. Horizontal axis: time. {vertical ? "Both channels share " + vertical.min.toFixed(1) + " to " + vertical.max.toFixed(1) + " V. Dashed rails mark 0 / 3.3 V; cursor positions come from the acquisition panel." : "Read the channel labels and units before comparing traces."}</p>
        </Panel>
        {!!simulation.memory.length && <Panel title={meta.n === 51 ? "CPU register file" : meta.n === 50 ? "Flash banks A / B · byte addresses" : "Acquisition / memory buffer"}>
          <div className="mca-memory">{simulation.memory.slice(0, meta.n === 52 || meta.n === 53 ? 64 : 128).map((value, index) => <div key={index}><small>{meta.n === 51 ? "R" + index : hex(index)}</small><strong>{hex(value, meta.n === 51 ? 8 : value > 255 ? 4 : 2)}</strong></div>)}</div>
          {(meta.n === 52 || meta.n === 53) && <p className="mca-caption">First 64 captured values shown; the full acquisition is included in the exported experiment.</p>}
        </Panel>}
        {!!simulation.jobs.length && <Panel title="Ready / running job queue"><div className="mca-table"><table><thead><tr><th>Task</th><th>Released</th><th>Deadline</th><th>Remaining</th><th>State</th></tr></thead><tbody>{simulation.jobs.slice(0, 12).map((job) => <tr key={job.id}><td>T{job.task + 1}</td><td>{job.released} ms</td><td>{job.deadline} ms</td><td>{job.remaining} ms</td><td>{job.missed ? "Deadline missed" : simulation.values.running === job.id ? "Running" : "Ready"}</td></tr>)}</tbody></table></div></Panel>}
        {model.source && <Panel title="Editable C & executed disassembly"><label className="mca-source-label">Firmware source<textarea spellCheck={false} aria-label="Debugger C source" value={source} onChange={(e) => setSource(e.target.value)} maxLength={20000} /></label><button type="button" onClick={() => { setBuiltSource(source); reset(params, source); setNotice("Source compiled. Inspect compile diagnostics in the trace if the build failed."); }}>Build & reset</button>{source !== builtSource && <span className="mca-dirty">Unbuilt source changes</span>}
          {simulation.cpu && <div className="mca-disassembly"><table><thead><tr><th>Break</th><th>PC</th><th>Instruction</th><th>Source</th></tr></thead><tbody>{simulation.cpu.prog.ins.map((instruction) => <tr key={instruction.addr} className={instruction.addr === simulation.cpu!.r[15] ? "current" : ""}><td><button type="button" aria-label={"Breakpoint source line " + instruction.line} onClick={() => change("breakpoint", instruction.line)}>{params.breakEnabled && params.breakpoint === instruction.line ? "●" : "○"}</button></td><td>{hex(instruction.addr, 8)}</td><td>{instruction.text}</td><td>{instruction.line}</td></tr>)}</tbody></table></div>}
        </Panel>}
      </div><aside className="mca-controls">
        <Panel title="Inputs & fault injection">{model.controls.map((control) => <label key={control.key} className={"mca-control " + (control.type === "toggle" ? "mca-toggle" : "")}>
          <span>{control.label}{control.live && <small>LIVE</small>}</span>
          {control.type === "toggle" ? <input type="checkbox" checked={params[control.key] === true} onChange={(e) => change(control.key, e.target.checked)} /> : control.type === "select" ? <select value={String(params[control.key])} onChange={(e) => change(control.key, e.target.value)}>{control.options?.map((option) => <option key={option}>{option}</option>)}</select> : <><div><input aria-label={control.label + " value"} type="number" value={Number(params[control.key])} min={control.min} max={control.max} step={control.step} onChange={(e) => { if (e.target.value !== "") change(control.key, Number(e.target.value)); }} /><b>{control.unit}</b></div><input aria-label={control.label + " slider"} type="range" value={Number(params[control.key])} min={control.min} max={control.max} step={control.step} onChange={(e) => change(control.key, Number(e.target.value))} /></>}
        </label>)}<p className="mca-caption">Configuration changes reset the simulation. LIVE inputs apply on the next step.</p></Panel>
        <Panel title="Experiment presets"><div className="mca-preset-list">{model.presets.map((item) => <button type="button" key={item.label} onClick={() => preset(item.params)}>{item.label} →</button>)}</div>{model.actions?.map((item) => <button className="mca-action" type="button" key={item.id} onClick={() => action(item.id)}>{item.label}</button>)}</Panel>
        <Panel title="Verify the experiment"><p className="mca-caption">Checks use current simulated state and recorded events.</p><button className="mca-primary" type="button" onClick={() => setChecked(true)}>Check current result</button>{checked && <ul className="mca-checks" role="status">{checks.map((item) => <li className={item.passed ? "pass" : ""} key={item.label}><strong>{item.passed ? "✓ " : "○ "}{item.label}</strong><small>{item.why}</small></li>)}</ul>}</Panel>
      </aside></div>
      <Panel title="Operation trace" tools={<span>Latest 100 events</span>}><div className="mca-table"><table><thead><tr><th>Time (ms)</th><th>Event</th><th>State change</th></tr></thead><tbody>{simulation.events.length ? simulation.events.slice().reverse().map((entry, index) => <tr key={index}><td>{entry.t.toFixed(3)}</td><td>{entry.event}</td><td>{entry.detail}</td></tr>) : <tr><td colSpan={3}>No events yet. Step or run the simulator.</td></tr>}</tbody></table></div></Panel>
      <details className="mca-inspector"><summary>Inspect model registers</summary><div className="mca-memory">{Object.entries(simulation.values).map(([key, value]) => <div key={key}><small>{key}</small><strong>{Number.isInteger(value) ? value : value.toFixed(4)}</strong></div>)}</div></details>
    </> : <div className="mca-guide-grid"><Panel title="Guided experiment"><ol>{model.guide.map((step) => <li key={step}>{step}</li>)}</ol><h3>Expected observations</h3><p>{model.expected}</p></Panel><Panel title="Model, equation & limits"><code>{model.equation}</code><p>{model.limitation}</p><h3>Evidence to collect</h3><p>Record a baseline, change one input or fault, then compare measurements and event traces. Export the result to retain the full acquisition.</p></Panel></div>}
    <footer className="mca-footer"><button type="button" onClick={save}>Save configuration</button><button type="button" onClick={() => download(meta.slug + "-experiment.json", { lab: meta.title, number: meta.n, params, source: builtSource || undefined, timeMs: simulation.time, state: simulation.values, memory: simulation.memory, events: simulation.events, samples: simulation.samples, measurements: readings, checks, limitation: model.limitation })}>Export experiment</button><Link to="/studios/microcontroller">Back to all labs →</Link></footer>
  </main></div>;
}
