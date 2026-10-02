import { frameBits, serialConfig, serialFrame, type Mcu, type UartFrame } from "../core/mcu";

export const DEMO = `// Lab 29: UART / Serial Communication
// ESP32 UART2: TX on GPIO17, RX on GPIO16, wired to a USB-serial adapter
#include <Arduino.h>

#define UART_BAUD   9600
#define UART_CONFIG SERIAL_8N1
#define RX_PIN      16
#define TX_PIN      17
#define LED_PIN     2

void setup() {
  pinMode(LED_PIN, OUTPUT);
  Serial2.begin(UART_BAUD, UART_CONFIG, RX_PIN, TX_PIN);
  Serial2.println("=== UART Lab 29: Serial Communication ===");
  Serial2.println("Type 'help' for available commands.");
}

void loop() {
  if (Serial2.available()) {
    String cmd = Serial2.readStringUntil('\\n');
    cmd.trim();
    if (cmd == "help") {
      Serial2.println("Available commands:");
      Serial2.println("  temp       - Read temperature (simulated)");
      Serial2.println("  led on     - Turn LED on");
      Serial2.println("  led off    - Turn LED off");
      Serial2.println("  echo <txt> - Echo back your text");
    } else if (cmd == "temp") {
      float t = 25.0 + random(-50, 50) / 10.0;
      Serial2.print("Temperature: ");
      Serial2.print(t, 1);
      Serial2.println(" C");
    } else if (cmd == "led on") {
      digitalWrite(LED_PIN, HIGH);
      Serial2.println("LED turned ON");
    } else if (cmd == "led off") {
      digitalWrite(LED_PIN, LOW);
      Serial2.println("LED turned OFF");
    } else if (cmd.startsWith("echo ")) {
      Serial2.println(cmd.substring(5));
    } else if (cmd.length() > 0) {
      Serial2.print("Unknown command: ");
      Serial2.println(cmd);
    }
  }
}
`;

export const ECHO = `// Lab 29: byte echo - every received character comes back in upper case
#include <Arduino.h>

#define UART_BAUD   9600
#define UART_CONFIG SERIAL_8N1
#define RX_PIN      16
#define TX_PIN      17

void setup() {
  Serial2.begin(UART_BAUD, UART_CONFIG, RX_PIN, TX_PIN);
  Serial2.println("Echo ready: type anything.");
}

void loop() {
  while (Serial2.available()) {
    char c = Serial2.read();
    if (c >= 'a' && c <= 'z') c = c - 32;   // to upper case
    Serial2.write(c);
  }
}
`;

export const STREAM = `// Lab 29: periodic sensor stream - one reading every PERIOD_MS
#include <Arduino.h>

#define UART_BAUD   9600
#define UART_CONFIG SERIAL_8N1
#define RX_PIN      16
#define TX_PIN      17
#define PERIOD_MS   1000

unsigned long last = 0;
int n = 0;

void setup() {
  Serial2.begin(UART_BAUD, UART_CONFIG, RX_PIN, TX_PIN);
  Serial2.println("Streaming temperature. Send 'stop' or 'go'.");
}

bool streaming = true;

void loop() {
  if (streaming && millis() - last >= PERIOD_MS) {
    last = millis();
    float t = 24.0 + random(0, 30) / 10.0;
    Serial2.print("#");
    Serial2.print(n++);
    Serial2.print(" T=");
    Serial2.print(t, 1);
    Serial2.println(" C");
  }
  if (Serial2.available()) {
    String cmd = Serial2.readStringUntil('\\n');
    cmd.trim();
    if (cmd == "stop") { streaming = false; Serial2.println("stopped"); }
    if (cmd == "go") { streaming = true; Serial2.println("streaming"); }
  }
}
`;

export const BUG_BAUD = DEMO
  .replace("// ESP32 UART2: TX on GPIO17, RX on GPIO16, wired to a USB-serial adapter", "// Bug: the firmware runs at 115200 baud while the terminal listens at 9600")
  .replace("#define UART_BAUD   9600", "#define UART_BAUD   115200");

