import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { toBin32, toHex32 } from "../../engines/isaarch/bits";
import {
  ABI, RV_FORMATS, assemble, decode, fieldsOf, immBits, parseHexWord, stepRv, writeX,
  type RvFormat, type RvState,
} from "../../engines/isaarch/riscv";
import { RvGlyph } from "./shell";

export type RvApi = {
  source: string;
  setSource: (value: string) => void;
  cpu: RvState;
  setCpu: (update: (prev: RvState) => RvState) => void;
  sel: number;
  setSel: (index: number) => void;
  loadSrc: (text: string) => void;
  playing: boolean;
  setPlaying: (on: boolean) => void;
};

const TOPICS: Array<{ id: string; title: string; blurb: string; tint: string }> = [
  { id: "registers", title: "Register File", blurb: "32 registers, x0–x31", tint: "#fee2e2" },
  { id: "formats", title: "Instruction Formats", blurb: "R, I, S, B, U, J", tint: "#dbeafe" },
  { id: "encoding", title: "Encoding Explorer", blurb: "Binary, hex and fields", tint: "#ede9fe" },
  { id: "assembler", title: "Assembler", blurb: "Write and run code", tint: "#dcfce7" },
  { id: "arith", title: "Arithmetic & Logic", blurb: "ADD, SUB, AND, OR…", tint: "#ffedd5" },
  { id: "loadstore", title: "Loads & Stores", blurb: "LW, SW and memory", tint: "#cffafe" },
  { id: "branches", title: "Branches", blurb: "BEQ, BNE, BLT…", tint: "#fce7f3" },
  { id: "jal", title: "JAL / JALR", blurb: "Procedure calls", tint: "#e0e7ff" },
  { id: "lui", title: "LUI / AUIPC", blurb: "Build 32-bit constants", tint: "#fef9c3" },
  { id: "immgen", title: "Immediate Generator", blurb: "Sign extension", tint: "#fae8ff" },
  { id: "datapath", title: "Single-Cycle Datapath", blurb: "Complete datapath", tint: "#dbeafe" },
  { id: "multicycle", title: "Multi-Cycle Concept", blurb: "Reuse hardware", tint: "#e0f2fe" },
  { id: "pipeline", title: "Pipeline", blurb: "5-stage pipeline", tint: "#dcfce7" },
  { id: "hazards", title: "Hazards & Forwarding", blurb: "Data & control hazards", tint: "#fee2e2" },
  { id: "program", title: "Program Execution", blurb: "PC, registers, memory", tint: "#d1fae5" },
];

const PRESETS: Record<string, string> = {
  add: "addi x1, x0, 5\naddi x2, x0, 7\nadd x3, x1, x2",
  sum: "addi x1, x0, 0\naddi x2, x0, 5\nloop:\nbeq x2, x0, done\nadd x1, x1, x2\naddi x2, x2, -1\njal x0, loop\ndone:\naddi x3, x0, 1",
  memory: "addi x1, x0, 5\nsw x1, 0(x0)\nlw x2, 0(x0)",
  branch: "addi x5, x0, 10\naddi x6, x0, 10\nbeq x5, x6, label\naddi x7, x0, 1\nlabel:\naddi x8, x0, 2",
  call: "jal x1, func\naddi x3, x0, 1\nbeq x0, x0, end\nfunc:\naddi x10, x0, 5\njalr x0, 0(x1)\nend:\naddi x4, x0, 1",
  pseudo: "li t0, 10\nli t1, 1\nmv t2, t1\nadd t0, t0, t1\nnop",
};

function tone(index: number): string {
  if (index === 0) return "zero";
  if (index === 1) return "ra";
  if (index === 2) return "sp";
  if (index === 3) return "gp";
  if (index === 4) return "tp";
  if ((index >= 5 && index <= 7) || index >= 28) return "temp";
  if ((index >= 8 && index <= 9) || (index >= 18 && index <= 27)) return "saved";
  return "arg";
}

function signed32(value: number): number {
  return value | 0;
}

function groups(word: number): string {
  return toBin32(word >>> 0).replace(/(.{4})/g, "$1 ").trim();
}

function paint(source: string): string {
  const escaped = source.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return escaped.replace(/^[ \t]*([a-z.]+)/gim, (full) => `<span class="rvx-kw">${full}</span>`)
    .replace(/\b(x[0-9]|x[12][0-9]|x3[01]|zero|ra|sp|gp|tp|t[0-6]|s[0-9]|s1[01]|a[0-7]|fp)\b/g, `<span class="rvx-rg">$1</span>`)
    .replace(/\b-?(?:0x[0-9a-fA-F]+|\d+)\b/g, `<span class="rvx-num">$&</span>`)
    .replace(/^([A-Za-z_]\w*):/gm, `<span class="rvx-lb">$1:</span>`);
}

function roleText(index: number): string {
  if (index === 0) return "Hardwired to zero. Reads are 0. Writes are ignored.";
  if (index === 1) return "Return address. Calls store PC+4 here.";
  if (index === 2) return "Stack pointer. It addresses the top of the stack and grows toward lower addresses.";
  if (index === 3) return "Global pointer, used for global data.";
  if (index === 4) return "Thread pointer for thread-local storage.";
  if (index >= 10 && index <= 17) return "Argument and return-value register. A call may overwrite it.";
  if ((index >= 8 && index <= 9) || (index >= 18 && index <= 27)) return "Callee-saved. A function that uses it must restore the old value.";
  return "Caller-saved temporary. A function may overwrite it.";
}

function Tip({ label, text, children }: { label: string; text: string; children: ReactNode }) {
  return (
    <span className="rvx-hover" style={{ display: "inline-flex" }}>
      {children}
      <span className="rvx-pop" role="tooltip">{label}: {text}</span>
    </span>
  );
}

function sampleWord(format: RvFormat): number {
  const text = format === "R" ? "add x5, x6, x7" : format === "I" ? "addi x1, x0, 5" : format === "S" ? "sw x3, 0(x0)" : format === "B" ? "beq x1, x2, 8" : format === "U" ? "lui x1, 1" : "jal x1, 16";
  const built = assemble(text);
  return built.ok ? built.words[0] ?? 0 : 0;
}

