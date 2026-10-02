import { describe, expect, it } from "vitest";
import { Mcu } from "../core/mcu";
import {
  AUTO_BOFF, BUG_BITRATE, BUG_NART, BUG_NOFILTER, BUG_SAMEID, codeField, crc15, DEMO, encode, FILTER_B, front, injectBitError, MANUAL_BOFF, mcu32, monitor,
  P32_DEFAULT, REMOTE, setCodeField, world32, type P32,
} from "./L32sim";

function boot(src: string, over: Partial<P32> = {}) {
  const p: P32 = { ...P32_DEFAULT, ...over };
  const m = new Mcu(mcu32());
  expect(m.load(src)).toEqual([]);
  const run = (s: number) => { for (let t = 0; t < s - 1e-9; t += 0.001) { world32(m, 0.001, p); m.tick(0.001); } expect(m.fw?.error).toBeUndefined(); };
  const v = (name: string) => m.fw!.num(name, -999);
  return { m, p, run, v, f: front(m) };
}

describe("lab 32 CAN frame encoding", () => {
  it("stuffs after five equal bits and appends a CRC that checks to zero", () => {
    for (const fr of [{ id: 0x080, rtr: false, dlc: 2, data: [20, 0] }, { id: 0x120, rtr: false, dlc: 8, data: [3, 0x20, 90, 0, 0, 0, 0, 7] }, { id: 0x2a0, rtr: true, dlc: 4, data: [] }, { id: 0, rtr: false, dlc: 0, data: [] }]) {
      const e = encode(fr);
      const crcEnd = e.segs.find((s) => s.f === "CRC")!.b;
      let run = 1;
      for (let i = 1; i < crcEnd; i++) { run = e.bits[i] === e.bits[i - 1] ? run + 1 : 1; expect(run).toBeLessThanOrEqual(5); }
      const raw = e.bits.slice(0, crcEnd).filter((_, i) => e.raw[i]! >= 0);
      expect(crc15(raw)).toBe(0);
      expect(e.bits.slice(crcEnd)).toEqual([1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
      expect(e.stuff.every((i) => e.raw[i] === -1)).toBe(true);
    }
    // 0x000 starts with SOF + 11 dominant bits: stuff bits after the 5th and 10th zero.
    expect(encode({ id: 0, rtr: false, dlc: 0, data: [] }).stuff.slice(0, 2)).toEqual([5, 11]);
  });

  it("edits the frame builder fields in the code", () => {
    expect(codeField(DEMO, "id")).toBe("0x120");
    expect(codeField(DEMO, "dlc")).toBe("8");
    expect(codeField(DEMO, "rtr")).toBe("DATA");
    expect(codeField(DEMO, "presc")).toBe("6");
    const s = setCodeField(setCodeField(DEMO, "id", "0x050"), "presc", "12");
    expect(codeField(s, "id")).toBe("0x050");
    expect(s).toContain("hcan1.Init.Prescaler = 12;");
    expect(s).toContain("rxh.StdId == 0x080");
  });
});

describe("lab 32 CAN bus", () => {
  it("runs three ECUs: ECU B wins arbitration over ECU A every cycle and ECU A retries", () => {
    const { m, run, v, f } = boot(DEMO);
    run(0.65);
    expect(m.fw!.field("hdr.StdId")).toBe(0x120);
    const arb = f.frames.filter((r) => r.contenders.length > 1);
    expect(arb.length).toBeGreaterThanOrEqual(4);
    for (const r of arb) {
      expect(r.from).toBe("B");
      const a = r.contenders.find((c) => c.node === "A")!;
      expect(a.lostAt).toBe(3);
      expect(r.err).toBeNull();
    }
    const retries = f.frames.filter((r) => r.from === "A" && r.retry > 0);
    expect(retries.length).toBeGreaterThanOrEqual(4);
    expect(f.frames.every((r) => !r.err)).toBe(true);
    expect(v("brake")).toBe(20);
    expect(v("speed")).toBe(64);
    expect(v("rxCount")).toBeGreaterThanOrEqual(10);
    expect(v("txFail")).toBe(0);
    for (const n of [f.a, f.b, f.c]) { expect(n.tec).toBe(0); expect(n.rec).toBe(0); expect(n.state).toBe("active"); }
    expect(f.c.seen["0x120"]![3]).toBe(20);
    const mon = monitor(f);
    expect(mon.some((l) => l.tone === "arb" && l.text.includes("won arbitration over ECU A 0x120 (lost at ID bit 8)"))).toBe(true);
    expect(mon.some((l) => l.text.startsWith("ECU A 0x120 · 8 bytes") && l.text.includes("sent on attempt 2"))).toBe(true);
  });

  it("counts a bit error, then decrements TEC on every good frame", () => {
    const { m, run, f } = boot(DEMO);
    run(0.15);
    injectBitError(m);
    run(0.12);
    const bad = f.frames.filter((r) => r.err);
    expect(bad.length).toBe(1);
    expect(bad[0]!.err!.kind).toBe("bit");
    expect(bad[0]!.err!.text).toContain("DLC bit 3");
    expect(f.a.tec).toBe(7);
    expect(f.b.rec + f.c.rec).toBe(0);
  });

  it("goes error passive and bus-off under an error burst, and stays off without AutoBusOff", () => {
    const { m, run, f, v } = boot(DEMO);
    run(0.15);
    injectBitError(m, 40);
    run(0.6);
    expect(f.a.state).toBe("off");
    expect(f.events.some((e) => e.text.includes("error passive"))).toBe(true);
    expect(f.events.some((e) => e.text.includes("bus-off"))).toBe(true);
    expect(f.b.txOk).toBeGreaterThan(5);
    expect(v("txFail")).toBeGreaterThan(0);
  });

  it("recovers from bus-off automatically with ABOM and manually with Stop/Start", () => {
    const auto = boot(AUTO_BOFF);
    auto.run(0.15);
    injectBitError(auto.m, 40);
    auto.run(0.6);
    expect(auto.f.recoveries).toBeGreaterThanOrEqual(1);
    expect(auto.f.a.state).toBe("active");
    const man = boot(MANUAL_BOFF);
    man.run(0.15);
    injectBitError(man.m, 40);
    man.run(0.8);
    expect(man.v("recoveries")).toBeGreaterThanOrEqual(1);
    expect(man.f.a.state).toBe("active");
    expect(man.f.frames.filter((r) => r.from === "A" && !r.err).length).toBeGreaterThan(2);
  });

  it("breaks an unterminated bus at 500 kbps but not at 125 kbps", () => {
    const fast = boot(DEMO, { term: "none" });
    fast.run(0.4);
    expect(fast.f.frames.filter((r) => r.err).length).toBeGreaterThan(10);
    expect(fast.f.frames[0]!.err!.text).toContain("No termination");
    const slow = boot(setCodeField(DEMO, "presc", "24"), { term: "none", netKbps: 125 });
    slow.run(0.4);
    expect(slow.f.frames.length).toBeGreaterThan(6);
    expect(slow.f.frames.every((r) => !r.err)).toBe(true);
  });

  it("isolates a node with the wrong bitrate while the others keep talking", () => {
    const { run, f } = boot(BUG_BITRATE);
    run(1.5);
    expect(f.a.state).toBe("off");
    const late = f.frames.filter((r) => r.t0 > 1.2);
    expect(late.length).toBeGreaterThan(4);
    expect(late.every((r) => !r.err && r.from !== "A")).toBe(true);
    expect(f.b.state).toBe("active");
    expect(f.c.state).toBe("active");
  });

  it("ACKs but stores nothing without a filter, and only 0x080 with the 0x080 filter", () => {
    const none = boot(BUG_NOFILTER);
    none.run(0.4);
    expect(none.v("rxCount")).toBe(0);
    expect(none.f.filtered).toBeGreaterThan(4);
    expect(none.f.frames.some((r) => r.from === "B" && r.ackBy.includes("A"))).toBe(true);
    const only = boot(FILTER_B);
    only.run(0.4);
    expect(only.v("brake")).toBe(20);
    expect(only.v("speed")).toBe(0);
  });

  it("collides when two nodes share an identifier", () => {
    const { run, f } = boot(BUG_SAMEID);
    run(0.4);
    const col = f.frames.filter((r) => r.err?.kind === "collision");
    expect(col.length).toBeGreaterThan(0);
    expect(col[0]!.err!.text).toContain("both won arbitration");
  });

  it("drops frames that lose arbitration when retransmission is off", () => {
    const { run, f } = boot(BUG_NART);
    run(0.65);
    expect(f.dropped).toBeGreaterThanOrEqual(4);
    expect(f.frames.filter((r) => r.from === "A" && r.t0 > 0.15).length).toBe(0);
  });

  it("answers a remote frame from ECU C", () => {
    const { run, f, v } = boot(REMOTE);
    run(0.4);
    expect(f.frames.some((r) => r.from === "A" && r.frame.rtr && r.frame.id === 0x2a0)).toBe(true);
    expect(f.frames.some((r) => r.from === "C" && r.reply)).toBe(true);
    expect(v("speed")).toBe(64);
  });

  it("stops at TEC 128 when nobody can acknowledge", () => {
    const { run, f } = boot(DEMO, { b: false, c: false });
    run(0.3);
    expect(f.frames.every((r) => r.err?.kind === "ack")).toBe(true);
    expect(f.a.tec).toBe(128);
    expect(f.a.state).toBe("passive");
  });
});
