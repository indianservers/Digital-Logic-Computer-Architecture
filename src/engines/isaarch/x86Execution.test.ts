import { describe, expect, it } from "vitest";
import { assembleX86, blankX86, disassembleBytes, stepX86 } from "./x86";
function run(source: string) {
  const built = assembleX86(source);
  if (!built.ok) throw new Error(built.errors.join("\n"));
  let cpu = blankX86();
  for (let i = 0; i < 200 && !cpu.halted; i++) cpu = stepX86(cpu, built.insns);
  return { cpu, insns: built.insns };
}
describe("x86 executable subset", () => {
  it("executes JMP, case-insensitive labels and signed conditional loops", () => {
    expect(run("mov eax, 7\njmp Done\nmov eax, 99\nDone:\nret").cpu.gpr[0]).toBe(7n);
    const { cpu } = run("xor rax, rax\nmov rcx, 1\nmov edx, 5\nloop:\nadd rax, rcx\ninc rcx\ncmp rcx, rdx\njle loop\nret");
    expect(cpu.halted).toBe(true); expect(cpu.gpr[0]).toBe(15n);
  });
  it("executes 32-bit arithmetic at its actual width and zero-extends writeback", () => {
    const { cpu } = run("mov eax, 4294967295\ninc eax\nret");
    expect(cpu.gpr[0]).toBe(0n); expect(cpu.flags.zf).toBe(1);
    expect(run("mov eax, 2147483647\ninc eax\nret").cpu.flags.of).toBe(1);
  });
  it("encodes complete immediates and REX extensions, and decodes the emitted instruction", () => {
    for (const [source, bytes, decoded] of [
      ["mov eax, 305419896", [0xb8, 0x78, 0x56, 0x34, 0x12], "mov eax, 305419896"],
      ["mov r8, -1", [0x49, 0xc7, 0xc0, 0xff, 0xff, 0xff, 0xff], "mov r8, -1"],
      ["add r8d, r9d", [0x45, 0x01, 0xc8], "add r8d, r9d"],
    ] as const) {
      const built = assembleX86(source); expect(built.ok).toBe(true);
      if (built.ok) { expect(built.insns[0]?.bytes).toEqual(bytes); expect(disassembleBytes(bytes.map(b=>b.toString(16).padStart(2,"0")).join(" "))).toBe(decoded); }
    }
    expect(run("mov r8d, 42\nmov eax, r8d\nret").cpu.gpr[0]).toBe(42n);
    expect(run("mov r8, -1\nmov rax, r8\nret").cpu.gpr[0]).toBe(0xffffffffffffffffn);
  });
  it("rejects unsupported or ambiguous assembly and incomplete decoding", () => {
    for (const source of ["", "mov eax, rax", "mov rax, 4294967295", "mov eax, nope", "ret rax", "jmp nowhere", "same:\nsame:\nret"]) expect(assembleX86(source).ok, source).toBe(false);
    expect(assembleX86("jmp far\n" + "mov rax, 0\n".repeat(20) + "far:\nret").ok).toBe(false);
    for (const hex of ["48 89", "C3 AA", "48 89 D8 FF", "zz", "123"]) expect(disassembleBytes(hex)).toMatch(/Unsupported|Enter/);
  });
});
