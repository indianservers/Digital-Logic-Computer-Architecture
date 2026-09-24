import { useLayoutEffect, useRef, useState } from "react";
import { resizeNode, wiresDropped, type ResizeCorner } from "./engine";
import { getComponent, nodeFrame } from "./registry";
import type { CircuitNode } from "./types";
import type { CircuitSession } from "./useCircuit";

export function SelectionOverlay({
  circuit,
  hoverId,
  renameId,
  onRename,
  onCancelRename,
  onToggleProps,
  onMenu,
  onBlocked,
  draft,
  onDraft,
}: {
  circuit: CircuitSession;
  hoverId: string | null;
  renameId: string | null;
  onRename: (id: string, label: string) => void;
  onCancelRename: () => void;
  onToggleProps: () => void;
  onMenu: (menu: { x: number; y: number; kind: "node" | "wire"; id: string } | null) => void;
  onBlocked: (id: string, count: number) => void;
  draft: CircuitNode | null;
  onDraft: (node: CircuitNode | null) => void;
}) {
  const zoom = circuit.view.zoom;
  const nodes = circuit.doc.nodes.map((node) => (draft?.id === node.id ? draft : node));
  const selected = nodes.filter((node) => circuit.selected.includes(node.id));
  const hover = hoverId && !circuit.selected.includes(hoverId) ? nodes.find((node) => node.id === hoverId) : undefined;

  function screen(node: CircuitNode) {
    const frame = nodeFrame(node);
    return {
      left: circuit.view.x + frame.x * zoom,
      top: circuit.view.y + frame.y * zoom,
      width: frame.width * zoom,
      height: frame.height * zoom,
    };
  }

  function onHandleDown(event: React.PointerEvent<HTMLButtonElement>, node: CircuitNode, corner: ResizeCorner) {
    event.preventDefault();
    event.stopPropagation();
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    const origin = circuit.doc.nodes.find((item) => item.id === node.id) ?? node;
    function point(ev: PointerEvent) {
      const rect = handle.closest(".lgx-canvas")?.querySelector("svg")?.getBoundingClientRect();
      if (!rect) return null;
      return { x: (ev.clientX - rect.left - circuit.view.x) / zoom, y: (ev.clientY - rect.top - circuit.view.y) / zoom };
    }
    function move(ev: PointerEvent) {
      const at = point(ev);
      if (!at) return;
      onDraft({ ...origin, ...resizeNode(origin, corner, at.x, at.y) });
    }
    function up(ev: PointerEvent) {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
      const at = point(ev);
      if (at) {
        const next = resizeNode(origin, corner, at.x, at.y);
        circuit.update((doc) => ({ ...doc, nodes: doc.nodes.map((item) => (item.id === origin.id ? { ...item, ...next } : item)) }));
      }
      onDraft(null);
    }
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
  }

  const union = selected.reduce<{ left: number; top: number; right: number; bottom: number } | null>((box, node) => {
    const at = screen(node);
    const right = at.left + at.width;
    const bottom = at.top + at.height;
    if (!box) return { left: at.left, top: at.top, right, bottom };
    return { left: Math.min(box.left, at.left), top: Math.min(box.top, at.top), right: Math.max(box.right, right), bottom: Math.max(box.bottom, bottom) };
  }, null);

  return (
    <div className="cwb-sel" aria-hidden={selected.length === 0}>
      {hover ? <Frame box={screen(hover)} kind="hover" /> : null}
      {selected.map((node) => (
        <Frame key={node.id} box={screen(node)} kind="on" locked={node.locked} handles={selected.length === 1 && !node.locked} onHandle={(event, corner) => onHandleDown(event, node, corner)} onRotate={() => circuit.update((doc) => ({ ...doc, nodes: doc.nodes.map((item) => item.id === node.id ? { ...item, rotation: ((item.rotation ?? 0) + 1) % 4 } : item) }))} />
      ))}
      {union && selected.length > 0 ? (
        <Toolbar
          box={union}
          nodes={selected}
          circuit={circuit}
          onToggleProps={onToggleProps}
          onMenu={(x, y) => {
            const id = selected[0]?.id;
            if (id) onMenu({ x, y, kind: "node", id });
          }}
          onBlocked={onBlocked}
        />
      ) : null}
      {renameId ? <Rename circuit={circuit} id={renameId} onRename={onRename} onCancel={onCancelRename} /> : null}
    </div>
  );
}

