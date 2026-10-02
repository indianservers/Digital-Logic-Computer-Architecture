import { toNum, type Val } from "../core/cinterp";
import { readBytes, writeBytes, type CallHook, type Mcu, type McuOptions } from "../core/mcu";

export const DEMO = `/* Lab 32: CAN Bus Fundamentals - ECU A (this STM32) sends 0x120 every 100 ms and listens to ECU B and ECU C */
#include "stm32f4xx_hal.h"

CAN_HandleTypeDef hcan1;
CAN_FilterTypeDef filter;
CAN_TxHeaderTypeDef hdr = {.StdId = 0x120, .DLC = 8, .RTR = CAN_RTR_DATA};
CAN_RxHeaderTypeDef rxh;
uint8_t data[8];
uint8_t rx[8];
uint32_t mailbox;
HAL_StatusTypeDef st;
uint16_t rpm = 800;
uint8_t counter = 0;
uint8_t brake = 0;            // from ECU B, ID 0x080
uint8_t speed = 0;            // from ECU C, ID 0x2A0
uint32_t rxCount = 0;
uint32_t txFail = 0;

void MX_CAN1_Init(void) {
  hcan1.Instance = CAN1;
  hcan1.Init.Prescaler = 6;               // 42 MHz / 6 / (1 + 11 + 2) tq = 500 kbps
  hcan1.Init.Mode = CAN_MODE_NORMAL;
  hcan1.Init.SyncJumpWidth = CAN_SJW_1TQ;
  hcan1.Init.TimeSeg1 = CAN_BS1_11TQ;
  hcan1.Init.TimeSeg2 = CAN_BS2_2TQ;      // sample point at 12 / 14 = 85.7 %
  hcan1.Init.AutoBusOff = DISABLE;
  hcan1.Init.AutoRetransmission = ENABLE;
  HAL_CAN_Init(&hcan1);

  filter.FilterBank = 0;
  filter.FilterMode = CAN_FILTERMODE_IDMASK;
  filter.FilterScale = CAN_FILTERSCALE_32BIT;
  filter.FilterIdHigh = 0x0000;
  filter.FilterMaskIdHigh = 0x0000;       // mask 0: accept every identifier
  filter.FilterFIFOAssignment = CAN_RX_FIFO0;
  filter.FilterActivation = ENABLE;
  HAL_CAN_ConfigFilter(&hcan1, &filter);

  HAL_CAN_Start(&hcan1);
  HAL_CAN_ActivateNotification(&hcan1, CAN_IT_RX_FIFO0_MSG_PENDING);
}

void HAL_CAN_RxFifo0MsgPendingCallback(CAN_HandleTypeDef *hcan) {
  HAL_CAN_GetRxMessage(hcan, CAN_RX_FIFO0, &rxh, rx);
  rxCount++;
  if (rxh.StdId == 0x080) brake = rx[0];
  if (rxh.StdId == 0x2A0) speed = rx[0];
}

int main(void) {
  HAL_Init();
  MX_CAN1_Init();
  while (1) {
    rpm = brake > 50 ? 800 : rpm + 50;    // ECU B's brake message idles the engine
    if (rpm > 3000) rpm = 800;
    data[0] = rpm >> 8;
    data[1] = rpm & 0xFF;
    data[2] = 90;                         // coolant 90 C
    data[3] = brake;
    data[7] = counter++;
    st = HAL_CAN_AddTxMessage(&hcan1, &hdr, data, &mailbox);  // lower identifier wins arbitration
    if (st != HAL_OK) txFail++;
    HAL_Delay(100);
  }
}
`;

const swap = (src: string, pairs: Array<[string | RegExp, string]>) => pairs.reduce((s, [a, b]) => s.replace(a, b), src);

export const AUTO_BOFF = swap(DEMO, [
  ["Lab 32: CAN Bus Fundamentals - ECU A (this STM32) sends 0x120 every 100 ms and listens to ECU B and ECU C", "Lab 32: automatic bus-off recovery - the bxCAN rejoins the bus by itself after 128 x 11 recessive bits"],
  ["hcan1.Init.AutoBusOff = DISABLE;", "hcan1.Init.AutoBusOff = ENABLE;        // ABOM: leave bus-off automatically"],
]);

export const MANUAL_BOFF = swap(DEMO, [
  ["Lab 32: CAN Bus Fundamentals - ECU A (this STM32) sends 0x120 every 100 ms and listens to ECU B and ECU C", "Lab 32: manual bus-off recovery - the firmware notices bus-off and restarts the controller"],
  ["uint32_t txFail = 0;", "uint32_t txFail = 0;\nuint32_t recoveries = 0;"],
  ["    HAL_Delay(100);", "    if (HAL_CAN_GetError(&hcan1) & HAL_CAN_ERROR_BOF) {  // bus-off: TEC passed 255\n      HAL_CAN_ResetError(&hcan1);\n      HAL_CAN_Stop(&hcan1);               // enter initialisation mode\n      HAL_CAN_Start(&hcan1);              // rejoin after 128 x 11 recessive bits\n      recoveries++;\n    }\n    HAL_Delay(100);"],
]);

export const REMOTE = swap(DEMO, [
  ["Lab 32: CAN Bus Fundamentals - ECU A (this STM32) sends 0x120 every 100 ms and listens to ECU B and ECU C", "Lab 32: remote frame - ECU A asks ECU C for its 0x2A0 data instead of sending its own"],
  ["CAN_TxHeaderTypeDef hdr = {.StdId = 0x120, .DLC = 8, .RTR = CAN_RTR_DATA};", "CAN_TxHeaderTypeDef hdr = {.StdId = 0x2A0, .DLC = 4, .RTR = CAN_RTR_REMOTE};  // no data bytes"],
]);

export const FILTER_B = swap(DEMO, [
  ["Lab 32: CAN Bus Fundamentals - ECU A (this STM32) sends 0x120 every 100 ms and listens to ECU B and ECU C", "Lab 32: acceptance filter - ECU A only stores ID 0x080 (ECU B), ECU C's frames are ACKed but dropped"],
  ["  filter.FilterIdHigh = 0x0000;\n  filter.FilterMaskIdHigh = 0x0000;       // mask 0: accept every identifier", "  filter.FilterIdHigh = 0x080 << 5;       // STID sits in bits 15..5 of the high half\n  filter.FilterMaskIdHigh = 0x7FF << 5;   // all 11 ID bits must match"],
]);

export const BUG_SAMEID = swap(DEMO, [
  ["Lab 32: CAN Bus Fundamentals - ECU A (this STM32) sends 0x120 every 100 ms and listens to ECU B and ECU C", "Lab 32 bug: ECU A uses ECU B's identifier, so both win arbitration and collide in the data field"],
  ["CAN_TxHeaderTypeDef hdr = {.StdId = 0x120, .DLC = 8, .RTR = CAN_RTR_DATA};", "CAN_TxHeaderTypeDef hdr = {.StdId = 0x080, .DLC = 8, .RTR = CAN_RTR_DATA};"],
]);

export const BUG_NOFILTER = swap(DEMO, [
  ["Lab 32: CAN Bus Fundamentals - ECU A (this STM32) sends 0x120 every 100 ms and listens to ECU B and ECU C", "Lab 32 bug: no acceptance filter is configured, so the bxCAN stores nothing"],
  ["  HAL_CAN_ConfigFilter(&hcan1, &filter);\n", "  // HAL_CAN_ConfigFilter(&hcan1, &filter);\n"],
]);

