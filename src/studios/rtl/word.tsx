import { useState } from "react";
import { controlWord, RTL_PRESETS } from "../../engines/isa/rtlLab";
import { Mark } from "./ui";

const REGS = [0, 5, 3, 0, 0, 0, 0, 0];

export function WordPanel({ explain }: { explain: boolean }) {
  const [line, setLine] = useState("R3 ← R1 + R2");
  const [focus, setFocus] = useState("reg-write");
  const [edge, setEdge] = useState(false);
  const word = controlWord(REGS, line);
  if ("error" in word) return <p className="rtx-error">{word.error}</p>;
  const active = word.signals.find((signal) => signal.id === focus) ?? word.signals[0];

  return (
    <div className="rtx-word">
      <section className="rtx-card">
        <h2>Control word</h2>
        <p>A control word is a set of control signals that specify the micro-operation to be performed in one clock cycle.</p>
        <div className="rtx-fields">
          <Field name="SA" bits={word.sa} tone="sa" on={focus === "a-out"} />
          <Field name="SB" bits={word.sb} tone="sb" on={focus === "b-out"} />
          <Field name="DA" bits={word.da} tone="da" on={focus === "dest-in"} />
          <Field name="ALU" bits={word.alu} tone="alu" on={focus.startsWith("alu")} />
          <Field name="MB" bits={word.mb} tone="mb" on={focus === "mem-read" || focus === "mem-write"} />
          <Field name="RW" bits={word.rw} tone="rw" on={focus === "reg-write"} />
        </div>
        <ul className="rtx-legend">
          <li><i className="sa" /> SA — source register A</li>
          <li><i className="sb" /> SB — source register B</li>
          <li><i className="da" /> DA — destination register</li>
          <li><i className="alu" /> ALU — operation ({word.alu} = {word.aluName})</li>
          <li><i className="mb" /> MB — 0 = ALU result, 1 = memory</li>
          <li><i className="rw" /> RW — 1 = write on the clock edge</li>
        </ul>
      </section>
      <section className="rtx-card">
        <h2>Micro-operation from control word</h2>
        <p className="rtx-chips"><b className="dest">R{Number.parseInt(word.da, 2)}</b><span>←</span><b className="src-a">R{Number.parseInt(word.sa, 2)}</b>{word.aluName === "PASS" ? null : <><b className="alu">{word.aluName}</b><b className="src-b">R{Number.parseInt(word.sb, 2)}</b></>}</p>
        <table className="rtx-table">
          <thead><tr><th>Signal</th><th>Value</th></tr></thead>
          <tbody>
            <Row label="SA (source A)" value={`${word.sa} (R${Number.parseInt(word.sa, 2)})`} on={focus === "a-out"} pick={() => setFocus("a-out")} />
            <Row label="SB (source B)" value={`${word.sb} (R${Number.parseInt(word.sb, 2)})`} on={focus === "b-out"} pick={() => setFocus("b-out")} />
            <Row label="DA (destination)" value={`${word.da} (R${Number.parseInt(word.da, 2)})`} on={focus === "dest-in"} pick={() => setFocus("dest-in")} />
            <Row label="ALU operation" value={`${word.alu} (${word.aluName})`} on={focus.startsWith("alu")} pick={() => setFocus(word.aluName === "PASS" ? "alu-pass" : `alu-${word.aluName.toLowerCase()}`)} />
            <Row label="MB (memory to bus)" value={`${word.mb} (ALU)`} on={focus.startsWith("mem")} pick={() => setFocus("mem-read")} />
            <Row label="RW (register write)" value={`${word.rw} (enabled)`} on={focus === "reg-write"} pick={() => setFocus("reg-write")} />
          </tbody>
        </table>
        <div className="rtx-sig">
          {word.signals.map((signal) => (
            <button key={signal.id} type="button" className={signal.on ? "on" : ""} aria-pressed={focus === signal.id} onClick={() => setFocus(signal.id)} onMouseEnter={() => setFocus(signal.id)}>{signal.label} {signal.on ? "1" : "0"}</button>
          ))}
        </div>
        {explain && active ? <p className="rtx-note">{active.detail}</p> : null}
      </section>
      <section className="rtx-card">
        <h2>Try different operations</h2>
        <label>Operation
          <select aria-label="Micro-operation" value={line} onChange={(event) => { setLine(event.target.value); setEdge(false); }}>
            {RTL_PRESETS.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <p>Control word (binary)</p>
        <p className="rtx-bits">{word.grouped}</p>
        <p className="mono">{word.hex}</p>
        <button type="button" className="rtx-go" onClick={() => setEdge(true)}><Mark kind="play" /> Generate control word</button>
        {explain ? (
          <div className="rtx-note">
            <h3><Mark kind="info" /> How it works</h3>
            <p>The control unit selects the source registers, chooses the ALU operation, and enables the destination write.</p>
            <p>{edge ? `Before the edge R${Number.parseInt(word.da, 2)} = ${word.before}. On the edge it captures ${word.after}.` : "Generate to show the write edge. Combinational fields are already visible."}</p>
          </div>
        ) : edge ? <p className="rtx-note">R{Number.parseInt(word.da, 2)} captures {word.after} on the edge.</p> : null}
      </section>
    </div>
  );
}

function Field({ name, bits, tone, on }: { name: string; bits: string; tone: string; on: boolean }) {
  return <div className={`rtx-field ${tone} ${on ? "on" : ""}`}><b>{bits}</b><span>{name}</span></div>;
}

function Row({ label, value, on, pick }: { label: string; value: string; on: boolean; pick: () => void }) {
  return (
    <tr className={on ? "on" : ""} onClick={pick} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); pick(); } }} tabIndex={0}>
      <th>{label}</th><td className="mono">{value}</td>
    </tr>
  );
}
