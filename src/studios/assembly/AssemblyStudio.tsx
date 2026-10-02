import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { usePrefs } from "../../store/prefs";
import { reducedMotion } from "../aca/animation/acaMotion";
import { assemble, formatInstruction } from "../../engines/isa/assembler";
import { loadProgram, stepStage, type CpuState } from "../../engines/isa/cpu";
import { SAMPLE_ADD, SAMPLE_LOOP, runUntil, stepFetch, stepInstruction, stepOver, wordHex, type TraceRow } from "../../engines/isa/assemblyRun";
import { decode, fieldValue, fieldsOf, operate, type Decoded } from "../../engines/isa/spec";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "fetch", label: "Fetch" },
  { id: "decode", label: "Decode" },
  { id: "execute", label: "Execute" },
  { id: "memory", label: "Memory" },
  { id: "trace", label: "Trace" },
] as const;

const ALIAS: Record<string, string> = { run: "overview" };

const PAGE: Record<string, { guide: string[]; takeaways: string[]; quote: string; by: string; next: string; nextTab: string }> = {
  overview: {
    guide: ["Load the sample, or edit the LogicLab-16 program.", "Run executes until HALT or a breakpoint.", "Step retires one instruction.", "Open Fetch to watch the PC read instruction memory."],
    takeaways: ["Each instruction moves through fetch, decode, execute, memory, and write-back.", "Only LOAD and STORE touch data memory.", "The PC is a word address. It advances by one 16-bit instruction."],
    quote: "Small instructions. Big understanding.",
    by: "Digital Electronics & Computing Lab",
    next: "Open Fetch and watch one instruction move into the IR.",
    nextTab: "fetch",
  },
  fetch: {
    guide: ["Read the PC. It names the next instruction word.", "Step Fetch highlights that word and loads the IR.", "The PC then advances by one word, not four bytes.", "Step again to fetch the next instruction."],
    takeaways: ["The PC holds the address of the next instruction.", "Fetch copies that instruction word into the IR.", "LogicLab-16 instructions are 16 bits, so the PC increases by 1."],
    quote: "Fetch is the CPU's first step. It brings the next instruction into view.",
    by: "Digital Electronics & Computing Lab",
    next: "Open Decode and split the fetched word into fields.",
    nextTab: "decode",
  },
  decode: {
    guide: ["Fetch an instruction, or Step Decode will fetch it first.", "Click a field. The same bits light up in every view.", "Read the control signals for this opcode.", "Reset returns the machine to the first word."],
    takeaways: ["The opcode chooses the operation.", "Register fields name R0–R7, not the values in them.", "The decoder emits only the signals this instruction needs."],
    quote: "Decoding turns bits into meaning.",
    by: "Digital Electronics & Computing Lab",
    next: "Open Execute and watch the ALU use those signals.",
    nextTab: "execute",
  },
  execute: {
    guide: ["The decoded instruction chooses the ALU operation.", "Experiment mode previews another operation without writing it.", "Step Execute performs the real instruction.", "Branches compare registers. The PC changes when the branch resolves."],
    takeaways: ["The ALU result is 16 bits wide.", "N, Z, C, and V come from that result.", "BEQ is taken when the two registers are equal. BNE is taken when they differ."],
    quote: "The ALU is the CPU's calculator, and the flags are its memory of what just happened.",
    by: "Digital Electronics & Computing Lab",
    next: "Open Memory to see a load or a store use the effective address.",
    nextTab: "memory",
  },
  memory: {
    guide: ["LOAD reads Mem[base + offset] into a register.", "STORE writes a register into Mem[base + offset].", "The offset is a signed 6-bit immediate, from −32 to 31.", "Step Memory performs the program's memory stage."],
    takeaways: ["The effective address is the base register plus the offset.", "A load changes a register. A store changes memory.", "The address is not the operand. Mem[EA] is the operand."],
    quote: "Memory is where the program's data lives.",
    by: "Digital Electronics & Computing Lab",
    next: "Open Trace and pause the same program on a breakpoint.",
    nextTab: "trace",
  },
  trace: {
    guide: ["Run or step the program. Each retired instruction adds one row.", "Click the gutter to set a breakpoint. Run pauses before that word.", "Edit a register, then step again.", "Reset reloads the source and clears the trace."],
    takeaways: ["The trace records what changed, not a canned script.", "A breakpoint pauses before the marked instruction executes.", "A taken branch shows the PC leaving the sequential address."],
    quote: "Tracing turns a black box into a story you can follow, one instruction at a time.",
    by: "Digital Electronics & Computing Lab",
    next: "Return to Overview.",
    nextTab: "overview",
  },
};

function boot(source: string): CpuState {
  const loaded = loadProgram(source);
  if ("error" in loaded) return loadProgram("HALT\n") as CpuState;
  return loaded;
}

function Mark({ kind }: { kind: string }) {
  const p = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (kind === "cpu") return <svg {...p}><rect x="6" y="6" width="12" height="12" rx="2" /><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" /></svg>;
  if (kind === "play") return <svg {...p}><path d="M8 6l10 6-10 6z" fill="currentColor" stroke="none" /></svg>;
  if (kind === "step") return <svg {...p}><path d="M6 5v14M10 8l8 4-8 4z" /></svg>;
  if (kind === "reset") return <svg {...p}><path d="M4 12a8 8 0 1 0 2.3-5.7" /><path d="M4 4v5h5" /></svg>;
  if (kind === "book") return <svg {...p}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z" /></svg>;
  if (kind === "bulb") return <svg {...p}><path d="M9 18h6M10 21h4" /><path d="M8 14a6 6 0 1 1 8 0c-.8.7-1.2 1.4-1.4 2.2H9.4C9.2 15.4 8.8 14.7 8 14z" /></svg>;
  if (kind === "dot") return <svg {...p}><circle cx="12" cy="12" r="5" fill="currentColor" stroke="none" /></svg>;
  return <svg {...p}><circle cx="12" cy="12" r="8" /></svg>;
}

function paint(line: string) {
  const parts: Array<{ text: string; kind: string }> = [];
  const re = /;.*$|[A-Za-z_]\w*:|\b(?:ADDI|ADD|SUB|AND|OR|XOR|LOAD|STORE|BEQ|BNE|J|CALL|RET|HALT|NOP|SLT|SLL|SRL|SRA)\b|\bR[0-7]\b|-?0x[0-9a-fA-F]+|-?\d+/g;
  let cursor = 0;
  for (const match of line.matchAll(re)) {
    const text = match[0];
    const at = match.index ?? 0;
    if (at > cursor) parts.push({ text: line.slice(cursor, at), kind: "" });
    const kind = text.startsWith(";") ? "cmt" : text.endsWith(":") ? "lab" : /^R[0-7]$/.test(text) ? "reg" : /^-?\d|^-?0x/i.test(text) ? "num" : "op";
    parts.push({ text, kind });
    cursor = at + text.length;
  }
  if (cursor < line.length) parts.push({ text: line.slice(cursor), kind: "" });
  return parts.map((part, index) => <span key={`${part.text}-${index}`} className={part.kind}>{part.text}</span>);
}

