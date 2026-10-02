import { describe, expect, it } from "vitest";
import { compileThumb, LR, SP, ThumbCpu } from "./thumb";

const run = (src: string, faults = {}, limit = 5000) => {
  const prog = compileThumb(src);
  expect(prog.diagnostics).toEqual([]);
  const cpu = new ThumbCpu(prog);
  for (let i = 0; i < limit && !cpu.stopped; i++) cpu.step(i, faults);
  return { prog, cpu };
};
const local = (cpu: ThumbCpu, name: string) => {
  for (const [addr, tag] of cpu.tags) if (tag === `main: ${name}`) return cpu.read(addr) | 0;
  return undefined;
};

describe("Thumb stack lab compiler + CPU", () => {
  it("calls a function, returns through LR and stores the result", () => {
    const { prog, cpu } = run(`int add_numbers(int x) {\n  return x + 3;\n}\nint main(void) {\n  int result = add_numbers(5);\n  while (1) {\n  }\n}\n`);
    expect(prog.ins.some((i) => i.text.startsWith("BL    add_numbers"))).toBe(true);
    expect(cpu.halted).toContain("while (1)");
    expect(local(cpu, "result")).toBe(8);
    expect(cpu.r[SP]).toBe(0x20000400 - 8);
    expect(cpu.maxDepth).toBe(2);
    expect(cpu.log.some((l) => l.kind === "ret" && l.text.includes("add_numbers"))).toBe(true);
  });

  it("handles recursion with nested return addresses", () => {
    const { cpu } = run(`int factorial(int n) {\n  if (n <= 1) {\n    return 1;\n  }\n  return n * factorial(n - 1);\n}\nint main(void) {\n  int result = factorial(5);\n  while (1) {\n  }\n}\n`);
    expect(local(cpu, "result")).toBe(120);
    expect(cpu.maxDepth).toBe(6);
    expect(cpu.calls.length).toBe(1);
  });

  it("supports loops, multiple params and temporaries across calls", () => {
    const { cpu } = run(`int square(int v) { return v * v; }\nint sum_squares(int a, int b) { return square(a) + square(b); }\nint main(void) {\n  int total = 0;\n  for (int i = 0; i < 3; i++) {\n    total += sum_squares(i, 4);\n  }\n  while (1) {}\n}\n`);
    expect(local(cpu, "total")).toBe(0 + 1 + 4 + 3 * 16);
  });

  it("raises a stack overflow HardFault for runaway recursion", () => {
    const { cpu } = run(`int down(int n) { return down(n + 1); }\nint main(void) {\n  int r = down(0);\n  while (1) {}\n}\n`);
    expect(cpu.fault).toContain("stack overflow");
  });

  it("faults when the saved return address is corrupted", () => {
    const { cpu } = run(`int add_numbers(int x) { return x + 3; }\nint main(void) {\n  int result = add_numbers(5);\n  while (1) {}\n}\n`, { corruptLr: true });
    expect(cpu.fault || cpu.log.some((l) => l.text.includes("unexpected"))).toBeTruthy();
    expect(cpu.r[LR]).not.toBe(0);
  });

  it("reports unsupported constructs as build diagnostics", () => {
    expect(compileThumb(`int g = 1;\nint main(void) { while (1) {} }\n`).diagnostics[0]?.message).toContain("Global");
    expect(compileThumb(`int main(void) { printf("x"); while (1) {} }\n`).diagnostics[0]?.message).toContain("not defined");
  });
});
