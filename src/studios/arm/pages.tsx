import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Theory } from "../../design-system/ui";
import {
  armPipe, assembleA64, blankA64, decodeA64, encodeAddReg, encodeB, encodeBl, encodeLdr, encodeStr, eret, loadA64, neonAdd, stepA64, triggerSvc, writeWn, writeXn, xName,
  type A64Cpu,
} from "../../engines/isaarch/arm";

export interface ArmApi {
  cpu: A64Cpu;
  setCpu: (cpu: A64Cpu) => void;
  source: string;
  setSource: (value: string) => void;
  sel: number;
  setSel: (index: number) => void;
  status: string;
  setStatus: (value: string) => void;
}

const SAMPLE = `ADD X0, X1, X2
ADDS X3, X0, X0
LDR X4, [X1, #0]
B skip
ADD X5, X5, X5
skip:
BL done
done:
RET`;

function hex64(value: bigint): string {
  return `0x${value.toString(16).padStart(16, "0")}`;
}

function Notes({ title, items }: { title: string; items: Array<[string, string]> }) {
  return (
    <section className="rvx-card">
      <h3>{title}</h3>
      <div className="arm-notes">
        {items.map(([heading, body]) => (
          <div key={heading}><b>{heading}</b><span>{body}</span></div>
        ))}
      </div>
    </section>
  );
}

function abiOf(index: number): { role: string; note: string } {
  if (index >= 31) return { role: "Stack pointer", note: "SP is not one of X0–X30. The AAPCS64 keeps it 16-byte aligned." };
  if (index === 30) return { role: "Link register", note: "BL stores the return address in X30. RET copies X30 back to the PC." };
  if (index === 29) return { role: "Frame pointer", note: "X29 usually anchors the current stack frame and is callee-saved." };
  if (index <= 7) return { role: "Argument / result", note: "X0–X7 pass arguments and return small results. The caller may reuse them after a call." };
  if (index === 8) return { role: "Indirect result", note: "X8 holds the address when a function returns a large structure." };
  if (index <= 15) return { role: "Caller-saved temporary", note: "X9–X15 are scratch registers. A call does not have to preserve them." };
  if (index <= 17) return { role: "Linker temporary", note: "X16 and X17 are used for veneers and are not preserved across calls." };
  if (index === 18) return { role: "Platform register", note: "X18 is reserved by the platform, often as a thread-local pointer." };
  return { role: "Callee-saved", note: "X19–X28 must be saved and restored by any function that uses them." };
}

const FLOW = [
  ["fetch", "Fetch", "Instruction memory returns one 32-bit A64 word."],
  ["decode", "Decode", "Fields name the registers, immediate, and opcode."],
  ["regs", "Register File", "31 X registers. W names are the low 32 bits."],
  ["alu", "ALU", "ADD, SUB, and flag-setting ADDS happen here."],
  ["mem", "Memory", "Only LDR and STR touch data memory."],
  ["wb", "WB", "The result is written back to Xd, or X30 on BL."],
];

const LABS = [
  { id: "registers", tone: "c1", title: "Registers & Modes", blurb: "X and W views, SP, PC, NZCV, and EL0–EL3", icon: "/icons/arm-registers.png" },
  { id: "instruction-set", tone: "c2", title: "Instruction Set", blurb: "32-bit fields for ADD, LDR, B, and NEON", icon: "/icons/arm-encoding.png" },
  { id: "assembler", tone: "c3", title: "Assembler", blurb: "Write A64, assemble it, then step or run", icon: "/icons/arm-assembler.png" },
  { id: "datapath", tone: "c4", title: "Datapath", blurb: "Fetch, decode, ALU, memory, and write-back", icon: "/icons/arm-datapath.png" },
  { id: "pipeline", tone: "c5", title: "Pipeline & Hazards", blurb: "IF–WB overlap, forwarding, and stalls", icon: "/icons/arm-pipeline.png" },
  { id: "memory", tone: "c6", title: "Memory & Load/Store", blurb: "LDR, STR, indexing, and alignment", icon: "/icons/arm-memory.png" },
  { id: "exceptions", tone: "c7", title: "Exceptions & Interrupts", blurb: "EL0–EL3, SVC entry, and ERET", icon: "/icons/arm-exceptions.png" },
  { id: "soc", tone: "c8", title: "Cores & SoC", blurb: "Clusters, interconnect, GPU, and NPU", icon: "/icons/arm-soc.png" },
  { id: "practice", tone: "c9", title: "Practice & Quiz", blurb: "Check registers, encodings, and privilege", icon: "/icons/arm-practice.png" },
];

