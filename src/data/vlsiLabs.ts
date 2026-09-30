export type VlsiCategory =
  | "device"
  | "cmos"
  | "timing"
  | "layout"
  | "cells"
  | "physical"
  | "power"
  | "memory"
  | "advanced"
  | "fab"
  | "dft"
  | "soc"
  | "flow";

export interface VlsiLabMeta {
  number: number;
  id: string;
  slug: string;
  title: string;
  summary: string;
  category: VlsiCategory;
  implemented: boolean;
  difficulty: string;
  minutes: number;
  reuse?: string;
  mockup?: string;
}

export const VLSI_HOME = "/studios/vlsi";

export const VLSI_CATEGORIES: Array<{ id: VlsiCategory; title: string; blurb: string }> = [
  { id: "device", title: "Device Physics", blurb: "MOS structure, current, and the capacitor that forms every gate." },
  { id: "cmos", title: "CMOS Circuits", blurb: "Complementary networks, transfer curves, power, delay, and storage." },
  { id: "timing", title: "Timing & Signal Integrity", blurb: "Edges, paths, coupling, and when a capture is legal." },
  { id: "layout", title: "Layout & Verification", blurb: "Stick diagrams, rules, and schematic-versus-layout checks." },
  { id: "cells", title: "Standard Cells & Synthesis", blurb: "Library cells, mapping, and Boolean optimization." },
  { id: "physical", title: "Physical Design", blurb: "Floorplan, placement, routing, and the clock tree." },
  { id: "power", title: "Power & Reliability", blurb: "IR drop, variation, gating, and multi-voltage design." },
  { id: "memory", title: "Memory VLSI", blurb: "SRAM, DRAM, sensing, and nonvolatile cells." },
  { id: "advanced", title: "Advanced Devices", blurb: "FinFET, gate-all-around, and scaling." },
  { id: "fab", title: "Semiconductor Fabrication", blurb: "From wafer to metal, including yield." },
  { id: "dft", title: "DFT & Test", blurb: "Scan, faults, and built-in self test." },
  { id: "soc", title: "ASIC / SoC / Packaging", blurb: "Chip assembly, NoC, chiplets, and thermal maps." },
  { id: "flow", title: "Complete RTL-to-GDSII Flow", blurb: "One student-controlled path from code to layout." },
];

