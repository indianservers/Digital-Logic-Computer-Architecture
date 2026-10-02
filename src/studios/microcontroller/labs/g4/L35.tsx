import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useLab } from "../core/useLab";
import type { LabMeta } from "../registry";
import { CodeEditor } from "../ui/CodeEditor";
import { Icon } from "../ui/Icon";
import { LearningNotes, Panel, Toggle } from "../ui/Panels";
import { LabShell } from "../ui/Shell";
import {
  BUSES, clearLog, codeField, DEMO, DISPLAY, DISPLAY_KEYS, FMT_BAD, FMT_OK, frameStats, front, glyph, gpioTotal, hex2, isEightBit, LCD_INIT_LINE, mcu35, OLED_ADDR_OK, OLED_H, OLED_W, oledPixel,
  oledUpdateT, P35_DEFAULT, REDRAW_LINE, rgb565, segDigitHz, segGlow, segIsrCost, setCodeField, TFT_H, TFT_W, UPDATE_LINE, VARIANTS, world35,
  type DisplayKey, type FieldKey, type FrameStats, type Front, type P35,
} from "./L35sim";

const BUS_CONST: Record<DisplayKey, string[]> = { seg: ["SEG_DIRECT", "SEG_595"], lcd: ["LCD_4BIT", "LCD_8BIT", "LCD_I2C"], oled: ["OLED_I2C", "OLED_SPI"], tft: ["TFT_SPI", "TFT_8080"] };
const BUS_FIELD: Record<DisplayKey, FieldKey> = { seg: "segBus", lcd: "lcdBus", oled: "oledBus", tft: "tftBus" };
const BRIGHT = [10, 25, 50, 80, 100];
const REFRESH = [10, 15, 30, 60];
const FONTS = [8, 12, 16, 24];
const SCANS = [120, 250, 500, 1000, 2000];
const ADDRS = [0x3c, 0x3d, 0x78];
const USE_COLOR: Record<DisplayKey | "cpu", string> = { seg: DISPLAY.seg.color, lcd: DISPLAY.lcd.color, oled: DISPLAY.oled.color, tft: DISPLAY.tft.color, cpu: "#94a3b8" };
const FILL_LINE = "    oled_fill_rect(0, 54, (int)(temp * 2.5f), 8, 1);\n";
const OLED_INIT_LINE = "  oled_init(OLED_BUS, OLED_ADDR);\n";
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const fmtT = (s: number) => (s * 1e3 < 0.1 ? `${Math.round(s * 1e6)} µs` : `${(s * 1e3).toFixed(s * 1e3 < 10 ? 2 : 1)} ms`);
const fmtB = (b: number) => (b >= 10240 ? `${(b / 1024).toFixed(0)} KB` : b >= 1024 ? `${(b / 1024).toFixed(1)} KB` : `${b} B`);

/* ---------------- display renderers ---------------- */

const segH = (x1: number, x2: number, y: number) => `${x1},${y} ${x1 + 4},${y - 4} ${x2 - 4},${y - 4} ${x2},${y} ${x2 - 4},${y + 4} ${x1 + 4},${y + 4}`;
const segV = (x: number, y1: number, y2: number) => `${x},${y1} ${x + 4},${y1 + 4} ${x + 4},${y2 - 4} ${x},${y2} ${x - 4},${y2 - 4} ${x - 4},${y1 + 4}`;
const SEGS = [segH(9, 37, 6), segV(40, 8, 39), segV(40, 41, 72), segH(9, 37, 74), segV(6, 41, 72), segV(6, 8, 39), segH(9, 37, 40)];

function SegView({ f, on, now, p }: { f: Front; on: boolean; now: number; p: P35 }) {
  const s = f.seg;
  const glow = segGlow(s, now);
  const steady = segDigitHz(s.scanHz) >= 60;
  const duty = 0.3 + 0.7 * s.duty;
  const slowIdx = Math.floor(now * 3) % 4;
  const level = (i: number) => (!on || !s.init ? 0 : p.slowScan ? (i === slowIdx ? duty : 0) : (steady ? 1 : glow[i]!) * duty);
  const fill = (lit: boolean, k: number) => (lit && k > 0.02 ? `rgba(255,62,62,${k.toFixed(2)})` : "#2b1316");
  return (
    <svg viewBox="0 0 236 92" className="mcl-l35-seg" role="img" aria-label={on && s.init ? `7-segment display shows ${s.text || "nothing"}` : "7-segment display dark"}>
      <rect width={236} height={92} rx={5} fill="#0b0f14" />
      {s.digits.map((pat, i) => {
        const k = level(i);
        return (
          <g key={i} transform={`translate(${16 + i * 54},6) skewX(-6)`}>
            {SEGS.map((pts, b) => { const lit = ((pat >> b) & 1) === 1 && !(p.deadSeg && i === 2 && b === 6); return <polygon key={b} points={pts} fill={fill(lit, k)} className={lit && k > 0.55 ? "lit" : undefined} />; })}
            <circle cx={48} cy={74} r={3.3} fill={fill((pat & 0x80) !== 0, k)} className={pat & 0x80 && k > 0.55 ? "lit" : undefined} />
          </g>
        );
      })}
    </svg>
  );
}

