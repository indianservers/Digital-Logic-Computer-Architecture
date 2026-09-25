import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useCircuit, type CircuitSession } from "../../components/circuit/useCircuit";
import { addNode, connect, emptyDoc, signalOf } from "../../components/circuit/engine";
import type { Bit, CircuitDoc } from "../../components/circuit/types";
import { Icon, type IconName } from "../../design-system/icons";
import { Toggle } from "../../design-system/ui";
import { bcdToSeven, decoder, demux, encoder, mux, priorityEncoder } from "../../engines/digital/routing";

type Page = "mux" | "demux" | "enc" | "dec";

const TABS: Array<{ id: Page; label: string; icon: IconName }> = [
  { id: "mux", label: "Multiplexer (MUX)", icon: "grid" },
  { id: "demux", label: "Demultiplexer (DEMUX)", icon: "gate" },
  { id: "enc", label: "Encoder", icon: "table" },
  { id: "dec", label: "Decoder", icon: "map" },
];

const GUIDE: Array<{ label: string; page: Page }> = [
  { label: "Select the circuit type", page: "mux" },
  { label: "Configure inputs and select lines", page: "mux" },
  { label: "Toggle inputs and observe output", page: "mux" },
  { label: "View truth table and logic expression", page: "mux" },
  { label: "Explore gate-level implementation", page: "mux" },
  { label: "Try different configurations", page: "demux" },
  { label: "Solve the practice challenge", page: "mux" },
];

const TAKES = [
  "MUX selects one input based on select lines.",
  "DEMUX routes one input to many outputs.",
  "Encoders convert one-hot inputs to binary.",
  "Decoders convert binary inputs to one-hot outputs.",
  "Used in data routing, memory, and communication systems.",
];

const APPS = [
  ["Data Selector", "A mux picks one data source for a shared bus."],
  ["Bus Routing", "Select lines steer a word onto one path."],
  ["Signal Routing", "The same gates route audio, sensor, or control lines."],
  ["Memory Addressing", "A decoder turns an address into one word line."],
  ["Communication Systems", "A demux fans one stream out to many channels."],
  ["Digital Signal Processing", "Muxes choose which sample reaches the next stage."],
];

function build(parts: Array<{ type: string; x: number; y: number; label: string; params?: Record<string, number> }>, links: Array<[string, string, string, string]>): CircuitDoc {
  let doc = emptyDoc();
  const ids = new Map<string, string>();
  for (const part of parts) {
    const id = `n${doc.nextId}`;
    doc = addNode(doc, part.type, part.x, part.y, part.label, part.params);
    ids.set(part.label, id);
  }
  for (const [from, fromPort, to, toPort] of links) {
    const source = ids.get(from);
    const sink = ids.get(to);
    if (source && sink) doc = connect(doc, source, fromPort, sink, toPort).doc;
  }
  return doc;
}

function muxGates(): CircuitDoc {
  return build(
    [
      { type: "input", x: 16, y: 16, label: "I0", params: { value: 0 } },
      { type: "input", x: 16, y: 88, label: "I1", params: { value: 1 } },
      { type: "input", x: 16, y: 160, label: "I2", params: { value: 0 } },
      { type: "input", x: 16, y: 232, label: "I3", params: { value: 1 } },
      { type: "input", x: 16, y: 320, label: "S0", params: { value: 0 } },
      { type: "input", x: 16, y: 392, label: "S1", params: { value: 1 } },
      { type: "not", x: 150, y: 312, label: "nS0" },
      { type: "not", x: 150, y: 384, label: "nS1" },
      { type: "and", x: 320, y: 8, label: "A0", params: { inputs: 3 } },
      { type: "and", x: 320, y: 96, label: "A1", params: { inputs: 3 } },
      { type: "and", x: 320, y: 184, label: "A2", params: { inputs: 3 } },
      { type: "and", x: 320, y: 272, label: "A3", params: { inputs: 3 } },
      { type: "or", x: 520, y: 140, label: "OR", params: { inputs: 4 } },
      { type: "led", x: 700, y: 156, label: "Y" },
    ],
    [
      ["S0", "Y", "nS0", "A"], ["S1", "Y", "nS1", "A"],
      ["I0", "Y", "A0", "A"], ["nS1", "Y", "A0", "B"], ["nS0", "Y", "A0", "C"],
      ["I1", "Y", "A1", "A"], ["nS1", "Y", "A1", "B"], ["S0", "Y", "A1", "C"],
      ["I2", "Y", "A2", "A"], ["S1", "Y", "A2", "B"], ["nS0", "Y", "A2", "C"],
      ["I3", "Y", "A3", "A"], ["S1", "Y", "A3", "B"], ["S0", "Y", "A3", "C"],
      ["A0", "Y", "OR", "A"], ["A1", "Y", "OR", "B"], ["A2", "Y", "OR", "C"], ["A3", "Y", "OR", "D"],
      ["OR", "Y", "Y", "A"],
    ],
  );
}

