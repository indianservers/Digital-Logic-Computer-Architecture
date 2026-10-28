import { useMemo, useState } from "react";
import { useSimulatorCapture } from "../../layout/SimulatorCapture";
import { assembleA64, enterA64Exception, loadA64, stepA64, type A64Cpu, type A64ExceptionKind } from "../../engines/isaarch/arm";
import type { ArmApi } from "./pages";
import "./experiments.css";
const hx = (v: bigint | number, digits = 16) => "0x" + v.toString(16).padStart(digits, "0");
const flags = (c: A64Cpu) => `${c.flags.n}${c.flags.z}${c.flags.c}${c.flags.v}`;
const PRESETS = {
  flags: [
    { name: "Unsigned carry", source: "ADDS X0, X1, X2\nB.CS carry\nMOV X3, #0\nB done\ncarry: MOV X3, #1\ndone: NOP", a: "0xffffffffffffffff", b: "1", note: "ADDS wraps to zero: NZCV = 0110. B.CS takes the carry path and writes X3 = 1." },
    { name: "Signed overflow", source: "ADDS X0, X1, X2\nB.VS overflow\nMOV X3, #0\nB done\noverflow: MOV X3, #1\ndone: NOP", a: "0x7fffffffffffffff", b: "1", note: "Positive maximum plus one becomes negative: NZCV = 1001. Signed overflow differs from unsigned carry." },
    { name: "Subtract with borrow", source: "SUBS X0, X1, X2\nB.CC borrow\nMOV X3, #0\nB done\nborrow: MOV X3, #1\ndone: NOP", a: "0", b: "1", note: "0 − 1 wraps to all ones. C = 0 means a borrow occurred; NZCV = 1000." },
    { name: "32-bit zero extension", source: "ADDS W0, W1, W2\nNOP", a: "0xffffffff", b: "1", note: "W arithmetic wraps at 32 bits and clears X0’s upper half. NZCV = 0110." },
    { name: "Plain ADD preserves flags", source: "CMP X1, X1\nADD X0, X1, X2\nNOP", a: "7", b: "2", note: "CMP sets NZCV = 0110. The following ADD produces 9 without changing those flags." },
  ],
  memory: [
    { name: "Store then load", source: "STR X0, [X1, #0]\nLDR X2, [X1, #0]", a: "0x100", b: "0x1122334455667788", note: "STR writes eight little-endian bytes at 0x100. LDR reconstructs the full value in X2; X1 stays unchanged." },
    { name: "Pre-index writeback", source: "STR X0, [X1, #8]!\nLDR X2, [X1, #0]", a: "0x100", b: "0x1122334455667788", note: "STR accesses base + 8, then commits X1 = 0x108. A fault commits neither data nor writeback." },
    { name: "Post-index writeback", source: "STR X0, [X1], #8\nLDR X2, [X1, #0]", a: "0x100", b: "0x1122334455667788", note: "STR accesses the old base 0x100 and advances X1 to 0x108. LDR then reads the next word, initially zero." },
    { name: "SP stack frame", source: "SUB SP, SP, #16\nSTR X0, [SP, #0]\nLDR X2, [SP, #0]\nADD SP, SP, #16", a: "0x100", b: "0xfedcba9876543210", note: "A 16-byte frame keeps SP aligned. Store/load uses the actual SP, and the final ADD releases the frame." },
    { name: "Alignment fault", source: "STR X0, [X1, #0]", a: "0x101", b: "0x1122334455667788", note: "This teaching memory requires 8-byte aligned 64-bit accesses. The store stops without changing bytes or retiring." },
    { name: "Bounds fault", source: "LDR X2, [X1, #8]!", a: "0xff8", b: "7", note: "Address 0x1000 is beyond the 4 KiB memory. X1 and X2 remain unchanged; the access does not retire." },
  ],
};
type View = "flags" | "memory" | "exceptions";
interface Evidence { instruction: string; before: A64Cpu; after: A64Cpu }
export function ArmExperiment({ api, view }: { api: ArmApi; view: View }) {
  const presets = view === "memory" ? PRESETS.memory : PRESETS.flags;
  const [source, setSource] = useState(view === "exceptions" ? "ADDS X0, X1, X2\nSVC #42\nADD X3, X3, #1\nNOP" : presets[0]!.source);
  const [a, setA] = useState(view === "memory" ? "0x100" : view === "exceptions" ? "0x7fffffffffffffff" : "0xffffffffffffffff"), [b, setB] = useState(view === "memory" ? "0x1122334455667788" : "1");
  const [handler, setHandler] = useState("SUBS X8, X8, X8\nADD X9, X9, #1\nERET");
  const [kind, setKind] = useState<A64ExceptionKind>("SVC"), [origin, setOrigin] = useState<0 | 1>(0);
  const [evidence, setEvidence] = useState<Evidence[]>([]), [note, setNote] = useState(view === "exceptions" ? "Step ADDS, then SVC. Execute the handler and ERET; verify that NZCV and the caller’s EL are restored before the user program resumes." : presets[0]!.note);
  const [loaded, setLoaded] = useState(false), [memoryStart, setMemoryStart] = useState("0x100");
  const built = useMemo(() => assembleA64(source), [source]);
  useSimulatorCapture(`ARM executable ${view} experiment`, () => ({ source, handler, a, b, kind, origin, loaded, evidence: evidence.slice(-12).map(row => ({ instruction: row.instruction, before: { pc: row.before.pc, flags: row.before.flags, el: row.before.el, sp: row.before.sp }, after: { pc: row.after.pc, flags: row.after.flags, el: row.after.el, sp: row.after.sp }, registers: row.after.x.map((value, i) => ({ register: `X${i}`, before: row.before.x[i], after: value })).filter(r => r.before !== r.after), bytes: Array.from(row.after.mem).flatMap((value, i) => value === row.before.mem[i] ? [] : [{ address: i, before: row.before.mem[i], after: value }]) })), memoryStart, memoryWindow: { address: safeStart, bytes: Array.from(api.cpu.mem.slice(safeStart, safeStart + 64)) }, cpu: { ...api.cpu, mem: undefined } }), "a64-experiments-2");
  function setup() {
    setLoaded(false);
    const c = loadA64(source);
    if ("ok" in c) { api.setStatus(c.error); return; }
    try {
      const left = BigInt(a), right = BigInt(b);
      if (left < 0n || right < 0n || left > 0xffffffffffffffffn || right > 0xffffffffffffffffn) throw Error("Use unsigned 64-bit decimal or hexadecimal values.");
      if (view === "memory") { c.x[1] = left; c.x[0] = right; c.sp = 0x200n; c.x[2] = 0xaaaaaaaaaaaaaaaan; }
      else { c.x[1] = left; c.x[2] = right; c.x[0] = 0xffffffffffffffffn; }
      if (view === "exceptions") {
        const h = assembleA64(handler);
        if (!h.ok) throw Error(h.errors.join("\n"));
        if (h.words.length > 32) throw Error("Handler must fit its 128-byte vector slot.");
        c.el = origin;
        for (const offset of [0x200, 0x280, 0x300, 0x380, 0x400, 0x480, 0x500, 0x580]) h.words.forEach((w, i) => { for (let j = 0; j < 4; j++) c.mem[c.vbar + offset + i * 4 + j] = (w >>> (j * 8)) & 255; });
      }
      api.setCpu(c); setEvidence([]); setLoaded(true); api.setStatus("Experiment loaded. Step executes the word at PC; Run is bounded to 64 instructions.");
    } catch (err) { api.setStatus((err as Error).message); }
  }
  function execute(count: number) {
    let c = api.cpu; const rows: Evidence[] = [];
    for (let i = 0; i < count && !c.halted; i++) {
      const next = stepA64(c); rows.push({ instruction: next.decoded?.text ?? "Stop", before: c, after: next }); c = next;
    }
    api.setCpu(c); setEvidence(old => [...old, ...rows].slice(-64)); api.setStatus(c.halted ? c.trace[c.trace.length - 1]! : count === 1 ? "Instruction executed." : "Reached the 64-instruction run bound.");
  }
  function inject() {
    const next = enterA64Exception(api.cpu, kind);
    setEvidence(old => [...old, { instruction: `Injected ${kind} between instructions`, before: api.cpu, after: next }].slice(-64)); api.setCpu(next); api.setStatus(next.trace[next.trace.length - 1]!);
  }
  const last = evidence[evidence.length - 1], c = api.cpu;
  const start = Number(memoryStart), safeStart = Number.isInteger(start) && start >= 0 && start <= c.mem.length - 64 ? start : 0x100;
  function editSource(value: string) { setSource(value); setLoaded(false); }
  return <section className="arm-experiment">
    <div className="ae-intro"><h2>{view === "flags" ? "Execute NZCV and conditional branches" : view === "memory" ? "Execute loads, stores, and writeback" : "Execute exception entry, handler, and return"}</h2><p>{note}</p></div>
    {view !== "exceptions" && <div className="ae-actions" aria-label="Experiment presets">{presets.map(p => <button key={p.name} onClick={() => { editSource(p.source); setA(p.a); setB(p.b); setNote(p.note); }}>{p.name}</button>)}</div>}
    <div className="ae-columns"><section className="ae-card"><h3>Experiment setup</h3><label>{view === "memory" ? "Initial X1 base address" : "Initial X1 operand"}<input value={a} onChange={event => { setA(event.target.value); setLoaded(false); }} /></label><label>{view === "memory" ? "Initial X0 store value" : "Initial X2 operand"}<input value={b} onChange={event => { setB(event.target.value); setLoaded(false); }} /></label>
      <label>A64 experiment source<textarea rows={8} spellCheck={false} value={source} onChange={event => editSource(event.target.value)} /></label>
      {view === "exceptions" && <><label>Initial exception level<select value={origin} onChange={event => { setOrigin(Number(event.target.value) as 0 | 1); setLoaded(false); }}><option value={0}>EL0 application</option><option value={1}>EL1 kernel (SP_EL1)</option></select></label><label>EL1 vector handler<textarea rows={5} spellCheck={false} value={handler} onChange={event => { setHandler(event.target.value); setLoaded(false); }} /></label><p>The handler is installed at each modeled EL1 vector slot. VBAR = 0x800; EL0 synchronous entry = 0xC00; current EL1 synchronous entry = 0xA00.</p></>}
      <div className="ae-actions"><button onClick={setup}>Load experiment</button><button disabled={!loaded || c.halted} onClick={() => execute(1)}>Step instruction</button><button disabled={!loaded || c.halted} onClick={() => execute(64)}>Run up to 64 instructions</button><button disabled={!last} onClick={() => { if (last) { api.setCpu(last.before); setEvidence(evidence.slice(0, -1)); api.setStatus("Restored the state before the last instruction or injected event."); } }}>Back</button></div>
      {!loaded && <p>Load the experiment to apply setup and begin a fresh execution.</p>}<p role="status">{api.status}</p>
    </section><section className="ae-card"><h3>Encoded instructions</h3><pre>{built.ok ? built.words.map((w, i) => `${hx(i * 4, 4)}  ${hx(w, 8)}  ${built.listing[i]}`).join("\n") : built.errors.join("\n")}</pre><h3>Live machine state</h3><div className="ae-metrics">{[["PC", hx(c.pc, 4)], ["Current EL", `EL${c.el}`], ["NZCV", flags(c)], ["Retired", String(c.retired)], ["SP", hx(c.sp)], ["State", c.halted ? "Stopped" : "Ready"]].map(([name, value]) => <div key={name}><small>{name}</small><strong>{value}</strong></div>)}</div><div className="ae-registers">{[0, 1, 2, 3, 8, 9].map(i => <div key={i}><b>X{i}</b><code>{hx(c.x[i]!)}</code></div>)}</div><p>N = sign bit · Z = zero · C = unsigned carry / no borrow · V = signed overflow.</p></section></div>
    {view === "exceptions" && <section className="ae-card"><h3>Exception state and asynchronous entry</h3><div className="ae-actions"><label>Injected event<select value={kind} onChange={event => setKind(event.target.value as A64ExceptionKind)}><option value="SVC" disabled>SVC executes from source</option>{["IRQ", "FIQ", "SError"].map(k => <option key={k}>{k}</option>)}</select></label><button disabled={!loaded || c.halted || !!c.exception || kind === "SVC"} onClick={inject}>Inject event at current PC</button></div><div className="ae-metrics">{[["ELR_EL1", hx(c.elr, 4)], ["SPSR_EL1", hx(c.spsr, 8)], ["ESR_EL1", hx(c.esr, 8)], ["Exception class", hx(c.esr >>> 26, 2)], ["SVC immediate", String(c.esr & 65535)], ["Active vector", c.exception ? hx(c.exception.vector, 4) : "None"]].map(([name, value]) => <div key={name}><small>{name}</small><strong>{value}</strong></div>)}</div><p>SVC saves the following instruction address. An injected asynchronous event saves the current PC. ERET restores saved NZCV, PC, and EL. IRQ/FIQ/SError use distinct vector slots and leave ESR unchanged in this model.</p><p>Scope: AArch64 EL0 → EL1 and EL1 using SP_EL1; one active exception. Interrupt masks, priorities, nested exceptions, EL2/EL3 routing, and banked stack switching are outside this experiment.</p></section>}
    {view === "memory" && <section className="ae-card"><h3>Actual memory bytes and 64-bit values</h3><label>Memory window start<input value={memoryStart} onChange={event => setMemoryStart(event.target.value)} /></label><p>Showing {hx(safeStart, 4)}–{hx(safeStart + 63, 4)}. Lowest-address byte is the least significant byte. Memory is shared with instruction storage.</p><div className="ae-table"><table><thead><tr><th>Address</th><th>Bytes in increasing address order</th><th>64-bit little-endian value</th></tr></thead><tbody>{Array.from({ length: 8 }, (_, row) => { const addr = safeStart + row * 8; let word = 0n; for (let j = 0; j < 8; j++) word |= BigInt(c.mem[addr + j]!) << BigInt(j * 8); return <tr key={addr}><td>{hx(addr, 4)}</td><td>{Array.from(c.mem.slice(addr, addr + 8)).map(v => v.toString(16).padStart(2, "0")).join(" ")}</td><td>{hx(word)}</td></tr>; })}</tbody></table></div><p>This subset requires 8-byte alignment and halts on invalid data accesses. Real AArch64 normal memory may permit unaligned accesses depending on configuration. Bounds/alignment faults here are diagnostic stops, not modeled architectural data-abort exceptions.</p></section>}
    <section className="ae-card"><h3>Execution evidence</h3>{last && ["LDR", "STR"].includes(last.after.decoded?.mnemonic ?? "") && (() => { const d = last.after.decoded!, base = d.rn === 31 ? last.before.sp : last.before.x[d.rn]!; const address = base + BigInt(d.mode === "post" ? 0 : d.imm); return <p>Effective address: {hx(base)} {d.mode === "post" ? "(old base)" : `+ ${d.imm}`} = {hx(address)} · base writeback: {d.mode ? hx(d.rn === 31 ? last.after.sp : last.after.x[d.rn]!) : "none"} · {last.after.retired === last.before.retired ? "Access fault; no retirement" : "Access committed"}</p>; })()}{last ? <><p><code>{last.instruction}</code> · PC {hx(last.before.pc, 4)} → {hx(last.after.pc, 4)} · NZCV {flags(last.before)} → {flags(last.after)} · EL{last.before.el} → EL{last.after.el}</p><div className="ae-table"><table><thead><tr><th>Changed state</th><th>Before</th><th>After</th></tr></thead><tbody>{last.before.x.flatMap((v, i) => v === last.after.x[i] ? [] : [<tr key={i}><td>X{i}</td><td>{hx(v)}</td><td>{hx(last.after.x[i]!)}</td></tr>])}{last.before.sp !== last.after.sp && <tr><td>SP</td><td>{hx(last.before.sp)}</td><td>{hx(last.after.sp)}</td></tr>}{Array.from(last.after.mem).flatMap((v, i) => v === last.before.mem[i] ? [] : [<tr key={`m${i}`}><td>Byte {hx(i, 4)}</td><td>{hx(last.before.mem[i]!, 2)}</td><td>{hx(v, 2)}</td></tr>])}</tbody></table></div><pre>{evidence.map(row => `${hx(row.before.pc, 4)} → ${hx(row.after.pc, 4)}  ${row.instruction}  NZCV ${flags(row.before)} → ${flags(row.after)}`).join("\n")}</pre></> : <p>Load a preset and step to record the executed instruction, register and byte changes, flags, and control flow. Notebook captures these states; Back restores them.</p>}</section>
    <details className="ae-card"><summary>Supported execution subset</summary><p>32/64-bit ADD, ADDS, SUB, SUBS, CMP; unshifted register operands or immediates 0–4095; MOV immediate 0–65535; 64-bit LDR/STR unsigned, pre-index, post-index; B, B.cond, BL, RET, NOP, SVC and ERET. Unsupported operands produce assembly errors. Instruction steps are functional execution events, not modeled hardware pipeline cycles.</p><p>Reference: <a href="https://developer.arm.com/documentation/102412/latest" target="_blank" rel="noreferrer">Arm AArch64 Exception Model</a>.</p></details>
  </section>;
}