export const BUG_BITRATE = swap(DEMO, [
  ["Lab 32: CAN Bus Fundamentals - ECU A (this STM32) sends 0x120 every 100 ms and listens to ECU B and ECU C", "Lab 32 bug: ECU A runs at 1 Mbps on a 500 kbps network"],
  ["hcan1.Init.Prescaler = 6;               // 42 MHz / 6 / (1 + 11 + 2) tq = 500 kbps", "hcan1.Init.Prescaler = 3;               // 42 MHz / 3 / 14 tq = 1 Mbps"],
]);

export const BUG_NART = swap(DEMO, [
  ["Lab 32: CAN Bus Fundamentals - ECU A (this STM32) sends 0x120 every 100 ms and listens to ECU B and ECU C", "Lab 32 bug: automatic retransmission is off, so a frame that loses arbitration is gone"],
  ["hcan1.Init.AutoRetransmission = ENABLE;", "hcan1.Init.AutoRetransmission = DISABLE;"],
]);

export const VARIANTS = [
  { label: "C (STM32 HAL)", code: DEMO },
  { label: "Auto bus-off recovery", code: AUTO_BOFF },
  { label: "Manual bus-off recovery", code: MANUAL_BOFF },
  { label: "Remote frame request", code: REMOTE },
  { label: "Acceptance filter 0x080", code: FILTER_B },
  { label: "Bug: duplicate identifier", code: BUG_SAMEID },
  { label: "Bug: no filter", code: BUG_NOFILTER },
  { label: "Bug: wrong bitrate", code: BUG_BITRATE },
  { label: "Bug: no retransmission", code: BUG_NART },
];

/* ---------------- constants and code fields ---------------- */

export const PCLK1 = 42e6;
const seq = (n: number, shift: number, name: string) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`${name}_${i + 1}TQ`, (i << shift) >>> 0]));
export const CAN_CONST: Record<string, number> = {
  CAN1: 0x40006400, CAN_MODE_NORMAL: 0, CAN_MODE_LOOPBACK: 0x40000000, CAN_MODE_SILENT: 0x80000000, CAN_MODE_SILENT_LOOPBACK: 0xc0000000,
  ...seq(4, 24, "CAN_SJW"), ...seq(16, 16, "CAN_BS1"), ...seq(8, 20, "CAN_BS2"),
  CAN_RTR_DATA: 0, CAN_RTR_REMOTE: 2, CAN_ID_STD: 0, CAN_ID_EXT: 4,
  CAN_FILTERMODE_IDMASK: 0, CAN_FILTERMODE_IDLIST: 1, CAN_FILTERSCALE_16BIT: 0, CAN_FILTERSCALE_32BIT: 1,
  CAN_FILTER_FIFO0: 0, CAN_FILTER_FIFO1: 1, CAN_RX_FIFO0: 0, CAN_RX_FIFO1: 1, CAN_FILTER_ENABLE: 1, CAN_FILTER_DISABLE: 0,
  CAN_TX_MAILBOX0: 1, CAN_TX_MAILBOX1: 2, CAN_TX_MAILBOX2: 4,
  CAN_IT_TX_MAILBOX_EMPTY: 0x1, CAN_IT_RX_FIFO0_MSG_PENDING: 0x2, CAN_IT_RX_FIFO0_FULL: 0x4, CAN_IT_RX_FIFO0_OVERRUN: 0x8,
  CAN_IT_RX_FIFO1_MSG_PENDING: 0x10, CAN_IT_RX_FIFO1_FULL: 0x20, CAN_IT_RX_FIFO1_OVERRUN: 0x40,
  CAN_IT_ERROR_WARNING: 0x100, CAN_IT_ERROR_PASSIVE: 0x200, CAN_IT_BUSOFF: 0x400, CAN_IT_LAST_ERROR_CODE: 0x800, CAN_IT_ERROR: 0x8000,
  HAL_CAN_ERROR_NONE: 0, HAL_CAN_ERROR_EWG: 0x1, HAL_CAN_ERROR_EPV: 0x2, HAL_CAN_ERROR_BOF: 0x4, HAL_CAN_ERROR_STF: 0x8, HAL_CAN_ERROR_FOR: 0x10,
  HAL_CAN_ERROR_ACK: 0x20, HAL_CAN_ERROR_BR: 0x40, HAL_CAN_ERROR_BD: 0x80, HAL_CAN_ERROR_CRC: 0x100, HAL_CAN_ERROR_RX_FOV0: 0x200, HAL_CAN_ERROR_RX_FOV1: 0x400,
  HAL_CAN_ERROR_TX_ALST0: 0x800, HAL_CAN_ERROR_TX_TERR0: 0x1000, HAL_CAN_ERROR_TIMEOUT: 0x20000, HAL_CAN_ERROR_NOT_INITIALIZED: 0x40000,
  HAL_CAN_ERROR_NOT_READY: 0x80000, HAL_CAN_ERROR_NOT_STARTED: 0x100000, HAL_CAN_ERROR_PARAM: 0x200000,
  HAL_CAN_STATE_RESET: 0, HAL_CAN_STATE_READY: 1, HAL_CAN_STATE_LISTENING: 2, HAL_CAN_STATE_ERROR: 5,
  CAN1_TX_IRQn: 19, CAN1_RX0_IRQn: 20, CAN1_RX1_IRQn: 21, CAN1_SCE_IRQn: 22,
};
const ERR = { EWG: 0x1, EPV: 0x2, BOF: 0x4, STF: 0x8, FOR: 0x10, ACK: 0x20, BR: 0x40, BD: 0x80, CRC: 0x100, FOV0: 0x200, FOV1: 0x400, ALST: 0x800, TERR: 0x1000, NOT_INIT: 0x40000, NOT_STARTED: 0x100000, PARAM: 0x200000 } as const;

export type FieldKey = "id" | "dlc" | "rtr" | "presc" | "abom" | "nart";
const FIELDS: Record<FieldKey, RegExp> = {
  id: /(\.StdId\s*=\s*)(0[xX][0-9A-Fa-f]+|\d+)/,
  dlc: /(\.DLC\s*=\s*)(\d+)/,
  rtr: /(\.RTR\s*=\s*CAN_RTR_)(DATA|REMOTE)\b/,
  presc: /(hcan1\.Init\.Prescaler\s*=\s*)(\d+)/,
  abom: /(hcan1\.Init\.AutoBusOff\s*=\s*)(ENABLE|DISABLE)\b/,
  nart: /(hcan1\.Init\.AutoRetransmission\s*=\s*)(ENABLE|DISABLE)\b/,
};
export const codeField = (src: string, k: FieldKey) => src.match(FIELDS[k])?.[2] ?? null;
export const setCodeField = (src: string, k: FieldKey, v: string) => src.replace(FIELDS[k], (_m, a: string) => `${a}${v}`);
/** Prescaler for each bitrate with the 14 tq bit time of the demo (1 + BS1 11 + BS2 2). */
export const PRESC: Array<[number, number]> = [[125, 24], [250, 12], [500, 6], [1000, 3]];

export const hex2 = (b: number) => (b & 0xff).toString(16).toUpperCase().padStart(2, "0");
export const hex3 = (v: number) => `0x${(v & 0x7ff).toString(16).toUpperCase().padStart(3, "0")}`;
export const fmtT = (s: number) => (!Number.isFinite(s) ? "∞" : s >= 1e-3 ? `${+(s * 1e3).toFixed(2)} ms` : s >= 1e-6 ? `${+(s * 1e6).toFixed(2)} µs` : `${Math.round(s * 1e9)} ns`);
export const fmtRate = (bps: number) => (bps >= 1e6 ? `${+(bps / 1e6).toFixed(3)} Mbps` : `${+(bps / 1e3).toFixed(1)} kbps`);

