import { useMemo, useState } from "react";
import {
  addNode, deleteNodes, deleteWire, duplicateNodes, moveNode, patchNode, portsOf, type ArchNode, type CpuDesign, type NodeKind, type PortDef, type Width,
} from "../../engines/builder/model";
import { evaluateGraph } from "../../engines/builder/sim";
import { connect } from "../../engines/builder/model";

function heightOf(node: ArchNode): number {
  const ports = portsOf(node);
  return Math.max(56, 22 + Math.max(ports.filter((port) => port.dir === "in").length, ports.filter((port) => port.dir === "out").length) * 16);
}

function portPoint(node: ArchNode, port: PortDef): { x: number; y: number } {
  const column = portsOf(node).filter((item) => item.dir === port.dir);
  const index = Math.max(0, column.findIndex((item) => item.id === port.id));
  return { x: node.x + (port.dir === "out" ? 148 : 0), y: node.y + 22 + index * 16 };
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
  selected,
  overlay,
  onSelect,
  onMove,
  onConnect,
  onDeleteWire,
  onDropKind,
  onPan,
}: {
  design: CpuDesign;
  selected: string[];
  overlay: CpuDesign["overlay"];
  onSelect: (ids: string[], additive?: boolean) => void;
  onMove: (id: string, x: number, y: number) => void;
  onConnect: (from: string, fromPort: string, to: string, toPort: string) => void;
  onDeleteWire: (id: string) => void;
  onDropKind: (kind: NodeKind, x: number, y: number) => void;
  onPan: (pan: CpuDesign["pan"]) => void;
}) {
  const [draft, setDraft] = useState<{ from: string; port: string; x: number; y: number } | null>(null);
  const view = useMemo(() => evaluateGraph(design), [design]);
  const pan = design.pan;

  function localPoint(event: React.PointerEvent<SVGSVGElement> | React.DragEvent<SVGSVGElement>): { x: number; y: number } {
    const box = event.currentTarget.getBoundingClientRect();
    return { x: (event.clientX - box.left - pan.x) / pan.k, y: (event.clientY - box.top - pan.y) / pan.k };
  }

  return (
    <svg
      className="canvas arch-canvas"
      viewBox="0 0 1100 520"
      role="img"
      aria-label="Architecture canvas"
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
          const mid = (a.x + b.x) / 2;
          const control = out.role === "control" || out.width === 1;
          const hide = overlay === "data" && control || overlay === "control" && !control;
          if (hide) return null;
          const value = view.values.get(`${src.id}:${out.id}`) ?? 0;
          const active = view.active.has(wire.id);
          return (
            <g key={wire.id} onClick={(event) => { event.stopPropagation(); onDeleteWire(wire.id); }} style={{ cursor: "pointer" }}>
              <path
                d={`M ${a.x} ${a.y} C ${mid} ${a.y}, ${mid} ${b.y}, ${b.x} ${b.y}`}
                fill="none"
                stroke={active ? "var(--primary)" : "var(--text-muted)"}
                strokeWidth={control ? 1.6 : Math.min(5, 2 + out.width / 8)}
                strokeDasharray={control ? "5 4" : undefined}
              />
              <text x={mid} y={(a.y + b.y) / 2 - 4} fontSize={9} fill="var(--text-secondary)">{out.width}b · {hexLabel(value, out.width)}</text>
            </g>
          );
        })}
        {draft ? <line x1={draft.x} y1={draft.y} x2={draft.x + 8} y2={draft.y} stroke="var(--primary)" strokeDasharray="4 3" /> : null}
        {design.nodes.map((node) => {
          const selectedNode = selected.includes(node.id);
          const ins = portsOf(node).filter((port) => port.dir === "in");
          const outs = portsOf(node).filter((port) => port.dir === "out");
          return (
            <g
              key={node.id}
              transform={`translate(${node.x} ${node.y})`}
              onPointerDown={(event) => {
                event.stopPropagation();
                onSelect([node.id], event.shiftKey);
                const dx = event.clientX;
                const dy = event.clientY;
                const ox = node.x;
                const oy = node.y;
                const move = (next: PointerEvent) => onMove(node.id, ox + (next.clientX - dx) / pan.k, oy + (next.clientY - dy) / pan.k);
                const up = () => {
                  window.removeEventListener("pointermove", move);
                  window.removeEventListener("pointerup", up);
                };
                window.addEventListener("pointermove", move);
                window.addEventListener("pointerup", up);
              }}
            >
              <rect width={148} height={heightOf(node)} rx={12} fill="white" stroke={selectedNode ? "var(--primary)" : "var(--border-soft)"} strokeWidth={selectedNode ? 2.4 : 1} />
              <rect width={148} height={20} rx={12} fill={tone(node.kind)} />
              <text x={8} y={14} fontSize={10} fontWeight={800} fill="white">{node.name}</text>
              <text x={8} y={36} fontSize={10} fill="var(--text-secondary)">{hexLabel(view.values.get(`${node.id}:y`) ?? view.values.get(`${node.id}:q`) ?? view.values.get(`${node.id}:a`) ?? node.value, node.width)} · {node.width}b</text>
              {ins.map((port) => {
                const p = portPoint({ ...node, x: 0, y: 0 }, port);
                return (
                  <g key={port.id} onPointerUp={(event) => {
                    event.stopPropagation();
                    if (draft) onConnect(draft.from, draft.port, node.id, port.id);
                    setDraft(null);
                  }}>
                    <circle cx={p.x} cy={p.y} r={5} fill={port.role === "clock" ? "#be123c" : port.width === 1 ? "#0f766e" : "#1d4ed8"} />
                    <text x={10} y={p.y + 3} fontSize={8} fill="var(--text-muted)">{port.name}</text>
                  </g>
                );
              })}
              {outs.map((port) => {
                const p = portPoint({ ...node, x: 0, y: 0 }, port);
                return (
                  <g key={port.id} onPointerDown={(event) => {
                    event.stopPropagation();
                    setDraft({ from: node.id, port: port.id, x: node.x + p.x, y: node.y + p.y });
                  }}>
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
