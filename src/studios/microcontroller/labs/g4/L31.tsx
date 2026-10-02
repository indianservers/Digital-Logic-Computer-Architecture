import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useLab } from "../core/useLab";
import type { LabMeta } from "../registry";
import { CodeEditor } from "../ui/CodeEditor";
import { Breadboard, HwDefs, NucleoBoard, Resistor, SvgLed, Wire } from "../ui/Hardware";
import { Icon } from "../ui/Icon";
import { LearningNotes, Panel, Toggle } from "../ui/Panels";
import { LabShell } from "../ui/Shell";
import {
  ACKPOLL, clearTxns, codeField, DEMO, DEV_NAME, devAddr, eeprom, elec, fmtHz, fmtT, front, hangBus, hex2, injectNack, internalPull, mcu31, monitor, OLED_PAGES, OLED_W,
  oledPixel, oledVisible, P31_DEFAULT, powerCycle, PULL_LABEL, PULLUPS, RECOVER, resetEeprom, scanResult, setCodeField, SPANS, tempAddrOf, timing, tmpCelsius, TR_MAX,
  VARIANTS, world31, type DevKey, type FieldKey, type Front, type Item, type MonLine, type P31, type PullKey, type Trig, type Txn,
} from "./L31sim";

const C = { vcc: "#ef4444", gnd: "#1f2937", sda: "#16a34a", scl: "#1677ff" } as const;
const SC = { sda: "#34d399", scl: "#60a5fa" } as const;
const DEVS: DevKey[] = ["oled", "temp", "eeprom"];
const ADD0 = ["GND", "VCC", "SDA", "SCL"];
const HAL = ["HAL_OK", "HAL_ERROR", "HAL_BUSY", "HAL_TIMEOUT"];
const TRIGS: Array<[Trig, string]> = [["temp", "TMP102"], ["oled", "SSD1306"], ["eeprom", "24C02"], ["nack", "NACK / error"], ["any", "Any"]];
type Byte = Extract<Item, { k: "byte" }>;
const isByte = (it: Item): it is Byte => it.k === "byte";

/* ---------------- hardware scene ---------------- */

const W = 660, H = 300;
const NX = 16, NY = 262, NS = 0.64;
const headerX = (a: number) => NX + (100 + 7.2 * (a + 0.5)) * NS;
const HEADER_Y = NY - 179.2 * NS;
const RAIL = { vcc: 34, sda: 58, scl: 78, gnd: 98 } as const;
const RX0 = 248, RX1 = 646;
const MY = 120, MH = 150;
const MODS: Record<DevKey, { x: number; w: number; color: string; dark: string; title: string }> = {
  oled: { x: 318, w: 140, color: "#1677ff", dark: "#0b4fc4", title: "OLED" },
  temp: { x: 468, w: 82, color: "#16a34a", dark: "#0f7a37", title: "TEMP" },
  eeprom: { x: 560, w: 82, color: "#f59e0b", dark: "#b86f05", title: "EEPROM" },
};
const PINS = [["GND", RAIL.gnd, C.gnd], ["VCC", RAIL.vcc, C.vcc], ["SCL", RAIL.scl, C.scl], ["SDA", RAIL.sda, C.sda]] as const;

function oledPath(f: Front): string {
  let d = "";
  for (let y = 0; y < OLED_PAGES * 8; y++) {
    let x = 0;
    while (x < OLED_W) {
      if (!oledPixel(f.oled, x, y)) { x++; continue; }
      const s = x;
      while (x < OLED_W && oledPixel(f.oled, x, y)) x++;
      d += `M${s} ${y}h${x - s}v1h${s - x}z`;
    }
  }
  return d;
}

interface SceneProps { p: P31; f: Front; now: number; act: Record<DevKey, boolean>; busLive: boolean; intPull: boolean; onToggle: (k: DevKey) => void }

