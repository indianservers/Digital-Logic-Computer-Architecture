import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);
import { ACA_HOME, ACA_LABS, acaRoute } from "../../../data/acaLabs";
import {
  MULTIPLIER_WIDTHS, buildArrayMultiplier, describeCell, examplePair, forwardCone, multiplierView, productCone, smallTruth, stepLimit,
  type AdderCell, type AndGate, type ArrayMultiplier, type MultBit, type OperandRadix,
} from "../../../engines/digital/arrayMultiplier";
import { binaryString, formatOperand, hexString, operandMax, parseOperand } from "../../../engines/digital/wallace";
import { ArithmeticFlow } from "../animation/arithmeticViews";
import { useGuideFocus } from "../guide/focus";
import { LabChrome, Transport, usePlayback } from "./HazardLab";

const TABS = [
  { id: "array", label: "Array Multiplier" },
  { id: "partial", label: "Partial Products" },
  { id: "simulate", label: "Simulation" },
  { id: "truth", label: "Truth Table" },
  { id: "learn", label: "Learn" },
] as const;

type TabId = (typeof TABS)[number]["id"];
type ViewMode = "schematic" | "partial" | "signals" | "compact";

export function ArrayMultiplierLab() {
  const { id: guideFocus, setId: setGuideFocus } = useGuideFocus();
  const [aWidth, setAWidth] = useState<(typeof MULTIPLIER_WIDTHS)[number]>(4);
  const [bWidth, setBWidth] = useState<(typeof MULTIPLIER_WIDTHS)[number]>(4);
  const [radix, setRadix] = useState<OperandRadix>(10);
  const [drafts, setDrafts] = useState(() => {
    const sample = examplePair(4, 4);
    return [formatOperand(sample.a, 10, 4), formatOperand(sample.b, 10, 4)];
  });
  const [viewMode, setViewMode] = useState<ViewMode>("schematic");
  const [tab, setTab] = useState<TabId>("array");
  const [selectedId, setSelectedId] = useState("");
  const [hoverId, setHoverId] = useState("");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 12, y: 8 });
  const boardRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const parsedA = parseOperand(drafts[0] ?? "", radix, aWidth);
  const parsedB = parseOperand(drafts[1] ?? "", radix, bWidth);
  const valid = parsedA.ok && parsedB.ok;
  const aValue = parsedA.ok ? parsedA.value : 0;
  const bValue = parsedB.ok ? parsedB.value : 0;
  const net = useMemo(
    () => (valid ? buildArrayMultiplier({ aWidth, bWidth, a: aValue, b: bValue }) : null),
    [valid, aWidth, bWidth, aValue, bValue],
  );
  const play = usePlayback(net ? stepLimit(net) : 0);
  const view = net ? multiplierView(net, play.cycle) : null;
  const focusId = hoverId || selectedId;
  const highlight = useMemo(() => new Set(net && focusId ? traceIds(net, focusId) : []), [net, focusId]);
  const index = ACA_LABS.findIndex((item) => item.id === "array-multiplier");
  const previous = ACA_LABS[index - 1];
  const next = ACA_LABS[index + 1];

  useEffect(() => {
    play.setPlaying(false);
    play.setCycle(0);
    setSelectedId("");
  }, [aWidth, bWidth, aValue, bValue, valid]);

  useEffect(() => {
    const frame = boardRef.current;
    const board = frame?.querySelector("svg");
    if (!frame || !(board instanceof SVGSVGElement)) return;
    const naturalW = board.width.baseVal.value || 1;
    const naturalH = board.height.baseVal.value || 1;
    if (frame.clientWidth < 40 || frame.clientHeight < 40) return;
    const scale = Math.min((frame.clientWidth - 8) / naturalW, (frame.clientHeight - 8) / naturalH);
    setZoom(Math.max(0.45, Math.min(1, scale)));
    setPan({ x: 4, y: 4 });
  }, [aWidth, bWidth, viewMode, tab]);

  useGSAP(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.fromTo("[data-am-new='1']", { opacity: 0.25 }, { opacity: 1, duration: 0.4, ease: "power1.out" });
    gsap.fromTo("[data-am-carry='1']", { strokeDashoffset: 16 }, { strokeDashoffset: 0, duration: 0.5, ease: "power1.out" });
  }, { scope: boardRef, dependencies: [view?.cycle, tab, viewMode], revertOnUpdate: true });

  function commitWidth(which: "a" | "b", next: (typeof MULTIPLIER_WIDTHS)[number]) {
    const current = which === "a" ? aValue : bValue;
    const ok = which === "a" ? parsedA.ok : parsedB.ok;
    if (ok) {
      setDrafts((pair) => pair.map((item, slot) => (slot === (which === "a" ? 0 : 1) ? formatOperand(Math.min(current, operandMax(next)), radix, next) : item)));
    }
    if (which === "a") setAWidth(next);
    else setBWidth(next);
  }

  function setRadixAndFormat(next: OperandRadix) {
    if (valid) setDrafts([formatOperand(aValue, next, aWidth), formatOperand(bValue, next, bWidth)]);
    setRadix(next);
  }

  function writePair(a: number, b: number) {
    setDrafts([formatOperand(a, radix, aWidth), formatOperand(b, radix, bWidth)]);
  }

  function fitBoard() {
    const frame = boardRef.current;
    const board = frame?.querySelector("svg");
    if (!frame || !(board instanceof SVGSVGElement) || frame.clientWidth < 40) {
      setZoom(1);
      setPan({ x: 12, y: 8 });
      return;
    }
    const naturalW = board.width.baseVal.value || 1;
    const naturalH = board.height.baseVal.value || 1;
    const scale = Math.min((frame.clientWidth - 8) / naturalW, (frame.clientHeight - 8) / naturalH);
    setZoom(Math.max(0.45, Math.min(1, scale)));
    setPan({ x: 4, y: 4 });
  }

  function restore() {
    const sample = examplePair(4, 4);
    setAWidth(4);
    setBWidth(4);
    setRadix(10);
    setViewMode("schematic");
    setDrafts([formatOperand(sample.a, 10, 4), formatOperand(sample.b, 10, 4)]);
    setZoom(1);
    setPan({ x: 12, y: 8 });
    setSelectedId("");
    setGuideFocus("");
    play.reset();
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (target.closest("[data-node], button, a, input, select")) return;
    drag.current = { x: event.clientX, y: event.clientY, px: pan.x, py: pan.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    setPan({ x: drag.current.px + event.clientX - drag.current.x, y: drag.current.py + event.clientY - drag.current.y });
  }

  const hint = net
    ? `${net.andCount} AND gates, ${net.halfAdders} half adders, ${net.fullAdders} full adders. ${net.depthExpression}.`
    : "Fix the highlighted operand before the array can be built.";
  const reading = net ? `Product ${net.product}. ${net.a} × ${net.b}.` : "Inputs are incomplete.";
  const showBoard = tab === "array" || tab === "simulate";

  return (
    <LabChrome lab="array-multiplier" kicker="Lab 33" title="Combinational Multipliers" subtitle="Build and explore combinational array multipliers using AND gates and adder cells." badge="Combinational" hint={hint} reading={reading}>
      <div className="wt-tabs" role="tablist" aria-label="Combinational multiplier sections">
        {TABS.map((item) => (
          <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} className={tab === item.id ? "on" : ""} onClick={() => setTab(item.id)}>{item.label}</button>
        ))}
      </div>
      <div className="wt-config">
        <section className="wt-card" aria-label="Multiplier configuration">
          <h2>Configuration</h2>
          <label>Multiplicand width
            <select aria-label="Multiplicand width" value={aWidth} onChange={(event) => commitWidth("a", Number(event.target.value) as (typeof MULTIPLIER_WIDTHS)[number])}>
              {MULTIPLIER_WIDTHS.map((item) => <option key={item} value={item}>{item}-bit</option>)}
            </select>
          </label>
          <label>Multiplier width
            <select aria-label="Multiplier width" value={bWidth} onChange={(event) => commitWidth("b", Number(event.target.value) as (typeof MULTIPLIER_WIDTHS)[number])}>
              {MULTIPLIER_WIDTHS.map((item) => <option key={item} value={item}>{item}-bit</option>)}
            </select>
          </label>
          <label>Signedness
            <select aria-label="Signedness" value="unsigned" onChange={() => undefined}>
              <option value="unsigned">Unsigned</option>
            </select>
          </label>
          <label>Input format
            <select aria-label="Input format" value={radix} onChange={(event) => setRadixAndFormat(Number(event.target.value) as OperandRadix)}>
              <option value={2}>Binary</option>
              <option value={10}>Decimal</option>
              <option value={16}>Hexadecimal</option>
            </select>
          </label>
          <label>View
            <select aria-label="View" value={viewMode} onChange={(event) => setViewMode(event.target.value as ViewMode)}>
              <option value="schematic">Schematic</option>
              <option value="partial">Partial Products</option>
              <option value="signals">Signal Values</option>
              <option value="compact">Compact</option>
            </select>
          </label>
        </section>
        <section className={`wt-card ${guideFocus === "operands" ? "aca-guide-on" : ""}`} data-focus="operands" aria-label="Input operands">
          <h2>Inputs</h2>
          <OperandField name="A" role="Multiplicand" width={aWidth} draft={drafts[0] ?? ""} radix={radix} parsed={parsedA} onChange={(text) => setDrafts((pair) => [text, pair[1] ?? ""])} />
          <OperandField name="B" role="Multiplier" width={bWidth} draft={drafts[1] ?? ""} radix={radix} parsed={parsedB} onChange={(text) => setDrafts((pair) => [pair[0] ?? "", text])} />
          <div className="wt-actions">
            <button type="button" onClick={() => writePair(Math.floor(Math.random() * (operandMax(aWidth) + 1)), Math.floor(Math.random() * (operandMax(bWidth) + 1)))}>Random</button>
            <button type="button" onClick={() => setDrafts((pair) => [formatOperand(0, radix, aWidth), pair[1] ?? ""])}>A = 0</button>
            <button type="button" onClick={() => setDrafts((pair) => [pair[0] ?? "", formatOperand(0, radix, bWidth)])}>B = 0</button>
            <button type="button" onClick={() => writePair(operandMax(aWidth), operandMax(bWidth))}>Max</button>
            <button type="button" onClick={() => setDrafts(["", ""])}>Clear</button>
            <button type="button" onClick={() => { const sample = examplePair(aWidth, bWidth); writePair(sample.a, sample.b); }}>Example</button>
          </div>
        </section>
      </div>
      {net && view && tab !== "truth" && tab !== "learn" ? (
        <ArithmeticFlow
          stages={[
            { icon: "execute", label: "AND gates", tip: "Each AND forms one partial-product bit." },
            { icon: "register", label: "Adder rows", tip: "Half adders and full adders add the partial-product rows." },
            { icon: "writeback", label: "Product", tip: "The product bits leave the bottom of the array." },
          ]}
          index={view.product ? 2 : view.rows > 0 ? 1 : view.ands ? 0 : -1}
          note={view.product ? `Product ${net.product} is on the output bits.` : view.rows > 0 ? `Adder row ${view.rows} is adding partial products.` : view.ands ? "AND gates form one partial-product bit for every multiplicand and multiplier pair." : "Step once to form the AND partial products."}
          speed={play.speed}
          cycle={play.cycle}
        />
      ) : null}
      {showBoard && net && view ? (
        <ArrayBoard
          net={net}
          view={view}
          viewMode={viewMode}
          highlight={highlight}
          selectedId={selectedId}
          zoom={zoom}
          pan={pan}
          boardRef={boardRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={() => { drag.current = null; }}
          onZoom={(next) => setZoom(Math.min(2.4, Math.max(0.45, next)))}
          onFit={fitBoard}
          onResetView={() => { setZoom(1); setPan({ x: 12, y: 8 }); }}
          onSelect={setSelectedId}
          onHover={setHoverId}
        />
      ) : null}
      {net?.error ? <p className="wt-error" role="alert">{net.error}</p> : null}
      {!valid ? <p className="wt-error" role="alert">Enter a value that fits the selected width and representation. The diagram is shown when both operands parse.</p> : null}
      {net && focusId ? <Inspect net={net} id={focusId} /> : null}
      {net ? <Results net={net} focused={guideFocus === "results" || guideFocus === "stats"} /> : null}
      {tab === "partial" && net ? <PartialView net={net} highlight={highlight} onSelect={setSelectedId} onHover={setHoverId} /> : null}
      {tab === "truth" ? <Truth aWidth={aWidth} bWidth={bWidth} /> : null}
      {tab === "learn" && net ? <Learn net={net} /> : null}
      <p className="wt-nav">
        {previous ? <Link to={acaRoute(previous.slug)}>Previous: Lab {index} — {previous.title}</Link> : null}
        <Link to={ACA_HOME}>All virtual labs</Link>
        {next ? <Link to={acaRoute(next.slug)}>Next: Lab {index + 2} — {next.title}</Link> : null}
      </p>
      <Transport
        playing={play.playing}
        speed={play.speed}
        onSpeed={play.setSpeed}
        onPlay={() => { setTab("simulate"); play.setPlaying((value) => !value); }}
        onBack={() => play.setCycle((value) => Math.max(0, value - 1))}
        onStep={() => play.setCycle((value) => Math.min(net ? stepLimit(net) : 0, value + 1))}
        onReset={() => { setGuideFocus(""); restore(); }}
      />
      <p className="vl-cycle">Visualization step {view?.cycle ?? 0} / {net ? stepLimit(net) : 0}. These steps reveal the network. The circuit itself is combinational.</p>
    </LabChrome>
  );
}

