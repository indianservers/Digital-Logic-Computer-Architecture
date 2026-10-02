import type { Mcu } from "../core/mcu";

/** STM32F401 alternate-function map (datasheet table 9) for the pins on this bench. */
export const AF: Record<string, { af: Record<number, string>; adc?: string }> = {
  PA0: { af: { 1: "TIM2_CH1", 2: "TIM5_CH1", 7: "USART2_CTS" }, adc: "ADC1_IN0" },
  PA1: { af: { 1: "TIM2_CH2", 2: "TIM5_CH2", 7: "USART2_RTS" }, adc: "ADC1_IN1" },
  PA2: { af: { 1: "TIM2_CH3", 2: "TIM5_CH3", 3: "TIM9_CH1", 7: "USART2_TX" }, adc: "ADC1_IN2" },
  PA3: { af: { 1: "TIM2_CH4", 2: "TIM5_CH4", 3: "TIM9_CH2", 7: "USART2_RX" }, adc: "ADC1_IN3" },
  PA5: { af: { 1: "TIM2_CH1", 5: "SPI1_SCK" }, adc: "ADC1_IN5" },
  PA6: { af: { 1: "TIM1_BKIN", 2: "TIM3_CH1", 5: "SPI1_MISO" }, adc: "ADC1_IN6" },
  PA7: { af: { 1: "TIM1_CH1N", 2: "TIM3_CH2", 5: "SPI1_MOSI" }, adc: "ADC1_IN7" },
  PA8: { af: { 0: "MCO_1", 1: "TIM1_CH1", 4: "I2C3_SCL", 7: "USART1_CK" } },
  PB6: { af: { 2: "TIM4_CH1", 4: "I2C1_SCL", 7: "USART1_TX" } },
  PB7: { af: { 2: "TIM4_CH2", 4: "I2C1_SDA", 7: "USART1_RX" } },
  PB8: { af: { 2: "TIM4_CH3", 3: "TIM10_CH1", 4: "I2C1_SCL" } },
  PB9: { af: { 2: "TIM4_CH4", 3: "TIM11_CH1", 4: "I2C1_SDA", 5: "SPI2_NSS" } },
  PC6: { af: { 2: "TIM3_CH1", 5: "I2S2_MCK", 8: "USART6_TX" } },
  PC7: { af: { 2: "TIM3_CH2", 6: "I2S3_MCK", 8: "USART6_RX" } },
};
export const LEFT = ["PA0", "PA1", "PA2", "PA3", "PA5", "PA6", "PA7", "PA8"];
export const RIGHT = ["PB6", "PB7", "PB8", "PB9", "PC6", "PC7"];
export const PINS = [...LEFT, ...RIGHT];

/** Signals the peripheral drives (outputs); everything else is sampled from the pin. */
const OUTPUTS = /_(TX|SCK|MOSI|CH\d|CH\dN|MCO_1|CK|RTS|MCK)$/;
export const isOutput = (sig: string) => OUTPUTS.test(sig) || sig === "MCO_1";
export const periphOf = (sig: string) => sig.replace(/_.*$/, "");

const CLOCK: Record<string, [string, number]> = {
  TIM1: ["APB2ENR", 0], TIM2: ["APB1ENR", 0], TIM3: ["APB1ENR", 1], TIM4: ["APB1ENR", 2], TIM5: ["APB1ENR", 3], TIM9: ["APB2ENR", 16], TIM10: ["APB2ENR", 17], TIM11: ["APB2ENR", 18],
  USART1: ["APB2ENR", 4], USART2: ["APB1ENR", 17], USART6: ["APB2ENR", 5], SPI1: ["APB2ENR", 12], SPI2: ["APB1ENR", 14], I2C1: ["APB1ENR", 21], I2C3: ["APB1ENR", 23],
};

export const MUX_BEGIN = "    // --- pin mux ---";
export const MUX_END = "    // --- peripherals ---";