function muxCascade(): CircuitDoc {
  return build(
    [
      { type: "input", x: 16, y: 24, label: "I0", params: { value: 0 } },
      { type: "input", x: 16, y: 96, label: "I1", params: { value: 1 } },
      { type: "input", x: 16, y: 180, label: "I2", params: { value: 0 } },
      { type: "input", x: 16, y: 252, label: "I3", params: { value: 1 } },
      { type: "input", x: 16, y: 340, label: "S0", params: { value: 1 } },
      { type: "input", x: 180, y: 340, label: "S1", params: { value: 1 } },
      { type: "mux2", x: 180, y: 40, label: "M0" },
      { type: "mux2", x: 180, y: 190, label: "M1" },
      { type: "mux2", x: 400, y: 120, label: "M2" },
      { type: "led", x: 600, y: 140, label: "Y" },
    ],
    [
      ["I0", "Y", "M0", "I0"], ["I1", "Y", "M0", "I1"], ["S0", "Y", "M0", "S"],
      ["I2", "Y", "M1", "I0"], ["I3", "Y", "M1", "I1"], ["S0", "Y", "M1", "S"],
      ["M0", "Y", "M2", "I0"], ["M1", "Y", "M2", "I1"], ["S1", "Y", "M2", "S"],
      ["M2", "Y", "Y", "A"],
    ],
  );
}

function demuxGates(): CircuitDoc {
  return build(
    [
      { type: "input", x: 16, y: 80, label: "D", params: { value: 1 } },
      { type: "input", x: 16, y: 280, label: "S0", params: { value: 1 } },
      { type: "input", x: 16, y: 352, label: "S1", params: { value: 0 } },
      { type: "not", x: 150, y: 272, label: "nS0" },
      { type: "not", x: 150, y: 344, label: "nS1" },
      { type: "and", x: 320, y: 8, label: "A0", params: { inputs: 3 } },
      { type: "and", x: 320, y: 96, label: "A1", params: { inputs: 3 } },
      { type: "and", x: 320, y: 184, label: "A2", params: { inputs: 3 } },
      { type: "and", x: 320, y: 272, label: "A3", params: { inputs: 3 } },
      { type: "led", x: 520, y: 16, label: "Y0" },
      { type: "led", x: 520, y: 104, label: "Y1" },
      { type: "led", x: 520, y: 192, label: "Y2" },
      { type: "led", x: 520, y: 280, label: "Y3" },
    ],
    [
      ["S0", "Y", "nS0", "A"], ["S1", "Y", "nS1", "A"],
      ["D", "Y", "A0", "A"], ["nS1", "Y", "A0", "B"], ["nS0", "Y", "A0", "C"],
      ["D", "Y", "A1", "A"], ["nS1", "Y", "A1", "B"], ["S0", "Y", "A1", "C"],
      ["D", "Y", "A2", "A"], ["S1", "Y", "A2", "B"], ["nS0", "Y", "A2", "C"],
      ["D", "Y", "A3", "A"], ["S1", "Y", "A3", "B"], ["S0", "Y", "A3", "C"],
      ["A0", "Y", "Y0", "A"], ["A1", "Y", "Y1", "A"], ["A2", "Y", "Y2", "A"], ["A3", "Y", "Y3", "A"],
    ],
  );
}

function encoderGates(): CircuitDoc {
  return build(
    [
      { type: "input", x: 16, y: 24, label: "I0", params: { value: 0 } },
      { type: "input", x: 16, y: 100, label: "I1", params: { value: 0 } },
      { type: "input", x: 16, y: 176, label: "I2", params: { value: 1 } },
      { type: "input", x: 16, y: 252, label: "I3", params: { value: 0 } },
      { type: "or", x: 220, y: 80, label: "Y0g" },
      { type: "or", x: 220, y: 190, label: "Y1g" },
      { type: "led", x: 420, y: 88, label: "Y0" },
      { type: "led", x: 420, y: 198, label: "Y1" },
    ],
    [
      ["I1", "Y", "Y0g", "A"], ["I3", "Y", "Y0g", "B"], ["Y0g", "Y", "Y0", "A"],
      ["I2", "Y", "Y1g", "A"], ["I3", "Y", "Y1g", "B"], ["Y1g", "Y", "Y1", "A"],
    ],
  );
}

