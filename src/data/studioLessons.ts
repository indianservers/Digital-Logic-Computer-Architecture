export type TabLesson = {
  guide: string[];
  takeaways: string[];
  theory: { title: string; body: string };
  what?: string;
  why?: string;
  notice?: string;
};

export const FLIPFLOP_LESSONS: Record<string, TabLesson> = {
  latches: {
    theory: { title: "SR latches", body: "A NOR SR latch holds Q until S or R is used. S=R=1 is forbidden on NOR (both outputs 0). NAND SR is active-low: 0 on a pin asserts. Latches are level-sensitive: they follow while enabled." },
    guide: ["Set and reset the NOR latch.", "Try S=R=1 and read X or the forbidden note.", "Compare NAND SR: inputs are active low.", "Leave S=R=0 (NOR) and confirm hold."],
    takeaways: ["A latch follows while it is open.", "NOR SR: S=R=1 is invalid.", "NAND SR inputs are active low."],
  },
  dlatch: {
    theory: { title: "D latch", body: "A D latch copies D to Q while Enable is high (transparent) and holds while Enable is low. It is an SR latch with R = D' and S = D, so S=R=1 cannot occur." },
    guide: ["Enable the D latch and see it go transparent.", "Change D while enabled — Q follows.", "Drop Enable and change D — Q holds.", "Treat this as the gated storage before an edge-triggered FF."],
    takeaways: ["Transparent when enabled; hold when not.", "D removes the SR forbidden state.", "Level-sensitive, not edge-triggered."],
  },
  sr: {
    theory: { title: "SR flip-flop", body: "An SR flip-flop samples S and R on a clock edge. Next Q is set, reset, hold, or invalid (S=R=1) according to the characteristic table. It is not transparent between edges." },
    guide: ["Clock with S=1, R=0 to set.", "Clock with S=0, R=1 to reset.", "S=R=0 holds.", "Avoid S=R=1 on this NOR-style FF."],
    takeaways: ["Samples on the edge, then holds.", "Characteristic table names next Q from S, R, and Q.", "Invalid when both S and R are 1."],
  },
  dff: {
    theory: { title: "D flip-flop", body: "A D flip-flop captures D on the active clock edge and holds until the next edge. It is the standard register bit: Q⁺ = D. Setup and hold from the timing studio apply here." },
    guide: ["Set D, then clock once — Q becomes D.", "Change D without a clock — Q stays.", "Use only one edge; the level between edges is ignored.", "Build a register from several D FFs sharing CLK."],
    takeaways: ["Q⁺ = D at the capturing edge.", "No clock means no update.", "This is edge-triggered storage."],
  },
  jk: {
    theory: { title: "JK flip-flop", body: "JK extends SR: J=K=1 toggles. J=1, K=0 sets; J=0, K=1 resets; J=K=0 holds. Toggle makes counters easy: tie J=K=1 and the bit divides the clock by 2 if it sees every edge." },
    guide: ["Set J=K=1 and clock — Q toggles.", "Use J=1, K=0 to set.", "Use J=0, K=1 to reset.", "Hold with J=K=0."],
    takeaways: ["J = K = 1 toggles.", "JK has no forbidden S=R=1 row.", "Tying J=K=1 makes a T flip-flop."],
  },
  t: {
    theory: { title: "T flip-flop", body: "T=1 toggles on the clock edge; T=0 holds. It is a JK with J=K=T. Ripple counters clock the next T from the previous Q." },
    guide: ["Clock with T=1 and watch Q flip.", "Set T=0 and clock — Q holds.", "Compare with JK when J=K=1.", "Think of a binary counter bit as a T FF."],
    takeaways: ["T=1 toggles; T=0 holds.", "A T FF is JK with J=K.", "Divide-by-2 is a T FF with T=1."],
  },
  ms: {
    theory: { title: "Master-slave", body: "A master-slave pair uses opposite enable levels (or opposite edges) so the output cannot race through on one pulse. The master samples while the slave holds, then they swap. It is the classic way to get edge-like behavior from latches." },
    guide: ["Clock high: watch the master take D.", "Clock low: the slave updates from the master.", "Try to change D in the middle and see which stage ignores it.", "Compare with a single D FF."],
    takeaways: ["Two latches in series, opposite phases.", "The output changes once per cycle, not while transparent.", "This prevents a 1 from rippling through one pulse."],
  },
  tables: {
    theory: { title: "Characteristic and excitation tables", body: "A characteristic table says what Q⁺ is given inputs and Q. An excitation table says what inputs you need to make a desired Q→Q⁺ transition. Designers use excitation tables to drive FFs from a next-state map." },
    guide: ["Read Q⁺ for each input row.", "Flip a desired next bit and see the required J, K, or D.", "Compare D (next = D) with JK (more cases).", "Use this when you open the counter designer."],
    takeaways: ["Characteristic: inputs + Q → Q⁺.", "Excitation: Q → Q⁺ → required inputs.", "D excitation is simply Q⁺."],
  },
  convert: {
    theory: { title: "Flip-flop conversions", body: "Any of D, T, JK, or SR can implement another if you add a little combinational logic in front. Example: T from D is T XOR Q. The conversion table is that extra logic." },
    guide: ["Pick a from-to conversion.", "Read the extra gates in front of the target FF.", "Toggle the external input and clock.", "Confirm Q behaves as the requested type."],
    takeaways: ["Conversion is combinational logic plus an existing FF.", "D from T: D = T XOR Q.", "The characteristic of the outer type is what you should see."],
  },
};

