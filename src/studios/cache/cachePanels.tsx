import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { runTrace, type CacheAccess, type CacheMachine } from "../../engines/cache/cache";
import { geometryOf, type CacheConfig } from "../../engines/cache/mapping";
import { hitRate } from "../../engines/cache/metrics";
import type { Slot } from "../../engines/cache/replacement";
import {
  SIM_EXAMPLE, averageReuse, blockPreview, classifyTrace, configSummary, formatTrace, matrixTrace, memoryByte,
  nestedAmat, parseTrace, randomTrace, repeatedTrace, requestPath, sequentialTrace, splitFields, stridedTrace,
  teachingAmat, timelineFor, uniqueCount, type TraceEntry,
} from "../../engines/cache/studio";
import { reducedMotion } from "../aca/animation/acaMotion";
import { listRecords, saveRecord } from "../../store/projects";

gsap.registerPlugin(useGSAP);

const SIZES = [256, 512, 1024, 2048, 4096, 8192, 16384];
const BLOCKS = [4, 8, 16, 32, 64];

function sizeLabel(bytes: number): string {
  return bytes >= 1024 ? `${bytes / 1024} KB` : `${bytes} B`;
}

function hex(value: number, digits = 8): string {
  return `0x${(value >>> 0).toString(16).toUpperCase().padStart(digits, "0")}`;
}

const TRACE_EXAMPLES: Array<{ id: string; label: string; entries: TraceEntry[] }> = [
  { id: "sequential", label: "Sequential", entries: sequentialTrace(8, 0x1000, 4) },
  { id: "repeated", label: "Repeated", entries: repeatedTrace(2, 4, 4).map((entry) => ({ ...entry, address: 0x1000 + entry.address })) },
  { id: "stride", label: "Stride", entries: stridedTrace(8, 64, 0x1000) },
  { id: "conflict", label: "Conflict", entries: [0, 0x2000, 0x4000, 0, 0x6000, 0x2000].map((address) => ({ address, op: "read" as const })) },
  { id: "writes", label: "Writes", entries: [{ address: 0x1000, op: "write" }, { address: 0x1004, op: "read" }, { address: 0x2000, op: "write" }, { address: 0x1000, op: "read" }] },
];

function baseConfig(patch: Partial<CacheConfig> = {}): CacheConfig {
  return {
    addressBits: 32, memoryBytes: 65536, cacheBytes: 16384, blockBytes: 16, associativity: 2,
    replacement: "lru", writePolicy: "back", allocation: "allocate", seed: 1, ...patch,
  };
}

