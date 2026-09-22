import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, ExplainBar, Segmented } from "../../design-system/ui";
import { addSub, alu, carryLookahead, carrySelect, compareMagnitude, decrement, divideSteps, fullAdder, fullSubtractor, halfAdder, halfSubtractor, increment, multiplySteps, rippleAdd, shiftVector, type AluOp, type ShiftKind } from "../../engines/digital/arithmetic";
import { toBinary, toUnsigned } from "../../engines/digital/vector";
import { StudioFrame } from "../../layout/StudioFrame";
import { usePrefs } from "../../store/prefs";
import { BitSwitch, ValueReadout, WordEditor } from "../shared/widgets";

const TABS = [
  { id: "half", label: "Half & Full" },
  { id: "multi", label: "Multi-bit" },
  { id: "sub", label: "Subtraction" },
  { id: "cmp", label: "Comparator" },
  { id: "shift", label: "Shifter" },
  { id: "alu", label: "ALU" },
  { id: "mul", label: "Multiply / Divide" },
];

export function AdderStudio() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "half";
  const [resetKey, setResetKey] = useState(0);
  return (
    <StudioFrame icon="bolt" title="Adders, Subtractors & Arithmetic" description="Change a bit and watch the sum, carry, flags, or partial products move." tabs={TABS} tab={tab} onTab={(id) => setParams({ tab: id })} onReset={() => setResetKey((n) => n + 1)} guide={["Toggle A and B on the half adder", "Widen the ripple adder and watch the carry walk", "Switch ADD to SUB and see B invert", "Step a binary multiply"]} takeaways={["Sum is XOR. Carry is AND.", "Ripple delay grows with width. Look-ahead does not wait for every stage.", "Carry and signed overflow are different flags."] }>
      <div key={resetKey}>
        {tab === "half" ? <HalfFull /> : null}
        {tab === "multi" ? <Multi /> : null}
        {tab === "sub" ? <SubLab /> : null}
        {tab === "cmp" ? <CmpLab /> : null}
        {tab === "shift" ? <ShiftLab /> : null}
        {tab === "alu" ? <AluLab /> : null}
        {tab === "mul" ? <MulLab /> : null}
      </div>
    </StudioFrame>
  );
}

function HalfFull() {
  const { prefs } = usePrefs();
  const [a, setA] = useState(false);
  const [b, setB] = useState(false);
  const [cin, setCin] = useState(false);
  const [view, setView] = useState("gates");
  const half = halfAdder(a ? 1 : 0, b ? 1 : 0);
  const full = fullAdder(a ? 1 : 0, b ? 1 : 0, cin ? 1 : 0);
  return (
    <div className="grid cards-2">
      <Card title="Half adder">
        <div className="row"><BitSwitch label="A" on={a} onChange={setA} /><BitSwitch label="B" on={b} onChange={setB} /></div>
        <p className="mono">SUM = A XOR B → {half.sum}</p>
        <p className="mono">CARRY = A AND B → {half.carry}</p>
        <svg viewBox="0 0 280 90" className="diagram" aria-label="Half adder gates">
          <text x="8" y="28" fontSize="12">A</text>
          <text x="8" y="68" fontSize="12">B</text>
          <path className={a ? "wire high" : "wire low"} d="M24 24 H70" />
          <path className={b ? "wire high" : "wire low"} d="M24 64 H70" />
          <rect x="70" y="12" width="70" height="64" rx="10" fill="white" stroke="#d7e1ee" />
          <text x="105" y="48" textAnchor="middle" fontSize="12">XOR / AND</text>
          <path className={half.sum === 1 ? "wire high" : "wire low"} d="M140 32 H200" />
          <path className={half.carry === 1 ? "wire high" : "wire low"} d="M140 64 H200" />
          <text x="208" y="36" fontSize="12">Sum {half.sum}</text>
          <text x="208" y="68" fontSize="12">Carry {half.carry}</text>
        </svg>
      </Card>
      <Card title="Full adder" action={<Segmented options={["gates", "half-adders"]} value={view} onChange={setView} />}>
        <div className="row"><BitSwitch label="Cin" on={cin} onChange={setCin} /></div>
        <p className="mono">SUM = A XOR B XOR Cin → {full.sum}</p>
        <p className="mono">Cout = AB + ACin + BCin → {full.cout}</p>
        <p className="muted">{view === "gates" ? "One XOR tree makes the sum. Majority of the three inputs makes the carry." : "Two half adders: the first adds A and B, the second adds that sum to Cin. The two carries OR together."}</p>
        {prefs.explain ? <ExplainBar what={`Sum is ${full.sum} and carry out is ${full.cout}.`} why="The sum flips for every input that is 1. The carry is 1 when at least two inputs are 1." notice="All four half-adder rows, and all eight full-adder rows, are produced by these same equations." /> : null}
      </Card>
    </div>
  );
}

