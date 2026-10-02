import { useEffect, useState } from "react";
import { useLab } from "../core/useLab";
import type { Mcu } from "../core/mcu";
import type { LabMeta } from "../registry";
import { CodeEditor } from "../ui/CodeEditor";
import { HwDefs, NucleoBoard, Wire } from "../ui/Hardware";
import { Icon } from "../ui/Icon";
import { LearningNotes, Panel, Seg, Toggle } from "../ui/Panels";
import { LabShell } from "../ui/Shell";
import {
  ANALOG_BUG, angleToUs, attached, codeAngle, DEFAULT_RANGE, DEMO, P22_DEFAULT, positionName, servo, SERVO_ARD, SERVO_MAX_US, SERVO_MIN_US, SERVO_PIN, setCodeAngle, SWEEP, usToAngle, world22,
  type P22, type Servo22,
} from "./L22sim";

const deg = (a: number) => `${Math.round(a)}°`;
const ms = (us: number) => `${(us / 1000).toFixed(2)} ms`;

/** SG90 seen from the front, output shaft up; the horn turns in the drawing plane (0° = full left). */
function ServoBody({ x, y, angle, s = 1, label = true }: { x: number; y: number; angle: number; s?: number; label?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x={-34} y={-6} width={68} height={10} rx={2} fill="#1f2937" />
      <rect x={-46} y={-2} width={92} height={7} rx={2} fill="#262d38" />
      <circle cx={-40} cy={1.5} r={2.2} fill="#0b0f14" /><circle cx={40} cy={1.5} r={2.2} fill="#0b0f14" />
      <rect x={-30} y={4} width={60} height={86} rx={4} fill="#20262f" stroke="#0b0f14" />
      <rect x={-30} y={4} width={60} height={8} fill="#2b323d" />
      {label ? (
        <g textAnchor="middle" fill="#e5e7eb">
          <text y={40} fontSize="7.5" fontWeight="700">Tower Pro</text>
          <text y={54} fontSize="11" fontWeight="800">SG90</text>
          <text y={66} fontSize="6.5">Micro Servo</text>
        </g>
      ) : null}
      <circle cx={-12} cy={-12} r={13} fill="#2b323d" stroke="#0b0f14" />
      <g transform={`translate(-12 -12) rotate(${angle - 90})`} style={{ transition: "transform 60ms linear" }}>
        <path d="M-6 0 L-3 -40 Q0 -45 3 -40 L6 0 Z" fill="#f8fafc" stroke="#94a3b8" />
        {[10, 18, 26, 34].map((d) => <circle key={d} cx={0} cy={-d} r={1.3} fill="#94a3b8" />)}
        <circle r={7.5} fill="#f1f5f9" stroke="#94a3b8" />
        <circle r={2.4} fill="#64748b" />
      </g>
    </g>
  );
}

