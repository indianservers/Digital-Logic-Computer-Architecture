import type { Mcu } from "./mcu";

interface Sample { t: number; busy: number; idle: number; bus: number; stmts: number; uart: number; txn: number; acc: Record<string, number> }

const HIST = new WeakMap<Mcu, Sample[]>();

function snap(mcu: Mcu): Sample {
  const acc: Record<string, number> = {};
  for (const [k, v] of mcu.access) acc[k] = v.r + v.w;
  return { t: mcu.time, busy: mcu.fw?.busyTime ?? 0, idle: mcu.fw?.idleTime ?? 0, bus: mcu.busCount, stmts: mcu.fw?.statements ?? 0, uart: mcu.uart.log.length ? mcu.uart.log[mcu.uart.log.length - 1]!.t : 0, txn: mcu.bus.length, acc };
}

/** Call from a lab's world(); samples every 50 ms of simulated time into a bounded history. */
export function sampleActivity(mcu: Mcu) {
  let h = HIST.get(mcu);
  if (!h) { h = [snap(mcu)]; HIST.set(mcu, h); return; }
  if (mcu.time - h[h.length - 1]!.t < 0.05 - 1e-9) return;
  h.push(snap(mcu));
  if (h.length > 120) h.splice(0, h.length - 120);
}

export interface Activity { load: number; busPerSec: number; stmtsPerSec: number; perSec: Record<string, number>; window: number }

/** Rates over the last `window` seconds of simulated time. */
export function activity(mcu: Mcu, window = 1): Activity {
  const h = HIST.get(mcu);
  const empty = { load: 0, busPerSec: 0, stmtsPerSec: 0, perSec: {}, window: 0 };
  if (!h || h.length < 2) return empty;
  const b = h[h.length - 1]!;
  let a = h[0]!;
  for (let i = h.length - 1; i >= 0; i--) { if (b.t - h[i]!.t >= window - 1e-9) { a = h[i]!; break; } a = h[i]!; }
  const dt = b.t - a.t;
  if (dt <= 0) return empty;
  const run = (b.busy - a.busy) + (b.idle - a.idle);
  const perSec: Record<string, number> = {};
  for (const k of Object.keys(b.acc)) perSec[k] = ((b.acc[k] ?? 0) - (a.acc[k] ?? 0)) / dt;
  return { load: run > 0 ? (b.busy - a.busy) / run : 0, busPerSec: (b.bus - a.bus) / dt, stmtsPerSec: (b.stmts - a.stmts) / dt, perSec, window: dt };
}

/** Recent history of one peripheral's access rate, oldest first (for sparklines). */
export function accessSeries(mcu: Mcu, per: string, points = 24): number[] {
  const h = HIST.get(mcu) ?? [];
  const out: number[] = [];
  for (let i = Math.max(1, h.length - points); i < h.length; i++) {
    const a = h[i - 1]!, b = h[i]!;
    out.push(((b.acc[per] ?? 0) - (a.acc[per] ?? 0)) / Math.max(1e-6, b.t - a.t));
  }
  return out;
}
