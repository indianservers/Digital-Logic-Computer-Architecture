import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button, Card, ExplainBar, Metric, Segmented } from "../../design-system/ui";
import { chipMap, decodeAddress } from "../../engines/memory/addressDecoder";
import { createMemory, decayDram, readWord, refreshDram, writeWord, type MemoryArray, type MemoryKind } from "../../engines/memory/memoryArray";
import { chipFromPins, describeOrganization, expandByAddress, expandByWord, interleavedBank } from "../../engines/memory/organization";
import { ROM_KINDS, readCycle, writeCycle } from "../../engines/memory/timing";
import { StudioFrame } from "../../layout/StudioFrame";
import { usePrefs } from "../../store/prefs";
import { saveRecord } from "../../store/projects";

const TABS = [
  { id: "array", label: "Memory Array" },
  { id: "types", label: "RAM / ROM" },
  { id: "cells", label: "SRAM / DRAM" },
  { id: "org", label: "Organization" },
  { id: "decode", label: "Decoder" },
  { id: "expand", label: "Expansion" },
  { id: "banks", label: "Interleaving" },
  { id: "timing", label: "Timing" },
];

export function MemoryStudio() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "array";
  const [kind, setKind] = useState<MemoryKind>("ram");
  const [memory, setMemory] = useState<MemoryArray>(() => createMemory("ram", 64, 8));
  const [address, setAddress] = useState(0);
  const [data, setData] = useState(0xa5);
  const [ce, setCe] = useState(true);
  const [note, setNote] = useState("Choose an address, then read or write.");
  const [windowStart, setWindowStart] = useState(0);
  const { prefs } = usePrefs();
  const org = describeOrganization(memory.words, memory.width);

  function useKind(next: MemoryKind) {
    setKind(next);
    setMemory(createMemory(next, memory.words, memory.width));
    setNote(next === "rom" ? "ROM is selected. A write will be rejected." : `${next.toUpperCase()} is ready.`);
  }

  return (
    <StudioFrame icon="grid" title="Memory Fundamentals" description="Address a word, watch the decoder, and see which memories accept a write." tabs={TABS} tab={tab} onTab={(id) => setParams({ tab: id })} guide={["Capacity is words times bits per word.", "Chip enable must be high for a cycle to do anything.", "ROM keeps its stored word when a write is attempted."]} takeaways={["Address lines select 2ⁿ locations.", "Word expansion widens the data.", "Address expansion adds words."]}>
      {prefs.explain ? <ExplainBar what={note} why="The address is decoded to one word. Control lines decide whether that word is driven or updated." notice="Only a window of addresses is drawn, so a large map stays responsive." /> : null}
      {tab === "array" ? (
        <div className="grid cards-2">
          <Card title={`${org.label} array`}>
            <div className="row">
              <label>Address<input className="text-input" aria-label="Address" type="number" value={address} onChange={(event) => setAddress(Number(event.target.value))} /></label>
              <label>Data<input className="text-input" aria-label="Data" type="number" value={data} onChange={(event) => setData(Number(event.target.value))} /></label>
              <Button onClick={() => setCe((value) => !value)}>{ce ? "CE on" : "CE off"}</Button>
            </div>
            <div className="row">
              <Button variant="primary" onClick={() => setNote(readWord(memory, address, ce, true).explain)}>Read</Button>
              <Button onClick={() => { const result = writeWord(memory, address, data, ce, true); setMemory(result.memory); setNote(result.access.explain); }}>Write</Button>
              <Button onClick={() => void saveRecord({ id: "memory-lab", kind: "memory", name: "Memory lab", data: JSON.stringify({ kind, address, data }), updated: Date.now() })}>Save</Button>
            </div>
            <input aria-label="Address window" type="range" min={0} max={Math.max(0, memory.words - 16)} value={windowStart} onChange={(event) => setWindowStart(Number(event.target.value))} />
            <div className="mem-grid">
              {memory.cells.slice(windowStart, windowStart + 16).map((cell, offset) => {
                const index = windowStart + offset;
                return <button key={index} className={index === address ? "mem-cell on" : "mem-cell"} onClick={() => setAddress(index)}>{index.toString(16).padStart(2, "0")}<strong>{cell.toString(16).padStart(2, "0")}</strong></button>;
              })}
            </div>
          </Card>
          <Card title="This chip">
            <Metric label="Words" value={String(org.words)} />
            <Metric label="Address lines" value={String(org.addressLines)} />
            <Metric label="Capacity" value={`${org.capacityBits} bits`} />
            <p>{note}</p>
          </Card>
        </div>
      ) : null}
      {tab === "types" ? (
        <div className="grid cards-3">
          <Card title="Try a write">
            <Segmented options={["RAM", "ROM"]} value={kind === "rom" ? "ROM" : "RAM"} onChange={(value) => useKind(value === "ROM" ? "rom" : "ram")} />
            <Button onClick={() => { const result = writeWord(memory, 0, 0x5a, true, true); setMemory(result.memory); setNote(result.access.explain); }}>Write 0x5A at 0</Button>
            <p>Cell 0 is now {memory.cells[0]?.toString(16)}</p>
          </Card>
          {ROM_KINDS.map((item) => (
            <Card key={item.id} title={item.title}>
              <p>{item.program}</p>
              <p className="tiny">Erase: {item.erase}. Grain: {item.grain}. {item.keep}.</p>
              <Button onClick={() => useKind(item.id)}>{kind === item.id ? "Selected" : "Select"}</Button>
            </Card>
          ))}
        </div>
      ) : null}
      {tab === "cells" ? <CellLab memory={memory} setMemory={setMemory} setNote={setNote} /> : null}
      {tab === "org" ? <OrgLab /> : null}
      {tab === "decode" ? <DecoderLab /> : null}
      {tab === "expand" ? <ExpandLab /> : null}
      {tab === "banks" ? <BankLab /> : null}
      {tab === "timing" ? <TimingLab /> : null}
    </StudioFrame>
  );
}