export const BUG_PARITY = DEMO
  .replace("// ESP32 UART2: TX on GPIO17, RX on GPIO16, wired to a USB-serial adapter", "// Bug: the firmware adds an even parity bit, the terminal expects 8N1")
  .replace("#define UART_CONFIG SERIAL_8N1", "#define UART_CONFIG SERIAL_8E1");

export const BAUDS = [1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600] as const;
export const TERM_FORMATS = ["8N1", "8E1", "8O1", "8N2", "7E1", "7O1", "7N2"] as const;
export const PARITY = ["None", "Even", "Odd"] as const;
/** Output-capable pins the GPIO matrix can route UART2 TX to on a 30-pin DevKit V1. */
export const TX_PINS = [17, 1, 4, 5, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33] as const;
/** RX may also use the input-only pins 34–39. */
export const RX_PINS = [16, 3, 4, 5, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33, 34, 35] as const;
const INPUT_ONLY = new Set([34, 35, 36, 39]);
const FLASH_PINS = new Set([6, 7, 8, 9, 10, 11]);

export const fmtName = (f: UartFrame) => `${f.bits}${"NEO"[f.parity]}${f.stop}`;
export function fmtFrame(s: string): UartFrame {
  const m = /^([5-8])([NEO])([12])$/.exec(s);
  return m ? { bits: Number(m[1]), parity: (m[2] === "E" ? 1 : m[2] === "O" ? 2 : 0) as UartFrame["parity"], stop: Number(m[3]) } : { bits: 8, parity: 0, stop: 1 };
}
export const sameFrame = (a: UartFrame, b: UartFrame) => a.bits === b.bits && a.parity === b.parity && a.stop === b.stop;

export type P29 = { termBaud: number; termFmt: string; swap: boolean; rxOpen: boolean; noise: boolean; filter: "both" | "rx" | "tx"; view: "frame" | "four" | "ms20" };
export const P29_DEFAULT: P29 = { termBaud: 9600, termFmt: "8N1", swap: false, rxOpen: false, noise: false, filter: "both", view: "frame" };

/* ---------------- code ↔ panel ---------------- */
export type CodeKey = "UART_BAUD" | "UART_CONFIG" | "RX_PIN" | "TX_PIN";
const RE = (k: CodeKey) => new RegExp(`^([ \\t]*#define[ \\t]+${k}[ \\t]+)(\\S+)(.*)$`, "m");
export function codeDef(src: string, k: CodeKey): string | null { return RE(k).exec(src)?.[2] ?? null; }
export function setCodeDef(src: string, k: CodeKey, text: string) { return src.replace(RE(k), (_, h: string, _v: string, rest: string) => `${h}${text}${rest}`); }
export function configName(f: UartFrame) { return `SERIAL_${fmtName(f)}`; }
export function parseConfig(text: string | null): UartFrame | null {
  const m = text ? /^SERIAL_([5-8][NEO][12])$/.exec(text) : null;
  return m ? fmtFrame(m[1]!) : null;
}
export { serialConfig, serialFrame };

/* ---------------- line model ---------------- */
/** A wire's logic level as a list of transitions; the line idles high (mark) before the first one. */
export class Line {
  tr: number[] = [];
  lv: number[] = [];
  get level() { return this.lv.length ? this.lv[this.lv.length - 1]! : 1; }
  set(t: number, level: number) {
    if (this.level === level) return;
    const last = this.tr.length ? this.tr[this.tr.length - 1]! : -Infinity;
    this.tr.push(Math.max(t, last));
    this.lv.push(level);
  }
  private idx(t: number) {
    let lo = 0, hi = this.tr.length - 1, ans = -1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (this.tr[mid]! <= t) { ans = mid; lo = mid + 1; } else hi = mid - 1; }
    return ans;
  }
  levelAt(t: number) { const i = this.idx(t); return i < 0 ? 1 : this.lv[i]!; }
  /** First high→low transition at or after t. */
  nextFall(t: number): number | null {
    let i = this.idx(t);
    if (i < 0 || this.tr[i]! < t) i++;
    for (; i < this.tr.length; i++) if (this.lv[i] === 0) return this.tr[i]!;
    return null;
  }
  /** [t, level] points covering [a, b] for plotting. */
  points(a: number, b: number): Array<[number, number]> {
    const out: Array<[number, number]> = [[a, this.levelAt(a)]];
    for (let i = Math.max(0, this.idx(a) + 1); i < this.tr.length && this.tr[i]! <= b; i++) out.push([this.tr[i]!, this.lv[i]!]);
    return out;
  }
  trim(before: number) {
    const i = this.idx(before);
    if (i > 0) { this.tr.splice(0, i); this.lv.splice(0, i); }
  }
}

