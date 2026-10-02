import { VLSI_CATEGORIES, type VlsiCategory, type VlsiLabMeta } from "../../data/vlsiLabs";

export function labMatches(lab: VlsiLabMeta, query: string): boolean {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const category = VLSI_CATEGORIES.find((item) => item.id === lab.category)?.title ?? "";
  const haystack = `${lab.number} ${lab.title} ${lab.summary} ${category} ${lab.reuse ?? ""} ${lab.slug.replace(/-/g, " ")}`.toLowerCase();
  return words.every((word) => haystack.includes(word));
}

export const CATEGORY_COLOR: Record<VlsiCategory, string> = {
  device: "#0284c7",
  cmos: "#e11d48",
  timing: "#d97706",
  layout: "#7c3aed",
  cells: "#0f766e",
  physical: "#2563eb",
  power: "#ca8a04",
  memory: "#db2777",
  advanced: "#4f46e5",
  fab: "#059669",
  dft: "#dc2626",
  soc: "#0891b2",
  flow: "#475569",
};

export const DIFFICULTIES = ["Foundational", "Intermediate", "Advanced"] as const;

export const DURATIONS = [
  { id: "short", label: "Under 13 min", test: (minutes: number) => minutes < 13 },
  { id: "medium", label: "13–16 min", test: (minutes: number) => minutes >= 13 && minutes <= 16 },
  { id: "long", label: "17+ min", test: (minutes: number) => minutes > 16 },
] as const;

export interface LearningPath {
  id: string;
  title: string;
  blurb: string;
  slugs: string[];
}

export const LEARNING_PATHS: LearningPath[] = [
  { id: "transistor-to-inverter", title: "Transistor to inverter", blurb: "From a single MOSFET to a sized, timed, power-aware inverter.", slugs: ["mosfet-fundamentals", "mosfet-iv", "mos-capacitor", "cmos-inverter", "cmos-vtc", "propagation-delay", "cmos-power"] },
  { id: "gates-and-storage", title: "Gates and storage", blurb: "Complementary networks, pass logic, and the first bits of memory.", slugs: ["cmos-nand", "cmos-nor", "complex-cmos", "transmission-gate", "sr-latch", "d-latch", "d-flip-flop"] },
  { id: "timing-closure", title: "Timing closure", blurb: "Read slack, size the path, and tame the wires.", slugs: ["setup-hold", "clocking", "combinational-timing", "static-timing", "timing-path", "logical-effort", "interconnect-rc", "crosstalk"] },
  { id: "rtl-to-gdsii", title: "RTL to GDSII", blurb: "Carry one design from Verilog through sign-off.", slugs: ["rtl-visualization", "logic-synthesis", "technology-mapping", "floorplanning", "placement", "clock-tree", "routing", "drc", "lvs", "rtl-gdsii"] },
  { id: "memory-design", title: "Memory design", blurb: "Bit cells, sensing, decoding, and arrays.", slugs: ["sram-6t", "sram-read", "sram-write", "sense-amplifier", "sram-array", "memory-decoder", "dram-1t1c", "nonvolatile-cells"] },
  { id: "low-power", title: "Low-power design", blurb: "Where the energy goes and the techniques that claw it back.", slugs: ["cmos-power", "clock-gating", "power-gating", "multi-vt", "multi-vdd", "ir-drop"] },
  { id: "fab-and-test", title: "Fab and test", blurb: "Build the wafer, then prove each die works.", slugs: ["cmos-fabrication", "photolithography", "doping", "etching", "metallization", "yield", "scan-chain", "atpg", "bist"] },
];

export interface GlossaryEntry {
  term: string;
  def: string;
}

