import { Block, compileC, Firmware, toNum, Wait, type Diagnostic, type FirmwareOptions, type Host, type Ref, type RefVal, type Thread, type Val } from "./cinterp";

export type Family = "stm32" | "avr" | "esp32" | "8051" | "pic" | "msp430";
export type PinMode = "in" | "out" | "af" | "an";
export type Pull = "none" | "up" | "down";
export interface Pin { key: string; mode: PinMode; pull: Pull; od: boolean; out: number; ext: number | null; af: number; level: number }
export type EdgeKind = "rising" | "falling" | "both";
export interface FlashOp { t: number; kind: "unlock" | "lock" | "erase" | "program" | "error"; addr: number; value?: number; text: string }
export interface McuEvent { t: number; kind: "gpio" | "irq" | "uart" | "bus" | "fault" | "reset" | "info" | "dac" | "adc" | "power"; text: string }
export interface UartByte { t: number; byte: number; dir: "tx" | "rx"; dur: number }
/** parity: 0 none, 1 even, 2 odd. */
export interface UartFrame { bits: number; parity: 0 | 1 | 2; stop: number }
export const frameBits = (f: UartFrame) => 1 + f.bits + (f.parity ? 1 : 0) + f.stop;
/** Arduino SERIAL_xyz constants use the AVR UCSRnC layout: UCSZ in bits 1–2, USBS bit 3, UPM in bits 4–5. */
export function serialFrame(cfg: number): UartFrame {
  const upm = (cfg >> 4) & 3;
  return { bits: 5 + ((cfg >> 1) & 3), parity: upm === 2 ? 1 : upm === 3 ? 2 : 0, stop: cfg & 8 ? 2 : 1 };
}
export function serialConfig(f: UartFrame) { return ((f.bits - 5) << 1) | (f.stop === 2 ? 8 : 0) | (f.parity === 1 ? 0x20 : f.parity === 2 ? 0x30 : 0); }
const SERIAL_CONST: Record<string, number> = {};
for (const bits of [5, 6, 7, 8]) for (const [pc, parity] of [["N", 0], ["E", 1], ["O", 2]] as const) for (const stop of [1, 2]) SERIAL_CONST[`SERIAL_${bits}${pc}${stop}`] = serialConfig({ bits, parity, stop });
export interface BusTxn { t: number; bus: "spi" | "i2c"; addr?: number; write: number[]; read: number[]; ack: boolean; dur: number }
export interface I2cDevice { name: string; read(reg: number | undefined, count: number): number[]; write(bytes: number[]): void }
export type CallHook = (name: string, args: Val[], mcu: Mcu, thread: Thread) => Val | Wait | Block | undefined;
export interface PwmInfo { freq: number; duty: number; source: string; phase: number }

export interface CubeConfig {
  gpio?: Array<{ pin: string; mode: PinMode | "it_rising" | "it_falling" | "it_both"; pull?: Pull; af?: number; od?: boolean }>;
  timers?: Record<string, { psc: number; arr: number; ccr?: number[] }>;
  adcChannel?: number;
  uartBaud?: number;
}

export interface BusAccess { t: number; path: string; addr: number; rw: "R" | "W"; value: number }
export interface McuOptions extends FirmwareOptions { family?: Family; part?: "F401" | "F103"; clock?: number; vref?: number; adcBits?: number; cube?: CubeConfig; strictClock?: boolean; onCall?: CallHook; constants?: Record<string, number>; adcNoise?: number; i2cHz?: number; spiHz?: number }

const push = <T,>(arr: T[], v: T, cap: number) => { arr.push(v); if (arr.length > cap) arr.splice(0, arr.length - cap); };
const bitsOf = (v: number) => Array.from({ length: 32 }, (_, i) => (v >>> i) & 1);

/* ---------------- STM32F4 register map ---------------- */
const GPIO_OFF: Record<string, number> = { MODER: 0x00, OTYPER: 0x04, OSPEEDR: 0x08, PUPDR: 0x0c, IDR: 0x10, ODR: 0x14, BSRR: 0x18, LCKR: 0x1c, AFRL: 0x20, AFRH: 0x24 };
const TIM_OFF: Record<string, number> = { CR1: 0x00, CR2: 0x04, SMCR: 0x08, DIER: 0x0c, SR: 0x10, EGR: 0x14, CCMR1: 0x18, CCMR2: 0x1c, CCER: 0x20, CNT: 0x24, PSC: 0x28, ARR: 0x2c, CCR1: 0x34, CCR2: 0x38, CCR3: 0x3c, CCR4: 0x40 };
const PERIPH: Record<string, { base: number; regs: Record<string, number> }> = {
  RCC: { base: 0x40023800, regs: { CR: 0x00, PLLCFGR: 0x04, CFGR: 0x08, CIR: 0x0c, AHB1RSTR: 0x10, APB1RSTR: 0x20, APB2RSTR: 0x24, AHB1ENR: 0x30, APB1ENR: 0x40, APB2ENR: 0x44, BDCR: 0x70, CSR: 0x74 } },
  USART1: { base: 0x40011000, regs: { SR: 0, DR: 4, BRR: 8, CR1: 0x0c, CR2: 0x10, CR3: 0x14 } },
  USART2: { base: 0x40004400, regs: { SR: 0, DR: 4, BRR: 8, CR1: 0x0c, CR2: 0x10, CR3: 0x14 } },
  ADC1: { base: 0x40012000, regs: { SR: 0, CR1: 4, CR2: 8, SMPR1: 0x0c, SMPR2: 0x10, SQR1: 0x2c, SQR3: 0x34, DR: 0x4c } },
  DAC: { base: 0x40007400, regs: { CR: 0, SWTRIGR: 4, DHR12R1: 8, DHR12L1: 0x0c, DHR8R1: 0x10, DHR12R2: 0x14, DOR1: 0x2c, DOR2: 0x30 } },
  EXTI: { base: 0x40013c00, regs: { IMR: 0, EMR: 4, RTSR: 8, FTSR: 0x0c, SWIER: 0x10, PR: 0x14 } },
  SYSCFG: { base: 0x40013800, regs: { MEMRMP: 0, PMC: 4, EXTICR1: 8, EXTICR2: 0x0c, EXTICR3: 0x10, EXTICR4: 0x14 } },
  SPI1: { base: 0x40013000, regs: { CR1: 0, CR2: 4, SR: 8, DR: 0x0c } },
  I2C1: { base: 0x40005400, regs: { CR1: 0, CR2: 4, OAR1: 8, DR: 0x10, SR1: 0x14, SR2: 0x18, CCR: 0x1c } },
  IWDG: { base: 0x40003000, regs: { KR: 0, PR: 4, RLR: 8, SR: 0x0c } },
  PWR: { base: 0x40007000, regs: { CR: 0, CSR: 4 } },
  FLASH: { base: 0x40023c00, regs: { ACR: 0, KEYR: 4, OPTKEYR: 8, SR: 0x0c, CR: 0x10, OPTCR: 0x14 } },
  SysTick: { base: 0xe000e010, regs: { CTRL: 0, LOAD: 4, VAL: 8, CALIB: 0x0c } },
  SCB: { base: 0xe000ed00, regs: { CPUID: 0, ICSR: 4, VTOR: 8, AIRCR: 0x0c, SCR: 0x10, CCR: 0x14, SHCSR: 0x24, CFSR: 0x28 } },
};
const TIM_BASE: Record<string, number> = { TIM1: 0x40010000, TIM2: 0x40000000, TIM3: 0x40000400, TIM4: 0x40000800, TIM5: 0x40000c00 };
const GPIO_BASE = (port: string) => 0x40020000 + (port.charCodeAt(0) - 65) * 0x400;
for (const port of "ABCDE") PERIPH[`GPIO${port}`] = { base: GPIO_BASE(port), regs: GPIO_OFF };
for (const [t, base] of Object.entries(TIM_BASE)) PERIPH[t] = { base, regs: TIM_OFF };
/* STM32F103 (Cortex-M3) map: different GPIO block (CRL/CRH) and RCC layout. */
const F1_GPIO_OFF: Record<string, number> = { CRL: 0x00, CRH: 0x04, IDR: 0x08, ODR: 0x0c, BSRR: 0x10, BRR: 0x14, LCKR: 0x18 };
const PERIPH_F1: Record<string, { base: number; regs: Record<string, number> }> = {
  ...PERIPH,
  RCC: { base: 0x40021000, regs: { CR: 0x00, CFGR: 0x04, CIR: 0x08, APB2RSTR: 0x0c, APB1RSTR: 0x10, AHBENR: 0x14, APB2ENR: 0x18, APB1ENR: 0x1c, BDCR: 0x20, CSR: 0x24 } },
  AFIO: { base: 0x40010000, regs: { EVCR: 0, MAPR: 4, EXTICR1: 8, EXTICR2: 0x0c, EXTICR3: 0x10, EXTICR4: 0x14 } },
  EXTI: { base: 0x40010400, regs: { IMR: 0, EMR: 4, RTSR: 8, FTSR: 0x0c, SWIER: 0x10, PR: 0x14 } },
  USART1: { base: 0x40013800, regs: { SR: 0, DR: 4, BRR: 8, CR1: 0x0c, CR2: 0x10, CR3: 0x14 } },
  ADC1: { base: 0x40012400, regs: { SR: 0, CR1: 4, CR2: 8, SMPR1: 0x0c, SMPR2: 0x10, SQR1: 0x2c, SQR3: 0x34, DR: 0x4c } },
  SPI1: { base: 0x40013000, regs: { CR1: 0, CR2: 4, SR: 8, DR: 0x0c } },
  FLASH: { base: 0x40022000, regs: { ACR: 0, KEYR: 4, OPTKEYR: 8, SR: 0x0c, CR: 0x10, AR: 0x14, OBR: 0x1c, WRPR: 0x20 } },
  TIM1: { base: 0x40012c00, regs: TIM_OFF },
};
delete PERIPH_F1.SYSCFG;
for (const port of "ABCDE") PERIPH_F1[`GPIO${port}`] = { base: 0x40010800 + (port.charCodeAt(0) - 65) * 0x400, regs: F1_GPIO_OFF };
const NVIC_BASE = 0xe000e100;
export const IRQ_NUM: Record<string, number> = { WWDG: 0, PVD: 1, RTC_WKUP: 3, EXTI0: 6, EXTI1: 7, EXTI2: 8, EXTI3: 9, EXTI4: 10, DMA1_Stream5: 16, DMA1_Stream6: 17, ADC: 18, EXTI9_5: 23, TIM1_UP_TIM10: 25, TIM1_CC: 27, TIM2: 28, TIM3: 29, TIM4: 30, I2C1_EV: 31, SPI1: 35, USART1: 37, USART2: 38, EXTI15_10: 40, RTC_Alarm: 41, TIM5: 50, DMA2_Stream0: 56 };
const RESET: Record<string, number> = { "GPIOA.MODER": 0xa8000000, "GPIOB.MODER": 0x00000280, "GPIOA.PUPDR": 0x64000000, "GPIOB.PUPDR": 0x100, "RCC.CR": 0x83, "RCC.PLLCFGR": 0x24003010, "TIM1.ARR": 0xffff, "TIM2.ARR": 0xffffffff, "TIM3.ARR": 0xffff, "TIM4.ARR": 0xffff, "TIM5.ARR": 0xffffffff, "USART1.SR": 0xc0, "USART2.SR": 0xc0, "IWDG.RLR": 0xfff, "SCB.CPUID": 0x410fc241, "SysTick.CALIB": 0x40003e80 };

const TIM_CH_PIN: Array<[string, number, string, number]> = [
  ["TIM1", 1, "PA8", 1], ["TIM1", 2, "PA9", 1], ["TIM1", 3, "PA10", 1], ["TIM1", 4, "PA11", 1],
  ["TIM2", 1, "PA0", 1], ["TIM2", 1, "PA5", 1], ["TIM2", 2, "PA1", 1], ["TIM2", 3, "PB10", 1], ["TIM2", 4, "PA3", 1],
  ["TIM3", 1, "PA6", 2], ["TIM3", 2, "PA7", 2], ["TIM3", 3, "PB0", 2], ["TIM3", 4, "PB1", 2], ["TIM3", 1, "PB4", 2], ["TIM3", 2, "PC7", 2],
  ["TIM4", 1, "PB6", 2], ["TIM4", 2, "PB7", 2], ["TIM4", 3, "PB8", 2], ["TIM4", 4, "PB9", 2],
];
const NUCLEO_ARDUINO = ["PA3", "PA2", "PA10", "PB3", "PB5", "PB4", "PB10", "PA8", "PA9", "PC7", "PB6", "PA7", "PA6", "PA5", "PA0", "PA1", "PA4", "PB0", "PC1", "PC0"];
const STM32_ADC_PIN: Record<string, number> = { PA0: 0, PA1: 1, PA2: 2, PA3: 3, PA4: 4, PA5: 5, PA6: 6, PA7: 7, PB0: 8, PB1: 9, PC0: 10, PC1: 11, PC2: 12, PC3: 13, PC4: 14, PC5: 15 };
const ESP32_ADC_PIN: Record<string, number> = { GPIO36: 0, GPIO37: 1, GPIO38: 2, GPIO39: 3, GPIO32: 4, GPIO33: 5, GPIO34: 6, GPIO35: 7 };

