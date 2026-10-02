import { toNum, type Val } from "../core/cinterp";
import type { CallHook, Mcu, McuOptions } from "../core/mcu";

export const DEMO = `/* Lab 36: Keypad & Human Input - 4x4 matrix keypad, rotary encoder and push button */
#include "main.h"
#include "input.h"

#define SCAN_MS       1             /* keypad, encoder and button are sampled every SCAN_MS */
#define DEBOUNCE_MS   20            /* a key must read the same for this long before it counts */
#define SETTLE_US     5             /* wait after driving a row low before reading the columns */
#define COL_PULL      GPIO_PULLUP   /* columns idle high; a pressed key pulls one low */
#define ENC_A_PIN     GPIO_PIN_0    /* PB0: encoder channel A (CLK) */
#define ENC_B_PIN     GPIO_PIN_1    /* PB1: encoder channel B (DT) */
#define BTN_PIN       GPIO_PIN_2    /* PB2: encoder push button (SW) */

const uint16_t ROW_PIN[4] = { GPIO_PIN_0, GPIO_PIN_1, GPIO_PIN_2, GPIO_PIN_3 };   /* PC0-PC3 */
const uint16_t COL_PIN[4] = { GPIO_PIN_4, GPIO_PIN_5, GPIO_PIN_6, GPIO_PIN_7 };   /* PC4-PC7 */
const int8_t QDEC[16] = { 0, -1, 1, 0, 1, 0, 0, -1, -1, 0, 0, 1, 0, 1, -1, 0 };    /* [prev AB][now AB] */

uint8_t raw[16], state[16], cnt[16];
uint8_t enc_prev, btn_state = 1, btn_cnt;
int enc_steps, enc_pos, pressed;
uint32_t scans, next_scan;
volatile uint32_t ms_ticks;

void SysTick_Handler(void) { ms_ticks++; }                     /* 1 ms system tick */

void gpio_init(void) {
  __HAL_RCC_GPIOB_CLK_ENABLE();
  __HAL_RCC_GPIOC_CLK_ENABLE();
  GPIO_InitTypeDef rows = {0};
  rows.Pin = GPIO_PIN_0 | GPIO_PIN_1 | GPIO_PIN_2 | GPIO_PIN_3;
  rows.Mode = GPIO_MODE_OUTPUT_PP;
  HAL_GPIO_Init(GPIOC, &rows);
  HAL_GPIO_WritePin(GPIOC, rows.Pin, GPIO_PIN_SET);           /* every row idles high */
  GPIO_InitTypeDef cols = {0};
  cols.Pin = GPIO_PIN_4 | GPIO_PIN_5 | GPIO_PIN_6 | GPIO_PIN_7;
  cols.Mode = GPIO_MODE_INPUT;
  cols.Pull = COL_PULL;
  HAL_GPIO_Init(GPIOC, &cols);
  GPIO_InitTypeDef enc = {0};
  enc.Pin = GPIO_PIN_0 | GPIO_PIN_1 | GPIO_PIN_2;
  enc.Mode = GPIO_MODE_INPUT;
  enc.Pull = GPIO_PULLUP;
  HAL_GPIO_Init(GPIOB, &enc);
}

void scan_keypad(void) {
  for (int r = 0; r < 4; r++) {
    HAL_GPIO_WritePin(GPIOC, ROW_PIN[r], GPIO_PIN_RESET);    /* drive one row low */
    delay_us(SETTLE_US);                                      /* let the column lines settle */
    for (int c = 0; c < 4; c++) raw[r * 4 + c] = !HAL_GPIO_ReadPin(GPIOC, COL_PIN[c]);
    HAL_GPIO_WritePin(GPIOC, ROW_PIN[r], GPIO_PIN_SET);      /* release the row again */
  }
}

void debounce_keys(void) {
  for (int k = 0; k < 16; k++) {
    if (raw[k] == state[k]) { cnt[k] = 0; continue; }
    cnt[k]++;
    if (cnt[k] * SCAN_MS < DEBOUNCE_MS) continue;            /* not stable for long enough yet */
    state[k] = raw[k];
    cnt[k] = 0;
    pressed += state[k] ? 1 : -1;
    event_push(state[k] ? EV_KEY_DOWN : EV_KEY_UP, k);
  }
}

void encoder_update(void) {
  uint8_t ab = (HAL_GPIO_ReadPin(GPIOB, ENC_A_PIN) << 1) | HAL_GPIO_ReadPin(GPIOB, ENC_B_PIN);
  enc_steps += QDEC[(enc_prev << 2) | ab];                    /* +1, -1 or 0 per transition */
  enc_prev = ab;
  if (enc_steps >= 4)  { enc_steps -= 4; enc_pos++; event_push(EV_ENCODER, 1); }
  if (enc_steps <= -4) { enc_steps += 4; enc_pos--; event_push(EV_ENCODER, -1); }
}

void button_update(void) {
  uint8_t lv = HAL_GPIO_ReadPin(GPIOB, BTN_PIN);
  if (lv == btn_state) { btn_cnt = 0; return; }
  btn_cnt++;
  if (btn_cnt * SCAN_MS < DEBOUNCE_MS) return;
  btn_state = lv;
  btn_cnt = 0;
  event_push(EV_BUTTON, !btn_state);                          /* 1 = press, 0 = release */
}

int main(void) {
  HAL_Init();
  SysTick_Config(SystemCoreClock / 1000);
  gpio_init();
  enc_prev = (HAL_GPIO_ReadPin(GPIOB, ENC_A_PIN) << 1) | HAL_GPIO_ReadPin(GPIOB, ENC_B_PIN);
  while (1) {
    while (ms_ticks < next_scan) __WFI();                     /* sleep until the next scan slot */
    next_scan = ms_ticks + SCAN_MS;
    scan_keypad();
    debounce_keys();
    encoder_update();
    button_update();
    scans++;
  }
}
`;