function OperandField({ name, role, width, draft, radix, parsed, onChange }: { name: string; role: string; width: number; draft: string; radix: OperandRadix; parsed: { ok: true; value: number } | { ok: false; error: string }; onChange: (text: string) => void }) {
  return (
    <label>{name} — {role} ({width}-bit)
      <input aria-label={`${name} value`} value={draft} onChange={(event) => onChange(event.target.value)} />
      <small>{parsed.ok ? `Entered ${draft || "0"} · binary ${formatOperand(parsed.value, 2, width)} · decimal ${parsed.value}` : parsed.error}</small>
      {parsed.ok && radix !== 10 ? <small>Decimal {parsed.value}</small> : null}
    </label>
  );
}

function traceIds(net: ArrayMultiplier, id: string): string[] {
  if (id.startsWith("a-")) return forwardCone(net, { a: Number(id.slice(2)) });
  if (id.startsWith("b-")) return forwardCone(net, { b: Number(id.slice(2)) });
  if (id.startsWith("and-")) return forwardCone(net, { andId: id });
  if (id.startsWith("p-")) return productCone(net, Number(id.slice(2)));
  const cell = net.cells.find((item) => item.id === id);
  if (!cell) return [];
  const wires = new Set([cell.sumWireId, cell.carryWireId]);
  const ids = new Set<string>([cell.id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const other of net.cells) {
      if (other.inputs.some((item) => wires.has(item.wireId)) && !ids.has(other.id)) {
        ids.add(other.id);
        wires.add(other.sumWireId);
        wires.add(other.carryWireId);
        grew = true;
      }
    }
  }
  net.productWire.forEach((wire, bit) => { if (wires.has(wire)) ids.add(`p-${bit}`); });
  return [...ids];
}

