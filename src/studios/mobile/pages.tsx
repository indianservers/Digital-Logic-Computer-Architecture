import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { MOBILE_WORKS, thermal } from "../../engines/isaarch/mobile";
import { usePrefs } from "../../store/prefs";

const DIE = [
  { id: "cpu-cores", name: "CPU", hint: "P-cores and E-cores", tone: "cpu" },
  { id: "gpu", name: "GPU", hint: "Shaders and tiles", tone: "gpu" },
  { id: "npu", name: "NPU", hint: "Tensor array", tone: "npu" },
  { id: "isp", name: "ISP", hint: "Camera pipeline", tone: "isp" },
  { id: "memory", name: "Memory", hint: "Cache and LPDDR", tone: "mem" },
  { id: "connectivity", name: "Modem", hint: "Radio subsystem", tone: "mod" },
  { id: "overview", name: "NoC", hint: "Interconnect", tone: "noc" },
  { id: "power-thermal", name: "Power", hint: "DVFS and thermal", tone: "pwr" },
] as const;

export function HomePage() {
  const [tip, setTip] = useState("Click a block on the package.");
  return (
    <section className="mob-hero">
      <div>
        <p className="cmp-kicker">Generic educational SoC</p>
        <h2>One package. Many engines.</h2>
        <p>This is not a vendor die photo. The blocks are the usual clients of a phone SoC: CPU, GPU, NPU, ISP, memory, modem, interconnect, and power.</p>
        <Link className="cmp-primary" to="/architecture/mobile/overview">Start Exploring</Link>
        <p className="cmp-hint">{tip}</p>
      </div>
      <div className="mob-die" aria-label="Mobile SoC package">
        {DIE.map((block) => (
          <Link key={block.id} className={`mob-die-block ${block.tone}`} to={`/architecture/mobile/${block.id}`} title={block.hint} onMouseEnter={() => setTip(`${block.name}: ${block.hint}`)}>
            <b>{block.name}</b>
            <span>{block.hint}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

const BLOCKS = [
  { id: "CPU", path: "/architecture/mobile/cpu-cores", purpose: "Runs the operating system and latency-sensitive threads.", inputs: "Instructions, cache lines", outputs: "Requests to the interconnect", work: "UI, apps, orchestration", power: "High when P-cores are busy" },
  { id: "GPU", path: "/architecture/mobile/gpu", purpose: "Draws frames and runs wide compute shaders.", inputs: "Command buffers, textures", outputs: "Tiles toward display and memory", work: "Games, compositing, filters", power: "Bursty with resolution" },
  { id: "NPU", path: "/architecture/mobile/npu", purpose: "Accelerates tensor and MAC work.", inputs: "Weights and activations", outputs: "Inference results", work: "On-device models", power: "Efficient per MAC when data is local" },
  { id: "ISP", path: "/architecture/mobile/isp", purpose: "Turns a sensor frame into an image.", inputs: "Raw pixels", outputs: "Processed frames in memory", work: "Photo and preview", power: "Follows sensor rate" },
  { id: "Media", path: "/architecture/mobile/isp", purpose: "Encodes and decodes video.", inputs: "Bitstreams", outputs: "Frames", work: "Playback and recording", power: "Lower than doing the same work on CPU" },
  { id: "Modem", path: "/architecture/mobile/connectivity", purpose: "Moves packets between radios and memory.", inputs: "RF samples", outputs: "Packets", work: "Calls, data, location", power: "Depends on signal, illustratively" },
  { id: "Memory", path: "/architecture/mobile/memory", purpose: "Shared cache and LPDDR controller.", inputs: "Requests from every engine", outputs: "Lines and bursts", work: "Almost every scenario", power: "Grows with bandwidth" },
  { id: "NoC", path: "/architecture/mobile/memory", purpose: "Carries requests between clients.", inputs: "Engine requests", outputs: "Responses", work: "All concurrent traffic", power: "Activity, not a compute score" },
  { id: "Display", path: "/architecture/mobile/integration", purpose: "Scans a framebuffer to the panel.", inputs: "Composited frames", outputs: "Pixels", work: "Always-on while the screen is lit", power: "Mostly the panel, partly the pipe" },
  { id: "Security", path: "/architecture/mobile/overview", purpose: "Isolates keys and boot in this sketch.", inputs: "Boot and key requests", outputs: "Allow or deny", work: "Startup and protected storage", power: "Small and mostly idle" },
  { id: "PMU", path: "/architecture/mobile/power-thermal", purpose: "Clock, voltage, and power gates.", inputs: "Load and temperature", outputs: "Frequency and domain state", work: "Every workload", power: "The policy, not a consumer" },
  { id: "Storage", path: "/architecture/mobile/memory", purpose: "UFS-style backing store.", inputs: "File writes", outputs: "Blocks", work: "Photos, apps, video", power: "Spiky on capture" },
] as const;

const PATHS: Record<string, string[]> = {
  ISP: ["Sensor", "ISP", "Memory", "NPU", "Display"],
  CPU: ["CPU", "L1", "L2", "NoC", "Memory"],
  GPU: ["GPU", "Tile cache", "NoC", "Memory", "Display"],
  NPU: ["DMA", "SRAM", "MAC array", "Memory"],
  Modem: ["Antenna", "RF", "Baseband", "Memory", "CPU"],
};

export function OverviewPage() {
  const [id, setId] = useState<(typeof BLOCKS)[number]["id"]>("ISP");
  const block = BLOCKS.find((item) => item.id === id) ?? BLOCKS[0];
  const path = PATHS[id] ?? ["Block", "NoC", "Memory"];
  return (
    <div className="mob-split">
      <div className="mob-blocks">
        {BLOCKS.map((item) => (
          <button key={item.id} type="button" className={item.id === id ? "on" : ""} onClick={() => setId(item.id)}>{item.id}</button>
        ))}
      </div>
      <section className="rvx-card">
        <h3>{block.id}</h3>
        <p>{block.purpose}</p>
        <p><b>Inputs.</b> {block.inputs}</p>
        <p><b>Outputs.</b> {block.outputs}</p>
        <p><b>Typical work.</b> {block.work}</p>
        <p className="cmp-hint"><b>Power, conceptually.</b> {block.power}</p>
        <div className="mob-path">{path.map((step) => <span key={step}>{step}</span>)}</div>
        <Link to={block.path}>Open this lab</Link>
      </section>
    </div>
  );
}

const JOBS = [
  { id: "web", name: "Web Browsing", p: true, intensity: 45 },
  { id: "sync", name: "Background Sync", p: false, intensity: 20 },
  { id: "game", name: "Gaming", p: true, intensity: 90 },
  { id: "video", name: "Video Playback", p: false, intensity: 40 },
  { id: "photo", name: "Photo Processing", p: true, intensity: 70 },
  { id: "ai", name: "AI Assistant", p: false, intensity: 55 },
  { id: "idle", name: "Idle", p: false, intensity: 5 },
  { id: "mixed", name: "Mixed Workload", p: true, intensity: 60 },
] as const;

export function CpuPage() {
  const [job, setJob] = useState<(typeof JOBS)[number]["id"]>("web");
  const [pOn, setPOn] = useState(true);
  const [eOn, setEOn] = useState(true);
  const [bias, setBias] = useState<"perf" | "eff">("perf");
  const [intensity, setIntensity] = useState(45);
  const selected = JOBS.find((item) => item.id === job) ?? JOBS[0];
  const useP = pOn && (bias === "perf" ? selected.p || intensity > 50 : intensity > 75);
  const useE = eOn && (!useP || job === "mixed" || job === "game");
  const power = Math.round((useP ? 1.6 : 0) * intensity + (useE ? 0.45 : 0) * intensity);
  const heat = thermal(useP ? intensity : 10, 5, job === "ai" ? 40 : 0, 32);
  return (
    <>
      <div className="rvx-tabs">
        {JOBS.map((item) => <button key={item.id} type="button" className={job === item.id ? "on" : ""} onClick={() => { setJob(item.id); setIntensity(item.intensity); }}>{item.name}</button>)}
      </div>
      <div className="mob-split">
        <section className="rvx-card">
          <h3>Cluster</h3>
          <div className="mob-cores">
            {["P0", "P1"].map((name) => <div key={name} className={useP ? "p on" : "p"}><b>{name}</b><span>{useP ? `${Math.round(1.2 + intensity / 80)} GHz illus.` : "gated"}</span></div>)}
            {["E0", "E1", "E2", "E3"].map((name) => <div key={name} className={useE ? "e on" : "e"}><b>{name}</b><span>{useE ? "efficiency" : "idle"}</span></div>)}
          </div>
          <p className="cmp-hint">P-cores: higher peak, more execution resources, larger private cache in this model. E-cores: lower power, background and light work. Frequencies such as 3.2 GHz and 2.0 GHz in diagrams are examples, not a part.</p>
        </section>
        <section className="rvx-card">
          <label><input type="checkbox" checked={pOn} onChange={(event) => setPOn(event.target.checked)} /> Enable P-cores</label>
          <label><input type="checkbox" checked={eOn} onChange={(event) => setEOn(event.target.checked)} /> Enable E-cores</label>
          <div className="rvx-tabs">
            <button type="button" className={bias === "perf" ? "on" : ""} onClick={() => setBias("perf")}>Performance priority</button>
            <button type="button" className={bias === "eff" ? "on" : ""} onClick={() => setBias("eff")}>Efficiency priority</button>
          </div>
          <label>Intensity {intensity}<input aria-label="Workload intensity" type="range" min={0} max={100} value={intensity} onChange={(event) => setIntensity(Number(event.target.value))} /></label>
          <p>Utilization {intensity}% · illustrative power {power} · temperature contribution {heat.temp}° · {heat.migrate ? "hot enough to prefer E-cores" : "no migration"}</p>
          <p>Known studio workloads still route by rule: {MOBILE_WORKS.map((item) => `${item.name} → ${item.recommend}`).join("; ")}.</p>
        </section>
      </div>
    </>
  );
}

export function GpuPage() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(true);
  const [resolution, setResolution] = useState(1);
  const [complexity, setComplexity] = useState(12);
  const [wire, setWire] = useState(false);
  const [stats, setStats] = useState({ fps: 0, tris: 12, fragments: 0 });
  useEffect(() => {
    const node = canvas.current;
    if (!node) return undefined;
    const ctx = node.getContext("2d");
    if (!ctx) return undefined;
    let frame = 0;
    let last = performance.now();
    let raf = 0;
    const draw = (now: number) => {
      if (now - last > 400) {
        setStats({ fps: Math.round(1000 / Math.max(16, now - last) * (playing ? 1 : 0.2)), tris: complexity, fragments: Math.round(complexity * 80 * resolution) });
        last = now;
      }
      const w = node.width;
      const h = node.height;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#e8f1ff";
      ctx.fillRect(0, 0, w, h);
      const angle = playing ? frame * 0.03 : 0.4;
      for (let i = 0; i < complexity; i += 1) {
        const a = angle + i * 0.4;
        ctx.beginPath();
        ctx.moveTo(w / 2 + Math.cos(a) * 70, h / 2 + Math.sin(a) * 40);
        ctx.lineTo(w / 2 + Math.cos(a + 2) * 50, h / 2 + Math.sin(a + 1) * 60);
        ctx.lineTo(w / 2 + Math.cos(a + 4) * 30, h / 2 + 20);
        ctx.closePath();
        ctx.strokeStyle = "#0f766e";
        ctx.fillStyle = `hsl(${160 + i * 8} 60% 45% / 0.75)`;
        if (!wire) ctx.fill();
        ctx.stroke();
      }
      frame += 1;
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [playing, complexity, wire, resolution]);
  return (
    <section className="rvx-card">
      <h3>Simplified educational simulation</h3>
      <div className="mob-gpu">
        <ol><li>Command processor</li><li>Geometry</li><li>Rasterizer</li><li>Fragment</li><li>Output</li></ol>
        <canvas ref={canvas} width={480} height={260} aria-label="GPU scene" />
      </div>
      <div className="cmp-actions">
        <button type="button" className="cmp-primary" onClick={() => setPlaying((value) => !value)}>{playing ? "Pause" : "Run"}</button>
        <button type="button" onClick={() => { setPlaying(false); setComplexity(12); setWire(false); setResolution(1); }}>Reset</button>
        <label><input type="checkbox" checked={wire} onChange={(event) => setWire(event.target.checked)} /> Wireframe</label>
      </div>
      <label>Resolution scale {resolution.toFixed(1)}<input aria-label="Resolution" type="range" min={0.5} max={2} step={0.1} value={resolution} onChange={(event) => setResolution(Number(event.target.value))} /></label>
      <label>Complexity {complexity}<input aria-label="Triangle count" type="range" min={3} max={40} value={complexity} onChange={(event) => setComplexity(Number(event.target.value))} /></label>
      <p>Triangles {stats.tris} · fragments ~{stats.fragments} · frame pace ~{stats.fps} · teaching bandwidth {Math.round(stats.fragments / 50)} units. Not a measured GPU.</p>
      <p className="cmp-hint">Tile-based rendering, in this sketch, shades a tile while its working set stays in an on-chip buffer, then writes the tile out. Shader cores, texture units, and the memory interface share that path.</p>
    </section>
  );
}

function classify(data: Uint8ClampedArray): Array<{ label: string; score: number }> {
  let r = 0; let g = 0; let b = 0; let n = 0;
  for (let i = 0; i < data.length; i += 16) {
    r += data[i] ?? 0; g += data[i + 1] ?? 0; b += data[i + 2] ?? 0; n += 1;
  }
  const rn = r / Math.max(1, n);
  const gn = g / Math.max(1, n);
  const bn = b / Math.max(1, n);
  const scores = [
    { label: "warm scene", score: rn / 255 },
    { label: "foliage / green", score: gn / 255 },
    { label: "cool / blue", score: bn / 255 },
    { label: "balanced", score: 1 - Math.abs(rn - gn) / 255 },
  ].sort((a, b) => b.score - a.score);
  return scores;
}

export function NpuPage() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [kind, setKind] = useState("image");
  const [preds, setPreds] = useState<Array<{ label: string; score: number }>>([]);
  const [ms, setMs] = useState(0);
  const [stage, setStage] = useState(0);
  const stages = ["Input", "DMA", "SRAM", "MAC array", "Activation", "Output"];
  const paint = (mode: string) => {
    const node = canvas.current;
    const ctx = node?.getContext("2d");
    if (!node || !ctx) return;
    ctx.clearRect(0, 0, node.width, node.height);
    if (mode === "image") { ctx.fillStyle = "#fb923c"; ctx.fillRect(0, 0, 80, 96); ctx.fillStyle = "#22c55e"; ctx.fillRect(80, 0, 80, 96); ctx.fillStyle = "#38bdf8"; ctx.fillRect(160, 0, 80, 96); }
    if (mode === "detect") { ctx.fillStyle = "#0f172a"; ctx.fillRect(0, 0, 240, 96); ctx.strokeStyle = "#a78bfa"; ctx.strokeRect(40, 20, 70, 50); }
    if (mode === "audio") { ctx.fillStyle = "#1e293b"; ctx.fillRect(0, 0, 240, 96); ctx.strokeStyle = "#34d399"; ctx.beginPath(); for (let x = 0; x < 240; x += 4) ctx.lineTo(x, 48 + Math.sin(x / 8) * 20); ctx.stroke(); }
  };
  useEffect(() => { paint(kind); }, [kind]);
  const run = () => {
    const node = canvas.current;
    const ctx = node?.getContext("2d");
    if (!node || !ctx) return;
    const start = performance.now();
    const data = ctx.getImageData(0, 0, node.width, node.height).data;
    setPreds(classify(data));
    setMs(Math.round(performance.now() - start));
    setStage(0);
    let step = 0;
    const timer = window.setInterval(() => {
      step += 1;
      setStage(step);
      if (step >= stages.length - 1) window.clearInterval(timer);
    }, 280);
  };
  return (
    <section className="rvx-card">
      <h3>Browser-only classifier · conceptual NPU metrics</h3>
      <div className="rvx-tabs">
        {([["image", "Image colors"], ["detect", "Box sample"], ["audio", "Wave sample"]] as const).map(([id, label]) => <button key={id} type="button" className={kind === id ? "on" : ""} onClick={() => setKind(id)}>{label}</button>)}
      </div>
      <canvas ref={canvas} width={240} height={96} aria-label="NPU input" />
      <label>Upload <input aria-label="Upload image" type="file" accept="image/*" onChange={(event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const img = new Image();
        img.onload = () => { const ctx = canvas.current?.getContext("2d"); ctx?.drawImage(img, 0, 0, 240, 96); };
        img.src = URL.createObjectURL(file);
      }} /></label>
      <button type="button" className="cmp-primary" onClick={run}>Run inference</button>
      <div className="mob-path">{stages.map((item, index) => <span key={item} className={index === stage ? "on" : ""}>{item}</span>)}</div>
      <p>Local time {ms} ms · input 240×96×4 · MAC array is illustrative, not a TOPS rating.</p>
      {preds.map((item) => <p key={item.label}>{item.label} · {(item.score * 100).toFixed(0)}%</p>)}
      <p className="cmp-hint">Control issues DMA into on-chip SRAM. The array multiplies and accumulates. An activation writes the result. A real NPU’s width is a microarchitecture choice.</p>
    </section>
  );
}

export function IspPage() {
  const before = useRef<HTMLCanvasElement>(null);
  const after = useRef<HTMLCanvasElement>(null);
  const [stage, setStage] = useState(3);
  const [exposure, setExposure] = useState(1);
  const [denoise, setDenoise] = useState(0);
  const [sat, setSat] = useState(1);
  const [contrast, setContrast] = useState(1);
  const [sharp, setSharp] = useState(0);
  const stages = ["RAW sensor", "Demosaic", "Noise reduction", "Color", "Tone", "Sharpen", "Output"];
  useEffect(() => {
    const src = before.current?.getContext("2d");
    const dst = after.current?.getContext("2d");
    if (!src || !dst || !before.current || !after.current) return;
    const w = before.current.width;
    const h = before.current.height;
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const mosaic = (x + y) % 2 === 0 ? 180 : 40;
        src.fillStyle = `rgb(${mosaic}, ${80 + (y % 3) * 20}, ${60 + (x % 4) * 15})`;
        src.fillRect(x, y, 1, 1);
      }
    }
    const image = src.getImageData(0, 0, w, h);
    const data = image.data;
    for (let i = 0; i < data.length; i += 4) {
      let r = (data[i] ?? 0) * exposure;
      let g = (data[i + 1] ?? 0) * exposure;
      let b = (data[i + 2] ?? 0) * exposure;
      if (stage >= 2) { const blur = denoise * 0.15; r = r * (1 - blur) + 120 * blur; g = g * (1 - blur) + 120 * blur; b = b * (1 - blur) + 120 * blur; }
      if (stage >= 3) { const avg = (r + g + b) / 3; r = avg + (r - avg) * sat; g = avg + (g - avg) * sat; b = avg + (b - avg) * sat; }
      if (stage >= 4) { r = (r - 128) * contrast + 128; g = (g - 128) * contrast + 128; b = (b - 128) * contrast + 128; }
      if (stage >= 5 && sharp > 0 && i > w * 4) { r += ((data[i] ?? 0) - (data[i - w * 4] ?? 0)) * sharp; }
      data[i] = Math.max(0, Math.min(255, r));
      data[i + 1] = Math.max(0, Math.min(255, g));
      data[i + 2] = Math.max(0, Math.min(255, b));
    }
    dst.putImageData(image, 0, 0);
  }, [stage, exposure, denoise, sat, contrast, sharp]);
  return (
    <section className="rvx-card">
      <div className="mob-path">{stages.map((item, index) => <button key={item} type="button" className={index === stage ? "on" : ""} onClick={() => setStage(index)}>{item}</button>)}</div>
      <div className="mob-split">
        <div><h3>Before</h3><canvas ref={before} width={180} height={120} aria-label="Sensor image" /></div>
        <div><h3>After</h3><canvas ref={after} width={180} height={120} aria-label="Processed image" /></div>
      </div>
      <label>Exposure {exposure.toFixed(1)}<input aria-label="Exposure" type="range" min={0.6} max={1.8} step={0.1} value={exposure} onChange={(event) => setExposure(Number(event.target.value))} /></label>
      <label>Denoise {denoise}<input aria-label="Denoise" type="range" min={0} max={10} value={denoise} onChange={(event) => setDenoise(Number(event.target.value))} /></label>
      <label>Saturation {sat.toFixed(1)}<input aria-label="Saturation" type="range" min={0} max={2} step={0.1} value={sat} onChange={(event) => setSat(Number(event.target.value))} /></label>
      <label>Contrast {contrast.toFixed(1)}<input aria-label="Contrast" type="range" min={0.6} max={1.6} step={0.1} value={contrast} onChange={(event) => setContrast(Number(event.target.value))} /></label>
      <label>Sharpen {sharp.toFixed(1)}<input aria-label="Sharpen" type="range" min={0} max={1.5} step={0.1} value={sharp} onChange={(event) => setSharp(Number(event.target.value))} /></label>
      <button type="button" onClick={() => { setStage(6); setExposure(1); setDenoise(0); setSat(1); setContrast(1); setSharp(0); }}>Reset</button>
      <p className="cmp-hint">{stages[stage]}. HDR here is the contrast control, a stand-in for merging exposures. White balance is the saturation shift. This is a canvas filter, not silicon.</p>
    </section>
  );
}

export function MemoryPage() {
  const [engine, setEngine] = useState("CPU");
  const [pattern, setPattern] = useState("sequential");
  const [step, setStep] = useState(0);
  const levels = ["Registers / private L1", "L2", "System cache", "LPDDR", "UFS"];
  const hit = pattern === "sequential" || pattern === "streaming" || pattern === "camera";
  const depth = hit ? 2 : pattern === "random" ? 4 : 3;
  return (
    <section className="rvx-card">
      <div className="rvx-tabs">
        {["CPU", "GPU", "NPU", "ISP", "Modem", "Display"].map((item) => <button key={item} type="button" className={engine === item ? "on" : ""} onClick={() => setEngine(item)}>{item}</button>)}
      </div>
      <div className="rvx-tabs">
        {["sequential", "random", "streaming", "tensor", "texture", "camera"].map((item) => <button key={item} type="button" className={pattern === item ? "on" : ""} onClick={() => { setPattern(item); setStep(0); }}>{item}</button>)}
      </div>
      <div className="mob-path">{levels.map((item, index) => <span key={item} className={index <= Math.min(step, depth) ? "on" : ""}>{item}</span>)}</div>
      <button type="button" className="cmp-primary" onClick={() => setStep((value) => Math.min(depth, value + 1))}>Step request</button>
      <p>{engine} · {pattern} · {hit ? "likely line reuse" : "miss toward DRAM"} · illustrative latency {8 + depth * 20} units · NoC busy {engine === "GPU" || engine === "ISP" ? "high" : "modest"}.</p>
      <p className="cmp-hint">Relative only: L1 is a few cycles, L2 more, system cache tens, LPDDR much more, storage far more. Several engines at once share the interconnect.</p>
    </section>
  );
}

export function ConnectivityPage() {
  const [net, setNet] = useState<"5G" | "LTE" | "Wi-Fi">("5G");
  const [signal, setSignal] = useState(70);
  const [load, setLoad] = useState(30);
  const [distance, setDistance] = useState(20);
  const base = net === "5G" ? 400 : net === "Wi-Fi" ? 250 : 80;
  const factor = (signal / 100) * (1 - distance / 200) * (1 - load / 150);
  const down = Math.max(1, Math.round(base * factor));
  const up = Math.max(1, Math.round(down * 0.2));
  const latency = Math.round(net === "Wi-Fi" ? 12 + distance / 5 : 20 + (100 - signal) / 2);
  const bars = Math.max(1, Math.round(signal / 25));
  return (
    <section className="rvx-card">
      <p className="cmp-hint">Illustrative simulation. Not a measured 5G, LTE, or Wi-Fi link.</p>
      <div className="mob-path"><span>Antenna</span><span>RF frontend</span><span>Baseband</span><span>Protocol stack</span><span>System memory</span></div>
      <div className="rvx-tabs">
        {(["5G", "LTE", "Wi-Fi"] as const).map((item) => <button key={item} type="button" className={net === item ? "on" : ""} onClick={() => setNet(item)}>{item}</button>)}
      </div>
      <p>Also on the package, as separate blocks: Bluetooth, GNSS, NFC. They are not this slider.</p>
      <label>Signal {signal}<input aria-label="Signal strength" type="range" min={5} max={100} value={signal} onChange={(event) => setSignal(Number(event.target.value))} /></label>
      <label>Network load {load}<input aria-label="Network load" type="range" min={0} max={100} value={load} onChange={(event) => setLoad(Number(event.target.value))} /></label>
      <label>Distance {distance}<input aria-label="Distance" type="range" min={1} max={100} value={distance} onChange={(event) => setDistance(Number(event.target.value))} /></label>
      <p>{"▮".repeat(bars)}{"▯".repeat(4 - bars)} · down {down} illustrative · up {up} · latency {latency} · modem power {signal < 40 ? "high" : "modest"}</p>
    </section>
  );
}

const LOADS = [
  { id: "Idle", cpu: 5, gpu: 2, npu: 0 },
  { id: "Web", cpu: 35, gpu: 15, npu: 0 },
  { id: "Gaming", cpu: 70, gpu: 90, npu: 5 },
  { id: "Camera", cpu: 40, gpu: 20, npu: 30 },
  { id: "Video", cpu: 25, gpu: 30, npu: 0 },
  { id: "AI", cpu: 20, gpu: 5, npu: 80 },
  { id: "Navigation", cpu: 30, gpu: 25, npu: 10 },
  { id: "Mixed", cpu: 55, gpu: 40, npu: 25 },
] as const;

export function PowerPage() {
  const [load, setLoad] = useState<(typeof LOADS)[number]["id"]>("Web");
  const [limit, setLimit] = useState(85);
  const [cool, setCool] = useState(40);
  const [playing, setPlaying] = useState(false);
  const [temp, setTemp] = useState(36);
  const [history, setHistory] = useState<number[]>([36]);
  const selected = LOADS.find((item) => item.id === load) ?? LOADS[1];
  useEffect(() => {
    if (!playing) return undefined;
    const id = window.setInterval(() => {
      setTemp((current) => {
        const target = thermal(selected.cpu, selected.gpu, selected.npu, 32 - cool / 10).temp;
        const next = current + Math.sign(target - current) * 0.8;
        setHistory((rows) => [...rows.slice(-24), Math.round(next)]);
        return next;
      });
    }, 400);
    return () => window.clearInterval(id);
  }, [playing, selected, cool]);
  const hot = thermal(selected.cpu, selected.gpu, selected.npu, temp);
  const throttled = temp >= limit;
  const freq = throttled ? 0.7 : 1;
  return (
    <section className="rvx-card">
      <p>Simplified educational thermal model.</p>
      <div className="rvx-tabs">{LOADS.map((item) => <button key={item.id} type="button" className={load === item.id ? "on" : ""} onClick={() => setLoad(item.id)}>{item.id}</button>)}</div>
      <div className="cmp-actions">
        <button type="button" className="cmp-primary" onClick={() => setPlaying((value) => !value)}>{playing ? "Pause" : "Run"}</button>
        <button type="button" onClick={() => { setPlaying(false); setTemp(36); setHistory([36]); }}>Reset</button>
      </div>
      <label>Thermal limit {limit}<input aria-label="Thermal limit" type="range" min={60} max={100} value={limit} onChange={(event) => setLimit(Number(event.target.value))} /></label>
      <label>Cooling {cool}<input aria-label="Cooling" type="range" min={0} max={100} value={cool} onChange={(event) => setCool(Number(event.target.value))} /></label>
      <p>CPU frequency scale {freq.toFixed(2)} · GPU load {selected.gpu} · NPU load {selected.npu} · power index {Math.round((selected.cpu + selected.gpu + selected.npu) * freq)} · {Math.round(temp)}° · {throttled ? "throttling" : hot.migrate ? "migrating heavy threads" : "within budget"}</p>
      <div className="mob-chart" aria-label="Temperature history">{history.map((value, index) => <i key={`${index}-${value}`} style={{ height: `${value}%` }} />)}</div>
      <p className="cmp-hint">Domains: CPU, GPU, NPU, ISP, modem, memory, display. Idle domains are treated as power-gated. DVFS here scales frequency when the temperature crosses the limit.</p>
    </section>
  );
}

const SCENES = [
  { id: "camera", name: "Launch Camera", blocks: ["Sensor", "ISP", "Memory", "Display"], cpu: 30, gpu: 15, npu: 10 },
  { id: "hdr", name: "Take HDR Photo", blocks: ["Sensor", "ISP", "Memory", "NPU", "CPU", "Storage"], cpu: 45, gpu: 20, npu: 50 },
  { id: "video", name: "Record 4K Video", blocks: ["ISP", "Media", "Memory", "Storage"], cpu: 35, gpu: 25, npu: 5 },
  { id: "game", name: "Play 3D Game", blocks: ["CPU", "GPU", "Memory", "Display", "Power"], cpu: 70, gpu: 90, npu: 0 },
  { id: "ai", name: "Run AI Assistant", blocks: ["CPU", "NPU", "Memory"], cpu: 25, gpu: 5, npu: 80 },
  { id: "call", name: "Video Call", blocks: ["ISP", "Modem", "CPU", "Display"], cpu: 40, gpu: 20, npu: 10 },
  { id: "nav", name: "Navigation", blocks: ["CPU", "GPU", "Modem", "Display"], cpu: 35, gpu: 30, npu: 10 },
  { id: "web", name: "Web Browsing", blocks: ["CPU", "GPU", "Modem", "Memory"], cpu: 40, gpu: 20, npu: 0 },
  { id: "sync", name: "Background Sync", blocks: ["E-cores", "Modem", "Storage"], cpu: 15, gpu: 0, npu: 0 },
] as const;

export function IntegrationPage() {
  const { prefs } = usePrefs();
  const [scene, setScene] = useState<(typeof SCENES)[number]["id"]>("hdr");
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const selected = SCENES.find((item) => item.id === scene) ?? SCENES[1];
  useEffect(() => {
    if (!playing) return undefined;
    const id = window.setInterval(() => setStep((value) => (value + 1) % selected.blocks.length), 700);
    return () => window.clearInterval(id);
  }, [playing, selected]);
  const heat = thermal(selected.cpu, selected.gpu, selected.npu, 34);
  return (
    <section className="rvx-card">
      <div className="rvx-tabs">{SCENES.map((item) => <button key={item.id} type="button" className={scene === item.id ? "on" : ""} onClick={() => { setScene(item.id); setStep(0); setPlaying(false); }}>{item.name}</button>)}</div>
      <div className="cmp-actions">
        <button type="button" className="cmp-primary" onClick={() => setPlaying(true)}>Run</button>
        <button type="button" onClick={() => setPlaying(false)}>Pause</button>
        <button type="button" onClick={() => { setPlaying(false); setStep((value) => (value + 1) % selected.blocks.length); }}>Step</button>
        <button type="button" onClick={() => { setPlaying(false); setStep(0); }}>Reset</button>
      </div>
      <div className="mob-path">{selected.blocks.map((block, index) => <span key={block} className={index === step ? "on" : index < step ? "done" : ""}>{block}</span>)}</div>
      <p>Active: {selected.blocks[step]}. Illustrative CPU {selected.cpu} · GPU {selected.gpu} · NPU {selected.npu} · power index {selected.cpu + selected.gpu + selected.npu} · temperature sketch {heat.temp}°.</p>
      {prefs.explain ? <p className="cmp-hint">The timeline lights one hop at a time. Earlier hops stay marked so you can see the path, not a ranking of blocks.</p> : null}
    </section>
  );
}
