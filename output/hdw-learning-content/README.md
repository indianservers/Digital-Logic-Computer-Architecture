# How Devices Work explanations and educational build projects

Coverage: all 140 current device page definitions. Each How It Works tab now includes an operating explanation of 200–400 words, plus a device-specific educational build project with materials, method and a verification task. See word-counts.csv for individual page statistics and page-review.json for the complete rendered text inventory.

The explanation assembles the existing device's reviewed principle, operating sequence, relevant component functions and available accuracy notes into an introductory narrative. The word limit applies to this new narrative, not to the entire tab: all original diagrams, working steps and educational sections remain available after it. Existing simulations and control behavior are unchanged.

Build projects are conceptual educational guides, not complete circuit schematics, certified hardware construction manuals or manufacturer teardown instructions. They deliberately specify software models, recorded signals, development modules or low-voltage bench mechanisms for specialist devices. Exact bills of materials, board-specific wiring and firmware depend on the chosen implementation. Source links distinguish general development examples from the device's existing references.

Validation: run `node node_modules/vite-node/vite-node.mjs scripts/audit-device-learning-content.ts` to check every page's word count and build-plan coverage. Existing How Devices Work regression tests and the production build passed during implementation.
