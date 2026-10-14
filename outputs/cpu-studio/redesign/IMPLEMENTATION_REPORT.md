# Build Your Own CPU Studio — implementation and verification report

This delivery rebuilds the twelve specialized lab workspaces around the supplied mockups, retains CPU Builder and Blocks, and introduces a shared, persistent project and a bounded logic-level execution model. It is not a claim that every advanced item in the master prompt, or exact pixel equivalence, has been completed.

## Routes and implemented workspaces

All routes use one project through `projectStore.ts`. Navigation does not create separate demonstration datasets.

| Route under `/architecture/builder` | Implemented workspace |
| --- | --- |
| `/` | Studio overview with links to the complete workflow |
| `/builder` | Existing CPU assembly canvas, component palette, properties, wiring, clock/instruction controls, undo/redo, file operations and Blocks |
| `/library` | Category/search/sort controls, favorites, configurable component preview, typed pin diagrams, engineering references, saved configurations and reusable subcircuits |
| `/datapath` | Editable graph, actual signal values, path inspection, grouping, position locking, duplication, auto-arrangement, pan/zoom, overview and schematic export |
| `/wires` | Wiring tools, orthogonal routing, bus split/join, probes, four-state net values, connection selection, width/direction diagnostics and fullscreen canvas |
| `/isa` | Instruction list, opcode/mnemonic/operand/format editor, constrained semantics, control mappings and live encoding preview |
| `/format` | R/I/B/J layouts, field dragging/resizing, bit positions, widths, signed fields, split-immediate reconstruction offsets and live decoding |
| `/control` | FSM diagram, state creation/deletion, start/next states, conditional guards, declarative signal overrides, micro-operation views and truth tables |
| `/memory` | Real instruction/data contents, global word-address map, console reads/writes, permissions, capacity, byte-order exports and local console access history |
| `/editor` | Source files, line numbers, syntax highlighting, dynamic instruction snippets/completion, source import/export and line diagnostics |
| `/assembler` | Machine words alongside source, labels/symbols, directives, hex/binary/disassembly, encoder/decoder verification and exports |
| `/debug` | Real execution listing, instruction/cycle stepping, run/pause/reset, registers, memory, ALU/condition flags, breakpoints, persistent watch expressions, bounded history and trace export |
| `/validate` | Current-project findings, severity/category/search filters, rule IDs, affected definitions, suggested fixes, navigation and report export |
| `/templates` | Editable 8-bit accumulator, 16-bit, single-cycle 32-bit datapath, multi-cycle 32-bit datapath, custom ISA playground and explicitly limited five-stage teaching template |

## Phase 1 — visual foundation and shared project

Implemented a dedicated snow-white/blue/lavender studio shell, SVG electronics icons and page-specific hero illustrations, sidebar navigation, contextual guides, individual workspaces and responsive layouts. The supplied PNGs are reference material; none is used as an application background.

The version-2 project stores engineering configuration alongside the existing components, wires, ISA, source, memory contents, register values, breakpoints and probes. Engineering configuration includes FSM states, simulator mode, unknown-signal policy, address regions, source files, presets, favorites, reusable subcircuits and watch expressions. Version-1 files are accepted and migrated without silently repairing their hardware semantics. Serialization is deterministic; import checks schema, graph identifiers, widths, instruction definitions, control signals and source shape.

IndexedDB autosave, named project saves, Save As, local project selection and complete project import/export are implemented. The existing application's IndexedDB database remains at version 2; the CPU document envelope is independently versioned at 2.

Validation: initial audit recorded 9 passing existing CPU/Blocks tests and an unrelated failing curriculum-route audit. New serialization, migration, malformed-import and reusable-subcircuit tests pass.

## Phase 2 — component and datapath engineering

Retained typed-port mutation APIs and strengthened standard template wiring. Register read addresses, write addresses, immediate selection, operand-A selection, ALU operation, writeback MUX, memory control and PC updates have explicit connections. Added N/C/V outputs alongside Z and an architectural condition-flag bank.

Added a deterministic four-state event-scheduled graph view with `0`, `1`, `X`, and `Z`, including disabled tri-state drivers and unknown propagation. Strict execution stops on unknown/high-impedance primary ALU inputs; numeric fallback is an explicit simulator option.

