import { describe, expect, it } from "vitest";
import { Mcu } from "../core/mcu";
import { analyse, DEMO, genMux, HAL_DEMO, P15_DEFAULT, pinState, route, setup15, world15, type P15 } from "./L15sim";

function boot(src: string, p: Partial<P15> = {}) {
  const params = { ...P15_DEFAULT, ...p };
  const m = new Mcu({ ips: 120_000, strictClock: true });
  setup15(m, params);
  expect(m.load(src)).toEqual([]);
  for (let t = 0; t < 0.05; t += 0.001) { world15(m, 0.001, params); m.tick(0.001); }
  expect(m.fw?.error).toBeUndefined();
  return m;
}

describe("lab 15 pin multiplexing", () => {
  it("demo firmware routes every enabled signal with no conflicts", () => {
    const m = boot(DEMO);
    const a = analyse(m);
    expect(a.required).toEqual(expect.arrayContaining(["USART2_TX", "USART2_RX", "SPI1_SCK", "SPI1_MISO", "SPI1_MOSI", "I2C1_SCL", "I2C1_SDA", "TIM2_CH1"]));
    expect(pinState(m, "PA2").signal).toBe("USART2_TX");
    expect(pinState(m, "PB6").signal).toBe("I2C1_SCL");
    expect(a.issues).toEqual([]);
  });

  it("PWM only reaches a pin whose AF selects the timer", () => {
    const m = boot(DEMO);
    expect(m.pwmInfo("PA0")?.duty).toBeCloseTo(0.25, 2);
    route(m, "PA0", 2, 2);
    expect(m.pwmInfo("PA0")).toBeUndefined();
  });

  it("stealing PA5 for TIM2_CH1 leaves SPI1_SCK unrouted and offers a fix", () => {
    const m = boot(DEMO);
    route(m, "PA5", 2, 1);
    const a = analyse(m);
    const miss = a.issues.find((i) => i.text.includes("SPI1_SCK is not routed"));
    expect(miss?.sev).toBe("error");
    expect(miss?.fix).toEqual({ label: "Route SPI1_SCK to PA5 (AF5)", pin: "PA5", mode: 2, af: 5 });
    expect(a.issues.some((i) => i.text.startsWith("TIM2_CH1 drives"))).toBe(true);
    route(m, "PA5", 2, 5);
    expect(analyse(m).issues).toEqual([]);
  });

  it("an input signal on two pins is an error; a dead AF disconnects the pin", () => {
    const m = boot(DEMO);
    route(m, "PB8", 2, 4);
    route(m, "PA1", 2, 5);
    const a = analyse(m);
    expect(a.issues.find((i) => i.text.startsWith("I2C1_SCL is an input"))?.sev).toBe("error");
    const dead = a.issues.find((i) => i.text.startsWith("PA1 selects AF5"));
    expect(dead?.fix?.mode).toBe(0);
  });

  it("faults: gated SPI clock and push-pull I2C pins are reported", () => {
    const m = boot(DEMO, { spiGated: true, i2cPushPull: true });
    const a = analyse(m);
    expect(a.issues.some((i) => i.text.includes("I2C lines must be open-drain"))).toBe(true);
    expect(a.required.includes("SPI1_SCK")).toBe(false);
  });

  it("regenerates the pin-mux block from the live registers", () => {
    const m = boot(DEMO);
    route(m, "PA0", 0);
    route(m, "PA1", 2, 1);
    const next = genMux(m, DEMO)!;
    expect(next).toContain("PA1 AF1 = TIM2_CH2");
    expect(next).not.toContain("PA0 AF1");
    const m2 = boot(next);
    expect(pinState(m2, "PA1").signal).toBe("TIM2_CH2");
  });

  it("HAL GPIO_AF7_USART2 routes PA2/PA3", () => {
    const m = boot(HAL_DEMO);
    expect(pinState(m, "PA3").signal).toBe("USART2_RX");
    expect(analyse(m).issues).toEqual([]);
  });
});
