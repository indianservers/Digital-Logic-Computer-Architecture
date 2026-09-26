import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Icon } from "../../design-system/icons";
import { bcdToSeven } from "../../engines/digital/routing";
import { designCounter, nextCount, rippleDelays, stepRegister, wordOf } from "../../engines/digital/sequential";
import { fromUnsigned } from "../../engines/digital/vector";
import { SevenSeg } from "../shared/widgets";

type Mode = "async" | "sync" | "up" | "down" | "updown" | "mod" | "bcd" | "ring" | "johnson" | "design";

const TABS: Array<{ id: Mode; label: string }> = [
  { id: "async", label: "Asynchronous" },
  { id: "sync", label: "Synchronous" },
  { id: "up", label: "Up Counter" },
  { id: "down", label: "Down Counter" },
  { id: "updown", label: "Up/Down" },
  { id: "mod", label: "Mod-N" },
  { id: "bcd", label: "BCD" },
  { id: "ring", label: "Ring" },
  { id: "johnson", label: "Johnson" },
];

const CONCEPTS = [
  "What is a counter?",
  "Asynchronous vs Synchronous",
  "Up, Down and Up/Down counters",
  "Mod-N counters",
  "BCD counters",
  "Ring counters",
  "Johnson counters",
  "Ripple delay along Q0 to Qn",
  "One shared clock in a synchronous counter",
  "Modulus and unused states",
  "Frequency division",
  "Using a counter to sequence control",
];

const LABS: Array<{ label: string; minutes: string; mode: Mode }> = [
  { label: "Build a 4-Bit Ripple Counter", minutes: "~10 min", mode: "async" },
  { label: "Synchronous Counter Design", minutes: "~12 min", mode: "design" },
  { label: "Mod-N Counter Experiment", minutes: "~10 min", mode: "mod" },
  { label: "Up/Down Counter with Control", minutes: "~12 min", mode: "updown" },
  { label: "BCD Counter Builder", minutes: "~15 min", mode: "bcd" },
  { label: "Ring & Johnson Counter Lab", minutes: "~10 min", mode: "ring" },
];

function modeOf(raw: string | null): Mode {
  if (raw === "sync" || raw === "synchronous") return "sync";
  if (raw === "up") return "up";
  if (raw === "down") return "down";
  if (raw === "updown") return "updown";
  if (raw === "mod") return "mod";
  if (raw === "bcd" || raw === "decade") return "bcd";
  if (raw === "ring") return "ring";
  if (raw === "johnson") return "johnson";
  if (raw === "design") return "design";
  return "async";
}

function bitsOf(value: number, width: number): Array<0 | 1> {
  return Array.from({ length: width }, (_, index) => (((value >> (width - 1 - index)) & 1) === 1 ? 1 : 0));
}

function valueOf(bits: Array<0 | 1>): number {
  return bits.reduce<number>((sum, bit) => (sum << 1) | bit, 0);
}

