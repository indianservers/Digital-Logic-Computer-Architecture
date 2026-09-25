import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { boost, packagePower } from "../../engines/isaarch/desktop";

function Chip({ kind }: { kind: "cpu" | "cache" | "ddr" | "pcie" | "bolt" | "heat" | "core" | "work" | "quiz" }) {
  const d: Record<typeof kind, string> = {
    cpu: "M4 8h8v8H4zM6 4h2M10 4h2M6 18h2M10 18h2",
    cache: "M5 16h14M7 12h10M9 8h6",
    ddr: "M7 5h10v14H7zM9 5v14M12 5v14M15 5v14",
    pcie: "M4 10h16v4H4zM8 10V7M16 10V7",
    bolt: "M13 3 6 13h5l-1 8 8-12h-5z",
    heat: "M12 4c2 3 3 5 3 7a3 3 0 1 1-6 0c0-2 1-4 3-7z",
    core: "M8 8h8v8H8z",
    work: "M5 18V8m7 10V5m7 13v-6",
    quiz: "M7 4h10v4H7zM6 10h12v10H6z",
  };
  return (
    <svg className="dsk-ico" viewBox="0 0 24 24" aria-hidden="true">
      <path d={d[kind]} />
    </svg>
  );
}

export function HomePage() {
  return (
    <>
      <section className="dsk-stage" aria-label="Desktop CPU package">
        <Link className="dsk-call blue" to="/architecture/desktop/cores">CPU Cores</Link>
        <Link className="dsk-call sky" to="/architecture/desktop/cache">Caches</Link>
        <Link className="dsk-call green" to="/architecture/desktop/memory">DDR Memory</Link>
        <div className="dsk-pkg">
          <div className="dsk-pkg-board" />
          <div className="dsk-pkg-sub" />
          <div className="dsk-pkg-lid"><b>Modern</b><b>CPU</b></div>
          <i className="dsk-glow a" /><i className="dsk-glow b" /><i className="dsk-glow c" />
        </div>
        <Link className="dsk-call violet" to="/architecture/desktop/pcie">PCIe I/O</Link>
        <Link className="dsk-call amber" to="/architecture/desktop/boost-power">Power</Link>
        <Link className="dsk-call orange" to="/architecture/desktop/thermal">Thermal</Link>
      </section>
      <section className="dsk-labs">
        <h2>Featured Labs</h2>
        <div className="dsk-feat">
          <Link to="/architecture/desktop/package"><Chip kind="cpu" /><b>CPU Package</b><span>Explore the blocks inside a modern CPU</span></Link>
          <Link to="/architecture/desktop/cache"><Chip kind="cache" /><b>Caches</b><span>Multi-level cache hierarchy</span></Link>
          <Link to="/architecture/desktop/memory"><Chip kind="ddr" /><b>DDR Memory</b><span>Memory controller and DDR</span></Link>
        </div>
        <h2>More Labs</h2>
        <div className="dsk-more">
          <Link to="/architecture/desktop/pcie"><Chip kind="pcie" /><b>PCIe & I/O</b></Link>
          <Link to="/architecture/desktop/boost-power"><Chip kind="bolt" /><b>Boost & Power</b></Link>
          <Link to="/architecture/desktop/thermal"><Chip kind="heat" /><b>Thermal Management</b></Link>
          <Link to="/architecture/desktop/cores"><Chip kind="core" /><b>Core Microarchitecture</b></Link>
          <Link to="/architecture/desktop/workloads"><Chip kind="work" /><b>System Workloads</b></Link>
          <Link to="/architecture/desktop/practice"><Chip kind="quiz" /><b>Practice & Quiz</b></Link>
        </div>
      </section>
    </>
  );
}

const BLOCKS = [
  { id: "p", name: "P-Cores", sub: "High performance", note: "Wider front end and more execution resources in this example. Not every desktop CPU has a separate P-core.", connects: "Private L1/L2, then the shared L3." },
  { id: "e", name: "E-Cores", sub: "High efficiency", note: "Smaller cores for lighter threads. This mix is a teaching example, not a requirement.", connects: "The same shared L3 and memory controller." },
  { id: "l3", name: "L3 Cache", sub: "Shared", note: "Last-level cache shared by the cores in this package.", connects: "All cores and the memory controller." },
  { id: "mesh", name: "Interconnect / Ring / Mesh", sub: "On-die fabric", note: "Moves requests between cores, cache, and the controllers.", connects: "Every block on this diagram." },
  { id: "mc", name: "Memory Controller", sub: "DDR", note: "Schedules reads and writes onto the DDR channels.", connects: "L3 and the DIMMs off-package." },
  { id: "pcie", name: "PCIe Controller", sub: "PCIe 5.0 / x16 example", note: "Root complex for the GPU, SSD, and other devices.", connects: "Devices outside the package." },
  { id: "sa", name: "System Agent", sub: "I/O, display, etc.", note: "Uncore housekeeping: power, display, and the fabric.", connects: "The controllers and the interconnect." },
] as const;

const LAYERS = [
  { id: "ihs", name: "IHS / heat spreader", note: "The metal lid spreads heat into the cooler. It is not the silicon." },
  { id: "die", name: "CPU die", note: "The silicon holds the cores, cache, and controllers." },
  { id: "substrate", name: "Substrate", note: "Routes the die out to the socket contacts." },
  { id: "pads", name: "LGA pads", note: "Contacts on the underside meet the motherboard socket. Example interface." },
] as const;

