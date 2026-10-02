import { Block, toNum } from "../core/cinterp";
import { readBytes, writeBytes, type CallHook, type Mcu, type McuOptions } from "../core/mcu";

export const DEMO = `/* Lab 31: I2C Communication - scan the bus, read a TMP102, show it on an SSD1306, log boots to a 24C02 */
#include "stm32f4xx_hal.h"

#define I2C_SCL_PIN   GPIO_PIN_8
#define I2C_SDA_PIN   GPIO_PIN_9
#define OLED_ADDR     (0x3C << 1)    // HAL takes the 7-bit address shifted left
#define TEMP_ADDR     (0x48 << 1)
#define EEPROM_ADDR   (0x50 << 1)

I2C_HandleTypeDef hi2c1;
HAL_StatusTypeDef st;
uint8_t found[16];
uint8_t nfound = 0;
uint8_t rx[2];
uint8_t buf[43];
uint8_t glyph[7];
int16_t raw = 0;
int tempC10 = 0;
uint8_t boots = 0;
uint8_t check = 0;

/* 5x7 font, one byte per column: 0-9 . C - space degree */
const uint8_t FONT[75] = {
  0x3E,0x51,0x49,0x45,0x3E, 0x00,0x42,0x7F,0x40,0x00, 0x72,0x49,0x49,0x49,0x46, 0x21,0x41,0x49,0x4D,0x33,
  0x18,0x14,0x12,0x7F,0x10, 0x27,0x45,0x45,0x45,0x39, 0x3C,0x4A,0x49,0x49,0x31, 0x41,0x21,0x11,0x09,0x07,
  0x36,0x49,0x49,0x49,0x36, 0x46,0x49,0x49,0x29,0x1E, 0x00,0x60,0x60,0x00,0x00, 0x3E,0x41,0x41,0x41,0x22,
  0x08,0x08,0x08,0x08,0x08, 0x00,0x00,0x00,0x00,0x00, 0x00,0x06,0x09,0x09,0x06 };

void MX_GPIO_Init(void) {
  GPIO_InitTypeDef g = {0};
  __HAL_RCC_GPIOB_CLK_ENABLE();
  g.Pin = I2C_SCL_PIN | I2C_SDA_PIN;
  g.Mode = GPIO_MODE_AF_OD;            // I2C lines are open-drain
  g.Pull = GPIO_NOPULL;                // external pull-ups on the breadboard
  g.Speed = GPIO_SPEED_FREQ_VERY_HIGH;
  g.Alternate = GPIO_AF4_I2C1;
  HAL_GPIO_Init(GPIOB, &g);
}

void MX_I2C1_Init(void) {
  __HAL_RCC_I2C1_CLK_ENABLE();
  hi2c1.Instance = I2C1;
  hi2c1.Init.ClockSpeed = 100000;
  hi2c1.Init.DutyCycle = I2C_DUTYCYCLE_2;
  hi2c1.Init.OwnAddress1 = 0;
  hi2c1.Init.AddressingMode = I2C_ADDRESSINGMODE_7BIT;
  hi2c1.Init.NoStretchMode = I2C_NOSTRETCH_DISABLE;
  HAL_I2C_Init(&hi2c1);
}

void I2C_Scan(void) {
  nfound = 0;
  for (uint8_t a = 0x08; a < 0x78; a++) {
    if (HAL_I2C_IsDeviceReady(&hi2c1, a << 1, 1, 2) == HAL_OK) found[nfound++] = a;
  }
}

void OLED_Cmd(uint8_t c) {
  buf[0] = 0x00;                       // control byte: a command follows
  buf[1] = c;
  HAL_I2C_Master_Transmit(&hi2c1, OLED_ADDR, buf, 2, 10);
}

void OLED_Init(void) {
  OLED_Cmd(0xAE);                      // display off
  OLED_Cmd(0x20); OLED_Cmd(0x00);      // horizontal addressing
  OLED_Cmd(0x8D); OLED_Cmd(0x14);      // charge pump on
  OLED_Cmd(0xAF);                      // display on
}

void OLED_Clear(void) {
  OLED_Cmd(0x21); OLED_Cmd(0); OLED_Cmd(127);
  OLED_Cmd(0x22); OLED_Cmd(0); OLED_Cmd(3);
  for (int i = 0; i < 43; i++) buf[i] = 0x00;
  buf[0] = 0x40;                       // control byte: data follows
  for (int n = 0; n < 16; n++) HAL_I2C_Master_Transmit(&hi2c1, OLED_ADDR, buf, 33, 20);
}

void OLED_Temp(int t10) {
  int v = t10 < 0 ? -t10 : t10;
  glyph[0] = t10 < 0 ? 12 : (v >= 1000 ? 1 : 13);
  glyph[1] = v >= 100 ? (v / 100) % 10 : 13;
  glyph[2] = (v / 10) % 10;
  glyph[3] = 10;
  glyph[4] = v % 10;
  glyph[5] = 14;
  glyph[6] = 11;
  OLED_Cmd(0x21); OLED_Cmd(40); OLED_Cmd(81);   // columns 40-81
  OLED_Cmd(0x22); OLED_Cmd(1); OLED_Cmd(1);     // page 1
  buf[0] = 0x40;
  for (int i = 0; i < 7; i++)
    for (int k = 0; k < 6; k++)
      buf[1 + i * 6 + k] = k < 5 ? FONT[glyph[i] * 5 + k] : 0x00;
  HAL_I2C_Master_Transmit(&hi2c1, OLED_ADDR, buf, 43, 20);
}

int main(void) {
  HAL_Init();
  SystemClock_Config();
  MX_GPIO_Init();
  MX_I2C1_Init();
  I2C_Scan();                          // expect 0x3C, 0x48, 0x50
  OLED_Init();
  OLED_Clear();

  HAL_I2C_Mem_Read(&hi2c1, EEPROM_ADDR, 0x00, I2C_MEMADD_SIZE_8BIT, &boots, 1, 10);
  if (boots == 0xFF) boots = 0;        // blank EEPROM
  boots++;
  HAL_I2C_Mem_Write(&hi2c1, EEPROM_ADDR, 0x00, I2C_MEMADD_SIZE_8BIT, &boots, 1, 10);
  HAL_Delay(5);                        // 24C02 write cycle tWR = 5 ms
  HAL_I2C_Mem_Read(&hi2c1, EEPROM_ADDR, 0x00, I2C_MEMADD_SIZE_8BIT, &check, 1, 10);

  while (1) {
    st = HAL_I2C_Mem_Read(&hi2c1, TEMP_ADDR, 0x00, I2C_MEMADD_SIZE_8BIT, rx, 2, 10);
    if (st == HAL_OK) {
      raw = (int16_t)((rx[0] << 8) | rx[1]) >> 4;   // 12-bit, 0.0625 C per LSB
      tempC10 = raw * 10 / 16;
      OLED_Temp(tempC10);
    }
    HAL_Delay(250);
  }
}
`;

