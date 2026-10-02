import { describe, expect, it } from "vitest";
import { Mcu } from "../core/mcu";
import { BSRR_DEMO, editorWrite, P14_DEFAULT, RMW_DEMO, setup14, stepToWrite, SWD_BUG, trace14, world14, type P14 } from "./L14sim";

function boot(src: string, p: Partial<P14> = {}) {
  const params = { ...P14_DEFAULT, ...p };
  const m = new Mcu({ ips: 120_000, strictClock: true });
  setup14(m, params);
  expect(m.load(src)).toEqual([]);
  return { m, params, w: () => world14(m, 0.001, params) };
}
const run = (m: Mcu, w: () => void, s: number) => { for (let t = 0; t < s; t += 0.001) { w(); m.tick(0.001); } };

describe("lab 14 GPIO register programming", () => {
  it("steps the firmware one register write at a time and decodes each", () => {
    const { m, w } = boot(BSRR_DEMO);
    const notes: string[] = [];
    for (let i = 0; i < 4; i++) { expect(stepToWrite(m, w)).toBe(true); notes.push(trace14(m).entries[0]!.note); }
    expect(notes[0]).toBe("GPIOA clock ON");
    expect(notes[1]).toBe("PA5 Input→Output");
    expect(notes[2]).toBe("set PA5");
    expect(m.pin("PA5").level).toBe(0);
    expect(notes[3]).toBe("reset PA5");
    expect(trace14(m).entries[1]!.line).toBe(7);
    expect(trace14(m).entries[0]!.line).toBe(8);
    expect(m.fw?.paused).toBe(true);
  });

  it("the switch on PA0 is mirrored on PA5 through IDR and BSRR", () => {
    const { m, params, w } = boot(BSRR_DEMO);
    run(m, w, 0.05);
    expect(m.pin("PA5").level).toBe(0);
    params.sw = true;
    run(m, w, 0.02);
    expect(m.peek("GPIOA.IDR") & 1).toBe(1);
    expect(m.pin("PA5").level).toBe(1);
  });

  it("debugger writes are traced as editor writes", () => {
    const { m, w } = boot(RMW_DEMO);
    run(m, w, 0.01);
    editorWrite(m, "GPIOA.BSRR", 1 << 7);
    const e = trace14(m).entries[0]!;
    expect(e.src).toBe("editor");
    expect(e.note).toContain("PA7");
  });

  it("writes are ignored when the GPIOA clock is stuck off", () => {
    const { m, w } = boot(BSRR_DEMO, { clockOff: true });
    run(m, w, 0.05);
    expect(m.peek("GPIOA.MODER") & (3 << 10)).toBe(0);
    expect(trace14(m).entries.some((e) => e.ignored)).toBe(true);
  });

  it("assigning MODER with '=' knocks PA13/PA14 out of SWD mode", () => {
    const { m, w } = boot(SWD_BUG);
    run(m, w, 0.02);
    expect((m.peek("GPIOA.MODER") >>> 26) & 0xf).not.toBe(0xa);
    expect(trace14(m).entries.some((e) => e.note.includes("SWD"))).toBe(true);
  });
});
