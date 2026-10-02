import { useEffect, useState } from "react";
import { useLab } from "../core/useLab";
import type { LabMeta } from "../registry";
import { CodeEditor } from "../ui/CodeEditor";
import { Breadboard, HwDefs, NucleoBoard, Wire } from "../ui/Hardware";
import { Icon } from "../ui/Icon";
import { LearningNotes, Panel, Seg, Toggle } from "../ui/Panels";
import { LabShell } from "../ui/Shell";
import { NumIn } from "./NumIn";
import {
  CLK23, codeVals, DEMO, dutyFor, LOADS, LOW_FREQ, M, motor, P23_DEFAULT, RPM, rpmFor, SAFE_REVERSE, setCodeVals, SOFT_START, world23,
  type Motor23, type P23,
} from "./L23sim";

type View = "wiring" | "bread" | "pcb";
const WIRE = { ena: "#eab308", in1: "#16a34a", in2: "#2563eb", v5: "#dc2626", gnd: "#111827" };

function MotorCan({ x, y, s, live }: { x: number; y: number; s: Motor23; live: boolean }) {
  const dirSign = s.w >= 0 ? 1 : -1;
  return (
    <g transform={`translate(${x} ${y})`}>
      <defs>
        <linearGradient id="l23-can" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f1f5f9" /><stop offset=".45" stopColor="#cbd5e1" /><stop offset=".55" stopColor="#94a3b8" /><stop offset="1" stopColor="#e2e8f0" />
        </linearGradient>
      </defs>
      <rect x={0} y={-34} width={84} height={68} rx={6} fill="url(#l23-can)" stroke="#64748b" />
      {[16, 30, 44].map((dx) => <line key={dx} x1={dx} x2={dx} y1={-33} y2={33} stroke="#94a3b8" strokeOpacity={0.5} />)}
      <ellipse cx={84} cy={0} rx={14} ry={34} fill="#cbd5e1" stroke="#64748b" />
      <ellipse cx={84} cy={0} rx={6} ry={13} fill="#e2e8f0" stroke="#94a3b8" />
      <rect x={88} y={-3} width={22} height={6} rx={2} fill="#94a3b8" />
      <g transform={`translate(112 0) scale(0.45 1) rotate(${(s.phase * 180) / Math.PI})`}>
        <circle r={14} fill="#1f2937" opacity={0.85} />
        <rect x={-2} y={-14} width={4} height={14} fill="#f97316" />
      </g>
      {live && Math.abs(s.w) > 1 ? (
        <g stroke="#1677ff" fill="none" strokeWidth={1.8}>
          <path d={dirSign > 0 ? "M112 -24 A20 24 0 0 1 128 -6" : "M128 6 A20 24 0 0 1 112 24"} />
          <path d={dirSign > 0 ? "M124 -10 l4 4 l2 -6" : "M116 26 l-4 -2 l4 -5"} />
        </g>
      ) : null}
      <rect x={-14} y={-12} width={14} height={8} fill="#b91c1c" /><rect x={-14} y={4} width={14} height={8} fill="#111827" />
    </g>
  );
}

