export interface MicrocontrollerLab {
  number: number;
  title: string;
  section: string;
  status: "planned";
}

const sections = [
  { title: "Foundations & Architecture", labs: [
    "Microcontroller Fundamentals", "Inside a Microcontroller", "MCU Architecture Explorer", "Harvard vs Von Neumann Architecture", "8-bit vs 16-bit vs 32-bit MCUs", "Registers & Special Function Registers", "Program Counter, Stack & Stack Pointer", "Flash, SRAM & EEPROM", "Memory-Mapped I/O", "Clock System",
  ] },
  { title: "GPIO & Interrupts", labs: [
    "GPIO Fundamentals", "Digital Input Lab", "Digital Output Lab", "GPIO Register Programming", "Pin Multiplexing / Alternate Functions", "Interrupts", "External Interrupts", "Interrupt Priority & Nested Interrupts",
  ] },
  { title: "Timers, Motion & Analog", labs: [
    "Timers & Counters", "Input Capture & Output Compare", "PWM Generator", "Servo Motor Control", "DC Motor Control", "Stepper Motor Control", "ADC Lab", "ADC Resolution & Quantization", "DAC Lab", "Analog Comparator",
  ] },
  { title: "Communication & Interfacing", labs: [
    "UART / Serial Communication", "SPI Communication", "I²C Communication", "CAN Bus Fundamentals", "USB Fundamentals", "Sensor Interfacing Lab", "Display Interfacing", "Keypad & Human Input",
  ] },
  { title: "Firmware & System Control", labs: [
    "Embedded C Execution Lab", "Bare-Metal Programming Lab", "Polling vs Interrupts", "DMA Lab", "Watchdog Timer", "Power & Sleep Modes", "Brown-Out & Reset Circuitry", "Real-Time Clock", "Finite-State Machines on MCU", "Task Scheduler", "RTOS Fundamentals", "RTOS Synchronization", "RTOS Timing & Priority Inversion", "Bootloader & Firmware Update", "Firmware Debugger", "Logic Analyzer", "Virtual Oscilloscope", "Power Analyzer",
  ] },
  { title: "MCU Families", labs: [
    "Arduino / ATmega328P Explorer", "8051 Microcontroller Lab", "PIC Microcontroller Lab", "AVR Microcontroller Lab", "STM32 / ARM Cortex-M Lab", "ESP32 Lab",
  ] },
  { title: "Project Labs", labs: [
    "Traffic Light Controller", "Automatic Street Light", "Digital Thermometer", "Ultrasonic Distance Meter", "Smart Irrigation Controller", "Line-Following Robot Controller", "DC Motor Speed Controller", "Servo-Based Robotic Arm", "Weather Monitoring Station", "Home Automation Controller", "IoT Sensor Node", "Mini Embedded System – Build Your Own MCU Project",
  ] },
] as const;

export const MICROCONTROLLER_LABS: MicrocontrollerLab[] = sections.flatMap((section) =>
  section.labs.map((title) => ({ number: 0, title, section: section.title, status: "planned" as const })),
).map((lab, index) => ({ ...lab, number: index + 1 }));

export const MICROCONTROLLER_SECTIONS = sections.map((section) => section.title);
