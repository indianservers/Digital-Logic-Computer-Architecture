import { useState } from "react";
import { useLab } from "../core/useLab";
import type { LabMeta } from "../registry";
import { CodeEditor } from "../ui/CodeEditor";
import { Breadboard, HwDefs, SvgLed, Wire } from "../ui/Hardware";
import { Icon } from "../ui/Icon";
import { LearningNotes, Panel, Toggle } from "../ui/Panels";
import { Scope } from "../ui/Scope";
import { LabShell } from "../ui/Shell";
import { BenchChip } from "./Bench";
import { LEDS, load13, P13_DEFAULT, PATTERN, PIN_MAX, PORT_MAX, SCANNER, SINK, world13, type Drive, type P13 } from "./L13sim";

const RES = [100, 220, 330, 1000];
const mA = (a: number) => `${(a * 1000).toFixed(a < 0.01 ? 2 : 1)} mA`;
type Level = "ok" | "warn" | "bad" | "idle";

export default function L13({ meta }: { meta: LabMeta }) {
  const lab = useLab<P13>({ slug: meta.slug, code: PATTERN, params: P13_DEFAULT, mcu: () => ({ ips: 120_000 }), world: world13 });
  const { mcu, params } = lab;
  const s = load13(mcu);
  const [seen, setSeen] = useState({ res: [] as number[], direct: false, q1: false, sink: false });

  const odr = mcu.peek("GPIOB.ODR");
  const otyper = mcu.peek("GPIOB.OTYPER");
  const bank = (odr & 0x0f).toString(2).padStart(4, "0");
  const pinLevel = (k: string) => { const p = mcu.pin(k); return p.mode === "an" ? -1 : p.level; };
  const anyLed = s.ledA.some((a) => a > 0);
  const pb4A = Math.abs(s.pinA.PB4 ?? 0);
  const overPins = Object.entries(s.pinA).filter(([, a]) => Math.abs(a) > PIN_MAX).map(([k]) => k);
  const jtag = ["PB3", "PB4"].filter((k) => mcu.pin(k).mode === "an" || mcu.pin(k).mode === "af");

  if (anyLed && !seen.res.includes(params.ledR) && lab.status === "running") setSeen((v) => ({ ...v, res: [...v.res, params.ledR] }));
  if (!seen.direct && params.drive === "direct" && pb4A > PIN_MAX) setSeen((v) => ({ ...v, direct: true }));
  if (!seen.q1 && s.q1Short) setSeen((v) => ({ ...v, q1: true }));
  if (!seen.sink && params.sink && (otyper & 0x0f) && anyLed) setSeen((v) => ({ ...v, sink: true }));

  const ledRow = (i: number): { st: Level; msg: string } => {
    const a = s.ledA[i]!, l = LEDS[i]!;
    if (s.burnt[i]) return { st: "bad", msg: "Burnt out: current exceeded the 25 mA rating" };
    if (a > PIN_MAX) return { st: "bad", msg: "Above the 25 mA pin and LED absolute maximum" };
    if (a > 0.02) return { st: "warn", msg: "Bright but above the 20 mA continuous rating" };
    if (a > 0 && l.vf >= 2.9) return { st: "warn", msg: `Dim: Vf ${l.vf} V leaves only ${(3.3 - l.vf).toFixed(1)} V for the resistor` };
    return { st: a > 0 ? "ok" : "idle", msg: a > 0 ? "Within rating" : "Off" };
  };
  const relayRow: { st: Level; msg: string } = params.drive === "direct"
    ? { st: pb4A > 0 ? "bad" : "warn", msg: pb4A > 0 ? `Pin sources ${mA(pb4A)} (> 25 mA) and the coil only sees ${s.directCoilV.toFixed(2)} V of the 3.75 V pull-in` : "Coil wired straight to PB4: will overload the pin when driven" }
    : s.q1Short ? { st: "bad", msg: "Q1 failed short: coil permanently energised" }
    : { st: pb4A > 0 ? "ok" : "idle", msg: pb4A > 0 ? `Pin only supplies ${mA(pb4A)} base current; coil draws 70 mA from 5 V` : "Q1 off" };
  const lastSpike = s.spikes[s.spikes.length - 1];
  const kicks = s.spikes.filter((x) => x.v < 0);
  const flyRow: { st: Level; msg: string } = params.drive === "direct" ? { st: "idle", msg: "No transistor in the path" }
    : params.noDiode ? { st: kicks.length ? "bad" : "warn", msg: kicks.length ? `${kicks.length} turn-off spike${kicks.length > 1 ? "s" : ""}, last ${kicks[kicks.length - 1]!.v} V on a 40 V transistor` : "No flyback diode: the next turn-off will spike" }
    : { st: "ok", msg: `D1 clamps the coil at ${lastSpike ? lastSpike.v.toFixed(1) : "5.7"} V` };
  const safety: Array<{ name: string; a: number; st: Level; msg: string }> = [
    ...LEDS.map((l, i) => ({ name: `${l.key} ${l.color} LED`, a: s.ledA[i]!, ...ledRow(i) })),
    { name: "PB4 relay coil", a: pb4A, ...relayRow },
    { name: "Flyback", a: 0, ...flyRow },
    { name: "PB5 buzzer (Q2)", a: Math.abs(s.pinA.PB5 ?? 0), st: s.buzzer ? "ok" : "idle", msg: s.buzzer ? "Q2 switches the 5 V active buzzer" : "Silent" },
  ];

  const wireY = { PB0: 50, PB1: 68, PB2: 86, PB3: 104, PB4: 134, PB5: 156 };
  const ledX = [312, 338, 364, 390];

  return (
    <LabShell meta={meta} lab={lab} subtitle="Drive LEDs, relays and buzzers while observing pin current, logic levels and timing."
      components={["NUCLEO-F401RE (STM32F401RE)", "4 LEDs (red, green, yellow, blue) on PB0-PB3 with series resistors", "5 V relay module on PB4 via 2N2222 (Q1), 1 kΩ base resistor and 1N4148 flyback diode", "5 V active buzzer on PB5 via Q2", "12 V lamp switched by the relay contact"]}>
      <div className="mcl-g2-grid">
        <Panel title="Digital Output Workbench" icon="grid" className="mcl-sim g-bench">
          <div className="mcl-g2-mat">
            <svg viewBox="0 0 470 220" className="mcl-svg" role="img" aria-label="STM32 driving four LEDs, a relay and a buzzer">
              <HwDefs id="l13" />
              <BenchChip pins={[
                ...LEDS.map((l) => ({ key: l.key, y: wireY[l.key], level: pinLevel(l.key), tag: l.color[0]!.toUpperCase() })),
                { key: "PB4", y: wireY.PB4, level: pinLevel("PB4"), tag: "RLY" },
                { key: "PB5", y: wireY.PB5, level: pinLevel("PB5"), tag: "BZ" },
              ]} />
              <Breadboard x={290} y={28} w={168} h={164} cols={12} rows={8} />
              {LEDS.map((l, i) => {
                const x = ledX[i]!, a = s.ledA[i]!;
                const glow = a > 0 ? 0.4 + 0.6 * Math.min(1, a / 0.008) : 1;
                return (
                  <g key={l.key}>
                    <Wire d={`M250 ${wireY[l.key]} C ${272 + i * 6} ${wireY[l.key]}, ${x} 124, ${x} 104`} color={l.hex} live={a > 0} />
                    <rect x={x - 3} y={84} width={6} height={18} rx={2} fill="#d9c08a" stroke="#a88a4f" />
                    {i === 0 && params.shortR ? <line x1={x - 5} y1={82} x2={x + 5} y2={104} stroke="#b42318" strokeWidth={2} /> : null}
                    <line x1={x} y1={66} x2={x} y2={84} stroke="#9ca3af" strokeWidth={1.4} />
                    <g style={{ opacity: glow }}><SvgLed x={x} y={58} r={8} on={a > 0} color={l.color} id="l13" /></g>
                    {s.burnt[i] ? <g stroke="#111827" strokeWidth={1.6}><line x1={x - 5} y1={53} x2={x + 5} y2={63} /><line x1={x + 5} y1={53} x2={x - 5} y2={63} /></g> : null}
                    <text x={x} y={42} textAnchor="middle" fontSize="7" fill="#4b6283">{(a * 1000).toFixed(1)}</text>
                  </g>
                );
              })}
              <text x={420} y={42} fontSize="7" fill="#4b6283">mA</text>
              <text x={420} y={96} fontSize="7" fill="#4b6283">{params.ledR >= 1000 ? "1 kΩ" : `${params.ledR} Ω`}</text>
              <Wire d={`M250 ${wireY.PB4} C 270 ${wireY.PB4}, 284 142, 300 142`} color="#7c3aed" live={pb4A > 0} />
              <g>
                <rect x={300} y={122} width={58} height={42} rx={4} fill="#1e3a8a" stroke={s.q1Short || params.drive === "direct" ? "#ef4444" : "#1e3a8a"} strokeWidth={1.6} />
                <rect x={306} y={128} width={24} height={20} rx={2} fill="#2b59c3" />
                <text x={318} y={141} textAnchor="middle" fontSize="6.5" fontWeight="700" fill="#dbeafe">RELAY</text>
                <circle cx={344} cy={134} r={4} fill={s.contact ? "#4ade80" : "#334155"} />
                <text x={344} y={150} textAnchor="middle" fontSize="6" fill="#bfdbfe">{s.contact ? "NO" : "NC"}</text>
                <text x={329} y={159} textAnchor="middle" fontSize="6" fill={params.noDiode || params.drive === "direct" ? "#fca5a5" : "#bfdbfe"}>{params.drive === "direct" ? "no driver" : s.q1Short ? "Q1 SHORT" : params.noDiode ? "Q1 · no D1" : "Q1 + D1"}</text>
              </g>
              <path d="M358 140 H 372" stroke="#64748b" strokeWidth={1.5} />
              <circle cx={384} cy={142} r={10} fill={s.contact ? "#fde047" : "#e5e7eb"} stroke="#a16207" />
              {s.contact ? <circle cx={384} cy={142} r={16} fill="#fde04755" /> : null}
              <text x={384} y={170} textAnchor="middle" fontSize="7" fill="#4b6283">12 V lamp</text>
              <Wire d={`M250 ${wireY.PB5} C 300 ${wireY.PB5 + 34}, 420 196, 432 153`} color="#f97316" live={s.buzzer} />
              <circle cx={432} cy={142} r={11} fill="#111827" />
              <circle cx={432} cy={142} r={3} fill="#374151" />
              {s.buzzer ? <g className="mcl-l13-sound" fill="none" stroke="#f97316" strokeWidth={1.4}><path d="M446 134 q6 8 0 16" /><path d="M450 130 q9 12 0 24" /></g> : null}
              <text x={432} y={170} textAnchor="middle" fontSize="7" fill="#4b6283">Buzzer</text>
            </svg>
          </div>
          <div className="mcl-g2-kv">
            <div><small>GPIOB→ODR</small><b className="mcl-mono">0x{odr.toString(16).padStart(4, "0").toUpperCase()}</b></div>
            <div><small>GPIOB→OTYPER</small><b className="mcl-mono">0x{otyper.toString(16).padStart(2, "0").toUpperCase()}</b></div>
            <div><small>GPIOB→MODER</small><b className="mcl-mono">0x{mcu.peek("GPIOB.MODER").toString(16).padStart(4, "0").toUpperCase()}</b></div>
          </div>
          {jtag.length ? <p className="mcl-g2-hint warn"><Icon name="alert" size={14} />{jtag.join(" and ")} {jtag.length > 1 ? "are" : "is"} not a plain output: GPIOB resets with PB3/PB4 as JTAG alternate functions (MODER = 0x280). Clear the bits before OR-ing in 01.</p> : null}
        </Panel>

        <Panel title="Output Driver Controls" icon="sliders" className="g-ctl">
          <div className="mcl-g2-row"><span>LED Bank</span><b className="mcl-g2-state mcl-mono">{bank}</b></div>
          <div className="mcl-g2-row"><span>Relay</span><b className={`mcl-g2-state ${s.contact ? "hi" : ""}`}>{s.contact ? "ON" : "OFF"}</b></div>
          <div className="mcl-g2-row"><span>Buzzer</span><b className={`mcl-g2-state ${s.buzzer ? "hi" : ""}`}>{s.buzzer ? "ON" : "OFF"}</b></div>
          <div className="mcl-g2-row"><span>Port Current</span><b className={`mcl-g2-state ${overPins.length ? "bad" : ""}`}>{(s.port * 1000).toFixed(1)} mA</b></div>
          <div className="mcl-g2-row"><span>LED resistor</span>
            <div className="mcl-g2-btns">{RES.map((r) => <button key={r} type="button" className={params.ledR === r ? "on blue" : ""} onClick={() => lab.setParam("ledR", r)}>{r >= 1000 ? "1k" : r}</button>)}</div>
          </div>
          <div className="mcl-g2-row"><span>LED wiring</span>
            <div className="mcl-g2-btns"><button type="button" className={!params.sink ? "on blue" : ""} onClick={() => lab.setParam("sink", false)}>Source</button><button type="button" className={params.sink ? "on blue" : ""} onClick={() => lab.setParam("sink", true)}>Sink</button></div>
          </div>
          <div className="mcl-g2-row"><span>Relay driver</span>
            <div className="mcl-g2-btns">{(["npn", "direct"] as Drive[]).map((d) => <button key={d} type="button" className={params.drive === d ? "on blue" : ""} onClick={() => lab.setParam("drive", d)}>{d === "npn" ? "NPN Q1" : "Direct pin"}</button>)}</div>
          </div>
          <p className="mcl-g2-hint"><Icon name="bulb" size={14} />{params.sink ? "Sink: 3V3 → LED → resistor → pin. A LOW output (push-pull or open-drain) turns the LED on." : "Source: pin → resistor → LED → GND. Only a push-pull HIGH can light it; open-drain HIGH just lets go."}</p>
        </Panel>

        <Panel title="Output Timing" icon="wave" className="g-scope" tools={<span className="mcl-chip">2 s window</span>}>
          <Scope lanes traces={[
            ...LEDS.map((l) => ({ label: l.key, color: l.hex, edges: mcu.edges.get(l.key) ?? [], initial: 0 })),
            { label: "Relay", color: "#a78bfa", edges: s.contactEdges, initial: 0 },
            { label: "PB5", color: "#f97316", edges: mcu.edges.get("PB5") ?? [], initial: 0 },
          ]} now={mcu.time} window={2} height={176} frame={lab.frame} ariaLabel="Port B outputs and relay contact over time"
            markers={s.spikes.filter((x) => x.v < 0).map((x) => ({ t: x.t, label: `${x.v} V`, color: "#ef4444" }))} />
        </Panel>

        <CodeEditor lab={lab} className="g-code" languages={[{ label: "Registers: pattern", code: PATTERN }, { label: "HAL: scanner", code: SCANNER }, { label: "Open-drain sink", code: SINK }]} />

        <div className="g-tasks mcl-l13-side">
          <Panel title="Load Safety" icon="alert">
            <ul className="mcl-l13-safety">
              {safety.map((r) => (
                <li key={r.name} className={r.st}>
                  <i />
                  <div><b>{r.name}</b><small>{r.msg}</small></div>
                  {r.a > 0 ? <span className="mcl-l13-bar" title={mA(r.a)}><em style={{ width: `${Math.min(100, (r.a / PIN_MAX) * 100)}%` }} /><code>{mA(r.a)}</code></span> : <span />}
                </li>
              ))}
            </ul>
            <div className="mcl-l13-total"><span>Port B total</span><span className="mcl-l13-bar wide"><em style={{ width: `${Math.min(100, (s.port / PORT_MAX) * 100)}%` }} /><code>{(s.port * 1000).toFixed(1)} / 120 mA</code></span></div>
            <div className="mcl-g2-faults">
              <b><Icon name="bug" size={14} />Fault injection</b>
              <Toggle label="PB0 series resistor shorted" checked={params.shortR} onChange={(v) => lab.setParam("shortR", v)} hint="Only the pin's ~50 Ω output resistance limits the red LED current" />
              <Toggle label="Flyback diode D1 removed" checked={params.noDiode} onChange={(v) => lab.setParam("noDiode", v)} hint="The coil's stored energy has nowhere to go when Q1 turns off" />
            </div>
          </Panel>
          <LearningNotes variant="tasks" title="Learning Tasks" notes={{
            takeaways: [],
            observe: "The LED bank alternates 1010 / 0101 every 250 ms while Q1 clicks the relay and the lamp follows about 8 ms later.",
            tryIt: "Switch the relay driver to Direct pin: PB4 is overloaded and the relay never pulls in.",
            measure: `Red LED: ${mA(s.ledA[0]!)} through ${params.ledR} Ω. Blue LED: ${mA(s.ledA[3]!)} (only ${(3.3 - LEDS[3].vf).toFixed(1)} V of headroom).`,
            modify: "Remove the flyback diode and watch the turn-off spikes on the timing view until Q1 fails.",
            runAgain: "Load the open-drain sink version, set LED wiring to Sink and Run again.",
            challenge: "Pick the smallest resistor that keeps every LED under 20 mA, and explain why the blue LED stays dim at 3.3 V.",
            checks: [
              { label: "Compared two LED resistor values", done: seen.res.length >= 2 },
              { label: "Saw a direct-driven relay overload PB4", done: seen.direct },
              { label: "Watched a missing flyback diode destroy Q1", done: seen.q1 },
              { label: "Lit LEDs with open-drain sink wiring", done: seen.sink },
            ],
          }} />
        </div>
      </div>
    </LabShell>
  );
}
