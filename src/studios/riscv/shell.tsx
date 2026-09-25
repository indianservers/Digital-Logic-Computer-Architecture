import type { ReactNode } from "react";
import { ConceptNotes } from "../conceptNotes";
import { NavLink } from "react-router-dom";
import { archLab, archStudio } from "../../data/architecture";

const GLYPH: Record<string, ReactNode> = {
  overview: <path d="M4 10h6V4H4zm10 0h6V4h-6zM4 20h6v-6H4zm10 4h6v-10h-6z" />,
  registers: <path d="M5 5h14v14H5zM5 10h14M10 5v14" />,
  formats: <path d="M4 7h16M4 12h10M4 17h13" />,
  encoding: <path d="M7 7h2v10H7zm4-2h2v14h-2zm4 3h2v8h-2z" />,
  assembler: <path d="M8 7l-4 5 4 5M16 7l4 5-4 5M13 5l-2 14" />,
  arith: <path d="M12 4v16M6 8h12M8 16h8" />,
  loadstore: <path d="M6 7h12v10H6zM9 7V5h6v2M12 11v4M10 13h4" />,
  branches: <path d="M6 6h6v4H6zM14 14h6v4h-6zM9 10v2a4 4 0 0 0 4 4h1" />,
  jal: <path d="M5 12h10M12 8l4 4-4 4M5 6v12" />,
  lui: <path d="M5 16V8l7-3 7 3v8" />,
  immgen: <path d="M6 6h4v4H6zm8 0h4v4h-4zM8 10v3h8v-3M12 13v5" />,
  datapath: <path d="M4 8h5v8H4zm11-2h5v5h-5zm0 7h5v5h-5zM9 12h6" />,
  multicycle: <path d="M12 5a7 7 0 1 1-4 12.7" />,
  pipeline: <path d="M5 16V8m5 8V6m5 10V9m4 7V5" />,
  hazards: <path d="M8 8l8 8M16 8l-8 8" />,
  program: <path d="M8 6l10 6-10 6z" />,
};

export function RvGlyph({ id }: { id: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {GLYPH[id] ?? GLYPH.overview}
    </svg>
  );
}

