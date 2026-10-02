import { Block, toNum, type Val } from "../core/cinterp";
import { readBytes, writeBytes, type CallHook, type Mcu, type McuOptions } from "../core/mcu";

export const DEMO = `/* Lab 34: Sensor Interfacing - DHT22, BH1750, BMP280, HC-SR04 and a PIR on one STM32 */
#include "main.h"

#define BH1750_ADDR     0x23        /* 7-bit address, ADDR pin low (0x5C when high) */
#define BMP280_ADDR     0x76        /* SDO tied to GND */
#define DHT_PERIOD_MS   2000        /* DHT22: at most one reading every 2 s */
#define TRIG_US         10          /* HC-SR04 needs a trigger pulse of at least 10 us */
#define US_PER_CM       58          /* echo time for 1 cm out and back at 343 m/s */
#define LOOP_MS         100

I2C_HandleTypeDef hi2c1;
float temp, hum, lux, pressure, distance;
int motion;
int dht_err, i2c_err, echo_err, reads;
uint32_t last_dht;

void MX_GPIO_Init(void) {
  GPIO_InitTypeDef g = {0};
  g.Pin = GPIO_PIN_8;                  /* PA8 -> HC-SR04 TRIG */
  g.Mode = GPIO_MODE_OUTPUT_PP;
  HAL_GPIO_Init(GPIOA, &g);
  g.Pin = GPIO_PIN_0;                  /* PB0 <- PIR OUT */
  g.Mode = GPIO_MODE_INPUT;
  g.Pull = GPIO_PULLDOWN;
  HAL_GPIO_Init(GPIOB, &g);
}

void MX_I2C1_Init(void) {
  hi2c1.Instance = I2C1;               /* PB8 = SCL, PB9 = SDA, 4.7 k pull-ups */
  hi2c1.Init.ClockSpeed = 100000;
  HAL_I2C_Init(&hi2c1);
}

float dht22_read_temp(void) {
  uint16_t raw_h, raw_t;
  if (HAL_GetTick() - last_dht < DHT_PERIOD_MS) return temp;    /* too soon: keep the last value */
  last_dht = HAL_GetTick();
  if (dht22_read(&raw_h, &raw_t) != DHT_OK) { dht_err++; return temp; }   /* 40-bit frame on PA1 */
  hum = raw_h / 10.0f;
  if (raw_t & 0x8000) return -(raw_t & 0x7FFF) / 10.0f;         /* bit 15 set = below 0 C */
  return raw_t / 10.0f;
}

void bh1750_init(void) {
  uint8_t cmd = 0x10;                                           /* continuous high-resolution mode, 1 lx */
  HAL_I2C_Master_Transmit(&hi2c1, BH1750_ADDR << 1, &cmd, 1, 10);
}

float bh1750_read_lux(void) {
  uint8_t d[2];
  if (HAL_I2C_Master_Receive(&hi2c1, BH1750_ADDR << 1, d, 2, 10) != HAL_OK) { i2c_err++; return lux; }
  return ((d[0] << 8) | d[1]) / 1.2f;                           /* datasheet: lx = count / 1.2 */
}

void bmp280_init(void) {
  uint8_t mode = 0x27;                                          /* ctrl_meas: osrs_t x1, osrs_p x1, normal mode */
  HAL_I2C_Mem_Write(&hi2c1, BMP280_ADDR << 1, 0xF4, I2C_MEMADD_SIZE_8BIT, &mode, 1, 10);
}

float bmp280_read_pressure(void) {
  uint8_t d[3];
  if (HAL_I2C_Mem_Read(&hi2c1, BMP280_ADDR << 1, 0xF7, I2C_MEMADD_SIZE_8BIT, d, 3, 10) != HAL_OK) { i2c_err++; return pressure; }
  int32_t adc_P = (d[0] << 12) | (d[1] << 4) | (d[2] >> 4);     /* 20-bit raw pressure */
  return bmp280_compensate_P(adc_P) / 100.0f;                   /* factory trim compensation -> Pa -> hPa */
}

float hcsr04_distance_cm(void) {
  HAL_GPIO_WritePin(GPIOA, GPIO_PIN_8, GPIO_PIN_SET);           /* TRIG high ... */
  delay_us(TRIG_US);
  HAL_GPIO_WritePin(GPIOA, GPIO_PIN_8, GPIO_PIN_RESET);         /* ... then low: the module sends 8 x 40 kHz */
  uint32_t us = echo_pulse_us(30000);                           /* ECHO high time on PA9, 30 ms timeout */
  if (us == 0) { echo_err++; return -1; }                       /* no echo: nothing within 4 m */
  return (float)us / US_PER_CM;
}

int pir_read(void) {
  return HAL_GPIO_ReadPin(GPIOB, GPIO_PIN_0);                   /* HC-SR501 OUT: high while motion is seen */
}

int main(void) {
  HAL_Init();
  MX_GPIO_Init();
  MX_I2C1_Init();
  bh1750_init();
  bmp280_init();
  while (1) {
    temp     = dht22_read_temp();
    lux      = bh1750_read_lux();
    pressure = bmp280_read_pressure();
    distance = hcsr04_distance_cm();
    motion   = pir_read();
    reads++;
    HAL_Delay(LOOP_MS);
  }
}
`;

