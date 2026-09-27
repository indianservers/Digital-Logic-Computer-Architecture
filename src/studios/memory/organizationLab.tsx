import { useEffect, useMemo, useState } from "react";
import { capacityFromPins, chipNotation, depthChips, formatBytes, formatHex, interleaveBank, toBinary, totalChips, widthChips } from "../../engines/memory/fundamentals";
import { Field, LabGuide } from "./guide";

const CHIPS = [
  { locations: 1024, width: 4, label: "1K × 4" },
  { locations: 1024, width: 8, label: "1K × 8" },
  { locations: 2048, width: 8, label: "2K × 8" },
  { locations: 4096, width: 8, label: "4K × 8" },
];

const TARGETS = [
  { locations: 2048, width: 8, label: "2K × 8 from 1K × 8" },
  { locations: 1024, width: 8, label: "1K × 8 from 1K × 4" },
  { locations: 4096, width: 16, label: "4K × 16 from 2K × 8" },
];

export function OrganizationLab() {
  const [chipIndex, setChipIndex] = useState(1);
  const [targetIndex, setTargetIndex] = useState(0);
  const [addrPins, setAddrPins] = useState(10);
  const [dataPins, setDataPins] = useState(8);
  const [select, setSelect] = useState(0);
  const [mode, setMode] = useState<"flat" | "interleave">("interleave");
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const chip = CHIPS[chipIndex] ?? CHIPS[1]!;
  const target = TARGETS[targetIndex] ?? TARGETS[0]!;
  const wide = widthChips(target.width, chip.width);
  const deep = depthChips(target.locations, chip.locations);
  const count = totalChips(wide, deep);
  const pins = capacityFromPins(addrPins, dataPins);
  const selectBits = Math.max(1, Math.ceil(Math.log2(Math.max(2, deep))));
  const banks = useMemo(() => Array.from({ length: 8 }, (_, address) => mode === "interleave" ? interleaveBank(address, 4) : Math.floor(address / 2)), [mode]);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setCursor((value) => value + 1), 700);
    return () => window.clearInterval(timer);
  }, [playing]);

  function reset() {
    setChipIndex(1);
    setTargetIndex(0);
    setAddrPins(10);
    setDataPins(8);
    setSelect(0);
    setMode("interleave");
    setCursor(0);
    setPlaying(false);
  }

  const active = playing ? cursor % count : select % Math.max(1, count);

  return (
    <div>
      <LabGuide
        aim="Build a wider or deeper memory from smaller chips and see which chip select turns on."
        concept="Width expansion shares the address and concatenates data pins. Depth expansion decodes extra address bits into chip selects."
        change={["Target system", "Chip type", "High address bits", "Interleaving", "Pin counts"]}
        steps={["Choose 1K × 8 from 1K × 4 and count two chips.", "Choose 2K × 8 from 1K × 8 and toggle the high bit.", "Step the interleave demo."]}
        observe={["Data slices stay on different chips when the word gets wider.", "Only one chip select is high in a depth expansion.", "Low-order interleave sends 0,1,2,3 to four banks."]}
        formula="Width chips = required width / chip width. Depth chips = required locations / chip locations. Total = width × depth."
      />
      <div className="memx-lab">
        <section className="lgx-card">
          <h3>Build a Memory System</h3>
          <p className="tiny">Available chips</p>
          <div className="fsmx-quick">
            {CHIPS.map((item, index) => <button key={item.label} type="button" className={index === chipIndex ? "on" : ""} onClick={() => setChipIndex(index)}>{item.label}</button>)}
          </div>
          <Field label="Target">
            <select aria-label="Target memory" value={targetIndex} onChange={(event) => setTargetIndex(Number(event.target.value))}>
              {TARGETS.map((item, index) => <option key={item.label} value={index}>{item.label}</option>)}
            </select>
          </Field>
          <p><span>Chips required</span><b>{count}</b></p>
          <p><span>Width factor</span><b>{wide}</b></p>
          <p><span>Depth factor</span><b>{deep}</b></p>
          <div className="memx-chips">
            {Array.from({ length: Math.min(8, Math.max(1, count)) }, (_, index) => (
              <div key={index} className={index === active ? "memx-chip on" : "memx-chip"}>
                <b>{chip.label}</b>
                <small>A{addrPins - 1}…A0</small>
                <small>D{Math.min(chip.width, target.width) - 1}…D0</small>
                <small>CS {index === active ? "1" : "0"} · OE · WE</small>
              </div>
            ))}
          </div>
          <p className="tiny">{wide > 1 ? `Chip slices share the address. Each chip drives ${chip.width} data bits.` : "Every chip sees the same data width."} {deep > 1 ? "A high address bit chooses the chip." : "One depth row is enough."}</p>
        </section>
        <section className="lgx-card">
          <h3>Decoder Logic</h3>
          <div className="memx-bits">
            {toBinary(select, selectBits).split("").map((bit, index) => (
              <button key={index} type="button" className={bit === "1" ? "memx-bit on" : "memx-bit"} onClick={() => setSelect(select ^ (1 << (selectBits - 1 - index)))}>
                <small>A{selectBits - 1 - index}</small>{bit}
              </button>
            ))}
          </div>
          <p>Select value {select & ((1 << selectBits) - 1)} enables chip {select % Math.max(1, count)}.</p>
          <h3>Interleaving</h3>
          <div className="fsmx-quick">
            <button type="button" className={mode === "flat" ? "on" : ""} onClick={() => setMode("flat")}>Not interleaved</button>
            <button type="button" className={mode === "interleave" ? "on" : ""} onClick={() => setMode("interleave")}>Interleaved</button>
          </div>
          <div className="memx-controls">
            <button type="button" className="memx-read" onClick={() => setCursor((value) => value + 1)}>Step</button>
            <button type="button" className="fsmx-icon" onClick={() => setPlaying((value) => !value)}>{playing ? "Pause" : "Play"}</button>
          </div>
          <div className="memx-cells" style={{ gridTemplateColumns: "repeat(8, minmax(0, 1fr))" }}>
            {banks.map((bank, address) => (
              <button key={address} type="button" className={address === (cursor % 8) ? `mem-cell on bank${bank}` : `mem-cell bank${bank}`} onClick={() => setCursor(address)}>
                {address}<small>B{bank}</small>
              </button>
            ))}
          </div>
          <p className="tiny">{mode === "interleave" ? "Successive addresses land in different banks, so the next access can start while one bank is busy." : "Pairs of addresses stay in one bank. A burst waits on that bank."}</p>
        </section>
        <div className="memx-side">
          <section className="lgx-card">
            <h3>Organization</h3>
            <p><span>Target</span><b>{chipNotation(target.locations, target.width)}</b></p>
            <p><span>Locations</span><b>{target.locations}</b></p>
            <p><span>Word width</span><b>{target.width}</b></p>
            <p><span>Total bits</span><b>{target.locations * target.width}</b></p>
            <p><span>Bytes</span><b>{formatBytes((target.locations * target.width) / 8)}</b></p>
          </section>
          <section className="lgx-card">
            <h3>Chip Builder</h3>
            <Field label="Address pins"><input aria-label="Address pins" type="number" min={1} max={16} value={addrPins} onChange={(event) => setAddrPins(Math.max(1, Math.min(16, Number(event.target.value) || 1)))} /></Field>
            <Field label="Data pins"><input aria-label="Data pins" type="number" min={1} max={32} value={dataPins} onChange={(event) => setDataPins(Math.max(1, Math.min(32, Number(event.target.value) || 1)))} /></Field>
            <p>{chipNotation(pins.locations, dataPins)} · {pins.bits} bits · {formatBytes(pins.bytes)}</p>
            <p className="tiny">2^{addrPins} × {dataPins} = {pins.bits} bits. 1 KiB = 1024 bytes.</p>
            <p className="tiny">Selected chip {formatHex(active, 1)} · address bits {toBinary(active, selectBits)}.</p>
            <button type="button" className="fsmx-icon" onClick={reset}>Reset</button>
          </section>
        </div>
      </div>
    </div>
  );
}

