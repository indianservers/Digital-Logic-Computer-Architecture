import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useLab } from "../core/useLab";
import type { LabMeta } from "../registry";
import { CodeEditor } from "../ui/CodeEditor";
import { Icon } from "../ui/Icon";
import { LearningNotes, Panel, Toggle } from "../ui/Panels";
import { LabShell } from "../ui/Shell";
import {
  BAUDS, clearLog, clockOk, codeField, corruptNext, DEMO, DEV_STATE, deviceDesc, encodePacket, ep0Valid, FS_BIT, front, hex2, hex4, hostReset, hostSend, mcu33, monitor, P33_DEFAULT,
  printable, pullup, setCodeField, STEP_NAMES, stagesText, VARIANTS, vidpid, world33, type FieldKey, type Front, type MonLine, type P33, type Packet, type Trig, type View, type Xfer,
} from "./L33sim";

const TRIGS: Array<[Trig, string]> = [["ctrl", "Control"], ["bulk", "Bulk data"], ["err", "Errors / NAK"], ["any", "Any"]];
const VIEWS: Array<[View, string]> = [["auto", "Auto"], ["start", "First 40 bits"], ["whole", "Whole packet"]];
const DESC_FIELDS = ["bLength", "bDescriptorType", "bcdUSB (lo)", "bcdUSB (hi)", "bDeviceClass", "bDeviceSubClass", "bDeviceProtocol", "bMaxPacketSize0", "idVendor (lo)", "idVendor (hi)", "idProduct (lo)", "idProduct (hi)", "bcdDevice (lo)", "bcdDevice (hi)", "iManufacturer", "iProduct", "iSerialNumber", "bNumConfigurations"];
const LADDER = ["Attached", "Powered", "Default", "Address", "Configured"];
const SC = { dp: "#60a5fa", dm: "#34d399" } as const;

/* ---------------- scene ---------------- */

