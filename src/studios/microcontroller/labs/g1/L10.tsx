import { useEffect, useRef, useState } from "react";
import type { Mcu } from "../core/mcu";
import { useLab } from "../core/useLab";
import type { LabMeta } from "../registry";
import { CodeEditor } from "../ui/CodeEditor";
import { Icon, type IconName } from "../ui/Icon";
import { LearningNotes, Panel, Toggle } from "../ui/Panels";
import { LabShell } from "../ui/Shell";
import { applyClocks, clockHook, hseFailure, ipsFor, liveClocks, newClockState, type ClockState } from "./clocklab";
import { DEMO, HSI_ONLY } from "./L10code";
import { ADC_DIVS, AHB_DIVS, APB_DIVS, clocksOf, issuesOf, parseDraft, RCC_CONST, RCC_RESET, withClockConfig, type Clocks, type PllSrc, type RccConfig, type SysSrc } from "./rcc";

type P = { hseFail: boolean; wrongXtal: boolean };

const STATES = new WeakMap<Mcu, ClockState>();
let building: ClockState | null = null;
const crystalOf = (p: P, hseValue: number) => (p.wrongXtal ? (hseValue === 12e6 ? 8e6 : 12e6) : hseValue);

const fmt = (hz: number) => (hz <= 0 ? "0 Hz" : hz >= 1e6 ? `${+(hz / 1e6).toFixed(2)} MHz` : hz >= 1e3 ? `${+(hz / 1e3).toFixed(3)} kHz` : `${+hz.toFixed(2)} Hz`);
const fmtT = (s: number) => (s >= 1e-3 ? `${+(s * 1e3).toFixed(3)} ms` : s >= 1e-6 ? `${+(s * 1e6).toFixed(3)} µs` : `${+(s * 1e9).toFixed(2)} ns`);

type Key = "hse" | "hsi" | "lsi" | "pll" | "sys" | "ahb" | "apb1" | "apb2" | "cpu" | "systick" | "dma" | "tim2" | "usart2" | "i2c1" | "tim1" | "adc" | "usart1";
interface Out { key: Key; name: string; per: string; src: string; hz: (k: Clocks) => number; limit?: number; y: number }
const OUTS: Out[] = [
  { key: "cpu", name: "CPU (Core)", per: "", src: "HCLK", hz: (k) => k.hclk, limit: 72e6, y: 8 },
  { key: "systick", name: "SysTick", per: "", src: "HCLK/8", hz: (k) => k.systick, y: 44 },
  { key: "dma", name: "DMA1", per: "DMA1", src: "HCLK", hz: (k) => k.hclk, y: 80 },
  { key: "tim2", name: "TIM2–TIM4", per: "TIM2", src: "PCLK1 timer", hz: (k) => k.tim1x, y: 128 },
  { key: "usart2", name: "USART2", per: "USART2", src: "PCLK1", hz: (k) => k.pclk1, limit: 36e6, y: 164 },
  { key: "i2c1", name: "I2C1", per: "I2C1", src: "PCLK1", hz: (k) => k.pclk1, limit: 36e6, y: 200 },
  { key: "tim1", name: "TIM1 (Adv.)", per: "TIM1", src: "PCLK2 timer", hz: (k) => k.tim2x, y: 248 },
  { key: "adc", name: "ADC1", per: "ADC1", src: "PCLK2/ADCPRE", hz: (k) => k.adc, limit: 14e6, y: 284 },
  { key: "usart1", name: "USART1 / SPI1", per: "USART1", src: "PCLK2", hz: (k) => k.pclk2, y: 320 },
];
const TABLE: Array<{ name: string; per: string; src: (c: RccConfig) => string; hz: (k: Clocks) => number; limit?: number; icon: IconName }> = [
  { name: "CPU (Core)", per: "", src: () => "HCLK", hz: (k) => k.hclk, limit: 72e6, icon: "cpu" },
  { name: "SysTick", per: "", src: () => "HCLK/8", hz: (k) => k.systick, icon: "clock" },
  { name: "TIM1 (Advanced)", per: "TIM1", src: (c) => (c.apb2Div === 1 ? "PCLK2" : "PCLK2 × 2"), hz: (k) => k.tim2x, icon: "wave" },
  { name: "TIM2 (General)", per: "TIM2", src: (c) => (c.apb1Div === 1 ? "PCLK1" : "PCLK1 × 2"), hz: (k) => k.tim1x, icon: "wave" },
  { name: "ADC1", per: "ADC1", src: (c) => `PCLK2 / ${c.adcDiv}`, hz: (k) => k.adc, limit: 14e6, icon: "gauge" },
  { name: "USART1", per: "USART1", src: () => "PCLK2", hz: (k) => k.pclk2, icon: "terminal" },
  { name: "USART2", per: "USART2", src: () => "PCLK1", hz: (k) => k.pclk1, limit: 36e6, icon: "terminal" },
  { name: "SPI1", per: "SPI1", src: () => "PCLK2", hz: (k) => k.pclk2, icon: "link" },
  { name: "I2C1", per: "I2C1", src: () => "PCLK1", hz: (k) => k.pclk1, limit: 36e6, icon: "link" },
  { name: "DMA1", per: "DMA1", src: () => "HCLK", hz: (k) => k.hclk, icon: "bolt" },
];
const SIGNALS: Array<{ key: string; label: string; hz: (k: Clocks) => number }> = [
  { key: "sys", label: "System Clock (SYSCLK)", hz: (k) => k.sys },
  { key: "hclk", label: "AHB Clock (HCLK)", hz: (k) => k.hclk },
  { key: "pclk1", label: "APB1 Clock (PCLK1)", hz: (k) => k.pclk1 },
  { key: "pclk2", label: "APB2 Clock (PCLK2)", hz: (k) => k.pclk2 },
  { key: "tim1x", label: "APB1 Timer Clock", hz: (k) => k.tim1x },
  { key: "adc", label: "ADC Clock (ADCCLK)", hz: (k) => k.adc },
  { key: "pll", label: "PLL Output", hz: (k) => k.pll },
  { key: "hse", label: "HSE Oscillator", hz: (k) => k.hse },
  { key: "hsi", label: "HSI Oscillator", hz: (k) => k.hsi },
  { key: "lsi", label: "LSI Oscillator", hz: (k) => k.lsi },
];
const SIG_OF: Partial<Record<Key, string>> = { hse: "hse", hsi: "hsi", lsi: "lsi", pll: "pll", sys: "sys", ahb: "hclk", cpu: "hclk", dma: "hclk", apb1: "pclk1", usart2: "pclk1", i2c1: "pclk1", tim2: "tim1x", apb2: "pclk2", usart1: "pclk2", tim1: "pclk2", adc: "adc" };