export const VLSI_LABS: VlsiLabMeta[] = [
  { number: 1, id: "mosfet-fundamentals", slug: "mosfet-fundamentals", title: "MOSFET Fundamentals", summary: "Form the channel, name the region, and watch carriers move.", category: "device", implemented: true, difficulty: "Foundational", minutes: 18, mockup: "01_MOSFET_Fundamentals_and_Operation.png" },
  { number: 2, id: "mosfet-iv", slug: "mosfet-iv", title: "MOSFET I–V Characteristics", summary: "Sweep VGS and VDS and read the square-law curves.", category: "device", implemented: true, difficulty: "Foundational", minutes: 16, mockup: "02_MOSFET_IV_Characteristics.png" },
  { number: 3, id: "mos-capacitor", slug: "mos-capacitor", title: "MOS Capacitor", summary: "Move the gate voltage through accumulation, depletion, and inversion.", category: "device", implemented: true, difficulty: "Foundational", minutes: 16 },
  { number: 4, id: "cmos-inverter", slug: "cmos-inverter", title: "CMOS Inverter", summary: "See which transistor pulls the output, and the current while it switches.", category: "cmos", implemented: true, difficulty: "Foundational", minutes: 16, reuse: "Logic NOT via evalGate", mockup: "03_CMOS_Inverter.png" },
  { number: 5, id: "cmos-vtc", slug: "cmos-vtc", title: "CMOS Voltage Transfer Characteristic", summary: "Trace Vout against Vin and move the switching threshold with sizing.", category: "cmos", implemented: true, difficulty: "Intermediate", minutes: 18, mockup: "04_CMOS_Voltage_Transfer_Characteristic.png" },
  { number: 6, id: "cmos-power", slug: "cmos-power", title: "CMOS Power Consumption", summary: "Separate dynamic, short-circuit, and leakage power.", category: "cmos", implemented: true, difficulty: "Intermediate", minutes: 14, mockup: "07_CMOS_Power_Consumption.png" },
  { number: 7, id: "propagation-delay", slug: "propagation-delay", title: "Propagation Delay", summary: "Measure tpHL, tpLH, rise, and fall as load and size change.", category: "cmos", implemented: true, difficulty: "Intermediate", minutes: 16, reuse: "0.69·Req·CL with Id,sat from the MOS model", mockup: "06_CMOS_Delay_Rise_Fall_Time_and_Loading.png" },
  { number: 8, id: "cmos-nand", slug: "cmos-nand", title: "CMOS NAND Gate", summary: "Parallel PMOS, series NMOS, and a truth table that follows the inputs.", category: "cmos", implemented: true, difficulty: "Foundational", minutes: 14, reuse: "evalGate NAND", mockup: "05_CMOS_NAND_and_NOR_Design.png" },
  { number: 9, id: "cmos-nor", slug: "cmos-nor", title: "CMOS NOR Gate", summary: "Series PMOS, parallel NMOS, same experiment as NAND.", category: "cmos", implemented: true, difficulty: "Foundational", minutes: 12, reuse: "evalGate NOR and the NAND network view", mockup: "05_CMOS_NAND_and_NOR_Design.png" },
  { number: 10, id: "complex-cmos", slug: "complex-cmos", title: "Complex CMOS Gates", summary: "AOI and OAI: the pull-down implements the condition, the pull-up is its dual.", category: "cmos", implemented: true, difficulty: "Intermediate", minutes: 18, mockup: "05_CMOS_NAND_and_NOR_Design.png" },
  { number: 11, id: "transmission-gate", slug: "transmission-gate", title: "Transmission Gates", summary: "Pass a full-swing signal in either direction, or float the output.", category: "cmos", implemented: true, difficulty: "Foundational", minutes: 12, mockup: "VLSI_Labs_11-20_2x5_Grid.png" },
  { number: 12, id: "pass-transistor", slug: "pass-transistor", title: "Pass Transistor Logic", summary: "Watch a single device drop a threshold, and the transmission gate restore it.", category: "cmos", implemented: true, difficulty: "Foundational", minutes: 14, mockup: "VLSI_Labs_11-20_2x5_Grid.png" },
  { number: 13, id: "tri-state", slug: "tri-state", title: "Tri-State Logic", summary: "Drive, float, or contend a shared wire.", category: "cmos", implemented: true, difficulty: "Foundational", minutes: 12, reuse: "evalGate TRI and resolveDrivers", mockup: "VLSI_Labs_11-20_2x5_Grid.png" },
  { number: 14, id: "sr-latch", slug: "sr-latch", title: "SR Latch", summary: "Cross-coupled NOR storage, including the illegal input.", category: "cmos", implemented: true, difficulty: "Foundational", minutes: 10, reuse: "srNor", mockup: "VLSI_Labs_11-20_2x5_Grid.png" },
  { number: 15, id: "d-latch", slug: "d-latch", title: "D Latch", summary: "Transparent while enable is high, opaque when it falls.", category: "cmos", implemented: true, difficulty: "Foundational", minutes: 10, reuse: "dLatch", mockup: "VLSI_Labs_11-20_2x5_Grid.png" },
  { number: 16, id: "d-flip-flop", slug: "d-flip-flop", title: "D Flip-Flop", summary: "Edge capture, and a master/slave pair built from the D latch.", category: "cmos", implemented: true, difficulty: "Intermediate", minutes: 16, reuse: "dFlipFlop and dLatch", mockup: "VLSI_Labs_11-20_2x5_Grid.png" },
  { number: 17, id: "setup-hold", slug: "setup-hold", title: "Setup & Hold Time", summary: "Move D around the capturing edge and read setup and hold slack.", category: "timing", implemented: true, difficulty: "Foundational", minutes: 12, reuse: "setupViolated, holdViolated, and capture", mockup: "VLSI_Labs_11-20_2x5_Grid.png" },
  { number: 18, id: "metastability", slug: "metastability", title: "Metastability", summary: "An unsafe sample sits between rails, then regenerates.", category: "timing", implemented: true, difficulty: "Intermediate", minutes: 14, reuse: "The same setup and hold window, plus a resolution waveform", mockup: "VLSI_Labs_11-20_2x5_Grid.png" },
  { number: 19, id: "clocking", slug: "clocking", title: "Clocking Fundamentals", summary: "Period, duty, edges, skew, and jitter on several sinks.", category: "timing", implemented: true, difficulty: "Foundational", minutes: 14, reuse: "periodNs and frequencyMHz", mockup: "VLSI_Labs_11-20_2x5_Grid.png" },
  { number: 20, id: "clock-distribution", slug: "clock-distribution", title: "Clock Distribution", summary: "A clock tree, sink arrivals, and skew against a target.", category: "timing", implemented: true, difficulty: "Intermediate", minutes: 16, mockup: "VLSI_Labs_11-20_2x5_Grid.png" },
  { number: 21, id: "combinational-timing", slug: "combinational-timing", title: "Combinational Timing", summary: "Several paths, and the one with the largest delay.", category: "timing", implemented: true, difficulty: "Intermediate", minutes: 14, reuse: "Additive delay, same idea as delayedTransition", mockup: "VLSI_Labs_11-20_2x5_Grid.png" },
  { number: 22, id: "static-timing", slug: "static-timing", title: "Static Timing Analysis", summary: "Arrival, required time, and slack on a launch-to-capture path.", category: "timing", implemented: true, difficulty: "Advanced", minutes: 18, mockup: "10_Static_Timing_Analysis.png" },
  { number: 23, id: "timing-path", slug: "timing-path", title: "Timing Path Explorer", summary: "Click a hop on the same timing path and read its slack.", category: "timing", implemented: true, difficulty: "Intermediate", minutes: 14, reuse: "The static timing path model", mockup: "VLSI_Labs_11-20_2x5_Grid.png" },
  { number: 24, id: "logical-effort", slug: "logical-effort", title: "Logical Effort", summary: "g, h, b, path effort, and delay versus stage count.", category: "timing", implemented: true, difficulty: "Intermediate", minutes: 16, mockup: "VLSI_Labs_11-20_2x5_Grid.png" },
  { number: 25, id: "fanout-loading", slug: "fanout-loading", title: "Fan-Out & Loading", summary: "More load capacitance stretches the CMOS delay.", category: "timing", implemented: true, difficulty: "Foundational", minutes: 12, reuse: "cmosDelay", mockup: "06_CMOS_Delay_Rise_Fall_Time_and_Loading.png" },
  { number: 26, id: "interconnect-rc", slug: "interconnect-rc", title: "Interconnect RC Delay", summary: "Lumped 0.69RC and a segmented Elmore delay.", category: "timing", implemented: true, difficulty: "Intermediate", minutes: 14, mockup: "VLSI_Labs_21-30_2x5_Grid.png" },
  { number: 27, id: "crosstalk", slug: "crosstalk", title: "Crosstalk", summary: "Coupling from an aggressor into a victim, and mitigations that change it.", category: "timing", implemented: true, difficulty: "Intermediate", minutes: 14, mockup: "VLSI_Labs_21-30_2x5_Grid.png" },
  { number: 28, id: "layout-basics", slug: "layout-basics", title: "CMOS Layout Basics", summary: "Wells, diffusion, poly, contacts, and metal on one inverter.", category: "layout", implemented: true, difficulty: "Foundational", minutes: 12, mockup: "08_CMOS_Layout_and_Stick_Diagrams.png" },
  { number: 29, id: "stick-diagram", slug: "stick-diagram", title: "Stick Diagram Explorer", summary: "One selection across schematic, stick, and layout.", category: "layout", implemented: true, difficulty: "Foundational", minutes: 12, mockup: "08_CMOS_Layout_and_Stick_Diagrams.png" },
  { number: 30, id: "inverter-layout", slug: "inverter-layout", title: "CMOS Inverter Layout", summary: "Place the inverter layers and check that poly crosses diffusion.", category: "layout", implemented: true, difficulty: "Intermediate", minutes: 16, mockup: "08_CMOS_Layout_and_Stick_Diagrams.png" },
  { number: 31, id: "nand-nor-layout", slug: "nand-nor-layout", title: "NAND/NOR Layout", summary: "Series and parallel devices, with and without shared diffusion.", category: "layout", implemented: true, difficulty: "Intermediate", minutes: 16, reuse: "The shared layout geometry", mockup: "VLSI_Labs_21-30_2x5_Grid.png" },
  { number: 32, id: "drc", slug: "drc", title: "Design Rule Checker", summary: "Educational width, spacing, and enclosure checks.", category: "layout", implemented: true, difficulty: "Intermediate", minutes: 14, reuse: "The same rectangles as the layout labs", mockup: "09_DRC_and_LVS.png" },
  { number: 33, id: "lvs", slug: "lvs", title: "Layout vs Schematic", summary: "Compare schematic terminals with the netlist extracted from layout.", category: "layout", implemented: true, difficulty: "Intermediate", minutes: 16, reuse: "Phase 2 layout rectangles and device recognition", mockup: "09_DRC_and_LVS.png" },
  { number: 34, id: "parasitic-extraction", slug: "parasitic-extraction", title: "Parasitic Extraction", summary: "Resistance and capacitance from the same metal geometry.", category: "layout", implemented: true, difficulty: "Intermediate", minutes: 14, reuse: "Inverter layout rectangles", mockup: "VLSI_Labs_21-30_2x5_Grid.png" },
  { number: 35, id: "standard-cell", slug: "standard-cell", title: "Standard Cell Explorer", summary: "Drive strength, area, delay, and power for one educational cell.", category: "cells", implemented: true, difficulty: "Foundational", minutes: 14, mockup: "VLSI_Labs_21-30_2x5_Grid.png" },
  { number: 36, id: "cell-library", slug: "cell-library", title: "Standard Cell Library", summary: "Compare cells on area, delay, and leakage.", category: "cells", implemented: true, difficulty: "Intermediate", minutes: 14, reuse: "The shared educational cell library", mockup: "VLSI_Labs_21-30_2x5_Grid.png" },
  { number: 37, id: "schematic-to-layout", slug: "schematic-to-layout", title: "Schematic-to-Layout Flow", summary: "One design from RTL through mapped cells, placement, and routing.", category: "cells", implemented: true, difficulty: "Intermediate", minutes: 16, reuse: "Synthesis, mapping, and physical metrics", mockup: "VLSI_Labs_31-40_2x5_Grid.png" },
  { number: 38, id: "rtl-visualization", slug: "rtl-visualization", title: "RTL Visualization", summary: "A small Verilog subset beside the hardware it names.", category: "cells", implemented: true, difficulty: "Foundational", minutes: 12, mockup: "VLSI_Labs_31-40_2x5_Grid.png" },
  { number: 39, id: "logic-synthesis", slug: "logic-synthesis", title: "Logic Synthesis", summary: "Constant fold, involution, shared logic, and dead-gate removal.", category: "cells", implemented: true, difficulty: "Intermediate", minutes: 16, reuse: "Educational gate network, not a commercial synthesizer", mockup: "VLSI_Labs_31-40_2x5_Grid.png" },
  { number: 40, id: "technology-mapping", slug: "technology-mapping", title: "Technology Mapping", summary: "Generic gates replaced by library cells.", category: "cells", implemented: true, difficulty: "Intermediate", minutes: 14, reuse: "Educational standard-cell library", mockup: "VLSI_Labs_31-40_2x5_Grid.png" },
  { number: 41, id: "boolean-optimization", slug: "boolean-optimization", title: "Boolean Optimization", summary: "The existing simplifier, with area and delay estimates beside it.", category: "cells", implemented: true, difficulty: "Intermediate", minutes: 12, reuse: "parseBoolean and algebraicSimplify", mockup: "VLSI_Labs_31-40_2x5_Grid.png" },
  { number: 42, id: "fsm-synthesis", slug: "fsm-synthesis", title: "FSM Synthesis", summary: "Binary, one-hot, and Gray encoding into registers and next-state logic.", category: "cells", implemented: true, difficulty: "Intermediate", minutes: 14, reuse: "encodeStates and binaryWidth", mockup: "VLSI_Labs_31-40_2x5_Grid.png" },
  { number: 43, id: "floorplanning", slug: "floorplanning", title: "Floorplanning", summary: "Move MiniSoC macros and read area, overlap, and wire length.", category: "physical", implemented: true, difficulty: "Intermediate", minutes: 16, mockup: "VLSI_Labs_31-40_2x5_Grid.png" },
  { number: 44, id: "power-planning", slug: "power-planning", title: "Power Planning", summary: "Rings, straps, and rails with a simple drop indicator.", category: "physical", implemented: true, difficulty: "Intermediate", minutes: 14, reuse: "Floorplan core box", mockup: "VLSI_Labs_31-40_2x5_Grid.png" },
  { number: 45, id: "placement", slug: "placement", title: "Placement", summary: "Pack standard cells into rows around locked macros.", category: "physical", implemented: true, difficulty: "Intermediate", minutes: 14, mockup: "VLSI_Labs_31-40_2x5_Grid.png" },
  { number: 46, id: "placement-optimization", slug: "placement-optimization", title: "Placement Optimization", summary: "Step a wirelength, timing, or congestion improvement.", category: "physical", implemented: true, difficulty: "Advanced", minutes: 16, reuse: "The placement metric model", mockup: "VLSI_Labs_31-40_2x5_Grid.png" },
  { number: 47, id: "routing", slug: "routing", title: "Routing", summary: "Global or detailed routes that detour around a blockage.", category: "physical", implemented: true, difficulty: "Intermediate", minutes: 14, mockup: "VLSI_Labs_31-40_2x5_Grid.png" },
  { number: 48, id: "routing-congestion", slug: "routing-congestion", title: "Routing Congestion", summary: "Demand, capacity, and overflow on a routing grid.", category: "physical", implemented: true, difficulty: "Intermediate", minutes: 12, reuse: "The same demand and capacity model as routing", mockup: "VLSI_Labs_31-40_2x5_Grid.png" },
  { number: 49, id: "clock-tree", slug: "clock-tree", title: "Clock Tree Synthesis", summary: "Insert buffers so sink arrivals cluster, and read the skew.", category: "physical", implemented: true, difficulty: "Advanced", minutes: 16, reuse: "Skew is max arrival minus min arrival, as in the clock labs", mockup: "VLSI_Labs_31-40_2x5_Grid.png" },
  { number: 50, id: "ir-drop", slug: "ir-drop", title: "IR Drop", summary: "Voltage lost across an educational power grid.", category: "power", implemented: true, difficulty: "Intermediate", minutes: 14, reuse: "Same strap resistance idea as power planning", mockup: "VLSI_Labs_31-40_2x5_Grid.png" },
  { number: 51, id: "electromigration", slug: "electromigration", title: "Electromigration", summary: "Current density and a simplified lifetime trend.", category: "power", implemented: true, difficulty: "Intermediate", minutes: 12, mockup: "VLSI_Labs_31-40_2x5_Grid.png" },
  { number: 52, id: "signal-integrity", slug: "signal-integrity", title: "Signal Integrity", summary: "Overshoot, ringing, and a coupled victim.", category: "power", implemented: true, difficulty: "Intermediate", minutes: 14, reuse: "Crosstalk capacitance from the timing model", mockup: "VLSI_Labs_31-40_2x5_Grid.png" },
  { number: 53, id: "pvt-corners", slug: "pvt-corners", title: "Process–Voltage–Temperature Corners", summary: "SS, TT, and FF on one inverter.", category: "power", implemented: true, difficulty: "Intermediate", minutes: 14, reuse: "cmosDelay and cmosPower", mockup: "VLSI_Labs_31-40_2x5_Grid.png" },
  { number: 54, id: "process-variation", slug: "process-variation", title: "Process Variation", summary: "A seeded spread of delay around one cell.", category: "power", implemented: true, difficulty: "Intermediate", minutes: 12, mockup: "VLSI_Labs_31-40_2x5_Grid.png" },
  { number: 55, id: "power-gating", slug: "power-gating", title: "Power Gating", summary: "A sleep transistor collapses the virtual rail.", category: "power", implemented: true, difficulty: "Intermediate", minutes: 14, reuse: "cmosPower leakage", mockup: "VLSI_Labs_31-40_2x5_Grid.png" },
  { number: 56, id: "clock-gating", slug: "clock-gating", title: "Clock Gating", summary: "Integrated gating versus a naïve AND.", category: "power", implemented: true, difficulty: "Intermediate", minutes: 14, reuse: "Dynamic power αCV²f", mockup: "VLSI_Labs_31-40_2x5_Grid.png" },
  { number: 57, id: "multi-vt", slug: "multi-vt", title: "Multi-Vt Design", summary: "LVT, SVT, and HVT on one timing path.", category: "power", implemented: true, difficulty: "Intermediate", minutes: 14, mockup: "VLSI_Labs_31-40_2x5_Grid.png" },
  { number: 58, id: "multi-vdd", slug: "multi-vdd", title: "Multi-VDD Design", summary: "Voltage islands, a level shifter, and isolation.", category: "power", implemented: true, difficulty: "Intermediate", minutes: 12, mockup: "VLSI_Labs_31-40_2x5_Grid.png" },
  { number: 59, id: "sram-6t", slug: "sram-6t", title: "SRAM Cell — 6T", summary: "Hold, read, and write across six transistors.", category: "memory", implemented: true, difficulty: "Intermediate", minutes: 14, reuse: "applySram", mockup: "VLSI_Labs_31-40_2x5_Grid.png" },
  { number: 60, id: "sram-array", slug: "sram-array", title: "SRAM Array", summary: "One wordline and one column in an 8×8 array.", category: "memory", implemented: true, difficulty: "Intermediate", minutes: 12, reuse: "decodeAddress", mockup: "VLSI_Labs_31-40_2x5_Grid.png" },
  { number: 61, id: "sram-read", slug: "sram-read", title: "SRAM Read Operation", summary: "Precharge, wordline, differential, then sense.", category: "memory", implemented: true, difficulty: "Intermediate", minutes: 14, reuse: "applySram read", mockup: "VLSI_Labs_31-40_2x5_Grid.png" },
  { number: 62, id: "sram-write", slug: "sram-write", title: "SRAM Write Operation", summary: "A strong driver flips the cell. A weak one does not.", category: "memory", implemented: true, difficulty: "Intermediate", minutes: 14, reuse: "applySram write", mockup: "VLSI_Labs_31-40_2x5_Grid.png" },
  { number: 63, id: "sense-amplifier", slug: "sense-amplifier", title: "Sense Amplifier", summary: "A small BL−BLB difference becomes a full level.", category: "memory", implemented: true, difficulty: "Intermediate", minutes: 12, mockup: "VLSI_Labs_31-40_2x5_Grid.png" },
  { number: 64, id: "dram-1t1c", slug: "dram-1t1c", title: "DRAM 1T1C Cell", summary: "Charge, decay, destructive read, and refresh.", category: "memory", implemented: true, difficulty: "Intermediate", minutes: 14, reuse: "decayCharge, senseDram, and restoreCharge", mockup: "VLSI_Labs_31-40_2x5_Grid.png" },
  { number: 65, id: "memory-decoder", slug: "memory-decoder", title: "Memory Decoder", summary: "Address bits split into one row and one column.", category: "memory", implemented: true, difficulty: "Foundational", minutes: 12, reuse: "decodeAddress", mockup: "VLSI_Labs_31-40_2x5_Grid.png" },
  { number: 66, id: "nonvolatile-cells", slug: "nonvolatile-cells", title: "ROM / EEPROM / Flash Cells", summary: "Program, erase, and read for four nonvolatile cells.", category: "memory", implemented: true, difficulty: "Intermediate", minutes: 14, reuse: "ROM, EEPROM, and Flash program rules", mockup: "VLSI_Labs_31-40_2x5_Grid.png" },
  { number: 67, id: "finfet", slug: "finfet", title: "FinFET Fundamentals", summary: "A gate that wraps a fin, beside a planar MOSFET.", category: "advanced", implemented: true, difficulty: "Intermediate", minutes: 14, mockup: "VLSI_Labs_31-40_2x5_Grid.png" },
  { number: 68, id: "gaafet", slug: "gaafet", title: "GAAFET / Nanosheet", summary: "Stacked sheets with the gate all around.", category: "advanced", implemented: true, difficulty: "Intermediate", minutes: 14, mockup: "VLSI_Labs_31-40_2x5_Grid.png" },
  { number: 69, id: "technology-scaling", slug: "technology-scaling", title: "Technology Scaling", summary: "From 180 nm planar to a conceptual nanosheet node.", category: "advanced", implemented: true, difficulty: "Intermediate", minutes: 12, mockup: "VLSI_Labs_31-40_2x5_Grid.png" },
  { number: 70, id: "cmos-fabrication", slug: "cmos-fabrication", title: "CMOS Fabrication", summary: "A wafer becomes a transistor, then metal.", category: "fab", implemented: true, difficulty: "Intermediate", minutes: 16, mockup: "VLSI_Labs_31-40_2x5_Grid.png" },
  { number: 71, id: "photolithography", slug: "photolithography", title: "Photolithography", summary: "Mask, dose, alignment, and resist tone.", category: "fab", implemented: true, difficulty: "Intermediate", minutes: 14, mockup: "VLSI_Labs_31-40_2x5_Grid.png" },
  { number: 72, id: "doping", slug: "doping", title: "Doping & Ion Implantation", summary: "A Gaussian implant profile versus depth.", category: "fab", implemented: true, difficulty: "Intermediate", minutes: 12, mockup: "VLSI_Labs_31-40_2x5_Grid.png" },
  { number: 73, id: "wells", slug: "wells", title: "Well Formation", summary: "N-well, P-well, and where each device may sit.", category: "fab", implemented: true, difficulty: "Intermediate", minutes: 12, mockup: "VLSI_Labs_31-40_2x5_Grid.png" },
  { number: 74, id: "oxidation", slug: "oxidation", title: "Oxidation & Deposition", summary: "Oxide consumes silicon. Deposited films sit on top.", category: "fab", implemented: true, difficulty: "Intermediate", minutes: 12, mockup: "VLSI_Labs_31-40_2x5_Grid.png" },
  { number: 75, id: "etching", slug: "etching", title: "Etching", summary: "Isotropic undercut versus a vertical etch.", category: "fab", implemented: true, difficulty: "Intermediate", minutes: 12, mockup: "VLSI_Labs_31-40_2x5_Grid.png" },
  { number: 76, id: "cmp", slug: "cmp", title: "Chemical Mechanical Planarization", summary: "Peaks come down, then extra polish dishes.", category: "fab", implemented: true, difficulty: "Intermediate", minutes: 12, mockup: "VLSI_Labs_31-40_2x5_Grid.png" },
  { number: 77, id: "metallization", slug: "metallization", title: "Metallization", summary: "Contacts, vias, and a metal stack.", category: "fab", implemented: true, difficulty: "Intermediate", minutes: 14, reuse: "Same local-versus-global idea as routing", mockup: "VLSI_Labs_31-40_2x5_Grid.png" },
  { number: 78, id: "cross-section", slug: "cross-section", title: "Chip Cross-Section Explorer", summary: "FEOL, MOL, and BEOL in one stack.", category: "fab", implemented: true, difficulty: "Intermediate", minutes: 12, reuse: "Shared material colors", mockup: "VLSI_Labs_31-40_2x5_Grid.png" },
  { number: 79, id: "wafer-die", slug: "wafer-die", title: "Wafer & Die Explorer", summary: "A seeded wafer map of good, failed, and edge dies.", category: "fab", implemented: true, difficulty: "Intermediate", minutes: 14, mockup: "VLSI_Labs_31-40_2x5_Grid.png" },
  { number: 80, id: "yield", slug: "yield", title: "Yield Analysis", summary: "Poisson and Murphy yield beside the wafer map.", category: "fab", implemented: true, difficulty: "Intermediate", minutes: 14, reuse: "The wafer map", mockup: "VLSI_Labs_31-40_2x5_Grid.png" },
  { number: 81, id: "scan-chain", slug: "scan-chain", title: "DFT / Scan Chain", summary: "A serial path beside the functional flip-flops.", category: "dft", implemented: true, difficulty: "Intermediate", minutes: 14, mockup: "VLSI_Labs_31-40_2x5_Grid.png" },
  { number: 82, id: "scan-test", slug: "scan-test", title: "Scan Testing", summary: "Shift in, capture, shift out, compare.", category: "dft", implemented: true, difficulty: "Intermediate", minutes: 12, reuse: "The scan chain", mockup: "VLSI_Labs_31-40_2x5_Grid.png" },
  { number: 83, id: "atpg", slug: "atpg", title: "Automatic Test Pattern Generation", summary: "Search for a vector that observes one stuck-at fault.", category: "dft", implemented: true, difficulty: "Advanced", minutes: 14, reuse: "The stuck-at simulator", mockup: "VLSI_Labs_31-40_2x5_Grid.png" },
  { number: 84, id: "stuck-at", slug: "stuck-at", title: "Stuck-at Faults", summary: "Force a net to 0 or 1 and see if the output notices.", category: "dft", implemented: true, difficulty: "Intermediate", minutes: 12, mockup: "VLSI_Labs_31-40_2x5_Grid.png" },
  { number: 85, id: "jtag", slug: "jtag", title: "Boundary Scan / JTAG", summary: "One TAP edge at a time, plus BYPASS, SAMPLE, and EXTEST.", category: "dft", implemented: true, difficulty: "Advanced", minutes: 16, mockup: "VLSI_Labs_31-40_2x5_Grid.png" },
  { number: 86, id: "bist", slug: "bist", title: "Built-In Self Test", summary: "An LFSR, a circuit, and a signature.", category: "dft", implemented: true, difficulty: "Intermediate", minutes: 12, mockup: "VLSI_Labs_31-40_2x5_Grid.png" },
  { number: 87, id: "asic-flow", slug: "asic-flow", title: "ASIC Design Flow", summary: "The same RTL-to-GDSII engine, one stage at a time.", category: "soc", implemented: true, difficulty: "Intermediate", minutes: 14, reuse: "The GDS flow state", mockup: "VLSI_Labs_31-40_2x5_Grid.png" },
  { number: 88, id: "fpga-asic", slug: "fpga-asic", title: "FPGA vs ASIC", summary: "One function on LUTs and on standard cells.", category: "soc", implemented: true, difficulty: "Intermediate", minutes: 12, reuse: "Mapping and the cell library", mockup: "VLSI_Labs_31-40_2x5_Grid.png" },
  { number: 89, id: "soc-floorplan", slug: "soc-floorplan", title: "SoC Floorplan Explorer", summary: "Move CPU, GPU, NPU, and the NoC.", category: "soc", implemented: true, difficulty: "Intermediate", minutes: 14, reuse: "SoC block list", mockup: "VLSI_Labs_31-40_2x5_Grid.png" },
  { number: 90, id: "noc", slug: "noc", title: "NoC Visualization", summary: "XY and adaptive routes on a 3×3 mesh.", category: "soc", implemented: true, difficulty: "Intermediate", minutes: 14, reuse: "Existing mesh shortest path", mockup: "VLSI_Labs_31-40_2x5_Grid.png" },
  { number: 91, id: "chiplet", slug: "chiplet", title: "Chiplet Architecture", summary: "Die-to-die bandwidth beside a monolithic yield.", category: "soc", implemented: true, difficulty: "Intermediate", minutes: 12, reuse: "Poisson yield", mockup: "VLSI_Labs_31-40_2x5_Grid.png" },
  { number: 92, id: "packaging-3d", slug: "packaging-3d", title: "2.5D / 3D IC Packaging", summary: "An interposer or a TSV stack.", category: "soc", implemented: true, difficulty: "Intermediate", minutes: 12, mockup: "VLSI_Labs_31-40_2x5_Grid.png" },
  { number: 93, id: "thermal", slug: "thermal", title: "Thermal Analysis", summary: "Block power, coupling, and cooling.", category: "soc", implemented: true, difficulty: "Intermediate", minutes: 12, mockup: "VLSI_Labs_31-40_2x5_Grid.png" },
  { number: 94, id: "ppa", slug: "ppa", title: "Power–Performance–Area Explorer", summary: "Presets that recalculate delay and power.", category: "soc", implemented: true, difficulty: "Advanced", minutes: 14, reuse: "CMOS delay and CMOS power", mockup: "VLSI_Labs_31-40_2x5_Grid.png" },
  { number: 95, id: "rtl-gdsii", slug: "rtl-gdsii", title: "RTL-to-GDSII Simulator", summary: "One design state from RTL through a GDS-style view.", category: "flow", implemented: true, difficulty: "Advanced", minutes: 18, reuse: "Synthesis, mapping, placement, CTS, and power", mockup: "VLSI_Labs_31-40_2x5_Grid.png" },
];

export function vlsiRoute(slug: string): string {
  return `${VLSI_HOME}/${slug}`;
}

export function vlsiLabBySlug(slug: string | undefined): VlsiLabMeta | undefined {
  if (!slug) return undefined;
  return VLSI_LABS.find((lab) => lab.slug === slug);
}

export function implementedVlsiLabs(): VlsiLabMeta[] {
  return VLSI_LABS.filter((lab) => lab.implemented);
}

export function vlsiNeighbors(slug: string): { previous?: VlsiLabMeta; next?: VlsiLabMeta; index: number } {
  const labs = implementedVlsiLabs();
  const index = labs.findIndex((lab) => lab.slug === slug);
  return {
    index,
    previous: index > 0 ? labs[index - 1] : undefined,
    next: index >= 0 && index < labs.length - 1 ? labs[index + 1] : undefined,
  };
}