export function OverviewPage({ api }: { api: ArmApi }) {
  const [step, setStep] = useState(0);
  const current = FLOW[step] ?? FLOW[0];
  const x1 = api.cpu.x[1] ?? 0n;
  const x2 = api.cpu.x[2] ?? 0n;
  return (
    <>
      <section className="rvx-card">
        <h3>AArch64 Processor Overview</h3>
        <div className="arm-flow">
          {FLOW.map(([id, label], index) => (
            <button key={id} type="button" className={`arm-box ${id} ${step === index ? "on" : ""}`} onClick={() => setStep(index)}>{label}</button>
          ))}
        </div>
        <p><strong>{current?.[1]}.</strong> {current?.[2]}</p>
        <p>This session has X1 = {x1.toString()} and X2 = {x2.toString()}. <code>ADD X0, X1, X2</code> writes {(x1 + x2).toString()} into X0 and never touches memory.</p>
        <div className="arm-pills"><span>AArch64</span><span>31 X registers</span><span>Load / Store</span><span>EL0–EL3</span></div>
      </section>
      <Notes title="What stays special in AArch64" items={[
        ["Load / store", "ADD and SUB work only on registers. Data memory is reached by LDR and STR."],
        ["Fixed 32-bit words", "Every A64 instruction is 32 bits. The PC steps by 4 unless a branch changes it."],
        ["X and W", "Xn is 64 bits. Wn is the low 32 bits of the same register, and a W write clears the top half."],
        ["NZCV", "ADDS, SUBS, and CMP update N, Z, C, and V in PSTATE. A plain ADD leaves the flags alone."],
        ["Calls", "BL saves the next instruction’s address in X30. RET jumps back to that address."],
        ["Privilege", "EL0 runs applications, EL1 the kernel, EL2 a hypervisor, and EL3 the secure monitor."],
      ]} />
      <section className="rvx-card">
        <h3>Explore the Labs</h3>
        <div className="arm-explore">
          {LABS.map((lab) => (
            <Link key={lab.id} className={`arm-explore-card ${lab.tone}`} to={`/architecture/arm/${lab.id}`}>
              <img src={lab.icon} alt="" />
              <span>
                <strong>{lab.title}</strong>
                <small>{lab.blurb}</small>
              </span>
              <em>Open lab</em>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}

export function RegisterPage({ api }: { api: ArmApi }) {
  const [wide, setWide] = useState(true);
  const value = api.sel < 31 ? (api.cpu.x[api.sel] ?? 0n) : api.sel === 31 ? api.cpu.sp : 0n;
  const shown = wide ? value : (value & 0xffffffffn);
  return (
    <>
      <section className="rvx-card">
        <div className="arm-headrow">
          <h3>AArch64 Register File</h3>
          <div className="rvx-tabs">
            <button type="button" className={wide ? "on" : ""} onClick={() => setWide(true)}>64-bit X view</button>
            <button type="button" className={!wide ? "on" : ""} onClick={() => setWide(false)}>32-bit W view</button>
          </div>
        </div>
        <div className="mips-regs">
          {Array.from({ length: 31 }, (_, index) => (
            <button key={index} type="button" className={`mips-tile ${api.sel === index ? "on" : ""} ${index === 29 || index === 30 ? "ra" : ""}`} onClick={() => api.setSel(index)}>
              <b>{wide ? `X${index}` : `W${index}`}</b>
              <small>{hex64(wide ? (api.cpu.x[index] ?? 0n) : ((api.cpu.x[index] ?? 0n) & 0xffffffffn))}</small>
            </button>
          ))}
        </div>
      </section>
      <section className="rvx-card">
        <h3>Selected: {api.sel < 31 ? xName(api.sel) : "SP"}</h3>
        <div className="mips-detail">
          <div><span>64-bit value</span><b>{hex64(value)}</b></div>
          <div><span>32-bit W view</span><b>0x{(value & 0xffffffffn).toString(16).padStart(8, "0")}</b></div>
          <div><span>ABI role</span><b>{abiOf(api.sel).role}</b></div>
          <div><span>EL context</span><b>EL{api.cpu.el}</b></div>
        </div>
        <label>Value
          <input aria-label="Register value" type="number" value={Number(shown & 0xffffffffn)} onChange={(event) => {
            const next = Number(event.target.value) || 0;
            if (api.sel === 31) api.setCpu({ ...api.cpu, sp: BigInt(next >>> 0) });
            else api.setCpu({ ...api.cpu, x: wide ? writeXn(api.cpu.x, api.sel, BigInt(next)) : writeWn(api.cpu.x, api.sel, next) });
          }} />
        </label>
        <p>{abiOf(api.sel).note}</p>
        <div className="arm-pills">
          {([[0, "X0–X7 args"], [8, "X8 result"], [9, "X9–X15 temps"], [18, "X18 platform"], [19, "X19–X28 saved"], [29, "X29 FP"], [30, "X30 LR"], [31, "SP"]] as const).map(([index, label]) => (
            <button key={label} type="button" onClick={() => api.setSel(index)}>{label}</button>
          ))}
        </div>
        <div className="arm-special">
          <button type="button" onClick={() => api.setSel(31)}><b>SP</b><span>{hex64(api.cpu.sp)}</span></button>
          <div><b>PC</b><span>0x{api.cpu.pc.toString(16)}</span></div>
          <div><b>PSTATE</b><span>N {api.cpu.flags.n} Z {api.cpu.flags.z} C {api.cpu.flags.c} V {api.cpu.flags.v}</span></div>
          <div className="rvx-tabs">{([0, 1, 2, 3] as const).map((level) => <button key={level} type="button" className={api.cpu.el === level ? "on" : ""} onClick={() => api.setCpu({ ...api.cpu, el: level })}>EL{level}</button>)}</div>
        </div>
        <Theory title="W writes zero-extend">A write to W{api.sel < 31 ? api.sel : "n"} replaces the whole X register with the lower 32 bits and zeros the top half. XZR reads as zero and discards writes. PC is not one of the 31 general registers, and each exception level has its own stack pointer.</Theory>
      </section>
      <Notes title="PSTATE and privilege" items={[
        ["N", "Set when the flag-setting result is negative. Conditional branches such as B.LT read it together with V."],
        ["Z", "Set when the result is zero. B.EQ and CBZ both care about a zero result, in different encodings."],
        ["C", "Carry from an unsigned add, or the inverse borrow from a subtract. B.HI uses C and Z."],
        ["V", "Signed overflow. B.GT needs Z clear and N equal to V."],
        ["EL0", "Unprivileged applications. They use SVC to ask the kernel for a service."],
        ["EL1–EL3", "EL1 is the usual kernel. EL2 hosts a hypervisor. EL3 hosts the secure monitor. Changing the button here only selects the view."],
      ]} />
    </>
  );
}

function fieldBits(word: number, hi: number, lo: number): string {
  const width = hi - lo + 1;
  return ((word >>> lo) & ((1 << width) - 1)).toString(2).padStart(width, "0");
}

export function EncodingPage() {
  const [family, setFamily] = useState<"add" | "ldr" | "b" | "simd">("add");
  const [rd, setRd] = useState(2);
  const [rn, setRn] = useState(0);
  const [rm, setRm] = useState(1);
  const [imm, setImm] = useState(0);
  const [asm, setAsm] = useState("ADD X2, X0, X1");
  const [note, setNote] = useState("");
  const [lanes, setLanes] = useState("1,2");
  const word = family === "ldr" ? encodeLdr(rd, rn, imm) : family === "b" ? encodeB(imm) : encodeAddReg(rd, rn, rm);
  const decoded = decodeA64(word);
  const fields = family === "simd" ? [] : family === "add"
    ? [["sf", fieldBits(word, 31, 31), "64-bit operation"], ["op", fieldBits(word, 30, 23), "ADD (shifted register)"], ["shift", fieldBits(word, 22, 21), "LSL"], ["Rm", fieldBits(word, 20, 16), `X${rm}`], ["imm6", fieldBits(word, 15, 10), "0"], ["Rn", fieldBits(word, 9, 5), `X${rn}`], ["Rd", fieldBits(word, 4, 0), `X${rd}`]]
    : family === "ldr"
      ? [["size", fieldBits(word, 31, 30), "64-bit"], ["opc", fieldBits(word, 23, 22), "LDR"], ["imm12", fieldBits(word, 21, 10), `#${imm}`], ["Rn", fieldBits(word, 9, 5), `X${rn}`], ["Rt", fieldBits(word, 4, 0), `X${rd}`]]
      : [["op", fieldBits(word, 31, 26), "B"], ["imm26", fieldBits(word, 25, 0), `${imm} words`]];
  return (
    <>
    <section className="rvx-card">
      <h3>A64 Encoding Explorer</h3>
      <div className="rvx-tabs">
        {([["add", "Data Processing"], ["ldr", "Load / Store"], ["b", "Branch"], ["simd", "SIMD"]] as const).map(([id, label]) => (
          <button key={id} type="button" className={family === id ? "on" : ""} onClick={() => setFamily(id)}>{label}</button>
        ))}
      </div>
      {family === "simd" ? (
        <>
          <p>NEON and SVE add whole vectors. This box adds one lane at a time so the idea is visible: lane 0 never mixes with lane 1. The second vector is each lane plus one.</p>
          <label>Lanes <input aria-label="simd lanes" value={lanes} onChange={(event) => setLanes(event.target.value)} /></label>
          <p>Result [{neonAdd(lanes.split(",").map((item) => Number(item) || 0), lanes.split(",").map((item) => (Number(item) || 0) + 1)).join(", ")}]</p>
        </>
      ) : (
        <>
          <p>Example: <strong>{decoded.text}</strong></p>
          <div className="arm-fields">{fields.map(([name, bits]) => <span key={name}><b>{name}</b><small>{bits}</small></span>)}</div>
          <div className="rvx-grid2">
            <div>
              <h3>Field breakdown</h3>
              {fields.map(([name, bits, meaning]) => <p key={name}><b>{name}</b> {meaning} <code>{bits}</code></p>)}
              <div className="rvx-cols">
                <label>Rd <input aria-label="rd" type="number" min={0} max={30} value={rd} onChange={(event) => setRd(Number(event.target.value) & 31)} /></label>
                <label>Rn <input aria-label="rn" type="number" min={0} max={30} value={rn} onChange={(event) => setRn(Number(event.target.value) & 31)} /></label>
                {family === "add" && <label>Rm <input aria-label="rm" type="number" min={0} max={30} value={rm} onChange={(event) => setRm(Number(event.target.value) & 31)} /></label>}
                {family !== "add" && <label>{family === "b" ? "Word offset" : "Byte offset"} <input aria-label="immediate" type="number" value={imm} onChange={(event) => setImm(Number(event.target.value) || 0)} /></label>}
              </div>
            </div>
            <div>
              <h3>Assembly ↔ machine code</h3>
              <label>Assembly <input aria-label="assembly line" value={asm} onChange={(event) => setAsm(event.target.value)} /></label>
              <p className="arm-hex">0x{word.toString(16).padStart(8, "0").toUpperCase()}</p>
              <button type="button" className="rvx-btn" onClick={() => {
                const built = assembleA64(asm);
                setNote(built.ok ? decodeA64(built.words[0] ?? 0).text : built.errors.join(" "));
              }}>Decode</button>
              <p>{note || "Edit a field and the hex word changes with it."}</p>
            </div>
          </div>
        </>
      )}
    </section>
    <Notes title={family === "add" ? "Data processing" : family === "ldr" ? "Load and store" : family === "b" ? "Branches" : "SIMD"} items={family === "add" ? [
      ["sf", "Bit 31 chooses the 64-bit form. Clear it and the same opcode shape is the 32-bit W form."],
      ["Rd, Rn, Rm", "Rd is the destination. Rn is the first source. Rm is the shifted second source."],
      ["ADDS versus ADD", "The S bit makes the instruction update NZCV. CMP is SUBS with the destination discarded."],
      ["Shift", "The register form can shift Rm before the add. This explorer leaves the shift at LSL #0."],
    ] : family === "ldr" ? [
      ["Size", "A 64-bit LDR uses a size field that means a doubleword. LDRB and LDRH are the byte and halfword forms."],
      ["Scaled immediate", "The 12-bit offset in a 64-bit LDR is scaled by 8, so the byte address is Rn + imm×8."],
      ["Rt and Rn", "Rt receives the loaded value. Rn is the base. The address itself is not written back in the unsigned-offset form."],
      ["STR", "STR uses the same address fields and writes Rt into memory. It does not change Rt."],
    ] : family === "b" ? [
      ["imm26", "B stores a word offset from this instruction. The byte target is PC + offset×4."],
      ["BL", "BL uses the same offset and also writes PC+4 into X30."],
      ["B.cond", "Conditional branches use a shorter immediate and read NZCV. B.NE is taken when Z is clear."],
      ["RET", "RET is not a B. It copies X30 into the PC. The encoding is a fixed hint, 0xD65F03C0."],
    ] : [
      ["Lanes", "A NEON add produces one result per lane. Changing lane 0 does not change lane 1."],
      ["Scalar versus vector", "The ADD word above is scalar A64. A vector ADD lives in the SIMD encoding space."],
      ["Why it exists", "Graphics, audio, and machine-learning kernels repeat the same arithmetic on many values."],
      ["This studio", "The lane box is a teaching adder. It does not assemble a NEON instruction word."],
    ]} />
  </>
  );
}

export function AssemblerPage({ api }: { api: ArmApi }) {
  const built = useMemo(() => assembleA64(api.source), [api.source]);
  const run = (limit: number) => {
    const loaded = loadA64(api.source);
    if ("ok" in loaded) { api.setStatus(loaded.error); return; }
    let cpu = loaded;
    for (let i = 0; i < limit && !cpu.halted; i += 1) cpu = stepA64(cpu);
    api.setCpu(cpu);
    api.setStatus(cpu.halted ? "Halted." : "Stepped.");
  };
  const save = () => { localStorage.setItem("logiclab.arm.asm", api.source); api.setStatus("Saved in this browser."); };
  const load = () => { api.setSource(localStorage.getItem("logiclab.arm.asm") ?? SAMPLE); api.setStatus("Loaded."); };
  return (
    <>
      <div className="rvx-tabs">
        <button type="button" onClick={() => api.setSource(SAMPLE)}>Call and return</button>
        <button type="button" onClick={() => api.setSource("ADDS X0, X1, X2\nCMP X0, X0\n")}>Flags</button>
        <button type="button" onClick={() => api.setSource("ADD X0, X1, X2\nB skip\nADD X5, X5, X5\nskip:\nRET\n")}>Branch skip</button>
        <button type="button" onClick={load}>Load</button>
        <button type="button" onClick={save}>Save</button>
        <button type="button" onClick={() => api.setStatus(built.ok ? "Assembled successfully." : built.errors.join(" "))}>Assemble</button>
        <button type="button" className="rvx-btn" onClick={() => run(80)}>Run</button>
        <button type="button" onClick={() => run(1)}>Step</button>
        <button type="button" onClick={() => { api.setCpu(blankA64()); api.setStatus("Reset."); }}>Reset</button>
      </div>
      <div className="arm-asm">
        <div className="rvx-editor">
          <div className="gutter">{api.source.split("\n").map((_, index) => <span key={index}>{index + 1}</span>)}</div>
          <pre>{api.source || " "}</pre>
          <textarea aria-label="AArch64 source" spellCheck={false} value={api.source} onChange={(event) => api.setSource(event.target.value)} />
        </div>
        <section className="rvx-card">
          <h3>Machine code</h3>
          <pre className="rvx-pre">{built.ok ? built.words.map((word, index) => `0x${(index * 4).toString(16).padStart(8, "0")}  0x${word.toString(16).padStart(8, "0")}  ${built.listing[index] ?? ""}`).join("\n") : built.errors.join("\n")}</pre>
        </section>
        <section className="rvx-card">
          <h3>Registers & flags</h3>
          <pre className="rvx-pre">{[0, 1, 2].map((index) => `X${index}  ${hex64(api.cpu.x[index] ?? 0n)}`).join("\n")}{"\n"}SP  {hex64(api.cpu.sp)}{"\n"}NZCV  {api.cpu.flags.n}{api.cpu.flags.z}{api.cpu.flags.c}{api.cpu.flags.v}</pre>
          <pre className="arm-console">{api.cpu.console.join("\n") || api.cpu.trace.slice(-4).join("\n") || "> ready"}</pre>
        </section>
      </div>
      <section className="rvx-card">
        <h3>Execution state</h3>
        <div className="arm-special">
          <div><b>PC</b><span>0x{api.cpu.pc.toString(16).padStart(8, "0")}</span></div>
          <div><b>Current</b><span>{api.cpu.decoded?.text ?? "—"}</span></div>
          <div><b>Cycles</b><span>{api.cpu.cycles}</span></div>
          <div><b>Retired</b><span>{api.cpu.retired}</span></div>
          <div><b>Status</b><span>{api.status || "Ready"}</span></div>
        </div>
      </section>
      <Notes title="What this assembler really does" items={[
        ["Accepted mnemonics", "ADD, ADDS, SUB, SUBS, CMP, LDR, STR, B, BL, RET, NOP, SVC, and MOV. Anything else is reported on the line that failed."],
        ["Labels", "A label such as skip: is an address, not an instruction. B and BL turn it into a word offset."],
        ["MOV", "MOV Xd, #imm is accepted, but this teaching encoder emits ADD Xd, XZR, XZR and does not apply the immediate."],
        ["Little-endian words", "Each assembled word is stored little-endian. The listing shows the address, the hex word, and the decoded text."],
        ["NZCV", "Run the Flags example. ADDS updates the flags from X1+X2. CMP X0, X0 then sets Z because a value compared with itself is zero."],
        ["BL and RET", "The call example writes the return address into X30 and RET jumps there. The ADD after B skip should stay unexecuted."],
      ]} />
    </>
  );
}

export function DatapathPage({ api }: { api: ArmApi }) {
  const [stage, setStage] = useState(0);
  const decoded = api.cpu.decoded ?? decodeA64(encodeAddReg(0, 1, 2));
  const xn = api.cpu.x[decoded.rn] ?? 0n;
  const xm = api.cpu.x[decoded.rm] ?? 0n;
  const alu = decoded.mnemonic.startsWith("SUB") ? xn - xm : xn + xm;
  const hot = stage < 2 ? "pc" : decoded.mnemonic === "LDR" || decoded.mnemonic === "STR" ? "mem" : "alu";
  const memOn = decoded.mnemonic === "LDR" || decoded.mnemonic === "STR";
  const branch = decoded.mnemonic === "B" || decoded.mnemonic === "BL";
  const journey = [
    ["Fetch", "Read the 32-bit instruction"],
    ["Decode", `Read X${decoded.rn} and X${decoded.rm}`],
    ["Execute", `${decoded.mnemonic} → ${alu.toString()}`],
    ["Memory", memOn ? "Data memory access" : "No access"],
    ["Write Back", branch ? "Update PC" : `X${decoded.rd} ← result`],
  ];
  return (
    <>
    <section className="rvx-card">
      <div className="arm-headrow">
        <h3>Interactive datapath — {decoded.text}</h3>
        <div className="rvx-tabs">
          {[encodeAddReg(2, 0, 1), encodeLdr(1, 0, 16), encodeStr(1, 0, 16), encodeB(2), encodeBl(2)].map((word) => {
            const item = decodeA64(word);
            return <button key={item.text} type="button" onClick={() => { setStage(0); api.setCpu({ ...api.cpu, ir: word, decoded: item }); }}>{item.mnemonic}</button>;
          })}
          <button type="button" className="rvx-btn" onClick={() => setStage(4)}>Run</button>
          <button type="button" onClick={() => setStage((value) => Math.min(4, value + 1))}>Step</button>
          <button type="button" onClick={() => setStage(0)}>Reset</button>
        </div>
      </div>
      <div className="arm-flow">
        {["PC", "Instruction Memory", "Register File", "ALU", "Data Memory", "MUX"].map((label, index) => (
          <button key={label} type="button" className={`arm-box ${["fetch", "decode", "regs", "alu", "mem", "wb"][index]} ${stage === index || (hot === "alu" && label === "ALU") || (hot === "mem" && label === "Data Memory") ? "on" : ""}`} onClick={() => setStage(index)}>{label}</button>
        ))}
      </div>
      <p>Active values · X{decoded.rn} = {xn.toString()} · X{decoded.rm} = {xm.toString()} · ALU = {alu.toString()}</p>
      <label>X{decoded.rn} <input aria-label="Xn" type="number" value={Number(xn)} onChange={(event) => api.setCpu({ ...api.cpu, x: writeXn(api.cpu.x, decoded.rn, BigInt(Number(event.target.value) || 0)), decoded })} /></label>
      <div className="arm-pills">
        <span>RegWrite={branch || decoded.mnemonic === "STR" ? 0 : 1}</span>
        <span>ALUSrc={decoded.imm ? 1 : 0}</span>
        <span>MemRead={decoded.mnemonic === "LDR" ? 1 : 0}</span>
        <span>MemWrite={decoded.mnemonic === "STR" ? 1 : 0}</span>
        <span>MemToReg={decoded.mnemonic === "LDR" ? 1 : 0}</span>
        <span>Branch={branch ? 1 : 0}</span>
      </div>
      <div className="arm-labs">
        {journey.map(([title, blurb], index) => <div key={title} className={`arm-lab c${index + 1} ${stage === index ? "on" : ""}`}><strong>{index + 1} {title}</strong><span>{blurb}</span></div>)}
      </div>
    </section>
    <Notes title={`${decoded.mnemonic} on this datapath`} items={[
      ["RegWrite", branch || decoded.mnemonic === "STR" ? "This instruction does not write a general-purpose result. STR updates memory. B only updates the PC." : `Write-back stores the result in X${decoded.rd}.`],
      ["ALU", memOn ? "The ALU adds the base and the offset to form the address. It is not computing the loaded value." : branch ? "The ALU is idle. The next PC is the branch target, or PC+4 when the branch falls through." : `The ALU combines X${decoded.rn} (${xn.toString()}) and X${decoded.rm} (${xm.toString()}).`],
      ["Memory", memOn ? `${decoded.mnemonic} is the only reason data memory turns on. Arithmetic never reads or writes it.` : "Data memory stays idle. Instruction memory already supplied the 32-bit word in fetch."],
      ["Link", decoded.mnemonic === "BL" ? "BL also writes PC+4 into X30 before the PC takes the branch." : "Only BL writes X30. RET later reads that saved address."],
    ]} />
  </>
  );
}

export function PipelinePage() {
  const [text, setText] = useState("ADD X0, X1, X2\nSUB X3, X0, X4\nLDR X5, [X3]\nADD X6, X5, X7\nB.NE target");
  const [forward, setForward] = useState(true);
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const plan = armPipe(lines, forward);
  const off = armPipe(lines, false);
  const cycles = Math.max(8, plan.cycles);
  const branch = lines.some((line) => /^\s*B(\.|$|\s)/i.test(line));
  const flush = branch ? 2 : 0;
  const cpi = lines.length ? 1 + (plan.stalls + Math.min(flush, 1)) / lines.length : 0;
  const cpiOff = lines.length ? 1 + off.stalls / lines.length : 0;
  const cpiPred = lines.length ? 1 + plan.stalls / lines.length : 0;
  const raw = lines.find((line, index) => {
    const prev = lines[index - 1] ?? "";
    const dest = prev.match(/X(\d+)/i);
    return dest && line.toUpperCase().includes(`X${dest[1]}`) && !prev.toUpperCase().startsWith("LDR");
  });
  useEffect(() => {
    if (!playing) return undefined;
    const id = window.setInterval(() => setCursor((value) => (value + 1 >= cycles ? 0 : value + 1)), 450);
    return () => window.clearInterval(id);
  }, [playing, cycles]);
  return (
    <>
      <section className="rvx-card">
        <div className="arm-headrow">
          <h3>5-Stage Pipeline Timeline</h3>
          <div className="rvx-tabs">
            <button type="button" className="rvx-btn" onClick={() => setPlaying((value) => !value)}>{playing ? "Pause" : "Run"}</button>
            <button type="button" onClick={() => setCursor((value) => Math.min(cycles - 1, value + 1))}>Step Cycle</button>
            <button type="button" onClick={() => { setCursor(0); setPlaying(false); }}>Reset</button>
          </div>
        </div>
        <label className="rvx-chip"><input type="checkbox" checked={forward} onChange={(event) => setForward(event.target.checked)} /> Forwarding {forward ? "on" : "off"}</label>
        <div className="arm-time">
          <div className="arm-time-head"><span /><span>{Array.from({ length: cycles }, (_, index) => <b key={index} className={index === cursor ? "on" : ""}>C{index + 1}</b>)}</span></div>
          {lines.map((line, index) => (
            <div key={`${line}-${index}`} className="arm-time-row">
              <input aria-label={`Instruction ${index + 1}`} value={line} onChange={(event) => {
                const next = lines.slice();
                next[index] = event.target.value;
                setText(next.join("\n"));
                setCursor(0);
              }} />
              <span>{Array.from({ length: cycles }, (_, column) => {
                const cell = plan.grid[index]?.[column] ?? "";
                return <i key={column} className={`${cell.toLowerCase()} ${column === cursor ? "on" : ""}`}>{cell}</i>;
              })}</span>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setText(`${text}\nNOP`)}>Add instruction</button>
      </section>
      <section className="rvx-card">
        <h3>Hazard analysis</h3>
        <div className="arm-haz">
          <div><b>RAW dependency</b><span>{raw ? `${raw.trim()} uses a value from the previous instruction.` : "No ALU RAW pair in this sequence."}</span></div>
          <div><b>Load-use</b><span>{lines.some((line) => line.toUpperCase().startsWith("LDR")) ? `X result requires ${plan.stalls} stall${plan.stalls === 1 ? "" : "s"}.` : "No load in this sequence."}</span></div>
          <div><b>Forwarding</b><span>{forward ? "EX→EX enabled" : "Forwarding is off"}</span></div>
          <div><b>Branch</b><span>{branch ? `flush ${flush} younger ops` : "No branch in this sequence."}</span></div>
        </div>
      </section>
      <section className="rvx-card">
        <h3>Performance comparison</h3>
        <div className="arm-cpi">
          <div><b>Ideal</b><strong>CPI 1.0</strong><span>no hazards</span></div>
          <div><b>Current</b><strong>CPI {cpi.toFixed(1)}</strong><span>{plan.stalls} stall{plan.stalls === 1 ? "" : "s"}{flush ? " + flush" : ""}</span></div>
          <div><b>Forwarding off</b><strong>CPI {cpiOff.toFixed(1)}</strong><span>{off.stalls} extra RAW stalls</span></div>
          <div><b>Prediction on</b><strong>CPI {cpiPred.toFixed(1)}</strong><span>fewer control stalls</span></div>
        </div>
      </section>
      <Notes title="What each stage is doing" items={[
        ["IF", "Instruction fetch reads the 32-bit word at the PC. A taken branch has to throw away words that were fetched on the wrong path."],
        ["ID", "Decode reads the register file. This is where a following instruction notices that it needs a register the previous one has not written yet."],
        ["EX", "The ALU produces an arithmetic result, or an address. Forwarding can send that result straight to the next instruction’s EX."],
        ["MEM", "Loads and stores use this stage. An ALU result can be forwarded from EX, but a loaded value does not exist until MEM finishes."],
        ["WB", "Write-back updates the destination register. Without forwarding, the next instruction must wait until this stage."],
        ["This sequence", "SUB needs X0 from ADD, which forwarding can supply. ADD X6 needs X5 from LDR, which still costs one stall. B.NE may flush the two younger instructions."],
      ]} />
    </>
  );
}

export function MemoryPage({ api }: { api: ArmApi }) {
  const [base, setBase] = useState(0);
  const [offset, setOffset] = useState(0);
  const [mode, setMode] = useState<"unsigned" | "pre" | "post">("unsigned");
  const [value, setValue] = useState(7);
  const address = mode === "post" ? base : base + offset;
  const aligned = address % 8 === 0 && address >= 0 && address + 7 < api.cpu.mem.length;
  const applyBase = () => (mode === "unsigned" ? base : base + offset);
  const load = () => {
    if (!aligned) { api.setStatus("64-bit access must be 8-byte aligned."); return; }
    let word = 0n;
    for (let i = 0; i < 8; i += 1) word |= BigInt(api.cpu.mem[address + i] ?? 0) << BigInt(8 * i);
    api.setCpu({ ...api.cpu, x: writeXn(api.cpu.x, 0, word), sp: BigInt(applyBase()) });
    if (mode !== "unsigned") setBase(applyBase());
    api.setStatus(`LDR X0 got ${word.toString()} from ${address}.`);
  };
  const store = () => {
    if (!aligned) { api.setStatus("64-bit access must be 8-byte aligned."); return; }
    const mem = api.cpu.mem.slice();
    let bits = BigInt(value);
    for (let i = 0; i < 8; i += 1) mem[address + i] = Number((bits >> BigInt(8 * i)) & 0xffn);
    api.setCpu({ ...api.cpu, mem });
    if (mode !== "unsigned") setBase(applyBase());
    api.setStatus(`STR stored ${value} at ${address}.`);
  };
  const [tab, setTab] = useState<"view" | "modes" | "stack">("view");
  const words = [0, 8, 16, 24, 32, 40, 48, 56].map((addr) => {
    let word = 0;
    for (let i = 0; i < 8; i += 1) word |= (api.cpu.mem[addr + i] ?? 0) << (8 * i);
    return word >>> 0;
  });
  return (
    <>
      <section className="rvx-card">
        <h3>Load / Store Explorer</h3>
        <div className="rvx-tabs">
          <button type="button" className={tab === "view" ? "on" : ""} onClick={() => setTab("view")}>Memory View</button>
          <button type="button" className={tab === "modes" ? "on" : ""} onClick={() => setTab("modes")}>Addressing Modes</button>
          <button type="button" className={tab === "stack" ? "on" : ""} onClick={() => setTab("stack")}>Stack</button>
        </div>
        {tab === "stack" ? <p>AArch64 SP stays 16-byte aligned by the ABI. This model’s SP is {hex64(api.cpu.sp)}. A push pair would subtract 16 before the store.</p> : (
          <div className="rvx-grid2">
            <div>
              <h3>Memory (64-bit words)</h3>
              <div className="arm-mem">{words.map((word, index) => <span key={index}><b>0x{(index * 8).toString(16)}</b> 0x{word.toString(16).padStart(4, "0")}</span>)}</div>
            </div>
            <div>
              <h3>Addressing playground</h3>
              <p>LDR X0, [X{base}, #{offset}] · {mode}</p>
              <div className="rvx-cols">
                <label>Base <input aria-label="base" type="number" value={base} onChange={(event) => setBase(Number(event.target.value) || 0)} /></label>
                <label>Offset <input aria-label="offset" type="number" value={offset} onChange={(event) => setOffset(Number(event.target.value) || 0)} /></label>
                <label>Value <input aria-label="stored value" type="number" value={value} onChange={(event) => setValue(Number(event.target.value) || 0)} /></label>
              </div>
              <p className="arm-hex">EA = 0x{address.toString(16)} · {aligned ? "aligned" : "not 8-byte aligned"} · next base {applyBase()}</p>
              <div className="rvx-tabs">
                <button type="button" className="rvx-btn" onClick={load}>Execute LDR</button>
                <button type="button" onClick={store}>Try STR</button>
              </div>
              <p>{api.status}</p>
            </div>
          </div>
        )}
      </section>
      <section className="rvx-card">
        <h3>Addressing modes</h3>
        <div className="arm-labs">
          {([["unsigned", "Unsigned offset", "[Xn, #imm]"], ["pre", "Pre-index", "[Xn, #imm]!"], ["post", "Post-index", "[Xn], #imm"]] as const).map(([id, title, form]) => (
            <button key={id} type="button" className={`arm-lab ${mode === id ? "on" : ""}`} onClick={() => setMode(id)}><strong>{title}</strong><span>{form}</span></button>
          ))}
          <div className="arm-lab"><strong>Register offset</strong><span>[Xn, Xm]</span></div>
          <div className="arm-lab"><strong>Stack</strong><span>SP aligned to 16B</span></div>
        </div>
      </section>
      <Notes title={mode === "pre" ? "Pre-index" : mode === "post" ? "Post-index" : "Unsigned offset"} items={mode === "pre" ? [
        ["Syntax", "LDR Xt, [Xn, #imm]! updates Xn first, then uses the new value as the address."],
        ["When it is used", "Walking a pointer forward before the access, including some stack pops that adjust SP first."],
        ["This playground", `The access uses ${address}. The base becomes ${applyBase()} as part of the same instruction.`],
        ["Alignment", "A 64-bit access in this model must be a multiple of 8. A byte LDRB would not have that rule."],
      ] : mode === "post" ? [
        ["Syntax", "LDR Xt, [Xn], #imm uses the old Xn, then adds the offset afterwards."],
        ["When it is used", "A push-style store can write through SP and only then move SP."],
        ["This playground", `The access uses the old base ${address}. Afterwards the base becomes ${applyBase()}.`],
        ["Little-endian", "The least significant byte of the stored value lands at the lowest address."],
      ] : [
        ["Syntax", "LDR Xt, [Xn, #imm] adds the offset for the address and leaves Xn unchanged."],
        ["Scaled form", "In the real 64-bit encoding the immediate is a word count times 8. This playground takes a raw byte offset."],
        ["Effective address", `EA is 0x${address.toString(16)}. ${aligned ? "That address is 8-byte aligned." : "That address is not 8-byte aligned, so LDR and STR will refuse it."}`],
        ["Stack", `AAPCS64 keeps SP 16-byte aligned. This session’s SP is ${hex64(api.cpu.sp)}. A paired push subtracts 16 before the stores.`],
      ]} />
    </>
  );
}

const EL_CARDS = [
  ["EL3", "Secure Monitor", "el3"],
  ["EL2", "Hypervisor", "el2"],
  ["EL1", "OS kernel", "el1"],
  ["EL0", "Applications", "el0"],
];

export function ExceptionPage({ api }: { api: ArmApi }) {
  const [kind, setKind] = useState<"Synchronous" | "IRQ" | "FIQ" | "SError">("Synchronous");
  const fire = (name: typeof kind, imm: number) => {
    setKind(name);
    api.setCpu(triggerSvc(api.cpu, imm));
    api.setStatus(`${name} from EL${api.cpu.el} saved PC ${api.cpu.pc} in ELR_EL1.`);
  };
  return (
    <>
      <section className="rvx-card">
        <h3>Exception-Level Explorer</h3>
        <div className="arm-els">
          {EL_CARDS.map(([name, role, tone], index) => (
            <button key={name} type="button" className={`${tone} ${api.cpu.el === index ? "on" : ""}`} onClick={() => api.setCpu({ ...api.cpu, el: index as 0 | 1 | 2 | 3 })}>
              <b>{name}</b><span>{role}</span>
            </button>
          ))}
        </div>
        <div className="rvx-grid2">
          <div>
            <h3>Exception entry flow</h3>
            <ol className="arm-steps">
              <li>Event — {kind} from EL{api.cpu.el}</li>
              <li>Save state — ELR_EL1 = {api.cpu.elr}</li>
              <li>Save PSTATE — SPSR_EL1 = {api.cpu.spsr}</li>
              <li>Vector — PC = VBAR + offset ({api.cpu.vbar})</li>
              <li>Handler — execute at EL1</li>
              <li>ERET — restore and return</li>
            </ol>
          </div>
          <div>
            <h3>Live exception state</h3>
            <p>Current EL <b>EL{api.cpu.el}</b></p>
            <p>ELR_EL1 <b>0x{api.cpu.elr.toString(16)}</b></p>
            <p>SPSR_EL1 <b>0x{api.cpu.spsr.toString(16)}</b></p>
            <p>VBAR_EL1 <b>0x{api.cpu.vbar.toString(16)}</b></p>
            <p>ESR_EL1 <b>0x{api.cpu.esr.toString(16)}</b></p>
            <div className="rvx-tabs">
              <button type="button" className="rvx-btn" onClick={() => fire("Synchronous", 0x15)}>Trigger SVC</button>
              <button type="button" onClick={() => api.setCpu(eret(api.cpu))}>ERET</button>
            </div>
            <p>{api.status}</p>
          </div>
        </div>
      </section>
      <section className="rvx-card">
        <h3>Exception types</h3>
        <div className="arm-els">
          <button type="button" className={kind === "Synchronous" ? "on" : ""} onClick={() => fire("Synchronous", 0x15)}><b>Synchronous</b><span>SVC, abort, trap</span></button>
          <button type="button" className={kind === "IRQ" ? "on" : ""} onClick={() => fire("IRQ", 1)}><b>IRQ</b><span>normal interrupt</span></button>
          <button type="button" className={kind === "FIQ" ? "on" : ""} onClick={() => fire("FIQ", 2)}><b>FIQ</b><span>fast interrupt</span></button>
          <button type="button" className={kind === "SError" ? "on" : ""} onClick={() => fire("SError", 3)}><b>SError</b><span>system error</span></button>
        </div>
      </section>
      <Notes title="Where the handler lives" items={[
        ["VBAR_EL1", `The vector base is 0x${api.cpu.vbar.toString(16)}. The CPU adds a fixed offset for the exception type and the source level.`],
        ["Synchronous", "SVC, undefined instructions, and data aborts are synchronous. Software caused them at a known instruction."],
        ["IRQ and FIQ", "IRQ is the ordinary interrupt. FIQ is the fast interrupt. Both can arrive between instructions."],
        ["SError", "A system error is asynchronous and often reports a fault from the memory system."],
        ["ELR and SPSR", `ELR_EL1 holds 0x${api.cpu.elr.toString(16)}, the address to resume. SPSR_EL1 holds the level that was current, EL${api.cpu.spsr & 3}.`],
        ["ERET", "ERET copies ELR back to the PC and restores the exception level saved in SPSR. It is the return from the handler, not a branch in the program."],
      ]} />
    </>
  );
}

const SOC = [
  ["Performance cores", "Big cluster for the foreground app."],
  ["Efficiency cores", "Little cluster for background work."],
  ["Interconnect", "Moves requests between clusters and memory."],
  ["GPU", "Draws frames. Raising it adds traffic."],
  ["NPU", "Runs a teaching AI workload."],
  ["ISP", "Image signal processor on the same fabric."],
  ["Modem", "Radio block. Traffic still crosses the interconnect."],
  ["Memory", "Memory controller and LPDDR."],
];

export function SocPage() {
  const [load, setLoad] = useState<Record<string, number>>({ "Performance cores": 40, "Efficiency cores": 20, GPU: 10, NPU: 0 });
  const [sel, setSel] = useState("Performance cores");
  const temp = 35 + Object.values(load).reduce((sum, item) => sum + item, 0) / 12;
  const throttled = temp > 55;
  const ghz = throttled ? 1.6 : 2.2 + (load["Performance cores"] ?? 0) / 200;
  const dram = 20 + (load.GPU ?? 0) / 5 + (load.NPU ?? 0) / 8;
  return (
    <>
      <section className="rvx-card">
        <h3>Modern ARM SoC Explorer</h3>
        <div className="arm-soc">
          {SOC.map(([name, note]) => (
            <button key={name} type="button" className={sel === name ? "on" : ""} onClick={() => setSel(name ?? "Performance cores")}>
              <strong>{name}</strong><span>{note}</span>
            </button>
          ))}
        </div>
        <div className="arm-special">
          <div><b>CPU</b><span>{ghz.toFixed(1)} GHz</span></div>
          <div><b>GPU</b><span>{load.GPU ?? 0}%</span></div>
          <div><b>NPU</b><span>{((load.NPU ?? 0) / 8).toFixed(0)} TOPS</span></div>
          <div><b>DRAM</b><span>{dram.toFixed(0)} GB/s</span></div>
          <div><b>Temp</b><span>{temp.toFixed(0)}°C</span></div>
        </div>
      </section>
      <section className="rvx-card">
        <h3>Power & performance controls</h3>
        <div className="arm-cpi">
          <div><b>DVFS</b><strong>{throttled ? "throttled" : "balanced"}</strong><span>{sel}</span></div>
          <div><b>big cores</b><strong>{Math.round((load["Performance cores"] ?? 0) / 25)} active</strong></div>
          <div><b>little cores</b><strong>{Math.round((load["Efficiency cores"] ?? 0) / 25)} active</strong></div>
          <div><b>Thermal headroom</b><strong>{Math.max(0, Math.round(100 - temp))}%</strong></div>
        </div>
        {load[sel] !== undefined && <label>Activity {load[sel]}<input aria-label="activity" type="range" min={0} max={100} value={load[sel]} onChange={(event) => setLoad({ ...load, [sel]: Number(event.target.value) })} /></label>}
        <Theory title="A teaching SoC, not a phone SKU">Performance and efficiency clusters share one interconnect with a GPU, NPU, ISP, and memory controller. The frequency, bandwidth, and temperature numbers move with the sliders so DVFS is visible.</Theory>
      </section>
      <Notes title={sel} items={sel === "Performance cores" ? [
        ["Big cores", "These cores take the foreground thread. They have a deeper pipeline and a higher peak frequency."],
        ["Private L1", "Each core has its own instruction and data L1. A miss goes to the cluster cache, then to the interconnect."],
        ["DVFS", throttled ? "The thermal estimate is high, so the teaching model drops the big-core frequency." : "Frequency stays up while the thermal estimate has headroom."],
        ["Coherency", "A store on a big core must be visible to a little core that shares the same data. The interconnect keeps the caches coherent."],
      ] : sel === "Efficiency cores" ? [
        ["Little cores", "These cores run background work at lower power. The same AArch64 program can migrate here."],
        ["big.LITTLE", "The operating system moves a thread to a big core when it needs latency, and back when it is idle."],
        ["Same ISA", "Both clusters execute AArch64. They differ in microarchitecture, not in the instruction set the program uses."],
        ["Activity", "The slider is a teaching load, not a measured current from a real phone."],
      ] : [
        ["Role", SOC.find(([name]) => name === sel)?.[1] ?? "A block on the teaching SoC."],
        ["Interconnect", "CPU clusters, the GPU, the NPU, the ISP, and the modem all request memory through one fabric."],
        ["DRAM", `The memory controller is showing about ${dram.toFixed(0)} GB/s. GPU and NPU traffic raise that number.`],
        ["Heat", `The estimate is ${temp.toFixed(0)}°C. Sustained speed falls when the package cannot shed that heat.`],
      ]} />
    </>
  );
}

const QUIZ = [
  { topic: "Registers", q: "What does a write to W0 do to X0?", choices: ["Zero-extends into all 64 bits", "Leaves the top half unchanged", "Writes only X30", "Switches to EL2"], answer: 0, why: "A Wn write replaces Xn and clears bits 63:32." },
  { topic: "Instructions", q: "Which hex word is ADD X0, X1, X2?", choices: ["0x8B020020", "0xF9400020", "0x14000000", "0xD65F03C0"], answer: 0, why: "0x8B020020 is the 64-bit register ADD. 0xF9400020 is LDR and 0x14000000 is B." },
  { topic: "Memory", q: "When does pre-index update the base?", choices: ["Before the access", "Never", "Only on ERET", "After the next branch"], answer: 0, why: "Pre-index writes base+offset back, then uses that address." },
  { topic: "Pipeline", q: "Why does a load-use pair stall even with forwarding?", choices: ["The load data is ready after memory", "ADD has no result", "EL0 blocks forwarding", "B.NE always flushes EX"], answer: 0, why: "Forwarding can supply an ALU result from EX. A load result appears one stage later." },
  { topic: "Exceptions", q: "Which exception level normally runs the operating-system kernel?", choices: ["EL0", "EL1", "EL2", "EL3"], answer: 1, why: "EL1 is typically used by the OS kernel. EL0 is applications, EL2 is the hypervisor, and EL3 is the secure monitor." },
  { topic: "Exceptions", q: "What does ERET restore?", choices: ["PC from ELR and the level from SPSR", "X0 only", "The GPU frequency", "Only NZCV"], answer: 0, why: "ERET returns to the saved PC and the saved exception level." },
  { topic: "Registers", q: "Which register does BL use for the return address?", choices: ["X30", "X0", "SP", "PC as a general register"], answer: 0, why: "BL writes the address of the next instruction into X30, the link register. RET reads it back." },
  { topic: "Registers", q: "Which registers must a callee preserve in the usual AAPCS64?", choices: ["X19–X28", "X0–X7", "X9–X15", "Only NZCV"], answer: 0, why: "X19–X28 are callee-saved. X0–X7 and X9–X15 may be overwritten by a call." },
  { topic: "Instructions", q: "What does the S in ADDS change?", choices: ["NZCV is updated", "The add becomes a load", "X30 is written", "The instruction grows past 32 bits"], answer: 0, why: "ADDS is ADD with the flag-setting bit. A plain ADD leaves NZCV unchanged." },
  { topic: "Memory", q: "Which form leaves the base register unchanged?", choices: ["Unsigned offset [Xn, #imm]", "Pre-index [Xn, #imm]!", "Post-index [Xn], #imm", "A push that writes SP"], answer: 0, why: "Unsigned offset uses base+offset only as the address. Pre-index and post-index write the base back." },
  { topic: "Pipeline", q: "Which result can EX→EX forwarding supply?", choices: ["An ALU result", "A value that has not yet left memory", "The next PC after a mispredicted branch", "ELR_EL1"], answer: 0, why: "Forwarding bypasses an ALU result from EX. A load result is produced one stage later, in MEM." },
  { topic: "Exceptions", q: "Which event is synchronous?", choices: ["SVC", "IRQ", "FIQ", "SError"], answer: 0, why: "SVC is caused by a particular instruction. IRQ, FIQ, and SError can arrive from outside the instruction stream." },
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
  const letters = ["A", "B", "C", "D"];
  return (
    <>
      <section className="rvx-card">
        <h3>ARM Mastery Challenge</h3>
        <div className="rvx-tabs">
          {["Mixed", "Registers", "Instructions", "Memory", "Pipeline", "Exceptions"].map((name) => <button key={name} type="button" className={topic === name ? "on" : ""} onClick={() => { setTopic(name); setIndex(0); setPicked(null); }}>{name}</button>)}
        </div>
        <p>Question {(index % pool.length) + 1} of {pool.length} · Score {score}</p>
        <span className="arm-pills"><span>{item.topic}</span></span>
        <h3>{item.q}</h3>
        <p>Choose the best AArch64 architectural answer.</p>
        <div className="arm-quiz">
          {item.choices.map((choice, choiceIndex) => (
            <button key={choice} type="button" className={picked === null ? "" : choiceIndex === item.answer ? "ok" : picked === choiceIndex ? "bad" : ""} onClick={() => {
              if (picked !== null) return;
              setPicked(choiceIndex);
              setSeen((value) => ({ ...value, [item.topic]: (value[item.topic] ?? 0) + (choiceIndex === item.answer ? 1 : 0) }));
              if (choiceIndex === item.answer) setScore((value) => value + 1);
            }}><b>{letters[choiceIndex]}</b> {choice}</button>
          ))}
        </div>
        {picked !== null && <p className={picked === item.answer ? "arm-ok" : ""}>{picked === item.answer ? "Correct." : "Not this one."} {item.why}</p>}
        <button type="button" onClick={() => { setIndex((value) => value + 1); setPicked(null); }}>Next Question</button>
      </section>
      <section className="rvx-card">
        <h3>Mastery by topic</h3>
        <div className="arm-cpi">
          {["Registers", "Instructions", "Memory", "Pipeline", "Exceptions"].map((name) => {
            const hits = seen[name] ?? 0;
            const total = QUIZ.filter((row) => row.topic === name).length;
            const pct = total ? Math.round((hits / total) * 100) : 0;
            return <div key={name}><b>{name}</b><strong>{pct}%</strong><span>{hits} / {total}</span></div>;
          })}
        </div>
      </section>
    </>
  );
}
