import { describe, expect, it } from "vitest";
import { CONCEPTS_113_200, CONCEPTS_201_328 } from "../data/architecture";
import { decodeMips, encodeI, encodeJ as mipsJ, encodeR, ea, branchTarget, jumpTarget, mipsControls, fieldsMips, parseMipsAsm, aluMips, assembleMips, loadMips, stepMips, writeMipsReg, readWord, writeWord, mipsPipe, blankMips } from "./isaarch/mips";
import {
  assemble, decode, encodeI as rvI, encodeJ, encodeR as rvR, encodeU, fieldsOf, immB, immI, immJ, immS, immU, loadRv, parseHexWord, runRv, stepRv, writeX,
} from "./isaarch/riscv";
import { blankA64, blankArm, neonAdd, stepArm, encodeAddReg, decodeA64, encodeLdr, encodeB, encodeBl, writeWn, loadA64, stepA64, armPipe, triggerSvc, eret } from "./isaarch/arm";
import { assembleX86, blankX86, effectiveAddress, encodeMovMem, parseExample, stepX86 } from "./isaarch/x86";
import { TASKS, runSum } from "./isaarch/compare";
import { autoMobile, thermal } from "./isaarch/mobile";
import { boost, packagePower } from "./isaarch/desktop";

describe("MIPS teaching subset", () => {
  it("encodes add $t0, $t1, $t2 as R-type 0x012A4020", () => {
    const word = encodeR(9, 10, 8, 0x20);
    expect(word).toBe(0x012A4020);
    const decoded = decodeMips(word);
    expect(decoded.format).toBe("R");
    expect(decoded.rs).toBe(9);
    expect(decoded.rt).toBe(10);
    expect(decoded.rd).toBe(8);
    expect(decoded.funct).toBe(0x20);
    expect(fieldsMips(word).map((field) => field.name)).toEqual(["opcode", "rs", "rt", "rd", "shamt", "funct"]);
  });

  it("computes load address and branch/jump targets", () => {
    expect(ea(100, 8)).toBe(108);
    expect(branchTarget(0, 3)).toBe(16);
    expect(jumpTarget(0, 0x10)).toBe(0x40);
    expect(mipsControls("lw").MemRead).toBe(1);
    expect(mipsControls("add").RegDst).toBe(1);
    expect(decodeMips(encodeI(0x23, 9, 8, 4)).mnemonic).toBe("lw");
    const add = parseMipsAsm("add $t0, $t1, $t2");
    expect("error" in add).toBe(false);
    if (!("error" in add)) expect(add.word).toBe(0x012A4020);
  });

  it("keeps $zero at 0 and maps ABI names", () => {
    expect(writeMipsReg([1, 2], 0, 99)[0]).toBe(0);
    expect(writeMipsReg([0, 0], 8, 5)[8]).toBe(5);
    const parsed = parseMipsAsm("add $t0, $t1, $t2");
    expect("error" in parsed).toBe(false);
  });

  it("encodes I-type and J-type words", () => {
    expect(decodeMips(encodeI(0x08, 0, 8, 5)).mnemonic).toBe("addi");
    expect(decodeMips(mipsJ(2, 4)).format).toBe("J");
    expect(decodeMips(mipsJ(3, 4)).mnemonic).toBe("jal");
  });

  it("computes ALU, memory, and control flow", () => {
    expect(aluMips("add", 5, 7)).toBe(12);
    expect(aluMips("sub", 7, 5)).toBe(2);
    expect(aluMips("and", 0b1100, 0b1010)).toBe(0b1000);
    expect(aluMips("or", 0b1100, 0b1010)).toBe(0b1110);
    expect(aluMips("xor", 0b1100, 0b1010)).toBe(0b0110);
    expect(aluMips("slt", -1, 1)).toBe(1);
    expect(aluMips("sll", 1, 3)).toBe(8);
    const mem = blankMips().mem;
    expect(writeWord(mem, 8, 0x11223344)).toBeNull();
    expect(readWord(mem, 8)).toBe(0x11223344);
    expect(typeof readWord(mem, 1)).toBe("string");
    const source = "addi $t0, $zero, 1\naddi $t1, $zero, 1\nbeq $t0, $t1, skip\naddi $t2, $zero, 9\nskip:\naddi $t3, $zero, 4\nj end\naddi $t3, $zero, 1\nend:\njal done\ndone:\njr $ra";
    const loaded = loadMips(source);
    expect("ok" in loaded).toBe(false);
    if (!("ok" in loaded)) {
      let cpu = loaded;
      for (let i = 0; i < 12 && !cpu.halted; i += 1) cpu = stepMips(cpu);
      expect(cpu.regs[10]).toBe(0);
      expect(cpu.regs[11]).toBe(4);
      expect(cpu.regs[31]).not.toBe(0);
    }
  });

  it("assembles labels and pseudo-instructions", () => {
    const built = assembleMips("li $t0, 5\nmove $t1, $t0\nloop:\naddi $t0, $t0, 1\nbne $t0, $t1, loop");
    expect(built.ok).toBe(true);
  });

  it("stalls a load-use hazard unless forwarding still needs one bubble", () => {
    const lines = ["lw $t0, 0($t1)", "add $t2, $t0, $t3"];
    expect(mipsPipe(lines, true).stalls).toBe(1);
    expect(mipsPipe(lines, false).stalls).toBeGreaterThan(1);
  });

  it("prints an integer and exits through the teaching syscall", () => {
    const loaded = loadMips("addi $v0, $zero, 1\naddi $a0, $zero, 42\nsyscall\naddi $v0, $zero, 10\nsyscall");
    expect("ok" in loaded).toBe(false);
    if (!("ok" in loaded)) {
      let cpu = loaded;
      for (let i = 0; i < 6 && !cpu.halted; i += 1) cpu = stepMips(cpu);
      expect(cpu.console.join("")).toContain("42");
      expect(cpu.halted).toBe(true);
    }
  });
});