function Multi() {
  const [width, setWidth] = useState(4);
  const [a, setA] = useState<Array<0 | 1>>([1, 1, 0, 1]);
  const [b, setB] = useState<Array<0 | 1>>([0, 1, 1, 0]);
  const [style, setStyle] = useState("ripple");
  const [step, setStep] = useState(0);
  const aa = fit(a, width);
  const bb = fit(b, width);
  const ripple = rippleAdd(aa, bb, 0);
  const cla = carryLookahead(aa, bb, 0);
  const select = carrySelect(aa, bb, 0);
  const shown = style === "cla" ? cla.sum : style === "select" ? select.sum : ripple.sum;
  return (
    <div className="grid">
      <Card title="Operands" action={<Segmented options={["4", "8", "16"]} value={String(width)} onChange={(value) => setWidth(Number(value))} />}>
        <WordEditor bits={aa} onChange={setA} />
        <WordEditor bits={bb} onChange={setB} />
        <Segmented options={["ripple", "cla", "select", "parallel"]} value={style} onChange={setStyle} />
      </Card>
      <Card title={style === "ripple" ? "Ripple carry" : style === "cla" ? "Carry look-ahead" : style === "select" ? "Carry select" : "Parallel view"}>
        <ValueReadout bits={shown} />
        <p className="tiny">Carry out {style === "cla" ? cla.cout : style === "select" ? select.cout : ripple.cout}. Ripple logic depth is {ripple.depth} full adders. Look-ahead depth stays near {cla.depth} gate levels inside a block.</p>
        {style === "ripple" || style === "parallel" ? (
          <div>
            <button className="btn-primary" onClick={() => setStep((n) => (n + 1) % (width + 1))}>Step carry</button>
            <table className="data"><thead><tr><th>Bit</th><th>A</th><th>B</th><th>Cin</th><th>Sum</th><th>Cout</th></tr></thead>
              <tbody>
                {aa.map((_, index) => {
                  const bit = width - 1 - index;
                  const active = style === "parallel" || step === bit || step === width;
                  return <tr key={bit} className={active ? "active" : ""}><td>{bit}</td><td>{aa[index]}</td><td>{bb[index]}</td><td>{ripple.carries[bit] ?? 0}</td><td>{ripple.sum[index]}</td><td>{ripple.carries[bit + 1] ?? ripple.cout}</td></tr>;
                })}
              </tbody>
            </table>
            <p className="muted">{style === "parallel" ? "Every sum bit is visible at once. The carry into bit n still depends on the bits below it unless look-ahead computes it." : "The highlighted stage is as far as the carry has traveled. A wider adder waits longer."}</p>
          </div>
        ) : null}
        {style === "cla" ? (
          <table className="data"><thead><tr><th>Bit</th><th>G</th><th>P</th><th>Cin</th><th>Sum</th></tr></thead>
            <tbody>{cla.stages.map((stage) => <tr key={stage.bit}><td>{stage.bit}</td><td>{stage.g}</td><td>{stage.p}</td><td>{stage.cin}</td><td>{stage.sum}</td></tr>)}</tbody>
          </table>
        ) : null}
        {style === "select" ? (
          <div className="grid cards-2">
            {select.paths.map((path, index) => (
              <div key={index} className="metric"><span>Assume Cin {path.assume}{path.selected ? " · selected" : ""}</span><b className="mono">{toBinary(path.sum)} → Cout {path.cout}</b></div>
            ))}
          </div>
        ) : null}
      </Card>
    </div>
  );
}

