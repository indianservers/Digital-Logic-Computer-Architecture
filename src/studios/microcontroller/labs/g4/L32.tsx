import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useLab } from "../core/useLab";
import type { LabMeta } from "../registry";
import { CodeEditor } from "../ui/CodeEditor";
import { Icon } from "../ui/Icon";
import { LearningNotes, Panel, Toggle } from "../ui/Panels";
import { LabShell } from "../ui/Shell";
import {
  AUTO_BOFF, busLoad, clearLog, codeField, DEMO, encode, fmtRate, fmtT, front, hex2, hex3, injectBitError, MANUAL_BOFF, mcu32, mismatch, monitor, NODE_ID, NODE_NAME, NODE_ROLE,
  nodeOf, P32_DEFAULT, PRESC, rateA, sampleA, setCodeField, TERM_LABEL, VARIANTS, world32, type FieldKey, type FrameRec, type Front, type MonLine, type NodeKey, type NodeState,
  type P32, type Seg, type Term, type Trig, type View,
} from "./L32sim";

const KEYS: NodeKey[] = ["A", "B", "C"];
const C = { h: "#16a34a", l: "#1677ff", tx: "#f59e0b", cable: "#273449" } as const;
const SC = { h: "#34d399", l: "#60a5fa", tx: "#fbbf24" } as const;
const STATE_LABEL: Record<NodeState, string> = { active: "Error active", passive: "Error passive", off: "Bus-off" };
const TRIGS: Array<[Trig, string]> = [["arb", "Arbitration"], ["A", "ECU A"], ["B", "ECU B"], ["C", "ECU C"], ["err", "Errors"], ["any", "Any frame"]];
const VIEWS: Array<[View, string]> = [["auto", "Auto"], ["arb", "Arbitration"], ["frame", "Whole frame"]];
const TERMS: Term[] = ["both", "one", "none"];
const NETS = [125, 250, 500, 1000];

/* ---------------- network scene ---------------- */

const W = 660, H = 300;
const CARD = { y: 14, w: 134, h: 96 } as const;
const CX: Record<NodeKey, number> = { A: 170, B: 330, C: 490 };
const BUS = { x0: 44, x1: 616, h: 166, cable: 172, l: 186 } as const;

interface SceneProps { p: P32; f: Front; now: number; started: boolean; arb: FrameRec | null; onToggle: (k: "b" | "c") => void; onTerm: (side: "l" | "r") => void }

function Scene({ p, f, now, started, arb, onToggle, onTerm }: SceneProps) {
  const recent = [...f.frames].reverse().find((r) => r.t1 > now - 0.035 && r.t0 <= now) ?? null;
  const termL = p.term !== "none", termR = p.term === "both";
  const key = (fn: () => void) => (e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(); } };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mcl-l32-scene" role="img" aria-label={`CAN bus with ECU A (0x120), ECU B (0x080) and ECU C (0x2A0); termination: ${TERM_LABEL[p.term]}`}>
      <rect x={0} y={0} width={W} height={H} fill="#fff" />
      {KEYS.map((k) => {
        const n = nodeOf(f, k), cx = CX[k], x = cx - CARD.w / 2;
        const powered = k === "A" ? started : k === "B" ? p.b : p.c;
        const tx = !!recent && recent.from === k;
        const rx = !!recent && recent.rxBy.includes(k);
        const clickable = k !== "A";
        const toggle = () => onToggle(k === "B" ? "b" : "c");
        const tone = !powered ? "#94a3b8" : n.state === "off" ? "#dc2626" : n.state === "passive" ? "#d97706" : "#16a34a";
        const id = k === "A" ? (f.a.pend[0]?.id ?? NODE_ID.A) : NODE_ID[k];
        return (
          <g key={k} className={`mcl-l32-ecu ${powered ? "" : "off"} ${tx ? "tx" : ""} ${clickable ? "click" : ""}`} {...(clickable ? { role: "button", tabIndex: 0, "aria-pressed": powered, "aria-label": `${NODE_NAME[k]} (${NODE_ROLE[k]}): ${powered ? "powered, click to power down" : "powered down, click to power up"}`, onClick: toggle, onKeyDown: key(toggle) } : {})}>
            <line x1={cx} x2={cx} y1={CARD.y + CARD.h} y2={BUS.cable + 4} stroke={tx ? "#facc15" : "#475569"} strokeWidth={tx ? 3.4 : 2.6} />
            <rect className="mcl-l32-card" x={x} y={CARD.y} width={CARD.w} height={CARD.h} rx={12} fill={powered ? "#eaf2ff" : "#f1f5f9"} stroke={powered ? "#b9d0f2" : "#cbd5e1"} strokeDasharray={powered ? undefined : "4 3"} />
            <text x={cx} y={CARD.y + 25} textAnchor="middle" fontSize="15" fontWeight="800" fill="#0f2547">{NODE_NAME[k]}</text>
            <text x={cx} y={CARD.y + 42} textAnchor="middle" fontSize="11" fontWeight="700" fill="#1677ff" fontFamily="ui-monospace, Consolas, monospace">ID {hex3(id)}</text>
            <text x={cx} y={CARD.y + 56} textAnchor="middle" fontSize="8.5" fill="#5c7190">{NODE_ROLE[k]}</text>
            <rect x={x + 10} y={CARD.y + 63} width={CARD.w - 20} height={14} rx={7} fill={`${tone}1f`} stroke={`${tone}66`} />
            <text x={cx} y={CARD.y + 73} textAnchor="middle" fontSize="8" fontWeight="800" fill={tone}>{!powered ? (k === "A" ? "not started" : "powered down") : `${STATE_LABEL[n.state]} · TEC ${n.tec} · REC ${n.rec}`}</text>
            <text x={cx} y={CARD.y + 89} textAnchor="middle" fontSize="8" fill="#33496b">{k === "A" ? `rpm ${rpmOf(f)} · ${n.txOk} sent` : k === "B" ? `brake ${Math.round(p.brake)} % · ${n.txOk} sent` : `shows ${dashText(f)}`}</text>
            <circle cx={x + CARD.w - 22} cy={CARD.y + 12} r={3.4} fill={tx ? "#22c55e" : "#cbd5e1"} />
            <circle cx={x + CARD.w - 11} cy={CARD.y + 12} r={3.4} fill={rx ? "#f59e0b" : "#cbd5e1"} />
            <text x={x + CARD.w - 22} y={CARD.y + 24} textAnchor="middle" fontSize="5.5" fill="#64748b">TX</text>
            <text x={x + CARD.w - 11} y={CARD.y + 24} textAnchor="middle" fontSize="5.5" fill="#64748b">RX</text>
          </g>
        );
      })}

      <line x1={BUS.x0} x2={BUS.x1} y1={BUS.h} y2={BUS.h} stroke={C.h} strokeWidth={2.2} />
      <rect x={BUS.x0} y={BUS.cable} width={BUS.x1 - BUS.x0} height={8} rx={2} fill={C.cable} />
      <line x1={BUS.x0} x2={BUS.x1} y1={BUS.l} y2={BUS.l} stroke={C.l} strokeWidth={2.2} />
      {recent ? (
        <g className="mcl-l32-pkt">
          <rect x={CX[recent.from] - 30} y={BUS.cable - 2} width={60} height={12} rx={6} fill={recent.err ? "#dc2626" : "#facc15"} stroke="#0f2547" strokeWidth={0.8} />
          <text x={CX[recent.from]} y={BUS.cable + 7} textAnchor="middle" fontSize="8" fontWeight="800" fill="#0f2547" fontFamily="ui-monospace, Consolas, monospace">{recent.err ? "ERROR" : hex3(recent.frame.id)}</text>
        </g>
      ) : null}
      {([["l", BUS.x0 - 22, termL], ["r", BUS.x1 + 6, termR]] as const).map(([side, x, on]) => (
        <g key={side} className="mcl-l32-term" role="button" tabIndex={0} aria-pressed={on} aria-label={`${side === "l" ? "Left" : "Right"} 120 Ω terminator: ${on ? "fitted, click to remove" : "missing, click to fit"}`}
          onClick={() => onTerm(side)} onKeyDown={key(() => onTerm(side))}>
          <line x1={side === "l" ? x + 8 : x + 8} x2={side === "l" ? BUS.x0 : BUS.x1} y1={BUS.h} y2={BUS.h} stroke={on ? C.h : "#cbd5e1"} strokeWidth={1.4} strokeDasharray={on ? undefined : "2 2"} />
          <line x1={x + 8} x2={side === "l" ? BUS.x0 : BUS.x1} y1={BUS.l} y2={BUS.l} stroke={on ? C.l : "#cbd5e1"} strokeWidth={1.4} strokeDasharray={on ? undefined : "2 2"} />
          <rect x={x} y={BUS.h - 6} width={16} height={BUS.l - BUS.h + 12} rx={3} fill={on ? "#fef3c7" : "#fff"} stroke={on ? "#b45309" : "#94a3b8"} strokeDasharray={on ? undefined : "3 2"} />
          <text x={x + 8} y={BUS.l + 18} textAnchor="middle" fontSize="7.5" fontWeight="700" fill={on ? "#92400e" : "#94a3b8"}>{on ? "120 Ω" : "open"}</text>
        </g>
      ))}
      <text x={BUS.x0 + 4} y={210} fontSize="9" fontWeight="800" fill={C.h}>CAN-H</text>
      <text x={BUS.x0 + 4} y={223} fontSize="9" fontWeight="800" fill={C.l}>CAN-L</text>
      <text x={BUS.x0 + 4} y={240} fontSize="7.5" fill="#64748b">{fmtRate(p.netKbps * 1000)} network</text>
      <text x={BUS.x0 + 4} y={251} fontSize="7.5" fill={p.term === "none" ? "#dc2626" : "#64748b"}>{p.term === "both" ? "R = 60 Ω" : p.term === "one" ? "R = 120 Ω" : "unterminated"}</text>
      <ArbGrid r={arb} />
    </svg>
  );
}