export function SimulatorTab({ explain, guide, takeaways }: { explain: boolean; guide: string[]; takeaways: string[] }) {
  const [config, setConfig] = useState<CacheConfig>(() => baseConfig());
  const [assoc, setAssoc] = useState("2");
  const [text, setText] = useState(formatTrace(SIM_EXAMPLE));
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [stage, setStage] = useState(0);
  const scope = useRef<HTMLDivElement>(null);
  const parsed = useMemo(() => parseTrace(text), [text]);
  const played = useMemo(() => runTrace(config, parsed.entries.slice(0, cursor)), [config, parsed.entries, cursor]);
  const focus = parsed.entries[Math.max(0, cursor - 1)] ?? parsed.entries[0];
  const fields = focus ? splitFields(focus.address, config) : null;
  const current = played.results.at(-1) ?? null;
  const events = current ? timelineFor(current, config.blockBytes) : [];
  const summary = configSummary(config);
  const geo = geometryOf(config);

  useGSAP(() => {
    const node = scope.current?.querySelector(".cx-pulse");
    if (!node) return;
    gsap.fromTo(node, { scale: reducedMotion() ? 1 : 0.97 }, { scale: 1, duration: reducedMotion() ? 0 : 0.28, ease: "power2.out" });
  }, { scope, dependencies: [cursor, stage], revertOnUpdate: true });

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setCursor((index) => {
        if (index >= parsed.entries.length) {
          setPlaying(false);
          return index;
        }
        return index + 1;
      });
    }, reducedMotion() ? 80 : 700 / speed);
    return () => window.clearInterval(timer);
  }, [playing, speed, parsed.entries.length]);

  function applyAssoc(value: string) {
    setAssoc(value);
    const lines = Math.max(1, Math.round(config.cacheBytes / config.blockBytes));
    const ways = value === "full" ? lines : Number(value);
    setConfig({ ...config, associativity: ways });
    setCursor(0);
    setStage(0);
  }

  function retune(patch: Partial<CacheConfig>) {
    const next = { ...config, ...patch };
    if (assoc === "full") next.associativity = Math.max(1, Math.round(next.cacheBytes / next.blockBytes));
    setConfig(next);
    setCursor(0);
    setStage(0);
  }

  const tone = !current ? "idle" : current.hit ? "hit" : current.dirtyEvict ? "write" : "miss";

  return (
    <div className="cx-grid" ref={scope}>
      <div className="cx-col">
        <section className="cx-card">
          <div className="cx-bar"><h2>Configuration</h2><button type="button" onClick={() => { setConfig(baseConfig()); setAssoc("2"); setCursor(0); }}>Reset</button></div>
          <Field label="Cache size">
            <select aria-label="Cache size" value={config.cacheBytes} onChange={(event) => retune({ cacheBytes: Number(event.target.value) })}>
              {SIZES.map((size) => <option key={size} value={size}>{sizeLabel(size)}</option>)}
            </select>
          </Field>
          <Field label="Block size">
            <select aria-label="Block size" value={config.blockBytes} onChange={(event) => retune({ blockBytes: Number(event.target.value) })}>
              {BLOCKS.map((size) => <option key={size} value={size}>{sizeLabel(size)}</option>)}
            </select>
          </Field>
          <Field label="Associativity">
            <select aria-label="Associativity" value={assoc} onChange={(event) => applyAssoc(event.target.value)}>
              <option value="1">Direct mapped</option>
              <option value="2">2-way</option>
              <option value="4">4-way</option>
              <option value="8">8-way</option>
              <option value="full">Fully associative</option>
            </select>
          </Field>
          <Field label="Replacement policy">
            <select aria-label="Replacement policy" value={config.replacement} onChange={(event) => retune({ replacement: event.target.value as CacheConfig["replacement"] })}>
              <option value="lru">LRU</option>
              <option value="fifo">FIFO</option>
              <option value="random">Random</option>
            </select>
          </Field>
          <Field label="Write policy">
            <select aria-label="Write policy" value={config.writePolicy} onChange={(event) => retune({ writePolicy: event.target.value as CacheConfig["writePolicy"] })}>
              <option value="back">Write-back</option>
              <option value="through">Write-through</option>
            </select>
          </Field>
          <Field label="Write allocation">
            <select aria-label="Write allocation" value={config.allocation} onChange={(event) => retune({ allocation: event.target.value as CacheConfig["allocation"] })}>
              <option value="allocate">Write-allocate</option>
              <option value="no-allocate">No-write-allocate</option>
            </select>
          </Field>
          <p className="tiny">{summary.sets} sets · {summary.ways} ways · offset {summary.offsetBits} · index {summary.indexBits} · tag {summary.tagBits}</p>
        </section>
        <section className="cx-card">
          <div className="cx-bar"><h2>Access trace</h2><button type="button" onClick={() => { setText(formatTrace(SIM_EXAMPLE)); setCursor(0); setPlaying(false); }}>Load example</button></div>
          <textarea aria-label="Access trace" value={text} onChange={(event) => { setText(event.target.value); setCursor(0); setPlaying(false); }} />
          <div className="cx-examples">
            {TRACE_EXAMPLES.map((item) => <button key={item.id} type="button" onClick={() => { setText(formatTrace(item.entries)); setCursor(0); setPlaying(false); }}>{item.label}</button>)}
          </div>
          {parsed.errors[0] ? <p className="cx-bad">{parsed.errors[0]}</p> : <p className="tiny">One access per line: address, then R or W. {parsed.entries.length} valid.</p>}
        </section>
        <section className="cx-card">
          <h2>Controls</h2>
          <div className="cx-controls">
            <button type="button" className="cx-primary" onClick={() => { setPlaying(false); setCursor((value) => Math.min(parsed.entries.length, value + 1)); setStage(3); }}>Step</button>
            <button type="button" onClick={() => setPlaying((value) => !value)}>{playing ? "Pause" : "Run"}</button>
            <button type="button" onClick={() => { setCursor(0); setStage(0); setPlaying(false); }}>Reset</button>
          </div>
          <Field label="Speed">
            <select aria-label="Simulation speed" value={speed} onChange={(event) => setSpeed(Number(event.target.value))}>
              <option value={0.5}>0.5×</option>
              <option value={1}>1×</option>
              <option value={2}>2×</option>
            </select>
          </Field>
          <div className="cx-controls">
            <button type="button" onClick={() => void saveRecord({ id: "cache-trace", kind: "cache", name: "Cache trace", data: text, updated: Date.now() })}>Save Trace</button>
            <button type="button" onClick={() => void listRecords("cache").then((rows) => { const saved = rows[0]; if (saved) { setText(saved.data); setCursor(0); setPlaying(false); } })}>Load</button>
          </div>
        </section>
      </div>
      <div className="cx-main">
        <section className="cx-card">
          <div className="cx-bar"><h2>Memory Access Flow</h2><span>{focus ? `${focus.op === "write" ? "Write" : "Read"} ${hex(focus.address)}` : "Idle"} · {cursor} / {parsed.entries.length}</span></div>
          <div className={`cx-flow ${tone}`} aria-live="polite">
            <article className="cx-node cpu" data-flow="cpu"><b>CPU</b><small>{focus ? `${focus.op === "write" ? "Write" : "Read"} ${hex(focus.address)}` : "Waiting"}</small></article>
            <span className="cx-arrow">1. Address</span>
            <article className={tone === "hit" ? "cx-node cache cx-pulse" : "cx-node cache"} data-flow="cache"><b>Cache</b><small>{current ? (current.hit ? `Hit · set ${current.set} · way ${current.way}` : `Miss · set ${current.set}`) : "Lookup"}</small></article>
            <span className="cx-arrow">{current?.hit ? "Hit return" : current?.dirtyEvict ? "Write-back" : "2. Miss"}</span>
            <article className={tone === "miss" || tone === "write" ? "cx-node mem cx-pulse" : "cx-node mem"} data-flow="mem"><b>Main Memory</b><small>{current && !current.hit && current.way >= 0 ? `Fill ${hex(current.address & ~(config.blockBytes - 1))}` : "Block store"}</small></article>
          </div>
          {explain && current ? <p className="cx-note"><b>What changed.</b> {current.explain}</p> : null}
        </section>
        <div className="cx-split">
          <section className="cx-card">
            <div className="cx-bar"><h2>Address Breakdown</h2><b>{fields ? hex(fields.parts.address) : "—"}</b></div>
            <div className="cx-bits" aria-label="Tag, index, and offset bits">
              <span className="tag">{fields?.tag || "—"}</span>
              <span className="index">{geo.indexBits === 0 ? "no index" : fields?.index || "—"}</span>
              <span className="off">{fields?.offset || "—"}</span>
            </div>
            <div className="cx-fields">
              <span className="tag"><small>Tag ({geo.tagBits} bits)</small>{fields ? hex(fields.parts.tag, 4) : "—"}</span>
              <span className="index"><small>{geo.indexBits === 0 ? "Index (fully associative)" : `Index (${geo.indexBits} bits)`}</small>{fields?.parts.index ?? "—"}</span>
              <span className="off"><small>Offset ({geo.offsetBits} bits)</small>{fields?.parts.offset ?? "—"}</span>
            </div>
            <p className="tiny">Set {fields?.parts.index ?? "—"} · byte offset {fields?.parts.offset ?? "—"} · tag value {fields?.parts.tag ?? "—"}</p>
          </section>
          <section className="cx-card">
            <h2>Main Memory</h2>
            <MemoryGrid address={focus?.address ?? 0} block={config.blockBytes} onPick={(address) => { setText((value) => `${value.trim()}\n${hex(address)} R`.trim()); setCursor(0); }} />
          </section>
        </div>
        <section className="cx-card">
          <h2>Cache Contents ({summary.sets} sets × {summary.ways} ways)</h2>
          <CacheTable machine={played.machine} focus={fields?.parts.index ?? 0} activeWay={current?.way ?? -1} policy={config.replacement} />
        </section>
        <section className="cx-card">
          <div className="cx-bar"><h2>Operation Timeline</h2><button type="button" onClick={() => setStage(0)}>Clear</button></div>
          <ol className="cx-log">
            {events.map((event, index) => (
              <li key={`${event.title}-${index}`} className={index === Math.min(stage, events.length - 1) ? "on" : ""}>
                <button type="button" onClick={() => setStage(index)}><span>{event.title}</span><em className={event.tone}>{event.tone}</em></button>
              </li>
            ))}
            {events.length === 0 ? <li>Step the trace to record an access.</li> : null}
          </ol>
        </section>
      </div>
      <Guide guide={guide} takeaways={takeaways} stats={played.machine.stats} memoryReads={played.results.filter((row) => !row.hit && row.way >= 0).length} />
    </div>
  );
}

