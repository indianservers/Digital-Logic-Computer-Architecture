import { useMemo, useState } from "react";
import { useStudioTab } from "../../layout/useStudioTab";
import { Button, Card, ExplainBar, Metric, Segmented, parseNumberInput } from "../../design-system/ui";
import { accessCache, accessHierarchy, createCache, createHierarchy, type CacheMachine } from "../../engines/cache/cache";
import { decompose, type CacheConfig } from "../../engines/cache/mapping";
import { hierarchicalAmat, hitRate, missRate } from "../../engines/cache/metrics";
import { StudioFrame } from "../../layout/StudioFrame";
import { usePrefs } from "../../store/prefs";
import { saveRecord } from "../../store/projects";

const PRESETS: Record<string, CacheConfig> = {
  "Tiny direct": { addressBits: 8, memoryBytes: 256, cacheBytes: 32, blockBytes: 4, associativity: 1, replacement: "lru", writePolicy: "through", allocation: "allocate", seed: 1 },
  "2-way": { addressBits: 8, memoryBytes: 256, cacheBytes: 32, blockBytes: 4, associativity: 2, replacement: "lru", writePolicy: "back", allocation: "allocate", seed: 1 },
  "4-way": { addressBits: 8, memoryBytes: 256, cacheBytes: 64, blockBytes: 4, associativity: 4, replacement: "fifo", writePolicy: "back", allocation: "allocate", seed: 1 },
};

const TABS = [
  { id: "sim", label: "Simulator" },
  { id: "locality", label: "Locality" },
  { id: "policy", label: "Policies" },
  { id: "levels", label: "Hierarchy" },
];

export function CacheStudio() {
  const [tab, setTab] = useStudioTab(TABS, "sim");
  const [preset, setPreset] = useState("Tiny direct");
  const [config, setConfig] = useState<CacheConfig>(PRESETS["Tiny direct"] ?? PRESETS["2-way"] as CacheConfig);
  const [machine, setMachine] = useState<CacheMachine>(() => createCache(PRESETS["Tiny direct"] as CacheConfig));
  const [trace, setTrace] = useState("16, 20, 24, 16, 36");
  const [cursor, setCursor] = useState(0);
  const [last, setLast] = useState("Enter addresses, then step.");
  const [status, setStatus] = useState("—");
  const { prefs } = usePrefs();
  const addresses = useMemo(() => trace.split(/[\s,]+/).map((item) => Number.parseInt(item, item.startsWith("0x") ? 16 : 10)).filter((item) => Number.isFinite(item)), [trace]);
  const focus = addresses[Math.max(0, cursor - 1)] ?? addresses[0] ?? 0;
  const parts = decompose(focus, config);

  function applyPreset(name: string) {
    const next = PRESETS[name];
    if (!next) return;
    setPreset(name);
    setConfig(next);
    setMachine(createCache(next));
    setCursor(0);
    setStatus("—");
  }

  function step() {
    const address = addresses[cursor];
    if (address === undefined) return;
    const result = accessCache(machine, address, "read");
    setMachine(result.machine);
    setLast(result.result.explain);
    setStatus(result.result.hit ? "HIT" : "MISS");
    setCursor(cursor + 1);
  }

  return (
    <StudioFrame icon="bolt" title="Cache Memory" description="Step a trace through a cache whose mapping, replacement, and write policy you can change." tabs={TABS} tab={tab} onTab={setTab} onReset={() => applyPreset(preset)} guide={["The index picks a set. The tag must match a valid line.", "A first visit is a compulsory miss.", "A full set with a different tag is a conflict miss."]} takeaways={["Write-back remembers a dirty line until eviction.", "Write-through updates memory immediately.", "AMAT grows with each extra miss level."]}>
      {prefs.explain ? <ExplainBar what={last} why={status === "HIT" ? "The requested block is already in the indexed set." : "The block has to be installed, and something may be evicted."} notice="Numbers come from this configuration, not from a canned example." /> : null}
      {tab === "sim" ? (
        <div className="builder">
          <Card title="Configuration">
            <Segmented options={Object.keys(PRESETS)} value={preset} onChange={applyPreset} />
            <label className="tiny">Associativity<input className="text-input" type="number" value={config.associativity} onChange={(event) => setConfig({ ...config, associativity: Math.max(1, parseNumberInput(event.target.value, config.associativity)) })} /></label>
            <Segmented options={["lru", "fifo", "random"]} value={config.replacement} onChange={(value) => setConfig({ ...config, replacement: value as CacheConfig["replacement"] })} />
            <Segmented options={["through", "back"]} value={config.writePolicy} onChange={(value) => setConfig({ ...config, writePolicy: value as CacheConfig["writePolicy"] })} />
            <Segmented options={["allocate", "no-allocate"]} value={config.allocation} onChange={(value) => setConfig({ ...config, allocation: value as CacheConfig["allocation"] })} />
            <Button onClick={() => { setMachine(createCache(config)); setCursor(0); setStatus("—"); }}>Apply</Button>
          </Card>
          <Card title="Access">
            <input className="text-input" aria-label="Address trace" value={trace} onChange={(event) => { setTrace(event.target.value); setCursor(0); }} />
            <div className="row">
              <Button variant="primary" onClick={step}>Step</Button>
              <Button onClick={() => void saveRecord({ id: "cache-lab", kind: "cache", name: preset, data: JSON.stringify({ config, trace }), updated: Date.now() })}>Save</Button>
            </div>
            <div className={status === "HIT" ? "status hit" : status === "MISS" ? "status miss" : "status"}>{status}</div>
            <p className="mono">{parts.binary}</p>
            <p>Tag {parts.tagBits || "—"} · Index {parts.indexBits || "—"} · Offset {parts.offsetBits || "—"}</p>
            <SetView machine={machine} focus={parts.index} />
          </Card>
          <Card title="Metrics">
            <Metric label="Accesses" value={String(machine.stats.accesses)} />
            <Metric label="Hits" value={String(machine.stats.hits)} />
            <Metric label="Misses" value={String(machine.stats.misses)} />
            <Metric label="Hit rate" value={`${Math.round(hitRate(machine.stats) * 100)}%`} />
            <Metric label="Miss rate" value={`${Math.round(missRate(machine.stats) * 100)}%`} />
            <Metric label="Evictions" value={String(machine.stats.evictions)} />
            <Metric label="Write-backs" value={String(machine.stats.writeBacks)} />
          </Card>
        </div>
      ) : null}
      {tab === "locality" ? <Locality /> : null}
      {tab === "policy" ? <PolicyCompare config={config} /> : null}
      {tab === "levels" ? <Hierarchy /> : null}
    </StudioFrame>
  );
}

