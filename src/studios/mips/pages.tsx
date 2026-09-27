import { useEffect, useId, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Theory } from "../../design-system/ui";
import {
  MIPS_NAMES, aluMips, assembleMips, blankMips, branchTarget, decodeMips, ea, encodeI, encodeJ, encodeR, fieldsMips, jumpTarget, loadMips, mipsControls, mipsPipe, parseMipsAsm, readWord, stepMips, toBin32, toHex32, writeMipsReg, writeWord,
  type MipsCpu,
} from "../../engines/isaarch/mips";

export interface MipsApi {
  source: string;
  setSource: (value: string) => void;
  cpu: MipsCpu;
  setCpu: (cpu: MipsCpu) => void;
  sel: number;
  setSel: (index: number) => void;
  status: string;
  setStatus: (value: string) => void;
}

const SAMPLE = `addi $t0, $zero, 0
addi $t1, $zero, 10
loop:
add $t2, $t2, $t0
addi $t0, $t0, 1
bne $t0, $t1, loop`;

const TOPICS = [
  ["instruction-formats", "mips-formats", "Instruction Formats", "Split one 32-bit word into opcode, registers, and immediate."],
  ["register-file", "mips-registers", "Register File", "See all 32 registers, then change a value that is not $zero."],
  ["assembler", "mips-assembler", "Assembler", "Turn the sample loop into machine code and run it."],
  ["datapath", "mips-datapath", "Datapath", "Follow one instruction through PC, registers, ALU, and memory."],
  ["pipeline", "mips-pipeline", "Pipeline", "Watch five stages overlap, one clock at a time."],
  ["hazards", "mips-hazards", "Hazards", "Turn forwarding off and count the extra stalls."],
  ["memory-io", "mips-memory", "Memory & I/O", "Add base plus offset, then load or store a word."],
  ["system-calls", "mips-syscalls", "System Calls", "Print a number with the teaching SPIM/MARS service."],
  ["practice", "mips-practice", "Practice & Quiz", "Answer a question taken from these same rules."],
];

const PATH = [
  { id: "pc", label: "PC", hint: "Holds the address of the instruction to fetch.", to: "/architecture/mips/datapath" },
  { id: "imem", label: "I-Mem", hint: "Reads the 32-bit instruction at the PC.", to: "/architecture/mips/assembler" },
  { id: "regs", label: "Reg File", hint: "Reads rs and rt. Write-back updates rd or rt.", to: "/architecture/mips/register-file" },
  { id: "alu", label: "ALU", hint: "Adds, subtracts, compares, or shifts.", to: "/architecture/mips/datapath" },
  { id: "dmem", label: "D-Mem", hint: "Only lw and sw come here.", to: "/architecture/mips/memory-io" },
];

function paint(line: string): string {
  return line
    .replace(/(\$[A-Za-z0-9]+)/g, '<span class="rvx-regn">$1</span>')
    .replace(/\b(add|addu|sub|subu|and|or|xor|nor|slt|sltu|sll|srl|sra|jr|addi|addiu|andi|ori|xori|slti|lw|sw|beq|bne|lui|j|jal|syscall|nop|li|move|b)\b/g, '<span class="rvx-kw">$1</span>');
}

function SingleCycleView({ onPick }: { onPick?: (id: string) => void }) {
  const raw = useId().replace(/:/g, "");
  const arrow = `${raw}a`;
  const red = `${raw}r`;
  const pick = (id: string) => onPick?.(id);
  return (
    <svg className="mips-sc" viewBox="0 0 1000 430" role="img" aria-label="MIPS Processor Datapath, single-cycle view">
      <defs>
        <marker id={arrow} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0 1 L9 5 L0 9 Z" fill="#334155" />
        </marker>
        <marker id={red} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0 1 L9 5 L0 9 Z" fill="#e11d48" />
        </marker>
      </defs>
      <g fill="none" stroke="#334155" strokeWidth="1.6">
        <path d="M112 186 H158" markerEnd={`url(#${arrow})`} />
        <path d="M328 186 H388" markerEnd={`url(#${arrow})`} />
        <path d="M358 186 V70 H500" markerEnd={`url(#${arrow})`} />
        <path d="M420 186 V318" markerEnd={`url(#${arrow})`} />
        <path d="M75 232 V286" markerEnd={`url(#${arrow})`} />
        <path d="M48 304 H24 V168 H40" markerEnd={`url(#${arrow})`} />
        <path d="M538 162 H590" markerEnd={`url(#${arrow})`} />
        <path d="M520 214 V340 H600" />
        <path d="M600 340 V356" markerEnd={`url(#${arrow})`} />
        <path d="M600 340 H780 V268" markerEnd={`url(#${arrow})`} />
        <path d="M516 340 H600" markerEnd={`url(#${arrow})`} />
        <path d="M648 356 V250" markerEnd={`url(#${arrow})`} />
        <path d="M712 196 H748" markerEnd={`url(#${arrow})`} />
        <path d="M908 176 H938" markerEnd={`url(#${arrow})`} />
        <path d="M700 230 V380 H962 V248" markerEnd={`url(#${arrow})`} />
        <path d="M966 248 V400 H463 V258" markerEnd={`url(#${arrow})`} />
      </g>
      <path d="M640 68 V140" fill="none" stroke="#e11d48" strokeWidth="1.7" markerEnd={`url(#${red})`} />
      <path d="M700 42 H830 V140" fill="none" stroke="#e11d48" strokeWidth="1.7" markerEnd={`url(#${red})`} />
      <g className="mips-sc-hit" onClick={() => pick("control")}>
        <rect x="430" y="16" width="270" height="52" rx="12" className="sc-cu" />
        <text x="565" y="47" textAnchor="middle">Control Unit</text>
      </g>
      <g className="mips-sc-hit" onClick={() => pick("pc")}>
        <rect x="40" y="140" width="72" height="92" rx="14" className="sc-pc" />
        <text x="76" y="192" textAnchor="middle">PC</text>
      </g>
      <g className="mips-sc-hit" onClick={() => pick("plus")}>
        <rect x="48" y="286" width="52" height="34" rx="8" className="sc-mux" />
        <text x="74" y="308" textAnchor="middle">+4</text>
      </g>
      <g className="mips-sc-hit" onClick={() => pick("imem")}>
        <rect x="158" y="132" width="170" height="108" rx="12" className="sc-im" />
        <text x="243" y="180" textAnchor="middle">Instruction</text>
        <text x="243" y="200" textAnchor="middle">Memory</text>
      </g>
      <g className="mips-sc-hit" onClick={() => pick("regs")}>
        <rect x="388" y="118" width="150" height="140" rx="12" className="sc-rf" />
        <text x="463" y="180" textAnchor="middle">Register File</text>
        <text x="463" y="200" textAnchor="middle">(32 x 32)</text>
      </g>
      <g className="mips-sc-hit" onClick={() => pick("imm")}>
        <rect x="400" y="318" width="116" height="44" rx="10" className="sc-imm" />
        <text x="458" y="345" textAnchor="middle">Imm Gen</text>
      </g>
      <g className="mips-sc-hit" onClick={() => pick("mux")}>
        <rect x="600" y="318" width="48" height="58" rx="8" className="sc-mux" />
        <text x="624" y="351" textAnchor="middle">Mux</text>
      </g>
      <g className="mips-sc-hit" onClick={() => pick("alu")}>
        <polygon points="590,140 680,140 712,196 680,252 590,252 612,196" className="sc-alu" />
        <text x="646" y="202" textAnchor="middle">ALU</text>
      </g>
      <g className="mips-sc-hit" onClick={() => pick("dmem")}>
        <rect x="748" y="124" width="160" height="144" rx="12" className="sc-im" />
        <text x="828" y="190" textAnchor="middle">Data</text>
        <text x="828" y="210" textAnchor="middle">Memory</text>
      </g>
      <g className="mips-sc-hit" onClick={() => pick("wb")}>
        <rect x="938" y="150" width="48" height="70" rx="8" className="sc-mux" />
        <text x="962" y="190" textAnchor="middle">Mux</text>
      </g>
      <text className="sc-lab" x="548" y="146" textAnchor="middle">Read Data 1</text>
      <text className="sc-lab" x="556" y="328" textAnchor="middle">Read Data 2</text>
      <text className="sc-ctrl" x="652" y="100">ALU Control</text>
      <text className="sc-sig" x="844" y="78">MemRead</text>
      <text className="sc-sig" x="844" y="96">MemWrite</text>
      <text className="sc-sig" x="658" y="308">ALUSrc</text>
      <text className="sc-sig" x="900" y="142" textAnchor="end">MemtoReg</text>
    </svg>
  );
}

