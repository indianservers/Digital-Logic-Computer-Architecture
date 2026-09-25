import { ACA_LABS, acaRoute } from "./acaLabs";

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
  { id: "alu", title: "ALU", phase: 3, path: "/studios/alu", summary: "Arithmetic logic unit operations and flags.", topics: ["alu", "opcode"], active: true, category: "combinational" },
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
  { id: "aca", title: "Advanced Computer Architecture", phase: 5, path: "/studios/advanced-computer-architecture", summary: "Explore out-of-order execution, branch prediction, cache coherence, memory systems, multicore architecture, and CPU performance through interactive virtual laboratories.", topics: ["scoreboard", "tomasulo", "roofline", "moesi", "correlating", "reorder buffer", "prefetch", "amdahl"], active: true, category: "systems" },
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
  { id: "compare-isa", title: "ISA Comparison Explorer", phase: 7, path: "/architecture/compare", summary: "Neutral RISC-V, ARM, and x86 comparison. No ranking.", topics: ["isa", "encoding", "comparison", "risc-v", "arm", "x86"], active: true, category: "isa" },
  { id: "mobile", title: "Modern Mobile SoC Explorer", phase: 7, path: "/architecture/mobile", summary: "Generic P/E cores, GPU, NPU, ISP, thermal, and modem concept.", topics: ["soc", "npu", "thermal"], active: true, category: "isa" },
  { id: "desktop", title: "Modern Desktop CPU Explorer", phase: 7, path: "/architecture/desktop", summary: "Generic package, caches, DDR, PCIe, boost, and package power.", topics: ["desktop", "boost", "pcie"], active: true, category: "isa" },
  { id: "builder", title: "Build Your Own CPU", phase: 8, path: "/architecture/builder", summary: "Construct a processor from registers, ALU, memory, and a custom ISA.", topics: ["cpu builder", "isa", "assembler", "datapath"], active: true, category: "build" },
  { id: "sandbox", title: "Computer Architecture Sandbox", phase: 8, path: "/architecture/sandbox", summary: "Combine gates, datapaths, caches, CPUs, and coherence in one workspace.", topics: ["sandbox", "circuit", "multicore"], active: true, category: "build" },
];

export function matchStudio(path: string): StudioInfo | undefined {
  const exact = STUDIOS.find((studio) => studio.path === path);
  if (exact) return exact;
  const base = path.split("?")[0] ?? path;
  return STUDIOS.find((studio) => (studio.path.split("?")[0] ?? studio.path) === base);
}

const DESKTOP_LABS: StudioInfo[] = [
  { id: "dsk-package", title: "CPU Package", phase: 7, path: "/architecture/desktop/package", summary: "Heat spreader, die, and blocks.", topics: ["package", "die", "ihs"], active: true, category: "isa" },
  { id: "dsk-cores", title: "Core Microarchitecture", phase: 7, path: "/architecture/desktop/cores", summary: "P-core and E-core teaching model.", topics: ["p-core", "e-core", "core"], active: true, category: "isa" },
  { id: "dsk-cache", title: "Cache Hierarchy", phase: 7, path: "/architecture/desktop/cache", summary: "L1, L2, L3, and a hit-rate simulation.", topics: ["cache", "l1", "l2", "l3"], active: true, category: "isa" },
  { id: "dsk-ddr", title: "Memory / DDR", phase: 7, path: "/architecture/desktop/memory", summary: "Channels and peak bandwidth.", topics: ["ddr", "memory", "channel", "bandwidth"], active: true, category: "isa" },
  { id: "dsk-pcie", title: "PCIe & I/O", phase: 7, path: "/architecture/desktop/pcie", summary: "Lane allocation and generation.", topics: ["pcie", "gpu", "nvme", "lanes"], active: true, category: "isa" },
  { id: "dsk-boost", title: "Boost & Power", phase: 7, path: "/architecture/desktop/boost-power", summary: "Simplified educational boost model.", topics: ["boost", "turbo", "power", "frequency"], active: true, category: "isa" },
  { id: "dsk-thermal", title: "Thermal Management", phase: 7, path: "/architecture/desktop/thermal", summary: "Cooler, fan, and throttling.", topics: ["thermal", "cooling", "throttling", "heatsink"], active: true, category: "isa" },
  { id: "dsk-work", title: "System Workloads", phase: 7, path: "/architecture/desktop/workloads", summary: "Gaming, compile, and content demand.", topics: ["gaming", "workload", "compilation"], active: true, category: "isa" },
  { id: "dsk-quiz", title: "Desktop CPU Practice", phase: 7, path: "/architecture/desktop/practice", summary: "Sixteen questions on the desktop CPU studio.", topics: ["quiz", "practice"], active: true, category: "isa" },
];

