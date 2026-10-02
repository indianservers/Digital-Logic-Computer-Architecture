import { beforeEach, describe, expect, it } from "vitest";
import { Mcu } from "../core/mcu";
import {
  ACKPOLL, BUG_EEWAIT, BUG_PP, BUG_SHIFT, codeField, DEMO, eeprom, elec, FAST, front, hangBus, injectNack, mcu31, monitor, oledPixel, oledVisible,
  P31_DEFAULT, RECOVER, resetEeprom, scanResult, setCodeField, timing, tmpCelsius, world31, type P31,
} from "./L31sim";

function boot(src: string, over: Partial<P31> = {}) {
  const p: P31 = { ...P31_DEFAULT, ...over };
  const m = new Mcu(mcu31());
  expect(m.load(src)).toEqual([]);
  const run = (s: number) => { for (let t = 0; t < s - 1e-9; t += 0.001) { world31(m, 0.001, p); m.tick(0.001); } expect(m.fw?.error).toBeUndefined(); };
  const v = (name: string) => m.fw!.num(name, -999);
  return { m, p, run, v, f: front(m) };
}

beforeEach(() => resetEeprom());

describe("lab 31 I2C", () => {
  it("scans the bus, reads the TMP102, logs a boot and draws on the OLED", () => {
    const { run, v, f } = boot(DEMO);
    run(0.6);
    expect(v("nfound")).toBe(3);
    expect(scanResult(f)).toEqual([0x3c, 0x48, 0x50]);
    expect(v("boots")).toBe(1);
    expect(v("check")).toBe(1);
    expect(eeprom()[0]).toBe(1);
    expect(Math.abs(v("tempC10") - 245)).toBeLessThanOrEqual(1);
    expect(oledVisible(f.oled)).toBe(true);
    // The "4" glyph (column 0x7F at its fourth column) lands in page 1 at columns 40..81.
    let lit = 0;
    for (let x = 40; x < 82; x++) for (let y = 8; y < 16; y++) lit += oledPixel(f.oled, x, y);
    expect(lit).toBeGreaterThan(40);
    for (let x = 0; x < 128; x++) expect(oledPixel(f.oled, x, 0)).toBe(0);
    const mon = monitor(f);
    expect(mon[0]!.text).toContain("Bus scan 0x08–0x77: ACK from 0x3C (SSD1306), 0x48 (TMP102), 0x50 (24C02), 109 NACK");
    expect(mon.some((l) => /^TMP102 temperature 0x18[789]0 = 24\.\d+ °C$/.test(l.text))).toBe(true);
    expect(mon.some((l) => /^S 0x48 W A 00 A Sr 0x48 R A 18 A [789]0 N P$/.test(l.frame))).toBe(true);
    expect(mon[0]!.t).toBeLessThan(1e-3);
    expect(mon[1]!.t).toBeLessThan(0.015);
  });

  it("does not mistake the tail of a trimmed scan for a new, empty scan", () => {
    const { run, f } = boot(DEMO);
    run(45);
    expect(f.trimmed).toBe(true);
    const r = scanResult(f);
    expect(r === null || r.length === 3).toBe(true);
    const head = monitor(f, 400)[0]!;
    if (head.key.startsWith("scan")) expect(head.text).toContain("End of a bus scan");
  });

  it("counts boots across runs because the EEPROM is non-volatile", () => {
    boot(DEMO).run(0.2);
    const { run, v } = boot(DEMO);
    run(0.2);
    expect(v("boots")).toBe(2);
  });

  it("times the bus from the CCR formula and stretches it with the pull-up RC", () => {
    const e = elec(P31_DEFAULT, false);
    expect(e.C).toBeCloseTo(90e-12, 15);
    expect(e.tr * 1e9).toBeCloseTo(358, 0);
    const sm = timing({ init: true, hz: 100000, duty: 0, tenBit: false }, 0);
    expect(sm.nominal).toBeCloseTo(100000, 0);
    const fm = timing({ init: true, hz: 400000, duty: 0, tenBit: false }, e.tau);
    expect(fm.nominal).toBeCloseTo(400000, 0);
    expect(1 / fm.period).toBeLessThan(360000);
    const f169 = timing({ init: true, hz: 400000, duty: 1, tenBit: false }, 0);
    expect(f169.nominal).toBeCloseTo(PCLK(5), 0);
  });

  it("follows the temperature slider through the 4 Hz conversion", () => {
    const { run, v } = boot(DEMO, { tempC: -12.5 });
    run(0.6);
    expect(Math.abs(v("tempC10") + 125)).toBeLessThanOrEqual(1);
    expect(tmpCelsius(0xf380)).toBeCloseTo(-12.5, 3);
  });

  it("NACKs a missing device and when the address is not shifted", () => {
    const a = boot(DEMO, { temp: false });
    a.run(0.6);
    expect(a.v("nfound")).toBe(2);
    expect(a.v("tempC10")).toBe(0);
    expect(monitor(a.f).some((l) => l.text.startsWith("0x48: NACK - no device answers address 0x48"))).toBe(true);
    const b = boot(BUG_SHIFT);
    b.run(0.6);
    expect(b.v("tempC10")).toBe(0);
    expect(b.f.txns.some((t) => t.addr === 0x24 && t.status === 1)).toBe(true);
  });

  it("moves the TMP102 with its ADD0 strap", () => {
    const { run, v, f } = boot(DEMO, { tempAddr: 1 });
    run(0.6);
    expect(scanResult(f)).toEqual([0x3c, 0x49, 0x50]);
    expect(v("tempC10")).toBe(0);
  });

  it("NACKs the EEPROM during its write cycle and ACK polling waits it out", () => {
    const a = boot(BUG_EEWAIT);
    a.run(0.2);
    expect(a.v("check")).toBe(0);
    expect(a.f.eeNack).toBe(1);
    const b = boot(ACKPOLL);
    b.run(0.2);
    expect(b.v("boots")).toBe(2);
    expect(b.v("check")).toBe(2);
    const polls = b.f.txns.filter((t) => t.op === "probe" && t.addr === 0x50);
    expect(polls.length).toBeGreaterThan(20);
    expect(polls[polls.length - 1]!.status).toBe(0);
  });

  it("reports HAL_BUSY without pull-ups and slows down with only the internal ones", () => {
    const a = boot(DEMO, { pullup: "none" });
    a.run(0.3);
    expect(a.v("nfound")).toBe(0);
    expect(a.f.txns[0]!.op).toBe("busy");
    const src = setCodeField(DEMO, "pull", "PULLUP");
    expect(codeField(src, "pull")).toBe("PULLUP");
    const b = boot(src, { pullup: "none" });
    b.run(0.6);
    expect(Math.abs(b.v("tempC10") - 245)).toBeLessThanOrEqual(1);
    const t = b.f.txns.find((x) => x.dev === "temp" && x.op === "memr")!;
    expect(t.hz).toBeLessThan(80000);
  });

  it("loses every ACK with push-pull pins", () => {
    const { run, v, f } = boot(BUG_PP);
    run(0.3);
    expect(v("nfound")).toBe(0);
    expect(f.txns.find((t) => t.addr === 0x3c)!.note).toContain("push-pull");
  });

  it("rejects 10-bit addressing and devices beyond their speed", () => {
    const a = boot(setCodeField(DEMO, "addr", "10BIT"));
    a.run(0.3);
    expect(a.v("nfound")).toBe(0);
    expect(a.f.txns[0]!.items[1]).toMatchObject({ k: "byte", role: "hdr", ack: false });
    const b = boot(setCodeField(DEMO, "clock", "1000000"));
    b.run(0.6);
    expect(scanResult(b.f)).toEqual([0x48, 0x50]);
    expect(Math.abs(b.v("tempC10") - 245)).toBeLessThanOrEqual(1);
    const c = boot(FAST);
    c.run(0.6);
    expect(c.v("nfound")).toBe(3);
  });

  it("drives the wrong pins when the defines do not match the wiring", () => {
    const src = setCodeField(setCodeField(DEMO, "scl", "6"), "sda", "7");
    const a = boot(src);
    a.run(0.3);
    expect(a.f.txns[0]!.op).toBe("busy");
    const b = boot(setCodeField(src, "pull", "PULLUP"));
    b.run(0.3);
    expect(b.v("nfound")).toBe(0);
    expect(b.f.txns.find((t) => t.op === "probe")!.note).toContain("wired to PB8/PB9");
  });

  it("hangs on a stuck SDA and recovers by clocking SCL by hand", () => {
    const a = boot(DEMO);
    a.run(0.4);
    hangBus(a.m);
    a.run(0.6);
    expect(a.f.hang).not.toBeNull();
    expect(a.f.txns[a.f.txns.length - 1]!.op).toBe("busy");
    const b = boot(RECOVER);
    b.run(0.4);
    hangBus(b.m);
    const before = b.v("tempC10");
    b.run(0.8);
    expect(b.f.hang).toBeNull();
    expect(b.f.recovered).toBe(1);
    expect(Math.abs(before - 245)).toBeLessThanOrEqual(1);
    expect(b.f.txns[b.f.txns.length - 1]!.status).toBe(0);
  });

  it("injects a single NACK", () => {
    const { m, run, f } = boot(DEMO);
    run(0.4);
    injectNack(m);
    run(0.6);
    const bad = f.txns.filter((t) => t.note === "NACK injected on the address byte");
    expect(bad).toHaveLength(1);
    expect(f.txns.filter((t) => t.t > bad[0]!.t).some((t) => t.status === 0)).toBe(true);
  });

  it("is deterministic", () => {
    const a = boot(DEMO); a.run(0.5);
    resetEeprom();
    const b = boot(DEMO); b.run(0.5);
    expect(JSON.stringify(a.f.txns.map((t) => [t.t, t.op, t.addr, t.status, t.data]))).toBe(JSON.stringify(b.f.txns.map((t) => [t.t, t.op, t.addr, t.status, t.data])));
  });
});

function PCLK(ccr: number) { return 42e6 / (25 * ccr); }