export const GLOSSARY: GlossaryEntry[] = [
  { term: "VDD", def: "The positive supply rail. Logic 1 settles here." },
  { term: "VTH", def: "Threshold voltage: the gate voltage where the channel starts to conduct." },
  { term: "NMOS", def: "N-channel MOSFET. Conducts when its gate is high; strong at pulling to ground." },
  { term: "PMOS", def: "P-channel MOSFET. Conducts when its gate is low; strong at pulling to VDD." },
  { term: "MOSFET", def: "Metal-oxide-semiconductor field-effect transistor, the switch every CMOS gate is built from." },
  { term: "CMOS", def: "Complementary MOS: a PMOS pull-up network paired with its NMOS dual pull-down." },
  { term: "crowbar", def: "Short-circuit current that flows straight from VDD to ground while both networks are briefly on." },
  { term: "saturation", def: "MOSFET region where VDS ≥ VGS − VTH and current is set mainly by the gate." },
  { term: "cutoff", def: "MOSFET region below threshold: only leakage flows." },
  { term: "noise margin", def: "How much noise a logic level can tolerate before the next gate misreads it (NML, NMH)." },
  { term: "slew", def: "How fast a signal transitions, usually measured 10%–90% or 20%–80%." },
  { term: "fan-out", def: "The number of gate inputs one output drives. More fan-out means more load capacitance." },
  { term: "Elmore", def: "A first-order RC delay estimate: sum of each resistance times all downstream capacitance." },
  { term: "logical effort", def: "How much worse a gate is at driving current than an inverter with the same input capacitance." },
  { term: "setup", def: "Setup time: how long data must be stable before the capturing clock edge." },
  { term: "hold", def: "Hold time: how long data must stay stable after the capturing clock edge." },
  { term: "slack", def: "Required time minus arrival time. Negative slack is a timing violation." },
  { term: "skew", def: "Difference in clock arrival time between two sinks." },
  { term: "jitter", def: "Cycle-to-cycle variation of a clock edge around its ideal time." },
  { term: "metastability", def: "A flip-flop output stuck between rails after an unsafe sample, resolving after a random delay." },
  { term: "DRC", def: "Design rule check: width, spacing, and enclosure rules the fab can manufacture." },
  { term: "LVS", def: "Layout versus schematic: proves the drawn layout implements the intended netlist." },
  { term: "parasitic", def: "Unintended resistance and capacitance that comes with real wires and devices." },
  { term: "netlist", def: "A list of devices or cells and the nets that connect them." },
  { term: "standard cell", def: "A pre-designed, fixed-height layout of a logic function used by synthesis and placement." },
  { term: "floorplan", def: "The chip-level arrangement of macros, I/O, and core area before placement." },
  { term: "congestion", def: "More routing demand in a region than the available tracks can supply." },
  { term: "IR drop", def: "Supply voltage lost across the resistance of the power grid under load." },
  { term: "electromigration", def: "Metal atoms pushed along by current, eventually opening or shorting a wire." },
  { term: "crosstalk", def: "Noise or delay change on a victim net caused by coupling capacitance to an aggressor." },
  { term: "leakage", def: "Current that flows even when a transistor is nominally off." },
  { term: "activity", def: "Activity factor α: the fraction of clock cycles in which a node switches." },
  { term: "power gating", def: "Cutting the supply to an idle block with header or footer switches to stop leakage." },
  { term: "clock gating", def: "Stopping the clock to idle registers so they burn no dynamic power." },
  { term: "FinFET", def: "A transistor whose channel is a vertical fin wrapped by the gate on three sides." },
  { term: "SRAM", def: "Static RAM: a bit held by cross-coupled inverters, no refresh needed." },
  { term: "DRAM", def: "Dynamic RAM: a bit stored as charge on a capacitor that must be refreshed." },
  { term: "sense amplifier", def: "A regenerative circuit that turns a small bitline difference into a full logic level." },
  { term: "scan chain", def: "Flip-flops stitched into a shift register so test patterns can be loaded and read out." },
  { term: "ATPG", def: "Automatic test pattern generation: finds inputs that expose each modelled fault." },
  { term: "BIST", def: "Built-in self-test: on-chip pattern generation and response checking." },
  { term: "JTAG", def: "IEEE 1149.1 test access port used for boundary scan and debug." },
  { term: "stuck-at", def: "A fault model where a node is permanently 0 or 1." },
  { term: "CMP", def: "Chemical-mechanical polishing: flattens the wafer between layers." },
  { term: "yield", def: "Fraction of dies on a wafer that work." },
  { term: "PVT", def: "Process, voltage, and temperature: the corners a design must work across." },
  { term: "body effect", def: "Threshold voltage rises when the source sits above the body." },
];

