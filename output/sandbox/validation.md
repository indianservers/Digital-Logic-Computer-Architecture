# Sandbox verification

- `npm run build` passed, including TypeScript, Vite production compilation, PWA generation, 1507 SEO page checks and two route-resolution checks.
- 18 focused automated checks: eight model tests plus ten route render checks.
- Ripple carry adder: exhaustive evaluation of all 512 input combinations.
- Five-gate full adder: exhaustive evaluation of all eight input combinations; also tested via the editable template in the browser.
- Browser checks at 1586 × 992: all ten workbench routes rendered and screenshots were saved in this folder.
- Browser interactions checked: input switch changes output LEDs; Run starts moving signal dots; memory stepping fills a cache line; Core 1 read writes back Core 0's modified line and transitions both to Shared; stepping the paused STORE commits 0x08 to address 0x20; changing the component testbench to A=7, B=3, SUB computes 4 and passes its tests.
- Realistic hardware PNG generated with the built-in imagegen tool. See `image-prompt.txt` for the exact generation prompt and `assets.md` for the asset location.
- Visual matching was reviewed against supplied mockups; exact pixel equality is not certified.
