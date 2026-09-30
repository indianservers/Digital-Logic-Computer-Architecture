# VLSI Studio

VLSI Studio is the `/studios/vlsi` route. Labs are registered in `src/data/vlsiLabs.ts` and rendered by `src/studios/vlsi/VlsiStudio.tsx`. A lab appears on the home page, in search, and in Previous/Next only when `implemented` is true and its slug is in the `LABS` map.

## Layout

Every lab is wrapped by `VlsiFrame`. The lab component returns `VlsiGrid` with controls, a stage, and readouts. Shared controls live in `widgets.tsx`: `Slider` (the value text is the `text` prop), `Choice`, `Measure`, `Observe`, `Chart`, `PlayControls`, and `useTicker`. Styles stay under `.vlsi` in `vlsi.css`.

## Engines

| File | What it owns |
|---|---|
| `engine.ts` | Square-law MOS, CMOS delay, CMOS power, gate networks |
| `timingModel.ts` | Setup/hold, STA, logical effort, Elmore, crosstalk |
| `layoutModel.ts` | Rectangles, DRC |
| `verifyModel.ts` | LVS and parasitic extraction |
| `cellLibrary.ts` | Educational standard cells |
| `flowModel.ts` | Generic gates, optimization, technology mapping, RTL subset |
| `physicalModel.ts` | Floorplan, power grid, placement, routing, CTS |
| `memoryModel.ts` | SRAM, DRAM, sense amp, nonvolatile cells |
| `reliabilityModel.ts` | IR drop, EM, SI, PVT, gating, multi-Vt |
| `processModel.ts` | Materials, fabrication stack, FinFET/GAA, wafer, yield |
| `dftModel.ts` | Scan, stuck-at, ATPG search, TAP, LFSR/MISR |
| `systemModel.ts` | SoC floorplan length, NoC routes, chiplets, package, thermal, PPA |
| `gdsFlow.ts` | RTL-to-GDSII state. Each stage reads the previous stage's result |

Numbers are educational. They are not a process design kit, a foundry deck, or signoff EDA.

## RTL-to-GDSII

`gdsFlow.ts` keeps one `GdsState`. `runStage` refuses to run until the previous stage has passed or warned. `invalidateDownstream` marks that stage and every later stage `not-run` without inventing a new netlist. Placement count is taken from the mapped cell list. Slack uses mapped delay plus routed wire and the chosen period.

## Adding a lab

1. Add the engine function next to the model it belongs to, with a unit test.
2. Add a component that returns `VlsiGrid` and does not wrap `VlsiFrame`.
3. Register the slug in `VlsiStudio.tsx`.
4. Add an `implemented: true` entry in `vlsiLabs.ts` with the existing category. Do not invent a second route.