const W = 660, H = 270;
const shortReq = (x: Xfer) => x.kind === "ctrl" ? x.title.replace(/ \(.*$/, "") : x.kind === "in" ? `IN ${x.data.length} B` : x.kind === "out" ? `OUT ${x.data.length} B` : x.kind === "reset" ? "SE0 reset" : "";

function Scene({ f, p, now, onCable }: { f: Front; p: P33; now: number; onCable: () => void }) {
  const d = f.dev, h = f.host;
  const pu = pullup(f);
  const recent = [...f.xfers].reverse().find((x) => x.t > now - 0.15 && (x.kind === "ctrl" || x.kind === "in" || x.kind === "out" || x.kind === "reset")) ?? null;
  const ladder = !p.cable ? -1 : d.state === 3 && h.phase === "configured" ? 4 : d.state >= 2 ? 3 : h.phase === "enum" || (h.phase !== "nodevice" && h.phase !== "debounce" && d.state === 1) ? 2 : 1;
  const clkBad = d.usbClk > 0 && !clockOk(d);
  const hostLine = !p.cable ? "Cable unplugged" : !pu ? (d.started ? "No USB clock: D+ pull-up off" : "Waiting for a device (no D+ pull-up)") : h.phase === "debounce" ? "Device attached · debounce 100 ms" : h.phase === "reset" ? `Bus reset${h.attempt ? ` (attempt ${h.attempt + 1} of 3)` : ""}` : h.phase === "enum" ? `Enumerating: ${STEP_NAMES[h.steps.findIndex((s) => s.st === "active")] ?? "…"}` : h.phase === "configured" ? `Configured as COM${h.com}${h.portOpen ? " · terminal open" : ""}` : h.failText.split(":")[0] ?? "Failed";
  const dm = h.phase === "configured" ? { tone: "#15803d", a: `${d.desc.product} (COM${h.com})`, b: `VID_${hex4(d.desc.vid)} & PID_${hex4(d.desc.pid)} · usbser` } : h.phase === "failed" ? { tone: "#b45309", a: h.failCause === "power" ? "Power surge on the USB port" : "Unknown USB Device", b: h.failCause === "power" ? `asks for ${d.desc.powerMa} mA` : "(Device Descriptor Request Failed)" } : h.phase === "nodevice" ? { tone: "#94a3b8", a: "No device", b: "Device Manager is empty" } : { tone: "#1677ff", a: "Installing device…", b: `${((now - h.attachAt) * 1e3).toFixed(0)} ms since attach` };
  const key = (e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onCable(); } };
  const toDev = recent ? recent.kind === "in" ? false : true : true;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mcl-l32-scene" role="img" aria-label={`STM32 USB device ${p.cable ? "connected to" : "unplugged from"} the PC host. ${hostLine}`}>
      <rect x={0} y={0} width={W} height={H} fill="#fff" />
      <g>
        <rect x={40} y={22} width={196} height={150} rx={14} fill="#e9f0fa" stroke="#b9cde8" />
        <text x={138} y={52} textAnchor="middle" fontSize="16" fontWeight="800" fill="#0f2547">STM32</text>
        <text x={138} y={68} textAnchor="middle" fontSize="10.5" fill="#5c7190">USB Device · OTG_FS</text>
        <rect x={56} y={78} width={164} height={16} rx={8} fill={d.state === 3 ? "#dcfce7" : d.state ? "#e0ecff" : "#f1f5f9"} stroke={d.state === 3 ? "#86efac" : "#bfd3f2"} />
        <text x={138} y={89.5} textAnchor="middle" fontSize="8.5" fontWeight="800" fill={d.state === 3 ? "#15803d" : "#1e40af"}>{d.init ? `${DEV_STATE[d.state] ?? "?"}${d.state >= 2 ? ` · address ${d.addr}` : ""}` : "USB not initialised"}</text>
        <text x={56} y={110} fontSize="8.5" fill="#33496b">USB clock</text>
        <text x={220} y={110} textAnchor="end" fontSize="8.5" fontWeight="700" fill={clkBad || (d.osc && !d.usbClk) ? "#b42318" : "#0f2547"} fontFamily="ui-monospace, Consolas, monospace">{d.usbClk ? `${(d.usbClk / 1e6).toFixed(3)} MHz` : d.osc ? "off" : "–"}</text>
        <text x={56} y={124} fontSize="8.5" fill="#33496b">D+ pull-up 1.5 kΩ</text>
        <text x={220} y={124} textAnchor="end" fontSize="8.5" fontWeight="700" fill={pu ? "#15803d" : "#94a3b8"}>{pu ? "on (full speed)" : "off"}</text>
        <text x={56} y={138} fontSize="8.5" fill="#33496b">EP1 OUT</text>
        <text x={220} y={138} textAnchor="end" fontSize="8.5" fontWeight="700" fill={d.state === 3 ? (d.armed ? "#15803d" : "#b45309") : "#94a3b8"}>{d.state === 3 ? (d.armed ? "armed (ACK)" : "not armed (NAK)") : "closed"}</text>
        <text x={56} y={152} fontSize="8.5" fill="#33496b">EP1 IN</text>
        <text x={220} y={152} textAnchor="end" fontSize="8.5" fontWeight="700" fill={d.state === 3 ? (d.txBusy ? "#b45309" : "#15803d") : "#94a3b8"}>{d.state === 3 ? (d.txBusy ? `${d.tx.length} B waiting` : "idle") : "closed"}</text>
        <text x={56} y={165} fontSize="7.5" fill="#64748b">PA12 = D+ · PA11 = D− · VBUS 5 V</text>
      </g>
      <g className="mcl-l32-term" role="button" tabIndex={0} aria-pressed={p.cable} aria-label={p.cable ? "USB cable plugged in: click to unplug" : "USB cable unplugged: click to plug in"} onClick={onCable} onKeyDown={key}>
        <rect x={236} y={78} width={194} height={44} fill="transparent" />
        {p.cable ? (
          <>
            <line x1={236} x2={430} y1={100} y2={100} stroke="#1677ff" strokeWidth={6} strokeLinecap="round" />
            <line x1={236} x2={430} y1={96} y2={96} stroke="#bfdbfe" strokeWidth={1} />
          </>
        ) : (
          <>
            <line x1={330} x2={430} y1={100} y2={100} stroke="#94a3b8" strokeWidth={6} strokeLinecap="round" />
            <rect x={310} y={92} width={22} height={16} rx={3} fill="#cbd5e1" stroke="#64748b" />
            <line x1={236} x2={262} y1={100} y2={100} stroke="#cbd5e1" strokeWidth={4} strokeDasharray="4 3" />
          </>
        )}
        <text x={333} y={86} textAnchor="middle" fontSize="9" fontWeight="800" fill={p.cable ? "#1677ff" : "#94a3b8"}>USB D+ / D−</text>
        <text x={333} y={120} textAnchor="middle" fontSize="7.5" fill="#64748b">{p.cable ? (h.phase === "nodevice" ? "VBUS only" : `12 Mbit/s · SOF #${f.frames % 2048}`) : "click to plug in"}</text>
      </g>
      {recent && p.cable ? (
        <g>
          <rect x={333 - 54} y={93} width={108} height={14} rx={7} fill={recent.result === "err" || recent.result === "stall" ? "#dc2626" : recent.result === "nak" ? "#f59e0b" : "#facc15"} stroke="#0f2547" strokeWidth={0.8} />
          <text x={333} y={103} textAnchor="middle" fontSize="7.5" fontWeight="800" fill="#0f2547" fontFamily="ui-monospace, Consolas, monospace">{toDev ? "◀ " : ""}{shortReq(recent)}{toDev ? "" : " ▶"}</text>
        </g>
      ) : null}
      <g>
        <rect x={430} y={22} width={196} height={150} rx={14} fill="#eef5ff" stroke="#bcd3f3" />
        <text x={528} y={52} textAnchor="middle" fontSize="16" fontWeight="800" fill="#0f2547">PC / USB Host</text>
        <text x={528} y={68} textAnchor="middle" fontSize="10.5" fill="#5c7190">Enumerator</text>
        <rect x={444} y={80} width={168} height={52} rx={8} fill="#fff" stroke="#dbe5f2" />
        <text x={452} y={93} fontSize="7.5" fontWeight="700" fill="#64748b">Device Manager</text>
        <circle cx={457} cy={107} r={4} fill={dm.tone} />
        <text x={466} y={110} fontSize="8.5" fontWeight="800" fill={dm.tone}>{dm.a.length > 30 ? `${dm.a.slice(0, 29)}…` : dm.a}</text>
        <text x={466} y={124} fontSize="7.5" fill="#5c7190">{dm.b}</text>
        <text x={444} y={148} fontSize="8.5" fill="#33496b">Address</text>
        <text x={612} y={148} textAnchor="end" fontSize="8.5" fontWeight="700" fill="#0f2547">{h.phase === "nodevice" ? "–" : h.addr}</text>
        <text x={444} y={162} fontSize="8.5" fill="#33496b">Enumeration</text>
        <text x={612} y={162} textAnchor="end" fontSize="8.5" fontWeight="700" fill={h.phase === "failed" ? "#b42318" : "#0f2547"}>{h.phase === "configured" && h.configuredAt !== null ? `${((h.configuredAt - h.attachAt) * 1e3).toFixed(0)} ms` : h.phase === "failed" ? "failed" : h.phase === "nodevice" ? "–" : `attempt ${h.attempt + 1}`}</text>
      </g>
      <text x={40} y={196} fontSize="8.5" fontWeight="800" fill="#0f2547">USB device states (chapter 9)</text>
      {LADDER.map((s, i) => {
        const x = 40 + i * 118, on = i <= ladder, cur = i === ladder;
        return (
          <g key={s}>
            <rect x={x} y={204} width={106} height={24} rx={7} fill={cur ? (i === 4 ? "#dcfce7" : "#dbeafe") : on ? "#f1f6ff" : "#f8fafc"} stroke={cur ? (i === 4 ? "#16a34a" : "#1677ff") : on ? "#bfd3f2" : "#e2e8f0"} strokeWidth={cur ? 1.6 : 1} />
            <text x={x + 53} y={220} textAnchor="middle" fontSize="9" fontWeight={cur ? 800 : 600} fill={on ? "#0f2547" : "#94a3b8"}>{s}</text>
            {i < 4 ? <text x={x + 112} y={220} textAnchor="middle" fontSize="9" fill="#94a3b8">›</text> : null}
          </g>
        );
      })}
      <text x={40} y={250} fontSize="9" fill={h.phase === "failed" ? "#b42318" : "#33496b"}>Host: {hostLine}</text>
      <text x={626} y={250} textAnchor="end" fontSize="8.5" fill="#64748b">VID:PID {vidpid(d.desc)} · EP0 {d.desc.ep0} B · {d.desc.powerMa} mA</text>
    </svg>
  );
}

