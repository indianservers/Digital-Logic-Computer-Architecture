import { useEffect, useMemo, useRef, useState } from "react";
import {
  addNode, deleteNodes, deleteWire, duplicateNodes, moveNode, patchNode, portsOf, type ArchNode, type CpuDesign, type NodeKind, type PortDef, type Width,
} from "../../engines/builder/model";
import { evaluateGraph } from "../../engines/builder/sim";
import { connect } from "../../engines/builder/model";
import { evaluateLogicGraph } from "../../engines/builder/logicGraph";
import { routeWire, wirePath, tracedWires, type Point } from "../../engines/builder/canvasUx";

function heightOf(node: ArchNode): number {
  const ports = portsOf(node);
  return Math.max(56, 52 + Math.max(ports.filter((port) => port.dir === "in").length, ports.filter((port) => port.dir === "out").length) * 16);
}

function portPoint(node: ArchNode, port: PortDef): { x: number; y: number } {
  const column = portsOf(node).filter((item) => item.dir === port.dir);
  const index = Math.max(0, column.findIndex((item) => item.id === port.id));
  const px=port.dir==="out"?148:0,py=52+index*16;const angle=(node.rotation??0)*Math.PI/180;const cx=74,cy=heightOf(node)/2;
  return { x: node.x+cx+(px-cx)*Math.cos(angle)-(py-cy)*Math.sin(angle), y:node.y+cy+(px-cx)*Math.sin(angle)+(py-cy)*Math.cos(angle) };
}

function tone(kind: NodeKind): string {
  if (kind === "pc" || kind === "inc") return "#1d4ed8";
  if (kind === "imem" || kind === "dmem" || kind === "umem" || kind === "cache") return "#0f766e";
  if (kind === "alu" || kind === "shifter" || kind === "cmp") return "#b45309";
  if (kind === "regfile" || kind === "acc" || kind === "gpr" || kind === "ir") return "#6d28d9";
  if (kind === "cu" || kind === "decoder" || kind === "clock") return "#be123c";
  if (kind === "mux" || kind === "bus") return "#334155";
  return "#0f172a";
}

function hexLabel(value: number, width: number): string {
  const digits = Math.max(1, Math.ceil(width / 4));
  return `0x${(value >>> 0).toString(16).toUpperCase().padStart(digits, "0")}`;
}

