import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  GPR_NAMES, applyAlu, assembleX86, blankX86, crackUops, disassembleBytes, encodeMovMem, probeCache, readSlice, stepX86, writeSlice,
  type AsmInsn, type X86Cpu,
} from "../../engines/isaarch/x86";

export interface X86Api {
  cpu: X86Cpu;
  setCpu: (cpu: X86Cpu) => void;
  source: string;
  setSource: (value: string) => void;
  status: string;
  setStatus: (value: string) => void;
}

const LABS = [
  ["registers-flags", "c1", "Registers & Flags", "GPRs, aliases, flags", "/icons/arm-registers.png"],
  ["instruction-encoding", "c2", "Instruction Encoding", "Prefixes, opcode, ModR/M", "/icons/arm-encoding.png"],
  ["addressing-modes", "c3", "Addressing Modes", "Effective-address builder", "/icons/arm-memory.png"],
  ["assembler-disassembler", "c4", "Assembler & Disassembler", "Encode/decode real bytes", "/icons/arm-assembler.png"],
  ["decode-datapath", "c5", "Decode & Datapath", "Frontend and execution flow", "/icons/arm-datapath.png"],
  ["micro-operations", "c6", "Micro-operations (µOps)", "Crack instructions into µOps", "/icons/arm-pipeline.png"],
  ["out-of-order", "c7", "Out-of-Order Backend", "Rename, schedule, retire", "/icons/arm-soc.png"],
  ["memory-cache", "c8", "Memory & Cache", "Cache/TLB hierarchy", "/icons/arm-memory.png"],
  ["practice", "c9", "Practice & Quiz", "Test your understanding", "/icons/arm-practice.png"],
] as const;

const FLOW = [
  ["fetch", "Fetch"], ["decode", "Decode"], ["regs", "µOp Queue"], ["alu", "OOO Engine"], ["mem", "Memory Hierarchy"], ["wb", "Retire"],
];

const SAMPLE = `xor rax, rax
mov rcx, 1
mov edx, 5
loop:
add rax, rcx
inc rcx
cmp rcx, rdx
jle loop
mov rdi, rax
ret`;

function hex(value: bigint | number, digits = 16): string {
  return `0x${BigInt(value).toString(16).padStart(digits, "0")}`;
}

function Notes({ rows }: { rows: Array<[string, string]> }) {
  return (
    <section className="rvx-card">
      <h3>Notes for this lab</h3>
      <div className="arm-notes">
        {rows.map(([title, body]) => <div key={title}><b>{title}</b><span>{body}</span></div>)}
      </div>
    </section>
  );
}

const PROGRAMS = {
  sum: SAMPLE,
  copy: `mov rax, rbx
mov rcx, rax
mov rdi, rcx
ret`,
  imm: `mov eax, 7
mov ecx, 3
add rax, rcx
mov rdi, rax
ret`,
} as const;

export function OverviewPage() {
  const [step, setStep] = useState(0);
  const notes = [
    "Fetch brings a window of variable-length bytes. The length is not known until decode.",
    "Decode finds opcode, ModR/M, SIB, and immediates, then cracks the instruction into µOps.",
    "The µOp queue holds decoded work so the backend can run ahead of the front end.",
    "The out-of-order engine renames registers and executes ready µOps on free ports.",
    "Loads and stores walk L1, L2, L3, then DRAM. A hit avoids the long path.",
    "Retirement writes results back in program order so exceptions stay precise.",
  ];
  return (
    <>
      <section className="rvx-card">
        <h3>Modern x86 Processor Overview</h3>
        <div className="arm-flow">
          {FLOW.map(([id, label], index) => (
            <button key={id} type="button" className={`arm-box ${id} ${step === index ? "on" : ""}`} onClick={() => setStep(index)}>{label}</button>
          ))}
        </div>
        <p>{notes[step]}</p>
        <div className="arm-pills"><span>1–15 byte instr.</span><span>µOps</span><span>Out-of-order</span><span>L1/L2/L3</span></div>
      </section>
      <section className="rvx-card">
        <h3>Explore the Labs</h3>
        <div className="arm-explore">
          {LABS.map(([id, tone, title, blurb, icon]) => (
            <Link key={id} className={`arm-explore-card ${tone}`} to={`/architecture/x86/${id}`}>
              <img src={icon} alt="" />
              <span><strong>{title}</strong><small>{blurb}</small></span>
              <em>Open lab</em>
            </Link>
          ))}
        </div>
      </section>
      <Notes rows={[
        ["Variable length", "A fetch window does not line up on 4-byte boundaries. The front end has to discover where each instruction ends."],
        ["Legacy and long mode", "16-bit and 32-bit encodings still decode. Long mode adds REX, RIP-relative addressing, and R8–R15."],
        ["µOps are internal", "The bytes you assemble are the architectural instruction. The core may crack that instruction into simpler operations."],
        ["Retirement order", "Execution can leave program order. The register state a program observes is still the retired, in-order result."],
      ]} />
    </>
  );
}

const ALIAS = ["EAX / AX / AL", "EBX / BX / BL", "ECX / CX / CL", "EDX / DX / DL", "ESI / SI / SIL", "EDI / DI / DIL", "EBP / BP / BPL", "ESP / SP / SPL", "R8D / R8W / R8B", "R9D / R9W / R9B", "R10D / R10W / R10B", "R11D / R11W / R11B", "R12D / R12W / R12B", "R13D / R13W / R13B", "R14D / R14W / R14B", "R15D / R15W / R15B"];

