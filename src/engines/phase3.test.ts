import { describe, expect, it } from "vitest";
import { amat, hierarchicalAmat } from "./cache/metrics";
import { decompose, validGeometry, type CacheConfig } from "./cache/mapping";
import { runTrace } from "./cache/cache";
import { driveBus } from "./cpu/buses";
import { extendBits, idleControls, manualDatapath } from "./cpu/datapathComponents";
import { createRegisterFile, readPorts, writePort } from "./cpu/registerFile";
import { createRegisters, popStack, pushStack, stepProgramCounter } from "./cpu/registers";
import { encodeStates } from "./fsm/encoding";
import { digitalLock, sequenceDetector, vendingMachine } from "./fsm/examples";
import { minimizeMachine } from "./fsm/minimization";
import { runSequence } from "./fsm/simulator";
import { addState, blankMachine, type FsmMachine } from "./fsm/stateMachine";
import { synthesizeD } from "./fsm/synthesis";
import { conditionMatches } from "./fsm/transition";
import { chipMap, decodeAddress, splitAddress } from "./memory/addressDecoder";
import { createMemory, eraseEprom, readWord, writeWord } from "./memory/memoryArray";
import { describeOrganization, expandByAddress, expandByWord, highOrderBank, interleavedBank } from "./memory/organization";

const tiny: CacheConfig = {
  addressBits: 6,
  memoryBytes: 64,
  cacheBytes: 16,
  blockBytes: 4,
  associativity: 1,
  replacement: "lru",
  writePolicy: "through",
  allocation: "allocate",
  seed: 1,
};

describe("finite state machines", () => {
  it("runs a Moore sequence and resets to the initial state", () => {
    const machine = sequenceDetector("101", true);
    const steps = runSequence(machine, ["1", "0", "1", "0", "1"]);
    expect(steps.map((step) => step.output)).toEqual(["0", "0", "1", "0", "1"]);
    expect(runSequence(machine, ["1"], machine.initialId)[0]?.fromId).toBe("s0");
  });

  it("detects 101 once when overlapping is off", () => {
    const steps = runSequence(sequenceDetector("101", false), ["1", "0", "1", "0", "1"]);
    expect(steps.map((step) => step.output)).toEqual(["0", "0", "1", "0", "0"]);
  });

  it("uses the transition output for a Mealy machine", () => {
    const machine: FsmMachine = {
      name: "mealy",
      kind: "mealy",
      inputs: ["x"],
      initialId: "s0",
      states: [
        { id: "s0", name: "S0", x: 0, y: 0, output: "0" },
        { id: "s1", name: "S1", x: 0, y: 0, output: "0" },
      ],
      transitions: [
        { id: "a", from: "s0", to: "s1", when: "1", output: "1" },
        { id: "b", from: "s0", to: "s0", when: "0", output: "0" },
        { id: "c", from: "s1", to: "s1", when: "1", output: "0" },
        { id: "d", from: "s1", to: "s0", when: "0", output: "0" },
      ],
    };
    expect(runSequence(machine, ["1", "0"])[0]?.output).toBe("1");
  });

  it("evaluates boolean transition conditions", () => {
    const machine = { ...blankMachine(), inputs: ["A", "B"] };
    expect(conditionMatches(machine, "A && !B", "10")).toBe(true);
    expect(conditionMatches(machine, "A && !B", "11")).toBe(false);
    expect(conditionMatches(machine, "x = 0", "0")).toBe(false);
  });

  it("encodes binary and one-hot states", () => {
    const machine = addState(addState(blankMachine(), "S2"), "S3");
    expect(encodeStates(machine, "binary").states.map((state) => state.code)).toEqual(["00", "01", "10", "11"]);
    expect(encodeStates(machine, "one-hot").flipFlops).toBe(4);
    expect(encodeStates(machine, "one-hot").states[0]?.code).toBe("0001");
    expect(encodeStates(machine, "one-hot").states[3]?.code).toBe("1000");
  });

  it("merges equivalent states by partition refinement", () => {
    const machine: FsmMachine = {
      name: "dup",
      kind: "moore",
      inputs: ["x"],
      initialId: "s0",
      states: [
        { id: "s0", name: "S0", x: 0, y: 0, output: "0" },
        { id: "s1", name: "S1", x: 0, y: 0, output: "1" },
        { id: "s2", name: "S2", x: 0, y: 0, output: "0" },
      ],
      transitions: [
        { id: "a", from: "s0", to: "s0", when: "0", output: "0" },
        { id: "b", from: "s0", to: "s1", when: "1", output: "1" },
        { id: "c", from: "s1", to: "s0", when: "0", output: "0" },
        { id: "d", from: "s1", to: "s1", when: "1", output: "1" },
        { id: "e", from: "s2", to: "s0", when: "0", output: "0" },
        { id: "f", from: "s2", to: "s1", when: "1", output: "1" },
      ],
    };
    const reduced = minimizeMachine(machine);
    expect(reduced.ok).toBe(true);
    expect(reduced.merged).toBe(1);
    expect(reduced.machine?.states).toHaveLength(2);
  });

  it("builds D flip-flop equations for a two-state machine", () => {
    const machine: FsmMachine = {
      name: "toggle",
      kind: "moore",
      inputs: ["x"],
      initialId: "s0",
      states: [
        { id: "s0", name: "S0", x: 0, y: 0, output: "0" },
        { id: "s1", name: "S1", x: 0, y: 0, output: "1" },
      ],
      transitions: [
        { id: "a", from: "s0", to: "s0", when: "0", output: "0" },
        { id: "b", from: "s0", to: "s1", when: "1", output: "1" },
        { id: "c", from: "s1", to: "s1", when: "0", output: "1" },
        { id: "d", from: "s1", to: "s0", when: "1", output: "0" },
      ],
    };
    const circuit = synthesizeD(machine);
    expect(circuit.ok).toBe(true);
    expect(circuit.flipFlops).toBe(1);
    expect(circuit.equations.find((row) => row.signal === "D0")?.expression).toContain("Q0");
  });

  it("opens the lock only on 1011 and vends at 15", () => {
    expect(runSequence(digitalLock("1011"), ["1", "0", "1", "1"]).at(-1)?.toName).toBe("Open");
    expect(runSequence(digitalLock("1011"), ["1", "0", "1", "0"]).at(-1)?.output).toBe("0");
    expect(runSequence(vendingMachine(), ["5", "10"]).at(-1)?.output).toBe("1");
  });
});

