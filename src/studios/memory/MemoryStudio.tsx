import { useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { Button, Card, ExplainBar, Metric, Segmented, Toggle } from "../../design-system/ui";
import { decoder } from "../../engines/digital/routing";
import { fromUnsigned, toBinary, toHex, toUnsigned } from "../../engines/digital/vector";
import { chipMap, decodeAddress, splitAddress } from "../../engines/memory/addressDecoder";
import { createMemory, decayDram, eraseEprom, readWord, refreshDram, writeWord, type MemoryArray, type MemoryKind } from "../../engines/memory/memoryArray";
import { chipFromPins, describeOrganization, expandByAddress, expandByWord, highOrderBank, interleavedBank } from "../../engines/memory/organization";
import { ROM_KINDS, readCycle, writeCycle, type TimingMark } from "../../engines/memory/timing";
import { StudioFrame } from "../../layout/StudioFrame";
import { usePrefs } from "../../store/prefs";
import { saveRecord } from "../../store/projects";
import type { LogicBit, LogicVector } from "../../types/logic";
import { Waveform, WordEditor } from "../shared/widgets";

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

const LESSONS: Record<string, { guide: string[]; takeaways: string[]; what: string; why: string; notice: string }> = {
  array: {
    guide: ["Pick a size, then toggle address bits or click a cell.", "Read needs CE and OE high. Write needs CE and WE high.", "Watch the selected word in binary, hex, and decimal.", "Turn CE off and try again — the array stays idle."],
    takeaways: ["Capacity = words × bits per word. Address lines = n for 2ⁿ locations.", "CE gates the chip. OE drives the bus. WE updates the cell.", "Only one word is selected at a time."],
    what: "An address names one word in the array. Control pins decide whether that word is driven or stored.",
    why: "Without CE/OE/WE the same cells would fight the bus or change on every address tick.",
    notice: "A 16-cell window is drawn so a larger map stays readable.",
  },
  types: {
    guide: ["Write 0x5A into RAM — the cell updates.", "Select ROM and write again — the word is rejected.", "Program PROM twice to see the second write refused.", "Program EPROM, then UV-erase the chip and program it again."],
    takeaways: ["RAM is read/write. Mask ROM is factory data.", "PROM is one-shot. EPROM erases with UV (whole chip).", "EEPROM erases a byte. Flash erases a block."],
    what: "Volatility and erase grain decide whether a write sticks.",
    why: "Firmware, look-up tables, and working storage are different jobs.",
    notice: "These are teaching models of the write/erase rules, not silicon timing.",
  },
  cells: {
    guide: ["Flip the SRAM bit — it stays until you flip it again.", "Select a DRAM cell, press Decay, then Refresh.", "When charge is low, a teaching read is marked unreliable.", "Compare 6T feedback with a 1T capacitor."],
    takeaways: ["SRAM stores a bit in a cross-coupled loop. No refresh.", "DRAM stores charge on a capacitor. Leakage forces refresh.", "The bars are an abstraction, not a SPICE model."],
    what: "The same addressable array can be built from SRAM or DRAM cells.",
    why: "Density versus speed: DRAM packs more bits; SRAM holds them without a refresh timer.",
    notice: "This lab has its own DRAM array so it does not overwrite the RAM array tab.",
  },
  org: {
    guide: ["Change words and width — capacity and address pins update.", "Click a cell in the matrix: row bits are RAS, column bits are CAS.", "Toggle CE, OE, and WE on the chip drawing.", "Match pin counts to the formula 2ⁿ × m."],
    takeaways: ["An n × m chip has n address pins and m data pins.", "Large arrays are 2-D: row then column.", "CE/OE/WE are the three control pins on a typical RAM."],
    what: "Organization is how words and bits are arranged on the pins.",
    why: "The CPU sees a linear address; the chip internally uses a row and a column.",
    notice: "The matrix shows at most 8×8 of the array so the grid stays interactive.",
  },
  decode: {
    guide: ["Toggle the n-bit select. Exactly one word line Yk goes high.", "Turn Enable off — every output drops to 0.", "Flip CPU address bits. Orange bits pick the chip; blue bits are the offset.", "Watch the 3-to-8 chip decoder and the 8K map light the same chip."],
    takeaways: ["An n-to-2ⁿ decoder is one-hot: one Y line per address.", "High-order bits are chip select. Low-order bits are the offset inside the chip.", "Enable (often CE) blanks every output when the chip is idle."],
    what: "The decoder turns a binary address into one word line, and high bits into one chip-select.",
    why: "A CPU address bus is shared. Only the matching chip and matching word may respond.",
    notice: "16-bit CPU space with 8K×8 chips needs 3 select bits and 13 offset bits.",
  },
  expand: {
    guide: ["Raise the number of nibble chips — the data bus gets wider.", "Raise the number of address chips — the space gets deeper.", "Move the probe address and see which chip’s CS is high.", "Compare shared address (word) with extra CS bits (address)."],
    takeaways: ["Word expansion concatenates data pins. Address is shared.", "Address expansion uses extra high bits as chip selects.", "Both are how you build 64K from 8K parts."],
    what: "Systems are built from several smaller chips, not one giant die.",
    why: "Available parts have a fixed width and depth. Wiring them together makes the CPU’s memory map.",
    notice: "Each teaching chip is 1K words. Counts of 2 or 4 keep the map countable by hand.",
  },
  banks: {
    guide: ["Step a burst of consecutive addresses in low-order mode.", "Switch to high-order and step again — they stay in one bank.", "Read bank, offset, and the address bits that chose the bank.", "Think about why a cache line prefers low-order interleaving."],
    takeaways: ["Low-order interleaving spreads sequential addresses across banks.", "High-order keeps a contiguous region in one bank.", "Independent banks can start overlapping accesses."],
    what: "Interleaving is how consecutive addresses are assigned to parallel memories.",
    why: "A burst wants every next word in a different bank so requests can overlap.",
    notice: "This 16-word map makes the two policies visible without a DRAM datasheet.",
  },
  timing: {
    guide: ["Choose Read or Write and step the cursor along the waveform.", "Match Address → CE → OE/WE → data.", "On the live chip, drop OE and try a read — the bus stays off.", "Drop WE and try a write — the cell does not change."],
    takeaways: ["Address must be valid before CE.", "Read uses OE. Write uses WE. They are not the same pin.", "Setup and hold are why the waveform is ordered."],
    what: "A memory cycle is a sequence of control edges, not a single assignment.",
    why: "The array needs time to decode, drive, or store. The waveform is that contract.",
    notice: "Step times are educational units, not nanoseconds from a datasheet.",
  },
};

export function MemoryStudio() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "array";
  const [resetKey, setResetKey] = useState(0);
  const { prefs } = usePrefs();
  const lesson = LESSONS[tab] ?? LESSONS.array!;
  return (
    <StudioFrame
      icon="grid"
      title="Memory Fundamentals"
      description="Address a word, split the bus, and watch the decoder pick one chip and one line."
      tabs={TABS}
      tab={tab}
      onTab={(id) => setParams({ tab: id })}
      onReset={() => setResetKey((n) => n + 1)}
      guide={lesson.guide}
      takeaways={lesson.takeaways}
    >
      <div key={`${tab}-${resetKey}`}>
        {prefs.explain ? <ExplainBar what={lesson.what} why={lesson.why} notice={lesson.notice} /> : null}
        {tab === "array" ? <ArrayLab /> : null}
        {tab === "types" ? <TypesLab /> : null}
        {tab === "cells" ? <CellLab /> : null}
        {tab === "org" ? <OrgLab /> : null}
        {tab === "decode" ? <DecoderLab /> : null}
        {tab === "expand" ? <ExpandLab /> : null}
        {tab === "banks" ? <BankLab /> : null}
        {tab === "timing" ? <TimingLab /> : null}
      </div>
    </StudioFrame>
  );
}