export const REGISTER_LESSONS: Record<string, TabLesson> = {
  parallel: {
    theory: { title: "Parallel-load register", body: "n D flip-flops share CLK and often an Enable. When Enable is 1, the whole word loads on the edge. When 0, the word holds. That is the CPU's register file bit in miniature." },
    guide: ["Load a word into the parallel register.", "Turn enable off and clock — the word holds.", "Turn enable on and clock — the new word appears.", "Read binary, hex, and unsigned together."],
    takeaways: ["A register is parallel flip-flops sharing a clock.", "Enable decides load versus hold.", "All bits update on the same edge."],
  },
  siso: {
    theory: { title: "SISO", body: "Serial-in serial-out shifts one bit per clock. After n clocks, the first bit has walked to the last stage. Use it for delay lines and serial links." },
    guide: ["Shift 1011 through SISO.", "Clock four times and read the serial output.", "Watch each stage take its neighbor.", "Reset and send a different nibble."],
    takeaways: ["Serial modes move one bit per edge.", "Latency is n clocks for an n-bit word.", "The bit at Qn is the oldest bit."],
  },
  sipo: {
    theory: { title: "SIPO", body: "Serial-in parallel-out shifts bits in, then you read all Qs at once. Receivers often use SIPO to assemble a word from a pin." },
    guide: ["Shift bits in serially.", "Read the parallel word after n clocks.", "Compare with SISO: the bits are the same, the ports differ.", "Hold by stopping the clock."],
    takeaways: ["In serial, out parallel.", "After n shifts the word is complete.", "Q0..Qn-1 are the captured bits."],
  },
  piso: {
    theory: { title: "PISO", body: "Parallel-in serial-out loads a word, then shifts it out one bit per clock. Transmitters use PISO to send a register on one wire." },
    guide: ["Load a parallel word.", "Shift and watch the serial pin.", "After n clocks the word has left.", "Load again to start a new frame."],
    takeaways: ["In parallel, out serial.", "Load then shift is the usual sequence.", "One pin carries the whole word over time."],
  },
  pipo: {
    theory: { title: "PIPO", body: "Parallel-in parallel-out is the ordinary register: load a word, read a word. Shift modes are off. Same as the parallel tab with the PIPO name used in textbooks." },
    guide: ["Load a word.", "Clock with hold — it stays.", "Read all bits at once.", "Treat this as a named synonym for parallel load."],
    takeaways: ["PIPO is a parallel register.", "No serial walk unless you change mode.", "Enable still chooses load versus hold."],
  },
  bi: {
    theory: { title: "Bidirectional shift", body: "A bidirectional register can shift left or right. Direction is a control, not a second clock. Universal registers include this plus hold and load." },
    guide: ["Shift right and watch the bits walk.", "Switch direction and shift left.", "Load a known pattern first so the walk is visible.", "Do not change direction mid-bit unless you mean to."],
    takeaways: ["Direction is a mux on the neighbor.", "Left and right are opposite serial paths.", "Hold is neither left nor right."],
  },
  universal: {
    theory: { title: "Universal shift register", body: "Hold, shift left, shift right, and parallel load in one block, selected by mode bits. It is the textbook 4-function register (74194-style teaching model, not a vendor part)." },
    guide: ["Switch between hold, shift, and load.", "Load 1011, then shift.", "Hold for two clocks and confirm no walk.", "Change mode only between edges in your mental model."],
    takeaways: ["Mode selects hold / left / right / load.", "One clock, four behaviors.", "This is a teaching universal register, not a datasheet."],
  },
  ring: {
    theory: { title: "Ring counter", body: "A ring is a shift register with the last bit fed to the first. One circulating 1 is a one-hot state. Period is n for n stages if you start with a single 1." },
    guide: ["Watch a single 1 circulate.", "Count clocks until it returns.", "If you start with 0000 it stays dead — load a 1.", "Compare with Johnson on the next tab."],
    takeaways: ["Feedback is the last bit, not inverted.", "A legal ring state is one-hot.", "Length is N for N flip-flops."],
  },
  johnson: {
    theory: { title: "Johnson counter", body: "A Johnson (twisted ring) feeds back the inverted last bit. It visits 2N states for N flip-flops: walking 1s then walking 0s. Decoding is simple (two-bit patterns)." },
    guide: ["Watch 1s fill, then 0s fill.", "Count 2N steps for N bits.", "Compare with a binary counter's 2^N states.", "Use this when you want more states than a ring without a full binary decode."],
    takeaways: ["Johnson feeds back the inverted last bit.", "Length is 2N for N flip-flops.", "States are not binary count; they are a twisted ring."],
  },
};

export const COUNTER_LESSONS: Record<string, TabLesson> = {
  ripple: {
    theory: { title: "Ripple counter", body: "Each T (or Q') clocks the next stage, so the LSB toggles first and the carry ripples. Stages do not share one clock edge. Delay stacks; intermediate counts can glitch." },
    guide: ["Step a ripple counter and see the delay stack.", "Watch Q0 toggle every clock, Q1 every two, Q2 every four.", "Compare with synchronous on the next tab.", "Read why a decoder on Q can glitch."],
    takeaways: ["Ripple clocks each stage from the previous output.", "LSB is fastest.", "Delay and glitches are the cost of a simple chain."],
  },
  sync: {
    theory: { title: "Synchronous counter", body: "Every stage shares CLK. Combinational logic decides which bits toggle this edge (T = AND of lower bits for a binary up-counter). All Qs are meant to change together." },
    guide: ["Compare it with a common clock.", "Step and see bits update on one edge.", "Read the T inputs that enable higher bits.", "Use this when you will decode the count."],
    takeaways: ["Synchronous stages share one clock.", "Toggle enables come from lower bits.", "No ripple delay between Qs on the same edge."],
  },
  updown: {
    theory: { title: "Up / down", body: "Direction chooses whether the next state is count+1 or count−1. The same FFs, different excitation. Wrap is modulo 2ⁿ unless you add a terminal-count load." },
    guide: ["Count up, then switch to down.", "Watch wrap from all-1s to 0 (up) and 0 to all-1s (down).", "Hold the direction across a few clocks.", "Read the unsigned value besides the bits."],
    takeaways: ["Direction is a control, not a second clock.", "Wrap is natural for a binary modulus.", "Excitation for down is the opposite enable pattern."],
  },
  mod: {
    theory: { title: "MOD-N", body: "A MOD-N counter returns to 0 after N states (0..N-1). Extra states are unused: detect N and clear, or load 0. N need not be a power of two." },
    guide: ["Set N and watch the unused states.", "Count until it snaps back to 0.", "Try N=6 (a common lab).", "Compare with a free 2ⁿ binary count."],
    takeaways: ["MOD-N uses N of the 2ⁿ possible words.", "Clear-on-N is the usual teaching circuit.", "Unused states should not be decoded as extra counts."],
  },
  decade: {
    theory: { title: "Decade / BCD", body: "A decade counter is MOD-10: 0000 through 1001, then 0. It is BCD: each nibble is a decimal digit. Codes 1010–1111 are skipped, not hex A–F." },
    guide: ["Count 0 through 9, then back to 0.", "Watch the seven-segment digit if shown.", "Confirm 10 never appears as a stable state.", "Cascade decades in your head for 00–99."],
    takeaways: ["A decade counter returns to 0 after 9.", "BCD digits are 0–9, not 0–15.", "Four bits still hold the digit."],
  },
  ring: {
    theory: { title: "Ring and Johnson counts", body: "Ring: period N. Johnson: period 2N. Neither is binary weighted; they are one-hot or walking patterns. Decoding is AND of two bits for Johnson." },
    guide: ["Compare ring versus Johnson length.", "Start the ring with a single 1.", "Count 2N Johnson steps.", "Do not treat the pattern as an unsigned binary integer."],
    takeaways: ["Ring length is N; Johnson is 2N.", "These are not binary counters.", "Illegal start states stay illegal unless you reset."],
  },
  design: {
    theory: { title: "Counter designer", body: "From a desired sequence you fill a next-state table, then excitation equations for D or JK. The designer in this lab does that algebra for a teaching-size machine." },
    guide: ["Ask the designer for D or JK equations.", "Set the modulus or sequence.", "Read which bits toggle on which states.", "Build it on the flip-flop studio if you want the gates."],
    takeaways: ["Next-state table → excitation → gates.", "D equations are Q⁺ itself.", "JK uses the excitation table from the FF studio."],
  },
};