describe("RV32I", () => {
  it("round-trips addi x1, x0, 5 to 0x00500093", () => {
    const built = assemble("addi x1, x0, 5");
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.words[0]).toBe(0x00500093);
    const decoded = decode(0x00500093);
    expect(decoded.mnemonic).toBe("addi");
    expect(decoded.rd).toBe(1);
    expect(decoded.rs1).toBe(0);
    expect(decoded.imm).toBe(5);
    expect(decoded.format).toBe("I");
  });

  it("encodes add x1, x2, x3 as 0x003100B3", () => {
    expect(rvR(0, 3, 2, 0, 1, 0x33)).toBe(0x003100B3);
    expect(decode(0x003100B3).mnemonic).toBe("add");
    expect(decode(0x003100B3).rd).toBe(1);
    expect(decode(0x003100B3).rs1).toBe(2);
    expect(decode(0x003100B3).rs2).toBe(3);
  });

  it("keeps x0 hardwired and runs 5+7 into x3 and memory", () => {
    expect(writeX(Array.from({ length: 32 }, () => 9), 0, 99)[0]).toBe(0);
    const state = runRv(`
      addi x1, x0, 5
      addi x2, x0, 7
      add x3, x1, x2
      sw x3, 0(x0)
      addi x0, x0, 1
    `);
    expect(state.regs[3]).toBe(12);
    expect(state.mem[0]).toBe(12);
    expect(state.regs[0]).toBe(0);
  });

  it("generates I/S/B/U/J immediates and sign-extends", () => {
    const addi = rvI(-1, 0, 0, 1, 0x13);
    expect(immI(addi)).toBe(-1);
    const sw = assemble("sw x3, -4(x1)");
    expect(sw.ok).toBe(true);
    if (sw.ok) expect(immS(sw.words[0] ?? 0)).toBe(-4);
    const beq = assemble("beq x1, x2, 8");
    expect(beq.ok).toBe(true);
    if (beq.ok) expect(immB(beq.words[0] ?? 0)).toBe(8);
    expect(immU(encodeU(0x12345000, 1, 0x37))).toBe(0x12345000);
    const jal = encodeJ(16, 1);
    expect(immJ(jal)).toBe(16);
    expect(fieldsOf("B", beq.ok ? beq.words[0] ?? 0 : 0).some((field) => field.name === "imm[12]")).toBe(true);
  });

  it("executes branches, jal/jalr, lui, and auipc", () => {
    const taken = runRv(`
      addi x1, x0, 1
      beq x1, x1, SKIP
      addi x2, x0, 9
    SKIP:
      addi x3, x0, 4
    `);
    expect(taken.regs[2]).toBe(0);
    expect(taken.regs[3]).toBe(4);
    const call = runRv(`
      jal x1, SUB
      addi x3, x0, 1
      beq x0, x0, END
    SUB:
      addi x2, x0, 7
      jalr x0, 0(x1)
    END:
      addi x4, x0, 1
    `);
    expect(call.regs[2]).toBe(7);
    expect(call.regs[3]).toBe(1);
    expect(call.regs[1]).toBe(4);
    const lui = runRv("lui x1, 1");
    expect(lui.regs[1]).toBe(0x1000);
    const auipc = loadRv("auipc x1, 1");
    if ("ok" in auipc) throw new Error(auipc.error);
    const after = stepRv(auipc);
    expect(after.regs[1]).toBe(0x1000);
    const sum = runRv(`
      addi x1, x0, 0
      addi x2, x0, 5
    LOOP:
      beq x2, x0, DONE
      add x1, x1, x2
      addi x2, x2, -1
      jal x0, LOOP
    DONE:
      addi x3, x0, 1
    `);
    expect(sum.regs[1]).toBe(15);
    const blt = runRv(`
      addi x1, x0, 1
      addi x2, x0, 4
      blt x1, x2, OK
      addi x3, x0, 9
    OK:
      addi x4, x0, 2
    `);
    expect(blt.regs[3]).toBe(0);
    expect(blt.regs[4]).toBe(2);
    const mv = assemble("mv x5, x1");
    expect(mv.ok).toBe(true);
    if (mv.ok) expect(decode(mv.words[0] ?? 0).text).toBe("addi x5, x1, 0");
  });

  it("rejects bad assembly without throwing", () => {
    expect(assemble("foo x1, x0, 1").ok).toBe(false);
    expect(assemble("addi x1, x0, 99999").ok).toBe(false);
    expect(assemble("addi x99, x0, 1").ok).toBe(false);
  });

  it("decodes hex words and round-trips slti immediates", () => {
    expect(parseHexWord("0x00500093")).toBe(0x00500093);
    expect(decode(parseHexWord("0x003100B3") ?? 0).mnemonic).toBe("add");
    const slti = assemble("slti x1, x2, -3");
    expect(slti.ok).toBe(true);
    if (slti.ok) expect(decode(slti.words[0] ?? 0).imm).toBe(-3);
  });
});