function Theory({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="callout" style={{ marginBottom: 12 }}>
      <strong>{title}</strong>
      <p className="muted" style={{ margin: 0 }}>{children}</p>
    </div>
  );
}

function asBits(vector: LogicVector): Array<0 | 1> {
  return vector.map((bit) => (bit === 1 ? 1 : 0));
}

function fitBits(bits: Array<0 | 1>, width: number): Array<0 | 1> {
  const next = bits.slice(-width);
  while (next.length < width) next.unshift(0);
  return next;
}

function tracesFromMarks(marks: TimingMark[], length = 5): Array<{ id: string; name: string; values: LogicBit[]; active?: boolean }> {
  return marks.map((mark) => ({
    id: mark.name,
    name: mark.name,
    values: Array.from({ length }, (_, step) => (step >= mark.at ? mark.level : 0)),
  }));
}

function ArrayLab() {
  const [size, setSize] = useState(64);
  const [memory, setMemory] = useState<MemoryArray>(() => createMemory("ram", 64, 8));
  const [address, setAddress] = useState(0);
  const [data, setData] = useState(0xa5);
  const [ce, setCe] = useState(true);
  const [oe, setOe] = useState(true);
  const [we, setWe] = useState(true);
  const [note, setNote] = useState("Choose an address, then read or write.");
  const [windowStart, setWindowStart] = useState(0);
  const org = describeOrganization(memory.words, memory.width);
  const bits = asBits(fromUnsigned(address & (memory.words - 1), org.addressLines));
  const selected = memory.cells[address] ?? 0;
  const selectedBits = asBits(fromUnsigned(selected, memory.width));

  function resize(words: number) {
    setSize(words);
    setMemory(createMemory("ram", words, 8));
    setAddress(0);
    setWindowStart(0);
    setNote(`Array rebuilt as ${words} × 8.`);
  }

  return (
    <div className="grid cards-2">
      <Card title={`${org.label} RAM`}>
        <Theory title="Addressed array">A binary address of n bits names one of 2ⁿ words. Chip enable (CE) must be high or the chip ignores the bus. Output enable (OE) drives a read. Write enable (WE) stores a write.</Theory>
        <Segmented options={["16", "64", "256"]} value={String(size)} onChange={(value) => resize(Number(value))} />
        <p className="tiny">Address bits A{org.addressLines - 1}…A0</p>
        <WordEditor bits={bits} labels={bits.map((_, index) => `A${org.addressLines - 1 - index}`)} onChange={(next) => setAddress(toUnsigned(next) ?? 0)} />
        <div className="row">
          <span className="row"><span className="tiny">CE</span><Toggle on={ce} onChange={setCe} label="Chip enable" /></span>
          <span className="row"><span className="tiny">OE</span><Toggle on={oe} onChange={setOe} label="Output enable" /></span>
          <span className="row"><span className="tiny">WE</span><Toggle on={we} onChange={setWe} label="Write enable" /></span>
        </div>
        <div className="row">
          <label>Data word<input className="text-input" aria-label="Data word" type="number" min={0} max={255} value={data} onChange={(event) => setData(Number(event.target.value))} /></label>
          <Button variant="primary" onClick={() => setNote(readWord(memory, address, ce, oe).explain)}>Read</Button>
          <Button onClick={() => { const result = writeWord(memory, address, data, ce, we); setMemory(result.memory); setNote(result.access.explain); }}>Write</Button>
          <Button onClick={() => void saveRecord({ id: "memory-lab", kind: "memory", name: "Memory lab", data: JSON.stringify({ address, data, words: memory.words }), updated: Date.now() })}>Save</Button>
        </div>
        <input aria-label="Address window" type="range" min={0} max={Math.max(0, memory.words - 16)} value={windowStart} onChange={(event) => setWindowStart(Number(event.target.value))} />
        <div className="mem-grid">
          {memory.cells.slice(windowStart, windowStart + 16).map((cell, offset) => {
            const index = windowStart + offset;
            return (
              <button key={index} className={index === address ? "mem-cell on" : "mem-cell"} onClick={() => setAddress(index)}>
                {index.toString(16).padStart(2, "0")}
                <strong>{cell.toString(16).padStart(2, "0")}</strong>
              </button>
            );
          })}
        </div>
        <p>{note}</p>
      </Card>
      <Card title="Selected word">
        <div className="row">
          <Metric label="Address" value={`${address} · ${toBinary(bits)}`} />
          <Metric label="Capacity" value={`${org.capacityBits} bits`} />
        </div>
        <div className="row">
          <Metric label="Address lines" value={String(org.addressLines)} />
          <Metric label="Formula" value={`2^${org.addressLines} × ${org.width}`} />
        </div>
        <p className="tiny">Stored word at {address}</p>
        <div className="bits">
          {selectedBits.map((bit, index) => (
            <span key={index} className={bit ? "bit on" : "bit"}>{bit}<small>{memory.width - 1 - index}</small></span>
          ))}
        </div>
        <p className="expr">{toBinary(selectedBits)} · {toHex(selectedBits)} · {selected}</p>
        <p className="muted">{ce ? (oe ? "OE high: a read can drive the bus." : "OE low: data pins stay off.") : "CE low: the whole chip is idle."}</p>
      </Card>
    </div>
  );
}

