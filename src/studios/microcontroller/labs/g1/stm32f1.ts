import type { Mcu } from "../core/mcu";

export const PIN_NAMES: Record<string, string[]> = {
  A: ["WKUP / ADC0", "ADC1", "USART2_TX", "USART2_RX", "SPI1_NSS", "LED (GPIO)", "SPI1_MISO", "SPI1_MOSI", "MCO", "USART1_TX", "USART1_RX", "USB_DM", "USB_DP", "SWDIO", "SWCLK", "JTDI"],
  B: ["ADC8", "ADC9", "BOOT1", "JTDO", "JNTRST", "I2C1_SMBA", "I2C1_SCL", "I2C1_SDA", "TIM4_CH3", "TIM4_CH4", "USART3_TX", "USART3_RX", "SPI2_NSS", "SPI2_SCK", "SPI2_MISO", "SPI2_MOSI"],
  C: ["ADC10", "ADC11", "ADC12", "ADC13", "ADC14", "ADC15", "TIM3_CH1", "TIM3_CH2", "TIM3_CH3", "TIM3_CH4", "UART4_TX", "UART4_RX", "UART5_TX", "USER BTN", "OSC32_IN", "OSC32_OUT"],
};

/** STM32F103C8T6 LQFP48 pin order, pin 1 first. */
export const LQFP48 = ["VBAT", "PC13", "PC14", "PC15", "PD0", "PD1", "NRST", "VSSA", "VDDA", "PA0", "PA1", "PA2", "PA3", "PA4", "PA5", "PA6", "PA7", "PB0", "PB1", "PB2", "PB10", "PB11", "VSS", "VDD", "PB12", "PB13", "PB14", "PB15", "PA8", "PA9", "PA10", "PA11", "PA12", "PA13", "VSS", "VDD", "PA14", "PA15", "PB3", "PB4", "PB5", "PB6", "PB7", "BOOT0", "PB8", "PB9", "VSS", "VDD"];

export const isGpio = (name: string) => /^P[A-C]\d+$/.test(name);

export function pinFunction(key: string) {
  const m = key.match(/^P([A-C])(\d+)$/);
  return m ? PIN_NAMES[m[1]!]![Number(m[2])] ?? "GPIO" : key;
}

/** Decodes the F1 4-bit CRL/CRH configuration nibble of a pin. */
export function pinConfig(mcu: Mcu, key: string) {
  const m = key.match(/^P([A-E])(\d+)$/);
  if (!m) return { nib: 0, mode: "—", speed: "—", input: false };
  const n = Number(m[2]);
  const nib = (mcu.peek(`GPIO${m[1]}.${n < 8 ? "CRL" : "CRH"}`) >>> ((n & 7) * 4)) & 0xf;
  const md = nib & 3, cnf = nib >> 2;
  const speed = ["Input", "10 MHz", "2 MHz", "50 MHz"][md]!;
  if (md === 0) return { nib, mode: ["Analog", "Input (floating)", "Input (pull-up/down)", "Reserved"][cnf]!, speed, input: true };
  return { nib, mode: `${cnf & 2 ? "Alternate" : "General Purpose Output"}${cnf & 1 ? " (open-drain)" : ""}`, speed, input: false };
}

export function modeShort(nib: number) {
  const md = nib & 3, cnf = nib >> 2;
  if (md === 0) return ["Analog", "Input", "Input (pull)", "Reserved"][cnf]!;
  return `${cnf & 2 ? "Alternate" : "Output"}${cnf & 1 ? " OD" : ""}`;
}

/** Toggle a pin from the UI: outputs flip their ODR bit, inputs flip the externally driven level. */
export function togglePin(mcu: Mcu, key: string) {
  const cfg = pinConfig(mcu, key);
  const m = key.match(/^P([A-E])(\d+)$/);
  if (!m) return;
  if (cfg.input) { mcu.setInput(key, mcu.level(key) ? 0 : 1); return; }
  mcu.write(`GPIO${m[1]}.ODR`, mcu.peek(`GPIO${m[1]}.ODR`) ^ (1 << Number(m[2])));
}
