import { Block, toNum, type Val } from "../core/cinterp";
import type { CallHook, Mcu, McuOptions } from "../core/mcu";

export const DEMO = `/* Lab 35: Display Interfacing - 7-segment, 16x2 LCD, OLED and TFT on one STM32 */
#include "main.h"
#include "displays.h"

#define SEG_BUS       SEG_DIRECT    /* SEG_DIRECT: 12 GPIO | SEG_595: 3 GPIO via two 74HC595 */
#define SEG_SCAN_HZ   1000          /* digit switches per second, shared by 4 digits */
#define LCD_BUS       LCD_4BIT      /* LCD_4BIT: 6 GPIO | LCD_8BIT: 10 GPIO | LCD_I2C: PCF8574 backpack */
#define OLED_BUS      OLED_I2C      /* OLED_I2C: 400 kHz, 2 pins | OLED_SPI: 8 MHz, 5 pins */
#define OLED_ADDR     0x3C          /* 7-bit I2C address of the SSD1306 */
#define TFT_BUS       TFT_SPI       /* TFT_SPI: 20 MHz, 6 pins | TFT_8080: 8-bit parallel, 14 pins */
#define BRIGHTNESS    80            /* percent: OLED contrast, TFT backlight PWM, 7-segment duty */
#define REFRESH_HZ    30            /* target frames per second */
#define FONT_PX       12            /* OLED / TFT text height: 8, 12, 16 or 24 */

float temp;
int frame, overruns, w;
uint32_t t0, draw_ms;
char text[24];

int main(void) {
  HAL_Init();
  seg_init(SEG_BUS, SEG_SCAN_HZ);
  lcd_init(LCD_BUS);
  oled_init(OLED_BUS, OLED_ADDR);
  tft_init(TFT_BUS);
  set_brightness(BRIGHTNESS);
  oled_set_font(FONT_PX);
  tft_set_font(FONT_PX);

  lcd_set_cursor(0, 0);
  lcd_print("HELLO MCU");
  tft_fill_screen(BLACK);                      /* once: the TFT keeps its own GRAM */
  tft_draw_text(10, 10, "TFT 240x320", WHITE);

  while (1) {
    t0 = HAL_GetTick();
    temp = read_temp();

    seg_print_float(temp, 1);                  /* "24.8" with the decimal point */

    lcd_set_cursor(0, 1);
    sprintf(text, "Temp: %5.1fC", temp);      /* fixed width: no leftover characters */
    lcd_print(text);

    oled_clear();
    oled_draw_text(0, 0, "HELLO MCU");
    sprintf(text, "%5.1f C", temp);
    oled_draw_text(0, 26, text);
    oled_fill_rect(0, 54, (int)(temp * 2.5f), 8, 1);
    oled_update();                             /* send the 1 KB framebuffer to the SSD1306 */

    w = (int)(temp * 5);
    if (w < 0) w = 0;
    if (w > 250) w = 250;
    tft_fill_rect(20, 60, w, 24, BLUE);        /* redraw only the bar */
    tft_fill_rect(20 + w, 60, 250 - w, 24, NAVY);
    tft_draw_text(20, 110, text, YELLOW);

    frame++;
    draw_ms = HAL_GetTick() - t0;
    if (draw_ms < 1000 / REFRESH_HZ) HAL_Delay(1000 / REFRESH_HZ - draw_ms);
    else overruns++;
  }
}
`;

const swap = (src: string, pairs: Array<[string, string]>) => pairs.reduce((s, [a, b]) => { if (!s.includes(a)) throw new Error(`L35 variant: missing ${a}`); return s.replace(a, b); }, src);
const TITLE = "Lab 35: Display Interfacing - 7-segment, 16x2 LCD, OLED and TFT on one STM32";
export const UPDATE_LINE = "    oled_update();                             /* send the 1 KB framebuffer to the SSD1306 */\n";
export const LCD_INIT_LINE = "  lcd_init(LCD_BUS);\n";
export const FMT_OK = `sprintf(text, "Temp: %5.1fC", temp);      /* fixed width: no leftover characters */`;
export const FMT_BAD = `sprintf(text, "Temp: %.1fC", temp);`;
export const REDRAW_LINE = "    tft_fill_screen(BLACK);                    /* clear everything, every frame */\n";
const BAR_LINE = "    w = (int)(temp * 5);\n";

export const BUG_NOUPDATE = swap(DEMO, [[TITLE, "Lab 35 bug: the OLED only shows snow"], [UPDATE_LINE, ""]]);
export const BUG_ADDR = swap(DEMO, [[TITLE, "Lab 35 bug: the OLED never answers"], ["#define OLED_ADDR     0x3C", "#define OLED_ADDR     0x78"]]);
export const BUG_RESIDUE = swap(DEMO, [[TITLE, "Lab 35 bug: below 10 C the LCD shows 'Temp: 9.5CC'"], [FMT_OK, FMT_BAD]]);
export const BUG_REDRAW = swap(DEMO, [[TITLE, "Lab 35 bug: the TFT flickers and the frame rate collapses"], [BAR_LINE, `${REDRAW_LINE}${BAR_LINE}`]]);
export const BUG_LCDINIT = swap(DEMO, [[TITLE, "Lab 35 bug: the LCD shows a row of black boxes"], [LCD_INIT_LINE, ""]]);
export const BUG_SCAN = swap(DEMO, [[TITLE, "Lab 35 bug: the 7-segment display flickers"], ["#define SEG_SCAN_HZ   1000", "#define SEG_SCAN_HZ   120 "]]);
export const SPI_FAST = swap(DEMO, [[TITLE, "Lab 35: 60 frames per second - OLED on SPI, LCD on the 8-bit bus"], ["#define OLED_BUS      OLED_I2C", "#define OLED_BUS      OLED_SPI"], ["#define LCD_BUS       LCD_4BIT", "#define LCD_BUS       LCD_8BIT"], ["#define REFRESH_HZ    30", "#define REFRESH_HZ    60"]]);

