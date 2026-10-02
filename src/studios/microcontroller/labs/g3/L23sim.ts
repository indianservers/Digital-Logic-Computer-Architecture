import type { Mcu } from "../core/mcu";

export const CLK23 = 72e6;

export const DEMO = `/* Lab 23: DC Motor Control - PWM Speed and Direction */
#include "stm32f1xx_hal.h"

TIM_HandleTypeDef htim1;
TIM_OC_InitTypeDef sConfigOC;
GPIO_InitTypeDef g;

// GPIO pins for motor direction
#define IN1_Pin       GPIO_PIN_0
#define IN1_GPIO_Port GPIOB
#define IN2_Pin       GPIO_PIN_1
#define IN2_GPIO_Port GPIOB
#define PWM_PERIOD    3600        // 72 MHz / 3600 = 20 kHz

uint8_t dir = 0;                  // 0 = CW (forward), 1 = CCW (reverse)
uint8_t duty = 60;                // PWM duty cycle in percent

void Motor_SetDirection(uint8_t d)
{
    if (d == 0) {
        HAL_GPIO_WritePin(IN1_GPIO_Port, IN1_Pin, GPIO_PIN_SET);
        HAL_GPIO_WritePin(IN2_GPIO_Port, IN2_Pin, GPIO_PIN_RESET);  // CW
    } else {
        HAL_GPIO_WritePin(IN1_GPIO_Port, IN1_Pin, GPIO_PIN_RESET);
        HAL_GPIO_WritePin(IN2_GPIO_Port, IN2_Pin, GPIO_PIN_SET);    // CCW
    }
}

void Motor_SetSpeed(uint8_t d)
{
    if (d > 100) d = 100;
    __HAL_TIM_SET_COMPARE(&htim1, TIM_CHANNEL_1, PWM_PERIOD * d / 100);
}

static void MX_GPIO_Init(void)
{
    __HAL_RCC_GPIOA_CLK_ENABLE();
    __HAL_RCC_GPIOB_CLK_ENABLE();
    g.Pin = GPIO_PIN_8;               // PA8 = TIM1_CH1 -> ENA
    g.Mode = GPIO_MODE_AF_PP;
    g.Speed = GPIO_SPEED_FREQ_HIGH;
    HAL_GPIO_Init(GPIOA, &g);
    g.Pin = IN1_Pin | IN2_Pin;        // PB0 -> IN1, PB1 -> IN2
    g.Mode = GPIO_MODE_OUTPUT_PP;
    HAL_GPIO_Init(GPIOB, &g);
}

static void MX_TIM1_Init(void)
{
    __HAL_RCC_TIM1_CLK_ENABLE();
    htim1.Instance = TIM1;
    htim1.Init.Prescaler = 0;
    htim1.Init.Period = PWM_PERIOD - 1;
    HAL_TIM_PWM_Init(&htim1);
    sConfigOC.OCMode = TIM_OCMODE_PWM1;
    sConfigOC.Pulse = 0;
    HAL_TIM_PWM_ConfigChannel(&htim1, &sConfigOC, TIM_CHANNEL_1);
}

int main(void)
{
    HAL_Init();
    MX_GPIO_Init();
    MX_TIM1_Init();
    HAL_TIM_PWM_Start(&htim1, TIM_CHANNEL_1);

    while (1)
    {
        Motor_SetDirection(dir);
        Motor_SetSpeed(duty);
        HAL_Delay(20);
    }
}
`;

export const SOFT_START = DEMO.replace("uint8_t duty = 60;                // PWM duty cycle in percent\n", "uint8_t duty = 60;                // PWM duty cycle in percent\nuint8_t cur = 0;                  // ramped duty actually applied\n")
  .replace("        Motor_SetSpeed(duty);\n", "        if (cur < duty) cur++;          // soft start: +1 % every 20 ms\n        if (cur > duty) cur--;\n        Motor_SetSpeed(cur);\n");

export const SAFE_REVERSE = DEMO.replace("uint8_t duty = 60;                // PWM duty cycle in percent\n", "uint8_t duty = 60;                // PWM duty cycle in percent\nuint8_t last_dir = 0;\n")
  .replace("        Motor_SetDirection(dir);\n", `        if (dir != last_dir) {          // brake before reversing
            HAL_GPIO_WritePin(IN1_GPIO_Port, IN1_Pin, GPIO_PIN_SET);
            HAL_GPIO_WritePin(IN2_GPIO_Port, IN2_Pin, GPIO_PIN_SET);
            HAL_Delay(400);
            last_dir = dir;
        }
        Motor_SetDirection(dir);
`);

export const LOW_FREQ = DEMO.replace("#define PWM_PERIOD    3600        // 72 MHz / 3600 = 20 kHz", "#define PWM_PERIOD    1000        // with PSC 71: 1 MHz / 1000 = 1 kHz")
  .replace("    htim1.Init.Prescaler = 0;\n", "    htim1.Init.Prescaler = 71;      // BUG? 1 kHz PWM is audible\n");

