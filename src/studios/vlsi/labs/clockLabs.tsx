import { useMemo, useState } from "react";
import { VlsiGrid } from "../shell";
import { Badge, Chart, Choice, Measure, Observe, PlayControls, Slider, Theory, Wave, useTicker } from "../widgets";
import { clockSinkArrivals, clockTree, metastableLevel, metastableState, sampleFlipFlop, skewOf } from "../timingModel";

function ns(value: number): string {
  return `${value.toFixed(2)} ns`;
}

export function SetupHoldLab() {
  const edge = 20;
  const [change, setChange] = useState(12);
  const [tSetup, setTSetup] = useState(5);
  const [tHold, setTHold] = useState(4);
  const [before, setBefore] = useState<0 | 1>(0);
  const report = sampleFlipFlop(change, edge, tSetup, tHold, before);
  const clk = Array.from({ length: 40 }, (_, index) => (index >= 10 && index < 30 ? 1 : 0));
  const data = Array.from({ length: 40 }, (_, index) => (index < change ? before : before === 0 ? 1 : 0));
  const qLevel = report.captured === "X" ? 0.5 : report.captured === "1" ? 1 : 0;
  const q = Array.from({ length: 40 }, (_, index) => (index < edge ? 0 : qLevel));
  return (
    <>
      <VlsiGrid
        stage={
          <div className="vlsi-stage">
            <div className="vlsi-stage-head">
              <h2>Capture window</h2>
              <Badge tone={report.violated ? "bad" : "on"}>{report.violated ? "Violation" : "Pass"}</Badge>
            </div>
            <Wave traces={[
              { name: "CLK", color: "#fbbf24", values: clk, min: 0, max: 1 },
              { name: "D", color: "#38bdf8", values: data, min: 0, max: 1 },
              { name: "Q", color: "#34d399", values: q, min: 0, max: 1 },
            ]} />
            <p className="vlsi-callout">Sampling edge at {edge} ns. Setup window {ns(edge - tSetup)} to {ns(edge)}. Hold window {ns(edge)} to {ns(edge + tHold)}. The data transition is at {ns(change)}.</p>
          </div>
        }
        controls={
          <>
            <Slider label="Data transition" value={change} min={0} max={39} step={1} text={ns(change)} onChange={setChange} />
            <Slider label="Setup requirement" value={tSetup} min={1} max={10} step={1} text={ns(tSetup)} onChange={setTSetup} />
            <Slider label="Hold requirement" value={tHold} min={1} max={8} step={1} text={ns(tHold)} onChange={setTHold} />
            <Choice label="Level before the transition" value={before === 0 ? "0" : "1"} options={[{ id: "0", label: "D was 0" }, { id: "1", label: "D was 1" }]} onChange={(value) => setBefore(value === "1" ? 1 : 0)} />
          </>
        }
        readouts={
          <>
            <Measure label="tsetup" value={ns(report.tSetup)} />
            <Measure label="thold" value={ns(report.tHold)} />
            <Measure label="Data arrival" value={ns(report.dataArrival)} />
            <Measure label="Clock edge" value={ns(report.clockEdge)} />
            <Measure label="Slack to setup boundary" value={ns(report.setupSlack)} hint={report.setupViolated ? "Inside the setup window" : "Outside the setup window"} />
            <Measure label="Slack to hold boundary" value={ns(report.holdSlack)} hint={report.holdViolated ? "Inside the hold window" : "Outside the hold window"} />
            <p>{report.reason}</p>
          </>
        }
        footer={
          <Observe
            change="Move D into the window before the edge, then just after it."
            see="Q stays a legal level outside the window and sits at mid-level when capture is uncertain."
            why="The flip-flop samples only while the latch is resolving. This uses the same setup and hold checks as the Timing studio."
            experiment="Widen tsetup until a transition that used to pass becomes a violation."
            takeaway="Positive slack to a boundary means the transition is outside that forbidden window."
          />
        }
      />
    </>
  );
}

