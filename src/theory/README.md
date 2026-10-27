# Theory & Textbook

`StudioLearningLayout` provides an inline reading tab on Home, studio pages and architecture labs. `view=theory` controls reading mode independently of lab selection (`tab`, device parameters, and other configuration stay intact). Experiments remain mounted while hidden so returning to them preserves local state.

Home retains the searchable encyclopedia; lab reading renders only the current article and its relevant chapters. Explicit mappings in `focus.ts` override concept matching. Put a dedicated chapter in `focusedChapters.ts` and definitions in `focusedTerms.ts` when a lab needs its own worked lesson. Chapters explain the mechanism, equation, worked example, limitations, and a question with an answer.

The catalogue combines lab registries and generated tab metadata. Run `node scripts/generate-theory-metadata.cjs` after changing studio navigation. The extractor recognizes TABS, LOGIC_GATE_TABS, PAGES, PAGE_TABS, and CHIPS declarations. Run `npm test -- src/theory/catalogue.test.ts src/theory/focus.test.ts` to check route coverage, chapter integrity, and focused mappings.

`LabLesson` now supplies a diagram, mechanism notes, a worked scenario and explained questions for every entry. `lessonTopics.ts`, `architectureTopics.ts`, `embeddedTopics.ts`, `vlsiTopics.ts`, and `systemTopics.ts` contain original mechanism-specific lessons. `topicChapters.ts` explicitly maps those topics to relevant background chapters, avoiding accidental substring matches across unrelated subjects. The original detailed number, memory and control lessons retain their dedicated chapters.

Device scenarios are generated from the actual local simulation engines with a documented mode, no-fault baseline, fixed five-second comparison point, and one changed control. Regenerate them with `node_modules/.bin/vite-node scripts/generate-device-theory.ts` (use `vite-node.cmd` on Windows) after changing those models. The generated `deviceExamples.json` is content data; the engine code stays out of the textbook bundle.

Run `npm test -- src/theory/lessonCoverage.test.ts --maxWorkers=1` to audit all entries. The generator writes `output/theory-audit/coverage.json` with the source route, lesson type, chapter mapping, diagram size, solved-step count and explained-question count. Use `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.theory.json` for a focused type check. Coverage is structural verification, not a claim that every scientific topic has been exhaustively reviewed.