function SubLab() {
  const [a, setA] = useState(true);
  const [b, setB] = useState(false);
  const [bin, setBin] = useState(false);
  const [mode, setMode] = useState<0 | 1>(0);
  const [wordA, setWordA] = useState<Array<0 | 1>>([0, 1, 0, 1]);
  const [wordB, setWordB] = useState<Array<0 | 1>>([0, 0, 1, 1]);
  const half = halfSubtractor(a ? 1 : 0, b ? 1 : 0);
  const full = fullSubtractor(a ? 1 : 0, b ? 1 : 0, bin ? 1 : 0);
  const mixed = addSub(wordA, wordB, mode);
  return (
    <div className="grid cards-2">
      <Card title="Half and full subtractor">
        <div className="row"><BitSwitch label="A" on={a} onChange={setA} /><BitSwitch label="B" on={b} onChange={setB} /><BitSwitch label="Bin" on={bin} onChange={setBin} /></div>
        <p className="mono">Diff = A XOR B → {half.diff} · Borrow = A'B → {half.borrow}</p>
        <p className="mono">Full diff {full.diff} · Borrow out {full.bout}</p>
      </Card>
      <Card title="Adder / subtractor" action={<Segmented options={["ADD", "SUB"]} value={mode === 0 ? "ADD" : "SUB"} onChange={(value) => setMode(value === "SUB" ? 1 : 0)} />}>
        <WordEditor bits={wordA} onChange={setWordA} />
        <WordEditor bits={wordB} onChange={setWordB} />
        <p className="mono">B effective {toBinary(mixed.bEffective)} · Cin {mode}</p>
        <ValueReadout bits={mixed.sum} />
        <p className="muted">{mode === 1 ? "SUB replaces B with its complement and forces Cin to 1, which is A + ~B + 1." : "ADD passes B through and holds Cin at 0."}</p>
        <p className="tiny">Increment {toUnsigned(increment(wordA).sum)} · Decrement {toUnsigned(decrement(wordA).sum)}</p>
      </Card>
    </div>
  );
}

function CmpLab() {
  const [a, setA] = useState<Array<0 | 1>>([1, 0, 0, 1]);
  const [b, setB] = useState<Array<0 | 1>>([0, 1, 1, 1]);
  const result = compareMagnitude(a, b);
  return (
    <Card title="Magnitude comparator">
      <WordEditor bits={a} onChange={setA} />
      <WordEditor bits={b} onChange={setB} />
      <div className="row"><span className={result.eq ? "bit on" : "bit"}>A=B</span><span className={result.gt ? "bit on" : "bit"}>A&gt;B</span><span className={result.lt ? "bit on" : "bit"}>A&lt;B</span></div>
      <ol>{result.steps.map((step) => <li key={step.bit}>Bit {step.bit}: {step.a} vs {step.b}. {step.decision}</li>)}</ol>
    </Card>
  );
}

function ShiftLab() {
  const [bits, setBits] = useState<Array<0 | 1>>([1, 0, 1, 1]);
  const [kind, setKind] = useState<ShiftKind>("logical-left");
  const [amount, setAmount] = useState(1);
  const moved = shiftVector(bits, kind, amount);
  return (
    <Card title="Barrel shifter">
      <Segmented options={["logical-left", "logical-right", "arithmetic-right", "rotate-left", "rotate-right"]} value={kind} onChange={(value) => setKind(value as ShiftKind)} />
      <WordEditor bits={bits} onChange={setBits} />
      <label className="tiny">Amount <input aria-label="Shift amount" type="range" min={0} max={Math.max(1, bits.length - 1)} value={amount} onChange={(event) => setAmount(Number(event.target.value))} /></label>
      <p className="expr">{toBinary(moved.result)}</p>
      <p className="muted">{kind === "arithmetic-right" ? "The sign bit copies into the vacated positions." : kind.startsWith("rotate") ? "Bits that leave one end re-enter the other." : "Vacated bits fill with 0. The bit that falls off is the shifted-out carry."}</p>
    </Card>
  );
}