const swap = (src: string, pairs: Array<[string, string]>) => pairs.reduce((s, [a, b]) => { if (!s.includes(a)) throw new Error(`L36 variant: missing ${a}`); return s.replace(a, b); }, src);
const TITLE = "Lab 36: Keypad & Human Input - 4x4 matrix keypad, rotary encoder and push button";
export const ROW_RELEASE_LINE = "    HAL_GPIO_WritePin(GPIOC, ROW_PIN[r], GPIO_PIN_SET);      /* release the row again */\n";

export const BUG_BOUNCE = swap(DEMO, [[TITLE, "Lab 36 bug: one press types the same key two or three times"], ["#define DEBOUNCE_MS   20", "#define DEBOUNCE_MS   0 "]]);
export const BUG_SETTLE = swap(DEMO, [[TITLE, "Lab 36 bug: pressing 5 also types 8"], ["#define SETTLE_US     5", "#define SETTLE_US     0"]]);
export const BUG_FLOAT = swap(DEMO, [[TITLE, "Lab 36 bug: keys fire on their own"], ["#define COL_PULL      GPIO_PULLUP", "#define COL_PULL      GPIO_NOPULL"]]);
export const BUG_ROWLOW = swap(DEMO, [[TITLE, "Lab 36 bug: one key fires its whole column"], [ROW_RELEASE_LINE, ""]]);
export const BUG_SLOW = swap(DEMO, [[TITLE, "Lab 36 bug: a fast turn of the encoder loses steps"], ["#define SCAN_MS       1 ", "#define SCAN_MS       10"]]);
export const BUG_ENCDIR = swap(DEMO, [[TITLE, "Lab 36 bug: turning the encoder clockwise counts down"], ["#define ENC_A_PIN     GPIO_PIN_0", "#define ENC_A_PIN     GPIO_PIN_1"], ["#define ENC_B_PIN     GPIO_PIN_1", "#define ENC_B_PIN     GPIO_PIN_0"]]);

