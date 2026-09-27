import { useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Icon } from "../../design-system/icons";
import { usePrefs } from "../../store/prefs";
import { AddressingPanel } from "./addressing";
import { AnatomyPanel } from "./anatomy";
import { BasicsPanel } from "./basics";
import { CategoriesPanel } from "./categories";
import { FormatsPanel } from "./formats";
import { LoadPanel } from "./load";
import { StylePanel } from "./style";
import { Mark } from "./ui";

const TABS = [
  { id: "basics", label: "ISA Basics" },
  { id: "anatomy", label: "Anatomy" },
  { id: "formats", label: "Formats" },
  { id: "style", label: "RISC / CISC" },
  { id: "load", label: "Load / Store" },
  { id: "modes", label: "Addressing" },
  { id: "catalog", label: "Categories" },
] as const;

const ALIAS: Record<string, string> = {
  "risc-cisc": "style",
  "load-store": "load",
  addressing: "modes",
  categories: "catalog",
};

const PAGE: Record<string, { subtitle: string; guide: string[]; takeaways: string[]; quote: string; by: string; next: string; nextTab: string; nextLabel: string }> = {
  basics: {
    subtitle: "Learn how software talks to hardware. The instruction set is the contract between your program and the CPU.",
    guide: ["Read the core concept.", "Try the instruction and edit the register values.", "Compare RISC-V, ARM, and x86.", "Continue to Anatomy."],
    takeaways: ["The ISA is the contract between software and the CPU.", "It defines instructions, registers, and legal operations.", "Different CPUs can implement the same ISA.", "RISC-V, ARM, and x86 are different ISA families."],
    quote: "The ISA is the boundary between what you can write and what the hardware can do.",
    by: "David Patterson",
    next: "Continue to Anatomy to explore the parts of an instruction.",
    nextTab: "anatomy",
    nextLabel: "Go to Anatomy",
  },
  anatomy: {
    subtitle: "Understand the parts of an instruction: how the bits encode the operation, registers, and immediate values.",
    guide: ["Read how a 16-bit instruction is divided into fields.", "Select a field and read its bit range.", "Change the instruction and watch the encoding.", "Continue to Formats."],
    takeaways: ["An instruction is divided into fields.", "Each bit range has a specific meaning.", "The opcode selects the operation.", "The same 16-bit layout encodes many instructions."],
    quote: "In computer architecture, meaning emerges from bits in the right place.",
    by: "David Patterson",
    next: "Continue to Formats to see different instruction layouts.",
    nextTab: "formats",
    nextLabel: "Go to Formats",
  },
  formats: {
    subtitle: "Learn how instructions are organized into binary layouts. Different operations use different instruction formats.",
    guide: ["Read why several formats exist.", "Select R, I, S, or B.", "Change rd, rs1, rs2, or the immediate and read the hex.", "Continue to RISC / CISC."],
    takeaways: ["Instructions use different formats.", "Each format allocates bits for what that operation needs.", "R, I, S, and B are the common RISC-V layouts in this lab.", "The opcode and field positions identify the instruction."],
    quote: "An instruction format is a template that tells the hardware how to interpret the bits.",
    by: "David Patterson",
    next: "Continue to RISC / CISC to compare design philosophies.",
    nextTab: "style",
    nextLabel: "Go to RISC / CISC",
  },
  style: {
    subtitle: "Compare RISC and CISC philosophies, their design trade-offs, and how they shape modern processors.",
    guide: ["Read the core comparison.", "Study the table. Avoid ranking one family as always faster.", "Run an example and watch both listings.", "Continue to Load / Store."],
    takeaways: ["RISC encodings are regular. CISC encodings are often variable-length.", "A shorter listing is not a faster machine.", "Modern x86 cores may translate instructions into micro-ops.", "Both families run real high-performance software."],
    quote: "Simplicity is the ultimate sophistication. Simple designs can be incredibly powerful.",
    by: "Leonardo da Vinci",
    next: "Continue to Load / Store to move data between registers and memory.",
    nextTab: "load",
    nextLabel: "Go to Load / Store",
  },
  load: {
    subtitle: "Learn how data moves between memory and registers using load and store instructions.",
    guide: ["Read why only load and store touch data memory.", "Run the demo and watch R1 and Mem[104].", "Edit a register or a memory cell and run again.", "Switch to LW or SW and check the effective address.", "Continue to Addressing."],
    takeaways: ["Load copies memory into a register.", "Store copies a register into memory.", "ALU operations do not touch data memory.", "The address is usually a base register plus an offset."],
    quote: "The register file is the workspace of the CPU, and memory is the long-term storage.",
    by: "David Patterson",
    next: "Continue to Addressing to see how an effective address is calculated.",
    nextTab: "modes",
    nextLabel: "Go to Addressing",
  },
  modes: {
    subtitle: "How instructions locate operands.",
    guide: ["Open Immediate and change the constant.", "Step through Register, Direct, and Indirect.", "On Base + Offset, try offset −4 and read the effective address.", "On Indexed, change the index register separately from the offset.", "Continue to Categories."],
    takeaways: ["An addressing mode says where the operand is.", "Immediate and register modes do not access memory.", "The effective address is the memory location. Mem[EA] is the operand.", "Only one extra lookup separates indirect from direct."],
    quote: "An instruction doesn't just say what to do. It also tells you where to find the data.",
    by: "David Patterson",
    next: "Continue to Categories to group instructions by purpose.",
    nextTab: "catalog",
    nextLabel: "Go to Categories",
  },
  catalog: {
    subtitle: "Learn how instructions are grouped by purpose, and how each category helps programs get work done.",
    guide: ["Read why instructions are grouped.", "Select each category.", "Switch the ISA family and notice the mnemonics change.", "Run the small example.", "Open Practice when you want questions."],
    takeaways: ["Instructions are grouped by what they do.", "Arithmetic, logic, data transfer, control, compare, and shift cover most programs.", "The same jobs exist in RISC-V, ARM, and x86.", "The spellings are not identical."],
    quote: "An instruction set is more powerful when you see the patterns between the instructions.",
    by: "David Patterson",
    next: "Try a short quiz to practice identifying instruction categories.",
    nextTab: "practice",
    nextLabel: "Go to Practice",
  },
};

