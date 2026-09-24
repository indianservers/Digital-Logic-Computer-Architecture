export type StudioCategory =
  | "foundations"
  | "combinational"
  | "sequential"
  | "memory"
  | "processor"
  | "systems"
  | "architecture"
  | "isa"
  | "build";

export interface StudioInfo {
  id: string;
  title: string;
  phase: number;
  path: string;
  summary: string;
  topics: string[];
  active: boolean;
  category: StudioCategory;
}

export const CATEGORIES: Array<{
  id: StudioCategory;
  title: string;
  blurb: string;
  art: string;
  tone: string;
}> = [
  { id: "foundations", title: "Number systems & Boolean logic", blurb: "Bits, codes, algebra, gates, tables, and Karnaugh maps.", art: "/icons/cat-foundations.png", tone: "sky" },
  { id: "combinational", title: "Combinational circuits", blurb: "Wire gates, add, multiplex, and encode without a clock.", art: "/icons/cat-combinational.png", tone: "green" },
  { id: "sequential", title: "Sequential logic", blurb: "Clocks, latches, registers, counters, and state machines.", art: "/icons/cat-sequential.png", tone: "amber" },
  { id: "memory", title: "Memory systems", blurb: "Arrays, caches, hierarchy, and virtual addresses.", art: "/icons/cat-memory.png", tone: "violet" },
  { id: "processor", title: "Processor core", blurb: "Datapath, ISA, fetch–decode–execute, control, and pipeline.", art: "/icons/cat-processor.png", tone: "blue" },
  { id: "systems", title: "I/O, buses & parallelism", blurb: "Devices, interrupts, the bus, ILP, and coherence.", art: "/icons/cat-systems.png", tone: "teal" },
  { id: "architecture", title: "Architecture studios", blurb: "Accelerators, SoCs, and the teaching 8-bit and 16-bit CPUs.", art: "/icons/cat-architecture.png", tone: "pink" },
  { id: "isa", title: "ISA explorers", blurb: "MIPS, RISC-V, ARM, x86, and mobile or desktop packages.", art: "/icons/cat-isa.png", tone: "orange" },
  { id: "build", title: "Build & sandbox", blurb: "Assemble a custom CPU, then mix engines in one workspace.", art: "/icons/cat-build.png", tone: "indigo" },
];

