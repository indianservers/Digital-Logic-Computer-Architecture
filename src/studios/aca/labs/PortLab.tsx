import { useMemo, useState } from "react";
import { LATENCY, PIPELINED, POLICY_LABEL, PORT_PRESETS, PORTS, runPorts, type PortClass, type SchedPolicy } from "../../../engines/aca/ports";
import { LabChrome, Toggle, Transport, usePlayback } from "./HazardLab";

const COLORS = ["#dbeafe", "#dcfce7", "#ede9fe", "#ffedd5", "#fce7f3"];
const MATRIX: Array<{ label: string; kinds: PortClass[] }> = [
  { label: "Integer ALU (ADD, SUB, AND, OR)", kinds: ["int-alu"] },
  { label: "Integer MUL/DIV", kinds: ["int-mul", "int-div"] },
  { label: "Floating point (FADD, FMUL)", kinds: ["fp-add", "fp-mul"] },
  { label: "Load", kinds: ["load"] },
  { label: "Store", kinds: ["store"] },
  { label: "Branch / CSR", kinds: ["branch"] },
];

function supports(port: number, kinds: PortClass[]) {
  return PORTS[port]?.classes.some((kind) => kinds.includes(kind)) ?? false;
}

export function PortLab() {
  const [presetId, setPresetId] = useState(PORT_PRESETS[4]?.id ?? "contend");
  const [policy, setPolicy] = useState<SchedPolicy>("least");
  const [scheduling, setScheduling] = useState(true);
  const [showHeat, setShowHeat] = useState(true);
  const [highlight, setHighlight] = useState(true);
  const [auto, setAuto] = useState(true);
  const preset = PORT_PRESETS.find((item) => item.id === presetId) ?? PORT_PRESETS[0];
  const result = useMemo(() => runPorts(preset?.ops ?? [], { policy, scheduling, issueWidth: 3 }), [preset, policy, scheduling]);
  const play = usePlayback(Math.max(0, result.shots.length - 1));
  if (!preset) return null;
  const shot = result.shots[Math.min(play.cycle, result.shots.length - 1)];
  if (!shot) return null;
  const maxBar = Math.max(1, ...shot.completed);
  const active = shot.rows.find((row) => row.state === "Scheduled");
  return (
    <LabChrome lab="execution-ports" kicker="Labs > Lab 16" title="Lab 16 — Execution Port & Functional Unit Scheduler" subtitle="Explore how execution ports, ALUs, FP units, and load/store units are scheduled and where port contention appears." badge="RISC-V (5-Stage Pipeline)">
      <div className="vl-cards three">
        <article><h2>Learning Objective</h2><p>Understand how instructions map to execution ports and functional units, where contention appears, and how the scheduling policy changes throughput.</p></article>
        <article><h2>Experiment Status</h2><p>{play.cycle === 0 ? "Ready to run" : shot.event}</p><p>{POLICY_LABEL[policy]}. Issue width {scheduling ? 3 : 1}. A pipelined unit can start a new operation every cycle. Divide keeps its port busy for the whole latency.</p></article>
        <article><h2>Ports</h2><p>Several instructions can be ready for the same port. The scheduler only issues an operation onto a port that actually implements that operation.</p></article>
      </div>
      <div className="vl-cards three">
        <article>
          <h2>Execution Ports Overview</h2>
          <p>Instruction dispatch / scheduler</p>
          <div className="vl-ports">
            {PORTS.map((port) => {
              const running = shot.rows.find((row) => row.port === port.id && (row.state === "Scheduled" || row.state === "Executing"));
              return (
                <div key={port.id} style={{ background: COLORS[port.id] }} className={active?.port === port.id ? "on" : ""}>
                  <b>Port {port.id}</b>
                  <span>{port.units}</span>
                  <small>{running ? running.text : "Idle"}</small>
                </div>
              );
            })}
          </div>
          <p>Execution units and writeback. Latency is not the same as throughput.</p>
        </article>
        <article>
          <h2>Functional Units</h2>
          <div className="vl-units">
            <div style={{ background: "#dbeafe" }}><b>Integer ALU</b><span>Ports 0, 1 · {LATENCY["int-alu"]} cycle · {PIPELINED["int-alu"] ? "pipelined" : "blocking"}</span></div>
            <div style={{ background: "#ede9fe" }}><b>Integer multiply</b><span>Port 1 · {LATENCY["int-mul"]} cycles · pipelined</span></div>
            <div style={{ background: "#fce7f3" }}><b>Branch</b><span>Port 4 · {LATENCY.branch} cycle · pipelined</span></div>
            <div style={{ background: "#ffedd5" }}><b>Load / store</b><span>Port 3 · {LATENCY.load} cycles · pipelined</span></div>
            <div style={{ background: "#fee2e2" }}><b>Integer divide</b><span>Port 1 · {LATENCY["int-div"]} cycles · not pipelined</span></div>
            <div style={{ background: "#f3e8ff" }}><b>FP add / mul</b><span>Port 2 · {LATENCY["fp-add"]} / {LATENCY["fp-mul"]} cycles</span></div>
          </div>
        </article>
        <article>
          <h2>Port Mapping Matrix</h2>
          <table>
            <thead><tr><th>Instruction type</th>{PORTS.map((port) => <th key={port.id}>P{port.id}</th>)}</tr></thead>
            <tbody>
              {MATRIX.map((row) => (
                <tr key={row.label}>
                  <td>{row.label}</td>
                  {PORTS.map((port) => <td key={port.id} className={supports(port.id, row.kinds) ? "vl-ok" : ""}>{supports(port.id, row.kinds) ? "✓" : "—"}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      </div>
      <div className="vl-cards three">
        <article>
          <h2>Port Contention Heatmap</h2>
          {showHeat ? (
            <div className="vl-scroll">
              <table>
                <thead><tr><th>Cycle</th>{shot.heat.map((_, index) => <th key={index}>{index + 1}</th>)}</tr></thead>
                <tbody>
                  {PORTS.map((port) => (
                    <tr key={port.id}>
                      <td>P{port.id}</td>
                      {shot.heat.map((levels, index) => <td key={index}><i className={`heat n${levels[port.id] ?? 0}`} /></td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p>Heatmap hidden.</p>}
          <p className="vl-legend"><i className="heat" /> No use <i className="heat n1" /> Low <i className="heat n2" /> Medium <i className="heat n3" /> High</p>
        </article>
        <article>
          <h2>Instruction to Port Assignment</h2>
          <table>
            <thead><tr><th>#</th><th>Instruction</th><th>Compatible</th><th>Port</th><th>State</th><th>Latency</th></tr></thead>
            <tbody>
              {shot.rows.map((row) => (
                <tr key={row.index} className={highlight && row.state === "Ready" && row.port == null ? "on" : ""}>
                  <td>{row.index + 1}</td>
                  <td>{row.text}</td>
                  <td>{row.compatible.map((port) => `P${port}`).join(", ")}</td>
                  <td>{row.port == null ? "—" : `P${row.port}`}</td>
                  <td>{row.state}</td>
                  <td>{row.latency}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>{active ? active.reason : "No instruction is selected this cycle."}</p>
        </article>
        <article>
          <h2>Throughput Analyzer</h2>
          <p>Instructions completed per cycle. Average IPC {result.ipc.toFixed(2)}</p>
          <div className="vl-bars">
            {shot.completed.map((value, index) => (
              <b key={index}><i style={{ height: `${Math.max(4, (value / maxBar) * 78)}px` }} /><span>{index + 1}</span></b>
            ))}
          </div>
        </article>
      </div>
      <div className="vl-cards three">
        <article>
          <h2>Simulation Controls</h2>
          <Toggle on={scheduling} label="Enable Port Scheduling" onChange={(next) => { setScheduling(next); play.reset(); }} />
          <Toggle on={showHeat} label="Show Port Contention" onChange={setShowHeat} />
          <Toggle on={highlight} label="Highlight Stalls" onChange={setHighlight} />
          <Toggle on={auto} label="Auto Advance" onChange={setAuto} />
          <label>Scheduling policy
            <select aria-label="Scheduling policy" value={policy} onChange={(event) => { setPolicy(event.target.value as SchedPolicy); play.reset(); }}>
              {(Object.keys(POLICY_LABEL) as SchedPolicy[]).map((item) => <option key={item} value={item}>{POLICY_LABEL[item]}</option>)}
            </select>
          </label>
          <select aria-label="Load example" value={preset.id} onChange={(event) => { const next = PORT_PRESETS.find((item) => item.id === event.target.value); setPresetId(event.target.value); if (next) setPolicy(next.policy); play.reset(); }}>
            {PORT_PRESETS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </article>
        <article>
          <Transport playing={play.playing} onPlay={() => { if (!auto) { play.setCycle((value) => Math.min(result.shots.length - 1, value + 1)); return; } play.setPlaying((value) => !value); }} onStep={() => play.setCycle((value) => Math.min(result.shots.length - 1, value + 1))} onBack={() => play.setCycle((value) => Math.max(0, value - 1))} onReset={play.reset} speed={play.speed} onSpeed={play.setSpeed} />
        </article>
        <article>
          <h2>Results & Insights</h2>
          <div className="vl-metrics">
            <div><strong>{result.ipc.toFixed(2)}</strong><span>Throughput (IPC)</span></div>
            <div><strong>{Math.round(result.utilization * 100)}%</strong><span>Port utilization</span></div>
            <div><strong>{result.bottleneck}</strong><span>Bottleneck</span></div>
          </div>
          <p>Busy cycles {result.busy.map((value, index) => `P${index} ${value}`).join(", ")}. Idle cycles {result.idle.map((value, index) => `P${index} ${value}`).join(", ")}. Dependency stalls {shot.depStalls}. Port stalls {shot.portStalls}.</p>
          <p>First available prefers the highest-index legal port, so an ADD can sit on the multiply port and make a MUL wait. Least contended leaves that port for the MUL. Oldest ready does not pass an older ready instruction that is stuck.</p>
        </article>
      </div>
    </LabChrome>
  );
}
