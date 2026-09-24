import { useState } from "react";
import { useStudioTab } from "../../layout/useStudioTab";
import { Button, Card, ExplainBar, Metric, parseNumberInput } from "../../design-system/ui";
import { createCache } from "../../engines/cache/cache";
import { LAB_LEVELS, L1_PRESET, L2_PRESET, spatialReuse, temporalReuse, walkTrace, type Latencies } from "../../engines/arch/hierarchy";
import { StudioFrame } from "../../layout/StudioFrame";
import { HIERARCHY_LESSONS, lessonOf } from "../../data/studioLessons";
import { usePrefs } from "../../store/prefs";

const START: Latencies = { register: 1, l1: 3, l2: 12, ram: 80, storage: 10000 };
const TABS = [
  { id: "pyramid", label: "Hierarchy" },
  { id: "access", label: "Access" },
  { id: "locality", label: "Locality" },
  { id: "cache", label: "Cache" },
];

export function HierarchyStudio() {
  const [tab, setTab] = useStudioTab(TABS, "pyramid");
  const [latencies, setLatencies] = useState(START);
  const [traceText, setTrace] = useState("0 4 0 1 8");
  const [registers, setRegisters] = useState("0");
  const { prefs } = usePrefs();
  const trace = traceText.split(/[\s,]+/).filter(Boolean).map(Number).filter((value) => Number.isFinite(value));
  const resident = registers.split(/[\s,]+/).filter(Boolean).map(Number).filter((value) => Number.isFinite(value));
  const walked = walkTrace(trace, resident, 256, latencies, createCache(L1_PRESET), createCache(L2_PRESET));
  const last = walked.hops.at(-1);
  const lesson = lessonOf(HIERARCHY_LESSONS, tab, "pyramid");

  return (
    <StudioFrame icon="book" title="Memory Hierarchy" description="A request checks registers, then the lab caches, then RAM, then storage. Latencies are teaching parameters for this experiment." tabs={TABS} tab={tab} onTab={setTab} guide={lesson.guide} takeaways={lesson.takeaways} theory={lesson.theory}>
      {prefs.explain ? <ExplainBar what={last ? `Address ${last.address} was supplied by ${last.level} in ${last.cycles} cycles.` : "Enter a trace."} why="The first miss fills L1 and L2. The next use of that block can hit L1." notice="Storage is charged only when the address is outside the 256-word RAM." /> : null}
      {tab === "pyramid" ? (
        <div className="grid cards-2">
          {LAB_LEVELS.map((level) => {
            const key = level.name === "Registers" ? "register" : level.name === "L1" ? "l1" : level.name === "L2" ? "l2" : level.name === "RAM" ? "ram" : "storage";
            return (
              <Card key={level.name} title={level.name}>
                <p>{level.capacity} · {level.bandwidth}</p>
                <p className="tiny">{level.cost}</p>
                <label className="tiny">Latency cycles
                  <input className="text-input" aria-label={`${level.name} latency`} type="number" value={latencies[key]} onChange={(event) => setLatencies({ ...latencies, [key]: parseNumberInput(event.target.value, latencies[key] ?? 1) })} />
                </label>
              </Card>
            );
          })}
        </div>
      ) : null}
      {tab === "access" ? (
        <Card title="CPU request">
          <input className="text-input" aria-label="Address trace" value={traceText} onChange={(event) => setTrace(event.target.value)} />
          <input className="text-input" aria-label="Register resident addresses" value={registers} onChange={(event) => setRegisters(event.target.value)} />
          <table className="data">
            <thead><tr><th>Address</th><th>Found in</th><th>Cycles</th><th>Penalty</th></tr></thead>
            <tbody>{walked.hops.map((hop, index) => <tr key={`${hop.address}-${index}`}><td>{hop.address}</td><td>{hop.level}</td><td>{hop.cycles}</td><td>{hop.penalty}</td></tr>)}</tbody>
          </table>
          <Metric label="Trace cycles" value={String(walked.cycles)} />
        </Card>
      ) : null}
      {tab === "locality" ? (
        <Card title="Reuse">
          <p>Temporal {temporalReuse(trace).toFixed(2)} · Spatial within 4 bytes {spatialReuse(trace, 4).toFixed(2)}</p>
          <p className="tiny">Trace A B A A C A repeats A. Trace 100 101 102 103 stays inside one 4-byte line.</p>
          <Button onClick={() => setTrace("1 2 1 1 3 1")}>Temporal example</Button>
          <Button onClick={() => setTrace("100 101 102 103")}>Spatial example</Button>
        </Card>
      ) : null}
      {tab === "cache" ? (
        <div className="grid cards-3">
          <Metric label="L1 hit ratio" value={walked.l1.stats.accesses ? (walked.l1.stats.hits / walked.l1.stats.accesses).toFixed(2) : "—"} />
          <Metric label="L1 miss ratio" value={walked.l1.stats.accesses ? (walked.l1.stats.misses / walked.l1.stats.accesses).toFixed(2) : "—"} />
          <Metric label="L1 AMAT" value={walked.amat.toFixed(1)} />
        </div>
      ) : null}
    </StudioFrame>
  );
}
