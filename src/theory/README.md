# Theory & Textbook

`StudioLearningLayout` provides an inline reading tab on Home, studio pages and architecture labs. `view=theory` controls reading mode independently of lab selection (`tab`, device parameters, and other configuration stay intact). Experiments remain mounted while hidden so returning to them preserves local state.

Home retains the searchable encyclopedia; lab reading renders only the current article and its relevant chapters. Explicit mappings in `focus.ts` override concept matching. Put a dedicated chapter in `focusedChapters.ts` and definitions in `focusedTerms.ts` when a lab needs its own worked lesson. Chapters explain the mechanism, equation, worked example, limitations, and a question with an answer.

The catalogue combines lab registries and generated tab metadata. Run `node scripts/generate-theory-metadata.cjs` after changing studio navigation. The extractor recognizes TABS, LOGIC_GATE_TABS, PAGES, PAGE_TABS, and CHIPS declarations. Run `npm test -- src/theory/catalogue.test.ts src/theory/focus.test.ts` to check route coverage, chapter integrity, and focused mappings.
