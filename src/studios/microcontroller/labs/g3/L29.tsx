import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useLab } from "../core/useLab";
import type { Mcu, UartFrame } from "../core/mcu";
import type { LabMeta } from "../registry";
import { CodeEditor } from "../ui/CodeEditor";
import { Esp32DevKit, esp32Pin, HwDefs, Wire } from "../ui/Hardware";
import { Icon } from "../ui/Icon";
import { Panel, Toggle } from "../ui/Panels";
import { LabShell } from "../ui/Shell";
import {
  BAUDS, BUG_BAUD, BUG_PARITY, clearMonitor, codeDef, configName, DEMO, ECHO, fmtFrame, fmtName, frameBitList, frameBits, front, monitor, P29_DEFAULT, PARITY, parseConfig,
  RX_PINS, sameFrame, sendTerm, setCodeDef, STREAM, TERM_FORMATS, throughput, TX_PINS, wiring, world29, type CodeKey, type FrameRec, type P29,
} from "./L29sim";

const W = 520, H = 300;
const BX = 40, BY = 8, BS = 1.16;
const AD = { x: 318, y: 100, w: 168, h: 132 };
const RXD = { x: AD.x, y: AD.y + 74 }, TXD = { x: AD.x, y: AD.y + 98 };
const TX_COLOR = "#16a34a", RX_COLOR = "#1677ff";

