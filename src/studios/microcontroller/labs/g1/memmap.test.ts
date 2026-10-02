import { describe, expect, it } from "vitest";
import { buildLayout, MAP, regionOf } from "./memmap";

const SRC = `#include "stm32f1xx_hal.h"
const uint16_t table[4] = {1, 2, 3, 4};
uint32_t counter = 7;
uint8_t buffer[10];
typedef struct { uint32_t a; uint8_t b; } Cfg_t;
Cfg_t cfg;
int main(void) { HAL_Init(); counter++; while (1) { HAL_Delay(10); } }
`;

describe("memory layout", () => {
  it("places const data in Flash, initialised globals in .data and zeroed ones in .bss", () => {
    const l = buildLayout(SRC);
    const g = Object.fromEntries(l.globals.map((x) => [x.name, x]));
    expect(g.table!.section).toBe(".rodata");
    expect(regionOf(g.table!.addr)).toBe("flash");
    expect(g.counter!.section).toBe(".data");
    expect(g.counter!.addr).toBe(MAP.sram.base);
    expect(g.buffer!.section).toBe(".bss");
    expect(g.cfg!.size).toBe(8);
    expect(g.cfg!.addr % 4).toBe(0);
    expect(l.sramStatic).toBeGreaterThanOrEqual(4 + 10 + 8);
  });

  it("builds an image with a valid vector table and the const table bytes", () => {
    const l = buildLayout(SRC);
    const word = (off: number) => l.image[off]! | (l.image[off + 1]! << 8) | (l.image[off + 2]! << 16) | (l.image[off + 3]! * 2 ** 24);
    expect(word(0)).toBe(MAP.sram.base + MAP.sram.size);
    expect(word(4) & 1).toBe(1);
    const t = l.globals.find((x) => x.name === "table")!;
    const off = t.addr - MAP.flash.base;
    expect(l.image.slice(off, off + 8)).toEqual([1, 0, 2, 0, 3, 0, 4, 0]);
    expect(l.flashUsed).toBe(l.image.length);
  });
});
