export type AcaCategoryId = "ilp" | "branch" | "ooo" | "coherence" | "memory" | "multicore" | "performance";

export interface AcaCategory {
  id: AcaCategoryId;
  title: string;
  menu: string;
  description: string;
}

export interface AcaLab {
  id: string;
  title: string;
  slug: string;
  category: AcaCategoryId;
  description: string;
}

export const ACA_HOME = "/studios/advanced-computer-architecture";

export const ACA_CATEGORIES: AcaCategory[] = [
  { id: "ilp", title: "Instruction-Level Parallelism", menu: "Instruction-Level Parallelism", description: "Hazards, scoreboarding, Tomasulo, renaming, and in-order commit." },
  { id: "branch", title: "Branch Prediction & Speculation", menu: "Branch Prediction", description: "Counters, correlation, target buffers, hybrid choosers, and recovery." },
  { id: "ooo", title: "Out-of-Order & Superscalar Execution", menu: "Out-of-Order CPU", description: "Wide pipelines, issue queues, rename maps, memory queues, and ports." },
  { id: "coherence", title: "Cache Coherence", menu: "Cache Coherence", description: "Snooping protocols, directories, false sharing, and coherence traffic." },
  { id: "memory", title: "Advanced Memory Systems", menu: "Memory Systems", description: "Non-blocking caches, prefetchers, and the DRAM controller." },
  { id: "multicore", title: "Multicore & Synchronization", menu: "Multicore", description: "Consistency, atomics, and parallel speedup." },
  { id: "performance", title: "Performance Analysis", menu: "Performance", description: "Roofline, CPI and IPC, and performance counters." },
];

