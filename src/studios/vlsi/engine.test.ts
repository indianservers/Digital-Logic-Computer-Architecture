import { describe, expect, it } from "vitest";
import { dLatch, srNor } from "../../engines/digital/sequential";
import {
  cmosDelay,
  cmosInverter,
  cmosNand,
  cmosNor,
  cmosPower,
  deviceK,
  latchD,
  latchSr,
  mosfet,
  passTransistor,
  transmissionGate,
  triStateOutput,
  sharedWire,
} from "./engine";

const kn = deviceK("nmos", 1, 0.18);
const kp = deviceK("pmos", 2.5, 0.18);

describe("VLSI educational models", () => {
  it("classifies cutoff, linear, and saturation", () => {
    expect(mosfet("nmos", 0.2, 1, 0.45, kn).region).toBe("cutoff");
    expect(mosfet("nmos", 0.2, 1, 0.45, kn).id).toBe(0);
    expect(mosfet("nmos", 1.2, 0.2, 0.45, kn).region).toBe("linear");
    expect(mosfet("nmos", 1.2, 1.5, 0.45, kn).region).toBe("saturation");
  });

  it("settles a CMOS inverter at the rails and conducts in between", () => {
    const low = cmosInverter({ vdd: 1.8, vin: 0, kn, kp, vtn: 0.45, vtp: 0.45 });
    const high = cmosInverter({ vdd: 1.8, vin: 1.8, kn, kp, vtn: 0.45, vtp: 0.45 });
    const mid = cmosInverter({ vdd: 1.8, vin: 0.9, kn, kp, vtn: 0.45, vtp: 0.45 });
    expect(low.logic).toBe(1);
    expect(low.pmosOn).toBe(true);
    expect(low.nmosOn).toBe(false);
    expect(low.vout).toBeCloseTo(1.8);
    expect(high.logic).toBe(0);
    expect(high.nmosOn).toBe(true);
    expect(high.pmosOn).toBe(false);
    expect(mid.nmosOn && mid.pmosOn).toBe(true);
    expect(mid.current).toBeGreaterThan(0);
  });

  it("keeps NAND and NOR truth tables", () => {
    expect(cmosNand(1, 1).y).toBe(0);
    expect([cmosNand(0, 0).y, cmosNand(0, 1).y, cmosNand(1, 0).y]).toEqual([1, 1, 1]);
    expect(cmosNand(1, 1).pullDown).toBe(true);
    expect(cmosNor(0, 0).y).toBe(1);
    expect([cmosNor(0, 1).y, cmosNor(1, 0).y, cmosNor(1, 1).y]).toEqual([0, 0, 0]);
    expect(cmosNor(0, 0).pullUp).toBe(true);
    expect(cmosNor(1, 0).pullDown).toBe(true);
  });

  it("floats a disabled transmission gate and drops an NMOS high", () => {
    expect(transmissionGate(0, 1.2).vout).toBe("Z");
    expect(transmissionGate(1, 1.2).vout).toBe(1.2);
    const passed = passTransistor("nmos", 1.8, 1.8, 1.8, 0.45);
    expect(passed.degraded).toBe(true);
    expect(passed.vout).toBeCloseTo(1.35);
    expect(passTransistor("tg", 1.8, 1.8, 1.8, 0.45).vout).toBe(1.8);
    expect(triStateOutput(1, 0)).toBe("Z");
    expect(sharedWire([triStateOutput(1, 1), triStateOutput(0, 1)])).toBe("X");
  });

  it("scales dynamic power with frequency and the square of VDD", () => {
    const base = cmosPower({ vdd: 1, frequency: 1e8, alpha: 0.5, capacitance: 20e-15, celsius: 27, vth: 0.4, widthUm: 1 });
    const faster = cmosPower({ vdd: 1, frequency: 2e8, alpha: 0.5, capacitance: 20e-15, celsius: 27, vth: 0.4, widthUm: 1 });
    const higher = cmosPower({ vdd: 2, frequency: 1e8, alpha: 0.5, capacitance: 20e-15, celsius: 27, vth: 0.4, widthUm: 1 });
    expect(faster.dynamic).toBeCloseTo(base.dynamic * 2);
    expect(higher.dynamic).toBeCloseTo(base.dynamic * 4);
  });

  it("increases delay when the load grows", () => {
    const light = cmosDelay({ vdd: 1.2, vth: 0.4, capacitance: 10e-15, wn: 1, ln: 0.18, wp: 2, lp: 0.18, slew: 0 });
    const heavy = cmosDelay({ vdd: 1.2, vth: 0.4, capacitance: 40e-15, wn: 1, ln: 0.18, wp: 2, lp: 0.18, slew: 0 });
    expect(heavy.tpHL).toBeGreaterThan(light.tpHL);
    expect(heavy.tpLH).toBeGreaterThan(light.tpLH);
  });

  it("reuses the existing SR and D latch engines", () => {
    expect(latchSr(1, 0, 0)).toEqual(srNor(1, 0, 0));
    expect(latchSr(1, 1, 0)).toEqual(srNor(1, 1, 0));
    expect(latchSr(0, 0, 1)).toEqual(srNor(0, 0, 1));
    expect(latchD(1, 1, 0)).toEqual(dLatch(1, 1, 0));
    expect(latchD(0, 0, 1)).toEqual(dLatch(0, 0, 1));
  });
});
