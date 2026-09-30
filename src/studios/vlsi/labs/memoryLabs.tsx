import { useState } from "react";
import { decayCharge, senseDram } from "../../../engines/memory/fundamentals";
import { decodeMemory, dramCycle, nonvolatileView, senseAmplifier, sram6t, sramReadWave, sramWrite } from "../memoryModel";
import { VlsiGrid } from "../shell";
import { Badge, Choice, Measure, Observe, Slider, Wave } from "../widgets";

export function Sram6tLab() {
  const [stored, setStored] = useState<0 | 1>(1);
  const [mode, setMode] = useState<"hold" | "read" | "write0" | "write1">("hold");
  const [strength, setStrength] = useState(1.2);
  const [cell, setCell] = useState(1);
  const [pulse, setPulse] = useState(2);
  const view = sram6t(stored, mode, strength, cell, pulse);
  const devices = [
    { name: "PU0", on: true },
    { name: "PD0", on: view.q === 0 },
    { name: "PU1", on: true },
    { name: "PD1", on: view.q === 1 },
    { name: "AX0", on: view.wl === 1 },
    { name: "AX1", on: view.wl === 1 },
  ];
  return (
    <VlsiGrid
      controls={
        <>
          <Choice label="Stored bit" value={String(stored)} options={[{ id: "0", label: "0" }, { id: "1", label: "1" }]} onChange={(value) => setStored(value === "1" ? 1 : 0)} />
          <Choice label="Mode" value={mode} options={[{ id: "hold", label: "Hold" }, { id: "read", label: "Read" }, { id: "write0", label: "Write 0" }, { id: "write1", label: "Write 1" }]} onChange={setMode} />
          <Slider label="Write strength" value={strength} min={0.2} max={2} step={0.1} text={strength.toFixed(1)} onChange={setStrength} />
          <Slider label="Cell strength" value={cell} min={0.4} max={2} step={0.1} text={cell.toFixed(1)} onChange={setCell} />
          <Slider label="Wordline pulse" value={pulse} min={0.4} max={3} step={0.2} text={pulse.toFixed(1)} onChange={setPulse} />
        </>
      }
      stage={
        <svg className="vlsi-layout" viewBox="0 0 320 180" role="img" aria-label="Six-transistor SRAM cell">
          {devices.map((device, index) => (
            <g key={device.name}>
              <rect x={16 + (index % 3) * 100} y={index < 3 ? 24 : 100} width="80" height="48" rx="8" fill={device.on ? "#0e7490" : "#1e293b"} stroke="#e2e8f0" />
              <text x={28 + (index % 3) * 100} y={index < 3 ? 52 : 128} fill="#f8fafc">{device.name}</text>
            </g>
          ))}
        </svg>
      }
      readouts={
        <>
          <Measure label="Q" value={`${view.q}`} />
          <Measure label="BL / BLB" value={`${view.bl} / ${view.blb}`} />
          <Measure label="Wordline" value={view.wl ? "High" : "Low"} />
          <Measure label="SNM trend" value={`${view.snm.toFixed(0)} mV`} />
          <Measure label="Read disturb" value={view.disturb.toFixed(2)} />
          <Badge tone={view.failed ? "bad" : view.preserved ? "on" : "info"}>{view.failed ? "Write failed" : view.preserved ? "Read kept the bit" : view.wrote ? "Cell flipped" : "Holding"}</Badge>
          <Observe change="Step from hold to read, then to write 1 with a weak driver." see="Read keeps Q. A weak write leaves the badge on failed and Q unchanged." why="Access transistors turn on with the wordline. The write must overpower the cross-coupled inverters." experiment="Raise write strength above cell strength and lengthen the pulse." takeaway="SNM and read disturb here are educational indicators, not a butterfly-curve extraction." />
        </>
      }
    />
  );
}

export function SramArrayLab() {
  const [address, setAddress] = useState(19);
  const decoded = decodeMemory(address, 8, 8);
  return (
    <VlsiGrid
      controls={<Slider label="Address" value={address} min={0} max={63} step={1} text={`${address}`} onChange={setAddress} />}
      stage={
        <svg className="vlsi-heat" viewBox="0 0 280 220" role="img" aria-label="8 by 8 SRAM array with selected wordline and column">
          {Array.from({ length: 8 }, (_, row) => Array.from({ length: 8 }, (_, col) => (
            <rect key={`${row}-${col}`} x={40 + col * 26} y={24 + row * 22} width="22" height="16" rx="3" fill={row === decoded.row && col === decoded.col ? "#22d3ee" : row === decoded.row ? "#155e75" : "#1e293b"} />
          )))}
          <text x="8" y="16" fill="#e2e8f0">WL {decoded.row}</text>
          <text x="40" y="210" fill="#94a3b8">BL {decoded.col}</text>
        </svg>
      }
      readouts={
        <>
          <Measure label="Row bits" value={decoded.rowBits} />
          <Measure label="Column bits" value={decoded.colBits} />
          <Measure label="Wordline" value={`${decoded.row}`} />
          <Measure label="Column mux" value={`${decoded.col}`} />
          <Observe change="Move the address slider." see="One wordline row and one column light, and the crossing cell is brightest." why="High bits select the row decoder. Low bits select the column mux." experiment="Try address 0 and address 63." takeaway="Precharge, the sense amplifier, and the write driver sit on the selected bitline pair." />
        </>
      }
    />
  );
}

