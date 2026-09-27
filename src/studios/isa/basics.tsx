import { useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { executeTeach, freshMachine, type TeachOp } from "../../engines/isa/teach";
import { reducedMotion } from "../aca/animation/acaMotion";
import { CodeBlock, Mark, RunBar, WhatChanged } from "./ui";

const OPS: TeachOp[] = ["ADD", "SUB", "AND", "OR", "XOR", "ADDI", "LOAD", "STORE"];

const COPY: Record<TeachOp, { tokens: Array<{ text: string; tip: string }>; meaning: string; note: string; rd: number; rs1: number; rs2: number; imm: number }> = {
  ADD: { tokens: [{ text: "ADD", tip: "Opcode: add the two sources." }, { text: "R1", tip: "Rd: destination register." }, { text: "R2", tip: "Rs1: first source." }, { text: "R3", tip: "Rs2: second source." }], meaning: "R1 = R2 + R3", note: "Adds the values in registers R2 and R3, then writes the result to register R1.", rd: 1, rs1: 2, rs2: 3, imm: 0 },
  SUB: { tokens: [{ text: "SUB", tip: "Opcode: subtract." }, { text: "R1", tip: "Destination." }, { text: "R3", tip: "Value to subtract from." }, { text: "R2", tip: "Value subtracted." }], meaning: "R1 = R3 − R2", note: "Subtracts R2 from R3 and writes R1.", rd: 1, rs1: 3, rs2: 2, imm: 0 },
  AND: { tokens: [{ text: "AND", tip: "Bitwise AND." }, { text: "R1", tip: "Destination." }, { text: "R2", tip: "First source." }, { text: "R3", tip: "Second source." }], meaning: "R1 = R2 AND R3", note: "Keeps bits that are 1 in both registers.", rd: 1, rs1: 2, rs2: 3, imm: 0 },
  OR: { tokens: [{ text: "OR", tip: "Bitwise OR." }, { text: "R1", tip: "Destination." }, { text: "R2", tip: "First source." }, { text: "R3", tip: "Second source." }], meaning: "R1 = R2 OR R3", note: "Sets a bit when either source has it set.", rd: 1, rs1: 2, rs2: 3, imm: 0 },
  XOR: { tokens: [{ text: "XOR", tip: "Bitwise exclusive OR." }, { text: "R1", tip: "Destination." }, { text: "R2", tip: "First source." }, { text: "R3", tip: "Second source." }], meaning: "R1 = R2 XOR R3", note: "Sets a bit when the sources differ.", rd: 1, rs1: 2, rs2: 3, imm: 0 },
  ADDI: { tokens: [{ text: "ADDI", tip: "Add a constant from the instruction." }, { text: "R1", tip: "Destination." }, { text: "R2", tip: "Source register." }, { text: "5", tip: "Immediate. This is not a memory access." }], meaning: "R1 = R2 + 5", note: "Adds the immediate 5 to R2. The 5 lives in the instruction.", rd: 1, rs1: 2, rs2: 0, imm: 5 },
  LOAD: { tokens: [{ text: "LOAD", tip: "Copy a memory word into a register." }, { text: "R1", tip: "Destination register." }, { text: "0(R2)", tip: "Address = R2 + 0." }], meaning: "R1 = Mem[R2 + 0]", note: "The only way this lab reads data memory.", rd: 1, rs1: 2, rs2: 0, imm: 0 },
  STORE: { tokens: [{ text: "STORE", tip: "Copy a register into memory." }, { text: "R3", tip: "Value to store." }, { text: "0(R2)", tip: "Address = R2 + 0." }], meaning: "Mem[R2 + 0] = R3", note: "Writes memory and does not write a destination register.", rd: 0, rs1: 2, rs2: 3, imm: 0 },
};

const LAYERS = [
  { id: "program", title: "Program", tint: "violet", sub: "(e.g. C, Python, Assembly)", body: "Software is written against an instruction set. The CPU never sees the source language." },
  { id: "isa", title: "Instruction Set Architecture (ISA)", tint: "blue", sub: "Instructions · Registers · Rules (semantics)", body: "The contract: which instructions exist, which registers exist, and what each instruction means." },
  { id: "cpu", title: "CPU Implementation", tint: "green", sub: "RISC-V, ARM, x86 (and many others)", body: "A chip implements that contract. Several chips can implement one ISA." },
];

const FAMILIES = [
  { id: "riscv", name: "RISC-V", kicker: "Open, modern, simple design", body: "A load/store ISA with fixed 32-bit base encodings. Arithmetic stays in registers." },
  { id: "arm", name: "ARM", kicker: "Widely used in mobile and embedded", body: "A RISC-family contract used in phones and microcontrollers. AArch64 instructions are fixed width." },
  { id: "x86", name: "x86", kicker: "Long history, rich features", body: "Variable-length encodings and memory operands in arithmetic. Modern cores often translate them into internal micro-ops." },
];

export function BasicsPanel({ explain }: { explain: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const start = freshMachine();
  const [op, setOp] = useState<TeachOp>("ADD");
  const [regs, setRegs] = useState(start.regs);
  const [mem, setMem] = useState(start.mem);
  const [layer, setLayer] = useState("isa");
  const [family, setFamily] = useState("riscv");
  const [tip, setTip] = useState("Hover a token to see which part of the instruction it is.");
  const [pulse, setPulse] = useState(0);
  const spec = COPY[op];
  const preview = executeTeach({ regs, mem }, op, spec.rd, spec.rs1, spec.rs2, spec.imm);
  const shown = [0, 1, 2, 3].map((index) => ({ index, value: regs[index] ?? 0, next: preview.next.regs[index] ?? 0 }));
  useGSAP(() => {
    if (!pulse || reducedMotion()) return;
    gsap.fromTo(".isx-pop", { scale: 1.06 }, { scale: 1, duration: 0.35, clearProps: "scale" });
  }, { scope: root, dependencies: [pulse] });

  function edit(index: number, text: string) {
    const value = Number(text);
    if (!Number.isFinite(value)) return;
    setRegs((current) => current.map((item, at) => at === index ? Math.trunc(value) : item));
  }

  return (
    <div className="isx-stack" ref={root}>
      <div className="isx-hero">
        <section className="isx-banner">
          <p className="isx-kicker"><Mark kind="book" /> Core concept</p>
          <h2>The instruction set is the contract.</h2>
          <p>The Instruction Set Architecture (ISA) defines the instructions, registers, and legal operations that a CPU understands. It is the interface between software (programs) and the hardware implementation.</p>
        </section>
        <aside className="isx-pull">
          <Mark kind="quote" />
          <p>Same program, different implementation, same ISA.</p>
        </aside>
      </div>
      <section className="isx-card">
        <h2><Mark kind="link" /> How it fits together</h2>
        <p className="isx-lead">Your program is written using an instruction set. A CPU implementation executes those instructions.</p>
        <div className="isx-flow">
          {LAYERS.map((item, index) => (
            <div key={item.id} className="isx-flow-step">
              {index > 0 ? <span className="isx-arrow" aria-hidden="true">→</span> : null}
              <button type="button" className={`isx-layer ${item.tint} ${layer === item.id ? "on" : ""}`} onMouseEnter={() => setLayer(item.id)} onClick={() => setLayer(item.id)}>
                <strong>{item.title}</strong>
                <em>{item.sub}</em>
              </button>
            </div>
          ))}
        </div>
        {explain ? <p className="isx-note">{LAYERS.find((item) => item.id === layer)?.body}</p> : null}
      </section>
      <section className="isx-card">
        <div className="isx-try-head">
          <div>
            <h2><Mark kind="term" /> Try an instruction</h2>
            <p className="isx-lead">Explore what a simple instruction does.</p>
          </div>
          <RunBar
            label=""
            onRun={() => { setRegs(preview.next.regs); setMem(preview.next.mem); setPulse((value) => value + 1); }}
            onReset={() => { const next = freshMachine(); setRegs(next.regs); setMem(next.mem); setOp("ADD"); }}
            extra={<select aria-label="Instruction" value={op} onChange={(event) => setOp(event.target.value as TeachOp)}>{OPS.map((item) => <option key={item}>{item}</option>)}</select>}
          />
        </div>
        <div className="isx-try">
          <CodeBlock lines={[
            <span key="line" onMouseLeave={() => setTip("Hover a token to see which part of the instruction it is.")}>
              {spec.tokens.map((token, index) => (
                <span key={token.text}>{index === 0 ? "" : index === 1 ? " " : ", "}<button type="button" className="isx-token" title={token.tip} onMouseEnter={() => setTip(token.tip)} onFocus={() => setTip(token.tip)}>{token.text}</button></span>
              ))}
            </span>,
          ]} />
          <div className="isx-mean">
            <h3><Mark kind="bulb" /> What it means</h3>
            <p className="mono">{spec.meaning}</p>
            <p>{spec.note}</p>
            {explain ? <p className="isx-tip">{tip}</p> : null}
          </div>
          <div className="isx-regs">
            <h3>Registers (example values)</h3>
            {shown.filter((row) => row.index > 0).map((row) => (
              <label key={row.index}>R{row.index}
                <input aria-label={`R${row.index}`} value={row.value} onChange={(event) => edit(row.index, event.target.value)} />
              </label>
            ))}
            <p className={`isx-after ${pulse ? "isx-pop" : ""}`}>After execution: <strong>{op === "STORE" ? `Mem[${preview.address}] = ${preview.value}` : `R${spec.rd} = ${preview.value}`}</strong></p>
            {op === "LOAD" || op === "STORE" ? <p className="tiny">Mem[{preview.address ?? 0}] is {mem[preview.address ?? 0] ?? 0}. Edit it: <input aria-label="Memory cell" className="isx-mini" value={mem[preview.address ?? 0] ?? 0} onChange={(event) => { const address = preview.address ?? 0; const value = Number(event.target.value); if (Number.isFinite(value)) setMem((current) => ({ ...current, [address]: Math.trunc(value) })); }} /></p> : null}
          </div>
        </div>
      </section>
      <div className="isx-split">
        <WhatChanged hidden={!explain} items={[
          { title: "What changed?", body: op === "STORE" ? "A memory word was updated from a register." : `${op} wrote its result.` },
          { title: "Why?", body: spec.note },
          { title: "Notice", body: "Hover a token to see which field it owns. Anatomy shows those fields as bits." },
        ]} />
        <section className="isx-card">
          <h2>Different ISAs, same idea</h2>
          <p className="isx-lead">RISC-V, ARM, and x86 are different ISA families. They have different instructions and formats, but they define a contract between software and the CPU.</p>
          <div className="isx-fams">
            {FAMILIES.map((item) => (
              <button key={item.id} type="button" className={family === item.id ? "on" : ""} onClick={() => setFamily(item.id)}>
                <strong>{item.name}</strong>
                <span>{item.kicker}</span>
              </button>
            ))}
          </div>
          {explain ? <p className="isx-note">{FAMILIES.find((item) => item.id === family)?.body}</p> : null}
        </section>
      </div>
    </div>
  );
}
