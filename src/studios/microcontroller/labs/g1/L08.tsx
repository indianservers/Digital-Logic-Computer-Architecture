import { useState } from "react";
import { Block, toNum } from "../core/cinterp";
import type { Mcu } from "../core/mcu";
import { useLab } from "../core/useLab";
import type { LabMeta } from "../registry";
import { CodeEditor } from "../ui/CodeEditor";
import { HwDefs, NucleoBoard } from "../ui/Hardware";
import { Icon } from "../ui/Icon";
import { LearningNotes, Panel, Seg, Toggle, hex } from "../ui/Panels";
import { LabShell } from "../ui/Shell";
import { buildLayout, displayValue, globalBytes, MAP, regionOf, setGlobalBytes, type Layout, type Region } from "./memmap";

const DEMO = `// Lab 8 - Flash, SRAM & EEPROM (STM32F103RB)
#include "stm32f1xx_hal.h"
#include <stdio.h>

// Constant table: const data stays in Flash (.rodata)
const uint16_t gammaTable[8] = {0, 2, 9, 22, 42, 69, 104, 147};

// Global variables live in SRAM (.data / .bss)
uint32_t bootCount = 0;
char message[32];

// Settings saved in the emulated EEPROM page (last 2 KB of Flash)
typedef struct {
    uint32_t magic;
    uint32_t boots;
    uint8_t  brightness;
    uint8_t  mode;
} AppConfig_t;
AppConfig_t config;

#define EEPROM_PAGE   0x0801F800
#define CONFIG_MAGIC  0xC0FFEE42

void loadConfig(void) {
    config.magic = *(volatile uint32_t *)EEPROM_PAGE;
    config.boots = *(volatile uint32_t *)(EEPROM_PAGE + 4);
    uint16_t packed = *(volatile uint16_t *)(EEPROM_PAGE + 8);
    config.brightness = packed & 0xFF;
    config.mode = packed >> 8;
}

void saveConfig(void) {
    FLASH_EraseInitTypeDef erase;
    uint32_t pageError;
    HAL_FLASH_Unlock();
    erase.TypeErase = FLASH_TYPEERASE_PAGES;
    erase.PageAddress = EEPROM_PAGE;
    erase.NbPages = 1;
    HAL_FLASHEx_Erase(&erase, &pageError);     // ~20 ms: all bits -> 1
    HAL_FLASH_Program(FLASH_TYPEPROGRAM_WORD, EEPROM_PAGE, config.magic);
    HAL_FLASH_Program(FLASH_TYPEPROGRAM_WORD, EEPROM_PAGE + 4, config.boots);
    HAL_FLASH_Program(FLASH_TYPEPROGRAM_HALFWORD, EEPROM_PAGE + 8,
                      config.brightness | (config.mode << 8));
    HAL_FLASH_Lock();
}

int main(void) {
    HAL_Init();
    loadConfig();
    if (config.magic != CONFIG_MAGIC) {      // blank EEPROM: first boot
        config.magic = CONFIG_MAGIC;
        config.boots = 0;
        config.brightness = gammaTable[5];
        config.mode = 1;
    }
    config.boots++;                          // survives reset (EEPROM)
    bootCount++;                             // lost on reset (SRAM)
    saveConfig();
    sprintf(message, "Boot #%lu  RAM count %lu", config.boots, bootCount);
    while (1) {
        HAL_Delay(500);
    }
}
`;
const RULES = `// Flash rules: unlock, erase before write, no overwrite
#include "stm32f1xx_hal.h"

#define PAGE 0x0801FC00                      // second EEPROM page
uint32_t lockedResult, firstWrite, secondWrite, readBack;

int main(void) {
    FLASH_EraseInitTypeDef erase;
    uint32_t pageError;
    HAL_Init();
    lockedResult = HAL_FLASH_Program(FLASH_TYPEPROGRAM_HALFWORD, PAGE, 0x1234); // locked -> 1
    HAL_FLASH_Unlock();
    erase.TypeErase = FLASH_TYPEERASE_PAGES;
    erase.PageAddress = PAGE;
    erase.NbPages = 1;
    HAL_FLASHEx_Erase(&erase, &pageError);
    firstWrite  = HAL_FLASH_Program(FLASH_TYPEPROGRAM_HALFWORD, PAGE, 0x1234); // OK -> 0
    secondWrite = HAL_FLASH_Program(FLASH_TYPEPROGRAM_HALFWORD, PAGE, 0x5678); // PGERR -> 1
    HAL_FLASH_Lock();
    readBack = *(volatile uint16_t *)PAGE;                                      // 0x1234
    while (1) {
        HAL_Delay(1000);
    }
}
`;

