import { useState } from "react";
import { VlsiGrid } from "../shell";
import { Badge, Choice, Measure, Observe, PlayControls, Slider, useTicker } from "../widgets";
import { analyzeSta, combinationalPaths, criticalPath, explorerPath, worstPaths, type PathKind } from "../timingModel";

function ns(value: number): string {
  return `${value.toFixed(3)} ns`;
}

export function CombinationalTimingLab() {
  const [scale, setScale] = useState(1);
  const [net, setNet] = useState(1);
  const [fanout, setFanout] = useState(1);
  const [vector, setVector] = useState<"both" | "A" | "B">("both");
  const [gate, setGate] = useState<"nor" | "nand" | "inv">("nor");
  const [playing, setPlaying] = useState(true);
  const [cursor, setCursor] = useState(0);
  const paths = combinationalPaths({ gateScale: scale, netScale: net, fanout, slowGate: gate });
  const visible = paths.filter((path) => vector === "both" || path.name.startsWith(vector));
  const ends = criticalPath(visible.length > 0 ? visible : paths);
  useTicker(playing, () => setCursor((value) => (value + 1) % 24), 280);
  return (
    <>
      <VlsiGrid
        stage={
          <div className="vlsi-stage">
            <div className="vlsi-stage-head">
              <h2>Paths to Y</h2>
              <Badge tone="warn">Critical {ends.slow.id}</Badge>
            </div>
            <svg className="vlsi-schematic" viewBox="0 0 420 230" role="img" aria-label="Combinational paths with the critical path highlighted">
              {paths.map((path, index) => {
                const y = 40 + index * 64;
                const hot = path.id === ends.slow.id;
                const depth = Math.min(path.depth, Math.floor(cursor / 4) + 1);
                return (
                  <g key={path.id}>
                    <text x="8" y={y + 4} className="vlsi-svg-label">{path.name}</text>
                    {path.gates.map((cell, gateIndex) => (
                      <rect key={cell} x={150 + gateIndex * 70} y={y - 16} width="58" height="32" rx="6" className={hot && gateIndex < depth ? "vlsi-gate crit" : "vlsi-gate"} />
                    ))}
                  </g>
                );
              })}
            </svg>
            <p className="vlsi-callout">Critical path delay {ns(ends.slow.delay)}. Fastest path {ends.fast.name} at {ns(ends.fast.delay)}. Launch vector {vector}.</p>
          </div>
        }
        controls={
          <>
            <PlayControls playing={playing} onToggle={() => setPlaying((value) => !value)} onStep={() => setCursor((value) => (value + 1) % 24)} />
            <Choice label="Launch input" value={vector} options={[{ id: "both", label: "A and B" }, { id: "A", label: "A only" }, { id: "B", label: "B only" }]} onChange={setVector} />
            <Choice label="First gate on the long path" value={gate} options={[{ id: "nor", label: "NOR" }, { id: "nand", label: "NAND" }, { id: "inv", label: "INV" }]} onChange={setGate} />
            <Slider label="Gate delay scale" value={scale} min={0.5} max={2.5} step={0.1} text={`${scale.toFixed(1)}×`} onChange={setScale} />
            <Slider label="Net delay scale" value={net} min={0.2} max={3} step={0.1} text={`${net.toFixed(1)}×`} onChange={setNet} />
            <Slider label="Fan-out" value={fanout} min={1} max={8} step={1} text={String(fanout)} onChange={setFanout} />
          </>
        }
        readouts={
          <>
            {paths.map((path) => (
              <Measure key={path.id} label={path.name} value={ns(path.delay)} hint={path.id === ends.slow.id ? `Critical · depth ${path.depth}` : `Depth ${path.depth}`} />
            ))}
          </>
        }
        footer={
          <Observe
            change="Replace the NOR with an inverter, or launch only B."
            see="The highlighted path moves when another route becomes the longest active one."
            why="Each path delay is the sum of its gate delays and net delays. The critical path is the maximum."
            experiment="Raise fan-out and watch every path slow, with nets taking a larger share."
            takeaway="A schematic has many delays. The clock only has to survive the slowest sensitized path."
          />
        }
      />
    </>
  );
}

