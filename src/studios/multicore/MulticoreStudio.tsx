import { useSimulatorCapture } from "../../layout/SimulatorCapture";
import { useState } from "react";
import { useStudioTab } from "../../layout/useStudioTab";
import { Button, Card, ExplainBar, Metric } from "../../design-system/ui";
import { directoryRead, directoryWrite, falseShareInvalidations, mesiStep, msiStep, readShared, type DirectoryEntry, type MesiState, type MsiState } from "../../engines/arch/coherence";
import { StudioFrame } from "../../layout/StudioFrame";
import { MULTICORE_LESSONS, lessonOf } from "../../data/studioLessons";
import { usePrefs } from "../../store/prefs";
import { LabChallenge } from "../../layout/LabChallenge";

interface MesiEvent { core: number; op: "read" | "write"; before: MesiState[]; after: MesiState[]; bus: string; invalidations: number }

const TABS = [
  { id: "shared", label: "Memory" },
  { id: "mesi", label: "MESI" },
  { id: "msi", label: "MSI" },
  { id: "directory", label: "Directory" },
  { id: "false", label: "False sharing" },
];

export function MulticoreStudio() {
  useSimulatorCapture("studios/multicore/MulticoreStudio.tsx:MulticoreStudio", () => ({ tab, mesi, msi, bus, invalidations, directory, core, trace, msiBus, directoryInvalidations, lineBytes, secondAddress }), "005fd9e667f4");

  const [tab, setTab] = useStudioTab(TABS, "mesi");
  const [mesi, setMesi] = useState<MesiState[]>(["I", "I", "I", "I"]);
  const [msi, setMsi] = useState<MsiState[]>(["I", "I"]);
  const [bus, setBus] = useState("idle");
  const [invalidations, setInvalidations] = useState(0);
  const [directory, setDirectory] = useState<DirectoryEntry>({ owner: null, sharers: [] });
  const [core, setCore] = useState(0);
  const [trace, setTrace] = useState<MesiEvent[]>([]);
  const [msiBus, setMsiBus] = useState("idle");
  const [directoryInvalidations, setDirectoryInvalidations] = useState(0);
  const [lineBytes, setLineBytes] = useState(4);
  const [secondAddress, setSecondAddress] = useState(1);
  const activeCore = tab === "msi" ? Math.min(core, 1) : core;
  const { prefs } = usePrefs();
  const shared = readShared("shared", 0, 0, [40], [[1], [2], [3], [4]]);
  const local = readShared("distributed", activeCore, 0, [40], [[1], [2], [3], [4]]);
  const writes = Array.from({ length: 8 }, (_, index) => ({ core: index % 2, address: index % 2 === 0 ? 0 : secondAddress }));
  const sharingInvalidations = falseShareInvalidations(lineBytes, writes);

  function onMesi(op: "read" | "write") {
    const stepped = mesiStep(mesi, core, op);
    setMesi(stepped.states);
    setBus(stepped.bus);
    setInvalidations((count) => count + stepped.invalidations);
    setTrace((events) => [...events, { core, op, before: mesi.slice(), after: stepped.states.slice(), bus: stepped.bus, invalidations: stepped.invalidations }].slice(-12));
  }

  function reset() {
    setMesi(["I", "I", "I", "I"]); setMsi(["I", "I"]); setBus("idle"); setMsiBus("idle");
    setInvalidations(0); setDirectoryInvalidations(0); setDirectory({ owner: null, sharers: [] }); setCore(0); setTrace([]);
    setLineBytes(4); setSecondAddress(1);
  }

  const coldRead = trace.some((event) => event.op === "read" && event.before.every((state) => state === "I") && event.after[event.core] === "E");
  const sharedRead = trace.some((event) => event.op === "read" && event.after.filter((state) => state === "S").length >= 2);
  const exclusiveWrite = trace.some((event) => event.op === "write" && event.invalidations >= 1 && event.after[event.core] === "M");

  const lesson = lessonOf(MULTICORE_LESSONS, tab, "mesi");
  return (
    <StudioFrame icon="table" title="Multicore & Coherence" description="Each core can hold a copy. A write must obtain exclusive ownership and invalidate other cached copies before modifying the line." tabs={TABS} tab={tab} onTab={setTab} onReset={reset} guide={lesson.guide} takeaways={lesson.takeaways} theory={lesson.theory}>
      {prefs.explain && (tab === "mesi" || tab === "msi") ? <ExplainBar what={`Core ${activeCore} sees bus message ${tab === "msi" ? msiBus : bus}.`} why="Snooping means every cache watches that message and updates its own line state." notice={`This is one line and ${tab === "msi" ? "two" : "four"} cores, not a full memory-consistency proof.`} /> : null}
      <div className="row">
        {Array.from({ length: tab === "msi" ? 2 : 4 }, (_, index) => <Button key={index} variant={index === activeCore ? "primary" : "ghost"} aria-label={`Select core ${index}`} onClick={() => setCore(index)}>Core {index}{index === activeCore ? " · selected" : ""}</Button>)}
      </div>
      {tab === "shared" ? (
        <div className="grid cards-2">
          <Card title="Shared"><p>Core {core} reads address 0 from {shared.where}: {shared.value}</p></Card>
          <Card title="Distributed"><p>Core {core} reads address 0 from {local.where}: {local.value}</p></Card>
        </div>
      ) : null}
      {tab === "mesi" ? (
        <Card title="Line state">
          <div className="stage-row">{mesi.map((state, index) => <div key={index} className={index === core ? "cpu-block on" : "cpu-block"}>Core {index}<small>{state}</small></div>)}</div>
          <Button variant="primary" onClick={() => onMesi("read")}>Read</Button>
          <Button onClick={() => onMesi("write")}>Write</Button>
          <Button onClick={reset}>Reset</Button>
          <Metric label="Invalidations" value={String(invalidations)} />
          {!!trace.length && <div style={{ overflowX: "auto" }}><table className="data"><caption>Latest 12 MESI operations · one shared cache line</caption><thead><tr><th scope="col">Core / operation</th><th scope="col">Before C0–C3</th><th scope="col">After C0–C3</th><th scope="col">Bus event</th><th scope="col">Invalidated</th></tr></thead><tbody>{trace.map((event, index) => <tr key={index}><td>C{event.core} {event.op}</td><td>{event.before.join(" · ")}</td><td>{event.after.join(" · ")}</td><td>{event.bus}</td><td>{event.invalidations}</td></tr>)}</tbody></table></div>}
          <LabChallenge key={tab} objective="From a reset, read on Core 0, read on Core 1, then write on Core 1. Demonstrate Exclusive → Shared → Modified and an invalidation." passed={coldRead && sharedRead && exclusiveWrite} success="The trace contains a cold exclusive read, shared copies, and a write that invalidates another core." hint="Reset first. Select Core 0 and Read; select Core 1 and Read; then Write. Compare the before/after states in the trace." />
        </Card>
      ) : null}
      {tab === "msi" ? (
        <Card title="Modified, shared, invalid">
          <p>Core 0 {msi[0]} · Core 1 {msi[1]} · {msiBus}</p>
          <Button onClick={() => { const stepped = msiStep(msi, activeCore, "read"); setMsi(stepped.states); setMsiBus(stepped.bus); }}>Read</Button>
          <Button onClick={() => { const stepped = msiStep(msi, activeCore, "write"); setMsi(stepped.states); setMsiBus(stepped.bus); }}>Write</Button>
          <Button onClick={() => { setMsi(["I", "I"]); setMsiBus("idle"); }}>Reset MSI</Button>
        </Card>
      ) : null}
      {tab === "directory" ? (
        <Card title="Who has the line?">
          <p>Owner {directory.owner ?? "none"} · sharers {directory.sharers.join(", ") || "none"}</p>
          <Button onClick={() => setDirectory(directoryRead(directory, core))}>Read</Button>
          <Button onClick={() => { const stepped = directoryWrite(directory, core); setDirectory(stepped.entry); setDirectoryInvalidations(stepped.invalidated); }}>Write</Button>
          <p>Last write invalidated {directoryInvalidations} other copies.</p>
        </Card>
      ) : null}
      {tab === "false" ? (
        <Card title="Same line, different bytes">
          <label>Cache-line size (bytes) <select value={lineBytes} onChange={(event) => setLineBytes(Number(event.target.value))}>{[4, 16, 32, 64].map((size) => <option key={size} value={size}>{size}</option>)}</select></label>
          <label>Core 1 address (Core 0 writes address 0) <input type="number" min={1} max={256} value={secondAddress} onChange={(event) => setSecondAddress(Math.max(1, Math.min(256, Math.trunc(Number(event.target.value) || 1))))} /></label>
          <div className="row"><Metric label="Core 0 cache line" value="0" /><Metric label="Core 1 cache line" value={String(Math.floor(secondAddress / lineBytes))} /><Metric label="Invalidations / 8 writes" value={String(sharingInvalidations)} /></div>
          <p>Eight alternating writes: C0 → address 0, C1 → address {secondAddress}. {secondAddress < lineBytes ? "Different bytes occupy the same cache line, so ownership moves between cores." : "The addresses occupy separate cache lines, so these writes do not invalidate one another."}</p>
          <p className="tiny">The cores did not share a variable. They shared a cache line, so the protocol still moved the line.</p>
          <LabChallenge key={tab} objective="Eliminate false-sharing invalidations by placing Core 1’s byte on a different cache line." passed={sharingInvalidations === 0 && secondAddress >= lineBytes} success="The two addresses map to different lines; all eight writes avoid false-sharing invalidations." hint="Move Core 1’s address to at least the cache-line size. Changing bytes within the same line does not help." />
        </Card>
      ) : null}
    </StudioFrame>
  );
}
