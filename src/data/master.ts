import { ARCH_STUDIOS, CONCEPTS_113_200, type ConceptMap } from "./architecture";
import { CONCEPTS_201_328 } from "./part3-studios";
import { CONCEPTS_329_392 } from "./part4-studios";
import { STUDIOS } from "./curriculum";

export interface CurriculumConcept {
  id: string;
  masterNumber: number;
  title: string;
  studio: string;
  lab: string;
  route: string;
  implemented: boolean;
  interactive: boolean;
}

function row(id: number, title: string, studio: string, lab: string, route: string): CurriculumConcept {
  return { id: String(id), masterNumber: id, title, studio, lab, route, implemented: true, interactive: true };
}

function fromMap(items: ConceptMap[]): CurriculumConcept[] {
  return items.map((item) => row(item.id, item.title, item.studio, item.lab, item.route));
}

const CONCEPTS_1_112: CurriculumConcept[] = [
  row(1, "Bit", "numbers", "bits", "/studios/number-systems?tab=bits"),
  row(2, "Binary Representation", "numbers", "convert", "/studios/number-systems?tab=convert"),
  row(3, "Hexadecimal", "numbers", "convert", "/studios/number-systems?tab=convert"),
  row(4, "Unsigned Integers", "numbers", "convert", "/studios/number-systems?tab=convert"),
  row(5, "Two's Complement", "numbers", "signed", "/studios/number-systems?tab=signed"),
  row(6, "Sign Magnitude", "numbers", "signed", "/studios/number-systems?tab=signed"),
  row(7, "Gray Code", "numbers", "gray", "/studios/number-systems?tab=gray"),
  row(8, "Parity", "numbers", "parity", "/studios/number-systems?tab=parity"),
  row(9, "Hamming Code", "numbers", "hamming", "/studios/number-systems?tab=hamming"),
  row(10, "IEEE-754", "numbers", "ieee", "/studios/number-systems?tab=ieee"),
  row(11, "Range and Overflow of Codes", "numbers", "signed", "/studios/number-systems?tab=signed"),
  row(12, "Base Conversion", "numbers", "convert", "/studios/number-systems?tab=convert"),
  row(13, "Boolean Variable", "boolean", "eval", "/studios/boolean-algebra"),
  row(14, "AND OR NOT", "boolean", "eval", "/studios/boolean-algebra"),
  row(15, "Boolean Expression Evaluation", "boolean", "eval", "/studios/boolean-algebra"),
  row(16, "De Morgan", "boolean", "laws", "/studios/boolean-algebra"),
  row(17, "Absorption and Idempotent", "boolean", "laws", "/studios/boolean-algebra"),
  row(18, "Sum of Products", "boolean", "sop", "/studios/boolean-algebra"),
  row(19, "Product of Sums", "boolean", "pos", "/studios/boolean-algebra"),
  row(20, "Minterm", "boolean", "sop", "/studios/boolean-algebra"),
  row(21, "Maxterm", "boolean", "pos", "/studios/boolean-algebra"),
  row(22, "Algebraic Simplification", "boolean", "simplify", "/studios/boolean-algebra"),
  row(23, "Logic Gate Symbols", "gates", "catalog", "/studios/logic-gates"),
  row(24, "AND Gate", "gates", "and", "/studios/logic-gates"),
  row(25, "OR Gate", "gates", "or", "/studios/logic-gates"),
  row(26, "NOT Gate", "gates", "not", "/studios/logic-gates"),
  row(27, "NAND Gate", "gates", "nand", "/studios/logic-gates"),
  row(28, "NOR Gate", "gates", "nor", "/studios/logic-gates"),
  row(29, "XOR Gate", "gates", "xor", "/studios/logic-gates"),
  row(30, "XNOR Gate", "gates", "xnor", "/studios/logic-gates"),
  row(31, "Tri-state Buffer", "gates", "tri", "/studios/logic-gates"),
  row(32, "Fan-out and Delay", "gates", "timing", "/studios/logic-gates"),
  row(33, "Truth Table", "truth", "build", "/studios/truth-tables"),
  row(34, "Canonical SOP from Table", "truth", "sop", "/studios/truth-tables"),
  row(35, "Canonical POS from Table", "truth", "pos", "/studios/truth-tables"),
  row(36, "Table from Expression", "truth", "expr", "/studios/truth-tables"),
  row(37, "Don't-care in Tables", "truth", "build", "/studios/truth-tables"),
  row(38, "Equivalence by Table", "truth", "build", "/studios/truth-tables"),
  row(39, "Input Combination Sweep", "truth", "build", "/studios/truth-tables"),
  row(40, "Output Column", "truth", "build", "/studios/truth-tables"),
  row(41, "Karnaugh Map", "kmap", "map", "/studios/kmap"),
  row(42, "Gray-coded Cells", "kmap", "map", "/studios/kmap"),
  row(43, "Power-of-Two Groups", "kmap", "map", "/studios/kmap"),
  row(44, "Wraparound Groups", "kmap", "map", "/studios/kmap"),
  row(45, "Prime Implicants", "kmap", "prime", "/studios/kmap"),
  row(46, "Don't-care in K-map", "kmap", "map", "/studios/kmap"),
  row(47, "Quine-McCluskey", "kmap", "qm", "/studios/kmap"),
  row(48, "Simplified Circuit Compare", "kmap", "circuit", "/studios/kmap"),
  row(49, "Combinational Circuit", "combo", "canvas", "/studios/combinational"),
  row(50, "Gate Placement", "combo", "canvas", "/studios/combinational"),
  row(51, "Wires Carrying Values", "combo", "canvas", "/studios/combinational"),
  row(52, "Probes on Nets", "combo", "canvas", "/studios/combinational"),
  row(53, "Half Adder Circuit", "combo", "canvas", "/studios/combinational"),
  row(54, "Combinational Loop Warning", "combo", "canvas", "/studios/combinational"),
  row(55, "Circuit Undo", "combo", "canvas", "/studios/combinational"),
  row(56, "Local Circuit Save", "combo", "canvas", "/studios/combinational"),
  row(57, "Half Adder", "adders", "half", "/studios/adders"),
  row(58, "Full Adder", "adders", "full", "/studios/adders"),
  row(59, "Ripple Carry", "adders", "ripple", "/studios/adders"),
  row(60, "Carry Lookahead", "adders", "cla", "/studios/adders"),
  row(61, "ALU Operations", "adders", "alu", "/studios/adders"),
  row(62, "Shifter", "adders", "shift", "/studios/adders"),
  row(63, "Binary Multiply Sketch", "adders", "mul", "/studios/adders"),
  row(64, "Flags from Arithmetic", "adders", "alu", "/studios/adders"),
  row(65, "Multiplexer", "mux", "mux", "/studios/routing"),
  row(66, "Demultiplexer", "mux", "demux", "/studios/routing"),
  row(67, "Decoder", "mux", "decoder", "/studios/routing"),
  row(68, "Encoder", "mux", "encoder", "/studios/routing"),
  row(69, "Priority Encoder", "mux", "encoder", "/studios/routing"),
  row(70, "Seven-segment Code", "mux", "seven", "/studios/routing"),
  row(71, "Clock", "timing", "clock", "/studios/timing"),
  row(72, "Setup Time", "timing", "setup", "/studios/timing"),
  row(73, "Hold Time", "timing", "hold", "/studios/timing"),
  row(74, "Metastability Concept", "timing", "meta", "/studios/timing"),
  row(75, "SR Latch", "latches", "sr", "/studios/flip-flops"),
  row(76, "D Latch", "latches", "d", "/studios/flip-flops"),
  row(77, "D Flip-Flop", "latches", "dff", "/studios/flip-flops"),
  row(78, "JK Flip-Flop", "latches", "jk", "/studios/flip-flops"),
  row(79, "T Flip-Flop", "latches", "t", "/studios/flip-flops"),
  row(80, "Master-Slave", "latches", "ms", "/studios/flip-flops"),
  row(81, "Parallel Load Register", "registers", "load", "/studios/registers"),
  row(82, "SISO Shift Register", "registers", "siso", "/studios/registers"),
  row(83, "SIPO / PISO / PIPO", "registers", "modes", "/studios/registers"),
  row(84, "Johnson Counter Register", "registers", "johnson", "/studios/registers"),
  row(85, "Register Enable", "registers", "load", "/studios/registers"),
  row(86, "Ripple Counter", "counters", "ripple", "/studios/counters"),
  row(87, "Synchronous Counter", "counters", "sync", "/studios/counters"),
  row(88, "MOD-N Counter", "counters", "mod", "/studios/counters"),
  row(89, "Decade Counter", "counters", "decade", "/studios/counters"),
  row(90, "Counter Designer", "counters", "design", "/studios/counters"),
  row(91, "Finite State Machine", "fsm", "diagram", "/studios/fsm"),
  row(92, "Moore Machine", "fsm", "moore", "/studios/fsm"),
  row(93, "Mealy Machine", "fsm", "mealy", "/studios/fsm"),
  row(94, "State Encoding", "fsm", "encode", "/studios/fsm"),
  row(95, "State Minimization", "fsm", "min", "/studios/fsm"),
  row(96, "FSM Simulation", "fsm", "run", "/studios/fsm"),
  row(97, "Addressed Memory", "memory", "array", "/studios/memory?tab=array"),
  row(98, "RAM Read/Write Cycle", "memory", "timing", "/studios/memory?tab=timing"),
  row(99, "ROM Concept", "memory", "types", "/studios/memory?tab=types"),
  row(100, "Address Decoder", "memory", "decode", "/studios/memory?tab=decode"),
  row(101, "Cache Mapping", "cache", "map", "/studios/cache"),
  row(102, "Cache Hit and Miss", "cache", "access", "/studios/cache"),
  row(103, "Replacement Policy", "cache", "replace", "/studios/cache"),
  row(104, "Write Policy", "cache", "write", "/studios/cache"),
  row(105, "Program Counter", "cpu-blocks", "pc", "/studios/cpu-blocks"),
  row(106, "Instruction Register", "cpu-blocks", "ir", "/studios/cpu-blocks"),
  row(107, "MAR and MDR", "cpu-blocks", "mar", "/studios/cpu-blocks"),
  row(108, "Register File", "cpu-blocks", "rf", "/studios/cpu-blocks"),
  row(109, "Register Transfer", "datapath", "rtl", "/studios/rtl"),
  row(110, "Shared Bus", "datapath", "bus", "/studios/rtl"),
  row(111, "Instruction Set Basics", "isa", "formats", "/studios/isa"),
  row(112, "Fetch-Decode-Execute", "fde", "cycle", "/studios/fde"),
];

