import { PART3_STUDIOS } from "./part3-studios";
import { PART4_STUDIOS } from "./part4-studios";

export interface ArchLab {
  id: string;
  title: string;
  guide: string[];
  takeaways: string[];
  theory?: string;
}

export interface ArchStudioDef {
  id: string;
  title: string;
  summary: string;
  path: string;
  labs: ArchLab[];
}

export const ARCH_STUDIOS: ArchStudioDef[] = [
  {
    id: "accelerator",
    title: "AI Accelerator / TPU / NPU",
    summary: "MAC units, systolic arrays, quantization, and a neural execution pipeline.",
    path: "/architecture/accelerator",
    labs: [
      { id: "overview", title: "Overview", guide: ["Open a lab from this studio menu only.", "Start with the MAC unit, then grow to arrays.", "Compare dataflow and memory next."], takeaways: ["Accelerators spend energy moving data as well as multiplying.", "A MAC is the inner loop of dense layers."], theory: "An AI accelerator is organized around repeated multiply-accumulate and the SRAM/DRAM path that feeds it. This studio is a teaching datapath, not a TPU die photo." },
      { id: "mac", title: "MAC Unit", guide: ["Set A, B, and the accumulator.", "Step once: product then add.", "Repeat to keep accumulating."], takeaways: ["MAC computes a × b + acc.", "Repeated MACs form a dot product."], theory: "A MAC is one multiplier followed by an adder into an accumulator: acc ← acc + a×b. A dot product is that loop unrolled in time or space." },
      { id: "array", title: "MAC Array", guide: ["Pick a 2×2, 4×4, or 8×8 grid.", "Step or play to watch activity spread.", "Each cell is a conceptual MAC, not a transistor model."], takeaways: ["Arrays raise throughput by spatial replication.", "Data still has to arrive on time."], theory: "Replicating MACs raises peak throughput only if operands arrive. The grid here is conceptual cells, not a place-and-route." },
      { id: "matmul", title: "Matrix Multiplication", guide: ["Edit the small matrices.", "Step through scalar, vector, or systolic scheduling.", "Inspect partial sums before the final C."], takeaways: ["C[i][j] is a dot product.", "Scheduling changes when values move, not the math."], theory: "C[i][j] is always a dot product of a row and a column. Scalar, vector, and systolic schedules change when values move, not the algebra." },
      { id: "systolic", title: "Systolic Array", guide: ["Load a small preset.", "Step clock by clock.", "Watch activations, weights, and partial sums."], takeaways: ["Values pulse through neighboring PEs.", "The clock counts educational cycles, not a vendor part."], theory: "In a systolic array each PE keeps a local MAC and passes neighbors on the next tick. The clock here counts teaching cycles, not a Google TPU part." },
      { id: "dataflow", title: "Dataflow Strategies", guide: ["Choose weight, output, or activation stationary.", "Read what stays local versus what moves.", "Compare conceptual traffic, not a ranking."], takeaways: ["Stationary names the tensor that is reused in place.", "No single dataflow wins for every shape."], theory: "Stationary names which tensor stays in PE memory while the others stream. Weight, output, and activation stationary are traffic choices, not a ranking." },
      { id: "memory", title: "Memory Hierarchy", guide: ["Follow DRAM → SRAM → buffers → MAC.", "Compare relative latency and bandwidth.", "Raise reuse to cut traffic."], takeaways: ["Bandwidth and reuse dominate accelerator design.", "Numbers here are relative teaching values."], theory: "Accelerators are often memory-bound: DRAM, on-chip SRAM, then MAC buffers. Reuse cuts traffic; the latencies here are relative teaching values." },
      { id: "quant", title: "Quantization", guide: ["Edit the tiny tensor.", "Compare FP32, FP16, BF16, and INT8.", "Watch storage shrink and error appear."], takeaways: ["INT8 stores one byte per value.", "Quantization error is the gap after dequantization."], theory: "Quantization stores each value in fewer bits (INT8 is one byte). Error is the gap after you scale back; this lab shows that gap, not a training recipe." },
      { id: "mixed", title: "Mixed Precision", guide: ["Pick compute and accumulate formats.", "Compare storage, density, and use case.", "Treat speedups as conceptual, not vendor claims."], takeaways: ["Compute can be narrower than the accumulator.", "INT8 is common in inference; FP16/BF16 in training."], theory: "Compute can be narrower than the accumulator so products do not overflow the running sum. Speedups here are conceptual, not a vendor claim." },
      { id: "infer", title: "Inference vs Training", guide: ["Toggle inference and training views.", "Follow forward, loss, backward, and update.", "Note the extra memory of training."], takeaways: ["Inference is a forward pass on frozen weights.", "Training stores activations for the backward pass."], theory: "Inference is a forward pass on frozen weights. Training keeps activations for the backward pass, so the memory picture is larger." },
      { id: "npu", title: "NPU Architecture", guide: ["Click each block.", "Play a small inference request.", "Watch DMA, SRAM, MAC, and activation."], takeaways: ["An NPU is a scheduled data-mover plus a tensor engine.", "Controller and DMA are as important as the array."], theory: "An NPU is a scheduled data-mover plus a tensor engine. DMA and the controller matter as much as the MAC array on this sketch." },
      { id: "pipeline", title: "Neural Execution Pipeline", guide: ["Follow input → dense → activation → dense → output.", "See weights load before MACs.", "Watch writeback of the result."], takeaways: ["Layers are a pipeline of tensor ops.", "Activation is pointwise after the MAC reduction."], theory: "A dense layer is a matrix-vector (or matrix-matrix) multiply, then a pointwise activation. Weights load before MACs; the result writes back after the reduction." },
    ],
  },
  {
    id: "hetero",
    title: "Heterogeneous Computing",
    summary: "CPU, GPU, NPU, and DSP roles, routing, offload, and synchronization.",
    path: "/architecture/hetero",
    labs: [
      { id: "overview", title: "Overview", guide: ["Stay inside this studio's labs.", "Assign work by architectural fit, not brand names."], takeaways: ["Heterogeneous systems mix processors with different strengths.", "Data movement and sync are part of the cost."], theory: "A heterogeneous system mixes CPUs with accelerators. Fit, copies, and sync are part of the cost — not brand names." },
      { id: "roles", title: "Processor Roles", guide: ["Click CPU, GPU, NPU, and DSP.", "Read typical strengths.", "Keep the descriptions architectural."], takeaways: ["CPUs orchestrate; accelerators specialize.", "A role is a tendency, not a law."], theory: "CPUs orchestrate; GPUs, NPUs, and DSPs specialize. A role is a tendency for this lab, not a law of physics." },
      { id: "router", title: "Task Router", guide: ["Assign each workload by hand.", "Watch time, energy, and queues.", "Compare with Auto route."], takeaways: ["Queues grow when many jobs share a unit.", "Figures are educational, not physical measurements."], theory: "Routing a job to a busy unit grows a queue. Time and energy figures here are educational, not bench measurements." },
      { id: "partition", title: "Workload Partitioning", guide: ["Assign Camera App tasks.", "Run them together.", "See overlapping processors."], takeaways: ["One app is a graph of heterogeneous tasks.", "Simultaneous execution is the point of the SoC."], theory: "One app is a graph of tasks that can overlap on different processors. Simultaneous execution is the point of the SoC picture." },
      { id: "offload", title: "Accelerator Offload", guide: ["Change the transfer size.", "Compare CPU-only versus offload.", "Find when copies dominate."], takeaways: ["Offload pays a transfer tax.", "Tiny jobs can be cheaper on the CPU."], theory: "Offload pays a copy tax to move operands and results. Tiny jobs can stay cheaper on the CPU when that tax dominates." },
      { id: "memory", title: "Shared Memory", guide: ["Toggle separate versus unified.", "Watch the copy disappear in the unified sketch.", "Remember platforms differ."], takeaways: ["Separate memories need copies.", "Unified addressing does not erase coherence questions."], theory: "Separate memories need explicit copies. Unified addressing lets both sides name the bytes; it does not erase coherence." },
      { id: "unified", title: "Unified Memory", guide: ["Compare both models on the same buffer.", "Note that details vary by architecture."], takeaways: ["Unified means both sides can name the bytes.", "Implementation still varies."], theory: "Unified means both processors can name the same buffer. How cache and migration work still varies by platform." },
      { id: "interconnect", title: "Interconnect", guide: ["Let CPU, GPU, NPU, and DSP inject traffic.", "Watch contention when several request at once."], takeaways: ["A shared fabric serializes competing bursts.", "Request and response both occupy links."], theory: "A shared fabric serializes competing bursts. Request and response both occupy the teaching links." },
      { id: "sync", title: "Synchronization", guide: ["Step GPU complete → CPU fence → next submit.", "Treat fence/event as a teaching model."], takeaways: ["Producers post completion; consumers wait.", "Without a fence, the next task can race."], theory: "Producers post completion; consumers wait on a fence or event. Without that wait, the next submit can race." },
      { id: "timeline", title: "System Timeline", guide: ["Play the camera-app schedule.", "Read overlapping bars as concurrent processors."], takeaways: ["The wall-clock is the longest path plus sync.", "Idle processors still cost power if left on."], theory: "Wall-clock time is the longest path plus sync waits. Overlapping bars are concurrent processors; idle units still cost power if left on." },
    ],
  },
  {
    id: "soc",
    title: "SoC Architecture Explorer",
    summary: "Floorplan, NoC, system cache, power domains, and chip-level dataflow.",
    path: "/architecture/soc",
    labs: [
      { id: "overview", title: "Overview", guide: ["Open the floorplan first.", "Then follow a dataflow preset."], takeaways: ["An SoC is many specialized engines around shared DRAM.", "The interconnect is the meeting place."] },
      { id: "floorplan", title: "SoC Floorplan", guide: ["Click any block.", "Read purpose, paths, and typical data."], takeaways: ["Blocks are conceptual, not a taped-out die photo.", "Communication paths beat isolated boxes."] },
      { id: "cluster", title: "CPU Cluster", guide: ["Inspect the cluster block.", "See how it reaches cache and accelerators."], takeaways: ["The CPU cluster still orchestrates the chip.", "It is one client of the system cache."] },
      { id: "engines", title: "GPU / NPU / DSP", guide: ["Compare the three accelerators on the floorplan.", "Note different data they handle."], takeaways: ["GPU, NPU, and DSP share the die but not the ISA.", "Each has a preferred traffic pattern."] },
      { id: "memory", title: "Memory System", guide: ["Follow clients into the system cache and controller.", "Step hits and misses."], takeaways: ["Shared DRAM is the backing store.", "A system cache absorbs repeated lines."] },
      { id: "interconnect", title: "Interconnect", guide: ["Watch request/response on the fabric.", "Add more masters to see contention."], takeaways: ["Many clients share one conceptual bus or NoC.", "Fairness and priority are policy, not physics here."] },
      { id: "noc", title: "Network-on-Chip", guide: ["Pick source and destination.", "Show shortest path.", "Inject a second packet to see contention."], takeaways: ["Packets hop through routers.", "This is a teaching mesh, not a silicon NoC."] },
      { id: "io", title: "I/O & Peripherals", guide: ["Click I/O, display, and codec.", "Connect them to a dataflow."], takeaways: ["Peripherals are first-class SoC clients.", "They generate memory traffic too."] },
      { id: "media", title: "Media / ISP", guide: ["Run Camera Capture and Video Playback.", "See ISP versus codec paths."], takeaways: ["ISP processes sensor frames; codecs handle bitstreams.", "Display engine is the last hop to the panel."] },
      { id: "power", title: "Power & Clock Domains", guide: ["Cycle Active → Idle → Clock Gated → Power Gated.", "Keep domains independent."], takeaways: ["Clock gating stops toggling; power gating drops a rail conceptually.", "Always-on logic stays awake."] },
      { id: "dataflow", title: "Full SoC Dataflow", guide: ["Play Camera, Video, or AI Camera.", "Follow the highlighted path."], takeaways: ["Use-cases light different engines.", "Memory is on almost every path."] },
    ],
  },
  {
    id: "cpu8",
    title: "Educational 8-bit CPU",
    summary: "Accumulator datapath, teaching ISA, assembler, and clock-by-clock execution.",
    path: "/architecture/cpu8",
    labs: [
      { id: "overview", title: "Overview", guide: ["Read the ISA subset.", "Load the 5 + 3 program.", "Step until HLT."], takeaways: ["This CPU is a teaching model with A, B, PC, IR, MAR, flags, and 256 bytes of RAM.", "It is not a historical chip replica."] },
      { id: "arch", title: "CPU Architecture", guide: ["Click registers and the ALU.", "Follow the shared bus."], takeaways: ["One bus means one transfer per micro-step.", "The control unit sequences those transfers."] },
      { id: "registers", title: "Registers", guide: ["Watch binary, hex, and decimal together.", "Step to see highlights on change."], takeaways: ["Width is 8 bits everywhere on this datapath.", "Unsigned decimal is one reading of those bits."] },
      { id: "alu", title: "ALU", guide: ["Try ADD through CMP.", "Read Z, C, N, and V."], takeaways: ["Flags come from the same ALU used in Phase 2.", "Compare updates flags without writing A."] },
      { id: "isa", title: "Instruction Set", guide: ["Browse the compact teaching ISA.", "Assemble a short program."], takeaways: ["Immediates and addresses use a second byte.", "HLT and ALU ops are one byte."] },
      { id: "encoding", title: "Instruction Encoding", guide: ["Pick an opcode and operand.", "See field boundaries in binary."], takeaways: ["The first byte is the opcode.", "The second byte, when present, is imm/addr."] },
      { id: "memory", title: "Memory", guide: ["Scan the RAM table.", "Watch fetch, read, and write highlights."], takeaways: ["Instructions and data share the 256-byte array.", "Addresses are 8-bit."] },
      { id: "fde", title: "Fetch–Decode–Execute", guide: ["Micro-step through MAR, IR, decode, execute.", "Then try whole-instruction stepping."], takeaways: ["Fetch writes IR from memory.", "PC advances during fetch, then execute may load it."] },
      { id: "control", title: "Control Signals", guide: ["Read the active signals each clock.", "Match them to bus sources."], takeaways: ["Signals name the transfer, not a vendor CU.", "Only a few are high each micro-op."] },
      { id: "editor", title: "Program Editor", guide: ["Write assembly.", "Assemble, load, step, and run.", "Fix syntax errors from the message list."], takeaways: ["The assembler never leaves this browser.", "Errors name the line and the rule."] },
      { id: "clock", title: "Clock-by-Clock Execution", guide: ["Use Previous / Next / Restart.", "History is bounded."], takeaways: ["Each clock is one micro-operation.", "Bounded history keeps the lab snappy."] },
      { id: "visual", title: "Full CPU Visualizer", guide: ["Watch registers, bus, ALU, and RAM together.", "Avoid reading every wire at once—follow the highlighted path."], takeaways: ["The picture is the same machine as the debugger.", "Clutter is reduced by lighting only the active transfer."] },
    ],
  },
  {
    id: "cpu16",
    title: "Educational 16-bit CPU",
    summary: "LogicLab-16 datapath, register file, CALL/RET, stack, and a simple interrupt model.",
    path: "/architecture/cpu16",
    labs: [
      { id: "overview", title: "Overview", guide: ["This studio extends LogicLab-16.", "Open the workspace and run a sample."], takeaways: ["The datapath is 16 bits with eight registers.", "CALL/RET use R7 as the stack pointer."] },
      { id: "datapath", title: "16-bit Datapath", guide: ["Follow register → ALU → memory.", "Compare width with the 8-bit studio."], takeaways: ["Width changes how much moves per transfer.", "Address size in this teaching CPU stays 8-bit word addresses."] },
      { id: "regs", title: "Register File", guide: ["Watch R0–R7 plus PC, SP, flags.", "Step to see read and write ports."], takeaways: ["R0 is a normal register that often holds zero by convention in examples.", "R7 is SP for CALL/RET."] },
      { id: "alu", title: "ALU & Flags", guide: ["Execute ADD/SUB/logic/shifts.", "Read Z, C, N, V."], takeaways: ["Flags reuse the shared ALU engine.", "Overflow is two's-complement overflow."] },
      { id: "isa", title: "Instruction Set", guide: ["Review LogicLab-16 families.", "Assemble ADDI, LOAD, BEQ, CALL."], takeaways: ["Formats are R, I, S, B, J.", "Unknown mnemonics are rejected by the assembler."] },
      { id: "formats", title: "Instruction Formats", guide: ["Inspect opcode, rd, rs, function, and immediate fields.", "Widths are exact for this ISA."], takeaways: ["Field widths are part of the contract.", "Immediates that do not fit are assembler errors."] },
      { id: "memory", title: "Memory & Addressing", guide: ["Animate LOAD and STORE.", "Use offset(Rn) addressing."], takeaways: ["Effective address is base + offset.", "Data memory is word-addressable here."] },
      { id: "branch", title: "Branching", guide: ["Try J, BEQ, and BNE.", "Watch PC when the condition holds."], takeaways: ["Offsets are PC-relative from the instruction address.", "Not-taken leaves PC at the sequential value."] },
      { id: "stack", title: "Stack", guide: ["PUSH then POP.", "Watch SP move."], takeaways: ["PUSH decrements R7 then writes.", "POP reads then increments R7."] },
      { id: "call", title: "Procedure Call / Return", guide: ["Run CALL then RET.", "See the return address on the stack."], takeaways: ["CALL stores the next PC at Mem[R7].", "RET restores it."] },
      { id: "irq", title: "Interrupt Concept", guide: ["Run a program, raise IRQ, service, then return.", "Read the educational disclaimer."], takeaways: ["IRQ is taken at an instruction boundary.", "This is not a specific platform's exception hardware."] },
      { id: "workspace", title: "Program Workspace", guide: ["Assemble, run, pause, step instruction or clock, reset.", "Watch assembly, words, registers, memory, stack, flags."], takeaways: ["The workspace is the same engine as the other labs.", "Halt ends the run."] },
      { id: "debug", title: "Execution Debugger", guide: ["Step clock-by-clock.", "Read PC, IR, registers, and flags."], takeaways: ["Five sub-cycles make one instruction.", "History stays bounded."] },
      { id: "compare", title: "8-bit vs 16-bit", guide: ["Read each trait.", "Do not rank the machines as simply better."], takeaways: ["Width and the register file change capability.", "Neither teaching CPU is a product ranking."] },
    ],
  },
  ...PART3_STUDIOS,
  ...PART4_STUDIOS,
];