export const DEMO = `#include "stm32f4xx.h"

int main(void)
{
    RCC->AHB1ENR |= RCC_AHB1ENR_GPIOAEN | RCC_AHB1ENR_GPIOBEN;
    RCC->APB1ENR |= RCC_APB1ENR_USART2EN | RCC_APB1ENR_TIM2EN | RCC_APB1ENR_I2C1EN;
    RCC->APB2ENR |= RCC_APB2ENR_SPI1EN;

${MUX_BEGIN}
    GPIOA->MODER |= (2 << (2*2));            // PA2 alternate function
    GPIOA->AFR[0] |= (7 << (2*4));           // PA2 AF7 = USART2_TX
    GPIOA->MODER |= (2 << (3*2));
    GPIOA->AFR[0] |= (7 << (3*4));           // PA3 AF7 = USART2_RX
    GPIOA->MODER |= (2 << (5*2)) | (2 << (6*2)) | (2 << (7*2));
    GPIOA->AFR[0] |= (5 << (5*4)) | (5 << (6*4)) | (5 << (7*4));   // SPI1 SCK/MISO/MOSI
    GPIOA->MODER |= (2 << (0*2));
    GPIOA->AFR[0] |= (1 << (0*4));           // PA0 AF1 = TIM2_CH1 (PA5 is taken by SPI1)
    GPIOB->MODER |= (2 << (6*2)) | (2 << (7*2));
    GPIOB->AFR[0] |= (4 << (6*4)) | (4 << (7*4));   // I2C1 SCL/SDA
    GPIOB->OTYPER |= (1 << 6) | (1 << 7);    // I2C needs open-drain
${MUX_END}
    USART2->BRR = 0x0683;                    // 9600 baud at 16 MHz
    USART2->CR1 = (1 << 13) | (1 << 3) | (1 << 2);   // UE | TE | RE
    SPI1->CR1 = (1 << 6) | (1 << 2);         // SPE | MSTR
    I2C1->CR1 = 1;                           // PE
    TIM2->PSC = 15;
    TIM2->ARR = 999;
    TIM2->CCR1 = 250;
    TIM2->CCMR1 = (6 << 4);                  // PWM mode 1 on CH1
    TIM2->CCER = 1;
    TIM2->CR1 = 1;

    while (1)
    {
        USART2->DR = 'U';
        delay_ms(100);
    }
}
`;

export const HAL_DEMO = `#include "stm32f4xx_hal.h"

UART_HandleTypeDef huart2;

int main(void)
{
    HAL_Init();
    __HAL_RCC_GPIOA_CLK_ENABLE();
    __HAL_RCC_USART2_CLK_ENABLE();

    GPIO_InitTypeDef g = {0};
    g.Pin = GPIO_PIN_2 | GPIO_PIN_3;
    g.Mode = GPIO_MODE_AF_PP;
    g.Pull = GPIO_PULLUP;
    g.Alternate = GPIO_AF7_USART2;           // try GPIO_AF5_SPI1 and watch the detector
    HAL_GPIO_Init(GPIOA, &g);

    USART2->BRR = 0x0683;
    USART2->CR1 = (1 << 13) | (1 << 3) | (1 << 2);

    while (1)
    {
        USART2->DR = 'H';
        HAL_Delay(100);
    }
}
`;

export type P15 = { spiGated: boolean; i2cPushPull: boolean };
export const P15_DEFAULT: P15 = { spiGated: false, i2cPushPull: false };

export function setup15(m: Mcu, p: P15) { if (p.spiGated) m.gateStuck.add("SPI1"); }
const forgotOd = new WeakSet<Mcu>();
/** The push-pull fault behaves like firmware that never sets OTYPER: it undoes the first open-drain write only, so a fix sticks. */
export function world15(m: Mcu, _dt: number, p: P15) {
  if (!p.i2cPushPull || forgotOd.has(m)) return;
  const ot = m.peek("GPIOB.OTYPER");
  if (ot & 0xc0) { m.write("GPIOB.OTYPER", ot & ~0xc0); forgotOd.add(m); }
}

