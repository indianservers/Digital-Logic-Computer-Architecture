import { useState, type ReactNode } from "react";
import { alignNodes, disconnectNode, patchNode, patchWire, sizedBox, wiresDropped, type AlignMode } from "./engine";
import { componentTruth, getComponent, nodeSize } from "./registry";
import type { Bit, CircuitNode, CircuitWire, ParamSpec } from "./types";
import type { CircuitSession } from "./useCircuit";

export function PropertiesPane({
  circuit,
  open,
  onToggle,
  wireId,
  onFocusWire,
  pending,
  onPending,
  onClearPending,
  docked = false,
}: {
  circuit: CircuitSession;
  open: boolean;
  onToggle: () => void;
  wireId: string | null;
  onFocusWire: (id: string | null) => void;
  pending: { id: string; count: number; key?: string } | null;
  onPending: (id: string, count: number, key?: string) => void;
  onClearPending: () => void;
  docked?: boolean;
}) {
  const nodes = circuit.doc.nodes.filter((node) => circuit.selected.includes(node.id));
  const wire = circuit.doc.wires.find((item) => item.id === wireId) ?? null;
  const shown = docked || open;
  return (
    <aside className={`cwb-props ${shown ? "open" : ""} ${docked ? "docked" : ""}`} aria-label="Properties">
      {docked ? null : <button type="button" className="cwb-props-tab" onClick={onToggle}>{open ? "Properties ‹" : "Properties ›"}</button>}
      {shown ? (
        <div className="cwb-props-body">
          {wire && nodes.length === 0 ? <WireCard circuit={circuit} wire={wire} onFocusWire={onFocusWire} /> : null}
          {nodes.length === 1 && nodes[0] ? <NodeCard circuit={circuit} node={nodes[0]} onFocusWire={onFocusWire} pending={pending?.id === nodes[0].id ? pending : null} onPending={onPending} onClearPending={onClearPending} /> : null}
          {nodes.length > 1 ? <GroupCard circuit={circuit} nodes={nodes} /> : null}
          {nodes.length === 0 && !wire ? <p className="tiny">Select a component or a wire.</p> : null}
        </div>
      ) : null}
    </aside>
  );
}