function variant(edits: Array<[string, string]>): string {
  let s = DEMO;
  for (const [a, b] of edits) { if (!s.includes(a)) throw new Error(`L31 variant: '${a}' not found`); s = s.replace(a, b); }
  return s;
}

const RECOVER_FN = `void I2C_BusRecover(void) {
  GPIO_InitTypeDef r = {0};
  HAL_I2C_DeInit(&hi2c1);
  r.Pin = I2C_SCL_PIN;
  r.Mode = GPIO_MODE_OUTPUT_OD;        // drive SCL by hand
  r.Pull = GPIO_NOPULL;
  HAL_GPIO_Init(GPIOB, &r);
  for (int i = 0; i < 9; i++) {        // up to 9 clocks finish the stuck byte
    HAL_GPIO_WritePin(GPIOB, I2C_SCL_PIN, GPIO_PIN_RESET); HAL_Delay(1);
    HAL_GPIO_WritePin(GPIOB, I2C_SCL_PIN, GPIO_PIN_SET);   HAL_Delay(1);
  }
  MX_GPIO_Init();
  MX_I2C1_Init();
}

int main(void) {`;

export const RECOVER = variant([
  ["/* Lab 31: I2C Communication - scan the bus, read a TMP102, show it on an SSD1306, log boots to a 24C02 */", "/* Lab 31: I2C with bus recovery - clock SCL by hand when a slave holds SDA low */"],
  ["int main(void) {", RECOVER_FN],
  ["      OLED_Temp(tempC10);\n    }", "      OLED_Temp(tempC10);\n    } else if (st == HAL_BUSY) {\n      I2C_BusRecover();\n    }"],
]);

export const ACKPOLL = variant([
  ["/* Lab 31: I2C Communication - scan the bus, read a TMP102, show it on an SSD1306, log boots to a 24C02 */", "/* Lab 31: EEPROM ACK polling - wait for the 24C02 write cycle by probing its address */"],
  ["  HAL_Delay(5);                        // 24C02 write cycle tWR = 5 ms", "  while (HAL_I2C_IsDeviceReady(&hi2c1, EEPROM_ADDR, 1, 2) != HAL_OK) { }   // NACK while writing"],
]);

export const FAST = variant([
  ["/* Lab 31: I2C Communication - scan the bus, read a TMP102, show it on an SSD1306, log boots to a 24C02 */", "/* Lab 31: Fast mode (400 kHz) - check the rise time with your pull-ups */"],
  ["hi2c1.Init.ClockSpeed = 100000;", "hi2c1.Init.ClockSpeed = 400000;"],
]);

export const BUG_SHIFT = variant([
  ["/* Lab 31: I2C Communication - scan the bus, read a TMP102, show it on an SSD1306, log boots to a 24C02 */", "/* Lab 31 (bug): 7-bit address passed without the shift - the sensor never answers */"],
  ["#define TEMP_ADDR     (0x48 << 1)", "#define TEMP_ADDR     0x48"],
]);

export const BUG_EEWAIT = variant([
  ["/* Lab 31: I2C Communication - scan the bus, read a TMP102, show it on an SSD1306, log boots to a 24C02 */", "/* Lab 31 (bug): reading the EEPROM during its write cycle */"],
  ["  HAL_Delay(5);                        // 24C02 write cycle tWR = 5 ms\n", ""],
]);

export const BUG_PP = variant([
  ["/* Lab 31: I2C Communication - scan the bus, read a TMP102, show it on an SSD1306, log boots to a 24C02 */", "/* Lab 31 (bug): push-pull pins fight the slaves during ACK */"],
  ["g.Mode = GPIO_MODE_AF_OD;            // I2C lines are open-drain", "g.Mode = GPIO_MODE_AF_PP;            // I2C lines are open-drain"],
]);

export const VARIANTS = [
  { label: "C (STM32 HAL)", code: DEMO },
  { label: "Fast mode 400 kHz", code: FAST },
  { label: "EEPROM ACK polling", code: ACKPOLL },
  { label: "Bus recovery", code: RECOVER },
  { label: "Bug: unshifted address", code: BUG_SHIFT },
  { label: "Bug: no EEPROM delay", code: BUG_EEWAIT },
  { label: "Bug: push-pull pins", code: BUG_PP },
];

/* ---------------- configuration ---------------- */