export function OverviewPage({ api }: { api: MipsApi }) {
  const [tab, setTab] = useState<"asm" | "hex" | "out">("asm");
  const [step, setStep] = useState(0);
  const go = useNavigate();
  const built = useMemo(() => assembleMips(api.source), [api.source]);
  const current = PATH[step] ?? PATH[0];
  return (
    <>
      <div className="rvx-badges">
        {["MIPS32", "32-bit RISC", "Load/Store", "5-Stage Pipeline", "Real Simulator"].map((item) => <span key={item}>{item}</span>)}
      </div>
      <section className="rvx-card">
        <h3 className="mips-sc-title"><span className="mips-sc-ico" aria-hidden="true" /> MIPS Processor Datapath (Single-Cycle View)</h3>
        <SingleCycleView onPick={(id) => {
          const index = PATH.findIndex((block) => block.id === id);
          if (index >= 0) setStep(index);
          else go("/architecture/mips/datapath");
        }} />
        <p className="mips-hint"><strong>{current?.label}.</strong> {current?.hint}</p>
        <div className="rvx-tabs">
          <button type="button" onClick={() => setStep((value) => (value + 1) % PATH.length)}>Next block</button>
          <Link className="rvx-btn" to="/architecture/mips/datapath">Start Exploring</Link>
        </div>
      </section>
      <div className="rvx-grid2">
        <section className="rvx-card">
          <h3>Quick facts</h3>
          <ul>
            <li>32 general-purpose registers</li>
            <li>R, I, and J formats, 32 bits each</li>
            <li>Words are shown big-endian</li>
            <li>Classic stages: IF, ID, EX, MEM, WB</li>
          </ul>
        </section>
        <section className="rvx-card">
          <h3>What to click</h3>
          <p>The picture above is the overview. The cards below open one lab each. Nothing on this page repeats the assembler, the quiz, or the register editor.</p>
        </section>
      </div>
      <section className="rvx-card">
        <h3>Explore topics</h3>
        <div className="mips-explore">
          {TOPICS.map(([id, icon, title, blurb]) => (
            <Link key={id} className="mips-card" to={`/architecture/mips/${id}`}>
              <img src={`/icons/${icon}.png`} alt="" />
              <strong>{title}</strong>
              <span>{blurb}</span>
            </Link>
          ))}
        </div>
      </section>
      <section className="rvx-card">
        <h3>Sample MIPS program</h3>
        <div className="rvx-tabs">
          {(["asm", "hex", "out"] as const).map((item) => <button key={item} type="button" className={tab === item ? "on" : ""} onClick={() => setTab(item)}>{item === "asm" ? "Assembly" : item === "hex" ? "Machine Code" : "Run Output"}</button>)}
          <button type="button" onClick={() => api.setSource(SAMPLE)}>Load</button>
          <button type="button" onClick={() => { const loaded = loadMips(api.source); if ("ok" in loaded) api.setStatus(loaded.error); else { let cpu = loaded; for (let i = 0; i < 80 && !cpu.halted; i += 1) cpu = stepMips(cpu); api.setCpu(cpu); api.setStatus(cpu.error ?? "Ran the sample."); } }}>Run</button>
        </div>
        {tab === "asm" && <pre className="rvx-pre">{api.source}</pre>}
        {tab === "hex" && <pre className="rvx-pre">{built.ok ? built.listing.map((row) => `${toHex32(row.pc)}  ${toHex32(row.word)}  ${row.expanded}`).join("\n") : built.errors.map((item) => `Line ${item.line}: ${item.message}`).join("\n")}</pre>}
        {tab === "out" && <pre className="rvx-pre">{`$t2 = ${api.cpu.regs[10] ?? 0}\nPC ${toHex32(api.cpu.pc)}\n${api.cpu.trace.slice(-6).join("\n")}`}</pre>}
      </section>
    </>
  );
}

