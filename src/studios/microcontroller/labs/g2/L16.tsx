import { useEffect, useState } from "react";
import { useLab } from "../core/useLab";
import type { LabMeta } from "../registry";
import { CodeEditor } from "../ui/CodeEditor";
import { Icon } from "../ui/Icon";
import { LearningNotes, Panel, Toggle } from "../ui/Panels";
import { Scope } from "../ui/Scope";
import { LabShell } from "../ui/Shell";
import {
  breakdown, CORE_HZ, CRITICAL, CYC_PER_STMT, DEMO, EXC_NUM, EXIT_CYC, isrActive, LONG_ISR, MSP_THREAD, NO_CLEAR, P16_DEFAULT, pcOf, pend, pendingReason,
  PHASES, setup16, state16, stepPhase, world16, type P16, type Phase,
} from "./L16sim";

const hex = (v: number) => `0x${(v >>> 0).toString(16).toUpperCase().padStart(8, "0")}`;
const LANES = [
  { key: "thread", label: "Thread", color: "#1677ff" },
  { key: "entry", label: "Exception Entry", color: "#f5a524" },
  { key: "isr", label: "ISR", color: "#16a34a" },
  { key: "exit", label: "Exception Exit", color: "#7c5cff" },
] as const;
const PHASE_TEXT: Record<Phase, string> = {
  main: "Thread mode: main() runs with PSP/MSP and IPSR = 0. Trigger IRQ sets the TIM2 pending bit in the NVIC.",
  request: "The NVIC compares TIM2's priority with the current execution priority and PRIMASK. If it wins, the core starts exception entry.",
  stacking: "Hardware pushes R0-R3, R12, LR, PC and xPSR (8 words, 32 bytes) onto the stack and fetches the vector at 0x000000B0 in parallel: 12 cycles.",
  isr: "PC = TIM2_IRQHandler, LR = EXC_RETURN 0xFFFFFFF9, IPSR = 44. Each Step executes one handler statement.",
  return: "BX LR with EXC_RETURN pops the 8-word frame (10 cycles) and resumes main() at the stacked PC, as if nothing happened.",
};