function ArrayBoard({ net, view, viewMode, highlight, selectedId, zoom, pan, boardRef, onPointerDown, onPointerMove, onPointerUp, onZoom, onFit, onResetView, onSelect, onHover }: {
  net: ArrayMultiplier;
  view: { cycle: number; ands: boolean; rows: number; product: boolean };
  viewMode: ViewMode;
  highlight: Set<string>;
  selectedId: string;
  zoom: number;
  pan: { x: number; y: number };
  boardRef: RefObject<HTMLDivElement | null>;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: () => void;
  onZoom: (next: number) => void;
  onFit: () => void;
  onResetView: () => void;
  onSelect: (id: string) => void;
  onHover: (id: string) => void;
}) {
  const col = viewMode === "compact" ? 52 : 78;
  const row = viewMode === "compact" ? 70 : 100;
  const showText = viewMode === "signals" || viewMode === "schematic" || viewMode === "partial";
  const showAll = view.cycle === 0 || view.product;
  const width = 110 + Math.max(net.bWidth, net.productWidth) * col;
  const height = 78 + net.aWidth * row + 64;
  const xOf = (bIndex: number) => 92 + (net.bWidth - 1 - bIndex) * col;
  const yOf = (aIndex: number) => 52 + aIndex * row;
  return (
    <section className="wt-card" aria-label="Array multiplier schematic">
      <header className="wt-stage">
        <h2>{net.aWidth} × {net.bWidth} array</h2>
        <div className="wt-zoom">
          <button type="button" onClick={() => onZoom(zoom * 1.15)}>Zoom In</button>
          <button type="button" onClick={() => onZoom(zoom / 1.15)}>Zoom Out</button>
          <button type="button" onClick={onFit}>Fit</button>
          <button type="button" onClick={onResetView}>Reset View</button>
        </div>
      </header>
      <div className="wt-legend" aria-label="Legend">
        <span><i className="and" /> AND gate</span>
        <span><i className="ha" /> Half adder</span>
        <span><i className="fa" /> Full adder</span>
        <span><i className="cpa" /> Carry, dashed</span>
      </div>
      <div className="wt-viewport am-viewport" ref={boardRef} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={onPointerUp}>
        <svg className="aca-flow-svg wt-board" width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
          {net.bBits.map((_, bIndex) => (
            <g key={`b-${bIndex}`} data-node={`b-${bIndex}`} onClick={() => onSelect(`b-${bIndex}`)} onPointerEnter={() => onHover(`b-${bIndex}`)} onPointerLeave={() => onHover("")}>
              <text x={xOf(bIndex)} y={24} textAnchor="middle" fontSize="12" fill={highlight.has(`b-${bIndex}`) ? "#1d4ed8" : "#16324f"} fontWeight={700}>B{bIndex}</text>
            </g>
          ))}
          {net.aBits.map((_, aIndex) => (
            <g key={`a-${aIndex}`} data-node={`a-${aIndex}`} onClick={() => onSelect(`a-${aIndex}`)} onPointerEnter={() => onHover(`a-${aIndex}`)} onPointerLeave={() => onHover("")}>
              <text x={10} y={yOf(aIndex) + 4} textAnchor="start" fontSize="12" fill={highlight.has(`a-${aIndex}`) ? "#1d4ed8" : "#16324f"} fontWeight={700}>A{aIndex}</text>
            </g>
          ))}
          {net.cells.map((cell) => {
            const from = { x: xOf(cell.row), y: yOf(cell.column) + 28 };
            const sumTarget = net.cells.find((item) => item.inputs.some((input) => input.wireId === cell.sumWireId));
            const carryTarget = net.cells.find((item) => item.inputs.some((input) => input.wireId === cell.carryWireId));
            const live = showAll || cell.row <= view.rows;
            return (
              <g key={`${cell.id}-wires`} opacity={live ? 1 : 0.12}>
                {sumTarget ? <line x1={from.x} y1={from.y} x2={xOf(sumTarget.row)} y2={yOf(sumTarget.column)} stroke={highlight.has(cell.id) ? "#1d4ed8" : "#94a3b8"} strokeWidth={highlight.has(cell.id) ? 2.4 : 1.2} /> : null}
                {carryTarget ? <line data-am-carry={live ? "1" : "0"} x1={from.x + 10} y1={from.y} x2={xOf(carryTarget.row)} y2={yOf(carryTarget.column)} stroke="#b45309" strokeWidth={1.4} strokeDasharray="4 3" /> : null}
              </g>
            );
          })}
          {net.ands.map((gate) => (
            <AndNode key={gate.id} gate={gate} x={xOf(gate.bIndex)} y={yOf(gate.aIndex)} hot={highlight.has(gate.id) || selectedId === gate.id} dim={!showAll && !view.ands} fresh={view.cycle === 1} showText={showText} faded={viewMode === "compact"} onSelect={onSelect} onHover={onHover} />
          ))}
          {net.cells.map((cell) => (
            <CellNode key={cell.id} cell={cell} x={xOf(cell.row)} y={yOf(cell.column) + 36} hot={highlight.has(cell.id) || selectedId === cell.id} dim={!showAll && cell.row > view.rows} fresh={cell.row === view.rows && view.rows > 0} showText={showText} onSelect={onSelect} onHover={onHover} />
          ))}
          {net.productBits.map((bit, bitIndex) => {
            const x = 92 + (net.productWidth - 1 - bitIndex) * Math.min(col, 56);
            const y = 52 + net.aWidth * row + 8;
            const hot = highlight.has(`p-${bitIndex}`) || selectedId === `p-${bitIndex}`;
            return (
              <g key={`p-${bitIndex}`} data-node={`p-${bitIndex}`} opacity={showAll || view.product ? 1 : 0.35} onClick={() => onSelect(`p-${bitIndex}`)} onPointerEnter={() => onHover(`p-${bitIndex}`)} onPointerLeave={() => onHover("")}>
                <circle cx={x} cy={y} r={11} fill={bit ? "#1d4ed8" : "#e5e7eb"} stroke={hot ? "#1d4ed8" : "#94a3b8"} strokeWidth={hot ? 2.4 : 1} />
                <text x={x} y={y + 22} textAnchor="middle" fontSize="11" fill="#16324f">P{bitIndex}</text>
                {showText ? <text x={x} y={y + 4} textAnchor="middle" fontSize="11" fill={bit ? "#fff" : "#16324f"}>{bit}</text> : null}
              </g>
            );
          })}
        </svg>
      </div>
    </section>
  );
}

