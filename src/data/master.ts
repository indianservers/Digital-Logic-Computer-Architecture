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
  row(1, "Bit", "numbers", "convert", "/studios/number-systems?tab=convert"),
  row(2, "Binary Representation", "numbers", "convert", "/studios/number-systems?tab=convert"),
  row(3, "Hexadecimal", "numbers", "convert", "/studios/number-systems?tab=convert"),
  row(4, "Unsigned Integers", "numbers", "convert", "/studios/number-systems?tab=convert"),
  row(5, "Two's Complement", "numbers", "signed", "/studios/number-systems?tab=signed"),
  row(6, "Sign Magnitude", "numbers", "signed", "/studios/number-systems?tab=signed"),
  row(7, "Gray Code", "numbers", "codes", "/studios/number-systems?tab=codes"),
  row(8, "Parity", "numbers", "parity", "/studios/number-systems?tab=parity"),
  row(9, "Hamming Code", "numbers", "hamming", "/studios/number-systems?tab=hamming"),
  row(10, "IEEE-754", "numbers", "ieee", "/studios/number-systems?tab=ieee"),
  row(11, "Range and Overflow of Codes", "numbers", "signed", "/studios/number-systems?tab=signed"),
  row(12, "Base Conversion", "numbers", "convert", "/studios/number-systems?tab=convert"),
  row(13, "Boolean Variable", "boolean", "play", "/studios/boolean-algebra?tab=play"),
  row(14, "AND OR NOT", "boolean", "play", "/studios/boolean-algebra?tab=play"),
  row(15, "Boolean Expression Evaluation", "boolean", "play", "/studios/boolean-algebra?tab=play"),
  row(16, "De Morgan", "boolean", "laws", "/studios/boolean-algebra?tab=laws"),
  row(17, "Absorption and Idempotent", "boolean", "laws", "/studios/boolean-algebra?tab=laws"),
  row(18, "Sum of Products", "boolean", "forms", "/studios/boolean-algebra?tab=forms"),
  row(19, "Product of Sums", "boolean", "forms", "/studios/boolean-algebra?tab=forms"),
  row(20, "Minterm", "boolean", "terms", "/studios/boolean-algebra?tab=terms"),
  row(21, "Maxterm", "boolean", "terms", "/studios/boolean-algebra?tab=terms"),
  row(22, "Algebraic Simplification", "boolean", "simplify", "/studios/boolean-algebra?tab=simplify"),
  row(23, "Logic Gate Symbols", "gates", "build", "/studios/logic-gates?tab=build"),
  row(24, "AND Gate", "gates", "build", "/studios/logic-gates?tab=build"),
  row(25, "OR Gate", "gates", "build", "/studios/logic-gates?tab=build"),
  row(26, "NOT Gate", "gates", "build", "/studios/logic-gates?tab=build"),
  row(27, "NAND Gate", "gates", "universal", "/studios/logic-gates?tab=universal"),
  row(28, "NOR Gate", "gates", "universal", "/studios/logic-gates?tab=universal"),
  row(29, "XOR Gate", "gates", "build", "/studios/logic-gates?tab=build"),
  row(30, "XNOR Gate", "gates", "build", "/studios/logic-gates?tab=build"),
  row(31, "Tri-state Buffer", "gates", "tri", "/studios/logic-gates?tab=tri"),
  row(32, "Fan-out and Delay", "gates", "fan", "/studios/logic-gates?tab=fan"),
  row(33, "Truth Table", "truth", "from-expr", "/studios/truth-tables?tab=from-expr"),
  row(34, "Canonical SOP from Table", "truth", "from-table", "/studios/truth-tables?tab=from-table"),
  row(35, "Canonical POS from Table", "truth", "from-table", "/studios/truth-tables?tab=from-table"),
  row(36, "Table from Expression", "truth", "from-expr", "/studios/truth-tables?tab=from-expr"),
  row(37, "Don't-care in Tables", "truth", "from-table", "/studios/truth-tables?tab=from-table"),
  row(38, "Equivalence by Table", "truth", "from-table", "/studios/truth-tables?tab=from-table"),
  row(39, "Input Combination Sweep", "truth", "from-expr", "/studios/truth-tables?tab=from-expr"),
  row(40, "Output Column", "truth", "from-table", "/studios/truth-tables?tab=from-table"),
  row(41, "Karnaugh Map", "kmap", "map", "/studios/kmap?tab=map"),
  row(42, "Gray-coded Cells", "kmap", "map", "/studios/kmap?tab=map"),
  row(43, "Power-of-Two Groups", "kmap", "map", "/studios/kmap?tab=map"),
  row(44, "Wraparound Groups", "kmap", "map", "/studios/kmap?tab=map"),
  row(45, "Prime Implicants", "kmap", "primes", "/studios/kmap?tab=primes"),
  row(46, "Don't-care in K-map", "kmap", "map", "/studios/kmap?tab=map"),
  row(47, "Quine-McCluskey", "kmap", "qm", "/studios/kmap?tab=qm"),
  row(48, "Simplified Circuit Compare", "kmap", "circuit", "/studios/kmap?tab=circuit"),
  row(49, "Combinational Circuit", "combo", "canvas", "/studios/combinational?tab=canvas"),
  row(50, "Gate Placement", "combo", "canvas", "/studios/combinational?tab=canvas"),
  row(51, "Wires Carrying Values", "combo", "canvas", "/studios/combinational?tab=canvas"),
  row(52, "Probes on Nets", "combo", "canvas", "/studios/combinational?tab=canvas"),
  row(53, "Half Adder Circuit", "combo", "canvas", "/studios/combinational?tab=canvas"),
  row(54, "Combinational Loop Warning", "combo", "canvas", "/studios/combinational?tab=canvas"),
  row(55, "Circuit Undo", "combo", "canvas", "/studios/combinational?tab=canvas"),
  row(56, "Local Circuit Save", "combo", "canvas", "/studios/combinational?tab=canvas"),
  row(57, "Half Adder", "adders", "half", "/studios/adders?tab=half"),
  row(58, "Full Adder", "adders", "half", "/studios/adders?tab=half"),
  row(59, "Ripple Carry", "adders", "multi", "/studios/adders?tab=multi"),
  row(60, "Carry Lookahead", "adders", "multi", "/studios/adders?tab=multi"),
  row(61, "ALU Operations", "adders", "alu", "/studios/adders?tab=alu"),
  row(62, "Shifter", "adders", "shift", "/studios/adders?tab=shift"),
  row(63, "Binary Multiply Sketch", "adders", "mul", "/studios/adders?tab=mul"),
  row(64, "Flags from Arithmetic", "adders", "alu", "/studios/adders?tab=alu"),
  row(65, "Multiplexer", "mux", "mux", "/studios/routing?tab=mux"),
  row(66, "Demultiplexer", "mux", "demux", "/studios/routing?tab=demux"),
  row(67, "Decoder", "mux", "dec", "/studios/routing?tab=dec"),
  row(68, "Encoder", "mux", "enc", "/studios/routing?tab=enc"),
  row(69, "Priority Encoder", "mux", "priority", "/studios/routing?tab=priority"),
  row(70, "Seven-segment Code", "mux", "seg", "/studios/routing?tab=seg"),
  row(71, "Clock", "timing", "clock", "/studios/timing?tab=clock"),
  row(72, "Setup Time", "timing", "setup", "/studios/timing?tab=setup"),
  row(73, "Hold Time", "timing", "hold", "/studios/timing?tab=hold"),
  row(74, "Metastability Concept", "timing", "meta", "/studios/timing?tab=meta"),
  row(75, "SR Latch", "latches", "latches", "/studios/flip-flops?tab=latches"),
  row(76, "D Latch", "latches", "dlatch", "/studios/flip-flops?tab=dlatch"),
  row(77, "D Flip-Flop", "latches", "dff", "/studios/flip-flops?tab=dff"),
  row(78, "JK Flip-Flop", "latches", "jk", "/studios/flip-flops?tab=jk"),
  row(79, "T Flip-Flop", "latches", "t", "/studios/flip-flops?tab=t"),
  row(80, "Master-Slave", "latches", "ms", "/studios/flip-flops?tab=ms"),
  row(81, "Parallel Load Register", "registers", "parallel", "/studios/registers?tab=parallel"),
  row(82, "SISO Shift Register", "registers", "siso", "/studios/registers?tab=siso"),
  row(83, "SIPO / PISO / PIPO", "registers", "sipo", "/studios/registers?tab=sipo"),
  row(84, "Johnson Counter Register", "registers", "johnson", "/studios/registers?tab=johnson"),
  row(85, "Register Enable", "registers", "parallel", "/studios/registers?tab=parallel"),
  row(86, "Ripple Counter", "counters", "ripple", "/studios/counters?tab=ripple"),
  row(87, "Synchronous Counter", "counters", "sync", "/studios/counters?tab=sync"),
  row(88, "MOD-N Counter", "counters", "mod", "/studios/counters?tab=mod"),
  row(89, "Decade Counter", "counters", "decade", "/studios/counters?tab=decade"),
  row(90, "Counter Designer", "counters", "design", "/studios/counters?tab=design"),
  row(91, "Finite State Machine", "fsm", "diagram", "/studios/fsm?tab=diagram"),
  row(92, "Moore Machine", "fsm", "examples", "/studios/fsm?tab=examples"),
  row(93, "Mealy Machine", "fsm", "examples", "/studios/fsm?tab=examples"),
  row(94, "State Encoding", "fsm", "encoding", "/studios/fsm?tab=encoding"),
  row(95, "State Minimization", "fsm", "minimize", "/studios/fsm?tab=minimize"),
  row(96, "FSM Simulation", "fsm", "diagram", "/studios/fsm?tab=diagram"),
  row(97, "Addressed Memory", "memory", "array", "/studios/memory?tab=array"),
  row(98, "RAM Read/Write Cycle", "memory", "timing", "/studios/memory?tab=timing"),
  row(99, "ROM Concept", "memory", "types", "/studios/memory?tab=types"),
  row(100, "Address Decoder", "memory", "decode", "/studios/memory?tab=decode"),
  row(101, "Cache Mapping", "cache", "sim", "/studios/cache?tab=sim"),
  row(102, "Cache Hit and Miss", "cache", "sim", "/studios/cache?tab=sim"),
  row(103, "Replacement Policy", "cache", "policy", "/studios/cache?tab=policy"),
  row(104, "Write Policy", "cache", "policy", "/studios/cache?tab=policy"),
  row(105, "Program Counter", "cpu-blocks", "registers", "/studios/cpu-blocks?tab=registers"),
  row(106, "Instruction Register", "cpu-blocks", "registers", "/studios/cpu-blocks?tab=registers"),
  row(107, "MAR and MDR", "cpu-blocks", "registers", "/studios/cpu-blocks?tab=registers"),
  row(108, "Register File", "cpu-blocks", "registers", "/studios/cpu-blocks?tab=registers"),
  row(109, "Register Transfer", "datapath", "transfer", "/studios/rtl?tab=transfer"),
  row(110, "Shared Bus", "datapath", "bus", "/studios/rtl?tab=bus"),
  row(111, "Instruction Set Basics", "isa", "basics", "/studios/isa?tab=basics"),
  row(112, "Fetch-Decode-Execute", "fde", "cycle", "/studios/fde?tab=cycle"),
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