export function RegisterPage({ api }: { api: X86Api }) {
  const [sel, setSel] = useState(0);
  const [wide, setWide] = useState(true);
  const [op, setOp] = useState("ADD");
  const [left, setLeft] = useState(10);
  const [right, setRight] = useState(6);
  const value = api.cpu.gpr[sel] ?? 0n;
  const alu = applyAlu(op, BigInt(left), BigInt(right), 32);
  const apply = () => {
    const gpr = api.cpu.gpr.slice();
    gpr[sel] = writeSlice(value, 32, alu.result);
    api.setCpu({ ...api.cpu, gpr, flags: { ...api.cpu.flags, ...alu.flags } });
    api.setStatus(`${op} wrote ${GPR_NAMES[sel]}. EAX-style writes zero-extend into the 64-bit register.`);
  };
  return (
    <>
      <section className="rvx-card">
        <div className="arm-headrow">
          <h3>x86-64 Register Explorer</h3>
          <div className="rvx-tabs">
            <button type="button" className={wide ? "on" : ""} onClick={() => setWide(true)}>64-bit</button>
            <button type="button" className={!wide ? "on" : ""} onClick={() => setWide(false)}>Alias view</button>
          </div>
        </div>
        <div className="x86-regs">
          {GPR_NAMES.map((name, index) => (
            <button key={name} type="button" className={sel === index ? "on" : ""} onClick={() => setSel(index)}>
              <b>{name}</b>
              <small>{ALIAS[index]}</small>
              <code>{hex(wide ? (api.cpu.gpr[index] ?? 0n) : readSlice(api.cpu.gpr[index] ?? 0n, 32), wide ? 16 : 8)}</code>
            </button>
          ))}
        </div>
        <div className="arm-special">
          <div><b>Selected {GPR_NAMES[sel]}</b><span>64-bit {hex(value)}</span></div>
          <div><b>32-bit</b><span>{hex(readSlice(value, 32), 8)}</span></div>
          <div><b>16-bit</b><span>{hex(readSlice(value, 16), 4)}</span></div>
          <div><b>8-bit</b><span>{hex(readSlice(value, 8), 2)}</span></div>
        </div>
      </section>
      <section className="rvx-card">
        <h3>RIP & RFLAGS</h3>
        <div className="arm-special">
          <div><b>RIP</b><span>{hex(BigInt(api.cpu.rip), 16)}</span></div>
          <div><b>RFLAGS</b><span>CF {api.cpu.flags.cf} · ZF {api.cpu.flags.zf} · SF {api.cpu.flags.sf} · OF {api.cpu.flags.of}</span></div>
          <div><b>Stack pointer</b><span>RSP = {hex(api.cpu.gpr[7] ?? 0n)}</span></div>
          <div><b>Mode</b><span>64-bit long mode</span></div>
        </div>
        <div className="rvx-tabs">
          {["ADD", "SUB", "CMP", "INC", "DEC", "AND", "OR", "XOR", "SHL", "SHR"].map((item) => <button key={item} type="button" className={op === item ? "on" : ""} onClick={() => setOp(item)}>{item}</button>)}
        </div>
        <div className="rvx-cols">
          <label>Left <input aria-label="left operand" type="number" value={left} onChange={(event) => setLeft(Number(event.target.value) || 0)} /></label>
          <label>Right <input aria-label="right operand" type="number" value={right} onChange={(event) => setRight(Number(event.target.value) || 0)} /></label>
        </div>
        <p>Result {alu.result.toString()} · CF {alu.flags.cf} PF {alu.flags.pf} AF {alu.flags.af} ZF {alu.flags.zf} SF {alu.flags.sf} OF {alu.flags.of}</p>
        <button type="button" className="rvx-btn" onClick={apply}>Write 32-bit result into {GPR_NAMES[sel]}</button>
        <p>{api.status}</p>
      </section>
      <Notes rows={[
        ["RAX family", "RAX is 64 bits. EAX is bits 31:0, AX is 15:0, AL is 7:0, and AH is 15:8. R8–R15 use R8D, R8W, and R8B instead of AH."],
        ["32-bit writes", "Writing EAX, ECX, or any other 32-bit GPR clears bits 63:32 of the matching 64-bit register. That is zero-extension, not a merge."],
        ["16- and 8-bit writes", "Writing AX or AL keeps the other bits of RAX. That is why a partial write can later stall a reader of the full register."],
        ["Flags that this sandbox updates", "ADD, SUB, CMP, AND, OR, XOR, SHL, and SHR update ZF, SF, PF, CF, OF, and AF. INC and DEC leave CF unchanged. TF, IF, and DF are control bits, not results."],
        ["RSP and RIP", "RSP is the stack pointer. RIP is the next instruction address. Neither is a general data register, even though RSP is encoded in the GPR file."],
        ["Calling convention, briefly", "On System V x86-64, RDI, RSI, RDX, RCX, R8, and R9 carry arguments. RAX carries the return value. This studio does not call an operating system."],
      ]} />
    </>
  );
}

