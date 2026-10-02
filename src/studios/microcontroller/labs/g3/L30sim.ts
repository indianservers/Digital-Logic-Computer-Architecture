import { toNum, Wait, type Val } from "../core/cinterp";
import { readBytes, writeBytes, type CallHook, type Mcu, type McuOptions } from "../core/mcu";

export const DEMO = `/* Lab 30: SPI Communication - Read accelerometer */
#include "stm32f4xx_hal.h"

#define CS_ACTIVE   GPIO_PIN_RESET   // LIS3DH chip select is active low
#define CS_IDLE     GPIO_PIN_SET

#define WHO_AM_I    0x0F
#define CTRL_REG1   0x20
#define OUT_X_L     0x28
#define OUT_Y_L     0x2A
#define OUT_Z_L     0x2C

SPI_HandleTypeDef hspi1;

uint8_t txData[2];
uint8_t rxData[2];
uint8_t id, ctrl;
int16_t accX, accY, accZ;

uint8_t SPI_ReadRegister(uint8_t reg) {
    txData[0] = reg | 0x80;  // Set MSB for read
    txData[1] = 0x00;
    HAL_GPIO_WritePin(GPIOA, GPIO_PIN_4, CS_ACTIVE);  // CS Low
    HAL_SPI_TransmitReceive(&hspi1, txData, rxData, 2, 100);
    HAL_GPIO_WritePin(GPIOA, GPIO_PIN_4, CS_IDLE);    // CS High
    return rxData[1];
}

void SPI_WriteRegister(uint8_t reg, uint8_t value) {
    txData[0] = reg & 0x3F;  // MSB clear for write
    txData[1] = value;
    HAL_GPIO_WritePin(GPIOA, GPIO_PIN_4, CS_ACTIVE);
    HAL_SPI_Transmit(&hspi1, txData, 2, 100);
    HAL_GPIO_WritePin(GPIOA, GPIO_PIN_4, CS_IDLE);
}

int16_t ReadAxis(uint8_t regL) {
    uint8_t lo = SPI_ReadRegister(regL);
    uint8_t hi = SPI_ReadRegister(regL + 1);
    return (int16_t)((hi << 8) | lo) >> 6;  // 10-bit, left-justified
}

void MX_SPI1_Init(void) {
    // LIS3DH: SPI mode 0 or 3, MSB first, SCLK up to 10 MHz
    hspi1.Instance = SPI1;
    hspi1.Init.Mode = SPI_MODE_MASTER;
    hspi1.Init.Direction = SPI_DIRECTION_2LINES;
    hspi1.Init.DataSize = SPI_DATASIZE_8BIT;
    hspi1.Init.CLKPolarity = SPI_POLARITY_LOW;
    hspi1.Init.CLKPhase = SPI_PHASE_1EDGE;
    hspi1.Init.NSS = SPI_NSS_SOFT;
    hspi1.Init.BaudRatePrescaler = SPI_BAUDRATEPRESCALER_64;
    hspi1.Init.FirstBit = SPI_FIRSTBIT_MSB;
    HAL_SPI_Init(&hspi1);
}

int main(void) {
    HAL_Init();
    SystemClock_Config();
    MX_GPIO_Init();
    MX_SPI1_Init();
    // Read WHO_AM_I register (0x0F) from LIS3DH
    id = SPI_ReadRegister(WHO_AM_I);        // expect 0x33
    SPI_WriteRegister(CTRL_REG1, 0x57);     // 100 Hz, X/Y/Z enabled
    ctrl = SPI_ReadRegister(CTRL_REG1);     // read back: 0x57
    while (1) {
        accX = ReadAxis(OUT_X_L);
        accY = ReadAxis(OUT_Y_L);
        accZ = ReadAxis(OUT_Z_L);
        HAL_Delay(100);
    }
}
`;

function variant(edits: Array<[string, string]>): string {
  let s = DEMO;
  for (const [a, b] of edits) { if (!s.includes(a)) throw new Error(`L30 variant: '${a}' not found`); s = s.replace(a, b); }
  return s;
}

