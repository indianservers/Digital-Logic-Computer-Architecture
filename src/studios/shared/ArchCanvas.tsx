import { useMemo, useState } from "react";
import {
  addNode, deleteNodes, deleteWire, duplicateNodes, moveNode, patchNode, portsOf, type ArchNode, type CpuDesign, type NodeKind, type PortDef, type Width,
} from "../../engines/builder/model";
import { evaluateGraph } from "../../engines/builder/sim";
import { connect } from "../../engines/builder/model";
import { evaluateLogicGraph } from "../../engines/builder/logicGraph";

function heightOf(node: ArchNode): number {
  const ports = portsOf(node);
  return Math.max(56, 52 + Math.max(ports.filter((port) => port.dir === "in").length, ports.filter((port) => port.dir === "out").length) * 16);
}

function portPoint(node: ArchNode, port: PortDef): { x: number; y: number } {
  const column = portsOf(node).filter((item) => item.dir === port.dir);
  const index = Math.max(0, column.findIndex((item) => item.id === port.id));
  return { x: node.x + (port.dir === "out" ? 148 : 0), y: node.y + 52 + index * 16 };
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
}: {
  design: CpuDesign;
  viewBox?: string;
  selected: string[];
  overlay: CpuDesign["overlay"];
  onSelect: (ids: string[], additive?: boolean) => void;
  onMove: (id: string, x: number, y: number) => void;
  onConnect: (from: string, fromPort: string, to: string, toPort: string) => void;
  onDeleteWire: (id: string) => void;
  onSelectWire?: (id: string) => void;
  onDropKind: (kind: NodeKind, x: number, y: number) => void;
  onPan: (pan: CpuDesign["pan"]) => void;
  bends?: Record<string, number>;
  selectedWire?: string;
  onBend?: (id:string,x:number)=>void;
}) {
  const [draft, setDraft] = useState<{ from: string; port: string; x: number; y: number; tx?: number; ty?: number } | null>(null);
  const view = useMemo(() => evaluateGraph(design), [design]);
  const logic=useMemo(()=>evaluateLogicGraph(design),[design]);
  const pan = design.pan;

  function localPoint(event: React.PointerEvent<SVGSVGElement> | React.DragEvent<SVGSVGElement>): { x: number; y: number } {
    const svg = event.currentTarget;
    const point = svg.createSVGPoint();
    point.x = event.clientX; point.y = event.clientY;
    const matrix = svg.getScreenCTM();
    const local = matrix ? point.matrixTransform(matrix.inverse()) : point;
    return { x: (local.x - pan.x) / pan.k, y: (local.y - pan.y) / pan.k };
  }

  return (
    <svg
      className="canvas arch-canvas"
      viewBox={viewBox}
      preserveAspectRatio="xMinYMin meet"
      role="group"
      aria-label="Architecture canvas"
      onKeyDown={event=>{if(event.key==="Escape")setDraft(null);}}
      onWheel={(event) => {
        event.preventDefault();
        const k = Math.min(2, Math.max(0.4, pan.k + (event.deltaY > 0 ? -0.08 : 0.08)));
        onPan({ ...pan, k });
      }}
      onPointerDown={(event) => {
        if (event.button === 1 || event.altKey) {
          const origin = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
          const move = (next: PointerEvent) => onPan({ ...pan, x: origin.panX + next.clientX - origin.x, y: origin.panY + next.clientY - origin.y });
          const up = () => {
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", up);
          };
          window.addEventListener("pointermove", move);
          window.addEventListener("pointerup", up);
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
          const src = design.nodes.find((node) => node.id === wire.from);
          const dst = design.nodes.find((node) => node.id === wire.to);
          if (!src || !dst) return null;
          const out = portsOf(src).find((port) => port.id === wire.fromPort);
          const inn = portsOf(dst).find((port) => port.id === wire.toPort);
          if (!out || !inn) return null;
          const a = portPoint(src, out);
          const b = portPoint(dst, inn);
          const mid = bends[wire.id] ?? design.engineering?.routeBends?.[wire.id] ?? (a.x + b.x) / 2;
          const control = out.role !== "data";
          const hide = overlay === "data" && control || overlay === "control" && !control;
          if (hide) return null;
          const value = view.values.get(`${src.id}:${out.id}`) ?? 0;
          const active = view.active.has(wire.id);
          const bits=(logic.values.get(`${src.id}:${out.id}`)??[]).join("");
          const unknown=/[XZ]/.test(bits);
          return (
            <g key={wire.id} role="button" tabIndex={0} aria-label={`Wire ${src.name}.${out.name} to ${dst.name}.${inn.name}, ${out.width} bits, ${out.role}, ${bits}`} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();onSelectWire?.(wire.id);}if(e.key==="Delete"){e.stopPropagation();onDeleteWire(wire.id);}}} onClick={(event) => { event.stopPropagation(); if (event.altKey) onDeleteWire(wire.id); else onSelectWire?.(wire.id); }} style={{ cursor: "pointer" }}>
              <title>{`${src.name}.${out.name} → ${dst.name}.${inn.name} · ${bits} · ${out.role}`}</title>
              <path d={`M ${a.x} ${a.y} H ${mid} V ${b.y} H ${b.x}`} fill="none" stroke="transparent" strokeWidth={14}/>
              <path
                d={design.engineering?.routing === "orthogonal" ? `M ${a.x} ${a.y} H ${mid} V ${b.y} H ${b.x}` : `M ${a.x} ${a.y} C ${mid} ${a.y}, ${mid} ${b.y}, ${b.x} ${b.y}`}
                fill="none"
                stroke={selectedWire===wire.id?"#172b69":unknown?"#b45309":out.role==="clock"?"#be123c":control ? "#ee4089" : active ? "#087bff" : "#8764ec"}
                strokeWidth={selectedWire===wire.id?5:control ? 1.6 : Math.min(5, 2 + out.width / 8)}
                strokeDasharray={unknown?"2 3":out.role==="clock"?"8 3 2 3":control ? "5 4" : undefined}
              />
              {design.engineering?.signalLabels !== false && <text x={mid} y={(a.y + b.y) / 2 - 4} fontSize={9} fill="var(--text-secondary)">{out.role} · {out.width}b · {unknown?bits:hexLabel(value, out.width)}</text>}
              {selectedWire===wire.id&&onBend&&<circle cx={mid} cy={(a.y+b.y)/2} r="9" fill="white" stroke="#1456c0" strokeWidth="3" role="button" tabIndex={0} aria-label={`Adjust bend for ${wire.id}`} onKeyDown={e=>{if(e.key==="ArrowLeft"||e.key==="ArrowRight"){e.preventDefault();e.stopPropagation();onBend(wire.id,mid+(e.key==="ArrowLeft"?-16:16));}}} onPointerDown={e=>{e.stopPropagation();const svg=e.currentTarget.ownerSVGElement;const scale=svg?.getScreenCTM()?.a??1;const origin=e.clientX;const move=(event:PointerEvent)=>onBend(wire.id,mid+(event.clientX-origin)/(pan.k*scale));const up=()=>{window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",up);};window.addEventListener("pointermove",move);window.addEventListener("pointerup",up);}}/>}
            </g>
          );
        })}
        {draft ? <line x1={draft.x} y1={draft.y} x2={draft.tx ?? draft.x + 8} y2={draft.ty ?? draft.y} stroke="var(--primary)" strokeDasharray="4 3" /> : null}
        {design.nodes.map((node) => {
          const selectedNode = selected.includes(node.id);
          const ins = portsOf(node).filter((port) => port.dir === "in");
          const outs = portsOf(node).filter((port) => port.dir === "out");
          return (
            <g
              key={node.id}
              role="button" tabIndex={0} aria-label={`Component ${node.name}, ${node.kind}, ${node.width} bits`}
              onKeyDown={e=>{if(e.target!==e.currentTarget)return;if(e.key==="Enter"||e.key===" "){e.preventDefault();onSelect([node.id],e.shiftKey);}const delta:{[key:string]:[number,number]}={ArrowLeft:[-16,0],ArrowRight:[16,0],ArrowUp:[0,-16],ArrowDown:[0,16]};const d=delta[e.key];if(d&&!node.locked){e.preventDefault();onMove(node.id,node.x+d[0],node.y+d[1]);}}}
              transform={`translate(${node.x} ${node.y})`}
              onPointerDown={(event) => {
                event.stopPropagation();
                onSelect([node.id], event.shiftKey);
                if (node.locked) return;
                const svg = event.currentTarget.ownerSVGElement;
                const scale = svg?.getScreenCTM()?.a ?? 1;
                const dx = event.clientX;
                const dy = event.clientY;
                const ox = node.x;
                const oy = node.y;
                const move = (next: PointerEvent) => onMove(node.id, ox + (next.clientX - dx) / (pan.k * scale), oy + (next.clientY - dy) / (pan.k * scale));
                const up = () => {
                  window.removeEventListener("pointermove", move);
                  window.removeEventListener("pointerup", up);
                };
                window.addEventListener("pointermove", move);
                window.addEventListener("pointerup", up);
              }}
            >
              <rect width={148} height={heightOf(node)} rx={12} fill="white" stroke={selectedNode ? "var(--primary)" : "var(--border-soft)"} strokeWidth={selectedNode ? 2.4 : 1} />
              <rect width={148} height={28} rx={10} fill={tone(node.kind)} />
              <text x={8} y={19} fontSize={12} fontWeight={800} fill="white">{node.name}</text>
              <text x={8} y={36} fontSize={10} fill="var(--text-secondary)">{hexLabel(view.values.get(`${node.id}:y`) ?? view.values.get(`${node.id}:q`) ?? view.values.get(`${node.id}:a`) ?? node.value, node.width)} · {node.width}b</text>
              {ins.map((port) => {
                const p = portPoint({ ...node, x: 0, y: 0 }, port);
                const compatible=draft&&!connect(design,draft.from,draft.port,node.id,port.id).error;
                const finish=()=>{if(draft)onConnect(draft.from,draft.port,node.id,port.id);setDraft(null);};
                return (
                  <g key={port.id} role="button" tabIndex={0} aria-label={`${node.name} input ${port.name}, ${port.width} bits, ${port.role}${compatible?", compatible":""}`} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();e.stopPropagation();finish();}}} onPointerDown={event => event.stopPropagation()} onPointerUp={(event) => {
                    event.stopPropagation();
                    if (draft) onConnect(draft.from, draft.port, node.id, port.id);
                    setDraft(null);
                  }}>
                    <title>{`${node.name}.${port.name} · input · ${port.width} bits · ${port.role}`}</title>
                    <circle cx={p.x} cy={p.y} r={12} fill={compatible?"#16a34a33":"transparent"} stroke={compatible?"#16a34a":"none"}/>
                    <circle cx={p.x} cy={p.y} r={5} fill={port.role === "clock" ? "#be123c" : port.width === 1 ? "#0f766e" : "#1d4ed8"} />
                    <text x={10} y={p.y + 3} fontSize={8} fill="var(--text-muted)">{port.name}</text>
                  </g>
                );
              })}
              {outs.map((port) => {
                const p = portPoint({ ...node, x: 0, y: 0 }, port);
                return (
                  <g key={port.id} role="button" tabIndex={0} aria-label={`${node.name} output ${port.name}, ${port.width} bits, ${port.role}`} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();e.stopPropagation();setDraft({from:node.id,port:port.id,x:node.x+p.x,y:node.y+p.y});}}} onPointerDown={(event) => {
                    event.stopPropagation();
                    setDraft({ from: node.id, port: port.id, x: node.x + p.x, y: node.y + p.y });
                  }}>
                    <title>{`${node.name}.${port.name} · output · ${port.width} bits · ${port.role}`}</title>
                    <circle cx={p.x} cy={p.y} r={12} fill="transparent"/>
                    <circle cx={p.x} cy={p.y} r={5} fill={port.width === 1 ? "#0f766e" : "#1d4ed8"} />
                    <text x={p.x - 52} y={p.y + 3} fontSize={8} textAnchor="end" fill="var(--text-muted)">{port.name}</text>
                  </g>
                );
              })}
            </g>
          );
        })}
      </g>
    </svg>
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