function AndNode({ gate, x, y, hot, dim, fresh, showText, faded, onSelect, onHover }: { gate: AndGate; x: number; y: number; hot: boolean; dim: boolean; fresh: boolean; showText: boolean; faded: boolean; onSelect: (id: string) => void; onHover: (id: string) => void }) {
  return (
    <g data-node={gate.id} data-am-new={fresh ? "1" : "0"} opacity={dim ? 0.35 : faded ? 0.9 : 1} onClick={() => onSelect(gate.id)} onPointerEnter={() => onHover(gate.id)} onPointerLeave={() => onHover("")}>
      <circle cx={x} cy={y} r={13} fill="#fff" stroke={hot ? "#1d4ed8" : "#2563eb"} strokeWidth={hot ? 2.6 : 1.5} />
      <text x={x} y={y + 4} textAnchor="middle" fontSize="12" fill="#16324f">{showText ? gate.value : "&"}</text>
    </g>
  );
}

function CellNode({ cell, x, y, hot, dim, fresh, showText, onSelect, onHover }: { cell: AdderCell; x: number; y: number; hot: boolean; dim: boolean; fresh: boolean; showText: boolean; onSelect: (id: string) => void; onHover: (id: string) => void }) {
  const label = cell.kind === "fa" ? "FA" : "HA";
  return (
    <g data-node={cell.id} data-am-new={fresh ? "1" : "0"} opacity={dim ? 0.35 : 1} onClick={() => onSelect(cell.id)} onPointerEnter={() => onHover(cell.id)} onPointerLeave={() => onHover("")}>
      {cell.kind === "ha"
        ? <ellipse cx={x} cy={y} rx={16} ry={11} fill="#dcfce7" stroke={hot ? "#166534" : "#16a34a"} strokeWidth={hot ? 2.4 : 1.3} />
        : <rect x={x - 16} y={y - 11} width={32} height={22} rx={6} fill="#dbeafe" stroke={hot ? "#1d4ed8" : "#60a5fa"} strokeWidth={hot ? 2.4 : 1.3} />}
      <text x={x} y={y + 4} textAnchor="middle" fontSize="10" fill="#16324f">{showText ? cell.sum : label}</text>
    </g>
  );
}