export const VARIANTS = [
  { label: "C (STM32 HAL)", code: DEMO },
  { label: "60 fps (OLED on SPI)", code: SPI_FAST },
  { label: "Bug: OLED never updated", code: BUG_NOUPDATE },
  { label: "Bug: OLED 8-bit address", code: BUG_ADDR },
  { label: "Bug: LCD leftover characters", code: BUG_RESIDUE },
  { label: "Bug: TFT redrawn every frame", code: BUG_REDRAW },
  { label: "Bug: LCD not initialised", code: BUG_LCDINIT },
  { label: "Bug: 7-segment flicker", code: BUG_SCAN },
];

export type FieldKey = "segBus" | "scan" | "lcdBus" | "oledBus" | "addr" | "tftBus" | "bright" | "refresh" | "font";
const FIELDS: Record<FieldKey, RegExp> = {
  segBus: /^(#define\s+SEG_BUS\s+)(\S+)/m,
  scan: /^(#define\s+SEG_SCAN_HZ\s+)(\S+)/m,
  lcdBus: /^(#define\s+LCD_BUS\s+)(\S+)/m,
  oledBus: /^(#define\s+OLED_BUS\s+)(\S+)/m,
  addr: /^(#define\s+OLED_ADDR\s+)(\S+)/m,
  tftBus: /^(#define\s+TFT_BUS\s+)(\S+)/m,
  bright: /^(#define\s+BRIGHTNESS\s+)(\S+)/m,
  refresh: /^(#define\s+REFRESH_HZ\s+)(\S+)/m,
  font: /^(#define\s+FONT_PX\s+)(\S+)/m,
};
export const codeField = (src: string, k: FieldKey) => src.match(FIELDS[k])?.[2] ?? null;
export const setCodeField = (src: string, k: FieldKey, v: string) => src.replace(FIELDS[k], (_m, a: string) => `${a}${v}`);

export const COLORS: Record<string, number> = {
  BLACK: 0x0000, WHITE: 0xffff, RED: 0xf800, GREEN: 0x07e0, BLUE: 0x001f, YELLOW: 0xffe0, CYAN: 0x07ff, MAGENTA: 0xf81f, ORANGE: 0xfd20, GRAY: 0x8410, NAVY: 0x000f, DARKGREEN: 0x03e0,
};
export const DISPLAY_CONST: Record<string, number> = {
  SEG_DIRECT: 0, SEG_595: 1, LCD_4BIT: 0, LCD_8BIT: 1, LCD_I2C: 2, OLED_I2C: 0, OLED_SPI: 1, TFT_SPI: 0, TFT_8080: 1, ...COLORS,
};

/* ---------------- parameters ---------------- */

export type DisplayKey = "seg" | "lcd" | "oled" | "tft";
export const DISPLAY_KEYS: DisplayKey[] = ["seg", "lcd", "oled", "tft"];
export type P35 = { temp: number; sel: DisplayKey; contrast: number; oledOff: boolean; deadSeg: boolean; slowScan: boolean };
export const P35_DEFAULT: P35 = { temp: 24.8, sel: "oled", contrast: 55, oledOff: false, deadSeg: false, slowScan: false };

export interface BusInfo { label: string; short: string; pins: number; pinList: string; speed: string }
export const BUSES: Record<DisplayKey, BusInfo[]> = {
  seg: [
    { label: "Direct GPIO", short: "GPIO", pins: 12, pinList: "PA0–PA7 segments a–g, dp · PB0–PB3 digit select", speed: "port writes" },
    { label: "74HC595 shift registers", short: "74HC595", pins: 3, pinList: "PA8 SER · PA9 SRCLK · PA10 RCLK", speed: "16 bits per digit" },
  ],
  lcd: [
    { label: "4-bit parallel", short: "4-bit", pins: 6, pinList: "PC0 RS · PC1 E · PC4–PC7 D4–D7 (RW to GND)", speed: "2 nibbles per byte" },
    { label: "8-bit parallel", short: "8-bit", pins: 10, pinList: "PC0 RS · PC1 E · PC8–PC15 D0–D7 (RW to GND)", speed: "1 write per byte" },
    { label: "I²C backpack (PCF8574)", short: "I²C 0x27", pins: 2, pinList: "PB8 SCL · PB9 SDA (shared)", speed: "100 kHz, 4 bus bytes per character" },
  ],
  oled: [
    { label: "I²C, 400 kHz", short: "I²C", pins: 2, pinList: "PB8 SCL · PB9 SDA", speed: "400 kHz, 9 clocks per byte" },
    { label: "SPI, 8 MHz", short: "SPI", pins: 5, pinList: "PA5 SCK · PA7 MOSI · PA4 CS · PA3 DC · PA2 RST", speed: "8 MHz, 8 clocks per byte" },
  ],
  tft: [
    { label: "SPI, 20 MHz", short: "SPI", pins: 6, pinList: "PB13 SCK · PB15 MOSI · PB12 CS · PB14 DC · PB1 RST · PB6 BL", speed: "20 MHz, 2 bytes per pixel" },
    { label: "8080 8-bit parallel", short: "8080", pins: 14, pinList: "PD0–PD7 data · CS · DC · WR · RD · RST · BL", speed: "8 MB/s, 2 writes per pixel" },
  ],
};
export const DISPLAY: Record<DisplayKey, { name: string; part: string; color: string; ram: string }> = {
  seg: { name: "7-Segment", part: "4-digit common-cathode", color: "#ef4444", ram: "4 B digit buffer" },
  lcd: { name: "16x2 LCD", part: "HD44780 character LCD", color: "#22c55e", ram: "none (80 B DDRAM in the LCD)" },
  oled: { name: "OLED", part: "SSD1306 128×64", color: "#4ea8ff", ram: "1024 B framebuffer" },
  tft: { name: "TFT", part: "ILI9341 240×320", color: "#8b5cf6", ram: "none (150 KB GRAM in the TFT)" },
};

export const OLED_W = 128, OLED_H = 64, TFT_W = 320, TFT_H = 240;
export const OLED_I2C_HZ = 400000, LCD_I2C_HZ = 100000, OLED_SPI_HZ = 8e6, TFT_SPI_HZ = 20e6, TFT_8080_BPS = 8e6;
export const OLED_ADDR_OK = [0x3c, 0x3d];
export const isEightBit = (a: number) => OLED_ADDR_OK.some((x) => x << 1 === a) || a > 0x7f;
export const LCD_CLEAR_T = 1.52e-3, LCD_EXEC_T = 37e-6;
export const hex2 = (b: number) => (b & 0xff).toString(16).toUpperCase().padStart(2, "0");
export const rgb565 = (c: number) => { const r = (c >> 11) & 31, g = (c >> 5) & 63, b = c & 31; return [Math.round((r * 255) / 31), Math.round((g * 255) / 63), Math.round((b * 255) / 31)] as const; };
export const css565 = (c: number) => { const [r, g, b] = rgb565(c); return `rgb(${r},${g},${b})`; };

/* ---------------- 5x7 font (rows MSB = left pixel, base-32 digits) ---------------- */

const FONT_SRC = [
  "0000000", "4444404", "aaa0000", "aavavaa", "4fke5u4", "op248j3", "cik8lid", "c480000", "2488842", "8422248", "04lel40", "044v440", "0000c48", "000v000", "00000cc", "01248g0",
  "ehjlphe", "4c4444e", "eh1248v", "v2421he", "26aiv22", "vgu11he", "68guhhe", "v124888", "ehhehhe", "ehhf12c", "0cc0cc0", "0cc0c48", "248g842", "00v0v00", "8421248", "eh12404",
  "eh1dlle", "ehhhvhh", "uhhuhhu", "ehggghe", "sihhhis", "vgguggv", "vgguggg", "ehgnhhf", "hhhvhhh", "e44444e", "72222ic", "hikokih", "ggggggv", "hrllhhh", "hhpljhh", "ehhhhhe",
  "uhhuggg", "ehhhlid", "uhhukih", "fgge11u", "v444444", "hhhhhhe", "hhhhha4", "hhhllla", "hha4ahh", "hhha444", "v1248gv", "e88888e", "0g84210", "e22222e", "4ah0000", "000000v",
  "8420000", "00e1fhf", "ggmphhu", "00egghe", "11djhhf", "00ehvge", "698s888", "0fhhf1e", "ggmphhh", "40c444e", "20622ic", "ggikoki", "c44444e", "00qllhh", "00mphhh", "00ehhhe",
  "00uhugg", "00djf11", "00mpggg", "00ege1u", "88s8896", "00hhhjd", "00hhha4", "00hhlla", "00ha4ah", "00hhf1e", "00v248v", "2448442", "4444444", "8442448", "008l200",
];
const DEGREE = "ciic000";
const BLOCK = "vvvvvvv";
/** 7 rows of 5 bits for a character code (unknown characters draw a solid block). */
export function glyph(code: number): number[] {
  const src = code >= 32 && code < 127 ? FONT_SRC[code - 32]! : code === 0xb0 || code === 0xdf ? DEGREE : BLOCK;
  return Array.from(src, (ch) => parseInt(ch, 32));
}
export const cellW = (px: number) => Math.max(4, Math.round((6 * px) / 8));
/** Rasterise text at `px` pixels high (5x7 glyphs scaled by px/8, nearest neighbour). */
export function rasterText(s: string, px: number, plot: (x: number, y: number, on: boolean) => void, opaque: boolean) {
  const scale = px / 8, cw = cellW(px);
  for (let i = 0; i < s.length; i++) {
    const g = glyph(s.charCodeAt(i));
    for (let oy = 0; oy < px; oy++) {
      const gy = Math.floor(oy / scale);
      for (let ox = 0; ox < cw; ox++) {
        const gx = Math.floor(ox / scale);
        const on = gx < 5 && gy < 7 && ((g[gy]! >> (4 - gx)) & 1) === 1;
        if (on || opaque) plot(i * cw + ox, oy, on);
      }
    }
  }
}

/* ---------------- 7-segment encoding ---------------- */

export const SEG_BITS: Record<string, number> = {
  "0": 0x3f, "1": 0x06, "2": 0x5b, "3": 0x4f, "4": 0x66, "5": 0x6d, "6": 0x7d, "7": 0x07, "8": 0x7f, "9": 0x6f, "-": 0x40, " ": 0x00, E: 0x79, r: 0x50, o: 0x5c, F: 0x71, H: 0x76, L: 0x38, P: 0x73, A: 0x77, C: 0x39, "_": 0x08,
};
/** Right-aligned 4-digit pattern; the decimal point rides on the digit before it. */
export function segPattern(text: string): number[] {
  const cells: number[] = [];
  for (const ch of text) {
    if (ch === "." && cells.length) cells[cells.length - 1] = cells[cells.length - 1]! | 0x80;
    else cells.push(SEG_BITS[ch] ?? 0x00);
  }
  if (cells.length > 4) return [0x40, 0x5c, 0x71, 0x40];
  while (cells.length < 4) cells.unshift(0);
  return cells;
}

/* ---------------- state ---------------- */

export type Tone = "ok" | "bad" | "warn" | "info";
export interface LogLine { id: number; t: number; d: DisplayKey | "sys"; tone: Tone; title: string; text: string }
export interface Op { t: number; d: DisplayKey | "cpu"; dur: number; bytes: number; what: string }
export interface Rect { t: number; x: number; y: number; w: number; h: number; bytes: number; color: number }

interface Seg { init: boolean; bus: number; scanHz: number; digits: number[]; text: string; duty: number; lastLit: number[]; isrLoad: number }
interface Lcd { init: boolean; bus: number; ddram: number[][]; col: number; row: number; lastLen: number[]; residue: boolean; writes: number; hidden: number; preInit: number }
interface Oled { init: boolean; bus: number; addr: number; fb: Uint8Array; gddram: Uint8Array; font: number; contrast: number; nacks: number; lastNack: number; updates: number; lastUpdate: number; lastDraw: number; ver: number; clipped: boolean; fonts: number[] }
interface Tft { init: boolean; bus: number; gram: Uint16Array; font: number; backlight: number; ver: number; rects: Rect[]; fills: number; lastFill: number }

export interface Front {
  p: P35;
  started: boolean;
  plugOled: boolean;
  seg: Seg; lcd: Lcd; oled: Oled; tft: Tft;
  ops: Op[];
  marks: number[];
  log: LogLine[];
  nextId: number;
  noise: number;
  busesSeen: Record<DisplayKey, number[]>;
}

const hash = (n: number) => { let x = (n * 2654435761) >>> 0; x ^= x >>> 15; x = Math.imul(x, 2246822519) >>> 0; x ^= x >>> 13; return x >>> 0; };

function snowOled() { const a = new Uint8Array(1024); for (let i = 0; i < a.length; i++) a[i] = hash(i + 11) & 0xff; return a; }
function snowTft() {
  const a = new Uint16Array(TFT_W * TFT_H);
  for (let y = 0; y < TFT_H; y++) for (let x = 0; x < TFT_W; x++) { const h = hash((y >> 1) * 977 + (x >> 2)); a[y * TFT_W + x] = (h & 1) ? 0xffff : (h >> 3) & 0xffff; }
  return a;
}

const FRONT = new WeakMap<Mcu, Front>();
export function front(m: Mcu): Front {
  let f = FRONT.get(m);
  if (!f) {
    f = {
      p: P35_DEFAULT, started: false, plugOled: true,
      seg: { init: false, bus: 0, scanHz: 1000, digits: [0, 0, 0, 0], text: "", duty: 1, lastLit: [-1, -1, -1, -1], isrLoad: 0 },
      lcd: { init: false, bus: 0, ddram: [Array(16).fill(0x20), Array(16).fill(0x20)], col: 0, row: 0, lastLen: [0, 0], residue: false, writes: 0, hidden: 0, preInit: 0 },
      oled: { init: false, bus: 0, addr: 0x3c, fb: new Uint8Array(1024), gddram: snowOled(), font: 8, contrast: 0xcf, nacks: 0, lastNack: -1, updates: 0, lastUpdate: -1, lastDraw: -1, ver: 0, clipped: false, fonts: [] },
      tft: { init: false, bus: 0, gram: snowTft(), font: 8, backlight: 100, ver: 0, rects: [], fills: 0, lastFill: -1 },
      ops: [], marks: [], log: [], nextId: 1, noise: 0,
      busesSeen: { seg: [], lcd: [], oled: [], tft: [] },
    };
    FRONT.set(m, f);
  }
  return f;
}

function log(f: Front, t: number, d: LogLine["d"], tone: Tone, title: string, text: string) {
  f.log.push({ id: f.nextId++, t, d, tone, title, text });
  if (f.log.length > 200) f.log.splice(0, f.log.length - 200);
}
function op(f: Front, t: number, d: Op["d"], dur: number, bytes: number, what: string) {
  f.ops.push({ t, d, dur, bytes, what });
  if (f.ops.length > 600) f.ops.splice(0, f.ops.length - 600);
}
const seen = (f: Front, d: DisplayKey, bus: number) => { if (!f.busesSeen[d].includes(bus)) f.busesSeen[d].push(bus); };
const wait = (dur: number, label: string, done?: () => Val) => new Block(() => false, Math.max(0, dur), () => (done ? done() : 0), label);

function cstr(v: Val | undefined): string {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && v.kind === "arr") {
    const d = v.slot.data ?? [];
    let s = "";
    for (let k = v.off; k < d.length && s.length < 64; k++) { const c = d[k]; if (typeof c !== "number" || c === 0) break; s += String.fromCharCode(c); }
    return s;
  }
  return typeof v === "number" ? String(v) : "";
}

/* ---------------- 7-segment ---------------- */

export const segIsrCost = (bus: number) => (bus === 1 ? 8e-6 : 1.5e-6);
export const segDigitHz = (scanHz: number) => scanHz / 4;

/* ---------------- HD44780 ---------------- */

export function lcdByteT(bus: number) { return bus === 2 ? (5 * 9) / LCD_I2C_HZ : bus === 1 ? LCD_EXEC_T + 3e-6 : LCD_EXEC_T + 6e-6; }
function lcdWrite(f: Front, t: number, s: string) {
  const l = f.lcd;
  if (!l.init) { l.preInit++; return; }
  const row = l.row;
  const start = l.col;
  for (const ch of s) {
    const code = ch.charCodeAt(0);
    if (l.col < 16) l.ddram[row]![l.col] = code === 0xb0 ? 0xdf : code;
    else l.hidden++;
    l.col++;
  }
  l.writes++;
  const end = Math.min(16, l.col);
  const prev = l.lastLen[row]!;
  if (start === 0) {
    const leftover = end < prev && l.ddram[row]!.slice(end, prev).some((c) => c !== 0x20);
    if (leftover && !l.residue) log(f, t, "lcd", "warn", "LCD leftover", `Row ${row} now holds ${end} characters but the previous text was ${prev} long: columns ${end}–${prev - 1} still show the old characters.`);
    l.residue = leftover;
    l.lastLen[row] = leftover ? prev : end;
  } else l.lastLen[row] = Math.max(prev, end);
}

/* ---------------- SSD1306 ---------------- */

export const oledPixel = (buf: Uint8Array, x: number, y: number) => ((buf[(y >> 3) * OLED_W + x]! >> (y & 7)) & 1) === 1;
function oledSet(o: Oled, x: number, y: number, on: boolean) {
  if (x < 0 || y < 0 || x >= OLED_W || y >= OLED_H) { if (on) o.clipped = true; return; }
  const i = (y >> 3) * OLED_W + x, bit = 1 << (y & 7);
  o.fb[i] = on ? o.fb[i]! | bit : o.fb[i]! & ~bit;
}
export function oledUpdateT(bus: number) { return bus === 1 ? ((6 + 1024) * 8) / OLED_SPI_HZ : ((2 + 6 + 2 + 1024) * 9) / OLED_I2C_HZ; }
/** Transaction to the OLED: returns the bus time and whether it was acknowledged. */
function oledBus(f: Front, t: number, bytes: number, what: string): { dur: number; ok: boolean } {
  const o = f.oled, p = f.p;
  if (o.bus === 1) return { dur: (bytes * 8) / OLED_SPI_HZ + 2e-6, ok: !p.oledOff };
  const ok = !p.oledOff && OLED_ADDR_OK.includes(o.addr);
  if (!ok) {
    o.nacks++;
    if (t - o.lastNack > 1) log(f, t, "oled", "bad", `I²C NACK 0x${hex2(o.addr)}`, p.oledOff ? "The OLED is unplugged: nobody acknowledges the address byte." : isEightBit(o.addr) ? `0x${hex2(o.addr)} is the SSD1306's 8-bit address (0x3C << 1). HAL expects the 7-bit address 0x3C.` : `No SSD1306 at 0x${hex2(o.addr)}: the module answers at 0x3C (or 0x3D with the address jumper moved).`);
    o.lastNack = t;
    return { dur: (2 * 9) / OLED_I2C_HZ, ok: false };
  }
  void what;
  return { dur: ((bytes + 1) * 9) / OLED_I2C_HZ, ok: true };
}

/* ---------------- ILI9341 ---------------- */

export function tftByteT(bus: number) { return bus === 1 ? 1 / TFT_8080_BPS : 8 / TFT_SPI_HZ; }
function tftRect(f: Front, t: number, x: number, y: number, w: number, h: number, color: number, what: string) {
  const g = f.tft;
  const x0 = Math.max(0, Math.round(x)), y0 = Math.max(0, Math.round(y));
  const x1 = Math.min(TFT_W, Math.round(x + w)), y1 = Math.min(TFT_H, Math.round(y + h));
  const cw = Math.max(0, x1 - x0), ch = Math.max(0, y1 - y0);
  const bytes = 11 + cw * ch * 2;
  const dur = bytes * tftByteT(g.bus) + 3e-6;
  if (!g.init) return { dur: 1e-6, bytes: 0 };
  for (let yy = y0; yy < y1; yy++) g.gram.fill(color & 0xffff, yy * TFT_W + x0, yy * TFT_W + x1);
  g.ver++;
  g.rects.push({ t, x: x0, y: y0, w: cw, h: ch, bytes, color });
  if (g.rects.length > 60) g.rects.splice(0, g.rects.length - 60);
  op(f, t, "tft", dur, bytes, what);
  return { dur, bytes };
}

/* ---------------- HAL binding ---------------- */

const hook: CallHook = (name, args, m) => {
  const f = front(m);
  const t = m.now, p = f.p;
  const n = (i: number) => toNum(args[i] ?? 0);
  switch (name) {
    case "read_temp": {
      f.marks.push(t); if (f.marks.length > 120) f.marks.splice(0, f.marks.length - 120);
      const v = Math.round((p.temp + (((hash(++f.noise) % 1001) / 1000 - 0.5) * 0.08)) * 100) / 100;
      op(f, t, "cpu", 20e-6, 0, "read_temp (ADC)");
      return wait(20e-6, "adc", () => v);
    }
    /* ---- 7-segment ---- */
    case "seg_init": {
      const s = f.seg;
      s.init = true; s.bus = n(0) === 1 ? 1 : 0; s.scanHz = Math.max(4, n(1) || 1000);
      seen(f, "seg", s.bus);
      s.isrLoad = s.scanHz * segIsrCost(s.bus);
      log(f, t, "seg", "info", "7-segment ready", `${BUSES.seg[s.bus]!.label}: ${BUSES.seg[s.bus]!.pins} pins. A timer interrupt switches digits ${s.scanHz} times per second, so each digit is refreshed at ${segDigitHz(s.scanHz).toFixed(0)} Hz (CPU load ${(s.isrLoad * 100).toFixed(2)} %).`);
      return wait(20e-6, "seg");
    }
    case "seg_print_float": case "seg_print_int": case "seg_print": {
      const s = f.seg;
      const txt = name === "seg_print_float" ? n(0).toFixed(Math.max(0, Math.min(3, n(1)))) : name === "seg_print_int" ? String(Math.trunc(n(0))) : cstr(args[0]);
      if (s.init) { s.text = txt; s.digits = segPattern(txt); }
      op(f, t, "seg", 4e-6, 4, "digit buffer");
      return wait(4e-6, "seg");
    }
    case "seg_clear": { f.seg.digits = [0, 0, 0, 0]; f.seg.text = ""; return wait(2e-6, "seg"); }
    /* ---- HD44780 ---- */
    case "lcd_init": {
      const l = f.lcd;
      l.bus = n(0) === 2 ? 2 : n(0) === 1 ? 1 : 0;
      seen(f, "lcd", l.bus);
      const dur = 0.045 + 4.1e-3 + 100e-6 + 6 * lcdByteT(l.bus) + LCD_CLEAR_T;
      log(f, t, "lcd", "info", "LCD init", `${BUSES.lcd[l.bus]!.label}: wait 45 ms after power-up, three 0x3 nibbles, 4-bit or 8-bit mode, 2 lines, display on, clear (${(dur * 1e3).toFixed(1)} ms total).`);
      op(f, t, "lcd", dur, 10, "lcd_init");
      return wait(dur, "lcd", () => { l.init = true; l.ddram = [Array(16).fill(0x20), Array(16).fill(0x20)]; l.col = 0; l.row = 0; l.lastLen = [0, 0]; l.residue = false; return 0; });
    }
    case "lcd_clear": {
      const l = f.lcd;
      const dur = lcdByteT(l.bus) + LCD_CLEAR_T;
      if (l.init) { l.ddram = [Array(16).fill(0x20), Array(16).fill(0x20)]; l.col = 0; l.row = 0; l.lastLen = [0, 0]; l.residue = false; }
      op(f, t, "lcd", dur, 1, "lcd_clear (1.52 ms)");
      return wait(dur, "lcd");
    }
    case "lcd_set_cursor": case "lcd_setCursor": case "lcd_gotoxy": {
      const l = f.lcd;
      if (l.init) { l.col = Math.max(0, Math.min(39, n(0))); l.row = n(1) ? 1 : 0; }
      const dur = lcdByteT(l.bus);
      op(f, t, "lcd", dur, 1, `set DDRAM 0x${hex2((n(1) ? 0x40 : 0) + n(0))}`);
      return wait(dur, "lcd");
    }
    case "lcd_print": case "lcd_puts": case "lcd_putc": case "lcd_write_char": {
      const s = name === "lcd_putc" || name === "lcd_write_char" ? String.fromCharCode(n(0) & 0xff) : cstr(args[0]);
      const dur = s.length * lcdByteT(f.lcd.bus);
      lcdWrite(f, t, s);
      if (!f.lcd.init && f.lcd.preInit === 1) log(f, t, "lcd", "bad", "LCD not initialised", "lcd_print() before lcd_init(): the HD44780 is still in its power-on state (8-bit, 1 line) and ignores the 4-bit data.");
      op(f, t, "lcd", dur, s.length, `"${s}"`);
      return wait(dur, "lcd");
    }
    /* ---- SSD1306 ---- */
    case "oled_init": {
      const o = f.oled;
      o.bus = n(0) === 1 ? 1 : 0; o.addr = n(1) || 0x3c;
      seen(f, "oled", o.bus);
      const b = oledBus(f, t, 26, "init");
      const dur = 0.1 + b.dur;
      op(f, t, "oled", dur, 26, "oled_init");
      if (b.ok) log(f, t, "oled", "info", "OLED init", `${BUSES.oled[o.bus]!.label}${o.bus === 0 ? ` at 0x${hex2(o.addr)}` : ""}: 100 ms power-up delay, 26 command bytes, display on. The panel RAM still holds random data until the first update.`);
      return wait(dur, "oled", () => { o.init = b.ok; if (b.ok) o.ver++; return 0; });
    }
    case "oled_set_font": { const px = Math.max(6, Math.min(32, n(0) || 8)); f.oled.font = px; if (!f.oled.fonts.includes(px)) f.oled.fonts.push(px); return wait(1e-6, "oled"); }
    case "oled_clear": { f.oled.fb.fill(0); f.oled.clipped = false; op(f, t, "cpu", 15e-6, 0, "oled_clear (RAM)"); return wait(15e-6, "oled"); }
    case "oled_draw_text": case "oled_print": {
      const o = f.oled, s = cstr(args[2]), x0 = n(0), y0 = n(1), px = o.font;
      rasterText(s, px, (x, y, on) => oledSet(o, x0 + x, y0 + y, on), false);
      o.lastDraw = t;
      const dur = s.length * 10e-6 * (px / 8) ** 2;
      op(f, t, "cpu", dur, 0, `oled text "${s}" (RAM)`);
      return wait(dur, "oled");
    }
    case "oled_draw_pixel": { oledSet(f.oled, n(0), n(1), n(2) !== 0); f.oled.lastDraw = t; return wait(0.5e-6, "oled"); }
    case "oled_fill_rect": case "oled_draw_rect": {
      const o = f.oled, x0 = Math.round(n(0)), y0 = Math.round(n(1)), w = Math.round(n(2)), h = Math.round(n(3)), on = n(4) !== 0;
      for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
        const edge = y === y0 || y === y0 + h - 1 || x === x0 || x === x0 + w - 1;
        if (name === "oled_fill_rect" || edge) oledSet(o, x, y, on);
      }
      o.lastDraw = t;
      const dur = 2e-6 + Math.max(0, w * h) * 0.02e-6;
      op(f, t, "cpu", dur, 0, "oled rect (RAM)");
      return wait(dur, "oled");
    }
    case "oled_set_contrast": {
      const o = f.oled, b = oledBus(f, t, 3, "contrast");
      if (b.ok) o.contrast = n(0) & 0xff;
      op(f, t, "oled", b.dur, 3, "contrast 0x81");
      return wait(b.dur, "oled");
    }
    case "oled_update": case "oled_display": {
      const o = f.oled;
      if (!o.init) { op(f, t, "oled", 1e-6, 0, "update (not initialised)"); return wait(1e-6, "oled"); }
      const b = oledBus(f, t, 1032, "update");
      const dur = o.bus === 1 ? oledUpdateT(1) : b.ok ? oledUpdateT(0) : b.dur;
      op(f, t, "oled", dur, b.ok ? 1032 : 1, b.ok ? "framebuffer → GDDRAM" : "NACK");
      return wait(dur, "oled", () => { if (b.ok) { o.gddram.set(o.fb); o.updates++; o.lastUpdate = m.now; o.ver++; } return 0; });
    }
    /* ---- ILI9341 ---- */
    case "tft_init": {
      const g = f.tft;
      g.bus = n(0) === 1 ? 1 : 0;
      seen(f, "tft", g.bus);
      const dur = 0.12 + 0.005 + 60 * tftByteT(g.bus);
      log(f, t, "tft", "info", "TFT init", `${BUSES.tft[g.bus]!.label}: hardware reset, 120 ms sleep-out, landscape rotation, display on. GRAM keeps whatever it held at power-up until you draw over it.`);
      op(f, t, "tft", dur, 60, "tft_init");
      return wait(dur, "tft", () => { g.init = true; g.ver++; return 0; });
    }
    case "tft_set_font": { f.tft.font = Math.max(6, Math.min(32, n(0) || 8)); return wait(1e-6, "tft"); }
    case "tft_set_backlight": { f.tft.backlight = Math.max(0, Math.min(100, n(0))); return wait(1e-6, "tft"); }
    case "tft_fill_screen": {
      const g = f.tft;
      const r = tftRect(f, t, 0, 0, TFT_W, TFT_H, n(0), "fill screen");
      if (g.init) {
        g.fills++;
        if (g.fills > 1 && t - g.lastFill < 1) log(f, t, "tft", "warn", "Full-screen redraw", `${((TFT_W * TFT_H * 2) / 1024).toFixed(0)} KB pushed again ${((t - g.lastFill) * 1e3).toFixed(0)} ms after the last clear (${(r.dur * 1e3).toFixed(1)} ms on the bus). The screen goes black before the content is drawn back: flicker.`);
        g.lastFill = t;
      }
      return wait(r.dur, "tft");
    }
    case "tft_fill_rect": { const r = tftRect(f, t, n(0), n(1), n(2), n(3), n(4), "fill rect"); return wait(r.dur, "tft"); }
    case "tft_draw_pixel": { const r = tftRect(f, t, n(0), n(1), 1, 1, n(2), "pixel"); return wait(r.dur, "tft"); }
    case "tft_draw_text": case "tft_print": {
      const g = f.tft, s = cstr(args[2]), x0 = Math.round(n(0)), y0 = Math.round(n(1)), color = n(3) & 0xffff, px = g.font, cw = cellW(px);
      if (!g.init) return wait(1e-6, "tft");
      rasterText(s, px, (x, y, on) => { const xx = x0 + x, yy = y0 + y; if (xx >= 0 && yy >= 0 && xx < TFT_W && yy < TFT_H) g.gram[yy * TFT_W + xx] = on ? color : 0x0000; }, true);
      g.ver++;
      const bytes = s.length * (11 + cw * px * 2);
      const dur = bytes * tftByteT(g.bus) + s.length * 3e-6;
      g.rects.push({ t, x: x0, y: y0, w: s.length * cw, h: px, bytes, color });
      if (g.rects.length > 60) g.rects.splice(0, g.rects.length - 60);
      op(f, t, "tft", dur, bytes, `text "${s}"`);
      return wait(dur, "tft");
    }
    /* ---- shared ---- */
    case "set_brightness": {
      const pct = Math.max(0, Math.min(100, n(0)));
      f.seg.duty = pct / 100;
      f.tft.backlight = pct;
      const o = f.oled;
      const b = o.init ? oledBus(f, t, 3, "contrast") : { dur: 0, ok: false };
      if (b.ok) o.contrast = Math.round((pct * 255) / 100);
      op(f, t, "oled", b.dur, 3, "contrast");
      return wait(b.dur + 2e-6, "bright");
    }
  }
  return undefined;
};

export function mcu35(): McuOptions {
  return { family: "stm32", constants: DISPLAY_CONST, onCall: hook };
}

/* ---------------- world ---------------- */

export function world35(m: Mcu, dt: number, p: P35) {
  const f = front(m);
  f.p = p;
  const t = m.now;
  if (!f.started) { f.started = true; f.plugOled = !p.oledOff; }
  if (f.plugOled === p.oledOff) {
    f.plugOled = !p.oledOff;
    log(f, t, "oled", p.oledOff ? "warn" : "info", p.oledOff ? "OLED unplugged" : "OLED plugged in", p.oledOff ? "The SSD1306 module was pulled off the header." : "The SSD1306 is back, but it lost power: it needs oled_init() again (restart the firmware).");
    if (p.oledOff) { f.oled.init = false; f.oled.gddram = snowOled(); f.oled.ver++; }
  }
  const s = f.seg;
  if (s.init) {
    if (s.scanHz * dt >= 4) s.lastLit = [t, t, t, t];
    else {
      const a = Math.floor((t - dt) * s.scanHz), b = Math.floor(t * s.scanHz);
      for (let k = a; k <= b; k++) s.lastLit[((k % 4) + 4) % 4] = Math.min(t, (k + 1) / s.scanHz);
    }
  }
}

/* ---------------- analysis helpers (UI + tests) ---------------- */

export interface Usage { time: number; bytes: number }
export interface FrameStats { period: number; fps: number; draw: number; byDisp: Record<DisplayKey | "cpu", Usage>; start: number; end: number }

/** Time and bytes per display in the last complete main-loop iteration (between two read_temp() calls). */
export function frameStats(f: Front): FrameStats | null {
  const k = f.marks.length;
  if (k < 2) return null;
  const start = f.marks[k - 2]!, end = f.marks[k - 1]!;
  const byDisp: FrameStats["byDisp"] = { seg: { time: 0, bytes: 0 }, lcd: { time: 0, bytes: 0 }, oled: { time: 0, bytes: 0 }, tft: { time: 0, bytes: 0 }, cpu: { time: 0, bytes: 0 } };
  for (const o of f.ops) if (o.t >= start - 1e-9 && o.t < end - 1e-9) { byDisp[o.d].time += o.dur; byDisp[o.d].bytes += o.bytes; }
  const draw = Object.values(byDisp).reduce((s, u) => s + u.time, 0);
  const period = end - start;
  const recent = f.marks.filter((x) => x > end - 1);
  const fps = recent.length >= 3 ? (recent.length - 1) / (recent[recent.length - 1]! - recent[0]!) : 1 / period;
  return { period, fps, draw, byDisp, start, end };
}

/** Perceived brightness of each multiplexed digit (LED + eye persistence, tau = 12 ms). */
export function segGlow(s: Front["seg"], now: number) {
  return s.lastLit.map((tl) => (tl < 0 ? 0 : Math.exp(-Math.max(0, now - tl) / 0.012)));
}

export const gpioTotal = (f: Front) => {
  const used: DisplayKey[] = DISPLAY_KEYS.filter((d) => (d === "seg" ? f.seg.init : d === "lcd" ? f.lcd.init || f.lcd.preInit > 0 : d === "oled" ? f.oled.init || f.oled.nacks > 0 : f.tft.init));
  const shareI2c = f.lcd.bus === 2 && f.oled.bus === 0 && used.includes("lcd") && used.includes("oled");
  return used.reduce((s, d) => s + BUSES[d][d === "seg" ? f.seg.bus : d === "lcd" ? f.lcd.bus : d === "oled" ? f.oled.bus : f.tft.bus]!.pins, 0) - (shareI2c ? 2 : 0);
};

export function clearLog(m: Mcu) { front(m).log = []; }
