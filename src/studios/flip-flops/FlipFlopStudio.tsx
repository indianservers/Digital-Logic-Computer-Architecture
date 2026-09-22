import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button, Card, ExplainBar, Segmented } from "../../design-system/ui";
import { CHARACTERISTIC, CONVERSIONS, dFlipFlop, dLatch, excitation, gatedSr, jkFlipFlop, masterSlaveJk, srFlipFlop, srNand, srNor, tFlipFlop, type Edge, type Level } from "../../engines/digital/sequential";
import { StudioFrame } from "../../layout/StudioFrame";
import { usePrefs } from "../../store/prefs";
import { BitSwitch, SpeedPicker, useTicker, Waveform } from "../shared/widgets";

function levelBit(value: Level): 0 | 1 | "X" {
  if (value === 1) return 1;
  if (value === "X") return "X";
  return 0;
}

const TABS = [
  { id: "latches", label: "Latches" },
  { id: "dlatch", label: "D latch" },
  { id: "sr", label: "SR FF" },
  { id: "dff", label: "D FF" },
  { id: "jk", label: "JK FF" },
  { id: "t", label: "T FF" },
  { id: "ms", label: "Master-slave" },
  { id: "tables", label: "Tables" },
  { id: "convert", label: "Conversion" },
];

export function FlipFlopStudio() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "latches";
  const [resetKey, setResetKey] = useState(0);
  return (
    <StudioFrame icon="table" title="Latches & Flip-Flops" description="Level-sensitive storage, then the same idea sampled on a clock edge." tabs={TABS} tab={tab} onTab={(id) => setParams({ tab: id })} onReset={() => setResetKey((n) => n + 1)} guide={["Set and reset the NOR latch", "Enable the D latch and see it go transparent", "Clock a D flip-flop on one edge only", "Make JK toggle"]} takeaways={["A latch follows while it is open", "A flip-flop samples on an edge", "NAND SR inputs are active low", "J = K = 1 toggles"]}>
      <div key={resetKey}>
        {tab === "latches" ? <LatchLab /> : null}
        {tab === "dlatch" ? <DLatchLab /> : null}
        {tab === "sr" ? <SrFfLab /> : null}
        {tab === "dff" ? <DffLab /> : null}
        {tab === "jk" ? <JkLab /> : null}
        {tab === "t" ? <TLab /> : null}
        {tab === "ms" ? <MsLab /> : null}
        {tab === "tables" ? <TableLab /> : null}
        {tab === "convert" ? <ConvertLab /> : null}
      </div>
    </StudioFrame>
  );
}

function LatchLab() {
  const [s, setS] = useState(false);
  const [r, setR] = useState(false);
  const [q, setQ] = useState<Level>(0);
  const [kind, setKind] = useState("nor");
  const [en, setEn] = useState(true);
  const next = kind === "nand" ? srNand(s ? 0 : 1, r ? 0 : 1, q) : kind === "gated" ? gatedSr(s ? 1 : 0, r ? 1 : 0, en ? 1 : 0, q) : srNor(s ? 1 : 0, r ? 1 : 0, q);
  return (
    <Card title="SR latch" action={<Segmented options={["nor", "nand", "gated"]} value={kind} onChange={setKind} />}>
      <div className="row">
        <BitSwitch label={kind === "nand" ? "S̅" : "S"} on={s} onChange={setS} />
        <BitSwitch label={kind === "nand" ? "R̅" : "R"} on={r} onChange={setR} />
        {kind === "gated" ? <BitSwitch label="EN" on={en} onChange={setEn} /> : null}
        <Button variant="primary" onClick={() => setQ(next.q)}>Apply</Button>
      </div>
      <p className="expr">Q {next.q} · Q̅ {next.qn} · {next.label}</p>
      <p className="muted">{kind === "nand" ? "The switches are the active-low request. Both asserted (shown as 1 on S̅ and R̅) is invalid and forces both outputs high." : "NOR inputs are active high. S = R = 1 is invalid and forces both outputs low."}</p>
      <svg viewBox="0 0 280 100" className="diagram" aria-label="Cross coupled latch">
        <rect x="70" y="16" width="64" height="28" rx="8" fill="white" stroke="#34507a" />
        <rect x="70" y="56" width="64" height="28" rx="8" fill="white" stroke="#34507a" />
        <text x="102" y="34" textAnchor="middle" fontSize="11">{kind === "nand" ? "NAND" : "NOR"}</text>
        <text x="102" y="74" textAnchor="middle" fontSize="11">{kind === "nand" ? "NAND" : "NOR"}</text>
        <path className="wire" d="M134 30 H160 V70 H134" />
        <path className="wire" d="M70 70 H50 V30 H70" />
        <text x="190" y="36" fontSize="13">Q {next.q}</text>
        <text x="190" y="76" fontSize="13">Q̅ {next.qn}</text>
      </svg>
    </Card>
  );
}

