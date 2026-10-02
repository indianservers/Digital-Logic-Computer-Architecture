import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useLab } from "../core/useLab";
import type { LabMeta } from "../registry";
import { CodeEditor } from "../ui/CodeEditor";
import { Icon } from "../ui/Icon";
import { LearningNotes, Panel, Toggle } from "../ui/Panels";
import { LabShell } from "../ui/Shell";
import {
  BH_ADDR, BH_ALT, BMP_RESET, checksum, clearLog, codeField, compP, DEMO, DHT_T, dhtBits, ECHO_DELAY, front, health, hex2, hex4, INIT_LINE, MAX_RANGE, mcu34, P34_DEFAULT, PIR_HOLD,
  PIR_LOCK, SENSOR, SENSOR_KEYS, setCodeField, SIGN_LINE, soundSpeed, targetPresent, TEMPCOMP, txnFrame, VARIANTS, waveHand, world34,
  type DhtFrame, type FieldKey, type Front, type Health, type LogFilter, type P34, type Ping, type Sample, type SensorKey, type Txn,
} from "./L34sim";

const HC: Record<Health, string> = { ok: "#16a34a", stale: "#d97706", err: "#dc2626", off: "#94a3b8", wait: "#64748b" };
const HTEXT: Record<Health, string> = { ok: "live", stale: "stale", err: "error", off: "unplugged", wait: "waiting" };
const FILTERS: Array<[LogFilter, string]> = [["events", "Events"], ["errors", "Errors only"], ["all", "Everything"]];
const SPANS = [10, 30, 60];
const LOOPS = [50, 100, 250, 500, 1000];
const DHT_PERIODS = [500, 1000, 2000, 5000];
const TRIGS = [2, 5, 10, 20];
const USCM = [29, 57, 58, 59];
const BH_OPTS = [BH_ADDR, BH_ALT, BH_ADDR << 1];
const luxToS = (l: number) => Math.round(25 * Math.log10(Math.max(0, l) + 1) * 10) / 10;
const sToLux = (s: number) => Math.min(54612, Math.round(10 ** (s / 25) - 1));
const fin = (x: number) => Number.isFinite(x);

interface Vals { temp: number; hum: number; lux: number; pressure: number; distance: number; motion: number; dhtErr: number; i2cErr: number; echoErr: number; reads: number }

/* ---------------- workbench scene ---------------- */

const W = 660, H = 300;