export const UNIT_HELP: Record<string, string> = {
  V: "volts",
  mV: "millivolts, 10⁻³ V",
  A: "amperes",
  mA: "milliamperes, 10⁻³ A",
  "µA": "microamperes, 10⁻⁶ A",
  nA: "nanoamperes, 10⁻⁹ A",
  W: "watts",
  mW: "milliwatts, 10⁻³ W",
  "µW": "microwatts, 10⁻⁶ W",
  nW: "nanowatts, 10⁻⁹ W",
  fF: "femtofarads, 10⁻¹⁵ F",
  pF: "picofarads, 10⁻¹² F",
  "µm": "micrometres, 10⁻⁶ m",
  nm: "nanometres, 10⁻⁹ m",
  ps: "picoseconds, 10⁻¹² s",
  ns: "nanoseconds, 10⁻⁹ s",
  s: "seconds",
  Hz: "hertz, cycles per second",
  kHz: "kilohertz, 10³ Hz",
  MHz: "megahertz, 10⁶ Hz",
  GHz: "gigahertz, 10⁹ Hz",
  "°C": "degrees Celsius",
  "Ω": "ohms",
  "kΩ": "kilohms, 10³ Ω",
  "%": "percent",
};

export const FORMULAS: Record<string, string> = {
  Vout: "Solved where the NMOS current equals the PMOS current at this Vin.",
  "Supply current": "The smaller of the NMOS and PMOS currents; the series stack can only pass what the weaker device allows.",
  VM: "Switching threshold, where Vout = Vin. VM rises as kp/kn grows.",
  VIL: "Largest input still read as 0: the low-side point where dVout/dVin = −1.",
  VIH: "Smallest input read as 1: the high-side point where dVout/dVin = −1.",
  VOH: "Output high level, read on the curve at Vin = VIL.",
  VOL: "Output low level, read on the curve at Vin = VIH.",
  NML: "NML = VIL − VOL",
  NMH: "NMH = VOH − VIH",
  "dVout/dVin": "Small-signal gain: the slope of the transfer curve at the marker.",
  Dynamic: "P_dyn = α · C · VDD² · f",
  "Short-circuit": "Flows only while both networks conduct during an edge. In this model it scales with α · f and (VDD − 2·VTH)³.",
  Leakage: "P_leak = VDD · I_off. In this model I_off scales with device width and grows exponentially with temperature.",
  Total: "P_total = P_dyn + P_sc + P_leak",
  tpHL: "tpHL ≈ 0.69 · Req,N · CL + slew/10",
  tpLH: "tpLH ≈ 0.69 · Req,P · CL + slew/10",
  "Req NMOS": "Req ≈ VDD / Id,sat of the NMOS at VGS = VDS = VDD",
  "Req PMOS": "Req ≈ VDD / Id,sat of the PMOS at VGS = VDS = VDD",
  "Fall time": "10%–90% of the falling output, about 2.2 · Req,N · CL",
  "Rise time": "10%–90% of the rising output, about 2.2 · Req,P · CL",
  Slack: "Slack = required time − arrival time",
  Skew: "Skew = latest sink arrival − earliest sink arrival",
};

export interface Preset {
  name: string;
  values: Record<string, number | string>;
}