function decoderGates(): CircuitDoc {
  return build(
    [
      { type: "input", x: 24, y: 40, label: "S0", params: { value: 1 } },
      { type: "input", x: 24, y: 130, label: "S1", params: { value: 0 } },
      { type: "dec2", x: 180, y: 40, label: "DEC" },
      { type: "led", x: 400, y: 8, label: "Y0" },
      { type: "led", x: 400, y: 80, label: "Y1" },
      { type: "led", x: 400, y: 152, label: "Y2" },
      { type: "led", x: 400, y: 224, label: "Y3" },
    ],
    [
      ["S1", "Y", "DEC", "A"], ["S0", "Y", "DEC", "B"],
      ["DEC", "Y0", "Y0", "A"], ["DEC", "Y1", "Y1", "A"], ["DEC", "Y2", "Y2", "A"], ["DEC", "Y3", "Y3", "A"],
    ],
  );
}

const STARTERS: Record<Page, () => CircuitDoc> = { mux: muxGates, demux: demuxGates, enc: encoderGates, dec: decoderGates };

function level(doc: CircuitDoc, label: string): 0 | 1 {
  const node = doc.nodes.find((item) => item.label === label);
  return node?.params.value === 1 ? 1 : 0;
}

function setLevel(circuit: CircuitSession, label: string, value: 0 | 1) {
  circuit.update((doc) => ({
    ...doc,
    nodes: doc.nodes.map((node) => node.label === label ? { ...node, params: { ...node.params, value } } : node),
  }));
}

function ledBit(circuit: CircuitSession, label: string): Bit {
  const node = circuit.doc.nodes.find((item) => item.label === label);
  return node ? signalOf(circuit.shown, node.id, "A") : "X";
}