Additional connected, enabled storage elements capture the pre-commit graph snapshot. This is tested by adding an output register that captures the result of a student's constructed ALU path.

Validation: arithmetic/overflow, 32-bit unsigned results, rising-edge capture, split/join, sign extension, X/Z handling, rewiring and extra-register capture tests pass.

## Phase 3 — ISA and execution

The assembler/decoder derives encoding from the editable layouts, including split immediate segments. Implemented `.org`, `.word`, `.equ`, local labels, duplicate-label rejection, operand/register checks, immediate bounds, absolute jump labels and relative branch offsets.

Instruction execution consumes wired ALU inputs, operation control, writeback data, destination address, memory access controls and PC enable/update signals. Missing paths and out-of-bounds/read-only accesses fault visibly. A custom ADD-like mnemonic is executable without user JavaScript.

Multi-cycle execution follows the editable FSM, with conditional transitions based on memory-operation class, opcode equality or ALU zero. Signal overrides are composed from visited states. Architectural register/memory writes commit atomically at writeback; this supported sequencing model is documented in the UI.

Validation: encoding/decoding round trips, labels/directives, branch taken/not taken, loads/stores, custom instructions, field edits, PC enable behavior, clock-vs-instruction steps, guarded transitions and write-enable overrides pass.

## Phase 4 — debugging and educational tools

Implemented a lightweight assembly editor without adding an editor dependency. Instruction reference and completion come from the current ISA. The debugger shows simulator values and includes safe watch expressions (`PC`, `Rn`, `MEM[address]`), breakpoints, bounded snapshots, control waveforms and exported traces.

Generic-component references explain simulator-defined logical behavior. Related official TI documentation is linked separately: SN74HC157 multiplexer datasheet Rev. F and SN74HC595 shift-register datasheet Rev. J. The UI explicitly states that generic blocks are not physical drop-in models of those ICs. No manufacturer voltage, package or propagation-delay claims were invented.

Validation: browser testing renamed ADD to PLUS, changed its opcode to 10, edited the program in another page, assembled it and stepped the debugger. The CPU computed 12 and stored it at data-memory offset 20. After browser reload, the custom source and memory result were restored. The Memory console read the same value through its global address map. The original project was exported before these checks and restored afterward.

## Phase 5 — templates, exports and integration

Five executable non-pipeline template families pass structural validation and sample execution. The five-stage template is deliberately labeled as serial teaching latches, with concurrent pipeline behaviors unsupported.

Implemented project/source/machine-code/memory-image/validation/trace exports and SVG/PNG schematic exports. The production build includes the existing PWA/service-worker asset precache. Core assembly, validation and simulation execute locally without a cloud service. A disconnected-network production-browser test has not been performed; external datasheet links need connectivity.

## Tests and builds

- Final TypeScript check: passed (`tsc --noEmit --incremental` with a checkout-local build-info cache).
- Dedicated engineering suite: 36 tests passed.
- Existing Blocks suite: 2 tests passed.
- Broader related regression run: 152 passed, 1 failed across 10 files.
- The sole failure is the same initial `Master curriculum 1–392` audit, identifying 18 unrelated mobile/desktop route mappings. It was not suppressed or modified.
- Production Vite/PWA build: passed. The existing application still emits large-chunk warnings outside the CPU feature bundle.
- Desktop browser checks: all twelve specialized routes displayed their correct settled headings at 1672 × 941, with no horizontal page overflow.
- Responsive checks: Library, Wiring, Program Editor and Debugger at 390 × 844; all stayed within viewport width.

## Screenshots and comparison evidence

All twelve desktop screenshots are in this directory: `library.png`, `datapath.png`, `wires.png`, `isa.png`, `format.png`, `control.png`, `memory.png`, `editor.png`, `assembler.png`, `debug.png`, `validate.png`, `templates.png`. CPU Builder is in `builder.png`; four mobile captures have the `-mobile.png` suffix.

`all-labs.jpg` is a contact sheet. Each `<lab>-comparison.jpg` places its supplied reference beside the implementation. `visual-comparison.json` records mean absolute pixel differences as diagnostics, not a pixel-perfect pass threshold. Project-specific values, supported component inventories and reconstructed illustrations differ from the mockups. Further fine visual matching remains possible.

