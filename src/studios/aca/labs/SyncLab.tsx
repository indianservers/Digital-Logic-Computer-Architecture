import { useMemo, useState } from "react";
import { SYNC_PRESETS, compareCounters, compareLocks, runSync, waitByWidth, type SyncConfig, type SyncKind } from "../../../engines/aca/sync";
import { LabChrome, Toggle, Transport, usePlayback } from "./HazardLab";

const KINDS: Array<{ id: SyncKind; label: string; blurb: string }> = [
  { id: "tas", label: "Test-and-set", blurb: "TAS writes 1 and returns the old value in one step. A spinlock repeats it until the old value is 0." },
  { id: "cas", label: "Compare-and-swap", blurb: "CAS writes only when the memory still holds the expected value. A mismatch leaves memory unchanged." },
  { id: "faa", label: "Fetch-and-add", blurb: "FAA returns the old value and adds the delta in one step. Concurrent increments do not lose updates." },
  { id: "llsc", label: "Load-linked / store-conditional", blurb: "LL takes a reservation. SC stores only if that reservation is still valid. Another write clears it." },
  { id: "ticket", label: "Ticket lock", blurb: "Each thread takes a ticket with fetch-and-add and waits until serving equals that ticket." },
  { id: "lost", label: "Non-atomic increment", blurb: "A separate read and write can both observe the same old value. The second write drops an update." },
];

function phaseColor(phase: string) {
  if (phase === "In critical section") return "#86efac";
  if (phase === "Spinning") return "#fde68a";
  if (phase === "Done") return "#bfdbfe";
  return "#e2e8f0";
}