const swap = (src: string, pairs: Array<[string, string]>) => pairs.reduce((s, [a, b]) => { if (!s.includes(a)) throw new Error(`L34 variant: missing ${a}`); return s.replace(a, b); }, src);
const TITLE = "Lab 34: Sensor Interfacing - DHT22, BH1750, BMP280, HC-SR04 and a PIR on one STM32";
const DIST_LINE = "  return (float)us / US_PER_CM;";
export const SIGN_LINE = "  if (raw_t & 0x8000) return -(raw_t & 0x7FFF) / 10.0f;         /* bit 15 set = below 0 C */\n";
export const INIT_LINE = "  bmp280_init();\n";
export const COMP_LINE = "  return (float)us * (331.3f + 0.606f * temp) / 20000.0f;     /* speed of sound from the DHT22 temperature */";

export const TEMPCOMP = swap(DEMO, [[TITLE, "Lab 34: temperature-compensated ultrasonic distance - c = 331.3 + 0.606 T m/s"], [DIST_LINE, COMP_LINE]]);
export const BUG_DHTFAST = swap(DEMO, [[TITLE, "Lab 34 bug: the DHT22 keeps reporting errors"], ["#define DHT_PERIOD_MS   2000", "#define DHT_PERIOD_MS   500 "]]);
export const BUG_SIGN = swap(DEMO, [[TITLE, "Lab 34 bug: below 0 C the thermometer reads over 3000 C"], [SIGN_LINE, ""]]);
export const BUG_ADDR = swap(DEMO, [[TITLE, "Lab 34 bug: the light sensor never answers"], ["#define BH1750_ADDR     0x23", "#define BH1750_ADDR     0x46"]]);
export const BUG_SLEEP = swap(DEMO, [[TITLE, "Lab 34 bug: the pressure is stuck at 700 hPa"], [INIT_LINE, ""]]);
export const BUG_TRIG = swap(DEMO, [[TITLE, "Lab 34 bug: the distance is always -1"], ["#define TRIG_US         10", "#define TRIG_US         2 "]]);
export const BUG_SCALE = swap(DEMO, [[TITLE, "Lab 34 bug: every distance reads twice too far"], ["#define US_PER_CM       58", "#define US_PER_CM       29"]]);

export const VARIANTS = [
  { label: "C (STM32 HAL)", code: DEMO },
  { label: "Temperature-compensated distance", code: TEMPCOMP },
  { label: "Bug: DHT22 polled too fast", code: BUG_DHTFAST },
  { label: "Bug: negative temperatures", code: BUG_SIGN },
  { label: "Bug: BH1750 address shifted twice", code: BUG_ADDR },
  { label: "Bug: BMP280 left asleep", code: BUG_SLEEP },
  { label: "Bug: trigger pulse too short", code: BUG_TRIG },
  { label: "Bug: one-way echo time", code: BUG_SCALE },
];

