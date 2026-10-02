import { useEffect, useRef } from "react";
import type { Mcu } from "../core/mcu";
import { useLab } from "../core/useLab";
import type { LabMeta } from "../registry";
import { CodeEditor } from "../ui/CodeEditor";
import { Icon } from "../ui/Icon";
import { LearningNotes, Panel, Seg, Toggle } from "../ui/Panels";
import { LabShell } from "../ui/Shell";
import { compileThumb, hx, LR, PC, SP, ThumbCpu, type ThumbProgram } from "./thumb";

const DEFAULT = `// Core Lab 7 - Program Counter, Stack & Stack Pointer
#include <stdint.h>

int add_numbers(int x) {
    return x + 3;
}

int main(void) {
    int result = add_numbers(5);   // CALL to function
    // After return, result should be 8
    while (1) {
        // Stop here
    }
}
`;
const NESTED = `// Nested calls: three return addresses on the stack at once
#include <stdint.h>

int square(int v) {
    return v * v;
}

int sum_squares(int a, int b) {
    return square(a) + square(b);   // square() called from sum_squares()
}

int main(void) {
    int total = sum_squares(3, 4);  // 9 + 16 = 25
    while (1) {
    }
}
`;
const RECURSION = `// Recursion: every call pushes a new frame
#include <stdint.h>

int factorial(int n) {
    if (n <= 1) {
        return 1;                    // base case
    }
    return n * factorial(n - 1);     // recursive CALL
}

int main(void) {
    int result = factorial(4);       // 4! = 24
    while (1) {
    }
}
`;

const TOP = 0x20000400;
const RATES = [1, 2, 5, 10, 50];
type P = { rate: number; corruptLr: boolean; skipPop: boolean; tinyStack: boolean; view: string };

const compiled = new Map<string, ThumbProgram>();
function programOf(src: string): ThumbProgram {
  let p = compiled.get(src);
  if (!p) { p = compileThumb(src); if (compiled.size > 24) compiled.clear(); compiled.set(src, p); }
  return p;
}
const limitOf = (p: P) => TOP - (p.tinyStack ? 64 : 256);
const sims = new WeakMap<Mcu, { cpu: ThumbCpu; acc: number }>();
function simOf(m: Mcu, src: string, p: P) {
  let s = sims.get(m);
  if (!s) { s = { cpu: new ThumbCpu(programOf(src), TOP, limitOf(p)), acc: 0 }; sims.set(m, s); }
  return s;
}

