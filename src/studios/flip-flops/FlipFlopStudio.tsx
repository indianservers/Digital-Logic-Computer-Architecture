import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button, Card, ExplainBar, Segmented, Signal, Toggle } from "../../design-system/ui";
import { Icon } from "../../design-system/icons";
import { CHARACTERISTIC, CONVERSIONS, dFlipFlop, dLatch, excitation, jkFlipFlop, masterSlaveJk, srNor, tFlipFlop, type Edge, type Level, type PairState } from "../../engines/digital/sequential";
import { FLIPFLOP_LESSONS } from "../../data/studioLessons";
import { usePrefs } from "../../store/prefs";
import { BitSwitch, useTicker, Waveform } from "../shared/widgets";

type Device = "sr" | "d" | "jk" | "t" | "dlatch" | "ms";
type Page = "lab" | "theory" | "practice" | "world" | "notes";
type Bit = 0 | 1;

const PAGES: Page[] = ["lab", "theory", "practice", "world", "notes"];
const DEVICES: Device[] = ["sr", "d", "jk", "t", "dlatch", "ms"];
const NOTES_KEY = "logiclab.flipflops.notes";

const DEVICE_FROM_TAB: Record<string, Device> = {
  latches: "sr", sr: "sr", dlatch: "dlatch", dff: "d", jk: "jk", t: "t", ms: "ms",
};
const PAGE_FROM_TAB: Record<string, Page> = { tables: "theory", convert: "theory" };

const PAGE_TABS: Array<{ id: Page; label: string; icon: "play" | "book" | "practice" | "grid" | "sheet" }> = [
  { id: "lab", label: "Interactive Lab", icon: "play" },
  { id: "theory", label: "Theory & Concepts", icon: "book" },
  { id: "practice", label: "Practice", icon: "practice" },
  { id: "world", label: "Real-World", icon: "grid" },
  { id: "notes", label: "Notes", icon: "sheet" },
];

const DEVICE_META: Record<Device, { title: string; hint: string; mark: string }> = {
  sr: { title: "SR Latch", hint: "Set-Reset", mark: "SR" },
  d: { title: "D Flip-Flop", hint: "Data", mark: "D" },
  jk: { title: "JK Flip-Flop", hint: "Versatile", mark: "JK" },
  t: { title: "T Flip-Flop", hint: "Toggle", mark: "T" },
  dlatch: { title: "D Latch", hint: "Level", mark: "EN" },
  ms: { title: "Master-Slave", hint: "JK pair", mark: "MS" },
};

const GUIDE = [
  "Explore each latch/flip-flop type",
  "Simulate and study behavior",
  "View timing diagrams",
  "Analyze state transition tables",
  "Try the practice challenge",
];

const TAKEAWAYS = [
  "Latches and flip-flops store 1 bit of data",
  "Different types suit different needs",
  "Timing diagrams show signal behavior",
  "Edge triggering prevents unwanted changes",
  "Invalid states must be avoided",
  "Flip-flops are essential in sequential circuits",
];

const WORLD = [
  { title: "Registers", note: "CPU data storage", to: "/studios/registers" },
  { title: "Counters", note: "Event counting", to: "/studios/counters" },
  { title: "Memory", note: "RAM and caches", to: "/studios/memory" },
  { title: "Debounce", note: "Switch stabilization", to: "/studios/timing" },
];

interface Sample {
  s: Bit; r: Bit; d: Bit; j: Bit; k: Bit; t: Bit; en: Bit; clk: Bit; q: Level; qn: Level;
}

function bitOf(value: Level): 0 | 1 | "X" {
  return value === 1 ? 1 : value === "X" ? "X" : 0;
}

function qnOf(q: Level): Level {
  return q === "X" ? "X" : q === 1 ? 0 : 1;
}

