import { describe, expect, it } from "vitest";
import { Mcu } from "../core/mcu";
import { driveFamilyInputs, FAMILY_PROFILES, familyOptions, familyRead } from "./familyProfiles";

function boot(number: number) {
  const profile = FAMILY_PROFILES.find((item) => item.number === number)!;
  const mcu = new Mcu(familyOptions(profile));
  expect(mcu.load(profile.code), profile.chip).toEqual([]);
  driveFamilyInputs(mcu, profile, profile.voltage / 2, false, false);
  return { mcu, profile };
}
describe("MCU family firmware simulations", () => {
  for (const profile of FAMILY_PROFILES) it(profile.number + ": compiles and executes its family-specific firmware", () => {
    const { mcu } = boot(profile.number);
    mcu.tick(0.03);
    expect(mcu.fw?.error, profile.chip).toBeUndefined();
    if (profile.family === "8051") expect(mcu.level(profile.output)).toBe(mcu.r("P1") & 1);
    else expect(["out", "af"], profile.chip).toContain(mcu.pin(profile.output).mode);
    expect(mcu.time).toBeCloseTo(0.03, 6);
  });
  for (const number of [55, 60]) it(number + ": external analog and digital inputs affect real firmware outputs", () => {
    const { mcu, profile } = boot(number);
    mcu.tick(0.03);
    expect(mcu.fw!.num("raw")).toBe(Math.round((2 ** mcu.adcBits - 1) / 2));
    expect(mcu.pwmInfo(profile.pwm!)?.duty).toBeGreaterThan(0.45);
    driveFamilyInputs(mcu, profile, profile.voltage / 4, true, false);
    mcu.tick(0.03);
    expect(mcu.fw!.num("raw")).toBe(Math.round((2 ** mcu.adcBits - 1) / 4));
    expect(mcu.level(profile.output)).toBe(1);
  });
  it("56: uses classic 8051 machine-cycle timer reloads", () => {
    const { mcu } = boot(56); mcu.tick(1);
    expect(mcu.fw!.num("ticks")).toBeGreaterThanOrEqual(19);
    expect(mcu.fw!.num("ticks")).toBeLessThanOrEqual(21);
  });
  it("57: counts external rising-edge interrupts and drives LATC", () => {
    const { mcu, profile } = boot(57); mcu.tick(0.01);
    for (let i = 0; i < 3; i++) { driveFamilyInputs(mcu, profile, 0, true, false); mcu.tick(0.01); driveFamilyInputs(mcu, profile, 0, false, false); mcu.tick(0.01); }
    expect(mcu.fw!.num("hits")).toBe(3);
    expect(mcu.level("RC0")).toBe(1);
  });
  it("58–59: observes register-backed AVR and STM32 timer interrupts", () => {
    const avr = boot(58).mcu; avr.tick(1);
    expect(avr.fw!.num("ticks")).toBeGreaterThanOrEqual(9);
    expect(avr.fw!.num("ticks")).toBeLessThanOrEqual(11);
    const stm32 = boot(59).mcu; stm32.tick(1);
    expect(stm32.fw!.num("ticks")).toBeGreaterThanOrEqual(99);
    expect(stm32.fw!.num("ticks")).toBeLessThanOrEqual(101);
  });
  it("edited AVR register firmware changes the interrupt rate", () => {
    const profile = FAMILY_PROFILES.find((item) => item.number === 58)!;
    const slow = new Mcu(familyOptions(profile)), fast = new Mcu(familyOptions(profile));
    expect(slow.load(profile.code)).toEqual([]);
    expect(fast.load(profile.code.replace("OCR1A = 6249", "OCR1A = 3124"))).toEqual([]);
    slow.tick(1); fast.tick(1);
    expect(fast.fw!.num("ticks")).toBeGreaterThanOrEqual(slow.fw!.num("ticks") * 1.8);
  });
  it("held reset prevents firmware catch-up when the reset pin is released", () => {
    const { mcu, profile } = boot(58);
    driveFamilyInputs(mcu, profile, 0, false, true); mcu.tick(1);
    expect(mcu.fw!.num("ticks")).toBe(0);
    driveFamilyInputs(mcu, profile, 0, false, false); mcu.tick(0.01);
    expect(mcu.fw!.num("ticks")).toBe(0);
    mcu.tick(0.11);
    expect(mcu.fw!.num("ticks")).toBe(1);
  });
  for (const number of [55, 60]) it(number + ": preserves 0% and 100% PWM endpoint states", () => {
    const { mcu, profile } = boot(number);
    driveFamilyInputs(mcu, profile, 0, false, false); mcu.tick(0.03);
    expect(familyRead(mcu, profile, "PWM duty count")).toBe(0);
    driveFamilyInputs(mcu, profile, profile.voltage, false, false); mcu.tick(0.03);
    expect(familyRead(mcu, profile, "ADC result")).toBe(2 ** mcu.adcBits - 1);
    expect(familyRead(mcu, profile, "PWM duty count")).toBe(255);
  });
  it("60: exposes decoded LEDC state rather than unsupported register placeholders", () => {
    const { mcu, profile } = boot(60); mcu.tick(0.03);
    expect(familyRead(mcu, profile, "PWM frequency")).toBe(5000);
    expect(familyRead(mcu, profile, "PWM resolution")).toBe(8);
    expect(familyRead(mcu, profile, "PWM duty count")).toBe(128);
  });
});
