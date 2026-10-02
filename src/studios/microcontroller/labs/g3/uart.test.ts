import { beforeEach, describe, expect, it } from "vitest";
import { Mcu, serialFrame } from "../core/mcu";
import {
  BUG_BAUD, BUG_PARITY, clearMonitor, decode, DEMO, ECHO, encode, fmtFrame, frameBitList, front, Line, monitor, P29_DEFAULT, sendTerm, world29, type P29,
} from "./L29sim";

function boot(src: string, over: Partial<P29> = {}) {
  const p: P29 = { ...P29_DEFAULT, ...over };
  const m = new Mcu({ family: "esp32", ips: 400_000 });
  expect(m.load(src)).toEqual([]);
  const run = (s: number) => { for (let t = 0; t < s - 1e-9; t += 0.001) { world29(m, 0.001, p); m.tick(0.001); } expect(m.fw?.error).toBeUndefined(); };
  return { m, p, run };
}
const text = () => monitor.filter((l) => l.dir === "rx").map((l) => l.text).join("\n");

describe("lab 29 UART", () => {
  beforeEach(() => clearMonitor());

  it("encodes 'A' as start, LSB-first data and stop, and the receiver recovers it", () => {
    expect(frameBitList(0x41, fmtFrame("8N1"))).toEqual([0, 1, 0, 0, 0, 0, 0, 1, 0, 1]);
    expect(frameBitList(0x41, fmtFrame("8E1"))).toEqual([0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 1]);
    expect(frameBitList(0x41, fmtFrame("8O2"))).toEqual([0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 1, 1]);
    const line = new Line();
    const end = encode(line, 0.001, 0x41, fmtFrame("8E1"), 9600);
    expect(end - 0.001).toBeCloseTo(11 / 9600, 9);
    const got = decode(line, { cursor: 0 }, 9600, fmtFrame("8E1"), 1);
    expect(got).toHaveLength(1);
    expect(got[0]).toMatchObject({ byte: 0x41, frameErr: false, parityErr: false });
  });

  it("SERIAL_xyz constants select the frame format and timing", () => {
    expect(serialFrame(0x06)).toEqual({ bits: 8, parity: 0, stop: 1 });
    expect(serialFrame(0x26)).toEqual({ bits: 8, parity: 1, stop: 1 });
    expect(serialFrame(0x3e)).toEqual({ bits: 8, parity: 2, stop: 2 });
    const { m, run } = boot(BUG_PARITY);
    run(0.01);
    expect(m.uart.frame).toEqual({ bits: 8, parity: 1, stop: 1 });
    expect(m.uart.baud).toBe(9600);
    expect(m.uart.pins).toEqual({ rx: "GPIO16", tx: "GPIO17" });
    const tx = m.uart.log.filter((b) => b.dir === "tx");
    expect(tx[1]!.t - tx[0]!.t).toBeCloseTo(11 / 9600, 9);
  });

  it("prints the banner, answers help / temp and drives the LED from typed commands", () => {
    const { m, p, run } = boot(DEMO);
    run(0.15);
    expect(text()).toContain("=== UART Lab 29: Serial Communication ===");
    expect(text()).toContain("Type 'help' for available commands.");
    sendTerm(m, p, "help\n");
    run(0.4);
    expect(text()).toContain("Available commands:");
    expect(text()).toContain("echo <txt> - Echo back your text");
    sendTerm(m, p, "temp\n");
    run(0.2);
    expect(text()).toMatch(/Temperature: \d+\.\d C/);
    sendTerm(m, p, "led on\n");
    run(0.1);
    expect(m.level("GPIO2")).toBe(1);
    expect(text()).toContain("LED turned ON");
    sendTerm(m, p, "echo Hello Microcontroller Studio!\n");
    run(0.15);
    expect(text()).toContain("Hello Microcontroller Studio!");
    const s = front(m).stats;
    expect(s.termFrameErr + s.termParityErr + s.mcuFrameErr).toBe(0);
    expect(monitor.filter((l) => l.dir === "tx").map((l) => l.text)).toEqual(["help", "temp", "led on", "echo Hello Microcontroller Studio!"]);
  });

  it("a baud mismatch garbles the text with framing errors and commands fail", () => {
    const { m, p, run } = boot(BUG_BAUD);
    run(0.1);
    const s = front(m).stats;
    expect(text()).not.toContain("UART Lab 29");
    expect(s.termFrameErr).toBeGreaterThan(0);
    sendTerm(m, p, "led on\n");
    run(0.1);
    expect(m.level("GPIO2")).toBe(0);
    clearMonitor();
    const fixed = boot(BUG_BAUD, { termBaud: 115200 });
    fixed.run(0.05);
    expect(text()).toContain("=== UART Lab 29: Serial Communication ===");
  });

  it("a parity mismatch shows up as framing errors on every frame whose parity bit is 0", () => {
    const { m, run } = boot(BUG_PARITY);
    run(0.15);
    const s = front(m).stats;
    expect(s.termFrameErr).toBeGreaterThan(5);
    clearMonitor();
    const ok = boot(BUG_PARITY, { termFmt: "8E1" });
    ok.run(0.15);
    expect(text()).toContain("=== UART Lab 29: Serial Communication ===");
    expect(front(ok.m).stats.termParityErr).toBe(0);
  });

  it("straight-through wiring delivers nothing in either direction", () => {
    const { m, p, run } = boot(DEMO, { swap: true });
    run(0.15);
    expect(text()).toBe("");
    sendTerm(m, p, "led on\n");
    run(0.1);
    expect(m.level("GPIO2")).toBe(0);
    expect(front(m).stats.delivered).toBe(0);
  });

  it("an open RX wire keeps the output working but the ESP32 never hears the commands", () => {
    const { m, p, run } = boot(DEMO, { rxOpen: true });
    run(0.15);
    expect(text()).toContain("UART Lab 29");
    sendTerm(m, p, "led on\n");
    run(0.1);
    expect(m.level("GPIO2")).toBe(0);
  });

  it("EMI glitches corrupt a few characters deterministically", () => {
    const a = boot(DEMO, { noise: true }); a.run(0.15);
    const sa = front(a.m).stats;
    expect(sa.termFrameErr + sa.termParityErr + (text().match(/[^\x20-\x7e\n]/g)?.length ?? 0)).toBeGreaterThan(0);
    const first = text();
    clearMonitor();
    const b = boot(DEMO, { noise: true }); b.run(0.15);
    expect(text()).toBe(first);
  });

  it("the echo firmware returns each byte in upper case", () => {
    const { m, p, run } = boot(ECHO);
    run(0.05);
    sendTerm(m, p, "abc\n");
    run(0.05);
    expect(text()).toContain("ABC");
  });

  it("readStringUntil waits for the newline instead of returning a partial command", () => {
    const { m, p, run } = boot(DEMO);
    run(0.1);
    sendTerm(m, p, "led on");
    run(0.3);
    expect(m.level("GPIO2")).toBe(0);
    run(1.0);
    expect(m.level("GPIO2")).toBe(1);
  });
});