export function SramReadLab() {
  const [stored, setStored] = useState<0 | 1>(1);
  const [cap, setCap] = useState(20);
  const [senseAt, setSense] = useState(8);
  const wave = sramReadWave(stored, cap, senseAt);
  return (
    <VlsiGrid
      controls={
        <>
          <Choice label="Cell state" value={String(stored)} options={[{ id: "0", label: "0" }, { id: "1", label: "1" }]} onChange={(value) => setStored(value === "1" ? 1 : 0)} />
          <Slider label="Bitline capacitance" value={cap} min={4} max={60} step={2} text={`${cap.toFixed(0)} fF`} onChange={setCap} />
          <Slider label="Sense enable" value={senseAt} min={5} max={14} step={1} text={`${senseAt}`} onChange={setSense} />
        </>
      }
      stage={<Wave traces={[
        { name: "WL", color: "#fbbf24", values: wave.wl, min: 0, max: 1 },
        { name: "BL", color: "#22d3ee", values: wave.bl, min: 0.6, max: 1 },
        { name: "BLB", color: "#38bdf8", values: wave.blb, min: 0.6, max: 1 },
        { name: "SE", color: "#a78bfa", values: wave.sense, min: 0, max: 1 },
        { name: "DOUT", color: "#34d399", values: wave.data, min: 0, max: 1 },
      ]} />}
      readouts={
        <>
          <Measure label="ΔV at sense" value={`${wave.deltaMv.toFixed(0)} mV`} />
          <Measure label="Data out" value={`${stored}`} />
          <Badge tone="on">Read preserved {stored}</Badge>
          <Observe change="Increase bitline capacitance, then move sense enable." see="The differential at the sense instant shrinks when the bitline is heavier." why="The cell can only pull a small current, so a larger capacitance droops less before sense enable." experiment="Store 0 and watch BLB fall instead of BL." takeaway="A valid read reports the stored bit." />
        </>
      }
    />
  );
}

export function SramWriteLab() {
  const [stored, setStored] = useState<0 | 1>(0);
  const [value, setValue] = useState<0 | 1>(1);
  const [strength, setStrength] = useState(1.4);
  const [cell, setCell] = useState(1);
  const [pulse, setPulse] = useState(2);
  const wave = sramWrite(stored, value, strength, cell, pulse);
  return (
    <VlsiGrid
      controls={
        <>
          <Choice label="Write data" value={String(value)} options={[{ id: "0", label: "Write 0" }, { id: "1", label: "Write 1" }]} onChange={(next) => setValue(next === "1" ? 1 : 0)} />
          <Choice label="Initial Q" value={String(stored)} options={[{ id: "0", label: "0" }, { id: "1", label: "1" }]} onChange={(next) => setStored(next === "1" ? 1 : 0)} />
          <Slider label="Driver strength" value={strength} min={0.2} max={2} step={0.1} text={strength.toFixed(1)} onChange={setStrength} />
          <Slider label="Cell strength" value={cell} min={0.4} max={2} step={0.1} text={cell.toFixed(1)} onChange={setCell} />
          <Slider label="Wordline duration" value={pulse} min={0.4} max={3} step={0.2} text={pulse.toFixed(1)} onChange={setPulse} />
        </>
      }
      stage={<Wave traces={[
        { name: "WL", color: "#fbbf24", values: wave.wl, min: 0, max: 1 },
        { name: "BL", color: "#22d3ee", values: wave.bl, min: 0, max: 1 },
        { name: "BLB", color: "#38bdf8", values: wave.blb, min: 0, max: 1 },
        { name: "Q", color: "#34d399", values: wave.q, min: 0, max: 1 },
      ]} />}
      readouts={
        <>
          <Measure label="Final Q" value={`${wave.final}`} />
          <Badge tone={wave.success ? "on" : "bad"}>{wave.success ? "Write completed" : "Driver too weak or pulse too short"}</Badge>
          <Observe change="Write the opposite bit, then drop driver strength or shorten the wordline." see="Q flips only while the driver is strong enough and the pulse lasts at least one unit." why="The access devices must overpower the cell's own feedback." experiment="Write 1 into a cell that already holds 0 at strength 0.3." takeaway="A failed write leaves the stored bit alone." />
        </>
      }
    />
  );
}

