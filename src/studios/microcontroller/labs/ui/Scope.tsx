import { useEffect, useRef } from "react";

export type Edge = [number, number];

export interface Trace {
  label: string;
  color: string;
  /** Digital trace from an edge list ([time, level] pairs, ascending). */
  edges?: Edge[];
  /** Level before the first edge in the list. */
  initial?: number;
  /** Analog/derived trace: value at time t. */
  sample?: (t: number) => number;
  /** Analog samples already collected: [time, value]. */
  points?: Array<[number, number]>;
  min?: number;
  max?: number;
  unit?: string;
  /** Draw a step plot for analog values (e.g. quantized DAC/ADC). */
  step?: boolean;
}

export interface ScopeProps {
  traces: Trace[];
  /** Right edge of the visible window (usually the current simulation time). */
  now: number;
  /** Width of the visible window in seconds. */
  window: number;
  height?: number;
  theme?: "dark" | "light";
  /** Draw each trace in its own lane (logic analyzer) instead of overlaying. */
  lanes?: boolean;
  grid?: [number, number];
  cursors?: number[];
  markers?: Array<{ t: number; label: string; color?: string }>;
  thresholds?: Array<{ value: number; color: string; label?: string; trace?: number }>;
  showLabels?: boolean;
  frame?: number;
  ariaLabel?: string;
  className?: string;
}

/** Level of a digital edge list at time t (binary search). */
export function levelAt(edges: Edge[] | undefined, t: number, initial = 0): number {
  if (!edges || !edges.length || t < edges[0]![0]) return initial;
  let lo = 0, hi = edges.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (edges[mid]![0] <= t) lo = mid; else hi = mid - 1; }
  return edges[lo]![1];
}

/** Frequency, duty and pulse widths measured from edges within [t0, t1]. */
export function measureEdges(edges: Edge[] | undefined, t0: number, t1: number) {
  const rises: number[] = [], falls: number[] = [];
  for (const [t, v] of edges ?? []) { if (t < t0 || t > t1) continue; (v ? rises : falls).push(t); }
  if (rises.length < 2) return { freq: 0, period: 0, duty: rises.length || falls.length ? NaN : levelAt(edges, t1), high: 0, low: 0, count: rises.length };
  const period = (rises[rises.length - 1]! - rises[0]!) / (rises.length - 1);
  let high = 0, n = 0;
  for (const r of rises) { const f = falls.find((x) => x > r); if (f !== undefined && f - r < period * 1.5) { high += f - r; n++; } }
  const hi = n ? high / n : 0;
  return { freq: 1 / period, period, duty: hi / period, high: hi, low: period - hi, count: rises.length };
}

export function fmtSec(s: number) {
  const a = Math.abs(s);
  if (a === 0) return "0";
  if (a < 1e-6) return `${(s * 1e9).toFixed(0)} ns`;
  if (a < 1e-3) return `${+(s * 1e6).toFixed(1)} µs`;
  if (a < 1) return `${+(s * 1e3).toFixed(2)} ms`;
  return `${+s.toFixed(3)} s`;
}

export function fmtHz(f: number) {
  if (!Number.isFinite(f) || f <= 0) return "—";
  if (f >= 1e6) return `${+(f / 1e6).toFixed(3)} MHz`;
  if (f >= 1e3) return `${+(f / 1e3).toFixed(3)} kHz`;
  return `${+f.toFixed(2)} Hz`;
}