export const FSM_LESSONS: Record<string, TabLesson> = {
  diagram: {
    theory: { title: "Finite state machines", body: "An FSM has states, inputs, a next-state function, and (for Moore) outputs from the state, or (for Mealy) from state plus input. The diagram is that function drawn as bubbles and arcs." },
    guide: ["Add states and draw a transition.", "Set the initial state.", "Step the input stream.", "Save the machine in this browser."],
    takeaways: ["Next state depends on current state and input.", "The diagram and the table must agree.", "Reset returns to the initial state."],
  },
  table: {
    theory: { title: "State tables", body: "Each row is a state. Columns are inputs. Cells name the next state and, for Mealy, the output on that arc. Unused input symbols should still have a defined next state in a complete machine." },
    guide: ["Read next-state for each input.", "Edit a cell and watch the diagram.", "Compare Moore output (on the state) with Mealy (on the arc).", "Step the stream and follow the live row."],
    takeaways: ["The table is the next-state function.", "Moore output sits on the state.", "Mealy output sits on the transition."],
  },
  encoding: {
    theory: { title: "State encoding", body: "Binary encoding uses ceil(log2 S) flip-flops. One-hot uses one flip-flop per state. Gray encoding changes one bit between neighbors. Encoding changes the excitation equations, not the language of the machine." },
    guide: ["Compare binary, one-hot, and Gray bit counts.", "See which encoding needs more FFs.", "Think about which is easier to decode.", "Minimization (next tab) can drop states before you encode."],
    takeaways: ["Binary encoding uses fewer flip-flops.", "One-hot uses one flip-flop per state.", "Encoding is a later choice than the state diagram."],
  },
  minimize: {
    theory: { title: "State minimization", body: "Two states are equivalent if they produce the same outputs forever. Merging them shrinks the machine. This lab partitions states the teaching way; it does not claim a vendor optimizer." },
    guide: ["Run minimization on the current machine.", "See which states merge.", "Confirm outputs still match on the stream.", "Encode after you minimize, not before."],
    takeaways: ["Equivalent states can be merged.", "Outputs must stay the same.", "Fewer states means fewer FFs after encoding."],
  },
  examples: {
    theory: { title: "Moore and Mealy examples", body: "Moore: output is a function of state only, so it is stable between input changes. Mealy: output can change in the same cycle as the input. Sequence detectors are the usual textbook pair." },
    guide: ["Load a Moore example, then a Mealy example.", "Step the same input stream on both.", "See when the output rises.", "Note Mealy can react one cycle sooner."],
    takeaways: ["Moore output waits for the state.", "Mealy output can depend on the current input.", "Neither is universally better."],
  },
  circuit: {
    theory: { title: "D synthesis", body: "D flip-flop excitation is Q⁺ itself, so the next-state bits become D inputs through combinational logic. This tab shows those equations for the encoded machine." },
    guide: ["Pick an encoding.", "Read D equations for each bit.", "Match a term to a transition in the table.", "Build the gates on the combinational canvas if you want."],
    takeaways: ["D synthesis turns the next-state table into equations.", "Each FF bit has its own SOP.", "The clock is shared; the D logic is combinational."],
  },
};

export const CACHE_LESSONS: Record<string, TabLesson> = {
  sim: {
    theory: { title: "Cache mapping", body: "An address splits into tag, index, and offset. Index picks a set. A hit needs a valid line whose tag matches. Direct-mapped has one line per set; set-associative has several, so replacement may run." },
    guide: ["Set the cache configuration (size, block size, associativity, policies).", "Enter a trace of memory accesses (one per line, e.g. 0x00001000 R).", "Step through or run the simulation.", "Observe the address breakdown, cache table, memory, and event log.", "Try different policies and compare the results."],
    takeaways: ["A cache stores recently used blocks from main memory.", "The address is split into tag, index, and offset.", "Locality makes caches effective.", "Replacement and write policies change which line stays and when memory is written.", "Misses are costly. AMAT is hit time plus miss rate times miss penalty."],
  },
  locality: {
    theory: { title: "Locality", body: "Temporal locality: reuse the same address soon. Spatial locality: nearby addresses share a block. Caches work because programs are not random; this lab measures reuse in the trace you typed." },
    guide: ["Choose a trace pattern (sequential, repeated, strided, or random).", "Set the working set size, block size, cache size, and stride.", "Run the simulation and watch the memory map and access timeline.", "Compare how patterns change hit rate, miss class, and reuse distance.", "Change one parameter and see whether locality improves."],
    takeaways: ["Temporal locality reuses the same address soon.", "Spatial locality reuses nearby bytes in the same block.", "Sequential patterns hit after the first fetch of a block.", "A repeated loop hits after the working set is warm.", "Random patterns show little reuse and a low hit rate."],
  },
  policy: {
    theory: { title: "Write and replacement policy", body: "Write-through updates memory immediately. Write-back dirties the line and writes memory on eviction. LRU, FIFO, and random choose which line leaves a full set. Allocate-on-write versus no-allocate is a separate choice." },
    guide: ["Configure policy A and policy B.", "Load the same trace for both.", "Step them together.", "Read the victim decision and any dirty write-back.", "Compare the measured metrics. There is no declared winner."],
    takeaways: ["Both policies see the same addresses.", "LRU evicts the least recently used line.", "FIFO evicts the oldest installed line.", "Write-back writes memory when a dirty line leaves.", "Write-through writes memory on the store itself."],
  },
  levels: {
    theory: { title: "Cache hierarchy and AMAT", body: "A miss at L1 tries L2, then RAM. AMAT = hitTime + missRate × missPenalty, nested per level. Numbers here are teaching cycles, not a chip datasheet." },
    guide: ["Set the hierarchy depth.", "Set hit rates and inspect each level’s latency.", "Run a request and follow the path.", "Read the level that satisfied the request.", "Lower the L1 hit rate and watch AMAT rise."],
    takeaways: ["A hit stops at that level. A miss continues.", "Latencies here are teaching defaults, not a datasheet.", "AMAT nests each miss penalty as the next level’s access time.", "Lower hit rates send more requests deeper.", "Storage is far slower than DRAM on this scale."],
  },
};

export const CPU_LESSONS: Record<string, TabLesson> = {
  overview: {
    theory: { title: "CPU blocks", body: "PC, IR, MAR, MDR, the register file, ALU, and control are named boxes that a later fetch-decode-execute loop will use. This studio does not run a program; it lets you inspect each box." },
    guide: ["Click a block. The inspector names what it holds.", "Follow the arrows between PC, IR, MAR, and MDR.", "Open Registers to change a value the later tabs will see.", "Decode happens in the Fetch-Decode-Execute studio, not here."],
    takeaways: ["The PC holds the next instruction address.", "MAR points at memory. MDR carries the word.", "The IR holds the instruction word. Nothing here decodes an opcode yet."],
  },
  registers: {
    theory: { title: "PC, IR, and the file", body: "The program counter is the instruction address. The IR holds the word after a fetch. The register file is a small RAM with two read ports and one write port, written on a clock enable." },
    guide: ["Select a register in the file.", "Inspect the hex, decimal, and binary value.", "Edit it or load a preset, then Apply.", "Open Datapath and use the same R1 and R2."],
    takeaways: ["General-purpose registers hold operands and results.", "PC, IR, SP, and FLAGS have dedicated roles.", "A register is a bit pattern. Hex and decimal are views of the same bits."],
  },
  datapath: {
    theory: { title: "Manual datapath", body: "Control signals choose muxes: ALUSrc picks register B or an immediate; RegWrite commits the result. You assert signals by hand so you can see the route before a control unit exists." },
    guide: ["Choose a source, such as a register or the PC.", "Choose a destination, such as an ALU input, MAR, or MDR.", "Pick an ALU operation when the path uses the ALU.", "Step the transfer and watch the highlighted route.", "The register file changes only on the write-back step."],
    takeaways: ["The datapath moves operands and results.", "Multiplexers choose which value travels.", "The ALU computes. Control signals name the active route."],
  },
  bus: {
    theory: { title: "Internal bus", body: "A shared bus accepts one driver. Two enabled drivers make X. Nobody driving is Z. Register-transfer machines often time-multiplex one bus instead of wiring every path." },
    guide: ["Choose one source block.", "Choose a destination block.", "Step the transfer and read the bus value.", "Turn on a second driver to see a bus conflict.", "The destination updates only when exactly one source drives."],
    takeaways: ["One shared bus carries addresses and data.", "Only one block may drive the bus.", "Two drivers make the value X and the transfer is blocked.", "Z means nobody is driving."],
  },
  extend: {
    theory: { title: "Extend and shift", body: "Immediates are narrower than the datapath. Sign-extend copies the sign bit; zero-extend fills 0s. Shifters then place that field for branches or addresses." },
    guide: ["Enter an input value and choose the input width.", "Choose the output width.", "Pick sign extend, zero extend, a shift, or a rotate.", "Change the shift amount and read the bit cells.", "Compare the signed and unsigned readings of the same bits."],
    takeaways: ["Sign extension copies the sign bit into the new high bits.", "Zero extension fills those bits with 0.", "A logical right shift fills with 0. An arithmetic right shift copies the sign.", "A rotate wraps the bits that leave one end."],
  },
  clock: {
    theory: { title: "Clocking the blocks", body: "State (PC, IR, registers) updates on the edge you step. Combinational pieces (ALU, muxes) appear immediately. This lab is a single-edge teaching clock, not a two-phase chip." },
    guide: ["Choose a rising or falling edge.", "Set Data In and the enable switch.", "Step or run the clock.", "Change Data In between edges and see that Q waits.", "Turn enable off and confirm the edge does not capture."],
    takeaways: ["The clock tells sequential elements when to sample.", "Q changes only on the selected edge.", "Enable low blocks the capture.", "Data In can change between edges without moving Q."],
  },
};

