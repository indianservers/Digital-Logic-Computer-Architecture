import { useSimulatorCapture } from "../../layout/SimulatorCapture";
import { useState } from "react";
import { applyBusWrite, busValue, mask16 } from "../../engines/isa/rtlLab";
import { Mark } from "./ui";

const FRESH = [0, 12, 25, 0, 0, 0, 0, 0];

export function BusPanel({ explain }: { explain: boolean }) {
  useSimulatorCapture("studios/rtl/bus.tsx:BusPanel", () => ({ regs, source, second, dest, hover, note }), "9d8286f380cb");

  const [regs, setRegs] = useState(FRESH);
  const [source, setSource] = useState(1);
  const [second, setSecond] = useState<number | null>(null);
  const [dest, setDest] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [note, setNote] = useState("R1 is the only driver. The bus carries 12, and no register has captured it yet.");
  const drivers = [0, 1, 2, 3, 4, 5, 6, 7].map((index) => ({
    name: `R${index}`,
    enabled: index === source || index === second,
    value: regs[index] ?? 0,
  }));
  const bus = busValue(drivers);
  const conflict = bus.contention;

  function drive() {
    const result = applyBusWrite(regs, dest, bus);
    setRegs(result.regs);
    setNote(result.note);
  }

  return (
    <div className="rtx-bus">
      <section className="rtx-card rtx-bus-card">
        <h2><Mark kind="book"/> The shared bus</h2>
        <p>A common bus connects all registers, the ALU, and memory. Only one unit may drive the bus at a time.</p>
        {explain ? <p className="rtx-warn">{conflict ? "BUS CONFLICT. Two drivers are on. The value is X, not a blend of the numbers." : "If multiple units drive the bus, it causes a conflict. Use only one source at a time."}</p> : null}
        <div className="rtx-agents">
          {[0, 1, 2, 3].map((index) => (
            <button key={index} type="button" className={agentClass(index, source, second, hover)} title={`R${index} = ${regs[index] ?? 0}. ${index === source || index === second ? "Driver on." : "Hi-Z, not driving."}`} onMouseEnter={() => setHover(index)} onMouseLeave={() => setHover(null)} onClick={() => {setSource(index);setNote("");}}>
              <strong><i/>R{index}</strong><span>{regs[index] ?? 0}</span>
            </button>
          ))}
        </div>
        <div className={`rtx-rail ${conflict ? "bad" : "live"}`} title={bus.explain}>Shared bus · {conflict ? "X" : bus.value === "Z" ? "Hi-Z" : bus.value}</div>
        <div className="rtx-sinks">
          <div className="mem" title="Memory can sit on the bus. This micro-operation does not enable a memory load."><Mark kind="memory"/><strong>Memory</strong><span>—</span></div>
          <div className="alu" title="The ALU result can drive the bus on the Transfer tab."><Mark kind="transfer"/><strong>ALU</strong><span>—</span></div>
          <button type="button" className={dest === 4 ? "on" : ""} title="R4 captures the bus only when it is the selected destination." onClick={() => setDest(4)}><strong><i/>R4</strong><span>{regs[4] ?? 0}</span></button>
        </div>
      </section>
      <section className="rtx-card rtx-drive">
        <div className="rtx-drive-head"><h2><Mark kind="play"/> Drive the bus</h2><p>Choose a source register to drive the bus. Optionally select another unit to drive (to create a conflict) and a destination to load.</p></div>
        <label>Source (drive bus)
          <select aria-label="Bus source" value={source} onChange={(event) => {setSource(Number(event.target.value));setNote("");}}>
            {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => <option key={index} value={index}>R{index}</option>)}
          </select>
        </label>
        <label>Also drive (create conflict)
          <select aria-label="Second driver" value={second ?? ""} onChange={(event) => {setSecond(event.target.value === "" ? null : Number(event.target.value));setNote("");}}>
            <option value="">None</option>
            {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => <option key={index} value={index}>R{index}</option>)}
          </select>
        </label>
        <label>Load into (destination)
          <select aria-label="Destination load" value={dest ?? ""} onChange={(event) => {setDest(event.target.value === "" ? null : Number(event.target.value));setNote("");}}>
            <option value="">None</option>
            {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => <option key={index} value={index}>R{index}</option>)}
          </select>
        </label>

        <button type="button" className="rtx-go" onClick={drive}><Mark kind="play"/><span>Drive bus<small>Place R{source} value on the bus</small></span></button>
        <button type="button" className="rtx-quiet" onClick={() => { setSecond(null); setNote("One driver remains. The bus can carry a value again."); }}><Mark kind="gear"/><span>Resolve conflict<small>Disable the extra driver</small></span></button>
        <button type="button" className="rtx-quiet" onClick={() => { setRegs(FRESH); setSource(1); setSecond(null); setDest(null); setNote("R1 is the only driver. The bus carries 12, and no register has captured it yet."); }}><Mark kind="reset"/><span>Reset<small>Clear and start again</small></span></button>
        <div className="rtx-bus-summary"><div className={conflict ? "rtx-bad" : "rtx-bus-value"}><Mark kind="bus"/><div><b>Bus value</b><strong>{conflict ? "X" : String(bus.value)}</strong></div><small>Current value on the shared bus</small></div><div className="rtx-source-values"><b>Source register values</b><div>{regs.slice(0,5).map((value,index)=><label key={index}><span><i/>R{index}</span><input aria-label={`Bus register R${index}`} value={value} onChange={event=>{const n=Number(event.target.value);if(Number.isFinite(n))setRegs(current=>current.map((v,i)=>i===index?mask16(n):v))}}/></label>)}</div></div></div>
        {explain ? <p className="rtx-note">{note} {bus.explain} Driving the bus does not write a register until Load into is set.</p> : null}
      </section>
    </div>
  );
}

function agentClass(index: number, source: number, second: number | null, hover: number | null): string {
  const names = [index === source ? "drive" : "", index === second ? "clash" : "", hover === index ? "hover" : ""];
  return names.filter(Boolean).join(" ");
}
