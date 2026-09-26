import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);
import { ACA_HOME, ACA_LABS, acaRoute } from "../../../data/acaLabs";
import {
  BOOTH_WIDTHS, actionLabel, bitsToHex, buildBooth, examplePair, formatBooth, fromBits, msbString, parseBooth, signedRange, toBits, viewAt,
  type BoothAction, type BoothBit, type BoothRadix, type BoothStep, type BoothTrace,
} from "../../../engines/digital/booth";
import { ArithmeticFlow } from "../animation/arithmeticViews";
import { useGuideFocus } from "../guide/focus";
import { LabChrome, Transport, usePlayback } from "./HazardLab";

const TABS = [
  { id: "simulate", label: "Simulate" },
  { id: "steps", label: "Steps" },
  { id: "registers", label: "Registers" },
  { id: "learn", label: "Learn" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const RULES: Array<{ q0: BoothBit; qMinus1: BoothBit; action: BoothAction }> = [
  { q0: 0, qMinus1: 0, action: "nop" },
  { q0: 0, qMinus1: 1, action: "add" },
  { q0: 1, qMinus1: 0, action: "sub" },
  { q0: 1, qMinus1: 1, action: "nop" },
];

export function BoothLab() {
  const { id: guideFocus, setId: setGuideFocus } = useGuideFocus();
  const [width, setWidth] = useState<(typeof BOOTH_WIDTHS)[number]>(4);
  const [radix, setRadix] = useState<BoothRadix>("signed");
  const [drafts, setDrafts] = useState(() => {
    const sample = examplePair(4);
    return [formatBooth(sample.m, "signed", 4), formatBooth(sample.q, "signed", 4)];
  });
  const [showValues, setShowValues] = useState(true);
  const [tab, setTab] = useState<TabId>("simulate");
  const [hoverId, setHoverId] = useState("");
  const [hoverCycle, setHoverCycle] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const boardRef = useRef<HTMLDivElement>(null);

  const parsedM = parseBooth(drafts[0] ?? "", radix, width);
  const parsedQ = parseBooth(drafts[1] ?? "", radix, width);
  const valid = parsedM.ok && parsedQ.ok;
  const mValue = parsedM.ok ? parsedM.value : 0;
  const qValue = parsedQ.ok ? parsedQ.value : 0;
  const trace = useMemo(() => (valid ? buildBooth({ width, m: mValue, q: qValue }) : null), [valid, width, mValue, qValue]);
  const play = usePlayback(trace?.width ?? 0);
  const shownCycle = hoverCycle ?? play.cycle;
  const view = trace ? viewAt(trace, shownCycle) : null;
  const index = ACA_LABS.findIndex((item) => item.id === "booth-multiplier");
  const previous = ACA_LABS[index - 1];
  const range = signedRange(width);

  useEffect(() => {
    play.setPlaying(false);
    play.setCycle(0);
    setHoverCycle(null);
  }, [width, mValue, qValue, valid]);

  useGSAP(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.fromTo("[data-booth-active='1']", { opacity: 0.45 }, { opacity: 1, duration: 0.35, ease: "power1.out" });
  }, { scope: boardRef, dependencies: [view?.cycle, view?.step?.action], revertOnUpdate: true });

  function commitWidth(next: (typeof BOOTH_WIDTHS)[number]) {
    if (valid) {
      const nextRange = signedRange(next);
      const clamp = (value: number) => Math.max(nextRange.min, Math.min(nextRange.max, value));
      setDrafts([formatBooth(clamp(mValue), radix, next), formatBooth(clamp(qValue), radix, next)]);
    }
    setWidth(next);
    setNote("");
  }

  function setRadixAndFormat(next: BoothRadix) {
    if (valid) setDrafts([formatBooth(mValue, next, width), formatBooth(qValue, next, width)]);
    setRadix(next);
  }

  function writePair(m: number, q: number) {
    setDrafts([formatBooth(m, radix, width), formatBooth(q, radix, width)]);
    setNote("");
  }

  function negate(which: "m" | "q") {
    const value = which === "m" ? mValue : qValue;
    if (!valid) return;
    if (value === range.min) {
      setNote(`Negating ${value} does not fit in ${width} bits. The minimum value has no positive counterpart at this width.`);
      return;
    }
    const next = -value;
    setDrafts((pair) => pair.map((item, slot) => (slot === (which === "m" ? 0 : 1) ? formatBooth(next, radix, width) : item)));
    setNote("");
  }

  function restore() {
    const sample = examplePair(4);
    setWidth(4);
    setRadix("signed");
    setDrafts([formatBooth(sample.m, "signed", 4), formatBooth(sample.q, "signed", 4)]);
    setShowValues(true);
    setNote("");
    setHoverId("");
    setGuideFocus("");
    play.setSpeed(1);
    play.reset();
  }

  const pending = trace && view?.step === null ? trace.steps[0] : null;
  const activeQ0 = view?.step?.q0 ?? pending?.q0 ?? 0;
  const activeQm1 = view?.step?.qMinus1Before ?? pending?.qMinus1Before ?? 0;
  const activeAction = view?.step?.action ?? pending?.action ?? "nop";
  const hint = trace
    ? `${trace.additions} additions, ${trace.subtractions} subtractions, ${trace.noOps} no-operation cycles. Product ${trace.product}.`
    : "Fix the highlighted operand before Booth's algorithm can run.";
  const reading = trace ? `${trace.m} × ${trace.q} = ${trace.product}.` : "Inputs are incomplete.";

  return (
    <LabChrome lab="booth-multiplier" kicker="Lab 34" title="Booth's Multiplier" subtitle="Multiply signed two's-complement numbers with Booth's bit-pair rule, then arithmetic-right-shift A, Q, and Q−1." badge="Signed" hint={hint} reading={reading}>
      <div className="wt-tabs" role="tablist" aria-label="Booth multiplier sections">
        {TABS.map((item) => (
          <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} className={tab === item.id ? "on" : ""} onClick={() => setTab(item.id)}>{item.label}</button>
        ))}
      </div>
      <div className="wt-config">
        <section className="wt-card" aria-label="Booth configuration">
          <h2>Configuration</h2>
          <label>Operand width
            <select aria-label="Operand width" value={width} onChange={(event) => commitWidth(Number(event.target.value) as (typeof BOOTH_WIDTHS)[number])}>
              {BOOTH_WIDTHS.map((item) => <option key={item} value={item}>{item}-bit</option>)}
            </select>
          </label>
          <label>Input mode
            <select aria-label="Input mode" value={String(radix)} onChange={(event) => setRadixAndFormat(event.target.value === "signed" ? "signed" : Number(event.target.value) as 2 | 16)}>
              <option value="signed">Signed decimal</option>
              <option value="2">Binary</option>
              <option value="16">Hexadecimal</option>
            </select>
          </label>
          <p>Valid range {range.min} to +{range.max}. Product width {width * 2} bits.</p>
          <label className="wt-check"><input type="checkbox" checked={showValues} onChange={(event) => setShowValues(event.target.checked)} /> Show signal values</label>
        </section>
        <section className={`wt-card ${guideFocus === "operands" ? "aca-guide-on" : ""}`} data-focus="operands" aria-label="Signed operands">
          <h2>Inputs</h2>
          <Operand name="M" role="Multiplicand" draft={drafts[0] ?? ""} parsed={parsedM} width={width} onChange={(text) => setDrafts((pair) => [text, pair[1] ?? ""])} />
          <Operand name="Q" role="Multiplier" draft={drafts[1] ?? ""} parsed={parsedQ} width={width} onChange={(text) => setDrafts((pair) => [pair[0] ?? "", text])} />
          {note ? <p className="wt-error" role="status">{note}</p> : null}
          <div className="wt-actions">
            <button type="button" onClick={() => writePair(range.min + Math.floor(Math.random() * (range.max - range.min + 1)), range.min + Math.floor(Math.random() * (range.max - range.min + 1)))}>Random</button>
            <button type="button" onClick={() => valid && writePair(qValue, mValue)}>Swap</button>
            <button type="button" onClick={() => negate("m")}>Negate M</button>
            <button type="button" onClick={() => negate("q")}>Negate Q</button>
            <button type="button" onClick={() => { setDrafts(["", ""]); setNote(""); }}>Clear</button>
            <button type="button" onClick={() => { const sample = examplePair(width); writePair(sample.m, sample.q); }}>Example</button>
          </div>
        </section>
      </div>
      {trace?.error ? <p className="wt-error" role="alert">{trace.error}</p> : null}
      {!valid ? <p className="wt-error" role="alert">Enter a value inside {range.min} to +{range.max}. Binary and hexadecimal are read as two's-complement bit patterns.</p> : null}
      {trace && view && tab !== "learn" ? (
        <ArithmeticFlow
          stages={[
            { icon: "register", label: "Inspect Q0 Q−1", tip: "Q0 and Q−1 select the Booth operation." },
            { icon: "execute", label: "Add or subtract", tip: "01 adds M. 10 subtracts M. 00 and 11 do nothing." },
            { icon: "forward", label: "Arithmetic shift", tip: "The sign bit of A is copied, and Q0 moves into Q−1." },
            { icon: "writeback", label: "Product", tip: "The product is the pair A, Q." },
          ]}
          index={view.cycle === 0 ? 0 : view.cycle >= trace.width ? 3 : view.step?.action === "nop" ? 2 : 1}
          note={view.cycle >= trace.width ? `Product ${trace.product} is the pair A, Q.` : view.step ? `${actionLabel(view.step.action)} for ${view.step.q0}${view.step.qMinus1Before}, then the sign bit is copied on the arithmetic right shift.` : `Next pair is ${activeQ0}${activeQm1}. ${actionLabel(activeAction)}.`}
          speed={play.speed}
          cycle={play.cycle}
        />
      ) : null}
      {trace && view && tab !== "learn" ? (
        <div ref={boardRef}>
          {tab !== "steps" ? (
            <Machine trace={trace} view={view} activeQ0={activeQ0} activeQm1={activeQm1} activeAction={activeAction} showValues={showValues} onHover={setHoverId} />
          ) : null}
          {hoverId ? <BitNote id={hoverId} width={width} /> : null}
          {tab !== "registers" ? <StepTable trace={trace} active={shownCycle} onHover={setHoverCycle} onSelect={(cycle) => { setHoverCycle(null); play.setCycle(cycle); }} /> : null}
          <SignedPanel trace={trace} a={view.a} q={view.q} focused={guideFocus === "results"} />
        </div>
      ) : null}
      {trace ? <Result trace={trace} focused={guideFocus === "results" || guideFocus === "stats"} /> : null}
      {tab === "learn" && trace ? <Learn trace={trace} /> : null}
      <p className="wt-nav">
        {previous ? <Link to={acaRoute(previous.slug)}>Previous: Lab {index} — {previous.title}</Link> : null}
        <Link to={ACA_HOME}>All virtual labs</Link>
      </p>
      <Transport
        playing={play.playing}
        speed={play.speed}
        onSpeed={play.setSpeed}
        onPlay={() => { setTab("simulate"); play.setPlaying((value) => !value); }}
        onBack={() => play.setCycle((value) => Math.max(0, value - 1))}
        onStep={() => play.setCycle((value) => Math.min(trace?.width ?? 0, value + 1))}
        onReset={() => { setGuideFocus(""); restore(); }}
      />
      <p className="vl-cycle">Cycle {view?.cycle ?? 0} of {trace?.width ?? 0}. Each step inspects Q0 and Q−1, applies the rule, then arithmetic-right-shifts.</p>
    </LabChrome>
  );
}

function Operand({ name, role, draft, parsed, width, onChange }: { name: string; role: string; draft: string; parsed: { ok: true; value: number } | { ok: false; error: string }; width: number; onChange: (text: string) => void }) {
  return (
    <label>{name} — {role}
      <input aria-label={`${name} value`} value={draft} onChange={(event) => onChange(event.target.value)} />
      <small>{parsed.ok ? `Signed ${parsed.value} · binary ${msbString(toBits(parsed.value, width))} · hex ${bitsToHex(toBits(parsed.value, width))}` : parsed.error}</small>
    </label>
  );
}

function Machine({ trace, view, activeQ0, activeQm1, activeAction, showValues, onHover }: {
  trace: BoothTrace;
  view: { cycle: number; a: BoothBit[]; q: BoothBit[]; qMinus1: BoothBit; step: BoothStep | null };
  activeQ0: BoothBit;
  activeQm1: BoothBit;
  activeAction: BoothAction;
  showValues: boolean;
  onHover: (id: string) => void;
}) {
  return (
    <section className="wt-card booth-machine" aria-label="Booth registers">
      <header className="wt-stage">
        <h2>Booth datapath · cycle {view.cycle} of {trace.width}</h2>
      </header>
      <div className="booth-reg">
        <BitGroup label="A" bits={view.a} prefix="a" showValues={showValues} onHover={onHover} />
        <BitGroup label="Q" bits={view.q} prefix="q" showValues={showValues} onHover={onHover} />
        <BitGroup label="Q−1" bits={[view.qMinus1]} prefix="qm" showValues={showValues} onHover={onHover} />
      </div>
      <div className="booth-reg">
        <BitGroup label="M" bits={trace.mBits} prefix="m" showValues={showValues} onHover={onHover} />
        <div>
          <BitGroup label="−M" bits={trace.negM} prefix="neg" showValues={showValues} onHover={onHover} />
          {trace.negMFits ? null : <p>−M is {trace.negMValue}. It needs {trace.width + 1} bits because +{2 ** (trace.width - 1)} does not fit in {trace.width} bits.</p>}
        </div>
      </div>
      <div className="wt-config">
        <section className="wt-card" aria-label="Booth decision" data-booth-active={view.step ? "1" : "0"}>
          <h2>Q0 Q−1</h2>
          <p className="wt-mono">{activeQ0}{activeQm1}</p>
          <table>
            <thead><tr><th>Q0</th><th>Q−1</th><th>Operation</th></tr></thead>
            <tbody>
              {RULES.map((rule) => {
                const on = rule.q0 === activeQ0 && rule.qMinus1 === activeQm1;
                return (
                  <tr key={`${rule.q0}${rule.qMinus1}`} className={on ? "on" : ""}>
                    <td>{rule.q0}</td>
                    <td>{rule.qMinus1}</td>
                    <td>{actionLabel(rule.action)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
        <section className="wt-card" aria-label="Arithmetic block" data-booth-active={activeAction === "nop" ? "0" : "1"}>
          <h2>Arithmetic</h2>
          <p>{actionLabel(activeAction)}</p>
          {activeAction === "nop" ? <p>00 and 11 sit inside a run of equal bits, so the arithmetic block is skipped. The shift still happens.</p> : null}
          {view.step && activeAction !== "nop" ? <p>After the operation, A holds {msbString(view.step.aAfterOp)} ({view.step.opValue}). Sign bit copied on the shift: {view.step.opSign}.</p> : null}
        </section>
        <section className="wt-card" aria-label="Arithmetic shift" data-booth-active={view.step ? "1" : "0"}>
          <h2>Arithmetic right shift</h2>
          {view.step ? (
            <>
              <p className="wt-mono">Before {msbString(view.step.aAfterOp)} {msbString(view.step.qBefore)} {view.step.q0}</p>
              <p className="wt-mono">After {msbString(view.step.aAfter)} {msbString(view.step.qAfter)} {view.step.qMinus1After}</p>
              <p>The sign bit is copied into A. A's least significant bit moves into Q. Q's least significant bit moves into Q−1.</p>
            </>
          ) : <p>Step once to shift A, Q, and Q−1 together.</p>}
        </section>
      </div>
    </section>
  );
}

function BitGroup({ label, bits, prefix, showValues, onHover }: { label: string; bits: BoothBit[]; prefix: string; showValues: boolean; onHover: (id: string) => void }) {
  const shown = bits.slice().reverse();
  return (
    <div>
      <p>{label}{showValues ? ` · ${fromBits(bits)}` : ""}</p>
      <div className="booth-bits">
        {shown.map((bit, display) => {
          const index = bits.length - 1 - display;
          const id = prefix === "qm" ? "qm1" : `${prefix}-${index}`;
          return (
            <button key={id} type="button" className={bit === 1 ? "booth-bit on" : "booth-bit"} data-bit={id} onMouseEnter={() => onHover(id)} onMouseLeave={() => onHover("")} onFocus={() => onHover(id)} onClick={() => onHover(id)}>{bit}</button>
          );
        })}
      </div>
    </div>
  );
}

function BitNote({ id, width }: { id: string; width: number }) {
  const note = describeBit(id, width);
  if (!note) return null;
  return (
    <section className="wt-card wt-inspect" aria-label="Bit inspection">
      <h2>{note.title}</h2>
      <p>{note.body}</p>
    </section>
  );
}

function describeBit(id: string, width: number): { title: string; body: string } | null {
  if (id === "qm1") return { title: "Q−1", body: "The bit shifted out of Q on the previous cycle. It is paired with Q0 to select the Booth operation." };
  const match = /^([a-z]+)-(\d+)$/.exec(id);
  if (!match) return null;
  const kind = match[1] ?? "";
  const index = Number(match[2] ?? "0");
  if (kind === "q" && index === 0) return { title: "Q0", body: "Least significant bit of Q. Used with Q−1 to select the Booth operation." };
  if (kind === "q" && index === width - 1) return { title: `Q${index}`, body: "Most significant bit of Q. It receives A's least significant bit on the arithmetic right shift." };
  if (kind === "q") return { title: `Q${index}`, body: "A multiplier bit. Each arithmetic right shift moves it one place toward Q−1." };
  if (kind === "a" && index === width - 1) return { title: "A sign bit", body: "Sign bit preserved during arithmetic right shift. The extra accumulator bit is copied into this position." };
  if (kind === "a" && index === 0) return { title: "A0", body: "Least significant bit of A. It moves into the most significant bit of Q on the shift." };
  if (kind === "a") return { title: `A${index}`, body: "An accumulator bit. It shifts one place toward A0." };
  if (kind === "m" && index === width - 1) return { title: "M sign bit", body: "Sign of the multiplicand. Addition and subtraction use a sign-extended copy of M." };
  if (kind === "m") return { title: `M${index}`, body: "A multiplicand bit. It is added to or subtracted from A when the Booth rule says so." };
  if (kind === "neg") return { title: `−M bit ${index}`, body: index === width ? "Extra bit used so negating the minimum negative value stays exact." : "A bit of the two's-complement negation of M." };
  return null;
}

function StepTable({ trace, active, onHover, onSelect }: { trace: BoothTrace; active: number; onHover: (cycle: number | null) => void; onSelect: (cycle: number) => void }) {
  return (
    <section className="wt-card booth-table" aria-label="Booth steps">
      <h2>Cycle table</h2>
      <table>
        <thead>
          <tr><th>Cycle</th><th>A</th><th>Q</th><th>Q−1</th><th>Q0 Q−1</th><th>Action</th><th>After operation</th><th>After shift</th></tr>
        </thead>
        <tbody>
          {trace.steps.map((step) => (
            <tr key={step.cycle} className={active === step.cycle ? "on" : ""} onMouseEnter={() => onHover(step.cycle)} onMouseLeave={() => onHover(null)} onClick={() => onSelect(step.cycle)}>
              <td>{step.cycle}</td>
              <td className="wt-mono">{msbString(step.aBefore)}</td>
              <td className="wt-mono">{msbString(step.qBefore)}</td>
              <td>{step.qMinus1Before}</td>
              <td className="wt-mono">{step.q0}{step.qMinus1Before}</td>
              <td>{actionLabel(step.action)}</td>
              <td className="wt-mono">{msbString(step.aAfterOp)} ({step.opValue})</td>
              <td className="wt-mono">{msbString(step.aAfter)} {msbString(step.qAfter)} {step.qMinus1After}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function SignedPanel({ trace, a, q, focused }: { trace: BoothTrace; a: BoothBit[]; q: BoothBit[]; focused: boolean }) {
  return (
    <section className={`wt-card ${focused ? "aca-guide-on" : ""}`} data-focus="results" aria-label="Signed interpretation">
      <h2>Signed interpretation</h2>
      <p>M binary {msbString(trace.mBits)} · signed {trace.m}</p>
      <p>Q binary {msbString(trace.qBits)} · signed {trace.q}</p>
      <p>Current A binary {msbString(a)} · signed {fromBits(a)}</p>
      <p>Current Q binary {msbString(q)} · signed {fromBits(q)}</p>
      <p>A,Q combined {msbString([...q, ...a])} · signed {fromBits([...q, ...a])}</p>
    </section>
  );
}

function Result({ trace, focused }: { trace: BoothTrace; focused: boolean }) {
  return (
    <div className={`wt-results ${focused ? "aca-guide-on" : ""}`}>
      <section className="wt-card" aria-label="Product">
        <h2>Product</h2>
        <p>{trace.m} × {trace.q} = {trace.product}</p>
        <p className="wt-mono">Binary {msbString(trace.productBits)}</p>
        <p className="wt-mono">Hex {bitsToHex(trace.productBits)}</p>
        <p>Product width {trace.width * 2} bits. Booth cycles {trace.width}.</p>
        {trace.error ? null : <p className="wt-correct">Correct</p>}
      </section>
      <section className={`wt-card ${focused ? "aca-guide-on" : ""}`} data-focus="stats" aria-label="Booth statistics">
        <h2>Statistics</h2>
        <p>Additions {trace.additions}</p>
        <p>Subtractions {trace.subtractions}</p>
        <p>No-operation cycles {trace.noOps}</p>
        <p>Arithmetic operations {trace.additions + trace.subtractions} of {trace.width} cycles</p>
      </section>
    </div>
  );
}

function Learn({ trace }: { trace: BoothTrace }) {
  const seven = buildBooth({ width: trace.width, m: 1, q: Math.min(signedRange(trace.width).max, 7) });
  const five = buildBooth({ width: trace.width, m: 1, q: Math.min(signedRange(trace.width).max, 5) });
  return (
    <div className="wt-learn">
      <section className="wt-card"><h2>Aim</h2><p>Understand Booth's algorithm for efficient signed binary multiplication.</p></section>
      <section className="wt-card"><h2>Principle</h2><p>Inspect the pair (Q0, Q−1) to identify transitions in runs of 1s, conditionally add or subtract the multiplicand, then arithmetic-right-shift the combined register.</p></section>
      <section className="wt-card">
        <h2>Procedure</h2>
        <ol>
          <li>Choose the operand width.</li>
          <li>Enter signed M and Q.</li>
          <li>Observe the two's-complement representation.</li>
          <li>Inspect Q0 and Q−1.</li>
          <li>Determine the Booth action.</li>
          <li>Perform add, subtract, or no operation.</li>
          <li>Arithmetic-right-shift A, Q, and Q−1.</li>
          <li>Repeat for n cycles.</li>
          <li>Read the final product from A,Q.</li>
        </ol>
      </section>
      <section className="wt-card">
        <h2>What to observe</h2>
        <ul>
          <li>Q0 and Q−1 choose the action.</li>
          <li>01 means add M.</li>
          <li>10 means subtract M.</li>
          <li>00 and 11 do no arithmetic, then the shift still runs.</li>
          <li>The sign bit of A is preserved by the arithmetic shift.</li>
          <li>A run of 1s can replace several additions with one subtract and one add.</li>
          <li>Negative values stay in two's complement, including the minimum value −{2 ** (trace.width - 1)}.</li>
        </ul>
      </section>
      <section className="wt-card">
        <h2>Experiment tasks</h2>
        <ol>
          <li>Compute 5 × 3.</li>
          <li>Compute −3 × 5.</li>
          <li>Compute 7 × −2.</li>
          <li>Compute −4 × −3.</li>
          <li>Compare multipliers 0111 and 0101 and count the arithmetic operations.</li>
          <li>Find an input whose consecutive 1s reduce the number of arithmetic operations.</li>
          <li>Test the minimum negative value.</li>
          <li>Compare Booth multiplication with shift-and-add.</li>
        </ol>
      </section>
      <section className="wt-card">
        <h2>Booth recoding</h2>
        <p>Multiplier {msbString(trace.qBits)} takes {trace.additions + trace.subtractions} arithmetic operations in this trace.</p>
        <p>0111 ({seven.q}) uses {seven.additions + seven.subtractions} arithmetic operations. 0101 ({five.q}) uses {five.additions + five.subtractions}. A string of 1s is handled at its boundaries: subtract where the string starts and add where it ends.</p>
        {trace.steps.map((step) => <p key={step.cycle} className="wt-mono">Cycle {step.cycle}: {step.q0}{step.qMinus1Before} → {actionLabel(step.action)}</p>)}
      </section>
      <section className="wt-card">
        <h2>Booth and shift-and-add</h2>
        <p>Booth multiplies signed two's-complement values. It recodes bit pairs, so a run of 1s can skip arithmetic cycles. It needs an adder that can also subtract, and every cycle ends with an arithmetic right shift.</p>
        <p>Shift-and-add is the simpler unsigned loop: test one multiplier bit, conditionally add, then shift. It does not recode runs of 1s. Booth is not faster for every pattern. Alternating bits can still ask for an operation on every cycle.</p>
      </section>
      <section className="wt-card">
        <h2>Booth and the combinational array</h2>
        <p>The array multiplier in Lab 33 is a parallel combinational network of AND gates and adder cells. It has no iterative cycles. This Booth machine reuses one adder for {trace.width} cycles and is the natural fit for signed operands.</p>
        <p><Link to={acaRoute("combinational-multipliers")}>Open Lab 33 — Combinational Multipliers</Link></p>
      </section>
    </div>
  );
}