export const ISA_LESSONS: Record<string, TabLesson> = {
  basics: {
    theory: { title: "The ISA contract", body: "The instruction set is the contract between software and the CPU: which instructions exist, which registers exist, and what each instruction means. RISC-V, ARM, and x86 are different contracts. Several chips can implement one of them." },
    guide: ["Read the core concept.", "Try an instruction and edit the register values.", "Compare RISC-V, ARM, and x86.", "Continue to Anatomy."],
    takeaways: ["The ISA is the contract between software and the CPU.", "It defines instructions, registers, and legal operations.", "Different CPUs can implement the same ISA.", "RISC-V, ARM, and x86 are different ISA families."],
  },
  anatomy: {
    theory: { title: "Instruction anatomy", body: "A 16-bit instruction is opcode, destination, source, and a second source or immediate. Hover a field to see the same bits in the strip, the inspector, and the decoder table." },
    guide: ["Read how a 16-bit instruction is divided into fields.", "Select a field and read its bit range.", "Change the instruction and watch the encoding.", "Continue to Formats."],
    takeaways: ["An instruction is divided into fields.", "Each bit range has a specific meaning.", "The opcode selects the operation.", "The same 16-bit layout encodes many instructions."],
  },
  formats: {
    theory: { title: "RISC-V formats", body: "R, I, S, and B layouts share 32 bits and place the opcode in the low 7 bits. Changing rd, rs1, rs2, or the immediate recomputes the binary and the hex word." },
    guide: ["Read why several formats exist.", "Select R, I, S, or B.", "Change a register or the immediate and read the hex.", "Continue to RISC / CISC."],
    takeaways: ["Instructions use different formats.", "Each format allocates bits for what that operation needs.", "R, I, S, and B are the layouts in this lab.", "The opcode and field positions identify the instruction."],
  },
  style: {
    theory: { title: "RISC and CISC", body: "RISC encodings are regular and fixed-width. x86 is variable-length and can name a memory operand inside arithmetic. Modern x86 cores may crack those instructions into micro-ops. Neither family is universally faster." },
    guide: ["Read the comparison without ranking one family as always faster.", "Run an example and watch both listings.", "Compare instruction count with memory operations.", "Continue to Load / Store."],
    takeaways: ["RISC encodings are regular. CISC encodings are often variable-length.", "A shorter listing is not a faster machine.", "Modern x86 cores may translate instructions into micro-ops.", "Both families run real high-performance software."],
  },
  load: {
    theory: { title: "Load and store", body: "Only load and store touch data memory. LOAD copies a word into a register. STORE copies a register into memory. The address is a base plus an offset, or a direct address in the demo." },
    guide: ["Run the demo and watch R1 and Mem[104].", "Edit a register or a memory cell.", "Switch to LW or SW and read the effective address.", "Continue to Addressing."],
    takeaways: ["Load copies memory into a register.", "Store copies a register into memory.", "ALU operations do not touch data memory.", "The address is usually a base register plus an offset."],
  },
  modes: {
    theory: { title: "Addressing modes", body: "Immediate and register modes do not access memory. Direct names the address in the instruction. Indirect reads a pointer first. Base+offset adds a constant. Indexed adds a second register. The effective address is the memory location; Mem[EA] is the operand." },
    guide: ["Open each of the six modes from the ISA Addressing tab.", "Change a register, an immediate, or a memory cell and run.", "Try a negative offset. The effective address moves, the operand does not become the address.", "Continue to Categories."],
    takeaways: ["An addressing mode says where the operand is.", "The effective address is the memory location that will be used.", "Immediate and register modes do not access memory.", "Base+offset uses a constant. Indexed uses a register that can change."],
  },
  catalog: {
    theory: { title: "Instruction categories", body: "Arithmetic, logic, data transfer, control flow, compare, and shift cover most programs. The job is shared across ISAs. The mnemonic is not." },
    guide: ["Select each category.", "Switch the ISA family and notice the mnemonics change.", "Run the small example.", "Open Practice when you want questions."],
    takeaways: ["Instructions are grouped by what they do.", "The same jobs exist in RISC-V, ARM, and x86.", "The spellings are not identical.", "A program mixes several categories."],
  },
};

export const FDE_LESSONS: Record<string, TabLesson> = {
  cycle: {
    theory: { title: "Multi-cycle FDE", body: "Each instruction uses five cycles here: IF, ID, EX, MEM, WB. Fetch reads instruction memory and increments PC. A branch may replace the PC during MEM. CPI is cycles / retired instructions for this run." },
    guide: ["Load the add program, then step a cycle.", "Watch the stage lights IF → WB.", "STORE lights MemWrite and leaves RegWrite off.", "The PC increases during fetch, before execute."],
    takeaways: ["CPI here is cycles divided by retired instructions.", "A branch may replace the PC during the memory cycle.", "Write-back is skipped when the instruction has no destination."],
  },
  signals: {
    theory: { title: "Control signals per stage", body: "The same opcode produces different signals in IF versus WB. MemRead/MemWrite belong to MEM. RegWrite belongs to WB. Hardwired control is this table; microprogramming stores it." },
    guide: ["Step and read which signals are high.", "LOAD needs MemRead then later RegWrite.", "ADD never asserts MemWrite.", "Idle stages still exist; they just keep memory quiet."],
    takeaways: ["Signals are stage-dependent.", "Mem* is for the memory cycle.", "RegWrite commits the destination."],
  },
  rtl: {
    theory: { title: "Register transfers", body: "Each cycle is an RTL assignment: IR ← Mem[PC], R[rd] ← ALU, and so on. The trace names those transfers. The control studio stores similar words in a control store." },
    guide: ["Read the last trace line after each step.", "Match IR ← memory to IF.", "Match a register write to WB.", "CALL's MEM line stores the return address at Mem[R7]."],
    takeaways: ["RTL is the assignment, not a drawing.", "The trace is this CPU's transfers.", "Same ISA as Assembly and CPU16."],
  },
};