type P = { tab: string; ee: string; boot: string; powerLoss: boolean; worn: boolean };
type Result = { ok: boolean; op: string; addr: number; value: number; region: Region | null; time: string; text: string };

const COLORS: Record<Region, string> = { flash: "#3b82f6", eeprom: "#f59e0b", boot: "#64748b", sram: "#22c55e" };
const TITLES: Record<Region, [string, string]> = { flash: ["Flash", "Program Memory"], eeprom: ["EEPROM", "Emulated in Flash"], boot: ["Boot ROM", "System Memory"], sram: ["SRAM", "Data / RAM"] };
const ORDER: Region[] = ["flash", "eeprom", "boot", "sram"];
const EE_END = MAP.eeprom.base + MAP.eeprom.size;

const layouts = new Map<string, Layout>();
const layoutOf = (src: string) => { let l = layouts.get(src); if (!l) { l = buildLayout(src); if (layouts.size > 16) layouts.clear(); layouts.set(src, l); } return l; };
const synced = new WeakMap<Mcu, number>();

const serializeEe = (m: Mcu) => JSON.stringify({
  h: [...m.flash.entries()].filter(([a]) => a >= MAP.eeprom.base && a < EE_END),
  w: [...m.flashWear.entries()].filter(([a]) => a >= MAP.eeprom.base && a < EE_END),
});
function restoreEe(m: Mcu, ee: string) {
  if (!ee) return;
  try {
    const d = JSON.parse(ee) as { h?: Array<[number, number]>; w?: Array<[number, number]> };
    for (const [a, v] of d.h ?? []) m.flash.set(a, v);
    for (const [a, v] of d.w ?? []) m.flashWear.set(a, v);
  } catch { /* corrupt saved image: start blank */ }
}
const bootWord = (addr: number) => {
  if (addr === MAP.boot.base) return 0x200001fc;
  if (addr === MAP.boot.base + 4) return 0x1ffff021;
  let x = (addr * 2654435761) >>> 0;
  x ^= x >>> 15; x = Math.imul(x, 0x2c1b3c6d) >>> 0; x ^= x >>> 12;
  return x >>> 0;
};
const fmtTime = (s: number) => (s >= 1e-3 ? `${(s * 1e3).toFixed(1)} ms` : s >= 1e-6 ? `${(s * 1e6).toFixed(1)} µs` : `${(s * 1e9).toFixed(1)} ns`);
const kb = (b: number) => (b >= 1024 ? `${(b / 1024).toFixed(1)} KB` : `${b} B`);
const range = (r: Region) => `${hex(MAP[r].base, 8).replace(/^0x(....)/, "0x$1 ")} – ${hex(MAP[r].base + MAP[r].size - 1, 8).replace(/^0x(....)/, "0x$1 ")}`;

function Donut({ pct, color, label, sub }: { pct: number; color: string; label: string; sub: string }) {
  const r = 26, c = 2 * Math.PI * r, p = Math.max(0, Math.min(1, pct));
  return (
    <div className="mcl-l08-donut">
      <svg viewBox="0 0 70 70" role="img" aria-label={`${label} ${(p * 100).toFixed(0)} percent used`}>
        <circle cx={35} cy={35} r={r} fill="none" stroke="#e6edf6" strokeWidth={8} />
        <circle cx={35} cy={35} r={r} fill="none" stroke={color} strokeWidth={8} strokeDasharray={`${c * p} ${c}`} strokeLinecap="round" transform="rotate(-90 35 35)" />
        <text x={35} y={39} textAnchor="middle" fontSize="13" fontWeight="800" fill="#0f2547">{(p * 100).toFixed(p < 0.1 && p > 0 ? 1 : 0)}%</text>
      </svg>
      <b>{label}</b><small>{sub}</small>
    </div>
  );
}

