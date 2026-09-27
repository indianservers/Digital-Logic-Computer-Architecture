import { useState } from "react";
import { CELL_STATES, chooseWearBlock, eraseBlockCells, flashProgramAllowed, formatHex, type FlashCell, type FlashKind } from "../../engines/memory/fundamentals";
import { Field, LabGuide } from "./guide";

const BLOCKS = 4;
const PAGES = 8;
const PAGE = 16;

export function FlashLab() {
  const [cells, setCells] = useState<number[]>(() => Array.from({ length: BLOCKS * PAGES * PAGE }, () => 0xff));
  const [counts, setCounts] = useState<number[]>(() => Array.from({ length: BLOCKS }, () => 0));
  const [block, setBlock] = useState(0);
  const [page, setPage] = useState(0);
  const [byte, setByte] = useState(0);
  const [data, setData] = useState("A5");
  const [kind, setKind] = useState<FlashKind>("nand");
  const [cellType, setCellType] = useState<FlashCell>("slc");
  const [leveling, setLeveling] = useState(false);
  const [plain, setPlain] = useState<number[]>(() => Array.from({ length: BLOCKS }, () => 0));
  const [rotated, setRotated] = useState<number[]>(() => Array.from({ length: BLOCKS }, () => 0));
  const [note, setNote] = useState("Erased cells read as 0xFF. Program them, or erase a block first.");
  const info = CELL_STATES[cellType];
  const pageStart = (block * PAGES + page) * PAGE;
  const index = pageStart + byte;
  const value = Number.parseInt(data, 16);

  function program() {
    if (Number.isNaN(value) || value < 0 || value > 255) { setNote("Data must be 00–FF."); return; }
    const current = cells[index] ?? 0xff;
    const check = flashProgramAllowed(current, value);
    if (!check.ok) { setNote(check.explain); return; }
    setCells((list) => list.map((item, slot) => slot === index ? value & 0xff : item));
    setNote(`Programmed 0x${formatHex(value, 2)} into block ${block}, page ${page}, byte ${byte}.`);
  }

  function erase() {
    const next = eraseBlockCells(cells, block, PAGES, PAGE);
    setCells(next.cells);
    setCounts((list) => list.map((count, slot) => slot === block ? count + 1 : count));
    setNote(`Block ${block} erased. Pages ${block * PAGES}–${block * PAGES + PAGES - 1} are 0xFF again.`);
  }

  function demoWrite() {
    setPlain((list) => list.map((count, slot) => slot === 0 ? count + 1 : count));
    setRotated((list) => {
      const target = chooseWearBlock(list, true, 0);
      return list.map((count, slot) => slot === target ? count + 1 : count);
    });
  }

  function reset() {
    setCells(Array.from({ length: BLOCKS * PAGES * PAGE }, () => 0xff));
    setCounts(Array.from({ length: BLOCKS }, () => 0));
    setBlock(0);
    setPage(0);
    setByte(0);
    setData("A5");
    setKind("nand");
    setCellType("slc");
    setLeveling(false);
    setPlain(Array.from({ length: BLOCKS }, () => 0));
    setRotated(Array.from({ length: BLOCKS }, () => 0));
    setNote("Erased cells read as 0xFF. Program them, or erase a block first.");
  }

  return (
    <div>
      <LabGuide
        aim="Program a page and see why a rewrite waits for a block erase."
        concept="NAND flash erases a whole block. A programmed cell is not freely overwritten like RAM."
        change={["Block", "Page", "Byte", "NAND or NOR", "Cell type", "Wear leveling"]}
        steps={["Program A5 into the selected byte.", "Program a different value and read the refusal.", "Erase the block, then program again."]}
        observe={["Erase highlights every page in the block.", "Wear leveling moves the next erase to the quieter block.", "SLC has 2 levels. QLC has 16."]}
        formula="Block size = pages × page bytes. Total chips are not needed here; the limit is erase grain."
      />
      <div className="memx-lab">
        <section className="lgx-card">
          <div className="lgx-card-bar">
            <h3>Flash Organization</h3>
            <div className="fsmx-quick">
              <button type="button" className={kind === "nand" ? "on" : ""} onClick={() => setKind("nand")}>NAND</button>
              <button type="button" className={kind === "nor" ? "on" : ""} onClick={() => setKind("nor")}>NOR</button>
            </div>
          </div>
          <div className="memx-tree">
            <b>Device</b>
            <div>{Array.from({ length: BLOCKS }, (_, item) => (
              <button key={item} type="button" className={item === block ? "on" : ""} onClick={() => setBlock(item)}>Block {item}<small>{counts[item] ?? 0} erases</small></button>
            ))}</div>
            <div>{Array.from({ length: PAGES }, (_, item) => (
              <button key={item} type="button" className={item === page ? "on" : ""} onClick={() => setPage(item)}>Page {item + 1}</button>
            ))}</div>
          </div>
          <p className="tiny">{kind === "nand" ? "NAND is page-oriented, dense storage. Reads and programs use a page. Erase uses a block." : "NOR emphasizes random read and execute-in-place. This model still erases by block."}</p>
          <div className="memx-controls">
            <Field label="Cell"><select aria-label="Flash cell type" value={cellType} onChange={(event) => setCellType(event.target.value as FlashCell)}>{(Object.keys(CELL_STATES) as FlashCell[]).map((id) => <option key={id} value={id}>{CELL_STATES[id].label}</option>)}</select></Field>
            <Field label="Byte"><input aria-label="Byte offset" type="number" min={0} max={15} value={byte} onChange={(event) => setByte(Math.max(0, Math.min(15, Number(event.target.value) || 0)))} /></Field>
            <Field label="Data"><input aria-label="Flash data" value={data} onChange={(event) => setData(event.target.value.toUpperCase())} /></Field>
          </div>
          <div className="memx-controls">
            <button type="button" className="memx-read" onClick={program}>Program</button>
            <button type="button" className="memx-erase" onClick={erase}>Erase Block</button>
            <button type="button" className="fsmx-icon" onClick={() => setNote(`Read 0x${formatHex(cells[index] ?? 0, 2)}.`)}>Read</button>
            <button type="button" className="fsmx-icon" onClick={reset}>Reset</button>
          </div>
          <p>{note}</p>
        </section>
        <section className="lgx-card">
          <h3>Page Data</h3>
          <div className="memx-cells">
            {Array.from({ length: PAGE }, (_, offset) => {
              const slot = pageStart + offset;
              return <button key={offset} type="button" className={offset === byte ? "mem-cell on" : "mem-cell"} onClick={() => setByte(offset)}>{formatHex(cells[slot] ?? 0xff, 2)}</button>;
            })}
          </div>
          <h3>Thresholds · {info.label}</h3>
          <p className="tiny">{info.bits} bits per cell · {info.levels} voltage states.</p>
          <div className="memx-levels">
            {Array.from({ length: info.levels }, (_, level) => <span key={level} style={{ height: `${12 + level * (48 / info.levels)}px` }}>{level}</span>)}
          </div>
        </section>
        <div className="memx-side">
          <section className="lgx-card">
            <h3>Block Erase</h3>
            {Array.from({ length: BLOCKS }, (_, item) => (
              <p key={item} className={item === block ? "on" : ""}>Block {item} · {counts[item] ?? 0} erases · {item === block ? "selected, every page returns to FF" : "untouched"}</p>
            ))}
          </section>
          <section className="lgx-card">
            <h3>Wear Leveling</h3>
            <div className="fsmx-quick">
              <button type="button" className={!leveling ? "on" : ""} onClick={() => setLeveling(false)}>No leveling</button>
              <button type="button" className={leveling ? "on" : ""} onClick={() => setLeveling(true)}>Basic rotation</button>
            </div>
            <button type="button" className="fsmx-icon" onClick={demoWrite}>Write same logical page</button>
            {(leveling ? rotated : plain).map((count, item) => (
              <p key={item}><span>Block {item}</span><b>{count}</b><span className="memx-meter"><span style={{ width: `${Math.min(100, count * 12)}%` }} /></span></p>
            ))}
            <p className="tiny">{leveling ? `Next erase targets block ${chooseWearBlock(rotated, true, 0)}.` : "Every write hits block 0."}</p>
          </section>
        </div>
      </div>
    </div>
  );
}