function CallFlow({ cpu }: { cpu: ThumbCpu }) {
  const frames = cpu.calls;
  const shown = frames.slice(-3);
  const hidden = frames.length - shown.length;
  const cur = cpu.current;
  const entry = (fn: string) => cpu.prog.labels.get(fn) ?? 0;
  const bx = 92, bw = 150, step = 84, y0 = hidden ? 26 : 8;
  const call = cpu.lastCall, ret = cpu.lastRet;
  const callOn = cpu.last?.kind === "call", retOn = cpu.last?.kind === "ret";
  const end = y0 + shown.length * step;
  return (
    <svg viewBox="0 0 330 340" className="mcl-svg mcl-l07-flow" role="img" aria-label="Live call stack: active function frames, the last CALL and the last RET">
      <defs><marker id="l07-ar" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L8 4 L0 8 z" fill="#1769e0" /></marker></defs>
      {hidden ? <text x={bx + bw / 2} y={16} textAnchor="middle" fontSize="10" fill="#5b708f">… {hidden} earlier frame{hidden > 1 ? "s" : ""} (deeper in the stack)</text> : null}
      {shown.length === 0 ? <g><rect x={bx} y={y0} width={bw} height={46} rx={6} fill="#eaf2ff" stroke="#1769e0" /><text x={bx + bw / 2} y={y0 + 20} textAnchor="middle" fontSize="11" fontWeight="800" fill="#0f2547">Reset_Handler</text><text x={bx + bw / 2} y={y0 + 35} textAnchor="middle" fontSize="9.5" fill="#4b6283">about to BL main</text></g> : null}
      {shown.map((f, i) => {
        const y = y0 + i * step;
        const top = i === shown.length - 1;
        const h = top ? 66 : 62;
        const callee = frames[hidden + i + 1];
        return (
          <g key={`${f.fn}-${hidden + i}`}>
            <rect x={bx} y={y} width={bw} height={h} rx={7} fill={top ? "#effaf3" : "#eef4fd"} stroke={top ? "#16a34a" : "#1769e0"} strokeWidth={top ? 2 : 1.3} />
            <text x={bx + bw / 2} y={y + 16} textAnchor="middle" fontSize="11.5" fontWeight="800" fill="#0f2547">{f.fn}()</text>
            <text x={bx + bw / 2} y={y + 29} textAnchor="middle" fontSize="9" fill="#4b6283" className="mcl-mono-svg">entry {hx(entry(f.fn))} · ret {hx(f.ret)}</text>
            {top
              ? <g><rect x={bx + 10} y={y + 37} width={bw - 20} height={20} rx={4} fill="#fff" stroke="#86d6a4" /><text x={bx + bw / 2} y={y + 51} textAnchor="middle" fontSize="9.5" fill="#14532d" className="mcl-mono-svg">{cpu.fault ? "HardFault" : cur ? cur.text.replace(/\s+/, " ") : "—"}</text></g>
              : callee ? <g><rect x={bx + 10} y={y + 36} width={bw - 20} height={20} rx={4} fill="#fff6d6" stroke="#f0c445" /><text x={bx + bw / 2} y={y + 50} textAnchor="middle" fontSize="9.5" fill="#7a5800" className="mcl-mono-svg">BL {callee.fn} @ {hx(callee.site)}</text></g> : null}
            {!top ? <path d={`M${bx + bw / 2} ${y + h} V${y + step - 4}`} stroke="#1769e0" strokeWidth="1.8" markerEnd="url(#l07-ar)" /> : null}
          </g>
        );
      })}
      {cpu.stopped ? (
        <g>
          <path d={`M${bx + bw / 2} ${end - step + 66} V${end - 4}`} stroke={cpu.fault ? "#dc2626" : "#1769e0"} strokeWidth="1.8" markerEnd="url(#l07-ar)" opacity={shown.length ? 1 : 0} />
          <rect x={bx} y={end} width={bw} height={42} rx={7} fill={cpu.fault ? "#fdecec" : "#eaf2ff"} stroke={cpu.fault ? "#dc2626" : "#1769e0"} />
          <text x={bx + bw / 2} y={end + 17} textAnchor="middle" fontSize="11" fontWeight="800" fill={cpu.fault ? "#b91c1c" : "#0f2547"}>{cpu.fault ? "HardFault" : "Halted (BKPT)"}</text>
          <text x={bx + bw / 2} y={end + 32} textAnchor="middle" fontSize="9" fill="#4b6283" className="mcl-mono-svg">PC = {hx(cpu.r[PC]!)}</text>
        </g>
      ) : null}
      <g opacity={call ? (callOn ? 1 : 0.45) : 0.25}>
        <rect x={2} y={92} width={84} height={78} rx={5} fill="#eef4ff" stroke="#1769e0" strokeWidth={callOn ? 1.8 : 1} />
        <text x={8} y={107} fontSize="10" fontWeight="800" fill="#1769e0">1. CALL</text>
        <text x={8} y={121} fontSize="8.5" fill="#23395b">BL {call?.fn ?? "fn"}</text>
        <text x={8} y={134} fontSize="8.5" fill="#23395b">LR ← {call ? hx(call.ret) : "ret"}</text>
        <text x={8} y={147} fontSize="8.5" fill="#23395b">PUSH {"{LR}"} saves it</text>
        <text x={8} y={160} fontSize="8.5" fill="#23395b">PC ← {call ? hx(call.to) : "entry"}</text>
      </g>
      <g opacity={ret ? (retOn ? 1 : 0.45) : 0.25}>
        <rect x={246} y={150} width={82} height={78} rx={5} fill="#fdeeee" stroke="#dc2626" strokeWidth={retOn ? 1.8 : 1} />
        <text x={252} y={165} fontSize="10" fontWeight="800" fill="#dc2626">2. RET</text>
        <text x={252} y={179} fontSize="8.5" fill="#23395b">POP {"{LR}"} restores</text>
        <text x={252} y={192} fontSize="8.5" fill="#23395b">BX LR from</text>
        <text x={252} y={205} fontSize="8.5" fill="#23395b">{ret?.fn ?? "fn"}()</text>
        <text x={252} y={218} fontSize="8.5" fill="#23395b">PC ← {ret ? hx(ret.to) : "ret"}</text>
      </g>
    </svg>
  );
}