function poly(pts: Array<[number, number]>, r = 6) {
  let d = `M${pts[0]![0]} ${pts[0]![1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i - 1]!, [cx, cy] = pts[i]!, [nx, ny] = pts[i + 1]!;
    const l1 = Math.hypot(cx - px, cy - py) || 1, l2 = Math.hypot(nx - cx, ny - cy) || 1;
    const k = Math.min(r, l1 / 2, l2 / 2);
    d += ` L${cx - ((cx - px) / l1) * k} ${cy - ((cy - py) / l1) * k} Q${cx} ${cy} ${cx + ((nx - cx) / l2) * k} ${cy + ((ny - cy) / l2) * k}`;
  }
  const last = pts[pts.length - 1]!;
  return `${d} L${last[0]} ${last[1]}`;
}

const charName = (b: number) => (b === 10 ? "LF" : b === 13 ? "CR" : b === 32 ? "SP" : b < 32 || b > 126 ? "·" : String.fromCharCode(b));
const hex2 = (b: number) => `0x${b.toString(16).toUpperCase().padStart(2, "0")}`;
const baudLabel = (b: number) => b.toLocaleString("en-US");
const usStr = (s: number) => (s >= 1e-3 ? `${(s * 1e3).toFixed(3)} ms` : `${(s * 1e6).toFixed(2)} µs`);
const pinLabel = (g: number) => (g === 17 ? "GPIO17 (TX2)" : g === 16 ? "GPIO16 (RX2)" : g === 1 ? "GPIO1 (TX0)" : g === 3 ? "GPIO3 (RX0)" : `GPIO${g}`);

/** Board-unit pin → scene coordinates, plus a route that leaves the header outward. */
function pinAt(g: number) {
  const p = esp32Pin(g) ?? esp32Pin(17)!;
  return { x: BX + p.x * BS, y: BY + p.y * BS, side: p.side };
}
function route(g: number, to: { x: number; y: number }, lane: number): Array<[number, number]> {
  const p = pinAt(g);
  if (p.side === "R") { const mx = 250 + lane * 14; return [[p.x, p.y], [mx, p.y], [mx, to.y], [to.x, to.y]]; }
  const lx = BX - 10 - lane * 7, by = BY + 232 * BS + 8 + lane * 7;
  return [[p.x, p.y], [lx, p.y], [lx, by], [262 + lane * 14, by], [262 + lane * 14, to.y], [to.x, to.y]];
}

function Scene({ m, p, txPin, rxPin, active, hasFw }: { m: Mcu; p: P29; txPin: number; rxPin: number; active: { tx: boolean; rx: boolean }; hasFw: boolean }) {
  const led = m.level("GPIO2") === 1 && hasFw;
  const txTo = p.swap ? TXD : RXD, rxTo = p.swap ? RXD : TXD;
  const tp = pinAt(txPin), rp = pinAt(rxPin);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mcl-svg mcl-l29-scene" role="img" aria-label={`ESP32 UART: TX on GPIO${txPin}, RX on GPIO${rxPin}${p.swap ? ", wires swapped" : ""}`}>
      <HwDefs id="l29" />
      <Esp32DevKit id="l29" x={BX} y={BY} scale={BS} led={led} power={hasFw} pinGlow={{ [txPin]: TX_COLOR, [rxPin]: RX_COLOR }} />
      <Wire d={poly(route(txPin, txTo, 0))} color={TX_COLOR} width={2.6} live={active.tx} />
      <g opacity={p.rxOpen ? 0.9 : 1}>
        <Wire d={poly(route(rxPin, rxTo, 1).slice(0, p.rxOpen ? -1 : undefined))} color={RX_COLOR} width={2.6} live={active.rx && !p.rxOpen} />
        {p.rxOpen ? (() => { const pts = route(rxPin, rxTo, 1); const a = pts[pts.length - 2]!; return <g><circle cx={a[0]} cy={a[1]} r={3} fill="#fff" stroke="#dc2626" strokeWidth={1.4} /><text x={a[0] + 6} y={a[1] - 5} fontSize="8" fontWeight="700" fill="#dc2626">open</text></g>; })() : null}
      </g>
      <text x={tp.side === "R" ? 214 : 200} y={tp.side === "R" ? tp.y - 6 : H - 6} textAnchor="middle" fontSize="10" fontWeight="700" fill="#15803d">TX (GPIO{txPin})</text>
      <text x={rp.side === "R" ? 214 : 200} y={rp.side === "R" ? rp.y + 15 : H - 18} textAnchor="middle" fontSize="10" fontWeight="700" fill="#1659c7">RX (GPIO{rxPin})</text>

      <text x={AD.x + AD.w / 2} y={AD.y - 8} textAnchor="middle" fontSize="11" fontWeight="800" fill="#0f2547">USB / Serial Terminal</text>
      <rect x={AD.x} y={AD.y} width={AD.w} height={AD.h} rx={9} fill="#1f2329" stroke="#0f1115" />
      <rect x={AD.x + 30} y={AD.y + 16} width={88} height={48} rx={4} fill="#b4232a" stroke="#7f1d1d" />
      <rect x={AD.x + 118} y={AD.y + 26} width={34} height={28} rx={2} fill="url(#l29-metal)" stroke="#6b7580" />
      <rect x={AD.x + 54} y={AD.y + 30} width={22} height={20} rx={1.5} fill="url(#l29-chip)" />
      <text x={AD.x + 65} y={AD.y + 42} textAnchor="middle" fontSize="4.6" fontWeight="700" fill="#cbd5e1">CP2102</text>
      <circle cx={AD.x + 88} cy={AD.y + 32} r={2.6} fill={active.tx && !p.swap ? "#22c55e" : "#3f1d1d"} />
      <text x={AD.x + 94} y={AD.y + 34} fontSize="5.5" fill="#fde2e2">RX</text>
      <circle cx={AD.x + 88} cy={AD.y + 46} r={2.6} fill={active.rx ? "#f59e0b" : "#3f1d1d"} />
      <text x={AD.x + 94} y={AD.y + 48} fontSize="5.5" fill="#fde2e2">TX</text>
      {[["RXD", RXD.y], ["TXD", TXD.y]].map(([l, y]) => (
        <g key={l as string}>
          <rect x={AD.x - 3} y={(y as number) - 3} width={6} height={6} fill="#d4af37" />
          <text x={AD.x + 9} y={(y as number) + 3.5} fontSize="9.5" fontWeight="800" fill="#e5e7eb">{l}</text>
        </g>
      ))}
      <circle cx={AD.x + 74} cy={AD.y + 86} r={3.4} fill={hasFw ? "#22c55e" : "#64748b"} />
      <text x={AD.x + 82} y={AD.y + 89} fontSize="9" fill="#e5e7eb">{hasFw ? "Connected" : "Idle"}</text>
      <text x={AD.x + 74} y={AD.y + 106} fontSize="8.5" fill="#94a3b8">COM3 (Virtual)</text>
      <text x={AD.x + 74} y={AD.y + 120} fontSize="8.5" fontWeight="700" fill="#cbd5e1">{baudLabel(p.termBaud)} {p.termFmt}</text>
      <text x={BX + 60 * BS} y={H - 3} textAnchor="middle" fontSize="9" fontWeight="700" fill="#0f2547">ESP32 DevKit V1</text>
    </svg>
  );
}

function windowOf(f: ReturnType<typeof front>, anchor: FrameRec | undefined, view: P29["view"], now: number): [number, number] {
  if (view === "ms20" || !anchor) return [now - 0.02, now];
  const tb = 1 / anchor.baud;
  if (view === "frame") return [anchor.t - 1.5 * tb, anchor.end + 1.5 * tb];
  const dur = anchor.end - anchor.t;
  const same = f.frames.filter((r) => r.dir === anchor.dir && r.t <= anchor.t);
  const first = same[Math.max(0, same.length - 4)] ?? anchor;
  return [Math.min(first.t, anchor.end - 4 * dur) - 1.5 * tb, anchor.end + 1.5 * tb];
}

function Waves({ m, p, anchor, txPin, rxPin, rxDead }: { m: Mcu; p: P29; anchor: FrameRec | undefined; txPin: number; rxPin: number; rxDead: boolean }) {
  const f = front(m);
  const now = m.now;
  const [a, b] = windowOf(f, anchor, p.view, now);
  const pw = 420, ph = 176, l = 74, r = 40, w = pw - l - r;
  const X = (t: number) => l + ((t - a) / (b - a)) * w;
  const lanes = [
    { name: "TX", pin: `GPIO${txPin}`, color: TX_COLOR, line: f.tx, y: 30, dead: false },
    { name: "RX", pin: `GPIO${rxPin}`, color: RX_COLOR, line: f.rx, y: 104, dead: rxDead },
  ];
  const hiY = (y: number) => y, loY = (y: number) => y + 38;
  const showBits = p.view === "frame" && anchor;
  const bits = anchor ? frameBitList(anchor.byte, anchor.f) : [];
  const tb = anchor ? 1 / anchor.baud : 0;
  const visible = f.frames.filter((fr) => fr.end > a && fr.t < b && fr.t <= now);
  return (
    <svg viewBox={`0 0 ${pw} ${ph}`} className="mcl-l29-waves" role="img" aria-label={`TX and RX line levels from ${(a * 1000).toFixed(2)} to ${(b * 1000).toFixed(2)} ms`}>
      {lanes.map((ln) => {
        let d = "";
        if (!ln.dead) {
          const pts = ln.line.points(a, Math.min(b, now));
          pts.forEach(([t, v], i) => {
            const x = X(Math.max(a, t)), y = v ? hiY(ln.y) : loY(ln.y);
            if (i === 0) d = `M${x.toFixed(1)} ${y}`;
            else { const prevY = pts[i - 1]![1] ? hiY(ln.y) : loY(ln.y); d += ` L${x.toFixed(1)} ${prevY} L${x.toFixed(1)} ${y}`; }
          });
          const lastV = pts[pts.length - 1]?.[1] ?? 1;
          d += ` L${X(Math.min(b, now)).toFixed(1)} ${lastV ? hiY(ln.y) : loY(ln.y)}`;
        } else d = `M${l} ${hiY(ln.y)} L${l + w} ${hiY(ln.y)}`;
        return (
          <g key={ln.name}>
            <circle cx={10} cy={ln.y + 12} r={4} fill={ln.color} />
            <text x={19} y={ln.y + 15} fontSize="11" fontWeight="800" fill="#0f2547">{ln.name}</text>
            <text x={19} y={ln.y + 28} fontSize="9" fill="#5c7190">({ln.pin})</text>
            <line x1={l} x2={l + w} y1={hiY(ln.y)} y2={hiY(ln.y)} stroke="#e8eef6" strokeDasharray="3 3" />
            <line x1={l} x2={l + w} y1={loY(ln.y)} y2={loY(ln.y)} stroke="#e8eef6" strokeDasharray="3 3" />
            <text x={l + w + 6} y={hiY(ln.y) + 3} fontSize="8.5" fill="#64748b">3.3 V</text>
            <text x={l + w + 6} y={loY(ln.y) + 3} fontSize="8.5" fill="#64748b">0 V</text>
            <path d={d} fill="none" stroke={ln.dead ? "#94a3b8" : ln.color} strokeWidth={2} strokeLinejoin="round" strokeDasharray={ln.dead ? "5 4" : undefined} />
            {ln.dead ? <text x={l + w / 2} y={ln.y + 26} textAnchor="middle" fontSize="9" fill="#b45309">not connected: line idles high</text> : null}
          </g>
        );
      })}
      {showBits ? bits.map((bit, i) => {
        const x0 = X(anchor.t + i * tb), x1 = X(anchor.t + (i + 1) * tb);
        const ly = anchor.dir === "tx" ? 26 : 100;
        const lab = i === 0 ? "S" : i <= anchor.f.bits ? String(i - 1) : anchor.f.parity && i === anchor.f.bits + 1 ? "P" : "T";
        return <g key={i}><line x1={x0} x2={x0} y1={ly + 2} y2={ly + 46} stroke="#e2e8f0" /><text x={(x0 + x1) / 2} y={ly - 2} textAnchor="middle" fontSize="7.5" fill={bit ? "#0f2547" : "#64748b"}>{lab}</text></g>;
      }) : null}
      {p.view !== "frame" ? visible.slice(-24).map((fr) => {
        const ly = fr.dir === "tx" ? 26 : 100;
        const x = X((fr.t + fr.end) / 2);
        return x > l + 8 && x < l + w - 8 ? <text key={fr.id} x={x} y={ly - 2} textAnchor="middle" fontSize="7.5" fontWeight="700" fill={fr.dir === "tx" ? "#15803d" : "#1659c7"}>{charName(fr.byte)}</text> : null;
      }) : null}
      <text x={l} y={ph - 4} fontSize="8.5" fill="#64748b">{(a * 1000).toFixed(3)} ms</text>
      <text x={l + w} y={ph - 4} textAnchor="end" fontSize="8.5" fill="#64748b">{(b * 1000).toFixed(3)} ms · {usStr(b - a)} window</text>
      {!f.frames.length ? <text x={l + w / 2} y={88} textAnchor="middle" fontSize="10" fill="#94a3b8">Line idle (high): no frames yet.</text> : null}
    </svg>
  );
}

type LTab = "overview" | "tasks" | "theory" | "resources";
const NO_SEEN = { frame: false, config: false, talk: false, wave: false, cmd: false, mismatch: false, fault: false };
const QUICK = ["help", "temp", "led on", "led off", "echo Hello Microcontroller Studio!"];

export default function L29({ meta }: { meta: LabMeta }) {
  const lab = useLab<P29>({ slug: meta.slug, code: DEMO, params: P29_DEFAULT, mcu: () => ({ family: "esp32", ips: 400_000 }), world: world29 });
  const { mcu, params } = lab;
  const fw = mcu.fw;
  const f = front(mcu);
  const [ltab, setLtab] = useState<LTab>("overview");
  const [sel, setSel] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [hist, setHist] = useState<string[]>([]);
  const [hi, setHi] = useState(-1);
  const [auto, setAuto] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const conRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (pending !== null && lab.code === pending) { setPending(null); lab.run(); } }, [pending, lab]);
  useEffect(() => { if (!msg) return; const id = window.setTimeout(() => setMsg(""), 4000); return () => window.clearTimeout(id); }, [msg]);

  const begun = mcu.uart.port !== "";
  const codeBaud = Number(codeDef(lab.code, "UART_BAUD"));
  const codeFrame = parseConfig(codeDef(lab.code, "UART_CONFIG"));
  const baud = begun ? mcu.uart.baud : Number.isFinite(codeBaud) && codeBaud > 0 ? codeBaud : 9600;
  const frame: UartFrame = begun ? mcu.uart.frame : codeFrame ?? { bits: 8, parity: 0, stop: 1 };
  const wr = wiring(mcu);
  const txPin = begun ? wr.tx : Number(codeDef(lab.code, "TX_PIN")) || 17;
  const rxPin = begun ? wr.rx : Number(codeDef(lab.code, "RX_PIN")) || 16;
  const termFrame = fmtFrame(params.termFmt);
  const now = mcu.now;
  const txActive = lab.running && f.lastTx > now - 0.06 && f.lastTx > 0;
  const rxActive = lab.running && f.termBusy > now - 0.06 && f.lastSend >= 0;
  const errsTerm = f.stats.termFrameErr + f.stats.termParityErr;
  const baudOff = Math.abs(baud - params.termBaud) / params.termBaud * 100;
  const mismatchBaud = begun && baud !== params.termBaud;
  const mismatchFmt = begun && !sameFrame(frame, termFrame);
  const rxDead = params.swap || params.rxOpen;

  const writeDef = (k: CodeKey, text: string) => {
    if (codeDef(lab.code, k) === null) { setMsg(`#define ${k} was not found in the code: edit Serial2.begin() directly.`); return; }
    const next = setCodeDef(lab.code, k, text);
    lab.setCode(next);
    setPending(next);
  };
  const setFrame = (patch: Partial<UartFrame>) => writeDef("UART_CONFIG", configName({ ...frame, ...patch }));

  const tx = (text: string) => {
    const t = text.replace(/[\r\n]+$/, "");
    if (!fw) { setMsg("Press Run first: the ESP32 is not running."); return; }
    sendTerm(mcu, params, `${t}\n`);
    if (t) setHist((h) => [...h.filter((x) => x !== t), t].slice(-20));
    setHi(-1);
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); tx(input); setInput(""); }
    else if (e.key === "ArrowUp" && hist.length) { e.preventDefault(); const n = hi < 0 ? hist.length - 1 : Math.max(0, hi - 1); setHi(n); setInput(hist[n] ?? ""); }
    else if (e.key === "ArrowDown" && hi >= 0) { e.preventDefault(); const n = hi + 1; if (n >= hist.length) { setHi(-1); setInput(""); } else { setHi(n); setInput(hist[n] ?? ""); } }
  };

  const shown = monitor.filter((l) => params.filter === "both" || l.dir === "sys" || (params.filter === "rx" ? l.dir === "rx" : l.dir === "tx"));
  const lastKey = `${monitor.length}:${monitor[monitor.length - 1]?.text.length ?? 0}`;
  useEffect(() => { const el = conRef.current; if (auto && el) el.scrollTop = el.scrollHeight; }, [lastKey, auto, params.filter]);

  const past = f.frames.filter((r) => r.t <= now);
  const anchor = (sel !== null ? f.frames.find((r) => r.id === sel) : undefined) ?? past[past.length - 1];
  const chips = past.slice(-10);
  const bits = anchor ? frameBitList(anchor.byte, anchor.f) : frameBitList(0x41, frame);
  const fb = anchor?.f ?? frame;
  const aByte = anchor?.byte ?? 0x41;

  const noBegin = !!fw && !begun && mcu.uart.log.some((b) => b.dir === "tx");
  const noReply = !!fw && lab.running && f.lastSend > 0 && now - f.lastSend > 1.5 && f.lastReply < f.lastSend && !rxDead && !wr.problem && begun;
  const hints: Array<{ text: string; fix?: [string, () => void] }> = [];
  if (noBegin) hints.push({ text: "The program prints, but Serial2.begin() was never called: UART2 is not initialised, so nothing leaves the TX pin." });
  if (fw && begun && wr.problem) hints.push({ text: `${wr.problem} Pick another pin in Pin Mapping.` });
  if (fw && params.swap) hints.push({ text: "Nothing arrives in either direction: TX is wired to TX and RX to RX. UART needs a cross connection: ESP32 TX → adapter RXD, adapter TXD → ESP32 RX.", fix: ["Fix wiring", () => lab.setParam("swap", false)] });
  if (fw && params.rxOpen && !params.swap) hints.push({ text: `Output still works, but typed commands never reach the ESP32: the adapter TXD → GPIO${rxPin} wire is open.`, fix: ["Reconnect", () => lab.setParam("rxOpen", false)] });
  if (fw && errsTerm > 0 && mismatchBaud && !params.swap) hints.push({ text: `Garbled text with framing errors: the ESP32 sends at ${baudLabel(baud)} baud but the terminal samples at ${baudLabel(params.termBaud)} (${baudOff.toFixed(0)} % off). A UART receiver tolerates only about ±5 % in total.`, fix: [`Terminal to ${baudLabel(baud)}`, () => lab.setParam("termBaud", baud)] });
  else if (fw && errsTerm > 0 && mismatchFmt && !params.swap) hints.push({ text: `Same baud, but the ESP32 sends ${fmtName(frame)} frames and the terminal expects ${params.termFmt}: the extra or missing bit lands where the stop bit should be.`, fix: [`Terminal to ${fmtName(frame)}`, () => lab.setParam("termFmt", fmtName(frame))] });
  else if (fw && errsTerm > 0 && params.noise) hints.push({ text: `EMI glitches flip bits on the wire: ${errsTerm} character${errsTerm === 1 ? "" : "s"} failed the stop/parity check. Add parity (8E1 on both ends) to detect more of them, or shield and shorten the cable.`, fix: ["Remove EMI", () => lab.setParam("noise", false)] });
  if (noReply && !hints.length) hints.push({ text: "No reply to the last command after 1.5 s. Does the program read Serial2 and answer every command?" });
  if (!fw) hints.push({ text: "Press Run to flash the firmware. The configuration panel edits the code until then." });

  const ledOn = mcu.level("GPIO2") === 1 && !!fw;
  const [seen, setSeen] = useState(NO_SEEN);
  const flags = {
    frame: sel !== null,
    config: !!fw && begun && (baud !== 9600 || !sameFrame(frame, { bits: 8, parity: 0, stop: 1 })) && !mismatchBaud && !mismatchFmt && f.stats.rxBytes > 20 && errsTerm === 0 && !params.noise,
    talk: f.lastSend > 0 && f.lastReply > f.lastSend,
    wave: params.view !== "frame" && f.frames.length > 0,
    cmd: ledOn && f.stats.sent > 0,
    mismatch: errsTerm > 0 && (mismatchBaud || mismatchFmt),
    fault: !!fw && (params.swap || params.rxOpen || params.noise),
  };
  useEffect(() => {
    if ((Object.keys(flags) as Array<keyof typeof flags>).some((k) => flags[k] && !seen[k]))
      setSeen((o) => ({ frame: o.frame || flags.frame, config: o.config || flags.config, talk: o.talk || flags.talk, wave: o.wave || flags.wave, cmd: o.cmd || flags.cmd, mismatch: o.mismatch || flags.mismatch, fault: o.fault || flags.fault }));
  });
  const objectives: Array<[string, boolean]> = [
    ["Understand UART frame structure (start bit, data bits, parity, stop bit)", seen.frame],
    ["Configure baud rate, parity and stop bits", seen.config],
    ["Send and receive data between microcontroller and PC", seen.talk],
    ["Analyze TX/RX waveforms and frame format", seen.wave],
    ["Build a simple command-based interface (e.g., sensor data, LED control)", seen.cmd],
  ];
  const shellLab = { ...lab, resetLab: () => { lab.resetLab(); clearMonitor(); setLtab("overview"); setSel(null); setInput(""); setHist([]); setPending(null); setSeen(NO_SEEN); } };

  const status = !fw ? { cls: "off", title: "UART stopped", sub: "Press Run to flash the firmware." }
    : !begun ? { cls: "warn", title: "UART not initialised", sub: "Serial2.begin() has not run." }
    : wr.problem ? { cls: "bad", title: "Pin conflict", sub: wr.problem }
    : params.swap ? { cls: "bad", title: "Wiring fault", sub: "TX → TX: no cross connection." }
    : params.rxOpen ? { cls: "bad", title: "RX line open", sub: "Transmit only: commands are lost." }
    : mismatchBaud || mismatchFmt ? { cls: "warn", title: "Terminal mismatch", sub: `ESP32 ${baudLabel(baud)} ${fmtName(frame)} vs terminal ${baudLabel(params.termBaud)} ${params.termFmt}` }
    : params.noise ? { cls: "warn", title: "UART Ready (noisy line)", sub: `${errsTerm} bad character${errsTerm === 1 ? "" : "s"} so far` }
    : { cls: "ok", title: "UART Ready", sub: txActive && rxActive ? "Transmitting and receiving..." : txActive ? "Transmitting..." : rxActive ? "Receiving..." : "Idle: line held high (mark)" };

  const termFmts = (TERM_FORMATS as readonly string[]).includes(fmtName(frame)) ? TERM_FORMATS : [...TERM_FORMATS, fmtName(frame)];
  const nBits = frameBits(frame);
  const lastRx = monitor.filter((l) => l.dir === "rx").flatMap((l) => [...l.text]).slice(-8);

  return (
    <LabShell meta={meta} lab={shellLab} subtitle="Learn how to send and receive data using UART. Explore serial communication, frame format, and real-time data exchange."
      components={["ESP32 DevKit V1 (ESP32-WROOM-32, 3.3 V logic). UART2 via Serial2, routed through the GPIO matrix", "USB-serial adapter (CP2102) on a virtual COM3 port, crossed TX/RX wiring and common GND", "Blue LED on GPIO2", "One UART is modelled: Serial, Serial1 and Serial2 all drive this link"]}>
      <div className="mcl-grid mcl-l29-top">
        <Panel title="Circuit & Simulation" icon="sim" className="mcl-l29-hw">
          <Scene m={mcu} p={params} txPin={txPin} rxPin={rxPin} active={{ tx: txActive, rx: rxActive }} hasFw={!!fw} />
          <p className="mcl-l29-tip"><Icon name="bulb" size={14} />Tip: Connect TX to RX and RX to TX (cross connection).</p>
        </Panel>

        <div className="mcl-l29-mid">
          <Panel title="UART Signal Waveforms" icon="wave" className="mcl-l29-wave"
            tools={<select className="mcl-l29-sel" value={params.view} onChange={(e) => lab.setParam("view", e.target.value as P29["view"])} aria-label="Waveform time scale">
              <option value="frame">1 frame</option><option value="four">4 frames</option><option value="ms20">Last 20 ms</option>
            </select>}>
            <Waves m={mcu} p={params} anchor={anchor} txPin={txPin} rxPin={rxPin} rxDead={rxDead} />
          </Panel>
          <Panel title={`UART Frame Visualization (${hex2(aByte)} '${charName(aByte)}')`} icon="table" className="mcl-l29-frame">
            <div className="mcl-l29-cells" style={{ gridTemplateColumns: `repeat(${bits.length}, minmax(0, 1fr))` }}>
              {bits.map((b, i) => {
                const kind = i === 0 ? "start" : i <= fb.bits ? "data" : fb.parity && i === fb.bits + 1 ? "par" : "stop";
                return <span key={i} className={`mcl-l29-cell ${kind}`} title={kind === "data" ? `D${i - 1}` : kind}>{b}</span>;
              })}
            </div>
            <div className="mcl-l29-caps" style={{ gridTemplateColumns: `1fr ${fb.bits}fr ${fb.parity ? "1fr " : ""}${fb.stop}fr` }}>
              <span>Start Bit<br />(1)</span><span>Data Bits ({fb.bits} bits, LSB first)</span>{fb.parity ? <span>Parity<br />({PARITY[fb.parity]})</span> : null}<span>Stop Bit{fb.stop > 1 ? "s" : ""}<br />({fb.stop})</span>
            </div>
            <div className="mcl-l29-chips" role="listbox" aria-label="Recent frames">
              <button type="button" className={sel === null ? "on" : ""} onClick={() => setSel(null)}>Live</button>
              {chips.map((c) => (
                <button key={c.id} type="button" role="option" aria-selected={sel === c.id} className={`${c.dir} ${sel === c.id ? "on" : ""} ${c.result && (c.result.frameErr || c.result.parityErr) ? "err" : ""}`} onClick={() => setSel(c.id)} title={`${c.dir === "tx" ? "ESP32 → PC" : "PC → ESP32"} ${hex2(c.byte)}`}>
                  {c.dir === "tx" ? "TX" : "RX"} {charName(c.byte)}
                </button>
              ))}
            </div>
            <p className="mcl-l29-sub">
              {anchor ? <>{anchor.dir === "tx" ? "ESP32 → terminal" : "terminal → ESP32"} · {baudLabel(anchor.baud)} {fmtName(anchor.f)} · bit {usStr(1 / anchor.baud)} · frame {usStr(anchor.end - anchor.t)}
                {anchor.result ? <> · {anchor.dir === "tx" ? "terminal" : "ESP32"} read <b className={anchor.result.frameErr || anchor.result.parityErr ? "bad" : "ok"}>{hex2(anchor.result.byte)} {anchor.result.frameErr ? "framing error" : anchor.result.parityErr ? "parity error" : "OK"}</b></> : null}</>
                : <>Example frame for 'A' ({fmtName(frame)}). Run the program to capture real frames.</>}
            </p>
          </Panel>
        </div>

        <Panel title="UART Configuration" icon="sliders" className="mcl-l29-cfg">
          <div className="mcl-l29-grp">
          <div className="mcl-l29-form">
            <label className="mcl-l29-field"><span>Baud Rate</span>
              <select value={baud} onChange={(e) => writeDef("UART_BAUD", e.target.value)} aria-label="Baud rate">
                {(BAUDS as readonly number[]).includes(baud) ? null : <option value={baud}>{baudLabel(baud)}</option>}
                {BAUDS.map((b) => <option key={b} value={b}>{baudLabel(b)}</option>)}
              </select></label>
            <label className="mcl-l29-field"><span>Data Bits</span>
              <select value={frame.bits} onChange={(e) => setFrame({ bits: Number(e.target.value) })} aria-label="Data bits">
                {[5, 6, 7, 8].map((b) => <option key={b} value={b}>{b}</option>)}
              </select></label>
            <label className="mcl-l29-field"><span>Parity</span>
              <select value={frame.parity} onChange={(e) => setFrame({ parity: Number(e.target.value) as UartFrame["parity"] })} aria-label="Parity">
                {PARITY.map((pp, i) => <option key={pp} value={i}>{pp}</option>)}
              </select></label>
            <label className="mcl-l29-field"><span>Stop Bits</span>
              <select value={frame.stop} onChange={(e) => setFrame({ stop: Number(e.target.value) })} aria-label="Stop bits">
                {[1, 2].map((s) => <option key={s} value={s}>{s}</option>)}
              </select></label>
          </div>
          <div className={`mcl-l29-status ${status.cls}`}>
            <Icon name={status.cls === "ok" ? "check" : status.cls === "off" ? "power" : "alert"} size={16} />
            <div><b>{status.title}</b><span>{status.sub}</span></div>
          </div>
          <p className="mcl-l29-sub">{nBits} bits per frame · bit time {usStr(1 / baud)} · max {Math.floor(throughput(baud, frame)).toLocaleString("en-US")} bytes/s</p>
          </div>
          <div className="mcl-l29-grp">
          <h3 className="mcl-l29-h">Pin Mapping (ESP32 DevKit V1)</h3>
          <div className="mcl-l29-form two">
            <label className="mcl-l29-field"><span>TX Pin</span>
              <select value={txPin} onChange={(e) => writeDef("TX_PIN", e.target.value)} aria-label="TX pin">
                {(TX_PINS as readonly number[]).includes(txPin) ? null : <option value={txPin}>{pinLabel(txPin)}</option>}
                {TX_PINS.map((g) => <option key={g} value={g}>{pinLabel(g)}</option>)}
              </select></label>
            <label className="mcl-l29-field"><span>RX Pin</span>
              <select value={rxPin} onChange={(e) => writeDef("RX_PIN", e.target.value)} aria-label="RX pin">
                {(RX_PINS as readonly number[]).includes(rxPin) ? null : <option value={rxPin}>{pinLabel(rxPin)}</option>}
                {RX_PINS.map((g) => <option key={g} value={g}>{pinLabel(g)}</option>)}
              </select></label>
          </div>
          {msg ? <p className="mcl-g2-hint">{msg}</p> : null}
          {lab.dirty && !pending ? <p className="mcl-l29-sub">The editor has unflashed changes: press Run to apply them.</p> : null}
          </div>
          <div className="mcl-g2-faults">
            <b><Icon name="bug" size={14} />Fault injection</b>
            <Toggle label="TX/RX straight-through" checked={params.swap} onChange={(v) => lab.setParam("swap", v)} hint="TX → TXD and RX → RXD: two outputs face each other and neither receiver hears anything" />
            <Toggle label="RX wire open" checked={params.rxOpen} onChange={(v) => lab.setParam("rxOpen", v)} hint="The ESP32 still talks, but nothing typed in the terminal reaches it" />
            <Toggle label="EMI on the cable" checked={params.noise} onChange={(v) => lab.setParam("noise", v)} hint="Short glitches flip about 3 % of bits at the sampling point" />
          </div>
        </Panel>
      </div>

      <div className="mcl-grid mcl-l29-bot">
        <CodeEditor lab={lab} languages={[{ label: "C++ (Arduino)", code: DEMO }, { label: "Byte echo", code: ECHO }, { label: "Sensor stream", code: STREAM }, { label: "Bug: baud mismatch", code: BUG_BAUD }, { label: "Bug: parity mismatch", code: BUG_PARITY }]} />

        <Panel title="Serial Monitor" icon="terminal" className="mcl-l29-mon">
          <div className="mcl-l29-montools">
            <button type="button" onClick={clearMonitor}><Icon name="x" size={13} />Clear</button>
            <label><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />Auto-scroll</label>
            <select value={params.filter} onChange={(e) => lab.setParam("filter", e.target.value as P29["filter"])} aria-label="Monitor filter">
              <option value="both">Both (TX &amp; RX)</option><option value="rx">From ESP32 only</option><option value="tx">Sent only</option>
            </select>
          </div>
          <div className="mcl-l29-montools term">
            <span>COM3</span>
            <select value={params.termBaud} onChange={(e) => lab.setParam("termBaud", Number(e.target.value))} aria-label="Terminal baud rate">
              {BAUDS.map((b) => <option key={b} value={b}>{baudLabel(b)} baud</option>)}
            </select>
            <select value={params.termFmt} onChange={(e) => lab.setParam("termFmt", e.target.value)} aria-label="Terminal frame format">
              {termFmts.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="mcl-l29-console" ref={conRef} role="log" aria-live="polite" aria-label="Serial monitor output">
            {shown.length ? shown.map((l, i) => (
              <div key={i} className={`mcl-l29-ln ${l.dir}`}>
                {l.dir === "tx" ? <span className="pfx">&gt; </span> : null}
                {l.errs.length ? [...l.text].map((c, k) => <span key={k} className={l.errs.includes(k) ? "err" : undefined}>{c}</span>) : l.text}
                {l.dir === "rx" && l.open && i === shown.length - 1 ? <span className="cur">█</span> : null}
              </div>
            )) : <div className="mcl-l29-ln sys">{fw ? "Waiting for data..." : "Port closed: press Run."}</div>}
          </div>
          {hints.map((h) => (
            <p key={h.text} className="mcl-g2-hint mcl-l29-hint"><Icon name="alert" size={14} /><span>{h.text}</span>{h.fix ? <button type="button" onClick={h.fix[1]}>{h.fix[0]}</button> : null}</p>
          ))}
          <div className="mcl-l29-send">
            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={onKey} placeholder="Type a command and press Enter..." aria-label="Command to send" maxLength={120} />
            <button type="button" onClick={() => { tx(input); setInput(""); }}>Send</button>
          </div>
          <div className="mcl-l29-quick">
            {QUICK.map((q) => <button key={q} type="button" onClick={() => tx(q)}>{q.length > 14 ? `${q.slice(0, 12)}…` : q}</button>)}
          </div>
          <p className="mcl-l29-sub">Newline (\n) appended · ESP32 sent {f.stats.txBytes} B · terminal read {f.stats.rxBytes} B ({errsTerm} bad) · typed {f.stats.sent} B{f.stats.mcuFrameErr ? ` · ESP32 framing errors ${f.stats.mcuFrameErr}` : ""}</p>
        </Panel>

        <Panel title="Learning Notes & Tasks" icon="book" className="mcl-l29-notes">
          <div className="mcl-tabs mcl-l29-tabs" role="tablist">
            {([["overview", "Overview"], ["tasks", "Tasks"], ["theory", "Theory"], ["resources", "Resources"]] as const).map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={ltab === k} className={ltab === k ? "on" : ""} onClick={() => setLtab(k)}>{l}</button>)}
          </div>

          {ltab === "overview" ? (
            <div className="mcl-l29-learn">
              <h3><Icon name="book" size={14} />About This Lab</h3>
              <p>UART (Universal Asynchronous Receiver Transmitter) is a widely used protocol for serial communication. In this lab, you'll learn how to configure UART, send and receive data, and visualize the serial frames and signals in real time.</p>
              <h4>Key Learning Objectives</h4>
              <ul className="mcl-checks">
                {objectives.map(([l, d]) => <li key={l} className={d ? "done" : ""}><Icon name={d ? "check" : "target"} size={14} />{l}</li>)}
              </ul>
              <div className="mcl-l29-next"><Icon name="flag" size={15} /><div><b>Next Step</b><span>Try modifying the code to send data from a simulated sensor periodically (e.g., every 2 seconds). Load "Sensor stream" for a starting point.</span></div></div>
            </div>
          ) : null}

          {ltab === "tasks" ? (
            <div className="mcl-l29-learn">
              <ol className="mcl-steps">
                {([
                  ["Observe", "Run the example: the banner appears in the Serial Monitor. Each character is one frame: start bit, 8 data bits LSB first, stop bit."],
                  ["Try", "Type help, temp, led on and echo hello. Your command travels on the RX lane, the reply on the TX lane, and led on lights the blue D2 LED."],
                  ["Measure", `Now: ${baudLabel(baud)} baud ${fmtName(frame)} → bit ${usStr(1 / baud)}, frame ${usStr(nBits / baud)}, at most ${Math.floor(throughput(baud, frame))} bytes/s. Click a frame chip and read its bits.`],
                  ["Modify", "Set the baud rate to 115200 in UART Configuration: the code is rewritten and re-flashed, but the terminal still listens at 9600. Read the garbage, then match the terminal."],
                  ["Run Again", "Load Bug: parity mismatch and fix it from either end. Then try the three faults and explain each symptom from the waveforms."],
                ] as const).map(([k, v]) => <li key={k}><b>{k}</b><span>{v}</span></li>)}
              </ol>
              <ul className="mcl-checks">
                <li className={seen.mismatch ? "done" : ""}><Icon name={seen.mismatch ? "check" : "target"} size={14} />Reproduced a baud or frame-format mismatch</li>
                <li className={seen.fault ? "done" : ""}><Icon name={seen.fault ? "check" : "target"} size={14} />Injected a wiring or EMI fault</li>
              </ul>
              <p className="mcl-challenge"><b>Challenge:</b> Add a "blink &lt;n&gt;" command that flashes the LED n times and replies "OK" when done.</p>
            </div>
          ) : null}

          {ltab === "theory" ? (
            <div className="mcl-l29-learn">
              <p>UART has no clock wire. Both ends agree on the baud rate in advance; the receiver waits for the falling edge of the start bit, then samples each bit in its centre.</p>
              <dl className="mcl-l29-fx">
                <div><dt>Bit time</dt><dd>1 / {baudLabel(baud)} = {usStr(1 / baud)}</dd></div>
                <div><dt>Frame</dt><dd>1 start + {frame.bits} data{frame.parity ? " + 1 parity" : ""} + {frame.stop} stop = {nBits} bits = {usStr(nBits / baud)}</dd></div>
                <div><dt>Throughput</dt><dd>{baudLabel(baud)} / {nBits} = {Math.floor(throughput(baud, frame)).toLocaleString("en-US")} bytes/s</dd></div>
                <div><dt>Parity</dt><dd>Even: the parity bit makes the count of 1s even. Odd: odd. It detects any single flipped bit.</dd></div>
                <div><dt>Baud error</dt><dd>By the last bit the sampling point drifts 9.5 × the error; past about ±5 % it leaves the bit. Now {mismatchBaud ? `${baudOff.toFixed(1)} % between ESP32 and terminal` : "0 %: both ends match"}.</dd></div>
              </dl>
              <h4>Error types</h4>
              <ul className="mcl-l29-ul">
                <li><b>Framing error</b>: the stop bit was read as 0 (baud or format mismatch, noise).</li>
                <li><b>Parity error</b>: the parity bit does not match the data.</li>
                <li><b>Overrun</b>: bytes arrive faster than the program reads them; the ESP32 buffers 128 bytes in hardware and 256 in the driver.</li>
              </ul>
            </div>
          ) : null}

          {ltab === "resources" ? (
            <div className="mcl-l29-learn">
              <table className="mcl-l22-table mcl-l29-table">
                <thead><tr><th>UART</th><th>Arduino</th><th>Default TX / RX</th><th>Note</th></tr></thead>
                <tbody>
                  <tr><td>UART0</td><td>Serial</td><td>GPIO1 / GPIO3</td><td>USB bridge, boot log</td></tr>
                  <tr><td>UART1</td><td>Serial1</td><td>GPIO10 / GPIO9</td><td>Flash pins: remap first</td></tr>
                  <tr className={mcu.uart.port === "Serial2" ? "on" : ""}><td>UART2</td><td>Serial2</td><td>GPIO17 / GPIO16</td><td>Used in this lab</td></tr>
                </tbody>
              </table>
              <h4>Last characters received by the terminal</h4>
              {lastRx.length ? (
                <table className="mcl-l22-table mcl-l29-table mono">
                  <thead><tr><th>Char</th><th>Hex</th><th>Dec</th><th>Binary</th></tr></thead>
                  <tbody>{lastRx.map((c, i) => { const b = c.charCodeAt(0) & 0xff; return <tr key={i}><td>{c === "\uFFFD" ? "error" : charName(b)}</td><td>{c === "\uFFFD" ? "—" : hex2(b)}</td><td>{c === "\uFFFD" ? "—" : b}</td><td>{c === "\uFFFD" ? "—" : b.toString(2).padStart(8, "0")}</td></tr>; })}</tbody>
                </table>
              ) : <p className="mcl-l29-sub">Nothing received yet.</p>}
              <h4>Arduino API</h4>
              <ul className="mcl-l29-ul mono">
                <li>Serial2.begin(baud, SERIAL_8N1, rxPin, txPin)</li>
                <li>Serial2.available() / read() / readStringUntil('\n')</li>
                <li>Serial2.print(x) / println(x) / write(byte)</li>
                <li>Serial2.setTimeout(ms): readString timeout (1000 ms)</li>
              </ul>
            </div>
          ) : null}
        </Panel>
      </div>
    </LabShell>
  );
}