const R_FUNCT: Array<[string, number]> = [["add", 0x20], ["sub", 0x22], ["and", 0x24], ["or", 0x25], ["slt", 0x2a], ["sll", 0]];

const FIELD_HELP: Record<string, string> = {
  opcode: "bits 31–26. Always 000000 for R-type.",
  rs: "bits 25–21. Source register 1.",
  rt: "bits 20–16. Source register 2, or the I-type destination.",
  rd: "bits 15–11. Destination register.",
  shamt: "bits 10–6. Shift amount.",
  funct: "bits 5–0. Names the R-type operation.",
  immediate: "bits 15–0. Sign-extended for addi, lw, sw, and beq.",
  target: "bits 25–0. Word address joined with the PC region.",
};

export function FormatsPage() {
  const [tab, setTab] = useState<"R" | "I" | "J" | "compare" | "play">("R");
  const [rs, setRs] = useState(9);
  const [rt, setRt] = useState(10);
  const [rd, setRd] = useState(8);
  const [shamt, setShamt] = useState(0);
  const [funct, setFunct] = useState(0x20);
  const [imm, setImm] = useState(4);
  const [target, setTarget] = useState(0x10);
  const [field, setField] = useState("opcode");
  const [asm, setAsm] = useState("add $t0, $t1, $t2");
  const [hexIn, setHexIn] = useState("0x012A4020");
  const [note, setNote] = useState("add $t0, $t1, $t2 encodes 0x012A4020.");
  const word = tab === "I" ? encodeI(0x23, rs, rt, imm) : tab === "J" ? encodeJ(2, target) : encodeR(rs, rt, rd, funct, shamt);
  const bits = toBin32(word);
  const parsed = useMemo(() => parseMipsAsm(asm), [asm]);
  const copy = (value: string) => { void navigator.clipboard?.writeText(value); setNote(`Copied ${value}`); };
  return (
    <>
      <div className="rvx-tabs">
        <button type="button" onClick={() => { setTab("play"); setAsm("add $t0, $t1, $t2"); }}>View Examples</button>
        {(["R", "I", "J", "compare", "play"] as const).map((item) => (
          <button key={item} type="button" className={tab === item ? "on" : ""} onClick={() => setTab(item)}>
            {item === "compare" ? "Format Comparison" : item === "play" ? "Encoding Playground" : `${item}-Type`}
          </button>
        ))}
      </div>
      {tab !== "compare" && tab !== "play" && (
        <section className="rvx-card">
          <h3>{tab}-Type Instruction Format</h3>
          <div className="mips-scale"><span>31</span><span>26</span><span>21</span><span>16</span><span>11</span><span>6</span><span>0</span></div>
          <div className="rvx-bits mips-fields">
            {fieldsMips(word).map((item) => (
              <button key={item.name} type="button" className={`f-${item.name} ${field === item.name ? "on" : ""}`} onClick={() => setField(item.name)} title={FIELD_HELP[item.name] ?? item.name}>
                <b>{item.name}</b>
                <span>{item.bits}</span>
              </button>
            ))}
          </div>
          <p>{FIELD_HELP[field] ?? "Click a field."}</p>
          <div className="rvx-cols">
            <label>rs <input aria-label="rs" type="number" min={0} max={31} value={rs} onChange={(event) => setRs(Number(event.target.value) & 31)} /></label>
            <label>rt <input aria-label="rt" type="number" min={0} max={31} value={rt} onChange={(event) => setRt(Number(event.target.value) & 31)} /></label>
            {tab === "R" && <label>rd <input aria-label="rd" type="number" min={0} max={31} value={rd} onChange={(event) => setRd(Number(event.target.value) & 31)} /></label>}
            {tab === "R" && <label>shamt <input aria-label="shamt" type="number" min={0} max={31} value={shamt} onChange={(event) => setShamt(Number(event.target.value) & 31)} /></label>}
            {tab === "R" && <label>funct <select aria-label="funct" value={funct} onChange={(event) => setFunct(Number(event.target.value))}>{R_FUNCT.map(([name, value]) => <option key={name} value={value}>{name}</option>)}</select></label>}
            {tab === "I" && <label>immediate <input aria-label="immediate" type="number" value={imm} onChange={(event) => setImm(Number(event.target.value) || 0)} /></label>}
            {tab === "J" && <label>target <input aria-label="jump target" type="number" value={target} onChange={(event) => setTarget(Number(event.target.value) || 0)} /></label>}
          </div>
        </section>
      )}
      {tab === "R" && (
        <div className="rvx-cols">
          <section className="rvx-card">
            <h3>Example: add ${MIPS_NAMES[rd]?.slice(1)}, ${MIPS_NAMES[rs]?.slice(1)}, ${MIPS_NAMES[rt]?.slice(1)}</h3>
            <table className="rvx-table"><tbody>
              {fieldsMips(word).map((item) => <tr key={item.name}><td>{item.name}</td><td>{item.value}</td><td>{item.bits}</td><td>{FIELD_HELP[item.name]}</td></tr>)}
            </tbody></table>
          </section>
          <section className="rvx-card">
            <h3>Machine Code</h3>
            <p className="mips-bin">{bits}</p>
            <p><strong>{toHex32(word)}</strong></p>
            <button type="button" onClick={() => copy(bits)}>Copy Binary</button>
            <button type="button" onClick={() => copy(toHex32(word))}>Copy Hex</button>
          </section>
        </div>
      )}
      {(tab === "play" || tab === "R") && (
        <section className="rvx-card">
          <h3>Assembly → Machine Code</h3>
          <label>Assembly instruction <input aria-label="Assembly instruction" value={asm} onChange={(event) => setAsm(event.target.value)} /></label>
          <button type="button" className="rvx-btn" onClick={() => setNote("error" in parsed ? parsed.error : `${parsed.text} → ${toHex32(parsed.word)} ${toBin32(parsed.word)}`)}>Assemble</button>
          <label>Machine code hex <input aria-label="Machine code hex" value={hexIn} onChange={(event) => setHexIn(event.target.value)} /></label>
          <button type="button" onClick={() => { const value = Number(hexIn); setNote(Number.isFinite(value) ? decodeMips(value).text : "Enter a hex word such as 0x012A4020."); }}>Disassemble</button>
          <p>{note}</p>
        </section>
      )}
      {tab === "compare" && (
        <div className="rvx-cols">
          <section className="rvx-card"><h3>I-Type</h3><p>opcode · rs · rt · immediate 16. Used by addi, lw, sw, beq.</p></section>
          <section className="rvx-card"><h3>J-Type</h3><p>opcode · target 26. j and jal. Target is a word address.</p></section>
          <section className="rvx-card"><h3>Common opcodes</h3><ul><li>000000 R-type, use funct</li><li>100011 lw</li><li>101011 sw</li><li>000100 beq</li><li>000010 j</li><li>000011 jal</li></ul></section>
        </div>
      )}
    </>
  );
}