export const MODE3 = variant([
  ["/* Lab 30: SPI Communication - Read accelerometer */", "/* Lab 30: SPI mode 3 (CPOL = 1, CPHA = 1) - also supported by the LIS3DH */"],
  ["SPI_POLARITY_LOW", "SPI_POLARITY_HIGH"],
  ["SPI_PHASE_1EDGE", "SPI_PHASE_2EDGE"],
]);

export const BURST = variant([
  ["/* Lab 30: SPI Communication - Read accelerometer */", "/* Lab 30: Burst read - one transaction, auto-increment (MS bit) */"],
  ["int16_t accX, accY, accZ;", "int16_t accX, accY, accZ;\nuint8_t cmd[7];\nuint8_t burst[7];"],
  ["int16_t ReadAxis(uint8_t regL) {\n    uint8_t lo = SPI_ReadRegister(regL);\n    uint8_t hi = SPI_ReadRegister(regL + 1);\n    return (int16_t)((hi << 8) | lo) >> 6;  // 10-bit, left-justified\n}",
    "void ReadXYZ(void) {\n    cmd[0] = OUT_X_L | 0xC0;  // read + auto-increment (bit 6 = MS)\n    HAL_GPIO_WritePin(GPIOA, GPIO_PIN_4, CS_ACTIVE);\n    HAL_SPI_TransmitReceive(&hspi1, cmd, burst, 7, 100);\n    HAL_GPIO_WritePin(GPIOA, GPIO_PIN_4, CS_IDLE);\n    accX = (int16_t)((burst[2] << 8) | burst[1]) >> 6;\n    accY = (int16_t)((burst[4] << 8) | burst[3]) >> 6;\n    accZ = (int16_t)((burst[6] << 8) | burst[5]) >> 6;\n}"],
  ["        accX = ReadAxis(OUT_X_L);\n        accY = ReadAxis(OUT_Y_L);\n        accZ = ReadAxis(OUT_Z_L);\n", "        ReadXYZ();\n"],
]);

export const BUG_MODE1 = variant([
  ["/* Lab 30: SPI Communication - Read accelerometer */", "/* Lab 30 (bug): wrong clock phase - why is WHO_AM_I not 0x33? */"],
  ["SPI_PHASE_1EDGE", "SPI_PHASE_2EDGE"],
]);

export const BUG_CS = variant([
  ["/* Lab 30: SPI Communication - Read accelerometer */", "/* Lab 30 (bug): chip select polarity - nothing answers */"],
  ["#define CS_ACTIVE   GPIO_PIN_RESET   // LIS3DH chip select is active low\n#define CS_IDLE     GPIO_PIN_SET", "#define CS_ACTIVE   GPIO_PIN_SET     // LIS3DH chip select is active low\n#define CS_IDLE     GPIO_PIN_RESET"],
]);

export const BUG_READBIT = variant([
  ["/* Lab 30: SPI Communication - Read accelerometer */", "/* Lab 30 (bug): register reads return 0xFF and CTRL_REG1 gets cleared */"],
  ["txData[0] = reg | 0x80;  // Set MSB for read", "txData[0] = reg;         // Set MSB for read"],
]);

export const VARIANTS = [
  { label: "C (STM32 HAL)", code: DEMO },
  { label: "Burst read (auto-increment)", code: BURST },
  { label: "SPI mode 3", code: MODE3 },
  { label: "Bug: wrong CPHA", code: BUG_MODE1 },
  { label: "Bug: CS polarity", code: BUG_CS },
  { label: "Bug: missing read bit", code: BUG_READBIT },
];

/* ---------------- configuration ---------------- */

export const APB2_HZ = 84e6;
export const PRESCALERS = [2, 4, 8, 16, 32, 64, 128, 256] as const;
export const DEVICE_MAX_HZ = 10e6;
/** LIS3DH tv(SO): SDO is valid at most 50 ns after the SPC falling edge. */
export const TV_SO = 50e-9;
export const spiHz = (presc: number) => APB2_HZ / presc;
export const fmtHz = (hz: number) => hz >= 1e6 ? `${+(hz / 1e6).toFixed(hz >= 10e6 ? 1 : 2)} MHz` : `${+(hz / 1e3).toFixed(1)} kHz`;