/* ---------------- parameters ---------------- */

export type NodeKey = "A" | "B" | "C";
export type Term = "both" | "one" | "none";
export type Trig = "arb" | "A" | "B" | "C" | "err" | "any";
export type View = "auto" | "arb" | "frame";
export type P32 = { netKbps: number; term: Term; b: boolean; c: boolean; brake: number; speed: number; trig: Trig; view: View; lane: NodeKey };
export const P32_DEFAULT: P32 = { netKbps: 500, term: "both", b: true, c: true, brake: 20, speed: 64, trig: "arb", view: "auto", lane: "A" };

export const NODE_ID: Record<NodeKey, number> = { A: 0x120, B: 0x080, C: 0x2a0 };
export const NODE_NAME: Record<NodeKey, string> = { A: "ECU A", B: "ECU B", C: "ECU C" };
export const NODE_ROLE: Record<NodeKey, string> = { A: "Engine · STM32 bxCAN", B: "Brake", C: "Dashboard" };
export const CYCLE = 0.1;

/* ---------------- electrical ---------------- */

export const C_BUS = 280e-12;
export const R_TERM: Record<Term, number> = { both: 60, one: 120, none: 20000 };
export const TERM_LABEL: Record<Term, string> = { both: "120 Ω at both ends (60 Ω)", one: "One 120 Ω only", none: "None (open bus)" };
/** Time constant of the dominant-to-recessive edge: the transceivers stop driving and the termination discharges the bus. */
export const tauRec = (t: Term) => R_TERM[t] * C_BUS;
/** A recessive bit is read as recessive once the differential voltage has fallen below 0.9 V (from 2 V). */
export const recessiveLate = (t: Term, sampleAt: number) => 2 * Math.exp(-sampleAt / tauRec(t)) > 0.9;

/* ---------------- CRC and frame encoding ---------------- */

export function crc15(bits: number[]): number {
  let crc = 0;
  for (const b of bits) {
    const nxt = b ^ ((crc >> 14) & 1);
    crc = (crc << 1) & 0x7fff;
    if (nxt) crc ^= 0x4599;
  }
  return crc;
}

export interface CanFrame { id: number; rtr: boolean; dlc: number; data: number[] }
export type Field = "SOF" | "ID" | "RTR" | "IDE" | "R0" | "DLC" | "DATA" | "CRC" | "CDEL" | "ACK" | "ADEL" | "EOF" | "FLAG" | "EDEL" | "IFS";
export interface Seg { f: Field; a: number; b: number; label: string }
export interface Enc { bits: number[]; raw: number[]; segs: Seg[]; stuff: number[]; arbEnd: number; ackAt: number; crc: number }

const bitsOf = (v: number, n: number) => Array.from({ length: n }, (_, i) => (v >> (n - 1 - i)) & 1);

export function encode(fr: CanFrame): Enc {
  const fields: Array<[Field, number[], string]> = [["SOF", [0], "SOF"], ["ID", bitsOf(fr.id, 11), hex3(fr.id)], ["RTR", [fr.rtr ? 1 : 0], fr.rtr ? "RTR" : "D"], ["IDE", [0], "IDE"], ["R0", [0], "r0"], ["DLC", bitsOf(fr.dlc, 4), `DLC ${fr.dlc}`]];
  if (!fr.rtr) for (const b of fr.data.slice(0, Math.min(8, fr.dlc))) fields.push(["DATA", bitsOf(b, 8), hex2(b)]);
  const crc = crc15(fields.flatMap(([, b]) => b));
  fields.push(["CRC", bitsOf(crc, 15), `CRC ${crc.toString(16).toUpperCase().padStart(4, "0")}`]);
  const bits: number[] = [], raw: number[] = [], segs: Seg[] = [], stuff: number[] = [];
  let last = -1, run = 0, ri = 0, arbEnd = 0;
  for (const [f, fb, label] of fields) {
    const a = bits.length;
    for (const b of fb) {
      bits.push(b); raw.push(ri++);
      if (b === last) run++; else { last = b; run = 1; }
      if (run === 5) { const s = 1 - b; bits.push(s); raw.push(-1); stuff.push(bits.length - 1); last = s; run = 1; }
    }
    segs.push({ f, a, b: bits.length, label });
    if (f === "RTR") arbEnd = bits.length;
  }
  let ackAt = 0;
  for (const [f, n, label] of [["CDEL", 1, "DEL"], ["ACK", 1, "ACK"], ["ADEL", 1, "DEL"], ["EOF", 7, "EOF"]] as Array<[Field, number, string]>) {
    const a = bits.length;
    if (f === "ACK") ackAt = a;
    for (let i = 0; i < n; i++) { bits.push(1); raw.push(-2); }
    segs.push({ f, a, b: bits.length, label });
  }
  return { bits, raw, segs, stuff, arbEnd, ackAt, crc };
}

/** "ID bit 8", "DLC bit 3", "data byte 2 bit 5", "stuff bit in ID"... */
export function posName(segs: Seg[], raw: number[], i: number): string {
  const s = segs.find((x) => i >= x.a && i < x.b);
  if (!s) return `bit ${i}`;
  if (raw[i] === -1) return `the stuff bit in the ${s.f === "DATA" ? "data field" : s.f}`;
  let k = 0;
  for (let j = s.a; j < i; j++) if ((raw[j] ?? 0) >= 0) k++;
  if (s.f === "ID") return `ID bit ${10 - k}`;
  if (s.f === "DLC") return `DLC bit ${3 - k}`;
  if (s.f === "DATA") { const n = segs.filter((x) => x.f === "DATA").indexOf(s); return `data byte ${n} bit ${7 - k}`; }
  if (s.f === "CRC") return `CRC bit ${14 - k}`;
  return { SOF: "SOF", RTR: "the RTR bit", IDE: "the IDE bit", R0: "r0", CDEL: "the CRC delimiter", ACK: "the ACK slot", ADEL: "the ACK delimiter", EOF: "EOF", FLAG: "the error flag", EDEL: "the error delimiter", IFS: "the intermission" }[s.f] ?? s.f;
}

/* ---------------- node and front state ---------------- */

export type NodeState = "active" | "passive" | "off";
interface Pend { id: number; rtr: boolean; dlc: number; data: number[]; readyAt: number; tries: number; lost: number; mb: number; reply?: boolean }
export interface Node { key: NodeKey; tec: number; rec: number; state: NodeState; recoverAt: number | null; pend: Pend[]; txOk: number; lost: number; errs: number; rx: number; seen: Record<string, number[]> }
const newNode = (key: NodeKey): Node => ({ key, tec: 0, rec: 0, state: "active", recoverAt: null, pend: [], txOk: 0, lost: 0, errs: 0, rx: 0, seen: {} });

export type Mode = "normal" | "loopback" | "silent" | "silentLoop";
export interface CanCfg { init: boolean; started: boolean; presc: number; bs1: number; bs2: number; sjw: number; mode: Mode; abom: boolean; nart: boolean }
interface Filt { bank: number; mode: 0 | 1; scale: 0 | 1; idH: number; idL: number; mH: number; mL: number; fifo: 0 | 1; on: boolean }
interface Rx { at: number; frame: CanFrame; fmi: number }

