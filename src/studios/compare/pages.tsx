import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { SUM_STEPS, blankSum, runSum, stepSum, type SumSim } from "../../engines/isaarch/compare";
import { effectiveAddress } from "../../engines/isaarch/x86";
import { usePrefs } from "../../store/prefs";

const LABS = [
  { id: "overview", tone: "blue", title: "Overview", blurb: "Compare the big picture: philosophies, goals, and key differences." },
  { id: "register-models", tone: "green", title: "Register Models", blurb: "Explore registers, naming, and aliases across the three ISAs." },
  { id: "instruction-encoding", tone: "violet", title: "Instruction Encoding", blurb: "See how instructions are encoded and formatted differently." },
  { id: "instruction-length", tone: "amber", title: "Instruction Length", blurb: "Compare fixed vs. variable length instructions and what that means." },
] as const;

const MORE = [
  { id: "memory-access", title: "Memory Access", blurb: "How each ISA accesses memory." },
  { id: "addressing", title: "Addressing", blurb: "Addressing modes and techniques." },
  { id: "same-task", title: "Same Task Comparison", blurb: "See the same task in all three ISAs." },
  { id: "decode-complexity", title: "Decode Complexity Concept", blurb: "Explore instruction decode complexity." },
  { id: "ecosystem-roles", title: "Ecosystem Roles", blurb: "Roles, adoption, and real-world use." },
] as const;

function Chip({ name, tone }: { name: string; tone: string }) {
  return (
    <svg className={`cmp-chip ${tone}`} viewBox="0 0 64 64" role="img" aria-label={`${name} chip`}>
      <title>{name}</title>
      <rect x="10" y="10" width="44" height="44" rx="8" />
      <path d="M18 6v6M26 6v6M38 6v6M46 6v6M18 52v6M26 52v6M38 52v6M46 52v6M6 18h6M6 26h6M6 38h6M6 46h6M52 18h6M52 26h6M52 38h6M52 46h6" />
      <text x="32" y="37" textAnchor="middle">{name}</text>
    </svg>
  );
}

