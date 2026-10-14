import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button, Card, Segmented, Toggle, parseNumberInput } from "../../design-system/ui";
import { Icon } from "../../design-system/icons";
import { PALETTE, addNode, portsOf, emptyDesign, type CpuDesign, type NodeKind } from "../../engines/builder/model";
import { HISTORY, designJson, evaluateGraph, hitBreakpoint, loadProgram, parseDesignJson, resetCpu, sampleWave, stepMicroCycle, stepInstruction, type ExecTrace, type SimSnap, type WaveSample } from "../../engines/builder/sim";
import { validateDesign } from "../../engines/builder/validate";
import { CPU_TEMPLATES } from "../../engines/builder/templates";
import { listRecords, saveRecord } from "../../store/projects";
import { ArchCanvas, WIDTHS, applyConnect, applyDelete, applyDeleteWire, applyDrop, applyDuplicate, applyMove, applyPatch } from "../shared/ArchCanvas";

import { engineeringOf, ensureProject } from "../../engines/builder/project";
import { EngineeringLabs } from "./EngineeringLabs";
import { StudioFrame } from "./StudioFrame";
import { Btn, Status } from "./studioUi";
import { useCpuStorageStatus, useCpuProject, useCpuConflict, resolveCpuConflict } from "./projectStore";
import { BlockProgram } from "./BlockProgram";
import "./builder.css";
import { ComponentIcon } from "./ComponentIcon";
import { WorkspaceTools } from "./WorkspaceTools";
import { conditionMatches, saveVersion, stateChanges, signalsOf } from "../../engines/builder/workspace";
import { componentContract } from "../../engines/builder/componentContract";
import { assemble } from "../../engines/builder/isa";
import { downloadText } from "./studioUi";

function arrangeDesign(design: CpuDesign): CpuDesign {
  return fitDesign({ ...design, nodes: design.nodes.map((node, index) => ({ ...node, x: 35 + (index % 3) * 255, y: 30 + Math.floor(index / 3) * 315 })), pan: { x: 0, y: 0, k: 1 } });
}
function fitDesign(design: CpuDesign): CpuDesign {
  if (!design.nodes.length) return { ...design, pan: { x: 0, y: 0, k: 1 } };
  const left = Math.min(...design.nodes.map(n => n.x)) - 25;
  const top = Math.min(...design.nodes.map(n => n.y)) - 25;
  const width = Math.max(...design.nodes.map(n => n.x + 148)) - left + 25;
  const height = Math.max(...design.nodes.map(n => {const ports=portsOf(n);return n.y+Math.max(56,52+Math.max(ports.filter(p=>p.dir==="in").length,ports.filter(p=>p.dir==="out").length)*16);})) - top + 25;
  const k = Math.min(1.5, 1100 / width, 700 / height);
  return { ...design, pan: { x: -left * k, y: -top * k, k } };
}
const SPEEDS = ["0.25x", "0.5x", "1x", "2x", "4x"] as const;

function groupPalette() {
  const groups = [...new Set(PALETTE.map((item) => item.group))];
  return groups.map((group) => ({ group, items: PALETTE.filter((item) => item.group === group) }));
}