function L298N({ x, y, s }: { x: number; y: number; s: Motor23 }) {
  const on = s.mode !== "coast";
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={0} y={0} width={124} height={112} rx={5} fill="#c81e1e" stroke="#7f1d1d" />
      {Array.from({ length: 9 }, (_, i) => <rect key={i} x={30 + i * 7.5} y={-14} width={4.5} height={46} fill="#1f2937" />)}
      <rect x={26} y={-16} width={72} height={8} fill="#111827" />
      <rect x={44} y={36} width={36} height={22} rx={2} fill="#111827" />
      <text x={62} y={50} textAnchor="middle" fontSize="7" fill="#e5e7eb" fontWeight="700">L298N</text>
      <rect x={-8} y={30} width={16} height={34} rx={2} fill="#1d4ed8" />
      <rect x={116} y={30} width={16} height={34} rx={2} fill="#1d4ed8" />
      {[38, 56].map((cy) => <circle key={`l${cy}`} cx={0} cy={cy} r={3.2} fill="#cbd5e1" />)}
      {[38, 56].map((cy) => <circle key={`r${cy}`} cx={124} cy={cy} r={3.2} fill="#cbd5e1" />)}
      <rect x={10} y={84} width={48} height={20} rx={2} fill="#1d4ed8" />
      {[18, 34, 50].map((cx) => <circle key={cx} cx={cx} cy={94} r={3} fill="#cbd5e1" />)}
      <rect x={66} y={88} width={52} height={12} fill="#111827" />
      {["IN1", "IN2", "ENA", "5V", "GND"].map((t, i) => <g key={t}><rect x={69 + i * 10} y={90} width={5} height={8} fill="#d4af37" /><text x={71.5 + i * 10} y={110} textAnchor="middle" fontSize="5" fill="#fee2e2">{t}</text></g>)}
      <text x={34} y={80} textAnchor="middle" fontSize="5.5" fill="#fee2e2">VS  GND  5V</text>
      <circle cx={104} cy={14} r={3} fill={on ? "#ef4444" : "#7f1d1d"} />
      <text x={104} y={26} textAnchor="middle" fontSize="5" fill="#fee2e2">PWR</text>
    </g>
  );
}

function WiringView({ s, p, live, power }: { s: Motor23; p: P23; live: boolean; power: boolean }) {
  const pins: Array<[string, string, number, boolean]> = [
    ["PA8 (TIM1_CH1)", WIRE.ena, 92, s.en > 0], ["PB0 (IN1)", WIRE.in1, 114, s.in1 === 1], ["PB1 (IN2)", WIRE.in2, 136, s.in2 === 1], ["5V", WIRE.v5, 158, power], ["GND", WIRE.gnd, 180, false],
  ];
  const modX = 318, modY = 92;
  const pinX = [modX + 71.5, modX + 81.5, modX + 91.5, modX + 101.5, modX + 111.5];
  const order = [2, 0, 1, 3, 4];
  return (
    <svg viewBox="0 0 640 300" className="mcl-svg mcl-l23-scene" role="img" aria-label="Nucleo wired to an L298N driver and a DC motor">
      <HwDefs id="l23" />
      <NucleoBoard id="l23" x={14} y={18} scale={0.74} power={power} model="NUCLEO-F103RB" chipLabel="STM32F103" />
      {pins.map(([label, color, y, hi], k) => {
        const px = pinX[order[k] ?? 0] ?? modX, lane = 256 + k * 7;
        return (
          <g key={label}>
            <Wire d={`M148 ${y} H236 V${lane} H${px} V${modY + 98}`} color={color} live={live && hi} width={2.4} />
            <text x={168} y={y - 4} fontSize="9.5" fontWeight="600" fill="#1b2f4e">{label}</text>
          </g>
        );
      })}
      {p.in2Open ? <g><circle cx={236} cy={136} r={7} fill="#fff" stroke="#b42318" strokeWidth={2} /><text x={236} y={140} textAnchor="middle" fontSize="10" fontWeight="800" fill="#b42318">×</text></g> : null}
      <text x={modX + 62} y={modY - 34} textAnchor="middle" fontSize="11" fontWeight="700" fill="#0f2547">L298N</text>
      <text x={modX + 62} y={modY - 21} textAnchor="middle" fontSize="10" fontWeight="600" fill="#0f2547">H-Bridge Motor Driver</text>
      <L298N x={modX} y={modY} s={s} />
      <Wire d={`M${modX + 124} ${modY + 38} C${modX + 150} ${modY + 38} ${modX + 150} ${modY + 46} 486 ${modY + 46}`} color="#dc2626" live={live && s.mode !== "coast"} width={2.6} />
      <Wire d={`M${modX + 124} ${modY + 56} C${modX + 150} ${modY + 56} ${modX + 150} ${modY + 62} 486 ${modY + 62}`} color="#111827" width={2.6} />
      <MotorCan x={500} y={modY + 54} s={s} live={live} />
      <text x={548} y={modY + 112} textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#0f2547">DC Motor</text>
      <text x={548} y={modY + 125} textAnchor="middle" fontSize="10" fill="#4b6283">(12V)</text>
      <g transform={`translate(${modX - 70} ${modY + 120})`}>
        <rect x={0} y={0} width={46} height={26} rx={4} fill={p.vmOff ? "#f1f5f9" : "#fef3c7"} stroke={p.vmOff ? "#94a3b8" : "#d97706"} strokeDasharray={p.vmOff ? "3 3" : undefined} />
        <text x={23} y={12} textAnchor="middle" fontSize="8" fontWeight="700" fill="#92400e">12V</text>
        <text x={23} y={21} textAnchor="middle" fontSize="6.5" fill="#92400e">{p.vmOff ? "off" : `${s.vm.toFixed(1)} V`}</text>
      </g>
      {!p.vmOff ? <Wire d={`M${modX - 24} ${modY + 128} H${modX + 6} V${modY + 104}`} color="#dc2626" width={2.2} /> : null}
    </svg>
  );
}