const ROLES: Record<number, string> = { 0: "zero", 1: "at", 2: "temp", 3: "temp", 4: "arg", 5: "arg", 6: "arg", 7: "arg", 8: "temp", 9: "temp", 10: "temp", 11: "temp", 12: "temp", 13: "temp", 14: "temp", 15: "temp", 16: "saved", 17: "saved", 18: "saved", 19: "saved", 20: "saved", 21: "saved", 22: "saved", 23: "saved", 24: "temp", 25: "temp", 26: "saved", 27: "saved", 28: "gp", 29: "sp", 30: "saved", 31: "ra" };

export function RegisterPage({ api }: { api: MipsApi }) {
  const value = api.cpu.regs[api.sel] ?? 0;
  const [editing, setEditing] = useState(false);
  return (
    <>
      <section className="rvx-card">
        <h3>MIPS32 Register File — 32 Registers</h3>
        <p className="mips-legend"><i className="zero" /> zero <i className="ra" /> return <i className="arg" /> args <i className="temp" /> temp <i className="saved" /> saved <i className="sp" /> stack / special</p>
        <div className="mips-regs">
          {MIPS_NAMES.map((name, index) => (
            <button key={name} type="button" className={`mips-tile ${ROLES[index] ?? ""} ${api.sel === index ? "on" : ""}`} onClick={() => { api.setSel(index); setEditing(false); }}>
              <b>{name}</b>
              <span>r{index}</span>
              <small>{toHex32(api.cpu.regs[index] ?? 0)}</small>
            </button>
          ))}
        </div>
      </section>
      <section className="rvx-card">
        <h3>Selected Register: {MIPS_NAMES[api.sel]} (r{api.sel})</h3>
        <div className="mips-detail">
          <div><span>Hex</span><b>{toHex32(value)}</b></div>
          <div><span>Unsigned</span><b>{value >>> 0}</b></div>
          <div><span>Signed</span><b>{value | 0}</b></div>
          <div><span>Binary</span><b>{toBin32(value)}</b></div>
        </div>
        {editing && api.sel !== 0 && <label>New value <input aria-label="Register value" type="number" value={value | 0} onChange={(event) => api.setCpu({ ...api.cpu, regs: writeMipsReg(api.cpu.regs, api.sel, Number(event.target.value) || 0) })} /></label>}
        <p>{api.sel === 0 ? "$zero is hardwired to 0, so move and nop can be ordinary instructions." : api.sel === 31 ? "$ra receives the return address from jal." : api.sel === 29 ? "$sp points at the current top of the stack." : api.sel >= 16 && api.sel <= 23 ? "Callee-saved. A function must restore this register before it returns." : api.sel >= 4 && api.sel <= 7 ? "Argument register. The caller puts a value here before jal or syscall." : "Caller-saved or reserved. A call may overwrite it."}</p>
        <button type="button" className="rvx-btn" disabled={api.sel === 0} onClick={() => setEditing((on) => !on)}>{api.sel === 0 ? "$zero stays 0" : editing ? "Done" : "Edit Value"}</button>
      </section>
      <section className="rvx-card">
        <h3>Register Roles in Function Calls</h3>
        <div className="rvx-cols">
          <div><strong>Caller-saved</strong><p>$t0–$t9, $a0–$a3, $v0–$v1 may be clobbered by a call.</p></div>
          <div><strong>Callee-saved</strong><p>$s0–$s7 are preserved across calls.</p></div>
          <div><strong>Special</strong><p>$sp stack, $ra return, $gp global, $zero constant.</p></div>
        </div>
      </section>
    </>
  );
}