const HAL_CONST: Record<string, number> = {
  GPIO_PIN_All: 0xffff, GPIO_MODE_INPUT: 0, GPIO_MODE_OUTPUT_PP: 1, GPIO_MODE_AF_PP: 2, GPIO_MODE_ANALOG: 3, GPIO_MODE_OUTPUT_OD: 0x11, GPIO_MODE_AF_OD: 0x12,
  GPIO_MODE_IT_RISING: 0x10110000, GPIO_MODE_IT_FALLING: 0x10210000, GPIO_MODE_IT_RISING_FALLING: 0x10310000, GPIO_NOPULL: 0, GPIO_PULLUP: 1, GPIO_PULLDOWN: 2,
  GPIO_SPEED_FREQ_LOW: 0, GPIO_SPEED_FREQ_MEDIUM: 1, GPIO_SPEED_FREQ_HIGH: 2, GPIO_SPEED_FREQ_VERY_HIGH: 3,
  GPIO_AF1_TIM1: 1, GPIO_AF1_TIM2: 1, GPIO_AF2_TIM3: 2, GPIO_AF2_TIM4: 2, GPIO_AF2_TIM5: 2, GPIO_AF3_TIM9: 3, GPIO_AF3_TIM10: 3, GPIO_AF3_TIM11: 3,
  GPIO_AF4_I2C1: 4, GPIO_AF4_I2C2: 4, GPIO_AF4_I2C3: 4, GPIO_AF5_SPI1: 5, GPIO_AF5_SPI2: 5, GPIO_AF6_SPI3: 6, GPIO_AF7_USART1: 7, GPIO_AF7_USART2: 7, GPIO_AF8_USART6: 8,
  TIM_CHANNEL_1: 0, TIM_CHANNEL_2: 4, TIM_CHANNEL_3: 8, TIM_CHANNEL_4: 12, TIM_CHANNEL_ALL: 0x3c, HAL_TIM_ACTIVE_CHANNEL_1: 1, HAL_TIM_ACTIVE_CHANNEL_2: 2, HAL_TIM_ACTIVE_CHANNEL_3: 4, HAL_TIM_ACTIVE_CHANNEL_4: 8,
  TIM_OCMODE_PWM1: 0x60, TIM_OCMODE_PWM2: 0x70, TIM_OCMODE_TOGGLE: 0x30, TIM_OCMODE_TIMING: 0, TIM_OCPOLARITY_HIGH: 0, TIM_OCPOLARITY_LOW: 2, TIM_COUNTERMODE_UP: 0, TIM_CLOCKDIVISION_DIV1: 0, TIM_OCFAST_DISABLE: 0, TIM_ICPOLARITY_RISING: 0, TIM_ICPOLARITY_FALLING: 2, TIM_ICPOLARITY_BOTHEDGE: 0xa,
  ADC_CHANNEL_TEMPSENSOR: 16, ADC_CHANNEL_VREFINT: 17,
  ADC_RESOLUTION_12B: 0, ADC_RESOLUTION_10B: 0x1000000, ADC_RESOLUTION_8B: 0x2000000, ADC_RESOLUTION_6B: 0x3000000, ADC_DATAALIGN_RIGHT: 0, ADC_DATAALIGN_LEFT: 0x800,
  ADC_SAMPLETIME_3CYCLES: 0, ADC_SAMPLETIME_15CYCLES: 1, ADC_SAMPLETIME_28CYCLES: 2, ADC_SAMPLETIME_56CYCLES: 3, ADC_SAMPLETIME_84CYCLES: 4, ADC_SAMPLETIME_112CYCLES: 5, ADC_SAMPLETIME_144CYCLES: 6, ADC_SAMPLETIME_480CYCLES: 7,
  ADC_CLOCK_SYNC_PCLK_DIV2: 0, ADC_CLOCK_SYNC_PCLK_DIV4: 0x10000, ADC_CLOCK_SYNC_PCLK_DIV6: 0x20000, ADC_CLOCK_SYNC_PCLK_DIV8: 0x30000, ADC_SOFTWARE_START: 0xf000001, ADC_EXTERNALTRIGCONVEDGE_NONE: 0, ADC_EOC_SINGLE_CONV: 1,
  DAC_CHANNEL_1: 0, DAC_CHANNEL_2: 0x10, DAC_ALIGN_12B_R: 0, DAC_ALIGN_12B_L: 4, DAC_ALIGN_8B_R: 8,
  IWDG_PRESCALER_4: 0, IWDG_PRESCALER_8: 1, IWDG_PRESCALER_16: 2, IWDG_PRESCALER_32: 3, IWDG_PRESCALER_64: 4, IWDG_PRESCALER_128: 5, IWDG_PRESCALER_256: 6,
  PWR_MAINREGULATOR_ON: 0, PWR_LOWPOWERREGULATOR_ON: 1, PWR_SLEEPENTRY_WFI: 1, PWR_SLEEPENTRY_WFE: 2, PWR_STOPENTRY_WFI: 1, PWR_WAKEUP_PIN1: 0x100,
  RTC_FORMAT_BIN: 0, RTC_FORMAT_BCD: 1, RTC_ALARM_A: 0x100, UART_IT_RXNE: 0x20,
  TIM_SR_UIF: 1, TIM_SR_CC1IF: 2, TIM_SR_CC2IF: 4, TIM_SR_CC3IF: 8, TIM_SR_CC4IF: 16, TIM_DIER_UIE: 1, TIM_DIER_CC1IE: 2, TIM_DIER_CC2IE: 4, TIM_DIER_CC3IE: 8, TIM_DIER_CC4IE: 16,
  TIM_CR1_CEN: 1, TIM_CR1_DIR: 16, TIM_CR1_ARPE: 0x80, TIM_EGR_UG: 1, TIM_CCER_CC1E: 1, TIM_CCER_CC1P: 2, TIM_CCER_CC1NP: 8, TIM_CCER_CC2E: 0x10, TIM_CCER_CC2P: 0x20, TIM_SR_CC1OF: 0x200, TIM_CCER_CC3E: 0x100, TIM_CCER_CC4E: 0x1000,
  TIM_CCMR1_OC1M_1: 0x20, TIM_CCMR1_OC1M_2: 0x40, TIM_CCMR1_OC1M_0: 0x10, TIM_CCMR1_OC1PE: 8, TIM_CCMR1_CC1S_0: 1, TIM_CCMR1_OC2M_1: 0x2000, TIM_CCMR1_OC2M_2: 0x4000,
  RCC_APB1ENR_TIM2EN: 1, RCC_APB1ENR_TIM3EN: 2, RCC_APB1ENR_TIM4EN: 4, RCC_APB1ENR_TIM5EN: 8, RCC_APB1ENR_USART2EN: 1 << 17, RCC_APB1ENR_I2C1EN: 1 << 21, RCC_APB1ENR_PWREN: 1 << 28, RCC_APB1ENR_DACEN: 1 << 29,
  RCC_APB2ENR_TIM1EN: 1, RCC_APB2ENR_USART1EN: 16, RCC_APB2ENR_ADC1EN: 1 << 8, RCC_APB2ENR_SPI1EN: 1 << 12, RCC_APB2ENR_SYSCFGEN: 1 << 14,
  RCC_CR_HSION: 1, RCC_CR_HSIRDY: 2, RCC_CR_HSEON: 1 << 16, RCC_CR_HSERDY: 1 << 17, RCC_CR_PLLON: 1 << 24, RCC_CR_PLLRDY: 1 << 25, RCC_CFGR_SW_PLL: 2, RCC_CFGR_SWS_PLL: 8, RCC_CFGR_SW_HSE: 1, RCC_CFGR_SW_HSI: 0,
  USART_SR_TXE: 0x80, USART_SR_TC: 0x40, USART_SR_RXNE: 0x20, USART_CR1_UE: 1 << 13, USART_CR1_TE: 8, USART_CR1_RE: 4, USART_CR1_RXNEIE: 0x20,
  ADC_CR2_ADON: 1, ADC_CR2_CONT: 2, ADC_CR2_SWSTART: 1 << 30, ADC_SR_EOC: 2, ADC_CR1_EOCIE: 0x20, DAC_CR_EN1: 1, DAC_CR_EN2: 1 << 16,
  SysTick_CTRL_ENABLE_Msk: 1, SysTick_CTRL_TICKINT_Msk: 2, SysTick_CTRL_CLKSOURCE_Msk: 4, SysTick_CTRL_COUNTFLAG_Msk: 1 << 16,
  SCB_SCR_SLEEPDEEP_Msk: 4, SCB_SCR_SLEEPONEXIT_Msk: 2, PWR_CR_LPDS: 1, PWR_CR_PDDS: 2, PWR_CR_CWUF: 4, PWR_CSR_WUF: 1, PWR_CSR_EWUP: 0x100,
  IWDG_KEY_RELOAD: 0xaaaa, IWDG_KEY_ENABLE: 0xcccc, IWDG_KEY_WRITE_ACCESS_ENABLE: 0x5555,
  SPI_BAUDRATEPRESCALER_2: 0, SPI_BAUDRATEPRESCALER_4: 8, SPI_BAUDRATEPRESCALER_8: 16, SPI_BAUDRATEPRESCALER_16: 24, SPI_BAUDRATEPRESCALER_32: 32, SPI_BAUDRATEPRESCALER_64: 40,
  SPI_POLARITY_LOW: 0, SPI_POLARITY_HIGH: 2, SPI_PHASE_1EDGE: 0, SPI_PHASE_2EDGE: 1, MSBFIRST: 1, LSBFIRST: 0, SPI_MODE0: 0, SPI_MODE1: 1, SPI_MODE2: 2, SPI_MODE3: 3,
  WDTO_15MS: 0, WDTO_30MS: 1, WDTO_60MS: 2, WDTO_120MS: 3, WDTO_250MS: 4, WDTO_500MS: 5, WDTO_1S: 6, WDTO_2S: 7, WDTO_4S: 8, WDTO_8S: 9,
  SLEEP_MODE_IDLE: 0, SLEEP_MODE_ADC: 1, SLEEP_MODE_PWR_DOWN: 2, SLEEP_MODE_PWR_SAVE: 3, SLEEP_MODE_STANDBY: 6,
};
const AVR_BITS: Record<string, number> = {
  CS10: 0, CS11: 1, CS12: 2, WGM10: 0, WGM11: 1, WGM12: 3, WGM13: 4, COM1A0: 6, COM1A1: 7, COM1B0: 4, COM1B1: 5, TOIE1: 0, OCIE1A: 1, OCIE1B: 2, ICIE1: 5, TOV1: 0, OCF1A: 1, OCF1B: 2, ICF1: 5, ICES1: 6,
  CS00: 0, CS01: 1, CS02: 2, WGM00: 0, WGM01: 1, WGM02: 3, COM0A0: 6, COM0A1: 7, COM0B0: 4, COM0B1: 5, TOIE0: 0, OCIE0A: 1, OCIE0B: 2, TOV0: 0, OCF0A: 1,
  CS20: 0, CS21: 1, CS22: 2, WGM20: 0, WGM21: 1, COM2A1: 7, COM2B1: 5, TOIE2: 0, OCIE2A: 1,
  ISC00: 0, ISC01: 1, ISC10: 2, ISC11: 3, INT0: 0, INT1: 1, INTF0: 0, INTF1: 1, PCIE0: 0, PCIE1: 1, PCIE2: 2,
  ADEN: 7, ADSC: 6, ADATE: 5, ADIF: 4, ADIE: 3, ADPS0: 0, ADPS1: 1, ADPS2: 2, REFS0: 6, REFS1: 7, ADLAR: 5, MUX0: 0, MUX1: 1, MUX2: 2, MUX3: 3,
  TXEN0: 3, RXEN0: 4, RXCIE0: 7, TXCIE0: 6, UDRIE0: 5, UDRE0: 5, RXC0: 7, TXC0: 6, UCSZ00: 1, UCSZ01: 2, U2X0: 1,
  SPE: 6, MSTR: 4, SPR0: 0, SPR1: 1, SPIF: 7, CPOL: 3, CPHA: 2, DORD: 5, SPIE: 7, SE: 0, SM0: 1, SM1: 2, SM2: 3, WDE: 3, WDIE: 6, WDRF: 3, BORF: 2, EXTRF: 1, PORF: 0,
  ACD: 7, ACBG: 6, ACO: 5, ACI: 4, ACIE: 3, ACIC: 2, ACIS1: 1, ACIS0: 0, ACME: 6, AIN1D: 1, AIN0D: 0,
};
const AVR_REGS: Record<string, number> = {
  PINB: 0x23, DDRB: 0x24, PORTB: 0x25, PINC: 0x26, DDRC: 0x27, PORTC: 0x28, PIND: 0x29, DDRD: 0x2a, PORTD: 0x2b, TIFR0: 0x35, TIFR1: 0x36, TIFR2: 0x37, PCIFR: 0x3b, EIFR: 0x3c, EIMSK: 0x3d,
  TCCR0A: 0x44, TCCR0B: 0x45, TCNT0: 0x46, OCR0A: 0x47, OCR0B: 0x48, ACSR: 0x50, DIDR1: 0x7f, SPCR: 0x4c, SPSR: 0x4d, SPDR: 0x4e, SMCR: 0x53, MCUSR: 0x54, MCUCR: 0x55, SREG: 0x5f, WDTCSR: 0x60, PCICR: 0x68, EICRA: 0x69,
  TIMSK0: 0x6e, TIMSK1: 0x6f, TIMSK2: 0x70, ADCL: 0x78, ADCH: 0x79, ADC: 0x78, ADCSRA: 0x7a, ADCSRB: 0x7b, ADMUX: 0x7c, DIDR0: 0x7e,
  TCCR1A: 0x80, TCCR1B: 0x81, TCCR1C: 0x82, TCNT1: 0x84, ICR1: 0x86, OCR1A: 0x88, OCR1B: 0x8a, TCCR2A: 0xb0, TCCR2B: 0xb1, TCNT2: 0xb2, OCR2A: 0xb3, OCR2B: 0xb4,
  TWBR: 0xb8, TWSR: 0xb9, TWDR: 0xbb, TWCR: 0xbc, UCSR0A: 0xc0, UCSR0B: 0xc1, UCSR0C: 0xc2, UBRR0: 0xc4, UBRR0L: 0xc4, UBRR0H: 0xc5, UDR0: 0xc6,
};
const MSP_REGS: Record<string, number> = { P1IN: 0x20, P1OUT: 0x21, P1DIR: 0x22, P1IFG: 0x23, P1IES: 0x24, P1IE: 0x25, P1SEL: 0x26, P1REN: 0x27, P2IN: 0x28, P2OUT: 0x29, P2DIR: 0x2a, P2IFG: 0x2b, P2IES: 0x2c, P2IE: 0x2d, P2SEL: 0x2e, P2REN: 0x2f, DCOCTL: 0x56, BCSCTL1: 0x57, BCSCTL2: 0x58, WDTCTL: 0x120 };
/** Synthetic calibration constants → DCO frequency (MSP430G2xx3 factory calibrations). */
const MSP_CAL: Record<string, [number, number]> = { CALBC1_1MHZ: [0x86, 1e6], CALBC1_8MHZ: [0x8d, 8e6], CALBC1_12MHZ: [0x8e, 12e6], CALBC1_16MHZ: [0x8f, 16e6] };
const C51_REGS: Record<string, number> = { P0: 0x80, SP: 0x81, DPL: 0x82, DPH: 0x83, PCON: 0x87, TCON: 0x88, TMOD: 0x89, TL0: 0x8a, TL1: 0x8b, TH0: 0x8c, TH1: 0x8d, P1: 0x90, SCON: 0x98, SBUF: 0x99, P2: 0xa0, IE: 0xa8, P3: 0xb0, IP: 0xb8, PSW: 0xd0, ACC: 0xe0, B: 0xf0 };
const C51_BITS: Record<string, [string, number]> = { IT0: ["TCON", 0], IE0: ["TCON", 1], IT1: ["TCON", 2], IE1: ["TCON", 3], TR0: ["TCON", 4], TF0: ["TCON", 5], TR1: ["TCON", 6], TF1: ["TCON", 7], EX0: ["IE", 0], ET0: ["IE", 1], EX1: ["IE", 2], ET1: ["IE", 3], ES: ["IE", 4], EA: ["IE", 7], RI: ["SCON", 0], TI: ["SCON", 1], PX0: ["IP", 0], PT0: ["IP", 1], PX1: ["IP", 2], PT1: ["IP", 3], PS: ["IP", 4] };
const PIC_REGS: Record<string, number> = { TMR0: 0x01, PCL: 0x02, STATUS: 0x03, PORTA: 0x05, PORTB: 0x06, PORTC: 0x07, PORTD: 0x08, INTCON: 0x0b, PIR1: 0x0c, TMR1L: 0x0e, TMR1H: 0x0f, T1CON: 0x10, TMR2: 0x11, T2CON: 0x12, CCPR1L: 0x15, CCP1CON: 0x17, RCREG: 0x1a, TXREG: 0x19, ADRESH: 0x1e, ADCON0: 0x1f, OPTION_REG: 0x81, TRISA: 0x85, TRISB: 0x86, TRISC: 0x87, TRISD: 0x88, PIE1: 0x8c, PR2: 0x92, TXSTA: 0x98, SPBRG: 0x99, ADRESL: 0x9e, ADCON1: 0x9f, LATA: 0x109, LATB: 0x10a, LATC: 0x10b, LATD: 0x10c, ANSEL: 0x188 };
const PIC_BITS: Record<string, [string, number]> = { GIE: ["INTCON", 7], PEIE: ["INTCON", 6], TMR0IE: ["INTCON", 5], T0IE: ["INTCON", 5], INTE: ["INTCON", 4], RBIE: ["INTCON", 3], TMR0IF: ["INTCON", 2], T0IF: ["INTCON", 2], INTF: ["INTCON", 1], RBIF: ["INTCON", 0], INTEDG: ["OPTION_REG", 6], T0CS: ["OPTION_REG", 5], PSA: ["OPTION_REG", 3], TMR2ON: ["T2CON", 2], ADON: ["ADCON0", 0], GO: ["ADCON0", 2], GO_DONE: ["ADCON0", 2], nDONE: ["ADCON0", 2], TMR2IF: ["PIR1", 1], TMR1IF: ["PIR1", 0], ADIF: ["PIR1", 6], RCIF: ["PIR1", 5], TXIF: ["PIR1", 4], TMR1ON: ["T1CON", 0] };

type TimerRun = { cnt: number; updates: number; it: boolean; ocIt: boolean; icIt: boolean; ic: boolean[]; activeCh: number; lastUpdate: number; captures?: number };

export class Mcu implements Host {
  readonly family: Family;
  readonly part: "F401" | "F103";
  readonly periph: Record<string, { base: number; regs: Record<string, number> }>;
  clock: number;
  vref: number;
  adcBits: number;
  adcNoise: number;
  i2cHz: number;
  spiHz: number;
  time = 0;
  fw?: Firmware;
  diagnostics: Diagnostic[] = [];
  source = "";
  regs = new Map<string, number>();
  pins = new Map<string, Pin>();
  analog = new Array<number>(20).fill(0);
  dac = [0, 0];
  dacEnabled = [false, false];
  dacLog: Array<[number, number, number]> = [];
  /** AVR analog comparator decision (AIN0 > AIN1), driven by the lab's analog front end. */
  acOut = 0;
  edges = new Map<string, Array<[number, number]>>();
  events: McuEvent[] = [];
  uart = { baud: 115200, log: [] as UartByte[], rx: [] as number[], text: "", busyUntil: 0, frameErrors: 0, frame: { bits: 8, parity: 0, stop: 1 } as UartFrame, port: "", pins: { tx: "", rx: "" }, timeout: 1, lastRx: -1 };
  bus: BusTxn[] = [];
  i2c = new Map<number, I2cDevice>();
  spiDevice?: (byte: number) => number;
  softPwm = new Map<string, PwmInfo>();
  /** Arduino Servo objects by variable name: 50 Hz frame, pulse clamped to [min, max] µs. */
  servos = new Map<string, { pin: string; min: number; max: number; us: number }>();
  ledc = new Map<number, { freq: number; res: number; duty: number; pins: string[] }>();
  arduinoIrq = new Map<string, { fn: string; mode: number }>();
  timers = new Map<string, TimerRun>();
  scheduled: Array<{ t: number; fn: () => void }> = [];
  pendingIrq: Array<{ handler: string; prio: number; args: Val[] }> = [];
  irqCount = new Map<string, number>();
  resets = 0;
  resetCause = "Power-on reset";
  sleep: "run" | "sleep" | "stop" | "standby" = "run";
  inReset = false;
  /** Debugger halt: time and peripherals advance but the core executes nothing. */
  cpuHalted = false;
  vdd = 3.3;
  borLevel = 2.7;
  wdt = { enabled: false, timeout: 0, counter: 0, kicks: 0, prescaler: 0, reload: 0xfff };
  rtc = { base: 12 * 3600, alarm: -1, alarmFired: false };
  cube: CubeConfig;
  strictClock: boolean;
  onCall?: CallHook;
  onPin?: (key: string, level: number, t: number) => void;
  onReset?: (cause: string) => void;
  private ram = new Map<number, number>();
  /** Programmed Flash halfwords (address → value); erased cells read 0xFFFF. Survives resets. */
  flash = new Map<number, number>();
  /** Erase count per Flash page/sector base address. */
  flashWear = new Map<number, number>();
  flashOps: FlashOp[] = [];
  flashError = 0;
  private flashKey = 0;
  private wireTx: { addr: number; data: number[] } | null = null;
  private wireRx: number[] = [];
  private uartRxIt: { buf: Val; len: number; handle: string } | null = null;
  private rng = 0x2545f491;
  private opts: McuOptions;
  private iserTouched = false;
  private constCache = new Map<string, number | null>();

  constructor(opts: McuOptions = {}) {
    this.opts = opts;
    this.family = opts.family ?? "stm32";
    this.part = opts.part ?? "F401";
    this.periph = this.part === "F103" ? PERIPH_F1 : PERIPH;
    this.clock = opts.clock ?? ({ stm32: this.part === "F103" ? 72e6 : 84e6, avr: 16e6, esp32: 240e6, "8051": 11.0592e6, pic: 20e6, msp430: 16e6 } as const)[this.family];
    this.vref = opts.vref ?? (this.family === "avr" || this.family === "8051" || this.family === "pic" ? 5 : 3.3);
    this.vdd = this.vref;
    this.borLevel = this.vref > 4 ? 4.3 : 2.7;
    this.adcBits = opts.adcBits ?? (this.family === "avr" || this.family === "pic" || this.family === "msp430" ? 10 : 12);
    this.adcNoise = opts.adcNoise ?? 0;
    this.i2cHz = opts.i2cHz ?? 100_000;
    this.spiHz = opts.spiHz ?? 1_000_000;
    this.cube = opts.cube ?? {};
    this.strictClock = opts.strictClock ?? false;
    this.onCall = opts.onCall;
    this.resetPeripherals();
  }

  /* ---------------- lifecycle ---------------- */
  get ips() { return this.opts.ips ?? Math.max(50_000, Math.min(1_000_000, this.clock / (this.family === "8051" ? 120 : this.family === "avr" || this.family === "pic" ? 40 : 30))); }

  load(source: string): Diagnostic[] {
    this.source = source;
    const { program, diagnostics } = compileC(source);
    this.diagnostics = diagnostics;
    if (!program) { this.fw = undefined; return diagnostics; }
    this.startFirmware();
    return this.fw?.error ? [this.fw.error] : [];
  }

  private startFirmware() {
    const { program } = compileC(this.source);
    if (!program) return;
    this.fw = new Firmware(program, this, { ...this.opts, ips: this.ips });
    this.fw.time = this.time;
    this.fw.onIsrExit = (name) => this.afterIsr(name);
    /* Bare-metal AVR resets with SREG.I = 0; the Arduino core's init() runs sei() before setup(). */
    if (this.family === "avr" && this.fw.hasFunction("main") && !this.fw.hasFunction("setup")) this.fw.globalIrqEnabled = false;
  }

  private resetPeripherals() {
    this.regs.clear();
    for (const [k, v] of Object.entries(RESET)) this.regs.set(k, v);
    for (const p of this.pins.values()) { p.mode = "in"; p.pull = "none"; p.out = this.family === "8051" ? 1 : 0; p.od = false; p.af = 0; }
    if (this.family === "8051") for (const port of ["P0", "P1", "P2", "P3"]) this.regs.set(port, 0xff);
    if (this.family === "pic") { for (const t of ["TRISA", "TRISB", "TRISC", "TRISD", "OPTION_REG"]) this.regs.set(t, 0xff); }
    if (this.family === "stm32" && this.part === "F103") { for (const port of "ABCDE") { this.regs.set(`GPIO${port}.CRL`, 0x44444444); this.regs.set(`GPIO${port}.CRH`, 0x44444444); this.regs.delete(`GPIO${port}.MODER`); this.regs.delete(`GPIO${port}.PUPDR`); } this.regs.set("RCC.APB2ENR", 0); this.regs.set("RCC.CR", 0x83); }
    if (this.family === "stm32") { this.applyGpioRegs("A"); this.applyGpioRegs("B"); this.regs.set("FLASH.CR", this.flashLockBit()); this.flashKey = 0; }
    this.timers.clear();
    this.softPwm.clear();
    this.servos.clear();
    this.ledc.clear();
    this.arduinoIrq.clear();
    this.pendingIrq = [];
    this.latched.clear();
    this.scheduled = [];
    this.uart.rx = [];
    this.uart.busyUntil = this.time;
    this.uart.frame = { bits: 8, parity: 0, stop: 1 };
    this.uart.port = "";
    this.uart.pins = { tx: "", rx: "" };
    this.uart.timeout = 1;
    this.uart.lastRx = -1;
    this.uartRxIt = null;
    this.dac = [0, 0]; this.dacEnabled = [false, false];
    this.wdt = { enabled: false, timeout: 0, counter: 0, kicks: 0, prescaler: 0, reload: 0xfff };
    if (this.family === "msp430") { this.regs.set("WDTCTL", 0x6900); this.wdt = { ...this.wdt, enabled: true, timeout: 32768 / this.clock, counter: 32768 / this.clock }; }
    this.sleep = "run";
    this.iserTouched = false;
    for (const p of this.pins.values()) this.refreshPin(p);
  }

  hardReset(cause: string) {
    this.resets++;
    this.resetCause = cause;
    this.log("reset", `RESET — ${cause}`);
    this.resetPeripherals();
    if (this.source) this.startFirmware();
    this.onReset?.(cause);
  }

  /** Advance the whole MCU (firmware + peripherals) by dt seconds of simulated time. */
  tick(dt: number) {
    const end = this.time + dt;
    let guard = 0;
    while (this.time < end - 1e-12 && guard++ < 2_000_000) {
      if (this.fw?.paused) return;
      const grid = (Math.floor(this.time * 1000 + 1e-6) + 1) / 1000;
      let t1 = Math.min(grid, end);
      const ev = this.nextEventTime();
      if (ev > this.time + 1e-10 && ev < t1) t1 = ev;
      const step = t1 - this.time;
      if (this.inReset) { this.time = t1; continue; }
      this.advancePeripherals(this.time, t1);
      const fw = this.fw;
      if (fw && this.cpuHalted) fw.time = t1;
      else if (fw && !fw.error && this.sleep !== "standby") {
        fw.run(t1, Math.ceil(this.ips * step * 1.6) + 400);
        if (fw.paused) { this.time = fw.time; return; }
        if (fw.time < t1) fw.time = t1;
      }
      this.time = t1;
      if (fw && this.sleep !== "run" && !fw.threads.some((t) => t.blockedLabel === "WFI" || t.blockedLabel === "sleep")) this.sleep = "run";
    }
  }

  /* ---------------- events / logs ---------------- */
  log(kind: McuEvent["kind"], text: string) { push(this.events, { t: this.time, kind, text }, 400); }
  schedule(t: number, fn: () => void) { this.scheduled.push({ t, fn }); this.scheduled.sort((a, b) => a.t - b.t); }
  get now() { return this.fw?.time ?? this.time; }

