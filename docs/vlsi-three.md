# Selective VLSI 3D views

3D is limited to structures whose spatial geometry matters:

- **FinFET:** three-sided gate wrapping, fin count, height and width. Planar mode uses its original 2D diagram.
- **GAAFET:** closed gates around stacked nanosheets, sheet dimensions and section/perspective/exploded views.
- **Vertical chip packaging:** stacked dies, TSV columns and thermal highlighting. The 2.5D interposer mode uses its original 2D diagram.

MOSFET bias/regions and I–V curves, MOS capacitors, fabrication steps and individual processes, metallization, cross-sections, wafer/yield maps and chiplet traffic retain 2D views. No 3D view is added to those labs.

The three spatial views consume the existing controls and numerical model outputs. Gate voltage controls illustrative flow, fin/sheet settings alter physical geometry, and packaging die count, TSV count and modeled thermal rise alter the stack. The package uses a thin neutral carrier rather than PCB styling. Geometry is explanatory and exaggerated for visibility, not a manufacturing or transport simulation.

Rendering is lazy-loaded with orbit/zoom, camera presets, 2D alternatives, material legends and PNG export. Motion pause freezes presentation time; shared Motion off / reduced motion suppresses decorative flow. Rendering suspends offscreen and in hidden tabs, and GPU resources are disposed on updates/navigation. WebGL failure falls back to the diagram.

Verification: `npm exec vitest run src/studios/vlsi/three/vlsiThree.test.ts` (6 tests). Control-driven fin/GAA geometry, gate cutoff, hollow gate sleeves, exploded spacing, package topology, TSV count, thermal response and finite resource replacement are covered. Browser checks verify 3D appears only in the intended lab/modes.

The final production build and SEO verification passed.