export function RoutingStudio() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab") ?? "mux";
  const page: Page = raw === "demux" ? "demux" : raw === "enc" || raw === "priority" ? "enc" : raw === "dec" || raw === "seg" || raw === "code" ? "dec" : "mux";
  const priority = raw === "priority";
  const segment = raw === "seg";
  const circuit = useCircuit({ storage: "logiclab.circuit.routing.v1", starter: muxGates });
  const booted = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(500);
  const [showTable, setShowTable] = useState(true);
  const [showExpr, setShowExpr] = useState(true);
  const [showGates, setShowGates] = useState(true);
  const [labels, setLabels] = useState(true);
  const [guide, setGuide] = useState(0);
  const [app, setApp] = useState(0);
  const [note, setNote] = useState("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const marker = page === "demux" ? "D" : page === "dec" ? "DEC" : page === "enc" ? "Y0g" : "A0";
    const matches = circuit.doc.nodes.some((node) => node.label === marker);
    if (!booted.current) {
      booted.current = true;
      if (!matches) circuit.replace(STARTERS[page]());
      return;
    }
    circuit.replace(STARTERS[page]());
    setPlaying(false);
  }, [page]);

  useEffect(() => {
    if (!playing) return undefined;
    const id = window.setInterval(() => {
      circuit.update((doc) => stepSelect(doc, page));
      setTick((value) => value + 1);
    }, speed);
    return () => window.clearInterval(id);
  }, [playing, speed, page]);

  function go(next: Page, step?: number) {
    const query = new URLSearchParams(params);
    query.set("tab", next);
    setParams(query, { replace: true });
    if (step !== undefined) setGuide(step);
  }

  const monitor = useMemo(() => readMonitor(circuit, page, priority), [circuit.doc, circuit.shown, page, priority]);

  return (
    <div className="rtx">
      <header className="fsmx-head">
        <div className="lgx-title">
          <span className="lgx-mark rtx-mark"><Icon name="grid" size={22} /></span>
          <div>
            <h1>MUX, DEMUX, Encoder & Decoder</h1>
            <p>Design, simulate, and explore multiplexers, demultiplexers, encoders, and decoders with real-time visuals.</p>
          </div>
        </div>
        <div className="rtx-head-actions">
          <button type="button" className="alux-hint" onClick={() => { void navigator.clipboard?.writeText(window.location.href); setNote("Link copied."); }}>Share</button>
          <button type="button" className="alux-hint" onClick={() => { void navigator.clipboard?.writeText(`<iframe src="${window.location.href}" title="MUX studio"></iframe>`); setNote("Embed code copied."); }}>Embed</button>
          <Link className="lgx-back" to="/learn"><Icon name="back" size={14} /> Back to Path</Link>
        </div>
      </header>
      <div className="lgx-tabs" role="tablist">
        {TABS.map((item) => (
          <button key={item.id} type="button" role="tab" aria-selected={page === item.id} className={page === item.id ? "on" : ""} onClick={() => go(item.id)}>
            <Icon name={item.icon} size={14} /> {item.label}
          </button>
        ))}
      </div>
      <div className="rtx-run">
        <button type="button" className="rtx-go" onClick={() => { setPlaying(true); circuit.setPlaying(true); }}><Icon name="play" size={14} /> Run</button>
        <button type="button" className="rtx-tool" onClick={() => { setPlaying(false); circuit.setPlaying(false); }}><Icon name="pause" size={14} /> Pause</button>
        <button type="button" className="rtx-tool" onClick={() => circuit.replace(STARTERS[page]())}><Icon name="reset" size={14} /> Reset</button>
        <button type="button" className="rtx-tool" onClick={() => { circuit.update((doc) => stepSelect(doc, page)); setTick((value) => value + 1); }}><Icon name="step" size={14} /> Step</button>
        <label className="rtx-speed">Simulation Speed
          <input aria-label="Simulation speed" type="range" min={150} max={1000} step={50} value={speed} onChange={(event) => setSpeed(Number(event.target.value))} />
          <span>{speed <= 300 ? "Fast" : speed >= 800 ? "Slow" : "Normal"}</span>
        </label>
        <Toggle on={circuit.showProp} onChange={circuit.setShowProp} label="Show Propagation" />
        <button type="button" className="rtx-tool" onClick={() => circuit.replace(emptyDoc())}>Clear Canvas</button>
      </div>
      {note ? <p className="tiny">{note}</p> : null}
      <div className="rtx-layout">
        <div className="rtx-main">
          <div className="rtx-stage">
            <Config page={page} priority={priority} segment={segment} circuit={circuit} labels={labels} showTable={showTable} showExpr={showExpr} showGates={showGates} onLabels={setLabels} onTable={setShowTable} onExpr={setShowExpr} onGates={setShowGates} />
            <Schematic page={page} circuit={circuit} labels={labels} onToggle={(label, on) => setLevel(circuit, label, on ? 1 : 0)} />
            <div className="rtx-out">
              <section className="lgx-card rtx-monitor">
                <h3>Output Monitor</h3>
                {monitor.lamps.map((lamp) => (
                  <div key={lamp.name} className="rtx-lamp">
                    <span>Output {lamp.name}</span>
                    <i className={lamp.bit === 1 ? "on" : ""}>{lamp.bit === 1 ? 1 : lamp.bit === 0 ? 0 : "X"}</i>
                  </div>
                ))}
              </section>
              {showExpr ? (
                <section className="lgx-card">
                  <h3>Logic Expression</h3>
                  <p className="rtx-expr">{monitor.expression}</p>
                </section>
              ) : null}
              {showGates ? (
                <section className="lgx-card">
                  <h3>Gate-Level Implementation</h3>
                  <p className="tiny">{monitor.gates}</p>
                </section>
              ) : null}
              {segment ? <SegExtra circuit={circuit} /> : null}
            </div>
          </div>
          <div className="rtx-bottom">
            {showTable ? <Truth page={page} circuit={circuit} priority={priority} /> : null}
            <Wave page={page} circuit={circuit} playing={playing} tick={tick} />
            <section className="lgx-card">
              <h3>Practical Applications</h3>
              <div className="rtx-apps">
                {APPS.map(([title, body], index) => (
                  <button key={title} type="button" className={app === index ? "on" : ""} onClick={() => setApp(index)}><b>{title}</b><span>{body}</span></button>
                ))}
              </div>
            </section>
            <section className="lgx-card">
              <div className="lgx-card-bar"><h3>Practice Challenge</h3><span className="rtx-med">Medium</span></div>
              <p>Design a 4:1 MUX using only 2:1 MUX blocks. Use 3 multiplexers to build a 4:1 MUX. Configure inputs and verify the output.</p>
              <div className="alux-actions">
                <button type="button" className="lgx-check" onClick={() => { go("mux"); circuit.replace(muxCascade()); setNote("Loaded three 2:1 muxes. S0 picks inside each pair. S1 picks the pair."); }}>Try It Now</button>
                <button type="button" className="alux-hint" onClick={() => circuit.replace(muxGates())}>Reset</button>
              </div>
            </section>
          </div>
        </div>
        <aside className="rtx-side">
          <section className="lgx-card lgx-guide">
            <h3><Icon name="book" size={14} /> Studio Guide</h3>
            <p className="tiny">Build and explore multiplexers, demultiplexers, encoders, and decoders with interactive simulation.</p>
            <ol>
              {GUIDE.map((item, index) => (
                <li key={item.label} className={guide === index ? "now" : ""}>
                  <button type="button" onClick={() => go(item.page, index)}><span>{index + 1}</span>{item.label}</button>
                </li>
              ))}
            </ol>
          </section>
          <section className="lgx-card lgx-takes">
            <h3>Key Takeaways</h3>
            <ul>{TAKES.map((item) => <li key={item}><i>✓</i>{item}</li>)}</ul>
          </section>
          <section className="lgx-card alux-quote">
            <p>“Digital logic gives you the power to build intelligent systems.”</p>
            <cite>— Noam Chomsky</cite>
          </section>
        </aside>
      </div>
    </div>
  );
}

function portBit(circuit: CircuitSession, label: string, port: string): Bit {
  const node = circuit.doc.nodes.find((item) => item.label === label);
  return node ? signalOf(circuit.shown, node.id, port) : "X";
}

