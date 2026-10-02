import { describe, expect, it } from "vitest";
import { Mcu } from "../core/mcu";
import { applyClocks, clockHook, hseFailure, liveClocks, newClockState } from "./clocklab";
import { DEMO, HSI_ONLY } from "./L10code";
import { parseDraft, RCC_CONST, withClockConfig } from "./rcc";

function boot(src: string, opts: { hseDead?: boolean; crystal?: number } = {}) {
  const draft = parseDraft(src);
  const st = newClockState(opts.crystal ?? draft.hseValue, draft.hseValue);
  st.hseDead = !!opts.hseDead;
  const m = new Mcu({ part: "F103", onCall: clockHook(st), constants: RCC_CONST });
  applyClocks(m, st);
  const diags = m.load(src);
  expect(diags).toEqual([]);
  applyClocks(m, st);
  return { m, st };
}
const toggles = (m: Mcu, t0: number) => (m.edges.get("PA5") ?? []).filter(([t]) => t >= t0).length;

describe("lab 10 clock system", () => {
  it("parses and regenerates SystemClock_Config", () => {
    const d = parseDraft(DEMO);
    expect(d.found).toBe(true);
    expect(d.cfg).toMatchObject({ hseOn: true, pllOn: true, pllSrc: "HSE", pllMul: 9, sysSrc: "PLL", apb1Div: 2, apb2Div: 1, adcDiv: 6, latency: 2 });
    const next = withClockConfig(DEMO, { ...d.cfg, pllMul: 6, latency: 1 }, 12_000_000)!;
    expect(parseDraft(next).cfg).toMatchObject({ pllMul: 6, latency: 1 });
    expect(parseDraft(next).hseValue).toBe(12_000_000);
  });

  it("brings the tree to 72 MHz and the HAL reports it", () => {
    const { m, st } = boot(DEMO);
    m.tick(0.05);
    expect(m.fw?.error).toBeUndefined();
    const k = liveClocks(st);
    expect(k.sys).toBe(72e6);
    expect(k.pclk1).toBe(36e6);
    expect(k.tim1x).toBe(72e6);
    expect(k.adc).toBe(12e6);
    expect(m.fw?.field("sysclk")).toBe(72_000_000);
    const t0 = m.time;
    m.tick(2);
    expect(toggles(m, t0)).toBeGreaterThanOrEqual(3);
    expect(toggles(m, t0)).toBeLessThanOrEqual(5);
  });

  it("HSI-only firmware runs the timer 9x slower", () => {
    const { m, st } = boot(HSI_ONLY);
    m.tick(0.05);
    expect(liveClocks(st).sys).toBe(8e6);
    const t0 = m.time;
    m.tick(2);
    expect(toggles(m, t0)).toBe(0);
  });

  it("dead crystal makes OscConfig time out into Error_Handler", () => {
    const { m, st } = boot(DEMO, { hseDead: true });
    m.tick(0.3);
    expect(st.cfg.sysSrc).toBe("HSI");
    expect(m.fw?.field("sysclk") ?? 0).toBe(0);
    expect(m.events.some((e) => e.text.includes("HAL_TIMEOUT"))).toBe(true);
  });

  it("too few flash wait states hard-faults; CSS rescues an HSE failure", () => {
    const low = withClockConfig(DEMO, { ...parseDraft(DEMO).cfg, latency: 0 }, 8e6)!;
    const a = boot(low);
    a.m.tick(0.05);
    expect(a.m.fw?.error?.message).toMatch(/wait state/);

    const b = boot(DEMO);
    b.m.tick(0.05);
    b.st.hseDead = true;
    hseFailure(b.m, b.st);
    expect(liveClocks(b.st).sys).toBe(8e6);
    b.m.tick(0.05);
    expect(b.m.fw?.error).toBeUndefined();
  });
});