const MOBILE_LABS: StudioInfo[] = [
  { id: "mob-overview", title: "SoC Overview", phase: 7, path: "/architecture/mobile/overview", summary: "Clickable mobile SoC block diagram.", topics: ["soc", "floorplan", "interconnect"], active: true, category: "isa" },
  { id: "mob-cpu", title: "CPU: P/E Cores", phase: 7, path: "/architecture/mobile/cpu-cores", summary: "Performance and efficiency core scheduler.", topics: ["p-core", "e-core", "cpu", "scheduler"], active: true, category: "isa" },
  { id: "mob-gpu", title: "GPU Architecture", phase: 7, path: "/architecture/mobile/gpu", summary: "Mobile GPU pipeline and a small scene.", topics: ["gpu", "shader", "tile"], active: true, category: "isa" },
  { id: "mob-npu", title: "NPU & AI Engine", phase: 7, path: "/architecture/mobile/npu", summary: "On-device tensor pipeline and a local image demo.", topics: ["npu", "ai", "tensor", "mac"], active: true, category: "isa" },
  { id: "mob-isp", title: "ISP & Camera Pipeline", phase: 7, path: "/architecture/mobile/isp", summary: "Sensor to display image stages.", topics: ["camera", "isp", "hdr", "raw"], active: true, category: "isa" },
  { id: "mob-mem", title: "Memory & Interconnect", phase: 7, path: "/architecture/mobile/memory", summary: "Cache hierarchy and NoC clients.", topics: ["memory", "lpddr", "noc", "cache"], active: true, category: "isa" },
  { id: "mob-radio", title: "Modem & Connectivity", phase: 7, path: "/architecture/mobile/connectivity", summary: "Illustrative 5G, LTE, and Wi-Fi simulation.", topics: ["modem", "5g", "wifi", "baseband"], active: true, category: "isa" },
  { id: "mob-power", title: "Power, Thermal & DVFS", phase: 7, path: "/architecture/mobile/power-thermal", summary: "Frequency, power, and a simplified thermal model.", topics: ["thermal", "dvfs", "power", "throttling"], active: true, category: "isa" },
  { id: "mob-int", title: "System Integration", phase: 7, path: "/architecture/mobile/integration", summary: "Full-chip workload scenarios.", topics: ["workload", "integration", "camera", "game"], active: true, category: "isa" },
];

const COMPARE_LABS: StudioInfo[] = [
  { id: "cmp-overview", title: "ISA Comparison Overview", phase: 7, path: "/architecture/compare/overview", summary: "Design philosophy, instruction style, and typical use.", topics: ["overview", "design philosophy", "comparison dimensions"], active: true, category: "isa" },
  { id: "cmp-registers", title: "Register Models", phase: 7, path: "/architecture/compare/register-models", summary: "x0–x31, X0–X30, and RAX aliases.", topics: ["register", "alias", "abi", "x0", "rax"], active: true, category: "isa" },
  { id: "cmp-encoding", title: "Instruction Encoding", phase: 7, path: "/architecture/compare/instruction-encoding", summary: "RISC-V, AArch64, and x86 field layouts.", topics: ["encoding", "opcode", "modr/m", "sib", "funct7"], active: true, category: "isa" },
  { id: "cmp-length", title: "Instruction Length", phase: 7, path: "/architecture/compare/instruction-length", summary: "Fixed 32-bit streams and a variable x86 fetch window.", topics: ["instruction length", "fetch window", "variable length"], active: true, category: "isa" },
  { id: "cmp-memory", title: "Memory Access", phase: 7, path: "/architecture/compare/memory-access", summary: "Load/store versus a memory operand.", topics: ["memory", "load", "store", "load/store"], active: true, category: "isa" },
  { id: "cmp-addressing", title: "Addressing", phase: 7, path: "/architecture/compare/addressing", summary: "Base, index, scale, and displacement.", topics: ["addressing", "effective address", "scale", "displacement"], active: true, category: "isa" },
  { id: "cmp-task", title: "Same Task Comparison", phase: 7, path: "/architecture/compare/same-task", summary: "Sum an array in three ISAs.", topics: ["same task", "array sum"], active: true, category: "isa" },
  { id: "cmp-decode", title: "Decode Complexity Concept", phase: 7, path: "/architecture/compare/decode-complexity", summary: "Simplified front-end comparison, including x86 decode.", topics: ["decode", "x86 decode", "micro-op", "boundary", "µop"], active: true, category: "isa" },
  { id: "cmp-eco", title: "Ecosystem Roles", phase: 7, path: "/architecture/compare/ecosystem-roles", summary: "Illustrative domains for RISC-V, ARM, and x86.", topics: ["ecosystem", "mobile", "embedded", "server", "iot"], active: true, category: "isa" },
];

export function searchStudios(query: string): StudioInfo[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const rank = (item: StudioInfo) => {
    const title = item.title.toLowerCase();
    const blob = `${item.summary} ${item.topics.join(" ")} ${item.category}`.toLowerCase();
    if (title.includes(q)) return 0;
    if (blob.includes(q)) return 1;
    return 2;
  };
  const acaSearch: StudioInfo[] = ACA_LABS.map((lab) => ({
    id: `aca-${lab.id}`,
    title: lab.title,
    phase: 5,
    path: acaRoute(lab.slug),
    summary: lab.description,
    topics: [lab.slug, lab.category],
    active: true,
    category: "systems",
  }));
  return [...COMPARE_LABS, ...MOBILE_LABS, ...DESKTOP_LABS, ...acaSearch, ...STUDIOS]
    .filter((item) => rank(item) < 2)
    .sort((a, b) => rank(a) - rank(b) || (a.id.startsWith("cmp") ? -1 : 1))
    .slice(0, 8);
}