export function FlipFlopStudio() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab") ?? "lab";
  const page: Page = PAGES.includes(raw as Page) ? raw as Page : DEVICE_FROM_TAB[raw] ? "lab" : PAGE_FROM_TAB[raw] ?? "lab";
  const device: Device = DEVICES.includes((params.get("device") ?? "") as Device)
    ? params.get("device") as Device
    : DEVICE_FROM_TAB[raw] ?? "sr";

  function setPage(next: Page) {
    const query = new URLSearchParams(params);
    query.set("tab", next);
    query.set("device", device);
    setParams(query);
  }
  function setDevice(next: Device) {
    const query = new URLSearchParams(params);
    query.set("tab", "lab");
    query.set("device", next);
    setParams(query);
  }

  return (
    <div className="lgx ff-page">
      <header className="lgx-head">
        <div className="lgx-title">
          <span className="lgx-mark"><Icon name="table" size={22} /></span>
          <div>
            <h1>Latches & Flip-Flops</h1>
            <p>Explore SR, D, JK, and T latches and flip-flops. Simulate circuits, visualize timing, and understand their behavior step by step.</p>
          </div>
        </div>
        <Link to="/" className="lgx-back"><Icon name="back" size={14} /> Back to Path</Link>
      </header>
      <div className="lgx-tabs" role="tablist">
        {PAGE_TABS.map((item) => (
          <button key={item.id} role="tab" aria-selected={page === item.id} className={page === item.id ? "on" : ""} onClick={() => setPage(item.id)}>
            <Icon name={item.icon} size={14} /> {item.label}
          </button>
        ))}
      </div>
      {page === "lab" ? <Lab device={device} onDevice={setDevice} onPractice={() => setPage("practice")} /> : null}
      {page === "theory" ? <TheoryPanel device={device} onDevice={setDevice} /> : null}
      {page === "practice" ? <PracticePanel onOpen={(next) => setDevice(next)} /> : null}
      {page === "world" ? <WorldPanel /> : null}
      {page === "notes" ? <NotesPanel /> : null}
    </div>
  );
}

