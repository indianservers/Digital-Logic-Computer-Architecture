import { describe, expect, it } from "vitest";
import { anatomyFields, encodeAnatomy, encodeRvTeach, executeTeach, freshMachine, i32, loadStoreDemo, resolveAddress } from "./teach";

describe("ISA teaching engine", () => {
  it("adds registers and writes only the destination", () => {
    const machine = freshMachine();
    const result = executeTeach(machine, "ADD", 1, 2, 3, 0);
    expect(result.value).toBe(30);
    expect(result.next.regs[1]).toBe(30);
    expect(result.next.regs[2]).toBe(10);
    expect(machine.regs[1]).toBe(0);
  });

  it("subtracts, masks, and xors", () => {
    const machine = freshMachine();
    expect(executeTeach(machine, "SUB", 1, 3, 2, 0).value).toBe(10);
    expect(executeTeach(machine, "AND", 1, 2, 3, 0).value).toBe(0);
    expect(executeTeach(machine, "XOR", 1, 2, 3, 0).value).toBe(30);
    expect(executeTeach(machine, "ADDI", 1, 2, 0, 5).value).toBe(15);
  });

  it("loads and stores through a computed address", () => {
    const machine = freshMachine();
    machine.regs[2] = 100;
    const loaded = executeTeach(machine, "LOAD", 1, 2, 0, 8);
    expect(loaded.address).toBe(108);
    expect(loaded.next.regs[1]).toBe(255);
    const stored = executeTeach(loaded.next, "STORE", 0, 2, 1, 4);
    expect(stored.wroteMem).toBe(104);
    expect(stored.next.mem[104]).toBe(255);
    expect(stored.next.regs[1]).toBe(255);
  });

  it("encodes the 16-bit ADD strip from the same encoder as the CPU", () => {
    const word = encodeAnatomy("ADD", 1, 2, 3, 0);
    const fields = anatomyFields(word, "ADD");
    expect(fields.map((field) => field.bits).join(" ")).toBe("0001 001 010 011000");
  });

  it("encodes RISC-V ADD x1, x2, x3 as 0x003100B3", () => {
    const example = encodeRvTeach("R", 1, 2, 3, 0);
    expect(example.hex).toBe("0x003100B3");
    expect(example.fields.find((field) => field.name === "rd")?.bits).toBe("00001");
    const moved = encodeRvTeach("R", 4, 2, 3, 0);
    expect(moved.hex).not.toBe(example.hex);
    expect(moved.fields.find((field) => field.name === "rd")?.bits).toBe("00100");
  });

  it("updates I, S, and B encodings when the immediate changes", () => {
    const addi = encodeRvTeach("I", 1, 2, 0, 10);
    expect(addi.hex).toBe("0x00A10093");
    expect(encodeRvTeach("I", 1, 2, 0, 11).hex).not.toBe(addi.hex);
    expect(encodeRvTeach("S", 0, 2, 5, 8).asm).toBe("SW x5, 8(x2)");
    expect(encodeRvTeach("B", 1, 1, 2, -4).fields.find((field) => field.name === "opcode")?.bits).toBe("1100011");
  });

  it("resolves every addressing mode, including a negative offset", () => {
    const input = { literal: 42, register: 10, direct: 100, pointer: 108, base: 100, index: 4, offset: 8, mem: { 100: 42, 104: 17, 108: 255, 112: 7 } };
    expect(resolveAddress("immediate", input).value).toBe(42);
    expect(resolveAddress("immediate", input).ea).toBeNull();
    expect(resolveAddress("register", input).value).toBe(10);
    expect(resolveAddress("direct", input)).toMatchObject({ ea: 100, value: 42, memory: true });
    expect(resolveAddress("indirect", input)).toMatchObject({ ea: 108, value: 255 });
    expect(resolveAddress("base", input)).toMatchObject({ ea: 108, value: 255 });
    expect(resolveAddress("indexed", input)).toMatchObject({ ea: 112, value: 7 });
    expect(resolveAddress("base", { ...input, offset: -4 })).toMatchObject({ ea: 96, value: 0 });
    expect(i32(-1)).toBe(-1);
  });

  it("runs the load/store picture: R1 becomes 42 and Mem[104] becomes 100", () => {
    const demo = loadStoreDemo();
    expect(demo.before.regs[1]).toBe(0);
    expect(demo.after.regs[1]).toBe(42);
    expect(demo.after.mem[104]).toBe(100);
    expect(demo.after.mem[100]).toBe(42);
  });
});
