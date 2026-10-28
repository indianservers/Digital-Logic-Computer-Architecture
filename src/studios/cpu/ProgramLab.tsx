import { useEffect, useState } from "react";
import { loadProgram, signalsFor, stepStage, type CpuState } from "../../engines/isa/cpu";
import { assemble } from "../../engines/isa/assembler";
import type { BlockCpu } from "../../engines/cpu/blocksLab";
import { useSimulatorCapture } from "../../layout/SimulatorCapture";
import "../shared/executionWorkbench.css";

const EXAMPLES = [
  { name: "Add & store", code: "ADDI R1, R0, 3\nADDI R2, R0, 4\nADD R3, R1, R2\nSTORE R3, 16(R0)\nHALT", address: 16, expected: 7 },
  { name: "Load & double", code: "LOAD R1, 8(R0)\nADD R2, R1, R1\nSTORE R2, 16(R0)\nHALT", address: 16, expected: 12 },
  { name: "Taken branch", code: "ADDI R1, R0, 1\nBEQ R1, R1, 2\nADDI R2, R0, 31\nADDI R2, R0, 7\nSTORE R2, 16(R0)\nHALT", address: 16, expected: 7 },
];
const hex = (n: number) => "0x" + (n & 65535).toString(16).toUpperCase().padStart(4, "0");
export function ProgramLab({ onCpu, manualRevision }: { onCpu: (cpu: BlockCpu) => void; manualRevision: number }) {
  const [source, setSource] = useState(EXAMPLES[0]!.code), [loaded, setLoaded] = useState("");
  const [machine, setMachine] = useState<CpuState | null>(null), [running, setRunning] = useState(false), [error, setError] = useState("");
  const [preset, setPreset] = useState(0), [history, setHistory] = useState<CpuState[]>([]);
  const built = assemble(source), dirty = source !== loaded, signals = machine ? signalsFor(machine.decoded, machine.stage) : null;
  useSimulatorCapture("cpu.connected-datapath", () => ({ machine, source, loaded, running, signals, history, preset, error }), "1");
  useEffect(() => { setRunning(false); setMachine(null); setHistory([]); setLoaded(""); }, [manualRevision]);
  function commit(next: CpuState) {
    setMachine(next);
    onCpu({ pc: next.pc, ir: next.ir, mar: next.mar, mdr: next.mdr, sp: 0, regs: next.regs.slice(), ...next.flags });
  }
  function load() {
    setRunning(false);
    const next = loadProgram(source, { 8: 6 });
    if ("error" in next) { setError(next.error); return; }
    setLoaded(source); setError(""); setHistory([]); commit(next);
  }
  function step(instruction = false) {
    if (!machine || dirty || machine.halted) return;
    setHistory(rows => [...rows, machine].slice(-64));
    let next = stepStage(machine), budget = 8;
    if (instruction) while (!next.halted && next.retired === machine.retired && budget-- > 0) next = stepStage(next);
    commit(next);
  }
  useEffect(() => {
    if (!running) return;
    if (!machine || dirty || machine.halted || machine.cycles >= 2000) { setRunning(false); return; }
    const timer = window.setTimeout(() => step(), 180);
    return () => window.clearTimeout(timer);
  }, [running, machine, dirty]);
  const active = machine?.stage ?? "IF", checks = [!!machine && machine.retired > 0, machine?.dmem[EXAMPLES[preset]!.address] === EXAMPLES[preset]!.expected, !!machine?.halted];
  return <div className="xw">
    <section className="xw-card"><h2>Connect the blocks. Execute a program.</h2><p>This lab connects PC, IR, MAR, MDR, registers, ALU and memory through the LogicLab-16 engine. It uses 16-bit words and word addresses; the manual block experiments also support wider values. Loading replaces the shared block values. Manual edits require reloading.</p></section>
    <div className="xw-presets">{EXAMPLES.map((p,i)=><button key={p.name} onClick={()=>{setRunning(false);setPreset(i);setSource(p.code);setLoaded("");}}>{p.name}<small>Memory[16] → {p.expected}</small></button>)}</div>
    <div className="xw-toolbar"><button onClick={load} disabled={!built.ok}>Load / reset program</button><button disabled={!machine || dirty || machine.halted || machine.cycles >= 2000} className="primary" onClick={()=>setRunning(v=>!v)}>{running?"Pause":"Run"}</button><button disabled={running || !machine || dirty || machine.halted} onClick={()=>step()}>Step cycle</button><button disabled={running || !machine || dirty || machine.halted} onClick={()=>step(true)}>Step instruction</button><button disabled={running || !history.length || dirty} onClick={()=>{commit(history[history.length-1]!);setHistory(rows=>rows.slice(0,-1));}}>Back</button><span role="status">{dirty?"Load the edited program":machine?.halted?"Halted":(machine?.cycles ?? 0)>=2000?"Cycle budget reached (2000)":running?"Running":machine?"Paused":"Ready"}</span></div>
    <div className="xw-metrics"><div><small>Stage</small><strong>{active}</strong></div><div><small>Cycles</small><strong>{machine?.cycles ?? 0}</strong></div><div><small>Retired</small><strong>{machine?.retired ?? 0}</strong></div><div><small>Memory[16]</small><strong>{hex(machine?.dmem[16] ?? 0)}</strong></div></div>
    <div className="xw-stage-flow">{["IF","ID","EX","MEM","WB"].map(s=><div key={s} className={active===s?"current":""}><strong>{s}</strong><small>{{IF:"PC → memory → IR",ID:"Decode → registers",EX:"Operands → ALU",MEM:"MAR / MDR → memory",WB:"Result → register"}[s]}</small></div>)}</div>
    <DatapathDiagram machine={machine} />
    <div className="xw-grid"><section className="xw-card"><h3>Program editor</h3><textarea aria-label="CPU block program" value={source} onChange={e=>{setRunning(false);setSource(e.target.value);}} spellCheck={false}/>{error&&<p role="alert">{error}</p>}{!built.ok&&<div role="alert">{built.errors.map((e,i)=><p key={i}>Line {e.line}: {e.message}</p>)}</div>}<p>R0 is zero. Memory[8] starts at 6. Step cycle observes one stage; Step instruction advances to retirement.</p></section>
    <section className="xw-card"><h3>Connected datapath · live values</h3><div className="xw-registers">{[["PC",machine?.pc],["IR",machine?.ir],["MAR",machine?.mar],["MDR",machine?.mdr],["ALU",machine?.alu],...(machine?.regs??Array(8).fill(0)).map((v,i)=>["R"+i,v])].map(([name,value])=><div key={String(name)}><small>{name}</small><code>{hex(Number(value??0))}</code></div>)}</div><h4>Control signals for this stage</h4><div className="xw-flags">{signals&&Object.entries(signals).filter(([key])=>key!=="stage").map(([k,v])=><span key={k} className={v===1?"set":""}>{k} <b>{v}</b></span>)}</div><p>{machine?.decoded?.explain ?? "Load a program to inspect decoded control."}</p></section></div>
    <div className="xw-grid"><section className="xw-card"><h3>Memory & instruction listing</h3><div className="xw-table"><table><thead><tr><th>Address</th><th>Word</th><th>Instruction</th></tr></thead><tbody>{built.ok&&built.listing.map(row=><tr key={row.address} className={row.address===machine?.instPc?"current":""}><td>{hex(row.address)}</td><td>{hex(row.word)}</td><td>{row.text}</td></tr>)}</tbody></table></div><p>Data: [8] = {hex(machine?.dmem[8]??6)} · [16] = {hex(machine?.dmem[16]??0)}</p></section><section className="xw-card"><h3>Verify & explain</h3>{["Retire an instruction","Store the preset's expected result","Reach HALT"].map((label,i)=><p key={label}>{checks[i]?"✓":"○"} {label}</p>)}<h4>Latest register / memory changes</h4><pre>{machine?.diff.join("\n") || "No state changes yet."}</pre><ol className="xw-trace">{machine?.trace.slice(-10).map((row,i)=><li key={i}>{row}</li>)}</ol><p>Why does STORE update memory without writing a destination register? Capture before and after MEM in the notebook.</p></section></div>
  </div>;
}