export const ACA_LABS: AcaLab[] = [
  { id: "data-hazards", title: "Data Hazards & Instruction Scheduling", slug: "data-hazards", category: "ilp", description: "Explore RAW, WAR, and WAW hazards, pipeline stalls, forwarding, and instruction scheduling." },
  { id: "scoreboard", title: "Dynamic Scheduling with Scoreboard", slug: "scoreboard", category: "ilp", description: "Visualize functional-unit availability, operand dependencies, issue, read, execute, and write stages." },
  { id: "tomasulo", title: "Tomasulo Algorithm Simulator", slug: "tomasulo", category: "ilp", description: "Explore reservation stations, register tags, operand forwarding, and dynamic scheduling." },
  { id: "register-renaming", title: "Scoreboarding with Register Renaming", slug: "register-renaming", category: "ilp", description: "Understand how register renaming eliminates false WAR and WAW dependencies." },
  { id: "reorder-buffer", title: "Out-of-Order Execution & In-Order Commit", slug: "reorder-buffer", category: "ilp", description: "Follow instructions through issue, execution, writeback, retirement, and precise in-order commit." },
  { id: "branch-predictor", title: "1-Bit & 2-Bit Branch Predictor", slug: "branch-predictor", category: "branch", description: "Explore state-machine-based branch prediction and observe misprediction behavior." },
  { id: "correlating-predictor", title: "Correlating Branch Predictor", slug: "correlating-predictor", category: "branch", description: "Explore local and global branch history and correlated prediction." },
  { id: "branch-target-buffer", title: "Branch Target Buffer Explorer", slug: "branch-target-buffer", category: "branch", description: "Explore BTB lookup, hit/miss behavior, targets, tags, and prediction flow." },
  { id: "tournament-predictor", title: "Tournament & Hybrid Predictor", slug: "tournament-predictor", category: "branch", description: "Compare local, global, bimodal, and hybrid predictors with an adaptive chooser." },
  { id: "speculative-execution", title: "Speculative Execution & Recovery", slug: "speculative-execution", category: "branch", description: "Visualize speculative execution, checkpoints, misprediction recovery, and pipeline flushing." },
  { id: "superscalar", title: "Superscalar Pipeline Explorer", slug: "superscalar", category: "ooo", description: "Explore wide fetch, decode, issue, execute, and retirement pipelines." },
  { id: "issue-queue", title: "Instruction Window & Issue Queue", slug: "issue-queue", category: "ooo", description: "Visualize wakeup, dependency resolution, selection, and execution scheduling." },
  { id: "physical-register-file", title: "Physical Register File & Rename Map", slug: "physical-register-file", category: "ooo", description: "Explore RAT mappings, free lists, physical registers, and architectural state." },
  { id: "load-store-queue", title: "Load / Store Queue Simulator", slug: "load-store-queue", category: "ooo", description: "Explore memory ordering, forwarding, violations, replay, and dependency tracking." },
  { id: "memory-disambiguation", title: "Memory Disambiguation", slug: "memory-disambiguation", category: "ooo", description: "Explore how processors predict memory dependencies and safely execute loads early." },
  { id: "execution-ports", title: "Execution Port & Functional Unit Scheduler", slug: "execution-ports", category: "ooo", description: "Explore execution-port contention, operation mapping, throughput, and latency." },
  { id: "mesi", title: "MSI & MESI Coherence Simulator", slug: "mesi", category: "coherence", description: "Explore coherence state transitions and shared-memory interactions across processor caches." },
  { id: "moesi", title: "MOESI Coherence Simulator", slug: "moesi", category: "coherence", description: "Explore Modified, Owned, Exclusive, Shared, and Invalid cache states." },
  { id: "directory-coherence", title: "Directory-Based Cache Coherence", slug: "directory-coherence", category: "coherence", description: "Visualize sharer tracking, invalidations, ownership, and directory messages." },
  { id: "false-sharing", title: "False Sharing Visualizer", slug: "false-sharing", category: "coherence", description: "Understand cache-line contention caused by independent variables sharing the same line." },
  { id: "coherence-traffic", title: "Cache-Coherence Traffic Analyzer", slug: "coherence-traffic", category: "coherence", description: "Analyze reads, upgrades, invalidations, writebacks, and cache-line movement." },
  { id: "snooping-vs-directory", title: "Snooping vs Directory Coherence", slug: "snooping-vs-directory", category: "coherence", description: "Compare coherence traffic, scalability, latency, and protocol behavior." },
  { id: "mshr", title: "Non-Blocking Cache & MSHR Lab", slug: "mshr", category: "memory", description: "Explore hit-under-miss, miss-under-miss, MSHRs, and outstanding memory requests." },
  { id: "prefetching", title: "Hardware Prefetcher Laboratory", slug: "prefetching", category: "memory", description: "Experiment with next-line, stride, stream, and correlation-based prefetching." },
  { id: "dram-controller", title: "DRAM Bank & Memory Controller Simulator", slug: "dram-controller", category: "memory", description: "Explore channels, ranks, banks, rows, row-buffer hits, conflicts, and memory scheduling." },
  { id: "memory-consistency", title: "Memory Consistency Model Explorer", slug: "memory-consistency", category: "multicore", description: "Compare sequential consistency, TSO, weaker ordering, acquire-release, and memory fences." },
  { id: "atomic-operations", title: "Atomic Operations & Synchronization", slug: "atomic-operations", category: "multicore", description: "Explore compare-and-swap, fetch-and-add, LL/SC, spinlocks, ticket locks, and contention." },
  { id: "amdahl", title: "Multicore Scaling & Amdahl's Law", slug: "amdahl", category: "multicore", description: "Explore parallel speedup, serial bottlenecks, efficiency, communication, and synchronization overhead." },
  { id: "roofline", title: "Roofline Analysis", slug: "roofline", category: "performance", description: "Explore arithmetic intensity, memory bandwidth, peak compute performance, and bottlenecks." },
  { id: "cpi-ipc", title: "CPI / IPC Bottleneck Analyzer", slug: "cpi-ipc", category: "performance", description: "Analyze execution bottlenecks caused by branches, dependencies, cache misses, and memory latency." },
  { id: "performance-counters", title: "CPU Performance Counter Laboratory", slug: "performance-counters", category: "performance", description: "Explore cycles, instructions, IPC, cache misses, branches, TLB activity, stalls, and memory traffic." },
];

export function acaRoute(slug: string): string {
  return `${ACA_HOME}/${slug}`;
}

export function acaLab(slug: string | undefined): AcaLab | undefined {
  return ACA_LABS.find((lab) => lab.slug === slug);
}

export function acaCategory(id: AcaCategoryId): AcaCategory {
  const found = ACA_CATEGORIES.find((category) => category.id === id);
  if (!found) throw new Error(`Unknown ACA category ${id}`);
  return found;
}