export const VARIANTS = [
  { label: "C (STM32 HAL)", code: DEMO },
  { label: "Bug: no debounce", code: BUG_BOUNCE },
  { label: "Bug: no settle delay", code: BUG_SETTLE },
  { label: "Bug: floating columns", code: BUG_FLOAT },
  { label: "Bug: row never released", code: BUG_ROWLOW },
  { label: "Bug: slow scan loses steps", code: BUG_SLOW },
  { label: "Bug: encoder A/B swapped", code: BUG_ENCDIR },
];

export type FieldKey = "scan" | "debounce" | "settle" | "pull" | "encA" | "encB";
const FIELDS: Record<FieldKey, RegExp> = {
  scan: /^(#define\s+SCAN_MS\s+)(\S+)/m,
  debounce: /^(#define\s+DEBOUNCE_MS\s+)(\S+)/m,
  settle: /^(#define\s+SETTLE_US\s+)(\S+)/m,
  pull: /^(#define\s+COL_PULL\s+)(\S+)/m,
  encA: /^(#define\s+ENC_A_PIN\s+)(\S+)/m,
  encB: /^(#define\s+ENC_B_PIN\s+)(\S+)/m,
};
export const codeField = (src: string, k: FieldKey) => src.match(FIELDS[k])?.[2] ?? null;
export const setCodeField = (src: string, k: FieldKey, v: string) => src.replace(FIELDS[k], (_m, a: string) => `${a}${v}`);

export const EV = { EV_KEY_DOWN: 1, EV_KEY_UP: 2, EV_ENCODER: 3, EV_BUTTON: 4 } as const;

/* ---------------- hardware ---------------- */

export const KEYS = ["1", "2", "3", "A", "4", "5", "6", "B", "7", "8", "9", "C", "*", "0", "#", "D"];
export const ROW_PINS = ["PC0", "PC1", "PC2", "PC3"];
export const COL_PINS = ["PC4", "PC5", "PC6", "PC7"];
export const ENC_PINS = ["PB0", "PB1", "PB2"];
/** Worst-case STM32 internal pull-up (datasheet range 30-50 kOhm). */
export const PULLUP_OHM = 50e3;
export const CABLES = [
  { label: "Short header (20 pF)", pf: 20 },
  { label: "Keypad on 30 cm ribbon (150 pF)", pf: 150 },
  { label: "Keypad on 1 m cable (300 pF)", pf: 300 },
];
/** Time for a released column to climb back to V_IH (0.7 VDD) through the internal pull-up. */
export const riseTime = (pf: number) => 1.2 * PULLUP_OHM * pf * 1e-12;
export const DETENTS_PER_REV = 20;
export const STEP_T = 4e-3;
export const DRAG_T = 2.5e-3;

export type P36 = { sel: number; bounce: number; cable: number; diodes: boolean; latch: boolean; spin: number; view: string; trig: boolean };
export const P36_DEFAULT: P36 = { sel: 5, bounce: 5, cable: 1, diodes: false, latch: false, spin: 0, view: "deb", trig: true };

/* ---------------- state ---------------- */

export type Edge = [number, number];
export type Cause = "floating" | "ghost" | "stale" | "rows" | "unknown";
export type Flag = "dup" | "phantom" | "bounce" | null;
export interface InEvent { id: number; t: number; type: number; code: number; flag: Flag; cause?: Cause; latency?: number }
interface Contact { down: boolean; edges: Edge[]; pressT: number; relT: number; presses: number; fwDowns: number }
interface Enc { q: number; target: number; nextT: number; dir: number; period: number; edgesA: Edge[]; edgesB: Edge[]; lastMove: number; lastReadQ: number; skips: number; lastSkip: number; moved: number }

export interface Front {
  p: P36;
  keys: Contact[];
  btn: Contact;
  enc: Enc;
  req: Array<{ k: number; down: boolean }>;
  fwDown: boolean[];
  fwDeb: Edge[][];
  sampled: Edge[][];
  fwBtn: boolean;
  fwEnc: number;
  encTrace: Edge[];
  events: InEvent[];
  nextId: number;
  scanStarts: number[];
  lastColRead: number;
  multiRow: boolean;
  float: Array<{ level: number; next: number }>;
  phantoms: number;
  causes: Record<Cause, number>;
  causeT: Record<Cause, number>;
  lastPhantom: { k: number; cause: Cause; t: number } | null;
  dups: number;
  lastDup: { k: number; n: number; t: number } | null;
  lastLatency: number;
  seed: number;
  reads: number;
}

const hash = (n: number) => { let x = (n * 2654435761) >>> 0; x ^= x >>> 15; x = Math.imul(x, 2246822519) >>> 0; x ^= x >>> 13; return x >>> 0; };
const rnd = (f: Front) => (hash(++f.seed) % 10000) / 10000;
const contact = (): Contact => ({ down: false, edges: [], pressT: -1, relT: -1, presses: 0, fwDowns: 0 });

const FRONT = new WeakMap<Mcu, Front>();
export function front(m: Mcu): Front {
  let f = FRONT.get(m);
  if (!f) {
    f = {
      p: P36_DEFAULT,
      keys: Array.from({ length: 16 }, contact), btn: contact(),
      enc: { q: 0, target: 0, nextT: Infinity, dir: 0, period: STEP_T, edgesA: [], edgesB: [], lastMove: -1, lastReadQ: 0, skips: 0, lastSkip: -1, moved: 0 },
      req: [], fwDown: Array(16).fill(false), fwDeb: Array.from({ length: 16 }, () => []), sampled: Array.from({ length: 16 }, () => []),
      fwBtn: false, fwEnc: 0, encTrace: [[0, 0]], events: [], nextId: 1, scanStarts: [], lastColRead: -1, multiRow: false,
      float: [0, 1, 2, 3].map((c) => ({ level: hash(c + 91) & 1, next: 0.25 + c * 0.37 })),
      phantoms: 0, causes: { floating: 0, ghost: 0, stale: 0, rows: 0, unknown: 0 }, causeT: { floating: -1, ghost: -1, stale: -1, rows: -1, unknown: -1 }, lastPhantom: null,
      dups: 0, lastDup: null, lastLatency: -1, seed: 36, reads: 0,
    };
    FRONT.set(m, f);
  }
  return f;
}

export function levelAt(edges: Edge[], t: number, initial = 0): number {
  if (!edges.length || t < edges[0]![0]) return initial;
  let lo = 0, hi = edges.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (edges[mid]![0] <= t) lo = mid; else hi = mid - 1; }
  return edges[lo]![1];
}
const trim = (e: Edge[], max = 1500) => { if (e.length > max) e.splice(0, e.length - max); };
const pushEdge = (e: Edge[], t: number, v: number) => { if (e.length && e[e.length - 1]![1] === v) return; e.push([t, v]); trim(e); };

/** Mechanical contact: chatters between closed and open for `ms`, then settles (seeded, so runs repeat exactly). */
function bounceEdges(f: Front, c: Contact, t0: number, closed: boolean, ms: number) {
  const settle = closed ? 1 : 0;
  const dur = (closed ? ms : ms * 0.6) / 1000;
  while (c.edges.length && c.edges[c.edges.length - 1]![0] >= t0) c.edges.pop();
  if (dur <= 0) { c.edges.push([t0, settle]); trim(c.edges); return; }
  const n = 2 * Math.max(1, Math.round(ms * (0.45 + rnd(f) * 0.3))) + 1;
  const ts = Array.from({ length: n }, () => rnd(f)).sort((a, b) => a - b);
  ts[0] = 0; ts[n - 1] = 1;
  ts.forEach((u, i) => c.edges.push([t0 + u * dur, i % 2 === 0 ? settle : 1 - settle]));
  trim(c.edges);
}
export const isClosed = (c: Contact, t: number) => levelAt(c.edges, t) === 1;

/* ---------------- matrix electrical model ---------------- */

function rowPulls(m: Mcu, r: number, t: number, rise: number) {
  const key = ROW_PINS[r]!;
  const p = m.pin(key);
  if (p.mode !== "out") return false;
  if (p.out === 0) return true;
  const e = m.edges.get(key);
  const last = e?.[e.length - 1];
  return !!last && last[1] === 1 && t - last[0] < rise;
}
export function rowsLow(m: Mcu) { return [0, 1, 2, 3].filter((r) => { const p = m.pin(ROW_PINS[r]!); return p.mode === "out" && p.out === 0; }); }

/** Rows that column `c` is connected to through closed keys (through other keys too when there are no diodes). */
export function reach(f: Front, c: number, t: number): number[] {
  const closed = (r: number, cc: number) => isClosed(f.keys[r * 4 + cc]!, t);
  if (f.p.diodes) return [0, 1, 2, 3].filter((r) => closed(r, c));
  const rows = new Set<number>(), cols = new Set<number>([c]), stack = [c];
  while (stack.length) {
    const cc = stack.pop()!;
    for (let r = 0; r < 4; r++) {
      if (rows.has(r) || !closed(r, cc)) continue;
      rows.add(r);
      for (let c2 = 0; c2 < 4; c2++) if (!cols.has(c2) && closed(r, c2)) { cols.add(c2); stack.push(c2); }
    }
  }
  return [...rows];
}

export function columnLevel(m: Mcu, f: Front, c: number, t: number): number {
  const rise = riseTime(CABLES[f.p.cable]?.pf ?? 60);
  const low = reach(f, c, t).some((r) => rowPulls(m, r, t, rise));
  const pull = m.pin(COL_PINS[c]!).pull;
  if (pull === "up") return low ? 0 : 1;
  const fl = f.float[c]!;
  if (low) { fl.level = 0; fl.next = Math.max(fl.next, t + 0.15 + rnd(f) * 0.3); return 0; }
  if (pull === "down") return 0;
  if (t >= fl.next) { fl.level ^= 1; fl.next = t + 0.3 + rnd(f) * 1.2; }
  return fl.level;
}

/* ---------------- encoder ---------------- */

export const encAB = (q: number) => { const s = ((q % 4) + 4) % 4; return { a: [1, 0, 0, 1][s]!, b: [1, 1, 0, 0][s]! }; };

function encStep(f: Front, t: number, dir: number) {
  const e = f.enc;
  e.q += dir;
  e.lastMove = t;
  e.moved += dir;
  const { a, b } = encAB(e.q);
  const prevA = levelAt(e.edgesA, t, 1), prevB = levelAt(e.edgesB, t, 1);
  const chatter = f.p.bounce > 0 && e.period > 0.6e-3;
  const add = (edges: Edge[], prev: number, now: number) => {
    if (prev === now) return;
    edges.push([t, now]);
    if (chatter) { edges.push([t + 60e-6, prev]); edges.push([t + 140e-6, now]); }
    trim(edges, 3000);
  };
  add(e.edgesA, prevA, a);
  add(e.edgesB, prevB, b);
}

/** Queue a turn of `detents` clicks (positive = clockwise). */
export function turn36(m: Mcu, detents: number, fast = false) {
  const e = front(m).enc;
  e.target = Math.round(e.target / 4) * 4 + detents * 4;
  e.period = fast ? DRAG_T : STEP_T;
}
export const MIN_HOLD = 0.08;
export function press36(m: Mcu, k: number, down: boolean) { front(m).req.push({ k, down }); }

/* ---------------- HAL binding ---------------- */

const portOf = (a: Val | undefined) => (typeof a === "string" ? a : a && typeof a === "object" && a.kind === "ref" ? a.name : "").replace(/^GPIO/, "");
const bitOf = (mask: number) => { for (let i = 0; i < 16; i++) if ((mask >> i) & 1) return i; return -1; };

function classify(m: Mcu, f: Front, k: number, t: number): Cause {
  const r = k >> 2, c = k & 3;
  if (m.pin(COL_PINS[c]!).pull !== "up") return "floating";
  if (!f.p.diodes && reach(f, c, t).includes(r)) return "ghost";
  if (f.multiRow) return "rows";
  if (r > 0) {
    const kb = f.keys[(r - 1) * 4 + c]!;
    if (kb.down || (kb.relT >= 0 && t - kb.relT < 0.1)) return "stale";
  }
  return "unknown";
}

const hook: CallHook = (name, args, m) => {
  const f = front(m);
  const t = m.now;
  if (name === "HAL_GPIO_ReadPin") {
    const port = portOf(args[0]), bit = bitOf(toNum(args[1] ?? 0));
    if (port === "C" && bit >= 4 && bit <= 7 && m.pin(`PC${bit}`).mode === "in") {
      const c = bit - 4;
      if (c === 0) {
        if (t - f.lastColRead > 200e-6) { f.scanStarts.push(t); if (f.scanStarts.length > 60) f.scanStarts.splice(0, f.scanStarts.length - 60); }
        f.lastColRead = t;
      }
      const low = rowsLow(m);
      f.multiRow = low.length > 1;
      const lv = columnLevel(m, f, c, t);
      if (low.length === 1) pushEdge(f.sampled[low[0]! * 4 + c]!, t, lv ? 0 : 1);
      f.reads++;
      return lv;
    }
    if (port === "B" && bit >= 0 && bit <= 2 && m.pin(`PB${bit}`).mode === "in") {
      const e = f.enc;
      if (bit === 2) return isClosed(f.btn, t) ? 0 : 1;
      if (bit === 0) {
        if (Math.abs(e.q - e.lastReadQ) >= 2) { e.skips++; e.lastSkip = t; }
        e.lastReadQ = e.q;
      }
      return bit === 0 ? levelAt(e.edgesA, t, 1) : levelAt(e.edgesB, t, 1);
    }
    return undefined;
  }
  if (name === "event_push") {
    const type = toNum(args[0] ?? 0), code = Math.trunc(toNum(args[1] ?? 0));
    const ev: InEvent = { id: f.nextId++, t, type, code, flag: null };
    if (type === EV.EV_KEY_DOWN || type === EV.EV_KEY_UP) {
      const k = Math.max(0, Math.min(15, code));
      const kc = f.keys[k]!;
      const real = kc.down || (kc.relT >= 0 && t - kc.relT < 0.1);
      const down = type === EV.EV_KEY_DOWN;
      f.fwDown[k] = down;
      pushEdge(f.fwDeb[k]!, t, down ? 1 : 0);
      if (down) {
        if (!real) {
          const cause = classify(m, f, k, t);
          ev.flag = "phantom"; ev.cause = cause;
          f.phantoms++; f.causes[cause]++; f.causeT[cause] = t; f.lastPhantom = { k, cause, t };
        } else {
          kc.fwDowns++;
          if (kc.fwDowns > 1) { ev.flag = "dup"; f.dups++; f.lastDup = { k, n: kc.fwDowns, t }; }
          else if (kc.down) { ev.latency = t - kc.pressT; f.lastLatency = ev.latency; }
        }
      } else if (kc.down && t - kc.pressT < 0.1) ev.flag = "bounce";
    } else if (type === EV.EV_ENCODER) {
      f.fwEnc += code > 0 ? 1 : -1;
      f.encTrace.push([t, f.fwEnc]);
      if (f.encTrace.length > 600) f.encTrace.splice(0, f.encTrace.length - 600);
    } else if (type === EV.EV_BUTTON) {
      const b = f.btn;
      f.fwBtn = code !== 0;
      if (code) { b.fwDowns++; if (b.fwDowns > 1) { ev.flag = "dup"; f.dups++; f.lastDup = { k: 16, n: b.fwDowns, t }; } else if (b.down) { ev.latency = t - b.pressT; f.lastLatency = ev.latency; } }
      else if (b.down && t - b.pressT < 0.1) ev.flag = "bounce";
    }
    f.events.push(ev);
    if (f.events.length > 300) f.events.splice(0, f.events.length - 300);
    return 0;
  }
  return undefined;
};

export function mcu36(): McuOptions {
  return { family: "stm32", constants: { ...EV }, onCall: hook };
}

/* ---------------- world ---------------- */

export function world36(m: Mcu, dt: number, p: P36) {
  const f = front(m);
  f.p = p;
  const t = m.time;
  const queue = f.req.splice(0);
  for (let i = 0; i < queue.length; i++) {
    const r = queue[i]!;
    const c = r.k === 16 ? f.btn : f.keys[r.k];
    if (!c || c.down === r.down) continue;
    // A human finger stays on the key for at least MIN_HOLD, however quick the click.
    if (!r.down && t < c.pressT + MIN_HOLD) { f.req.push(...queue.slice(i)); break; }
    c.down = r.down;
    if (r.down) { c.pressT = t; c.presses++; c.fwDowns = 0; } else c.relT = t;
    bounceEdges(f, c, t, r.down, p.bounce);
  }
  const e = f.enc;
  const spinning = p.spin !== 0;
  if (!spinning && e.target === e.q && e.q % 4 !== 0) e.target = Math.round(e.q / 4) * 4;
  if (spinning) e.period = 1 / (4 * Math.abs(p.spin));
  const dir = spinning ? Math.sign(p.spin) : Math.sign(e.target - e.q);
  if (dir === 0) { e.nextT = Infinity; e.dir = 0; return; }
  if (e.dir !== dir || !Number.isFinite(e.nextT)) e.nextT = t + Math.min(e.period, 0.3e-3);
  e.dir = dir;
  while (e.nextT <= t + dt) {
    if (!spinning && e.q === e.target) { e.nextT = Infinity; e.dir = 0; break; }
    encStep(f, e.nextT, dir);
    e.nextT += e.period;
  }
  if (spinning) e.target = e.q;
}

/* ---------------- analysis helpers (UI + tests) ---------------- */

export function scanRate(f: Front, now: number) {
  const s = f.scanStarts.filter((x) => x > now - 0.1);
  return s.length >= 3 ? (s.length - 1) / (s[s.length - 1]! - s[0]!) : 0;
}
export const trueDetents = (f: Front) => Math.round(f.enc.q / 4);
export const encIdle = (f: Front, now: number) => f.enc.q === f.enc.target && f.p.spin === 0 && now - f.enc.lastMove > 0.08;
export function fwArray(m: Mcu, name: string): number[] | null {
  const v = m.fw?.globalValue(name);
  if (!v || typeof v !== "object" || v.kind !== "arr") return null;
  return (v.slot.data ?? []).slice(v.off, v.off + 16).map((x) => (typeof x === "number" ? x : 0));
}
export const evText = (e: InEvent) => (e.type === EV.EV_KEY_DOWN ? `KEY ${KEYS[e.code] ?? e.code} DOWN` : e.type === EV.EV_KEY_UP ? `KEY ${KEYS[e.code] ?? e.code} UP` : e.type === EV.EV_ENCODER ? `ENCODER ${e.code > 0 ? "+1" : "-1"}` : e.type === EV.EV_BUTTON ? (e.code ? "BUTTON PRESS" : "BUTTON RELEASE") : `EVENT ${e.type}:${e.code}`);
export function clearEvents(m: Mcu) { const f = front(m); f.events = []; }
