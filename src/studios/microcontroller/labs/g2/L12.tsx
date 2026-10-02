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
import { bench12, debounceOf, INTEGRATOR, NAIVE, P12_DEFAULT, TIMER, world12, type P12 } from "./L12sim";

const noise = (t: number) => { const x = Math.sin(Math.floor(t * 4000) * 12.9898) * 43758.5453; return x - Math.floor(x) > 0.5 ? 1 : 0; };

export default function L12({ meta }: { meta: LabMeta }) {
  const lab = useLab<P12>({ slug: meta.slug, code: TIMER, params: P12_DEFAULT, mcu: () => ({ ips: 120_000 }), world: world12 });
  const { mcu, params, compiledCode } = lab;
  const b = bench12(mcu);
  const fw = mcu.fw;
  const rawEdges = fw?.field("rawEdges") ?? 0, presses = fw?.field("presses") ?? 0;
  const stable = fw?.field("stable") ?? 1;
  const floating = mcu.isFloating("PA0");
  const raw = floating ? -1 : mcu.pin("PA0").level;
  const pupd = mcu.peek("GPIOA.PUPDR") & 3;
  const ledOn = mcu.pin("PA5").level === 1;
  const dbMs = debounceOf(compiledCode);

  const [zoom, setZoom] = useState<"edge" | "live">("edge");
  const [pending, setPending] = useState<string | null>(null);
  const [seen, setSeen] = useState({ bounce: false, match: false, changed: false, extra: false });
  useEffect(() => { if (pending !== null && lab.code === pending) { setPending(null); lab.run(); } }, [pending, lab]);
  const setDebounce = (ms: number) => {
    const v = Math.max(0, Math.min(200, ms));
    const next = /#define\s+DEBOUNCE_MS\s+\d+/.test(lab.code) ? lab.code.replace(/#define\s+DEBOUNCE_MS\s+\d+/, `#define DEBOUNCE_MS ${v}`) : lab.code;
    lab.setCode(next); setPending(next);
  };

  const rawTrace = mcu.edges.get("PA0") ?? [];
  const sinceT = b.pressT < 0 ? Infinity : b.pressT - 1e-6;
  const lastBurst = rawTrace.filter(([t]) => t >= sinceT);
  const settle = lastBurst.length > 1 ? (lastBurst[lastBurst.length - 1]![0] - lastBurst[0]![0]) * 1000 : 0;
  const liveEnd = Math.min(mcu.time, b.pressT + 0.034);
  const view = zoom === "edge" && b.pressT >= 0 ? { now: liveEnd, window: 0.04 } : { now: mcu.time, window: 2 };
  const ledEdges = mcu.edges.get("PA5") ?? [];

  if (!seen.bounce && lastBurst.length > 2) setSeen((s) => ({ ...s, bounce: true }));
  if (!seen.match && b.physical >= 5 && presses === b.physical && !params.sw1) setSeen((s) => ({ ...s, match: true }));
  if (!seen.changed && Number.isFinite(dbMs) && dbMs !== 20 && lab.status === "running") setSeen((s) => ({ ...s, changed: true }));
  if (!seen.extra && presses > b.physical && b.physical > 0) setSeen((s) => ({ ...s, extra: true }));

  const lvl = (v: number) => (v < 0 ? "FLOAT" : v ? "HIGH" : "LOW");
  const wireY = { PA5: 66, PA0: 104, PA1: 126, PA4: 148 };

  return (
    <LabShell meta={meta} lab={lab} subtitle="Read pushbuttons, see contact bounce on a real time base and filter it in firmware."
      components={["NUCLEO-F401RE (STM32F401RE)", "LED + 330 Ω on PA5", "SW1 tactile switch PA0 → GND (bouncy contacts)", "SW2 tactile switch PA1 → GND with 10 kΩ / 470 nF RC filter", "SW3 PA4 → GND (clears counters)", "Internal pull-ups on all three inputs"]}>
      <div className="mcl-g2-grid">
        <Panel title="Digital Input Experiment" icon="grid" className="mcl-sim g-bench">
          <div className="mcl-g2-mat">
            <svg viewBox="0 0 470 220" className="mcl-svg" role="img" aria-label="STM32 with an LED and three push buttons on a breadboard">
              <HwDefs id="l12" />
              <BenchChip pins={[
                { key: "PA5", y: wireY.PA5, level: ledOn ? 1 : 0, tag: "LED" },
                { key: "PA0", y: wireY.PA0, level: raw, tag: "SW1" },
                { key: "PA1", y: wireY.PA1, level: mcu.pin("PA1").level, tag: "SW2" },
                { key: "PA4", y: wireY.PA4, level: mcu.pin("PA4").level, tag: "SW3" },
              ]} />
              <Breadboard x={290} y={34} w={168} h={146} cols={12} rows={7} />
              <Wire d={`M250 ${wireY.PA5} C 275 ${wireY.PA5}, 300 56, 330 56`} color="#ef4444" live={ledOn} />
              <Wire d={`M250 ${wireY.PA0} C 280 ${wireY.PA0}, 300 128, 322 140`} color="#2563eb" live={raw === 0} />
              <Wire d={`M250 ${wireY.PA1} C 285 ${wireY.PA1}, 340 130, 368 140`} color="#16a34a" live={mcu.pin("PA1").level === 0} />
              <Wire d={`M250 ${wireY.PA4} C 290 ${wireY.PA4}, 390 120, 414 140`} color="#eab308" live={params.sw3} />
              <line x1={327} y1={78} x2={327} y2={98} stroke="#9ca3af" strokeWidth={1.6} />
              <line x1={333} y1={78} x2={333} y2={102} stroke="#9ca3af" strokeWidth={1.6} />
              <SvgLed x={330} y={70} r={9} on={ledOn} color="red" id="l12" />
              <text x={330} y={114} textAnchor="middle" fontSize="8" fill="#4b6283">LED · PA5</text>
              <rect x={392} y={62} width={22} height={8} rx={2} fill="#d9c08a" stroke="#a88a4f" />
              <text x={403} y={84} textAnchor="middle" fontSize="7" fill="#4b6283">RC (SW2)</text>
              <SvgButton x={326} y={152} size={20} pressed={params.sw1} onPress={(d) => lab.setParam("sw1", d)} label="SW1" />
              <SvgButton x={372} y={152} size={20} pressed={params.sw2} onPress={(d) => lab.setParam("sw2", d)} label="SW2" />
              <SvgButton x={418} y={152} size={20} pressed={params.sw3} onPress={(d) => lab.setParam("sw3", d)} label="SW3" />
              {params.noPull ? <text x={140} y={200} textAnchor="middle" fontSize="9" fontWeight="700" fill="#b42318">PA0 pull-up removed</text> : null}
            </svg>
          </div>
          <div className="mcl-g2-kv">
            <div><small>Physical presses (SW1)</small><b>{b.physical}</b></div>
            <div><small>Raw edges on PA0</small><b className={rawEdges > b.physical * 2 + 1 ? "bad" : ""}>{rawEdges}</b></div>
            <div><small>Presses counted by firmware</small><b className={presses === b.physical ? "ok" : "bad"}>{presses}</b></div>
          </div>
          <p className="mcl-g2-hint"><Icon name="bulb" size={14} />SW1 bounces like a real tactile switch. SW2 has a hardware RC filter: clean but about 4 ms late. SW3 clears the counters.</p>
        </Panel>

        <Panel title="Input Conditioning" icon="sliders" className="g-ctl">
          <div className="mcl-g2-row"><span>Button</span><b className={`mcl-g2-state ${params.sw1 ? "hi" : ""}`}>{params.sw1 ? "PRESSED" : "RELEASED"}</b></div>
          <div className="mcl-g2-row"><span>Raw Pin (PA0)</span><b className={`mcl-g2-state ${raw < 0 ? "warn" : raw ? "" : "hi"}`}>{lvl(raw)}</b></div>
          <div className="mcl-g2-row"><span>Debounced</span><b className={`mcl-g2-state ${stable ? "" : "hi"}`}>{stable ? "HIGH" : "LOW"}</b></div>
          <div className="mcl-g2-row"><span>Pull</span><b className={`mcl-g2-state ${pupd === 0 ? "bad" : ""}`}>{["NONE", "UP", "DOWN", "—"][pupd]}</b></div>
          <div className="mcl-g2-row"><span>DEBOUNCE_MS</span>
            <span className="mcl-g2-stepper">
              <button type="button" aria-label="Decrease debounce" onClick={() => setDebounce((Number.isFinite(dbMs) ? dbMs : 20) - 5)}>−</button>
              <code>{Number.isFinite(dbMs) ? `${dbMs} ms` : "n/a"}</code>
              <button type="button" aria-label="Increase debounce" onClick={() => setDebounce((Number.isFinite(dbMs) ? dbMs : 20) + 5)}>+</button>
            </span>
          </div>
          <label className="mcl-g2-range">Contact bounce<input type="range" min={0} max={20} step={1} value={params.bounce} onChange={(e) => lab.setParam("bounce", Number(e.target.value))} /><output>{params.bounce} ms</output></label>
          {Number.isFinite(dbMs) && dbMs > 0 && dbMs <= params.bounce ? <p className="mcl-g2-hint warn"><Icon name="alert" size={14} />DEBOUNCE_MS ({dbMs} ms) is not longer than the bounce ({params.bounce} ms); one press can still count twice.</p> : null}
          <div className="mcl-g2-faults">
            <b><Icon name="bug" size={14} />Fault injection</b>
            <Toggle label="Pull-up resistor missing on PA0" checked={params.noPull} onChange={(v) => lab.setParam("noPull", v)} hint="PUPDR0 is forced to 00: a released button leaves PA0 floating and it picks up noise" />
            <Toggle label="Oxidised contacts (chatter while held)" checked={params.chatter} onChange={(v) => lab.setParam("chatter", v)} hint="While SW1 is held, the contact briefly opens for a fraction of a millisecond at random" />
          </div>
        </Panel>

        <Panel title="Bounce Analyzer" icon="wave" className="g-scope" tools={
          <div className="mcl-g2-btns"><button type="button" className={zoom === "edge" ? "on blue" : ""} onClick={() => setZoom("edge")}>Last edge · 40 ms</button><button type="button" className={zoom === "live" ? "on blue" : ""} onClick={() => setZoom("live")}>Live · 2 s</button></div>
        }>
          <Scope traces={[
            floating ? { label: "PA0 raw", color: "#f59e0b", sample: noise, min: -0.25, max: 1.25, step: true } : { label: "PA0 raw", color: "#ef4444", edges: rawTrace, initial: 1 },
            { label: "Debounced", color: "#22c55e", edges: b.deb, initial: 1 },
            { label: "LED PA5", color: "#facc15", edges: ledEdges, initial: 0 },
          ]} lanes now={view.now} window={view.window} height={160} frame={lab.frame} ariaLabel="Raw PA0, debounced state and LED"
            markers={b.pressT >= 0 && Number.isFinite(dbMs) ? [{ t: b.pressT, label: params.sw1 ? "press" : "release", color: "#94a3b8" }, { t: b.pressT + dbMs / 1000, label: `+${dbMs} ms`, color: "#22c55e" }] : []} />
          <div className="mcl-g2-kv">
            <div><small>Edges in last transition</small><b className={lastBurst.length > 1 ? "bad" : "ok"}>{lastBurst.length}</b></div>
            <div><small>Bounce settled after</small><b>{settle.toFixed(2)} ms</b></div>
            <div><small>Firmware sample period</small><b>1 ms</b></div>
          </div>
        </Panel>

        <CodeEditor lab={lab} className="g-code" languages={[{ label: "Timer debounce", code: TIMER }, { label: "No debounce", code: NAIVE }, { label: "Integrator", code: INTEGRATOR }]} />

        <div className="g-tasks"><LearningNotes variant="tasks" title="Debounce Challenge" notes={{
          takeaways: [],
          observe: "Press and release SW1 quickly. The red raw trace chatters for a few milliseconds while the green debounced trace switches once.",
          tryIt: "Load the \"No debounce\" version, Run, and press SW1 a few times. The firmware count jumps ahead of your physical presses and the LED ends in the wrong state.",
          measure: `Last transition: ${lastBurst.length} raw edges, settled after ${settle.toFixed(2)} ms. Firmware counted ${presses} of ${b.physical} presses.`,
          modify: "Change DEBOUNCE_MS (stepper or code) and raise the contact bounce slider above it.",
          runAgain: "Rerun and compare raw edge activity against the debounced state.",
          challenge: "Turn on oxidised contacts and hold SW1. Which algorithm, timer or integrator, survives the chatter without counting extra presses?",
          checks: [
            { label: "Saw a bouncing transition (more than 2 raw edges)", done: seen.bounce },
            { label: "Caught an extra press without debouncing", done: seen.extra },
            { label: "Ran with a different DEBOUNCE_MS", done: seen.changed },
            { label: "5+ presses counted exactly", done: seen.match },
          ],
        }} /></div>
      </div>
    </LabShell>
  );
}