function Frame({
  box, kind, locked, handles, onHandle, onRotate,
}: {
  box: { left: number; top: number; width: number; height: number };
  kind: "on" | "hover";
  locked?: boolean;
  handles?: boolean;
  onHandle?: (event: React.PointerEvent<HTMLButtonElement>, corner: ResizeCorner) => void;
  onRotate?: () => void;
}) {
  return (
    <div className={`cwb-frame ${kind}`} style={{ left: box.left, top: box.top, width: box.width, height: box.height }}>
      {locked ? <i className="cwb-lock" title="Position locked">Lock</i> : null}
      {handles ? (
        <>
          <button type="button" className="cwb-rot" title="Rotate 90°" aria-label="Rotate" style={{ left: box.width / 2 - 8, top: -28 }} onClick={onRotate}>↻</button>
          {(["nw", "ne", "sw", "se"] as const).map((corner) => (
            <button key={corner} type="button" className={`cwb-handle ${corner}`} data-corner={corner} aria-label={`Resize ${corner}`} onPointerDown={(event) => onHandle?.(event, corner)} />
          ))}
        </>
      ) : null}
    </div>
  );
}

function Toolbar({
  box, nodes, circuit,   onToggleProps, onMenu, onBlocked,
}: {
  box: { left: number; top: number; right: number; bottom: number };
  nodes: CircuitNode[];
  circuit: CircuitSession;
  onToggleProps: () => void;
  onMenu: (x: number, y: number) => void;
  onBlocked: (id: string, count: number) => void;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState({ left: Math.max(8, box.left), top: Math.max(8, box.top - 40) });
  useLayoutEffect(() => {
    const node = barRef.current;
    const host = node?.parentElement;
    if (!node || !host) return;
    const width = node.offsetWidth;
    const height = node.offsetHeight;
    const maxLeft = Math.max(8, host.clientWidth - width - 8);
    const left = Math.min(Math.max(8, box.left), maxLeft);
    const below = box.top < height + 12;
    const desiredTop = below ? box.bottom + 8 : box.top - height - 8;
    const maxTop = Math.max(8, host.clientHeight - height - 8);
    const top = Math.min(Math.max(8, desiredTop), maxTop);
    setPlace((current) => (current.left === left && current.top === top ? current : { left, top }));
  }, [box.left, box.top, box.right, box.bottom, nodes]);
  const one = nodes.length === 1 ? nodes[0] : undefined;
  const spec = one ? getComponent(one.type) : undefined;
  const inputs = one && spec?.params.some((param) => param.id === "inputs") ? Number(one.params.inputs ?? 2) : null;
  return (
    <div ref={barRef} className="cwb-bar" style={{ left: place.left, top: place.top }} role="toolbar" aria-label="Selection">
      <button type="button" title="Properties" aria-label="Properties" onClick={onToggleProps}>▤</button>
      {inputs !== null && one ? (
        <span className="cwb-step" title="Input count">
          <button type="button" aria-label="Fewer inputs" onClick={() => setInputs(circuit, one, Math.max(2, inputs - 1), onBlocked)}>−</button>
          {inputs}
          <button type="button" aria-label="More inputs" onClick={() => setInputs(circuit, one, Math.min(8, inputs + 1), onBlocked)}>+</button>
        </span>
      ) : null}
      <button type="button" title="Rotate 90°" aria-label="Rotate selection" onClick={() => circuit.update((doc) => ({ ...doc, nodes: doc.nodes.map((node) => nodes.some((item) => item.id === node.id) ? { ...node, rotation: ((node.rotation ?? 0) + 1) % 4 } : node) }))}>↻</button>
      <button type="button" title="Duplicate (Ctrl+D)" aria-label="Duplicate" onClick={() => circuit.duplicate()}>⧉</button>
      <button type="button" title="Delete" aria-label="Delete selection" onClick={() => circuit.removeSelection()}>×</button>
      <button type="button" title="More" aria-label="More selection actions" onClick={(event) => onMenu(event.clientX, event.clientY)}>•••</button>
    </div>
  );
}

function setInputs(circuit: CircuitSession, node: CircuitNode, count: number, onBlocked: (id: string, count: number) => void) {
  const dropped = wiresDropped(circuit.doc, node.id, { inputs: count });
  if (dropped.length > 0) {
    onBlocked(node.id, count);
    return;
  }
  circuit.update((doc) => ({
    ...doc,
    nodes: doc.nodes.map((item) => (item.id === node.id ? { ...item, params: { ...item.params, inputs: count } } : item)),
  }));
}

function Rename({ circuit, id, onRename, onCancel }: { circuit: CircuitSession; id: string; onRename: (id: string, label: string) => void; onCancel: () => void }) {
  const node = circuit.doc.nodes.find((item) => item.id === id);
  const [value, setValue] = useState(node?.label ?? "");
  if (!node) return null;
  const frame = nodeFrame(node);
  const zoom = circuit.view.zoom;
  return (
    <input
      className="cwb-rename"
      aria-label="Component name"
      autoFocus
      maxLength={16}
      value={value}
      style={{ left: circuit.view.x + frame.x * zoom, top: circuit.view.y + frame.y * zoom - 22 }}
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => onRename(id, value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") { event.preventDefault(); onRename(id, value); }
        if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onCancel(); }
      }}
    />
  );
}
