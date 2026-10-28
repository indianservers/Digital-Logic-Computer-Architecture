import { useSimulatorCapture } from "../../layout/SimulatorCapture";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button, Card, parseNumberInput } from "../../design-system/ui";
import { PALETTE, GATE_PALETTE, addNode, portsOf, emptyDesign, type CpuDesign, type NodeKind } from "../../engines/builder/model";
import { HISTORY, designJson, evaluateGraph, hitBreakpoint, loadProgram, parseDesignJson, resetCpu, sampleWave, stepMicroCycle, stepInstruction, stepClock, type ExecTrace, type SimSnap, type WaveSample } from "../../engines/builder/sim";
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
import { ConstructionWorkbench } from "./ConstructionWorkbench";
import { CanvasTools, usePreference } from "./CanvasTools";
import { editDescription, reconnectWire } from "../../engines/builder/canvasUx";
import { resetCircuit } from "../../engines/builder/constructionTools";

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
  const all=[...PALETTE,...GATE_PALETTE.filter(g=>!PALETTE.some(p=>p.kind===g.kind))];
  const groups = [...new Set(all.map((item) => item.group))];
  return groups.map((group) => ({ group, items: all.filter((item) => item.group === group) }));
}

export function BuilderStudio() {
  useSimulatorCapture("studios/builder/BuilderStudio.tsx:BuilderStudio", () => ({ localProjects, design, storageStatus, conflict, projectEpoch, past, future, selected, error, trace, history, cursor, wave, running, speed, clock, savedMsg, workspaceMode, search, templatePicker, focus, panels, compact, commands, commandQuery, selectedWire, bends, condition, conditionRef: conditionRef.current, recent, paletteFilter, resetPolicy, paletteWidth, inspectorWidth, mode, quietLabels, traceSelection, paletteCollapsed, inspectorCollapsed, context, attention, arrangement, blockEditor, canvasPanelRef: canvasPanelRef.current, canvasFullscreen, issues, view, palettePorts, designRef: designRef.current, traceRef: traceRef.current }), "5ea3c0a40be1");

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
  const [panels,setPanels]=usePreference("panels",true);
  const [compact,setCompact]=usePreference("compact",false);
  const [commands,setCommands]=useState(false);
  const [commandQuery,setCommandQuery]=useState("");
  const [selectedWire,setSelectedWire]=useState("");
  const [bends,setBends]=useState<Record<string,number>>({});
  const [condition,setCondition]=useState("");
  const conditionRef=useRef(condition);conditionRef.current=condition;
  const [recent,setRecent]=useState<NodeKind[]>([]);
  const [paletteFilter,setPaletteFilter]=useState("All");
  const [resetPolicy,setResetPolicy]=useState("clear");
  const [paletteWidth,setPaletteWidth]=usePreference("palette-width",245);
  const [inspectorWidth,setInspectorWidth]=usePreference("inspector-width",265);
  const [mode,setMode]=useState<"select"|"pan"|"wire">("select");
  const [quietLabels,setQuietLabels]=usePreference("quiet-labels",true);
  const [traceSelection,setTraceSelection]=useState(false);
  const [paletteCollapsed,setPaletteCollapsed]=usePreference("palette-collapsed",false);
  const [inspectorCollapsed,setInspectorCollapsed]=usePreference("inspector-collapsed",false);
  const [context,setContext]=useState<{id:string;x:number;y:number}|null>(null);
  const [attention,setAttention]=useState<{node:string;port:string;message:string}|null>(null);
  const [arrangement,setArrangement]=useState<CpuDesign|null>(null);
  const [blockEditor,setBlockEditor]=useState("");
  const canvasPanelRef=useRef<HTMLDivElement>(null);
  const [canvasFullscreen,setCanvasFullscreen]=useState(false);
  useEffect(()=>{const update=()=>setCanvasFullscreen(!!canvasPanelRef.current&&document.fullscreenElement===canvasPanelRef.current);const onKey=(event:KeyboardEvent)=>{if(event.key==="Escape"&&canvasPanelRef.current&&document.fullscreenElement===canvasPanelRef.current)void document.exitFullscreen();};document.addEventListener("fullscreenchange",update);document.addEventListener("keydown",onKey);return()=>{document.removeEventListener("fullscreenchange",update);document.removeEventListener("keydown",onKey);};},[]);
  async function toggleCanvasFullscreen(){
    try{if(document.fullscreenElement===canvasPanelRef.current)await document.exitFullscreen();else if(canvasPanelRef.current?.requestFullscreen)await canvasPanelRef.current.requestFullscreen();else setError("Canvas fullscreen is unavailable in this browser.");}
    catch{setError("The browser could not open canvas fullscreen. Try the Full Screen button again, or use Focus Canvas.");}
  }

  const issues = useMemo(() => validateDesign(design), [design]);
  const view = useMemo(() => evaluateGraph(design), [design]);
  const selectedNode = design.nodes.find((node) => node.id === selected[0]);
  const shown = cursor >= 0 ? history[cursor]?.trace ?? trace : trace;
  const palettePorts=useMemo(()=>Object.fromEntries(groupPalette().flatMap(g=>g.items).map(item=>{const contract=componentContract(item.kind);const width=contract.widths.includes(design.isa.dataWidth)?design.isa.dataWidth:contract.widths[0]!;const node=addNode(emptyDesign(),item.kind,0,0,width).nodes[0]!;return [item.kind,portsOf({...node,inputWidth:["cu","decoder"].includes(item.kind)?design.isa.dataWidth:node.inputWidth}).map(p=>`${p.dir} ${p.name}:${p.width}b ${p.role}`).join("; ")];})),[design.isa.dataWidth]);
  function matchesPart(item:(typeof PALETTE)[number]){const alias=["pc","acc","gpr","regfile","ir","mar","mdr","sp"].includes(item.kind)?"stores value storage register":item.kind==="mux"?"select input selector":"";return (paletteFilter==="All"||paletteFilter==="Recent"&&recent.includes(item.kind)||paletteFilter==="Favorites"&&engineeringOf(design).favorites.includes(item.kind))&&`${item.label} ${componentContract(item.kind).behavior} ${item.group} ${alias}`.toLowerCase().includes(search.toLowerCase());}

  function commit(next: CpuDesign) {
    setArrangement(null);
    setRunning(false);
    setPast((items) => [...items, design].slice(-40));
    setFuture([]);
    setDesign(next);
    setError(null);
    setTrace(null);setHistory([]);setWave([]);setClock(0);
  }

  useEffect(()=>{
    const palette=document.querySelector<HTMLElement>(".cpu-workspace .palette"),inspector=document.querySelector<HTMLElement>(".cpu-workspace .cpu-inspector");
    const observer=new ResizeObserver(entries=>{for(const entry of entries){const el=entry.target as HTMLElement;if(!el.style.width)continue;const width=Math.round(el.getBoundingClientRect().width);if(el===palette&&width>=160&&width<=420)setPaletteWidth(width);if(el===inspector&&width>=180&&width<=450)setInspectorWidth(width);}});
    if(palette)observer.observe(palette);if(inspector)observer.observe(inspector);return()=>observer.disconnect();
  },[lab,paletteCollapsed,inspectorCollapsed,workspaceMode]);
  function replaceProject(next:CpuDesign){try{saveVersion(design,`Before replacement · ${design.name}`);}catch{setError("Recovery snapshot failed. Export your project before replacing it.");return;}commit(next);resetCurrentSession();}
  function addPart(kind:NodeKind){setRecent(items=>[kind,...items.filter(k=>k!==kind)].slice(0,6));const contract=componentContract(kind);const width=contract.widths.includes(design.isa.dataWidth)?design.isa.dataWidth:contract.widths[0]!;let next=applyDrop(design,kind,(220-design.pan.x)/design.pan.k+(design.nodes.length%3)*32,(160-design.pan.y)/design.pan.k+(design.nodes.length%3)*32);next=applyPatch(next,next.nodes.at(-1)!.id,{width,inputWidth:["cu","decoder"].includes(kind)?design.isa.dataWidth:Math.min(8,width) as 1|4|8|16|32});commit(next);setSelected([next.nodes.at(-1)!.id]);}
  function locate(id:string){const n=design.nodes.find(n=>n.id===id);if(!n)return;setSelected([id]);setDesign({...design,pan:{x:250-n.x,y:100-n.y,k:1}});}
  function zoomCanvas(target: number) {
    const k = Math.min(2, Math.max(.1, Math.round(target * 100) / 100));
    const ratio = k / design.pan.k;
    setDesign({...design, pan:{x:550-(550-design.pan.x)*ratio, y:350-(350-design.pan.y)*ratio, k}});
  }
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
    setWave((items) => [...items, sampleWave(next, nextTrace.cycle, engineeringOf(next).construction?.execution==="circuit"?1:clock, evaluateGraph(next))].slice(-HISTORY));
    if(nextTrace.mnemonic==="FAULT"){setError(nextTrace.reason);const affected=next.nodes.find(n=>nextTrace.reason.includes(`${n.name}.`)||nextTrace.reason.includes(`${n.name}:`));if(affected)setSelected([affected.id]);}
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
    } else if(engineeringOf(design).construction?.execution==="circuit")setDesign(stepClock(design,0,1));
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
        else if(stepped.trace.mnemonic==="FAULT")setError(stepped.trace.reason);
      }
    }, ms);
    return () => window.clearInterval(id);
  }, [running, speed]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if((event.target as HTMLElement).closest('[role="dialog"]'))return;
      if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="k"){event.preventDefault();setCommands(v=>!v);return;}
      if(event.key==="Escape"){setCommands(false);setContext(null);return;}
      if ((event.target as HTMLElement).closest("input,textarea,select,[contenteditable=true]")) return;
      if(!event.ctrlKey&&!event.metaKey&&["v","h","w"].includes(event.key.toLowerCase())){setMode(({v:"select",h:"pan",w:"wire"} as const)[event.key.toLowerCase() as "v"|"h"|"w"]);return;}
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

  function selectionAction(name:string){
    if(name.startsWith("Issue:")){const issue=issues[Number(name.slice(6))];if(!issue)return;const wire=design.wires.find(w=>w.id===issue.wireId);const node=issue.nodeId??wire?.to;if(node){locate(node);const port=wire?.toPort??(/clock/i.test(issue.message)?"clk":/data input/i.test(issue.message)?"d":/write-enable/i.test(issue.message)?"we":/select control/i.test(issue.message)?"s":"");setAttention({node,port,message:issue.message});}setSelectedWire(issue.wireId??"");return;}
    if(name.startsWith("Wire:")){setSelectedWire(name.slice(5));return;}
    if(name==="Fit"){setDesign(fitDesign(design));return;}
    if(name==="Delete wire"){if(selectedWire)commit(applyDeleteWire(design,selectedWire));setSelectedWire("");return;}
    if(!selected.length)return;
    if(name==="Edit"){const open=()=>setBlockEditor(selected[0]!);if(document.fullscreenElement===canvasPanelRef.current)void document.exitFullscreen().then(open);else open();}
    if(name==="Duplicate")commit(applyDuplicate(design,selected));
    if(name==="Delete"){commit(applyDelete(design,selected));setSelected([]);}
    if(name==="Rotate")commit({...design,nodes:design.nodes.map(n=>selected.includes(n.id)?{...n,rotation:((n.rotation??0)+90)%360 as 0|90|180|270}:n)});
    if(name==="Probe")commit({...design,probes:design.probes.includes(selected[0]!)?design.probes.filter(id=>!selected.includes(id)):[...new Set([...design.probes,...selected])]});
  }
  function toolbox() {
    return <div className="cpu-toolbar" role="toolbar" aria-label="CPU builder">
      <details className="ux-command-group"><summary>File</summary><div className="ux-command-menu" onClick={e=>{if((e.target as HTMLElement).closest("md-outlined-button")){const details=e.currentTarget.closest("details");if(details)details.open=false;}}}>
        <Button onClick={()=>{const next=emptyDesign("Untitled CPU");replaceProject({...next,program:"",engineering:{...engineeringOf(next),construction:{execution:"circuit"}}});}}>New Scratch CPU</Button>
        <Button onClick={()=>setTemplatePicker(!templatePicker)}>Open Template</Button>
        <Button onClick={()=>void persist().catch(()=>setError("Local save failed. Export your project."))}>Save locally</Button>
        <Button onClick={()=>void openLocal()}>Open Local</Button><Button onClick={download}>Export</Button>
        <label className="btn-ghost">Import<input type="file" accept=".json,.cpu.json,application/json" hidden onChange={e=>{const file=e.target.files?.[0];if(file)openFile(file);}}/></label>
      </div></details>
      <span className="ux-group-label">Edit</span>
      <Button onClick={undo} disabled={!past.length} title={past.length?`Undo ${editDescription(past.at(-1)!,design)}`:"Undo"} aria-label={past.length?`Undo ${editDescription(past.at(-1)!,design)}`:"Undo"}>Undo</Button>
      <Button onClick={redo} disabled={!future.length} title={future.length?`Redo ${editDescription(design,future[0]!)}`:"Redo"} aria-label={future.length?`Redo ${editDescription(design,future[0]!)}`:"Redo"}>Redo</Button>
      <Button onClick={()=>{const issue=issues[0];if(issue?.nodeId)locate(issue.nodeId);setSelectedWire(issue?.wireId??"");setSavedMsg(issues.length?issues.map(i=>i.message).join(" • "):"Design validated.");}}>Validate · {issues.length}</Button>
      <span className="ux-group-label">Simulate</span>
      <Button variant="primary" onClick={()=>{const loaded=loadProgram(design);commit(loaded.design);setError(loaded.error);}}>Assemble</Button>
      <Button onClick={doStepClock}>Clock</Button><Button onClick={doStepInstruction}>Step</Button>
      <Button onClick={reverseStep} disabled={!history.at(-1)?.design}>Reverse</Button>
      <Button onClick={()=>startRun(!running)}>{running?"Pause":"Run"}</Button><Button onClick={resetCurrent}>Reset</Button>
      <select aria-label="Simulation speed" value={speed} onChange={e=>setSpeed(e.target.value as typeof speed)}>{SPEEDS.map(s=><option key={s}>{s}</option>)}</select>
    </div>;
  }
  function canvasBlock() {
    return (
      <div className={`cpu-workspace ${panels?"":"ws-panel-hidden"} ${compact?"ws-compact":""}`}>
        {toolbox()}
        {error&&<div role="alert"><Status tone="error">{error}</Status></div>}
        <div className="ws-builder-controls"><Btn onClick={()=>setFocus(!focus)}>{focus?"Exit Focus":"Focus Canvas · F6"}</Btn><Btn onClick={()=>setPanels(!panels)}>{panels?"Hide Panels":"Show Panels"}</Btn><Btn onClick={()=>setCompact(!compact)}>{compact?"Illustrated Palette":"Compact Palette"}</Btn><Btn onClick={()=>setCommands(true)}>Commands · Ctrl K</Btn><Btn onClick={()=>{const tools=document.getElementById("cpu-construction-tools") as HTMLDetailsElement|null;if(tools){tools.open=true;tools.scrollIntoView({behavior:"smooth"});}}}>Construction Tools</Btn><details className="cpu-workspace-settings"><summary>Workspace settings</summary><div className="cpu-settings-content"><label>Palette size<input type="range" min="160" max="420" value={paletteWidth} onChange={e=>setPaletteWidth(Number(e.target.value))}/></label><label>Inspector size<input type="range" min="180" max="450" value={inspectorWidth} onChange={e=>setInspectorWidth(Number(e.target.value))}/></label><label>Reset data memory<select value={resetPolicy} onChange={e=>setResetPolicy(e.target.value)}><option value="clear">Clear data</option><option value="preserve">Preserve data</option></select></label></div></details></div>
        {templatePicker&&<div className="cpu-template-picker">{CPU_TEMPLATES.map(template=><button key={template.id} onClick={()=>{replaceProject(template.build());setTemplatePicker(false);}}><strong>{template.title}</strong><small>{template.description}</small></button>)}</div>}
        <div className="cpu-mode-bar"><div><button aria-pressed={workspaceMode==="designer"} className={workspaceMode==="designer"?"active":""} onClick={()=>setWorkspaceMode("designer")}>▦ CPU Designer</button><button aria-pressed={workspaceMode==="blocks"} className={workspaceMode==="blocks"?"active":""} onClick={()=>setWorkspaceMode("blocks")}>◈ Blocks</button></div><span>Design. Connect. Experiment. Learn.</span></div>
        <div hidden={workspaceMode !== "blocks"}><BlockProgram key={JSON.stringify(design.isa) + design.program} isa={design.isa} program={design.program} onApply={(program) => { const loaded = loadProgram({ ...design, program, engineering:{...engineeringOf(design),files:[{id:"main",name:"main.asm",source:program}],activeFile:"main"} }); commit(loaded.design); setError(loaded.error); setSavedMsg(loaded.error ? "Fix the program before running." : "Blocks assembled and loaded. Use Step or Run to execute."); }} /></div><div className="builder" style={{...(workspaceMode==="blocks"?{display:"none"}:{}),"--ws-palette":`${paletteCollapsed?48:paletteWidth}px`,"--ws-inspector":`${inspectorCollapsed?48:inspectorWidth}px`} as React.CSSProperties}>
          <aside className="card palette" style={paletteCollapsed?{minWidth:0,resize:"none",width:48}:{width:paletteWidth}}><button className="ux-sidebar-toggle" aria-expanded={!paletteCollapsed} onClick={()=>setPaletteCollapsed(!paletteCollapsed)}>{paletteCollapsed?"＋":"Parts ‹"}</button>{!paletteCollapsed&&<>
            <h3>▣ Component Palette</h3>
            <select aria-label="Palette filter" value={paletteFilter} onChange={e=>setPaletteFilter(e.target.value)}><option>All</option><option>Favorites</option><option>Recent</option></select>
            <input className="input" aria-label="Search components" placeholder="⌕ Search components..." value={search} onChange={e => setSearch(e.target.value)} />
            {!groupPalette().some(g=>g.items.some(matchesPart))&&<Status>No matching parts. Clear the search or choose All. Set favorites in Component Library; insert a part to populate Recent.</Status>}
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
          </>}</aside>
          <div ref={canvasPanelRef} className="cpu-canvas-panel"><div className="cpu-canvas-header"><input aria-label="Design name" value={design.name} onChange={e => commit({ ...design, name: e.target.value })} /><select aria-label="Execution engine" value={engineeringOf(design).construction?.execution??"legacy"} onChange={e=>commit({...design,engineering:{...engineeringOf(design),construction:{...engineeringOf(design).construction,execution:e.target.value as "circuit"|"legacy"}}})}><option value="circuit">Circuit · every clock edge</option><option value="legacy">Instruction CPU model</option></select><Button onClick={() => {setRunning(false);setArrangement(arrangeDesign(design));}}>Preview Auto Arrange</Button></div>
          <div className="cpu-pane-zoom" role="group" aria-label="Canvas zoom controls">
            <select aria-label="Canvas interaction mode" value={mode} onChange={e=>setMode(e.target.value as typeof mode)}><option value="select">Select · V</option><option value="pan">Pan · H</option><option value="wire">Wire · W</option></select>
            <label className="ux-check"><input type="checkbox" checked={quietLabels} onChange={e=>setQuietLabels(e.target.checked)}/>Quiet labels</label>
            <label className="ux-check"><input type="checkbox" checked={traceSelection} onChange={e=>setTraceSelection(e.target.checked)}/>Trace selection</label>
            <Button aria-label="Zoom out canvas" disabled={design.pan.k <= .1} onClick={() => zoomCanvas(design.pan.k - .15)}>− Zoom Out</Button>
            <output aria-label="Canvas zoom level">{Math.round(design.pan.k * 100)}%</output>
            <Button aria-label="Zoom in canvas" disabled={design.pan.k >= 2} onClick={() => zoomCanvas(design.pan.k + .15)}>+ Zoom In</Button>
            <Button onClick={() => zoomCanvas(1)}>Reset 100%</Button>
            <Button onClick={() => setDesign(fitDesign(design))}>Fit Canvas</Button>
            <Button disabled={!selected.length} onClick={() => locate(selected[0]!)}>Zoom Selection</Button>
            <Button aria-label={canvasFullscreen?"Exit canvas fullscreen":"Enter canvas fullscreen"} aria-pressed={canvasFullscreen} onClick={()=>void toggleCanvasFullscreen()}>{canvasFullscreen?"⛶ Exit Full Screen · Esc":"⛶ Full Screen"}</Button>
            {canvasFullscreen&&<><Button onClick={undo} disabled={!past.length} title={past.length?`Undo ${editDescription(past.at(-1)!,design)}`:"Undo"}>Undo</Button><Button onClick={redo} disabled={!future.length}>Redo</Button><Button onClick={doStepInstruction}>Step</Button><Button onClick={()=>startRun(!running)}>{running?"Pause":"Run"}</Button><Button onClick={resetCurrent}>Reset CPU</Button></>}
          </div><CanvasTools design={design} previous={history.at(-1)?.design} trace={trace} running={running} error={error} storage={storageStatus} selected={selected} selectedWire={selectedWire} panel={canvasPanelRef} fullscreen={canvasFullscreen} locate={locate} add={addPart} patch={(id,patch)=>commit(applyPatch(design,id,patch))} action={selectionAction} context={context} closeContext={()=>setContext(null)} setView={pan=>setDesign({...design,pan})} preview={!!arrangement} acceptArrange={()=>{if(arrangement)commit(arrangement);}} cancelArrange={()=>setArrangement(null)}/>
          {design.nodes.some(n=>n.behavior?.device)&&<div className="ux-device-bar">{design.nodes.filter(n=>n.behavior?.device).map(n=><label key={n.id}>{n.name} {n.behavior?.device==="switch"?<input aria-label={`${n.name} switch value`} type="number" value={n.value} onChange={e=>{const value=Number(e.target.value);if(Number.isSafeInteger(value))commit(applyPatch(design,n.id,{value:value>>>0}));}}/>:n.behavior?.device==="terminal"?<pre>{n.behavior.text||"Ready"}</pre>:<span>{n.behavior?.registers?.ticks??0} ticks</span>}</label>)}</div>}
          <ArchCanvas
            design={arrangement??design}
            attention={attention} mode={mode} quietLabels={quietLabels} traceSelection={traceSelection} previous={history.at(-1)?.design}
            onContext={(id,x,y)=>setContext({id,x,y})}
            onReconnect={(id,from,fp,to,tp)=>{const result=reconnectWire(design,id,from,fp,to,tp);if(result.error)setError(result.error);else commit(result.design);}}
            viewBox="0 0 1100 700"
            selected={selected}
            onOpenNode={id=>{if(document.fullscreenElement===canvasPanelRef.current)void document.exitFullscreen().then(()=>setBlockEditor(id));else setBlockEditor(id);}}
            overlay={design.overlay}
            onSelect={(ids, additive) => {setAttention(null);setSelectedWire("");setContext(null);setSelected(additive ? [...new Set([...selected, ...ids])] : ids);}}
            onMove={(id, x, y, movePan) => {const original=design.nodes.find(n=>n.id===id);if(!original)return;let next=applyMove(design,id,x,y);if(selected.includes(id))for(const n of design.nodes.filter(n=>n.id!==id&&selected.includes(n.id)))next=applyMove(next,n.id,n.x+x-original.x,n.y+y-original.y);commit({...next,pan:movePan??next.pan});}}
            onConnect={(from, port, to, toPort) => {
              const linked = applyConnect(design, from, port, to, toPort);
              if (linked.error) setError(linked.error);
              else commit(linked.design);
            }}
            onDeleteWire={(id) => commit(applyDeleteWire(design, id))}
            onSelectWire={id=>{setSelected([]);setSelectedWire(id);}} selectedWire={selectedWire} bends={bends} onBend={(id,x)=>{setBends(v=>({...v,[id]:x}));setDesign({...design,engineering:{...engineeringOf(design),routeBends:{...engineeringOf(design).routeBends,[id]:x}}});}}
            onDropKind={(kind: NodeKind, x, y) => commit(applyDrop(design, kind, x, y))}
            onPan={(pan) => setDesign({ ...design, pan })}
          />
          <svg className="ws-minimap" viewBox="0 0 800 700" role="group" aria-label="Design minimap">{design.nodes.map(n=><rect role="button" tabIndex={0} aria-label={`Locate ${n.name}`} key={n.id} x={n.x*800/Math.max(800,...design.nodes.map(v=>v.x+148))} y={n.y*700/Math.max(700,...design.nodes.map(v=>v.y+320))} width="55" height="45" fill={selected.includes(n.id)?"#ec4899":"#3065c7"} onClick={()=>locate(n.id)} onKeyDown={e=>{if(e.key==="Enter")locate(n.id);}}/>)}</svg>
          <div className="cpu-canvas-hint">Drag blocks to move · Drag empty space to pan · Scroll to zoom · Double-click to edit internals</div></div>
          <div className="cpu-inspector-column"><button className="ux-sidebar-toggle" aria-expanded={!inspectorCollapsed} onClick={()=>setInspectorCollapsed(!inspectorCollapsed)}>{inspectorCollapsed?"＋":"Inspector ›"}</button><div hidden={inspectorCollapsed}><aside className="card cpu-inspector" style={{width:inspectorWidth}}>
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
          <section className="card cpu-mini-guide"><h3>♧ Key Takeaways</h3><p>✓ The canvas is a live datapath.</p><p>✓ Clocked registers update on clock step.</p><p>✓ Experiment with your custom ISA.</p></section></div></div>
        </div>
        <div className="grid cards-3">
          {engineeringOf(design).construction?.execution!=="circuit"&&<WorkspaceTools design={design} commit={commit} replace={replaceProject} onLocate={locate} trace={trace} wave={wave} onCondition={setCondition} onMessage={setSavedMsg}/>}
          {history.at(-1)?.design&&<Card title="Last Step Changes"><table className="ce-table"><thead><tr><th>Component</th><th>State</th><th>Before</th><th>After</th></tr></thead><tbody>{stateChanges(history.at(-1)!.design!,design).map((c,i)=><tr className="ws-state-changed" key={i}><td>{c.component}</td><td>{c.field}</td><td>{c.before}</td><td>{c.after}</td></tr>)}</tbody></table><p>Reverse Step restores the full recorded state. Last {history.length}/{HISTORY} steps retained.</p></Card>}
          {trace&&<details><summary>Linked execution trace · {history.length} prior states</summary><table className="ce-table"><thead><tr><th>Cycle</th><th>PC</th><th>Source / word</th><th>Operation</th><th>Reason</th></tr></thead><tbody>{[...history.map(h=>h.trace),trace].filter((t):t is ExecTrace=>!!t).map((t,i)=>{const asm=assemble(design.isa,design.program);const line=asm.ok?asm.listing.find(l=>l.address===t.pc):null;return <tr key={i}><td>{t.cycle}</td><td>{t.pc}</td><td>{line?.text??"No source mapping"} · 0x{t.ir.toString(16)}</td><td><button onClick={()=>{const n=design.nodes.find(n=>n.kind==="alu");if(n)locate(n.id);}}>{t.mnemonic} · {t.controls.ALUOp}</button></td><td>{t.reason}</td></tr>;})}</tbody></table><Btn onClick={()=>downloadText("execution-history.json",JSON.stringify({engine:"aimer-cpu-contest-2",history,current:design,trace,condition},null,2),"application/json")}>Export Full Debug History</Btn></details>}
          <Card title="Execution">
            {shown ? (
              engineeringOf(design).construction?.execution==="circuit"?<p className="tiny">Circuit cycle {shown.cycle} · {shown.reason}</p>:<p className="tiny">Cycle {shown.cycle} · PC {shown.pc} · {shown.mnemonic} · ALU {shown.aluA} {shown.controls.ALUOp} {shown.aluB} = {shown.aluY} · {shown.memOp} · {shown.reason}</p>
            ) : <p className="muted">Assemble and load a program, then step.</p>}
            {error ? <p className="status miss" style={{ fontSize: 14 }}>{error}</p> : null}
            {savedMsg ? <p className="tiny">{savedMsg}</p> : null}
          </Card>
          <Card title="Control signals">
            {shown ? (
              <table className="data">
                <tbody>
                  {(engineeringOf(design).construction?.execution==="circuit"?design.nodes.flatMap(n=>portsOf(n).filter(p=>p.dir==="out"&&p.width===1&&p.role!=="clock").map(p=>[`${n.name}.${p.name}`,view.values.get(`${n.id}:${p.id}`)??"Unknown"])):Object.entries(shown.controls)).map(([key, value]) => (
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
  function resetCurrent() { const next=engineeringOf(design).construction?.execution==="circuit"?resetCircuit(design):resetCpu(design);if(resetPolicy==="preserve")next.nodes=next.nodes.map(n=>n.kind==="dmem"?{...n,mem:design.nodes.find(v=>v.id===n.id)!.mem.slice()}:n);setDesign(next); setRunning(false); setTrace(null); setHistory([]); setWave([]); setClock(0); setError(null); }
  async function openLocal() { try { setLocalProjects(await listRecords("builder")); } catch { setError("Local storage is unavailable. Import a .cpu.json file instead."); } }
  return <StudioFrame lab={lab} focus={focus&&lab==="builder"} status={`${design.name} · ${storageStatus} · ${running ? "Running" : "Paused"}`}>
    {conflict&&<section className="ce-panel" role="alert"><h3>Project edited in another tab</h3><p>Editing is paused. Both copies are saved as milestones when you resolve this conflict.</p><Btn onClick={()=>{resolveCpuConflict("incoming");resetCurrentSession();}}>Use Incoming Copy</Btn><Btn onClick={()=>resolveCpuConflict("current")}>Keep This Copy</Btn><Btn onClick={()=>downloadText("incoming-tab-copy.cpu.json",designJson(conflict),"application/json")}>Export Incoming Copy</Btn><Btn onClick={download}>Export This Copy</Btn></section>}
    {commands&&<section className="ws-command" role="dialog" aria-label="Command palette" aria-modal="true" onKeyDown={e=>{if(e.key!=="Tab")return;const items=Array.from(e.currentTarget.querySelectorAll<HTMLElement>("input,button"));const first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}}><strong>Commands · Escape closes</strong><input autoFocus aria-label="Search commands" value={commandQuery} onChange={e=>setCommandQuery(e.target.value)} placeholder="Search actions or components"/>{[{name:"Focus canvas",run:()=>setFocus(!focus)},{name:"Fit design",run:()=>setDesign(fitDesign(design))},{name:"Step instruction",run:doStepInstruction},{name:"Reverse step",run:reverseStep},{name:"Reset CPU",run:resetCurrent},{name:"Export project",run:download},{name:"Validate design",run:()=>navigate("/architecture/builder/validate")},{name:"Contest evidence",run:()=>navigate("/architecture/builder/contest")},...PALETTE.map(p=>({name:`Add ${p.label}`,run:()=>addPart(p.kind)}))].filter(c=>c.name.toLowerCase().includes(commandQuery.toLowerCase())).map(c=><Btn key={c.name} onClick={()=>{c.run();setCommands(false);}}>{c.name}</Btn>)}<Btn onClick={()=>setCommands(false)}>Close Commands</Btn></section>}
    {lab !== "builder" && lab !== "overview" && <details className="ce-project-menu"><summary>Project ▾</summary><div className="ce-project-toolbar"><Btn onClick={() => {replaceProject(ensureProject(emptyDesign()));}}>＋ New</Btn><Btn onClick={() => void openLocal()}>▣ Open Local</Btn><Btn onClick={() => void persist().catch(() => setError("Save failed. Export a file to preserve the project."))}>▣ Save Project</Btn><Btn onClick={() => {const name = window.prompt("Save project as", `${design.name} Copy`);if(name){const next={...design,name};commit(next);void saveRecord({id:`builder-${name}`,kind:"builder",name,data:designJson(next),updated:Date.now()}).then(()=>setSavedMsg("Saved a named project copy.")).catch(()=>setError("Save As failed."));}}}>Save As</Btn><Btn onClick={download}>⇩ Export Project</Btn><label className="ce-btn">⇧ Import<input type="file" accept=".json,.cpu.json" hidden onChange={e=>{const file=e.target.files?.[0];if(file)openFile(file);}}/></label><Btn disabled={!past.length} onClick={undo}>↶ Undo</Btn><Btn disabled={!future.length} onClick={redo}>↷ Redo</Btn></div></details>}
    {localProjects && <section className="ce-panel"><div className="ce-panel-heading"><h3>Open Local Project</h3><Btn onClick={()=>setLocalProjects(null)}>Close</Btn></div>{localProjects.map(project=><Btn key={project.id} onClick={()=>{const parsed=parseDesignJson(project.data);if(parsed.ok){replaceProject(parsed.design);setLocalProjects(null);}else setError(parsed.error);}}>{project.name}</Btn>)}{!localProjects.length&&<Status>No saved CPU projects yet.</Status>}</section>}
    {lab === "builder" ? <>{canvasBlock()}<ConstructionWorkbench design={design} commit={commit} replace={replaceProject} selected={selected} select={setSelected} wave={wave} editor={blockEditor} onEditor={setBlockEditor}/></> : <EngineeringLabs key={`${lab}-${projectEpoch}`} lab={lab} design={design} commit={commit} onReplaceProject={replaceProject} selected={selected} onSelect={setSelected} trace={trace} history={history} wave={wave} running={running} onRun={startRun} onStep={doStepInstruction} onClock={() => {const result=stepMicroCycle(design,(trace?.cycle??0)+1);record(result.design,result.trace);}} onReset={resetCurrent} onLoad={loadCurrent} onMessage={setSavedMsg} onNavigate={next => navigate(`/architecture/builder/${next}`)}/>}
    {lab !== "builder" && error && <Status tone="error">{error}</Status>}
    {lab !== "builder" && savedMsg && <Status>{savedMsg}</Status>}
  </StudioFrame>;
  function resetCurrentSession() {setProjectEpoch(n=>n+1);setRunning(false);setTrace(null);setHistory([]);setWave([]);setClock(0);setSelected([]);setSelectedWire("");setBends({});setCondition("");setError(null);}
}
export default BuilderStudio;