  /* ---------------- pins ---------------- */
  pinKey(port: string, n: number): string {
    if (this.family === "pic") return `R${port}${n}`;
    if (this.family === "msp430") return `P${port}.${n}`;
    if (this.family === "8051") return `P${port}.${n}`;
    if (this.family === "esp32") return `GPIO${n}`;
    return `P${port}${n}`;
  }
  pin(key: string): Pin {
    let p = this.pins.get(key);
    if (!p) {
      p = { key, mode: "in", pull: "none", od: false, out: this.family === "8051" ? 1 : 0, ext: null, af: 0, level: 0 };
      this.pins.set(key, p);
      const gm = this.family === "stm32" ? /^P([A-K])(\d{1,2})$/.exec(key) : null;
      if (gm && this.part !== "F103") {
        // Lazily created pins (inputs never touched by MODER writes) still honour PUPDR/ODR written earlier.
        const per = `GPIO${gm[1]}`, n = Number(gm[2]);
        p.mode = (["in", "out", "af", "an"] as const)[(this.r(`${per}.MODER`) >> (n * 2)) & 3]!;
        p.pull = (["none", "up", "down", "none"] as const)[(this.r(`${per}.PUPDR`) >> (n * 2)) & 3]!;
        p.od = ((this.r(`${per}.OTYPER`) >> n) & 1) === 1;
        p.out = (this.r(`${per}.ODR`) >> n) & 1;
      }
      p.level = this.computeLevel(p);
    }
    return p;
  }
  private computeLevel(p: Pin): number {
    if (this.inReset) return p.ext ?? 0;
    if (p.mode === "out") { if (p.od && p.out) return p.ext ?? (p.pull === "up" ? 1 : 0); return p.out ? 1 : 0; }
    if (p.mode === "af") { const pw = this.pwmInfo(p.key); if (pw) return this.pwmLevel(pw, this.now); return p.ext ?? p.out; }
    if (this.family === "8051") return p.out ? (p.ext ?? 1) : 0;
    if (p.ext !== null) return p.ext;
    if (p.pull === "up") return 1;
    if (p.pull === "down") return 0;
    return this.noiseBit();
  }
  isFloating(key: string) { const p = this.pin(key); return (p.mode === "in" || p.mode === "an") && p.ext === null && p.pull === "none" && this.family !== "8051"; }
  private noiseBit() { this.rng ^= this.rng << 13; this.rng ^= this.rng >>> 17; this.rng ^= this.rng << 5; return (this.rng >>> 7) & 1; }
  private gauss() { let s = 0; for (let k = 0; k < 4; k++) { this.rng ^= this.rng << 13; this.rng ^= this.rng >>> 17; this.rng ^= this.rng << 5; s += ((this.rng >>> 0) / 0xffffffff) - 0.5; } return s * 1.7; }
  level(key: string): number { const p = this.pin(key); if (p.mode === "af" || (this.isFloating(key))) return this.computeLevel(p); return p.level; }
  private refreshPin(p: Pin) {
    if (this.isFloating(p.key)) { p.level = 0; return; }
    const lv = this.computeLevel(p);
    if (lv === p.level) return;
    p.level = lv;
    let list = this.edges.get(p.key);
    if (!list) { list = []; this.edges.set(p.key, list); }
    push(list, [this.now, lv], 4000);
    this.onPin?.(p.key, lv, this.now);
    this.edgeInterrupts(p.key, lv);
  }
  setInput(key: string, level: number | null) { const p = this.pin(key); p.ext = level; this.refreshPin(p); }
  setAnalog(target: number | string, volts: number) { const ch = typeof target === "number" ? target : this.adcChannelOf(target); if (ch >= 0) this.analog[ch] = volts; }
  /** AVR: a new comparator decision. ACIS1:0 picks the edge (00 toggle, 10 falling, 11 rising) that sets ACI or, with ACIE, runs ANALOG_COMP_vect (which clears ACI). */
  setComparator(level: number) {
    const lv = level ? 1 : 0;
    if (lv === this.acOut) return;
    this.acOut = lv;
    if (this.family !== "avr") return;
    const acsr = this.r("ACSR");
    const mode = acsr & 3;
    if (acsr & 0x80 || mode === 1) return;
    if (mode === 0 || (mode === 2 && !lv) || (mode === 3 && lv)) {
      const runs = (acsr & 0x08) !== 0 && !!this.fw?.hasFunction("ISR_ANALOG_COMP_vect");
      this.setR("ACSR", runs && this.fw!.globalIrqEnabled ? acsr & ~0x10 : acsr | 0x10);
      if (runs) this.deliver("ANALOG_COMP", "ISR_ANALOG_COMP_vect", []);
    }
  }
  adcChannelOf(key: string): number {
    if (this.family === "stm32") return STM32_ADC_PIN[key] ?? -1;
    if (this.family === "esp32") return ESP32_ADC_PIN[key] ?? -1;
    if (this.family === "avr" && /^PC\d$/.test(key)) return Number(key.slice(2));
    if (this.family === "pic" && /^RA\d$/.test(key)) return Number(key.slice(2));
    if (this.family === "8051" && /^P1\.\d$/.test(key)) return Number(key.slice(3));
    return -1;
  }
  arduinoPin(v: Val | undefined): string {
    const n = Math.trunc(toNum(v));
    if (this.family === "esp32") return `GPIO${n}`;
    if (this.family === "stm32") return NUCLEO_ARDUINO[n] ?? `PA${n}`;
    if (this.family === "avr") return n < 8 ? `PD${n}` : n < 14 ? `PB${n - 8}` : `PC${n - 14}`;
    return `P${n}`;
  }
  arduinoNumber(key: string): number {
    if (this.family === "avr") { const port = key[1], n = Number(key.slice(2)); return port === "D" ? n : port === "B" ? n + 8 : n + 14; }
    if (this.family === "stm32") return NUCLEO_ARDUINO.indexOf(key);
    if (this.family === "esp32") return Number(key.replace("GPIO", ""));
    return -1;
  }

  /* ---------------- PWM ---------------- */
  pwmInfo(key: string): PwmInfo | undefined {
    const soft = this.softPwm.get(key);
    if (soft) return soft;
    if (this.family !== "stm32") return this.familyPwm(key);
    for (const [tim, ch, pinKey, af] of TIM_CH_PIN) {
      if (pinKey !== key) continue;
      const p = this.pins.get(key);
      if (this.strictClock && p && (p.mode !== "af" || p.af !== af)) continue;
      const cfg = this.timerCfg(tim);
      if (!cfg.enabled || !((cfg.ccer >> ((ch - 1) * 4)) & 1) || this.ccInput(tim, ch)) continue;
      const ocm = ch <= 2 ? (this.r(`${tim}.CCMR1`) >> (ch === 1 ? 4 : 12)) & 7 : (this.r(`${tim}.CCMR2`) >> (ch === 3 ? 4 : 12)) & 7;
      const period = cfg.arr + 1;
      const fCnt = this.timerClock(tim) / (cfg.psc + 1);
      const ccr = this.r(`${tim}.CCR${ch}`);
      const inv = ((cfg.ccer >> ((ch - 1) * 4 + 1)) & 1) === 1;
      const run = this.timers.get(tim);
      const phase = run ? run.cnt / period : 0;
      if (ocm === 3) return { freq: fCnt / period / 2, duty: 0.5, source: `${tim}_CH${ch} toggle`, phase: ((run ? run.cnt - ccr : 0) / period / 2 + 1) % 1 };
      if (ocm !== 6 && ocm !== 7) continue;
      let duty = Math.max(0, Math.min(1, ccr / period));
      if (ocm === 7) duty = 1 - duty;
      if (inv) duty = 1 - duty;
      return { freq: fCnt / period, duty, source: `${tim}_CH${ch}`, phase };
    }
    return undefined;
  }
  pwmLevel(pw: PwmInfo, t: number) { const ph = ((pw.phase + (t - this.now) * pw.freq) % 1 + 1) % 1; return ph < pw.duty ? 1 : 0; }
  protected familyPwm(key: string): PwmInfo | undefined {
    if (this.family === "avr") {
      const map: Record<string, [string, string, string, number]> = { PB1: ["TCCR1A", "OCR1A", "1", 7], PB2: ["TCCR1A", "OCR1B", "1", 5], PD6: ["TCCR0A", "OCR0A", "0", 7], PD5: ["TCCR0A", "OCR0B", "0", 5], PB3: ["TCCR2A", "OCR2A", "2", 7], PD3: ["TCCR2A", "OCR2B", "2", 5] };
      const m = map[key];
      if (!m) return undefined;
      const [ctrl, ocr, t, com] = m;
      if (!((this.r(ctrl) >> com) & 1)) return undefined;
      const cfg = this.avrTimer(t);
      if (!cfg) return undefined;
      return { freq: cfg.freq, duty: Math.min(1, (this.r(ocr) + 1) / (cfg.top + 1)), source: `Timer${t} ${ocr}`, phase: 0 };
    }
    if (this.family === "pic" && key === "RC2" && (this.r("CCP1CON") & 0x0c) === 0x0c && (this.r("T2CON") & 4)) {
      const pre = [1, 4, 16, 16][this.r("T2CON") & 3] ?? 1;
      const pr2 = this.r("PR2");
      const freq = this.clock / (4 * (pr2 + 1) * pre);
      const dc = (this.r("CCPR1L") << 2) | ((this.r("CCP1CON") >> 4) & 3);
      return { freq, duty: Math.min(1, dc / (4 * (pr2 + 1))), source: "CCP1 PWM", phase: 0 };
    }
    return undefined;
  }
  avrTimer(t: string): { freq: number; top: number; prescale: number; mode: number } | undefined {
    const b = this.r(`TCCR${t}B`), a = this.r(`TCCR${t}A`);
    const cs = b & 7;
    const pres = t === "2" ? [0, 1, 8, 32, 64, 128, 256, 1024][cs] ?? 0 : [0, 1, 8, 64, 256, 1024, 0, 0][cs] ?? 0;
    if (!pres) return undefined;
    const mode = (a & 3) | ((b >> 3) & 3) << 2;
    let top = t === "1" ? 0xffff : 0xff;
    let dual = 1;
    if (t === "1") {
      if (mode === 4) top = this.r("OCR1A"); else if (mode === 14 || mode === 12) top = this.r("ICR1"); else if (mode === 5) top = 0xff; else if (mode === 6) top = 0x1ff; else if (mode === 7) top = 0x3ff; else if (mode === 1 || mode === 8 || mode === 10) dual = 2;
    } else {
      if (mode === 2) top = this.r(`OCR${t}A`); else if (mode === 1) dual = 2; else if (mode === 7) top = this.r(`OCR${t}A`);
    }
    return { freq: this.clock / pres / ((top + 1) * dual), top, prescale: pres, mode };
  }

  /* ---------------- timers (STM32) ---------------- */
  /** Optional override for a timer's kernel clock (e.g. APB timer clocks in the clock-tree lab). */
  timerClockOf?: (tim: string) => number | undefined;
  timerClock(tim: string) { return this.timerClockOf?.(tim) ?? this.clock; }
  timerCfg(tim: string) { return { psc: this.r(`${tim}.PSC`), arr: this.r(`${tim}.ARR`), enabled: (this.r(`${tim}.CR1`) & 1) === 1, dier: this.r(`${tim}.DIER`), ccer: this.r(`${tim}.CCER`) }; }
  timerRun(tim: string): TimerRun { let t = this.timers.get(tim); if (!t) { t = { cnt: 0, updates: 0, it: false, ocIt: false, icIt: false, ic: [false, false, false, false], activeCh: 0, lastUpdate: 0 }; this.timers.set(tim, t); } return t; }
  timerFreq(tim: string) { const c = this.timerCfg(tim); return this.timerClock(tim) / (c.psc + 1) / (c.arr + 1); }
  /** CCxS != 00: the channel is an input (capture), so it neither compares nor drives its pin. */
  ccInput(tim: string, ch: number) { return ((this.r(`${tim}.${ch <= 2 ? "CCMR1" : "CCMR2"}`) >> (ch % 2 === 1 ? 0 : 8)) & 3) !== 0; }
  /** Input capture on a timer channel pin: latch CNT into CCRx on the selected edge(s) (CCxP/CCxNP), set CCxIF (CCxOF if unread), raise the IRQ. */
  private timerCapture(key: string, rising: boolean) {
    for (const [tim, ch, pinKey, af] of TIM_CH_PIN) {
      if (pinKey !== key) continue;
      const p = this.pins.get(key);
      if (!p || p.mode !== "af" || p.af !== af) continue;
      if (((this.r(`${tim}.${ch <= 2 ? "CCMR1" : "CCMR2"}`) >> (ch % 2 === 1 ? 0 : 8)) & 3) !== 1) continue;
      const ccer = this.r(`${tim}.CCER`) >> ((ch - 1) * 4);
      if (!(ccer & 1)) continue;
      const pol = ((ccer >> 1) & 1) | (((ccer >> 3) & 1) << 1);
      if (!(pol === 3 || (pol === 0 && rising) || (pol === 1 && !rising))) continue;
      const run = this.timerRun(tim);
      run.ic[ch - 1] = true;
      run.captures = (run.captures ?? 0) + 1;
      this.setR(`${tim}.CCR${ch}`, Math.floor(run.cnt));
      const sr = this.r(`${tim}.SR`);
      this.setR(`${tim}.SR`, sr | (1 << ch) | (sr & (1 << ch) ? 1 << (8 + ch) : 0));
      if ((this.r(`${tim}.DIER`) >> ch) & 1) this.timerIrq(tim, "cc", ch);
    }
  }

  /** Earliest upcoming interrupt-generating event, so tick() can end a slice exactly on it. */
  private nextEventTime(): number {
    const t = this.time;
    // Events due now are fired at the slice start; the slice must still stop at the next one.
    let n = this.scheduled.find((s) => s.t > t + 1e-10)?.t ?? Infinity;
    if (this.family === "stm32") {
      const ctrl = this.r("SysTick.CTRL");
      if ((ctrl & 3) === 3 && this.fw?.hasFunction("SysTick_Handler")) {
        const p = (this.r("SysTick.LOAD") + 1) / this.clock;
        let k = Math.ceil(t / p - 1e-9);
        if (k * p <= t + 2e-10) k++;
        n = Math.min(n, k * p);
      }
      if (this.sleep !== "stop") for (const [tim, run] of this.timers) {
        const cfg = this.timerCfg(tim);
        if (!cfg.enabled) continue;
        const f = this.timerClock(tim) / (cfg.psc + 1), period = cfg.arr + 1;
        let rem = period - run.cnt;
        if (rem <= f * 2e-10 + 1e-9) rem += period;
        if ((cfg.dier & 1) || run.it) n = Math.min(n, t + rem / f);
        for (let ch = 1; ch <= 4; ch++) {
          if (!(((cfg.dier >> ch) & 1) || run.ocIt) || run.ic[ch - 1] || this.ccInput(tim, ch)) continue;
          const ccr = this.r(`${tim}.CCR${ch}`);
          if (ccr >= period) continue;
          n = Math.min(n, t + (run.cnt < ccr - 1e-6 ? ccr - run.cnt : period - run.cnt + ccr) / f);
        }
      }
    } else if (this.family === "avr") {
      for (const k of ["0", "1", "2"]) {
        const cfg = this.avrTimer(k);
        if (!cfg || !(this.r(`TIMSK${k}`) & 3)) continue;
        const run = this.timers.get(`T${k}`);
        let rem = cfg.top + 1 - (run?.cnt ?? 0);
        if (rem <= this.clock / cfg.prescale * 2e-10 + 1e-9) rem += cfg.top + 1;
        n = Math.min(n, t + rem * cfg.prescale / this.clock);
      }
    } else if (this.family === "8051") {
      const tmod = this.r("TMOD"), tcon = this.r("TCON");
      if (this.r("IE") & 0x80) for (const k of [0, 1]) {
        if (!((tcon >> (4 + k * 2)) & 1) || !((this.r("IE") >> (1 + k * 2)) & 1)) continue;
        const mode = (tmod >> (k * 4)) & 3, run = this.timers.get(`T${k}`);
        const th = this.r(`TH${k}`), tl = this.r(`TL${k}`), frac = run?.cnt ?? 0;
        let left = mode === 2 ? 256 - tl - frac : (mode === 0 ? 8192 : 65536) - ((th << 8) | tl) - frac;
        if (left <= 1e-6) left += mode === 2 ? 256 - th : mode === 0 ? 8192 : 65536;
        n = Math.min(n, t + left * 12 / this.clock);
      }
    }
    return n;
  }

  private advancePeripherals(t0: number, t1: number) {
    const dt = t1 - t0;
    while (this.scheduled.length && this.scheduled[0]!.t < t1 - 1e-12) { const ev = this.scheduled.shift()!; ev.fn(); }
    if (this.pendingIrq.length && this.fw?.globalIrqEnabled) { const list = this.pendingIrq; this.pendingIrq = []; for (const p of list) this.fwRaise(p.handler, p.prio, p.args); }
    if (this.family === "stm32") {
      for (const tim of Object.keys(TIM_BASE)) {
        const cfg = this.timerCfg(tim);
        if (!cfg.enabled || this.sleep === "stop") continue;
        const run = this.timerRun(tim);
        const period = cfg.arr + 1;
        const before = run.cnt;
        const f = this.timerClock(tim) / (cfg.psc + 1);
        run.cnt += dt * f;
        const wraps = Math.max(0, Math.floor((run.cnt + f * 2e-10 + 1e-9) / period));
        run.cnt -= wraps * period;
        for (let ch = 1; ch <= 4; ch++) {
          const ccr = this.r(`${tim}.CCR${ch}`) + 1e-6;
          const ccie = (cfg.dier >> ch) & 1;
          if (!(ccie || run.ocIt) || run.ic[ch - 1] || this.ccInput(tim, ch)) continue;
          const hits = wraps + (before < ccr && run.cnt >= ccr ? 1 : 0) - (before >= ccr && run.cnt < ccr && wraps > 0 ? 1 : 0);
          for (let k = 0; k < Math.min(hits, 32); k++) { this.setR(`${tim}.SR`, this.r(`${tim}.SR`) | (1 << ch)); run.activeCh = 1 << (ch - 1); this.timerIrq(tim, "cc", ch); }
        }
        for (let k = 0; k < Math.min(wraps, 64); k++) {
          run.updates++;
          run.lastUpdate = t1;
          this.setR(`${tim}.SR`, this.r(`${tim}.SR`) | 1);
          if ((cfg.dier & 1) || run.it) this.timerIrq(tim, "up", 0);
        }
      }
      const ctrl = this.r("SysTick.CTRL");
      if ((ctrl & 3) === 3 && this.fw?.hasFunction("SysTick_Handler")) {
        const period = (this.r("SysTick.LOAD") + 1) / this.clock;
        const n = Math.min(32, Math.max(0, Math.ceil(t1 / period - 1e-9) - Math.max(1, Math.ceil(t0 / period - 1e-9))));
        const tickPrio = this.fw.irqPriority.get("SysTick") ?? -1;
        for (let k = 0; k < n; k++) this.deliver("SysTick", "SysTick_Handler", [], tickPrio);
      }
    } else this.familyTimers(t0, t1);
    if (this.wdt.enabled) {
      this.wdt.counter -= dt;
      if (this.wdt.counter <= 0) { this.log("fault", `Watchdog timeout after ${(this.wdt.timeout * 1000).toFixed(0)} ms without refresh`); this.hardReset(this.family === "msp430" ? "Watchdog reset (WDT+ PUC)" : "Watchdog reset (IWDG)"); return; }
    }
    if (this.rtc.alarm >= 0) {
      const sod = (this.rtc.base + t1) % 86400, prev = (this.rtc.base + t0) % 86400;
      if (prev < this.rtc.alarm && sod >= this.rtc.alarm) { this.log("irq", "RTC alarm A matched"); this.deliver("RTC_Alarm", "RTC_Alarm_IRQHandler", [], undefined, "HAL_RTC_AlarmAEventCallback", [this.handle("hrtc")]); if (this.sleep === "standby") this.hardReset("Wake-up from Standby (RTC alarm)"); }
    }
  }