function Schematic({ page, circuit, labels, onToggle }: { page: Page; circuit: CircuitSession; labels: boolean; onToggle: (label: string, on: boolean) => void }) {
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const empty = circuit.doc.nodes.length === 0;
  const cascade = circuit.doc.nodes.some((node) => node.label === "M0");
  const rows = page === "enc" ? ["I0", "I1", "I2", "I3"] : page === "dec" ? ["S1", "S0"] : page === "demux" ? ["D", "S1", "S0"] : ["I0", "I1", "I2", "I3", "S0", "S1"];
  return (
    <section className="lgx-card rtx-canvas">
      <div className="lgx-card-bar">
        <div>
          <h3>Circuit Visualizer</h3>
          <p className="tiny">{cascade ? "4:1 multiplexer from three 2:1 blocks" : caption(page)}</p>
        </div>
        <div className="rtx-zoom">
          <button type="button" aria-label="Pan" className="on">✋</button>
          <button type="button" aria-label="Zoom out" onClick={() => setZoom((value) => Math.max(0.6, value - 0.1))}>−</button>
          <button type="button" aria-label="Zoom in" onClick={() => setZoom((value) => Math.min(1.6, value + 0.1))}>+</button>
          <span>{Math.round(zoom * 100)}%</span>
        </div>
      </div>
      <div
        className="rtx-board"
        onPointerDown={(event) => {
          if ((event.target as HTMLElement).closest("button, .rtx-sw")) return;
          drag.current = { x: event.clientX, y: event.clientY, px: pan.x, py: pan.y };
          event.currentTarget.setPointerCapture(event.pointerId);
          event.currentTarget.classList.add("panning");
        }}
        onPointerMove={(event) => {
          if (!drag.current) return;
          setPan({ x: drag.current.px + event.clientX - drag.current.x, y: drag.current.py + event.clientY - drag.current.y });
        }}
        onPointerUp={(event) => { drag.current = null; event.currentTarget.classList.remove("panning"); }}
        onWheel={(event) => { event.preventDefault(); setZoom((value) => Math.max(0.6, Math.min(1.6, value + (event.deltaY < 0 ? 0.08 : -0.08)))); }}
      >
        {empty ? <p className="rtx-empty">Canvas cleared. Reset loads this tab’s circuit.</p> : (
          <svg viewBox="0 0 640 420" className="rtx-svg" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
            {rows.map((name, index) => (
              <g key={name} className="rtx-sw" onClick={() => onToggle(name, level(circuit.doc, name) !== 1)}>
                {labels ? <text x="8" y={36 + index * 52} className="tag">{name}</text> : null}
                <rect x="36" y={22 + index * 52} width="44" height="22" rx="11" className={level(circuit.doc, name) === 1 ? "track on" : "track"} />
                <circle cx={level(circuit.doc, name) === 1 ? 68 : 48} cy={33 + index * 52} r="8" className="knob" />
              </g>
            ))}
            {!cascade && page === "mux" ? <MuxDrawing circuit={circuit} /> : null}
            {cascade ? <CascadeDrawing circuit={circuit} /> : null}
            {page === "demux" ? <GateColumn kind="and" names={["A0", "A1", "A2", "A3"]} outs={["Y0", "Y1", "Y2", "Y3"]} circuit={circuit} /> : null}
            {page === "enc" ? <GateColumn kind="or" names={["Y0g", "Y1g"]} outs={["Y0", "Y1"]} circuit={circuit} /> : null}
            {page === "dec" ? <GateColumn kind="and" names={["Y0", "Y1", "Y2", "Y3"]} outs={["Y0", "Y1", "Y2", "Y3"]} circuit={circuit} /> : null}
          </svg>
        )}
      </div>
    </section>
  );
}

function textBit(bit: Bit): string {
  return bit === 1 ? "1" : bit === 0 ? "0" : "X";
}

/** ANSI AND: flat input side, semicircular output. */
function andOutline(w: number, h: number): string {
  const r = h / 2;
  const flat = Math.max(8, w - r);
  return `M0 0 H${flat} A${r} ${r} 0 0 1 ${flat} ${h} H0 Z`;
}

/** ANSI OR: concave input side, pointed output. */
function orOutline(w: number, h: number): string {
  return `M0 0 C${w * 0.45} 0 ${w * 0.78} ${h * 0.1} ${w} ${h / 2} C${w * 0.78} ${h * 0.9} ${w * 0.45} ${h} 0 ${h} C${w * 0.3} ${h * 0.72} ${w * 0.3} ${h * 0.28} 0 0 Z`;
}

function GateShape({ kind, x, y, w, h, hot }: { kind: "and" | "or"; x: number; y: number; w: number; h: number; hot: boolean }) {
  return <path d={kind === "and" ? andOutline(w, h) : orOutline(w, h)} transform={`translate(${x} ${y})`} className={hot ? "gate hot" : "gate"} />;
}