describe("ARM teaching subset", () => {
  it("adds, sets flags, loads/stores, and returns from BL", () => {
    let s = blankArm();
    s.x[1] = 5;
    s.x[2] = 3;
    s = stepArm(s, "ADD", 0, 1, 2);
    expect(s.x[0]).toBe(8);
    expect(s.flags.z).toBe(0);
    s = stepArm(s, "SUB", 0, 1, 1);
    expect(s.flags.z).toBe(1);
    s.mem[4] = 11;
    s = stepArm(s, "LDR", 3, 0, -1, 4);
    expect(s.x[3]).toBe(11);
    s = stepArm(s, "BL", 0, 0, 0, 40);
    expect(s.x[30]).toBe(s.lr);
    const ret = stepArm(s, "RET", 0, 0, 0);
    expect(ret.pc).toBe(s.lr);
    expect(neonAdd([1, 2], [3, 4])).toEqual([4, 6]);
  });

  it("zero-extends W writes and encodes ADD, LDR, and BL", () => {
    const regs = writeWn(Array.from({ length: 31 }, () => 0xffffffffffffffffn), 0, 5);
    expect(regs[0]).toBe(5n);
    expect(decodeA64(encodeAddReg(0, 1, 2)).text).toBe("ADD X0, X1, X2");
    expect(encodeAddReg(0, 1, 2)).toBe(0x8b020020);
    expect(decodeA64(encodeLdr(0, 1, 0)).mnemonic).toBe("LDR");
    expect(decodeA64(encodeB(2)).mnemonic).toBe("B");
    expect(decodeA64(encodeBl(1)).mnemonic).toBe("BL");
  });

  it("runs a branch, stalls a load-use, and returns from SVC", () => {
    const loaded = loadA64("ADD X0, X1, X2\nB skip\nADD X5, X5, X5\nskip:\nRET");
    expect("ok" in loaded).toBe(false);
    if (!("ok" in loaded)) {
      let cpu = loaded;
      cpu.x[1] = 4n;
      cpu.x[2] = 6n;
      for (let i = 0; i < 3 && !cpu.halted; i += 1) cpu = stepA64(cpu);
      expect(cpu.x[0]).toBe(10n);
      expect(cpu.x[5]).toBe(0n);
    }
    expect(armPipe(["LDR X0, [X1, #0]", "ADD X2, X0, X3"], true).stalls).toBe(1);
    const entered = triggerSvc(blankA64(), 0);
    expect(entered.el).toBe(1);
    expect(eret(entered).pc).toBe(entered.elr);
  });
});

