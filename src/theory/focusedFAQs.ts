import type { TheoryArticle } from "./types";
import type { LessonFAQ } from "./faqs";

// Original answers describe mechanisms, not undocumented simulator capabilities.
const TOPICS: Array<{ match: RegExp; items: Array<[string, string]> }> = [
  { match: /\/architecture\/mobile\/power-thermal$/, items: [
    ["Why does junction temperature rise before enclosure temperature?", "Power is deposited at the junction first. Heat then crosses the junction-to-case thermal resistance and fills the enclosure’s larger heat capacity. The two temperatures therefore evolve on different time scales."],
    ["How can I compare burst and sustained thermal workloads fairly?", "Use the same workload, ambient temperature, thermal resistances, capacities, and initial state. Compare equal simulated durations and export both traces. Peak temperature, energy, and throttled samples answer different questions; a lower average load can still produce a short temperature peak."],
    ["Why does frequency remain reduced after temperature drops below the throttle limit?", "The thermal governor uses hysteresis. This lab enters throttling at the configured limit and recovers below a threshold 5 °C lower. That separation prevents rapid switching around a single threshold."],
    ["Does this thermal experiment predict a particular phone’s temperature?", "No. It uses a two-node RC model with stated teaching coefficients and a cubic frequency-to-dynamic-power approximation. Spatial hotspots, radiation, battery heating, and temperature-dependent leakage are omitted; manufacturer measurements are needed for a product prediction."],
  ] },
  { match: /hamming|secded/, items: [
    ["Does a zero Hamming syndrome prove that no error occurred?", "Only within the error model being tested. Standard Hamming decoding locates a single-bit error; some multi-bit errors can produce misleading or zero syndromes. SECDED adds an overall parity bit to distinguish single-bit correction from double-bit detection."],
    ["Why do Hamming parity positions use powers of two?", "With one-based bit positions, each parity check covers positions whose binary index has its corresponding bit set. Positions 1, 2, 4, and 8 isolate those index bits, allowing a single-bit error’s syndrome to identify its position."],
  ] },
  { match: /cache|replacement|associativ/, items: [
    ["Can a larger cache still produce a miss?", "Yes. The first access to a block can miss, a working set can exceed capacity, and blocks mapping to the same set can conflict. Compare the same address trace while changing one capacity, block-size, or associativity parameter."],
    ["Why should I distinguish hit rate from average access time?", "Hit rate counts successful lookups, while average access time also depends on hit latency and miss penalty. For a simple blocking cache, AMAT = hit time + miss rate × miss penalty. Higher hit rate alone does not establish lower execution time."],
  ] },
  { match: /dma|direct memory access/, items: [
    ["Why can the CPU still read stale data after a DMA transfer completes?", "Completion and cache visibility are separate concerns on non-coherent systems. Software may need cache maintenance and appropriate ordering before consuming a DMA buffer. A coherent model removes some maintenance requirements but still needs completion synchronization."],
    ["Does DMA eliminate all CPU work?", "No. Software still prepares buffers and descriptors, starts the transfer, handles completion or errors, and manages buffer ownership. DMA moves the repeated data-transfer work away from CPU load/store instructions."],
  ] },
  { match: /uart|serial communication/, items: [
    ["Why can UART receive the wrong byte even when the voltage levels look correct?", "The receiver must also agree on baud rate, data-bit count, parity, stop bits, and polarity. A timing or framing mismatch moves the sampling points or changes how bits are interpreted. Check those settings before diagnosing the transmitted payload."],
    ["Is UART baud rate equal to application data throughput?", "Not generally. With one start bit, eight data bits, and one stop bit, a byte occupies ten bit times. The ideal payload rate is therefore baud rate × 8/10 bits per second before gaps or higher-level protocol overhead."],
  ] },
  { match: /i²c|i2c/, items: [
    ["Why does I²C need pull-up resistors?", "SDA and SCL conventionally use open-drain signaling: devices pull a line low and release it for high. Pull-ups charge the bus capacitance when released. Their resistance affects rise time and low-level sink current."],
    ["What should I inspect when an I²C transaction is not acknowledged?", "Check the selected address convention, read/write direction, device readiness, power, and bus wiring. Distinguish the seven-bit device address from the complete address byte containing the direction bit. A NACK is a protocol observation, not a unique diagnosis."],
  ] },
  { match: /spi communication|spi bus/, items: [
    ["Why does an SPI mode mismatch shift or corrupt received data?", "Clock polarity sets the idle clock level, and phase sets which edge captures data. Master and peripheral must agree so the sampling edge occurs after the transmitter has made the bit valid."],
    ["Does sharing the SPI clock mean every peripheral should respond?", "No. Chip select determines which peripheral participates in a transaction. Unselected peripherals must release a shared output line according to their interface specification; conflicting drivers can corrupt the transfer."],
  ] },
  { match: /adc|quantization|analog.to.digital/, items: [
    ["Does adding ADC bits automatically improve measurement accuracy?", "More bits reduce the ideal quantization step for a fixed input range. They do not remove reference error, sensor offset, noise, nonlinearity, or calibration error. Resolution and total accuracy must be evaluated separately."],
    ["Why can different analog inputs produce the same ADC code?", "Quantization assigns an interval of analog values to each code. Inputs within the same interval produce the same ideal result. Check the configured reference, bit depth, clipping, and rounding convention before interpreting a one-code difference."],
  ] },
  { match: /pwm|servo motor/, items: [
    ["Does changing PWM duty cycle change its frequency?", "Duty cycle is the active fraction of a period; frequency is the reciprocal of that period. They can be adjusted independently when the timer configuration permits. Compare pulse width and total period separately in the waveform."],
    ["Can I infer a motor’s speed or a servo’s angle directly from duty cycle?", "Only with a specified actuator and control model. A motor’s response depends on voltage, load, and dynamics. A hobby servo typically interprets pulse width within a supported frame timing, rather than duty cycle alone."],
  ] },
  { match: /gpio|digital input|digital output|pin multiplex/, items: [
    ["Why can an unconnected digital input change state?", "A floating input has no defined external voltage and can respond to leakage or coupled noise. A suitable pull-up or pull-down provides a default level. An ideal teaching model may represent only logic states and omit this electrical behavior."],
    ["Why might writing an output register fail to change a pin?", "The pin may be configured as an input or assigned to an alternate peripheral function. Check direction, output-enable, and multiplexing before checking the data bit. On physical hardware also check voltage domains and external loading."],
  ] },
  { match: /timer|\/studios\/counters|input.capture|output.compare/, items: [
    ["How do prescaler and counter limit affect a timer period?", "The prescaler divides the source clock before counting. For a counter visiting zero through TOP inclusively, a simple overflow period is (TOP + 1) × prescaler / source frequency. Different count modes or compare conventions can change that expression."],
    ["Why can a timer result be off by one tick?", "Check whether the terminal count is inclusive, whether the event occurs before or after incrementing, and when a new register value takes effect. Capture and compare are different operations; specify the event ordering before counting cycles."],
  ] },
  { match: /interrupt/, items: [
    ["Why can a pending interrupt remain unserviced?", "A request can be pending while masked, globally disabled, below the current priority threshold, or blocked by an active handler. Inspect request, eligibility, priority, and service state separately."],
    ["What is the difference between interrupt latency and handler execution time?", "Latency is the delay from the relevant request to entry into service under the chosen convention. Handler execution time is the work performed after entry. Saving state, arbitration, masking, and higher-priority activity can affect latency."],
  ] },
  { match: /pipeline|hazard|forwarding/, items: [
    ["Why can forwarding fail to remove every pipeline stall?", "Forwarding helps only when the producer’s result exists in time for the consumer’s required stage. A load-use dependency can still need a bubble because the value arrives after the next instruction would otherwise consume it."],
    ["Why should I separate pipeline latency from throughput?", "Latency measures one instruction’s journey through the stages. Throughput measures completions per unit time after overlap begins. More stages can improve clock frequency while increasing latency and recovery costs."],
  ] },
  { match: /k.map|kmap|boolean|logic gate|truth table/, items: [
    ["How can I verify that two logic expressions are equivalent?", "Evaluate both for every input combination in the selected width and compare outputs. For a small combinational function, a complete truth table checks equivalence. Matching only a few examples can miss a failing input."],
    ["Does a simpler Boolean expression always produce faster hardware?", "No. Literal count does not capture gate fan-in, logic depth, loading, or physical wiring. Logical minimization and implementation timing are related but different optimization problems."],
  ] },
  { match: /flip.flop|latch|\/studios\/registers|setup.time|hold.time/, items: [
    ["Why does an output retain its old value when an input changes?", "Storage elements update only under their specified enable or clock condition. A latch is level-sensitive while enabled; an edge-triggered register samples at its active edge. Inspect reset, enable, and clock before expecting a state change."],
    ["Can an ideal digital simulation demonstrate analog metastability?", "An ideal logic model can illustrate a timing violation or uncertain state, but it does not predict analog resolution time. Physical metastability depends on circuit properties and input timing; synchronizers reduce failure probability rather than guaranteeing immediate resolution."],
  ] },
  { match: /signed|overflow|adder|arithmetic|\balu\b/, items: [
    ["Why can carry and signed overflow disagree?", "Carry describes arithmetic beyond the chosen unsigned width. Signed overflow describes a result outside the signed representable range. The same stored bit pattern can therefore have different validity under signed and unsigned interpretations."],
    ["Why does a result wrap around at a fixed word width?", "Keeping only n bits implements arithmetic modulo 2ⁿ. Interpret the retained bits using the configured number format and inspect status flags separately; the displayed bit pattern does not contain discarded high bits."],
  ] },
  { match: /virtual memory|page table|tlb/, items: [
    ["Is a TLB miss the same as a page fault?", "No. A TLB miss means a translation was not found in the translation cache. A page-table walk can still find a valid permitted mapping. A page fault reflects a condition requiring fault handling, such as a missing or disallowed mapping."],
    ["Which address bits remain unchanged during paging?", "The page offset passes through translation unchanged. The virtual page number selects a mapping to a physical frame. Page size determines the offset width; permissions must still be checked."],
  ] },
  { match: /coherence|mesi|moesi|false shar|multicore/, items: [
    ["Does cache coherence guarantee that all memory operations occur in program order?", "No. Coherence governs consistency of individual memory locations or cache lines. Memory ordering constrains relationships between different operations and addresses. Synchronization and the architecture’s ordering rules remain necessary."],
    ["Why can threads interfere even when they update different variables?", "If the variables occupy one cache line, writes can repeatedly transfer or invalidate ownership of that line. This is false sharing. Compare placement and access patterns before attributing the effect to the variables’ logical relationship."],
  ] },
  { match: /finite state|fsm|state machine/, items: [
    ["Why can a Moore output change later than a Mealy output?", "A Moore output depends on stored state; a Mealy output also depends on current input. For the same behavior, the output timing can differ. Compare the stated clock and sampling convention rather than assuming identical cycle alignment."],
    ["How should I test an FSM beyond its normal input sequence?", "Check reset, each reachable state, transition conditions, and boundary or unexpected inputs. Verify outputs as well as next state. One successful path does not establish that every transition is correct."],
  ] },
];

export function focusedFAQs(article: TheoryArticle): LessonFAQ[] {
  const text = `${article.title} ${article.route}`.toLowerCase();
  const topic = TOPICS.find(topic => topic.match.test(text));
  return topic?.items.map(([question, answer]) => ({ question, answer })) ?? [];
}
