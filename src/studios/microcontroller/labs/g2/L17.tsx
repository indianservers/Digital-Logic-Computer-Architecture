import { useEffect, useState } from "react";
import { useLab } from "../core/useLab";
import type { LabMeta } from "../registry";
import { CodeEditor } from "../ui/CodeEditor";
import { Breadboard, HwDefs, SvgButton, SvgLed, Wire } from "../ui/Hardware";
import { Icon } from "../ui/Icon";
import { LearningNotes, Panel, Toggle } from "../ui/Panels";
import { Scope } from "../ui/Scope";
import { LabShell } from "../ui/Shell";
import { BenchChip } from "./Bench";
import { CORE_HZ, CYC_PER_STMT, ENTRY_CYC, state16 } from "./L16sim";
import {
  applyConfig, bench17, codeConfig, debounceOf, DEMO, extiEvents, HAL_DEMO, liveConfig, NO_DEBOUNCE, NO_PR_CLEAR, noisyContact, P17_DEFAULT,
  setup17, tap, timingOf, world17, type P17, type Trigger,
} from "./L17sim";

const TRIGGER_LABEL: Record<Trigger | "none", string> = { rising: "Rising Edge", falling: "Falling Edge", both: "Both Edges", none: "None" };
const ISR_NAMES = new Set(["EXTI0_IRQHandler", "HAL_GPIO_EXTI_Callback"]);
const noise = (t: number) => { const x = Math.sin(Math.floor(t * 4000) * 12.9898) * 43758.5453; return x - Math.floor(x) > 0.5 ? 1 : 0; };