export function EncodingPage() {
  const [dest, setDest] = useState(0);
  const [base, setBase] = useState(1);
  const [index, setIndex] = useState(2);
  const [scale, setScale] = useState(4);
  const [disp, setDisp] = useState(0x20);
  const [field, setField] = useState(0);
  const encoded = encodeMovMem(dest, base, index, scale, disp);
  const selected = encoded.fields[field] ?? encoded.fields[0];
  return (
    <section className="rvx-card">
      <h3>Encoding Explorer — {encoded.asm}</h3>
      <div className="x86-bytes">
        {encoded.fields.map((item, itemIndex) => (
          <button key={item.name} type="button" className={field === itemIndex ? "on" : ""} onClick={() => setField(itemIndex)}>
            <b>{item.name}</b><span>{item.byte}</span>
          </button>
        ))}
        <em>{encoded.bytes.length} bytes</em>
      </div>
      <div className="rvx-grid2">
        <div>
          <h3>Byte breakdown</h3>
          {encoded.fields.map((item) => <p key={item.name}><b>{item.name} {item.byte}</b> {item.bits} · {item.note}</p>)}
          {selected ? <p>Selected bits {selected.bits}. {selected.note}</p> : null}
        </div>
        <div>
          <h3>Interactive builder</h3>
          <label>Destination <select aria-label="destination" value={dest} onChange={(event) => setDest(Number(event.target.value))}>{GPR_NAMES.map((name, index) => <option key={name} value={index}>{name}</option>)}</select></label>
          <label>Base <select aria-label="base register" value={base} onChange={(event) => setBase(Number(event.target.value))}>{GPR_NAMES.slice(0, 8).map((name, index) => <option key={name} value={index}>{name}</option>)}</select></label>
          <label>Index <select aria-label="index register" value={index} onChange={(event) => setIndex(Number(event.target.value))}>{GPR_NAMES.slice(0, 8).map((name, index) => <option key={name} value={index}>{name}</option>)}</select></label>
          <label>Scale <select aria-label="scale" value={scale} onChange={(event) => setScale(Number(event.target.value))}>{[1, 2, 4, 8].map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label>Displacement <input aria-label="displacement" type="number" value={disp} onChange={(event) => setDisp(Number(event.target.value) || 0)} /></label>
          <p className="arm-hex">Encoded bytes: {encoded.bytes.map((item) => item.toString(16).padStart(2, "0")).join(" ").toUpperCase()}</p>
        </div>
      </div>
      <Notes rows={[
        ["Why the length changes", "A register-to-register MOV can be two or three bytes. Adding a SIB and a displacement, as this builder does, grows the instruction. The architectural maximum is 15 bytes."],
        ["REX", "REX.W (0x48 here) selects a 64-bit operand. Other REX bits extend the register numbers so R8–R15 can appear in ModR/M and SIB."],
        ["ModR/M", "Two bits of Mod, three of Reg/Opcode, three of R/M. Mod 00/01/10 names a memory operand. Mod 11 names a register. R/M = 4 means a SIB byte follows."],
        ["SIB", "Scale is 1, 2, 4, or 8. Index and base are register numbers. RSP cannot be an index. This page’s MOV RAX, [RBX+RCX*4+0x20] is 48 8B 44 8B 20."],
        ["Displacement and immediate", "Disp8 is one byte. Disp32 is four. An immediate is separate from the address: it is the constant operand, not the offset."],
        ["Opcode 8B", "8B is MOV r64, r/m64. The destination is the Reg field, and the memory operand is Mod plus R/M plus the optional SIB and displacement."],
      ]} />
    </section>
  );
}

const FORMS = [
  { label: "[RAX]", note: "base only", base: 0x1000, index: 0, scale: 1, disp: 0 },
  { label: "[RAX+32]", note: "base + displacement", base: 0x1000, index: 0, scale: 1, disp: 32 },
  { label: "[RAX+RCX*4]", note: "base + index×scale", base: 0x1000, index: 0x20, scale: 4, disp: 0 },
  { label: "[RCX*8+0x100]", note: "index×scale + displacement", base: 0, index: 0x20, scale: 8, disp: 0x100 },
  { label: "[RIP+disp32]", note: "RIP-relative", base: 0x401000, index: 0, scale: 1, disp: 0x20 },
];

export function AddressingPage() {
  const [base, setBase] = useState(0x1000);
  const [index, setIndex] = useState(0x20);
  const [scale, setScale] = useState(4);
  const [disp, setDisp] = useState(0x30);
  const [form, setForm] = useState(2);
  const ea = (base + index * scale + disp) >>> 0;
  return (
    <>
      <section className="rvx-card">
        <h3>Effective Address Builder</h3>
        <div className="rvx-grid2">
          <div>
            <h3>Address equation</h3>
            <p><strong>EA = Base + Index × Scale + Displacement</strong></p>
            <label>Base <input aria-label="base" type="number" value={base} onChange={(event) => setBase(Number(event.target.value) || 0)} /></label>
            <label>Index <input aria-label="index" type="number" value={index} onChange={(event) => setIndex(Number(event.target.value) || 0)} /></label>
            <label>Scale <select aria-label="address scale" value={scale} onChange={(event) => setScale(Number(event.target.value))}>{[1, 2, 4, 8].map((item) => <option key={item}>{item}</option>)}</select></label>
            <label>Displacement <input aria-label="address displacement" type="number" value={disp} onChange={(event) => setDisp(Number(event.target.value) || 0)} /></label>
            <p className="arm-hex">0x{base.toString(16)} + 0x{index.toString(16)}×{scale} + 0x{disp.toString(16)} = 0x{ea.toString(16).toUpperCase()}</p>
          </div>
          <div>
            <h3>Common x86 addressing forms</h3>
            {FORMS.map((item, itemIndex) => (
              <button key={item.label} type="button" className={form === itemIndex ? "on" : ""} onClick={() => { setForm(itemIndex); setBase(item.base); setIndex(item.index); setScale(item.scale); setDisp(item.disp); }}>
                <b>{item.label}</b> <span>{item.note}</span>
              </button>
            ))}
            <p>LEA RDX, […] computes this address and writes RDX. It does not read memory.</p>
          </div>
        </div>
      </section>
      <section className="rvx-card">
        <h3>Addressing visualizer</h3>
        <div className="arm-labs">
          <div className="arm-lab c1"><strong>Base</strong><span>0x{base.toString(16).toUpperCase()}</span></div>
          <div className="arm-lab c2"><strong>Index</strong><span>0x{index.toString(16).toUpperCase()}</span></div>
          <div className="arm-lab c3"><strong>Scale</strong><span>×{scale}</span></div>
          <div className="arm-lab c5"><strong>Disp</strong><span>+0x{disp.toString(16).toUpperCase()}</span></div>
          <div className="arm-lab c4"><strong>Result</strong><span>0x{ea.toString(16).toUpperCase()}</span></div>
        </div>
      </section>
      <Notes rows={[
        ["Array", "For 4-byte elements, scale 4 turns an index into a byte offset: address = base + index×4. Scale 8 matches 8-byte elements."],
        ["Struct field", "A field at byte 12 is a displacement. The base is the start of the object. No index is required when the field offset is constant."],
        ["Stack local", "Locals are often [RBP−offset] or [RSP+offset]. The displacement is negative for the classic frame-pointer form."],
        ["RIP-relative", "Long mode can encode [RIP+disp32]. The address is the next instruction’s RIP plus a 32-bit displacement. Position-independent code uses this constantly."],
        ["LEA versus MOV", "LEA writes the effective address into a register. MOV from the same brackets reads memory at that address. Same math, different operation."],
        ["What this page does not model", "Segment bases are mostly zero in long mode. This calculator shows the offset math only."],
      ]} />
    </>
  );
}

export function AssemblerPage({ api }: { api: X86Api }) {
  const built = useMemo(() => assembleX86(api.source), [api.source]);
  const insns: AsmInsn[] = built.ok ? built.insns : [];
  const [hexIn, setHexIn] = useState("48 89 D8");
  const run = (limit: number) => {
    if (!built.ok) { api.setStatus(built.errors.join(" ")); return; }
    let cpu = limit > 1 ? blankX86() : api.cpu;
    if (limit > 1) cpu = blankX86();
    for (let i = 0; i < limit && !cpu.halted; i += 1) cpu = stepX86(cpu, built.insns);
    api.setCpu(cpu);
    api.setStatus(cpu.halted ? "Halted." : "Stepped.");
  };
  return (
    <>
      <div className="rvx-tabs">
        <button type="button" onClick={() => { api.setSource(PROGRAMS.sum); api.setStatus("Loaded the sum loop. Run should leave RAX = 15."); }}>Sum loop</button>
        <button type="button" onClick={() => { api.setSource(PROGRAMS.copy); api.setStatus("Loaded a register copy. Set RBX on the Registers page first, then Step."); }}>Copy registers</button>
        <button type="button" onClick={() => { api.setSource(PROGRAMS.imm); api.setStatus("Loaded an immediate add. EAX and ECX writes zero-extend. Run leaves RAX = 10."); }}>Immediate add</button>
        <button type="button" onClick={() => api.setSource(localStorage.getItem("logiclab.x86.asm") ?? SAMPLE)}>Load</button>
        <button type="button" onClick={() => { localStorage.setItem("logiclab.x86.asm", api.source); api.setStatus("Saved in this browser."); }}>Save</button>
        <button type="button" onClick={() => api.setStatus(built.ok ? `Assembled ${built.insns.length} instructions.` : built.errors.join(" "))}>Assemble</button>
        <button type="button" className="rvx-btn" onClick={() => run(80)}>Run</button>
        <button type="button" onClick={() => run(1)}>Step</button>
        <button type="button" onClick={() => { api.setCpu(blankX86()); api.setStatus("Reset."); }}>Reset</button>
      </div>
      <div className="arm-asm">
        <div className="rvx-editor">
          <div className="gutter">{api.source.split("\n").map((_, index) => <span key={index}>{index + 1}</span>)}</div>
          <pre>{api.source}</pre>
          <textarea aria-label="x86 source" spellCheck={false} value={api.source} onChange={(event) => api.setSource(event.target.value)} />
        </div>
        <section className="rvx-card">
          <h3>Bytes / disassembly</h3>
          <pre className="rvx-pre">{built.ok ? built.insns.map((insn) => `${insn.bytes.map((item) => item.toString(16).padStart(2, "0")).join(" ").toUpperCase()}  ${insn.text}`).join("\n") : built.errors.join("\n")}</pre>
          <label>Disassemble <input aria-label="hex bytes" value={hexIn} onChange={(event) => setHexIn(event.target.value)} /></label>
          <p>{disassembleBytes(hexIn)}</p>
          <button type="button" onClick={() => { const bytes = built.ok ? built.insns.map((insn) => insn.bytes.map((item) => item.toString(16).padStart(2, "0")).join(" ")).join(" ") : hexIn; void navigator.clipboard?.writeText(bytes.toUpperCase()); api.setStatus("Copied the byte listing."); }}>Copy bytes</button>
        </section>
        <section className="rvx-card">
          <h3>Registers & flags</h3>
          <pre className="rvx-pre">{[["RAX", 0], ["RCX", 2], ["RDX", 3], ["RBX", 1], ["RDI", 5]].map(([name, index]) => `${name}  ${hex(api.cpu.gpr[index as number] ?? 0n)}`).join("\n")}{"\n"}ZF {api.cpu.flags.zf}  SF {api.cpu.flags.sf}  CF {api.cpu.flags.cf}  OF {api.cpu.flags.of}</pre>
          <pre className="arm-console">{api.cpu.trace.slice(-4).join("\n") || "> ready"}{api.cpu.halted ? `\nRAX = ${(api.cpu.gpr[0] ?? 0n).toString()}` : ""}</pre>
        </section>
      </div>
      <section className="rvx-card">
        <h3>Execution state</h3>
        <div className="arm-special">
          <div><b>RIP</b><span>{api.cpu.rip}</span></div>
          <div><b>Current</b><span>{api.cpu.current || "—"}</span></div>
          <div><b>Cycles</b><span>{api.cpu.cycles}</span></div>
          <div><b>Retired</b><span>{api.cpu.retired}</span></div>
          <div><b>Status</b><span>{api.status || (api.cpu.halted ? "Halted" : "Ready")}</span></div>
        </div>
        <p>{insns.length} instructions in the listing. This is a teaching subset, not a full Intel assembler.</p>
      </section>
      <Notes rows={[
        ["What you can type", "xor, add, and cmp of two registers; inc; mov reg, reg; mov reg, immediate; jle and jmp to a label; ret. A semicolon starts a comment. Lines starting with . or section or global are skipped."],
        ["Intel syntax", "The destination is written first: mov rax, rbx copies RBX into RAX. add rax, rcx replaces RAX with RAX+RCX. The first operand is both a source and the destination."],
        ["Sum loop", "xor rax, rax clears the sum and sets ZF. mov edx, 5 zero-extends into RDX. The body adds RCX, increments it, and jle repeats while RCX ≤ RDX. The total is 1+2+3+4+5 = 15."],
        ["jle", "Jump if less or equal uses ZF = 1 or SF ≠ OF. The studio steps by instruction index. The displacement byte is still filled so the listing shows a real relative branch."],
        ["48 89 D8", "REX.W, opcode 89 (MOV r/m64, r64), ModR/M D8. That is mov RAX, RBX. Paste other studio bytes into the disassemble box."],
        ["What is left out", "Memory operands, calls, pushes, and most opcodes are not in this assembler. Use Encoding, Addressing, and Micro-operations for those ideas."],
      ]} />
    </>
  );
}

const STAGES = ["Fetch Bytes", "Length Decode", "Instruction Decode", "Operand Read", "Execute", "Retire"];

export function DatapathPage() {
  const [stage, setStage] = useState(0);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return undefined;
    const id = window.setInterval(() => setStage((value) => (value + 1) % STAGES.length), 700);
    return () => window.clearInterval(id);
  }, [playing]);
  const encoded = encodeMovMem(0, 1, 2, 4, 0x20);
  return (
    <section className="rvx-card">
      <div className="arm-headrow">
        <h3>Instruction flow — {encoded.bytes.map((item) => item.toString(16).padStart(2, "0")).join(" ").toUpperCase()}</h3>
        <div className="rvx-tabs">
          <button type="button" className="rvx-btn" onClick={() => setPlaying((value) => !value)}>{playing ? "Pause" : "Run"}</button>
          <button type="button" onClick={() => setStage((value) => (value + 1) % STAGES.length)}>Step</button>
        </div>
      </div>
      <div className="arm-flow">
        {STAGES.map((label, index) => <button key={label} type="button" className={`arm-box ${["fetch", "decode", "regs", "alu", "mem", "wb"][index]} ${stage === index ? "on" : ""}`} onClick={() => setStage(index)}>{label}</button>)}
      </div>
      <h3>Live decode state</h3>
      <div className="arm-special">
        <div><b>Length</b><span>{encoded.bytes.length} bytes</span></div>
        <div><b>Mnemonic</b><span>MOV</span></div>
        <div><b>Dest</b><span>RAX</span></div>
        <div><b>Source</b><span>[RBX+RCX*4+0x20]</span></div>
        <div><b>EA</b><span>depends on register values</span></div>
        <div><b>µOps</b><span>2</span></div>
      </div>
      <p>{STAGES[stage]}. Simplified educational front end: length decode must finish before the next boundary is known.</p>
      <Notes rows={[
        ["Fetch Bytes", "The instruction cache returns a window, often 16 or 32 bytes. Those bytes may contain several instructions, or only part of a long one."],
        ["Length Decode", "x86 length is not in a fixed field. Prefixes, opcode escapes, ModR/M, SIB, displacement, and immediate each add bytes. The next instruction starts immediately after this one."],
        ["Instruction Decode", "Once the boundary is known, the decoder reads the opcode and operands. Simple forms become one or two µOps. Rare forms can enter a microcode sequencer."],
        ["Operand Read", "The effective address for 48 8B 44 8B 20 is RBX + RCX×4 + 0x20. The load uses that address. The destination register is RAX."],
        ["Execute and Retire", "Execution can use an ALU, AGU, or load port. Retirement updates RIP and the architectural registers in program order."],
        ["Not a vendor pipeline", "Real cores add a µOp cache, branch prediction, and several decoders. This row is the teaching order, not a specific Intel or AMD diagram."],
      ]} />
    </section>
  );
}

