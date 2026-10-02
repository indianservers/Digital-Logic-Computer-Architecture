/* STM32F103 reset & clock control model (RM0008 §7): oscillators, PLL, bus prescalers and limits. */

export type SysSrc = "HSI" | "HSE" | "PLL";
export type PllSrc = "HSI_DIV2" | "HSE" | "HSE_DIV2";
export interface RccConfig {
  hseOn: boolean; hsiOn: boolean; pllOn: boolean;
  pllSrc: PllSrc; pllMul: number; sysSrc: SysSrc;
  ahbDiv: number; apb1Div: number; apb2Div: number; adcDiv: number; latency: number;
}
export const RCC_RESET: RccConfig = { hseOn: false, hsiOn: true, pllOn: false, pllSrc: "HSI_DIV2", pllMul: 2, sysSrc: "HSI", ahbDiv: 1, apb1Div: 1, apb2Div: 1, adcDiv: 2, latency: 0 };
export const HSI_HZ = 8e6, LSI_HZ = 40e3;
export const LIMITS = { sys: 72e6, pclk1: 36e6, pclk2: 72e6, adc: 14e6, pllMin: 16e6, hseMin: 4e6, hseMax: 16e6 };
export const AHB_DIVS = [1, 2, 4, 8, 16, 64, 128, 256, 512];
export const APB_DIVS = [1, 2, 4, 8, 16];
export const ADC_DIVS = [2, 4, 6, 8];

export interface Clocks {
  hse: number; hsi: number; lsi: number; pllIn: number; pll: number; sys: number; hclk: number;
  pclk1: number; pclk2: number; tim1x: number; tim2x: number; adc: number; systick: number; latencyNeeded: number;
}
export interface ClockIssue { level: "error" | "warn"; key: string; text: string }

export function clocksOf(c: RccConfig, hseHz: number, hseOk = true): Clocks {
  const hse = c.hseOn && hseOk ? hseHz : 0, hsi = c.hsiOn ? HSI_HZ : 0;
  const pllIn = c.pllSrc === "HSI_DIV2" ? hsi / 2 : c.pllSrc === "HSE" ? hse : hse / 2;
  const pll = c.pllOn ? pllIn * c.pllMul : 0;
  const sys = c.sysSrc === "HSI" ? hsi : c.sysSrc === "HSE" ? hse : pll;
  const hclk = sys / c.ahbDiv, pclk1 = hclk / c.apb1Div, pclk2 = hclk / c.apb2Div;
  return {
    hse, hsi, lsi: LSI_HZ, pllIn, pll, sys, hclk, pclk1, pclk2,
    tim1x: c.apb1Div === 1 ? pclk1 : pclk1 * 2, tim2x: c.apb2Div === 1 ? pclk2 : pclk2 * 2,
    adc: pclk2 / c.adcDiv, systick: hclk / 8, latencyNeeded: sys <= 24e6 ? 0 : sys <= 48e6 ? 1 : 2,
  };
}

const mhz = (hz: number) => `${+(hz / 1e6).toFixed(3)} MHz`;
export function issuesOf(c: RccConfig, hseHz: number, k: Clocks): ClockIssue[] {
  const out: ClockIssue[] = [];
  if (c.hseOn && (hseHz < LIMITS.hseMin || hseHz > LIMITS.hseMax)) out.push({ level: "error", key: "hse", text: `HSE crystal ${mhz(hseHz)} is outside the 4–16 MHz range` });
  if (c.pllOn && k.pll > LIMITS.sys) out.push({ level: "error", key: "pll", text: `PLL output ${mhz(k.pll)} exceeds the 72 MHz maximum` });
  if (c.pllOn && k.pll > 0 && k.pll < LIMITS.pllMin) out.push({ level: "warn", key: "pll", text: `PLL output ${mhz(k.pll)} is below the 16 MHz minimum` });
  if (k.sys > LIMITS.sys) out.push({ level: "error", key: "sys", text: `SYSCLK ${mhz(k.sys)} > 72 MHz: device is overclocked` });
  if (k.pclk1 > LIMITS.pclk1) out.push({ level: "error", key: "apb1", text: `PCLK1 ${mhz(k.pclk1)} > 36 MHz: raise the APB1 prescaler` });
  if (k.adc > LIMITS.adc) out.push({ level: "warn", key: "adc", text: `ADCCLK ${mhz(k.adc)} > 14 MHz: conversions are out of spec` });
  if (c.latency < k.latencyNeeded) out.push({ level: "error", key: "flash", text: `FLASH_LATENCY_${c.latency} is too low for ${mhz(k.sys)} (needs ${k.latencyNeeded} wait state${k.latencyNeeded > 1 ? "s" : ""})` });
  return out;
}