const LW = 16 * 24 + 8, LH = 2 * 34 + 10;
function LcdCanvas({ rows, mode, contrast }: { rows: number[][]; mode: "off" | "boxes" | "text"; contrast: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const key = `${mode}:${contrast}:${rows.map((r) => r.join(",")).join("|")}`;
  useEffect(() => {
    const c = ref.current?.getContext("2d");
    if (!c) return;
    c.fillStyle = mode === "off" ? "#0a100c" : "#0e2215";
    c.fillRect(0, 0, LW, LH);
    if (mode === "off") return;
    const onA = clamp01((contrast - 10) / 30), offA = 0.07 + 0.9 * clamp01((contrast - 75) / 25);
    for (let r = 0; r < 2; r++) for (let col = 0; col < 16; col++) {
      const box = mode === "boxes" && r === 0;
      const g = mode === "boxes" ? null : glyph(rows[r]![col] ?? 0x20);
      for (let y = 0; y < 8; y++) for (let x = 0; x < 5; x++) {
        const lit = box || (!!g && y < 7 && ((g[y]! >> (4 - x)) & 1) === 1);
        c.fillStyle = `rgba(74,222,128,${(lit ? Math.max(box ? onA * 0.85 : onA, offA) : offA).toFixed(3)})`;
        c.fillRect(6 + col * 24 + x * 4, 6 + r * 34 + y * 4, 3.3, 3.3);
      }
    }
  }, [key]);
  return <canvas ref={ref} width={LW} height={LH} className="mcl-l35-cv" />;
}

function OledCanvas({ buf, ver, show, contrast }: { buf: Uint8Array; ver: number; show: boolean; contrast: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current?.getContext("2d");
    if (!c) return;
    const img = c.createImageData(OLED_W, OLED_H);
    const a = 0.3 + (0.7 * contrast) / 255;
    const on = [Math.round(4 + 116 * a), Math.round(7 + 193 * a), Math.round(12 + 243 * a)] as const;
    for (let y = 0; y < OLED_H; y++) for (let x = 0; x < OLED_W; x++) {
      const i = (y * OLED_W + x) * 4, lit = show && oledPixel(buf, x, y);
      img.data[i] = lit ? on[0] : 4; img.data[i + 1] = lit ? on[1] : 7; img.data[i + 2] = lit ? on[2] : 12; img.data[i + 3] = 255;
    }
    c.putImageData(img, 0, 0);
  }, [buf, ver, show, contrast]);
  return <canvas ref={ref} width={OLED_W} height={OLED_H} className="mcl-l35-cv mcl-l35-px" />;
}

function TftCanvas({ gram, ver, mode, backlight }: { gram: Uint16Array; ver: number; mode: "off" | "white" | "gram"; backlight: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current?.getContext("2d");
    if (!c) return;
    const img = c.createImageData(TFT_W, TFT_H);
    const k = mode === "off" ? 0 : 0.12 + 0.88 * (backlight / 100);
    const d = img.data;
    for (let i = 0; i < TFT_W * TFT_H; i++) {
      const [r, g, b] = mode === "gram" ? rgb565(gram[i]!) : [255, 255, 255];
      d[i * 4] = r * k; d[i * 4 + 1] = g * k; d[i * 4 + 2] = b * k; d[i * 4 + 3] = 255;
    }
    c.putImageData(img, 0, 0);
  }, [gram, ver, mode, backlight]);
  return <canvas ref={ref} width={TFT_W} height={TFT_H} className="mcl-l35-cv" />;
}

/* ---------------- framebuffer previews ---------------- */

function OledDiff({ o, ver, page }: { o: Front["oled"]; ver: number; page: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current?.getContext("2d");
    if (!c) return;
    c.fillStyle = "#0b1626"; c.fillRect(0, 0, 256, 128);
    c.fillStyle = "rgba(78,168,255,.09)"; c.fillRect(0, page * 16, 256, 16);
    for (let y = 0; y < OLED_H; y++) for (let x = 0; x < OLED_W; x++) {
      const a = oledPixel(o.fb, x, y), b = oledPixel(o.gddram, x, y);
      if (!a && !b) continue;
      c.fillStyle = a && b ? "#4ea8ff" : a ? "#f59e0b" : "#5b2130";
      c.fillRect(x * 2, y * 2, 2, 2);
    }
    c.strokeStyle = "rgba(148,163,184,.18)"; c.lineWidth = 1;
    for (let pg = 1; pg < 8; pg++) { c.beginPath(); c.moveTo(0, pg * 16 + 0.5); c.lineTo(256, pg * 16 + 0.5); c.stroke(); }
  }, [o.fb, o.gddram, ver, page]);
  return <canvas ref={ref} width={256} height={128} className="mcl-l35-cv mcl-l35-px mcl-l35-fb" />;
}

function TftRects({ f, st }: { f: Front; st: FrameStats | null }) {
  const rects = st ? f.tft.rects.filter((r) => r.t >= st.start - 1e-9 && r.t < st.end - 1e-9) : [];
  const total = rects.reduce((s, r) => s + r.bytes, 0);
  return (
    <svg viewBox={`0 0 ${TFT_W} ${TFT_H}`} className="mcl-l35-fb" role="img" aria-label={`${rects.length} rectangles sent to the TFT in the last frame, ${fmtB(total)}`}>
      <rect width={TFT_W} height={TFT_H} fill="#0b1626" />
      {Array.from({ length: 7 }, (_, i) => <line key={`v${i}`} x1={(i + 1) * 40} x2={(i + 1) * 40} y1={0} y2={TFT_H} stroke="#13233a" />)}
      {Array.from({ length: 5 }, (_, i) => <line key={`h${i}`} x1={0} x2={TFT_W} y1={(i + 1) * 40} y2={(i + 1) * 40} stroke="#13233a" />)}
      {rects.map((r, i) => {
        const [cr, cg, cb] = rgb565(r.color);
        const col = cr + cg + cb < 90 ? "#60a5fa" : `rgb(${cr},${cg},${cb})`;
        return <rect key={i} x={r.x + 0.5} y={r.y + 0.5} width={Math.max(1, r.w - 1)} height={Math.max(1, r.h - 1)} fill={col} fillOpacity={0.18} stroke={col} strokeWidth={1.4} strokeDasharray={r.w === TFT_W && r.h === TFT_H ? "6 4" : undefined} />;
      })}
      {!rects.length ? <text x={TFT_W / 2} y={TFT_H / 2} textAnchor="middle" fontSize={13} fill="#94a3b8">{st ? "Nothing sent to the TFT this frame" : "Press Run"}</text> : null}
      <text x={6} y={TFT_H - 8} fontSize={12} fill="#cbd5e1" fontFamily="ui-monospace, Consolas, monospace">{rects.length} window{rects.length === 1 ? "" : "s"} · {fmtB(total)} this frame</text>
    </svg>
  );
}

