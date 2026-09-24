import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Icon } from "../../design-system/icons";
import { createMemory, readWord, writeWord, type MemoryArray, type MemoryKind } from "../../engines/memory/memoryArray";
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

      {chip === "addressing" ? <AddressingNote address={address} bits={bits} /> : null}
      {chip === "organization" ? <OrgNote /> : null}

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

function AddressingNote({ address, bits }: { address: number; bits: string[] }) {
  return <p className="callout">Address {hexByte(address)} is {bits.join("")}. The decoder raises exactly one of 64 word lines.</p>;
}

function OrgNote() {
  return <p className="callout">This chip is 64 × 8: 6 address pins and 8 data pins. Capacity is 2^6 × 8 = 512 bits.</p>;
}