/** HAL constant values for the F1 RCC driver. */
export const RCC_CONST: Record<string, number> = {
  RCC_OSCILLATORTYPE_NONE: 0, RCC_OSCILLATORTYPE_HSE: 1, RCC_OSCILLATORTYPE_HSI: 2, RCC_OSCILLATORTYPE_LSE: 4, RCC_OSCILLATORTYPE_LSI: 8,
  RCC_HSE_OFF: 0, RCC_HSE_ON: 0x10000, RCC_HSE_BYPASS: 0x50000, RCC_HSI_OFF: 0, RCC_HSI_ON: 1, RCC_LSI_OFF: 0, RCC_LSI_ON: 1, RCC_LSE_OFF: 0, RCC_LSE_ON: 1,
  RCC_HSICALIBRATION_DEFAULT: 0x10, RCC_PLL_NONE: 0, RCC_PLL_OFF: 1, RCC_PLL_ON: 2,
  RCC_PLLSOURCE_HSI_DIV2: 0, RCC_PLLSOURCE_HSE: 0x10000, RCC_HSE_PREDIV_DIV1: 0, RCC_HSE_PREDIV_DIV2: 0x20000,
  RCC_CLOCKTYPE_SYSCLK: 1, RCC_CLOCKTYPE_HCLK: 2, RCC_CLOCKTYPE_PCLK1: 4, RCC_CLOCKTYPE_PCLK2: 8,
  RCC_SYSCLKSOURCE_HSI: 0, RCC_SYSCLKSOURCE_HSE: 1, RCC_SYSCLKSOURCE_PLLCLK: 2,
  FLASH_LATENCY_0: 0, FLASH_LATENCY_1: 1, FLASH_LATENCY_2: 2, HAL_BUSY: 2, HAL_TIMEOUT: 3,
};
for (let n = 2; n <= 16; n++) RCC_CONST[`RCC_PLL_MUL${n}`] = (n - 2) << 18;
AHB_DIVS.forEach((d, i) => { RCC_CONST[`RCC_SYSCLK_DIV${d}`] = i === 0 ? 0 : 0x80 + (i - 1) * 0x10; });
APB_DIVS.forEach((d, i) => { RCC_CONST[`RCC_HCLK_DIV${d}`] = i === 0 ? 0 : 0x400 + (i - 1) * 0x100; });
ADC_DIVS.forEach((d, i) => { RCC_CONST[`RCC_ADCPCLK2_DIV${d}`] = i << 14; });

export const ahbFromCode = (v: number) => (v < 0x80 ? 1 : AHB_DIVS[Math.min(8, ((v >> 4) & 0xf) - 7)] ?? 1);
export const apbFromCode = (v: number) => (v < 0x400 ? 1 : APB_DIVS[Math.min(4, ((v >> 8) & 7) - 3)] ?? 1);
export const adcFromCode = (v: number) => ADC_DIVS[(v >> 14) & 3] ?? 2;

/* ---------- source <-> configuration (the clock configurator edits SystemClock_Config) ---------- */

export interface Draft { cfg: RccConfig; hseValue: number; found: boolean }

