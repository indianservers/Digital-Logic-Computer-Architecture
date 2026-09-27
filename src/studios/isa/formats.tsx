import { useState } from "react";
import { encodeRvTeach, type RvTeachFormat } from "../../engines/isa/teach";
import { Mark } from "./ui";

const FORMATS: Array<{ id: RvTeachFormat; title: string; blurb: string; example: string }> = [
  { id: "R", title: "R-type", blurb: "Register operations (e.g. ADD, SUB)", example: "ADD, SUB, AND, OR" },
  { id: "I", title: "I-type", blurb: "Immediate operations (e.g. ADDI, LW)", example: "ADDI, LW, JALR" },
  { id: "S", title: "S-type", blurb: "Store instructions (e.g. SW)", example: "SW, SH, SB" },
  { id: "B", title: "B-type", blurb: "Branch instructions (e.g. BEQ, BNE)", example: "BEQ, BNE, BLT" },
];

const TONE: Record<string, string> = {
  funct7: "#ddd6fe", rs2: "#86efac", rs1: "#93c5fd", funct3: "#fde68a", rd: "#fecdd3", opcode: "#f9a8d4",
  "imm[11:0]": "#ddd6fe", "imm[11:5]": "#ddd6fe", "imm[4:0]": "#fecdd3", "imm[12|10:5]": "#ddd6fe", "imm[4:1|11]": "#fdba74",
};

export function FormatsPanel({ explain }: { explain: boolean }) {
  const [format, setFormat] = useState<RvTeachFormat>("R");
  const [variant, setVariant] = useState<"add" | "sub">("add");
  const [rd, setRd] = useState(1);
  const [rs1, setRs1] = useState(2);
  const [rs2, setRs2] = useState(3);
  const [imm, setImm] = useState(10);
  const [hover, setHover] = useState("opcode");
  const example = encodeRvTeach(format, rd, rs1, rs2, format === "R" ? 0 : imm, variant);
  const active = example.fields.find((field) => field.name === hover) ?? example.fields[0];

  return (
    <div className="isx-stack">
      <section className="isx-card">
        <div className="isx-hero tight">
          <div>
            <h2><Mark kind="book" /> Instruction formats</h2>
            <p className="isx-lead">Different instructions use different binary layouts (formats) to encode the operation, registers, and immediate values. Each format allocates bits differently based on what the instruction needs to specify.</p>
          </div>
          <aside className="isx-pull"><p>Same 32 bits, different layouts, different purposes.</p></aside>
        </div>
      </section>
      <section className="isx-card">
        <h2>Common instruction formats (32-bit RISC-V)</h2>
        <p className="isx-lead">Each format divides the 32-bit instruction into fields. The size and meaning of each field depends on the instruction type.</p>
        {FORMATS.map((item) => {
          const row = encodeRvTeach(item.id, item.id === "R" ? 1 : rd, item.id === "R" ? 2 : rs1, item.id === "R" ? 3 : rs2, item.id === "R" ? 0 : imm, variant);
          return (
            <button key={item.id} type="button" className={`isx-fmt ${format === item.id ? "on" : ""}`} onClick={() => setFormat(item.id)}>
              <span className="isx-fmt-name"><strong>{item.title}</strong><em>{item.blurb}</em></span>
              <span className="isx-fmt-fields">
                {row.fields.map((field) => (
                  <i key={field.name} style={{ flex: field.hi - field.lo + 1, background: TONE[field.name] ?? "#e2e8f0" }} className={hover === field.name && format === item.id ? "on" : ""} onMouseEnter={() => { setFormat(item.id); setHover(field.name); }}>{field.name}<b>{field.hi - field.lo + 1}</b></i>
                ))}
              </span>
            </button>
          );
        })}
      </section>
      <div className="isx-split three">
        <section className="isx-card">
          <h2><Mark kind="term" /> Try it yourself</h2>
          <p className="isx-lead">Select a format to explore how an instruction is encoded.</p>
          <label>Choose format
            <select aria-label="Format" value={format} onChange={(event) => setFormat(event.target.value as RvTeachFormat)}>
              {FORMATS.map((item) => <option key={item.id} value={item.id}>{item.title} ({item.example})</option>)}
            </select>
          </label>
          {format === "R" ? <label>Operation<select aria-label="R-type operation" value={variant} onChange={(event) => setVariant(event.target.value as "add" | "sub")}><option value="add">ADD</option><option value="sub">SUB</option></select></label> : null}
          <div className="isx-knobs">
            {format !== "S" && format !== "B" ? <label>rd<input aria-label="rd" type="number" min={0} max={31} value={rd} onChange={(event) => setRd(num(event.target.value, 31))} /></label> : null}
            <label>rs1<input aria-label="rs1" type="number" min={0} max={31} value={rs1} onChange={(event) => setRs1(num(event.target.value, 31))} /></label>
            {format !== "I" ? <label>rs2<input aria-label="rs2" type="number" min={0} max={31} value={rs2} onChange={(event) => setRs2(num(event.target.value, 31))} /></label> : null}
            {format === "R" ? null : <label>imm<input aria-label="Immediate" type="number" value={imm} onChange={(event) => setImm(num(event.target.value, 2047, -2048))} /></label>}
          </div>
        </section>
        <section className="isx-card">
          <h2><Mark kind="gear" /> Worked example: {FORMATS.find((item) => item.id === format)?.title}</h2>
          <p className="mono">{example.asm}</p>
          <p>{example.equation}</p>
          <div className="isx-mini-fields">
            {example.fields.map((field) => (
              <button key={field.name} type="button" className={hover === field.name ? "on" : ""} style={{ flex: field.hi - field.lo + 1, background: TONE[field.name] }} onMouseEnter={() => setHover(field.name)} onFocus={() => setHover(field.name)} onClick={() => setHover(field.name)}>
                <b>{field.bits}</b>
                <small>{field.name}</small>
                <small>{field.hex}</small>
              </button>
            ))}
          </div>
          {explain && active ? <p className="isx-note">{active.name}: {active.meaning} Bits {active.hi}–{active.lo} are {active.bits}.</p> : null}
        </section>
        <section className="isx-card isx-word">
          <h2>32-bit instruction</h2>
          <p className="mono isx-bin">{example.binary.replace(/(.{8})/g, "$1 ").trim()}</p>
          <p className="mono isx-pop">{example.hex}</p>
        </section>
      </div>
      <section className="isx-card">
        <h2><Mark kind="bulb" /> When each format is used</h2>
        <div className="isx-uses">
          {FORMATS.map((item) => (
            <button key={item.id} type="button" className={format === item.id ? "on" : ""} onClick={() => setFormat(item.id)}>
              <strong>{item.title}</strong>
              <span>{item.blurb}</span>
              <em>{item.example}</em>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function num(text: string, max: number, min = 0): number {
  const value = Math.trunc(Number(text));
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}