export const PRESETS: Record<string, Preset[]> = {
  "cmos-inverter": [
    { name: "Balanced inverter", values: { VDD: 1.8, "NMOS width": 1, "PMOS width": 2.5, Vin: 0.9 } },
    { name: "Skewed high (strong PMOS)", values: { VDD: 1.8, "NMOS width": 0.6, "PMOS width": 6, Vin: 0.9 } },
    { name: "Skewed low (strong NMOS)", values: { VDD: 1.8, "NMOS width": 4, "PMOS width": 1, Vin: 0.9 } },
    { name: "Near-threshold supply", values: { VDD: 0.9, "NMOS width": 1, "PMOS width": 2.5, Vin: 0.45 } },
  ],
  "cmos-vtc": [
    { name: "Symmetric VTC", values: { VDD: 1.8, "NMOS width": 1, "PMOS width": 2.5, "NMOS VTH": 0.45, "|PMOS VTH|": 0.45 } },
    { name: "High VM", values: { VDD: 1.8, "NMOS width": 0.6, "PMOS width": 7, "NMOS VTH": 0.45, "|PMOS VTH|": 0.45 } },
    { name: "Low VM", values: { VDD: 1.8, "NMOS width": 5, "PMOS width": 1, "NMOS VTH": 0.45, "|PMOS VTH|": 0.45 } },
    { name: "Low-VTH, low supply", values: { VDD: 1, "NMOS width": 1, "PMOS width": 2.5, "NMOS VTH": 0.25, "|PMOS VTH|": 0.25 } },
  ],
  "cmos-power": [
    { name: "Mobile active", values: { VDD: 0.8, Frequency: 1500, "Activity α": 0.15, Load: 20, Temperature: 45, VTH: 0.35, "Device width": 1 } },
    { name: "Low-power corner", values: { VDD: 0.6, Frequency: 100, "Activity α": 0.05, Load: 10, Temperature: 27, VTH: 0.5, "Device width": 0.6 } },
    { name: "Hot standby (leakage)", values: { VDD: 1.2, Frequency: 1, "Activity α": 0, Load: 20, Temperature: 110, VTH: 0.2, "Device width": 4 } },
    { name: "Overclocked desktop", values: { VDD: 1.4, Frequency: 2000, "Activity α": 0.3, Load: 60, Temperature: 85, VTH: 0.3, "Device width": 2 } },
  ],
  "propagation-delay": [
    { name: "Minimum-size, light load", values: { "Input slew": 20, "Load CL": 5, "NMOS width": 0.4, "PMOS width": 0.8, VDD: 1.2 } },
    { name: "Heavy fan-out", values: { "Input slew": 80, "Load CL": 140, "NMOS width": 1, "PMOS width": 2.5, VDD: 1.2 } },
    { name: "Upsized driver", values: { "Input slew": 80, "Load CL": 140, "NMOS width": 6, "PMOS width": 8, VDD: 1.2 } },
    { name: "Weak PMOS", values: { "Input slew": 50, "Load CL": 40, "NMOS width": 2, "PMOS width": 0.4, VDD: 1.2 } },
  ],
};

export interface Question {
  prompt: string;
  options: string[];
  answer: number;
  explain: string;
}

export const PREDICTS: Record<string, Question> = {
  "cmos-inverter": { prompt: "Halfway between the rails, which transistors conduct?", options: ["Only the PMOS", "Only the NMOS", "Both", "Neither"], answer: 2, explain: "Both are on in the transition region, which is why crowbar current flows from VDD to ground." },
  "cmos-vtc": { prompt: "If you make the PMOS much wider, where does VM move?", options: ["Toward ground", "Toward VDD", "It stays at VDD/2"], answer: 1, explain: "A stronger pull-up wins the current balance, so the output stays high until Vin is larger. VM climbs toward VDD." },
  "cmos-power": { prompt: "You double VDD and keep everything else fixed. Dynamic power becomes…", options: ["2×", "4×", "Unchanged", "½×"], answer: 1, explain: "Dynamic power is α·C·VDD²·f, so doubling VDD quadruples it." },
  "propagation-delay": { prompt: "Double the load capacitance. What happens to tp?", options: ["Roughly doubles", "Halves", "Barely changes", "Quadruples"], answer: 0, explain: "tp ≈ 0.69·Req·CL is linear in CL, so the RC part doubles." },
  "mosfet-iv": { prompt: "In saturation, raising VDS a little mostly…", options: ["Doubles the current", "Leaves the current almost flat", "Turns the device off"], answer: 1, explain: "Past the knee the channel pinches off and current is set by VGS, so the curve flattens." },
  "cmos-nand": { prompt: "For a NAND output to go low, the inputs must be…", options: ["Any one input high", "All inputs high", "All inputs low"], answer: 1, explain: "The NMOS devices are in series, so every one of them must conduct to reach ground." },
  "setup-hold": { prompt: "Data changes 5 ps before the edge with a 20 ps setup requirement. Result?", options: ["Clean capture", "Setup violation", "Hold violation"], answer: 1, explain: "Data arrived inside the setup window before the edge, so setup slack is negative." },
  "interconnect-rc": { prompt: "Double the length of a distributed RC wire. Its Elmore delay becomes about…", options: ["2×", "4×", "Unchanged"], answer: 1, explain: "Both R and C scale with length, so delay grows with length²." },
  "logical-effort": { prompt: "Which gate has the higher logical effort per input?", options: ["Inverter", "2-input NAND", "2-input NOR"], answer: 2, explain: "NOR stacks slow PMOS devices in series, so its logical effort (5/3) is above NAND's (4/3)." },
};

