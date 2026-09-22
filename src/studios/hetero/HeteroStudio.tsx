import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  CAMERA_TASKS, PROCESSOR_ROLES, WORKLOADS, autoRoute, interconnect, memoryModel, offload, schedule, syncTimeline,
  type Assignment, type Processor,
} from "../../engines/hetero/hetero";
import { ArchitectureFrame, ArchitectureLanding } from "../../layout/ArchitectureFrame";
import { Button, Card, Metric, Segmented } from "../../design-system/ui";

const UNITS: Processor[] = ["CPU", "GPU", "NPU", "DSP"];

export function HeteroStudio() {
  const { labId } = useParams();
  const lab = labId ?? "overview";
  const [focus, setFocus] = useState<Processor>("CPU");
  const [manual, setManual] = useState<Assignment[]>(WORKLOADS.map((item) => ({ id: item.id, unit: item.recommended })));
  const [camera, setCamera] = useState<Assignment[]>(CAMERA_TASKS.map((item) => ({ id: item.id, unit: item.recommended })));
  const [payload, setPayload] = useState(8);
  const [accel, setAccel] = useState(12);
  const [model, setModel] = useState<"separate" | "unified">("separate");
  const [traffic, setTraffic] = useState<Processor[]>([]);
  const [sync, setSync] = useState(0);

  const queues = useMemo(() => schedule(manual), [manual]);
  const camQueues = useMemo(() => schedule(camera), [camera]);
  const cost = offload(payload, accel);
  const mem = memoryModel(model);
  const fabric = interconnect(traffic.map((from, index) => ({ id: String(index), from, size: 4 })));
  const timeline = syncTimeline();

  return (
    <ArchitectureFrame studioId="hetero" onReset={() => { setManual(WORKLOADS.map((item) => ({ id: item.id, unit: item.recommended }))); setCamera(CAMERA_TASKS.map((item) => ({ id: item.id, unit: item.recommended }))); setTraffic([]); setSync(0); }}>
      {lab === "overview" ? <ArchitectureLanding studioId="hetero" /> : null}

      {lab === "roles" ? (
        <div className="grid cards-2">
          <Card title="Processors">
            <div className="cpu-grid">
              {UNITS.map((unit) => (
                <button key={unit} className={focus === unit ? "cpu-block on" : "cpu-block"} onClick={() => setFocus(unit)}>{unit}</button>
              ))}
            </div>
          </Card>
          <Card title={`${focus} role`}>
            <ul className="muted">{PROCESSOR_ROLES[focus].strengths.map((item) => <li key={item}>{item}</li>)}</ul>
            <p>{PROCESSOR_ROLES[focus].typical}</p>
          </Card>
        </div>
      ) : null}

      {lab === "router" ? (
        <div className="grid cards-2">
          <Card title="Manual assignment" action={<Button onClick={() => setManual(WORKLOADS.map((item) => ({ id: item.id, unit: autoRoute(item.id).unit })))}>Auto route</Button>}>
            {WORKLOADS.map((work) => {
              const assignment = manual.find((item) => item.id === work.id);
              const why = autoRoute(work.id);
              return (
                <div key={work.id} className="spread" style={{ marginBottom: 8 }}>
                  <span>{work.name}</span>
                  <select aria-label={`Assign ${work.name}`} value={assignment?.unit ?? "CPU"} onChange={(event) => setManual((list) => list.map((item) => item.id === work.id ? { ...item, unit: event.target.value as Processor } : item))}>
                    {UNITS.map((unit) => <option key={unit}>{unit}</option>)}
                  </select>
                  <span className="tiny">{why.unit}: {why.reason}</span>
                </div>
              );
            })}
          </Card>
          <Card title="Queues (educational)">
            {queues.map((queue) => (
              <div key={queue.unit} className="metric" style={{ marginBottom: 8 }}>
                <span>{queue.unit} · {queue.jobs.length} jobs</span>
                <b>time {queue.time} · energy {queue.energy} · util {queue.utilization}%</b>
                <div className="tiny">{queue.jobs.join(", ") || "idle"}</div>
              </div>
            ))}
            <p className="tiny">Time, energy, and utilization are conceptual teaching units, not physical measurements.</p>
          </Card>
        </div>
      ) : null}

      {lab === "partition" || lab === "timeline" ? (
        <Card title="Camera app partitioning">
          {CAMERA_TASKS.map((task) => (
            <div key={task.id} className="spread" style={{ marginBottom: 8 }}>
              <span>{task.name}</span>
              <select aria-label={`Assign ${task.name}`} value={camera.find((item) => item.id === task.id)?.unit ?? "CPU"} onChange={(event) => setCamera((list) => list.map((item) => item.id === task.id ? { ...item, unit: event.target.value as Processor } : item))}>
                {UNITS.map((unit) => <option key={unit}>{unit}</option>)}
              </select>
            </div>
          ))}
          <div className="grid cards-4">
            {camQueues.map((queue) => <Metric key={queue.unit} label={queue.unit} value={queue.jobs.join(", ") || "idle"} />)}
          </div>
        </Card>
      ) : null}

      {lab === "offload" ? (
        <Card title="CPU prepares → transfer → accelerator → sync → CPU continues">
          <label className="field">Transfer size (words)<input type="range" min={1} max={40} value={payload} onChange={(event) => setPayload(Number(event.target.value))} /></label>
          <label className="field">Accelerator cycles<input type="range" min={1} max={40} value={accel} onChange={(event) => setAccel(Number(event.target.value))} /></label>
          <div className="row">
            <Metric label="Setup" value={String(cost.setup)} />
            <Metric label="Transfer" value={String(cost.transfer)} />
            <Metric label="Compute" value={String(cost.compute)} />
            <Metric label="Offload total" value={String(cost.total)} />
            <Metric label="CPU-only" value={String(cost.cpuOnly)} />
          </div>
          <p className="muted">{cost.transferDominates ? "Transfer overhead dominates this small workload." : "Compute is large enough that offload can pay for the copy."}</p>
        </Card>
      ) : null}

      {lab === "memory" || lab === "unified" ? (
        <Card title={mem.copy ? "Separate memory model" : "Shared / unified conceptual model"}>
          <Segmented options={["separate", "unified"]} value={model} onChange={(value) => setModel(value as typeof model)} />
          <div className="row" style={{ marginTop: 12 }}>
            <div className="cpu-block">{mem.left}</div>
            <strong>{mem.copy ? "↕ Copy" : "↔"}</strong>
            <div className="cpu-block">{mem.right}</div>
          </div>
          <p className="muted">{mem.note}</p>
        </Card>
      ) : null}

      {lab === "interconnect" ? (
        <Card title="System interconnect">
          <div className="row">
            {UNITS.map((unit) => <Button key={unit} onClick={() => setTraffic((list) => [...list, unit])}>{unit} request</Button>)}
            <Button onClick={() => setTraffic([])}>Clear</Button>
          </div>
          <p>Total traffic {fabric.total}. Contention: {fabric.contention ? "yes — multiple requesters" : "no"}.</p>
          <div className="row">{UNITS.map((unit) => <Metric key={unit} label={unit} value={String(fabric.shares[unit])} />)}</div>
        </Card>
      ) : null}

      {lab === "sync" ? (
        <Card title="Fence / event">
          <div className="tree">
            {timeline.map((item, index) => (
              <div key={item.phase} className="tree-node" style={index === sync ? { outline: "2px solid var(--primary)" } : undefined}>
                {item.actor}: {item.text}
              </div>
            ))}
          </div>
          <div className="row">
            <Button variant="primary" onClick={() => setSync((value) => Math.min(timeline.length - 1, value + 1))}>Step</Button>
            <Button onClick={() => setSync(0)}>Restart</Button>
          </div>
        </Card>
      ) : null}
    </ArchitectureFrame>
  );
}

export default HeteroStudio;
