import { useEffect, useState } from "react";
import { DRAM_READ, applySram, decayCharge, restoreCharge, senseDram, type DramOp, type SramCell } from "../../engines/memory/fundamentals";
import { Field, LabGuide } from "./guide";

const PRESETS = {
  normal: { leakage: 8, interval: 6, label: "Normal Refresh" },
  slow: { leakage: 8, interval: 2, label: "Too Slow Refresh" },
  hot: { leakage: 22, interval: 6, label: "High Leakage" },
  fast: { leakage: 4, interval: 8, label: "Fast Access" },
} as const;

export function DramLab() {
  const [kind, setKind] = useState<"dram" | "sram">("dram");
  const [op, setOp] = useState<DramOp>("hold");
  const [stored, setStored] = useState<0 | 1>(1);
  const [charge, setCharge] = useState(72);
  const [leakage, setLeakage] = useState(8);
  const [interval, setInterval] = useState(6);
  const [since, setSince] = useState(0);
  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState(-1);
  const [row, setRow] = useState(1);
  const [column, setColumn] = useState(2);
  const [sram, setSram] = useState<SramCell>({ q: 1, wl: 0, bl: 1, blb: 0, mode: "hold", stable: true });
  const sense = senseDram(charge, stored);
  const risk = stored === 1 && !sense.reliable;

  useEffect(() => {
    if (!running || kind !== "dram") return;
    const timer = window.setInterval(() => {
      setSince((value) => value + 1);
      setCharge((value) => decayCharge(value, leakage));
    }, 700);
    return () => window.clearInterval(timer);
  }, [running, leakage, kind]);

  useEffect(() => {
    if (!running || kind !== "dram" || since < interval) return;
    setCharge(restoreCharge(stored));
    setSince(0);
    setOp("refresh");
  }, [since, interval, running, stored, kind]);

  function operate(next: DramOp) {
    setOp(next);
    if (next === "write1") { setStored(1); setCharge(100); setStage(-1); setSram(applySram(sram, "write1")); }
    if (next === "write0") { setStored(0); setCharge(8); setStage(-1); setSram(applySram(sram, "write0")); }
    if (next === "hold") { setStage(-1); setSram(applySram(sram, "hold")); }
    if (next === "refresh") { setCharge(restoreCharge(stored)); setSince(0); setStage(-1); }
    if (next === "read") setStage(0);
  }

  function reset() {
    setKind("dram");
    setOp("hold");
    setStored(1);
    setCharge(72);
    setLeakage(8);
    setInterval(6);
    setSince(0);
    setRunning(false);
    setStage(-1);
    setRow(1);
    setColumn(2);
    setSram({ q: 1, wl: 0, bl: 1, blb: 0, mode: "hold", stable: true });
  }

  return (
    <div>
      <LabGuide
        aim="See charge on a capacitor decay, a destructive read, and a refresh that restores it."
        concept="A DRAM bit is charge behind one transistor. Reading shares that charge with the bitline, so the sense amplifier must write it back."
        change={["Operation", "Leakage", "Refresh interval", "Row and column", "SRAM comparison"]}
        steps={["Press Start and watch the charge percent.", "Choose Too Slow Refresh.", "Step a Read through five stages."]}
        observe={["Charge falls while the timer runs.", "A weak 1 can be sensed as 0.", "Refresh returns the cell to a full level."]}
        formula="Data is reliable while charge stays above the sense threshold. Refresh period must beat the leakage."
      />
      <div className="memx-lab">
        <section className="lgx-card">
          <div className="lgx-card-bar">
            <h3>{kind === "dram" ? "1T1C DRAM Cell" : "6T comparison"}</h3>
            <div className="fsmx-quick">
              <button type="button" className={kind === "dram" ? "on" : ""} onClick={() => setKind("dram")}>DRAM</button>
              <button type="button" className={kind === "sram" ? "on" : ""} onClick={() => setKind("sram")}>SRAM</button>
            </div>
          </div>
          {kind === "dram" ? (
            <svg className="memx-schematic" viewBox="0 0 260 180" role="img" aria-label="One transistor DRAM cell">
              <text x="24" y="28" fontSize="12" fill={stage >= 1 ? "#16a34a" : "#64748b"}>WL</text>
              <line x1="40" y1="24" x2="120" y2="24" stroke={stage >= 1 || op !== "hold" ? "#16a34a" : "#94a3b8"} strokeWidth="2" />
              <path d="M90 24 V70" fill="none" stroke="#334155" />
              <text x="20" y="90" fontSize="12">BL</text>
              <line x1="40" y1="84" x2="90" y2="84" stroke="#2563eb" strokeWidth="2" />
              <path d="M110 70 H150" fill="none" stroke="#334155" />
              <rect x="150" y="48" width="36" height="72" rx="6" fill="none" stroke="#2563eb" />
              <rect x="154" y={116 - charge * 0.64} width="28" height={charge * 0.64} fill="#93c5fd" />
              <text x="196" y="90" fontSize="12">{Math.round(charge)}%</text>
            </svg>
          ) : (
            <p>SRAM Q is {sram.q} and does not use a capacitor. Switching back to DRAM restores the charge picture. Current SRAM wordline is {sram.wl ? "high" : "low"}.</p>
          )}
          <div className="memx-controls">
            {(["write1", "write0", "hold", "read", "refresh"] as DramOp[]).map((item) => (
              <button key={item} type="button" className={op === item ? "memx-read" : "fsmx-icon"} onClick={() => operate(item)}>{item}</button>
            ))}
          </div>
          <Field label="Leakage"><input aria-label="Leakage rate" type="range" min={1} max={30} value={leakage} onChange={(event) => setLeakage(Number(event.target.value))} /></Field>
          <Field label="Refresh interval"><input aria-label="Refresh interval" type="range" min={2} max={12} value={interval} onChange={(event) => setInterval(Number(event.target.value))} /></Field>
          <div className="memx-controls">
            <button type="button" className="memx-read" onClick={() => setRunning(true)}>Start</button>
            <button type="button" className="fsmx-icon" onClick={() => setRunning(false)}>Pause</button>
            <button type="button" className="fsmx-icon" onClick={() => setStage((value) => Math.min(DRAM_READ.length - 1, value + 1))}>Step read</button>
            <button type="button" className="fsmx-icon" onClick={reset}>Reset</button>
          </div>
          <div className="fsmx-quick">
            {(Object.keys(PRESETS) as Array<keyof typeof PRESETS>).map((key) => (
              <button key={key} type="button" onClick={() => { setLeakage(PRESETS[key].leakage); setInterval(PRESETS[key].interval); }}>{PRESETS[key].label}</button>
            ))}
          </div>
        </section>
        <section className="lgx-card">
          <h3>DRAM Array</h3>
          <p className="tiny">Row decoder selects wordline {row}. Column decoder selects bitline {column}. Activate, then read or write, then precharge.</p>
          <div className="memx-cells" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
            {Array.from({ length: 16 }, (_, index) => {
              const r = Math.floor(index / 4);
              const c = index % 4;
              const on = r === row && c === column;
              return <button key={index} type="button" className={on ? "mem-cell on" : "mem-cell"} onClick={() => { setRow(r); setColumn(c); }}>{on ? (stored ? "1" : "0") : "·"}</button>;
            })}
          </div>
          <p className="tiny">{stage >= 0 ? DRAM_READ[stage] : "Choose Read to walk the five-stage destructive read."}</p>
        </section>
        <div className="memx-side">
          <section className="lgx-card">
            <h3>Cell State</h3>
            <p><span>Logical level</span><b>{stored}</b></p>
            <p><span>Charge</span><b>{Math.round(charge)}%</b></p>
            <p><span>Sense threshold</span><b>40%</b></p>
            <p><span>Sensed bit</span><b>{sense.bit}{sense.reliable ? "" : " · unreliable"}</b></p>
            <p><span>Time since refresh</span><b>{since}</b></p>
            <p><span>Next refresh</span><b>{Math.max(0, interval - since)}</b></p>
            <p><span>Data-loss risk</span><b>{risk ? "High" : "Low"}</b></p>
          </section>
          <section className="lgx-card">
            <h3>Timing (RAS / CAS)</h3>
            <svg className="memx-wave" viewBox="0 0 280 80" role="img" aria-label="RAS CAS timing">
              <text x="4" y="18" fontSize="10">RAS</text>
              <path d="M40 16 H70 V6 H200" fill="none" stroke="#2563eb" strokeWidth="2" />
              <text x="4" y="42" fontSize="10">CAS</text>
              <path d="M40 40 H110 V30 H200" fill="none" stroke="#16a34a" strokeWidth="2" />
              <text x="4" y="66" fontSize="10">Data</text>
              <path d="M40 64 H140 V54 H200" fill="none" stroke="#d97706" strokeWidth="2" />
            </svg>
            <p className="tiny">Activate opens the row. Read or write uses the column. Precharge closes the row.</p>
          </section>
          <section className="lgx-card">
            <h3>Key Points</h3>
            <ol className="memx-steps">
              <li>Charge leaks over time.</li>
              <li className={op === "read" ? "on" : ""}>A read disturbs the cell.</li>
              <li className={op === "refresh" ? "on" : ""}>Refresh writes the bit back.</li>
              <li>DRAM is denser than the 6T SRAM cell.</li>
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
