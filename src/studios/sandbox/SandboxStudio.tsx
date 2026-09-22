import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { ArchitectureFrame, ArchitectureLanding } from "../../layout/ArchitectureFrame";
import { Button, Card, Segmented } from "../../design-system/ui";
import { GATE_PALETTE, MEMORY_PALETTE, MULTI_PALETTE, CPU_PALETTE, PALETTE, emptyDesign, type CpuDesign, type NodeKind } from "../../engines/builder/model";
import { evaluateGraph, resetCpu, sandboxCacheAccess, sandboxCoherence, stepClock, stepInstruction, type WaveSample } from "../../engines/builder/sim";
import { SANDBOX_TEMPLATES, type SandboxMode } from "../../engines/builder/templates";
import { ArchCanvas, applyConnect, applyDeleteWire, applyDrop, applyMove } from "../shared/ArchCanvas";
import type { MesiState } from "../../engines/arch/coherence";
import type { CacheMachine } from "../../engines/cache/cache";

function paletteFor(mode: SandboxMode) {
  if (mode === "circuit") return GATE_PALETTE;
  if (mode === "memory") return MEMORY_PALETTE;
  if (mode === "multicore") return MULTI_PALETTE;
  if (mode === "cpu") return CPU_PALETTE;
  return PALETTE.filter((item) => item.group === "Registers" || item.group === "Processing" || item.group === "Routing" || item.group === "Observation");
}

function modeFromLab(lab: string): SandboxMode {
  if (lab === "circuit") return "circuit";
  if (lab === "memory") return "memory";
  if (lab === "multicore") return "multicore";
  if (lab === "cpu") return "cpu";
  return "datapath";
}

