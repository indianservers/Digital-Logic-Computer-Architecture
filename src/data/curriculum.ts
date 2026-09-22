export interface StudioInfo {
  id: string;
  title: string;
  phase: number;
  path: string;
  summary: string;
  topics: string[];
  active: boolean;
}

export const STUDIOS: StudioInfo[] = [
  { id: "numbers", title: "Number Systems", phase: 1, path: "/studios/number-systems", summary: "Convert bases, signed codes, IEEE-754, and Hamming codes by toggling bits.", topics: ["binary", "hex", "two's complement", "ieee-754", "gray code", "parity", "hamming"], active: true },
  { id: "boolean", title: "Boolean Algebra", phase: 1, path: "/studios/boolean-algebra", summary: "Parse expressions, test laws, and watch simplification steps.", topics: ["boolean law", "de morgan", "sop", "pos", "minterm", "maxterm"], active: true },
  { id: "gates", title: "Logic Gates", phase: 1, path: "/studios/logic-gates", summary: "Toggle inputs and watch signals move through real gate symbols.", topics: ["and", "or", "nand", "xor", "tri-state", "propagation delay", "fan-out"], active: true },
  { id: "truth", title: "Truth Tables", phase: 1, path: "/studios/truth-tables", summary: "Build tables from expressions and expressions from tables.", topics: ["truth table", "canonical sop", "canonical pos"], active: true },
  { id: "kmap", title: "K-Map Solver", phase: 1, path: "/studios/kmap", summary: "Group Gray-coded cells, find prime implicants, and compare circuits.", topics: ["k-map", "don't care", "prime implicant", "quine-mccluskey"], active: true },
  { id: "combo", title: "Combinational Circuits", phase: 2, path: "/studios/combinational", summary: "Drag gates, wire them, and probe the signals.", topics: ["combinational", "circuit", "wire"], active: true },
  { id: "adders", title: "Adders & Arithmetic", phase: 2, path: "/studios/adders", summary: "Half adders, look-ahead, the ALU, and binary multiply.", topics: ["adder", "carry", "alu", "shifter"], active: true },
  { id: "mux", title: "MUX, DEMUX & Codecs", phase: 2, path: "/studios/routing", summary: "Multiplexers, encoders, decoders, and seven-segment codes.", topics: ["mux", "decoder", "encoder", "seven segment"], active: true },
  { id: "timing", title: "Digital Timing", phase: 2, path: "/studios/timing", summary: "Clocks, edges, setup, hold, and uncertain capture.", topics: ["clock", "setup", "hold", "metastability"], active: true },
  { id: "latches", title: "Latches & Flip-Flops", phase: 2, path: "/studios/flip-flops", summary: "SR, D, JK, T, and master-slave storage.", topics: ["flip-flop", "latch", "jk", "edge"], active: true },
  { id: "registers", title: "Registers", phase: 2, path: "/studios/registers", summary: "Parallel load and every shift-register mode.", topics: ["register", "shift", "siso", "johnson"], active: true },
  { id: "counters", title: "Counters", phase: 2, path: "/studios/counters", summary: "Ripple, synchronous, mod-N, and a counter designer.", topics: ["counter", "mod-n", "decade", "ripple"], active: true },
  { id: "fsm", title: "Finite State Machines", phase: 3, path: "/studios/fsm", summary: "State diagrams, Moore and Mealy machines, encoding, and minimization.", topics: ["fsm", "state", "moore", "mealy"], active: true },
  { id: "alu", title: "ALU", phase: 3, path: "/upcoming/alu", summary: "Arithmetic logic unit operations and flags.", topics: ["alu", "opcode"], active: false },
  { id: "memory", title: "Memory Fundamentals", phase: 3, path: "/studios/memory", summary: "Addressed memory arrays and read/write cycles.", topics: ["ram", "rom", "dram", "decoder"], active: true },
  { id: "cache", title: "Cache Memory", phase: 3, path: "/studios/cache", summary: "Mapping, hits, misses, and write policy.", topics: ["cache", "lru", "hit"], active: true },
  { id: "cpu-blocks", title: "CPU Building Blocks", phase: 3, path: "/studios/cpu-blocks", summary: "Program counter, IR, MAR, MDR, and the register file.", topics: ["program counter", "datapath", "register file"], active: true },
  { id: "datapath", title: "Register Transfer", phase: 4, path: "/studios/rtl", summary: "Move register values through the ALU and watch a shared bus.", topics: ["datapath", "rtl", "bus"], active: true },
  { id: "isa", title: "Instruction Set Architecture", phase: 4, path: "/studios/isa", summary: "Formats, opcodes, and the LogicLab-16 encoding.", topics: ["isa", "opcode", "risc"], active: true },
  { id: "addressing", title: "Addressing Modes", phase: 4, path: "/studios/isa?tab=modes", summary: "How instructions locate operands.", topics: ["addressing", "immediate", "indirect"], active: true },
  { id: "assembly", title: "Assembly Execution", phase: 4, path: "/studios/assembly", summary: "Assemble labels and step a program through registers and memory.", topics: ["assembly", "label", "halt"], active: true },
  { id: "fde", title: "Fetch–Decode–Execute", phase: 4, path: "/studios/fde", summary: "Step through an instruction cycle and its control signals.", topics: ["fetch", "decode", "execute"], active: true },
  { id: "control", title: "Control Unit", phase: 4, path: "/studios/control", summary: "Hardwired and microprogrammed control.", topics: ["microprogramming", "control unit"], active: true },
  { id: "pipeline", title: "CPU Pipeline", phase: 4, path: "/studios/pipeline", summary: "Five-stage instruction flow and measured speedup.", topics: ["pipeline", "throughput"], active: true },
  { id: "hazards", title: "Pipeline Hazards", phase: 4, path: "/studios/hazards", summary: "Stalls, forwarding, and branch prediction.", topics: ["hazard", "forwarding", "branch prediction"], active: true },
  { id: "vm", title: "Virtual Memory", phase: 5, path: "/upcoming/vm", summary: "Pages, TLBs, and address translation.", topics: ["virtual memory", "tlb"], active: false },
  { id: "io", title: "I/O, Interrupts & DMA", phase: 5, path: "/upcoming/io", summary: "How devices reach the processor.", topics: ["interrupt", "dma"], active: false },
  { id: "bus", title: "Bus Architecture", phase: 5, path: "/upcoming/bus", summary: "Address, data, and control buses.", topics: ["bus"], active: false },
  { id: "parallel", title: "Parallelism", phase: 6, path: "/upcoming/parallel", summary: "ILP, superscalar, and out-of-order execution.", topics: ["superscalar", "ilp"], active: false },
  { id: "multicore", title: "Multicore & Coherence", phase: 6, path: "/upcoming/multicore", summary: "Shared memory and MESI.", topics: ["mesi", "multicore"], active: false },
  { id: "gpu", title: "CPU, GPU & Accelerators", phase: 6, path: "/upcoming/gpu", summary: "Throughput, latency, and accelerators.", topics: ["gpu"], active: false },
  { id: "riscv", title: "RISC-V / ARM / x86", phase: 6, path: "/upcoming/riscv", summary: "Instruction sets and a single-cycle CPU builder.", topics: ["risc-v", "assembly"], active: false },
];

export function searchStudios(query: string): StudioInfo[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return STUDIOS.filter((studio) =>
    studio.title.toLowerCase().includes(q) || studio.topics.some((topic) => topic.includes(q)) || studio.summary.toLowerCase().includes(q),
  ).slice(0, 8);
}