export function OverviewPage({ api }: { api: RvApi }) {
  return (
    <>
      <section className="rvx-card">
        <p className="rvx-kicker">Overview</p>
        <div className="rvx-grid2">
          <div>
            <h3>Build understanding, one block at a time.</h3>
            <p>This lab walks through the RV32I subset: how instructions are encoded, how the CPU executes them, and how pipelining and hazards change the machine.</p>
            <div className="rvx-row">
              <Link className="rvx-btn" to="/architecture/riscv/formats">Start Exploring</Link>
              <a className="rvx-btn ghost" href="#rvx-takes">View Studio Guide</a>
            </div>
            <div className="rvx-grid3" style={{ marginTop: 12 }}>
              <div><b>Interactive learning</b><p className="tiny">Visualize and experiment</p></div>
              <div><b>Write and run code</b><p className="tiny">See what happens</p></div>
              <div><b>Core concepts</b><p className="tiny">From ISA to execution</p></div>
            </div>
          </div>
          <HeroPath />
        </div>
      </section>
      <section className="rvx-card">
        <div className="rvx-row" style={{ justifyContent: "space-between" }}><h3>Explore the Lab Topics</h3><Link to="/architecture/riscv/program">View All Topics</Link></div>
        <div className="rvx-topics">
          {TOPICS.map((topic) => (
            <Link key={topic.id} className="rvx-topic" to={`/architecture/riscv/${topic.id}`}>
              <span className="rvx-ico" style={{ background: topic.tint }}><RvGlyph id={topic.id} /></span>
              <b>{topic.title}</b>
              <span>{topic.blurb}</span>
            </Link>
          ))}
        </div>
      </section>
      <div className="rvx-grid2">
        <section className="rvx-card">
          <div className="rvx-row" style={{ justifyContent: "space-between" }}><h3>RV32I Workspace Preview</h3><button type="button" className="rvx-btn" onClick={() => api.setPlaying(true)}>Run</button></div>
          <pre className="rvx-mono">{api.source}</pre>
          <p className="tiny">Try it yourself. Assemble, step, and watch x3 become x1 + x2.</p>
        </section>
        <section className="rvx-card">
          <h3>Machine State Preview</h3>
          <div className="rvx-metrics">
            <div className="rvx-metric"><span>PC</span><b>{toHex32(api.cpu.pc)}</b></div>
            <div className="rvx-metric"><span>IR</span><b>{toHex32(api.cpu.ir)}</b></div>
            <div className="rvx-metric"><span>Retired</span><b>{api.cpu.retired}</b></div>
          </div>
          <div className="rvx-regs" style={{ marginTop: 8 }}>
            {api.cpu.regs.slice(0, 4).map((value, index) => (
              <div key={index} className={`rvx-reg ${tone(index)}`}><b>x{index}</b><small>{toHex32(value)}</small></div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

function HeroPath() {
  const box = (x: number, y: number, w: number, h: number, fill: string, label: string) => (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="10" fill={fill} stroke="#cbd5e1" />
      <text x={x + w / 2} y={y + h / 2 + 4} textAnchor="middle" fill="#0f172a">{label}</text>
    </g>
  );
  return (
    <svg className="rvx-svg rvx-diagram" viewBox="0 0 420 200" role="img" aria-label="Simplified RV32I datapath">
      <path className="rvx-flow" d="M78 48 H118 M200 48 H230 M300 70 V100 H250 M160 130 H300" fill="none" stroke="#2563eb" strokeWidth="2" />
      {box(8, 28, 70, 40, "#dbeafe", "PC")}
      {box(118, 28, 82, 40, "#ede9fe", "Instruction Memory")}
      {box(230, 16, 90, 40, "#dcfce7", "Register File")}
      {box(300, 100, 70, 40, "#ffedd5", "ALU")}
      {box(250, 150, 110, 36, "#fce7f3", "Data Memory")}
      {box(118, 110, 90, 36, "#e0e7ff", "Control Unit")}
      <text x="16" y="190" fill="#2563eb">Fetch</text>
      <text x="120" y="190" fill="#7c3aed">Decode</text>
      <text x="230" y="190" fill="#ea580c">Execute</text>
      <text x="320" y="190" fill="#16a34a">Memory</text>
    </svg>
  );
}

export function RegisterPage({ api }: { api: RvApi }) {
  const value = api.cpu.regs[api.sel] ?? 0;
  const [draft, setDraft] = useState(String(signed32(value)));
  return (
    <>
      <div className="rvx-grid2">
        <section className="rvx-card">
          <div className="rvx-row" style={{ justifyContent: "space-between" }}>
            <h3>RISC-V Register File (32 Registers)</h3>
          </div>
          <div className="rvx-legend">
            <span><i style={{ background: "#86efac" }} /> Zero</span>
            <span><i style={{ background: "#f9a8d4" }} /> Return address</span>
            <span><i style={{ background: "#93c5fd" }} /> Stack / pointer</span>
            <span><i style={{ background: "#67e8f9" }} /> Arguments</span>
            <span><i style={{ background: "#fdba74" }} /> Temporaries</span>
            <span><i style={{ background: "#c4b5fd" }} /> Saved</span>
          </div>
          <div className="rvx-regs" style={{ marginTop: 8 }}>
            {api.cpu.regs.map((_, index) => (
              <button key={index} type="button" className={`rvx-reg ${tone(index)} ${api.sel === index ? "sel" : ""}`} onClick={() => { api.setSel(index); setDraft(String(signed32(api.cpu.regs[index] ?? 0))); }}>
                <b>x{index}</b>
                <em>{ABI[index]}</em>
                <small>{index}</small>
              </button>
            ))}
          </div>
        </section>
        <section className="rvx-card">
          <div className="rvx-row" style={{ justifyContent: "space-between" }}><h3>Selected Register</h3><span className="rvx-chip">Live</span></div>
          <p><b style={{ color: "#16a34a" }}>x{api.sel}</b> <b>{ABI[api.sel]}</b></p>
          <p>{roleText(api.sel)}</p>
          <div className="rvx-metric"><span>Binary (32-bit)</span><b>{groups(value)}</b></div>
          <div className="rvx-metrics" style={{ marginTop: 8 }}>
            <div className="rvx-metric"><span>Hex</span><b>{toHex32(value)}</b></div>
            <div className="rvx-metric"><span>Unsigned</span><b>{value >>> 0}</b></div>
            <div className="rvx-metric"><span>Signed</span><b>{signed32(value)}</b></div>
          </div>
          <label className="field">Write decimal value
            <input aria-label="Register value" value={draft} disabled={api.sel === 0} onChange={(event) => setDraft(event.target.value)} />
          </label>
          <button type="button" className="rvx-btn" disabled={api.sel === 0} onClick={() => {
            const next = Number(draft);
            if (!Number.isFinite(next)) return;
            api.setCpu((prev) => ({ ...prev, regs: writeX(prev.regs, api.sel, next) }));
          }}>Apply write</button>
          {api.sel === 0 ? <p className="tiny">x0 rejects writes and stays zero.</p> : null}
          <h3>Common use</h3>
          <p className="tiny">{roleText(api.sel)}</p>
        </section>
      </div>
      <div className="rvx-cols">
        <section className="rvx-card" style={{ background: "#fff7ed" }}><h3>Caller-saved</h3><p>t0–t6, a0–a7. The caller saves them if it still needs the values after a call.</p></section>
        <section className="rvx-card" style={{ background: "#f5f3ff" }}><h3>Callee-saved</h3><p>s0–s11. The callee restores them before returning.</p></section>
        <section className="rvx-card" style={{ background: "#eff6ff" }}><h3>Special registers</h3><p>x0 zero, x1 ra, x2 sp, x3 gp, x4 tp.</p></section>
      </div>
      <div className="rvx-grid2">
        <section className="rvx-card">
          <h3>Current instruction</h3>
          <p className="rvx-mono">{api.cpu.decoded?.text ?? "addi sp, sp, -16"}</p>
          <p className="tiny">PC {toHex32(api.cpu.pc)} · IR {toHex32(api.cpu.ir)}</p>
        </section>
        <section className="rvx-card">
          <h3>Register file snapshot</h3>
          <table className="rvx-table">
            <thead><tr><th>Register</th><th>ABI</th><th>Hex</th><th>Unsigned</th><th>Signed</th></tr></thead>
            <tbody>
              {[0, 1, 2, 8, api.sel].filter((item, index, all) => all.indexOf(item) === index).map((index) => (
                <tr key={index}><td>x{index}</td><td>{ABI[index]}</td><td className="rvx-mono">{toHex32(api.cpu.regs[index] ?? 0)}</td><td>{(api.cpu.regs[index] ?? 0) >>> 0}</td><td>{signed32(api.cpu.regs[index] ?? 0)}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </>
  );
}

const FORMAT_ORDER: RvFormat[] = ["R", "I", "S", "B", "U", "J"];

export function FormatPage({ api, encoding }: { api: RvApi; encoding?: boolean }) {
  const [format, setFormat] = useState<RvFormat>(encoding ? "R" : "R");
  const [asm, setAsm] = useState("add x5, x6, x7");
  const [hex, setHex] = useState("0x007302b3");
  const [field, setField] = useState("opcode");
  const [tab, setTab] = useState(encoding ? "play" : "formats");
  const built = assemble(asm);
  const parsed = parseHexWord(hex);
  const word = tab === "play" ? (parsed ?? (built.ok ? built.words[0] ?? 0 : 0)) : sampleWord(format);
  const decoded = decode(word);
  const active = tab === "play" && !decoded.error ? decoded.format : format;
  const fields = fieldsOf(active, word);
  const picked = fields.find((item) => item.name === field) ?? fields[0];
  return (
    <>
      <div className="rvx-tabs">
        <button type="button" className={tab === "formats" ? "on" : ""} onClick={() => setTab("formats")}>Instruction Formats</button>
        <button type="button" className={tab === "play" ? "on" : ""} onClick={() => setTab("play")}>Encoding Playground</button>
        <button type="button" className={tab === "imm" ? "on" : ""} onClick={() => setTab("imm")}>Immediate Visualizer</button>
        <Link to="/architecture/riscv/immgen">Open immediate lab</Link>
      </div>
      <section className="rvx-card">
        <div className="rvx-row" style={{ justifyContent: "space-between" }}>
          <h3>RISC-V instruction formats (32-bit)</h3>
          <div className="rvx-row">{FORMAT_ORDER.map((item) => <button key={item} type="button" className={active === item ? "rvx-btn" : "rvx-btn ghost"} onClick={() => { setFormat(item); setField(RV_FORMATS[item][0]?.name ?? "opcode"); }}>{item}</button>)}</div>
        </div>
        <p className="tiny">Each instruction is 32 bits. Click a format, then a field.</p>
        <div className="rvx-fmts">
          {FORMAT_ORDER.map((item) => (
            <FormatCard key={item} format={item} selected={active === item} onPick={() => { setFormat(item); setTab("formats"); }} />
          ))}
        </div>
      </section>
      {tab !== "formats" ? (
        <div className="rvx-cols">
          <section className="rvx-card">
            <h3>Encoding Playground</h3>
            <div className="rvx-row">{FORMAT_ORDER.map((item) => <button key={item} type="button" className={active === item ? "rvx-btn" : "rvx-btn ghost"} onClick={() => { setFormat(item); setAsm(decode(sampleWord(item)).text); setHex(toHex32(sampleWord(item))); }}>{item}</button>)}</div>
            <label className="field">Assembly instruction
              <input aria-label="Assembly instruction" value={asm} onChange={(event) => {
                setAsm(event.target.value);
                const next = assemble(event.target.value);
                if (next.ok && next.words[0] !== undefined) setHex(toHex32(next.words[0]));
              }} />
            </label>
            <label className="field">Machine code (hex)
              <input aria-label="Machine hex" value={hex} onChange={(event) => {
                setHex(event.target.value);
                const next = parseHexWord(event.target.value);
                if (next !== null && decode(next).text !== "unknown") setAsm(decode(next).text);
              }} />
            </label>
            <p className="rvx-mono">{groups(word)}</p>
            {!built.ok ? <p>{built.errors.map((item) => `Line ${item.line}: ${item.message}`).join(" ")}</p> : null}
            <button type="button" className="rvx-btn ghost" onClick={() => api.loadSrc(decoded.error ? api.source : decoded.text)}>Load into CPU</button>
          </section>
          <section className="rvx-card">
            <h3>Field breakdown</h3>
            {fields.map((item) => (
              <button key={item.name} type="button" className="rvx-row" style={{ width: "100%", background: picked?.name === item.name ? "#eff6ff" : "transparent", border: 0, cursor: "pointer", textAlign: "left" }} onClick={() => setField(item.name)}>
                <Tip label={item.name} text={item.meaning}><i style={{ width: 14, height: 14, borderRadius: 4, background: item.color, display: "inline-block" }} /></Tip>
                <span><b>{item.name}</b> {item.bits} · {item.meaning}</span>
              </button>
            ))}
            {picked ? <p>Bits [{picked.hi}:{picked.lo}] value {picked.value}. {picked.meaning}</p> : null}
          </section>
          <section className="rvx-card">
            <h3>Live conversions</h3>
            <p>Assembly → machine code</p>
            <p className="rvx-mono">{decoded.text}<br />{toHex32(word)}</p>
            <p>Machine code → assembly</p>
            <p className="rvx-mono">{decoded.text}</p>
            <p>rd x{decoded.rd} ({ABI[decoded.rd]}) · rs1 x{decoded.rs1} · rs2 x{decoded.rs2} · imm {decoded.imm}</p>
            {tab === "imm" ? <ImmMoves format={active === "R" ? "I" : active} word={word} /> : null}
          </section>
        </div>
      ) : null}
    </>
  );
}

function FormatCard({ format, selected, onPick }: { format: RvFormat; selected: boolean; onPick: () => void }) {
  const titles: Record<RvFormat, string> = { R: "Register-register", I: "Immediate", S: "Store", B: "Branch", U: "Upper immediate", J: "Jump" };
  return (
    <button type="button" className={selected ? "rvx-fmt on" : "rvx-fmt"} onClick={onPick}>
      <header><span>{format}-type</span><span>{titles[format]}</span><span>32 bits</span></header>
      <div className="rvx-bits">
        {RV_FORMATS[format].map((field) => (
          <span key={field.name} style={{ background: field.color, padding: "8px 2px", fontSize: 10, textAlign: "center" }}>{field.name}<br />{field.hi}:{field.lo}</span>
        ))}
      </div>
    </button>
  );
}

function ImmMoves({ format, word }: { format: RvFormat; word: number }) {
  const moves = immBits(format, word);
  return (
    <div className="rvx-bits">
      {moves.slice(0, 21).map((move) => <span key={`${move.src}-${move.dst}`} style={{ background: move.value ? "#bfdbfe" : "#f8fafc", fontSize: 10, padding: 4 }}>{move.dst}={move.value}</span>)}
    </div>
  );
}

export function AssemblerPage({ api }: { api: RvApi }) {
  const built = assemble(api.source);
  const [pane, setPane] = useState<"code" | "dis" | "mem" | "regs">("code");
  const [radix, setRadix] = useState<"hex" | "bin">("hex");
  const lines = api.source.split("\n");
  return (
    <>
      <div className="rvx-grid2">
        <section className="rvx-card">
          <div className="rvx-row">
            <b>main.s</b>
            <select aria-label="Example program" defaultValue="pseudo" onChange={(event) => api.loadSrc(PRESETS[event.target.value] ?? PRESETS.add ?? "")}>
              {Object.keys(PRESETS).map((id) => <option key={id} value={id}>{id}</option>)}
            </select>
          </div>
          <div className="rvx-editor">
            <div className="gutter">{lines.map((_, index) => <div key={index}>{index + 1}</div>)}</div>
            <pre dangerouslySetInnerHTML={{ __html: `${paint(api.source)}\n` }} />
            <textarea aria-label="RISC-V assembly" value={api.source} spellCheck={false} onChange={(event) => api.setSource(event.target.value)} />
          </div>
        </section>
        <section className="rvx-card">
          <div className="rvx-tabs">
            <button type="button" className={pane === "code" ? "on" : ""} onClick={() => setPane("code")}>Machine Code</button>
            <button type="button" className={pane === "dis" ? "on" : ""} onClick={() => setPane("dis")}>Disassembly</button>
            <button type="button" className={pane === "mem" ? "on" : ""} onClick={() => setPane("mem")}>Memory</button>
            <button type="button" className={pane === "regs" ? "on" : ""} onClick={() => setPane("regs")}>Registers</button>
          </div>
          <div className="rvx-row">
            <button type="button" className={radix === "hex" ? "rvx-btn" : "rvx-btn ghost"} onClick={() => setRadix("hex")}>Hex</button>
            <button type="button" className={radix === "bin" ? "rvx-btn" : "rvx-btn ghost"} onClick={() => setRadix("bin")}>Binary</button>
          </div>
          {built.ok && pane === "code" ? (
            <table className="rvx-table"><tbody>{built.listing.map((row) => <tr key={row.pc}><td>{toHex32(row.pc)}</td><td className="rvx-mono">{radix === "hex" ? toHex32(row.word) : groups(row.word)}</td><td>{row.text}</td></tr>)}</tbody></table>
          ) : null}
          {built.ok && pane === "dis" ? (
            <table className="rvx-table"><tbody>{built.listing.map((row) => {
              const real = decode(row.word).text;
              const pseudo = /^(li|mv|nop|ret)\b/i.test(row.text);
              return <tr key={row.pc}><td>{row.text}</td><td>{pseudo ? `→ ${real}` : real}</td></tr>;
            })}</tbody></table>
          ) : null}
          {pane === "mem" ? <p className="rvx-mono">{Array.from(api.cpu.mem.slice(0, 8)).map((word, index) => `${toHex32(index * 4)} ${toHex32(word)}`).join("\n")}</p> : null}
          {pane === "regs" ? <p className="rvx-mono">{api.cpu.regs.slice(0, 16).map((value, index) => `x${index} ${ABI[index]} ${toHex32(value)}`).join("\n")}</p> : null}
          {!built.ok ? <ul>{built.errors.map((item) => <li key={`${item.line}-${item.message}`}>Line {item.line}: {item.message}</li>)}</ul> : null}
        </section>
      </div>
      <div className="rvx-row">
        <button type="button" className="rvx-btn" style={{ background: "#16a34a" }} onClick={() => api.loadSrc(api.source)}>Assemble</button>
        <button type="button" className="rvx-btn" onClick={() => api.setPlaying(!api.playing)}>{api.playing ? "Pause" : "Run"}</button>
        <button type="button" className="rvx-btn ghost" onClick={() => api.setCpu((prev) => stepRv(prev))}>Step Instruction</button>
        <button type="button" className="rvx-btn ghost" onClick={() => api.setCpu((prev) => stepRv(prev))}>Step Cycle</button>
        <button type="button" className="rvx-btn ghost" onClick={() => api.loadSrc(api.source)}>Reset</button>
      </div>
      <div className="rvx-grid2">
        <section className="rvx-card">
          <h3>Execution status <span className={api.cpu.halted ? "rvx-chip warn" : "rvx-chip"}>{api.cpu.halted ? "Halted" : api.playing ? "Running" : "Ready"}</span></h3>
          <div className="rvx-status">
            <div className="rvx-metric"><span>PC</span><b>{toHex32(api.cpu.pc)}</b></div>
            <div className="rvx-metric"><span>Next</span><b>{api.cpu.decoded?.text ?? "—"}</b></div>
            <div className="rvx-metric"><span>Cycles</span><b>{api.cpu.cycles}</b></div>
            <div className="rvx-metric"><span>Instructions</span><b>{api.cpu.retired}</b></div>
            <div className="rvx-metric"><span>Break</span><b>{api.cpu.error ? "Fault" : "None"}</b></div>
          </div>
        </section>
        <section className="rvx-card">
          <h3>Messages</h3>
          {built.ok ? <p><span className="rvx-chip">Assembled</span> {built.words.length} instructions ({built.words.length * 4} bytes).</p> : <p><span className="rvx-chip bad">Error</span> {built.errors[0]?.message}</p>}
          {built.ok && built.listing.some((row) => /^(li|mv|nop|ret)\b/i.test(row.text)) ? <p><span className="rvx-chip warn">Pseudo</span> li, mv, nop, and ret expand to real RV32I instructions in the disassembly.</p> : null}
          {api.cpu.error ? <p>{api.cpu.error}</p> : null}
        </section>
      </div>
      {built.ok ? (
        <section className="rvx-card">
          <h3>Round-trip disassembly</h3>
          <table className="rvx-table">
            <thead><tr><th>Source</th><th>Real instruction</th><th>Hex</th></tr></thead>
            <tbody>{built.listing.map((row) => <tr key={row.pc}><td>{row.text}</td><td>{decode(row.word).text}</td><td className="rvx-mono">{toHex32(row.word)}</td></tr>)}</tbody>
          </table>
        </section>
      ) : null}
    </>
  );
}

const ALU_OPS = ["add", "sub", "and", "or", "xor", "slt", "sll", "srl", "sra"] as const;

export function AluPage() {
  const [rs1, setRs1] = useState(0xf);
  const [rs2, setRs2] = useState(5);
  const [op, setOp] = useState<(typeof ALU_OPS)[number]>("add");
  const result = alu(op, rs1, rs2);
  return (
    <>
      <div className="rvx-grid2">
        <section className="rvx-card">
          <h3>ALU Playground</h3>
          <div className="rvx-cols">
            <Operand label="rs1" value={rs1} onChange={setRs1} />
            <div>
              <p className="tiny">Operation</p>
              <div className="rvx-opgrid">
                {ALU_OPS.map((item) => <button key={item} type="button" className={op === item ? "rvx-btn" : "rvx-btn ghost"} onClick={() => setOp(item)}>{item.toUpperCase()}</button>)}
              </div>
            </div>
            <Operand label="rs2" value={rs2} onChange={setRs2} />
          </div>
          <div className="rvx-row">
            <span className="tiny">Quick examples</span>
            <button type="button" className="rvx-btn ghost" onClick={() => { setRs1(0); setRs2(0); setOp("add"); }}>0 + 0</button>
            <button type="button" className="rvx-btn ghost" onClick={() => { setRs1(15); setRs2(5); setOp("add"); }}>15 + 5</button>
            <button type="button" className="rvx-btn ghost" onClick={() => { setRs1(-1); setRs2(1); setOp("sra"); }}>SRA −1</button>
            <button type="button" className="rvx-btn ghost" onClick={() => { setRs1(0xffffffff); setRs2(1); setOp("add"); }}>wrap</button>
          </div>
        </section>
        <section className="rvx-card">
          <div className="rvx-row" style={{ justifyContent: "space-between" }}><h3>ALU Result</h3><span className="rvx-chip">Valid result</span></div>
          <p className="rvx-mono" style={{ fontSize: 28, margin: 0 }}>{toHex32(result)}</p>
          <div className="rvx-metrics">
            <div className="rvx-metric"><span>Decimal</span><b>{signed32(result)}</b></div>
            <div className="rvx-metric"><span>Hex</span><b>{toHex32(result)}</b></div>
            <div className="rvx-metric"><span>Binary</span><b>{groups(result)}</b></div>
          </div>
          <p className="tiny">rs1 {toHex32(rs1 >>> 0)} {op.toUpperCase()} rs2 {toHex32(rs2 >>> 0)} → rd {toHex32(result)}</p>
        </section>
      </div>
      <div className="rvx-cols">
        <section className="rvx-card">
          <h3>Flags and comparison</h3>
          <p>Zero {result === 0 ? "Yes" : "No"} · Negative {signed32(result) < 0 ? "Yes" : "No"}</p>
          <p>Signed rs1 &lt; rs2: {signed32(rs1) < signed32(rs2) ? "Yes" : "No"} · Unsigned: {(rs1 >>> 0) < (rs2 >>> 0) ? "Yes" : "No"}</p>
          <p className="tiny">SLT uses the signed compare. RV32I has no condition-code register; branches compare in the instruction.</p>
        </section>
        <section className="rvx-card">
          <h3>Worked examples</h3>
          <p>ADD 15 + 5 = 20</p>
          <p>SUB 15 − 5 = 10</p>
          <p>SLT (15 &lt; 5) = 0</p>
          <p>SRA of −8 by 1 keeps the sign.</p>
        </section>
        <section className="rvx-card">
          <h3>Bitwise truth table</h3>
          <table className="rvx-table">
            <thead><tr><th>A</th><th>B</th><th>AND</th><th>OR</th><th>XOR</th></tr></thead>
            <tbody>
              {[[0, 0], [0, 1], [1, 0], [1, 1]].map(([a, b]) => <tr key={`${a}${b}`}><td>{a}</td><td>{b}</td><td>{(a ?? 0) & (b ?? 0)}</td><td>{(a ?? 0) | (b ?? 0)}</td><td>{(a ?? 0) ^ (b ?? 0)}</td></tr>)}
            </tbody>
          </table>
        </section>
      </div>
    </>
  );
}

function Operand({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <div>
      <b>{label}</b>
      <label className="field">Hex <input aria-label={`${label} hex`} value={toHex32(value >>> 0)} onChange={(event) => { const next = parseHexWord(event.target.value); if (next !== null) onChange(next); }} /></label>
      <label className="field">Decimal <input type="number" aria-label={`${label} decimal`} value={signed32(value)} onChange={(event) => onChange(Number(event.target.value) || 0)} /></label>
      <p className="rvx-mono tiny">{groups(value >>> 0)}</p>
    </div>
  );
}

function alu(op: string, rs1: number, rs2: number): number {
  const a = rs1 >>> 0;
  const b = rs2 >>> 0;
  if (op === "sub") return (a - b) >>> 0;
  if (op === "and") return (a & b) >>> 0;
  if (op === "or") return (a | b) >>> 0;
  if (op === "xor") return (a ^ b) >>> 0;
  if (op === "sll") return (a << (b & 31)) >>> 0;
  if (op === "srl") return a >>> (b & 31);
  if (op === "sra") return (signed32(a) >> (b & 31)) >>> 0;
  if (op === "slt") return signed32(a) < signed32(b) ? 1 : 0;
  return (a + b) >>> 0;
}

export function MemoryPage({ api }: { api: RvApi }) {
  const [base, setBase] = useState(2);
  const [offset, setOffset] = useState(4);
  const [rd, setRd] = useState(1);
  const [store, setStore] = useState(true);
  const [before, setBefore] = useState("—");
  const [after, setAfter] = useState("—");
  const baseVal = api.cpu.regs[base] ?? 0;
  const ea = (baseVal + offset) >>> 0;
  const aligned = ea % 4 === 0 && ea < api.cpu.mem.length * 4;
  const run = () => {
    if (!aligned) return;
    const index = ea / 4;
    const previous = toHex32(store ? (api.cpu.mem[index] ?? 0) : (api.cpu.regs[rd] ?? 0));
    api.setCpu((prev) => {
      const mem = prev.mem.slice();
      let regs = prev.regs.slice();
      if (store) mem[index] = regs[rd] ?? 0;
      else regs = writeX(regs, rd, mem[index] ?? 0);
      return { ...prev, mem, regs };
    });
    setBefore(previous);
    setAfter(store ? toHex32(api.cpu.regs[rd] ?? 0) : toHex32(api.cpu.mem[index] ?? 0));
  };
  return (
    <>
      <section className="rvx-card">
        <h3>RISC-V datapath — memory access</h3>
        <div className="rvx-grid2">
          <div>
            <p className="tiny">Registers</p>
            {[0, 1, 2, 3, 4].map((index) => <p key={index} className="rvx-mono">x{index} {toHex32(api.cpu.regs[index] ?? 0)}</p>)}
            <p>Base x{base} {toHex32(baseVal)} + offset {offset} = <b>{toHex32(ea)}</b></p>
            <p className="tiny">{aligned ? "Word-aligned." : "Unaligned or out of range. lw/sw need a multiple of 4."}</p>
          </div>
          <div>
            <h3>Data memory (RAM)</h3>
            <table className="rvx-table">
              <thead><tr><th>Address</th><th>Value</th></tr></thead>
              <tbody>
                {Array.from({ length: 8 }, (_, index) => (
                  <tr key={index} style={{ background: index * 4 === ea ? "#dbeafe" : undefined }}>
                    <td className="rvx-mono">{toHex32(index * 4)}</td>
                    <td><input aria-label={`Memory ${index}`} className="rvx-mono" value={toHex32(api.cpu.mem[index] ?? 0)} onChange={(event) => {
                      const parsed = parseHexWord(event.target.value);
                      if (parsed === null) return;
                      api.setCpu((prev) => { const mem = prev.mem.slice(); mem[index] = parsed; return { ...prev, mem }; });
                    }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
      <div className="rvx-grid2">
        <section className="rvx-card">
          <h3>Try it yourself</h3>
          <div className="rvx-row">
            <button type="button" className={!store ? "rvx-btn" : "rvx-btn ghost"} onClick={() => setStore(false)}>Load (lw)</button>
            <button type="button" className={store ? "rvx-btn" : "rvx-btn ghost"} onClick={() => setStore(true)}>Store (sw)</button>
          </div>
          <p className="rvx-mono">{store ? `sw x${rd}, ${offset}(x${base})` : `lw x${rd}, ${offset}(x${base})`}</p>
          <label className="field">Register <input type="number" aria-label="Data register" min={0} max={31} value={rd} onChange={(event) => setRd(Number(event.target.value) || 0)} /></label>
          <label className="field">Offset <input type="number" aria-label="Offset" value={offset} onChange={(event) => setOffset(Number(event.target.value) || 0)} /></label>
          <label className="field">Base <input type="number" aria-label="Base register" min={0} max={31} value={base} onChange={(event) => setBase(Number(event.target.value) || 0)} /></label>
          <div className="rvx-row">
            <button type="button" className="rvx-btn" onClick={run}>Run instruction</button>
            <button type="button" className="rvx-btn ghost" onClick={() => api.loadSrc(PRESETS.memory ?? "")}>Reset</button>
          </div>
        </section>
        <section className="rvx-card">
          <h3>Effective address</h3>
          <p className="rvx-mono">{toHex32(baseVal)} + {toHex32(offset >>> 0)} = {toHex32(ea)}</p>
          <p>Before {before} → After {after}</p>
          <p className="tiny">{store ? "sw writes the register into memory. The register does not change." : "lw writes memory into rd. Memory does not change."}</p>
        </section>
      </div>
    </>
  );
}

export function BranchPage() {
  return <ControlBoard focus="branches" />;
}
export function JalPage() {
  return <ControlBoard focus="jal" />;
}
export function LuiPage() {
  return <ControlBoard focus="lui" />;
}

function ControlBoard({ focus }: { focus: "branches" | "jal" | "lui" }) {
  const [op, setOp] = useState("beq");
  const [a, setA] = useState(10);
  const [b, setB] = useState(10);
  const [pc, setPc] = useState(0);
  const [imm, setImm] = useState(8);
  const [rs1, setRs1] = useState(4);
  const [link, setLink] = useState(1);
  const [upper, setUpper] = useState(0x12345);
  const taken = branchTaken(op, a, b);
  const next = taken ? (pc + imm) >>> 0 : (pc + 4) >>> 0;
  const jalT = (pc + imm) >>> 0;
  const jalrT = (rs1 + imm) & ~1;
  const lui = (upper << 12) >>> 0;
  return (
    <>
      <div className="rvx-tabs">
        <Link className={focus === "branches" ? "on" : ""} to="/architecture/riscv/branches">Branches</Link>
        <Link className={focus === "jal" ? "on" : ""} to="/architecture/riscv/jal">JAL / JALR</Link>
        <Link className={focus === "lui" ? "on" : ""} to="/architecture/riscv/lui">LUI / AUIPC</Link>
      </div>
      <div className="rvx-cols">
        <section className="rvx-card" style={{ outline: focus === "branches" ? "2px solid #2563eb" : undefined }}>
          <h3>Branches <span className="tiny">PC-relative</span></h3>
          <div className="rvx-row">{["beq", "bne", "blt", "bge", "bltu", "bgeu"].map((item) => <button key={item} type="button" className={op === item ? "rvx-btn" : "rvx-btn ghost"} onClick={() => setOp(item)}>{item.toUpperCase()}</button>)}</div>
          <label className="field">rs1 <input type="number" aria-label="Branch rs1" value={a} onChange={(event) => setA(Number(event.target.value) || 0)} /></label>
          <label className="field">rs2 <input type="number" aria-label="Branch rs2" value={b} onChange={(event) => setB(Number(event.target.value) || 0)} /></label>
          <label className="field">PC <input type="number" aria-label="Branch PC" value={pc} onChange={(event) => setPc(Number(event.target.value) || 0)} /></label>
          <label className="field">Offset <input type="number" aria-label="Branch offset" value={imm} onChange={(event) => setImm(Number(event.target.value) || 0)} /></label>
          <p><span className={taken ? "rvx-chip" : "rvx-chip warn"}>{taken ? "Taken" : "Not taken"}</span> Next PC {toHex32(next)}</p>
          <p className="tiny">PC+4 {toHex32((pc + 4) >>> 0)} · target {toHex32((pc + imm) >>> 0)} · offset {groups(imm >>> 0)}</p>
          <p className="tiny">{op.endsWith("u") ? "Unsigned compare." : op === "blt" || op === "bge" ? "Signed compare." : "Equality compare."}</p>
        </section>
        <section className="rvx-card" style={{ outline: focus === "jal" ? "2px solid #7c3aed" : undefined }}>
          <h3>JAL / JALR</h3>
          <label className="field">Link rd <input type="number" aria-label="Link register" value={link} onChange={(event) => setLink(Number(event.target.value) || 0)} /></label>
          <label className="field">rs1 value <input type="number" aria-label="JALR base" value={rs1} onChange={(event) => setRs1(Number(event.target.value) || 0)} /></label>
          <p>JAL target {toHex32(jalT)} · return address x{link} = {toHex32((pc + 4) >>> 0)}</p>
          <p>JALR target {toHex32(jalrT >>> 0)} (bit 0 cleared)</p>
          <p className="tiny">jal ra, func stores PC+4 and jumps. jalr zero, 0(ra) returns and writes no link.</p>
        </section>
        <section className="rvx-card" style={{ outline: focus === "lui" ? "2px solid #ea580c" : undefined }}>
          <h3>LUI / AUIPC</h3>
          <label className="field">Upper 20 bits <input type="number" aria-label="Upper immediate" value={upper} onChange={(event) => setUpper(Number(event.target.value) || 0)} /></label>
          <p className="rvx-mono">LUI {groups(lui)}</p>
          <p className="rvx-mono">AUIPC {groups((pc + lui) >>> 0)}</p>
          <p className="tiny">Low 12 bits stay 0. AUIPC adds the word to the PC.</p>
        </section>
      </div>
    </>
  );
}

function branchTaken(op: string, a: number, b: number): boolean {
  if (op === "beq") return (a >>> 0) === (b >>> 0);
  if (op === "bne") return (a >>> 0) !== (b >>> 0);
  if (op === "blt") return signed32(a) < signed32(b);
  if (op === "bge") return signed32(a) >= signed32(b);
  if (op === "bltu") return (a >>> 0) < (b >>> 0);
  return (a >>> 0) >= (b >>> 0);
}

export function ImmPage() {
  return <ImmBoard focus="imm" />;
}
export function DatapathPage({ api }: { api: RvApi }) {
  return <ImmBoard focus="path" api={api} />;
}

function ImmBoard({ focus, api }: { focus: "imm" | "path"; api?: RvApi }) {
  const [format, setFormat] = useState<RvFormat>("I");
  const [hex, setHex] = useState(toHex32(sampleWord("I")));
  const word = parseHexWord(hex) ?? 0;
  const decoded = decode(word);
  const moves = immBits(format === "R" ? "I" : format, word);
  return (
    <>
      <section className="rvx-card" style={{ outline: focus === "imm" ? "2px solid #2563eb" : undefined }}>
        <h3>Immediate generation from instruction bits</h3>
        <div className="rvx-row">{(["I", "S", "B", "U", "J"] as RvFormat[]).map((item) => <button key={item} type="button" className={format === item ? "rvx-btn" : "rvx-btn ghost"} onClick={() => { setFormat(item); setHex(toHex32(sampleWord(item))); }}>{item}-type</button>)}</div>
        <label className="field">Instruction hex <input aria-label="Immediate instruction" value={hex} onChange={(event) => setHex(event.target.value)} /></label>
        <div className="rvx-fmts">
          {(["I", "S", "B", "U", "J"] as RvFormat[]).map((item) => <FormatCard key={item} format={item} selected={format === item} onPick={() => { setFormat(item); setHex(toHex32(sampleWord(item))); }} />)}
        </div>
        <p>Sign bit fills unused high bits. B and J force bit 0 to 0. Result {decoded.imm} · {toHex32(decoded.imm >>> 0)}</p>
        <div className="rvx-bits">{moves.map((move) => <span key={`${move.src}-${move.dst}`} style={{ background: move.value ? "#bfdbfe" : "#f8fafc", fontSize: 10, padding: 3 }}>{move.src}→{move.dst}</span>)}</div>
      </section>
      <section className="rvx-card" style={{ outline: focus === "path" ? "2px solid #2563eb" : undefined }}>
        <h3>Single-cycle datapath</h3>
        <DatapathSvg hot={decoded} />
        <p>{decoded.text} · imm {decoded.imm} · next PC {api ? toHex32((api.cpu.pc + 4) >>> 0) : "PC+4"}</p>
        {api ? <button type="button" className="rvx-btn" onClick={() => api.setCpu((prev) => stepRv(prev))}>Step this instruction</button> : null}
      </section>
    </>
  );
}

function DatapathSvg({ hot }: { hot: { mnemonic: string; format: string } }) {
  const mem = hot.mnemonic === "lw" || hot.mnemonic === "sw";
  const branch = hot.format === "B" || hot.mnemonic === "jal" || hot.mnemonic === "jalr";
  return (
    <svg className="rvx-svg rvx-diagram" viewBox="0 0 640 220" role="img" aria-label="Single-cycle datapath">
      <path className="rvx-flow" d="M70 40 H120 M210 40 H250 M360 50 H420 M500 70 V110 H430" fill="none" stroke={mem ? "#16a34a" : "#2563eb"} strokeWidth="2" />
      <rect x="8" y="20" width="60" height="36" rx="8" fill="#dbeafe" /><text x="38" y="42" textAnchor="middle">PC</text>
      <rect x="120" y="20" width="90" height="36" rx="8" fill="#ede9fe" /><text x="165" y="42" textAnchor="middle">I-Mem</text>
      <rect x="250" y="16" width="100" height="40" rx="8" fill="#dcfce7" /><text x="300" y="40" textAnchor="middle">Reg File</text>
      <rect x="250" y="80" width="100" height="36" rx="8" fill="#fae8ff" /><text x="300" y="102" textAnchor="middle">Imm Gen</text>
      <rect x="420" y="40" width="70" height="50" rx="8" fill="#ffedd5" /><text x="455" y="70" textAnchor="middle">ALU</text>
      <rect x="520" y="90" width="100" height="40" rx="8" fill={mem ? "#bbf7d0" : "#fff"} stroke="#cbd5e1" /><text x="570" y="114" textAnchor="middle">D-Mem</text>
      <rect x="120" y="150" width="120" height="36" rx="8" fill={branch ? "#fecaca" : "#fff"} stroke="#cbd5e1" /><text x="180" y="172" textAnchor="middle">Next PC</text>
      <text x="430" y="30" fontSize="10">ALUSrc</text>
      <text x="530" y="80" fontSize="10">{mem ? "MemRead/Write" : "Mem off"}</text>
    </svg>
  );
}

export function MultiPage({ api }: { api: RvApi }) {
  return <PipeBoard focus="multi" api={api} />;
}
export function PipePage({ hazards }: { hazards?: boolean }) {
  return <PipeBoard focus={hazards ? "hazard" : "pipe"} />;
}

function PipeBoard({ focus, api }: { focus: "multi" | "pipe" | "hazard"; api?: RvApi }) {
  const [forward, setForward] = useState(true);
  const [tick, setTick] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [stage, setStage] = useState(0);
  const [text, setText] = useState("add x1, x2, x3\nlw x4, 0(x1)\nsub x5, x4, x6\nand x7, x5, x8\nor x9, x7, x10");
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const rows = useMemo(() => schedulePipe(lines, forward), [lines, forward]);
  const stalls = rows.reduce((sum, row) => sum + row.cells.filter((cell) => cell === "stall").length, 0);
  useEffect(() => {
    if (!playing) return undefined;
    const id = window.setInterval(() => setTick((value) => value + 1), 700);
    return () => window.clearInterval(id);
  }, [playing]);
  const stages = [
    ["IF", "Instruction fetch", "#dbeafe"],
    ["ID", "Instruction decode", "#ede9fe"],
    ["EX", "Execute", "#ffedd5"],
    ["MEM", "Memory access", "#dcfce7"],
    ["WB", "Write back", "#fce7f3"],
  ];
  return (
    <>
      <div className="rvx-tabs">
        <Link className={focus === "multi" ? "on" : ""} to="/architecture/riscv/multicycle">Multi-Cycle Concept</Link>
        <Link className={focus === "pipe" ? "on" : ""} to="/architecture/riscv/pipeline">Pipeline</Link>
        <Link className={focus === "hazard" ? "on" : ""} to="/architecture/riscv/hazards">Hazards & Forwarding</Link>
      </div>
      <section className="rvx-card">
        <h3>The 5-stage RISC-V pipeline</h3>
        <div className="rvx-row">{stages.map(([name, label, color], index) => <div key={name} className="rvx-stage" style={{ background: color, outline: tick % 5 === index ? "2px solid #2563eb" : undefined }}><b>{name}</b>{label}</div>)}</div>
      </section>
      <div className="rvx-grid2">
        <section className="rvx-card" style={{ outline: focus === "pipe" ? "2px solid #2563eb" : undefined }}>
          <h3>Cycle-by-cycle flow</h3>
          <textarea aria-label="Pipeline program" value={text} onChange={(event) => { setText(event.target.value); setTick(0); }} />
          <div className="rvx-row">
            <button type="button" className="rvx-btn" onClick={() => setTick((value) => value + 1)}>Step Cycle</button>
            <button type="button" className="rvx-btn ghost" onClick={() => setPlaying((value) => !value)}>{playing ? "Pause" : "Run"}</button>
            <button type="button" className="rvx-btn ghost" onClick={() => { setTick(0); setPlaying(false); }}>Reset</button>
            {focus === "hazard" ? <button type="button" className={forward ? "rvx-btn" : "rvx-btn ghost"} onClick={() => setForward((value) => !value)}>Forwarding {forward ? "ON" : "OFF"}</button> : null}
          </div>
          <table className="rvx-table">
            <thead><tr><th>Instruction</th>{Array.from({ length: 10 }, (_, index) => <th key={index}>C{index + 1}</th>)}</tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.text}><td>{row.text}</td>{row.cells.map((cell, index) => <td key={index} style={{ background: index === tick ? "#dbeafe" : cell === "stall" ? "#fee2e2" : undefined }}>{index <= tick ? cell : ""}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="rvx-card">
          <h3>Pipeline performance</h3>
          <p>Ideal CPI 1.0 · fill penalty 4 cycles · stalls this sequence {stalls}</p>
          <p className="tiny">{forward ? "Forwarding removes most ALU RAW stalls. A load-use still inserts one bubble." : "Without forwarding, a reader waits until the writer reaches writeback."}</p>
          {focus === "multi" ? (
            <div>
              <h3>Multi-cycle reuse</h3>
              <div className="rvx-row">{["Fetch", "Decode", "Execute", "Memory", "Writeback"].map((name, index) => <span key={name} className={index === stage % 5 ? "rvx-btn" : "rvx-btn ghost"}>{name}</span>)}</div>
              <button type="button" className="rvx-btn" onClick={() => { const next = stage + 1; setStage(next); if (api && next % 5 === 0) api.setCpu((prev) => stepRv(prev)); }}>Step cycle</button>
              <p className="tiny">One instruction uses the ALU, register file, and memory across several clocks.</p>
            </div>
          ) : null}
          {focus === "hazard" ? <p>RAW: a later instruction reads a register an earlier one has not written. Load-use cannot forward from EX. Control hazards flush the wrong-path instructions.</p> : null}
        </section>
      </div>
    </>
  );
}

function schedulePipe(lines: string[], forwarding: boolean): Array<{ text: string; cells: string[] }> {
  const starts: number[] = [];
  const produced: Array<{ rd: number; ready: number }> = [];
  lines.forEach((text, index) => {
    const built = assemble(text);
    const decoded = built.ok ? decode(built.words[0] ?? 0) : null;
    let start = index === 0 ? 0 : (starts[index - 1] ?? 0) + 1;
    if (decoded && !decoded.error) {
      const reads = decoded.format === "U" || decoded.mnemonic === "jal" ? [] : [decoded.rs1, decoded.rs2];
      produced.forEach((item) => {
        if (item.rd !== 0 && reads.includes(item.rd) && start + 2 < item.ready) start += item.ready - (start + 2);
      });
      produced.push({ rd: decoded.rd, ready: forwarding && decoded.mnemonic !== "lw" ? start + 3 : start + 4 });
    }
    starts.push(start);
  });
  return lines.map((text, index) => {
    const cells = Array.from({ length: 10 }, () => "");
    const start = starts[index] ?? 0;
    ["IF", "ID", "EX", "MEM", "WB"].forEach((name, stageIndex) => {
      const at = start + stageIndex;
      if (at < cells.length) cells[at] = name;
    });
    if (index > 0 && start > (starts[index - 1] ?? 0) + 1) {
      const bubble = start - 1;
      if (bubble >= 0 && bubble < cells.length && cells[bubble] === "") cells[bubble] = "stall";
    }
    return { text, cells };
  });
}

export function ProgramPage({ api }: { api: RvApi }) {
  const [radix, setRadix] = useState<"hex" | "dec">("hex");
  const lines = api.source.split("\n");
  const built = assemble(api.source);
  return (
    <>
      <div className="rvx-grid2">
        <section className="rvx-card">
          <div className="rvx-row">
            <b>RV32I program</b>
            <select aria-label="Example program" defaultValue="sum" onChange={(event) => api.loadSrc(PRESETS[event.target.value] ?? PRESETS.sum ?? "")}>
              {Object.keys(PRESETS).map((id) => <option key={id} value={id}>{id}</option>)}
            </select>
          </div>
          <div className="rvx-editor">
            <div className="gutter">{lines.map((_, index) => <div key={index}>{index + 1}</div>)}</div>
            <pre dangerouslySetInnerHTML={{ __html: `${paint(api.source)}\n` }} />
            <textarea aria-label="Program source" value={api.source} spellCheck={false} onChange={(event) => api.setSource(event.target.value)} />
          </div>
          <div className="rvx-row">
            <button type="button" className="rvx-btn" style={{ background: "#16a34a" }} onClick={() => api.loadSrc(api.source)}>Assemble</button>
            <button type="button" className="rvx-btn ghost" onClick={() => api.loadSrc(api.source)}>Load to CPU</button>
            <button type="button" className="rvx-btn" onClick={() => api.setPlaying(!api.playing)}>{api.playing ? "Pause" : "Run"}</button>
            <button type="button" className="rvx-btn ghost" onClick={() => api.setCpu((prev) => stepRv(prev))}>Step Instruction</button>
            <button type="button" className="rvx-btn ghost" onClick={() => api.setCpu((prev) => stepRv(prev))}>Step Cycle</button>
            <button type="button" className="rvx-btn ghost" onClick={() => api.loadSrc(PRESETS.sum ?? "")}>Reset</button>
          </div>
        </section>
        <section className="rvx-card">
          <h3>Machine state <span className={api.playing ? "rvx-chip" : "rvx-chip warn"}>{api.cpu.halted ? "Halted" : api.playing ? "Running" : "Ready"}</span></h3>
          <div className="rvx-metrics">
            <div className="rvx-metric"><span>PC</span><b>{toHex32(api.cpu.pc)}</b></div>
            <div className="rvx-metric"><span>IR</span><b>{toHex32(api.cpu.ir)}</b></div>
            <div className="rvx-metric"><span>Cycles</span><b>{api.cpu.cycles}</b></div>
            <div className="rvx-metric"><span>Retired</span><b>{api.cpu.retired}</b></div>
          </div>
          <p>Current: {api.cpu.decoded?.text ?? "—"}</p>
          {!built.ok ? <p>{built.errors.map((item) => `Line ${item.line}: ${item.message}`).join(" ")}</p> : null}
        </section>
      </div>
      <div className="rvx-cols">
        <section className="rvx-card">
          <div className="rvx-row"><h3>Registers</h3><button type="button" className="rvx-btn ghost" onClick={() => setRadix(radix === "hex" ? "dec" : "hex")}>{radix}</button></div>
          <div className="rvx-regs">
            {api.cpu.regs.map((value, index) => (
              <button key={index} type="button" className={`rvx-reg ${tone(index)} ${api.sel === index ? "sel" : ""}`} onClick={() => api.setSel(index)}>
                <b>x{index}</b>
                <small>{radix === "hex" ? toHex32(value) : String(signed32(value))}</small>
              </button>
            ))}
          </div>
        </section>
        <section className="rvx-card">
          <h3>Data memory</h3>
          <table className="rvx-table"><tbody>{Array.from(api.cpu.mem.slice(0, 8)).map((word, index) => <tr key={index}><td>{toHex32(index * 4)}</td><td className="rvx-mono">{toHex32(word)}</td><td>{word}</td></tr>)}</tbody></table>
        </section>
        <section className="rvx-card">
          <h3>Execution trace</h3>
          <ol>{api.cpu.trace.slice(-10).map((line) => <li key={line}>{line}</li>)}</ol>
        </section>
      </div>
    </>
  );
}