function CellLab({ memory, setMemory, setNote }: { memory: MemoryArray; setMemory: (memory: MemoryArray) => void; setNote: (note: string) => void }) {
  const charge = memory.charge[0] ?? 100;
  return (
    <div className="grid cards-2">
      <Card title="SRAM">
        <p>The cell holds its bit in a stable feedback loop. Nothing has to be refreshed.</p>
        <div className="ff-cell on">1</div>
      </Card>
      <Card title="DRAM abstraction">
        <p>The picture is a charge level, not a transistor model. Decay lowers it. Refresh restores it.</p>
        <div className="charge" style={{ width: `${charge}%` }} />
        <div className="row">
          <Button onClick={() => { setMemory(decayDram({ ...memory, kind: "dram" })); setNote("Charge fell. This is a teaching abstraction of leakage."); }}>Decay</Button>
          <Button onClick={() => { setMemory(refreshDram({ ...memory, kind: "dram" })); setNote("Refresh restored every cell to full charge."); }}>Refresh</Button>
        </div>
      </Card>
    </div>
  );
}

function OrgLab() {
  const [words, setWords] = useState(1024);
  const [width, setWidth] = useState(8);
  const [addr, setAddr] = useState(10);
  const [data, setData] = useState(8);
  const org = describeOrganization(words, width);
  const chip = chipFromPins(addr, data);
  return (
    <div className="grid cards-2">
      <Card title="Organization">
        <label>Words<input className="text-input" type="number" value={words} onChange={(event) => setWords(Number(event.target.value))} /></label>
        <label>Width<input className="text-input" type="number" value={width} onChange={(event) => setWidth(Number(event.target.value))} /></label>
        <p>{org.label}. {org.addressLines} address lines. {org.capacityBits} bits total.</p>
      </Card>
      <Card title="Chip">
        <label>Address pins<input className="text-input" type="number" value={addr} onChange={(event) => setAddr(Number(event.target.value))} /></label>
        <label>Data pins<input className="text-input" type="number" value={data} onChange={(event) => setData(Number(event.target.value))} /></label>
        <svg className="diagram" viewBox="0 0 280 140" role="img" aria-label="Memory chip">
          <rect x="90" y="20" width="120" height="100" rx="12" fill="white" stroke="#2F6FED" />
          <text x="150" y="70" textAnchor="middle" fontWeight="800">{chip.label}</text>
          <text x="78" y="50" textAnchor="end" fontSize="11">A0–A{addr - 1}</text>
          <text x="222" y="50" fontSize="11">D0–D{data - 1}</text>
          <text x="78" y="90" textAnchor="end" fontSize="11">CE OE WE</text>
        </svg>
      </Card>
    </div>
  );
}

function DecoderLab() {
  const [address, setAddress] = useState(100);
  const map = useMemo(() => chipMap(16, 8192, address), [address]);
  const decoded = decodeAddress(address, 4);
  return (
    <Card title="16-bit bus, 8K chips">
      <input aria-label="CPU address" type="range" min={0} max={65535} value={address} onChange={(event) => setAddress(Number(event.target.value))} />
      <p>{map.explain}</p>
      <p>Low 4 bits of a small decoder would light output {decoded.active}.</p>
      <div className="mem-grid">
        {map.chips.map((chip) => <div key={chip.chip} className={chip.selected ? "mem-cell on" : "mem-cell"}>Chip {chip.chip}<strong>{chip.start}–{chip.end}</strong></div>)}
      </div>
    </Card>
  );
}

function ExpandLab() {
  const word = expandByWord([{ words: 1024, width: 4 }, { words: 1024, width: 4 }]);
  const address = expandByAddress([{ words: 1024, width: 8 }, { words: 1024, width: 8 }]);
  return (
    <div className="grid cards-2">
      <Card title="Word expansion"><p>Two 1K × 4 chips share the address and concatenate to {word.label}.</p></Card>
      <Card title="Address expansion"><p>Two 1K × 8 chips, selected by one extra address bit, become {address.label}.</p></Card>
    </div>
  );
}

function BankLab() {
  const [cursor, setCursor] = useState(0);
  return (
    <Card title="Low-order interleaving">
      <Button onClick={() => setCursor((value) => value + 1)}>Next addresses</Button>
      <div className="mem-grid">
        {[0, 1, 2, 3].map((offset) => {
          const address = cursor + offset;
          const placed = interleavedBank(address, 4);
          return <div key={address} className="mem-cell on">Addr {address}<strong>Bank {placed.bank}</strong></div>;
        })}
      </div>
      <p>{interleavedBank(cursor, 4).explain}</p>
    </Card>
  );
}

function TimingLab() {
  const [cycle, setCycle] = useState<"read" | "write">("read");
  const marks = cycle === "read" ? readCycle() : writeCycle();
  return (
    <Card title="Cycle">
      <Segmented options={["Read", "Write"]} value={cycle === "read" ? "Read" : "Write"} onChange={(value) => setCycle(value === "Read" ? "read" : "write")} />
      <ol>{marks.map((mark) => <li key={mark.name}>{mark.name} becomes active at step {mark.at}.</li>)}</ol>
    </Card>
  );
}