export const QUIZZES: Record<string, Question[]> = {
  "mosfet-fundamentals": [
    { prompt: "An NMOS channel forms when…", options: ["VGS > VTH", "VGS < 0", "VDS > VDD"], answer: 0, explain: "A gate voltage above threshold inverts the surface and forms an electron channel." },
    { prompt: "Below threshold the device is in…", options: ["Saturation", "Linear", "Cutoff"], answer: 2, explain: "In cutoff only subthreshold leakage flows." },
    { prompt: "Carriers in an NMOS channel are…", options: ["Holes", "Electrons", "Ions"], answer: 1, explain: "NMOS conducts with electrons, which are faster than the holes a PMOS uses." },
  ],
  "mosfet-iv": [
    { prompt: "The linear and saturation regions meet where…", options: ["VDS = VGS − VTH", "VGS = 0", "VDS = 0"], answer: 0, explain: "That is the pinch-off point, the knee of each curve." },
    { prompt: "In the square-law model, saturation current scales with…", options: ["(VGS − VTH)", "(VGS − VTH)²", "VDS²"], answer: 1, explain: "Id,sat = ½·k·(VGS − VTH)²." },
    { prompt: "Doubling W (same L) makes the current…", options: ["Double", "Halve", "Unchanged"], answer: 0, explain: "k is proportional to W/L." },
  ],
  "cmos-inverter": [
    { prompt: "With Vin = 0, the output is pulled up by…", options: ["The NMOS", "The PMOS", "Both"], answer: 1, explain: "A low gate turns the PMOS on and the NMOS off." },
    { prompt: "Static current in a settled CMOS inverter is…", options: ["Large", "Ideally only leakage", "Equal to the switching current"], answer: 1, explain: "One network is always off in a settled state." },
    { prompt: "Why is the PMOS usually wider?", options: ["Holes are slower than electrons", "It carries more current", "Layout rules"], answer: 0, explain: "Lower hole mobility is compensated with more width to balance the edges." },
  ],
  "cmos-vtc": [
    { prompt: "VIL and VIH are where the slope equals…", options: ["0", "−1", "−∞"], answer: 1, explain: "Unity-gain points bound the region where noise is amplified." },
    { prompt: "NMH is…", options: ["VOH − VIH", "VIL − VOL", "VDD − VM"], answer: 0, explain: "High noise margin is the gap between the output high level and the input high threshold." },
    { prompt: "Lowering VDD makes the noise margins…", options: ["Larger", "Smaller", "Unchanged"], answer: 1, explain: "Margins scale roughly with the supply." },
  ],
  "cmos-power": [
    { prompt: "Which term does not need switching activity?", options: ["Dynamic", "Short-circuit", "Leakage"], answer: 2, explain: "Leakage flows whenever the supply is on." },
    { prompt: "Raising temperature mainly increases…", options: ["Dynamic power", "Leakage", "Load capacitance"], answer: 1, explain: "Subthreshold current grows exponentially with temperature." },
    { prompt: "Halving frequency at fixed VDD halves…", options: ["Dynamic power", "Leakage power", "Energy per operation"], answer: 0, explain: "Dynamic power is proportional to f; energy per switch stays C·VDD²." },
  ],
  "propagation-delay": [
    { prompt: "tpHL depends mainly on…", options: ["The NMOS strength", "The PMOS strength", "VTH only"], answer: 0, explain: "A falling output discharges through the NMOS network." },
    { prompt: "Raising VDD (same load) usually makes the gate…", options: ["Faster", "Slower", "No change"], answer: 0, explain: "More gate drive gives more current and a lower Req." },
    { prompt: "tp is measured between…", options: ["10% and 90% of the output", "50% of input and 50% of output", "0 and VDD"], answer: 1, explain: "Propagation delay uses the 50% crossings; rise and fall use 10%–90%." },
  ],
  "cmos-nand": [
    { prompt: "In a CMOS NAND the PMOS devices are…", options: ["In series", "In parallel", "Absent"], answer: 1, explain: "The pull-up is the dual of the series pull-down." },
    { prompt: "A NAND output is 0 only when…", options: ["Any input is 1", "All inputs are 1", "All inputs are 0"], answer: 1, explain: "All series NMOS devices must conduct." },
    { prompt: "NAND is usually preferred to NOR because…", options: ["Series NMOS is cheaper than series PMOS", "It has fewer transistors", "It is always faster to rise"], answer: 0, explain: "Stacking fast NMOS devices costs less than stacking slow PMOS devices." },
  ],
  "cmos-nor": [
    { prompt: "In a CMOS NOR the PMOS devices are…", options: ["In series", "In parallel"], answer: 0, explain: "Parallel NMOS pull-down, series PMOS pull-up." },
    { prompt: "NOR output is 1 only when…", options: ["All inputs are 0", "Any input is 0", "All inputs are 1"], answer: 0, explain: "Every series PMOS must be on." },
    { prompt: "Wide NOR gates are avoided because…", options: ["Series PMOS stacks are slow", "They leak less", "They need more wells"], answer: 0, explain: "Each extra series PMOS adds resistance to an already weak pull-up." },
  ],
  "setup-hold": [
    { prompt: "Hold violations are fixed by…", options: ["Adding delay to the short path", "Slowing the clock", "Raising VDD"], answer: 0, explain: "Hold is independent of the clock period; you add delay to the fast path." },
    { prompt: "Setup violations can be fixed by…", options: ["Lowering the clock frequency", "Adding a buffer to the clock of the launch flop", "Making the data path longer"], answer: 0, explain: "A longer period gives data more time to arrive." },
    { prompt: "Slack below zero means…", options: ["Timing passes", "Timing fails", "No path exists"], answer: 1, explain: "Negative slack is a violation." },
  ],
  "static-timing": [
    { prompt: "Arrival time is…", options: ["When data actually reaches a pin", "When it must arrive", "The clock period"], answer: 0, explain: "Required time is the deadline; arrival is the actual time." },
    { prompt: "Setup slack = …", options: ["Required − arrival", "Arrival − required", "Period − skew"], answer: 0, explain: "Positive means data arrives before its deadline." },
    { prompt: "STA differs from simulation because it…", options: ["Checks every path without vectors", "Needs test patterns", "Only checks one path"], answer: 0, explain: "STA is exhaustive and vectorless." },
  ],
  "logical-effort": [
    { prompt: "The logical effort of an inverter is…", options: ["1", "4/3", "5/3"], answer: 0, explain: "The inverter is the reference." },
    { prompt: "Best stage effort for minimum delay is about…", options: ["1", "4", "16"], answer: 1, explain: "A stage effort near 4 (≈e with parasitics) minimises path delay." },
    { prompt: "Path effort F equals…", options: ["G · B · H", "G + B + H", "N · g"], answer: 0, explain: "The product of logical, branching, and electrical effort." },
  ],
  "interconnect-rc": [
    { prompt: "Long-wire delay grows with length as…", options: ["L", "L²", "√L"], answer: 1, explain: "R and C both scale with L." },
    { prompt: "The standard fix for a long wire is…", options: ["Insert repeaters", "Use a thinner wire", "Lower VDD"], answer: 0, explain: "Repeaters split the wire so delay becomes linear in length." },
    { prompt: "The Elmore delay of a lumped RC is…", options: ["0.69RC", "RC", "2.2RC"], answer: 0, explain: "0.69RC is the 50% point of a single-pole response." },
  ],
  drc: [
    { prompt: "A spacing rule limits…", options: ["The gap between shapes on one layer", "The width of a shape", "How far metal overlaps a contact"], answer: 0, explain: "Width and enclosure are separate rules." },
    { prompt: "DRC proves that the layout…", options: ["Can be manufactured", "Matches the schematic", "Meets timing"], answer: 0, explain: "LVS checks connectivity; STA checks timing." },
    { prompt: "An enclosure rule makes sure…", options: ["Metal extends past a contact", "Wells never touch", "Poly is minimum width"], answer: 0, explain: "Misalignment must not leave a contact uncovered." },
  ],
  "sram-6t": [
    { prompt: "A 6T cell stores its bit in…", options: ["Two cross-coupled inverters", "A capacitor", "A floating gate"], answer: 0, explain: "Four transistors form the latch; two are access devices." },
    { prompt: "Read stability needs the pull-down to be…", options: ["Stronger than the access device", "Weaker than the access device", "Equal to the PMOS"], answer: 0, explain: "The cell ratio keeps the 0 node from flipping during a read." },
    { prompt: "Writability needs the access device to be…", options: ["Stronger than the pull-up", "Weaker than the pull-up"], answer: 0, explain: "The pull-up ratio lets the bitline overpower the cell." },
  ],
  "scan-chain": [
    { prompt: "In scan mode the flip-flops form…", options: ["A shift register", "A counter", "An adder"], answer: 0, explain: "Scan-enable switches each flop's input to the previous flop's output." },
    { prompt: "Scan improves…", options: ["Controllability and observability", "Clock speed", "Area"], answer: 0, explain: "Internal state can be set and read directly." },
    { prompt: "Shifting a pattern into an N-flop chain takes about…", options: ["N cycles", "1 cycle", "log N cycles"], answer: 0, explain: "One bit enters per shift clock." },
  ],
  finfet: [
    { prompt: "FinFET width is quantised because…", options: ["Current scales with the number of fins", "Lithography limits", "Wells must be shared"], answer: 0, explain: "Effective width is set by fin height and count." },
    { prompt: "The main benefit over planar devices is…", options: ["Better gate control of the channel", "Cheaper wafers", "Higher VDD"], answer: 0, explain: "The gate wraps three sides, cutting short-channel leakage." },
    { prompt: "GAAFETs go further by…", options: ["Wrapping the gate on all four sides", "Removing the gate oxide", "Using two gates in series"], answer: 0, explain: "Nanosheets are surrounded by the gate." },
  ],
};