export function AssemblyStudio() {
  const root = useRef<HTMLDivElement>(null);
  const autoCount = useRef(0);
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab");
  const aliased = raw ? ALIAS[raw] ?? raw : "overview";
  const tab = TABS.some((item) => item.id === aliased) ? aliased : "overview";
  const page = PAGE[tab] ?? PAGE.overview;
  const { prefs } = usePrefs();
  const [source, setSource] = useState(SAMPLE_ADD);
  const [loadedSource, setLoadedSource] = useState(SAMPLE_ADD);
  const [cpu, setCpu] = useState(() => boot(SAMPLE_ADD));
  const [rows, setRows] = useState<TraceRow[]>([]);
  const [breaks, setBreaks] = useState<number[]>([]);
  const [pausedAt, setPausedAt] = useState<number | null>(null);
  const [tick, setTick] = useState(0);
  const [error, setError] = useState("");
  const [autoFetch, setAutoFetch] = useState(false);
  const built = useMemo(() => assemble(source), [source]);
  useGSAP(() => {
    if (!tick || reducedMotion()) return;
    gsap.fromTo(".ax-hot", { scale: 1.03 }, { scale: 1, duration: 0.35, clearProps: "scale" });
  }, { scope: root, dependencies: [tick] });

  useEffect(() => {
    if (!autoFetch) {
      autoCount.current = 0;
      return;
    }
    if ((cpu.halted && cpu.stage === "done") || autoCount.current > 48) {
      setAutoFetch(false);
      return;
    }
    const id = window.setTimeout(() => {
      autoCount.current += 1;
      const fetched = stepFetch(cpu);
      setCpu(fetched.state);
      if (fetched.row) setRows((current) => [...current, { ...fetched.row!, index: current.length + 1 }]);
      setPausedAt(null);
      setTick((value) => value + 1);
    }, reducedMotion() ? 0 : 480);
    return () => window.clearTimeout(id);
  }, [autoFetch, cpu]);

  function setTab(id: string) {
    const next = new URLSearchParams(params);
    next.set("tab", id);
    setParams(next);
  }

  function reload(text: string) {
    const loaded = loadProgram(text);
    if ("error" in loaded) {
      setError(loaded.error);
      return null;
    }
    setError("");
    setLoadedSource(text);
    setCpu(loaded);
    setRows([]);
    setPausedAt(null);
    setTick((value) => value + 1);
    return loaded;
  }

  function commit(next: CpuState, row?: TraceRow | null) {
    setCpu(next);
    if (row) setRows((current) => [...current, { ...row, index: current.length + 1 }]);
    setPausedAt(null);
    setTick((value) => value + 1);
  }

  function run() {
    const base = source === loadedSource ? cpu : reload(source);
    if (!base) return;
    const ran = runUntil(base, breaks, source === loadedSource ? rows.length + 1 : 1, 80, pausedAt !== null && base.pc === pausedAt);
    setCpu(ran.state);
    setRows(source === loadedSource ? (current) => [...current, ...ran.rows] : ran.rows);
    setPausedAt(ran.pausedAt);
    setTick((value) => value + 1);
  }

  function step() {
    const base = source === loadedSource ? cpu : reload(source);
    if (!base) return;
    const stepped = stepInstruction(base, rows.length + 1);
    commit(stepped.state, stepped.row);
  }

  function reset() {
    setAutoFetch(false);
    reload(source);
    setBreaks([]);
  }

  function over() {
    const base = source === loadedSource ? cpu : reload(source);
    if (!base) return;
    const stepped = stepOver(base, source === loadedSource ? rows.length + 1 : 1);
    setCpu(stepped.state);
    setRows((current) => {
      const prior = source === loadedSource ? current : [];
      return [...prior, ...stepped.rows.map((row, index) => ({ ...row, index: prior.length + index + 1 }))];
    });
    setPausedAt(null);
    setTick((value) => value + 1);
  }

  function reach(target: "ID" | "EX" | "MEM" | "WB") {
    if (cpu.stage === "done") return;
    const order = ["IF", "ID", "EX", "MEM", "WB"];
    let next = cpu;
    let retired: TraceRow | null = null;
    if (order.indexOf(next.stage) >= order.indexOf(target)) {
      const finished = stepInstruction(next, rows.length + 1);
      retired = finished.row;
      next = finished.state;
    }
    let guard = 0;
    while (next.stage !== target && next.stage !== "done" && guard < 6) {
      next = stepStage(next);
      guard += 1;
    }
    commit(next, retired);
  }

  function toggleBreak(address: number) {
    setBreaks((current) => current.includes(address) ? current.filter((item) => item !== address) : [...current, address]);
  }

  function setReg(index: number, value: number) {
    setCpu((current) => {
      const regs = current.regs.slice();
      regs[index] = value & 0xffff;
      return { ...current, regs };
    });
  }

  function setMem(address: number, value: number) {
    setCpu((current) => {
      const dmem = current.dmem.slice();
      dmem[address & 0xff] = value & 0xffff;
      return { ...current, dmem };
    });
  }

  const shared = { source, setSource, cpu, rows, breaks, toggleBreak, pausedAt, explain: prefs.explain, dirty: source !== loadedSource, error, built, setReg, setMem, setTab, tick };
  if (!page) return null;

  return (
    <div className={prefs.explain ? "ax" : "ax ax-brief"} ref={root}>
      <header className="ax-head">
        <div>
          <h1><Mark kind="cpu" /> Assembly Execution <span>Virtual Lab Studio</span></h1>
          <p>Explore how LogicLab-16 instructions move through the CPU, change registers, and update memory.</p>
        </div>
        <ol className="ax-stack" aria-label="Pipeline stages">
          {["Fetch", "Decode", "Execute", "Memory"].map((item) => <li key={item} className={tab === item.toLowerCase() ? "on" : ""}>{item}</li>)}
        </ol>
      </header>
      <div className="ax-tabs" role="tablist" aria-label="Assembly execution">
        {TABS.map((item) => <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} className={tab === item.id ? "on" : ""} onClick={() => setTab(item.id)}>{item.label}</button>)}
      </div>
      <div className="ax-grid">
        <div className="ax-main">
          <div hidden={tab !== "overview"} inert={tab !== "overview" ? true : undefined}><Overview {...shared} run={run} step={step} reset={reset} onSample={(text) => { setSource(text); reload(text); }} /></div>
          <div hidden={tab !== "fetch"} inert={tab !== "fetch" ? true : undefined}><FetchPanel {...shared} auto={autoFetch} onAuto={() => setAutoFetch((value) => !value)} onStep={() => { setAutoFetch(false); const fetched = stepFetch(cpu); commit(fetched.state, fetched.row); }} reset={reset} /></div>
          <div hidden={tab !== "decode"} inert={tab !== "decode" ? true : undefined}><DecodePanel {...shared} onStep={() => reach("EX")} reset={reset} /></div>
          <div hidden={tab !== "execute"} inert={tab !== "execute" ? true : undefined}><ExecutePanel {...shared} onStep={() => reach("MEM")} onRun={step} reset={reset} /></div>
          <div hidden={tab !== "memory"} inert={tab !== "memory" ? true : undefined}><MemoryPanel {...shared} onStep={() => reach("WB")} reset={reset} commit={commit} /></div>
          <div hidden={tab !== "trace"} inert={tab !== "trace" ? true : undefined}><TracePanel {...shared} run={run} step={step} over={over} reset={reset} onSample={(text) => { setSource(text); reload(text); }} clearTrace={() => setRows([])} /></div>
        </div>
        <aside className="ax-side">
          <section>
            <h2><Mark kind="book" /> Studio Guide</h2>
            <ol>{page.guide.map((item, index) => <li key={item}><span>{index + 1}</span>{item}</li>)}</ol>
          </section>
          <section className="takes">
            <h2><Mark kind="bulb" /> Key Takeaways</h2>
            <ul>{page.takeaways.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>
          <blockquote><p>“{page.quote}”</p><cite>— {page.by}</cite></blockquote>
          <section className="next">
            <h2>Next Up</h2>
            <p>{page.next}</p>
            <button type="button" onClick={() => setTab(page.nextTab)}>{TABS.find((item) => item.id === page.nextTab)?.label} →</button>
          </section>
        </aside>
      </div>
    </div>
  );
}

