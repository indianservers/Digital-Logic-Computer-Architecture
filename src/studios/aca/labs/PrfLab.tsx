import { useMemo, useState } from "react";
import { ARCH, INITIAL_VALUES, PHYS_COUNT, PRF_PRESETS, abiName, runPrf, type PrfShot } from "../../../engines/aca/prf";
import { LabChrome, Toggle, Transport, usePlayback } from "./HazardLab";

const STEPS = ["1. Fetch / Decode", "2. Rename", "3. Update State", "4. Execute", "5. Commit"];

function hex(value: number) {
  return `0x${(value >>> 0).toString(16).padStart(8, "0").toUpperCase()}`;
}

function stepOf(phase: PrfShot["phase"]) {
  if (phase === "fetch") return 0;
  if (phase === "rename") return 1;
  if (phase === "execute") return 3;
  if (phase === "commit" || phase === "recover") return 4;
  return 0;
}

export function PrfLab() {
  const [presetId, setPresetId] = useState(PRF_PRESETS[0]?.id ?? "mixed");
  const [valuesOn, setValuesOn] = useState(true);
  const [ratOn, setRatOn] = useState(true);
  const [freeOn, setFreeOn] = useState(true);
  const [depsOn, setDepsOn] = useState(true);
  const [auto, setAuto] = useState(true);
  const preset = PRF_PRESETS.find((item) => item.id === presetId) ?? PRF_PRESETS[0];
  const result = useMemo(() => runPrf(preset?.ops ?? [], preset?.config), [preset]);
  const play = usePlayback(Math.max(0, result.shots.length - 1));
  if (!preset) return null;
  const index = Math.min(play.cycle, result.shots.length - 1);
  const shot = result.shots[index];
  const previous = result.shots[index - 1];
  if (!shot) return null;
  const focus = shot.focus == null ? null : preset.ops[shot.focus];
  const row = shot.focus == null ? null : result.rows[shot.focus];
  const step = stepOf(shot.phase);
  const beforeFree = previous?.free ?? [8, 9, 10, 11, 12, 13, 14, 15];
  const justAllocated = beforeFree.filter((id) => !shot.free.includes(id));
  const gain = result.cycles === 0 ? 1 : result.serialCycles / result.cycles;
  const committed = shot.commitMap;
  return (
    <LabChrome lab="physical-register-file" kicker="Labs > Lab 13" title="Lab 13 — Physical Register File & Rename Map" subtitle="Learn how architectural registers map to physical registers in modern out-of-order processors." badge="RISC-V (5-Stage Pipeline)">
      <div className="vl-cards three">
        <article><h2>Learning Objective</h2><p>Understand how register renaming eliminates false dependencies, how a rename map (RAT) works, and how a free list manages physical registers.</p></article>
        <article><h2>Experiment Status</h2><p>{play.cycle === 0 ? "Ready to run" : shot.event}</p><p>Rename stalls {shot.renameStalls}. Registers reclaimed {shot.reclaimed}.{shot.recovered ? " RAT restored from the commit map." : ""}</p></article>
        <article><h2>Register renaming</h2><p>Register renaming turns dependencies into opportunities for parallel execution. Architectural names stay in the program. Physical registers remove WAR and WAW.</p></article>
      </div>
      <div className="vl-cards four">
        <article>
          <h2>Architectural Registers (RISC-V)</h2>
          <div className="vl-scroll-y">
            <table>
              <thead><tr><th>Reg</th><th>Name</th><th>Current Value (Hex)</th></tr></thead>
              <tbody>
                {ARCH.map((name, arch) => {
                  const mapped = committed.find((entry) => entry.arch === name);
                  const phys = shot.phys.find((item) => item.id === mapped?.phys);
                  const initial = INITIAL_VALUES[arch] ?? 0;
                  return (
                    <tr key={name} className={ratOn && row?.text.includes(name) ? "on" : ""}>
                      <td>{arch}</td>
                      <td>{abiName(name)}{name === "x0" ? " fixed" : ""}</td>
                      <td>{valuesOn ? hex(phys?.value ?? initial) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p>Architectural registers are programmer-visible names. The values shown are the committed mapping.</p>
        </article>
        <article>
          <header><h2>Physical Register File (PRF)</h2><b>Entries: {PHYS_COUNT} (P0–P{PHYS_COUNT - 1})</b></header>
          <div className="vl-scroll-y">
            <table>
              <thead><tr><th>P#</th><th>Value (Hex)</th><th>Busy</th><th>Tag / Owner</th></tr></thead>
              <tbody>
                {shot.phys.map((item) => (
                  <tr key={item.id} className={depsOn && row?.srcPhys.includes(item.id) ? "on" : ""}>
                    <td>P{item.id}{item.id === 0 ? " fixed" : ""}</td>
                    <td>{valuesOn ? hex(item.value) : "—"}</td>
                    <td className={item.busy ? "vl-bad" : "vl-ok"}>{item.busy ? "Yes" : "No"}</td>
                    <td>{item.ready ? item.owner : `${item.owner} pending`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="vl-legend"><i className="free" /> Free <i className="used" /> Busy until writeback</p>
        </article>
        <article>
          <h2>Rename Map Table (RAT)</h2>
          <table>
            <thead><tr><th>Arch Reg</th><th>Physical Reg (P#)</th></tr></thead>
            <tbody>
              {shot.rat.map((entry) => (
                <tr key={entry.arch} className={ratOn && focus?.dest === entry.arch && shot.phase === "rename" ? "on" : ""}>
                  <td>{entry.arch}</td>
                  <td>P{entry.phys}{entry.arch === "x0" ? " (fixed)" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
        <article>
          <header><h2>Free List</h2><b>Free Registers: {shot.free.length} / {PHYS_COUNT}</b></header>
          <div className="vl-bits">
            {shot.free.map((id) => <span key={id} className="free">P{id}</span>)}
          </div>
          <h2>Allocation / Release</h2>
          <p className="vl-ok">Free (Available) {shot.free.length}</p>
          <p className="vl-bad">Allocated (In Use) {PHYS_COUNT - shot.free.length}</p>
          <div className="vl-bits">
            {justAllocated.map((id) => <span key={id} className={freeOn ? "recent" : ""}>P{id}</span>)}
          </div>
          <p>{justAllocated.length ? `Just allocated ${justAllocated.map((id) => `P${id}`).join(", ")}.` : "No physical register was allocated this cycle."} A register returns here only when the instruction that replaced it commits.</p>
        </article>
      </div>
      <div className="vl-cards two">
        <article>
          <h2>Rename Operation (Step-by-Step)</h2>
          <div className="vl-steps">{STEPS.map((label, item) => <span key={label} className={item === step || (item === 2 && step === 1) ? "on" : ""}>{label}</span>)}</div>
          <p><b>Current Instruction (RISC-V)</b></p>
          <p>{focus?.text ?? "All instructions have been renamed."}</p>
          <p><b>Step: {STEPS[step]}</b></p>
          <p>{shot.event}</p>
          <div className="vl-bits">
            {focus?.srcs.map((reg, source) => <span key={reg}>rs{source + 1}: {reg} → P{row?.srcPhys[source] ?? "?"}</span>)}
            {focus?.dest ? <span className="busy">rd: {focus.dest} → P{row?.newPhys ?? "stall"}</span> : null}
          </div>
          <p>Sources were read before the destination mapping changed. Old mapping {row?.oldPhys == null ? "none" : `P${row.oldPhys}`}. New destination {row?.newPhys == null ? "not allocated" : `P${row.newPhys}`} stays not-ready until writeback.</p>
          <p>RAT before: {previous ? previous.rat.map((entry) => `${entry.arch}→P${entry.phys}`).join(" ") : "initial"}.</p>
          <p>RAT after: {shot.rat.map((entry) => `${entry.arch}→P${entry.phys}`).join(" ")}.</p>
          <p>Free list {beforeFree.length} → {shot.free.length}.</p>
        </article>
        <article>
          <header><h2>Commit / Retirement View (ROB)</h2><b>Entries: {shot.rob.length}</b></header>
          <table>
            <thead><tr><th>#</th><th>Instruction</th><th>Dest Arch</th><th>Dest P#</th><th>Status</th></tr></thead>
            <tbody>
              {shot.rob.map((entry) => (
                <tr key={entry.index} className={entry.index === shot.focus ? "on" : ""}>
                  <td>{entry.index + 1}</td>
                  <td>{entry.text}</td>
                  <td>{entry.dest}</td>
                  <td>{entry.destPhys}</td>
                  <td className={`tag ${entry.status}`}>{entry.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>Commit map: {committed.map((entry) => `${entry.arch}→P${entry.phys}`).join(" ")}. The old physical register is reclaimed only when this mapping commits.</p>
        </article>
      </div>
      <div className="vl-cards three">
        <article>
          <h2>Simulation Controls</h2>
          <Toggle on={valuesOn} label="Show Register Values" onChange={setValuesOn} />
          <Toggle on={ratOn} label="Show RAT Updates" onChange={setRatOn} />
          <Toggle on={freeOn} label="Show Free List Changes" onChange={setFreeOn} />
          <Toggle on={depsOn} label="Highlight Dependencies" onChange={setDepsOn} />
          <Toggle on={auto} label="Auto Run to Next Step" onChange={setAuto} />
          <select aria-label="Load example" value={preset.id} onChange={(event) => { setPresetId(event.target.value); play.reset(); }}>
            {PRF_PRESETS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </article>
        <article>
          <Transport
            playing={play.playing}
            onPlay={() => { if (!auto) { play.setCycle((value) => Math.min(result.shots.length - 1, value + 1)); return; } play.setPlaying((value) => !value); }}
            onStep={() => play.setCycle((value) => Math.min(result.shots.length - 1, value + 1))}
            onBack={() => play.setCycle((value) => Math.max(0, value - 1))} onReset={play.reset}
            speed={play.speed}
            onSpeed={play.setSpeed}
          />
        </article>
        <article>
          <h2>Results & Insights</h2>
          <div className="vl-metrics">
            <div><strong>{preset.ops.length}</strong><span>Instructions</span></div>
            <div><strong>{result.raw}</strong><span>True Dependencies</span></div>
            <div><strong>{result.falseDeps}</strong><span>Removed (False)</span></div>
            <div><strong>{gain.toFixed(1)}×</strong><span>Parallelism vs in-order</span></div>
          </div>
          <p>RAW stays a true dependence on the physical tag. WAR and WAW receive a new physical register, so the old reader or writer is not overwritten. An empty free list stalls rename instead of inventing another register.</p>
        </article>
      </div>
    </LabChrome>
  );
}