function TypesLab() {
  const [kind, setKind] = useState<MemoryKind>("ram");
  const [memory, setMemory] = useState<MemoryArray>(() => createMemory("ram", 8, 8, 0x11));
  const [note, setNote] = useState("RAM accepts a write. ROM, PROM, and EPROM each refuse in a different way.");

  function useKind(next: MemoryKind) {
    setKind(next);
    setMemory(createMemory(next, 8, 8, next === "rom" ? 0x3c : 0xff));
    setNote(next === "rom" ? "Mask ROM is factory data. A write will be rejected." : `${next.toUpperCase()} is ready at address 0.`);
  }

  function program(value: number) {
    const result = writeWord(memory, 0, value, true, true);
    setMemory(result.memory);
    setNote(result.access.explain);
  }

  const cell = memory.cells[0] ?? 0;
  const selectedKind = ROM_KINDS.find((item) => item.id === kind);

  return (
    <>
      <Theory title="RAM versus ROM">RAM is read/write working store. ROM kinds keep data without power. They differ by who programs them and how (or whether) they erase.</Theory>
      <div className="grid cards-3">
        <Card title="Try a write at address 0">
          <p className="tiny">Kind in use: {kind.toUpperCase()}</p>
          <p className="expr">{cell.toString(16).padStart(2, "0").toUpperCase()}<small style={{ display: "block", fontSize: 12 }}>cell 0 · {cell.toString(2).padStart(8, "0")}</small></p>
          <div className="row">
            <Button variant="primary" onClick={() => program(0x5a)}>Write 0x5A</Button>
            <Button onClick={() => program(0xa5)}>Write 0xA5</Button>
          </div>
          {kind === "eprom" ? <Button onClick={() => { setMemory(eraseEprom(memory)); setNote("UV erase cleared every cell to 0xFF. The chip can be programmed again."); }}>UV erase chip</Button> : null}
          <p>{note}</p>
          <p className="tiny">Programmed flag at 0: {memory.programmed[0] ? "yes" : "no"}.</p>
        </Card>
        <Card title="RAM" action={kind === "ram" ? "Selected" : undefined}>
          <p>Read/write working store. A write updates the cell immediately.</p>
          <p className="tiny">Erase: not applicable. Grain: byte. Volatile in real SRAM/DRAM; this lab keeps cells so you can inspect them.</p>
          <Button onClick={() => useKind("ram")}>{kind === "ram" ? "In use" : "Select"}</Button>
        </Card>
        {ROM_KINDS.map((item) => (
          <Card key={item.id} title={item.title} action={kind === item.id ? "Selected" : undefined}>
            <p>{item.program}</p>
            <p className="tiny">Erase: {item.erase}. Grain: {item.grain}. {item.keep}.</p>
            <Button onClick={() => useKind(item.id)}>{kind === item.id ? "In use" : "Select"}</Button>
          </Card>
        ))}
      </div>
      {selectedKind ? <p className="muted">{selectedKind.title}: {selectedKind.program} {selectedKind.erase}.</p> : <p className="muted">RAM: volatile read/write. Contents vanish without power in real SRAM/DRAM; this lab keeps cells so you can inspect them.</p>}
    </>
  );
}