function BreadView({ s, p, live, power }: { s: Motor23; p: P23; live: boolean; power: boolean }) {
  const rows: Array<[string, string, boolean]> = [["ENA", WIRE.ena, s.en > 0], ["IN1", WIRE.in1, s.in1 === 1], ["IN2", WIRE.in2, s.in2 === 1], ["5V", WIRE.v5, power], ["GND", WIRE.gnd, false]];
  return (
    <svg viewBox="0 0 640 300" className="mcl-svg mcl-l23-scene" role="img" aria-label="Breadboard layout of the motor driver circuit">
      <HwDefs id="l23b" />
      <NucleoBoard id="l23b" x={14} y={22} scale={0.7} power={power} model="NUCLEO-F103RB" chipLabel="STM32F103" />
      <Breadboard x={190} y={46} w={250} h={190} cols={22} rows={10} />
      {rows.map(([t, c, hi], k) => (
        <g key={t}>
          <Wire d={`M146 ${96 + k * 20} C170 ${96 + k * 20} 190 ${84 + k * 26} 214 ${84 + k * 26}`} color={c} live={live && hi} width={2.4} />
          <Wire d={`M214 ${84 + k * 26} H${300 + k * 8}`} color={c} live={live && hi} width={2.4} />
          <text x={218} y={80 + k * 26} fontSize="8.5" fontWeight="700" fill="#1b2f4e">{t}{t === "IN2" && p.in2Open ? " (open)" : ""}</text>
        </g>
      ))}
      <L298N x={300} y={110} s={s} />
      <Wire d="M424 148 C470 148 470 140 494 140" color="#dc2626" live={live && s.mode !== "coast"} width={2.6} />
      <Wire d="M424 166 C470 166 470 156 494 156" color="#111827" width={2.6} />
      <MotorCan x={508} y={148} s={s} live={live} />
      <text x={300} y={268} fontSize="10" fill="#4b6283">Jumpers: ENA, IN1, IN2 to the module header; VS from a {p.vmOff ? "disconnected" : "12 V"} supply; common GND.</text>
    </svg>
  );
}