export function Scope({ traces, now, window: span, height = 150, theme = "dark", lanes = false, grid = [10, 4], cursors = [], markers = [], thresholds = [], showLabels = true, frame, ariaLabel = "Waveform", className = "" }: ScopeProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const size = useRef({ w: 0, h: 0, dpr: 1 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      size.current = { w: entry.contentRect.width, h: entry.contentRect.height, dpr };
      el.width = Math.max(1, Math.round(entry.contentRect.width * dpr));
      el.height = Math.max(1, Math.round(entry.contentRect.height * dpr));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = ref.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    const { w, h, dpr } = size.current;
    if (!w || !h) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const dark = theme === "dark";
    ctx.fillStyle = dark ? "#0b1626" : "#ffffff";
    ctx.fillRect(0, 0, w, h);
    const padL = showLabels && lanes ? 54 : 6, padR = 6, padT = 6, padB = 16;
    const pw = w - padL - padR, ph = h - padT - padB;
    const t0 = now - span;
    const xOf = (t: number) => padL + ((t - t0) / span) * pw;

    ctx.strokeStyle = dark ? "#1d3350" : "#e5edf6";
    ctx.lineWidth = 1;
    for (let i = 0; i <= grid[0]; i++) { const x = Math.round(padL + (pw * i) / grid[0]) + 0.5; ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, padT + ph); ctx.stroke(); }
    for (let i = 0; i <= grid[1]; i++) { const y = Math.round(padT + (ph * i) / grid[1]) + 0.5; ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + pw, y); ctx.stroke(); }
    ctx.fillStyle = dark ? "#7f97b5" : "#6a7f99";
    ctx.font = "10px ui-monospace, SFMono-Regular, Consolas, monospace";
    ctx.textAlign = "left";
    ctx.fillText(`${fmtSec(span / grid[0])}/div`, padL + 2, h - 4);
    ctx.textAlign = "right";
    ctx.fillText(`t = ${fmtSec(now)}`, w - padR, h - 4);

    const n = Math.max(1, traces.length);
    traces.forEach((tr, idx) => {
      const laneTop = lanes ? padT + (ph * idx) / n : padT;
      const laneH = lanes ? ph / n : ph;
      const lo = tr.min ?? 0, hi = tr.max ?? 1;
      const yOf = (v: number) => laneTop + laneH * (lanes ? 0.15 : 0.08) + (1 - (Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo || 1)) * laneH * (lanes ? 0.7 : 0.84);
      ctx.strokeStyle = tr.color;
      ctx.lineWidth = 2;
      ctx.lineJoin = "round";
      ctx.beginPath();
      if (tr.edges) {
        const init = levelAt(tr.edges, t0, tr.initial ?? 0);
        let y = yOf(init);
        ctx.moveTo(padL, y);
        let lo2 = 0, hi2 = tr.edges.length;
        while (lo2 < hi2) { const mid = (lo2 + hi2) >> 1; if (tr.edges[mid]![0] < t0) lo2 = mid + 1; else hi2 = mid; }
        let lastX = -1, drawn = 0;
        for (let i = lo2; i < tr.edges.length; i++) {
          const [t, v] = tr.edges[i]!;
          if (t > now) break;
          const x = xOf(t);
          const ny = yOf(v);
          if (Math.abs(x - lastX) < 0.35 && drawn > 2000) { ctx.lineTo(x, yOf(1)); ctx.lineTo(x, yOf(0)); y = ny; continue; }
          ctx.lineTo(x, y); ctx.lineTo(x, ny); y = ny; lastX = x; drawn++;
        }
        ctx.lineTo(padL + pw, y);
      } else if (tr.points) {
        let first = true, prevY = 0;
        for (const [t, v] of tr.points) {
          if (t < t0 - span * 0.02 || t > now) continue;
          const x = xOf(t), y = yOf(v);
          if (first) { ctx.moveTo(x, y); first = false; } else if (tr.step) { ctx.lineTo(x, prevY); ctx.lineTo(x, y); } else ctx.lineTo(x, y);
          prevY = y;
        }
      } else if (tr.sample) {
        const N = Math.max(2, Math.floor(pw));
        let prevY = 0;
        for (let i = 0; i <= N; i++) {
          const t = t0 + (span * i) / N;
          const y = yOf(tr.sample(t));
          if (i === 0) ctx.moveTo(padL, y); else if (tr.step) { ctx.lineTo(padL + (pw * i) / N, prevY); ctx.lineTo(padL + (pw * i) / N, y); } else ctx.lineTo(padL + (pw * i) / N, y);
          prevY = y;
        }
      }
      ctx.stroke();
      if (showLabels) {
        ctx.fillStyle = tr.color;
        ctx.textAlign = "left";
        ctx.font = "600 10px ui-sans-serif, system-ui, sans-serif";
        if (lanes) ctx.fillText(tr.label, 6, laneTop + laneH / 2 + 3);
        else ctx.fillText(tr.label, padL + 4 + idx * 92, padT + 11);
      }
      for (const th of thresholds.filter((x) => (x.trace ?? 0) === idx)) {
        ctx.strokeStyle = th.color; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.2;
        const y = yOf(th.value); ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + pw, y); ctx.stroke(); ctx.setLineDash([]);
        if (th.label) { ctx.fillStyle = th.color; ctx.textAlign = "right"; ctx.fillText(th.label, padL + pw - 3, y - 3); }
      }
    });
    for (const m of markers) {
      if (m.t < t0 || m.t > now) continue;
      const x = xOf(m.t);
      ctx.strokeStyle = m.color ?? "#f59e0b"; ctx.setLineDash([3, 3]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, padT + ph); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = m.color ?? "#f59e0b"; ctx.textAlign = "left"; ctx.font = "10px ui-sans-serif, system-ui"; ctx.fillText(m.label, x + 3, padT + ph - 4);
    }
    cursors.forEach((c, i) => {
      if (c < t0 || c > now) return;
      const x = xOf(c);
      ctx.strokeStyle = i ? "#f472b6" : "#22d3ee"; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, padT + ph); ctx.stroke();
    });
  });

  return <canvas ref={ref} className={`mcl-scope ${className}`} style={{ height }} role="img" aria-label={ariaLabel} data-frame={frame} />;
}