const rpmOf = (f: Front) => { const r = [...f.frames].reverse().find((x) => x.from === "A" && !x.err && !x.frame.rtr && x.frame.dlc >= 2); return r ? (r.frame.data[0]! << 8) | r.frame.data[1]! : "–"; };
const dashText = (f: Front) => { const a = f.c.seen["0x120"], b = f.c.seen["0x080"]; return `${a && a.length >= 2 ? `${(a[0]! << 8) | a[1]!} rpm` : "– rpm"} · ${b && b.length ? `brake ${b[0]} %` : "brake –"}`; };

const GX = 214, GW = 26, GY = 222;
function ArbGrid({ r }: { r: FrameRec | null }) {
  if (!r) return <text x={GX + 200} y={GY + 30} textAnchor="middle" fontSize="9.5" fill="#94a3b8">Arbitration appears when two nodes start a frame in the same bit.</text>;
  const rows = [...r.contenders].sort((a, b) => (a.lostAt === null ? -1 : b.lostAt === null ? 1 : b.lostAt - a.lostAt));
  const idBits = (id: number, rtr: boolean) => [...Array.from({ length: 11 }, (_, i) => (id >> (10 - i)) & 1), rtr ? 1 : 0];
  const lostCol = (s: number | null) => (s === null ? null : Math.max(0, (r.raw[s] ?? 1) - 1));
  const bus = Array.from({ length: 12 }, (_, i) => Math.min(...rows.map((c) => { const lc = lostCol(c.lostAt); return lc !== null && i > lc ? 1 : idBits(c.id, c.rtr)[i]!; })));
  const all = [...rows.map((c) => ({ label: `${NODE_NAME[c.node]} ${hex3(c.id)}`, bits: idBits(c.id, c.rtr), lost: lostCol(c.lostAt), win: c.lostAt === null })), { label: "Bus (wired-AND)", bits: bus, lost: null, win: false }];
  const rowH = Math.min(15, 62 / all.length);
  return (
    <g>
      <text x={GX - 96} y={GY - 6} fontSize="8.5" fontWeight="800" fill="#0f2547">Arbitration at {(r.t0 * 1e3).toFixed(3)} ms · ID bits MSB first, 0 = dominant</text>
      {Array.from({ length: 12 }, (_, i) => <text key={i} x={GX + i * GW + GW / 2} y={GY + 6} textAnchor="middle" fontSize="7" fill="#64748b">{i < 11 ? 10 - i : "RTR"}</text>)}
      {all.map((row, j) => {
        const y = GY + 10 + j * rowH;
        const isBus = j === all.length - 1;
        return (
          <g key={row.label}>
            <text x={GX - 6} y={y + rowH * 0.72} textAnchor="end" fontSize="8" fontWeight={row.win || isBus ? 800 : 600} fill={isBus ? "#0f2547" : row.win ? "#15803d" : "#b42318"}>{row.label}</text>
            {row.bits.map((b, i) => {
              const after = row.lost !== null && i > row.lost;
              const lostHere = row.lost === i;
              return (
                <g key={i}>
                  <rect x={GX + i * GW + 1} y={y} width={GW - 2} height={rowH - 2} rx={2} fill={lostHere ? "#fee2e2" : after ? "#f8fafc" : isBus ? "#e0ecff" : b ? "#fff" : "#dbeafe"} stroke={lostHere ? "#dc2626" : "#d6e1ef"} />
                  <text x={GX + i * GW + GW / 2} y={y + rowH * 0.66} textAnchor="middle" fontSize="8" fontWeight="700" fill={after ? "#cbd5e1" : lostHere ? "#b42318" : "#0f2547"} fontFamily="ui-monospace, Consolas, monospace">{after ? "·" : b}</text>
                </g>
              );
            })}
            {row.lost !== null ? <text x={GX + 12 * GW + 4} y={y + rowH * 0.72} fontSize="7.5" fontWeight="700" fill="#b42318">lost at bit {row.lost < 11 ? 10 - row.lost : "RTR"}</text> : row.win ? <text x={GX + 12 * GW + 4} y={y + rowH * 0.72} fontSize="7.5" fontWeight="700" fill="#15803d">wins</text> : null}
          </g>
        );
      })}
    </g>
  );
}

/* ---------------- bus level scope ---------------- */

const PW = 560, PH = 200, PL = 44, PR = 8;
const LANE = { h: [28, 58], l: [70, 100], tx: [120, 148] } as const;
const SEG_FILL: Partial<Record<Seg["f"], string>> = { SOF: "#475569", ID: "#5b21b6", RTR: "#7c3aed", IDE: "#92400e", R0: "#92400e", DLC: "#b45309", DATA: "#155e75", CRC: "#1e3a8a", CDEL: "#334155", ACK: "#166534", ADEL: "#334155", EOF: "#334155", FLAG: "#b91c1c", EDEL: "#7f1d1d", IFS: "#1f2937" };