export function StaticTimingLab() {
  const [period, setPeriod] = useState(1);
  const [uncertainty, setUncertainty] = useState(0.05);
  const [cell, setCell] = useState(1);
  const [net, setNet] = useState(1);
  const [analysis, setAnalysis] = useState<"setup" | "hold">("setup");
  const [view, setView] = useState<"path" | "diagram" | "report">("report");
  const result = analyzeSta({ period, uncertainty, cellScale: cell, netScale: net, analysis });
  const worst = worstPaths({ period, uncertainty, cellScale: cell, netScale: net });
  return (
    <>
      <VlsiGrid
        stage={
          <div className="vlsi-stage">
            <div className="vlsi-stage-head">
              <h2>{view === "path" ? "Timing path" : view === "diagram" ? "Timing diagram" : "Path report"}</h2>
              <Badge tone={result.pass ? "on" : "bad"}>{result.pass ? "PASS" : "FAIL"}</Badge>
            </div>
            {view === "report" ? (
              <table className="vlsi-truth">
                <thead><tr><th>Point</th><th>Kind</th><th>Inc</th><th>Arrival</th><th>Required</th><th>Slack</th></tr></thead>
                <tbody>
                  {result.points.map((point) => (
                    <tr key={point.id} className={point.slack < 0 ? "on" : ""}>
                      <td>{point.name}</td>
                      <td>{point.kind}</td>
                      <td>{ns(point.incremental)}</td>
                      <td>{ns(point.arrival)}</td>
                      <td>{ns(point.required)}</td>
                      <td>{ns(point.slack)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <svg className="vlsi-schematic" viewBox="0 0 460 200" role="img" aria-label="Launch flip-flop, combinational logic, and capture flip-flop">
                <rect x="16" y="70" width="70" height="48" rx="8" className="vlsi-gate crit" />
                <text x="51" y="98" textAnchor="middle" className="vlsi-svg-label">Launch</text>
                {result.points.filter((point) => point.kind === "cell" && point.id !== "ckq" && point.id !== "cap").map((point, index) => (
                  <g key={point.id}>
                    <rect x={140 + index * 80} y="74" width="64" height="40" rx="6" className={point.slack < 0 ? "vlsi-gate crit" : "vlsi-gate on"} />
                    <text x={172 + index * 80} y="98" textAnchor="middle" className="vlsi-svg-label">{point.name}</text>
                    <text x={172 + index * 80} y="128" textAnchor="middle" className="vlsi-svg-label">{ns(point.incremental)}</text>
                  </g>
                ))}
                <rect x="370" y="70" width="74" height="48" rx="8" className={result.pass ? "vlsi-gate on" : "vlsi-gate crit"} />
                <text x="407" y="98" textAnchor="middle" className="vlsi-svg-label">Capture</text>
                <text x="230" y="160" textAnchor="middle" className="vlsi-svg-label">
                  {view === "diagram" ? `Data arrives ${ns(result.arrival)} · required ${ns(result.required)}` : `Slack ${ns(result.slack)}`}
                </text>
              </svg>
            )}
          </div>
        }
        controls={
          <>
            <Choice label="View" value={view} options={[{ id: "path", label: "Timing path" }, { id: "diagram", label: "Timing diagram" }, { id: "report", label: "Path report" }]} onChange={setView} />
            <Choice label="Analysis" value={analysis} options={[{ id: "setup", label: "Setup" }, { id: "hold", label: "Hold" }]} onChange={setAnalysis} />
            <Slider label="Clock period" value={period} min={0.3} max={2} step={0.05} text={ns(period)} onChange={setPeriod} />
            <Slider label="Clock uncertainty" value={uncertainty} min={0} max={0.2} step={0.01} text={ns(uncertainty)} onChange={setUncertainty} />
            <Slider label="Cell delay scale" value={cell} min={0.5} max={2} step={0.05} text={`${cell.toFixed(2)}×`} onChange={setCell} />
            <Slider label="Net delay scale" value={net} min={0.4} max={2.5} step={0.05} text={`${net.toFixed(2)}×`} onChange={setNet} />
          </>
        }
        readouts={
          <>
            <Measure label="Arrival" value={ns(result.arrival)} />
            <Measure label="Required" value={ns(result.required)} />
            <Measure label="Slack" value={ns(result.slack)} hint={result.pass ? "slack ≥ 0" : "slack < 0"} />
            <h3>Worst paths</h3>
            {worst.map((path) => <Measure key={path.name} label={path.name} value={ns(path.slack)} hint={path.pass ? "PASS" : "FAIL"} />)}
          </>
        }
        footer={
          <Observe
            change="Shorten the clock, then switch the report to hold."
            see="Setup slack falls through zero. Hold uses the fast delay and a different required time."
            why="Setup slack is required time minus arrival. Required time is the period minus uncertainty and the library setup check."
            experiment="Scale only the nets and watch incremental net rows move without editing the table by hand."
            takeaway="A path fails when data is later than the capture edge allows, or earlier than hold allows."
          />
        }
      />
    </>
  );
}

export function TimingPathLab() {
  const [kind, setKind] = useState<PathKind>("setup");
  const [cell, setCell] = useState(1);
  const [net, setNet] = useState(1);
  const [period, setPeriod] = useState(1);
  const [selected, setSelected] = useState("nand");
  const [playing, setPlaying] = useState(true);
  const [step, setStep] = useState(0);
  const result = explorerPath(kind, cell, net, period);
  const point = result.points.find((item) => item.id === selected) ?? result.points[0];
  useTicker(playing, () => setStep((value) => (value + 1) % (result.points.length + 1)), 420);
  return (
    <>
      <VlsiGrid
        stage={
          <div className="vlsi-stage">
            <div className="vlsi-stage-head">
              <h2>Launch to capture</h2>
              <Badge tone="info">{kind}</Badge>
            </div>
            <div className="vlsi-path-row" role="list">
              {result.points.map((item, index) => (
                <button key={item.id} type="button" className={item.id === point?.id ? "on" : ""} aria-pressed={item.id === point?.id} onClick={() => setSelected(item.id)}>
                  <b>{item.name}</b>
                  <span>{item.kind}</span>
                  {index <= step ? <i /> : null}
                </button>
              ))}
            </div>
            <p className="vlsi-callout">{result.label}. The moving mark is the transition. Select a gate, net, or endpoint.</p>
          </div>
        }
        controls={
          <>
            <PlayControls playing={playing} onToggle={() => setPlaying((value) => !value)} onStep={() => setStep((value) => (value + 1) % (result.points.length + 1))} />
            <Choice label="Path" value={kind} options={[
              { id: "setup", label: "Setup path" },
              { id: "hold", label: "Hold path" },
              { id: "in2reg", label: "Input to register" },
              { id: "reg2out", label: "Register to output" },
            ]} onChange={setKind} />
            <Slider label="Clock period" value={period} min={0.4} max={2} step={0.05} text={ns(period)} onChange={setPeriod} />
            <Slider label="Cell scale" value={cell} min={0.5} max={2} step={0.05} text={`${cell.toFixed(2)}×`} onChange={setCell} />
            <Slider label="Net scale" value={net} min={0.4} max={2.5} step={0.05} text={`${net.toFixed(2)}×`} onChange={setNet} />
          </>
        }
        readouts={
          point ? (
            <>
              <Measure label="Selected" value={point.name} />
              <Measure label="Incremental delay" value={ns(point.incremental)} />
              <Measure label="Arrival" value={ns(point.arrival)} />
              <Measure label="Required" value={ns(point.required)} />
              <Measure label="Slack" value={ns(point.slack)} />
              <Measure label="Fan-out" value={point.kind === "net" ? "2" : "1"} hint="Educational load on this hop" />
              <Measure label="Load" value={point.kind === "net" ? `${(12 * net).toFixed(1)} fF` : "Pin cap"} />
              <Measure label="Endpoint slack" value={ns(result.slack)} hint={result.pass ? "PASS" : "FAIL"} />
            </>
          ) : null
        }
        footer={
          <Observe
            change="Click a net, then switch from the setup path to the hold path."
            see="The same nodes show a smaller incremental delay and a slack that uses the hold check."
            why="This view walks one path. The report lab lists the whole path at once."
            experiment="Slow the cells until the selected node’s slack changes sign."
            takeaway="Slack belongs to a point on a path, not only to the final pin."
          />
        }
      />
    </>
  );
}
