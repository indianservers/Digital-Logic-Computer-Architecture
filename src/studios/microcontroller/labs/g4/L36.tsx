import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useLab } from "../core/useLab";
import type { LabMeta } from "../registry";
import { CodeEditor } from "../ui/CodeEditor";
import { Icon } from "../ui/Icon";
import { LearningNotes, Panel, Toggle } from "../ui/Panels";
import { Scope, type Trace } from "../ui/Scope";
import { LabShell } from "../ui/Shell";
import {
  CABLES, clearEvents, codeField, COL_PINS, DEMO, DETENTS_PER_REV, encIdle, EV, evText, front, fwArray, isClosed, KEYS, mcu36, P36_DEFAULT, press36, PULLUP_OHM, riseTime,
  ROW_PINS, ROW_RELEASE_LINE, scanRate, setCodeField, trueDetents, turn36, VARIANTS, world36, type Cause, type FieldKey, type P36,
} from "./L36sim";

const SCANS = [1, 2, 5, 10, 20];
const DEBOUNCES = [0, 2, 5, 10, 20, 50];
const SETTLES = [0, 2, 5, 10, 20];
const BOUNCES = [0, 2, 5, 10];
const READ_LINE = "    for (int c = 0; c < 4; c++) raw[r * 4 + c] = !HAL_GPIO_ReadPin(GPIOC, COL_PIN[c]);\n";
const RECENT = 8;
const DEG_PER_DETENT = 360 / DETENTS_PER_REV;
const fmtUs = (s: number) => `${(s * 1e6).toFixed(s < 1e-5 ? 1 : 0)} µs`;
const fmtMs = (s: number) => `${(s * 1e3).toFixed(s < 0.01 ? 1 : 0)} ms`;
const fmtHz = (hz: number) => (hz >= 995 ? `${(hz / 1000).toFixed(2)} kHz` : `${hz.toFixed(0)} Hz`);
const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
const KEY_OF: Record<string, number> = Object.fromEntries(KEYS.map((k, i) => [k, i]));
const capture = (e: PointerEvent<Element>) => { try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ } };

const NO_SEEN = { clean: false, bounce: false, enc: false, btn: false, ghost: false, fix: false, skip: false };
type Seen = typeof NO_SEEN;

