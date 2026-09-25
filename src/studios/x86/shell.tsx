import type { ReactNode } from "react";
import { ConceptNotes } from "../conceptNotes";
import { NavLink } from "react-router-dom";
import { archLab, archStudio } from "../../data/architecture";

const GLYPH: Record<string, ReactNode> = {
  overview: <path d="M4 10h6V4H4zm10 0h6V4h-6zM4 20h6v-6H4zm10 4h6v-10h-6z" />,
  "registers-flags": <path d="M5 5h14v14H5zM5 10h14M10 5v14" />,
  "instruction-encoding": <path d="M4 7h16M7 7v10M12 7v10M16 7v10" />,
  "addressing-modes": <path d="M5 16l7-8 7 8M8 16h8" />,
  "assembler-disassembler": <path d="M8 7l-4 5 4 5M16 7l4 5-4 5M13 5l-2 14" />,
  "decode-datapath": <path d="M4 8h5v8H4zm7-2h5v5h-5zm0 7h5v5h-5z" />,
  "micro-operations": <path d="M4 8h6v8H4zm10-2h6v6h-6zM8 12h6" />,
  "out-of-order": <path d="M5 7h6v4H5zm8 0h6v4h-6zM5 14h6v4H5zm8 0h6v4h-6z" />,
  "memory-cache": <path d="M6 6h12v4H6zm2 6h8v3h-8zm3 4h2v3h-2z" />,
  practice: <path d="M7 4h10v4H7zM6 10h12v10H6z" />,
};

const HEADS: Record<string, { title: string; sub: string }> = {
  overview: { title: "x86 Architecture Explorer", sub: "Variable-length encodings, addressing, micro-ops, and a modern OOO backend sketch" },
  "registers-flags": { title: "Registers & Flags", sub: "Explore x86-64 general-purpose registers, subregister aliases, RIP, and RFLAGS" },
  "instruction-encoding": { title: "Variable-Length Instruction Encoding", sub: "Build x86 instructions byte by byte: prefixes, opcode, ModR/M, SIB, displacement, immediate" },
  "addressing-modes": { title: "Addressing Modes", sub: "Explore base + index×scale + displacement, RIP-relative, and effective-address calculation" },
  "assembler-disassembler": { title: "Assembler & Disassembler", sub: "Write x86-64 assembly, assemble to bytes, disassemble, run, and inspect machine state" },
  "decode-datapath": { title: "Decode & Datapath", sub: "Trace variable-length bytes through fetch, decode, operand read, execute, memory, and retirement" },
  "micro-operations": { title: "Micro-operations (µOps)", sub: "See how complex x86 instructions decode into simpler internal operations and dependencies" },
  "out-of-order": { title: "Out-of-Order Backend", sub: "Explore rename, reservation stations, scheduling, execution, and in-order retirement" },
  "memory-cache": { title: "Memory & Cache", sub: "Explore x86 cache hierarchy, virtual memory translation, hits, misses, and latency" },
  practice: { title: "Practice & Quiz", sub: "Test registers, encoding, addressing, µOps, OOO execution, and cache behavior" },
};

function Glyph({ id }: { id: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {GLYPH[id] ?? GLYPH.overview}
    </svg>
  );
}

export function X86Shell({ lab, children }: { lab: string; children: ReactNode }) {
  const studio = archStudio("x86");
  const current = archLab("x86", lab);
  const head = HEADS[lab] ?? HEADS.overview;
  if (!studio || !current || !head) return null;
  return (
    <div className="rvx x86s">
      <nav className="rvx-nav" aria-label="x86 Architecture Explorer">
        <h2>x86 Architecture Explorer</h2>
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
            <h1><span className={`x86-badge ${lab}`}>x86</span> {head.title}</h1>
            <p>{head.sub}</p>
          </div>
        </header>
        {children}
        <ConceptNotes studio="x86" lab={lab} />
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
        <p className="rvx-quote">“Decode complexity, expose understanding.”</p>
      </aside>
    </div>
  );
}