function DLatchLab() {
  const [d, setD] = useState(true);
  const [en, setEn] = useState(true);
  const [q, setQ] = useState<Level>(0);
  const [trace, setTrace] = useState<Array<0 | 1 | "X">>([0]);
  const next = dLatch(d ? 1 : 0, en ? 1 : 0, q);
  return (
    <Card title="D latch">
      <div className="row">
        <BitSwitch label="D" on={d} onChange={setD} />
        <BitSwitch label="EN" on={en} onChange={setEn} />
        <Button variant="primary" onClick={() => { setQ(next.q); setTrace((items) => [...items, levelBit(next.q)].slice(-24)); }}>Sample</Button>
      </div>
      <p className="expr">Q {next.q} · {next.label}</p>
      <p className="muted">{en ? "Enabled: Q follows D immediately." : "Disabled: Q keeps the stored bit."}</p>
      <Waveform traces={[{ id: "q", name: "Q", values: trace, active: true }]} />
    </Card>
  );
}

function EdgeBar({ clock, playing, setPlaying, tick, reset, speed, setSpeed }: { clock: 0 | 1; playing: boolean; setPlaying: (v: boolean) => void; tick: () => void; reset: () => void; speed: number; setSpeed: (n: number) => void }) {
  return (
    <div className="row">
      <Button variant="primary" onClick={() => setPlaying(!playing)}>{playing ? "Pause" : "Play"}</Button>
      <Button onClick={tick}>Step clock</Button>
      <Button onClick={reset}>Reset</Button>
      <SpeedPicker speed={speed} onChange={setSpeed} />
      <span className="tiny">CLK {clock} · this speed is the animation, not the MHz of the part</span>
    </div>
  );
}

function SrFfLab() {
  const [s, setS] = useState(false);
  const [r, setR] = useState(false);
  const [edge, setEdge] = useState<Edge>("rise");
  const [clock, setClock] = useState<0 | 1>(0);
  const [q, setQ] = useState<Level>(0);
  const [samples, setSamples] = useState<Array<0 | 1 | "X">>([0]);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  function tick() {
    const nextClock: 0 | 1 = clock === 0 ? 1 : 0;
    const next = srFlipFlop(s ? 1 : 0, r ? 1 : 0, nextClock, clock, q, edge);
    setQ(next.q);
    setClock(nextClock);
    setSamples((items) => [...items, levelBit(next.q)].slice(-32));
  }
  useTicker(playing, speed, tick);
  return (
    <Card title="SR flip-flop">
      <Segmented options={["rise", "fall"]} value={edge} onChange={(value) => setEdge(value as Edge)} />
      <div className="row"><BitSwitch label="S" on={s} onChange={setS} /><BitSwitch label="R" on={r} onChange={setR} /></div>
      <EdgeBar clock={clock} playing={playing} setPlaying={setPlaying} tick={tick} reset={() => { setClock(0); setQ(0); setSamples([0]); setPlaying(false); }} speed={speed} setSpeed={setSpeed} />
      <p className="expr">Q {q}</p>
      <Waveform traces={[{ id: "q", name: "Q", values: samples, active: true }]} />
      <p className="muted">The inputs are sampled on the chosen edge. S = R = 1 is still invalid.</p>
    </Card>
  );
}