/* ---------------- waveform ---------------- */

const PW = 560, PH = 158, PL = 34, PR = 8;
const LN = { dp: [30, 56], dm: [72, 98] } as const;
const PSEG_FILL: Record<string, string> = { SYNC: "#475569", PID: "#5b21b6", ADDR: "#155e75", ENDP: "#0e7490", CRC5: "#1e3a8a", DATA: "#166534", CRC16: "#1e3a8a", EOP: "#7f1d1d" };

function Wave({ pk, view }: { pk: Packet | null; view: View }) {
  const w = PW - PL - PR;
  const frame = (
    <g>
      <rect x={0} y={0} width={PW} height={PH} rx={6} fill="#0b1626" />
      {([LN.dp, LN.dm] as const).map(([a, b], i) => <g key={i}><line x1={PL} x2={PL + w} y1={a} y2={a} stroke="#15243a" /><line x1={PL} x2={PL + w} y1={b} y2={b} stroke="#1d3150" /></g>)}
      <text x={6} y={(LN.dp[0] + LN.dp[1]) / 2 + 4} fontSize="10" fontWeight="800" fill={SC.dp}>D+</text>
      <text x={6} y={(LN.dm[0] + LN.dm[1]) / 2 + 4} fontSize="10" fontWeight="800" fill={SC.dm}>D−</text>
    </g>
  );
  if (!pk) return <svg viewBox={`0 0 ${PW} ${PH}`} className="mcl-l31-scope" role="img" aria-label="No packet selected">{frame}<text x={PL + w / 2} y={80} textAnchor="middle" fontSize="11" fill="#94a3b8">Select a transfer to see its packets on D+ and D−.</text></svg>;
  const e = encodePacket(pk);
  const skew = pk.skew ?? 1;
  const total = e.line.length;
  const v = view === "auto" ? (total > 70 ? "start" : "whole") : view;
  const nb = v === "start" ? Math.min(total, 40) : total;
  const span = nb * Math.max(1, skew);
  const X = (i: number) => PL + (i * skew / span) * w;
  const lim = (x: number) => Math.min(PL + w, x);
  const level = (l: string, lane: "dp" | "dm") => (lane === "dp" ? (l === "J" ? 1 : 0) : l === "K" ? 1 : 0);
  const path = (lane: "dp" | "dm") => {
    const [top, bot] = LN[lane];
    const pts: string[] = [];
    for (let i = 0; i < nb; i++) { const y = level(e.line[i]!, lane) ? top : bot; const x0 = lim(X(i)), x1 = lim(X(i + 1)); pts.push(`${x0.toFixed(1)} ${y}`, `${x1.toFixed(1)} ${y}`); }
    return `M${pts.join(" L")}`;
  };
  const px = w / span;
  const segs = e.segs.filter((s) => s.a < nb);
  return (
    <svg viewBox={`0 0 ${PW} ${PH}`} className="mcl-l31-scope" role="img" aria-label={`${pk.pid} packet from the ${pk.from === "host" ? "host" : "device"}, ${total} bit times`}>
      {frame}
      {px >= 6 ? Array.from({ length: Math.floor(span) + 1 }, (_, i) => <line key={i} x1={PL + (i / span) * w} x2={PL + (i / span) * w} y1={24} y2={LN.dm[1] + 2} stroke="#132238" />) : null}
      {segs.map((s, i) => {
        const x1 = lim(X(s.a)), x2 = lim(X(Math.min(s.b, nb)));
        return (
          <g key={i}>
            <rect x={x1 + 0.5} y={5} width={Math.max(0, x2 - x1 - 1)} height={14} rx={3} fill={PSEG_FILL[s.f] ?? "#334155"} opacity={0.92} />
            {x2 - x1 > s.label.length * 5.3 ? <text x={(x1 + x2) / 2} y={15.5} textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#f8fafc" fontFamily="ui-monospace, Consolas, monospace">{s.label}</text> : null}
          </g>
        );
      })}
      {px >= 8 ? e.stuff.filter((i) => i < nb).map((i) => <text key={`s${i}`} x={X(i + 0.5)} y={LN.dp[0] - 3} textAnchor="middle" fontSize="7" fontWeight="800" fill="#c084fc">s</text>) : null}
      <path d={path("dp")} fill="none" stroke={SC.dp} strokeWidth={1.8} strokeLinejoin="round" />
      <path d={path("dm")} fill="none" stroke={SC.dm} strokeWidth={1.8} strokeLinejoin="round" />
      {px >= 9 ? Array.from({ length: nb }, (_, i) => <text key={`l${i}`} x={X(i + 0.5)} y={LN.dm[1] + 13} textAnchor="middle" fontSize="7.5" fill={e.line[i] === "0" ? "#f87171" : "#94a3b8"} fontFamily="ui-monospace, Consolas, monospace">{e.line[i] === "0" ? "0" : e.line[i]}</text>) : null}
      {pk.bad ? <text x={PL + w - 4} y={LN.dp[0] - 3} textAnchor="end" fontSize="8.5" fontWeight="800" fill="#fca5a5">{pk.bad === "clock" ? `bits ${((skew - 1) * 100).toFixed(1)} % ${skew > 1 ? "long" : "short"}: sampling drifts off` : "CRC16 does not match: no ACK"}</text> : null}
      {[0, 0.5, 1].map((q) => <text key={q} x={PL + q * w} y={PH - 5} textAnchor={q === 0 ? "start" : q === 1 ? "end" : "middle"} fontSize="8.5" fill="#94a3b8">{+((q * span) * FS_BIT * 1e6).toFixed(2)} µs</text>)}
      <text x={PL + w / 2} y={PH - 18} textAnchor="middle" fontSize="8" fill="#64748b">{nb < total ? `bits 0–${nb - 1} of ${total}` : `${total} bit times`} · 83.3 ns per bit · J = D+ high, K = D− high, SE0 = both low (EOP) · NRZI: 0 = change</text>
    </svg>
  );
}

/* ---------------- lab ---------------- */

const NO_SEEN = { enum: false, ctrl: false, pk: false, echo: false, vid: false, ep8: false, fix: false };
type Seen = typeof NO_SEEN;

export default function L33({ meta }: { meta: LabMeta }) {
  const lab = useLab<P33>({ slug: meta.slug, code: DEMO, params: P33_DEFAULT, mcu: mcu33, world: world33 });
  const { mcu, params: p } = lab;
  const fw = mcu.fw;
  const f = front(mcu);
  const now = mcu.now;
  const d = f.dev, h = f.host;
  const [sel, setSel] = useState<Xfer | null>(null);
  const [pkSel, setPkSel] = useState<[number, number] | null>(null);
  const [follow, setFollow] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [seen, setSeen] = useState<Seen>(NO_SEEN);
  const [failSeen, setFailSeen] = useState(false);
  const [draft, setDraft] = useState<{ vid: string | null; pid: string | null }>({ vid: null, pid: null });
  const [text, setText] = useState("hello usb");
  const frozen = useRef<{ fw: unknown; lines: MonLine[]; xfers: Xfer[] } | null>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const termRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (pending !== null && lab.code === pending) { setPending(null); lab.run(); } }, [pending, lab]);
  useEffect(() => { setSel(null); setPkSel(null); }, [fw]);
  useEffect(() => { if (!msg) return; const id = window.setTimeout(() => setMsg(""), 4000); return () => window.clearTimeout(id); }, [msg]);

  const loadCode = (next: string) => { if (next === lab.code) { lab.run(); return; } lab.setCode(next); setPending(next); };
  const edit = (k: FieldKey, v: string) => {
    if (codeField(lab.code, k) === null) { setMsg("This setting was not found in the code: edit the #define lines or SystemClock_Config() directly."); return; }
    const next = setCodeField(lab.code, k, v);
    if (next !== lab.code) loadCode(next);
  };
  const cf = (k: FieldKey) => codeField(lab.code, k);
  const applyHex = (k: "vid" | "pid", raw: string) => {
    const s = raw.trim().replace(/^0x/i, "");
    setDraft((o) => ({ ...o, [k]: null }));
    if (!/^[0-9a-f]{1,4}$/i.test(s)) { setMsg(`${k.toUpperCase()} is a 16-bit number: 0x0000 to 0xFFFF.`); return; }
    edit(k, `0x${hex4(parseInt(s, 16))}`);
  };
  const ep0Code = Number(cf("ep0") ?? 64), powerCode = Number(cf("power") ?? 100), pllqCode = Number(cf("pllq") ?? 7);
  const ep0Opts = [8, 16, 32, 64].includes(ep0Code) ? [8, 16, 32, 64] : [8, 16, 32, 64, ep0Code];
  const powerOpts = [100, 250, 500, 600].includes(powerCode) ? [100, 250, 500, 600] : [100, 250, 500, 600, powerCode];
  const qOpts = [6, 7, 8].includes(pllqCode) ? [6, 7, 8] : [6, 7, 8, pllqCode];

  const v = (n: string) => (fw ? fw.num(n, Number.NaN) : Number.NaN);
  const baud = v("baud"), rxBytes = v("rxBytes"), ticks = v("ticks"), busy = v("busy");

  const match = (x: Xfer) => p.trig === "any" ? x.kind === "ctrl" || x.kind === "in" || x.kind === "out" : p.trig === "ctrl" ? x.kind === "ctrl" : p.trig === "bulk" ? x.kind === "in" || x.kind === "out" : x.result === "err" || x.result === "stall" || x.result === "nak" || x.tries > 1;
  let live: Xfer | null = null;
  for (let i = f.xfers.length - 1; i >= 0; i--) if (match(f.xfers[i]!)) { live = f.xfers[i]!; break; }
  const shown = sel ?? live;
  const defaultPk = (x: Xfer): [number, number] | null => {
    for (const [si, s] of x.stages.entries()) { const pi = s.packets.findIndex((q) => q.bad); if (pi >= 0) return [si, pi]; }
    for (const [si, s] of x.stages.entries()) { const pi = s.packets.findIndex((q) => (q.data?.length ?? 0) > 0); if (pi >= 0) return [si, pi]; }
    return x.stages.length ? [0, 0] : null;
  };
  const pkIdx = shown ? (pkSel && shown.stages[pkSel[0]]?.packets[pkSel[1]] ? pkSel : defaultPk(shown)) : null;
  const pk = shown && pkIdx ? shown.stages[pkIdx[0]]!.packets[pkIdx[1]]! : null;

  const paused = !follow || sel !== null;
  if (!paused || frozen.current?.fw !== fw) frozen.current = null;
  if (paused && !frozen.current) frozen.current = { fw, lines: monitor(f), xfers: f.xfers.slice() };
  const lines = frozen.current?.lines ?? monitor(f);
  const lastKey = `${lines.length}:${lines[lines.length - 1]?.key ?? ""}:${lines[lines.length - 1]?.text ?? ""}`;
  useEffect(() => { const el = listRef.current; if (follow && !sel && el) el.scrollTop = el.scrollHeight; }, [lastKey, follow, sel]);
  useEffect(() => {
    const list = listRef.current, el = list?.querySelector<HTMLElement>("button.on");
    if (list && el) list.scrollTop += el.getBoundingClientRect().top - list.getBoundingClientRect().top - list.clientHeight / 2;
  }, [sel]);
  const termKey = `${f.term.length}:${f.term[f.term.length - 1]?.text.length ?? 0}`;
  useEffect(() => { const el = termRef.current; if (el) el.scrollTop = el.scrollHeight; }, [termKey]);
  const pick = (id: number | null) => {
    if (id === null) return;
    const pool = frozen.current?.xfers ?? f.xfers;
    const x = pool.find((y) => y.id === id) ?? f.xfers.find((y) => y.id === id) ?? null;
    if (!x) { setMsg("That transfer has left the capture buffer."); return; }
    if (!frozen.current) frozen.current = { fw, lines, xfers: f.xfers.slice() };
    setSel(x); setPkSel(null);
  };
  const send = () => { if (!text) return; if (!fw) { setMsg("Press Run first."); return; } hostSend(mcu, text.endsWith("\n") ? text : `${text}\r\n`); };

  const outNak = f.xfers.some((x) => x.result === "nak" && x.kind === "out" && x.t > now - 0.5);
  const hints: Array<{ text: string; tone?: "info"; fix?: Array<[string, () => void]> }> = [];
  if (!fw) hints.push({ text: "Press Run to flash the board: the USB stack starts and the PC enumerates it.", tone: "info" });
  if (fw && !p.cable) hints.push({ text: "The USB cable is unplugged: no VBUS, no D+ pull-up, nothing for the host to see.", tone: "info", fix: [["Plug in", () => lab.setParam("cable", true)]] });
  if (fw && d.init && !d.started && now > 0.05) hints.push({ text: "USBD_Start() was never called: the 1.5 kΩ pull-up on D+ stays disconnected, so the PC has no idea a full-speed device is on the cable.", fix: lab.code.includes("// USBD_Start") ? [["Call USBD_Start()", () => loadCode(lab.code.replace("// USBD_Start(&hUsbDeviceFS);", "USBD_Start(&hUsbDeviceFS);"))]] : [["Load the demo", () => loadCode(DEMO)]] });
  if (fw && d.osc && d.usbClk === 0) hints.push({ text: "The PLL is not running, so the USB core has no 48 MHz clock and cannot connect.", fix: [["Load the demo", () => loadCode(DEMO)]] });
  if (fw && d.usbClk > 0 && !clockOk(d)) hints.push({ text: `USB clock = 8 MHz / 8 × 336 / ${pllqCode} = ${+(d.usbClk / 1e6).toFixed(2)} MHz. Full-speed USB needs 48 MHz ± 0.25 %: every bit the device sends is ${Math.abs((48e6 / d.usbClk - 1) * 100).toFixed(1)} % off, the host cannot decode a single handshake and reports "Device Descriptor Request Failed".`, fix: [["PLLQ = 7 (48 MHz)", () => edit("pllq", "7")]] });
  if (fw && d.init && !ep0Valid(d.desc.ep0)) hints.push({ text: `bMaxPacketSize0 = ${d.desc.ep0}: a full-speed control endpoint must be 8, 16, 32 or 64 bytes. The host reads the first device descriptor, rejects it and resets the port.`, fix: [["EP0 = 64 bytes", () => edit("ep0", "64")]] });
  if (fw && d.init && d.desc.powerMa > 500) hints.push({ text: `The configuration descriptor asks for ${d.desc.powerMa} mA, but a USB 2.0 port supplies at most 500 mA. The device gets an address but the host never sends SET_CONFIGURATION.`, fix: [["100 mA", () => edit("power", "100")]] });
  if (fw && d.init && !d.cls && h.phase !== "nodevice") hints.push({ text: "No class is registered (USBD_RegisterClass() is missing), so the device has no configuration descriptor and STALLs the request.", fix: [["Load the demo", () => loadCode(DEMO)]] });
  if (fw && outNak && !lab.compiledCode.includes("USBD_CDC_ReceivePacket")) hints.push({ text: "EP1 OUT keeps answering NAK: after a packet arrives the endpoint stays closed until the firmware calls USBD_CDC_ReceivePacket(). The host retries every millisecond, forever.", fix: [["Re-arm in CDC_Receive_FS", () => loadCode(lab.code.replace("  USBD_CDC_SetRxBuffer(&hUsbDeviceFS, Buf);\n", "  USBD_CDC_SetRxBuffer(&hUsbDeviceFS, Buf);\n  USBD_CDC_ReceivePacket(&hUsbDeviceFS);\n"))]] });
  if (fw && h.phase === "configured" && !p.port) hints.push({ text: "No terminal has the COM port open: DTR = 0 and the host does not poll EP1 IN, so the demo stops sending ticks. Open the port to read data from the board.", tone: "info", fix: [["Open COM port", () => lab.setParam("port", true)]] });
  if (fw && busy > 0) hints.push({ text: `CDC_Transmit_FS() returned USBD_BUSY ${busy} time${busy === 1 ? "" : "s"}: the previous packet had not been collected by an IN token yet, so that message was dropped.`, tone: "info" });
  if (fw && d.failCalls > 0 && h.phase !== "configured") hints.push({ text: `CDC_Transmit_FS() returned USBD_FAIL ${d.failCalls} time${d.failCalls === 1 ? "" : "s"}: there is nothing to send to until the host configures the device.`, tone: "info" });
  if (fw && f.corrupted > 0 && f.xfers.some((x) => x.tries > 1 && x.t > now - 1)) hints.push({ text: "A corrupted packet failed its CRC16 check: the receiver stays silent (no ACK) and the host simply repeats the transaction. USB recovers from single bit errors by itself.", tone: "info" });
  const problems = hints.filter((x) => x.tone !== "info");

  useEffect(() => { if (h.phase === "failed") setFailSeen(true); }, [h.phase]);
  const flags: Seen = {
    enum: h.phase === "configured",
    ctrl: !!sel && sel.kind === "ctrl",
    pk: pkSel !== null,
    echo: rxBytes > 0 && f.term.some((l) => l.dir === "rx" && /[A-Z]{2}/.test(l.text) && !/^tick/.test(l.text)),
    vid: [...f.okVidPid].some((k) => k !== "0483:5740"),
    ep8: h.phase === "configured" && d.desc.ep0 === 8,
    fix: failSeen && h.phase === "configured",
  };
  useEffect(() => {
    const ks = Object.keys(flags) as Array<keyof Seen>;
    if (ks.some((k) => flags[k] && !seen[k])) setSeen((o) => { const n = { ...o }; for (const k of ks) n[k] = o[k] || flags[k]; return n; });
  });

  const shellLab = { ...lab, resetLab: () => { lab.resetLab(); setSel(null); setPkSel(null); setFollow(true); setPending(null); setSeen(NO_SEEN); setFailSeen(false); setDraft({ vid: null, pid: null }); setText("hello usb"); frozen.current = null; } };
  const statusTone = !fw ? "off" : problems.length || h.phase === "failed" ? "warn" : h.phase === "configured" ? "ok" : "off";
  const custom = !VARIANTS.some((x) => x.code === lab.compiledCode);
  const dd = d.init ? deviceDesc(d.desc) : [];
  const stepState = (i: number) => h.steps[i]?.st ?? "todo";
  const stepX = (i: number) => { const id = h.steps[i]?.x; return id ? f.xfers.find((x) => x.id === id) ?? null : null; };

  const notesData = {
    takeaways: [
      "USB is host-driven: the PC starts every transaction, the device only answers.",
      "A full-speed device announces itself with a 1.5 kΩ pull-up on D+ (low-speed uses D−). Until then the host sees nothing.",
      "Enumeration: bus reset, GET_DESCRIPTOR (device), SET_ADDRESS, the configuration and string descriptors, then SET_CONFIGURATION.",
      "Every control transfer has a SETUP stage, an optional DATA stage and a STATUS stage in the opposite direction.",
      "Each transaction is token, data, handshake: ACK means received, NAK means try again later, STALL means not supported.",
      "Endpoints are one-way buffers: EP0 for control, bulk EP1 IN/OUT for CDC data, an interrupt EP for notifications.",
      "The bits are NRZI coded (0 = level change) with a stuffed 0 after six 1s, and protected by CRC5 (tokens) or CRC16 (data).",
    ],
    observe: "Press Run. The board connects its D+ pull-up, the PC waits 100 ms, resets the bus and walks through the Enumeration Steps. The Timeline shows each control transfer as SETUP → DATA → STATUS.",
    tryIt: "Click an Enumeration Step to freeze its transfer, then click any packet chip to see it on D+ and D−. Type text in the PC terminal and press Send: the board echoes it in upper case.",
    measure: `Now: ${h.phase === "configured" && h.configuredAt !== null ? `enumerated ${((h.configuredAt - h.attachAt) * 1e3).toFixed(0)} ms after attach` : `host ${h.phase}`}, EP0 ${f.eps.ep0.pk} packets / ${f.eps.ep0.bytes} B, EP1 OUT ${f.eps.out1.pk} packets (${f.eps.out1.nak} NAK), EP1 IN ${f.eps.in1.pk} packets (${f.eps.in1.nak} NAK), firmware baud = ${Number.isFinite(baud) ? baud : "–"}.`,
    modify: "Change EP0 to 8 bytes and watch the device descriptor split into three DATA packets. Change the PID: Windows treats it as a new device and gives it another COM port.",
    runAgain: "Load each bug example (no USBD_Start, wrong USB clock, invalid EP0, 600 mA, OUT not re-armed, no class), read the hint, fix it and press Run again.",
    challenge: "Corrupt a packet during enumeration and find the retried transaction. Then close the COM port and explain why CDC_Transmit_FS() starts returning USBD_BUSY.",
    question: "Why does the device answer SET_ADDRESS on address 0 and only switch to the new address after the STATUS stage?",
    checks: [
      { label: "Watch the board enumerate as a COM port", done: seen.enum },
      { label: "Open an Enumeration Step and read its SETUP / DATA / STATUS", done: seen.ctrl },
      { label: "Decode a packet on D+ / D− (SYNC, PID, data, CRC, EOP)", done: seen.pk },
      { label: "Send text from the PC and get the echo", done: seen.echo },
      { label: "Change the VID or PID and enumerate again", done: seen.vid },
      { label: "Enumerate with an 8-byte EP0", done: seen.ep8 },
      { label: "Fix a \"Device Descriptor Request Failed\" bug", done: seen.fix },
    ],
  };

  return (
    <LabShell meta={meta} lab={shellLab} subtitle="Enumeration, endpoints, descriptors, control transfers and device communication."
      components={["STM32 Nucleo-F401RE: OTG_FS device on PA11 (D−) / PA12 (D+), 48 MHz USB clock from PLLQ", "PC USB host: Windows-style enumerator with the CDC-ACM (usbser) driver and a serial terminal", "USB 2.0 full-speed cable: VBUS, D+, D−, GND", "Every packet is built bit by bit: SYNC, PID, address/endpoint, CRC5/CRC16, bit stuffing, NRZI and EOP"]}>
      <div className="mcl-grid mcl-g4-grid">
        <Panel title="USB Device & Host Explorer" icon="link" className="mcl-g4-vis">
          <Scene f={f} p={p} now={now} onCable={() => lab.setParam("cable", !p.cable)} />
          <div className="mcl-l31-read">
            <div className={`mcl-l31-chip ${d.state === 3 ? "ok" : ""}`}><span>Device state (dev_state)</span><b>{fw && d.init ? `${d.state} · ${DEV_STATE[d.state]}` : "–"}</b></div>
            <div className={`mcl-l31-chip ${fw ? (Number.isFinite(baud) && baud === p.baud && h.portOpen ? "ok" : "") : ""}`} title="baud in the firmware, set by SET_LINE_CODING"><span>Line coding (baud)</span><b>{fw && Number.isFinite(baud) && baud ? baud : "–"}</b></div>
            <div className={`mcl-l31-chip ${rxBytes > 0 ? "ok" : ""}`}><span>Bytes received (rxBytes)</span><b>{fw && Number.isFinite(rxBytes) ? rxBytes : "–"}</b></div>
            <div className={`mcl-l31-chip ${busy > 0 ? "bad" : ticks > 0 ? "ok" : ""}`}><span>Ticks sent · busy</span><b>{fw && Number.isFinite(ticks) ? `${ticks} · ${busy}` : "–"}</b></div>
          </div>
          <div className="mcl-l33-term">
            <div className="mcl-l33-termhead">
              <b>PC terminal{h.phase === "configured" ? ` · COM${h.com}` : ""}</b>
              <Toggle label="Port open" checked={p.port} onChange={(x) => lab.setParam("port", x)} hint="Open the COM port (sets DTR, polls EP1 IN)" />
              <label className="mcl-l31-inline">Baud:<select value={p.baud} aria-label="Terminal baud rate" onChange={(ev) => lab.setParam("baud", Number(ev.target.value))}>{BAUDS.map((b) => <option key={b} value={b}>{b}</option>)}</select></label>
              <Toggle label="Cable" checked={p.cable} onChange={(x) => lab.setParam("cable", x)} hint="Plug or unplug the USB cable" />
            </div>
            <div className="mcl-l33-screen" ref={termRef} aria-live="polite" aria-label="Terminal output">
              {f.term.length ? f.term.slice(-60).map((l, i) => <div key={`${l.t}-${i}`} className={l.dir}>{l.dir === "tx" ? "> " : ""}{l.text.replace(/\r/g, "")}</div>) : <div className="empty">{!fw ? "Press Run." : h.phase !== "configured" ? "The COM port appears once the board is configured." : p.port ? "Waiting for data from the board…" : "Port closed."}</div>}
            </div>
            <form className="mcl-l33-send" onSubmit={(ev) => { ev.preventDefault(); send(); }}>
              <input type="text" value={text} maxLength={120} aria-label="Text to send" onChange={(ev) => setText(ev.target.value)} disabled={!fw} spellCheck={false} />
              <button type="submit" className="mcl-l31-btn" disabled={!fw || !text}>Send</button>
              <div className="mcl-l31-faultbtns">
                <button type="button" onClick={() => hostReset(mcu)} disabled={!fw || h.phase === "nodevice"} title="The host drives SE0 for 10 ms and enumerates again">Bus reset</button>
                <button type="button" onClick={() => corruptNext(mcu)} disabled={!fw || h.phase === "nodevice"} title="Flip bits in the next DATA packet from the device">{f.corrupt ? `Corruption armed (${f.corrupt})` : "Corrupt next packet"}</button>
              </div>
            </form>
          </div>
        </Panel>

        <Panel title="Enumeration Steps" icon="list" className="mcl-g4-cfg">
          <ol className="mcl-l33-steps">
            {STEP_NAMES.map((s, i) => {
              const st = stepState(i), x = stepX(i);
              const on = !!sel && !!x && sel.id === x.id;
              return (
                <li key={s}>
                  <button type="button" className={`${st} ${on ? "on" : ""}`} disabled={!x} onClick={() => x && pick(x.id)} aria-pressed={on} title={x ? `${x.title}: ${x.text}` : "Not reached yet"}>
                    <Icon name={st === "ok" ? "check" : st === "fail" ? "x" : st === "active" ? "activity" : "target"} size={13} />
                    <span>{i + 1}. {s}</span>
                    <em>{x ? x.kind === "ctrl" ? stagesText(x) : "SE0 10 ms" : ""}</em>
                  </button>
                </li>
              );
            })}
          </ol>
          <div className={`mcl-l31-status ${statusTone}`}>
            <Icon name={statusTone === "ok" ? "check" : "alert"} size={16} />
            <div>
              <b>{!fw ? "USB stopped" : h.phase === "configured" ? `Configured · COM${h.com}` : h.phase === "failed" ? (h.failCause === "power" ? "Not configured: power" : "Enumeration failed") : h.phase === "nodevice" ? "No device on the bus" : "Enumerating…"}</b>
              <span>{h.phase === "failed" ? h.failText : `Full speed 12 Mbit/s · address ${h.phase === "nodevice" ? "–" : h.addr} · EP0 ${d.desc.ep0} B · ${f.frames} SOF frames · attempt ${Math.min(3, h.attempt + 1)} of 3`}</span>
            </div>
          </div>
          {msg ? <p className="mcl-l31-hint"><Icon name="alert" size={14} /><span>{msg}</span></p> : null}
          {lab.dirty && !pending ? <p className="mcl-l31-sub">The editor has unflashed changes: press Run to apply them.</p> : null}
        </Panel>

        <Panel title="Endpoint Inspector" icon="table" className="mcl-g4-scope">
          <table className="mcl-l32-nodes mcl-l33-eps">
            <thead><tr><th>Endpoint</th><th>Type</th><th>Size</th><th>State</th><th>Packets</th><th>Bytes</th><th>NAK</th></tr></thead>
            <tbody>
              <tr className={d.state ? "active" : "off"}><td>EP0 IN/OUT</td><td>Control</td><td>{d.desc.ep0} B</td><td><i />{d.state ? "open" : "–"}</td><td>{f.eps.ep0.pk}</td><td>{f.eps.ep0.bytes}</td><td>–</td></tr>
              <tr className={d.state === 3 ? (d.txBusy ? "passive" : "active") : "off"}><td>EP1 IN</td><td>Bulk</td><td>64 B</td><td><i />{d.state === 3 ? (d.txBusy ? "data waiting" : "idle") : "closed"}</td><td>{f.eps.in1.pk}</td><td>{f.eps.in1.bytes}</td><td>{f.eps.in1.nak}</td></tr>
              <tr className={d.state === 3 ? (d.armed ? "active" : "passive") : "off"}><td>EP1 OUT</td><td>Bulk</td><td>64 B</td><td><i />{d.state === 3 ? (d.armed ? "armed" : "NAK") : "closed"}</td><td>{f.eps.out1.pk}</td><td>{f.eps.out1.bytes}</td><td>{f.eps.out1.nak}</td></tr>
              <tr className={d.state === 3 ? "active" : "off"}><td>EP2 IN</td><td>Interrupt</td><td>8 B</td><td><i />{d.state === 3 ? "every 16 ms" : "closed"}</td><td>0</td><td>0</td><td>{f.eps.in2.nak}</td></tr>
            </tbody>
          </table>
          <div className="mcl-l31-rows mcl-l32-rows mcl-l33-rows">
            <label><span>VID</span><input type="text" className="mcl-l32-id" value={draft.vid ?? cf("vid") ?? ""} disabled={cf("vid") === null} aria-label="Vendor ID (hex)" spellCheck={false} onChange={(ev) => setDraft((o) => ({ ...o, vid: ev.target.value }))} onBlur={(ev) => { if (draft.vid !== null) applyHex("vid", ev.target.value); }} onKeyDown={(ev) => { if (ev.key === "Enter") applyHex("vid", (ev.target as HTMLInputElement).value); if (ev.key === "Escape") setDraft((o) => ({ ...o, vid: null })); }} /></label>
            <label><span>PID</span><input type="text" className="mcl-l32-id" value={draft.pid ?? cf("pid") ?? ""} disabled={cf("pid") === null} aria-label="Product ID (hex)" spellCheck={false} onChange={(ev) => setDraft((o) => ({ ...o, pid: ev.target.value }))} onBlur={(ev) => { if (draft.pid !== null) applyHex("pid", ev.target.value); }} onKeyDown={(ev) => { if (ev.key === "Enter") applyHex("pid", (ev.target as HTMLInputElement).value); if (ev.key === "Escape") setDraft((o) => ({ ...o, pid: null })); }} /></label>
            <label><span>EP0 size</span><select value={ep0Code} disabled={cf("ep0") === null} aria-label="bMaxPacketSize0" onChange={(ev) => edit("ep0", ev.target.value)}>{ep0Opts.map((k) => <option key={k} value={k}>{k} bytes{ep0Valid(k) ? "" : " (invalid)"}</option>)}</select></label>
            <label><span>Max power</span><select value={powerCode} disabled={cf("power") === null} aria-label="bMaxPower" onChange={(ev) => edit("power", ev.target.value)}>{powerOpts.map((k) => <option key={k} value={k}>{k} mA{k > 500 ? " (too much)" : ""}</option>)}</select></label>
            <label className="wide"><span>USB clock</span><select value={pllqCode} disabled={cf("pllq") === null} aria-label="PLLQ divider" onChange={(ev) => edit("pllq", ev.target.value)}>{qOpts.map((k) => <option key={k} value={k}>PLLQ = {k} → {+(336 / k).toFixed(2)} MHz{k === 7 ? "" : " (not 48 MHz)"}</option>)}</select></label>
          </div>
          <div className="mcl-l33-desc" aria-label="Device descriptor bytes">
            <span>Device descriptor</span>
            {dd.length ? dd.map((b, i) => <code key={i} title={`${DESC_FIELDS[i]} = 0x${hex2(b)}`} className={i === 7 ? (ep0Valid(b) ? "k" : "bad") : i >= 8 && i <= 11 ? "id" : ""}>{hex2(b)}</code>) : <em>appears after USBD_Init()</em>}
          </div>
        </Panel>

        <CodeEditor lab={lab} className="mcl-g4-code" languages={VARIANTS} />

        <Panel title="Control Transfer Timeline" icon="wave" className="mcl-g4-mon mcl-l32-scopep"
          tools={<>
            <label className="mcl-l31-inline"><span className="mcl-l31-lbl">Show:</span><select value={p.trig} aria-label="Transfer filter" onChange={(ev) => lab.setParam("trig", ev.target.value as Trig)}>{TRIGS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
            <label className="mcl-l31-inline"><span className="mcl-l31-lbl">Zoom:</span><select value={p.view} aria-label="Waveform zoom" onChange={(ev) => lab.setParam("view", ev.target.value as View)}>{VIEWS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          </>}>
          {shown ? (
            <div className="mcl-l33-stages">
              {shown.stages.map((s, si) => (
                <div key={si} className="mcl-l33-stage">
                  <b>{s.name}</b>
                  <div>
                    {s.packets.map((q, pi) => {
                      const on = !!pkIdx && pkIdx[0] === si && pkIdx[1] === pi;
                      return (
                        <button key={pi} type="button" className={`${q.from} ${q.bad ? "bad" : ""} ${on ? "on" : ""}`} aria-pressed={on} onClick={() => { if (!sel) pick(shown.id); setPkSel([si, pi]); }}
                          title={`${q.pid} from the ${q.from === "host" ? "host" : "device"}${q.data ? ` · ${q.data.length} bytes` : ""}${q.bad ? " · corrupted" : ""}`}>
                          {q.from === "host" ? "◀" : "▶"} {q.pid}{q.data && q.data.length ? ` ${q.data.length}B` : q.pid.startsWith("DATA") ? " 0B" : ""}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {!shown.stages.length ? <p className="mcl-l31-sub">{shown.title}: {shown.text}</p> : null}
            </div>
          ) : null}
          <Wave pk={pk} view={p.view} />
          <p className="mcl-l31-sub">
            {shown ? <>{sel ? "Frozen" : "Latest"} #{shown.id} at {(shown.t * 1e3).toFixed(1)} ms: <b>{shown.title}</b>{shown.setup ? <> · setup <code>{shown.setup.map(hex2).join(" ")}</code></> : null}{shown.data.length && shown.kind !== "ctrl" ? <> · "{printable(shown.data).slice(0, 40)}"</> : null}{sel ? <> · <button type="button" className="mcl-l31-link" onClick={() => { setSel(null); setPkSel(null); }}>back to live</button></> : null}</> : "SETUP → DATA → STATUS: ◀ = host to device, ▶ = device to host."}
          </p>
          <div className="mcl-l31-counts">
            <span>{f.xfers.length} transfers</span>{f.corrupted ? <span className="bad">CRC errors {f.corrupted}</span> : null}{f.eps.out1.nak ? <span>OUT NAK {f.eps.out1.nak}</span> : null}
            <div className="mcl-l31-faultbtns">
              <label className="mcl-l31-inline"><input type="checkbox" checked={follow} onChange={(ev) => setFollow(ev.target.checked)} />Auto-scroll</label>
              <button type="button" className="mcl-l31-btn" onClick={() => { clearLog(mcu); frozen.current = null; setSel(null); setPkSel(null); }}>Clear</button>
            </div>
          </div>
          <ol className="mcl-l31-mon mcl-l33-mon" ref={listRef} aria-label="USB transfer log">
            {lines.map((ln) => {
              const on = !!sel && ln.id === sel.id;
              return (
                <li key={ln.key}>
                  <button type="button" className={`${ln.tone === "ctrl" ? "scan" : ln.tone === "info" || ln.tone === "ok" ? "" : ln.tone} ${on ? "on" : ""}`} onClick={() => pick(ln.id)} aria-pressed={on}>
                    <time>{(ln.t * 1e3).toFixed(1)}</time>
                    <span><code className="mcl-l31-frame"><span className={ln.tone === "bad" ? "n" : ln.kind === "ctrl" ? "ad" : ln.kind === "in" ? "a" : "d"}>{ln.title}</span></code><em>{ln.text}</em></span>
                  </button>
                </li>
              );
            })}
            {!lines.length ? <li className="mcl-l31-empty">{fw ? (pullup(f) ? "Waiting for the host…" : "No traffic: the host does not see the device.") : "Press Run to start."}</li> : null}
          </ol>
          {hints.slice(0, 3).map((x) => (
            <p key={x.text} className={`mcl-l31-hint ${x.tone ?? ""}`}><Icon name={x.tone === "info" ? "bulb" : "alert"} size={14} /><span>{x.text}</span>{x.fix?.map(([l, fn]) => <button key={l} type="button" onClick={fn}>{l}</button>)}</p>
          ))}
          <p className="mcl-l31-sub">{paused ? "Timeline paused: turn Auto-scroll back on or press back to live. " : ""}Click a transfer to open it, then a packet to see its bits.{custom && fw ? " Running your own version of the program." : ""}</p>
        </Panel>

        <div className="mcl-g4-notes"><LearningNotes notes={notesData} /></div>
      </div>
    </LabShell>
  );
}