const port = (pin: string) => `GPIO${pin[1]}`;
const num = (pin: string) => Number(pin.slice(2));
export interface PinState { pin: string; mode: number; af: number; signal: string; label: string; od: boolean }
export function pinState(m: Mcu, pin: string): PinState {
  const per = port(pin), n = num(pin);
  const mode = (m.peek(`${per}.MODER`) >>> (2 * n)) & 3;
  const af = (m.peek(`${per}.${n < 8 ? "AFRL" : "AFRH"}`) >>> ((n % 8) * 4)) & 0xf;
  const od = ((m.peek(`${per}.OTYPER`) >> n) & 1) === 1;
  const t = AF[pin]!;
  const signal = mode === 2 ? t.af[af] ?? "" : mode === 3 ? t.adc ?? "" : "";
  const label = mode === 2 ? (signal || `AF${af} (none)`) : mode === 3 ? (signal || "Analog") : mode === 1 ? "GPIO out" : "GPIO in";
  return { pin, mode, af, signal, label, od };
}

export function clockOn(m: Mcu, per: string) {
  const c = CLOCK[per];
  if (!c) return true;
  return ((m.peek(`RCC.${c[0]}`) >>> c[1]) & 1) === 1 && !m.gateStuck.has(per);
}

/** Signals the firmware has switched on, read from the peripheral enable bits. */
export function requiredSignals(m: Mcu): string[] {
  const req: string[] = [];
  const u2 = m.peek("USART2.CR1");
  if (u2 & (1 << 13)) { if (u2 & 8) req.push("USART2_TX"); if (u2 & 4) req.push("USART2_RX"); }
  if (m.peek("SPI1.CR1") & (1 << 6)) req.push("SPI1_SCK", "SPI1_MISO", "SPI1_MOSI");
  if (m.peek("I2C1.CR1") & 1) req.push("I2C1_SCL", "I2C1_SDA");
  for (const tim of ["TIM1", "TIM2", "TIM3", "TIM4"]) {
    if (!(m.peek(`${tim}.CR1`) & 1)) continue;
    const ccer = m.peek(`${tim}.CCER`);
    for (let ch = 1; ch <= 4; ch++) if ((ccer >> ((ch - 1) * 4)) & 1) req.push(`${tim}_CH${ch}`);
  }
  return req;
}

export type Severity = "error" | "warn";
export interface Fix { label: string; pin: string; mode: number; af?: number; od?: boolean }
export interface Issue { sev: Severity; text: string; pins: string[]; fix?: Fix }

