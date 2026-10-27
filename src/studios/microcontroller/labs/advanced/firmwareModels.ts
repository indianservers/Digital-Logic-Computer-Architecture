import { compileThumb, ThumbCpu } from "../g1/thumb";
import { base, check, copy, event, hex, metric, num, range, sample, toggle, yes, type Model, type Simulation } from "./model";

export function crc32(bytes: number[]): number {
  let crc = 0xffffffff;
  for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}
export function firmwareImage(version: number, validVectors = true): number[] {
  const image = Array.from({ length: 32 }, (_, i) => (version * 19 + i * 7) & 255);
  const vectors = [validVectors ? 0x20002000 : 0, 0x08004009];
  vectors.forEach((word, index) => { for (let b = 0; b < 4; b++) image[index * 4 + b] = (word >>> (8 * b)) & 255; });
  return image;
}
function vectorsValid(bytes: number[]) {
  const word = (at: number) => ((bytes[at]! | bytes[at + 1]! << 8 | bytes[at + 2]! << 16 | bytes[at + 3]! << 24) >>> 0);
  const sp = word(0), entry = word(4);
  return sp >= 0x20000000 && sp <= 0x20010000 && sp % 8 === 0 && !!(entry & 1) && (entry & ~1) >= 0x08004000 && (entry & ~1) < 0x08004020;
}
export const bootloader: Model = {
  number: 50, subtitle: "Write the inactive flash bank. Verify before switching boot metadata.", objective: "Complete a CRC-checked dual-bank update and preserve the old application after a power cut.",
  defaults: { version: 2, corrupt: false, vectors: true }, controls: [range("version", "Incoming version", 2, 9), toggle("corrupt", "Next image: corrupt transport byte", true), toggle("vectors", "Next image: valid stack/reset vectors", true)], stepMs: 1,
  plots: [{ label: "Programmed bytes", min: 0, max: 32 }, { label: "Active bank B", min: 0, max: 1 }],
  create: () => base({ activeBank: 0, activeVersion: 1, offset: 0, updating: 0, committed: 0, rejected: 0, powerCuts: 0, expectedCRC: 0, actualCRC: 0 }, [...firmwareImage(1), ...new Array<number>(32).fill(255)]),
  action: (s, p, action) => {
    const o = copy(s), v = o.values;
    if (action === "start") { const target = 1 - v.activeBank!; o.memory.fill(255, target * 32, target * 32 + 32); v.targetBank = target; v.offset = 0; v.updating = 1; v.expectedCRC = crc32(firmwareImage(num(p, "version"), yes(p, "vectors"))); v.imageVersion = num(p, "version"); v.corruptImage = +yes(p, "corrupt"); v.validVectors = +yes(p, "vectors"); o.finished = false; o.phase = "Inactive bank erased"; event(o, "Erase inactive bank", "Active boot metadata remains unchanged"); }
    if (action === "cut") { v.updating = 0; v.powerCuts!++; o.phase = "Power restored: boot old committed application"; event(o, "Power cut", "Partial image ignored; active version " + v.activeVersion); }
    return o;
  },
  actions: [{ id: "start", label: "Begin firmware update" }, { id: "cut", label: "Cut power & reboot" }],
  step: (s, _p, ms) => {
    const o = copy(s), v = o.values;
    for (let i = 0; i < ms; i++) {
      o.time++;
      if (v.updating) {
        const image = firmwareImage(v.imageVersion!, !!v.validVectors), start = v.targetBank! * 32;
        for (let b = 0; b < 4 && v.offset! < 32; b++) { const at = v.offset!++; let byte = image[at]!; if (v.corruptImage && at === 15) byte ^= 1; o.memory[start + at] = o.memory[start + at]! & byte; }
        event(o, "Flash program", "Inactive bank: " + v.offset + "/32 bytes");
        if (v.offset === 32) {
          const written = o.memory.slice(start, start + 32); v.actualCRC = crc32(written); v.updating = 0;
          if (v.actualCRC === v.expectedCRC && vectorsValid(written)) { v.activeBank = v.targetBank!; v.activeVersion = v.imageVersion!; v.committed!++; o.phase = "Verified image committed atomically"; event(o, "Boot commit", "CRC and vectors valid; active bank switched"); }
          else { v.rejected!++; o.phase = "Image rejected; old application retained"; event(o, "Validation rejected", v.actualCRC !== v.expectedCRC ? "CRC mismatch" : "Invalid stack/reset vectors"); }
        }
      }
      sample(o, v.offset!, v.activeBank!);
    }
    return o;
  },
  metrics: (s) => [metric("Active version", s.values.activeVersion!), metric("Active bank", s.values.activeBank ? "B" : "A"), metric("Written", s.values.offset!, "/32 bytes"), metric("Expected CRC32", hex(s.values.expectedCRC!, 8)), metric("Actual CRC32", hex(s.values.actualCRC!, 8)), metric("Accepted / rejected", s.values.committed + " / " + s.values.rejected)],
  checks: (s) => [check("Preserve an application across power loss", s.values.powerCuts! > 0 && s.values.activeVersion! >= 1, "Start an update, program a partial image, then cut power."), check("Reject a corrupt or invalid image", s.values.rejected! > 0, "Inject corruption or invalid vectors; complete the transfer."), check("Commit a verified update", s.values.committed! > 0, "Disable faults and program all 32 bytes.")],
  guide: ["Begin an update; step one four-byte packet.", "Cut power before verification; inspect the active bank.", "Complete a corrupted image and verify rejection.", "Reset without corruption; complete a valid update."], expected: "Flash programming only clears bits. Verification precedes an atomic boot-bank switch; incomplete images never become active.", equation: "CRC32: reflected polynomial 0xEDB88320; initial/final XOR 0xFFFFFFFF", limitation: "32-byte teaching slots and an atomic metadata commit. CRC detects corruption, not authenticity; cryptographic signatures, rollback protection, and flash wear leveling are not implemented.", presets: [{ label: "Valid update", params: { corrupt: false, vectors: true } }, { label: "Corrupt transport", params: { corrupt: true, vectors: true } }, { label: "Invalid vectors", params: { corrupt: false, vectors: false } }],
};