export function MicroPage() {
  const [kind, setKind] = useState("add");
  const [cursor, setCursor] = useState(0);
  const cracked = crackUops(kind);
  return (
    <>
      <section className="rvx-card">
        <h3>µOp Decomposition Lab</h3>
        <p className="arm-hex">{cracked.title}</p>
        <div className="arm-flow">
          {cracked.uops.map((uop, index) => (
            <button key={uop.name + index} type="button" className={`arm-box ${index === cursor ? "on" : ""}`} onClick={() => setCursor(index)}><b>µOp {index + 1}</b><br />{uop.name}<br />{uop.detail}</button>
          ))}
        </div>
        <p>Dependency chain: {cracked.chain}. Simplified educational model — a real core may fuse or cache these differently.</p>
        <button type="button" onClick={() => setCursor((value) => (value + 1) % cracked.uops.length)}>Advance µOp</button>
      </section>
      <section className="rvx-card">
        <h3>Fusion & decode notes</h3>
        <div className="arm-labs">
          <div className="arm-lab c2"><strong>Macro-fusion</strong><span>CMP + jcc may fuse</span></div>
          <div className="arm-lab c6"><strong>Micro-fusion</strong><span>address + op may stay fused</span></div>
          <div className="arm-lab c4"><strong>µOp cache</strong><span>decoded ops can bypass decode</span></div>
        </div>
      </section>
      <section className="rvx-card">
        <h3>Compare instructions</h3>
        <div className="arm-labs">
          {([["reg", "ADD RAX, RBX", "1 µOp"], ["mov", "MOV RAX, [MEM]", "2 µOps"], ["add", "ADD [MEM], RBX", "4 µOps"], ["rep", "REP MOVSB", "microcoded"]] as const).map(([id, title, note]) => (
            <button key={id} type="button" className={`arm-lab ${kind === id ? "on" : ""}`} onClick={() => { setKind(id); setCursor(0); }}><strong>{title}</strong><span>{note}</span></button>
          ))}
        </div>
      </section>
      <Notes rows={[
        ["One µOp", "ADD RAX, RBX names only registers. A simplified core can send that straight to an ALU port."],
        ["Load", "MOV RAX, [MEM] needs an address calculation and a load. The destination is a register, so there is no store."],
        ["Read-modify-write", "ADD [RAX+8], RBX reads memory, adds RBX, and writes the same address. That is why the teaching split is AGU, load, ALU, store."],
        ["PUSH", "PUSH subtracts 8 from RSP, then stores the register at the new RSP. The architectural instruction is one; the internal work is two."],
        ["REP MOVSB", "The prefix repeats a string move while RCX is not zero. Microcode, not a single ALU µOp, walks RSI and RDI."],
        ["Fusion is optional", "Macro-fusion can pair CMP with a following conditional jump. Micro-fusion can keep an address and an operation together. A µOp cache can skip decode on a later hit. None of these is required by the ISA."],
      ]} />
    </>
  );
}

