import { useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Icon, type IconName } from "../../design-system/icons";
import { Toggle } from "../../design-system/ui";
import { BitSwitch } from "../shared/widgets";

type Page = "alu" | "datapath" | "control" | "opcodes" | "details";
type Op = "ADD" | "SUB" | "AND" | "OR" | "XOR" | "SLT" | "SLL" | "SRL";
type Format = "bin" | "dec" | "hex";

const PAGES: Array<{ id: Page; label: string; icon: IconName }> = [
  { id: "alu", label: "ALU (Arithmetic)", icon: "bolt" },
  { id: "datapath", label: "Datapath Visualizer", icon: "map" },
  { id: "control", label: "Control Signals", icon: "gate" },
  { id: "opcodes", label: "Opcode Table", icon: "table" },
  { id: "details", label: "Operation Details", icon: "info" },
];

const OPS: Array<{ code: string; name: Op; expr: string; blurb: string }> = [
  { code: "000", name: "ADD", expr: "A + B", blurb: "Performs unsigned addition of A and B. The result is stored in the output Y. The Carry flag is set if there is a carry out." },
  { code: "001", name: "SUB", expr: "A − B", blurb: "Subtracts B from A using two’s-complement addition. A borrow sets Carry. Signed overflow sets V." },
  { code: "010", name: "AND", expr: "A & B", blurb: "Bitwise AND. Each result bit is 1 only when both inputs are 1." },
  { code: "011", name: "OR", expr: "A | B", blurb: "Bitwise OR. Each result bit is 1 when either input is 1." },
  { code: "100", name: "XOR", expr: "A ^ B", blurb: "Bitwise exclusive OR. A result bit is 1 when the inputs differ." },
  { code: "101", name: "SLT", expr: "A < B", blurb: "Set on less than. Y is 1 when signed A is less than signed B, otherwise 0." },
  { code: "110", name: "SLL", expr: "A << 1", blurb: "Logical shift left by one. The bit shifted out of the top becomes Carry." },
  { code: "111", name: "SRL", expr: "A >> 1", blurb: "Logical shift right by one. A zero fills the top bit. The bit shifted out becomes Carry." },
];

const GUIDE = [
  { label: "ALU Overview", page: "alu" as Page },
  { label: "Inputs and Control Signals", page: "control" as Page },
  { label: "Datapath Walkthrough", page: "datapath" as Page },
  { label: "Opcode Implementation", page: "opcodes" as Page },
  { label: "Flags and Status Bits", page: "alu" as Page },
  { label: "Compare and explore applications", page: "details" as Page },
  { label: "Try practice challenges", page: "details" as Page },
];

const TAKES = [
  "The ALU performs arithmetic and logical operations on binary data.",
  "Control signals select the operation and drive the datapath.",
  "Status flags (Z, N, C, V) indicate important result conditions.",
  "The same hardware can implement many different operations.",
  "ALUs are fundamental building blocks in CPUs, GPUs, and SoCs.",
];

function maskOf(width: number): number {
  return (1 << width) - 1;
}

function signed(value: number, width: number): number {
  const sign = 1 << (width - 1);
  const masked = value & maskOf(width);
  return (masked & sign) !== 0 ? masked - (1 << width) : masked;
}

function compute(op: Op, a: number, b: number, cin: number, width: number) {
  const mask = maskOf(width);
  const aa = a & mask;
  const bb = b & mask;
  const sign = 1 << (width - 1);
  let result = 0;
  let carry = 0;
  let overflow = 0;
  if (op === "ADD") {
    const sum = aa + bb + (cin ? 1 : 0);
    result = sum & mask;
    carry = sum > mask ? 1 : 0;
    overflow = ((aa ^ result) & (bb ^ result) & sign) !== 0 ? 1 : 0;
  } else if (op === "SUB") {
    const diff = aa - bb - (cin ? 1 : 0);
    result = diff & mask;
    carry = diff < 0 ? 1 : 0;
    overflow = ((aa ^ bb) & (aa ^ result) & sign) !== 0 ? 1 : 0;
  } else if (op === "AND") result = aa & bb;
  else if (op === "OR") result = aa | bb;
  else if (op === "XOR") result = aa ^ bb;
  else if (op === "SLT") result = signed(aa, width) < signed(bb, width) ? 1 : 0;
  else if (op === "SLL") {
    carry = (aa & sign) !== 0 ? 1 : 0;
    result = (aa << 1) & mask;
  } else {
    carry = aa & 1;
    result = aa >> 1;
  }
  return { result, z: result === 0 ? 1 : 0, n: (result & sign) !== 0 ? 1 : 0, c: carry, v: overflow };
}