function Inspect({ net, id }: { net: ArrayMultiplier; id: string }) {
  const gate = net.ands.find((item) => item.id === id);
  if (gate) {
    return (
      <section className="wt-card wt-inspect" aria-label="AND gate inspection">
        <h2>AND gate</h2>
        <p>A{gate.aIndex} AND B{gate.bIndex}</p>
        <p>Output: {gate.value}</p>
        <p>Weight: 2^{gate.weight}</p>
      </section>
    );
  }
  const cell = net.cells.find((item) => item.id === id);
  if (cell) {
    const info = describeCell(cell);
    return (
      <section className="wt-card wt-inspect" aria-label="Adder inspection">
        <h2>{info.title}</h2>
        <p>Inputs: {info.inputs}</p>
        <p>Sum: {info.sum}</p>
        <p>Carry: {info.carry}</p>
        <p>Weight: 2^{cell.weight}</p>
      </section>
    );
  }
  if (id.startsWith("p-")) {
    const bit = Number(id.slice(2));
    return (
      <section className="wt-card wt-inspect" aria-label="Product bit inspection">
        <h2>Product bit P{bit}</h2>
        <p>Value: {net.productBits[bit] ?? 0}</p>
        <p>Weight: 2^{bit}</p>
        <p>Logic cone: {productCone(net, bit).length} nodes</p>
      </section>
    );
  }
  if (id.startsWith("a-") || id.startsWith("b-")) {
    const index = Number(id.slice(2));
    const bit = id.startsWith("a-") ? net.aBits[index] : net.bBits[index];
    return (
      <section className="wt-card wt-inspect" aria-label="Operand bit inspection">
        <h2>{id.startsWith("a-") ? `A${index}` : `B${index}`}</h2>
        <p>Value: {bit ?? 0}</p>
        <p>Connected AND gates: {forwardCone(net, id.startsWith("a-") ? { a: index } : { b: index }).filter((item) => item.startsWith("and-")).length}</p>
      </section>
    );
  }
  return null;
}