export function CounterStudio() {
  const [params, setParams] = useSearchParams();
  const mode = modeOf(params.get("tab"));
  const [nonce, setNonce] = useState(0);
  const [allConcepts, setAllConcepts] = useState(false);

  function open(next: Mode) {
    const query = new URLSearchParams(params);
    query.set("tab", next);
    setParams(query);
    setNonce((value) => value + 1);
  }

  return (
    <div className="ctrx">
      <header className="fsmx-head">
        <div className="lgx-title">
          <span className="lgx-mark"><Icon name="step" size={22} /></span>
          <div>
            <p className="tiny">Studio 12</p>
            <h1>Counters <span className="fsmx-badge">12 concepts</span></h1>
            <p>Explore how counters count, sequence, and control. Learn different counter types with interactive simulations and real-world examples.</p>
          </div>
        </div>
        <button className="lgx-check" type="button" onClick={() => open("async")}>Start Learning</button>
      </header>
      <div className="fsmx-stats">
        <span><b>6</b> Interactive Labs</span>
        <span><b>12</b> Concepts</span>
        <span>Practice Problems</span>
        <span>Real-World Examples</span>
      </div>
      <div className="lgx-tabs" role="tablist">
        {TABS.map((item) => (
          <button key={item.id} type="button" role="tab" aria-selected={mode === item.id} className={mode === item.id ? "on" : ""} onClick={() => open(item.id)}>
            {item.id === "up" ? "↑ " : item.id === "down" ? "↓ " : item.id === "updown" ? "↕ " : null}{item.label}
          </button>
        ))}
      </div>
      {mode === "design" ? <DesignPanel /> : <Simulator key={`${mode}-${nonce}`} mode={mode} onMode={open} />}
      <div className="fsmx-foot">
        <section className="lgx-card">
          <div className="lgx-card-bar"><h3>Key Concepts (12)</h3><button type="button" className="fsmx-icon" onClick={() => setAllConcepts((value) => !value)}>{allConcepts ? "Show less" : "View All"}</button></div>
          <ol>{(allConcepts ? CONCEPTS : CONCEPTS.slice(0, 5)).map((item, index) => <li key={item}>{index + 1}. {item}</li>)}</ol>
          {allConcepts ? null : <p className="tiny">+7 more concepts</p>}
        </section>
        <section className="lgx-card">
          <div className="lgx-card-bar"><h3>Interactive Labs (6)</h3><button type="button" className="fsmx-icon" onClick={() => setAllConcepts(true)}>View All</button></div>
          <ul>{LABS.map((item) => <li key={item.label}><button type="button" onClick={() => open(item.mode)}>{item.label}</button> <span className="tiny">{item.minutes}</span></li>)}</ul>
        </section>
        <section className="lgx-card">
          <h3>Real-World Applications</h3>
          <ul>
            <li>Event counting (people, products)</li>
            <li>Digital clocks and timers</li>
            <li>Frequency division and clock generation</li>
            <li>Sequence control in digital systems</li>
            <li>Address generation in memory systems</li>
            <li>Traffic lights and automation</li>
          </ul>
        </section>
        <section className="lgx-card">
          <div className="lgx-card-bar"><h3>Practice Challenge</h3><button type="button" className="lgx-check" onClick={() => open("bcd")}>Try It!</button></div>
          <p>Design a MOD-10 (decimal) counter using a 4-bit counter. Verify the sequence (0–9) and observe the outputs in the simulator.</p>
          <p className="tiny">Medium · ~15 min · Digital Design</p>
        </section>
      </div>
    </div>
  );
}

