# CPU studio audit and change impact

Baseline: 9 existing builder/block tests pass. The existing curriculum audit fails for 18 unrelated mobile/desktop routes.

Routes: overview, builder, library, datapath, wires, isa, format, control, memory, editor, assembler, debug, validate, templates. BuilderStudio owns the initial design and execution state; templates.ts creates reusable graphs; model.ts defines typed ports and immutable mutations; isa.ts assembles and decodes custom ISA definitions; sim.ts evaluates graphs and commits instructions; validate.ts checks wiring and encodings; store/projects.ts provides IndexedDB v2 records.

Impact: isolate redesigned layouts in studios/builder. Retain circuit mutation APIs and unrelated studios. Extend CPU design with optional versioned engineering metadata, allowing legacy imports. Strengthen graph evaluation and standard template wiring, assembler checks, and logic semantics under regression tests. Persistent studio store shares one project across routes. Every page derives previews from this project.

References: all 12 supplied PNG mockups inspected in a contact sheet; component library, ISA, control, and memory also inspected full-size. Snow white panels, blue/lavender hero, fixed left studio navigation, distinct middle workspaces, and contextual right guides are the design baseline.