describe("memory systems", () => {
  it("computes address width and capacity", () => {
    expect(describeOrganization(1024, 8)).toMatchObject({ addressLines: 10, capacityBits: 8192, label: "1024 × 8" });
  });

  it("reads and writes when the chip is enabled", () => {
    let memory = createMemory("ram", 16, 8);
    const written = writeWord(memory, 3, 0b10100110, true, true);
    memory = written.memory;
    expect(written.access.ok).toBe(true);
    expect(readWord(memory, 3, true, true).data).toBe(0b10100110);
    expect(writeWord(memory, 3, 1, false, true).memory.cells[3]).toBe(0b10100110);
  });

  it("rejects ROM writes and keeps the cell", () => {
    const memory = createMemory("rom", 4, 8, 0x11);
    const attempt = writeWord(memory, 1, 0xff, true, true);
    expect(attempt.access.rejected).toBe(true);
    expect(attempt.memory.cells[1]).toBe(0x11);
  });

  it("expands by word and by address, and decodes a chip", () => {
    expect(expandByWord([{ words: 1024, width: 4 }, { words: 1024, width: 4 }])).toMatchObject({ words: 1024, width: 8 });
    expect(expandByAddress([{ words: 1024, width: 8 }, { words: 1024, width: 8 }])).toMatchObject({ words: 2048, width: 8 });
    expect(decodeAddress(3, 4).active).toBe(3);
    expect(chipMap(16, 8192, 9000).chips.find((chip) => chip.selected)?.chip).toBe(1);
    expect(splitAddress(9000, 16, 13)).toMatchObject({ select: 1, offset: 9000 - 8192 });
    expect(interleavedBank(4, 4).bank).toBe(0);
    expect(interleavedBank(5, 4).bank).toBe(1);
    expect(highOrderBank(5, 4, 16).bank).toBe(1);
  });

  it("programs EPROM once, then UV erase allows another write", () => {
    let memory = createMemory("eprom", 4, 8, 0xff);
    const first = writeWord(memory, 1, 0xa5, true, true);
    memory = first.memory;
    expect(first.access.ok).toBe(true);
    expect(writeWord(memory, 1, 0x11, true, true).access.rejected).toBe(true);
    memory = eraseEprom(memory);
    expect(writeWord(memory, 1, 0x11, true, true).access.ok).toBe(true);
  });
});

