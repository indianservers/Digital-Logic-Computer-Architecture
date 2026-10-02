import { useEffect, useRef, useState } from "react";
import { useLab } from "../core/useLab";
import type { LabMeta } from "../registry";
import { CodeEditor } from "../ui/CodeEditor";
import { ArduinoUno, HwDefs, SvgLed, Wire } from "../ui/Hardware";
import { Icon } from "../ui/Icon";
import { LearningNotes, Panel, Seg, Toggle } from "../ui/Panels";
import { LabShell } from "../ui/Shell";
import { NumIn } from "./NumIn";
import {
  COIL_ARD, codeVal, DEMO, FAST, HALF, LOADS, MOTORS, P24_DEFAULT, pullOutRpm, setCodeVal, stepper, world24, wrap360, WRONG_ORDER,
  type CodeKey, type P24, type Step24,
} from "./L24sim";

const W = 620, H = 330;
const MODES = ["Full Step (4-phase)", "Full Step, two-coil", "Half Step (8-phase)"];
const IN_COLORS = ["#f97316", "#eab308", "#22c55e", "#3b82f6"];
/** Arduino Uno top header, left to right: SCL SDA AREF GND D13 … D8 | D7 … D0. */
const unoPinX = (d: number) => 30 + (74 + (4 + 13 - d) * 8.2 + 1.7) * 0.95;
const UNO_TOP = 70 + 13 * 0.95;
const unoPowerX = (i: number) => 30 + (104 + i * 10 + 1.7) * 0.95;
const UNO_BOT = 70 + 187 * 0.95;
const ULN = { x: 330, y: 128, w: 120, h: 112 };
const ulnInX = (k: number) => ULN.x + 22 + k * 9;

/** Polyline up, across and down with rounded corners. */
const arch = (x1: number, y1: number, top: number, x2: number, y2: number, r = 7) =>
  `M${x1} ${y1} V${top + r} Q${x1} ${top} ${x1 + r} ${top} H${x2 - r} Q${x2} ${top} ${x2} ${top + r} V${y2}`;

function Uln2003({ s, power }: { s: Step24; power: boolean }) {
  const { x, y, w, h } = ULN;
  const leds = power ? s.inputs : [0, 0, 0, 0];
  return (
    <g>
      <rect x={x + 3} y={y + 4} width={w} height={h} rx={5} fill="#00000022" />
      <rect x={x} y={y} width={w} height={h} rx={5} fill="#1f7a3a" stroke="#0f4d22" />
      <rect x={x + 16} y={y - 4} width={42} height={10} rx={1.5} fill="#1c1f24" />
      {[0, 1, 2, 3].map((k) => <rect key={k} x={ulnInX(k) - 1.6} y={y - 2} width={3.2} height={5} fill="#d4af37" />)}
      {["IN1", "IN2", "IN3", "IN4"].map((t, k) => <text key={t} x={ulnInX(k)} y={y + 14} textAnchor="middle" fontSize="4.6" fill="#d9f99d">{t}</text>)}
      <rect x={x + 30} y={y + 26} width={46} height={30} rx={2} fill="#16181c" />
      {Array.from({ length: 8 }, (_, i) => <g key={i}><rect x={x + 33 + i * 5.4} y={y + 22} width={2.4} height={4} fill="#c0c7cf" /><rect x={x + 33 + i * 5.4} y={y + 56} width={2.4} height={4} fill="#c0c7cf" /></g>)}
      <text x={x + 53} y={y + 44} textAnchor="middle" fontSize="6.5" fontWeight="700" fill="#cbd5e1">ULN2003</text>
      <rect x={w + x - 14} y={y + 20} width={12} height={44} rx={1.5} fill="#f1f5f9" stroke="#cbd5e1" />
      {[0, 1, 2, 3, 4].map((i) => <rect key={i} x={w + x - 11} y={y + 24 + i * 8} width={6} height={4} fill="#d4af37" />)}
      {["A", "B", "C", "D"].map((t, k) => (
        <g key={t}>
          <SvgLed x={x + 30 + k * 13} y={y + 78} r={3.6} on={!!leds[k]} color="red" id="l24" />
          <text x={x + 30 + k * 13} y={y + 90} textAnchor="middle" fontSize="5.5" fill="#d9f99d">{t}</text>
        </g>
      ))}
      <rect x={x + 6} y={y + h - 14} width={20} height={9} rx={1.5} fill="#1c1f24" />
      <rect x={x + 9} y={y + h - 11} width={3.4} height={4} fill="#d4af37" /><rect x={x + 19} y={y + h - 11} width={3.4} height={4} fill="#d4af37" />
      <text x={x + 10.5} y={y + h - 17} textAnchor="middle" fontSize="6" fontWeight="700" fill="#d9f99d">−</text>
      <text x={x + 21} y={y + h - 17} textAnchor="middle" fontSize="6" fontWeight="700" fill="#d9f99d">+</text>
      <text x={x + 76} y={y + h - 8} textAnchor="middle" fontSize="5" fill="#d9f99d">5-12V</text>
    </g>
  );
}