export const MASTER_CONCEPTS: CurriculumConcept[] = [
  ...CONCEPTS_1_112,
  ...fromMap(CONCEPTS_113_200),
  ...fromMap(CONCEPTS_201_328),
  ...fromMap(CONCEPTS_329_392),
];

export function knownRoutes(): Set<string> {
  const routes = new Set<string>();
  for (const studio of STUDIOS) {
    if (!studio.active) continue;
    routes.add(studio.path);
  }
  for (const studio of ARCH_STUDIOS) {
    routes.add(studio.path);
    for (const lab of studio.labs) {
      routes.add(lab.id === "overview" ? studio.path : `${studio.path}/${lab.id}`);
      routes.add(`${studio.path}/${lab.id}`);
    }
  }
  return routes;
}

export interface CoverageReport {
  missingNumbers: number[];
  duplicateIds: string[];
  duplicateMasters: number[];
  missingStudio: string[];
  missingLab: string[];
  missingRoute: string[];
  invalidRoute: string[];
  placeholder: string[];
  unimplementedInteractive: string[];
  advancedCount: number;
  total: number;
}

function isPlaceholder(concept: CurriculumConcept): boolean {
  const text = `${concept.title} ${concept.lab} ${concept.route}`.toLowerCase();
  return text.includes("todo") || text.includes("placeholder") || text.includes("coming soon") || text.includes("/upcoming/");
}