function windowOf(r: FrameRec, view: View): [number, number] {
  const v = view === "auto" ? (r.err ? "err" : r.contenders.length > 1 ? "arb" : "frame") : view;
  if (v === "arb") return [0, Math.min(r.bits.length, r.arbEnd + 7)];
  if (v === "err" && r.err) return [Math.max(0, r.err.at - 14), Math.min(r.bits.length, r.err.flagEnd + 9)];
  return [0, r.bits.length];
}

function analog(bits: number[], b0: number, b1: number, tauBits: number, X: (b: number) => number, Y: (v: number) => number) {
  const td = 0.01;
  let v = 0;
  for (let i = 0; i < b0; i++) v = bits[i] === 0 ? 1 - (1 - v) * Math.exp(-1 / td) : v * Math.exp(-1 / tauBits);
  const pts: string[] = [];
  for (let i = b0; i < b1; i++) {
    const dom = bits[i] === 0;
    const v0 = v;
    for (const fr of [0, 0.03, 0.1, 0.25, 0.5, 0.75, 1]) {
      const vv = dom ? 1 - (1 - v0) * Math.exp(-fr / td) : v0 * Math.exp(-fr / tauBits);
      pts.push(`${X(i + fr).toFixed(1)} ${Y(vv).toFixed(1)}`);
    }
    v = dom ? 1 - (1 - v0) * Math.exp(-1 / td) : v0 * Math.exp(-1 / tauBits);
  }
  return pts.length ? `M${pts.join(" L")}` : "";
}