export function MetastabilityLab() {
  const edge = 20;
  const [change, setChange] = useState(19);
  const [tSetup, setTSetup] = useState(3);
  const [tHold, setTHold] = useState(2);
  const [tau, setTau] = useState(4);
  const [disturbance, setDisturbance] = useState(0.2);
  const [playing, setPlaying] = useState(true);
  const [time, setTime] = useState(0);
  const state = metastableState(change, edge, tSetup, tHold, disturbance);
  useTicker(playing, () => setTime((value) => (value + 1) % 40), 80);
  const samples = useMemo(() => Array.from({ length: 40 }, (_, index) => metastableLevel(index, edge, tau, state)), [edge, tau, state]);
  const shown = playing ? time : 28;
  const level = samples[shown] ?? 0;
  return (
    <>
      <VlsiGrid
        stage={
          <div className="vlsi-stage">
            <div className="vlsi-stage-head">
              <h2>Resolution</h2>
              <Badge tone={state.safe ? "on" : state.resolvesTo === null ? "bad" : "warn"}>{state.safe ? "Safe sample" : state.resolvesTo === null ? "Unresolved" : `Resolves to ${state.resolvesTo}`}</Badge>
            </div>
            <Chart
              ariaLabel="Metastable Q resolving after the clock edge"
              xMin={0}
              xMax={39}
              yMax={1}
              xLabel="Time (ns)"
              yLabel="Level"
              series={[
                { name: "CLK", color: "#fbbf24", points: Array.from({ length: 40 }, (_, x) => ({ x, y: x >= 10 && x < 30 ? 1 : 0 })) },
                { name: "D", color: "#38bdf8", points: Array.from({ length: 40 }, (_, x) => ({ x, y: x < change ? 0 : 1 })) },
                { name: "Q", color: "#34d399", points: samples.map((y, x) => ({ x, y })) },
              ]}
              marker={{ x: shown, y: level, label: level.toFixed(2) }}
            />
            <p className="vlsi-callout">{state.note} Metastability cannot be removed. A synchronizer and enough resolution time make the failure rare. This disturbance is educational, not a random MTBF trial.</p>
          </div>
        }
        controls={
          <>
            <PlayControls playing={playing} onToggle={() => setPlaying((value) => !value)} onStep={() => setTime((value) => (value + 1) % 40)} />
            <Slider label="Data transition offset" value={change} min={10} max={28} step={1} text={`${change - edge} ns from the edge`} onChange={setChange} />
            <Slider label="Setup window" value={tSetup} min={1} max={8} step={1} text={ns(tSetup)} onChange={setTSetup} />
            <Slider label="Hold window" value={tHold} min={1} max={6} step={1} text={ns(tHold)} onChange={setTHold} />
            <Slider label="Resolution time constant" value={tau} min={1} max={12} step={1} text={ns(tau)} onChange={setTau} />
            <Slider label="Educational disturbance" value={disturbance} min={-1} max={1} step={0.05} text={disturbance.toFixed(2)} onChange={setDisturbance} />
          </>
        }
        readouts={
          <>
            <Measure label="Sampling" value={state.safe ? "Safe" : "Unsafe"} />
            <Measure label="Internal state" value={state.metastable ? "Metastable" : "Legal"} />
            <Measure label="Resolved Q" value={state.resolvesTo === null ? "Unresolved" : String(state.resolvesTo)} />
            <Measure label="Q at cursor" value={level.toFixed(2)} />
            <Theory title="What the disturbance means">
              <p>Zero keeps the latch balanced. A positive value regenerates toward 1, a negative value toward 0. Changing it is the “vary disturbance” control.</p>
            </Theory>
          </>
        }
        footer={
          <Observe
            change="Put the data edge on the clock edge, then move the disturbance through zero."
            see="Q leaves 0, hangs near one half, then climbs or falls."
            why="The latch gain pushes a small imbalance away from the metastable point. The time constant sets how fast that happens."
            experiment="Increase the time constant and watch the same disturbance take longer to reach a rail."
            takeaway="Designers buy time with synchronizer stages. They do not delete the metastable point."
          />
        }
      />
    </>
  );
}