export const PCLK1 = 42e6;
export const I2C_CONST: Record<string, number> = {
  I2C_MEMADD_SIZE_8BIT: 1, I2C_MEMADD_SIZE_16BIT: 0x10, I2C_DUTYCYCLE_2: 0, I2C_DUTYCYCLE_16_9: 0x4000,
  I2C_ADDRESSINGMODE_7BIT: 0x4000, I2C_ADDRESSINGMODE_10BIT: 0xc000, I2C_DUALADDRESS_DISABLE: 0, I2C_DUALADDRESS_ENABLE: 0x1,
  I2C_GENERALCALL_DISABLE: 0, I2C_GENERALCALL_ENABLE: 0x40, I2C_NOSTRETCH_DISABLE: 0, I2C_NOSTRETCH_ENABLE: 0x80,
};
export const SPEEDS = [100000, 400000, 1000000];
/** UM-10204 maximum rise time (30 % to 70 %) per bus mode. */
export const TR_MAX = (hz: number) => (hz <= 100000 ? 1000e-9 : hz <= 400000 ? 300e-9 : 120e-9);
export const R_INT = 40000;
export const PULLUPS = { "2k2": 2200, "4k7": 4700, "10k": 10000, none: Infinity } as const;
export type PullKey = keyof typeof PULLUPS;
export const PULL_LABEL: Record<PullKey, string> = { "2k2": "2.2 kΩ", "4k7": "4.7 kΩ", "10k": "10 kΩ", none: "None (removed)" };

export const fmtHz = (hz: number) => (!Number.isFinite(hz) || hz <= 0 ? "–" : hz >= 1e6 ? `${+(hz / 1e6).toFixed(2)} MHz` : `${+(hz / 1e3).toFixed(1)} kHz`);
export const fmtT = (s: number) => (!Number.isFinite(s) ? "∞" : s >= 1e-3 ? `${+(s * 1e3).toFixed(2)} ms` : s >= 1e-6 ? `${+(s * 1e6).toFixed(2)} µs` : `${Math.round(s * 1e9)} ns`);
export const hex2 = (b: number) => (b & 0xff).toString(16).toUpperCase().padStart(2, "0");

