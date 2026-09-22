import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  DOMAIN_BLOCKS, SOC_BLOCKS, SOC_FLOWS, blockById, clientAccess, contention, createSystemCache,
  nextPower, shortestPath, type ClockDomain, type FlowId, type Point, type PowerState, type SocClient,
} from "../../engines/soc/soc";
import { ArchitectureFrame, ArchitectureLanding } from "../../layout/ArchitectureFrame";
import { Button, Card, Metric, Segmented } from "../../design-system/ui";

const GRID = 3;
function cell(r: number, c: number): string {
  return `${r},${c}`;
}

export function SocStudio() {
  const { labId } = useParams();
  const lab = labId ?? "overview";
  const [block, setBlock] = useState("cpu");
  const [flow, setFlow] = useState<FlowId>("camera");
  const [step, setStep] = useState(0);
  const [src, setSrc] = useState<Point>({ r: 0, c: 0 });
  const [dst, setDst] = useState<Point>({ r: 2, c: 2 });
  const [extra, setExtra] = useState(false);
  const [cache, setCache] = useState(() => createSystemCache());
  const [hit, setHit] = useState<"hit" | "miss" | "—">("—");
  const [client, setClient] = useState<SocClient>("CPU");
  const [addr, setAddr] = useState(0);
  const [domain, setDomain] = useState<ClockDomain>("CPU");
  const [power, setPower] = useState<Record<ClockDomain, PowerState>>({ CPU: "Active", GPU: "Active", Media: "Idle", "Always-on": "Active" });

  const selected = blockById(block);
  const preset = SOC_FLOWS[flow];
  const path = useMemo(() => shortestPath(src, dst), [src, dst]);
  const second = extra ? shortestPath({ r: 0, c: 2 }, { r: 2, c: 0 }) : [];
  const busy = contention(extra ? [path, second] : [path]);
  const onPath = new Set(path.map((point) => cell(point.r, point.c)));
  const flowId = preset.steps[step % preset.steps.length];

  return (
    <ArchitectureFrame studioId="soc" onReset={() => { setBlock("cpu"); setStep(0); setCache(createSystemCache()); setHit("—"); setExtra(false); }}>
      {lab === "overview" ? <ArchitectureLanding studioId="soc" /> : null}

      {lab === "floorplan" || lab === "cluster" || lab === "engines" || lab === "io" || lab === "media" || lab === "interconnect" ? (
        <div className="grid cards-2">
          <Card title="SoC floorplan">
            <div className="soc-die">
              {SOC_BLOCKS.map((item) => (
                <button key={item.id} className={item.id === block || item.id === flowId ? "soc-tile on" : "soc-tile"} onClick={() => setBlock(item.id)}>
                  {item.name}
                </button>
              ))}
            </div>
          </Card>
          <Card title={selected?.name ?? "Block"}>
            <p>{selected?.purpose}</p>
            <p className="tiny">Typical data: {selected?.data}</p>
            <p className="tiny">Paths: {selected?.paths.join(" · ")}</p>
            {(lab === "media" || lab === "interconnect") ? (
              <>
                <Segmented options={["camera", "video", "ai"]} value={flow} onChange={(value) => { setFlow(value as FlowId); setStep(0); }} />
                <div className="row">
                  <Button variant="primary" onClick={() => setStep((value) => value + 1)}>Animate flow</Button>
                  <span className="tiny">{preset.title}: {preset.steps.join(" → ")}</span>
                </div>
              </>
            ) : null}
          </Card>
        </div>
      ) : null}

      {lab === "dataflow" ? (
        <Card title={preset.title}>
          <Segmented options={["camera", "video", "ai"]} value={flow} onChange={(value) => { setFlow(value as FlowId); setStep(0); }} />
          <div className="tree">
            {preset.steps.map((id, index) => (
              <div key={id} className="tree-node" style={index === step % preset.steps.length ? { outline: "2px solid var(--primary)" } : undefined}>
                {blockById(id)?.name ?? id}
              </div>
            ))}
          </div>
          <Button variant="primary" onClick={() => setStep((value) => value + 1)}>Step dataflow</Button>
        </Card>
      ) : null}

      {lab === "noc" ? (
        <Card title="Teaching mesh">
          <div className="row">
            <label className="field">Source r,c
              <input value={`${src.r},${src.c}`} onChange={(event) => {
                const [r, c] = event.target.value.split(",").map(Number);
                if (Number.isFinite(r) && Number.isFinite(c)) setSrc({ r: Math.max(0, Math.min(2, r ?? 0)), c: Math.max(0, Math.min(2, c ?? 0)) });
              }} />
            </label>
            <label className="field">Destination r,c
              <input value={`${dst.r},${dst.c}`} onChange={(event) => {
                const [r, c] = event.target.value.split(",").map(Number);
                if (Number.isFinite(r) && Number.isFinite(c)) setDst({ r: Math.max(0, Math.min(2, r ?? 0)), c: Math.max(0, Math.min(2, c ?? 0)) });
              }} />
            </label>
            <Button onClick={() => setExtra((value) => !value)}>{extra ? "One packet" : "Second packet"}</Button>
          </div>
          <div className="pe-grid" style={{ gridTemplateColumns: `repeat(${GRID}, 72px)` }}>
            {Array.from({ length: GRID * GRID }, (_, index) => {
              const r = Math.floor(index / GRID);
              const c = index % GRID;
              const active = onPath.has(cell(r, c));
              return <div key={index} className={active ? "pe-cell on" : "pe-cell"}>R{r}C{c}</div>;
            })}
          </div>
          <p className="tiny">Shortest path hops: {path.length - 1}. Contention: {busy.contested ? "shared link" : "none"}. Teaching mesh only.</p>
        </Card>
      ) : null}

      {lab === "memory" ? (
        <Card title="System cache">
          <div className="row">
            <Segmented options={["CPU", "GPU", "NPU", "ISP"]} value={client} onChange={(value) => setClient(value as SocClient)} />
            <label className="field">Address<input type="number" value={addr} onChange={(event) => setAddr(Number(event.target.value))} /></label>
            <Button variant="primary" onClick={() => {
              const next = clientAccess(cache, client, addr);
              setCache(next.cache);
              setHit(next.last);
            }}>Access</Button>
            <Button onClick={() => { setCache(createSystemCache()); setHit("—"); }}>Reset cache</Button>
          </div>
          <p className={`status ${hit === "hit" ? "hit" : hit === "miss" ? "miss" : ""}`}>{hit === "miss" ? "MISS → DRAM request" : hit === "hit" ? "HIT" : "—"}</p>
        </Card>
      ) : null}

      {lab === "power" ? (
        <Card title="Clock domains">
          <Segmented options={["CPU", "GPU", "Media", "Always-on"]} value={domain} onChange={(value) => setDomain(value as ClockDomain)} />
          <p className="tiny">Blocks: {DOMAIN_BLOCKS[domain].join(", ")}</p>
          <div className="row">
            <Metric label="State" value={power[domain]} />
            <Button variant="primary" onClick={() => setPower((current) => ({ ...current, [domain]: nextPower(current[domain]) }))}>Next power state</Button>
          </div>
          <p className="tiny">Clock gated stops toggling conceptually. Power gated drops the domain. Not transistor-accurate.</p>
        </Card>
      ) : null}
    </ArchitectureFrame>
  );
}

export default SocStudio;