function Lab({ device, onDevice, onPractice }: { device: Device; onDevice: (next: Device) => void; onPractice: () => void }) {
  const { prefs } = usePrefs();
  const [s, setS] = useState(true);
  const [r, setR] = useState(false);
  const [d, setD] = useState(true);
  const [j, setJ] = useState(true);
  const [k, setK] = useState(true);
  const [t, setT] = useState(true);
  const [en, setEn] = useState(true);
  const [edge, setEdge] = useState<Edge>("rise");
  const [clock, setClock] = useState<Bit>(0);
  const [q, setQ] = useState<Level>(1);
  const [master, setMaster] = useState<Level>(0);
  const [slave, setSlave] = useState<Level>(0);
  const [samples, setSamples] = useState<Sample[]>(() => seed("sr"));
  const [cursor, setCursor] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [heldWithoutClock, setHeldWithoutClock] = useState(false);
  const [captured, setCaptured] = useState(false);
  const [toggled, setToggled] = useState(false);

  const live = useMemo(() => evaluate(device, { s, r, d, j, k, t, en, clock, q, master, slave, edge }), [device, s, r, d, j, k, t, en, clock, q, master, slave, edge]);

  useEffect(() => {
    setSamples(seed(device));
    setCursor(null);
    setPlaying(false);
    setClock(0);
    setHeldWithoutClock(false);
    setCaptured(false);
    setToggled(false);
    if (device === "sr") { setS(true); setR(false); setQ(1); }
    else setQ(0);
  }, [device]);

  function snapshot(nextQ: Level, nextClock: Bit = clock): Sample {
    return { s: s ? 1 : 0, r: r ? 1 : 0, d: d ? 1 : 0, j: j ? 1 : 0, k: k ? 1 : 0, t: t ? 1 : 0, en: en ? 1 : 0, clk: nextClock, q: nextQ, qn: qnOf(device === "ms" ? slave : nextQ) };
  }

  function push(sample: Sample) {
    setSamples((items) => [...items, sample].slice(-28));
    setCursor(null);
  }

  function applyLatch(nextS = s, nextR = r, nextD = d, nextEn = en) {
    if (device === "sr") {
      const next = srNor(nextS ? 1 : 0, nextR ? 1 : 0, q);
      setQ(next.q);
      push({ ...snapshot(next.q), s: nextS ? 1 : 0, r: nextR ? 1 : 0 });
    } else if (device === "dlatch") {
      const next = dLatch(nextD ? 1 : 0, nextEn ? 1 : 0, q);
      setQ(next.q);
      push({ ...snapshot(next.q), d: nextD ? 1 : 0, en: nextEn ? 1 : 0 });
    }
  }

  function step() {
    if (device === "sr" || device === "dlatch") {
      applyLatch();
      return;
    }
    const nextClock: Bit = clock === 0 ? 1 : 0;
    if (device === "ms") {
      const next = masterSlaveJk(j ? 1 : 0, k ? 1 : 0, nextClock, clock, master, slave);
      setMaster(next.master);
      setSlave(next.slave);
      setClock(nextClock);
      setQ(next.slave);
      push({ ...snapshot(next.slave, nextClock), clk: nextClock, qn: qnOf(next.slave) });
      return;
    }
    const before = q;
    const next = device === "d"
      ? dFlipFlop(d ? 1 : 0, nextClock, clock, q, edge)
      : device === "jk"
        ? jkFlipFlop(j ? 1 : 0, k ? 1 : 0, nextClock, clock, q, "rise")
        : tFlipFlop(t ? 1 : 0, nextClock, clock, q, "rise");
    setQ(next.q);
    setClock(nextClock);
    if (device === "d" && next.q === (d ? 1 : 0) && next.label !== "hold") setCaptured(true);
    if ((device === "jk" || device === "t") && before !== "X" && next.q !== before && next.label === "toggle") setToggled(true);
    push({ ...snapshot(next.q, nextClock), clk: nextClock });
  }

  useTicker(playing, speed, step);

  const shownQ = device === "sr" || device === "dlatch" ? live.q : q;
  const shownQn = device === "ms" ? qnOf(slave) : qnOf(shownQ);
  const invalid = device === "sr" && s && r;
  const traceQ = samples.map((item) => bitOf(item.q));
  const names = traceNames(device);

  return (
    <div className="ff-layout">
      <div className="ff-main">
        <div className="ff-devices" role="tablist" aria-label="Latch or flip-flop">
          {(["sr", "d", "jk", "t"] as Device[]).map((id) => (
            <button key={id} role="tab" aria-selected={device === id} className={device === id ? "ff-device on" : "ff-device"} onClick={() => onDevice(id)}>
              <b>{DEVICE_META[id].mark}</b>
              <span>{DEVICE_META[id].title}</span>
              <small>{DEVICE_META[id].hint}</small>
            </button>
          ))}
        </div>
        {(device === "dlatch" || device === "ms") ? (
          <p className="tiny">Opened from the learning path: {DEVICE_META[device].title}. The four chips above are the main lab.</p>
        ) : null}

        <div className="ff-split">
          <Card title={`Interactive Circuit — ${circuitTitle(device)}`} action={<span className="ff-live">Live</span>}>
            <p className="tiny">Click inputs or use switches to simulate. Observe the outputs and truth table in real time.</p>
            <div className="ff-circuit">
              <div className="ff-inputs">
                {device === "sr" ? (
                  <>
                    <Toggle on={s} onChange={(next) => { setS(next); applyLatch(next, r); }} label="S (Set)" tone="primary" />
                    <Toggle on={r} onChange={(next) => { setR(next); applyLatch(s, next); }} label="R (Reset)" tone="danger" />
                  </>
                ) : null}
                {device === "dlatch" ? (
                  <>
                    <Toggle on={d} onChange={(next) => { setD(next); applyLatch(s, r, next, en); }} label="D" />
                    <Toggle on={en} onChange={(next) => { setEn(next); applyLatch(s, r, d, next); }} label="EN" tone="ok" />
                  </>
                ) : null}
                {device === "d" ? <BitSwitch label="D" on={d} onChange={(next) => { setD(next); if (!playing) setHeldWithoutClock(true); }} /> : null}
                {device === "jk" || device === "ms" ? (
                  <>
                    <BitSwitch label="J" on={j} onChange={setJ} />
                    <BitSwitch label="K" on={k} onChange={setK} />
                  </>
                ) : null}
                {device === "t" ? <BitSwitch label="T" on={t} onChange={setT} /> : null}
              </div>
              <LatchDiagram device={device} s={s} r={r} d={d} en={en} j={j} k={k} t={t} q={shownQ} qn={shownQn} clock={clock} />
              <div className="ff-outputs">
                <Output name="Q" value={shownQ} />
                <Output name="Q̅" value={shownQn} />
              </div>
            </div>
            <div className="ff-controls">
              <Button onClick={() => { setPlaying(false); setClock(0); setQ(device === "sr" ? 1 : 0); setS(true); setR(false); setMaster(0); setSlave(0); setSamples(seed(device)); }}><Icon name="reset" size={14} /> Reset</Button>
              <Button onClick={step}><Icon name="step" size={14} /> Step</Button>
              <button className="lgx-play" type="button" onClick={() => setPlaying((value) => !value)}>{playing ? <><Icon name="pause" size={14} /> Pause</> : <><Icon name="play" size={14} /> Auto Run</>}</button>
              <label className="lgx-slider">Simulation Speed
                <input aria-label="Simulation speed" type="range" min={0.5} max={4} step={0.5} value={speed} onChange={(event) => setSpeed(Number(event.target.value))} />
                <span>{speed}×</span>
              </label>
            </div>
            {prefs.explain ? <ExplainBar what={explainWhat(device, live, { s, r, d, en, j, k, t })} why={explainWhy(device)} notice={device === "d" ? (edge === "rise" ? "A high clock that stays high does not capture again." : "The falling edge is the sample point.") : "Step and Auto Run append this moment to the timing diagram."} /> : null}
          </Card>

          <Card title={`Truth Table — ${circuitTitle(device)}`}>
            <table className="lgx-table">
              <thead>
                <tr>{truthHead(device).map((cell) => <th key={cell}>{cell}</th>)}</tr>
              </thead>
              <tbody>
                {truthRows(device).map((row) => (
                  <tr key={row.key} className={row.active(s, r, d, j, k, t, en) ? "on" : ""}>
                    {row.cells.map((cell) => <td key={cell}>{cell}</td>)}
                    <td><span className={`ff-pill ${row.tone}`}>{row.state}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {invalid ? <p className="ff-invalid">Invalid state. For an SR latch, S = 1 and R = 1 is not allowed. Both outputs cannot be 0.</p> : null}
          </Card>
        </div>

        <div className="ff-split">
          <Card title="Timing Diagram" action={<span className="tiny">200 ns/div</span>}>
            <p className="tiny">Visualize how inputs and outputs change over time.</p>
            <div className="lgx-wavebar">
              <button type="button" aria-label={playing ? "Pause timing" : "Play timing"} onClick={() => setPlaying((value) => !value)}>{playing ? <Icon name="pause" size={14} /> : <Icon name="play" size={14} />}</button>
              <input aria-label="Timing cursor" type="range" min={0} max={Math.max(0, samples.length - 1)} value={cursor ?? samples.length - 1} onChange={(event) => setCursor(Number(event.target.value))} />
            </div>
            <Waveform cursor={cursor} onCursor={setCursor} traces={names.map((item) => ({ id: item.id, name: item.name, values: item.pick(samples), color: item.color, active: item.id === "q" }))} />
            <p className="tiny">Showing {traceQ.length} samples. Drag the slider to scrub.</p>
          </Card>
          <Card title="State Transition Table">
            <p className="tiny">Shows the next state for each input combination.</p>
            <table className="lgx-table">
              <thead><tr>{transitionHead(device).map((cell) => <th key={cell}>{cell}</th>)}</tr></thead>
              <tbody>
                {transitionRows(device, shownQ).map((row) => (
                  <tr key={row.key} className={row.on ? "on" : ""}>
                    {row.cells.map((cell) => <td key={`${row.key}-${cell}`}>{cell}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>

        <div className="ff-bottom">
          <Card title="Characteristic Equation">
            <p className="expr">{equation(device).expr}</p>
            <p className="tiny">{equation(device).note}</p>
          </Card>
          <Card title="Edge Triggering Preview (D Flip-Flop)" action={<Segmented options={["rise", "fall"]} value={edge} onChange={(value) => setEdge(value as Edge)} />}>
            <p className="tiny">Observe how a D flip-flop samples input on the clock edge.</p>
            <Waveform traces={[
              { id: "clk", name: "CLK", values: samples.map((item) => item.clk), color: "#7c3aed" },
              { id: "d", name: "D", values: samples.map((item) => item.d), color: "#2563eb" },
              { id: "q", name: "Q", values: traceQ, color: "#16a34a", active: true },
            ]} />
            <p className="tiny">{edge === "rise" ? "Samples input on the rising edge." : "Samples input on the falling edge."} {heldWithoutClock && !captured ? "D changed, and Q is still waiting for that edge." : ""}</p>
          </Card>
          <Card title="Real-World Examples">
            <p className="tiny">Latches and flip-flops are used everywhere.</p>
            <div className="ff-world">
              {WORLD.map((item) => (
                <Link key={item.title} to={item.to} className="ff-world-card">
                  <b>{item.title}</b>
                  <span>{item.note}</span>
                </Link>
              ))}
            </div>
          </Card>
        </div>
      </div>
      <Guide device={device} captured={captured} held={heldWithoutClock} toggled={toggled} jkReady={j && k} onPractice={onPractice} onTryD={() => onDevice("d")} />
    </div>
  );
}

function evaluate(device: Device, input: { s: boolean; r: boolean; d: boolean; j: boolean; k: boolean; t: boolean; en: boolean; clock: Bit; q: Level; master: Level; slave: Level; edge: Edge }): PairState {
  if (device === "sr") return srNor(input.s ? 1 : 0, input.r ? 1 : 0, input.q);
  if (device === "dlatch") return dLatch(input.d ? 1 : 0, input.en ? 1 : 0, input.q);
  if (device === "d") return dFlipFlop(input.d ? 1 : 0, input.clock, input.clock === 1 ? 0 : 1, input.q, input.edge);
  if (device === "jk") return { q: input.q, qn: qnOf(input.q), label: input.j && input.k ? "toggle" : input.j ? "set" : input.k ? "reset" : "hold" };
  if (device === "t") return { q: input.q, qn: qnOf(input.q), label: input.t ? "toggle" : "hold" };
  return { q: input.slave, qn: qnOf(input.slave), label: input.clock === 1 ? "transparent" : "hold" };
}

function seed(device: Device): Sample[] {
  let q: Level = 0;
  let master: Level = 0;
  let slave: Level = 0;
  const items: Sample[] = [];
  for (let index = 0; index < 16; index += 1) {
    const s: Bit = index % 7 === 3 ? 1 : 0;
    const r: Bit = index % 7 === 5 ? 1 : 0;
    const d: Bit = index % 4 < 2 ? 0 : 1;
    const j: Bit = 1;
    const k: Bit = 1;
    const t: Bit = 1;
    const en: Bit = index % 5 === 0 ? 0 : 1;
    const clk: Bit = index % 2 === 0 ? 0 : 1;
    const prev: Bit = clk === 1 ? 0 : 1;
    if (device === "sr") q = srNor(s, r, q).q;
    else if (device === "dlatch") q = dLatch(d, en, q).q;
    else if (device === "d") q = dFlipFlop(d, clk, prev, q, "rise").q;
    else if (device === "jk") q = jkFlipFlop(j, k, clk, prev, q, "rise").q;
    else if (device === "t") q = tFlipFlop(t, clk, prev, q, "rise").q;
    else {
      const next = masterSlaveJk(j, k, clk, prev, master, slave);
      master = next.master;
      slave = next.slave;
      q = slave;
    }
    items.push({ s, r, d, j, k, t, en, clk, q, qn: qnOf(device === "ms" ? slave : q) });
  }
  return items;
}

function traceNames(device: Device): Array<{ id: string; name: string; color: string; pick: (items: Sample[]) => Array<0 | 1 | "X"> }> {
  const q = { id: "q", name: "Q", color: "#16a34a", pick: (items: Sample[]) => items.map((item) => bitOf(item.q)) };
  const qn = { id: "qn", name: "Q̅", color: "#ea580c", pick: (items: Sample[]) => items.map((item) => bitOf(item.qn)) };
  if (device === "sr") return [
    { id: "s", name: "S", color: "#2563eb", pick: (items) => items.map((item) => item.s) },
    { id: "r", name: "R", color: "#7c3aed", pick: (items) => items.map((item) => item.r) },
    q, qn,
  ];
  if (device === "dlatch") return [
    { id: "d", name: "D", color: "#2563eb", pick: (items) => items.map((item) => item.d) },
    { id: "en", name: "EN", color: "#7c3aed", pick: (items) => items.map((item) => item.en) },
    q,
  ];
  if (device === "jk" || device === "ms") return [
    { id: "clk", name: "CLK", color: "#64748b", pick: (items) => items.map((item) => item.clk) },
    { id: "j", name: "J", color: "#2563eb", pick: (items) => items.map((item) => item.j) },
    { id: "k", name: "K", color: "#7c3aed", pick: (items) => items.map((item) => item.k) },
    q,
  ];
  if (device === "t") return [
    { id: "clk", name: "CLK", color: "#64748b", pick: (items) => items.map((item) => item.clk) },
    { id: "t", name: "T", color: "#2563eb", pick: (items) => items.map((item) => item.t) },
    q,
  ];
  return [
    { id: "clk", name: "CLK", color: "#64748b", pick: (items) => items.map((item) => item.clk) },
    { id: "d", name: "D", color: "#2563eb", pick: (items) => items.map((item) => item.d) },
    q,
  ];
}

function circuitTitle(device: Device): string {
  if (device === "sr") return "SR Latch (NOR)";
  if (device === "dlatch") return "D Latch";
  if (device === "d") return "D Flip-Flop";
  if (device === "jk") return "JK Flip-Flop";
  if (device === "t") return "T Flip-Flop";
  return "Master-Slave JK";
}

function truthHead(device: Device): string[] {
  if (device === "sr") return ["S", "R", "Q (next)", "Q̅ (next)", "State"];
  if (device === "d" || device === "dlatch") return ["D", "Q (next)", "State"];
  if (device === "jk" || device === "ms") return ["J", "K", "Q (next)", "State"];
  return ["T", "Q (next)", "State"];
}

function truthRows(device: Device): Array<{ key: string; cells: string[]; state: string; tone: string; active: (s: boolean, r: boolean, d: boolean, j: boolean, k: boolean, t: boolean, en: boolean) => boolean }> {
  if (device === "sr") return [
    { key: "00", cells: ["0", "0", "Q", "Q̅"], state: "Hold", tone: "hold", active: (s, r) => !s && !r },
    { key: "01", cells: ["0", "1", "0", "1"], state: "Reset", tone: "reset", active: (s, r) => !s && r },
    { key: "10", cells: ["1", "0", "1", "0"], state: "Set", tone: "set", active: (s, r) => s && !r },
    { key: "11", cells: ["1", "1", "—", "—"], state: "Invalid", tone: "bad", active: (s, r) => s && r },
  ];
  if (device === "d" || device === "dlatch") return [
    { key: "0", cells: ["0", "0"], state: device === "dlatch" ? "Follow" : "Capture 0", tone: "reset", active: (_s, _r, d) => !d },
    { key: "1", cells: ["1", "1"], state: device === "dlatch" ? "Follow" : "Capture 1", tone: "set", active: (_s, _r, d) => d },
  ];
  if (device === "t") return [
    { key: "0", cells: ["0", "Q"], state: "Hold", tone: "hold", active: (_s, _r, _d, _j, _k, t) => !t },
    { key: "1", cells: ["1", "Q̅"], state: "Toggle", tone: "set", active: (_s, _r, _d, _j, _k, t) => t },
  ];
  return [
    { key: "00", cells: ["0", "0", "Q"], state: "Hold", tone: "hold", active: (_s, _r, _d, j, k) => !j && !k },
    { key: "01", cells: ["0", "1", "0"], state: "Reset", tone: "reset", active: (_s, _r, _d, j, k) => !j && k },
    { key: "10", cells: ["1", "0", "1"], state: "Set", tone: "set", active: (_s, _r, _d, j, k) => j && !k },
    { key: "11", cells: ["1", "1", "Q̅"], state: "Toggle", tone: "set", active: (_s, _r, _d, j, k) => j && k },
  ];
}

function transitionHead(device: Device): string[] {
  if (device === "sr") return ["Present Q", "S", "R", "Next Q", "Description"];
  if (device === "jk" || device === "ms") return ["Present Q", "J", "K", "Next Q", "Description"];
  if (device === "t") return ["Present Q", "T", "Next Q", "Description"];
  return ["Present Q", "D", "Next Q", "Description"];
}

function transitionRows(device: Device, q: Level): Array<{ key: string; cells: string[]; on: boolean }> {
  const present: Bit = q === 1 ? 1 : 0;
  if (device === "sr") {
    return [0, 1].flatMap((pq) => [
      [pq, 0, 0, String(pq), "No change"],
      [pq, 0, 1, "0", "Reset"],
      [pq, 1, 0, "1", "Set"],
      [pq, 1, 1, "—", "Invalid"],
    ] as Array<[number, number, number, string, string]>).map(([pq, sv, rv, next, note]) => ({
      key: `${pq}${sv}${rv}`,
      cells: [String(pq), String(sv), String(rv), next, note],
      on: present === pq && false,
    }));
  }
  if (device === "d" || device === "dlatch") {
    return [0, 1].flatMap((pq) => [0, 1].map((dv) => ({
      key: `${pq}${dv}`,
      cells: [String(pq), String(dv), String(dv), dv === pq ? "No change" : "Load D"],
      on: present === pq,
    })));
  }
  if (device === "t") {
    return [0, 1].flatMap((pq) => [0, 1].map((tv) => ({
      key: `${pq}${tv}`,
      cells: [String(pq), String(tv), String(tv === 1 ? 1 - pq : pq), tv === 1 ? "Toggle" : "No change"],
      on: present === pq,
    })));
  }
  return [0, 1].flatMap((pq) => [
    [pq, 0, 0, String(pq), "No change"],
    [pq, 0, 1, "0", "Reset"],
    [pq, 1, 0, "1", "Set"],
    [pq, 1, 1, String(1 - pq), "Toggle"],
  ] as Array<[number, number, number, string, string]>).map(([pq, jv, kv, next, note]) => ({
    key: `${pq}${jv}${kv}`,
    cells: [String(pq), String(jv), String(kv), next, note],
    on: present === pq,
  }));
}

function equation(device: Device): { expr: string; note: string } {
  if (device === "sr") return { expr: "Q(t + 1) = S + R̅Q(t)", note: "Valid for the SR latch (NOR). S = R = 1 is excluded." };
  if (device === "dlatch") return { expr: "Q = EN·D + EN̅·Q", note: "Transparent while EN is 1. Holds while EN is 0." };
  if (device === "d") return { expr: "Q(t + 1) = D", note: "The active clock edge copies D. Between edges Q holds." };
  if (device === "t") return { expr: "Q(t + 1) = T ⊕ Q(t)", note: "T = 1 toggles. T = 0 holds." };
  return { expr: "Q(t + 1) = JQ̅ + K̅Q", note: "J = K = 1 toggles. There is no SR invalid row." };
}

function explainWhat(device: Device, live: PairState, input: { s: boolean; r: boolean; d: boolean; en: boolean; j: boolean; k: boolean; t: boolean }): string {
  if (device === "sr") return `NOR latch is ${live.label}. Q is ${live.q}.`;
  if (device === "dlatch") return input.en ? "Enabled: Q follows D immediately." : "Disabled: Q keeps the stored bit.";
  if (device === "d") return `Stored Q is ${live.q}. The next edge would capture D = ${input.d ? 1 : 0}.`;
  if (device === "jk") return `JK mode is ${input.j && input.k ? "toggle" : input.j ? "set" : input.k ? "reset" : "hold"}.`;
  if (device === "t") return input.t ? "T = 1 toggles on the rising edge." : "T = 0 holds Q.";
  return "The master samples while CLK is high. The slave copies it on the falling edge.";
}

function explainWhy(device: Device): string {
  if (device === "sr") return "Cross-coupled NOR gates hold the bit. S = R = 1 forces both outputs low, which is not a stored state.";
  if (device === "d") return "Q(next) equals D only on the active edge.";
  const key = device === "dlatch" ? "dlatch" : device === "ms" ? "ms" : device === "jk" ? "jk" : "t";
  return FLIPFLOP_LESSONS[key]?.theory.body ?? "";
}

function LatchDiagram({ device, s, r, d, en, j, k, t, q, qn, clock }: { device: Device; s: boolean; r: boolean; d: boolean; en: boolean; j: boolean; k: boolean; t: boolean; q: Level; qn: Level; clock: Bit }) {
  const top = device === "sr" ? (s ? "high" : "low") : "low";
  const bot = device === "sr" ? (r ? "high" : "low") : "low";
  const label = device === "sr" || device === "dlatch" ? "NOR" : device === "ms" ? "MS" : device.toUpperCase();
  return (
    <svg viewBox="0 0 280 120" className="ff-diagram" role="img" aria-label={`${circuitTitle(device)} diagram`}>
      <path className={`wire ${top}`} d="M18 28 H70" />
      <path className={`wire ${bot}`} d="M18 92 H70" />
      <path className={`wire ${q === 1 ? "high" : "low"}`} d="M150 36 H230" />
      <path className={`wire ${qn === 1 ? "high" : "low"}`} d="M150 84 H230" />
      <path className={`wire ${qn === 1 ? "high" : "low"}`} d="M150 84 H168 V48 H78" />
      <path className={`wire ${q === 1 ? "high" : "low"}`} d="M150 36 H168 V72 H78" />
      <polygon points="70,16 150,28 150,44 70,56" fill="white" stroke="#34507a" />
      <polygon points="70,64 150,76 150,92 70,104" fill="white" stroke="#34507a" />
      <text x="108" y="40" textAnchor="middle" fontSize="11">{label}</text>
      <text x="108" y="88" textAnchor="middle" fontSize="11">{device === "sr" ? "NOR" : label}</text>
      <text x="24" y="24" fontSize="11">{device === "sr" ? "S" : device === "d" || device === "dlatch" ? "D" : device === "t" ? "T" : "J"} {device === "sr" ? (s ? 1 : 0) : device === "t" ? (t ? 1 : 0) : device === "jk" || device === "ms" ? (j ? 1 : 0) : (d ? 1 : 0)}</text>
      <text x="24" y="112" fontSize="11">{device === "sr" ? `R ${r ? 1 : 0}` : device === "dlatch" ? `EN ${en ? 1 : 0}` : `CLK ${clock}`}</text>
      {device !== "sr" && device !== "dlatch" ? <text x="236" y="18" fontSize="11" fill="#64748b">edge</text> : null}
      {k && device === "jk" ? null : null}
    </svg>
  );
}

function Output({ name, value }: { name: string; value: Level }) {
  return (
    <div className="ff-out">
      <span>{name}</span>
      <Signal value={value === "X" ? "X" : value} />
    </div>
  );
}

function Guide({ device, captured, held, toggled, jkReady, onPractice, onTryD }: { device: Device; captured: boolean; held: boolean; toggled: boolean; jkReady: boolean; onPractice: () => void; onTryD: () => void }) {
  const [hint, setHint] = useState("");
  const dReady = held && captured;
  const jkDone = device === "jk" && jkReady && toggled;
  return (
    <aside className="ff-side">
      <section className="lgx-card lgx-guide">
        <h3><Icon name="book" size={16} /> Studio Guide</h3>
        <p className="tiny">Master how latches and flip-flops work, from basic SR latches to edge-triggered designs.</p>
        <ol>{GUIDE.map((step, index) => <li key={step}><span>{index + 1}</span>{step}</li>)}</ol>
      </section>
      <section className="lgx-card lgx-takes">
        <h3>Key Takeaways</h3>
        <ul>{TAKEAWAYS.map((item) => <li key={item}>{item}</li>)}</ul>
      </section>
      <section className="lgx-card">
        <div className="spread"><h3><Icon name="practice" size={16} /> Practice Challenge</h3><button className="lgx-hint" type="button" onClick={onTryD}>Try it</button></div>
        <p>Design an edge-triggered D flip-flop using the D chip. Change D, confirm Q holds, then Step so the timing diagram captures D.</p>
        <label className="ff-check"><input type="checkbox" checked={held} readOnly /> D changed before the capturing edge</label>
        <label className="ff-check"><input type="checkbox" checked={captured} readOnly /> Q matches D after Step</label>
        <label className="ff-check"><input type="checkbox" checked={jkDone} readOnly /> JK with J = K = 1 toggled</label>
        <div className="ff-challenge-actions">
          <button className="lgx-check" type="button" onClick={onPractice}>Start Challenge</button>
          <button className="lgx-hint" type="button" onClick={() => setHint(hint ? "" : "On the D flip-flop, flip D and watch Q stay put. Press Step twice so the clock rises. Q should become D. For the path task, open JK, set J and K, then Step until Q flips.")}>{hint ? "Hide hints" : "View Hints"}</button>
        </div>
        {hint ? <p className="tiny">{hint}</p> : null}
        {dReady ? <p className="tiny">D capture check passed.</p> : null}
      </section>
    </aside>
  );
}

function TheoryPanel({ device, onDevice }: { device: Device; onDevice: (next: Device) => void }) {
  const lessonKey = device === "sr" ? "latches" : device === "d" ? "dff" : device === "dlatch" ? "dlatch" : device === "ms" ? "ms" : device;
  const lesson = FLIPFLOP_LESSONS[lessonKey] ?? FLIPFLOP_LESSONS.latches;
  const [kind, setKind] = useState<"SR" | "D" | "JK" | "T">("SR");
  const [q, setQ] = useState<Bit>(0);
  const [next, setNext] = useState<Bit>(1);
  const need = excitation(kind, q, next);
  return (
    <div className="grid cards-2">
      <Card title={lesson?.theory.title}>
        <div className="ff-devices compact">
          {(Object.keys(DEVICE_META) as Device[]).map((id) => (
            <button key={id} className={device === id ? "ff-device on" : "ff-device"} onClick={() => onDevice(id)}>{DEVICE_META[id].title}</button>
          ))}
        </div>
        <p>{lesson?.theory.body}</p>
        <p className="expr">{equation(device).expr}</p>
      </Card>
      <Card title="Characteristic" action={<Segmented options={["SR", "D", "JK", "T"]} value={kind} onChange={(value) => setKind(value as typeof kind)} />}>
        <table className="lgx-table">{CHARACTERISTIC[kind].map((row, index) => <tr key={index}>{row.map((cell) => index === 0 ? <th key={cell}>{cell}</th> : <td key={cell}>{cell}</td>)}</tr>)}</table>
        <div className="row"><BitSwitch label="Q" on={q === 1} onChange={(on) => setQ(on ? 1 : 0)} /><BitSwitch label="Q+" on={next === 1} onChange={(on) => setNext(on ? 1 : 0)} /></div>
        {Object.entries(need).map(([name, value]) => <p key={name} className="expr">{name} = {value}</p>)}
      </Card>
      {CONVERSIONS.map((item) => (
        <Card key={item.id} title={`${item.source} → ${item.target}`}>
          {item.equations.map((line) => <p key={line} className="expr">{line}</p>)}
          <p className="tiny">{item.note}</p>
        </Card>
      ))}
    </div>
  );
}

function PracticePanel({ onOpen }: { onOpen: (device: Device) => void }) {
  return (
    <div className="grid cards-2">
      <Card title="Edge-triggered D">
        <p>Change D without a clock and confirm Q holds. Step until the rising edge copies D into Q.</p>
        <Button variant="primary" onClick={() => onOpen("d")}>Open D flip-flop</Button>
      </Card>
      <Card title="JK toggle">
        <p>Set J = K = 1 and clock until Q flips. That is the path task for this studio.</p>
        <Button variant="primary" onClick={() => onOpen("jk")}>Open JK flip-flop</Button>
      </Card>
      <Card title="Avoid the invalid SR input">
        <p>On the NOR SR latch, S = R = 1 is not a stored state. Set one input, then release it and watch the hold.</p>
        <Button onClick={() => onOpen("sr")}>Open SR latch</Button>
      </Card>
      <Card title="T divides the clock">
        <p>With T = 1, Q flips on every rising edge, so the output period is twice the clock.</p>
        <Button onClick={() => onOpen("t")}>Open T flip-flop</Button>
      </Card>
    </div>
  );
}

function WorldPanel() {
  return (
    <div className="grid cards-2">
      {WORLD.map((item) => (
        <Card key={item.title} title={item.title}>
          <p>{item.note}</p>
          <Link to={item.to} className="lgx-back">Open studio</Link>
        </Card>
      ))}
    </div>
  );
}

function NotesPanel() {
  const [notes, setNotes] = useState(() => localStorage.getItem(NOTES_KEY) ?? "");
  return (
    <section className="lgx-card lgx-focus">
      <h3>Studio notes</h3>
      <textarea aria-label="Latch and flip-flop notes" value={notes} rows={10} onChange={(event) => { setNotes(event.target.value); localStorage.setItem(NOTES_KEY, event.target.value); }} />
    </section>
  );
}
