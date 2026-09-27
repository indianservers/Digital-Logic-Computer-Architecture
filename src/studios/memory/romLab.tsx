import { useState } from "react";
import { formatHex, preloadCells, romRead, romRejectWrite, toBinary, type RomVariant } from "../../engines/memory/fundamentals";
import { Field, LabGuide } from "./guide";

const VARIANTS: Record<RomVariant, { title: string; program: string; erase: string; grain: string; use: string }> = {
  rom: { title: "Mask ROM", program: "Metal mask at the factory", erase: "Cannot erase", grain: "Whole chip", use: "High-volume firmware" },
  prom: { title: "PROM", program: "A fuse or antifuse, once", erase: "Cannot erase", grain: "Bit, once", use: "Small production runs" },
  eprom: { title: "EPROM", program: "Electrical program", erase: "Ultraviolet light, whole chip", grain: "Chip", use: "Development parts" },
  eeprom: { title: "EEPROM", program: "Electrical program", erase: "Electrical, per byte", grain: "Byte", use: "Configuration bytes" },
};

export function RomLab() {
  const [depth, setDepth] = useState(16);
  const [design, setDesign] = useState<number[]>(() => preloadCells("program", 64, 8));
  const [burned, setBurned] = useState<number[] | null>(() => preloadCells("program", 16, 8));
  const [address, setAddress] = useState(0);
  const [variant, setVariant] = useState<RomVariant>("rom");
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState("The burned pattern is read-only.");
  const cells = (burned ?? design).slice(0, depth);
  const read = romRead(cells, address);
  const info = VARIANTS[variant];
  const bits = toBinary(address, Math.ceil(Math.log2(depth)));
  const dataBits = toBinary(read.data, 8);
  const ascii = read.data >= 32 && read.data < 127 ? String.fromCharCode(read.data) : "—";

  function burn() {
    setBurned(design.slice(0, depth));
    setEditing(false);
    setNote("Pattern burned. The simulator is now read-only until you return to Design ROM.");
  }

  function reset() {
    const next = preloadCells("program", 64, 8);
    setDesign(next);
    setBurned(next.slice(0, 16));
    setDepth(16);
    setAddress(0);
    setVariant("rom");
    setEditing(false);
    setNote("The burned pattern is read-only.");
  }

  return (
    <div>
      <LabGuide
        aim="Select an address and watch the ROM matrix drive a fixed output byte."
        concept="A decoder raises one word line. Programmed links on that row create the data bits. Mask ROM is not electrically rewritable."
        change={["Address", "Depth", "Design bytes", "ROM variant"]}
        steps={["Click a row in the matrix.", "Edit the design row and press Generate ROM.", "Try a write and read the rejection."]}
        observe={["Only one word line is active.", "Output bits match the burned row.", "Variant text changes the erase story, not the matrix math."]}
        formula="Output byte = the programmed pattern on the selected word line."
      />
      <div className="memx-lab">
        <section className="lgx-card">
          <div className="lgx-card-bar">
            <h3>ROM Matrix ({depth} × 8)</h3>
            <Field label="Depth">
              <select aria-label="ROM depth" value={depth} onChange={(event) => { const next = Number(event.target.value); setDepth(next); setAddress(0); setBurned(design.slice(0, next)); }}>
                {[16, 32, 64].map((value) => <option key={value} value={value}>{value}×8</option>)}
              </select>
            </Field>
          </div>
          <div className="memx-rom">
            <div className="memx-decoder"><b>Address decoder</b>{bits}</div>
            <div className="memx-links">
              {cells.map((value, row) => (
                <button key={row} type="button" className={row === address ? "on" : ""} onClick={() => setAddress(row)}>
                  {toBinary(value, 8).split("").map((bit, col) => <i key={col} className={bit === "1" ? "link on" : "link"} />)}
                </button>
              ))}
            </div>
          </div>
          <p className="tiny">Word line {address} is high. Dots are programmed connections.</p>
        </section>
        <section className="lgx-card">
          <h3>Address / Output</h3>
          <p><span>Address</span><b>0x{formatHex(address, 2)}</b></p>
          <p><span>Binary</span><b className="mono">{bits}</b></p>
          <p><span>Output</span><b>0x{formatHex(read.data, 2)}</b></p>
          <p><span>Data binary</span><b className="mono">{dataBits}</b></p>
          <p><span>ASCII</span><b>{ascii}</b></p>
          <button type="button" className="memx-write" onClick={() => setNote(romRejectWrite(cells, address).explain)}>Write</button>
          <p>{note}</p>
          <h3>ROM Contents</h3>
          <div className="memx-cells">
            {cells.slice(0, 16).map((value, index) => (
              <button key={index} type="button" className={index === address ? "mem-cell on" : "mem-cell"} onClick={() => setAddress(index)}>{formatHex(value, 2)}</button>
            ))}
          </div>
        </section>
        <div className="memx-side">
          <section className="lgx-card">
            <Field label="ROM variant">
              <select aria-label="ROM variant" value={variant} onChange={(event) => setVariant(event.target.value as RomVariant)}>
                {(Object.keys(VARIANTS) as RomVariant[]).map((id) => <option key={id} value={id}>{VARIANTS[id].title}</option>)}
              </select>
            </Field>
            <p><span>Programming</span><b>{info.program}</b></p>
            <p><span>Erasure</span><b>{info.erase}</b></p>
            <p><span>Grain</span><b>{info.grain}</b></p>
            <p><span>Typical use</span><b>{info.use}</b></p>
            {variant === "eprom" ? <p className="tiny">UV erase clears every cell on the chip, not one byte.</p> : null}
            {variant === "prom" ? <p className="tiny">A fuse opens or an antifuse closes. That link is not rewritten.</p> : null}
          </section>
          <section className="lgx-card">
            <h3>Design ROM</h3>
            <p className="tiny">{editing ? "Edit the bytes, then burn." : "Burned image is locked."}</p>
            <div className="memx-controls">
              {design.slice(0, 8).map((value, index) => (
                <input key={index} aria-label={`Design byte ${index}`} value={formatHex(value, 2)} disabled={!editing} onChange={(event) => {
                  const parsed = Number.parseInt(event.target.value, 16);
                  if (Number.isNaN(parsed)) return;
                  setDesign((current) => current.map((cell, slot) => slot === index ? parsed & 0xff : cell));
                }} />
              ))}
            </div>
            <div className="memx-controls">
              <button type="button" className="fsmx-icon" onClick={() => setEditing(true)}>Design</button>
              <button type="button" className="memx-read" onClick={burn}>Generate ROM</button>
              <button type="button" className="fsmx-icon" onClick={reset}>Reset</button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
