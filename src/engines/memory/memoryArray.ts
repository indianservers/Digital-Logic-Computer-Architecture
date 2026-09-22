export type MemoryKind = "ram" | "sram" | "dram" | "rom" | "prom" | "eprom" | "eeprom" | "flash";

export interface MemoryArray {
  kind: MemoryKind;
  words: number;
  width: number;
  cells: number[];
  programmed: boolean[];
  charge: number[];
}

export interface MemoryAccess {
  ok: boolean;
  data: number | null;
  rejected: boolean;
  explain: string;
}

const WRITABLE = new Set<MemoryKind>(["ram", "sram", "dram", "eeprom", "flash"]);

export function addressBitsFor(words: number): number {
  if (words <= 1) return 1;
  return Math.ceil(Math.log2(words));
}

export function capacityBits(words: number, width: number): number {
  return words * width;
}

export function createMemory(kind: MemoryKind, words: number, width: number, fill = 0): MemoryArray {
  const count = Math.max(1, words);
  return {
    kind,
    words: count,
    width: Math.max(1, width),
    cells: Array.from({ length: count }, () => fill & ((1 << width) - 1)),
    programmed: Array.from({ length: count }, () => false),
    charge: Array.from({ length: count }, () => 100),
  };
}

export function maskOf(width: number): number {
  if (width >= 31) return 0x7fffffff;
  return (1 << width) - 1;
}

export function readWord(memory: MemoryArray, address: number, chipEnable = true, outputEnable = true): MemoryAccess {
  if (!chipEnable) return { ok: false, data: null, rejected: false, explain: "Chip enable is low, so the memory stays idle." };
  if (!outputEnable) return { ok: false, data: null, rejected: false, explain: "Output enable is low, so the data bus stays off." };
  if (address < 0 || address >= memory.words) return { ok: false, data: null, rejected: false, explain: "That address is outside this chip." };
  const data = memory.cells[address] ?? 0;
  return { ok: true, data, rejected: false, explain: `Address ${address} selects one word. Data ${data.toString(2).padStart(memory.width, "0")} is driven onto the output.` };
}

export function writeWord(memory: MemoryArray, address: number, data: number, chipEnable = true, writeEnable = true): { memory: MemoryArray; access: MemoryAccess } {
  if (!chipEnable) return { memory, access: { ok: false, data: null, rejected: false, explain: "Chip enable is low, so the write is ignored." } };
  if (!writeEnable) return { memory, access: { ok: false, data: null, rejected: false, explain: "Write enable is low, so the stored word does not change." } };
  if (address < 0 || address >= memory.words) return { memory, access: { ok: false, data: null, rejected: false, explain: "That address is outside this chip." } };
  if (memory.kind === "rom") {
    return { memory, access: { ok: false, data: memory.cells[address] ?? 0, rejected: true, explain: "ROM rejects this write. The stored word stays unchanged." } };
  }
  if ((memory.kind === "prom" || memory.kind === "eprom") && memory.programmed[address]) {
    return {
      memory,
      access: {
        ok: false,
        data: memory.cells[address] ?? 0,
        rejected: true,
        explain: memory.kind === "prom"
          ? "PROM can be programmed once. This cell is already programmed."
          : "EPROM is already programmed at this address. Ultraviolet erase clears the whole chip first.",
      },
    };
  }
  if (!WRITABLE.has(memory.kind) && memory.kind !== "prom" && memory.kind !== "eprom") {
    return { memory, access: { ok: false, data: memory.cells[address] ?? 0, rejected: true, explain: "This memory kind rejects the write." } };
  }
  const stored = data & maskOf(memory.width);
  const cells = memory.cells.slice();
  const programmed = memory.programmed.slice();
  const charge = memory.charge.slice();
  cells[address] = stored;
  programmed[address] = true;
  charge[address] = 100;
  return {
    memory: { ...memory, cells, programmed, charge },
    access: { ok: true, data: stored, rejected: false, explain: `Write stores ${stored.toString(2).padStart(memory.width, "0")} at address ${address}.` },
  };
}

export function decayDram(memory: MemoryArray, loss = 25): MemoryArray {
  if (memory.kind !== "dram") return memory;
  return { ...memory, charge: memory.charge.map((value) => Math.max(0, value - loss)) };
}

export function refreshDram(memory: MemoryArray): MemoryArray {
  if (memory.kind !== "dram") return memory;
  return { ...memory, charge: memory.charge.map(() => 100) };
}

export function eraseEprom(memory: MemoryArray): MemoryArray {
  if (memory.kind !== "eprom") return memory;
  return {
    ...memory,
    cells: memory.cells.map(() => maskOf(memory.width)),
    programmed: memory.programmed.map(() => false),
  };
}