describe("x86 teaching examples", () => {
  it("builds scaled-index addresses and parses curated fields", () => {
    expect(effectiveAddress(0x100, 3, 4, 8)).toBe(0x100 + 12 + 8);
    expect(parseExample("mov-sib")?.fields.some((field) => field.name === "SIB")).toBe(true);
    expect(parseExample("add-reg")?.bytes).toEqual([0x03, 0xc3]);
    expect(encodeMovMem(0, 1, 2, 4, 0x20).bytes).toEqual([0x48, 0x8b, 0x44, 0x8b, 0x20]);
    const program = assembleX86("xor rax, rax\nmov rcx, 1\nmov edx, 5\nloop:\nadd rax, rcx\ninc rcx\ncmp rcx, rdx\njle loop\nret");
    expect(program.ok).toBe(true);
    if (program.ok) {
      let cpu = blankX86();
      for (let i = 0; i < 40 && !cpu.halted; i += 1) cpu = stepX86(cpu, program.insns);
      expect(cpu.gpr[0]).toBe(15n);
    }
  });
});

describe("comparison, mobile, desktop", () => {
  it("compares the same add task and routes a mobile/desktop model", () => {
    expect(TASKS.add?.steps.map((item) => item.isa)).toEqual(["RISC-V", "ARM", "x86"]);
    expect(runSum([1, 2, 3, 4, 5])).toBe(15);
    expect(autoMobile("infer")?.recommend).toBe("NPU");
    expect(thermal(90, 90, 90, 40).throttle).toBe(true);
    expect(boost(1, 100, 80, 90).boost).toBeGreaterThan(3);
    expect(packagePower(8, 50, 40).total).toBeGreaterThan(0);
    expect(CONCEPTS_113_200.length).toBe(88);
    expect(CONCEPTS_201_328).toHaveLength(128);
    expect(CONCEPTS_201_328[0]?.id).toBe(201);
    expect(CONCEPTS_201_328[127]?.id).toBe(328);
    expect(CONCEPTS_201_328.every((item) => item.interactive && item.route.startsWith("/architecture/"))).toBe(true);
  });
});
