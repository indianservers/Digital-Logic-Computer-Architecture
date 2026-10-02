import { useEffect, useState, type MouseEvent } from "react";
import { useLab } from "../core/useLab";
import type { LabMeta } from "../registry";
import { CodeEditor } from "../ui/CodeEditor";
import { Icon } from "../ui/Icon";
import { LearningNotes, Panel, Toggle } from "../ui/Panels";
import { LabShell } from "../ui/Shell";
import { CORE_HZ } from "./L16sim";
import {
  bench18, burst, CRITICAL, DEMO, EDITOR_ORDER, EQUAL, INVERTED, IRQS, metrics, P18_DEFAULT, peakTime, pressButton, priorityOf, setPriority, setup18,
  statusAt, world18, type IrqKey, type P18, type Status,
} from "./L18sim";

const STATUS_CLS: Record<Status, string> = { Active: "act", Preempted: "pre", Pending: "pend", Waiting: "" };
const X0 = 110, X1 = 640;

export default function L18({ meta }: { meta: LabMeta }) {
  const lab = useLab<P18>({
    slug: meta.slug, code: DEMO, params: P18_DEFAULT, rebuildOn: ["extiOff"],
    mcu: () => ({ ips: 120_000, clock: CORE_HZ }),
    setup: (m) => setup18(m),
    world: world18,
  });
  const { mcu, params } = lab;
  const fw = mcu.fw;
  const b = bench18(mcu);
  const s = b.snap;
  const mt = metrics(s);
  const [cursor, setCursor] = useState<{ burst: number; t: number } | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [seen, setSeen] = useState({ depth: false, prio: false, equal: false, waited: false });
  useEffect(() => { if (pending !== null && lab.code === pending) { setPending(null); lab.run(); } }, [pending, lab]);

  const cur = cursor && cursor.burst === b.bursts ? cursor.t : peakTime(s);
  const pad = s ? Math.max(8e-6, (s.t1 - s.t0) * 0.06) : 0;
  const ta = s ? s.t0 - pad : 0, tz = s ? s.t1 + pad : 1;
  const sx = (t: number) => X0 + ((t - ta) / (tz - ta)) * (X1 - X0);
  const us = (t: number) => (s ? (t - s.t0) * 1e6 : 0);
  const spanUs = (tz - ta) * 1e6;
  const tickUs = spanUs > 600 ? 100 : spanUs > 300 ? 50 : spanUs > 120 ? 25 : 10;
  const tickCount = s ? Math.floor(us(tz) / tickUs) : 0;
  const lanes = [{ key: "main", label: "Main", handler: "main", color: "#1677ff" }, ...IRQS.filter((q) => q.key !== "SysTick" || s?.events.some((e) => e.name === q.handler)).map((q) => ({ key: q.key, label: q.lane, handler: q.handler, color: q.color }))];
  const laneH = lanes.length > 4 ? 40 : 48;
  const svgH = 34 + lanes.length * laneH + 26;

  const pick = (e: MouseEvent<SVGSVGElement>) => {
    if (!s) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 660;
    if (x < X0 || x > X1) return;
    setCursor({ burst: b.bursts, t: ta + ((x - X0) / (X1 - X0)) * (tz - ta) });
  };
  const editPrio = (k: IrqKey, p: number) => {
    const next = setPriority(lab.code, k, p);
    if (!next) { lab.setNotice(`No NVIC_SetPriority(${k}_IRQn, …) line in the code to edit.`); return; }
    lab.setCode(next); setPending(next);
  };

  const codePrio = (k: IrqKey) => priorityOf(lab.code, k);
  const livePrio = (k: IrqKey) => (fw ? (k === "SysTick" ? fw.irqPriority.get("SysTick") ?? -1 : mcu.irqPriority(k)) : null);
  const changed = EDITOR_ORDER.some((k) => (livePrio(k) ?? 0) !== priorityOf(DEMO, k));
  const extiWait = s?.events.find((e) => e.name === "EXTI0_IRQHandler");
  const waited = !!extiWait && extiWait.blocked && (extiWait.t0 - extiWait.tReq) * 1e6 > 50;
  const equal = !!s && s.events.length >= 3 && mt.preemptions === 0;
  useEffect(() => {
    const d = mt.depth >= 3, p = changed && !!s;
    if ((d && !seen.depth) || (p && !seen.prio) || (equal && !seen.equal) || (waited && !seen.waited))
      setSeen((x) => ({ depth: x.depth || d, prio: x.prio || p, equal: x.equal || equal, waited: x.waited || waited }));
  }, [mt.depth, changed, s, equal, waited, seen]);

  const rows = (s?.events ?? []).slice().sort((a, c) => a.tReq - c.tReq).map((e) => {
    const run = s!.segs.filter((g) => g.thread === e.name && g.t0 >= e.t0 - 1e-9 && g.t1 <= e.t1 + 1e-9).reduce((t, g) => t + (g.t1 - g.t0), 0);
    const by = s!.events.filter((o) => o !== e && o.t0 > e.t0 && o.t0 < e.t1).map((o) => IRQS.find((q) => q.handler === o.name)?.label ?? o.name);
    return { e, q: IRQS.find((x) => x.handler === e.name)!, run, by };
  });

  return (
    <LabShell meta={meta} lab={lab} subtitle="Explore NVIC priority, preemption, nesting and latency with competing events."
      components={["NUCLEO-F401RE (STM32F401RE, Cortex-M4 at 16 MHz HSI)", "EXTI0 emergency button on PA0 (P0)", "TIM2 update every 250 ms (P1)", "USART2 RX at 115200 baud (P2)", "SysTick 10 ms housekeeping (P3)", "NVIC: 4 preemption bits, no sub-priority"]}>
      <div className="mcl-l18-grid">
        <Panel title="Nested Interrupt Timeline" icon="layers" className="g-timeline" tools={
          <span className={`mcl-chip ${mt.depth >= 3 ? "mcl-chip-live" : mt.depth ? "mcl-chip-warn" : ""}`}>{s ? `Burst #${b.bursts} · depth ${mt.depth}` : "waiting for burst"}</span>
        }>
          <div className="mcl-l18-btns">
            <button type="button" className="go" onClick={() => burst(mcu)} disabled={!lab.running}>Trigger burst</button>
            <button type="button" onClick={() => pressButton(mcu)} disabled={!lab.running}>Press EXTI0 button</button>
            <button type="button" onClick={() => mcu.uartReceive("A")} disabled={!lab.running}>Send UART byte</button>
          </div>
          <svg viewBox={`0 0 660 ${svgH}`} className="mcl-svg mcl-l18-lanes" role="img" aria-label="Execution of main and each interrupt handler during the last burst; click to move the cursor" onClick={pick}>
            <defs>
              <pattern id="l18-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#f1f5f9" /><line x1="0" y1="0" x2="0" y2="6" stroke="#cbd5e1" strokeWidth="2" /></pattern>
            </defs>
            {lanes.map((l, i) => {
              const y = 26 + i * laneH;
              const evs = l.key === "main" ? [] : (s?.events ?? []).filter((e) => e.name === l.handler);
              const segs = (s?.segs ?? []).filter((g) => g.thread === l.handler);
              return (
                <g key={l.key}>
                  <text x={6} y={y + 5} fontSize="13.5" fontWeight="700" fill="#1b2f4e">{l.label}</text>
                  <line x1={X0} y1={y} x2={X1} y2={y} stroke="#e2e8f0" />
                  {evs.map((e) => (
                    <g key={`p${e.id}`}>
                      {e.t0 - e.tReq > 1e-6 ? <rect x={sx(e.tReq)} y={y - 8} width={Math.max(2, sx(e.t0) - sx(e.tReq))} height={16} rx={4} fill="none" stroke={l.color} strokeDasharray="3 2" /> : null}
                      <rect x={sx(e.t0)} y={y - 8} width={Math.max(2, sx(e.t1) - sx(e.t0))} height={16} rx={4} fill="url(#l18-hatch)" stroke={l.color} strokeOpacity={0.5} />
                      <path d={`M${sx(e.tReq)} ${y - 14} l-4 -6 h8 z`} fill={l.color} />
                    </g>
                  ))}
                  {segs.map((g, k) => <rect key={k} x={sx(g.t0)} y={y - 8} width={Math.max(2, sx(g.t1) - sx(g.t0))} height={16} rx={4} fill={l.color} />)}
                </g>
              );
            })}
            {s ? Array.from({ length: tickCount + 1 }, (_, k) => k * tickUs).map((u) => (
              <g key={u}><line x1={sx(s.t0 + u / 1e6)} y1={svgH - 22} x2={sx(s.t0 + u / 1e6)} y2={svgH - 18} stroke="#94a3b8" /><text x={sx(s.t0 + u / 1e6)} y={svgH - 6} textAnchor="middle" fontSize="11" fill="#7b8ba3">{u} µs</text></g>
            )) : <text x={375} y={svgH / 2} textAnchor="middle" fontSize="12" fill="#94a3b8">Run the code, then Trigger burst</text>}
            {s ? <g><line x1={sx(cur)} y1={10} x2={sx(cur)} y2={svgH - 24} stroke="#0f2547" strokeDasharray="4 3" /><text x={Math.min(sx(cur) + 4, 600)} y={12} fontSize="11" fontWeight="700" fill="#0f2547">{us(cur).toFixed(1)} µs</text></g> : null}
          </svg>
          <div className="mcl-l18-legend">
            <span><i className="solid" />executing</span><span><i className="hatch" />preempted (stacked, waiting to resume)</span><span><i className="dash" />pending (requested, not yet entered)</span><span><i className="tri" />request</span>
          </div>
          <p className="mcl-l16-note">Lower number = higher preemption priority. Times are simulated: the interpreter runs one C statement every {(1e6 / 120_000).toFixed(2)} µs, so handlers are longer than on silicon, but the order of entry, preemption and resumption is exactly what the NVIC does.</p>
        </Panel>

        <Panel title="NVIC Priority Editor" icon="sliders" className="g-editor">
          <div className="mcl-l18-prios">
            {EDITOR_ORDER.map((k) => {
              const q = IRQS.find((x) => x.key === k)!;
              const st = statusAt(s, q.handler, cur);
              const cp = codePrio(k), lp = livePrio(k);
              return (
                <div key={k} className="mcl-l18-prio">
                  <b><i style={{ background: q.color }} />{q.label}</b>
                  <select aria-label={`${q.label} priority`} value={cp ?? 0} disabled={cp === null} onChange={(e) => editPrio(k, Number(e.target.value))}>
                    {Array.from({ length: 16 }, (_, p) => <option key={p} value={p}>P{p}</option>)}
                  </select>
                  <span className={`st ${STATUS_CLS[st]}`}>{st}</span>
                  {cp !== null && lp !== null && cp !== lp ? <small>running P{lp}</small> : null}
                </div>
              );
            })}
          </div>
          <p className="mcl-l15-intro">Status is shown at the timeline cursor ({us(cur).toFixed(1)} µs into the burst). Click anywhere on the timeline to move it. Changing a priority rewrites its NVIC_SetPriority line and reruns.</p>
          <div className="mcl-g2-kv">
            <div><small>n_exti / n_tim</small><b>{fw?.num("n_exti") ?? 0} / {fw?.num("n_tim") ?? 0}</b></div>
            <div><small>n_uart · last byte</small><b>{fw?.num("n_uart") ?? 0} · {fw ? `0x${(fw.num("last_rx") & 0xff).toString(16).toUpperCase().padStart(2, "0")}` : "—"}</b></div>
            <div><small>n_tick (SysTick)</small><b>{fw?.num("n_tick") ?? 0}</b></div>
          </div>
        </Panel>

        <CodeEditor lab={lab} className="g-code" languages={[{ label: "Nested priorities", code: DEMO }, { label: "Equal priorities", code: EQUAL }, { label: "Inverted (UART first)", code: INVERTED }, { label: "Critical section in main", code: CRITICAL }]} />

        <div className="g-metrics mcl-l13-side">
          <Panel title="Latency Metrics" icon="wave">
            <div className="mcl-l18-metrics">
              <div><small>Preemptions</small><b>{mt.preemptions}</b></div>
              <div><small>Longest latency</small><b className={mt.longestUs > 50 ? "bad" : ""}>{mt.longestUs.toFixed(1)} µs</b></div>
              <div><small>Max nesting depth</small><b>{mt.depth}</b></div>
              <div><small>Context switches</small><b>{mt.switches}</b></div>
            </div>
            {mt.longestName ? <p className="mcl-l18-sub">Longest wait: {IRQS.find((q) => q.handler === mt.longestName)?.label}, held off by a handler of equal or higher priority{params.primask ? " or by PRIMASK" : ""}.</p> : null}
            <table className="mcl-table mcl-l18-table">
              <thead><tr><th>IRQ</th><th>P</th><th>Req</th><th>Wait</th><th>Run</th><th>Preempted by</th></tr></thead>
              <tbody>
                {rows.map(({ e, q, run, by }) => (
                  <tr key={e.id}>
                    <td><i style={{ background: q.color }} />{q.label}</td>
                    <td>{q.key === "SysTick" ? fw?.irqPriority.get("SysTick") ?? -1 : mcu.irqPriority(q.key)}</td>
                    <td className="mcl-mono">+{us(e.tReq).toFixed(1)}</td>
                    <td className={`mcl-mono ${e.blocked ? "bad" : ""}`}>{((e.t0 - e.tReq) * 1e6).toFixed(1)}</td>
                    <td className="mcl-mono">{(run * 1e6).toFixed(1)}</td>
                    <td>{by.length ? by.join(", ") : "—"}</td>
                  </tr>
                ))}
                {!rows.length ? <tr><td colSpan={6}>No burst captured yet.</td></tr> : null}
              </tbody>
            </table>
            <div className="mcl-g2-faults">
              <b><Icon name="bug" size={14} />Fault injection</b>
              <Toggle label="Main masks IRQs (PRIMASK) 1.5 ms every 20 ms" checked={params.primask} onChange={(v) => lab.setParam("primask", v)} hint="Like a long __disable_irq() section: a burst that lands in the window waits for all handlers, whatever their priority" />
              <Toggle label="EXTI0 not enabled in the NVIC" checked={params.extiOff} onChange={(v) => lab.setParam("extiOff", v)} hint="ISER0 bit 6 is 0: the highest-priority event is silently dropped" />
            </div>
          </Panel>
          <LearningNotes variant="tasks" title="Learning Tasks" notes={{
            takeaways: [],
            observe: "The default burst nests three deep: USART2 starts, TIM2 (P1) preempts it, then EXTI0 (P0) preempts TIM2. Each outer handler resumes only after the inner one returns.",
            tryIt: "Set all four priorities equal (or load \"Equal priorities\") and Trigger burst. Nothing preempts: the handlers run back to back and EXTI0 waits.",
            measure: s ? `Last burst: ${mt.preemptions} preemptions, depth ${mt.depth}, ${mt.switches} context switches, longest wait ${mt.longestUs.toFixed(1)} µs.` : "Trigger a burst to measure it.",
            modify: "Load \"Inverted (UART first)\": the emergency button now sits behind a slow UART parser. Read its Wait column.",
            runAgain: "Restore EXTI0 to P0 and rerun; compare the latency of the urgent event.",
            challenge: "Why do equal-priority interrupts never preempt each other, and what would sub-priority change when two of them are pending at once?",
            checks: [
              { label: "Saw nesting depth 3", done: seen.depth },
              { label: "Changed a priority and captured a burst", done: seen.prio },
              { label: "Captured a burst with no preemption", done: seen.equal },
              { label: "Made EXTI0 wait more than 50 µs", done: seen.waited },
            ],
          }} />
        </div>
      </div>
    </LabShell>
  );
}