function DatapathDiagram({ machine }: { machine: CpuState | null }) {
  const stage = machine?.stage ?? "IF";
  const nodes = [
    { id: "PC", x: 20, y: 20, value: machine?.pc, stages: ["IF"] },
    { id: "Instruction memory", x: 215, y: 20, value: machine?.imem[machine?.pc ?? 0], stages: ["IF"] },
    { id: "IR / decode", x: 410, y: 20, value: machine?.ir, stages: ["IF", "ID"] },
    { id: "Register file", x: 605, y: 20, value: machine?.regs[machine?.decoded?.rs1 ?? 0], stages: ["ID", "WB"] },
    { id: "MAR", x: 20, y: 140, value: machine?.mar, stages: ["IF", "MEM"] },
    { id: "MDR", x: 215, y: 140, value: machine?.mdr, stages: ["IF", "MEM", "WB"] },
    { id: "Data memory", x: 410, y: 140, value: machine?.dmem[machine?.mar ?? 0], stages: ["MEM"] },
    { id: "ALU", x: 605, y: 140, value: machine?.alu, stages: ["EX"] },
  ];
  return <section className="xw-card"><h3>Signal path · {stage}</h3><svg className="xw-datapath" viewBox="0 0 800 230" role="img" aria-label="Connected CPU datapath with live PC, IR, registers, MAR, MDR, ALU and memory values"><defs><marker id="cpu-program-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10" fill="#3383d6"/></marker></defs>{["M180 55H210", "M375 55H405", "M570 55H600", "M685 90V135", "M600 175H575", "M410 175H380", "M100 210V220H490V215", "M100 90V135", "M295 140V100H490V95"].map((d,i)=><path key={i} d={d} fill="none" stroke="#82add2" strokeWidth="2" markerEnd="url(#cpu-program-arrow)"/>)}{nodes.map(n=><g key={n.id}><rect x={n.x} y={n.y} width="160" height="70" rx="10" fill={n.stages.includes(stage)?"#ddecff":"#f4f8fd"} stroke={n.stages.includes(stage)?"#2577da":"#ccdeec"} strokeWidth={n.stages.includes(stage)?2:1}/><text x={n.x+80} y={n.y+25} textAnchor="middle" fill="#365570" fontSize="12">{n.id}</text><text x={n.x+80} y={n.y+50} textAnchor="middle" fill="#143b65" fontFamily="monospace" fontSize="16">{hex(n.value??0)}</text></g>)}</svg><p>Highlighted blocks participate in the current stage. Arrows show the teaching connections; register enables and memory controls above determine when values commit.</p></section>;
}