export type ErrKind = "bit" | "stuff" | "ack" | "collision";
export interface FrameErr { at: number; kind: ErrKind; by: NodeKey[]; text: string; active: boolean; destroyed: boolean; flagEnd: number }
export interface FrameRec {
  id: number; t0: number; bt: number; t1: number; from: NodeKey; frame: CanFrame; retry: number; reply: boolean;
  contenders: Array<{ node: NodeKey; id: number; rtr: boolean; lostAt: number | null }>;
  bits: number[]; tx: Record<NodeKey, number[] | null>; segs: Seg[]; raw: number[]; stuff: number[]; arbEnd: number; ackAt: number;
  acked: boolean; ackBy: NodeKey[]; rxBy: NodeKey[]; err: FrameErr | null; tau: number; after: Record<NodeKey, { tec: number; rec: number; state: NodeState }>;
}
export interface BusEvent { t: number; text: string; tone: "ok" | "bad" | "warn" }

export interface Front {
  p: P32; a: Node; b: Node; c: Node; cfg: CanCfg; filters: Filt[]; fifo: [Rx[], Rx[]]; notif: number; errorCode: number;
  frames: FrameRec[]; events: BusEvent[]; nextId: number; busFree: number; lastA: number | null; syncAt: number | null; nextCycle: number;
  injectA: number; trimmed: boolean; notStarted: number; dropped: number; overrun: number; filtered: number; powered: { b: boolean; c: boolean }; aBusOffs: number; recoveries: number;
}
const FRONT = new WeakMap<Mcu, Front>();
const freshCfg = (): CanCfg => ({ init: false, started: false, presc: 6, bs1: 11, bs2: 2, sjw: 1, mode: "normal", abom: false, nart: false });
export function front(m: Mcu): Front {
  let f = FRONT.get(m);
  if (!f) {
    f = { p: P32_DEFAULT, a: newNode("A"), b: newNode("B"), c: newNode("C"), cfg: freshCfg(), filters: [], fifo: [[], []], notif: 0, errorCode: 0, frames: [], events: [], nextId: 1, busFree: 0, lastA: null, syncAt: null, nextCycle: CYCLE, injectA: 0, trimmed: false, notStarted: 0, dropped: 0, overrun: 0, filtered: 0, powered: { b: true, c: true }, aBusOffs: 0, recoveries: 0 };
    FRONT.set(m, f);
  }
  return f;
}
export const nodes = (f: Front): Node[] => [f.a, f.b, f.c];
export const nodeOf = (f: Front, k: NodeKey) => (k === "A" ? f.a : k === "B" ? f.b : f.c);
export const rateA = (c: CanCfg) => PCLK1 / (c.presc * (1 + c.bs1 + c.bs2));
export const sampleA = (c: CanCfg) => (1 + c.bs1) / (1 + c.bs1 + c.bs2);
export const SAMPLE_NET = 0.875;
export const netRate = (p: P32) => p.netKbps * 1000;
export const mismatch = (f: Front) => f.cfg.init && Math.abs(rateA(f.cfg) / netRate(f.p) - 1) > 0.01;

export function clearLog(m: Mcu) { const f = front(m); f.frames = []; f.events = []; f.trimmed = false; for (const n of nodes(f)) { n.txOk = 0; n.lost = 0; n.errs = 0; n.rx = 0; } }
export function injectBitError(m: Mcu, n = 1) { front(m).injectA += n; m.log("fault", n === 1 ? "Bit error armed for ECU A's next frame" : `Bit errors armed for ECU A's next ${n} frames`); }

function event(f: Front, t: number, text: string, tone: BusEvent["tone"]) {
  f.events.push({ t, text, tone });
  if (f.events.length > 200) f.events.splice(0, f.events.length - 200);
}

/** Which nodes take part in bus traffic (drive ACK, error flags and their own frames). */
function onBus(f: Front, n: Node): boolean {
  if (n.state === "off") return false;
  if (n.key === "A") return f.cfg.started && f.cfg.mode !== "silentLoop";
  return n.key === "B" ? f.p.b : f.p.c;
}
const canTransmit = (f: Front, n: Node) => onBus(f, n) && !(n.key === "A" && f.cfg.mode === "silent");
const listens = (f: Front, n: Node) => onBus(f, n) && !(n.key === "A" && f.cfg.mode === "loopback");
const rateOf = (f: Front, k: NodeKey) => (k === "A" ? rateA(f.cfg) : netRate(f.p));
const goodReceiver = (f: Front, k: NodeKey, from: NodeKey) => Math.abs(rateOf(f, k) / rateOf(f, from) - 1) <= 0.01;

function setState(f: Front, n: Node, t: number) {
  const before = n.state;
  if (n.state === "off") return;
  if (n.tec > 255) {
    n.state = "off";
    n.pend.forEach((x) => { x.readyAt = Math.max(x.readyAt, t); });
    if (n.key === "A") { f.errorCode |= ERR.BOF; f.aBusOffs++; }
    const auto = n.key !== "A" || f.cfg.abom;
    n.recoverAt = auto ? t + 128 * 11 / rateOf(f, n.key) : null;
    event(f, t, `${NODE_NAME[n.key]} is bus-off (TEC ${n.tec} > 255): it disconnects from the bus${auto ? ` and rejoins after 128 × 11 recessive bits (${fmtT(128 * 11 / rateOf(f, n.key))})` : "; with AutoBusOff = DISABLE only the firmware can restart it"}`, "bad");
    return;
  }
  n.state = n.tec > 127 || n.rec > 127 ? "passive" : "active";
  if (n.key === "A") { if (n.tec >= 96 || n.rec >= 96) f.errorCode |= ERR.EWG; if (n.state === "passive") f.errorCode |= ERR.EPV; }
  if (before !== n.state) event(f, t, n.state === "passive" ? `${NODE_NAME[n.key]} is error passive (TEC ${n.tec}, REC ${n.rec} > 127): its error flags are now recessive` : `${NODE_NAME[n.key]} is error active again (TEC ${n.tec}, REC ${n.rec})`, n.state === "passive" ? "warn" : "ok");
}

function recover(f: Front, t: number) {
  for (const n of nodes(f)) {
    if (n.state !== "off" || n.recoverAt === null || n.recoverAt > t) continue;
    n.state = "active"; n.tec = 0; n.rec = 0; n.recoverAt = null;
    if (n.key === "A") f.recoveries++;
    event(f, t, `${NODE_NAME[n.key]} left bus-off after 128 × 11 recessive bits: TEC = REC = 0, error active`, "ok");
  }
}

/* ---------------- ECU B / C schedule ---------------- */

function brakeFrame(p: P32, n: number): CanFrame { return { id: NODE_ID.B, rtr: false, dlc: 2, data: [Math.round(p.brake) & 0xff, n & 0xff] }; }
function dashFrame(p: P32, n: number): CanFrame { return { id: NODE_ID.C, rtr: false, dlc: 4, data: [Math.round(p.speed) & 0xff, 72, 0, n & 0xff] }; }
function queue(n: Node, fr: CanFrame, at: number, reply = false) {
  if (n.pend.length >= 6) n.pend.shift();
  n.pend.push({ ...fr, readyAt: at, tries: 0, lost: 0, mb: -1, reply });
}

/**
 * ECU B and C run a 100 ms cycle. Once ECU A transmits on a steady 100 ms period they lock their cycle to it,
 * so every cycle ECU C's dashboard frame holds the bus while ECU B and ECU A both queue a frame: arbitration decides.
 */
