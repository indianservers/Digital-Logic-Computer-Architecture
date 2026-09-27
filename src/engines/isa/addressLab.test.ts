import { describe, expect, it } from "vitest";
import { commitAddr, freshAddr, resolveBaseOffset, resolveDirect, resolveImmediate, resolveIndexed, resolveIndirect, resolveRegister, resolveRegisterIndirect, viewAddr } from "./addressLab";

describe("addressing-mode lab", () => {
  it("adds an immediate to a source register", () => {
    const state = freshAddr("immediate");
    state.regs[1] = 10;
    state.rs1 = 1;
    state.imm = 5;
    state.rd = 2;
    expect(resolveImmediate(10, 5)).toBe(15);
    expect(viewAddr("immediate", state).operand).toBe(15);
    const written = commitAddr("immediate", state);
    expect(written?.regs[2]).toBe(15);
    expect(written?.regs[1]).toBe(10);
  });

  it("adds two registers", () => {
    const state = freshAddr("register");
    state.regs[1] = 10;
    state.regs[2] = 20;
    state.rs1 = 1;
    state.rs2 = 2;
    state.rd = 3;
    expect(resolveRegister("ADD", 10, 20)).toBe(30);
    expect(viewAddr("register", state)).toMatchObject({ operand: 30, ea: null, memAccess: false });
  });

  it("loads the memory word named by a direct address", () => {
    const mem = { 100: 255 };
    expect(resolveDirect(100, mem)).toEqual({ ea: 100, value: 255 });
    const state = freshAddr("direct");
    state.mem = { ...state.mem, 100: 255 };
    expect(viewAddr("direct", state)).toMatchObject({ ea: 100, operand: 255 });
  });

  it("follows a memory pointer, and can also follow a register pointer", () => {
    const mem = { 100: 200, 200: 123 };
    expect(resolveIndirect(100, mem)).toEqual({ pointer: 200, ea: 200, value: 123 });
    expect(resolveRegisterIndirect(200, mem)).toEqual({ ea: 200, value: 123 });
    const state = freshAddr("indirect");
    expect(viewAddr("indirect", state)).toMatchObject({ ea: 200, operand: 123 });
    expect(viewAddr("indirect", state).ea).not.toBe(viewAddr("indirect", state).operand);
  });

  it("adds a base and a signed offset, including a negative offset", () => {
    const mem = { 108: 77, 96: 5 };
    expect(resolveBaseOffset(100, 8, mem)).toEqual({ ea: 108, value: 77 });
    expect(resolveBaseOffset(100, -4, mem)).toEqual({ ea: 96, value: 5 });
    const state = freshAddr("base-offset");
    const view = viewAddr("base-offset", state);
    expect(view.ea).toBe(108);
    expect(view.operand).toBe(77);
    expect(view.equation).toBe("100 + 8 = 108");
  });

  it("adds base, index, and an optional offset", () => {
    const mem = { 112: 99, 116: 4 };
    expect(resolveIndexed(100, 12, 0, mem)).toEqual({ ea: 112, value: 99 });
    expect(resolveIndexed(100, 12, 4, mem)).toEqual({ ea: 116, value: 4 });
    const state = freshAddr("indexed");
    expect(viewAddr("indexed", state)).toMatchObject({ ea: 112, operand: 55 });
  });

  it("refuses an immediate that does not fit in 12 bits and never writes x0", () => {
    const state = freshAddr("immediate");
    state.imm = 3000;
    expect(viewAddr("immediate", state).error).toBeTruthy();
    expect(commitAddr("immediate", state)).toBeNull();
    state.imm = 10;
    state.rd = 0;
    const written = commitAddr("immediate", state);
    expect(written?.regs[0]).toBe(0);
  });

  it("matches the six mockup resting examples", () => {
    expect(viewAddr("immediate", freshAddr("immediate"))).toMatchObject({ assembly: "ADDI x5, x3, 10", operand: 35, ea: null });
    expect(viewAddr("register", freshAddr("register"))).toMatchObject({ assembly: "ADD x5, x1, x2", operand: 42 });
    expect(viewAddr("direct", freshAddr("direct"))).toMatchObject({ assembly: "LW x5, 100", ea: 100, operand: 250 });
    expect(viewAddr("indirect", freshAddr("indirect")).loaded).toContain("123");
    expect(viewAddr("base-offset", freshAddr("base-offset")).assembly).toBe("LW x5, 8(x2)");
    expect(viewAddr("indexed", freshAddr("indexed")).assembly).toBe("LW x5, 0(x2, x3)");
  });
});