const DIR_RE = /^(uint8_t dir = )(\d+)(;.*)$/m;
const DUTY_RE = /^(uint8_t duty = )(\d+)(;.*)$/m;
export function codeVals(src: string) {
  const d = DIR_RE.exec(src), u = DUTY_RE.exec(src);
  return { dir: d ? Number(d[2]) : null, duty: u ? Number(u[2]) : null };
}
export function setCodeVals(src: string, v: { dir?: number; duty?: number }) {
  let out = src;
  if (v.dir !== undefined) out = out.replace(DIR_RE, (_, h: string, _o: string, r: string) => `${h}${v.dir}${r}`);
  if (v.duty !== undefined) out = out.replace(DUTY_RE, (_, h: string, _o: string, r: string) => `${h}${v.duty}${r}`);
  return out;
}

export const LOADS = ["No Load", "Light", "Medium", "Heavy"] as const;
export type P23 = { load: 0 | 1 | 2 | 3; vmOff: boolean; in2Open: boolean };
export const P23_DEFAULT: P23 = { load: 0, vmOff: false, in2Open: false };

/* 12 V brushed motor behind an L298N. SI units. */
export const M = {
  vs: 12, rSrc: 0.25, r: 2.5, l: 1.5e-3, kt: 0.0176, j: 1.9e-5, b: 6.3e-6, tc: 0.0045,
  drop: (i: number) => 1.4 + 0.7 * Math.abs(i),
  loads: [0, 0.007, 0.016, 0.027],
  iMax: 2,
};
export const RPM = 60 / (2 * Math.PI);

export type BridgeMode = "forward" | "reverse" | "brake" | "coast";
export interface Motor23 {
  w: number; i: number; vm: number; mode: BridgeMode; en: number; freq: number; in1: number; in2: number;
  ripple: number; peak: number; phase: number; overI: boolean; vMotor: number;
}
const ST = new WeakMap<Mcu, Motor23>();
const IDLE: Motor23 = { w: 0, i: 0, vm: M.vs, mode: "coast", en: 0, freq: 0, in1: 0, in2: 0, ripple: 0, peak: 0, phase: 0, overI: false, vMotor: 0 };
export function motor(m: Mcu): Motor23 { return ST.get(m) ?? IDLE; }

/** ENA duty seen by the driver: timer PWM on PA8, or a plain GPIO level. */
function enable(m: Mcu) {
  const pw = m.pwmInfo("PA8");
  if (pw) return { en: pw.duty, freq: pw.freq };
  return { en: m.level("PA8") ? 1 : 0, freq: 0 };
}

export function world23(m: Mcu, dt: number, p: P23) {
  const s = motor(m);
  const { en, freq } = enable(m);
  const in1 = m.level("PB0"), in2 = p.in2Open ? 1 : m.level("PB1");
  const mode: BridgeMode = en <= 0 ? "coast" : in1 === in2 ? "brake" : in1 ? "forward" : "reverse";
  let { w, i, peak, phase } = s;
  const steps = Math.max(1, Math.ceil(dt / 2.5e-4)), h = dt / steps;
  let vm = M.vs, vMotor = 0;
  for (let k = 0; k < steps; k++) {
    const emf = M.kt * w;
    if (mode === "coast" || (p.vmOff && mode !== "brake")) { i = 0; vMotor = 0; vm = p.vmOff ? 0 : M.vs; }
    else {
      const vsrc = p.vmOff ? 0 : M.vs - M.rSrc * Math.abs(i) * en;
      const veff = Math.max(0, vsrc - M.drop(i));
      const sign = mode === "forward" ? 1 : mode === "reverse" ? -1 : 0;
      vMotor = sign * veff;
      i = mode === "brake" ? (en * -emf) / M.r : (en * vMotor - emf) / M.r;
      vm = vsrc;
    }
    const tl = M.loads[p.load] ?? 0;
    const tm = M.kt * i;
    const fr = M.tc + tl;
    if (Math.abs(w) < 0.5 && Math.abs(tm) <= fr) { w = 0; }
    else { w += ((tm - M.b * w - fr * Math.sign(w || tm)) / M.j) * h; }
    peak = Math.max(peak * Math.exp(-h / 3), Math.abs(i));
    phase = (phase + w * h * 0.02) % (2 * Math.PI);
  }
  const ripple = freq > 0 && mode !== "coast" ? ((Math.abs(vMotor) || M.vs) * en * (1 - en)) / (M.l * freq) : 0;
  ST.set(m, { w, i, vm: p.vmOff ? 0 : vm, mode, en, freq, in1, in2, ripple, peak, phase, overI: Math.abs(i) > M.iMax, vMotor });
}

/** Duty (percent) that holds `rpm` at the given load, from the steady-state motor equations. */
export function dutyFor(rpm: number, load: number): number {
  const w = Math.abs(rpm) / RPM;
  const tl = (M.loads[load] ?? 0) + M.tc + M.b * w;
  const iSS = tl / M.kt;
  const v = M.kt * w + iSS * M.r;
  const veff = M.vs - M.rSrc * iSS - M.drop(iSS);
  return Math.max(0, Math.min(100, Math.round((v / veff) * 100)));
}
/** Steady-state speed the model reaches for a duty and load (open loop). */
export function rpmFor(duty: number, load: number): number {
  let w = 0;
  for (let k = 0; k < 60; k++) {
    const tl = (M.loads[load] ?? 0) + M.tc + M.b * w;
    const iSS = tl / M.kt;
    const veff = M.vs - M.rSrc * iSS - M.drop(iSS);
    const v = (duty / 100) * veff;
    const wNew = Math.max(0, (v - iSS * M.r) / M.kt);
    w = 0.5 * w + 0.5 * wNew;
  }
  return w * RPM;
}