  protected familyTimers(t0: number, t1: number) {
    const dt = t1 - t0;
    if (this.family === "avr") {
      for (const t of ["0", "1", "2"]) {
        const cfg = this.avrTimer(t);
        if (!cfg) continue;
        const run = this.timerRun(`T${t}`);
        const ticks = dt * this.clock / cfg.prescale;
        const top = cfg.top + 1;
        run.cnt += ticks;
        const wraps = Math.max(0, Math.floor((run.cnt + this.clock / cfg.prescale * 2e-10 + 1e-9) / top));
        run.cnt -= wraps * top;
        const msk = this.r(`TIMSK${t}`);
        for (let k = 0; k < Math.min(wraps, 64); k++) {
          run.updates++;
          const ctc = (t === "1" && (cfg.mode === 4 || cfg.mode === 12)) || (t !== "1" && cfg.mode === 2);
          if (ctc && (msk & 2)) this.deliver(`TIMER${t}_COMPA`, `ISR_TIMER${t}_COMPA_vect`, []);
          else if (!ctc && (msk & 1)) this.deliver(`TIMER${t}_OVF`, `ISR_TIMER${t}_OVF_vect`, []);
          this.setR(`TIFR${t}`, this.r(`TIFR${t}`) | (ctc ? 2 : 1));
        }
        this.regs.set(`TCNT${t}`, Math.max(0, Math.floor(run.cnt)));
      }
    } else if (this.family === "8051") {
      const tmod = this.r("TMOD"), tcon = this.r("TCON");
      for (const t of [0, 1]) {
        if (!((tcon >> (4 + t * 2)) & 1)) continue;
        const mode = (tmod >> (t * 4)) & 3;
        const run = this.timerRun(`T${t}`);
        const ticks = dt * this.clock / 12;
        const th = this.r(`TH${t}`), tl = this.r(`TL${t}`);
        let wraps = 0;
        if (mode === 2) {
          let v = tl + ticks + run.cnt; const span = 256 - th;
          wraps = v >= 256 + 1e-6 ? 1 + Math.floor((v - 256) / span) : 0;
          v = wraps ? th + ((v - 256) % span) : Math.min(v, 256 - 1e-7);
          run.cnt = v - Math.floor(v); this.regs.set(`TL${t}`, Math.floor(v) & 0xff);
        } else {
          let v = ((th << 8) | tl) + ticks + run.cnt; const max = mode === 0 ? 8192 : 65536;
          if (v >= max + 1e-6) { wraps = 1; v = v - max; if (v > max) v %= max; } else v = Math.min(v, max - 1e-7);
          run.cnt = v - Math.floor(v); const iv = Math.floor(v); this.regs.set(`TH${t}`, (iv >> 8) & 0xff); this.regs.set(`TL${t}`, iv & 0xff);
        }
        for (let k = 0; k < Math.min(wraps, 64); k++) {
          run.updates++;
          this.setR("TCON", this.r("TCON") | (1 << (5 + t * 2)));
          const ie = this.r("IE");
          if ((ie & 0x80) && (ie >> (1 + t * 2)) & 1) this.deliverVector(t === 0 ? 1 : 3);
        }
      }
    } else if (this.family === "pic") {
      const opt = this.r("OPTION_REG");
      if (!((opt >> 5) & 1)) {
        const pre = (opt >> 3) & 1 ? 1 : 2 << (opt & 7);
        const run = this.timerRun("TMR0");
        run.cnt += dt * this.clock / 4 / pre;
        let v = this.r("TMR0") + Math.floor(run.cnt); run.cnt -= Math.floor(run.cnt);
        const wraps = Math.floor(v / 256); v %= 256; this.regs.set("TMR0", v);
        for (let k = 0; k < Math.min(wraps, 64); k++) {
          run.updates++;
          this.setR("INTCON", this.r("INTCON") | 4);
          if ((this.r("INTCON") & 0xa0) === 0xa0) this.deliverVector(-1);
        }
      }
    }
  }

  private timerIrq(tim: string, kind: "up" | "cc", ch: number) {
    const n = tim.slice(3);
    const run = this.timerRun(tim);
    const irq = tim === "TIM1" ? (kind === "up" ? "TIM1_UP_TIM10" : "TIM1_CC") : tim;
    const handlers = tim === "TIM1" ? (kind === "up" ? ["TIM1_UP_TIM10_IRQHandler", "TIM1_UP_IRQHandler"] : ["TIM1_CC_IRQHandler"]) : [`${tim}_IRQHandler`];
    const direct = handlers.find((h) => this.fw?.hasFunction(h));
    const cb = kind === "up" ? "HAL_TIM_PeriodElapsedCallback" : run.ic[ch - 1] ? "HAL_TIM_IC_CaptureCallback" : "HAL_TIM_OC_DelayElapsedCallback";
    const useHal = kind === "up" ? run.it : run.ocIt || run.icIt;
    if (direct && (!useHal || !this.fw?.hasFunction(cb))) this.deliver(irq, direct, []);
    else if (useHal) { this.setR(`${tim}.SR`, this.r(`${tim}.SR`) & ~(kind === "up" ? 1 : 1 << ch)); this.deliver(irq, "", [], undefined, cb, [this.handle(`htim${n}`)]); }
  }

  /* ---------------- interrupts ---------------- */
  handle(name: string): RefVal { return { kind: "ref", name, ref: { name, type: "handle", float: false, get: () => name, set: () => undefined } }; }
  nvicEnabled(irq: string): boolean {
    const fw = this.fw;
    if (!fw) return false;
    const strict = fw.irqEnabled.size > 0 || this.iserTouched;
    if (!strict) return true;
    const num = IRQ_NUM[irq];
    const iser = num === undefined ? 0 : (this.r(`NVIC.ISER${num >> 5}`) >> (num & 31)) & 1;
    return fw.irqEnabled.has(irq) || iser === 1 || irq === "SysTick";
  }
  irqPriority(irq: string): number {
    const fw = this.fw;
    const p = fw?.irqPriority.get(irq);
    if (p !== undefined) return p;
    const num = IRQ_NUM[irq];
    if (num !== undefined) { const ip = this.ram.get(NVIC_BASE + 0x300 + num); if (ip !== undefined) return ip >> 4; }
    return 0;
  }
  /** Deliver an IRQ: user handler first, otherwise a HAL-style callback. */
  deliver(irq: string, handler: string, args: Val[], prio?: number, callback?: string, cbArgs: Val[] = []) {
    const fw = this.fw;
    if (!fw || fw.error) return;
    if (irq !== "SysTick" && this.family === "stm32" && !this.nvicEnabled(irq)) return;
    const p = prio ?? this.irqPriority(irq);
    const target = handler && fw.hasFunction(handler) ? handler : callback && fw.hasFunction(callback) ? callback : "";
    if (!target) return;
    this.irqCount.set(irq, (this.irqCount.get(irq) ?? 0) + 1);
    this.fwRaise(target, p, target === handler ? args : cbArgs);
  }
  private fwRaise(handler: string, prio: number, args: Val[]) {
    const fw = this.fw;
    if (!fw) return;
    if (!fw.globalIrqEnabled) { if (!this.pendingIrq.some((x) => x.handler === handler)) this.pendingIrq.push({ handler, prio, args }); return; }
    if (fw.threads.some((t) => t.kind === "isr" && t.name === handler && t.state !== "done")) { this.latched.set(handler, { prio, args }); return; }
    if (fw.raise(handler, prio, args) && this.sleep !== "run" && this.sleep !== "standby") { this.log("power", `Woke from ${this.sleep} on ${handler}`); this.sleep = "run"; }
  }
  private deliverVector(v: number) {
    const fw = this.fw;
    if (!fw) return;
    const fn = fw.functionsWithVector().find((f) => (v < 0 ? f.vector === "pic" : f.vector === `8051:${v}`));
    if (!fn) return;
    const prio = this.family === "8051" ? -((this.r("IP") >> Math.max(0, v)) & 1) : 0;
    const irq = this.family === "8051" ? ["EX0", "T0", "EX1", "T1", "Serial"][v] ?? `V${v}` : "PIC";
    this.irqCount.set(irq, (this.irqCount.get(irq) ?? 0) + 1);
    this.fwRaise(fn.name, prio, []);
  }
  /** Interrupts that became pending again while their handler was running (tail-chained on exit). */
  private latched = new Map<string, { prio: number; args: Val[] }>();
  private afterIsr(name: string) {
    const again = this.latched.get(name);
    if (again) { this.latched.delete(name); this.fwRaise(name, again.prio, again.args); return; }
    if (this.family === "stm32") {
      const m = name.match(/^EXTI(\d+)(?:_(\d+))?_IRQHandler$/);
      if (m) {
        const lo = Number(m[2] ?? m[1]), hi = Number(m[1]);
        const pr = this.r("EXTI.PR") & this.r("EXTI.IMR");
        for (let n = Math.min(lo, hi); n <= Math.max(lo, hi); n++) if ((pr >> n) & 1) { this.log("fault", `EXTI${n} pending bit not cleared — ISR re-entered immediately`); this.fwRaise(name, this.irqPriority(name.replace("_IRQHandler", "")), []); return; }
      }
      const t = name.match(/^(TIM\d)(?:_UP\w*)?_IRQHandler$/);
      if (t && (this.r(`${t[1]}.SR`) & this.r(`${t[1]}.DIER`) & 1)) { this.log("fault", `${t[1]} UIF not cleared — ISR re-entered`); this.fwRaise(name, this.irqPriority(t[1]!), []); }
    } else if (this.family === "pic") {
      const ic = this.r("INTCON");
      if (((ic & 0x12) === 0x12 || (ic & 0x24) === 0x24) && (ic & 0x80)) { this.log("fault", "Interrupt flag (INTF/TMR0IF) not cleared — ISR re-entered"); this.deliverVector(-1); }
    }
  }
  private edgeInterrupts(key: string, lv: number) {
    if (!this.fw) return;
    const rising = lv === 1;
    const ard = this.arduinoIrq.get(key);
    if (ard) {
      const ok = ard.mode === 1 || (ard.mode === 3 && rising) || (ard.mode === 2 && !rising) || (ard.mode === 0 && !rising);
      if (ok) { this.irqCount.set(`INT:${key}`, (this.irqCount.get(`INT:${key}`) ?? 0) + 1); this.fwRaise(ard.fn, 0, []); }
    }
    if (this.family === "stm32") {
      this.timerCapture(key, rising);
      const m = key.match(/^P([A-E])(\d+)$/);
      if (!m) return;
      const n = Number(m[2]), port = m[1]!.charCodeAt(0) - 65;
      const sel = (this.r(`SYSCFG.EXTICR${(n >> 2) + 1}`) >> ((n & 3) * 4)) & 0xf;
      if (sel !== port || !((this.r("EXTI.IMR") >> n) & 1)) return;
      if (!((rising ? this.r("EXTI.RTSR") : this.r("EXTI.FTSR")) >> n & 1)) return;
      this.extiFire(n);
    } else if (this.family === "avr") {
      const map: Record<string, number> = { PD2: 0, PD3: 1 };
      const i = map[key];
      if (i === undefined || !((this.r("EIMSK") >> i) & 1)) return;
      const isc = (this.r("EICRA") >> (i * 2)) & 3;
      if (isc === 1 || (isc === 2 && !rising) || (isc === 3 && rising) || (isc === 0 && !rising)) { this.setR("EIFR", this.r("EIFR") | (1 << i)); this.deliver(`INT${i}`, `ISR_INT${i}_vect`, []); }
    } else if (this.family === "8051") {
      const i = key === "P3.2" ? 0 : key === "P3.3" ? 1 : -1;
      if (i < 0 || rising) return;
      this.setR("TCON", this.r("TCON") | (1 << (1 + i * 2)));
      const ie = this.r("IE");
      if ((ie & 0x80) && (ie >> (i * 2)) & 1) this.deliverVector(i * 2);
    } else if (this.family === "pic" && key === "RB0") {
      const edge = (this.r("OPTION_REG") >> 6) & 1;
      if ((edge === 1) !== rising) return;
      this.setR("INTCON", this.r("INTCON") | 2);
      if ((this.r("INTCON") & 0x90) === 0x90) this.deliverVector(-1);
    }
  }
  extiFire(n: number) {
    this.setR("EXTI.PR", this.r("EXTI.PR") | (1 << n));
    const irq = n < 5 ? `EXTI${n}` : n < 10 ? "EXTI9_5" : "EXTI15_10";
    const handler = `${irq}_IRQHandler`;
    if (this.fw?.hasFunction(handler)) this.deliver(irq, handler, []);
    else { this.setR("EXTI.PR", this.r("EXTI.PR") & ~(1 << n)); this.deliver(irq, "", [], undefined, "HAL_GPIO_EXTI_Callback", [1 << n]); }
  }
  configureExti(key: string, edge: EdgeKind | "none") {
    const m = key.match(/^P([A-E])(\d+)$/);
    if (!m) return;
    const n = Number(m[2]), port = m[1]!.charCodeAt(0) - 65;
    const cr = `SYSCFG.EXTICR${(n >> 2) + 1}`;
    this.regs.set(cr, (this.r(cr) & ~(0xf << ((n & 3) * 4))) | (port << ((n & 3) * 4)));
    const bit = 1 << n;
    const set = (r: string, on: boolean) => this.regs.set(r, on ? (this.r(r) | bit) >>> 0 : this.r(r) & ~bit);
    set("EXTI.IMR", edge !== "none"); set("EXTI.RTSR", edge === "rising" || edge === "both"); set("EXTI.FTSR", edge === "falling" || edge === "both");
  }

  /* ---------------- ADC / DAC / UART ---------------- */
  adcCode(ch: number, bits = this.adcBits, vref = this.vref): number {
    const v = Math.max(0, Math.min(vref, this.analog[ch] ?? 0));
    const max = 2 ** bits - 1;
    const code = Math.round((v / vref) * max + (this.adcNoise ? this.gauss() * this.adcNoise : 0));
    return Math.max(0, Math.min(max, code));
  }
  dacVolts(ch = 0) { return (this.dac[ch] ?? 0) / 4095 * this.vref; }
  private dacWrite(ch: number, code: number) { this.dac[ch] = Math.max(0, Math.min(4095, Math.round(code))); push(this.dacLog, [this.now, ch, this.dac[ch]!], 6000); }
  txBytes(bytes: number[]) {
    const dur = frameBits(this.uart.frame) / this.uart.baud;
    let t = Math.max(this.now, this.uart.busyUntil);
    for (const b of bytes) { push(this.uart.log, { t, byte: b & 0xff, dir: "tx", dur }, 3000); t += dur; }
    this.uart.busyUntil = t;
    this.uart.text = (this.uart.text + String.fromCharCode(...bytes.map((b) => b & 0xff))).slice(-6000);
    return t - this.now;
  }
  uartReceive(text: string | number[]) {
    const bytes = typeof text === "string" ? [...text].map((c) => c.charCodeAt(0) & 0xff) : text;
    const dur = frameBits(this.uart.frame) / this.uart.baud;
    bytes.forEach((b, k) => { push(this.uart.log, { t: this.now + k * dur, byte: b, dir: "rx", dur }, 3000); this.uart.rx.push(b); });
    this.uart.lastRx = this.now;
    if (this.uartRxIt && this.uart.rx.length >= this.uartRxIt.len) { const it = this.uartRxIt; this.uartRxIt = null; writeBytes(it.buf, this.uart.rx.splice(0, it.len)); this.deliver("USART2", "", [], undefined, "HAL_UART_RxCpltCallback", [this.handle(it.handle)]); }
    else if (this.family === "stm32" && (this.r("USART2.CR1") & 0x20)) this.deliver("USART2", "USART2_IRQHandler", []);
    else if (this.family === "avr" && (this.r("UCSR0B") & 0x80)) this.deliver("USART_RX", "ISR_USART_RX_vect", []);
    else if (this.family === "8051") { this.setR("SCON", this.r("SCON") | 1); if ((this.r("IE") & 0x90) === 0x90) this.deliverVector(4); }
    if (this.fw?.hasFunction("serialEvent")) this.fwRaise("serialEvent", 5, []);
  }

