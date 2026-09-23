import { useState } from "react";
import { useStudioTab } from "../../layout/useStudioTab";
import { Button, Card, ExplainBar, Metric } from "../../design-system/ui";
import { directoryRead, directoryWrite, falseShareInvalidations, mesiStep, msiStep, readShared, type DirectoryEntry, type MesiState, type MsiState } from "../../engines/arch/coherence";
import { StudioFrame } from "../../layout/StudioFrame";
import { usePrefs } from "../../store/prefs";

const TABS = [
  { id: "shared", label: "Memory" },
  { id: "mesi", label: "MESI" },
  { id: "msi", label: "MSI" },
  { id: "directory", label: "Directory" },
  { id: "false", label: "False sharing" },
];

export function MulticoreStudio() {
  const [tab, setTab] = useStudioTab(TABS, "mesi");
  const [mesi, setMesi] = useState<MesiState[]>(["I", "I", "I", "I"]);
  const [msi, setMsi] = useState<MsiState[]>(["I", "I"]);
  const [bus, setBus] = useState("idle");
  const [invalidations, setInvalidations] = useState(0);
  const [directory, setDirectory] = useState<DirectoryEntry>({ owner: null, sharers: [] });
  const [core, setCore] = useState(0);
  const { prefs } = usePrefs();
  const shared = readShared("shared", 0, 0, [40], [[1], [2], [3], [4]]);
  const local = readShared("distributed", core, 0, [40], [[1], [2], [3], [4]]);
  const sameLine = falseShareInvalidations(4, [{ core: 0, address: 0 }, { core: 1, address: 1 }]);
  const splitLine = falseShareInvalidations(4, [{ core: 0, address: 0 }, { core: 1, address: 16 }]);

  function onMesi(op: "read" | "write") {
    const stepped = mesiStep(mesi, core, op);
    setMesi(stepped.states);
    setBus(stepped.bus);
    setInvalidations((count) => count + stepped.invalidations);
  }

  return (
    <StudioFrame icon="table" title="Multicore & Coherence" description="Each core can hold a copy. A write must make the other copies invalid or shared before the new value is the one later reads see." tabs={TABS} tab={tab} onTab={setTab} guide={["A private read of an invalid line becomes Exclusive when nobody else has it.", "A read of a Modified line forces a write-back and both copies become Shared.", "Writes to different bytes of one line still invalidate the other core."]} takeaways={["MSI has no Exclusive state, so a first read becomes Shared.", "The directory records the owner or the sharers.", "Separate lines do not create that invalidation."]}>
      {prefs.explain ? <ExplainBar what={`Core ${core} sees bus message ${bus}.`} why="Snooping means every cache watches that message and updates its own line state." notice="This is one line and four cores, not a full memory-consistency proof." /> : null}
      <div className="row">
        {[0, 1, 2, 3].map((index) => <Button key={index} onClick={() => setCore(index)}>Core {index}</Button>)}
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
          <Button onClick={() => { setMesi(["I", "I", "I", "I"]); setBus("idle"); setInvalidations(0); }}>Reset</Button>
          <Metric label="Invalidations" value={String(invalidations)} />
        </Card>
      ) : null}
      {tab === "msi" ? (
        <Card title="Modified, shared, invalid">
          <p>Core 0 {msi[0]} · Core 1 {msi[1]} · {bus}</p>
          <Button onClick={() => { const stepped = msiStep(msi, core > 1 ? 0 : core, "read"); setMsi(stepped.states); setBus(stepped.bus); }}>Read</Button>
          <Button onClick={() => { const stepped = msiStep(msi, core > 1 ? 0 : core, "write"); setMsi(stepped.states); setBus(stepped.bus); }}>Write</Button>
        </Card>
      ) : null}
      {tab === "directory" ? (
        <Card title="Who has the line?">
          <p>Owner {directory.owner ?? "none"} · sharers {directory.sharers.join(", ") || "none"}</p>
          <Button onClick={() => setDirectory(directoryRead(directory, core))}>Read</Button>
          <Button onClick={() => { const stepped = directoryWrite(directory, core); setDirectory(stepped.entry); setInvalidations(stepped.invalidated); }}>Write</Button>
          <p>Last write invalidated {invalidations} other copies.</p>
        </Card>
      ) : null}
      {tab === "false" ? (
        <Card title="Same line, different bytes">
          <p>Addresses 0 and 1, 4-byte line: {sameLine} invalidation.</p>
          <p>Addresses 0 and 16: {splitLine} invalidations.</p>
          <p className="tiny">The cores did not share a variable. They shared a cache line, so the protocol still moved the line.</p>
        </Card>
      ) : null}
    </StudioFrame>
  );
}