export default function L36({ meta }: { meta: LabMeta }) {
  const lab = useLab<P36>({ slug: meta.slug, code: DEMO, params: P36_DEFAULT, mcu: mcu36, world: world36 });
  const { mcu, params: p } = lab;
  const fw = mcu.fw;
  const f = front(mcu);
  const now = mcu.now;
  const [pending, setPending] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [seen, setSeen] = useState<Seen>(NO_SEEN);
  const [failSeen, setFailSeen] = useState(false);
  const evRef = useRef<HTMLOListElement>(null);
  const drag = useRef<{ id: number; last: number; acc: number } | null>(null);
  const knobRef = useRef<SVGSVGElement>(null);
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
  const scanMs = num("scan", 1), debMs = num("debounce", 20), settleUs = num("settle", 5);
  const pull = cf("pull") ?? "GPIO_PULLUP";
  const cable = CABLES[p.cable] ?? CABLES[1]!;
  const rise = riseTime(cable.pf);
  const fixSettle = p.cable === 2 ? 20 : 5;

  /* ---------------- input actions ---------------- */
  const wanted = (k: number) => { for (let i = f.req.length - 1; i >= 0; i--) if (f.req[i]!.k === k) return f.req[i]!.down; return k === 16 ? f.btn.down : f.keys[k]!.down; };
  const keyDown = (k: number) => { if (p.latch) press36(mcu, k, !wanted(k)); else if (!wanted(k)) press36(mcu, k, true); };
  const keyUp = (k: number) => { if (!p.latch && wanted(k)) press36(mcu, k, false); };
  const releaseAll = () => { for (let k = 0; k < 16; k++) if (wanted(k)) press36(mcu, k, false); };
  const anyHeld = f.keys.some((_, k) => wanted(k));
  const onPadKey = (e: KeyboardEvent, down: boolean) => {
    const k = KEY_OF[e.key.toUpperCase()];
    if (k === undefined || e.ctrlKey || e.metaKey || e.altKey) return;
    e.preventDefault();
    if (e.repeat) return;
    if (down) keyDown(k); else keyUp(k);
  };
  const angleOf = (e: PointerEvent) => { const r = knobRef.current!.getBoundingClientRect(); return (Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180) / Math.PI; };
  const knobDown = (e: PointerEvent<SVGElement>) => { capture(e); drag.current = { id: e.pointerId, last: angleOf(e), acc: 0 }; };
  const knobMove = (e: PointerEvent<SVGElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const a = angleOf(e);
    let delta = a - d.last;
    if (delta > 180) delta -= 360; else if (delta < -180) delta += 360;
    d.last = a; d.acc += delta;
    const n = Math.trunc(d.acc / DEG_PER_DETENT);
    if (n) { turn36(mcu, n, true); d.acc -= n * DEG_PER_DETENT; }
  };
  const knobUp = () => { drag.current = null; };
  const knobKey = (e: KeyboardEvent) => { if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); turn36(mcu, 1); } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); turn36(mcu, -1); } };

  /* ---------------- derived state ---------------- */
  const rate = fw ? scanRate(f, now) : 0;
  const fwKeys = f.fwDown.map((d, i) => (d ? KEYS[i]! : "")).filter(Boolean);
  const truth = trueDetents(f);
  const idle = encIdle(f, now);
  const reversed = !!fw && idle && truth !== 0 && f.fwEnc === -truth && Math.abs(truth) >= 2;
  const lost = !!fw && idle && !reversed && f.fwEnc !== truth;
  const recentSkip = f.enc.skips > 0 && now - f.enc.lastSkip < RECENT;
  const recent = (c: Cause) => f.causeT[c] >= 0 && now - f.causeT[c] < RECENT;
  const phantomNow = f.fwDown.some((d, k) => d && !f.keys[k]!.down && !(f.keys[k]!.relT >= 0 && now - f.keys[k]!.relT < 0.1));
  const lp = f.lastPhantom;
  const ld = f.lastDup;
  const raw = fw ? fwArray(mcu, "raw") : null;
  const state = fw ? fwArray(mcu, "state") : null;

  const hints: Array<{ text: string; tone?: "info"; fix?: Array<[string, () => void]> }> = [];
  if (!fw) hints.push({ text: "Press Run: the firmware scans the 4 × 4 keypad, the encoder and its button once per millisecond and pushes every decoded change as an event.", tone: "info" });
  if (fw && ld && now - ld.t < RECENT) hints.push({ text: `${ld.k === 16 ? "The button" : `Key ${KEYS[ld.k]}`} was reported ${ld.n} times for one press. The contacts bounce for about ${p.bounce} ms and DEBOUNCE_MS = ${debMs} accepts every bounce as a new press. A key must read the same for longer than it bounces.`, fix: debMs < 10 ? [["DEBOUNCE_MS = 20", () => edit("debounce", "20")]] : undefined });
  if (fw && lp && (recent("stale") || (phantomNow && lp.cause === "stale"))) hints.push({ text: `Key ${KEYS[lp.k]} fired without being pressed: it is the key below one you pressed. When a row is released, its column climbs back through the ${PULLUP_OHM / 1000} kΩ pull-up and ${cable.pf} pF of wiring, which takes ${fmtUs(rise)}. With SETTLE_US = ${settleUs} the next row reads the column before it is high again.`, fix: [[`SETTLE_US = ${fixSettle}`, () => edit("settle", String(fixSettle))]] });
  if (fw && (recent("floating") || (phantomNow && lp?.cause === "floating"))) hints.push({ text: `Keys fire on their own: COL_PULL = ${pull}, so an unpressed column is not held high. It floats and keeps whatever charge it had, so a whole column reads as pressed for seconds at a time.`, fix: [["COL_PULL = GPIO_PULLUP", () => edit("pull", "GPIO_PULLUP")]] });
  if (fw && (recent("rows") || (phantomNow && lp?.cause === "rows"))) hints.push({ text: "One key fires its whole column: the scan drives each row low but never sets it high again, so after one pass all four rows are low and a pressed key pulls its column low in every row.", fix: [["Release the row", () => loadCode(lab.code.includes(READ_LINE) && !lab.code.includes(ROW_RELEASE_LINE) ? lab.code.replace(READ_LINE, READ_LINE + ROW_RELEASE_LINE) : DEMO)]] });
  if (fw && (recent("ghost") || (phantomNow && lp?.cause === "ghost"))) hints.push({ text: `Ghost key ${lp ? KEYS[lp.k] : ""}: three held keys on the corners of a rectangle connect the fourth corner's row and column through the other three switches. The firmware cannot tell it apart from a real press. A diode in series with every key blocks the backward path.`, fix: [["Fit a diode per key", () => lab.setParam("diodes", true)], ["Release all keys", releaseAll]] });
  if (fw && recentSkip) hints.push({ text: `The encoder moved two or more quadrature states between two samples (${f.enc.skips} times). With SCAN_MS = ${scanMs} the firmware samples every ${scanMs} ms, but at ${Math.abs(p.spin) || "this"} detents/s a state lasts ${p.spin ? fmtMs(1 / (4 * Math.abs(p.spin))) : "less than that"}. The decoder cannot tell which way it went, so steps are lost or counted backwards.`, fix: scanMs > 1 ? [["SCAN_MS = 1", () => edit("scan", "1")]] : [["Slow the spin", () => lab.setParam("spin", Math.sign(p.spin) * 40)]] });
  if (reversed) hints.push({ text: `The knob turned ${signed(truth)} detents but the firmware counted ${signed(f.fwEnc)}: channels A and B are swapped, so every transition decodes in the opposite direction.`, fix: [["Swap A and B back", () => loadCode(setCodeField(setCodeField(lab.code, "encA", "GPIO_PIN_0"), "encB", "GPIO_PIN_1"))]] });
  else if (lost && !recentSkip) hints.push({ text: `The knob is at ${signed(truth)} detents but the firmware counted ${signed(f.fwEnc)}: steps were lost while it turned faster than the scan could follow.`, fix: scanMs > 1 ? [["SCAN_MS = 1", () => edit("scan", "1")]] : undefined });
  if (fw && debMs >= 50) hints.push({ text: `DEBOUNCE_MS = ${debMs}: every press is delayed by at least ${debMs} ms and quick double-taps merge into one. 10-20 ms covers the bounce of most keys.`, tone: "info", fix: [["DEBOUNCE_MS = 20", () => edit("debounce", "20")]] });
  const problems = hints.filter((x) => x.tone !== "info");

  useEffect(() => { if (problems.length) setFailSeen(true); }, [problems.length]);
  const encEvents = f.events.filter((e) => e.type === EV.EV_ENCODER);
  const flags: Seen = {
    clean: f.events.some((e) => e.type === EV.EV_KEY_DOWN && e.latency !== undefined),
    bounce: p.view === "deb" && f.keys[p.sel]!.edges.length > 3 && p.bounce > 0,
    enc: encEvents.some((e) => e.code > 0) && encEvents.some((e) => e.code < 0),
    btn: f.events.some((e) => e.type === EV.EV_BUTTON && e.code === 1),
    ghost: f.causes.ghost > 0,
    fix: failSeen && !problems.length && !!fw,
    skip: f.enc.skips > 0,
  };
  useEffect(() => {
    const ks = Object.keys(flags) as Array<keyof Seen>;
    if (ks.some((k) => flags[k] && !seen[k])) setSeen((o) => { const n = { ...o }; for (const k of ks) n[k] = o[k] || flags[k]; return n; });
  });

  const events = f.events.slice(-40);
  const lastKey = `${events.length}:${events[events.length - 1]?.id ?? 0}`;
  useEffect(() => { const el = evRef.current; if (el) el.scrollTop = el.scrollHeight; }, [lastKey]);

  const shellLab = { ...lab, resetLab: () => { lab.resetLab(); setPending(null); setSeen(NO_SEEN); setFailSeen(false); } };
  const custom = !VARIANTS.some((x) => x.code === lab.compiledCode);

  /* ---------------- timing view ---------------- */
  const sel = Math.max(0, Math.min(15, p.sel));
  const kc = f.keys[sel]!;
  let traces: Trace[] = [];
  let right = now, win = 0.06, ariaScope = "", readout = "";
  const markers: Array<{ t: number; label: string; color?: string }> = [];
  if (p.view === "scan") {
    const starts = f.scanStarts;
    const last = starts[starts.length - 1] ?? 0;
    win = 70e-6;
    right = Math.min(now, last + 58e-6);
    traces = ROW_PINS.map((k, r) => ({ label: `Row ${r} (${k})`, color: ["#ef4444", "#22c55e", "#3b82f6", "#f59e0b"][r]!, edges: mcu.edges.get(k) ?? [], initial: 1 }));
    ariaScope = "Row drive signals during one keypad scan";
    readout = fw ? `Each row is driven low for ${settleUs} µs of settle time plus four column reads, one after the other. ${rate ? `${fmtHz(rate)} scan rate` : "Waiting for a scan"}. Column rise after a row is released: ${fmtUs(rise)}.` : "Press Run to see the rows being driven.";
  } else if (p.view === "enc") {
    const e = f.enc;
    win = 0.25;
    right = p.trig && idle && e.lastMove > 0 ? Math.min(now, e.lastMove + 0.06) : now;
    const pos = f.encTrace.filter(([t]) => t > right - win - 0.05);
    const vals = [...pos.map(([, v]) => v), f.fwEnc];
    traces = [
      { label: "A (PB0)", color: "#ef4444", edges: e.edgesA, initial: 1 },
      { label: "B (PB1)", color: "#22c55e", edges: e.edgesB, initial: 1 },
      { label: "Position", color: "#3b82f6", points: [...pos, [right, f.fwEnc]], step: true, min: Math.min(...vals) - 1, max: Math.max(...vals) + 1 },
    ];
    ariaScope = "Encoder channels A and B and the decoded position";
    readout = `Clockwise, A falls before B: 4 transitions per detent, ${DETENTS_PER_REV} detents per turn. Knob ${signed(truth)}, firmware ${signed(f.fwEnc)}${f.enc.skips ? `, ${f.enc.skips} skipped samples` : ""}.`;
  } else {
    const anchor = Math.max(kc.pressT, kc.relT);
    win = Math.max(0.03, (debMs + p.bounce) * 0.0016 + 0.014);
    right = p.trig && anchor > 0 ? Math.min(now, anchor + win * 0.82) : now;
    traces = [
      { label: "Contact", color: "#ef4444", edges: kc.edges, initial: 0 },
      { label: "Sampled", color: "#22c55e", edges: f.sampled[sel]!, initial: 0 },
      { label: "Debounced", color: "#3b82f6", edges: f.fwDeb[sel]!, initial: 0 },
    ];
    if (anchor > 0) markers.push({ t: anchor, label: kc.relT > kc.pressT ? "release" : "press", color: "#f59e0b" });
    const acc = f.fwDeb[sel]!.filter(([t]) => t > anchor - 1e-9 && t < anchor + 0.2)[0];
    if (acc && anchor > 0) markers.push({ t: acc[0], label: `+${fmtMs(acc[0] - anchor)}`, color: "#60a5fa" });
    const burst = kc.edges.filter(([t]) => t >= anchor - 1e-9 && t < anchor + 0.05);
    const burstLen = burst.length ? burst[burst.length - 1]![0] - anchor : 0;
    ariaScope = `Key ${KEYS[sel]}: contact, sampled and debounced signals`;
    readout = anchor > 0 ? `Key ${KEYS[sel]}: the contact changed ${burst.length} time${burst.length === 1 ? "" : "s"} in ${fmtMs(Math.max(0, burstLen))}. ${acc ? `The firmware accepted it ${fmtMs(acc[0] - anchor)} later.` : "Not accepted yet."}` : `Press key ${KEYS[sel]} to trigger the capture (or pick another key).`;
  }

  /* ---------------- render helpers ---------------- */
  const keyClass = (k: number) => {
    const held = f.keys[k]!.down, on = f.fwDown[k], contactNow = isClosed(f.keys[k]!, now);
    return `${held ? "held" : ""} ${on ? (held || now - f.keys[k]!.relT < 0.1 ? "on" : "ghost") : ""} ${contactNow && !held ? "chatter" : ""} ${k === sel ? "sel" : ""}`;
  };
  const knobAngle = (f.enc.q / 4) * DEG_PER_DETENT;
  const btnHeld = f.btn.down;

  const notesData = {
    takeaways: [
      "A matrix keypad needs 8 pins for 16 keys: drive one row low at a time and read which columns follow it.",
      "Mechanical contacts bounce for a few milliseconds. Accept a change only after it has read the same for longer than the bounce (here DEBOUNCE_MS).",
      "After a row is released, its column needs time to climb back through the pull-up. Read too soon and the key shows up in the next row too.",
      "Three keys on the corners of a rectangle make a fourth, ghost key, unless every key has a diode.",
      "A quadrature encoder gives two square waves 90° apart. The order of the edges gives the direction; sampling too slowly loses steps.",
    ],
    observe: "Press Run, then press and hold key 5. Watch KEY 5 DOWN appear about 20 ms later in Decoded Events, and the bouncing contact in Debounce & Scan Timing.",
    tryIt: "Turn the encoder with the arrow buttons or by dragging the knob, press its centre, and switch the timing view to Row scan and Encoder.",
    measure: `Now: ${fw ? `${fmtHz(rate)} scan, debounce ${debMs} ms, last key latency ${f.lastLatency > 0 ? fmtMs(f.lastLatency) : "–"}, encoder ${signed(f.fwEnc)} (knob ${signed(truth)}), ${f.dups} duplicate and ${f.phantoms} phantom key events` : "press Run"}.`,
    modify: "Set DEBOUNCE_MS to 0 and press a key. Switch to the 1 m cable and look for the key below. Spin the encoder at 120 detents/s with SCAN_MS = 10.",
    runAgain: "Load each bug example, read the hint and fix it, then check that every press gives exactly one DOWN and one UP.",
    challenge: "Find the longest SCAN_MS that still keeps the encoder exact at 60 detents/s, and the shortest DEBOUNCE_MS that never double-types with 10 ms of bounce.",
    question: "Why does a pressed key show up in the next row when the settle delay is too short, but never in the row before?",
  };
  const checks = [
    { label: "Press a key: one DOWN and one UP", done: seen.clean },
    { label: "Watch a key bounce in the timing view", done: seen.bounce },
    { label: "Turn the encoder both ways", done: seen.enc },
    { label: "Press the encoder button", done: seen.btn },
    { label: "Make a ghost key with three keys", done: seen.ghost },
    { label: "Lose encoder steps with a slow scan", done: seen.skip },
    { label: "Find and fix an input bug", done: seen.fix },
  ];
  const statusOk = !!fw && !problems.length;

  return (
    <LabShell meta={meta} lab={shellLab} subtitle="Matrix keypad scanning, rotary encoder, switches, debounce and event decoding."
      components={["STM32 Nucleo-F401RE (3.3 V)", "4 × 4 membrane keypad: rows PC0–PC3 (outputs), columns PC4–PC7 (inputs, internal pull-ups)", "KY-040 rotary encoder: A = PB0, B = PB1, push switch = PB2", "Optional 1N4148 diode per key"]}>
      <div className="mcl-grid mcl-g4-grid">
        <Panel title="Human Input Simulator" icon="grid" className="mcl-g4-vis">
          <div className="mcl-l36-stage">
            <div className="mcl-l36-padwrap">
              <div className="mcl-l36-pad" role="group" aria-label="4 by 4 keypad. Type 0-9, A-D, * or # to press keys" tabIndex={0} onKeyDown={(e) => onPadKey(e, true)} onKeyUp={(e) => onPadKey(e, false)}>
                {KEYS.map((label, k) => (
                  <button key={label} type="button" className={`mcl-l36-key ${keyClass(k)}`} aria-pressed={f.keys[k]!.down} aria-label={`Key ${label}`}
                    onPointerDown={(e) => { capture(e); lab.setParam("sel", k); keyDown(k); }}
                    onPointerUp={() => keyUp(k)} onPointerCancel={() => keyUp(k)}
                    onKeyDown={(e) => { if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); e.stopPropagation(); lab.setParam("sel", k); keyDown(k); } }}
                    onKeyUp={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); e.stopPropagation(); keyUp(k); } }}>
                    {label}
                  </button>
                ))}
              </div>
              <div className="mcl-l36-padfoot">
                <span>Rows PC0–PC3 · Columns PC4–PC7</span>
                {p.latch && anyHeld ? <button type="button" className="mcl-l31-btn" onClick={releaseAll}>Release all</button> : null}
              </div>
            </div>
            <div className="mcl-l36-encwrap">
              <svg ref={knobRef} viewBox="0 0 160 160" className="mcl-l36-knob" role="slider" tabIndex={0} aria-label="Rotary encoder. Drag or use the arrow keys to turn" aria-valuenow={truth} aria-valuetext={`${signed(truth)} detents`} onKeyDown={knobKey}>
                <g onPointerDown={knobDown} onPointerMove={knobMove} onPointerUp={knobUp} onPointerCancel={knobUp} style={{ cursor: "grab" }}>
                  <circle cx={80} cy={80} r={64} fill="#253447" stroke="#111c2b" strokeWidth={2} />
                  {Array.from({ length: DETENTS_PER_REV }, (_, i) => { const a = (i * DEG_PER_DETENT * Math.PI) / 180; return <line key={i} x1={80 + Math.sin(a) * 56} y1={80 - Math.cos(a) * 56} x2={80 + Math.sin(a) * 61} y2={80 - Math.cos(a) * 61} stroke="#4b5d76" strokeWidth={2} />; })}
                  <g transform={`rotate(${knobAngle} 80 80)`}><rect x={77} y={20} width={6} height={16} rx={3} fill="#e2e8f0" /></g>
                </g>
                <circle cx={80} cy={80} r={33} className={`mcl-l36-push ${btnHeld ? "held" : ""} ${f.fwBtn ? "on" : ""}`} role="button" tabIndex={0} aria-label="Encoder push button" aria-pressed={btnHeld}
                  onPointerDown={(e) => { e.stopPropagation(); capture(e); press36(mcu, 16, true); }} onPointerUp={() => press36(mcu, 16, false)} onPointerCancel={() => press36(mcu, 16, false)}
                  onKeyDown={(e) => { if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); e.stopPropagation(); press36(mcu, 16, true); } }}
                  onKeyUp={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); e.stopPropagation(); press36(mcu, 16, false); } }} />
              </svg>
              <b className="mcl-l36-enclbl">Rotary Encoder</b>
              <div className="mcl-l36-encbtns">
                <button type="button" className="mcl-l31-btn" aria-label="Turn one detent counter-clockwise" onClick={() => turn36(mcu, -1)}>−1</button>
                <span>{signed(truth)}</span>
                <button type="button" className="mcl-l31-btn" aria-label="Turn one detent clockwise" onClick={() => turn36(mcu, 1)}>+1</button>
              </div>
            </div>
          </div>
          <div className="mcl-l36-ctl">
            <label><span>Scan period</span><select value={scanMs} disabled={cf("scan") === null} aria-label="SCAN_MS" onChange={(e) => edit("scan", e.target.value)}>{opts(SCANS, scanMs).map((v) => <option key={v} value={v}>{v} ms ({1000 / v >= 1000 ? "1 kHz" : `${1000 / v} Hz`})</option>)}</select></label>
            <label><span>Debounce</span><select value={debMs} disabled={cf("debounce") === null} aria-label="DEBOUNCE_MS" onChange={(e) => edit("debounce", e.target.value)}>{opts(DEBOUNCES, debMs).map((v) => <option key={v} value={v}>{v ? `${v} ms` : "off"}</option>)}</select></label>
            <label><span>Settle</span><select value={settleUs} disabled={cf("settle") === null} aria-label="SETTLE_US" onChange={(e) => edit("settle", e.target.value)}>{opts(SETTLES, settleUs).map((v) => <option key={v} value={v}>{v} µs</option>)}</select></label>
            <label><span>Columns</span><select value={pull} disabled={cf("pull") === null} aria-label="COL_PULL" onChange={(e) => edit("pull", e.target.value)}><option value="GPIO_PULLUP">Pull-up</option><option value="GPIO_NOPULL">No pull (floating)</option>{pull !== "GPIO_PULLUP" && pull !== "GPIO_NOPULL" ? <option value={pull}>{pull}</option> : null}</select></label>
            <label><span>Contact bounce</span><select value={p.bounce} aria-label="Contact bounce" onChange={(e) => lab.setParam("bounce", Number(e.target.value))}>{BOUNCES.map((v) => <option key={v} value={v}>{v ? `${v} ms` : "none (ideal)"}</option>)}</select></label>
            <label><span>Wiring</span><select value={p.cable} aria-label="Keypad wiring" onChange={(e) => lab.setParam("cable", Number(e.target.value))}>{CABLES.map((c, i) => <option key={c.label} value={i}>{c.label}</option>)}</select></label>
          </div>
          <div className="mcl-l34-env mcl-l36-env">
            <label className="mcl-l31-temp"><span><Icon name="reset" size={13} />Spin</span><input type="range" min={-120} max={120} step={10} value={p.spin} aria-label="Continuous encoder spin in detents per second" onChange={(e) => lab.setParam("spin", Number(e.target.value))} /><b>{p.spin ? `${signed(p.spin)} /s` : "off"}</b></label>
            <div className="mcl-l34-faults mcl-l36-faults">
              <Toggle label="Hold keys" checked={p.latch} onChange={(x) => { lab.setParam("latch", x); if (!x) releaseAll(); }} hint="Clicks latch keys down so you can hold several at once" />
              <Toggle label="Diode per key" checked={p.diodes} onChange={(x) => lab.setParam("diodes", x)} hint="A diode in series with every switch blocks ghost paths" />
            </div>
          </div>
        </Panel>

        <Panel title="Decoded Events" icon="list" className="mcl-g4-cfg"
          tools={<button type="button" className="mcl-l31-btn" onClick={() => clearEvents(mcu)} disabled={!f.events.length}>Clear</button>}>
          <ol className="mcl-l36-events" ref={evRef} aria-label="Decoded input events" aria-live="polite">
            {events.map((e) => (
              <li key={e.id} className={e.flag ?? ""}>
                <b>{evText(e)}</b>
                <small>{e.t.toFixed(3)} s{e.latency !== undefined ? ` · +${fmtMs(e.latency)}` : ""}{e.flag === "dup" ? " · bounce" : e.flag === "phantom" ? ` · not pressed (${e.cause})` : e.flag === "bounce" ? " · while held" : ""}</small>
              </li>
            ))}
            {!events.length ? <li className="mcl-l36-empty">{fw ? "Press a key, turn the knob or press its button." : "Press Run to start the firmware."}</li> : null}
          </ol>
          <p className="mcl-l31-sub">{f.events.length} events from event_push() · {f.dups} from bounce · {f.phantoms} for keys nobody pressed</p>
        </Panel>

        <Panel title="Debounce & Scan Timing" icon="wave" className="mcl-g4-scope mcl-l32-scopep"
          tools={<>
            <label className="mcl-l31-inline"><span className="mcl-l31-lbl">View:</span><select value={p.view} aria-label="Timing view" onChange={(e) => lab.setParam("view", e.target.value)}><option value="deb">Debounce</option><option value="scan">Row scan</option><option value="enc">Encoder</option></select></label>
            {p.view === "deb" ? <label className="mcl-l31-inline"><span className="mcl-l31-lbl">Key:</span><select value={sel} aria-label="Key to capture" onChange={(e) => lab.setParam("sel", Number(e.target.value))}>{KEYS.map((k, i) => <option key={k} value={i}>{k}</option>)}</select></label> : null}
          </>}>
          <Scope traces={traces} now={right} window={win} lanes height={150} markers={markers} frame={lab.frame} ariaLabel={ariaScope} />
          <div className="mcl-l36-scopefoot">
            <p className="mcl-l31-sub">{readout}</p>
            {p.view !== "scan" ? <Toggle label="Trigger" checked={p.trig} onChange={(x) => lab.setParam("trig", x)} hint="Freeze the capture around the last press or turn" /> : null}
          </div>
        </Panel>

        <CodeEditor lab={lab} className="mcl-g4-code" languages={VARIANTS} />

        <Panel title="Input State" icon="activity" className="mcl-g4-mon">
          <dl className="mcl-l36-state">
            <div><dt>Pressed keys</dt><dd>{fw ? (fwKeys.length ? fwKeys.join(" ") : "none") : "–"}</dd></div>
            <div><dt>Encoder position</dt><dd>{fw ? signed(f.fwEnc) : "–"}</dd></div>
            <div><dt>Button</dt><dd>{fw ? (f.fwBtn ? "pressed" : "released") : "–"}</dd></div>
            <div><dt>Scan rate</dt><dd>{fw && rate ? fmtHz(rate) : "–"}</dd></div>
            <div><dt>Debounce</dt><dd>{debMs} ms</dd></div>
            <div><dt>Latency</dt><dd>{f.lastLatency > 0 ? fmtMs(f.lastLatency) : "–"}</dd></div>
          </dl>
          <div className="mcl-l36-matrix" role="table" aria-label="Key matrix: contact, raw sample and debounced state">
            {KEYS.map((label, k) => {
              const c = isClosed(f.keys[k]!, now), r = raw?.[k] ? 1 : 0, s = state?.[k] ? 1 : 0;
              return (
                <div key={label} role="cell" className={`${k === sel ? "sel" : ""} ${s && !f.keys[k]!.down ? "bad" : ""}`} title={`${label}: contact ${c ? "closed" : "open"}, raw ${r}, state ${s}`} onClick={() => lab.setParam("sel", k)}>
                  <b>{label}</b><span><i className={c ? "c" : ""} /><i className={r ? "r" : ""} /><i className={s ? "s" : ""} /></span>
                </div>
              );
            })}
          </div>
          <div className="mcl-l35-legend mcl-l36-legend"><span><i style={{ background: "#ef4444" }} />contact</span><span><i style={{ background: "#22c55e" }} />raw[]</span><span><i style={{ background: "#3b82f6" }} />state[]</span><span>{COL_PINS.length} columns · pull {pull === "GPIO_PULLUP" ? "up" : "none"} · rise {fmtUs(rise)}</span></div>
          <div className={`mcl-l31-status ${!fw ? "off" : problems.length ? "warn" : "ok"}`}>
            <Icon name={statusOk ? "check" : "alert"} size={16} />
            <div>
              <b>{!fw ? "Firmware stopped" : problems.length ? `${problems.length} problem${problems.length === 1 ? "" : "s"}` : "Inputs decoded cleanly"}</b>
              <span>{fw ? `${scanMs} ms scan · settle ${settleUs} µs · ${p.diodes ? "diode per key" : "no diodes"} · ${cable.label}` : "Press Run to flash the board."}</span>
            </div>
          </div>
          <ul className="mcl-checks mcl-l35-checks">{checks.map((c) => <li key={c.label} className={c.done ? "done" : ""}><Icon name={c.done ? "check" : "target"} size={14} />{c.label}</li>)}</ul>
          {msg ? <p className="mcl-l31-hint"><Icon name="alert" size={14} /><span>{msg}</span></p> : null}
          {hints.slice(0, 3).map((x) => (
            <p key={x.text} className={`mcl-l31-hint ${x.tone ?? ""}`}><Icon name={x.tone === "info" ? "bulb" : "alert"} size={14} /><span>{x.text}</span>{x.fix?.map(([l, fn]) => <button key={l} type="button" onClick={fn}>{l}</button>)}</p>
          ))}
          <p className="mcl-l31-sub">{lab.dirty && !pending ? "The editor has unflashed changes: press Run to apply them. " : ""}Click a key in the matrix to capture it in the timing view.{custom && fw ? " Running your own version of the program." : ""}</p>
        </Panel>

        <div className="mcl-g4-notes"><LearningNotes notes={notesData} /></div>
      </div>
    </LabShell>
  );
}