export function parseDraft(src: string): Draft {
  const cfg: RccConfig = { ...RCC_RESET };
  const body = functionSpan(src);
  const text = body ? src.slice(body[0], body[1]) : "";
  const val = (field: string) => {
    const m = text.match(new RegExp(`\\w+\\.${field.replace(".", "\\.")}\\s*=\\s*([\\w|\\s]+?)\\s*;`));
    if (!m) return undefined;
    return m[1]!.split("|").reduce((a, t) => a | (RCC_CONST[t.trim()] ?? Number(t.trim()) ?? 0), 0);
  };
  const type = val("OscillatorType") ?? 0;
  if (type & 1) cfg.hseOn = (val("HSEState") ?? 0) !== 0;
  if (type & 2) cfg.hsiOn = (val("HSIState") ?? 1) !== 0;
  const pll = val("PLL.PLLState");
  if (pll === 2) {
    cfg.pllOn = true;
    const s = val("PLL.PLLSource") ?? 0;
    cfg.pllSrc = s === 0 ? "HSI_DIV2" : (val("HSEPredivValue") ?? 0) ? "HSE_DIV2" : "HSE";
    cfg.pllMul = ((val("PLL.PLLMUL") ?? 0) >> 18) + 2;
  }
  const sw = val("SYSCLKSource");
  if (sw !== undefined) cfg.sysSrc = sw === 2 ? "PLL" : sw === 1 ? "HSE" : "HSI";
  const ahb = val("AHBCLKDivider"); if (ahb !== undefined) cfg.ahbDiv = ahbFromCode(ahb);
  const a1 = val("APB1CLKDivider"); if (a1 !== undefined) cfg.apb1Div = apbFromCode(a1);
  const a2 = val("APB2CLKDivider"); if (a2 !== undefined) cfg.apb2Div = apbFromCode(a2);
  const lat = text.match(/HAL_RCC_ClockConfig\s*\([^,]+,\s*FLASH_LATENCY_(\d)/); if (lat) cfg.latency = Number(lat[1]);
  const adc = text.match(/__HAL_RCC_ADC_CONFIG\s*\(\s*(RCC_ADCPCLK2_DIV\d)/); if (adc) cfg.adcDiv = adcFromCode(RCC_CONST[adc[1]!] ?? 0);
  return { cfg, hseValue: hseValueOf(src), found: !!body };
}

export const hseValueOf = (src: string) => { const m = src.match(/#define\s+HSE_VALUE\s+\(?\s*(\d+)/); return m ? Number(m[1]) : 8_000_000; };

/** [start, end) of the SystemClock_Config definition, braces included. */
function functionSpan(src: string): [number, number] | null {
  const m = /void\s+SystemClock_Config\s*\(\s*void\s*\)\s*\{/.exec(src);
  if (!m) return null;
  let depth = 0;
  for (let i = m.index + m[0].length - 1; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) return [m.index, i + 1];
  }
  return null;
}

export function genClockConfig(c: RccConfig, hseHz: number): string {
  const k = clocksOf(c, hseHz);
  const f = (hz: number) => `${+(hz / 1e6).toFixed(2)} MHz`;
  const types = ["RCC_OSCILLATORTYPE_HSE", "RCC_OSCILLATORTYPE_HSI"].join(" | ");
  const pllSrc = c.pllSrc === "HSI_DIV2" ? "RCC_PLLSOURCE_HSI_DIV2" : "RCC_PLLSOURCE_HSE";
  const inText = c.pllSrc === "HSI_DIV2" ? "HSI/2 = 4 MHz" : c.pllSrc === "HSE" ? `HSE ${f(hseHz)}` : `HSE/2 = ${f(hseHz / 2)}`;
  const sw = c.sysSrc === "PLL" ? "RCC_SYSCLKSOURCE_PLLCLK" : `RCC_SYSCLKSOURCE_${c.sysSrc}`;
  return [
    "void SystemClock_Config(void)",
    "{",
    "    RCC_OscInitTypeDef osc = {0};",
    "    RCC_ClkInitTypeDef clk = {0};",
    "",
    `    osc.OscillatorType = ${types};`,
    `    osc.HSEState = ${c.hseOn ? "RCC_HSE_ON" : "RCC_HSE_OFF"};`,
    `    osc.HSIState = ${c.hsiOn ? "RCC_HSI_ON" : "RCC_HSI_OFF"};`,
    `    osc.HSEPredivValue = ${c.pllSrc === "HSE_DIV2" ? "RCC_HSE_PREDIV_DIV2" : "RCC_HSE_PREDIV_DIV1"};`,
    `    osc.PLL.PLLState = ${c.pllOn ? "RCC_PLL_ON" : "RCC_PLL_OFF"};`,
    `    osc.PLL.PLLSource = ${pllSrc};`,
    `    osc.PLL.PLLMUL = RCC_PLL_MUL${c.pllMul};${" ".repeat(Math.max(1, 14 - String(c.pllMul).length))}// ${inText} x ${c.pllMul} = ${f(k.pllIn * c.pllMul)}`,
    "    if (HAL_RCC_OscConfig(&osc) != HAL_OK) Error_Handler();",
    "",
    "    clk.ClockType = RCC_CLOCKTYPE_SYSCLK | RCC_CLOCKTYPE_HCLK | RCC_CLOCKTYPE_PCLK1 | RCC_CLOCKTYPE_PCLK2;",
    `    clk.SYSCLKSource = ${sw};`,
    `    clk.AHBCLKDivider = RCC_SYSCLK_DIV${c.ahbDiv};       // HCLK  = ${f(k.hclk)}`,
    `    clk.APB1CLKDivider = RCC_HCLK_DIV${c.apb1Div};        // PCLK1 = ${f(k.pclk1)} (max 36)`,
    `    clk.APB2CLKDivider = RCC_HCLK_DIV${c.apb2Div};        // PCLK2 = ${f(k.pclk2)}`,
    `    if (HAL_RCC_ClockConfig(&clk, FLASH_LATENCY_${c.latency}) != HAL_OK) Error_Handler();`,
    `    __HAL_RCC_ADC_CONFIG(RCC_ADCPCLK2_DIV${c.adcDiv});   // ADCCLK = ${f(k.adc)} (max 14)`,
    "}",
  ].join("\n");
}

/** Rewrites SystemClock_Config (and HSE_VALUE) in `src`; null when the function is missing. */
export function withClockConfig(src: string, c: RccConfig, hseHz: number): string | null {
  const span = functionSpan(src);
  if (!span) return null;
  let out = src.slice(0, span[0]) + genClockConfig(c, hseHz) + src.slice(span[1]);
  out = /#define\s+HSE_VALUE\b/.test(out) ? out.replace(/#define\s+HSE_VALUE\s+\S+/, `#define HSE_VALUE ${hseHz}U`) : out;
  return out;
}
