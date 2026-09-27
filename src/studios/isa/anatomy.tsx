import { useState } from "react";
import { anatomyBinary, anatomyFields, encodeAnatomy, TEACH_OPS, type TeachOp } from "../../engines/isa/teach";
import { Mark, RunBar } from "./ui";

const TONE: Record<string, string> = { opcode: "op", rd: "rd", rs1: "rs", imm: "im" };

export function AnatomyPanel({ explain }: { explain: boolean }) {
  const [op, setOp] = useState<TeachOp>("ADD");
  const [rd, setRd] = useState(1);
  const [rs1, setRs1] = useState(2);
  const [rs2, setRs2] = useState(3);
  const [imm, setImm] = useState(0);
  const [field, setField] = useState("opcode");
  const [pulse, setPulse] = useState(0);
  const word = encodeAnatomy(op, rd, rs1, rs2, imm);
  const fields = anatomyFields(word, op);
  const active = fields.find((item) => item.id === field) ?? fields[0];
  const grouped = anatomyBinary(word);
  const regOp = op === "ADD" || op === "SUB" || op === "AND" || op === "OR" || op === "XOR";

  return (
    <div className="isx-stack">
      <section className="isx-card">
        <div className="isx-hero tight">
          <div>
            <h2><Mark kind="book" /> Anatomy of an instruction</h2>
            <p className="isx-lead">A 16-bit instruction is divided into fields. Each field has a specific meaning and controls what the processor does.</p>
          </div>
          <aside className="isx-pull"><p>Same instruction size, different meaning. It is all in the fields.</p></aside>
        </div>
        <div className="isx-ruler"><span>15</span><span>12</span><span>11</span><span>9</span><span>8</span><span>6</span><span>5</span><span>0</span></div>
        <div className="isx-strip" role="group" aria-label="16-bit instruction fields">
          {fields.map((item) => (
            <button key={item.id} type="button" className={`isx-seg ${TONE[item.id]} ${field === item.id ? "on" : ""}`} style={{ flex: item.id === "opcode" ? 4 : item.id === "imm" ? 6 : 3 }} onMouseEnter={() => setField(item.id)} onFocus={() => setField(item.id)} onClick={() => setField(item.id)}>
              <strong>{item.label}</strong>
              <em>({item.id === "opcode" ? "4" : item.id === "imm" ? "6" : "3"} bits)</em>
            </button>
          ))}
        </div>
      </section>
      <div className="isx-split">
        <section className="isx-card">
          <h2><Mark kind="search" /> Field inspector</h2>
          <p className="isx-lead">Select a field to learn what it controls.</p>
          <div className="isx-pills">
            {fields.map((item) => (
              <button key={item.id} type="button" className={`${TONE[item.id]} ${field === item.id ? "on" : ""}`} onClick={() => setField(item.id)}>{item.label}</button>
            ))}
          </div>
          {active ? (
            <>
              <h3 className={TONE[active.id]}>{active.label} (bits {active.range})</h3>
              <p>{active.purpose}</p>
              {explain ? <p className="isx-key">Key idea: different opcodes select different operations. The other fields stay in the same bit positions.</p> : null}
            </>
          ) : null}
        </section>
        <section className="isx-card">
          <h2><Mark kind="gear" /> Instruction field decoder</h2>
          <p className="isx-lead">Each field maps to a specific control meaning.</p>
          <table className="isx-table">
            <thead><tr><th>Field</th><th>Bits</th><th>Meaning</th></tr></thead>
            <tbody>
              {fields.map((item) => (
                <tr key={item.id} className={field === item.id ? "on" : ""} onClick={() => setField(item.id)} onMouseEnter={() => setField(item.id)}>
                  <td><i className={`swatch ${TONE[item.id]}`} />{item.label}</td>
                  <td>{item.range.replace("–", " – ")}</td>
                  <td>{item.id === "opcode" ? "Operation (ADD, SUB, LOAD, STORE)" : item.id === "rd" ? "Destination register" : item.id === "rs1" ? "First source register" : "Second source or immediate"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
      <section className="isx-card">
        <div className="isx-try-head">
          <div>
            <h2><Mark kind="term" /> Try an instruction</h2>
            <p className="isx-lead">See how the fields are encoded for a real instruction.</p>
          </div>
          <RunBar
            label=""
            onRun={() => setPulse((value) => value + 1)}
            onReset={() => { setOp("ADD"); setRd(1); setRs1(2); setRs2(3); setImm(0); setField("opcode"); }}
            extra={<select aria-label="Instruction" value={op} onChange={(event) => setOp(event.target.value as TeachOp)}>{TEACH_OPS.map((item) => <option key={item}>{item}</option>)}</select>}
          />
        </div>
        <div className="isx-encode">
          <div className={`isx-bits ${pulse ? "isx-pop" : ""}`}>
            <div className="isx-ruler dark"><span>15</span><span>12</span><span>11</span><span>9</span><span>8</span><span>6</span><span>5</span><span>0</span></div>
            <div className="isx-bitrow">
              {fields.map((item) => (
                <button key={item.id} type="button" className={`${TONE[item.id]} ${field === item.id ? "on" : ""}`} style={{ flex: item.bits.length }} onMouseEnter={() => setField(item.id)} onClick={() => setField(item.id)}>
                  <b>{item.bits}</b>
                  <small>{item.label}</small>
                </button>
              ))}
            </div>
          </div>
          <div>
            <h3>Assembly</h3>
            <p className="mono">{op} {regOp ? `R${rd}, R${rs1}, R${rs2}` : op === "STORE" ? `R${rs2}, ${imm}(R${rs1})` : `R${rd}, R${rs1}, ${imm}`}</p>
            <div className="isx-knobs">
              <label>Rd<input aria-label="Destination register" type="number" min={0} max={7} value={rd} onChange={(event) => setRd(clamp(event.target.value, 7))} /></label>
              <label>Rs1<input aria-label="Source register 1" type="number" min={0} max={7} value={rs1} onChange={(event) => setRs1(clamp(event.target.value, 7))} /></label>
              {regOp || op === "STORE" ? <label>{op === "STORE" ? "Src" : "Rs2"}<input aria-label="Source register 2" type="number" min={0} max={7} value={rs2} onChange={(event) => setRs2(clamp(event.target.value, 7))} /></label> : null}
              {regOp ? null : <label>Imm<input aria-label="Immediate" type="number" min={-32} max={31} value={imm} onChange={(event) => setImm(clamp(event.target.value, 31, -32))} /></label>}
            </div>
          </div>
          <div className="isx-plain">
            <h3><Mark kind="bars" /> What this means</h3>
            <p className="mono">Binary (16-bit)</p>
            <p className="mono isx-bin">{grouped.slice(0, 4)} {grouped.slice(4, 7)} {grouped.slice(7, 10)} {grouped.slice(10)}</p>
            {explain && active ? <p>{active.label} is {active.bits}. {active.purpose}</p> : null}
          </div>
        </div>
      </section>
    </div>
  );
}

function clamp(text: string, max: number, min = 0): number {
  const value = Math.trunc(Number(text));
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}
