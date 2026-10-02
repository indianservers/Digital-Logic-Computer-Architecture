import { describe, expect, it } from "vitest";
import { Mcu } from "../core/mcu";
import {
  BUG_ADDR, BUG_LCDINIT, BUG_NOUPDATE, BUG_REDRAW, BUG_RESIDUE, BUG_SCAN, cellW, codeField, COLORS, DEMO, frameStats, front, glyph, mcu35, oledPixel, oledUpdateT, P35_DEFAULT,
  rasterText, segDigitHz, segGlow, segPattern, setCodeField, SPI_FAST, TFT_W, VARIANTS, world35, type P35,
} from "./L35sim";

function boot(src: string, over: Partial<P35> = {}) {
  const p: P35 = { ...P35_DEFAULT, ...over };
  const m = new Mcu(mcu35());
  expect(m.load(src)).toEqual([]);
  const run = (s: number) => { for (let t = 0; t < s - 1e-9; t += 0.001) { world35(m, 0.001, p); m.tick(0.001); } expect(m.fw?.error).toBeUndefined(); };
  const v = (name: string) => m.fw!.num(name, -999);
  const row = (r: number) => String.fromCharCode(...front(m).lcd.ddram[r]!);
  return { m, p, run, v, row, f: () => front(m) };
}

describe("lab 35 display models", () => {
  it("rasterises the 5x7 font and encodes 7-segment digits", () => {
    expect(glyph(65)).toEqual([14, 17, 17, 17, 31, 17, 17]);
    expect(glyph(48)[0]).toBe(14);
    let n = 0, maxX = 0;
    rasterText("HI", 16, (x, _y, on) => { if (on) { n++; maxX = Math.max(maxX, x); } }, false);
    expect(n).toBeGreaterThan(40);
    expect(maxX).toBeLessThan(2 * cellW(16));
    expect(segPattern("24.8")).toEqual([0x00, 0x5b, 0x66 | 0x80, 0x7f]);
    expect(segPattern("-10.5")).toEqual([0x40, 0x06, 0x3f | 0x80, 0x6d]);
    expect(segPattern("12345")).toEqual([0x40, 0x5c, 0x71, 0x40]);
    expect(oledUpdateT(0)).toBeCloseTo(0.02327, 4);
    expect(oledUpdateT(1)).toBeLessThan(0.0011);
  });

  it("edits the #define fields and builds every variant", () => {
    expect(codeField(DEMO, "oledBus")).toBe("OLED_I2C");
    expect(codeField(setCodeField(DEMO, "refresh", "60"), "refresh")).toBe("60");
    for (const vr of VARIANTS) expect(new Mcu(mcu35()).load(vr.code)).toEqual([]);
  });

  it("drives all four displays at 30 fps", () => {
    const b = boot(DEMO);
    b.run(1.5);
    const f = b.f();
    expect(f.seg.text).toBe("24.8");
    expect(b.row(0)).toBe("HELLO MCU       ");
    expect(b.row(1)).toBe("Temp:  24.8C    ");
    expect(f.oled.updates).toBeGreaterThan(20);
    expect(Array.from(f.oled.gddram)).toEqual(Array.from(f.oled.fb));
    expect(oledPixel(f.oled.gddram, 2, 58)).toBe(true);
    expect(f.tft.gram[70 * TFT_W + 30]).toBe(COLORS.BLUE);
    expect(f.tft.gram[70 * TFT_W + 260]).toBe(COLORS.NAVY);
    const st = frameStats(f)!;
    expect(st.fps).toBeGreaterThan(28);
    expect(st.fps).toBeLessThan(32);
    expect(st.byDisp.oled.time).toBeCloseTo(0.0233, 3);
    expect(st.draw).toBeLessThan(1 / 30);
    expect(b.v("overruns")).toBe(0);
  });

  it("runs out of I2C bandwidth at 60 fps until the OLED moves to SPI", () => {
    const slow = boot(setCodeField(DEMO, "refresh", "60"));
    slow.run(1.5);
    expect(slow.v("overruns")).toBeGreaterThan(20);
    expect(frameStats(slow.f())!.fps).toBeLessThan(40);
    const fast = boot(SPI_FAST);
    fast.run(1.5);
    expect(fast.v("overruns")).toBe(0);
    expect(frameStats(fast.f())!.fps).toBeGreaterThan(55);
    expect(frameStats(fast.f())!.byDisp.oled.time).toBeLessThan(0.0015);
  });

  it("charges the PCF8574 backpack per character", () => {
    const b = boot(setCodeField(DEMO, "lcdBus", "LCD_I2C"));
    b.run(1);
    const lcd = frameStats(b.f())!.byDisp.lcd;
    expect(lcd.time).toBeGreaterThan(13 * 0.0004);
    expect(lcd.time).toBeLessThan(13 * 0.0005);
  });

  it("shows OLED snow when the framebuffer is never sent", () => {
    const b = boot(BUG_NOUPDATE);
    b.run(1);
    const f = b.f();
    expect(f.oled.updates).toBe(0);
    expect(f.oled.lastDraw).toBeGreaterThan(0.5);
    expect(Array.from(f.oled.gddram)).not.toEqual(Array.from(f.oled.fb));
  });

  it("NACKs the 8-bit OLED address and an unplugged module", () => {
    const b = boot(BUG_ADDR);
    b.run(0.6);
    expect(b.f().oled.init).toBe(false);
    expect(b.f().oled.nacks).toBeGreaterThan(0);
    const u = boot(DEMO, { oledOff: true });
    u.run(0.6);
    expect(u.f().oled.init).toBe(false);
  });

  it("leaves LCD characters behind when the text gets shorter", () => {
    const bug = boot(BUG_RESIDUE);
    bug.run(0.8);
    expect(bug.row(1)).toBe("Temp: 24.8C     ");
    bug.p.temp = 9.5;
    bug.run(0.3);
    expect(bug.row(1)).toBe("Temp: 9.5CC     ");
    expect(bug.f().lcd.residue).toBe(true);
    const ok = boot(DEMO);
    ok.run(0.8);
    ok.p.temp = 9.5;
    ok.run(0.3);
    expect(ok.row(1)).toBe("Temp:   9.5C    ");
    expect(ok.f().lcd.residue).toBe(false);
  });

  it("collapses the frame rate when the TFT is cleared every frame", () => {
    const b = boot(BUG_REDRAW);
    b.run(2);
    expect(b.f().tft.fills).toBeGreaterThan(15);
    expect(frameStats(b.f())!.fps).toBeLessThan(13);
    expect(frameStats(b.f())!.byDisp.tft.time).toBeGreaterThan(0.06);
  });

  it("ignores the LCD until it is initialised", () => {
    const b = boot(BUG_LCDINIT);
    b.run(0.6);
    expect(b.f().lcd.init).toBe(false);
    expect(b.f().lcd.preInit).toBeGreaterThan(3);
  });

  it("flickers when the 7-segment scan is too slow", () => {
    expect(segDigitHz(120)).toBe(30);
    const b = boot(BUG_SCAN);
    b.run(0.5);
    let lo = 1, hi = 0;
    for (let i = 0; i < 100; i++) {
      b.run(0.003);
      const g = segGlow(b.f().seg, b.m.now)[1]!;
      lo = Math.min(lo, g); hi = Math.max(hi, g);
    }
    expect(hi).toBeGreaterThan(0.8);
    expect(lo).toBeLessThan(0.2);
  });
});