function Lamp({ x, y, name, bit }: { x: number; y: number; name: string; bit: Bit }) {
  const on = bit === 1;
  return (
    <g>
      <rect x={x} y={y} width="46" height="46" rx="10" className="ledbox" />
      <text x={x + 23} y={y - 6} textAnchor="middle" className="tag">{name}</text>
      <circle cx={x + 23} cy={y + 23} r="13" className={on ? "bulb on" : "bulb"} />
      <text x={x + 23} y={y + 27} textAnchor="middle" className={on ? "val on" : "val"}>{textBit(bit)}</text>
    </g>
  );
}

function MuxDrawing({ circuit }: { circuit: CircuitSession }) {
  const andW = 46;
  const andH = 34;
  const row = 52;
  const andX = 168;
  const orW = 58;
  const orH = 108;
  const orX = 292;
  const mid = 33 + 1.5 * row;
  const orY = mid - orH / 2;
  const orHot = portBit(circuit, "OR", "Y") === 1;
  const yBit = portBit(circuit, "Y", "A");
  return (
    <g>
      {["A0", "A1", "A2", "A3"].map((name, index) => (
        <GateShape key={name} kind="and" x={andX} y={33 + index * row - andH / 2} w={andW} h={andH} hot={portBit(circuit, name, "Y") === 1} />
      ))}
      <path d={`M${andX + andW + 28} ${mid} H${orX + 14}`} className={orHot ? "wire hot" : "wire"} />
      <GateShape kind="or" x={orX} y={orY} w={orW} h={orH} hot={orHot} />
      <path d={`M${orX + orW} ${mid} H${orX + orW + 36}`} className={yBit === 1 ? "wire hot" : "wire"} />
      <Lamp x={orX + orW + 36} y={mid - 23} name="Y" bit={yBit} />
    </g>
  );
}

function CascadeDrawing({ circuit }: { circuit: CircuitSession }) {
  const yBit = portBit(circuit, "Y", "A");
  return (
    <g>
      {["M0", "M1", "M2"].map((name, index) => (
        <g key={name} transform={`translate(${210 + index * 110} ${70 + (index === 2 ? 40 : index * 90)})`}>
          <path d="M0 8 H18 L48 28 L18 48 H0 Z" className={portBit(circuit, name, "Y") === 1 ? "gate hot" : "gate"} />
          <text x="24" y="32" textAnchor="middle" className="tag">{name}</text>
        </g>
      ))}
      <Lamp x={540} y={108} name="Y" bit={yBit} />
    </g>
  );
}

function GateColumn({ kind, names, outs, circuit }: { kind: "and" | "or"; names: string[]; outs: string[]; circuit: CircuitSession }) {
  const gap = names.length > 2 ? 78 : 110;
  const top = names.length > 2 ? 18 : 48;
  const w = kind === "and" ? 50 : 62;
  const h = kind === "and" ? 40 : 56;
  return (
    <g>
      {names.map((name, index) => {
        const y = top + index * gap;
        const out = outs[index] ?? name;
        const outBit = portBit(circuit, out, "A");
        const gateBit = name.startsWith("Y") ? outBit : portBit(circuit, name, "Y");
        return (
          <g key={name}>
            <GateShape kind={kind} x={168} y={y} w={w} h={h} hot={gateBit === 1} />
            <path d={`M${168 + w} ${y + h / 2} H${280}`} className={outBit === 1 ? "wire hot" : "wire"} />
            <Lamp x={280} y={y + h / 2 - 23} name={out} bit={outBit} />
          </g>
        );
      })}
    </g>
  );
}