function Scene({ f, p, now, vals, hl, onPlug }: { f: Front; p: P34; now: number; vals: Vals | null; hl: Record<SensorKey, Health>; onPlug: (k: SensorKey) => void }) {
  const lastTxn = f.txns[f.txns.length - 1];
  const act = {
    dht: (!!f.dht.frame && now - f.dht.frame.t < 0.25) || (!!f.dht.lastFail && now - f.dht.lastFail.t < 0.25),
    i2c: !!lastTxn && now - lastTxn.t < 0.15,
    sonar: !!f.sonar.last && now - f.sonar.last.t < 0.15,
    pir: f.pir.out === 1 && p.pir,
  };
  const key = (e: KeyboardEvent, k: SensorKey) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPlug(k); } };
  const plug = (k: SensorKey, body: ReactNode) => (
    <g className="mcl-l32-term" role="button" tabIndex={0} aria-pressed={p[k]} aria-label={`${SENSOR[k].name} ${SENSOR[k].what.toLowerCase()} sensor ${p[k] ? "plugged in: click to unplug" : "unplugged: click to plug in"}`} onClick={() => onPlug(k)} onKeyDown={(e) => key(e, k)} opacity={p[k] ? 1 : 0.38}>
      {body}
      <title>{p[k] ? `Click to unplug the ${SENSOR[k].name}` : `Click to plug the ${SENSOR[k].name} back in`}</title>
    </g>
  );
  const wire = (d: string, color: string, on: boolean, active: boolean) => (
    <g>
      {active && on ? <path d={d} fill="none" stroke={color} strokeWidth={6} opacity={0.22} strokeLinejoin="round" /> : null}
      <path d={d} fill="none" stroke={on ? color : "#94a3b8"} strokeWidth={active && on ? 2.4 : 1.6} strokeDasharray={on ? undefined : "4 3"} strokeLinejoin="round" opacity={on ? 0.95 : 0.6} />
    </g>
  );
  const tag = (x: number, y: number, text: string, color: string, anchor: "start" | "middle" = "middle") => <text x={x} y={y} textAnchor={anchor} fontSize="8.5" fontWeight="800" fill={color} fontFamily="ui-monospace, Consolas, monospace">{text}</text>;
  const v = vals;
  const dhtTag = !p.dht ? "unplugged" : !v || !f.dht.frames ? "waiting…" : `${v.temp.toFixed(1)} °C · ${v.hum.toFixed(0)} %`;
  const bhTag = !p.bh ? "unplugged" : !v || hl.bh === "err" ? "NACK" : `${Math.round(v.lux)} lx`;
  const bmpTag = !p.bmp ? "unplugged" : !v || hl.bmp === "err" ? "NACK" : `${v.pressure.toFixed(1)} hPa`;
  const sonarTag = !p.sonar ? "unplugged" : !v || !f.sonar.last ? "waiting…" : v.distance < 0 ? "no echo" : `${v.distance.toFixed(1)} cm`;
  const pirTag = !p.pir ? "unplugged" : f.pir.out ? "MOTION" : now < f.pir.lockUntil ? "blocked" : "idle";
  const moving = p.motion || now < f.pir.burstUntil;
  const luxK = Math.min(1, Math.log10(p.lux + 1) / 4.6);
  const thermo = Math.max(0, Math.min(1, (p.tempC + 20) / 80));
  const needle = ((p.hPa - 950) / 100) * Math.PI - Math.PI;
  const pins: Array<[string, number]> = [["PA1 · DHT", 64], ["PB8 · SCL", 92], ["PB9 · SDA", 104], ["PA8 · TRIG", 140], ["PA9 · ECHO", 152], ["PB0 · PIR", 184]];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mcl-l32-scene mcl-l34-scene" role="img" aria-label={`Multi-sensor workbench: ${SENSOR_KEYS.map((k) => `${SENSOR[k].name} ${HTEXT[hl[k]]}`).join(", ")}`}>
      <rect x={4} y={4} width={W - 8} height={H - 8} rx={12} fill="#e9eef5" stroke="#d5dee9" />
      <g>
        {Array.from({ length: 14 }, (_, i) => <rect key={`t${i}`} x={32 + i * 13.5} y={38} width={6} height={8} rx={1} fill="#d9b45a" />)}
        {Array.from({ length: 14 }, (_, i) => <rect key={`b${i}`} x={32 + i * 13.5} y={210} width={6} height={8} rx={1} fill="#d9b45a" />)}
        <rect x={24} y={44} width={200} height={168} rx={7} fill="#1f5fae" stroke="#174b8c" />
        <text x={88} y={122} textAnchor="middle" fontSize="17" fontWeight="800" fill="#fff">STM32</text>
        <text x={88} y={138} textAnchor="middle" fontSize="9" fill="#cfe0f7">Cortex-M4 · F401RE</text>
        <text x={88} y={152} textAnchor="middle" fontSize="8" fill="#9fc0ea">{v ? `loop ${v.reads}` : "stopped"}</text>
        {pins.map(([l, y]) => (
          <g key={l}>
            <rect x={220} y={y - 3} width={7} height={6} rx={1} fill="#d9b45a" />
            <text x={215} y={y + 3} textAnchor="end" fontSize="7.5" fontWeight="700" fill="#dbeafe">{l}</text>
          </g>
        ))}
      </g>
      <g>
        <rect x={262} y={28} width={262} height={244} rx={8} fill="#fafbfc" stroke="#d6dce4" />
        <line x1={272} x2={514} y1={34} y2={34} stroke="#ef4444" strokeWidth={1} opacity={0.6} />
        <line x1={272} x2={514} y1={266} y2={266} stroke="#3b82f6" strokeWidth={1} opacity={0.6} />
        {Array.from({ length: 14 }, (_, r) => Array.from({ length: 16 }, (_, c) => <circle key={`${r}-${c}`} cx={274 + c * 15.6} cy={44 + r * 16} r={1.4} fill="#c9d0d9" />))}
      </g>

      {wire("M227,64 H270 V112 H298 V106", SENSOR.dht.color, p.dht, act.dht)}
      {wire("M227,92 H256 V136 H424", "#0d9488", p.bh || p.bmp, act.i2c)}
      {wire("M227,104 H250 V144 H432", "#0f766e", p.bh || p.bmp, act.i2c)}
      {wire("M352,86 V136", "#0d9488", p.bh, act.i2c && lastTxn?.dev === "bh")}
      {wire("M358,86 V144", "#0f766e", p.bh, act.i2c && lastTxn?.dev === "bh")}
      {wire("M416,84 V136", "#0d9488", p.bmp, act.i2c && lastTxn?.dev === "bmp")}
      {wire("M422,84 V144", "#0f766e", p.bmp, act.i2c && lastTxn?.dev === "bmp")}
      <text x={438} y={143} fontSize="7.5" fontWeight="700" fill="#0f766e">I²C {f.i2cHz / 1000} kHz</text>
      {wire("M227,140 H242 V230 H334 V216", SENSOR.sonar.color, p.sonar, act.sonar)}
      {wire("M227,152 H236 V240 H342 V216", "#60a5fa", p.sonar, act.sonar)}
      {wire("M227,184 H230 V252 H446 V216", SENSOR.pir.color, p.pir, act.pir)}

      <g>
        <line x1={298} x2={330} y1={112} y2={112} stroke="#64748b" />
        <line x1={330} x2={330} y1={112} y2={90} stroke="#64748b" />
        {p.pullup ? (
          <g>
            <rect x={326.5} y={68} width={7} height={22} rx={2} fill="#e9d8b4" stroke="#a38a5a" />
            <line x1={330} x2={330} y1={68} y2={34} stroke="#ef4444" strokeWidth={1} opacity={0.7} />
            <text x={338} y={79} transform="rotate(-90 338 79)" textAnchor="middle" fontSize="7" fontWeight="700" fill="#7c5e24">10k</text>
          </g>
        ) : (
          <g>
            <rect x={326.5} y={68} width={7} height={22} rx={2} fill="none" stroke="#dc2626" strokeDasharray="3 2" />
            <text x={338} y={79} transform="rotate(-90 338 79)" textAnchor="middle" fontSize="6.5" fontWeight="800" fill="#dc2626">no pull-up</text>
          </g>
        )}
      </g>

      {plug("dht", (
        <g>
          <rect x={280} y={44} width={40} height={56} rx={4} fill="#f4f6f8" stroke="#aab4c2" />
          {Array.from({ length: 5 }, (_, r) => Array.from({ length: 3 }, (_, c) => <rect key={`${r}${c}`} x={287 + c * 9.5} y={50 + r * 7.5} width={6} height={4.5} rx={1} fill="#cdd5df" />))}
          <text x={300} y={96} textAnchor="middle" fontSize="7.5" fontWeight="800" fill="#334155">DHT22</text>
          {[290, 298, 306, 314].map((x) => <line key={x} x1={x} x2={x} y1={100} y2={106} stroke="#94a3b8" strokeWidth={1.5} />)}
        </g>
      ))}
      {tag(300, 126, dhtTag, hl.dht === "err" ? "#b42318" : "#b91c1c")}

      {plug("bh", (
        <g>
          <rect x={344} y={44} width={50} height={36} rx={3} fill="#5b21b6" stroke="#3b0f80" />
          <rect x={362} y={50} width={14} height={9} rx={1.5} fill="#f8fafc" />
          <text x={369} y={74} textAnchor="middle" fontSize="7" fontWeight="800" fill="#ede9fe">BH1750</text>
          {[348, 352, 358, 364, 370].map((x) => <line key={x} x1={x} x2={x} y1={80} y2={86} stroke="#94a3b8" strokeWidth={1.5} />)}
          <circle cx={388} cy={50} r={2.4} fill={p.addrHigh ? "#facc15" : "#312e81"} />
        </g>
      ))}
      {tag(364, 98, bhTag, hl.bh === "err" ? "#b42318" : "#b45309", "start")}

      {plug("bmp", (
        <g>
          <rect x={408} y={44} width={42} height={34} rx={3} fill="#6d28d9" stroke="#4c1d95" />
          <rect x={422} y={50} width={14} height={13} rx={1.5} fill="#cbd5e1" stroke="#94a3b8" />
          <text x={429} y={73} textAnchor="middle" fontSize="7" fontWeight="800" fill="#ede9fe">BMP280</text>
          {[412, 416, 422, 428].map((x) => <line key={x} x1={x} x2={x} y1={78} y2={84} stroke="#94a3b8" strokeWidth={1.5} />)}
        </g>
      ))}
      {tag(428, 98, bmpTag, hl.bmp === "err" ? "#b42318" : "#6d28d9", "start")}

      {plug("sonar", (
        <g>
          <rect x={278} y={160} width={122} height={50} rx={4} fill="#1e63c4" stroke="#174b8c" />
          {[306, 372].map((cx) => (
            <g key={cx}>
              <circle cx={cx} cy={183} r={15} fill="#d1d8e0" stroke="#8a96a6" />
              <circle cx={cx} cy={183} r={10} fill="#a6b0bd" />
              <path d={`M${cx - 7},${183 - 3} H${cx + 7} M${cx - 8},183 H${cx + 8} M${cx - 7},${183 + 3} H${cx + 7}`} stroke="#8a96a6" strokeWidth={0.8} />
            </g>
          ))}
          <text x={339} y={204} textAnchor="middle" fontSize="7" fontWeight="800" fill="#dbeafe">HC-SR04</text>
          {[326, 334, 342, 350].map((x) => <line key={x} x1={x} x2={x} y1={210} y2={216} stroke="#94a3b8" strokeWidth={1.5} />)}
          {act.sonar && p.sonar && f.sonar.last?.status === "ok" ? [0, 1, 2].map((i) => <path key={i} d={`M${298 - i * 4},${157 - i * 2.5} Q339,${150 - i * 3} ${380 + i * 4},${157 - i * 2.5}`} fill="none" stroke="#1677ff" strokeWidth={1.2} opacity={0.7 - i * 0.2} />) : null}
        </g>
      ))}
      {tag(352, 229, sonarTag, hl.sonar === "err" ? "#b42318" : "#1d4ed8", "start")}

      {plug("pir", (
        <g>
          <rect x={414} y={160} width={92} height={50} rx={4} fill="#166534" stroke="#14532d" />
          <circle cx={444} cy={182} r={16} fill="#f8fafc" stroke="#cbd5e1" />
          <path d="M432,176 Q444,169 456,176 M430,183 Q444,177 458,183 M432,190 Q444,186 456,190" fill="none" stroke="#dbe1e8" strokeWidth={1} />
          <circle cx={484} cy={172} r={4} fill="#f97316" stroke="#9a3412" />
          <circle cx={484} cy={188} r={4} fill="#f97316" stroke="#9a3412" />
          <circle cx={496} cy={203} r={3} fill={act.pir ? "#4ade80" : "#14532d"} stroke="#052e16" />
          <text x={444} y={207} textAnchor="middle" fontSize="6.5" fontWeight="800" fill="#dcfce7">HC-SR501</text>
          {[438, 446, 454].map((x) => <line key={x} x1={x} x2={x} y1={210} y2={216} stroke="#94a3b8" strokeWidth={1.5} />)}
        </g>
      ))}
      {tag(456, 229, pirTag, f.pir.out ? "#15803d" : "#166534", "start")}

      <g>
        <rect x={532} y={28} width={120} height={244} rx={8} fill="#fff" stroke="#dbe3ee" />
        <text x={542} y={45} fontSize="9" fontWeight="800" fill="#0f2547">Environment</text>
        <g>
          <circle cx={550} cy={70} r={6} fill="#f59e0b" opacity={0.25 + 0.75 * luxK} />
          {Array.from({ length: 8 }, (_, i) => { const a = (i * Math.PI) / 4; return <line key={i} x1={550 + Math.cos(a) * 8} y1={70 + Math.sin(a) * 8} x2={550 + Math.cos(a) * (8 + 4 * luxK)} y2={70 + Math.sin(a) * (8 + 4 * luxK)} stroke="#f59e0b" strokeWidth={1.2} opacity={0.3 + 0.7 * luxK} />; })}
          <text x={566} y={67} fontSize="7.5" fill="#64748b">Light</text>
          <text x={566} y={79} fontSize="9.5" fontWeight="800" fill="#b45309">{p.lux >= 10000 ? `${(p.lux / 1000).toFixed(1)}k` : Math.round(p.lux)} lx</text>
        </g>
        <g>
          <rect x={547} y={98} width={6} height={20} rx={3} fill="#f1f5f9" stroke="#cbd5e1" />
          <rect x={548.5} y={98 + 19 * (1 - thermo)} width={3} height={19 * thermo + 1} fill={p.tempC < 0 ? "#3b82f6" : "#ef4444"} />
          <circle cx={550} cy={121} r={4.5} fill={p.tempC < 0 ? "#3b82f6" : "#ef4444"} />
          <text x={566} y={107} fontSize="7.5" fill="#64748b">Air</text>
          <text x={566} y={119} fontSize="9.5" fontWeight="800" fill={p.tempC < 0 ? "#1d4ed8" : "#b91c1c"}>{p.tempC.toFixed(1)} °C</text>
          <text x={566} y={129} fontSize="7.5" fill="#64748b">{Math.round(p.rh)} % RH</text>
        </g>
        <g>
          <path d="M542,160 A8,8 0 0 1 558,160" fill="none" stroke="#c4b5fd" strokeWidth={2} />
          <line x1={550} y1={160} x2={550 + Math.cos(needle) * 7} y2={160 + Math.sin(needle) * 7} stroke="#6d28d9" strokeWidth={1.6} />
          <text x={566} y={151} fontSize="7.5" fill="#64748b">Pressure</text>
          <text x={566} y={163} fontSize="9.5" fontWeight="800" fill="#6d28d9">{p.hPa.toFixed(1)}</text>
          <text x={566} y={173} fontSize="7.5" fill="#64748b">hPa</text>
        </g>
        <g>
          <rect x={545} y={186} width={10} height={20} rx={1.5} fill={targetPresent(p) ? "#93c5fd" : "#e2e8f0"} stroke={targetPresent(p) ? "#1d4ed8" : "#cbd5e1"} />
          <text x={566} y={193} fontSize="7.5" fill="#64748b">Target</text>
          <text x={566} y={205} fontSize="9.5" fontWeight="800" fill="#1d4ed8">{targetPresent(p) ? `${p.distCm.toFixed(0)} cm` : "none"}</text>
          <text x={566} y={215} fontSize="7.5" fill="#64748b">{targetPresent(p) ? `c = ${soundSpeed(p.tempC).toFixed(0)} m/s` : `beyond ${MAX_RANGE} cm`}</text>
        </g>
        <g stroke={moving ? "#16a34a" : "#94a3b8"} strokeWidth={1.6} fill="none" strokeLinecap="round">
          <circle cx={550} cy={232} r={3.2} fill={moving ? "#16a34a" : "#94a3b8"} stroke="none" />
          <path d={moving ? "M550,236 V248 M550,240 L544,245 M550,240 L557,236 M550,248 L545,256 M550,248 L556,255" : "M550,236 V248 M550,240 L545,246 M550,240 L555,246 M550,248 L546,256 M550,248 L554,256"} />
        </g>
        <text x={566} y={237} fontSize="7.5" fill="#64748b">Person</text>
        <text x={566} y={249} fontSize="9.5" fontWeight="800" fill={moving ? "#15803d" : "#64748b"}>{moving ? "moving" : "still"}</text>
      </g>
      <text x={262} y={290} fontSize="8" fill="#64748b">Click a sensor to unplug it. 3.3 V logic, shared ground.</text>
    </svg>
  );
}

