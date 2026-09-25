import type { ReactNode } from "react";
import { ConceptNotes } from "../conceptNotes";
import { Link, NavLink } from "react-router-dom";
import { archLab, archStudio } from "../../data/architecture";
import { usePrefs } from "../../store/prefs";

const GLYPH: Record<string, ReactNode> = {
  home: <path d="M4 10.5 12 4l8 6.5V20H4zM9 20v-6h6v6" />,
  overview: <path d="M5 19V9m7 10V5m7 14v-7" />,
  "register-models": <path d="M5 6h14v4H5zm0 8h14v4H5z" />,
  "instruction-encoding": <path d="M4 8h4v8H4zm6 0h4v8h-4zm6 0h4v8h-4" />,
  "instruction-length": <path d="M4 7h16M7 7v10M12 7v6M16 7v10" />,
  "memory-access": <path d="M6 6h12v5H6zm2 7h8v3h-8zm3 4h2v2h-2z" />,
  addressing: <path d="M12 4v10M8 10l4 4 4-4M6 20h12" />,
  "same-task": <path d="M8 7l-4 5 4 5M16 7l4 5-4 5" />,
  "decode-complexity": <path d="M4 8h5v8H4zm7-2h4v5h-4zm0 7h4v5h-4zm6-5h4v8h-4z" />,
  "ecosystem-roles": <path d="M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm0 0c2 2.2 3 4.6 3 8s-1 5.8-3 8c-2-2.2-3-4.6-3-8s1-5.8 3-8zM4 12h16" />,
};

const HEADS: Record<string, { title: string; sub: string; quote: string }> = {
  home: { title: "ISA Comparison Explorer", sub: "A neutral educational explorer comparing RISC-V, ARM, and x86 as teaching models.", quote: "Different designs. A deeper understanding." },
  overview: { title: "Overview", sub: "Compare how RISC-V, ARM, and x86 approach ISA design, and see what makes each unique.", quote: "Different designs. A deeper understanding." },
  "register-models": { title: "Register Models", sub: "Compare naming conventions, register widths, and aliases across RISC-V, ARM, and x86.", quote: "Same job. Different names. Understanding registers builds fluency across ISAs." },
  "instruction-encoding": { title: "Instruction Encoding", sub: "Compare how instruction bits are structured across RISC-V, ARM, and x86.", quote: "Different encodings. Same ideas. The computer still adds." },
  "instruction-length": { title: "Instruction Length", sub: "Explore how RISC-V, ARM, and x86 use fixed-length or variable-length instructions.", quote: "Instructions are the words of a machine language — their length shapes its story." },
  "memory-access": { title: "Memory Access", sub: "See how RISC-V, ARM, and x86 interact with memory, and understand the similarities and differences.", quote: "Memory is where programs meet the real world." },
  addressing: { title: "Addressing", sub: "Compare addressing styles and effective address formation across RISC-V, ARM, and x86.", quote: "Same memory. Different paths. Same ideas, different trade-offs." },
  "same-task": { title: "Same Task Comparison", sub: "Solve the same problem in RISC-V, ARM, and x86. Compare code, instructions, and execution step by step.", quote: "Same problem. Different paths. Deeper understanding." },
  "decode-complexity": { title: "Decode Complexity Concept", sub: "Explore the educational idea of front-end decode complexity across RISC-V, ARM, and x86.", quote: "Complexity in the front-end enables compatibility in the real world." },
  "ecosystem-roles": { title: "Ecosystem Roles", sub: "Where RISC-V, ARM, and x86 commonly appear — and why.", quote: "Different designs. A more capable world." },
};

function Glyph({ id }: { id: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {GLYPH[id] ?? GLYPH.home}
    </svg>
  );
}

export function CompareShell({ lab, onReset, children }: { lab: string; onReset: () => void; children: ReactNode }) {
  const studio = archStudio("compare");
  const current = archLab("compare", lab);
  const head = HEADS[lab] ?? HEADS.home;
  const { prefs, update } = usePrefs();
  if (!studio || !current || !head) return null;
  return (
    <div className={`rvx cmp${prefs.explain ? "" : " explain-off"}`}>
      <nav className="rvx-nav" aria-label="ISA Comparison Explorer">
        <p className="cmp-nav-kicker">ISA Comparison Explorer</p>
        {studio.labs.map((item) => {
          const to = item.id === "home" ? studio.path : `${studio.path}/${item.id}`;
          return (
            <NavLink key={item.id} to={to} end={item.id === "home"} className={lab === item.id ? "active" : undefined}>
              <Glyph id={item.id} />
              {item.id === "home" ? "Studio Home" : item.title}
            </NavLink>
          );
        })}
      </nav>
      <div className="rvx-main">
        <header className="cmp-head">
          <div className="cmp-title">
            <span className="cmp-mark" aria-hidden="true"><Glyph id={lab} /></span>
            <div>
              <h1>{head.title}</h1>
              <p>{head.sub}</p>
            </div>
          </div>
          <div className="cmp-tools">
            <Link to={lab === "home" ? "/" : studio.path}>{lab === "home" ? "Digital Logic Home" : "Studio Home"}</Link>
            <Link to="/">Home</Link>
            <button type="button" className={prefs.explain ? "on" : ""} aria-pressed={prefs.explain} onClick={() => update({ explain: !prefs.explain })}>Explain</button>
            <button type="button" onClick={onReset}>Reset</button>
          </div>
        </header>
        {children}
        <ConceptNotes studio="compare" lab={lab} />
      </div>
      <aside className="rvx-rail">
        <section className="rvx-guide" id="cmp-guide">
          <h3>Studio Guide</h3>
          <ol>{current.guide.map((step, index) => <li key={step}><b>{index + 1}</b><span>{step}</span></li>)}</ol>
        </section>
        <section className="rvx-takes">
          <h3>Key Takeaways</h3>
          <ul>{current.takeaways.map((item) => <li key={item}>{item}</li>)}</ul>
        </section>
        <section className="cmp-help">
          <h3>Need Help?</h3>
          <a href="#cmp-guide">Open Studio Guide</a>
          <button type="button" onClick={() => update({ explain: true })}>View Example Walkthrough</button>
          <button type="button" onClick={onReset}>Reset This Studio</button>
          <Link to="/notes">Send Feedback</Link>
        </section>
        <p className="rvx-quote">“{head.quote}”</p>
      </aside>
    </div>
  );
}
