import { Block, toNum, type Val } from "../core/cinterp";
import type { CallHook, Mcu } from "../core/mcu";
import { adcFromCode, ahbFromCode, apbFromCode, clocksOf, RCC_RESET, type Clocks, type PllSrc, type RccConfig, type SysSrc } from "./rcc";

/** Hardware clock state behind the lab's HAL_RCC_* implementation. `cfg` is what the silicon is actually running. */
export interface ClockState {
  cfg: RccConfig;
  hseHz: number;      // crystal physically fitted
  halHse: number;     // HSE_VALUE the firmware was compiled with
  hseDead: boolean;
  css: boolean;
  stopped: string;
  enabled: Set<string>;
}

export const newClockState = (hseHz: number, halHse: number): ClockState => ({ cfg: { ...RCC_RESET }, hseHz, halHse, hseDead: false, css: false, stopped: "", enabled: new Set() });

export const liveClocks = (st: ClockState): Clocks => clocksOf(st.cfg, st.hseHz, !st.hseDead);
/** What HAL_RCC_Get*Freq() report: same tree, but computed from HSE_VALUE instead of the real crystal. */
export const halClocks = (st: ClockState): Clocks => clocksOf(st.cfg, st.halHse, true);

/** Instruction rate of the simulated core scales with HCLK so a slower clock visibly slows the firmware. */
export const ipsFor = (hclk: number) => Math.max(2000, Math.round(hclk / 480));

export function applyClocks(m: Mcu, st: ClockState) {
  const k = liveClocks(st);
  m.clock = k.hclk || 1;
  m.timerClockOf = (tim) => (tim === "TIM1" ? k.tim2x : k.tim1x) || 1;
  if (m.fw) m.fw.ips = ipsFor(k.hclk);
}

const refName = (v: Val | undefined) => (typeof v === "string" ? v : v && typeof v === "object" && v.kind === "ref" ? v.name : "");
const mhz = (hz: number) => `${+(hz / 1e6).toFixed(3)} MHz`;
const after = (m: Mcu, secs: number, result: number) => { const until = m.now + secs; return new Block(() => m.now >= until, secs + 1, () => result, "RCC"); };

function sourceReady(c: RccConfig, st: ClockState, src: SysSrc | PllSrc): boolean {
  if (src === "HSI" || src === "HSI_DIV2") return c.hsiOn;
  if (src === "PLL") return c.pllOn && sourceReady(c, st, c.pllSrc);
  return c.hseOn && !st.hseDead;
}

