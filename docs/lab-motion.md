# Lab animations

`LabMotionBoundary` wraps all `/studios/*` and `/architecture/*` labs. It highlights changed readouts, pulses active states, and fades newly opened panels. Shared selectors cover standard cards, number-system bits, microcontroller metrics, timing readouts, sandbox values, registers, and memory tables. Add `data-lab-value` to a custom readout or `data-lab-active` to a custom state when a new lab uses a different visual structure.

Pipeline instructions enter when their stage content changes. CPU-builder wires show a short pulse when their evaluated signal changes. Circuit charge flow and existing GSAP animations honor the shared preference. Animation never advances the simulator or changes its speed.

The compact **Motion** control beside the lab/textbook tabs persists the user's preference. Device reduced-motion preferences take precedence. CSS animations, transitions, SVG SMIL, and integrated GSAP effects stop or show their final state when motion is disabled.

Feedback is restricted to the interactive lab, visible elements, and a bounded queue: 128 pending targets, at most 20 cues per frame, at most six panel entrances. Excess cues are discarded so they cannot describe an older simulation cycle. Pointer gestures suppress observer feedback, and hiding the document cancels pending feedback. Timing waveforms and canvas geometry do not interpolate between simulation states.

Verification: 1,972 tests across 125 files passed, including six animation scheduling tests. Browser checks verified pipeline stepping, instruction animation styles, Motion off, preference persistence between labs, and live number conversion with Motion on. The browser reported no errors in those checks. Production verification is currently blocked by unfinished sandbox files elsewhere in the workspace (missing `sandbox.css` and unused declarations).