function schedule(f: Front, tEnd: number) {
  const bt = 1 / netRate(f.p);
  for (let guard = 0; guard < 50; guard++) {
    let N = f.nextCycle;
    if (f.syncAt !== null && Math.abs(f.syncAt + CYCLE - N) < CYCLE / 2) N = f.syncAt + CYCLE;
    if (N - 40 * bt > tEnd) return;
    const k = Math.round(N / CYCLE);
    if (f.p.c && f.c.state !== "off") queue(f.c, dashFrame(f.p, k), N - 40 * bt);
    if (f.p.b && f.b.state !== "off") queue(f.b, brakeFrame(f.p, k), N);
    f.nextCycle = N + CYCLE;
  }
}

/* ---------------- bus engine ---------------- */

const effReady = (n: Node, x: Pend) => (n.state === "off" ? (n.recoverAt === null ? Infinity : Math.max(x.readyAt, n.recoverAt)) : x.readyAt);

function best(n: Node, t: number): Pend | null {
  let out: Pend | null = null;
  for (const x of n.pend) if (effReady(n, x) <= t + 1e-12 && (!out || x.id < out.id || (x.id === out.id && !x.rtr && out.rtr))) out = x;
  return out;
}

export function advance(m: Mcu, f: Front, tEnd: number) {
  schedule(f, tEnd);
  for (let guard = 0; guard < 400; guard++) {
    let tMin = Infinity;
    for (const n of nodes(f)) {
      if (n.key !== "A" ? !(n.key === "B" ? f.p.b : f.p.c) : !f.cfg.started || f.cfg.mode === "silent") continue;
      for (const x of n.pend) tMin = Math.min(tMin, effReady(n, x));
    }
    if (!Number.isFinite(tMin)) break;
    const tStart = Math.max(f.busFree, tMin);
    if (tStart > tEnd) break;
    recover(f, tStart);
    const cs: Array<{ n: Node; x: Pend }> = [];
    for (const n of nodes(f)) { if (!canTransmit(f, n)) continue; const x = best(n, tStart); if (x) cs.push({ n, x }); }
    if (!cs.length) break;
    runFrame(m, f, cs, tStart);
  }
  recover(f, tEnd);
}

const BIT_ERR_TEXT = (who: string, where: string) => `${who} sent a recessive bit at ${where} but read it back dominant: bit error`;