const C = { on: "#4ade80", pll: "#fbbf24", sel: "#38bdf8", off: "#475569" };

function Wave({ x, y, w, color }: { x: number; y: number; w: number; color: string }) {
  const n = 6, step = w / n;
  let d = `M${x} ${y + 8}`;
  for (let i = 0; i < n; i++) d += ` h${step / 2} V${y} h${step / 2} V${y + 8}`;
  return <path d={d} fill="none" stroke={color} strokeWidth={1.3} />;
}

export default function L10({ meta }: { meta: LabMeta }) {
  const lab = useLab<P>({
    slug: meta.slug, code: DEMO, params: { hseFail: false, wrongXtal: false },
    rebuildOn: ["wrongXtal"],
    mcu: (p, src) => {
      const hseValue = parseDraft(src).hseValue;
      building = newClockState(crystalOf(p, hseValue), hseValue);
      return { part: "F103", onCall: clockHook(building), constants: RCC_CONST };
    },
    setup: (m, p) => {
      const st = building ?? newClockState(8e6, 8e6);
      building = null;
      st.hseDead = p.hseFail;
      STATES.set(m, st);
      applyClocks(m, st);
      m.onReset = () => { st.cfg = { ...RCC_RESET }; st.css = false; st.stopped = ""; st.enabled.clear(); m.inReset = false; applyClocks(m, st); };
    },
    world: (m, _dt, p) => {
      const st = STATES.get(m);
      if (!st) return;
      if (m.fw) m.fw.ips = ipsFor(liveClocks(st).hclk);
      if (p.hseFail !== st.hseDead) {
        st.hseDead = p.hseFail;
        if (p.hseFail) hseFailure(m, st);
        else { m.log("info", "HSE crystal oscillating again (the firmware must re-run SystemClock_Config to use it)"); if (st.stopped) { st.stopped = ""; st.cfg = { ...st.cfg, hseOn: false }; } }
      }
    },
  });
  const { mcu, params } = lab;
  const fw = mcu.fw;
  const st = STATES.get(mcu) ?? newClockState(8e6, 8e6);
  const live = liveClocks(st);
  const draft = parseDraft(lab.code);
  const dk = clocksOf(draft.cfg, draft.hseValue);
  const issues = issuesOf(draft.cfg, draft.hseValue, dk);
  const [sel, setSel] = useState<Key>("pll");
  const [sig, setSig] = useState("sys");
  const [autoLat, setAutoLat] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const [seen, setSeen] = useState({ f72: false, f8: false, css: false });
  const samples = useRef<Array<[number, number]>>([]);

  useEffect(() => { if (pending !== null && lab.code === pending) { setPending(null); lab.run(); } }, [pending, lab]);

  const apply = (patch: Partial<RccConfig>, hse = draft.hseValue) => {
    const c: RccConfig = { ...draft.cfg, ...patch };
    if (patch.sysSrc === "PLL") c.pllOn = true;
    if (patch.pllOn === false && c.sysSrc === "PLL") c.sysSrc = c.hseOn ? "HSE" : "HSI";
    if (patch.hseOn === false) { if (c.sysSrc === "HSE") c.sysSrc = "HSI"; if (c.pllSrc !== "HSI_DIV2") c.pllSrc = "HSI_DIV2"; }
    if (patch.sysSrc === "HSE" || patch.pllSrc === "HSE" || patch.pllSrc === "HSE_DIV2") c.hseOn = true;
    if (autoLat && patch.latency === undefined) c.latency = clocksOf(c, hse).latencyNeeded;
    const src = withClockConfig(lab.code, c, hse);
    if (!src) { lab.setNotice("SystemClock_Config() was not found in the editor, so the configurator cannot update it."); return; }
    lab.setCode(src);
    setPending(src);
  };

  // Measurements derived from the running simulation.
  const edges = (mcu.edges.get("PA5") ?? []).filter(([t]) => t > mcu.time - 12);
  const gap = edges.length >= 2 ? (edges[edges.length - 1]![0] - edges[0]![0]) / (edges.length - 1) : 0;
  const blink = gap > 0 && mcu.time - edges[edges.length - 1]![0] < gap * 2.5 ? 1 / gap / 2 : 0;
  const loops = fw?.field("loops") ?? 0;
  const smp = samples.current;
  if (!smp.length || smp[smp.length - 1]![0] !== mcu.time) { if (smp.length && mcu.time < smp[smp.length - 1]![0]) smp.length = 0; smp.push([mcu.time, loops]); while (smp.length > 2 && mcu.time - smp[0]![0] > 1.2) smp.shift(); }
  const span = smp.length > 1 ? smp[smp.length - 1]![0] - smp[0]![0] : 0;
  const lps = span > 0.2 ? (smp[smp.length - 1]![1] - smp[0]![1]) / span : 0;
  const fwSys = fw?.field("sysclk") ?? 0;
  const running = !st.stopped && !fw?.error;
  if (!seen.f72 && running && live.sys === 72e6 && live.pclk1 <= 36e6) setSeen((s) => ({ ...s, f72: true }));
  if (!seen.f8 && running && fwSys === 8e6 && live.sys === 8e6) setSeen((s) => ({ ...s, f8: true }));
  if (!seen.css && mcu.events.some((e) => e.text.startsWith("CSS:"))) setSeen((s) => ({ ...s, css: true }));

  const c = st.cfg;
  const usesHse = c.sysSrc === "HSE" || (c.sysSrc === "PLL" && c.pllSrc !== "HSI_DIV2");
  const usesHsi = c.sysSrc === "HSI" || (c.sysSrc === "PLL" && c.pllSrc === "HSI_DIV2");
  const wire = (active: boolean, color = C.on) => ({ stroke: active ? color : C.off, strokeWidth: active ? 2.4 : 1.4, strokeDasharray: active ? undefined : "4 3", className: active && running ? "mcl-l10-flow" : undefined, filter: active ? "url(#l10-glow)" : undefined, fill: "none" });
  const enabled = (per: string) => !per || (mcu.clockGate(per) ? mcu.clockEnabled(per) : st.enabled.has(per));
  const statusOf = (per: string, hz: number, limit?: number) => (st.stopped || hz <= 0 ? ["Stopped", "bad"] : !enabled(per) ? ["Gated", "off"] : limit && hz > limit ? ["Over spec", "bad"] : ["Active", "ok"]);
  const pick = (key: Key) => { setSel(key); const s = SIG_OF[key]; if (s) setSig(s); };
  const hit = (key: Key) => ({
    onClick: () => pick(key),
    onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(key); } },
    role: "button" as const, tabIndex: 0, "aria-label": `Inspect ${key.toUpperCase()}`,
    className: `mcl-l10-blk ${sel === key ? "sel" : ""}`,
  });
  const frame = (key: Key, x: number, y: number, w: number, h: number, on: boolean, color = C.on) => (
    <rect x={x} y={y} width={w} height={h} rx={7} fill="#0f2142" stroke={sel === key ? "#fff" : on ? color : "#334155"} strokeWidth={sel === key ? 2.2 : on ? 1.8 : 1.2} filter={on ? "url(#l10-glow)" : undefined} />
  );

  const inspect: Record<Key, string> = {
    hse: `HSE crystal oscillator: ${fmt(st.hseHz)} fitted (firmware assumes HSE_VALUE = ${fmt(st.halHse)}). ${st.hseDead ? "Crystal is not oscillating." : c.hseOn ? "Running (HSERDY = 1)." : "Off until HAL_RCC_OscConfig enables it."} Valid range 4–16 MHz.`,
    hsi: `HSI internal RC: 8 MHz, ±1% at 25 °C. The core always restarts on HSI after reset. ${c.hsiOn ? "On." : "Off."}`,
    lsi: "LSI internal RC: ~40 kHz (30–60 kHz). Clocks the independent watchdog and optionally the RTC; it is not part of the system clock tree.",
    pll: c.pllOn ? `PLL: input ${c.pllSrc.replace("_DIV2", " / 2")} = ${fmt(live.pllIn)} × ${c.pllMul} = ${fmt(live.pll)}. Output must stay within 16–72 MHz; lock time ≈ 200 µs.` : "PLL is off. Enable it in the selector to multiply HSI/2 or HSE up to 72 MHz.",
    sys: `SYSCLK mux selects ${c.sysSrc}: ${fmt(live.sys)} (max 72 MHz). Flash latency ${c.latency} WS (needs ${live.latencyNeeded} at this speed).`,
    ahb: `AHB prescaler ÷${c.ahbDiv}: HCLK = ${fmt(live.hclk)} drives the core, memory, DMA and both APB bridges.`,
    apb1: `APB1 prescaler ÷${c.apb1Div}: PCLK1 = ${fmt(live.pclk1)} (max 36 MHz). Timers on APB1 get ${c.apb1Div === 1 ? "PCLK1" : "2 × PCLK1"} = ${fmt(live.tim1x)}.`,
    apb2: `APB2 prescaler ÷${c.apb2Div}: PCLK2 = ${fmt(live.pclk2)} (max 72 MHz). ADC prescaler ÷${c.adcDiv} gives ADCCLK = ${fmt(live.adc)} (max 14 MHz).`,
    cpu: `Cortex-M3 core at ${fmt(live.hclk)}: the main loop is completing ${Math.round(lps).toLocaleString()} iterations per second.`,
    systick: `SysTick counts HCLK / 8 = ${fmt(live.systick)}; HAL reprograms it so HAL_Delay keeps 1 ms ticks.`,
    dma: `DMA1 runs on HCLK ${fmt(live.hclk)}. ${enabled("DMA1") ? "Clock enabled." : "Gated: call __HAL_RCC_DMA1_CLK_ENABLE()."}`,
    tim2: `TIM2–TIM4 clock = ${fmt(live.tim1x)}. With PSC 7199 / ARR 4999 TIM2 overflows at ${fmt(live.tim1x / 7200 / 5000)}, so LD2 toggles at that rate.`,
    usart2: `USART2 on PCLK1 ${fmt(live.pclk1)}: BRR = PCLK1 / baud, so 115200 baud needs BRR ≈ ${Math.round(live.pclk1 / 115200)}.`,
    i2c1: `I2C1 on PCLK1 ${fmt(live.pclk1)}: needs ≥ 2 MHz for 100 kHz and ≥ 4 MHz for 400 kHz mode.`,
    tim1: `TIM1 clock = ${fmt(live.tim2x)} (${c.apb2Div === 1 ? "PCLK2" : "2 × PCLK2"}).`,
    adc: `ADCCLK = PCLK2 / ${c.adcDiv} = ${fmt(live.adc)}. Above 14 MHz conversions are out of specification.`,
    usart1: `USART1 and SPI1 run on PCLK2 ${fmt(live.pclk2)}.`,
  };
  const sigDef = SIGNALS.find((s) => s.key === sig) ?? SIGNALS[0]!;
  const sigHz = sigDef.hz(live);
  const windowS = sigHz >= 1e6 ? 250e-9 : sigHz > 0 ? 10 / sigHz : 1;
  const cycles = sigHz * windowS;
  const phase = (mcu.time * 0.37) % 1;
  let trace = "";
  if (sigHz > 0) {
    const W = 216, per = W / cycles;
    let x = -phase * per;
    trace = `M0 52`;
    for (let i = 0; i <= Math.ceil(cycles) + 1; i++) {
      const a = Math.max(0, x), b = Math.max(0, Math.min(W, x + per / 2)), e = Math.max(0, Math.min(W, x + per));
      if (b > a) trace += ` L${a.toFixed(1)} 52 L${a.toFixed(1)} 14 L${b.toFixed(1)} 14 L${b.toFixed(1)} 52`;
      if (e > b) trace += ` L${e.toFixed(1)} 52`;
      x += per;
    }
  }
  const draftLabel = (k: keyof Clocks) => fmt(dk[k] as number);

  return (
    <LabShell meta={meta} lab={lab} subtitle="Explore oscillators, PLL, prescalers, and peripheral clock trees."
      components={["NUCLEO-F103RB (STM32F103RB, Cortex-M3, max 72 MHz)", "HSE 8 MHz crystal (X3)", "HSI 8 MHz and LSI 40 kHz internal RC oscillators", "PLL ×2–×16, AHB / APB1 / APB2 / ADC prescalers", "LD2 user LED on PA5 (driven by TIM2)"]}>
      <div className="mcl-grid mcl-l10-grid">
        <Panel title="Clock Tree Visualization" icon="activity" className="mcl-sim mcl-l10-tree" tools={<span className={`mcl-chip ${running ? "mcl-chip-live" : ""}`}>{st.stopped ? "Stopped" : fw?.error ? "HardFault" : "Real-time"}</span>}>
          <svg viewBox="0 0 660 360" className="mcl-svg mcl-l10-svg" role="img" aria-label="STM32F103 clock tree">
            <defs>
              <filter id="l10-glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.6" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
              <pattern id="l10-grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="#13284d" strokeWidth="0.6" /></pattern>
            </defs>
            <rect width={660} height={360} rx={10} fill="#0a1730" />
            <rect width={660} height={360} rx={10} fill="url(#l10-grid)" />

            {/* oscillator to PLL / SYSCLK routing */}
            <path d="M148 51 H214 V122" {...wire(c.pllOn && c.pllSrc !== "HSI_DIV2" && live.hse > 0, C.sel)} />
            <path d="M214 51 H306 V146 H318" {...wire(c.sysSrc === "HSE" && live.hse > 0)} />
            <path d="M148 149 H166 V162 H190" {...wire(c.pllOn && c.pllSrc === "HSI_DIV2" && live.hsi > 0, C.sel)} />
            <text x={170} y={176} fontSize="9" fill="#94a3b8">÷2</text>
            <path d="M166 149 V226 H302 V178 H318" {...wire(c.sysSrc === "HSI" && live.hsi > 0)} />
            <path d="M292 162 H318" {...wire(c.sysSrc === "PLL" && live.pll > 0, C.pll)} />
            <path d="M412 162 H426" {...wire(live.sys > 0)} />
            <path d="M472 162 H484 M484 23 V284 M484 23 H560 M484 59 H560 M484 95 H560 M484 164 H496 M484 284 H496" {...wire(live.hclk > 0)} />
            <path d="M542 164 H550 M550 143 V215 M550 143 H560 M550 179 H560 M550 215 H560" {...wire(live.pclk1 > 0)} />
            <path d="M542 284 H550 M550 263 V335 M550 263 H560 M550 299 H560 M550 335 H560" {...wire(live.pclk2 > 0)} />
            <path d="M122 247 H156" {...wire(true, "#a78bfa")} />
            <text x={160} y={250} fontSize="9" fill="#a5b4fc">IWDG · RTC</text>

            {/* oscillators */}
            {([["hse", 12, "HSE", "External Crystal", live.hse || st.hseHz, usesHse && live.hse > 0, draft.cfg.hseOn], ["hsi", 110, "HSI", "Internal RC", 8e6, usesHsi && live.hsi > 0, draft.cfg.hsiOn], ["lsi", 208, "LSI", "Low Speed RC", 40e3, true, true]] as Array<[Key, number, string, string, number, boolean, boolean]>).map(([key, y, name, sub, hz, on, sw]) => (
              <g key={key} {...hit(key)}>
                {frame(key, 10, y, 112, 78, on, key === "lsi" ? "#a78bfa" : C.sel)}
                <rect x={18} y={y + 10} width={22} height={30} rx={3} fill="#1e3a66" stroke="#64748b" />
                <rect x={23} y={y + 16} width={12} height={18} rx={2} fill={key === "hse" ? "#cbd5e1" : "#94a3b8"} />
                <text x={48} y={y + 20} fontSize="13" fontWeight="800" fill="#fff">{name}</text>
                <text x={48} y={y + 33} fontSize="8.5" fill="#94a3b8">{sub}</text>
                <text x={18} y={y + 56} fontSize="11.5" fontWeight="800" fill={key === "hse" && st.hseDead ? "#f87171" : "#e2e8f0"}>{key === "hse" && st.hseDead ? "FAILED" : fmt(hz)}</text>
                <Wave x={18} y={y + 62} w={60} color={on ? (key === "lsi" ? "#a78bfa" : C.on) : C.off} />
                {key !== "lsi" ? (
                  <g className="mcl-l10-switch" onClick={(e) => { e.stopPropagation(); apply(key === "hse" ? { hseOn: !sw } : { hsiOn: !sw }); }} role="switch" aria-checked={sw} aria-label={`${name} oscillator`}>
                    <rect x={124} y={y + 30} width={24} height={14} rx={7} fill={sw ? "#2563eb" : "#334155"} />
                    <circle cx={sw ? 141 : 131} cy={y + 37} r={5} fill="#fff" />
                  </g>
                ) : null}
              </g>
            ))}

            {/* PLL */}
            <g {...hit("pll")}>
              {frame("pll", 190, 122, 102, 80, c.pllOn && live.pll > 0, C.pll)}
              <circle cx={206} cy={140} r={9} fill="#1d4ed8" /><text x={206} y={144} textAnchor="middle" fontSize="11" fill="#fff">⚙</text>
              <text x={222} y={138} fontSize="11.5" fontWeight="800" fill="#fff">PLL</text>
              <text x={222} y={151} fontSize="10" fontWeight="700" fill={C.pll}>× {c.pllMul}</text>
              <text x={198} y={168} fontSize="8.5" fill="#cbd5e1">IN: {fmt(live.pllIn)}</text>
              <text x={198} y={180} fontSize="8.5" fill="#cbd5e1">OUT: {c.pllOn ? fmt(live.pll) : "off"}</text>
              <Wave x={198} y={186} w={84} color={c.pllOn && live.pll > 0 ? C.pll : C.off} />
            </g>

            {/* SYSCLK mux */}
            <g {...hit("sys")}>
              {frame("sys", 318, 132, 94, 60, live.sys > 0)}
              <text x={365} y={150} textAnchor="middle" fontSize="9.5" fill="#cbd5e1">System Clock</text>
              <text x={365} y={162} textAnchor="middle" fontSize="9" fontWeight="700" fill="#94a3b8">SYSCLK · {c.sysSrc}</text>
              <text x={365} y={181} textAnchor="middle" fontSize="13" fontWeight="800" fill={live.sys > 72e6 ? "#f87171" : "#fff"}>{fmt(live.sys)}</text>
            </g>

            {/* bus prescalers */}
            {([["ahb", 426, 142, "AHB", c.ahbDiv, "HCLK", live.hclk, 432, 200], ["apb1", 496, 144, "APB1", c.apb1Div, "PCLK1", live.pclk1, 490, 120], ["apb2", 496, 264, "APB2", c.apb2Div, "PCLK2", live.pclk2, 490, 240]] as Array<[Key, number, number, string, number, string, number, number, number]>).map(([key, x, y, name, div, clk, hz, lx, ly]) => (
              <g key={key}>
                <g {...hit(key)}>
                  {frame(key, x, y, 46, 40, hz > 0)}
                  <text x={x + 23} y={y + 16} textAnchor="middle" fontSize="9.5" fontWeight="800" fill="#fff">{name}</text>
                  <text x={x + 23} y={y + 31} textAnchor="middle" fontSize="10" fill="#cbd5e1">/ {div}</text>
                </g>
                <text x={lx} y={ly} fontSize="8.5" fill="#94a3b8">{clk}</text>
                <text x={lx} y={ly + 11} fontSize="9.5" fontWeight="800" fill={key === "apb1" && hz > 36e6 ? "#f87171" : C.on}>{fmt(hz)}</text>
              </g>
            ))}

            {/* clocked peripherals */}
            {OUTS.map((o) => {
              const hz = o.hz(live);
              const [, tone] = statusOf(o.per, hz, o.limit);
              const on = tone === "ok";
              return (
                <g key={o.key} {...hit(o.key)}>
                  {frame(o.key, 560, o.y, 94, 30, on)}
                  <text x={568} y={o.y + 13} fontSize="9" fontWeight="800" fill="#fff">{o.name}</text>
                  <text x={568} y={o.y + 25} fontSize="9" fontWeight="700" fill={tone === "bad" ? "#f87171" : on ? C.on : "#94a3b8"}>{fmt(hz)}</text>
                  <circle cx={645} cy={o.y + 10} r={3.5} fill={tone === "bad" ? "#ef4444" : on ? "#22c55e" : "#64748b"} />
                </g>
              );
            })}
            <text x={497} y={318} fontSize="8.5" fill="#94a3b8">ADC ÷{c.adcDiv}</text>

            <g transform="translate(10 292)">
              <rect width={232} height={60} rx={6} fill="#0f2142" stroke="#334155" />
              <text x={10} y={15} fontSize="9.5" fontWeight="800" fill="#fff">Signal Legend</text>
              {([[C.on, "Active clock", 10, 30], [C.pll, "PLL output", 134, 30], [C.sel, "Selected PLL source", 10, 47], [C.off, "Inactive", 134, 47]] as Array<[string, string, number, number]>).map(([col, t, x, y]) => (
                <g key={t}><line x1={x} y1={y} x2={x + 18} y2={y} stroke={col} strokeWidth={2.4} /><text x={x + 24} y={y + 3} fontSize="8.5" fill="#cbd5e1">{t}</text></g>
              ))}
            </g>
          </svg>
          <div className="mcl-l10-inspect" role="status"><Icon name="bulb" /><span>{inspect[sel]}</span></div>
          <div className="mcl-l10-status">
            <span><i className={blink > 0 ? "ok" : "off"} />LD2 (PA5): {blink > 0 ? `${blink.toFixed(2)} Hz blink` : "not blinking"}</span>
            <span><i className={lps > 0 ? "ok" : "off"} />CPU loop: {Math.round(lps).toLocaleString()} / s</span>
            <span>Resets: {mcu.resets}</span>
            {st.stopped ? <b className="bad">{st.stopped}</b> : fw?.error ? <b className="bad">{fw.error.message}</b> : null}
          </div>
        </Panel>

        <Panel title="Clock Source Selector" icon="sliders" className="mcl-l10-sel">
          <label className="mcl-l10-row col"><span>System Clock Source</span>
            <select className="mcl-input" value={draft.cfg.sysSrc} onChange={(e) => apply({ sysSrc: e.target.value as SysSrc })} aria-label="System clock source">
              <option value="HSI">HSI (8 MHz internal)</option><option value="HSE">HSE ({fmt(draft.hseValue)})</option><option value="PLL">PLL ({draftLabel("pll")})</option>
            </select>
          </label>
          <div className="mcl-l10-row sw"><Toggle label="External Crystal (HSE)" checked={draft.cfg.hseOn} onChange={(v) => apply({ hseOn: v })} /></div>
          <label className="mcl-l10-row"><span>Frequency</span>
            <select className="mcl-input sm" value={draft.hseValue} onChange={(e) => apply({}, Number(e.target.value))} aria-label="HSE crystal frequency">
              {[4, 6, 8, 10, 12, 16].map((v) => <option key={v} value={v * 1e6}>{v} MHz</option>)}
            </select>
          </label>
          <div className="mcl-l10-row sw"><Toggle label="Internal RC (HSI)" checked={draft.cfg.hsiOn} onChange={(v) => apply({ hsiOn: v })} /></div>
          <label className="mcl-l10-row"><span>Frequency</span><input className="mcl-input sm" value="8 MHz" disabled aria-label="HSI frequency" /></label>
          <div className="mcl-l10-row sw head"><Toggle label={<b>PLL Configuration</b>} checked={draft.cfg.pllOn} onChange={(v) => apply({ pllOn: v })} /></div>
          <label className="mcl-l10-row"><span>Source</span>
            <select className="mcl-input sm" value={draft.cfg.pllSrc} disabled={!draft.cfg.pllOn} onChange={(e) => apply({ pllSrc: e.target.value as PllSrc })} aria-label="PLL source">
              <option value="HSI_DIV2">HSI / 2 (4 MHz)</option><option value="HSE">HSE ({fmt(draft.hseValue)})</option><option value="HSE_DIV2">HSE / 2 ({fmt(draft.hseValue / 2)})</option>
            </select>
          </label>
          <label className="mcl-l10-row"><span>Multiplier</span>
            <select className="mcl-input sm" value={draft.cfg.pllMul} disabled={!draft.cfg.pllOn} onChange={(e) => apply({ pllMul: Number(e.target.value) })} aria-label="PLL multiplier">
              {Array.from({ length: 15 }, (_, i) => i + 2).map((v) => <option key={v} value={v}>× {v}</option>)}
            </select>
          </label>
          <div className={`mcl-l10-pllout ${dk.pll > 72e6 || (draft.cfg.pllOn && dk.pll < 16e6) ? "bad" : ""}`}><Icon name={dk.pll > 72e6 ? "alert" : "check"} />PLL Output: {draft.cfg.pllOn ? draftLabel("pll") : "off"}</div>
          {([["AHB Prescaler", "ahbDiv", AHB_DIVS, "sys"], ["APB1 Prescaler", "apb1Div", APB_DIVS, "hclk"], ["APB2 Prescaler", "apb2Div", APB_DIVS, "hclk"], ["ADC Prescaler", "adcDiv", ADC_DIVS, "pclk2"]] as Array<[string, "ahbDiv" | "apb1Div" | "apb2Div" | "adcDiv", number[], keyof Clocks]>).map(([label, field, divs, base]) => (
            <label key={field} className="mcl-l10-row"><span>{label}</span>
              <select className="mcl-input sm" value={draft.cfg[field]} onChange={(e) => apply({ [field]: Number(e.target.value) })} aria-label={label}>
                {divs.map((d) => <option key={d} value={d}>/ {d} ({fmt((dk[base] as number) / d)})</option>)}
              </select>
            </label>
          ))}
          <label className="mcl-l10-row"><span>Flash Latency</span>
            <select className="mcl-input sm" value={draft.cfg.latency} onChange={(e) => apply({ latency: Number(e.target.value) })} aria-label="Flash latency">
              {[0, 1, 2].map((l) => <option key={l} value={l}>{l} WS{l === dk.latencyNeeded ? " (required)" : ""}</option>)}
            </select>
          </label>
          <Toggle label="Auto wait states" checked={autoLat} onChange={setAutoLat} hint="Pick the minimum flash latency for SYSCLK, like CubeMX" />
          {issues.length ? <ul className="mcl-l10-issues">{issues.map((i) => <li key={i.key + i.text} className={i.level}><Icon name="alert" />{i.text}</li>)}</ul> : <p className="mcl-l10-ok"><Icon name="check" />Configuration is within STM32F103 limits.</p>}
          <small className="mcl-muted">Every change rewrites SystemClock_Config() in the editor and re-runs the firmware.</small>
        </Panel>

        <div className="mcl-col mcl-l10-side">
          <Panel title="Frequency Summary" icon="gauge">
            <ul className="mcl-l10-sum">
              {([["HSE (External)", live.hse, "#2563eb"], ["HSI (Internal)", live.hsi, "#94a3b8"], ["LSI (Low Speed)", live.lsi, "#8b5cf6"], ["PLL Output", live.pll, "#f59e0b"]] as Array<[string, number, string]>).map(([t, hz, col]) => (
                <li key={t}><i style={{ background: col }} /><span>{t}</span><b style={{ color: col === "#94a3b8" ? "#475569" : col }}>{fmt(hz)}</b></li>
              ))}
              <li className="sep" />
              {([["System Clock (SYSCLK)", live.sys, 72e6], ["AHB Clock (HCLK)", live.hclk, 72e6], ["APB1 Clock (PCLK1)", live.pclk1, 36e6], ["APB2 Clock (PCLK2)", live.pclk2, 72e6], ["ADC Clock", live.adc, 14e6]] as Array<[string, number, number]>).map(([t, hz, lim]) => (
                <li key={t}><i style={{ background: hz > lim ? "#ef4444" : "#16a34a" }} /><span>{t}</span><b className={hz > lim ? "bad" : "good"}>{fmt(hz)}</b></li>
              ))}
            </ul>
            <div className={`mcl-l10-fwsees ${fwSys && Math.abs(fwSys - live.sys) > 1 ? "bad" : ""}`}>
              <small>Firmware reads HAL_RCC_GetSysClockFreq()</small>
              <b>{fwSys ? fmt(fwSys) : "not read yet"}</b>
              {fwSys && Math.abs(fwSys - live.sys) > 1 ? <small>HSE_VALUE ({fmt(st.halHse)}) does not match the fitted crystal ({fmt(st.hseHz)}), so every computed baud rate and delay is off by {(live.sys / fwSys).toFixed(2)}×.</small> : null}            </div>
          </Panel>
          <Panel title="Clock Waveform Display" icon="wave">
            <label className="mcl-l10-row"><span>Show Signal</span>
              <select className="mcl-input sm" value={sig} onChange={(e) => setSig(e.target.value)} aria-label="Waveform signal">
                {SIGNALS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </label>
            <div className="mcl-l10-scope">
              <svg viewBox="0 0 216 70" role="img" aria-label={`${sigDef.label} waveform`}>
                <rect width={216} height={70} fill="#06101f" />
                {[1, 2, 3].map((i) => <line key={i} x1={i * 54} y1={0} x2={i * 54} y2={70} stroke="#132849" />)}
                <line x1={0} y1={33} x2={216} y2={33} stroke="#132849" />
                {trace ? <path d={trace} fill="none" stroke="#38bdf8" strokeWidth={1.4} /> : <text x={108} y={38} textAnchor="middle" fontSize="10" fill="#f87171">No clock</text>}
                <text x={212} y={11} textAnchor="end" fontSize="9" fontWeight="700" fill="#e2e8f0">{fmt(sigHz)}</text>
              </svg>
              <div><span>Period: {sigHz > 0 ? fmtT(1 / sigHz) : "—"}</span><span>Window: {fmtT(windowS)}</span><span>Frequency: {Math.round(sigHz).toLocaleString()} Hz</span></div>
            </div>
          </Panel>
        </div>

        <CodeEditor lab={lab} className="mcl-l10-code" languages={[{ label: "C (STM32)", code: DEMO }, { label: "C (HSI 8 MHz)", code: HSI_ONLY }]} />

        <Panel title="Peripheral Clock Status" icon="chip" className="mcl-l10-per">
          <table className="mcl-table mcl-l10-tbl">
            <thead><tr><th>Peripheral</th><th>Clock Source</th><th>Frequency</th><th>Status</th></tr></thead>
            <tbody>
              {TABLE.map((r) => {
                const hz = r.hz(live);
                const [label, tone] = statusOf(r.per, hz, r.limit);
                return (
                  <tr key={r.name}>
                    <td><Icon name={r.icon} />{r.name}</td>
                    <td>{r.src(c)}</td>
                    <td className="mcl-mono">{fmt(hz)}</td>
                    <td><span className={`mcl-l10-pill ${tone}`}>{label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="mcl-l10-faults">
            <b><Icon name="bug" />Fault injection</b>
            <Toggle label="HSE crystal failure" checked={params.hseFail} onChange={(v) => lab.setParam("hseFail", v)} hint="The crystal stops oscillating; with CSS armed the MCU falls back to HSI, without it the core freezes" />
            <Toggle label="Wrong crystal fitted" checked={params.wrongXtal} onChange={(v) => lab.setParam("wrongXtal", v)} hint={`Board carries a ${fmt(crystalOf({ hseFail: false, wrongXtal: true }, draft.hseValue))} crystal while the code assumes HSE_VALUE = ${fmt(draft.hseValue)}`} />
          </div>
        </Panel>

        <div className="mcl-l10-notes"><LearningNotes notes={{
          takeaways: ["Understand the different clock sources (HSE, HSI, LSI).", "Learn how the PLL multiplies the input frequency.", "See how AHB and APB prescalers divide the system clock.", "Explore how different peripherals receive their clock signals.", "Experiment with different clock configurations and observe how it affects peripheral speeds.", "Use the waveform display to visualize clock signals in real time."],
          observe: "LD2 blinks at 1 Hz because TIM2 divides its 72 MHz APB1 timer clock by 7200 × 5000.",
          tryIt: "Set the PLL multiplier to ×6 (48 MHz): the LED slows down and the CPU loop rate drops by a third.",
          measure: `SYSCLK ${fmt(live.sys)} · LD2 ${blink ? blink.toFixed(2) : "0"} Hz · CPU loop ${Math.round(lps).toLocaleString()} / s.`,
          modify: "Turn off Auto wait states and pick 0 WS at 72 MHz, or push the multiplier to ×16.",
          runAgain: "Inject an HSE failure with and without HAL_RCC_EnableCSS() in main().",
          challenge: "Try running the system at 8 MHz (HSI, no PLL) and compare peripheral frequencies. What changes?",
          question: "Without the PLL the whole tree runs from 8 MHz: TIM2 gets 8 MHz so LD2 blinks 9× slower, and the CPU executes 9× fewer instructions per second.",
          checks: [{ label: "Ran the tree at 72 MHz within limits", done: seen.f72 }, { label: "Ran from HSI at 8 MHz", done: seen.f8 }, { label: "Saw CSS rescue an HSE failure", done: seen.css }],
        }} /></div>
      </div>
    </LabShell>
  );
}