function Simulator({ mode, onMode }: { mode: Exclude<Mode, "design">; onMode: (mode: Mode) => void }) {
  const shift = mode === "ring" || mode === "johnson";
  const [width, setWidth] = useState(4);
  const [modulus, setModulus] = useState(mode === "bcd" || mode === "mod" ? 10 : 16);
  const [direction, setDirection] = useState<"up" | "down">(mode === "down" ? "down" : "up");
  const [clockMode, setClockMode] = useState<"manual" | "continuous">("continuous");
  const [speed, setSpeed] = useState(500);
  const [playing, setPlaying] = useState(false);
  const [panel, setPanel] = useState<"timing" | "table">("timing");
  const [bits, setBits] = useState<Array<0 | 1>>(() => seed(mode, 4, mode === "bcd" || mode === "mod" ? 10 : 16).at(-1) ?? bitsOf(5, 4));
  const [history, setHistory] = useState<Array<Array<0 | 1>>>(() => seed(mode, 4, mode === "bcd" || mode === "mod" ? 10 : 16));
  const [note, setNote] = useState(blurb(mode));
  const stepRef = useRef<() => void>(() => undefined);
  const mod = mode === "bcd" ? Math.min(10, 2 ** width) : Math.max(2, Math.min(modulus, 2 ** width));
  const dir: "up" | "down" = mode === "down" ? "down" : mode === "up" ? "up" : direction;

  function applyWidth(next: number) {
    setWidth(next);
    setPlaying(false);
    const nextMod = mode === "bcd" ? Math.min(10, 2 ** next) : Math.max(2, Math.min(modulus, 2 ** next));
    const seeded = seed(mode, next, nextMod);
    setHistory(seeded);
    setBits(seeded.at(-1) ?? bitsOf(0, next));
  }

  function step() {
    const nextBits = shift ? stepRegister(bits, mode === "ring" ? "ring" : "johnson", 0).q : bitsOf(nextCount(valueOf(bits), mod, dir), width);
    if (mode === "async") {
      const delays = rippleDelays(valueOf(bits), valueOf(nextBits), width);
      setNote(delays.length ? `Ripple: ${delays.map((item) => `Q${item.bit} after delay ${item.delay}`).join(", ")}.` : "This edge holds every bit.");
    } else if (mode === "sync") setNote("Every flip-flop sees this same clock edge.");
    else setNote(blurb(mode));
    setBits(nextBits);
    setHistory((rows) => [...rows, nextBits].slice(-16));
  }
  stepRef.current = step;

  useEffect(() => {
    if (!playing || clockMode !== "continuous") return undefined;
    const id = window.setInterval(() => stepRef.current(), speed);
    return () => window.clearInterval(id);
  }, [playing, clockMode, speed]);

  function reset() {
    setPlaying(false);
    const seeded = seed(mode, width, mod);
    setHistory(seeded);
    setBits(seeded.at(-1) ?? bitsOf(0, width));
    setNote(blurb(mode));
  }

  const decimal = valueOf(bits);
  const digit = mode === "bcd" ? bcdToSeven(fromUnsigned(decimal % 10, 4)) : null;

  return (
    <section className="lgx-card ctrx-sim">
      <div className="lgx-card-bar">
        <div>
          <h3><Icon name="bolt" size={16} /> 4-Bit Counter Simulator</h3>
          <p className="tiny">Visualize counter operation with real-time outputs, waveforms, and state information.</p>
        </div>
        <div className="ctrx-tools">
          <select aria-label="Counter width" value={width} onChange={(event) => applyWidth(Number(event.target.value))}>
            {[2, 3, 4, 8].map((item) => <option key={item} value={item}>{item}-bit</option>)}
          </select>
          <button type="button" className={panel === "timing" ? "on" : ""} onClick={() => setPanel("timing")}>Timing Diagram</button>
          <button type="button" className={panel === "table" ? "on" : ""} onClick={() => setPanel("table")}>State Table</button>
        </div>
      </div>
      <div className="ctrx-columns">
        <div>
          <p className="tiny">Controls</p>
          <div className="ctrx-run">
            <button type="button" className="ctrx-go" onClick={() => { if (clockMode === "manual") step(); else setPlaying((value) => !value); }}><Icon name={playing ? "pause" : "play"} size={14} /> {playing && clockMode === "continuous" ? "Pause" : "Run"}</button>
            <button type="button" onClick={step}><Icon name="step" size={14} /> Step</button>
            <button type="button" onClick={reset}><Icon name="reset" size={14} /> Reset</button>
          </div>
          <p className="tiny">Clock Settings</p>
          <div className="ctrx-mode">
            <span>Mode</span>
            <button type="button" className={clockMode === "manual" ? "on" : ""} onClick={() => { setClockMode("manual"); setPlaying(false); }}>Manual</button>
            <button type="button" className={clockMode === "continuous" ? "on" : ""} onClick={() => setClockMode("continuous")}>Continuous</button>
          </div>
          <label className="ctrx-speed">Speed
            <input aria-label="Clock speed" type="range" min={100} max={1000} step={50} value={speed} onChange={(event) => setSpeed(Number(event.target.value))} />
            <b>{speed} ms</b>
          </label>
        </div>
        <div>
          <p className="tiny">Counter Outputs</p>
          <div className="ctrx-outs">
            {bits.map((bit, index) => (
              <div key={index} className={bit ? "ctrx-bit on" : "ctrx-bit"}>
                <small>Q{width - 1 - index}</small>
                <b>{bit}</b>
              </div>
            ))}
          </div>
        </div>
        <div className="ctrx-info">
          <p className="tiny">Counter Information</p>
          <div className="ctrx-read">
            <div><span>Binary Output ({bits.map((_, index) => `Q${width - 1 - index}`).join(" ")})</span><strong className="mono">{bits.join(" ")}</strong></div>
            <div><span>Decimal Value</span><strong>{decimal}</strong></div>
          </div>
          {digit ? <SevenSeg segments={digit.segments} valid={digit.valid} /> : null}
          <div className="ctrx-mod">
            <span>Modulus (Mod-N)</span>
            <div>
              <button type="button" aria-label="Decrease modulus" onClick={() => { const next = Math.max(2, mod - 1); setModulus(next); if (mode !== "mod" && mode !== "bcd") onMode("mod"); }}>−</button>
              <b>{mod}</b>
              <button type="button" aria-label="Increase modulus" onClick={() => { const next = Math.min(2 ** width, mod + 1); setModulus(next); if (mode !== "mod" && mode !== "bcd") onMode("mod"); }}>+</button>
            </div>
            <small>Range: 2–{2 ** width}</small>
          </div>
          <div className="ctrx-dir">
            <span>Count Direction</span>
            <button type="button" className={dir === "up" ? "vl-up on" : "vl-up"} onClick={() => { setDirection("up"); if (mode === "down") onMode("up"); }}>↑ Up</button>
            <button type="button" className={dir === "down" ? "vl-down on" : "vl-down"} onClick={() => { setDirection("down"); if (mode === "up") onMode("down"); }}>↓ Down</button>
          </div>
        </div>
      </div>
      <p>{note}</p>
      {panel === "timing" ? <TimingChart history={history} width={width} /> : <StateTable mode={mode} width={width} mod={mod} dir={dir} current={decimal} bits={bits} />}
    </section>
  );
}