function runFrame(m: Mcu, f: Front, cs: Array<{ n: Node; x: Pend }>, t0: number) {
  const encs = cs.map((c) => encode(c.x));
  let active = cs.map((_, i) => i);
  const lostAt: Array<number | null> = cs.map(() => null);
  const arbEnd = encs[0]!.arbEnd;
  // Wired-AND arbitration: dominant (0) overwrites recessive (1); a node that reads 0 after sending 1 drops out.
  for (let i = 0; i < arbEnd && active.length > 1; i++) {
    const bus = Math.min(...active.map((j) => encs[j]!.bits[i]!));
    const keep = active.filter((j) => encs[j]!.bits[i] === bus);
    for (const j of active) if (!keep.includes(j)) lostAt[j] = i;
    active = keep;
  }
  // Nodes with the same identifier stay on the bus together; the one that keeps sending dominant bits survives a collision.
  active.sort((x, y) => { const a = encs[x]!.bits, b = encs[y]!.bits; for (let i = arbEnd; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i]! - b[i]!; return 0; });
  const w = active[0]!;
  const win = cs[w]!, enc = encs[w]!;
  const from = win.n.key;
  const bt = 1 / rateOf(f, from);
  const sp = from === "A" ? sampleA(f.cfg) : SAMPLE_NET;
  const tau = tauRec(f.p.term);
  const peers = nodes(f).filter((n) => n.key !== from && onBus(f, n));
  const loop = from === "A" && (f.cfg.mode === "loopback");

  // Earliest error event.
  let err: { at: number; kind: ErrKind; by: NodeKey[]; text: string } | null = null;
  const consider = (e: NonNullable<typeof err>) => { if (!err || e.at < err.at) err = e; };
  let co: number[] = [];
  if (active.length > 1) {
    co = active.slice(1);
    const len = Math.min(...active.map((j) => encs[j]!.ackAt));
    for (let i = arbEnd; i < len; i++) {
      const vals = active.map((j) => encs[j]!.bits[i]!);
      if (vals.every((v) => v === vals[0])) continue;
      const rec = active.filter((j) => encs[j]!.bits[i] === 1).map((j) => cs[j]!.n.key);
      consider({ at: i, kind: "collision", by: rec, text: `${active.map((j) => NODE_NAME[cs[j]!.n.key]).join(" and ")} both won arbitration with ${hex3(win.x.id)} and differ at ${posName(enc.segs, enc.raw, i)}: ${rec.map((k) => NODE_NAME[k]).join(", ")} read dominant where ${rec.length > 1 ? "they" : "it"} sent recessive (bit error)` });
      break;
    }
  }
  if (from === "A" && f.injectA > 0) {
    f.injectA--;
    let i = enc.segs.find((s) => s.f === "DLC")!.a;
    while (i < enc.ackAt && enc.bits[i] !== 1) i++;
    if (i < enc.ackAt) consider({ at: i, kind: "bit", by: ["A"], text: `Injected disturbance: ${BIT_ERR_TEXT("ECU A", posName(enc.segs, enc.raw, i))}` });
  }
  if (recessiveLate(f.p.term, sp * bt)) {
    for (let i = Math.max(1, arbEnd); i < enc.ackAt; i++) {
      if (enc.bits[i] === 1 && enc.bits[i - 1] === 0) { consider({ at: i, kind: "bit", by: [from], text: `No termination: the bus needs ${fmtT(0.8 * tau)} to fall back to recessive, longer than the ${fmtT(sp * bt)} sample point. ${BIT_ERR_TEXT(NODE_NAME[from], posName(enc.segs, enc.raw, i))}` }); break; }
    }
  }
  const garbled = peers.filter((n) => listens(f, n) && !goodReceiver(f, n.key, from));
  if (garbled.length) consider({ at: Math.min(7, enc.ackAt - 1), kind: "stuff", by: garbled.map((n) => n.key), text: from === "A" ? `ECU A transmits at ${fmtRate(rateOf(f, "A"))} on a ${fmtRate(netRate(f.p))} network: ${garbled.map((n) => NODE_NAME[n.key]).join(" and ")} sample garbage and see six equal bits (stuff error)` : `ECU A listens at ${fmtRate(rateOf(f, "A"))} but ${NODE_NAME[from]} sends at ${fmtRate(netRate(f.p))}: ECU A samples garbage and sees six equal bits (stuff error)` });

  let e = err as { at: number; kind: ErrKind; by: NodeKey[]; text: string } | null;
  // Error-passive receivers only send recessive flags: the frame survives for everybody else.
  let passiveRx: NodeKey[] = [];
  if (e && e.kind === "stuff" && e.by.every((k) => nodeOf(f, k).state === "passive")) { passiveRx = e.by; e = null; }
  // Error-passive co-transmitters drop out with a recessive flag; the dominant sender carries on.
  let passiveCo: NodeKey[] = [];
  if (e && e.kind === "collision" && e.by.every((k) => nodeOf(f, k).state === "passive")) { passiveCo = e.by; e = null; }

  const ackers = peers.filter((n) => listens(f, n) && goodReceiver(f, n.key, from) && !passiveRx.includes(n.key) && !(e && e.at < enc.ackAt)).map((n) => n.key);
  if (!e && !ackers.length && !loop) e = { at: enc.ackAt, kind: "ack", by: [from], text: `Nobody acknowledged ${hex3(win.x.id)}: no other node ${peers.length ? "received it correctly" : "is on the bus"}, so the ACK slot stayed recessive (ACK error)` };

  const after = () => ({ A: snap(f.a), B: snap(f.b), C: snap(f.c) });
  const txKeys = (e && e.kind === "collision" ? active : [w, ...(passiveCo.length ? [] : co)]).map((j) => cs[j]!.n.key);
  let bits: number[];
  const tx: Record<NodeKey, number[] | null> = { A: null, B: null, C: null };
  let fe: FrameErr | null = null;
  const end = e ? e.at + 1 : enc.bits.length;
  bits = enc.bits.slice(0, end);
  for (let i = 0; i < Math.min(arbEnd, end); i++) bits[i] = Math.min(...cs.map((_, j) => (lostAt[j] === null || lostAt[j]! >= i ? encs[j]!.bits[i]! : 1)));
  for (const j of active) for (let i = arbEnd; i < end; i++) bits[i] = Math.min(bits[i]!, encs[j]!.bits[i] ?? 1);

  const flaggers = new Set<NodeKey>();
  if (e) {
    const at = e.at;
    if (e.kind === "bit" && e.text.startsWith("Injected")) bits[at] = 0;
    const actives = [...txKeys, ...peers.map((n) => n.key)].filter((k, i, a) => a.indexOf(k) === i && nodeOf(f, k).state === "active");
    for (const k of e.by) if (nodeOf(f, k).state === "active") flaggers.add(k);
    const others = actives.filter((k) => !flaggers.has(k));
    // The first active error flag violates bit stuffing, so the other active nodes answer with their own flag (6..12 dominant bits).
    const dominant = actives.length > 0;
    const flagLen = flaggers.size && others.length ? 12 : 6;
    for (let i = 0; i < flagLen; i++) bits.push(dominant ? 0 : 1);
    for (let i = 0; i < 8; i++) bits.push(1);
    fe = { at, kind: e.kind, by: e.by, text: e.text, active: dominant, destroyed: true, flagEnd: at + 1 + flagLen };
    // Fault confinement (ISO 11898-1): transmitters +8, the receiver that flagged first +8, other receivers +1.
    for (const k of txKeys) {
      const n = nodeOf(f, k);
      const ackExempt = e.kind === "ack" && n.state === "passive";
      if (!ackExempt) n.tec += 8;
      n.errs++;
      if (k === "A") f.errorCode |= e.kind === "ack" ? ERR.ACK : e.kind === "stuff" ? ERR.STF : ERR.BR;
    }
    let first = true;
    for (const n of peers) {
      if (txKeys.includes(n.key)) continue;
      const flaggedFirst = e.by.includes(n.key) && first && n.state === "active";
      if (flaggedFirst) first = false;
      n.rec += flaggedFirst ? 8 : 1;
      n.errs++;
      if (n.key === "A") f.errorCode |= ERR.STF;
    }
  } else {
    bits[enc.ackAt] = ackers.length ? 0 : 1;
  }
  for (let i = 0; i < 3; i++) bits.push(1);

  const segs = enc.segs.filter((s) => s.a < end);
  if (fe) {
    const last = segs[segs.length - 1];
    if (last) segs[segs.length - 1] = { ...last, b: Math.min(last.b, end) };
    segs.push({ f: "FLAG", a: end, b: fe.flagEnd, label: fe.active ? "error flag" : "passive flag" });
    segs.push({ f: "EDEL", a: fe.flagEnd, b: fe.flagEnd + 8, label: "delimiter" });
  }
  segs.push({ f: "IFS", a: bits.length - 3, b: bits.length, label: "IFS" });

  for (let j = 0; j < cs.length; j++) {
    const k = cs[j]!.n.key;
    const own = encs[j]!.bits;
    const stop = lostAt[j] !== null ? lostAt[j]! + 1 : end;
    tx[k] = bits.map((_, i) => (i < stop ? (own[i] ?? 1) : 1));
  }
  for (const n of nodes(f)) {
    if (!onBus(f, n)) continue;
    const lane = tx[n.key] ?? bits.map(() => 1);
    if (!fe && ackers.includes(n.key)) lane[enc.ackAt] = 0;
    if (fe && fe.active && n.state === "active") {
      const a0 = flaggers.has(n.key) || !flaggers.size ? end : end + 6;
      for (let i = a0; i < Math.min(a0 + 6, fe.flagEnd); i++) lane[i] = 0;
    }
    tx[n.key] = lane;
  }

  const t1 = t0 + bits.length * bt;
  const rec: FrameRec = {
    id: f.nextId++, t0, bt, t1, from, frame: { id: win.x.id, rtr: win.x.rtr, dlc: win.x.dlc, data: win.x.data.slice(0, 8) }, retry: win.x.tries, reply: !!win.x.reply,
    contenders: cs.map((c, j) => ({ node: c.n.key, id: c.x.id, rtr: c.x.rtr, lostAt: lostAt[j]! })),
    bits, tx, segs, raw: enc.raw, stuff: enc.stuff.filter((i) => i < end), arbEnd, ackAt: enc.ackAt, acked: !fe && ackers.length > 0, ackBy: fe ? [] : ackers, rxBy: [], err: fe, tau, after: after(),
  };

  // Arbitration losers wait for the next idle bus (or give up with NART).
  for (let j = 0; j < cs.length; j++) {
    if (lostAt[j] === null) continue;
    const { n, x } = cs[j]!;
    n.lost++; x.lost++; x.tries++;
    if (n.key === "A" && f.cfg.nart) { n.pend.splice(n.pend.indexOf(x), 1); f.dropped++; f.errorCode |= ERR.ALST; }
  }
  const passiveWait = (n: Node) => (n.state === "passive" ? 8 * bt : 0);
  if (fe) {
    for (const k of txKeys) {
      const n = nodeOf(f, k);
      const x = cs.find((c) => c.n === n)!.x;
      x.tries++;
      x.readyAt = Math.max(x.readyAt, t1 + passiveWait(n));
      if (k === "A" && f.cfg.nart) { n.pend.splice(n.pend.indexOf(x), 1); f.dropped++; f.errorCode |= ERR.TERR; }
    }
  } else {
    const done = [w, ...co.filter((j) => !passiveCo.includes(cs[j]!.n.key))];
    for (const j of done) {
      const { n, x } = cs[j]!;
      n.pend.splice(n.pend.indexOf(x), 1);
      n.txOk++;
      if (n.tec > 0) n.tec--;
      for (const y of n.pend) y.readyAt = Math.max(y.readyAt, t1 + passiveWait(n));
    }
    for (const k of passiveCo) {
      const n = nodeOf(f, k);
      const x = cs.find((c) => c.n === n)!.x;
      n.tec += 8; n.errs++; x.tries++;
      x.readyAt = Math.max(x.readyAt, t1 + 8 * bt);
      if (k === "A") f.errorCode |= ERR.BR;
    }
    for (const k of passiveRx) { const n = nodeOf(f, k); n.rec += 1; n.errs++; if (k === "A") f.errorCode |= ERR.STF; }
    for (const k of ackers) {
      const n = nodeOf(f, k);
      if (n.rec > 127) n.rec = 120; else if (n.rec > 0) n.rec--;
      n.rx++;
      rec.rxBy.push(k);
      deliver(f, n, rec.frame, t1 - 3 * bt);
    }
    if (loop) deliver(f, f.a, rec.frame, t1 - 3 * bt);
    if (rec.frame.rtr) {
      const owner = (["B", "C"] as const).find((k) => NODE_ID[k] === rec.frame.id && ackers.includes(k));
      if (owner) queue(nodeOf(f, owner), owner === "B" ? brakeFrame(f.p, f.nextId) : dashFrame(f.p, f.nextId), t1, true);
    }
  }
  for (const n of nodes(f)) setState(f, n, t1);
  rec.after = after();
  f.busFree = t1;
  f.frames.push(rec);
  if (f.frames.length > 300) { f.frames.splice(0, f.frames.length - 300); f.trimmed = true; }
  void m;
}
const snap = (n: Node) => ({ tec: n.tec, rec: n.rec, state: n.state });

