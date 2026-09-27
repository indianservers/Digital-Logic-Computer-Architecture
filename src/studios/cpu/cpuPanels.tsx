import { useEffect, useMemo, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { reducedMotion } from "../aca/animation/acaMotion";
import {
  applyAlu,
  captureBus,
  executeAlu,
  freshClock,
  parseWord,
  presetRegisters,
  rotateLeftBits,
  rotateRightBits,
  shiftLeftBits,
  shiftRightArithmeticBits,
  shiftRightLogicalBits,
  signExtendBits,
  stepClock,
  toBinary,
  toHex,
  toSigned,
  writeRegister,
  zeroExtendBits,
  type AluOp,
  type BlockCpu,
  type ClockMachine,
  type ExtendOp,
} from "../../engines/cpu/blocksLab";

const BLOCKS = ["PC", "IR", "MAR", "MDR", "Registers", "ALU", "Control"] as const;
const BLOCK_COPY: Record<string, { title: string; purpose: string; inputs: string[]; outputs: string[] }> = {
  PC: { title: "Program Counter", purpose: "Holds the address of the next instruction word.", inputs: ["Increment (from control unit)", "A loaded address (e.g. branch target)"], outputs: ["Address toward MAR (on internal bus)"] },
  IR: { title: "Instruction Register", purpose: "Holds the instruction word after it is captured from MDR.", inputs: ["The word on the bus when IR is the destination"], outputs: ["The held word. Decode happens in the Fetch-Decode-Execute studio."] },
  MAR: { title: "Memory Address Register", purpose: "Holds the address presented to memory.", inputs: ["An address from PC or the bus"], outputs: ["Address toward memory"] },
  MDR: { title: "Memory Data Register", purpose: "Holds the data word between memory and the CPU.", inputs: ["A word from memory or from the bus"], outputs: ["Data toward IR, the register file, or memory"] },
  Registers: { title: "Register File", purpose: "Eight general-purpose registers with two read ports and one write port.", inputs: ["Read addresses", "Write address and write data"], outputs: ["Read data A and B"] },
  ALU: { title: "Arithmetic & Logic", purpose: "Computes pass, add, subtract, and bitwise operations.", inputs: ["Operand A", "Operand B"], outputs: ["Result and flags Z, N, C, V"] },
  Control: { title: "Control Unit", purpose: "Names the signals that steer the datapath. This lab asserts them by hand.", inputs: ["The selected source and destination"], outputs: ["REG_OUT, ALU_A_IN, MAR_LOAD, MDR_LOAD, REG_WRITE, PC_OUT"] },
};

function Explain({ explain, what, why, notice }: { explain: boolean; what: string; why: string; notice: string }) {
  if (!explain) return null;
  return (
    <div className="cpx-explain">
      <p><strong>What changed</strong> {what}</p>
      <p><strong>Why</strong> {why}</p>
      <p><strong>Notice</strong> {notice}</p>
    </div>
  );
}

export function OverviewPanel({ explain, cpu, onReset }: { explain: boolean; cpu: BlockCpu; onReset: () => void }) {
  const [selected, setSelected] = useState("PC");
  const [pulse, setPulse] = useState(0);
  const copy = BLOCK_COPY[selected] ?? BLOCK_COPY.PC;
  const live = selected === "PC" ? toHex(cpu.pc) : selected === "IR" ? toHex(cpu.ir) : selected === "MAR" ? toHex(cpu.mar) : selected === "MDR" ? toHex(cpu.mdr) : selected === "Registers" ? `R0 ${toHex(cpu.regs[0] ?? 0)}` : selected === "ALU" ? `Z${cpu.z} N${cpu.n} C${cpu.c} V${cpu.v}` : "PC_OUT, MAR_LOAD";
  useGSAP(() => {
    if (reducedMotion() || pulse === 0) return;
    gsap.fromTo(".cpx-block.on", { scale: 1 }, { scale: 1.04, yoyo: true, repeat: 1, duration: 0.18 });
  }, [pulse, selected]);
  return (
    <div>
      <section className="cpx-intro"><h2>CPU blocks</h2><p>PC, IR, MAR, MDR, the register file, ALU, and control are named boxes that a later fetch–decode–execute loop will use. This studio does not run a program; it lets you inspect each box.</p></section>
      <Explain explain={explain} what={`${selected} selected. ${copy?.purpose ?? ""}`} why="Each box stores or transforms one kind of value. Control only chooses the route." notice="Nothing here fetches or decodes an instruction stream." />
      <div className="cpx-split">
        <section className="cpx-card">
          <header className="cpx-card-head"><h2>CPU core</h2><button type="button" onClick={onReset}>Reset values</button></header>
          <div className="cpx-core" aria-label="CPU core diagram">
            {BLOCKS.slice(0, 4).map((name) => (
              <button key={name} type="button" className={`cpx-block ${name.toLowerCase()} ${selected === name ? "on" : ""}`} onClick={() => { setSelected(name); setPulse((value) => value + 1); }}>
                <strong>{name}</strong><span>{BLOCK_COPY[name]?.title}</span>
              </button>
            ))}
            {BLOCKS.slice(4).map((name) => (
              <button key={name} type="button" className={`cpx-block ${name.toLowerCase()} ${selected === name ? "on" : ""}`} onClick={() => { setSelected(name); setPulse((value) => value + 1); }}>
                <strong>{name}</strong><span>{BLOCK_COPY[name]?.title}</span>
              </button>
            ))}
            <div className="cpx-busbar">Internal bus<span>Carries data, addresses and control signals</span></div>
          </div>
        </section>
        <section className="cpx-card">
          <header className="cpx-card-head"><h2>{selected} · {copy?.title}</h2></header>
          <p>{copy?.purpose}</p>
          <p className="cpx-label">Inputs</p>
          <ul>{copy?.inputs.map((item) => <li key={item}>{item}</li>)}</ul>
          <p className="cpx-label">Outputs</p>
          <ul>{copy?.outputs.map((item) => <li key={item}>{item}</li>)}</ul>
          <p className="cpx-label">Live value</p>
          <div className="cpx-live"><span>{selected}</span><strong>{live}</strong></div>
          <button type="button" className="cpx-link" onClick={() => setPulse((value) => value + 1)}>Show output</button>
        </section>
      </div>
    </div>
  );
}

export function RegisterPanel({ explain, cpu, onCpu }: { explain: boolean; cpu: BlockCpu; onCpu: (cpu: BlockCpu) => void }) {
  const [index, setIndex] = useState(0);
  const [radix, setRadix] = useState<"hex" | "dec" | "bin">("hex");
  const [draft, setDraft] = useState("0x00000000");
  const [error, setError] = useState("");
  const [portA, setPortA] = useState(0);
  const [portB, setPortB] = useState(1);
  const value = cpu.regs[index] ?? 0;
  const specials = [
    ["PC", cpu.pc, "Program Counter (next instruction address)"],
    ["IR", cpu.ir, "Instruction Register (current instruction)"],
    ["SP", cpu.sp, "Stack Pointer (top of stack)"],
    ["FLAGS", (cpu.z) | (cpu.n << 1) | (cpu.c << 2) | (cpu.v << 3), "Status flags (Z, N, C, V)"],
  ] as const;
  function apply() {
    const parsed = parseWord(draft, radix);
    if (!parsed.ok) { setError(parsed.error); return; }
    setError("");
    onCpu(writeRegister(cpu, index, parsed.value));
  }
  return (
    <div>
      <section className="cpx-intro"><h2>Registers</h2><p>General-purpose registers (R0–R7) hold data that instructions operate on. Special-purpose registers like the Program Counter (PC), Instruction Register (IR), Stack Pointer (SP), and Flags register have dedicated roles.</p></section>
      <Explain explain={explain} what={`R${index} is selected. Its value is ${toHex(value)}.`} why="Registers are fast storage inside the CPU. Later tabs read these same eight values." notice="Hex, decimal, and binary are three views of one 32-bit pattern." />
      <div className="cpx-reg-grid">
        <section className="cpx-card">
          <header className="cpx-card-head">
            <h2>Register File</h2>
            <div className="cpx-tools">
              <select aria-label="Load preset" defaultValue="" onChange={(event) => { const kind = event.target.value as "zero" | "ones" | "inc" | "pow" | "pattern" | "seed"; if (kind) onCpu({ ...cpu, regs: presetRegisters(kind, 1) }); event.target.value = ""; }}>
                <option value="">Load Preset</option>
                <option value="zero">Zero</option>
                <option value="ones">Ones</option>
                <option value="inc">Incrementing</option>
                <option value="pow">Powers of two</option>
                <option value="pattern">Bit pattern</option>
                <option value="seed">Random seeded</option>
              </select>
              <button type="button" onClick={() => onCpu({ ...cpu, regs: presetRegisters("seed", 1) })}>Randomize</button>
              <button type="button" onClick={() => onCpu({ ...cpu, regs: presetRegisters("zero") })}>Clear</button>
              <button type="button" onClick={() => onCpu(writeRegister(cpu, index, (value + 1) >>> 0))}>Step</button>
              <button type="button" onClick={() => onCpu({ ...cpu, regs: presetRegisters("zero"), pc: 4, ir: 0, mar: 0, mdr: 0, sp: 0, z: 1, n: 0, c: 0, v: 0 })}>Reset Values</button>
            </div>
          </header>
          <div className="cpx-table-wrap">
            <table className="cpx-table">
              <thead><tr><th>Name</th><th>Hex Value</th><th>Decimal Value</th><th>Binary (32-bit)</th><th>Role</th></tr></thead>
              <tbody>
                {cpu.regs.map((item, row) => (
                  <tr key={row} className={row === index ? "on" : ""} onClick={() => { setIndex(row); setDraft(toHex(item)); setRadix("hex"); }}>
                    <td>R{row}</td><td>{toHex(item)}</td><td>{item}</td><td className="mono">{toBinary(item).replace(/(.{4})/g, "$1 ").trim()}</td><td>General purpose</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h3>Special-Purpose Registers</h3>
          <table className="cpx-table">
            <thead><tr><th>Name</th><th>Hex Value</th><th>Decimal Value</th><th>Role</th></tr></thead>
            <tbody>{specials.map(([name, item, role]) => <tr key={name}><td>{name}</td><td>{toHex(item)}</td><td>{item}</td><td>{role}</td></tr>)}</tbody>
          </table>
        </section>
        <div className="cpx-stack">
          <section className="cpx-card">
            <h2>Register Inspector</h2>
            <p>Selected register <strong>R{index}</strong></p>
            <p>General-purpose register</p>
            <p>Current value {toHex(value)} = {value} (dec)</p>
            <p>Bit width <strong>32 bits</strong></p>
            <div className="cpx-seg" role="group" aria-label="Edit radix">
              {(["hex", "dec", "bin"] as const).map((item) => <button key={item} type="button" className={radix === item ? "on" : ""} onClick={() => setRadix(item)}>{item === "hex" ? "Hex" : item === "dec" ? "Decimal" : "Binary"}</button>)}
            </div>
            <label>Edit value<input aria-label="Register value" value={draft} onChange={(event) => setDraft(event.target.value)} /></label>
            {error ? <p role="alert">{error}</p> : null}
            <button type="button" className="primary" onClick={apply}>Apply</button>
            <div className="cpx-bits" aria-label="Selected register bits">
              {toBinary(value).split("").map((bit, bitIndex) => <span key={bitIndex} title={`bit ${31 - bitIndex} = ${bit}`} className={bit === "1" ? "set" : ""}>{bit}</span>)}
            </div>
          </section>
          <section className="cpx-card">
            <h2>Register File Diagram</h2>
            <label>Read port A<select aria-label="Read port A" value={portA} onChange={(event) => setPortA(Number(event.target.value))}>{cpu.regs.map((_, row) => <option key={row} value={row}>R{row}</option>)}</select></label>
            <label>Read port B<select aria-label="Read port B" value={portB} onChange={(event) => setPortB(Number(event.target.value))}>{cpu.regs.map((_, row) => <option key={row} value={row}>R{row}</option>)}</select></label>
            <p>A = {toHex(cpu.regs[portA] ?? 0)} · B = {toHex(cpu.regs[portB] ?? 0)}</p>
          </section>
        </div>
      </div>
    </div>
  );
}

export function DatapathPanel({ explain, cpu, onCpu }: { explain: boolean; cpu: BlockCpu; onCpu: (cpu: BlockCpu) => void }) {
  const [srcA, setSrcA] = useState(1);
  const [srcB, setSrcB] = useState(2);
  const [op, setOp] = useState<AluOp>("add");
  const [dest, setDest] = useState(3);
  const [stage, setStage] = useState(0);
  const [wrote, setWrote] = useState(false);
  const a = cpu.regs[srcA] ?? 0;
  const b = cpu.regs[srcB] ?? 0;
  const preview = useMemo(() => executeAlu(op, a, b), [op, a, b]);
  const stages = [`Read R${srcA}`, `Read R${srcB}`, op === "add" ? "ALU Add" : `ALU ${op}`, `Write R${dest}`];
  function commit(nextStage: number) {
    setStage(nextStage);
    if (nextStage === 3 && !wrote) {
      onCpu(applyAlu(cpu, op, a, b, dest).cpu);
      setWrote(true);
    }
  }
  return (
    <div>
      <section className="cpx-intro"><h2>Datapath</h2><p>The CPU datapath routes operands and results between the PC, register file, ALU, and memory interface. This page moves the values you stored in Registers. It does not fetch a program.</p></section>
      <Explain explain={explain} what={stage < 3 ? `Stage ${stage + 1}: ${stages[stage]}. The result is ${toHex(preview.result)}, and R${dest} is still ${toHex(cpu.regs[dest] ?? 0)}.` : `Write-back stored ${toHex(preview.result)} in R${dest}.`} why="The ALU result exists as soon as both operands are known. A register changes only when REG_WRITE captures it." notice="Flags Z N C V update with the operation. They are the same flags the Registers tab shows." />
      <section className="cpx-card">
        <h2>Datapath controls</h2>
        <div className="cpx-controls">
          <label>Source A<select aria-label="Source A" value={srcA} onChange={(event) => { setSrcA(Number(event.target.value)); setWrote(false); setStage(0); }}>{cpu.regs.map((_, row) => <option key={row} value={row}>R{row} ({toHex(cpu.regs[row] ?? 0)})</option>)}</select></label>
          <label>Source B<select aria-label="Source B" value={srcB} onChange={(event) => { setSrcB(Number(event.target.value)); setWrote(false); setStage(0); }}>{cpu.regs.map((_, row) => <option key={row} value={row}>R{row} ({toHex(cpu.regs[row] ?? 0)})</option>)}</select></label>
          <label>ALU operation<select aria-label="ALU operation" value={op} onChange={(event) => { setOp(event.target.value as AluOp); setWrote(false); setStage(0); }}>
            <option value="pass">Pass A</option><option value="add">ADD</option><option value="sub">SUB</option><option value="and">AND</option><option value="or">OR</option><option value="xor">XOR</option>
          </select></label>
          <label>Destination<select aria-label="Destination register" value={dest} onChange={(event) => { setDest(Number(event.target.value)); setWrote(false); setStage(0); }}>{cpu.regs.map((_, row) => <option key={row} value={row}>R{row}</option>)}</select></label>
          <button type="button" className="primary" onClick={() => commit(Math.min(3, stage + 1))}>Step transfer</button>
          <button type="button" onClick={() => { commit(3); }}>Animate path</button>
          <button type="button" onClick={() => { setStage(0); setWrote(false); }}>Reset</button>
        </div>
        <div className="cpx-path" data-stage={stage}>
          <span className={stage >= 0 ? "hot" : ""}>R{srcA} {toHex(a)}</span>
          <span>→</span>
          <span className={stage >= 1 ? "hot" : ""}>R{srcB} {toHex(b)}</span>
          <span>→</span>
          <span className={stage >= 2 ? "hot" : ""}>ALU {toHex(preview.result)}</span>
          <span>→</span>
          <span className={stage >= 3 ? "hot" : ""}>R{dest}</span>
        </div>
        <p>Operand A {toHex(a)} · Operand B {toHex(b)} · ALU result {toHex(preview.result)} · Flags Z{preview.z} N{preview.n} C{preview.c} V{preview.v}</p>
        <p>Signals: REG_OUT · ALU_A_IN · ALU_B_IN{stage === 3 ? " · REG_WRITE" : ""}</p>
        <p>PC {toHex(cpu.pc)} · MAR {toHex(cpu.mar)} · MDR {toHex(cpu.mdr)} · IR {toHex(cpu.ir)}</p>
      </section>
      <ol className="cpx-seq">{stages.map((item, itemIndex) => <li key={item}><button type="button" className={stage === itemIndex ? "on" : ""} onClick={() => commit(itemIndex)}>{itemIndex + 1}. {item}</button></li>)}</ol>
    </div>
  );
}

const BUS_UNITS = ["PC", "IR", "MAR", "MDR", "Registers", "ALU"] as const;

export function BusPanel({ explain, cpu, onCpu }: { explain: boolean; cpu: BlockCpu; onCpu: (cpu: BlockCpu) => void }) {
  const [source, setSource] = useState("Registers");
  const [dest, setDest] = useState("MDR");
  const [reg, setReg] = useState(3);
  const [second, setSecond] = useState(false);
  const [log, setLog] = useState<string[]>(["Reset · Bus cleared"]);
  const [status, setStatus] = useState("Idle");
  const [shown, setShown] = useState("Z");
  function valueOf(name: string): number {
    if (name === "PC") return cpu.pc;
    if (name === "IR") return cpu.ir;
    if (name === "MAR") return cpu.mar;
    if (name === "MDR") return cpu.mdr;
    if (name === "ALU") return cpu.regs[0] ?? 0;
    return cpu.regs[reg] ?? 0;
  }
  function step() {
    if (source === dest) { setStatus("Source and destination are the same."); return; }
    const drivers = BUS_UNITS.map((name) => ({ name, enabled: name === source || (second && name === "PC" && source !== "PC"), value: valueOf(name) }));
    const bus = captureBus(drivers);
    const word = bus.value;
    if (word === "Z") { setShown("Z"); setStatus("No source is driving. The bus floats at Z."); return; }
    if (typeof word !== "number" || bus.contention) { setShown("X"); setStatus("BUS CONFLICT. The destination was not changed."); setLog((rows) => [`Conflict · ${source} and PC`, ...rows].slice(0, 8)); return; }
    let next = cpu;
    if (dest === "PC") next = { ...cpu, pc: word };
    else if (dest === "IR") next = { ...cpu, ir: word };
    else if (dest === "MAR") next = { ...cpu, mar: word };
    else if (dest === "MDR") next = { ...cpu, mdr: word };
    else if (dest === "Registers") next = writeRegister(cpu, reg, word);
    onCpu(next);
    setShown(toHex(word));
    setStatus("Transfer complete");
    setLog((rows) => [`${source} → ${dest} (${toHex(word)})`, ...rows].slice(0, 8));
  }
  return (
    <div>
      <section className="cpx-intro"><h2>Internal Bus</h2><p>The internal bus carries addresses and data between CPU blocks. Only one block may drive it. This lab uses the same tri-state rule as the shared-bus engine.</p></section>
      <Explain explain={explain} what={status} why="A shared wire can hold one value. A second driver makes the value unknown." notice="The destination keeps its old value when the bus is Z or X." />
      <section className="cpx-card">
        <div className="cpx-bus-row">
          {BUS_UNITS.map((name) => <div key={name} className={`cpx-block ${name === source ? "drive" : ""} ${name === dest ? "listen" : ""}`}><strong>{name}</strong><span>{toHex(valueOf(name))}</span></div>)}
        </div>
        <div className="cpx-busbar">Internal bus · {shown}</div>
      </section>
      <section className="cpx-card">
        <div className="cpx-controls">
          <label>Source<select aria-label="Bus source" value={source} onChange={(event) => setSource(event.target.value)}>{BUS_UNITS.map((name) => <option key={name}>{name}</option>)}</select></label>
          <label>Register<select aria-label="Register on the bus" value={reg} onChange={(event) => setReg(Number(event.target.value))}>{cpu.regs.map((_, row) => <option key={row} value={row}>R{row}</option>)}</select></label>
          <label>Destination<select aria-label="Bus destination" value={dest} onChange={(event) => setDest(event.target.value)}>{BUS_UNITS.map((name) => <option key={name}>{name}</option>)}</select></label>
          <label className="cpx-check"><input type="checkbox" checked={second} onChange={(event) => setSecond(event.target.checked)} /> Second driver (PC)</label>
          <button type="button" className="primary" onClick={step}>Step</button>
          <button type="button" onClick={() => { setShown("Z"); setStatus("Bus cleared"); setSecond(false); setLog((rows) => ["Reset · Bus cleared", ...rows].slice(0, 8)); }}>Reset</button>
        </div>
        <p role="status">Status: {status}</p>
        <table className="cpx-table"><thead><tr><th>#</th><th>Operation</th></tr></thead><tbody>{log.map((row, rowIndex) => <tr key={`${row}-${rowIndex}`}><td>{log.length - rowIndex}</td><td>{row}</td></tr>)}</tbody></table>
      </section>
    </div>
  );
}

export function ExtendPanel({ explain }: { explain: boolean }) {
  const [text, setText] = useState("1010");
  const [inputWidth, setInputWidth] = useState(4);
  const [outputWidth, setOutputWidth] = useState(8);
  const [amount, setAmount] = useState(2);
  const [op, setOp] = useState<ExtendOp>("sign");
  const parsed = /^[01]+$/.test(text) ? Number.parseInt(text, 2) : 0;
  const widthError = (op === "sign" || op === "zero") && outputWidth < inputWidth;
  const computed = useMemo(() => {
    if (widthError) return { result: 0, shiftedOut: 0 };
    if (op === "sign") return { result: signExtendBits(parsed, inputWidth, outputWidth), shiftedOut: 0 };
    if (op === "zero") return { result: zeroExtendBits(parsed, inputWidth, outputWidth), shiftedOut: 0 };
    if (op === "shl") return shiftLeftBits(parsed, inputWidth, amount);
    if (op === "shr") return shiftRightLogicalBits(parsed, inputWidth, amount);
    if (op === "sar") return shiftRightArithmeticBits(parsed, inputWidth, amount);
    if (op === "ror") return { result: rotateRightBits(parsed, inputWidth, amount), shiftedOut: 0 };
    return { result: rotateLeftBits(parsed, inputWidth, amount), shiftedOut: 0 };
  }, [op, parsed, inputWidth, outputWidth, amount, widthError]);
  const shownWidth = op === "sign" || op === "zero" ? outputWidth : inputWidth;
  const bits = toBinary(computed.result, shownWidth);
  const inputBits = toBinary(parsed, inputWidth);
  return (
    <div>
      <section className="cpx-intro"><h2>Extend / Shift</h2><p>See how a narrow field is widened and how bits move. Sign extension copies the sign bit. Zero extension fills with 0. Shifts and rotates stay inside the input width.</p></section>
      <Explain explain={explain} what={`${op} of ${inputBits} is ${bits}.`} why={op === "sign" ? "The new high bits copy the sign so the signed value stays the same." : op === "zero" ? "The new high bits are 0, so the unsigned value stays the same." : "Bits that leave one end are discarded or wrapped. The vacated side is filled."} notice="The signed and unsigned readings below are the same bits." />
      <section className="cpx-card">
        <div className="cpx-controls">
          <label>Input value<input aria-label="Input bits" value={text} onChange={(event) => setText(event.target.value.replace(/[^01]/g, "").slice(0, 16))} /></label>
          <label>Input width<select aria-label="Input width" value={inputWidth} onChange={(event) => setInputWidth(Number(event.target.value))}>{[4, 8, 12, 16].map((item) => <option key={item} value={item}>{item} bits</option>)}</select></label>
          <label>Output width<select aria-label="Output width" value={outputWidth} onChange={(event) => setOutputWidth(Number(event.target.value))}>{[8, 16, 32].map((item) => <option key={item} value={item}>{item} bits</option>)}</select></label>
          <label>Shift amount<select aria-label="Shift amount" value={amount} onChange={(event) => setAmount(Number(event.target.value))}>{Array.from({ length: inputWidth }, (_, item) => <option key={item} value={item}>{item}</option>)}</select></label>
        </div>
        <div className="cpx-ops">
          {([["sign", "Sign Extend"], ["zero", "Zero Extend"], ["shl", "Shift Left"], ["shr", "Shift Right Logical"], ["sar", "Shift Right Arithmetic"], ["rol", "Rotate Left"], ["ror", "Rotate Right"]] as const).map(([id, label]) => (
            <button key={id} type="button" className={op === id ? "on" : ""} onClick={() => setOp(id)}>{label}</button>
          ))}
        </div>
        {widthError ? <p role="alert">Output width must be at least the input width for an extension.</p> : null}
        <div className="cpx-bits" aria-label="Input bits">{inputBits.split("").map((bit, bitIndex) => <span key={`in-${bitIndex}`} className={bit === "1" ? "set" : ""}>{bit}</span>)}</div>
        <div className="cpx-bits out" aria-label="Output bits">{bits.split("").map((bit, bitIndex) => <span key={`out-${bitIndex}`} className={bit === "1" ? "set" : ""}>{bit}</span>)}</div>
        <p>Hex {toHex(computed.result, Math.ceil(shownWidth / 4))} · Signed {toSigned(computed.result, shownWidth)} · Unsigned {computed.result} · Shifted out {computed.shiftedOut}</p>
        <p className="mono">{op === "sign" ? "out = {{(N−M){in[M−1]}}, in[M−1:0]}" : "Bits move by the shift amount. Vacated positions are filled or wrapped."}</p>
      </section>
    </div>
  );
}

export function ClockPanel({ explain }: { explain: boolean }) {
  const [machine, setMachine] = useState<ClockMachine>(freshClock);
  const [data, setData] = useState(5);
  const [rows, setRows] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  function step() {
    const next = stepClock(machine, data, machine.enable);
    setMachine(next.machine);
    setRows((current) => [`Cycle ${next.machine.cycle} · ${next.edge ?? "—"} · enable ${next.machine.enable ? 1 : 0} · data ${toHex(data, 1)} · Q ${toHex(next.machine.q, 1)} · ${next.event}`, ...current].slice(0, 10));
  }
  useEffect(() => {
    if (!running) return undefined;
    const timer = window.setInterval(() => {
      setMachine((current) => {
        const next = stepClock(current, data, current.enable);
        setRows((rows) => [`Cycle ${next.machine.cycle} · ${next.edge ?? "—"} · Q ${toHex(next.machine.q, 1)} · ${next.event}`, ...rows].slice(0, 10));
        return next.machine;
      });
    }, 700);
    return () => window.clearInterval(timer);
  }, [running, data]);
  const wave = Array.from({ length: 18 }, (_, index) => {
    const high = index % 2 === 1;
    const x = 12 + index * 16;
    return `${index === 0 ? "M" : "L"} ${x} ${high ? 18 : 42}`;
  }).join(" ");
  return (
    <div>
      <section className="cpx-intro"><h2>Clocking</h2><p>Registers sample Data In only on the edge you select, and only when Enable is high. Changing Data In between edges leaves Q where it is. The frequency control is animation speed, not a real CPU clock.</p></section>
      <Explain explain={explain} what={`Q is ${toHex(machine.q, 1)}. The clock level is ${machine.level ? "high" : "low"}.`} why={machine.mode === "rising" ? "Rising-edge mode captures when the clock goes from low to high." : "Falling-edge mode captures when the clock goes from high to low."} notice="Enable low blocks the capture even when the edge arrives." />
      <section className="cpx-card">
        <h2>Timing diagram</h2>
        <svg className="cpx-wave" viewBox="0 0 320 70" role="img" aria-label="Clock waveform">
          <path d={wave} fill="none" stroke="#2f6fed" strokeWidth="2" />
          <text x="8" y="64" fontSize="10">CLK · cycle {machine.cycle} · level {machine.level}</text>
        </svg>
      </section>
      <section className="cpx-card">
        <div className="cpx-controls">
          <label>Data In<input aria-label="Data in" type="number" min={0} max={255} value={data} onChange={(event) => setData(Number(event.target.value) || 0)} /></label>
          <label>Edge<select aria-label="Clock edge" value={machine.mode} onChange={(event) => setMachine({ ...machine, mode: event.target.value === "falling" ? "falling" : "rising" })}><option value="rising">Rising</option><option value="falling">Falling</option></select></label>
          <label className="cpx-check"><input type="checkbox" checked={machine.enable} onChange={(event) => setMachine({ ...machine, enable: event.target.checked })} /> Enable</label>
          <button type="button" className="primary" onClick={() => setRunning(true)}>Run</button>
          <button type="button" onClick={step}>Step</button>
          <button type="button" onClick={() => setRunning(false)}>Pause</button>
          <button type="button" onClick={() => { setRunning(false); setMachine(freshClock()); setRows([]); }}>Reset</button>
        </div>
        <p role="status">Cycle {machine.cycle} · CLK {machine.level} · Enable {machine.enable ? 1 : 0} · Data In {toHex(data, 1)} · Register Q {toHex(machine.q, 1)}</p>
        <ul className="cpx-log">{rows.map((row) => <li key={row}>{row}</li>)}</ul>
      </section>
    </div>
  );
}
