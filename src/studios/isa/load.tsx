import { useEffect, useMemo, useState } from "react";
import { executeTeach, loadStoreDemo, type TeachMachine } from "../../engines/isa/teach";
import { Mark, RunBar, WhatChanged } from "./ui";

type Mode = "demo" | "lw" | "sw";

export function LoadPanel({ explain }: { explain: boolean }) {
  const picture = loadStoreDemo();
  const [base, setBase] = useState<TeachMachine>(picture.before);
  const [mode, setMode] = useState<Mode>("demo");
  const [rd, setRd] = useState(1);
  const [rs, setRs] = useState(2);
  const [offset, setOffset] = useState(8);
  const [phase, setPhase] = useState(0);
  const [playing, setPlaying] = useState(false);
  const outcome = useMemo(() => run(base, mode, rd, rs, offset), [base, mode, rd, rs, offset]);
  useEffect(() => {
    if (!playing) return undefined;
    const timer = window.setTimeout(() => {
      setPhase((current) => {
        if (current >= outcome.steps) { setPlaying(false); return current; }
        return current + 1;
      });
    }, 650);
    return () => window.clearTimeout(timer);
  }, [playing, phase, outcome.steps]);

  function editReg(index: number, text: string) {
    const value = Math.trunc(Number(text));
    if (!Number.isFinite(value)) return;
    setBase((current) => ({ ...current, regs: current.regs.map((item, at) => at === index ? value : item) }));
    setPhase(0);
  }
  function editMem(address: number, text: string) {
    const value = Math.trunc(Number(text));
    if (!Number.isFinite(value)) return;
    setBase((current) => ({ ...current, mem: { ...current.mem, [address]: value } }));
    setPhase(0);
  }

  const shown = phase <= 0 ? base : phase === 1 && mode === "demo" ? executeTeach(base, "LOAD", 1, 0, 0, 100).next : outcome.after;
  return (
    <div className="isx-stack">
      <div className="isx-hero">
        <section className="isx-banner">
          <p className="isx-kicker"><Mark kind="book" /> Core concept</p>
          <h2>Load and store</h2>
          <p>Load instructions copy data from memory into a register. Store instructions copy data from a register into memory. These are the only instructions that access data memory. ALU operations work only on registers.</p>
        </section>
        <aside className="isx-pull"><p>Data moves between memory and registers through load and store instructions.</p></aside>
      </div>
      <section className="isx-card">
        <h2><Mark kind="link" /> How it fits together</h2>
        <div className="isx-move">
          <div>
            <h3>CPU registers</h3>
            {[0, 1, 2, 3].map((index) => <p key={index} className={shown.regs[index] !== base.regs[index] ? "hot" : ""}>R{index} <b>{shown.regs[index]}</b></p>)}
          </div>
          <div className="isx-arrows">
            <span className={phase >= 1 && mode !== "sw" ? "on" : ""}>LOAD <small>Memory → Register</small></span>
            <span className={phase >= (mode === "demo" ? 2 : 1) && mode !== "lw" ? "on" : ""}>STORE <small>Register → Memory</small></span>
          </div>
          <div>
            <h3>Memory (data)</h3>
            {[100, 104, 108, 112].map((address) => <p key={address} className={shown.mem[address] !== base.mem[address] ? "hot" : ""}>{address} <b>{shown.mem[address] ?? 0}</b></p>)}
          </div>
        </div>
      </section>
      <section className="isx-card">
        <div className="isx-try-head">
          <div>
            <h2><Mark kind="term" /> Try it: load and store</h2>
            <p className="isx-lead">Run the instructions and see how register and memory values change.</p>
          </div>
          <RunBar
            label=""
            extra={
              <>
                <select aria-label="Program" value={mode} onChange={(event) => { setMode(event.target.value as Mode); setPhase(0); setPlaying(false); }}>
                  <option value="demo">Demo: LOAD then STORE</option>
                  <option value="lw">LW Rd, offset(Rs)</option>
                  <option value="sw">SW Rs, offset(Base)</option>
                </select>
                {mode !== "demo" ? (
                  <>
                    <label>Reg<input aria-label="Register" type="number" min={0} max={7} value={mode === "sw" ? rs : rd} onChange={(event) => (mode === "sw" ? setRs : setRd)(num(event.target.value, 7))} /></label>
                    <label>Base<input aria-label="Base register" type="number" min={0} max={7} value={mode === "sw" ? rd : rs} onChange={(event) => (mode === "sw" ? setRd : setRs)(num(event.target.value, 7))} /></label>
                    <label>Offset<input aria-label="Offset" type="number" value={offset} onChange={(event) => setOffset(num(event.target.value, 4096, -4096))} /></label>
                  </>
                ) : null}
              </>
            }
            onRun={() => { setPhase(1); setPlaying(true); }}
            onReset={() => { setBase(loadStoreDemo().before); setMode("demo"); setPhase(0); setPlaying(false); setRd(1); setRs(2); setOffset(8); }}
          />
        </div>
        <div className="isx-try">
          <div className="isx-code">
            {outcome.lines.map((line, index) => <div key={line} className={phase > index ? "on" : ""}><span>{index + 1}</span><code>{line}</code></div>)}
          </div>
          <div>
            <h3>Registers (before → after)</h3>
            <table className="isx-table">
              <tbody>
                {[0, 1, 2, 3].map((index) => (
                  <tr key={index} className={base.regs[index] !== outcome.after.regs[index] ? "on" : ""}>
                    <th>R{index}</th>
                    <td><input aria-label={`Register ${index} before`} value={base.regs[index]} onChange={(event) => editReg(index, event.target.value)} /></td>
                    <td>→ {outcome.after.regs[index]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <h3>Memory (before → after)</h3>
            <table className="isx-table">
              <tbody>
                {[100, 104, 108, 112].map((address) => (
                  <tr key={address} className={(base.mem[address] ?? 0) !== (outcome.after.mem[address] ?? 0) ? "on" : ""}>
                    <th>{address}</th>
                    <td><input aria-label={`Memory ${address}`} value={base.mem[address] ?? 0} onChange={(event) => editMem(address, event.target.value)} /></td>
                    <td>→ {outcome.after.mem[address] ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="isx-after">After execution: <strong>{outcome.blurb}</strong></p>
            <p className="tiny">{outcome.ea}</p>
          </div>
        </div>
      </section>
      <div className="isx-split">
        <WhatChanged hidden={!explain} items={[
          { title: "What changed?", body: outcome.blurb },
          { title: "Why?", body: "Load and store are the only instructions that access data memory. ADD, SUB, AND, and OR work on registers." },
          { title: "Notice", body: "Memory is not used directly by ALU instructions. Data must be loaded into registers first." },
        ]} />
        <section className="isx-card">
          <h2>Addressing: base + offset</h2>
          <p className="mono">EA = register + offset</p>
          <p>{outcome.ea}</p>
          <p className="tiny">The offset is a small immediate, and the base is a register.</p>
        </section>
      </div>
    </div>
  );
}

function run(base: TeachMachine, mode: Mode, rd: number, rs: number, offset: number) {
  if (mode === "lw") {
    const step = executeTeach(base, "LOAD", rd, rs, 0, offset);
    return { after: step.next, lines: [`LW R${rd}, ${offset}(R${rs})`], steps: 1, blurb: `R${rd} = ${step.value}`, ea: `EA = R${rs} + ${offset} = ${step.address}` };
  }
  if (mode === "sw") {
    const step = executeTeach(base, "STORE", 0, rd, rs, offset);
    return { after: step.next, lines: [`SW R${rs}, ${offset}(R${rd})`], steps: 1, blurb: `Mem[${step.address}] = ${step.value}`, ea: `EA = R${rd} + ${offset} = ${step.address}` };
  }
  const loaded = executeTeach(base, "LOAD", 1, 0, 0, 100);
  const stored = executeTeach(loaded.next, "STORE", 0, 0, 2, 104);
  return { after: stored.next, lines: ["LOAD R1, [100]", "STORE R2, [104]"], steps: 2, blurb: `R1 = ${stored.next.regs[1]} · Mem[104] = ${stored.next.mem[104]}`, ea: "Demo addresses are absolute: 100, then 104. Switch to LW or SW for base + offset." };
}

function num(text: string, max: number, min = 0): number {
  const value = Math.trunc(Number(text));
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}