interface Shared {
  source: string;
  setSource: (value: string) => void;
  cpu: CpuState;
  rows: TraceRow[];
  breaks: number[];
  toggleBreak: (address: number) => void;
  pausedAt: number | null;
  explain: boolean;
  dirty: boolean;
  error: string;
  built: ReturnType<typeof assemble>;
  setReg: (index: number, value: number) => void;
  setMem: (address: number, value: number) => void;
  setTab: (id: string) => void;
  tick: number;
}

function currentDecoded(cpu: CpuState): Decoded {
  if (cpu.decoded && cpu.stage !== "IF") return cpu.decoded;
  return decode(cpu.imem[cpu.pc] ?? 0);
}

function Editor({ source, setSource, cpu, breaks, toggleBreak, built, editing }: Shared & { editing: boolean }) {
  const lines = source.split(/\n/);
  const focus = cpu.stage === "IF" ? cpu.pc : cpu.instPc;
  const activeLine = built.ok ? built.listing.find((row) => row.address === focus)?.line : undefined;
  return (
    <div className="ax-editor">
      <div className="ax-gutter">
        {lines.map((_, index) => {
          const address = built.ok ? built.listing.find((row) => row.line === index + 1)?.address : undefined;
          const marked = address !== undefined && breaks.includes(address);
          return <button key={index} type="button" className={activeLine === index + 1 ? "on" : ""} aria-label={address === undefined ? `Line ${index + 1}` : `Breakpoint at word ${address}`} onClick={() => { if (address !== undefined) toggleBreak(address); }}>{marked ? <Mark kind="dot" /> : index + 1}</button>;
        })}
      </div>
      <div className="ax-sheet">
        <pre className="ax-paint" aria-hidden="true">{lines.map((line, index) => <div key={index} className={activeLine === index + 1 ? "on ax-hot" : ""}>{paint(line) || " "}</div>)}</pre>
        {editing ? <textarea aria-label="Assembly program" value={source} spellCheck={false} onChange={(event) => setSource(event.target.value)} /> : null}
      </div>
    </div>
  );
}

function pathNodes(decoded: Decoded, cpu: CpuState): string[] {
  const ea = ((cpu.regs[decoded.rs1] ?? 0) + decoded.imm) & 0xff;
  if (decoded.mnemonic === "STORE") return [`R${decoded.rs2} = ${cpu.regs[decoded.rs2] ?? 0}`, `EA ${ea}`, `Mem[${ea}]`];
  if (decoded.mnemonic === "LOAD") return [`EA ${ea}`, `Mem[${ea}] = ${cpu.dmem[ea] ?? 0}`, `R${decoded.rd}`];
  if (decoded.branch || decoded.jump) return [`R${decoded.rs1}`, decoded.mnemonic, `PC ${wordHex((cpu.instPc + decoded.imm) & 0xff)}`];
  if (decoded.aluSrc === "imm") return [`R${decoded.rs1} = ${cpu.regs[decoded.rs1] ?? 0}`, `${decoded.aluOp} ${decoded.imm}`, `R${decoded.rd}`];
  if (decoded.aluOp === "NONE") return [decoded.mnemonic, "PC"];
  return [`R${decoded.rs1} = ${cpu.regs[decoded.rs1] ?? 0}`, `R${decoded.rs2} = ${cpu.regs[decoded.rs2] ?? 0}`, decoded.aluOp, `R${decoded.rd}`];
}

