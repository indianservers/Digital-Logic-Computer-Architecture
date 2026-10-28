import { describe, expect, it } from "vitest";
import { a64Condition, assembleA64, blankA64, decodeA64, enterA64Exception, eret, loadA64, stepA64, triggerSvc } from "./arm";
function loaded(source: string) { const c = loadA64(source); if ("ok" in c) throw Error(c.error); return c; }
function run(source: string, a = 0n, b = 0n) { let c = loaded(source); c.x[1] = a; c.x[2] = b; for (let i = 0; i < 64 && !c.halted; i++) c = stepA64(c); return c; }
describe("A64 executable flags", () => {
  it.each([
    ["ADDS", 0xffffffffffffffffn, 1n, 0n, { n: 0, z: 1, c: 1, v: 0 }],
    ["ADDS", 0x7fffffffffffffffn, 1n, 0x8000000000000000n, { n: 1, z: 0, c: 0, v: 1 }],
    ["ADDS", 0x8000000000000000n, 0x8000000000000000n, 0n, { n: 0, z: 1, c: 1, v: 1 }],
    ["SUBS", 0n, 1n, 0xffffffffffffffffn, { n: 1, z: 0, c: 0, v: 0 }],
    ["SUBS", 0x8000000000000000n, 1n, 0x7fffffffffffffffn, { n: 0, z: 0, c: 1, v: 1 }],
    ["SUBS", 7n, 7n, 0n, { n: 0, z: 1, c: 1, v: 0 }],
  ])("executes %s with exact NZCV", (op, a, b, result, flags) => { const c = run(`${op} X0, X1, X2`, a, b); expect(c.x[0]).toBe(result); expect(c.flags).toEqual(flags); });
  it("executes W arithmetic with 32-bit flags and zero extension", () => { const c = run("ADDS W0, W1, W2", 0xffffffffffffffffn, 1n); expect(c.x[0]).toBe(0n); expect(c.flags).toEqual({ n: 0, z: 1, c: 1, v: 0 }); });
  it("preserves flags on ADD and discards CMP result", () => { const c = run("CMP X1, X1\nADD X0, X1, X2", 7n, 2n); expect(c.x[0]).toBe(9n); expect(c.x[1]).toBe(7n); expect(c.flags).toEqual({ n: 0, z: 1, c: 1, v: 0 }); });
  it("executes taken and not-taken conditional branches", () => {
    const source = "CMP X1, X2\nB.EQ equal\nMOV X3, #7\nB end\nequal: MOV X3, #9\nend: NOP";
    expect(run(source, 1n, 1n).x[3]).toBe(9n); expect(run(source, 1n, 2n).x[3]).toBe(7n);
  });
  it("implements every supported condition for all NZCV combinations", () => {
    for (let bits = 0; bits < 16; bits++) {
      const n = !!(bits & 8), z = !!(bits & 4), c = !!(bits & 2), v = !!(bits & 1);
      const f = { n: +n, z: +z, c: +c, v: +v } as ReturnType<typeof blankA64>["flags"];
      const expected = [z,!z,c,!c,n,!n,v,!v,c&&!z,!c||z,n===v,n!==v,!z&&n===v,z||n!==v,true,true];
      expected.forEach((value, i) => expect(a64Condition(i, f)).toBe(value));
    }
  });
  it("executes immediate MOV and ADD without silently discarding operands", () => { expect(run("MOV X1, #42\nADD X0, X1, #7").x[0]).toBe(49n); });
});
describe("A64 memory execution", () => {
  it("stores all 64 bits little-endian and loads them back", () => {
    let c = loaded("STR X0, [X1, #0]\nLDR X2, [X1, #0]"); c.x[0] = 0xfedcba9876543210n; c.x[1] = 256n;
    c = stepA64(c); expect(Array.from(c.mem.slice(256,264))).toEqual([16,50,84,118,152,186,220,254]);
    c = stepA64(c); expect(c.x[2]).toBe(0xfedcba9876543210n); expect(c.x[1]).toBe(256n);
  });
  it.each([['[X1, #8]!',264,264], ['[X1], #8',256,264], ['[X1, #-8]!',248,248]])("executes %s addressing", (mode, address, base) => {
    let c = loaded(`STR X0, ${mode}`); c.x[0] = 42n; c.x[1] = 256n; c = stepA64(c);
    expect(c.mem[address]).toBe(42); expect(c.x[1]).toBe(BigInt(base)); expect(c.retired).toBe(1);
  });
  it("uses SP as a memory base and restores a 16-byte frame", () => {
    const c = run("MOV X0, #42\nSUB SP, SP, #16\nSTR X0, [SP, #0]\nLDR X2, [SP, #0]\nADD SP, SP, #16");
    expect(c.x[2]).toBe(42n); expect(c.sp).toBe(0x400n); expect(c.mem[0x3f0]).toBe(42);
  });
  it.each([257n, 4088n, 0xffffffffffffffffn])("faults atomically at base %s", base => {
    const c = loaded("LDR X2, [X1, #8]!"); c.x[1] = base; c.x[2] = 123n;
    const next = stepA64(c); expect(next.halted).toBe(true); expect(next.x).toEqual(c.x); expect(next.mem).toEqual(c.mem); expect(next.pc).toBe(0); expect(next.retired).toBe(0);
  });
});
describe("A64 exceptions", () => {
  it("decodes SVC using an unsigned mask and executes a real handler/ERET", () => {
    let c = loaded("SVC #42\nMOV X3, #7"); c.flags = { n: 1, z: 0, c: 1, v: 1 };
    const h = assembleA64("SUBS X8, X8, X8\nADD X9, X9, #1\nERET"); if (!h.ok) throw Error("handler");
    h.words.forEach((w,i) => { for (let j=0;j<4;j++) c.mem[0xc00+i*4+j] = (w >>> (8*j)) & 255; });
    c = stepA64(c); expect(c.pc).toBe(0xc00); expect(c.elr).toBe(4); expect(c.el).toBe(1); expect(c.spsr).toBe(0xb0000000); expect(c.esr).toBe(0x5600002a);
    c = stepA64(c); expect(c.flags.z).toBe(1); c = stepA64(c); c = stepA64(c);
    expect(c.el).toBe(0); expect(c.pc).toBe(4); expect(c.flags).toEqual({n:1,z:0,c:1,v:1}); expect(c.x[9]).toBe(1n);
    c = stepA64(c); expect(c.x[3]).toBe(7n); expect(c.retired).toBe(5);
  });
  it.each([['IRQ',0x480],['FIQ',0x500],['SError',0x580]] as const)("injects %s at its distinct vector and resumes current PC", (kind, offset) => {
    const c = blankA64(); c.pc=12; c.esr=123; const next=enterA64Exception(c,kind);
    expect(next.pc).toBe(c.vbar+offset); expect(next.elr).toBe(12); expect(next.esr).toBe(123); expect(eret(next).pc).toBe(12);
  });
  it("saves EL1h and uses current-level vector offsets", () => { const c=blankA64();c.el=1;const next=triggerSvc(c,5);expect(next.spsr&15).toBe(5);expect(next.pc).toBe(0xa00);expect(eret(next).el).toBe(1); });
  it("rejects ERET at EL0, nesting, and unsupported EL2/EL3 routing", () => {
    expect(eret(blankA64()).halted).toBe(true); expect(triggerSvc(triggerSvc(blankA64())).halted).toBe(true);
    const c=blankA64();c.el=2;expect(triggerSvc(c).halted).toBe(true);
  });
  it("decodes ERET and does not mutate source state", () => { const c=loaded("SVC #1");const next=stepA64(c);expect(decodeA64(0xd69f03e0).mnemonic).toBe("ERET");expect(c.pc).toBe(0);expect(c.el).toBe(0);expect(next.pc).toBe(0xc00); });
});
describe("A64 assembly validation", () => {
  it.each(["ADD X0, X1, #4096","MOV X0, #65536","ADD X0, W1, W2","LDR X0, [X1, #3]","STR X0, [X1, #-8]","LDR X1, [X1], #8","SVC #65536","B.EQ missing","B.NOPE 1","MOV X0, #bad","RET X1","here: NOP\nhere: NOP"])("rejects %s", source => { expect(assembleA64(source).ok).toBe(false); });
  it("reports physical source line numbers", () => { const built=assembleA64("// comment\n\nMOV X0, #999999");expect(built.ok).toBe(false);if(!built.ok)expect(built.errors[0]).toContain("Line 3:"); });
});