function hexOf(value: number, width: number): string {
  return `0x${(value & maskOf(width)).toString(16).toUpperCase().padStart(Math.ceil(width / 4), "0")}`;
}

function bitsOf(value: number, width: number): string {
  return (value & maskOf(width)).toString(2).padStart(width, "0").replace(/(.{4})/g, "$1 ").trim();
}

function clamp(value: number, width: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(maskOf(width), Math.trunc(value)));
}

function formulas(op: Op, width: number): string[] {
  const top = width - 1;
  const limit = maskOf(width);
  if (op === "ADD") return ["Y = A + B", `C = (A + B) > ${limit}`, "Z = (Y == 0)", `N = Y[${top}]`, `V = (~(A[${top}] ^ B[${top}])) & (A[${top}] ^ Y[${top}])`];
  if (op === "SUB") return ["Y = A − B", "C = 1 when unsigned A < B", "Z = (Y == 0)", `N = Y[${top}]`, `V = (A[${top}] ^ B[${top}]) & (A[${top}] ^ Y[${top}])`];
  if (op === "SLT") return ["Y = 1 when signed A < signed B", "Z = (Y == 0)", "N = 0", "C = 0", "V = 0"];
  if (op === "SLL") return ["Y = A << 1", `C = A[${top}]`, "Z = (Y == 0)", `N = Y[${top}]`, "V = 0"];
  if (op === "SRL") return ["Y = A >> 1", "C = A[0]", "Z = (Y == 0)", "N = 0", "V = 0"];
  return [`Y = ${OPS.find((item) => item.name === op)?.expr ?? "A"}`, "C = 0", "Z = (Y == 0)", `N = Y[${top}]`, "V = 0"];
}