export function AssemblerPage({ api }: { api: MipsApi }) {
  const built = useMemo(() => assembleMips(api.source), [api.source]);
  const run = (limit: number) => {
    const loaded = loadMips(api.source);
    if ("ok" in loaded) { api.setStatus(loaded.error); return; }
    let cpu = loaded;
    for (let i = 0; i < limit && !cpu.halted; i += 1) cpu = stepMips(cpu);
    api.setCpu(cpu);
    api.setStatus(cpu.error ?? (cpu.halted ? "Halted." : "Stepped."));
  };
  return (
    <>
      <div className="rvx-tabs">
        <button type="button" onClick={() => api.setSource(SAMPLE)}>Sum loop</button>
        <button type="button" onClick={() => api.setSource("addi $v0, $zero, 1\naddi $a0, $zero, 42\nsyscall\naddi $v0, $zero, 10\nsyscall")}>Print 42</button>
        <button type="button" onClick={() => api.setSource("addi $t0, $zero, 1\nbeq $t0, $zero, skip\naddi $t2, $zero, 7\nskip:\naddi $t3, $zero, 1")}>Branch</button>
        <button type="button" onClick={() => api.setSource("")}>New File</button>
        <button type="button" onClick={() => api.setStatus(built.ok ? `${built.words.length} instructions.` : built.errors[0]?.message ?? "Assemble failed.")}>Assemble</button>
        <button type="button" onClick={() => run(200)}>Run</button>
        <button type="button" onClick={() => { if (api.cpu.retired === 0 && api.cpu.pc === 0) run(1); else api.setCpu(stepMips(api.cpu)); }}>Step</button>
        <button type="button" onClick={() => { api.setCpu(blankMips()); api.setStatus("Reset."); }}>Reset</button>
      </div>
      <div className="rvx-editor">
        <div className="gutter">{api.source.split("\n").map((_, index) => <span key={index}>{index + 1}</span>)}</div>
        <pre dangerouslySetInnerHTML={{ __html: (api.source || " ").split("\n").map(paint).join("\n") }} />
        <textarea aria-label="MIPS source" spellCheck={false} value={api.source} onChange={(event) => api.setSource(event.target.value)} />
      </div>
      <p className="rvx-status">{api.status} · PC {toHex32(api.cpu.pc)} · IR {toHex32(api.cpu.ir)} · cycles {api.cpu.cycles} · retired {api.cpu.retired}</p>
      <div className="rvx-cols">
        <section className="rvx-card"><h3>Machine code</h3><pre className="rvx-pre">{built.ok ? built.listing.map((row) => `${toHex32(row.word)}  ${row.expanded}`).join("\n") : built.errors.map((item) => `Line ${item.line}: ${item.message}`).join("\n")}</pre></section>
        <section className="rvx-card"><h3>Registers</h3><pre className="rvx-pre">{api.cpu.regs.map((value, index) => value ? `${MIPS_NAMES[index]} ${toHex32(value)}` : "").filter(Boolean).join("\n") || "$zero only"}</pre></section>
        <section className="rvx-card"><h3>Console</h3><pre className="rvx-pre">{api.cpu.console.join("\n") || api.cpu.trace.slice(-4).join("\n") || "No output yet."}</pre></section>
      </div>
    </>
  );
}

const DP_OPS = [
  { label: "add $t0, $t1, $t2", word: encodeR(9, 10, 8, 0x20) },
  { label: "lw $t0, 4($t1)", word: encodeI(0x23, 9, 8, 4) },
  { label: "sw $t0, 8($t1)", word: encodeI(0x2b, 9, 8, 8) },
  { label: "beq $t0, $t1, 1", word: encodeI(0x04, 8, 9, 1) },
];

export function DatapathPage({ api }: { api: MipsApi }) {
  const [stage, setStage] = useState(0);
  const decoded = api.cpu.decoded ?? decodeMips(DP_OPS[0]?.word ?? 0);
  const controls = mipsControls(decoded.mnemonic);
  const rsVal = api.cpu.regs[decoded.rs] ?? 0;
  const rtVal = api.cpu.regs[decoded.rt] ?? 0;
  const memOp = decoded.mnemonic === "lw" || decoded.mnemonic === "sw";
  const alu = memOp ? ea(rsVal, decoded.imm) : decoded.mnemonic === "beq" ? (rsVal === rtVal ? 1 : 0) : aluMips(decoded.mnemonic === "add" ? "add" : decoded.mnemonic, rsVal, rtVal);
  const loaded = decoded.mnemonic === "lw" ? readWord(api.cpu.mem, alu) : null;
  const wb = decoded.mnemonic === "lw" ? (typeof loaded === "number" ? loaded : null) : controls.RegWrite ? alu : null;
  const dest = controls.RegDst ? decoded.rd : decoded.rt;
  const journey = [
    { title: "Fetch", body: `PC ${toHex32(api.cpu.pc)} goes to instruction memory and reads ${decoded.text}.` },
    { title: "Decode", body: `Control reads the opcode. ${MIPS_NAMES[decoded.rs] ?? "$rs"} = ${rsVal}, ${MIPS_NAMES[decoded.rt] ?? "$rt"} = ${rtVal}.` },
    { title: "Execute", body: memOp ? `ALU adds the base and the offset: ${rsVal} + ${decoded.imm} = ${alu}.` : decoded.mnemonic === "beq" ? `ALU compares the registers. ${rsVal === rtVal ? "They are equal, so the branch is taken." : "They differ, so the branch falls through."} Next PC ${toHex32(rsVal === rtVal ? branchTarget(api.cpu.pc, decoded.imm) : api.cpu.pc + 4)}.` : `ALU computes ${rsVal} and ${rtVal}. Result ${alu}.` },
    { title: "Memory", body: decoded.mnemonic === "lw" ? `Load the word at ${toHex32(alu)}.` : decoded.mnemonic === "sw" ? `Store ${MIPS_NAMES[decoded.rt]} into ${toHex32(alu)}.` : "No memory access. Only loads and stores use data memory." },
    { title: "Write Back", body: wb === null ? "Nothing is written to the register file." : `${MIPS_NAMES[dest] ?? "rd"} ← ${wb}.` },
  ];
  const choose = (word: number) => {
    setStage(0);
    api.setCpu({ ...api.cpu, ir: word, decoded: decodeMips(word) });
  };
  const commit = () => {
    if (decoded.mnemonic === "sw") {
      const mem = api.cpu.mem.slice();
      const fault = writeWord(mem, alu, rtVal);
      api.setStatus(fault ?? `Stored ${toHex32(rtVal)} at ${toHex32(alu)}.`);
      if (!fault) api.setCpu({ ...api.cpu, mem, decoded });
      return;
    }
    if (wb === null) { api.setStatus("This instruction does not write a register."); return; }
    api.setCpu({ ...api.cpu, regs: writeMipsReg(api.cpu.regs, dest, wb), decoded });
    api.setStatus(`${MIPS_NAMES[dest]} is now ${wb}.`);
  };
  const setReg = (index: number, value: number) => api.setCpu({ ...api.cpu, regs: writeMipsReg(api.cpu.regs, index, value), decoded });
  return (
    <>
      <section className="rvx-card">
        <div className="rvx-tabs">
          {DP_OPS.map((item) => <button key={item.label} type="button" className={decoded.word === item.word ? "on" : ""} onClick={() => choose(item.word)}>{item.label}</button>)}
          <button type="button" onClick={() => { setStage(4); commit(); }}>Run</button>
          <button type="button" onClick={() => { const next = Math.min(4, stage + 1); setStage(next); if (next === 4) commit(); }}>Step</button>
          <button type="button" onClick={() => setStage(0)}>Reset</button>
        </div>
        <h3>Interactive Datapath — {decoded.text}</h3>
        <SingleCycleView onPick={(id) => setStage(id === "pc" || id === "imem" || id === "plus" ? 0 : id === "regs" || id === "control" ? 1 : id === "alu" || id === "imm" || id === "mux" ? 2 : id === "dmem" ? 3 : 4)} />
        <div className="rvx-grid2">
          <div>
            <h3>Live control signals</h3>
            <p className="mips-signals">{Object.entries(controls).map(([name, value]) => <span key={name}>{name} <b>{String(value)}</b></span>)}</p>
          </div>
          <div>
            <h3>Current data</h3>
            <p>PC {toHex32(api.cpu.pc)}</p>
            <label>{MIPS_NAMES[decoded.rs]} <input aria-label="rs value" type="number" value={rsVal | 0} onChange={(event) => setReg(decoded.rs, Number(event.target.value) || 0)} /></label>
            <label>{MIPS_NAMES[decoded.rt]} <input aria-label="rt value" type="number" value={rtVal | 0} onChange={(event) => setReg(decoded.rt, Number(event.target.value) || 0)} /></label>
            <p>ALU result <strong>{alu}</strong></p>
            <p>Write-back {wb === null ? "none" : `${MIPS_NAMES[dest]} ← ${wb}`}</p>
          </div>
        </div>
      </section>
      <section className="rvx-card">
        <h3>Instruction journey</h3>
        <div className="mips-journey">
          {journey.map((item, index) => (
            <button key={item.title} type="button" className={stage === index ? "on" : ""} onClick={() => setStage(index)}>
              <b>{index + 1}. {item.title}</b>
              <span>{item.body}</span>
            </button>
          ))}
        </div>
      </section>
      <Theory title="One clock finishes the whole instruction">
        {decoded.text} uses every block it needs before the clock edge. The control unit looks only at the opcode (and funct, for R-type) and sets the signals above. ALUSrc is {controls.ALUSrc}, so the ALU’s second input is {controls.ALUSrc ? "the sign-extended immediate" : "rt from the register file"}. MemtoReg is {controls.MemtoReg}, so write-back comes from {controls.MemtoReg ? "data memory" : "the ALU"}. A load is the long path: instruction memory, register read, address add, data memory, then write-back. The clock must be slow enough for that path even when the instruction is a short add.
      </Theory>
      <Theory title="Where the next PC comes from">
        The default next address is PC + 4. A taken branch replaces that with {toHex32(branchTarget(api.cpu.pc, decoded.imm))}, which is (PC + 4) + (immediate × 4). A jump uses the 26-bit target shifted left two bits, {toHex32(jumpTarget(api.cpu.pc, decoded.target))}, inside the current 256 MB region. Click a box in the picture to jump to the journey step that uses it.
      </Theory>
    </>
  );
}