const ROB = [
  ["ADD RAX, RBX", "Ready"],
  ["LDR RCX, [RDX]", "Waiting"],
  ["MUL R8, R9", "Executing"],
  ["SUB R10, RAX", "Ready"],
  ["JNZ target", "Waiting"],
];
const RS = [
  ["ALU0", "ADD RAX, RBX", "ready"],
  ["ALU1", "SUB R10, P3", "wait P3"],
  ["AGU0", "LDR RCX, [RDX]", "ready"],
  ["MUL0", "MUL R8, R9", "executing"],
  ["BR0", "JNZ target", "wait flags"],
];

export function OooPage() {
  const [phase, setPhase] = useState(0);
  const names = ["Rename", "Allocate ROB", "Dispatch", "Schedule", "Execute", "Retire"];
  return (
    <>
      <section className="rvx-card">
        <h3>OOO backend playground</h3>
        <p>Simplified educational model. It is not a named Intel or AMD pipeline.</p>
        <div className="arm-flow">
          {names.map((name, index) => <button key={name} type="button" className={`arm-box ${phase === index ? "on" : ""}`} onClick={() => setPhase(index)}>{name}</button>)}
        </div>
        <div className="rvx-grid2">
          <div>
            <h3>Reorder buffer (ROB)</h3>
            {ROB.map(([text, state], index) => <p key={text}><b>{index}</b> {text} <span>{phase >= 5 && index === 0 ? "Retired" : state}</span></p>)}
          </div>
          <div>
            <h3>Reservation stations / scheduler</h3>
            {RS.map(([port, text, state]) => <p key={port}><b>{port}</b> {text} <span>{phase >= 4 && state === "ready" ? "issued" : state}</span></p>)}
          </div>
        </div>
      </section>
      <section className="rvx-card">
        <h3>Rename map</h3>
        <div className="arm-labs">
          <div className="arm-lab c1"><strong>RAX → P3</strong><span>producer: ADD</span></div>
          <div className="arm-lab c2"><strong>RCX → P5</strong><span>producer: LOAD</span></div>
          <div className="arm-lab c3"><strong>R10 → P7</strong><span>depends on P3</span></div>
          <div className="arm-lab c4"><strong>FLAGS → P8</strong><span>producer: CMP</span></div>
        </div>
        <p>{names[phase]}. Renaming removes the false WAR/WAW on RAX. The ROB still retires ADD before the later SUB.</p>
      </section>
      <Notes rows={[
        ["RAW", "SUB R10, RAX needs the new RAX. It waits on physical register P3, the result of ADD. That dependence is real."],
        ["WAR and WAW", "A later write of RAX does not have to wait for an earlier reader once the old value has its own physical register. Renaming removes those false dependencies."],
        ["Ready versus waiting", "A reservation station issues a µOp when its sources are ready and a port is free. The load can run while a later ALU op is still waiting."],
        ["In-order retirement", "The ROB can mark MUL complete before ADD retires. ADD still leaves the machine first, because it is older."],
        ["Mispredict", "A wrong JNZ flushes instructions that were fetched after the branch. Their physical registers are discarded. Architectural state stays at the last retired instruction."],
        ["Ports", "ALU, branch, load, store, and multiply are separate teaching ports. A real core’s port mix is a microarchitecture choice, not part of the x86 ISA."],
      ]} />
    </>
  );
}

