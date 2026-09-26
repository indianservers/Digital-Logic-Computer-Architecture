import { useMemo, useState } from "react";
import { LITMUS_TESTS, applyAction, enumerate, initialState, insertFence, legalActions, parseLitmus, type ConsState, type Litmus, type MemoryModel } from "../../../engines/aca/consistency";
import { LabChrome, Toggle, Transport, usePlayback } from "./HazardLab";
import { OrderMove } from "../animation/phase3Views";
import { useGuideFocus } from "../guide/focus";

const MODELS: Array<{ id: MemoryModel; label: string; note: string }> = [
  { id: "sc", label: "Sequential consistency", note: "One total order. Each core keeps program order, and a store is visible as soon as it executes." },
  { id: "tso", label: "Total store order", note: "A store sits in a per-core buffer. A later load of a different address may run before that store drains. A load of the same address forwards from the buffer. Drains are FIFO." },
  { id: "weak", label: "Weak ordering", note: "Independent loads and stores in one thread may pass each other. Stores may drain in any order. A fence, an acquire, or a release puts the ordering back." },
  { id: "release", label: "Acquire / release", note: "A release store becomes visible only after earlier memory operations. An acquire finishes before later operations in that thread. It does not fence both directions." },
];

function withFences(litmus: Litmus, afterStore0: boolean, afterLoad0: boolean, afterStore1: boolean, afterLoad1: boolean) {
  let next = litmus;
  const first: Array<"store" | "load" | "release" | "acquire"> = [];
  const second: Array<"store" | "load" | "release" | "acquire"> = [];
  if (afterStore0) first.push("store", "release");
  if (afterLoad0) first.push("load", "acquire");
  if (afterStore1) second.push("store", "release");
  if (afterLoad1) second.push("load", "acquire");
  if (first.length) next = insertFence(next, 0, first);
  if (second.length) next = insertFence(next, 1, second);
  return next;
}

function finished(state: ConsState) {
  return state.done.every((row) => row.every(Boolean)) && state.buffers.every((buffer) => buffer.length === 0);
}

