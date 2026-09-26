import { useMemo, useState } from "react";
import { LINE_ADDRESSES, MSI_PRESETS, runCoherence, type Access, type LineState, type Protocol } from "../../../engines/aca/coherenceLab";
import { LabChrome, Toggle, Transport, usePlayback } from "./HazardLab";

const CORE_COLOR = ["#dbeafe", "#dcfce7", "#ffedd5", "#f3e8ff"];
const NODES: Record<Protocol, LineState[]> = { msi: ["M", "S", "I"], mesi: ["M", "E", "S", "I"], moesi: ["M", "O", "E", "S", "I"] };

export function MesiLab() {
  const [protocol, setProtocol] = useState<Protocol>("mesi");
  const [cores, setCores] = useState(4);
  const [presetId, setPresetId] = useState(MSI_PRESETS[2]?.id ?? "producer");
  const [accesses, setAccesses] = useState<Access[]>(MSI_PRESETS[2]?.accesses ?? []);
  const [seed, setSeed] = useState<Record<number, number>>(MSI_PRESETS[2]?.seed ?? {});
  const [actor, setActor] = useState(1);
  const [operation, setOperation] = useState<"read" | "write">("read");
  const [line, setLine] = useState(0x1000);
  const [written, setWritten] = useState(20);
  const [traffic, setTraffic] = useState(true);
  const [highlight, setHighlight] = useState(true);
  const [auto, setAuto] = useState(true);
  const result = useMemo(() => runCoherence(protocol, cores, accesses.filter((item) => item.core < cores), seed), [protocol, cores, accesses, seed]);
  const play = usePlayback(Math.max(0, result.shots.length - 1));
  const shot = result.shots[Math.min(play.cycle, result.shots.length - 1)];
  if (!shot) return null;
  const addresses = [...new Set([...LINE_ADDRESSES, ...shot.lines.map((item) => item.address)])].sort((left, right) => left - right);
  const selected = shot.lines.find((item) => item.address === line) ?? shot.lines[0];
  const present = new Set((selected?.copies ?? []).map((copy) => copy.state));
  const last = shot.log.at(-1);
  const add = () => {
    const next = { core: actor, op: operation, address: line, value: operation === "write" ? written : undefined };
    setAccesses((current) => [...current, next]);
    play.setCycle(accesses.length + 1);
  };
  return (
    <LabChrome lab="mesi" kicker="Labs > Lab 17" title="Lab 17 — MSI & MESI Coherence Simulator" subtitle="Learn cache coherence through read miss, write miss, upgrade, and line-state transitions across multiple cores." badge="RISC-V (5-Stage Pipeline)">
      <div className="vl-cards three">
        <article><h2>Learning Objective</h2><p>Understand how MSI and MESI keep one cache line coherent: read misses, write misses, upgrades, invalidations, and the Exclusive state that lets a write stay off the bus.</p></article>
        <article><h2>Experiment Status</h2><p>{play.cycle === 0 ? "Ready to run" : shot.event}</p><p>{protocol === "msi" ? "MSI fills a cold line as Shared." : "MESI fills a cold line as Exclusive, so the first write is silent."} A Modified line is written back when another core reads it.</p></article>
        <article><h2>Coherence</h2><p>Coherence means every core that reads a line observes the newest value held by a Modified copy, not a stale memory word.</p></article>
      </div>
      <div className="vl-cards three">
        <article>
          <h2>System Configuration</h2>
          <div className="vl-pills">
            <button type="button" className={protocol === "msi" ? "on" : ""} onClick={() => { setProtocol("msi"); play.reset(); }}>MSI</button>
            <button type="button" className={protocol === "mesi" ? "on" : ""} onClick={() => { setProtocol("mesi"); play.reset(); }}>MESI</button>
          </div>
          <label>Number of cores
            <select aria-label="Number of cores" value={cores} onChange={(event) => { setCores(Number(event.target.value)); play.reset(); }}>
              <option value={2}>2 cores</option>
              <option value={4}>4 cores</option>
            </select>
          </label>
          <p>Tracked lines: {LINE_ADDRESSES.map((item) => `0x${item.toString(16)}`).join(", ")}. Each simulated line is one 64-byte block.</p>
          <select aria-label="Load example" value={presetId} onChange={(event) => {
            const next = MSI_PRESETS.find((item) => item.id === event.target.value);
            setPresetId(event.target.value);
            if (next) { setAccesses(next.accesses); setSeed(next.seed ?? {}); setLine(next.accesses[0]?.address ?? line); }
            play.reset();
          }}>
            {MSI_PRESETS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </article>
        <article>
          <h2>Multicore Cache Coherence System</h2>
          <div className="vl-cores">
            {Array.from({ length: cores }, (_, core) => {
              const copy = selected?.copies[core];
              return (
                <div key={core} style={{ background: CORE_COLOR[core] }}>
                  <b>Core {core}</b>
                  <span>Private cache</span>
                  <span className={`cst ${copy?.state ?? "I"}`}>{copy?.state ?? "I"}</span>
                  <small>{copy && copy.state !== "I" ? `0x${copy.value.toString(16)}` : "—"}</small>
                </div>
              );
            })}
          </div>
          <p>Coherence interconnect (bus). {traffic ? (last ? `${last.bus}: ${last.detail}` : "No bus transaction yet.") : "Traffic hidden."}</p>
          <p>Shared memory {selected ? `0x${selected.address.toString(16)} = 0x${selected.memory.toString(16)}` : "empty"}{selected?.stale ? " (stale until the next writeback)" : ""}.</p>
        </article>
        <article>
          <h2>Cache Line State Diagram</h2>
          <div className="vl-pills">
            {NODES[protocol].map((state) => <span key={state} className={`cst ${state}`} style={{ outline: present.has(state) && highlight ? "3px solid #0f172a" : undefined }}>{state}</span>)}
          </div>
          <p>{protocol === "msi" ? "MSI: Modified, Shared, Invalid. A cold read becomes Shared." : "MESI adds Exclusive. A sole clean copy can take a silent write to Modified."}</p>
          <p>{last ? `Last edge ${last.from} → ${last.to} on ${last.bus}.` : "No transition yet."}</p>
          <svg viewBox="0 0 220 90" role="img" aria-label={`${protocol} state diagram`}>
            {NODES[protocol].map((state, index) => {
              const x = 30 + index * (160 / Math.max(1, NODES[protocol].length - 1));
              return <g key={state}><circle cx={x} cy={40} r={16} fill={present.has(state) ? "#dbeafe" : "#fff"} stroke={last?.to === state ? "#2563eb" : "#94a3b8"} strokeWidth={last?.to === state ? 3 : 1} /><text x={x} y={44} textAnchor="middle" fontSize="11">{state}</text></g>;
            })}
          </svg>
        </article>
      </div>
      <div className="vl-cards three">
        <article>
          <h2>Cache Line States (Live View)</h2>
          <div className="vl-scroll">
            <table>
              <thead><tr><th>Core</th>{addresses.map((address) => <th key={address}>0x{address.toString(16)}</th>)}</tr></thead>
              <tbody>
                {Array.from({ length: cores }, (_, core) => (
                  <tr key={core} className={highlight && core === actor ? "on" : ""}>
                    <td>Core {core}</td>
                    {addresses.map((address) => {
                      const found = shot.lines.find((item) => item.address === address)?.copies[core];
                      return <td key={address}><span className={`cst ${found?.state ?? "I"}`}>{found?.state ?? "I"}</span></td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
        <article>
          <h2>Issue Memory Operation</h2>
          <label>Core
            <select aria-label="Requesting core" value={actor} onChange={(event) => setActor(Number(event.target.value))}>
              {Array.from({ length: cores }, (_, core) => <option key={core} value={core}>Core {core}</option>)}
            </select>
          </label>
          <div className="vl-pills">
            <button type="button" className={operation === "read" ? "on" : ""} onClick={() => setOperation("read")}>Read</button>
            <button type="button" className={operation === "write" ? "on" : ""} onClick={() => setOperation("write")}>Write</button>
          </div>
          <label>Cache line
            <select aria-label="Cache line" value={line} onChange={(event) => setLine(Number(event.target.value))}>
              {addresses.map((address) => <option key={address} value={address}>Line 0x{address.toString(16)}</option>)}
            </select>
          </label>
          {operation === "write" ? <label>Value <input aria-label="Store value" type="number" value={written} onChange={(event) => setWritten(Number(event.target.value))} /></label> : null}
          <button type="button" onClick={add}>Execute Operation</button>
          <button type="button" onClick={() => { setAccesses([]); setSeed({}); play.reset(); }}>Reset System</button>
        </article>
        <article>
          <h2>Multicore Event Log</h2>
          <table>
            <thead><tr><th>#</th><th>Cycle</th><th>Core</th><th>Event</th></tr></thead>
            <tbody>
              {shot.log.slice(-8).map((item, index) => (
                <tr key={`${item.cycle}-${index}`}><td>{index + 1}</td><td>{item.cycle}</td><td>C{item.core}</td><td>{item.bus} {item.detail}</td></tr>
              ))}
            </tbody>
          </table>
        </article>
      </div>
      <div className="vl-cards three">
        <article>
          <h2>Simulation Controls</h2>
          <Toggle on={traffic} label="Show Coherence Traffic" onChange={setTraffic} />
          <Toggle on={highlight} label="Highlight Cache Line" onChange={setHighlight} />
          <Toggle on={auto} label="Auto Advance Cycle" onChange={setAuto} />
          <Transport playing={play.playing} onPlay={() => { if (!auto) { play.setCycle((value) => Math.min(result.shots.length - 1, value + 1)); return; } play.setPlaying((value) => !value); }} onStep={() => play.setCycle((value) => Math.min(result.shots.length - 1, value + 1))} onBack={() => play.setCycle((value) => Math.max(0, value - 1))} onReset={play.reset} speed={play.speed} onSpeed={play.setSpeed} />
        </article>
        <article>
          <h2>Results & Insights</h2>
          <div className="vl-metrics">
            <div><strong>{shot.cycle}</strong><span>Total cycles</span></div>
            <div><strong>{shot.readMisses + shot.writeMisses}</strong><span>Cache misses</span></div>
            <div><strong>{shot.invalidations}</strong><span>Invalidations</span></div>
            <div><strong>{shot.messages}</strong><span>Coherence traffic</span></div>
          </div>
          <p>BusRd {shot.log.filter((item) => item.bus === "BusRd").length}. BusRdX {shot.log.filter((item) => item.bus === "BusRdX").length}. Upgrades {shot.upgrades}. Writebacks {shot.writebacks}. Silent E→M {shot.silent}. Cache-to-cache {shot.cacheToCache}.</p>
        </article>
        <article>
          <h2>Same data, one value</h2>
          <p>Run the producer/consumer trace in both protocols. MSI never uses Exclusive, so the first write is a bus upgrade. MESI writes silently from Exclusive, then a remote read turns Modified into Shared and updates memory.</p>
        </article>
      </div>
    </LabChrome>
  );
}