  /* ---------------- registers ---------------- */
  r(path: string): number { return this.regs.get(path) ?? 0; }
  private setR(path: string, v: number) { this.regs.set(path, v >>> 0); }
  addrOf(path: string): number | undefined {
    if (this.family === "avr") return AVR_REGS[path];
    if (this.family === "8051") return C51_REGS[path];
    if (this.family === "pic") return PIC_REGS[path];
    if (this.family === "msp430") return MSP_REGS[path];
    const [per, reg] = path.split(".");
    if (per === "NVIC") { const m = reg?.match(/^(ISER|ICER|ISPR|ICPR)(\d)$/); if (m) return NVIC_BASE + ({ ISER: 0, ICER: 0x80, ISPR: 0x100, ICPR: 0x180 } as Record<string, number>)[m[1]!]! + Number(m[2]) * 4; const ip = reg?.match(/^IP(\d+)$/); if (ip) return NVIC_BASE + 0x300 + Number(ip[1]); return undefined; }
    const p = per ? this.periph[per] : undefined;
    const off = p && reg ? p.regs[reg] : undefined;
    return p && off !== undefined ? p.base + off : undefined;
  }
  pathAt(addr: number): string | undefined {
    for (const [per, p] of Object.entries(this.periph)) { const off = addr - p.base; if (off < 0 || off > 0x400) continue; for (const [reg, o] of Object.entries(p.regs)) if (o === off) return `${per}.${reg}`; }
    if (addr >= NVIC_BASE && addr < NVIC_BASE + 0x200) { const off = addr - NVIC_BASE; const kind = ["ISER", "ICER", "ISPR", "ICPR"][off >> 7]; return `NVIC.${kind}${(off & 0x7f) >> 2}`; }
    if (addr >= NVIC_BASE + 0x300 && addr < NVIC_BASE + 0x400) return `NVIC.IP${addr - NVIC_BASE - 0x300}`;
    if (this.family === "avr") return Object.entries(AVR_REGS).find(([, a]) => a === addr)?.[0];
    if (this.family === "8051") return Object.entries(C51_REGS).find(([, a]) => a === addr)?.[0];
    if (this.family === "pic") return Object.entries(PIC_REGS).find(([, a]) => a === addr)?.[0];
    if (this.family === "msp430") return Object.entries(MSP_REGS).find(([, a]) => a === addr)?.[0];
    return undefined;
  }
  registerList(per: string): Array<{ path: string; addr: number; value: number }> {
    if (this.family !== "stm32") { const table = this.family === "avr" ? AVR_REGS : this.family === "8051" ? C51_REGS : this.family === "msp430" ? MSP_REGS : PIC_REGS; return Object.entries(table).filter(([n]) => n.startsWith(per) || per === "*").map(([n, a]) => ({ path: n, addr: a, value: this.peek(n) })); }
    const p = this.periph[per];
    if (!p) return [];
    return Object.entries(p.regs).map(([reg, off]) => ({ path: `${per}.${reg}`, addr: p.base + off, value: this.peek(`${per}.${reg}`) }));
  }
  private normalize(path: string): string | undefined {
    let p = path.replace(/\[(\d+)\]/g, "$1");
    p = p.replace(/^(GPIO[A-E])\.AFR0$/, "$1.AFRL").replace(/^(GPIO[A-E])\.AFR1$/, "$1.AFRH").replace(/^ADC\./, "ADC1.").replace(/^SYSCFG\.EXTICR(\d)$/, (_, d: string) => `SYSCFG.EXTICR${Number(d) + (Number(d) <= 3 && path.includes("[") ? 1 : 0)}`);
    if (this.family === "stm32") {
      const [per, reg] = p.split(".");
      if (!per || !reg) return undefined;
      if (per === "NVIC" && /^(ISER|ICER|ISPR|ICPR)\d$|^IP\d+$/.test(reg)) return p;
      if (/^h(?:(?:tim|uart|adc|i2c|spi)\d+|(?:dac|rtc|iwdg)\d?)$/.test(per) && /^(Instance|Channel|State)$/.test(reg)) return p;
      return this.periph[per]?.regs[reg] !== undefined ? p : undefined;
    }
    if (this.family === "avr") return AVR_REGS[p] !== undefined ? p : undefined;
    if (this.family === "8051") { if (C51_REGS[p] !== undefined || C51_BITS[p]) return p; if (/^P[0-3]\.[0-7]$/.test(p) || /^(TCON|IE|IP|SCON|PSW)\.[0-7]$/.test(p)) return p; if (/^P[0-3]_[0-7]$/.test(p)) return p.replace("_", "."); return undefined; }
    if (this.family === "pic") { if (PIC_REGS[p] !== undefined || PIC_BITS[p]) return p; if (/^\w+bits\.\w+$/.test(p)) return p; return undefined; }
    if (this.family === "msp430") return MSP_REGS[p] !== undefined ? p : undefined;
    return undefined;
  }
  reg(path: string): Ref | undefined {
    const p = this.normalize(path);
    if (!p) return undefined;
    return { name: p, type: "uint32_t", float: false, mmio: 4, get: () => this.readAny(p), set: (v) => this.write(p, toNum(v)) };
  }
  private readAny(p: string): Val {
    const m = p.match(/^h(tim|uart|adc|i2c|spi|dac|rtc|iwdg)(\d*)\.(\w+)$/);
    if (m) {
      const unit = m[1]!.toUpperCase(), n = m[2] ?? "";
      if (m[3] === "Instance") return unit === "UART" ? `USART${n}` : unit === "TIM" ? `TIM${n}` : `${unit}${n}`;
      if (m[3] === "Channel") return this.timers.get(`TIM${n}`)?.activeCh ?? 0;
      return 1;
    }
    return this.read(p);
  }
  /** Bus-level bookkeeping for MMIO accesses made by firmware or HAL calls. */
  access = new Map<string, { r: number; w: number; last: number }>();
  busLog: BusAccess[] = [];
  busCount = 0;
  busTap?: (e: BusAccess) => void;
  private touch(p: string, rw: "R" | "W", value: number) {
    const per = this.family === "stm32" ? p.split(".")[0]! : p.replace(/\..*$/, "");
    let a = this.access.get(per);
    if (!a) { a = { r: 0, w: 0, last: 0 }; this.access.set(per, a); }
    if (rw === "R") a.r++; else a.w++;
    a.last = this.now;
    this.busCount++;
    const e: BusAccess = { t: this.now, path: p, addr: this.addrOf(p) ?? 0, rw, value: value >>> 0 };
    push(this.busLog, e, 300);
    this.busTap?.(e);
  }
  /** Register value for display — no side effects and no bus bookkeeping. */
  peek(p: string): number {
    if (this.family === "stm32") {
      const [per, reg] = p.split(".") as [string, string];
      if (per.startsWith("USART") && reg === "DR") return this.r(p);
      if (per.startsWith("GPIO") && reg === "BSRR") return 0;
    }
    if (p === "UDR0" || p === "SBUF" || p === "RCREG") return this.r(p);
    return this.readRaw(p);
  }
  read(p: string): number { const v = this.readRaw(p); this.touch(p, "R", v); return v; }
  private readRaw(p: string): number {
    if (this.family === "stm32") {
      const [per, reg] = p.split(".") as [string, string];
      if (per.startsWith("GPIO") && reg === "IDR") { const port = per[4]!; let v = 0; for (let n = 0; n < 16; n++) if (this.level(this.pinKey(port, n))) v |= 1 << n; return v >>> 0; }
      if (per.startsWith("GPIO") && reg === "BSRR") return 0;
      if (per.startsWith("TIM") && reg === "CNT") return Math.max(0, Math.floor(this.timerRun(per).cnt));
      if (per.startsWith("USART")) {
        if (reg === "SR") return (this.now >= this.uart.busyUntil ? 0xc0 : 0) | (this.uart.rx.length ? 0x20 : 0);
        if (reg === "DR") return this.uart.rx.shift() ?? 0;
      }
      if (per === "ADC1" && reg === "SR") return this.r("ADC1.SR") | ((this.r("ADC1.CR2") & 1) ? 2 : 0);
      if (per === "SysTick" && reg === "VAL") { const load = this.r("SysTick.LOAD") + 1; return (this.r("SysTick.CTRL") & 1) ? Math.floor(load - ((this.now * this.clock) % load)) : 0; }
      if (per === "RCC" && reg === "CR") { const cr = this.r("RCC.CR"); return (cr | ((cr & 1) << 1) | ((cr & 0x10000) << 1) | ((cr & 0x1000000) << 1)) >>> 0; }
      if (per === "RCC" && reg === "CFGR") { const c = this.r("RCC.CFGR"); return ((c & ~0xc) | ((c & 3) << 2)) >>> 0; }
      if (per === "IWDG" && reg === "SR") return 0;
      if (per === "NVIC" && reg.startsWith("IP")) return this.ram.get(NVIC_BASE + 0x300 + Number(reg.slice(2))) ?? 0;
      if (per === "DAC" && reg === "DOR1") return this.dac[0] ?? 0;
      return this.r(p);
    }
    if (this.family === "avr") {
      const port = p.match(/^PIN([B-D])$/);
      if (port) { let v = 0; for (let n = 0; n < 8; n++) if (this.level(this.pinKey(port[1]!, n))) v |= 1 << n; return v; }
      if (p === "UCSR0A") return (this.now >= this.uart.busyUntil ? 0x60 : 0) | (this.uart.rx.length ? 0x80 : 0);
      if (p === "UDR0") return this.uart.rx.shift() ?? 0;
      if (p === "ADC" || p === "ADCL") return this.r("ADC_RESULT") & (p === "ADC" ? 0x3ff : 0xff);
      if (p === "ADCH") return this.r("ADC_RESULT") >> 8;
      if (p === "ACSR") { const a = this.r("ACSR"); return (a & ~0x20) | (this.acOut && !(a & 0x80) ? 0x20 : 0); }
      if (/^TCNT[012]$/.test(p)) return Math.max(0, Math.floor(this.timers.get(`T${p.slice(4)}`)?.cnt ?? 0));
      return this.r(p);
    }
    if (this.family === "8051") {
      const bit = C51_BITS[p];
      if (bit) return (this.readRaw(bit[0]) >> bit[1]) & 1;
      const pb = p.match(/^(P[0-3]|TCON|IE|IP|SCON|PSW)\.([0-7])$/);
      if (pb) return (this.readRaw(pb[1]!) >> Number(pb[2])) & 1;
      const port = p.match(/^P([0-3])$/);
      if (port) { let v = 0; for (let n = 0; n < 8; n++) if (this.level(this.pinKey(port[1]!, n))) v |= 1 << n; return v; }
      if (p === "SBUF") { const b = this.uart.rx.shift() ?? 0; return b; }
      return this.r(p);
    }
    if (this.family === "pic") {
      const bit = PIC_BITS[p];
      if (bit) return (this.readRaw(bit[0]) >> bit[1]) & 1;
      const bf = p.match(/^(\w+)bits\.(\w+?)(\d)?$/);
      if (bf) { const reg = bf[1]!; const nb = PIC_BITS[bf[2]! + (bf[3] ?? "")]; const n = bf[3] !== undefined ? Number(bf[3]) : nb ? nb[1] : 0; return (this.readRaw(reg) >> n) & 1; }
      const port = p.match(/^PORT([A-D])$/);
      if (port) { let v = 0; for (let n = 0; n < 8; n++) if (this.level(this.pinKey(port[1]!, n))) v |= 1 << n; return v; }
      if (p === "RCREG") return this.uart.rx.shift() ?? 0;
      if (p === "PIR1") return this.r("PIR1") | (this.now >= this.uart.busyUntil ? 0x10 : 0) | (this.uart.rx.length ? 0x20 : 0);
      return this.r(p);
    }
    if (this.family === "msp430") {
      const port = p.match(/^P([12])IN$/);
      if (port) { let v = 0; for (let n = 0; n < 8; n++) if (this.level(this.pinKey(port[1]!, n))) v |= 1 << n; return v; }
      return this.r(p);
    }
    return this.r(p);
  }
  write(p: string, value: number) {
    const v = value >>> 0;
    this.touch(p, "W", v);
    if (this.family === "stm32") return this.writeStm32(p, v);
    if (this.family === "avr") return this.writeAvr(p, v);
    if (this.family === "8051") return this.write51(p, v);
    if (this.family === "pic") return this.writePic(p, v);
    if (this.family === "msp430") return this.writeMsp(p, v);
  }
  private writeMsp(p: string, v: number) {
    if (p === "WDTCTL") {
      if ((v & 0xff00) !== 0x5a00) { this.log("fault", "WDTCTL written without the WDTPW password"); this.hardReset("Watchdog password violation (PUC)"); return; }
      this.setR(p, 0x6900 | (v & 0x77));
      if (v & 0x80) { this.wdt.enabled = false; return; }
      const timeout = [32768, 8192, 512, 64][v & 3]! / this.clock;
      this.wdt = { ...this.wdt, enabled: true, timeout, counter: timeout, kicks: this.wdt.kicks + ((v & 0x08) ? 1 : 0) };
      return;
    }
    if (p === "BCSCTL1") { const cal = Object.values(MSP_CAL).find(([code]) => code === (v & 0xff)); if (cal) this.clock = cal[1]; }
    this.setR(p, v & 0xff);
    const m = p.match(/^P([12])(DIR|OUT|REN)$/);
    if (!m) return;
    const port = m[1]!, dir = this.r(`P${port}DIR`), out = this.r(`P${port}OUT`), ren = this.r(`P${port}REN`);
    for (let n = 0; n < 8; n++) {
      const key = this.pinKey(port, n);
      const isOut = (dir >> n) & 1;
      if (!this.pins.has(key) && !isOut && !((ren >> n) & 1)) continue;
      const pin = this.pin(key);
      pin.mode = isOut ? "out" : "in";
      pin.out = (out >> n) & 1;
      pin.pull = !isOut && (ren >> n) & 1 ? ((out >> n) & 1 ? "up" : "down") : "none";
      this.refreshPin(pin);
    }
  }
  private get apb2Bits(): Record<string, number> {
    return this.part === "F103" ? { AFIO: 0, ADC1: 9, TIM1: 11, SPI1: 12, USART1: 14 } : { TIM1: 0, USART1: 4, ADC1: 8, SPI1: 12, SYSCFG: 14 };
  }
  /** RCC register and bit that gate a peripheral's clock. */
  clockGate(per: string): { reg: string; bit: number } | undefined {
    const g = per.match(/^GPIO([A-K])$/);
    if (g) return this.part === "F103" ? { reg: "RCC.APB2ENR", bit: 2 + g[1]!.charCodeAt(0) - 65 } : { reg: "RCC.AHB1ENR", bit: g[1]!.charCodeAt(0) - 65 };
    const apb1: Record<string, number> = { TIM2: 0, TIM3: 1, TIM4: 2, TIM5: 3, USART2: 17, I2C1: 21, PWR: 28, DAC: 29 };
    if (apb1[per] !== undefined) return { reg: "RCC.APB1ENR", bit: apb1[per]! };
    const b = this.apb2Bits[per];
    return b !== undefined ? { reg: "RCC.APB2ENR", bit: b } : undefined;
  }
  /** Peripherals whose RCC enable bit is forced to 0 (fault injection: the firmware's enable write is lost). */
  gateStuck = new Set<string>();
  clockEnabled(per: string): boolean {
    const g = this.clockGate(per);
    if (g && this.gateStuck.has(per)) { this.setR(g.reg, this.r(g.reg) & ~(1 << g.bit)); return false; }
    return !g || ((this.r(g.reg) >> g.bit) & 1) === 1;
  }
  private clockOn(per: string): boolean {
    if (!this.strictClock) return true;
    return this.clockEnabled(per);
  }
  private writeStm32(p: string, v: number) {
    const [per, reg] = p.split(".") as [string, string];
    if (!this.clockOn(per)) { this.log("fault", `${per}->${reg} write ignored: peripheral clock disabled in RCC`); return; }
    if (per === "FLASH") { this.writeFlashReg(reg, v); return; }
    if (per.startsWith("GPIO")) {
      const port = per[4]!;
      if (reg === "IDR") return;
      if (reg === "BSRR") { const odr = this.r(`${per}.ODR`); this.setR(`${per}.ODR`, (odr | (v & 0xffff)) & ~(v >>> 16)); }
      else if (reg === "BRR") this.setR(`${per}.ODR`, this.r(`${per}.ODR`) & ~(v & 0xffff));
      else this.setR(p, v);
      this.applyGpioRegs(port);
      return;
    }
    if (per.startsWith("TIM")) {
      if (reg === "CNT") { this.timerRun(per).cnt = v; return; }
      if (reg === "EGR" && (v & 1)) { this.timerRun(per).cnt = 0; return; }
      if (reg === "SR") { this.setR(p, this.r(p) & v); return; }
      this.setR(p, v);
      if (/^(CCR\d|CCER|CCMR\d|CR1|ARR|PSC)$/.test(reg)) this.refreshAfPins();
      return;
    }
    if (per.startsWith("USART")) {
      if (reg === "DR") { this.txBytes([v & 0xff]); return; }
      this.setR(p, v);
      if (reg === "BRR" && v > 0) this.uart.baud = Math.round(this.clock / 2 / v);
      return;
    }
    if (per === "EXTI") {
      if (reg === "PR") { this.setR(p, this.r(p) & ~v); return; }
      if (reg === "SWIER") { for (let n = 0; n < 23; n++) if ((v >> n) & 1 && (this.r("EXTI.IMR") >> n) & 1) this.extiFire(n); return; }
    }
    if (per === "NVIC") {
      const m = reg.match(/^(ISER|ICER|ISPR|ICPR)(\d)$/);
      if (m) {
        const idx = Number(m[2]);
        this.iserTouched = true;
        if (m[1] === "ISER") this.setR(`NVIC.ISER${idx}`, this.r(`NVIC.ISER${idx}`) | v);
        else if (m[1] === "ICER") this.setR(`NVIC.ISER${idx}`, this.r(`NVIC.ISER${idx}`) & ~v);
        else if (m[1] === "ISPR") for (let b = 0; b < 32; b++) if ((v >> b) & 1) { const irq = Object.entries(IRQ_NUM).find(([, n]) => n === idx * 32 + b)?.[0]; if (irq) this.deliver(irq, `${irq}_IRQHandler`, []); }
        return;
      }
      if (reg.startsWith("IP")) { this.ram.set(NVIC_BASE + 0x300 + Number(reg.slice(2)), v & 0xff); return; }
    }
    if (per === "ADC1" && reg === "CR2") { this.setR(p, v & ~(1 << 30)); if (v & (1 << 30)) this.adcConvert(this.r("ADC1.SQR3") & 0x1f); return; }
    if (per === "ADC1" && reg === "SR") { this.setR(p, this.r(p) & v); return; }
    if (per === "DAC") {
      if (reg === "DHR12R1") this.dacWrite(0, v & 0xfff); else if (reg === "DHR12R2") this.dacWrite(1, v & 0xfff); else if (reg === "DHR8R1") this.dacWrite(0, (v & 0xff) << 4);
      else if (reg === "CR") { this.dacEnabled = [(v & 1) === 1, ((v >> 16) & 1) === 1]; }
      this.setR(p, v);
      return;
    }
    if (per === "IWDG") {
      if (reg === "KR") { if (v === 0xcccc) this.startWdt(); else if (v === 0xaaaa) this.kickWdt(); return; }
      this.setR(p, v);
      if (reg === "PR") this.wdt.prescaler = v & 7; else if (reg === "RLR") this.wdt.reload = v & 0xfff;
      return;
    }
    if (per === "RCC" && reg === "CFGR") { this.setR(p, v); return; }
    this.setR(p, v);
  }
  adcConvert(ch: number) { const code = this.adcCode(ch); this.setR("ADC1.DR", code); this.setR("ADC1.SR", this.r("ADC1.SR") | 2); return code; }
  private applyGpioRegs(port: string) {
    const per = `GPIO${port}`;
    if (this.part === "F103") {
      const cr = [this.r(`${per}.CRL`), this.r(`${per}.CRH`)], odr = this.r(`${per}.ODR`);
      for (let n = 0; n < 16; n++) {
        const key = this.pinKey(port, n);
        const nib = (cr[n >> 3]! >>> ((n & 7) * 4)) & 0xf;
        const mode = nib & 3, cnf = nib >> 2;
        if (!this.pins.has(key) && nib === 4 && !((odr >> n) & 1)) continue;
        const p = this.pin(key);
        if (mode === 0) { p.mode = cnf === 0 ? "an" : "in"; p.pull = cnf === 2 ? ((odr >> n) & 1 ? "up" : "down") : "none"; p.od = false; }
        else { p.mode = cnf >= 2 ? "af" : "out"; p.od = (cnf & 1) === 1; p.pull = "none"; }
        p.out = (odr >> n) & 1;
        this.refreshPin(p);
      }
      return;
    }
    const moder = this.r(`${per}.MODER`), ot = this.r(`${per}.OTYPER`), pupd = this.r(`${per}.PUPDR`), odr = this.r(`${per}.ODR`);
    const afr = (this.r(`${per}.AFRH`) * 2 ** 32) + this.r(`${per}.AFRL`);
    for (let n = 0; n < 16; n++) {
      const key = this.pinKey(port, n);
      const exists = this.pins.has(key);
      const mode = (moder >> (n * 2)) & 3;
      if (!exists && mode === 0 && !((odr >> n) & 1)) continue;
      const p = this.pin(key);
      p.mode = (["in", "out", "af", "an"] as const)[mode]!;
      p.od = ((ot >> n) & 1) === 1;
      p.pull = (["none", "up", "down", "none"] as const)[(pupd >> (n * 2)) & 3]!;
      p.out = (odr >> n) & 1;
      p.af = Math.floor(afr / 2 ** (n * 4)) & 0xf;
      this.refreshPin(p);
    }
  }
  private refreshAfPins() { for (const p of this.pins.values()) if (p.mode === "af") this.refreshPin(p); }
  private writeAvr(p: string, v: number) {
    const port = p.match(/^(DDR|PORT|PIN)([B-D])$/);
    if (port) {
      const L = port[2]!;
      if (port[1] === "PIN") this.setR(`PORT${L}`, this.r(`PORT${L}`) ^ v); else this.setR(p, v & 0xff);
      const ddr = this.r(`DDR${L}`), out = this.r(`PORT${L}`);
      for (let n = 0; n < 8; n++) {
        const key = this.pinKey(L, n);
        if (!this.pins.has(key) && !((ddr | out) >> n & 1)) continue;
        const pin = this.pin(key);
        const isOut = ((ddr >> n) & 1) === 1;
        pin.mode = isOut ? "out" : "in"; pin.out = (out >> n) & 1; pin.pull = !isOut && pin.out ? "up" : "none";
        if (isOut && this.familyPwm(key)) pin.mode = "af";
        this.refreshPin(pin);
      }
      return;
    }
    if (p === "UDR0") { this.txBytes([v & 0xff]); return; }
    if (p === "UBRR0" || p === "UBRR0L") { this.setR(p, v); this.uart.baud = Math.round(this.clock / 16 / ((v & 0xfff) + 1)); return; }
    if (p === "ADCSRA") { this.setR(p, v & ~0x40); if ((v & 0xc0) === 0xc0) { const ch = this.r("ADMUX") & 0xf; const vref = (this.r("ADMUX") >> 6) === 3 ? 1.1 : this.vref; this.setR("ADC_RESULT", this.adcCode(ch, 10, vref)); this.setR("ADCSRA", this.r("ADCSRA") | 0x10); } return; }
    if (/^TIFR\d$|^EIFR$/.test(p)) { this.setR(p, this.r(p) & ~v); return; }
    if (p === "ACSR") { this.setR(p, (v & ~0x30) | (this.r(p) & 0x10 & ~v)); return; }
    if (/^TCNT[012]$/.test(p)) { this.timerRun(`T${p.slice(4)}`).cnt = v; return; }
    if (p === "SREG" && this.fw) this.fw.globalIrqEnabled = ((v >> 7) & 1) === 1;
    this.setR(p, v);
    if (/^(TCCR|OCR)/.test(p)) for (const key of ["PB1", "PB2", "PB3", "PD3", "PD5", "PD6"]) { const pin = this.pins.get(key); if (pin && (pin.mode === "out" || pin.mode === "af")) { pin.mode = this.familyPwm(key) ? "af" : "out"; this.refreshPin(pin); } }
  }
  private write51(p: string, v: number) {
    const bit = C51_BITS[p];
    if (bit) { const cur = this.r(bit[0]); this.write51(bit[0], v & 1 ? cur | (1 << bit[1]) : cur & ~(1 << bit[1])); return; }
    const pb = p.match(/^(P[0-3]|TCON|IE|IP|SCON|PSW)\.([0-7])$/);
    if (pb) { const reg = pb[1]!; const cur = this.r(reg); this.write51(reg, v & 1 ? cur | (1 << Number(pb[2])) : cur & ~(1 << Number(pb[2]))); return; }
    const port = p.match(/^P([0-3])$/);
    if (port) {
      this.setR(p, v & 0xff);
      for (let n = 0; n < 8; n++) { const pin = this.pin(this.pinKey(port[1]!, n)); pin.out = (v >> n) & 1; pin.mode = pin.out ? "in" : "out"; this.refreshPin(pin); }
      return;
    }
    if (p === "SBUF") { const d = this.txBytes([v & 0xff]); this.schedule(this.now + d, () => { this.setR("SCON", this.r("SCON") | 2); if ((this.r("IE") & 0x90) === 0x90) this.deliverVector(4); }); return; }
    if (p === "IE" && this.fw) this.fw.globalIrqEnabled = true;
    if (p === "TH1" && (this.r("TMOD") & 0x20)) { this.setR(p, v); const smod = (this.r("PCON") >> 7) & 1; this.uart.baud = Math.round((2 ** smod / 32) * this.clock / (12 * (256 - (v & 0xff)))); return; }
    this.setR(p, v & 0xff);
  }
  private writePic(p: string, v: number) {
    const bit = PIC_BITS[p];
    if (bit) { const cur = this.r(bit[0]); this.writePic(bit[0], v & 1 ? cur | (1 << bit[1]) : cur & ~(1 << bit[1])); return; }
    const bf = p.match(/^(\w+)bits\.(\w+?)(\d)?$/);
    if (bf) { const reg = bf[1]!; const nb = PIC_BITS[bf[2]! + (bf[3] ?? "")]; const n = bf[3] !== undefined ? Number(bf[3]) : nb ? nb[1] : 0; const target = reg === "PORT" ? "LAT" : reg; const cur = this.r(target.startsWith("PORT") ? target.replace("PORT", "LAT") : target); this.writePic(target.startsWith("PORT") ? target.replace("PORT", "LAT") : target, v & 1 ? cur | (1 << n) : cur & ~(1 << n)); return; }
    const port = p.match(/^(TRIS|LAT|PORT)([A-D])$/);
    if (port) {
      const L = port[2]!;
      this.setR(port[1] === "PORT" ? `LAT${L}` : p, v & 0xff);
      const tris = this.r(`TRIS${L}`), lat = this.r(`LAT${L}`);
      for (let n = 0; n < 8; n++) {
        const key = this.pinKey(L, n);
        if (!this.pins.has(key) && ((tris >> n) & 1) && !((lat >> n) & 1)) continue;
        const pin = this.pin(key);
        pin.mode = (tris >> n) & 1 ? "in" : "out"; pin.out = (lat >> n) & 1;
        if (key === "RC2" && pin.mode === "out" && this.familyPwm(key)) pin.mode = "af";
        this.refreshPin(pin);
      }
      return;
    }
    if (p === "TXREG") { this.txBytes([v & 0xff]); return; }
    if (p === "INTCON" && this.fw) this.fw.globalIrqEnabled = ((v >> 7) & 1) === 1;
    if (p === "ADCON0") { this.setR(p, v & ~4); if ((v & 5) === 5) { const ch = (v >> 3) & 7; const code = this.adcCode(ch, 10); const right = (this.r("ADCON1") >> 7) & 1; this.setR("ADRESH", right ? code >> 8 : code >> 2); this.setR("ADRESL", right ? code & 0xff : (code & 3) << 6); this.setR("PIR1", this.r("PIR1") | 0x40); } return; }
    this.setR(p, v & 0xffff);
    if (/^(CCP1CON|CCPR1L|PR2|T2CON)$/.test(p)) { const pin = this.pins.get("RC2"); if (pin && (pin.mode === "out" || pin.mode === "af")) { pin.mode = this.familyPwm("RC2") ? "af" : "out"; this.refreshPin(pin); } }
  }
  private startWdt() { this.wdt.enabled = true; this.wdt.timeout = ((4 << this.wdt.prescaler) * (this.wdt.reload + 1)) / 32000; this.wdt.counter = this.wdt.timeout; this.log("info", `Watchdog started: timeout ${(this.wdt.timeout * 1000).toFixed(0)} ms`); }
  kickWdt() { if (!this.wdt.enabled) return; this.wdt.counter = this.wdt.timeout; this.wdt.kicks++; }