function Overview(props: Shared & { run: () => void; step: () => void; reset: () => void; onSample: (source: string) => void }) {
  const decoded = currentDecoded(props.cpu);
  const last = props.rows.at(-1);
  const ir = props.cpu.cycles === 0 && props.cpu.stage === "IF" ? "—" : wordHex(props.cpu.ir);
  const stages = [
    { id: "", title: "Assembly source", body: "The program the CPU will fetch." },
    { id: "IF", title: "Fetch", body: "PC selects the next instruction word." },
    { id: "ID", title: "Decode", body: "Fields become an operation." },
    { id: "EX", title: "Execute", body: "The ALU or compare runs." },
    { id: "MEM", title: "Memory", body: "LOAD and STORE touch data memory." },
    { id: "WB", title: "Write back", body: "The result is committed." },
  ];
  return (
    <div className="ax-overview">
      <section className="ax-card ax-banner">
        <div className="ax-banner-top">
          <div>
            <h2>Execution cycle</h2>
            <p>One LogicLab-16 instruction moves through these stages. The highlighted stage is the one in progress.</p>
          </div>
          <span className="ax-badge">{props.cpu.halted ? "Halted" : `Cycle ${props.cpu.cycles}`}</span>
        </div>
        <div className="ax-stepflow">
          {stages.map((item) => <div key={item.title} className={`ax-step ${props.cpu.stage === item.id ? "on" : ""}`}><strong>{item.title}</strong><small>{item.body}</small></div>)}
        </div>
      </section>
      <section className="ax-card">
        <div className="ax-card-top">
          <h2>Program</h2>
          <label className="ax-pick">Sample
            <select aria-label="Sample program" value={props.source === SAMPLE_LOOP ? "loop" : "add"} onChange={(event) => props.onSample(event.target.value === "loop" ? SAMPLE_LOOP : SAMPLE_ADD)}>
              <option value="add">Add and store</option>
              <option value="loop">Sum loop</option>
            </select>
          </label>
        </div>
        <Editor {...props} editing />
        {props.dirty ? <p className="ax-warn">Source changed. Run or Step reloads it before executing.</p> : null}
        {!props.built.ok ? props.built.errors.map((item) => <p key={`${item.line}-${item.message}`} className="ax-warn">Line {item.line}: {item.message}</p>) : null}
        {props.error ? <p className="ax-warn">{props.error}</p> : null}
        <div className="ax-actions">
          <button type="button" className="ax-go" onClick={props.run}><Mark kind="play" /> Run</button>
          <button type="button" className="ax-quiet" onClick={props.step}><Mark kind="step" /> Step</button>
          <button type="button" className="ax-quiet" onClick={props.reset}><Mark kind="reset" /> Reset</button>
        </div>
      </section>
      <section className="ax-card">
        <h2>CPU state</h2>
        <div className="ax-pair"><span>Program counter</span><b className="mono">{wordHex(props.cpu.pc)}</b></div>
        <div className="ax-pair"><span>Instruction register</span><b className="mono">{ir}</b></div>
        <Flags flags={props.cpu.flags} />
        <div className="ax-pair"><span>Cycle count</span><b>{props.cpu.cycles}</b></div>
        {props.explain ? <p className="ax-note">PC {wordHex(props.cpu.pc)} is the next word. The instruction in flight started at {wordHex(props.cpu.instPc)}.</p> : null}
      </section>
      <RegFile cpu={props.cpu} decoded={decoded} hot={last} onEdit={props.setReg} />
      <MemSnap cpu={props.cpu} hot={last} onEdit={props.setMem} />
      <section className="ax-card ax-span">
        <h2>Data path</h2>
        <div className="ax-path">
          {pathNodes(decoded, props.cpu).map((node) => <div key={node} className={props.tick ? "ax-node ax-hot" : "ax-node"}>{node}</div>)}
        </div>
        <p>{formatInstruction(decoded)}</p>
      </section>
      <section className="ax-card ax-result ax-span">
        <h2>Result</h2>
        {last ? <p><b>{last.text}</b> {last.regs.join(" · ") || "No register write"}{last.mem.length ? ` · ${last.mem.join(" · ")}` : ""}{last.flags ? ` · ${last.flags}` : ""}</p> : <p>Ready. Nothing has retired yet.</p>}
        {props.pausedAt !== null ? <p className="ax-ok">Program paused at breakpoint {wordHex(props.pausedAt)} before that instruction runs.</p> : null}
      </section>
    </div>
  );
}

function Flags({ flags }: { flags: CpuState["flags"] }) {
  const items = [
    { key: "n" as const, name: "N", hint: "Negative" },
    { key: "z" as const, name: "Z", hint: "Zero" },
    { key: "c" as const, name: "C", hint: "Carry" },
    { key: "v" as const, name: "V", hint: "Overflow" },
  ];
  return (
    <div className="ax-flagbox" aria-label="Flags">
      {items.map((item) => <div key={item.key}><b>{item.name}</b><strong>{flags[item.key]}</strong><small>{item.hint}</small></div>)}
    </div>
  );
}

function RegFile({ cpu, decoded, hot, onEdit }: { cpu: CpuState; decoded: Decoded; hot?: TraceRow; onEdit: (index: number, value: number) => void }) {
  return (
    <section className="ax-card">
      <h2>Register file</h2>
      <div className="ax-regs">
        {cpu.regs.map((value, index) => {
          const written = hot?.regs.some((line) => line.startsWith(`R${index}:`)) || (decoded.regWrite && decoded.rd === index);
          const read = decoded.rs1 === index || (decoded.aluSrc === "reg" && decoded.rs2 === index) || (decoded.mnemonic === "STORE" && decoded.rs2 === index);
          const tone = written ? "write" : read ? "read" : "";
          return <label key={index} className={tone}>R{index}<input aria-label={`Register R${index}`} value={value} onChange={(event) => { const next = Math.trunc(Number(event.target.value)); if (Number.isFinite(next)) onEdit(index, next); }} /></label>;
        })}
      </div>
    </section>
  );
}

