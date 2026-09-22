import { u32 } from "./bits";
import { vectorAdd } from "../arch/parallel";

export const ARM_REGS = Array.from({ length: 31 }, (_, index) => ({
  id: `X${index}`,
  role: index === 30 ? "Link register (LR / X30) in this teaching view" : "General-purpose 64-bit register (teaching AArch64 view)",
}));

export type ArmMnemonic = "ADD" | "SUB" | "LDR" | "STR" | "B" | "BL" | "RET" | "MOV";

export interface ArmState {
  x: number[];
  sp: number;
  pc: number;
  lr: number;
  flags: { n: 0 | 1; z: 0 | 1; c: 0 | 1; v: 0 | 1 };
  mem: number[];
  trace: string[];
}

export function blankArm(): ArmState {
  return { x: Array.from({ length: 31 }, () => 0), sp: 0x100, pc: 0, lr: 0, flags: { n: 0, z: 1, c: 0, v: 0 }, mem: Array.from({ length: 64 }, () => 0), trace: [] };
}

function flagsFrom(result: number, a: number, b: number, sub: boolean): ArmState["flags"] {
  const r = result | 0;
  const aa = a | 0;
  const bb = b | 0;
  const n = r < 0 ? 1 : 0;
  const z = r === 0 ? 1 : 0;
  const unsigned = sub ? u32(a) < u32(b) : u32(a) + u32(b) > 0xffffffff;
  const c = unsigned ? (sub ? 0 : 1) : (sub ? 1 : 0);
  const v = sub ? ((aa < 0) !== (bb < 0) && (r < 0) !== (aa < 0) ? 1 : 0) : ((aa < 0) === (bb < 0) && (r < 0) !== (aa < 0) ? 1 : 0);
  return { n, z, c, v };
}

export function stepArm(state: ArmState, op: ArmMnemonic, rd: number, rn: number, rm: number, imm = 0): ArmState {
  const next: ArmState = { ...state, x: state.x.slice(), mem: state.mem.slice(), flags: { ...state.flags }, trace: state.trace.slice() };
  const a = next.x[rn] ?? 0;
  const b = op === "MOV" || op === "LDR" || op === "STR" || op === "ADD" && imm !== 0 && rm < 0 ? imm : (next.x[rm] ?? 0);
  if (op === "ADD") {
    const result = u32(a + (rm < 0 ? imm : b));
    if (rd >= 0 && rd < 31) next.x[rd] = result;
    next.flags = flagsFrom(result, a, rm < 0 ? imm : b, false);
    next.trace.push(`ADD X${rd}, X${rn}, ${rm < 0 ? `#${imm}` : `X${rm}`}`);
  } else if (op === "SUB") {
    const result = u32(a - b);
    if (rd >= 0 && rd < 31) next.x[rd] = result;
    next.flags = flagsFrom(result, a, b, true);
    next.trace.push(`SUB X${rd}, X${rn}, X${rm}`);
  } else if (op === "MOV") {
    if (rd >= 0 && rd < 31) next.x[rd] = u32(imm);
    next.trace.push(`MOV X${rd}, #${imm}`);
  } else if (op === "LDR") {
    const addr = u32(a + imm);
    const word = next.mem[addr] ?? 0;
    if (rd >= 0 && rd < 31) next.x[rd] = word;
    next.trace.push(`LDR X${rd}, [X${rn}, #${imm}]  EA=${addr}`);
  } else if (op === "STR") {
    const addr = u32(a + imm);
    if (addr >= 0 && addr < next.mem.length) next.mem[addr] = next.x[rd] ?? 0;
    next.trace.push(`STR X${rd}, [X${rn}, #${imm}]  EA=${addr}`);
  } else if (op === "B") {
    next.pc = imm;
    next.trace.push(`B ${imm}`);
    return next;
  } else if (op === "BL") {
    next.lr = next.pc + 4;
    next.x[30] = next.lr;
    next.pc = imm;
    next.trace.push(`BL ${imm}  LR=${next.lr}`);
    return next;
  } else if (op === "RET") {
    next.pc = next.lr || (next.x[30] ?? 0);
    next.trace.push(`RET to ${next.pc}`);
    return next;
  }
  next.pc += 4;
  return next;
}

export function neonAdd(left: number[], right: number[]): number[] {
  return vectorAdd(left, right);
}

export const EL_LEVELS = [
  { id: "EL0", title: "Application", note: "User programs run here in the teaching model." },
  { id: "EL1", title: "OS kernel", note: "Typical operating-system privilege." },
  { id: "EL2", title: "Hypervisor", note: "Optional virtualization layer." },
  { id: "EL3", title: "Secure monitor", note: "Highest conceptual exception level in AArch64." },
];

export const ARM_SOC_BLOCKS = ["CPU cluster", "GPU", "NPU", "ISP", "DSP", "Memory", "I/O"];