export type FieldKey = "clock" | "duty" | "addr" | "sda" | "scl" | "pull" | "otype";
const FIELDS: Record<FieldKey, RegExp> = {
  clock: /(hi2c1\.Init\.ClockSpeed\s*=\s*)(\d+)/,
  duty: /(hi2c1\.Init\.DutyCycle\s*=\s*I2C_DUTYCYCLE_)(2|16_9)\b/,
  addr: /(hi2c1\.Init\.AddressingMode\s*=\s*I2C_ADDRESSINGMODE_)(7BIT|10BIT)\b/,
  sda: /(#define\s+I2C_SDA_PIN\s+GPIO_PIN_)(\d+)/,
  scl: /(#define\s+I2C_SCL_PIN\s+GPIO_PIN_)(\d+)/,
  pull: /(g\.Pull\s*=\s*GPIO_)(NOPULL|PULLUP)\b/,
  otype: /(g\.Mode\s*=\s*GPIO_MODE_AF_)(OD|PP)\b/,
};
export const codeField = (src: string, k: FieldKey) => src.match(FIELDS[k])?.[2] ?? null;
export const setCodeField = (src: string, k: FieldKey, v: string) => src.replace(FIELDS[k], (_m, a: string) => `${a}${v}`);

export interface Cfg { init: boolean; hz: number; duty: 0 | 1; tenBit: boolean }
export type DevKey = "oled" | "temp" | "eeprom";
export const TEMP_BASE = 0x48;

export type Trig = "any" | "temp" | "oled" | "eeprom" | "nack";
export type P31 = { pullup: PullKey; cap: number; tempC: number; oled: boolean; temp: boolean; eeprom: boolean; tempAddr: number; span: number; trig: Trig };
export const P31_DEFAULT: P31 = { pullup: "4k7", cap: 50, tempC: 24.5, oled: true, temp: true, eeprom: true, tempAddr: 0, span: 0, trig: "temp" };
export const SPANS = [1, 2, 3, 5, 8, 0];

/* ---------------- device models ---------------- */

export const OLED_W = 128, OLED_PAGES = 4;
interface Oled { on: boolean; pump: boolean; mode: number; col: number; page: number; c0: number; c1: number; p0: number; p1: number; contrast: number; invert: boolean; allOn: boolean; ram: Uint8Array; cmd: number[]; expect: "ctrl" | "one" | "stream"; dc: boolean }
const OLED_ARGS: Record<number, number> = { 0x20: 1, 0x21: 2, 0x22: 2, 0x81: 1, 0x8d: 1, 0xa8: 1, 0xd3: 1, 0xd5: 1, 0xd9: 1, 0xda: 1, 0xdb: 1, 0xa3: 2, 0x26: 6, 0x27: 6, 0x29: 5, 0x2a: 5 };
function newOled(): Oled {
  // GDDRAM is not cleared at power-up: deterministic "noise" stands in for the random content.
  const ram = new Uint8Array(OLED_W * OLED_PAGES);
  let s = 0x9e3779b9;
  for (let i = 0; i < ram.length; i++) { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; ram[i] = (s >>> 3) & 0xff; }
  return { on: false, pump: false, mode: 2, col: 0, page: 0, c0: 0, c1: 127, p0: 0, p1: OLED_PAGES - 1, contrast: 0x7f, invert: false, allOn: false, ram, cmd: [], expect: "ctrl", dc: false };
}
function oledExec(o: Oled, c: number[]) {
  const [op, a = 0, b = 0] = c;
  switch (op) {
    case 0xae: o.on = false; return;
    case 0xaf: o.on = true; return;
    case 0x8d: o.pump = (a & 0x04) !== 0; return;
    case 0x20: o.mode = a & 3; return;
    case 0x21: o.c0 = a & 127; o.c1 = b & 127; o.col = o.c0; return;
    case 0x22: o.p0 = a & (OLED_PAGES - 1); o.p1 = b & (OLED_PAGES - 1); o.page = o.p0; return;
    case 0x81: o.contrast = a; return;
    case 0xa6: o.invert = false; return;
    case 0xa7: o.invert = true; return;
    case 0xa4: o.allOn = false; return;
    case 0xa5: o.allOn = true; return;
  }
  if (op === undefined) return;
  if (op >= 0xb0 && op <= 0xb7) o.page = op & (OLED_PAGES - 1);
  else if (op <= 0x0f) o.col = (o.col & 0xf0) | op;
  else if (op >= 0x10 && op <= 0x1f) o.col = ((op & 0x0f) << 4) | (o.col & 0x0f);
}
function oledData(o: Oled, b: number) {
  o.ram[o.page * OLED_W + o.col] = b;
  if (o.mode === 0) { if (++o.col > o.c1) { o.col = o.c0; if (++o.page > o.p1) o.page = o.p0; } }
  else if (o.mode === 1) { if (++o.page > o.p1) { o.page = o.p0; if (++o.col > o.c1) o.col = o.c0; } }
  else o.col = (o.col + 1) & 127;
}
function oledByte(o: Oled, b: number) {
  if (o.expect === "ctrl") { o.dc = (b & 0x40) !== 0; o.expect = b & 0x80 ? "one" : "stream"; return; }
  if (o.expect === "one") o.expect = "ctrl";
  if (o.dc) { oledData(o, b); return; }
  o.cmd.push(b);
  const need = OLED_ARGS[o.cmd[0]!] ?? 0;
  if (o.cmd.length > need) { oledExec(o, o.cmd); o.cmd = []; }
}
export const oledVisible = (o: Oled) => o.on && o.pump;
export const oledPixel = (o: Oled, x: number, y: number) => (o.allOn ? 1 : ((o.ram[(y >> 3) * OLED_W + x]! >> (y & 7)) & 1) ^ (o.invert ? 1 : 0));

interface Tmp { ptr: number; regs: number[]; wr: number; rd: number; T: number; next: number; n: number }
const newTmp = (): Tmp => ({ ptr: 0, regs: [0, 0x60a0, 0x4b00, 0x5000], wr: 0, rd: 0, T: Number.NaN, next: 0, n: 0 });
export const tmpCelsius = (reg: number) => (((reg << 16) >> 16) >> 4) * 0.0625;

export const EE_SIZE = 256, EE_PAGE = 8, EE_TWR = 5e-3;
let eeStore = new Uint8Array(EE_SIZE).fill(0xff);
/** The 24C02 is non-volatile: its contents survive Run and Reset Simulation, and are only cleared by Reset Lab. */
export function resetEeprom() { eeStore = new Uint8Array(EE_SIZE).fill(0xff); }
interface Ee { addr: number; busyUntil: number; gotAddr: boolean; pend: Array<[number, number]>; base: number }
const newEe = (): Ee => ({ addr: 0, busyUntil: 0, gotAddr: false, pend: [], base: 0 });

/* ---------------- front state ---------------- */

export type Item =
  | { k: "S" | "Sr" | "P"; t: number }
  | { k: "byte"; t: number; t1: number; v: number; by: "m" | "s"; ack: boolean; ackBy: "m" | "s"; role: "addr" | "hdr" | "reg" | "data"; samples: number[] };
export type Op = "probe" | "tx" | "rx" | "memw" | "memr" | "busy";
export interface Txn {
  id: number; t: number; end: number; op: Op; addr: number; rw: 0 | 1; dev: DevKey | null; status: number; note: string; pp: boolean;
  items: Item[]; scl: Array<[number, number]>; sda: Array<[number, number]>; tau: number; hz: number; data: number[]; reg: number | null;
}
export interface Front {
  p: P31; cfg: Cfg; oled: Oled; tmp: Tmp; ee: Ee; txns: Txn[]; nextId: number; nackNext: boolean;
  hang: { t: number; bits: number } | null; recovered: number; notReady: number; busy: number; acks: number; nacks: number; errors: number;
  pinExt: Record<string, number | null>; eeWrites: number; eeNack: number; trimmed: boolean;
}
const FRONT = new WeakMap<Mcu, Front>();
export function front(m: Mcu): Front {
  let f = FRONT.get(m);
  if (!f) {
    f = { p: P31_DEFAULT, cfg: { init: false, hz: 100000, duty: 0, tenBit: false }, oled: newOled(), tmp: newTmp(), ee: newEe(), txns: [], nextId: 1, nackNext: false, hang: null, recovered: 0, notReady: 0, busy: 0, acks: 0, nacks: 0, errors: 0, pinExt: {}, eeWrites: 0, eeNack: 0, trimmed: false };
    FRONT.set(m, f);
  }
  return f;
}
export const eeprom = () => eeStore;
export function clearTxns(m: Mcu) { const f = front(m); f.txns = []; f.trimmed = false; f.acks = 0; f.nacks = 0; f.errors = 0; f.busy = 0; }
export function injectNack(m: Mcu) { front(m).nackNext = true; }
export function hangBus(m: Mcu) { const f = front(m); f.hang = { t: m.now, bits: 6 }; m.log("fault", "TMP102 reset mid-read: it holds SDA low, waiting for 6 more clocks"); }
export function powerCycle(m: Mcu) {
  const f = front(m);
  f.hang = null; f.oled = newOled(); f.tmp = newTmp(); f.ee = newEe();
  m.log("info", "I2C devices power-cycled: SSD1306 RAM is random again, TMP102 pointer = 0, 24C02 keeps its data");
}

export const tempAddrOf = (p: P31) => TEMP_BASE + (p.tempAddr & 3);
export const devAddr = (p: P31, k: DevKey) => (k === "oled" ? 0x3c : k === "temp" ? tempAddrOf(p) : 0x50);
export const DEV_NAME: Record<DevKey, string> = { oled: "SSD1306", temp: "TMP102", eeprom: "24C02" };
export const plugged = (p: P31, k: DevKey) => p[k];
export const nDevices = (p: P31) => (["oled", "temp", "eeprom"] as const).filter((k) => p[k]).length;

/* ---------------- electrical model ---------------- */

export function internalPull(m: Mcu) { return m.pin("PB8").pull === "up" && m.pin("PB9").pull === "up"; }
export function elec(p: P31, intPull: boolean) {
  const ext = PULLUPS[p.pullup];
  const R = intPull ? (Number.isFinite(ext) ? (ext * R_INT) / (ext + R_INT) : R_INT) : ext;
  const C = (p.cap + 10 + 10 * nDevices(p)) * 1e-12;
  const tau = R * C;
  return { R, C, tau, tr: 0.8473 * tau, tVih: 1.204 * tau, iol: Number.isFinite(R) ? (3.3 - 0.4) / R : 0 };
}
export function timing(cfg: Cfg, tau: number) {
  let tH: number, tL: number;
  if (cfg.hz <= 100000) { const ccr = Math.max(4, Math.floor((PCLK1 - 1) / (cfg.hz * 2)) + 1); tH = tL = ccr / PCLK1; }
  else if (!cfg.duty) { const ccr = Math.max(1, Math.floor((PCLK1 - 1) / (cfg.hz * 3)) + 1); tH = ccr / PCLK1; tL = 2 * tH; }
  else { const ccr = Math.max(1, Math.floor((PCLK1 - 1) / (cfg.hz * 25)) + 1); tH = (9 * ccr) / PCLK1; tL = (16 * ccr) / PCLK1; }
  // The STM32 counts tHIGH only once it sees SCL high, so a slow rise stretches every period.
  const tVih = 1.204 * tau;
  return { tH, tL, tVih, period: tH + tL + tVih, nominal: 1 / (tH + tL) };
}

type BusState = { kind: "ok"; pp: boolean } | { kind: "busy"; why: string } | { kind: "nowhere"; why: string };
export function busState(m: Mcu, f: Front): BusState {
  const af4 = (k: string) => { const p = m.pin(k); return p.mode === "af" && p.af === 4; };
  const scl = ["PB8", "PB6"].find(af4), sda = ["PB9", "PB7"].find(af4);
  if (!scl || !sda) return { kind: "busy", why: `${!scl ? "SCL" : "SDA"} is not connected to I2C1 (no pin in alternate function 4), so the peripheral sees the line low and sets BUSY` };
  if (scl !== "PB8" || sda !== "PB9") {
    const pulled = m.pin(scl).pull === "up" && m.pin(sda).pull === "up";
    const why = `I2C1 drives ${scl}/${sda}, but the devices are wired to PB8/PB9`;
    return pulled ? { kind: "nowhere", why: `${why}: the internal pull-ups keep the unused pins high, so every address is NACKed` } : { kind: "busy", why: `${why}: ${scl}/${sda} float low with no pull-up and I2C1 reports BUSY` };
  }
  if (f.hang) return { kind: "busy", why: "SDA is held low by the TMP102 (it was reset in the middle of a read), so I2C1 never sees a free bus" };
  if (!Number.isFinite(elec(f.p, internalPull(m)).R)) return { kind: "busy", why: "there is no pull-up on SDA/SCL: open-drain outputs can only pull low, so both lines sit at 0 V and I2C1 reports BUSY" };
  return { kind: "ok", pp: !m.pin("PB8").od || !m.pin("PB9").od };
}

/* ---------------- bit-level transaction engine ---------------- */

class Gen {
  t: number; items: Item[] = []; scl: Array<[number, number]> = []; sda: Array<[number, number]> = []; private sdaLv = 1; private sclLv = 1;
  constructor(t0: number, private tm: ReturnType<typeof timing>) { this.t = t0; }
  private setSda(t: number, v: number) { if (v !== this.sdaLv) { this.sda.push([t, v]); this.sdaLv = v; } }
  private setScl(t: number, v: number) { if (v !== this.sclLv) { this.scl.push([t, v]); this.sclLv = v; } }
  start(rep: boolean) {
    const { tL, tH, tVih } = this.tm;
    if (rep) { this.setSda(this.t + tL * 0.25, 1); this.t += tL; this.setScl(this.t, 1); this.t += tVih + tH / 2; }
    this.setSda(this.t, 0);
    this.items.push({ k: rep ? "Sr" : "S", t: this.t });
    this.t += rep ? tH / 2 : tH;
    this.setScl(this.t, 0);
  }
  private bit(v: number) {
    const { tL, tH, tVih } = this.tm;
    this.setSda(this.t + tL * 0.25, v);
    this.t += tL;
    this.setScl(this.t, 1);
    this.t += tVih;
    const ts = this.t + tH / 2;
    this.t += tH;
    this.setScl(this.t, 0);
    return ts;
  }
  byte(v: number, by: "m" | "s", ackBy: "m" | "s", role: "addr" | "hdr" | "reg" | "data", ack: () => boolean) {
    const t0 = this.t;
    const samples: number[] = [];
    for (let i = 7; i >= 0; i--) samples.push(this.bit((v >> i) & 1));
    const a = ack();
    samples.push(this.bit(a ? 0 : 1));
    this.items.push({ k: "byte", t: t0, t1: this.t, v, by, ack: a, ackBy, role, samples });
    return a;
  }
  stop() {
    const { tL, tH, tVih } = this.tm;
    this.setSda(this.t + tL * 0.25, 0);
    this.t += tL;
    this.setScl(this.t, 1);
    this.t += tVih + tH / 2;
    this.setSda(this.t, 1);
    this.items.push({ k: "P", t: this.t });
    this.t += tL;
  }
}

interface Spec { op: Exclude<Op, "busy">; addr8: number; reg?: number; regSize?: number; data?: number[]; n?: number }

function devFor(f: Front, a7: number): DevKey | null {
  for (const k of ["oled", "temp", "eeprom"] as const) if (f.p[k] && devAddr(f.p, k) === a7) return k;
  return null;
}

function transfer(m: Mcu, f: Front, s: Spec, t0 = m.now): { status: number; rx: number[]; dur: number } {
  const bs = busState(m, f);
  const a7 = (s.addr8 >> 1) & 0x7f;
  const rec = (x: Partial<Txn> & { op: Op; status: number; note: string; end: number }) => {
    const e = elec(f.p, internalPull(m));
    const t: Txn = { id: f.nextId++, t: t0, addr: a7, rw: s.op === "rx" ? 1 : 0, dev: null, pp: false, items: [], scl: [], sda: [], tau: e.tau, hz: f.cfg.hz, data: [], reg: s.reg ?? null, ...x };
    f.txns.push(t);
    if (f.txns.length > 400) { f.txns.splice(0, f.txns.length - 400); f.trimmed = true; }
    return t;
  };
  if (bs.kind === "busy") {
    f.busy++;
    const last = f.txns[f.txns.length - 1];
    if (last && last.op === "busy" && last.note === bs.why) { last.end = t0 + 0.025; last.data.push(0); }
    else rec({ op: "busy", status: 2, note: bs.why, end: t0 + 0.025, data: [0] });
    return { status: 2, rx: [], dur: 0.025 };
  }
  const pp = bs.kind === "ok" && bs.pp;
  const e = elec(f.p, internalPull(m));
  const tm = timing(f.cfg, e.tau);
  const g = new Gen(t0, tm);
  const dk = bs.kind === "nowhere" ? null : devFor(f, a7);
  let note = "";
  const nack = (why: string) => { if (!note) note = why; return false; };
  const slaveAck = (ok: boolean, why: string) => (!ok ? nack(why) : pp ? nack("push-pull SDA: the master drives the line high while the slave pulls it low for ACK, so the ACK is lost (and the pins fight)") : true);

  const addrAck = (rw: 0 | 1) => {
    if (f.nackNext) { f.nackNext = false; return nack("NACK injected on the address byte"); }
    if (f.cfg.tenBit) return nack("10-bit addressing: the header 11110xx is reserved, no 7-bit device answers it");
    if (bs.kind === "nowhere") return nack(bs.why);
    if (!dk) return nack(`no device answers address 0x${hex2(a7)}`);
    if (dk === "eeprom" && t0 < f.ee.busyUntil) { f.eeNack++; return nack(`24C02 busy with its internal write cycle (tWR = 5 ms) until ${(f.ee.busyUntil * 1e3).toFixed(2)} ms`); }
    if (dk === "oled" && f.cfg.hz > 400000) return nack("SSD1306 is specified up to 400 kHz: at this clock it misses its address");
    const ok = slaveAck(true, "");
    if (ok) devStart(f, dk, rw, t0);
    return ok;
  };
  const sendAddr = (rw: 0 | 1) => {
    if (f.cfg.tenBit) return g.byte(0xf0 | ((s.addr8 >> 7) & 6) | rw, "m", "s", "hdr", () => addrAck(rw));
    return g.byte((a7 << 1) | rw, "m", "s", "addr", () => addrAck(rw));
  };
  const wr = (b: number, role: "reg" | "data") => g.byte(b & 0xff, "m", "s", role, () => slaveAck(dk ? devWrite(f, dk, b & 0xff) : false, dk ? `${DEV_NAME[dk]} NACKed data byte 0x${hex2(b)}` : "no device"));

  const rx: number[] = [];
  let ok = true;
  g.start(false);
  if (s.op === "probe") ok = sendAddr(0);
  else if (s.op === "tx" || s.op === "memw") {
    ok = sendAddr(0);
    if (ok && s.op === "memw") { if (s.regSize === 2) ok = wr((s.reg ?? 0) >> 8, "reg"); if (ok) ok = wr(s.reg ?? 0, "reg"); }
    for (const b of s.data ?? []) { if (!ok) break; ok = wr(b, "data"); }
  } else if (s.op === "rx" || s.op === "memr") {
    if (s.op === "memr") {
      ok = sendAddr(0);
      if (ok && s.regSize === 2) ok = wr((s.reg ?? 0) >> 8, "reg");
      if (ok) ok = wr(s.reg ?? 0, "reg");
      if (ok) g.start(true);
    }
    if (ok) ok = sendAddr(1);
    const n = s.n ?? 0;
    for (let i = 0; ok && i < n; i++) { const v = dk ? devRead(f, dk) : 0xff; rx.push(v); g.byte(v, "s", "m", "data", () => i < n - 1); }
  }
  g.stop();
  if (dk && ok) devStop(f, dk, g.t, m);
  if (dk && !ok && dk === "eeprom") f.ee.pend = [];
  const status = ok ? 0 : 1;
  if (ok) f.acks++; else { f.nacks++; f.errors++; }
  rec({ op: s.op, rw: s.op === "rx" || s.op === "memr" ? 1 : 0, dev: dk, status, note, end: g.t, pp, items: g.items, scl: g.scl, sda: g.sda, tau: e.tau, hz: 1 / tm.period, data: s.op === "rx" || s.op === "memr" ? rx : (s.data ?? []).slice(0, 64) });
  return { status, rx, dur: g.t - t0 };
}

function devStart(f: Front, k: DevKey, rw: 0 | 1, _t: number) {
  // The SSD1306 keeps a partly received multi-byte command across transactions; only the control-byte framing restarts.
  if (k === "oled") f.oled.expect = "ctrl";
  else if (k === "temp") { f.tmp.wr = 0; f.tmp.rd = 0; }
  else if (k === "eeprom") { f.ee.gotAddr = rw === 1; f.ee.pend = []; }
}
function devWrite(f: Front, k: DevKey, b: number): boolean {
  if (k === "oled") { oledByte(f.oled, b); return true; }
  if (k === "temp") {
    const t = f.tmp;
    if (t.wr === 0) { t.ptr = b & 3; t.wr = 1; return true; }
    const r = t.ptr;
    if (r === 0) { t.wr++; return true; }
    if (t.wr === 1) t.regs[r] = (b << 8) | (t.regs[r]! & 0xff); else if (t.wr === 2) t.regs[r] = (t.regs[r]! & 0xff00) | b;
    t.wr++;
    return true;
  }
  const e = f.ee;
  if (!e.gotAddr) { e.addr = b; e.base = b & ~(EE_PAGE - 1); e.gotAddr = true; return true; }
  e.pend.push([e.base + (e.addr & (EE_PAGE - 1)), b]);
  e.addr = e.base + ((e.addr + 1) & (EE_PAGE - 1));
  return true;
}
function devRead(f: Front, k: DevKey): number {
  if (k === "temp") { const t = f.tmp; const reg = t.regs[t.ptr]!; return t.rd++ % 2 === 0 ? (reg >> 8) & 0xff : reg & 0xff; }
  if (k === "eeprom") { const v = eeStore[f.ee.addr]!; f.ee.addr = (f.ee.addr + 1) & (EE_SIZE - 1); return v; }
  return 0xff;
}
function devStop(f: Front, k: DevKey, t: number, m: Mcu) {
  if (k !== "eeprom") return;
  const e = f.ee;
  if (!e.pend.length) return;
  for (const [a, v] of e.pend) eeStore[a & (EE_SIZE - 1)] = v;
  if (e.pend.length > 0) e.addr = (e.pend[e.pend.length - 1]![0] + 1) & (EE_SIZE - 1);
  e.busyUntil = t + EE_TWR;
  f.eeWrites++;
  m.log("bus", `24C02 write cycle started (${e.pend.length} byte${e.pend.length === 1 ? "" : "s"}): NACK until +5 ms`);
  e.pend = [];
}

/* ---------------- HAL binding ---------------- */

const done = (_m: Mcu, dur: number, result: number) => new Block(() => false, Math.max(0, dur), () => result, "i2c");

const hook: CallHook = (name, args, m) => {
  const f = front(m);
  const fw = m.fw;
  const n = (i: number) => toNum(args[i] ?? 0);
  switch (name) {
    case "HAL_I2C_Init": {
      const h = args[0] && typeof args[0] === "object" && args[0].kind === "ref" ? args[0].name : "hi2c1";
      const fld = (k: string) => fw?.field(`${h}.Init.${k}`) ?? 0;
      const hz = fld("ClockSpeed");
      if (hz <= 0) { m.log("fault", "HAL_I2C_Init: ClockSpeed must be > 0"); f.cfg.init = false; return 1; }
      f.cfg = { init: true, hz, duty: fld("DutyCycle") & 0x4000 ? 1 : 0, tenBit: (fld("AddressingMode") & 0xc000) === 0xc000 };
      m.log("info", `I2C1 ready: ${fmtHz(hz)}${hz > 100000 ? ` (Fast mode, duty ${f.cfg.duty ? "16:9" : "2:1"})` : " (Standard mode)"}, ${f.cfg.tenBit ? "10" : "7"}-bit addressing`);
      return 0;
    }
    case "HAL_I2C_DeInit": f.cfg.init = false; return 0;
    case "HAL_I2C_IsDeviceReady": case "HAL_I2C_Master_Transmit": case "HAL_I2C_Master_Receive": case "HAL_I2C_Mem_Write": case "HAL_I2C_Mem_Read": {
      if (!f.cfg.init) { f.notReady++; return 2; }
      const addr8 = n(1);
      if (name === "HAL_I2C_IsDeviceReady") {
        const trials = Math.max(1, Math.min(10, n(2)));
        let dur = 0, st = 1;
        for (let i = 0; i < trials; i++) {
          const r = transfer(m, f, { op: "probe", addr8 }, m.now + dur);
          dur += r.dur;
          if (r.status === 2) { st = 2; break; }
          if (r.status === 0) { st = 0; break; }
        }
        return done(m, dur, st);
      }
      let r: { status: number; rx: number[]; dur: number };
      if (name === "HAL_I2C_Master_Transmit") r = transfer(m, f, { op: "tx", addr8, data: readBytes(args[2], Math.min(512, n(3))) });
      else if (name === "HAL_I2C_Master_Receive") { r = transfer(m, f, { op: "rx", addr8, n: Math.min(512, n(3)) }); if (r.status === 0) writeBytes(args[2], r.rx); }
      else if (name === "HAL_I2C_Mem_Write") r = transfer(m, f, { op: "memw", addr8, reg: n(2) & 0xffff, regSize: n(3) === 0x10 ? 2 : 1, data: readBytes(args[4], Math.min(512, n(5))) });
      else { r = transfer(m, f, { op: "memr", addr8, reg: n(2) & 0xffff, regSize: n(3) === 0x10 ? 2 : 1, n: Math.min(512, n(5)) }); if (r.status === 0) writeBytes(args[4], r.rx); }
      return done(m, r.dur, r.status);
    }
  }
  return undefined;
};

export function mcu31(): McuOptions {
  return { family: "stm32", constants: I2C_CONST, onCall: hook };
}

export function world31(m: Mcu, dt: number, p: P31) {
  const f = front(m);
  f.p = p;
  const e = elec(p, internalPull(m));
  const high = Number.isFinite(e.R) ? 1 : 0;
  const want: Record<string, number> = { PB8: high, PB9: f.hang ? 0 : high };
  for (const k of ["PB8", "PB9"]) if (f.pinExt[k] !== want[k]) { f.pinExt[k] = want[k]!; m.setInput(k, want[k]!); }

  if (f.hang && m.pin("PB8").mode === "out") {
    const rises = (m.edges.get("PB8") ?? []).filter(([t, v]) => v === 1 && t > f.hang!.t).length;
    if (rises >= f.hang.bits + 1) {
      f.hang = null; f.recovered++;
      m.log("bus", `TMP102 released SDA after ${rises} SCL clocks: the bus is free again`);
    }
  }

  const t = f.tmp;
  if (Number.isNaN(t.T)) { t.T = p.tempC; t.next = 0; }
  if (m.now >= t.next) {
    t.T += (p.tempC - t.T) * (1 - Math.exp(-0.25 / 0.8));
    const noise = (((t.n * 2654435761) >>> 0) % 3) - 1;
    t.n++;
    const lsb = Math.max(-2048, Math.min(2047, Math.round(t.T / 0.0625) + (Math.abs(p.tempC - t.T) < 0.05 ? noise : 0)));
    t.regs[0] = ((lsb & 0xfff) << 4) & 0xffff;
    t.next = m.now + 0.25;
  }
  void dt;
}

/* ---------------- decoding for the monitor ---------------- */

const OLED_CMD: Record<number, string> = { 0xae: "display off", 0xaf: "display on", 0x20: "addressing mode", 0x21: "column range", 0x22: "page range", 0x8d: "charge pump", 0x81: "contrast", 0xa6: "normal", 0xa7: "inverse", 0xa4: "show RAM", 0xa5: "all pixels on" };

export function txnDesc(t: Txn): string {
  const who = t.dev ? DEV_NAME[t.dev] : `0x${hex2(t.addr)}`;
  if (t.op === "busy") return `HAL_BUSY ×${t.data.length}: ${t.note}`;
  if (t.status) return `${who}: NACK - ${t.note}`;
  if (t.op === "probe") return `${who} ACKs its address`;
  if (t.dev === "oled" && t.op === "tx") {
    const [c, ...rest] = t.data;
    if (c === 0x00 && rest.length === 1) { const op = rest[0]!; return `OLED command 0x${hex2(op)}${OLED_CMD[op] ? ` (${OLED_CMD[op]})` : ""}`; }
    if (c === 0x00) return `OLED command argument${rest.length > 1 ? "s" : ""} ${rest.map((b) => `0x${hex2(b)}`).join(" ")}`;
    if (c === 0x40) return `OLED pixel data, ${rest.length} column bytes`;
  }
  if (t.dev === "temp" && t.op === "memr" && t.reg === 0 && t.data.length >= 2) return `TMP102 temperature 0x${hex2(t.data[0]!)}${hex2(t.data[1]!)} = ${tmpCelsius((t.data[0]! << 8) | t.data[1]!).toFixed(2)} °C`;
  if (t.dev === "eeprom" && t.op === "memw") return `24C02 [0x${hex2(t.reg ?? 0)}] ← ${t.data.map((b) => `0x${hex2(b)}`).join(" ")}`;
  if (t.dev === "eeprom" && t.op === "memr") return `24C02 [0x${hex2(t.reg ?? 0)}] → ${t.data.map((b) => `0x${hex2(b)}`).join(" ")}`;
  return `${who} ${t.op === "rx" || t.op === "memr" ? "read" : "write"} ${t.data.length} byte${t.data.length === 1 ? "" : "s"}`;
}

/** Frame notation: S 0x48 W A 00 A Sr 0x48 R A 19 A 80 N P */
export function frameText(t: Txn, max = 12): string {
  if (t.op === "busy") return "SDA/SCL low: no START possible";
  const out: string[] = [];
  let n = 0;
  for (const it of t.items) {
    if (it.k !== "byte") { out.push(it.k); continue; }
    if (n++ >= max) { out.push("…"); break; }
    if (it.role === "addr") out.push(`0x${hex2(it.v >> 1)} ${it.v & 1 ? "R" : "W"}`, it.ack ? "A" : "N");
    else if (it.role === "hdr") out.push(`hdr 0x${hex2(it.v)}`, it.ack ? "A" : "N");
    else out.push(hex2(it.v), it.ack ? "A" : "N");
  }
  if (out[out.length - 1] === "…") { const p = t.items[t.items.length - 1]; if (p && p.k === "P") out.push("P"); }
  return out.join(" ");
}

export interface MonLine { key: string; ids: number[]; t: number; text: string; frame: string; tone: "ok" | "bad" | "warn" | "scan" }
/** Collapses runs of address probes (a bus scan) into one line. */
export function monitor(f: Front, limit = 120): MonLine[] {
  const out: MonLine[] = [];
  const txns = f.txns;
  for (let i = 0; i < txns.length; i++) {
    const t = txns[i]!;
    if (t.op === "probe") {
      let j = i;
      while (j + 1 < txns.length && txns[j + 1]!.op === "probe") j++;
      const run = txns.slice(i, j + 1);
      if (run.length >= 4) {
        const found = run.filter((x) => !x.status);
        const lo = Math.min(...run.map((x) => x.addr)), hi = Math.max(...run.map((x) => x.addr));
        const uniq = new Set(run.map((x) => x.addr));
        const tail = i === 0 && f.trimmed;
        out.push({ key: `scan${t.id}`, ids: run.map((x) => x.id), t: t.t, text: tail ? `End of a bus scan (0x${hex2(lo)}–0x${hex2(hi)}; its start has left the buffer)` : uniq.size >= 4 ? `Bus scan 0x${hex2(lo)}–0x${hex2(hi)}: ${found.length ? `ACK from ${[...new Set(found.map((x) => `0x${hex2(x.addr)}${x.dev ? ` (${DEV_NAME[x.dev]})` : ""}`))].join(", ")}` : "no device answered"}, ${run.length - found.length} NACK` : `Polling 0x${hex2(lo)}: ${run.length - found.length} NACK${found.length ? ", then ACK" : ""}`, frame: `${run.length} × S addr W A/N P`, tone: uniq.size >= 4 ? "scan" : found.length ? "warn" : "bad" });
        i = j;
        continue;
      }
    }
    out.push({ key: `t${t.id}`, ids: [t.id], t: t.t, text: txnDesc(t), frame: frameText(t), tone: t.op === "busy" ? "bad" : t.status ? "bad" : "ok" });
  }
  return out.slice(-limit);
}

export function scanResult(f: Front): number[] | null {
  for (let i = f.txns.length - 1; i >= 0; i--) {
    if (f.txns[i]!.op !== "probe") continue;
    let a = i;
    while (a > 0 && f.txns[a - 1]!.op === "probe") a--;
    // A run that starts at the head of a trimmed buffer is only the tail of a scan.
    if (a === 0 && f.trimmed) return null;
    const run = f.txns.slice(a, i + 1);
    if (new Set(run.map((x) => x.addr)).size < 4) continue;
    return [...new Set(run.filter((x) => !x.status).map((x) => x.addr))];
  }
  return null;
}