export function AluStudio() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab") ?? "alu";
  const page: Page = PAGES.some((item) => item.id === raw) ? raw as Page : "alu";
  const [op, setOp] = useState<Op>("ADD");
  const [width, setWidth] = useState(8);
  const [a, setA] = useState(10);
  const [b, setB] = useState(22);
  const [cin, setCin] = useState(false);
  const [format, setFormat] = useState<Format>("dec");
  const [animate, setAnimate] = useState(true);
  const [guide, setGuide] = useState(0);
  const [answer, setAnswer] = useState("");
  const [hint, setHint] = useState(false);
  const [checked, setChecked] = useState("");
  const spec = OPS.find((item) => item.name === op) ?? OPS[0]!;
  const flags = useMemo(() => compute(op, a, b, cin ? 1 : 0, width), [op, a, b, cin, width]);
  const shown = format === "hex" ? hexOf(flags.result, width) : format === "bin" ? bitsOf(flags.result, width) : String(flags.result);
  const showBoard = page === "alu";

  function go(next: Page, step?: number) {
    const query = new URLSearchParams(params);
    query.set("tab", next);
    setParams(query, { replace: true });
    if (step !== undefined) setGuide(step);
  }

  function setBit(index: number) {
    const bits = spec.code.split("");
    const current = bits[index];
    if (current === undefined) return;
    bits[index] = current === "1" ? "0" : "1";
    const found = OPS.find((item) => item.code === bits.join(""));
    if (found) setOp(found.name);
  }

  function cycleWidth() {
    const next = width === 8 ? 4 : width === 4 ? 16 : 8;
    setWidth(next);
    setA((value) => clamp(value, next));
    setB((value) => clamp(value, next));
  }

  return (
    <div className="alux">
      <header className="fsmx-head">
        <div className="lgx-title">
          <span className="lgx-mark alux-mark"><Icon name="bolt" size={22} /></span>
          <div>
            <h1>ALU & Arithmetic Hardware</h1>
            <p>Explore arithmetic and logic unit (ALU) operations, visualize the datapath, and build intuition through interactive simulations.</p>
          </div>
        </div>
        <Link className="alux-back" to="/learn"><Icon name="back" size={14} /> Back to Path</Link>
      </header>
      <div className="lgx-tabs" role="tablist">
        {PAGES.map((item) => (
          <button key={item.id} type="button" role="tab" aria-selected={page === item.id} className={page === item.id ? "on" : ""} onClick={() => go(item.id)}>
            <Icon name={item.icon} size={14} /> {item.label}
          </button>
        ))}
      </div>
      <div className="alux-layout">
        <div className="alux-main">
          {showBoard || page === "datapath" ? (
            <div className={showBoard ? "alux-top" : "alux-stack"}>
              <section className="lgx-card alux-config">
                <div className="lgx-card-bar">
                  <div>
                    <h3><Icon name="gate" size={14} /> ALU Configuration</h3>
                    <p className="tiny">Select inputs, choose an operation, and see how the ALU produces a result.</p>
                  </div>
                  <button type="button" className="alux-badge" onClick={cycleWidth}>{width}-bit ALU</button>
                </div>
                <div className="alux-split">
                  <div className="alux-fields">
                    <label>Select Operation
                      <select aria-label="ALU operation" value={op} onChange={(event) => setOp(event.target.value as Op)}>
                        {OPS.map((item) => <option key={item.name} value={item.name}>{item.name} ({item.expr})</option>)}
                      </select>
                    </label>
                    <p className="alux-kicker">Input Values ({width}-bit)</p>
                    <label className="alux-pair">A
                      <input aria-label="Input A" type="number" min={0} max={maskOf(width)} value={a} onChange={(event) => setA(clamp(Number(event.target.value), width))} />
                      <span>{hexOf(a, width)}</span>
                    </label>
                    <label className="alux-pair">B
                      <input aria-label="Input B" type="number" min={0} max={maskOf(width)} value={b} onChange={(event) => setB(clamp(Number(event.target.value), width))} />
                      <span>{hexOf(b, width)}</span>
                    </label>
                    <p className="alux-kicker">Display Format</p>
                    <div className="alux-seg" role="group" aria-label="Display format">
                      {(["bin", "dec", "hex"] as const).map((item) => (
                        <button key={item} type="button" className={format === item ? "on" : ""} onClick={() => setFormat(item)}>{item === "bin" ? "Binary" : item === "dec" ? "Decimal" : "Hex"}</button>
                      ))}
                    </div>
                  </div>
                  <Datapath a={a} b={b} result={shown} hex={hexOf(flags.result, width)} code={spec.code} cin={cin ? 1 : 0} op={op} width={width} animate={animate} onAnimate={setAnimate} />
                </div>
              </section>
              {showBoard ? <OpcodeTable a={a} b={b} cin={cin ? 1 : 0} width={width} active={op} onPick={setOp} /> : null}
            </div>
          ) : null}
          {page === "opcodes" ? <OpcodeTable a={a} b={b} cin={cin ? 1 : 0} width={width} active={op} onPick={setOp} /> : null}
          {showBoard ? (
            <div className="alux-row">
              <ResultCard shown={shown} hex={hexOf(flags.result, width)} binary={bitsOf(flags.result, width)} animate={animate} />
              <Flags flags={flags} />
              <Control code={spec.code} op={op} cin={cin} onBit={setBit} onCin={setCin} />
            </div>
          ) : null}
          {page === "control" ? (
            <section className="lgx-card">
              <h3><Icon name="gate" size={14} /> Control Signals</h3>
              <p className="tiny">Opcode {spec.code} selects {op}. Carry in is {cin ? 1 : 0}. Flip a bit or pick an opcode — the same ALU block updates.</p>
              <Control code={spec.code} op={op} cin={cin} onBit={setBit} onCin={setCin} />
              <div className="alux-seg alux-opgrid">
                {OPS.map((item) => <button key={item.code} type="button" className={op === item.name ? "on" : ""} onClick={() => setOp(item.name)}>{item.code} {item.name}</button>)}
              </div>
            </section>
          ) : null}
          {showBoard || page === "details" ? (
            <div className={showBoard ? "alux-low" : "alux-stack"}>
              <section className="lgx-card">
                <h3><Icon name="book" size={14} /> Operation Details</h3>
                <div className="alux-detail">
                  <div>
                    <p className="alux-opname">{op} ({spec.expr})</p>
                    <p>{spec.blurb}</p>
                  </div>
                  <div className="alux-math">
                    {formulas(op, width).map((line) => <p key={line}>{line}</p>)}
                  </div>
                </div>
              </section>
              <Practice
                answer={answer}
                hint={hint}
                checked={checked}
                onAnswer={setAnswer}
                onHint={() => setHint((value) => !value)}
                onCheck={() => setChecked(answer.replace(/\s/g, "").toLowerCase().includes("26") ? "Correct. 45 − 19 = 26. Z, N, C, and V stay 0 — the difference fits in 8 bits." : "Not yet. Subtract 19 from 45, then read Z, N, C, and V from that result.")}
                onTry={() => { setA(45); setB(19); setOp("SUB"); setCin(false); setWidth(8); setFormat("dec"); go("alu"); }}
              />
            </div>
          ) : null}
        </div>
        <aside className="alux-side">
          <section className="lgx-card lgx-guide">
            <h3><Icon name="book" size={14} /> Studio Guide</h3>
            <p className="tiny">Learn how the ALU performs arithmetic and logic operations and how control signals drive the datapath.</p>
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
            <ul>
              {TAKES.map((item) => <li key={item}><i>✓</i>{item}</li>)}
            </ul>
          </section>
          <section className="lgx-card alux-quote">
            <p>“Good hardware design turns abstractions into ability.”</p>
            <cite>— R. E. Moore</cite>
          </section>
        </aside>
      </div>
    </div>
  );
}

