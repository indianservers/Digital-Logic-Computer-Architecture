import { toNum, type ArrVal, type RefVal, type Slot, type Val } from "../core/cinterp";
import { readBytes, writeBytes, type CallHook, type Mcu, type McuOptions } from "../core/mcu";

export const DEMO = `/* Lab 33: USB Fundamentals - the STM32 OTG_FS port enumerates as a CDC virtual COM port and echoes what the PC sends */
#include "main.h"
#include "usb_device.h"
#include "usbd_cdc_if.h"

/* Device descriptor values (usbd_desc.c) */
#define USBD_VID            0x0483
#define USBD_PID_FS         0x5740
#define USBD_MAX_EP0_SIZE   64
#define USBD_MAX_POWER_MA   100
#define USBD_PRODUCT_STRING "STM32 Virtual ComPort"

extern USBD_DescriptorsTypeDef FS_Desc;
extern USBD_ClassTypeDef USBD_CDC;
extern USBD_CDC_ItfTypeDef USBD_Interface_fops_FS;

USBD_HandleTypeDef hUsbDeviceFS;
uint8_t UserRxBufferFS[64];
uint8_t UserTxBufferFS[64];
char msg[32];
uint32_t baud = 0;
uint8_t dtr = 0;
uint32_t rxBytes = 0;
uint32_t ticks = 0;
uint32_t busy = 0;

void SystemClock_Config(void) {
  RCC_OscInitTypeDef RCC_OscInitStruct = {0};
  RCC_OscInitStruct.OscillatorType = RCC_OSCILLATORTYPE_HSE;
  RCC_OscInitStruct.HSEState = RCC_HSE_ON;
  RCC_OscInitStruct.PLL.PLLState = RCC_PLL_ON;
  RCC_OscInitStruct.PLL.PLLSource = RCC_PLLSOURCE_HSE;
  RCC_OscInitStruct.PLL.PLLM = 8;
  RCC_OscInitStruct.PLL.PLLN = 336;
  RCC_OscInitStruct.PLL.PLLP = RCC_PLLP_DIV4;
  RCC_OscInitStruct.PLL.PLLQ = 7;             /* 8 MHz / 8 x 336 / 7 = 48 MHz USB clock */
  HAL_RCC_OscConfig(&RCC_OscInitStruct);
}

/* Class requests from the host (usbd_cdc_if.c) */
int8_t CDC_Control_FS(uint8_t cmd, uint8_t *pbuf, uint16_t length) {
  if (cmd == CDC_SET_LINE_CODING) {
    baud = pbuf[0] | (pbuf[1] << 8) | (pbuf[2] << 16) | (pbuf[3] << 24);
  }
  if (cmd == CDC_SET_CONTROL_LINE_STATE) {
    dtr = pbuf[2] & 0x01;                     /* wValue bit 0 = DTR: a terminal opened the port */
  }
  return USBD_OK;
}

/* Bulk OUT data from the host (usbd_cdc_if.c) */
int8_t CDC_Receive_FS(uint8_t *Buf, uint32_t *Len) {
  uint32_t n = *Len;
  for (uint32_t i = 0; i < n; i++) {
    uint8_t c = Buf[i];
    if (c >= 'a' && c <= 'z') c = c - 32;
    UserTxBufferFS[i] = c;
  }
  rxBytes += n;
  CDC_Transmit_FS(UserTxBufferFS, n);         /* echo it back in upper case */
  USBD_CDC_SetRxBuffer(&hUsbDeviceFS, Buf);
  USBD_CDC_ReceivePacket(&hUsbDeviceFS);      /* re-arm EP1 OUT for the next packet */
  return USBD_OK;
}

int main(void) {
  HAL_Init();
  SystemClock_Config();
  USBD_Init(&hUsbDeviceFS, &FS_Desc, DEVICE_FS);
  USBD_RegisterClass(&hUsbDeviceFS, &USBD_CDC);
  USBD_CDC_RegisterInterface(&hUsbDeviceFS, &USBD_Interface_fops_FS);
  USBD_CDC_SetRxBuffer(&hUsbDeviceFS, UserRxBufferFS);
  USBD_Start(&hUsbDeviceFS);                  /* connect the D+ pull-up: the host sees a full-speed device */

  while (1) {
    if (hUsbDeviceFS.dev_state == USBD_STATE_CONFIGURED && dtr) {
      ticks++;
      sprintf(msg, "tick %lu\\r\\n", ticks);
      if (CDC_Transmit_FS((uint8_t*)msg, strlen(msg)) == USBD_BUSY) busy++;
    }
    HAL_Delay(1000);
  }
}
`;

const swap = (src: string, pairs: Array<[string, string]>) => pairs.reduce((s, [a, b]) => { if (!s.includes(a)) throw new Error(`L33 variant: missing ${a}`); return s.replace(a, b); }, src);
const TITLE = "Lab 33: USB Fundamentals - the STM32 OTG_FS port enumerates as a CDC virtual COM port and echoes what the PC sends";

export const EP0_8 = swap(DEMO, [[TITLE, "Lab 33: 8-byte control endpoint - every descriptor now needs several DATA packets"], ["#define USBD_MAX_EP0_SIZE   64", "#define USBD_MAX_EP0_SIZE   8"]]);
export const BUG_NOSTART = swap(DEMO, [[TITLE, "Lab 33 bug: the PC never notices the board"], ["  USBD_Start(&hUsbDeviceFS);                  /* connect the D+ pull-up: the host sees a full-speed device */", "  // USBD_Start(&hUsbDeviceFS);"]]);
export const BUG_CLOCK = swap(DEMO, [[TITLE, "Lab 33 bug: the PC reports \"Device Descriptor Request Failed\""], ["RCC_OscInitStruct.PLL.PLLQ = 7;             /* 8 MHz / 8 x 336 / 7 = 48 MHz USB clock */", "RCC_OscInitStruct.PLL.PLLQ = 8;"]]);
export const BUG_EP0 = swap(DEMO, [[TITLE, "Lab 33 bug: enumeration stops after the first descriptor"], ["#define USBD_MAX_EP0_SIZE   64", "#define USBD_MAX_EP0_SIZE   12"]]);
export const BUG_POWER = swap(DEMO, [[TITLE, "Lab 33 bug: the device gets an address but is never configured"], ["#define USBD_MAX_POWER_MA   100", "#define USBD_MAX_POWER_MA   600"]]);
export const BUG_REARM = swap(DEMO, [[TITLE, "Lab 33 bug: only the first message is echoed"], ["  USBD_CDC_ReceivePacket(&hUsbDeviceFS);      /* re-arm EP1 OUT for the next packet */\n", ""]]);
export const BUG_NOCLASS = swap(DEMO, [[TITLE, "Lab 33 bug: the configuration descriptor request fails"], ["  USBD_RegisterClass(&hUsbDeviceFS, &USBD_CDC);\n", ""]]);