export type FieldKey = "dht" | "trig" | "uscm" | "bh" | "loop";
const FIELDS: Record<FieldKey, RegExp> = {
  dht: /^(#define\s+DHT_PERIOD_MS\s+)(\S+)/m,
  trig: /^(#define\s+TRIG_US\s+)(\S+)/m,
  uscm: /^(#define\s+US_PER_CM\s+)(\S+)/m,
  bh: /^(#define\s+BH1750_ADDR\s+)(\S+)/m,
  loop: /^(#define\s+LOOP_MS\s+)(\S+)/m,
};
export const codeField = (src: string, k: FieldKey) => src.match(FIELDS[k])?.[2] ?? null;
export const setCodeField = (src: string, k: FieldKey, v: string) => src.replace(FIELDS[k], (_m, a: string) => `${a}${v}`);

export const SENSOR_CONST: Record<string, number> = {
  DHT_OK: 0, DHT_TIMEOUT: 1, DHT_CHECKSUM: 2,
  I2C_MEMADD_SIZE_8BIT: 1, I2C_MEMADD_SIZE_16BIT: 0x10, I2C_DUTYCYCLE_2: 0, I2C_ADDRESSINGMODE_7BIT: 0x4000,
};

/* ---------------- parameters ---------------- */

export type SensorKey = "dht" | "bh" | "bmp" | "sonar" | "pir";
export type LogFilter = "events" | "all" | "errors";
export type P34 = {
  tempC: number; rh: number; lux: number; hPa: number; distCm: number; motion: boolean;
  dht: boolean; bh: boolean; bmp: boolean; sonar: boolean; pir: boolean;
  pullup: boolean; addrHigh: boolean; emi: boolean;
  sel: SensorKey; span: number; filter: LogFilter;
};
export const P34_DEFAULT: P34 = {
  tempC: 24.8, rh: 45, lux: 782, hPa: 1013.25, distCm: 32, motion: false,
  dht: true, bh: true, bmp: true, sonar: true, pir: true,
  pullup: true, addrHigh: false, emi: false,
  sel: "dht", span: 30, filter: "events",
};
export const SENSOR_KEYS: SensorKey[] = ["dht", "bh", "bmp", "sonar", "pir"];
export const SENSOR: Record<SensorKey, { name: string; what: string; bus: string; pins: string; color: string }> = {
  dht: { name: "DHT22", what: "Temperature & humidity", bus: "single-wire", pins: "PA1 (10 kΩ pull-up)", color: "#ef4444" },
  bh: { name: "BH1750", what: "Ambient light", bus: "I²C 0x23", pins: "PB8 SCL · PB9 SDA", color: "#f59e0b" },
  bmp: { name: "BMP280", what: "Barometric pressure", bus: "I²C 0x76", pins: "PB8 SCL · PB9 SDA", color: "#8b5cf6" },
  sonar: { name: "HC-SR04", what: "Ultrasonic distance", bus: "TRIG / ECHO pulse", pins: "PA8 TRIG · PA9 ECHO", color: "#1677ff" },
  pir: { name: "HC-SR501", what: "PIR motion", bus: "digital output", pins: "PB0 (pull-down)", color: "#16a34a" },
};

export const BH_ADDR = 0x23, BH_ALT = 0x5c, BMP_ADDR = 0x76;
export const MAX_RANGE = 400, MIN_RANGE = 2;
export const NO_ECHO_W = 0.038, ECHO_DELAY = 460e-6;
export const PIR_HOLD = 3, PIR_LOCK = 2.5, DHT_MIN = 2;
export const DHT_START = 1.1e-3;
export const BH_CONV = 0.12;
export const soundSpeed = (T: number) => 331.3 + 0.606 * T;
export const compP = (adc: number) => 30000 + (adc * 80000) / 1048576;
export const toAdcP = (pa: number) => Math.max(0, Math.min(0xfffff, Math.round(((pa - 30000) * 1048576) / 80000)));
export const BMP_RESET = 0x80000;
export const hex2 = (b: number) => (b & 0xff).toString(16).toUpperCase().padStart(2, "0");
export const hex4 = (b: number) => (b & 0xffff).toString(16).toUpperCase().padStart(4, "0");

/* ---------------- state ---------------- */

export interface DhtFrame { t: number; bytes: number[]; sent: number[]; ok: boolean; flipped: number | null; rh: number; temp: number; dur: number }
export type PingStatus = "ok" | "timeout" | "short" | "none" | "unplugged";
export interface Ping { t: number; trigW: number; echoW: number; cm: number; c: number; status: PingStatus; us: number; timeout: number }
export type TxnOp = "tx" | "rx" | "memw" | "memr" | "probe";
export interface Txn { id: number; t: number; dev: "bh" | "bmp" | null; a7: number; op: TxnOp; reg: number | null; data: number[]; ack: boolean; note: string; dur: number }
export interface Sample { t: number; temp: number; lux: number; pressure: number; distance: number; motion: number; T: number; L: number; P: number; D: number; M: number; mv: number }
export type Tone = "ok" | "bad" | "warn" | "info";
export interface LogLine { id: number; t: number; sensor: SensorKey | "sys"; tone: Tone; title: string; text: string; kind: "event" | "txn" }

interface Dht { Ts: number; RHs: number; init: boolean; busyUntil: number; lastStart: number; frames: number; timeouts: number; csumErr: number; busyHits: number; lastBusyAt: number; lastBusyGap: number; frame: DhtFrame | null; lastFail: { t: number; why: string } | null; n: number }
interface Bh { mode: number; on: boolean; convAt: number; raw: number; reads: number; nacks: number; lastNackAt: number }
interface Bmp { ctrl: number; ptr: number; adcP: number; adcT: number; reads: number; nacks: number }
interface Sonar { last: Ping | null; pings: number; ok: number; timeouts: number; short: number; seenFall: number; n: number }
interface Pir { out: number; holdUntil: number; lockUntil: number; burstUntil: number; rises: number; edges: Array<[number, number]>; pin: number | null }

export interface Front {
  p: P34;
  started: boolean;
  i2cInit: boolean;
  i2cHz: number;
  dht: Dht; bh: Bh; bmp: Bmp; sonar: Sonar; pir: Pir;
  txns: Txn[];
  lastTxn: { bh: Txn | null; bmp: Txn | null };
  nextId: number;
  log: LogLine[];
  hist: Sample[];
  nextSample: number;
  plug: Record<SensorKey, boolean>;
  noise: number;
}

const FRONT = new WeakMap<Mcu, Front>();
export function front(m: Mcu): Front {
  let f = FRONT.get(m);
  if (!f) {
    f = {
      p: P34_DEFAULT, started: false, i2cInit: false, i2cHz: 100000,
      dht: { Ts: 0, RHs: 0, init: false, busyUntil: 1, lastStart: -Infinity, frames: 0, timeouts: 0, csumErr: 0, busyHits: 0, lastBusyAt: -Infinity, lastBusyGap: 0, frame: null, lastFail: null, n: 0 },
      bh: { mode: 0, on: false, convAt: Infinity, raw: 0, reads: 0, nacks: 0, lastNackAt: -Infinity },
      bmp: { ctrl: 0, ptr: 0, adcP: BMP_RESET, adcT: BMP_RESET, reads: 0, nacks: 0 },
      sonar: { last: null, pings: 0, ok: 0, timeouts: 0, short: 0, seenFall: -1, n: 0 },
      pir: { out: 0, holdUntil: 0, lockUntil: 0, burstUntil: -1, rises: 0, edges: [], pin: null },
      txns: [], lastTxn: { bh: null, bmp: null }, nextId: 1, log: [], hist: [], nextSample: 0,
      plug: { dht: true, bh: true, bmp: true, sonar: true, pir: true }, noise: 0,
    };
    FRONT.set(m, f);
  }
  return f;
}

const hash = (n: number) => { let x = (n * 2654435761) >>> 0; x ^= x >>> 15; x = Math.imul(x, 2246822519) >>> 0; x ^= x >>> 13; return x >>> 0; };
const jitter = (f: Front, span: number) => ((hash(++f.noise) % 2001) / 1000 - 1) * span;

function log(f: Front, t: number, sensor: LogLine["sensor"], tone: Tone, title: string, text: string, kind: LogLine["kind"] = "event") {
  f.log.push({ id: f.nextId++, t, sensor, tone, title, text, kind });
  if (f.log.length > 300) f.log.splice(0, f.log.length - 300);
}

export function clearLog(m: Mcu) { const f = front(m); f.log = []; f.txns = []; }
export function waveHand(m: Mcu) { const f = front(m); f.pir.burstUntil = m.now + 1.2; log(f, m.now, "pir", "info", "Motion", "Hand waved in front of the PIR for 1.2 s"); }
export const bhAddrOf = (p: P34) => (p.addrHigh ? BH_ALT : BH_ADDR);
export const targetPresent = (p: P34) => p.distCm <= MAX_RANGE;

/* ---------------- DHT22 single-wire frame ---------------- */

export const dhtBits = (bytes: number[]) => bytes.flatMap((b) => Array.from({ length: 8 }, (_, i) => (b >> (7 - i)) & 1));
export const DHT_T = { start: DHT_START, release: 30e-6, respLow: 80e-6, respHigh: 80e-6, bitLow: 50e-6, zero: 27e-6, one: 70e-6, end: 50e-6 } as const;
export const dhtFrameDur = (bits: number[]) => DHT_T.start + DHT_T.release + DHT_T.respLow + DHT_T.respHigh + bits.reduce((s, b) => s + DHT_T.bitLow + (b ? DHT_T.one : DHT_T.zero), 0) + DHT_T.end;
export const dhtTemp = (raw: number) => (raw & 0x8000 ? -(raw & 0x7fff) : raw) / 10;
export const checksum = (b: number[]) => (b[0]! + b[1]! + b[2]! + b[3]!) & 0xff;

function setRef(v: Val | undefined, x: number) {
  if (v && typeof v === "object" && v.kind === "ref") v.ref.set(x);
  else writeBytes(v, [x & 0xff, (x >> 8) & 0xff]);
}

function dhtRead(m: Mcu, f: Front, args: Val[]) {
  const t0 = m.now, d = f.dht, p = f.p;
  const fail = (why: string) => {
    d.timeouts++; d.lastFail = { t: t0, why };
    log(f, t0, "dht", "bad", "DHT22 timeout", why);
    return new Block(() => false, DHT_START + DHT_T.release + 100e-6, () => SENSOR_CONST.DHT_TIMEOUT!, "dht22");
  };
  if (!p.dht) return fail("No response: the DHT22 is unplugged, so nobody pulls the line low after the start signal.");
  if (!p.pullup) return fail("No response: without the 10 kΩ pull-up the data line cannot return high after the start pulse, so the sensor never sees the end of it.");
  if (t0 < d.busyUntil) {
    d.busyHits++; d.lastBusyAt = t0; d.lastBusyGap = t0 - d.lastStart;
    return fail(d.lastStart < 0 ? `No response: the DHT22 needs 1 s after power-up (asked at ${(t0 * 1e3).toFixed(0)} ms).` : `No response: the DHT22 is still busy, only ${((t0 - d.lastStart) * 1e3).toFixed(0)} ms after the last reading (it needs 2 s).`);
  }
  const rh10 = Math.max(0, Math.min(999, Math.round(d.RHs * 10 + jitter(f, 1.2))));
  const t10 = Math.max(-400, Math.min(800, Math.round(d.Ts * 10 + jitter(f, 1.2))));
  const rawT = t10 < 0 ? 0x8000 | -t10 : t10;
  const bytes = [rh10 >> 8, rh10 & 0xff, rawT >> 8, rawT & 0xff];
  bytes.push(checksum(bytes));
  const sent = bytes.slice();
  let flipped: number | null = null;
  if (p.emi && d.n++ % 2 === 0) {
    flipped = 8 + (hash(d.n + 77) % 24);
    sent[flipped >> 3] = sent[flipped >> 3]! ^ (0x80 >> (flipped & 7));
  }
  const ok = checksum(sent) === sent[4];
  const dur = dhtFrameDur(dhtBits(sent));
  d.lastStart = t0; d.busyUntil = t0 + DHT_MIN;
  const gotRh = (sent[0]! << 8) | sent[1]!, gotT = (sent[2]! << 8) | sent[3]!;
  d.frame = { t: t0, bytes, sent, ok, flipped, rh: gotRh / 10, temp: dhtTemp(gotT), dur };
  if (!ok) {
    d.csumErr++;
    log(f, t0, "dht", "bad", "DHT22 checksum", `Bit ${flipped} was flipped by interference: ${sent.slice(0, 4).map(hex2).join(" ")} adds up to 0x${hex2(checksum(sent))}, the sensor sent 0x${hex2(sent[4]!)}. Frame discarded.`);
    return new Block(() => false, dur, () => SENSOR_CONST.DHT_CHECKSUM!, "dht22");
  }
  d.frames++;
  log(f, t0, "dht", "ok", "DHT22 frame", `${sent.map(hex2).join(" ")} → RH ${(gotRh / 10).toFixed(1)} %, T ${dhtTemp(gotT).toFixed(1)} °C, checksum OK`);
  return new Block(() => false, dur, () => { setRef(args[0], gotRh); setRef(args[1], gotT); return SENSOR_CONST.DHT_OK!; }, "dht22");
}

/* ---------------- HC-SR04 ---------------- */

function echo(m: Mcu, f: Front, args: Val[]) {
  const s = f.sonar, p = f.p;
  const toUs = Math.max(1, toNum(args[0] ?? 30000));
  const to = toUs / 1e6;
  const e = m.edges.get("PA8") ?? [];
  let fall: number | null = null, rise: number | null = null;
  for (let i = e.length - 1; i >= 0; i--) {
    const [t, lv] = e[i]!;
    if (t <= s.seenFall) break;
    if (lv === 0 && fall === null) fall = t;
    else if (lv === 1 && fall !== null) { rise = t; break; }
  }
  const t0 = m.now;
  const c = soundSpeed(p.tempC);
  const rec = (status: PingStatus, trigW: number, echoW: number, us: number, dur: number) => {
    s.pings++;
    s.last = { t: t0, trigW, echoW, cm: p.distCm, c, status, us, timeout: to };
    if (status === "ok") s.ok++; else s.timeouts++;
    if (status === "short") s.short++;
    if (status !== "ok") log(f, t0, "sonar", status === "timeout" ? "warn" : "bad", "HC-SR04 no echo",
      status === "short" ? `TRIG was high for only ${(trigW * 1e6).toFixed(0)} µs: the module needs at least 10 µs, so it never fires.`
        : status === "none" ? "echo_pulse_us() was called without a TRIG pulse first."
          : status === "unplugged" ? "The HC-SR04 is unplugged: ECHO never goes high."
            : `ECHO stayed high ${(echoW * 1e3).toFixed(1)} ms: nothing within ${MAX_RANGE} cm, longer than the ${(to * 1e3).toFixed(0)} ms timeout.`);
    else log(f, t0, "sonar", "ok", "HC-SR04 echo", `${us} µs at ${c.toFixed(1)} m/s → ${(us * 1e-6 * c * 50).toFixed(1)} cm (true ${p.distCm.toFixed(1)} cm)`, "txn");
    return new Block(() => false, Math.max(0, dur), () => us, "echo");
  };
  if (fall === null || rise === null) return rec("none", 0, 0, 0, to);
  s.seenFall = fall;
  const trigW = fall - rise;
  if (!p.sonar) return rec("unplugged", trigW, 0, 0, to);
  if (trigW < 10e-6 - 1e-9) return rec("short", trigW, 0, 0, to);
  const present = targetPresent(p);
  const d = Math.max(MIN_RANGE, p.distCm);
  const w = present ? (2 * d) / 100 / c + jitter(f, 1.5e-6) : NO_ECHO_W;
  const lead = Math.max(0, ECHO_DELAY - (t0 - fall));
  if (w > to) return rec("timeout", trigW, w, 0, lead + to);
  return rec("ok", trigW, w, Math.round(w * 1e6), lead + w);
}

/* ---------------- I2C sensors ---------------- */

function bhCommand(f: Front, t: number, cmd: number) {
  const b = f.bh;
  if (cmd === 0x00) { b.on = false; b.mode = 0; b.convAt = Infinity; return "power down"; }
  if (cmd === 0x01) { b.on = true; return "power on"; }
  if (cmd === 0x07) { b.raw = 0; return "reset data register"; }
  if (cmd === 0x10 || cmd === 0x11 || cmd === 0x13 || cmd === 0x20 || cmd === 0x21 || cmd === 0x23) {
    b.on = true; b.mode = cmd; b.convAt = t + (cmd === 0x13 || cmd === 0x23 ? 0.016 : BH_CONV);
    return `${cmd & 0x20 ? "one-time" : "continuous"} ${cmd & 3 ? (cmd & 2 ? "low" : "high-2") : "high"}-resolution mode`;
  }
  return "unknown command (ignored)";
}
const bhSample = (f: Front) => Math.max(0, Math.min(0xffff, Math.round(f.p.lux * 1.2 * (1 + jitter(f, 0.004)))));
const bmpModeName = (ctrl: number) => (["sleep", "forced", "forced", "normal"] as const)[ctrl & 3]!;

function bmpReg(f: Front, r: number): number {
  const b = f.bmp;
  switch (r) {
    case 0xd0: return 0x58;
    case 0xf3: return 0;
    case 0xf4: return b.ctrl;
    case 0xf5: return 0;
    case 0xf7: return (b.adcP >> 12) & 0xff;
    case 0xf8: return (b.adcP >> 4) & 0xff;
    case 0xf9: return (b.adcP << 4) & 0xf0;
    case 0xfa: return (b.adcT >> 12) & 0xff;
    case 0xfb: return (b.adcT >> 4) & 0xff;
    case 0xfc: return (b.adcT << 4) & 0xf0;
    default: return 0;
  }
}
function bmpConvert(f: Front) {
  f.bmp.adcP = toAdcP(f.p.hPa * 100 + jitter(f, 2.5));
  f.bmp.adcT = Math.max(0, Math.min(0xfffff, Math.round(519888 + (f.p.tempC - 25) * 5200)));
}
function bmpWrite(f: Front, t: number, reg: number, v: number) {
  const b = f.bmp;
  if (reg === 0xf4) {
    b.ctrl = v & 0xff;
    if ((v & 3) === 1 || (v & 3) === 2) { bmpConvert(f); b.ctrl &= ~3; }
    else if ((v & 3) === 3) bmpConvert(f);
    return `ctrl_meas = 0x${hex2(v)}: ${bmpModeName(v)} mode`;
  }
  if (reg === 0xe0 && v === 0xb6) { b.ctrl = 0; b.adcP = BMP_RESET; b.adcT = BMP_RESET; return "soft reset"; }
  void t;
  return `register 0x${hex2(reg)} = 0x${hex2(v)}`;
}

function i2c(m: Mcu, f: Front, op: TxnOp, addr8: number, reg: number | null, data: number[], n: number) {
  const t0 = m.now, p = f.p;
  const a7 = (addr8 >> 1) & 0x7f;
  const byteT = 9 / f.i2cHz;
  const dev: "bh" | "bmp" | null = a7 === bhAddrOf(p) && p.bh ? "bh" : a7 === BMP_ADDR && p.bmp ? "bmp" : null;
  const rec = (ack: boolean, note: string, rx: number[], bytes: number) => {
    const dur = (bytes + 1) * byteT + 2 / f.i2cHz + (op === "memr" ? byteT + 1 / f.i2cHz : 0);
    const tx: Txn = { id: f.nextId++, t: t0, dev, a7, op, reg, data: rx.length ? rx : data, ack, note, dur };
    f.txns.push(tx); if (f.txns.length > 80) f.txns.splice(0, f.txns.length - 80);
    if (dev) f.lastTxn[dev] = tx;
    const who = dev ? SENSOR[dev].name : `0x${hex2(a7)}`;
    if (!ack) {
      if (a7 === BH_ADDR || a7 === BH_ALT || a7 === (BH_ADDR << 1)) { f.bh.nacks++; f.bh.lastNackAt = t0; f.lastTxn.bh = tx; }
      if (a7 === BMP_ADDR) { f.bmp.nacks++; f.lastTxn.bmp = tx; }
      log(f, t0, a7 === BMP_ADDR ? "bmp" : "bh", "bad", `I²C NACK 0x${hex2(a7)}`, note);
    } else log(f, t0, dev ?? "sys", "ok", `I²C ${who}`, note, "txn");
    return { status: ack ? 0 : 1, rx, dur };
  };
  if (!f.i2cInit) return rec(false, "I2C1 is not initialised: call HAL_I2C_Init() (MX_I2C1_Init) first.", [], 0);
  if (addr8 > 0xff) return rec(false, `Address 0x${addr8.toString(16).toUpperCase()} does not fit in 8 bits: the 7-bit address was shifted twice (0x${hex2(addr8 >> 2)} << 1 << 1).`, [], 0);
  if (!dev) {
    const why = a7 === BH_ADDR && p.bh && p.addrHigh ? "The BH1750 ADDR pin is high, so it answers at 0x5C, not 0x23."
      : a7 === BH_ALT && p.bh && !p.addrHigh ? "The BH1750 ADDR pin is low: it answers at 0x23, not 0x5C."
        : a7 === BH_ADDR && !p.bh ? "The BH1750 is unplugged."
          : a7 === BMP_ADDR && !p.bmp ? "The BMP280 is unplugged."
            : a7 === BH_ADDR << 1 ? `Nobody answers 0x${hex2(a7)}: that is the BH1750's 8-bit address (0x23 << 1). HAL shifts again, so the bus carries 0x${hex2(addr8)} >> 1 = 0x${hex2(a7)}.`
              : `No device answers 0x${hex2(a7)}.`;
    return rec(false, why, [], 0);
  }
  if (dev === "bh") {
    f.bh.reads++;
    if (op === "tx" || op === "memw") {
      const cmds = op === "memw" ? [reg ?? 0, ...data] : data;
      const what = cmds.map((c) => `0x${hex2(c)} ${bhCommand(f, t0, c)}`).join(", ");
      return rec(true, `BH1750 command ${what}`, [], cmds.length);
    }
    if (op === "memr" && reg !== null) bhCommand(f, t0, reg);
    const raw = f.bh.on ? f.bh.raw : 0;
    const rx = Array.from({ length: n }, (_, i) => (i === 0 ? raw >> 8 : i === 1 ? raw & 0xff : 0xff));
    return rec(true, `BH1750 read ${rx.map(hex2).join(" ")} = ${raw} counts → ${(raw / 1.2).toFixed(1)} lx${!f.bh.on || f.bh.mode === 0 ? " (powered down: no measurement)" : ""}`, rx, n);
  }
  f.bmp.reads++;
  if (op === "tx" || op === "memw") {
    const bytes = op === "memw" ? [reg ?? 0, ...data] : data;
    if (!bytes.length) return rec(true, "BMP280 address only", [], 0);
    f.bmp.ptr = bytes[0]!;
    const notes: string[] = [];
    for (let i = 1; i < bytes.length; i++) notes.push(bmpWrite(f, t0, (f.bmp.ptr + i - 1) & 0xff, bytes[i]!));
    return rec(true, notes.length ? `BMP280 ${notes.join(", ")}` : `BMP280 register pointer = 0x${hex2(f.bmp.ptr)}`, [], bytes.length);
  }
  if (op === "memr" && reg !== null) f.bmp.ptr = reg;
  const start = f.bmp.ptr;
  const rx = Array.from({ length: n }, (_, i) => bmpReg(f, (start + i) & 0xff));
  f.bmp.ptr = (start + n) & 0xff;
  const pressureRegs = start === 0xf7 && n >= 3;
  const adc = pressureRegs ? (rx[0]! << 12) | (rx[1]! << 4) | (rx[2]! >> 4) : 0;
  return rec(true, `BMP280 read 0x${hex2(start)}: ${rx.map(hex2).join(" ")}${pressureRegs ? ` → adc_P = ${adc} → ${(compP(adc) / 100).toFixed(2)} hPa${adc === BMP_RESET ? " (reset value: sleep mode, no conversion)" : ""}` : ""}`, rx, n + 1);
}

/* ---------------- HAL binding ---------------- */

const hook: CallHook = (name, args, m) => {
  const f = front(m);
  const n = (i: number) => toNum(args[i] ?? 0);
  switch (name) {
    case "HAL_I2C_Init": {
      const h = args[0] && typeof args[0] === "object" && args[0].kind === "ref" ? args[0].name : "hi2c1";
      const hz = m.fw?.field(`${h}.Init.ClockSpeed`) ?? 100000;
      f.i2cHz = hz > 0 ? Math.min(400000, hz) : 100000;
      f.i2cInit = true;
      log(f, m.now, "sys", "info", "I²C1 ready", `${f.i2cHz / 1000} kHz, BH1750 and BMP280 share SCL/SDA`);
      return 0;
    }
    case "HAL_I2C_DeInit": f.i2cInit = false; return 0;
    case "HAL_I2C_IsDeviceReady": { const r = i2c(m, f, "probe", n(1), null, [], 0); return new Block(() => false, r.dur, () => r.status, "i2c"); }
    case "HAL_I2C_Master_Transmit": { const r = i2c(m, f, "tx", n(1), null, readBytes(args[2], Math.min(32, n(3))), 0); return new Block(() => false, r.dur, () => r.status, "i2c"); }
    case "HAL_I2C_Master_Receive": { const cnt = Math.min(32, n(3)); const r = i2c(m, f, "rx", n(1), null, [], cnt); return new Block(() => false, r.dur, () => { if (r.status === 0) writeBytes(args[2], r.rx); return r.status; }, "i2c"); }
    case "HAL_I2C_Mem_Write": { const r = i2c(m, f, "memw", n(1), n(2) & 0xff, readBytes(args[4], Math.min(32, n(5))), 0); return new Block(() => false, r.dur, () => r.status, "i2c"); }
    case "HAL_I2C_Mem_Read": { const cnt = Math.min(32, n(5)); const r = i2c(m, f, "memr", n(1), n(2) & 0xff, [], cnt); return new Block(() => false, r.dur, () => { if (r.status === 0) writeBytes(args[4], r.rx); return r.status; }, "i2c"); }
    case "dht22_read": return dhtRead(m, f, args);
    case "echo_pulse_us": return echo(m, f, args);
    case "bmp280_compensate_P": return compP(n(0));
  }
  return undefined;
};

export function mcu34(): McuOptions {
  return { family: "stm32", constants: SENSOR_CONST, onCall: hook };
}

/* ---------------- world ---------------- */

export function world34(m: Mcu, dt: number, p: P34) {
  const f = front(m);
  f.p = p;
  const t = m.now;
  if (!f.started) { f.started = true; for (const k of SENSOR_KEYS) f.plug[k] = p[k]; }
  for (const k of SENSOR_KEYS) if (f.plug[k] !== p[k]) {
    f.plug[k] = p[k];
    log(f, t, k, p[k] ? "info" : "warn", p[k] ? `${SENSOR[k].name} plugged in` : `${SENSOR[k].name} unplugged`, p[k] ? `${SENSOR[k].what} sensor connected again (${SENSOR[k].pins}).` : `${SENSOR[k].what} sensor removed from the breadboard.`);
    if (k === "bh" && !p[k]) { f.bh.on = false; f.bh.mode = 0; f.bh.convAt = Infinity; f.bh.raw = 0; }
    if (k === "bmp" && !p[k]) { f.bmp.ctrl = 0; f.bmp.adcP = BMP_RESET; f.bmp.adcT = BMP_RESET; }
    if (k === "dht" && p[k]) { f.dht.busyUntil = t + 1; f.dht.init = false; }
  }

  const d = f.dht;
  if (!d.init) { d.Ts = p.tempC; d.RHs = p.rh; d.init = true; }
  d.Ts += (p.tempC - d.Ts) * (1 - Math.exp(-dt / 2));
  d.RHs += (p.rh - d.RHs) * (1 - Math.exp(-dt / 3));

  const b = f.bh;
  if (b.on && b.mode && t >= b.convAt) {
    b.raw = bhSample(f);
    const per = b.mode === 0x13 || b.mode === 0x23 ? 0.016 : BH_CONV;
    if (b.mode & 0x20) { b.convAt = Infinity; b.on = false; } else while (b.convAt <= t) b.convAt += per;
  }
  if ((f.bmp.ctrl & 3) === 3 && p.bmp) bmpConvert(f);

  const pr = f.pir;
  const moving = p.motion || t < pr.burstUntil;
  if (pr.out === 0 && moving && t >= pr.lockUntil) {
    pr.out = 1; pr.holdUntil = t + PIR_HOLD; pr.rises++; pr.edges.push([t, 1]);
    log(f, t, "pir", "ok", "PIR OUT high", `Motion detected: OUT stays high for ${PIR_HOLD} s after the last movement.`);
  } else if (pr.out === 1) {
    if (moving) pr.holdUntil = Math.max(pr.holdUntil, t + PIR_HOLD);
    else if (t >= pr.holdUntil) {
      pr.out = 0; pr.lockUntil = t + PIR_LOCK; pr.edges.push([t, 0]);
      log(f, t, "pir", "info", "PIR OUT low", `No motion for ${PIR_HOLD} s. The HC-SR501 now ignores movement for ${PIR_LOCK} s (block time).`);
    }
  }
  if (pr.edges.length > 60) pr.edges.splice(0, pr.edges.length - 60);
  const want = p.pir ? pr.out : null;
  if (want !== pr.pin) { pr.pin = want; m.setInput("PB0", want); }

  if (m.fw && t >= f.nextSample) {
    const fw = m.fw;
    const v = (k: string) => fw.num(k, Number.NaN);
    const nan = Number.NaN;
    f.hist.push({ t, temp: f.dht.frames ? v("temp") : nan, lux: f.lastTxn.bh ? v("lux") : nan, pressure: f.lastTxn.bmp ? v("pressure") : nan, distance: f.sonar.pings ? v("distance") : nan, motion: v("motion"), T: p.tempC, L: p.lux, P: p.hPa, D: targetPresent(p) ? p.distCm : Number.NaN, M: p.pir ? pr.out : 0, mv: moving ? 1 : 0 });
    if (f.hist.length > 1300) f.hist.splice(0, f.hist.length - 1300);
    f.nextSample = t + 0.1;
  }
}

/* ---------------- helpers for the UI ---------------- */

export type Health = "ok" | "stale" | "err" | "off" | "wait";
export function health(f: Front, k: SensorKey, now: number, fwVals: { dhtErr: number; i2cErr: number; echoErr: number }): Health {
  const p = f.p;
  if (!p[k]) return "off";
  if (k === "dht") {
    if (!f.dht.frames) return f.dht.timeouts || f.dht.csumErr ? "err" : "wait";
    if (f.dht.lastFail && f.dht.lastFail.t > now - 2.5) return "err";
    if (f.dht.frame && !f.dht.frame.ok && f.dht.frame.t > now - 2.5) return "stale";
    return now - (f.dht.frame?.t ?? 0) > 4.5 ? "stale" : "ok";
  }
  if (k === "bh" || k === "bmp") {
    const last = f.lastTxn[k];
    if (!last) return fwVals.i2cErr ? "err" : "wait";
    if (!last.ack) return "err";
    if (k === "bmp" && f.bmp.adcP === BMP_RESET) return "stale";
    if (k === "bh" && (!f.bh.on || !f.bh.mode)) return "stale";
    return now - last.t > 1.5 ? "stale" : "ok";
  }
  if (k === "sonar") {
    const l = f.sonar.last;
    if (!l) return "wait";
    if (l.status === "ok") return now - l.t > 1.5 ? "stale" : "ok";
    return l.status === "timeout" ? "stale" : "err";
  }
  return "ok";
}

export function txnFrame(t: Txn): Array<[string, string]> {
  const out: Array<[string, string]> = [["S", "k"]];
  const rd = t.op === "rx" || t.op === "memr";
  if (t.op === "memr" || t.op === "memw" || t.op === "tx" || t.op === "probe") out.push([`${hex2(t.a7)}+W`, "ad"]);
  else out.push([`${hex2(t.a7)}+R`, "ad"]);
  if (!t.ack) { out.push(["NACK", "n"], ["P", "k"]); return out; }
  out.push(["A", "a"]);
  if (t.reg !== null && (t.op === "memr" || t.op === "memw")) out.push([hex2(t.reg), "d"], ["A", "a"]);
  if (t.op === "memr") out.push(["Sr", "k"], [`${hex2(t.a7)}+R`, "ad"], ["A", "a"]);
  t.data.forEach((b, i) => { out.push([hex2(b), "d"]); out.push([rd && i === t.data.length - 1 ? "N" : "A", rd && i === t.data.length - 1 ? "n" : "a"]); });
  out.push(["P", "k"]);
  return out;
}