export function SandboxStudio() {
  const { labId } = useParams();
  const lab = labId ?? "overview";
  const [mode, setMode] = useState<SandboxMode>("circuit");
  const [design, setDesign] = useState<CpuDesign>(() => SANDBOX_TEMPLATES[0]?.build() ?? emptyDesign("Sandbox"));
  const [selected, setSelected] = useState<string[]>([]);
  const [clock, setClock] = useState<0 | 1>(0);
  const [error, setError] = useState<string | null>(null);
  const [cache, setCache] = useState<CacheMachine | null>(null);
  const [mesi, setMesi] = useState<MesiState[]>(["I", "I"]);
  const [wave, setWave] = useState<WaveSample[]>([]);
  const [hitNote, setHitNote] = useState("No cache access yet.");
  const view = useMemo(() => evaluateGraph(design), [design]);
  const selectedNode = design.nodes.find((node) => node.id === selected[0]);
  const palette = paletteFor(lab === "library" || lab === "overview" ? mode : modeFromLab(lab));

  useEffect(() => {
    if (lab === "circuit" || lab === "datapath" || lab === "memory" || lab === "cpu" || lab === "multicore") {
      setMode(modeFromLab(lab));
    }
  }, [lab]);

  function tick() {
    const nextClock = clock ? 0 : 1;
    let next = stepClock(design, nextClock, clock);
    if (mode === "cpu" && nextClock === 1) next = stepInstruction(next, 1).design;
    setDesign(next);
    setClock(nextClock as 0 | 1);
    setWave((items) => [...items, { cycle: items.length, clock: nextClock, values: { clock: nextClock } }].slice(-64));
  }

  const workspace = (
    <div className="cpu-workspace">
      <div className="cpu-toolbar" role="toolbar" aria-label="Sandbox">
        <Segmented options={["circuit", "datapath", "memory", "cpu", "multicore"]} value={mode} onChange={(value) => setMode(value as SandboxMode)} />
        <Button onClick={tick}>Step clock</Button>
        <Button onClick={() => { setDesign(resetCpu(design)); setClock(0); setWave([]); }}>Reset</Button>
        <Button onClick={() => setDesign({ ...design, pan: { x: 0, y: 0, k: 1 } })}>Fit view</Button>
      </div>
      <div className="builder">
        <aside className="card palette">
          <h3>{mode} library</h3>
          <div className="palette-grid">
            {palette.map((item) => (
              <button key={item.kind} type="button" className="palette-item" draggable onDragStart={(event) => event.dataTransfer.setData("kind", item.kind)} aria-label={`Add ${item.label}`}>
                {item.label}
              </button>
            ))}
          </div>
        </aside>
        <ArchCanvas
          design={design}
          selected={selected}
          overlay="both"
          onSelect={setSelected}
          onMove={(id, x, y) => setDesign(applyMove(design, id, x, y))}
          onConnect={(from, port, to, toPort) => {
            const linked = applyConnect(design, from, port, to, toPort);
            if (linked.error) setError(linked.error);
            else setDesign(linked.design);
          }}
          onDeleteWire={(id) => setDesign(applyDeleteWire(design, id))}
          onDropKind={(kind: NodeKind, x, y) => setDesign(applyDrop(design, kind, x, y))}
          onPan={(pan) => setDesign({ ...design, pan })}
        />
        <aside className="card">
          <h3>Live inspector</h3>
          {selectedNode ? (
            <div>
              <p><strong>{selectedNode.name}</strong> · {selectedNode.kind}</p>
              <p className="tiny">Width {selectedNode.width} · value {selectedNode.value} · {view.values.get(`${selectedNode.id}:q`) ?? view.values.get(`${selectedNode.id}:y`) ?? "no live output"}</p>
            </div>
          ) : <p className="muted">No component selected. Select a component to inspect its properties.</p>}
          {error ? <p className="status miss" style={{ fontSize: 14 }}>{error}</p> : null}
        </aside>
      </div>
    </div>
  );

  return (
    <ArchitectureFrame studioId="sandbox" onReset={() => { setDesign(SANDBOX_TEMPLATES[0]?.build() ?? emptyDesign()); setCache(null); setMesi(["I", "I"]); }}>
      {lab === "overview" ? <ArchitectureLanding studioId="sandbox" /> : null}
      {lab === "circuit" || lab === "datapath" || lab === "cpu" || lab === "library" ? workspace : null}
      {lab === "memory" ? (
        <div>
          {workspace}
          <Card title="Cache access">
            <div className="row">
              <Button onClick={() => {
                const result = sandboxCacheAccess(cache, 16, "read");
                setCache(result.machine);
                setHitNote(result.hit ? `Hit: ${result.explain}` : `Miss: ${result.explain}`);
              }}>Read 16</Button>
              <Button onClick={() => {
                const result = sandboxCacheAccess(cache, 48, "read");
                setCache(result.machine);
                setHitNote(result.hit ? `Hit: ${result.explain}` : `Miss: ${result.explain}`);
              }}>Read 48</Button>
            </div>
            <p>{hitNote}</p>
          </Card>
        </div>
      ) : null}
      {lab === "multicore" ? (
        <div>
          {workspace}
          <Card title="MESI">
            <p className="tiny">C0={mesi[0]} · C1={mesi[1]}</p>
            <div className="row">
              <Button onClick={() => setMesi(sandboxCoherence(mesi, 0, "read").states)}>Core0 read</Button>
              <Button onClick={() => setMesi(sandboxCoherence(mesi, 0, "write").states)}>Core0 write</Button>
              <Button onClick={() => setMesi(sandboxCoherence(mesi, 1, "read").states)}>Core1 read</Button>
            </div>
          </Card>
        </div>
      ) : null}
      {lab === "probes" || lab === "history" ? (
        <Card title="Waveform">
          {wave.length === 0 ? <p className="muted">No signals are being monitored. Step the clock to begin.</p> : <p className="tiny">{wave.length} samples (bounded).</p>}
          {workspace}
        </Card>
      ) : null}
      {lab === "breaks" ? (
        <Card title="Breakpoints">
          <p className="muted">This mode pauses on cache miss and on memory writes when those components are present.</p>
          {workspace}
        </Card>
      ) : null}
      {lab === "templates" ? (
        <div className="grid cards-3">
          {SANDBOX_TEMPLATES.map((item) => (
            <Card key={item.id} title={item.title}>
              <p className="muted">{item.description}</p>
              <p className="tiny">{item.mode}</p>
              <Button variant="primary" onClick={() => { setDesign(item.build()); setMode(item.mode); }}>Open in sandbox</Button>
            </Card>
          ))}
        </div>
      ) : null}
    </ArchitectureFrame>
  );
}

export default SandboxStudio;
