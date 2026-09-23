import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { ArchitectureFrame, ArchitectureLanding } from "../../layout/ArchitectureFrame";
import { Button, Card, Segmented, parseNumberInput } from "../../design-system/ui";
import { Icon } from "../../design-system/icons";
import { PALETTE, defaultIsa, emptyDesign, type CpuDesign, type IsaField, type IsaInstruction, type NodeKind } from "../../engines/builder/model";
import { assemble, controlTable, formatWord, validateIsa } from "../../engines/builder/isa";
import { HISTORY, designJson, evaluateGraph, hitBreakpoint, loadProgram, parseDesignJson, resetCpu, sampleWave, stepClock, stepInstruction, type ExecTrace, type SimSnap, type WaveSample } from "../../engines/builder/sim";
import { validateDesign } from "../../engines/builder/validate";
import { CPU_TEMPLATES } from "../../engines/builder/templates";
import { saveRecord } from "../../store/projects";
import { ArchCanvas, WIDTHS, applyConnect, applyDelete, applyDeleteWire, applyDrop, applyDuplicate, applyMove, applyPatch } from "../shared/ArchCanvas";

const SPEEDS = ["0.25x", "0.5x", "1x", "2x", "4x"] as const;

function groupPalette() {
  const groups = [...new Set(PALETTE.map((item) => item.group))];
  return groups.map((group) => ({ group, items: PALETTE.filter((item) => item.group === group) }));
}

