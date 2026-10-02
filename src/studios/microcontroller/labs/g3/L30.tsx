import { useEffect, useRef, useState } from "react";
import type { Mcu } from "../core/mcu";
import { useLab } from "../core/useLab";
import type { LabMeta } from "../registry";
import { CodeEditor } from "../ui/CodeEditor";
import { Breadboard, HwDefs, NucleoBoard, SvgLed, Wire } from "../ui/Hardware";
import { Icon } from "../ui/Icon";
import { Panel, Toggle } from "../ui/Panels";
import { LabShell } from "../ui/Shell";
import {
  APB2_HZ, BUG_READBIT, BURST, clearTransfers, codeCfg, codeField, cr1, DEMO, DEVICE_MAX_HZ, fmtHz, front, gravity, hex2, isWritable, mcu30, modeOf, MODE3, odrHz, outFormat,
  P30_DEFAULT, PRESCALERS, regName, rows, setCodeField, spiHz, TDIVS, TV_SO, VARIANTS, world30, type CallRec, type FieldKey, type Front, type P30, type Row, type Session,
} from "./L30sim";

const C = { vcc: "#ef4444", gnd: "#1f2937", cs: "#16a34a", sclk: "#1677ff", mosi: "#f59e0b", miso: "#8b5cf6" } as const;
const MODES = ["Mode 0 (0, 0)", "Mode 1 (0, 1)", "Mode 2 (1, 0)", "Mode 3 (1, 1)"];
const sgn = (v: number, d = 3) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(d)}`;

/* ---------------- hardware: virtual board ---------------- */

const W = 520, H = 262;
const NX = 16, NY = 214, NS = 0.64;
const headerX = (a: number) => NX + (100 + 7.2 * (a + 0.5)) * NS;
const HEADER_Y = NY - 179.2 * NS;
const MOD = { x: 318, y: 96, w: 166, h: 120 };
const pinY = (i: number) => MOD.y + 18 + i * 17;
const SIG = [
  { k: "vcc", label: "VCC", net: "3V3", color: C.vcc },
  { k: "gnd", label: "GND", net: "GND", color: C.gnd },
  { k: "cs", label: "CS", net: "PA4 (CS)", color: C.cs },
  { k: "sclk", label: "SCLK", net: "PA5 (SCK)", color: C.sclk },
  { k: "mosi", label: "MOSI", net: "PA7 (MOSI)", color: C.mosi },
  { k: "miso", label: "MISO", net: "PA6 (MISO)", color: C.miso },
] as const;

function BoardView({ p, live, csLevel, hasFw }: { p: P30; live: boolean; csLevel: number; hasFw: boolean }) {
  const [gx, gy] = gravity(p.tiltX, p.tiltY);
  const bx = 452 + gx * 12, by = 146 - gy * 12;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mcl-l30-scene" role="img" aria-label={`STM32 Nucleo-F401RE wired to a LIS3DH accelerometer over SPI. CS is ${csLevel ? "high" : "low"}.`}>
      <HwDefs id="l30" />
      <Breadboard x={6} y={8} w={508} h={246} cols={44} rows={14} />
      <g transform={`translate(${NX} ${NY}) rotate(-90)`}>
        <NucleoBoard scale={NS} id="l30" ld2={false} power chipLabel="F401RE" />
      </g>
      <text x={123} y={232} textAnchor="middle" fontSize="10" fontWeight="700" fill="#0f2547">STM32 Nucleo (F401RE)</text>
      {SIG.map((s, i) => {
        const sx = headerX(5 + i), lane = 24 + i * 9, dx = 300 - i * 5;
        let end = pinY(i);
        if (p.swap && s.k === "mosi") end = pinY(5);
        if (p.swap && s.k === "miso") end = pinY(4);
        const open = (p.csOpen && s.k === "cs") || (p.misoOpen && s.k === "miso");
        const d = open ? `M${sx} ${HEADER_Y} V${lane} H${dx} V${end - 6}` : `M${sx} ${HEADER_Y} V${lane} H${dx} V${end} H${MOD.x + 14}`;
        const active = live && (s.k === "sclk" || s.k === "mosi" || s.k === "miso" || s.k === "cs");
        return (
          <g key={s.k}>
            <Wire d={d} color={s.color} live={active && !open} width={2.2} />
            {open ? <><path d={`M${dx - 5} ${end - 2} l10 0`} stroke="#dc2626" strokeWidth={2} /><text x={dx - 8} y={end + 9} fontSize="8" fontWeight="700" fill="#dc2626" textAnchor="end">open</text><path d={`M${dx + 4} ${end} H${MOD.x + 14}`} stroke={s.color} strokeWidth={2.2} strokeLinecap="round" opacity={0.45} /></> : null}
            <circle cx={sx} cy={HEADER_Y} r={2.3} fill={s.color} stroke="#fff" strokeWidth={0.8} />
            <text x={236} y={lane - 2} fontSize="7" fontWeight="600" fill="#33496b">{s.net}</text>
          </g>
        );
      })}
      {p.swap ? <text x={296} y={pinY(4) + 9} fontSize="8" fontWeight="700" fill="#dc2626" textAnchor="end">swapped</text> : null}
      <g>
        <rect x={MOD.x + 3} y={MOD.y + 4} width={MOD.w} height={MOD.h} rx={7} fill="#00000022" />
        <rect x={MOD.x} y={MOD.y} width={MOD.w} height={MOD.h} rx={7} fill="url(#l30-pcbblue)" stroke="#0b3a8c" />
        <defs>
          <linearGradient id="l30-pcbblue" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2563eb" /><stop offset="1" stopColor="#1d4ed8" /></linearGradient>
        </defs>
        {SIG.map((s, i) => (
          <g key={s.k}>
            <rect x={MOD.x + 9} y={pinY(i) - 4.5} width={9} height={9} rx={1} fill="#1c1f24" />
            <rect x={MOD.x + 11.5} y={pinY(i) - 2} width={4} height={4} fill="#d4af37" />
            <text x={MOD.x + 24} y={pinY(i) + 3.5} fontSize="9" fontWeight="700" fill="#fff">{s.label}</text>
          </g>
        ))}
        <text x={MOD.x + 66} y={MOD.y + 17} fontSize="10" fontWeight="800" fill="#fff">SPI Accelerometer</text>
        <text x={MOD.x + 66} y={MOD.y + 28} fontSize="7.5" fill="#dbeafe">(MEMS, e.g. LIS3DH)</text>
        <rect x={MOD.x + 66} y={MOD.y + 40} width={36} height={36} rx={3} fill="#111827" stroke="#374151" />
        {Array.from({ length: 6 }, (_, k) => <g key={k}><rect x={MOD.x + 70 + k * 5} y={MOD.y + 37} width={2} height={3} fill="#cbd5e1" /><rect x={MOD.x + 70 + k * 5} y={MOD.y + 76} width={2} height={3} fill="#cbd5e1" /></g>)}
        <text x={MOD.x + 84} y={MOD.y + 61} fontSize="6.5" fontWeight="700" fill="#e5e7eb" textAnchor="middle">LIS3DH</text>
        <circle cx={452} cy={146} r={15} fill="#1e40af" stroke="#93c5fd" strokeWidth={0.8} />
        <line x1={437} x2={467} y1={146} y2={146} stroke="#93c5fd" strokeWidth={0.5} /><line x1={452} x2={452} y1={131} y2={161} stroke="#93c5fd" strokeWidth={0.5} />
        <circle cx={bx} cy={by} r={3.6} fill="#fde047" stroke="#a16207" strokeWidth={0.6}><title>{`Gravity vector: X ${gx.toFixed(2)} g, Y ${gy.toFixed(2)} g`}</title></circle>
        <g stroke="#fff" strokeWidth={1.2} fill="#fff" fontSize="8" fontWeight="700">
          <line x1={430} x2={452} y1={200} y2={200} /><path d="M452 197 l5 3 -5 3z" stroke="none" />
          <line x1={430} x2={430} y1={200} y2={180} /><path d="M427 180 l3 -5 3 5z" stroke="none" />
          <text x={459} y={203} stroke="none">X+</text><text x={421} y={176} stroke="none">Y+</text>
        </g>
        <SvgLed x={MOD.x + 150} y={MOD.y + 12} r={3} on={hasFw} color="red" id="l30" />
      </g>
    </svg>
  );
}

/* ---------------- hardware: schematic ---------------- */

function SchematicView({ p, csLevel, live, f }: { p: P30; csLevel: number; live: boolean; f: Front }) {
  const nets = [
    { a: "3V3", b: "VDD / VDD_IO", name: "3.3 V", color: C.vcc, dir: 0 },
    { a: "GND", b: "GND", name: "GND", color: C.gnd, dir: 0 },
    { a: "PA4  GPIO", b: "CS", name: `CS = ${csLevel}${csLevel ? " (idle)" : " (selected)"}`, color: C.cs, dir: 1, open: p.csOpen },
    { a: "PA5  SPI1_SCK", b: "SPC", name: "SCLK", color: C.sclk, dir: 1 },
    { a: "PA7  SPI1_MOSI", b: p.swap ? "SDO" : "SDI", name: "MOSI", color: C.mosi, dir: 1, bad: p.swap },
    { a: "PA6  SPI1_MISO", b: p.swap ? "SDI" : "SDO", name: "MISO", color: C.miso, dir: -1, open: p.misoOpen, bad: p.swap },
  ];
  const y = (i: number) => 64 + i * 30;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mcl-l30-scene" role="img" aria-label="Schematic: SPI1 on the STM32F401RE connected to the LIS3DH">
      <rect x={20} y={30} width={150} height={206} rx={8} fill="#f8fbff" stroke="#9db4d3" />
      <text x={95} y={48} textAnchor="middle" fontSize="11" fontWeight="800" fill="#0f2547">STM32F401RE</text>
      <text x={95} y={226} textAnchor="middle" fontSize="8.5" fill="#5c7190">SPI1 master · {f.cfg.init ? `${fmtHz(spiHz(f.cfg.presc))}, mode ${modeOf(f.cfg)}` : "not initialised"}</text>
      <rect x={350} y={30} width={150} height={206} rx={8} fill="#f3f7ff" stroke="#93b4ec" />
      <text x={425} y={48} textAnchor="middle" fontSize="11" fontWeight="800" fill="#0f2547">LIS3DH</text>
      <text x={425} y={226} textAnchor="middle" fontSize="8.5" fill="#5c7190">3-axis accelerometer · SPI slave</text>
      {nets.map((n, i) => (
        <g key={n.name}>
          <text x={164} y={y(i) + 3.5} textAnchor="end" fontSize="9" fontWeight="600" fill="#0f2547">{n.a}</text>
          <text x={356} y={y(i) + 3.5} fontSize="9" fontWeight="600" fill="#0f2547">{n.b}</text>
          <line x1={170} x2={350} y1={y(i)} y2={y(i)} stroke={n.color} strokeWidth={2} strokeDasharray={n.open ? "4 5" : undefined} className={live && n.dir && !n.open ? "mcl-wire-live" : ""} />
          <circle cx={170} cy={y(i)} r={2.5} fill={n.color} /><circle cx={350} cy={y(i)} r={2.5} fill={n.color} />
          {n.dir ? <path d={n.dir > 0 ? `M${262} ${y(i) - 4} l8 4 -8 4z` : `M${270} ${y(i) - 4} l-8 4 8 4z`} fill={n.color} /> : null}
          <text x={260} y={y(i) - 6} textAnchor="middle" fontSize="8.5" fontWeight="700" fill={n.bad || n.open ? "#dc2626" : n.color}>{n.name}{n.open ? " · open" : n.bad ? " · swapped" : ""}</text>
        </g>
      ))}
      <text x={260} y={20} textAnchor="middle" fontSize="9" fill="#5c7190">CS low selects SPI mode; with CS high the LIS3DH listens for I²C instead.</text>
    </svg>
  );
}

/* ---------------- waveforms ---------------- */

type Seg = [number, number, number | null];

interface Pick { s: Session; calls: CallRec[]; cs: Array<[number, number]> }
const csEdgesOf = (m: Mcu) => (m.edges.get("PA4") ?? []).map(([t, v]) => [t, v] as [number, number]);

function Waves({ m, f, s, tdiv, snap }: { m: Mcu; f: Front; s: Session | undefined; tdiv: number; snap?: Pick }) {
  const pw = 540, l = 54, r = 10, w = pw - l - r;
  const lanes = { cs: 16, sclk: 62, mosi: 108, miso: 154 }, lh = 28, bitY = 200, ph = 232;
  const span = (10 * tdiv) / 1e6;
  const calls: CallRec[] = snap ? snap.calls : s ? f.calls.filter((c) => c.sess === s.id) : [];
  const start = s ? s.cs - span * 0.05 : 0;
  const end = start + span;
  const X = (t: number) => l + ((Math.max(start, Math.min(end, t)) - start) / span) * w;
  const inWin = (t: number) => t >= start && t <= end;
  const hiY = (k: keyof typeof lanes) => lanes[k] + 3, loY = (k: keyof typeof lanes) => lanes[k] + lh - 3, midY = (k: keyof typeof lanes) => lanes[k] + lh / 2;

  const steps = (k: keyof typeof lanes, tr: Array<[number, number]>, init: number) => {
    let lv = init;
    let d = `M${l} ${lv ? hiY(k) : loY(k)}`;
    for (const [t, v] of tr) { if (t <= start) { lv = v; d = `M${l} ${lv ? hiY(k) : loY(k)}`; continue; } if (t > end) break; d += ` L${X(t).toFixed(1)} ${lv ? hiY(k) : loY(k)} L${X(t).toFixed(1)} ${v ? hiY(k) : loY(k)}`; lv = v; }
    return `${d} L${l + w} ${lv ? hiY(k) : loY(k)}`;
  };

  const csEdges = snap ? snap.cs : csEdgesOf(m);
  let csInit = 1;
  for (const [t, v] of csEdges) { if (t <= start) csInit = v; else break; }
  const sclk: Array<[number, number]> = [], mosi: Array<[number, number]> = [];
  for (const c of calls) {
    const off = c.cfg.cpha ? 0 : 1;
    for (let j = 0; j < 2 * c.nb; j++) sclk.push([c.t0 + (j + off) * c.h, c.cfg.cpol ^ ((j + 1) & 1)]);
    for (let k = 0; k < c.nb; k++) mosi.push([c.t0 + 2 * k * c.h, c.mBits[k]!]);
  }
  const c0 = calls[0];
  const segs: Seg[] = [];
  if (s && c0 && s.sel) {
    const rise = csEdges.find(([t, v]) => t > s.t && v === 1)?.[0] ?? Infinity;
    let t = s.cs, v: number | null = c0.miso0;
    for (const c of calls) for (const [pos, val] of c.sl) { const tt = c.t0 + pos * c.h; segs.push([t, tt, v]); t = tt; v = val; }
    segs.push([t, rise, v]);
  }
  const misoPath: Array<{ d: string; z: boolean }> = [];
  {
    let prevY: number | null = null;
    const all: Seg[] = [[start, segs[0]?.[0] ?? end, null], ...segs, [segs[segs.length - 1]?.[1] ?? end, end, null]];
    for (const [a, b, v] of all) {
      if (b <= start || a >= end || b <= a) continue;
      const yy = v === null ? midY("miso") : v ? hiY("miso") : loY("miso");
      const x1 = X(a), x2 = X(b);
      if (prevY !== null && prevY !== yy) misoPath.push({ d: `M${x1.toFixed(1)} ${prevY} L${x1.toFixed(1)} ${yy}`, z: v === null || prevY === midY("miso") });
      misoPath.push({ d: `M${x1.toFixed(1)} ${yy} L${x2.toFixed(1)} ${yy}`, z: v === null });
      prevY = yy;
    }
  }

  const labels: Array<{ x: number; text: string; y: number; color: string }> = [];
  const bitLabels: Array<{ x: number; text: string }> = [];
  const samples: number[] = [];
  for (const c of calls) {
    const N = c.cfg.bits, cellPx = (2 * c.h / span) * w, framePx = cellPx * N;
    for (let k = 0; k < c.nb; k++) {
      const tc = c.t0 + (2 * k + 1) * c.h;
      if (inWin(tc)) { if (cellPx >= 9) { const i = k % N; bitLabels.push({ x: X(tc), text: String(c.cfg.lsb ? i : N - 1 - i) }); } if (cellPx >= 6) samples.push(X(tc)); }
    }
    if (framePx >= 26) c.tx.forEach((wv, i) => {
      const tc = c.t0 + (2 * i * N + N) * c.h;
      if (!inWin(tc)) return;
      const dig = N === 16 ? 4 : 2;
      labels.push({ x: X(tc), y: lanes.mosi - 2, text: `0x${wv.toString(16).toUpperCase().padStart(dig, "0")}`, color: "#b45309" });
      labels.push({ x: X(tc), y: lanes.miso - 2, text: `0x${(c.rx[i] ?? 0).toString(16).toUpperCase().padStart(dig, "0")}`, color: "#6d28d9" });
    });
  }
  const divs = Array.from({ length: 11 }, (_, i) => i);
  const rel = (i: number) => (start - (s?.cs ?? start)) * 1e6 + i * tdiv;
  const fmtUs = (v: number) => `${+v.toFixed(tdiv < 1 ? 2 : 1)}`;
  const clipped = calls.some((c) => c.t0 + 2 * c.nb * c.h > end);

  return (
    <svg viewBox={`0 0 ${pw} ${ph}`} className="mcl-l30-waves" role="img" aria-label={s ? `SPI transaction ${s.id}: ${s.tx.length} frames at ${fmtHz(s.hz)}` : "No SPI traffic yet"}>
      {divs.map((i) => <line key={i} x1={l + (i / 10) * w} x2={l + (i / 10) * w} y1={8} y2={bitY - 10} stroke={i % 5 ? "#f1f5fa" : "#e3eaf3"} />)}
      {samples.map((x, i) => <line key={i} x1={x} x2={x} y1={lanes.sclk} y2={lanes.miso + lh} stroke="#94a3b8" strokeWidth={0.6} strokeDasharray="2 3" />)}
      {(["cs", "sclk", "mosi", "miso"] as const).map((k) => (
        <g key={k}>
          <text x={6} y={midY(k) + 4} fontSize="11" fontWeight="800" fill="#0f2547">{k.toUpperCase()}</text>
          <line x1={l} x2={l + w} y1={loY(k)} y2={loY(k)} stroke="#eef2f7" />
        </g>
      ))}
      <path d={steps("cs", csEdges, csInit)} fill="none" stroke={C.cs} strokeWidth={2} />
      <path d={steps("sclk", sclk, c0?.cfg.cpol ?? f.cfg.cpol)} fill="none" stroke={C.sclk} strokeWidth={1.8} />
      <path d={steps("mosi", mosi, c0?.mosi0 ?? 0)} fill="none" stroke={C.mosi} strokeWidth={1.8} />
      {misoPath.map((pth, i) => <path key={i} d={pth.d} fill="none" stroke={pth.z ? "#a8a3c7" : C.miso} strokeWidth={pth.z ? 1.2 : 1.8} strokeDasharray={pth.z ? "4 3" : undefined} />)}
      {labels.map((lb, i) => <text key={i} x={lb.x} y={lb.y} textAnchor="middle" fontSize="8.5" fontWeight="700" fill={lb.color} fontFamily="ui-monospace, Consolas, monospace">{lb.text}</text>)}
      <text x={6} y={bitY + 4} fontSize="10" fontWeight="700" fill="#33496b">Bit:</text>
      {bitLabels.map((b, i) => <text key={i} x={b.x} y={bitY + 4} textAnchor="middle" fontSize="9.5" fill="#0f2547">{b.text}</text>)}
      {[0, 5, 10].map((i) => <text key={i} x={l + (i / 10) * w} y={ph - 6} textAnchor={i === 0 ? "start" : i === 10 ? "end" : "middle"} fontSize="9" fill="#64748b">{fmtUs(rel(i))} µs</text>)}
      {clipped ? <text x={l + w} y={bitY - 14} textAnchor="end" fontSize="8.5" fill="#b45309">continues beyond the window: use Fit</text> : null}
      {!s ? <text x={l + w / 2} y={100} textAnchor="middle" fontSize="11" fill="#94a3b8">No SPI transfer yet: press Run.</text> : null}
    </svg>
  );
}

/* ---------------- lab ---------------- */

type LTab = "learn" | "tasks" | "ref";
const NO_SEEN = { protocol: false, mode: false, sensor: false, timing: false, regs: false, problem: false, fixed: false };
const doneKey = (slug: string) => `mcu.lab.done.${slug}`;

export default function L30({ meta }: { meta: LabMeta }) {
  const lab = useLab<P30>({ slug: meta.slug, code: DEMO, params: P30_DEFAULT, mcu: mcu30, world: world30 });
  const { mcu, params: p } = lab;
  const fw = mcu.fw;
  const f = front(mcu);
  const [ltab, setLtab] = useState<LTab>("learn");
  const [sel, setSel] = useState<Pick | null>(null);
  const frozen = useRef<{ fw: unknown; rows: Row[]; sessions: Session[] } | null>(null);
  const [adv, setAdv] = useState(false);
  const [follow, setFollow] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState(() => { try { return localStorage.getItem(doneKey(meta.slug)) === "1"; } catch { return false; } });
  const tableRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (pending !== null && lab.code === pending) { setPending(null); lab.run(); } }, [pending, lab]);
  useEffect(() => { setSel(null); }, [fw]);
  useEffect(() => { if (!msg) return; const id = window.setTimeout(() => setMsg(""), 4000); return () => window.clearTimeout(id); }, [msg]);

  const cc = codeCfg(lab.code);
  const cfg = f.cfg.init ? f.cfg : null;
  const mode = cfg ? modeOf(cfg) : cc.mode ?? 0;
  const presc = cfg ? cfg.presc : cc.presc ?? 64;
  const bits = cfg ? cfg.bits : cc.bits ?? 8;
  const lsb = cfg ? cfg.lsb : cc.lsb ?? false;
  const csLow = cc.csLow ?? true;
  const hz = spiHz(presc);
  const now = mcu.now;
  const live = lab.running && !!fw && f.lastAct > now - 0.05;
  const csLevel = mcu.isFloating("PA4") ? 1 : mcu.level("PA4");

  const edit = (patch: Array<[FieldKey, string]>) => {
    let next = lab.code;
    for (const [k, v] of patch) {
      if (codeField(next, k) === null) { setMsg("This setting was not found in the code: edit MX_SPI1_Init() or the CS #defines directly."); return; }
      next = setCodeField(next, k, v);
    }
    if (next === lab.code) return;
    lab.setCode(next);
    setPending(next);
  };
  const setMode = (md: number) => edit([["cpol", md & 2 ? "HIGH" : "LOW"], ["cpha", md & 1 ? "2EDGE" : "1EDGE"]]);

  const paused = !follow || sel !== null;
  if (!paused || frozen.current?.fw !== fw) frozen.current = null;
  if (paused && !frozen.current) frozen.current = { fw, rows: rows(f, 240), sessions: f.sessions.slice() };
  const all = frozen.current?.rows ?? rows(f, 240);
  const latest = f.sessions[f.sessions.length - 1];
  const shownSess = sel?.s ?? latest;
  const pick = (id: number) => {
    const s = (frozen.current?.sessions ?? f.sessions).find((x) => x.id === id);
    setSel(s ? { s, calls: f.calls.filter((c) => c.sess === id), cs: csEdgesOf(mcu) } : null);
  };
  const lastKey = `${all.length}:${all[all.length - 1]?.key ?? ""}`;
  useEffect(() => { const el = tableRef.current; if (follow && el) el.scrollTop = el.scrollHeight; }, [lastKey, follow]);

  const v = (n: string) => (fw ? fw.num(n, Number.NaN) : Number.NaN);
  const id = v("id"), ctrl = v("ctrl");
  const ax = v("accX"), ay = v("accY"), az = v("accZ");
  const fmt = outFormat(f.regs[0x20]!, f.regs[0x23]!);
  const g = (raw: number) => (Number.isFinite(raw) ? sgn((raw * fmt.mg) / 1000) : "–");
  const [tx, ty, tz] = gravity(p.tiltX, p.tiltY);

  const recent = f.sessions.slice(-12);
  const r8 = recent.filter((s) => s.bits === 8);
  const anySel = recent.some((s) => s.sel);
  const cmdBad = r8.find((s) => s.sel && s.dev[0] !== undefined && s.dev[0] !== s.tx[0]);
  const readBad = r8.find((s) => s.sel && s.dev[0] === s.tx[0] && ((s.tx[0] ?? 0) & 0x80) && s.rx.slice(1).some((x, i) => s.out[i] !== undefined && s.out[i] !== x));
  const roWrite = r8.find((s) => s.sel && s.dev[0] === s.tx[0] && s.tx[0] !== undefined && !(s.tx[0] & 0x80) && !isWritable(s.tx[0] & 0x3f));
  const powerDown = !!fw && f.cfg.init && anySel && !odrHz(f.regs[0x20]!) && r8.some((s) => s.sel && (s.tx[0]! & 0x80) && ((s.tx[0]! & 0x3f) >= 0x28));
  const tooFast = hz > DEVICE_MAX_HZ;
  const axisReads = r8.filter((s) => { const c = s.tx[0] ?? 0, a = c & 0x3f; return (c & 0x80) !== 0 && a >= 0x28 && a <= 0x2d; });
  const axisBad = !!fw && axisReads.some((s) => !s.sel || s.rx.slice(1).some((x, i) => s.out[i] !== x));
  const axisCls = `mcl-l30-chip${axisBad ? " bad" : ""}`;

  const hints: Array<{ text: string; fix?: [string, () => void] }> = [];
  if (!fw) hints.push({ text: "Press Run to flash the firmware. Until then the configuration panel edits the code." });
  if (fw && f.busy > 0 && !f.cfg.init) hints.push({ text: `HAL_SPI_TransmitReceive() returned HAL_BUSY ${f.busy} time${f.busy === 1 ? "" : "s"}: HAL_SPI_Init() never ran, so SPI1 is still in reset and nothing is clocked out. Call MX_SPI1_Init() before the first transfer.` });
  if (fw && p.csOpen) hints.push({ text: "The CS wire is open. The LIS3DH has a pull-up on CS, so it stays high and the sensor listens for I²C: every SPI byte is ignored and MISO floats (0xFF).", fix: ["Reconnect CS", () => lab.setParam("csOpen", false)] });
  else if (fw && recent.length && !anySel) {
    if (cc.csLow === false) hints.push({ text: "CS goes high during each transfer (CS_ACTIVE = GPIO_PIN_SET) and low in between. The LIS3DH chip select is active low, so it is never selected while clocks run: MISO floats and reads 0xFF.", fix: ["Make CS active low", () => edit([["csActive", "RESET"], ["csIdle", "SET"]])] });
    else hints.push({ text: "PA4 never goes low while the clock runs, so the LIS3DH is never selected. Drive CS low before HAL_SPI_TransmitReceive() and high afterwards (and configure PA4 as an output)." });
  }
  if (fw && p.swap) hints.push({ text: "MOSI and MISO are swapped: the master drives the sensor's SDO pin and the sensor's SDI floats high, so it sees 0xFF commands and nothing comes back.", fix: ["Fix wiring", () => lab.setParam("swap", false)] });
  if (fw && p.misoOpen && !p.swap) hints.push({ text: "The MISO wire is open: commands and writes still reach the LIS3DH, but every byte read back is 0xFF (floating input).", fix: ["Reconnect MISO", () => lab.setParam("misoOpen", false)] });
  if (fw && bits === 16 && f.cfg.init) hints.push({ text: "16-bit frames: the HAL reads txData as uint16_t, so txData[1]:txData[0] leave as one word, high byte first. The LIS3DH receives 0x00 as the command (write to reserved register 0x00) and the real command as data.", fix: ["8-bit frames", () => edit([["size", "8BIT"]])] });
  else if (fw && cmdBad && !p.swap) {
    const saw = `0x${hex2(cmdBad.dev[0]!)}`, sent = `0x${hex2(cmdBad.tx[0]!)}`;
    if (lsb) hints.push({ text: `LSB first: the master sends ${sent} bit-reversed and the LIS3DH (always MSB first) reads ${saw}.`, fix: ["MSB first", () => edit([["first", "MSB"]])] });
    else if (mode === 1) hints.push({ text: `Mode 1 (CPOL 0, CPHA 1): the master changes MOSI on the rising edge, the same edge on which the LIS3DH samples, so the sensor reads every bit one clock late: ${sent} arrived as ${saw}.`, fix: ["Use mode 0", () => setMode(0)] });
    else hints.push({ text: `The LIS3DH received ${saw} instead of ${sent}. Check the SPI mode and bit order.`, fix: ["Use mode 0", () => setMode(0)] });
  } else if (fw && readBad && !p.misoOpen && !p.swap) {
    const got = readBad.rx[1]!, drove = readBad.out[0];
    const pair = drove !== undefined && drove !== null ? ` (sensor sent 0x${hex2(drove)}, master read 0x${hex2(got)})` : "";
    if (tooFast) hints.push({ text: `SCLK ${fmtHz(hz)} is above the LIS3DH limit of 10 MHz. SDO needs up to ${TV_SO * 1e9} ns after a falling edge, but the master samples ${(1e9 / (2 * hz)).toFixed(1)} ns later and reads the previous bit${pair}.`, fix: ["Prescaler /16 (5.25 MHz)", () => edit([["presc", "16"]])] });
    else if (mode === 2) hints.push({ text: `Mode 2 (CPOL 1, CPHA 0): the master samples MISO on the falling edge, exactly when the LIS3DH shifts out its next bit, so every byte read is shifted right by one${pair}. The LIS3DH supports modes 0 and 3.`, fix: ["Use mode 3", () => setMode(3)] });
    else hints.push({ text: `Read data does not match what the sensor sent${pair}.` });
  }
  if (fw && roWrite) hints.push({
    text: `The first byte 0x${hex2(roWrite.tx[0]!)} has bit 7 clear, so this is a write to read-only ${regName(roWrite.tx[0]! & 0x3f)}: SDO stays high-impedance and you read 0xFF. Bit 7 = 1 selects a read (reg | 0x80).`,
    fix: lab.code.includes("txData[0] = reg;") ? ["Add the read bit", () => { const next = lab.code.replace("txData[0] = reg;", "txData[0] = reg | 0x80;"); lab.setCode(next); setPending(next); }] : undefined,
  });
  if (powerDown && !roWrite) hints.push({ text: `CTRL_REG1 = 0x${hex2(f.regs[0x20]!)}: ODR = 0 puts the LIS3DH in power-down, so OUT_X/Y/Z never update. Write 0x57 (100 Hz, X/Y/Z on).` });

  const healthy = !!fw && !!latest && latest.sel && hints.length === 0 && id === 0x33;
  const [seen, setSeen] = useState(NO_SEEN);
  const flags = {
    protocol: sel !== null || p.tdiv !== P30_DEFAULT.tdiv,
    mode: !!fw && f.cfg.init && modeOf(f.cfg) === 3 && id === 0x33,
    sensor: healthy && (Math.abs(p.tiltX) >= 20 || Math.abs(p.tiltY) >= 20),
    timing: sel !== null,
    regs: !!fw && ctrl === 0x57,
    problem: !!fw && hints.length > 0,
    fixed: seen.problem && healthy,
  };
  useEffect(() => {
    if ((Object.keys(flags) as Array<keyof typeof flags>).some((k) => flags[k] && !seen[k]))
      setSeen((o) => ({ protocol: o.protocol || flags.protocol, mode: o.mode || flags.mode, sensor: o.sensor || flags.sensor, timing: o.timing || flags.timing, regs: o.regs || flags.regs, problem: o.problem || flags.problem, fixed: o.fixed || flags.fixed }));
  });
  const objectives: Array<[string, boolean]> = [
    ["Understand SPI protocol and signal lines", seen.protocol],
    ["Configure SPI mode (CPOL/CPHA)", seen.mode],
    ["Communicate with a sensor (e.g., LIS3DH)", seen.sensor],
    ["Interpret SPI timing waveforms", seen.timing],
    ["Read and write device registers", seen.regs],
    ["Troubleshoot common SPI issues", seen.fixed],
  ];
  const markDone = (d: boolean) => { setDone(d); try { if (d) localStorage.setItem(doneKey(meta.slug), "1"); else localStorage.removeItem(doneKey(meta.slug)); } catch { /* storage unavailable */ } };
  const shellLab = { ...lab, resetLab: () => { lab.resetLab(); setLtab("learn"); setSel(null); setAdv(false); setFollow(true); setPending(null); setSeen(NO_SEEN); } };

  const fit = () => {
    const s = shownSess;
    if (!s) return;
    const dur = (s.end - s.cs) * 1e6 * 1.1;
    lab.setParam("tdiv", TDIVS.find((d) => d * 10 >= dur) ?? TDIVS[TDIVS.length - 1]!);
  };
  const byteUs = (8 / hz) * 1e6;
  const custom = !VARIANTS.some((x) => x.code === lab.compiledCode);
  const disabled = (k: FieldKey) => codeField(lab.code, k) === null;
  const statusTone = !fw ? "off" : hints.length ? "warn" : "ok";

  return (
    <LabShell meta={meta} lab={shellLab} subtitle="Learn how to use the SPI (Serial Peripheral Interface) protocol to communicate between a microcontroller and peripherals such as sensors, displays, or memory devices."
      components={["STM32 Nucleo-F401RE, SPI1 on PA5 (SCK), PA6 (MISO), PA7 (MOSI); PA4 as software chip select", "LIS3DH 3-axis MEMS accelerometer breakout (3.3 V, SPI mode 0/3, up to 10 MHz)", "SPI1 kernel clock = APB2 = 84 MHz; SCLK = 84 MHz / prescaler", "The transfer is simulated bit by bit, including the LIS3DH 50 ns output delay"]}>
      <div className="mcl-grid mcl-l30-grid">
        <Panel title="Hardware Simulation" icon="chip" className="mcl-l30-hw"
          tools={<div className="mcl-l30-seg" role="radiogroup" aria-label="Hardware view">{([["board", "Virtual Board"], ["schem", "Schematic"]] as const).map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={p.view === k} className={p.view === k ? "on" : ""} onClick={() => lab.setParam("view", k)}>{l}</button>)}</div>}>
          {p.view === "board" ? <BoardView p={p} live={live} csLevel={csLevel} hasFw={!!fw} /> : <SchematicView p={p} csLevel={csLevel} live={live} f={f} />}
          <div className="mcl-l30-read">
            <div className={`mcl-l30-chip ${id === 0x33 ? "ok" : Number.isFinite(id) && f.sessions.length ? "bad" : ""}`}><span>WHO_AM_I</span><b>{Number.isFinite(id) ? `0x${hex2(id)}` : "–"}</b></div>
            <div className={`mcl-l30-chip ${ctrl === 0x57 ? "ok" : ""}`}><span>CTRL_REG1</span><b>{Number.isFinite(ctrl) ? `0x${hex2(ctrl)}` : "–"}</b></div>
            <div className={axisCls} title={axisBad ? "The latest axis reads do not match what the LIS3DH sent" : undefined}><span>X</span><b>{g(ax)} g</b></div>
            <div className={axisCls}><span>Y</span><b>{g(ay)} g</b></div>
            <div className={axisCls}><span>Z</span><b>{g(az)} g</b></div>
          </div>
          <div className="mcl-l30-tilt">
            <label><span>Tilt X</span><input type="range" min={-90} max={90} step={5} value={p.tiltX} aria-label="Tilt X" onChange={(e) => lab.setParam("tiltX", Number(e.target.value))} /><b>{p.tiltX}°</b></label>
            <label><span>Tilt Y</span><input type="range" min={-90} max={90} step={5} value={p.tiltY} aria-label="Tilt Y" onChange={(e) => lab.setParam("tiltY", Number(e.target.value))} /><b>{p.tiltY}°</b></label>
            <button type="button" onClick={() => { lab.setParam("tiltX", 0); lab.setParam("tiltY", 0); }}>Level</button>
            <small>Sensor truth: {sgn(tx, 2)} / {sgn(ty, 2)} / {sgn(tz, 2)} g</small>
          </div>
        </Panel>

        <Panel title="SPI Waveforms (Live)" icon="wave" className="mcl-l30-wave"
          tools={<>
            <label className="mcl-l30-inline">Time/div:<select value={p.tdiv} aria-label="Time per division" onChange={(e) => lab.setParam("tdiv", Number(e.target.value))}>{TDIVS.map((d) => <option key={d} value={d}>{d} µs</option>)}</select></label>
            <button type="button" className="mcl-l30-btn" onClick={fit} disabled={!shownSess}>Fit</button>
          </>}>
          <Waves m={mcu} f={f} s={shownSess} tdiv={p.tdiv} snap={sel ?? undefined} />
          <p className="mcl-l30-sub">
            {shownSess ? <>{sel !== null ? "Selected" : "Latest"} transaction #{shownSess.id}: {shownSess.tx.length} × {shownSess.bits}-bit at {fmtHz(shownSess.hz)} · CS low for {((shownSess.end - shownSess.cs) * 1e6).toFixed(1)} µs{sel !== null ? <> · <button type="button" className="mcl-l30-link" onClick={() => setSel(null)}>back to live</button></> : null}</> : "Dashed MISO = high-impedance (the sensor is not driving it)."}
          </p>
        </Panel>

        <Panel title="Learning" icon="book" className="mcl-l30-notes">
          <div className="mcl-tabs mcl-l30-tabs" role="tablist">
            {([["learn", "Learning"], ["tasks", "Tasks"], ["ref", "Reference"]] as const).map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={ltab === k} className={ltab === k ? "on" : ""} onClick={() => setLtab(k)}>{l}</button>)}
          </div>
          {ltab === "learn" ? (
            <div className="mcl-l30-learn">
              <h3><Icon name="book" size={15} />About This Lab</h3>
              <p>SPI (Serial Peripheral Interface) is a high-speed, full-duplex communication protocol commonly used to interface microcontrollers with peripherals such as sensors, displays, and memory devices. In this lab, you will learn how to configure SPI, understand timing, and exchange data with a realistic peripheral device.</p>
              <h3><Icon name="target" size={15} />Learning Objectives</h3>
              <ul className="mcl-l30-obj">{objectives.map(([t, d]) => <li key={t} className={d ? "done" : ""}><Icon name={d ? "check" : "target"} size={13} />{t}</li>)}</ul>
              <h3><Icon name="bulb" size={15} />Key Points</h3>
              <ul className="mcl-l30-ul">
                <li>SPI uses four main signals: MOSI, MISO, SCLK, CS.</li>
                <li>CPOL and CPHA define the clock polarity and sampling edge.</li>
                <li>Data is typically transferred MSB first.</li>
                <li>Multiple devices can share the same SPI bus using separate CS lines.</li>
                <li>SPI is high-speed and commonly used for sensors, displays, and flash memory.</li>
              </ul>
              <h3><Icon name="play" size={15} />Next Steps</h3>
              <p>{seen.sensor ? "Load the burst-read example: one transaction with auto-increment replaces six, and the CS-low time shrinks." : "Tilt the board and watch the X, Y and Z acceleration values update in real time from the SPI reads."}</p>
              <button type="button" className={`mcl-l30-done ${done ? "on" : ""}`} onClick={() => markDone(!done)}><Icon name="check" size={15} />{done ? "Lab 30 completed (click to undo)" : "Mark Lab 30 as Complete"}</button>
            </div>
          ) : null}
          {ltab === "tasks" ? (
            <div className="mcl-l30-learn">
              <ol className="mcl-steps">
                {([
                  ["Observe", "Run the example: the first transaction sends 0x8F (read WHO_AM_I) and the LIS3DH answers 0x33 in the second byte while MOSI sends a dummy 0x00."],
                  ["Try", "Select row 1 or 2 in Data Transfer and use Time/div to see all 16 clocks; then switch to Mode 3 and compare where SCLK idles."],
                  ["Measure", `Now: ${fmtHz(hz)} SCLK, ${byteUs.toFixed(2)} µs per byte, ${f.transfers} transfers, ${f.bytes} bytes since Run.`],
                  ["Modify", "Pick Mode 1 or a 21 MHz clock in SPI Configuration: read the hint, find the corrupted bits in the waveform, then fix it."],
                  ["Run Again", "Load the burst-read and bug examples; tilt the board and compare the firmware values with the sensor truth."],
                ] as const).map(([k, t]) => <li key={k}><b>{k}</b><span>{t}</span></li>)}
              </ol>
              <ul className="mcl-checks">
                {([["Read WHO_AM_I = 0x33", id === 0x33 || seen.regs], ["Wrote and read back CTRL_REG1", seen.regs], ["Ran SPI mode 3 successfully", seen.mode], ["Inspected a transaction in the waveform", seen.timing], ["Tilted the board and read new values", seen.sensor], ["Diagnosed and fixed a bus problem", seen.fixed]] as const)
                  .map(([t, d]) => <li key={t} className={d ? "done" : ""}><Icon name={d ? "check" : "target"} size={14} />{t}</li>)}
              </ul>
              {custom && fw ? <p className="mcl-l30-sub">Running your own version of the program.</p> : null}
              <p className="mcl-challenge"><b>Challenge:</b> Switch the sensor to high-resolution mode (CTRL_REG4 bit HR = 1, then shift by 4 instead of 6) and use the burst read so X, Y and Z come from the same sample.</p>
            </div>
          ) : null}
          {ltab === "ref" ? (
            <div className="mcl-l30-learn">
              <h4>SPI modes</h4>
              <table className="mcl-l22-table mcl-l30-ref">
                <thead><tr><th>Mode</th><th>CPOL</th><th>CPHA</th><th>Sample</th><th>LIS3DH</th></tr></thead>
                <tbody>{[0, 1, 2, 3].map((md) => <tr key={md} className={md === mode ? "on" : ""}><td>{md}</td><td>{md >> 1}</td><td>{md & 1}</td><td>{md === 0 || md === 3 ? "rising" : "falling"}</td><td>{md === 0 || md === 3 ? "yes" : "no"}</td></tr>)}</tbody>
              </table>
              <h4>Command byte</h4>
              <p className="mcl-l30-mono">bit 7 RW (1 = read) · bit 6 MS (1 = auto-increment) · bits 5:0 address</p>
              <h4>LIS3DH registers (live)</h4>
              <table className="mcl-l22-table mcl-l30-ref mono">
                <thead><tr><th>Addr</th><th>Name</th><th>Value</th><th>Access</th></tr></thead>
                <tbody>{[0x0f, 0x20, 0x23, 0x27, 0x28, 0x29, 0x2a, 0x2b, 0x2c, 0x2d].map((a) => <tr key={a}><td>0x{hex2(a)}</td><td>{regName(a)}</td><td>0x{hex2(f.regs[a]!)}</td><td>{isWritable(a) ? "R/W" : "R"}</td></tr>)}</tbody>
              </table>
              <dl className="mcl-l30-fx">
                <div><dt>SCLK</dt><dd>{APB2_HZ / 1e6} MHz / {presc} = {fmtHz(hz)}</dd></div>
                <div><dt>Byte</dt><dd>8 / f = {byteUs.toFixed(2)} µs</dd></div>
                <div><dt>SPI1 CR1</dt><dd>0x{(cr1(f.cfg) & 0xffff).toString(16).toUpperCase().padStart(4, "0")}{f.cfg.init ? "" : " (not initialised)"}</dd></div>
                <div><dt>Output</dt><dd>{fmt.name}, ±{fmt.range} g, {fmt.mg} mg/digit · ODR {odrHz(f.regs[0x20]!)} Hz</dd></div>
              </dl>
            </div>
          ) : null}
        </Panel>

        <Panel title="SPI Configuration" icon="sliders" className="mcl-l30-cfg">
          <div className="mcl-l30-form">
            <label className="mcl-l30-field"><span>SPI Mode (CPOL/CPHA)</span>
              <select value={cc.mode ?? mode} disabled={disabled("cpol") || disabled("cpha")} aria-label="SPI mode" onChange={(e) => setMode(Number(e.target.value))}>{MODES.map((t, i) => <option key={t} value={i}>{t}</option>)}</select></label>
            <label className="mcl-l30-field"><span>Clock Speed</span>
              <select value={cc.presc ?? presc} disabled={disabled("presc")} aria-label="Clock speed" onChange={(e) => edit([["presc", e.target.value]])}>{PRESCALERS.map((d) => <option key={d} value={d}>{fmtHz(spiHz(d))} (/{d}){spiHz(d) > DEVICE_MAX_HZ ? " · above 10 MHz" : ""}</option>)}</select></label>
            <label className="mcl-l30-field"><span>Data Frame Size</span>
              <select value={cc.bits ?? bits} disabled={disabled("size")} aria-label="Data frame size" onChange={(e) => edit([["size", e.target.value === "16" ? "16BIT" : "8BIT"]])}><option value={8}>8 bits</option><option value={16}>16 bits</option></select></label>
            <label className="mcl-l30-field"><span>Chip Select (CS)</span>
              <select value={csLow ? "low" : "high"} disabled={disabled("csActive") || disabled("csIdle")} aria-label="Chip select polarity" onChange={(e) => edit(e.target.value === "low" ? [["csActive", "RESET"], ["csIdle", "SET"]] : [["csActive", "SET"], ["csIdle", "RESET"]])}><option value="low">Active Low</option><option value="high">Active High</option></select></label>
            <button type="button" className={`mcl-l30-adv ${adv ? "on" : ""}`} aria-expanded={adv} onClick={() => setAdv(!adv)}><Icon name="sliders" size={14} />Advanced Settings</button>
          </div>
          {adv ? (
            <div className="mcl-l30-advbox">
              <label className="mcl-l30-field"><span>First Bit</span>
                <select value={(cc.lsb ?? lsb) ? "LSB" : "MSB"} disabled={disabled("first")} aria-label="First bit" onChange={(e) => edit([["first", e.target.value]])}><option value="MSB">MSB first</option><option value="LSB">LSB first</option></select></label>
              <dl className="mcl-l30-fx">
                <div><dt>NSS</dt><dd>Software: PA4 driven as a GPIO</dd></div>
                <div><dt>Direction</dt><dd>2 lines, full duplex</dd></div>
                <div><dt>Kernel clock</dt><dd>APB2 = 84 MHz</dd></div>
              </dl>
            </div>
          ) : null}
          <div className="mcl-l30-row">
            <div className={`mcl-l30-status ${statusTone}`}>
              <Icon name={statusTone === "ok" ? "check" : "alert"} size={16} />
              <div>
                <b>{!fw ? "SPI stopped" : !f.cfg.init ? "SPI1 not initialised" : hints.length ? "Check the bus" : "SPI1 ready"}</b>
                <span>Mode {mode} (CPOL {mode >> 1}, CPHA {mode & 1}) · {fmtHz(hz)} · {bits}-bit · {lsb ? "LSB" : "MSB"} first · CS active {csLow ? "low" : "high"} · {byteUs.toFixed(2)} µs per byte</span>
              </div>
            </div>
            <div className="mcl-g2-faults mcl-l30-faults">
              <b><Icon name="bug" size={14} />Fault injection</b>
              <Toggle label="CS wire open" checked={p.csOpen} onChange={(x) => lab.setParam("csOpen", x)} hint="The LIS3DH CS pull-up keeps it deselected (I²C mode)" />
              <Toggle label="MISO wire open" checked={p.misoOpen} onChange={(x) => lab.setParam("misoOpen", x)} hint="Reads return 0xFF; writes still work" />
              <Toggle label="MOSI / MISO swapped" checked={p.swap} onChange={(x) => lab.setParam("swap", x)} hint="A classic wiring mistake" />
            </div>
          </div>
          {msg ? <p className="mcl-g2-hint"><Icon name="alert" size={14} /><span>{msg}</span></p> : null}
          {lab.dirty && !pending ? <p className="mcl-l30-sub">The editor has unflashed changes: press Run to apply them.</p> : null}
        </Panel>

        <CodeEditor lab={lab} className="mcl-l30-code" languages={VARIANTS} />

        <Panel title="Data Transfer" icon="table" className="mcl-l30-data"
          tools={<>
            <label className="mcl-l30-inline"><input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} />Auto-scroll</label>
            <button type="button" className="mcl-l30-btn" onClick={() => { clearTransfers(mcu); frozen.current = null; setSel(null); }}>Clear</button>
          </>}>
          <div className="mcl-l30-tablewrap" ref={tableRef}>
            <table className="mcl-l22-table mcl-l30-table">
              <thead><tr><th>#</th><th>Time (ms)</th><th>Direction</th><th>Data (Hex)</th><th>Description</th></tr></thead>
              <tbody>
                {all.map((rw, i) => (
                  <tr key={rw.key} className={`${rw.sess === sel?.s.id ? "on" : ""} ${rw.bad ? "bad" : ""}`} onClick={() => pick(rw.sess)} tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(rw.sess); } }} aria-label={`Row ${i + 1}: ${rw.dir} ${rw.data}, ${rw.desc}`}>
                    <td>{i + 1}</td><td>{rw.t.toFixed(3)}</td><td className={rw.dir === "TX" ? "tx" : "rx"}>{rw.dir}</td><td className="mono">{rw.data}</td><td>{rw.desc}</td>
                  </tr>
                ))}
                {!all.length ? <tr><td colSpan={5} className="mcl-l30-empty">{fw ? (f.busy ? "No bus activity: SPI1 is not initialised." : "Waiting for the first transfer...") : "Press Run to start."}</td></tr> : null}
              </tbody>
            </table>
          </div>
          {hints.slice(0, 3).map((h) => (
            <p key={h.text} className="mcl-g2-hint mcl-l30-hint"><Icon name="alert" size={14} /><span>{h.text}</span>{h.fix ? <button type="button" onClick={h.fix[1]}>{h.fix[0]}</button> : null}</p>
          ))}
          <p className="mcl-l30-sub">{paused ? "Table paused: turn Auto-scroll back on or press back to live to resume. " : ""}Click a row to show that transaction in the waveform. {BURST === lab.compiledCode ? "Burst read: one CS-low window, seven bytes." : BUG_READBIT === lab.compiledCode ? "Watch the first byte of each read." : MODE3 === lab.compiledCode ? "Mode 3: SCLK idles high." : ""}</p>
        </Panel>
      </div>
    </LabShell>
  );
}
