import { describe, expect, it } from "vitest";
import { hardwareIdentity, picturedIdentity } from "./hardwareIdentity";
import type { PartImage } from "./part-images";
const art = (sourceTitle: string): PartImage => ({ sourceTitle, src: "/test.jpg", kind: "reference", caption: "Family example" });
describe("hardware evidence", () => {
  it("keeps family labels separate from identified photographed hardware", () => {
    const uno = hardwareIdentity(art("File:Arduino Uno - R3.jpg"))!;
    expect(uno.name).toContain("ATmega328P");
    expect(uno.scope).toContain("does not establish");
    expect(uno.pins.find(pin => pin[0] === "A4 / SDA")?.[1]).toBe("I²C data");
    expect(uno.source).toMatch(/^https:\/\/docs.arduino.cc/);
  });
  it("uses IC numbering rather than claiming a module connector pinout", () => {
    const uln = hardwareIdentity(art("File:ULN2003 unioplar stepper motor driver module.jpg"))!;
    expect(uln.pins).toHaveLength(16);
    expect(uln.pins[7]).toEqual(["8", "E · ground / common emitter"]);
    expect(uln.pins[15]).toEqual(["16", "OUT1 · open collector"]);
    expect(uln.dimensions).toContain("Module PCB dimensions unverified");
  });
  it("never invents pinouts or part numbers for unidentified illustrations", () => {
    expect(hardwareIdentity()).toBeUndefined();
    expect(picturedIdentity()).toContain("unverified");
    expect(hardwareIdentity(art("File:Unknown board.jpg"))).toBeUndefined();
  });
});