/** H-bridge drawn as PCB copper: high/low switches light up from the IN1/IN2/ENA state. */
function PcbView({ s, live }: { s: Motor23; live: boolean }) {
  const q = { q1: s.mode === "forward", q2: s.mode === "reverse", q3: s.mode === "reverse" || s.mode === "brake", q4: s.mode === "forward" || s.mode === "brake" };
  const sw = (x: number, y: number, on: boolean, name: string) => (
    <g key={name}>
      <rect x={x - 22} y={y - 16} width={44} height={32} rx={4} fill={on ? "#facc15" : "#14532d"} stroke={on ? "#fde047" : "#22c55e"} strokeWidth={1.4} />
      <text x={x} y={y + 4} textAnchor="middle" fontSize="11" fontWeight="800" fill={on ? "#422006" : "#bbf7d0"}>{name}</text>
    </g>
  );
  const fwd = s.mode === "forward", rev = s.mode === "reverse", brk = s.mode === "brake";
  const flow = live && Math.abs(s.i) > 0.02;
  return (
    <svg viewBox="0 0 640 300" className="mcl-svg mcl-l23-scene" role="img" aria-label={`H-bridge in ${s.mode} mode`}>
      <rect x={6} y={6} width={628} height={288} rx={10} fill="#0f3d2a" />
      <g stroke="#b87333" strokeWidth={6} fill="none" strokeLinecap="round">
        <path d="M160 40 H480" /><path d="M160 260 H480" />
        <path d="M200 40 V250" /><path d="M440 40 V250" />
        <path d="M200 150 H270" /><path d="M370 150 H440" />
      </g>
      <text x={150} y={36} textAnchor="end" fontSize="11" fill="#fef3c7" fontWeight="700">VS {s.vm.toFixed(1)} V</text>
      <text x={150} y={264} textAnchor="end" fontSize="11" fill="#fef3c7" fontWeight="700">GND</text>
      {sw(200, 90, q.q1, "Q1")}{sw(440, 90, q.q2, "Q2")}{sw(200, 210, q.q3, "Q3")}{sw(440, 210, q.q4, "Q4")}
      <circle cx={320} cy={150} r={46} fill="#1f2937" stroke="#94a3b8" strokeWidth={2} />
      <text x={320} y={146} textAnchor="middle" fontSize="18" fontWeight="800" fill="#e5e7eb">M</text>
      <text x={320} y={166} textAnchor="middle" fontSize="10" fill="#cbd5e1">{Math.round(s.w * RPM)} RPM</text>
      <text x={232} y={142} fontSize="9.5" fill="#fef3c7">OUT1</text><text x={380} y={142} fontSize="9.5" fill="#fef3c7">OUT2</text>
      {flow ? (
        <g stroke="#fb923c" strokeWidth={3} fill="none" className="mcl-l23-flow">
          {fwd ? <path d="M210 52 V150 H274 M366 150 H430 V248" /> : null}
          {rev ? <path d="M430 52 V150 H366 M274 150 H210 V248" /> : null}
          {brk ? <path d={s.w >= 0 ? "M274 150 H210 V248 H430 V150 H366" : "M366 150 H430 V248 H210 V150 H274"} /> : null}
        </g>
      ) : null}
      <g fontSize="11" fill="#d1fae5">
        <text x={500} y={70} fontWeight="700">Inputs</text>
        <text x={500} y={90}>ENA {Math.round(s.en * 100)} %{s.freq ? ` @ ${(s.freq / 1000).toFixed(s.freq >= 1000 ? 0 : 1)} kHz` : ""}</text>
        <text x={500} y={108}>IN1 {s.in1 ? "HIGH" : "LOW"}</text>
        <text x={500} y={126}>IN2 {s.in2 ? "HIGH" : "LOW"}</text>
        <text x={500} y={154} fontWeight="700">Mode</text>
        <text x={500} y={172} fill="#fde047" fontWeight="700">{s.mode.toUpperCase()}</text>
        <text x={500} y={192}>{fwd ? "Q1 + Q4 on" : rev ? "Q2 + Q3 on" : brk ? "Q3 + Q4 short the motor" : "all switches off"}</text>
        <text x={500} y={220}>I = {s.i.toFixed(2)} A</text>
      </g>
    </svg>
  );
}

