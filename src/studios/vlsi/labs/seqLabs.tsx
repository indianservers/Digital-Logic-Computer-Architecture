import { useState } from "react";
import { dMasterSlave, flipFlopD, latchD, latchSr, type Bit } from "../engine";
import type { Edge, Level } from "../../../engines/digital/sequential";
import { Badge, BitPair, Choice, Measure, Observe, Theory, Wave } from "../widgets";

function levelText(value: Level): string {
  return String(value);
}

export function SrLatchLab() {
  const [s, setS] = useState<Bit>(0);
  const [r, setR] = useState<Bit>(0);
  const [q, setQ] = useState<Level>(0);
  const state = latchSr(s, r, q === "X" ? 0 : q);
  function apply(nextS: Bit, nextR: Bit) {
    setS(nextS);
    setR(nextR);
    setQ(latchSr(nextS, nextR, q === "X" ? 0 : q).q);
  }
  return (
    <div className="vlsi-grid">
      <aside className="vlsi-panel">
        <h2>Cross-coupled NOR</h2>
        <BitPair label="S" value={s} onChange={(value) => apply(value, r)} />
        <BitPair label="R" value={r} onChange={(value) => apply(s, value)} />
        <Theory title="Reused latch"><p>This is the same active-high NOR SR latch as the flip-flop studio. S = R = 1 forces both outputs low and is marked invalid. The original studio route is unchanged.</p></Theory>
      </aside>
      <section className="vlsi-stage">
        <div className="vlsi-stage-bar">
          <Badge tone={state.label === "invalid" ? "bad" : "on"}>{state.label}</Badge>
          <Badge tone="info">Q = {levelText(state.q)}</Badge>
          <Badge tone="pmos">Q̄ = {levelText(state.qn)}</Badge>
        </div>
        <svg className="vlsi-device" viewBox="0 0 420 180" role="img" aria-label="Cross-coupled NOR latch">
          <rect x="70" y="30" width="90" height="44" rx="8" fill="#1e293b" stroke="#fb7185" strokeWidth="2" />
          <rect x="70" y="100" width="90" height="44" rx="8" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
          <text x="115" y="56" textAnchor="middle" fill="#fecaca" fontSize="13">NOR</text>
          <text x="115" y="126" textAnchor="middle" fill="#bae6fd" fontSize="13">NOR</text>
          <path d="M160 52 H210 V122 H160" fill="none" stroke="#4ade80" strokeWidth="2" />
          <path d="M70 122 H40 V52 H70" fill="none" stroke="#86efac" strokeWidth="2" />
          <text x="250" y="56" fill="#e2e8f0" fontSize="14">Q {levelText(state.q)}</text>
          <text x="250" y="126" fill="#e2e8f0" fontSize="14">Q̄ {levelText(state.qn)}</text>
          <text x="20" y="40" fill="#93c5fd" fontSize="12">S={s}</text>
          <text x="20" y="150" fill="#93c5fd" fontSize="12">R={r}</text>
        </svg>
      </section>
      <aside className="vlsi-panel vlsi-read">
        <Measure label="Q" value={levelText(state.q)} />
        <Measure label="Q-bar" value={levelText(state.qn)} />
        <Observe
          change="Pulse S, return it to 0, then pulse R. Then hold both at 1."
          see={state.label === "invalid" ? "Both outputs are 0. That state cannot be stored." : state.label === "hold" ? "Both inputs are 0, so Q stays where the last set or reset left it." : `The latch is ${state.label}.`}
          why="A NOR output is 1 only when both of its inputs are 0. Setting one input forces its NOR low and the other NOR high."
          experiment="Release S = R = 1 back to 00 and notice the stored value depends on which input fell last. This model reports the invalid pair while both are high."
          takeaway="The SR latch stores a bit with feedback. S and R must not be asserted together."
        />
      </aside>
    </div>
  );
}

export function DLatchLab() {
  const [d, setD] = useState<Bit>(0);
  const [en, setEn] = useState<Bit>(0);
  const [q, setQ] = useState<Level>(0);
  const state = latchD(d, en, q === "X" ? 0 : q);
  function setEnable(value: Bit) {
    setEn(value);
    setQ(latchD(d, value, q === "X" ? 0 : q).q);
  }
  function setData(value: Bit) {
    setD(value);
    setQ(latchD(value, en, q === "X" ? 0 : q).q);
  }
  return (
    <div className="vlsi-grid">
      <aside className="vlsi-panel">
        <h2>Enable</h2>
        <BitPair label="D" value={d} onChange={setData} />
        <BitPair label="EN" value={en} onChange={setEnable} />
        <Theory title="Reused latch"><p>Transparency comes from dLatch in the sequential engine. EN = 1 copies D to Q. EN = 0 holds Q. The flip-flop studio still owns the original control panel.</p></Theory>
      </aside>
      <section className="vlsi-stage">
        <Badge tone={state.label === "transparent" ? "on" : "info"}>{state.label === "transparent" ? "Transparent" : "Holding"}</Badge>
        <p className="vlsi-symbol">Q = {levelText(state.q)} · Q̄ = {levelText(state.qn)}</p>
        <p className="vlsi-caption">{en === 1 ? "The input path is open. Changing D changes Q immediately." : "The input path is closed. D can move without touching Q."}</p>
      </section>
      <aside className="vlsi-panel vlsi-read">
        <Observe
          change="Raise EN and toggle D. Then drop EN and toggle D again."
          see={en === 1 ? "Q follows D." : "Q ignores D and keeps the captured bit."}
          why="Enable turns on the transmission path into the storage loop. With enable low, only the loop remains."
          experiment="Capture a 1, disable, and set D to 0. Q must stay 1."
          takeaway="A D latch is transparent only while its enable is active."
        />
      </aside>
    </div>
  );
}