export function PackagePage() {
  const [view, setView] = useState<"blocks" | "die" | "package">("blocks");
  const [block, setBlock] = useState<(typeof BLOCKS)[number]["id"]>("p");
  const [layer, setLayer] = useState<(typeof LAYERS)[number]["id"]>("die");
  const picked = BLOCKS.find((item) => item.id === block) ?? BLOCKS[0];
  const lid = LAYERS.find((item) => item.id === layer) ?? LAYERS[1];
  return (
    <section className="dsk-panel">
      <div className="rvx-tabs">
        {([["blocks", "Block Diagram"], ["die", "Die View"], ["package", "Package View"]] as const).map(([id, label]) => (
          <button key={id} type="button" className={view === id ? "on" : ""} onClick={() => setView(id)}>{label}</button>
        ))}
      </div>
      {view === "blocks" && (
        <div className="dsk-soc">
          <h3>Modern Desktop CPU</h3>
          <div className="dsk-soc-top">
            {BLOCKS.slice(0, 3).map((item) => (
              <button key={item.id} type="button" className={`dsk-blk ${item.id}${block === item.id ? " on" : ""}`} onClick={() => setBlock(item.id)}><b>{item.name}</b><span>{item.sub}</span></button>
            ))}
          </div>
          <button type="button" className={`dsk-blk mesh${block === "mesh" ? " on" : ""}`} onClick={() => setBlock("mesh")}><b>Interconnect / Ring / Mesh</b></button>
          <div className="dsk-soc-top">
            {BLOCKS.slice(4).map((item) => (
              <button key={item.id} type="button" className={`dsk-blk ${item.id}${block === item.id ? " on" : ""}`} onClick={() => setBlock(item.id)}><b>{item.name}</b><span>{item.sub}</span></button>
            ))}
          </div>
        </div>
      )}
      {view === "die" && (
        <div className="dsk-die">
          {BLOCKS.filter((item) => item.id !== "mesh").map((item) => (
            <button key={item.id} type="button" className={`dsk-blk ${item.id}${block === item.id ? " on" : ""}`} onClick={() => setBlock(item.id)}><b>{item.name}</b></button>
          ))}
        </div>
      )}
      {view === "package" && (
        <div className="dsk-stack">
          {LAYERS.map((item) => (
            <button key={item.id} type="button" className={layer === item.id ? "on" : ""} onClick={() => setLayer(item.id)}>{item.name}</button>
          ))}
        </div>
      )}
      <p className="dsk-note"><b>{view === "package" ? lid.name : picked.name}.</b> {view === "package" ? lid.note : `${picked.note} Connects to ${picked.connects}`}</p>
      <h3>Package Information</h3>
      <table className="dsk-table">
        <tbody>
          <tr><th>Process node</th><td>Recent desktop node (example)</td></tr>
          <tr><th>Die size</th><td>~ 200 mm² (example)</td></tr>
          <tr><th>Transistors</th><td>~ 20 billion (example)</td></tr>
          <tr><th>Base power</th><td>125 W (example)</td></tr>
          <tr><th>Package</th><td>LGA (example)</td></tr>
        </tbody>
      </table>
      <p className="cmp-hint">These figures are labelled examples. They are not a measurement of a product, and not every desktop CPU uses P-cores and E-cores.</p>
    </section>
  );
}

const PIPE: Record<"p" | "e", { focus: string; use: string; features: string; perf: number; power: number; area: number }> = {
  p: { focus: "High single-thread performance", use: "Gaming, content creation, heavy workloads", features: "Wider pipeline, larger caches, more execution units", perf: 100, power: 100, area: 100 },
  e: { focus: "Throughput per watt and per area", use: "Background tasks, web, light threads", features: "Narrower issue, fewer execution units, smaller private cache", perf: 48, power: 28, area: 32 },
};

function CorePipe({ kind }: { kind: "p" | "e" }) {
  const wide = kind === "p";
  return (
    <div className={`dsk-pipe ${kind}`}>
      <h3>{kind === "p" ? "P-Core" : "E-Core"} microarchitecture</h3>
      <p className="cmp-hint">Simplified educational core model.</p>
      <div className="dsk-pipe-row">
        <span>Branch predictor</span>
        <span>L1I cache {wide ? "32 KB" : "16 KB"} example</span>
      </div>
      <span className="dsk-pipe-bar mint">L1D cache {wide ? "48 KB" : "32 KB"} example</span>
      <span className="dsk-pipe-bar">Instruction fetch / decode</span>
      <span className="dsk-pipe-bar">Rename / issue</span>
      <div className="dsk-pipe-row units">
        <span>ALU</span><span>ALU</span>{wide ? <span>FPU</span> : null}{wide ? <span>Vector</span> : <span>Load</span>}
      </div>
      <span className="dsk-pipe-bar slim">Load / store</span>
      <span className="dsk-pipe-bar deep">L2 cache (private) {wide ? "2 MB" : "1 MB"} example</span>
    </div>
  );
}

const JOBS = ["Gaming", "Compilation", "Web", "Background", "Media", "Productivity"] as const;

