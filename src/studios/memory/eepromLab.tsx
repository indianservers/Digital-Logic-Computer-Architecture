import { useEffect, useState } from "react";
import { eepromWrite, formatHex, pageSpan, type EepromCell } from "../../engines/memory/fundamentals";
import { Field, LabGuide } from "./guide";

const LENGTH = 256;
const LIMIT = 8;

export function EepromLab() {
  const [cells, setCells] = useState<EepromCell[]>(() => Array.from({ length: LENGTH }, () => ({ value: 0xff, cycles: 0 })));
  const [address, setAddress] = useState(0x1a);
  const [data, setData] = useState("5C");
  const [pageSize, setPageSize] = useState(8);
  const [delay, setDelay] = useState(2);
  const [busy, setBusy] = useState(0);
  const [status, setStatus] = useState<"READY" | "BUSY">("READY");
  const [wear, setWear] = useState(false);
  const [note, setNote] = useState("Ready for a byte write.");
  const cell = cells[address] ?? { value: 0xff, cycles: 0 };
  const page = pageSpan(address, pageSize, LENGTH);
  const parsed = Number.parseInt(data, 16);

  useEffect(() => {
    if (busy <= 0) return;
    const timer = window.setTimeout(() => setBusy((value) => value - 1), 400);
    return () => window.clearTimeout(timer);
  }, [busy]);

  useEffect(() => {
    if (busy !== 0) return;
    if (status === "BUSY") setStatus("READY");
  }, [busy, status]);

  function writeByte(target = address, value = parsed) {
    if (Number.isNaN(value) || value < 0 || value > 255) { setNote("Data must be 00–FF."); return; }
    setStatus("BUSY");
    setBusy(delay);
    window.setTimeout(() => {
      setCells((current) => current.map((item, index) => index === target ? eepromWrite(item, value) : item));
      setNote(`Write stored 0x${formatHex(value, 2)} at 0x${formatHex(target, 2)} after the program delay.`);
      setStatus("READY");
      setBusy(0);
    }, delay * 400);
  }

  function eraseByte() {
    writeByte(address, 0xff);
    setNote("Byte erase returns this cell to 0xFF and counts as a cycle.");
  }

  function wearDemo() {
    setWear(true);
    setCells((current) => current.map((item, index) => index === address ? { value: item.value ^ 0xff, cycles: item.cycles + 1 } : item));
  }

  function reset() {
    setCells(Array.from({ length: LENGTH }, () => ({ value: 0xff, cycles: 0 })));
    setAddress(0x1a);
    setData("5C");
    setPageSize(8);
    setDelay(2);
    setBusy(0);
    setStatus("READY");
    setWear(false);
    setNote("Ready for a byte write.");
  }

  return (
    <div>
      <LabGuide
        aim="Program one byte electrically and watch the cell go busy, then ready."
        concept="EEPROM stores charge on a floating gate. A byte can be erased and rewritten. Each program consumes endurance."
        change={["Address", "Data", "Page size", "Write delay", "Wear demo"]}
        steps={["Read the selected byte.", "Write 5C and wait for READY.", "Run the wear demo on one cell."]}
        observe={["BUSY stays up for the write delay.", "The cycle count increases.", "Page highlight covers the whole page, not one byte."]}
        formula="A page starts at floor(address / page size) × page size."
      />
      <div className="memx-lab">
        <section className="lgx-card">
          <h3>Floating-Gate Transistor</h3>
          <svg className="memx-schematic" viewBox="0 0 240 150" role="img" aria-label="Conceptual floating gate">
            <text x="120" y="16" textAnchor="middle" fontSize="11">Control gate</text>
            <rect x="70" y="24" width="100" height="16" fill="#dbeafe" stroke="#2563eb" />
            <text x="120" y="58" textAnchor="middle" fontSize="11">Floating gate {cell.value === 0xff ? "erased" : "programmed"}</text>
            <rect x="80" y="64" width="80" height="16" fill={cell.value === 0xff ? "white" : "#fde68a"} stroke="#d97706" />
            {cell.value === 0xff ? null : <circle cx={120} cy={72} r={4} fill="#b45309" />}
            <text x="40" y="110" fontSize="11">Source</text>
            <text x="170" y="110" fontSize="11">Drain</text>
            <path d="M60 100 H180" stroke="#334155" />
          </svg>
          <p className="tiny">The dot is a label for stored charge, not a measured electron path.</p>
          <div className="memx-controls">
            <button type="button" className="memx-read" onClick={() => setNote(`Read 0x${formatHex(cell.value, 2)} from 0x${formatHex(address, 2)}.`)}>Read</button>
            <button type="button" className="memx-write" onClick={() => writeByte()}>Write</button>
            <button type="button" className="memx-erase" onClick={eraseByte}>Erase</button>
            <button type="button" className="memx-auto" onClick={() => { setData("A5"); writeByte(address, 0xa5); }}>Auto Write</button>
          </div>
        </section>
        <section className="lgx-card">
          <h3>EEPROM · 256 bytes</h3>
          <div className="memx-cells memx-scroll">
            {cells.map((item, index) => (
              <button key={index} type="button" className={index === address ? "mem-cell on" : page.includes(index) ? "mem-cell region" : "mem-cell"} onClick={() => setAddress(index)}>{formatHex(item.value, 2)}</button>
            ))}
          </div>
          <p className="tiny">Page of {pageSize}: {page.map((item) => `0x${formatHex(item, 2)}`).join(" ")}</p>
        </section>
        <div className="memx-side">
          <section className="lgx-card">
            <h3>Cell State</h3>
            <Field label="Address"><input aria-label="EEPROM address" value={formatHex(address, 2)} onChange={(event) => { const value = Number.parseInt(event.target.value, 16); if (!Number.isNaN(value)) setAddress(Math.max(0, Math.min(255, value))); }} /></Field>
            <Field label="Data"><input aria-label="EEPROM data" value={data} onChange={(event) => setData(event.target.value.toUpperCase())} /></Field>
            <Field label="Page size">
              <select aria-label="Page size" value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
                {[4, 8, 16].map((size) => <option key={size} value={size}>{size} bytes</option>)}
              </select>
            </Field>
            <Field label="Write delay">
              <select aria-label="Write delay" value={delay} onChange={(event) => setDelay(Number(event.target.value))}>
                {[1, 2, 4].map((value) => <option key={value} value={value}>{value} steps</option>)}
              </select>
            </Field>
            <p><span>Cycles</span><b>{cell.cycles}</b></p>
            <p><span>Threshold</span><b>{LIMIT} (teaching)</b></p>
            <p><span>Status</span><b>{status}</b></p>
            <div className="memx-meter"><span style={{ width: `${Math.min(100, (busy / Math.max(1, delay)) * 100)}%` }} /></div>
            <p>{note}</p>
          </section>
          <section className="lgx-card">
            <h3>Endurance Demo</h3>
            <div className="memx-meter"><span style={{ width: `${Math.min(100, (cell.cycles / LIMIT) * 100)}%` }} /></div>
            <button type="button" className="fsmx-icon" onClick={wearDemo}>Accelerated wear</button>
            <p className="tiny">{wear ? "Repeated writes on one cell climb faster than spreading writes." : "Each write adds one cycle on this byte."}</p>
            <p className="tiny">Protocol sketch: START → address 0x{formatHex(address, 2)} → data → WRITE → {status}.</p>
            <button type="button" className="fsmx-icon" onClick={reset}>Reset</button>
          </section>
        </div>
      </div>
    </div>
  );
}