  readMem(addr: number, size: number): number {
    const path = this.pathAt(addr);
    if (path) return this.read(path);
    if (this.family === "stm32") {
      if (addr >= 0x20000000 && addr < 0x20020000) { let v = 0; for (let k = 0; k < size; k++) v |= (this.ram.get(addr + k) ?? 0) << (8 * k); return v >>> 0; }
      if (addr >= 0x08000000 && addr < 0x08000000 + this.flashSize) { let v = 0; for (let k = 0; k < size; k++) { const a = addr + k, h = this.flash.get(a & ~1) ?? 0xffff; v |= ((a & 1 ? h >> 8 : h) & 0xff) << (8 * k); } return v >>> 0; }
      this.busFault(addr, "read");
      return 0;
    }
    return this.ram.get(addr) ?? 0;
  }
  writeMem(addr: number, v: number, size: number) {
    const path = this.pathAt(addr);
    if (path) { this.write(path, v); return; }
    if (this.family === "stm32") {
      if (addr >= 0x20000000 && addr < 0x20020000) { for (let k = 0; k < size; k++) this.ram.set(addr + k, (v >>> (8 * k)) & 0xff); return; }
      if (addr >= 0x08000000 && addr < 0x08000000 + this.flashSize) {
        if (this.flashLocked || !(this.r("FLASH.CR") & 1)) { this.busFault(addr, "write to Flash (unlock with FLASH->KEYR and set FLASH_CR_PG first)"); return; }
        if (this.part === "F103" && size !== 2) { this.flashFail(addr, `PGERR: STM32F1 Flash must be programmed one 16-bit halfword at a time (got a ${size * 8}-bit write)`); return; }
        this.flashProgram(addr, v, size);
        return;
      }
      this.busFault(addr, "write");
      return;
    }
    this.ram.set(addr, v & 0xff);
  }

  /* ---------------- Flash controller ---------------- */
  get flashSize() { return this.part === "F103" ? 128 * 1024 : 512 * 1024; }
  private flashLockBit() { return this.part === "F103" ? 0x80 : 0x80000000; }
  get flashLocked() { return (this.r("FLASH.CR") & this.flashLockBit()) !== 0; }
  /** Erase unit containing addr: 1 KB pages on F103, 16/64/128 KB sectors on F401. */
  flashUnit(addr: number): { base: number; size: number; index: number } {
    const off = Math.max(0, addr - 0x08000000);
    if (this.part === "F103") { const index = Math.floor(off / 1024); return { base: 0x08000000 + index * 1024, size: 1024, index }; }
    const sizes = [16, 16, 16, 16, 64, 128, 128, 128].map((k) => k * 1024);
    let base = 0x08000000;
    for (let i = 0; i < sizes.length; i++) { if (addr < base + sizes[i]!) return { base, size: sizes[i]!, index: i }; base += sizes[i]!; }
    return { base: 0x08000000 + 384 * 1024, size: 128 * 1024, index: 7 };
  }
  private flashLog(kind: FlashOp["kind"], addr: number, text: string, value?: number) {
    push(this.flashOps, { t: this.time, kind, addr, value, text }, 200);
    this.log(kind === "error" ? "fault" : "info", text);
  }
  private flashFail(addr: number, text: string) {
    this.flashError = this.part === "F103" ? 0x04 : 0x80;
    this.setR("FLASH.SR", this.r("FLASH.SR") | (this.part === "F103" ? 0x04 : 0x80));
    this.flashLog("error", addr, text);
  }
  private flashUnlockKey(v: number) {
    if (!this.flashLocked) return;
    if (this.flashKey === 0 && v === 0x45670123) { this.flashKey = 1; return; }
    if (this.flashKey === 1 && v === 0xcdef89ab) { this.flashKey = 0; this.setR("FLASH.CR", this.r("FLASH.CR") & ~this.flashLockBit()); this.flashLog("unlock", 0, "Flash unlocked (KEY1 + KEY2 written to FLASH->KEYR)"); return; }
    this.flashKey = 0;
    this.flashFail(0, `Wrong FLASH->KEYR sequence (0x${(v >>> 0).toString(16).toUpperCase()}) — Flash stays locked`);
  }
  flashLock() { this.setR("FLASH.CR", this.flashLockBit()); this.flashLog("lock", 0, "Flash locked (FLASH_CR_LOCK)"); }
  /** Erase one page/sector; returns the erase time in seconds. */
  flashEraseUnit(addr: number): number {
    if (this.flashLocked) { this.flashFail(addr, "Erase rejected: Flash is locked (call HAL_FLASH_Unlock first)"); return 0; }
    if (addr < 0x08000000 || addr >= 0x08000000 + this.flashSize) { this.flashFail(addr, `Erase rejected: 0x${(addr >>> 0).toString(16).toUpperCase()} is outside Flash`); return 0; }
    const u = this.flashUnit(addr);
    for (const a of [...this.flash.keys()]) if (a >= u.base && a < u.base + u.size) this.flash.delete(a);
    const wear = (this.flashWear.get(u.base) ?? 0) + 1;
    this.flashWear.set(u.base, wear);
    this.setR("FLASH.SR", this.r("FLASH.SR") | (this.part === "F103" ? 0x20 : 0x01));
    this.flashLog("erase", u.base, `${this.part === "F103" ? "Page" : "Sector"} ${u.index} erased (0x${u.base.toString(16).toUpperCase()}, ${u.size / 1024} KB) — erase cycle #${wear}`);
    return this.part === "F103" ? 0.02 : u.size <= 16384 ? 0.25 : u.size <= 65536 ? 0.55 : 1.0;
  }
  /** Program `bytes` bytes at addr (halfword granularity); returns { ok, seconds }. */
  flashProgram(addr: number, value: number, bytes: number): { ok: boolean; seconds: number } {
    if (this.flashLocked) { this.flashFail(addr, "Program rejected: Flash is locked (call HAL_FLASH_Unlock first)"); return { ok: false, seconds: 0 }; }
    if (addr & 1 || addr < 0x08000000 || addr + bytes > 0x08000000 + this.flashSize) { this.flashFail(addr, `PGERR: invalid Flash address 0x${(addr >>> 0).toString(16).toUpperCase()}`); return { ok: false, seconds: 0 }; }
    const halves = Math.max(1, bytes / 2);
    const lo = value >>> 0, hi = Math.floor(value / 2 ** 32) >>> 0;
    const half = (k: number) => (bytes === 1 ? 0xff00 | (lo & 0xff) : (k < 2 ? lo >>> (16 * k) : hi >>> (16 * (k - 2))) & 0xffff);
    for (let k = 0; k < halves; k++) {
      const a = addr + 2 * k, cur = this.flash.get(a) ?? 0xffff;
      const nv = half(k);
      const bad = this.part === "F103" ? cur !== 0xffff && nv !== 0 : (cur & nv) !== nv;
      if (bad) { this.flashFail(a, `PGERR: 0x${a.toString(16).toUpperCase()} is not erased (holds 0x${cur.toString(16).toUpperCase().padStart(4, "0")}) — erase the page before writing`); return { ok: false, seconds: k * 52e-6 }; }
    }
    for (let k = 0; k < halves; k++) { const a = addr + 2 * k; this.flash.set(a, (this.flash.get(a) ?? 0xffff) & half(k)); }
    this.setR("FLASH.SR", this.r("FLASH.SR") | (this.part === "F103" ? 0x20 : 0x01));
    this.flashLog("program", addr, `Programmed ${bytes * 8}-bit 0x${(bytes > 4 ? value : lo).toString(16).toUpperCase().padStart(bytes * 2, "0")} at 0x${addr.toString(16).toUpperCase()}`, lo);
    return { ok: true, seconds: halves * (this.part === "F103" ? 52.5e-6 : 16e-6) };
  }
  private writeFlashReg(reg: string, v: number) {
    const p = `FLASH.${reg}`;
    if (reg === "KEYR") { this.flashUnlockKey(v >>> 0); return; }
    if (reg === "SR") { this.setR(p, this.r(p) & ~v); if (!(this.r(p) & 0xf6)) this.flashError = 0; return; }
    if (reg !== "CR") { this.setR(p, v); return; }
    const lock = this.flashLockBit();
    if (this.flashLocked) { this.log("fault", "FLASH->CR write ignored: Flash is locked"); return; }
    if (v & lock) { this.flashLock(); return; }
    const strt = this.part === "F103" ? 0x40 : 0x10000;
    this.setR(p, v & ~strt);
    if (!(v & strt)) return;
    if (this.part === "F103") {
      if (v & 2) this.flashEraseUnit(this.r("FLASH.AR"));
      else if (v & 4) for (let a = 0x08000000; a < 0x08000000 + this.flashSize; a += 1024) this.flashEraseUnit(a);
    } else if (v & 2) {
      const sector = (v >> 3) & 0xf;
      let base = 0x08000000;
      for (let i = 0; i < sector; i++) base += (i < 4 ? 16 : i === 4 ? 64 : 128) * 1024;
      this.flashEraseUnit(base);
    } else if (v & 4) for (let i = 0, base = 0x08000000; i < 8; base += (i < 4 ? 16 : i === 4 ? 64 : 128) * 1024, i++) this.flashEraseUnit(base);
  }
  private busFault(addr: number, what: string) {
    const msg = `HardFault: bus error on ${what} at 0x${(addr >>> 0).toString(16).toUpperCase().padStart(8, "0")}`;
    this.log("fault", msg);
    this.fw?.fail(new Error(msg), this.fw.line);
  }

  constant(name: string): number | undefined {
    const hit = this.constCache.get(name);
    if (hit !== undefined) return hit ?? undefined;
    const v = this.resolveConstant(name);
    this.constCache.set(name, v ?? null);
    return v;
  }
  private resolveConstant(name: string): number | undefined {
    const extra = this.opts.constants?.[name];
    if (extra !== undefined) return extra;
    if (this.part === "F103") {
      let f = name.match(/^RCC_APB2ENR_IOP([A-E])EN$/); if (f) return 1 << (2 + f[1]!.charCodeAt(0) - 65);
      const f1: Record<string, number> = { RCC_APB2ENR_AFIOEN: 1, RCC_APB2ENR_ADC1EN: 1 << 9, RCC_APB2ENR_TIM1EN: 1 << 11, RCC_APB2ENR_SPI1EN: 1 << 12, RCC_APB2ENR_USART1EN: 1 << 14 };
      if (f1[name] !== undefined) return f1[name];
      f = name.match(/^GPIO_(CRL|CRH)_(MODE|CNF)(\d+)(?:_(\d))?$/);
      if (f) { const n = Number(f[3]) & 7, base = n * 4 + (f[2] === "CNF" ? 2 : 0); return ((f[4] === undefined ? 3 : 1 << Number(f[4])) << base) >>> 0; }
      f = name.match(/^GPIO_BRR_BR(\d+)$/); if (f) return 1 << Number(f[1]);
      const fl1: Record<string, number> = { FLASH_TYPEERASE_PAGES: 0, FLASH_TYPEERASE_MASSERASE: 2, FLASH_PAGE_SIZE: 1024, FLASH_CR_PG: 1, FLASH_CR_PER: 2, FLASH_CR_MER: 4, FLASH_CR_STRT: 0x40, FLASH_CR_LOCK: 0x80, FLASH_SR_BSY: 1, FLASH_SR_PGERR: 4, FLASH_SR_WRPRTERR: 0x10, FLASH_SR_EOP: 0x20, FLASH_BANK_1: 1 };
      if (fl1[name] !== undefined) return fl1[name];
    }
    if (this.family === "stm32") {
      const fl: Record<string, number> = { FLASH_BASE: 0x08000000, FLASH_KEY1: 0x45670123, FLASH_KEY2: 0xcdef89ab, FLASH_TYPEPROGRAM_BYTE: 0, FLASH_TYPEPROGRAM_HALFWORD: 1, FLASH_TYPEPROGRAM_WORD: 2, FLASH_TYPEPROGRAM_DOUBLEWORD: 3, FLASH_TYPEERASE_SECTORS: 0, FLASH_TYPEERASE_MASSERASE: 1, FLASH_CR_PG: 1, FLASH_CR_SER: 2, FLASH_CR_MER: 4, FLASH_CR_STRT: 0x10000, FLASH_CR_LOCK: 0x80000000, FLASH_CR_PSIZE_0: 0x100, FLASH_CR_PSIZE_1: 0x200, FLASH_SR_EOP: 1, FLASH_SR_BSY: 0x10000, FLASH_SR_PGSERR: 0x80, FLASH_SR_WRPERR: 0x10, FLASH_VOLTAGE_RANGE_3: 2, VOLTAGE_RANGE_3: 2, HAL_OK: 0, HAL_ERROR: 1 };
      if (fl[name] !== undefined) return fl[name];
      const sec = name.match(/^FLASH_SECTOR_(\d)$/); if (sec) return Number(sec[1]);
      if (name === "SystemCoreClock") return this.clock;
    }
    if (HAL_CONST[name] !== undefined) return HAL_CONST[name];
    if (SERIAL_CONST[name] !== undefined) return SERIAL_CONST[name];
    let m = name.match(/^GPIO_PIN_(\d+)$/); if (m) return 1 << Number(m[1]);
    m = name.match(/^ADC_CHANNEL_(\d+)$/); if (m) return Number(m[1]);
    m = name.match(/^RCC_AHB1ENR_GPIO([A-K])EN$/); if (m) return 1 << (m[1]!.charCodeAt(0) - 65);
    m = name.match(/^GPIO_(?:ODR_ODR?_?|ODR_OD|IDR_IDR?_?|IDR_ID|BSRR_BS_?)(\d+)$/); if (m) return 1 << Number(m[1]);
    m = name.match(/^GPIO_BSRR_BR_?(\d+)$/); if (m) return (1 << (Number(m[1]) + 16)) >>> 0;
    m = name.match(/^GPIO_(MODER|PUPDR|OSPEEDR)_(?:MODER|MODE|PUPDR?|PUPD|OSPEEDR?|OSPEED)(\d+)(?:_(\d))?$/); if (m) return ((m[3] === undefined ? 3 : 1 << Number(m[3])) << (Number(m[2]) * 2)) >>> 0;
    m = name.match(/^GPIO_OTYPER_OT_?(\d+)$/); if (m) return 1 << Number(m[1]);
    m = name.match(/^EXTI_(IMR|EMR|RTSR|FTSR|PR|SWIER)_(?:MR|IM|TR|RT|FT|PR|PIF|SWIER|SWI)?(\d+)$/); if (m) return 1 << Number(m[2]);
    m = name.match(/^SYSCFG_EXTICR\d_EXTI(\d+)_P([A-K])$/); if (m) return ((m[2]!.charCodeAt(0) - 65) << ((Number(m[1]) & 3) * 4)) >>> 0;
    if (this.family === "avr") {
      if (AVR_BITS[name] !== undefined) return AVR_BITS[name];
      m = name.match(/^(?:P|DD|PIN|PORT)[B-D](\d)$/); if (m) return Number(m[1]);
    }
    if (this.family === "esp32") { const esp: Record<string, number> = { A0: 36, A3: 39, A6: 34, A7: 35, A4: 32, A5: 33, LED_BUILTIN: 2, T0: 4 }; if (esp[name] !== undefined) return esp[name]; }
    if (this.family === "pic") { m = name.match(/^_XTAL_FREQ$/); if (m) return this.clock; }
    if (this.family === "msp430") {
      m = name.match(/^BIT([0-7])$/); if (m) return 1 << Number(m[1]);
      const msp: Record<string, number> = { WDTPW: 0x5a00, WDTHOLD: 0x80, WDTCNTCL: 0x08, WDTSSEL: 0x04, WDTIS0: 1, WDTIS1: 2, GIE: 0x08, LPM0_bits: 0x10, LPM3_bits: 0xd0, LPM4_bits: 0xf0 };
      if (msp[name] !== undefined) return msp[name];
      if (MSP_CAL[name]) return MSP_CAL[name][0];
      m = name.match(/^CALDCO_(\d+)MHZ$/); if (m) return 0x40 + Number(m[1]);
    }
    return undefined;
  }

  print(text: string) { this.txBytes([...text].map((c) => c.charCodeAt(0))); }