export const VARIANTS = [
  { label: "C (STM32 USB Device)", code: DEMO },
  { label: "8-byte EP0", code: EP0_8 },
  { label: "Bug: no USBD_Start", code: BUG_NOSTART },
  { label: "Bug: wrong USB clock", code: BUG_CLOCK },
  { label: "Bug: invalid EP0 size", code: BUG_EP0 },
  { label: "Bug: 600 mA request", code: BUG_POWER },
  { label: "Bug: OUT not re-armed", code: BUG_REARM },
  { label: "Bug: no class registered", code: BUG_NOCLASS },
];

export const USB_CONST: Record<string, number> = {
  USBD_OK: 0, USBD_BUSY: 1, USBD_EMEM: 2, USBD_FAIL: 3, DEVICE_FS: 0, DEVICE_HS: 1,
  USBD_STATE_DEFAULT: 1, USBD_STATE_ADDRESSED: 2, USBD_STATE_CONFIGURED: 3, USBD_STATE_SUSPENDED: 4,
  CDC_SEND_ENCAPSULATED_COMMAND: 0, CDC_GET_ENCAPSULATED_RESPONSE: 1, CDC_SET_LINE_CODING: 0x20, CDC_GET_LINE_CODING: 0x21, CDC_SET_CONTROL_LINE_STATE: 0x22, CDC_SEND_BREAK: 0x23,
  RCC_OSCILLATORTYPE_HSE: 1, RCC_OSCILLATORTYPE_HSI: 2, RCC_HSE_ON: 1, RCC_HSE_OFF: 0, RCC_HSI_ON: 1, RCC_PLL_NONE: 0, RCC_PLL_OFF: 1, RCC_PLL_ON: 2,
  RCC_PLLSOURCE_HSI: 0, RCC_PLLSOURCE_HSE: 0x400000, RCC_PLLP_DIV2: 2, RCC_PLLP_DIV4: 4, RCC_PLLP_DIV6: 6, RCC_PLLP_DIV8: 8,
};

/* ---------------- code fields ---------------- */