export function CachePage() {
  const [addr, setAddr] = useState("0x00007FFF12345678");
  const [warm, setWarm] = useState(false);
  const [offset, setOffset] = useState(0x18);
  const value = BigInt(addr.replace(/^0x/i, "") || "0");
  const probe = probeCache(value, warm);
  return (
    <>
      <section className="rvx-card">
        <h3>Memory Hierarchy Explorer</h3>
        <div className="arm-flow">
          <div className={`arm-box fetch ${probe.l1 === "Hit" ? "on" : ""}`}>L1D<br />32 KB<br />~4 cyc</div>
          <div className={`arm-box decode ${probe.l2 === "Hit" ? "on" : ""}`}>L2<br />1 MB<br />~12 cyc</div>
          <div className="arm-box alu">L3<br />32 MB<br />~40 cyc</div>
          <div className={`arm-box mem ${probe.l1 === "Miss" && probe.l2 === "Miss" ? "on" : ""}`}>DRAM<br />32 GB<br />~200 cyc</div>
        </div>
        <div className="rvx-grid2">
          <div>
            <h3>Access simulator</h3>
            <label>Virtual address <input aria-label="virtual address" value={addr} onChange={(event) => { setAddr(event.target.value); setWarm(false); }} /></label>
            <p>TLB <b>{probe.tlb}</b> · L1D <b>{probe.l1}</b> · L2 <b>{probe.l2}</b></p>
            <p className="arm-hex">Estimated access: ~{probe.cycles} cycles</p>
            <button type="button" onClick={() => setWarm(true)}>Install line in L1</button>
          </div>
          <div>
            <h3>Cache line view (64 B)</h3>
            <div className="arm-pills">
              {[0, 8, 0x10, 0x18, 0x20, 0x28, 0x30, 0x38].map((item) => (
                <button key={item} type="button" onClick={() => setOffset(item)}>+{item.toString(16)}</button>
              ))}
            </div>
            <p>Selected offset +{offset.toString(16)}. Physical line {probe.pa}. Lines move 64 bytes, not one byte.</p>
          </div>
        </div>
      </section>
      <section className="rvx-card">
        <h3>Translation path</h3>
        <div className="arm-labs">
          <div className="arm-lab c1"><strong>VA</strong><span>{addr}</span></div>
          <div className="arm-lab c2"><strong>TLB</strong><span>{probe.tlb}</span></div>
          <div className="arm-lab c4"><strong>PA</strong><span>{probe.pa}</span></div>
          <div className="arm-lab c5"><strong>L1D</strong><span>{probe.l1}</span></div>
          <div className="arm-lab c3"><strong>L2</strong><span>{probe.l2}</span></div>
        </div>
      </section>
      <Notes rows={[
        ["What the numbers mean", "4, 12, 40, and 200 cycles are teaching latencies, not a datasheet. They only show that a miss costs more than a hit."],
        ["Line, not byte", "A hit fills 64 bytes. Clicking another offset in the same line is still that line. The next line is a different tag."],
        ["TLB", "The virtual page 0x7FFF is the known teaching page, so the TLB hits and the walk stops. Another page misses and pays the long path."],
        ["Install in L1", "After a line is installed, the same address hits L1 and the estimate drops to about 4 cycles. Editing the address clears that install."],
        ["Write policy, conceptually", "A store can update L1 and mark the line dirty, or write through toward DRAM. This lab reports the lookup, not a coherence protocol."],
        ["Sequential versus random", "Neighbors in the same 64-byte line reuse one fill. Jumping to a new page misses the TLB and the caches in this model."],
      ]} />
    </>
  );
}