function seed(mode: Mode, width: number, mod: number): Array<Array<0 | 1>> {
  if (mode === "ring" || mode === "johnson") {
    let current = Array.from({ length: width }, (_, index) => (mode === "ring" && index === 0 ? 1 : 0)) as Array<0 | 1>;
    const rows = [current];
    for (let index = 1; index < 16; index += 1) {
      current = stepRegister(current, mode, 0).q;
      rows.push(current);
    }
    return rows;
  }
  const end = Math.min(5, Math.max(0, mod - 1));
  const values: number[] = [];
  let value = end;
  for (let index = 0; index < 16; index += 1) {
    values.unshift(value);
    value = nextCount(value, mod, "down");
  }
  return values.map((item) => bitsOf(item, width));
}

function blurb(mode: Mode): string {
  if (mode === "async") return "Asynchronous (ripple): the clock enters Q0, and each next stage clocks from the previous Q.";
  if (mode === "sync") return "Synchronous: every flip-flop receives the same clock.";
  if (mode === "up") return "Up counter: each clock adds one.";
  if (mode === "down") return "Down counter: each clock subtracts one, wrapping to the last state.";
  if (mode === "updown") return "Up/Down: the direction control chooses the next state.";
  if (mode === "mod") return "Mod-N: the count returns to 0 after N − 1.";
  if (mode === "bcd") return "BCD counts 0 through 9, then returns to 0000.";
  if (mode === "ring") return "Ring: one 1 circulates. Four bits visit four states.";
  return "Johnson: the inverted last bit shifts in. Four bits visit eight states.";
}