export function BuilderStudio() {
  const { labId } = useParams();
  const navigate = useNavigate();
  const [localProjects, setLocalProjects] = useState<{id:string;name:string;data:string}[] | null>(null);
  const lab = labId ?? "overview";
  const [design, setDesign] = useCpuProject();
  const storageStatus = useCpuStorageStatus();
  const conflict=useCpuConflict();
  useEffect(()=>{if(conflict)setRunning(false);},[conflict]);
  const [projectEpoch,setProjectEpoch]=useState(0);
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
  const [savedMsg, setSavedMsg] = useState("");
  const [workspaceMode, setWorkspaceMode] = useState<"designer" | "blocks">("designer");
  const [search, setSearch] = useState("");
  const [templatePicker, setTemplatePicker] = useState(false);
  const [focus,setFocus]=useState(false);
  const [panels,setPanels]=useState(true);
  const [compact,setCompact]=useState(false);
  const [commands,setCommands]=useState(false);
  const [commandQuery,setCommandQuery]=useState("");
  const [selectedWire,setSelectedWire]=useState("");
  const [bends,setBends]=useState<Record<string,number>>({});
  const [condition,setCondition]=useState("");
  const conditionRef=useRef(condition);conditionRef.current=condition;
  const [recent,setRecent]=useState<NodeKind[]>([]);
  const [paletteFilter,setPaletteFilter]=useState("All");
  const [resetPolicy,setResetPolicy]=useState("clear");
  const [paletteWidth,setPaletteWidth]=useState(245);
  const [inspectorWidth,setInspectorWidth]=useState(265);

  const issues = useMemo(() => validateDesign(design), [design]);
  const view = useMemo(() => evaluateGraph(design), [design]);
  const selectedNode = design.nodes.find((node) => node.id === selected[0]);
  const shown = cursor >= 0 ? history[cursor]?.trace ?? trace : trace;
  const palettePorts=useMemo(()=>Object.fromEntries(PALETTE.map(item=>{const contract=componentContract(item.kind);const width=contract.widths.includes(design.isa.dataWidth)?design.isa.dataWidth:contract.widths[0]!;const node=addNode(emptyDesign(),item.kind,0,0,width).nodes[0]!;return [item.kind,portsOf({...node,inputWidth:["cu","decoder"].includes(item.kind)?design.isa.dataWidth:node.inputWidth}).map(p=>`${p.dir} ${p.name}:${p.width}b ${p.role}`).join("; ")];})),[design.isa.dataWidth]);
  function matchesPart(item:(typeof PALETTE)[number]){const alias=["pc","acc","gpr","regfile","ir","mar","mdr","sp"].includes(item.kind)?"stores value storage register":item.kind==="mux"?"select input selector":"";return (paletteFilter==="All"||paletteFilter==="Recent"&&recent.includes(item.kind)||paletteFilter==="Favorites"&&engineeringOf(design).favorites.includes(item.kind))&&`${item.label} ${componentContract(item.kind).behavior} ${item.group} ${alias}`.toLowerCase().includes(search.toLowerCase());}

  function commit(next: CpuDesign) {
    setRunning(false);
    setPast((items) => [...items, design].slice(-40));
    setFuture([]);
    setDesign(next);
    setError(null);
    setTrace(null);setHistory([]);setWave([]);setClock(0);
  }

  function replaceProject(next:CpuDesign){try{saveVersion(design,`Before replacement · ${design.name}`);}catch{setError("Recovery snapshot failed. Export your project before replacing it.");return;}commit(next);resetCurrentSession();}
  function addPart(kind:NodeKind){setRecent(items=>[kind,...items.filter(k=>k!==kind)].slice(0,6));const contract=componentContract(kind);const width=contract.widths.includes(design.isa.dataWidth)?design.isa.dataWidth:contract.widths[0]!;let next=applyDrop(design,kind,80+(design.nodes.length%4)*210,80+Math.floor(design.nodes.length/4)*100);next=applyPatch(next,next.nodes.at(-1)!.id,{width,inputWidth:["cu","decoder"].includes(kind)?design.isa.dataWidth:Math.min(8,width) as 1|4|8|16|32});commit(next);}
  function locate(id:string){const n=design.nodes.find(n=>n.id===id);if(!n)return;setSelected([id]);setDesign({...design,pan:{x:250-n.x,y:100-n.y,k:1}});}
  function reverseStep(){setRunning(false);const snapshot=history.at(-1);if(!snapshot?.design)return;setDesign(snapshot.design);setTrace(snapshot.trace);setClock(snapshot.clock??0);setHistory(items=>items.slice(0,-1));setWave(items=>items.slice(0,-1));setError(null);}

  function undo() {
    setRunning(false);setTrace(null);setHistory([]);setWave([]);
    const previous = past[past.length - 1];
    if (!previous) return;
    setPast((items) => items.slice(0, -1));
    setFuture((items) => [design, ...items]);
    setDesign(previous);
  }

  function redo() {
    setRunning(false);setTrace(null);setHistory([]);setWave([]);
    const next = future[0];
    if (!next) return;
    setFuture((items) => items.slice(1));
    setPast((items) => [...items, design]);
    setDesign(next);
  }

  function record(next: CpuDesign, nextTrace: ExecTrace) {
    setHistory((items) => [...items, { nodes: design.nodes, cycle: trace?.cycle??0, trace, design:structuredClone(design),clock }].slice(-HISTORY));
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
    if(conditionRef.current){try{if(conditionMatches(conditionRef.current,next,nextTrace)){setRunning(false);setError(`Conditional breakpoint: ${conditionRef.current}`);}}catch(e){setRunning(false);setError(String(e));}}
  }

  function doStepInstruction() {
    if(conflict){setError("Resolve the tab conflict before stepping.");return;}
    const stepped = stepInstruction(design, (trace?.cycle ?? 0) + 1);
    record(stepped.design, stepped.trace);
  }

  function doStepClock() {
    if(conflict){setError("Resolve the tab conflict before stepping.");return;}
    const nextClock = clock ? 0 : 1;
    if (nextClock === 1) {
      const stepped = stepMicroCycle(design, (trace?.cycle ?? 0) + 1);
      record(stepped.design, stepped.trace);
    }
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
      const current = designRef.current;
      if(conditionRef.current){try{if(conditionMatches(conditionRef.current,current,traceRef.current)){setRunning(false);setError(`Conditional breakpoint: ${conditionRef.current}`);return;}}catch(e){setRunning(false);setError(String(e));return;}}
      const config = engineeringOf(current);
      if ((traceRef.current?.cycle ?? 0) >= config.executionLimit) { setRunning(false); setError("Execution limit reached. Reset or increase the simulator limit."); return; }
      const pc = current.nodes.find(n => n.kind === "pc")?.value;
      if (current.breakpoints.some(b => b.enabled && b.kind === "pc" && b.address === pc)) { setRunning(false); setError(`Breakpoint before PC=${pc}. Use Step to continue.`); return; }
      const stepped = stepMicroCycle(current, (traceRef.current?.cycle ?? 0) + 1);
      setHistory((items) => [...items, { nodes: current.nodes, cycle:traceRef.current?.cycle??0, trace: traceRef.current,design:structuredClone(current),clock:0 as const }].slice(-HISTORY));
      setCursor(-1);
      setDesign(stepped.design);
      setTrace(stepped.trace);
      setWave((items) => [...items, sampleWave(stepped.design, stepped.trace.cycle, 1, evaluateGraph(stepped.design))].slice(-HISTORY));
      const reason = hitBreakpoint(stepped.design, stepped.trace, designRef.current);
      if(conditionRef.current){try{if(conditionMatches(conditionRef.current,stepped.design,stepped.trace)){setRunning(false);setError(`Conditional breakpoint: ${conditionRef.current}`);}}catch(e){setRunning(false);setError(String(e));}}
      if (reason || stepped.trace.halt) {
        setRunning(false);
        if (reason) setError(reason);
      }
    }, ms);
    return () => window.clearInterval(id);
  }, [running, speed]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="k"){event.preventDefault();setCommands(v=>!v);return;}
      if(event.key==="Escape"){setCommands(false);return;}
      if ((event.target as HTMLElement).closest("input,textarea,select,[contenteditable=true]")) return;
      if(event.key==="F6"){event.preventDefault();setFocus(v=>!v);}
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
      replaceProject(parsed.design);
    });
  }

  function toolbox() {
    return (
      <div className="cpu-toolbar" role="toolbar" aria-label="CPU builder">
        <Button onClick={() => replaceProject(emptyDesign("Untitled CPU"))}>New</Button>
        <Button onClick={() => setTemplatePicker(!templatePicker)}>▣ Open Template</Button>
        <Button onClick={() => void persist().catch(() => setError("Local save failed. Export your project."))}>Save locally</Button>
        <Button onClick={() => void openLocal()}>Open Local</Button>
        <Button onClick={download}>Export</Button>
        <label className="btn-ghost" style={{ display: "inline-flex" }}>
          Import
          <input type="file" accept=".json,.cpu.json,application/json" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) openFile(file); }} />
        </label>
        <Button onClick={undo} disabled={!past.length} aria-label="Undo">Undo</Button>
        <Button onClick={redo} disabled={!future.length} aria-label="Redo">Redo</Button>
        <Button onClick={() => { setSelected(issues[0]?.nodeId ? [issues[0].nodeId] : selected); setSavedMsg(issues.length ? issues.map(i => i.message).join(" • ") : "Design validated. All connections are consistent."); }}>✓ Validate</Button>
        <Button variant="primary" onClick={() => {
          const loaded = loadProgram(design);
          commit(loaded.design);
          setError(loaded.error);
        }}>Assemble</Button>
        <Button onClick={resetCurrent}><Icon name="reset" size={14} /> Reset</Button>
        <span className="cpu-toolbar-break" />
        <Button onClick={doStepClock}><Icon name="step" size={14} /> Clock</Button>
        <Button onClick={doStepInstruction}><Icon name="step" size={14} /> Step</Button>
        <Button onClick={reverseStep} disabled={!history.at(-1)?.design}>Reverse Step</Button>
        <Toggle on={running} onChange={startRun} label="Run" tone="ok" />
        <Segmented options={[...SPEEDS]} value={speed} onChange={(value) => setSpeed(value as typeof speed)} />
        <Button onClick={() => setDesign({ ...design, pan: { ...design.pan, k: Math.min(2, design.pan.k + 0.15) } })}>Zoom</Button>
        <Button onClick={() => setDesign(fitDesign(design))}>Fit view</Button>
        <Button onClick={()=>setDesign({...design,pan:{...design.pan,k:Math.max(.1,design.pan.k-.15)}})}>Zoom Out</Button><span>{Math.round(design.pan.k*100)}%</span>
        <Button disabled={!selected.length} onClick={()=>locate(selected[0]!)}>Zoom Selection</Button>
      </div>
    );
  }

  function canvasBlock() {
    return (
      <div className={`cpu-workspace ${panels?"":"ws-panel-hidden"} ${compact?"ws-compact":""}`}>
        {toolbox()}
        {error&&<div role="alert"><Status tone="error">{error}</Status></div>}
        <div className="ws-builder-controls"><Btn onClick={()=>setFocus(!focus)}>{focus?"Exit Focus":"Focus Canvas · F6"}</Btn><Btn onClick={()=>setPanels(!panels)}>{panels?"Hide Panels":"Show Panels"}</Btn><Btn onClick={()=>setCompact(!compact)}>{compact?"Illustrated Palette":"Compact Palette"}</Btn><Btn onClick={()=>setCommands(true)}>Commands · Ctrl K</Btn><label>Palette size<input aria-label="Palette size" type="range" min="190" max="340" value={paletteWidth} onChange={e=>setPaletteWidth(Number(e.target.value))}/></label><label>Inspector size<input aria-label="Inspector size" type="range" min="210" max="360" value={inspectorWidth} onChange={e=>setInspectorWidth(Number(e.target.value))}/></label><label>Reset data memory<select aria-label="Reset data memory" value={resetPolicy} onChange={e=>setResetPolicy(e.target.value)}><option value="clear">Clear data</option><option value="preserve">Preserve separate data memory</option></select></label></div>
        {templatePicker && <div className="cpu-template-picker">{CPU_TEMPLATES.map(t => <button key={t.id} onClick={() => { replaceProject(arrangeDesign(t.build())); setTemplatePicker(false); }}><strong>{t.title}</strong><small>{t.description}</small></button>)}</div>}
        <div className="cpu-mode-bar"><div><button className={workspaceMode === "designer" ? "active" : ""} onClick={() => setWorkspaceMode("designer")}>▦ CPU Designer</button><button className={workspaceMode === "blocks" ? "active" : ""} onClick={() => setWorkspaceMode("blocks")}>◈ Blocks</button></div><span>Design. Connect. Experiment. Learn.</span></div>
        <div hidden={workspaceMode !== "blocks"}><BlockProgram key={JSON.stringify(design.isa) + design.program} isa={design.isa} program={design.program} onApply={(program) => { const loaded = loadProgram({ ...design, program, engineering:{...engineeringOf(design),files:[{id:"main",name:"main.asm",source:program}],activeFile:"main"} }); commit(loaded.design); setError(loaded.error); setSavedMsg(loaded.error ? "Fix the program before running." : "Blocks assembled and loaded. Use Step or Run to execute."); }} /></div><div className="builder" style={{...(workspaceMode==="blocks"?{display:"none"}:{}),"--ws-palette":`${paletteWidth}px`,"--ws-inspector":`${inspectorWidth}px`} as React.CSSProperties}>
          <aside className="card palette">
            <h3>▣ Component Palette</h3>
            <select aria-label="Palette filter" value={paletteFilter} onChange={e=>setPaletteFilter(e.target.value)}><option>All</option><option>Favorites</option><option>Recent</option></select>
            <input className="input" aria-label="Search components" placeholder="⌕ Search components..." value={search} onChange={e => setSearch(e.target.value)} />
            {!PALETTE.some(matchesPart)&&<Status>No matching parts. Clear the search or choose All. Set favorites in Component Library; insert a part to populate Recent.</Status>}
            {groupPalette().map((group) => (
              <div key={group.group}>
                <div className="tiny">{group.group}</div>
                <div className="palette-grid">
                  {group.items.filter(matchesPart).map((item) => (
                    <button key={item.kind} type="button" className={`palette-item kind-${item.kind}`} title={`${componentContract(item.kind).behavior} ${componentContract(item.kind).timing}. Widths: ${componentContract(item.kind).widths.join(", ")}. Ports: ${palettePorts[item.kind]}`} onClick={() => addPart(item.kind)} draggable onDragStart={(event) => event.dataTransfer.setData("kind", item.kind)} aria-label={`Add ${item.label}`}>
                      <ComponentIcon kind={item.kind}/>{item.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </aside>
          <div className="cpu-canvas-panel"><div className="cpu-canvas-header"><input aria-label="Design name" value={design.name} onChange={e => commit({ ...design, name: e.target.value })} /><Button onClick={() => setDesign(arrangeDesign(design))}>♧ Auto Arrange</Button></div><ArchCanvas
            design={design}
            viewBox="0 0 1100 700"
            selected={selected}
            overlay={design.overlay}
            onSelect={(ids, additive) => setSelected(additive ? [...new Set([...selected, ...ids])] : ids)}
            onMove={(id, x, y) => commit(applyMove(design, id, x, y))}
            onConnect={(from, port, to, toPort) => {
              const linked = applyConnect(design, from, port, to, toPort);
              if (linked.error) setError(linked.error);
              else commit(linked.design);
            }}
            onDeleteWire={(id) => commit(applyDeleteWire(design, id))}
            onSelectWire={setSelectedWire} selectedWire={selectedWire} bends={bends} onBend={(id,x)=>{setBends(v=>({...v,[id]:x}));setDesign({...design,engineering:{...engineeringOf(design),routeBends:{...engineeringOf(design).routeBends,[id]:x}}});}}
            onDropKind={(kind: NodeKind, x, y) => commit(applyDrop(design, kind, x, y))}
            onPan={(pan) => setDesign({ ...design, pan })}
          />
          <svg className="ws-minimap" viewBox="0 0 800 700" role="group" aria-label="Design minimap">{design.nodes.map(n=><rect role="button" tabIndex={0} aria-label={`Locate ${n.name}`} key={n.id} x={n.x*800/Math.max(800,...design.nodes.map(v=>v.x+148))} y={n.y*700/Math.max(700,...design.nodes.map(v=>v.y+320))} width="55" height="45" fill={selected.includes(n.id)?"#ec4899":"#3065c7"} onClick={()=>locate(n.id)} onKeyDown={e=>{if(e.key==="Enter")locate(n.id);}}/>)}</svg>
          <div className="cpu-canvas-hint">↖ Drag components from the palette to start building · Alt + drag to pan</div></div>
          <div className="cpu-inspector-column"><aside className="card cpu-inspector">
            <h3>⚙ Inspector</h3>
            {selectedWire&&<div><h4>Selected wire</h4><p className="tiny">{signalsOf(design).find(w=>w.id===selectedWire)?.label}</p><label>Bend X<input aria-label="Wire bend X" type="number" value={bends[selectedWire]??400} onChange={e=>{const x=Number(e.target.value);setBends({...bends,[selectedWire]:x});setDesign({...design,engineering:{...engineeringOf(design),routeBends:{...engineeringOf(design).routeBends,[selectedWire]:x}}});}}/></label><Button onClick={()=>{commit(applyDeleteWire(design,selectedWire));setSelectedWire("");}}>Delete Selected Wire</Button></div>}
            {selectedNode ? (
              <div className="stack">
                <label>Name<input className="input" value={selectedNode.name} onChange={(event) => commit(applyPatch(design, selectedNode.id, { name: event.target.value }))} /></label>
                <label>Width
                  <select className="input" value={selectedNode.width} onChange={(event) => commit(applyPatch(design, selectedNode.id, { width: Number(event.target.value) as (typeof WIDTHS)[number] }))}>
                    {componentContract(selectedNode.kind).widths.map((width) => <option key={width} value={width}>{width}-bit</option>)}
                  </select>
                </label>
                {(componentContract(selectedNode.kind).storage&&selectedNode.kind!=="regfile"||["const","clock"].includes(selectedNode.kind))&&<label>{selectedNode.kind==="flags"?"Packed flags (Z/N/C/V bits 0–3)":"Current stored / configured value"}<input className="input" type="number" step={1} value={selectedNode.value} onChange={(event) => {const value=parseNumberInput(event.target.value,selectedNode.value);if(!Number.isSafeInteger(value)){setError("Enter a safe integer.");return;}commit(applyPatch(design,selectedNode.id,{value:Number(BigInt.asUintN(selectedNode.kind==="flags"?4:selectedNode.width,BigInt(value)))}));}}/></label>}
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
          <section className="card cpu-mini-guide"><h3>▤ Studio Guide</h3><p><b>1</b> Drag components from the palette.</p><p><b>2</b> Wire ports of matching width.</p><p><b>3</b> Assemble, load, and step through execution.</p></section>
          <section className="card cpu-mini-guide"><h3>♧ Key Takeaways</h3><p>✓ The canvas is a live datapath.</p><p>✓ Clocked registers update on clock step.</p><p>✓ Experiment with your custom ISA.</p></section></div>
        </div>
        <div className="grid cards-3">
          <WorkspaceTools design={design} commit={commit} replace={replaceProject} onLocate={locate} trace={trace} wave={wave} onCondition={setCondition} onMessage={setSavedMsg}/>
          {history.at(-1)?.design&&<Card title="Last Step Changes"><table className="ce-table"><thead><tr><th>Component</th><th>State</th><th>Before</th><th>After</th></tr></thead><tbody>{stateChanges(history.at(-1)!.design!,design).map((c,i)=><tr className="ws-state-changed" key={i}><td>{c.component}</td><td>{c.field}</td><td>{c.before}</td><td>{c.after}</td></tr>)}</tbody></table><p>Reverse Step restores the full recorded state. Last {history.length}/{HISTORY} steps retained.</p></Card>}
          {trace&&<details><summary>Linked execution trace · {history.length} prior states</summary><table className="ce-table"><thead><tr><th>Cycle</th><th>PC</th><th>Source / word</th><th>Operation</th><th>Reason</th></tr></thead><tbody>{[...history.map(h=>h.trace),trace].filter((t):t is ExecTrace=>!!t).map((t,i)=>{const asm=assemble(design.isa,design.program);const line=asm.ok?asm.listing.find(l=>l.address===t.pc):null;return <tr key={i}><td>{t.cycle}</td><td>{t.pc}</td><td>{line?.text??"No source mapping"} · 0x{t.ir.toString(16)}</td><td><button onClick={()=>{const n=design.nodes.find(n=>n.kind==="alu");if(n)locate(n.id);}}>{t.mnemonic} · {t.controls.ALUOp}</button></td><td>{t.reason}</td></tr>;})}</tbody></table><Btn onClick={()=>downloadText("execution-history.json",JSON.stringify({engine:"aimer-cpu-contest-2",history,current:design,trace,condition},null,2),"application/json")}>Export Full Debug History</Btn></details>}
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

  function loadCurrent() {
    const loaded = loadProgram(design); commit(loaded.design); setError(loaded.error); setSavedMsg(loaded.error ? "Assembly failed." : "Program assembled and loaded into instruction memory.");
  }
  function startRun(next:boolean){if(next&&(conflict||design.nodes.length>128||design.wires.length>512)){setError(conflict?"Resolve the tab conflict before running.":"Run supports up to 128 components and 512 wires; reduce the graph for responsive execution.");setRunning(false);return;}setRunning(next);}
  function resetCurrent() { const next=resetCpu(design);if(resetPolicy==="preserve")next.nodes=next.nodes.map(n=>n.kind==="dmem"?{...n,mem:design.nodes.find(v=>v.id===n.id)!.mem.slice()}:n);setDesign(next); setRunning(false); setTrace(null); setHistory([]); setWave([]); setClock(0); setError(null); }
  async function openLocal() { try { setLocalProjects(await listRecords("builder")); } catch { setError("Local storage is unavailable. Import a .cpu.json file instead."); } }
  return <StudioFrame lab={lab} focus={focus&&lab==="builder"} status={`${design.name} · ${storageStatus} · ${running ? "Running" : "Paused"}`}>
    {conflict&&<section className="ce-panel" role="alert"><h3>Project edited in another tab</h3><p>Editing is paused. Both copies are saved as milestones when you resolve this conflict.</p><Btn onClick={()=>{resolveCpuConflict("incoming");resetCurrentSession();}}>Use Incoming Copy</Btn><Btn onClick={()=>resolveCpuConflict("current")}>Keep This Copy</Btn><Btn onClick={()=>downloadText("incoming-tab-copy.cpu.json",designJson(conflict),"application/json")}>Export Incoming Copy</Btn><Btn onClick={download}>Export This Copy</Btn></section>}
    {commands&&<section className="ws-command" role="dialog" aria-label="Command palette" aria-modal="true" onKeyDown={e=>{if(e.key!=="Tab")return;const items=Array.from(e.currentTarget.querySelectorAll<HTMLElement>("input,button"));const first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}}><strong>Commands · Escape closes</strong><input autoFocus aria-label="Search commands" value={commandQuery} onChange={e=>setCommandQuery(e.target.value)} placeholder="Search actions or components"/>{[{name:"Focus canvas",run:()=>setFocus(!focus)},{name:"Fit design",run:()=>setDesign(fitDesign(design))},{name:"Step instruction",run:doStepInstruction},{name:"Reverse step",run:reverseStep},{name:"Reset CPU",run:resetCurrent},{name:"Export project",run:download},{name:"Validate design",run:()=>navigate("/architecture/builder/validate")},{name:"Contest evidence",run:()=>navigate("/architecture/builder/contest")},...PALETTE.map(p=>({name:`Add ${p.label}`,run:()=>addPart(p.kind)}))].filter(c=>c.name.toLowerCase().includes(commandQuery.toLowerCase())).map(c=><Btn key={c.name} onClick={()=>{c.run();setCommands(false);}}>{c.name}</Btn>)}<Btn onClick={()=>setCommands(false)}>Close Commands</Btn></section>}
    {lab !== "builder" && lab !== "overview" && <details className="ce-project-menu"><summary>Project ▾</summary><div className="ce-project-toolbar"><Btn onClick={() => {replaceProject(ensureProject(emptyDesign()));}}>＋ New</Btn><Btn onClick={() => void openLocal()}>▣ Open Local</Btn><Btn onClick={() => void persist().catch(() => setError("Save failed. Export a file to preserve the project."))}>▣ Save Project</Btn><Btn onClick={() => {const name = window.prompt("Save project as", `${design.name} Copy`);if(name){const next={...design,name};commit(next);void saveRecord({id:`builder-${name}`,kind:"builder",name,data:designJson(next),updated:Date.now()}).then(()=>setSavedMsg("Saved a named project copy.")).catch(()=>setError("Save As failed."));}}}>Save As</Btn><Btn onClick={download}>⇩ Export Project</Btn><label className="ce-btn">⇧ Import<input type="file" accept=".json,.cpu.json" hidden onChange={e=>{const file=e.target.files?.[0];if(file)openFile(file);}}/></label><Btn disabled={!past.length} onClick={undo}>↶ Undo</Btn><Btn disabled={!future.length} onClick={redo}>↷ Redo</Btn></div></details>}
    {localProjects && <section className="ce-panel"><div className="ce-panel-heading"><h3>Open Local Project</h3><Btn onClick={()=>setLocalProjects(null)}>Close</Btn></div>{localProjects.map(project=><Btn key={project.id} onClick={()=>{const parsed=parseDesignJson(project.data);if(parsed.ok){replaceProject(parsed.design);setLocalProjects(null);}else setError(parsed.error);}}>{project.name}</Btn>)}{!localProjects.length&&<Status>No saved CPU projects yet.</Status>}</section>}
    {lab === "builder" ? canvasBlock() : <EngineeringLabs key={`${lab}-${projectEpoch}`} lab={lab} design={design} commit={commit} onReplaceProject={replaceProject} selected={selected} onSelect={setSelected} trace={trace} history={history} wave={wave} running={running} onRun={startRun} onStep={doStepInstruction} onClock={() => {const result=stepMicroCycle(design,(trace?.cycle??0)+1);record(result.design,result.trace);}} onReset={resetCurrent} onLoad={loadCurrent} onMessage={setSavedMsg} onNavigate={next => navigate(`/architecture/builder/${next}`)}/>}
    {lab !== "builder" && error && <Status tone="error">{error}</Status>}
    {lab !== "builder" && savedMsg && <Status>{savedMsg}</Status>}
  </StudioFrame>;
  function resetCurrentSession() {setProjectEpoch(n=>n+1);setRunning(false);setTrace(null);setHistory([]);setWave([]);setClock(0);setSelected([]);setSelectedWire("");setBends({});setCondition("");setError(null);}
}
export default BuilderStudio;