/* ---------------- signal views ---------------- */

const SW = 560, SL = 46, SR = 10;
const frameBg = (h: number) => <rect x={0} y={0} width={SW} height={h} rx={6} fill="#0b1626" />;
const stxt = (x: number, y: number, t: string, c = "#94a3b8", a: "start" | "middle" | "end" = "start", s = 8.5) => <text x={x} y={y} textAnchor={a} fontSize={s} fill={c} fontFamily="ui-monospace, Consolas, monospace">{t}</text>;

function DhtWave({ fr }: { fr: DhtFrame | null }) {
  const SH = 132;
  if (!fr) return <svg viewBox={`0 0 ${SW} ${SH}`} className="mcl-l31-scope" role="img" aria-label="No DHT22 frame yet">{frameBg(SH)}{stxt(SW / 2, 70, "The first DHT22 frame appears 2 s after Run.", "#94a3b8", "middle", 11)}</svg>;
  const bits = dhtBits(fr.sent);
  type Seg = { lv: 0 | 1; dur: number; disp: number; who: "mcu" | "dht" | "bus" };
  const segs: Seg[] = [{ lv: 1, dur: 40e-6, disp: 40e-6, who: "bus" }, { lv: 0, dur: DHT_T.start, disp: 150e-6, who: "mcu" }, { lv: 1, dur: DHT_T.release, disp: DHT_T.release, who: "bus" }, { lv: 0, dur: DHT_T.respLow, disp: DHT_T.respLow, who: "dht" }, { lv: 1, dur: DHT_T.respHigh, disp: DHT_T.respHigh, who: "dht" }];
  const bitAt: number[] = [];
  let acc = segs.reduce((s, x) => s + x.disp, 0);
  for (const b of bits) { segs.push({ lv: 0, dur: DHT_T.bitLow, disp: DHT_T.bitLow, who: "dht" }); bitAt.push(acc); acc += DHT_T.bitLow; const hi = b ? DHT_T.one : DHT_T.zero; segs.push({ lv: 1, dur: hi, disp: hi, who: "dht" }); acc += hi; }
  segs.push({ lv: 0, dur: DHT_T.end, disp: DHT_T.end, who: "dht" }, { lv: 1, dur: 40e-6, disp: 40e-6, who: "bus" });
  const total = segs.reduce((s, x) => s + x.disp, 0);
  const w = SW - SL - SR;
  const X = (t: number) => SL + (t / total) * w;
  const yH = 40, yL = 78;
  const paths: Record<Seg["who"], string[]> = { mcu: [], dht: [], bus: [] };
  let t = 0, prevY = yH;
  for (const s of segs) { const y = s.lv ? yH : yL; paths[s.who].push(`M${X(t).toFixed(1)},${prevY} V${y} H${X(t + s.disp).toFixed(1)}`); prevY = y; t += s.disp; }
  const COL = { mcu: "#60a5fa", dht: "#34d399", bus: "#94a3b8" };
  const bitW = (w * (DHT_T.bitLow + 48e-6)) / total;
  const names = ["RH high", "RH low", "T high", "T low", "Checksum"];
  const fills = ["#155e75", "#0e7490", "#7f1d1d", "#991b1b", "#3730a3"];
  const startX = X(40e-6);
  return (
    <svg viewBox={`0 0 ${SW} ${SH}`} className="mcl-l31-scope" role="img" aria-label={`DHT22 frame ${fr.sent.map(hex2).join(" ")}, checksum ${fr.ok ? "OK" : "wrong"}`}>
      {frameBg(SH)}
      <line x1={SL} x2={SL + w} y1={yH} y2={yH} stroke="#15243a" /><line x1={SL} x2={SL + w} y1={yL} y2={yL} stroke="#1d3150" />
      {stxt(6, 63, "DATA", "#e2e8f0", "start", 10)}
      {[0, 1, 2, 3, 4].map((i) => {
        const a = X(bitAt[i * 8]!), b = i === 4 ? X(bitAt[39]! + DHT_T.bitLow + (bits[39] ? DHT_T.one : DHT_T.zero)) : X(bitAt[i * 8 + 8]!);
        return <g key={i}><rect x={a + 0.5} y={6} width={Math.max(0, b - a - 1)} height={14} rx={3} fill={fills[i]} opacity={0.92} />{stxt((a + b) / 2, 16.5, `${names[i]} ${hex2(fr.sent[i]!)}`, "#f8fafc", "middle", 8)}</g>;
      })}
      <rect x={startX + 1} y={6} width={X(40e-6 + 150e-6) - startX - 2} height={14} rx={3} fill="#1e3a8a" />
      {stxt((startX + X(190e-6)) / 2, 16.5, "start", "#f8fafc", "middle", 8)}
      <path d={paths.bus.join(" ")} fill="none" stroke={COL.bus} strokeWidth={1.6} />
      <path d={paths.mcu.join(" ")} fill="none" stroke={COL.mcu} strokeWidth={1.9} />
      <path d={paths.dht.join(" ")} fill="none" stroke={COL.dht} strokeWidth={1.7} />
      <path d={`M${X(100e-6) - 4},${yL + 6} l6,-12 M${X(100e-6) + 2},${yL + 6} l6,-12`} stroke="#e2e8f0" strokeWidth={1.2} />
      {stxt(X(115e-6), yL + 14, "1.1 ms", "#93c5fd", "middle", 8)}
      {bitW >= 8 ? bits.map((b, i) => <text key={i} x={X(bitAt[i]!) + bitW / 2} y={yL + 14} textAnchor="middle" fontSize="7.5" fontWeight={fr.flipped === i ? 800 : 400} fill={fr.flipped === i ? "#f87171" : b ? "#e2e8f0" : "#64748b"} fontFamily="ui-monospace, Consolas, monospace">{b}</text>) : null}
      {fr.flipped !== null ? <rect x={X(bitAt[fr.flipped]!) - 1} y={yH - 6} width={bitW + 2} height={yL - yH + 12} fill="none" stroke="#f87171" strokeWidth={1.2} rx={2} /> : null}
      <g fontSize="8">
        <rect x={SL} y={SH - 22} width={8} height={3} fill={COL.mcu} />{stxt(SL + 12, SH - 18, "MCU drives", "#94a3b8")}
        <rect x={SL + 82} y={SH - 22} width={8} height={3} fill={COL.dht} />{stxt(SL + 94, SH - 18, "DHT22 drives", "#94a3b8")}
        <rect x={SL + 176} y={SH - 22} width={8} height={3} fill={COL.bus} />{stxt(SL + 188, SH - 18, "pull-up", "#94a3b8")}
        {stxt(SW - SR, SH - 18, `${(fr.dur * 1e3).toFixed(2)} ms · bit = 50 µs low + 27 µs (0) or 70 µs (1) high`, "#64748b", "end", 7.5)}
      </g>
      {stxt(SW - SR, SH - 6, `read at ${fr.t.toFixed(3)} s`, "#64748b", "end", 7.5)}
    </svg>
  );
}