export const BUS_LESSONS: Record<string, TabLesson> = {
  address: {
    theory: { title: "Address bus", body: "Address width n can name 2ⁿ locations. Those wires select; they are not the data. A 16-bit address names 65536 words in this lab's teaching map." },
    guide: ["Set the address width.", "Read 2^n locations.", "This is names, not bytes of DRAM.", "Data width is a different tab."],
    takeaways: ["Address width sets how many locations the bus can name.", "2^n is the size of the map.", "Address wires do not carry the stored word."],
  },
  data: {
    theory: { title: "Data bus", body: "Data width is how many bits move in one transfer. Combined with frequency and efficiency it sets bandwidth. Two drivers without a grant produce X." },
    guide: ["Set data width.", "Enable one driver.", "Enable two — X.", "Grant is the arbitration tab."],
    takeaways: ["Data width is bits per transfer.", "Contention is X.", "Z is undriven."],
  },
  control: {
    theory: { title: "Control lines", body: "Read/write, request, grant, and interrupt wires are a third group. They are not address and not data. Timing of those strobes is the next tab." },
    guide: ["Name the control lines in the lab.", "Assert request without grant — no transfer.", "Read versus write is a direction, not a third bus.", "Interrupts are a separate studio."],
    takeaways: ["Control is its own bundle.", "Grant allows a driver.", "Strobes are sequenced, not combinatorial slogans."],
  },
  timing: {
    theory: { title: "Synchronous versus handshake", body: "A synchronous bus moves on a clock edge. An asynchronous handshake needs request and acknowledge both true. This lab shows those two contracts, not a PCI waveform." },
    guide: ["Raise the clock edge on the sync model.", "Complete request then ack on the async model.", "Leave ack low — the async transfer waits.", "Neither is 'faster' without a number."],
    takeaways: ["Synchronous waits for the clock.", "Handshake waits for both request and ack.", "These are teaching cycles."],
  },
  arbitrate: {
    theory: { title: "Arbitration", body: "Daisy chain grants the earliest requester in the chain. Central arbitration grants the lowest priority number. Distributed rotation starts after the last grant. Lower number wins here, same as interrupts." },
    guide: ["Request from two masters.", "Switch daisy, central, and distributed.", "Give the winner a worse (higher) priority number and watch central ignore it.", "Rotate and see the next grant move."],
    takeaways: ["Daisy chain grants the earliest requesting device in the chain.", "Central arbitration grants the lowest priority number.", "Distributed arbitration rotates from the last grant."],
  },
  bandwidth: {
    theory: { title: "Bandwidth", body: "Bandwidth = (data width in bytes) × frequency × efficiency. Efficiency < 1 accounts for idle or wait cycles. Units follow from that product; this is not a datasheet peak." },
    guide: ["Set width, frequency, and efficiency.", "Read the product.", "Drop efficiency and see bandwidth fall.", "Width here is bits; the formula divides by 8 for bytes."],
    takeaways: ["Bandwidth is (data width in bytes) × frequency × efficiency.", "Idle cycles lower efficiency.", "A wider bus at the same clock moves more bytes per edge."],
  },
};

export const RTL_LESSONS: Record<string, TabLesson> = {
  transfer: {
    theory: { title: "Register transfer", body: "RTL is an assignment: destination ← source or ALU(source). R3 ← R1 + R2 reads both sources combinationally and writes the sum on the clock. A move copies one register and skips the ALU." },
    guide: ["Load values, then step R3 <- R1 + R2.", "Try a move without an operator.", "Only + - & | ^ are accepted here.", "Read which registers changed."],
    takeaways: ["Only the operators + - & | ^ are accepted.", "A move copies one register and skips the ALU.", "The write happens on the step, not while you type."],
  },
  bus: {
    theory: { title: "Shared transfer bus", body: "A register-transfer machine often time-multiplexes one bus. One driver is valid. Two enabled drivers make X. Nobody driving is Z. Contention is invalid data, not a third numeric value." },
    guide: ["Enable one source onto the bus.", "Enable two different values — X.", "Disable all — Z.", "This is the same rule as the CPU internal-bus tab."],
    takeaways: ["Two enabled drivers make the bus X.", "Contention is invalid data, not a third numeric value.", "Z means undriven."],
  },
  word: {
    theory: { title: "Control word", body: "SA, SB, and DA are 3-bit register selects. ALU is 3 bits (000 add, 001 sub, 010 and, 011 or, 100 xor, 101 pass). MB is 0 when the result comes from the ALU. RW is 1 when the destination captures that result on the clock edge." },
    guide: ["Select an operation.", "Read SA, SB, DA, ALU, MB, and RW.", "Select a signal and see which path it enables.", "Generate the word and watch the write edge."],
    takeaways: ["A control word drives the datapath.", "Each field selects a specific function.", "The ALU operation is encoded.", "Register write happens on the clock edge."],
  },
};

export const ASSEMBLY_LESSONS: Record<string, TabLesson> = {
  overview: {
    theory: { title: "One machine, six views", body: "Overview, Fetch, Decode, Execute, Memory, and Trace all read the same LogicLab-16 CPU. A step retires one 16-bit instruction. The PC advances by one word." },
    guide: ["Run the add sample and read R3 and Mem[8].", "Step once and watch only R1 change.", "Open another tab. The PC is the same machine."],
    takeaways: ["The stages share one register file and one data memory.", "LOAD and STORE are the instructions that touch data memory.", "HALT stops fetch and leaves the PC on the halt word."],
  },
  run: {
    theory: { title: "One machine, six views", body: "The assembly studio steps LogicLab-16. Fetch, decode, execute, memory, and write-back are stages of the same CPU." },
    guide: ["Run the sample.", "Step one instruction.", "Open Fetch to see the PC."],
    takeaways: ["The listing and the CPU stay in step.", "A syntax error names the source line.", "Reset reloads the source."],
  },
  fetch: {
    theory: { title: "Fetch", body: "The PC selects one instruction word. That word is copied into the IR, then the PC increases by 1." },
    guide: ["Step Fetch.", "Read the highlighted instruction-memory row.", "Step again and watch the PC."],
    takeaways: ["Instruction memory and data memory are separate.", "The IR holds the fetched 16-bit word.", "The PC is a word address."],
  },
  decode: {
    theory: { title: "Decode", body: "A 16-bit word splits into an opcode and register or immediate fields. The decoder turns those fields into control signals." },
    guide: ["Click each field.", "Compare an ADD with a LOAD.", "Read which signals are on."],
    takeaways: ["Opcode bits 15–12 choose the operation.", "Register fields are 3 bits, R0 through R7.", "STORE does not turn on register write."],
  },
  execute: {
    theory: { title: "Execute", body: "The ALU computes a 16-bit result. N, Z, C, and V come from that result. BEQ and BNE compare two registers." },
    guide: ["Step until ADD.", "Read the flags.", "Turn on experiment mode to preview another operation without writing it."],
    takeaways: ["Addition wraps at 16 bits and can set carry.", "Signed overflow is not the same as unsigned carry.", "A branch target is the branch word plus a signed offset."],
  },
  memory: {
    theory: { title: "Memory", body: "The effective address is the base register plus a signed 6-bit offset, kept in the 256-word data memory. LOAD writes a register. STORE writes memory." },
    guide: ["Set a base and an offset and read the EA.", "Load, then store a different register.", "Confirm the other value did not change."],
    takeaways: ["EA and Mem[EA] are different numbers.", "A store does not write the destination register.", "The same data memory is visible on Overview and Trace."],
  },
  trace: {
    theory: { title: "Trace", body: "Each retired instruction appends one row: the PC, the text, and the registers or memory that changed. A breakpoint pauses before that word executes." },
    guide: ["Run the loop.", "Set a breakpoint on the store.", "Change R1 and step."],
    takeaways: ["The trace is recorded from the CPU, not filled in ahead of time.", "Run stops before the breakpointed instruction.", "Step executes that instruction anyway."],
  },
};