function StepperMotor({ cx, cy, deg }: { cx: number; cy: number; deg: number }) {
  return (
    <g>
      <ellipse cx={cx + 3} cy={cy + 6} rx={66} ry={56} fill="#00000018" />
      <rect x={cx - 74} y={cy - 46} width={148} height={16} rx={8} fill="#c7ccd2" stroke="#8b939c" />
      <circle cx={cx - 66} cy={cy - 38} r={3.4} fill="#6b7280" /><circle cx={cx + 66} cy={cy - 38} r={3.4} fill="#6b7280" />
      <circle cx={cx} cy={cy} r={54} fill="url(#l24-can)" stroke="#8b939c" />
      <path d={`M${cx - 54} ${cy + 6} A54 54 0 0 0 ${cx + 54} ${cy + 6} Z`} fill="#2563eb" stroke="#1e40af" />
      <rect x={cx - 18} y={cy + 40} width={36} height={18} rx={3} fill="#1d4ed8" />
      <text x={cx} y={cy - 2} textAnchor="middle" fontSize="7.5" fontWeight="700" fill="#334155">28BYJ-48</text>
      <text x={cx} y={cy + 8} textAnchor="middle" fontSize="6.5" fill="#334155">5V DC</text>
      <text x={cx} y={cy + 20} textAnchor="middle" fontSize="6.5" fill="#e0e7ff">STEP MOTOR</text>
      <circle cx={cx} cy={cy - 28} r={13} fill="#d7dbe0" stroke="#8b939c" />
      <g transform={`rotate(${deg} ${cx} ${cy - 28})`}>
        <circle cx={cx} cy={cy - 28} r={6.5} fill="#d4a017" stroke="#92650a" />
        <rect x={cx - 1.6} y={cy - 40} width={3.2} height={12} rx={1} fill="#92650a" />
      </g>
    </g>
  );
}