function SonarWave({ ping }: { ping: Ping | null }) {
  const SH = 132;
  if (!ping) return <svg viewBox={`0 0 ${SW} ${SH}`} className="mcl-l31-scope" role="img" aria-label="No ping yet">{frameBg(SH)}{stxt(SW / 2, 70, "Press Run: the firmware pings every loop.", "#94a3b8", "middle", 11)}</svg>;
  const fired = ping.status === "ok" || ping.status === "timeout";
  const win = ping.status === "ok" ? (ECHO_DELAY + ping.echoW) * 1.12 : ping.timeout * 1.08;
  const w = SW - SL - SR;
  const X = (t: number) => SL + Math.min(1, t / win) * w;
  const lanes = { trig: [24, 42], burst: [60, 70], echo: [88, 106] } as const;
  const trigX1 = X(0), trigX2 = Math.max(X(ping.trigW), trigX1 + 4);
  const echoA = X(ECHO_DELAY), echoB = X(ECHO_DELAY + ping.echoW);
  const toX = X(ping.timeout);
  return (
    <svg viewBox={`0 0 ${SW} ${SH}`} className="mcl-l31-scope" role="img" aria-label={`HC-SR04 ping: ${ping.status === "ok" ? `echo ${ping.us} µs` : ping.status}`}>
      {frameBg(SH)}
      {stxt(6, 37, "TRIG", "#93c5fd", "start", 10)}
      {stxt(6, 69, "40 kHz", "#64748b", "start", 8)}
      {stxt(6, 101, "ECHO", "#6ee7b7", "start", 10)}
      <path d={`M${SL},${lanes.trig[1]} H${trigX1} V${lanes.trig[0]} H${trigX2} V${lanes.trig[1]} H${SL + w}`} fill="none" stroke="#60a5fa" strokeWidth={1.8} />
      {stxt(trigX2 + 4, lanes.trig[0] + 8, `${(ping.trigW * 1e6).toFixed(0)} µs${ping.status === "short" ? " (needs ≥ 10 µs)" : ""}`, ping.status === "short" ? "#f87171" : "#93c5fd")}
      {fired ? Array.from({ length: 8 }, (_, i) => { const x = X(ping.trigW + 40e-6 + i * 25e-6); return <path key={i} d={`M${x},65 l1.5,-5 l1.5,10 l1.5,-5`} fill="none" stroke="#c084fc" strokeWidth={1} />; }) : null}
      {fired ? (
        <path d={`M${SL},${lanes.echo[1]} H${echoA} V${lanes.echo[0]} H${echoB} ${ping.status === "ok" ? `V${lanes.echo[1]} H${SL + w}` : ""}`} fill="none" stroke="#34d399" strokeWidth={1.8} />
      ) : <path d={`M${SL},${lanes.echo[1]} H${SL + w}`} fill="none" stroke="#34d399" strokeWidth={1.8} />}
      {ping.status === "ok" ? (
        <g>
          <line x1={echoA} x2={echoB} y1={lanes.echo[0] - 6} y2={lanes.echo[0] - 6} stroke="#6ee7b7" strokeWidth={0.8} />
          {stxt((echoA + echoB) / 2, lanes.echo[0] - 9, `${ping.us} µs`, "#6ee7b7", "middle", 9)}
        </g>
      ) : null}
      {ping.timeout <= win ? <g><line x1={toX} x2={toX} y1={18} y2={112} stroke="#f87171" strokeDasharray="3 3" />{stxt(toX - 3, 26, `timeout ${(ping.timeout * 1e3).toFixed(0)} ms`, "#fca5a5", "end", 8)}</g> : null}
      {[0, 0.5, 1].map((q) => stxt(SL + q * w, SH - 6, `${+(q * win * 1e3).toFixed(2)} ms`, "#94a3b8", q === 0 ? "start" : q === 1 ? "end" : "middle", 8))}
      {stxt(SL + w / 2, SH - 18, ping.status === "ok" ? `distance = ${ping.us} µs × ${ping.c.toFixed(1)} m/s ÷ 2 = ${(ping.us * 1e-6 * ping.c * 50).toFixed(1)} cm` : ping.status === "timeout" ? "no echo before the timeout: echo_pulse_us() returns 0" : ping.status === "short" ? "trigger too short: the module never sends its burst" : ping.status === "unplugged" ? "module unplugged: ECHO never rises" : "no trigger pulse before echo_pulse_us()", "#cbd5e1", "middle", 8.5)}
    </svg>
  );
}

function PirWave({ hist, now, lockUntil }: { hist: Sample[]; now: number; lockUntil: number }) {
  const SH = 132, span = 20;
  const w = SW - SL - SR;
  const t0 = now - span;
  const pts = hist.filter((s) => s.t >= t0 - 0.2);
  const X = (t: number) => SL + Math.max(0, Math.min(1, (t - t0) / span)) * w;
  const step = (get: (s: Sample) => number, hi: number, lo: number) => { if (!pts.length) return ""; let d = `M${X(pts[0]!.t)},${get(pts[0]!) ? hi : lo}`; for (const s of pts) d += ` H${X(s.t).toFixed(1)} V${get(s) ? hi : lo}`; return `${d} H${X(now)}`; };
  const bands: Array<[number, number]> = [];
  let a: number | null = null;
  for (const s of pts) { if (s.mv && a === null) a = s.t; if (!s.mv && a !== null) { bands.push([a, s.t]); a = null; } }
  if (a !== null) bands.push([a, now]);
  return (
    <svg viewBox={`0 0 ${SW} ${SH}`} className="mcl-l31-scope" role="img" aria-label="PIR output over the last 20 seconds">
      {frameBg(SH)}
      {bands.map(([x0, x1], i) => <rect key={i} x={X(x0)} y={14} width={Math.max(1, X(x1) - X(x0))} height={26} rx={3} fill="#14532d" opacity={0.85} />)}
      {stxt(6, 31, "motion", "#86efac", "start", 9)}
      {stxt(6, 77, "OUT", "#6ee7b7", "start", 10)}
      <path d={step((s) => s.motion, 62, 90)} fill="none" stroke="#34d399" strokeWidth={1.8} />
      {lockUntil > now ? stxt(SL + w, 52, `blocked for ${(lockUntil - now).toFixed(1)} s`, "#fbbf24", "end", 8.5) : null}
      {[0, 0.5, 1].map((q) => stxt(SL + q * w, SH - 6, q === 1 ? "now" : `−${span * (1 - q)} s`, "#94a3b8", q === 0 ? "start" : q === 1 ? "end" : "middle", 8))}
      {stxt(SL + w / 2, SH - 20, `OUT (firmware 'motion') stays high ${PIR_HOLD} s after the last movement, then ignores motion for ${PIR_LOCK} s`, "#cbd5e1", "middle", 8)}
    </svg>
  );
}

function Frame({ t }: { t: Txn | null }) {
  if (!t) return <p className="mcl-l31-sub">No transaction yet.</p>;
  return (
    <code className="mcl-l31-frame mcl-l34-frame">{txnFrame(t).map(([s, c], i) => <span key={i} className={c}>{s}</span>)}</code>
  );
}

/* ---------------- trends ---------------- */

type Chan = "temp" | "lux" | "pressure" | "distance" | "motion";
const CHANS: Chan[] = ["temp", "lux", "pressure", "distance", "motion"];
const CH: Record<Chan, { label: string; color: string; meas: (s: Sample) => number; truth: (s: Sample) => number; span: number; fmt: (v: number) => string }> = {
  temp: { label: "Temperature", color: "#ef4444", meas: (s) => s.temp, truth: (s) => s.T, span: 2, fmt: (v) => `${v.toFixed(1)} °C` },
  lux: { label: "Light", color: "#f59e0b", meas: (s) => s.lux, truth: (s) => s.L, span: 40, fmt: (v) => `${Math.round(v)} lx` },
  pressure: { label: "Pressure", color: "#8b5cf6", meas: (s) => s.pressure, truth: (s) => s.P, span: 2, fmt: (v) => `${v.toFixed(1)} hPa` },
  distance: { label: "Distance", color: "#1677ff", meas: (s) => (s.distance < 0 ? Number.NaN : s.distance), truth: (s) => s.D, span: 8, fmt: (v) => `${v.toFixed(1)} cm` },
  motion: { label: "Motion", color: "#16a34a", meas: (s) => s.motion, truth: (s) => s.mv, span: 1, fmt: (v) => (v ? "detected" : "idle") },
};