const hash = (n: number) => {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16;
  return (x >>> 0) / 2 ** 32;
};
export const NOISE_P = 0.03;

/** Bits on the wire for one character: start, data LSB first, optional parity, stop bit(s). */
export function frameBitList(byte: number, f: UartFrame): number[] {
  const bits = [0];
  let ones = 0;
  for (let k = 0; k < f.bits; k++) { const b = (byte >> k) & 1; ones += b; bits.push(b); }
  if (f.parity) bits.push(f.parity === 1 ? ones & 1 : (ones & 1) ^ 1);
  for (let s = 0; s < f.stop; s++) bits.push(1);
  return bits;
}

/** Drive one frame onto the line starting at t; EMI adds short mid-bit glitches. Returns the end time. */
export function encode(line: Line, t: number, byte: number, f: UartFrame, baud: number, noise = false, seed = 0) {
  const tb = 1 / baud;
  const bits = frameBitList(byte, f);
  bits.forEach((b, i) => {
    const a = t + i * tb;
    line.set(a, b);
    if (noise && hash(seed * 31 + i) < NOISE_P) { line.set(a + 0.35 * tb, 1 - b); line.set(a + 0.65 * tb, b); }
  });
  line.set(t + bits.length * tb, 1);
  return t + bits.length * tb;
}

export interface Decoded { start: number; t: number; byte: number; frameErr: boolean; parityErr: boolean }
export interface Receiver { cursor: number }

/** A UART receiver: wait for a falling edge, confirm the start bit at mid-bit, then sample every bit centre. */
export function decode(line: Line, rx: Receiver, baud: number, f: UartFrame, until: number): Decoded[] {
  const out: Decoded[] = [];
  const tb = 1 / baud;
  const dataEnd = 1 + f.bits + (f.parity ? 1 : 0);
  for (let guard = 0; guard < 4000; guard++) {
    const e = line.nextFall(rx.cursor);
    if (e === null) break;
    const stopAt = e + (dataEnd + 0.5) * tb;
    if (stopAt > until) { rx.cursor = e; break; }
    if (line.levelAt(e + tb / 2) !== 0) { rx.cursor = e + tb / 2; continue; }
    let byte = 0, ones = 0;
    for (let k = 0; k < f.bits; k++) { const b = line.levelAt(e + (1.5 + k) * tb); byte |= b << k; ones += b; }
    let parityErr = false;
    if (f.parity) { const p = line.levelAt(e + (1.5 + f.bits) * tb); parityErr = (f.parity === 1 ? ones & 1 : (ones & 1) ^ 1) !== p; }
    const frameErr = line.levelAt(stopAt) !== 1;
    out.push({ start: e, t: stopAt, byte, frameErr, parityErr });
    rx.cursor = stopAt;
  }
  return out;
}