export function PipelinePage() {
  const [text, setText] = useState("add $t0, $t1, $t2\nsub $t3, $t0, $t1\naddi $t4, $t3, 1");
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const plan = mipsPipe(lines, true);
  const cycle = Math.min(cursor, Math.max(0, plan.cycles - 1));
  return (
    <section className="rvx-card">
      <textarea aria-label="Pipeline instructions" value={text} onChange={(event) => { setText(event.target.value); setCursor(0); }} />
      <div className="rvx-tabs">
        <button type="button" onClick={() => setCursor((value) => Math.min(plan.cycles - 1, value + 1))}>Step Cycle</button>
        <button type="button" onClick={() => setPlaying((value) => !value)}>{playing ? "Pause" : "Run"}</button>
        <button type="button" onClick={() => { setCursor(0); setPlaying(false); }}>Reset</button>
      </div>
      <PipeRun playing={playing} cycles={plan.cycles} setCursor={setCursor} />
      <p>Cycle {cycle + 1} / {plan.cycles} · stalls {plan.stalls} · CPI {lines.length ? (plan.cycles / lines.length).toFixed(2) : "—"}</p>
      <p>{lines.map((line, index) => { const cell = plan.grid[index]?.[cycle]; return cell ? `${line} is in ${cell}. ` : ""; }).join("") || "Add an instruction to fill the pipe."}</p>
      <div className="rvx-stage">
        {lines.map((line, index) => (
          <div key={`${line}-${index}`}>
            <b>{line}</b>
            {(plan.grid[index] ?? []).map((cell, column) => <span key={column} className={column === cycle ? "on" : ""}>{cell}</span>)}
          </div>
        ))}
      </div>
    </section>
  );
}

function PipeRun({ playing, cycles, setCursor }: { playing: boolean; cycles: number; setCursor: (value: number | ((value: number) => number)) => void }) {
  useEffect(() => {
    if (!playing || cycles <= 0) return undefined;
    const id = window.setInterval(() => setCursor((value) => (value + 1 >= cycles ? 0 : value + 1)), 450);
    return () => window.clearInterval(id);
  }, [playing, cycles, setCursor]);
  return null;
}

export function HazardsPage() {
  const [text, setText] = useState("add $t0, $t1, $t2\nsub $t3, $t0, $t4\nlw $t0, 0($t1)\nadd $t2, $t0, $t3");
  const [forward, setForward] = useState(true);
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const on = mipsPipe(lines, true);
  const off = mipsPipe(lines, false);
  const shown = forward ? on : off;
  return (
    <section className="rvx-card">
      <div className="rvx-tabs">
        <button type="button" onClick={() => setText("add $t0, $t1, $t2\nsub $t3, $t0, $t4")}>RAW</button>
        <button type="button" onClick={() => setText("lw $t0, 0($t1)\nadd $t2, $t0, $t3")}>Load-use</button>
        <button type="button" onClick={() => setText("beq $t0, $t1, 1\nadd $t2, $t3, $t4")}>Control</button>
      </div>
      <textarea aria-label="Hazard sequence" value={text} onChange={(event) => setText(event.target.value)} />
      <label className="rvx-chip"><input type="checkbox" checked={forward} onChange={(event) => setForward(event.target.checked)} /> Forwarding</label>
      <p>With forwarding: {on.cycles} cycles, {on.stalls} stalls. Without: {off.cycles} cycles, {off.stalls} stalls.</p>
      <ul>{shown.notes.map((note) => <li key={note}>{note}</li>)}</ul>
      <div className="rvx-stage">
        {lines.map((line, index) => <div key={`${line}-${index}`}><b>{line}</b>{(shown.grid[index] ?? []).map((cell, column) => <span key={column}>{cell}</span>)}</div>)}
      </div>
    </section>
  );
}