function DffLab() {
  const { prefs } = usePrefs();
  const [d, setD] = useState(true);
  const [reset, setReset] = useState(false);
  const [edge, setEdge] = useState<Edge>("rise");
  const [clock, setClock] = useState<0 | 1>(0);
  const [q, setQ] = useState<Level>(0);
  const [samples, setSamples] = useState<Array<0 | 1 | "X">>([0]);
  const [clks, setClks] = useState<Array<0 | 1>>([0]);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  function tick() {
    const nextClock: 0 | 1 = clock === 0 ? 1 : 0;
    const next = dFlipFlop(d ? 1 : 0, nextClock, clock, q, edge, reset ? 1 : 0);
    setQ(next.q);
    setClock(nextClock);
    setSamples((items) => [...items, levelBit(next.q)].slice(-32));
    setClks((items) => [...items, nextClock].slice(-32));
  }
  useTicker(playing, speed, tick);
  const captured = dFlipFlop(d ? 1 : 0, 1, 0, q, edge, reset ? 1 : 0);
  return (
    <Card title="D flip-flop">
      <Segmented options={["rise", "fall"]} value={edge} onChange={(value) => setEdge(value as Edge)} />
      <div className="row"><BitSwitch label="D" on={d} onChange={setD} /><BitSwitch label="Reset" on={reset} onChange={setReset} /></div>
      <EdgeBar clock={clock} playing={playing} setPlaying={setPlaying} tick={tick} reset={() => { setClock(0); setQ(0); setSamples([0]); setClks([0]); setPlaying(false); }} speed={speed} setSpeed={setSpeed} />
      <p className="expr">Q {q} · Q̅ {q === "X" ? "X" : q === 1 ? 0 : 1}</p>
      <Waveform traces={[{ id: "clk", name: "CLK", values: clks }, { id: "q", name: "Q", values: samples, active: true }]} />
      {prefs.explain ? <ExplainBar what={reset ? "Asynchronous reset forces Q to 0." : `Next capture would store D = ${d ? 1 : 0}.`} why="Q(next) equals D only on the active edge." notice={edge === "rise" ? "A high clock that stays high does not capture again." : "The falling edge is the sample point."} /> : null}
      <p className="tiny">Preview if an active edge happened now: Q → {captured.q}</p>
    </Card>
  );
}

function JkLab() {
  const [j, setJ] = useState(true);
  const [k, setK] = useState(true);
  const [clock, setClock] = useState<0 | 1>(0);
  const [q, setQ] = useState<Level>(0);
  const [samples, setSamples] = useState<Array<0 | 1 | "X">>([0]);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  function tick() {
    const nextClock: 0 | 1 = clock === 0 ? 1 : 0;
    const next = jkFlipFlop(j ? 1 : 0, k ? 1 : 0, nextClock, clock, q, "rise");
    setQ(next.q);
    setClock(nextClock);
    setSamples((items) => [...items, levelBit(next.q)].slice(-32));
  }
  useTicker(playing, speed, tick);
  const mode = j && k ? "toggle" : j ? "set" : k ? "reset" : "hold";
  return (
    <Card title="JK flip-flop">
      <div className="row"><BitSwitch label="J" on={j} onChange={setJ} /><BitSwitch label="K" on={k} onChange={setK} /></div>
      <EdgeBar clock={clock} playing={playing} setPlaying={setPlaying} tick={tick} reset={() => { setQ(0); setClock(0); setSamples([0]); setPlaying(false); }} speed={speed} setSpeed={setSpeed} />
      <p className="expr">Q {q} · {mode}</p>
      <Waveform traces={[{ id: "q", name: "Q", values: samples, active: true }]} />
      <p className="tiny">{j && k ? "Challenge complete: J = K = 1, so each rising edge toggles Q." : "Set both J and K to make it toggle."}</p>
    </Card>
  );
}

