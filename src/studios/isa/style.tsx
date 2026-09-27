import { useEffect, useState } from "react";
import { COMPARE_EXAMPLES } from "../../engines/isa/teach";
import { Mark, RunBar } from "./ui";

const ROWS = [
  ["Instruction complexity", "Simple, fixed-length instructions", "Complex, variable-length instructions"],
  ["Decoding", "One width, a regular decode step", "More decode logic, and often internal micro-ops"],
  ["Pipeline friendliness", "Regular encodings are easy to pipeline", "Variable length makes fetch harder; pipelines still exist"],
  ["Code density", "Often more instructions for one task", "Often fewer instructions in the listing"],
  ["Examples", "RISC-V, ARM, MIPS", "x86, with a long variable-length history"],
];

export function StylePanel({ explain }: { explain: boolean }) {
  const [id, setId] = useState(COMPARE_EXAMPLES[0]?.id ?? "add-mem");
  const [step, setStep] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const example = COMPARE_EXAMPLES.find((item) => item.id === id) ?? COMPARE_EXAMPLES[0];
  useEffect(() => {
    if (!playing || !example) return undefined;
    const timer = window.setTimeout(() => {
      const last = Math.max(example.risc.length, example.cisc.length) - 1;
      setStep((current) => {
        if (current >= last) { setPlaying(false); return current; }
        return current + 1;
      });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [playing, step, example]);

  return (
    <div className="isx-stack">
      <div className="isx-hero">
        <section className="isx-banner">
          <p className="isx-kicker"><Mark kind="book" /> Core concept</p>
          <h2>RISC and CISC</h2>
          <p>RISC (Reduced Instruction Set Computer) and CISC (Complex Instruction Set Computer) are two design philosophies. They trade off instruction complexity, hardware design, and how much work one instruction names. Both families ship in fast machines.</p>
        </section>
        <aside className="isx-pull"><p>Same goal, different philosophies, same computing power.</p></aside>
      </div>
      <div className="isx-split">
        <section className="isx-card">
          <h2><Mark kind="bars" /> RISC vs CISC — key differences</h2>
          <p className="isx-lead">Both approaches work. They make different trade-offs in instruction design and hardware design.</p>
          <table className="isx-table">
            <thead><tr><th></th><th>RISC</th><th>CISC</th></tr></thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row[0]}><th>{row[0]}</th><td>{row[1]}</td><td>{row[2]}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="isx-card isx-chips">
          <h2>Visual comparison</h2>
          <p className="isx-lead">Same high-level operation, different approaches.</p>
          <div className="isx-chip-row">
            <article><div className="die">RISC</div><h3>Simple and regular</h3><ul><li>Fixed-length instructions</li><li>Easier fetch and decode</li><li>Arithmetic stays in registers</li></ul></article>
            <article><div className="die cisc">CISC</div><h3>Complex and feature-rich</h3><ul><li>Variable-length encodings</li><li>Memory operands in arithmetic</li><li>Often cracked into micro-ops</li></ul></article>
          </div>
        </section>
      </div>
      <section className="isx-card">
        <div className="isx-try-head">
          <div>
            <h2><Mark kind="term" /> Try it yourself — compare examples</h2>
            <p className="isx-lead">See how the same operation can be expressed differently in RISC and CISC. Select an example to explore.</p>
          </div>
          <RunBar
            label=""
            extra={<select aria-label="Example" value={id} onChange={(event) => { setId(event.target.value); setStep(-1); setPlaying(false); }}>{COMPARE_EXAMPLES.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select>}
            onRun={() => { setStep(0); setPlaying(true); }}
            onReset={() => { setStep(-1); setPlaying(false); }}
          />
        </div>
        {example ? (
          <div className="isx-duel">
            <div>
              <header>RISC (RISC-V style) <b>{example.risc.length} instructions</b></header>
              <div className="isx-code">
                {example.risc.map((line, index) => <div key={line} className={index <= step ? "on" : ""}><span>{index + 1}</span><code>{line}</code></div>)}
              </div>
            </div>
            <div>
              <header>CISC (x86 style) <b>{example.cisc.length} instruction{example.cisc.length === 1 ? "" : "s"}</b></header>
              <div className="isx-code">
                {example.cisc.map((line, index) => <div key={line} className={index <= step ? "on" : ""}><span>{index + 1}</span><code>{line}</code></div>)}
              </div>
            </div>
          </div>
        ) : null}
      </section>
      <div className="isx-split three">
        <section className="isx-what"><h3>Choose a RISC-like ISA when</h3><p>You want a regular encoding, a load/store contract, or a general-purpose open ISA such as RISC-V.</p></section>
        <section className="isx-card"><h3>Choose a CISC-like ISA when</h3><p>You need dense legacy software, memory operands in arithmetic, or compatibility with existing x86 programs.</p></section>
        {explain ? <section className="isx-card"><h3>What to notice</h3><p>{example?.memNote}</p><p>{example?.stageNote}</p></section> : <section className="isx-card"><h3>What to notice</h3><p>{example?.memNote}</p></section>}
      </div>
    </div>
  );
}