export const RELATED: Record<string, Array<{ label: string; to: string }>> = {
  "cmos-inverter": [{ label: "Logic Gates studio", to: "/studios/logic-gates" }],
  "cmos-nand": [{ label: "Logic Gates studio", to: "/studios/logic-gates" }, { label: "Boolean Algebra studio", to: "/studios/boolean-algebra" }],
  "cmos-nor": [{ label: "Logic Gates studio", to: "/studios/logic-gates" }],
  "complex-cmos": [{ label: "Boolean Algebra studio", to: "/studios/boolean-algebra" }, { label: "K-Map studio", to: "/studios/kmap" }],
  "transmission-gate": [{ label: "Routing (mux) studio", to: "/studios/routing" }],
  "tri-state": [{ label: "Bus studio", to: "/studios/bus" }],
  "sr-latch": [{ label: "Flip-Flops studio", to: "/studios/flip-flops" }],
  "d-latch": [{ label: "Flip-Flops studio", to: "/studios/flip-flops" }],
  "d-flip-flop": [{ label: "Flip-Flops studio", to: "/studios/flip-flops" }, { label: "Registers studio", to: "/studios/registers" }],
  "setup-hold": [{ label: "Timing studio", to: "/studios/timing" }],
  metastability: [{ label: "Timing studio", to: "/studios/timing" }],
  clocking: [{ label: "Timing studio", to: "/studios/timing" }, { label: "Counters studio", to: "/studios/counters" }],
  "static-timing": [{ label: "Pipeline studio", to: "/studios/pipeline" }],
  "timing-path": [{ label: "Pipeline studio", to: "/studios/pipeline" }],
  "boolean-optimization": [{ label: "Boolean Algebra studio", to: "/studios/boolean-algebra" }, { label: "K-Map studio", to: "/studios/kmap" }],
  "fsm-synthesis": [{ label: "FSM studio", to: "/studios/fsm" }],
  "rtl-visualization": [{ label: "RTL studio", to: "/studios/rtl" }],
  "sram-6t": [{ label: "Memory studio", to: "/studios/memory" }, { label: "Cache studio", to: "/studios/cache" }],
  "sram-array": [{ label: "Memory studio", to: "/studios/memory" }, { label: "Cache studio", to: "/studios/cache" }],
  "memory-decoder": [{ label: "Combinational studio", to: "/studios/combinational" }],
  "dram-1t1c": [{ label: "Memory Hierarchy studio", to: "/studios/hierarchy" }],
  noc: [{ label: "Multicore studio", to: "/studios/multicore" }],
  "soc-floorplan": [{ label: "SoC architecture studio", to: "/architecture/soc" }],
  chiplet: [{ label: "Heterogeneous studio", to: "/architecture/hetero" }],
  ppa: [{ label: "Advanced Computer Architecture", to: "/studios/advanced-computer-architecture" }],
};

export const MODEL_LIMITS = [
  "Square-law MOSFET currents; no velocity saturation, DIBL, or mobility degradation unless a lab says so.",
  "Lumped or first-order RC delays rather than full transient circuit simulation.",
  "Representative, rounded process numbers, not a foundry PDK.",
  "Layout, DRC, and flow steps use simplified educational rules.",
];