export function CoresPage() {
  const [mode, setMode] = useState<"p" | "e" | "both">("p");
  const [job, setJob] = useState<(typeof JOBS)[number]>("Compilation");
  const [count, setCount] = useState(4);
  const detail = PIPE[mode === "e" ? "e" : "p"];
  const heavy = job === "Compilation" || job === "Gaming" || job === "Productivity";
  const pFreq = heavy ? 4.8 : 3.1;
  const eFreq = job === "Background" ? 2.1 : 3.2;
  return (
    <section className="dsk-panel">
      <div className="rvx-tabs">
        <button type="button" className={mode === "p" ? "on" : ""} onClick={() => setMode("p")}>P-Core (Performance)</button>
        <button type="button" className={mode === "e" ? "on" : ""} onClick={() => setMode("e")}>E-Core (Efficiency)</button>
        <button type="button" className={mode === "both" ? "on" : ""} onClick={() => setMode("both")}>Comparison</button>
      </div>
      <div className={mode === "both" ? "dsk-split" : "dsk-split one"}>
        {mode !== "e" && <CorePipe kind="p" />}
        {mode !== "p" && <CorePipe kind="e" />}
        {mode !== "both" && (
          <aside className="dsk-detail">
            <h3>{mode === "p" ? "P-Core" : "E-Core"} details</h3>
            <p><b>Focus</b><span>{detail.focus}</span></p>
            <p><b>Typical use</b><span>{detail.use}</span></p>
            <p><b>Features</b><span>{detail.features}</span></p>
            <h3>Relative characteristics</h3>
            {([["Performance", detail.perf, "blue"], ["Power", detail.power, "orange"], ["Area", detail.area, "amber"]] as const).map(([label, value, tone]) => (
              <label key={label}>{label} {value}%<meter className={tone} value={value} min={0} max={100} /></label>
            ))}
          </aside>
        )}
      </div>
      <div className="rvx-tabs">{JOBS.map((item) => <button key={item} type="button" className={job === item ? "on" : ""} onClick={() => setJob(item)}>{item}</button>)}</div>
      <label>Active cores {count}<input aria-label="Active cores" type="range" min={1} max={8} value={count} onChange={(event) => setCount(Number(event.target.value))} /></label>
      <p>{job} schedules onto {count} {mode === "e" ? "E-cores" : mode === "p" ? "P-cores" : "mixed cores"}. Example P frequency {pFreq.toFixed(1)} GHz · E frequency {eFreq.toFixed(1)} GHz · relative performance {Math.round((mode === "e" ? 0.5 : 1) * count * (heavy ? 16 : 7))} · relative power {Math.round((mode === "e" ? 5 : 12) * count * (heavy ? 1 : 0.4))}.</p>
    </section>
  );
}

const LEVELS = [
  { id: "L1", title: "L1 Cache", sub: "Per core", size: "32 KB / 48 KB · ~1 ns", note: "Private and closest. Often split into L1I and L1D. Sizes here are examples, not a standard." },
  { id: "L2", title: "L2 Cache", sub: "Per core", size: "1 MB / 2 MB · ~4 ns", note: "Larger private cache. Catches what misses L1." },
  { id: "L3", title: "L3 Cache", sub: "Shared", size: "20 MB – 50 MB · ~12 ns", note: "Shared by the cores in this example. Bigger and slower than L2." },
  { id: "DDR", title: "Main Memory (DDR)", sub: "Off package", size: "~50 – 100 ns", note: "A miss through the hierarchy continues to DRAM." },
] as const;

