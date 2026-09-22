import type { Slot } from "./replacement";

export interface WriteEffect {
  line: Slot;
  wroteMemory: boolean;
  allocated: boolean;
}

export function applyWrite(line: Slot, data: number, policy: "through" | "back"): WriteEffect {
  return {
    line: { ...line, data, dirty: policy === "back", valid: true },
    wroteMemory: policy === "through",
    allocated: true,
  };
}

export function evictionWritesBack(line: Slot, policy: "through" | "back"): boolean {
  return policy === "back" && line.valid && line.dirty;
}