function NodeCard({
  circuit, node, onFocusWire, pending, onPending, onClearPending,
}: {
  circuit: CircuitSession;
  node: CircuitNode;
  onFocusWire: (id: string | null) => void;
  pending: { id: string; count: number; key?: string } | null;
  onPending: (id: string, count: number, key?: string) => void;
  onClearPending: () => void;
}) {
  const spec = getComponent(node.type);
  if (!spec) return null;
  const size = nodeSize(spec, node.params, node);
  const ports = spec.ports(node.params);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({ general: true, appearance: true, logic: true, ports: true, timing: false });
  const table = componentTruth(node.type, node.params);
  function toggle(id: string) {
    setOpen((prev) => ({ ...prev, [id]: !prev[id] }));
  }
  function edit(patch: Parameters<typeof patchNode>[2]) {
    circuit.update((doc) => patchNode(doc, node.id, patch));
  }
  return (
    <>
      <header className="cwb-props-head">
        <strong>{node.label}</strong>
        <span>{spec.displayName}</span>
      </header>
      <p className="tiny">{spec.description}</p>
      <Section title="General" open={open.general !== false} onToggle={() => toggle("general")}>
        <label>Name <input aria-label="Component name" defaultValue={node.label} key={node.label} maxLength={16} onBlur={(event) => { if (event.target.value !== node.label) edit({ label: event.target.value.slice(0, 16) }); }} /></label>
        <p className="tiny">Type {spec.displayName}</p>
        <p className="tiny">ID {node.id}</p>
        <label className="cwb-check"><input type="checkbox" checked={node.locked === true} onChange={(event) => edit({ locked: event.target.checked })} /> Lock position</label>
      </Section>
      <Section title="Appearance" open={open.appearance !== false} onToggle={() => toggle("appearance")}>
        <label>Rotation
          <select aria-label="Rotation" value={String((node.rotation ?? 0) % 4)} onChange={(event) => edit({ rotation: Number(event.target.value) })}>
            <option value="0">0°</option>
            <option value="1">90°</option>
            <option value="2">180°</option>
            <option value="3">270°</option>
          </select>
        </label>
        <label>Width <input aria-label="Width" type="number" min={48} max={480} defaultValue={Math.round(size.width)} key={`w-${Math.round(size.width)}`} onBlur={(event) => { if (!commitSize(node, event.target.value, "width", edit, setError)) event.target.value = String(Math.round(size.width)); }} /></label>
        <label>Height <input aria-label="Height" type="number" min={36} max={640} defaultValue={Math.round(size.height)} key={`h-${Math.round(size.height)}`} onBlur={(event) => { if (!commitSize(node, event.target.value, "height", edit, setError)) event.target.value = String(Math.round(size.height)); }} /></label>
        <label>Label
          <select aria-label="Label position" value={node.labelAt ?? "auto"} onChange={(event) => edit({ labelAt: event.target.value as CircuitNode["labelAt"] })}>
            {["auto", "top", "bottom", "left", "right", "inside"].map((place) => <option key={place} value={place}>{place}</option>)}
          </select>
        </label>
        <label className="cwb-check"><input type="checkbox" checked={node.showLabel !== false} onChange={(event) => edit({ showLabel: event.target.checked })} /> Show name</label>
        <label className="cwb-check"><input type="checkbox" checked={node.showPorts !== false} onChange={(event) => edit({ showPorts: event.target.checked })} /> Port names</label>
        <button type="button" onClick={() => edit({ width: 0, height: 0, rotation: 0, labelAt: "auto", showPorts: true, showLabel: true })}>Auto size</button>
        {error ? <p className="cwb-error">{error}</p> : null}
      </Section>
      {spec.params.filter((param) => param.id !== "pressed").length > 0 ? (
        <Section title="Logic" open={open.logic !== false} onToggle={() => toggle("logic")}>
          {spec.params.filter((param) => param.id !== "pressed").map((param) => (
            <ParamField key={param.id} param={param} node={node} onChange={(value) => {
              const patch = { [param.id]: value };
              if (wiresDropped(circuit.doc, node.id, patch).length > 0) onPending(node.id, Number(value), param.id);
              else { edit({ params: patch }); onClearPending(); }
            }} />
          ))}
          {pending ? (
            <p className="cwb-warn">{wiresDropped(circuit.doc, node.id, { [pending.key ?? "inputs"]: pending.count }).length} connected inputs would be removed.
              <button type="button" onClick={onClearPending}>Cancel</button>
              <button type="button" onClick={() => { const key = pending.key ?? "inputs"; circuit.update((doc) => patchNode(doc, node.id, { params: { [key]: pending.count } })); onClearPending(); }}>Disconnect and apply</button>
            </p>
          ) : null}
          {node.type === "clock" ? <p className="tiny">{circuit.playing ? "Simulator is running." : "Press Play to run this clock."} Level is {node.params.level === 1 ? "HIGH" : "LOW"}.</p> : null}
          {spec.category === "sequential" ? (
            <label>Stored Q
              <select aria-label="Stored Q" value={node.state[0] === 1 ? "1" : "0"} onChange={(event) => edit({ state: [event.target.value === "1" ? 1 : 0, node.state[1] ?? 0] })}>
                <option value="0">0</option>
                <option value="1">1</option>
              </select>
            </label>
          ) : null}
          <LiveBits circuit={circuit} node={node} ports={ports} />
          {table ? <Truth table={table} /> : null}
        </Section>
      ) : (
        <Section title="Logic" open={open.logic !== false} onToggle={() => toggle("logic")}>
          <LiveBits circuit={circuit} node={node} ports={ports} />
          {table ? <Truth table={table} /> : null}
        </Section>
      )}
      {(spec.delay > 0 || node.type === "delay") ? (
        <Section title="Timing" open={open.timing === true} onToggle={() => toggle("timing")}>
          <label>Delay (ticks)
            <input aria-label="Propagation delay" type="number" min={0} max={32} defaultValue={node.delay ?? spec.delay} key={`d-${node.delay ?? spec.delay}`} onBlur={(event) => {
              const value = Number(event.target.value);
              if (!Number.isFinite(value) || value < 0 || value > 32) setError("Delay must be from 0 to 32 ticks.");
              else { setError(""); edit({ delay: value }); }
            }} />
          </label>
          <p className="tiny">Last scheduled step {lastTime(circuit, node.id)}.</p>
        </Section>
      ) : null}
      <Section title="Ports" open={open.ports !== false} onToggle={() => toggle("ports")}>
        {ports.map((port) => {
          const wire = port.dir === "in"
            ? circuit.doc.wires.find((item) => item.to === node.id && item.toPort === port.id)
            : circuit.doc.wires.find((item) => item.from === node.id && item.fromPort === port.id);
          const other = wire ? circuit.doc.nodes.find((item) => item.id === (port.dir === "in" ? wire.from : wire.to)) : undefined;
          const bit = circuit.shown.signals[`${node.id}.${port.id}`] ?? "X";
          return (
            <p key={port.id} className="cwb-port-row">
              <button type="button" onClick={() => wire && onFocusWire(wire.id)}>{port.name} = {bit}</button>
              <span>{wire && other ? `${other.label}.${port.dir === "in" ? wire.fromPort : wire.toPort}` : "Open"}</span>
              {wire ? <button type="button" aria-label={`Disconnect ${port.name}`} onClick={() => circuit.commit({ ...circuit.doc, wires: circuit.doc.wires.filter((item) => item.id !== wire.id) })}>×</button> : null}
            </p>
          );
        })}
        <button type="button" onClick={() => circuit.update((doc) => disconnectNode(doc, node.id))}>Disconnect all</button>
      </Section>
    </>
  );
}