function accept(f: Front, fr: CanFrame): { fifo: 0 | 1; fmi: number } | null {
  const reg32 = ((fr.id << 21) | (fr.rtr ? 2 : 0)) >>> 0;
  const reg16 = (fr.id << 5) | (fr.rtr ? 0x10 : 0);
  let fmi = 0;
  for (const x of [...f.filters].sort((a, b) => a.bank - b.bank)) {
    if (!x.on) { fmi += x.scale ? (x.mode ? 2 : 1) : x.mode ? 4 : 2; continue; }
    if (x.scale === 1) {
      const id = ((x.idH << 16) | x.idL) >>> 0, mk = ((x.mH << 16) | x.mL) >>> 0;
      if (x.mode === 0) { if ((((reg32 ^ id) & mk) >>> 0) === 0) return { fifo: x.fifo, fmi }; fmi++; }
      else { if (reg32 === id) return { fifo: x.fifo, fmi }; if (reg32 === mk) return { fifo: x.fifo, fmi: fmi + 1 }; fmi += 2; }
    } else if (x.mode === 0) {
      if (((reg16 ^ x.idL) & x.mL & 0xffff) === 0) return { fifo: x.fifo, fmi };
      if (((reg16 ^ x.idH) & x.mH & 0xffff) === 0) return { fifo: x.fifo, fmi: fmi + 1 };
      fmi += 2;
    } else {
      const ids = [x.idL, x.mL, x.idH, x.mH];
      const k = ids.findIndex((v) => (v & 0xffff) === reg16);
      if (k >= 0) return { fifo: x.fifo, fmi: fmi + k };
      fmi += 4;
    }
  }
  return null;
}

function deliver(f: Front, n: Node, fr: CanFrame, at: number) {
  n.seen[hex3(fr.id)] = fr.rtr ? [] : fr.data.slice(0, fr.dlc);
  if (n.key !== "A") return;
  const hit = accept(f, fr);
  if (!hit) { f.filtered++; return; }
  const q = f.fifo[hit.fifo];
  if (q.length >= 3) { f.overrun++; f.errorCode |= hit.fifo ? ERR.FOV1 : ERR.FOV0; return; }
  q.push({ at, frame: fr, fmi: hit.fmi });
}

/* ---------------- HAL binding ---------------- */

const refOf = (v: Val | undefined) => (v && typeof v === "object" && v.kind === "ref" ? v : null);
const refName = (v: Val | undefined) => (typeof v === "string" ? v : refOf(v)?.name ?? "");
const visible = (f: Front, fifo: 0 | 1, now: number) => f.fifo[fifo].filter((r) => r.at <= now).length;

const hook: CallHook = (name, args, m) => {
  if (!name.startsWith("HAL_CAN_")) return undefined;
  const f = front(m);
  const fw = m.fw;
  const n = (i: number) => toNum(args[i] ?? 0);
  const now = m.now;
  const fld = (base: string, k: string) => fw?.field(`${base}.${k}`) ?? 0;
  switch (name) {
    case "HAL_CAN_Init": {
      const h = refName(args[0]) || "hcan1";
      const presc = fld(h, "Init.Prescaler");
      if (presc < 1 || presc > 1024) { m.log("fault", `HAL_CAN_Init: Prescaler ${presc} is outside 1..1024`); f.cfg.init = false; return 1; }
      const mode = fld(h, "Init.Mode") >>> 0;
      f.cfg = {
        init: true, started: false, presc, bs1: ((fld(h, "Init.TimeSeg1") >>> 16) & 15) + 1, bs2: ((fld(h, "Init.TimeSeg2") >>> 20) & 7) + 1, sjw: ((fld(h, "Init.SyncJumpWidth") >>> 24) & 3) + 1,
        mode: mode === 0x40000000 ? "loopback" : mode === 0x80000000 ? "silent" : mode === 0xc0000000 ? "silentLoop" : "normal", abom: fld(h, "Init.AutoBusOff") !== 0, nart: fld(h, "Init.AutoRetransmission") === 0,
      };
      f.a.pend = [];
      m.log("info", `CAN1 ready: ${fmtRate(rateA(f.cfg))} (${f.cfg.presc} × ${1 + f.cfg.bs1 + f.cfg.bs2} tq, sample point ${(sampleA(f.cfg) * 100).toFixed(1)} %), ${f.cfg.mode} mode`);
      return 0;
    }
    case "HAL_CAN_DeInit": f.cfg = freshCfg(); return 0;
    case "HAL_CAN_ConfigFilter": {
      const b = refName(args[1]);
      const x: Filt = { bank: fld(b, "FilterBank") & 27, mode: fld(b, "FilterMode") ? 1 : 0, scale: fld(b, "FilterScale") ? 1 : 0, idH: fld(b, "FilterIdHigh") & 0xffff, idL: fld(b, "FilterIdLow") & 0xffff, mH: fld(b, "FilterMaskIdHigh") & 0xffff, mL: fld(b, "FilterMaskIdLow") & 0xffff, fifo: fld(b, "FilterFIFOAssignment") ? 1 : 0, on: fld(b, "FilterActivation") !== 0 };
      f.filters = [...f.filters.filter((y) => y.bank !== x.bank), x];
      return 0;
    }
    case "HAL_CAN_Start": {
      if (!f.cfg.init) { f.errorCode |= ERR.NOT_INIT; return 1; }
      if (f.cfg.started) return 1;
      f.cfg.started = true;
      if (f.a.state === "off") { f.a.recoverAt = now + 128 * 11 / rateA(f.cfg); event(f, now, "HAL_CAN_Start: ECU A waits for 128 × 11 recessive bits to leave bus-off", "warn"); }
      return 0;
    }
    case "HAL_CAN_Stop": if (!f.cfg.started) return 1; advance(m, f, now); f.cfg.started = false; return 0;
    case "HAL_CAN_AddTxMessage": {
      if (!f.cfg.started) { f.notStarted++; f.errorCode |= f.cfg.init ? ERR.NOT_STARTED : ERR.NOT_INIT; return 1; }
      advance(m, f, now);
      const h = refName(args[1]);
      if (fld(h, "IDE") === 4) { m.log("fault", "Extended (29-bit) identifiers are not covered in this lab: use CAN_ID_STD"); f.errorCode |= ERR.PARAM; return 1; }
      const used = new Set(f.a.pend.map((x) => x.mb));
      const mb = [0, 1, 2].find((k) => !used.has(k));
      if (mb === undefined) { f.errorCode |= ERR.PARAM; return 1; }
      const dlc = Math.min(15, Math.max(0, fld(h, "DLC")));
      const fr: CanFrame = { id: fld(h, "StdId") & 0x7ff, rtr: fld(h, "RTR") === 2, dlc, data: readBytes(args[2], Math.min(8, dlc)) };
      while (fr.data.length < 8) fr.data.push(0);
      if (f.cfg.mode === "silentLoop") deliver(f, f.a, fr, now + (encode(fr).bits.length + 3) / rateA(f.cfg));
      else f.a.pend.push({ ...fr, readyAt: now, tries: 0, lost: 0, mb });
      const r = refOf(args[3]);
      if (r) r.ref.set(1 << mb);
      if (f.lastA !== null && Math.abs(now - f.lastA - CYCLE) < CYCLE * 0.2) f.syncAt = now;
      f.lastA = now;
      return 0;
    }
    case "HAL_CAN_AbortTxRequest": { const mask = n(1); f.a.pend = f.a.pend.filter((x) => !((1 << x.mb) & mask)); return 0; }
    case "HAL_CAN_GetTxMailboxesFreeLevel": advance(m, f, now); return 3 - f.a.pend.length;
    case "HAL_CAN_IsTxMessagePending": { advance(m, f, now); const mask = n(1); return f.a.pend.some((x) => (1 << x.mb) & mask) ? 1 : 0; }
    case "HAL_CAN_GetRxFifoFillLevel": advance(m, f, now); return visible(f, n(1) ? 1 : 0, now);
    case "HAL_CAN_GetRxMessage": {
      advance(m, f, now);
      const q = f.fifo[n(1) ? 1 : 0];
      const i = q.findIndex((r) => r.at <= now);
      if (i < 0) { f.errorCode |= ERR.PARAM; return 1; }
      const r = q.splice(i, 1)[0]!;
      const h = refName(args[2]);
      if (fw && h) {
        fw.setField(`${h}.StdId`, r.frame.id); fw.setField(`${h}.ExtId`, 0); fw.setField(`${h}.IDE`, 0); fw.setField(`${h}.RTR`, r.frame.rtr ? 2 : 0);
        fw.setField(`${h}.DLC`, r.frame.dlc); fw.setField(`${h}.FilterMatchIndex`, r.fmi); fw.setField(`${h}.Timestamp`, Math.floor(r.at * 1e6) & 0xffff);
      }
      writeBytes(args[3], r.frame.rtr ? [] : r.frame.data.slice(0, Math.min(8, r.frame.dlc)));
      return 0;
    }
    case "HAL_CAN_ActivateNotification": f.notif |= n(1); return 0;
    case "HAL_CAN_DeactivateNotification": f.notif &= ~n(1); return 0;
    case "HAL_CAN_GetError": advance(m, f, now); return f.errorCode;
    case "HAL_CAN_ResetError": f.errorCode = 0; return 0;
    case "HAL_CAN_GetState": return !f.cfg.init ? 0 : f.cfg.started ? 2 : 1;
    case "HAL_CAN_IRQHandler": return 0;
  }
  return undefined;
};