function Scene({ sv, mcu, p, view, running }: { sv: Servo22; mcu: Mcu; p: P22; view: "3d" | "sch"; running: boolean }) {
  const live = running && sv.pulseUs > 0;
  const fw = mcu.fw;
  if (view === "sch") {
    const att = attached(mcu);
    return (
      <svg viewBox="0 0 560 270" className="mcl-svg mcl-l22-scene" role="img" aria-label="Servo wiring schematic">
        <rect x={30} y={50} width={150} height={170} rx={8} fill="#eef4fd" stroke="#1677ff" />
        <text x={105} y={74} textAnchor="middle" fontSize="13" fontWeight="700" fill="#0f2547">STM32 Nucleo</text>
        <text x={105} y={90} textAnchor="middle" fontSize="10" fill="#4b6283">{att ? `Servo ${att.name} on ${att.pin}` : "no Servo attached"}</text>
        {[["D9 / PC7", 120], ["5V (USB)", 160], ["GND", 200]].map(([t, y]) => <g key={t}><text x={172} y={Number(y) + 4} textAnchor="end" fontSize="10.5" fill="#1b2f4e">{t}</text><circle cx={180} cy={Number(y)} r={3.5} fill="#1677ff" /></g>)}
        <rect x={370} y={70} width={150} height={130} rx={8} fill="#f8fafc" stroke="#334155" />
        <text x={445} y={94} textAnchor="middle" fontSize="13" fontWeight="700" fill="#0f2547">SG90 servo</text>
        <text x={445} y={110} textAnchor="middle" fontSize="10" fill="#4b6283">{sv.valid ? `${deg(sv.angle)} · ${ms(sv.pulseUs)}` : "no valid frame"}</text>
        {[["Signal", 120, "#f59e0b"], ["VCC", 150, "#dc2626"], ["GND", 180, "#5b3a1e"]].map(([t, y, c]) => <g key={String(t)}><circle cx={370} cy={Number(y) + 20} r={3.5} fill={String(c)} /><text x={380} y={Number(y) + 24} fontSize="10.5" fill="#1b2f4e">{t}</text></g>)}
        <rect x={250} y={18} width={80} height={34} rx={6} fill={p.weakSupply ? "#f1f5f9" : "#fff7ed"} stroke={p.weakSupply ? "#cbd5e1" : "#f97316"} strokeDasharray={p.weakSupply ? "4 3" : undefined} />
        <text x={290} y={33} textAnchor="middle" fontSize="10" fontWeight="700" fill="#9a3412">External 5V</text>
        <text x={290} y={46} textAnchor="middle" fontSize="9" fill="#9a3412">{p.weakSupply ? "not connected" : "2 A supply"}</text>
        <Wire d="M180 120 H280 V140 H370" color="#f59e0b" live={live} />
        {p.weakSupply ? <Wire d="M180 160 H300 V170 H370" color="#dc2626" live={!!fw} /> : <Wire d="M330 35 H350 V170 H370" color="#dc2626" live={!!fw} />}
        {p.noGround ? (
          <g><path d="M180 200 H250" stroke="#5b3a1e" strokeWidth={2.6} /><path d="M320 200 H370" stroke="#5b3a1e" strokeWidth={2.6} /><text x={285} y={204} textAnchor="middle" fontSize="11" fontWeight="700" fill="#b42318">✕ open</text></g>
        ) : <Wire d="M180 200 H370" color="#5b3a1e" />}
        {!p.weakSupply && !p.noGround ? <path d="M290 52 V60 M270 200 V230 H310 V200" stroke="#5b3a1e" strokeWidth={1.4} fill="none" strokeDasharray="3 3" /> : null}
        <text x={290} y={250} textAnchor="middle" fontSize="10" fill="#64748b">Signal: {sv.freq ? `${sv.freq >= 1000 ? (sv.freq / 1000).toFixed(1) + " kHz" : sv.freq.toFixed(0) + " Hz"}, ${ms(sv.pulseUs)} high` : "idle"} · Supply at servo: {sv.supplyV.toFixed(2)} V</text>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 560 270" className="mcl-svg mcl-l22-scene" role="img" aria-label={`Nucleo board wired to an SG90 servo at ${Math.round(sv.angle)} degrees`}>
      <HwDefs id="l22" />
      <NucleoBoard id="l22" x={40} y={14} scale={0.72} power={!!fw} />
      <text x={158} y={140} fontSize="8" fontWeight="700" fill="#f59e0b">D9</text>
      <Wire d="M157 135 C250 135 300 206 410 206" color="#f59e0b" live={live} width={3} />
      {p.weakSupply
        ? <Wire d="M168 96 C260 96 300 213 410 213" color="#dc2626" width={3} />
        : <><rect x={250} y={222} width={60} height={32} rx={5} fill="#fff7ed" stroke="#f97316" /><text x={280} y={236} textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#9a3412">5V EXT</text><text x={280} y={248} textAnchor="middle" fontSize="7.5" fill="#9a3412">2 A supply</text><Wire d="M310 236 C360 236 370 213 410 213" color="#dc2626" width={3} /></>}
      {p.noGround
        ? <g><path d="M157 104 C200 104 220 150 250 160" stroke="#3f2a16" strokeWidth={3} fill="none" /><text x={256} y={164} fontSize="10" fontWeight="700" fill="#b42318">GND open</text></g>
        : <Wire d="M157 104 C250 104 290 220 410 220" color="#3f2a16" width={3} />}
      <ServoBody x={440} y={140} angle={sv.angle} s={0.95} />
      <g className="mcl-l22-callout">
        <rect x={392} y={8} width={154} height={50} rx={8} fill="#fff" stroke="#d6e3f5" />
        <text x={404} y={30} fontSize="15" fill="#33496b">Angle: <tspan fontWeight="800" fill="#0f2547">{deg(sv.angle)}</tspan></text>
        <text x={404} y={48} fontSize="11.5" fill="#4b6283">{sv.valid || sv.pulseUs ? `Pulse: ${ms(sv.pulseUs)}` : "Pulse: none"}</text>
      </g>
      {!sv.valid && fw ? <text x={440} y={262} textAnchor="middle" fontSize="10.5" fontWeight="600" fill="#b42318">{sv.reason}</text> : null}
    </svg>
  );
}

function PulseTrace({ sv }: { sv: Servo22 }) {
  const W = 520, H = 170, X0 = 40, X1 = W - 10, HI = 48, LO = 120;
  const period = sv.freq > 0 ? 1 / sv.freq : 0.02;
  const win = Math.max(period * 2.6, 0.003);
  const tx = (t: number) => X0 + (t / win) * (X1 - X0);
  const pulse = sv.pulseUs / 1e6;
  const off = win * 0.08;
  let d = `M${X0} ${LO}`;
  if (sv.freq > 0) for (let k = 0; ; k++) { const r = off + k * period; if (r > win) break; d += ` H${tx(r)} V${HI} H${tx(Math.min(win, r + pulse))} V${LO}`; }
  d += ` H${X1}`;
  const showAnn = sv.freq > 0 && sv.freq < 400;
  const r2 = off + period;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mcl-l22-trace" role="img" aria-label={`Servo pulse ${ms(sv.pulseUs)} every ${(period * 1000).toFixed(1)} ms`}>
      <text x={X0 - 8} y={HI + 4} textAnchor="end" fontSize="11" fill="#475569">5V</text>
      <text x={X0 - 8} y={LO + 4} textAnchor="end" fontSize="11" fill="#475569">0V</text>
      <line x1={X0} x2={X1} y1={LO} y2={LO} stroke="#e2e8f0" />
      <path d={d} fill="none" stroke="#1677ff" strokeWidth={2.2} />
      {showAnn ? (
        <g fontSize="11" fill="#0f2547">
          <text x={tx(off)} y={HI - 20} fontWeight="700">{ms(sv.pulseUs)}</text>
          <path d={`M${tx(off)} ${HI - 10} H${Math.max(tx(off + pulse), tx(off) + 18)} M${Math.max(tx(off + pulse), tx(off) + 18) - 5} ${HI - 14} l5 4 -5 4`} stroke="#0f2547" fill="none" />
          <path d={`M${tx(off) + 1} ${LO + 18} H${tx(r2) - 1} M${tx(off) + 6} ${LO + 14} l-5 4 5 4 M${tx(r2) - 6} ${LO + 14} l5 4 -5 4`} stroke="#0f2547" fill="none" />
          <text x={(tx(off) + tx(r2)) / 2} y={LO + 36} textAnchor="middle" fontWeight="700">{(period * 1000).toFixed(period < 0.01 ? 2 : 0)} ms ({sv.freq.toFixed(0)} Hz)</text>
        </g>
      ) : sv.freq > 0 ? <text x={(X0 + X1) / 2} y={LO + 30} textAnchor="middle" fontSize="11" fill="#b42318">{(sv.freq / 1000).toFixed(1)} kHz: far too fast for a servo</text> : <text x={(X0 + X1) / 2} y={(HI + LO) / 2} textAnchor="middle" fontSize="12" fill="#94a3b8">No pulses on D9</text>}
    </svg>
  );
}

export default function L22({ meta }: { meta: LabMeta }) {
  const lab = useLab<P22>({
    slug: meta.slug, code: DEMO, params: P22_DEFAULT,
    mcu: () => ({ ips: 120_000 }),
    world: world22,
  });
  const { mcu, params } = lab;
  const fw = mcu.fw;
  const sv = servo(mcu);
  const att = attached(mcu);
  const [view, setView] = useState<"3d" | "sch">("3d");
  const [pending, setPending] = useState<string | null>(null);
  useEffect(() => { if (pending !== null && lab.code === pending) { setPending(null); lab.run(); } }, [pending, lab]);

  const hasAngle = !!fw && typeof fw.globalValue("angle") === "number";
  const codeA = codeAngle(lab.compiledCode);
  const target = hasAngle ? fw.num("angle") : codeA ?? 90;
  const min = att?.min ?? SERVO_MIN_US, max = att?.max ?? SERVO_MAX_US;
  const targetUs = angleToUs(Math.max(0, Math.min(180, target)), min, max);
  const setTarget = (a: number) => { if (hasAngle) fw.setGlobal("angle", Math.max(0, Math.min(180, Math.round(a)))); };
  const drift = hasAngle && codeA !== null && codeA !== target;
  const writeCode = () => { const next = setCodeAngle(lab.code, target); lab.setCode(next); setPending(next); };
  const wrongPin = !!att && att.pin !== SERVO_PIN;
  const rangeMismatch = !!att && (att.min !== SERVO_MIN_US || att.max !== SERVO_MAX_US);
  const nearest = [0, 90, 180].find((a) => Math.abs(a - sv.angle) < 3) ?? -1;

  const [seen, setSeen] = useState({ ends: 0, quick: false, sweep: false, range: false, fault: false });
  const atEnd = sv.valid && (sv.angle < 1 ? 1 : sv.angle > 179 ? 2 : 0);
  const sweeping = lab.running && lab.compiledCode.includes("for (pos");
  const rangeSeen = lab.running && rangeMismatch && sv.valid;
  const faultSeen = lab.running && (params.noGround || params.weakSupply || params.load > 0.4 || (!!fw && sv.freq > 400));
  useEffect(() => {
    const ends = seen.ends | (atEnd || 0);
    if (ends !== seen.ends || (sweeping && !seen.sweep) || (rangeSeen && !seen.range) || (faultSeen && !seen.fault))
      setSeen((s) => ({ ...s, ends: s.ends | (atEnd || 0), sweep: s.sweep || sweeping, range: s.range || rangeSeen, fault: s.fault || faultSeen }));
  }, [atEnd, sweeping, rangeSeen, faultSeen, seen]);
  const quick = (a: number) => { setTarget(a); if (!seen.quick) setSeen((s) => ({ ...s, quick: true })); };
  const shellLab = { ...lab, resetLab: () => { lab.resetLab(); setView("3d"); setPending(null); setSeen({ ends: 0, quick: false, sweep: false, range: false, fault: false }); } };

  const lockHint = !fw ? "Run the sketch to drive the servo." : !hasAngle ? "This sketch computes its own angle (no global int angle), so the controls only show the result." : "";

  return (
    <LabShell meta={meta} lab={shellLab} subtitle="Learn how to control a servo motor using PWM signals. Adjust the angle, pulse width, and observe the real-time response in simulation."
      components={["STM32 Nucleo-F401RE (Arduino core)", "Tower Pro SG90 micro servo (4.8 - 6 V, 0.1 s / 60°)", "External 5 V / 2 A supply for the servo", "Signal on D9 (PC7), common ground"]}>
      <div className="mcl-grid mcl-l22-top">
        <Panel title="Simulation" icon="sim" tools={<Seg size="sm" value={view} onChange={setView} options={[{ value: "3d", label: "3D View" }, { value: "sch", label: "Schematic" }]} />}>
          <Scene sv={sv} mcu={mcu} p={params} view={view} running={lab.running} />
        </Panel>

        <Panel title="Servo Control" icon="sliders">
          <div className="mcl-l22-ctl">
            <div className="mcl-l22-row"><b>Target Angle</b><span className="mcl-l22-box">{deg(target)}</span></div>
            <input type="range" min={0} max={180} step={1} value={Math.max(0, Math.min(180, target))} disabled={!hasAngle} aria-label="Target angle" onChange={(e) => setTarget(Number(e.target.value))} />
            <div className="mcl-l22-ticks"><span>0°</span><span>90°</span><span>180°</span></div>
            <div className="mcl-l22-row"><b>Pulse Width (PWM)</b><span className="mcl-l22-box">{ms(targetUs)}</span></div>
            <input type="range" min={min / 1000} max={max / 1000} step={0.01} value={targetUs / 1000} disabled={!hasAngle} aria-label="Pulse width in milliseconds" onChange={(e) => setTarget(((Number(e.target.value) * 1000 - min) / (max - min)) * 180)} />
            <div className="mcl-l22-ticks"><span>{ms(min)}<br />(0°)</span><span>{ms((min + max) / 2)}<br />(90°)</span><span>{ms(max)}<br />(180°)</span></div>
            <b className="mcl-l22-qh">Quick Positions</b>
            <div className="mcl-l22-quick">
              {[0, 90, 180].map((a) => <button key={a} type="button" className={hasAngle && target === a ? "on" : ""} disabled={!hasAngle} onClick={() => quick(a)}>{a}°</button>)}
            </div>
            {lockHint ? <p className="mcl-g2-hint">{lockHint}</p> : null}
            {drift ? <p className="mcl-g2-hint mcl-l19-drift"><Icon name="edit" size={14} />angle changed live; the sketch still starts at {codeA}°.<button type="button" onClick={writeCode}>Write into code &amp; Run</button></p> : null}
          </div>
        </Panel>

        <Panel title="Live Preview" icon="target">
          <div className="mcl-l22-live">
            <svg viewBox="0 0 160 190" role="img" aria-label={`Servo horn at ${Math.round(sv.angle)} degrees`}>
              <ServoBody x={92} y={82} angle={sv.angle} s={1.05} />
            </svg>
            <b>{deg(sv.angle)}</b>
            <span>{!fw ? "Idle" : !sv.valid ? (params.noGround && sv.pulseUs ? "No signal reference: twitching" : "No valid signal: holding") : sv.moving ? `Moving to ${deg(sv.target)}` : positionName(sv.angle).replace(/ \(.*\)/, "")}</span>
            {sv.stalled ? <em className="bad">Pulse beyond the end stop: motor stalls and buzzes</em> : null}
          </div>
        </Panel>
      </div>

      <div className="mcl-grid mcl-l22-mid">
        <Panel title="PWM Signal (Servo Control Pulse)" icon="wave" tools={<span className={`mcl-chip ${sv.valid ? "mcl-chip-live" : "mcl-chip-warn"}`}>{!fw ? "Stopped" : sv.valid ? "Valid servo frame" : "Rejected"}</span>}>
          <div className="mcl-l22-sig">
            <PulseTrace sv={sv} />
            <dl className="mcl-l22-kv">
              <div><dt>Pulse Width:</dt><dd>{sv.pulseUs ? ms(sv.pulseUs) : "-"}</dd></div>
              <div><dt>Period:</dt><dd>{sv.freq ? `${(1000 / sv.freq).toFixed(sv.freq > 100 ? 2 : 0)} ms` : "-"}</dd></div>
              <div><dt>Frequency:</dt><dd>{sv.freq ? `${sv.freq.toFixed(0)} Hz` : "-"}</dd></div>
              <div><dt>Duty Cycle:</dt><dd>{sv.freq ? `${(sv.duty * 100).toFixed(1)}%` : "-"}</dd></div>
            </dl>
          </div>
          {!sv.valid && fw ? <p className="mcl-g2-hint">{sv.reason}</p> : null}
        </Panel>

        <Panel title="PWM to Angle Mapping" icon="table">
          <p className="mcl-l22-p">Standard hobby servos use a 50 Hz PWM signal (20 ms period). The pulse width determines the target angle:</p>
          <table className="mcl-l22-table">
            <thead><tr><th>Pulse Width</th><th>Angle</th><th>Description</th></tr></thead>
            <tbody>
              {[[500, 0, "Minimum position (full left)"], [1500, 90, "Center position"], [2500, 180, "Maximum position (full right)"]].map(([us, a, t]) => (
                <tr key={a} className={fw && sv.valid && nearest === a ? "on" : ""}><td>{ms(Number(us))}</td><td>{a}°</td><td>{t}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="mcl-l22-note"><Icon name="help" size={14} /><span><b>Note:</b> Different servos have slightly different ranges. The Arduino library defaults to 544 - 2400 µs{att ? `; this sketch attached ${att.min} - ${att.max} µs, so 90° = ${angleToUs(90, att.min, att.max)} µs = ${usToAngle(angleToUs(90, att.min, att.max)).toFixed(1)}° on this servo` : ""}.</span></p>
        </Panel>
      </div>

      <div className="mcl-grid mcl-l22-bot">
        <CodeEditor lab={lab} languages={[{ label: "Arduino (C++)", code: DEMO }, { label: "Sweep 0 - 180", code: SWEEP }, { label: "Bug: default attach()", code: DEFAULT_RANGE }, { label: "Bug: analogWrite", code: ANALOG_BUG }]} />
        <div className="mcl-col">
          <Panel title="Hardware / GPIO Mapping" icon="link">
            <table className="mcl-l22-table">
              <thead><tr><th>Signal</th><th>Microcontroller Pin</th><th>Description</th></tr></thead>
              <tbody>
                <tr className={wrongPin ? "bad" : ""}><td>Servo Signal (PWM)</td><td>{SERVO_PIN} (D{SERVO_ARD})</td><td>{wrongPin ? `Code attached ${att?.pin}: nothing reaches the servo` : sv.freq ? `PWM output to servo (${sv.freq.toFixed(0)} Hz)` : "PWM output to servo (50 Hz)"}</td></tr>
                <tr className={params.weakSupply ? "bad" : ""}><td>VCC</td><td>{params.weakSupply ? "5V (USB)" : "5V (External)"}</td><td>{params.weakSupply ? `USB rail at ${sv.supplyV.toFixed(2)} V, dips to 4.05 V while moving` : `Servo power supply (4.8 - 6 V), now ${sv.supplyV.toFixed(2)} V`}</td></tr>
                <tr className={params.noGround ? "bad" : ""}><td>GND</td><td>GND</td><td>{params.noGround ? "NOT CONNECTED: no signal reference" : "Common ground"}</td></tr>
              </tbody>
            </table>
            <p className="mcl-l22-warn"><Icon name="alert" size={14} /><span><b>Note:</b> High-power servos may require an external 5V supply. Always share a common ground between the microcontroller and servo.</span></p>
            <div className="mcl-l22-load">
              <span>Load on horn</span>
              <input type="range" min={0} max={1} step={0.05} value={params.load} aria-label="Load on servo horn" onChange={(e) => lab.setParam("load", Number(e.target.value))} />
              <em>{(params.load * 1.8).toFixed(1)} kg·cm · {Math.round(sv.speed / 6) / 100} s/60°</em>
            </div>
            <div className="mcl-g2-faults">
              <b><Icon name="bug" size={14} />Fault injection</b>
              <Toggle label="Missing common ground" checked={params.noGround} onChange={(v) => lab.setParam("noGround", v)} hint="The servo's signal input has no reference: it ignores the pulses and twitches" />
              <Toggle label="Servo on USB 5V (weak supply)" checked={params.weakSupply} onChange={(v) => lab.setParam("weakSupply", v)} hint="The USB rail sags when the motor draws current: the servo slows to 40 %" />
            </div>
          </Panel>
          <LearningNotes title="Learning Notes & Tasks" notes={{
            takeaways: [
              "A hobby servo expects one pulse every 20 ms (50 Hz); only the pulse width matters.",
              "0.5 ms ≈ 0°, 1.5 ms = 90°, 2.5 ms ≈ 180° on an SG90; ranges differ between servos.",
              "Servo.write(angle) maps 0 - 180 onto the attach() range; values ≥ 544 are taken as µs.",
              "The servo needs time to move (~0.1 s / 60°) and slows under load or a weak supply.",
              "Power servos separately and always share ground with the MCU.",
            ],
            observe: "Run the sketch: D9 carries a 1.5 ms pulse every 20 ms and the horn sits at 90°.",
            tryIt: "Drag Target Angle or use the Quick Positions. The pulse changes at the next loop pass, then the horn slews to the new angle.",
            measure: `Now: ${sv.pulseUs ? ms(sv.pulseUs) : "no pulse"} at ${sv.freq ? sv.freq.toFixed(0) + " Hz" : "-"}, horn ${deg(sv.angle)}, target ${deg(sv.target)}, supply ${sv.supplyV.toFixed(2)} V.`,
            modify: "Load Bug: default attach() and compare 90° with the table: 1472 µs puts the horn at 87.5°. Fix it by passing 500, 2500 to attach().",
            runAgain: "Load Bug: analogWrite: a 1 kHz PWM is not a servo frame and the horn never moves. Then try the faults and the horn load.",
            challenge: "Write a sketch that moves to 0°, 90° and 180° with writeMicroseconds() and a 1 s pause at each stop.",
            checks: [
              { label: "Drove the servo to both end stops (0° and 180°)", done: seen.ends === 3 },
              { label: "Used a quick position", done: seen.quick },
              { label: "Ran the 0 - 180 sweep", done: seen.sweep },
              { label: "Observed the library default range offset", done: seen.range },
              { label: "Reproduced a wiring, supply or signal fault", done: seen.fault },
            ],
          }} />
        </div>
      </div>
    </LabShell>
  );
}
