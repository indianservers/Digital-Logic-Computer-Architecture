import { useEffect, useMemo, useState } from "react";
import { Button } from "../../design-system/ui";
import { addNode, connect, deleteNodes, deleteWire, duplicateNodes, emptyDoc, evaluate, moveNode, portsOf, signalText, TEMPLATES, type CanvasType, type CircuitDoc, type CircuitNode } from "../../engines/digital/circuit";
import { toHex, toSigned, toUnsigned } from "../../engines/digital/vector";
import { deleteProject, listProjects, saveProject, type SavedProject } from "../../store/projects";
import { WordEditor } from "../shared/widgets";

const PALETTE: Array<{ type: CanvasType; label: string; group: string }> = [
  { group: "Inputs", type: "TOGGLE", label: "Toggle" },
  { group: "Inputs", type: "BUTTON", label: "Button" },
  { group: "Inputs", type: "CONST", label: "Constant" },
  { group: "Inputs", type: "BUS", label: "4-bit bus" },
  { group: "Inputs", type: "CLOCK", label: "Clock" },
  { group: "Gates", type: "AND", label: "AND" },
  { group: "Gates", type: "OR", label: "OR" },
  { group: "Gates", type: "NOT", label: "NOT" },
  { group: "Gates", type: "NAND", label: "NAND" },
  { group: "Gates", type: "NOR", label: "NOR" },
  { group: "Gates", type: "XOR", label: "XOR" },
  { group: "Gates", type: "XNOR", label: "XNOR" },
  { group: "Arithmetic", type: "HA", label: "Half adder" },
  { group: "Arithmetic", type: "FA", label: "Full adder" },
  { group: "Arithmetic", type: "ADD4", label: "4-bit adder" },
  { group: "Arithmetic", type: "CMP4", label: "Compare" },
  { group: "Routing", type: "MUX2", label: "MUX 2:1" },
  { group: "Routing", type: "MUX4", label: "MUX 4:1" },
  { group: "Routing", type: "DEC2", label: "Decoder 2:4" },
  { group: "Sequential", type: "DLATCH", label: "D latch" },
  { group: "Sequential", type: "DFF", label: "D flip-flop" },
  { group: "Sequential", type: "JKFF", label: "JK flip-flop" },
  { group: "Sequential", type: "REG4", label: "4-bit register" },
  { group: "Outputs", type: "LED", label: "LED" },
  { group: "Outputs", type: "HEX", label: "Hex" },
  { group: "Outputs", type: "PROBE", label: "Probe" },
];

function heightOf(node: CircuitNode): number {
  const inputs = portsOf(node).filter((port) => port.dir === "in").length;
  return Math.max(52, 18 + Math.max(1, inputs) * 18);
}

function portPoint(node: CircuitNode, portId: string, dir: "in" | "out"): { x: number; y: number } {
  const ports = portsOf(node).filter((port) => port.dir === dir);
  const index = Math.max(0, ports.findIndex((port) => port.id === portId));
  return { x: node.x + (dir === "out" ? 128 : 0), y: node.y + 20 + index * 18 };
}

