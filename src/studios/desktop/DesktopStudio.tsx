import { useState } from "react";
import { useParams } from "react-router-dom";
import { DESKTOP_BLOCKS, DDR_PATH, PCIE_DEVICES, WORKLOADS, boost, cacheHop, desktopCache, packagePower, threadsShare } from "../../engines/isaarch/desktop";
import { ArchitectureFrame, ArchitectureLanding } from "../../layout/ArchitectureFrame";
import { Datapath } from "../shared/BitFields";
import { Button, Card, Metric, Segmented } from "../../design-system/ui";

export function DesktopStudio() {
  const lab = useParams().labId ?? "overview";
  const [block, setBlock] = useState("cores");
  const [smt, setSmt] = useState(false);
  const [cores, setCores] = useState(4);
  const [load, setLoad] = useState(70);
  const [head, setHead] = useState(80);
  const [power, setPower] = useState(90);
  const [igpu, setIgpu] = useState(20);
  const [llc, setLlc] = useState(40);
  const [cache, setCache] = useState(() => desktopCache());
  const [hit, setHit] = useState<"hit" | "miss" | "—">("—");
  const [addr, setAddr] = useState(0);
  const [pcie, setPcie] = useState("dgpu");
  const [work, setWork] = useState("st");
  const [ddr, setDdr] = useState(0);
  const [busy, setBusy] = useState(1);
  const freq = boost(cores, load, head, power);
  const pack = packagePower(cores, igpu, llc);
  const threads = threadsShare(smt);
  const job = WORKLOADS.find((item) => item.id === work);
  const selected = DESKTOP_BLOCKS.find((item) => item.id === block);

  return (
    <ArchitectureFrame studioId="desktop" onReset={() => { setBlock("cores"); setCache(desktopCache()); setHit("—"); }}>
      {lab === "overview" ? <ArchitectureLanding studioId="desktop" /> : null}

      {lab === "overview" || lab === "package" || lab === "cores" || lab === "internals" || lab === "igpu" ? (
        <div className="grid cards-2">
          <Card title="Generic package">
            <div className="soc-die">
              {DESKTOP_BLOCKS.map((item) => (
                <button key={item.id} className={item.id === block ? "soc-tile on" : "soc-tile"} onClick={() => setBlock(item.id)}>{item.name}</button>
              ))}
            </div>
          </Card>
          <Card title={selected?.name ?? "Block"}>
            <p>{selected?.note}</p>
            {lab === "cores" ? <label className="field">Active cores {cores}<input type="range" min={1} max={8} value={cores} onChange={(e) => setCores(Number(e.target.value))} /></label> : null}
          </Card>
        </div>
      ) : null}

      {lab === "threads" ? (
        <Card title="Hardware threads">
          <Button onClick={() => setSmt((v) => !v)}>{smt ? "2 threads / core" : "1 thread / core"}</Button>
          <p>{threads.note}</p>
          <Metric label="Threads" value={String(threads.threads)} />
        </Card>
      ) : null}

      {lab === "cache" || lab === "mc" || lab === "ddr" ? (
        <Card title="Cache → DDR">
          <p className="mono">Core → L1I/L1D → L2 → LLC → MC → DDR</p>
          <Datapath nodes={DDR_PATH.map((id) => ({ id, label: id }))} active={DDR_PATH.slice(0, hit === "miss" ? (ddr % DDR_PATH.length) + 1 : 2)} />
          <div className="row">
            <Button variant="primary" onClick={() => {
              const next = cacheHop(cache, addr);
              setCache(next.machine);
              setHit(next.hit ? "hit" : "miss");
              setAddr((value) => (value + 8) & 0xff);
              if (!next.hit) setDdr(0);
            }}>Access</Button>
            {hit === "miss" ? <Button onClick={() => setDdr((v) => v + 1)}>Advance DDR path</Button> : null}
          </div>
          <p className="tiny">Last access: {hit}. Educational cache geometry — not a desktop SKU.</p>
        </Card>
      ) : null}

      {lab === "interconnect" ? (
        <Card title="Shared interconnect">
          <Button onClick={() => setBusy((v) => (v % 4) + 1)}>Cores injecting: {busy}</Button>
          <p className="tiny">Contention rises as more cores talk to LLC/MC at once. Generic fabric, not a vendor mesh.</p>
        </Card>
      ) : null}

      {lab === "pcie" ? (
        <Card title="PCIe devices">
          <Segmented options={PCIE_DEVICES.map((d) => d.id)} value={pcie} onChange={setPcie} />
          <p>{PCIE_DEVICES.find((d) => d.id === pcie)?.name}: {PCIE_DEVICES.find((d) => d.id === pcie)?.note}</p>
          <p className="tiny">High-level link only. Not a protocol simulator.</p>
        </Card>
      ) : null}

      {lab === "boost" ? (
        <Card title="Educational boost model">
          <label className="field">Cores {cores}<input type="range" min={1} max={8} value={cores} onChange={(e) => setCores(Number(e.target.value))} /></label>
          <label className="field">Load {load}<input type="range" value={load} onChange={(e) => setLoad(Number(e.target.value))} /></label>
          <label className="field">Thermal headroom {head}<input type="range" value={head} onChange={(e) => setHead(Number(e.target.value))} /></label>
          <label className="field">Package power limit {power}<input type="range" value={power} onChange={(e) => setPower(Number(e.target.value))} /></label>
          <Metric label="Base" value={`${freq.base} GHz`} />
          <Metric label="Boost" value={`${freq.boost} GHz`} />
          <p className="tiny">Limited by {freq.limited}. Educational boost model — not a vendor algorithm.</p>
        </Card>
      ) : null}

      {lab === "thermal" ? (
        <Card title="Package power">
          <label className="field">iGPU {igpu}<input type="range" value={igpu} onChange={(e) => setIgpu(Number(e.target.value))} /></label>
          <label className="field">LLC {llc}<input type="range" value={llc} onChange={(e) => setLlc(Number(e.target.value))} /></label>
          <Metric label="Total" value={String(pack.total)} />
          <p className="tiny">cores {pack.parts.cores} · cache {pack.parts.cache} · iGPU {pack.parts.igpu} · MC {pack.parts.mc} · {pack.hot ? "thermal caution" : "within budget"}</p>
        </Card>
      ) : null}

      {lab === "workload" ? (
        <Card title="Workload explorer">
          <Segmented options={WORKLOADS.map((item) => item.id)} value={work} onChange={setWork} />
          <p>{job?.name}: cores {job?.cores}, SMT {job?.smt ? "on" : "off"}, memory {job?.mem}, iGPU {job?.igpu}</p>
        </Card>
      ) : null}
    </ArchitectureFrame>
  );
}

export default DesktopStudio;
