import { useState } from "react";
import { useParams } from "react-router-dom";
import { CAMERA_FLOW, MEMORY_CLIENTS, MOBILE_BLOCKS, MOBILE_WORKS, autoMobile, thermal, type MobileBlock } from "../../engines/isaarch/mobile";
import { ArchitectureFrame, ArchitectureLanding } from "../../layout/ArchitectureFrame";
import { Datapath } from "../shared/BitFields";
import { Button, Card, Metric, Segmented } from "../../design-system/ui";

export function MobileStudio() {
  const lab = useParams().labId ?? "overview";
  const [block, setBlock] = useState<MobileBlock>("P-core");
  const [work, setWork] = useState("ui");
  const [cpu, setCpu] = useState(40);
  const [gpu, setGpu] = useState(20);
  const [npu, setNpu] = useState(10);
  const [cam, setCam] = useState(0);
  const [clients, setClients] = useState<string[]>(["CPU"]);
  const [lat, setLat] = useState(true);
  const [compute, setCompute] = useState(6);
  const [bg, setBg] = useState(false);
  const [par, setPar] = useState(false);
  const [ai, setAi] = useState(false);
  const selected = MOBILE_BLOCKS.find((item) => item.id === block);
  const job = autoMobile(work);
  const heat = thermal(cpu, gpu, npu, 35);
  const auto = ai ? "NPU" : lat && !bg ? "P-core" : bg ? "E-core" : par && compute > 7 ? "GPU" : "E-core";

  return (
    <ArchitectureFrame studioId="mobile" onReset={() => { setBlock("P-core"); setCpu(40); setClients(["CPU"]); }}>
      {lab === "overview" ? <ArchitectureLanding studioId="mobile" /> : null}

      {lab === "overview" || lab === "floorplan" || lab === "cluster" || lab === "gpu" || lab === "npu" || lab === "media" || lab === "power" || lab === "modem" ? (
        <div className="grid cards-2">
          <Card title="Generic mobile SoC">
            <div className="soc-die">
              {MOBILE_BLOCKS.map((item) => (
                <button key={item.id} className={item.id === block ? "soc-tile on" : "soc-tile"} onClick={() => setBlock(item.id)}>{item.id}</button>
              ))}
            </div>
          </Card>
          <Card title={selected?.id ?? "Block"}>
            <p>{selected?.purpose}</p>
            <p className="tiny">Typical data: {selected?.data}</p>
            {lab === "modem" ? <p className="tiny">Modem traffic lands in memory, then the CPU processes the application view. No radio protocol is simulated.</p> : null}
          </Card>
        </div>
      ) : null}

      {lab === "cores" ? (
        <Card title="Performance vs efficiency">
          <Segmented options={MOBILE_WORKS.map((item) => item.id)} value={work} onChange={setWork} />
          <p><strong>{job?.name}</strong> → {job?.recommend}. {job?.reason}</p>
          <div className="row">
            <Metric label="Responsiveness" value={job?.latency ? "high" : "relaxed"} />
            <Metric label="Performance" value={String(job?.compute)} />
            <Metric label="Power" value={job?.recommend === "P-core" ? "higher" : "lower"} />
            <Metric label="Energy" value={job?.background ? "small burst" : "foreground"} />
          </div>
          <p className="tiny">Generic names only. Not a vendor scheduler.</p>
        </Card>
      ) : null}

      {lab === "scheduler" ? (
        <Card title="Educational auto-schedule">
          <Button onClick={() => setLat((v) => !v)}>Latency {lat ? "sensitive" : "tolerant"}</Button>
          <Button onClick={() => setBg((v) => !v)}>{bg ? "Background" : "Foreground"}</Button>
          <Button onClick={() => setPar((v) => !v)}>Parallel {par ? "yes" : "no"}</Button>
          <Button onClick={() => setAi((v) => !v)}>AI {ai ? "yes" : "no"}</Button>
          <label className="field">Compute {compute}<input type="range" min={1} max={10} value={compute} onChange={(e) => setCompute(Number(e.target.value))} /></label>
          <p>Selected block: <strong>{auto}</strong></p>
        </Card>
      ) : null}

      {lab === "thermal" ? (
        <Card title="Educational thermal model">
          <label className="field">CPU {cpu}<input type="range" value={cpu} onChange={(e) => setCpu(Number(e.target.value))} /></label>
          <label className="field">GPU {gpu}<input type="range" value={gpu} onChange={(e) => setGpu(Number(e.target.value))} /></label>
          <label className="field">NPU {npu}<input type="range" value={npu} onChange={(e) => setNpu(Number(e.target.value))} /></label>
          <Metric label="Temp" value={`${heat.temp}`} />
          <Metric label="Throttle" value={heat.throttle ? "yes" : "no"} />
          <Metric label="Freq" value={`${heat.freq}`} />
          <Metric label="Migrate" value={heat.migrate ? "P→E concept" : "stay"} />
        </Card>
      ) : null}

      {lab === "camera" ? (
        <Card title="Camera pipeline">
          <Datapath nodes={CAMERA_FLOW.map((id) => ({ id, label: id }))} active={CAMERA_FLOW.slice(0, (cam % CAMERA_FLOW.length) + 1)} />
          <Button variant="primary" onClick={() => setCam((v) => v + 1)}>Advance frame token</Button>
        </Card>
      ) : null}

      {lab === "memory" ? (
        <Card title="Shared LPDDR path">
          <Datapath nodes={[{ id: "c", label: "Clients" }, { id: "sc", label: "System cache" }, { id: "mc", label: "Controller" }, { id: "lp", label: "LPDDR" }]} active={["c", "sc", "mc", "lp"]} />
          <div className="row">
            {MEMORY_CLIENTS.map((name) => (
              <Button key={name} onClick={() => setClients((prev) => prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name])}>{name}{clients.includes(name) ? " on" : ""}</Button>
            ))}
          </div>
          <p className="tiny">Simultaneous clients: {clients.join(", ") || "none"}. Contention rises conceptually with more masters.</p>
        </Card>
      ) : null}
    </ArchitectureFrame>
  );
}

export default MobileStudio;
