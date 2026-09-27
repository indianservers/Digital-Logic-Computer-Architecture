import { useMemo, useState } from "react";
import { applySram, formatHex, toBinary, type SramMode } from "../../engines/memory/fundamentals";
import { Field, LabGuide } from "./guide";

export function SramLab() {
  const [mode, setMode] = useState<SramMode>("hold");
  const [cell, setCell] = useState(() => applySram({ q: 1, wl: 0, bl: 1, blb: 0, mode: "hold", stable: true }, "hold"));
  const [rows, setRows] = useState(8);
  const [address, setAddress] = useState(0);
  const [bits, setBits] = useState<number[]>(() => Array.from({ length: 128 }, (_, index) => (index * 3 + 1) & 0xff));
  const [speed, setSpeed] = useState(1);
  const [note, setNote] = useState("Hold keeps Q until a write changes the latch.");
  const width = 8;
  const count = rows * width;
  const visible = bits.slice(0, count);

  function run(next: SramMode) {
    const updated = applySram(cell, next);
    setMode(next);
    setCell(updated);
    setBits((current) => current.map((value, index) => {
      if (index !== address) return value;
      const cleared = value & 0xfe;
      return cleared | updated.q;
    }));
    setNote(next === "write1"
      ? "BL = 1, BL̅ = 0, wordline rises. The latch settles at Q = 1."
      : next === "write0"
        ? "BL = 0, BL̅ = 1, wordline rises. The latch settles at Q = 0."
        : next === "read"
          ? "Bitlines were precharged. The cell nudges one line down and the sense amplifier resolves Q."
          : "Wordline is low. The cross-coupled inverters hold the bit. No refresh is required.");
  }

  function reset() {
    setMode("hold");
    setCell(applySram({ q: 1, wl: 0, bl: 1, blb: 0, mode: "hold", stable: true }, "hold"));
    setRows(8);
    setAddress(0);
    setBits(Array.from({ length: 128 }, (_, index) => (index * 3 + 1) & 0xff));
    setSpeed(1);
    setNote("Hold keeps Q until a write changes the latch.");
  }

  const sense = cell.mode === "read" ? cell.q : cell.q;
  const row = Math.floor(address / width);
  const column = address % width;
  const labels = useMemo(() => ["Hold", "Read", "Write 0", "Write 1"] as const, []);

  return (
    <div>
      <LabGuide
        aim="Watch a 6-transistor latch hold, read, and write one bit."
        concept="Two cross-coupled inverters store Q and Q̅. Access transistors connect them to BL and BL̅ only while the wordline is high."
        change={["Stored bit", "Operation", "Wordline through the operation", "Array size", "Address"]}
        steps={["Press Write 1 and read Q and Q̅.", "Press Read and watch the sense amplifier.", "Select another cell in the array."]}
        observe={["Write 1 forces BL high and BL̅ low.", "Read does not flip Q.", "SRAM needs no refresh while VDD is present."]}
        formula="A 6T cell uses six transistors per bit. An array selects one wordline and one column pair."
      />
      <div className="memx-lab">
        <section className="lgx-card">
          <h3>6T SRAM Cell</h3>
          <svg className="memx-schematic" viewBox="0 0 280 220" role="img" aria-label="Six transistor SRAM cell">
            <text x="140" y="16" textAnchor="middle" fontSize="12" fontWeight="700">VDD</text>
            <line x1="70" y1="24" x2="70" y2="48" stroke="#2563eb" />
            <line x1="210" y1="24" x2="210" y2="48" stroke="#2563eb" />
            <rect x="48" y="48" width="44" height="36" rx="6" fill={cell.q ? "#dbeafe" : "white"} stroke="#2563eb" />
            <rect x="188" y="48" width="44" height="36" rx="6" fill={cell.q ? "white" : "#dbeafe"} stroke="#2563eb" />
            <text x="70" y="70" textAnchor="middle" fontSize="12">Q {cell.q}</text>
            <text x="210" y="70" textAnchor="middle" fontSize="12">Q̅ {cell.q ? 0 : 1}</text>
            <path d="M92 66 H188" fill="none" stroke="#64748b" />
            <path d="M70 84 V150 M210 84 V150" fill="none" stroke="#64748b" />
            <rect x="48" y="108" width="44" height="28" rx="6" fill="white" stroke="#d97706" />
            <rect x="188" y="108" width="44" height="28" rx="6" fill="white" stroke="#d97706" />
            <text x="70" y="126" textAnchor="middle" fontSize="10">access</text>
            <text x="210" y="126" textAnchor="middle" fontSize="10">access</text>
            <line x1="20" y1="122" x2="250" y2="122" stroke={cell.wl ? "#16a34a" : "#94a3b8"} strokeWidth={cell.wl ? 3 : 1} />
            <text x="24" y="114" fontSize="11" fill={cell.wl ? "#16a34a" : "#64748b"}>WL {cell.wl}</text>
            <text x="40" y="176" fontSize="12" fill={cell.bl ? "#2563eb" : "#64748b"}>BL {cell.bl}</text>
            <text x="190" y="176" fontSize="12" fill={cell.blb ? "#2563eb" : "#64748b"}>BL̅ {cell.blb}</text>
            <line x1="70" y1="136" x2="70" y2="188" stroke={cell.bl ? "#2563eb" : "#94a3b8"} strokeWidth="2" />
            <line x1="210" y1="136" x2="210" y2="188" stroke={cell.blb ? "#2563eb" : "#94a3b8"} strokeWidth="2" />
          </svg>
          <div className="memx-controls">
            {labels.map((label) => {
              const value: SramMode = label === "Hold" ? "hold" : label === "Read" ? "read" : label === "Write 0" ? "write0" : "write1";
              return <button key={label} type="button" className={mode === value ? "memx-read" : "fsmx-icon"} onClick={() => run(value)}>{label}</button>;
            })}
          </div>
          <Field label="Animation speed">
            <select aria-label="SRAM speed" value={speed} onChange={(event) => setSpeed(Number(event.target.value))}>
              <option value={0.5}>0.5×</option>
              <option value={1}>1×</option>
              <option value={2}>2×</option>
            </select>
          </Field>
          <p>{note}</p>
          <p className="tiny">Step time is {Math.round(800 / speed)} ms. The latch result does not depend on the speed.</p>
        </section>
        <section className="lgx-card">
          <div className="lgx-card-bar">
            <h3>SRAM Array ({rows} × 8)</h3>
            <div className="fsmx-quick">
              <button type="button" className={rows === 8 ? "on" : ""} onClick={() => { setRows(8); setAddress(0); }}>8×8</button>
              <button type="button" className={rows === 16 ? "on" : ""} onClick={() => setRows(16)}>16×8</button>
            </div>
          </div>
          <p className="tiny">Row {row} wordline · column {column}. Decoder selects the row. The column mux selects the byte.</p>
          <div className="memx-cells">
            {visible.map((value, index) => (
              <button key={index} type="button" className={index === address ? "mem-cell on" : "mem-cell"} onClick={() => {
                setAddress(index);
                const bit = ((value & 1) as 0 | 1);
                setCell(applySram({ q: bit, wl: 0, bl: bit, blb: bit ? 0 : 1, mode: "hold", stable: true }, "hold"));
                setMode("hold");
              }}>{formatHex(value, 2)}</button>
            ))}
          </div>
        </section>
        <div className="memx-side">
          <section className="lgx-card">
            <h3>Cell State</h3>
            <p><span>Q</span><b>{cell.q}</b></p>
            <p><span>Q̅</span><b>{cell.q ? 0 : 1}</b></p>
            <p><span>WL</span><b>{cell.wl ? "HIGH" : "LOW"}</b></p>
            <p><span>BL</span><b>{cell.bl}</b></p>
            <p><span>BL̅</span><b>{cell.blb}</b></p>
            <p><span>Mode</span><b>{mode}</b></p>
            <p><span>Stability</span><b>{cell.stable ? "Stable" : "Transition"}</b></p>
          </section>
          <section className="lgx-card">
            <h3>How Read Works</h3>
            <ol className="memx-steps">
              {["Precharge BL and BL̅.", "Assert the wordline.", "The cell discharges one bitline.", "Sense amplifier decides the bit."].map((line, index) => (
                <li key={line} className={mode === "read" && index < 4 ? "on" : ""}>{line}</li>
              ))}
            </ol>
          </section>
          <section className="lgx-card">
            <h3>Sense Amplifier</h3>
            <p className="expr">{sense}<small>resolved bit</small></p>
            <p className="tiny">Access time is shortest when the wordline and the column are both free. Stored byte {formatHex(visible[address] ?? 0, 2)} · {toBinary(visible[address] ?? 0, 8)}.</p>
            <p>SRAM is fast, uses more transistors than DRAM, and is the usual cache cell. This array does not decay.</p>
            <button type="button" className="fsmx-icon" onClick={reset}>Reset</button>
          </section>
        </div>
      </div>
    </div>
  );
}
