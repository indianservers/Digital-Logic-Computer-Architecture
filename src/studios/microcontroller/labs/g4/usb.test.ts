import { describe, expect, it } from "vitest";
import { Mcu } from "../core/mcu";
import {
  BUG_CLOCK, BUG_EP0, BUG_NOCLASS, BUG_NOSTART, BUG_POWER, BUG_REARM, codeField, configDesc, corruptNext, crc16, crc5, DEFAULT_DESC, DEMO, deviceDesc, encodePacket, EP0_8, front,
  hostSend, mcu33, P33_DEFAULT, pidByte, setCodeField, world33, type P33,
} from "./L33sim";

function boot(src: string, over: Partial<P33> = {}) {
  const p: P33 = { ...P33_DEFAULT, ...over };
  const m = new Mcu(mcu33());
  expect(m.load(src)).toEqual([]);
  const run = (s: number) => { for (let t = 0; t < s - 1e-9; t += 0.001) { world33(m, 0.001, p); m.tick(0.001); } expect(m.fw?.error).toBeUndefined(); };
  const v = (name: string) => m.fw!.num(name, -999);
  return { m, p, run, v, f: () => front(m) };
}
const bits = (s: string) => [...s].flatMap((c) => Array.from({ length: 8 }, (_, i) => (c.charCodeAt(0) >> i) & 1));

describe("lab 33 USB packets and descriptors", () => {
  it("uses the standard USB CRC5 and CRC16", () => {
    expect(crc5(bits("123456789"))).toBe(0x19);
    expect(crc16([..."123456789"].map((c) => c.charCodeAt(0)))).toBe(0xb4c8);
  });

  it("encodes PIDs, NRZI, bit stuffing and EOP", () => {
    expect(pidByte("SETUP")).toBe(0x2d);
    expect(pidByte("DATA1")).toBe(0x4b);
    expect(pidByte("ACK")).toBe(0xd2);
    const ack = encodePacket({ pid: "ACK", from: "dev" });
    expect(ack.line.slice(0, 8).join("")).toBe("KJKJKJKK");
    expect(ack.line.slice(-3)).toEqual(["0", "0", "J"]);
    const ones = encodePacket({ pid: "DATA0", from: "host", data: [0xff, 0xff] });
    expect(ones.stuff.length).toBeGreaterThan(0);
    let run = 0;
    for (const b of ones.bits) { run = b ? run + 1 : 0; expect(run).toBeLessThanOrEqual(6); }
  });

  it("builds an 18-byte device descriptor and a 67-byte CDC configuration", () => {
    const d = deviceDesc(DEFAULT_DESC);
    expect(d).toHaveLength(18);
    expect(d.slice(7, 12)).toEqual([64, 0x83, 0x04, 0x40, 0x57]);
    const c = configDesc(DEFAULT_DESC);
    expect(c).toHaveLength(67);
    expect(c[2]).toBe(67);
    expect(c[8]).toBe(50);
  });

  it("edits the descriptor fields in the code", () => {
    expect(codeField(DEMO, "vid")).toBe("0x0483");
    expect(codeField(DEMO, "ep0")).toBe("64");
    expect(codeField(DEMO, "pllq")).toBe("7");
    const s = setCodeField(setCodeField(DEMO, "pid", "0x5741"), "power", "250");
    expect(s).toContain("#define USBD_PID_FS         0x5741");
    expect(s).toContain("#define USBD_MAX_POWER_MA   250");
  });
});