/* ---------------- wiring ---------------- */
export function pinNum(key: string, fallback: number) { const m = /^GPIO(\d+)$/.exec(key); return m ? Number(m[1]) : fallback; }
export interface Wiring { tx: number; rx: number; txOk: boolean; rxOk: boolean; problem: string }
export function wiring(m: Mcu): Wiring {
  const tx = pinNum(m.uart.pins.tx, 17), rx = pinNum(m.uart.pins.rx, 16);
  let problem = "";
  if (tx === rx) problem = `TX and RX are both assigned to GPIO${tx}.`;
  else if (INPUT_ONLY.has(tx)) problem = `GPIO${tx} is input-only on the ESP32: it cannot drive TX.`;
  else if (FLASH_PINS.has(tx) || FLASH_PINS.has(rx)) problem = `GPIO6–11 are wired to the SPI flash on the DevKit and cannot be used for UART.`;
  return { tx, rx, txOk: !problem, rxOk: !problem, problem };
}

/* ---------------- serial monitor + front end ---------------- */
export interface MonLine { dir: "rx" | "tx" | "sys"; text: string; t: number; errs: number[]; open: boolean }
export interface FrameRec { id: number; dir: "tx" | "rx"; t: number; end: number; byte: number; f: UartFrame; baud: number; result?: Decoded }
export interface Stats { txBytes: number; rxBytes: number; termFrameErr: number; termParityErr: number; mcuFrameErr: number; mcuParityErr: number; lost: number; sent: number; delivered: number }
interface Front {
  fw: unknown; t: number; tx: Line; rx: Line; txSeen: number; termDec: Receiver; mcuDec: Receiver; termBusy: number;
  frames: FrameRec[]; nextId: number; stats: Stats; lastTx: number; lastRx: number; lastReply: number; lastSend: number;
}

/** The terminal window outlives firmware rebuilds, like a real serial monitor left open while re-flashing. */
export const monitor: MonLine[] = [];
export function clearMonitor() { monitor.length = 0; }
const MON_CAP = 400;
function monPush(line: MonLine) { monitor.push(line); if (monitor.length > MON_CAP) monitor.splice(0, monitor.length - MON_CAP); }
function monChar(t: number, code: number, err: boolean) {
  if (code === 13 && !err) return;
  let last = monitor[monitor.length - 1];
  if (!last || last.dir !== "rx" || !last.open) { last = { dir: "rx", text: "", t, errs: [], open: true }; monPush(last); }
  if (code === 10 && !err) { last.open = false; return; }
  if (err) last.errs.push(last.text.length);
  last.text += err ? "\uFFFD" : code < 32 ? "." : String.fromCharCode(code);
  if (last.text.length > 160) last.open = false;
}

const fronts = new WeakMap<Mcu, Front>();
const blankStats = (): Stats => ({ txBytes: 0, rxBytes: 0, termFrameErr: 0, termParityErr: 0, mcuFrameErr: 0, mcuParityErr: 0, lost: 0, sent: 0, delivered: 0 });
function fresh(m: Mcu): Front {
  return { fw: m.fw, t: m.time, tx: new Line(), rx: new Line(), txSeen: -1, termDec: { cursor: m.time }, mcuDec: { cursor: m.time }, termBusy: m.time, frames: [], nextId: 1, stats: blankStats(), lastTx: -1, lastRx: -1, lastReply: -1, lastSend: -1 };
}
export function front(m: Mcu): Front {
  let f = fronts.get(m);
  if (!f) {
    f = fresh(m);
    fronts.set(m, f);
    if (monitor.length) monPush({ dir: "sys", text: "--- ESP32 reset: firmware restarted ---", t: m.time, errs: [], open: false });
  }
  return f;
}
function pushFrame(f: Front, rec: Omit<FrameRec, "id">) {
  f.frames.push({ ...rec, id: f.nextId++ });
  if (f.frames.length > 80) f.frames.splice(0, f.frames.length - 80);
}