export function mcu32(): McuOptions {
  return { family: "stm32", constants: CAN_CONST, onCall: hook };
}

export function world32(m: Mcu, dt: number, p: P32) {
  const f = front(m);
  f.p = p;
  for (const k of ["b", "c"] as const) {
    if (f.powered[k] === p[k]) continue;
    f.powered[k] = p[k];
    const node = k === "b" ? f.b : f.c;
    Object.assign(node, newNode(node.key));
    event(f, m.now, `${NODE_NAME[node.key]} ${p[k] ? "powered up: error counters start at 0" : "powered down: it no longer ACKs or transmits"}`, p[k] ? "ok" : "warn");
  }
  if (!m.fw) return;
  advance(m, f, m.now);
  const fw = m.fw;
  const cb = (fifo: 0 | 1) => (fifo ? "HAL_CAN_RxFifo1MsgPendingCallback" : "HAL_CAN_RxFifo0MsgPendingCallback");
  for (const fifo of [0, 1] as const) {
    const it = fifo ? 0x10 : 0x2;
    if (!(f.notif & it) || !visible(f, fifo, m.now) || !fw.hasFunction(cb(fifo)) || !fw.globalIrqEnabled) continue;
    if (fw.threads.some((t) => t.kind === "isr" && t.name === cb(fifo) && t.state !== "done")) continue;
    fw.raise(cb(fifo), 0, [m.handle("hcan1")]);
  }
  void dt;
}

/* ---------------- decoding for the monitor ---------------- */

export function frameDesc(r: FrameRec): string {
  const who = NODE_NAME[r.from];
  const what = r.frame.rtr ? `remote request ${hex3(r.frame.id)}` : `${hex3(r.frame.id)} · ${r.frame.dlc} byte${r.frame.dlc === 1 ? "" : "s"}`;
  const losers = r.contenders.filter((c) => c.lostAt !== null);
  const arb = losers.length ? ` · won arbitration over ${losers.map((c) => `${NODE_NAME[c.node]} ${hex3(c.id)} (lost at ${posName(r.segs, r.raw, c.lostAt!)})`).join(", ")}` : "";
  if (r.err) return `${who} ${what}${arb}: ${r.err.text}`;
  const retry = r.retry ? ` · sent on attempt ${r.retry + 1}` : "";
  return `${who} ${r.reply ? "answers the remote request: " : ""}${what}${arb}${retry} · ACK by ${r.ackBy.map((k) => NODE_NAME[k]).join(", ") || "itself (loopback)"}`;
}

export function frameTokens(r: FrameRec): string {
  const out = [`SOF ${hex3(r.frame.id)} ${r.frame.rtr ? "RTR" : "D"} DLC${r.frame.dlc}`];
  if (!r.frame.rtr) out.push(r.frame.data.slice(0, r.frame.dlc).map(hex2).join(" ") || "-");
  if (r.err) out.push(`✕ ${r.err.kind === "collision" ? "BIT" : r.err.kind.toUpperCase()} ERR`);
  else out.push(r.acked ? "ACK EOF" : "EOF");
  return out.join(" | ");
}

export interface MonLine { key: string; id: number | null; t: number; text: string; frame: string; tone: "ok" | "bad" | "warn" | "arb" | "info"; from: NodeKey | null }
export function monitor(f: Front, limit = 140): MonLine[] {
  const out: MonLine[] = [];
  for (const r of f.frames) out.push({ key: `f${r.id}`, id: r.id, t: r.t0, text: frameDesc(r), frame: frameTokens(r), tone: r.err ? "bad" : r.contenders.length > 1 ? "arb" : r.retry ? "warn" : "ok", from: r.from });
  const t0 = f.frames[0]?.t0 ?? 0;
  for (const [i, e] of f.events.entries()) if (!f.trimmed || e.t >= t0) out.push({ key: `e${i}:${e.t}`, id: null, t: e.t, text: e.text, frame: "", tone: e.tone === "ok" ? "info" : e.tone, from: null });
  out.sort((a, b) => a.t - b.t || (a.id === null ? 1 : 0) - (b.id === null ? 1 : 0));
  return out.slice(-limit);
}

export function busLoad(f: Front, now: number, window = 1): number {
  let busy = 0;
  for (const r of f.frames) if (r.t1 > now - window && r.t0 <= now) busy += Math.min(r.t1, now) - Math.max(r.t0, now - window);
  return Math.max(0, Math.min(1, busy / Math.min(window, Math.max(now, 1e-6))));
}