The earlier CPU Builder screenshots are retained one directory above as `designer-preview.png` and `blocks-preview.png`. Separate pre-change browser screenshots of every lab were not captured; reference comparisons must not be described as before/after implementation baselines.

`custom-instruction-execution.png` records browser execution of PLUS. `browser-checks.json` and `mobile-checks.json` record the route/viewport checks. `project-before-qa.cpu.json` retains the original project backup.

## Remaining limitations and technical risks

- This is a bounded ideal logic-level CPU model, not SPICE, physical timing, thermal, analog or transistor-level simulation.
- Concurrent pipeline hazards, forwarding, stalls and flushing are not modeled. The teaching pipeline template says so explicitly.
- Memory addresses are word addresses. Stack/heap/I/O are mapping roles; peripheral side effects and variable-latency stalls are not implemented. Configured latency is console metadata.
- The configured global map is used by the memory console; CPU load/store addresses are local offsets into their wired memory instance. It is not yet a unified multi-device address-decoder execution model.
- The CPU family uses up to eight registers and data widths up to 32 bits. Arbitrary processor families, 64-bit arithmetic and an unrestricted micro-operation language are not supported.
- Multi-cycle writes commit atomically at writeback; FSM state sequencing is not a transistor-accurate control timing model.
- Validation conservatively rejects multiple drivers on one input. Four-state resolution is available for inspection, but a complete shared tri-state bus arbitration architecture is not advertised.
- Runtime history is bounded and session-local, with separate trace export. Project files preserve current registers/memory and control position, not the entire debugger history.
- Large-graph worker offloading, interactive viewport minimap navigation, full alignment guides and a verified HDL/FPGA export toolchain remain future work.
- Imported legacy designs with incomplete wires may now fail correctly; import does not fabricate missing connections. Load a tested template or repair the indicated paths.
- Browser screenshots were inspected and compared, but exact pixel equality with the twelve supplied mockups is not claimed. Not every individual gesture has a browser automation test.

## Next-phase plan

1. Finish visual polish against the side-by-side comparison images, including richer schematics and tighter inspector proportions.
2. Add a global executed address decoder, actual memory latency/stalls and device-backed memory-mapped I/O.
3. Extend the FSM into explicit register-transfer micro-operations with stage-specific commits and a separately checked reference interpreter.
4. Implement an authentic concurrent pipeline with hazard/stall/flush/forwarding tests before changing its current capability label.
5. Move large simulation jobs into cancellable Workers; add a disconnected-network production PWA test and repeatable visual-regression automation.
6. Add verified HDL export only for a constrained, synthesis-tested subset.

## Modified and new source files

- `src/layout/AppShell.tsx`
- `src/studios/shared/ArchCanvas.tsx`
- `src/engines/builder/engineering.test.ts`
- `src/engines/builder/engineeringValidation.ts`
- `src/engines/builder/isa.ts`
- `src/engines/builder/logicGraph.ts`
- `src/engines/builder/model.ts`
- `src/engines/builder/project.ts`
- `src/engines/builder/sim.ts`
- `src/engines/builder/templates.ts`
- `src/studios/builder/BlockProgram.test.ts`
- `src/studios/builder/BlockProgram.tsx`
- `src/studios/builder/builder.css`
- `src/studios/builder/BuilderStudio.tsx`
- `src/studios/builder/ControlMemoryLabs.tsx`
- `src/studios/builder/DebugValidationTemplates.tsx`
- `src/studios/builder/engineering.css`
- `src/studios/builder/EngineeringLabs.tsx`
- `src/studios/builder/GraphLab.tsx`
- `src/studios/builder/IsaLabs.tsx`
- `src/studios/builder/labTypes.ts`
- `src/studios/builder/LibraryLab.tsx`
- `src/studios/builder/ProgramLabs.tsx`
- `src/studios/builder/projectStore.ts`
- `src/studios/builder/StudioFrame.tsx`
- `src/studios/builder/studioUi.tsx`

Existing unrelated working-tree changes were preserved. No Git commit or production deployment was made.