export function DFlipFlopLab() {
  const [view, setView] = useState<"edge" | "master" | "wave" | "device">("edge");
  const [d, setD] = useState<Bit>(1);
  const [edge, setEdge] = useState<Edge>("rise");
  const [reset, setReset] = useState<Bit>(0);
  const [clock, setClock] = useState<Bit>(0);
  const [q, setQ] = useState<Level>(0);
  const [master, setMaster] = useState<Level>(0);
  const [slave, setSlave] = useState<Level>(0);
  const [trace, setTrace] = useState<Array<{ clk: number; q: number }>>([{ clk: 0, q: 0 }]);
  const [note, setNote] = useState("Waiting for a clock edge.");
  const storedQ: Level = q === "X" ? 0 : q;
  const storedMaster: Level = master === "X" ? 0 : master;
  const storedSlave: Level = slave === "X" ? 0 : slave;
  const pair = dMasterSlave(d, clock, storedMaster, storedSlave);
  function tick() {
    const next: Bit = clock === 1 ? 0 : 1;
    const sampled = flipFlopD(d, next, clock, storedQ, edge, reset);
    const open = dMasterSlave(d, clock, storedMaster, storedSlave);
    const ms = dMasterSlave(d, next, open.master === "X" ? 0 : open.master, open.slave === "X" ? 0 : open.slave);
    setClock(next);
    setQ(sampled.q);
    setMaster(ms.master);
    setSlave(ms.slave);
    setNote(sampled.label === "reset" ? "Reset forces Q to 0." : sampled.label === "hold" ? "This edge does not sample. Q is unchanged." : "The sampling edge copied D into Q.");
    setTrace((items) => [...items.slice(-31), { clk: next, q: sampled.q === 1 ? 1 : 0 }]);
  }
  const shownQ = view === "master" || view === "device" ? pair.q : q;
  const shownQn = view === "master" || view === "device" ? pair.qn : (q === 1 ? 0 : 1);
  return (
    <div className="vlsi-grid">
      <aside className="vlsi-panel">
        <h2>Clocked D</h2>
        <Choice label="View" value={view} onChange={setView} options={[
          { id: "edge", label: "Edge" },
          { id: "master", label: "Master/slave" },
          { id: "wave", label: "Timing" },
          { id: "device", label: "Devices" },
        ]} />
        <BitPair label="D" value={d} onChange={setD} />
        <BitPair label="Reset" value={reset} onChange={(value) => {
          setReset(value);
          if (value === 1) {
            setQ(0);
            setNote("Reset forces Q to 0.");
          }
        }} />
        <Choice label="Edge" value={edge} onChange={setEdge} options={[{ id: "rise", label: "Rising" }, { id: "fall", label: "Falling" }]} />
        <button type="button" className="vlsi-clock" onClick={tick} aria-label="Toggle clock">CLK {clock} → {clock === 1 ? 0 : 1}</button>
        <Theory title="Two different engines"><p>The edge view calls dFlipFlop, including reset and edge select. The master/slave view is two D latches from dLatch: the master is transparent while CLK is low, and the slave copies the master while CLK is high. It is not the JK master/slave circuit.</p></Theory>
      </aside>
      <section className="vlsi-stage">
        <div className="vlsi-stage-bar">
          <Badge tone="info">D {d}</Badge>
          <Badge tone={clock === 1 ? "on" : "off"}>CLK {clock}</Badge>
          <Badge tone="on">Q {levelText(shownQ)}</Badge>
          <Badge tone="pmos">Q̄ {levelText(shownQn)}</Badge>
        </div>
        {view === "master" || view === "device" ? (
          <>
            <p className="vlsi-caption">{pair.phase}</p>
            <div className="vlsi-devices">
              <Badge tone={clock === 0 ? "on" : "off"}>Master {levelText(pair.master)} {clock === 0 ? "transparent" : "holding"}</Badge>
              <Badge tone={clock === 1 ? "on" : "off"}>Slave {levelText(pair.slave)} {clock === 1 ? "transparent" : "holding"}</Badge>
            </div>
          </>
        ) : null}
        {view === "device" ? <p className="vlsi-caption">Each latch is a transmission gate into a storage loop. CLK low opens the master gate. CLK high opens the slave gate. Q changes only when the slave opens.</p> : null}
        {view === "wave" ? (
          <Wave traces={[
            { name: "CLK", color: "#fbbf24", values: trace.map((item) => item.clk), min: 0, max: 1 },
            { name: "Q", color: "#4ade80", values: trace.map((item) => item.q), min: 0, max: 1 },
          ]} />
        ) : null}
        {view === "edge" ? <p className="vlsi-caption">{note}</p> : null}
      </section>
      <aside className="vlsi-panel vlsi-read">
        <Measure label="Q" value={levelText(shownQ)} />
        <Measure label="Q-bar" value={levelText(shownQn)} />
        <Observe
          change="Set D, then click the clock twice so both an inactive and an active edge occur."
          see={view === "master" || view === "device" ? pair.phase : note}
          why="A flip-flop samples. A latch follows. The master/slave pair makes that difference visible: only one latch is open at a time, so the input cannot race straight through to Q."
          experiment="In the master view, change D while CLK is high. The master must stay still and Q must stay still until CLK falls and rises again."
          takeaway="Edge capture is two latches with opposite transparency, or one sampling function on a clock edge."
        />
      </aside>
    </div>
  );
}