/* ---------------- lab ---------------- */

const NO_SEEN = { all: false, spi: false, neck: false, flicker: false, fix: false, fonts: false, lcd: false };
type Seen = typeof NO_SEEN;

export default function L35({ meta }: { meta: LabMeta }) {
  const lab = useLab<P35>({ slug: meta.slug, code: DEMO, params: P35_DEFAULT, mcu: mcu35, world: world35 });
  const { mcu, params: p } = lab;
  const fw = mcu.fw;
  const f = front(mcu);
  const now = mcu.now;
  const [pending, setPending] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [seen, setSeen] = useState<Seen>(NO_SEEN);
  const [failSeen, setFailSeen] = useState(false);
  const [page, setPage] = useState(3);
  const listRef = useRef<HTMLOListElement>(null);
  useEffect(() => { if (pending !== null && lab.code === pending) { setPending(null); lab.run(); } }, [pending, lab]);
  useEffect(() => { if (!msg) return; const id = window.setTimeout(() => setMsg(""), 4000); return () => window.clearTimeout(id); }, [msg]);

  const loadCode = (next: string) => { if (next === lab.code) { lab.run(); return; } lab.setCode(next); setPending(next); };
  const cf = (k: FieldKey) => codeField(lab.code, k);
  const edit = (k: FieldKey, v: string) => {
    if (cf(k) === null) { setMsg("This setting was not found in the code: edit the #define lines directly."); return; }
    const next = setCodeField(lab.code, k, v);
    if (next !== lab.code) loadCode(next);
  };
  const num = (k: FieldKey, d: number) => { const s = cf(k); if (s === null) return d; const x = Number(s); return Number.isFinite(x) ? x : d; };
  const opts = (list: number[], cur: number) => (list.includes(cur) ? list : [...list, cur].sort((a, b) => a - b));
  const bright = num("bright", 80), refresh = num("refresh", 30), font = num("font", 12), scan = num("scan", 1000), addr = num("addr", 0x3c);
  const codeBus = (d: DisplayKey) => Math.max(0, BUS_CONST[d].indexOf(cf(BUS_FIELD[d]) ?? ""));
  const liveBus = (d: DisplayKey) => (fw ? f[d].bus : codeBus(d));

  const st = fw ? frameStats(f) : null;
  const budget = Math.floor(1000 / Math.max(1, refresh)) / 1000;
  const overruns = fw ? fw.num("overruns", 0) : 0;
  const frames = fw ? fw.num("frame", 0) : 0;
  const running: Record<DisplayKey, boolean> = { seg: !!fw && f.seg.init, lcd: !!fw && f.lcd.init, oled: !!fw && f.oled.init && f.oled.updates > 0, tft: !!fw && f.tft.init };
  const nRun = DISPLAY_KEYS.filter((d) => running[d]).length;
  const digitHz = segDigitHz(f.seg.scanHz);
  const oledShow = !!fw && f.oled.init && !p.oledOff;
  const sel = p.sel;

  const hints: Array<{ text: string; tone?: "info"; fix?: Array<[string, () => void]> }> = [];
  if (!fw) hints.push({ text: "Press Run: the firmware initialises all four displays, then redraws the temperature on each of them every frame.", tone: "info" });
  if (fw && f.oled.init && !f.oled.updates && f.oled.lastDraw > 0 && frames >= 3 && !p.oledOff) hints.push({ text: "The OLED still shows random pixels: oled_draw_text() and oled_fill_rect() only change the 1 KB framebuffer in SRAM. Nothing reaches the SSD1306 until oled_update() sends it.", fix: [["Add oled_update()", () => loadCode(/oled_update\s*\(/.test(lab.code) || !lab.code.includes(FILL_LINE) ? DEMO : lab.code.replace(FILL_LINE, FILL_LINE + UPDATE_LINE))]] });
  if (fw && p.oledOff) hints.push({ text: f.oled.bus === 0 ? "The OLED is unplugged: every I²C transfer to it ends in a NACK, so the firmware wastes the address byte and the panel stays dark." : "The OLED is unplugged: SPI has no acknowledge, so the firmware keeps clocking 1 KB into nothing and cannot even tell the display is gone.", fix: [["Plug the OLED back in", () => lab.setParam("oledOff", false)]] });
  else if (fw && f.oled.nacks && !f.oled.init && f.oled.bus === 0 && !OLED_ADDR_OK.includes(f.oled.addr)) hints.push({ text: isEightBit(f.oled.addr) ? `OLED NACK at 0x${hex2(f.oled.addr)}: that is the 8-bit form (0x3C << 1) printed on some modules. HAL_I2C functions take the 7-bit address 0x3C and shift it themselves.` : `OLED NACK: nothing answers at 0x${hex2(f.oled.addr)}. The SSD1306 sits at 0x3C (0x3D with the address jumper moved).`, fix: [["OLED_ADDR = 0x3C", () => edit("addr", "0x3C")]] });
  else if (fw && !f.oled.init && frames >= 3) hints.push({ text: "The OLED was plugged back in, but it lost power: it is back in its reset state with the display switched off until oled_init() runs again.", fix: [["Restart the firmware", () => lab.run()]] });
  if (fw && !f.lcd.init && f.lcd.preInit > 0) hints.push({ text: "The LCD shows a row of black boxes: that is the HD44780's power-on state (8-bit, 1 line, no cursor). lcd_print() is ignored until lcd_init() has switched it to 4-bit, 2-line mode.", fix: [["Call lcd_init()", () => loadCode(/lcd_init\s*\(/.test(lab.code) || !lab.code.includes(OLED_INIT_LINE) ? DEMO : lab.code.replace(OLED_INIT_LINE, LCD_INIT_LINE + OLED_INIT_LINE))]] });
  if (fw && f.lcd.residue) hints.push({ text: `Leftover characters on the LCD: "${String.fromCharCode(...f.lcd.ddram[1]!).trimEnd()}". The text got shorter, and the HD44780 keeps whatever is in its DDRAM until it is overwritten. Print a fixed-width string (pad with spaces) instead of clearing every frame.`, fix: lab.code.includes(FMT_BAD) ? [["Use \"%5.1f\"", () => loadCode(lab.code.replace(FMT_BAD, FMT_OK))]] : undefined });
  if (p.contrast < 25) hints.push({ text: "The LCD text has vanished: the contrast pot (V0) is too far one way. The characters are still in DDRAM, the liquid crystal just does not twist enough to show them.", fix: [["Contrast to 55 %", () => lab.setParam("contrast", 55)]] });
  else if (p.contrast > 80) hints.push({ text: "Every LCD cell shows a dark box: V0 is so close to GND that unselected pixels turn dark too. This is the classic 'LCD shows only boxes' problem: turn the pot back.", fix: [["Contrast to 55 %", () => lab.setParam("contrast", 55)]] });
  if (fw && f.tft.fills > 1 && now - f.tft.lastFill < 1) hints.push({ text: `The TFT is cleared every frame: ${fmtB(TFT_W * TFT_H * 2)} on the bus (${fmtT(st?.byDisp.tft.time ?? 0)} per frame) and the screen goes black before the bar is drawn back, so it flickers. The TFT keeps its own GRAM: only redraw what changed.`, fix: lab.code.includes(REDRAW_LINE) ? [["Remove tft_fill_screen()", () => loadCode(lab.code.replace(REDRAW_LINE, ""))]] : undefined });
  if (fw && f.seg.init && digitHz < 60 && !p.slowScan) hints.push({ text: `The 7-segment display flickers: ${f.seg.scanHz} digit switches per second shared by 4 digits leaves each digit lit only ${digitHz.toFixed(0)} times a second. The eye needs about 60 Hz per digit.`, fix: [["SEG_SCAN_HZ = 1000", () => edit("scan", "1000")]] });
  if (fw && st && st.draw > budget + 1e-4 && overruns > 0) {
    const worst = (["oled", "tft", "lcd", "seg"] as DisplayKey[]).reduce((a, b) => (st.byDisp[b].time > st.byDisp[a].time ? b : a));
    const fix: Array<[string, () => void]> = [];
    if (worst === "oled" && f.oled.bus === 0) fix.push(["OLED on SPI", () => edit("oledBus", "OLED_SPI")]);
    if (worst === "lcd" && f.lcd.bus === 2) fix.push(["LCD on 4-bit", () => edit("lcdBus", "LCD_4BIT")]);
    if (refresh > 30) fix.push(["REFRESH_HZ = 30", () => edit("refresh", "30")]);
    const why = worst === "oled" && f.oled.bus === 0 ? `Sending 1 KB to the OLED at 400 kHz takes ${fmtT(oledUpdateT(0))}, SPI needs ${fmtT(oledUpdateT(1))}.` : worst === "tft" ? "Look at how many bytes go to the TFT each frame." : "";
    hints.push({ text: `Frame overrun: one frame takes ${fmtT(st.draw)} but REFRESH_HZ = ${refresh} leaves only ${fmtT(budget)}. The biggest cost is the ${DISPLAY[worst].name} (${fmtT(st.byDisp[worst].time)}). ${why}`, fix: fix.length ? fix : undefined });
  }
  if (fw && f.oled.clipped && oledShow) hints.push({ text: `At FONT_PX ${f.oled.font} the text runs past the 128 × 64 OLED and is cut off: each character is ${Math.round((6 * f.oled.font) / 8)} pixels wide.`, tone: "info", fix: font > 12 ? [["FONT_PX = 12", () => edit("font", "12")]] : undefined });
  const problems = hints.filter((x) => x.tone !== "info");

  useEffect(() => { if (problems.length) setFailSeen(true); }, [problems.length]);
  const allOk = nRun === 4;
  const flags: Seen = {
    all: allOk,
    spi: f.busesSeen.oled.includes(0) && f.busesSeen.oled.includes(1) && running.oled,
    neck: !!fw && refresh >= 60 && f.oled.bus === 0 && overruns > 0,
    flicker: (!!fw && f.seg.init && digitHz < 60) || (p.slowScan && running.seg),
    fix: failSeen && !problems.length && allOk,
    fonts: f.oled.fonts.length >= 3,
    lcd: f.busesSeen.lcd.includes(0) && f.busesSeen.lcd.includes(2) && running.lcd,
  };
  useEffect(() => {
    const ks = Object.keys(flags) as Array<keyof Seen>;
    if (ks.some((k) => flags[k] && !seen[k])) setSeen((o) => { const n = { ...o }; for (const k of ks) n[k] = o[k] || flags[k]; return n; });
  });

  const lines = f.log.slice(-60);
  const lastKey = `${lines.length}:${lines[lines.length - 1]?.id ?? 0}`;
  useEffect(() => { const el = listRef.current; if (el) el.scrollTop = el.scrollHeight; }, [lastKey]);

  const shellLab = { ...lab, resetLab: () => { lab.resetLab(); setPending(null); setSeen(NO_SEEN); setFailSeen(false); setPage(3); } };
  const custom = !VARIANTS.some((x) => x.code === lab.compiledCode);

  const tileTime = (d: DisplayKey) => (!st ? "–" : d === "seg" ? `${fmtT(st.byDisp.seg.time)} + ISR` : fmtT(st.byDisp[d].time));
  const tileState = (d: DisplayKey) => (!fw ? "off" : running[d] ? "ok" : d === "oled" && (f.oled.nacks || p.oledOff) ? "err" : d === "lcd" && f.lcd.preInit ? "err" : "wait");
  const key = (e: KeyboardEvent, d: DisplayKey) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); lab.setParam("sel", d); } };
  const screen: Record<DisplayKey, ReactNode> = {
    seg: <SegView f={f} on={!!fw} now={now} p={p} />,
    lcd: <LcdCanvas rows={f.lcd.ddram} mode={!fw ? "off" : f.lcd.init ? "text" : "boxes"} contrast={p.contrast} />,
    oled: <OledCanvas buf={f.oled.gddram} ver={f.oled.ver} show={oledShow} contrast={f.oled.contrast} />,
    tft: <TftCanvas gram={f.tft.gram} ver={f.tft.ver} mode={!fw ? "off" : f.tft.init ? "gram" : "white"} backlight={f.tft.backlight} />,
  };
  const tile = (d: DisplayKey) => {
    const bus = BUSES[d][liveBus(d)]!;
    const s = tileState(d);
    return (
      <div key={d} role="button" tabIndex={0} aria-pressed={sel === d} aria-label={`${DISPLAY[d].name}: ${bus.label}, ${bus.pins} pins. Select to inspect`} className={`mcl-l35-tile ${sel === d ? "on" : ""}`} style={{ ["--c" as string]: DISPLAY[d].color }} onClick={() => lab.setParam("sel", d)} onKeyDown={(e) => key(e, d)}>
        <header><b>{DISPLAY[d].name}</b><span className="mcl-l35-badge">{bus.short}</span><i className={s} title={s === "ok" ? "running" : s === "err" ? "fault" : s === "off" ? "stopped" : "starting"} /></header>
        <div className={`mcl-l35-screen ${d}`}>{screen[d]}</div>
        <footer><span>{bus.pins} pins</span><span>{tileTime(d)} / frame</span></footer>
      </div>
    );
  };

  const busNow = codeBus(sel);
  const order: Array<DisplayKey | "cpu"> = ["oled", "tft", "lcd", "seg", "cpu"];
  const span = st ? Math.max(budget, st.draw) * 1.04 : budget;
  const pinsOf = (d: DisplayKey) => BUSES[d][liveBus(d)]!.pins;
  const shareI2c = liveBus("lcd") === 2 && liveBus("oled") === 0;
  const pinCells: Array<DisplayKey | null> = [];
  for (const d of DISPLAY_KEYS) for (let i = 0; i < pinsOf(d) - (d === "lcd" && shareI2c ? 2 : 0); i++) pinCells.push(d);
  const pinTotal = pinCells.length;
  while (pinCells.length < 50) pinCells.push(null);
  const usedPins = fw ? gpioTotal(f) : pinTotal;

  const preview = (() => {
    if (sel === "oled") {
      const o = f.oled;
      const bytes = Array.from(o.fb.slice(page * OLED_W, page * OLED_W + 16));
      const sent = Array.from(o.gddram.slice(page * OLED_W, page * OLED_W + 16));
      const pend = o.fb.some((b, i) => b !== o.gddram[i]);
      return (
        <>
          <OledDiff o={o} ver={o.ver + (o.lastDraw > 0 ? Math.round(o.lastDraw * 1000) : 0)} page={page} />
          <div className="mcl-l35-legend"><span><i style={{ background: "#4ea8ff" }} />sent</span><span><i style={{ background: "#f59e0b" }} />in SRAM, not sent yet</span><span><i style={{ background: "#5b2130" }} />stale on panel</span></div>
          <div className="mcl-l35-bytes">
            <label className="mcl-l31-inline"><span>Page</span><select value={page} aria-label="Framebuffer page" onChange={(ev) => setPage(Number(ev.target.value))}>{Array.from({ length: 8 }, (_, i) => <option key={i} value={i}>{i} (rows {i * 8}–{i * 8 + 7})</option>)}</select></label>
            <code>{bytes.map((b, i) => <span key={i} className={b !== sent[i] ? "diff" : b ? "on" : ""}>{hex2(b)}</span>)}</code>
          </div>
          <p className="mcl-l31-sub">1024 B in SRAM: 8 pages × 128 columns, one byte = 8 vertical pixels. {o.updates ? `${o.updates} updates, last ${fmtT(Math.max(0, now - o.lastUpdate))} ago, ${fmtT(oledUpdateT(o.bus))} each on ${BUSES.oled[o.bus]!.short}.` : "Nothing sent yet."}{pend && fw ? " The panel does not match SRAM yet." : ""}</p>
        </>
      );
    }
    if (sel === "lcd") {
      return (
        <>
          <div className="mcl-l35-ddram" role="table" aria-label="LCD DDRAM">
            {f.lcd.ddram.map((row, r) => row.map((c, col) => (
              <div key={`${r}-${col}`} role="cell" className={c !== 0x20 ? "on" : ""}><b>{c === 0xdf ? "°" : c === 0x20 ? "\u00a0" : String.fromCharCode(c)}</b><small>{hex2((r ? 0x40 : 0) + col)}</small></div>
            )))}
          </div>
          <p className="mcl-l31-sub">The HD44780 stores 2 × 40 characters in its own DDRAM (row 1 starts at address 0x40); the MCU keeps no copy. {f.lcd.init ? `${f.lcd.writes} prints · ${fmtT(st?.byDisp.lcd.time ?? 0)} per frame on ${BUSES.lcd[f.lcd.bus]!.short}${f.lcd.hidden ? ` · ${f.lcd.hidden} characters past column 15` : ""}.` : fw ? "Not initialised: writes are ignored." : "Press Run."}</p>
        </>
      );
    }
    if (sel === "seg") {
      return (
        <>
          <div className="mcl-l35-segtab" role="table" aria-label="7-segment digit buffer">
            <div role="row" className="h"><span>Digit</span><span>Byte</span><span>dp g f e d c b a</span></div>
            {f.seg.digits.map((pat, i) => (
              <div role="row" key={i}><span>{i}</span><b>0x{hex2(pat)}</b><code>{Array.from({ length: 8 }, (_, b) => ((pat >> (7 - b)) & 1 ? "1" : "0")).join(" ")}</code></div>
            ))}
          </div>
          <p className="mcl-l31-sub">4 bytes in SRAM. A timer interrupt lights one digit at a time: {f.seg.scanHz} switches/s → {digitHz.toFixed(0)} Hz per digit, {(f.seg.scanHz * segIsrCost(f.seg.bus) * 100).toFixed(2)} % CPU on {BUSES.seg[f.seg.bus]!.short}.{p.deadSeg ? " Segment g of digit 2 is broken." : ""}</p>
        </>
      );
    }
    return (
      <>
        <TftRects f={f} st={st} />
        <p className="mcl-l31-sub">No framebuffer in the MCU: 320 × 240 × 2 B = 150 KB, the STM32F401 has 96 KB SRAM. The firmware sends only the windows that changed{st ? ` (${fmtB(st.byDisp.tft.bytes)} this frame, a full screen is ${fmtB(TFT_W * TFT_H * 2)})` : ""}.</p>
      </>
    );
  })();

  const notesData = {
    takeaways: [
      "Character displays (7-segment, HD44780) hold codes, graphic displays hold pixels: the more pixels, the more bytes every update costs.",
      "The SSD1306 is drawn in a 1 KB framebuffer in SRAM and only changes when oled_update() sends it; the TFT is too big for that and is drawn window by window.",
      "The bus decides the frame rate: 1 KB at 400 kHz I²C takes 23 ms, the same data over 8 MHz SPI about 1 ms.",
      "Pins are a budget too: a direct 7-segment needs 12 GPIOs, shift registers need 3, an I²C backpack shares 2 with other devices.",
      "Multiplexed LEDs must be refreshed at 60 Hz or more per digit, or the eye sees flicker.",
    ],
    observe: "Press Run. All four displays show the same temperature. Read the per-frame cost under each display and the frame budget in Learning Tasks.",
    tryIt: "Click each display to inspect what the MCU stores for it. Change the interface, brightness and font, and drag the temperature below 10 °C.",
    measure: `Now: ${st ? `${st.fps.toFixed(1)} fps, frame ${fmtT(st.draw)} of ${fmtT(budget)} budget, OLED ${fmtT(st.byDisp.oled.time)}, TFT ${fmtT(st.byDisp.tft.time)}, LCD ${fmtT(st.byDisp.lcd.time)}, ${usedPins} GPIOs, ${overruns} overruns` : "press Run"}.`,
    modify: "Set REFRESH_HZ to 60 and find the display that breaks the budget. Move it to SPI. Switch the LCD to the I²C backpack and compare pins against time.",
    runAgain: "Load each bug example, read the hint and fix it. Then load the 60 fps version and check that the frame still fits.",
    challenge: "Reach 60 fps on all four displays while using as few GPIO pins as possible.",
    question: "Why can the MCU keep a framebuffer for the OLED but not for the TFT, and what does that change about how each one is redrawn?",
  };
  const checks = [
    { label: "Run all four displays at once", done: seen.all },
    { label: "Compare the OLED on I²C and on SPI", done: seen.spi },
    { label: "Find the bottleneck at 60 Hz (I²C OLED)", done: seen.neck },
    { label: "See 7-segment multiplexing flicker", done: seen.flicker },
    { label: "Find and fix a display bug", done: seen.fix },
    { label: "Try three font sizes", done: seen.fonts },
    { label: "Compare the LCD on 4-bit and I²C", done: seen.lcd },
  ];

  return (
    <LabShell meta={meta} lab={shellLab} subtitle="7-segment, LCD, OLED and graphical display control with framebuffer preview."
      components={["STM32 Nucleo-F401RE (3.3 V, 96 KB SRAM)", "4-digit common-cathode 7-segment display (direct GPIO or two 74HC595)", "HD44780 16x2 character LCD with contrast pot (4-bit, 8-bit or PCF8574 I²C backpack)", "SSD1306 128×64 OLED (I²C 0x3C or SPI)", "ILI9341 240×320 TFT (SPI or 8080 parallel) with PWM backlight"]}>
      <div className="mcl-grid mcl-g4-grid">
        <Panel title="Display Interfacing Playground" icon="grid" className="mcl-g4-vis">
          <div className="mcl-l35-tiles">{DISPLAY_KEYS.map(tile)}</div>
          <div className="mcl-l35-pins" aria-label={`GPIO budget: ${pinTotal} of 50 pins used`}>
            <div className="mcl-l35-pinhead"><b>GPIO budget</b><span>{pinTotal} of 50 pins{shareI2c ? " · LCD backpack shares SCL/SDA with the OLED" : ""}</span></div>
            <div className="mcl-l35-pinrow">{pinCells.map((d, i) => <i key={i} style={d ? { background: DISPLAY[d].color } : undefined} title={d ? DISPLAY[d].name : "free"} />)}</div>
            <div className="mcl-l35-legend">{DISPLAY_KEYS.map((d) => <span key={d}><i style={{ background: DISPLAY[d].color }} />{DISPLAY[d].name} {pinsOf(d)}{d === "lcd" && shareI2c ? " (shared)" : ""}</span>)}</div>
          </div>
          <div className="mcl-l34-env mcl-l35-env">
            <label className="mcl-l31-temp"><span><Icon name="thermo" size={13} />Temperature</span><input type="range" min={-20} max={99} step={0.1} value={p.temp} aria-label="Measured temperature" onChange={(ev) => lab.setParam("temp", Number(ev.target.value))} /><b>{p.temp.toFixed(1)} °C</b></label>
            <label className="mcl-l31-temp"><span><Icon name="sliders" size={13} />LCD contrast</span><input type="range" min={0} max={100} step={1} value={p.contrast} aria-label="LCD contrast potentiometer" onChange={(ev) => lab.setParam("contrast", Number(ev.target.value))} /><b>{p.contrast} %</b></label>
          </div>
        </Panel>

        <Panel title="Display Controls" icon="sliders" className="mcl-g4-cfg">
          <div className="mcl-l35-ctl">
            <label><span>Interface</span><select value={busNow} disabled={cf(BUS_FIELD[sel]) === null} aria-label={`${DISPLAY[sel].name} interface`} onChange={(ev) => edit(BUS_FIELD[sel], BUS_CONST[sel][Number(ev.target.value)]!)}>{BUSES[sel].map((b, i) => <option key={b.label} value={i}>{DISPLAY[sel].name}: {b.label} ({b.pins} pins)</option>)}</select></label>
            <label><span>Brightness</span><select value={bright} disabled={cf("bright") === null} aria-label="BRIGHTNESS" onChange={(ev) => edit("bright", ev.target.value)}>{opts(BRIGHT, bright).map((k) => <option key={k} value={k}>{k}%</option>)}</select></label>
            <label><span>Refresh</span><select value={refresh} disabled={cf("refresh") === null} aria-label="REFRESH_HZ" onChange={(ev) => edit("refresh", ev.target.value)}>{opts(REFRESH, refresh).map((k) => <option key={k} value={k}>{k} Hz ({Math.floor(1000 / k)} ms)</option>)}</select></label>
            <label><span>Font</span><select value={font} disabled={cf("font") === null} aria-label="FONT_PX" onChange={(ev) => edit("font", ev.target.value)}>{opts(FONTS, font).map((k) => <option key={k} value={k}>{k} px</option>)}</select></label>
            <label><span>7-seg scan</span><select value={scan} disabled={cf("scan") === null} aria-label="SEG_SCAN_HZ" onChange={(ev) => edit("scan", ev.target.value)}>{opts(SCANS, scan).map((k) => <option key={k} value={k}>{k} Hz ({segDigitHz(k).toFixed(0)} Hz per digit)</option>)}</select></label>
            <label><span>OLED address</span><select value={addr} disabled={cf("addr") === null} aria-label="OLED_ADDR" onChange={(ev) => edit("addr", `0x${hex2(Number(ev.target.value))}`)}>{opts(ADDRS, addr).map((k) => <option key={k} value={k}>0x{hex2(k)}{k === 0x3c ? " (default)" : k === 0x3d ? " (jumper moved)" : k === 0x78 ? " (8-bit form)" : ""}</option>)}</select></label>
          </div>
          <div className="mcl-l34-faults mcl-l35-faults">
            <Toggle label="OLED unplugged" checked={p.oledOff} onChange={(x) => lab.setParam("oledOff", x)} hint="Pull the SSD1306 module off the header" />
            <Toggle label="Dead segment" checked={p.deadSeg} onChange={(x) => lab.setParam("deadSeg", x)} hint="Segment g of digit 2 is burnt out" />
            <Toggle label="Slow-motion scan" checked={p.slowScan} onChange={(x) => lab.setParam("slowScan", x)} hint="Show the 7-segment multiplexing slowed down so you can see one digit at a time" />
          </div>
          <div className={`mcl-l31-status ${!fw ? "off" : problems.length ? "warn" : allOk ? "ok" : "off"}`}>
            <Icon name={allOk && !problems.length ? "check" : "alert"} size={16} />
            <div>
              <b>{!fw ? "Firmware stopped" : problems.length ? `${problems.length} problem${problems.length === 1 ? "" : "s"}` : allOk ? "All four displays running" : now < 0.5 ? "Initialising displays…" : `${nRun} of 4 displays running`}</b>
              <span>{fw ? `${st ? `${st.fps.toFixed(1)} fps` : "…"} · frame ${frames} · overruns ${overruns} · ${usedPins} GPIO pins` : "Press Run to flash the board."}</span>
            </div>
          </div>
        </Panel>

        <Panel title="Framebuffer Preview" icon="memory" className="mcl-g4-scope mcl-l32-scopep"
          tools={<label className="mcl-l31-inline"><span className="mcl-l31-lbl">Display:</span><select value={sel} aria-label="Display to inspect" onChange={(ev) => lab.setParam("sel", ev.target.value as DisplayKey)}>{DISPLAY_KEYS.map((d) => <option key={d} value={d}>{DISPLAY[d].name}</option>)}</select></label>}>
          <p className="mcl-l31-sub mcl-l34-busline"><b>{DISPLAY[sel].part}</b> · {BUSES[sel][liveBus(sel)]!.pinList} · MCU RAM: {DISPLAY[sel].ram}</p>
          {preview}
        </Panel>

        <CodeEditor lab={lab} className="mcl-g4-code" languages={VARIANTS} />

        <Panel title="Learning Tasks" icon="check" className="mcl-g4-mon">
          <p className="mcl-l35-task">Switch display type, change interface, update text/graphics, and observe refresh bandwidth and GPIO usage.</p>
          <div className="mcl-l35-budget" aria-label="Frame time budget">
            <div className="mcl-l35-bar">
              {st ? order.map((d) => { const w = (st.byDisp[d].time / span) * 100; return w > 0.2 ? <span key={d} style={{ width: `${w}%`, background: USE_COLOR[d] }} title={`${d === "cpu" ? "CPU drawing" : DISPLAY[d].name}: ${fmtT(st.byDisp[d].time)}`} /> : null; }) : null}
              <i style={{ left: `${(budget / span) * 100}%` }} />
            </div>
            <div className="mcl-l35-barlbl"><span>{st ? `frame ${fmtT(st.draw)}` : "no frame yet"}</span><span className={st && st.draw > budget ? "bad" : ""}>budget {fmtT(budget)} ({refresh} Hz)</span><span>{st ? `${st.fps.toFixed(1)} fps` : "–"}</span></div>
          </div>
          <table className="mcl-l35-table">
            <thead><tr><th>Display</th><th>Interface</th><th>Pins</th><th>Bytes</th><th>Time</th></tr></thead>
            <tbody>
              {DISPLAY_KEYS.map((d) => {
                const b = BUSES[d][liveBus(d)]!;
                return <tr key={d} className={sel === d ? "on" : ""} onClick={() => lab.setParam("sel", d)}><td><i style={{ background: DISPLAY[d].color }} />{DISPLAY[d].name}</td><td>{b.short}</td><td>{b.pins}</td><td>{st ? fmtB(st.byDisp[d].bytes) : "–"}</td><td>{st ? fmtT(st.byDisp[d].time) : "–"}</td></tr>;
              })}
            </tbody>
          </table>
          <p className="mcl-l31-sub">GPIO used: {fw ? usedPins : "–"} of 50 on the Nucleo-F401RE{f.lcd.bus === 2 && f.oled.bus === 0 && fw ? " (the LCD backpack shares SCL/SDA with the OLED)" : ""}. Overruns: {overruns}.</p>
          <ul className="mcl-checks mcl-l35-checks">{checks.map((c) => <li key={c.label} className={c.done ? "done" : ""}><Icon name={c.done ? "check" : "target"} size={14} />{c.label}</li>)}</ul>
          {msg ? <p className="mcl-l31-hint"><Icon name="alert" size={14} /><span>{msg}</span></p> : null}
          {hints.slice(0, 3).map((x) => (
            <p key={x.text} className={`mcl-l31-hint ${x.tone ?? ""}`}><Icon name={x.tone === "info" ? "bulb" : "alert"} size={14} /><span>{x.text}</span>{x.fix?.map(([l, fn]) => <button key={l} type="button" onClick={fn}>{l}</button>)}</p>
          ))}
          <div className="mcl-l31-counts"><span>Events</span><div className="mcl-l31-faultbtns"><button type="button" className="mcl-l31-btn" onClick={() => clearLog(mcu)}>Clear</button></div></div>
          <ol className="mcl-l31-mon mcl-l35-mon" ref={listRef} aria-label="Display events">
            {lines.map((ln) => (
              <li key={ln.id}>
                <button type="button" className={`${ln.tone === "bad" ? "bad" : ln.tone === "warn" ? "warn" : ""} ${ln.d !== "sys" && ln.d === sel ? "on" : ""}`} onClick={() => { if (ln.d !== "sys") lab.setParam("sel", ln.d); }}>
                  <time>{ln.t.toFixed(3)}</time>
                  <span><code className="mcl-l31-frame"><span className={ln.tone === "bad" ? "n" : ln.tone === "ok" ? "a" : ln.tone === "warn" ? "k" : "ad"}>{ln.title}</span></code><em>{ln.text}</em></span>
                </button>
              </li>
            ))}
            {!lines.length ? <li className="mcl-l31-empty">{fw ? "No events yet." : "Press Run to start."}</li> : null}
          </ol>
          <p className="mcl-l31-sub">{lab.dirty && !pending ? "The editor has unflashed changes: press Run to apply them. " : ""}Click a display, a table row or an event to inspect that display.{custom && fw ? " Running your own version of the program." : ""}</p>
        </Panel>

        <div className="mcl-g4-notes"><LearningNotes notes={notesData} /></div>
      </div>
    </LabShell>
  );
}