function Trend({ hist, now, span, chans }: { hist: Sample[]; now: number; span: number; chans: Chan[] }) {
  const TW = 560, bandH = 56, L = 6, R = 6;
  const TH = Math.max(1, chans.length) * bandH + 16;
  const w = TW - L - R;
  const t0 = now - span;
  const pts = hist.filter((s) => s.t >= t0 - 0.15);
  const X = (t: number) => L + Math.max(0, Math.min(1, (t - t0) / span)) * w;
  return (
    <svg viewBox={`0 0 ${TW} ${TH}`} className="mcl-l34-trend" role="img" aria-label={`Sensor trends over the last ${span} seconds`}>
      <rect x={0} y={0} width={TW} height={TH} fill="#fff" />
      {!chans.length ? <text x={TW / 2} y={TH / 2} textAnchor="middle" fontSize="11" fill="#94a3b8">Pick at least one channel.</text> : null}
      {chans.map((c, ci) => {
        const d = CH[c];
        const top = ci * bandH;
        const ms = pts.map(d.meas), ts = pts.map(d.truth);
        const all = [...ms, ...ts].filter(fin);
        let lo = all.length ? Math.min(...all) : 0, hi = all.length ? Math.max(...all) : 1;
        if (c === "motion") { lo = 0; hi = 1; }
        if (hi - lo < d.span) { const mid = (hi + lo) / 2; lo = mid - d.span / 2; hi = mid + d.span / 2; }
        const pad = (hi - lo) * 0.12; lo -= pad; hi += pad;
        const Y = (v: number) => top + 18 + (1 - (v - lo) / (hi - lo)) * (bandH - 26);
        const path = (vals: number[], stepped: boolean) => {
          let dstr = "", pen = false;
          vals.forEach((v, i) => {
            if (!fin(v)) { pen = false; return; }
            const x = X(pts[i]!.t).toFixed(1), y = Y(v).toFixed(1);
            if (!pen) { dstr += ` M${x},${y}`; pen = true; } else dstr += stepped ? ` H${x} V${y}` : ` L${x},${y}`;
          });
          return dstr;
        };
        const last = [...ms].reverse().find(fin);
        return (
          <g key={c}>
            {ci ? <line x1={L} x2={TW - R} y1={top} y2={top} stroke="#eef2f7" /> : null}
            <line x1={L} x2={TW - R} y1={Y((lo + hi) / 2)} y2={Y((lo + hi) / 2)} stroke="#f1f5f9" />
            <text x={L + 2} y={top + 12} fontSize="9.5" fontWeight="800" fill={d.color}>{d.label}</text>
            <text x={L + 78} y={top + 12} fontSize="8" fill="#94a3b8">{c === "motion" ? "0 / 1" : `${d.fmt(lo + pad).replace(/ .*/, "")} … ${d.fmt(hi - pad)}`}</text>
            <text x={TW - R - 2} y={top + 12} textAnchor="end" fontSize="10" fontWeight="800" fill="#0f2547">{last !== undefined ? d.fmt(last) : "–"}</text>
            <path d={path(ts, c === "motion")} fill="none" stroke={d.color} strokeWidth={1} strokeDasharray="3 3" opacity={0.45} />
            <path d={path(ms, c === "motion" || c === "temp")} fill="none" stroke={d.color} strokeWidth={1.8} strokeLinejoin="round" />
          </g>
        );
      })}
      <text x={L} y={TH - 3} fontSize="8" fill="#94a3b8">−{span} s</text>
      <text x={TW / 2} y={TH - 3} textAnchor="middle" fontSize="8" fill="#94a3b8">solid = firmware reading · dashed = true environment</text>
      <text x={TW - R} y={TH - 3} textAnchor="end" fontSize="8" fill="#94a3b8">now</text>
    </svg>
  );
}

/* ---------------- lab ---------------- */

const NO_SEEN = { all: false, frame: false, dist: false, pir: false, neg: false, fix: false, comp: false };
type Seen = typeof NO_SEEN;

