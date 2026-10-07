# How Devices Work implementation verification

Reviewed on 2026-10-06. Preview: http://127.0.0.1:5187/studios/how-devices-work

## Scope

54 interactive labs are available. The catalogue retains 136 unique devices across 140 category entries; shared devices use the same canonical link in each category. Remaining devices are labelled Upcoming.

All 54 supplied source mockups were inspected. `mapping.json` records their source files, artwork crops and generated assets. Source mockups were read only. There are 174 optimized local WebP assets.

Existing application integration is limited to route registration, a studio catalogue entry, its home thumbnail and bypassing shared chrome on this studio's device pages. No other studio implementation was edited.

## Checks

- All 54 pages: desktop route, image loading, first slider interaction, fault state and quiz feedback checked in the browser. Circuit view checked across the pages; lab 39 also shares the tested circuit component.
- All 54 desktop compositions visually inspected against the supplied references.
- All 54 pages at 390 × 844: images loaded, sliders exceeded 200 px and no horizontal document overflow.
- Tablet 768 × 1024: labs 1, 3, 11, 17, 25, 29, 35, 39, 44 and 48 passed image, slider-width and document-overflow checks.
- Laptop 1024 × 768: labs 1, 11, 25, 29, 35, 39, 44, 48, 49 and 54 loaded images without horizontal overflow. Three-column slider widths can be below 200 px; PCR controls were inspected at 179 px and remain usable.
- Targeted Vitest suite: 398 tests passed (222 catalogue, 176 labs), covering rendering, assets, finite control extrema, mode execution, fault invalidation, canonical links and selected physical relationships.
- Targeted strict TypeScript check passed.
- Production Vite build passed; the app's existing large main-bundle warning remains.

## Review limitations

This is not a verified pixel-identical reproduction. Typography, spacing, card density and some control arrangements differ from the mockups. The additional component descriptions, circuit views and quizzes can increase page height.

Lab 16's supplied source is a small thumbnail rather than a complete page; its layout uses the related thermometer composition. Its reference artwork remains low resolution.

Model outputs are educational approximations. Imaging phantoms are synthetic; CT head, endoscope and microscope reference scenes are identified separately from simulated parameter adjustments. Audio examples use a short synthesized signal. The reference audiogram is labelled as reference data.

Full-project TypeScript and broader tests have existing failures outside this studio, including the unused `args` parameter in `microcontroller/labs/core/cinterp.test.ts`. Those unrelated files were left unchanged.