export interface SpiCfg { init: boolean; cpol: 0 | 1; cpha: 0 | 1; bits: 8 | 16; presc: number; lsb: boolean; master: boolean }
const NO_CFG: SpiCfg = { init: false, cpol: 0, cpha: 0, bits: 8, presc: 64, lsb: false, master: true };
export const modeOf = (c: { cpol: number; cpha: number }) => c.cpol * 2 + c.cpha;
export function cr1(c: SpiCfg) {
  const br = Math.max(0, PRESCALERS.indexOf(c.presc as (typeof PRESCALERS)[number]));
  return (c.cpha) | (c.cpol << 1) | (c.master ? 1 << 2 : 0) | (br << 3) | (c.init ? 1 << 6 : 0) | (c.lsb ? 1 << 7 : 0) | (1 << 8) | (1 << 9) | (c.bits === 16 ? 1 << 11 : 0);
}

export const SPI_CONST: Record<string, number> = {
  SPI_MODE_MASTER: 0x104, SPI_MODE_SLAVE: 0, SPI_DIRECTION_2LINES: 0, SPI_DIRECTION_1LINE: 0x8000,
  SPI_DATASIZE_8BIT: 0, SPI_DATASIZE_16BIT: 0x800, SPI_NSS_SOFT: 0x200, SPI_NSS_HARD_OUTPUT: 0x40000,
  SPI_FIRSTBIT_MSB: 0, SPI_FIRSTBIT_LSB: 0x80, SPI_TIMODE_DISABLE: 0, SPI_CRCCALCULATION_DISABLE: 0,
  SPI_BAUDRATEPRESCALER_2: 0, SPI_BAUDRATEPRESCALER_4: 8, SPI_BAUDRATEPRESCALER_8: 16, SPI_BAUDRATEPRESCALER_16: 24,
  SPI_BAUDRATEPRESCALER_32: 32, SPI_BAUDRATEPRESCALER_64: 40, SPI_BAUDRATEPRESCALER_128: 48, SPI_BAUDRATEPRESCALER_256: 56,
  HAL_BUSY: 2, HAL_TIMEOUT: 3,
};

/* ---------------- code <-> panel ---------------- */