export function CachePage() {
  const [level, setLevel] = useState<"L1" | "L2" | "L3" | "All">("All");
  const [pattern, setPattern] = useState("sequential");
  const [fit, setFit] = useState<"L1" | "L2" | "L3" | "DDR">("L2");
  const [ran, setRan] = useState(false);
  const [step, setStep] = useState(0);
  const depth = fit === "L1" ? 0 : fit === "L2" ? 1 : fit === "L3" ? 2 : 3;
  const hit = pattern === "streaming" && fit === "L1" ? 71 : fit === "L1" ? 98.4 : fit === "L2" ? (pattern === "random" ? 84.1 : 96.2) : fit === "L3" ? 88.4 : 41.0;
  const ns = fit === "L1" ? 1.1 : fit === "L2" ? 1.8 : fit === "L3" ? 12 : 72;
  const info = LEVELS.find((item) => item.id === (level === "All" ? "L1" : level)) ?? LEVELS[0];
  const path = ["Core", "L1", "L2", "L3", "DDR"];
  return (
    <section className="dsk-panel">
      <div className="dsk-pyramid" aria-label="Cache pyramid">
        {LEVELS.map((item, index) => (
          <button key={item.id} type="button" className={`tier t${index}${level === item.id || (ran && index <= depth) ? " on" : ""}`} onClick={() => setLevel(item.id === "DDR" ? "L3" : item.id)}>
            <b>{item.title}</b><span>{item.sub}</span><small>{item.size}</small>
          </button>
        ))}
      </div>
      <h3>Explore cache levels</h3>
      <div className="rvx-tabs">
        {(["L1", "L2", "L3", "All"] as const).map((item) => <button key={item} type="button" className={level === item ? "on" : ""} onClick={() => setLevel(item)}>{item}</button>)}
      </div>
      <p>{level === "All" ? "L1 is private, L2 is a larger private cache, and L3 is shared in this example." : info.note}</p>
      <div className="dsk-sim">
        <div>
          <h3>Cache access simulation</h3>
          <label>Access pattern
            <select aria-label="Access pattern" value={pattern} onChange={(event) => { setPattern(event.target.value); setRan(false); }}>
              {["sequential", "random", "repeated", "streaming"].map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label>Working set
            <select aria-label="Working set" value={fit} onChange={(event) => { setFit(event.target.value as typeof fit); setRan(false); setStep(0); }}>
              <option value="L1">Fits L1</option>
              <option value="L2">Fits L2</option>
              <option value="L3">Fits L3</option>
              <option value="DDR">Exceeds cache</option>
            </select>
          </label>
          <button type="button" className="cmp-primary" onClick={() => { setRan(true); setStep(depth); }}>Run simulation</button>
        </div>
        <dl>
          <div><dt>Hit rate</dt><dd>{ran ? `${hit.toFixed(1)}%` : "—"}</dd></div>
          <div><dt>Avg. latency</dt><dd>{ran ? `${ns} ns` : "—"}</dd></div>
          <div><dt>Memory accesses</dt><dd>1,000,000</dd></div>
          <div><dt>Miss rate</dt><dd>{ran ? `${(100 - hit).toFixed(1)}%` : "—"}</dd></div>
        </dl>
      </div>
      <div className="dsk-path">{path.map((item, index) => <span key={item} className={ran && index <= step + 1 && index <= depth + 1 ? "on" : ""}>{item}</span>)}</div>
      <p className="cmp-hint">A streaming pattern can miss L1 even when each line is touched only once. Latency numbers are conceptual, not a datasheet.</p>
    </section>
  );
}

export function MemoryPage() {
  const [tab, setTab] = useState<"overview" | "controller" | "timing" | "bandwidth">("overview");
  const [kind, setKind] = useState<"DDR4" | "DDR5">("DDR5");
  const [channels, setChannels] = useState<1 | 2>(2);
  const [rate, setRate] = useState(5200);
  const rates = kind === "DDR5" ? [4800, 5200, 5600, 6400] : [2666, 3200, 3600];
  const gbps = (rate * 8 * channels) / 1000;
  const cas = kind === "DDR5" ? 40 : 22;
  return (
    <section className="dsk-panel">
      <div className="rvx-tabs">
        {([["overview", "Overview"], ["controller", "Memory Controller"], ["timing", "Timing"], ["bandwidth", "Bandwidth"]] as const).map(([id, label]) => (
          <button key={id} type="button" className={tab === id ? "on" : ""} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      {tab === "overview" && (
        <div className="dsk-ddr" aria-label="CPU to DIMMs">
          <div className="dsk-node cpu">CPU</div>
          <span className="dsk-arrow" />
          <div className="dsk-node mc">Memory Controller</div>
          <div className="dsk-dimms">
            <div><b>DDR DIMM</b><i /><small>Channel 0</small></div>
            {channels === 2 ? <div><b>DDR DIMM</b><i /><small>Channel 1</small></div> : null}
          </div>
        </div>
      )}
      {tab === "controller" && <p>The memory controller queues reads and writes, picks a channel, and keeps banks busy. A second channel is a second path, not a shorter latency.</p>}
      {tab === "timing" && <p>Data rate is twice the memory clock on conventional DDR, because data moves on both edges. Example CAS latency for this {kind}-{rate} setting is {cas} cycles. CAS is the column wait, not the full trip from the core.</p>}
      {tab === "bandwidth" && <p>Peak ≈ transfers/s × bytes/transfer × channels. {rate} million × 8 bytes × {channels} = <b>{gbps.toFixed(1)} GB/s</b>.</p>}
      <h3>Memory configuration</h3>
      <table className="dsk-table">
        <tbody>
          <tr><th>Memory type</th><td><select aria-label="Memory type" value={kind} onChange={(event) => { const next = event.target.value as "DDR4" | "DDR5"; setKind(next); setRate(next === "DDR5" ? 5200 : 3200); }}><option>DDR4</option><option>DDR5</option></select></td></tr>
          <tr><th>Channels</th><td><select aria-label="Channels" value={channels} onChange={(event) => setChannels(Number(event.target.value) === 1 ? 1 : 2)}><option value={1}>1 (single channel)</option><option value={2}>2 (dual channel)</option></select></td></tr>
          <tr><th>Data rate</th><td><select aria-label="Data rate" value={rate} onChange={(event) => setRate(Number(event.target.value))}>{rates.map((item) => <option key={item} value={item}>{item} MT/s</option>)}</select></td></tr>
          <tr><th>Bus width</th><td>64-bit (per channel)</td></tr>
          <tr><th>Theoretical bandwidth</th><td>{gbps.toFixed(1)} GB/s</td></tr>
        </tbody>
      </table>
      <p className="cmp-hint">This is a peak. Applications see less once latency, banks, and the cache miss rate are included.</p>
    </section>
  );
}

const LANE_GB: Record<string, number> = { "3.0": 1, "4.0": 2, "5.0": 4 };

export function PciePage() {
  const [gen, setGen] = useState<keyof typeof LANE_GB>("5.0");
  const [gpu, setGpu] = useState(16);
  const [ssd, setSsd] = useState(4);
  const [nic, setNic] = useState(4);
  const [other, setOther] = useState(1);
  const per = LANE_GB[gen] ?? 4;
  const used = gpu + ssd + nic + other;
  const snap = (value: number) => (value >= 12 ? 16 : value >= 6 ? 8 : value >= 3 ? 4 : 1);
  return (
    <section className="dsk-panel">
      <div className="dsk-pcie" aria-label="PCIe topology">
        <div className="dsk-node cpu">CPU</div>
        <span className="dsk-arrow" />
        <div className="dsk-node mc">PCIe Controller<br />PCIe {gen}</div>
        <div className="dsk-devs">
          <div><b>Graphics card</b><span>x{gpu}</span></div>
          <div><b>NVMe SSD</b><span>x{ssd}</span></div>
          <div><b>Network card</b><span>x{nic}</span></div>
          <div><b>Chipset / other</b><span>x{other}</span></div>
        </div>
      </div>
      <h3>PCIe configuration</h3>
      <table className="dsk-table">
        <tbody>
          <tr><th>PCIe generation</th><td><select aria-label="PCIe generation" value={gen} onChange={(event) => setGen(event.target.value as keyof typeof LANE_GB)}><option value="3.0">PCIe 3.0</option><option value="4.0">PCIe 4.0</option><option value="5.0">PCIe 5.0</option></select></td></tr>
          <tr><th>GPU lanes</th><td><input aria-label="GPU lanes" type="range" min={1} max={16} value={gpu} onChange={(event) => setGpu(snap(Number(event.target.value)))} /> x{gpu}</td></tr>
          <tr><th>NVMe lanes</th><td><input aria-label="NVMe lanes" type="range" min={1} max={8} value={ssd} onChange={(event) => setSsd(snap(Number(event.target.value)) > 8 ? 8 : snap(Number(event.target.value)))} /> x{ssd}</td></tr>
          <tr><th>NIC lanes</th><td><input aria-label="NIC lanes" type="range" min={1} max={4} value={nic} onChange={(event) => setNic(Math.min(4, snap(Number(event.target.value))))} /> x{nic}</td></tr>
          <tr><th>Other lanes</th><td><input aria-label="Other lanes" type="range" min={1} max={4} value={other} onChange={(event) => setOther(Math.min(4, snap(Number(event.target.value))))} /> x{other}</td></tr>
          <tr><th>Per-lane bandwidth</th><td>{per.toFixed(1)} GB/s each direction (rounded teaching value)</td></tr>
          <tr><th>Total device bandwidth</th><td>{(used * per).toFixed(0)} GB/s</td></tr>
          <tr><th>Lane budget</th><td>{used} of 16 example CPU lanes</td></tr>
        </tbody>
      </table>
      {used > 16 ? <p className="dsk-warn">Those links ask for more than 16 lanes. Reduce a device or move one behind the chipset.</p> : <p>{16 - used} lanes still free on this 16-lane example root complex.</p>}
      <p className="cmp-hint">Encoded peaks are about 0.985, 1.969, and 3.938 GB/s per lane for generations 3, 4, and 5. The 1 / 2 / 4 figures are the classroom rounding.</p>
    </section>
  );
}

const BOOST_JOBS = ["Idle", "Web", "Gaming", "Rendering", "Compilation", "Stress"] as const;

function line(values: number[], max: number) {
  return values.map((value, index) => `${20 + index * 24},${118 - (value / max) * 96}`).join(" ");
}

export function BoostPage() {
  const [job, setJob] = useState<(typeof BOOST_JOBS)[number]>("Gaming");
  const [load, setLoad] = useState(75);
  const [limit, setLimit] = useState(70);
  const [turbo, setTurbo] = useState(90);
  const [span, setSpan] = useState<"Burst" | "Medium" | "Sustained">("Sustained");
  const [policy, setPolicy] = useState<"Balanced" | "Performance" | "Efficiency">("Balanced");
  const cores = job === "Rendering" || job === "Stress" || job === "Compilation" ? 8 : job === "Idle" ? 1 : 4;
  const policyLoad = policy === "Performance" ? Math.min(100, load + 12) : policy === "Efficiency" ? Math.max(4, load - 18) : load;
  const headroom = span === "Burst" ? 92 : span === "Medium" ? 70 : 48;
  const model = boost(cores, policyLoad, Math.min(headroom, turbo), Math.min(limit, turbo));
  const pTrace = useMemo(() => Array.from({ length: 11 }, (_, index) => {
    const t = index / 10;
    const rise = Math.min(1, t * 3.4);
    const hold = span === "Burst" ? (t < 0.35 ? 1 : Math.max(0.68, 1 - (t - 0.35) * 0.7)) : span === "Sustained" ? 0.84 : 0.94;
    return Number((model.base * 0.7 + (model.boost - model.base * 0.7) * rise * hold).toFixed(2));
  }), [model.base, model.boost, span]);
  const eTrace = pTrace.map((value) => Number((value * 0.68).toFixed(2)));
  const pNow = pTrace[pTrace.length - 1] ?? model.boost;
  const eNow = eTrace[eTrace.length - 1] ?? model.boost * 0.68;
  const watts = packagePower(cores, job === "Gaming" ? 10 : 2, 36).total + Math.round(policyLoad * 0.6);
  const temp = Math.round(42 + policyLoad * 0.42 * (span === "Sustained" ? 1.15 : 0.85));
  return (
    <section className="dsk-panel">
      <p className="cmp-hint">Simplified educational boost model. Not a vendor turbo algorithm.</p>
      <div className="dsk-boost">
        <div className="dsk-controls">
          <label>Workload
            <select aria-label="Workload" value={job} onChange={(event) => { const next = event.target.value as (typeof BOOST_JOBS)[number]; setJob(next); setLoad(next === "Idle" ? 8 : next === "Stress" ? 100 : 72); }}>{BOOST_JOBS.map((item) => <option key={item}>{item}</option>)}</select>
          </label>
          <label>Load {load}%<input aria-label="Load" type="range" min={0} max={100} value={load} onChange={(event) => setLoad(Number(event.target.value))} /></label>
          <label>Power limit {Math.round(65 + limit * 1.2)} W example<input aria-label="Power limit" type="range" min={15} max={100} value={limit} onChange={(event) => setLimit(Number(event.target.value))} /></label>
          <label>Boost headroom {turbo}<input aria-label="Boost headroom" type="range" min={20} max={100} value={turbo} onChange={(event) => setTurbo(Number(event.target.value))} /></label>
          <label>Duration
            <select aria-label="Duration" value={span} onChange={(event) => setSpan(event.target.value as typeof span)}><option>Burst</option><option>Medium</option><option>Sustained</option></select>
          </label>
          <div className="rvx-tabs">
            {(["Balanced", "Performance", "Efficiency"] as const).map((item) => <button key={item} type="button" className={policy === item ? "on" : ""} onClick={() => setPolicy(item)}>{item}</button>)}
          </div>
        </div>
        <div>
          <h3>Frequency over time</h3>
          <svg className="dsk-chart" viewBox="0 0 280 140" role="img" aria-label="Frequency over time">
            <polyline points={line(pTrace, 6)} />
            <polyline className="e" points={line(eTrace, 6)} />
          </svg>
          <p className="dsk-legend"><i /> P-core <i className="e" /> E-core · limited by {model.limited}</p>
        </div>
      </div>
      <div className="dsk-metrics">
        <article><b>Current frequency</b><span>P-cores {pNow.toFixed(1)} GHz</span><span>E-cores {eNow.toFixed(1)} GHz</span><span>{cores} active cores</span></article>
        <article><b>Package power</b><strong>{watts} W</strong><span>illustrative</span></article>
        <article><b>CPU temperature</b><strong className={temp > 90 ? "hot" : ""}>{temp} °C</strong><span>{temp > 95 ? "boost reduced" : "headroom"}</span></article>
      </div>
    </section>
  );
}

const COOLERS = [
  { id: "stock", name: "Stock Air Cooler", eff: 0.42 },
  { id: "tower", name: "Tower Air Cooler", eff: 0.7 },
  { id: "aio", name: "AIO Liquid Cooler", eff: 0.86 },
  { id: "high", name: "High-End Air Cooler", eff: 0.8 },
] as const;

const THERMAL_JOBS = ["Idle", "Web browsing", "Gaming", "Cinebench (all cores)", "Compile"] as const;

export function ThermalPage() {
  const [cooler, setCooler] = useState<(typeof COOLERS)[number]["id"]>("tower");
  const [ambient, setAmbient] = useState(25);
  const [fan, setFan] = useState(55);
  const [work, setWork] = useState<(typeof THERMAL_JOBS)[number]>("Cinebench (all cores)");
  const [limit, setLimit] = useState(95);
  const [playing, setPlaying] = useState(false);
  const [temp, setTemp] = useState(48);
  const [history, setHistory] = useState<number[]>([48]);
  const selected = COOLERS.find((item) => item.id === cooler) ?? COOLERS[1];
  const demand = work === "Idle" ? 12 : work === "Web browsing" ? 28 : work === "Gaming" ? 62 : work === "Compile" ? 78 : 90;
  useEffect(() => {
    if (!playing) return undefined;
    const id = window.setInterval(() => {
      setTemp((current) => {
        const target = ambient + demand * 0.62 * (1.2 - selected.eff) * (1.25 - fan / 180);
        const next = current + (target - current) * 0.16;
        setHistory((rows) => [...rows.slice(-31), Math.round(next)]);
        return next;
      });
    }, 320);
    return () => window.clearInterval(id);
  }, [playing, ambient, demand, fan, selected]);
  const state = temp >= limit ? "Throttling" : temp > limit - 8 ? "Near Limit" : temp > 65 ? "Warm" : "Normal";
  const rpm = 700 + fan * 22;
  return (
    <section className="dsk-panel">
      <div className={`dsk-cooler${playing ? " go" : ""}`} aria-hidden="true">
        <div className="fins" />
        <div className="fan" />
        <span className="in">Cool air in</span>
        <span className="out">Hot air out</span>
      </div>
      <h3>Thermal simulation</h3>
      <div className="dsk-boost">
        <div className="dsk-controls">
          <label>Cooling solution
            <select aria-label="Cooling solution" value={cooler} onChange={(event) => setCooler(event.target.value as typeof cooler)}>{COOLERS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          </label>
          <label>Ambient temperature {ambient} °C<input aria-label="Ambient temperature" type="range" min={15} max={35} value={ambient} onChange={(event) => setAmbient(Number(event.target.value))} /></label>
          <label>Fan speed {fan}<input aria-label="Fan speed" type="range" min={10} max={100} value={fan} onChange={(event) => setFan(Number(event.target.value))} /></label>
          <label>Workload
            <select aria-label="Thermal workload" value={work} onChange={(event) => setWork(event.target.value as typeof work)}>{THERMAL_JOBS.map((item) => <option key={item}>{item}</option>)}</select>
          </label>
          <label>Thermal limit {limit} °C<input aria-label="Thermal limit" type="range" min={70} max={105} value={limit} onChange={(event) => setLimit(Number(event.target.value))} /></label>
          <div className="cmp-actions">
            <button type="button" className="cmp-primary" onClick={() => setPlaying((value) => !value)}>{playing ? "Pause" : "Run simulation"}</button>
            <button type="button" onClick={() => { setPlaying(false); setTemp(ambient + 12); setHistory([ambient + 12]); }}>Reset</button>
          </div>
        </div>
        <div className="dsk-metrics tall">
          <article><b>CPU temperature</b><strong className={state === "Throttling" ? "hot" : ""}>{Math.round(temp)} °C</strong></article>
          <article><b>Fan speed</b><strong>{rpm} RPM</strong><span>illustrative</span></article>
          <article><b>Thermal state</b><strong>{state}</strong>{state === "Throttling" ? <span>frequency cut to about 70%</span> : <span>heat path: die → interface → cooler → air</span>}</article>
        </div>
      </div>
      <div className="dsk-bars" aria-label="Temperature over time">{history.map((value, index) => <i key={index} style={{ height: `${Math.min(100, value)}%` }} />)}</div>
    </section>
  );
}

const LOADS = [
  { id: "game", name: "Gaming", cpu: 65, gpu: 92, mem: 48, io: 35, store: 18, power: 78, temp: 72, note: ["Game logic, physics, audio", "Rendering, shaders, textures", "Game assets, textures, buffers", "Game data loading (SSD)"] },
  { id: "create", name: "Content Creation", cpu: 88, gpu: 64, mem: 82, io: 40, store: 74, power: 90, temp: 84, note: ["Encode, effects, timeline", "Preview and effects", "Large frames and caches", "Media reads and writes"] },
  { id: "office", name: "Productivity", cpu: 28, gpu: 12, mem: 24, io: 10, store: 14, power: 22, temp: 46, note: ["Office threads", "Light display", "Documents", "Occasional disk"] },
  { id: "stream", name: "Streaming", cpu: 62, gpu: 55, mem: 44, io: 58, store: 22, power: 70, temp: 74, note: ["Game plus encode", "Capture or encode", "Frame buffers", "Upload"] },
  { id: "compile", name: "Compilation", cpu: 96, gpu: 6, mem: 52, io: 12, store: 46, power: 76, temp: 80, note: ["Many compiler threads", "Almost idle", "Source and objects", "Many small files"] },
  { id: "ai", name: "AI inference", cpu: 42, gpu: 74, mem: 63, io: 16, store: 28, power: 68, temp: 76, note: ["Dispatch", "Matrix work if on GPU", "Weights", "Model load"] },
  { id: "zip", name: "File Compression", cpu: 82, gpu: 2, mem: 36, io: 8, store: 78, power: 60, temp: 70, note: ["Compress threads", "Idle", "Working buffers", "Read and write"] },
  { id: "idle", name: "Idle", cpu: 4, gpu: 2, mem: 6, io: 2, store: 1, power: 8, temp: 36, note: ["Parked cores", "Idle display", "Background", "Almost none"] },
] as const;

function Gauge({ label, value, color }: { label: string; value: number; color: string }) {
  const radius = 28;
  const circ = 2 * Math.PI * radius;
  return (
    <svg className="dsk-gauge" viewBox="0 0 80 80" role="img" aria-label={`${label} ${value}%`}>
      <circle cx="40" cy="40" r={radius} />
      <circle cx="40" cy="40" r={radius} stroke={color} strokeDasharray={`${(value / 100) * circ} ${circ}`} />
      <text x="40" y="38">{label}</text>
      <text x="40" y="52">{value}%</text>
    </svg>
  );
}

export function WorkloadPage() {
  const [id, setId] = useState<(typeof LOADS)[number]["id"]>("game");
  const [playing, setPlaying] = useState(false);
  const [tick, setTick] = useState(0);
  const job = LOADS.find((item) => item.id === id) ?? LOADS[0];
  useEffect(() => {
    if (!playing) return undefined;
    const timer = window.setInterval(() => setTick((value) => value + 1), 450);
    return () => window.clearInterval(timer);
  }, [playing]);
  const wave = playing ? 0.94 + (tick % 5) * 0.015 : 1;
  const scale = (value: number) => Math.round(value * wave);
  return (
    <section className="dsk-panel">
      <div className="rvx-tabs">{LOADS.map((item) => <button key={item.id} type="button" className={id === item.id ? "on" : ""} onClick={() => { setId(item.id); setTick(0); }}>{item.name}</button>)}</div>
      <div className="dsk-work">
        <div className={`dsk-scene ${job.id}`}><b>{job.name}</b></div>
        <div>
          <h3>Resource utilization</h3>
          <div className="dsk-gauges">
            <Gauge label="CPU" value={scale(job.cpu)} color="#16a34a" />
            <Gauge label="GPU" value={scale(job.gpu)} color="#2563eb" />
            <Gauge label="Memory" value={scale(job.mem)} color="#059669" />
            <Gauge label="I/O" value={scale(job.io)} color="#7c3aed" />
          </div>
        </div>
      </div>
      <div className="cmp-actions">
        <button type="button" className="cmp-primary" onClick={() => setPlaying(true)}>Run</button>
        <button type="button" onClick={() => setPlaying(false)}>Pause</button>
        <button type="button" onClick={() => { setPlaying(false); setTick(0); }}>Reset</button>
      </div>
      <h3>Workload characteristics</h3>
      <table className="dsk-table">
        <tbody>
          <tr><th>CPU usage</th><td>{job.note[0]} · {scale(job.cpu)}%</td></tr>
          <tr><th>GPU usage</th><td>{job.note[1]} · {scale(job.gpu)}%</td></tr>
          <tr><th>Memory usage</th><td>{job.note[2]} · {scale(job.mem)}%</td></tr>
          <tr><th>Storage I/O</th><td>{job.note[3]} · {scale(job.store)}%</td></tr>
          <tr><th>Package power / temp</th><td>{job.power} W illustrative · {job.temp} °C sketch · cache {job.cpu > 50 ? "busy" : "quiet"}</td></tr>
        </tbody>
      </table>
    </section>
  );
}

const QUIZ = [
  { topic: "Caches", q: "Which component is closest to the core and typically has the lowest latency?", choices: ["L3 Cache", "L2 Cache", "L1 Cache", "DDR Memory"], a: 2, why: "L1 is the smallest private cache beside the core." },
  { topic: "Caches", q: "A working set that fits in L2 but not L1 should mostly…", choices: ["Miss L1, then hit L2", "Skip straight to DDR", "Miss every level", "Use a PCIe lane"], a: 0, why: "The request checks L1, misses, and is satisfied from L2." },
  { topic: "Memory", q: "Adding a second DDR channel changes peak bandwidth by…", choices: ["Multiplying by the channel count", "Halving CAS automatically", "Removing the controller", "Converting DDR into PCIe"], a: 0, why: "Peak ≈ transfers/s × bytes per transfer × channels." },
  { topic: "Memory", q: "DDR5-5200, 64-bit bus, two channels. What is the peak?", choices: ["83.2 GB/s", "5.2 GB/s", "520 GB/s", "64 GB/s regardless of rate"], a: 0, why: "5200 MT/s × 8 bytes × 2 channels = 83.2 GB/s." },
  { topic: "PCIe", q: "Sixteen lanes given to a GPU is called…", choices: ["x16", "x1", "Dual channel", "L3"], a: 0, why: "x16 means sixteen lanes on that link." },
  { topic: "PCIe", q: "x16 + x4 + x4 on a 16-lane example root complex…", choices: ["Exceeds the lane budget", "Sets bandwidth to zero", "Grows L2", "Changes the ISA"], a: 0, why: "16 + 4 + 4 = 24, which is more than 16." },
  { topic: "PCIe", q: "Why is PCIe 4.0 shown as about 2 GB/s per lane?", choices: ["It rounds a real peak near 1.969 GB/s", "It is the DDR clock", "It counts both directions as one number with no label", "It is package power"], a: 0, why: "The encoded one-direction peak is about 1.969 GB/s. 2 is the classroom figure." },
  { topic: "Boost", q: "A short burst versus a sustained heavy load. This model…", choices: ["Lets the burst sit higher, then settles lower", "Holds the maximum forever", "Ignores the power limit", "Always runs E-cores faster than P-cores"], a: 0, why: "Headroom is larger for a burst. Sustained load and a tight limit pull frequency down." },
  { topic: "Boost", q: "Lowering the power limit should…", choices: ["Reduce available boost", "Add a DDR channel", "Disable L1", "Add PCIe lanes"], a: 0, why: "The educational model scales boost by power-limit headroom." },
  { topic: "Package", q: "The heat spreader is…", choices: ["The metal lid that spreads heat into the cooler", "The L1 cache", "A DDR rank", "A PCIe lane"], a: 0, why: "The IHS is the lid. The cores are on the die underneath." },
  { topic: "Cores", q: "Which statement matches this studio?", choices: ["Not every desktop CPU has both P-cores and E-cores", "Every desktop CPU has eight E-cores", "L3 is always private", "PCIe lanes are DRAM channels"], a: 0, why: "A P/E mix is common recently. It is not a rule of the desktop category." },
  { topic: "Thermal", q: "Temperature crosses the thermal limit. The thermal lab…", choices: ["Marks throttling and cuts frequency", "Adds a DDR channel", "Turns the score into watts", "Removes the die"], a: 0, why: "Throttling is the teaching response when the limit is crossed." },
  { topic: "Thermal", q: "Raising fan speed…", choices: ["Pulls the balance temperature down", "Raises ambient temperature", "Removes the heatsink", "Doubles CAS latency"], a: 0, why: "More airflow raises cooling effectiveness, so the equilibrium falls." },
  { topic: "Workloads", q: "Compilation in this lab leans on which resource most?", choices: ["CPU", "A discrete GPU", "The NIC", "Only the fan"], a: 0, why: "The compile preset is core-heavy. The GPU stays low." },
  { topic: "Workloads", q: "Gaming in this lab leans on which resource most?", choices: ["GPU", "Storage only", "CAS latency", "The chipset fan"], a: 0, why: "The gaming preset puts the GPU near the top." },
  { topic: "Caches", q: "L3 in this example is…", choices: ["Shared by the cores", "Private to one E-core only", "Off-package DRAM", "A PCIe device"], a: 0, why: "L1 and L2 are private. L3 is the shared last level." },
];

const TOPICS = ["CPU Package", "Cores", "Caches", "Memory (DDR)", "PCIe & I/O", "Boost & Power", "Thermal", "System Workloads"];

export function PracticePage() {
  const [mode, setMode] = useState<"quiz" | "cards" | "summary">("quiz");
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [show, setShow] = useState(false);
  const [score, setScore] = useState(0);
  const [seen, setSeen] = useState(0);
  const [card, setCard] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const item = QUIZ[index] ?? QUIZ[0];
  const face = QUIZ[card] ?? QUIZ[0];
  const go = (next: number) => { setIndex(next); setPicked(null); setChecked(false); setShow(false); };
  if (!item || !face) return null;;
  return (
    <div className="dsk-quiz">
      <section className="dsk-panel">
        <div className="rvx-tabs">
          <button type="button" className={mode === "quiz" ? "on" : ""} onClick={() => setMode("quiz")}>Quiz</button>
          <button type="button" className={mode === "cards" ? "on" : ""} onClick={() => setMode("cards")}>Flashcards</button>
          <button type="button" className={mode === "summary" ? "on" : ""} onClick={() => setMode("summary")}>Summary</button>
        </div>
        {mode === "quiz" && (
          <>
            <p>Question {index + 1} of {QUIZ.length}</p>
            <h3>{item.q}</h3>
            <div className="dsk-choices">
              {item.choices.map((choice, choiceIndex) => (
                <button key={choice} type="button" className={picked === choiceIndex ? "on" : ""} onClick={() => { if (!checked) setPicked(choiceIndex); }}>
                  <i />{choice}
                </button>
              ))}
            </div>
            {checked && <p className={picked === item.a ? "dsk-ok" : "dsk-bad"}><b>{picked === item.a ? "Correct" : "Not this one"}</b> {item.why}</p>}
            {show && !checked && <p className="dsk-ok"><b>Explanation</b> {item.why}</p>}
            <div className="cmp-actions">
              <button type="button" onClick={() => go(Math.max(0, index - 1))}>Previous</button>
              <button type="button" className="cmp-primary" onClick={() => go(Math.min(QUIZ.length - 1, index + 1))}>Next</button>
            </div>
            <div className="cmp-actions">
              <button type="button" onClick={() => {
                if (picked === null || checked) return;
                setChecked(true);
                setSeen((value) => value + 1);
                if (picked === item.a) setScore((value) => value + 1);
              }}>Check answer</button>
              <button type="button" onClick={() => setShow(true)}>Show explanation</button>
              <button type="button" onClick={() => { setIndex(0); setPicked(null); setChecked(false); setShow(false); setScore(0); setSeen(0); }}>Reset quiz</button>
            </div>
          </>
        )}
        {mode === "cards" && (
          <>
            <button type="button" className="dsk-card" onClick={() => setFlipped((value) => !value)}>
              <b>{flipped ? face.why : face.q}</b>
              <span>{flipped ? "Answer" : "Tap to flip"} · {card + 1} / {QUIZ.length}</span>
            </button>
            <div className="cmp-actions">
              <button type="button" onClick={() => { setCard((value) => Math.max(0, value - 1)); setFlipped(false); }}>Previous</button>
              <button type="button" className="cmp-primary" onClick={() => { setCard((value) => Math.min(QUIZ.length - 1, value + 1)); setFlipped(false); }}>Next</button>
            </div>
          </>
        )}
        {mode === "summary" && (
          <>
            <p>Score {score} from {seen} checked answers, out of {QUIZ.length} questions.</p>
            <ul className="dsk-topics">{TOPICS.map((topic) => <li key={topic}>{topic}</li>)}</ul>
            <button type="button" onClick={() => { setMode("quiz"); setIndex(0); setPicked(null); setChecked(false); setShow(false); setScore(0); setSeen(0); }}>Reset quiz</button>
          </>
        )}
      </section>
      <aside className="dsk-panel">
        <h3>Quiz progress</h3>
        <p>{score} / {QUIZ.length}</p>
        <div className="dsk-progress"><i style={{ width: `${((index + 1) / QUIZ.length) * 100}%` }} /></div>
        <p>{index + 1} / {QUIZ.length}</p>
        <h3>Topics</h3>
        <ul className="dsk-topics">{TOPICS.map((topic) => <li key={topic}>{topic}</li>)}</ul>
      </aside>
    </div>
  );
}
