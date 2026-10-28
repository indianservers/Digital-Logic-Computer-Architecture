import { useEffect, useMemo, useRef, useState } from "react";
import { assembleX86, blankX86, disassembleBytes, GPR_NAMES, stepX86, type X86Cpu } from "../../engines/isaarch/x86";
import { useSimulatorCapture } from "../../layout/SimulatorCapture";
import type { X86Api } from "./pages";

const PRESETS = [
  { title: "Sum 1…5", result: "15", code: "xor rax, rax\nmov rcx, 1\nmov edx, 5\nloop:\nadd rax, rcx\ninc rcx\ncmp rcx, rdx\njle loop\nret" },
  { title: "32-bit wrap", result: "0", code: "mov eax, 4294967295\ninc eax\nret" },
  { title: "Branch around", result: "7", code: "mov eax, 7\njmp done\nmov eax, 99\ndone:\nret" },
];
const hex = (n: bigint) => "0x" + n.toString(16).toUpperCase().padStart(16, "0");
export function ExecutionLab({ api }: { api: X86Api }) {
  const [loaded, setLoaded] = useState(api.source), [running, setRunning] = useState(false);
  const [breakpoints, setBreakpoints] = useState<number[]>([]), [history, setHistory] = useState<X86Cpu[]>([]);
  const [limit, setLimit] = useState(256), [remaining, setRemaining] = useState(0), [hexInput, setHexInput] = useState("48 89 D8");
  const skipBreakpoint = useRef(false);
  const built = useMemo(() => assembleX86(api.source), [api.source]);
  const insns = built.ok ? built.insns : [], dirty = loaded !== api.source;
  const offsets = insns.map((_, i) => insns.slice(0, i).reduce((n, item) => n + item.bytes.length, 0));
  const previous = history.at(-1);
  useSimulatorCapture("x86.execution", () => ({ cpu: api.cpu, source: api.source, loaded, running, breakpoints, history, remaining, limit, errors: built.ok ? [] : built.errors }), "2");
  function load() {
    setRunning(false);
    if (!built.ok) { api.setStatus("Fix assembly errors before loading."); return; }
    api.setCpu(blankX86()); setLoaded(api.source); setHistory([]); api.setStatus("Loaded. Step or run the executable subset.");
  }
  function advance() {
    if (!built.ok || dirty || api.cpu.halted) return;
    setHistory(rows => [...rows, api.cpu].slice(-64)); api.setStatus("Stepped."); api.setCpu(stepX86(api.cpu, built.insns));
  }
  useEffect(() => {
    if (!running) return;
    if (!built.ok || dirty || api.cpu.halted || remaining <= 0) {
      setRunning(false); api.setStatus(api.cpu.halted ? "Program halted." : "Execution budget reached. Run to continue."); return;
    }
    if (breakpoints.includes(api.cpu.rip) && !skipBreakpoint.current) {
      setRunning(false); api.setStatus("Breakpoint before instruction " + api.cpu.rip + "."); return;
    }
    const timer = window.setTimeout(() => { skipBreakpoint.current = false; advance(); setRemaining(n => n - 1); }, 100);
    return () => window.clearTimeout(timer);
  }, [running, api.cpu, built, dirty, remaining, breakpoints]);
  const checks = [
    ["Assembly valid", built.ok], ["Loaded source matches editor", !dirty],
    ["Executed instructions", api.cpu.retired > 0], ["Reached RET or program end", api.cpu.halted],
  ] as const;
  return <div className="xw">
    <div className="xw-presets">{PRESETS.map(p => <button key={p.title} disabled={running} onClick={() => { api.setSource(p.code); setRunning(false); setBreakpoints([]); api.setStatus("Preset selected. Load to start. Expected RAX = " + p.result); }}>{p.title}<small>RAX → {p.result}</small></button>)}</div>
    <div className="xw-toolbar" aria-label="Execution controls">
      <button onClick={load} disabled={running || !built.ok}>Load / reset</button>
      <button className="primary" disabled={!built.ok || dirty || api.cpu.halted} onClick={() => { if (!running) { skipBreakpoint.current = api.status.startsWith("Breakpoint before"); setRemaining(limit); } setRunning(v => !v); }}>{running ? "Pause" : "Run"}</button>
      <button disabled={running || dirty || !built.ok || api.cpu.halted} onClick={advance}>Step instruction</button>
      <button disabled={running || !history.length || dirty} onClick={() => { api.setCpu(history[history.length - 1]!); api.setStatus("Restored previous instruction state."); setHistory(rows => rows.slice(0, -1)); }}>Back</button>
      <label>Run budget <input aria-label="Instruction budget" type="number" min="1" max="4096" value={limit} onChange={e => setLimit(Math.max(1, Math.min(4096, Number(e.target.value) || 1)))} /></label>
      <span role="status">{dirty ? "Source changed · load required" : api.cpu.halted ? "Halted" : running ? "Running" : api.status}</span>
    </div>
    <div className="xw-metrics"><div><small>Instruction index</small><strong>{api.cpu.rip}</strong></div><div><small>Byte offset</small><strong>{"0x" + (offsets[api.cpu.rip] ?? insns.reduce((n,i)=>n+i.bytes.length,0)).toString(16)}</strong></div><div><small>Retired</small><strong>{api.cpu.retired}</strong></div><div><small>RAX</small><strong>{String(api.cpu.gpr[0])}</strong></div></div>
    <div className="xw-grid">
      <section className="xw-card"><h3>Program</h3><p>Intel syntax · register operations, immediate MOV, INC, CMP, JMP, JLE and RET.</p><textarea aria-label="x86 source" spellCheck={false} value={api.source} onChange={e => { setRunning(false); api.setSource(e.target.value); }} />
        {!built.ok && <div role="alert">{built.errors.map((error,i) => <p key={i}>{error}</p>)}</div>}
        <label>Decode one instruction<input aria-label="Hex bytes" value={hexInput} onChange={e => setHexInput(e.target.value)} /></label><output>{disassembleBytes(hexInput)}</output>
      </section>
      <section className="xw-card"><h3>Instruction listing & breakpoints</h3><p>Click a circle to stop before that instruction. Back retains the latest 64 states.</p><div className="xw-table"><table><thead><tr><th>Break</th><th>Offset</th><th>Bytes</th><th>Instruction</th></tr></thead><tbody>{insns.map((item,i) => <tr key={i} className={i === api.cpu.rip ? "current" : ""}><td><button aria-label={"Breakpoint instruction " + i} aria-pressed={breakpoints.includes(i)} onClick={() => setBreakpoints(b => b.includes(i) ? b.filter(n=>n!==i) : [...b,i])}>{breakpoints.includes(i) ? "●" : "○"}</button></td><td>{offsets[i]?.toString(16).padStart(4,"0")}</td><td>{item.bytes.map(b=>b.toString(16).padStart(2,"0")).join(" ").toUpperCase()}</td><td>{item.text}</td></tr>)}</tbody></table></div></section>
    </div>
    <div className="xw-grid">
      <section className="xw-card"><h3>Live registers</h3><div className="xw-registers">{GPR_NAMES.map((name,i) => <div key={name} className={previous && previous.gpr[i] !== api.cpu.gpr[i] ? "changed" : ""}><small>{name}</small><code>{hex(api.cpu.gpr[i] ?? 0n)}</code></div>)}</div><div className="xw-flags">{Object.entries(api.cpu.flags).map(([name,v]) => <span className={v ? "set" : ""} key={name}>{name.toUpperCase()} <b>{v}</b></span>)}</div></section>
      <section className="xw-card"><h3>Execution evidence</h3><div className="xw-checks">{checks.map(([label,pass]) => <p key={label}>{pass ? "✓" : "○"} {label}</p>)}</div><ol className="xw-trace">{api.cpu.trace.slice(-12).map((row,i)=><li key={i}>{row}</li>)}</ol><p>32-bit writes zero the upper register half. RET is a teaching stop; calls, stack returns, memory operands and operating-system execution are outside this runner.</p></section>
    </div>
  </div>;
}
