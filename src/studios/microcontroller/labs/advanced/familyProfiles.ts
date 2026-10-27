import { Mcu, type Family, type McuOptions } from "../core/mcu";

export interface FamilyProfile {
  number: number; family: Family; chip: string; subtitle: string; clock: number; voltage: number;
  output: string; input: string; inputActiveHigh?: boolean; analog?: string; pwm?: string;
  code: string; options?: McuOptions; registers: string[]; observe: string; limitation: string;
}
export const FAMILY_PROFILES: FamilyProfile[] = [
  {
    number: 55, family: "avr", chip: "ATmega328P · Arduino API", subtitle: "Edit Arduino C, sample A0, and drive a simulated PWM output.", clock: 16e6, voltage: 5, output: "PB5", input: "PD2", analog: "PC0", pwm: "PB1",
    code: [
      "volatile int raw = 0;", "void setup(void) {", "  pinMode(13, OUTPUT);", "  pinMode(2, INPUT_PULLUP);", "  pinMode(9, OUTPUT);", "}",
      "void loop(void) {", "  raw = analogRead(A0);", "  analogWrite(9, raw >> 2);", "  digitalWrite(13, !digitalRead(2));", "  delay(10);", "}",
    ].join("\n"),
    registers: ["DDRB", "PORTB", "DDRD", "PORTD", "ADC result", "PWM frequency", "PWM duty count"],
    observe: "A0 voltage determines the 10-bit ADC result and PWM duty. The active-low D2 button controls the D13 LED.",
    limitation: "Interpreted Arduino-style C, ideal ADC, and analytic analogWrite PWM at nominal frequency. Arduino PWM frequency does not track oscillator changes in this API model; use the register-level AVR lab for clock-divider experiments. No USB bridge or full AVR ISA.",
  },
  {
    number: 56, family: "8051", chip: "Classic 8051 · Timer 0", subtitle: "Configure SFRs and execute an interrupt-driven 16-bit timer reload.", clock: 11.0592e6, voltage: 5, output: "P1.0", input: "P3.2",
    code: [
      "sbit LED = P1^0;", "volatile int ticks = 0;",
      "void timer0_isr(void) interrupt 1 {", "  TH0 = 0x4C;", "  TL0 = 0x00;", "  ticks++;", "  LED = !LED;", "}",
      "void main(void) {", "  TMOD = 0x01;", "  TH0 = 0x4C;", "  TL0 = 0x00;", "  ET0 = 1;", "  EA = 1;", "  TR0 = 1;", "  while (1);", "}",
    ].join("\n"),
    registers: ["P1", "P3", "TMOD", "TCON", "TH0", "TL0", "IE", "IP"],
    observe: "Timer 0 counts machine cycles. The 0x4C00 reload produces approximately 50 ms interrupts at 11.0592 MHz / 12; each IRQ toggles P1.0.",
    limitation: "Classic 12-clock 8051 teaching timer and SFR model. This profile has no built-in ADC; it does not represent modern single-cycle derivatives.",
  },
  {
    number: 57, family: "pic", chip: "PIC · TRIS/LAT/INTCON subset", subtitle: "Change external input edges and follow the ISR into output latch bits.", clock: 20e6, voltage: 5, output: "RC0", input: "RB0", inputActiveHigh: true,
    code: [
      "volatile int hits = 0;", "void __interrupt() isr(void) {", "  if (INTCONbits.INTF) {", "    hits++;", "    INTCONbits.INTF = 0;", "  }", "}",
      "void main(void) {", "  TRISB = 0x01;", "  TRISC = 0x00;", "  OPTION_REGbits.INTEDG = 1;", "  INTCONbits.INTE = 1;", "  INTCONbits.GIE = 1;", "  while (1) {", "    LATC = hits;", "    __delay_ms(1);", "  }", "}",
    ].join("\n"),
    registers: ["TRISB", "TRISC", "PORTB", "LATC", "INTCON", "OPTION_REG"],
    observe: "Each RB0 rising edge enters the ISR. The binary hit count is written to LATC; RC0 is its least-significant bit.",
    limitation: "A deliberately generic PIC peripheral subset mixing common register conventions; not a claim to emulate a specific PIC device or its full instruction set.",
  },
  {
    number: 58, family: "avr", chip: "ATmega328P · register-level C", subtitle: "Set DDR and Timer1 registers, then measure compare-match interrupts.", clock: 16e6, voltage: 5, output: "PB5", input: "PD2",
    code: [
      "volatile int ticks = 0;", "ISR(TIMER1_COMPA_vect) {", "  ticks++;", "  PORTB ^= _BV(PB5);", "}",
      "int main(void) {", "  DDRB |= _BV(DDB5);", "  DDRD &= ~_BV(DDD2);", "  PORTD |= _BV(PORTD2);", "  TCCR1B = (1 << WGM12) | (1 << CS12);", "  OCR1A = 6249;", "  TIMSK1 = (1 << OCIE1A);", "  sei();", "  while (1) {}", "}",
    ].join("\n"),
    registers: ["DDRB", "PORTB", "TCCR1A", "TCCR1B", "TCNT1", "OCR1A", "TIMSK1", "SREG"],
    observe: "Timer1 CTC uses the selected prescaler and OCR1A. At 16 MHz / 256 / 6250 the compare IRQ is 10 Hz, so the LED square wave is 5 Hz.",
    limitation: "Register effects and interpreted ISR execution are simulated. C statements are not a cycle-exact AVR instruction stream.",
  },
  {
    number: 59, family: "stm32", chip: "STM32F401 · Cortex-M4 peripherals", subtitle: "Execute HAL C against GPIOA, TIM2, and the interrupt controller.", clock: 84e6, voltage: 3.3, output: "PA5", input: "PC13",
    code: [
      "volatile int ticks = 0;", "void HAL_TIM_PeriodElapsedCallback(TIM_HandleTypeDef *htim) {", "  if (htim->Instance == TIM2) {", "    ticks++;", "    if (ticks % 10 == 0) HAL_GPIO_TogglePin(GPIOA, GPIO_PIN_5);", "  }", "}",
      "int main(void) {", "  HAL_Init();", "  MX_GPIO_Init();", "  MX_TIM2_Init();", "  HAL_TIM_Base_Start_IT(&htim2);", "  while (1) { __WFI(); }", "}",
    ].join("\n"),
    options: { cube: { gpio: [{ pin: "PA5", mode: "out" }, { pin: "PC13", mode: "in", pull: "up" }], timers: { TIM2: { psc: 8399, arr: 99 } } } },
    registers: ["GPIOA.MODER", "GPIOA.ODR", "RCC.APB1ENR", "TIM2.PSC", "TIM2.ARR", "TIM2.CNT", "TIM2.DIER", "TIM2.SR"],
    observe: "TIM2 updates at 100 Hz; every tenth callback toggles PA5. WFI suspends firmware until an interrupt wakes it.",
    limitation: "Selected STM32F401 peripherals and interpreted HAL C. The simulator does not implement the complete Cortex-M exception architecture, DMA bus fabric, or FPU.",
  },
  {
    number: 60, family: "esp32", chip: "ESP32 · GPIO/ADC/LEDC subset", subtitle: "Sample GPIO36 and drive LEDC PWM while inspecting external GPIO input.", clock: 240e6, voltage: 3.3, output: "GPIO2", input: "GPIO4", analog: "GPIO36", pwm: "GPIO18",
    code: [
      "volatile int raw = 0;", "void setup(void) {", "  pinMode(2, OUTPUT);", "  pinMode(4, INPUT_PULLUP);", "  ledcSetup(0, 5000, 8);", "  ledcAttachPin(18, 0);", "}",
      "void loop(void) {", "  raw = analogRead(36);", "  ledcWrite(0, raw >> 4);", "  digitalWrite(2, !digitalRead(4));", "  delay(10);", "}",
    ].join("\n"),
    registers: ["Output level", "Input level", "ADC result", "PWM frequency", "PWM duty count", "PWM resolution"],
    observe: "GPIO36's ideal 12-bit reading determines the 8-bit LEDC duty on GPIO18. GPIO4 is active-low and controls the GPIO2 LED.",
    limitation: "An ideal linear ADC and a retained Arduino-style LEDC teaching API. No Wi-Fi stack, radio PHY, second core, vendor ADC calibration, or full Xtensa ISA.",
  },
];
export const familyProfile = (number: number) => FAMILY_PROFILES.find((profile) => profile.number === number);
export function familyOptions(profile: FamilyProfile, clockMHz = profile.clock / 1e6): McuOptions {
  return { ...profile.options, family: profile.family, clock: clockMHz * 1e6, vref: profile.voltage, adcNoise: 0 };
}
export function familyRead(mcu: Mcu, profile: FamilyProfile, key: string): number {
  const pwm = profile.pwm ? mcu.pwmInfo(profile.pwm) : undefined;
  if (key === "Output level") return mcu.level(profile.output);
  if (key === "Input level") return mcu.level(profile.input);
  if (key === "ADC result") return mcu.fw?.num("raw") ?? 0;
  if (key === "PWM frequency") return pwm?.freq ?? 0;
  if (key === "PWM duty count") return profile.family === "esp32" ? mcu.ledc.get(0)?.duty ?? 0 : Math.round((pwm?.duty ?? (profile.pwm ? mcu.level(profile.pwm) : 0)) * 255);
  if (key === "PWM resolution") return mcu.ledc.get(0)?.res ?? 8;
  return mcu.r(key);
}
export function driveFamilyInputs(mcu: Mcu, profile: FamilyProfile, voltage: number, pressed: boolean, heldReset: boolean) {
  if (heldReset && !mcu.inReset) mcu.hardReset("External reset held");
  if (!heldReset && mcu.inReset && mcu.fw) mcu.fw.time = mcu.time;
  mcu.inReset = heldReset;
  mcu.setInput(profile.input, profile.inputActiveHigh ? +pressed : +!pressed);
  if (profile.analog) mcu.setAnalog(profile.analog, voltage);
}
