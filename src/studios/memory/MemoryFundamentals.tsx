import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Icon } from "../../design-system/icons";
import { decoder } from "../../engines/digital/routing";
import { createMemory, decayDram, readWord, refreshDram, writeWord, type MemoryArray, type MemoryKind } from "../../engines/memory/memoryArray";
import { splitAddress } from "../../engines/memory/addressDecoder";
import { chipFromPins, describeOrganization } from "../../engines/memory/organization";
import { readCycle, writeCycle } from "../../engines/memory/timing";

type Chip = "array" | "sram" | "dram" | "rom" | "eeprom" | "flash" | "addressing" | "organization";

const CHIPS: Array<{ id: Chip; label: string; kind: MemoryKind }> = [
  { id: "array", label: "RAM", kind: "ram" },
  { id: "sram", label: "SRAM", kind: "sram" },
  { id: "dram", label: "DRAM", kind: "dram" },
  { id: "rom", label: "ROM", kind: "rom" },
  { id: "eeprom", label: "EEPROM", kind: "eeprom" },
  { id: "flash", label: "Flash", kind: "flash" },
  { id: "addressing", label: "Addressing", kind: "ram" },
  { id: "organization", label: "Memory Organization", kind: "ram" },
];

const PRELOAD = [0x3c, 0x12, 0xa5, 0xff, 0x10, 0x20, 0x00, 0x1c, 0x08, 0x00, 0x7e, 0x91, 0x00, 0x40, 0x00, 0x00];

const MAP = [
  { start: 0x00, end: 0x0f, name: "System / Boot" },
  { start: 0x10, end: 0x1f, name: "Variables" },
  { start: 0x20, end: 0x2f, name: "Program Code" },
  { start: 0x30, end: 0x3f, name: "User Data" },
];

function hexByte(value: number): string {
  return (value & 0xff).toString(16).toUpperCase().padStart(2, "0");
}

function parseHex(text: string, fallback: number, max: number): number {
  const parsed = Number.parseInt(text.replace(/^0x/i, ""), 16);
  if (Number.isNaN(parsed)) return fallback;
  return Math.max(0, Math.min(max, parsed));
}

function seeded(kind: MemoryKind): MemoryArray {
  const memory = createMemory(kind, 64, 8);
  const cells = memory.cells.slice();
  for (let index = 0; index < 64; index += 1) cells[index] = PRELOAD[index % PRELOAD.length] ?? 0;
  return { ...memory, cells };
}