export default function L34({ meta }: { meta: LabMeta }) {
  const lab = useLab<P34>({ slug: meta.slug, code: DEMO, params: P34_DEFAULT, mcu: mcu34, world: world34 });
  const { mcu, params: p } = lab;
  const fw = mcu.fw;
  const f = front(mcu);
  const now = mcu.now;
  const [pending, setPending] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [seen, setSeen] = useState<Seen>(NO_SEEN);
  const [failSeen, setFailSeen] = useState(false);
  const [chans, setChans] = useState<Chan[]>(["temp", "lux", "distance"]);
  const [follow, setFollow] = useState(true);
  const listRef = useRef<HTMLOListElement>(null);
  useEffect(() => { if (pending !== null && lab.code === pending) { setPending(null); lab.run(); } }, [pending, lab]);
  useEffect(() => { if (!msg) return; const id = window.setTimeout(() => setMsg(""), 4000); return () => window.clearTimeout(id); }, [msg]);

  const loadCode = (next: string) => { if (next === lab.code) { lab.run(); return; } lab.setCode(next); setPending(next); };
  const cf = (k: FieldKey) => codeField(lab.code, k);
  const edit = (k: FieldKey, v: string) => {
    if (cf(k) === null) { setMsg("This setting was not found in the code: edit the #define lines directly."); return; }
    const next = setCodeField(lab.code, k, v);
    if (next !== lab.code) loadCode(next);
  };
  const num = (k: FieldKey, d: number) => { const s = cf(k); if (s === null) return d; const x = Number(s); return Number.isFinite(x) ? x : d; };
  const opts = (list: number[], cur: number) => (list.includes(cur) ? list : [...list, cur].sort((a, b) => a - b));
  const dhtP = num("dht", 2000), trigUs = num("trig", 10), usCm = num("uscm", 58), loopMs = num("loop", 100), bhA = num("bh", BH_ADDR);

  const vals: Vals | null = fw ? (() => { const g = (k: string) => fw.num(k, Number.NaN); return { temp: g("temp"), hum: g("hum"), lux: g("lux"), pressure: g("pressure"), distance: g("distance"), motion: g("motion"), dhtErr: g("dht_err"), i2cErr: g("i2c_err"), echoErr: g("echo_err"), reads: g("reads") }; })() : null;
  const errs = { dhtErr: vals?.dhtErr ?? 0, i2cErr: vals?.i2cErr ?? 0, echoErr: vals?.echoErr ?? 0 };
  const hl = Object.fromEntries(SENSOR_KEYS.map((k) => [k, fw ? health(f, k, now, errs) : p[k] ? "wait" : "off"])) as Record<SensorKey, Health>;
  const ping = f.sonar.last;
  const trueD = targetPresent(p) ? p.distCm : Number.NaN;
  const distErr = vals && vals.distance > 0 && fin(trueD) ? vals.distance - trueD : Number.NaN;

  const hints: Array<{ text: string; tone?: "info"; fix?: Array<[string, () => void]> }> = [];
  const off = SENSOR_KEYS.filter((k) => !p[k]);
  if (!fw) hints.push({ text: "Press Run: the firmware initialises I²C and the GPIOs, then polls all five sensors every loop.", tone: "info" });
  if (off.length) hints.push({ text: `${off.map((k) => SENSOR[k].name).join(", ")} ${off.length === 1 ? "is" : "are"} unplugged, so ${off.length === 1 ? "its" : "their"} reading${off.length === 1 ? "" : "s"} cannot update.`, tone: "info", fix: [["Plug everything in", () => { for (const k of off) lab.setParam(k, true); }]] });
  if (fw && p.dht && !p.pullup && f.dht.timeouts) hints.push({ text: "DHT22 timeout: the data line is open-drain. Without the 10 kΩ pull-up nothing pulls it high again after the MCU's start pulse, so the sensor never answers.", fix: [["Fit the 10 kΩ pull-up", () => lab.setParam("pullup", true)]] });
  if (fw && f.dht.busyHits && now - f.dht.lastBusyAt < 3) hints.push({ text: `DHT22 timeout: it was asked again only ${(f.dht.lastBusyGap * 1e3).toFixed(0)} ms after the last reading. The sensor needs 2 s between conversions and ignores the start pulse until then (dht_err = ${errs.dhtErr}).`, fix: dhtP < 2000 ? [["DHT_PERIOD_MS = 2000", () => edit("dht", "2000")]] : undefined });
  if (fw && f.dht.csumErr && f.dht.frame && !f.dht.frame.ok && now - f.dht.frame.t < 4) hints.push({ text: `DHT22 checksum error: bit ${f.dht.frame.flipped} arrived flipped, the five bytes no longer add up. The firmware correctly throws the frame away and keeps the last good value.`, fix: p.emi ? [["Remove the interference", () => lab.setParam("emi", false)]] : undefined });
  if (vals && vals.temp > 1000) hints.push({ text: `Temperature = ${vals.temp.toFixed(1)} °C: the DHT22 marks negative values with bit 15 (sign + magnitude, not two's complement). 0x${hex4(f.dht.frame ? (f.dht.frame.sent[2]! << 8) | f.dht.frame.sent[3]! : 0)} must be read as −${((f.dht.frame ? ((f.dht.frame.sent[2]! << 8) | f.dht.frame.sent[3]!) & 0x7fff : 0) / 10).toFixed(1)} °C.`, fix: [["Handle the sign bit", () => loadCode(lab.code.includes("raw_t & 0x8000") ? DEMO : lab.code.replace("  return raw_t / 10.0f;", `${SIGN_LINE}  return raw_t / 10.0f;`))]] });
  const bhNack = f.lastTxn.bh && !f.lastTxn.bh.ack && p.bh;
  if (fw && bhNack) hints.push({ text: `BH1750 NACK: ${f.lastTxn.bh!.note}`, fix: bhA === BH_ADDR << 1 ? [["BH1750_ADDR = 0x23", () => edit("bh", "0x23")]] : p.addrHigh && bhA === BH_ADDR ? [["Tie ADDR low", () => lab.setParam("addrHigh", false)], ["Use 0x5C", () => edit("bh", "0x5C")]] : !p.addrHigh && bhA === BH_ALT ? [["BH1750_ADDR = 0x23", () => edit("bh", "0x23")]] : undefined });
  const bmpInitCalled = /\n\s*bmp280_init\(\);/.test(lab.compiledCode);
  if (fw && p.bmp && f.lastTxn.bmp?.ack && f.bmp.adcP === BMP_RESET) hints.push(bmpInitCalled
    ? { text: "Pressure = 700.00 hPa: the BMP280 was power-cycled. It woke up in sleep mode with the reset value 0x80000 in its data registers, and bmp280_init() only runs once at start-up.", fix: [["Restart the firmware", () => lab.run()]] }
    : { text: "Pressure = 700.00 hPa: the BMP280 wakes up in sleep mode and never converts. Its data registers keep the reset value 0x80000. Write ctrl_meas (0xF4) = 0x27 for normal mode.", fix: [["Call bmp280_init()", () => loadCode(/\n\s*bmp280_init\(\);/.test(lab.code) ? DEMO : lab.code.replace("  bh1750_init();\n", `  bh1750_init();\n${INIT_LINE}`))]] });
  if (fw && p.bh && f.lastTxn.bh?.ack && !f.bh.on && /\n\s*bh1750_init\(\);/.test(lab.compiledCode)) hints.push({ text: "Light = 0 lx: the BH1750 was power-cycled. It wakes up powered down and returns 0 counts until it receives a mode command, but bh1750_init() only runs once at start-up.", fix: [["Restart the firmware", () => lab.run()]] });
  if (fw && ping?.status === "short") hints.push({ text: `HC-SR04: TRIG was high for ${(ping.trigW * 1e6).toFixed(0)} µs. The module ignores pulses shorter than 10 µs, never sends its burst, and echo_pulse_us() times out (distance = −1).`, fix: [["TRIG_US = 10", () => edit("trig", "10")]] });
  if (fw && fin(distErr) && Math.abs(distErr) > Math.max(3, trueD * 0.3)) hints.push({ text: `Distance reads ${vals!.distance.toFixed(1)} cm for a target at ${trueD.toFixed(0)} cm. The echo time covers the trip there and back: 1 cm takes 2 × 10 mm ÷ 343 m/s ≈ 58 µs, not ${usCm} µs.`, fix: usCm !== 58 ? [["US_PER_CM = 58", () => edit("uscm", "58")]] : undefined });
  if (fw && ping?.status === "timeout" && !targetPresent(p)) hints.push({ text: `No echo: the target is beyond ${MAX_RANGE} cm, so ECHO stays high 38 ms, longer than the 30 ms timeout. The firmware reports −1.`, tone: "info", fix: [["Move the target to 100 cm", () => lab.setParam("distCm", 100)]] });
  if (fw && fin(distErr) && Math.abs(p.tempC - 20) >= 10 && !lab.compiledCode.includes("0.606") && Math.abs(distErr) <= Math.max(3, trueD * 0.3)) hints.push({ text: `At ${p.tempC.toFixed(0)} °C sound travels at ${soundSpeed(p.tempC).toFixed(1)} m/s, not 343 m/s, so the fixed 58 µs/cm reads ${distErr > 0 ? "long" : "short"} by ${Math.abs(distErr).toFixed(1)} cm. Use the DHT22 temperature to correct it.`, tone: "info", fix: [["Load the compensated version", () => loadCode(TEMPCOMP)]] });
  if (fw && p.pir && (p.motion || now < f.pir.burstUntil) && !f.pir.out && now < f.pir.lockUntil) hints.push({ text: `The PIR is in its block time: for ${PIR_LOCK} s after OUT drops it ignores movement, so a person walking past right now is not reported.`, tone: "info" });
  const problems = hints.filter((x) => x.tone !== "info");

  useEffect(() => { if (problems.length) setFailSeen(true); }, [problems.length]);
  const allOk = !!fw && SENSOR_KEYS.every((k) => hl[k] === "ok");
  const flags: Seen = {
    all: allOk,
    frame: p.sel === "dht" && !!f.dht.frame,
    dist: fin(distErr) && Math.abs(distErr) < 1 && Math.abs(trueD - P34_DEFAULT.distCm) > 5,
    pir: f.pir.edges.some(([, lv]) => lv === 0),
    neg: !!vals && vals.temp < 0 && Math.abs(vals.temp - p.tempC) < 1,
    fix: failSeen && !problems.length && allOk,
    comp: lab.compiledCode.includes("0.606") && fin(distErr) && Math.abs(distErr) < 1 && Math.abs(p.tempC - 20) >= 10,
  };
  useEffect(() => {
    const ks = Object.keys(flags) as Array<keyof Seen>;
    if (ks.some((k) => flags[k] && !seen[k])) setSeen((o) => { const n = { ...o }; for (const k of ks) n[k] = o[k] || flags[k]; return n; });
  });

  const lines = f.log.filter((l) => (p.filter === "all" ? true : p.filter === "errors" ? l.tone === "bad" || l.tone === "warn" : l.kind === "event")).slice(-120);
  const lastKey = `${lines.length}:${lines[lines.length - 1]?.id ?? 0}`;
  useEffect(() => { const el = listRef.current; if (follow && el) el.scrollTop = el.scrollHeight; }, [lastKey, follow]);

  const shellLab = { ...lab, resetLab: () => { lab.resetLab(); setPending(null); setSeen(NO_SEEN); setFailSeen(false); setChans(["temp", "lux", "distance"]); setFollow(true); } };
  const custom = !VARIANTS.some((x) => x.code === lab.compiledCode);
  const sel = p.sel;
  const fr = f.dht.frame;

  const card = (k: SensorKey, title: string, value: string, sub: string, color: string) => (
    <button type="button" key={k} className={`mcl-l34-card ${sel === k ? "on" : ""}`} style={{ ["--c" as string]: color }} aria-pressed={sel === k} onClick={() => lab.setParam("sel", k)} title={`Inspect the ${SENSOR[k].name} signals`}>
      <header><span>{title}</span><i style={{ background: HC[hl[k]] }} title={HTEXT[hl[k]]} /></header>
      <b>{value}</b>
      <small>{sub}</small>
    </button>
  );
  const ago = (t: number | undefined) => (t === undefined ? "" : now - t < 0.2 ? "just now" : `${(now - t).toFixed(1)} s ago`);
  const tempCard = !vals || !p.dht ? "– –" : !f.dht.frames ? "…" : `${vals.temp.toFixed(1)}°C`;
  const luxCard = !vals || !p.bh || !f.lastTxn.bh ? "– –" : `${Math.round(vals.lux)} lx`;
  const presCard = !vals || !p.bmp || !f.lastTxn.bmp ? "– –" : `${Math.round(vals.pressure)} hPa`;
  const distCard = !vals || !p.sonar || !ping ? "– –" : vals.distance < 0 ? "no echo" : `${Math.round(vals.distance)} cm`;
  const motCard = !vals || !p.pir ? "– –" : vals.motion ? "Detected" : "Idle";

  const notesData = {
    takeaways: [
      "Every sensor talks a different language: a timed single-wire frame (DHT22), I²C registers (BH1750, BMP280), a pulse width (HC-SR04) and a plain logic level (PIR).",
      "Raw counts are not physical units: the datasheet formula (÷ 1.2 for lux, ÷ 10 for °C, ÷ 58 µs for cm) turns them into numbers people understand.",
      "Sensors have timing rules: the DHT22 needs 2 s between readings, the BH1750 120 ms per conversion, the HC-SR04 a 10 µs trigger.",
      "Check what you receive: the DHT22 checksum and the I²C ACK tell the firmware when to keep the last good value instead.",
      "Physical effects leak into readings: the DHT22 lags behind the air, sound slows down in cold air, the PIR holds and then blocks.",
    ],
    observe: "Press Run. After 2 s all five cards show live values. Watch the wires on the workbench light up as each sensor is read, and the trends follow the dashed true values.",
    tryIt: "Drag the temperature below 0 °C, move the target, cover the light sensor and toggle 'Person moving'. Click a card to see that sensor's wire-level signal.",
    measure: `Now: ${vals ? `T ${vals.temp.toFixed(1)} °C (air ${p.tempC.toFixed(1)}), ${Math.round(vals.lux)} lx, ${vals.pressure.toFixed(2)} hPa, ${vals.distance < 0 ? "no echo" : `${vals.distance.toFixed(1)} cm (true ${fin(trueD) ? trueD.toFixed(1) : "–"})`}, motion ${vals.motion}; errors DHT ${errs.dhtErr}, I²C ${errs.i2cErr}, echo ${errs.echoErr}` : "press Run"}.`,
    modify: "Set DHT_PERIOD_MS to 500 and watch dht_err climb. Change US_PER_CM to 29 and compare the distance with the target. Change LOOP_MS and see the trend resolution change.",
    runAgain: "Load each bug example, read the hint and fix it. Then load the temperature-compensated version, cool the air to −10 °C and compare the distance error.",
    challenge: "Make the distance exact at any temperature, and make the thermometer read −15.0 °C correctly.",
    question: "Why does the DHT22 reading lag behind the air temperature by several seconds while the BH1750 follows the light almost instantly?",
    checks: [
      { label: "Get live readings from all five sensors", done: seen.all },
      { label: "Inspect a DHT22 frame and its checksum", done: seen.frame },
      { label: "Move the target and measure it within 1 cm", done: seen.dist },
      { label: "Trigger the PIR and watch OUT drop again", done: seen.pir },
      { label: "Read a temperature below 0 °C with the right sign", done: seen.neg },
      { label: "Find and fix a sensor bug or wiring fault", done: seen.fix },
      { label: "Compensate the speed of sound (|T − 20 °C| ≥ 10)", done: seen.comp },
    ],
  };

  return (
    <LabShell meta={meta} lab={shellLab} subtitle="Temperature, light, pressure, distance and motion sensors with live readings."
      components={["STM32 Nucleo-F401RE (3.3 V)", "DHT22 temperature / humidity sensor on PA1 with a 10 kΩ pull-up (single-wire, 40-bit frames)", "BH1750 light sensor (I²C 0x23) and BMP280 pressure sensor (I²C 0x76) on PB8/PB9", "HC-SR04 ultrasonic ranger: TRIG on PA8, ECHO on PA9 (5 V tolerant)", "HC-SR501 PIR motion sensor: OUT on PB0 with pull-down"]}>
      <div className="mcl-grid mcl-g4-grid">
        <Panel title="Multi-Sensor Workbench" icon="cpu" className="mcl-g4-vis">
          <Scene f={f} p={p} now={now} vals={vals} hl={hl} onPlug={(k) => lab.setParam(k, !p[k])} />
          <div className="mcl-l34-env">
            <label className="mcl-l31-temp"><span><Icon name="thermo" size={13} />Temperature</span><input type="range" min={-20} max={60} step={0.1} value={p.tempC} aria-label="Air temperature" onChange={(ev) => lab.setParam("tempC", Number(ev.target.value))} /><b>{p.tempC.toFixed(1)} °C</b></label>
            <label className="mcl-l31-temp"><span>Humidity</span><input type="range" min={0} max={100} step={1} value={p.rh} aria-label="Relative humidity" onChange={(ev) => lab.setParam("rh", Number(ev.target.value))} /><b>{Math.round(p.rh)} %</b></label>
            <label className="mcl-l31-temp"><span><Icon name="bulb" size={13} />Light</span><input type="range" min={0} max={118.4} step={0.1} value={luxToS(p.lux)} aria-label="Ambient light (logarithmic)" onChange={(ev) => lab.setParam("lux", sToLux(Number(ev.target.value)))} /><b>{p.lux >= 10000 ? `${(p.lux / 1000).toFixed(1)}k` : Math.round(p.lux)} lx</b></label>
            <label className="mcl-l31-temp"><span><Icon name="gauge" size={13} />Pressure</span><input type="range" min={950} max={1050} step={0.25} value={p.hPa} aria-label="Air pressure" onChange={(ev) => lab.setParam("hPa", Number(ev.target.value))} /><b>{p.hPa.toFixed(1)} hPa</b></label>
            <label className="mcl-l31-temp"><span><Icon name="target" size={13} />Target</span><input type="range" min={1} max={450} step={1} value={p.distCm} aria-label="Target distance" onChange={(ev) => lab.setParam("distCm", Number(ev.target.value))} /><b>{p.distCm > MAX_RANGE ? "none" : `${p.distCm} cm`}</b></label>
            <div className="mcl-l34-motion">
              <Toggle label="Person moving" checked={p.motion} onChange={(x) => lab.setParam("motion", x)} hint="Someone walks around in front of the PIR" />
              <button type="button" className="mcl-l31-btn" onClick={() => waveHand(mcu)} disabled={!fw}>Wave hand</button>
            </div>
          </div>
        </Panel>

        <div className="mcl-g4-cfg mcl-l34-cards" role="group" aria-label="Sensor readings">
          {card("dht", "Temp", tempCard, !p.dht ? "DHT22 unplugged" : vals && f.dht.frames ? `RH ${vals.hum.toFixed(1)} % · ${HTEXT[hl.dht]} · ${ago(f.dht.frame?.t)}` : fw ? "first reading after 2 s" : "DHT22 · press Run", SENSOR.dht.color)}
          {card("bh", "Light", luxCard, !p.bh ? "BH1750 unplugged" : hl.bh === "err" ? "BH1750 NACK" : vals ? `BH1750 · ${f.bh.raw} counts · ${HTEXT[hl.bh]}` : "BH1750 · press Run", SENSOR.bh.color)}
          {card("bmp", "Pressure", presCard, !p.bmp ? "BMP280 unplugged" : hl.bmp === "err" ? "BMP280 NACK" : vals ? `${vals.pressure.toFixed(2)} hPa · ${f.bmp.adcP === BMP_RESET ? "sleep mode" : HTEXT[hl.bmp]}` : "BMP280 · press Run", SENSOR.bmp.color)}
          {card("sonar", "Distance", distCard, !p.sonar ? "HC-SR04 unplugged" : vals && ping ? (ping.status === "ok" ? `${vals.distance.toFixed(1)} cm · echo ${ping.us} µs` : `${ping.status === "timeout" ? "no echo in 30 ms" : ping.status === "short" ? "trigger too short" : "no trigger"}`) : "HC-SR04 · press Run", SENSOR.sonar.color)}
          {card("pir", "Motion", motCard, !p.pir ? "HC-SR501 unplugged" : vals ? (f.pir.out ? `OUT high · ${Math.max(0, f.pir.holdUntil - now).toFixed(1)} s hold` : now < f.pir.lockUntil ? `blocked ${(f.pir.lockUntil - now).toFixed(1)} s` : `HC-SR501 · ${f.pir.rises} trigger${f.pir.rises === 1 ? "" : "s"}`) : "HC-SR501 · press Run", SENSOR.pir.color)}
          <div className={`mcl-l31-status ${!fw ? "off" : problems.length ? "warn" : allOk ? "ok" : "off"}`}>
            <Icon name={allOk && !problems.length ? "check" : "alert"} size={16} />
            <div>
              <b>{!fw ? "Firmware stopped" : allOk && !problems.length ? "All sensors live" : problems.length ? `${problems.length} problem${problems.length === 1 ? "" : "s"}` : off.length ? `${off.length} sensor${off.length === 1 ? "" : "s"} unplugged` : now < 3 ? "Starting up…" : "Waiting for readings"}</b>
              <span>{vals ? `dht_err ${errs.dhtErr} · i2c_err ${errs.i2cErr} · echo_err ${errs.echoErr} · loop ${loopMs} ms` : "Press Run to flash the board."}</span>
            </div>
          </div>
        </div>

        <Panel title="Sensor Signals" icon="wave" className="mcl-g4-scope mcl-l32-scopep"
          tools={<label className="mcl-l31-inline"><span className="mcl-l31-lbl">Sensor:</span><select value={sel} aria-label="Sensor to inspect" onChange={(ev) => lab.setParam("sel", ev.target.value as SensorKey)}>{SENSOR_KEYS.map((k) => <option key={k} value={k}>{SENSOR[k].name} · {SENSOR[k].what}</option>)}</select></label>}>
          <p className="mcl-l31-sub mcl-l34-busline"><b>{SENSOR[sel].name}</b> · {SENSOR[sel].bus} · {SENSOR[sel].pins}</p>
          {sel === "dht" ? (
            <>
              <DhtWave fr={fr} />
              {fr ? (
                <div className="mcl-l34-bytes" aria-label="DHT22 frame bytes">
                  {["RH high", "RH low", "T high", "T low", "Checksum"].map((nm, i) => {
                    const b = fr.sent[i]!, bad = fr.flipped !== null && fr.flipped >> 3 === i;
                    return <div key={nm} className={bad ? "bad" : i === 4 ? (fr.ok ? "ok" : "bad") : ""}><span>{nm}</span><b>0x{hex2(b)}</b><code>{b.toString(2).padStart(8, "0")}</code></div>;
                  })}
                </div>
              ) : null}
              {fr ? <p className="mcl-l31-sub">Checksum: {fr.sent.slice(0, 4).map(hex2).join(" + ")} = 0x{hex2(checksum(fr.sent))} {fr.ok ? "= " : "≠ "}0x{hex2(fr.sent[4]!)} {fr.ok ? "✓" : "✗ frame discarded"} · RH = 0x{hex4((fr.sent[0]! << 8) | fr.sent[1]!)} ÷ 10 = {fr.rh.toFixed(1)} % · T = 0x{hex4((fr.sent[2]! << 8) | fr.sent[3]!)}{fr.sent[2]! & 0x80 ? " (bit 15 = minus)" : ""} → {fr.temp.toFixed(1)} °C</p> : null}
              <div className="mcl-l31-rows mcl-l32-rows mcl-l34-rows">
                <label><span>Read period</span><select value={dhtP} disabled={cf("dht") === null} aria-label="DHT_PERIOD_MS" onChange={(ev) => edit("dht", ev.target.value)}>{opts(DHT_PERIODS, dhtP).map((k) => <option key={k} value={k}>{k} ms{k < 2000 ? " (too fast)" : ""}</option>)}</select></label>
                <div className="mcl-l34-faults">
                  <Toggle label="10 kΩ pull-up" checked={p.pullup} onChange={(x) => lab.setParam("pullup", x)} hint="Remove the pull-up resistor on the data line" />
                  <Toggle label="Interference" checked={p.emi} onChange={(x) => lab.setParam("emi", x)} hint="Long cable next to a motor: every other frame gets a flipped bit" />
                </div>
              </div>
            </>
          ) : sel === "sonar" ? (
            <>
              <SonarWave ping={ping} />
              <div className="mcl-l31-rows mcl-l32-rows mcl-l34-rows">
                <label><span>TRIG pulse</span><select value={trigUs} disabled={cf("trig") === null} aria-label="TRIG_US" onChange={(ev) => edit("trig", ev.target.value)}>{opts(TRIGS, trigUs).map((k) => <option key={k} value={k}>{k} µs{k < 10 ? " (too short)" : ""}</option>)}</select></label>
                <label><span>µs per cm</span><select value={usCm} disabled={cf("uscm") === null} aria-label="US_PER_CM" onChange={(ev) => edit("uscm", ev.target.value)}>{opts(USCM, usCm).map((k) => <option key={k} value={k}>{k}{k === 29 ? " (one way)" : k === 58 ? " (343 m/s)" : ""}</option>)}</select></label>
              </div>
              <p className="mcl-l31-sub">Sound at {p.tempC.toFixed(1)} °C: {soundSpeed(p.tempC).toFixed(1)} m/s → {(2e4 / soundSpeed(p.tempC)).toFixed(1)} µs per cm.{lab.compiledCode.includes("0.606") ? " The firmware corrects for temperature." : <> <button type="button" className="mcl-l31-link" onClick={() => loadCode(TEMPCOMP)}>Load the temperature-compensated version</button></>}</p>
            </>
          ) : sel === "pir" ? (
            <>
              <PirWave hist={f.hist} now={now} lockUntil={f.pir.lockUntil} />
              <p className="mcl-l31-sub">OUT is {f.pir.out ? "HIGH" : "LOW"}{f.pir.out ? ` for another ${Math.max(0, f.pir.holdUntil - now).toFixed(1)} s` : now < f.pir.lockUntil ? `, blocked for ${(f.pir.lockUntil - now).toFixed(1)} s` : ""} · {f.pir.rises} trigger{f.pir.rises === 1 ? "" : "s"} · the firmware just reads PB0, the module does the detection.</p>
            </>
          ) : (
            <>
              <Frame t={f.lastTxn[sel]} />
              <p className="mcl-l31-sub">{f.lastTxn[sel] ? `${f.lastTxn[sel]!.t.toFixed(3)} s · ${(f.lastTxn[sel]!.dur * 1e6).toFixed(0)} µs on the bus · ${f.lastTxn[sel]!.note}` : fw ? "Waiting for the first transaction…" : "Press Run."}</p>
              {sel === "bh" ? (
                <>
                  <div className="mcl-l34-decode"><span>Raw counts</span><b>{f.bh.raw}</b><span>÷ 1.2</span><b>{(f.bh.raw / 1.2).toFixed(1)} lx</b><span>mode</span><b>{f.bh.on && f.bh.mode ? `0x${hex2(f.bh.mode)} continuous H-res` : "power down"}</b></div>
                  <div className="mcl-l31-rows mcl-l32-rows mcl-l34-rows">
                    <label><span>Address</span><select value={bhA} disabled={cf("bh") === null} aria-label="BH1750_ADDR" onChange={(ev) => edit("bh", `0x${hex2(Number(ev.target.value))}`)}>{opts(BH_OPTS, bhA).map((k) => <option key={k} value={k}>0x{hex2(k)}{k === BH_ADDR ? " (ADDR low)" : k === BH_ALT ? " (ADDR high)" : k === BH_ADDR << 1 ? " (shifted twice)" : ""}</option>)}</select></label>
                    <div className="mcl-l34-faults"><Toggle label="ADDR pin high" checked={p.addrHigh} onChange={(x) => lab.setParam("addrHigh", x)} hint="Tie the BH1750 ADDR pin to 3.3 V: it moves to 0x5C" /></div>
                  </div>
                </>
              ) : (
                <div className="mcl-l34-decode"><span>adc_P</span><b>{f.bmp.adcP}</b><span>compensated</span><b>{(compP(f.bmp.adcP) / 100).toFixed(2)} hPa</b><span>ctrl_meas</span><b>0x{hex2(f.bmp.ctrl)} {["sleep", "forced", "forced", "normal"][f.bmp.ctrl & 3]}</b></div>
              )}
            </>
          )}
        </Panel>

        <CodeEditor lab={lab} className="mcl-g4-code" languages={VARIANTS} />

        <Panel title="Live Sensor Trends" icon="activity" className="mcl-g4-mon mcl-l32-scopep"
          tools={<>
            <label className="mcl-l31-inline"><span className="mcl-l31-lbl">Window:</span><select value={p.span} aria-label="Trend window" onChange={(ev) => lab.setParam("span", Number(ev.target.value))}>{SPANS.map((s) => <option key={s} value={s}>{s} s</option>)}</select></label>
            <label className="mcl-l31-inline"><span className="mcl-l31-lbl">Loop:</span><select value={loopMs} disabled={cf("loop") === null} aria-label="LOOP_MS" onChange={(ev) => edit("loop", ev.target.value)}>{opts(LOOPS, loopMs).map((k) => <option key={k} value={k}>{k} ms</option>)}</select></label>
          </>}>
          <div className="mcl-l34-chans" role="group" aria-label="Trend channels">
            {CHANS.map((c) => { const on = chans.includes(c); return <button key={c} type="button" aria-pressed={on} className={on ? "on" : ""} style={{ ["--c" as string]: CH[c].color }} onClick={() => setChans((o) => (on ? o.filter((x) => x !== c) : CHANS.filter((x) => x === c || o.includes(x))))}><i />{CH[c].label}</button>; })}
          </div>
          <Trend hist={f.hist} now={now} span={p.span} chans={chans} />
          <p className="mcl-l31-sub">Adjust the simulated environment and inspect how each sensor responds.</p>
          <div className="mcl-l31-counts">
            <span>{f.dht.frames} DHT frames</span><span>{f.txns.length ? `${f.bh.reads + f.bmp.reads} I²C` : "0 I²C"}</span><span>{f.sonar.pings} pings</span>
            {f.dht.timeouts + f.dht.csumErr + f.bh.nacks + f.bmp.nacks + f.sonar.timeouts ? <span className="bad">errors {f.dht.timeouts + f.dht.csumErr + f.bh.nacks + f.bmp.nacks + f.sonar.timeouts}</span> : null}
            <div className="mcl-l31-faultbtns">
              <label className="mcl-l31-inline"><select value={p.filter} aria-label="Log filter" onChange={(ev) => lab.setParam("filter", ev.target.value as LogFilter)}>{FILTERS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
              <label className="mcl-l31-inline"><input type="checkbox" checked={follow} onChange={(ev) => setFollow(ev.target.checked)} />Auto-scroll</label>
              <button type="button" className="mcl-l31-btn" onClick={() => clearLog(mcu)}>Clear</button>
            </div>
          </div>
          <ol className="mcl-l31-mon mcl-l34-mon" ref={listRef} aria-label="Sensor log">
            {lines.map((ln) => (
              <li key={ln.id}>
                <button type="button" className={`${ln.tone === "bad" ? "bad" : ln.tone === "warn" ? "warn" : ""} ${ln.sensor !== "sys" && ln.sensor === sel ? "on" : ""}`} onClick={() => { if (ln.sensor !== "sys") lab.setParam("sel", ln.sensor); }}>
                  <time>{ln.t.toFixed(3)}</time>
                  <span><code className="mcl-l31-frame"><span className={ln.tone === "bad" ? "n" : ln.tone === "ok" ? "a" : ln.tone === "warn" ? "k" : "ad"}>{ln.title}</span></code><em>{ln.text}</em></span>
                </button>
              </li>
            ))}
            {!lines.length ? <li className="mcl-l31-empty">{fw ? "Nothing logged yet for this filter." : "Press Run to start."}</li> : null}
          </ol>
          {msg ? <p className="mcl-l31-hint"><Icon name="alert" size={14} /><span>{msg}</span></p> : null}
          {hints.slice(0, 3).map((x) => (
            <p key={x.text} className={`mcl-l31-hint ${x.tone ?? ""}`}><Icon name={x.tone === "info" ? "bulb" : "alert"} size={14} /><span>{x.text}</span>{x.fix?.map(([l, fn]) => <button key={l} type="button" onClick={fn}>{l}</button>)}</p>
          ))}
          <p className="mcl-l31-sub">{lab.dirty && !pending ? "The editor has unflashed changes: press Run to apply them. " : ""}Click a log line to inspect that sensor.{custom && fw ? " Running your own version of the program." : ""}</p>
        </Panel>

        <div className="mcl-g4-notes"><LearningNotes notes={notesData} /></div>
      </div>
    </LabShell>
  );
}