function ResultCard({ shown, hex, binary, animate }: { shown: string; hex: string; binary: string; animate: boolean }) {
  return (
    <section className="lgx-card">
      <h3>Result Output</h3>
      <p className="alux-y">Y (Result) <i className={animate ? "on" : ""} /> <b>{shown}</b></p>
      <p className="tiny">{hex}</p>
      <p className="tiny">Binary: {binary}</p>
    </section>
  );
}

function Flags({ flags }: { flags: { z: number; n: number; c: number; v: number } }) {
  const items = [
    ["Z", "Zero", flags.z],
    ["N", "Negative", flags.n],
    ["C", "Carry", flags.c],
    ["V", "Overflow", flags.v],
  ] as const;
  return (
    <section className="lgx-card">
      <h3>Status Flags</h3>
      <div className="alux-flags">
        {items.map(([name, title, bit]) => (
          <div key={name} className={bit === 1 ? "alux-flag on" : "alux-flag"}>
            <b>{name}</b>
            <small>{title}</small>
            <span />
            <em>{bit}</em>
          </div>
        ))}
      </div>
    </section>
  );
}

function Control({ code, op, cin, onBit, onCin }: { code: string; op: string; cin: boolean; onBit: (index: number) => void; onCin: (value: boolean) => void }) {
  return (
    <section className="lgx-card">
      <h3>Control Bits Visualization</h3>
      <div className="alux-ctrl">
        <div>
          <p className="tiny">Opcode (Op[2:0])</p>
          <div className="alux-bits">
            {code.split("").map((bit, index) => (
              <BitSwitch key={index} label={String(code.length - 1 - index)} on={bit === "1"} onChange={() => onBit(index)} ariaLabel={`Opcode bit ${code.length - 1 - index} is ${bit}`} />
            ))}
          </div>
        </div>
        <div>
          <p className="tiny">Operation</p>
          <b className="alux-opchip">{op}</b>
        </div>
      </div>
      <div className="alux-cin">
        <BitSwitch label="Cin" on={cin} onChange={onCin} />
      </div>
    </section>
  );
}

function Practice({ answer, hint, checked, onAnswer, onHint, onCheck, onTry }: {
  answer: string; hint: boolean; checked: string;
  onAnswer: (value: string) => void; onHint: () => void; onCheck: () => void; onTry: () => void;
}) {
  return (
    <section className="lgx-card">
      <div className="lgx-card-bar">
        <h3>Practice Challenge</h3>
        <button type="button" className="alux-try" onClick={onTry}>Try It!</button>
      </div>
      <p>If A = 45 (0x2D), B = 19 (0x13), and the operation is SUB (A − B), what is the result (in decimal) and which flags are set?</p>
      <input aria-label="Practice answer" value={answer} onChange={(event) => onAnswer(event.target.value)} placeholder="Enter your answer (e.g. 26, Z=0, N=0, C=0, V=0)" />
      <div className="alux-actions">
        <button type="button" className="lgx-check" onClick={onCheck}>Check Answer</button>
        <button type="button" className="alux-hint" onClick={onHint}>Hint</button>
      </div>
      {hint ? <p className="tiny">45 − 19 = 26. It fits in 8 bits, so there is no borrow and no signed overflow.</p> : null}
      {checked ? <p className={checked.startsWith("Correct") ? "alux-ok" : "tiny"}>{checked}</p> : null}
    </section>
  );
}