/** PC → ESP32: the terminal clocks the text out with its own baud rate and format. */
export function sendTerm(m: Mcu, p: P29, text: string) {
  const f = front(m);
  const tf = fmtFrame(p.termFmt);
  const shown = text.replace(/\r?\n$/, "");
  monPush({ dir: "tx", text: shown, t: m.time, errs: [], open: false });
  let t = Math.max(m.time, f.termBusy);
  for (const ch of text) {
    const byte = ch.charCodeAt(0) & 0xff;
    const end = encode(f.rx, t, byte, tf, p.termBaud, p.noise, f.nextId);
    pushFrame(f, { dir: "rx", t, end, byte, f: tf, baud: p.termBaud });
    t = end;
    f.stats.sent++;
  }
  f.termBusy = t;
  f.lastSend = m.time;
}

export function world29(m: Mcu, dt: number, p: P29) {
  let f = front(m);
  const t0 = m.time;
  if (f.fw !== m.fw || t0 < f.t - 0.0005) { f = fresh(m); fronts.set(m, f); }
  f.t = t0;
  const w = wiring(m);
  const begun = m.uart.port !== "";

  /* ESP32 → wire: frames queued by Serial2.print, newest first in the log. */
  const fresh_: Array<{ t: number; byte: number }> = [];
  const log = m.uart.log;
  for (let i = log.length - 1; i >= 0; i--) {
    const b = log[i]!;
    if (b.t <= f.txSeen) break;
    if (b.dir === "tx") fresh_.push(b);
  }
  if (fresh_.length) f.txSeen = Math.max(f.txSeen, fresh_[0]!.t);
  for (let i = fresh_.length - 1; i >= 0; i--) {
    const b = fresh_[i]!;
    if (!begun || !w.txOk) { f.stats.lost++; continue; }
    const end = encode(f.tx, b.t, b.byte, m.uart.frame, m.uart.baud, p.noise, f.nextId);
    pushFrame(f, { dir: "tx", t: b.t, end, byte: b.byte, f: { ...m.uart.frame }, baud: m.uart.baud });
    f.stats.txBytes++;
    f.lastTx = end;
  }

  /* wire → terminal: the adapter's RXD only sees ESP32 TX when the wires are crossed correctly. */
  if (!p.swap) {
    const got = decode(f.tx, f.termDec, p.termBaud, fmtFrame(p.termFmt), t0);
    for (const d of got) {
      const err = d.frameErr || d.parityErr;
      if (d.frameErr) f.stats.termFrameErr++;
      else if (d.parityErr) f.stats.termParityErr++;
      f.stats.rxBytes++;
      monChar(d.t, d.byte, err);
      f.lastReply = d.t;
      const rec = [...f.frames].reverse().find((r) => r.dir === "tx" && r.t <= d.start + 1e-9 && r.end > d.start - 1e-9);
      if (rec && !rec.result) rec.result = d;
    }
  } else f.termDec.cursor = t0;

  /* terminal → ESP32 RX pin. */
  const until = t0 + dt;
  if (!p.swap && !p.rxOpen && begun && w.rxOk) {
    const got = decode(f.rx, f.mcuDec, m.uart.baud, m.uart.frame, until);
    for (const d of got) {
      if (d.frameErr) { f.stats.mcuFrameErr++; m.uart.frameErrors++; }
      else if (d.parityErr) f.stats.mcuParityErr++;
      f.stats.delivered++;
      f.lastRx = d.t;
      const rec = [...f.frames].reverse().find((r) => r.dir === "rx" && r.t <= d.start + 1e-9 && r.end > d.start - 1e-9);
      if (rec && !rec.result) rec.result = d;
      m.schedule(Math.max(m.time, d.t), () => m.uartReceive([d.byte]));
    }
  } else f.mcuDec.cursor = Math.max(f.mcuDec.cursor, Math.min(until, f.termBusy));

  for (const [dir, ln] of [["tx", f.tx], ["rx", f.rx]] as const) {
    if (ln.tr.length <= 20000) continue;
    const cut = ln.tr[ln.tr.length - 10000]!;
    ln.trim(cut);
    f.frames = f.frames.filter((r) => r.dir !== dir || r.t >= cut);
  }
}

export const bitTime = (baud: number) => 1 / baud;
export const throughput = (baud: number, f: UartFrame) => baud / frameBits(f);
export { frameBits };