export const STUDIOS: StudioInfo[] = [
  { id: "numbers", title: "Number Systems", phase: 1, path: "/studios/number-systems", summary: "Convert bases, signed codes, IEEE-754, and Hamming codes by toggling bits.", topics: ["binary", "hex", "two's complement", "ieee-754", "gray code", "parity", "hamming"], active: true, category: "foundations" },
  { id: "boolean", title: "Boolean Algebra", phase: 1, path: "/studios/boolean-algebra", summary: "Parse expressions, test laws, and watch simplification steps.", topics: ["boolean law", "de morgan", "sop", "pos", "minterm", "maxterm"], active: true, category: "foundations" },
  { id: "gates", title: "Logic Gates", phase: 1, path: "/studios/logic-gates", summary: "Toggle inputs and watch signals move through real gate symbols.", topics: ["and", "or", "nand", "xor", "tri-state", "propagation delay", "fan-out"], active: true, category: "foundations" },
  { id: "truth", title: "Truth Tables", phase: 1, path: "/studios/truth-tables", summary: "Build tables from expressions and expressions from tables.", topics: ["truth table", "canonical sop", "canonical pos"], active: true, category: "foundations" },
  { id: "kmap", title: "K-Map Solver", phase: 1, path: "/studios/kmap", summary: "Group Gray-coded cells, find prime implicants, and compare circuits.", topics: ["k-map", "don't care", "prime implicant", "quine-mccluskey"], active: true, category: "foundations" },
  { id: "combo", title: "Combinational Circuits", phase: 2, path: "/studios/combinational", summary: "Drag gates, wire them, and probe the signals.", topics: ["combinational", "circuit", "wire"], active: true, category: "combinational" },
  { id: "adders", title: "Adders & Arithmetic", phase: 2, path: "/studios/adders", summary: "Half adders, look-ahead, the ALU, and binary multiply.", topics: ["adder", "carry", "alu", "shifter"], active: true, category: "combinational" },
  { id: "mux", title: "MUX, DEMUX & Codecs", phase: 2, path: "/studios/routing", summary: "Multiplexers, encoders, decoders, and seven-segment codes.", topics: ["mux", "decoder", "encoder", "seven segment"], active: true, category: "combinational" },
  { id: "alu", title: "ALU", phase: 3, path: "/upcoming/alu", summary: "Arithmetic logic unit operations and flags.", topics: ["alu", "opcode"], active: false, category: "combinational" },
  { id: "timing", title: "Digital Timing", phase: 2, path: "/studios/timing", summary: "Clocks, edges, setup, hold, and uncertain capture.", topics: ["clock", "setup", "hold", "metastability"], active: true, category: "sequential" },
  { id: "latches", title: "Latches & Flip-Flops", phase: 2, path: "/studios/flip-flops", summary: "SR, D, JK, T, and master-slave storage.", topics: ["flip-flop", "latch", "jk", "edge"], active: true, category: "sequential" },
  { id: "registers", title: "Registers", phase: 2, path: "/studios/registers", summary: "Parallel load and every shift-register mode.", topics: ["register", "shift", "siso", "johnson"], active: true, category: "sequential" },
  { id: "counters", title: "Counters", phase: 2, path: "/studios/counters", summary: "Ripple, synchronous, mod-N, and a counter designer.", topics: ["counter", "mod-n", "decade", "ripple"], active: true, category: "sequential" },
  { id: "fsm", title: "Finite State Machines", phase: 3, path: "/studios/fsm", summary: "State diagrams, Moore and Mealy machines, encoding, and minimization.", topics: ["fsm", "state", "moore", "mealy"], active: true, category: "sequential" },
  { id: "memory", title: "Memory Fundamentals", phase: 3, path: "/studios/memory", summary: "Addressed memory arrays and read/write cycles.", topics: ["ram", "rom", "dram", "decoder"], active: true, category: "memory" },
  { id: "cache", title: "Cache Memory", phase: 3, path: "/studios/cache", summary: "Mapping, hits, misses, and write policy.", topics: ["cache", "lru", "hit"], active: true, category: "memory" },
  { id: "hierarchy", title: "Memory Hierarchy", phase: 5, path: "/studios/hierarchy", summary: "Registers, caches, RAM, and storage with a live access trace.", topics: ["locality", "amat", "cache"], active: true, category: "memory" },
  { id: "vm", title: "Virtual Memory", phase: 5, path: "/studios/vm", summary: "Pages, TLBs, two-level tables, and protection faults.", topics: ["virtual memory", "tlb", "page fault"], active: true, category: "memory" },
  { id: "cpu-blocks", title: "CPU Building Blocks", phase: 3, path: "/studios/cpu-blocks", summary: "Program counter, IR, MAR, MDR, and the register file.", topics: ["program counter", "datapath", "register file"], active: true, category: "processor" },
  { id: "datapath", title: "Register Transfer", phase: 4, path: "/studios/rtl", summary: "Move register values through the ALU and watch a shared bus.", topics: ["datapath", "rtl", "bus"], active: true, category: "processor" },
  { id: "isa", title: "Instruction Set Architecture", phase: 4, path: "/studios/isa", summary: "Formats, opcodes, and the LogicLab-16 encoding.", topics: ["isa", "opcode", "risc"], active: true, category: "processor" },
  { id: "addressing", title: "Addressing Modes", phase: 4, path: "/studios/isa?tab=modes", summary: "How instructions locate operands.", topics: ["addressing", "immediate", "indirect"], active: true, category: "processor" },
  { id: "assembly", title: "Assembly Execution", phase: 4, path: "/studios/assembly", summary: "Assemble labels and step a program through registers and memory.", topics: ["assembly", "label", "halt"], active: true, category: "processor" },
  { id: "fde", title: "Fetch–Decode–Execute", phase: 4, path: "/studios/fde", summary: "Step through an instruction cycle and its control signals.", topics: ["fetch", "decode", "execute"], active: true, category: "processor" },
  { id: "control", title: "Control Unit", phase: 4, path: "/studios/control", summary: "Hardwired and microprogrammed control.", topics: ["microprogramming", "control unit"], active: true, category: "processor" },
  { id: "pipeline", title: "CPU Pipeline", phase: 4, path: "/studios/pipeline", summary: "Five-stage instruction flow and measured speedup.", topics: ["pipeline", "throughput"], active: true, category: "processor" },
  { id: "hazards", title: "Pipeline Hazards", phase: 4, path: "/studios/hazards", summary: "Stalls, forwarding, and branch prediction.", topics: ["hazard", "forwarding", "branch prediction"], active: true, category: "processor" },
  { id: "io", title: "I/O Architecture", phase: 5, path: "/studios/io", summary: "Memory-mapped I/O, isolated I/O, and programmed polling.", topics: ["memory-mapped", "polling"], active: true, category: "systems" },
  { id: "interrupts", title: "Interrupts & DMA", phase: 5, path: "/studios/interrupts", summary: "Vectors, priority, exceptions, and block transfer.", topics: ["interrupt", "dma", "exception"], active: true, category: "systems" },
  { id: "bus", title: "Bus Architecture", phase: 5, path: "/studios/bus", summary: "Address, data, control, arbitration, and bandwidth.", topics: ["bus", "arbitration", "bandwidth"], active: true, category: "systems" },
  { id: "parallel", title: "Parallel Processing", phase: 5, path: "/studios/parallel", summary: "Issue width, renaming, the reorder buffer, SIMD, and SMT.", topics: ["superscalar", "ilp", "simd"], active: true, category: "systems" },
  { id: "multicore", title: "Multicore & Coherence", phase: 5, path: "/studios/multicore", summary: "Shared memory, MSI, MESI, and false sharing.", topics: ["mesi", "msi", "false sharing"], active: true, category: "systems" },
  { id: "accelerator", title: "AI Accelerator / TPU / NPU", phase: 6, path: "/architecture/accelerator", summary: "MAC units, systolic arrays, quantization, and neural execution.", topics: ["mac", "systolic", "tpu", "npu"], active: true, category: "architecture" },
  { id: "hetero", title: "Heterogeneous Computing", phase: 6, path: "/architecture/hetero", summary: "CPU, GPU, NPU, and DSP roles, routing, and offload.", topics: ["offload", "scheduler", "unified memory"], active: true, category: "architecture" },
  { id: "soc", title: "SoC Architecture Explorer", phase: 6, path: "/architecture/soc", summary: "Floorplan, NoC, system cache, and power domains.", topics: ["soc", "noc", "isp"], active: true, category: "architecture" },
  { id: "cpu8", title: "Educational 8-bit CPU", phase: 6, path: "/architecture/cpu8", summary: "Accumulator datapath, teaching ISA, and clock-by-clock execution.", topics: ["8-bit", "assembler", "micro-op"], active: true, category: "architecture" },
  { id: "cpu16", title: "Educational 16-bit CPU", phase: 6, path: "/architecture/cpu16", summary: "LogicLab-16 register file, CALL/RET, stack, and a simple interrupt.", topics: ["16-bit", "stack", "interrupt"], active: true, category: "architecture" },
  { id: "gpu", title: "CPU, GPU & Accelerators", phase: 6, path: "/upcoming/gpu", summary: "Throughput, latency, and accelerators.", topics: ["gpu"], active: false, category: "architecture" },
  { id: "mips", title: "MIPS Architecture Explorer", phase: 7, path: "/architecture/mips", summary: "Teaching MIPS32 formats, decoder, datapath, and pipeline overview.", topics: ["mips", "r-type", "datapath"], active: true, category: "isa" },
  { id: "riscv-lab", title: "RISC-V Processor Lab", phase: 7, path: "/architecture/riscv", summary: "Bit-accurate RV32I assembler, immediates, datapath, and hazards.", topics: ["risc-v", "rv32i", "assembler"], active: true, category: "isa" },
  { id: "arm", title: "ARM Architecture Explorer", phase: 7, path: "/architecture/arm", summary: "AArch64-oriented teaching view of registers, load/store, calls, and EL0–EL3.", topics: ["arm", "aarch64", "neon"], active: true, category: "isa" },
  { id: "x86", title: "x86 Architecture Explorer", phase: 7, path: "/architecture/x86", summary: "Variable-length encodings, addressing, micro-ops, and an OOO backend sketch.", topics: ["x86", "micro-op", "addressing"], active: true, category: "isa" },
  { id: "compare-isa", title: "ISA Comparison Explorer", phase: 7, path: "/architecture/compare", summary: "Neutral RISC-V, ARM, and x86 comparison. No ranking.", topics: ["isa", "encoding", "comparison"], active: true, category: "isa" },
  { id: "mobile", title: "Modern Mobile SoC Explorer", phase: 7, path: "/architecture/mobile", summary: "Generic P/E cores, GPU, NPU, ISP, thermal, and modem concept.", topics: ["soc", "npu", "thermal"], active: true, category: "isa" },
  { id: "desktop", title: "Modern Desktop CPU Explorer", phase: 7, path: "/architecture/desktop", summary: "Generic package, caches, DDR, PCIe, boost, and package power.", topics: ["desktop", "boost", "pcie"], active: true, category: "isa" },
  { id: "builder", title: "Build Your Own CPU", phase: 8, path: "/architecture/builder", summary: "Construct a processor from registers, ALU, memory, and a custom ISA.", topics: ["cpu builder", "isa", "assembler", "datapath"], active: true, category: "build" },
  { id: "sandbox", title: "Computer Architecture Sandbox", phase: 8, path: "/architecture/sandbox", summary: "Combine gates, datapaths, caches, CPUs, and coherence in one workspace.", topics: ["sandbox", "circuit", "multicore"], active: true, category: "build" },
];

export function searchStudios(query: string): StudioInfo[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return STUDIOS.filter((studio) =>
    studio.title.toLowerCase().includes(q) || studio.topics.some((topic) => topic.includes(q)) || studio.summary.toLowerCase().includes(q) || studio.category.includes(q),
  ).slice(0, 8);
}