export default function L07({ meta }: { meta: LabMeta }) {
  const lab = useLab<P>({
    slug: meta.slug, code: DEFAULT, params: { rate: 2, corruptLr: false, skipPop: false, tinyStack: false, view: "top" },
    mcu: { part: "F401" },
    setup: (m, p, src) => { sims.set(m, { cpu: new ThumbCpu(programOf(src), TOP, limitOf(p)), acc: 0 }); },
    validate: (src) => programOf(src).diagnostics,
    world: (m, dt, p) => {
      const s = sims.get(m);
      if (!s || s.cpu.stopped) return;
      s.cpu.stackLimit = limitOf(p);
      s.acc += dt * p.rate;
      while (s.acc >= 1 && !s.cpu.stopped) { s.acc -= 1; s.cpu.step(m.time, p); }
    },
  });
  const { mcu, params } = lab;
  const sim = simOf(mcu, lab.compiledCode, params);
  const cpu = sim.cpu;
  const cur = cpu.current;
  const listRef = useRef<HTMLDivElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const done = useRef({ call: false, nested: false, overflow: false });
  if (cpu.lastCall && cpu.log.some((l) => l.kind === "push")) done.current.call = true;
  if (cpu.maxDepth >= 3) done.current.nested = true;
  if (cpu.fault.includes("overflow")) done.current.overflow = true;

  useEffect(() => {
    const box = listRef.current, row = box?.querySelector<HTMLElement>(".cur");
    if (box && row && (row.offsetTop < box.scrollTop || row.offsetTop + row.offsetHeight > box.scrollTop + box.clientHeight)) box.scrollTop = row.offsetTop - box.clientHeight / 2;
  }, [cpu.r[PC], lab.compiledCode]);
  useEffect(() => { const el = logRef.current; if (el) el.scrollTop = el.scrollHeight; }, [cpu.log.length, cpu.executed]);

  const stepOnce = () => { if (lab.running) lab.toggle(); cpu.step(mcu.time, params); lab.advance(0); };
  const status = cpu.fault ? "HardFault" : cpu.halted ? "Halted (BKPT)" : lab.running ? "Running" : "Paused";
  const sp = cpu.r[SP]!;
  const used = TOP - sp, peak = TOP - cpu.minSp;

  const rowsN = 14;
  const start = sp < TOP - 4 * 11 ? sp + 4 * 10 : TOP - 4;
  const stackRows = Array.from({ length: rowsN }, (_, i) => start - 4 * i);
  const memStart = params.view === "sp" ? Math.min(TOP - 16 * 7, Math.floor(sp / 16) * 16 - 16 * 3) : TOP - 16 * 7;
  const memRows = Array.from({ length: 7 }, (_, i) => memStart + 16 * i);
  const ascii = (w: number) => [0, 8, 16, 24].map((s) => { const b = (w >>> s) & 0xff; return b >= 32 && b < 127 ? String.fromCharCode(b) : "."; }).join("");
  const tagClass = (addr: number) => { const t = cpu.tags.get(addr) ?? ""; return addr < sp ? "stale" : t.startsWith("return") ? "ret" : t.startsWith("saved") ? "saved" : t ? "local" : ""; };
  const listing: Array<{ label?: string; i?: number }> = [];
  cpu.prog.ins.forEach((ins, i) => {
    const lbl = [...cpu.prog.labels.entries()].find(([n, a]) => a === ins.addr && !n.startsWith(".") && !n.endsWith("_exit"));
    if (lbl) listing.push({ label: lbl[0] });
    listing.push({ i });
  });
  const gp = [0, 1, 2, 3, 4, 5, 6, 7];
  const logIcon = (k: string) => (k === "push" ? "↓" : k === "pop" ? "↑" : k === "call" ? "→" : k === "ret" ? "←" : k === "fault" ? "!" : k === "halt" ? "■" : "▸");

  return (
    <LabShell meta={meta} lab={lab} subtitle="Visualize CALL, PUSH, POP, RET, and stack behavior during execution."
      components={["STM32F401 Cortex-M4 core (Thumb-2)", "Main stack in SRAM 0x2000 0000 – 0x2000 03FF", "C → Thumb code generator (-O0 style) + register-level CPU model"]}>
      <div className="mcl-grid mcl-l07-grid">
        <Panel title="Execution Visualization" icon="cpu" className="mcl-sim mcl-l07-viz" tools={<>
          <span className={`mcl-chip ${cpu.fault ? "mcl-chip-bad" : lab.running && !cpu.stopped ? "mcl-chip-live" : ""}`}>{status}</span>
          <button type="button" className="mcl-btn mcl-btn-sm" onClick={stepOnce} disabled={cpu.stopped} title="Execute one instruction"><Icon name="chevRight" />Step</button>
          <button type="button" className="mcl-btn mcl-btn-sm" onClick={lab.resetSim} title="Restart from Reset_Handler"><Icon name="reset" />Restart</button>
        </>}>
          <div className="mcl-l07-vizbody">
            <div className="mcl-l07-asm" ref={listRef} role="list" aria-label="Generated Thumb assembly">
              {listing.map((row, k) => {
                if (row.label) return <div key={`l${k}`} className="mcl-l07-lbl">{row.label}:</div>;
                const ins = cpu.prog.ins[row.i!]!;
                const isCur = cur === ins;
                return (
                  <div key={ins.addr} role="listitem" className={`mcl-l07-ins ${isCur ? "cur" : ""} ${cpu.fault && isCur ? "bad" : ""}`} title={`C line ${ins.line}${ins.note ? ` — ${ins.note}` : ""}`}>
                    <i>{isCur ? "▶" : ""}</i><span>{hx(ins.addr)}</span><code>{ins.text}</code>
                  </div>
                );
              })}
              {!cpu.prog.ins.length ? <p className="mcl-muted">Fix the build errors to see the generated assembly.</p> : null}
            </div>
            <CallFlow cpu={cpu} />
          </div>
          <div className="mcl-l07-ctl">
            <span>Speed</span>
            <Seg size="sm" value={params.rate} options={RATES.map((r) => ({ value: r, label: `${r}/s` }))} onChange={(v) => lab.setParam("rate", v)} label="Instructions per second" />
            <span className="mcl-l07-cyc">{cpu.executed} instr · {cpu.cycles} cycles · depth {cpu.calls.length} (max {cpu.maxDepth})</span>
          </div>
          <div className="mcl-l07-faults" aria-label="Fault injection">
            <b><Icon name="bug" />Fault injection</b>
            <Toggle label="Corrupt saved LR" checked={params.corruptLr} onChange={(v) => lab.setParam("corruptLr", v)} hint="PUSH {LR} stores the return address with bit 4 flipped" />
            <Toggle label="Skip POP {LR}" checked={params.skipPop} onChange={(v) => lab.setParam("skipPop", v)} hint="The epilogue forgets to restore LR and SP — the stack becomes unbalanced" />
            <Toggle label="Tiny stack (64 B)" checked={params.tinyStack} onChange={(v) => lab.setParam("tinyStack", v)} hint="Stack limit raised so deep calls overflow" />
          </div>
        </Panel>

        <Panel title="Memory Stack (RAM)" icon="memory" className="mcl-l07-stack">
          <div className="mcl-l07-hi"><Icon name="chevDown" />High Address <small>({hx(TOP, 8)})</small></div>
          <div className="mcl-l07-words">
            {stackRows.map((a) => (
              <div key={a} className={`mcl-l07-word ${a === sp ? "sp" : ""} ${tagClass(a)} ${cpu.stackWrites.has(a) ? "new" : ""}`} title={cpu.tags.get(a) ?? "unused"}>
                <span>{hx(a, 8)}</span><code>{hx(cpu.read(a), 8)}</code>{a === sp ? <b>SP</b> : <small>{a >= sp ? (cpu.tags.get(a) ?? "").replace(/^\w+: /, "") : ""}</small>}
              </div>
            ))}
          </div>
          <div className="mcl-l07-hi lo"><Icon name="chevDown" />Low Address <small>(limit {hx(limitOf(params), 8)})</small></div>
          <div className="mcl-l07-usage">
            <div><i style={{ width: `${Math.min(100, (used / (TOP - limitOf(params))) * 100)}%` }} /><em style={{ left: `${Math.min(100, (peak / (TOP - limitOf(params))) * 100)}%` }} /></div>
            <small>Used {used} B · peak {peak} B of {TOP - limitOf(params)} B</small>
          </div>
          <div className="mcl-l07-legend"><span className="ret">return addr</span><span className="local">local / param</span><span className="saved">saved reg</span><span className="stale">popped (stale)</span></div>
        </Panel>

        <div className="mcl-col mcl-l07-side">
          <Panel title="CPU State" icon="chip" tools={<span className="mcl-l07-rt"><i />Real-time</span>}>
            <dl className="mcl-l07-kv">
              {[["Program Counter (PC)", PC], ["Stack Pointer (SP)", SP], ["Link Register (LR)", LR]].map(([k, r]) => (
                <div key={k as string}><dt>{k}</dt><dd className={cpu.changed.has(r as number) ? "chg" : ""}>{hx(cpu.r[r as number]!, r === PC ? 4 : 8)}</dd></div>
              ))}
            </dl>
            <div className="mcl-l07-curins"><small>Current Instruction</small><code>{cur ? cur.text : "—"}{cur?.note ? <em> ; {cur.note}</em> : null}</code></div>
            <div className="mcl-l07-regs">
              <div><small>General Registers</small>
                <div className="mcl-l07-gp">{gp.map((r) => <div key={r} className={cpu.changed.has(r) ? "chg" : ""}><span>R{r}</span><code>{hx(cpu.r[r]!, 8)}</code></div>)}</div>
              </div>
              <div><small>Flags</small>
                <div className="mcl-l07-flags">{([["N", cpu.n], ["Z", cpu.z], ["C", cpu.c], ["V", cpu.v]] as const).map(([f, v]) => <div key={f}><span>{f}</span><code className={v ? "on" : ""}>{v ? 1 : 0}</code></div>)}</div>
              </div>
            </div>
            {cpu.fault ? <div className="mcl-l07-fault"><Icon name="alert" />{cpu.fault}</div> : null}
          </Panel>
          <Panel title="Stack Activity Log" icon="list" className="mcl-l07-logp" tools={<button type="button" className="mcl-btn mcl-btn-sm" onClick={() => { cpu.log.length = 0; lab.advance(0); }}>Clear</button>}>
            <div className="mcl-l07-log" ref={logRef} role="log">
              {cpu.log.length ? cpu.log.slice(-80).map((l, i) => (
                <div key={i} className={`k-${l.kind}`}>
                  <time>[{l.t.toFixed(2)}s]</time><i>{logIcon(l.kind)}</i>
                  {l.kind === "exec" ? <span><b>PC: {hx(l.pc)}</b> Executing: {l.text}</span> : <span>{l.text}</span>}
                </div>
              )) : <p className="mcl-muted">No activity yet — press Simulate or Step.</p>}
            </div>
          </Panel>
          <LearningNotes notes={{
            takeaways: ["Understand how the program counter (PC) changes during execution.", "See how CALL/BL pushes the return address to the stack.", "Observe stack pointer (SP) movement on PUSH and POP.", "Watch how RET (BX LR) returns to the correct address.", "Explore the stack in memory and see actual values being stored."],
            observe: "Watch PC advance by 2 (or 4 for BL) and SP drop by 4 for every word pushed.",
            tryIt: "Pause, then Step through BL add_numbers and watch LR receive the return address.",
            measure: `This run: ${cpu.executed} instructions, ${cpu.cycles} cycles, peak stack ${peak} bytes, max call depth ${cpu.maxDepth}.`,
            modify: "Load the nested-calls or recursion example, or change factorial(4) to factorial(8), then press Run.",
            runAgain: "Enable Tiny stack or Corrupt saved LR and see which fault the CPU raises.",
            challenge: "How deep can factorial() recurse before the 256-byte stack overflows? Predict it from the frame size, then test it.",
            question: "Try modifying the code, add nested function calls, and observe how multiple return addresses are stored on the stack.",
            checks: [{ label: "Saw a CALL save its return address", done: done.current.call }, { label: "Reached three nested frames", done: done.current.nested }, { label: "Caused a stack overflow HardFault", done: done.current.overflow }],
          }} />
        </div>

        <CodeEditor lab={lab} className="mcl-l07-code" currentLine={cur?.line} languages={[{ label: "C (ARM GCC)", code: DEFAULT }, { label: "C (nested calls)", code: NESTED }, { label: "C (recursion)", code: RECURSION }]} />

        <Panel title="Memory View" icon="table" className="mcl-l07-mem" tools={
          <select className="mcl-input mcl-l07-sel" value={params.view} onChange={(e) => lab.setParam("view", e.target.value)} aria-label="Memory region">
            <option value="top">RAM (stack top)</option><option value="sp">RAM (around SP)</option>
          </select>}>
          <table className="mcl-table mcl-mono mcl-l07-memt">
            <thead><tr><th>Address</th><th>+0</th><th>+4</th><th>+8</th><th>+C</th><th>ASCII</th></tr></thead>
            <tbody>
              {memRows.map((a) => (
                <tr key={a} className={sp >= a && sp < a + 16 ? "sp" : ""}>
                  <td>{hx(a, 8)}</td>
                  {[0, 4, 8, 12].map((o) => <td key={o} className={`${cpu.stackWrites.has(a + o) ? "new" : ""} ${a + o === sp ? "spc" : ""}`}>{(cpu.read(a + o) >>> 0).toString(16).toUpperCase().padStart(8, "0")}</td>)}
                  <td>{[0, 4, 8, 12].map((o) => ascii(cpu.read(a + o))).join("")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mcl-l07-memnote">Little-endian words · highlighted row contains SP ({hx(sp, 8)}) · flashing cells were just written.</p>
        </Panel>
      </div>
    </LabShell>
  );
}