export const CONTROL_LESSONS: Record<string, TabLesson> = {
  hardwired: {
    theory: { title: "Hardwired control", body: "A decoder turns the opcode into signals: ADD turns on RegWrite and leaves memory quiet. The table is combinational. Same signals as the multi-cycle CPU." },
    guide: ["Pick ADD and read which bits are high.", "LOAD turns on MemRead, then later RegWrite.", "STORE lights MemWrite and leaves RegWrite off.", "These are the same names as FDE."],
    takeaways: ["The signals are the same ones the multi-cycle CPU uses.", "Hardwired control is a combinational map from opcode (and stage).", "Idle memory bits stay 0 for ALU ops."],
  },
  micro: {
    theory: { title: "Microprogrammed control", body: "A control store holds words. Fetch is a shared routine; dispatch jumps to the opcode's routine. LOAD is several microinstructions: address, memory, write-back." },
    guide: ["Step the micro-PC after fetch.", "See dispatch enter the opcode routine.", "LOAD takes more words than ADD.", "A vertical word would encode the op; this lab also shows horizontal bits."],
    takeaways: ["Dispatch after fetch jumps to the opcode's routine.", "LOAD turns on MemRead, then RegWrite in a later microinstruction.", "The store is a teaching ROM, not a vendor CU."],
  },
  compare: {
    theory: { title: "Horizontal vs vertical", body: "A horizontal word exposes each control bit. A vertical word stores an encoded operation and needs a decoder. Horizontal is wide and direct; vertical is compact and extra-decoded." },
    guide: ["Compare width of the two formats.", "Horizontal: one bit per signal.", "Vertical: a field that still must be decoded.", "Neither is universally better."],
    takeaways: ["A horizontal word exposes each control bit.", "A vertical word stores an encoded operation and needs a decoder.", "Width versus decode is the trade."],
  },
};

export const PIPELINE_LESSONS: Record<string, TabLesson> = {
  pipe: {
    theory: { title: "Five-stage overlap", body: "IF, ID, EX, MEM, WB can hold different instructions on the same clock. Ideal overlap is not a guaranteed five-times speedup: hazards and fill time remain. Latency of one instruction is still about five cycles." },
    guide: ["Load the add program, then step.", "Watch five stages hold different instructions.", "IF fetches the word at the PC.", "ID reads the register file. EX runs the ALU."],
    takeaways: ["Latency of one instruction is still about five cycles.", "Throughput rises after the pipeline fills.", "Ideal overlap is not a guaranteed five-times speedup."],
  },
  regs: {
    theory: { title: "Pipeline registers", body: "IF/ID, ID/EX, EX/MEM, MEM/WB capture the instruction and its data so the next stage can use a stable copy. Those registers are why stages can overlap." },
    guide: ["Step and read what each pipeline register holds.", "A bubble is a NOP in a stage register.", "Forwarding reads EX/MEM or MEM/WB, not the architectural file.", "WB still writes the architectural registers."],
    takeaways: ["Stage registers isolate one instruction from the next.", "A stall holds a stage register and inserts a bubble.", "Forwarding sources are those registers."],
  },
  metrics: {
    theory: { title: "Throughput and speedup", body: "Speedup uses this program's cycle counts: non-pipelined cycles divided by pipelined cycles. CPI here is cycles / retired. A 5-stage pipe is not 5× if the program stalls." },
    guide: ["Compare pipelined cycles with the non-pipelined estimate.", "Read CPI after a few retires.", "Toggle forwarding and watch stalls.", "Speedup is this run, not a chip claim."],
    takeaways: ["Speedup uses this program's cycle counts.", "Throughput is instructions per cycle after fill.", "Stalls and flushes shrink the speedup."],
  },
};

export const HAZARD_LESSONS: Record<string, TabLesson> = {
  detect: {
    theory: { title: "Pipeline hazards", body: "RAW means a later instruction reads a register an earlier one writes. This pipeline writes only in WB and reads in ID, so WAR and WAW do not occur. Forwarding copies an ALU result from EX/MEM or MEM/WB. A load-use still inserts one stall when forwarding is on." },
    guide: ["Load the RAW preset and step without forwarding.", "Turn forwarding on and see the stall disappear for ALU RAW.", "Load-use still stalls one cycle.", "Structural: unified memory makes fetch and a load compete."],
    takeaways: ["This pipeline writes only in WB and reads in ID, so WAR and WAW do not occur.", "A load-use still inserts one stall when forwarding is on.", "RAW is a true dependence on a register."],
  },
  predict: {
    theory: { title: "Branch prediction", body: "A wrong prediction flushes the instructions already fetched. Not-taken is the correct direction in the Branch preset. The 2-bit counter moves one step toward the resolved direction." },
    guide: ["Load Branch. Always-taken fetches the wrong path.", "Step and watch the flush.", "Switch to 2-bit and repeat a loop in your head.", "The saved PC for a flush is the sequential fetch that was wrong."],
    takeaways: ["A wrong branch prediction flushes the instructions already fetched.", "The 2-bit counter moves one step toward the resolved direction.", "Prediction is a guess; resolve still happens in EX or MEM."],
  },
};

export const HIERARCHY_LESSONS: Record<string, TabLesson> = {
  pyramid: {
    theory: { title: "The memory pyramid", body: "Registers, L1, L2, RAM, then storage. A closer level is smaller and quicker in this lab, not a universal constant. Latencies are teaching parameters you can edit." },
    guide: ["Read each level from registers down to storage.", "Compare the latency and the relative size.", "Edit a latency and watch the diagram change.", "See how a slower RAM changes later access time.", "These numbers are lab settings, not a datasheet."],
    takeaways: ["A closer level is smaller and quicker in this lab.", "Each level below is larger and slower than the one above.", "The pyramid is a request path, not a strict datasheet.", "Storage is the last level, not a file system."],
  },
  access: {
    theory: { title: "Walking an access", body: "A request checks registers, then L1, then L2, then RAM, then storage. A hit stops the walk. A miss may copy the block into a closer level. AMAT uses the latencies and miss rates you set." },
    guide: ["Enter a hexadecimal address.", "Choose read or write.", "Click Trace Access and watch the path.", "See which level hits and which levels are filled.", "Try another address, including one past RAM."],
    takeaways: ["The CPU checks registers, then L1, L2, RAM, and finally storage.", "A hit stops the search and returns the data.", "A miss checks the next level and may fill closer levels.", "Closer levels are faster, and their latencies are teaching parameters."],
  },
  locality: {
    theory: { title: "Reuse in the trace", body: "Temporal locality is using the same address again. Spatial locality is using a nearby address, often in the same cache block. The scores come from the pattern you run." },
    guide: ["Read what temporal and spatial locality mean.", "Choose a pattern, start address, stride, and length.", "Run or step the sequence.", "Watch repeated cells and nearby cells.", "Load the poor and good examples and compare them."],
    takeaways: ["Programs often reuse the same address.", "Programs often use a nearby address next.", "Caches help because real programs behave this way.", "A teaching hit-rate estimate rises when the pattern stays in a few blocks."],
  },
  cache: {
    theory: { title: "A small cache", body: "A block number is the address divided by the block size. A direct-mapped cache has one line per index. A set-associative cache searches every way in the set. Miss types come from a same-size fully associative shadow cache." },
    guide: ["Set the block size, line count, and associativity.", "Enter a sequence of addresses.", "Run the sequence or step one address.", "Watch the tag, the line, and the miss type.", "Compare LRU and FIFO on a full set."],
    takeaways: ["A hit means the block is already in the cache.", "A miss means that block is absent.", "Replacement chooses which block to evict when the set is full.", "Compulsory, conflict, and capacity are different reasons for a miss.", "Reuse of a block raises the hit rate."],
  },
};