export default function L16({ meta }: { meta: LabMeta }) {
  const lab = useLab<P16>({
    slug: meta.slug, code: DEMO, params: P16_DEFAULT, rebuildOn: ["nvicOff"],
    mcu: () => ({ ips: 120_000, clock: CORE_HZ }),
    setup: (m) => setup16(m),
    world: world16,
  });
  const { mcu, params } = lab;
  const fw = mcu.fw;
  const s = state16(mcu), q = s.seq;
  const paused = !!fw?.paused;
  const stepping = !lab.running || paused;
  const [pick, setPick] = useState<number | null>(null);
  const [seen, setSeen] = useState<{ phases: Phase[]; sw: boolean; held: boolean; storm: boolean }>({ phases: [], sw: false, held: false, storm: false });

  const ev = (pick !== null ? s.events.find((e) => e.id === pick) : undefined) ?? s.events[s.events.length - 1];
  const b = ev ? breakdown(ev) : undefined;

  let phase: Phase = q.phase;
  if (!stepping) {
    const age = ev ? mcu.now - ev.t0 : Infinity;
    phase = isrActive(mcu) ? "isr" : age < 0.08 ? "request" : age < 0.16 ? "stacking" : age < 0.34 ? "isr" : age < 0.44 ? "return" : "main";
  }
  useEffect(() => {
    if (stepping && !seen.phases.includes(q.phase)) setSeen((x) => ({ ...x, phases: [...x.phases, q.phase] }));
  }, [stepping, q.phase, seen.phases]);

  const world = () => world16(mcu, 0.001, params);
  const trigger = () => {
    if (!stepping) { pend(mcu); lab.advance(0); return; }
    q.pend = true;
    lab.setNotice("TIM2 pending bit set (NVIC_ISPR0 bit 28). Press Step to watch the NVIC accept it.");
    lab.advance(0);
  };
  const step = () => {
    if (lab.running && !paused) lab.toggle();
    const msg = stepPhase(mcu, world);
    if (msg) lab.setNotice(msg);
    setPick(null);
    lab.advance(0);
  };
  const run = () => {
    if (q.pend) { q.pend = false; pend(mcu); }
    q.phase = "main";
    if (stepping) lab.toggle();
  };

  const inExc = stepping ? q.phase === "stacking" || q.phase === "isr" : isrActive(mcu);
  const stackedLine = stepping && q.phase !== "main" ? q.stackedLine : ev?.line ?? 0;
  const cycles = stepping && q.phase !== "main" ? q.cycles : b?.total ?? 0;
  const reason = pendingReason(mcu);
  const prio = mcu.irqPriority("TIM2");
  const primask = fw && !fw.globalIrqEnabled ? 1 : 0;
  const recent = s.events.filter((e) => e.t0 > mcu.now - 0.1).length;
  const storm = recent > 20;
  const sw = s.events.some((e) => e.src === "software");
  const held = s.events.some((e) => breakdown(e).heldUs > 100);
  useEffect(() => {
    if ((sw && !seen.sw) || (held && !seen.held) || (storm && !seen.storm)) setSeen((x) => ({ ...x, sw: x.sw || sw, held: x.held || held, storm: x.storm || storm }));
  }, [sw, held, storm, seen.sw, seen.held, seen.storm]);

  // Cycle-domain bars for the selected event, or for the sequence being stepped.
  const live = stepping && q.phase !== "main";
  const entry = live ? (q.phase === "request" ? 0 : 12) : b?.entry ?? 12;
  const isrC = live ? q.isrStmts * CYC_PER_STMT : b?.isr ?? 0;
  const exitC = live ? (q.phase === "return" ? EXIT_CYC : 0) : b ? EXIT_CYC : 0;
  const span = Math.max(48, entry + isrC + exitC + 24);
  const X0 = 120, X1 = 620, sx = (c: number) => X0 + ((c + 12) / span) * (X1 - X0);
  const bars: Record<string, Array<[number, number]>> = {
    thread: [[-12, 0], ...(exitC ? [[entry + isrC + exitC, span - 12] as [number, number]] : [])],
    entry: entry ? [[0, entry]] : [],
    isr: isrC ? [[entry, entry + isrC]] : [],
    exit: exitC ? [[entry + isrC, entry + isrC + exitC]] : [],
  };
  const tickStep = span > 160 ? 40 : span > 80 ? 20 : 10;

  const isrEdges: Array<[number, number]> = s.events.flatMap((e) => [[e.t0, 1], [e.t1, 0]] as Array<[number, number]>);
  for (const o of s.open) isrEdges.push([o.t0, 1]);

  const rows: Array<[string, string, string?]> = [
    ["Active IRQ", inExc ? "TIM2 (IRQ 28)" : "none", inExc ? "hi" : ""],
    ["Priority", String(prio)],
    ["PRIMASK", String(primask), primask ? "bad" : ""],
    ["Stacked PC", stackedLine ? hex(pcOf(stackedLine)) : "—"],
    ["Cycles", cycles ? `${cycles}` : "—"],
    ["Pending", reason ? `1 · ${reason}` : "0", reason && reason !== "waiting for Step" ? "warn" : ""],
    ["NVIC enable", mcu.nvicEnabled("TIM2") ? "1 (ISER0.28)" : "0", mcu.nvicEnabled("TIM2") ? "" : "bad"],
    ["IPSR", inExc ? String(EXC_NUM) : "0 (Thread)"],
    ["SP (MSP)", hex(inExc ? MSP_THREAD - 32 : MSP_THREAD)],
    ["LR", inExc ? "0xFFFFFFF9 EXC_RETURN" : "—"],
  ];
  const frame: Array<[string, string]> = [
    ["R0", "caller-saved"], ["R1", "caller-saved"], ["R2", "caller-saved"], ["R3", "caller-saved"], ["R12", "caller-saved"],
    ["LR", "main's LR"], ["PC", stackedLine ? `${hex(pcOf(stackedLine))} · line ${stackedLine}` : "—"], ["xPSR", "0x01000000 (T bit)"],
  ];

  return (
    <LabShell meta={meta} lab={lab} subtitle="Trace interrupt request, stacking, ISR execution and exception return step by step."
      components={["NUCLEO-F401RE (STM32F401RE, Cortex-M4 at 16 MHz HSI)", "TIM2 update interrupt every 500 ms", "LD2 user LED on PA5", "NVIC with 4 priority bits"]}>
      <div className="mcl-l16-grid">
        <Panel title="Interrupt Execution Timeline" icon="bolt" className="g-timeline" tools={<span className={`mcl-chip ${storm ? "mcl-chip-bad" : reason && reason !== "waiting for Step" ? "mcl-chip-warn" : "mcl-chip-live"}`}>{storm ? "re-entry storm" : `${fw?.num("ticks") ?? 0} IRQs serviced`}</span>}>
          <div className="mcl-l16-phases" role="list" aria-label="Exception phases">
            {PHASES.map((p, i) => (
              <div key={p.key} role="listitem" className={`p-${p.key} ${phase === p.key ? "on" : ""}`} aria-current={phase === p.key ? "step" : undefined}>
                {i ? <i /> : null}<span>{p.label}</span>
              </div>
            ))}
          </div>
          <svg viewBox="0 0 640 176" className="mcl-svg mcl-l16-lanes" role="img" aria-label="Exception timing in CPU cycles">
            {LANES.map((l, i) => {
              const y = 22 + i * 36;
              return (
                <g key={l.key}>
                  <text x={4} y={y + 5} fontSize="12" fill="#64748b">{l.label}</text>
                  <line x1={X0} y1={y + 14} x2={X1} y2={y + 14} stroke="#e2e8f0" />
                  {bars[l.key]!.map(([a, c]) => (
                    <g key={`${a}-${c}`}>
                      <rect x={sx(a)} y={y - 7} width={Math.max(2, sx(c) - sx(a))} height={16} rx={2} fill={l.color} />
                      {sx(c) - sx(a) > 40 && l.key !== "thread" ? <text x={(sx(a) + sx(c)) / 2} y={y + 5} textAnchor="middle" fontSize="10.5" fontWeight="800" fill="#fff">{c - a} cyc</text> : null}
                    </g>
                  ))}
                </g>
              );
            })}
            {Array.from({ length: Math.floor((span - 12) / tickStep) + 1 }, (_, k) => k * tickStep).map((c) => (
              <g key={c}><line x1={sx(c)} y1={160} x2={sx(c)} y2={164} stroke="#94a3b8" /><text x={sx(c)} y={175} textAnchor="middle" fontSize="10" fill="#94a3b8">{c}</text></g>
            ))}
            <line x1={sx(0)} y1={10} x2={sx(0)} y2={160} stroke="#ef4444" strokeDasharray="3 3" />
            <text x={sx(0) + 3} y={11} fontSize="8.5" fill="#ef4444">IRQ taken</text>
          </svg>
          <div className="mcl-g2-kv mcl-l16-kv">
            <div><small>Request → entry</small><b className={b && b.heldUs > 5 ? "bad" : ""}>{b ? (b.heldUs > 5 ? `${b.heldUs.toFixed(0)} µs held` : ev!.tail ? "tail-chained" : "immediate") : "—"}</b></div>
            <div><small>Entry + ISR + exit</small><b>{b ? `${b.entry} + ${b.isr} + ${b.exit}` : "—"}</b></div>
            <div><small>Total at 16 MHz</small><b>{b ? `${b.total} cyc · ${((b.total / CORE_HZ) * 1e6).toFixed(2)} µs` : "—"}</b></div>
          </div>
          <div className="mcl-l16-hist">
            <span>Recent IRQs</span>
            {s.events.slice(-6).reverse().map((e) => (
              <button key={e.id} type="button" className={ev?.id === e.id ? "on" : ""} onClick={() => setPick(e.id)}>#{e.id} {e.src === "software" ? "SW pend" : "timer"} · {e.t0.toFixed(2)} s</button>
            ))}
            {!s.events.length ? <em>none yet</em> : null}
          </div>
          <Scope lanes traces={[
            { label: "TIM2 ISR", color: "#16a34a", edges: isrEdges, initial: 0 },
            { label: "LD2 PA5", color: "#1677ff", edges: mcu.edges.get("PA5") ?? [], initial: 0 },
          ]} now={mcu.time} window={2} height={92} frame={lab.frame} ariaLabel="TIM2 interrupt activity and LED over the last two seconds" />
          <p className="mcl-l16-note">Cycle counts use the Cortex-M4 exception timing (12 entry, 10 exit, 6 tail-chain) and a model of {CYC_PER_STMT} cycles per C statement; the firmware itself runs in the C interpreter, not as a compiled ARM binary.</p>
        </Panel>

        <Panel title="CPU / NVIC State" icon="grid" className="g-cpu">
          <div className="mcl-l16-state">
            {rows.map(([k, v, cls]) => <div key={k}><span>{k}</span><b className={cls}>{v}</b></div>)}
          </div>
          <div className="mcl-l16-frame">
            <b>Exception stack frame {inExc ? `at ${hex(MSP_THREAD - 32)}` : "(last)"}</b>
            <table className="mcl-table">
              <tbody>{frame.map(([r, v], i) => <tr key={r}><td className="mcl-mono">+0x{(i * 4).toString(16).toUpperCase().padStart(2, "0")}</td><td>{r}</td><td className="mcl-mono">{v}</td></tr>)}</tbody>
            </table>
          </div>
          <div className="mcl-g2-kv">
            <div><small>ticks (ISR)</small><b>{fw?.num("ticks") ?? 0}</b></div>
            <div><small>work (main)</small><b className={storm ? "bad" : ""}>{fw?.num("work") ?? 0}</b></div>
            <div><small>LD2</small><b className={mcu.pin("PA5").level ? "ok" : ""}>{mcu.pin("PA5").level ? "ON" : "off"}</b></div>
          </div>
        </Panel>

        <CodeEditor lab={lab} className="g-code" languages={[{ label: "TIM2 interrupt", code: DEMO }, { label: "Critical section", code: CRITICAL }, { label: "Bug: UIF not cleared", code: NO_CLEAR }, { label: "Long ISR", code: LONG_ISR }]} />

        <div className="g-step mcl-l13-side">
          <Panel title="Step Through Interrupt" icon="target">
            <div className="mcl-l16-btns">
              <button type="button" className="trig" onClick={trigger}>Trigger IRQ</button>
              <button type="button" onClick={step}>Step</button>
              <button type="button" onClick={run} disabled={!stepping && !q.pend}>Run</button>
            </div>
            <p className="mcl-l15-intro">Watch the CPU push context, branch to the vector, execute the ISR, restore context, and resume the interrupted instruction.</p>
            <div className={`mcl-l16-now p-${phase}`}><b>{PHASES.find((p) => p.key === phase)!.label}{stepping ? " · stepping" : " · running"}</b><span>{PHASE_TEXT[phase]}</span></div>
            <div className="mcl-g2-faults">
              <b><Icon name="bug" size={14} />Fault injection</b>
              <Toggle label="PRIMASK stuck at 1" checked={params.primask} onChange={(v) => lab.setParam("primask", v)} hint="As if __enable_irq() were never reached: requests pend, nothing is serviced until it clears" />
              <Toggle label="TIM2 disabled in the NVIC" checked={params.nvicOff} onChange={(v) => lab.setParam("nvicOff", v)} hint="UIF and the pending bit are set, but ISER0 bit 28 is 0, so the core never takes the IRQ" />
            </div>
          </Panel>
          <LearningNotes variant="tasks" title="Learning Tasks" notes={{
            takeaways: [],
            observe: "Every 500 ms the timeline flashes Request → Stacking → ISR → Return and LD2 toggles. The lanes show where the 12 + ISR + 10 cycles go.",
            tryIt: "Press Step to halt, then Trigger IRQ and keep pressing Step. The editor highlights each handler line while the CPU state shows IPSR = 44 and LR = EXC_RETURN.",
            measure: b ? `Last IRQ: ${b.entry} entry + ${b.isr} ISR + ${b.exit} exit = ${b.total} cycles (${((b.total / CORE_HZ) * 1e6).toFixed(2)} µs), interrupted line ${ev!.line}.` : "Run until the first TIM2 interrupt to measure it.",
            modify: "Load \"Critical section\" and Run: requests arrive while PRIMASK = 1 and Request → entry shows how long they were held off.",
            runAgain: "Load \"Bug: UIF not cleared\" and Run: the ISR re-enters forever and work (main) freezes. Restore the SR line and run again.",
            challenge: "Why does the handler clear TIM2->SR first rather than last, and what would tail-chaining save if two IRQs arrive back to back?",
            checks: [
              { label: "Stepped through all five phases", done: seen.phases.length >= 5 },
              { label: "Triggered a software IRQ", done: seen.sw },
              { label: "Measured an IRQ held off by PRIMASK", done: seen.held },
              { label: "Reproduced the UIF re-entry storm", done: seen.storm },
            ],
          }} />
        </div>
      </div>
    </LabShell>
  );
}
