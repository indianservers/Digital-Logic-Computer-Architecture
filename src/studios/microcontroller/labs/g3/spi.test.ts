import { describe, expect, it } from "vitest";
import { Mcu } from "../core/mcu";
import {
  BUG_CS, BUG_MODE1, BUG_READBIT, BURST, codeCfg, DEMO, front, mcu30, MODE3, P30_DEFAULT, rows, setCodeField, spiHz, world30, type P30,
} from "./L30sim";

function boot(src: string, over: Partial<P30> = {}) {
  const p: P30 = { ...P30_DEFAULT, ...over };
  const m = new Mcu(mcu30());
  expect(m.load(src)).toEqual([]);
  const run = (s: number) => { for (let t = 0; t < s - 1e-9; t += 0.001) { world30(m, 0.001, p); m.tick(0.001); } expect(m.fw?.error).toBeUndefined(); };
  const v = (name: string) => m.fw!.num(name, -999);
  return { m, p, run, v, f: front(m) };
}

describe("lab 30 SPI", () => {
  it("reads WHO_AM_I = 0x33, configures CTRL_REG1 and reads 1 g on Z when flat", () => {
    const { run, v, f } = boot(DEMO);
    run(0.35);
    expect(v("id")).toBe(0x33);
    expect(v("ctrl")).toBe(0x57);
    expect(f.regs[0x20]).toBe(0x57);
    expect(Math.abs(v("accZ") - 250)).toBeLessThanOrEqual(2);
    expect(Math.abs(v("accX"))).toBeLessThanOrEqual(2);
    expect(f.cfg).toMatchObject({ init: true, cpol: 0, cpha: 0, bits: 8, presc: 64, lsb: false });
    const r = rows(f);
    expect(r[0]).toMatchObject({ dir: "TX", data: "8F", desc: "Read WHO_AM_I (0x0F)", bad: false });
    expect(r[1]).toMatchObject({ dir: "RX", data: "33", desc: "Device ID (LIS3DH)", bad: false });
    expect(r[2]).toMatchObject({ dir: "TX", data: "20", desc: "Write CTRL_REG1" });
    expect(r[3]).toMatchObject({ dir: "TX", data: "57", desc: "CTRL_REG1 ← 0x57" });
    expect(r[4]).toMatchObject({ dir: "TX", data: "A0" });
    expect(r[5]).toMatchObject({ dir: "RX", data: "57", desc: "CTRL_REG1 value" });
    expect(r.some((x) => x.desc === "X-axis LSB")).toBe(true);
  });

  it("records the mode 0 transfer at bit level with the prescaler timing", () => {
    const { run, f } = boot(DEMO);
    run(0.01);
    const c = f.calls[0]!;
    expect(c.nb).toBe(16);
    expect(c.mBits.slice(0, 8)).toEqual([1, 0, 0, 0, 1, 1, 1, 1]);
    expect(c.h).toBeCloseTo(1 / (2 * spiHz(64)), 15);
    expect(c.rx).toEqual([0xff, 0x33]);
    // In mode 0 the sensor already shifts out the next byte on the last falling edge.
    expect(f.sessions[0]!.out.slice(0, 1)).toEqual([0x33]);
  });

  it("follows the board tilt", () => {
    const { run, v } = boot(DEMO, { tiltX: 90 });
    run(0.35);
    expect(Math.abs(v("accX") - 250)).toBeLessThanOrEqual(2);
    expect(Math.abs(v("accZ"))).toBeLessThanOrEqual(2);
    const t = boot(DEMO, { tiltY: -30 });
    t.run(0.35);
    expect(Math.abs(t.v("accY") + 125)).toBeLessThanOrEqual(2);
  });

  it("mode 3 works, mode 1 and mode 2 corrupt the transfer", () => {
    const m3 = boot(MODE3); m3.run(0.05);
    expect(m3.v("id")).toBe(0x33);
    const m1 = boot(BUG_MODE1); m1.run(0.05);
    expect(m1.v("id")).not.toBe(0x33);
    expect(m1.f.sessions[0]!.dev[0]).toBe(0x47);
    expect(rows(m1.f)[0]!.desc).toContain("LIS3DH saw 0x47");
    const m2 = boot(setCodeField(DEMO, "cpol", "HIGH")); m2.run(0.05);
    expect(m2.f.sessions[0]!.dev[0]).toBe(0x8f);
    expect(m2.v("id")).toBe(0x99);
  });

  it("an SCLK above the LIS3DH limit breaks reads but writes still land", () => {
    const fast = boot(setCodeField(DEMO, "presc", "8")); fast.run(0.05);
    expect(fast.v("id")).toBe(0x99);
    expect(fast.f.regs[0x20]).toBe(0x57);
    const ok = boot(setCodeField(DEMO, "presc", "16")); ok.run(0.05);
    expect(ok.v("id")).toBe(0x33);
  });

  it("wrong CS polarity leaves the sensor deselected", () => {
    const { run, v, f } = boot(BUG_CS);
    run(0.05);
    expect(v("id")).toBe(0xff);
    expect(f.sessions[0]!.sel).toBe(false);
    expect(rows(f)[0]!.desc).toContain("not selected");
  });

  it("a missing read bit turns reads into writes and powers the sensor down", () => {
    const { run, v, f } = boot(BUG_READBIT);
    run(0.05);
    expect(v("id")).toBe(0xff);
    expect(f.regs[0x0f]).toBe(0x33);
    expect(f.regs[0x20]).toBe(0x00);
    expect(rows(f)[0]!.desc).toBe("Write WHO_AM_I");
  });

  it("LSB-first and 16-bit frames reach the sensor as different commands", () => {
    const lsb = boot(setCodeField(DEMO, "first", "LSB")); lsb.run(0.05);
    expect(lsb.f.sessions[0]!.dev[0]).toBe(0xf1);
    expect(lsb.v("id")).not.toBe(0x33);
    const w16 = boot(setCodeField(DEMO, "size", "16BIT")); w16.run(0.05);
    expect(w16.f.sessions[0]!.dev.slice(0, 2)).toEqual([0x00, 0x8f]);
    expect(w16.f.sessions[0]!.tx[0]).toBe(0x008f);
    expect(rows(w16.f)[0]!.desc).toContain("16-bit frame");
  });

  it("burst read uses auto-increment in one transaction", () => {
    const { run, v, f } = boot(BURST);
    run(0.35);
    expect(Math.abs(v("accZ") - 250)).toBeLessThanOrEqual(2);
    const s = f.sessions.find((x) => x.tx.length === 7)!;
    expect(s.dev[0]).toBe(0xe8);
    expect(s.out.slice(0, 6)).toEqual(s.rx.slice(1, 7));
  });

  it("wiring faults: open MISO, swapped data lines and open CS", () => {
    const a = boot(DEMO, { misoOpen: true }); a.run(0.05);
    expect(a.v("id")).toBe(0xff);
    expect(a.f.regs[0x20]).toBe(0x57);
    const b = boot(DEMO, { swap: true }); b.run(0.05);
    expect(b.v("id")).toBe(0xff);
    expect(b.f.regs[0x20]).toBe(0x07);
    const c = boot(DEMO, { csOpen: true }); c.run(0.05);
    expect(c.v("id")).toBe(0xff);
    expect(c.f.sessions[0]!.sel).toBe(false);
  });

  it("transfers before HAL_SPI_Init fail with HAL_BUSY and no bus activity", () => {
    const { run, v, f } = boot(DEMO.replace("    HAL_SPI_Init(&hspi1);\n", ""));
    run(0.05);
    expect(f.busy).toBeGreaterThan(0);
    expect(f.sessions).toHaveLength(0);
    expect(v("id")).toBe(0);
  });

  it("reads the panel settings back from the code", () => {
    expect(codeCfg(DEMO)).toEqual({ mode: 0, presc: 64, bits: 8, lsb: false, csLow: true });
    expect(codeCfg(MODE3).mode).toBe(3);
    expect(codeCfg(BUG_CS).csLow).toBe(false);
    expect(codeCfg("int main(void){}").mode).toBeNull();
  });

  it("is deterministic", () => {
    const a = boot(DEMO, { tiltX: 17 }), b = boot(DEMO, { tiltX: 17 });
    a.run(0.45); b.run(0.45);
    expect(rows(a.f).map((r) => r.data)).toEqual(rows(b.f).map((r) => r.data));
  });
});