export function CanvasLab() {
  const [doc, setDoc] = useState<CircuitDoc>(() => TEMPLATES[0]?.build() ?? emptyDoc());
  const [past, setPast] = useState<CircuitDoc[]>([]);
  const [future, setFuture] = useState<CircuitDoc[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [clock, setClock] = useState<0 | 1>(0);
  const [prevClock, setPrevClock] = useState<0 | 1>(0);
  const [draft, setDraft] = useState<{ x: number; y: number; from: string; port: string } | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0, k: 1 });
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [name, setName] = useState("Untitled circuit");
  const [held, setHeld] = useState<string | null>(null);

  const view = useMemo(() => evaluate(doc, clock, prevClock), [doc, clock, prevClock]);

  function commit(next: CircuitDoc) {
    setPast((items) => [...items, doc].slice(-40));
    setFuture([]);
    setDoc(next);
    setError(null);
  }

  function undo() {
    const previous = past[past.length - 1];
    if (!previous) return;
    setPast((items) => items.slice(0, -1));
    setFuture((items) => [doc, ...items]);
    setDoc(previous);
  }

  function redo() {
    const next = future[0];
    if (!next) return;
    setFuture((items) => items.slice(1));
    setPast((items) => [...items, doc]);
    setDoc(next);
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Delete" || event.key === "Backspace") {
        if (selected.length === 0) return;
        if ((event.target as HTMLElement).tagName === "INPUT") return;
        event.preventDefault();
        commit(deleteNodes(doc, selected));
        setSelected([]);
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        undo();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") {
        event.preventDefault();
        if (selected.length) commit(duplicateNodes(doc, selected));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    void listProjects().then(setProjects).catch(() => setProjects([]));
  }, []);

  const groups = [...new Set(PALETTE.map((item) => item.group))];
  const selectedNode = doc.nodes.find((node) => node.id === selected[0]);

  return (
    <div className="builder">
      <aside className="card palette">
        <h3>Components</h3>
        {groups.map((group) => (
          <div key={group}>
            <div className="tiny">{group}</div>
            <div className="palette-grid">
              {PALETTE.filter((item) => item.group === group).map((item) => (
                <button key={item.type + item.label} className="palette-item" draggable onDragStart={(event) => event.dataTransfer.setData("component", item.type)}>{item.label}</button>
              ))}
            </div>
          </div>
        ))}
        <div className="tiny">Templates</div>
        {TEMPLATES.map((template) => (
          <button key={template.id} className="btn-ghost" onClick={() => commit(template.build())}>{template.name}</button>
        ))}
      </aside>
      <div className="card canvas-card">
        <div className="spread">
          <strong>Circuit canvas</strong>
          <div className="row">
            <Button onClick={() => { const next = clock === 0 ? 1 : 0; setPrevClock(clock); setClock(next); }}>Step clock</Button>
            <Button onClick={() => { setClock(0); setPrevClock(0); }}>Reset sim</Button>
            <Button onClick={undo}>Undo</Button>
            <Button onClick={redo}>Redo</Button>
            <Button onClick={() => selected.length && commit(duplicateNodes(doc, selected))}>Duplicate</Button>
            <Button onClick={() => { commit(deleteNodes(doc, selected)); setSelected([]); }}>Delete</Button>
            <Button onClick={() => setPan((p) => ({ ...p, k: Math.min(1.8, p.k + 0.1) }))}>+</Button>
            <Button onClick={() => setPan((p) => ({ ...p, k: Math.max(0.6, p.k - 0.1) }))}>−</Button>
            <span className="tiny">{Math.round(pan.k * 100)}%</span>
          </div>
        </div>
        {view.warning ? <p className="callout">{view.warning}</p> : null}
        {error ? <p className="tiny">{error}</p> : null}
        <svg
          className="canvas"
          viewBox={`${-pan.x} ${-pan.y} ${760 / pan.k} ${460 / pan.k}`}
          tabIndex={0}
          aria-label="Circuit canvas"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            const type = event.dataTransfer.getData("component") as CanvasType;
            if (!type) return;
            const rect = event.currentTarget.getBoundingClientRect();
            const x = ((event.clientX - rect.left) / rect.width) * (760 / pan.k) - pan.x;
            const y = ((event.clientY - rect.top) / rect.height) * (460 / pan.k) - pan.y;
            commit(addNode(doc, type, x, y));
          }}
          onPointerDown={(event) => {
            if (event.target !== event.currentTarget) return;
            const startX = event.clientX;
            const startY = event.clientY;
            const origin = { ...pan };
            const move = (ev: PointerEvent) => setPan({ ...origin, x: origin.x + (ev.clientX - startX) / pan.k, y: origin.y + (ev.clientY - startY) / pan.k });
            const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
            window.addEventListener("pointermove", move);
            window.addEventListener("pointerup", up);
          }}
          onPointerUp={() => setDraft(null)}
          onPointerMove={(event) => {
            if (!draft) return;
            const rect = event.currentTarget.getBoundingClientRect();
            setDraft({ ...draft, x: ((event.clientX - rect.left) / rect.width) * (760 / pan.k) - pan.x, y: ((event.clientY - rect.top) / rect.height) * (460 / pan.k) - pan.y });
          }}
        >
          {doc.wires.map((wire) => {
            const source = doc.nodes.find((node) => node.id === wire.from);
            const sink = doc.nodes.find((node) => node.id === wire.to);
            if (!source || !sink) return null;
            const a = portPoint(source, wire.fromPort, "out");
            const b = portPoint(sink, wire.toPort, "in");
            const mid = (a.x + b.x) / 2;
            const value = view.signals[`${wire.from}.${wire.fromPort}`];
            const level = value?.[0];
            const cls = level === 1 ? "wire high" : level === "Z" ? "wire z" : level === "X" ? "wire x" : "wire low";
            return <path key={wire.id} className={cls} d={`M ${a.x} ${a.y} H ${mid} V ${b.y} H ${b.x}`} onClick={() => commit(deleteWire(doc, wire.id))}><title>{signalText(value)}</title></path>;
          })}
          {draft ? <path className="wire" d={`M ${portPoint(doc.nodes.find((node) => node.id === draft.from) ?? { id: "", type: "LED", x: 0, y: 0, bits: [] }, draft.port, "out").x} ${portPoint(doc.nodes.find((node) => node.id === draft.from) ?? { id: "", type: "LED", x: 0, y: 0, bits: [] }, draft.port, "out").y} L ${draft.x} ${draft.y}`} /> : null}
          {doc.nodes.map((node) => {
            const h = heightOf(node);
            const active = selected.includes(node.id);
            return (
              <g key={node.id} transform={`translate(${node.x} ${node.y})`} onPointerDown={(event) => {
                event.stopPropagation();
                setSelected((current) => event.shiftKey ? (current.includes(node.id) ? current : [...current, node.id]) : [node.id]);
                const startX = event.clientX;
                const startY = event.clientY;
                const origin = { x: node.x, y: node.y };
                const move = (ev: PointerEvent) => {
                  const dx = (ev.clientX - startX) / pan.k;
                  const dy = (ev.clientY - startY) / pan.k;
                  setDoc(moveNode(doc, node.id, origin.x + dx, origin.y + dy));
                };
                const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
                window.addEventListener("pointermove", move);
                window.addEventListener("pointerup", up);
              }}>
                <rect width="128" height={h} rx="12" fill={active ? "#eef4ff" : "white"} stroke={active ? "#2F6FED" : "#d7e1ee"} />
                <text x="64" y="14" textAnchor="middle" fontSize="11" fontWeight="700" fill="#122033">{node.type}</text>
                {portsOf(node).map((port) => {
                  const local = portPoint({ ...node, x: 0, y: 0 }, port.id, port.dir);
                  const shown = view.signals[`${node.id}.${port.id}`];
                  return (
                    <g key={port.id}>
                      <circle
                        cx={local.x}
                        cy={local.y}
                        r="5"
                        fill={shown?.[0] === 1 ? "#2F6FED" : "white"}
                        stroke="#2F6FED"
                        onPointerDown={(event) => {
                          event.stopPropagation();
                          if (port.dir === "out") setDraft({ x: node.x + local.x, y: node.y + local.y, from: node.id, port: port.id });
                        }}
                        onPointerUp={(event) => {
                          event.stopPropagation();
                          if (port.dir === "in" && draft) {
                            const linked = connect(doc, draft.from, draft.port, node.id, port.id);
                            if (linked.error) setError(linked.error);
                            else commit(linked.doc);
                            setDraft(null);
                          }
                        }}
                      >
                        <title>{port.name} {signalText(shown)}{port.width > 1 ? ` · ${port.width} bits` : ""}</title>
                      </circle>
                      <text x={port.dir === "out" ? local.x - 8 : local.x + 8} y={local.y + 3} fontSize="9" textAnchor={port.dir === "out" ? "end" : "start"} fill="#667085">{port.name}</text>
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>
      <aside className="card">
        <h3>Output analysis</h3>
        <p className="tiny">Clock is {clock}. Probes update from the wires, not from a scripted answer.</p>
        {doc.nodes.filter((node) => node.type === "LED" || node.type === "PROBE" || node.type === "HEX").map((node) => {
          const port = node.type === "HEX" ? "D" : "A";
          const bits = view.signals[`${node.id}.${port}`] ?? [];
          return (
            <div key={node.id} className="metric" style={{ marginBottom: 8 }}>
              <span>{node.type}</span>
              <b>{signalText(bits)} · {toUnsigned(bits) ?? "X"} · {toHex(bits)} · signed {toSigned(bits) ?? "X"}</b>
            </div>
          );
        })}
        {selectedNode && (selectedNode.type === "TOGGLE" || selectedNode.type === "CONST" || selectedNode.type === "BUTTON") ? (
          <Button onClick={() => {
            const bits = selectedNode.bits[0] === 1 ? [0] : [1];
            if (selectedNode.type === "BUTTON") setHeld(selectedNode.id);
            commit({ ...doc, nodes: doc.nodes.map((node) => node.id === selectedNode.id ? { ...node, bits: bits as CircuitNode["bits"] } : node) });
          }}>{selectedNode.type} = {selectedNode.bits[0] === 1 ? 1 : 0}</Button>
        ) : null}
        {selectedNode?.type === "BUTTON" && held === selectedNode.id ? (
          <Button onClick={() => { setHeld(null); commit({ ...doc, nodes: doc.nodes.map((node) => node.id === selectedNode.id ? { ...node, bits: [0] } : node) }); }}>Release</Button>
        ) : null}
        {selectedNode?.type === "BUS" ? (
          <WordEditor bits={selectedNode.bits.map((bit) => (bit === 1 ? 1 : 0))} onChange={(bits) => commit({ ...doc, nodes: doc.nodes.map((node) => node.id === selectedNode.id ? { ...node, bits } : node) })} />
        ) : null}
        <h3>Save on this device</h3>
        <input className="text-input" aria-label="Project name" value={name} onChange={(event) => setName(event.target.value)} />
        <div className="row" style={{ marginTop: 8 }}>
          <Button variant="primary" onClick={() => {
            const project = { id: crypto.randomUUID(), name, doc, updated: Date.now() };
            void saveProject(project).then(() => listProjects().then(setProjects));
          }}>Save</Button>
        </div>
        {projects.map((project) => (
          <div key={project.id} className="spread" style={{ marginTop: 8 }}>
            <button className="btn-ghost" onClick={() => { setDoc(project.doc); setName(project.name); }}>{project.name}</button>
            <button className="btn-ghost" onClick={() => {
              const copy = { ...project, id: crypto.randomUUID(), name: `${project.name} copy`, updated: Date.now() };
              void saveProject(copy).then(() => listProjects().then(setProjects));
            }}>Duplicate</button>
            <button className="btn-ghost" onClick={() => void deleteProject(project.id).then(() => listProjects().then(setProjects))}>Delete</button>
          </div>
        ))}
      </aside>
    </div>
  );
}
