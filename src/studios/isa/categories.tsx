import { useState } from "react";
import { CATEGORIES, type CategoryId, type IsaFamily } from "../../engines/isa/teach";
import { CodeBlock, Mark, RunBar } from "./ui";

export function CategoriesPanel({ explain }: { explain: boolean }) {
  const [id, setId] = useState<CategoryId>("arithmetic");
  const [family, setFamily] = useState<IsaFamily>("riscv");
  const [left, setLeft] = useState(10);
  const [right, setRight] = useState(20);
  const [shown, setShown] = useState<number | null>(null);
  const current = CATEGORIES.find((item) => item.id === id) ?? CATEGORIES[0];
  if (!current) return null;
  const preview = current.run(left, right);

  return (
    <div className="isx-stack">
      <div className="isx-hero">
        <section className="isx-banner">
          <p className="isx-kicker"><Mark kind="book" /> Core concept</p>
          <h2>Instruction categories</h2>
          <p>Instructions are grouped into categories based on what they do. Each category serves a purpose, such as performing arithmetic, moving data, or changing the flow of control. Together they are the building blocks of programs.</p>
        </section>
        <aside className="isx-pull"><p>Different instructions, same goal — enable computation.</p></aside>
      </div>
      <section className="isx-card">
        <h2>Explore instruction categories</h2>
        <p className="isx-lead">Select a category to see a description and example instructions.</p>
        <div className="isx-tiles">
          {CATEGORIES.map((item) => (
            <button key={item.id} type="button" className={`tile-${item.id} ${id === item.id ? "on" : ""}`} onClick={() => { setId(item.id); setShown(null); }}>
              <Mark kind={item.id === "arithmetic" ? "calc" : item.id === "logic" ? "gear" : item.id === "transfer" ? "link" : item.id === "control" ? "flow" : item.id === "compare" ? "scale" : "reset"} />
              <strong>{item.title}</strong>
              <span>{item.blurb}</span>
            </button>
          ))}
        </div>
      </section>
      <div className="isx-split">
        <section className="isx-card">
          <header className="isx-try-head">
            <h2>{current.title} instructions</h2>
            <select aria-label="ISA family" value={family} onChange={(event) => setFamily(event.target.value as IsaFamily)}>
              <option value="generic">Generic</option>
              <option value="riscv">RISC-V</option>
              <option value="arm">ARM</option>
              <option value="x86">x86</option>
            </select>
          </header>
          <p>{current.purpose}</p>
          <p className="isx-lead">Common examples ({family})</p>
          <p className="isx-names">{current.names[family].join(" · ")}</p>
          <CodeBlock lines={current.lines[family].map((line) => <span key={line}>{line}</span>)} />
          <div className="isx-knobs">
            <label>Left<input aria-label="Left operand" type="number" value={left} onChange={(event) => setLeft(Math.trunc(Number(event.target.value) || 0))} /></label>
            <label>Right<input aria-label="Right operand" type="number" value={right} onChange={(event) => setRight(Math.trunc(Number(event.target.value) || 0))} /></label>
          </div>
          <RunBar label={preview.text} onRun={() => setShown(preview.value)} onReset={() => { setLeft(10); setRight(20); setShown(null); setFamily("riscv"); setId("arithmetic"); }} />
          <p className="isx-after">Result: <strong>{shown === null ? "—" : shown}</strong></p>
          {explain ? <p className="isx-note">Mnemonics differ by ISA. A RISC-V <span className="mono">slt</span> writes 0 or 1. An x86 <span className="mono">CMP</span> sets flags and writes no register.</p> : null}
        </section>
        <section className="isx-card">
          <h2><Mark kind="flow" /> How categories work together</h2>
          <div className="isx-map">
            <div className="hub">Program behavior</div>
            <div className="isx-map-row">
              {CATEGORIES.filter((item) => item.id !== "shift").map((item) => (
                <button key={item.id} type="button" className={id === item.id ? "on" : ""} onClick={() => setId(item.id)}>{item.title}</button>
              ))}
            </div>
            <p>Together, these categories carry a program: move data, compute, test, and choose the next instruction. Shift and rotate sit with arithmetic as bit-level tools.</p>
          </div>
          <p className="isx-pull flat">Simple categories. Infinite possibilities.</p>
        </section>
      </div>
    </div>
  );
}
