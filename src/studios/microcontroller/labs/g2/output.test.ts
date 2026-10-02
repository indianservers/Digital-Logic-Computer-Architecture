import { describe, expect, it } from "vitest";
import { Mcu } from "../core/mcu";
import { load13, P13_DEFAULT, PATTERN, SCANNER, SINK, world13, type P13 } from "./L13sim";

function sim(src: string, p: Partial<P13>, seconds: number) {
  const m = new Mcu({ ips: 120_000 });
  expect(m.load(src)).toEqual([]);
  const params = { ...P13_DEFAULT, ...p };
  for (let t = 0; t < seconds; t += 0.001) { world13(m, 0.001, params); m.tick(0.001); }
  expect(m.fw?.error).toBeUndefined();
  return { m, s: load13(m) };
}

describe("lab 13 digital output", () => {
  it("pattern firmware alternates the LED bank and clicks the relay through Q1", () => {
    const { m, s } = sim(PATTERN, {}, 1.1);
    expect([0x0a, 0x05]).toContain(m.peek("GPIOB.ODR") & 0x0f);
    expect(s.contactEdges.length).toBeGreaterThanOrEqual(3);
    expect(s.ledA[0]).toBeCloseTo(0, 5);
    expect(Math.max(...s.ledA)).toBeGreaterThan(0.003);
    expect(s.port).toBeLessThan(0.025 * 6);
  });

  it("a coil driven straight from the pin overloads it and never pulls in", () => {
    const { s } = sim(PATTERN, { drive: "direct" }, 1.1);
    expect(s.contactEdges.length).toBe(0);
    expect(s.overT[4]).toBeGreaterThan(0.2);
  });

  it("without a flyback diode Q1 dies and the relay sticks on", () => {
    const { s } = sim(PATTERN, { noDiode: true }, 2.2);
    expect(s.spikes.filter((x) => x.v < -40).length).toBeGreaterThanOrEqual(3);
    expect(s.q1Short).toBe(true);
    expect(s.contact).toBe(true);
  });

  it("diode-clamped turn-offs do not count toward Q1 failure", () => {
    const m = new Mcu({ ips: 120_000 });
    m.load(PATTERN);
    for (let t = 0; t < 2; t += 0.001) { world13(m, 0.001, P13_DEFAULT); m.tick(0.001); }
    const p = { ...P13_DEFAULT, noDiode: true };
    for (let t = 0; t < 0.6; t += 0.001) { world13(m, 0.001, p); m.tick(0.001); }
    expect(load13(m).q1Short).toBe(false);
  });

  it("a shorted series resistor burns the LED out", () => {
    const { s } = sim(PATTERN, { shortR: true }, 4);
    expect(s.burnt[0]).toBe(true);
    expect(s.ledA[0]).toBe(0);
  });

  it("the HAL scanner walks one LED and fires the relay at the end", () => {
    const { s } = sim(SCANNER, {}, 2);
    expect(s.contactEdges.length).toBeGreaterThanOrEqual(2);
  });

  it("OR-ing MODER without clearing leaves the JTAG pins PB3/PB4 in analog mode", () => {
    const { m, s } = sim(PATTERN.replace("    GPIOB->MODER &= ~0xFFF;", ""), {}, 1);
    expect(m.pin("PB4").mode).toBe("an");
    expect(s.contactEdges.length).toBe(0);
  });

  it("open-drain sink wiring lights LEDs on a 0 bit", () => {
    const { m, s } = sim(SINK, { sink: true }, 0.65);
    const odr = m.peek("GPIOB.ODR") & 0x0f;
    for (let k = 0; k < 4; k++) expect(s.ledA[k]! > 0).toBe(((odr >> k) & 1) === 0);
    const off = sim(SINK, { sink: false }, 0.65).s;
    expect(off.ledA.every((a) => a === 0)).toBe(true);
  });
});