function MemoryGrid({ address, block, onPick }: { address: number; block: number; onPick: (address: number) => void }) {
  const safe = Math.max(1, block);
  const base = address & ~(safe - 1);
  const step = safe >= 16 ? 4 : 1;
  const cols = [0, step, step * 2, step * 3].filter((col) => col < safe);
  const rows = [0, safe, safe * 2, safe * 3];
  return (
    <table className="cx-table">
      <thead><tr><th>Address</th>{cols.map((col) => <th key={col}>+{col}</th>)}</tr></thead>
      <tbody>
        {rows.map((offset) => (
          <tr key={offset} className={address >= base + offset && address < base + offset + safe ? "on" : ""}>
            <td>{hex(base + offset)}</td>
            {cols.map((col) => (
              <td key={col}><button type="button" onClick={() => onPick(base + offset + col)}>{memoryByte(base + offset + col).toString(16).toUpperCase().padStart(2, "0")}</button></td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function lineBase(tag: number, setIndex: number, indexBits: number, offsetBits: number): number {
  return tag * 2 ** (indexBits + offsetBits) + setIndex * 2 ** offsetBits;
}

function CacheTable({ machine, focus, activeWay, policy }: { machine: CacheMachine; focus: number; activeWay: number; policy: CacheConfig["replacement"] }) {
  const geo = geometryOf(machine.config);
  const start = Math.max(0, Math.min(focus, machine.sets.length - 1));
  const shown = machine.sets.slice(start, start + 2);
  return (
    <div className="cx-scroll">
      <table className="cx-table">
        <thead><tr><th>Set</th><th>Way</th><th>Valid</th><th>Tag</th><th>Dirty</th><th>Data</th><th>{policy.toUpperCase()}</th></tr></thead>
        <tbody>
          {shown.map((set, setOffset) => set.map((line, way) => {
            const setIndex = start + setOffset;
            const preview = line.valid ? blockPreview(lineBase(line.tag, setIndex, geo.indexBits, geo.offsetBits), machine.config.blockBytes).slice(0, 2).join(" ") : "—";
            return (
              <tr key={`${setIndex}-${way}`} className={setIndex === focus && way === activeWay ? "hit" : setIndex === focus ? "on" : line.dirty ? "dirty" : ""}>
                <td>{setIndex}</td>
                <td>{way}</td>
                <td>{line.valid ? "1" : "—"}</td>
                <td>{line.valid ? hex(line.tag, 4) : "—"}</td>
                <td>{line.dirty ? "Dirty" : "—"}</td>
                <td>{preview}</td>
                <td><Rank set={set} line={line} policy={policy} /></td>
              </tr>
            );
          }))}
        </tbody>
      </table>
    </div>
  );
}

function Rank({ set, line, policy }: { set: Slot[]; line: Slot; policy: CacheConfig["replacement"] }) {
  if (!line.valid) return <span>—</span>;
  if (policy === "random") return <span>seeded</span>;
  const ranked = set.filter((item) => item.valid).slice().sort((a, b) => policy === "fifo" ? a.inserted - b.inserted : b.lastUsed - a.lastUsed);
  const place = ranked.findIndex((item) => item === line);
  return <span className={place === 0 ? "cx-dot on" : "cx-dot"} aria-label={policy === "fifo" ? `inserted ${line.inserted}` : `rank ${place + 1}`} />;
}

function Guide({ guide, takeaways, stats, memoryReads = 0 }: { guide: string[]; takeaways: string[]; stats: CacheMachine["stats"]; memoryReads?: number }) {
  const rate = Math.round(hitRate(stats) * 100);
  const miss = stats.accesses === 0 ? 0 : 100 - rate;
  const cycles = teachingAmat(stats);
  return (
    <aside className="cx-side">
      <section className="cx-card">
        <h2>Studio Guide</h2>
        <ol>{guide.map((step, index) => <li key={step}><b>{index + 1}</b><span>{step}</span></li>)}</ol>
      </section>
      <section className="cx-card">
        <h2>Key Takeaways</h2>
        <ul>{takeaways.map((item) => <li key={item}>{item}</li>)}</ul>
      </section>
      <section className="cx-card">
        <div className="cx-bar"><h2>Metrics</h2><span className="cx-live">Live</span></div>
        <div className="cx-metrics">
          <p><span>Accesses</span><b>{stats.accesses}</b></p>
          <p><span>Hits</span><b>{stats.hits}</b></p>
          <p><span>Misses</span><b>{stats.misses}</b></p>
          <p><span>Hit Rate</span><b>{rate}%</b></p>
          <p><span>Miss Rate</span><b>{miss}%</b></p>
          <p><span>Evictions</span><b>{stats.evictions}</b></p>
          <p><span>Write-backs</span><b>{stats.writeBacks}</b></p>
          <p><span>Mem reads</span><b>{memoryReads}</b></p>
          <p><span>Mem writes</span><b>{stats.memoryWrites}</b></p>
          <p><span>AMAT</span><b>{cycles.toFixed(1)}</b></p>
        </div>
        <p className="tiny">AMAT = 1 cycle hit time + miss rate × 100 cycle miss penalty.</p>
      </section>
    </aside>
  );
}

export function LocalityTab({ explain, guide, takeaways }: { explain: boolean; guide: string[]; takeaways: string[] }) {
  const [pattern, setPattern] = useState("sequential");
  const [count, setCount] = useState(128);
  const [working, setWorking] = useState(32);
  const [block, setBlock] = useState(16);
  const [cache, setCache] = useState(1024);
  const [stride, setStride] = useState(16);
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [blank, setBlank] = useState(false);
  const entries = useMemo(() => buildLocality(pattern, count, working, stride), [pattern, count, working, stride]);
  const config = useMemo(() => baseConfig({ cacheBytes: cache, blockBytes: block, associativity: 1, writePolicy: "through" }), [cache, block]);
  const traced = useMemo(() => classifyTrace(config, entries), [config, entries]);
  const shown = blank && cursor === 0 ? [] : traced.rows.slice(0, cursor > 0 ? cursor : traced.rows.length);
  const hits = shown.filter((row) => row.hit).length;
  const compulsory = shown.filter((row) => row.klass === "compulsory").length;
  const addresses = shown.map((row) => row.address);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setCursor((value) => {
      if (value >= entries.length) { setPlaying(false); return value; }
      return value + 1;
    }), reducedMotion() ? 40 : 160 / speed);
    return () => window.clearInterval(timer);
  }, [playing, entries.length, speed]);

  const span = Math.max(block, ...entries.map((entry) => entry.address), block);
  const cells = Math.min(64, Math.ceil((span + 1) / block));

  return (
    <div className="cx-grid">
      <div className="cx-col">
        <section className="cx-card">
          <div className="cx-bar"><h2>Trace Configuration</h2><button type="button" onClick={() => { setPattern("sequential"); setCount(128); setWorking(32); setBlock(16); setCache(1024); setStride(16); setCursor(0); setBlank(false); setPlaying(false); }}>Load preset</button></div>
          <Field label="Trace pattern">
            <select aria-label="Trace pattern" value={pattern} onChange={(event) => { setPattern(event.target.value); setCursor(0); }}>
              <option value="sequential">Sequential</option>
              <option value="repeated">Repeated Loop</option>
              <option value="strided">Strided</option>
              <option value="random">Random</option>
              <option value="row">Matrix row-major</option>
              <option value="column">Matrix column-major</option>
            </select>
          </Field>
          <Field label="Total accesses"><input aria-label="Total accesses" type="number" min={8} max={256} value={count} onChange={(event) => setCount(Math.max(8, Math.min(256, Number(event.target.value) || 8)))} /></Field>
          <Field label="Working-set size"><input aria-label="Working set blocks" type="number" min={1} max={64} value={working} onChange={(event) => setWorking(Math.max(1, Number(event.target.value) || 1))} /></Field>
          <Field label="Block size">
            <select aria-label="Locality block size" value={block} onChange={(event) => setBlock(Number(event.target.value))}>{BLOCKS.map((size) => <option key={size} value={size}>{sizeLabel(size)}</option>)}</select>
          </Field>
          <Field label="Cache size">
            <select aria-label="Locality cache size" value={cache} onChange={(event) => setCache(Number(event.target.value))}>{SIZES.map((size) => <option key={size} value={size}>{sizeLabel(size)}</option>)}</select>
          </Field>
          <Field label="Stride"><input aria-label="Stride" type="number" min={1} max={256} value={stride} onChange={(event) => setStride(Math.max(1, Number(event.target.value) || 1))} /></Field>
          <Field label="Animation speed">
            <select aria-label="Locality speed" value={speed} onChange={(event) => setSpeed(Number(event.target.value))}>
              <option value={0.5}>0.5×</option>
              <option value={1}>1×</option>
              <option value={2}>2×</option>
            </select>
          </Field>
          <div className="cx-controls">
            <button type="button" className="cx-primary" onClick={() => { setBlank(false); setCursor(1); setPlaying(true); }}>Run Simulation</button>
            <button type="button" onClick={() => { setCursor(0); setPlaying(false); setBlank(true); }}>Reset</button>
          </div>
        </section>
        <section className="cx-card">
          <h2>Trace Pattern Presets</h2>
          {[
            ["sequential", "Sequential", "Access A, A+1, A+2…"],
            ["repeated", "Repeated Loop", "Loop over a small working set"],
            ["strided", "Strided", "Access A, A+k, A+2k…"],
            ["random", "Random", "Random addresses"],
          ].map(([id, title, note]) => (
            <button key={id} type="button" className={pattern === id ? "cx-preset on" : "cx-preset"} onClick={() => { setPattern(id ?? "sequential"); setCursor(0); }}><b>{title}</b><small>{note}</small></button>
          ))}
        </section>
      </div>
      <div className="cx-main">
        <section className="cx-card">
          <div className="cx-bar"><h2>Memory Address Map</h2><span>Blocks ({block} B) · working set {working}</span></div>
          <div className="cx-map" aria-label="Memory address map">
            {Array.from({ length: cells }, (_, index) => {
              const touched = addresses.some((address) => Math.floor(address / block) === index);
              const inside = index < working;
              const current = shown.at(-1);
              const hot = current ? Math.floor(current.address / block) === index : false;
              return <i key={index} className={hot ? "hot" : touched ? "seen" : inside ? "work" : ""} title={hot ? "Current access" : touched ? "Accessed" : inside ? "In working set" : "Not accessed"} />;
            })}
          </div>
          <p className="tiny">Blue = current · green = accessed · slate = working set · gray = not accessed.</p>
        </section>
        <div className="cx-split">
          <section className="cx-card">
            <h2>Temporal Locality</h2>
            <p className="tiny">The same addresses are accessed again and again.</p>
            <div className="cx-pills">{repeatedTrace(Math.min(4, working), 2, block).slice(0, 12).map((entry, index) => <span key={index}>A{entry.address / block}</span>)}</div>
            {explain ? <p className="cx-note">Reuse distance averages {averageReuse(addresses).toFixed(1)} accesses.</p> : null}
          </section>
          <section className="cx-card">
            <h2>Spatial Locality</h2>
            <p className="tiny">Addresses close to each other share a {block}-byte block.</p>
            <div className="cx-pills">{sequentialTrace(8, 0, 1).map((entry) => <span key={entry.address}>A{entry.address}</span>)}</div>
            {explain ? <p className="cx-note">Stride {stride} {stride < block ? "stays inside a block after the first miss." : "jumps to a new block more often."}</p> : null}
          </section>
        </div>
        <div className="cx-split">
          <section className="cx-card">
            <h2>Cache Performance Over Time</h2>
            <div className="cx-bars tall" aria-label="Hit and miss timeline">
              {bucketRates(shown).map((bucket, index) => (
                <i key={index} className={bucket.compulsory ? "cold" : bucket.rate >= 0.5 ? "hit" : "miss"} style={{ height: `${12 + bucket.rate * 68}px` }} title={`${Math.round(bucket.rate * 100)}% hits`} />
              ))}
            </div>
          </section>
          <section className="cx-card">
            <h2>Working Set Window</h2>
            <div className="cx-pills">{Array.from(new Set(addresses.map((address) => Math.floor(address / block)))).slice(-8).map((blockId) => <span key={blockId}>{hex(blockId * block, 4)}</span>)}</div>
          </section>
        </div>
        <section className="cx-card">
          <div className="cx-bar"><h2>Access Timeline</h2><button type="button" onClick={() => setCursor(0)}>Clear</button></div>
          <div className="cx-scroll">
            <table className="cx-table">
              <thead><tr><th>#</th><th>Address</th><th>Result</th><th>Tag</th><th>Reason</th></tr></thead>
              <tbody>
                {shown.slice(-12).map((row, index) => (
                  <tr key={`${row.address}-${index}`} className={row.hit ? "hit" : "miss"}>
                    <td>{shown.length - shown.slice(-12).length + index}</td>
                    <td>{hex(row.address)}</td>
                    <td>{row.hit ? "Hit" : "Miss"}</td>
                    <td>{hex(row.tag, 4)}</td>
                    <td>{row.hit ? "Block already resident" : row.klass === "compulsory" ? "Compulsory miss" : row.klass === "conflict" ? "Conflict miss" : "Capacity miss"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      <aside className="cx-side">
        <section className="cx-card"><h2>Studio Guide</h2><ol>{guide.map((step, index) => <li key={step}><b>{index + 1}</b>{step}</li>)}</ol></section>
        <section className="cx-card"><h2>Key Takeaways</h2><ul>{takeaways.map((item) => <li key={item}>{item}</li>)}</ul></section>
        <section className="cx-card">
          <h2>Metrics</h2>
          <div className="cx-metrics">
            <p><span>Hit Rate</span><b>{shown.length ? Math.round((hits / shown.length) * 100) : 0}%</b></p>
            <p><span>Miss Rate</span><b>{shown.length ? Math.round(((shown.length - hits) / shown.length) * 100) : 0}%</b></p>
            <p><span>Compulsory</span><b>{compulsory}</b></p>
            <p><span>Avg reuse</span><b>{averageReuse(addresses).toFixed(1)}</b></p>
            <p><span>Unique</span><b>{uniqueCount(addresses)}</b></p>
            <p><span>Working set</span><b>{working} blocks</b></p>
          </div>
        </section>
      </aside>
    </div>
  );
}

function bucketRates(rows: Array<{ hit: boolean; klass: string }>): Array<{ rate: number; compulsory: boolean }> {
  if (rows.length === 0) return [];
  const width = Math.max(1, Math.ceil(rows.length / 36));
  const buckets: Array<{ rate: number; compulsory: boolean }> = [];
  for (let index = 0; index < rows.length; index += width) {
    const slice = rows.slice(index, index + width);
    const hits = slice.filter((row) => row.hit).length;
    buckets.push({ rate: hits / slice.length, compulsory: hits === 0 && slice.some((row) => row.klass === "compulsory") });
  }
  return buckets;
}

function buildLocality(pattern: string, count: number, working: number, stride: number): TraceEntry[] {
  if (pattern === "repeated") return repeatedTrace(working, Math.max(1, Math.ceil(count / working)), 4).slice(0, count);
  if (pattern === "strided") return stridedTrace(count, stride);
  if (pattern === "random") return randomTrace(count, working * 64, 11);
  if (pattern === "row") return matrixTrace(8, 8, "row").slice(0, count);
  if (pattern === "column") return matrixTrace(8, 8, "column").slice(0, count);
  return sequentialTrace(count, 0, 4);
}

export function PoliciesTab({ explain, guide, takeaways }: { explain: boolean; guide: string[]; takeaways: string[] }) {
  const [config, setConfig] = useState<CacheConfig>(() => baseConfig({ cacheBytes: 16384, blockBytes: 64, associativity: 2 }));
  const [pattern, setPattern] = useState("custom");
  const [text, setText] = useState("0x00000000 R\n0x00000040 R\n0x00000080 W\n0x00000000 R\n0x000000C0 R\n0x00000100 W");
  const [cursor, setCursor] = useState(0);
  const [card, setCard] = useState("lru");
  const [other, setOther] = useState<Pick<CacheConfig, "replacement" | "writePolicy" | "allocation">>({ replacement: "fifo", writePolicy: "through", allocation: "no-allocate" });
  const entries = useMemo(() => pattern === "custom" ? parseTrace(text).entries : buildLocality(pattern, 24, 8, 64), [pattern, text]);
  const left = useMemo(() => runTrace(config, entries.slice(0, cursor)), [config, entries, cursor]);
  const right = useMemo(() => runTrace({ ...config, ...other }, entries.slice(0, cursor)), [config, other, entries, cursor]);
  const access = entries[Math.max(0, cursor - 1)];
  const a = left.results.at(-1);
  const b = right.results.at(-1);
  const fields = access ? splitFields(access.address, config) : null;

  return (
    <div className="cx-grid">
      <div className="cx-col">
        <section className="cx-card">
          <h2>Configuration</h2>
          <Field label="Cache size"><select aria-label="Policy cache size" value={config.cacheBytes} onChange={(event) => { setConfig({ ...config, cacheBytes: Number(event.target.value) }); setCursor(0); }}>{SIZES.map((size) => <option key={size} value={size}>{sizeLabel(size)}</option>)}</select></Field>
          <Field label="Block size"><select aria-label="Policy block size" value={config.blockBytes} onChange={(event) => { setConfig({ ...config, blockBytes: Number(event.target.value) }); setCursor(0); }}>{BLOCKS.map((size) => <option key={size} value={size}>{sizeLabel(size)}</option>)}</select></Field>
          <Field label="Associativity"><select aria-label="Policy associativity" value={config.associativity} onChange={(event) => { setConfig({ ...config, associativity: Number(event.target.value) }); setCursor(0); }}><option value={1}>Direct mapped</option><option value={2}>2-way</option><option value={4}>4-way</option><option value={8}>8-way</option></select></Field>
          <Field label="Policy A replacement"><select aria-label="Policy A replacement" value={config.replacement} onChange={(event) => { setConfig({ ...config, replacement: event.target.value as CacheConfig["replacement"] }); setCursor(0); }}><option value="lru">LRU</option><option value="fifo">FIFO</option><option value="random">Random</option></select></Field>
          <Field label="Policy A write"><select aria-label="Policy A write" value={config.writePolicy} onChange={(event) => { setConfig({ ...config, writePolicy: event.target.value as CacheConfig["writePolicy"] }); setCursor(0); }}><option value="back">Write-back</option><option value="through">Write-through</option></select></Field>
          <Field label="Policy A allocate"><select aria-label="Policy A allocation" value={config.allocation} onChange={(event) => { setConfig({ ...config, allocation: event.target.value as CacheConfig["allocation"] }); setCursor(0); }}><option value="allocate">Write-allocate</option><option value="no-allocate">No-write-allocate</option></select></Field>
          <Field label="Policy B replacement"><select aria-label="Policy B replacement" value={other.replacement} onChange={(event) => { setOther({ ...other, replacement: event.target.value as CacheConfig["replacement"] }); setCursor(0); }}><option value="lru">LRU</option><option value="fifo">FIFO</option><option value="random">Random</option></select></Field>
          <Field label="Policy B write"><select aria-label="Policy B write" value={other.writePolicy} onChange={(event) => { setOther({ ...other, writePolicy: event.target.value as CacheConfig["writePolicy"] }); setCursor(0); }}><option value="back">Write-back</option><option value="through">Write-through</option></select></Field>
          <Field label="Policy B allocate"><select aria-label="Policy B allocation" value={other.allocation} onChange={(event) => { setOther({ ...other, allocation: event.target.value as CacheConfig["allocation"] }); setCursor(0); }}><option value="allocate">Write-allocate</option><option value="no-allocate">No-write-allocate</option></select></Field>
        </section>
        <section className="cx-card">
          <h2>Access pattern</h2>
          {[["sequential", "Sequential"], ["strided", "Loop with stride"], ["row", "Matrix row-major"], ["column", "Matrix column-major"], ["random", "Random"], ["custom", "Custom trace"]].map(([id, label]) => (
            <label key={id} className="cx-radio"><input type="radio" name="pattern" checked={pattern === id} onChange={() => { setPattern(id ?? "custom"); setCursor(0); }} />{label}</label>
          ))}
        </section>
        <section className="cx-card">
          <div className="cx-bar"><h2>Trace input</h2><button type="button" onClick={() => { setText(formatTrace(SIM_EXAMPLE)); setPattern("custom"); setCursor(0); }}>Load example</button></div>
          <textarea aria-label="Policy trace" value={pattern === "custom" ? text : formatTrace(entries)} readOnly={pattern !== "custom"} onChange={(event) => { setText(event.target.value); setCursor(0); }} />
          <div className="cx-controls">
            <button type="button" className="cx-primary" onClick={() => setCursor((value) => Math.min(entries.length, value + 1))}>Step</button>
            <button type="button" onClick={() => setCursor(entries.length)}>Run</button>
            <button type="button" onClick={() => setCursor(0)}>Reset</button>
          </div>
        </section>
      </div>
      <div className="cx-main">
        <section className="cx-card">
          <div className="cx-bar"><h2>Policy Comparison Lab</h2><span>Step {cursor} / {entries.length}</span></div>
          <div className="cx-pair">
            <article className="a"><b>Policy A</b><small>{policyLabel(config)}</small></article>
            <article className="b"><b>Policy B</b><small>{policyLabel({ ...config, ...other })}</small></article>
          </div>
          {access && fields ? <p>Current {access.op === "write" ? "write" : "read"} {hex(access.address)} · set {fields.parts.index} · tag {hex(fields.parts.tag, 4)}</p> : <p>Step to compare the same access.</p>}
          <div className="cx-flow">
            <article className="cx-node"><b>Lookup</b><small>{a ? (a.hit ? "Hit" : "Miss") : "—"} / {b ? (b.hit ? "Hit" : "Miss") : "—"}</small></article>
            <article className="cx-node"><b>Victim</b><small>{a?.evicted ? `A way ${a.way}` : "A none"} · {b?.evicted ? `B way ${b.way}` : "B none"}</small></article>
            <article className="cx-node"><b>Write</b><small>{a?.dirtyEvict ? "A write-back" : "A quiet"} · {b ? "B through" : "—"}</small></article>
          </div>
          {explain && a ? <p className="cx-note">{a.explain}</p> : null}
        </section>
        <div className="cx-split">
          <StateCard title="Cache State A" machine={left.machine} result={a ?? null} meta={config.replacement.toUpperCase()} />
          <StateCard title="Cache State B" machine={right.machine} result={b ?? null} meta={other.replacement.toUpperCase()} />
        </div>
        <div className="cx-split">
          <section className="cx-card"><h2>Eviction · A</h2><p>{victimReason(config.replacement, a)}</p><p>{writeReason(config.writePolicy, a)}</p></section>
          <section className="cx-card"><h2>Eviction · B</h2><p>{victimReason(other.replacement, b)}</p><p>{writeReason(other.writePolicy, b)}</p></section>
        </div>
        <section className="cx-card">
          <h2>Metrics</h2>
          <table className="cx-table">
            <thead><tr><th>Metric</th><th>Policy A</th><th>Policy B</th></tr></thead>
            <tbody>
              {["accesses", "hits", "misses", "evictions", "writeBacks", "memoryWrites"].map((key) => (
                <tr key={key}><td>{key}</td><td>{left.machine.stats[key as keyof typeof left.machine.stats]}</td><td>{right.machine.stats[key as keyof typeof right.machine.stats]}</td></tr>
              ))}
              <tr><td>AMAT</td><td>{teachingAmat(left.machine.stats).toFixed(1)}</td><td>{teachingAmat(right.machine.stats).toFixed(1)}</td></tr>
            </tbody>
          </table>
        </section>
        <section className="cx-card">
          <h2>When to use which policy?</h2>
          <div className="cx-cards">
            {[
              ["lru", "LRU", "Keeps the line used most recently. A full set evicts the coldest line."],
              ["fifo", "FIFO", "Evicts the oldest install, even if that line was used again."],
              ["back", "Write-back", "Marks the line dirty and writes memory only on eviction."],
              ["through", "Write-through", "Updates memory on the write. Dirty state stays clear."],
            ].map(([id, title, body]) => (
              <button key={id} type="button" className={card === id ? "on" : ""} onClick={() => setCard(id ?? "lru")}><b>{title}</b><small>{body}</small></button>
            ))}
          </div>
        </section>
      </div>
      <aside className="cx-side">
        <section className="cx-card"><h2>Studio Guide</h2><ol>{guide.map((step, index) => <li key={step}><b>{index + 1}</b>{step}</li>)}</ol></section>
        <section className="cx-card"><h2>Key Takeaways</h2><ul>{takeaways.map((item) => <li key={item}>{item}</li>)}</ul></section>
        <section className="cx-card">
          <h2>Metrics</h2>
          <p>A hits {left.machine.stats.hits} · B hits {right.machine.stats.hits}</p>
          <p>A write-backs {left.machine.stats.writeBacks} · B memory writes {right.machine.stats.memoryWrites}</p>
        </section>
      </aside>
    </div>
  );
}

function policyLabel(config: Pick<CacheConfig, "replacement" | "writePolicy" | "allocation">): string {
  const write = config.writePolicy === "back" ? "Write-back" : "Write-through";
  const alloc = config.allocation === "allocate" ? "Write-allocate" : "No-write-allocate";
  return `${config.replacement.toUpperCase()} · ${write} · ${alloc}`;
}

function victimReason(policy: CacheConfig["replacement"], result: CacheAccess | undefined): string {
  if (!result) return "Step the trace.";
  if (result.hit) return "Hit. No victim.";
  if (!result.evicted) return result.way < 0 ? "Write miss did not allocate a line." : "Miss filled an empty way.";
  if (policy === "lru") return `Victim = way ${result.way}. Least recently used.`;
  if (policy === "fifo") return `Victim = way ${result.way}. Oldest inserted.`;
  return `Victim = way ${result.way}. Seeded random choice.`;
}

function writeReason(policy: CacheConfig["writePolicy"], result: CacheAccess | undefined): string {
  if (!result) return "—";
  if (result.dirtyEvict) return "Dirty victim written back to memory.";
  if (policy === "through" && result.op === "write") return "Write-through updated memory on this store.";
  return "No write-back on this step.";
}

function StateCard({ title, machine, result, meta }: { title: string; machine: CacheMachine; result: CacheAccess | null; meta: string }) {
  const index = result?.set ?? 0;
  const set = machine.sets[index] ?? [];
  return (
    <section className="cx-card">
      <h2>{title}</h2>
      <p className="tiny">Set {index}</p>
      <table className="cx-table">
        <thead><tr><th>Way</th><th>Valid</th><th>Tag</th><th>Dirty</th><th>{meta}</th></tr></thead>
        <tbody>
          {set.map((line, way) => (
            <tr key={way} className={result?.way === way ? "on" : ""}><td>{way}</td><td>{line.valid ? "1" : "—"}</td><td>{line.valid ? hex(line.tag, 4) : "—"}</td><td>{line.dirty ? "Dirty" : "—"}</td><td>{line.valid ? line.lastUsed : "—"}</td></tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

const LEVELS = [
  { name: "Registers", latency: 0.25, bandwidth: "1 TB/s", capacity: "1 KB", role: "Inside the CPU" },
  { name: "L1", latency: 1, bandwidth: "512 GB/s", capacity: "32 KB", role: "Per core" },
  { name: "L2", latency: 4, bandwidth: "256 GB/s", capacity: "256 KB", role: "Per core" },
  { name: "L3", latency: 12, bandwidth: "128 GB/s", capacity: "8 MB", role: "Shared" },
  { name: "Main Memory", latency: 100, bandwidth: "64 GB/s", capacity: "16 GB", role: "DRAM" },
  { name: "Storage", latency: 50000, bandwidth: "2 GB/s", capacity: "512 GB", role: "Non-volatile" },
];

export function HierarchyTab({ explain, guide, takeaways }: { explain: boolean; guide: string[]; takeaways: string[] }) {
  const [depth, setDepth] = useState(3);
  const [l1, setL1] = useState(95);
  const [l2, setL2] = useState(90);
  const [l3, setL3] = useState(90);
  const [addressText, setAddressText] = useState("00001234");
  const [op, setOp] = useState<"read" | "write">("read");
  const [picked, setPicked] = useState("L1");
  const [ran, setRan] = useState(true);
  const [step, setStep] = useState(6);
  const names = ["L1", "L2", "L3"].slice(0, depth);
  const rates = [l1, l2, l3].slice(0, depth);
  const address = Number.parseInt(addressText || "0", 16) || 0;
  const path = requestPath(address, names.map((name, index) => ({ name, hitPercent: rates[index] ?? 0 })));
  const visible = path.stops.slice(0, Math.max(1, Math.min(step, path.stops.length)));
  const stack = names.map((_, index) => ({ latency: LEVELS[index + 1]?.latency ?? 1, missRate: (100 - (rates[index] ?? 0)) / 100 }));
  const value = nestedAmat(stack, 100);
  const detail = LEVELS.find((level) => level.name === picked) ?? LEVELS[1]!;
  const batch = useMemo(() => {
    let hits = 0;
    for (let index = 0; index < 128; index += 1) {
      if (requestPath(index * 16, names.map((name, slot) => ({ name, hitPercent: rates[slot] ?? 0 }))).hit === "L1") hits += 1;
    }
    return { requests: 128, hits, misses: 128 - hits };
  }, [names.join(","), rates.join(",")]);

  return (
    <div className="cx-grid">
      <div className="cx-col">
        <section className="cx-card">
          <div className="cx-bar"><h2>Hierarchy Configuration</h2><button type="button" onClick={() => { setDepth(3); setL1(95); setL2(90); setL3(90); setRan(false); }}>Reset</button></div>
          <Field label="Hierarchy depth">
            <select aria-label="Hierarchy depth" value={depth} onChange={(event) => setDepth(Number(event.target.value))}>
              <option value={1}>L1 only</option>
              <option value={2}>L1 + L2</option>
              <option value={3}>Full (L1 + L2 + L3)</option>
            </select>
          </Field>
          <p className="tiny">L1 32 KB · L2 256 KB · L3 8 MB · DRAM 16 GB · Storage 512 GB</p>
        </section>
        <section className="cx-card">
          <h2>Workload</h2>
          <Field label="L1 hit rate"><input aria-label="L1 hit rate" type="number" min={0} max={100} value={l1} onChange={(event) => setL1(clamp(event.target.value))} /></Field>
          {depth > 1 ? <Field label="L2 hit rate"><input aria-label="L2 hit rate" type="number" min={0} max={100} value={l2} onChange={(event) => setL2(clamp(event.target.value))} /></Field> : null}
          {depth > 2 ? <Field label="L3 hit rate"><input aria-label="L3 hit rate" type="number" min={0} max={100} value={l3} onChange={(event) => setL3(clamp(event.target.value))} /></Field> : null}
          <div className="cx-controls">
            <button type="button" className={op === "read" ? "cx-primary" : ""} onClick={() => setOp("read")}>Read</button>
            <button type="button" className={op === "write" ? "cx-primary" : ""} onClick={() => setOp("write")}>Write</button>
          </div>
          <Field label="Address"><input aria-label="Hierarchy address" value={addressText} onChange={(event) => { setAddressText(event.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 8)); setStep(6); }} /></Field>
          <div className="cx-controls">
            <button type="button" className="cx-primary" onClick={() => { setRan(true); setStep(path.stops.length); }}>Run</button>
            <button type="button" onClick={() => { setRan(true); setStep((value) => Math.min(path.stops.length, value + 1)); }}>Step</button>
            <button type="button" onClick={() => { setStep(1); setRan(false); }}>Reset</button>
          </div>
          <button type="button" className="cx-primary" onClick={() => { setRan(true); setStep(path.stops.length); }}>Simulate Request</button>
        </section>
      </div>
      <div className="cx-main">
        <section className="cx-card">
          <h2>Memory Hierarchy</h2>
          <div className="cx-levels">
            {LEVELS.map((level) => (
              <button key={level.name} type="button" className={picked === level.name ? "on" : ""} onClick={() => setPicked(level.name)}>
                <b>{level.name}</b>
                <small>{level.latency < 1 ? `${level.latency} ns` : level.latency >= 1000 ? `${level.latency / 1000} µs` : `${level.latency} ns`}</small>
                <small>{level.capacity}</small>
              </button>
            ))}
          </div>
          <p className="tiny">{detail.name}: {detail.role}. Bandwidth {detail.bandwidth}. Capacity {detail.capacity}. These latencies are teaching defaults.</p>
        </section>
        <section className="cx-card">
          <div className="cx-bar"><h2>Request Path</h2><span>{hex(address)} · {op}</span></div>
          <div className="cx-path">
            {visible.map((stop) => <span key={stop} className={stop === path.hit && visible.length === path.stops.length ? "hit" : "on"}>{stop}</span>)}
          </div>
          <p className={ran ? "cx-note" : "tiny"}>{ran ? `${path.hit} ${path.hit === "Main Memory" ? "satisfied the miss path" : "hit"}. ${op === "write" ? "The write uses the same lookup." : "Data returns to the CPU."}` : "Press Simulate Request."}</p>
          {explain ? <p className="tiny">Lower the L1 hit rate and the same address can travel past L1.</p> : null}
        </section>
        <div className="cx-split">
          <section className="cx-card">
            <h2>Access Cost</h2>
            <div className="cx-bars" aria-label="Latency comparison">
              {LEVELS.map((level) => {
                const height = 8 + (Math.log10(level.latency) - Math.log10(0.25)) / (Math.log10(50000) - Math.log10(0.25)) * 72;
                return <button key={level.name} type="button" onClick={() => setPicked(level.name)} title={`${level.latency} ns`}><i style={{ height }} /><small>{level.name.split(" ")[0]}</small></button>;
              })}
            </div>
          </section>
          <section className="cx-card">
            <h2>AMAT</h2>
            <p className="tiny">T_L1 + MR_L1 × (T_L2 + MR_L2 × (T_L3 + MR_L3 × T_mem))</p>
            <p className="cx-amat">{value.toFixed(2)} ns</p>
            <p className="tiny">L1 miss {(100 - l1)}% · L2 miss {depth > 1 ? 100 - l2 : 0}% · L3 miss {depth > 2 ? 100 - l3 : 0}% · memory 100 ns</p>
          </section>
        </div>
      </div>
      <aside className="cx-side">
        <section className="cx-card"><h2>Studio Guide</h2><ol>{guide.map((step, index) => <li key={step}><b>{index + 1}</b>{step}</li>)}</ol></section>
        <section className="cx-card"><h2>Key Takeaways</h2><ul>{takeaways.map((item) => <li key={item}>{item}</li>)}</ul></section>
        <section className="cx-card">
          <h2>Metrics</h2>
          <p>Requests {batch.requests}</p>
          <p>L1 hits in sample {batch.hits}</p>
          <p>L1 misses {batch.misses}</p>
          <p>AMAT {value.toFixed(2)} ns</p>
        </section>
      </aside>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="cx-field">{label}{children}</label>;
}

function clamp(value: string): number {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(100, number));
}