function CellLab() {
  const [sram, setSram] = useState<0 | 1>(1);
  const [dram, setDram] = useState<MemoryArray>(() => createMemory("dram", 8, 1, 1));
  const [index, setIndex] = useState(0);
  const charge = dram.charge[index] ?? 0;
  const stored = dram.cells[index] ?? 0;
  const weak = charge < 40;

  function writeBit(bit: 0 | 1) {
    const result = writeWord(dram, index, bit, true, true);
    setDram(result.memory);
  }

  return (
    <>
      <Theory title="Two cell stories">SRAM holds a bit with two inverters in a loop (6 transistors in CMOS). DRAM holds charge on a capacitor behind one access transistor. Charge leaks, so DRAM must refresh.</Theory>
      <div className="grid cards-2">
        <Card title="6T SRAM (teaching)">
          <p className="muted">Cross-coupled inverters. Click Q to flip. Nothing decays.</p>
          <div className="sram-loop">
            <button className={sram ? "ff-cell on" : "ff-cell"} onClick={() => setSram(sram ? 0 : 1)} aria-label="SRAM Q">
              Q {sram}
              <small>true</small>
            </button>
            <span className="tiny">⇄</span>
            <div className={sram ? "ff-cell" : "ff-cell on"} aria-hidden>
              Q̅ {sram ? 0 : 1}
              <small>complement</small>
            </div>
          </div>
          <p>Stored bit is {sram}. No refresh pin exists on SRAM.</p>
        </Card>
        <Card title="1T1C DRAM (teaching)">
          <p className="muted">Pick a cell. Decay lowers every capacitor. Refresh restores charge.</p>
          <div className="mem-grid">
            {dram.cells.map((cell, slot) => (
              <button key={slot} className={slot === index ? "mem-cell on" : "mem-cell"} onClick={() => setIndex(slot)}>
                C{slot}
                <strong>{cell}</strong>
                <span className="tiny">{dram.charge[slot] ?? 0}%</span>
              </button>
            ))}
          </div>
          <div className={weak ? "charge low" : "charge"} style={{ width: `${charge}%` }} />
          <div className="row">
            <Button onClick={() => writeBit(1)}>Store 1</Button>
            <Button onClick={() => writeBit(0)}>Store 0</Button>
            <Button onClick={() => setDram(decayDram(dram))}>Decay</Button>
            <Button variant="primary" onClick={() => setDram(refreshDram(dram))}>Refresh</Button>
          </div>
          <p>{weak ? `Cell ${index} charge ${charge}% — a teaching read of ${stored} would be unreliable.` : `Cell ${index} holds ${stored} at ${charge}% charge.`}</p>
        </Card>
      </div>
    </>
  );
}