export type FieldKey = "vid" | "pid" | "ep0" | "power" | "pllq";
const FIELDS: Record<FieldKey, RegExp> = {
  vid: /(#define\s+USBD_VID\s+)(0x[0-9A-Fa-f]+|\d+)/,
  pid: /(#define\s+USBD_PID_FS\s+)(0x[0-9A-Fa-f]+|\d+)/,
  ep0: /(#define\s+USBD_MAX_EP0_SIZE\s+)(\d+)/,
  power: /(#define\s+USBD_MAX_POWER_MA\s+)(\d+)/,
  pllq: /(RCC_OscInitStruct\.PLL\.PLLQ\s*=\s*)(\d+)/,
};
export const codeField = (src: string, k: FieldKey) => src.match(FIELDS[k])?.[2] ?? null;
export const setCodeField = (src: string, k: FieldKey, v: string) => src.replace(FIELDS[k], (_m, a: string) => `${a}${v}`);

export const hex2 = (b: number) => (b & 0xff).toString(16).toUpperCase().padStart(2, "0");
export const hex4 = (v: number) => (v & 0xffff).toString(16).toUpperCase().padStart(4, "0");
export const fmtT = (s: number) => (s >= 1e-3 ? `${+(s * 1e3).toFixed(2)} ms` : s >= 1e-6 ? `${+(s * 1e6).toFixed(2)} µs` : `${Math.round(s * 1e9)} ns`);

/* ---------------- params ---------------- */

export type Trig = "ctrl" | "bulk" | "err" | "any";
export type View = "auto" | "start" | "whole";
export type P33 = { cable: boolean; port: boolean; baud: number; trig: Trig; view: View };
export const P33_DEFAULT: P33 = { cable: true, port: true, baud: 115200, trig: "ctrl", view: "auto" };
export const BAUDS = [9600, 19200, 57600, 115200, 921600];
export const FS_BIT = 1 / 12e6;
export const USB_OK_TOL = 0.0025;

/* ---------------- packets ---------------- */

export type Pid = "OUT" | "IN" | "SOF" | "SETUP" | "DATA0" | "DATA1" | "ACK" | "NAK" | "STALL";
const PID_CODE: Record<Pid, number> = { OUT: 0x1, IN: 0x9, SOF: 0x5, SETUP: 0xd, DATA0: 0x3, DATA1: 0xb, ACK: 0x2, NAK: 0xa, STALL: 0xe };
export const pidByte = (p: Pid) => PID_CODE[p] | ((~PID_CODE[p] & 0xf) << 4);
export interface Packet { pid: Pid; from: "host" | "dev"; addr?: number; ep?: number; data?: number[]; bad?: "crc" | "clock" | "lost"; skew?: number }
export type StageName = "SETUP" | "DATA" | "STATUS" | "OUT" | "IN";
export interface Stage { name: StageName; packets: Packet[] }

export function crc5(bits: number[]): number {
  let c = 0x1f;
  for (const b of bits) { const x = (b ^ c) & 1; c >>= 1; if (x) c ^= 0x14; }
  return ~c & 0x1f;
}
export function crc16(bytes: number[]): number {
  let c = 0xffff;
  for (const x of bytes) { c ^= x & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xa001 : c >>> 1; }
  return ~c & 0xffff;
}

export type Line = "J" | "K" | "0";
export interface PSeg { f: "SYNC" | "PID" | "ADDR" | "ENDP" | "CRC5" | "DATA" | "CRC16" | "EOP"; a: number; b: number; label: string }
export interface PEnc { bits: number[]; line: Line[]; segs: PSeg[]; stuff: number[] }

const lsb = (v: number, n: number) => Array.from({ length: n }, (_, i) => (v >> i) & 1);
export function encodePacket(p: Packet): PEnc {
  const raw: Array<{ bits: number[]; f: PSeg["f"]; label: string }> = [{ bits: [0, 0, 0, 0, 0, 0, 0, 1], f: "SYNC", label: "SYNC" }, { bits: lsb(pidByte(p.pid), 8), f: "PID", label: p.pid }];
  if (p.pid === "OUT" || p.pid === "IN" || p.pid === "SETUP") {
    const a = lsb(p.addr ?? 0, 7), e = lsb(p.ep ?? 0, 4);
    const c = crc5([...a, ...e]);
    raw.push({ bits: a, f: "ADDR", label: `ADDR ${p.addr ?? 0}` }, { bits: e, f: "ENDP", label: `EP${p.ep ?? 0}` }, { bits: lsb(c, 5), f: "CRC5", label: `CRC5 ${c.toString(2).padStart(5, "0")}` });
  } else if (p.pid === "DATA0" || p.pid === "DATA1") {
    const d = p.data ?? [];
    for (const b of d) raw.push({ bits: lsb(b, 8), f: "DATA", label: hex2(b) });
    const c = crc16(d) ^ (p.bad === "crc" ? 0x0101 : 0);
    raw.push({ bits: lsb(c, 16), f: "CRC16", label: `CRC16 ${hex4(c)}` });
  }
  const bits: number[] = [], stuff: number[] = [], segs: PSeg[] = [];
  let ones = 0;
  for (const fld of raw) {
    const a = bits.length;
    for (const b of fld.bits) {
      bits.push(b);
      ones = b ? ones + 1 : 0;
      if (ones === 6) { stuff.push(bits.length); bits.push(0); ones = 0; }
    }
    segs.push({ f: fld.f, a, b: bits.length, label: fld.label });
  }
  const line: Line[] = [];
  let lv: Line = "J";
  for (const b of bits) { if (!b) lv = lv === "J" ? "K" : "J"; line.push(lv); }
  segs.push({ f: "EOP", a: line.length, b: line.length + 3, label: "EOP" });
  line.push("0", "0", "J");
  return { bits, line, segs, stuff };
}
export const packetTime = (p: Packet) => encodePacket(p).line.length * FS_BIT * (p.skew ?? 1);

/* ---------------- descriptors ---------------- */

export interface Desc { vid: number; pid: number; ep0: number; powerMa: number; product: string; serial: string; manufacturer: string }
const utf16 = (s: string) => [2 + 2 * s.length, 3, ...[...s].flatMap((ch) => [ch.charCodeAt(0) & 0xff, ch.charCodeAt(0) >> 8])];
export function deviceDesc(d: Desc): number[] {
  return [0x12, 0x01, 0x00, 0x02, 0x02, 0x02, 0x00, d.ep0 & 0xff, d.vid & 0xff, d.vid >> 8, d.pid & 0xff, d.pid >> 8, 0x00, 0x02, 1, 2, 3, 1];
}
export function configDesc(d: Desc): number[] {
  const power = Math.min(255, Math.round(d.powerMa / 2));
  return [
    9, 2, 67, 0, 2, 1, 0, 0x80, power,
    9, 4, 0, 0, 1, 0x02, 0x02, 0x01, 0,
    5, 0x24, 0x00, 0x10, 0x01,
    5, 0x24, 0x01, 0x00, 0x01,
    4, 0x24, 0x02, 0x02,
    5, 0x24, 0x06, 0x00, 0x01,
    7, 5, 0x82, 0x03, 8, 0, 0x10,
    9, 4, 1, 0, 2, 0x0a, 0x00, 0x00, 0,
    7, 5, 0x01, 0x02, 64, 0, 0,
    7, 5, 0x81, 0x02, 64, 0, 0,
  ];
}
export const stringDesc = (d: Desc, i: number) => (i === 0 ? [4, 3, 0x09, 0x04] : utf16(i === 1 ? d.manufacturer : i === 2 ? d.product : d.serial));
export const DEFAULT_DESC: Desc = { vid: 0x0483, pid: 0x5740, ep0: 64, powerMa: 100, product: "STM32 Virtual ComPort", manufacturer: "STMicroelectronics", serial: "205E3072A743" };

/* ---------------- state ---------------- */

export type Phase = "nodevice" | "debounce" | "reset" | "enum" | "configured" | "failed";
export const STEP_NAMES = ["Reset", "Get Device Descriptor", "Set Address", "Get Configuration", "Set Configuration", "CDC Line Coding"];
export type StepState = "todo" | "active" | "ok" | "fail";
interface Req { name: string; setup: number[]; out?: number[]; step: number }
export type XKind = "ctrl" | "out" | "in" | "reset" | "attach" | "detach" | "fail";
export type XResult = "ok" | "nak" | "stall" | "err" | "none";
export interface Xfer { id: number; t: number; kind: XKind; title: string; addr: number; ep: number; setup?: number[]; stages: Stage[]; result: XResult; text: string; tries: number; step: number | null; naks: number; data: number[] }
export interface TermLine { t: number; dir: "tx" | "rx"; text: string }
interface Ep { pk: number; bytes: number; nak: number }

export interface Dev { init: boolean; handle: string; cls: string | null; fops: boolean; started: boolean; state: number; addr: number; rxBuf: Val | null; armed: boolean; txBusy: boolean; tx: number[]; usbClk: number; osc: boolean; desc: Desc; toggleIn: 0 | 1; toggleOut: 0 | 1; failCalls: number; busyCalls: number }
export interface Host { phase: Phase; phaseAt: number; attachAt: number; attempt: number; script: Req[]; addr: number; nextAddr: number; nextAt: number; portOpen: boolean; baudSent: number; outQ: number[]; failText: string; failCause: string; steps: Array<{ st: StepState; x: number | null }>; com: number; configuredAt: number | null; enumerations: number }
export interface Front {
  p: P33; dev: Dev; host: Host; xfers: Xfer[]; nextId: number; trimmed: boolean; term: TermLine[]; frames: number; corrupt: number; corrupted: number;
  eps: { ep0: Ep; in1: Ep; out1: Ep; in2: Ep }; pending: Array<{ fn: string; args: Val[] }>; outNakRun: Xfer | null; seenVid: Set<string>; okVidPid: Set<string>; cable: boolean;
}
const FRONT = new WeakMap<Mcu, Front>();
const freshDev = (): Dev => ({ init: false, handle: "hUsbDeviceFS", cls: null, fops: false, started: false, state: 0, addr: 0, rxBuf: null, armed: false, txBusy: false, tx: [], usbClk: 0, osc: false, desc: { ...DEFAULT_DESC }, toggleIn: 0, toggleOut: 0, failCalls: 0, busyCalls: 0 });
const freshSteps = () => STEP_NAMES.map(() => ({ st: "todo" as StepState, x: null as number | null }));
const freshHost = (): Host => ({ phase: "nodevice", phaseAt: 0, attachAt: 0, attempt: 0, script: [], addr: 0, nextAddr: 5, nextAt: 0, portOpen: false, baudSent: 0, outQ: [], failText: "", failCause: "", steps: freshSteps(), com: 5, configuredAt: null, enumerations: 0 });
const ep = (): Ep => ({ pk: 0, bytes: 0, nak: 0 });
export function front(m: Mcu): Front {
  let f = FRONT.get(m);
  if (!f) {
    f = { p: P33_DEFAULT, dev: freshDev(), host: freshHost(), xfers: [], nextId: 1, trimmed: false, term: [], frames: 0, corrupt: 0, corrupted: 0, eps: { ep0: ep(), in1: ep(), out1: ep(), in2: ep() }, pending: [], outNakRun: null, seenVid: new Set(), okVidPid: new Set(), cable: true };
    FRONT.set(m, f);
  }
  return f;
}

export const clockOk = (d: Dev) => d.usbClk > 0 && Math.abs(d.usbClk / 48e6 - 1) <= USB_OK_TOL;
export const ep0Valid = (n: number) => [8, 16, 32, 64].includes(n);
export const pullup = (f: Front) => f.dev.started && f.dev.usbClk > 0;
export const vidpid = (d: Desc) => `${hex4(d.vid)}:${hex4(d.pid)}`;
export const DEV_STATE = ["Powered", "Default", "Address", "Configured", "Suspended"];

function push(f: Front, x: Omit<Xfer, "id">): Xfer {
  const r = { ...x, id: f.nextId++ };
  f.xfers.push(r);
  if (f.xfers.length > 300) { f.xfers.splice(0, f.xfers.length - 300); f.trimmed = true; }
  return r;
}
const note = (f: Front, t: number, kind: XKind, title: string, text: string, result: XResult = "none") => push(f, { t, kind, title, addr: 0, ep: 0, stages: [], result, text, tries: 1, step: null, naks: 0, data: [] });
export function clearLog(m: Mcu) { const f = front(m); f.xfers = []; f.trimmed = false; f.term = []; f.outNakRun = null; }
export function corruptNext(m: Mcu) { front(m).corrupt++; m.log("fault", "The next packet from the device will be corrupted (CRC error)"); }
export function hostSend(m: Mcu, text: string) { const f = front(m); const bytes = [...text].map((c) => c.charCodeAt(0) & 0xff); if (!bytes.length) return; f.host.outQ.push(...bytes); f.term.push({ t: m.now, dir: "tx", text }); }
export function hostReset(m: Mcu) {
  const f = front(m);
  if (f.host.phase === "nodevice") return;
  startReset(f, m.now, "Host issued a bus reset: the device returns to the Default state and enumeration starts again");
}

function setState(m: Mcu, f: Front, s: number, addr = f.dev.addr) {
  f.dev.state = s; f.dev.addr = addr;
  m.fw?.setField(`${f.dev.handle}.dev_state`, s);
  m.fw?.setField(`${f.dev.handle}.dev_address`, addr);
}

function startReset(f: Front, t: number, why: string) {
  const h = f.host;
  h.phase = "reset"; h.phaseAt = t; h.addr = 0; h.portOpen = false; h.baudSent = 0; h.script = []; h.steps = freshSteps(); h.configuredAt = null;
  h.steps[0] = { st: "active", x: null };
  f.dev.addr = 0; f.dev.armed = false; f.dev.txBusy = false; f.dev.tx = []; f.dev.toggleIn = 0; f.dev.toggleOut = 0;
  const x = note(f, t, "reset", "Bus reset (SE0 for 10 ms)", why);
  x.step = 0;
  h.steps[0]!.x = x.id;
}

/* ---------------- control transfers ---------------- */

const setupBytes = (rt: number, req: number, val: number, idx: number, len: number) => [rt, req, val & 0xff, val >> 8, idx & 0xff, idx >> 8, len & 0xff, len >> 8];
function enumScript(h: Host): Req[] {
  const a = h.nextAddr;
  return [
    { name: "GET_DESCRIPTOR (Device, 64)", setup: setupBytes(0x80, 6, 0x0100, 0, 64), step: 1 },
    { name: `SET_ADDRESS (${a})`, setup: setupBytes(0x00, 5, a, 0, 0), step: 2 },
    { name: "GET_DESCRIPTOR (Device, 18)", setup: setupBytes(0x80, 6, 0x0100, 0, 18), step: 1 },
    { name: "GET_DESCRIPTOR (Configuration, 9)", setup: setupBytes(0x80, 6, 0x0200, 0, 9), step: 3 },
    { name: "GET_DESCRIPTOR (Configuration, 67)", setup: setupBytes(0x80, 6, 0x0200, 0, 67), step: 3 },
    { name: "GET_DESCRIPTOR (String 0: languages)", setup: setupBytes(0x80, 6, 0x0300, 0, 255), step: 3 },
    { name: "GET_DESCRIPTOR (String 2: product)", setup: setupBytes(0x80, 6, 0x0302, 0x0409, 255), step: 3 },
    { name: "GET_DESCRIPTOR (String 3: serial number)", setup: setupBytes(0x80, 6, 0x0303, 0x0409, 255), step: 3 },
    { name: "SET_CONFIGURATION (1)", setup: setupBytes(0x00, 9, 1, 0, 0), step: 4 },
  ];
}
const lineCoding = (baud: number) => [baud & 0xff, (baud >> 8) & 0xff, (baud >> 16) & 0xff, (baud >>> 24) & 0xff, 0, 0, 8];

function arr(name: string, bytes: number[]): ArrVal {
  const slot: Slot = { name, type: "uint8_t", ptr: false, v: 0, data: bytes.slice(), dims: [bytes.length] };
  return { kind: "arr", slot, off: 0, dims: [bytes.length] };
}
function numRef(name: string, v: number): RefVal {
  return { kind: "ref", name, ref: { name, type: "uint32_t", float: false, get: () => v, set: () => undefined } };
}
const queueCb = (m: Mcu, f: Front, fn: string, args: Val[]) => { if (f.dev.fops && m.fw?.hasFunction(fn)) f.pending.push({ fn, args }); };

function devDescriptor(f: Front, setup: number[]): number[] | null {
  const type = setup[3]!, idx = setup[2]!;
  if (type === 1) return deviceDesc(f.dev.desc);
  if (type === 2) return f.dev.cls ? configDesc(f.dev.desc) : null;
  if (type === 3) return idx <= 3 ? stringDesc(f.dev.desc, idx) : null;
  return null;
}

function control(m: Mcu, f: Front, t: number, req: Req): Xfer {
  const d = f.dev, h = f.host;
  const ok = clockOk(d);
  const skew = d.usbClk > 0 ? 48e6 / d.usbClk : 1;
  const devPk = (p: Packet): Packet => (ok ? p : { ...p, bad: "clock", skew });
  const addr = h.addr;
  const stages: Stage[] = [{ name: "SETUP", packets: [{ pid: "SETUP", from: "host", addr, ep: 0 }, { pid: "DATA0", from: "host", data: req.setup }, devPk({ pid: "ACK", from: "dev" })] }];
  const base = { t, kind: "ctrl" as const, title: req.name, addr, ep: 0, setup: req.setup, step: req.step, naks: 0 };
  f.eps.ep0.pk += 3;
  if (!ok) {
    return push(f, { ...base, stages, result: "err", tries: 3, data: [], text: `No valid handshake after 3 tries: the device's bits are ${d.usbClk > 0 ? `${((skew - 1) * 100).toFixed(1)} % too ${skew > 1 ? "long" : "short"} (USB clock ${+(d.usbClk / 1e6).toFixed(2)} MHz instead of 48 MHz)` : "missing (no USB clock)"}, so the host cannot decode them` });
  }
  const rt = req.setup[0]!, rq = req.setup[1]!;
  const wLen = req.setup[6]! | (req.setup[7]! << 8);
  let tries = 1, text = "", data: number[] = [];
  if (rt & 0x80) {
    const desc = devDescriptor(f, req.setup);
    if (!desc) {
      stages.push({ name: "DATA", packets: [{ pid: "IN", from: "host", addr, ep: 0 }, { pid: "STALL", from: "dev" }] });
      return push(f, { ...base, stages, result: "stall", tries: 1, data: [], text: rq === 6 && req.setup[3] === 2 ? "STALL: no class is registered, so the device has no configuration descriptor to send" : "STALL: the device does not support this request" });
    }
    data = desc.slice(0, wLen);
    const mps = Math.max(1, Math.min(64, d.desc.ep0));
    const pk: Packet[] = [];
    let tog: 0 | 1 = 1;
    for (let o = 0; o < data.length || o === 0; o += mps) {
      const chunk = data.slice(o, o + mps);
      const dp: Packet = { pid: tog ? "DATA1" : "DATA0", from: "dev", data: chunk };
      if (f.corrupt > 0) {
        f.corrupt--; f.corrupted++; tries++;
        pk.push({ pid: "IN", from: "host", addr, ep: 0 }, { ...dp, bad: "crc" });
        text = " · CRC16 error on a DATA packet: the host sent no ACK and repeated the IN";
      }
      pk.push({ pid: "IN", from: "host", addr, ep: 0 }, dp, { pid: "ACK", from: "host" });
      tog = tog ? 0 : 1;
      if (chunk.length < mps) break;
    }
    if (data.length && data.length < wLen && data.length % mps === 0) pk.push({ pid: "IN", from: "host", addr, ep: 0 }, { pid: tog ? "DATA1" : "DATA0", from: "dev", data: [] }, { pid: "ACK", from: "host" });
    stages.push({ name: "DATA", packets: pk });
    stages.push({ name: "STATUS", packets: [{ pid: "OUT", from: "host", addr, ep: 0 }, { pid: "DATA1", from: "host", data: [] }, { pid: "ACK", from: "dev" }] });
    f.eps.ep0.pk += pk.length + 3; f.eps.ep0.bytes += data.length;
    const n = pk.filter((p) => p.pid.startsWith("DATA") && !p.bad).length;
    text = `${data.length} bytes in ${n} DATA packet${n === 1 ? "" : "s"} of up to ${mps} bytes${text}`;
    return push(f, { ...base, stages, result: "ok", tries, data, text });
  }
  if (req.out) {
    stages.push({ name: "DATA", packets: [{ pid: "OUT", from: "host", addr, ep: 0 }, { pid: "DATA1", from: "host", data: req.out }, { pid: "ACK", from: "dev" }] });
    data = req.out;
  }
  stages.push({ name: "STATUS", packets: [{ pid: "IN", from: "host", addr, ep: 0 }, { pid: "DATA1", from: "dev", data: [] }, { pid: "ACK", from: "host" }] });
  f.eps.ep0.pk += stages.slice(1).reduce((s, x) => s + x.packets.length, 0); f.eps.ep0.bytes += data.length;
  if (rq === 5) { setState(m, f, 2, req.setup[2]!); h.addr = req.setup[2]!; text = `The device keeps answering on address 0 until the STATUS stage completes, then switches to address ${h.addr}`; }
  else if (rq === 9) {
    setState(m, f, 3);
    d.armed = true; d.txBusy = false; d.tx = [];
    queueCb(m, f, "CDC_Init_FS", []);
    text = "Configured: EP1 IN/OUT (bulk, 64 B) and EP2 IN (interrupt, 8 B) are open; EP1 OUT is armed for data";
  } else if (rt === 0x21 && rq === 0x20) { queueCb(m, f, "CDC_Control_FS", [0x20, arr("pbuf", req.out ?? []), 7]); text = `Line coding ${lineText(req.out ?? [])}: only a number for the firmware, the USB link still runs at 12 Mbit/s`; }
  else if (rt === 0x21 && rq === 0x22) { queueCb(m, f, "CDC_Control_FS", [0x22, arr("pbuf", req.setup), 0]); text = req.setup[2]! & 1 ? "DTR = 1: a terminal opened the COM port" : "DTR = 0: the terminal closed the COM port"; }
  return push(f, { ...base, stages, result: "ok", tries, data, text });
}
const lineText = (b: number[]) => `${(b[0]! | (b[1]! << 8) | (b[2]! << 16) | ((b[3]! << 24) >>> 0)) >>> 0} baud ${b[6] ?? 8}${["N", "O", "E", "M", "S"][b[5] ?? 0]}${b[4] === 2 ? 2 : 1}`;

/* ---------------- bulk transfers ---------------- */

function bulkOut(m: Mcu, f: Front, t: number) {
  const d = f.dev, h = f.host;
  const chunk = h.outQ.slice(0, 64);
  const tok: Packet = { pid: "OUT", from: "host", addr: h.addr, ep: 1 };
  const dp: Packet = { pid: d.toggleOut ? "DATA1" : "DATA0", from: "host", data: chunk };
  if (!d.armed || !d.rxBuf) {
    f.eps.out1.nak++;
    if (f.outNakRun && t - f.outNakRun.t <= 0.0021) { f.outNakRun.naks++; f.outNakRun.t = t; f.outNakRun.text = `NAK × ${f.outNakRun.naks}: EP1 OUT is not armed, so the device refuses the data and the host keeps retrying every frame`; return; }
    f.outNakRun = push(f, { t, kind: "out", title: `Bulk OUT EP1 · ${chunk.length} B`, addr: h.addr, ep: 1, stages: [{ name: "OUT", packets: [tok, dp, { pid: "NAK", from: "dev" }] }], result: "nak", tries: 1, step: null, naks: 1, data: chunk, text: "NAK: EP1 OUT is not armed (USBD_CDC_ReceivePacket() has not been called since the last packet)" });
    return;
  }
  f.outNakRun = null;
  h.outQ.splice(0, chunk.length);
  d.toggleOut = d.toggleOut ? 0 : 1;
  d.armed = false;
  f.eps.out1.pk++; f.eps.out1.bytes += chunk.length;
  writeBytes(d.rxBuf, chunk);
  queueCb(m, f, "CDC_Receive_FS", [d.rxBuf, numRef("Len", chunk.length)]);
  push(f, { t, kind: "out", title: `Bulk OUT EP1 · ${chunk.length} B`, addr: h.addr, ep: 1, stages: [{ name: "OUT", packets: [tok, dp, { pid: "ACK", from: "dev" }] }], result: "ok", tries: 1, step: null, naks: 0, data: chunk, text: `"${printable(chunk)}" → UserRxBufferFS, CDC_Receive_FS() called` });
}

function bulkIn(f: Front, t: number) {
  const d = f.dev, h = f.host;
  if (!d.txBusy) { f.eps.in1.nak++; return; }
  const chunk = d.tx.slice(0, 64);
  const tok: Packet = { pid: "IN", from: "host", addr: h.addr, ep: 1 };
  const dp: Packet = { pid: d.toggleIn ? "DATA1" : "DATA0", from: "dev", data: chunk };
  if (f.corrupt > 0) {
    f.corrupt--; f.corrupted++;
    push(f, { t, kind: "in", title: `Bulk IN EP1 · ${chunk.length} B`, addr: h.addr, ep: 1, stages: [{ name: "IN", packets: [tok, { ...dp, bad: "crc" }] }], result: "err", tries: 1, step: null, naks: 0, data: chunk, text: "CRC16 error: the host ignores the packet (no ACK), the device keeps it and sends it again on the next IN" });
    return;
  }
  d.tx.splice(0, chunk.length);
  d.toggleIn = d.toggleIn ? 0 : 1;
  f.eps.in1.pk++; f.eps.in1.bytes += chunk.length;
  if (!d.tx.length) d.txBusy = false;
  const txt = printable(chunk);
  const last = f.term[f.term.length - 1];
  if (last && last.dir === "rx" && !/\n$/.test(last.text) && last.t > t - 0.05) last.text += String.fromCharCode(...chunk);
  else f.term.push({ t, dir: "rx", text: String.fromCharCode(...chunk) });
  if (f.term.length > 200) f.term.splice(0, f.term.length - 200);
  push(f, { t, kind: "in", title: `Bulk IN EP1 · ${chunk.length} B`, addr: h.addr, ep: 1, stages: [{ name: "IN", packets: [tok, dp, { pid: "ACK", from: "host" }] }], result: "ok", tries: 1, step: null, naks: 0, data: chunk, text: `"${txt}" → PC terminal` });
}
export const printable = (b: number[]) => b.map((c) => (c === 13 ? "\\r" : c === 10 ? "\\n" : c >= 32 && c < 127 ? String.fromCharCode(c) : `\\x${hex2(c)}`)).join("");

/* ---------------- host ---------------- */

function fail(f: Front, t: number, step: number, cause: string, text: string) {
  const h = f.host;
  h.steps[step] = { st: "fail", x: f.xfers[f.xfers.length - 1]?.id ?? null };
  h.attempt++;
  if (h.attempt < 3 && cause !== "power") { note(f, t, "fail", `Enumeration attempt ${h.attempt} failed`, `${text}. The host resets the port and tries again.`, "err"); startReset(f, t + 0.05, `Retry ${h.attempt + 1} of 3`); f.host.phaseAt = t + 0.05; f.host.steps[step] = { st: "fail", x: f.host.steps[step]?.x ?? null }; return; }
  h.phase = "failed"; h.phaseAt = t; h.failCause = cause; h.failText = text;
  note(f, t, "fail", cause === "power" ? "Power surge on the USB port" : "Unknown USB Device (Device Descriptor Request Failed)", `${text}. ${cause === "power" ? "The host leaves the device unconfigured." : "The host gives up after 3 attempts: replug the cable or fix the firmware."}`, "err");
}

function hostStep(m: Mcu, f: Front, t: number) {
  const h = f.host, d = f.dev;
  if (h.phase === "debounce" && t >= h.phaseAt + 0.1) startReset(f, t, "100 ms after attach the host drives SE0 for 10 ms: the device resets its USB logic and listens on address 0");
  if (h.phase === "reset" && t >= h.phaseAt) {
    if (t < h.phaseAt + 0.01) return;
    setState(m, f, 1, 0);
    h.phase = "enum"; h.nextAt = t + 0.01; h.script = enumScript(h);
    h.steps[0] = { st: "ok", x: h.steps[0]!.x };
    return;
  }
  if (h.phase === "enum" && t >= h.nextAt) {
    const req = h.script.shift();
    if (!req) return;
    if (req.step === 4 && d.desc.powerMa > 500) {
      h.steps[4] = { st: "fail", x: null };
      fail(f, t, 4, "power", `The configuration descriptor asks for ${d.desc.powerMa} mA (bMaxPower ${Math.min(255, Math.round(d.desc.powerMa / 2))} × 2 mA) but a USB 2.0 port supplies at most 500 mA, so the host never sends SET_CONFIGURATION`);
      return;
    }
    h.steps[req.step] = { st: "active", x: null };
    const x = control(m, f, t, req);
    h.steps[req.step]!.x = x.id;
    if (x.result !== "ok") { fail(f, t, req.step, x.result === "stall" ? "stall" : "clock", x.result === "stall" ? x.text : `${req.name} failed: ${x.text}`); return; }
    if (req.setup[1] === 6 && req.setup[3] === 1 && req.setup[6] === 64 && !ep0Valid(d.desc.ep0)) {
      fail(f, t, 1, "ep0", `Invalid device descriptor: bMaxPacketSize0 = ${d.desc.ep0}, but a full-speed control endpoint must be 8, 16, 32 or 64 bytes`);
      return;
    }
    if (!h.script.some((r) => r.step === req.step)) h.steps[req.step]!.st = "ok";
    h.nextAt = t + (req.setup[1] === 5 ? 0.002 : 0.001);
    if (!h.script.length) {
      h.phase = "configured"; h.configuredAt = t; h.enumerations++;
      h.com = d.desc.vid === 0x0483 && d.desc.pid === 0x5740 ? 5 : 6 + (d.desc.pid % 3);
      f.okVidPid.add(vidpid(d.desc));
      note(f, t, "attach", `${d.desc.product} (COM${h.com})`, `Enumerated ${((t - h.attachAt) * 1e3).toFixed(0)} ms after attach: VID:PID ${vidpid(d.desc)}, CDC-ACM driver loaded`, "ok");
    }
    return;
  }
  if (h.phase !== "configured" || t < h.nextAt) return;
  const want = f.p.port;
  if (want && (!h.portOpen || h.baudSent !== f.p.baud)) {
    if (h.baudSent !== f.p.baud) {
      h.steps[5] = { st: "active", x: null };
      const x = control(m, f, t, { name: `SET_LINE_CODING (${f.p.baud} 8N1)`, setup: setupBytes(0x21, 0x20, 0, 0, 7), out: lineCoding(f.p.baud), step: 5 });
      h.steps[5] = { st: x.result === "ok" ? "ok" : "fail", x: x.id };
      h.baudSent = f.p.baud; h.nextAt = t + 0.001;
      return;
    }
    control(m, f, t, { name: "SET_CONTROL_LINE_STATE (DTR=1 RTS=1)", setup: setupBytes(0x21, 0x22, 3, 0, 0), step: 5 });
    h.portOpen = true; h.nextAt = t + 0.001;
    return;
  }
  if (!want && h.portOpen) {
    control(m, f, t, { name: "SET_CONTROL_LINE_STATE (DTR=0 RTS=0)", setup: setupBytes(0x21, 0x22, 0, 0, 0), step: 5 });
    h.portOpen = false; h.baudSent = 0; h.nextAt = t + 0.001;
    return;
  }
  if (h.outQ.length) bulkOut(m, f, t);
  if (h.portOpen) bulkIn(f, t);
  if (Math.round(t * 1000) % 16 === 0) f.eps.in2.nak++;
}

/* ---------------- HAL hooks ---------------- */

const refName = (v: Val | undefined) => (v && typeof v === "object" && v.kind === "ref" ? v.name : "");
const defNum = (m: Mcu, k: string, dflt: number) => { const v = m.fw?.program.defines[k]; const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN; return Number.isFinite(n) ? n : dflt; };
const defStr = (m: Mcu, k: string, dflt: string) => { const v = m.fw?.program.defines[k]; return typeof v === "string" ? v.replace(/^"|"$/g, "") : dflt; };

const hook: CallHook = (name, args, m) => {
  const f = front(m), d = f.dev, fw = m.fw;
  const n = (i: number) => toNum(args[i] ?? 0);
  switch (name) {
    case "HAL_RCC_OscConfig": {
      const s = refName(args[0]) || "RCC_OscInitStruct";
      const fld = (k: string) => fw?.field(`${s}.${k}`) ?? 0;
      d.osc = true;
      const hse = fld("HSEState") === 1, on = fld("PLL.PLLState") === 2, src = fld("PLL.PLLSource") === 0x400000 ? 8e6 : 16e6;
      const M = fld("PLL.PLLM"), N = fld("PLL.PLLN"), Q = fld("PLL.PLLQ");
      if (!on || M < 2 || N < 50 || Q < 2 || (src === 8e6 && !hse)) { d.usbClk = 0; m.log("fault", "PLL not running: the USB core has no 48 MHz clock"); return 0; }
      d.usbClk = src / M * N / Q;
      m.log("info", `PLL: ${src / 1e6} MHz / ${M} × ${N} = ${(src / M * N / 1e6).toFixed(0)} MHz VCO, PLLQ ${Q} → USB clock ${+(d.usbClk / 1e6).toFixed(3)} MHz${clockOk(d) ? "" : " (USB needs 48 MHz ± 0.25 %)"}`);
      return 0;
    }
    case "HAL_RCC_ClockConfig": return 0;
    case "USBD_Init": {
      d.init = true; d.handle = refName(args[0]) || "hUsbDeviceFS";
      d.desc = { ...DEFAULT_DESC, vid: defNum(m, "USBD_VID", DEFAULT_DESC.vid) & 0xffff, pid: defNum(m, "USBD_PID_FS", DEFAULT_DESC.pid) & 0xffff, ep0: defNum(m, "USBD_MAX_EP0_SIZE", 64), powerMa: defNum(m, "USBD_MAX_POWER_MA", 100), product: defStr(m, "USBD_PRODUCT_STRING", DEFAULT_DESC.product) };
      f.seenVid.add(vidpid(d.desc));
      setState(m, f, 1, 0);
      return 0;
    }
    case "USBD_DeInit": d.init = false; d.started = false; return 0;
    case "USBD_RegisterClass": d.cls = refName(args[1]).replace(/^USBD_/, "") || "CDC"; return 0;
    case "USBD_CDC_RegisterInterface": d.fops = true; return 0;
    case "USBD_CDC_SetRxBuffer": d.rxBuf = args[1] ?? null; return 0;
    case "USBD_CDC_SetTxBuffer": d.tx = readBytes(args[1], n(2)); return 0;
    case "USBD_CDC_ReceivePacket": if (d.state !== 3) return 3; d.armed = true; return 0;
    case "USBD_CDC_TransmitPacket": if (d.state !== 3) return 3; if (d.txBusy) return 1; d.txBusy = true; return 0;
    case "USBD_Start": {
      if (!d.init) { m.log("fault", "USBD_Start() before USBD_Init()"); return 3; }
      d.started = true;
      if (d.usbClk === 0) m.log("fault", "USBD_Start(): the USB core has no clock, the D+ pull-up stays off");
      return 0;
    }
    case "USBD_Stop": d.started = false; return 0;
    case "CDC_Transmit_FS": {
      if (d.state !== 3) { d.failCalls++; return 3; }
      if (d.txBusy) { d.busyCalls++; return 1; }
      d.tx = readBytes(args[0], n(1)); d.txBusy = true;
      return 0;
    }
    case "HAL_PCD_IRQHandler": case "OTG_FS_IRQHandler": return 0;
  }
  return undefined;
};

export function mcu33(): McuOptions {
  return { family: "stm32", constants: USB_CONST, onCall: hook };
}

export function world33(m: Mcu, dt: number, p: P33) {
  const f = front(m);
  f.p = p;
  const t = m.now, h = f.host;
  const present = p.cable && pullup(f);
  if (!present && h.phase !== "nodevice") {
    note(f, t, "detach", p.cable ? "Device disconnected (D+ pull-up released)" : "Cable unplugged", "The host removes the device and its COM port", "none");
    const keep = h.nextAddr + 1;
    f.host = freshHost(); f.host.nextAddr = keep > 127 ? 1 : keep;
    if (f.dev.state) setState(m, f, 1, 0);
    f.dev.armed = false; f.dev.txBusy = false;
  } else if (present && h.phase === "nodevice") {
    h.phase = "debounce"; h.phaseAt = t; h.attachAt = t; h.attempt = 0;
    note(f, t, "attach", "Device attached", "The 1.5 kΩ pull-up on D+ lifts it to 3.3 V: the host sees a full-speed device and waits 100 ms for the connection to settle", "none");
  }
  if (f.cable !== p.cable) f.cable = p.cable;
  if (f.host.phase !== "nodevice") { f.frames++; hostStep(m, f, t); }
  const fw = m.fw;
  if (fw && f.pending.length && fw.globalIrqEnabled && !fw.threads.some((th) => th.kind === "isr" && th.state !== "done")) {
    const cb = f.pending.shift()!;
    fw.raise(cb.fn, 0, cb.args);
  }
  void dt;
}

/* ---------------- monitor ---------------- */

export interface MonLine { key: string; id: number; t: number; title: string; text: string; tone: "ok" | "bad" | "warn" | "info" | "ctrl"; kind: XKind }
export function monitor(f: Front, limit = 160): MonLine[] {
  return f.xfers.slice(-limit).map((x) => ({ key: `x${x.id}`, id: x.id, t: x.t, title: x.title, text: x.text, kind: x.kind, tone: x.result === "err" || x.result === "stall" ? "bad" : x.result === "nak" || x.tries > 1 ? "warn" : x.kind === "ctrl" ? "ctrl" : x.kind === "in" || x.kind === "out" ? "ok" : "info" }));
}
export const stagesText = (x: Xfer) => x.stages.map((s) => s.name).join(" → ");