function Config({ page, priority, segment, circuit, labels, showTable, showExpr, showGates, onLabels, onTable, onExpr, onGates }: {
  page: Page; priority: boolean; segment: boolean; circuit: CircuitSession;
  labels: boolean; showTable: boolean; showExpr: boolean; showGates: boolean;
  onLabels: (value: boolean) => void; onTable: (value: boolean) => void; onExpr: (value: boolean) => void; onGates: (value: boolean) => void;
}) {
  const names = page === "mux" ? ["I0", "I1", "I2", "I3"] : page === "demux" ? ["D"] : page === "enc" ? ["I0", "I1", "I2", "I3"] : ["S0", "S1"];
  const selects = page === "dec" ? [] : page === "enc" ? [] : ["S0", "S1"];
  return (
    <section className="lgx-card rtx-config">
      <h3>{page === "mux" ? "MUX Configuration" : page === "demux" ? "DEMUX Configuration" : page === "enc" ? "Encoder Configuration" : "Decoder Configuration"}</h3>
      {page === "mux" ? (
        <label>Select Multiplexer
          <select aria-label="Multiplexer size" value="4" onChange={() => circuit.replace(muxGates())}>
            <option value="4">4:1 MUX</option>
          </select>
        </label>
      ) : null}
      {priority ? <p className="tiny">Priority mode: the highest input that is 1 wins. I3 beats I2, I1, and I0.</p> : null}
      {segment ? <p className="tiny">Seven-segment mode reads S1 S0 as the low bits of a digit.</p> : null}
      <p className="alux-kicker">{page === "demux" ? "Data" : page === "dec" ? "Select" : "Select Inputs"}</p>
      {names.map((name) => <BitRow key={name} label={name} on={level(circuit.doc, name) === 1} onChange={(on) => setLevel(circuit, name, on ? 1 : 0)} />)}
      {selects.length > 0 ? <p className="alux-kicker">Select Lines</p> : null}
      {selects.map((name) => <BitRow key={name} label={name} on={level(circuit.doc, name) === 1} onChange={(on) => setLevel(circuit, name, on ? 1 : 0)} />)}
      <p className="alux-kicker">Display Options</p>
      <Toggle on={labels} onChange={(on) => { onLabels(on); circuit.update((doc) => ({ ...doc, nodes: doc.nodes.map((node) => ({ ...node, showLabel: on })) })); }} label="Show Labels" />
      <Toggle on={showTable} onChange={onTable} label="Show Truth Table" />
      <Toggle on={showExpr} onChange={onExpr} label="Show Expression" />
      <Toggle on={showGates} onChange={onGates} label="Show Gate Implementation" />
    </section>
  );
}

function BitRow({ label, on, onChange }: { label: string; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <div className="rtx-bit">
      <Toggle on={on} onChange={onChange} label={label} showLabel />
      <b>{on ? 1 : 0}</b>
    </div>
  );
}