export function HomePage() {
  const [intro, setIntro] = useState(0);
  const lines = [
    "RISC-V is an open, modular base with optional extensions.",
    "ARM scales one idea from small devices to large systems.",
    "x86 keeps a long software history inside a variable-length ISA.",
  ];
  return (
    <>
      <section className="cmp-hero">
        <p className="cmp-kicker">Explore · Compare · Learn</p>
        <div className="cmp-hero-grid">
          <div>
            <h2>Three ISAs. One Exploration.</h2>
            <p>Compare RISC-V, ARM, and x86 through interactive labs. Understand how different instruction set architectures make different design choices — and see how they solve the same problems in unique ways.</p>
            <div className="cmp-actions">
              <Link className="cmp-primary" to="/architecture/compare/overview">Start with Overview</Link>
              <button type="button" className="cmp-ghost" onClick={() => setIntro((value) => (value + 1) % lines.length)}>Watch Intro ({intro + 1}/3)</button>
            </div>
            {intro >= 0 ? <p className="cmp-hint">{lines[intro]}</p> : null}
          </div>
          <div className="cmp-trio" aria-label="RISC-V, ARM, and x86">
            <article className="rv"><Chip name="RISC-V" tone="blue" /><ul><li>Open standard</li><li>Modular design</li><li>Simple, clean ISA</li></ul></article>
            <span aria-hidden="true">↔</span>
            <article className="arm"><Chip name="ARM" tone="green" /><ul><li>Widely used</li><li>Power efficient</li><li>Many profiles</li></ul></article>
            <span aria-hidden="true">↔</span>
            <article className="x86"><Chip name="x86" tone="violet" /><ul><li>Feature rich</li><li>Backward compatible</li><li>Complex instruction set</li></ul></article>
          </div>
        </div>
        <p className="cmp-foot">Different paths. Same possibilities.</p>
        <div className="cmp-pills">
          <span>Interactive Visualizations</span>
          <span>Hands-on Exploration</span>
          <span>No Prior Bias</span>
        </div>
      </section>
      <section className="cmp-block">
        <h3>Featured Labs</h3>
        <p className="cmp-hint">Start here with the core concepts. Each lab includes interactive visualizations and guided exploration.</p>
        <div className="cmp-cards">
          {LABS.map((item) => (
            <Link key={item.id} className={`cmp-card ${item.tone}`} to={`/architecture/compare/${item.id}`}>
              <b>{item.title}</b>
              <span>{item.blurb}</span>
              <em>Open</em>
            </Link>
          ))}
        </div>
      </section>
      <section className="cmp-block">
        <h3>More Labs</h3>
        <div className="cmp-more">
          {MORE.map((item) => (
            <Link key={item.id} to={`/architecture/compare/${item.id}`}>
              <b>{item.title}</b>
              <span>{item.blurb}</span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}

const DIMENSIONS = [
  { id: "philosophy", title: "Design Philosophy", prompt: "What drives the architecture?", rv: "Open standard, modular, and extensible.", arm: "Efficiency and scalability across profiles and extensions.", x86: "Compatibility, a rich feature set, and a mature software base." },
  { id: "style", title: "Instruction Style", prompt: "How are instructions structured?", rv: "Fixed 32-bit base forms, with a 16-bit compressed extension.", arm: "AArch64 is fixed 32-bit. Thumb is a separate 16/32-bit state.", x86: "Variable length, from 1 byte up to the 15-byte architectural limit." },
  { id: "extend", title: "Extensibility", prompt: "How easy is it to extend?", rv: "Extensions are named and optional. Custom instructions are part of the open model.", arm: "Profiles and architecture extensions add features without a new base.", x86: "New prefixes, opcodes, and extensions accumulate beside older forms." },
  { id: "hardware", title: "Hardware Complexity", prompt: "What are the implementation trade-offs?", rv: "Regular fields make a simple decoder straightforward.", arm: "Fixed width keeps fetch boundaries regular in AArch64.", x86: "Length decode and optional fields add front-end work. That is a trade-off, not a speed ranking." },
  { id: "use", title: "Typical Use", prompt: "Where is it commonly used?", rv: "Teaching cores, research, and custom silicon.", arm: "Phones, embedded devices, and a growing server presence.", x86: "PCs, workstations, and a large server software base." },
  { id: "learn", title: "Learning Takeaways", prompt: "What can we learn from it?", rv: "A small base makes the contract easy to read.", arm: "One idea can scale if the register and load/store rules stay consistent.", x86: "Compatibility can justify a more elaborate encoding." },
] as const;

export function OverviewPage() {
  const [dim, setDim] = useState<(typeof DIMENSIONS)[number]["id"]>("philosophy");
  const [line, setLine] = useState(0);
  const selected = DIMENSIONS.find((item) => item.id === dim) ?? DIMENSIONS[0];
  const blurbs = ["Open and modular.", "Efficient and flexible.", "Feature-rich and backward compatible."];
  return (
    <>
      <section className="cmp-hero slim">
        <div className="cmp-hero-grid">
          <div>
            <h2>Three ISAs. Different Paths. Shared Goals.</h2>
            <p>RISC-V, ARM, and x86 are successful instruction set architectures, each designed with different priorities and trade-offs. This lab helps you understand their core design philosophies.</p>
            <div className="cmp-actions">
              <button type="button" className="cmp-primary" onClick={() => setDim("philosophy")}>Explore the comparison</button>
              <button type="button" className="cmp-ghost" onClick={() => setLine((value) => (value + 1) % blurbs.length)}>Watch Intro ({line + 1}/3)</button>
            </div>
            <p className="cmp-hint">{blurbs[line]}</p>
          </div>
          <div className="cmp-venn" aria-hidden="true">
            <span>RISC-V</span><span>ARM</span><span>x86</span><b>Different designs. Real impact.</b>
          </div>
        </div>
      </section>
      <section className="cmp-glance">
        <article className="rv"><Chip name="RISC-V" tone="blue" /><h3>RISC-V</h3><p>Open, modular, and extensible. A base designed so implementations can add only the extensions they need.</p></article>
        <article className="arm"><Chip name="ARM" tone="green" /><h3>ARM</h3><p>Efficient, flexible, and scalable, from small devices to large systems, with a consistent load/store style.</p></article>
        <article className="x86"><Chip name="x86" tone="violet" /><h3>x86</h3><p>Feature-rich and backward compatible, with decades of software that still runs on newer processors.</p></article>
      </section>
      <section className="cmp-block">
        <h3>Compare Dimensions</h3>
        <div className="cmp-dims">
          {DIMENSIONS.map((item) => (
            <button key={item.id} type="button" className={item.id === dim ? "on" : ""} onClick={() => setDim(item.id)}>
              <b>{item.title}</b><span>{item.prompt}</span>
            </button>
          ))}
        </div>
        <div className="cmp-dim-detail">
          <h3>{selected.title}</h3>
          <p><b>RISC-V.</b> {selected.rv}</p>
          <p><b>ARM.</b> {selected.arm}</p>
          <p><b>x86.</b> {selected.x86}</p>
        </div>
      </section>
    </>
  );
}

const RV_REGS = [
  { name: "x0", abi: "zero", role: "Hardwired zero. Writes are ignored.", tone: "special" },
  { name: "x1", abi: "ra", role: "Return address.", tone: "special" },
  { name: "x2", abi: "sp", role: "Stack pointer.", tone: "special" },
  { name: "x3", abi: "gp", role: "Global pointer.", tone: "special" },
  { name: "x4", abi: "tp", role: "Thread pointer.", tone: "special" },
  { name: "x5", abi: "t0", role: "Temporary.", tone: "temp" },
  { name: "x6", abi: "t1", role: "Temporary.", tone: "temp" },
  { name: "x7", abi: "t2", role: "Temporary.", tone: "temp" },
  { name: "x8", abi: "s0", role: "Saved register / frame pointer.", tone: "saved" },
  { name: "x9", abi: "s1", role: "Saved register.", tone: "saved" },
  ...Array.from({ length: 8 }, (_, i) => ({ name: `x${10 + i}`, abi: `a${i}`, role: i < 2 ? "Argument / return value." : "Argument.", tone: "arg" })),
  ...Array.from({ length: 10 }, (_, i) => ({ name: `x${18 + i}`, abi: `s${2 + i}`, role: "Saved register.", tone: "saved" })),
  ...["t3", "t4", "t5", "t6"].map((abi, i) => ({ name: `x${28 + i}`, abi, role: "Temporary.", tone: "temp" })),
];

const ARM_REGS = Array.from({ length: 31 }, (_, i) => ({
  n: i,
  role: i === 29 ? "Frame pointer by convention." : i === 30 ? "Link register (LR)." : i < 8 ? "Argument / result." : "General purpose.",
}));

const X86_FAMILIES = [
  { id: "rax", parts: ["RAX", "EAX", "AX", "AH", "AL"] },
  { id: "rbx", parts: ["RBX", "EBX", "BX", "BH", "BL"] },
  { id: "rcx", parts: ["RCX", "ECX", "CX", "CH", "CL"] },
  { id: "rdx", parts: ["RDX", "EDX", "DX", "DH", "DL"] },
  { id: "rsi", parts: ["RSI", "ESI", "SI", "SIL"] },
  { id: "rdi", parts: ["RDI", "EDI", "DI", "DIL"] },
  { id: "rbp", parts: ["RBP", "EBP", "BP", "BPL"] },
  { id: "rsp", parts: ["RSP", "ESP", "SP", "SPL"] },
  ...Array.from({ length: 8 }, (_, i) => ({ id: `r${i + 8}`, parts: [`R${i + 8}`, `R${i + 8}D`, `R${i + 8}W`, `R${i + 8}B`] })),
];

export function RegisterPage() {
  const { earn } = usePrefs();
  const [tab, setTab] = useState<"view" | "compare" | "quiz">("view");
  const [width, setWidth] = useState<"default" | "32" | "64">("default");
  const [rv, setRv] = useState("x0");
  const [arm, setArm] = useState(0);
  const [armW, setArmW] = useState(false);
  const [family, setFamily] = useState("rax");
  const [slice, setSlice] = useState("RAX");
  const [quiz, setQuiz] = useState("");
  const selected = RV_REGS.find((item) => item.name === rv) ?? RV_REGS[0]!;
  const fam = X86_FAMILIES.find((item) => item.id === family) ?? X86_FAMILIES[0]!;
  return (
    <>
      <div className="cmp-tabs">
        <button type="button" className={tab === "view" ? "on" : ""} onClick={() => setTab("view")}>Register View</button>
        <button type="button" className={tab === "compare" ? "on" : ""} onClick={() => setTab("compare")}>Comparison</button>
        <button type="button" className={tab === "quiz" ? "on" : ""} onClick={() => setTab("quiz")}>Interactive Quiz</button>
        <span>View width</span>
        {(["default", "32", "64"] as const).map((item) => (
          <button key={item} type="button" className={width === item ? "on" : ""} onClick={() => setWidth(item)}>{item === "default" ? "Default" : `${item}-bit`}</button>
        ))}
      </div>
      {tab === "view" && (
        <div className="cmp-reg-grid">
          <section className="cmp-isa rv">
            <h3>RISC-V <small>32 integer registers</small></h3>
            <div className="cmp-reg-list">
              {RV_REGS.map((item) => (
                <button key={item.name} type="button" className={`${item.tone}${item.name === rv ? " on" : ""}`} onClick={() => { setRv(item.name); if (item.name === "x0") earn("cmp-x0"); }}>
                  <b>{item.name}</b><span>{item.abi}</span>
                </button>
              ))}
            </div>
            <p><b>{selected.name} / {selected.abi}</b> — {selected.role} {width === "32" ? "Shown as a 32-bit RV32 value." : "The integer register is XLEN bits; this lab uses 32- and 64-bit views."} {selected.name === "x0" ? "Reading x0 always returns 0." : ""}</p>
          </section>
          <section className="cmp-isa arm">
            <h3>ARM <small>AArch64</small></h3>
            <div className="cmp-reg-list">
              {ARM_REGS.filter((_, index) => index < 8 || index > 27).map((item) => (
                <button key={item.n} type="button" className={arm === item.n ? "on" : ""} onClick={() => { setArm(item.n); setArmW((value) => arm === item.n ? !value : false); }}>
                  <b>{arm === item.n && armW ? `W${item.n}` : `X${item.n}`}</b><span>{item.role}</span>
                </button>
              ))}
              <p className="cmp-hint">SP is separate from XZR. PC is not a general register in AArch64.</p>
            </div>
            <p>{armW || width === "32" ? `W${arm} is the low 32 bits. A 32-bit write zeros the high half of X${arm}.` : `X${arm} is 64 bits. Click it again to toggle the W view.`}</p>
          </section>
          <section className="cmp-isa x86">
            <h3>x86 <small>x86-64 aliases</small></h3>
            {X86_FAMILIES.map((item) => (
              <button key={item.id} type="button" className={family === item.id ? "cmp-family on" : "cmp-family"} onClick={() => { setFamily(item.id); setSlice(item.parts[0] ?? item.id); }}>
                {item.parts[0]}
                {family === item.id && (
                  <span className="cmp-slices">
                    {item.parts.filter((part) => width === "64" ? part === item.parts[0] : width === "32" ? /E|D$/.test(part) || part.endsWith("D") || part.startsWith("E") || part === item.parts[0] : true).map((part) => (
                      <i key={part} className={slice === part ? "on" : ""} onClick={(event) => { event.stopPropagation(); setSlice(part); }}>{part}</i>
                    ))}
                  </span>
                )}
              </button>
            ))}
            <p>Selected {slice}. A 32-bit write such as EAX zero-extends into RAX. 16-bit and 8-bit writes merge into the larger register.</p>
          </section>
        </div>
      )}
      {tab === "compare" && (
        <table className="cmp-table">
          <thead><tr><th></th><th>Count</th><th>Names</th><th>Structure</th></tr></thead>
          <tbody>
            <tr><td>RISC-V</td><td>32 (x0–x31)</td><td>x0…x31 plus ABI aliases</td><td>Fixed width (XLEN). x0 is zero.</td></tr>
            <tr><td>ARM</td><td>31 (X0–X30) + SP</td><td>Xn and Wn</td><td>64-bit X, 32-bit W view. LR is X30.</td></tr>
            <tr><td>x86</td><td>16 GPRs in long mode</td><td>{fam.parts.join(", ")}</td><td>Aliased 64/32/16/8-bit views.</td></tr>
          </tbody>
        </table>
      )}
      {tab === "quiz" && (
        <section className="cmp-block">
          <h3>Which register is hardwired to zero?</h3>
          {["x0", "x1", "sp", "RAX"].map((choice) => (
            <button key={choice} type="button" className={quiz === choice ? "on" : ""} onClick={() => { setQuiz(choice); if (choice === "x0") earn("cmp-x0"); }}>{choice}</button>
          ))}
          {quiz ? <p>{quiz === "x0" ? "Correct. RISC-V x0 ignores writes and reads as zero." : "Not this one. RISC-V x0 is the hardwired zero."}</p> : null}
        </section>
      )}
    </>
  );
}

type Kind = "dest" | "src" | "op" | "imm" | "mem";
interface Field { name: string; bits: string; width: string; kind: Kind; meaning: string }

const ENCODINGS: Record<string, { rv: Field[]; arm: Field[]; x86: Field[]; rvAsm: string; armAsm: string; x86Asm: string; rvBin: string; armBin: string; x86Bytes: string }> = {
  addrr: {
    rvAsm: "add x3, x1, x2", armAsm: "ADD X3, X1, X2", x86Asm: "add rax, rbx",
    rvBin: "0000000 00010 00001 000 00011 0110011",
    armBin: "1 0 0 00010 00 000000 00001 00011",
    x86Bytes: "REX.W 01 D8",
    rv: [
      { name: "funct7", bits: "0000000", width: "7 bits", kind: "op", meaning: "Together with funct3 and opcode, selects ADD." },
      { name: "rs2", bits: "00010", width: "5 bits", kind: "src", meaning: "x2, the second source." },
      { name: "rs1", bits: "00001", width: "5 bits", kind: "src", meaning: "x1, the first source." },
      { name: "funct3", bits: "000", width: "3 bits", kind: "op", meaning: "ADD/SUB family selector. 000 with funct7 0 is ADD." },
      { name: "rd", bits: "00011", width: "5 bits", kind: "dest", meaning: "x3, the destination." },
      { name: "opcode", bits: "0110011", width: "7 bits", kind: "op", meaning: "OP, register-register arithmetic." },
    ],
    arm: [
      { name: "sf", bits: "1", width: "1 bit", kind: "op", meaning: "64-bit operation in this teaching layout." },
      { name: "op", bits: "0", width: "1 bit", kind: "op", meaning: "Add rather than subtract in the simplified layout." },
      { name: "S", bits: "0", width: "1 bit", kind: "op", meaning: "Flags not updated." },
      { name: "Rm", bits: "00010", width: "5 bits", kind: "src", meaning: "X2." },
      { name: "sh", bits: "00", width: "2 bits", kind: "op", meaning: "LSL shift type." },
      { name: "imm6", bits: "000000", width: "6 bits", kind: "imm", meaning: "Shift amount 0." },
      { name: "Rn", bits: "00001", width: "5 bits", kind: "src", meaning: "X1." },
      { name: "Rd", bits: "00011", width: "5 bits", kind: "dest", meaning: "X3." },
    ],
    x86: [
      { name: "Prefix", bits: "REX.W", width: "1 byte", kind: "op", meaning: "64-bit operand size." },
      { name: "Opcode", bits: "01", width: "1 byte", kind: "op", meaning: "ADD r/m64, r64." },
      { name: "ModR/M", bits: "D8", width: "1 byte", kind: "dest", meaning: "mod 11, reg RBX, r/m RAX. RAX is both destination and a source." },
      { name: "SIB", bits: "—", width: "optional", kind: "mem", meaning: "Not used for a register operand." },
      { name: "Displacement", bits: "—", width: "optional", kind: "mem", meaning: "Not used." },
      { name: "Immediate", bits: "—", width: "optional", kind: "imm", meaning: "Not used." },
    ],
  },
  addimm: {
    rvAsm: "addi x3, x1, 5", armAsm: "ADD X3, X1, #5", x86Asm: "add rax, 5",
    rvBin: "000000000101 00001 000 00011 0010011",
    armBin: "1 0 0 imm12=5 Rn=X1 Rd=X3",
    x86Bytes: "48 83 C0 05",
    rv: [
      { name: "imm", bits: "000000000101", width: "12 bits", kind: "imm", meaning: "Immediate 5." },
      { name: "rs1", bits: "00001", width: "5 bits", kind: "src", meaning: "x1." },
      { name: "funct3", bits: "000", width: "3 bits", kind: "op", meaning: "ADDI." },
      { name: "rd", bits: "00011", width: "5 bits", kind: "dest", meaning: "x3." },
      { name: "opcode", bits: "0010011", width: "7 bits", kind: "op", meaning: "OP-IMM." },
    ],
    arm: [
      { name: "imm12", bits: "000000000101", width: "12 bits", kind: "imm", meaning: "Immediate 5." },
      { name: "Rn", bits: "00001", width: "5 bits", kind: "src", meaning: "X1." },
      { name: "Rd", bits: "00011", width: "5 bits", kind: "dest", meaning: "X3." },
      { name: "op", bits: "ADD", width: "group", kind: "op", meaning: "Add immediate." },
    ],
    x86: [
      { name: "Prefix", bits: "48", width: "REX.W", kind: "op", meaning: "64-bit operand." },
      { name: "Opcode", bits: "83", width: "1 byte", kind: "op", meaning: "ADD r/m64, imm8." },
      { name: "ModR/M", bits: "C0", width: "1 byte", kind: "dest", meaning: "RAX." },
      { name: "Immediate", bits: "05", width: "1 byte", kind: "imm", meaning: "Constant 5." },
    ],
  },
  movrr: {
    rvAsm: "addi x3, x1, 0", armAsm: "MOV X3, X1", x86Asm: "mov rax, rbx",
    rvBin: "teaching move via addi", armBin: "ORR X3, XZR, X1", x86Bytes: "48 89 D8",
    rv: [
      { name: "imm", bits: "0", width: "12 bits", kind: "imm", meaning: "Zero. addi rd, rs1, 0 copies a register." },
      { name: "rs1", bits: "x1", width: "5 bits", kind: "src", meaning: "Source." },
      { name: "rd", bits: "x3", width: "5 bits", kind: "dest", meaning: "Destination." },
      { name: "opcode", bits: "0010011", width: "7 bits", kind: "op", meaning: "OP-IMM." },
    ],
    arm: [
      { name: "Rm", bits: "X1", width: "5 bits", kind: "src", meaning: "Source. MOV is often an alias of ORR Xd, XZR, Xm." },
      { name: "Rd", bits: "X3", width: "5 bits", kind: "dest", meaning: "Destination." },
      { name: "op", bits: "ORR", width: "group", kind: "op", meaning: "Alias, not a separate opcode family." },
    ],
    x86: [
      { name: "Prefix", bits: "48", width: "REX.W", kind: "op", meaning: "64-bit." },
      { name: "Opcode", bits: "89", width: "1 byte", kind: "op", meaning: "MOV r/m64, r64." },
      { name: "ModR/M", bits: "D8", width: "1 byte", kind: "dest", meaning: "reg RBX, r/m RAX." },
    ],
  },
  movmem: {
    rvAsm: "lw x5, 0(x10)", armAsm: "LDR X0, [X1]", x86Asm: "mov rax, [rbx]",
    rvBin: "I-type load", armBin: "load unsigned immediate", x86Bytes: "48 8B 03",
    rv: [
      { name: "imm", bits: "0", width: "12 bits", kind: "mem", meaning: "Byte offset." },
      { name: "rs1", bits: "x10", width: "5 bits", kind: "src", meaning: "Base address." },
      { name: "rd", bits: "x5", width: "5 bits", kind: "dest", meaning: "Loaded value." },
      { name: "opcode", bits: "0000011", width: "7 bits", kind: "op", meaning: "LOAD." },
    ],
    arm: [
      { name: "imm", bits: "#0", width: "offset", kind: "mem", meaning: "Offset from X1." },
      { name: "Rn", bits: "X1", width: "5 bits", kind: "src", meaning: "Base." },
      { name: "Rt", bits: "X0", width: "5 bits", kind: "dest", meaning: "Destination." },
      { name: "op", bits: "LDR", width: "group", kind: "op", meaning: "Load register." },
    ],
    x86: [
      { name: "Prefix", bits: "48", width: "REX.W", kind: "op", meaning: "64-bit load." },
      { name: "Opcode", bits: "8B", width: "1 byte", kind: "op", meaning: "MOV r64, r/m64." },
      { name: "ModR/M", bits: "03", width: "1 byte", kind: "mem", meaning: "RAX from [RBX], no displacement." },
    ],
  },
  branch: {
    rvAsm: "beq x1, x2, 8", armAsm: "B.EQ label", x86Asm: "je rel8",
    rvBin: "B-type", armBin: "conditional branch", x86Bytes: "74 xx",
    rv: [
      { name: "rs1", bits: "x1", width: "5 bits", kind: "src", meaning: "Compared register." },
      { name: "rs2", bits: "x2", width: "5 bits", kind: "src", meaning: "Compared register." },
      { name: "imm", bits: "8", width: "scrambled", kind: "imm", meaning: "PC-relative offset. B-type immediates are split across the word." },
      { name: "opcode", bits: "1100011", width: "7 bits", kind: "op", meaning: "BRANCH." },
    ],
    arm: [
      { name: "cond", bits: "EQ", width: "condition", kind: "op", meaning: "Taken when Z is set." },
      { name: "imm", bits: "label", width: "PC-relative", kind: "imm", meaning: "Offset from this instruction." },
    ],
    x86: [
      { name: "Opcode", bits: "74", width: "1 byte", kind: "op", meaning: "JE/JZ rel8." },
      { name: "Immediate", bits: "xx", width: "1 byte", kind: "imm", meaning: "Signed displacement from the next instruction." },
    ],
  },
};

export function EncodingPage() {
  const [which, setWhich] = useState("addrr");
  const [kind, setKind] = useState<Kind | "">("");
  const [field, setField] = useState("");
  const row = ENCODINGS[which] ?? ENCODINGS.addrr!;
  const paint = (item: Field) => (kind ? item.kind === kind : item.name === field);
  return (
    <div className="cmp-encode">
      <aside>
        <label>Try Different Instructions
          <select aria-label="Instruction" value={which} onChange={(event) => { setWhich(event.target.value); setField(""); }}>
            <option value="addrr">Add (register + register)</option>
            <option value="addimm">Add immediate</option>
            <option value="movrr">MOV register/register</option>
            <option value="movmem">MOV memory/register</option>
            <option value="branch">Branch</option>
          </select>
        </label>
        <h3>Highlight Fields</h3>
        {([["dest", "Destination"], ["src", "Source"], ["op", "Opcode / operation"], ["imm", "Immediate"], ["mem", "Addressing / memory"]] as const).map(([id, label]) => (
          <button key={id} type="button" className={kind === id ? `on k-${id}` : `k-${id}`} onClick={() => { setKind(kind === id ? "" : id); setField(""); }}>{label}</button>
        ))}
      </aside>
      <div>
        {(["rv", "arm", "x86"] as const).map((isa) => (
          <section key={isa} className={`cmp-isa ${isa}`}>
            <h3>{isa === "rv" ? "RISC-V" : isa === "arm" ? "ARM" : "x86"} <small>{isa === "rv" ? row.rvAsm : isa === "arm" ? row.armAsm : row.x86Asm}</small></h3>
            <p className="cmp-hint">{isa === "arm" ? "Simplified educational field layout, not a full A64 opcode map." : isa === "x86" ? "Variable length, 1–15 bytes." : "Fixed 32-bit encoding."}</p>
            <div className="cmp-fields">
              {(isa === "rv" ? row.rv : isa === "arm" ? row.arm : row.x86).map((item) => (
                <button key={item.name} type="button" className={`k-${item.kind}${paint(item) ? " on" : ""}`} onClick={() => { setField(item.name); setKind(""); }}>
                  <b>{item.name}</b><span>{item.bits}</span><small>{item.width}</small>
                </button>
              ))}
            </div>
            <p className="cmp-bin">{isa === "rv" ? row.rvBin : isa === "arm" ? row.armBin : row.x86Bytes}</p>
            {field ? <p>{(isa === "rv" ? row.rv : isa === "arm" ? row.arm : row.x86).find((item) => item.name === field)?.meaning ?? "This example has no field with that name."}</p> : null}
          </section>
        ))}
      </div>
    </div>
  );
}

const STREAMS = {
  simple: {
    title: "Load a value from memory into a register.",
    rv: [{ name: "addi", bytes: 4 }, { name: "lw", bytes: 4 }, { name: "add", bytes: 4 }, { name: "sw", bytes: 4 }],
    arm: [{ name: "mov", bytes: 4 }, { name: "ldr", bytes: 4 }, { name: "add", bytes: 4 }, { name: "str", bytes: 4 }],
    x86: [{ name: "push", bytes: 1 }, { name: "mov", bytes: 3 }, { name: "add", bytes: 2 }, { name: "cmp", bytes: 6 }, { name: "jne", bytes: 2 }],
    example: [
      { isa: "RISC-V", asm: "lw x5, 0(x10)", bytes: "0x83 0x25 0xA2 0x00", size: "4 bytes" },
      { isa: "ARM", asm: "ldr x0, [x1]", bytes: "0xE1 0x03 0x40 0xF9", size: "4 bytes" },
      { isa: "x86", asm: "mov eax, [ebx]", bytes: "0x8B 0x03", size: "2 bytes" },
    ],
  },
  compact: {
    title: "Add two registers and return.",
    rv: [{ name: "c.add", bytes: 2 }, { name: "add", bytes: 4 }, { name: "c.jr", bytes: 2 }],
    arm: [{ name: "add", bytes: 4 }, { name: "ret", bytes: 4 }],
    x86: [{ name: "add", bytes: 2 }, { name: "ret", bytes: 1 }],
    example: [
      { isa: "RISC-V", asm: "add x3, x1, x2", bytes: "0xB3 0x01 0x21 0x00", size: "4 bytes" },
      { isa: "ARM", asm: "ADD X3, X1, X2", bytes: "0x23 0x00 0x02 0x8B", size: "4 bytes" },
      { isa: "x86", asm: "add eax, ebx", bytes: "0x01 0xD8", size: "2 bytes" },
    ],
  },
} as const;

export function LengthPage() {
  const [windowBytes, setWindow] = useState<8 | 16 | 32>(16);
  const [mode, setMode] = useState<keyof typeof STREAMS>("simple");
  const stream = STREAMS[mode];
  return (
    <>
      <div className="cmp-tools">
        <label>Fetch window
          <select aria-label="Fetch window" value={windowBytes} onChange={(event) => setWindow(Number(event.target.value) as 8 | 16 | 32)}>
            <option value={8}>8 bytes</option>
            <option value={16}>16 bytes</option>
            <option value={32}>32 bytes</option>
          </select>
        </label>
      </div>
      <section className="cmp-stream">
        <div className="cmp-ruler">{Array.from({ length: windowBytes + 1 }, (_, i) => <span key={i}>{i}</span>)}</div>
        {(["rv", "arm", "x86"] as const).map((isa) => {
          const items = stream[isa];
          const width = 100 / windowBytes;
          let at = 0;
          return (
            <div key={isa} className="cmp-stream-row">
              <b>{isa === "rv" ? "RISC-V" : isa === "arm" ? "ARM" : "x86"}</b>
              <div className="cmp-window" style={{ ["--win" as string]: `${windowBytes * 22}px` }}>
                {items.map((item) => {
                  const left = at * width;
                  at += item.bytes;
                  const crosses = at > windowBytes && at - item.bytes < windowBytes;
                  return <i key={item.name} className={crosses ? "cross" : ""} style={{ left: `${left}%`, width: `${item.bytes * width}%` }}>{item.name} {item.bytes}B</i>;
                })}
              </div>
            </div>
          );
        })}
        <p className="cmp-hint">The dashed window is {windowBytes} bytes. A block marked as crossing starts inside the window and ends outside it.</p>
      </section>
      <div className="cmp-actions">
        <button type="button" className={mode === "simple" ? "cmp-primary" : "cmp-ghost"} onClick={() => setMode("simple")}>Simple Examples</button>
        <button type="button" className={mode === "compact" ? "cmp-primary" : "cmp-ghost"} onClick={() => setMode("compact")}>Compact Examples</button>
      </div>
      <section className="cmp-block">
        <h3>{stream.title}</h3>
        <div className="cmp-glance">
          {stream.example.map((item) => (
            <article key={item.isa}><b>{item.isa}</b><p>{item.asm}</p><code>{item.bytes}</code><span>{item.size}</span></article>
          ))}
        </div>
      </section>
    </>
  );
}

export function MemoryPage() {
  const [op, setOp] = useState<"load" | "store" | "rmw">("load");
  const [base, setBase] = useState(0x1000);
  const [offset, setOffset] = useState(0);
  const [value, setValue] = useState(5);
  const [phase, setPhase] = useState<"idle" | "go" | "done">("idle");
  const address = (base + offset) >>> 0;
  useEffect(() => {
    if (phase !== "go") return undefined;
    const timer = window.setTimeout(() => setPhase("done"), 700);
    return () => window.clearTimeout(timer);
  }, [phase]);
  const run = (next: "load" | "store" | "rmw") => { setOp(next); setPhase("go"); };
  return (
    <>
      <div className="cmp-actions">
        <button type="button" className="cmp-primary" onClick={() => run("load")}>Load</button>
        <button type="button" className="cmp-ghost" onClick={() => run("store")}>Store</button>
        <button type="button" className="cmp-ghost" onClick={() => run("rmw")}>x86 add [mem], 1</button>
      </div>
      <div className="cmp-mem-controls">
        <label>Base <input aria-label="Base address" value={`0x${base.toString(16)}`} onChange={(event) => setBase(Number.parseInt(event.target.value.replace(/[^0-9a-f]/gi, ""), 16) || 0)} /></label>
        <label>Offset <input aria-label="Offset" type="number" value={offset} onChange={(event) => setOffset(Number(event.target.value) || 0)} /></label>
        <label>Value <input aria-label="Value" type="number" value={value} onChange={(event) => setValue(Number(event.target.value) || 0)} /></label>
      </div>
      <div className={`cmp-flows ${phase}`}>
        {(["RISC-V", "ARM", "x86"] as const).map((isa) => (
          <article key={isa} className={isa === "x86" ? "x86" : isa === "ARM" ? "arm" : "rv"}>
            <h3>{isa}</h3>
            <div className={`cmp-flow ${op}`}>
              <b>Registers</b>
              <span>{op === "store" ? "→" : op === "rmw" && isa === "x86" ? "↔" : "←"}</span>
              <b>Memory {address.toString(16)}</b>
            </div>
            <code>
              {isa === "RISC-V" && (op === "store" ? `sw x5, ${offset}(x10)` : `lw x5, ${offset}(x10)`)}
              {isa === "ARM" && (op === "store" ? `STR X0, [X1, #${offset}]` : `LDR X0, [X1, #${offset}]`)}
              {isa === "x86" && (op === "rmw" ? "add dword ptr [rdi], 1" : op === "store" ? "mov [rdi], eax" : "mov eax, [edi]")}
            </code>
            <p className="cmp-hint">{phase === "done" ? (op === "store" ? `Stored ${value}.` : op === "rmw" ? "Read, add 1, and write back. Educational, not a micro-op trace." : `Loaded into the destination.`) : "Press Load or Store."}</p>
          </article>
        ))}
      </div>
    </>
  );
}

const SCENARIOS = {
  array: { rv: [0x1000, 4], arm: [0x1000, 4], x86: [0x1000, 1, 4, 0] },
  stack: { rv: [0x8000, -16], arm: [0x8000, -16], x86: [0x8000, 0, 1, -16] },
  struct: { rv: [0x2000, 12], arm: [0x2000, 12], x86: [0x2000, 0, 1, 12] },
} as const;

export function AddressingPage() {
  const [rvBase, setRvBase] = useState(0x1000);
  const [rvImm, setRvImm] = useState(32);
  const [armBase, setArmBase] = useState(0x2000);
  const [armImm, setArmImm] = useState(64);
  const [base, setBase] = useState(0x3000);
  const [index, setIndex] = useState(12);
  const [scale, setScale] = useState<1 | 2 | 4 | 8>(4);
  const [disp, setDisp] = useState(16);
  const ea = effectiveAddress(base, index, scale, disp);
  const load = (id: keyof typeof SCENARIOS) => {
    const item = SCENARIOS[id];
    setRvBase(item.rv[0]); setRvImm(item.rv[1]);
    setArmBase(item.arm[0]); setArmImm(item.arm[1]);
    setBase(item.x86[0]); setIndex(item.x86[1]); setScale(item.x86[2] as 1 | 2 | 4 | 8); setDisp(item.x86[3]);
  };
  return (
    <>
      <section className="cmp-formula">
        <p>EA = Base + (Index × Scale) + Displacement</p>
        <p className="cmp-hint">x86 result 0x{ea.toString(16).toUpperCase()}. Scale is 1, 2, 4, or 8.</p>
        <div className="cmp-actions">
          {([1, 2, 4, 8] as const).map((item) => <button key={item} type="button" className={scale === item ? "cmp-primary" : "cmp-ghost"} onClick={() => setScale(item)}>{item}</button>)}
        </div>
      </section>
      <div className="cmp-calcs">
        <label>RISC-V base <input aria-label="RISC-V base" value={rvBase} onChange={(event) => setRvBase(Number(event.target.value) || 0)} />
          immediate <input aria-label="RISC-V immediate" value={rvImm} onChange={(event) => setRvImm(Number(event.target.value) || 0)} />
          <b>0x{(rvBase + rvImm).toString(16)}</b>
          <code>lw x5, {rvImm}(x10)</code>
        </label>
        <label>ARM base <input aria-label="ARM base" value={armBase} onChange={(event) => setArmBase(Number(event.target.value) || 0)} />
          immediate <input aria-label="ARM immediate" value={armImm} onChange={(event) => setArmImm(Number(event.target.value) || 0)} />
          <b>0x{(armBase + armImm).toString(16)}</b>
          <code>LDR X0, [X1, #{armImm}]</code>
        </label>
        <label>x86 base <input aria-label="x86 base" value={base} onChange={(event) => setBase(Number(event.target.value) || 0)} />
          index <input aria-label="x86 index" value={index} onChange={(event) => setIndex(Number(event.target.value) || 0)} />
          displacement <input aria-label="x86 displacement" value={disp} onChange={(event) => setDisp(Number(event.target.value) || 0)} />
          <b>0x{ea.toString(16)}</b>
          <code>mov eax, [ebx + esi*{scale} + {disp}]</code>
        </label>
      </div>
      <div className="cmp-actions">
        <button type="button" onClick={() => load("array")}>Array Access</button>
        <button type="button" onClick={() => load("stack")}>Stack Access</button>
        <button type="button" onClick={() => load("struct")}>Structure Field Access</button>
      </div>
    </>
  );
}

const RV_LINES = ["# x10 = base, x11 = sum, x12 = count", "li x11, 0", "li x12, n", "li x10, base", "loop:", "lw x5, 0(x10)", "add x11, x11, x5", "addi x10, x10, 4", "addi x12, x12, -1", "bnez x12, loop"];
const ARM_LINES = ["# r0 = base, r1 = sum, r2 = count", "mov r1, #0", "mov r2, n", "ldr r0, =base", "loop:", "ldr r3, [r0]", "add r1, r1, r3", "add r0, r0, #4", "subs r2, r2, #1", "bne loop"];
const X86_LINES = ["# esi = base, eax = sum, ecx = count", "xor eax, eax", "mov ecx, n", "mov esi, base", "loop:", "mov edx, [esi]", "add eax, edx", "add esi, 4", "dec ecx", "jnz loop"];

function lineFor(step: number): number {
  if (step <= 0) return 1;
  if (step === 9) return 9;
  return step + 1;
}

export function SameTaskPage() {
  const [text, setText] = useState("1, 2, 3, 4, 5");
  const values = useMemo(() => text.split(",").map((item) => Number(item.trim())).filter((item) => Number.isFinite(item)).slice(0, 8), [text]);
  const [state, setState] = useState<SumSim>(() => blankSum([1, 2, 3, 4, 5]));
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return undefined;
    const timer = window.setInterval(() => {
      setState((current) => {
        const next = stepSum(current);
        if (next.step === 9) setPlaying(false);
        return next;
      });
    }, 700);
    return () => window.clearInterval(timer);
  }, [playing]);
  const reset = () => { setPlaying(false); setState(blankSum(values.length ? values : [0])); };
  const info = SUM_STEPS.find((item) => item.n === state.step);
  const hot = lineFor(state.step);
  const total = runSum(values.length ? values : [0]);
  return (
    <>
      <section className="cmp-task">
        <h2>Sum an array of {values.length || 0} integers</h2>
        <label>Array values <input aria-label="Array values" value={text} onChange={(event) => setText(event.target.value)} /></label>
        <pre>{`int sum = 0;\nfor (int i = 0; i < n; i++) sum += arr[i];\n/* result ${total} */`}</pre>
      </section>
      <div className="cmp-actions">
        <button type="button" onClick={() => setState((current) => current.step <= 1 ? current : { ...blankSum(current.values), step: Math.max(0, current.step - 1) })}>Previous</button>
        <button type="button" className="cmp-primary" onClick={() => setPlaying(true)}>Run all</button>
        <button type="button" onClick={() => setPlaying(false)}>Pause</button>
        <button type="button" onClick={() => setState((current) => stepSum({ ...current, values }))}>Next</button>
        <button type="button" onClick={reset}>Reset</button>
      </div>
      <div className="cmp-code3">
        {[["RISC-V", RV_LINES], ["ARM AArch32", ARM_LINES], ["x86 IA-32", X86_LINES]].map(([title, lines]) => (
          <pre key={String(title)}>{(lines as string[]).map((line, index) => <span key={line} className={index === hot ? "hot" : ""}>{line}{"\n"}</span>)}</pre>
        ))}
      </div>
      <section className="cmp-block">
        <h3>Step {state.step || 0} of 9 {info ? `— ${info.title}` : ""}</h3>
        <p>{info?.detail ?? "Press Next or Run all. This is a deterministic teaching simulation of one loop."}</p>
        <p>RISC-V x10={state.ptr.toString(16)} x11={state.sum.toString(16)} x12={state.count} x5={state.temp.toString(16)}</p>
        <p>ARM r0={state.ptr.toString(16)} r1={state.sum.toString(16)} r2={state.count} r3={state.temp.toString(16)}</p>
        <p>x86 esi={state.ptr.toString(16)} eax={state.sum.toString(16)} ecx={state.count} edx={state.temp.toString(16)}</p>
      </section>
    </>
  );
}

const FACTORS = [
  { id: "length", title: "Fixed vs variable length", stages: [0, 1] },
  { id: "prefix", title: "Instruction prefixes", stages: [1, 3] },
  { id: "boundary", title: "Instruction boundary detection", stages: [1, 2] },
  { id: "window", title: "Alignment and fetch windows", stages: [0, 2] },
] as const;

export function DecodePage() {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [factor, setFactor] = useState<string>("");
  const stages = ["Fetch", "Length / predecode", "Boundary", "Decode / translate", "Queue"];
  useEffect(() => {
    if (!playing) return undefined;
    const timer = window.setInterval(() => setStep((value) => (value + 1) % 5), Math.round(900 / speed));
    return () => window.clearInterval(timer);
  }, [playing, speed]);
  const lit: readonly number[] = FACTORS.find((item) => item.id === factor)?.stages ?? [];
  return (
    <>
      <p className="cmp-hint">Simplified educational front-end model. Not a specific Intel, AMD, or Arm pipeline.</p>
      <div className="cmp-actions">
        <button type="button" className="cmp-primary" onClick={() => setPlaying(true)}>Play</button>
        <button type="button" onClick={() => setPlaying(false)}>Pause</button>
        <button type="button" onClick={() => { setPlaying(false); setStep((value) => (value + 1) % 5); }}>Step</button>
        <button type="button" onClick={() => { setPlaying(false); setStep(0); }}>Reset</button>
        <label>Speed <input aria-label="Speed" type="range" min={1} max={3} value={speed} onChange={(event) => setSpeed(Number(event.target.value))} /></label>
      </div>
      <div className="cmp-pipe">
        {stages.map((name, index) => (
          <div key={name} className={`${index === step ? "on" : ""} ${lit.includes(index) ? "lit" : ""}`}>
            <b>{name}</b>
            <span>{index < 2 ? "both ISAs" : index === 2 ? "x86 length scan" : "internal form"}</span>
          </div>
        ))}
      </div>
      <p>Active: {stages[step]}. Fixed-width RISC-V and AArch64 boundaries fall on 4-byte steps. The x86 path still has to discover where the next instruction starts.</p>
      <div className="cmp-dims">
        {FACTORS.map((item) => (
          <button key={item.id} type="button" className={factor === item.id ? "on" : ""} onClick={() => setFactor(factor === item.id ? "" : item.id)}>
            <b>{item.title}</b>
          </button>
        ))}
      </div>
    </>
  );
}

const DOMAINS = [
  { id: "iot", title: "Embedded / IoT", note: "Small memories, low energy, and long product lives. RISC-V and ARM are both common; x86 appears in larger embedded PCs." },
  { id: "mobile", title: "Mobile", note: "Tight power and thermals. ARM is the usual application-processor choice. The others appear around it in accessories and research devices." },
  { id: "desktop", title: "Desktop / Laptop", note: "x86 still carries a large personal-computer software base. ARM laptops exist. RISC-V boards are used for development." },
  { id: "server", title: "Server / Cloud", note: "x86 has the broadest existing server software. ARM servers are established. RISC-V shows up in experiments and some accelerators." },
  { id: "research", title: "Research / Education", note: "RISC-V is popular because the base is open and small enough to teach. ARM and x86 remain important study targets." },
  { id: "custom", title: "Custom Silicon", note: "RISC-V and ARM are both licensed or open paths into a custom SoC. x86 is rarely the core you redesign." },
] as const;

export function EcosystemPage() {
  const [domain, setDomain] = useState<(typeof DOMAINS)[number]["id"]>("mobile");
  const selected = DOMAINS.find((item) => item.id === domain) ?? DOMAINS[0];
  return (
    <>
      <div className="cmp-glance">
        <article className="rv"><Chip name="RISC-V" tone="blue" /><p>Open standard. Modular. Growing ecosystem.</p></article>
        <article className="arm"><Chip name="ARM" tone="green" /><p>Widely used. Power efficient. Broad ecosystem.</p></article>
        <article className="x86"><Chip name="x86" tone="violet" /><p>Mature software base. Feature rich.</p></article>
      </div>
      <div className="cmp-dims">
        {DOMAINS.map((item) => (
          <button key={item.id} type="button" className={domain === item.id ? "on" : ""} onClick={() => setDomain(item.id)}><b>{item.title}</b></button>
        ))}
      </div>
      <section className="cmp-block">
        <h3>{selected.title}</h3>
        <p>{selected.note}</p>
        <p className="cmp-hint">Illustrative relative presence, not market-share data. The timeline below is illustrative, not to scale.</p>
        <div className="cmp-bars" aria-label="Illustrative relative presence">
          <span className="rv" style={{ width: domain === "research" || domain === "custom" || domain === "iot" ? "70%" : "28%" }}>RISC-V</span>
          <span className="arm" style={{ width: domain === "mobile" || domain === "iot" ? "88%" : "55%" }}>ARM</span>
          <span className="x86" style={{ width: domain === "desktop" || domain === "server" ? "90%" : "24%" }}>x86</span>
        </div>
      </section>
    </>
  );
}