export function IsaStudio() {
  const root = useRef<HTMLDivElement>(null);
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab");
  const aliased = raw ? ALIAS[raw] ?? raw : "basics";
  const tab = TABS.some((item) => item.id === aliased) ? aliased : "basics";
  const page = PAGE[tab] ?? PAGE.basics;
  const { prefs } = usePrefs();
  if (!page) return null;

  function setTab(id: string) {
    const next = new URLSearchParams(params);
    next.set("tab", id);
    setParams(next);
  }

  return (
    <div className="isx" ref={root}>
      <header className="isx-head">
        <div>
          <h1><Mark kind="chip" /> Instruction Set Architecture</h1>
          <p>{page.subtitle}</p>
        </div>
        <div className="isx-head-actions">
          <button type="button" className="isx-quiet" onClick={() => { if (document.fullscreenElement) void document.exitFullscreen(); else void root.current?.requestFullscreen(); }}><Mark kind="full" /> Full Screen</button>
          <Link className="isx-back" to="/"><Icon name="back" size={14} /> Back to Path</Link>
        </div>
      </header>
      <div className="isx-tabs" role="tablist" aria-label="Instruction set architecture">
        {TABS.map((item) => (
          <button key={item.id} type="button" role="tab" id={`isa-tab-${item.id}`} aria-selected={tab === item.id} aria-controls={`isa-panel-${item.id}`} className={tab === item.id ? "on" : ""} onClick={() => setTab(item.id)}>{item.label}</button>
        ))}
      </div>
      <div className="isx-grid">
        <div className="isx-main">
          <div id="isa-panel-basics" role="tabpanel" aria-labelledby="isa-tab-basics" hidden={tab !== "basics"} inert={tab !== "basics" ? true : undefined}><BasicsPanel explain={prefs.explain} /></div>
          <div id="isa-panel-anatomy" role="tabpanel" aria-labelledby="isa-tab-anatomy" hidden={tab !== "anatomy"} inert={tab !== "anatomy" ? true : undefined}><AnatomyPanel explain={prefs.explain} /></div>
          <div id="isa-panel-formats" role="tabpanel" aria-labelledby="isa-tab-formats" hidden={tab !== "formats"} inert={tab !== "formats" ? true : undefined}><FormatsPanel explain={prefs.explain} /></div>
          <div id="isa-panel-style" role="tabpanel" aria-labelledby="isa-tab-style" hidden={tab !== "style"} inert={tab !== "style" ? true : undefined}><StylePanel explain={prefs.explain} /></div>
          <div id="isa-panel-load" role="tabpanel" aria-labelledby="isa-tab-load" hidden={tab !== "load"} inert={tab !== "load" ? true : undefined}><LoadPanel explain={prefs.explain} /></div>
          <div id="isa-panel-modes" role="tabpanel" aria-labelledby="isa-tab-modes" hidden={tab !== "modes"} inert={tab !== "modes" ? true : undefined}><AddressingPanel explain={prefs.explain} /></div>
          <div id="isa-panel-catalog" role="tabpanel" aria-labelledby="isa-tab-catalog" hidden={tab !== "catalog"} inert={tab !== "catalog" ? true : undefined}><CategoriesPanel explain={prefs.explain} /></div>
        </div>
        <aside className="isx-side">
          <section className="isx-guide">
            <h2><Mark kind="book" /> Studio Guide</h2>
            <ol>{page.guide.map((item, index) => <li key={item}><span>{index + 1}</span>{item}</li>)}</ol>
          </section>
          <section className="isx-takes">
            <h2><Mark kind="bulb" /> Key Takeaways</h2>
            <ul>{page.takeaways.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>
          <blockquote><p>“{page.quote}”</p><cite>— {page.by}</cite></blockquote>
          <section className="isx-next">
            <h2><Mark kind="cap" /> Next Up</h2>
            <p>{page.next}</p>
            {page.nextTab === "practice" ? <Link to="/practice">{page.nextLabel} →</Link> : <button type="button" onClick={() => setTab(page.nextTab)}>{page.nextLabel} →</button>}
          </section>
        </aside>
      </div>
    </div>
  );
}