export function analyse(m: Mcu): { issues: Issue[]; states: PinState[]; required: string[]; routed: Map<string, string[]> } {
  const states = PINS.map((p) => pinState(m, p));
  const required = requiredSignals(m);
  const routed = new Map<string, string[]>();
  for (const s of states) if (s.signal) routed.set(s.signal, [...(routed.get(s.signal) ?? []), s.pin]);
  const issues: Issue[] = [];
  const claimed = new Set(states.filter((s) => s.signal && required.includes(s.signal) && routed.get(s.signal)!.length === 1).map((s) => s.pin));

  for (const s of states) {
    if (s.mode === 2 && !s.signal) issues.push({ sev: "error", text: `${s.pin} selects AF${s.af}, which has no function on this pin: the pin is disconnected.`, pins: [s.pin], fix: { label: `Make ${s.pin} a GPIO input`, pin: s.pin, mode: 0 } });
  }
  for (const [sig, pins] of routed) {
    if (pins.length < 2) continue;
    if (isOutput(sig)) issues.push({ sev: "warn", text: `${sig} drives ${pins.join(" and ")} at the same time.`, pins });
    else issues.push({ sev: "error", text: `${sig} is an input mapped to ${pins.join(" and ")}: the peripheral can only sample one pin.`, pins });
  }
  for (const sig of required) {
    if (routed.has(sig)) continue;
    const cands = PINS.filter((p) => Object.values(AF[p]!.af).includes(sig));
    const free = cands.find((p) => !claimed.has(p));
    const owner = cands.map((p) => states.find((s) => s.pin === p)!).find((s) => s.signal && required.includes(s.signal));
    const af = free ? Number(Object.entries(AF[free]!.af).find(([, v]) => v === sig)![0]) : undefined;
    issues.push({
      sev: "error",
      text: `${periphOf(sig)} is enabled but ${sig} is not routed${owner ? ` (${owner.pin} is busy with ${owner.signal})` : ""}.`,
      pins: free ? [free] : [],
      fix: free && af !== undefined ? { label: `Route ${sig} to ${free} (AF${af})`, pin: free, mode: 2, af } : undefined,
    });
  }
  for (const s of states) {
    if (!s.signal || s.mode !== 2) continue;
    const per = periphOf(s.signal);
    if (!clockOn(m, per)) issues.push({ sev: "warn", text: `${s.pin} routes ${s.signal} but ${per} has no clock: the pin stays idle.`, pins: [s.pin] });
    if (/^I2C\d_(SCL|SDA)$/.test(s.signal) && !s.od) issues.push({ sev: "warn", text: `${s.pin} (${s.signal}) is push-pull. I2C lines must be open-drain or devices will fight the bus.`, pins: [s.pin], fix: { label: `Set ${s.pin} open-drain`, pin: s.pin, mode: 2, af: s.af, od: true } });
  }
  return { issues, states, required, routed };
}

/** Apply a routing choice through the GPIO registers, exactly as firmware would. */
export const portClock = (m: Mcu, pin: string) => ((m.peek("RCC.AHB1ENR") >> (pin.charCodeAt(1) - 65)) & 1) === 1;
export function route(m: Mcu, pin: string, mode: number, af?: number, od?: boolean): boolean {
  if (!portClock(m, pin)) return false;
  const per = port(pin), n = num(pin);
  m.write(`${per}.MODER`, (m.peek(`${per}.MODER`) & ~(3 << (2 * n))) | (mode << (2 * n)));
  if (af !== undefined) {
    const reg = `${per}.${n < 8 ? "AFRL" : "AFRH"}`, sh = (n % 8) * 4;
    m.write(reg, (m.peek(reg) & ~(0xf << sh)) | (af << sh));
  }
  if (od !== undefined) m.write(`${per}.OTYPER`, od ? m.peek(`${per}.OTYPER`) | (1 << n) : m.peek(`${per}.OTYPER`) & ~(1 << n));
  return true;
}

/** Regenerate the pin-mux block of the source from the current register state. */
export function genMux(m: Mcu, src: string): string | null {
  const a = src.indexOf(MUX_BEGIN), b = src.indexOf(MUX_END);
  if (a < 0 || b < a) return null;
  const lines: string[] = [MUX_BEGIN];
  for (const s of PINS.map((p) => pinState(m, p))) {
    if (s.mode === 0) continue;
    const per = port(s.pin), n = num(s.pin);
    lines.push(`    ${per}->MODER = (${per}->MODER & ~(3 << (${n}*2))) | (${s.mode} << (${n}*2));${s.mode === 2 ? "" : `   // ${s.pin} ${s.label}`}`);
    if (s.mode === 2) lines.push(`    ${per}->AFR[${n < 8 ? 0 : 1}] = (${per}->AFR[${n < 8 ? 0 : 1}] & ~(0xF << (${n % 8}*4))) | (${s.af} << (${n % 8}*4));   // ${s.pin} AF${s.af} = ${s.label}`);
    if (s.od) lines.push(`    ${per}->OTYPER |= (1 << ${n});`);
  }
  return src.slice(0, a) + lines.join("\n") + "\n" + src.slice(b);
}