  /* ---------------- HAL / Arduino / ESP-IDF calls ---------------- */
  call(name: string, args: Val[], fw: Firmware, thread: Thread): Val | Wait | Block | undefined {
    const custom = this.onCall?.(name, args, this, thread);
    if (custom !== undefined) return custom;
    const n = (k: number) => toNum(args[k] ?? 0);
    const port = (k: number) => { const a = args[k]; const s = typeof a === "string" ? a : a && typeof a === "object" && a.kind === "ref" ? a.name : ""; return s.replace(/^GPIO/, ""); };
    const pinsOf = (mask: number) => bitsOf(mask).flatMap((b, i) => (b && i < 16 ? [i] : []));
    if (this.family === "msp430") {
      if (name === "__delay_cycles") return new Wait(n(0) / this.clock);
      if (/^(__bis_SR_register|_BIS_SR|__enable_interrupt|__no_operation)$/.test(name)) { if (name !== "__no_operation" && (name === "__enable_interrupt" || (n(0) & 0x08)) && this.fw) this.fw.globalIrqEnabled = true; return 0; }
    }
    switch (name) {
      case "HAL_GPIO_WritePin": for (const i of pinsOf(n(1))) this.halWrite(port(0), i, n(2) ? 1 : 0); return 0;
      case "HAL_GPIO_TogglePin": for (const i of pinsOf(n(1))) { const odr = this.r(`GPIO${port(0)}.ODR`); this.halWrite(port(0), i, ((odr >> i) & 1) ^ 1); } return 0;
      case "HAL_GPIO_ReadPin": { const i = pinsOf(n(1))[0] ?? 0; return this.level(this.pinKey(port(0), i)); }
      case "HAL_GPIO_Init": { const init = refName(args[1]); this.halGpioInit(port(0), fw.field(`${init}.Pin`) ?? 0, fw.field(`${init}.Mode`) ?? 0, fw.field(`${init}.Pull`) ?? 0, fw.field(`${init}.Alternate`) ?? 0); return 0; }
      case "HAL_GPIO_DeInit": for (const i of pinsOf(n(1))) this.halGpioInit(port(0), 1 << i, 0, 0, 0); return 0;
      case "NVIC_SetPendingIRQ": case "HAL_NVIC_SetPendingIRQ": { const irq = String(args[0] ?? "").replace(/_IRQn$/, ""); const num = IRQ_NUM[irq]; if (num !== undefined) this.write(`NVIC.ISPR${num >> 5}`, 1 << (num & 31)); return 0; }
      case "HAL_GPIO_EXTI_IRQHandler": { const mask = n(0); this.setR("EXTI.PR", this.r("EXTI.PR") & ~mask); if (fw.hasFunction("HAL_GPIO_EXTI_Callback")) this.fwRaise("HAL_GPIO_EXTI_Callback", (thread.prio > 900 ? 1000 - thread.prio : 0) - 0.5, [mask]); return 0; }
      case "HAL_TIM_IRQHandler": { const tim = timName(args[0]); const sr = this.r(`${tim}.SR`); this.setR(`${tim}.SR`, 0); const h = this.handle(refName(args[0]) || `htim${tim.slice(3)}`); const pr = (thread.prio > 900 ? 1000 - thread.prio : 0) - 0.5; if (sr & 1 && fw.hasFunction("HAL_TIM_PeriodElapsedCallback")) this.fwRaise("HAL_TIM_PeriodElapsedCallback", pr, [h]); if (sr & 0x1e) { const run = this.timerRun(tim); const cb = run.ic.some(Boolean) ? "HAL_TIM_IC_CaptureCallback" : "HAL_TIM_OC_DelayElapsedCallback"; if (fw.hasFunction(cb)) this.fwRaise(cb, pr, [h]); } return 0; }
      case "MX_GPIO_Init": if (this.cube.gpio) for (const g of this.cube.gpio) this.applyCubePin(g); return 0;
      case "SystemClock_Config": return 0;
    }
    if (/^__HAL_RCC_(\w+?)_CLK_ENABLE$/.test(name)) { const per = name.match(/^__HAL_RCC_(\w+?)_CLK_ENABLE$/)![1]!; this.rccEnable(per, true); return 0; }
    if (/^__HAL_RCC_(\w+?)_CLK_DISABLE$/.test(name)) { const per = name.match(/^__HAL_RCC_(\w+?)_CLK_DISABLE$/)![1]!; this.rccEnable(per, false); return 0; }
    const mx = name.match(/^MX_(TIM\d+)_Init$/);
    if (mx) { const cfg = this.cube.timers?.[mx[1]!]; if (cfg) { this.setR(`${mx[1]}.PSC`, cfg.psc); this.setR(`${mx[1]}.ARR`, cfg.arr); cfg.ccr?.forEach((c, k) => this.setR(`${mx[1]}.CCR${k + 1}`, c)); this.setR(`${mx[1]}.CCMR1`, 0x6060); this.setR(`${mx[1]}.CCMR2`, 0x6060); } return 0; }
    if (/^MX_USART\d_UART_Init$/.test(name)) { this.uart.baud = this.cube.uartBaud ?? this.uart.baud; return 0; }
    const timCall = this.timerCall(name, args, fw);
    if (timCall !== undefined) return timCall;
    const periph = this.peripheralCall(name, args, fw, thread);
    if (periph !== undefined) return periph;
    return this.arduinoCall(name, args, fw);
  }

  private applyCubePin(g: NonNullable<CubeConfig["gpio"]>[number]) {
    const p = this.pin(g.pin);
    const m = g.pin.match(/^P([A-E])(\d+)$/);
    const isIt = g.mode.startsWith("it_");
    const mode: PinMode = isIt ? "in" : (g.mode as PinMode);
    if (m && this.family === "stm32") {
      const per = `GPIO${m[1]}`, n = Number(m[2]);
      if (this.part === "F103") {
        const cr = n < 8 ? `${per}.CRL` : `${per}.CRH`, sh = (n & 7) * 4;
        const nib = mode === "out" ? (g.od ? 0x6 : 0x2) : mode === "af" ? (g.od ? 0xe : 0xa) : mode === "an" ? 0x0 : g.pull && g.pull !== "none" ? 0x8 : 0x4;
        this.regs.set(cr, ((this.r(cr) & ~(0xf << sh)) | (nib << sh)) >>> 0);
        if (g.pull === "up") this.regs.set(`${per}.ODR`, this.r(`${per}.ODR`) | (1 << n)); else if (g.pull === "down") this.regs.set(`${per}.ODR`, this.r(`${per}.ODR`) & ~(1 << n));
        this.rccEnable(per, true);
        this.applyGpioRegs(m[1]!);
        if (isIt) this.configureExti(g.pin, g.mode === "it_rising" ? "rising" : g.mode === "it_falling" ? "falling" : "both");
        return;
      }
      this.regs.set(`${per}.MODER`, ((this.r(`${per}.MODER`) & ~(3 << (n * 2))) | (["in", "out", "af", "an"].indexOf(mode) << (n * 2))) >>> 0);
      this.regs.set(`${per}.PUPDR`, ((this.r(`${per}.PUPDR`) & ~(3 << (n * 2))) | ((g.pull === "up" ? 1 : g.pull === "down" ? 2 : 0) << (n * 2))) >>> 0);
      if (g.od) this.regs.set(`${per}.OTYPER`, this.r(`${per}.OTYPER`) | (1 << n));
      if (g.af !== undefined) { const r = n < 8 ? `${per}.AFRL` : `${per}.AFRH`; const sh = (n % 8) * 4; this.regs.set(r, ((this.r(r) & ~(0xf << sh)) | (g.af << sh)) >>> 0); }
      this.rccEnable(per, true);
      this.applyGpioRegs(m[1]!);
      if (isIt) this.configureExti(g.pin, g.mode === "it_rising" ? "rising" : g.mode === "it_falling" ? "falling" : "both");
    } else { p.mode = mode; p.pull = g.pull ?? "none"; this.refreshPin(p); }
  }
  private rccEnable(per: string, on: boolean) {
    const g = this.clockGate(per);
    if (g) this.regs.set(g.reg, on ? (this.r(g.reg) | (1 << g.bit)) >>> 0 : (this.r(g.reg) & ~(1 << g.bit)) >>> 0);
  }
  private halWrite(port: string, i: number, v: number) {
    const per = `GPIO${port}`;
    if (!this.clockOn(per)) { this.log("fault", `HAL_GPIO_WritePin(${per}) ignored: clock disabled`); return; }
    this.setR(`${per}.ODR`, v ? this.r(`${per}.ODR`) | (1 << i) : this.r(`${per}.ODR`) & ~(1 << i));
    this.applyGpioRegs(port);
  }
  private halGpioInit(port: string, mask: number, mode: number, pull: number, af: number) {
    for (let i = 0; i < 16; i++) {
      if (!((mask >> i) & 1)) continue;
      const it = mode >= 0x10000000;
      const kind: PinMode = it || mode === 0 ? "in" : mode === 1 || mode === 0x11 ? "out" : mode === 3 ? "an" : "af";
      this.applyCubePin({ pin: this.pinKey(port, i), mode: it ? (mode === 0x10110000 ? "it_rising" : mode === 0x10210000 ? "it_falling" : "it_both") : kind, pull: pull === 1 ? "up" : pull === 2 ? "down" : "none", af: kind === "af" ? af : undefined, od: mode === 0x11 || mode === 0x12 });
    }
  }

  private timerCall(name: string, args: Val[], fw: Firmware): Val | undefined {
    if (!/TIM/.test(name)) return undefined;
    const tim = timName(args[0]);
    const ch = Math.floor(toNum(args[1] ?? 0) / 4) + 1;
    const run = () => this.timerRun(tim);
    const enable = (on: boolean) => { this.setR(`${tim}.CR1`, on ? this.r(`${tim}.CR1`) | 1 : this.r(`${tim}.CR1`) & ~1); this.rccEnable(tim, true); };
    const ccer = (on: boolean, c = ch) => { this.setR(`${tim}.CCER`, on ? this.r(`${tim}.CCER`) | (1 << ((c - 1) * 4)) : this.r(`${tim}.CCER`) & ~(1 << ((c - 1) * 4))); };
    switch (name) {
      case "HAL_TIM_Base_Start": enable(true); return 0;
      case "HAL_TIM_Base_Start_IT": run().it = true; enable(true); return 0;
      case "HAL_TIM_Base_Stop": case "HAL_TIM_Base_Stop_IT": run().it = false; enable(false); return 0;
      case "HAL_TIM_PWM_Start": case "HAL_TIM_OC_Start": case "HAL_TIM_PWM_Start_IT": case "HAL_TIM_OC_Start_IT": {
        const ccmr = ch <= 2 ? `${tim}.CCMR1` : `${tim}.CCMR2`, sh = ch % 2 === 1 ? 4 : 12;
        if (((this.r(ccmr) >> sh) & 7) === 0) this.setR(ccmr, this.r(ccmr) | ((name.includes("OC") ? 3 : 6) << sh));
        if (name.endsWith("_IT")) run().ocIt = true;
        ccer(true); enable(true); this.refreshAfPins(); return 0;
      }
      case "HAL_TIM_PWM_Stop": case "HAL_TIM_OC_Stop": ccer(false); this.refreshAfPins(); return 0;
      case "HAL_TIM_IC_Start": case "HAL_TIM_IC_Start_IT": run().ic[ch - 1] = true; if (name.endsWith("_IT")) run().icIt = true; ccer(true); enable(true); return 0;
      case "HAL_TIM_ReadCapturedValue": return this.r(`${tim}.CCR${ch}`);
      case "__HAL_TIM_SET_COMPARE": this.setR(`${tim}.CCR${ch}`, toNum(args[2] ?? 0)); this.refreshAfPins(); return 0;
      case "__HAL_TIM_GET_COMPARE": return this.r(`${tim}.CCR${ch}`);
      case "__HAL_TIM_SET_AUTORELOAD": this.setR(`${tim}.ARR`, toNum(args[1] ?? 0)); this.refreshAfPins(); return 0;
      case "__HAL_TIM_GET_AUTORELOAD": return this.r(`${tim}.ARR`);
      case "__HAL_TIM_SET_PRESCALER": this.setR(`${tim}.PSC`, toNum(args[1] ?? 0)); this.refreshAfPins(); return 0;
      case "__HAL_TIM_SET_COUNTER": run().cnt = toNum(args[1] ?? 0); return 0;
      case "__HAL_TIM_GET_COUNTER": return Math.max(0, Math.floor(run().cnt));
      case "__HAL_TIM_CLEAR_FLAG": case "__HAL_TIM_CLEAR_IT": this.setR(`${tim}.SR`, this.r(`${tim}.SR`) & ~toNum(args[1] ?? 0)); return 0;
      case "__HAL_TIM_GET_FLAG": return Number((this.r(`${tim}.SR`) & toNum(args[1] ?? 0)) !== 0);
      case "__HAL_TIM_ENABLE": enable(true); return 0;
      case "__HAL_TIM_DISABLE": enable(false); return 0;
      case "HAL_TIM_PWM_ConfigChannel": case "HAL_TIM_OC_ConfigChannel": {
        const oc = refName(args[1]), c = Math.floor(toNum(args[2] ?? 0) / 4) + 1;
        const mode = fw.field(`${oc}.OCMode`), pulse = fw.field(`${oc}.Pulse`), pol = fw.field(`${oc}.OCPolarity`);
        const ccmr = c <= 2 ? `${tim}.CCMR1` : `${tim}.CCMR2`, sh = c % 2 === 1 ? 0 : 8;
        if (mode !== undefined) this.setR(ccmr, ((this.r(ccmr) & ~(0xff << sh)) | ((mode & 0x70) << sh)) >>> 0);
        if (pulse !== undefined) this.setR(`${tim}.CCR${c}`, pulse);
        if (pol !== undefined) { const bit = 1 << ((c - 1) * 4 + 1); this.setR(`${tim}.CCER`, pol & 2 ? this.r(`${tim}.CCER`) | bit : this.r(`${tim}.CCER`) & ~bit); }
        this.refreshAfPins();
        return 0;
      }
      case "HAL_TIM_PWM_Init": case "HAL_TIM_Base_Init": case "HAL_TIM_IC_Init": case "HAL_TIM_OC_Init": {
        const h = refName(args[0]);
        const psc = fw.field(`${h}.Init.Prescaler`), per = fw.field(`${h}.Init.Period`);
        if (psc !== undefined) this.setR(`${tim}.PSC`, psc);
        if (per !== undefined) this.setR(`${tim}.ARR`, per);
        return 0;
      }
    }
    return undefined;
  }

  private peripheralCall(name: string, args: Val[], fw: Firmware, thread: Thread): Val | Wait | Block | undefined {
    const n = (k: number) => toNum(args[k] ?? 0);
    const hname = refName(args[0]);
    switch (name) {
      /* ADC */
      case "HAL_ADC_Start": this.setR("ADC1.CR2", this.r("ADC1.CR2") | 1); this.adcConvert(this.adcChannel(fw)); return 0;
      case "HAL_ADC_Init": {
        const res = fw.field(`${hname || "hadc1"}.Init.Resolution`);
        if (res !== undefined) { this.adcBits = 12 - 2 * ((res >>> 24) & 3); this.setR("ADC1.CR1", ((this.r("ADC1.CR1") & ~0x3000000) | (res & 0x3000000)) >>> 0); }
        return 0;
      }
      case "HAL_ADC_PollForConversion": return new Wait(([3, 15, 28, 56, 84, 112, 144, 480][this.r("ADC1.SMPR2") & 7]! + this.adcBits) / (this.clock / 4));
      case "HAL_ADC_GetValue": { const code = this.adcCode(this.adcChannel(fw)); this.setR("ADC1.DR", code); return code; }
      case "HAL_ADC_Stop": return 0;
      case "HAL_ADC_ConfigChannel": {
        const cfg = refName(args[1]);
        const c = fw.field(`${cfg}.Channel`), smp = fw.field(`${cfg}.SamplingTime`);
        if (c !== undefined) this.setR("ADC1.SQR3", c);
        if (smp !== undefined) this.setR("ADC1.SMPR2", smp & 7);
        return 0;
      }
      case "HAL_ADC_Start_IT": { const ch = this.adcChannel(fw); this.schedule(this.now + 20e-6, () => { this.adcConvert(ch); this.deliver("ADC", "ADC_IRQHandler", [], undefined, "HAL_ADC_ConvCpltCallback", [this.handle(hname || "hadc1")]); }); return 0; }
      case "HAL_ADC_Start_DMA": { const buf = args[1] ?? 0; const len = n(2); this.adcDma = { buf, len, ch: this.adcChannel(fw), idx: 0 }; this.scheduleAdcDma(); return 0; }
      case "HAL_ADC_Stop_DMA": this.adcDma = null; return 0;
      /* DAC */
      case "HAL_DAC_Start": this.dacEnabled[n(1) ? 1 : 0] = true; return 0;
      case "HAL_DAC_Stop": this.dacEnabled[n(1) ? 1 : 0] = false; return 0;
      case "HAL_DAC_SetValue": { const ch = n(1) ? 1 : 0; const align = n(2); const v = n(3); this.dacWrite(ch, align === 8 ? (v & 0xff) << 4 : align === 4 ? (v >> 4) & 0xfff : v & 0xfff); return 0; }
      case "HAL_DAC_GetValue": return this.dac[n(1) ? 1 : 0] ?? 0;
      /* UART */
      case "HAL_UART_Transmit": { const bytes = readBytes(args[1], n(2)); const d = this.txBytes(bytes); return new Wait(d); }
      case "HAL_UART_Transmit_IT": case "HAL_UART_Transmit_DMA": { const bytes = readBytes(args[1], n(2)); const d = this.txBytes(bytes); this.schedule(this.now + d, () => this.deliver("USART2", "", [], undefined, "HAL_UART_TxCpltCallback", [this.handle(hname || "huart2")])); return 0; }
      case "HAL_UART_Receive": { const buf = args[1], len = n(2), to = n(3); return new Block(() => this.uart.rx.length >= len, to >= 0xffffffff ? Infinity : to / 1000, (timedOut) => { if (timedOut) return 3; writeBytes(buf, this.uart.rx.splice(0, len)); return 0; }, "UART RX"); }
      case "HAL_UART_Receive_IT": case "HAL_UART_Receive_DMA": this.uartRxIt = { buf: args[1] ?? 0, len: Math.max(1, n(2)), handle: hname || "huart2" }; return 0;
      case "__HAL_UART_ENABLE_IT": this.setR("USART2.CR1", this.r("USART2.CR1") | 0x20); return 0;
      /* I2C */
      case "HAL_I2C_IsDeviceReady": { const ok = this.i2c.has(n(1) >> 1); this.logBus("i2c", n(1) >> 1, [], [], ok); return this.waitThen(9 / this.i2cHz, ok ? 0 : 1); }
      case "HAL_I2C_Master_Transmit": { const addr = n(1) >> 1; const bytes = readBytes(args[2], n(3)); const dev = this.i2c.get(addr); dev?.write(bytes); this.logBus("i2c", addr, bytes, [], Boolean(dev)); return this.waitThen((bytes.length + 1) * 9 / this.i2cHz, dev ? 0 : 1); }
      case "HAL_I2C_Master_Receive": { const addr = n(1) >> 1; const dev = this.i2c.get(addr); const data = dev ? dev.read(undefined, n(3)) : []; writeBytes(args[2], data); this.logBus("i2c", addr, [], data, Boolean(dev)); return this.waitThen((n(3) + 1) * 9 / this.i2cHz, dev ? 0 : 1); }
      case "HAL_I2C_Mem_Write": { const addr = n(1) >> 1; const bytes = readBytes(args[4], n(5)); const dev = this.i2c.get(addr); dev?.write([n(2), ...bytes]); this.logBus("i2c", addr, [n(2), ...bytes], [], Boolean(dev)); return this.waitThen((bytes.length + 2) * 9 / this.i2cHz, dev ? 0 : 1); }
      case "HAL_I2C_Mem_Read": { const addr = n(1) >> 1; const dev = this.i2c.get(addr); const data = dev ? dev.read(n(2), n(5)) : []; writeBytes(args[4], data); this.logBus("i2c", addr, [n(2)], data, Boolean(dev)); return this.waitThen((n(5) + 3) * 9 / this.i2cHz, dev ? 0 : 1); }
      /* SPI */
      case "HAL_SPI_Transmit": { const bytes = readBytes(args[1], n(2)); const rx = bytes.map((b) => this.spiDevice?.(b) ?? 0xff); this.logBus("spi", undefined, bytes, rx, true); return new Wait(bytes.length * 8 / this.spiHz); }
      case "HAL_SPI_Receive": { const len = n(2); const rx = Array.from({ length: len }, () => this.spiDevice?.(0xff) ?? 0xff); writeBytes(args[1], rx); this.logBus("spi", undefined, new Array(len).fill(0xff), rx, true); return new Wait(len * 8 / this.spiHz); }
      case "HAL_SPI_TransmitReceive": { const bytes = readBytes(args[1], n(3)); const rx = bytes.map((b) => this.spiDevice?.(b) ?? 0xff); writeBytes(args[2], rx); this.logBus("spi", undefined, bytes, rx, true); return new Wait(bytes.length * 8 / this.spiHz); }
      /* IWDG / power / RTC */
      case "HAL_FLASH_Unlock": if (this.flashLocked) { this.flashUnlockKey(0x45670123); this.flashUnlockKey(0xcdef89ab); } return this.flashLocked ? 1 : 0;
      case "HAL_FLASH_Lock": if (!this.flashLocked) this.flashLock(); return 0;
      case "HAL_FLASH_GetError": return this.flashError;
      case "HAL_FLASH_Program": { const type = n(0); const bytes = type === 0 ? 1 : type === 1 ? 2 : type === 2 ? 4 : 8; const r = this.flashProgram(n(1) >>> 0, n(2), bytes); return this.waitThen(r.seconds, r.ok ? 0 : 1); }
      case "HAL_FLASHEx_Erase": {
        const init = refName(args[0]);
        const mass = (fw.field(`${init}.TypeErase`) ?? 0) === (this.part === "F103" ? 2 : 1);
        let secs = 0, ok = true;
        const before = this.flashOps.length;
        if (this.part === "F103") {
          const first = mass ? 0x08000000 : fw.field(`${init}.PageAddress`) ?? 0x08000000;
          const pages = mass ? this.flashSize / 1024 : Math.max(1, fw.field(`${init}.NbPages`) ?? 1);
          for (let i = 0; i < pages; i++) secs += this.flashEraseUnit(first + i * 1024);
        } else {
          const first = mass ? 0 : fw.field(`${init}.Sector`) ?? 0;
          const count = mass ? 8 : Math.max(1, fw.field(`${init}.NbSectors`) ?? 1);
          for (let s = first; s < first + count && s < 8; s++) { let base = 0x08000000; for (let i = 0; i < s; i++) base += (i < 4 ? 16 : i === 4 ? 64 : 128) * 1024; secs += this.flashEraseUnit(base); }
        }
        if (this.flashOps.slice(before).some((o) => o.kind === "error")) ok = false;
        return this.waitThen(secs, ok ? 0 : 1);
      }
      case "HAL_IWDG_Init": { this.wdt.prescaler = fw.field(`${hname}.Init.Prescaler`) ?? 3; this.wdt.reload = fw.field(`${hname}.Init.Reload`) ?? 0xfff; this.startWdt(); return 0; }
      case "HAL_IWDG_Refresh": case "wdt_reset": case "esp_task_wdt_reset": this.kickWdt(); return 0;
      case "wdt_enable": { this.wdt.timeout = [0.015, 0.03, 0.06, 0.12, 0.25, 0.5, 1, 2, 4, 8][n(0)] ?? 1; this.wdt.enabled = true; this.wdt.counter = this.wdt.timeout; this.log("info", `Watchdog enabled: ${this.wdt.timeout * 1000} ms`); return 0; }
      case "wdt_disable": this.wdt.enabled = false; return 0;
      case "HAL_PWR_EnterSLEEPMode": return this.enterSleep("sleep");
      case "HAL_PWR_EnterSTOPMode": return this.enterSleep("stop");
      case "HAL_PWR_EnterSTANDBYMode": case "esp_deep_sleep_start": return this.enterSleep("standby");
      case "sleep_mode": case "sleep_cpu": return this.enterSleep(this.r("SMCR_MODE") >= 2 ? "stop" : "sleep");
      case "set_sleep_mode": this.setR("SMCR_MODE", n(0)); return 0;
      case "sleep_enable": case "sleep_disable": return 0;
      case "HAL_RTC_GetTime": { const s = Math.floor((this.rtc.base + this.now) % 86400); const t = refName(args[1]); fw.setField(`${t}.Hours`, Math.floor(s / 3600)); fw.setField(`${t}.Minutes`, Math.floor(s / 60) % 60); fw.setField(`${t}.Seconds`, s % 60); return 0; }
      case "HAL_RTC_GetDate": { const d = refName(args[1]); const day = Math.floor((this.rtc.base + this.now) / 86400); fw.setField(`${d}.Date`, 1 + (day % 28)); fw.setField(`${d}.Month`, 10); fw.setField(`${d}.Year`, 26); fw.setField(`${d}.WeekDay`, 1 + ((4 + day) % 7)); return 0; }
      case "HAL_RTC_SetTime": { const t = refName(args[1]); const h = fw.field(`${t}.Hours`) ?? 0, m = fw.field(`${t}.Minutes`) ?? 0, s = fw.field(`${t}.Seconds`) ?? 0; this.rtc.base = h * 3600 + m * 60 + s - this.now; return 0; }
      case "HAL_RTC_SetAlarm_IT": case "HAL_RTC_SetAlarm": { const a = refName(args[1]); const h = fw.field(`${a}.AlarmTime.Hours`) ?? 0, m = fw.field(`${a}.AlarmTime.Minutes`) ?? 0, s = fw.field(`${a}.AlarmTime.Seconds`) ?? 0; this.rtc.alarm = h * 3600 + m * 60 + s; this.log("info", `RTC alarm set for ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`); return 0; }
      case "HAL_SYSTICK_Config": case "SysTick_Config": this.setR("SysTick.LOAD", n(0) - 1); this.setR("SysTick.CTRL", 7); return 0;
      case "HAL_NVIC_SystemReset": case "NVIC_SystemReset": case "esp_restart": this.schedule(this.now, () => this.hardReset("Software reset (NVIC_SystemReset)")); return new Block(() => false, Infinity, undefined, "reset");
    }
    void thread;
    return undefined;
  }
  private adcDma: { buf: Val; len: number; ch: number; idx: number } | null = null;
  private scheduleAdcDma() {
    const dma = this.adcDma;
    if (!dma) return;
    this.schedule(this.now + 1e-4, () => {
      if (this.adcDma !== dma) return;
      const a = dma.buf;
      if (typeof a === "object" && a.kind === "arr" && a.slot.data) { a.slot.data[a.off + dma.idx] = this.adcCode(dma.ch); }
      dma.idx = (dma.idx + 1) % Math.max(1, dma.len);
      if (dma.idx === 0) this.deliver("DMA2_Stream0", "DMA2_Stream0_IRQHandler", [], undefined, "HAL_ADC_ConvCpltCallback", [this.handle("hadc1")]);
      this.scheduleAdcDma();
    });
  }
  private adcChannel(fw: Firmware) { return fw.field("sConfig.Channel") ?? (this.r("ADC1.SQR3") & 0x1f || this.cube.adcChannel || 0); }
  private waitThen(seconds: number, result: number): Block { const until = this.now + seconds; return new Block(() => this.now >= until, seconds, () => result, "bus"); }
  private logBus(bus: "spi" | "i2c", addr: number | undefined, write: number[], read: number[], ack: boolean) {
    const dur = bus === "i2c" ? (write.length + read.length + 1) * 9 / this.i2cHz : (write.length || read.length) * 8 / this.spiHz;
    push(this.bus, { t: this.now, bus, addr, write, read, ack, dur }, 400);
    this.log("bus", `${bus.toUpperCase()} ${addr !== undefined ? `0x${addr.toString(16).padStart(2, "0")} ` : ""}${write.length ? `W[${write.map(hex2).join(" ")}] ` : ""}${read.length ? `R[${read.map(hex2).join(" ")}] ` : ""}${ack ? "" : "NACK"}`);
  }
  private enterSleep(mode: "sleep" | "stop" | "standby"): Block {
    this.sleep = mode;
    this.log("power", `Entering ${mode.toUpperCase()} mode`);
    if (mode === "standby") return new Block(() => false, Infinity, undefined, "sleep");
    return new Block(() => this.sleep === "run", Infinity, undefined, "WFI");
  }