export const DEBUG_SOURCE = "int twice(int x) {\n  return x * 2;\n}\nint main(void) {\n  int value = 3;\n  value = twice(value);\n  return value;\n}\n";
function debugStep(o: Simulation) {
  const cpu = o.cpu;
  if (!cpu || cpu.stopped) { o.finished = true; return; }
  const instruction = cpu.current;
  cpu.step(o.time / 1000);
  o.time++; o.values.executed = cpu.executed; o.values.PC = cpu.r[15]!; o.values.R0 = cpu.r[0]!; o.values.SP = cpu.r[13]!; o.values.depth = cpu.calls.length;
  o.memory = cpu.r.slice(); o.phase = cpu.fault || cpu.halted || (instruction?.text ?? "Instruction executed");
  event(o, "Instruction", (instruction ? hex(instruction.addr, 8) + " " + instruction.text : "No instruction") + "; R0=" + cpu.r[0]);
  sample(o, cpu.r[0]!, cpu.calls.length); if (cpu.stopped) o.finished = true;
}
export const debuggerModel: Model = {
  number: 51, subtitle: "Step compiled teaching Thumb instructions and inspect register state.", objective: "Compile editable C, stop at a source breakpoint, step into a function, and inspect its return value.",
  defaults: { breakpoint: 6, breakEnabled: true }, controls: [range("breakpoint", "Source breakpoint line", 1, 40, 1, "", true), toggle("breakEnabled", "Breakpoint enabled", true)], stepMs: 1,
  plots: [{ label: "R0", min: 0, max: 20 }, { label: "Call depth", min: 0, max: 4 }], source: DEBUG_SOURCE,
  create: (_p, source = DEBUG_SOURCE) => {
    const out = base({ executed: 0, PC: 0, R0: 0, SP: 0x20000400, depth: 0, breaks: 0, skipBreak: 0 });
    const program = compileThumb(source);
    if (program.diagnostics.length) { out.phase = program.diagnostics.map((d) => "Line " + d.line + ": " + d.message).join("; "); out.finished = true; event(out, "Compile error", out.phase); return out; }
    out.cpu = new ThumbCpu(program); out.memory = out.cpu.r.slice(); return out;
  },
  step: (s, p, ms) => {
    const o = copy(s);
    for (let i = 0; i < ms && !o.finished; i++) {
      const breakAddress = o.cpu?.prog.ins.find((instruction) => instruction.line === num(p, "breakpoint"))?.addr;
      if (breakAddress !== undefined && o.cpu?.current?.addr === breakAddress && yes(p, "breakEnabled") && !o.values.skipBreak) { o.values.breaks!++; o.finished = true; o.phase = "Breakpoint at source line " + num(p, "breakpoint"); event(o, "Breakpoint", o.phase); break; }
      o.values.skipBreak = 0; debugStep(o);
    }
    return o;
  },
  action: (s, _p, action) => { const o = copy(s); if (action === "resume") { o.finished = !!o.cpu?.stopped; o.values.skipBreak = 1; } if (action === "step") { o.finished = false; debugStep(o); } return o; },
  actions: [{ id: "step", label: "Step one instruction" }, { id: "resume", label: "Continue past breakpoint" }],
  metrics: (s) => [metric("PC", hex(s.values.PC!, 8)), metric("R0", s.values.R0!), metric("SP", hex(s.values.SP!, 8)), metric("Instructions", s.values.executed!), metric("Call depth", s.values.depth!), metric("Breakpoints hit", s.values.breaks!)],
  checks: (s) => [check("Execute compiled instructions", s.values.executed! > 5, "Build the C example, then run or step."), check("Stop at a breakpoint", s.values.breaks! > 0, "Enable the breakpoint on executable source line 6."), check("Return the expected result", !!s.cpu?.stopped && !s.cpu.fault && s.values.R0 === 6, "Continue or step past the breakpoint until main returns 6.")],
  guide: ["Compile the C example and inspect its generated disassembly.", "Run to line 6; examine PC, SP, and call depth.", "Step into twice and inspect register changes.", "Change the input from 3 to 4, rebuild, and verify return value 8."], expected: "PC follows actual executed instructions, calls change LR/SP, and the default program returns 6 in R0.", equation: "twice(3) = 6; PC follows instruction sizes and branch targets", limitation: "The existing educational C-to-Thumb subset, not a production compiler or full ARM ISA. Instruction timing is stepped for inspection rather than a hardware frequency claim.", presets: [{ label: "Break at call", params: { breakpoint: 6, breakEnabled: true } }, { label: "Run to completion", params: { breakEnabled: false } }],
};