const FIELDS = {
  cpol: /(hspi1\.Init\.CLKPolarity\s*=\s*SPI_POLARITY_)(LOW|HIGH)\b/,
  cpha: /(hspi1\.Init\.CLKPhase\s*=\s*SPI_PHASE_)(1EDGE|2EDGE)\b/,
  presc: /(hspi1\.Init\.BaudRatePrescaler\s*=\s*SPI_BAUDRATEPRESCALER_)(\d+)\b/,
  size: /(hspi1\.Init\.DataSize\s*=\s*SPI_DATASIZE_)(8BIT|16BIT)\b/,
  first: /(hspi1\.Init\.FirstBit\s*=\s*SPI_FIRSTBIT_)(MSB|LSB)\b/,
  csActive: /(#define\s+CS_ACTIVE\s+GPIO_PIN_)(RESET|SET)\b/,
  csIdle: /(#define\s+CS_IDLE\s+GPIO_PIN_)(RESET|SET)\b/,
};
export type FieldKey = keyof typeof FIELDS;
export function codeField(src: string, k: FieldKey): string | null { return FIELDS[k].exec(src)?.[2] ?? null; }
export function setCodeField(src: string, k: FieldKey, v: string): string { return src.replace(FIELDS[k], (_m, h: string) => `${h}${v}`); }

/** The SPI setup as written in the editor (null fields: not found / custom code). */
export function codeCfg(src: string) {
  const pol = codeField(src, "cpol"), pha = codeField(src, "cpha"), pr = codeField(src, "presc"), sz = codeField(src, "size"), fb = codeField(src, "first"), cs = codeField(src, "csActive");
  return {
    mode: pol && pha ? (pol === "HIGH" ? 2 : 0) + (pha === "2EDGE" ? 1 : 0) : null,
    presc: pr ? Number(pr) : null,
    bits: sz ? (sz === "16BIT" ? 16 : 8) : null,
    lsb: fb ? fb === "LSB" : null,
    csLow: cs ? cs === "RESET" : null,
  };
}

/* ---------------- LIS3DH register model ---------------- */

export const REG_NAMES: Record<number, string> = {
  0x07: "STATUS_REG_AUX", 0x08: "OUT_ADC1_L", 0x09: "OUT_ADC1_H", 0x0a: "OUT_ADC2_L", 0x0b: "OUT_ADC2_H", 0x0c: "OUT_ADC3_L", 0x0d: "OUT_ADC3_H",
  0x0f: "WHO_AM_I", 0x1e: "CTRL_REG0", 0x1f: "TEMP_CFG_REG", 0x20: "CTRL_REG1", 0x21: "CTRL_REG2", 0x22: "CTRL_REG3", 0x23: "CTRL_REG4",
  0x24: "CTRL_REG5", 0x25: "CTRL_REG6", 0x26: "REFERENCE", 0x27: "STATUS_REG", 0x28: "OUT_X_L", 0x29: "OUT_X_H", 0x2a: "OUT_Y_L",
  0x2b: "OUT_Y_H", 0x2c: "OUT_Z_L", 0x2d: "OUT_Z_H", 0x2e: "FIFO_CTRL_REG", 0x2f: "FIFO_SRC_REG", 0x30: "INT1_CFG", 0x31: "INT1_SRC",
  0x32: "INT1_THS", 0x33: "INT1_DURATION", 0x38: "CLICK_CFG", 0x39: "CLICK_SRC", 0x3a: "CLICK_THS",
};
export const regName = (a: number) => REG_NAMES[a] ?? `reg 0x${hex2(a)}`;
const AXIS_DESC: Record<number, string> = { 0x28: "X-axis LSB", 0x29: "X-axis MSB", 0x2a: "Y-axis LSB", 0x2b: "Y-axis MSB", 0x2c: "Z-axis LSB", 0x2d: "Z-axis MSB" };
const WRITABLE = new Set([0x1e, 0x1f, 0x20, 0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x2e, 0x30, 0x32, 0x33, 0x34, 0x36, 0x37, 0x38, 0x3a, 0x3b, 0x3c, 0x3d, 0x3e, 0x3f]);
export const isWritable = (a: number) => WRITABLE.has(a);
const ODR_HZ = [0, 1, 10, 25, 50, 100, 200, 400, 1600, 1344];
export const odrHz = (ctrl1: number) => ODR_HZ[(ctrl1 >> 4) & 0xf] ?? 0;
export const hex2 = (b: number) => (b & 0xff).toString(16).toUpperCase().padStart(2, "0");

/** Output format from CTRL_REG1 (LPen) and CTRL_REG4 (HR, FS): bits, mg per digit and left-justify shift. */
export function outFormat(ctrl1: number, ctrl4: number) {
  const fs = (ctrl4 >> 4) & 3, lp = (ctrl1 & 8) !== 0, hr = (ctrl4 & 8) !== 0;
  if (lp) return { bits: 8, mg: [16, 32, 64, 192][fs]!, shift: 8, range: [2, 4, 8, 16][fs]!, name: "low-power 8-bit" };
  if (hr) return { bits: 12, mg: [1, 2, 4, 12][fs]!, shift: 4, range: [2, 4, 8, 16][fs]!, name: "high-resolution 12-bit" };
  return { bits: 10, mg: [4, 8, 16, 48][fs]!, shift: 6, range: [2, 4, 8, 16][fs]!, name: "normal 10-bit" };
}

/** Gravity in g for a board tilted by tiltX (about Y, moves X) and tiltY (about X, moves Y). */
export function gravity(tiltX: number, tiltY: number): [number, number, number] {
  const a = (tiltX * Math.PI) / 180, b = (tiltY * Math.PI) / 180;
  return [Math.sin(a), Math.sin(b) * Math.cos(a), Math.cos(a) * Math.cos(b)];
}

function hashNoise(n: number) {
  let x = (n * 2654435761) >>> 0; x ^= x >>> 15; x = Math.imul(x, 0x2c1b3c6d) >>> 0; x ^= x >>> 12;
  return (x % 3) - 1;
}

/* ---------------- front state ---------------- */

export type P30 = { tiltX: number; tiltY: number; csOpen: boolean; misoOpen: boolean; swap: boolean; tdiv: number; view: "board" | "schem" };
export const P30_DEFAULT: P30 = { tiltX: 0, tiltY: 0, csOpen: false, misoOpen: false, swap: false, tdiv: 2, view: "board" };
export const TDIVS = [0.5, 1, 2, 5, 10, 20] as const;

/** One HAL transfer call, recorded at bit level for the waveform view. Positions are in half SCLK periods from t0. */
export interface CallRec { t0: number; h: number; nb: number; cfg: SpiCfg; mBits: number[]; sl: Array<[number, number | null]>; miso0: number | null; mosi0: number; sel: boolean; sess: number; tx: number[]; rx: number[] }
export interface Session {
  id: number; t: number; cs: number; end: number; hz: number; bits: 8 | 16; lsb: boolean;
  tx: number[]; rx: number[];
  /** Device view: bytes the LIS3DH clocked in and drove out (null = SDO high-impedance). */
  sel: boolean; dev: number[]; out: Array<number | null>;
}
interface Dev { fall: number; nIn: number; cur: number; nOut: number; lastRise: boolean; miso: number | null; cmd: number | null; outByte: number | null }
export interface Front {
  p: P30; cfg: SpiCfg; regs: Uint8Array; smp: { n: number; read: number };
  dev: Dev; mosi: number; calls: CallRec[]; sessions: Session[]; sessKey: number; nextId: number;
  base: number | null; busy: number; lastAct: number; transfers: number; bytes: number;
}

const fronts = new WeakMap<Mcu, Front>();
function freshRegs() { const r = new Uint8Array(0x40); r[0x0f] = 0x33; r[0x1e] = 0x10; r[0x20] = 0x07; return r; }
export function front(m: Mcu): Front {
  let f = fronts.get(m);
  if (!f) {
    f = {
      p: P30_DEFAULT, cfg: { ...NO_CFG }, regs: freshRegs(), smp: { n: -1, read: -1 },
      dev: { fall: -1, nIn: 0, cur: 0, nOut: 0, lastRise: false, miso: null, cmd: null, outByte: null },
      mosi: 0, calls: [], sessions: [], sessKey: Number.NaN, nextId: 1, base: null, busy: 0, lastAct: -1, transfers: 0, bytes: 0,
    };
    fronts.set(m, f);
  }
  return f;
}
export function clearTransfers(m: Mcu) { const f = front(m); f.sessions = []; f.calls = []; f.base = null; f.sessKey = Number.NaN; }

/* ---------------- device ---------------- */

function updateSample(f: Front, t: number) {
  const odr = odrHz(f.regs[0x20]!);
  if (!odr) return;
  const n = Math.floor(t * odr);
  if (n === f.smp.n) return;
  f.smp.n = n;
  const fmt = outFormat(f.regs[0x20]!, f.regs[0x23]!);
  const g = gravity(f.p.tiltX, f.p.tiltY);
  const lim = (1 << (fmt.bits - 1)) - 1;
  for (let k = 0; k < 3; k++) {
    if (!((f.regs[0x20]! >> k) & 1)) continue;
    const counts = Math.max(-lim - 1, Math.min(lim, Math.round((g[k]! * 1000) / fmt.mg) + hashNoise(n * 3 + k)));
    const raw = (counts << fmt.shift) & 0xffff;
    f.regs[0x28 + 2 * k] = raw & 0xff;
    f.regs[0x29 + 2 * k] = raw >> 8;
  }
}

export function readReg(f: Front, a: number, t: number): number {
  if (a >= 0x27 && a <= 0x2d) updateSample(f, t);
  if (a === 0x27) return f.smp.n > f.smp.read ? 0x0f : 0x00;
  const v = f.regs[a]!;
  if (a === 0x2d) f.smp.read = f.smp.n;
  return v;
}

function devReset(f: Front, fall: number) {
  const d = f.dev;
  d.fall = fall; d.nIn = 0; d.cur = 0; d.nOut = 0; d.lastRise = false; d.cmd = null; d.outByte = null; d.miso = null;
}

function devLaunch(f: Front, s: Session, t: number) {
  const d = f.dev;
  const o = d.nOut++;
  const j = o >> 3;
  if ((o & 7) === 0) {
    if (j === 0 || d.cmd === null || !(d.cmd & 0x80)) d.outByte = null;
    else { const addr = d.cmd & 0x3f; d.outByte = readReg(f, d.cmd & 0x40 ? (addr + j - 1) & 0x3f : addr, t); }
    if (j > 0) s.out.push(d.outByte);
  }
  d.miso = d.outByte === null ? null : (d.outByte >> (7 - (o & 7))) & 1;
}

function devSample(f: Front, s: Session, bit: number) {
  const d = f.dev;
  d.cur = ((d.cur << 1) | bit) & 0xff;
  d.nIn++;
  if (d.nIn % 8) return;
  const byte = d.cur, k = d.nIn / 8 - 1;
  s.dev.push(byte);
  if (k === 0) { d.cmd = byte; return; }
  if (d.cmd !== null && !(d.cmd & 0x80)) {
    const addr = d.cmd & 0x3f, a = d.cmd & 0x40 ? (addr + k - 1) & 0x3f : addr;
    if (WRITABLE.has(a)) f.regs[a] = byte;
  }
}

/* ---------------- bus ---------------- */

const CS_PIN = "PA4";
function lastEdge(m: Mcu, level?: number): number {
  const e = m.edges.get(CS_PIN);
  if (!e) return -1;
  for (let i = e.length - 1; i >= 0; i--) if (level === undefined || e[i]![1] === level) return e[i]![0];
  return -1;
}
export function csSelected(m: Mcu, p: P30) { return !p.csOpen && !m.isFloating(CS_PIN) && m.level(CS_PIN) === 0; }

/** Clock one HAL transfer through master and LIS3DH at bit level and return what the master received. */
export function transfer(m: Mcu, f: Front, words: number[]): { rx: number[]; dur: number } {
  const c = f.cfg, p = f.p, t0 = m.now;
  const hz = spiHz(c.presc), h = 1 / (2 * hz), N = c.bits;
  const key = lastEdge(m);
  let s = f.sessions[f.sessions.length - 1];
  if (!s || f.sessKey !== key || s.tx.length >= 64) {
    f.sessKey = key;
    s = { id: f.nextId++, t: t0, cs: key >= 0 ? key : t0, end: t0, hz, bits: c.bits, lsb: c.lsb, tx: [], rx: [], sel: false, dev: [], out: [] };
    f.sessions.push(s);
    if (f.sessions.length > 300) f.sessions.splice(0, f.sessions.length - 300);
    if (f.base === null) f.base = t0;
  }
  const sel = csSelected(m, p);
  if (sel) { const fall = lastEdge(m, 0); if (f.dev.fall !== fall) { devReset(f, fall); devLaunch(f, s, t0); } s.sel = true; }

  const mBits: number[] = [];
  for (const w of words) for (let i = 0; i < N; i++) mBits.push(c.lsb ? (w >> i) & 1 : (w >> (N - 1 - i)) & 1);
  const nb = mBits.length, off = c.cpha ? 0 : 1;
  const miso0 = sel ? f.dev.miso : null, mosi0 = f.mosi;
  const sl: Array<[number, number | null]> = [];
  const misoAt = (pos: number): number | null => {
    let i = sl.length - 1;
    while (i >= 0 && sl[i]![0] >= pos) i--;
    if (i < 0) return miso0;
    if ((pos - sl[i]![0]) * h < TV_SO) return i > 0 ? sl[i - 1]![1] : miso0;
    return sl[i]![1];
  };
  let mosi = mosi0;
  const rxBits: number[] = [];
  for (let pos = 0; pos <= 2 * nb; pos++) {
    const j = pos - off;
    const edge = j >= 0 && j < 2 * nb;
    const rising = edge && (c.cpol ^ ((j + 1) & 1)) === 1;
    if (edge && rising && sel) devSample(f, s, p.swap ? 1 : mosi);
    if (pos % 2 === 1 && (pos - 1) / 2 < nb) rxBits.push(p.misoOpen || p.swap ? 1 : misoAt(pos) ?? 1);
    if (pos % 2 === 0 && pos / 2 < nb) mosi = mBits[pos / 2]!;
    if (edge && !rising && sel && f.dev.lastRise) { devLaunch(f, s, t0 + pos * h); sl.push([pos, f.dev.miso]); }
    if (edge && sel) f.dev.lastRise = rising;
  }
  f.mosi = mosi;
  const rx: number[] = [];
  for (let k = 0; k < words.length; k++) {
    let w = 0;
    for (let i = 0; i < N; i++) { const b = rxBits[k * N + i]!; if (c.lsb) w |= b << i; else w = (w << 1) | b; }
    rx.push(w);
  }
  const dur = nb / hz;
  s.tx.push(...words); s.rx.push(...rx); s.end = t0 + dur;
  f.calls.push({ t0, h, nb, cfg: { ...c }, mBits, sl, miso0, mosi0, sel, sess: s.id, tx: words, rx });
  if (f.calls.length > 600) f.calls.splice(0, f.calls.length - 600);
  f.lastAct = t0 + dur; f.transfers++; f.bytes += words.length * (N / 8);
  return { rx, dur };
}

/* ---------------- HAL binding ---------------- */

function arrOf(v: Val | undefined) {
  if (v && typeof v === "object" && v.kind === "arr") return v;
  if (v && typeof v === "object" && v.kind === "ref") { const inner = v.ref.get(); if (inner && typeof inner === "object" && inner.kind === "arr") return inner; }
  return null;
}
/** HAL reads Size frames from pData; 16-bit frames read uint16_t, so a uint8_t buffer is consumed as little-endian byte pairs. */
export function readWords(v: Val | undefined, size: number, bits: 8 | 16): number[] {
  if (bits === 8) { const b = readBytes(v, size); while (b.length < size) b.push(0); return b; }
  const a = arrOf(v);
  if (!a) return Array.from({ length: size }, () => 0);
  const d = a.slot.data ?? [];
  const wide = /16|short/.test(a.slot.type);
  return Array.from({ length: size }, (_, k) => wide ? toNum(d[a.off + k] ?? 0) & 0xffff : (toNum(d[a.off + 2 * k] ?? 0) & 0xff) | ((toNum(d[a.off + 2 * k + 1] ?? 0) & 0xff) << 8));
}
export function writeWords(v: Val | undefined, words: number[], bits: 8 | 16) {
  if (bits === 8) { writeBytes(v, words); return; }
  const a = arrOf(v);
  if (!a) return;
  const d = a.slot.data ?? [];
  if (/16|short/.test(a.slot.type)) { words.forEach((w, k) => { if (a.off + k < d.length) d[a.off + k] = w; }); return; }
  writeBytes(v, words.flatMap((w) => [w & 0xff, w >> 8]));
}

const hook: CallHook = (name, args, m, thread) => {
  const f = front(m);
  const fw = m.fw;
  switch (name) {
    case "MX_GPIO_Init":
      if (fw && !fw.hasFunction("MX_GPIO_Init")) m.call("HAL_GPIO_WritePin", ["GPIOA", 1 << 4, 1], fw, thread);
      return undefined;
    case "HAL_SPI_Init": {
      const h = args[0] && typeof args[0] === "object" && args[0].kind === "ref" ? args[0].name : "hspi1";
      const fld = (k: string) => fw?.field(`${h}.Init.${k}`) ?? 0;
      const br = (fld("BaudRatePrescaler") >> 3) & 7;
      f.cfg = { init: true, cpol: fld("CLKPolarity") & 2 ? 1 : 0, cpha: fld("CLKPhase") & 1 ? 1 : 0, bits: fld("DataSize") & 0x800 ? 16 : 8, presc: PRESCALERS[br]!, lsb: (fld("FirstBit") & 0x80) !== 0, master: (fld("Mode") & 4) !== 0 };
      m.log("info", `SPI1 ready: mode ${modeOf(f.cfg)}, ${fmtHz(spiHz(f.cfg.presc))}, ${f.cfg.bits}-bit, ${f.cfg.lsb ? "LSB" : "MSB"} first`);
      return 0;
    }
    case "HAL_SPI_TransmitReceive": case "HAL_SPI_Transmit": case "HAL_SPI_Receive": {
      if (!f.cfg.init || !f.cfg.master) { f.busy++; return 2; }
      const rxOnly = name === "HAL_SPI_Receive", txOnly = name === "HAL_SPI_Transmit";
      const size = Math.max(0, Math.min(256, toNum(args[rxOnly ? 2 : txOnly ? 2 : 3] ?? 0)));
      if (!size) return 1;
      // HAL_SPI_Receive in full-duplex master mode transmits whatever is in the receive buffer.
      const words = readWords(args[1], size, f.cfg.bits);
      const { rx, dur } = transfer(m, f, words);
      if (!txOnly) writeWords(args[rxOnly ? 1 : 2], rx, f.cfg.bits);
      return new Wait(dur);
    }
  }
  return undefined;
};

export function mcu30(): McuOptions {
  return { family: "stm32", constants: SPI_CONST, onCall: hook, cube: { gpio: [{ pin: "PA4", mode: "out" }] } };
}

export function world30(m: Mcu, _dt: number, p: P30) { front(m).p = p; }

/* ---------------- transfer table ---------------- */

export interface Row { key: string; sess: number; t: number; dir: "TX" | "RX"; data: string; desc: string; bad: boolean }

function cmdDesc(b: number) {
  const a = b & 0x3f, inc = b & 0x40 ? " (auto-inc)" : "";
  return b & 0x80 ? `Read ${regName(a)} (0x${hex2(a)})${inc}` : `Write ${regName(a)}${inc}`;
}

/** Table rows from the master's point of view, flagged where the LIS3DH saw or drove something else. */
export function rows(f: Front, limit = 400): Row[] {
  const out: Row[] = [];
  const base = f.base ?? 0;
  const from = Math.max(0, f.sessions.length - Math.ceil(limit / 2));
  for (const s of f.sessions.slice(from)) {
    const byteT = (i: number) => (s.t - base + (i * s.bits) / s.hz) * 1000;
    if (s.bits === 16) {
      s.tx.forEach((w, i) => out.push({ key: `${s.id}t${i}`, sess: s.id, t: byteT(i), dir: "TX", data: w.toString(16).toUpperCase().padStart(4, "0"), desc: `16-bit frame${i === 0 && s.sel && s.dev.length ? `: LIS3DH saw ${s.dev.slice(0, 2).map((b) => `0x${hex2(b)}`).join(", ")}` : ""}`, bad: true }));
      s.rx.forEach((w, i) => out.push({ key: `${s.id}r${i}`, sess: s.id, t: byteT(i), dir: "RX", data: w.toString(16).toUpperCase().padStart(4, "0"), desc: "16-bit frame received", bad: true }));
      continue;
    }
    const cmd = s.tx[0];
    if (cmd === undefined) continue;
    const saw = s.dev[0];
    const notSel = !s.sel;
    const cmdBad = notSel || (saw !== undefined && saw !== cmd);
    out.push({ key: `${s.id}c`, sess: s.id, t: byteT(0), dir: "TX", data: hex2(cmd), desc: `${cmdDesc(cmd)}${notSel ? " · LIS3DH not selected" : cmdBad ? ` · LIS3DH saw 0x${hex2(saw!)}` : ""}`, bad: cmdBad });
    const addr = cmd & 0x3f, inc = (cmd & 0x40) !== 0;
    for (let i = 1; i < s.tx.length; i++) {
      const a = inc ? (addr + i - 1) & 0x3f : addr;
      if (cmd & 0x80) {
        const v = s.rx[i]!, drove = s.out[i - 1];
        const name = a === 0x0f ? "Device ID (LIS3DH)" : AXIS_DESC[a] ?? `${regName(a)} value`;
        const bad = notSel || cmdBad || drove === undefined || drove === null || drove !== v;
        const why = notSel ? " · SDO not driven" : cmdBad ? "" : drove === null || drove === undefined ? " · SDO not driven" : drove !== v ? ` · LIS3DH sent 0x${hex2(drove)}` : "";
        out.push({ key: `${s.id}r${i}`, sess: s.id, t: byteT(i), dir: "RX", data: hex2(v), desc: `${name}${why}`, bad });
      } else {
        const v = s.tx[i]!;
        const ro = !isWritable(a);
        out.push({ key: `${s.id}w${i}`, sess: s.id, t: byteT(i), dir: "TX", data: hex2(v), desc: `${regName(a)} ← 0x${hex2(v)}${ro ? " · read-only, ignored" : ""}`, bad: cmdBad || ro });
      }
    }
  }
  return out.slice(-limit);
}