function Scope({ r, view, lane, empty }: { r: FrameRec | null; view: View; lane: NodeKey; empty: string }) {
  const w = PW - PL - PR;
  const grid = (
    <g>
      <rect x={0} y={0} width={PW} height={PH} rx={6} fill="#0b1626" />
      {([LANE.h, LANE.l, LANE.tx] as const).map(([a, b], i) => <g key={i}><line x1={PL} x2={PL + w} y1={a} y2={a} stroke="#15243a" /><line x1={PL} x2={PL + w} y1={b} y2={b} stroke="#1d3150" /></g>)}
      <text x={6} y={(LANE.h[0] + LANE.h[1]) / 2 + 4} fontSize="10" fontWeight="800" fill={SC.h}>CAN_H</text>
      <text x={6} y={(LANE.l[0] + LANE.l[1]) / 2 + 4} fontSize="10" fontWeight="800" fill={SC.l}>CAN_L</text>
      <text x={6} y={(LANE.tx[0] + LANE.tx[1]) / 2 + 4} fontSize="10" fontWeight="800" fill={SC.tx}>TX {lane}</text>
    </g>
  );
  if (!r) return <svg viewBox={`0 0 ${PW} ${PH}`} className="mcl-l31-scope" role="img" aria-label="No CAN frame captured">{grid}<text x={PL + w / 2} y={96} textAnchor="middle" fontSize="11" fill="#94a3b8">{empty}</text></svg>;
  const [b0, b1] = windowOf(r, view);
  const span = Math.max(1, b1 - b0);
  const X = (b: number) => PL + ((Math.max(b0, Math.min(b1, b)) - b0) / span) * w;
  const px = w / span;
  const tauBits = Math.max(0.004, r.tau / r.bt);
  const hPath = analog(r.bits, b0, b1, tauBits, X, (v) => LANE.h[1] - v * (LANE.h[1] - LANE.h[0]));
  const lPath = analog(r.bits, b0, b1, tauBits, X, (v) => LANE.l[0] + v * (LANE.l[1] - LANE.l[0]));
  const txb = r.tx[lane];
  let txPath = "";
  if (txb) {
    const pts: string[] = [];
    for (let i = b0; i < b1; i++) { const y = txb[i] ? LANE.tx[0] : LANE.tx[1]; pts.push(`${X(i).toFixed(1)} ${y}`, `${X(i + 1).toFixed(1)} ${y}`); }
    txPath = `M${pts.join(" L")}`;
  }
  const lost = r.contenders.find((c) => c.node === lane)?.lostAt ?? null;
  const segs = r.segs.filter((s) => s.b > b0 && s.a < b1);
  const acked = r.ackBy.includes(lane);
  return (
    <svg viewBox={`0 0 ${PW} ${PH}`} className="mcl-l31-scope" role="img" aria-label={`CAN frame #${r.id} from ${NODE_NAME[r.from]}, ID ${hex3(r.frame.id)}, bits ${b0} to ${b1}`}>
      {grid}
      {px >= 7 ? Array.from({ length: span + 1 }, (_, i) => <line key={i} x1={X(b0 + i)} x2={X(b0 + i)} y1={24} y2={LANE.tx[1] + 2} stroke="#132238" />) : null}
      {r.err && r.err.at < b1 && r.err.flagEnd > b0 ? <rect x={X(r.err.at)} y={22} width={Math.max(2, X(r.err.flagEnd) - X(r.err.at))} height={LANE.tx[1] - 20} fill="#ef444422" stroke="#ef4444" strokeDasharray="3 3" /> : null}
      {segs.map((s, i) => {
        const x1 = X(s.a), x2 = X(s.b);
        return (
          <g key={i}>
            <rect x={x1 + 0.5} y={5} width={Math.max(0, x2 - x1 - 1)} height={14} rx={3} fill={SEG_FILL[s.f] ?? "#334155"} opacity={0.92} />
            {x2 - x1 > s.label.length * 5.2 ? <text x={(x1 + x2) / 2} y={15.5} textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#f8fafc" fontFamily="ui-monospace, Consolas, monospace">{s.label}</text> : null}
          </g>
        );
      })}
      {px >= 9 ? r.stuff.filter((i) => i >= b0 && i < b1).map((i) => <text key={`s${i}`} x={X(i + 0.5)} y={LANE.h[0] - 3} textAnchor="middle" fontSize="7" fontWeight="800" fill="#c084fc">s</text>) : null}
      <path d={hPath} fill="none" stroke={SC.h} strokeWidth={1.8} strokeLinejoin="round" />
      <path d={lPath} fill="none" stroke={SC.l} strokeWidth={1.8} strokeLinejoin="round" />
      {txPath ? <path d={txPath} fill="none" stroke={SC.tx} strokeWidth={1.8} strokeLinejoin="round" /> : <text x={PL + w / 2} y={LANE.tx[1] - 8} textAnchor="middle" fontSize="9" fill="#64748b">{NODE_NAME[lane]} is not on the bus</text>}
      {px >= 12 ? Array.from({ length: span }, (_, k) => b0 + k).map((i) => <text key={`v${i}`} x={X(i + 0.5)} y={LANE.tx[0] - 6} textAnchor="middle" fontSize="7.5" fill="#94a3b8" fontFamily="ui-monospace, Consolas, monospace">{r.bits[i]}</text>) : null}
      {lost !== null && lost >= b0 && lost < b1 ? (
        <g>
          <rect x={X(lost)} y={LANE.tx[0] - 3} width={Math.max(3, px)} height={LANE.tx[1] - LANE.tx[0] + 6} fill="#ef444433" stroke="#ef4444" />
          <text x={X(lost + 1) + 3} y={LANE.tx[1] + 11} fontSize="8.5" fontWeight="800" fill="#f87171">{NODE_NAME[lane]} sent 1, read 0: lost arbitration</text>
        </g>
      ) : null}
      {acked && r.ackAt >= b0 && r.ackAt < b1 ? <rect x={X(r.ackAt)} y={LANE.tx[0] - 3} width={Math.max(3, px)} height={LANE.tx[1] - LANE.tx[0] + 6} fill="#22c55e33" stroke="#22c55e" /> : null}
      {r.err && r.err.at >= b0 && r.err.at < b1 ? <text x={Math.min(PL + w - 4, X(r.err.at) + 3)} y={LANE.h[0] - 3} textAnchor={X(r.err.at) > PL + w - 90 ? "end" : "start"} fontSize="8.5" fontWeight="800" fill="#fca5a5">{r.err.kind === "ack" ? "ACK error" : r.err.kind === "stuff" ? "stuff error" : "bit error"}</text> : null}
      {[0, 0.5, 1].map((q) => <text key={q} x={PL + q * w} y={PH - 5} textAnchor={q === 0 ? "start" : q === 1 ? "end" : "middle"} fontSize="8.5" fill="#94a3b8">{+((b0 + q * span) * r.bt * 1e6).toFixed(1)} µs</text>)}
      <text x={PL + w / 2} y={PH - 18} textAnchor="middle" fontSize="8" fill="#64748b">bits {b0}–{b1 - 1} of {r.bits.length} · {fmtT(r.bt)} per bit · CAN_H 2.5→3.5 V and CAN_L 2.5→1.5 V when dominant</text>
    </svg>
  );
}

/* ---------------- monitor ---------------- */

function Tokens({ s }: { s: string }) {
  if (!s) return null;
  const parts = s.split(" | ");
  return (
    <code className="mcl-l31-frame">
      {parts.map((p, i) => <span key={i} className={i === 0 ? "ad" : p.startsWith("✕") ? "n" : p.startsWith("ACK") ? "a" : i === parts.length - 1 ? "k" : "d"}>{p}</span>)}
    </code>
  );
}

const TONE_CLASS: Record<MonLine["tone"], string> = { ok: "", arb: "scan", warn: "warn", bad: "bad", info: "" };

/* ---------------- lab ---------------- */

const NO_SEEN = { arb: false, frame: false, win: false, remote: false, tec: false, busoff: false, term: false };
type Seen = typeof NO_SEEN;
interface Sticky { fw: unknown; lastId: number; tecPeak: number; termErrAt: number; termFixed: boolean; remote: boolean; win: boolean; arbLost: boolean; collide: number; ackErr: number; injT: number }
const freshSticky = (fw: unknown): Sticky => ({ fw, lastId: 0, tecPeak: 0, termErrAt: -1, termFixed: false, remote: false, win: false, arbLost: false, collide: 0, ackErr: 0, injT: -1 });

export default function L32({ meta }: { meta: LabMeta }) {
  const lab = useLab<P32>({ slug: meta.slug, code: DEMO, params: P32_DEFAULT, mcu: mcu32, world: world32 });
  const { mcu, params: p } = lab;
  const fw = mcu.fw;
  const f = front(mcu);
  const now = mcu.now;
  const [sel, setSel] = useState<FrameRec | null>(null);
  const [follow, setFollow] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [seen, setSeen] = useState<Seen>(NO_SEEN);
  const [idDraft, setIdDraft] = useState<string | null>(null);
  const frozen = useRef<{ fw: unknown; lines: MonLine[]; frames: FrameRec[] } | null>(null);
  const sticky = useRef<Sticky>(freshSticky(null));
  const listRef = useRef<HTMLOListElement>(null);
  useEffect(() => { if (pending !== null && lab.code === pending) { setPending(null); lab.run(); } }, [pending, lab]);
  useEffect(() => { setSel(null); }, [fw]);
  useEffect(() => { if (!msg) return; const id = window.setTimeout(() => setMsg(""), 4000); return () => window.clearTimeout(id); }, [msg]);

  if (sticky.current.fw !== fw) sticky.current = freshSticky(fw);
  const st = sticky.current;
  for (const r of f.frames) {
    if (r.id <= st.lastId) continue;
    st.lastId = r.id;
    const losers = r.contenders.filter((c) => c.lostAt !== null);
    if (losers.some((c) => c.node === "A")) st.arbLost = true;
    if (r.from === "A" && losers.length && !r.err) st.win = true;
    if (r.reply && !r.err) st.remote = true;
    if (r.err?.text.startsWith("No termination")) st.termErrAt = r.t1;
    else if (st.termErrAt >= 0 && !r.err && r.t0 > st.termErrAt) st.termFixed = true;
    if (r.err?.kind === "collision") st.collide++;
    if (r.err?.kind === "ack" && r.from === "A") st.ackErr++;
    if (r.err?.text.startsWith("Injected")) st.injT = r.t0;
  }
  st.tecPeak = Math.max(st.tecPeak, f.a.tec);

  const loadCode = (next: string) => { if (next === lab.code) { lab.run(); return; } lab.setCode(next); setPending(next); };
  const edit = (patch: Array<[FieldKey, string]>) => {
    let next = lab.code;
    for (const [k, v] of patch) {
      if (codeField(next, k) === null) { setMsg("This setting was not found in the code: edit the TX header or MX_CAN1_Init() directly."); return; }
      next = setCodeField(next, k, v);
    }
    if (next !== lab.code) loadCode(next);
  };
  const cf = (k: FieldKey) => codeField(lab.code, k);
  const idCode = cf("id");
  const idVal = idCode === null ? NaN : Number(idCode);
  const dlcCode = Number(cf("dlc") ?? 8);
  const rtrCode = cf("rtr") ?? "DATA";
  const prescCode = Number(cf("presc") ?? 6);
  const cfgShown = f.cfg.init ? f.cfg : { ...f.cfg, presc: prescCode, bs1: 11, bs2: 2 };
  const rate = rateA(cfgShown);
  const kbpsCode = Math.round(rate / 1000);
  const rateOpts = PRESC.map(([k]) => k);
  if (!rateOpts.includes(kbpsCode)) rateOpts.push(kbpsCode);
  const applyId = (raw: string) => {
    const s = raw.trim().replace(/^0x/i, "");
    if (!/^[0-9a-f]{1,3}$/i.test(s) || parseInt(s, 16) > 0x7ff) { setMsg("Standard identifiers are 11 bits: 0x000 to 0x7FF."); setIdDraft(null); return; }
    setIdDraft(null);
    edit([["id", hex3(parseInt(s, 16))]]);
  };

  const v = (n: string) => (fw ? fw.num(n, Number.NaN) : Number.NaN);
  const rpm = v("rpm"), brake = v("brake"), speed = v("speed"), rxCount = v("rxCount"), txFail = v("txFail");

  const match = (r: FrameRec) => {
    switch (p.trig) {
      case "any": return true;
      case "arb": return r.contenders.length > 1;
      case "err": return !!r.err;
      default: return r.from === p.trig;
    }
  };
  let live: FrameRec | null = null;
  for (let i = f.frames.length - 1; i >= 0; i--) if (match(f.frames[i]!)) { live = f.frames[i]!; break; }
  const shown = sel ?? live;
  const lastArb = (sel && sel.contenders.length > 1 ? sel : null) ?? [...f.frames].reverse().find((r) => r.contenders.length > 1) ?? null;

  const paused = !follow || sel !== null;
  if (!paused || frozen.current?.fw !== fw) frozen.current = null;
  if (paused && !frozen.current) frozen.current = { fw, lines: monitor(f, 160), frames: f.frames.slice() };
  const lines = frozen.current?.lines ?? monitor(f, 160);
  const lastKey = `${lines.length}:${lines[lines.length - 1]?.key ?? ""}`;
  useEffect(() => { const el = listRef.current; if (follow && !sel && el) el.scrollTop = el.scrollHeight; }, [lastKey, follow, sel]);
  const pick = (ln: MonLine) => {
    if (ln.id === null) return;
    const pool = frozen.current?.frames ?? f.frames;
    const r = pool.find((x) => x.id === ln.id) ?? null;
    if (!r) { setMsg("That frame has left the capture buffer."); return; }
    if (!frozen.current) frozen.current = { fw, lines, frames: f.frames.slice() };
    setSel(r);
  };

  const mis = fw ? mismatch(f) : Math.abs(rate / (p.netKbps * 1000) - 1) > 0.01;
  const recentErr = f.frames.filter((r) => r.err && r.t0 > now - 0.5);
  const termErr = recentErr.some((r) => r.err!.text.startsWith("No termination"));
  const lastA = [...f.frames].reverse().find((r) => r.from === "A") ?? null;

  const hints: Array<{ text: string; tone?: "info"; fix?: Array<[string, () => void]> }> = [];
  if (!fw) hints.push({ text: "Press Run to flash ECU A. Until then the Frame Builder edits the code.", tone: "info" });
  if (fw && f.notStarted > 0 && !f.cfg.started) hints.push({ text: `HAL_CAN_AddTxMessage() returned HAL_ERROR ${f.notStarted} time${f.notStarted === 1 ? "" : "s"}: ${f.cfg.init ? "HAL_CAN_Start() was never called, so the bxCAN is still in initialisation mode and stays off the bus" : "HAL_CAN_Init() did not run, so CAN1 is not configured"}.` });
  if (fw && mis && f.cfg.init) hints.push({ text: `ECU A runs at ${fmtRate(rateA(f.cfg))} but ECU B and C use ${fmtRate(p.netKbps * 1000)}. Every frame ECU A sends is garbage to the others, they answer with error flags, and fault confinement pushes ECU A to error passive and then bus-off while B and C carry on.`, fix: [[`ECU A at ${p.netKbps} kbps`, () => { const pr = PRESC.find(([k]) => k === p.netKbps)?.[1]; if (pr) edit([["presc", String(pr)]]); }], [`Network at ${Math.round(rateA(f.cfg) / 1000)} kbps`, () => lab.setParam("netKbps", Math.round(rateA(f.cfg) / 1000))]] });
  if (fw && termErr) hints.push({ text: `No termination: when the transceivers stop driving, nothing discharges CAN_H/CAN_L quickly (τ = ${fmtT(f.frames[f.frames.length - 1]?.tau ?? 0)}), so a recessive bit still reads dominant at the sample point. Every frame ends in a bit error. Fit the 120 Ω resistors, or slow the whole bus down.`, fix: [["Fit both 120 Ω", () => lab.setParam("term", "both")]] });
  if (fw && f.a.state === "off" && !f.cfg.abom && f.a.recoverAt === null) {
    const fix: Array<[string, () => void]> = [["Load auto recovery", () => loadCode(AUTO_BOFF)]];
    if (!lab.compiledCode.includes("HAL_CAN_ERROR_BOF")) fix.push(["Load manual recovery", () => loadCode(MANUAL_BOFF)]);
    hints.push({ text: `ECU A is bus-off (TEC passed 255) and AutoBusOff = DISABLE, so it stays disconnected: its three TX mailboxes fill up and HAL_CAN_AddTxMessage() returns HAL_ERROR (txFail = ${Number.isFinite(txFail) ? txFail : "?"}). Enable automatic recovery or restart the controller from the firmware.`, fix });
  } else if (fw && f.a.state === "passive") hints.push({ text: `ECU A is error passive (TEC ${f.a.tec}, REC ${f.a.rec}): its error flags are recessive and it waits 8 extra bits before retransmitting. Each good frame lowers TEC by 1.`, tone: "info" });
  if (fw && f.cfg.started && !f.filters.some((x) => x.on) && f.filtered > 0) hints.push({ text: `No acceptance filter is active: the bxCAN still ACKs every frame (ACK is part of the protocol) but stores none of them, so the RX callback never runs (${f.filtered} frames dropped).`, fix: lab.code.includes("// HAL_CAN_ConfigFilter") ? [["Configure the filter", () => loadCode(lab.code.replace("// HAL_CAN_ConfigFilter", "HAL_CAN_ConfigFilter"))]] : [["Load the demo", () => loadCode(DEMO)]] });
  else if (fw && f.filtered > 0 && f.filters.some((x) => x.on)) hints.push({ text: `The acceptance filter dropped ${f.filtered} frame${f.filtered === 1 ? "" : "s"}: they were ACKed on the bus but not stored in FIFO 0.`, tone: "info" });
  if (fw && st.collide > 0 && f.frames.some((r) => r.err?.kind === "collision" && r.t0 > now - 1)) hints.push({ text: `ECU A and ECU B both send ID ${hex3(idVal)}: arbitration cannot separate them, so they collide in the data field and both collect bit errors. Every identifier must belong to exactly one node.`, fix: [["Use 0x120", () => edit([["id", "0x120"]])]] });
  if (fw && f.dropped > 0 && f.cfg.nart) hints.push({ text: `AutoRetransmission = DISABLE: ${f.dropped} frame${f.dropped === 1 ? "" : "s"} from ECU A ${f.dropped === 1 ? "was" : "were"} thrown away after losing arbitration (or an error) instead of being retried.`, fix: [["Enable retransmission", () => edit([["nart", "ENABLE"]])]] });
  if (fw && f.cfg.started && !p.b && !p.c && st.ackErr > 0) hints.push({ text: "ECU A is alone on the bus: nobody drives the ACK slot dominant, so every frame ends in an ACK error. TEC climbs to 128 and stops there (an error-passive transmitter is not punished further for missing ACKs).", fix: [["Power ECU B", () => lab.setParam("b", true)], ["Power ECU C", () => lab.setParam("c", true)]] });
  if (fw && lastA?.frame.rtr && !f.frames.some((r) => r.reply && r.t0 > now - 0.5) && ![NODE_ID.B, NODE_ID.C].includes(lastA.frame.id)) hints.push({ text: `ECU A requests ${hex3(lastA.frame.id)} with a remote frame, but no node owns that identifier, so nobody answers. Request 0x080 (ECU B) or 0x2A0 (ECU C).`, fix: [["Request 0x2A0", () => edit([["id", "0x2A0"]])]] });
  if (fw && st.injT >= 0 && st.injT > now - 1.5 && f.a.state === "active") hints.push({ text: `Injected bit error: ECU A read a dominant bit where it sent recessive, sent an error flag and retransmitted. TEC went up by 8 and drops by 1 with every good frame (now ${f.a.tec}).`, tone: "info" });
  if (fw && p.b && !p.c && f.frames.some((r) => r.from === "B" && r.t0 > now - 0.3) && !f.frames.some((r) => r.contenders.length > 1 && r.t0 > now - 0.3)) hints.push({ text: "With ECU C powered down nothing holds the bus at the start of the cycle: ECU B starts alone and ECU A simply waits for the bus to go idle. Arbitration only happens when nodes start in the same bit.", tone: "info" });
  if (p.term === "one" && fw && !termErr) hints.push({ text: "Only one 120 Ω terminator: this short bench bus still works (R = 120 Ω), but on a long cable the open end reflects every edge. Fit both ends.", tone: "info" });
  const problems = hints.filter((h) => h.tone !== "info");

  const flags: Seen = {
    arb: st.arbLost,
    frame: sel !== null,
    win: st.win,
    remote: st.remote,
    tec: st.tecPeak > 0 && f.a.tec < st.tecPeak,
    busoff: f.recoveries > 0,
    term: st.termFixed,
  };
  useEffect(() => {
    const ks = Object.keys(flags) as Array<keyof Seen>;
    if (ks.some((k) => flags[k] && !seen[k])) setSeen((o) => { const n = { ...o }; for (const k of ks) n[k] = o[k] || flags[k]; return n; });
  });

  const shellLab = { ...lab, resetLab: () => { lab.resetLab(); setSel(null); setFollow(true); setPending(null); setSeen(NO_SEEN); setIdDraft(null); frozen.current = null; } };
  const toggleNode = (k: "b" | "c") => lab.setParam(k, !p[k]);
  const toggleTerm = (side: "l" | "r") => {
    const on = side === "l" ? p.term !== "none" : p.term === "both";
    const n = (p.term === "both" ? 2 : p.term === "one" ? 1 : 0) + (on ? -1 : 1);
    lab.setParam("term", n >= 2 ? "both" : n === 1 ? "one" : "none");
  };
  const statusTone = !fw ? "off" : problems.length ? "warn" : "ok";
  const custom = !VARIANTS.some((x) => x.code === lab.compiledCode);
  const disabled = (k: FieldKey) => cf(k) === null;
  const sample = sampleA(cfgShown);
  const frameBits = encode({ id: Number.isFinite(idVal) ? idVal : 0x120, rtr: rtrCode === "REMOTE", dlc: dlcCode, data: lastA?.frame.data ?? [0, 0, 0, 0, 0, 0, 0, 0] }).bits.length + 3;
  const load = fw ? busLoad(f, now) : 0;
  const payload = lastA && !lastA.frame.rtr ? lastA.frame.data.slice(0, lastA.frame.dlc) : [];

  const arbFrame = [...f.frames].reverse().find((r) => r.contenders.length > 1 && r.contenders.some((c) => c.node === "A")) ?? null;
  const summary = (() => {
    if (!fw) return "Press Run: ECU A starts sending 0x120 every 100 ms next to ECU B (0x080) and ECU C (0x2A0).";
    const parts: string[] = [];
    if (arbFrame) {
      const loser = arbFrame.contenders.filter((c) => c.lostAt !== null);
      parts.push(`${NODE_NAME[arbFrame.from]} wins arbitration with ID ${hex3(arbFrame.frame.id)}.`);
      if (loser.length) parts.push(`${loser.map((c) => NODE_NAME[c.node]).join(" and ")} ${loser.some((c) => c.node === "A") && f.cfg.nart ? "drops its frame (no retransmission)" : "retries automatically"}.`);
    } else parts.push("No arbitration yet.");
    parts.push(`Error counters: TEC ${f.a.tec} / REC ${f.a.rec}.`);
    if (!seen.tec || !seen.busoff) parts.push("Try bit error injection and bus-off recovery.");
    return parts.join(" ");
  })();

  const notesData = {
    takeaways: [
      "CAN is a two-wire differential bus: dominant (logic 0) drives CAN_H to 3.5 V and CAN_L to 1.5 V, recessive (logic 1) lets both float to 2.5 V.",
      "Dominant always overwrites recessive (wired-AND), which is what makes non-destructive arbitration possible.",
      "Every node sends its identifier MSB first and reads the bus back; a node that sends 1 but reads 0 stops at once. The lowest identifier wins without losing a single bit.",
      "Priority only matters when nodes start in the same bit: a frame already on the bus is never interrupted.",
      "Receivers acknowledge every correct frame in the ACK slot; acceptance filters only decide what gets stored.",
      "Fault confinement: transmit errors add 8 to TEC, receive errors add 1 to REC, good frames subtract 1. Above 127 a node is error passive, above 255 it is bus-off.",
      "The bus needs 120 Ω at both ends: the termination pulls the lines back to recessive quickly and stops reflections.",
    ],
    observe: "Press Run. Every 100 ms ECU C's dashboard frame occupies the bus while ECU B (0x080) and ECU A (0x120) queue theirs; when the bus goes idle both start together and ECU A drops out at ID bit 8. The arbitration grid and the scope show the exact bit.",
    tryIt: "Click a Node Monitor line to freeze that frame. Type an identifier below 0x080 (for example 0x050) in the Frame Builder: now ECU A wins. Switch RTR to Remote and request 0x2A0 to make ECU C answer.",
    measure: `Now: ${fmtRate(rate)} with a ${(sample * 100).toFixed(1)} % sample point, one frame of ECU A ≈ ${frameBits} bits = ${fmtT(frameBits / rate)}, bus load ${(load * 100).toFixed(2)} %; ECU A sent ${f.a.txOk}, lost arbitration ${f.a.lost} times, TEC ${f.a.tec} / REC ${f.a.rec}.`,
    modify: "Remove one terminator, then both: watch the slow recessive edges in the scope and the error frames. Bring the whole network down to 125 kbps and the unterminated bench bus works again.",
    runAgain: "Load each bug example (duplicate identifier, no filter, wrong bitrate, no retransmission), read the hint and repair it, then press Run again.",
    challenge: "Press Error burst to drive ECU A into bus-off. Without AutoBusOff it stays off: load the manual recovery example (HAL_CAN_Stop / HAL_CAN_Start) and compare it with AutoBusOff = ENABLE.",
    question: "Why can a CAN node never lose data during arbitration, while two nodes sharing one identifier always corrupt each other's frames?",
    checks: [
      { label: "Watch ECU B (0x080) win arbitration over ECU A (0x120)", done: seen.arb },
      { label: "Decode a frame in the scope (SOF, ID, DLC, data, CRC, ACK)", done: seen.frame },
      { label: "Change the identifier so ECU A wins arbitration", done: seen.win },
      { label: "Send a remote frame and get the reply", done: seen.remote },
      { label: "Inject a bit error and watch TEC rise and fall", done: seen.tec },
      { label: "Drive ECU A to bus-off and recover it", done: seen.busoff },
      { label: "Break the termination, then fix it", done: seen.term },
    ],
  };

  return (
    <LabShell meta={meta} lab={shellLab} subtitle="Frames, arbitration, identifiers, dominant/recessive states and multi-node traffic."
      components={["ECU A: STM32 Nucleo-F401RE with bxCAN1 (PCLK1 42 MHz) and a CAN transceiver; runs your firmware", "ECU B (brake, 0x080) and ECU C (dashboard, 0x2A0): simulated nodes on a shared 100 ms cycle", "Twisted pair CAN_H / CAN_L with a 120 Ω terminator at each end", "Every frame is simulated bit by bit: stuffing, CRC-15, wired-AND arbitration, ACK, error flags and TEC/REC fault confinement"]}>
      <div className="mcl-grid mcl-g4-grid">
        <Panel title="CAN Network Simulator" icon="link" className="mcl-g4-vis">
          <Scene p={p} f={f} now={now} started={f.cfg.started} arb={lastArb} onToggle={toggleNode} onTerm={toggleTerm} />
          <div className="mcl-l31-read">
            <div className={`mcl-l31-chip ${fw && Number.isFinite(rpm) ? "ok" : ""}`}><span>Engine rpm (ECU A)</span><b>{fw && Number.isFinite(rpm) ? rpm : "–"}</b></div>
            <div className={`mcl-l31-chip ${fw && rxCount > 0 ? (brake === Math.round(p.brake) ? "ok" : "bad") : ""}`} title="Value of brake in the firmware, taken from ECU B's 0x080 frames"><span>Brake received</span><b>{fw && Number.isFinite(brake) ? `${brake} %` : "–"}</b></div>
            <div className={`mcl-l31-chip ${fw && rxCount > 0 ? (speed === Math.round(p.speed) ? "ok" : "bad") : ""}`} title="Value of speed in the firmware, taken from ECU C's 0x2A0 frames"><span>Speed received</span><b>{fw && Number.isFinite(speed) ? `${speed} km/h` : "–"}</b></div>
            <div className={`mcl-l31-chip ${fw ? (rxCount > 0 ? "ok" : f.frames.length > 4 ? "bad" : "") : ""}`}><span>Frames stored (RX FIFO 0)</span><b>{fw && Number.isFinite(rxCount) ? rxCount : "–"}</b></div>
          </div>
          <div className="mcl-l31-ctl">
            <label className="mcl-l31-temp"><span>Brake pedal (B)</span><input type="range" min={0} max={100} step={1} value={p.brake} aria-label="ECU B brake pedal" onChange={(ev) => lab.setParam("brake", Number(ev.target.value))} /><b>{Math.round(p.brake)} %</b></label>
            <label className="mcl-l31-temp"><span>Speed (C)</span><input type="range" min={0} max={240} step={1} value={p.speed} aria-label="ECU C vehicle speed" onChange={(ev) => lab.setParam("speed", Number(ev.target.value))} /><b>{Math.round(p.speed)} km/h</b></label>
            <label className="mcl-l31-inline">Network:<select value={p.netKbps} aria-label="ECU B and ECU C bitrate" onChange={(ev) => lab.setParam("netKbps", Number(ev.target.value))}>{NETS.map((k) => <option key={k} value={k}>{k >= 1000 ? "1 Mbps" : `${k} kbps`}</option>)}</select></label>
            <label className="mcl-l31-inline">Termination:<select value={p.term} aria-label="Bus termination" onChange={(ev) => lab.setParam("term", ev.target.value as Term)}>{TERMS.map((k) => <option key={k} value={k}>{TERM_LABEL[k]}</option>)}</select></label>
            <div className="mcl-l31-plug">
              <Toggle label="ECU B" checked={p.b} onChange={(x) => lab.setParam("b", x)} hint="Power ECU B (brake, 0x080) up or down" />
              <Toggle label="ECU C" checked={p.c} onChange={(x) => lab.setParam("c", x)} hint="Power ECU C (dashboard, 0x2A0) up or down" />
            </div>
          </div>
        </Panel>

        <Panel title="Frame Builder" icon="sliders" className="mcl-g4-cfg">
          <div className="mcl-l31-rows mcl-l32-rows">
            <label><span>Identifier</span>
              <input type="text" className="mcl-l32-id" value={idDraft ?? idCode ?? ""} disabled={disabled("id")} aria-label="ECU A identifier (hex)" spellCheck={false}
                onChange={(ev) => setIdDraft(ev.target.value)} onBlur={(ev) => { if (idDraft !== null) applyId(ev.target.value); }} onKeyDown={(ev) => { if (ev.key === "Enter") applyId((ev.target as HTMLInputElement).value); if (ev.key === "Escape") setIdDraft(null); }} />
            </label>
            <label><span>DLC</span><select value={dlcCode} disabled={disabled("dlc")} aria-label="Data length code" onChange={(ev) => edit([["dlc", ev.target.value]])}>{Array.from({ length: 9 }, (_, i) => <option key={i} value={i}>{i} byte{i === 1 ? "" : "s"}</option>)}</select></label>
            <label><span>RTR</span><select value={rtrCode} disabled={disabled("rtr")} aria-label="Frame type" onChange={(ev) => edit([["rtr", ev.target.value]])}><option value="DATA">Data</option><option value="REMOTE">Remote</option></select></label>
            <label><span>Bitrate</span><select value={kbpsCode} disabled={disabled("presc")} aria-label="ECU A bitrate" onChange={(ev) => { const pr = PRESC.find(([k]) => k === Number(ev.target.value))?.[1]; if (pr) edit([["presc", String(pr)]]); }}>{rateOpts.map((k) => <option key={k} value={k}>{k >= 1000 ? `${k / 1000} Mbps` : `${k} kbps`}</option>)}</select></label>
          </div>
          <div className="mcl-l32-toggles">
            <Toggle label="Automatic retransmission" checked={cf("nart") !== "DISABLE"} onChange={(x) => edit([["nart", x ? "ENABLE" : "DISABLE"]])} hint="hcan1.Init.AutoRetransmission: retry after lost arbitration or an error" />
            <Toggle label="Auto bus-off recovery" checked={cf("abom") === "ENABLE"} onChange={(x) => edit([["abom", x ? "ENABLE" : "DISABLE"]])} hint="hcan1.Init.AutoBusOff: rejoin the bus after 128 × 11 recessive bits" />
          </div>
          <div className="mcl-l32-payload" aria-label="Last data bytes sent by ECU A">
            <span>Payload</span>
            {Array.from({ length: 8 }, (_, i) => <code key={i} className={i < payload.length ? "" : "off"}>{i < payload.length ? hex2(payload[i]!) : "··"}</code>)}
          </div>
          <div className="mcl-l31-meters">
            <div className={`mcl-l31-meter ${mis ? "bad" : "ok"}`}>
              <span>Bit time · sample point</span>
              <i><em style={{ width: `${sample * 100}%` }} /></i>
              <b>{fmtT(1 / rate)} · {(sample * 100).toFixed(1)} % <small>{mis ? `≠ ${p.netKbps} kbps network` : `${cfgShown.presc} × ${1 + cfgShown.bs1 + cfgShown.bs2} tq`}</small></b>
            </div>
            <div className={`mcl-l31-meter ${load > 0.7 ? "bad" : load > 0.4 ? "warn" : "ok"}`}>
              <span>Frame · bus load</span>
              <i><em style={{ width: `${Math.min(100, load * 100)}%` }} /></i>
              <b>{frameBits} bits = {fmtT(frameBits / rate)} <small>· {(load * 100).toFixed(1)} %</small></b>
            </div>
          </div>
          <div className={`mcl-l31-status ${statusTone}`}>
            <Icon name={statusTone === "ok" ? "check" : "alert"} size={16} />
            <div>
              <b>{!fw ? "CAN stopped" : !f.cfg.init ? "CAN1 not initialised" : !f.cfg.started ? "CAN1 not started" : f.a.state === "off" ? "ECU A is bus-off" : problems.length ? "Check the bus" : `CAN1 on the bus · ${STATE_LABEL[f.a.state].toLowerCase()}`}</b>
              <span>{fmtRate(rate)} · {f.cfg.mode} mode · retransmit {f.cfg.init ? (f.cfg.nart ? "off" : "on") : cf("nart") === "DISABLE" ? "off" : "on"} · ABOM {f.cfg.init ? (f.cfg.abom ? "on" : "off") : cf("abom") === "ENABLE" ? "on" : "off"} · filter {f.filters.some((x) => x.on) ? "on" : "none"} · lower ID = higher priority</span>
            </div>
          </div>
          {msg ? <p className="mcl-l31-hint"><Icon name="alert" size={14} /><span>{msg}</span></p> : null}
          {lab.dirty && !pending ? <p className="mcl-l31-sub">The editor has unflashed changes: press Run to apply them.</p> : null}
        </Panel>

        <Panel title="Arbitration & Bus Levels" icon="wave" className="mcl-g4-scope mcl-l32-scopep"
          tools={<>
            <label className="mcl-l31-inline"><span className="mcl-l31-lbl">Trigger:</span><select value={p.trig} aria-label="Scope trigger" onChange={(ev) => lab.setParam("trig", ev.target.value as Trig)}>{TRIGS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
            <label className="mcl-l31-inline"><span className="mcl-l31-lbl">View:</span><select value={p.view} aria-label="Scope view" onChange={(ev) => lab.setParam("view", ev.target.value as View)}>{VIEWS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
            <label className="mcl-l31-inline"><span className="mcl-l31-lbl">TX:</span><select value={p.lane} aria-label="TX lane node" onChange={(ev) => lab.setParam("lane", ev.target.value as NodeKey)}>{KEYS.map((k) => <option key={k} value={k}>{NODE_NAME[k]}</option>)}</select></label>
          </>}>
          <Scope r={shown} view={p.view} lane={p.lane} empty={fw ? `Waiting for a frame that matches the trigger (${TRIGS.find(([k]) => k === p.trig)?.[1]}).` : "Press Run to capture CAN traffic."} />
          <p className="mcl-l31-sub">
            {shown ? <>{sel ? "Frozen" : "Triggered"} #{shown.id} at {(shown.t0 * 1e3).toFixed(3)} ms: {NODE_NAME[shown.from]} {hex3(shown.frame.id)}{shown.contenders.length > 1 ? ` won against ${shown.contenders.filter((c) => c.lostAt !== null).map((c) => NODE_NAME[c.node]).join(", ")}` : ""} · {shown.err ? shown.err.kind === "ack" ? "ACK error" : "error frame" : shown.acked ? `ACK by ${shown.ackBy.join(", ")}` : "no ACK"} · {shown.stuff.length} stuff bit{shown.stuff.length === 1 ? "" : "s"}{sel ? <> · <button type="button" className="mcl-l31-link" onClick={() => setSel(null)}>back to live</button></> : null}</> : "Orange is the selected node's CAN_TX pin: compare what it sends with what the bus carries."}
          </p>
        </Panel>

        <CodeEditor lab={lab} className="mcl-g4-code" languages={VARIANTS} />

        <Panel title="Node Monitor" icon="list" className="mcl-g4-mon"
          tools={<>
            <label className="mcl-l31-inline"><input type="checkbox" checked={follow} onChange={(ev) => setFollow(ev.target.checked)} />Auto-scroll</label>
            <button type="button" className="mcl-l31-btn" onClick={() => { clearLog(mcu); frozen.current = null; setSel(null); }}>Clear</button>
          </>}>
          <p className="mcl-l32-summary">{summary}</p>
          <table className="mcl-l32-nodes">
            <thead><tr><th>Node</th><th>ID</th><th>State</th><th>TEC</th><th>REC</th><th>Sent</th><th>Lost arb.</th><th>Errors</th></tr></thead>
            <tbody>
              {KEYS.map((k) => {
                const n = nodeOf(f, k);
                const on = k === "A" ? f.cfg.started : k === "B" ? p.b : p.c;
                return (
                  <tr key={k} className={!on ? "off" : n.state}>
                    <td>{NODE_NAME[k]}</td><td>{k === "A" && Number.isFinite(idVal) ? hex3(idVal) : hex3(NODE_ID[k])}</td>
                    <td><i />{!on ? (k === "A" ? "Not started" : "Off") : STATE_LABEL[n.state]}</td>
                    <td>{n.tec}</td><td>{n.rec}</td><td>{n.txOk}</td><td>{n.lost}</td><td>{n.errs}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="mcl-l31-counts">
            <span>{f.frames.length} frames</span>{f.dropped ? <span className="bad">Dropped {f.dropped}</span> : null}{f.filtered ? <span>Filtered {f.filtered}</span> : null}{f.recoveries ? <span className="ok">Recovered {f.recoveries}</span> : null}
            <div className="mcl-l31-faultbtns">
              <button type="button" onClick={() => injectBitError(mcu)} disabled={!fw || !f.cfg.started || f.a.state === "off"} title="Disturb the bus during ECU A's next frame">{f.injectA ? `Bit error armed (${f.injectA})` : "Inject bit error"}</button>
              <button type="button" onClick={() => injectBitError(mcu, 32)} disabled={!fw || !f.cfg.started || f.a.state === "off" || f.injectA > 0} title="Corrupt ECU A's next 32 frames: TEC climbs past 127 (error passive) and 255 (bus-off)">Error burst ×32</button>
            </div>
          </div>
          <ol className="mcl-l31-mon" ref={listRef} aria-label="CAN frame log">
            {lines.map((ln) => {
              const on = !!sel && ln.id === sel.id;
              return (
                <li key={ln.key}>
                  <button type="button" className={`${TONE_CLASS[ln.tone]} ${on ? "on" : ""}`} onClick={() => pick(ln)} aria-pressed={on} disabled={ln.id === null}>
                    <time>{(ln.t * 1e3).toFixed(3)}</time>
                    <span><Tokens s={ln.frame} /><em>{ln.text}</em></span>
                  </button>
                </li>
              );
            })}
            {!lines.length ? <li className="mcl-l31-empty">{fw ? (f.notStarted ? "No traffic from ECU A: CAN1 is not started." : "Waiting for the first frame…") : "Press Run to start."}</li> : null}
          </ol>
          {hints.slice(0, 3).map((h) => (
            <p key={h.text} className={`mcl-l31-hint ${h.tone ?? ""}`}><Icon name={h.tone === "info" ? "bulb" : "alert"} size={14} /><span>{h.text}</span>{h.fix?.map(([l, fn]) => <button key={l} type="button" onClick={fn}>{l}</button>)}</p>
          ))}
          <p className="mcl-l31-sub">{paused ? "Monitor paused: turn Auto-scroll back on or press back to live. " : ""}Click a frame to show it in the scope.{custom && fw ? " Running your own version of the program." : ""}</p>
        </Panel>

        <div className="mcl-g4-notes"><LearningNotes notes={notesData} /></div>
      </div>
    </LabShell>
  );
}