export function MemoryFundamentals() {
  const [params, setParams] = useSearchParams();
  const raw = (params.get("tab") ?? "array") as Chip;
  const chip = CHIPS.some((item) => item.id === raw) ? raw : "array";
  const kind = CHIPS.find((item) => item.id === chip)?.kind ?? "ram";
  const [memory, setMemory] = useState<MemoryArray>(() => seeded("ram"));
  const [addressText, setAddressText] = useState("00");
  const [dataText, setDataText] = useState("A5");
  const [view, setView] = useState<"byte" | "word">("byte");
  const [cycle, setCycle] = useState<"read" | "write">("read");
  const [mark, setMark] = useState<"selected" | "read" | "write">("selected");
  const [note, setNote] = useState("Choose an address, then read or write.");
  const [answer, setAnswer] = useState("");
  const address = parseHex(addressText, 0, 63);
  const data = parseHex(dataText, 0, 255);
  const active = memory.kind === kind ? memory : seeded(kind);

  function useKind(next: MemoryKind, id: Chip) {
    const query = new URLSearchParams(params);
    query.set("tab", id);
    setParams(query);
    setMemory(seeded(next));
    setMark("selected");
    setNote(`${CHIPS.find((item) => item.id === id)?.label ?? "RAM"} array loaded.`);
  }

  const shown = memory.kind === kind ? memory : active;
  const bits = address.toString(2).padStart(6, "0").split("");
  const dataBits = (shown.cells[address] ?? 0).toString(2).padStart(8, "0").split("");
  const marks = cycle === "read" ? readCycle() : writeCycle();
  const region = MAP.find((item) => address >= item.start && address <= item.end);
  const words = useMemo(() => {
    const pairs: number[] = [];
    for (let index = 0; index < shown.cells.length; index += 2) {
      pairs.push(((shown.cells[index] ?? 0) << 8) | (shown.cells[index + 1] ?? 0));
    }
    return pairs;
  }, [shown.cells]);

  function read() {
    const result = readWord(shown, address, true, true);
    if (result.data !== null) setDataText(hexByte(result.data));
    setCycle("read");
    setMark("read");
    setNote(result.explain);
  }

  function write() {
    const result = writeWord(shown, address, data, true, true);
    setMemory(result.memory);
    setCycle("write");
    setMark("write");
    setNote(result.access.explain);
  }

  return (
    <div className="memx">
      <header className="fsmx-head">
        <div className="lgx-title">
          <span className="lgx-mark"><Icon name="grid" size={22} /></span>
          <div>
            <p className="tiny">Studio 14</p>
            <h1>Memory Fundamentals <span className="fsmx-badge">18 concepts</span></h1>
            <p>Explore how memory stores data, from basic cells to real-world memory systems. Visualize, experiment, and build intuition through interactive simulations.</p>
          </div>
        </div>
        <button className="lgx-check" type="button" onClick={() => useKind("ram", "array")}>Start Learning</button>
      </header>
      <div className="fsmx-stats">
        <span><b>7</b> interactive labs</span>
        <span><b>18</b> Concepts</span>
        <span><b>6</b> Practice Problems</span>
        <span><b>8</b> Real-World Examples</span>
      </div>
      <div className="lgx-tabs" role="tablist">
        {CHIPS.map((item) => (
          <button key={item.id} role="tab" aria-selected={chip === item.id} className={chip === item.id ? "on" : ""} onClick={() => useKind(item.kind, item.id)}>{item.label}</button>
        ))}
      </div>

      {chip === "array" ? (
      <div className="memx-grid">
        <section className="lgx-card memx-array">
          <div className="lgx-card-bar">
            <h3>Memory Array Visualizer</h3>
            <div className="fsmx-quick">
              <button type="button" className={view === "byte" ? "on" : ""} onClick={() => setView("byte")}>Byte View</button>
              <button type="button" className={view === "word" ? "on" : ""} onClick={() => setView("word")}>Word View</button>
            </div>
          </div>
          <p className="tiny">Interact with a simple memory system. Set an address, read or write data, and observe the internal access steps. {view === "byte" ? "8 × 8 (64 bytes)" : "32 × 16-bit words"}</p>
          <div className="memx-visual">
            <div className="memx-lines">
              {bits.map((bit, index) => <span key={`a${index}`} className={bit === "1" ? "on" : ""}>A{5 - index} {bit}</span>)}
            </div>
            <div className="memx-decoder">Address<br />Decoder<br /><b>6 → 64</b></div>
            <div>
              <p className="tiny">Memory Array (8 × 8)</p>
              {view === "byte" ? (
                <div className="memx-cells">
                  {shown.cells.map((cell, index) => (
                    <button key={index} type="button" className={index === address ? `mem-cell on ${mark}` : "mem-cell"} onClick={() => { setAddressText(hexByte(index)); setMark("selected"); }}>
                      {hexByte(cell)}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="memx-cells words">
                  {words.map((word, index) => (
                    <button key={index} type="button" className={Math.floor(address / 2) === index ? "mem-cell on" : "mem-cell"} onClick={() => setAddressText(hexByte(index * 2))}>
                      {word.toString(16).toUpperCase().padStart(4, "0")}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="memx-lines">
              {dataBits.map((bit, index) => <span key={`d${index}`} className={bit === "1" ? "on" : ""}>D{7 - index} {bit}</span>)}
            </div>
          </div>
          <p className="tiny">Selected cell · Read highlight · Write highlight · {region?.name ?? "—"}</p>
          <div className="memx-controls">
            <label>Address (Hex)<input aria-label="Address hex" value={addressText} onChange={(event) => { setAddressText(event.target.value.toUpperCase()); setMark("selected"); }} /></label>
            <label>Data (Hex)<input aria-label="Data hex" value={dataText} onChange={(event) => setDataText(event.target.value.toUpperCase())} /></label>
            <button className="memx-read" type="button" onClick={read}>Read</button>
            <button className="memx-write" type="button" onClick={write}>Write</button>
            <button type="button" className="fsmx-icon" onClick={() => { setMemory(createMemory(kind, 64, 8)); setNote("Array cleared."); }}>Clear</button>
            <button type="button" className="fsmx-icon" onClick={() => { setMemory(seeded(kind)); setNote("Demo pattern preloaded."); }}>Preload</button>
          </div>
          <p>{note}</p>
        </section>

        <section className="lgx-card">
          <h3>Memory Details</h3>
          <p><span>Capacity</span><b>64 bytes</b></p>
          <p><span>Word Size</span><b>8 bits (1 byte)</b></p>
          <p><span>Address Range</span><b>0x00 – 0x3F</b></p>
          <p><span>Total Words</span><b>64</b></p>
        </section>
        <section className="lgx-card">
          <h3>Memory Map</h3>
          {MAP.map((item) => (
            <p key={item.name} className={region?.name === item.name ? "on" : ""}>
              <b>0x{hexByte(item.start)} – 0x{hexByte(item.end)}</b> {item.name}
            </p>
          ))}
        </section>
        <section className="lgx-card">
          <h3>Address Bus</h3>
          <p>Width <b>6 bits</b></p>
          <p>Addresses <b>64</b></p>
          <p>Range <b>0x00 – 0x3F</b></p>
          <p className="mono">{bits.join(" ")}</p>
        </section>
        <section className="lgx-card">
          <h3>Data Bus</h3>
          <p>Width <b>8 bits</b></p>
          <p>Data per Transfer <b>1 byte</b></p>
          <p>Values <b>0x00 – 0xFF</b></p>
          <p className="mono">{dataBits.join(" ")}</p>
        </section>
        <section className="lgx-card memx-cycle">
          <div className="lgx-card-bar">
            <h3>Read / Write Cycle</h3>
            <div className="fsmx-quick">
              <button type="button" className={cycle === "read" ? "on" : ""} onClick={() => setCycle("read")}>Read Cycle</button>
              <button type="button" className={cycle === "write" ? "on" : ""} onClick={() => setCycle("write")}>Write Cycle</button>
            </div>
          </div>
          <ol>
            {(cycle === "read"
              ? ["CPU places address on address bus", "Address decoder selects memory cell", "Control signal (RD) is asserted", "Data appears on data bus after access time"]
              : ["CPU places address and data on the buses", "Decoder selects the cell", "Write enable stores the byte", "The cell keeps the new value"]).map((line, index) => <li key={line}>{index + 1}. {line}</li>)}
          </ol>
          <svg viewBox="0 0 280 90" className="memx-wave" role="img" aria-label={`${cycle} cycle`}>
            {marks.map((mark, index) => (
              <g key={mark.name}>
                <text x="4" y={16 + index * 16} fontSize="10">{mark.name}</text>
                <path d={`M 70 ${10 + index * 16} H ${70 + mark.at * 40} V ${mark.level === 1 ? 4 + index * 16 : 14 + index * 16} H 250`} fill="none" stroke="#2563eb" strokeWidth="2" />
              </g>
            ))}
          </svg>
        </section>
      </div>
      ) : null}
      {chip === "sram" ? <SramPanel /> : null}
      {chip === "dram" ? <DramPanel /> : null}
      {chip === "rom" ? <StorePanel kind="rom" /> : null}
      {chip === "eeprom" ? <StorePanel kind="eeprom" /> : null}
      {chip === "flash" ? <StorePanel kind="flash" /> : null}
      {chip === "addressing" ? <AddressingPanel /> : null}
      {chip === "organization" ? <OrganizationPanel /> : null}

      <div className="fsmx-foot">
        <section className="lgx-card">
          <h3>Key Concepts (18)</h3>
          <ol>
            {["Memory hierarchy", "Volatile vs non-volatile memory", "SRAM vs DRAM", "ROM, EEPROM and Flash", "Memory addressing and decoding", "Memory organization and mapping"].map((item, index) => <li key={item}>{index + 1}. {item}</li>)}
          </ol>
          <Link to="/studios/memory?tab=timing">Timing lab</Link>
        </section>
        <section className="lgx-card">
          <h3>Interactive Labs (7)</h3>
          <ul>
            <li><button type="button" onClick={() => useKind("ram", "array")}>Build a Simple RAM</button></li>
            <li><button type="button" onClick={() => useKind("sram", "sram")}>Explore SRAM vs DRAM</button></li>
            <li><Link to="/studios/memory?tab=decode">Memory Address Decoder</Link></li>
            <li><button type="button" onClick={() => useKind("rom", "rom")}>Program a ROM</button></li>
            <li><Link to="/studios/memory?tab=timing">EEPROM Write Cycles</Link></li>
            <li><button type="button" onClick={() => useKind("ram", "organization")}>Design a Memory Map</button></li>
          </ul>
        </section>
        <section className="lgx-card">
          <h3>Real-World Applications</h3>
          <ul>
            <li>Main memory in CPUs and microcontrollers</li>
            <li>Cache memory (L1, L2, L3)</li>
            <li>Firmware storage in embedded systems</li>
            <li>SSD and flash storage devices</li>
          </ul>
        </section>
        <section className="lgx-card">
          <h3>Practice Challenge</h3>
          <p>A memory chip has 16 address lines and an 8-bit data bus. What is the total capacity of the memory in kilobytes?</p>
          <input aria-label="Capacity answer in kilobytes" value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="KB" />
          <p className="tiny">{answer.trim() === "64" ? "64 KB. 2^16 addresses × 1 byte = 65536 bytes." : "2^16 locations, one byte each."}</p>
        </section>
      </div>
    </div>
  );
}

function SramPanel() {
  const [bit, setBit] = useState<0 | 1>(1);
  return (
    <section className="lgx-card">
      <h3>6T SRAM cell</h3>
      <p>Two cross-coupled inverters hold the bit. There is no capacitor and no refresh. Click Q to flip the loop.</p>
      <div className="sram-loop">
        <button type="button" className={bit ? "ff-cell on" : "ff-cell"} aria-label="SRAM Q" onClick={() => setBit(bit ? 0 : 1)}>Q {bit}<small>stored</small></button>
        <span>⇄</span>
        <div className={bit ? "ff-cell" : "ff-cell on"}>Q̅ {bit ? 0 : 1}<small>complement</small></div>
      </div>
      <p>Stored bit is {bit}. A later read returns the same value until you flip Q again.</p>
    </section>
  );
}

function DramPanel() {
  const [memory, setMemory] = useState<MemoryArray>(() => createMemory("dram", 8, 1, 1));
  const [index, setIndex] = useState(0);
  const charge = memory.charge[index] ?? 0;
  const stored = memory.cells[index] ?? 0;
  return (
    <section className="lgx-card">
      <h3>1T1C DRAM cell</h3>
      <p>Each bit is charge on a capacitor. Leakage drops that charge, so the row must be refreshed.</p>
      <div className="mem-grid">
        {memory.cells.map((cell, slot) => (
          <button key={slot} type="button" className={slot === index ? "mem-cell on" : "mem-cell"} onClick={() => setIndex(slot)}>
            C{slot}<strong>{cell}</strong><span className="tiny">{memory.charge[slot] ?? 0}%</span>
          </button>
        ))}
      </div>
      <div className={charge < 40 ? "charge low" : "charge"} style={{ width: `${charge}%` }} />
      <div className="row">
        <button type="button" className="memx-write" onClick={() => setMemory(writeWord(memory, index, 1, true, true).memory)}>Store 1</button>
        <button type="button" className="fsmx-icon" onClick={() => setMemory(writeWord(memory, index, 0, true, true).memory)}>Store 0</button>
        <button type="button" className="fsmx-icon" onClick={() => setMemory(decayDram(memory))}>Decay</button>
        <button type="button" className="memx-read" onClick={() => setMemory(refreshDram(memory))}>Refresh</button>
      </div>
      <p>{charge < 40 ? `Cell ${index} is at ${charge}%. A read of ${stored} would be unreliable until refresh.` : `Cell ${index} holds ${stored} at ${charge}% charge.`}</p>
    </section>
  );
}

function StorePanel({ kind }: { kind: "rom" | "eeprom" | "flash" }) {
  const [memory, setMemory] = useState<MemoryArray>(() => createMemory(kind, 8, 8, kind === "rom" ? 0x3c : 0xff));
  const [note, setNote] = useState(kind === "rom" ? "Mask ROM is factory data. A write is rejected." : `${kind.toUpperCase()} is ready.`);
  const [block, setBlock] = useState(0);
  function program(value: number) {
    const result = writeWord(memory, 0, value, true, true);
    setMemory(result.memory);
    setNote(result.access.explain);
  }
  function eraseBlock() {
    const cells = memory.cells.slice();
    for (let index = block * 4; index < block * 4 + 4; index += 1) cells[index] = 0xff;
    setMemory({ ...memory, cells });
    setNote(`Flash block ${block} (cells ${block * 4}–${block * 4 + 3}) erased to 0xFF.`);
  }
  const title = kind === "rom" ? "Mask ROM" : kind === "eeprom" ? "EEPROM byte" : "Flash block";
  return (
    <section className="lgx-card">
      <h3>{title}</h3>
      <p>{kind === "rom" ? "The factory pattern stays. Write does not change cell 0." : kind === "eeprom" ? "A byte can be rewritten in place. Cell 0 accepts another program." : "Erase clears a 4-byte block, then a program can store a new byte."}</p>
      <p className="expr">{(memory.cells[0] ?? 0).toString(16).toUpperCase().padStart(2, "0")}</p>
      <div className="row">
        <button type="button" className="memx-write" onClick={() => program(0x5a)}>Write 0x5A</button>
        <button type="button" className="fsmx-icon" onClick={() => program(0xa5)}>Write 0xA5</button>
        {kind === "flash" ? <button type="button" className="memx-read" onClick={eraseBlock}>Erase block {block}</button> : null}
        {kind === "flash" ? <button type="button" className="fsmx-icon" onClick={() => setBlock((value) => (value + 1) % 2)}>Next block</button> : null}
      </div>
      <p>{note}</p>
      <div className="memx-cells">
        {memory.cells.map((cell, index) => <span key={index} className="mem-cell">{hexByte(cell)}</span>)}
      </div>
    </section>
  );
}

function AddressingPanel() {
  const [bits, setBits] = useState<Array<0 | 1>>([0, 1, 0]);
  const [enable, setEnable] = useState(true);
  const lines = decoder(bits, enable ? 1 : 0);
  const active = lines.findIndex((bit) => bit === 1);
  return (
    <section className="lgx-card">
      <h3>Address decoder</h3>
      <p>Three select bits become one of eight word lines. Enable is the chip’s CE. With enable low, every line stays 0.</p>
      <div className="row">
        {bits.map((bit, index) => (
          <button key={index} type="button" className={bit ? "ff-cell on" : "ff-cell"} aria-label={`A${2 - index}`} onClick={() => setBits(bits.map((value, slot) => slot === index ? (value ? 0 : 1) : value))}>A{2 - index} {bit}</button>
        ))}
        <button type="button" className={enable ? "memx-read" : "fsmx-icon"} onClick={() => setEnable((value) => !value)}>{enable ? "Enable on" : "Enable off"}</button>
      </div>
      <div className="word-lines">
        {lines.map((bit, index) => <div key={index} className={bit === 1 ? "word-line on" : "word-line"}>Y{index}<strong>{bit}</strong></div>)}
      </div>
      <p>{enable && active >= 0 ? `Word line Y${active} is the only line high.` : "The decoder is idle. No word line is selected."}</p>
    </section>
  );
}

function OrganizationPanel() {
  const [words, setWords] = useState(64);
  const [width, setWidth] = useState(8);
  const org = describeOrganization(words, width);
  const chip = chipFromPins(org.addressLines, width);
  const split = splitAddress(5, Math.min(6, org.addressLines), Math.ceil(Math.min(6, org.addressLines) / 2));
  return (
    <section className="lgx-card">
      <h3>Memory organization</h3>
      <p>An n × m chip has n address pins and m data pins. The address splits into a row and a column.</p>
      <div className="row">
        <label>Words<input aria-label="Word count" type="number" min={2} max={65536} value={words} onChange={(event) => setWords(Math.max(2, Number(event.target.value) || 2))} /></label>
        <label>Width<input aria-label="Data width" type="number" min={1} max={32} value={width} onChange={(event) => setWidth(Math.max(1, Number(event.target.value) || 1))} /></label>
      </div>
      <p>{chip.label} · {org.label} · {org.addressLines} address lines · {org.capacityBits} bits.</p>
      <p>Example address 5 splits into row {split.selectBits || "0"} and column {split.offsetBits || "0"}.</p>
    </section>
  );
}