export default function L08({ meta }: { meta: LabMeta }) {
  const lab = useLab<P>({
    slug: meta.slug, code: DEMO, params: { tab: "flash", ee: "", boot: "flash", powerLoss: false, worn: false },
    rebuildOn: ["boot", "powerLoss", "worn"],
    mcu: (p) => {
      let fired = false;
      return {
        part: "F103",
        onCall: (name, args, m) => {
          if (name !== "HAL_FLASH_Program") return undefined;
          const addr = toNum(args[1] ?? 0) >>> 0;
          if (p.powerLoss && !fired && regionOf(addr) === "eeprom") {
            fired = true;
            m.log("power", "Power lost while programming the EEPROM page — it was erased but never rewritten");
            m.schedule(m.time + 50e-6, () => m.hardReset("Power-on reset after power loss during an EEPROM write"));
            return new Block(() => false, Infinity, undefined, "power loss");
          }
          if (p.worn && (m.flashWear.get(m.flashUnit(addr).base) ?? 0) >= 10000) {
            const v = toNum(args[2] ?? 0) >>> 0, type = toNum(args[0] ?? 1);
            m.flashProgram(addr, (v ^ 0x10) >>> 0, type === 1 ? 2 : type === 2 ? 4 : 8);
            m.log("fault", `Verify failed at ${hex(addr, 8)}: worn-out cell — read back ${hex((v ^ 0x10) >>> 0, 8)} instead of ${hex(v, 8)}`);
            return 1;
          }
          return undefined;
        },
      };
    },
    setup: (m, p, src) => {
      const lay = layoutOf(src);
      for (let i = 0; i + 1 < lay.image.length; i += 2) m.flash.set(MAP.flash.base + i, lay.image[i]! | (lay.image[i + 1]! << 8));
      restoreEe(m, p.ee);
      if (p.worn) for (let a = MAP.eeprom.base; a < EE_END; a += 1024) m.flashWear.set(a, Math.max(10000, m.flashWear.get(a) ?? 0));
      m.onReset = () => { if (m.readMem(MAP.flash.base + 4, 4) === 0xffffffff) m.fw?.fail(new Error("HardFault at boot: the reset vector at 0x0800 0004 is erased (0xFFFFFFFF) — re-flash the firmware with Run"), 1); };
      synced.set(m, m.flashOps.length);
    },
    world: (m, _dt, p) => {
      if (p.boot === "system" && !m.inReset) { m.inReset = true; m.log("info", "BOOT0 = 1, BOOT1 = 0: running the ST bootloader from System memory (waiting on USART1)"); }
      if (p.boot === "sram" && m.fw && !m.fw.error) m.fw.fail(new Error("HardFault: booted from SRAM (BOOT0 = 1, BOOT1 = 1) but no program was loaded into SRAM"), 1);
      if (synced.get(m) !== m.flashOps.length) { synced.set(m, m.flashOps.length); p.ee = serializeEe(m); }
    },
  });
  const { mcu, params } = lab;
  const fw = mcu.fw;
  const layout = layoutOf(lab.compiledCode);
  const tab = params.tab as Region;
  const [addrText, setAddrText] = useState(hex(MAP.flash.base, 8));
  const [dataText, setDataText] = useState("0x12345678");
  const [result, setResult] = useState<Result | null>(null);
  const [hwView, setHwView] = useState<"board" | "pinout">("board");
  const [pulse, setPulse] = useState<{ r: Region; t: number } | null>(null);
  const [seen, setSeen] = useState({ read: false, pgerr: false, persisted: false });

  const eeBytes = [...mcu.flash.entries()].filter(([a, v]) => a >= MAP.eeprom.base && a < EE_END && v !== 0xffff).length * 2;
  const eeWear = [MAP.eeprom.base, MAP.eeprom.base + 1024].map((a) => mcu.flashWear.get(a) ?? 0);
  const used: Record<Region, number> = { flash: layout.flashUsed, sram: layout.sramUsed, eeprom: eeBytes, boot: MAP.boot.size };
  const boots = fw?.field("config.boots") ?? 0;
  if (boots >= 2 && mcu.resets > 0 && !seen.persisted) setSeen((s) => ({ ...s, persisted: true }));
  if (!seen.pgerr && mcu.flashOps.some((o) => o.kind === "error" && o.text.includes("not erased"))) setSeen((s) => ({ ...s, pgerr: true }));

  const selectTab = (r: Region) => { lab.setParam("tab", r); setAddrText(hex(MAP[r].base, 8)); setResult(null); };
  const parse = (s: string) => { const v = Number(s.trim().replace(/_/g, "").replace(/\s+/g, "")); return Number.isFinite(v) ? v >>> 0 : NaN; };
  const globalAt = (a: number) => layout.globals.find((g) => g.section !== ".rodata" && a >= g.addr && a < g.addr + g.size);
  const sramByte = (a: number) => { const g = globalAt(a); return g ? globalBytes(fw, g)[a - g.addr]! : mcu.readMem(a, 1); };
  const readWord = (a: number, r: Region) => (r === "sram" ? [0, 1, 2, 3].reduce((v, k) => v + sramByte(a + k) * 2 ** (8 * k), 0) : r === "boot" ? bootWord(a & ~3) : mcu.readMem(a, 4));
  const withUnlock = <T,>(fn: () => T): T => {
    const locked = mcu.flashLocked;
    if (locked) { mcu.write("FLASH.KEYR", 0x45670123); mcu.write("FLASH.KEYR", 0xcdef89ab); }
    const out = fn();
    if (locked) mcu.write("FLASH.CR", 0x80);
    return out;
  };
  const lastError = (before: number) => mcu.flashOps.slice(before).find((o) => o.kind === "error")?.text;
  const describe = (a: number) => { const g = globalAt(a) ?? layout.globals.find((x) => x.section === ".rodata" && a >= x.addr && a < x.addr + x.size); if (g) return `${g.name} (${g.section})`; const s = layout.sections.find((x) => a >= x.addr && a < x.addr + x.size); return s ? s.name : ""; };

  const access = (op: "read" | "write" | "erase") => {
    const a = parse(addrText), r = Number.isNaN(a) ? null : regionOf(a);
    if (r === null) { setResult({ ok: false, op, addr: a || 0, value: 0, region: null, time: "—", text: "Address is not mapped on the STM32F103 — a real access would raise a BusFault." }); return; }
    if (r !== tab) lab.setParam("tab", r);
    setPulse({ r, t: performance.now() });
    const flashLike = r === "flash" || r === "eeprom";
    if (op === "read") {
      const v = readWord(a, r) >>> 0;
      setDataText(hex(v, 8));
      setSeen((s) => ({ ...s, read: true }));
      setResult({ ok: true, op: "Read", addr: a, value: v, region: r, time: r === "sram" ? "13.9 ns (0 wait states)" : "41.7 ns (2 wait states @ 72 MHz)", text: describe(a) });
      lab.advance(0);
      return;
    }
    if (op === "erase") {
      if (!flashLike) { setResult({ ok: false, op: "Erase", addr: a, value: 0, region: r, time: "—", text: r === "sram" ? "SRAM has no erase step — just write new values." : "System memory is factory-programmed ROM and cannot be erased." }); return; }
      const before = mcu.flashOps.length;
      const secs = withUnlock(() => mcu.flashEraseUnit(a));
      const u = mcu.flashUnit(a);
      const err = lastError(before);
      setResult({ ok: !err, op: "Erase", addr: u.base, value: 0xffffffff, region: r, time: fmtTime(secs), text: err ?? `Page ${u.index} (1 KB) now reads 0xFF…${u.base < MAP.flash.base + layout.flashUsed ? " — it held firmware code; the next reset will crash." : ""}` });
      lab.advance(0);
      return;
    }
    const v = parse(dataText);
    if (Number.isNaN(v)) { setResult({ ok: false, op: "Write", addr: a, value: 0, region: r, time: "—", text: "Enter the data as a number, e.g. 0x12345678." }); return; }
    if (r === "boot") { setResult({ ok: false, op: "Write", addr: a, value: v, region: r, time: "—", text: "System memory is read-only ROM — the write is ignored (BusFault on real hardware)." }); return; }
    if (r === "sram") {
      const touched = new Map<string, number[]>();
      for (let k = 0; k < 4; k++) {
        const b = (v >>> (8 * k)) & 0xff, g = globalAt(a + k);
        if (g) { const bytes = touched.get(g.name) ?? globalBytes(fw, g); bytes[a + k - g.addr] = b; touched.set(g.name, bytes); }
        else mcu.writeMem(a + k, b, 1);
      }
      for (const [name, bytes] of touched) setGlobalBytes(fw, layout.globals.find((g) => g.name === name)!, bytes);
      setResult({ ok: true, op: "Write", addr: a, value: v, region: r, time: "13.9 ns (0 wait states)", text: describe(a) || "free SRAM" });
      lab.advance(0);
      return;
    }
    const before = mcu.flashOps.length;
    const res = withUnlock(() => mcu.flashProgram(a & ~1, v, 4));
    const err = lastError(before);
    if (err?.includes("not erased")) setSeen((s) => ({ ...s, pgerr: true }));
    setResult({ ok: res.ok, op: "Write", addr: a & ~1, value: v, region: r, time: res.ok ? `${fmtTime(res.seconds)} (2 × halfword program)` : "—", text: err ?? (describe(a) || "programmed") });
    lab.advance(0);
  };

  const pulsing = (r: Region) => pulse?.r === r && performance.now() - pulse.t < 900;
  const message = layout.globals.some((g) => g.name === "message") && fw ? displayValue(fw, layout.globals.find((g) => g.name === "message")!) : "";
  const bootState = params.boot === "system" ? "ST bootloader (System memory)" : params.boot === "sram" ? "HardFault — nothing in SRAM" : fw?.error ? "HardFault" : "User firmware (Flash)";
  const sel = layout.sections.filter((s) => s.region === tab);

  return (
    <LabShell meta={meta} lab={lab} subtitle="Explore memory types, memory map, and usage patterns in a microcontroller."
      components={["NUCLEO-F103RB (STM32F103RB, Cortex-M3 @ 72 MHz)", "128 KB Flash (126 KB program + 2 KB emulated EEPROM)", "20 KB SRAM", "2 KB System memory (ST bootloader)", "ST-LINK/V2-1 (SWD)"]}>
      <div className="mcl-grid mcl-l08-grid">
        <Panel title="Memory Explorer" icon="memory" className="mcl-sim mcl-l08-exp" tools={<span className="mcl-chip"><Icon name="chip" />STM32F103RB (Cortex-M3)</span>}>
          <div className="mcl-l08-expbody">
            <div className="mcl-l08-map" role="list" aria-label="Memory map">
              {ORDER.map((r) => (
                <button type="button" key={r} role="listitem" className={`mcl-l08-blk ${tab === r ? "sel" : ""} ${pulsing(r) ? "pulse" : ""}`} style={{ ["--c" as string]: COLORS[r] }} onClick={() => selectTab(r)}>
                  <small>{hex(MAP[r].base, 8).replace(/^0x(....)/, "0x$1 ")}</small>
                  <b>{TITLES[r][0]}</b><span>({TITLES[r][1]})</span><em>{kb(MAP[r].size)}</em>
                </button>
              ))}
            </div>
            <div>
              <table className="mcl-table mcl-l08-tbl">
                <thead><tr><th>Region</th><th>Address Range</th><th>Size</th><th>Usage</th></tr></thead>
                <tbody>
                  {ORDER.map((r) => {
                    const pct = r === "boot" ? 1 : used[r] / MAP[r].size;
                    return (
                      <tr key={r} className={tab === r ? "sel" : ""} onClick={() => selectTab(r)}>
                        <td><b>{TITLES[r][0]}</b><small>({TITLES[r][1]})</small></td>
                        <td className="mcl-mono">{range(r)}</td>
                        <td>{kb(MAP[r].size)}</td>
                        <td>
                          <div className="mcl-l08-bar"><i style={{ width: `${Math.max(2, pct * 100)}%`, background: r === "boot" ? "#cbd5e1" : COLORS[r] }} /><span>{r === "boot" ? "–" : `${(pct * 100).toFixed(pct < 0.1 ? 1 : 0)}%`}</span></div>
                          <small>{r === "boot" ? "(Read only)" : `${kb(used[r])} used`}</small>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="mcl-l08-note">
                <b><Icon name="bulb" />{TITLES[tab][0]} — what is in it</b>
                {tab === "boot" ? <p>Factory ST bootloader (USART1 / USB DFU). Selected at reset when BOOT0 = 1 and BOOT1 = 0 — see the Pinout tab.</p> : null}
                {tab === "eeprom" ? <p>Two 1 KB Flash pages used as EEPROM. {eeBytes} B programmed · erase cycles: page 126 = {eeWear[0]}, page 127 = {eeWear[1]} (rated ~10,000).</p> : null}
                {sel.length ? (
                  <ul>{sel.map((s) => <li key={s.name}><code>{s.name}</code><span>{hex(s.addr, 8)}</span><span>{kb(s.size)}</span><small>{s.note}</small></li>)}</ul>
                ) : null}
                {tab === "flash" ? <small className="mcl-muted">Sizes come from a linker-style estimate of your code (there is no real ARM linker here); the image itself is really written to simulated Flash.</small> : null}
              </div>
            </div>
          </div>
        </Panel>

        <Panel title="Memory Access Simulation" icon="cpu" className="mcl-l08-acc">
          <div className="mcl-l08-tabs"><Seg value={tab} options={(["flash", "sram", "eeprom", "boot"] as Region[]).map((r) => ({ value: r, label: r === "boot" ? "ROM" : TITLES[r][0] }))} onChange={selectTab} label="Memory type" /></div>
          <label className="mcl-l08-field"><span>Address</span><input className="mcl-input mcl-mono" value={addrText} onChange={(e) => setAddrText(e.target.value)} aria-label="Address" /></label>
          <label className="mcl-l08-field"><span>Data (32-bit)</span><input className="mcl-input mcl-mono" value={dataText} onChange={(e) => setDataText(e.target.value)} aria-label="Data" /></label>
          <div className="mcl-l08-field"><span>Operation</span>
            <div className="mcl-l08-ops">
              <button type="button" className="mcl-btn mcl-btn-run" onClick={() => access("read")}>Read</button>
              <button type="button" className="mcl-btn" onClick={() => access("write")}>Write</button>
              {tab === "flash" || tab === "eeprom" ? <button type="button" className="mcl-btn" onClick={() => access("erase")} title="Erase the 1 KB page containing this address">Erase</button> : null}
            </div>
          </div>
          {result ? (
            <div className={`mcl-l08-res ${result.ok ? "ok" : "bad"}`} role="status">
              <b><Icon name={result.ok ? "check" : "alert"} />{result.op} {result.ok ? "Successful" : "Failed"}</b>
              <dl>
                <div><dt>Address:</dt><dd>{hex(result.addr, 8)}</dd></div>
                <div><dt>Data:</dt><dd>{hex(result.value, 8)}</dd></div>
                <div><dt>Region:</dt><dd>{result.region ? `${TITLES[result.region][0]} (${TITLES[result.region][1]})` : "unmapped"}</dd></div>
                <div><dt>Access Time:</dt><dd>{result.time}</dd></div>
              </dl>
              {result.text ? <p>{result.text}</p> : null}
            </div>
          ) : <p className="mcl-muted mcl-l08-hint">Pick a region, then Read or Write. Flash and EEPROM writes go through the real unlock → program → lock sequence.</p>}
          <div className="mcl-l08-ops-log">
            <small>Flash controller</small>
            {mcu.flashOps.slice(-4).reverse().map((o, i) => <div key={i} className={`k-${o.kind}`}><time>{o.t.toFixed(3)}s</time><span>{o.text}</span></div>)}
            {!mcu.flashOps.length ? <div className="mcl-muted">No Flash operations yet.</div> : null}
          </div>
        </Panel>

        <div className="mcl-col mcl-l08-side">
          <Panel title="Read / Write Behavior" icon="sliders">
            <table className="mcl-table mcl-l08-rw">
              <thead><tr><th>Feature</th><th className={tab === "flash" ? "hl" : ""}>Flash</th><th className={tab === "sram" ? "hl" : ""}>SRAM</th><th className={tab === "eeprom" ? "hl" : ""}>EEPROM</th></tr></thead>
              <tbody>
                {([
                  ["Volatile?", ["No", "bad"], ["Yes", "good"], ["No", "bad"]],
                  ["Read Speed", ["Fast · 2 WS", "good"], ["Very Fast · 0 WS", "good"], ["Fast (Flash read)", "good"]],
                  ["Write Speed", ["Slow · 52 µs/16 bit, erase first", "bad"], ["Very Fast", "good"], ["Slower · 20 ms page erase", "warn"]],
                  ["Write Endurance", ["~10,000 cycles", ""], ["Unlimited", ""], ["~10k/page (more with wear levelling)", ""]],
                  ["Typical Use", ["Program code, const data", ""], ["Variables, stack, heap", ""], ["Settings, calibration", ""]],
                  ["Retains Data After Reset?", ["Yes", "good"], ["Re-initialized by startup", "bad"], ["Yes", "good"]],
                ] as Array<[string, [string, string], [string, string], [string, string]]>).map(([f, ...cells]) => (
                  <tr key={f}><td>{f}</td>{cells.map(([t, tone], i) => <td key={i} className={(["flash", "sram", "eeprom"][i] === tab ? "hl " : "") + tone}><span>{t}</span></td>)}</tr>
                ))}
              </tbody>
            </table>
          </Panel>
          <Panel title="Usage Statistics" icon="gauge">
            <div className="mcl-l08-donuts">
              <Donut pct={used.flash / MAP.flash.size} color={COLORS.flash} label="Flash" sub={`${kb(used.flash)} / ${kb(MAP.flash.size)}`} />
              <Donut pct={used.sram / MAP.sram.size} color={COLORS.sram} label="SRAM" sub={`${kb(used.sram)} / ${kb(MAP.sram.size)}`} />
              <Donut pct={used.eeprom / MAP.eeprom.size} color={COLORS.eeprom} label="EEPROM" sub={`${kb(used.eeprom)} / ${kb(MAP.eeprom.size)}`} />
            </div>
            <small className="mcl-l08-sramnote">SRAM = .data + .bss {kb(layout.sramStatic)} + heap 512 B + stack 1 KB (linker reservations)</small>
          </Panel>
          <LearningNotes notes={{
            takeaways: ["Understand the different memory types in a microcontroller.", "Explore the memory map and address ranges.", "Learn about volatile vs non-volatile memory characteristics.", "Write and read data from EEPROM (using emulation).", "Store configuration data and retrieve it after reset.", "Analyze memory usage and consider optimization."],
            observe: "Press RESET on the board: config.boots keeps counting (EEPROM) while bootCount restarts at 1 (SRAM).",
            tryIt: "Read 0x0800 0000 — it holds the initial stack pointer 0x2000 5000 from the vector table.",
            measure: `Boot #${boots} · EEPROM page 126 erased ${eeWear[0]} time${eeWear[0] === 1 ? "" : "s"} · Flash image ${kb(layout.flashUsed)}.`,
            modify: "Load the Flash-rules example, or remove the erase call from saveConfig() and Run.",
            runAgain: "Enable power loss during write and reset — what happens to the stored settings?",
            challenge: "Design a two-page EEPROM scheme so a power loss mid-write never loses the last good settings.",
            question: "Use const for read-only data to store it in Flash, keep dynamic variables in SRAM, and minimize EEPROM writes to extend its lifespan.",
            checks: [{ label: "Read a value through the access simulator", done: seen.read }, { label: "Saw PGERR when writing non-erased Flash", done: seen.pgerr }, { label: "Settings survived a reset (boots ≥ 2)", done: seen.persisted }],
          }} />
        </div>

        <CodeEditor lab={lab} className="mcl-l08-code" languages={[{ label: "C (STM32)", code: DEMO }, { label: "C (Flash rules)", code: RULES }]} />

        <Panel title="Hardware & Memory Mapping" icon="link" className="mcl-l08-hw" tools={<Seg size="sm" value={hwView} options={[{ value: "board", label: "STM32F103" }, { value: "pinout", label: "Pinout" }]} onChange={setHwView} label="View" />}>
          {hwView === "board" ? (
            <svg viewBox="0 0 340 214" className="mcl-svg mcl-l08-board" role="img" aria-label="Nucleo board with memory regions">
              <HwDefs id="l08" />
              <NucleoBoard x={122} y={4} scale={0.6} id="l08" chipLabel="STM32F103" model="NUCLEO-F103RB" ld2={false} onReset={() => { mcu.hardReset("External reset (NRST button B2)"); lab.advance(0); }} />
              {([["flash", 6, 8], ["eeprom", 6, 76], ["boot", 6, 144], ["sram", 252, 40]] as Array<[Region, number, number]>).map(([r, x, y]) => {
                const on = tab === r || pulsing(r);
                const toX = r === "sram" ? 205 : 160;
                return (
                  <g key={r} className="mcl-l08-callout" onClick={() => selectTab(r)} role="button" tabIndex={0} aria-label={`Select ${TITLES[r][0]}`}>
                    <path d={`M${r === "sram" ? x : x + 82} ${y + 26} C ${r === "sram" ? x - 20 : x + 110} ${y + 26}, ${toX} ${r === "sram" ? y + 40 : 110}, ${toX} 112`} fill="none" stroke={COLORS[r]} strokeWidth={on ? 2.6 : 1.6} className={pulsing(r) ? "mcl-wire-live" : ""} />
                    <rect x={x} y={y} width={82} height={54} rx={6} fill="#fff" stroke={COLORS[r]} strokeWidth={on ? 2.4 : 1.4} />
                    <text x={x + 8} y={y + 15} fontSize="10.5" fontWeight="800" fill="#0f2547">{TITLES[r][0]}</text>
                    <text x={x + 8} y={y + 28} fontSize="8.5" fill="#4b6283">{r === "eeprom" ? "(Emulated) 2 KB" : kb(MAP[r].size)}</text>
                    <text x={x + 8} y={y + 41} fontSize="8.5" fill="#4b6283" className="mcl-mono-svg">{hex(MAP[r].base, 8)}</text>
                  </g>
                );
              })}
              <g transform="translate(236 128)">
                <rect width={98} height={80} rx={6} fill="#f4f8fd" stroke="#dbe5f1" />
                <text x={8} y={16} fontSize="9" fontWeight="800" fill="#0f2547">Program via ST-Link</text>
                <text x={8} y={28} fontSize="8.5" fill="#4b6283">(SWD) · Run re-flashes</text>
                <text x={8} y={40} fontSize="8.5" fill="#4b6283">program pages only;</text>
                <text x={8} y={52} fontSize="8.5" fill="#4b6283">EEPROM page is kept.</text>
                <text x={8} y={70} fontSize="8.5" fontWeight="700" fill="#1769e0">Click RESET (B2) ↵</text>
              </g>
            </svg>
          ) : (
            <div className="mcl-l08-pinout">
              <p>BOOT0 (CN7-7) and BOOT1 (PB2) are sampled at reset and decide which memory is aliased at 0x0000 0000.</p>
              <table className="mcl-table">
                <thead><tr><th>BOOT1</th><th>BOOT0</th><th>Boot space</th></tr></thead>
                <tbody>
                  {([["x", "0", "Main Flash (user firmware)", "flash"], ["0", "1", "System memory (ST bootloader)", "system"], ["1", "1", "Embedded SRAM", "sram"]] as const).map(([b1, b0, t, k]) => (
                    <tr key={k} className={params.boot === k ? "sel" : ""}><td>{b1}</td><td>{b0}</td><td>{t}</td></tr>
                  ))}
                </tbody>
              </table>
              <Seg size="sm" value={params.boot} options={[{ value: "flash", label: "Flash" }, { value: "system", label: "System" }, { value: "sram", label: "SRAM" }]} onChange={(v) => lab.setParam("boot", v)} label="Boot mode" />
            </div>
          )}
          <div className="mcl-l08-status">
            <span><i className={fw?.error ? "bad" : params.boot === "flash" ? "ok" : "warn"} />Running: {bootState}</span>
            <span>Resets: {mcu.resets} · {mcu.resetCause}</span>
            {message ? <code>message = {message}</code> : null}
          </div>
          <div className="mcl-l08-faults">
            <b><Icon name="bug" />Fault injection</b>
            <Toggle label="Power loss during EEPROM write" checked={params.powerLoss} onChange={(v) => lab.setParam("powerLoss", v)} hint="The supply drops right after the page erase, before new data is programmed" />
            <Toggle label="Worn-out EEPROM page" checked={params.worn} onChange={(v) => lab.setParam("worn", v)} hint="Pages pass 10,000 erase cycles and start failing verification" />
          </div>
        </Panel>
      </div>
    </LabShell>
  );
}
