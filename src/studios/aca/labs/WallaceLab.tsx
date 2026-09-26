import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);
import { ACA_HOME, ACA_LABS, acaRoute } from "../../../data/acaLabs";
import {
  OPERAND_NAMES, WALLACE_COUNTS, WALLACE_WIDTHS, binaryString, buildWallace, describeCompressor, exampleValues,
  formatOperand, hexString, operandMax, parseOperand, playbackView,
  type FinalAdderKind, type OperandRadix, type WallaceCompressor, type WallaceTree,
} from "../../../engines/digital/wallace";
import { ArithmeticFlow } from "../animation/arithmeticViews";
import { useGuideFocus } from "../guide/focus";
import { LabChrome, Transport, usePlayback } from "./HazardLab";

const TABS = [
  { id: "build", label: "Build" },
  { id: "simulate", label: "Simulate" },
  { id: "truth", label: "Truth Table" },
  { id: "learn", label: "Learn" },
] as const;

type TabId = (typeof TABS)[number]["id"];
type Detail = "all" | "current" | "compact";

const INITIAL_VALUES = [25, 13, 7, 9];

export function WallaceLab() {
  const { id: guideFocus, setId: setGuideFocus } = useGuideFocus();
  const [width, setWidth] = useState<(typeof WALLACE_WIDTHS)[number]>(8);
  const [count, setCount] = useState(4);
  const [radix, setRadix] = useState<OperandRadix>(10);
  const [drafts, setDrafts] = useState(() => INITIAL_VALUES.map((value) => formatOperand(value, 10, 8)));
  const [finalAdder, setFinalAdder] = useState<FinalAdderKind>("cla");
  const [detail, setDetail] = useState<Detail>("all");
  const [showValues, setShowValues] = useState(true);
  const [tab, setTab] = useState<TabId>("build");
  const [selectedId, setSelectedId] = useState("");
  const [hoverId, setHoverId] = useState("");
  const [hoverStage, setHoverStage] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 12, y: 8 });
  const boardRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const parsed = drafts.slice(0, count).map((text) => parseOperand(text, radix, width));
  const valid = parsed.every((item) => item.ok);
  const numbers = parsed.map((item) => (item.ok ? item.value : 0));
  const tree = useMemo(
    () => (valid ? buildWallace({ width, values: numbers, finalAdder }) : null),
    [valid, width, finalAdder, numbers.join(",")],
  );
  const play = usePlayback(tree?.compressors.length ?? 0);
  const view = tree ? playbackView(tree, play.cycle) : null;
  const selected = tree?.compressors.find((item) => item.id === (selectedId || view?.active?.id || "")) ?? null;
  const hovered = tree?.compressors.find((item) => item.id === hoverId) ?? null;
  const index = ACA_LABS.findIndex((item) => item.id === "wallace-tree");
  const previous = ACA_LABS[index - 1];
  const next = ACA_LABS[index + 1];

  useEffect(() => {
    play.setPlaying(false);
    play.setCycle(0);
    setSelectedId("");
  }, [width, count, finalAdder, numbers.join(","), valid]);

  useEffect(() => {
    const frame = boardRef.current;
    const board = frame?.querySelector("svg");
    if (!frame || !(board instanceof SVGSVGElement)) return;
    const natural = board.width.baseVal.value || 1;
    if (frame.clientWidth < 40) return;
    setZoom(Math.max(0.45, Math.min(1, (frame.clientWidth - 8) / natural)));
    setPan({ x: 4, y: 4 });
  }, [width, count, tree?.levels, detail, tab]);

  useGSAP(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const active = view?.active?.id;
    if (!active) return;
    gsap.fromTo("[data-wt-active='1']", { opacity: 0.35 }, { opacity: 1, duration: 0.35, ease: "power1.out" });
    gsap.fromTo("[data-wt-carry='1']", { strokeDashoffset: 28 }, { strokeDashoffset: 0, duration: 0.45, ease: "power1.out" });
  }, { scope: boardRef, dependencies: [view?.active?.id, play.cycle], revertOnUpdate: true });

  function commitWidth(next: (typeof WALLACE_WIDTHS)[number]) {
    if (valid) setDrafts(numbers.map((value) => formatOperand(Math.min(value, operandMax(next)), radix, next)));
    setWidth(next);
  }

  function commitCount(next: number) {
    setCount(next);
    setDrafts((current) => {
      const sample = exampleValues(next, width);
      const filled = current.slice(0, next);
      while (filled.length < next) filled.push(formatOperand(sample[filled.length] ?? 0, radix, width));
      return filled;
    });
  }

  function commitRadix(next: OperandRadix) {
    if (!valid) return;
    setDrafts(numbers.map((value) => formatOperand(value, next, width)));
    setRadix(next);
  }

  function writeValues(values: number[]) {
    setDrafts(values.slice(0, count).map((value) => formatOperand(value & operandMax(width), radix, width)));
  }

  function restore() {
    setWidth(8);
    setCount(4);
    setRadix(10);
    setFinalAdder("cla");
    setDetail("all");
    setShowValues(true);
    setDrafts(INITIAL_VALUES.map((value) => formatOperand(value, 10, 8)));
    setZoom(1);
    setPan({ x: 12, y: 8 });
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

  const hint = tree
    ? `${tree.levels} Wallace ${tree.levels === 1 ? "level" : "levels"}, ${tree.fullAdders} full adders, ${tree.halfAdders} half adders. ${tree.delay.expression}.`
    : "Fix the highlighted operand before the tree can be built.";
  const reading = tree ? `Sum ${tree.sum}. ${tree.delay.expression}.` : "Inputs are incomplete.";

  return (
    <LabChrome lab="wallace-tree" kicker="Lab 32" title="Wallace Tree Adder" subtitle="Reduce multiple binary operands using a Wallace tree of 3:2 compressors and a final carry-propagate adder." badge="Combinational" hint={hint} reading={reading}>
      <div className="wt-tabs" role="tablist" aria-label="Wallace Tree sections">
        {TABS.map((item) => (
          <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} className={tab === item.id ? "on" : ""} onClick={() => setTab(item.id)}>{item.label}</button>
        ))}
      </div>
      {tab === "learn" ? <Learn /> : null}
      {tab !== "learn" ? (
        <>
          <div className="wt-config">
            <section className="wt-card" aria-label="Configuration">
              <h2>Parameters</h2>
              <label>Operand width
                <select aria-label="Operand width" value={width} onChange={(event) => commitWidth(Number(event.target.value) as (typeof WALLACE_WIDTHS)[number])}>
                  {WALLACE_WIDTHS.map((item) => <option key={item} value={item}>{item}-bit</option>)}
                </select>
              </label>
              <label>Number of operands
                <select aria-label="Number of operands" value={count} onChange={(event) => commitCount(Number(event.target.value))}>
                  {WALLACE_COUNTS.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label>Input representation
                <select aria-label="Input representation" value={radix} onChange={(event) => commitRadix(Number(event.target.value) as OperandRadix)}>
                  <option value={2}>Binary</option>
                  <option value={10}>Decimal</option>
                  <option value={16}>Hexadecimal</option>
                </select>
              </label>
              <label>Final adder
                <select aria-label="Final adder" value={finalAdder} onChange={(event) => setFinalAdder(event.target.value as FinalAdderKind)}>
                  <option value="ripple">Ripple Carry Adder</option>
                  <option value="cla">Carry Look-Ahead Adder</option>
                </select>
              </label>
              <label>Visualization detail
                <select aria-label="Visualization detail" value={detail} onChange={(event) => setDetail(event.target.value as Detail)}>
                  <option value="all">All stages</option>
                  <option value="current">Current stage</option>
                  <option value="compact">Compact view</option>
                </select>
              </label>
              <label className="wt-check"><input type="checkbox" checked={showValues} onChange={(event) => setShowValues(event.target.checked)} /> Show signal values</label>
            </section>
            <section className={`wt-card ${guideFocus === "operands" ? "aca-guide-on" : ""}`} data-focus="operands" aria-label="Input operands">
              <h2>Input operands</h2>
              <div className="wt-operands">
                {drafts.slice(0, count).map((draft, operand) => {
                  const name = OPERAND_NAMES[operand] ?? `Op${operand + 1}`;
                  const result = parsed[operand];
                  return (
                    <label key={name}>{name} ({width}-bit)
                      <input aria-label={`${name} value`} value={draft} onChange={(event) => setDrafts((current) => current.map((item, index) => index === operand ? event.target.value : item))} />
                      <small>{result?.ok ? `${radix === 10 ? "" : `${result.value} · `}${formatOperand(result.value, 2, width)}` : result?.error}</small>
                    </label>
                  );
                })}
              </div>
              <div className="wt-actions">
                <button type="button" onClick={() => writeValues(Array.from({ length: count }, () => Math.floor(Math.random() * (operandMax(width) + 1))))}>Random</button>
                <button type="button" onClick={() => setDrafts(Array.from({ length: count }, () => ""))}>Clear</button>
                <button type="button" onClick={() => writeValues(Array.from({ length: count }, () => 0))}>Zero</button>
                <button type="button" onClick={() => writeValues(Array.from({ length: count }, () => operandMax(width)))}>Maximum</button>
                <button type="button" onClick={() => writeValues(exampleValues(count, width))}>Example</button>
              </div>
            </section>
          </div>
          {tree && view && tab !== "truth" && tab !== "learn" ? (
            <ArithmeticFlow
              stages={[
                { icon: "register", label: "Operands", tip: "Each operand is one row of bits waiting to be reduced." },
                { icon: "execute", label: "Compress", tip: "A 3:2 or 2:2 compressor turns bits in one column into a sum and a carry." },
                { icon: "writeback", label: "Final adder", tip: "The last two rows are added by the carry-propagate adder." },
              ]}
              index={view.cycle === 0 ? 0 : view.finalActive ? 2 : 1}
              note={view.active ? `${describeCompressor(view.active).title}. The carry leaves for the next higher column.` : view.finalActive ? `The final adder produces ${tree.sum}.` : "Operands are loaded. Step to reduce the first column."}
              speed={play.speed}
              cycle={play.cycle}
            />
          ) : null}
          {tab !== "truth" && tree && view ? (
            <WallaceBoard
              tree={tree}
              viewCycle={view.cycle}
              activeId={hovered?.id || selected?.id || view.active?.id || ""}
              showValues={showValues}
              detail={detail}
              stageFocus={hoverStage ?? view.active?.stage ?? null}
              zoom={zoom}
              pan={pan}
              boardRef={boardRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={() => { drag.current = null; }}
              onZoom={(next) => setZoom(Math.min(2.4, Math.max(0.45, next)))}
              onFit={() => { setZoom(1); setPan({ x: 12, y: 8 }); }}
              onSelect={(id) => setSelectedId(id)}
              onHover={setHoverId}
            />
          ) : null}
          {tree?.error ? <p className="wt-error" role="alert">{tree.error}</p> : null}
          {!valid ? <p className="wt-error" role="alert">Enter a value that fits the selected width and representation. The diagram is shown when every operand parses.</p> : null}
          {selected ? <Inspect node={selected} /> : null}
          {tree ? <Results tree={tree} focused={guideFocus === "results" || guideFocus === "stats"} /> : null}
          {tab === "simulate" && tree ? <StageTable tree={tree} active={hoverStage ?? view?.active?.stage ?? null} onHover={setHoverStage} /> : null}
          {tab === "truth" && tree ? <Truth tree={tree} /> : null}
          {tab === "build" && tree ? <StageTable tree={tree} active={hoverStage ?? view?.active?.stage ?? null} onHover={setHoverStage} /> : null}
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
            onStep={() => play.setCycle((value) => Math.min(tree?.compressors.length ?? 0, value + 1))}
            onReset={() => { setGuideFocus(""); restore(); }}
          />
          <p className="vl-cycle">Step {view?.cycle ?? 0} / {tree?.compressors.length ?? 0}{view?.finalActive ? " · final adder" : ""}</p>
        </>
      ) : null}
    </LabChrome>
  );
}

function Inspect({ node }: { node: WallaceCompressor }) {
  const info = describeCompressor(node);
  return (
    <section className="wt-card wt-inspect" aria-label="Compressor inspection">
      <h2>{info.title}</h2>
      <p>Inputs: {info.inputs}</p>
      <p>Sum: {info.sum} · Carry: {info.carry}</p>
      <p>Column {info.column} · weight {info.weight} · stage {info.stage}</p>
      <p>{node.kind === "fa" ? "Sum = x XOR y XOR z. Carry = majority(x, y, z)." : "Sum = x XOR y. Carry = x AND y. The carry moves one column toward the higher weight."}</p>
    </section>
  );
}

function Results({ tree, focused }: { tree: WallaceTree; focused: boolean }) {
  return (
    <div className={`wt-results ${focused ? "aca-guide-on" : ""}`} data-focus="results">
      <section className="wt-card" aria-label="Results">
        <h2>Results</h2>
        {tree.values.map((value, index) => <p key={OPERAND_NAMES[index] ?? index}>{OPERAND_NAMES[index] ?? index} = {value} ({formatOperand(value, 2, tree.width)})</p>)}
        <p>Decimal sum {tree.sum}</p>
        <p>Binary {binaryString(tree.sumBits)}</p>
        <p>Hexadecimal {hexString(tree.sum)}</p>
        {tree.error ? null : <p className="wt-correct">Correct · {tree.values.join(" + ")} = {tree.sum}</p>}
      </section>
      <section className="wt-card" data-focus="stats" aria-label="Statistics">
        <h2>Statistics</h2>
        <p>Operand width {tree.width}-bit · {tree.count} operands</p>
        <p>Wallace levels {tree.levels}</p>
        <p>Full adders {tree.fullAdders} · Half adders {tree.halfAdders} · Compressors {tree.fullAdders + tree.halfAdders}</p>
        <p>Final adder {tree.finalAdder === "cla" ? "Carry look-ahead" : "Ripple carry"} · {tree.delay.finalLabel}</p>
        <p>Final-adder width {tree.resultWidth} bits</p>
        <p>Logical depth {tree.delay.expression}</p>
        <p>Estimated critical path {tree.delay.total} gate stages</p>
      </section>
      <section className="wt-card" aria-label="Comparison">
        <h2>Wallace vs serial ripple</h2>
        <p>Wallace reduction depth: {tree.levels} compressor {tree.levels === 1 ? "stage" : "stages"}, then one final adder.</p>
        <p>Serial ripple accumulation: {tree.count - 1} additions in series. {tree.delay.sequentialExpression}.</p>
        <p>These are estimated gate stages, not a silicon timing report.</p>
      </section>
    </div>
  );
}

function StageTable({ tree, active, onHover }: { tree: WallaceTree; active: number | null; onHover: (stage: number | null) => void }) {
  return (
    <details className="wt-card" open>
      <summary>Stage outputs — carry-save representation</summary>
      <table>
        <thead><tr><th>Level</th><th>Incoming bits by weight</th><th>Sum bits</th><th>Carry bits</th><th>Outgoing bits</th><th>Decimal</th></tr></thead>
        <tbody>
          {tree.stages.map((stage) => (
            <tr key={stage.index} className={active === stage.index ? "on" : ""} onMouseEnter={() => onHover(stage.index)} onMouseLeave={() => onHover(null)}>
              <td>{stage.index + 1}</td>
              <td className="wt-mono">{columnText(stage.before)}</td>
              <td className="wt-mono">{stage.compressors.map((item) => item.sum.value).join(" ") || "—"}</td>
              <td className="wt-mono">{stage.compressors.map((item) => item.carry.value).join(" ") || "—"}</td>
              <td className="wt-mono">{columnText(stage.after)}</td>
              <td>{stage.value}</td>
            </tr>
          ))}
          <tr className={active === tree.stages.length ? "on" : ""}>
            <td>Final</td>
            <td className="wt-mono">A {binaryString(tree.rowA)}</td>
            <td className="wt-mono">B {binaryString(tree.rowB)}</td>
            <td>—</td>
            <td className="wt-mono">{binaryString(tree.sumBits)}</td>
            <td>{tree.sum}</td>
          </tr>
        </tbody>
      </table>
    </details>
  );
}

function columnText(columns: WallaceTree["stages"][number]["before"]): string {
  return columns.map((column, weight) => `${weight}:${column.map((dot) => dot.value).join("") || "0"}`).reverse().join("  ");
}

function Truth({ tree }: { tree: WallaceTree }) {
  const rows = [0, 1].flatMap((x) => [0, 1].flatMap((y) => [0, 1].map((z) => ({
    x, y, z, sum: (x ^ y ^ z) & 1, carry: (x + y + z) >= 2 ? 1 : 0,
  }))));
  return (
    <div className="wt-results">
      <section className="wt-card">
        <h2>3:2 compressor truth</h2>
        <table>
          <thead><tr><th>x</th><th>y</th><th>z</th><th>Sum</th><th>Carry</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={`${row.x}${row.y}${row.z}`}><td>{row.x}</td><td>{row.y}</td><td>{row.z}</td><td>{row.sum}</td><td>{row.carry}</td></tr>)}</tbody>
        </table>
      </section>
      <section className="wt-card">
        <h2>This tree</h2>
        <table>
          <thead><tr><th>Stage</th><th>Kind</th><th>Column</th><th>Inputs</th><th>Sum</th><th>Carry</th></tr></thead>
          <tbody>
            {tree.compressors.map((node) => {
              const info = describeCompressor(node);
              return <tr key={node.id}><td>{info.stage}</td><td>{node.kind === "fa" ? "3:2" : "2:2"}</td><td>{info.column}</td><td>{info.inputs}</td><td>{info.sum}</td><td>{info.carry}</td></tr>;
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Learn() {
  return (
    <div className="wt-learn">
      <section className="wt-card"><h2>Aim</h2><p>Understand Wallace tree compression for fast multi-operand addition.</p></section>
      <section className="wt-card"><h2>Principle</h2><p>Bits of equal weight are reduced with full adders until two rows remain. A full adder keeps the sum in the same column and sends the carry one column left, toward the next higher weight. A half adder does the same for a leftover pair.</p></section>
      <section className="wt-card"><h2>Procedure</h2><ol><li>Choose the operand width and the number of operands.</li><li>Enter values, or load Example, Random, Zero, or Maximum.</li><li>Read the aligned bit columns.</li><li>Run or step through each compressor.</li><li>Watch the sum stay in its column and the carry move to the next weight.</li><li>Inspect the two rows that remain.</li><li>Compare ripple and carry look-ahead as the final adder.</li></ol></section>
      <section className="wt-card"><h2>What to observe</h2><ul><li>Which columns need a compressor.</li><li>Why a carry moves one column toward the higher weight.</li><li>How many levels eight operands need.</li><li>How width changes the number of columns, and how operand count changes the depth.</li><li>Why the tree is shallower than adding the operands one ripple adder at a time.</li></ul></section>
      <section className="wt-card"><h2>Experiment tasks</h2><ol><li>Compare 3 operands with 8 operands at the same width.</li><li>Compare 4-bit operands with 16-bit operands.</li><li>Load Maximum and find a column that emits several carries.</li><li>Switch the final adder between ripple and carry look-ahead and read the depth line.</li><li>Count the Wallace levels for eight operands.</li></ol></section>
      <section className="wt-card"><h2>Where the rows come from</h2><p>A multiplier produces one partial-product row for each multiplier bit. Wallace reduction is one way to add those rows. The combinational array in the next lab adds the same kind of rows with a regular grid of half adders and full adders.</p><p><Link to={acaRoute("combinational-multipliers")}>Open Lab 33 — Combinational Multipliers</Link></p></section>
    </div>
  );
}

function WallaceBoard({
  tree, viewCycle, activeId, showValues, detail, stageFocus, zoom, pan, boardRef,
  onPointerDown, onPointerMove, onPointerUp, onZoom, onFit, onSelect, onHover,
}: {
  tree: WallaceTree;
  viewCycle: number;
  activeId: string;
  showValues: boolean;
  detail: Detail;
  stageFocus: number | null;
  zoom: number;
  pan: { x: number; y: number };
  boardRef: RefObject<HTMLDivElement | null>;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: () => void;
  onZoom: (next: number) => void;
  onFit: () => void;
  onSelect: (id: string) => void;
  onHover: (id: string) => void;
}) {
  const cols = Math.max(tree.rowA.length, tree.width);
  const colW = 48;
  const xOf = (column: number) => 36 + (cols - 1 - column) * colW;
  const inputTop = 28;
  const stageTop = inputTop + tree.count * 18 + 36;
  const lane = 78;
  const shown = tree.compressors.filter((node) => {
    if (detail === "compact") return false;
    if (detail === "current" && stageFocus !== null) return node.stage === stageFocus;
    return true;
  });
  const height = stageTop + Math.max(tree.levels, 1) * lane + 90;
  const widthPx = 48 + cols * colW;
  return (
    <section className={`wt-card wt-stage ${detail === "compact" ? "compact" : ""}`} aria-label="Wallace tree structure">
      <header>
        <h2>Wallace tree ({tree.width}-bit, {tree.count} operands)</h2>
        <div className="wt-zoom">
          <button type="button" onClick={() => onZoom(zoom + 0.15)} aria-label="Zoom in">Zoom in</button>
          <button type="button" onClick={() => onZoom(zoom - 0.15)} aria-label="Zoom out">Zoom out</button>
          <button type="button" onClick={onFit}>Fit</button>
          <button type="button" onClick={onFit}>Reset view</button>
        </div>
      </header>
      <div className="wt-viewport" ref={boardRef} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
        <svg className="aca-flow-svg wt-board" width={widthPx} height={height} viewBox={`0 0 ${widthPx} ${height}`} style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }} role="img" aria-label="Wallace tree of compressors">
          {tree.values.map((value, operand) => (
            <g key={operand}>
              <text x={6} y={inputTop + operand * 18} fontSize="12" fill="#16324f">{OPERAND_NAMES[operand]}</text>
              {Array.from({ length: tree.width }, (_, column) => (
                <text key={column} x={xOf(column)} y={inputTop + operand * 18} textAnchor="middle" fontSize="11" fill={((value >> column) & 1) === 1 ? "#1d4ed8" : "#667085"}>{(value >> column) & 1}</text>
              ))}
            </g>
          ))}
          {shown.map((node) => {
            const info = describeCompressor(node);
            const pile = shown.filter((item) => item.stage === node.stage && item.column === node.column).indexOf(node);
            const x = xOf(node.column);
            const y = stageTop + node.stage * lane + pile * 34;
            const on = node.id === activeId;
            const done = tree.compressors.indexOf(node) < viewCycle;
            const nextY = y + lane - 8;
            return (
              <g key={node.id} data-node={node.id} data-wt-active={on ? "1" : "0"} className={on ? "wt-hot" : done ? "wt-done" : ""}>
                <line data-wire="sum" x1={x} y1={y + 16} x2={x} y2={nextY} stroke={on ? "#2563eb" : "#94a3b8"} strokeWidth={on ? 2.4 : 1.4} />
                <line data-wire="carry" data-wt-carry={on ? "1" : "0"} x1={x + 8} y1={y + 12} x2={xOf(node.column + 1)} y2={nextY} stroke={on ? "#c2410c" : "#64748b"} strokeWidth={on ? 2.2 : 1.3} strokeDasharray="4 3" />
                <title>{`${info.title}. Inputs ${info.inputs}. Sum ${info.sum}. Carry ${info.carry}. Column ${info.column}. Stage ${info.stage}. Weight ${info.weight}.`}</title>
                {node.kind === "fa" ? (
                  <rect x={x - 16} y={y - 14} width={36} height={28} rx={7} fill={on ? "#bfdbfe" : "#dbeafe"} stroke="#60a5fa" />
                ) : (
                  <ellipse cx={x} cy={y} rx={18} ry={14} fill={on ? "#bbf7d0" : "#dcfce7"} stroke="#16a34a" />
                )}
                <text x={x} y={y + 4} textAnchor="middle" fontSize="11" fill="#1e3a8a">{node.kind === "fa" ? "3:2" : "2:2"}</text>
                {showValues ? <text x={x} y={y + 28} textAnchor="middle" fontSize="10" fill="#334155">{info.inputs} → {info.sum}/{info.carry}</text> : null}
                <rect x={x - 18} y={y - 16} width={40} height={32} fill="transparent" tabIndex={0} role="button" aria-label={`${info.title}, column ${info.column}, stage ${info.stage}, inputs ${info.inputs}, sum ${info.sum}, carry ${info.carry}`} onClick={() => onSelect(node.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(node.id); } }} onMouseEnter={() => onHover(node.id)} onMouseLeave={() => onHover("")} style={{ cursor: "pointer" }} />
              </g>
            );
          })}
          <text x={8} y={stageTop + tree.levels * lane - 8} fontSize="12" fill="#16324f">Final rows</text>
          <text x={78} y={stageTop + tree.levels * lane - 8} fontSize="12" fill="#334155">{binaryString(tree.rowA)} + {binaryString(tree.rowB)}</text>
          <rect x={24} y={stageTop + tree.levels * lane} width={Math.max(160, widthPx - 48)} height={36} rx={8} fill={viewCycle >= tree.compressors.length ? "#ddd6fe" : "#f5f3ff"} stroke="#7c3aed" />
          <text x={widthPx / 2} y={stageTop + tree.levels * lane + 23} textAnchor="middle" fontSize="13" fill="#5b21b6">{tree.finalAdder === "cla" ? "Final adder · carry look-ahead" : "Final adder · ripple carry"} {showValues ? binaryString(tree.sumBits) : ""}</text>
        </svg>
      </div>
      <div className="wt-legend" aria-label="Legend">
        <span><i className="fa" /> 3:2 full adder — sum stays in the column, carry uses a dashed wire</span>
        <span><i className="ha" /> 2:2 half adder — same sum and carry rule for two bits</span>
        <span><i className="cpa" /> Final carry-propagate adder</span>
      </div>
    </section>
  );
}