export function MemoryPage({ api }: { api: MipsApi }) {
  const [tab, setTab] = useState<"data" | "text" | "stack" | "io">("data");
  const [base, setBase] = useState(0);
  const [offset, setOffset] = useState(0);
  const address = (base + offset) >>> 0;
  const word = readWord(api.cpu.mem, address);
  const rows = tab === "stack" ? [api.cpu.regs[29] ?? 0] : tab === "text" ? [0, 4, 8, 12] : [0, 4, 8, 12, 16];
  return (
    <section className="rvx-card">
      <div className="rvx-tabs">
        {(["data", "text", "stack", "io"] as const).map((item) => <button key={item} type="button" className={tab === item ? "on" : ""} onClick={() => setTab(item)}>{item}</button>)}
      </div>
      <div className="rvx-cols">
        <label>Base <input type="number" value={base} onChange={(event) => setBase(Number(event.target.value) || 0)} /></label>
        <label>Offset <input type="number" value={offset} onChange={(event) => setOffset(Number(event.target.value) || 0)} /></label>
      </div>
      <p>Effective address {address}. {typeof word === "number" ? `Word ${toHex32(word)}` : word}</p>
      <div className="rvx-tabs">
        <button type="button" onClick={() => { const loaded = readWord(api.cpu.mem, address); if (typeof loaded !== "number") api.setStatus(loaded); else api.setCpu({ ...api.cpu, regs: writeMipsReg(api.cpu.regs, 8, loaded) }); }}>lw $t0</button>
        <button type="button" onClick={() => { const mem = api.cpu.mem.slice(); const fault = writeWord(mem, address, api.cpu.regs[8] ?? 0); if (fault) api.setStatus(fault); else api.setCpu({ ...api.cpu, mem }); }}>sw $t0</button>
      </div>
      <table className="rvx-table"><tbody>{rows.map((addr) => <tr key={addr}><td>{toHex32(addr)}</td><td>{String(readWord(api.cpu.mem, addr))}</td></tr>)}</tbody></table>
      <p>{tab === "text" ? "Instructions occupy the low addresses. A word must start on a multiple of 4." : tab === "stack" ? `$sp is ${toHex32(api.cpu.regs[29] ?? 0)}. The stack grows toward smaller addresses.` : tab === "io" ? "The syscall page writes strings at address 256 in this same memory." : "Data words live at base + sign-extended offset. lw and sw reject an address that is not a multiple of 4."}</p>
    </section>
  );
}

const CALLS = [
  { id: 1, name: "print integer", args: "$a0 = value", result: "console" },
  { id: 4, name: "print string", args: "$a0 = address", result: "console" },
  { id: 5, name: "read integer", args: "result → $v0", result: "$v0" },
  { id: 8, name: "read string", args: "$a0 = buffer, $a1 = length", result: "memory" },
  { id: 10, name: "exit", args: "none", result: "halt" },
  { id: 11, name: "print character", args: "$a0 = character", result: "console" },
];