function Gauge({ rpm, max = 5000 }: { rpm: number; max?: number }) {
  const cx = 120, cy = 112, r = 86;
  const f = Math.min(1, Math.abs(rpm) / max);
  const pt = (a: number, rr = r) => [cx + rr * Math.cos(a), cy - rr * Math.sin(a)] as const;
  const [ex, ey] = pt(Math.PI * (1 - f));
  return (
    <svg viewBox="0 0 240 140" className="mcl-l23-gauge" role="img" aria-label={`${Math.round(Math.abs(rpm))} RPM`}>
      <path d={`M${cx - r} ${cy} A${r} ${r} 0 0 1 ${cx + r} ${cy}`} stroke="#e2e8f0" strokeWidth={16} fill="none" strokeLinecap="round" />
      {f > 0.002 ? <path d={`M${cx - r} ${cy} A${r} ${r} 0 0 1 ${ex} ${ey}`} stroke="#1677ff" strokeWidth={16} fill="none" strokeLinecap="round" /> : null}
      {Array.from({ length: 6 }, (_, k) => { const [tx, ty] = pt(Math.PI * (1 - k / 5), r + 18); return <text key={k} x={tx} y={ty + 3} textAnchor="middle" fontSize="9" fill="#64748b">{(k * max) / 5}</text>; })}
      <text x={cx} y={cy - 12} textAnchor="middle" fontSize="28" fontWeight="800" fill="#0f2547">{Math.round(Math.abs(rpm))}</text>
      <text x={cx} y={cy + 6} textAnchor="middle" fontSize="11" fill="#4b6283">RPM {Math.abs(rpm) > 5 ? (rpm > 0 ? "· CW" : "· CCW") : ""}</text>
    </svg>
  );
}

function Scope({ s }: { s: Motor23 }) {
  const W = 300, H = 140, X0 = 34, X1 = W - 8, HI = 40, LO = 112;
  const f = s.freq || 20000;
  const win = 3.4 / f;
  const tx = (t: number) => X0 + (t / win) * (X1 - X0);
  const active = s.mode === "forward" || s.mode === "reverse";
  let d = `M${X0} ${LO}`;
  if (active && s.en > 0) {
    if (s.en >= 1) d = `M${X0} ${HI} H${X1}`;
    else for (let k = 0; ; k++) { const r = 0.2 / f + k / f; if (r > win) break; d += ` H${tx(r)} V${HI} H${tx(Math.min(win, r + s.en / f))} V${LO}`; }
  }
  if (!(s.en >= 1 && active)) d += ` H${X1}`;
  return (
    <div className="mcl-l23-scope">
      <div className="mcl-l23-scope-h"><span>Duty: {Math.round(s.en * 100)}%</span><span>Freq: {s.freq ? (s.freq >= 1000 ? `${(s.freq / 1000).toFixed(s.freq % 1000 ? 1 : 0)} kHz` : `${s.freq.toFixed(0)} Hz`) : "-"}</span></div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Motor terminal voltage waveform">
        {Array.from({ length: 9 }, (_, i) => <line key={i} x1={X0 + (i * (X1 - X0)) / 8} x2={X0 + (i * (X1 - X0)) / 8} y1={20} y2={H - 14} stroke="#1c2b42" />)}
        {Array.from({ length: 5 }, (_, i) => <line key={`h${i}`} x1={X0} x2={X1} y1={20 + (i * (H - 34)) / 4} y2={20 + (i * (H - 34)) / 4} stroke="#1c2b42" />)}
        <text x={X0 - 4} y={HI + 4} textAnchor="end" fontSize="9" fill="#94a3b8">{s.vm > 0.5 ? `${Math.round(s.vm)}V` : "VS"}</text>
        <text x={X0 - 4} y={LO + 4} textAnchor="end" fontSize="9" fill="#94a3b8">0V</text>
        <path d={d} fill="none" stroke="#3b9bff" strokeWidth={2} />
        <text x={X1} y={H - 3} textAnchor="end" fontSize="8.5" fill="#94a3b8">{s.mode === "reverse" ? "OUT2 - OUT1 (CCW)" : s.mode === "brake" ? "both outputs low (brake)" : s.mode === "coast" ? "outputs off (coast)" : "OUT1 - OUT2 (CW)"}</text>
      </svg>
    </div>
  );
}