function Truth({ page, circuit, priority }: { page: Page; circuit: CircuitSession; priority: boolean }) {
  const rows = truthRows(page, circuit, priority);
  return (
    <section className="lgx-card rtx-truth">
      <div className="lgx-card-bar"><h3>Truth Table ({rows.title})</h3><button type="button" className="fsmx-icon" onClick={() => circuit.replace(STARTERS[page]())}>Clear</button></div>
      <table>
        <thead><tr>{rows.heads.map((head) => <th key={head}>{head}</th>)}</tr></thead>
        <tbody>
          {rows.lines.map((line) => (
            <tr key={line.join("-")} className={line.at(-1) === "on" ? "on" : ""}>
              {line.slice(0, -1).map((cell, index) => <td key={index}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Wave({ page, circuit, playing, tick }: { page: Page; circuit: CircuitSession; playing: boolean; tick: number }) {
  const names = page === "demux" ? ["D", "S1", "S0"] : page === "enc" ? ["I0", "I1", "I2", "I3"] : page === "dec" ? ["S1", "S0"] : ["S1", "S0", "I0", "I1", "I2", "I3"];
  return (
    <section className="lgx-card">
      <h3>Propagation Animation <span className="tiny">{playing ? "running" : `t = ${tick * 40} ns`}</span></h3>
      <svg className="rtx-wave" viewBox="0 0 280 120" aria-label="Signal timing">
        {names.map((name, row) => {
          const bit = level(circuit.doc, name);
          return (
            <g key={name}>
              <text x="0" y={16 + row * 18} fontSize="10">{name}</text>
              <path d={`M36 ${10 + row * 18} H120 V${bit === 1 ? 4 + row * 18 : 14 + row * 18} H200 V${10 + row * 18} H260`} fill="none" stroke="#2563eb" strokeWidth="1.6" />
            </g>
          );
        })}
      </svg>
    </section>
  );
}

function SegExtra({ circuit }: { circuit: CircuitSession }) {
  const nibble = [0, 0, level(circuit.doc, "S1"), level(circuit.doc, "S0")] as Array<0 | 1>;
  const digit = bcdToSeven(nibble);
  return (
    <section className="lgx-card">
      <h3>7-segment</h3>
      <p className="tiny">{digit.valid ? `Digit ${digit.digit}` : "Not a decimal digit."} Segments {digit.segments.join("")}</p>
    </section>
  );
}

function stepSelect(doc: CircuitDoc, page: Page): CircuitDoc {
  const order = page === "enc" ? ["I0", "I1", "I2", "I3"] : page === "demux" ? ["S0", "S1"] : ["S0", "S1"];
  const bits = order.map((label) => level(doc, label));
  const value = bits.reduce<number>((sum, bit, index) => sum + bit * (1 << index), 0);
  const next = (value + 1) % (1 << order.length);
  return {
    ...doc,
    nodes: doc.nodes.map((node) => {
      const index = order.indexOf(node.label);
      if (index < 0) return node;
      const bit = (next >> index) & 1;
      return { ...node, params: { ...node.params, value: bit } };
    }),
  };
}

function caption(page: Page): string {
  if (page === "mux") return "4:1 multiplexer using basic gates";
  if (page === "demux") return "1:4 demultiplexer using basic gates";
  if (page === "enc") return "4-to-2 encoder using OR gates";
  return "2-to-4 decoder";
}

function readMonitor(circuit: CircuitSession, page: Page, priority: boolean) {
  if (page === "mux") {
    const y = ledBit(circuit, "Y");
    return { lamps: [{ name: "Y", bit: y }], expression: "Y = S1'·S0'·I0 + S1'·S0·I1 + S1·S0'·I2 + S1·S0·I3", gates: "4 AND gates + 1 OR gate (4:1 MUX)" };
  }
  if (page === "demux") {
    return {
      lamps: ["Y0", "Y1", "Y2", "Y3"].map((name) => ({ name, bit: ledBit(circuit, name) })),
      expression: "Yi = D · select i",
      gates: "4 AND gates. One output follows D.",
    };
  }
  if (page === "enc") {
    const inputs = [0, 1, 2, 3].map((index) => level(circuit.doc, `I${index}`));
    const ranked = priority ? priorityEncoder(inputs) : null;
    return {
      lamps: ["Y0", "Y1"].map((name) => ({ name, bit: ledBit(circuit, name) })),
      expression: ranked ? `Priority index ${ranked.winner ?? "none"}` : "Y1 Y0 = one-hot index",
      gates: priority ? "Highest request wins." : "2 OR gates (4-to-2 encoder)",
    };
  }
  return {
    lamps: ["Y0", "Y1", "Y2", "Y3"].map((name) => ({ name, bit: ledBit(circuit, name) })),
    expression: "One-hot Y = decode(S1 S0)",
    gates: "2-to-4 decoder block",
  };
}

function truthRows(page: Page, circuit: CircuitSession, priority: boolean): { title: string; heads: string[]; lines: string[][] } {
  if (page === "mux") {
    const data = [0, 1, 2, 3].map((index) => level(circuit.doc, `I${index}`));
    const s1 = level(circuit.doc, "S1");
    const s0 = level(circuit.doc, "S0");
    const lines = [0, 1, 2, 3].map((index) => {
      const sel = [index % 2, Math.floor(index / 2)] as Array<0 | 1>;
      const lo = sel[0] ?? 0;
      const hi = sel[1] ?? 0;
      const y = mux(data, [hi, lo]).y;
      const active = lo === s0 && hi === s1;
      return [String(hi), String(lo), ...data.map(String), String(y), active ? "on" : ""];
    });
    return { title: "4:1 MUX", heads: ["S1", "S0", "I0", "I1", "I2", "I3", "Y"], lines };
  }
  if (page === "demux") {
    const data = level(circuit.doc, "D");
    const s1 = level(circuit.doc, "S1");
    const s0 = level(circuit.doc, "S0");
    const lines = [0, 1, 2, 3].map((index) => {
      const outs = demux(data, [index > 1 ? 1 : 0, index % 2 === 1 ? 1 : 0], 4);
      const active = (index % 2 === s0) && ((index > 1 ? 1 : 0) === s1);
      return [String(data), String(index > 1 ? 1 : 0), String(index % 2), ...outs.map(String), active ? "on" : ""];
    });
    return { title: "1:4 DEMUX", heads: ["D", "S1", "S0", "Y0", "Y1", "Y2", "Y3"], lines };
  }
  if (page === "enc") {
    const lines = [0, 1, 2, 3].map((index) => {
      const inputs = [0, 1, 2, 3].map((bit) => (bit === index ? 1 : 0)) as Array<0 | 1>;
      const coded = priority ? priorityEncoder(inputs) : encoder(inputs);
      const current = [0, 1, 2, 3].every((bit) => level(circuit.doc, `I${bit}`) === inputs[bit]);
      const y1 = coded.y[0] ?? 0;
      const y0 = coded.y[1] ?? 0;
      return [...inputs.map(String), String(y0), String(y1), current ? "on" : ""];
    });
    return { title: priority ? "Priority" : "4-to-2", heads: ["I0", "I1", "I2", "I3", "Y0", "Y1"], lines };
  }
  const s1 = level(circuit.doc, "S1");
  const s0 = level(circuit.doc, "S0");
  const lines = [0, 1, 2, 3].map((index) => {
    const outs = decoder([index > 1 ? 1 : 0, index % 2 === 1 ? 1 : 0], 1);
    const active = (index % 2 === s0) && ((index > 1 ? 1 : 0) === s1);
    return [String(index > 1 ? 1 : 0), String(index % 2), ...outs.map(String), active ? "on" : ""];
  });
  return { title: "2-to-4", heads: ["S1", "S0", "Y0", "Y1", "Y2", "Y3"], lines };
}
