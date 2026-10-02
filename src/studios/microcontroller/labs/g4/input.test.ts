import { describe, expect, it } from "vitest";
import { Mcu } from "../core/mcu";
import {
  BUG_BOUNCE, BUG_ENCDIR, BUG_FLOAT, BUG_ROWLOW, BUG_SETTLE, BUG_SLOW, codeField, DEMO, encAB, EV, evText, front, mcu36, P36_DEFAULT, press36, riseTime, scanRate, setCodeField,
  trueDetents, turn36, VARIANTS, world36, type P36,
} from "./L36sim";

function boot(src: string, over: Partial<P36> = {}) {
  const p: P36 = { ...P36_DEFAULT, ...over };
  const m = new Mcu(mcu36());
  expect(m.load(src)).toEqual([]);
  const run = (s: number) => { for (let t = 0; t < s - 1e-9; t += 0.001) { world36(m, 0.001, p); m.tick(0.001); } expect(m.fw?.error).toBeUndefined(); };
  const tap = (k: number, hold = 0.12, after = 0.12) => { press36(m, k, true); run(hold); press36(m, k, false); run(after); };
  const f = () => front(m);
  const keyEvents = () => f().events.filter((e) => e.type === EV.EV_KEY_DOWN || e.type === EV.EV_KEY_UP).map(evText);
  return { m, p, run, tap, f, keyEvents };
}

describe("lab 36 input models", () => {
  it("decodes quadrature states and edits #define fields", () => {
    expect([0, 1, 2, 3, 4].map((q) => { const { a, b } = encAB(q); return a * 2 + b; })).toEqual([3, 1, 0, 2, 3]);
    expect(riseTime(150)).toBeCloseTo(9e-6, 8);
    expect(codeField(DEMO, "debounce")).toBe("20");
    expect(codeField(setCodeField(DEMO, "settle", "20"), "settle")).toBe("20");
    for (const v of VARIANTS) expect(new Mcu(mcu36()).load(v.code)).toEqual([]);
  });

  it("scans at 1 kHz and reports one clean DOWN/UP per press with about 20 ms latency", () => {
    const b = boot(DEMO);
    b.run(0.1);
    expect(scanRate(b.f(), b.m.now)).toBeGreaterThan(990);
    expect(scanRate(b.f(), b.m.now)).toBeLessThan(1010);
    b.tap(5);
    b.tap(15);
    expect(b.keyEvents()).toEqual(["KEY 5 DOWN", "KEY 5 UP", "KEY D DOWN", "KEY D UP"]);
    expect(b.f().phantoms + b.f().dups).toBe(0);
    expect(b.f().lastLatency).toBeGreaterThan(0.018);
    expect(b.f().lastLatency).toBeLessThan(0.03);
    expect(b.m.fw!.num("pressed")).toBe(0);
  });

  it("without debounce one bouncy press is typed several times", () => {
    const b = boot(BUG_BOUNCE);
    b.run(0.05);
    b.tap(5);
    expect(b.f().dups).toBeGreaterThan(0);
    expect(b.keyEvents().filter((x) => x === "KEY 5 DOWN").length).toBeGreaterThan(1);
    const clean = boot(BUG_BOUNCE, { bounce: 0 });
    clean.run(0.05);
    clean.tap(5);
    expect(clean.keyEvents()).toEqual(["KEY 5 DOWN", "KEY 5 UP"]);
  });

  it("no settle delay: the slow column rise reports the key below as well", () => {
    const b = boot(BUG_SETTLE);
    b.run(0.05);
    b.tap(5);
    expect(b.keyEvents()).toContain("KEY 8 DOWN");
    expect(b.f().causes.stale).toBeGreaterThan(0);
    const longCable = boot(DEMO, { cable: 2 });
    longCable.run(0.05);
    longCable.tap(5);
    expect(longCable.keyEvents()).toContain("KEY 8 DOWN");
    const fixed = boot(setCodeField(DEMO, "settle", "20"), { cable: 2 });
    fixed.run(0.05);
    fixed.tap(5);
    expect(fixed.keyEvents()).toEqual(["KEY 5 DOWN", "KEY 5 UP"]);
  });

  it("floating columns and a row left low create phantom keys", () => {
    const fl = boot(BUG_FLOAT);
    fl.run(1.5);
    expect(fl.f().causes.floating).toBeGreaterThan(0);
    const rows = boot(BUG_ROWLOW);
    rows.run(0.05);
    rows.tap(5);
    const ev = rows.keyEvents();
    expect(ev).toContain("KEY 5 DOWN");
    expect(ev).toContain("KEY 2 DOWN");
    expect(rows.f().causes.rows).toBeGreaterThan(0);
  });

  it("three keys on a rectangle ghost a fourth unless every key has a diode", () => {
    const run = (diodes: boolean) => {
      const b = boot(DEMO, { diodes });
      b.run(0.05);
      for (const k of [0, 1, 4]) press36(b.m, k, true);
      b.run(0.15);
      return b;
    };
    const ghost = run(false);
    expect(ghost.f().fwDown[5]).toBe(true);
    expect(ghost.f().causes.ghost).toBeGreaterThan(0);
    const clean = run(true);
    expect(clean.f().fwDown.map((d, i) => (d ? i : -1)).filter((i) => i >= 0)).toEqual([0, 1, 4]);
  });

  it("decodes encoder detents and the push button; slow scans and swapped pins go wrong", () => {
    const b = boot(DEMO);
    b.run(0.05);
    turn36(b.m, 3);
    b.run(0.2);
    turn36(b.m, -1);
    b.run(0.2);
    expect(trueDetents(b.f())).toBe(2);
    expect(b.f().fwEnc).toBe(2);
    press36(b.m, 16, true); b.run(0.1); press36(b.m, 16, false); b.run(0.1);
    expect(b.f().events.filter((e) => e.type === EV.EV_BUTTON).map(evText)).toEqual(["BUTTON PRESS", "BUTTON RELEASE"]);

    const spin = (src: string) => { const s = boot(src, { spin: 120 }); s.run(0.5); s.p.spin = 0; s.run(0.2); return s; };
    const fast = spin(DEMO);
    expect(fast.f().fwEnc).toBe(trueDetents(fast.f()));
    const slow = spin(BUG_SLOW);
    expect(slow.f().enc.skips).toBeGreaterThan(5);
    expect(Math.abs(slow.f().fwEnc - trueDetents(slow.f()))).toBeGreaterThan(5);

    const rev = boot(BUG_ENCDIR);
    rev.run(0.05);
    turn36(rev.m, 3);
    rev.run(0.2);
    expect(rev.f().fwEnc).toBe(-3);
  });
});
