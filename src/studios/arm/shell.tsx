import type { ReactNode } from "react";
import { ConceptNotes } from "../conceptNotes";
import { NavLink } from "react-router-dom";
import { archLab, archStudio } from "../../data/architecture";

const GLYPH: Record<string, ReactNode> = {
  overview: <path d="M4 10h6V4H4zm10 0h6V4h-6zM4 20h6v-6H4zm10 4h6v-10h-6z" />,
  registers: <path d="M5 5h14v14H5zM5 10h14M10 5v14" />,
  "instruction-set": <path d="M4 7h16M4 12h10M4 17h13" />,
  assembler: <path d="M8 7l-4 5 4 5M16 7l4 5-4 5M13 5l-2 14" />,
  datapath: <path d="M4 8h5v8H4zm11-2h5v5h-5zm0 7h5v5h-5zM9 12h6" />,
  pipeline: <path d="M5 16V8m5 8V6m5 10V9m4 7V5" />,
  memory: <path d="M6 7h12v10H6zM9 7V5h6v2" />,
  exceptions: <path d="M12 4l7 4v6c0 4-3 6-7 8-4-2-7-4-7-8V8z" />,
  soc: <path d="M5 8h6v6H5zm8-2h6v6h-6zM8 16h8v4H8z" />,
  practice: <path d="M7 4h10v4H7zM6 10h12v10H6z" />,
};

const HEADS: Record<string, { title: string; sub: string; note: string; quote: string }> = {
  overview: { title: "ARM Architecture Explorer", sub: "AArch64-oriented interactive studio for registers, encodings, the datapath, pipeline hazards, memory, exceptions, and a teaching SoC.", note: "64-bit\nLoad/store\nException levels", quote: "See it. Change it. Understand it." },
  registers: { title: "Registers & Modes", sub: "Explore AArch64 X/W registers, special registers, ABI roles, and privilege context.", note: "Wn write\nzero-extends", quote: "See it. Change it. Understand it." },
  "instruction-set": { title: "Instruction Set & Encoding", sub: "Decode A64 fixed-width instructions, fields, immediates, and control flow.", note: "32-bit\nfixed length", quote: "See it. Change it. Understand it." },
  assembler: { title: "AArch64 Assembler", sub: "Write, assemble, run, and inspect real A64 code with live machine state.", note: "Assemble\nStep\nRun", quote: "See it. Change it. Understand it." },
  datapath: { title: "AArch64 Datapath", sub: "Trace A64 instructions through fetch, decode, execute, memory, and write-back.", note: "One instruction\none route", quote: "See it. Change it. Understand it." },
  pipeline: { title: "Pipeline & Hazards", sub: "Explore IF, ID, EX, MEM, WB overlap, dependencies, forwarding, and stalls.", note: "Forward\nor stall", quote: "See it. Change it. Understand it." },
  memory: { title: "Memory & Load/Store", sub: "Explore AArch64 addressing modes, LDR/STR, stack, and alignment.", note: "Base + offset", quote: "See it. Change it. Understand it." },
  exceptions: { title: "Exceptions & Interrupts", sub: "Understand EL0–EL3, vector entry, saved state, and exception return.", note: "Save state\nthen handle", quote: "See it. Change it. Understand it." },
  soc: { title: "Cores & SoC", sub: "Explore ARM core clusters, cache hierarchy, interconnect, accelerators, and power.", note: "Not a named chip", quote: "See it. Change it. Understand it." },
  practice: { title: "Practice & Quiz", sub: "Test registers, instructions, memory, pipeline, and exception-level concepts.", note: "Answer\nthen explain", quote: "See it. Change it. Understand it." },
};

function Glyph({ id }: { id: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {GLYPH[id] ?? GLYPH.overview}
    </svg>
  );
}

export function ArmShell({ lab, children }: { lab: string; children: ReactNode }) {
  const studio = archStudio("arm");
  const current = archLab("arm", lab);
  const head = HEADS[lab] ?? HEADS.overview;
  if (!studio || !current || !head) return null;
  return (
    <div className="rvx">
      <nav className="rvx-nav" aria-label="ARM Architecture Explorer">
        <h2>ARM Architecture Explorer</h2>
        {studio.labs.map((item) => {
          const to = item.id === "overview" ? studio.path : `${studio.path}/${item.id}`;
          return (
            <NavLink key={item.id} to={to} end={item.id === "overview"} className={lab === item.id ? "active" : undefined}>
              <Glyph id={item.id} />
              {item.title}
            </NavLink>
          );
        })}
      </nav>
      <div className="rvx-main">
        <header className="rvx-head">
          <div className="rvx-mark" aria-hidden="true"><Glyph id={lab} /></div>
          <div>
            <h1><span className={`arm-badge ${lab}`}>ARM</span> {head.title}</h1>
            <p>{head.sub}</p>
          </div>
          <div className="rvx-note">{head.note.split("\n").map((line) => <span key={line}>{line}<br /></span>)}</div>
        </header>
        {children}
        <ConceptNotes studio="arm" lab={lab} />
      </div>
      <aside className="rvx-rail">
        <section className="rvx-guide">
          <h3>Studio Guide</h3>
          <ol>{current.guide.map((step) => <li key={step}>{step}</li>)}</ol>
        </section>
        <section className="rvx-takes">
          <h3>Key Takeaways</h3>
          <ul>{current.takeaways.map((item) => <li key={item}>{item}</li>)}</ul>
        </section>
        <p className="rvx-quote">{head.quote}</p>
      </aside>
    </div>
  );
}
