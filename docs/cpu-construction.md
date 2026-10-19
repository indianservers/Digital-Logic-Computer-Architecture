# Building a CPU from scratch

Choose **New Scratch CPU**. It opens an empty project using **Circuit · every clock edge**. The older instruction CPU engine remains available for existing projects.

Open **Construction Tools** to create custom blocks, modules, microprograms, named nets, tests, and Verilog. The tools collapse so the canvas remains the main workspace. The built-in **wired CPU from scratch** example assembles LOADI/ADD/STORE/LOAD/BRZ/HALT into a user ISA and executes through connected storage, memory, and combinational control.

## Canvas controls

- Drag a component to move it. Connected wires follow; release creates one undo entry.
- Drag empty space to pan. Middle-button and Alt-drag also pan.
- Scroll over the canvas to zoom around the pointer without scrolling the page.
- Shift-click components or Shift-drag empty space to select a region. Drag a selected component to move the selection.
- Click an output, then an input, or drag between ports to connect them. Escape cancels.
- Select a wire to adjust its bend. Construction Tools → Nets & layout can reconnect its endpoints.
- Double-click a module to open its internals, or a block to edit its behavior and ports.

## The 25 enhancement areas

| # | Area | Implementation and scope |
|---|---|---|
| 1 | Circuit-driven execution | Circuit mode samples the connected graph and clocks enabled storage. Clock, Step and Run share this execution path; no predefined PC/register-file/ALU layout is required. |
| 2 | Executable micro-operations | Microinstructions drive named component input ports using expressions evaluated against one pre-edge snapshot. |
| 3 | Hardwired controllers | Gates, flip-flops, counters, custom decode expressions and registers execute as ordinary circuitry. The wired accumulator example demonstrates a complete CPU without the instruction executor. |
| 4 | Microprogrammed control | Editable control words, micro-PC, conditional successors, instruction boundaries and HALT; ROM and sequencer blocks can also be built directly in the circuit. |
| 5 | Custom block internals | Visual port/state/expression editor plus gate-level module canvas. |
| 6 | Hierarchical modules | Encapsulate selections, expose boundary ports, nest modules, publish reusable definitions, instantiate and deliberately update instances. Internal storage is independent per instance. |
| 7 | Custom ports/parameters | Ports support 1–32 bits, input/output direction and data/control/clock roles. Existing connections are checked before behavior edits are saved. |
| 8 | Construction palette | Logic gates, D flip-flops and counters are available alongside CPU blocks; modules expose their own interfaces. |
| 9 | Named buses | Named, typed single-driver nets fan out to multiple destinations and compile into real wires. Bit-slice blocks provide bus taps. |
| 10 | Wire editing | Existing bend editing plus endpoint reconnection with direction/width/occupied-input checks. |
| 11 | Placement | Region selection, group dragging, alignment, horizontal distribution, rotation, duplication and signal-flow arrangement. |
| 12 | Register architecture | Custom banks support up to 32 registers and editable read/write expressions; ISA register counts and native register-address ports can also be configured up to 32. |
| 13 | Instruction behavior | In circuit mode, instruction effects come from the user's decode circuitry or microprogram. This permits stack/call/return/flag logic without adding hardcoded instruction handlers. Assembly syntax still uses the studio's supported field/operand formats. |
| 14 | Custom ALUs | Editable operation expressions, operation-code mapping, output flags and clocked state when desired. |
| 15 | Shifts/slices | Shift/rotate and slice presets with editable expressions and port widths. |
| 16 | Memory timing | Timed RAM has an actual read countdown, captured address, held data and READY handshake. Native memory's existing region latency remains metadata; choose Timed RAM when the CPU needs wait cycles. |
| 17 | Peripherals | Editable switches, byte terminal and timer blocks have executable circuit interfaces. Build address decoding from the same blocks to map them into the CPU. |
| 18 | Interrupts | IRQ/enable/return controller block exposes vector selection, saved PC, entry and active-state signals. Wire these to the CPU's PC and enable circuitry. |
| 19 | Pipelines | Editable five-stage teaching CPU with concurrent stage state, RAW stalls, selectable result forwarding, branch flush and HALT drain. The included ISA is LOADI/ADD/BRZ/HALT, not a full commercial ISA. |
| 20 | Fault tracing | Strict active-input faults plus upstream driver tracing, including module internals. |
| 21 | Linked state/trace | Existing source/word history remains available. Custom registers and internal module state are included in before/after comparison and reverse-step snapshots. |
| 22 | Waveforms | Select any output and recorded cycle, inspect sampled bus values and four-state data, and retain existing VCD/JSON exports. |
| 23 | Circuit tests | Independent reset copies, initial inputs, per-cycle stimuli/assertions, final expectations and JSON results. Up to 100 tests and 10,000 cycles per test. |
| 24 | HDL | Expanded Verilog and a testbench from the first saved circuit test. Unsupported blocks emit diagnostics and block export. Board-specific synthesis, physical constraints and external HDL verification are separate steps. |
| 25 | Compact workspace | Compact header, collapsed preferences and construction tools, and pane-local zoom controls. |

## Custom block expressions

Use input port IDs and internal register names, integer literals, `+ - * %`, bitwise operators, comparisons, `&& ||`, and `condition ? yes : no`. `mem(address)` reads block-local memory. JavaScript and host APIs are not evaluated. Expressions are bounded to 2,000 characters and 64 nesting levels; their final result is an unsigned 32-bit integer, then output ports apply their declared width.

`registers` contains current internal state, `initial` contains reset state, and `next` maps register names to expressions. All next values are computed from the same pre-edge values, so two registers can exchange values correctly. Define a one-bit `clock` input. A block's `write` interface specifies memory write enable, address, and data expressions. Timed RAM writes are edge-triggered; its READY/countdown interface models read latency.

Microprogram expressions use `componentID.port` or `componentName.port`. Names containing whitespace should be referenced by ID. A microinstruction's `condition` selects `alternate` when true and `next` otherwise. `commit` marks a boundary for instruction stepping; it does not introduce an extra storage write. Each enabled storage element still captures on its actual rising clock edge.

The terminal is a simulator device and cannot be exported directly to Verilog. The fixed built-in decoder/control-unit and native ALU/register-file/flag blocks currently require replacement by custom expressions or gate-level modules for HDL export. Microcode simulator input overrides must similarly be lowered to a circuit ROM and sequencer before HDL export. Unsupported unsigned-shift expressions receive a diagnostic rather than an incomplete export.

## Verification

Automated tests exercise a full wired CPU, module state, simultaneous register updates, microcode, instruction-memory assembly, pipeline hazards/forwarding/flush, timed RAM, interrupts, named nets, test sequences and HDL generation. Generated HDL and its testbench still need an external HDL simulator and target synthesis tools; generation tests do not establish hardware equivalence or timing closure.