export const VM_LESSONS: Record<string, TabLesson> = {
  translate: {
    theory: { title: "Virtual address split", body: "A virtual address is a page number (VPN) plus an offset. The offset is copied into the physical address. The VPN indexes the page table (or TLB) to find the frame. This lab is not an operating system." },
    guide: ["Set the page size (offset bits) and enter a virtual address.", "Click Translate to split the address and walk the TLB and page table.", "Observe the translation and the resulting physical address.", "Try Read and Write, and addresses that miss or fault."],
    takeaways: ["The offset stays unchanged. The VPN is translated to a frame.", "A TLB hit can bypass the page-table walk.", "Page size is 2 to the power of the offset bits you choose."],
  },
  table: {
    theory: { title: "Page table", body: "Each VPN has an entry: valid, frame, dirty, referenced, and permission bits. A fault means the page is not resident. Loading a page updates the table so the next lookup can succeed." },
    guide: ["Set virtual pages, physical frames, and page size.", "Enter a virtual address and click Lookup.", "Select a VPN and inspect its page-table entry.", "A valid bit of 0 is a page fault until you handle it.", "Watch the frame highlight follow the selected mapping."],
    takeaways: ["The VPN indexes the page-table entry.", "The valid bit controls residency.", "The frame number selects the physical page. The offset is copied."],
  },
  tlb: {
    theory: { title: "TLB", body: "The TLB caches recent VPN-to-frame translations, tagged by ASID. A hit skips the page table. A miss walks the table and may install an entry. A page fault is not a TLB miss." },
    guide: ["Configure TLB size, associativity, and replacement.", "Enter a virtual address and an ASID, then Translate.", "See whether the lookup hit, and which entry was used.", "Try a thrashing trace and an ASID switch."],
    takeaways: ["A hit avoids the page-table walk.", "The TLB caches translations, not page data.", "ASID keeps one process from using another's translation."],
  },
  levels: {
    theory: { title: "Two-level page tables", body: "The virtual address splits into a page-directory index, a page-table index, and an offset. Second-level tables exist only for directories that are present. This is a teaching two-level split, not a claim about one processor's page-table depth." },
    guide: ["Set directory, table, and offset bits.", "Enter a virtual address or load the example.", "Read the page-directory index and the page-table index.", "Follow the walk from directory to second-level table to frame.", "The frame plus the offset is the physical address."],
    takeaways: ["The address splits into directory, table, and offset fields.", "Unused second-level tables need not exist.", "The physical address is the frame shifted by the offset width, plus the offset."],
  },
  protect: {
    theory: { title: "Protection bits", body: "Each page has read, write, execute, and user/supervisor bits. The lab checks presence, then privilege, then the requested access. A missing page is a page fault. A denied permission is a protection fault." },
    guide: ["Enter a virtual address.", "Choose Read, Write, or Execute.", "Choose User or Kernel.", "Read the permission bits for that page.", "Observe whether the access is granted or faulted, and why."],
    takeaways: ["R, W, X, and user/supervisor bits control the access.", "An invalid mapping is a page fault.", "A denied permission is a protection fault, not a successful translation."],
  },
};

export const IO_LESSONS: Record<string, TabLesson> = {
  devices: {
    theory: { title: "I/O devices", body: "Devices sit behind a controller on the bus. The CPU talks to status and data registers, not to the mechanical or analog part. Keyboard, display, storage, and sensor here are teaching models." },
    guide: ["Click each device and read its path.", "Status then data is the usual pair.", "The controller is the bus citizen.", "Interrupts and DMA are the next studio."],
    takeaways: ["The keyboard status and data registers are two addresses.", "The CPU never 'is' the device; it reads the controller.", "Paths here are teaching, not USB."],
  },
  mapped: {
    theory: { title: "Memory-mapped I/O", body: "Memory-mapped I/O uses ordinary loads and stores. An address in the I/O window selects a register, not RAM. Same instruction, different decoder destination." },
    guide: ["Enter an MMIO address and see which register it names.", "LOAD/STORE to that address are I/O.", "RAM addresses stay RAM.", "This CPU does not have a separate IN/OUT in mapped mode."],
    takeaways: ["Memory-mapped I/O uses ordinary loads and stores.", "The address picks the register.", "The same ISA load works for RAM and MMIO if the map says so."],
  },
  isolated: {
    theory: { title: "Isolated I/O", body: "Isolated I/O keeps a second address space, often with IN/OUT-style ops. A port number is not a memory address. This lab contrasts the two maps; it is not x86 port I/O in full." },
    guide: ["Compare a port number with a memory address.", "Isolated I/O keeps a second address space.", "The CPU needs a distinct instruction or space pin.", "Do not mix the two maps in one access."],
    takeaways: ["Isolated I/O keeps a second address space.", "Port ≠ memory address.", "Both maps still end at a controller register."],
  },
  poll: {
    theory: { title: "Programmed I/O", body: "Polling reads a status bit until the device is ready, then moves data. Each failed poll is a CPU cycle that did not run the main program. Interrupt-driven transfer is in the Interrupts & DMA studio." },
    guide: ["Set how many polls until ready.", "Count wasted polls before the transfer.", "Ready then data is two (or more) CPU operations.", "DMA moves the block without those polls."],
    takeaways: ["Polling wastes the polls that happen before the device is ready.", "Each failed poll is a CPU cycle that did not run the main program.", "Interrupt-driven transfer is in the Interrupts & DMA studio."],
  },
};

export const INTERRUPT_LESSONS: Record<string, TabLesson> = {
  timeline: {
    theory: { title: "Interrupt timeline", body: "A device request saves the PC, runs the vectored handler, and returns. The saved PC is the instruction that had not yet run. Hardware interrupts, exceptions, and the handler address are separate ideas." },
    guide: ["Raise IRQ and step the timeline.", "The saved PC is the instruction that had not yet run.", "The handler runs, then RETI restores the PC.", "This is an instruction-boundary take, not a cycle steal yet."],
    takeaways: ["Hardware interrupts, exceptions, and the handler address are separate ideas.", "The saved PC is the instruction that had not yet run.", "Return puts the CPU back on the interrupted program."],
  },
  priority: {
    theory: { title: "Priority", body: "Lower priority number wins when several devices are pending. That is the same 'lower number wins' rule as bus central arbitration in this curriculum." },
    guide: ["Pend two devices.", "Read which IRQ is serviced.", "Give the winner a worse (higher) number and watch it wait.", "Masking is a later OS topic; here the hardware pick is the number."],
    takeaways: ["Lower priority number wins when several devices are pending.", "Pending is not the same as granted.", "The vector still comes from the winner."],
  },
  vectors: {
    theory: { title: "Interrupt vectors", body: "A vector is the handler address (or an index into a table of addresses). IRQ number selects the vector. The CPU jumps there after saving the PC." },
    guide: ["Match IRQ to handler address in the table.", "Change a vector and take the interrupt.", "Shared vectors mean two IRQs one handler.", "This table is teaching-sized."],
    takeaways: ["The vector is where the handler starts.", "IRQ indexes the table.", "Wrong vector means the wrong handler runs."],
  },
  exceptions: {
    theory: { title: "Exceptions vs interrupts", body: "Interrupts are asynchronous device requests. Exceptions are synchronous with an instruction (fault, trap). Both may save PC and vector, but the cause and restart rules differ." },
    guide: ["Classify a page fault versus a timer IRQ.", "A trap is precise to an instruction.", "An IRQ is not caused by the current opcode.", "Handlers still use vectors."],
    takeaways: ["Exceptions are tied to an instruction; IRQs are not.", "Both can use a vector table.", "This lab names the class; it does not run an OS."],
  },
  dma: {
    theory: { title: "DMA", body: "DMA moves the block and interrupts once at the end. Setup and completion are CPU cycles. The bytes in between are not. Programmed copy of three words costs six CPU cycles here; DMA of the same three words costs the setup cycle plus the completion interrupt." },
    guide: ["Step DMA through the block.", "Compare with programmed copy of the same words.", "The CPU is free during the middle transfers.", "Completion is one interrupt, not one per byte."],
    takeaways: ["DMA setup and completion are CPU cycles. The bytes in between are not.", "Programmed copy of three words costs six CPU cycles here.", "DMA of the same three words costs the setup cycle plus the completion interrupt."],
  },
};

