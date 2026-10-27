import type { PartImage } from "./part-images";

export interface HardwareIdentity { name: string; dimensions: string; scope: string; source: string; pins: Array<[string, string]>; orientation: string }
const UNO: HardwareIdentity = {
  name: "Arduino UNO Rev3 · ATmega328P development board", dimensions: "PCB: 68.6 × 53.4 mm; image displayed at variable magnification",
  scope: "A development-board example of the controller function. This photograph does not establish that an UNO is installed in this device.",
  source: "https://docs.arduino.cc/hardware/uno-rev3/", orientation: "Board header labels, not ATmega328P package pin numbers. Locate the printed labels before connecting.",
  pins: [["D0 / RX", "UART receive"], ["D1 / TX", "UART transmit"], ["D2–D13", "Digital I/O; PWM on D3, D5, D6, D9, D10, D11"], ["A0–A5", "Analog inputs"], ["A4 / SDA", "I²C data"], ["A5 / SCL", "I²C clock"], ["D10 / SS", "SPI select"], ["D11 / COPI", "SPI controller output"], ["D12 / CIPO", "SPI controller input"], ["D13 / SCK", "SPI clock / onboard LED"], ["5V / 3.3V", "Supply rails"], ["GND", "Common reference"], ["VIN", "External supply input"], ["RESET", "Active-low reset"], ["AREF", "Analog reference"]],
};
const ULN: HardwareIdentity = {
  name: "ULN2003 unipolar stepper driver module", dimensions: "Reference ULN2003AN IC body: 19.30 × 6.35 mm nominal (PDIP-16). Module PCB dimensions unverified.",
  scope: "The photograph shows a ULN2003 module example. The pinout below describes TI’s ULN2003A IC, not the module connectors or a verified part inside this device.",
  source: "https://www.ti.com/lit/gpn/ULN2003A", orientation: "IC top view, notch at top: pins 1–8 down the left; pins 9–16 up the right. Module connector wiring must be checked separately.",
  pins: Array.from({ length: 16 }, (_, i): [string, string] => { const n = i + 1; return [`${n}`, n <= 7 ? `IN${n} · Darlington input` : n === 8 ? "E · ground / common emitter" : n === 9 ? "COM · clamp-diode common" : `OUT${17 - n} · open collector`]; }),
};
export function hardwareIdentity(art?: PartImage): HardwareIdentity | undefined {
  if (art?.sourceTitle === "File:Arduino Uno - R3.jpg") return UNO;
  if (art?.sourceTitle === "File:ULN2003 unioplar stepper motor driver module.jpg") return ULN;
  return undefined;
}
export function picturedIdentity(art?: PartImage): string {
  return hardwareIdentity(art)?.name ?? art?.sourceTitle?.replace(/^File:/, "").replace(/\.[^.]+$/, "").replaceAll("_", " ") ?? "Illustration · exact manufacturer and part number unverified";
}