export function ClockingLab() {
  const [period, setPeriod] = useState(20);
  const [duty, setDuty] = useState(50);
  const [phase, setPhase] = useState(0);
  const [rise, setRise] = useState(1.2);
  const [fall, setFall] = useState(1.2);
  const [skew, setSkew] = useState(1.5);
  const [jitter, setJitter] = useState(0.8);
  const [source, setSource] = useState(1);
  const [sinkLatency, setSinkLatency] = useState(2);
  const [mode, setMode] = useState<"ideal" | "skewed" | "jittered">("skewed");
  const sinks = clockSinkArrivals({ sinks: 4, sourceLatency: source, sinkLatency, skew: mode === "skewed" ? skew : 0, mode });
  const arrivals = sinks.map((sink) => sink.arrival);
  const span = skewOf(arrivals);
  const jitterShown = mode === "jittered" ? jitter : 0;
  const high = period * duty / 100;
  const points = (shift: number) => Array.from({ length: 48 }, (_, index) => {
    const t = index;
    const local = ((t - shift - (phase / 360) * period) % period + period) % period;
    const riseW = Math.min(rise, high / 2, (period - high) / 2);
    const fallW = Math.min(fall, high / 2, (period - high) / 2);
    if (local < riseW) return local / Math.max(riseW, 0.05);
    if (local < high) return 1;
    if (local < high + fallW) return 1 - (local - high) / Math.max(fallW, 0.05);
    return 0;
  });
  return (
    <>
      <VlsiGrid
        stage={
          <div className="vlsi-stage">
            <div className="vlsi-stage-head">
              <h2>Source and sinks</h2>
              <Badge tone="info">{mode}</Badge>
            </div>
            <Chart
              ariaLabel="Source clock and sink clocks with skew"
              xMin={0}
              xMax={47}
              yMax={1}
              xLabel="Time (ns)"
              yLabel="Clock"
              series={[
                { name: "SRC", color: "#f8fafc", points: points(0).map((y, x) => ({ x, y })) },
                ...sinks.map((sink, index) => ({
                  name: sink.id,
                  color: ["#38bdf8", "#34d399", "#fbbf24", "#fb7185"][index] ?? "#94a3b8",
                  points: points(sink.arrival).map((y, x) => ({ x, y: Math.max(0, y - index * 0.015) })),
                })),
                ...(jitterShown > 0 ? [
                  { name: "early", color: "#fde68a", points: points(sinks[0]!.arrival - jitterShown).map((y, x) => ({ x, y })) },
                  { name: "late", color: "#f59e0b", points: points(sinks[0]!.arrival + jitterShown).map((y, x) => ({ x, y })) },
                ] : []),
              ]}
            />
            <p className="vlsi-callout">
              Jitter envelope ±{jitterShown.toFixed(2)} ns around each sink edge. Skew is the spread of sink arrivals, {ns(span.skew)}.
            </p>
          </div>
        }
        controls={
          <>
            <Choice label="Clock condition" value={mode} options={[{ id: "ideal", label: "Ideal" }, { id: "skewed", label: "Skewed" }, { id: "jittered", label: "Jittered" }]} onChange={setMode} />
            <Slider label="Period" value={period} min={8} max={40} step={1} text={ns(period)} onChange={setPeriod} />
            <Slider label="Frequency" value={1000 / period} min={1000 / 40} max={1000 / 8} step={1} text={`${(1000 / period).toFixed(1)} MHz`} onChange={(mhz) => setPeriod(Math.max(8, Math.min(40, Math.round(1000 / mhz))))} />
            <Slider label="Duty cycle" value={duty} min={20} max={80} step={5} text={`${duty}%`} onChange={setDuty} />
            <Slider label="Phase" value={phase} min={0} max={180} step={15} text={`${phase}°`} onChange={setPhase} />
            <Slider label="Rise time" value={rise} min={0.2} max={4} step={0.2} text={ns(rise)} onChange={setRise} />
            <Slider label="Fall time" value={fall} min={0.2} max={4} step={0.2} text={ns(fall)} onChange={setFall} />
            <Slider label="Clock skew" value={skew} min={0} max={6} step={0.25} text={ns(skew)} onChange={setSkew} />
            <Slider label="Clock jitter" value={jitter} min={0} max={3} step={0.1} text={`±${jitter.toFixed(1)} ns`} onChange={setJitter} />
            <Slider label="Source latency" value={source} min={0} max={6} step={0.5} text={ns(source)} onChange={setSource} />
            <Slider label="Sink latency" value={sinkLatency} min={0} max={6} step={0.5} text={ns(sinkLatency)} onChange={setSinkLatency} />
          </>
        }
        readouts={
          <>
            <Measure label="Period" value={ns(period)} />
            <Measure label="Frequency" value={`${(1000 / period).toFixed(2)} MHz`} />
            <Measure label="High time" value={ns(high)} />
            <Measure label="Low time" value={ns(period - high)} />
            <Measure label="Rise time" value={ns(rise)} />
            <Measure label="Fall time" value={ns(fall)} />
            <Measure label="Skew" value={ns(span.skew)} />
            <Measure label="Jitter" value={`±${jitterShown.toFixed(2)} ns`} />
          </>
        }
        footer={
          <Observe
            change="Switch among ideal, skewed, and jittered, then stretch the period."
            see="Ideal sinks share one arrival. Skew spreads them. Jitter draws an envelope instead of moving the mean edge."
            why="Skew is a fixed arrival difference. Jitter is uncertainty around an edge. Both eat into the data window."
            experiment="Set skew to zero in skewed mode and confirm the skew readout follows."
            takeaway="Period, duty, edge rate, skew, and jitter are separate clock specifications."
          />
        }
      />
    </>
  );
}