function OrgLab() {
  const [words, setWords] = useState(16);
  const [width, setWidth] = useState(8);
  const [addrPins, setAddrPins] = useState(10);
  const [dataPins, setDataPins] = useState(8);
  const [address, setAddress] = useState(0);
  const [ce, setCe] = useState(true);
  const [oe, setOe] = useState(true);
  const [we, setWe] = useState(false);
  const org = describeOrganization(Math.max(1, words), Math.max(1, width));
  const chip = chipFromPins(Math.max(1, addrPins), Math.max(1, dataPins));
  const visBits = Math.min(6, org.addressLines);
  const visWords = 2 ** visBits;
  const visAddr = address & (visWords - 1);
  const rowBits = Math.ceil(visBits / 2);
  const colBits = visBits - rowBits;
  const rows = 2 ** rowBits;
  const cols = 2 ** Math.max(0, colBits);
  const row = visAddr >> colBits;
  const col = visAddr & (cols - 1);
  const split = splitAddress(visAddr, visBits, colBits);

  return (
    <>
      <Theory title="n × m and a 2-D array">{org.label} needs {org.addressLines} address pins and {org.width} data pins. Internally the address is split: high bits pick a row (RAS), low bits pick a column (CAS).</Theory>
      <div className="grid cards-2">
        <Card title="Organization">
          <label>Words<input className="text-input" aria-label="Words" type="number" min={1} max={65536} value={words} onChange={(event) => setWords(Number(event.target.value))} /></label>
          <label>Width<input className="text-input" aria-label="Width" type="number" min={1} max={32} value={width} onChange={(event) => setWidth(Number(event.target.value))} /></label>
          <div className="row">
            <Metric label="Label" value={org.label} />
            <Metric label="Address lines" value={String(org.addressLines)} />
            <Metric label="Capacity" value={`${org.capacityBits} bits`} />
          </div>
          <p className="tiny">Showing a {rows}×{cols} window. Click a cell.</p>
          <div className="mem-grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
            {Array.from({ length: visWords }, (_, index) => {
              const r = index >> colBits;
              const c = index & (cols - 1);
              return (
                <button key={index} className={index === visAddr ? "mem-cell on" : "mem-cell"} onClick={() => setAddress(index)}>
                  r{r}c{c}
                  <strong>{index}</strong>
                </button>
              );
            })}
          </div>
          <p>Row {row} (RAS = {split.selectBits}) · column {col} (CAS = {split.offsetBits}). High address bits pick the row; low bits pick the column.</p>
        </Card>
        <Card title="Chip pins">
          <label>Address pins<input className="text-input" aria-label="Address pins" type="number" min={1} max={16} value={addrPins} onChange={(event) => setAddrPins(Number(event.target.value))} /></label>
          <label>Data pins<input className="text-input" aria-label="Data pins" type="number" min={1} max={32} value={dataPins} onChange={(event) => setDataPins(Number(event.target.value))} /></label>
          <div className="row">
            <span className="row"><span className="tiny">CE</span><Toggle on={ce} onChange={setCe} label="CE" /></span>
            <span className="row"><span className="tiny">OE</span><Toggle on={oe} onChange={setOe} label="OE" /></span>
            <span className="row"><span className="tiny">WE</span><Toggle on={we} onChange={setWe} label="WE" /></span>
          </div>
          <svg className="diagram" viewBox="0 0 280 160" role="img" aria-label="Memory chip">
            <rect x="90" y="24" width="120" height="112" rx="12" fill="white" stroke="#2F6FED" />
            <text x="150" y="78" textAnchor="middle" fontWeight="800">{chip.label}</text>
            <text x="150" y="98" textAnchor="middle" fontSize="11" fill="#667085">{chip.words} words</text>
            <text x="78" y="54" textAnchor="end" fontSize="11">A0–A{Math.max(0, addrPins - 1)}</text>
            <text x="222" y="54" fontSize="11">D0–D{Math.max(0, dataPins - 1)}</text>
            <text x="78" y="84" textAnchor="end" fontSize="11" fill={ce ? "#2F6FED" : "#98a2b3"} fontWeight={ce ? 800 : 600}>CE {ce ? "1" : "0"}</text>
            <text x="78" y="104" textAnchor="end" fontSize="11" fill={oe ? "#2F6FED" : "#98a2b3"} fontWeight={oe ? 800 : 600}>OE {oe ? "1" : "0"}</text>
            <text x="78" y="124" textAnchor="end" fontSize="11" fill={we ? "#2F6FED" : "#98a2b3"} fontWeight={we ? 800 : 600}>WE {we ? "1" : "0"}</text>
          </svg>
          <p className="tiny">{chip.spec.controls.join(" · ")} · {ce ? "chip selected" : "chip idle"}{we ? " · write armed" : oe ? " · output armed" : ""}.</p>
        </Card>
      </div>
    </>
  );
}