export function auditCurriculum(concepts: CurriculumConcept[] = MASTER_CONCEPTS): CoverageReport {
  const routes = knownRoutes();
  const byNumber = new Map<number, CurriculumConcept[]>();
  const byId = new Map<string, number>();
  const missingNumbers: number[] = [];
  const duplicateIds: string[] = [];
  const duplicateMasters: number[] = [];
  const missingStudio: string[] = [];
  const missingLab: string[] = [];
  const missingRoute: string[] = [];
  const invalidRoute: string[] = [];
  const placeholder: string[] = [];
  const unimplementedInteractive: string[] = [];
  for (const concept of concepts) {
    const list = byNumber.get(concept.masterNumber) ?? [];
    list.push(concept);
    byNumber.set(concept.masterNumber, list);
    byId.set(concept.id, (byId.get(concept.id) ?? 0) + 1);
    if (!concept.studio) missingStudio.push(concept.id);
    if (!concept.lab) missingLab.push(concept.id);
    if (!concept.route) missingRoute.push(concept.id);
    else {
      const base = concept.route.split("?")[0] ?? concept.route;
      if (!routes.has(base) && !routes.has(concept.route)) invalidRoute.push(`${concept.id}:${concept.route}`);
    }
    if (isPlaceholder(concept)) placeholder.push(concept.id);
    if (concept.interactive && !concept.implemented) unimplementedInteractive.push(concept.id);
  }
  for (let n = 1; n <= 392; n += 1) if (!byNumber.has(n)) missingNumbers.push(n);
  for (const [id, count] of byId) if (count > 1) duplicateIds.push(id);
  for (const [num, list] of byNumber) if (list.length > 1) duplicateMasters.push(num);
  return {
    missingNumbers,
    duplicateIds,
    duplicateMasters,
    missingStudio,
    missingLab,
    missingRoute,
    invalidRoute,
    placeholder,
    unimplementedInteractive,
    advancedCount: concepts.filter((item) => item.masterNumber >= 113).length,
    total: concepts.length,
  };
}