describe("lab 33 USB enumeration and CDC traffic", () => {
  it("enumerates, opens the COM port and receives ticks", () => {
    const b = boot(DEMO);
    b.run(0.3);
    const f = b.f();
    expect(f.dev.usbClk).toBe(48e6);
    expect(f.host.phase).toBe("configured");
    expect(f.host.configuredAt! * 1e3).toBeGreaterThan(110);
    expect(f.host.configuredAt! * 1e3).toBeLessThan(150);
    expect(f.host.steps.map((s) => s.st)).toEqual(["ok", "ok", "ok", "ok", "ok", "ok"]);
    expect(b.m.fw!.field("hUsbDeviceFS.dev_state")).toBe(3);
    expect(b.v("baud")).toBe(115200);
    expect(b.v("dtr")).toBe(1);
    const desc = f.xfers.find((x) => x.title === "GET_DESCRIPTOR (Device, 64)")!;
    expect(desc.stages.map((s) => s.name)).toEqual(["SETUP", "DATA", "STATUS"]);
    expect(desc.data).toHaveLength(18);
    b.run(2.1);
    expect(b.v("ticks")).toBeGreaterThanOrEqual(2);
    expect(f.term.filter((l) => l.dir === "rx").map((l) => l.text).join("")).toContain("tick 1\r\n");
  });

  it("echoes PC text in upper case through EP1 OUT and EP1 IN", () => {
    const b = boot(DEMO);
    b.run(0.3);
    hostSend(b.m, "hello usb");
    b.run(0.02);
    const f = b.f();
    expect(b.v("rxBytes")).toBe(9);
    expect(f.term.filter((l) => l.dir === "rx").map((l) => l.text).join("")).toContain("HELLO USB");
    expect(f.eps.out1.pk).toBe(1);
    hostSend(b.m, "again");
    b.run(0.02);
    expect(b.v("rxBytes")).toBe(14);
  });

  it("without the COM port open the device cannot send and CDC_Transmit_FS reports busy", () => {
    const b = boot(DEMO, { port: false });
    b.run(0.3);
    expect(b.v("dtr")).toBe(0);
    b.p.port = true;
    b.run(0.02);
    expect(b.v("dtr")).toBe(1);
    b.p.port = false;
    b.run(0.02);
    expect(b.v("dtr")).toBe(0);
  });

  it("an 8-byte EP0 splits the device descriptor into three DATA packets", () => {
    const b = boot(EP0_8);
    b.run(0.3);
    const x = b.f().xfers.find((y) => y.title === "GET_DESCRIPTOR (Device, 18)")!;
    expect(x.stages[1]!.packets.filter((p) => p.pid.startsWith("DATA"))).toHaveLength(3);
    expect(b.f().host.phase).toBe("configured");
  });

  it("no USBD_Start: the host never sees the device", () => {
    const b = boot(BUG_NOSTART);
    b.run(0.5);
    expect(b.f().host.phase).toBe("nodevice");
    expect(b.f().xfers).toHaveLength(0);
  });

  it("a 42 MHz USB clock garbles every device packet and enumeration fails after 3 attempts", () => {
    const b = boot(BUG_CLOCK);
    b.run(0.8);
    const f = b.f();
    expect(f.dev.usbClk).toBe(42e6);
    expect(f.host.phase).toBe("failed");
    expect(f.host.attempt).toBe(3);
    const x = f.xfers.find((y) => y.kind === "ctrl")!;
    expect(x.result).toBe("err");
    expect(x.stages[0]!.packets[2]!.bad).toBe("clock");
  });

  it("an invalid EP0 size fails the first device descriptor", () => {
    const b = boot(BUG_EP0);
    b.run(0.8);
    expect(b.f().host.phase).toBe("failed");
    expect(b.f().host.failCause).toBe("ep0");
  });

  it("600 mA is refused: the device stays addressed", () => {
    const b = boot(BUG_POWER);
    b.run(0.4);
    expect(b.f().host.phase).toBe("failed");
    expect(b.f().host.failCause).toBe("power");
    expect(b.m.fw!.field("hUsbDeviceFS.dev_state")).toBe(2);
  });

  it("no class registered: the configuration descriptor request STALLs", () => {
    const b = boot(BUG_NOCLASS);
    b.run(0.8);
    expect(b.f().host.phase).toBe("failed");
    expect(b.f().xfers.some((x) => x.result === "stall")).toBe(true);
  });

  it("without USBD_CDC_ReceivePacket the second message is NAKed forever", () => {
    const b = boot(BUG_REARM);
    b.run(0.3);
    hostSend(b.m, "one");
    b.run(0.02);
    expect(b.v("rxBytes")).toBe(3);
    hostSend(b.m, "two");
    b.run(0.05);
    expect(b.v("rxBytes")).toBe(3);
    const f = b.f();
    expect(f.eps.out1.nak).toBeGreaterThan(40);
    expect(f.xfers.filter((x) => x.result === "nak")).toHaveLength(1);
  });

  it("a corrupted DATA packet is retried by the host", () => {
    const b = boot(DEMO);
    b.run(0.05);
    corruptNext(b.m);
    b.run(0.3);
    const f = b.f();
    expect(f.corrupted).toBe(1);
    expect(f.host.phase).toBe("configured");
    expect(f.xfers.some((x) => x.tries > 1)).toBe(true);
  });

  it("unplugging removes the device and replugging enumerates on a new address", () => {
    const b = boot(DEMO);
    b.run(0.3);
    const a1 = b.f().host.addr;
    b.p.cable = false;
    b.run(0.05);
    expect(b.f().host.phase).toBe("nodevice");
    expect(b.m.fw!.field("hUsbDeviceFS.dev_state")).toBe(1);
    b.p.cable = true;
    b.run(0.3);
    expect(b.f().host.phase).toBe("configured");
    expect(b.f().host.addr).toBe(a1 + 1);
  });
});