export function BuilderStudio() {
  const { labId } = useParams();
  const lab = labId ?? "overview";
  const [design, setDesign] = useState<CpuDesign>(() => CPU_TEMPLATES[2]?.build() ?? emptyDesign());
  const [past, setPast] = useState<CpuDesign[]>([]);
  const [future, setFuture] = useState<CpuDesign[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [trace, setTrace] = useState<ExecTrace | null>(null);
  const [history, setHistory] = useState<SimSnap[]>([]);
  const [cursor, setCursor] = useState(-1);
  const [wave, setWave] = useState<WaveSample[]>([]);
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>("1x");
  const [clock, setClock] = useState<0 | 1>(0);
  const [format, setFormat] = useState<"hex" | "bin">("hex");
  const [savedMsg, setSavedMsg] = useState("");
  const [focusIssue, setFocusIssue] = useState<string | undefined>(undefined);

  const issues = useMemo(() => validateDesign(design), [design]);
  const listing = useMemo(() => assemble(design.isa, design.program), [design.isa, design.program]);
  const table = useMemo(() => controlTable(design.isa), [design.isa]);
  const isaIssues = useMemo(() => validateIsa(design.isa), [design.isa]);
  const view = useMemo(() => evaluateGraph(design), [design]);
  const selectedNode = design.nodes.find((node) => node.id === selected[0]);
  const shown = cursor >= 0 ? history[cursor]?.trace ?? trace : trace;

  function commit(next: CpuDesign) {
    setPast((items) => [...items, design].slice(-40));
    setFuture([]);
    setDesign(next);
    setError(null);
  }

  function undo() {
    const previous = past[past.length - 1];
    if (!previous) return;
    setPast((items) => items.slice(0, -1));
    setFuture((items) => [design, ...items]);
    setDesign(previous);
  }

  function redo() {
    const next = future[0];
    if (!next) return;
    setFuture((items) => items.slice(1));
    setPast((items) => [...items, design]);
    setDesign(next);
  }

  function record(next: CpuDesign, nextTrace: ExecTrace) {
    setHistory((items) => [...items, { nodes: design.nodes, cycle: nextTrace.cycle, trace }].slice(-HISTORY));
    setCursor(-1);
    setDesign(next);
    setTrace(nextTrace);
    setWave((items) => [...items, sampleWave(next, nextTrace.cycle, clock, evaluateGraph(next))].slice(-HISTORY));
    const reason = hitBreakpoint(next, nextTrace, design);
    if (reason) {
      setRunning(false);
      setError(reason);
    }
    if (nextTrace.halt) setRunning(false);
  }

  function doStepInstruction() {
    const stepped = stepInstruction(design, (trace?.cycle ?? 0) + 1);
    record(stepped.design, stepped.trace);
  }

  function doStepClock() {
    const nextClock = clock ? 0 : 1;
    let next = stepClock(design, nextClock, clock);
    if (nextClock === 1) {
      const stepped = stepInstruction(next, (trace?.cycle ?? 0) + 1);
      record(stepped.design, stepped.trace);
    } else setDesign(next);
    setClock(nextClock as 0 | 1);
  }

  const designRef = useRef(design);
  designRef.current = design;
  const traceRef = useRef(trace);
  traceRef.current = trace;

  useEffect(() => {
    if (!running) return;
    const ms = { "0.25x": 800, "0.5x": 400, "1x": 200, "2x": 100, "4x": 50 }[speed];
    const id = window.setInterval(() => {
      const stepped = stepInstruction(designRef.current, (traceRef.current?.cycle ?? 0) + 1);
      setHistory((items) => [...items, { nodes: designRef.current.nodes, cycle: stepped.trace.cycle, trace: traceRef.current }].slice(-HISTORY));
      setCursor(-1);
      setDesign(stepped.design);
      setTrace(stepped.trace);
      setWave((items) => [...items, sampleWave(stepped.design, stepped.trace.cycle, 1, evaluateGraph(stepped.design))].slice(-HISTORY));
      const reason = hitBreakpoint(stepped.design, stepped.trace, designRef.current);
      if (reason || stepped.trace.halt) {
        setRunning(false);
        if (reason) setError(reason);
      }
    }, ms);
    return () => window.clearInterval(id);
  }, [running, speed]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement).tagName === "TEXTAREA" || (event.target as HTMLElement).tagName === "INPUT") return;
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        if (selected.length) commit(applyDelete(design, selected));
        setSelected([]);
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        undo();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") {
        event.preventDefault();
        if (selected.length) commit(applyDuplicate(design, selected));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  async function persist() {
    await saveRecord({ id: `builder-${design.name}`, kind: "builder", name: design.name, data: designJson(design), updated: Date.now() });
    setSavedMsg("Saved in this browser.");
  }

  function download() {
    const blob = new Blob([designJson(design)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${design.name.replace(/\s+/g, "-")}.cpu.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function openFile(file: File) {
    void file.text().then((text) => {
      const parsed = parseDesignJson(text);
      if (!parsed.ok) {
        setError(parsed.error);
        return;
      }
      commit(parsed.design);
    });
  }

  function toolbox() {
    return (
      <div className="cpu-toolbar" role="toolbar" aria-label="CPU builder">
        <Button onClick={() => commit(emptyDesign("Untitled CPU"))}>New</Button>
        <Button onClick={() => { const t = CPU_TEMPLATES[2]?.build(); if (t) commit(t); }}>Open template</Button>
        <Button onClick={() => void persist()}>Save locally</Button>
        <Button onClick={download}>Export</Button>
        <label className="btn-ghost" style={{ display: "inline-flex" }}>
          Import
          <input type="file" accept=".json,.cpu.json,application/json" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) openFile(file); }} />
        </label>
        <Button onClick={undo} disabled={!past.length} aria-label="Undo">Undo</Button>
        <Button onClick={redo} disabled={!future.length} aria-label="Redo">Redo</Button>
        <Button onClick={() => setSelected(issues[0]?.nodeId ? [issues[0].nodeId] : selected)}>Validate</Button>
        <Button onClick={() => {
          const loaded = loadProgram(design);
          commit(loaded.design);
          setError(loaded.error);
        }}>Assemble</Button>
        <Button onClick={() => { setDesign(resetCpu(design)); setTrace(null); setHistory([]); setWave([]); setClock(0); setRunning(false); }}><Icon name="reset" size={14} /> Reset</Button>
        <Button onClick={doStepClock}><Icon name="step" size={14} /> Clock</Button>
        <Button onClick={doStepInstruction}><Icon name="step" size={14} /> Step</Button>
        <Button variant="primary" onClick={() => setRunning((value) => !value)}>{running ? <><Icon name="pause" size={14} /> Pause</> : <><Icon name="play" size={14} /> Run</>}</Button>
        <Segmented options={[...SPEEDS]} value={speed} onChange={(value) => setSpeed(value as typeof speed)} />
        <Button onClick={() => commit({ ...design, pan: { ...design.pan, k: Math.min(2, design.pan.k + 0.15) } })}>Zoom</Button>
        <Button onClick={() => commit({ ...design, pan: { x: 0, y: 0, k: 1 } })}>Fit view</Button>
      </div>
    );
  }

  function canvasBlock() {
    return (
      <div className="cpu-workspace">
        {toolbox()}
        <div className="builder">
          <aside className="card palette">
            <h3>Component palette</h3>
            {groupPalette().map((group) => (
              <div key={group.group}>
                <div className="tiny">{group.group}</div>
                <div className="palette-grid">
                  {group.items.map((item) => (
                    <button key={item.kind} type="button" className="palette-item" draggable onDragStart={(event) => event.dataTransfer.setData("kind", item.kind)} aria-label={`Add ${item.label}`}>
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </aside>
          <ArchCanvas
            design={design}
            selected={focusIssue ? [focusIssue] : selected}
            overlay={design.overlay}
            onSelect={(ids, additive) => setSelected(additive ? [...selected, ...ids] : ids)}
            onMove={(id, x, y) => commit(applyMove(design, id, x, y))}
            onConnect={(from, port, to, toPort) => {
              const linked = applyConnect(design, from, port, to, toPort);
              if (linked.error) setError(linked.error);
              else commit(linked.design);
            }}
            onDeleteWire={(id) => commit(applyDeleteWire(design, id))}
            onDropKind={(kind: NodeKind, x, y) => commit(applyDrop(design, kind, x, y))}
            onPan={(pan) => setDesign({ ...design, pan })}
          />
          <aside className="card">
            <h3>Inspector</h3>
            {selectedNode ? (
              <div className="stack">
                <label>Name<input className="input" value={selectedNode.name} onChange={(event) => commit(applyPatch(design, selectedNode.id, { name: event.target.value }))} /></label>
                <label>Width
                  <select className="input" value={selectedNode.width} onChange={(event) => commit(applyPatch(design, selectedNode.id, { width: Number(event.target.value) as (typeof WIDTHS)[number] }))}>
                    {WIDTHS.map((width) => <option key={width} value={width}>{width}-bit</option>)}
                  </select>
                </label>
                <label>Initial / value<input className="input" type="number" value={selectedNode.value} onChange={(event) => commit(applyPatch(design, selectedNode.id, { value: parseNumberInput(event.target.value, selectedNode.value) }))} /></label>
                <p className="tiny">{selectedNode.kind} · {selectedNode.width}-bit · {selectedNode.note || "No note"}</p>
                <Button onClick={() => commit({ ...design, probes: design.probes.includes(selectedNode.id) ? design.probes.filter((id) => id !== selectedNode.id) : [...design.probes, selectedNode.id] })}>
                  {design.probes.includes(selectedNode.id) ? "Remove probe" : "Attach probe"}
                </Button>
              </div>
            ) : <p className="muted">No component selected. Select a component to inspect its properties.</p>}
            <div className="row" style={{ marginTop: 8 }}>
              <Button onClick={() => commit({ ...design, overlay: "data" })}>Data path</Button>
              <Button onClick={() => commit({ ...design, overlay: "control" })}>Control path</Button>
              <Button onClick={() => commit({ ...design, overlay: "both" })}>Both</Button>
            </div>
          </aside>
        </div>
        <div className="grid cards-3">
          <Card title="Execution">
            {shown ? (
              <p className="tiny">Cycle {shown.cycle} · PC {shown.pc} · {shown.mnemonic} · ALU {shown.aluA} {shown.controls.ALUOp} {shown.aluB} = {shown.aluY} · {shown.memOp} · {shown.reason}</p>
            ) : <p className="muted">Assemble and load a program, then step.</p>}
            {error ? <p className="status miss" style={{ fontSize: 14 }}>{error}</p> : null}
            {savedMsg ? <p className="tiny">{savedMsg}</p> : null}
          </Card>
          <Card title="Control signals">
            {shown ? (
              <table className="data">
                <tbody>
                  {Object.entries(shown.controls).map(([key, value]) => (
                    <tr key={key}><td style={{ textAlign: "left" }}>{key}</td><td className={value ? "on" : ""}>{String(value)}</td></tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="muted">Signals appear after the first instruction.</p>}
          </Card>
          <Card title="Probes">
            {design.probes.length === 0 ? <p className="muted">No signals are being monitored. Add a probe to begin.</p> : design.probes.map((id) => {
              const node = design.nodes.find((item) => item.id === id);
              if (!node) return null;
              const value = view.values.get(`${id}:q`) ?? view.values.get(`${id}:y`) ?? node.value;
              return <p key={id} className="tiny">{node.name}: {value} / {value.toString(2)} / 0x{value.toString(16)}</p>;
            })}
          </Card>
        </div>
      </div>
    );
  }

  const editor = (
    <div className="grid cards-2">
      <Card title="Program editor">
        <textarea className="input asm" aria-label="Assembly program" value={design.program} onChange={(event) => commit({ ...design, program: event.target.value })} />
        <div className="row">
          <Button variant="primary" onClick={() => {
            const loaded = loadProgram(design);
            commit(loaded.design);
            setError(loaded.error);
          }}>Assemble & load</Button>
          <Button onClick={() => commit(resetCpu(design))}>Reset CPU</Button>
        </div>
        {listing.ok ? <p className="tiny">{listing.words.length} words loaded from address 0.</p> : listing.errors.map((item) => <p key={item.line} className="status miss" style={{ fontSize: 13 }}>Line {item.line}: {item.message}</p>)}
      </Card>
      <Card title="Machine code">
        {!listing.ok ? <p className="muted">Fix assembler errors to see encodings.</p> : (
          <table className="data">
            <thead><tr><th>Asm</th><th>Word</th></tr></thead>
            <tbody>
              {listing.listing.map((line) => {
                const instr = design.isa.instructions.find((item) => item.mnemonic === line.mnemonic);
                return (
                  <tr key={line.line}>
                    <td style={{ textAlign: "left" }}>{line.text}</td>
                    <td className="mono">{instr ? formatWord(design.isa, line.word, instr.format) : line.word.toString(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );

  function fieldEditor(title: string, fields: IsaField[], onChange: (fields: IsaField[]) => void) {
    return (
      <Card title={title}>
        {fields.map((field, index) => (
          <div key={`${field.name}-${index}`} className="row" style={{ marginBottom: 6 }}>
            <input className="input" aria-label="Field name" value={field.name} onChange={(event) => onChange(fields.map((item, i) => i === index ? { ...item, name: event.target.value } : item))} />
            <input className="input" aria-label="Start bit" type="number" value={field.lo} onChange={(event) => onChange(fields.map((item, i) => i === index ? { ...item, lo: parseNumberInput(event.target.value, field.lo) } : item))} />
            <input className="input" aria-label="Width" type="number" value={field.width} onChange={(event) => onChange(fields.map((item, i) => i === index ? { ...item, width: Math.max(1, parseNumberInput(event.target.value, field.width)) } : item))} />
          </div>
        ))}
        <div className="isa-bits" aria-label="Instruction word">
          {Array.from({ length: design.isa.instrWidth }, (_, bit) => {
            const field = fields.find((item) => bit >= item.lo && bit < item.lo + item.width);
            return <div key={bit} className={field ? "isa-bit on" : "isa-bit"}><strong>{design.isa.instrWidth - 1 - bit}</strong><span>{field?.name ?? "—"}</span></div>;
          })}
        </div>
      </Card>
    );
  }

  const reset = () => {
    setDesign(CPU_TEMPLATES[2]?.build() ?? emptyDesign());
    setHistory([]);
    setTrace(null);
    setWave([]);
    setError(null);
    setRunning(false);
  };

  return (
    <ArchitectureFrame studioId="builder" onReset={reset}>
      {lab === "overview" ? <ArchitectureLanding studioId="builder" /> : null}
      {lab === "builder" || lab === "datapath" || lab === "wires" || lab === "library" || lab === "debug" ? canvasBlock() : null}
      {lab === "isa" ? (
        <div className="grid cards-2">
          <Card title="Instruction identity">
            {design.isa.instructions.map((instr, index) => (
              <div key={instr.mnemonic} className="card" style={{ marginBottom: 8 }}>
                <div className="row">
                  <input className="input" aria-label="Mnemonic" value={instr.mnemonic} onChange={(event) => {
                    const instructions = design.isa.instructions.slice();
                    const current = instructions[index];
                    if (!current) return;
                    instructions[index] = { ...current, mnemonic: event.target.value.toUpperCase() };
                    commit({ ...design, isa: { ...design.isa, instructions } });
                  }} />
                  <input className="input" aria-label="Opcode" type="number" value={instr.opcode} onChange={(event) => {
                    const instructions = design.isa.instructions.slice();
                    const current = instructions[index];
                    if (!current) return;
                    instructions[index] = { ...current, opcode: Number(event.target.value) };
                    commit({ ...design, isa: { ...design.isa, instructions } });
                  }} />
                  <select className="input" aria-label="ALU operation" value={instr.aluOp} onChange={(event) => {
                    const instructions = design.isa.instructions.slice();
                    const current = instructions[index];
                    if (!current) return;
                    instructions[index] = { ...current, aluOp: event.target.value as IsaInstruction["aluOp"] };
                    commit({ ...design, isa: { ...design.isa, instructions } });
                  }}>
                    {["ADD", "SUB", "AND", "OR", "XOR"].map((op) => <option key={op}>{op}</option>)}
                  </select>
                </div>
                <p className="tiny">{instr.operands.join(", ") || "no operands"} · PC {instr.pc} · mem {instr.mem}</p>
              </div>
            ))}
            {isaIssues.map((item) => <p key={item.message} className={item.level === "error" ? "status miss" : "tiny"} style={{ fontSize: 13 }}>{item.message}</p>)}
          </Card>
          <Card title="Preview">
            <p className="muted">{design.isa.name} · {design.isa.instrWidth}-bit instruction · {design.isa.regs} registers · {design.isa.dataWidth}-bit data</p>
            <Button onClick={() => commit({ ...design, isa: defaultIsa(16, 8) })}>Reset ISA</Button>
          </Card>
        </div>
      ) : null}
      {lab === "format" ? (
        <div>
          {fieldEditor("R-type", design.isa.fieldsR, (fieldsR) => commit({ ...design, isa: { ...design.isa, fieldsR } }))}
          {fieldEditor("I-type", design.isa.fieldsI, (fieldsI) => commit({ ...design, isa: { ...design.isa, fieldsI } }))}
          {fieldEditor("J-type", design.isa.fieldsJ, (fieldsJ) => commit({ ...design, isa: { ...design.isa, fieldsJ } }))}
          {fieldEditor("B-type", design.isa.fieldsB, (fieldsB) => commit({ ...design, isa: { ...design.isa, fieldsB } }))}
        </div>
      ) : null}
      {lab === "control" ? (
        <Card title="Control truth table">
          <p className="muted">Generated from instruction definitions. This is an educational mapping, not automatic hardware synthesis.</p>
          <table className="data">
            <thead><tr><th>Instruction</th><th>RegWrite</th><th>ALUSrc</th><th>MemRead</th><th>MemWrite</th><th>ALUOp</th></tr></thead>
            <tbody>
              {table.map((row) => (
                <tr key={row.mnemonic} className={shown?.mnemonic === row.mnemonic ? "on" : ""}>
                  <td>{row.mnemonic}</td><td>{row.RegWrite}</td><td>{row.ALUSrc}</td><td>{row.MemRead}</td><td>{row.MemWrite}</td><td>{row.ALUOp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}
      {lab === "memory" ? (
        <div className="grid cards-2">
          <Card title="Instruction memory">
            {(design.nodes.find((node) => node.kind === "imem")?.mem ?? []).slice(0, 16).map((word, index) => (
              <div key={index} className="spread tiny"><span>{index}</span><span className="mono">{word.toString(16).padStart(4, "0")}</span></div>
            ))}
            {!(design.nodes.find((node) => node.kind === "imem")?.mem.some((word) => word)) ? <p className="muted">Program memory is empty. Assemble and load a program.</p> : null}
          </Card>
          <Card title="Data memory">
            {(design.nodes.find((node) => node.kind === "dmem")?.mem ?? []).slice(0, 24).map((word, index) => (
              <div key={index} className={`mem-cell${word ? " on" : ""}`}><strong>{word}</strong><span className="tiny">{index}</span></div>
            ))}
          </Card>
        </div>
      ) : null}
      {lab === "editor" || lab === "assembler" ? editor : null}
      {lab === "validate" ? (
        <Card title={`${issues.filter((item) => item.level === "error").length} Errors · ${issues.filter((item) => item.level === "warning").length} Warnings`}>
          {issues.length === 0 ? <p className="muted">No architectural issues on this graph.</p> : issues.map((item) => (
            <button key={item.message} type="button" className="palette-item" style={{ width: "100%", textAlign: "left", marginBottom: 6 }} onClick={() => { setFocusIssue(item.nodeId); if (item.nodeId) setSelected([item.nodeId]); }}>
              <strong>{item.level}</strong> {item.message}
            </button>
          ))}
        </Card>
      ) : null}
      {lab === "debug" ? (
        <Card title="Waveform">
          {wave.length === 0 ? <p className="muted">No signals are being monitored. Step the CPU to begin.</p> : (
            <svg className="wave" viewBox={`0 0 ${Math.max(200, wave.length * 12)} 80`} role="img" aria-label="Bounded waveform">
              {wave.map((sample, index) => (
                <rect key={sample.cycle} x={index * 12} y={sample.values.RegWrite ? 20 : 40} width={10} height={18} fill="var(--primary)" opacity={0.7} />
              ))}
            </svg>
          )}
          <div className="row">
            <Button onClick={() => setCursor((value) => Math.max(0, (value < 0 ? history.length : value) - 1))} disabled={!history.length}>Previous cycle</Button>
            <Button onClick={() => setCursor((value) => Math.min(history.length - 1, value + 1))} disabled={cursor < 0 || cursor >= history.length - 1}>Next cycle</Button>
            <Button onClick={() => { setCursor(-1); setDesign(resetCpu(design)); }}>Restart</Button>
            <Button onClick={() => commit({ ...design, breakpoints: [...design.breakpoints, { id: `bp${design.nextId}`, kind: "mnemonic", enabled: true, mnemonic: "HALT" }] })}>Break on HALT</Button>
            <Button onClick={() => commit({ ...design, breakpoints: [...design.breakpoints, { id: `bp${design.nextId}`, kind: "memwrite", enabled: true }] })}>Break on store</Button>
          </div>
          {design.breakpoints.map((point) => (
            <label key={point.id} className="tiny" style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="checkbox" checked={point.enabled} onChange={(event) => commit({ ...design, breakpoints: design.breakpoints.map((item) => item.id === point.id ? { ...item, enabled: event.target.checked } : item) })} />
              {point.kind} {point.mnemonic ?? point.address ?? ""}
            </label>
          ))}
          <p className="tiny">History {history.length}/{HISTORY} · display {format}</p>
          <Button onClick={() => setFormat(format === "hex" ? "bin" : "hex")}>{format}</Button>
        </Card>
      ) : null}
      {lab === "templates" ? (
        <div className="grid cards-3">
          {CPU_TEMPLATES.map((item) => (
            <Card key={item.id} title={item.title}>
              <p className="muted">{item.description}</p>
              <p className="tiny">{item.isa} · {item.width}-bit · {item.level}</p>
              <Button variant="primary" onClick={() => commit(item.build())}>Open in Builder</Button>
            </Card>
          ))}
        </div>
      ) : null}
    </ArchitectureFrame>
  );
}

export default BuilderStudio;
