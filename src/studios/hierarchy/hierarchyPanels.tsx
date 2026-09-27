import { useEffect, useMemo, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { Icon } from "../../design-system/icons";
import { HIERARCHY_LESSONS } from "../../data/studioLessons";
import type { Latencies } from "../../engines/arch/hierarchy";
import {
  acceptLatency,
  buildPattern,
  createMiniCache,
  DEFAULT_LATENCIES,
  freshLevelMemory,
  hierarchyAmat,
  localityReport,
  stepMiniCache,
  traceHierarchyAccess,
  type AccessTrace,
  type CacheStep,
  type LevelMemory,
  type MiniCache,
  type PatternKind,
  type ReplacePolicy,
} from "../../engines/arch/hierarchyLab";
import { reducedMotion } from "../aca/animation/acaMotion";

const QUOTES: Record<string, string> = {
  pyramid: "“Memory is the bridge between computation and the world.” — Andrew S. Tanenbaum",
  access: "“The memory hierarchy works because most programs reuse data.” — John L. Hennessy",
  locality: "“Programs behave well. They tend to touch the same data again, and they tend to touch data that are near each other.” — David A. Patterson",
  cache: "“The whole purpose of a computer system is to move information from where it is to where it is needed as quickly as possible.” — John L. Hennessy, Computer Architecture",
};

const LEVELS: Array<{ key: keyof Latencies; name: string; capacity: string; blurb: string; tone: string }> = [
  { key: "register", name: "Registers", capacity: "8 words · 1 word / cycle", blurb: "CPU internal registers. Fastest access.", tone: "reg" },
  { key: "l1", name: "L1 Cache", capacity: "32 bytes · 1 line / cycle", blurb: "Small and very fast. First cache the core checks.", tone: "l1" },
  { key: "l2", name: "L2 Cache", capacity: "64 bytes · shared with the core", blurb: "Larger than L1. Slower, but still fast.", tone: "l2" },
  { key: "ram", name: "RAM (Main Memory)", capacity: "256 words · bus width", blurb: "Main memory. Significantly larger.", tone: "ram" },
  { key: "storage", name: "Storage (SSD / Disk)", capacity: "Lab disk · block access", blurb: "Non-volatile storage. Last level in this lab.", tone: "disk" },
];

function Guide({ id }: { id: keyof typeof HIERARCHY_LESSONS }) {
  const lesson = HIERARCHY_LESSONS[id];
  if (!lesson) return null;
  return (
    <aside className="hhx-side">
      <section>
        <h2><Icon name="sheet" size={16} /> Studio Guide</h2>
        <ol>{lesson.guide.map((step) => <li key={step}>{step}</li>)}</ol>
      </section>
      <section>
        <h2><Icon name="bolt" size={16} /> Key Takeaways</h2>
        <ul>{lesson.takeaways.map((item) => <li key={item}>{item}</li>)}</ul>
      </section>
      <p className="hhx-quote">{QUOTES[id]}</p>
    </aside>
  );
}

function Strip({ explain, changed, why, notice }: { explain: boolean; changed: string; why: string; notice: string }) {
  if (!explain) return null;
  return (
    <section className="hhx-strip">
      <div><b><Icon name="sheet" size={14} /> What changed</b><p>{changed}</p></div>
      <div><b><Icon name="bolt" size={14} /> Why</b><p>{why}</p></div>
      <div><b><Icon name="info" size={14} /> Notice</b><p>{notice}</p></div>
    </section>
  );
}

function hex(value: number): string {
  return `0x${value.toString(16).toUpperCase()}`;
}

export function HierarchyPanel({ explain, latencies, onLatencies }: { explain: boolean; latencies: Latencies; onLatencies: (next: Latencies) => void }) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [story, setStory] = useState({ changed: "You can edit the latency of each level.", why: "This shows how access time grows as the request moves down the hierarchy.", notice: "The CPU checks registers, then L1, L2, RAM, and finally storage. Each value is a teaching parameter." });

  function edit(key: keyof Latencies, raw: string, name: string) {
    setDrafts({ ...drafts, [key]: raw });
    const parsed = acceptLatency(raw, latencies[key]);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setError("");
    const previous = latencies[key];
    onLatencies({ ...latencies, [key]: parsed.value });
    setStory({
      changed: `${name} latency changed from ${previous} to ${parsed.value} cycles.`,
      why: parsed.value > previous ? "Accesses that reach this level now cost more cycles." : "Accesses that reach this level now return sooner.",
      notice: key === "ram" || key === "storage" ? "Programs that miss in the caches feel this change. A cache hit does not pay it." : "Only requests served from this level use this number.",
    });
  }

  return (
    <div className="hhx-grid">
      <div className="hhx-main">
        <div className="hhx-split">
          <section className="hhx-card">
            <h2>The memory pyramid</h2>
            <p>Each level stores data. Moving down, the level is larger and slower. The CPU checks the closest level first: registers, then L1, L2, RAM, and finally storage.</p>
            {explain ? <p className="hhx-callout"><Icon name="info" size={14} /> A closer level is smaller and quicker in this lab, not a universal constant. Latencies are teaching parameters you can edit.</p> : null}
          </section>
          <section className="hhx-card">
            <h2>Memory Hierarchy Diagram</h2>
            <div className="hhx-pyramid">
              <div className="hhx-axis"><span>Closer to CPU</span><span>Faster</span><span>Smaller</span><i /><span>Farther from CPU</span><span>Slower</span><span>Larger</span></div>
              <div className="hhx-stack">
                {LEVELS.map((level) => (
                  <div key={level.key} className={`band ${level.tone}`} title={`${level.name}: ${latencies[level.key]} cycles`}>
                    <b>{level.name}</b>
                    <em>~ {latencies[level.key].toLocaleString()} {latencies[level.key] === 1 ? "cycle" : "cycles"}</em>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
        <section className="hhx-card">
          <header><h2>Edit Latencies <span>teaching parameters</span></h2><button type="button" onClick={() => { onLatencies(DEFAULT_LATENCIES); setDrafts({}); setError(""); setStory({ changed: "Latencies returned to the lab defaults.", why: "Reset restores the picture you started from.", notice: "Registers 1, L1 3, L2 10, RAM 80, storage 1,000,000 cycles." }); }}><Icon name="reset" size={14} /> Reset to Default</button></header>
          <div className="hhx-levels">
            {LEVELS.map((level) => (
              <label key={level.key} className={level.tone}>
                <b>{level.name}</b>
                <small>{level.capacity}</small>
                <span>{level.blurb}</span>
                <em>Latency (cycles)</em>
                <input aria-label={`${level.name} latency`} inputMode="numeric" value={drafts[level.key] ?? String(latencies[level.key])} onChange={(event) => edit(level.key, event.target.value, level.name)} />
              </label>
            ))}
          </div>
          {error ? <p className="hhx-error" role="alert">{error}</p> : null}
        </section>
        <Strip explain={explain} changed={story.changed} why={story.why} notice={story.notice} />
      </div>
      <Guide id="pyramid" />
    </div>
  );
}

const FLOW = ["CPU", "Registers", "L1", "L2", "RAM", "Storage", "CPU return"];

export function AccessPanel({ explain, latencies }: { explain: boolean; latencies: Latencies }) {
  const [text, setText] = useState("0x1A3F");
  const [operation, setOperation] = useState<"read" | "write">("read");
  const [memory, setMemory] = useState<LevelMemory>(freshLevelMemory);
  const [result, setResult] = useState<AccessTrace | null>(null);
  const [cursor, setCursor] = useState(-1);
  const [running, setRunning] = useState(false);
  const [showLatency, setShowLatency] = useState(true);
  const [rates, setRates] = useState({ l1Miss: 0.05, l2Miss: 0.1, ramMiss: 0.2 });
  const [error, setError] = useState("");
  const flowRef = useRef<HTMLDivElement>(null);
  const amat = hierarchyAmat(latencies, rates);

  useGSAP(() => {
    if (!flowRef.current || reducedMotion()) return;
    gsap.fromTo(flowRef.current.querySelectorAll(".hot"), { y: 6 }, { y: 0, duration: 0.25, stagger: 0.05 });
  }, { dependencies: [cursor, result?.address], scope: flowRef });

  useEffect(() => {
    if (!running || !result) return undefined;
    if (cursor >= 6) {
      setRunning(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setCursor((value) => value + 1), reducedMotion() ? 0 : 320);
    return () => window.clearTimeout(timer);
  }, [running, cursor, result]);

  function trace() {
    const parsed = parseHex(text);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setError("");
    const next = traceHierarchyAccess(memory, parsed.value, operation, latencies);
    setMemory(next.memory);
    setResult(next);
    setCursor(0);
    setRunning(true);
  }

  const story = result
    ? {
      changed: `${hex(result.address)} was served from ${result.level} in ${result.cycles.toLocaleString()} cycles.`,
      why: result.level === "L1" ? "The block was already in L1, so the search stopped there." : `The closer levels missed. The block was found in ${result.level}.`,
      notice: result.filled.length ? `Filled ${result.filled.join(" and ")} so a later use of this block can hit sooner.` : "No closer level needed a fill.",
    }
    : { changed: "Trace an address to walk the hierarchy.", why: "A hit stops the search.", notice: "A miss continues to the next level and may fill closer levels." };

  return (
    <div className="hhx-grid">
      <div className="hhx-main">
        <div className="hhx-split access">
          <section className="hhx-card">
            <h2>Request Path</h2>
            <p>The CPU checks registers, then L1, then L2, then RAM, and finally storage. The search stops at the first hit. On a miss, the next level is checked and the block may be copied closer to the CPU.</p>
            {explain ? <p className="hhx-callout"><Icon name="info" size={14} /> Closer levels are smaller and faster in this lab. A miss pays that level only when the search reaches it.</p> : null}
          </section>
          <section className="hhx-card" ref={flowRef}>
            <header><h2>Memory Access Flow</h2><label className="hhx-switch">Show latencies<button type="button" role="switch" aria-checked={showLatency} className={showLatency ? "on" : ""} onClick={() => setShowLatency((value) => !value)} /></label></header>
            <div className="hhx-flow">
              {FLOW.map((name, index) => {
                const step = result?.path[index - 1];
                const hot = result !== null && index <= cursor + 1;
                const latency = name === "L1" ? latencies.l1 : name === "L2" ? latencies.l2 : name === "RAM" ? latencies.ram : name === "Storage" ? latencies.storage : name === "Registers" ? latencies.register : null;
                return <article key={name} className={`${hot ? "hot" : ""} ${step?.outcome ?? ""}`} title={step ? `${name} ${step.outcome}` : name}><b>{name === "CPU" ? `CPU ${text}` : name === "CPU return" ? "Data returned" : name}</b>{showLatency && latency !== null ? <small>{latency.toLocaleString()} cyc</small> : null}<em>{step ? step.outcome : index === 0 || name === "CPU return" ? "" : "—"}</em></article>;
              })}
            </div>
          </section>
        </div>
        <div className="hhx-three">
          <section className="hhx-card">
            <h2>Try a Memory Request</h2>
            <label>Memory address (hex)<input aria-label="Memory address hex" value={text} onChange={(event) => setText(event.target.value)} /></label>
            <div className="hhx-actions" role="group" aria-label="Operation">
              <button type="button" className={operation === "read" ? "on" : ""} onClick={() => setOperation("read")}>Read</button>
              <button type="button" className={operation === "write" ? "on" : ""} onClick={() => setOperation("write")}>Write</button>
            </div>
            <button type="button" className="primary" onClick={trace}><Icon name="play" size={14} /> Trace Access</button>
            <div className="hhx-actions">
              <button type="button" onClick={() => setCursor((value) => Math.min((result?.path.length ?? 0), value + 1))}>Step</button>
              <button type="button" onClick={() => setRunning((value) => !value)}>{running ? "Pause" : "Run"}</button>
              <button type="button" onClick={() => { setMemory(freshLevelMemory()); setResult(null); setCursor(-1); setText("0x1A3F"); setError(""); }}>Reset</button>
            </div>
            {error ? <p className="hhx-error" role="alert">{error}</p> : null}
          </section>
          <section className="hhx-card">
            <h2>Access Result</h2>
            <p role="status">{result ? `Request served from ${result.level}. ${result.cycles.toLocaleString()} cycles.` : "Trace an address."}</p>
            <dl>
              <div><dt>Address</dt><dd>{result ? hex(result.address) : "—"}</dd></div>
              <div><dt>Operation</dt><dd>{operation}</dd></div>
              <div><dt>Path</dt><dd>{result ? result.path.map((step) => `${step.name} ${step.outcome}`).join(" → ") : "—"}</dd></div>
              <div><dt>Total latency</dt><dd>{result ? result.cycles.toLocaleString() : "—"}</dd></div>
              <div><dt>Blocks filled</dt><dd>{result?.filled.join(", ") || "None"}</dd></div>
            </dl>
          </section>
          <section className="hhx-card">
            <h2 title="Average memory access time from the hit time and the miss rates you set">Average Memory Access Time</h2>
            <p className="hhx-formula">AMAT = T<sub>L1</sub> + M<sub>L1</sub> (T<sub>L2</sub> + M<sub>L2</sub> (T<sub>RAM</sub> + M<sub>RAM</sub> · T<sub>storage</sub>))</p>
            <label>L1 miss rate <input aria-label="L1 miss rate" type="number" min={0} max={1} step={0.01} value={rates.l1Miss} onChange={(event) => setRates({ ...rates, l1Miss: Number(event.target.value) })} /></label>
            <label>L2 miss rate <input aria-label="L2 miss rate" type="number" min={0} max={1} step={0.01} value={rates.l2Miss} onChange={(event) => setRates({ ...rates, l2Miss: Number(event.target.value) })} /></label>
            <label>RAM miss rate <input aria-label="RAM miss rate" type="number" min={0} max={1} step={0.01} value={rates.ramMiss} onChange={(event) => setRates({ ...rates, ramMiss: Number(event.target.value) })} /></label>
            <p>L1 {latencies.l1} · L2 {latencies.l2} · RAM {latencies.ram} · Storage {latencies.storage.toLocaleString()}</p>
            <p className="hhx-amat">Calculated AMAT {formatCycles(amat)}</p>
            <p className="hhx-hint">Miss rates are assumptions for this formula. They are not measured from the single trace above. A non-zero RAM miss rate includes storage and dominates the result.</p>
          </section>
        </div>
        <Strip explain={explain} changed={story.changed} why={story.why} notice={story.notice} />
      </div>
      <Guide id="access" />
    </div>
  );
}

const PATTERNS: Array<{ id: PatternKind; label: string }> = [
  { id: "sequential", label: "Sequential" },
  { id: "repeated", label: "Repeated" },
  { id: "strided", label: "Strided" },
  { id: "loop", label: "Looping" },
  { id: "random", label: "Random" },
  { id: "row", label: "Matrix row-major" },
  { id: "column", label: "Matrix column-major" },
];

export function LocalityPanel({ explain }: { explain: boolean }) {
  const [kind, setKind] = useState<PatternKind>("sequential");
  const [start, setStart] = useState(16);
  const [stride, setStride] = useState(1);
  const [count, setCount] = useState(12);
  const [block, setBlock] = useState(4);
  const [trace, setTrace] = useState<number[]>(() => buildPattern("sequential", 16, 1, 12));
  const [cursor, setCursor] = useState(12);
  const [running, setRunning] = useState(false);
  const report = useMemo(() => localityReport(trace.slice(0, Math.max(0, cursor)), block), [trace, cursor, block]);
  const seen = new Set<number>();

  useEffect(() => {
    if (!running) return undefined;
    if (cursor >= trace.length) {
      setRunning(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setCursor((value) => value + 1), reducedMotion() ? 0 : 280);
    return () => window.clearTimeout(timer);
  }, [running, cursor, trace.length]);

  function load(nextKind: PatternKind, nextStart: number, nextStride: number, nextCount: number) {
    setKind(nextKind);
    setStart(nextStart);
    setStride(nextStride);
    setCount(nextCount);
    setTrace(buildPattern(nextKind, nextStart, nextStride, nextCount, 3));
    setCursor(0);
    setRunning(true);
  }

  const story = kind === "random"
    ? { changed: "You selected a scattered pattern.", why: "Successive addresses rarely share a cache block.", notice: "The teaching hit-rate estimate stays low." }
    : { changed: `You selected ${kind} access with stride ${stride}.`, why: kind === "repeated" ? "The same address is used again, which is temporal locality." : "Successive addresses stay in the same or a neighboring block.", notice: "That is the pattern caches are built to capture." };

  return (
    <div className="hhx-grid">
      <div className="hhx-main">
        <section className="hhx-card">
          <h2>Temporal and Spatial Locality</h2>
          <div className="hhx-pair">
            <article className="time"><b><Icon name="reset" size={14} /> Temporal locality</b><p>If you use an address, you are likely to use that same address again soon.</p></article>
            <article className="space"><b><Icon name="grid" size={14} /> Spatial locality</b><p>If you use an address, you are likely to use a nearby address soon, often the next bytes in the block.</p></article>
          </div>
        </section>
        <section className="hhx-card">
          <header><h2>Memory Access Sequence</h2><p className="hhx-legend"><i className="time" /> Repeated <i className="space" /> Nearby</p></header>
          <div className="hhx-seq">
            {trace.map((address, index) => {
              const repeat = seen.has(address);
              seen.add(address);
              const previous = trace[index - 1];
              const near = previous !== undefined && Math.abs(Math.floor(address / block) - Math.floor(previous / block)) <= 1;
              const shown = index < cursor;
              return <span key={`${address}-${index}`} className={`${shown && repeat ? "time" : ""} ${shown && near && !repeat ? "space" : ""} ${index === cursor - 1 ? "now" : ""}`} title={`Access ${index + 1}: ${address}`}>{shown ? address : "·"}</span>;
            })}
          </div>
          <p className="hhx-hint">Temporal score {(report.temporal * 100).toFixed(0)}% · spatial score {(report.spatial * 100).toFixed(0)}% · teaching hit-rate estimate {(report.estimate * 100).toFixed(0)}%. Scores describe this sequence. They are not a processor counter.</p>
        </section>
        <div className="hhx-split">
          <section className="hhx-card">
            <h2>Try an Access Pattern</h2>
            <label>Access pattern<select aria-label="Access pattern" value={kind} onChange={(event) => setKind(event.target.value as PatternKind)}>{PATTERNS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
            <label>Start address<input aria-label="Start address" type="number" min={0} value={start} onChange={(event) => setStart(Number(event.target.value) || 0)} /></label>
            <label>Stride<input aria-label="Stride" type="number" min={0} value={stride} onChange={(event) => setStride(Number(event.target.value) || 0)} /></label>
            <label>Number of accesses<input aria-label="Number of accesses" type="number" min={1} max={32} value={count} onChange={(event) => setCount(Number(event.target.value) || 1)} /></label>
            <label>Block size (bytes)<input aria-label="Block size" type="number" min={1} value={block} onChange={(event) => setBlock(Math.max(1, Number(event.target.value) || 1))} /></label>
            <div className="hhx-actions">
              <button type="button" className="primary" onClick={() => load(kind, start, stride, count)}><Icon name="play" size={14} /> Run Pattern</button>
              <button type="button" onClick={() => setCursor((value) => Math.min(trace.length, value + 1))}>Step</button>
              <button type="button" onClick={() => setRunning((value) => !value)}>{running ? "Pause" : "Run"}</button>
              <button type="button" onClick={() => load("sequential", 16, 1, 12)}>Reset</button>
            </div>
          </section>
          <section className="hhx-card">
            <h2>Pattern Comparison</h2>
            <div className="hhx-pair">
              <button type="button" className="poor" onClick={() => load("random", 0, 1, 12)}>
                <b>Poor locality</b>
                <span>Scattered addresses, little reuse.</span>
                <em>Load this pattern</em>
              </button>
              <button type="button" className="good" onClick={() => load("sequential", 16, 1, 12)}>
                <b>Good locality</b>
                <span>Sequential addresses with reuse.</span>
                <em>Load this pattern</em>
              </button>
            </div>
          </section>
        </div>
        <Strip explain={explain} changed={story.changed} why={story.why} notice={story.notice} />
      </div>
      <Guide id="locality" />
    </div>
  );
}

export function CachePanel({ explain }: { explain: boolean }) {
  const [blockBytes, setBlockBytes] = useState(16);
  const [lines, setLines] = useState(4);
  const [assoc, setAssoc] = useState<"1" | "2" | "4" | "full">("1");
  const [policy, setPolicy] = useState<ReplacePolicy>("lru");
  const [sequence, setSequence] = useState("0, 4, 8, 16, 0, 32, 4");
  const [radix, setRadix] = useState<"dec" | "hex">("dec");
  const ways = assoc === "full" ? lines : Number(assoc);
  const [cache, setCache] = useState<MiniCache>(() => createMiniCache(4, 16, 1, "lru"));
  const [history, setHistory] = useState<CacheStep[]>([]);
  const [error, setError] = useState("");
  const visualRef = useRef<HTMLDivElement>(null);
  const current = history.at(-1) ?? null;

  useGSAP(() => {
    if (!visualRef.current || reducedMotion() || !current) return;
    gsap.fromTo(visualRef.current.querySelectorAll(".now"), { scale: 0.96 }, { scale: 1, duration: 0.25 });
  }, { dependencies: [current?.address, current?.kind], scope: visualRef });

  function addresses(): number[] | null {
    const parts = sequence.split(/[\s,]+/).filter(Boolean);
    const values = parts.map((part) => part.startsWith("0x") || part.startsWith("0X") ? Number.parseInt(part, 16) : Number(part));
    if (values.some((value) => !Number.isFinite(value) || value < 0)) return null;
    return values;
  }

  function apply(next: CacheStep) {
    setCache(next.cache);
    setHistory((rows) => [...rows, next]);
  }

  function runAll() {
    const list = addresses();
    if (!list) {
      setError("Enter decimal addresses, separated by commas. Hex values may use a 0x prefix.");
      return;
    }
    setError("");
    let machine = createMiniCache(lines, blockBytes, ways, policy);
    const rows: CacheStep[] = [];
    let seed = 1;
    for (const address of list) {
      const step = stepMiniCache(machine, address, seed);
      machine = step.cache;
      seed = step.seed;
      rows.push(step);
    }
    setCache(machine);
    setHistory(rows);
  }

  function stepOne() {
    const list = addresses();
    if (!list) {
      setError("Enter decimal addresses, separated by commas.");
      return;
    }
    const address = list[history.length];
    if (address === undefined) return;
    setError("");
    apply(stepMiniCache(history.length === 0 ? createMiniCache(lines, blockBytes, ways, policy) : cache, address, history.length + 1));
  }

  const hits = history.filter((row) => row.hit).length;
  const counts = {
    compulsory: history.filter((row) => row.kind === "compulsory").length,
    conflict: history.filter((row) => row.kind === "conflict").length,
    capacity: history.filter((row) => row.kind === "capacity").length,
  };
  const focus = current?.block ?? 0;
  const windowStart = Math.max(0, focus - 2);
  const story = current
    ? {
      changed: `Address ${current.address} ${current.hit ? "hit" : "missed"} in set ${current.set}.`,
      why: current.note,
      notice: current.hit ? "The tag matched a valid line, so the block was not loaded again." : `Block ${current.block} now occupies set ${current.set}.`,
    }
    : { changed: "Run or step a sequence.", why: "The index is the block number modulo the number of sets.", notice: "The tag distinguishes blocks that share a set." };

  return (
    <div className="hhx-grid">
      <div className="hhx-main">
        <div className="hhx-split cache">
          <section className="hhx-card">
            <header><h2>Cache Settings</h2><button type="button" onClick={() => { setBlockBytes(16); setLines(4); setAssoc("1"); setPolicy("lru"); setSequence("0, 4, 8, 16, 0, 32, 4"); setCache(createMiniCache(4, 16, 1, "lru")); setHistory([]); setError(""); }}><Icon name="reset" size={14} /> Reset to Default</button></header>
            <label>Line size (block size)<select aria-label="Block size" value={blockBytes} onChange={(event) => setBlockBytes(Number(event.target.value))}>{[4, 8, 16, 32, 64].map((size) => <option key={size} value={size}>{size} bytes</option>)}</select></label>
            <label>Number of cache lines<select aria-label="Cache lines" value={lines} onChange={(event) => setLines(Number(event.target.value))}>{[2, 4, 8, 16].map((count) => <option key={count} value={count}>{count}</option>)}</select></label>
            <label>Associativity<select aria-label="Associativity" value={assoc} onChange={(event) => setAssoc(event.target.value as "1" | "2" | "4" | "full")}><option value="1">Direct-mapped</option><option value="2">2-way</option><option value="4">4-way</option><option value="full">Fully associative</option></select></label>
            <label>Replacement policy<select aria-label="Replacement policy" value={policy} disabled={assoc === "1"} title={assoc === "1" ? "A direct-mapped line has only one place to go." : "Choose which way to replace when the set is full."} onChange={(event) => setPolicy(event.target.value as ReplacePolicy)}><option value="lru">LRU</option><option value="fifo">FIFO</option><option value="random">Random</option></select></label>
            <label>Memory request sequence<textarea aria-label="Address sequence" value={sequence} onChange={(event) => setSequence(event.target.value)} /></label>
            <div className="hhx-actions">
              <button type="button" className="primary" onClick={runAll}><Icon name="play" size={14} /> Run</button>
              <button type="button" onClick={stepOne}><Icon name="step" size={14} /> Step</button>
              <button type="button" onClick={() => { setCache(createMiniCache(lines, blockBytes, ways, policy)); setHistory([]); }}>Clear</button>
            </div>
            {error ? <p className="hhx-error" role="alert">{error}</p> : null}
          </section>
          <section className="hhx-card" ref={visualRef}>
            <header><h2>Cache Simulator</h2><p className="hhx-legend"><i className="hit" /> Hit <i className="miss" /> Miss <i className="now" /> Current</p></header>
            <div className="hhx-cache">
              <table className="hhx-table">
                <caption>Main memory blocks</caption>
                <thead><tr><th>Block</th><th>Address range</th></tr></thead>
                <tbody>
                  {Array.from({ length: 6 }, (_, index) => windowStart + index).map((block) => (
                    <tr key={block} className={current?.block === block ? "now" : ""}><td>{block}</td><td>{block * blockBytes}–{block * blockBytes + blockBytes - 1}</td></tr>
                  ))}
                </tbody>
              </table>
              <p className="hhx-map">{current ? `Block ${current.block} → set ${current.set}, tag ${current.tag}` : "Block maps to set = block mod sets"}</p>
              <table className="hhx-table">
                <caption>Cache ({cache.lines} lines, {cache.ways === 1 ? "direct-mapped" : `${cache.ways}-way`})</caption>
                <thead><tr><th>Set</th><th>Way</th><th>Valid</th><th>Tag</th><th>Block</th></tr></thead>
                <tbody>
                  {cache.rows.flatMap((set, setIndex) => set.map((line, way) => (
                    <tr key={`${setIndex}-${way}`} className={current && current.set === setIndex && current.tag === line.tag && line.valid ? "now" : ""}>
                      <td>{setIndex}</td><td>{way}</td><td>{line.valid ? "Yes" : "No"}</td><td>{line.valid ? line.tag : "—"}</td><td>{line.valid ? line.block : "—"}</td>
                    </tr>
                  )))}
                </tbody>
              </table>
            </div>
            <div className="hhx-metrics">
              <article title="Hits divided by accesses so far"><b>Hit rate</b><strong>{history.length ? `${((hits / history.length) * 100).toFixed(1)}%` : "—"}</strong><small>{hits} / {history.length || 0}</small></article>
              <article title="Misses divided by accesses so far"><b>Miss rate</b><strong>{history.length ? `${(((history.length - hits) / history.length) * 100).toFixed(1)}%` : "—"}</strong></article>
              <article title="First time this block has been used"><b>Compulsory</b><strong>{counts.compulsory}</strong></article>
              <article title="Missed here, but a same-size fully associative cache would still hold it"><b>Conflict</b><strong>{counts.conflict}</strong></article>
              <article title="Missed here and in a same-size fully associative cache"><b>Capacity</b><strong>{counts.capacity}</strong></article>
              <article><b>Current block</b><strong>{current ? current.block : "—"}</strong><small>{current ? `Address ${current.address}` : ""}</small></article>
            </div>
          </section>
        </div>
        <section className="hhx-card">
          <header>
            <h2>Access History</h2>
            <div className="hhx-actions" role="group" aria-label="Address radix">
              <button type="button" className={radix === "dec" ? "on" : ""} onClick={() => setRadix("dec")}>Decimal</button>
              <button type="button" className={radix === "hex" ? "on" : ""} onClick={() => setRadix("hex")}>Hex</button>
            </div>
          </header>
          <div className="hhx-scroll">
            <table className="hhx-table">
              <thead><tr><th>#</th><th>Address</th><th>Block</th><th>Set</th><th>Tag</th><th>Result</th><th>Loaded</th><th>Note</th></tr></thead>
              <tbody>
                {history.length === 0 ? <tr><td colSpan={8}>No accesses yet.</td></tr> : history.map((row, index) => (
                  <tr key={`${row.address}-${index}`} className={index === history.length - 1 ? "now" : ""}>
                    <td>{index + 1}</td>
                    <td>{radix === "hex" ? hex(row.address) : row.address}</td>
                    <td>{row.block}</td><td>{row.set}</td><td>{row.tag}</td>
                    <td className={row.hit ? "hit" : "miss"}>{row.hit ? "Hit" : "Miss"}</td>
                    <td>{row.loaded === null ? "—" : row.loaded}</td>
                    <td>{row.kind === "hit" ? row.note : `${row.kind}: ${row.note}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <Strip explain={explain} changed={story.changed} why={story.why} notice={story.notice} />
      </div>
      <Guide id="cache" />
    </div>
  );
}

function parseHex(text: string): { ok: true; value: number } | { ok: false; error: string } {
  const cleaned = text.trim();
  if (/^\d+$/.test(cleaned)) {
    const value = Number(cleaned);
    if (value > 0xffffffff) return { ok: false, error: "That address does not fit in 32 bits." };
    return { ok: true, value };
  }
  if (/^(?:0x)?[0-9a-f]+$/i.test(cleaned)) {
    return { ok: true, value: Number.parseInt(cleaned.replace(/^0x/i, ""), 16) };
  }
  return { ok: false, error: "Enter a hexadecimal address, with or without 0x." };
}

function formatCycles(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return value >= 100 ? `${Math.round(value).toLocaleString()} cycles` : `${value.toFixed(2)} cycles`;
}