function TimingChart({ history, width }: { history: Array<Array<0 | 1>>; width: number }) {
  const rows = history.length >= 16 ? history.slice(-16) : [...Array.from({ length: 16 - history.length }, () => history[0] ?? bitsOf(0, width)), ...history];
  const samples = rows.flatMap((bits) => [bits, bits]);
  const clk = rows.flatMap(() => [1, 0] as const);
  const plot = 680;
  const span = plot / samples.length;
  const names = ["CLK", ...Array.from({ length: width }, (_, index) => `Q${index}`)];
  const colors = ["#2563eb", "#16a34a", "#7c3aed", "#ea580c", "#db2777", "#0891b2", "#ca8a04", "#0f766e"];
  return (
    <div>
      <p className="tiny">Timing Diagram (Last 16 Clock Cycles)</p>
      <svg className="ctrx-wave" viewBox={`0 0 760 ${36 + names.length * 28}`} role="img" aria-label="Timing diagram for the last 16 clocks">
        {names.map((name, row) => {
          const values = row === 0 ? clk : samples.map((bits) => bits[width - row] ?? 0);
          const y = 8 + row * 28;
          let path = "";
          values.forEach((bit, index) => {
            const x = 48 + index * span;
            const level = bit === 1 ? y + 4 : y + 16;
            path += index === 0 ? `M ${x} ${level}` : ` H ${x} V ${level}`;
            path += ` H ${x + span}`;
          });
          return (
            <g key={name}>
              <text x="4" y={y + 14} fontSize="11" fontWeight="700" fill={colors[row] ?? "#334155"}>{name}</text>
              <path d={path} fill="none" stroke={colors[row] ?? "#334155"} strokeWidth="2" />
            </g>
          );
        })}
        {Array.from({ length: 16 }, (_, index) => <text key={index} x={48 + (index + 0.5) * (plot / 16)} y={28 + names.length * 28} textAnchor="middle" fontSize="10" fill="#64748b">{index}</text>)}
      </svg>
    </div>
  );
}

function StateTable({ mode, width, mod, dir, current, bits }: { mode: Mode; width: number; mod: number; dir: "up" | "down"; current: number; bits: Array<0 | 1> }) {
  if (mode === "ring" || mode === "johnson") {
    const rows: Array<Array<0 | 1>> = [];
    let cursor = bits;
    for (let index = 0; index < (mode === "ring" ? width : width * 2); index += 1) {
      rows.push(cursor);
      cursor = stepRegister(cursor, mode, 0).q;
    }
    return (
      <table className="data">
        <thead><tr><th>Present</th><th>Next</th></tr></thead>
        <tbody>{rows.map((row, index) => <tr key={row.join("") + index}><td className="mono">{row.join("")}</td><td className="mono">{stepRegister(row, mode, 0).q.join("")}</td></tr>)}</tbody>
      </table>
    );
  }
  return (
    <table className="data">
      <thead><tr><th>Present</th><th>Binary</th><th>Next</th></tr></thead>
      <tbody>
        {Array.from({ length: mod }, (_, state) => (
          <tr key={state} className={state === current % mod ? "on" : ""}>
            <td>{state}</td>
            <td className="mono">{wordOf(state, width)}</td>
            <td>{nextCount(state, mod, dir)} · {wordOf(nextCount(state, mod, dir), width)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DesignPanel() {
  const [text, setText] = useState("0,1,2,3,4,5");
  const [kind, setKind] = useState<"D" | "JK">("D");
  const sequence = text.split(",").map((part) => Number(part.trim())).filter((value) => Number.isInteger(value) && value >= 0);
  const width = Math.max(1, Math.ceil(Math.log2(Math.max(2, ...sequence, 1))));
  const design = sequence.length > 1 ? designCounter(sequence, width, kind) : null;
  return (
    <section className="lgx-card">
      <h3>Synchronous counter design</h3>
      <p>Enter the count sequence. The table is the state diagram, and each equation is the flip-flop input.</p>
      <label>Sequence<input aria-label="Count sequence" value={text} onChange={(event) => setText(event.target.value)} /></label>
      <div className="ctrx-mode">
        <button type="button" className={kind === "D" ? "on" : ""} onClick={() => setKind("D")}>D</button>
        <button type="button" className={kind === "JK" ? "on" : ""} onClick={() => setKind("JK")}>JK</button>
      </div>
      {design ? (
        <>
          <p className="tiny">{width} flip-flops. Unused states {design.unused.join(", ") || "none"} are don't-cares.</p>
          <table className="data"><thead><tr><th>State</th><th>Next</th></tr></thead><tbody>{design.rows.map((row) => <tr key={row.state}><td className="mono">{wordOf(row.state, width)}</td><td className="mono">{wordOf(row.next, width)}</td></tr>)}</tbody></table>
          {design.bits.map((bit) => <p key={bit.input + bit.name} className="mono">{bit.input}{bit.name.slice(1)} = {bit.expression}</p>)}
        </>
      ) : <p>Enter at least two states, such as 0,1,2,3,4,5 for MOD-6.</p>}
    </section>
  );
}