export function ArchCanvas({
  design,
  viewBox = "0 0 1100 520",
  selected,
  overlay,
  onSelect,
  onMove,
  onConnect,
  onDeleteWire,
  onSelectWire,
  onDropKind,
  onPan,
  bends = {},
  selectedWire,
  onBend,
  onOpenNode,
  attention, mode="select", traceSelection=false, previous, quietLabels=false, onContext, onReconnect,
}: {
  design: CpuDesign;
  viewBox?: string;
  selected: string[];
  overlay: CpuDesign["overlay"];
  onSelect: (ids: string[], additive?: boolean) => void;
  onMove: (id: string, x: number, y: number, pan?:CpuDesign["pan"]) => void;
  onConnect: (from: string, fromPort: string, to: string, toPort: string) => void;
  onDeleteWire: (id: string) => void;
  onSelectWire?: (id: string) => void;
  onDropKind: (kind: NodeKind, x: number, y: number) => void;
  onPan: (pan: CpuDesign["pan"]) => void;
  bends?: Record<string, number>;
  selectedWire?: string;
  onBend?: (id:string,x:number)=>void;
  onOpenNode?: (id:string)=>void;
  attention?:{node:string;port:string;message:string}|null;
  mode?:"select"|"pan"|"wire";
  traceSelection?:boolean;
  previous?:CpuDesign;
  quietLabels?:boolean;
  onContext?:(id:string,x:number,y:number)=>void;
  onReconnect?:(id:string,from:string,fp:string,to:string,tp:string)=>void;
}) {
  const [draft, setDraft] = useState<{ from: string; port: string; x: number; y: number; tx?: number; ty?: number; wire?:string; side?:"from"|"to"; to?:string; toPort?:string } | null>(null);
  const [wireHint,setWireHint]=useState("");
  const [hoveredWire,setHoveredWire]=useState("");
  const [guides,setGuides]=useState<{x?:number;y?:number}>({});
  useEffect(()=>{setDraft(null);setWireHint("");},[mode]);
  const traced=useMemo(()=>traceSelection?tracedWires(design,selected):null,[design.wires,selected,traceSelection]);
  const view = useMemo(() => evaluateGraph(design), [design.nodes,design.wires,design.engineering,design.isa]);
  const previousView=useMemo(()=>previous?evaluateGraph(previous):null,[previous]);
  const logic=useMemo(()=>evaluateLogicGraph(design),[design.nodes,design.wires,design.engineering,design.isa]);
  const [panPreview,setPanPreview]=useState<CpuDesign["pan"]|null>(null);
  const pan = panPreview??design.pan;
  const [dragPreview,setDragPreview] = useState<{id:string;x:number;y:number}|null>(null);
  const [panning,setPanning] = useState(false);
  const [marquee,setMarquee]=useState<{x:number;y:number;width:number;height:number}|null>(null);
  const cleanup = useRef<()=>void>(()=>{});
  const svgRef=useRef<SVGSVGElement>(null);
  useEffect(()=>()=>cleanup.current(),[]);
  useEffect(()=>{const svg=svgRef.current;if(!svg)return;const prevent=(event:WheelEvent)=>event.preventDefault();svg.addEventListener("wheel",prevent,{passive:false});return()=>svg.removeEventListener("wheel",prevent);},[]);
  const dragOrigin=design.nodes.find(n=>n.id===dragPreview?.id);
  const displayedNodes = design.nodes.map(n=>dragPreview&&dragOrigin&&!n.locked&&(dragPreview.id===n.id||selected.includes(dragPreview.id)&&selected.includes(n.id))?{...n,x:n.x+dragPreview.x-dragOrigin.x,y:n.y+dragPreview.y-dragOrigin.y}:n);
  const routes=useMemo(()=>new Map<string,readonly Point[]>(design.wires.map(w=>{
    const src=displayedNodes.find(n=>n.id===w.from),dst=displayedNodes.find(n=>n.id===w.to);const out=src&&portsOf(src).find(p=>p.id===w.fromPort),inn=dst&&portsOf(dst).find(p=>p.id===w.toPort);
    if(!src||!dst||!out||!inn)return [w.id,[] as Point[]] as const;
    const a=portPoint(src,out),b=portPoint(dst,inn),bend=bends[w.id]??design.engineering?.routeBends?.[w.id];
    if(bend!==undefined)return [w.id,[a,{x:bend,y:a.y},{x:bend,y:b.y},b]] as const;
    const obstacles=displayedNodes.filter(n=>n.id!==src.id&&n.id!==dst.id).map(n=>{const h=heightOf(n),rotated=(n.rotation??0)%180!==0;return {x:n.x+(rotated?(148-h)/2:0)-12,y:n.y+(rotated?(h-148)/2:0)-12,width:(rotated?h:148)+24,height:(rotated?148:h)+24};});
    return [w.id,routeWire(a,b,obstacles)] as const;
  })),[design.wires,design.nodes,dragPreview,bends,design.engineering?.routeBends]);
  function connectionError(node:string,port:string,side:"in"|"out"){
    if(!draft)return "";
    if(side==="out"&&draft.side!=="from"||side==="in"&&draft.side==="from")return "Choose the opposite port direction.";
    const base=draft.wire?{...design,wires:design.wires.filter(w=>w.id!==draft.wire)}:design;
    return (side==="out"?connect(base,node,port,draft.to!,draft.toPort!):connect(base,draft.from,draft.port,node,port)).error??"";
  }
  function finishPort(node:string,port:string,side:"in"|"out"){
    if(!draft)return;const error=connectionError(node,port,side);if(error){setWireHint(error);return;}
    if(draft.wire)onReconnect?.(draft.wire,side==="out"?node:draft.from,side==="out"?port:draft.port,side==="in"?node:draft.to!,side==="in"?port:draft.toPort!);
    else onConnect(draft.from,draft.port,node,port);
    setDraft(null);setWireHint("");
  }

  function localPoint(event: React.PointerEvent<SVGSVGElement> | React.DragEvent<SVGSVGElement>): { x: number; y: number } {
    const svg = event.currentTarget;
    const point = svg.createSVGPoint();
    point.x = event.clientX; point.y = event.clientY;
    const matrix = svg.getScreenCTM();
    const local = matrix ? point.matrixTransform(matrix.inverse()) : point;
    return { x: (local.x - pan.x) / pan.k, y: (local.y - pan.y) / pan.k };
  }

  return (
    <div className="arch-canvas-surface"><svg
      ref={svgRef}
      className="canvas arch-canvas"
      viewBox={viewBox}
      preserveAspectRatio="xMinYMin meet"
      role="group"
      aria-label="Architecture canvas"
      style={{touchAction:"none",userSelect:"none",cursor:panning?"grabbing":mode==="wire"?"crosshair":"grab"}}
      onContextMenu={event=>{if(onContext){event.preventDefault();onContext("",event.clientX,event.clientY);}}}
      onKeyDown={event=>{if(event.key==="Escape"){setDraft(null);setWireHint("");}}}
      onWheel={(event) => {
        const k = Math.min(2, Math.max(0.1, pan.k * (event.deltaY > 0 ? .9 : 1.1)));
        const point=event.currentTarget.createSVGPoint();point.x=event.clientX;point.y=event.clientY;
        const matrix=event.currentTarget.getScreenCTM();const local=matrix?point.matrixTransform(matrix.inverse()):point;
        onPan({ x:local.x-(local.x-pan.x)*k/pan.k,y:local.y-(local.y-pan.y)*k/pan.k,k });
      }}
      onPointerDown={(event) => {
        if(event.button===0&&(event.shiftKey||mode==="select"&&event.ctrlKey)&&event.target===event.currentTarget){event.preventDefault();cleanup.current();const svg=event.currentTarget;const origin=localPoint(event);let bounds={x:origin.x,y:origin.y,width:0,height:0};const move=(e:PointerEvent)=>{const point=svg.createSVGPoint();point.x=e.clientX;point.y=e.clientY;const matrix=svg.getScreenCTM();const local=matrix?point.matrixTransform(matrix.inverse()):point;const x=(local.x-pan.x)/pan.k,y=(local.y-pan.y)/pan.k;bounds={x:Math.min(origin.x,x),y:Math.min(origin.y,y),width:Math.abs(x-origin.x),height:Math.abs(y-origin.y)};setMarquee(bounds);};const cancel=()=>{window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",up);window.removeEventListener("pointercancel",cancel);setMarquee(null);};const up=()=>{onSelect(design.nodes.filter(n=>n.x+148>=bounds.x&&n.x<=bounds.x+bounds.width&&n.y+heightOf(n)>=bounds.y&&n.y<=bounds.y+bounds.height).map(n=>n.id),true);cancel();};window.addEventListener("pointermove",move);window.addEventListener("pointerup",up);window.addEventListener("pointercancel",cancel);cleanup.current=cancel;return;}
        if (event.button === 1 || event.altKey || event.button===0 && (event.target===event.currentTarget||mode==="pan")) {
          event.preventDefault();cleanup.current();setPanning(true);
          if(event.target===event.currentTarget){onSelect([]);setDraft(null);}
          const scale=event.currentTarget.getScreenCTM()?.a??1;
          const origin = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
          let targetPan=pan;let moved=false;
          const move = (next: PointerEvent) => {moved=true;targetPan={...pan,x:origin.panX+(next.clientX-origin.x)/scale,y:origin.panY+(next.clientY-origin.y)/scale};setPanPreview(targetPan);};
          const up = () => {
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", up);
            window.removeEventListener("pointercancel",cancel);setPanning(false);setPanPreview(null);cleanup.current=()=>{};if(moved)onPan(targetPan);
          };
          const cancel=()=>{window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",up);window.removeEventListener("pointercancel",cancel);setPanning(false);setPanPreview(null);cleanup.current=()=>{};};
          window.addEventListener("pointermove", move);
          window.addEventListener("pointerup", up);
          window.addEventListener("pointercancel",cancel);cleanup.current=cancel;
          return;
        }
        if (event.target === event.currentTarget) onSelect([]);
      }}
      onPointerMove={(event) => { if (draft) { const point = localPoint(event); setDraft({ ...draft, tx: point.x, ty: point.y }); } }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const kind = event.dataTransfer.getData("kind") as NodeKind;
        if (!kind) return;
        const point = localPoint(event);
        onDropKind(kind, point.x - 70, point.y - 24);
      }}
    >
      <g transform={`translate(${pan.x} ${pan.y}) scale(${pan.k})`}>
        {design.wires.map((wire) => {
          const src = displayedNodes.find((node) => node.id === wire.from);
          const dst = displayedNodes.find((node) => node.id === wire.to);
          if (!src || !dst) return null;
          const out = portsOf(src).find((port) => port.id === wire.fromPort);
          const inn = portsOf(dst).find((port) => port.id === wire.toPort);
          if (!out || !inn) return null;
          const a = portPoint(src, out);
          const b = portPoint(dst, inn);
          const points=routes.get(wire.id)??[a,b];const path=wirePath(points,design.engineering?.routing!=="orthogonal");const mid = bends[wire.id] ?? design.engineering?.routeBends?.[wire.id] ?? points[Math.floor(points.length/2)]?.x ?? (a.x + b.x) / 2;
          const control = out.role !== "data";
          const hide = overlay === "data" && control || overlay === "control" && !control;
          if (hide) return null;
          const value = view.values.get(`${src.id}:${out.id}`) ?? 0;
          const active = view.active.has(wire.id);
          const bits=(logic.values.get(`${src.id}:${out.id}`)??[]).join("");
          const unknown=/[XZ]/.test(bits);
          return (
            <g key={wire.id} onContextMenu={e=>{if(onContext){e.preventDefault();e.stopPropagation();onSelectWire?.(wire.id);onContext("",e.clientX,e.clientY);}}} opacity={traced&&!traced.has(wire.id)?.18:1} onMouseEnter={()=>setHoveredWire(wire.id)} onMouseLeave={()=>setHoveredWire("")} role="button" tabIndex={0} aria-label={`Wire ${src.name}.${out.name} to ${dst.name}.${inn.name}, ${out.width} bits, ${out.role}, ${bits}`} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();onSelectWire?.(wire.id);}if(e.key==="Delete"){e.stopPropagation();onDeleteWire(wire.id);}}} onClick={(event) => { event.stopPropagation(); if (event.altKey) onDeleteWire(wire.id); else onSelectWire?.(wire.id); }} style={{ cursor: "pointer" }}>
              <title>{`${src.name}.${out.name} → ${dst.name}.${inn.name} · ${bits} · ${out.role}`}</title>
              <path d={path} fill="none" stroke="transparent" strokeWidth={14}/>
              <path
                d={path}
                fill="none"
                stroke={selectedWire===wire.id?"#172b69":unknown?"#b45309":out.role==="clock"?"#be123c":control ? "#ee4089" : active ? "#087bff" : "#8764ec"}
                strokeWidth={selectedWire===wire.id?5:control ? 1.6 : Math.min(5, 2 + out.width / 8)}
                strokeDasharray={unknown?"2 3":out.role==="clock"?"8 3 2 3":control ? "5 4" : undefined}
              />
              {design.engineering?.signalLabels !== false && (!quietLabels||selectedWire===wire.id||hoveredWire===wire.id) && <text x={mid} y={(a.y + b.y) / 2 - 4} fontSize={9} fill="var(--text-secondary)">{out.role} · {out.width}b · {unknown?bits:hexLabel(value, out.width)}</text>}

              {selectedWire===wire.id&&onBend&&<circle cx={mid} cy={(a.y+b.y)/2} r="9" fill="white" stroke="#1456c0" strokeWidth="3" role="button" tabIndex={0} aria-label={`Adjust bend for ${wire.id}`} onKeyDown={e=>{if(e.key==="ArrowLeft"||e.key==="ArrowRight"){e.preventDefault();e.stopPropagation();onBend(wire.id,mid+(e.key==="ArrowLeft"?-16:16));}}} onPointerDown={e=>{e.stopPropagation();const svg=e.currentTarget.ownerSVGElement;const scale=svg?.getScreenCTM()?.a??1;const origin=e.clientX;const move=(event:PointerEvent)=>onBend(wire.id,mid+(event.clientX-origin)/(pan.k*scale));const up=()=>{window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",up);};window.addEventListener("pointermove",move);window.addEventListener("pointerup",up);}}/>}
            </g>
          );
        })}
        {draft ? <line x1={draft.x} y1={draft.y} x2={draft.tx ?? draft.x + 8} y2={draft.ty ?? draft.y} stroke="var(--primary)" strokeDasharray="4 3" /> : null}
        {displayedNodes.map((node) => {
          const selectedNode = selected.includes(node.id);
          const ins = portsOf(node).filter((port) => port.dir === "in");
          const outs = portsOf(node).filter((port) => port.dir === "out");
          return (
            <g
              key={node.id}
              role="button" tabIndex={0} aria-label={`Component ${node.name}, ${node.kind}, ${node.width} bits`}
              onKeyDown={e=>{if(e.target!==e.currentTarget)return;if(e.key==="Enter"||e.key===" "){e.preventDefault();onSelect([node.id],e.shiftKey);}const delta:{[key:string]:[number,number]}={ArrowLeft:[-16,0],ArrowRight:[16,0],ArrowUp:[0,-16],ArrowDown:[0,16]};const d=delta[e.key];if(d&&!node.locked){e.preventDefault();onMove(node.id,node.x+d[0],node.y+d[1]);}}}
              transform={`translate(${node.x} ${node.y}) rotate(${node.rotation??0} 74 ${heightOf(node)/2})`}
              onContextMenu={e=>{if(onContext){e.preventDefault();e.stopPropagation();onSelect([node.id]);onContext(node.id,e.clientX,e.clientY);}}}
              onDoubleClick={()=>onOpenNode?.(node.id)}
              style={{cursor:node.locked?"default":"move"}}
              onPointerDown={(event) => {
                if(mode==="pan")return;event.stopPropagation();
                if(event.shiftKey||!selected.includes(node.id))onSelect([node.id], event.shiftKey);
                if (node.locked||mode==="wire") return;
                if(event.button!==0)return;
                event.preventDefault();cleanup.current();
                const svg = event.currentTarget.ownerSVGElement;
                const scale = svg?.getScreenCTM()?.a ?? 1;
                const dx = event.clientX;
                const dy = event.clientY;
                const ox = node.x;
                const oy = node.y;
                let position={x:ox,y:oy};let moved=false;let edgeX=0,edgeY=0;let lastX=dx,lastY=dy;let frame=0;const bounds=svg?.getBoundingClientRect();
                const preview=()=>{position={x:ox+(lastX-dx)/(pan.k*scale)+edgeX,y:oy+(lastY-dy)/(pan.k*scale)+edgeY};const guide:{x?:number;y?:number}={};for(const other of design.nodes.filter(n=>n.id!==node.id&&!selected.includes(n.id))){if(Math.abs(other.x-position.x)<7/pan.k){position.x=other.x;guide.x=other.x;}if(Math.abs(other.y-position.y)<7/pan.k){position.y=other.y;guide.y=other.y;}}setGuides(guide);setDragPreview({id:node.id,...position});};
                const tick=()=>{if(bounds&&moved){const ex=lastX<bounds.left+35?-6:lastX>bounds.right-35?6:0,ey=lastY<bounds.top+35?-6:lastY>bounds.bottom-35?6:0;if(ex||ey){edgeX+=ex/pan.k;edgeY+=ey/pan.k;setPanPreview({...pan,x:pan.x-edgeX*pan.k,y:pan.y-edgeY*pan.k});preview();}}frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);
                const move = (next: PointerEvent) => {moved=true;lastX=next.clientX;lastY=next.clientY;preview();};
                const up = () => {
                  window.removeEventListener("pointermove", move);
                  window.removeEventListener("pointerup", up);
                  window.removeEventListener("pointercancel",cancel);
                  cancelAnimationFrame(frame);setGuides({});setDragPreview(null);setPanPreview(null);if(moved){onMove(node.id,position.x,position.y,edgeX||edgeY?{...pan,x:pan.x-edgeX*pan.k,y:pan.y-edgeY*pan.k}:undefined);}
                };
                const cancel=()=>{window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",up);window.removeEventListener("pointercancel",cancel);cancelAnimationFrame(frame);setGuides({});setPanPreview(null);setDragPreview(null);};
                window.addEventListener("pointermove", move);
                window.addEventListener("pointerup", up);
                window.addEventListener("pointercancel",cancel);cleanup.current=cancel;
              }}
            >
              <rect width={148} height={heightOf(node)} rx={12} fill={previous&&([...portsOf(node).filter(p=>p.dir==="out")].some(p=>previousView?.values.get(`${node.id}:${p.id}`)!==view.values.get(`${node.id}:${p.id}`))||previous.nodes.find(n=>n.id===node.id)?.value!==node.value)?"#fff4cc":"white"} stroke={selectedNode ? "var(--primary)" : "var(--border-soft)"} strokeWidth={selectedNode ? 2.4 : 1} />
              <rect width={148} height={28} rx={10} fill={tone(node.kind)} />
              <text x={8} y={19} fontSize={12} fontWeight={800} fill="white">{node.name}</text>
              <title>{previous?`Previous stored value: ${previous.nodes.find(n=>n.id===node.id)?.value??"—"}; current: ${node.value}`:node.note}</title><text x={8} y={36} fontSize={10} fill="var(--text-secondary)">{hexLabel(view.values.get(`${node.id}:y`) ?? view.values.get(`${node.id}:q`) ?? view.values.get(`${node.id}:a`) ?? node.value, node.width)} · {node.width}b</text>
              {ins.map((port) => {
                const p = portPoint({ ...node, x: 0, y: 0, rotation:0 }, port);
                const compatible=!!draft&&!connectionError(node.id,port.id,"in");
                const finish=()=>finishPort(node.id,port.id,"in");
                return (
                  <g key={port.id} onMouseEnter={()=>{if(draft)setWireHint(connectionError(node.id,port.id,"in")||"Release or click to connect");}} role="button" tabIndex={0} aria-label={`${node.name} input ${port.name}, ${port.width} bits, ${port.role}${compatible?", compatible":""}`} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();e.stopPropagation();finish();}}} onPointerDown={event => {if(mode!=="pan")event.stopPropagation();}} onPointerUp={(event) => {
                    event.stopPropagation();
                    finish();
                  }}>
                    <title>{`${node.name}.${port.name} · input · ${port.width} bits · ${port.role}${attention?.node===node.id&&attention.port===port.id?` · ${attention.message}`:""}`}</title>
                    <circle cx={p.x} cy={p.y} r={14} strokeWidth={2} fill={compatible?"#16a34a33":"transparent"} stroke={attention?.node===node.id&&attention.port===port.id?"#dc2626":compatible?"#16a34a":"none"}/>
                    <circle cx={p.x} cy={p.y} r={5} fill={port.role === "clock" ? "#be123c" : port.width === 1 ? "#0f766e" : "#1d4ed8"} />
                    <text x={10} y={p.y + 3} fontSize={8} fill="var(--text-muted)">{port.name}</text>
                  </g>
                );
              })}
              {outs.map((port) => {
                const p = portPoint({ ...node, x: 0, y: 0, rotation:0 }, port);
                return (
                  <g key={port.id} onPointerUp={e=>{e.stopPropagation();if(draft?.side==="from")finishPort(node.id,port.id,"out");}} onMouseEnter={()=>{if(draft?.side==="from")setWireHint(connectionError(node.id,port.id,"out")||"Release or click to reconnect");}} role="button" tabIndex={0} aria-label={`${node.name} output ${port.name}, ${port.width} bits, ${port.role}`} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();e.stopPropagation();if(draft?.side==="from")finishPort(node.id,port.id,"out");else {setDraft({from:node.id,port:port.id,...portPoint(node,port)});setWireHint("");}}}} onPointerDown={(event) => {
                    if(mode==="pan")return;event.stopPropagation();
                    if(draft?.side==="from")return;setDraft({ from: node.id, port: port.id, ...portPoint(node,port) });setWireHint("");
                  }}>
                    <title>{`${node.name}.${port.name} · output · ${port.width} bits · ${port.role}${attention?.node===node.id&&attention.port===port.id?` · ${attention.message}`:""}`}</title>
                    <circle cx={p.x} cy={p.y} r={14} fill={draft?.side==="from"&&!connectionError(node.id,port.id,"out")?"#16a34a33":"transparent"}/>
                    <circle cx={p.x} cy={p.y} r={5} fill={port.width === 1 ? "#0f766e" : "#1d4ed8"} />
                    <text x={p.x - 52} y={p.y + 3} fontSize={8} textAnchor="end" fill="var(--text-muted)">{port.name}</text>
                  </g>
                );
              })}
            </g>
          );
        })}
        {design.wires.filter(wire=>wire.id===selectedWire).map(wire=>{const src=displayedNodes.find(n=>n.id===wire.from),dst=displayedNodes.find(n=>n.id===wire.to);const out=src&&portsOf(src).find(p=>p.id===wire.fromPort),inn=dst&&portsOf(dst).find(p=>p.id===wire.toPort);if(!src||!dst||!out||!inn)return null;const a=portPoint(src,out),b=portPoint(dst,inn);return <g key={wire.id}>{onReconnect&&([{side:"from" as const,p:a},{side:"to" as const,p:b}]).map(({side,p})=><circle key={side} cx={p.x} cy={p.y} r={9} fill="white" stroke="#2563eb" strokeWidth={3} role="button" tabIndex={0} aria-label={`Reconnect ${side} endpoint`} onPointerDown={e=>{e.stopPropagation();setDraft({from:wire.from,port:wire.fromPort,to:wire.to,toPort:wire.toPort,wire:wire.id,side,...(side==="from"?b:a)});setWireHint("Choose a replacement "+(side==="from"?"output":"input")+" · Escape keeps the original wire");}} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();e.stopPropagation();setDraft({from:wire.from,port:wire.fromPort,to:wire.to,toPort:wire.toPort,wire:wire.id,side,...(side==="from"?b:a)});}}}/>)}</g>;})}
        {guides.x!==undefined&&<line x1={guides.x} x2={guides.x} y1={-10000} y2={10000} stroke="#e11d8a" strokeDasharray="5 4" pointerEvents="none"/>}{guides.y!==undefined&&<line y1={guides.y} y2={guides.y} x1={-10000} x2={10000} stroke="#e11d8a" strokeDasharray="5 4" pointerEvents="none"/>}
        {marquee&&<rect {...marquee} fill="#2563eb18" stroke="#2563eb" strokeWidth={1.5/pan.k} strokeDasharray="5 4" pointerEvents="none"/>}
      </g>
    </svg>{draft&&<div className="arch-wire-hint" role="status">{wireHint||"Choose a highlighted port · Escape cancels"}</div>}</div>
  );
}

export function applyDrop(design: CpuDesign, kind: NodeKind, x: number, y: number): CpuDesign {
  return addNode(design, kind, x, y);
}

export function applyConnect(design: CpuDesign, from: string, fromPort: string, to: string, toPort: string): { design: CpuDesign; error: string | null } {
  return connect(design, from, fromPort, to, toPort);
}

export function applyDelete(design: CpuDesign, ids: string[]): CpuDesign {
  return deleteNodes(design, ids);
}

export function applyMove(design: CpuDesign, id: string, x: number, y: number): CpuDesign {
  return moveNode(design, id, x, y);
}

export function applyDuplicate(design: CpuDesign, ids: string[]): CpuDesign {
  return duplicateNodes(design, ids);
}

export function applyPatch(design: CpuDesign, id: string, patch: Partial<ArchNode>): CpuDesign {
  return patchNode(design, id, patch);
}

export function applyDeleteWire(design: CpuDesign, id: string): CpuDesign {
  return deleteWire(design, id);
}

export const WIDTHS: Width[] = [1, 4, 8, 16, 32];