export function SenseAmpLab() {
  const [delta, setDelta] = useState(40);
  const [offset, setOffset] = useState(5);
  const [noise, setNoise] = useState(8);
  const sense = senseAmplifier(delta, offset, noise);
  const height = Math.max(4, Math.min(70, Math.abs(delta) / 2));
  return (
    <VlsiGrid
      controls={
        <>
          <Slider label="Differential" value={delta} min={-80} max={80} step={2} text={`${delta.toFixed(0)} mV`} onChange={setDelta} />
          <Slider label="Offset" value={offset} min={0} max={40} step={1} text={`${offset.toFixed(0)} mV`} onChange={setOffset} />
          <Slider label="Noise" value={noise} min={0} max={30} step={1} text={`${noise.toFixed(0)} mV`} onChange={setNoise} />
        </>
      }
      stage={
        <svg className="vlsi-layout" viewBox="0 0 320 180" role="img" aria-label="Latch sense amplifier resolving a small differential">
          <rect x="40" y={90 - height} width="28" height={height} fill="#22d3ee" />
          <rect x="78" y="90" width="28" height={height} fill="#38bdf8" />
          <text x="36" y="160" fill="#94a3b8">BL − BLB</text>
          <rect x="180" y={sense.bit ? 30 : 100} width="80" height="40" fill={sense.resolved ? "#34d399" : "#fbbf24"} />
          <text x="196" y={sense.bit ? 54 : 124} fill="#111827">{sense.resolved ? `OUT ${sense.bit}` : "Unresolved"}</text>
        </svg>
      }
      readouts={
        <>
          <Measure label="Resolution time" value={`${sense.time.toFixed(2)} ns`} />
          <Measure label="Output" value={sense.resolved ? `${sense.bit}` : "X"} />
          <Badge tone={sense.resolved ? "on" : "warn"}>{sense.resolved ? "Full level" : "Offset or noise hides the bit"}</Badge>
          <Observe change="Shrink the differential, then add offset and noise." see="Resolution time grows, and a tiny difference becomes unresolved." why="The latch amplifies BL minus BLB only when that difference clears offset and noise." experiment="Set +40 mV with no offset, then flip the sign." takeaway="A positive differential resolves to 1. A negative one resolves to 0." />
        </>
      }
    />
  );
}

export function DramCellLab() {
  const [charge, setCharge] = useState(100);
  const [stored, setStored] = useState<0 | 1>(1);
  const [leak, setLeak] = useState(8);
  const [op, setOp] = useState<"hold" | "read" | "refresh" | "write0" | "write1">("hold");
  const step = dramCycle(charge, stored, leak, op);
  const sensed = senseDram(decayCharge(charge, leak), stored);
  return (
    <VlsiGrid
      controls={
        <>
          <Slider label="Stored charge" value={charge} min={0} max={100} step={1} text={`${charge.toFixed(0)} %`} onChange={setCharge} />
          <Slider label="Leakage" value={leak} min={0} max={30} step={1} text={`${leak.toFixed(0)}`} onChange={setLeak} />
          <Choice label="Operation" value={op} options={[{ id: "hold", label: "Hold" }, { id: "read", label: "Read" }, { id: "refresh", label: "Refresh" }, { id: "write1", label: "Write 1" }, { id: "write0", label: "Write 0" }]} onChange={setOp} />
          <Choice label="Stored bit" value={String(stored)} options={[{ id: "0", label: "0" }, { id: "1", label: "1" }]} onChange={(value) => setStored(value === "1" ? 1 : 0)} />
        </>
      }
      stage={
        <svg className="vlsi-layout" viewBox="0 0 320 180" role="img" aria-label="DRAM 1T1C cell charge">
          <rect x="70" y="40" width="40" height="70" fill="none" stroke="#e2e8f0" />
          <rect x="76" y={104 - step.charge * 0.58} width="28" height={step.charge * 0.58} fill="#22d3ee" />
          <text x="140" y="80" fill="#e2e8f0">Access transistor</text>
          <text x="140" y="110" fill="#94a3b8">Sense {sensed.bit} {sensed.reliable ? "reliable" : "marginal"}</text>
        </svg>
      }
      readouts={
        <>
          <Measure label="Charge after step" value={`${step.charge.toFixed(0)} %`} />
          <Measure label="Sensed bit" value={`${step.bit}`} />
          <Badge tone={step.reliable ? "on" : "warn"}>{step.reliable ? "Sense is reliable" : "Below the sense margin"}</Badge>
          <Observe change="Hold the cell and raise leakage, then read or refresh." see="Charge falls during hold. Read and refresh restore it from the sensed bit." why="This screen calls the existing decay, sense, and restore functions. The read is destructive, so the cell is written back." experiment="Drop charge below the sense margin and read a stored 1." takeaway="The Memory studio still runs the original DRAM lab. This view does not replace it." />
        </>
      }
    />
  );
}

