import { useMemo, useState } from "react";
import { DIR_LINES, DIR_PRESETS, runDirectory, scalingSeries, validHolders, type DirRequest, type DirState } from "../../../engines/aca/directory";
import { LabChrome, Toggle, Transport, usePlayback } from "./HazardLab";

const CORE_COLOR = ["#f3e8ff", "#dbeafe", "#dcfce7", "#fef9c3", "#ffe4e6", "#e0f2fe", "#fef3c7", "#ede9fe"];
const STATE_NAME: Record<DirState, string> = { U: "Uncached", S: "Shared", M: "Modified" };

export function DirectoryLab() {
  const initial = DIR_PRESETS[2];
  const [cores, setCores] = useState(initial?.cores ?? 4);
  const [presetId, setPresetId] = useState(initial?.id ?? "writer");
  const [requests, setRequests] = useState<DirRequest[]>(initial?.requests ?? []);
  const [seed, setSeed] = useState<Record<number, number>>(initial?.seed ?? {});
  const [actor, setActor] = useState(1);
  const [operation, setOperation] = useState<"read" | "write">("write");
  const [address, setAddress] = useState("0x1000");
  const [written, setWritten] = useState(40);
  const [messagesOn, setMessagesOn] = useState(true);
  const [animate, setAnimate] = useState(true);
  const [highlight, setHighlight] = useState(true);
  const [auto, setAuto] = useState(true);
  const [selected, setSelected] = useState(0x1000);
  const parsed = Number(address);
  const block = Number.isNaN(parsed) ? 0x1000 : parsed;
  const result = useMemo(() => runDirectory(cores, requests.filter((item) => item.core < cores), seed), [cores, requests, seed]);
  const play = usePlayback(Math.max(0, result.shots.length - 1));
  const shot = result.shots[Math.min(play.cycle, result.shots.length - 1)];
  if (!shot) return null;
  const line = shot.lines.find((item) => item.address === selected) ?? shot.lines[0];
  const holders = line ? validHolders(line) : [];
  const sharerText = holders.length ? holders.map((core) => `C${core}`).join(", ") : "none";
  const targeted = shot.invalidated.length || holders.length;
  const bars = scalingSeries(targeted);
  const peak = Math.max(...bars.map((bar) => bar.snoop), 1);
  const issue = () => {
    setRequests((current) => [...current, { core: actor, op: operation, address: block, value: operation === "write" ? written : undefined }]);
    setSelected(block);
    play.setCycle(requests.length + 1);
  };
  return (
    <LabChrome lab="directory-coherence" kicker="Labs > Lab 19" title="Lab 19 — Directory-Based Cache Coherence" subtitle="Study scalable coherence using a centralized directory, sharer lists, invalidations, and ownership transfer." badge="RISC-V (5-Stage Pipeline)">
      <div className="vl-cards three">
        <article><h2>Learning Objective</h2><p>Understand how a centralized directory maintains sharer lists, handles read and write requests, issues invalidations only to known sharers, and transfers ownership.</p></article>
        <article><h2>Experiment Status</h2><p>{play.cycle === 0 ? "Ready to run" : shot.event}</p><p>A single reader is Shared in this model. There is no Exclusive state. A Modified line is dirty until a remote read writes it back.</p></article>
        <article><h2>Directory</h2><p>A directory keeps the sharer list so a write reaches the cores that hold the line. Cores that never had a copy are not interrupted.</p></article>
      </div>
      <div className="vl-cards three">
        <article>
          <h2>System Architecture</h2>
          <div className="vl-cores">
            {Array.from({ length: Math.min(cores, 4) }, (_, core) => {
              const copy = line?.copies[core];
              return (
                <div key={core} style={{ background: CORE_COLOR[core], outline: highlight && shot.requester === core ? "2px solid #2563eb" : undefined }}>
                  <b>Core {core}</b>
                  <span>L1 cache</span>
                  <span className={`cst ${copy?.state ?? "I"}`}>{copy?.state ?? "I"}</span>
                  <small>{copy && copy.state !== "I" ? `0x${copy.value.toString(16)}` : "—"}</small>
                </div>
              );
            })}
          </div>
          <p className="node">Directory node · {line ? `${STATE_NAME[line.state]} · owner ${line.owner === null ? "none" : `Core ${line.owner}`} · sharers ${sharerText}` : "empty"}</p>
          <p>Multiple cores communicate through a centralized directory. {cores > 4 ? `${cores} cores are in the directory table.` : "Four cores are drawn here."}</p>
        </article>
        <article>
          <h2>Directory State</h2>
          <table>
            <thead><tr><th>Block</th><th>Owner</th><th>Sharers</th><th>State</th><th>Memory</th></tr></thead>
            <tbody>
              {shot.lines.filter((item) => DIR_LINES.includes(item.address) || item.state !== "U").map((item) => (
                <tr key={item.address} className={item.address === line?.address ? "on" : ""} onClick={() => setSelected(item.address)}>
                  <td>0x{item.address.toString(16)}</td>
                  <td>{item.owner === null ? "—" : `Core ${item.owner}`}</td>
                  <td>{`{${validHolders(item).join(", ")}}`}</td>
                  <td><span className={`cst ${item.state === "U" ? "I" : item.state}`}>{item.state === "U" ? "U" : item.state}</span></td>
                  <td>0x{item.memory.toString(16)}{item.dirty ? " stale" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {line ? <p>Sharer bits {Array.from({ length: cores }, (_, core) => holders.includes(core) ? "1" : "0").join(" ")}. Click a block to inspect it.</p> : null}
        </article>
        <article>
          <h2>Issue Memory Request</h2>
          <label>Core
            <select aria-label="Requesting core" value={actor} onChange={(event) => setActor(Number(event.target.value))}>
              {Array.from({ length: cores }, (_, core) => <option key={core} value={core}>Core {core}</option>)}
            </select>
          </label>
          <div className="vl-pills">
            <button type="button" className={operation === "read" ? "on" : ""} onClick={() => setOperation("read")}>Read</button>
            <button type="button" className={operation === "write" ? "on" : ""} onClick={() => setOperation("write")}>Write</button>
          </div>
          <label>Block address (hex) <input aria-label="Block address" value={address} onChange={(event) => setAddress(event.target.value)} /></label>
          {operation === "write" ? <label>Value <input aria-label="Store value" type="number" value={written} onChange={(event) => setWritten(Number(event.target.value))} /></label> : null}
          <button type="button" className="vl-step" onClick={issue}>Issue Request</button>
          <label>Example
            <select aria-label="Load example" value={presetId} onChange={(event) => {
              const next = DIR_PRESETS.find((item) => item.id === event.target.value);
              setPresetId(event.target.value);
              if (next) { setCores(next.cores); setRequests(next.requests); setSeed(next.seed); setSelected(next.requests[0]?.address ?? 0x1000); }
              play.reset();
            }}>
              {DIR_PRESETS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
          <label>Cores
            <select aria-label="Number of cores" value={cores} onChange={(event) => { setCores(Number(event.target.value)); play.reset(); }}>
              <option value={4}>4 cores</option>
              <option value={8}>8 cores</option>
            </select>
          </label>
        </article>
      </div>
      <div className="vl-cards three">
        <article>
          <h2>Message Flow</h2>
          {messagesOn ? (
            <div className="vl-lane">
              {["Requester", "Directory", "Owner", "Sharers"].map((lane) => (
                <div key={lane}>
                  <b>{lane}</b>
                  {shot.step.filter((message) => lane === "Requester" ? message.kind === "GetS" || message.kind === "GetM" : lane === "Directory" ? message.source === "Directory" : lane === "Owner" ? message.kind.startsWith("Fwd") || message.kind === "PutM" || (message.kind === "Data" && message.source.startsWith("Core")) : message.kind === "Inv" || message.kind === "InvAck").map((message, index) => (
                    <p key={`${message.kind}-${index}`}>{animate ? `${index + 1}. ` : ""}{message.kind} {message.source} → {message.destination}</p>
                  ))}
                </div>
              ))}
            </div>
          ) : <p>Message arrows are hidden.</p>}
          <p>{shot.invalidated.length ? `Invalidations went to ${shot.invalidated.map((core) => `Core ${core}`).join(", ")}.` : "No targeted invalidation in this step."}</p>
        </article>
        <article>
          <h2>Request / Response Timeline</h2>
          <table>
            <thead><tr><th>#</th><th>Cycle</th><th>Event</th><th>Source → Destination</th><th>Details</th></tr></thead>
            <tbody>
              {shot.step.map((message, index) => (
                <tr key={`${message.kind}-${index}`} className={highlight && index === shot.step.length - 1 ? "on" : ""}>
                  <td>{index}</td><td>{message.cycle}</td><td>{message.kind}</td><td>{message.source} → {message.destination}</td><td>{message.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
        <article>
          <h2>Ownership Transfer</h2>
          <p>Previous owner {shot.previousOwner === null ? "none" : `Core ${shot.previousOwner}`}</p>
          <p>Next owner {shot.nextOwner === null ? "none" : `Core ${shot.nextOwner}`}</p>
          <p>Block {line ? `0x${line.address.toString(16)}` : "—"} · {shot.transfer}</p>
          <p>Sharers invalidated {shot.invalidated.length ? `{${shot.invalidated.join(", ")}}` : "none"}</p>
          <p>Final state {line ? STATE_NAME[line.state] : "—"}</p>
          <p>On a write, the directory invalidates the recorded sharers and names the requester as owner.</p>
        </article>
      </div>
      <div className="vl-cards three">
        <article>
          <h2>Scalability Comparison</h2>
          <div className="vl-bars">
            {bars.map((bar) => (
              <b key={bar.cores}>{bar.cores}
                <i style={{ height: `${Math.max(8, (bar.snoop / peak) * 80)}px` }} title={`Snoop ${bar.snoop}`} />
                <i className="two" style={{ height: `${Math.max(8, (bar.directory / peak) * 80)}px` }} title={`Directory ${bar.directory}`} />
              </b>
            ))}
          </div>
          <p>Pale bars are a broadcast to every other core. Dark bars are this write's directory messages for {targeted} {targeted === 1 ? "sharer" : "sharers"}: one request, one grant, and an invalidate plus ack per sharer. The directory cost stays flat as the machine grows.</p>
        </article>
        <article>
          <h2>Simulation Controls</h2>
          <Toggle on={messagesOn} label="Show Coherence Messages" onChange={setMessagesOn} />
          <Toggle on={animate} label="Animate Invalidation Flow" onChange={setAnimate} />
          <Toggle on={highlight} label="Highlight Directory Updates" onChange={setHighlight} />
          <Toggle on={auto} label="Auto Advance Requests" onChange={setAuto} />
          <Transport playing={play.playing} onPlay={() => { if (!auto) { play.setCycle((value) => Math.min(result.shots.length - 1, value + 1)); return; } play.setPlaying((value) => !value); }} onStep={() => play.setCycle((value) => Math.min(result.shots.length - 1, value + 1))} onBack={() => play.setCycle((value) => Math.max(0, value - 1))} onReset={play.reset} speed={play.speed} onSpeed={play.setSpeed} />
        </article>
        <article>
          <h2>Results & Insights</h2>
          <div className="vl-metrics">
            <div><strong>{shot.pointToPoint}</strong><span>Point-to-point messages</span></div>
            <div><strong>{shot.avgLatency.toFixed(1)}</strong><span>Avg. messages / request</span></div>
            <div><strong>{shot.maxSharers}</strong><span>Max sharers</span></div>
          </div>
          <p>Lookups {shot.lookups}. Reads {shot.reads}. Writes {shot.writes}. Invalidations {shot.invalidations}. Acks {shot.acks}. Ownership transfers {shot.transfers}. Data responses {shot.dataResponses}. Memory reads {shot.memoryReads}. Writebacks {shot.writebacks}. Messages avoided versus a broadcast {shot.avoided}. Average sharers {shot.avgSharers.toFixed(2)}.</p>
        </article>
      </div>
    </LabChrome>
  );
}