describe("cache", () => {
  it("splits an address into tag, index, and offset", () => {
    expect(validGeometry(tiny)).toBe(true);
    const parts = decompose(0b101011, tiny);
    expect(parts.offsetBits).toBe("11");
    expect(parts.indexBits).toBe("10");
    expect(parts.tagBits).toBe("10");
  });

  it("hits after a compulsory miss and reports a conflict", () => {
    const trace = runTrace(tiny, [{ address: 0 }, { address: 0 }, { address: 16 }]);
    expect(trace.results.map((row) => row.kind)).toEqual(["compulsory", "hit", "conflict"]);
    expect(trace.results[2]?.evicted).toBe(true);
  });

  it("places blocks in any line of a fully associative cache and in a set", () => {
    const full: CacheConfig = { ...tiny, associativity: 4 };
    const direct = runTrace(full, [{ address: 0 }, { address: 16 }]);
    expect(direct.results.every((row) => row.set === 0)).toBe(true);
    expect(direct.results[1]?.kind).toBe("compulsory");
    const set: CacheConfig = { ...tiny, cacheBytes: 32, associativity: 2 };
    const placed = runTrace(set, [{ address: 0 }, { address: 32 }]);
    expect(placed.results[0]?.set).toBe(placed.results[1]?.set);
    expect(placed.machine.sets[placed.results[0]?.set ?? 0]?.filter((line) => line.valid)).toHaveLength(2);
  });

  it("replaces the least recently used line and the oldest FIFO line", () => {
    const config: CacheConfig = { ...tiny, cacheBytes: 16, associativity: 2, replacement: "lru" };
    const lru = runTrace(config, [{ address: 0 }, { address: 8 }, { address: 0 }, { address: 16 }]);
    expect(lru.results[3]?.evicted).toBe(true);
    expect(lru.machine.sets[0]?.some((line) => line.tag === decompose(8, config).tag)).toBe(false);
    const fifo = runTrace({ ...config, replacement: "fifo" }, [{ address: 0 }, { address: 8 }, { address: 0 }, { address: 16 }]);
    expect(fifo.machine.sets[0]?.some((line) => line.tag === decompose(0, config).tag)).toBe(false);
  });

  it("writes through, writes back a dirty line, and honors allocation", () => {
    const through = runTrace({ ...tiny, writePolicy: "through" }, [{ address: 0, op: "write", data: 7 }]);
    expect(through.machine.stats.memoryWrites).toBe(1);
    expect(through.machine.sets[0]?.[0]?.dirty).toBe(false);
    const back = runTrace({ ...tiny, writePolicy: "back" }, [
      { address: 0, op: "write", data: 7 },
      { address: 16, op: "read" },
    ]);
    expect(back.results[1]?.dirtyEvict).toBe(true);
    expect(back.machine.stats.writeBacks).toBe(1);
    const allocate = runTrace({ ...tiny, writePolicy: "back", allocation: "allocate" }, [{ address: 4, op: "write", data: 1 }]);
    expect(allocate.machine.sets.flat().some((line) => line.valid)).toBe(true);
    const bypass = runTrace({ ...tiny, writePolicy: "through", allocation: "no-allocate" }, [
      { address: 4, op: "write", data: 1 },
      { address: 4, op: "read" },
    ]);
    expect(bypass.results[1]?.kind).not.toBe("hit");
    expect(amat(1, { accesses: 2, hits: 1, misses: 1, reads: 2, writes: 0, evictions: 0, writeBacks: 0, memoryWrites: 0 }, 10)).toBe(6);
    expect(hierarchicalAmat([{ hitCycles: 1, accesses: 10, misses: 2 }, { hitCycles: 4, accesses: 2, misses: 1 }], 100)).toBeCloseTo(1 + 0.2 * (4 + 0.5 * 100));
  });
});

describe("cpu building blocks", () => {
  it("increments and loads the program counter", () => {
    const reset = stepProgramCounter(createRegisters(16, 4), "reset");
    expect(stepProgramCounter({ ...reset, pc: 0x40 }, "increment").pc).toBe(0x44);
    expect(stepProgramCounter(reset, "load", 0x20).pc).toBe(0x20);
  });

  it("reads and writes the register file", () => {
    let file = createRegisterFile(8, 16);
    file = writePort(file, 1, 0x12, true);
    file = writePort(file, 2, 0x0a, false);
    expect(readPorts(file, 1, 2)).toEqual({ a: 0x12, b: 0 });
  });

  it("detects bus contention and extends signs", () => {
    expect(driveBus([{ name: "PC", enabled: true, value: 4 }, { name: "IR", enabled: true, value: 9 }]).value).toBe("X");
    expect(driveBus([{ name: "PC", enabled: true, value: 4 }, { name: "IR", enabled: false, value: 9 }]).source).toBe("PC");
    expect(extendBits("11110000", 16, true)).toBe("1111111111110000");
    expect(extendBits("11110000", 16, false)).toBe("0000000011110000");
  });

  it("routes the ALU through the datapath mux", () => {
    let file = createRegisterFile(4, 4);
    file = writePort(file, 0, 7, true);
    file = writePort(file, 1, 1, true);
    const view = manualDatapath({
      registers: createRegisters(4, 1),
      file,
      readA: 0,
      readB: 1,
      writeAddress: 2,
      immediate: 3,
      op: "ADD",
      controls: { ...idleControls(), regWrite: true, aluSrc: 0 },
      memory: {},
    });
    expect(view.file.values[2]).toBe(8);
    expect(view.flags.v).toBe(1);
    const immediate = manualDatapath({
      registers: createRegisters(4, 1),
      file,
      readA: 0,
      readB: 1,
      writeAddress: 2,
      immediate: 1,
      op: "ADD",
      controls: { ...idleControls(), aluSrc: 1 },
      memory: {},
    });
    expect(immediate.result).toBe(8);
  });

  it("moves the stack pointer on push and pop", () => {
    const pushed = pushStack(createRegisters(16, 4), {}, 9);
    expect(pushed.registers.sp).toBe(0xff);
    expect(popStack(pushed.registers, pushed.memory).value).toBe(9);
  });
});