function TLab() {
  const [t, setT] = useState(true);
  const [clock, setClock] = useState<0 | 1>(0);
  const [q, setQ] = useState<Level>(0);
  const [samples, setSamples] = useState<Array<0 | 1>>([0]);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  function tick() {
    const nextClock: 0 | 1 = clock === 0 ? 1 : 0;
    const next = tFlipFlop(t ? 1 : 0, nextClock, clock, q, "rise");
    const bit: 0 | 1 = next.q === 1 ? 1 : 0;
    setQ(bit);
    setClock(nextClock);
    setSamples((items) => [...items, bit].slice(-32));
  }
  useTicker(playing, speed, tick);
  return (
    <Card title="T flip-flop">
      <BitSwitch label="T" on={t} onChange={setT} />
      <EdgeBar clock={clock} playing={playing} setPlaying={setPlaying} tick={tick} reset={() => { setQ(0); setClock(0); setSamples([0]); setPlaying(false); }} speed={speed} setSpeed={setSpeed} />
      <p className="expr">Q {q}</p>
      <Waveform traces={[{ id: "q", name: "Q", values: samples, active: true }]} />
      <p className="muted">{t ? "T = 1 toggles on the rising edge." : "T = 0 holds Q."}</p>
    </Card>
  );
}

function MsLab() {
  const [j, setJ] = useState(true);
  const [k, setK] = useState(true);
  const [clock, setClock] = useState<0 | 1>(0);
  const [master, setMaster] = useState<Level>(0);
  const [slave, setSlave] = useState<Level>(0);
  function tick() {
    const nextClock: 0 | 1 = clock === 0 ? 1 : 0;
    const next = masterSlaveJk(j ? 1 : 0, k ? 1 : 0, nextClock, clock, master, slave);
    setMaster(next.master);
    setSlave(next.slave);
    setClock(nextClock);
  }
  return (
    <Card title="Master-slave JK">
      <div className="row"><BitSwitch label="J" on={j} onChange={setJ} /><BitSwitch label="K" on={k} onChange={setK} /><Button variant="primary" onClick={tick}>Step clock</Button></div>
      <div className="row">
        <div className="metric"><span>Master · clock {clock === 1 ? "open" : "shut"}</span><b>{master}</b></div>
        <div className="metric"><span>Slave · updates on the fall</span><b>{slave}</b></div>
      </div>
      <p className="muted">While CLK is high the master samples J and K against the slave output. On the falling edge the slave copies the master. That is why toggle does not race through both stages in one level.</p>
    </Card>
  );
}

function TableLab() {
  const [kind, setKind] = useState<"SR" | "D" | "JK" | "T">("JK");
  const [q, setQ] = useState<0 | 1>(0);
  const [next, setNext] = useState<0 | 1>(1);
  const table = CHARACTERISTIC[kind];
  const need = excitation(kind, q, next);
  return (
    <div className="grid cards-2">
      <Card title="Characteristic" action={<Segmented options={["SR", "D", "JK", "T"]} value={kind} onChange={(value) => setKind(value as typeof kind)} />}>
        <table className="data">{table.map((row, index) => <tr key={index} className={index === 0 ? "" : "active"}>{row.map((cell) => <td key={cell}>{cell}</td>)}</tr>)}</table>
      </Card>
      <Card title="Excitation">
        <div className="row"><BitSwitch label="Q" on={q === 1} onChange={(on) => setQ(on ? 1 : 0)} /><BitSwitch label="Q+" on={next === 1} onChange={(on) => setNext(on ? 1 : 0)} /></div>
        {Object.entries(need).map(([name, value]) => <p key={name} className="expr">{name} = {value}</p>)}
      </Card>
    </div>
  );
}

function ConvertLab() {
  const [id, setId] = useState(CONVERSIONS[0]?.id ?? "jk-d");
  const item = CONVERSIONS.find((entry) => entry.id === id) ?? CONVERSIONS[0];
  return (
    <Card title="Flip-flop conversion">
      <Segmented options={CONVERSIONS.map((entry) => entry.id)} value={id} onChange={setId} />
      {item ? (
        <div>
          <p>{item.source} → {item.target}</p>
          {item.equations.map((equation) => <p key={equation} className="expr">{equation}</p>)}
          <p className="muted">{item.note}</p>
        </div>
      ) : null}
    </Card>
  );
}