export const PARALLEL_LESSONS: Record<string, TabLesson> = {
  flynn: {
    theory: { title: "Flynn's taxonomy", body: "SISD, SIMD, MISD, MIMD classify streams of instructions versus data. This lab is a picture of those four, not a ranking. A GPU-like SIMD and a multicore MIMD can live in one SoC." },
    guide: ["Read each quadrant.", "SIMD is one instruction, many lanes.", "MIMD is many instruction streams.", "MISD is rare; treat it as a named box."],
    takeaways: ["Flynn names streams, not products.", "SIMD applies one operation to each lane.", "MIMD is multiple cores or threads with their own PCs."],
  },
  ilp: {
    theory: { title: "Instruction-level parallelism", body: "Issue width is a limit, not a guarantee. Independent instructions can share a cycle up to the issue width. A 4-wide machine does not retire four instructions every cycle." },
    guide: ["Set issue width and watch packing.", "AND depends on ADD and SUB — it waits.", "Independent ADDI can pair.", "Width is the cap; dependence is the truth."],
    takeaways: ["Independent instructions can share a cycle up to the issue width.", "A 4-wide machine does not retire four instructions every cycle.", "Dependencies, the ROB, and a wrong branch still set the pace."],
  },
  rename: {
    theory: { title: "Register renaming", body: "Renaming gives a later write of R1 a new physical register so a later independent write does not wait on the earlier R1. WAR/WAW on architectural names can disappear; true RAW remains." },
    guide: ["Watch R1's second write get a new physical tag.", "The dependent AND still waits on the first producer.", "Architectural names are the ones in the program.", "Physical names are the file the scheduler uses."],
    takeaways: ["Renaming gives a later write of R1 a new physical register.", "True dependences remain.", "This is a teaching rename, not a specific CPU map."],
  },
  rob: {
    theory: { title: "Reorder buffer", body: "The ROB retires the oldest completed instruction first so the architectural state commits in order. Younger instructions may finish earlier but wait to retire." },
    guide: ["Step the ROB and see in-order retire.", "A completed younger op still waits.", "A flush on a wrong path clears younger entries.", "Issue width still caps how many enter."],
    takeaways: ["The reorder buffer retires the oldest completed instruction first.", "Finish ≠ retire.", "In-order commit is the architectural promise."],
  },
  simd: {
    theory: { title: "SIMD lanes", body: "SIMD applies one operation to each lane of a vector. Four adds in one instruction are four ALUs looking at packed elements, not four scalar issue slots." },
    guide: ["Add packed lanes.", "Change a lane and see only that element move.", "Width is lanes × element size.", "This is the vector engine, not AVX-512."],
    takeaways: ["SIMD applies one operation to each lane.", "Lanes are packed elements, not separate PCs.", "A scalar loop of the same adds is SISD."],
  },
  smt: {
    theory: { title: "SMT", body: "SMT shares one core's issue slots between threads. Two PCs, one execution width. Empty slots from one thread can fill from the other when both are ready." },
    guide: ["Watch two threads share issue slots.", "A stall in one thread can let the other issue.", "Width is still the cap.", "This is not two full cores."],
    takeaways: ["SMT shares one core's issue slots between threads.", "Throughput can rise when one thread would have left slots idle.", "Each thread still has its own architectural state."],
  },
};

export const MULTICORE_LESSONS: Record<string, TabLesson> = {
  shared: {
    theory: { title: "Shared memory", body: "Each core can hold a copy. A write must make the other copies invalid or shared before the new value is the one later reads see. Separate lines do not create that invalidation." },
    guide: ["Read on two cores, then write on one.", "See the other copy change state.", "Two different lines do not snoop each other.", "The bus label names the teaching transaction."],
    takeaways: ["A write must make the other copies invalid or shared before the new value is the one later reads see.", "Separate lines do not create that invalidation.", "Shared memory is a coherence problem, not just a wire."],
  },
  mesi: {
    theory: { title: "MESI", body: "Modified, Exclusive, Shared, Invalid. A private read of an invalid line becomes Exclusive when nobody else has it. A read of a Modified line forces a write-back and both copies become Shared." },
    guide: ["Read on core 0 from I → E.", "Read on core 1 → both S.", "Write on core 0 → M, others I.", "A private read of an invalid line becomes Exclusive when nobody else has it."],
    takeaways: ["A private read of an invalid line becomes Exclusive when nobody else has it.", "A read of a Modified line forces a write-back and both copies become Shared.", "Writes to different bytes of one line still invalidate the other core."],
  },
  msi: {
    theory: { title: "MSI", body: "MSI has no Exclusive state, so a first read becomes Shared even if nobody else has the line. The next write still upgrades to Modified and invalidates others." },
    guide: ["Read on one core — Shared, not Exclusive.", "Write → Modified.", "Compare with MESI's E state.", "Fewer states, extra traffic on a silent upgrade that MESI would skip."],
    takeaways: ["MSI has no Exclusive state, so a first read becomes Shared.", "M, S, and I still cover dirty, clean-shared, and missing.", "MESI's E avoids a bus upgrade on a later private write."],
  },
  directory: {
    theory: { title: "Directory", body: "The directory records the owner or the sharers instead of broadcasting every snoop. A write finds the copies from the directory, then invalidates those. This is a teaching directory, not a chip snoop filter." },
    guide: ["Read and see a sharer listed.", "Write and see others dropped.", "An uncached line has no owner.", "Directory traffic replaces a full broadcast in this model."],
    takeaways: ["The directory records the owner or the sharers.", "Invalidations target known copies.", "Uncached means the directory has no one listed."],
  },
  false: {
    theory: { title: "False sharing", body: "Writes to different bytes of one line still invalidate the other core. The cores do not share a variable, they share a line. Padding to separate lines removes that invalidation in this lab." },
    guide: ["Write different bytes of the same line from two cores.", "Count extra invalidations.", "Move to separate lines and watch them stop.", "This is why structure padding appears in parallel code."],
    takeaways: ["Writes to different bytes of one line still invalidate the other core.", "False sharing is a line problem, not a variable problem.", "Separate lines do not create that invalidation."],
  },
};

export function lessonOf(map: Record<string, TabLesson>, tab: string, fallback: string): TabLesson {
  return map[tab] ?? map[fallback]!;
}