export function ClockTreeLab() {
  const [buffer, setBuffer] = useState(0.12);
  const [wire, setWire] = useState(0.08);
  const [asymmetry, setAsymmetry] = useState(0.2);
  const [count, setCount] = useState(4);
  const [target, setTarget] = useState(0.15);
  const [style, setStyle] = useState<"balanced" | "unbalanced" | "h-tree">("unbalanced");
  const [playing, setPlaying] = useState(true);
  const [hop, setHop] = useState(0);
  const tree = clockTree({ sinks: count, bufferDelay: buffer, wireDelay: wire, asymmetry, style });
  useTicker(playing, () => setHop((value) => (value + 1) % (tree.sinks.length + 2)), 360);
  const minArrival = Math.min(...tree.sinks.map((sink) => sink.arrival));
  return (
    <>
      <VlsiGrid
        stage={
          <div className="vlsi-stage">
            <div className="vlsi-stage-head">
              <h2>Clock tree</h2>
              <Badge tone={tree.skew <= target ? "on" : "bad"}>{tree.skew <= target ? "Skew under target" : "Skew above target"}</Badge>
            </div>
            <svg className="vlsi-schematic" viewBox="0 0 360 220" role="img" aria-label="Clock tree with a propagating pulse">
              <circle cx="40" cy="110" r="14" className={hop === 0 ? "vlsi-on" : "vlsi-off"} />
              <text x="40" y="114" textAnchor="middle" className="vlsi-svg-label">Root</text>
              {tree.sinks.map((sink, index) => {
                const y = 24 + index * (170 / Math.max(1, tree.sinks.length - 1));
                const active = hop > 0 && hop >= index + 1;
                return (
                  <g key={sink.id}>
                    <line x1="54" y1="110" x2="250" y2={y} className={active ? "vlsi-wire on" : "vlsi-wire"} />
                    <rect x="250" y={y - 12} width="78" height="24" rx="6" className={active ? "vlsi-gate on" : "vlsi-gate"} />
                    <text x="289" y={y + 4} textAnchor="middle" className="vlsi-svg-label">{sink.id} {sink.arrival.toFixed(2)}</text>
                  </g>
                );
              })}
            </svg>
            <Wave traces={tree.sinks.map((sink, index) => ({
              name: sink.id,
              color: ["#38bdf8", "#34d399", "#fbbf24", "#fb7185", "#a78bfa", "#22d3ee", "#f97316", "#e2e8f0"][index] ?? "#94a3b8",
              values: Array.from({ length: 40 }, (_, sample) => (sample >= 8 + sink.arrival * 20 ? 1 : 0)),
              min: 0,
              max: 1,
            }))} />
          </div>
        }
        controls={
          <>
            <PlayControls playing={playing} onToggle={() => setPlaying((value) => !value)} onStep={() => setHop((value) => (value + 1) % (tree.sinks.length + 2))} />
            <Choice label="Tree" value={style} options={[{ id: "balanced", label: "Balanced" }, { id: "unbalanced", label: "Unbalanced" }, { id: "h-tree", label: "H-tree" }]} onChange={setStyle} />
            <Slider label="Buffer delay" value={buffer} min={0.02} max={0.4} step={0.02} text={ns(buffer)} onChange={setBuffer} />
            <Slider label="Wire delay" value={wire} min={0} max={0.3} step={0.02} text={ns(wire)} onChange={setWire} />
            <Slider label="Branch asymmetry" value={asymmetry} min={0} max={0.6} step={0.02} text={ns(asymmetry)} onChange={setAsymmetry} />
            <Slider label="Number of sinks" value={count} min={2} max={8} step={1} text={String(count)} onChange={setCount} />
            <Slider label="Target skew" value={target} min={0.02} max={0.5} step={0.01} text={ns(target)} onChange={setTarget} />
          </>
        }
        readouts={
          <>
            <Measure label="Max skew" value={ns(tree.skew)} />
            <Measure label="Min arrival" value={ns(minArrival)} />
            <Measure label="Insertion delay" value={ns(tree.insertion)} />
            {tree.sinks.map((sink) => <Measure key={sink.id} label={`${sink.id} arrival`} value={ns(sink.arrival)} />)}
            <p>Challenge: bring skew to {ns(target)} or below. Balanced mode ignores branch asymmetry. This is not a clock-tree synthesis tool.</p>
          </>
        }
        footer={
          <Observe
            change="Raise branch asymmetry on the unbalanced tree, then switch to balanced."
            see="Sink waveforms step apart, then line up again when the tree is balanced."
            why="Skew here is the maximum sink arrival minus the minimum. Extra delay on one branch moves only that arrival."
            experiment="Add sinks and watch insertion delay grow with the tree depth."
            takeaway="A useful clock network makes sinks agree. Buffer and wire delay set how late that agreement is."
          />
        }
      />
    </>
  );
}