export default function L17({ meta }: { meta: LabMeta }) {
  const lab = useLab<P17>({
    slug: meta.slug, code: DEMO, params: P17_DEFAULT, rebuildOn: ["syscfgOff"],
    mcu: () => ({ ips: 120_000, clock: CORE_HZ, strictClock: true }),
    setup: (m, p) => setup17(m, p),
    world: world17,
  });
  const { mcu, params } = lab;
  const fw = mcu.fw;
  const b = bench17(mcu);
  const live = liveConfig(mcu);
  const cc = codeConfig(lab.code);
  const dbMs = debounceOf(lab.code);
  const raw = fw?.num("raw_irqs") ?? 0, accepted = fw?.num("event_count") ?? 0;
  const rejected = Math.max(0, raw - accepted);
  const floating = mcu.isFloating("PA0");
  const pa0 = floating ? -1 : mcu.pin("PA0").level;
  const pb0 = mcu.pin("PB0").level;
  const ledOn = mcu.pin("PA5").level === 1;
  const nvicOn = mcu.nvicEnabled("EXTI0");

  const [zoom, setZoom] = useState<"edge" | "live">("edge");
  const [pending, setPending] = useState<string | null>(null);
  const [seen, setSeen] = useState({ bounce: false, edge: false, pb0: false, fault: false });
  useEffect(() => { if (pending !== null && lab.code === pending) { setPending(null); lab.run(); } }, [pending, lab]);

  const edit = (c: Parameters<typeof applyConfig>[1]) => {
    const next = applyConfig(lab.code, c);
    if (!next) { lab.setNotice("The EXTI controls rewrite the register version of the code. Load \"Register EXTI\" in the editor to use them."); return; }
    lab.setCode(next); setPending(next);
  };

  // ISR activity: completed runs plus any handler still executing.
  const evs = extiEvents(mcu);
  const open = state16(mcu).open.filter((e) => ISR_NAMES.has(e.name));
  const isrEdges: Array<[number, number]> = evs.flatMap((e) => [[e.t0, 1], [e.t1, 0]] as Array<[number, number]>);
  for (const o of open) isrEdges.push([o.t0, 1]);
  const srcKey = live.port === 1 ? "PB0" : "PA0";
  const srcTrace = mcu.edges.get(srcKey) ?? [];
  const sinceT = b.pressT < 0 ? Infinity : b.pressT - 1e-6;
  const burstEvs = evs.filter((e) => e.tReq >= sinceT);
  const burstEdges = srcTrace.filter(([t]) => t >= sinceT).length;
  const first = timingOf(burstEvs[0] ?? evs[evs.length - 1]);
  const held = burstEvs.filter((e) => e.blocked).length;
  const view = zoom === "edge" && b.pressT >= 0 ? { now: Math.min(mcu.time, b.pressT + 0.036), window: 0.04 } : { now: mcu.time, window: 2 };
  const storm = evs.filter((e) => e.t0 > mcu.now - 0.1).length > 20;

  const bounce = b.physical > 0 && rejected > 0 && params.bounce > 0;
  const edge = (live.trigger === "falling" || live.trigger === "both") && accepted > 0;
  const viaPb0 = live.port === 1 && accepted > 0;
  const fault = storm || (params.floating && raw > 0 && b.physical === 0);
  useEffect(() => {
    if ((bounce && !seen.bounce) || (edge && !seen.edge) || (viaPb0 && !seen.pb0) || (fault && !seen.fault))
      setSeen((x) => ({ bounce: x.bounce || bounce, edge: x.edge || edge, pb0: x.pb0 || viaPb0, fault: x.fault || fault }));
  }, [bounce, edge, viaPb0, fault, seen]);

  const portMismatch = lab.running && cc.editable && cc.port !== null && cc.port !== live.port;
  const lvl = (v: number) => (v < 0 ? "FLOAT" : v ? "HIGH" : "LOW");
  const wireY = { PA5: 66, PA0: 104, PB0: 126 };
  const regs: Array<[string, string, string?]> = [
    ["SYSCFG_EXTICR1[3:0]", `${live.port} (P${"AB"[live.port] ?? "?"}0)`, portMismatch ? "bad" : ""],
    ["EXTI_IMR.MR0", live.mask ? "1" : "0", live.mask ? "" : "warn"],
    ["EXTI_RTSR.TR0", String(mcu.peek("EXTI.RTSR") & 1)],
    ["EXTI_FTSR.TR0", String(mcu.peek("EXTI.FTSR") & 1)],
    ["EXTI_PR.PR0", live.pending ? "1 pending" : "0", live.pending ? "warn" : ""],
    ["NVIC_ISER0[6]", nvicOn ? "1" : "0", nvicOn ? "" : "bad"],
  ];

  return (
    <LabShell meta={meta} lab={lab} subtitle="Trigger EXTI from buttons and sensors, inspect edge detection, debounce and event timing."
      components={["NUCLEO-F401RE (STM32F401RE, Cortex-M4 at 16 MHz HSI)", "LED + 330 Ω on PA5", "SW1 tactile switch PA0 → 3V3 (bouncy contacts), internal pull-down", "SW2 tactile switch PB0 → 3V3 (clean), internal pull-down", "EXTI line 0, IRQ 6 (EXTI0_IRQn)"]}>
      <div className="mcl-g2-grid">
        <Panel title="External Interrupt Experiment" icon="bolt" className="mcl-sim g-bench" tools={
          <span className={`mcl-chip ${storm ? "mcl-chip-bad" : live.mask && nvicOn ? "mcl-chip-live" : "mcl-chip-warn"}`}>{storm ? "EXTI0 re-entry storm" : `EXTI0 · ${TRIGGER_LABEL[live.trigger]}${live.mask ? "" : " · masked"}`}</span>
        }>
          <div className="mcl-g2-mat">
            <svg viewBox="0 0 470 220" className="mcl-svg" role="img" aria-label="STM32 with an LED and two push buttons on a breadboard; EXTI line 0 routing">
              <HwDefs id="l17" />
              <BenchChip note={`EXTI0 ← P${"AB"[live.port] ?? "?"}0`} pins={[
                { key: "PA5", y: wireY.PA5, level: ledOn ? 1 : 0, tag: "LED" },
                { key: "PA0", y: wireY.PA0, level: pa0, tag: "SW1", selected: live.port === 0, onSelect: () => edit({ port: 0 }) },
                { key: "PB0", y: wireY.PB0, level: pb0, tag: "SW2", selected: live.port === 1, onSelect: () => edit({ port: 1 }) },
              ]} />
              <Breadboard x={290} y={34} w={168} h={146} cols={12} rows={7} />
              <Wire d={`M250 ${wireY.PA5} C 275 ${wireY.PA5}, 300 56, 330 56`} color="#ef4444" live={ledOn} />
              <Wire d={`M250 ${wireY.PA0} C 285 ${wireY.PA0}, 320 128, 350 140`} color="#2563eb" live={pa0 === 1} />
              <Wire d={`M250 ${wireY.PB0} C 290 ${wireY.PB0}, 380 128, 406 140`} color="#16a34a" live={pb0 === 1} />
              <line x1={327} y1={78} x2={327} y2={98} stroke="#9ca3af" strokeWidth={1.6} />
              <line x1={333} y1={78} x2={333} y2={102} stroke="#9ca3af" strokeWidth={1.6} />
              <SvgLed x={330} y={70} r={9} on={ledOn} color="red" id="l17" />
              <text x={330} y={114} textAnchor="middle" fontSize="8" fill="#4b6283">LED · PA5</text>
              <SvgButton x={350} y={152} size={20} pressed={params.sw1 || mcu.time < b.tapUntil[0]} onPress={(d) => lab.setParam("sw1", d)} label="SW1" />
              <SvgButton x={406} y={152} size={20} pressed={params.sw2 || mcu.time < b.tapUntil[1]} onPress={(d) => lab.setParam("sw2", d)} label="SW2" />
              {live.pending ? <circle cx={240} cy={live.port === 1 ? wireY.PB0 : wireY.PA0} r={5} fill="#f59e0b"><title>EXTI_PR.PR0 pending</title></circle> : null}
              {params.floating ? <text x={140} y={204} textAnchor="middle" fontSize="9" fontWeight="700" fill="#b42318">PA0 pull-down removed · input floating</text> : null}
            </svg>
          </div>
          <div className="mcl-g2-kv">
            <div><small>Physical presses</small><b>{b.physical}</b></div>
            <div><small>EXTI0 IRQs (raw_irqs)</small><b className={raw > accepted ? "bad" : ""}>{raw}</b></div>
            <div><small>LED PA5</small><b className={ledOn ? "ok" : ""}>{ledOn ? "ON" : "off"}</b></div>
          </div>
          <p className="mcl-g2-hint"><Icon name="bulb" size={14} />Press a button on the breadboard (or click PA0 / PB0 on the chip to route EXTI0). SW1 bounces like a real tactile switch; SW2 is clean.</p>
        </Panel>

        <Panel title="EXTI Configuration" icon="sliders" className="g-ctl">
          <div className="mcl-g2-row"><span>Pin</span>
            <select className="mcl-l17-pill" aria-label="EXTI0 source pin" value={cc.port ?? live.port} disabled={!cc.editable} onChange={(e) => edit({ port: Number(e.target.value) as 0 | 1 })}>
              <option value={0}>PA0 / EXTI0</option><option value={1}>PB0 / EXTI0</option>
            </select>
          </div>
          <div className="mcl-g2-row"><span>Trigger</span>
            <select className="mcl-l17-pill" aria-label="Edge trigger" value={cc.trigger && cc.trigger !== "none" ? cc.trigger : live.trigger === "none" ? "rising" : live.trigger} disabled={!cc.editable} onChange={(e) => edit({ trigger: e.target.value as Trigger })}>
              <option value="rising">Rising Edge</option><option value="falling">Falling Edge</option><option value="both">Both Edges</option>
            </select>
          </div>
          <div className="mcl-g2-row"><span>Debounce</span>
            <span className="mcl-g2-stepper">
              <button type="button" aria-label="Decrease debounce" onClick={() => edit({ debounce: (Number.isFinite(dbMs) ? dbMs : 20) - 5 })}>−</button>
              <code>{Number.isFinite(dbMs) ? `${dbMs} ms` : "n/a"}</code>
              <button type="button" aria-label="Increase debounce" onClick={() => edit({ debounce: (Number.isFinite(dbMs) ? dbMs : 20) + 5 })}>+</button>
            </span>
          </div>
          <div className="mcl-g2-row"><span>Mask</span>
            <button type="button" className={`mcl-l17-pill ${(cc.mask ?? live.mask) ? "" : "off"}`} disabled={!cc.editable} aria-pressed={cc.mask ?? live.mask}
              onClick={() => edit({ mask: !(cc.mask ?? live.mask) })}>{(cc.mask ?? live.mask) ? "Enabled" : "Masked"}</button>
          </div>
          <div className="mcl-l17-regs" aria-label="Live EXTI register readback">
            {regs.map(([k, v, cls]) => <div key={k}><span>{k}</span><b className={cls}>{v}</b></div>)}
          </div>
          {!cc.editable ? <p className="mcl-g2-hint"><Icon name="bulb" size={14} />The HAL version configures EXTI inside HAL_GPIO_Init from g.Mode; edit GPIO_MODE_IT_RISING in code, or load "Register EXTI" to use these controls.</p> : null}
          {portMismatch ? <p className="mcl-g2-hint warn"><Icon name="alert" size={14} />The code selects P{"AB"[cc.port ?? 0]}0, but EXTICR1 reads {live.port}: the write did not stick. Check the peripheral clock that SYSCFG needs.</p> : null}
        </Panel>

        <Panel title="Event Timing" icon="wave" className="g-scope" tools={
          <div className="mcl-g2-btns"><button type="button" className={zoom === "edge" ? "on blue" : ""} onClick={() => setZoom("edge")}>Last event · 40 ms</button><button type="button" className={zoom === "live" ? "on blue" : ""} onClick={() => setZoom("live")}>Live · 2 s</button></div>
        }>
          <Scope traces={[
            floating && live.port === 0 ? { label: "PA0 raw", color: "#f59e0b", sample: noise, min: -0.25, max: 1.25, step: true } : { label: `${srcKey} input`, color: "#3b82f6", edges: srcTrace, initial: 0 },
            { label: "EXTI0 IRQ", color: "#f59e0b", edges: isrEdges, initial: 0 },
            { label: "LED PA5", color: "#22c55e", edges: mcu.edges.get("PA5") ?? [], initial: 0 },
          ]} lanes now={view.now} window={view.window} height={160} frame={lab.frame} ariaLabel="Input pin, EXTI0 interrupt activity and LED"
            markers={b.pressT >= 0 ? [{ t: b.pressT, label: "event", color: "#94a3b8" }] : []} />
          <p className="mcl-l17-timing">IRQ latency: {first ? `${first.latencyUs.toFixed(2)} µs` : "—"} <span>•</span> ISR: {first ? `${first.isrUs.toFixed(2)} µs (${first.isrCyc} cyc)` : "—"}</p>
          <div className="mcl-g2-kv">
            <div><small>Edges in last event</small><b className={burstEdges > 2 ? "bad" : ""}>{burstEdges}</b></div>
            <div><small>IRQs in last event</small><b className={burstEvs.length > 1 ? "bad" : ""}>{burstEvs.length}</b></div>
            <div><small>Tail-chained / held</small><b>{held}</b></div>
          </div>
          <p className="mcl-l16-note">Latency is the {ENTRY_CYC}-cycle Cortex-M4 entry at 16 MHz plus any time the request waited behind an active EXTI0 handler; ISR time models {CYC_PER_STMT} cycles per C statement of the interpreted firmware.</p>
        </Panel>

        <CodeEditor lab={lab} className="g-code" languages={[{ label: "Register EXTI", code: DEMO }, { label: "HAL callback", code: HAL_DEMO }, { label: "No debounce", code: NO_DEBOUNCE }, { label: "Bug: PR not cleared", code: NO_PR_CLEAR }]} />

        <div className="g-tasks mcl-l13-side">
          <Panel title="Trigger Sources" icon="target">
            <p className="mcl-l15-intro">Press the button, simulate a noisy contact, switch from rising to falling edge, and compare accepted events against rejected bounce pulses.</p>
            <div className="mcl-g2-btns four mcl-l17-src">
              <button type="button" onClick={() => tap(mcu, 0)} disabled={!lab.running}>Tap SW1 (PA0)</button>
              <button type="button" onClick={() => tap(mcu, 1)} disabled={!lab.running}>Tap SW2 (PB0)</button>
              <button type="button" onClick={() => noisyContact(mcu)} disabled={!lab.running}>Noisy contact</button>
              <button type="button" onClick={() => edit({ trigger: live.trigger === "rising" ? "falling" : "rising" })} disabled={!cc.editable}>{live.trigger === "rising" ? "Switch to falling" : "Switch to rising"}</button>
            </div>
            <label className="mcl-g2-range">SW1 bounce<input type="range" min={0} max={20} step={1} value={params.bounce} onChange={(e) => lab.setParam("bounce", Number(e.target.value))} /><output>{params.bounce} ms</output></label>
            <div className="mcl-g2-row"><span>PA0 / PB0</span><span className="mcl-l17-levels"><b className={`mcl-g2-state ${pa0 < 0 ? "warn" : pa0 ? "hi" : ""}`}>{lvl(pa0)}</b><b className={`mcl-g2-state ${pb0 ? "hi" : ""}`}>{lvl(pb0)}</b></span></div>
            <div className="mcl-g2-kv">
              <div><small>Accepted events</small><b className="ok">{accepted}</b></div>
              <div><small>Rejected pulses</small><b className={rejected ? "bad" : ""}>{rejected}</b></div>
              <div><small>Noise bursts</small><b>{b.noisy}</b></div>
            </div>
            {Number.isFinite(dbMs) && dbMs > 0 && dbMs <= params.bounce ? <p className="mcl-g2-hint warn"><Icon name="alert" size={14} />DEBOUNCE_MS ({dbMs} ms) is not longer than the release bounce ({params.bounce} ms): the lock can reopen mid-bounce and count a release as a press.</p> : null}
            <div className="mcl-g2-faults">
              <b><Icon name="bug" size={14} />Fault injection</b>
              <Toggle label="PA0 pull-down missing" checked={params.floating} onChange={(v) => lab.setParam("floating", v)} hint="PUPDR0 forced to 00: with SW1 open, PA0 floats and stray spikes cross VIH, raising phantom EXTI0 interrupts" />
              <Toggle label="SYSCFG clock not enabled" checked={params.syscfgOff} onChange={(v) => lab.setParam("syscfgOff", v)} hint="RCC_APB2ENR.SYSCFGEN stays 0, so EXTICR writes are ignored: EXTI0 stays on PA0 whatever the code asks for" />
            </div>
          </Panel>
          <LearningNotes variant="tasks" title="Learning Tasks" notes={{
            takeaways: [],
            observe: "Press SW1. The blue input trace chatters, the orange EXTI0 lane shows several short handler runs, yet the LED toggles once: the ISR accepts the first edge and locks out the rest.",
            tryIt: "Load \"No debounce\" and Run, then tap SW1 a few times. Accepted events race ahead of physical presses and the LED ends in a random state.",
            measure: first ? `Last event: ${burstEdges} edges, ${burstEvs.length} IRQs, latency ${first.latencyUs.toFixed(2)} µs, ISR ${first.isrUs.toFixed(2)} µs. ${accepted} accepted, ${rejected} rejected.` : "Press SW1 to measure an EXTI0 event.",
            modify: "Switch the trigger to Falling Edge, or route EXTI0 to PB0 with the Pin selector. The editor shows exactly which register line changed.",
            runAgain: "Rerun and compare when the LED toggles: on press (rising) or on release (falling).",
            challenge: "Load \"Bug: PR not cleared\" and press SW1. Why does the handler run forever, and why must EXTI->PR be written with 1 rather than 0?",
            checks: [
              { label: "Saw bounce pulses rejected by the ISR", done: seen.bounce },
              { label: "Fired EXTI0 on a falling (or both) edge", done: seen.edge },
              { label: "Routed EXTI0 to PB0 and caught SW2", done: seen.pb0 },
              { label: "Reproduced a PR storm or phantom IRQs", done: seen.fault },
            ],
          }} />
        </div>
      </div>
    </LabShell>
  );
}
