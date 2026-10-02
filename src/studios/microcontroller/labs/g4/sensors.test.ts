import { describe, expect, it } from "vitest";
import { Mcu } from "../core/mcu";
import {
  BMP_RESET, BUG_ADDR, BUG_DHTFAST, BUG_SCALE, BUG_SIGN, BUG_SLEEP, BUG_TRIG, checksum, codeField, compP, DEMO, dhtBits, dhtFrameDur, dhtTemp, front, mcu34, P34_DEFAULT,
  setCodeField, soundSpeed, TEMPCOMP, toAdcP, waveHand, world34, type P34,
} from "./L34sim";

function boot(src: string, over: Partial<P34> = {}) {
  const p: P34 = { ...P34_DEFAULT, ...over };
  const m = new Mcu(mcu34());
  expect(m.load(src)).toEqual([]);
  const run = (s: number) => { for (let t = 0; t < s - 1e-9; t += 0.001) { world34(m, 0.001, p); m.tick(0.001); } expect(m.fw?.error).toBeUndefined(); };
  const v = (name: string) => m.fw!.num(name, -999);
  return { m, p, run, v, f: () => front(m) };
}

describe("lab 34 sensor models", () => {
  it("encodes DHT22 frames with sign bit and checksum", () => {
    expect(dhtTemp(0x00f8)).toBeCloseTo(24.8);
    expect(dhtTemp(0x8065)).toBeCloseTo(-10.1);
    expect(checksum([0x01, 0xc2, 0x00, 0xf8])).toBe(0xbb);
    const bits = dhtBits([0x80, 0, 0, 0, 0x80]);
    expect(bits).toHaveLength(40);
    expect(bits[0]).toBe(1);
    const dur = dhtFrameDur(bits);
    expect(dur).toBeGreaterThan(3e-3);
    expect(dur).toBeLessThan(6e-3);
  });

  it("maps BMP280 pressure through the 20-bit ADC and back", () => {
    expect(compP(toAdcP(101325)) / 100).toBeCloseTo(1013.25, 1);
    expect(compP(BMP_RESET)).toBe(70000);
    expect(soundSpeed(20)).toBeCloseTo(343.4, 1);
  });

  it("edits the #define fields", () => {
    expect(codeField(DEMO, "dht")).toBe("2000");
    expect(codeField(DEMO, "uscm")).toBe("58");
    expect(codeField(setCodeField(DEMO, "trig", "20"), "trig")).toBe("20");
  });
});

describe("lab 34 firmware", () => {
  it("reads all five sensors", () => {
    const b = boot(DEMO);
    b.run(2.5);
    expect(b.v("temp")).toBeCloseTo(24.8, 0);
    expect(b.v("hum")).toBeCloseTo(45, 0);
    expect(b.v("lux")).toBeGreaterThan(770);
    expect(b.v("lux")).toBeLessThan(795);
    expect(b.v("pressure")).toBeCloseTo(1013.25, 0);
    expect(Math.abs(b.v("distance") - 32)).toBeLessThan(0.8);
    expect(b.v("motion")).toBe(0);
    expect(b.v("dht_err")).toBe(0);
    expect(b.v("i2c_err")).toBe(0);
    expect(b.v("echo_err")).toBe(0);
    expect(b.f().dht.frames).toBe(1);
    expect(b.v("reads")).toBeGreaterThan(18);
  });

  it("follows the environment: lag, range and the PIR hold time", () => {
    const b = boot(DEMO);
    b.run(2.2);
    b.p.distCm = 150; b.p.lux = 20000; b.p.motion = true;
    b.run(0.5);
    expect(b.v("distance")).toBeGreaterThan(148);
    expect(b.v("lux")).toBeGreaterThan(19500);
    expect(b.v("motion")).toBe(1);
    b.p.motion = false;
    b.run(2);
    expect(b.v("motion")).toBe(1);
    b.run(1.5);
    expect(b.v("motion")).toBe(0);
    b.p.distCm = 420;
    b.run(0.5);
    expect(b.v("distance")).toBe(-1);
    expect(b.v("echo_err")).toBeGreaterThan(0);
    b.p.tempC = 5;
    b.run(1.8);
    const mid = b.v("temp");
    expect(mid).toBeLessThan(24);
    b.run(12);
    expect(b.v("temp")).toBeCloseTo(5, 0);
  });

  it("re-triggers the PIR and blocks after it drops", () => {
    const b = boot(DEMO);
    b.run(0.5);
    waveHand(b.m);
    b.run(0.5);
    expect(b.v("motion")).toBe(1);
    b.run(4);
    expect(b.v("motion")).toBe(0);
    waveHand(b.m);
    b.run(0.5);
    expect(b.v("motion")).toBe(0);
  });

  it("handles negative temperatures, and the sign bug shows 3000+", () => {
    const ok = boot(DEMO, { tempC: -12.5 });
    ok.run(2.5);
    expect(ok.v("temp")).toBeCloseTo(-12.5, 0);
    const bad = boot(BUG_SIGN, { tempC: -12.5 });
    bad.run(2.5);
    expect(bad.v("temp")).toBeGreaterThan(3000);
  });

  it("polling the DHT22 too fast gives timeouts", () => {
    const b = boot(BUG_DHTFAST);
    b.run(6.5);
    expect(b.v("dht_err")).toBeGreaterThan(5);
    expect(b.f().dht.busyHits).toBeGreaterThan(5);
    expect(b.f().dht.frames).toBeGreaterThan(1);
  });

  it("missing pull-up, unplugged sensor and EMI break the DHT22 in different ways", () => {
    const np = boot(DEMO, { pullup: false });
    np.run(2.5);
    expect(np.v("dht_err")).toBe(1);
    expect(np.f().dht.frames).toBe(0);
    const emi = boot(DEMO, { emi: true });
    emi.run(6.5);
    expect(emi.f().dht.csumErr).toBeGreaterThan(0);
    expect(emi.f().dht.frames).toBeGreaterThan(0);
  });

  it("the BH1750 NACKs a doubly shifted address and the wrong ADDR pin", () => {
    const b = boot(BUG_ADDR);
    b.run(0.5);
    expect(b.v("i2c_err")).toBeGreaterThan(2);
    expect(b.v("lux")).toBe(0);
    expect(b.f().lastTxn.bh?.ack).toBe(false);
    const pin = boot(DEMO, { addrHigh: true });
    pin.run(0.5);
    expect(pin.f().bh.nacks).toBeGreaterThan(2);
    expect(pin.f().lastTxn.bh?.note).toMatch(/0x5C/);
  });

  it("a BMP280 left in sleep mode reads 700 hPa", () => {
    const b = boot(BUG_SLEEP);
    b.run(0.5);
    expect(b.v("pressure")).toBeCloseTo(700, 1);
  });

  it("a short trigger never fires the HC-SR04", () => {
    const b = boot(BUG_TRIG);
    b.run(0.5);
    expect(b.v("distance")).toBe(-1);
    expect(b.f().sonar.short).toBeGreaterThan(2);
  });

  it("one-way echo constant doubles the distance; compensation fixes cold air", () => {
    const b = boot(BUG_SCALE);
    b.run(0.5);
    expect(b.v("distance")).toBeGreaterThan(62);
    const cold = boot(DEMO, { tempC: -15, distCm: 200 });
    cold.run(2.5);
    const comp = boot(TEMPCOMP, { tempC: -15, distCm: 200 });
    comp.run(2.5);
    expect(Math.abs(cold.v("distance") - 200)).toBeGreaterThan(8);
    expect(Math.abs(comp.v("distance") - 200)).toBeLessThan(1.5);
  });
});