export function clockHook(st: ClockState): CallHook {
  return (name, args, m) => {
    const fw = m.fw;
    if (!fw) return undefined;
    const ce = name.match(/^__HAL_RCC_(\w+?)_CLK_ENABLE$/);
    if (ce) { st.enabled.add(ce[1]!); return undefined; }
    const f = (path: string) => fw.field(path) ?? 0;
    const hal = halClocks(st);
    switch (name) {
      case "HAL_RCC_OscConfig": {
        const s = refName(args[0]);
        const type = f(`${s}.OscillatorType`);
        const cur = st.cfg, next = { ...cur };
        const pllRunning = cur.sysSrc === "PLL";
        let wait = 0;
        if (type & 1) {
          const on = f(`${s}.HSEState`) !== 0;
          if (!on && (cur.sysSrc === "HSE" || (pllRunning && cur.pllSrc !== "HSI_DIV2"))) { m.log("fault", "HAL_RCC_OscConfig: HSE drives SYSCLK and cannot be switched off (HAL_ERROR)"); return 1; }
          if (on && !cur.hseOn) {
            if (st.hseDead) { m.log("fault", "HSE crystal did not start: HSERDY never set, HAL_RCC_OscConfig timed out after 100 ms (HAL_TIMEOUT)"); return after(m, 0.1, 3); }
            wait += 1.5e-3;
            m.log("info", `HSE crystal ${mhz(st.hseHz)} started (HSERDY after ~1.5 ms)`);
          }
          next.hseOn = on;
        }
        if (type & 2) {
          const on = f(`${s}.HSIState`) !== 0;
          if (!on && (cur.sysSrc === "HSI" || (pllRunning && cur.pllSrc === "HSI_DIV2"))) m.log("info", "HSI is in use by SYSCLK, so it stays on");
          else next.hsiOn = on;
        }
        const pll = f(`${s}.PLL.PLLState`);
        if (pll === 1 || pll === 2) {
          if (pllRunning) { m.log("fault", "HAL_RCC_OscConfig: the PLL cannot be reconfigured while it drives SYSCLK (HAL_ERROR)"); return 1; }
          next.pllOn = pll === 2;
          if (pll === 2) {
            next.pllSrc = f(`${s}.PLL.PLLSource`) ? (f(`${s}.HSEPredivValue`) ? "HSE_DIV2" : "HSE") : "HSI_DIV2";
            next.pllMul = Math.min(16, Math.max(2, (f(`${s}.PLL.PLLMUL`) >> 18) + 2));
            if (!sourceReady(next, st, next.pllSrc)) { m.log("fault", "PLL input clock is not running: PLLRDY timeout (HAL_TIMEOUT)"); return after(m, 0.1, 3); }
            wait += 200e-6;
            m.log("info", `PLL locked: ${next.pllSrc.replace("_DIV2", "/2")} x ${next.pllMul} = ${mhz(clocksOf(next, st.hseHz).pll)}`);
          }
        }
        st.cfg = next;
        applyClocks(m, st);
        return wait ? after(m, wait, 0) : 0;
      }
      case "HAL_RCC_ClockConfig": {
        const s = refName(args[0]);
        const type = f(`${s}.ClockType`), latency = toNum(args[1] ?? 0) & 7;
        const next = { ...st.cfg, latency };
        if (type & 1) {
          const sw = f(`${s}.SYSCLKSource`);
          const src: SysSrc = sw === 2 ? "PLL" : sw === 1 ? "HSE" : "HSI";
          if (!sourceReady(next, st, src)) { m.log("fault", `HAL_RCC_ClockConfig: ${src} is not ready, SYSCLK switch refused (HAL_ERROR)`); return 1; }
          next.sysSrc = src;
        }
        if (type & 2) next.ahbDiv = ahbFromCode(f(`${s}.AHBCLKDivider`));
        if (type & 4) next.apb1Div = apbFromCode(f(`${s}.APB1CLKDivider`));
        if (type & 8) next.apb2Div = apbFromCode(f(`${s}.APB2CLKDivider`));
        st.cfg = next;
        applyClocks(m, st);
        const k = liveClocks(st);
        m.log("info", `SYSCLK = ${next.sysSrc} ${mhz(k.sys)}, HCLK ${mhz(k.hclk)}, PCLK1 ${mhz(k.pclk1)}, PCLK2 ${mhz(k.pclk2)}, ${latency} flash wait state${latency === 1 ? "" : "s"}`);
        const crash = (text: string) => { m.log("fault", text); m.fw?.fail(new Error(text), m.fw.line); };
        if (latency < k.latencyNeeded) m.schedule(m.time + 50e-6, () => crash(`HardFault: Flash read at ${mhz(k.sys)} with only ${latency} wait state${latency === 1 ? "" : "s"} (needs ${k.latencyNeeded}): the core fetched corrupted instructions`));
        else if (k.sys > 72e6) m.schedule(m.time + 0.25, () => crash(`HardFault: core overclocked at ${mhz(k.sys)} (maximum 72 MHz) became unstable`));
        else if (k.pclk1 > 36e6) m.log("fault", `PCLK1 ${mhz(k.pclk1)} exceeds 36 MHz: APB1 peripherals are out of specification`);
        return 0;
      }
      case "__HAL_RCC_ADC_CONFIG": st.cfg = { ...st.cfg, adcDiv: adcFromCode(toNum(args[0] ?? 0)) }; return 0;
      case "HAL_RCC_EnableCSS": st.css = true; m.log("info", "Clock security system armed: an HSE failure will fall back to HSI"); return 0;
      case "HAL_RCC_DisableCSS": st.css = false; return 0;
      case "HAL_RCC_GetSysClockFreq": return Math.round(hal.sys);
      case "HAL_RCC_GetHCLKFreq": return Math.round(hal.hclk);
      case "HAL_RCC_GetPCLK1Freq": return Math.round(hal.pclk1);
      case "HAL_RCC_GetPCLK2Freq": return Math.round(hal.pclk2);
    }
    return undefined;
  };
}

/** Called when the HSE crystal fails while the firmware runs: CSS falls back to HSI, otherwise the core stops. */
export function hseFailure(m: Mcu, st: ClockState) {
  const c = st.cfg;
  const uses = c.sysSrc === "HSE" || (c.sysSrc === "PLL" && c.pllSrc !== "HSI_DIV2");
  if (!c.hseOn) return;
  if (!uses) { m.log("fault", "HSE crystal stopped (not used by SYSCLK, no effect on the core)"); return; }
  if (st.css) {
    st.cfg = { ...c, hseOn: false, pllOn: false, hsiOn: true, sysSrc: "HSI", ahbDiv: 1 };
    applyClocks(m, st);
    m.log("fault", "CSS: HSE failure detected, NMI raised, SYSCLK switched to HSI 8 MHz and the PLL disabled");
  } else {
    st.stopped = "HSE failed with CSS disabled: SYSCLK has no clock and the core is frozen";
    applyClocks(m, st);
    m.inReset = true;
    m.log("fault", st.stopped);
  }
}
