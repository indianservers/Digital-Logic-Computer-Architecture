import { describe, expect, it } from "vitest";
import { Mcu } from "./mcu";

function boot(src: string, opts: ConstructorParameters<typeof Mcu>[0] = {}) {
  const mcu = new Mcu(opts);
  const diags = mcu.load(src);
  expect(diags).toEqual([]);
  return mcu;
}

describe("MCU model", () => {
  it("blinks PA5 via HAL at the rate set by HAL_Delay", () => {
    const count = (ms: number) => {
      const mcu = boot(`int main(void){ HAL_Init(); MX_GPIO_Init(); while(1){ HAL_GPIO_TogglePin(GPIOA, GPIO_PIN_5); HAL_Delay(${ms}); } }`, { cube: { gpio: [{ pin: "PA5", mode: "out" }] } });
      mcu.tick(2);
      return mcu.edges.get("PA5")?.length ?? 0;
    };
    expect(count(500)).toBe(4);
    expect(count(100)).toBe(20);
  });

  it("drives pins from register writes and reads IDR", () => {
    const mcu = boot(`volatile int seen = 0;
      int main(void){
        RCC->AHB1ENR |= RCC_AHB1ENR_GPIOAEN;
        GPIOA->MODER &= ~(3U << (5*2)); GPIOA->MODER |= (1U << (5*2));
        GPIOA->PUPDR |= (1U << 0);
        GPIOA->BSRR = GPIO_BSRR_BS5;
        while(1){ seen = (GPIOA->IDR & 1); }
      }`, { strictClock: true });
    mcu.tick(0.01);
    expect(mcu.level("PA5")).toBe(1);
    expect(mcu.fw!.num("seen")).toBe(1);
    mcu.setInput("PA0", 0);
    mcu.tick(0.01);
    expect(mcu.fw!.num("seen")).toBe(0);
  });

  it("ignores GPIO writes when the port clock is off (strict mode)", () => {
    const mcu = boot(`int main(void){ GPIOA->MODER |= (1U << 10); GPIOA->ODR |= (1U << 5); while(1); }`, { strictClock: true });
    mcu.tick(0.01);
    expect(mcu.pin("PA5").mode).toBe("in");
    expect(mcu.peek("GPIOA.ODR") & (1 << 5)).toBe(0);
    expect(mcu.events.some((e) => e.kind === "fault" && e.text.includes("clock disabled"))).toBe(true);
  });

  it("derives PWM frequency and duty from PSC/ARR/CCR", () => {
    const mcu = boot(`#define PWM_DUTY 80
      int main(void){ MX_TIM1_Init(); HAL_TIM_PWM_Start(&htim1, TIM_CHANNEL_1);
        __HAL_TIM_SET_COMPARE(&htim1, TIM_CHANNEL_1, PWM_DUTY * 10); while(1){ HAL_Delay(10); } }`, { clock: 72e6, cube: { timers: { TIM1: { psc: 71, arr: 999 } } } });
    mcu.tick(0.02);
    const pw = mcu.pwmInfo("PA8")!;
    expect(pw.freq).toBeCloseTo(1000, 3);
    expect(pw.duty).toBeCloseTo(0.8, 3);
  });

  it("fires EXTI callbacks on button edges", () => {
    const mcu = boot(`volatile int presses = 0;
      void HAL_GPIO_EXTI_Callback(uint16_t pin){ if (pin == GPIO_PIN_13) presses++; }
      int main(void){ MX_GPIO_Init(); while(1){ } }`, { cube: { gpio: [{ pin: "PC13", mode: "it_falling", pull: "up" }] } });
    mcu.tick(0.005);
    for (let k = 0; k < 3; k++) { mcu.setInput("PC13", 0); mcu.tick(0.005); mcu.setInput("PC13", 1); mcu.tick(0.005); }
    expect(mcu.fw!.num("presses")).toBe(3);
  });

  it("re-enters an EXTI handler when the pending bit is not cleared", () => {
    const mcu = boot(`volatile int n = 0;
      void EXTI0_IRQHandler(void){ n++; }
      int main(void){ while(1){ } }`, { cube: { gpio: [{ pin: "PA0", mode: "it_rising" }] } });
    mcu.call("MX_GPIO_Init", [], mcu.fw!, mcu.fw!.threads[0]!);
    mcu.tick(0.001);
    mcu.setInput("PA0", 1);
    mcu.tick(0.002);
    expect(mcu.fw!.num("n")).toBeGreaterThan(5);
  });

  it("runs timer update interrupts at PSC/ARR rate", () => {
    const mcu = boot(`volatile int ticks = 0;
      void HAL_TIM_PeriodElapsedCallback(TIM_HandleTypeDef *htim){ if (htim->Instance == TIM2) ticks++; }
      int main(void){ MX_TIM2_Init(); HAL_TIM_Base_Start_IT(&htim2); while(1){} }`, { clock: 84e6, cube: { timers: { TIM2: { psc: 8399, arr: 99 } } } });
    mcu.tick(1);
    expect(mcu.fw!.num("ticks")).toBeGreaterThanOrEqual(99);
    expect(mcu.fw!.num("ticks")).toBeLessThanOrEqual(101);
  });

  it("converts analog voltages with the configured resolution", () => {
    const mcu = boot(`uint32_t raw = 0;
      int main(void){ while(1){ HAL_ADC_Start(&hadc1); HAL_ADC_PollForConversion(&hadc1, 10); raw = HAL_ADC_GetValue(&hadc1); HAL_Delay(5); } }`, { cube: { adcChannel: 0 } });
    mcu.setAnalog(0, 1.65);
    mcu.tick(0.02);
    expect(mcu.fw!.num("raw")).toBeGreaterThanOrEqual(2046);
    expect(mcu.fw!.num("raw")).toBeLessThanOrEqual(2049);
  });

  it("transmits UART bytes with baud-accurate timing", () => {
    const mcu = boot(`uint8_t msg[] = "Hi\\r\\n";
      int main(void){ MX_USART2_UART_Init(); HAL_UART_Transmit(&huart2, msg, 4, 100); while(1); }`, { cube: { uartBaud: 9600 } });
    mcu.tick(0.01);
    expect(mcu.uart.text).toBe("Hi\r\n");
    const log = mcu.uart.log.filter((b) => b.dir === "tx");
    expect(log[1]!.t - log[0]!.t).toBeCloseTo(10 / 9600, 6);
  });

  it("resets the MCU when the watchdog is not refreshed", () => {
    const mcu = boot(`int main(void){ IWDG->KR = 0x5555; IWDG->PR = 0; IWDG->RLR = 799; IWDG->KR = 0xCCCC; while(1){ } }`);
    mcu.tick(0.15);
    expect(mcu.resets).toBe(1);
    expect(mcu.resetCause).toContain("Watchdog");
  });

  it("supports Arduino API on an ATmega328P", () => {
    const mcu = boot(`int v = 0;
      void setup(){ pinMode(13, OUTPUT); Serial.begin(9600); }
      void loop(){ digitalWrite(13, HIGH); v = analogRead(A0); delay(100); digitalWrite(13, LOW); delay(100); }`, { family: "avr" });
    mcu.setAnalog(0, 2.5);
    mcu.tick(1);
    expect(mcu.edges.get("PB5")!.length).toBeGreaterThanOrEqual(9);
    expect(mcu.fw!.num("v")).toBeGreaterThanOrEqual(510);
    expect(mcu.fw!.num("v")).toBeLessThanOrEqual(513);
  });

  it("supports AVR register programming and timer ISR", () => {
    const mcu = boot(`volatile int ov = 0;
      ISR(TIMER1_COMPA_vect){ ov++; PORTB ^= (1 << PB5); }
      int main(void){ DDRB |= _BV(DDB5); TCCR1B = (1 << WGM12) | (1 << CS12); OCR1A = 6249; TIMSK1 = (1 << OCIE1A); sei(); while(1){} }`, { family: "avr" });
    mcu.tick(1);
    expect(mcu.fw!.num("ov")).toBeGreaterThanOrEqual(9);
    expect(mcu.fw!.num("ov")).toBeLessThanOrEqual(11);
  });

  it("supports 8051 sbit and timer interrupts", () => {
    const mcu = boot(`sbit LED = P1^0; volatile int n = 0;
      void t0_isr(void) interrupt 1 { TH0 = 0x4C; TL0 = 0x00; n++; LED = !LED; }
      void main(void){ TMOD = 0x01; TH0 = 0x4C; TL0 = 0x00; ET0 = 1; EA = 1; TR0 = 1; while(1); }`, { family: "8051", clock: 11.0592e6 });
    mcu.tick(1);
    expect(mcu.fw!.num("n")).toBeGreaterThanOrEqual(19);
    expect(mcu.fw!.num("n")).toBeLessThanOrEqual(21);
  });

  it("supports PIC TRIS/LAT and the RB0 interrupt", () => {
    const mcu = boot(`volatile int hits = 0;
      void __interrupt() isr(void){ if (INTCONbits.INTF) { hits++; INTCONbits.INTF = 0; } }
      void main(void){ TRISB = 0x01; TRISC = 0x00; OPTION_REGbits.INTEDG = 1; INTCONbits.INTE = 1; INTCONbits.GIE = 1; while(1){ LATC = hits; __delay_ms(1); } }`, { family: "pic" });
    mcu.setInput("RB0", 0);
    mcu.tick(0.01);
    mcu.setInput("RB0", 1); mcu.tick(0.01); mcu.setInput("RB0", 0); mcu.tick(0.01); mcu.setInput("RB0", 1); mcu.tick(0.01);
    expect(mcu.fw!.num("hits")).toBe(2);
    expect(mcu.level("RC1")).toBe(1);
  });

  it("models STM32F103 CRL/BSRR/BRR GPIO with APB2 clock gating", () => {
    const mcu = boot(`int main(void){
        RCC->APB2ENR |= RCC_APB2ENR_IOPAEN;
        GPIOA->CRL &= ~(0xF << 20); GPIOA->CRL |= (0x2 << 20);
        while(1){ GPIOA->BSRR = (1 << 5); for (volatile int i = 0; i < 50; i++); GPIOA->BRR = (1 << 5); for (volatile int i = 0; i < 50; i++); }
      }`, { part: "F103", strictClock: true });
    mcu.tick(0.01);
    expect(mcu.pin("PA5").mode).toBe("out");
    expect(mcu.edges.get("PA5")!.length).toBeGreaterThan(10);
    expect(mcu.addrOf("GPIOA.CRL")).toBe(0x40010800);
    expect(mcu.addrOf("RCC.APB2ENR")).toBe(0x40021018);
  });

  it("delivers every SysTick interrupt, including rates above 1 kHz", () => {
    const run = (load: number) => {
      const mcu = boot(`volatile uint32_t msTicks = 0;
        void SysTick_Handler(void){ msTicks++; }
        int main(void){ SysTick->LOAD = ${load} - 1; SysTick->VAL = 0; SysTick->CTRL = 7; uint32_t last = 0; while(1){ if (msTicks - last >= 500) { last = msTicks; } } }`, { part: "F103" });
      for (let i = 0; i < 2000; i++) mcu.tick(0.001);
      return mcu.fw!.num("msTicks");
    };
    expect(run(72000)).toBeGreaterThanOrEqual(1999);
    expect(run(72000)).toBeLessThanOrEqual(2000);
    expect(run(7200)).toBeGreaterThanOrEqual(19990);
  }, 20000);

  it("fires a 5 kHz TIM2 update interrupt at the exact rate", () => {
    const mcu = boot(`volatile int n = 0;
      void TIM2_IRQHandler(void){ TIM2->SR &= ~TIM_SR_UIF; n++; }
      int main(void){ RCC->APB1ENR |= RCC_APB1ENR_TIM2EN; TIM2->PSC = 83; TIM2->ARR = 199; TIM2->DIER |= TIM_DIER_UIE; TIM2->CR1 = TIM_CR1_CEN; NVIC_EnableIRQ(TIM2_IRQn); while(1){ __WFI(); } }`);
    mcu.tick(0.01);
    const start = mcu.fw!.num("n");
    mcu.tick(1);
    const n = mcu.fw!.num("n") - start;
    expect(n).toBeGreaterThanOrEqual(4999);
    expect(n).toBeLessThanOrEqual(5001);
  });

  it("runs MSP430 GPIO code and resets when the watchdog is not held", () => {
    const mcu = boot(`#include <msp430.h>
      int main(void){ WDTCTL = WDTPW | WDTHOLD; P1DIR |= BIT0; while(1){ P1OUT ^= BIT0; __delay_cycles(8000000); } }`, { family: "msp430" });
    mcu.tick(0.25);
    expect(mcu.level("P1.0")).toBe(1);
    mcu.tick(0.5);
    expect(mcu.level("P1.0")).toBe(0);
    expect(mcu.resets).toBe(0);
    const bad = boot(`int main(void){ P1DIR |= BIT6; while(1){ P1OUT ^= BIT6; } }`, { family: "msp430" });
    bad.tick(0.01);
    expect(bad.resets).toBeGreaterThan(0);
    expect(bad.resetCause).toContain("WDT+");
  });

  it("models F103 Flash unlock, page erase, halfword programming and persistence across reset", () => {
    const src = `#include "stm32f1xx_hal.h"
      #define PAGE 0x0801F800
      uint32_t stored = 0;
      uint32_t status = 0;
      int main(void) {
        FLASH_EraseInitTypeDef erase;
        uint32_t pageError;
        stored = *(volatile uint32_t *)PAGE;
        if (stored == 0xFFFFFFFF) {
          HAL_FLASH_Unlock();
          erase.TypeErase = FLASH_TYPEERASE_PAGES;
          erase.PageAddress = PAGE;
          erase.NbPages = 1;
          HAL_FLASHEx_Erase(&erase, &pageError);
          HAL_FLASH_Program(FLASH_TYPEPROGRAM_WORD, PAGE, 0xC0FFEE42);
          status = HAL_FLASH_Program(FLASH_TYPEPROGRAM_HALFWORD, PAGE, 0x1234);
          HAL_FLASH_Lock();
          NVIC_SystemReset();
        }
        while (1) {}
      }`;
    const mcu = boot(src, { part: "F103" });
    mcu.tick(0.2);
    expect(mcu.readMem(0x0801f800, 4)).toBe(0xc0ffee42);
    expect(mcu.resets).toBe(1);
    expect(mcu.fw!.num("stored")).toBe(0xc0ffee42);
    expect(mcu.flashWear.get(0x0801f800)).toBe(1);
    expect(mcu.flashOps.some((o) => o.kind === "error" && o.text.includes("not erased"))).toBe(true);
    expect(mcu.flashLocked).toBe(true);
  });

  it("raises a HardFault on writes to unmapped memory", () => {
    const mcu = boot(`int main(void){ *(volatile uint32_t*)0x50000000 = 1; while(1); }`);
    mcu.tick(0.01);
    expect(mcu.fw!.error?.message).toContain("HardFault");
  });
});