function ParamField({ param, node, onChange }: { param: ParamSpec; node: CircuitNode; onChange: (value: number | string) => void }) {
  const value = node.params[param.id] ?? param.default;
  if (param.kind === "number" && param.min === 0 && param.max === 1) {
    return (
      <label className="cwb-check"><input type="checkbox" checked={value === 1} onChange={(event) => onChange(event.target.checked ? 1 : 0)} /> {param.label}</label>
    );
  }
  return (
    <label>{param.label}
      <input aria-label={param.label} type="number" min={param.min} max={param.max} value={Number(value)} onChange={(event) => {
        const next = Number(event.target.value);
        if (!Number.isFinite(next)) return;
        if (param.min !== undefined && next < param.min) return;
        if (param.max !== undefined && next > param.max) return;
        onChange(next);
      }} />
    </label>
  );
}

function LiveBits({ circuit, node, ports }: { circuit: CircuitSession; node: CircuitNode; ports: Array<{ id: string; name: string }> }) {
  return (
    <ul className="cwb-bits">
      {ports.map((port) => {
        const bit = circuit.shown.signals[`${node.id}.${port.id}`] ?? "X";
        return <li key={port.id}><i className={bitClass(bit)} /> {port.name} = {bit}</li>;
      })}
    </ul>
  );
}

function Truth({ table }: { table: NonNullable<ReturnType<typeof componentTruth>> }) {
  return (
    <table className="cwb-truth">
      <thead><tr>{table.inputs.map((name) => <th key={name}>{name}</th>)}<th /></tr></thead>
      <tbody>
        {table.rows.map((row, index) => (
          <tr key={index}>{row.input.map((bit, cell) => <td key={cell}>{bit}</td>)}<td>{row.output.join(" ")}</td></tr>
        ))}
      </tbody>
    </table>
  );
}