export function archStudio(id: string): ArchStudioDef | undefined {
  return ARCH_STUDIOS.find((item) => item.id === id);
}

export function archLab(studioId: string, labId: string): ArchLab | undefined {
  const studio = archStudio(studioId);
  return studio?.labs.find((item) => item.id === labId) ?? studio?.labs[0];
}

export function labTheory(studio: ArchStudioDef, lab: ArchLab): string {
  if (lab.theory) return lab.theory;
  const start = lab.guide[0] ?? "Follow the numbered steps.";
  return `${lab.title} is a lab in ${studio.title}. ${studio.summary} Start here: ${start} Figures on this canvas are teaching values, not a vendor datasheet.`;
}

export interface ConceptMap {
  id: number;
  title: string;
  studio: string;
  lab: string;
  route: string;
  interactive: true;
}

export const CONCEPTS_113_200: ConceptMap[] = [
  { id: 113, title: "AI Accelerator Concept", studio: "accelerator", lab: "overview", route: "/architecture/accelerator/overview", interactive: true },
  { id: 114, title: "Tensor Operations", studio: "accelerator", lab: "matmul", route: "/architecture/accelerator/matmul", interactive: true },
  { id: 115, title: "Matrix Multiplication", studio: "accelerator", lab: "matmul", route: "/architecture/accelerator/matmul", interactive: true },
  { id: 116, title: "Multiply-Accumulate", studio: "accelerator", lab: "mac", route: "/architecture/accelerator/mac", interactive: true },
  { id: 117, title: "MAC Unit", studio: "accelerator", lab: "mac", route: "/architecture/accelerator/mac", interactive: true },
  { id: 118, title: "MAC Array", studio: "accelerator", lab: "array", route: "/architecture/accelerator/array", interactive: true },
  { id: 119, title: "Systolic Array", studio: "accelerator", lab: "systolic", route: "/architecture/accelerator/systolic", interactive: true },
  { id: 120, title: "Activation Storage", studio: "accelerator", lab: "memory", route: "/architecture/accelerator/memory", interactive: true },
  { id: 121, title: "Weight Storage", studio: "accelerator", lab: "memory", route: "/architecture/accelerator/memory", interactive: true },
  { id: 122, title: "On-Chip SRAM", studio: "accelerator", lab: "memory", route: "/architecture/accelerator/memory", interactive: true },
  { id: 123, title: "Off-Chip DRAM", studio: "accelerator", lab: "memory", route: "/architecture/accelerator/memory", interactive: true },
  { id: 124, title: "Memory Bandwidth", studio: "accelerator", lab: "memory", route: "/architecture/accelerator/memory", interactive: true },
  { id: 125, title: "Data Reuse", studio: "accelerator", lab: "memory", route: "/architecture/accelerator/memory", interactive: true },
  { id: 126, title: "Weight Stationary", studio: "accelerator", lab: "dataflow", route: "/architecture/accelerator/dataflow", interactive: true },
  { id: 127, title: "Output Stationary", studio: "accelerator", lab: "dataflow", route: "/architecture/accelerator/dataflow", interactive: true },
  { id: 128, title: "Activation Stationary Concept", studio: "accelerator", lab: "dataflow", route: "/architecture/accelerator/dataflow", interactive: true },
  { id: 129, title: "Quantization", studio: "accelerator", lab: "quant", route: "/architecture/accelerator/quant", interactive: true },
  { id: 130, title: "INT8", studio: "accelerator", lab: "quant", route: "/architecture/accelerator/quant", interactive: true },
  { id: 131, title: "FP16", studio: "accelerator", lab: "quant", route: "/architecture/accelerator/quant", interactive: true },
  { id: 132, title: "BF16 Concept", studio: "accelerator", lab: "quant", route: "/architecture/accelerator/quant", interactive: true },
  { id: 133, title: "Mixed Precision", studio: "accelerator", lab: "mixed", route: "/architecture/accelerator/mixed", interactive: true },
  { id: 134, title: "Inference", studio: "accelerator", lab: "infer", route: "/architecture/accelerator/infer", interactive: true },
  { id: 135, title: "Training", studio: "accelerator", lab: "infer", route: "/architecture/accelerator/infer", interactive: true },
  { id: 136, title: "NPU", studio: "accelerator", lab: "npu", route: "/architecture/accelerator/npu", interactive: true },
  { id: 137, title: "TPU Concept", studio: "accelerator", lab: "npu", route: "/architecture/accelerator/npu", interactive: true },
  { id: 138, title: "Neural-Network Execution Pipeline", studio: "accelerator", lab: "pipeline", route: "/architecture/accelerator/pipeline", interactive: true },
  { id: 139, title: "Heterogeneous Processor", studio: "hetero", lab: "overview", route: "/architecture/hetero/overview", interactive: true },
  { id: 140, title: "CPU + GPU", studio: "hetero", lab: "roles", route: "/architecture/hetero/roles", interactive: true },
  { id: 141, title: "CPU + NPU", studio: "hetero", lab: "roles", route: "/architecture/hetero/roles", interactive: true },
  { id: 142, title: "CPU + DSP", studio: "hetero", lab: "roles", route: "/architecture/hetero/roles", interactive: true },
  { id: 143, title: "Specialized Accelerator", studio: "hetero", lab: "offload", route: "/architecture/hetero/offload", interactive: true },
  { id: 144, title: "Task Scheduling", studio: "hetero", lab: "router", route: "/architecture/hetero/router", interactive: true },
  { id: 145, title: "Workload Partitioning", studio: "hetero", lab: "partition", route: "/architecture/hetero/partition", interactive: true },
  { id: 146, title: "Shared Memory Concept", studio: "hetero", lab: "memory", route: "/architecture/hetero/memory", interactive: true },
  { id: 147, title: "Unified Memory Concept", studio: "hetero", lab: "unified", route: "/architecture/hetero/unified", interactive: true },
  { id: 148, title: "Interconnect", studio: "hetero", lab: "interconnect", route: "/architecture/hetero/interconnect", interactive: true },
  { id: 149, title: "Accelerator Offload", studio: "hetero", lab: "offload", route: "/architecture/hetero/offload", interactive: true },
  { id: 150, title: "Synchronization", studio: "hetero", lab: "sync", route: "/architecture/hetero/sync", interactive: true },
  { id: 151, title: "SoC Concept", studio: "soc", lab: "overview", route: "/architecture/soc/overview", interactive: true },
  { id: 152, title: "CPU Cluster", studio: "soc", lab: "cluster", route: "/architecture/soc/cluster", interactive: true },
  { id: 153, title: "GPU", studio: "soc", lab: "engines", route: "/architecture/soc/engines", interactive: true },
  { id: 154, title: "NPU", studio: "soc", lab: "engines", route: "/architecture/soc/engines", interactive: true },
  { id: 155, title: "DSP", studio: "soc", lab: "engines", route: "/architecture/soc/engines", interactive: true },
  { id: 156, title: "Memory Controller", studio: "soc", lab: "memory", route: "/architecture/soc/memory", interactive: true },
  { id: 157, title: "System Cache", studio: "soc", lab: "memory", route: "/architecture/soc/memory", interactive: true },
  { id: 158, title: "Interconnect", studio: "soc", lab: "interconnect", route: "/architecture/soc/interconnect", interactive: true },
  { id: 159, title: "I/O Controller", studio: "soc", lab: "io", route: "/architecture/soc/io", interactive: true },
  { id: 160, title: "Display Engine", studio: "soc", lab: "io", route: "/architecture/soc/io", interactive: true },
  { id: 161, title: "Image Signal Processor", studio: "soc", lab: "media", route: "/architecture/soc/media", interactive: true },
  { id: 162, title: "Security Engine Concept", studio: "soc", lab: "floorplan", route: "/architecture/soc/floorplan", interactive: true },
  { id: 163, title: "Media Codec", studio: "soc", lab: "media", route: "/architecture/soc/media", interactive: true },
  { id: 164, title: "Power Management", studio: "soc", lab: "power", route: "/architecture/soc/power", interactive: true },
  { id: 165, title: "Clock Domains", studio: "soc", lab: "power", route: "/architecture/soc/power", interactive: true },
  { id: 166, title: "NoC Concept", studio: "soc", lab: "noc", route: "/architecture/soc/noc", interactive: true },
  { id: 167, title: "Peripheral Integration", studio: "soc", lab: "io", route: "/architecture/soc/io", interactive: true },
  { id: 168, title: "Shared DRAM", studio: "soc", lab: "memory", route: "/architecture/soc/memory", interactive: true },
  { id: 169, title: "8-bit Datapath", studio: "cpu8", lab: "arch", route: "/architecture/cpu8/arch", interactive: true },
  { id: 170, title: "8-bit Registers", studio: "cpu8", lab: "registers", route: "/architecture/cpu8/registers", interactive: true },
  { id: 171, title: "Accumulator", studio: "cpu8", lab: "registers", route: "/architecture/cpu8/registers", interactive: true },
  { id: 172, title: "ALU", studio: "cpu8", lab: "alu", route: "/architecture/cpu8/alu", interactive: true },
  { id: 173, title: "PC", studio: "cpu8", lab: "arch", route: "/architecture/cpu8/arch", interactive: true },
  { id: 174, title: "Instruction Register", studio: "cpu8", lab: "arch", route: "/architecture/cpu8/arch", interactive: true },
  { id: 175, title: "Address Register", studio: "cpu8", lab: "arch", route: "/architecture/cpu8/arch", interactive: true },
  { id: 176, title: "Flags", studio: "cpu8", lab: "alu", route: "/architecture/cpu8/alu", interactive: true },
  { id: 177, title: "Control Signals", studio: "cpu8", lab: "control", route: "/architecture/cpu8/control", interactive: true },
  { id: 178, title: "Instruction Encoding", studio: "cpu8", lab: "encoding", route: "/architecture/cpu8/encoding", interactive: true },
  { id: 179, title: "Memory", studio: "cpu8", lab: "memory", route: "/architecture/cpu8/memory", interactive: true },
  { id: 180, title: "Bus", studio: "cpu8", lab: "visual", route: "/architecture/cpu8/visual", interactive: true },
  { id: 181, title: "Fetch", studio: "cpu8", lab: "fde", route: "/architecture/cpu8/fde", interactive: true },
  { id: 182, title: "Decode", studio: "cpu8", lab: "fde", route: "/architecture/cpu8/fde", interactive: true },
  { id: 183, title: "Execute", studio: "cpu8", lab: "fde", route: "/architecture/cpu8/fde", interactive: true },
  { id: 184, title: "Micro-operations", studio: "cpu8", lab: "clock", route: "/architecture/cpu8/clock", interactive: true },
  { id: 185, title: "Simple Programs", studio: "cpu8", lab: "editor", route: "/architecture/cpu8/editor", interactive: true },
  { id: 186, title: "Clock-by-Clock Execution", studio: "cpu8", lab: "clock", route: "/architecture/cpu8/clock", interactive: true },
  { id: 187, title: "16-bit Datapath", studio: "cpu16", lab: "datapath", route: "/architecture/cpu16/datapath", interactive: true },
  { id: 188, title: "16-bit Registers", studio: "cpu16", lab: "regs", route: "/architecture/cpu16/regs", interactive: true },
  { id: 189, title: "Expanded Address Space", studio: "cpu16", lab: "memory", route: "/architecture/cpu16/memory", interactive: true },
  { id: 190, title: "Register File", studio: "cpu16", lab: "regs", route: "/architecture/cpu16/regs", interactive: true },
  { id: 191, title: "More Complex ISA", studio: "cpu16", lab: "isa", route: "/architecture/cpu16/isa", interactive: true },
  { id: 192, title: "Immediate Values", studio: "cpu16", lab: "formats", route: "/architecture/cpu16/formats", interactive: true },
  { id: 193, title: "Memory Load/Store", studio: "cpu16", lab: "memory", route: "/architecture/cpu16/memory", interactive: true },
  { id: 194, title: "Branching", studio: "cpu16", lab: "branch", route: "/architecture/cpu16/branch", interactive: true },
  { id: 195, title: "Stack Pointer", studio: "cpu16", lab: "stack", route: "/architecture/cpu16/stack", interactive: true },
  { id: 196, title: "Procedure Call", studio: "cpu16", lab: "call", route: "/architecture/cpu16/call", interactive: true },
  { id: 197, title: "Return", studio: "cpu16", lab: "call", route: "/architecture/cpu16/call", interactive: true },
  { id: 198, title: "16-bit ALU", studio: "cpu16", lab: "alu", route: "/architecture/cpu16/alu", interactive: true },
  { id: 199, title: "Status Flags", studio: "cpu16", lab: "alu", route: "/architecture/cpu16/alu", interactive: true },
  { id: 200, title: "Simple Interrupt Concept", studio: "cpu16", lab: "irq", route: "/architecture/cpu16/irq", interactive: true },
];

export { CONCEPTS_201_328 } from "./part3-studios";
export { CONCEPTS_329_392 } from "./part4-studios";