export function ConsistencyLab() {
  const [model, setModel] = useState<MemoryModel>("tso");
  const [testId, setTestId] = useState(LITMUS_TESTS[0]?.id ?? "sb");
  const [afterStore0, setAfterStore0] = useState(false);
  const [afterLoad0, setAfterLoad0] = useState(false);
  const [afterStore1, setAfterStore1] = useState(false);
  const [afterLoad1, setAfterLoad1] = useState(false);
  const [showBuffers, setShowBuffers] = useState(true);
  const [showValues, setShowValues] = useState(true);
  const [animate, setAnimate] = useState(true);
  const [auto, setAuto] = useState(true);
  const [source, setSource] = useState("init X=0 Y=0\n0: X = 1\n0: r1 = Y\n1: Y = 1\n1: r2 = X");
  const [custom, setCustom] = useState(false);
  const [manual, setManual] = useState(false);
  const [manualState, setManualState] = useState<ConsState | null>(null);
  const built = useMemo(() => parseLitmus(source), [source]);
  const litmus = useMemo(() => {
    if (custom && !built.error && built.litmus.threads.length >= 2) return built.litmus;
    const base = LITMUS_TESTS.find((item) => item.id === testId) ?? LITMUS_TESTS[0];
    if (!base) throw new Error("missing litmus");
    return withFences(base, afterStore0, afterLoad0, afterStore1, afterLoad1);
  }, [custom, built, testId, afterStore0, afterLoad0, afterStore1, afterLoad1]);
  const result = useMemo(() => enumerate(litmus, model), [litmus, model]);
  const compared = useMemo(() => ({ sc: enumerate(litmus, "sc"), tso: enumerate(litmus, "tso") }), [litmus]);
  const { id: guideFocus, setId: setGuideFocus } = useGuideFocus();
  const path = useMemo(() => {
    const states = [initialState(litmus)];
    let guard = 0;
    while (guard < 80) {
      const current = states[states.length - 1];
      if (!current || finished(current)) break;
      const action = legalActions(current, litmus, model)[0];
      if (!action) break;
      states.push(applyAction(current, litmus, action, model));
      guard += 1;
    }
    return states;
  }, [litmus, model]);
  const play = usePlayback(Math.max(0, path.length - 1));
  const stepped = path[Math.min(play.cycle, path.length - 1)] ?? path[0];
  const state = manual ? (manualState ?? initialState(litmus)) : stepped;
  if (!state) return null;
  const explanation = MODELS.find((item) => item.id === model)?.note ?? "";
  const seen = result.outcomes.filter((row) => row.allowed).length;
  const scAllowed = compared.sc.outcomes.filter((row) => row.allowed).length;
  const tsoAllowed = compared.tso.outcomes.filter((row) => row.allowed).length;
  const hint = model === "tso" && tsoAllowed > scAllowed
    ? "Total store order allows an outcome sequential consistency forbids."
    : model === "sc"
      ? "Sequential consistency keeps one order. Compare the Allowed count with Total store order."
      : "Count Allowed, then switch the model or add a fence and count again.";
  const reading = `${model}: ${seen} allowed, ${result.forbidden} forbidden. SC ${scAllowed}. TSO ${tsoAllowed}.`;
  return (
    <LabChrome lab="memory-consistency" kicker="Labs > Lab 26" title="Lab 26 — Memory Consistency Model Explorer" subtitle="Experiment with sequential consistency, TSO, weak ordering, acquire/release, and memory fences using litmus tests." badge="RISC-V (5-Stage Pipeline)" hint={hint} reading={reading}>
      <div className="vl-cards three">
        <article><h2>Learning Objective</h2><p>Coherence is about one address. Consistency is about which orders of operations on different addresses a program is allowed to observe. The same instructions can have different legal outcomes.</p></article>
        <article><h2>Experiment Status</h2><p>{play.cycle === 0 ? "Ready to run" : finished(state) ? "This execution has drained" : "Stepping one legal action"}</p><p>The outcome table counts finished executions from the enumerator. It is not a sample of 10,000 random runs.</p></article>
        <article><h2>Same program</h2><p>{explanation}</p>
          <OrderMove model={model} buffered={state.buffers.reduce((sum, buffer) => sum + buffer.length, 0)} fences={state.fences} speed={play.speed} cycle={play.cycle} />
        </article>
      </div>
      <div className="vl-cards three">
        <article>
          <h2>Memory Model</h2>
          <div className="vl-pills">
            {MODELS.map((item) => <button key={item.id} type="button" className={model === item.id ? "on" : ""} onClick={() => { setModel(item.id); play.reset(); }}>{item.label}</button>)}
          </div>
        </article>
        <article>
          <h2>Litmus Test</h2>
          <label>Litmus program
            <textarea aria-label="Litmus test builder" rows={6} value={custom ? source : source} onChange={(event) => { setCustom(true); setSource(event.target.value); setManualState(null); play.reset(); }} spellCheck={false} />
          </label>
          {custom && built.error ? <p className="vl-bad">{built.error}</p> : null}
          <button type="button" onClick={() => { setCustom(false); setManualState(null); play.reset(); }}>Use built-in test</button>
          <label>Built-in test
            <select aria-label="Litmus test" value={testId} onChange={(event) => { setTestId(event.target.value); setCustom(false); setManualState(null); play.reset(); }}>
              {LITMUS_TESTS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
          <div className="vl-dual">
            {litmus.threads.map((thread, index) => (
              <div key={index}>
                <b>Core {index}</b>
                <ol>
                  {thread.map((op, cursor) => <li key={cursor} className={state.done[index]?.[cursor] ? "on" : ""}>{op.kind} {op.addr}{op.reg ? ` → ${op.reg}` : ""}{op.value !== undefined ? ` = ${op.value}` : ""}</li>)}
                </ol>
              </div>
            ))}
          </div>
          <p>Initial memory {Object.entries(litmus.memory).map(([name, value]) => `${name}=${value}`).join(", ")}.</p>
        </article>
        <article>
          <h2>Fence Controls</h2>
          <Toggle on={afterStore0} label="Fence after core 0 store" onChange={(next) => { setAfterStore0(next); play.reset(); }} />
          <Toggle on={afterLoad0} label="Fence after core 0 load" onChange={(next) => { setAfterLoad0(next); play.reset(); }} />
          <Toggle on={afterStore1} label="Fence after core 1 store" onChange={(next) => { setAfterStore1(next); play.reset(); }} />
          <Toggle on={afterLoad1} label="Fence after core 1 load" onChange={(next) => { setAfterLoad1(next); play.reset(); }} />
          <p>A fence executes only after that core's store buffer is empty, so the load after it sees the drained store.</p>
        </article>
      </div>
      <div className="vl-cards three">
        <article>
          <h2>Per-Core Execution</h2>
          {litmus.threads.map((thread, index) => (
            <p key={index}>{animate ? `Core ${index}: ` : ""}{thread.map((op, cursor) => state.done[index]?.[cursor] ? op.kind : "·").join(" ")}</p>
          ))}
          <p>Cycle {state.cycles}. Reorders observed on this path {state.reorders}. Fences {state.fences}. Acquires {state.acquires}. Releases {state.releases}. Drains {state.drains}.</p>
        </article>
        {showBuffers ? (
          <article>
            <h2 className={guideFocus === "buffers" ? "aca-guide-on" : undefined}>Store Buffers</h2>
            <div className="vl-dual">
              {state.buffers.map((buffer, index) => (
                <div key={index}>
                  <b>Core {index}</b>
                  {buffer.length === 0 ? <p>Empty</p> : buffer.map((entry, slot) => <p key={slot}>{entry.addr} = {entry.value}</p>)}
                  {showValues ? <p>Visible now {Object.entries(state.memory).map(([name, value]) => `${name}=${value}`).join(", ")}</p> : null}
                </div>
              ))}
            </div>
            <p>Global memory {Object.entries(state.memory).map(([name, value]) => `${name}=${value}`).join(", ")}. Registers {Object.entries(state.regs).map(([name, value]) => `${name}=${value}`).join(", ")}.</p>
          </article>
        ) : null}
        <article>
          <h2 className={guideFocus === "outcomes" ? "aca-guide-on" : undefined}>Observed Outcomes</h2>
          <table>
            <thead><tr>{litmus.observe.map((name) => <th key={name}>{name}</th>)}<th>Executions</th><th>Status</th></tr></thead>
            <tbody>
              {result.outcomes.map((row) => (
                <tr key={JSON.stringify(row.values)}>
                  {litmus.observe.map((name) => <td key={name}>{row.values[name]}</td>)}
                  <td>{row.count}</td>
                  <td>{row.allowed ? "Allowed" : "Forbidden"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>{result.terminals} finished executions. {seen} allowed outcome{seen === 1 ? "" : "s"}. {result.forbidden} forbidden. Explored states {result.explored}.</p>
          <p>Same program under SC: {compared.sc.outcomes.filter((row) => row.allowed).length} allowed. Under TSO: {compared.tso.outcomes.filter((row) => row.allowed).length} allowed.</p>
        </article>
      </div>
      <div className="vl-cards three">
        <article>
          <h2>Model Explanation</h2>
          <p>{explanation}</p>
          <p>Switching the model or inserting a fence rebuilds the allowed set from the same instructions.</p>
        </article>
        <article>
          <h2>Simulation Controls</h2>
          <Toggle on={showBuffers} label="Show Store Buffers" onChange={setShowBuffers} />
          <Toggle on={showValues} label="Show Memory Values" onChange={setShowValues} />
          <Toggle on={animate} label="Animate Execution" onChange={setAnimate} />
          <Toggle on={auto} label="Auto Advance" onChange={setAuto} />
          <Toggle on={manual} label="Manual interleaving" onChange={(next) => { setManual(next); setManualState(initialState(litmus)); play.reset(); }} />
          {manual ? legalActions(state, litmus, model).map((action, index) => (
            <button key={`${action.type}-${index}`} type="button" onClick={() => setManualState(applyAction(state, litmus, action, model))}>
              {action.type === "exec" ? `Core ${action.thread} instruction ${action.index + 1}` : `Drain core ${action.thread} buffer`}
            </button>
          )) : null}
          <Transport playing={play.playing} onPlay={() => { if (!auto) { play.setCycle((value) => Math.min(path.length - 1, value + 1)); return; } play.setPlaying((value) => !value); }} onStep={() => play.setCycle((value) => Math.min(path.length - 1, value + 1))} onBack={() => play.setCycle((value) => Math.max(0, value - 1))} onReset={() => { setGuideFocus(""); play.reset(); }} speed={play.speed} onSpeed={play.setSpeed} />
        </article>
        <article>
          <h2>Results & Insights</h2>
          <div className="vl-metrics">
            <div><strong>{result.terminals}</strong><span>Finished executions</span></div>
            <div><strong>{seen}/{result.outcomes.length}</strong><span>Allowed outcomes</span></div>
            <div><strong>{result.forbidden}</strong><span>Forbidden</span></div>
          </div>
          <p>This path's registers: {Object.entries(state.regs).map(([name, value]) => `${name}=${value}`).join(", ") || "none yet"}. Store-buffer occupancy {state.buffers.reduce((sum, buffer) => sum + buffer.length, 0)}.</p>
        </article>
      </div>
    </LabChrome>
  );
}