const HEADS: Record<string, { title: string; sub: string; note: string; quote: string }> = {
  overview: { title: "RISC-V Processor Lab", sub: "Explore the RV32I teaching subset: formats, assembler, datapath, pipeline, and hazards.", note: "Small ISA.\nBig Ideas.", quote: "Architecture is the visible expression of ideas. — David Patterson" },
  formats: { title: "Instruction Formats & Encoding Explorer", sub: "Visualize RISC-V instruction formats, explore fields, and see how assembly maps to machine code.", note: "Same ISA.\nBig Ideas.", quote: "Assembly is human intent; machine code is the exact plan. — David Patterson" },
  encoding: { title: "Instruction Formats & Encoding Explorer", sub: "Visualize RISC-V instruction formats, explore fields, and see how assembly maps to machine code.", note: "Same ISA.\nBig Ideas.", quote: "Assembly is human intent; machine code is the exact plan. — David Patterson" },
  assembler: { title: "Assembler", sub: "Write RISC-V assembly, assemble to machine code, run, and explore on a real RV32I simulator.", note: "Code.\nAssemble.\nRun. Learn.", quote: "Assembly is where ideas become behavior. — Computer Architect" },
  arith: { title: "Arithmetic & Logic", sub: "Explore the RISC-V ALU. Try operations, see results in multiple formats, and build intuition.", note: "Same Instructions.\nBigger Understanding.", quote: "Instructions build a brighter you." },
  loadstore: { title: "Loads & Stores", sub: "Move data between registers and memory using lw and sw. Explore addressing, alignment, and state.", note: "Data Moves.\nIdeas Forward.", quote: "Memory is where programs meet the real world. — David Patterson" },
  branches: { title: "Control Flow & Constants", sub: "Master how RISC-V changes the program counter and builds 32-bit constants.", note: "Control Flow\nDrives Possibility.", quote: "Control flow turns instructions into algorithms. — Computer Architecture" },
  jal: { title: "Control Flow & Constants", sub: "Master how RISC-V changes the program counter and builds 32-bit constants.", note: "Control Flow\nDrives Possibility.", quote: "Control flow turns instructions into algorithms. — Computer Architecture" },
  lui: { title: "Control Flow & Constants", sub: "Master how RISC-V changes the program counter and builds 32-bit constants.", note: "Control Flow\nDrives Possibility.", quote: "Control flow turns instructions into algorithms. — Computer Architecture" },
  immgen: { title: "Immediate Generator & Single-Cycle Datapath", sub: "From instruction bits to meaningful values — and through the datapath in a single cycle.", note: "Same Instructions.\nNew Perspectives.", quote: "The immediate is not just a number — it is the bridge between the instruction and the datapath." },
  datapath: { title: "Immediate Generator & Single-Cycle Datapath", sub: "From instruction bits to meaningful values — and through the datapath in a single cycle.", note: "Same Instructions.\nNew Perspectives.", quote: "The immediate is not just a number — it is the bridge between the instruction and the datapath." },
  multicycle: { title: "Pipeline, Multi-Cycle & Hazards", sub: "Go deeper into how RISC-V instructions flow through time: multi-cycle execution, pipelining, hazards, and performance.", note: "Same ISA.\nBigger Ideas.", quote: "Good microarchitecture turns dependencies into opportunities. — David Patterson" },
  pipeline: { title: "Pipeline, Multi-Cycle & Hazards", sub: "Go deeper into how RISC-V instructions flow through time: multi-cycle execution, pipelining, hazards, and performance.", note: "Same ISA.\nBigger Ideas.", quote: "Good microarchitecture turns dependencies into opportunities. — David Patterson" },
  hazards: { title: "Pipeline, Multi-Cycle & Hazards", sub: "Go deeper into how RISC-V instructions flow through time: multi-cycle execution, pipelining, hazards, and performance.", note: "Same ISA.\nBigger Ideas.", quote: "Good microarchitecture turns dependencies into opportunities. — David Patterson" },
  program: { title: "Program Execution", sub: "Assemble, load, and run RISC-V programs. Step through instructions and watch registers, memory, and the PC.", note: "Run.\nExplore.\nUnderstand.", quote: "PC + Registers + Memory work together." },
};

export function RiscvShell({ lab, children }: { lab: string; children: ReactNode }) {
  const studio = archStudio("riscv");
  const current = archLab("riscv", lab);
  const head = HEADS[lab] ?? HEADS.overview;
  if (!studio || !current || !head) return null;
  return (
    <div className="rvx">
      <nav className="rvx-nav" aria-label="RISC-V Processor Lab">
        <h2>RISC-V Processor Lab</h2>
        {studio.labs.map((item) => {
          const to = item.id === "overview" ? studio.path : `${studio.path}/${item.id}`;
          return (
            <NavLink key={item.id} to={to} end={item.id === "overview"} className={lab === item.id ? "active" : undefined}>
              <RvGlyph id={item.id} />
              {item.title}
            </NavLink>
          );
        })}
      </nav>
      <div className="rvx-main">
        <header className="rvx-head">
          <div className="rvx-mark" aria-hidden="true"><RvGlyph id={lab} /></div>
          <div>
            <h1>{head.title}</h1>
            <p>{head.sub}</p>
          </div>
          <div className="rvx-note">{head.note.split("\n").map((line) => <span key={line}>{line}<br /></span>)}</div>
        </header>
        {children}
        <ConceptNotes studio="riscv" lab={lab} />
      </div>
      <aside className="rvx-rail">
        <section>
          <h3>Studio Guide</h3>
          <ol>
            {current.guide.map((step, index) => (
              <li key={step}><span className="rvx-step">{index + 1}</span><span>{step}</span></li>
            ))}
          </ol>
          <a className="rvx-btn" href="#rvx-takes" style={{ display: "inline-block", marginTop: 10, textDecoration: "none" }}>Open Full Guide</a>
        </section>
        <section id="rvx-takes">
          <h3>Key Takeaways</h3>
          <ul>
            {current.takeaways.map((item) => (
              <li key={item}><span className="rvx-ok">✓</span><span>{item}</span></li>
            ))}
          </ul>
          <p className="rvx-quote">“{head.quote}”</p>
        </section>
      </aside>
    </div>
  );
}