export default function L23({ meta }: { meta: LabMeta }) {
  const lab = useLab<P23>({
    slug: meta.slug, code: DEMO, params: P23_DEFAULT,
    mcu: () => ({ part: "F103", clock: CLK23, ips: 120_000 }),
    world: world23,
  });
  const { mcu, params } = lab;
  const fw = mcu.fw;
  const s = motor(mcu);
  const rpm = s.w * RPM;
  const [view, setView] = useState<View>("wiring");
  const [pending, setPending] = useState<string | null>(null);
  useEffect(() => { if (pending !== null && lab.code === pending) { setPending(null); lab.run(); } }, [pending, lab]);

  const hasVars = !!fw && typeof fw.globalValue("dir") === "number" && typeof fw.globalValue("duty") === "number";
  const cv = codeVals(lab.compiledCode);
  const dir = hasVars ? fw.num("dir") : cv.dir ?? 0;
  const duty = hasVars ? fw.num("duty") : cv.duty ?? 0;
  const setDir = (d: number) => { if (hasVars) fw.setGlobal("dir", d); };
  const setDuty = (d: number) => { if (hasVars) fw.setGlobal("duty", Math.max(0, Math.min(100, Math.round(d)))); };
  const predicted = Math.round(rpmFor(Math.min(100, duty), params.load) / 10) * 10;
  const [asked, setAsked] = useState<number | null>(null);
  const unreachable = asked !== null && asked > predicted + 50 && duty >= 100;
  const ceiling = Math.round(rpmFor(100, params.load) / 10) * 10;
  const drift = hasVars && ((cv.dir !== null && cv.dir !== dir) || (cv.duty !== null && cv.duty !== duty));
  const writeCode = () => { const next = setCodeVals(lab.code, { dir, duty }); lab.setCode(next); setPending(next); };
  const power = !!fw;
  const live = lab.running;
  const iAbs = Math.abs(s.i);

  const [seen, setSeen] = useState({ reversed: false, loaded: false, spike: false, softRev: false, fault: false });
  const reversedNow = live && rpm < -500;
  const loadedNow = live && params.load >= 2 && Math.abs(rpm) > 200;
  const spikeNow = live && s.peak > M.iMax;
  const softRevNow = live && lab.compiledCode.includes("last_dir") && rpm < -500;
  const faultNow = live && (params.vmOff || params.in2Open);
  useEffect(() => {
    if ((reversedNow && !seen.reversed) || (loadedNow && !seen.loaded) || (spikeNow && !seen.spike) || (softRevNow && !seen.softRev) || (faultNow && !seen.fault))
      setSeen((v) => ({ reversed: v.reversed || reversedNow, loaded: v.loaded || loadedNow, spike: v.spike || spikeNow, softRev: v.softRev || softRevNow, fault: v.fault || faultNow }));
  }, [reversedNow, loadedNow, spikeNow, softRevNow, faultNow, seen]);
  const shellLab = { ...lab, resetLab: () => { lab.resetLab(); setView("wiring"); setPending(null); setAsked(null); setSeen({ reversed: false, loaded: false, spike: false, softRev: false, fault: false }); } };
  const lockHint = !fw ? "Run the firmware to drive the motor." : !hasVars ? "This firmware has no global dir / duty, so the controls only show the result." : "";
  const fHz = s.freq;

  return (
    <LabShell meta={meta} lab={shellLab} subtitle="Learn to control a DC motor using PWM and an H-bridge motor driver. Adjust speed, change direction, and observe real-time behavior."
      components={["STM32 Nucleo-F103RB (72 MHz)", "L298N dual H-bridge module (2 A per channel, ~2 V drop)", "12 V brushed DC motor (~5000 RPM no-load)", "12 V supply for VS, common GND"]}>
      <div className="mcl-grid mcl-l23-top">
        <Panel title="Hardware Simulation" icon="cpu" tools={<Seg size="sm" value={view} onChange={setView} options={[{ value: "wiring", label: "Schematic View" }, { value: "bread", label: "Breadboard View" }, { value: "pcb", label: "PCB View" }]} />}>
          {view === "wiring" ? <WiringView s={s} p={params} live={live} power={power} /> : view === "bread" ? <BreadView s={s} p={params} live={live} power={power} /> : <PcbView s={s} live={live} />}
        </Panel>

        <Panel title="Motor Controls" icon="sliders">
          <div className="mcl-l23-ctl">
            <b>Direction</b>
            <div className="mcl-l23-dir">
              <button type="button" className={dir === 0 ? "on" : ""} disabled={!hasVars} aria-pressed={dir === 0} onClick={() => setDir(0)}><Icon name="reset" size={14} />CW (Forward)</button>
              <button type="button" className={dir !== 0 ? "on" : ""} disabled={!hasVars} aria-pressed={dir !== 0} onClick={() => setDir(1)}><Icon name="reset" size={14} />CCW (Reverse)</button>
            </div>
            <div className="mcl-l23-row"><b>PWM Duty Cycle</b><span className="mcl-l23-val">{duty}%</span></div>
            <input type="range" min={0} max={100} step={1} value={Math.min(100, duty)} disabled={!hasVars} aria-label="PWM duty cycle" onChange={(e) => setDuty(Number(e.target.value))} />
            <div className="mcl-l23-ticks">{[0, 25, 50, 75, 100].map((t) => <span key={t}>{t}</span>)}</div>
            <label className="mcl-l23-row"><b>Target Speed (RPM)</b><NumIn value={predicted} min={0} max={5000} step={100} width={96} label="Target speed in RPM" disabled={!hasVars} onCommit={(v) => { setAsked(v); setDuty(dutyFor(v, params.load)); }} /></label>
            <p className={`mcl-l23-sub ${unreachable ? "bad" : ""}`}>{unreachable ? `${asked} RPM is out of reach at ${LOADS[params.load]}: 100 % duty tops out near ${ceiling} RPM.` : "Sets the duty that holds this speed at the selected load (open loop)."}</p>
            <b>Load (Torque)</b>
            <Seg size="sm" value={params.load} onChange={(v) => lab.setParam("load", v)} options={LOADS.map((t, i) => ({ value: i as 0 | 1 | 2 | 3, label: t }))} />
            {lockHint ? <p className="mcl-g2-hint">{lockHint}</p> : null}
            {drift ? <p className="mcl-g2-hint mcl-l19-drift"><Icon name="edit" size={14} />dir / duty changed live; main.c still has the old values.<button type="button" onClick={writeCode}>Write into code &amp; Run</button></p> : null}
            <div className="mcl-g2-faults">
              <b><Icon name="bug" size={14} />Fault injection</b>
              <Toggle label="Motor supply (VS) off" checked={params.vmOff} onChange={(v) => lab.setParam("vmOff", v)} hint="The 12 V supply is unplugged: logic still works but the outputs cannot drive the motor" />
              <Toggle label="IN2 wire open (floats high)" checked={params.in2Open} onChange={(v) => lab.setParam("in2Open", v)} hint="The L298N reads an open TTL input as HIGH: CW becomes IN1 = IN2 = 1, which brakes" />
            </div>
          </div>
        </Panel>

        <Panel title="Live Readings" icon="gauge">
          <Gauge rpm={rpm} />
          <div className="mcl-l23-cards">
            <div><Icon name="bolt" size={18} /><span>Voltage</span><b>{s.vm.toFixed(1)} V</b></div>
            <div className={s.overI ? "bad" : ""}><Icon name="alert" size={18} /><span>Current</span><b>{iAbs.toFixed(2)} A</b></div>
          </div>
          <dl className="mcl-l23-kv">
            <div><dt>Bridge</dt><dd>{s.mode}</dd></div>
            <div><dt>Peak current</dt><dd className={s.peak > M.iMax ? "bad" : ""}>{s.peak.toFixed(2)} A{s.peak > M.iMax ? " > 2 A rating" : ""}</dd></div>
            <div><dt>Ripple</dt><dd className={s.ripple > 0.5 ? "bad" : ""}>{s.ripple.toFixed(2)} A p-p{fHz > 0 && fHz < 16000 ? " (audible whine)" : ""}</dd></div>
            <div><dt>Open-loop target</dt><dd>{predicted} RPM</dd></div>
          </dl>
        </Panel>
      </div>

      <div className="mcl-grid mcl-l23-bot">
        <CodeEditor lab={lab} languages={[{ label: "STM32 (HAL)", code: DEMO }, { label: "Soft start ramp", code: SOFT_START }, { label: "Brake before reverse", code: SAFE_REVERSE }, { label: "Bug: 1 kHz PWM", code: LOW_FREQ }]} />
        <div className="mcl-col">
          <Panel title="PWM Waveform" icon="wave"><Scope s={s} /></Panel>
          <Panel title="GPIO / Hardware Mapping" icon="cpu">
            <table className="mcl-l22-table">
              <thead><tr><th>Function</th><th>MCU Pin</th><th>Peripherals / Notes</th></tr></thead>
              <tbody>
                <tr><td>PWM (ENA)</td><td>PA8</td><td>TIM1_CH1 ({fHz ? (fHz >= 1000 ? `${(fHz / 1000).toFixed(0)} kHz` : `${fHz.toFixed(0)} Hz`) : "20 kHz"}) · {Math.round(s.en * 100)} %</td></tr>
                <tr><td>IN1 (Direction)</td><td>PB0</td><td>GPIO Output · {s.in1 ? "HIGH" : "LOW"}</td></tr>
                <tr className={params.in2Open ? "bad" : ""}><td>IN2 (Direction)</td><td>PB1</td><td>{params.in2Open ? "Wire open: driver reads HIGH" : `GPIO Output · ${s.in2 ? "HIGH" : "LOW"}`}</td></tr>
                <tr><td>VCC (Driver)</td><td>5V</td><td>From Nucleo (or external)</td></tr>
                <tr className={params.vmOff ? "bad" : ""}><td>VM (Motor)</td><td>12V</td><td>{params.vmOff ? "Disconnected" : `External supply (7-12V) · ${s.vm.toFixed(1)} V`}</td></tr>
                <tr><td>GND</td><td>GND</td><td>Common ground</td></tr>
              </tbody>
            </table>
          </Panel>
        </div>
        <LearningNotes title="Lab Guide & Tasks" notes={{
          takeaways: [
            "PWM on ENA sets the average voltage, and so the speed: duty × (VS − driver drop).",
            "IN1 / IN2 pick the direction through the H-bridge: 1/0 = CW, 0/1 = CCW, equal = brake.",
            "The L298N loses ~2 V and is rated 2 A per channel; reversing at speed can draw several amps.",
            "Load torque raises the current and lowers the speed for the same duty (open loop).",
            "PWM above ~16 kHz is silent and keeps the current ripple small.",
          ],
          observe: "Run the firmware: ENA carries 20 kHz PWM at 60 %, IN1 is high, and the motor settles near 2900 RPM drawing about 0.36 A.",
          tryIt: "Move the duty slider and switch CW / CCW. Watch the gauge, the current and the H-bridge switches in the PCB view.",
          measure: `Now: ${Math.round(Math.abs(rpm))} RPM ${rpm < -5 ? "CCW" : "CW"}, ${iAbs.toFixed(2)} A, VS ${s.vm.toFixed(1)} V, peak ${s.peak.toFixed(2)} A, ripple ${s.ripple.toFixed(2)} A.`,
          modify: "Reverse at full speed and read the peak current. Then load Brake before reverse and repeat: the spike stays under the 2 A rating.",
          runAgain: "Try Medium / Heavy load at 100 %, then load Bug: 1 kHz PWM and compare the ripple. Finally inject the faults.",
          challenge: "Close the loop: add a ramp that limits the duty change to 5 % per 20 ms and show it keeps the peak current under 2 A on every reversal.",
          checks: [
            { label: "Reversed the motor (CCW)", done: seen.reversed },
            { label: "Ran under medium or heavy load", done: seen.loaded },
            { label: "Saw a reversal current spike above 2 A", done: seen.spike },
            { label: "Reversed safely with brake-before-reverse", done: seen.softRev },
            { label: "Reproduced a supply or wiring fault", done: seen.fault },
          ],
        }} />
      </div>
    </LabShell>
  );
}
