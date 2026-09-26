import { useMemo, useState } from "react";
import { PREFETCH_DEFAULTS, PREFETCH_PRESETS, comparePrefetchers, type PrefetcherKind } from "../../../engines/aca/prefetch";
import { LabChrome, Toggle, Transport, usePlayback } from "./HazardLab";
import { PrefetchMark } from "../animation/phase3Views";
import { useGuideFocus } from "../guide/focus";

const KINDS: Array<{ id: PrefetcherKind; label: string }> = [
  { id: "next", label: "Next-line" },
  { id: "stride", label: "Stride" },
  { id: "stream", label: "Stream" },
  { id: "correlation", label: "Correlation" },
];

export function PrefetchLab() {
  const initial = PREFETCH_PRESETS[0];
  const [kind, setKind] = useState<PrefetcherKind>(initial?.kind ?? "next");
  const [presetId, setPresetId] = useState(initial?.id ?? "sequential");
  const [addresses, setAddresses] = useState<number[]>(initial?.addresses ?? []);
  const [degree, setDegree] = useState(PREFETCH_DEFAULTS.degree);
  const [confidence, setConfidence] = useState(PREFETCH_DEFAULTS.confidence);
  const [distance, setDistance] = useState(PREFETCH_DEFAULTS.distance);
  const [queueSize, setQueueSize] = useState(PREFETCH_DEFAULTS.queueSize);
  const [filterPollution, setFilterPollution] = useState(false);
  const [showPrefetch, setShowPrefetch] = useState(true);
  const [showCache, setShowCache] = useState(true);
  const [highlight, setHighlight] = useState(true);
  const [showPollution, setShowPollution] = useState(true);
  const [auto, setAuto] = useState(true);
  const [custom, setCustom] = useState("0x1000");
  const options = useMemo(() => ({ ...PREFETCH_DEFAULTS, degree, confidence, distance, queueSize, filterPollution, missLatency: 0 }), [degree, confidence, distance, queueSize, filterPollution]);
  const compared = useMemo(() => comparePrefetchers(addresses, options), [addresses, options]);
  const result = compared.results[kind];
  const play = usePlayback(Math.max(0, result.events.length - 1));
  const { id: guideFocus, setId: setGuideFocus } = useGuideFocus();
  const visible = result.events.slice(0, play.cycle === 0 ? 0 : play.cycle + 1);
  const current = play.cycle === 0 ? null : result.events[Math.min(play.cycle, result.events.length - 1)];
  const bar = (value: number) => `${Math.max(4, Math.min(100, value * 100))}%`;
  const hint = result.pollution > 0
    ? "A prefetch displaced a line. Read Pollution events and wasted bytes."
    : result.useful > 0
      ? "A demand used a line the prefetcher had already installed."
      : "Late stays 0 because miss latency is 0. Read Useful and wasted bytes.";
  const reading = `Useful ${result.useful}. Late ${result.late}. Pollution ${result.pollution}. Wasted bytes ${result.wastedBytes}.`;
  return (
    <LabChrome lab="prefetching" kicker="Labs > Lab 24" title="Lab 24 — Hardware Prefetcher Laboratory" subtitle="Explore hardware prefetching mechanisms and study the trade-offs between timeliness, accuracy, coverage, and cache pollution." badge="RISC-V (5-Stage Pipeline)" hint={hint} reading={reading}>
      <div className="vl-cards three">
        <article><h2>Learning Objective</h2><p>Accuracy is useful prefetches divided by prefetches issued. Coverage is demand misses removed versus a no-prefetch run of the same trace. A line that arrives after the demand is late, not an early hit.</p></article>
        <article><h2>Experiment Status</h2><p>{current ? current.detail : "Ready to run"}</p><p>This view uses miss latency 0, so a prefetch of the next block is installed before the following demand. A late count stays 0 until memory latency is longer than the gap between those accesses.</p></article>
        <article><h2>Trade-off</h2><p>A higher degree can cover more misses and also pull in lines the program never uses. Filtering refuses a prefetch that would evict a demand line.</p>
          <PrefetchMark result={current?.result ?? ""} detail={current?.detail ?? ""} speed={play.speed} cycle={play.cycle} />
        </article>
      </div>
      <div className="vl-cards three">
        <article>
          <h2>1. Prefetcher Configuration</h2>
          <div className="vl-types">
            {KINDS.map((item) => <button key={item.id} type="button" className={kind === item.id ? `${item.id} on` : item.id} onClick={() => { setKind(item.id); play.reset(); }}>{item.label}</button>)}
          </div>
          <label>Degree <input aria-label="Prefetch degree" type="number" min={1} max={4} value={degree} onChange={(event) => { setDegree(Math.max(1, Math.min(4, Number(event.target.value) || 1))); play.reset(); }} /></label>
          <label>Confidence <input aria-label="Confidence threshold" type="number" min={0} max={1} step={0.25} value={confidence} onChange={(event) => { setConfidence(Number(event.target.value)); play.reset(); }} /></label>
          <label>Distance <input aria-label="Prefetch distance" type="number" min={1} max={4} value={distance} onChange={(event) => { setDistance(Math.max(1, Math.min(4, Number(event.target.value) || 1))); play.reset(); }} /></label>
          <label>Queue size <input aria-label="Prefetch queue size" type="number" min={1} max={16} value={queueSize} onChange={(event) => { setQueueSize(Math.max(1, Math.min(16, Number(event.target.value) || 1))); play.reset(); }} /></label>
          <Toggle on={filterPollution} label="Enable Prefetch Filtering" onChange={(next) => { setFilterPollution(next); play.reset(); }} />
          <p>Degree is how many blocks to fetch. Distance is how far ahead the first one starts. Stride issues only after confidence reaches the threshold.</p>
        </article>
        <article>
          <h2>2. Memory Access Trace</h2>
          <p>Total accesses {addresses.length}.</p>
          <ol>
            {addresses.slice(0, 12).map((address, index) => <li key={`${address}-${index}`}>0x{address.toString(16)}</li>)}
          </ol>
          <label>Example
            <select aria-label="Load example" value={presetId} onChange={(event) => {
              const next = PREFETCH_PRESETS.find((item) => item.id === event.target.value);
              setPresetId(event.target.value);
              if (next) { setAddresses(next.addresses); setKind(next.kind); }
              play.reset();
            }}>
              {PREFETCH_PRESETS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
          <label>Add address <input aria-label="Custom address" value={custom} onChange={(event) => setCustom(event.target.value)} /></label>
          <button type="button" onClick={() => { const parsed = Number(custom); if (!Number.isNaN(parsed)) setAddresses((current) => [...current, parsed]); play.reset(); }}>Edit Trace</button>
        </article>
        <article>
          <h2>3. Prefetcher State</h2>
          <table>
            <thead><tr><th>#</th><th>Address</th><th>Status</th></tr></thead>
            <tbody>
              {result.issuedAddresses.slice(0, 8).map((address, index) => (
                <tr key={`${address}-${index}`}><td>{index}</td><td>0x{address.toString(16)}</td><td>Issued</td></tr>
              ))}
            </tbody>
          </table>
          <p>Issued {result.issued}. Dropped {result.dropped}. Queue limit {queueSize}.</p>
        </article>
      </div>
      <div className="vl-cards three">
        {showCache ? (
          <article>
            <h2 className={guideFocus === "stream" ? "aca-guide-on" : undefined}>4. Cache Line Activity</h2>
            <div className="vl-bytes" aria-label="Demand and prefetch events">
              {visible.slice(-24).map((item, index) => (
                <span key={`${item.cycle}-${index}`} style={{ flex: 1, background: item.result === "useful" || item.result === "hit" ? "#86efac" : item.kind === "prefetch" ? "#93c5fd" : item.result === "late" ? "#fde68a" : "#fecaca" }} title={item.detail}>{item.kind === "prefetch" ? "P" : "D"}</span>
              ))}
            </div>
            <p className="vl-legend"><span>D demand</span><span>P prefetch</span><span>green hit or useful</span><span>red miss</span><span>amber late</span></p>
          </article>
        ) : null}
        <article>
          <h2>5. Performance Metrics</h2>
          <p>Accuracy {Math.round(result.accuracy * 100)}%</p>
          <div className="vl-gantt"><i style={{ width: bar(result.accuracy), background: "#4ade80" }} /></div>
          <p>Coverage {Math.round(result.coverage * 100)}%</p>
          <div className="vl-gantt"><i style={{ width: bar(result.coverage), background: "#60a5fa" }} /></div>
          {showPollution ? <p>Pollution events {result.pollution}. No-prefetch misses {result.baselineMisses}. This prefetcher's demand misses {result.demandMisses}.</p> : null}
          <p>Hit rate {Math.round(result.hitRate * 100)}% against {Math.round((compared.baseline.hitRate) * 100)}% with no prefetcher.</p>
        </article>
        <article>
          <h2>6. Hit Rate Comparison</h2>
          <svg viewBox="0 0 220 80" role="img" aria-label="Hit rate over demand accesses">
            <polyline fill="none" stroke="#2563eb" strokeWidth="2" points={result.series.map((value, index) => `${12 + (result.series.length <= 1 ? 0 : (index / (result.series.length - 1)) * 190)},${70 - value * 60}`).join(" ")} />
            <polyline fill="none" stroke="#94a3b8" strokeWidth="2" points={compared.baseline.series.map((value, index) => `${12 + (compared.baseline.series.length <= 1 ? 0 : (index / (compared.baseline.series.length - 1)) * 190)},${70 - value * 60}`).join(" ")} />
          </svg>
          <p className="vl-legend"><span>Blue: this prefetcher</span><span>Gray: no prefetch</span></p>
          <p>The same addresses, degree, distance, and confidence. The trace decides which predictor helps. No prefetcher is marked best.</p>
        </article>
      </div>
      <div className="vl-cards three">
        <article>
          <h2>Simulation Controls</h2>
          <Toggle on={showPrefetch} label="Show Prefetch Requests" onChange={setShowPrefetch} />
          <Toggle on={showCache} label="Show Cache Line State" onChange={setShowCache} />
          <Toggle on={highlight} label="Highlight Prefetch Hits" onChange={setHighlight} />
          <Toggle on={showPollution} label="Show Pollution Events" onChange={setShowPollution} />
          <Toggle on={auto} label="Auto Advance" onChange={setAuto} />
          <Transport playing={play.playing} onPlay={() => { if (!auto) { play.setCycle((value) => Math.min(result.events.length - 1, value + 1)); return; } play.setPlaying((value) => !value); }} onStep={() => play.setCycle((value) => Math.min(result.events.length - 1, value + 1))} onBack={() => play.setCycle((value) => Math.max(0, value - 1))} onReset={() => { setGuideFocus(""); play.reset(); }} speed={play.speed} onSpeed={play.setSpeed} />
        </article>
        <article>
          <h2 className={guideFocus === "counts" ? "aca-guide-on" : undefined}>Results & Insights</h2>
          <div className="vl-metrics">
            <div><strong>{result.demandAccesses}</strong><span>Demand accesses</span></div>
            <div><strong>{result.issued}</strong><span>Prefetches issued</span></div>
            <div><strong>{result.useful}</strong><span>Useful</span></div>
            <div><strong>{result.useless}</strong><span>Useless</span></div>
            <div><strong>{result.late}</strong><span>Late</span></div>
            <div><strong>{Math.round(result.missReduction * 100)}%</strong><span>Miss reduction</span></div>
          </div>
          {showPrefetch ? <p>Demand bytes {result.demandBytes}. Prefetch bytes {result.prefetchBytes}. Useful prefetch bytes {result.usefulBytes}. Wasted prefetch bytes {result.wastedBytes}. Block size is 64 bytes.</p> : null}
        </article>
        <article>
          <h2>Key Takeaway</h2>
          <p>{highlight && current?.result === "useful" ? "That demand used a line the prefetcher had already installed." : "Step the trace to see a demand, the prediction, and whether the next access finds the line."} Timeliness matters: with a longer memory latency the same next-line request can still be in flight when the demand arrives.</p>
        </article>
      </div>
    </LabChrome>
  );
}
