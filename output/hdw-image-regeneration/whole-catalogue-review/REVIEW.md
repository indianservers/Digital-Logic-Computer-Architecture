# Whole-catalogue image provenance audit

All 140 existing page definitions were checked for registered device and part images. There are 742 legacy raster assets and 1,198 named components. The legacy files remain available during replacement so useful educational content is preserved. This audit measures asset provenance and coverage; it does not certify the physical accuracy of every existing illustration.

Only SONAR (11) and INS (63) had complete separately generated component coverage when this audit began. These remain representative illustrations, not certified manufacturer-specific assemblies. Digital Multimeter (140) is next because the user identified its cropped mockup artwork.

The user selected exact manufacturer/model hardware, then authorized choosing suitable models ("any best"). Selection prioritizes manufacturer documentation and visible component references, rather than an unsupported best-product ranking. The chosen multimeter is the Fluke 87V, using its official product page and linked 80 Series V user and calibration manuals. Do not substitute 87V MAX, 87V EX, Series III or 87 V/AN assembly details without checking differences.

All generic multimeter drafts have been removed from the live image registry and moved to `drafts/140-digital-multimeter`. They are unapproved and are not exact Fluke 87V assets. The voltage-divider and large current-shunt drafts require rejection or correction. Original learning-page images remain pending verified replacements; this does not resolve their crop defects. No manufacturer-specific image replacements have been approved in this review.

- [Fluke 87V official product and linked manufacturer manuals](https://www.fluke.com/en-us/product/electrical-testing/digital-multimeters/fluke-87v)

Review criteria: correct component class and function; plausible physical geometry; no unrelated whole-device content inside a component image; no embedded educational titles; complete framing; original-resolution PNG; actual alpha for isolated components; and an honest distinction between a representative circuit region and a manufacturer-specific assembly. Functional blocks can share a physical PCB. An illustration is not evidence of a certified circuit or exact teardown.

Multimeter references:

- [Texas Instruments — digital multimeter design](https://www.ti.com/solution/digital-multimeter-dmm)
- [Fluke — multimeter dials, controls, display and input jacks](https://www.fluke.com/en-us/learn/blog/digital-multimeters/multimeter-dial-button-jacks-display)
- [Fluke — 80 Series service information](https://assets.fluke.com/manuals/8xiii___sieng0200.pdf)

The first probe illustration was rejected because it showed exposed banana contacts despite the requested shrouded plugs. A targeted edit corrected that defect. The voltage-divider PCB illustration requires replacement because its visible traces could imply bypassed resistors. Generated appearance alone is insufficient to approve a technical image.

The machine-readable coverage JSON and CSV list each page, each named component, registered generated paths and missing coverage. A missing entry is pending work, not a pass. The previous reports' “generated” status must not be interpreted as 100% manufacturer accuracy.