export function SyscallPage({ api }: { api: MipsApi }) {
  const [service, setService] = useState(1);
  const [arg, setArg] = useState(42);
  const [text, setText] = useState("Hello");
  const selected = CALLS.find((item) => item.id === service) ?? CALLS[0];
  const snippet = service === 1 ? `li $v0, 1\nli $a0, ${arg}\nsyscall`
    : service === 4 ? `li $v0, 4\nla $a0, msg\nsyscall\n# msg: "${text}"`
      : service === 5 ? `li $v0, 5\nsyscall\n# keyboard returns ${arg} in $v0`
        : service === 8 ? `li $v0, 8\nla $a0, buf\nli $a1, ${Math.max(1, arg)}\nsyscall\n# typed: "${text}"`
          : service === 10 ? `li $v0, 10\nsyscall`
            : `li $v0, 11\nli $a0, ${arg}\nsyscall\n# prints '${String.fromCharCode(arg & 0xff)}'`;
  const pick = (id: number) => {
    setService(id);
    api.setCpu({ ...api.cpu, regs: writeMipsReg(api.cpu.regs, 2, id), halted: false, decoded: api.cpu.decoded });
  };
  const run = () => {
    const consoleLines = api.cpu.console.slice();
    consoleLines.push(`> syscall ${service}`);
    if (service === 5) {
      consoleLines.push(String(arg | 0));
      api.setCpu({ ...api.cpu, regs: writeMipsReg(writeMipsReg(api.cpu.regs, 2, arg), 4, api.cpu.regs[4] ?? 0), console: consoleLines, halted: false });
      api.setStatus(`Read integer ${arg} into $v0.`);
      return;
    }
    if (service === 8) {
      const mem = api.cpu.mem.slice();
      const addr = 256;
      const limit = Math.max(1, arg);
      text.slice(0, limit - 1).split("").forEach((ch, index) => { mem[addr + index] = ch.charCodeAt(0); });
      mem[addr + Math.min(text.length, limit - 1)] = 0;
      consoleLines.push(text.slice(0, limit - 1));
      api.setCpu({ ...api.cpu, mem, regs: writeMipsReg(writeMipsReg(writeMipsReg(api.cpu.regs, 2, 8), 4, addr), 5, limit), console: consoleLines });
      api.setStatus(`Stored the string at ${toHex32(addr)}.`);
      return;
    }
    const cpuStart: MipsCpu = { ...api.cpu, regs: api.cpu.regs.slice(), mem: Uint8Array.from(api.cpu.mem), console: consoleLines, halted: false, pc: 0, retired: 0 };
    let cpu = cpuStart;
    cpu.regs = writeMipsReg(cpu.regs, 2, service);
    if (service === 4) {
      text.split("").forEach((ch, index) => { if (256 + index < cpu.mem.length) cpu.mem[256 + index] = ch.charCodeAt(0); });
      cpu.mem[256 + text.length] = 0;
      cpu.regs = writeMipsReg(cpu.regs, 4, 256);
    } else if (service !== 10) cpu.regs = writeMipsReg(cpu.regs, 4, arg);
    writeWord(cpu.mem, 0, encodeR(0, 0, 0, 0x0c));
    cpu = stepMips(cpu);
    api.setCpu(cpu);
    api.setStatus(service === 10 ? "Program exit. This is a teaching halt, not an operating-system call." : "Syscall finished.");
  };
  return (
    <>
      <div className="mips-split">
        <section className="rvx-card">
          <h3>Common Services</h3>
          <div className="mips-svc-list">
            {CALLS.map((item) => (
              <button key={item.id} type="button" className={service === item.id ? "on" : ""} onClick={() => pick(item.id)}>
                <b>{item.id}</b>
                <span><strong>{item.name}</strong><small>{item.args}</small></span>
              </button>
            ))}
          </div>
        </section>
        <section className="rvx-card">
          <h3>Try a Syscall — {selected?.name}</h3>
          <p>1. Select service</p>
          <p className="mips-pill">{service} — {selected?.name}</p>
          <p>2. Load arguments</p>
          <div className="rvx-cols">
            <label>$v0 <input aria-label="v0" type="number" value={service} onChange={(event) => pick(Number(event.target.value) || 1)} /></label>
            {service !== 10 && service !== 4 && service !== 8 && <label>$a0 <input aria-label="a0" type="number" value={arg} onChange={(event) => setArg(Number(event.target.value) || 0)} /></label>}
            {(service === 4 || service === 8) && <label>Text <input aria-label="syscall text" value={text} onChange={(event) => setText(event.target.value)} /></label>}
            {service === 8 && <label>Max length <input aria-label="string length" type="number" value={arg} onChange={(event) => setArg(Number(event.target.value) || 1)} /></label>}
            {service === 5 && <label>Keyboard <input aria-label="keyboard integer" type="number" value={arg} onChange={(event) => setArg(Number(event.target.value) || 0)} /></label>}
            {service === 11 && <p>Character preview: {String.fromCharCode(arg & 0xff)}</p>}
          </div>
          <p>3. Execute</p>
          <button type="button" className="rvx-btn" onClick={run}>Run syscall</button>
          <div className="mips-console" aria-live="polite">
            {api.cpu.console.length === 0 ? <span>&gt; waiting</span> : api.cpu.console.map((line, index) => <span key={`${line}-${index}`}>{line}</span>)}
          </div>
        </section>
      </div>
      <div className="rvx-grid2">
        <section className="rvx-card">
          <h3>Assembly pattern</h3>
          <pre className="rvx-pre">{snippet}</pre>
          <button type="button" onClick={() => api.setSource(snippet)}>Load into Assembler</button>
          <Link to="/architecture/mips/assembler">Open Assembler</Link>
        </section>
        <section className="rvx-card mips-conv">
          <h3>Register convention</h3>
          <p>$v0 is {api.cpu.regs[2] ?? 0}. It selects the service before the call, and receives a result after read integer.</p>
          <p>$a0 is {api.cpu.regs[4] ?? 0}. $a0–$a3 carry the common arguments.</p>
          <p>{selected?.result === "halt" ? "Exit is explicit. The program stops because $v0 is 10." : `This service’s result goes to ${selected?.result}.`}</p>
        </section>
      </div>
      <Theory title="SPIM/MARS teaching services">These numbers are the educational convention used by SPIM and MARS. They are not Linux or Windows system calls. The assembler page runs the same syscall instruction when $v0 is 1, 4, 10, or 11. Read integer and read string take the value you type here, because this browser has no separate keyboard device.</Theory>
    </>
  );
}

const QUIZ = [
  { topic: "Instruction Formats", q: "Which field selects the R-type operation when opcode is 0?", choices: ["funct", "shamt", "immediate"], answer: 0, why: "Opcode 0 means the funct field names add, sub, and the other R-type operations." },
  { topic: "Registers", q: "What is the ABI name of register 31?", choices: ["$ra", "$sp", "$gp"], answer: 0, why: "$ra is register 31, written by jal with the return address." },
  { topic: "Datapath", q: "A word branch immediate of 3 from PC 0 goes to which address?", choices: ["16", "12", "3"], answer: 0, why: "Target is (PC + 4) + (immediate << 2) = 4 + 12 = 16." },
  { topic: "Pipeline", q: "How many stages are in the classic MIPS pipeline shown here?", choices: ["5", "3", "2"], answer: 0, why: "IF, ID, EX, MEM, and WB." },
  { topic: "Memory", q: "Which instruction may read data memory?", choices: ["lw", "add", "j"], answer: 0, why: "MIPS is a load/store ISA. add and j do not touch data memory." },
];

export function PracticePage() {
  const [topic, setTopic] = useState("All");
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [seen, setSeen] = useState(0);
  const pool = QUIZ.filter((entry) => topic === "All" || entry.topic === topic);
  const item = pool[index % Math.max(1, pool.length)];
  if (!item) return null;
  return (
    <section className="rvx-card">
      <div className="rvx-tabs">
        {["All", "Instruction Formats", "Registers", "Datapath", "Pipeline", "Memory"].map((name) => <button key={name} type="button" className={topic === name ? "on" : ""} onClick={() => { setTopic(name); setIndex(0); setPicked(null); }}>{name}</button>)}
      </div>
      <p>{seen} answered · score {score} · {item.topic}</p>
      <h3>{item.q}</h3>
      {item.choices.map((choice, choiceIndex) => (
        <button key={choice} type="button" className={picked === choiceIndex ? "on" : ""} onClick={() => { if (picked !== null) return; setPicked(choiceIndex); setSeen((value) => value + 1); if (choiceIndex === item.answer) setScore((value) => value + 1); }}>
          {choice}
        </button>
      ))}
      {picked !== null && <p>{picked === item.answer ? "Correct." : "Not this one."} {item.why}</p>}
      <button type="button" onClick={() => { setIndex((value) => value + 1); setPicked(null); }}>Next Question</button>
    </section>
  );
}