function Scene({ s, p, running, hasFw, zoom, rot }: { s: Step24; p: P24; running: boolean; hasFw: boolean; zoom: number; rot: number }) {
  const odd = rot % 180 !== 0;
  const vw = (odd ? (W * W) / H : W) / zoom, vh = (odd ? W : H) / zoom;
  const vb = `${W / 2 - vw / 2} ${H / 2 - vh / 2} ${vw} ${vh}`;
  const power = hasFw && !p.vccOff;
  const mx = 540, my = 168;
  const mWires = ["#3b82f6", "#ec4899", "#eab308", "#f97316", "#ef4444"];
  return (
    <svg viewBox={vb} className="mcl-svg mcl-l24-scene" role="img" aria-label={`Arduino Uno driving a 28BYJ-48 stepper through a ULN2003 board, shaft at ${Math.round(wrap360(s.outDeg))} degrees`}>
      <HwDefs id="l24" />
      <defs>
        <radialGradient id="l24-can" cx="40%" cy="35%" r="75%"><stop offset="0" stopColor="#f3f4f6" /><stop offset="1" stopColor="#a8b0b9" /></radialGradient>
      </defs>
      <g transform={`rotate(${rot} ${W / 2} ${H / 2})`}>
        <ArduinoUno id="l24" x={30} y={70} scale={0.95} power={hasFw} tx={running && s.status === "Running"} />
        {COIL_ARD.map((d, k) => {
          const top = 58 - k * 8;
          return <g key={d}>
            <Wire d={arch(unoPinX(d), UNO_TOP, top, ulnInX(k), ULN.y)} color={IN_COLORS[k]!} live={running && !!s.inputs[k]} width={2.6} />
            <text x={unoPinX(d)} y={UNO_TOP + 12} textAnchor="middle" fontSize="5.5" fontWeight="700" fill="#e6eefb">{d}</text>
          </g>;
        })}
        <Wire d={`M${unoPowerX(4)} ${UNO_BOT} V292 H${ULN.x + 21} V${ULN.y + ULN.h - 8}`} color={p.vccOff ? "#cbd5e1" : "#dc2626"} width={2.6} />
        <Wire d={`M${unoPowerX(5)} ${UNO_BOT} V284 H${ULN.x + 11} V${ULN.y + ULN.h - 8}`} color="#1f2937" width={2.6} />
        {p.vccOff ? <text x={(unoPowerX(4) + ULN.x) / 2 + 20} y={304} textAnchor="middle" fontSize="9" fontWeight="700" fill="#b42318">5V disconnected</text> : null}
        <text x={unoPowerX(4)} y={UNO_BOT - 6} textAnchor="middle" fontSize="5" fill="#e6eefb">5V</text>
        <text x={unoPowerX(5) + 2} y={UNO_BOT - 6} textAnchor="middle" fontSize="5" fill="#e6eefb">GND</text>
        <Uln2003 s={s} power={power} />
        {mWires.map((c, i) => {
          const sx = mx - 10 + i * 5, sy = my + 58;
          const swapped = p.swap23 && (i === 1 || i === 2);
          const ty = ULN.y + 26 + (swapped ? (i === 1 ? 2 : 1) : i) * 8;
          return <path key={c} d={`M${sx} ${sy} C${sx} ${sy + 36} ${ULN.x + ULN.w + 30} ${ty} ${ULN.x + ULN.w - 4} ${ty}`} stroke={c} strokeWidth={2} fill="none" />;
        })}
        <StepperMotor cx={mx} cy={my} deg={s.outDeg} />
        <text x={ULN.x + ULN.w / 2} y={ULN.y + ULN.h + 18} textAnchor="middle" fontSize="10" fontWeight="700" fill="#0f2547">ULN2003 Driver</text>
        <text x={mx} y={my + 98} textAnchor="middle" fontSize="10" fontWeight="700" fill="#0f2547">{p.motor === 0 ? "28BYJ-48 Stepper Motor" : "200-step unipolar motor"}</text>
        {p.swap23 ? <text x={ULN.x + ULN.w + 34} y={ULN.y + 8} fontSize="8.5" fontWeight="700" fill="#b42318">coil 2 / 3 swapped</text> : null}
      </g>
    </svg>
  );
}

function Dial({ deg, status }: { deg: number; status: Step24["status"] }) {
  const a = wrap360(deg);
  return (
    <svg viewBox="0 0 160 160" className="mcl-l24-dial" role="img" aria-label={`Shaft position ${a.toFixed(1)} degrees`}>
      <circle cx={80} cy={80} r={70} fill="#f8fafc" stroke="#cbd5e1" strokeWidth={2} />
      {Array.from({ length: 36 }, (_, i) => {
        const t = (i * 10 * Math.PI) / 180, big = i % 9 === 0, r1 = big ? 56 : 62;
        return <line key={i} x1={80 + Math.sin(t) * r1} y1={80 - Math.cos(t) * r1} x2={80 + Math.sin(t) * 68} y2={80 - Math.cos(t) * 68} stroke={big ? "#475569" : "#cbd5e1"} strokeWidth={big ? 2 : 1} />;
      })}
      <g transform={`rotate(${a} 80 80)`}>
        <line x1={80} y1={80} x2={80} y2={20} stroke={status === "Stalled" ? "#dc2626" : "#1677ff"} strokeWidth={4} strokeLinecap="round" />
      </g>
      <circle cx={80} cy={80} r={22} fill="#fff" stroke="#e2e8f0" />
      <text x={80} y={85} textAnchor="middle" fontSize="15" fontWeight="800" fill="#0f2547">{Math.round(a)}°</text>
    </svg>
  );
}