function Scene({ p, f, now, act, busLive, intPull, onToggle }: SceneProps) {
  const hung = !!f.hang;
  const noPull = p.pullup === "none";
  const key = (k: DevKey) => (e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(k); } };
  const wires = [
    { a: 4, y: RAIL.vcc, color: C.vcc, net: "3V3" },
    { a: 5, y: RAIL.sda, color: hung ? "#dc2626" : C.sda, net: "PB9 · SDA" },
    { a: 6, y: RAIL.scl, color: C.scl, net: "PB8 · SCL" },
    { a: 7, y: RAIL.gnd, color: C.gnd, net: "GND" },
  ];
  const visible = oledVisible(f.oled);
  const px = p.oled && visible ? oledPath(f) : "";
  const eeBusy = f.ee.busyUntil > now;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mcl-l31-scene" role="img" aria-label={`STM32 Nucleo with an I2C bus on PB8/PB9 and ${DEVS.filter((k) => p[k]).map((k) => DEV_NAME[k]).join(", ") || "no devices"} on the breadboard`}>
      <HwDefs id="l31" />
      <Breadboard x={6} y={6} w={648} h={288} cols={54} rows={17} />
      <g transform={`translate(${NX} ${NY}) rotate(-90)`}>
        <NucleoBoard scale={NS} id="l31" ld2={false} power chipLabel="F401RE" />
      </g>
      <text x={123} y={282} textAnchor="middle" fontSize="10" fontWeight="700" fill="#0f2547">STM32 Nucleo (F401RE) · I2C1</text>
      {intPull ? <text x={20} y={126} fontSize="8" fontWeight="700" fill="#7c3aed">internal 40 kΩ pull-ups on PB8/PB9</text> : null}

      {(["vcc", "sda", "scl", "gnd"] as const).map((k) => {
        const color = k === "sda" && hung ? "#dc2626" : C[k];
        return <Wire key={k} d={`M${RX0} ${RAIL[k]} H${RX1}`} color={color} width={k === "sda" || k === "scl" ? 3 : 2.4} live={busLive && (k === "sda" || k === "scl")} />;
      })}
      {(["vcc", "sda", "scl", "gnd"] as const).map((k) => <text key={k} x={RX1 - 2} y={RAIL[k] - 4} textAnchor="end" fontSize="8" fontWeight="800" fill={k === "sda" && hung ? "#dc2626" : C[k]}>{k === "vcc" ? "3V3" : k === "gnd" ? "GND" : k === "sda" ? (hung ? "SDA held low by TMP102" : "SDA") : "SCL"}</text>)}

      {wires.map((w) => {
        const sx = headerX(w.a);
        return (
          <g key={w.a}>
            <Wire d={`M${sx} ${HEADER_Y} V${w.y} H${RX0}`} color={w.color} width={2.2} live={busLive && (w.a === 5 || w.a === 6)} />
            <circle cx={sx} cy={HEADER_Y} r={2.3} fill={w.color} stroke="#fff" strokeWidth={0.8} />
            <text x={160} y={w.y - 3} fontSize="7.5" fontWeight="700" fill="#33496b">{w.net}</text>
          </g>
        );
      })}

      {([["sda", 268], ["scl", 292]] as const).map(([k, x]) => {
        const y1 = RAIL.vcc, y2 = RAIL[k], cy = (y1 + y2) / 2;
        return (
          <g key={k}>
            {noPull ? (
              <>
                <rect x={x - 4} y={cy - 9} width={8} height={18} rx={2} fill="none" stroke="#94a3b8" strokeDasharray="2 2" />
                <circle cx={x} cy={y2} r={2} fill="#cbd5e1" />
              </>
            ) : (
              <>
                <line x1={x} x2={x} y1={y1} y2={y2} stroke="#9ca3af" strokeWidth={1.6} />
                <Resistor x={x} y={cy} vertical />
                <circle cx={x} cy={y1} r={2.2} fill={C.vcc} /><circle cx={x} cy={y2} r={2.2} fill={C[k]} />
              </>
            )}
          </g>
        );
      })}
      <text x={302} y={49} fontSize="8" fontWeight="700" fill={noPull ? "#dc2626" : "#33496b"}>{noPull ? "no external pull-ups" : `Rp ${PULL_LABEL[p.pullup]}`}<tspan fontWeight="500" fill="#64748b"> · C bus ≈ {p.cap + 10 + 10 * DEVS.filter((k) => p[k]).length} pF</tspan></text>

      {DEVS.map((k) => {
        const m = MODS[k], on = p[k], cx = m.x + m.w / 2;
        const addr = devAddr(p, k);
        return (
          <g key={k} className={`mcl-l31-mod ${on ? "" : "off"} ${on && act[k] ? "act" : ""}`} role="button" tabIndex={0} aria-pressed={on}
            aria-label={`${DEV_NAME[k]} at 0x${hex2(addr)}: ${on ? "plugged in, click to unplug" : "unplugged, click to plug in"}`} onClick={() => onToggle(k)} onKeyDown={key(k)}>
            {on ? PINS.map(([, ry, col], i) => <g key={i}><line x1={cx - 18 + i * 12} x2={cx - 18 + i * 12} y1={MY + 6} y2={ry} stroke={col} strokeWidth={1.6} /><circle cx={cx - 18 + i * 12} cy={ry} r={2} fill={col} /></g>) : null}
            <rect x={m.x + 2} y={MY + 4} width={m.w} height={MH} rx={7} fill="#00000022" />
            <rect className="mcl-l31-pcb" x={m.x} y={MY} width={m.w} height={MH} rx={7} fill={m.color} stroke={m.dark} strokeWidth={1.2} strokeDasharray={on ? undefined : "4 3"} />
            {PINS.map(([lb], i) => (
              <g key={lb}>
                <rect x={cx - 21.5 + i * 12} y={MY + 3} width={7} height={7} rx={1} fill="#1c1f24" />
                <rect x={cx - 19.5 + i * 12} y={MY + 5} width={3} height={3} fill="#d4af37" />
                <text x={cx - 18 + i * 12} y={MY + 17} textAnchor="middle" fontSize="5" fontWeight="700" fill="#ffffffd0">{lb}</text>
              </g>
            ))}
            <text x={cx} y={MY + 31} textAnchor="middle" fontSize="11" fontWeight="800" fill="#fff">{m.title}</text>
            <text x={cx} y={MY + 42} textAnchor="middle" fontSize="8.5" fontWeight="600" fill="#ffffffd8" fontFamily="ui-monospace, Consolas, monospace">0x{hex2(addr)}</text>
            {k === "oled" ? (
              <g>
                <rect x={m.x + 4} y={MY + 50} width={OLED_W + 4} height={OLED_PAGES * 8 + 4} rx={2} fill="#0b0f17" stroke="#020617" />
                <g transform={`translate(${m.x + 6} ${MY + 52})`}>
                  {px ? <path d={px} fill="#8ad8ff" opacity={0.55 + (f.oled.contrast / 255) * 0.45} /> : null}
                </g>
                <text x={cx} y={MY + 100} textAnchor="middle" fontSize="7" fill="#dbeafe">SSD1306 · 128×32</text>
                <text x={cx} y={MY + 112} textAnchor="middle" fontSize="7" fill="#bfdbfe">{!on ? "" : visible ? "display on" : f.oled.on ? "on, charge pump off" : "display off"}</text>
              </g>
            ) : null}
            {k === "temp" ? (
              <g>
                <rect x={cx - 13} y={MY + 54} width={26} height={18} rx={2} fill="#111827" stroke="#374151" />
                <text x={cx} y={MY + 66} textAnchor="middle" fontSize="6" fontWeight="700" fill="#e5e7eb">TMP102</text>
                <text x={cx} y={MY + 88} textAnchor="middle" fontSize="9" fontWeight="800" fill="#fff">{p.tempC.toFixed(1)} °C</text>
                <rect x={m.x + 8} y={MY + 98} width={m.w - 16} height={14} rx={3} fill="#0f5132" />
                <text x={cx} y={MY + 108} textAnchor="middle" fontSize="7" fontWeight="700" fill="#d1fae5">ADD0 → {ADD0[p.tempAddr & 3]}</text>
              </g>
            ) : null}
            {k === "eeprom" ? (
              <g>
                <rect x={cx - 16} y={MY + 54} width={32} height={20} rx={2} fill="#111827" stroke="#374151" />
                {Array.from({ length: 4 }, (_, j) => <g key={j}><rect x={cx - 13 + j * 8} y={MY + 51} width={3} height={3} fill="#cbd5e1" /><rect x={cx - 13 + j * 8} y={MY + 74} width={3} height={3} fill="#cbd5e1" /></g>)}
                <text x={cx} y={MY + 67} textAnchor="middle" fontSize="6.5" fontWeight="700" fill="#e5e7eb">24C02</text>
                <SvgLed x={m.x + m.w - 10} y={MY + 30} r={3} on={on && eeBusy} color="red" id="l31" />
                <text x={cx} y={MY + 90} textAnchor="middle" fontSize="7" fill="#fff7ed">{on && eeBusy ? "write cycle" : "2 Kbit EEPROM"}</text>
                <text x={cx} y={MY + 104} textAnchor="middle" fontSize="7" fontWeight="700" fill="#fff" fontFamily="ui-monospace, Consolas, monospace">[0x00] = 0x{hex2(eeprom()[0]!)}</text>
              </g>
            ) : null}
            <text x={cx} y={MY + MH - 10} textAnchor="middle" fontSize="7" fontWeight="700" fill="#fff">{on ? "click to unplug" : "unplugged · click to plug in"}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ---------------- SDA / SCL scope ---------------- */

const PW = 560, PH = 180, PL = 38, PR = 8;
const LANE = { sda: [34, 80], scl: [104, 150] } as const;

function analogPath(edges: Array<[number, number]>, w0: number, w1: number, tau: number, X: (t: number) => number, yHi: number, yLo: number) {
  const Y = (v: number) => (yLo - v * (yLo - yHi)).toFixed(1);
  const segs: Array<[number, number, number, number]> = [];
  let ta = -Infinity, target = 1, vs = 1;
  const volt = (t: number) => (target ? (Number.isFinite(ta) ? 1 - (1 - vs) * Math.exp(-(t - ta) / tau) : 1) : 0);
  for (const [t, l] of edges) { segs.push([ta, t, target, vs]); vs = volt(t); ta = t; target = l; }
  segs.push([ta, Infinity, target, vs]);
  const pts: string[] = [];
  for (const [a0, b0, tg, v0] of segs) {
    const a = Math.max(a0, w0), b = Math.min(b0, w1);
    if (a >= b) continue;
    const at = (t: number) => (tg ? (Number.isFinite(a0) ? 1 - (1 - v0) * Math.exp(-(t - a0) / tau) : 1) : 0);
    if (a0 >= w0) pts.push(`${X(a0).toFixed(1)} ${Y(v0)}`);
    pts.push(`${X(a).toFixed(1)} ${Y(at(a))}`);
    if (tg && Number.isFinite(a0)) {
      for (const k of [0.12, 0.3, 0.55, 0.85, 1.2, 1.7, 2.4, 3.3, 4.5]) { const t = a0 + k * tau; if (t > a && t < b) pts.push(`${X(t).toFixed(1)} ${Y(at(t))}`); }
    }
    pts.push(`${X(b).toFixed(1)} ${Y(at(b))}`);
  }
  return pts.length ? `M${pts.join(" L")}` : "";
}

function Scope({ t, page, span, empty }: { t: Txn | null; page: number; span: number; empty: string }) {
  const w = PW - PL - PR;
  const grid = (
    <g>
      <rect x={0} y={0} width={PW} height={PH} rx={6} fill="#0b1626" />
      {Array.from({ length: 11 }, (_, i) => <line key={i} x1={PL + (i / 10) * w} x2={PL + (i / 10) * w} y1={24} y2={LANE.scl[1] + 4} stroke={i % 5 ? "#15243a" : "#1d3150"} />)}
      {([LANE.sda, LANE.scl] as const).map(([hi, lo], i) => <g key={i}><line x1={PL} x2={PL + w} y1={hi} y2={hi} stroke="#15243a" /><line x1={PL} x2={PL + w} y1={lo} y2={lo} stroke="#1d3150" /><line x1={PL} x2={PL + w} y1={lo - 0.7 * (lo - hi)} y2={lo - 0.7 * (lo - hi)} stroke="#334155" strokeDasharray="3 4" /></g>)}
      <text x={6} y={(LANE.sda[0] + LANE.sda[1]) / 2 + 4} fontSize="11" fontWeight="800" fill={SC.sda}>SDA</text>
      <text x={6} y={(LANE.scl[0] + LANE.scl[1]) / 2 + 4} fontSize="11" fontWeight="800" fill={SC.scl}>SCL</text>
      <text x={PL + w - 2} y={LANE.sda[0] + 0.3 * (LANE.sda[1] - LANE.sda[0]) - 3} textAnchor="end" fontSize="7" fill="#64748b">VIH 70 %</text>
    </g>
  );
  if (!t) return <svg viewBox={`0 0 ${PW} ${PH}`} className="mcl-l31-scope" role="img" aria-label="No I2C transfer captured">{grid}<text x={PL + w / 2} y={96} textAnchor="middle" fontSize="11" fill="#94a3b8">{empty}</text></svg>;
  if (t.op === "busy") {
    const noPull = t.note.includes("no pull-up") || t.note.includes("float");
    const sclY = noPull || t.note.includes("not connected") ? LANE.scl[1] : LANE.scl[0];
    return (
      <svg viewBox={`0 0 ${PW} ${PH}`} className="mcl-l31-scope" role="img" aria-label={`Bus busy: ${t.note}`}>
        {grid}
        <path d={`M${PL} ${LANE.sda[1]} H${PL + w}`} stroke={SC.sda} strokeWidth={2} />
        <path d={`M${PL} ${sclY} H${PL + w}`} stroke={SC.scl} strokeWidth={2} />
        <text x={PL + w / 2} y={18} textAnchor="middle" fontSize="10" fontWeight="700" fill="#fca5a5">HAL_BUSY: no START condition is possible</text>
        <text x={PL + w / 2} y={PH - 8} textAnchor="middle" fontSize="9" fill="#94a3b8">{sclY === LANE.scl[1] ? "SDA and SCL both read low" : "SCL is high but SDA stays low"}</text>
      </svg>
    );
  }
  const bytes = t.items.filter(isByte);
  const pg = Math.max(0, Math.min(page, bytes.length - 1));
  const bit = 1 / t.hz;
  const lastIdx = span === 0 ? bytes.length - 1 : Math.min(bytes.length - 1, pg + span - 1);
  const endItem = t.items[t.items.length - 1];
  const startT = pg === 0 ? (t.items[0]?.t ?? t.t) : bytes[pg]!.t;
  const endT = lastIdx === bytes.length - 1 ? (endItem?.t ?? t.end) : bytes[lastIdx]!.t1;
  const w0 = startT - 0.7 * bit, w1 = endT + 0.7 * bit, wspan = w1 - w0;
  const X = (tt: number) => PL + ((Math.max(w0, Math.min(w1, tt)) - w0) / wspan) * w;
  const inWin = (tt: number) => tt >= w0 && tt <= w1;
  const tau = t.pp ? Math.min(t.tau, 8e-9) : t.tau;
  const sda = analogPath(t.sda, w0, w1, tau, X, LANE.sda[0], LANE.sda[1]);
  const scl = analogPath(t.scl, w0, w1, t.pp ? Math.min(t.tau, 8e-9) : t.tau, X, LANE.scl[0], LANE.scl[1]);
  const pxPerBit = (bit / wspan) * w;
  const rise = t.scl.find(([tt, v]) => v === 1 && inWin(tt) && inWin(tt + 1.3 * t.tau));
  return (
    <svg viewBox={`0 0 ${PW} ${PH}`} className="mcl-l31-scope" role="img" aria-label={`I2C frame #${t.id}: ${t.items.filter(isByte).length} bytes at ${fmtHz(t.hz)}`}>
      {grid}
      {t.items.filter((it) => it.k !== "byte" && inWin(it.t)).map((it, i) => (
        <g key={`c${i}`}>
          <line x1={X(it.t)} x2={X(it.t)} y1={22} y2={LANE.scl[1] + 4} stroke="#f59e0b" strokeDasharray="2 3" strokeWidth={1} />
          <text x={X(it.t)} y={PH - 16} textAnchor="middle" fontSize="9" fontWeight="800" fill="#fbbf24">{it.k}</text>
        </g>
      ))}
      {bytes.map((b, i) => {
        if (b.t1 < w0 || b.t > w1) return null;
        const ackStart = (b.samples[7]! + b.samples[8]!) / 2 + bit * 0.25;
        const x1 = X(b.t), x2 = X(ackStart), x3 = X(b.t1);
        const label = b.role === "addr" ? `0x${hex2(b.v >> 1)} ${b.v & 1 ? "R" : "W"}` : b.role === "hdr" ? `hdr ${hex2(b.v)}` : hex2(b.v);
        const fill = b.role === "addr" || b.role === "hdr" ? "#5b21b6" : b.role === "reg" ? "#92400e" : "#155e75";
        const ackBad = !b.ack && !(b.ackBy === "m" && i === bytes.length - 1);
        return (
          <g key={`b${i}`}>
            <rect x={x1 + 0.5} y={5} width={Math.max(0, x2 - x1 - 1)} height={14} rx={3} fill={fill} opacity={0.9} />
            {x2 - x1 > 22 ? <text x={(x1 + x2) / 2} y={15.5} textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#f8fafc" fontFamily="ui-monospace, Consolas, monospace">{x2 - x1 > 44 || b.role !== "addr" ? label : hex2(b.v)}</text> : null}
            <rect x={x2 + 0.5} y={5} width={Math.max(0, x3 - x2 - 1)} height={14} rx={3} fill={b.ack ? "#166534" : ackBad ? "#991b1b" : "#475569"} />
            {x3 - x2 > 8 ? <text x={(x2 + x3) / 2} y={15.5} textAnchor="middle" fontSize="8.5" fontWeight="800" fill="#f8fafc">{b.ack ? "A" : "N"}</text> : null}
            {t.pp && b.ackBy === "s" && !b.ack && inWin(b.samples[8]!) ? <rect x={X(b.samples[8]! - bit * 0.5)} y={LANE.sda[0] - 4} width={Math.max(3, pxPerBit * 0.8)} height={LANE.sda[1] - LANE.sda[0] + 8} fill="#ef444433" stroke="#ef4444" strokeDasharray="2 2" /> : null}
            {pxPerBit >= 5 ? b.samples.map((s, j) => (inWin(s) ? <circle key={j} cx={X(s)} cy={j < 8 ? ((b.v >> (7 - j)) & 1 ? LANE.sda[0] : LANE.sda[1]) : b.ack ? LANE.sda[1] : LANE.sda[0]} r={1.8} fill={j < 8 ? "#fef08a" : b.ack ? "#4ade80" : "#f87171"} /> : null)) : null}
          </g>
        );
      })}
      <path d={sda} fill="none" stroke={SC.sda} strokeWidth={1.8} strokeLinejoin="round" />
      <path d={scl} fill="none" stroke={SC.scl} strokeWidth={1.8} strokeLinejoin="round" />
      {rise && !t.pp && X(rise[0] + 1.204 * t.tau) - X(rise[0] + 0.357 * t.tau) > 6 ? (
        <g>
          <line x1={X(rise[0] + 0.357 * t.tau)} x2={X(rise[0] + 1.204 * t.tau)} y1={LANE.scl[1] + 8} y2={LANE.scl[1] + 8} stroke="#e2e8f0" strokeWidth={1} />
          <line x1={X(rise[0] + 0.357 * t.tau)} x2={X(rise[0] + 0.357 * t.tau)} y1={LANE.scl[1] + 5} y2={LANE.scl[1] + 11} stroke="#e2e8f0" />
          <line x1={X(rise[0] + 1.204 * t.tau)} x2={X(rise[0] + 1.204 * t.tau)} y1={LANE.scl[1] + 5} y2={LANE.scl[1] + 11} stroke="#e2e8f0" />
          <text x={X(rise[0] + 1.204 * t.tau) + 4} y={LANE.scl[1] + 11} fontSize="8" fill="#e2e8f0">tr {fmtT(0.8473 * t.tau)}</text>
        </g>
      ) : null}
      {[0, 5, 10].map((i) => <text key={i} x={PL + (i / 10) * w} y={PH - 4} textAnchor={i === 0 ? "start" : i === 10 ? "end" : "middle"} fontSize="8.5" fill="#94a3b8">{+(((w0 + (i / 10) * wspan) - t.t) * 1e6).toFixed(1)} µs</text>)}
    </svg>
  );
}

/* ---------------- bus monitor ---------------- */

function Frame({ s }: { s: string }) {
  const toks = s.split(" ");
  return (
    <code className="mcl-l31-frame">
      {toks.map((k, i) => {
        const prev = toks[i - 1] ?? "";
        const cls = k === "S" || k === "Sr" || k === "P" ? "k" : k === "A" ? "a" : k === "N" ? "n" : k.startsWith("0x") || k === "hdr" || ((k === "W" || k === "R") && prev.startsWith("0x")) ? "ad" : "d";
        return <span key={i} className={cls}>{k}</span>;
      })}
    </code>
  );
}

/* ---------------- lab ---------------- */

const NO_SEEN = { scan: false, temp: false, frame: false, nack: false, fast: false, recover: false, boots: false };
type Seen = typeof NO_SEEN;
interface Sticky { fw: unknown; lastId: number; scan: number[] | null; eeBusy: number; inj: number; injT: number; nack: number; probeNack: number }
const freshSticky = (fw: unknown): Sticky => ({ fw, lastId: 0, scan: null, eeBusy: 0, inj: 0, injT: -1, nack: 0, probeNack: 0 });

export default function L31({ meta }: { meta: LabMeta }) {
  const lab = useLab<P31>({ slug: meta.slug, code: DEMO, params: P31_DEFAULT, mcu: mcu31, world: world31 });
  const { mcu, params: p } = lab;
  const fw = mcu.fw;
  const f = front(mcu);
  const now = mcu.now;
  const [sel, setSel] = useState<Txn | null>(null);
  const [page, setPage] = useState(0);
  const [follow, setFollow] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [seen, setSeen] = useState<Seen>(NO_SEEN);
  const frozen = useRef<{ fw: unknown; lines: MonLine[]; txns: Txn[] } | null>(null);
  const sticky = useRef<Sticky>(freshSticky(null));
  const listRef = useRef<HTMLOListElement>(null);
  useEffect(() => { if (pending !== null && lab.code === pending) { setPending(null); lab.run(); } }, [pending, lab]);
  useEffect(() => { setSel(null); setPage(0); }, [fw]);
  useEffect(() => { if (!msg) return; const id = window.setTimeout(() => setMsg(""), 4000); return () => window.clearTimeout(id); }, [msg]);

  if (sticky.current.fw !== fw) sticky.current = freshSticky(fw);
  const st = sticky.current;
  const sc = scanResult(f);
  if (sc) st.scan = sc;
  for (const t of f.txns) {
    if (t.id <= st.lastId) continue;
    st.lastId = t.id;
    if (t.status === 1 && t.op !== "probe") st.nack++;
    if (t.status === 1 && t.op === "probe") st.probeNack++;
    if (t.status === 1 && t.op !== "probe" && t.note.startsWith("24C02 busy")) st.eeBusy++;
    if (t.note.startsWith("NACK injected")) { st.inj++; st.injT = t.t; }
  }

  const loadCode = (next: string) => { if (next === lab.code) { lab.run(); return; } lab.setCode(next); setPending(next); };
  const edit = (patch: Array<[FieldKey, string]>) => {
    let next = lab.code;
    for (const [k, v] of patch) {
      if (codeField(next, k) === null) { setMsg("This setting was not found in the code: edit MX_GPIO_Init(), MX_I2C1_Init() or the pin #defines directly."); return; }
      next = setCodeField(next, k, v);
    }
    if (next !== lab.code) loadCode(next);
  };
  const cf = (k: FieldKey) => codeField(lab.code, k);
  const clockCode = Number(cf("clock") ?? Number.NaN);
  const hzSet = f.cfg.init ? f.cfg.hz : Number.isFinite(clockCode) ? clockCode : 100000;
  const duty = f.cfg.init ? f.cfg.duty : cf("duty") === "16_9" ? 1 : 0;
  const intPull = fw ? internalPull(mcu) : cf("pull") === "PULLUP";
  const e = elec(p, intPull);
  const tm = timing({ init: true, hz: hzSet, duty, tenBit: false }, e.tau);
  const trMax = TR_MAX(hzSet);
  const finiteR = Number.isFinite(e.R);
  const trOk = finiteR && e.tr <= trMax;
  const effHz = finiteR ? 1 / tm.period : 0;

  const v = (n: string) => (fw ? fw.num(n, Number.NaN) : Number.NaN);
  const halSt = v("st"), tempC10 = v("tempC10"), boots = v("boots"), check = v("check"), nfound = v("nfound");
  const regC = tmpCelsius(f.tmp.regs[0]!);

  const tempAddr = tempAddrOf(p);
  const match = (t: Txn) => {
    switch (p.trig) {
      case "any": return true;
      case "nack": return t.status !== 0;
      default: return t.dev === p.trig || t.addr === devAddr(p, p.trig);
    }
  };
  let live: Txn | null = null;
  for (let i = f.txns.length - 1; i >= 0; i--) if (match(f.txns[i]!)) { live = f.txns[i]!; break; }
  const shown = sel ?? live;
  const recentOf = (k: DevKey) => f.txns.some((t) => t.dev === k && t.end > now - 0.06 && t.op !== "busy");
  const act = { oled: recentOf("oled"), temp: recentOf("temp"), eeprom: recentOf("eeprom") };
  const busLive = lab.running && f.txns.some((t) => t.op !== "busy" && t.end > now - 0.06);

  const paused = !follow || sel !== null;
  if (!paused || frozen.current?.fw !== fw) frozen.current = null;
  if (paused && !frozen.current) frozen.current = { fw, lines: monitor(f, 160), txns: f.txns.slice() };
  const lines = frozen.current?.lines ?? monitor(f, 160);
  const lastKey = `${lines.length}:${lines[lines.length - 1]?.key ?? ""}:${lines[lines.length - 1]?.ids.length ?? 0}`;
  useEffect(() => { const el = listRef.current; if (follow && !sel && el) el.scrollTop = el.scrollHeight; }, [lastKey, follow, sel]);
  const pick = (ln: MonLine) => {
    const pool = frozen.current?.txns ?? f.txns;
    const cands = pool.filter((t) => ln.ids.includes(t.id));
    const t = cands.find((x) => x.status === 0) ?? cands[0] ?? null;
    if (!t) { setMsg("That transfer has left the capture buffer."); return; }
    if (!frozen.current) frozen.current = { fw, lines, txns: f.txns.slice() };
    setSel(t); setPage(0);
  };

  const recent = f.txns.filter((t) => t.t > now - 0.6);
  const lastTx = f.txns[f.txns.length - 1];
  const busyNow = lastTx && lastTx.op === "busy" && lastTx.end > now - 0.3 ? lastTx : null;
  const nackRecent = recent.filter((t) => t.status === 1 && t.op !== "probe");
  const pinsOk = cf("sda") === "9" && cf("scl") === "8";

  const hints: Array<{ text: string; tone?: "info"; fix?: Array<[string, () => void]> }> = [];
  if (!fw) hints.push({ text: "Press Run to flash the firmware. Until then the configuration panel edits the code.", tone: "info" });
  if (fw && f.notReady > 0 && !f.cfg.init) hints.push({ text: `The HAL_I2C_* calls returned HAL_BUSY ${f.notReady} time${f.notReady === 1 ? "" : "s"}: HAL_I2C_Init() never ran, so I2C1 is still in reset and nothing reaches the bus. Call MX_I2C1_Init() first.` });
  if (fw && f.hang) {
    const fix: Array<[string, () => void]> = [["Power-cycle devices", () => { powerCycle(mcu); setSeen((o) => ({ ...o, recover: true })); }]];
    if (!lab.compiledCode.includes("I2C_BusRecover")) fix.push(["Load bus recovery", () => loadCode(RECOVER)]);
    hints.push({ text: "The TMP102 was reset in the middle of a read and keeps SDA low while it waits for the rest of its byte. I2C1 sees a busy bus and every call returns HAL_BUSY. Clock SCL by hand (up to 9 pulses) until SDA is released, or power-cycle the devices.", fix });
  } else if (fw && busyNow) {
    const fix: Array<[string, () => void]> = [];
    if (!finiteR) { fix.push(["Fit 4.7 kΩ pull-ups", () => lab.setParam("pullup", "4k7")]); if (cf("pull") === "NOPULL") fix.push(["Internal pull-ups", () => edit([["pull", "PULLUP"]])]); }
    if (!pinsOk) fix.push(["Use PB8 / PB9", () => edit([["scl", "8"], ["sda", "9"]])]);
    hints.push({ text: `HAL_BUSY: ${busyNow.note}.`, fix });
  }
  const notes = new Set<string>();
  for (const t of nackRecent) {
    const n = t.note;
    if (notes.has(n)) continue;
    notes.add(n);
    if (n.startsWith("10-bit")) hints.push({ text: "AddressingMode is 10-bit: the master sends the header 11110xx first, which no 7-bit device recognises, so every transfer is NACKed.", fix: [["7-bit addressing", () => edit([["addr", "7BIT"]])]] });
    else if (n.startsWith("SSD1306 is specified")) hints.push({ text: `At ${fmtHz(hzSet)} the SSD1306 (max 400 kHz) misses its address and NACKs. The TMP102 and 24C02 still answer, so only the display stops updating.`, fix: [["400 kHz", () => edit([["clock", "400000"]])]] });
    else if (n.startsWith("push-pull")) hints.push({ text: "The pins are push-pull (GPIO_MODE_AF_PP): while a slave pulls SDA low for ACK, the STM32 drives it high, so the ACK is lost and the outputs fight. I2C needs open-drain outputs.", fix: [["Open-drain", () => edit([["otype", "OD"]])]] });
    else if (n.includes("wired to PB8/PB9")) hints.push({ text: `${n}.`, fix: [["Use PB8 / PB9", () => edit([["scl", "8"], ["sda", "9"]])]] });
    else if (n.startsWith("no device answers")) {
      const a7 = t.addr;
      const want = a7 * 2;
      const known = DEVS.find((k) => devAddr(p, k) === want) ?? DEVS.find((k) => k !== "temp" && devAddr(p, k) === want);
      const re = new RegExp(`(#define\\s+\\w+\\s+)0x${hex2(want)}\\b(?!\\s*<<)`, "i");
      const unplugged = DEVS.find((k) => !p[k] && devAddr(p, k) === a7);
      if (known && re.test(lab.code)) hints.push({ text: `Address 0x${hex2(a7)} is NACKed: the code passes 0x${hex2(want)} unshifted, and the HAL uses it as the 8-bit address byte, so the bus carries 0x${hex2(want)} >> 1 = 0x${hex2(a7)}. HAL functions need the 7-bit address shifted left: (0x${hex2(want)} << 1).`, fix: [["Shift the address", () => loadCode(lab.code.replace(re, `$1(0x${hex2(want)} << 1)`))]] });
      else if (unplugged) hints.push({ text: `The ${DEV_NAME[unplugged]} (0x${hex2(a7)}) is unplugged, so nobody pulls SDA low in the 9th clock: NACK, and HAL returns HAL_ERROR.`, fix: [[`Plug in ${DEV_NAME[unplugged]}`, () => lab.setParam(unplugged, true)]] });
      else if (a7 >= 0x48 && a7 <= 0x4b && p.temp) hints.push({ text: `The code talks to 0x${hex2(a7)}, but ADD0 is tied to ${ADD0[p.tempAddr & 3]}, so the TMP102 answers at 0x${hex2(tempAddr)}. ADD0 picks one of four addresses (GND 0x48, VCC 0x49, SDA 0x4A, SCL 0x4B).`, fix: [[`ADD0 to ${ADD0[(a7 - 0x48) & 3]}`, () => lab.setParam("tempAddr", (a7 - 0x48) & 3)]] });
      else hints.push({ text: `No device answers 0x${hex2(a7)}: check the address in the code against the module (0x3C, 0x${hex2(tempAddr)}, 0x50).` });
    }
  }
  if (fw && st.eeBusy > 0) {
    const fix: Array<[string, () => void]> = lab.compiledCode === ACKPOLL ? [] : [["Load ACK polling", () => loadCode(ACKPOLL)]];
    hints.push({ text: `At boot the 24C02 NACKed ${st.eeBusy} transfer${st.eeBusy === 1 ? "" : "s"}: it was still inside its 5 ms internal write cycle, so the read-back failed (check = ${Number.isFinite(check) ? check : "?"}, boots = ${Number.isFinite(boots) ? boots : "?"}). Wait tWR = 5 ms after a write, or poll the address until it ACKs.`, fix });
  }
  if (fw && st.inj > 0 && st.injT > now - 2) hints.push({ text: "Injected NACK: the address byte was not acknowledged, HAL_I2C_Mem_Read() returned HAL_ERROR (st = 1) and the loop skipped the display update. It retries 250 ms later and succeeds.", tone: "info" });
  if (fw && finiteR && f.cfg.init && !trOk) {
    const fix: Array<[string, () => void]> = p.pullup !== "2k2" ? [["2.2 kΩ pull-ups", () => lab.setParam("pullup", "2k2")]] : p.cap > 20 ? [["Shorter wiring (20 pF)", () => lab.setParam("cap", 20)]] : [];
    hints.push({ text: `Rise time ${fmtT(e.tr)} exceeds the ${fmtT(trMax)} limit for ${hzSet <= 100000 ? "Standard" : hzSet <= 400000 ? "Fast" : "Fast-mode Plus"} mode (R ${fmtR(e.R)}, C ${Math.round(e.C * 1e12)} pF). I2C1 waits for SCL to reach VIH before it counts the high time, so SCL runs at ${fmtHz(effHz)} instead of ${fmtHz(tm.nominal)}. Lower R or less capacitance makes the edges faster.`, fix });
  }
  const problems = hints.filter((h) => h.tone !== "info");

  const tempOk = !!fw && halSt === 0 && Number.isFinite(tempC10) && Math.abs(tempC10 / 10 - regC) < 0.15;
  const fastOk = !!fw && f.cfg.init && f.cfg.hz === 400000 && trOk && tempOk;
  const flags: Seen = {
    scan: !!st.scan && [0x3c, tempAddr, 0x50].every((a) => st.scan!.includes(a)),
    temp: tempOk,
    frame: sel !== null,
    nack: st.nack > 0,
    fast: fastOk,
    recover: f.recovered > 0,
    boots: !!fw && boots >= 2 && check === boots,
  };
  useEffect(() => {
    const ks = Object.keys(flags) as Array<keyof Seen>;
    if (ks.some((k) => flags[k] && !seen[k])) setSeen((o) => { const n = { ...o }; for (const k of ks) n[k] = o[k] || flags[k]; return n; });
  });

  const shellLab = { ...lab, resetLab: () => { resetEeprom(); lab.resetLab(); setSel(null); setPage(0); setFollow(true); setPending(null); setSeen(NO_SEEN); frozen.current = null; } };
  const toggleDev = (k: DevKey) => lab.setParam(k, !p[k]);
  const statusTone = !fw ? "off" : problems.length ? "warn" : "ok";
  const selBytes = shown && shown.op !== "busy" ? shown.items.filter(isByte).length : 0;
  const perView = p.span === 0 ? selBytes : p.span;
  const maxPage = Math.max(0, selBytes - perView);
  const pg = Math.min(page, maxPage);
  const scanList = st.scan;
  const expected: Array<[number, string, boolean]> = [[0x3c, "SSD1306", p.oled], [tempAddr, "TMP102", p.temp], [0x50, "24C02", p.eeprom]];
  const extra = (scanList ?? []).filter((a) => !expected.some(([x]) => x === a));
  const custom = !VARIANTS.some((x) => x.code === lab.compiledCode);

  const disabled = (k: FieldKey) => cf(k) === null;
  const clockOpts = [100000, 400000, 1000000];
  if (Number.isFinite(clockCode) && !clockOpts.includes(clockCode)) clockOpts.push(clockCode);

  const notesData = {
    takeaways: [
      "I²C uses two open-drain lines, SDA and SCL, with pull-up resistors: devices only ever pull a line low, the resistor pulls it high.",
      "Every transfer starts with START (SDA falls while SCL is high) and ends with STOP (SDA rises while SCL is high).",
      "The first byte is the 7-bit address plus the R/W bit; the addressed device answers ACK by pulling SDA low in the 9th clock.",
      "STM32 HAL functions take the address already shifted left by one: (0x48 << 1).",
      "The pull-up value and the bus capacitance set the rise time: 1000 ns is allowed at 100 kHz, only 300 ns at 400 kHz.",
      "NACK means nobody answered: a wrong address, a missing device, or a device that is busy (an EEPROM write cycle).",
    ],
    observe: "Press Run. The first Bus Monitor line is the scan (ACK from 0x3C, 0x48 and 0x50), the OLED shows the TMP102 temperature, and the scope triggers on each TMP102 read: S 0x48 W A 00 A Sr 0x48 R A msb A lsb N P.",
    tryIt: "Move the temperature slider and watch the two data bytes change. Click a Bus Monitor line to freeze that frame in the scope. Unplug a module or move ADD0 and read the NACK.",
    measure: `Now: SCL ${fmtHz(effHz)} (set ${fmtHz(hzSet)}), rise time ${fmtT(e.tr)} (limit ${fmtT(trMax)}) with R ${fmtR(e.R)} and C ${Math.round(e.C * 1e12)} pF; ${f.acks} transfers ACKed, ${f.nacks} NACKed since Run.`,
    modify: "Switch the clock to 400 kHz, then pick 10 kΩ pull-ups and 200 pF: the rise time passes 300 ns and SCL slows down. Bring it back in spec with 2.2 kΩ.",
    runAgain: "Press Run again: the boot counter stored in the 24C02 increases, because EEPROM keeps its data through a reset. Load each bug example, read the hint and repair it.",
    challenge: "Hang the bus, then load the bus-recovery example and watch the manual SCL pulses free SDA without a power cycle. Bonus: store the minimum and maximum temperature in the EEPROM as well.",
    question: "Why can two I²C devices never damage each other, even when both try to drive the bus at the same time?",
    checks: [
      { label: "Scan the bus and find all three devices", done: seen.scan },
      { label: "Read the temperature from the TMP102", done: seen.temp },
      { label: "Decode a frame in the scope (START, address, ACK, data, STOP)", done: seen.frame },
      { label: "Cause a NACK and see the HAL error", done: seen.nack },
      { label: "Run Fast mode (400 kHz) within the rise-time limit", done: seen.fast },
      { label: "Recover a stuck bus", done: seen.recover },
      { label: "Count boots in the EEPROM (run twice)", done: seen.boots },
    ],
  };

  return (
    <LabShell meta={meta} lab={shellLab} subtitle="SDA/SCL, addressing, ACK/NACK and multiple devices."
      components={["STM32 Nucleo-F401RE, I2C1 on PB8 (SCL) and PB9 (SDA), alternate function 4, open-drain", "SSD1306 128×32 OLED (0x3C), TMP102 temperature sensor (0x48–0x4B via ADD0), 24C02 2 Kbit EEPROM (0x50)", "Pull-up resistors to 3.3 V and the bus capacitance set the RC rise time; I2C1 clock stretching follows it", "Every transfer is simulated bit by bit, including ACK/NACK, the EEPROM write cycle and a slave holding SDA low"]}>
      <div className="mcl-grid mcl-g4-grid">
        <Panel title="Interactive I²C Bus" icon="chip" className="mcl-g4-vis">
          <Scene p={p} f={f} now={now} act={act} busLive={busLive} intPull={intPull} onToggle={toggleDev} />
          <div className="mcl-l31-read">
            <div className={`mcl-l31-chip ${tempOk ? "ok" : fw && f.txns.length && halSt !== 0 ? "bad" : ""}`} title={`TMP102 register: ${regC.toFixed(4)} °C`}><span>Temperature (firmware)</span><b>{Number.isFinite(tempC10) && fw ? `${(tempC10 / 10).toFixed(1)} °C` : "–"}</b></div>
            <div className={`mcl-l31-chip ${fw && boots > 0 ? (check === boots ? "ok" : "bad") : ""}`} title={Number.isFinite(check) ? `Read back after the write: ${check}` : undefined}><span>Boot count (24C02)</span><b>{fw && Number.isFinite(boots) ? boots : "–"}</b></div>
            <div className={`mcl-l31-chip ${fw && Number.isFinite(nfound) && st.scan ? (nfound === DEVS.filter((k) => p[k]).length ? "ok" : "bad") : ""}`}><span>Devices found</span><b>{fw && Number.isFinite(nfound) ? nfound : "–"}</b></div>
            <div className={`mcl-l31-chip ${fw ? (halSt === 0 ? "ok" : Number.isFinite(halSt) && f.txns.length ? "bad" : "") : ""}`}><span>Last read status</span><b>{fw && Number.isFinite(halSt) ? HAL[halSt] ?? String(halSt) : "–"}</b></div>
          </div>
          <div className="mcl-l31-ctl">
            <label className="mcl-l31-temp"><span><Icon name="thermo" size={14} />Sensor temperature</span><input type="range" min={-40} max={125} step={0.5} value={p.tempC} aria-label="Sensor temperature" onChange={(ev) => lab.setParam("tempC", Number(ev.target.value))} /><b>{p.tempC.toFixed(1)} °C</b></label>
            <label className="mcl-l31-inline">TMP102 ADD0:<select value={p.tempAddr} aria-label="TMP102 ADD0 strap" onChange={(ev) => lab.setParam("tempAddr", Number(ev.target.value))}>{ADD0.map((n, i) => <option key={n} value={i}>{n} (0x{hex2(0x48 + i)})</option>)}</select></label>
            <div className="mcl-l31-plug">
              {DEVS.map((k) => <Toggle key={k} label={`${DEV_NAME[k]} 0x${hex2(devAddr(p, k))}`} checked={p[k]} onChange={(x) => lab.setParam(k, x)} hint={`Plug or unplug the ${DEV_NAME[k]} module`} />)}
            </div>
          </div>
        </Panel>

        <Panel title="I²C Configuration" icon="sliders" className="mcl-g4-cfg">
          <div className="mcl-l31-rows">
            <label><span>Clock</span><select value={Number.isFinite(clockCode) ? clockCode : hzSet} disabled={disabled("clock")} aria-label="I2C clock" onChange={(ev) => edit([["clock", ev.target.value]])}>{clockOpts.map((hz) => <option key={hz} value={hz}>{fmtHz(hz)}{hz === 100000 ? " · Std" : hz === 400000 ? " · Fast" : hz === 1000000 ? " · Fm+" : ""}</option>)}</select></label>
            <label><span>Address</span><select value={cf("addr") ?? "7BIT"} disabled={disabled("addr")} aria-label="Addressing mode" onChange={(ev) => edit([["addr", ev.target.value]])}><option value="7BIT">7-bit</option><option value="10BIT">10-bit</option></select></label>
            <label><span>SDA</span><select value={cf("sda") ?? "9"} disabled={disabled("sda")} aria-label="SDA pin" onChange={(ev) => edit([["sda", ev.target.value]])}><option value="9">PB9</option><option value="7">PB7</option></select></label>
            <label><span>SCL</span><select value={cf("scl") ?? "8"} disabled={disabled("scl")} aria-label="SCL pin" onChange={(ev) => edit([["scl", ev.target.value]])}><option value="8">PB8</option><option value="6">PB6</option></select></label>
            <label><span>Pull-ups</span><select value={p.pullup} aria-label="External pull-up resistors" onChange={(ev) => lab.setParam("pullup", ev.target.value as PullKey)}>{(Object.keys(PULLUPS) as PullKey[]).map((k) => <option key={k} value={k}>{PULL_LABEL[k]}</option>)}</select></label>
            <label><span>Pin mode</span><select value={cf("otype") ?? "OD"} disabled={disabled("otype")} aria-label="Output type" onChange={(ev) => edit([["otype", ev.target.value]])}><option value="OD">Open-drain</option><option value="PP">Push-pull</option></select></label>
            <label><span>Duty</span><select value={cf("duty") ?? "2"} disabled={disabled("duty") || hzSet <= 100000} aria-label="Fast mode duty cycle" onChange={(ev) => edit([["duty", ev.target.value]])}><option value="2">2:1</option><option value="16_9">16:9</option></select></label>
            <label className="mcl-l31-cap"><span>Bus C</span><input type="range" min={10} max={400} step={10} value={p.cap} aria-label="Wiring capacitance" onChange={(ev) => lab.setParam("cap", Number(ev.target.value))} /><b>{p.cap} pF</b></label>
          </div>
          <div className="mcl-l31-pullrow">
            <Toggle label="Internal pull-ups (GPIO_PULLUP)" checked={cf("pull") === "PULLUP"} onChange={(x) => edit([["pull", x ? "PULLUP" : "NOPULL"]])} hint="Weak 40 kΩ pull-ups inside the STM32, in parallel with the external resistors" />
          </div>
          <div className="mcl-l31-meters">
            <div className={`mcl-l31-meter ${!finiteR ? "bad" : trOk ? "ok" : "bad"}`}>
              <span>Rise time (30→70 %)</span>
              <i><em style={{ width: `${finiteR ? Math.min(100, (e.tr / trMax) * 100) : 100}%` }} /></i>
              <b>{finiteR ? fmtT(e.tr) : "never rises"} <small>/ {fmtT(trMax)} max</small></b>
            </div>
            <div className={`mcl-l31-meter ${finiteR && effHz >= tm.nominal * 0.9 ? "ok" : "warn"}`}>
              <span>SCL frequency</span>
              <i><em style={{ width: `${finiteR ? Math.min(100, (effHz / tm.nominal) * 100) : 0}%` }} /></i>
              <b>{finiteR ? fmtHz(effHz) : "–"} <small>/ {fmtHz(tm.nominal)} set</small></b>
            </div>
          </div>
          <div className={`mcl-l31-status ${statusTone}`}>
            <Icon name={statusTone === "ok" ? "check" : "alert"} size={16} />
            <div>
              <b>{!fw ? "I2C stopped" : !f.cfg.init ? "I2C1 not initialised" : problems.length ? "Check the bus" : "I2C1 ready"}</b>
              <span>tLOW {fmtT(tm.tL)} · tHIGH {fmtT(tm.tH)}{finiteR ? ` + ${fmtT(tm.tVih)} rise` : ""} · R {fmtR(e.R)} · C {Math.round(e.C * 1e12)} pF · sink {finiteR ? `${(e.iol * 1e3).toFixed(2)} mA` : "–"} (max 3 mA)</span>
            </div>
          </div>
          {msg ? <p className="mcl-l31-hint"><Icon name="alert" size={14} /><span>{msg}</span></p> : null}
          {lab.dirty && !pending ? <p className="mcl-l31-sub">The editor has unflashed changes: press Run to apply them.</p> : null}
        </Panel>

        <Panel title="Live SDA / SCL" icon="wave" className="mcl-g4-scope"
          tools={<>
            <label className="mcl-l31-inline"><span className="mcl-l31-lbl">Trigger:</span><select value={p.trig} aria-label="Scope trigger" onChange={(ev) => { lab.setParam("trig", ev.target.value as Trig); setPage(0); }}>{TRIGS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
            <label className="mcl-l31-inline"><span className="mcl-l31-lbl">Bytes:</span><select value={p.span} aria-label="Bytes per view" onChange={(ev) => { lab.setParam("span", Number(ev.target.value)); setPage(0); }}>{SPANS.map((s) => <option key={s} value={s}>{s === 0 ? "All" : s}</option>)}</select></label>
            <button type="button" className="mcl-l31-btn" aria-label="Previous byte" disabled={pg <= 0} onClick={() => setPage(Math.max(0, pg - 1))}>‹</button>
            <button type="button" className="mcl-l31-btn" aria-label="Next byte" disabled={pg >= maxPage} onClick={() => setPage(Math.min(maxPage, pg + 1))}>›</button>
          </>}>
          <Scope t={shown} page={pg} span={p.span} empty={fw ? `Waiting for a transfer that matches the trigger (${TRIGS.find(([k]) => k === p.trig)?.[1]}).` : "Press Run to capture I2C traffic."} />
          <p className="mcl-l31-sub">
            {shown ? <>{sel ? "Frozen" : "Triggered"} #{shown.id} at {(shown.t * 1e3).toFixed(3)} ms: {shown.op === "busy" ? "bus busy" : `${selBytes} byte${selBytes === 1 ? "" : "s"}, SCL ${fmtHz(shown.hz)}, ${fmtT(shown.end - shown.t)}`} · {shown.op === "busy" ? shown.note : (shown.status ? "NACK" : "ACK")}{sel ? <> · <button type="button" className="mcl-l31-link" onClick={() => setSel(null)}>back to live</button></> : null}</> : "Dots mark where each bit is sampled (SCL high); the dashed line is VIH."}
          </p>
        </Panel>

        <CodeEditor lab={lab} className="mcl-g4-code" languages={VARIANTS} />

        <Panel title="Bus Monitor" icon="list" className="mcl-g4-mon"
          tools={<>
            <label className="mcl-l31-inline"><input type="checkbox" checked={follow} onChange={(ev) => setFollow(ev.target.checked)} />Auto-scroll</label>
            <button type="button" className="mcl-l31-btn" onClick={() => { clearTxns(mcu); frozen.current = null; setSel(null); }}>Clear</button>
          </>}>
          <div className="mcl-l31-devs">
            <b>Detected devices:</b>
            {scanList ? expected.map(([a, n, plugged]) => <span key={a} className={scanList.includes(a) ? "ok" : plugged ? "bad" : "off"}>0x{hex2(a)} {n}{scanList.includes(a) ? "" : " · missing"}</span>) : <span className="off">{fw ? "scanning…" : "run the scan"}</span>}
            {extra.map((a) => <span key={a} className="ok">0x{hex2(a)}</span>)}
          </div>
          <div className="mcl-l31-counts">
            <span className="ok">ACK {f.acks}</span><span className={st.nack ? "bad" : ""} title="Address probes that nobody answers during a scan are expected NACKs">NACK {f.nacks}{st.probeNack ? <small> ({Math.min(st.probeNack, f.nacks)} from probes)</small> : null}</span><span className={f.busy ? "bad" : ""}>BUSY {f.busy}</span>{f.recovered ? <span className="ok">Recovered {f.recovered}</span> : null}
            <div className="mcl-l31-faultbtns">
              <button type="button" onClick={() => injectNack(mcu)} disabled={!fw || f.nackNext} title="The next address byte is not acknowledged">{f.nackNext ? "NACK armed" : "Inject NACK"}</button>
              <button type="button" onClick={() => hangBus(mcu)} disabled={!fw || !!f.hang || !p.temp} title="Reset the TMP102 mid-read: it holds SDA low">Hang bus</button>
              <button type="button" onClick={() => { const wasHung = !!f.hang; powerCycle(mcu); if (wasHung) setSeen((o) => ({ ...o, recover: true })); }} disabled={!fw} title="Remove and restore power to the three modules">Power-cycle</button>
            </div>
          </div>
          <ol className="mcl-l31-mon" ref={listRef} aria-label="Bus monitor">
            {lines.map((ln) => {
              const on = !!sel && ln.ids.includes(sel.id);
              return (
                <li key={ln.key}>
                  <button type="button" className={`${ln.tone} ${on ? "on" : ""}`} onClick={() => pick(ln)} aria-pressed={on}>
                    <time>{(ln.t * 1e3).toFixed(3)}</time>
                    <span>{ln.tone === "scan" || ln.key.startsWith("scan") ? <code className="mcl-l31-frame"><span className="d">{ln.frame}</span></code> : <Frame s={ln.frame} />}<em>{ln.text}</em></span>
                  </button>
                </li>
              );
            })}
            {!lines.length ? <li className="mcl-l31-empty">{fw ? (f.notReady ? "No bus activity: I2C1 is not initialised." : "Waiting for the first transfer…") : "Press Run to start."}</li> : null}
          </ol>
          {hints.slice(0, 3).map((h) => (
            <p key={h.text} className={`mcl-l31-hint ${h.tone ?? ""}`}><Icon name={h.tone === "info" ? "bulb" : "alert"} size={14} /><span>{h.text}</span>{h.fix?.map(([l, fn]) => <button key={l} type="button" onClick={fn}>{l}</button>)}</p>
          ))}
          <p className="mcl-l31-sub">{paused ? "Monitor paused: turn Auto-scroll back on or press back to live. " : ""}Click a line to show that frame in the scope.{custom && fw ? " Running your own version of the program." : ""}</p>
        </Panel>

        <div className="mcl-g4-notes"><LearningNotes notes={notesData} /></div>
      </div>
    </LabShell>
  );
}

function fmtR(r: number) { return !Number.isFinite(r) ? "∞" : r >= 1000 ? `${+(r / 1000).toFixed(2)} kΩ` : `${Math.round(r)} Ω`; }