function DecoderLab() {
  const [width, setWidth] = useState(3);
  const [select, setSelect] = useState<Array<0 | 1>>([0, 1, 0]);
  const [enable, setEnable] = useState(true);
  const [cpuAddr, setCpuAddr] = useState(9000);
  const bits = fitBits(select, width);
  const outs = decoder(bits, enable ? 1 : 0);
  const active = outs.findIndex((bit) => bit === 1);
  const map = useMemo(() => chipMap(16, 8192, cpuAddr), [cpuAddr]);
  const fields = splitAddress(cpuAddr, 16, 13);
  const cpuBits = asBits(fromUnsigned(cpuAddr, 16));
  const chipLines = decoder(fromUnsigned(fields.select, 3), 1);
  const tiny = decodeAddress(toUnsigned(bits) ?? 0, width);

  return (
    <>
      <Theory title="n-to-2ⁿ decoder">Binary select bits become one-hot word lines. Memory uses the same idea twice: a small decoder inside the chip picks a word, and high-order CPU bits pick which chip’s CE goes high.</Theory>
      <div className="grid cards-2">
        <Card title="Word-line decoder" action={<Segmented options={["2", "3", "4"]} value={String(width)} onChange={(value) => { const next = Number(value); setWidth(next); setSelect(fitBits(select, next)); }} />}>
          <p className="tiny">{width}-to-{2 ** width}. Toggle select bits. Enable is the decoder’s CE.</p>
          <WordEditor bits={bits} labels={bits.map((_, index) => `A${width - 1 - index}`)} onChange={setSelect} />
          <div className="row">
            <span className="row"><span className="tiny">Enable</span><Toggle on={enable} onChange={setEnable} label="Decoder enable" /></span>
            <Metric label="Active line" value={enable && active >= 0 ? `Y${active}` : "none"} />
            <Metric label="Select" value={`${toUnsigned(bits) ?? 0} · ${toBinary(bits)}`} />
          </div>
          <div className="word-lines">
            {outs.map((bit, index) => (
              <div key={index} className={bit === 1 ? "word-line on" : "word-line"}>Y{index}<strong style={{ display: "block" }}>{bit === 1 ? 1 : bit === 0 ? 0 : "X"}</strong></div>
            ))}
          </div>
          <p className="muted">{enable ? tiny.explain : "Enable is low, so every word line is 0. The array is idle."}</p>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>A</th>
                  {outs.map((_, index) => <th key={index}>Y{index}</th>)}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 2 ** width }, (_, row) => {
                  const rowBits = asBits(fromUnsigned(row, width));
                  const rowOut = decoder(rowBits, enable ? 1 : 0);
                  return (
                    <tr key={row} className={row === (toUnsigned(bits) ?? -1) ? "active" : undefined}>
                      <td className="mono">{toBinary(rowBits)}</td>
                      {rowOut.map((bit, index) => <td key={index} className={bit === 1 ? "one" : undefined}>{bit === 1 ? 1 : 0}</td>)}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="16-bit CPU · 8K chips">
          <p className="tiny">8K = 2¹³ locations, so A12…A0 are the offset. A15…A13 select one of eight chips.</p>
          <WordEditor
            bits={cpuBits}
            labels={cpuBits.map((_, index) => `A${15 - index}`)}
            onChange={(next) => setCpuAddr(toUnsigned(next) ?? 0)}
          />
          <div className="split-legend"><span className="cs">A15–A13 chip select</span><span className="off">A12–A0 offset</span></div>
          <div className="bit-fields">
            <div className="bit-field cs"><small>CS</small><strong className="mono">{fields.selectBits}</strong><span className="tiny">chip {fields.select}</span></div>
            <div className="bit-field off"><small>Offset</small><strong className="mono">{fields.offsetBits}</strong><span className="tiny">{fields.offset}</span></div>
            <div className="bit-field"><small>CPU address</small><strong>{cpuAddr}</strong><span className="tiny">{fields.binary}</span></div>
          </div>
          <input aria-label="CPU address" type="range" min={0} max={65535} value={cpuAddr} onChange={(event) => setCpuAddr(Number(event.target.value))} />
          <p className="tiny">3-to-8 chip decoder from A15–A13</p>
          <div className="word-lines">
            {chipLines.map((bit, index) => (
              <div key={index} className={bit === 1 ? "word-line on" : "word-line"}>CS{index}<strong style={{ display: "block" }}>{bit === 1 ? 1 : 0}</strong></div>
            ))}
          </div>
          <div className="mem-grid">
            {map.chips.map((chip) => (
              <div key={chip.chip} className={chip.selected ? "mem-cell on" : "mem-cell"}>
                Chip {chip.chip}
                <strong>{chip.start}–{chip.end}</strong>
                <span className="tiny">{chip.selected ? "CE = 1" : "CE = 0"}</span>
              </div>
            ))}
          </div>
          <p>{fields.explain}</p>
          <p className="muted">{map.explain}</p>
        </Card>
      </div>
    </>
  );
}

function ExpandLab() {
  const [nibbleChips, setNibbleChips] = useState(2);
  const [nibbleWidth, setNibbleWidth] = useState(4);
  const [addrChips, setAddrChips] = useState(2);
  const [probe, setProbe] = useState(0);
  const wordChips = Array.from({ length: nibbleChips }, () => ({ words: 1024, width: nibbleWidth }));
  const depthChips = Array.from({ length: addrChips }, () => ({ words: 1024, width: 8 }));
  const word = expandByWord(wordChips);
  const depth = expandByAddress(depthChips);
  const cs = Math.min(addrChips - 1, Math.floor(probe / 1024));
  const offset = probe % 1024;
  const csBits = Math.max(1, Math.ceil(Math.log2(addrChips)));
  const split = splitAddress(probe, 10 + csBits, 10);

  return (
    <>
      <Theory title="Building a wider or deeper map">Word expansion shares the address and concatenates data pins. Address expansion shares the data bus and decodes extra high bits into chip-selects.</Theory>
      <div className="grid cards-2">
        <Card title="Word expansion">
          <Segmented options={["2 chips", "4 chips"]} value={`${nibbleChips} chips`} onChange={(value) => setNibbleChips(value.startsWith("4") ? 4 : 2)} />
          <Segmented options={["4-bit", "8-bit"]} value={`${nibbleWidth}-bit`} onChange={(value) => setNibbleWidth(value.startsWith("8") ? 8 : 4)} />
          <p className="expr">{word.label}</p>
          <p>{nibbleChips} chips of 1K × {nibbleWidth} share A9…A0. Data concatenates to {word.width} bits. Capacity {word.capacityBits} bits.</p>
          <div className="mem-grid">
            {wordChips.map((_, index) => (
              <div key={index} className="mem-cell on">
                Chip {index}
                <strong>D{index * nibbleWidth}–D{index * nibbleWidth + nibbleWidth - 1}</strong>
                <span className="tiny">same address, CE shared</span>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Address expansion">
          <Segmented options={["2 chips", "4 chips"]} value={`${addrChips} chips`} onChange={(value) => setAddrChips(value.startsWith("4") ? 4 : 2)} />
          <p className="expr">{depth.label}</p>
          <p>{addrChips} chips of 1K × 8. Extra {csBits} high bit{csBits === 1 ? "" : "s"} {csBits === 1 ? "becomes" : "become"} CS. Probe address {probe} → chip {cs}, offset {offset}.</p>
          <input aria-label="Probe address" type="range" min={0} max={addrChips * 1024 - 1} value={probe} onChange={(event) => setProbe(Number(event.target.value))} />
          <WordEditor
            bits={asBits(fromUnsigned(probe, 10 + csBits))}
            labels={asBits(fromUnsigned(probe, 10 + csBits)).map((_, index) => `A${9 + csBits - index}`)}
            onChange={(next) => setProbe(toUnsigned(next) ?? 0)}
          />
          <p className="tiny">{split.explain}</p>
          <div className="mem-grid">
            {depthChips.map((_, index) => (
              <div key={index} className={index === cs ? "mem-cell on" : "mem-cell"}>
                Chip {index}
                <strong>{index * 1024}–{index * 1024 + 1023}</strong>
                <span className="tiny">{index === cs ? "CS = 1" : "CS = 0"}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}

function BankLab() {
  const [cursor, setCursor] = useState(0);
  const [mode, setMode] = useState<"low" | "high">("low");
  const space = 16;
  const banks = 4;
  const burst = [0, 1, 2, 3].map((offset) => {
    const address = (cursor + offset) % space;
    const placed = mode === "low" ? interleavedBank(address, banks) : highOrderBank(address, banks, space);
    return { address, ...placed };
  });
  const current = burst[0] ?? { address: 0, bank: 0, offset: 0, explain: "" };

  return (
    <>
      <Theory title="Why banks exist">Independent arrays can start overlapping accesses. Low-order interleaving puts address 0,1,2,3 in banks 0,1,2,3. High-order puts a whole region in one bank — simpler maps, worse bursts.</Theory>
      <Card title="Four banks · 16-word map">
        <Segmented options={["Low-order", "High-order"]} value={mode === "low" ? "Low-order" : "High-order"} onChange={(value) => setMode(value === "High-order" ? "high" : "low")} />
        <div className="row">
          <Button variant="primary" onClick={() => setCursor((value) => (value + 1) % space)}>Next address</Button>
          <Button onClick={() => setCursor(0)}>Reset burst</Button>
          <Metric label="Bank" value={String(current.bank)} />
          <Metric label="Offset" value={String(current.offset)} />
        </div>
        <div className="mem-grid">
          {burst.map((item) => (
            <div key={item.address} className="mem-cell on">
              Addr {item.address}
              <strong>Bank {item.bank}</strong>
              <span className="tiny">offset {item.offset}</span>
            </div>
          ))}
        </div>
        <p>{current.explain}</p>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr><th>Address</th><th>Binary</th><th>Bank</th><th>Offset</th></tr>
            </thead>
            <tbody>
              {Array.from({ length: space }, (_, address) => {
                const placed = mode === "low" ? interleavedBank(address, banks) : highOrderBank(address, banks, space);
                return (
                  <tr key={address} className={address === current.address ? "active" : undefined}>
                    <td>{address}</td>
                    <td className="mono">{address.toString(2).padStart(4, "0")}</td>
                    <td>{placed.bank}</td>
                    <td>{placed.offset}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

function TimingLab() {
  const [cycle, setCycle] = useState<"read" | "write">("read");
  const [cursor, setCursor] = useState(0);
  const [memory, setMemory] = useState<MemoryArray>(() => createMemory("ram", 8, 8, 0x3c));
  const [ce, setCe] = useState(true);
  const [oe, setOe] = useState(true);
  const [we, setWe] = useState(false);
  const [note, setNote] = useState("Address first, then CE, then OE or WE.");
  const marks = cycle === "read" ? readCycle() : writeCycle();
  const traces = tracesFromMarks(marks).map((trace) => ({ ...trace, active: (trace.values[cursor] ?? 0) === 1 }));
  const current = marks.filter((mark) => mark.at <= cursor).map((mark) => mark.name);

  function runRead() {
    const access = readWord(memory, 0, ce, oe);
    setNote(access.explain);
  }

  function runWrite() {
    const result = writeWord(memory, 0, 0xa5, ce, we);
    setMemory(result.memory);
    setNote(result.access.explain);
  }

  return (
    <>
      <Theory title="A cycle is ordered">Address settles, CE qualifies the chip, then OE (read) or WE (write) moves data. The live chip on the right uses the same three pins as the waveform.</Theory>
      <div className="grid cards-2">
        <Card title="Waveform">
          <Segmented options={["Read", "Write"]} value={cycle === "read" ? "Read" : "Write"} onChange={(value) => { setCycle(value === "Read" ? "read" : "write"); setCursor(0); }} />
          <Waveform traces={traces} cursor={cursor} onCursor={setCursor} />
          <div className="row">
            <Button onClick={() => setCursor((value) => Math.max(0, value - 1))}>Prev</Button>
            <Button variant="primary" onClick={() => setCursor((value) => Math.min(4, value + 1))}>Step</Button>
            <Metric label="Step" value={String(cursor)} />
          </div>
          <ol>
            {marks.map((mark) => (
              <li key={mark.name} style={mark.at === cursor ? { fontWeight: 800, color: "var(--primary)" } : undefined}>{mark.name} rises at step {mark.at}{mark.at <= cursor ? " — active" : ""}.</li>
            ))}
          </ol>
          <p className="muted">High now: {current.join(" · ") || "idle"}.</p>
        </Card>
        <Card title="Live CE / OE / WE">
          <p className="tiny">Cell 0 is {memory.cells[0]?.toString(16).padStart(2, "0")}.</p>
          <div className="row">
            <span className="row"><span className="tiny">CE</span><Toggle on={ce} onChange={setCe} label="CE" /></span>
            <span className="row"><span className="tiny">OE</span><Toggle on={oe} onChange={setOe} label="OE" /></span>
            <span className="row"><span className="tiny">WE</span><Toggle on={we} onChange={setWe} label="WE" /></span>
          </div>
          <div className="row">
            <Button variant="primary" onClick={runRead}>Read cell 0</Button>
            <Button onClick={runWrite}>Write 0xA5</Button>
          </div>
          <p>{note}</p>
          <p className="muted">Read ignores WE. Write ignores OE. Both ignore the array if CE is low.</p>
        </Card>
      </div>
    </>
  );
}