function AluLab() {
  const ops: AluOp[] = ["ADD", "SUB", "AND", "OR", "XOR", "NOT", "SHL", "SHR", "CMP", "INC", "DEC"];
  const [width, setWidth] = useState(4);
  const [op, setOp] = useState<AluOp>("ADD");
  const [a, setA] = useState<Array<0 | 1>>([0, 1, 1, 1]);
  const [b, setB] = useState<Array<0 | 1>>([0, 0, 0, 1]);
  const aa = fit(a, width);
  const result = alu(aa, fit(b, width), op);
  const paths = ["arithmetic", "logic", "shift", "compare"] as const;
  return (
    <div className="grid cards-2">
      <Card title="ALU" action={<Segmented options={["4", "8", "16"]} value={String(width)} onChange={(value) => setWidth(Number(value))} />}>
        <Segmented options={ops} value={op} onChange={(value) => setOp(value as AluOp)} />
        <WordEditor bits={aa} onChange={setA} />
        <WordEditor bits={fit(b, width)} onChange={setB} />
        <ValueReadout bits={result.result} />
        <div className="row">
          <Flag name="Z" on={result.zero === 1} tip="Zero: every result bit is 0." />
          <Flag name="N" on={result.negative === 1} tip="Negative: the MSB of the two's-complement result is 1." />
          <Flag name="C" on={result.carry === 1} tip="Carry: unsigned carry out of the adder, or the bit shifted off. Not the same as overflow." />
          <Flag name="V" on={result.overflow === 1} tip="Overflow: the signed result does not fit. Carry can be 0 while this is 1." />
        </div>
      </Card>
      <Card title="Active path">
        {paths.map((path) => (
          <p key={path} className={path === result.active ? "expr" : "muted"}>{path === result.active ? "●" : "○"} {path}</p>
        ))}
        <p className="tiny">Only the selected subunit feeds the result mux. The others stay dark.</p>
      </Card>
    </div>
  );
}

function Flag({ name, on, tip }: { name: string; on: boolean; tip: string }) {
  return <button className={on ? "bit on" : "bit"} title={tip} aria-label={`${name} ${on ? "set" : "clear"}. ${tip}`}>{name}</button>;
}

function MulLab() {
  const [a, setA] = useState<Array<0 | 1>>([1, 0, 1, 1]);
  const [b, setB] = useState<Array<0 | 1>>([0, 1, 0, 1]);
  const [step, setStep] = useState(0);
  const [divA, setDivA] = useState<Array<0 | 1>>([1, 1, 0, 1]);
  const [divB, setDivB] = useState<Array<0 | 1>>([0, 0, 1, 1]);
  const product = multiplySteps(a, b);
  const divided = divideSteps(divA, divB);
  return (
    <div className="grid cards-2">
      <Card title="Multiplication">
        <WordEditor bits={a} onChange={setA} />
        <WordEditor bits={b} onChange={setB} />
        <button className="btn-primary" onClick={() => setStep((n) => (n + 1) % product.steps.length)}>Step partial product</button>
        <pre className="mono">{product.steps.map((row, index) => `${index === step ? ">" : " "} ${row.include ? row.row : row.row.replace(/1/g, "·")}  shift ${row.shift}`).join("\n")}</pre>
        <p>Product {toBinary(product.product)} = {toUnsigned(product.product)}</p>
      </Card>
      <Card title="Unsigned division">
        <WordEditor bits={divA} onChange={setDivA} />
        <WordEditor bits={divB} onChange={setDivB} />
        {divided.error ? <p>{divided.error}</p> : (
          <ol>{divided.steps.map((row, index) => <li key={index}>{row.note} Remainder {row.remainder}, quotient bit {row.quotientBit}</li>)}</ol>
        )}
        <p>Quotient {toBinary(divided.quotient)} remainder {divided.remainder}</p>
      </Card>
    </div>
  );
}

function fit(bits: Array<0 | 1>, width: number): Array<0 | 1> {
  const sliced = bits.slice(-width);
  return [...Array.from({ length: width - sliced.length }, () => 0 as 0 | 1), ...sliced];
}