function Results({ net, focused }: { net: ArrayMultiplier; focused: boolean }) {
  const cone = largestCone(net);
  return (
    <div className={`wt-results ${focused ? "aca-guide-on" : ""}`} data-focus="results">
      <section className="wt-card" aria-label="Product">
        <h2>Product</h2>
        <p>{net.a} × {net.b} = {net.product}</p>
        <p className="wt-mono">A binary {binaryString(net.aBits)}</p>
        <p className="wt-mono">B binary {binaryString(net.bBits)}</p>
        <p className="wt-mono">Product binary {binaryString(net.productBits)}</p>
        <p className="wt-mono">Product hex {hexString(net.product)}</p>
        <p>Widths {net.aWidth} × {net.bWidth}. Product width {net.productWidth}.</p>
        {net.error ? null : <p className="wt-correct">Correct</p>}
      </section>
      <section className={`wt-card ${focused ? "aca-guide-on" : ""}`} data-focus="stats" aria-label="Statistics">
        <h2>Statistics</h2>
        <p>AND gates {net.andCount}</p>
        <p>Half adders {net.halfAdders}</p>
        <p>Full adders {net.fullAdders}</p>
        <p>Product width {net.productWidth}</p>
        <p>Logic depth {net.depth} estimated stages</p>
        <p>Longest carry path {Math.max(0, net.aWidth + net.bWidth - 2)} adder stages</p>
        <p>{net.depthExpression}</p>
        <p>Largest logic cone: P{cone.bit} ({cone.count} nodes)</p>
      </section>
    </div>
  );
}