const STATUS_TONE: Record<Step24["status"], string> = { Stopped: "#16a34a", Running: "#1677ff", Holding: "#f59e0b", Stalled: "#dc2626", "No power": "#94a3b8" };

export default function L24({ meta }: { meta: LabMeta }) {
  const lab = useLab<P24>({
    slug: meta.slug, code: DEMO, params: P24_DEFAULT,
    mcu: () => ({ family: "avr", clock: 16e6, ips: 1_000_000 }),
    world: world24,
  });
  const { mcu, params } = lab;
  const fw = mcu.fw;
  const s = stepper(mcu);
  const [zoom, setZoom] = useState(1);
  const [rot, setRot] = useState(0);
  const [moveN, setMoveN] = useState(2048);
  const [pending, setPending] = useState<string | null>(null);
  useEffect(() => { if (pending !== null && lab.code === pending) { setPending(null); lab.run(); } }, [pending, lab]);

  const has = !!fw && typeof fw.globalValue("rpm") === "number" && typeof fw.globalValue("stepsToMove") === "number";
  const g = (k: string, d: number) => (has ? fw.num(k) : d);
  const rpm = g("rpm", codeVal(lab.compiledCode, "rpm") ?? 12);
  const dir = g("dir", codeVal(lab.compiledCode, "dir") ?? 1) < 0 ? -1 : 1;
  const mode = Math.max(0, Math.min(2, g("mode", codeVal(lab.compiledCode, "mode") ?? 0)));
  const toMove = g("stepsToMove", 0), taken = g("stepsTaken", 0);
  const set = (k: string, v: number) => { if (has) fw.setGlobal(k, v); };
  const drifted = (["rpm", "dir", "mode"] as CodeKey[]).filter((k) => { const c = codeVal(lab.compiledCode, k); return has && c !== null && c !== fw.num(k); });
  const writeCode = () => { let next = lab.code; for (const k of drifted) next = setCodeVal(next, k, fw!.num(k)); lab.setCode(next); setPending(next); };

  const moveStart = useRef(0);
  useEffect(() => { moveStart.current = 0; }, [mcu]);
  const move = (n: number, d = dir) => { if (!has) return; moveStart.current = s.outDeg; set("dir", d); set("stepsTaken", 0); set("stepsToMove", Math.max(0, Math.round(n))); };
  const stop = () => { if (has) set("stepsToMove", fw.num("stepsTaken")); };
  const perRev = mode === 2 ? 4096 : 2048;
  const mo = MOTORS[params.motor] ?? MOTORS[0]!;
  const maxRpm = pullOutRpm(params, mode);
  const actualRpm = Math.abs(s.rpm);
  const done = has && taken >= toMove;

  const [seen, setSeen] = useState({ move: false, rev: false, half: false, onerev: false, stall: false, fault: false });
  const active = lab.running && !!fw;
  const flags = {
    move: active && done && toMove > 0 && s.lost === 0,
    rev: active && dir < 0 && s.status === "Running",
    half: active && mode === 2 && s.status === "Running",
    onerev: active && done && s.status === "Holding" && Math.abs(Math.abs(s.outDeg - moveStart.current) - 360) < 1,
    stall: active && s.lost !== 0,
    fault: active && (params.vccOff || params.swap23) && s.inputs.some(Boolean),
  };
  useEffect(() => {
    if ((Object.keys(flags) as Array<keyof typeof flags>).some((k) => flags[k] && !seen[k]))
      setSeen((o) => ({ move: o.move || flags.move, rev: o.rev || flags.rev, half: o.half || flags.half, onerev: o.onerev || flags.onerev, stall: o.stall || flags.stall, fault: o.fault || flags.fault }));
  });
  const shellLab = { ...lab, resetLab: () => { lab.resetLab(); setZoom(1); setRot(0); setMoveN(2048); setPending(null); setSeen({ move: false, rev: false, half: false, onerev: false, stall: false, fault: false }); } };

  const lockHint = !fw ? "Run the sketch to drive the motor." : !has ? "This sketch has no rpm / stepsToMove globals, so the controls only show the result." : "";

  return (
    <LabShell meta={meta} lab={shellLab} subtitle="Learn to control a stepper motor using a driver (ULN2003) and understand step sequences, timing, and positioning."
      components={["Arduino Uno (ATmega328P, 16 MHz)", "ULN2003 Darlington driver board with phase LEDs", `${mo.name}`, "IN1 - IN4 on D8 - D11, driver powered from 5 V"]}>
      <div className="mcl-grid mcl-l24-top">
        <Panel title="Simulation" icon="sim" className="mcl-l24-sim">
          <Scene s={s} p={params} running={lab.running} hasFw={!!fw} zoom={zoom} rot={rot} />
          <div className="mcl-l24-view">
            <button type="button" onClick={() => setZoom((z) => Math.min(3, +(z * 1.25).toFixed(3)))} disabled={zoom >= 3}><Icon name="target" size={14} />Zoom In</button>
            <button type="button" onClick={() => setZoom((z) => Math.max(1, +(z / 1.25).toFixed(3)))} disabled={zoom <= 1}><Icon name="sliders" size={14} />Zoom Out</button>
            <button type="button" onClick={() => { setZoom(1); setRot(0); }}><Icon name="cube" size={14} />Fit</button>
            <button type="button" onClick={() => setRot((r) => (r + 90) % 360)}><Icon name="reset" size={14} />Rotate</button>
            <span>{Math.round(zoom * 100)}%{rot ? ` · ${rot}°` : ""}</span>
          </div>
        </Panel>

        <Panel title="Motor Controls" icon="sliders" className="mcl-l24-ctl">
          <div className="mcl-l24-form">
            <label><span>Step Angle</span>
              <select value={params.motor} onChange={(e) => lab.setParam("motor", Number(e.target.value))} aria-label="Step angle / motor">
                {MOTORS.map((m, i) => <option key={m.label} value={i}>{m.label}</option>)}
              </select></label>
            <label><span>Direction</span>
              <select value={dir} disabled={!has} onChange={(e) => set("dir", Number(e.target.value))} aria-label="Direction">
                <option value={1}>Clockwise (CW)</option><option value={-1}>Counter-clockwise (CCW)</option>
              </select></label>
            <label><span>Speed (RPM)</span>
              <span className="mcl-l24-speed">
                <input type="range" min={1} max={25} step={1} value={Math.max(1, Math.min(25, rpm))} disabled={!has} aria-label="Speed in RPM" onChange={(e) => set("rpm", Number(e.target.value))} />
                <NumIn value={rpm} min={1} max={25} label="Speed RPM value" width={56} disabled={!has} onCommit={(v) => set("rpm", Math.round(v))} />
              </span></label>
            <label><span>Step Mode</span>
              <select value={mode} disabled={!has} onChange={(e) => set("mode", Number(e.target.value))} aria-label="Step mode">
                {MODES.map((t, i) => <option key={t} value={i}>{t}</option>)}
              </select></label>
            <label><span>Steps to Move</span>
              <span className="mcl-l24-speed">
                <NumIn value={moveN} min={1} max={40960} label="Steps to move" width={110} disabled={!has} onCommit={(v) => setMoveN(Math.round(v))} />
                <button type="button" className="mcl-l24-move" disabled={!has} onClick={() => move(moveN)}>Move</button>
              </span></label>
          </div>
          <p className={`mcl-l24-hint ${rpm > maxRpm ? "bad" : ""}`}>{rpm > maxRpm ? `${rpm} RPM is above what the rotor can follow here (~${maxRpm.toFixed(1)} RPM): expect missed steps.` : `${perRev} steps per turn in this mode · in sync up to ~${maxRpm.toFixed(1)} RPM with ${LOADS[params.load]!.toLowerCase()} load.`}</p>
          <div className="mcl-l24-jog">
            <button type="button" disabled={!has} onClick={() => move(1, -1)}><Icon name="sim" size={13} />Step -</button>
            <button type="button" disabled={!has || done} onClick={stop}><span className="mcl-l24-sq" />Stop</button>
            <button type="button" disabled={!has} onClick={() => move(1, 1)}><Icon name="sim" size={13} />Step +</button>
          </div>
          {lockHint ? <p className="mcl-g2-hint">{lockHint}</p> : null}
          {drifted.length ? <p className="mcl-g2-hint mcl-l19-drift"><Icon name="edit" size={14} />{drifted.join(", ")} changed live; the sketch still starts with its own values.<button type="button" onClick={writeCode}>Write into code &amp; Run</button></p> : null}
        </Panel>

        <Panel title="Motor Status" icon="gauge" className="mcl-l24-stat">
          <p className="mcl-l24-cap">Current Position</p>
          <Dial deg={s.outDeg} status={s.status} />
          <dl className="mcl-l24-kv">
            <div><dt>Steps Taken</dt><dd>{has ? `${taken} / ${toMove}` : "-"}</dd></div>
            <div><dt>Revolutions</dt><dd>{(Math.abs(s.outDeg) < 1.8 ? 0 : s.outDeg / 360).toFixed(2)}</dd></div>
            <div><dt>Speed</dt><dd>{actualRpm.toFixed(1)} RPM</dd></div>
            <div><dt>Missed steps</dt><dd className={s.lost ? "bad" : ""}>{Math.abs(s.lost)}</dd></div>
            <div><dt>Coil current</dt><dd>{s.current} mA</dd></div>
            <div><dt>Status</dt><dd><span className="mcl-l24-dot" style={{ background: STATUS_TONE[s.status] }} />{s.status}</dd></div>
          </dl>
        </Panel>

        <Panel title="Coil Energizing Sequence" icon="bolt" className="mcl-l24-seq">
          <div className="mcl-l24-seqwrap">
            <div className="mcl-l24-coils">
              {[0, 1, 2, 3].map((k) => (
                <div key={k} className={s.inputs[k] ? "on" : ""}>
                  <b>IN{k + 1}</b>
                  <i style={s.inputs[k] ? { background: IN_COLORS[k], boxShadow: `0 0 0 4px ${IN_COLORS[k]}33` } : undefined} />
                  <span>{s.inputs[k] ? "ON" : "OFF"}</span>
                </div>
              ))}
            </div>
            <p className="mcl-l24-info"><Icon name="help" size={15} /><span>{mode === 2 ? "Half-step mode alternates one and two coils (8 steps per cycle): half the step angle, smoother motion." : mode === 1 ? "Two-coil full step energizes two adjacent coils (4 steps per cycle): same step size, about 1.4x the torque and twice the current." : "Full-step mode energizes one coil at a time (4 steps per cycle)."}{has ? ` Phase ${fw!.num("phase")} of ${mode === 2 ? 8 : 4}.` : ""}</span></p>
          </div>
        </Panel>
      </div>

      <div className="mcl-grid mcl-l24-bot">
        <CodeEditor lab={lab} languages={[{ label: "Arduino (C++)", code: DEMO }, { label: "Half-step, 1 turn", code: HALF }, { label: "Bug: 40 RPM", code: FAST }, { label: "Bug: wrong coil order", code: WRONG_ORDER }]} />
        <Panel title="Pin Mapping" icon="link">
          <table className="mcl-l22-table">
            <thead><tr><th>Microcontroller Pin</th><th>Driver Input</th><th>Description</th></tr></thead>
            <tbody>
              {COIL_ARD.map((d, k) => (
                <tr key={d} className={params.swap23 && (k === 1 || k === 2) ? "bad" : s.inputs[k] ? "on" : ""}><td>D{d}</td><td>IN{k + 1}</td><td>{params.swap23 && (k === 1 || k === 2) ? `Drives coil ${k === 1 ? 3 : 2} (swapped)` : `Coil ${k + 1}`}</td></tr>
              ))}
              <tr className={params.vccOff ? "bad" : ""}><td>5V</td><td>VCC</td><td>{params.vccOff ? "Disconnected: no coil current" : "Driver Power"}</td></tr>
              <tr><td>GND</td><td>GND</td><td>Common Ground</td></tr>
            </tbody>
          </table>
          <p className="mcl-l24-info"><Icon name="help" size={15} /><span>The ULN2003 sinks current for the {params.motor === 0 ? "28BYJ-48" : "motor"}'s coils ({mo.coilMa} mA each). Use a 5V supply (USB is sufficient) and share ground with the microcontroller.</span></p>
          {params.motor !== 0 ? <p className="mcl-g2-hint">This motor has {mo.fullPerRev} full steps per turn but the sketch assumes stepsPerRev = 2048, so every move and speed is {(2048 / mo.fullPerRev).toFixed(2)}x too large.</p> : null}
          <div className="mcl-l24-load"><span>Load on shaft</span><Seg size="sm" value={params.load} onChange={(v) => lab.setParam("load", v)} options={LOADS.map((t, i) => ({ value: i, label: t }))} /></div>
          <div className="mcl-g2-faults">
            <b><Icon name="bug" size={14} />Fault injection</b>
            <Toggle label="Driver 5V disconnected" checked={params.vccOff} onChange={(v) => lab.setParam("vccOff", v)} hint="The phase LEDs go dark and the coils carry no current" />
            <Toggle label="Coil 2 / 3 wires swapped" checked={params.swap23} onChange={(v) => lab.setParam("swap23", v)} hint="The field jumps 180° every other step: the shaft buzzes in place" />
          </div>
        </Panel>
        <LearningNotes title="Learning & Tasks" notes={{
          takeaways: [
            "A stepper moves one fixed angle per coil pattern change; counting steps gives position without a sensor.",
            "The 28BYJ-48 needs 2048 full steps (4096 half steps) per output turn through its 64:1 gearbox.",
            "The ULN2003 only switches current; the sequence and timing come from the sketch.",
            "Speed = step rate. Too fast, too much load, or a bad sequence and the rotor misses steps.",
            "Two-coil stepping trades current for torque; half-stepping halves the step angle.",
          ],
          observe: "Run the example: IN1 - IN4 light in turn on the driver, and the shaft turns one revolution in about 5 s, then holds.",
          tryIt: "Change Direction and Speed, then press Move. Use Step - / Step + to jog one step at a time.",
          measure: `Now: ${s.rate.toFixed(0)} steps/s, ${actualRpm.toFixed(1)} RPM, ${(s.outDeg / 360).toFixed(3)} turns, ${Math.abs(s.lost)} missed steps, ${s.current} mA.`,
          modify: "Pick Half Step and move 4096 steps. Then set Heavy load: full step at 12 RPM slips, two-coil keeps up.",
          runAgain: "Load Bug: 40 RPM and Bug: wrong coil order. Both buzz instead of turning; fix them and Run again.",
          challenge: "Modify the code to move to a specific angle: steps = angle / 360 x 2048 (90° = 512 steps), then return home.",
          checks: [
            { label: "Ran the example and completed a move", done: seen.move },
            { label: "Changed the direction", done: seen.rev },
            { label: "Ran in half-step mode", done: seen.half },
            { label: "Moved exactly 1 revolution", done: seen.onerev },
            { label: "Made the rotor miss steps (speed or load)", done: seen.stall },
            { label: "Reproduced a wiring fault", done: seen.fault },
          ],
        }} />
      </div>
    </LabShell>
  );
}