  /** Arduino Servo library semantics: write() values below 544 are degrees mapped onto [min, max], larger values are µs. */
  private servoCall(method: string, args: Val[]): Val {
    const ref = args[0];
    const obj = ref && typeof ref === "object" && ref.kind === "ref" ? ref.name : "servo";
    const n = (k: number) => toNum(args[k] ?? 0);
    const s = this.servos.get(obj);
    const drive = (sv: { pin: string; us: number }) => {
      const p = this.pin(sv.pin);
      this.softPwm.set(sv.pin, { freq: 50, duty: sv.us / 20000, source: `Servo ${obj}`, phase: 0 });
      p.mode = "af"; this.refreshPin(p);
    };
    const writeUs = (sv: { pin: string; min: number; max: number; us: number }, us: number) => { sv.us = Math.max(sv.min, Math.min(sv.max, Math.trunc(us))); drive(sv); };
    switch (method) {
      case "attach": {
        const sv = { pin: this.arduinoPin(args[1]), min: args[2] !== undefined ? n(2) : 544, max: args[3] !== undefined ? n(3) : 2400, us: s?.us ?? 1500 };
        this.servos.set(obj, sv); drive(sv); return 1;
      }
      case "write": {
        if (!s) return 0;
        let v = n(1);
        if (v < 544) { v = Math.max(0, Math.min(180, v)); v = Math.trunc((v * (s.max - s.min)) / 180 + s.min); }
        writeUs(s, v); return 0;
      }
      case "writeMicroseconds": if (s) writeUs(s, n(1)); return 0;
      case "read": return s ? Math.trunc(((s.us + 1 - s.min) * 180) / (s.max - s.min)) : 0;
      case "readMicroseconds": return s?.us ?? 0;
      case "attached": return s ? 1 : 0;
      case "detach": {
        if (!s) return 0;
        this.softPwm.delete(s.pin); const p = this.pin(s.pin); p.mode = "out"; p.out = 0; this.refreshPin(p);
        this.servos.delete(obj); return 0;
      }
    }
    return 0;
  }

  private arduinoCall(name: string, args: Val[], fw: Firmware): Val | Wait | Block | undefined {
    const n = (k: number) => toNum(args[k] ?? 0);
    switch (name) {
      case "pinMode": { const p = this.pin(this.arduinoPin(args[0])); const m = n(1); p.mode = m === 1 ? "out" : "in"; p.pull = m === 2 ? "up" : m === 3 ? "down" : "none"; this.softPwm.delete(p.key); this.refreshPin(p); this.mirrorPortRegs(p.key); return 0; }
      case "digitalWrite": { const p = this.pin(this.arduinoPin(args[0])); this.softPwm.delete(p.key); if (p.mode === "af") p.mode = "out"; if (p.mode === "in") p.pull = n(1) ? "up" : "none"; p.out = n(1) ? 1 : 0; this.refreshPin(p); this.mirrorPortRegs(p.key); return 0; }
      case "digitalRead": return this.level(this.arduinoPin(args[0]));
      case "analogRead": { const key = this.arduinoPin(args[0]); const ch = this.family === "avr" && n(0) < 14 ? n(0) : this.adcChannelOf(key); return this.adcCode(ch, this.family === "avr" ? 10 : this.adcBits); }
      case "analogReadResolution": this.adcBits = n(0); return 0;
      case "analogWrite": {
        const key = this.arduinoPin(args[0]); const p = this.pin(key); const v = Math.max(0, Math.min(255, n(1)));
        if (v === 0 || v === 255) { this.softPwm.delete(key); p.mode = "out"; p.out = v ? 1 : 0; }
        else { const ard = this.arduinoNumber(key); this.softPwm.set(key, { freq: this.family === "avr" ? (ard === 5 || ard === 6 ? 976.56 : 490.2) : 1000, duty: v / 255, source: `analogWrite(${ard})`, phase: 0 }); p.mode = "af"; }
        this.refreshPin(p); return 0;
      }
      case "tone": { const key = this.arduinoPin(args[0]); this.softPwm.set(key, { freq: n(1), duty: 0.5, source: `tone ${n(1)} Hz`, phase: 0 }); const p = this.pin(key); p.mode = "af"; this.refreshPin(p); if (args[2] !== undefined) this.schedule(this.now + n(2) / 1000, () => { this.softPwm.delete(key); p.mode = "out"; p.out = 0; this.refreshPin(p); }); return 0; }
      case "noTone": { const key = this.arduinoPin(args[0]); this.softPwm.delete(key); const p = this.pin(key); p.mode = "out"; p.out = 0; this.refreshPin(p); return 0; }
      case "Servo.attach": case "Servo.write": case "Servo.writeMicroseconds": case "Servo.read": case "Servo.readMicroseconds": case "Servo.attached": case "Servo.detach":
        return this.servoCall(name.slice(6), args);
      case "digitalPinToInterrupt": return n(0);
      case "attachInterrupt": { const fn = typeof args[1] === "string" ? args[1] : ""; this.arduinoIrq.set(this.arduinoPin(args[0]), { fn, mode: n(2) }); return 0; }
      case "detachInterrupt": this.arduinoIrq.delete(this.arduinoPin(args[0])); return 0;
      case "map": { const [x, a, b, c, d] = [n(0), n(1), n(2), n(3), n(4)]; return b === a ? c : Math.trunc((x - a) * (d - c) / (b - a) + c); }
      case "constrain": return Math.min(n(2), Math.max(n(1), n(0)));
      case "bitRead": return (n(0) >> n(1)) & 1;
      case "bitSet": { const r = args[0]; if (r && typeof r === "object" && r.kind === "ref") r.ref.set(toNum(r.ref.get()) | (1 << n(1))); return 0; }
      case "_BV": case "bit": return (1 << n(0)) >>> 0;
      case "lowByte": return n(0) & 0xff;
      case "highByte": return (n(0) >> 8) & 0xff;
      case "pulseIn": { const key = this.arduinoPin(args[0]); const want = n(1) ? 1 : 0; const start = this.now; const to = args[2] === undefined ? 1 : n(2) / 1e6; return new Block(() => { const e = this.edges.get(key) ?? []; const rise = e.find(([t, lv]) => t >= start && lv === want); return Boolean(rise && e.find(([t, lv]) => t > rise[0] && lv !== want)); }, to, (timedOut) => { if (timedOut) return 0; const e = this.edges.get(key) ?? []; const rise = e.find(([t, lv]) => t >= start && lv === want)!; const fall = e.find(([t, lv]) => t > rise[0] && lv !== want)!; return Math.round((fall[0] - rise[0]) * 1e6); }, "pulseIn"); }
      case "shiftOut": { const data = this.arduinoPin(args[0]), clk = this.arduinoPin(args[1]); const msb = n(2) === 1; const v = n(3); for (let k = 0; k < 8; k++) { const b = msb ? (v >> (7 - k)) & 1 : (v >> k) & 1; const dp = this.pin(data); dp.out = b; this.refreshPin(dp); const cp = this.pin(clk); cp.out = 1; this.refreshPin(cp); cp.out = 0; this.refreshPin(cp); } this.shiftLog.push(v); return 0; }
      case "Serial.begin": case "Serial1.begin": case "Serial2.begin": {
        this.uart.baud = n(0) || 9600;
        this.uart.frame = args.length > 1 ? serialFrame(n(1)) : { bits: 8, parity: 0, stop: 1 };
        const port = name.slice(0, name.indexOf("."));
        this.uart.port = port;
        if (this.family === "esp32") {
          const [drx, dtx] = port === "Serial2" ? [16, 17] : port === "Serial1" ? [9, 10] : [3, 1];
          const rx = args.length > 2 && n(2) >= 0 ? n(2) : drx, tx = args.length > 3 && n(3) >= 0 ? n(3) : dtx;
          this.uart.pins = { rx: `GPIO${rx}`, tx: `GPIO${tx}` };
        }
        return 0;
      }
      case "Serial1.available": case "Serial2.available": case "Serial1.read": case "Serial2.read": case "Serial1.peek": case "Serial2.peek":
      case "Serial1.readString": case "Serial2.readString": case "Serial1.readStringUntil": case "Serial2.readStringUntil": case "Serial1.parseInt": case "Serial2.parseInt":
        return this.arduinoCall(`Serial.${name.slice(name.indexOf(".") + 1)}`, args, fw);
      case "Serial.available": return this.uart.rx.length;
      case "Serial.read": return this.uart.rx.shift() ?? -1;
      case "Serial.peek": return this.uart.rx[0] ?? -1;
      /* Stream semantics: wait for the terminator, giving up once no byte has arrived for the timeout. */
      case "Serial.readString": case "Serial.readStringUntil": {
        const stop = name === "Serial.readString" ? -1 : n(0);
        const since = this.now;
        const quiet = () => this.now - Math.max(since, this.uart.lastRx) >= this.uart.timeout;
        const take = () => { const i = stop < 0 ? -1 : this.uart.rx.indexOf(stop); const bytes = this.uart.rx.splice(0, i < 0 ? this.uart.rx.length : i + 1); if (i >= 0) bytes.pop(); return String.fromCharCode(...bytes); };
        if (stop >= 0 && this.uart.rx.includes(stop)) return take();
        return new Block(() => (stop >= 0 && this.uart.rx.includes(stop)) || quiet(), Infinity, take, "Serial read");
      }
      case "Serial.setTimeout": case "Serial1.setTimeout": case "Serial2.setTimeout": this.uart.timeout = Math.max(0, n(0)) / 1000; return 0;
      case "Serial.parseInt": { const s = String.fromCharCode(...this.uart.rx); const m = s.match(/-?\d+/); if (!m) return 0; this.uart.rx.splice(0, (m.index ?? 0) + m[0].length); return Number(m[0]); }
      case "Wire.beginTransmission": this.wireTx = { addr: n(0), data: [] }; return 0;
      case "Wire.write": { if (this.wireTx) { const a = args[0]; if (typeof a === "string") this.wireTx.data.push(...[...a].map((c) => c.charCodeAt(0))); else this.wireTx.data.push(...(args.length > 1 ? readBytes(a, n(1)) : [n(0) & 0xff])); } return 1; }
      case "Wire.endTransmission": { const tx = this.wireTx; this.wireTx = null; if (!tx) return 4; const dev = this.i2c.get(tx.addr); if (dev && tx.data.length) dev.write(tx.data); this.lastReg = tx.data[0]; this.logBus("i2c", tx.addr, tx.data, [], Boolean(dev)); return this.waitThen((tx.data.length + 1) * 9 / this.i2cHz, dev ? 0 : 2); }
      case "Wire.requestFrom": { const dev = this.i2c.get(n(0)); this.wireRx = dev ? dev.read(this.lastReg, n(1)) : []; this.logBus("i2c", n(0), [], this.wireRx, Boolean(dev)); return this.waitThen((n(1) + 1) * 9 / this.i2cHz, this.wireRx.length); }
      case "Wire.available": return this.wireRx.length;
      case "Wire.read": return this.wireRx.shift() ?? -1;
      case "Wire.setClock": this.i2cHz = n(0); return 0;
      case "SPI.transfer": { const b = n(0) & 0xff; const r = this.spiDevice?.(b) ?? 0xff; this.logBus("spi", undefined, [b], [r], true); return r; }
      case "SPI.beginTransaction": case "SPI.endTransaction": case "SPI.setClockDivider": case "SPI.setDataMode": case "SPI.setBitOrder": return 0;
      case "SPISettings": this.spiHz = n(0) || this.spiHz; return 0;
      case "ledcSetup": this.ledc.set(n(0), { freq: n(1), res: n(2), duty: 0, pins: [] }); return n(1);
      case "ledcAttachPin": { const c = this.ledc.get(n(1)); if (c) c.pins.push(this.arduinoPin(args[0])); this.applyLedc(n(1)); return 0; }
      case "ledcAttach": { const key = this.arduinoPin(args[0]); this.ledc.set(n(0), { freq: n(1), res: n(2), duty: 0, pins: [key] }); this.applyLedc(n(0)); return 1; }
      case "ledcWrite": { const c = this.ledc.get(n(0)); if (c) { c.duty = n(1); this.applyLedc(n(0)); } return 1; }
      case "ledcWriteTone": { const c = this.ledc.get(n(0)); if (c) { c.freq = n(1); c.duty = n(1) ? 2 ** (c.res - 1) : 0; this.applyLedc(n(0)); } return n(1); }
      case "touchRead": return Math.round(this.analog[19] ?? 60);
      case "hallRead": return 0;
      case "esp_sleep_enable_timer_wakeup": { const us = n(0); this.schedule(this.now + us / 1e6, () => { if (this.sleep === "standby") this.hardReset("Deep-sleep timer wake-up"); }); return 0; }
    }
    void fw;
    return undefined;
  }
  shiftLog: number[] = [];
  private lastReg: number | undefined;
  private applyLedc(ch: number) {
    const c = this.ledc.get(ch);
    if (!c) return;
    for (const key of c.pins) {
      const p = this.pin(key);
      const duty = c.duty / (2 ** c.res - 1);
      if (duty <= 0 || duty >= 1 || !c.freq) { this.softPwm.delete(key); p.mode = "out"; p.out = duty >= 1 ? 1 : 0; }
      else { this.softPwm.set(key, { freq: c.freq, duty, source: `LEDC ch${ch}`, phase: 0 }); p.mode = "af"; }
      this.refreshPin(p);
    }
  }
  private mirrorPortRegs(key: string) {
    if (this.family !== "avr") return;
    const m = key.match(/^P([B-D])(\d)$/);
    if (!m) return;
    const L = m[1]!, n = Number(m[2]), p = this.pin(key);
    const set = (r: string, on: boolean) => this.regs.set(r, on ? this.r(r) | (1 << n) : this.r(r) & ~(1 << n));
    set(`DDR${L}`, p.mode === "out" || p.mode === "af"); set(`PORT${L}`, p.out === 1 || p.pull === "up");
  }
}

function refName(v: Val | undefined): string { return typeof v === "string" ? v : v && typeof v === "object" && v.kind === "ref" ? v.name : ""; }
function timName(v: Val | undefined): string { const s = refName(v); const m = s.match(/(\d+)/); return s.startsWith("TIM") ? s : m ? `TIM${m[1]}` : "TIM2"; }
const hex2 = (b: number) => b.toString(16).toUpperCase().padStart(2, "0");
export function readBytes(v: Val | undefined, len: number): number[] {
  if (typeof v === "string") return [...v.slice(0, len || v.length)].map((c) => c.charCodeAt(0));
  if (v && typeof v === "object" && v.kind === "arr") { const d = v.slot.data ?? []; const out: number[] = []; for (let k = 0; k < len && v.off + k < d.length; k++) out.push(toNum(d[v.off + k]) & 0xff); return out; }
  if (v && typeof v === "object" && v.kind === "ref") { const inner = v.ref.get(); if (typeof inner === "object" && inner.kind === "arr") return readBytes(inner, len); const x = toNum(inner); return Array.from({ length: Math.max(1, len) }, (_, k) => (x >>> (8 * k)) & 0xff); }
  return [toNum(v ?? 0) & 0xff];
}
export function writeBytes(v: Val | undefined, bytes: number[]) {
  if (v && typeof v === "object" && v.kind === "arr") { const d = v.slot.data ?? []; bytes.forEach((b, k) => { if (v.off + k < d.length) d[v.off + k] = b; }); return; }
  if (v && typeof v === "object" && v.kind === "ref") { const inner = v.ref.get(); if (typeof inner === "object" && inner.kind === "arr") { writeBytes(inner, bytes); return; } v.ref.set(bytes.reduce((acc, b, k) => acc | (b << (8 * k)), 0) >>> 0); }
}