function largestCone(net: ArrayMultiplier): { bit: number; count: number } {
  let best = { bit: 0, count: 0 };
  for (let bit = 0; bit < net.productWidth; bit += 1) {
    const count = productCone(net, bit).length;
    if (count > best.count) best = { bit, count };
  }
  return best;
}

function PartialView({ net, highlight, onSelect, onHover }: { net: ArrayMultiplier; highlight: Set<string>; onSelect: (id: string) => void; onHover: (id: string) => void }) {
  const bOrder = [...net.bBits.map((_, index) => index)].reverse();
  return (
    <div className="wt-config">
      <section className="wt-card" aria-label="Partial product matrix">
        <h2>AND matrix</h2>
        <table className="am-matrix">
          <thead>
            <tr>
              <th />
              {bOrder.map((bIndex) => <th key={bIndex}>B{bIndex}</th>)}
            </tr>
          </thead>
          <tbody>
            {net.aBits.map((_, aIndex) => (
              <tr key={aIndex}>
                <th>A{aIndex}</th>
                {bOrder.map((bIndex) => {
                  const gate = net.ands.find((item) => item.aIndex === aIndex && item.bIndex === bIndex);
                  const id = gate?.id ?? "";
                  return (
                    <td key={bIndex} className={highlight.has(id) ? "on" : ""}>
                      <button type="button" onClick={() => onSelect(id)} onMouseEnter={() => onHover(id)} onMouseLeave={() => onHover("")}>{gate?.value ?? 0}</button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="wt-card" aria-label="Shifted partial products">
        <h2>Shifted rows</h2>
        {net.rows.map((row) => (
          <p key={row.index} className="wt-mono">A × B{row.index} &lt;&lt; {row.shift}  {msb(row.bits)}{row.suppressed ? "  · zero row" : ""}</p>
        ))}
        <p className="wt-mono">Sum {msb(net.productBits)}</p>
      </section>
    </div>
  );
}

function msb(bits: MultBit[]): string {
  return bits.slice().reverse().join("");
}

function Truth({ aWidth, bWidth }: { aWidth: number; bWidth: number }) {
  const table = smallTruth(aWidth, bWidth);
  if (!table) {
    return (
      <section className="wt-card" aria-label="Truth table">
        <h2>Truth table</h2>
        <p>Truth table available only for small configurations because row count grows exponentially.</p>
      </section>
    );
  }
  return (
    <section className="wt-card" aria-label="Truth table">
      <h2>2 × 2 truth table</h2>
      <table>
        <thead>
          <tr><th>A1</th><th>A0</th><th>B1</th><th>B0</th><th>P3</th><th>P2</th><th>P1</th><th>P0</th></tr>
        </thead>
        <tbody>
          {table.map((row) => (
            <tr key={`${row.a}-${row.b}`}>
              <td>{(row.a >> 1) & 1}</td>
              <td>{row.a & 1}</td>
              <td>{(row.b >> 1) & 1}</td>
              <td>{row.b & 1}</td>
              <td>{row.product[3] ?? 0}</td>
              <td>{row.product[2] ?? 0}</td>
              <td>{row.product[1] ?? 0}</td>
              <td>{row.product[0] ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Learn({ net }: { net: ArrayMultiplier }) {
  return (
    <div className="wt-learn">
      <section className="wt-card">
        <h2>Aim</h2>
        <p>Understand a combinational binary multiplier built from AND gates and adders.</p>
      </section>
      <section className="wt-card">
        <h2>Principle</h2>
        <p>Each multiplicand bit is ANDed with each multiplier bit to generate partial products, which are then summed according to positional weight.</p>
      </section>
      <section className="wt-card">
        <h2>Procedure</h2>
        <ol>
          <li>Select widths.</li>
          <li>Enter A and B.</li>
          <li>Inspect the AND matrix.</li>
          <li>Observe generated partial products.</li>
          <li>Step through the adder array.</li>
          <li>Observe carry and sum propagation.</li>
          <li>Verify the product.</li>
          <li>Compare against shift-and-add.</li>
        </ol>
      </section>
      <section className="wt-card">
        <h2>What to observe</h2>
        <ul>
          <li>The number of AND gates is {net.andCount} for this width pair.</li>
          <li>The same cell pattern repeats down the array.</li>
          <li>Carry moves one weight higher.</li>
          <li>The product width is {net.productWidth} bits.</li>
          <li>A zero in B clears that partial-product row.</li>
          <li>Wider operands add AND gates and adder cells quickly.</li>
          <li>The array computes in parallel. Shift-and-add repeats one addition.</li>
        </ul>
      </section>
      <section className="wt-card">
        <h2>Experiment tasks</h2>
        <ol>
          <li>Multiply 1011 × 0110.</li>
          <li>Set B to a power of two and inspect the rows.</li>
          <li>Set one operand to zero.</li>
          <li>Set both operands to the maximum value.</li>
          <li>Compare 2×2, 4×4, and 8×8 architecture size.</li>
          <li>Find which product bit has the largest logic cone.</li>
          <li>Compare the array with shift-and-add.</li>
          <li>Compare the estimated depth with Wallace Tree reduction.</li>
        </ol>
      </section>
      <section className="wt-card">
        <h2>Array multiplier and shift-and-add</h2>
        <p>This array is a fixed combinational network: {net.andCount} AND gates and {net.halfAdders + net.fullAdders} adder cells. The product is available after the propagation described by {net.depthExpression}.</p>
        <p>Shift-and-add reuses one adder for {net.shiftAddSteps} sequential add-and-shift steps. It uses less hardware and spends those steps one after another. The adder studio’s multiply tab demonstrates that iterative method.</p>
      </section>
      <section className="wt-card">
        <h2>Array multiplier and Wallace tree</h2>
        <p>This array is regular and easy to lay out. Its carry path grows with the operand widths. A Wallace tree reduces the same partial-product rows with an irregular compressor tree. For these rows the Wallace reduction uses {net.wallaceLevels} level{net.wallaceLevels === 1 ? "" : "s"} before the final adder.</p>
        <p><Link to={acaRoute("wallace-tree-adder")}>Open Lab 32 — Wallace Tree Adder</Link></p>
        <p>Booth's multiplier, in the next lab, reuses one adder for a signed sequential algorithm instead of building this parallel array.</p>
        <p><Link to={acaRoute("booths-multiplier")}>Open Lab 34 — Booth's Multiplier</Link></p>
      </section>
    </div>
  );
}
