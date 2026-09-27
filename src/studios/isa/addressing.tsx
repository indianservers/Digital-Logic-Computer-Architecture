import { useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { reducedMotion } from "../aca/animation/acaMotion";
import {
  ADDR_MODES, ALU_OPS, commitAddr, freshAddr, hex32, parseAddrMode, readReg, regIndex, viewAddr,
  type AddrMode, type AddrState, type AluOp, type FieldView,
} from "../../engines/isa/addressLab";

const NAV: Array<{ id: AddrMode; label: string; hint: string }> = [
  { id: "immediate", label: "Immediate", hint: "Value encoded in the instruction" },
  { id: "register", label: "Register", hint: "Operand already inside the register file" },
  { id: "direct", label: "Direct", hint: "Address comes directly from the instruction" },
  { id: "indirect", label: "Indirect", hint: "A memory cell holds the real address" },
  { id: "base-offset", label: "Base + Offset", hint: "Starting address plus a signed displacement" },
  { id: "indexed", label: "Indexed", hint: "Base plus a variable index register" },
];

const COPY: Record<AddrMode, { title: string; sub: string }> = {
  immediate: { title: "Immediate Addressing", sub: "Operand is a constant value encoded in the instruction itself." },
  register: { title: "Register Addressing", sub: "Operand is in a CPU register." },
  direct: { title: "Direct Addressing", sub: "Instruction contains the memory address of the operand." },
  indirect: { title: "Indirect Addressing", sub: "Instruction contains the address of a pointer to the operand." },
  "base-offset": { title: "Base + Offset Addressing", sub: "Effective address is the sum of a base register and a constant offset." },
  indexed: { title: "Indexed Addressing", sub: "Effective address is the sum of a base, an index register, and an optional offset." },
};

const NOTE: Record<AddrMode, string> = {
  immediate: "The operand is available immediately — no memory access is needed.",
  register: "All operands are in registers — no memory access is required.",
  direct: "The effective address is explicitly specified in the instruction.",
  indirect: "Adds an extra level of memory access (also called memory indirection).",
  "base-offset": "Commonly used for accessing arrays, structures, and stack data.",
  indexed: "Useful for accessing array elements and table lookups.",
};

const COMPARE = [
  ["Immediate", "Inside the instruction", "No", "Not applicable", "Constants"],
  ["Register", "Inside a register", "No", "Not applicable", "ALU operations"],
  ["Direct", "Memory", "Yes", "Address in the instruction", "Absolute access"],
  ["Indirect", "Memory", "Yes", "EA = Mem[pointer address]", "Pointers"],
  ["Base + Offset", "Memory", "Yes", "EA = base + offset", "Arrays, stack, structures"],
  ["Indexed", "Memory", "Yes", "EA = base + index + offset", "Tables and array elements"],
];

function Glyph({ kind }: { kind: AddrMode | "run" | "reset" }) {
  const p = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (kind === "immediate") return <svg {...p}><path d="M9 4h6M12 4v16M8 20h8" /></svg>;
  if (kind === "register") return <svg {...p}><rect x="4" y="5" width="16" height="14" rx="2" /><path d="M8 9h8M8 13h5" /></svg>;
  if (kind === "direct") return <svg {...p}><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M8 8h8M8 12h8M8 16h4" /></svg>;
  if (kind === "indirect") return <svg {...p}><path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.2 1.2" /><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.2-1.2" /></svg>;
  if (kind === "base-offset") return <svg {...p}><path d="M12 5v14M5 12h14" /></svg>;
  if (kind === "indexed") return <svg {...p}><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></svg>;
  if (kind === "run") return <svg {...p}><path d="M8 6l10 6-10 6z" fill="currentColor" stroke="none" /></svg>;
  return <svg {...p}><path d="M4 12a8 8 0 1 0 2.3-5.7" /><path d="M4 4v5h5" /></svg>;
}

function bank(): Record<AddrMode, AddrState> {
  return {
    immediate: freshAddr("immediate"),
    register: freshAddr("register"),
    direct: freshAddr("direct"),
    indirect: freshAddr("indirect"),
    "base-offset": freshAddr("base-offset"),
    indexed: freshAddr("indexed"),
  };
}

export function AddressingPanel({ explain }: { explain: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const [params, setParams] = useSearchParams();
  const mode = parseAddrMode(params.get("mode"));
  const [states, setStates] = useState(bank);
  const [stage, setStage] = useState(-1);
  const [pulse, setPulse] = useState(0);
  const state = states[mode];
  const view = viewAddr(mode, state);
  const index = ADDR_MODES.indexOf(mode);
  useGSAP(() => {
    if (!pulse || reducedMotion()) return;
    gsap.fromTo(".amx-hot", { scale: 1.04 }, { scale: 1, duration: 0.35, clearProps: "scale" });
  }, { scope: root, dependencies: [pulse, stage] });

  function setMode(next: AddrMode) {
    const query = new URLSearchParams(params);
    query.set("tab", "modes");
    query.set("mode", next);
    setParams(query);
    setStage(-1);
  }

  function patch(partial: Partial<AddrState>) {
    setStates((current) => ({ ...current, [mode]: { ...current[mode], ...partial } }));
    setStage(-1);
  }

  function editReg(index: number, text: string) {
    const value = Math.trunc(Number(text));
    if (!Number.isFinite(value) || index === 0) return;
    patch({ regs: state.regs.map((item, at) => at === index ? value : item) });
  }

  function editMem(address: number, text: string) {
    const value = Math.trunc(Number(text));
    if (!Number.isFinite(value)) return;
    patch({ mem: { ...state.mem, [address]: value } });
  }

  function run() {
    const next = commitAddr(mode, state);
    if (!next) return;
    setStates((current) => ({ ...current, [mode]: next }));
    setStage(view.steps.length - 1);
    setPulse((value) => value + 1);
  }

  function step() {
    const last = view.steps.length - 1;
    const nextStage = stage < 0 ? 0 : Math.min(last, stage + 1);
    if (nextStage === last) {
      const next = commitAddr(mode, state);
      if (!next) return;
      setStates((current) => ({ ...current, [mode]: next }));
    }
    setStage(nextStage);
    setPulse((value) => value + 1);
  }

  function pickRow(address: number) {
    if (mode === "direct") patch({ address });
    if (mode === "indirect") patch({ pointer: address });
  }

  return (
    <div className="amx" ref={root} onKeyDown={(event) => { if (event.key === "Escape") setStage(-1); if (event.key === "Enter" && event.target instanceof HTMLInputElement) run(); }}>
      <nav className="amx-nav" aria-label="Addressing modes">
        {NAV.map((item) => (
          <button key={item.id} type="button" className={mode === item.id ? "on" : ""} aria-current={mode === item.id ? "page" : undefined} title={item.hint} onClick={() => setMode(item.id)}>
            <Glyph kind={item.id} /> {item.label}
          </button>
        ))}
      </nav>
      <div className="amx-body">
        <header className="amx-top">
          <div className="amx-title">
            <span className="amx-badge"><Glyph kind={mode} /></span>
            <div>
              <h2>{COPY[mode].title}</h2>
              <p>{COPY[mode].sub}</p>
            </div>
          </div>
          <div className="amx-pager">
            <span>{index + 1} / 6</span>
            <button type="button" aria-label="Previous addressing mode" onClick={() => { const id = ADDR_MODES[index - 1]; if (id) setMode(id); }} disabled={index === 0}>‹</button>
            <button type="button" aria-label="Next addressing mode" onClick={() => { const id = ADDR_MODES[index + 1]; if (id) setMode(id); }} disabled={index === ADDR_MODES.length - 1}>›</button>
          </div>
        </header>

        <div className={`amx-board ${mode}`}>
          <section className="amx-card amx-asm">
            <h3>Assembly Instruction</h3>
            <p className="amx-code">{view.assembly}</p>
            <p className="amx-mean">{view.meaning}</p>
            {mode === "direct" ? <p className="amx-tag">Generic ISA example</p> : null}
            {mode === "indexed" ? <p className="amx-tag">Generic ISA form</p> : null}
          </section>

          {view.fields ? <FieldCard fields={view.fields} title={mode === "register" ? "R-type Format" : "Instruction Format (I-type)"} active={stage} /> : null}
          {mode === "indirect" ? <StepRail steps={[`Read Mem[${state.pointer}] → ${view.ea ?? 0} (pointer)`, `Read Mem[${view.ea ?? 0}] → ${view.operand} (operand)`, `Load into x${regIndex(state.rd)}`]} stage={stage} /> : null}

          <section className="amx-card amx-how">
            <h3>How it works</h3>
            <ol>
              {view.steps.map((stepText, at) => <li key={stepText} className={at === stage ? "on amx-hot" : at < stage ? "done" : ""}>{stepText}</li>)}
            </ol>
            <p className="amx-note">{NOTE[mode]}</p>
            {explain && view.note !== NOTE[mode] ? <p className="amx-foot">{view.note}</p> : null}
            {explain && mode === "immediate" ? <button type="button" className="amx-link" onClick={() => { const query = new URLSearchParams(params); query.set("tab", "formats"); setParams(query); }}>See how immediate bits are encoded in Formats</button> : null}
            {explain && mode === "base-offset" ? <button type="button" className="amx-link" onClick={() => { const query = new URLSearchParams(params); query.set("tab", "load"); setParams(query); }}>See load/store data movement</button> : null}
          </section>

          {mode === "base-offset" || mode === "indexed" ? <EaCard mode={mode} state={state} ea={view.ea} /> : null}
          {view.memory ? <MemTable rows={view.memory} onEdit={editMem} onPick={pickRow} /> : null}
          {mode !== "direct" ? <RegTable rows={view.regs} onEdit={editReg} /> : null}

          <section className={`amx-card amx-result ${pulse && stage === view.steps.length - 1 ? "amx-hot" : ""}`}>
            <h3>Execution Result</h3>
            {view.error ? <p className="amx-error">{view.error}</p> : (
              <>
                <p>{mode === "base-offset" || mode === "indexed" ? view.loaded : view.equation}</p>
                <strong>{`x${regIndex(state.rd)} = ${view.operand}`}</strong>
                <span>{hex32(view.operand)}</span>
                {view.ea !== null && (mode !== "direct" || explain) ? <em>Effective address = {view.ea}. The operand is Mem[EA], not the address itself.</em> : null}
              </>
            )}
            <div className="amx-actions">
              <button type="button" className="amx-go green" onClick={run}><Glyph kind="run" /> Run</button>
              <button type="button" className="amx-quiet" onClick={() => { setStates((current) => ({ ...current, [mode]: freshAddr(mode) })); setStage(-1); }}><Glyph kind="reset" /> Reset</button>
            </div>
          </section>
        </div>

        <section className="amx-try">
          <h3>Try it yourself</h3>
          <RegSelect label="Destination" name="Destination register" value={state.rd} onChange={(value) => patch({ rd: value })} />
          {mode === "immediate" || mode === "register" ? <RegSelect label={mode === "register" ? "Source 1 (rs1)" : "Source (rs1)"} name="Source register" value={state.rs1} onChange={(value) => patch({ rs1: value })} /> : null}
          {mode === "register" ? <RegSelect label="Source 2 (rs2)" name="Second source" value={state.rs2} onChange={(value) => patch({ rs2: value })} /> : null}
          {mode === "register" ? (
            <label>Operation
              <select aria-label="Operation" value={state.op} onChange={(event) => patch({ op: event.target.value as AluOp })}>
                {ALU_OPS.map((op) => <option key={op}>{op}</option>)}
              </select>
            </label>
          ) : null}
          {mode === "immediate" ? <Num label="Immediate" name="Immediate value" value={state.imm} onChange={(value) => patch({ imm: value })} /> : null}
          {mode === "direct" ? <Num label="Memory Address" name="Direct address" value={state.address} onChange={(value) => patch({ address: value })} /> : null}
          {mode === "indirect" ? <Num label="Pointer Address" name="Pointer address" value={state.pointer} onChange={(value) => patch({ pointer: value })} /> : null}
          {mode === "base-offset" || mode === "indexed" ? <RegSelect label="Base Register" name="Base register" value={state.base} onChange={(value) => patch({ base: value })} /> : null}
          {mode === "indexed" ? <RegSelect label="Index Register" name="Index register" value={state.index} onChange={(value) => patch({ index: value })} /> : null}
          {mode === "base-offset" || mode === "indexed" ? <Num label="Offset" name="Offset" value={state.offset} onChange={(value) => patch({ offset: value })} /> : null}
          <div className="amx-actions">
            <button type="button" className="amx-quiet" onClick={step}>Step</button>
            <button type="button" className="amx-go" onClick={run}><Glyph kind="run" /> Run</button>
            <button type="button" className="amx-quiet" onClick={() => { setStates((current) => ({ ...current, [mode]: freshAddr(mode) })); setStage(-1); }}><Glyph kind="reset" /> Reset</button>
          </div>
        </section>

        {mode === "indexed" ? (
          <section className="amx-card">
            <h3>Compare addressing modes</h3>
            <table className="amx-table">
              <thead><tr><th>Mode</th><th>Operand location</th><th>Memory access?</th><th>Effective address</th><th>Typical use</th></tr></thead>
              <tbody>
                {COMPARE.map((row, at) => {
                  const id = ADDR_MODES[at];
                  return (
                    <tr key={row[0]} className={id === mode ? "on" : ""} onClick={() => { if (id) setMode(id); }} title={row[4]}>
                      {row.map((cell) => <td key={cell}>{cell}</td>)}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        ) : null}
        {explain && view.ea !== null ? <p className="amx-foot">EA = {view.ea}. Operand = {view.operand}. x{regIndex(state.rd)} currently holds {readReg(state.regs, regIndex(state.rd))}.</p> : null}
      </div>
    </div>
  );
}

function FieldCard({ fields, title, active }: { fields: FieldView[]; title: string; active: number }) {
  const markers = [31, 25, 20, 15, 12, 7, 0];
  return (
    <section className="amx-card amx-fmt">
      <h3>{title}</h3>
      <div className="amx-scale" aria-hidden="true">{markers.map((bit) => <span key={bit}>{bit}</span>)}</div>
      <div className="amx-fields" role="img" aria-label={title}>
        {fields.map((field) => <div key={field.name} className={`tone-${field.tone} ${active >= 0 ? "live" : ""}`} style={{ flex: `${field.hi - field.lo + 1} 1 0` }} title={`${field.name}, bits ${field.hi}–${field.lo}`}>{field.name}</div>)}
      </div>
    </section>
  );
}

function EaCard({ mode, state, ea }: { mode: AddrMode; state: AddrState; ea: number | null }) {
  const base = readReg(state.regs, regIndex(state.base));
  const index = readReg(state.regs, regIndex(state.index));
  return (
    <section className="amx-card amx-ea">
      <h3>Effective Address Calculation</h3>
      <p><span>Base register (x{regIndex(state.base)})</span><b>{base}</b><i>{hex32(base)}</i></p>
      {mode === "indexed" ? <p><span>Index register (x{regIndex(state.index)})</span><b>{index}</b><i>{hex32(index)}</i></p> : null}
      <p><span>Offset</span><b>{state.offset}</b><i>{hex32(state.offset)}</i></p>
      <p className="sum" title="Final address sent to memory"><span>Effective address</span><b>{ea}</b><i>{ea === null ? "" : hex32(ea)}</i></p>
    </section>
  );
}

function MemTable({ rows, onEdit, onPick }: { rows: Array<{ address: number; value: number; role: string }>; onEdit: (address: number, text: string) => void; onPick: (address: number) => void }) {
  return (
    <section className="amx-card amx-mem">
      <h3>Memory (Data)</h3>
      <table className="amx-table">
        <thead><tr><th>Address</th><th>Value (dec)</th><th>Value (hex)</th></tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.address} className={row.role === "idle" ? "" : row.role} onClick={() => onPick(row.address)} title={row.role === "pointer" ? "This cell holds the address" : row.role === "target" ? "Operand loaded from this address" : "Memory cell"}>
              <td className="mono">{row.address}</td>
              <td><input aria-label={`Memory ${row.address}`} value={row.value} onChange={(event) => onEdit(row.address, event.target.value)} onClick={(event) => event.stopPropagation()} /></td>
              <td className="mono">{hex32(row.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function RegTable({ rows, onEdit }: { rows: Array<{ index: number; value: number; role: string }>; onEdit: (index: number, text: string) => void }) {
  return (
    <section className="amx-card amx-regs">
      <h3>Registers</h3>
      <table className="amx-table">
        <thead><tr><th>Register</th><th>Value (dec)</th><th>Value (hex)</th></tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.role}-${row.index}`} className={row.role} title={row.role === "dest" ? "Destination register" : row.role === "index" ? "Variable position" : row.role === "base" ? "Starting address" : "Source register"}>
              <td>x{row.index}</td>
              <td>{row.index === 0 ? <span>0</span> : <input aria-label={`Register x${row.index}`} value={row.value} onChange={(event) => onEdit(row.index, event.target.value)} />}</td>
              <td className="mono">{hex32(row.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function RegSelect({ label, name, value, onChange }: { label: string; name: string; value: number; onChange: (value: number) => void }) {
  return (
    <label>{label}
      <select aria-label={name} value={value} onChange={(event) => onChange(regIndex(Number(event.target.value)))}>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => <option key={index} value={index}>x{index}</option>)}
      </select>
    </label>
  );
}

function Num({ label, name, value, onChange }: { label: string; name: string; value: number; onChange: (value: number) => void }) {
  return (
    <label>{label}
      <input aria-label={name} value={value} onChange={(event) => { const next = Math.trunc(Number(event.target.value)); if (Number.isFinite(next)) onChange(next); }} />
    </label>
  );
}

function StepRail({ steps, stage }: { steps: string[]; stage: number }) {
  return (
    <section className="amx-card amx-rail">
      <h3>Step-by-Step</h3>
      <ol>
        {steps.map((step, at) => <li key={step} className={at === Math.min(stage, steps.length - 1) && stage >= 0 ? "on" : ""}>{step}</li>)}
      </ol>
    </section>
  );
}