function SetView({ machine, focus }: { machine: CacheMachine; focus: number }) {
  const set = machine.sets[focus] ?? [];
  return (
    <table className="data">
      <thead><tr><th>Way</th><th>Valid</th><th>Tag</th><th>Dirty</th></tr></thead>
      <tbody>
        {set.map((line, index) => (
          <tr key={index}><td>{index}</td><td>{line.valid ? "1" : "0"}</td><td>{line.valid ? line.tag : "—"}</td><td>{line.dirty ? "1" : "0"}</td></tr>
        ))}
      </tbody>
    </table>
  );
}

function Locality() {
  const config: CacheConfig = { addressBits: 8, memoryBytes: 256, cacheBytes: 32, blockBytes: 4, associativity: 1, replacement: "lru", writePolicy: "through", allocation: "allocate", seed: 1 };
  const temporal = [4, 9, 4, 4, 9, 4];
  const spatial = [100, 101, 102, 103];
  const time = runLocal(config, temporal);
  const space = runLocal(config, spatial);
  return (
    <div className="grid cards-2">
      <Card title="Temporal">
        <p>{temporal.join(", ")}</p>
        <p>{time.join(" · ")}</p>
      </Card>
      <Card title="Spatial">
        <p>{spatial.join(", ")}</p>
        <p>{space.join(" · ")}</p>
      </Card>
    </div>
  );
}

function runLocal(config: CacheConfig, addresses: number[]): string[] {
  let machine = createCache(config);
  return addresses.map((address) => {
    const step = accessCache(machine, address, "read");
    machine = step.machine;
    return `${address} ${step.result.kind}`;
  });
}

function PolicyCompare({ config }: { config: CacheConfig }) {
  const trace = [0, 8, 0, 16];
  const lru = useMemo(() => {
    let machine = createCache({ ...config, associativity: 2, replacement: "lru" });
    for (const address of trace) machine = accessCache(machine, address, "read").machine;
    return machine.stats.evictions;
  }, [config]);
  const fifo = useMemo(() => {
    let machine = createCache({ ...config, associativity: 2, replacement: "fifo" });
    for (const address of trace) machine = accessCache(machine, address, "read").machine;
    return machine.stats.evictions;
  }, [config]);
  return (
    <Card title="Same trace, two policies">
      <p>Trace {trace.join(", ")} on a 2-way cache.</p>
      <Metric label="LRU evictions" value={String(lru)} />
      <Metric label="FIFO evictions" value={String(fifo)} />
      <p>LRU keeps the reused first block. FIFO evicts the oldest install even if it was used again.</p>
    </Card>
  );
}

function Hierarchy() {
  const [levels, setLevels] = useState(() => createHierarchy([
    { name: "L1", hitCycles: 1, config: { ...PRESETS["Tiny direct"] as CacheConfig, cacheBytes: 16 } },
    { name: "L2", hitCycles: 4, config: { ...PRESETS["2-way"] as CacheConfig, cacheBytes: 32 } },
    { name: "L3", hitCycles: 12, config: { ...PRESETS["4-way"] as CacheConfig, cacheBytes: 64 } },
  ], 100));
  const [note, setNote] = useState("CPU → L1 → L2 → L3 → RAM");
  const [latency, setLatency] = useState(0);
  const amat = hierarchicalAmat(levels.map((level) => ({ hitCycles: level.hitCycles, accesses: level.machine.stats.accesses, misses: level.machine.stats.misses })), 100);
  return (
    <Card title="Multi-level">
      <Button onClick={() => {
        const step = accessHierarchy(levels, 100, 0x10, "read");
        setLevels(step.levels);
        setNote(step.explain);
        setLatency(step.latency);
      }}>Access 0x10</Button>
      <p>{note}</p>
      <Metric label="This access" value={`${latency} cycles`} />
      <Metric label="AMAT" value={amat.toFixed(2)} />
      <p className="tiny">Latencies are the values in this lab: L1 1, L2 4, L3 12, RAM 100.</p>
    </Card>
  );
}