function OpcodeTable({ a, b, cin, width, active, onPick }: { a: number; b: number; cin: number; width: number; active: Op; onPick: (op: Op) => void }) {
  return (
    <section className="lgx-card alux-table">
      <h3><Icon name="table" size={14} /> Opcode / Operation Table</h3>
      <table>
        <thead>
          <tr><th>Opcode</th><th>Operation</th><th>Expression</th><th>Result (A={a}, B={b})</th></tr>
        </thead>
        <tbody>
          {OPS.map((item) => {
            const value = compute(item.name, a, b, cin, width).result;
            return (
              <tr key={item.code} className={active === item.name ? "on" : ""} onClick={() => onPick(item.name)}>
                <td>{item.code}</td>
                <td>{item.name}</td>
                <td>{item.expr}</td>
                <td className="alux-res">{value}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

function Datapath({ a, b, result, hex, code, cin, op, width, animate, onAnimate }: {
  a: number; b: number; result: string; hex: string; code: string; cin: number; op: string; width: number; animate: boolean; onAnimate: (value: boolean) => void;
}) {
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  return (
    <div className="alux-path">
      <div className="lgx-card-bar">
        <h3>ALU Datapath Visualizer</h3>
        <Toggle on={animate} onChange={onAnimate} label="Animate" />
      </div>
      <div
        className="alux-canvas"
        onPointerDown={(event) => {
          if ((event.target as HTMLElement).closest("button, md-switch, label")) return;
          drag.current = { x: event.clientX, y: event.clientY, px: pan.x, py: pan.y };
          event.currentTarget.setPointerCapture(event.pointerId);
          event.currentTarget.classList.add("panning");
        }}
        onPointerMove={(event) => {
          if (!drag.current) return;
          setPan({ x: drag.current.px + event.clientX - drag.current.x, y: drag.current.py + event.clientY - drag.current.y });
        }}
        onPointerUp={(event) => { drag.current = null; event.currentTarget.classList.remove("panning"); }}
        onPointerCancel={(event) => { drag.current = null; event.currentTarget.classList.remove("panning"); }}
      >
        <svg className={animate ? "alux-svg live" : "alux-svg"} viewBox="0 0 460 220" style={{ transform: `translate(${pan.x}px, ${pan.y}px)` }}>
          <defs>
            <marker id="alux-g" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 Z" fill="#22c55e" /></marker>
            <marker id="alux-b" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 Z" fill="#3b82f6" /></marker>
          </defs>
          <text x="18" y="28" className="tag">A</text>
          <rect x="14" y="36" width="56" height="30" rx="8" className="box a" />
          <text x="42" y="56" textAnchor="middle" className="val">{a}</text>
          <path className="wire a" d="M70 51 H128" markerEnd="url(#alux-g)" />
          <text x="18" y="108" className="tag">B</text>
          <rect x="14" y="116" width="56" height="30" rx="8" className="box b" />
          <text x="42" y="136" textAnchor="middle" className="val">{b}</text>
          <path className="wire b" d="M70 131 H128" markerEnd="url(#alux-b)" />
          <polygon points="138,24 248,48 248,162 138,186" className="alu" />
          <text x="186" y="100" textAnchor="middle" className="alu-name">ALU</text>
          <text x="186" y="118" textAnchor="middle" className="alu-sub">{width}-bit</text>
          <text x="186" y="134" textAnchor="middle" className="alu-sub">{op}</text>
          <path className="wire y" d="M248 105 H310" markerEnd="url(#alux-g)" />
          <text x="360" y="78" textAnchor="middle" className="tag">Result</text>
          <rect x="318" y="86" width="84" height="36" rx="8" className="box y" />
          <text x="360" y="110" textAnchor="middle" className="val">{result}</text>
          <text x="360" y="140" textAnchor="middle" className="hex">{hex}</text>
          <text x="168" y="206" textAnchor="middle" className="tag">Op[2:0]</text>
          <text x="214" y="206" textAnchor="middle" className="code">{code}</text>
          <text x="250" y="206" textAnchor="middle" className="tag">Cin</text>
          <text x="278" y="206" textAnchor="middle" className="code">{cin}</text>
        </svg>
      </div>
    </div>
  );
}