export function SyncLab() {
  const initial = SYNC_PRESETS[0];
  const [presetId, setPresetId] = useState(initial?.id ?? "tas-2");
  const [kind, setKind] = useState<SyncKind>(initial?.kind ?? "tas");
  const [threads, setThreads] = useState(initial?.config.threads ?? 2);
  const [cs, setCs] = useState(initial?.config.cs ?? 3);
  const [think, setThink] = useState(initial?.config.think ?? 1);
  const [rounds, setRounds] = useState(initial?.config.rounds ?? 2);
  const [showLock, setShowLock] = useState(true);
  const [showThreads, setShowThreads] = useState(true);
  const [highlight, setHighlight] = useState(true);
  const [auto, setAuto] = useState(true);
  const config = useMemo<SyncConfig>(() => ({ threads, cs, think, rounds }), [threads, cs, think, rounds]);
  const result = useMemo(() => runSync(kind, config), [kind, config]);
  const locks = useMemo(() => compareLocks({ ...config, think: 0 }), [config]);
  const counters = useMemo(() => compareCounters({ threads, cs: 1, think: 0, rounds: 1 }), [threads, cs]);
  const sweep = useMemo(() => ({
    tas: waitByWidth("tas", [2, 4, 8], { threads: 4, cs, think: 0, rounds: 2 }),
    ticket: waitByWidth("ticket", [2, 4, 8], { threads: 4, cs, think: 0, rounds: 2 }),
  }), [cs]);
  const play = usePlayback(Math.max(0, result.shots.length - 1));
  const shot = result.shots[Math.min(play.cycle, result.shots.length - 1)];
  if (!shot) return null;
  const blurb = KINDS.find((item) => item.id === kind)?.blurb ?? "";
  const waitPeak = Math.max(...sweep.tas.map((point) => point.avgWait), ...sweep.ticket.map((point) => point.avgWait), 1);
  return (
    <LabChrome lab="atomic-operations" kicker="Labs > Lab 27" title="Lab 27 — Atomic Operations & Synchronization" subtitle="Explore hardware synchronization primitives and software locks, and study their behavior under contention." badge="RISC-V (5-Stage Pipeline)">
      <div className="vl-cards three">
        <article><h2>Learning Objective</h2><p>An atomic read-modify-write is one event. Another thread cannot sit between the read and the write. A lock built from that rule admits one thread to the critical section.</p></article>
        <article><h2>Experiment Status</h2><p>{play.cycle === 0 ? "Ready to run" : shot.event}</p><p>{blurb}</p></article>
        <article><h2>Contention</h2><p>{think === 0 ? "Think time is zero, so a thread that leaves the critical section tries again immediately." : `Think time is ${think} ${think === 1 ? "cycle" : "cycles"} between acquisitions.`} Fairness here is the standard deviation of per-thread wait. Lower means the waits are closer together.</p></article>
      </div>
      <div className="vl-cards three">
        <article>
          <h2>Atomic Primitive</h2>
          <div className="vl-pills">
            {KINDS.map((item) => <button key={item.id} type="button" className={kind === item.id ? "on" : ""} onClick={() => { setKind(item.id); play.reset(); }}>{item.label}</button>)}
          </div>
          <label>Example
            <select aria-label="Load example" value={presetId} onChange={(event) => {
              const next = SYNC_PRESETS.find((item) => item.id === event.target.value);
              setPresetId(event.target.value);
              if (next) {
                setKind(next.kind);
                setThreads(next.config.threads);
                setCs(next.config.cs);
                setThink(next.config.think);
                setRounds(next.config.rounds);
              }
              play.reset();
            }}>
              {SYNC_PRESETS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
          <label>Threads
            <select aria-label="Thread count" value={threads} onChange={(event) => { setThreads(Number(event.target.value)); play.reset(); }}>
              {[2, 4, 8].map((count) => <option key={count} value={count}>{count}</option>)}
            </select>
          </label>
          <label>Critical section cycles <input aria-label="Critical section cycles" type="number" min={1} max={12} value={cs} onChange={(event) => { setCs(Math.max(1, Number(event.target.value) || 1)); play.reset(); }} /></label>
          <label>Non-critical cycles <input aria-label="Non-critical cycles" type="number" min={0} max={12} value={think} onChange={(event) => { setThink(Math.max(0, Number(event.target.value) || 0)); play.reset(); }} /></label>
          <label>Rounds <input aria-label="Rounds" type="number" min={1} max={6} value={rounds} onChange={(event) => { setRounds(Math.max(1, Number(event.target.value) || 1)); play.reset(); }} /></label>
        </article>
        {showThreads ? (
          <article>
            <h2>Thread Activity</h2>
            <table>
              <thead><tr><th>Thread</th><th>State</th><th>Ticket</th><th>Acquires</th><th>Fails</th><th>Wait</th></tr></thead>
              <tbody>
                {shot.threads.map((thread) => (
                  <tr key={thread.id} className={highlight && thread.phase === "In critical section" ? "on" : ""}>
                    <td>T{thread.id}</td><td>{thread.phase}</td><td>{thread.ticket ?? "—"}</td><td>{thread.acquires}</td><td>{thread.fails}</td><td>{thread.wait}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
        ) : null}
        {showLock ? (
          <article>
            <h2>Lock State</h2>
            <p>{shot.owner === null ? "Unlocked" : `Locked by T${shot.owner}`}</p>
            <p>Lock value {shot.lock}. Counter {shot.counter}. Next ticket {shot.nextTicket}. Serving {shot.serving}.</p>
            <p>Waiting {shot.queue.length ? shot.queue.map((id) => `T${id}`).join(", ") : "none"}.</p>
            <p>Entry order {shot.order.length ? shot.order.map((id) => `T${id}`).join(" → ") : "none yet"}.</p>
          </article>
        ) : null}
      </div>
      <div className="vl-cards three">
        <article>
          <h2>Spinlock vs Ticket Lock</h2>
          <div className="vl-bars">
            {sweep.tas.map((point, index) => (
              <b key={point.threads}>{point.threads}
                <i style={{ height: `${Math.max(6, (point.avgWait / waitPeak) * 80)}px` }} title={`TAS ${point.avgWait.toFixed(1)}`} />
                <i className="two" style={{ height: `${Math.max(6, ((sweep.ticket[index]?.avgWait ?? 0) / waitPeak) * 80)}px` }} title={`Ticket ${(sweep.ticket[index]?.avgWait ?? 0).toFixed(1)}`} />
              </b>
            ))}
          </div>
          <p>Pale bars are TAS average wait. Dark bars are the ticket lock. This comparison uses think time 0 and 2 rounds, at 2, 4, and 8 threads. On this run TAS fairness is {locks.tas.final.fairness.toFixed(1)} and the ticket lock is {locks.ticket.final.fairness.toFixed(1)}.</p>
        </article>
        <article>
          <h2>Contention Timeline</h2>
          {result.shots.filter((_, index) => index % Math.max(1, Math.floor(result.shots.length / 24)) === 0).slice(0, 24).map((frame) => (
            <div key={frame.cycle} className="vl-bytes" style={{ minHeight: 18, marginBottom: 2 }}>
              {frame.threads.map((thread) => <span key={thread.id} style={{ flex: 1, background: phaseColor(thread.phase), fontSize: 9 }}>{thread.id}</span>)}
            </div>
          ))}
          <p className="vl-legend"><span>Green: critical section</span><span>Amber: spinning</span><span>Blue: done</span></p>
        </article>
        <article>
          <h2>Operation Log</h2>
          <table>
            <thead><tr><th>Cycle</th><th>Thread</th><th>Event</th><th>Details</th></tr></thead>
            <tbody>
              {shot.log.map((item, index) => (
                <tr key={`${item.cycle}-${index}`}><td>{item.cycle}</td><td>{item.thread < 0 ? "—" : `T${item.thread}`}</td><td>{item.event}</td><td>{item.detail}</td></tr>
              ))}
            </tbody>
          </table>
        </article>
      </div>
      <div className="vl-cards three">
        <article>
          <h2>Performance</h2>
          <div className="vl-metrics">
            <div><strong>{shot.throughput.toFixed(2)}</strong><span>Acquires / cycle</span></div>
            <div><strong>{shot.avgWait.toFixed(1)}</strong><span>Avg wait</span></div>
            <div><strong>{shot.maxWait}</strong><span>Max wait</span></div>
            <div><strong>{shot.fairness.toFixed(1)}</strong><span>Wait std dev</span></div>
          </div>
          <p>Non-atomic counter ends at {counters.lost.final.counter}. Fetch-and-add ends at {counters.atomic.final.counter} for one increment from each of {threads} threads.</p>
        </article>
        <article>
          <h2>Simulation Controls</h2>
          <Toggle on={showLock} label="Show Lock State" onChange={setShowLock} />
          <Toggle on={showThreads} label="Show Thread Activity" onChange={setShowThreads} />
          <Toggle on={highlight} label="Highlight Critical Section" onChange={setHighlight} />
          <Toggle on={auto} label="Auto Advance" onChange={setAuto} />
          <Transport playing={play.playing} onPlay={() => { if (!auto) { play.setCycle((value) => Math.min(result.shots.length - 1, value + 1)); return; } play.setPlaying((value) => !value); }} onStep={() => play.setCycle((value) => Math.min(result.shots.length - 1, value + 1))} onBack={() => play.setCycle((value) => Math.max(0, value - 1))} onReset={play.reset} speed={play.speed} onSpeed={play.setSpeed} />
        </article>
        <article>
          <h2>Results & Insights</h2>
          <p>Atomic operations {shot.atomic}. Successful acquires {shot.acquires}. Failed attempts {shot.fails}. CAS failures {shot.casFails}. SC failures {shot.scFails}. Spin cycles {shot.spin}. Critical-section entries {shot.entries}.</p>
          <p>The ticket order on a separate FIFO run is {locks.ticket.order.slice(0, 8).map((id) => `T${id}`).join(" → ")}. TAS with no think time lets the lowest id take the lock again before the others.</p>
        </article>
      </div>
    </LabChrome>
  );
}
