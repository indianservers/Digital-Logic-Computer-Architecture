import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { archLab, archStudio } from "../../data/architecture";
import { ConceptNotes } from "../conceptNotes";

const ICONS: Record<string, string> = {
  overview: "/icons/mips-overview.png",
  "instruction-formats": "/icons/mips-formats.png",
  "register-file": "/icons/mips-registers.png",
  assembler: "/icons/mips-assembler.png",
  datapath: "/icons/mips-datapath.png",
  pipeline: "/icons/mips-pipeline.png",
  hazards: "/icons/mips-hazards.png",
  "memory-io": "/icons/mips-memory.png",
  "system-calls": "/icons/mips-syscalls.png",
  practice: "/icons/mips-practice.png",
};

const LESSON: Record<string, string> = {
  overview: "Start here. Click a datapath block or a topic card. Each lab on the left is a different idea.",
  "instruction-formats": "This page is only about how a 32-bit instruction is split into fields. Change a field and the machine code changes.",
  "register-file": "This page is only the 32 registers. Click a tile, then edit a value. $zero never changes.",
  assembler: "This page is only source code. Assemble, step, and run. The registers and console belong to the same simulator.",
  datapath: "This page is only the single-cycle route. Pick an instruction and see which boxes turn on.",
  pipeline: "This page is only time. Step one clock and watch IF, ID, EX, MEM, and WB fill up.",
  hazards: "This page is only dependencies. Turn forwarding off and count the extra stalls.",
  "memory-io": "This page is only memory. Add a base and an offset, then load or store a word.",
  "system-calls": "This page is only educational SPIM/MARS services. Pick a service, set the argument, and read the console.",
  practice: "This page is only questions from the other labs. Answer, read why, then take the next one.",
};

function LabIcon({ id, className }: { id: string; className: string }) {
  return <img className={className} src={ICONS[id] ?? ICONS.overview} alt="" />;
}

const HEADS: Record<string, { title: string; sub: string; note: string; quote: string }> = {
  overview: { title: "MIPS Architecture Explorer", sub: "Learn MIPS32 from instruction formats to a single-cycle datapath, pipeline, hazards, memory, and system calls.", note: "Simple architecture\nDeep ideas\nReal understanding", quote: "Architecture is the art of designing simple things that work beautifully. — MIPS Philosophy" },
  "instruction-formats": { title: "Instruction Formats", sub: "R-type, I-type, and J-type fields, with live binary and hexadecimal encoding.", note: "32 bits\nThree formats", quote: "The format tells the datapath which fields are registers and which are immediates." },
  "register-file": { title: "Register File", sub: "All 32 MIPS registers, ABI names, and a shared simulator value.", note: "$zero stays 0", quote: "ABI names are aliases. The hardware only sees a number from 0 to 31." },
  assembler: { title: "MIPS Assembler", sub: "Assemble, step, and run a MIPS32 teaching subset, including labels and short pseudo-instructions.", note: "Assemble\nStep\nRun", quote: "A following word of 0 is a teaching halt, not a MIPS trap." },
  datapath: { title: "Single-Cycle Datapath", sub: "One instruction travels PC, instruction memory, registers, ALU, data memory, and write-back.", note: "One cycle\nOne instruction", quote: "Muxes are the decisions. The ALU is the work." },
  pipeline: { title: "5-Stage Pipeline", sub: "IF, ID, EX, MEM, and WB overlap. Step a cycle and watch occupancy.", note: "Overlap\nfor throughput", quote: "Ideal CPI approaches 1 after the pipeline fills." },
  hazards: { title: "Hazards & Forwarding", sub: "RAW dependencies, load-use stalls, and the cycle cost of turning forwarding off.", note: "Forward\nor stall", quote: "Forwarding moves a result before it is written back." },
  "memory-io": { title: "Memory & I/O", sub: "Byte-addressed memory, word alignment, stack, and a small mapped console.", note: "Base + offset", quote: "Only loads and stores touch data memory." },
  "system-calls": { title: "System Calls", sub: "Educational SPIM/MARS services: print integer, print string, print character, and exit.", note: "Teaching services\nnot an OS", quote: "$v0 selects the service. $a0 carries the argument." },
  practice: { title: "Practice & Quiz", sub: "Questions drawn from the encodings, registers, and pipeline rules in this studio.", note: "Check\nthen explain", quote: "A wrong answer is useful when the explanation names the rule." },
};

export function MipsShell({ lab, children }: { lab: string; children: ReactNode }) {
  const studio = archStudio("mips");
  const current = archLab("mips", lab);
  const head = HEADS[lab] ?? HEADS.overview;
  if (!studio || !current || !head) return null;
  return (
    <div className="rvx">
      <nav className="rvx-nav" aria-label="MIPS Architecture Explorer">
        <h2>MIPS Architecture Explorer</h2>
        {studio.labs.map((item) => {
          const to = item.id === "overview" ? studio.path : `${studio.path}/${item.id}`;
          return (
            <NavLink key={item.id} to={to} end={item.id === "overview"} className={lab === item.id ? "active" : undefined}>
              <LabIcon id={item.id} className="mips-navico" />
              {item.title}
            </NavLink>
          );
        })}
      </nav>
      <div className="rvx-main">
        <header className="rvx-head">
          <LabIcon id={lab} className="mips-mark" />
          <div>
            <h1>{head.title}</h1>
            <p>{head.sub}</p>
          </div>
          <div className="rvx-note">{head.note.split("\n").map((line) => <span key={line}>{line}<br /></span>)}</div>
        </header>
        <section className="mips-lesson">
          <LabIcon id={lab} className="mips-lesson-img" />
          <p>{LESSON[lab] ?? LESSON.overview}</p>
        </section>
        {children}
        <ConceptNotes studio="mips" lab={lab} />
      </div>
      <aside className="rvx-rail">
        <section className="rvx-guide">
          <h3>Studio Guide</h3>
          <ol>{current.guide.map((step) => <li key={step}>{step}</li>)}</ol>
          <a href="#rvx-takes">Open Full Guide</a>
        </section>
        <section className="rvx-takes" id="rvx-takes">
          <h3>Key Takeaways</h3>
          <ul>{current.takeaways.map((item) => <li key={item}>{item}</li>)}</ul>
        </section>
        <p className="rvx-quote">{head.quote}</p>
      </aside>
    </div>
  );
}