const QUIZ = [
  { topic: "Encoding", q: "Which x86 byte commonly carries Mod, Reg, and R/M fields?", choices: ["REX prefix", "ModR/M byte", "SIB byte", "Immediate"], answer: 1, why: "ModR/M encodes Mod, Reg, and R/M. SIB is a following byte when R/M selects it." },
  { topic: "Registers", q: "What does a write to EAX do to RAX in long mode?", choices: ["Zero-extends into all 64 bits", "Leaves bits 63:32 unchanged", "Writes only AH", "Switches to compatibility mode"], answer: 0, why: "A 32-bit GPR write zero-extends. 16-bit and 8-bit writes merge into the old value." },
  { topic: "Addressing", q: "What is EA for base 0x1000, index 0x20, scale 4, displacement 0x30?", choices: ["0x10B0", "0x1054", "0x1000", "0x20"], answer: 0, why: "0x1000 + 0x20×4 + 0x30 = 0x10B0." },
  { topic: "µOps", q: "Why can ADD [RAX+8], RBX become several µOps?", choices: ["It must generate an address, load, add, and store", "ADD is undefined", "REX forbids memory operands", "The ROB only holds one µOp"], answer: 0, why: "A read-modify-write memory operand is cracked into address, load, ALU, and store work." },
  { topic: "OOO", q: "What does in-order retirement preserve?", choices: ["Precise architectural state", "The fastest possible store order only", "16-bit real mode", "A fixed 4-byte instruction length"], answer: 0, why: "The ROB retires in program order so exceptions and the architectural registers stay precise." },
  { topic: "Cache", q: "What does a cache line move?", choices: ["A block of bytes, often 64", "Exactly one byte", "Only the TLB", "Only RIP"], answer: 0, why: "A hit or miss fills a line. Nearby offsets in that line then hit." },
  { topic: "Registers", q: "Which register holds the next instruction address?", choices: ["RIP", "RFLAGS", "RSP", "R11"], answer: 0, why: "RIP is the instruction pointer. RSP is the stack pointer." },
  { topic: "Encoding", q: "What does SIB encode?", choices: ["Scale, index, and base", "Only the opcode", "Only CF and ZF", "The TLB page size"], answer: 0, why: "SIB is the scale-index-base byte used when the address needs a scaled index." },
  { topic: "Assembler", q: "In Intel syntax, what does mov rax, rbx do?", choices: ["Copies RBX into RAX", "Copies RAX into RBX", "Adds the registers", "Pushes RBX"], answer: 0, why: "The destination is written first. RAX changes. RBX does not." },
  { topic: "Assembler", q: "The sum loop adds 1 through 5. What is RAX at ret?", choices: ["15", "5", "10", "0"], answer: 0, why: "1+2+3+4+5 = 15. xor rax, rax starts the sum at zero." },
  { topic: "Flags", q: "Which flag does INC leave unchanged?", choices: ["CF", "ZF", "SF", "OF"], answer: 0, why: "INC and DEC update ZF, SF, and OF, but they do not write CF." },
  { topic: "Addressing", q: "What does LEA write?", choices: ["The effective address, without a memory read", "The bytes at that address", "RIP", "RFLAGS"], answer: 0, why: "LEA calculates base + index×scale + displacement and stores that address in the destination." },
];