function GroupCard({ circuit, nodes }: { circuit: CircuitSession; nodes: CircuitNode[] }) {
  const ids = nodes.map((node) => node.id);
  function align(mode: AlignMode) {
    circuit.update((doc) => alignNodes(doc, ids, mode));
  }
  const sameDelay = nodes.every((node) => (getComponent(node.type)?.delay ?? 0) > 0);
  return (
    <>
      <header className="cwb-props-head"><strong>{nodes.length} components</strong></header>
      <div className="cwb-align" role="group" aria-label="Align">
        <button type="button" onClick={() => align("left")}>Align left</button>
        <button type="button" onClick={() => align("cx")}>Align center</button>
        <button type="button" onClick={() => align("right")}>Align right</button>
        <button type="button" onClick={() => align("top")}>Align top</button>
        <button type="button" onClick={() => align("cy")}>Align middle</button>
        <button type="button" onClick={() => align("bottom")}>Align bottom</button>
        <button type="button" onClick={() => align("hgap")}>Distribute horizontal</button>
        <button type="button" onClick={() => align("vgap")}>Distribute vertical</button>
        <button type="button" onClick={() => align("width")}>Match width</button>
        <button type="button" onClick={() => align("height")}>Match height</button>
      </div>
      <label>Rotation
        <select aria-label="Group rotation" defaultValue="" onChange={(event) => {
          const rotation = Number(event.target.value);
          if (!Number.isFinite(rotation)) return;
          circuit.update((doc) => ({ ...doc, nodes: doc.nodes.map((node) => ids.includes(node.id) ? { ...node, rotation } : node) }));
        }}>
          <option value="">Multiple</option>
          <option value="0">0°</option>
          <option value="1">90°</option>
          <option value="2">180°</option>
          <option value="3">270°</option>
        </select>
      </label>
      {sameDelay ? (
        <label>Delay (ticks)
          <input aria-label="Group delay" type="number" min={0} max={32} placeholder="Multiple" onBlur={(event) => {
            const delay = Number(event.target.value);
            if (!Number.isFinite(delay) || delay < 0 || delay > 32) return;
            circuit.update((doc) => ({ ...doc, nodes: doc.nodes.map((node) => ids.includes(node.id) ? { ...node, delay } : node) }));
          }} />
        </label>
      ) : null}
    </>
  );
}

function WireCard({ circuit, wire, onFocusWire }: { circuit: CircuitSession; wire: CircuitWire; onFocusWire: (id: string | null) => void }) {
  const from = circuit.doc.nodes.find((node) => node.id === wire.from);
  const to = circuit.doc.nodes.find((node) => node.id === wire.to);
  const bit = circuit.shown.signals[`${wire.from}.${wire.fromPort}`] ?? "X";
  const net = circuit.doc.wires.filter((item) => item.from === wire.from && item.fromPort === wire.fromPort);
  return (
    <>
      <header className="cwb-props-head"><strong>{wire.name || "Wire"}</strong><span>{bit}</span></header>
      <p className="tiny">{from?.label ?? wire.from}.{wire.fromPort} → {to?.label ?? wire.to}.{wire.toPort}</p>
      <label>Net name
        <input aria-label="Net name" defaultValue={wire.name ?? ""} key={wire.name ?? ""} maxLength={16} onBlur={(event) => circuit.update((doc) => patchWire(doc, wire.id, { name: event.target.value.trim() }))} />
      </label>
      <p className="tiny">Routing is orthogonal. {net.length} load{net.length === 1 ? "" : "s"} on this driver.</p>
      <button type="button" onClick={() => onFocusWire(wire.id)}>Highlight net</button>
      <button type="button" onClick={() => circuit.commit({ ...circuit.doc, wires: circuit.doc.wires.filter((item) => item.id !== wire.id) })}>Disconnect</button>
    </>
  );
}

function Section({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <section className="cwb-sec">
      <button type="button" className="cwb-sec-bar" aria-expanded={open} onClick={onToggle}>{open ? "▾" : "▸"} {title}</button>
      {open ? <div className="cwb-sec-body">{children}</div> : null}
    </section>
  );
}

function commitSize(node: CircuitNode, text: string, key: "width" | "height", edit: (patch: { width?: number; height?: number }) => void, setError: (value: string) => void): boolean {
  const value = Number(text);
  const min = key === "width" ? 48 : 36;
  const max = key === "width" ? 480 : 640;
  if (!Number.isFinite(value) || value < min || value > max) {
    setError(`${key === "width" ? "Width" : "Height"} must be from ${min} to ${max}.`);
    return false;
  }
  setError("");
  edit(sizedBox(node, key, value));
  return true;
}

function lastTime(circuit: CircuitSession, id: string): number {
  for (let index = circuit.sim.frames.length - 1; index >= 0; index -= 1) {
    if (circuit.sim.frames[index]?.nodeId === id) return circuit.sim.frames[index]?.time ?? 0;
  }
  return 0;
}

function bitClass(bit: Bit): string {
  if (bit === 1) return "high";
  if (bit === 0) return "low";
  return "x";
}