function MemSnap({ cpu, hot, onEdit }: { cpu: CpuState; hot?: TraceRow; onEdit: (address: number, value: number) => void }) {
  const addresses = [0, 4, 8, 12];
  return (
    <section className="ax-card">
      <h2>Memory snapshot</h2>
      <table className="ax-table">
        <thead><tr><th>Address</th><th>Decimal</th><th>Hex</th></tr></thead>
        <tbody>
          {addresses.map((address) => {
            const touched = hot?.mem.some((line) => line.startsWith(`M[${address}]`));
            return (
              <tr key={address} className={touched ? "on ax-hot" : ""}>
                <td className="mono">{wordHex(address)}</td>
                <td><input aria-label={`Memory ${address}`} value={cpu.dmem[address] ?? 0} onChange={(event) => { const next = Math.trunc(Number(event.target.value)); if (Number.isFinite(next)) onEdit(address, next); }} /></td>
                <td className="mono">{wordHex(cpu.dmem[address] ?? 0)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

function FetchPanel(props: Shared & { onStep: () => void; onAuto: () => void; auto: boolean; reset: () => void }) {
  const [beat, setBeat] = useState(0);
  const fetched = props.cpu.stage !== "IF";
  const decoded = fetched ? (props.cpu.decoded ?? decode(props.cpu.ir)) : decode(props.cpu.imem[props.cpu.pc] ?? 0);
  const shownPc = props.cpu.pc;
  const fetchedFrom = fetched ? props.cpu.instPc : props.cpu.pc;
  const word = fetched ? props.cpu.ir : (props.cpu.imem[props.cpu.pc] ?? 0);
  useEffect(() => {
    if (!props.tick) return;
    if (reducedMotion()) {
      setBeat(4);
      return;
    }
    setBeat(1);
    const ids = [2, 3, 4].map((step) => window.setTimeout(() => setBeat(step), (step - 1) * 160));
    return () => ids.forEach((id) => window.clearTimeout(id));
  }, [props.tick]);
  const beats = ["Read memory", "Load into IR", "PC + 1 word", "Complete"];
  return (
    <div className="ax-fetch">
      <section className="ax-card ax-banner ax-span">
        <div className="ax-banner-top">
          <div>
            <h2>Fetch stage</h2>
            <p>The CPU uses the program counter to read the next instruction word and place it in the instruction register. LogicLab-16 then adds 1 to the PC.</p>
          </div>
          <span className="ax-badge">Stage 1 of 6 · Fetch</span>
        </div>
        <div className="ax-stepflow">
          {[
            ["1", "Program counter", "Holds the address of the next instruction."],
            ["2", "Instruction memory", "The word at that address is read."],
            ["3", "Fetched instruction", "The machine word leaves memory."],
            ["4", "Instruction register", "IR holds the word. PC advances by one."],
          ].map(([n, title, body]) => <div key={title} className="ax-step"><b>{n}</b><strong>{title}</strong><small>{body}</small></div>)}
        </div>
      </section>
      <section className="ax-card">
        <h2>Program counter</h2>
        <div className="ax-pair"><span>Current</span><b className="mono ax-big">{wordHex(shownPc)}</b></div>
        <div className="ax-pair"><span>{fetched ? "Fetched from" : "Next word"}</span><b className="mono">{wordHex(fetched ? fetchedFrom : (shownPc + 1) & 0xff)}</b></div>
        {props.explain ? <p className="ax-note">Each instruction is one 16-bit word, so fetch adds 1 to the PC. It does not add 4.</p> : null}
      </section>
      <section className="ax-card">
        <h2>Instruction memory</h2>
        <table className="ax-table">
          <thead><tr><th>Address</th><th>Machine word</th><th>Assembly</th></tr></thead>
          <tbody>
            {(props.built.ok ? props.built.listing : []).map((row) => (
              <tr key={row.address} className={row.address === fetchedFrom ? "on ax-hot" : ""}>
                <td className="mono">{wordHex(row.address)}</td>
                <td className="mono">{wordHex(row.word)}</td>
                <td>{row.text}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="ax-card">
        <h2>Instruction register</h2>
        <p className="ax-big mono">{fetched ? wordHex(props.cpu.ir) : "—"}</p>
        <p>{fetched ? formatInstruction(decoded) : "Not fetched yet"}</p>
      </section>
      <section className="ax-card">
        <div className="ax-card-top"><h2>Sample program</h2></div>
        <Editor {...props} editing={false} />
        <div className="ax-actions">
          <button type="button" className="ax-go" onClick={props.onStep}><Mark kind="step" /> Step Fetch</button>
          <button type="button" className="ax-quiet" onClick={props.onAuto}><Mark kind="play" /> {props.auto ? "Pause" : "Auto Fetch"}</button>
          <button type="button" className="ax-quiet" onClick={props.reset}><Mark kind="reset" /> Reset</button>
        </div>
      </section>
      <section className="ax-card ax-span2">
        <h2>Fetch visualization</h2>
        <div className="ax-path">
          <div className={`ax-node ${beat >= 1 ? "on" : ""}`}><small>PC</small>{wordHex(fetched ? fetchedFrom : shownPc)}</div>
          <div className={`ax-node ${beat >= 2 ? "on" : ""}`}><small>Instruction memory</small>{wordHex(word)}</div>
          <div className={`ax-node ${beat >= 3 ? "on" : ""}`}><small>IR</small>{fetched ? formatInstruction(decoded) : "—"}</div>
        </div>
        <ol className="ax-beats">
          {beats.map((label, index) => <li key={label} className={beat > index ? "on" : ""}><b>{index + 1}</b>{label}</li>)}
        </ol>
      </section>
    </div>
  );
}

function DecodePanel(props: Shared & { onStep: () => void; reset: () => void }) {
  const listing = props.built.ok ? props.built.listing : [];
  const [pick, setPick] = useState<number | null>(null);
  const live = currentDecoded(props.cpu);
  const picked = pick === null ? undefined : listing.find((row) => row.address === pick);
  const decoded = picked ? decode(picked.word) : live;
  const fields = fieldsOf(decoded);
  const [focus, setFocus] = useState(fields[0]?.name ?? "opcode");
  const active = fields.find((field) => field.name === focus) ?? fields[0];
  const reads = decoded.aluSrc === "imm" ? [`R${decoded.rs1}`] : [`R${decoded.rs1}`, `R${decoded.rs2}`];
  return (
    <div className="ax-decode">
      <section className="ax-card ax-banner ax-span">
        <div className="ax-banner-top">
          <div>
            <h2>Decode stage</h2>
            <p>The control unit splits the 16-bit word into opcode, register, and immediate fields, then raises the signals this instruction needs.</p>
          </div>
          <span className="ax-badge">Decode · 1 stage</span>
        </div>
        <div className="ax-stepflow">
          {[
            ["IR", "The fetched machine word."],
            ["Opcode", "Chooses the operation."],
            ["Registers", "Names R0–R7."],
            ["Immediate", "A signed constant, when the format has one."],
            ["Control", "Signals for ALU, registers, memory, and branches."],
          ].map(([title, body]) => <div key={title} className="ax-step"><strong>{title}</strong><small>{body}</small></div>)}
        </div>
      </section>
      <section className="ax-card">
        <h2>Instruction field breakdown</h2>
        <div className="ax-fields">
          {fields.map((field) => (
            <button key={`${field.name}-${field.hi}`} type="button" className={`${field.name} ${focus === field.name ? "on" : ""}`} style={{ flex: field.hi - field.lo + 1 }} onClick={() => setFocus(field.name)} onMouseEnter={() => setFocus(field.name)}>
              <em>{field.hi}–{field.lo}</em>
              <b>{fieldValue(decoded.word, field)}</b>
              <small>{field.name}</small>
            </button>
          ))}
        </div>
        {active ? <p>{active.meaning}</p> : null}
      </section>
      <section className="ax-card">
        <h2>Decoded instruction</h2>
        <div className="ax-pair"><span>Mnemonic</span><b>{decoded.mnemonic}</b></div>
        <div className="ax-pair"><span>Format</span><b>{decoded.format}-type</b></div>
        <div className="ax-pair"><span>Assembly</span><b>{formatInstruction(decoded)}</b></div>
        {props.explain ? <p className="ax-note">{decoded.explain}</p> : null}
        <h3>Generated control signals</h3>
        <ul className="ax-signals">
          <li className={decoded.aluOp !== "NONE" ? "on" : ""}><span>ALU operation</span><b>{decoded.aluOp}</b></li>
          <li className="on"><span>Register read</span><b>{reads.join(", ")}</b></li>
          <li className={decoded.regWrite ? "on" : ""}><span>Register write</span><b>{decoded.regWrite ? `R${decoded.rd}` : "—"}</b></li>
          <li className={decoded.memRead ? "on" : ""}><span>Memory read</span><b>{decoded.memRead ? "on" : "—"}</b></li>
          <li className={decoded.memWrite ? "on" : ""}><span>Memory write</span><b>{decoded.memWrite ? "on" : "—"}</b></li>
          <li className={decoded.branch || decoded.jump ? "on" : ""}><span>Branch / jump</span><b>{decoded.branch || decoded.jump ? "on" : "—"}</b></li>
        </ul>
      </section>
      <section className="ax-card">
        <div className="ax-card-top">
          <h2>Current instruction</h2>
          <label className="ax-pick">Change
            <select aria-label="Change instruction" value={pick ?? "live"} onChange={(event) => setPick(event.target.value === "live" ? null : Number(event.target.value))}>
              <option value="live">Instruction in the CPU</option>
              {listing.map((row) => <option key={row.address} value={row.address}>{wordHex(row.address)} {row.text}</option>)}
            </select>
          </label>
        </div>
        <p>{formatInstruction(decoded)}</p>
        <p className="mono">{wordHex(decoded.word)}</p>
        <div className="ax-fields ax-fields-mini">
          {fields.map((field) => <button key={`mini-${field.name}-${field.hi}`} type="button" className={`${field.name} ${focus === field.name ? "on" : ""}`} style={{ flex: field.hi - field.lo + 1 }} onClick={() => setFocus(field.name)}>{fieldValue(decoded.word, field)}</button>)}
        </div>
        <div className="ax-actions">
          <button type="button" className="ax-go" onClick={() => { setPick(null); props.onStep(); }}><Mark kind="step" /> Step Decode</button>
          <button type="button" className="ax-quiet" onClick={() => { setPick(null); props.reset(); }}><Mark kind="reset" /> Reset</button>
        </div>
      </section>
      <section className="ax-card">
        <h2>Register mapping</h2>
        <div className="ax-map">
          {props.cpu.regs.map((_, index) => {
            const role = decoded.regWrite && decoded.rd === index ? "rd" : decoded.rs1 === index ? "rs1" : decoded.rs2 === index ? "rs2" : "";
            return <div key={index} className={role}><b>R{index}</b><small>{index}</small></div>;
          })}
        </div>
        {props.explain ? <p className="ax-note">Fields store register numbers. 011 in bits 11–9 is R3, not the value 3.</p> : null}
      </section>
    </div>
  );
}

function ExecutePanel(props: Shared & { onStep: () => void; onRun: () => void; reset: () => void }) {
  const decoded = currentDecoded(props.cpu);
  const [experiment, setExperiment] = useState(false);
  const [op, setOp] = useState("ADD");
  const [left, setLeft] = useState(1);
  const [right, setRight] = useState(2);
  const liveOp = experiment ? op : (decoded.aluOp === "NONE" ? "ADD" : decoded.aluOp);
  const aReg = experiment ? left : decoded.rs1;
  const bReg = experiment ? right : decoded.rs2;
  const a = props.cpu.regs[aReg] ?? 0;
  const b = experiment || decoded.aluSrc !== "imm" ? (props.cpu.regs[bReg] ?? 0) : decoded.imm;
  const preview = operate(liveOp, a, b);
  const equal = (props.cpu.regs[decoded.rs1] ?? 0) === (props.cpu.regs[decoded.rs2] ?? 0);
  const taken = decoded.mnemonic === "BEQ" ? equal : decoded.mnemonic === "BNE" ? !equal : false;
  const target = wordHex((props.cpu.instPc + decoded.imm) & 0xff);
  return (
    <div className="ax-execute">
      <section className="ax-card ax-banner ax-span">
        <div className="ax-banner-top">
          <div>
            <h2>Execute stage</h2>
            <p>The CPU performs the ALU operation, updates flags, and decides whether a branch will be taken when this instruction reaches memory.</p>
          </div>
          <span className="ax-badge">4 steps · ALU and branch</span>
        </div>
        <div className="ax-stepflow">
          {[
            ["Source operands", "Registers or an immediate."],
            ["ALU operation", liveOp],
            ["Result", "A 16-bit value."],
            ["Flags and branch", "N, Z, C, V, and the condition."],
          ].map(([title, body]) => <div key={title} className="ax-step"><strong>{title}</strong><small>{body}</small></div>)}
        </div>
      </section>
      <section className="ax-card">
        <div className="ax-card-top">
          <h2>Operand selection</h2>
          <label><input type="checkbox" checked={experiment} onChange={(event) => setExperiment(event.target.checked)} /> Experiment</label>
        </div>
        <div className="ax-actions">
          <RegPick label="Source A" value={aReg} onChange={(value) => { setExperiment(true); setLeft(value); }} />
          <RegPick label={decoded.aluSrc === "imm" && !experiment ? "Immediate" : "Source B"} value={experiment || decoded.aluSrc !== "imm" ? bReg : decoded.rs2} onChange={(value) => { setExperiment(true); setRight(value); }} />
        </div>
        <p>{decoded.aluSrc === "imm" && !experiment ? `R${decoded.rs1} (${a}) and immediate ${decoded.imm}` : `R${aReg} (${a}) and R${bReg} (${b})`}</p>
      </section>
      <section className="ax-card">
        <h2>ALU operation</h2>
        <div className="ax-ops">
          {["ADD", "SUB", "AND", "OR", "XOR"].map((item) => <button key={item} type="button" className={liveOp === item ? "on" : ""} disabled={!experiment && item !== liveOp} onClick={() => { setExperiment(true); setOp(item); }}>{item}</button>)}
        </div>
        {props.explain ? <p className="ax-note">{experiment ? "Experiment mode previews this operation. It does not write the register file." : `${decoded.mnemonic} uses ${liveOp}. Step Execute commits the real instruction.`}</p> : null}
      </section>
      <section className="ax-card">
        <h2>CPU flags</h2>
        <Flags flags={{ n: preview.n, z: preview.z, c: preview.c, v: preview.v }} />
      </section>
      <section className="ax-card ax-span2">
        <h2>ALU visualization</h2>
        <div className="ax-alu">
          <div><small>Source A</small><b>R{aReg}</b><span>{a}</span><em className="mono">{wordHex(a)}</em></div>
          <div><small>{decoded.aluSrc === "imm" && !experiment ? "Immediate" : "Source B"}</small><b>{decoded.aluSrc === "imm" && !experiment ? `#${decoded.imm}` : `R${bReg}`}</b><span>{b}</span><em className="mono">{wordHex(b & 0xffff)}</em></div>
          <div className="ax-alu-op">{liveOp}</div>
          <div className={props.tick ? "ax-hot" : ""}><small>Result</small><b>{preview.result}</b><em className="mono">{wordHex(preview.result)}</em></div>
        </div>
      </section>
      <section className="ax-card">
        <h2>Branch decision</h2>
        {decoded.branch ? (
          <>
            <div className="ax-pair"><span>Condition</span><b>{decoded.mnemonic}</b></div>
            <div className="ax-pair"><span>Decision</span><b>{taken ? "Taken" : "Not taken"}</b></div>
            <div className="ax-pair"><span>Target</span><b className="mono">{target}</b></div>
            {props.explain ? <p className="ax-note">The branch resolves in the memory stage. This page shows the decision. The PC changes when that stage runs.</p> : null}
          </>
        ) : <p>This instruction does not branch.</p>}
      </section>
      <section className="ax-card">
        <h2>Instruction execution</h2>
        <Editor {...props} editing={false} />
      </section>
      <section className="ax-card ax-result ax-span2">
        <h2>Execution result</h2>
        <div className="ax-pair"><span>Operation</span><b>{liveOp}</b></div>
        <div className="ax-pair"><span>Operands</span><b>{a} and {b}</b></div>
        <div className="ax-pair"><span>Result</span><b>{preview.result} ({wordHex(preview.result)})</b></div>
        <div className="ax-pair"><span>Branch</span><b>{decoded.branch ? (taken ? "Taken" : "Not taken") : "None"}</b></div>
        <div className="ax-actions">
          <button type="button" className="ax-go" onClick={props.onRun}><Mark kind="play" /> Run Execute</button>
          <button type="button" className="ax-quiet" onClick={props.onStep}><Mark kind="step" /> Step Execute</button>
          <button type="button" className="ax-quiet" onClick={props.reset}><Mark kind="reset" /> Reset</button>
        </div>
      </section>
    </div>
  );
}

function MemoryPanel(props: Shared & { onStep: () => void; reset: () => void; commit: (next: CpuState, row?: TraceRow | null) => void }) {
  const [kind, setKind] = useState<"LOAD" | "STORE">("LOAD");
  const [reg, setReg] = useState(1);
  const [base, setBase] = useState(0);
  const [offset, setOffset] = useState(8);
  const [note, setNote] = useState("Ready.");
  const ea = ((props.cpu.regs[base] ?? 0) + offset) & 0xff;
  const legal = offset >= -32 && offset <= 31;
  function apply() {
    if (!legal) {
      setNote("Offset must be a signed 6-bit value, from −32 to 31.");
      return;
    }
    const next = { ...props.cpu, regs: props.cpu.regs.slice(), dmem: props.cpu.dmem.slice(), diff: [] as string[] };
    if (kind === "LOAD") {
      const before = next.regs[reg] ?? 0;
      const value = next.dmem[ea] ?? 0;
      next.regs[reg] = value;
      setNote(`LOAD: EA = ${ea}. R${reg}: ${before} → ${value}.`);
      props.commit(next, { index: 0, pc: next.pc, pcAfter: next.pc, text: `LOAD R${reg}, ${offset}(R${base})`, regs: [`R${reg}: ${before} → ${value}`], mem: [], flags: "" });
    } else {
      const before = next.dmem[ea] ?? 0;
      const value = next.regs[reg] ?? 0;
      next.dmem[ea] = value & 0xffff;
      setNote(`STORE: EA = ${ea}. M[${ea}]: ${before} → ${value & 0xffff}.`);
      props.commit(next, { index: 0, pc: next.pc, pcAfter: next.pc, text: `STORE R${reg}, ${offset}(R${base})`, regs: [], mem: [`M[${ea}]: ${before} → ${value & 0xffff}`], flags: "" });
    }
  }
  const start = Math.max(0, Math.min(250, ea - 2));
  const window = Array.from({ length: 6 }, (_, index) => start + index);
  const baseValue = props.cpu.regs[base] ?? 0;
  const regValue = props.cpu.regs[reg] ?? 0;
  return (
    <div className="ax-memory">
      <section className="ax-card ax-banner ax-span2">
        <div className="ax-banner-top">
          <div>
            <h2>Memory stage</h2>
            <p>LOAD reads Mem[base + offset] into a register. STORE writes a register into that address. Other instructions leave data memory alone.</p>
          </div>
          <span className="ax-badge">Loads and stores</span>
        </div>
        <div className="ax-stepflow">
          {[
            ["Effective address", "Base register plus a signed offset."],
            ["Memory read or write", "Only the selected cell changes."],
            ["Loaded or stored value", "A load updates a register. A store updates memory."],
          ].map(([title, body]) => <div key={title} className="ax-step"><strong>{title}</strong><small>{body}</small></div>)}
        </div>
      </section>
      <section className="ax-card">
        <h2>Supported instructions</h2>
        <p className="mono">LOAD R{reg}, {offset}(R{base})</p>
        <p>Read Mem[{ea}] into R{reg}.</p>
        <p className="mono">STORE R{reg}, {offset}(R{base})</p>
        <p>Write R{reg} into Mem[{ea}].</p>
        {props.explain ? <p className="ax-note">The offset is a signed 6-bit immediate, from −32 to 31. Address 100 does not fit in one instruction.</p> : null}
      </section>
      <section className="ax-card">
        <h2>Memory map</h2>
        <table className="ax-table">
          <thead><tr><th>Address</th><th>Decimal</th><th>Hex</th></tr></thead>
          <tbody>
            {window.map((address) => (
              <tr key={address} className={address === ea ? "on ax-hot" : ""}>
                <td className="mono">{address}</td>
                <td><input aria-label={`Data memory ${address}`} value={props.cpu.dmem[address] ?? 0} onChange={(event) => { const next = Math.trunc(Number(event.target.value)); if (Number.isFinite(next)) props.setMem(address, next); }} /></td>
                <td className="mono">{wordHex(props.cpu.dmem[address] ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="ax-card">
        <h2>Address calculation</h2>
        <div className="ax-path">
          <div className="ax-node"><small>Base R{base}</small>{baseValue}</div>
          <div className="ax-node"><small>Offset</small>{offset}</div>
          <div className="ax-node on"><small>Effective address</small>{ea}<em className="mono">{wordHex(ea)}</em></div>
        </div>
        {!legal ? <p className="ax-warn">That offset does not fit in a 6-bit immediate.</p> : null}
      </section>
      <section className="ax-card">
        <h2>Data movement</h2>
        <div className="ax-path">
          {kind === "LOAD" ? (
            <>
              <div className="ax-node"><small>Mem[{ea}]</small>{props.cpu.dmem[ea] ?? 0}</div>
              <div className="ax-node on"><small>LOAD</small>memory → register</div>
              <div className="ax-node"><small>R{reg}</small>{regValue}</div>
            </>
          ) : (
            <>
              <div className="ax-node"><small>R{reg}</small>{regValue}</div>
              <div className="ax-node on"><small>STORE</small>register → memory</div>
              <div className="ax-node"><small>Mem[{ea}]</small>{props.cpu.dmem[ea] ?? 0}</div>
            </>
          )}
        </div>
        <div className="ax-regs ax-regs-mini">
          {[0, 1, 2, 3].map((index) => <div key={index}><b>R{index}</b><span>{props.cpu.regs[index] ?? 0}</span></div>)}
        </div>
      </section>
      <section className="ax-card ax-span2">
        <h2>Try it yourself</h2>
        <div className="ax-ops">
          <button type="button" className={kind === "LOAD" ? "on" : ""} onClick={() => setKind("LOAD")}>LOAD</button>
          <button type="button" className={kind === "STORE" ? "on" : ""} onClick={() => setKind("STORE")}>STORE</button>
        </div>
        <div className="ax-actions">
          <RegPick label={kind === "LOAD" ? "Destination" : "Source"} value={reg} onChange={setReg} />
          <RegPick label="Base" value={base} onChange={setBase} />
          <label>Offset<input aria-label="Offset" value={offset} onChange={(event) => { const next = Math.trunc(Number(event.target.value)); if (Number.isFinite(next)) setOffset(next); }} /></label>
        </div>
        <p className="mono">{kind} R{reg}, {offset}(R{base})</p>
        <div className="ax-actions">
          <button type="button" className="ax-go" onClick={apply}>{kind === "LOAD" ? "Load" : "Store"}</button>
          <button type="button" className="ax-quiet" onClick={props.onStep}><Mark kind="step" /> Step</button>
          <button type="button" className="ax-quiet" onClick={props.reset}><Mark kind="reset" /> Reset</button>
        </div>
      </section>
      <section className="ax-card ax-result">
        <h2>Result</h2>
        <p className="ax-ok">{note}</p>
      </section>
    </div>
  );
}

function TracePanel(props: Shared & { run: () => void; step: () => void; over: () => void; reset: () => void; onSample: (source: string) => void; clearTrace: () => void }) {
  const listing = props.built.ok ? props.built.listing : [];
  const line = listing.find((row) => row.address === (props.pausedAt ?? props.cpu.pc));
  const last = props.rows.at(-1);
  const [reg, setReg] = useState(1);
  const [draft, setDraft] = useState(String(props.cpu.regs[1] ?? 0));
  const [breakLine, setBreakLine] = useState(listing[3]?.address ?? 0);
  return (
    <div className="ax-trace">
      <section className="ax-card ax-c3">
        <div className="ax-card-top">
          <h2>Program</h2>
          <label className="ax-pick">Sample
            <select aria-label="Trace sample" value={props.source === SAMPLE_LOOP ? "loop" : "add"} onChange={(event) => props.onSample(event.target.value === "loop" ? SAMPLE_LOOP : SAMPLE_ADD)}>
              <option value="add">Add and store</option>
              <option value="loop">Sum loop</option>
            </select>
          </label>
        </div>
        <Editor {...props} editing={false} />
        <div className="ax-actions">
          <button type="button" className="ax-go" onClick={props.run}><Mark kind="play" /> Run</button>
          <button type="button" className="ax-quiet" onClick={props.step}><Mark kind="step" /> Step</button>
          <button type="button" className="ax-quiet" onClick={props.over}><Mark kind="step" /> Step Over</button>
          <button type="button" className="ax-quiet" onClick={() => { const address = props.cpu.stage === "IF" ? props.cpu.pc : props.cpu.instPc; props.toggleBreak(address); }}><Mark kind="dot" /> Breakpoint</button>
          <button type="button" className="ax-quiet" onClick={props.reset}><Mark kind="reset" /> Reset</button>
        </div>
      </section>
      <section className="ax-card ax-c3">
        <div className="ax-card-top">
          <h2>Execution trace</h2>
          <button type="button" className="ax-quiet" onClick={props.clearTrace}>Clear trace</button>
        </div>
        <table className="ax-table">
          <thead><tr><th>#</th><th>PC</th><th>Instruction</th><th>Changed registers</th><th>Changed memory</th><th>Flags</th></tr></thead>
          <tbody>
            {props.rows.length === 0 ? <tr><td colSpan={6}>No instructions have retired. Run or Step to record the trace.</td></tr> : props.rows.map((row) => (
              <tr key={`${row.index}-${row.pc}-${row.text}`} className={row === last ? "on" : ""}>
                <td>{row.index}</td>
                <td className="mono">{wordHex(row.pc)}</td>
                <td>{row.text}</td>
                <td>{row.regs.join(", ") || "—"}</td>
                <td>{row.mem.join(", ") || "—"}</td>
                <td>{row.flags || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="ax-card ax-c2">
        <h2>CPU state</h2>
        <div className="ax-regs">
          {props.cpu.regs.slice(0, 4).map((value, index) => {
            const change = last?.regs.find((item) => item.startsWith(`R${index}:`));
            const parts = change?.match(/(-?\d+)\s*→\s*(-?\d+)/);
            const before = parts ? Number(parts[1]) : undefined;
            const after = parts ? Number(parts[2]) : undefined;
            const dir = before !== undefined && after !== undefined ? (after < before ? "down" : "up") : "";
            return <div key={index} className={dir}><b>R{index}</b><span>{value}</span>{change ? <small>{change}</small> : null}</div>;
          })}
        </div>
        <div className="ax-pair"><span>PC</span><b className="mono">{wordHex(props.cpu.pc)}</b></div>
        <Flags flags={props.cpu.flags} />
      </section>
      <section className="ax-card ax-c2">
        <h2>Memory changes</h2>
        {last && last.mem.length > 0 ? <ul className="ax-signals">{last.mem.map((item) => <li key={item} className="on">{item}</li>)}</ul> : <p>No memory change on the last instruction.</p>}
      </section>
      <section className="ax-card ax-c2">
        <h2>Instruction pointer</h2>
        <div className="ax-pcs">
          {listing.map((row) => <span key={row.address} className={row.address === props.cpu.pc ? "on ax-hot" : ""}>{wordHex(row.address)}</span>)}
        </div>
        <div className="ax-experiment">
          <h3>Experiment</h3>
          <div className="ax-actions">
            <RegPick label="Register" value={reg} onChange={(value) => { setReg(value); setDraft(String(props.cpu.regs[value] ?? 0)); }} />
            <label>Value<input aria-label="Experiment value" value={draft} onChange={(event) => setDraft(event.target.value)} /></label>
            <button type="button" className="ax-quiet" onClick={() => { const next = Math.trunc(Number(draft)); if (Number.isFinite(next)) props.setReg(reg, next); }}>Apply</button>
          </div>
          <div className="ax-actions">
            <label>Breakpoint
              <select aria-label="Breakpoint line" value={breakLine} onChange={(event) => setBreakLine(Number(event.target.value))}>
                {listing.map((row) => <option key={row.address} value={row.address}>{wordHex(row.address)} {row.text}</option>)}
              </select>
            </label>
            <button type="button" className="ax-quiet" onClick={() => props.toggleBreak(breakLine)}>Set</button>
          </div>
        </div>
      </section>
      <section className={`ax-card ax-span ${props.pausedAt !== null ? "ax-result" : ""}`}>
        {props.pausedAt !== null ? <p className="ax-ok">Program paused at breakpoint. Next instruction: {line?.text ?? wordHex(props.pausedAt)}.</p> : <p>{props.cpu.halted ? "Halted." : "Ready. Run stops at the next breakpoint before that instruction executes."}</p>}
      </section>
    </div>
  );
}

function RegPick({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label>{label}
      <select aria-label={label} value={value} onChange={(event) => onChange(Number(event.target.value))}>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => <option key={index} value={index}>R{index}</option>)}
      </select>
    </label>
  );
}