export function PracticePage() {
  const [topic, setTopic] = useState("Mixed");
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [seen, setSeen] = useState<Record<string, number>>({});
  const pool = QUIZ.filter((item) => topic === "Mixed" || item.topic === topic);
  const item = pool[index % Math.max(1, pool.length)];
  if (!item) return null;
  return (
    <>
      <section className="rvx-card">
        <h3>x86 Mastery Challenge</h3>
        <div className="rvx-tabs">
          {["Mixed", "Registers", "Flags", "Encoding", "Addressing", "Assembler", "µOps", "OOO", "Cache"].map((name) => <button key={name} type="button" className={topic === name ? "on" : ""} onClick={() => { setTopic(name); setIndex(0); setPicked(null); }}>{name}</button>)}
        </div>
        <p>Question {(index % pool.length) + 1} of {pool.length} · Score {score}</p>
        <span className="arm-pills"><span>{item.topic}</span></span>
        <h3>{item.q}</h3>
        <div className="arm-quiz">
          {item.choices.map((choice, choiceIndex) => (
            <button key={choice} type="button" className={picked === null ? "" : choiceIndex === item.answer ? "ok" : picked === choiceIndex ? "bad" : ""} onClick={() => {
              if (picked !== null) return;
              setPicked(choiceIndex);
              if (choiceIndex === item.answer) {
                setScore((value) => value + 1);
                setSeen((value) => ({ ...value, [item.topic]: (value[item.topic] ?? 0) + 1 }));
              }
            }}><b>{["A", "B", "C", "D"][choiceIndex]}</b> {choice}</button>
          ))}
        </div>
        {picked !== null && <p className={picked === item.answer ? "arm-ok" : ""}>{picked === item.answer ? "Correct." : "Not this one."} {item.why}</p>}
        <button type="button" onClick={() => { setIndex((value) => value + 1); setPicked(null); }}>Next question</button>
      </section>
      <section className="rvx-card">
        <h3>Mastery by topic</h3>
        <div className="arm-cpi">
          {["Registers", "Flags", "Encoding", "Addressing", "Assembler", "µOps", "OOO", "Cache"].map((name) => {
            const total = QUIZ.filter((row) => row.topic === name).length;
            const hits = seen[name] ?? 0;
            return <div key={name}><b>{name}</b><strong>{total ? Math.round((hits / total) * 100) : 0}%</strong><span>{hits} / {total}</span></div>;
          })}
        </div>
      </section>
    </>
  );
}