export function MemoryDecoderLab() {
  const [address, setAddress] = useState(21);
  const [rows, setRows] = useState(8);
  const cols = 8;
  const decoded = decodeMemory(address, rows, cols);
  return (
    <VlsiGrid
      controls={
        <>
          <Slider label="Address" value={address} min={0} max={rows * cols - 1} step={1} text={`${address}`} onChange={setAddress} />
          <Choice label="Array" value={String(rows)} options={[{ id: "8", label: "8×8" }, { id: "16", label: "16×8" }]} onChange={(value) => setRows(value === "16" ? 16 : 8)} />
        </>
      }
      stage={
        <svg className="vlsi-layout" viewBox="0 0 320 200" role="img" aria-label="Row and column decoder">
          {Array.from({ length: rows }, (_, index) => (
            <rect key={index} x="20" y={12 + index * (rows === 16 ? 11 : 22)} width="90" height={rows === 16 ? 8 : 16} fill={index === decoded.row ? "#22d3ee" : "#1e293b"} />
          ))}
          <text x="130" y="40" fill="#e2e8f0">AND of row bits {decoded.rowBits}</text>
          <text x="130" y="70" fill="#e2e8f0">Column mux {decoded.colBits}</text>
          <text x="130" y="110" fill="#94a3b8">One row is high</text>
        </svg>
      }
      readouts={
        <>
          <Measure label="Active rows" value={`${decoded.activeRows}`} />
          <Measure label="Selected row" value={`${decoded.row}`} />
          <Measure label="Selected column" value={`${decoded.col}`} />
          <Observe change="Change the address, then switch between 8×8 and 16×8." see="Exactly one row lights. The column mux follows the low bits." why="The row decoder is one-hot. Its small realization is an AND of the row bits." experiment="Pick an address whose row is 0 and one whose row is last." takeaway="One valid address activates one wordline." />
        </>
      }
    />
  );
}

export function NonvolatileLab() {
  const [kind, setKind] = useState<"rom" | "eeprom" | "nor" | "nand">("rom");
  const [cell, setCell] = useState<"slc" | "mlc" | "tlc" | "qlc">("slc");
  const view = nonvolatileView(kind, cell);
  return (
    <VlsiGrid
      controls={
        <>
          <Choice label="Cell" value={kind} options={[{ id: "rom", label: "ROM" }, { id: "eeprom", label: "EEPROM" }, { id: "nor", label: "NOR Flash" }, { id: "nand", label: "NAND Flash" }]} onChange={setKind} />
          <Choice label="Flash levels" value={cell} options={[{ id: "slc", label: "SLC" }, { id: "mlc", label: "MLC" }, { id: "tlc", label: "TLC" }, { id: "qlc", label: "QLC" }]} onChange={setCell} />
        </>
      }
      stage={
        <svg className="vlsi-layout" viewBox="0 0 320 180" role="img" aria-label="Nonvolatile cell structure">
          <rect x="80" y="40" width="160" height="28" fill="#334155" />
          <rect x="100" y="78" width="120" height="16" fill={view.programOk ? "#34d399" : "#fb7185"} />
          <text x="110" y="90" fill="#111827">{view.levels} levels</text>
          <text x="70" y="140" fill="#e2e8f0">{view.title}</text>
        </svg>
      }
      readouts={
        <>
          <Measure label="Program" value={view.program} />
          <Measure label="Erase" value={view.erase} />
          <Measure label="Read" value={view.read} />
          <Badge tone={view.programOk ? "on" : "bad"}>{view.programOk ? "Program allowed" : "Erase required first"}</Badge>
          <Observe change="Select ROM, EEPROM, NOR, and NAND, then change SLC through QLC." see="Program, erase, and the level count change with the cell. NAND reports that erase is required." why="ROM rejects writes. EEPROM rewrites a byte. Flash program uses the existing erase-before-program rule." experiment="Leave NAND selected and read the program badge." takeaway="SLC through QLC counts threshold levels. It is not a device-physics solver. The Memory studio still owns the original labs." />
        </>
      }
    />
  );
}
