import type { ReactElement } from "react";
import { Link, useParams } from "react-router-dom";
import { VLSI_CATEGORIES, VLSI_HOME, VLSI_LABS, vlsiLabBySlug, vlsiRoute, type VlsiLabMeta } from "../../data/vlsiLabs";
import { VlsiFrame } from "./shell";
import { CmosInverterLab, CmosPowerLab, CmosVtcLab, PropagationDelayLab } from "./labs/cmosLabs";
import { MosCapacitorLab, MosfetFundamentalsLab, MosfetIvLab } from "./labs/deviceLabs";
import { CmosNandLab, CmosNorLab, ComplexCmosLab } from "./labs/gateLabs";
import { PassTransistorLab, TransmissionGateLab, TriStateLab } from "./labs/passLabs";
import { ClockingLab, ClockTreeLab, MetastabilityLab, SetupHoldLab } from "./labs/clockLabs";
import { CellLibraryLab, FlowLab, StandardCellLab } from "./labs/cellLabs";
import { DrcLab, InverterLayoutLab, LayoutBasicsLab, NandNorLayoutLab, StickDiagramLab } from "./labs/layoutLabs";
import { ClockTreeSynthLab, CongestionLab, FloorplanLab, PlacementLab, PlacementOptLab, PowerPlanLab, RoutingLab } from "./labs/physicalLabs";
import { DFlipFlopLab, DLatchLab, SrLatchLab } from "./labs/seqLabs";
import { BooleanOptLab, FsmSynthLab, MappingLab, RtlLab, SynthesisLab } from "./labs/synthLabs";
import { ExtractionLab, LvsLab } from "./labs/verifyLabs";
import { CombinationalTimingLab, StaticTimingLab, TimingPathLab } from "./labs/staLabs";
import { ClockGatingLab, MultiVddLab, MultiVtLab, PowerGatingLab } from "./labs/lowPowerLabs";
import { DramCellLab, MemoryDecoderLab, NonvolatileLab, SenseAmpLab, Sram6tLab, SramArrayLab, SramReadLab, SramWriteLab } from "./labs/memoryLabs";
import { ElectromigrationLab, IrDropLab, PvtLab, SignalIntegrityLab, VariationLab } from "./labs/powerLabs";
import { FinfetLab, GaafetLab, ScalingLab } from "./labs/advancedLabs";
import { CmpLab, EtchLab, FabricationLab, ImplantLab, LithographyLab, OxidationLab, WellLab } from "./labs/fabLabs";
import { CrossSectionLab, MetallizationLab, WaferLab, YieldLab } from "./labs/stackLabs";
import { AtpgLab, BistLab, JtagLab, ScanChainLab, ScanTestLab, StuckLab } from "./labs/dftLabs";
import { RtlGdsLab } from "./labs/gdsLab";
import { AsicFlowLab, ChipletLab, FpgaAsicLab, NocLab, PackageLab, PpaLab, SocFloorLab, ThermalLab } from "./labs/systemLabs";
import { CrosstalkLab, FanoutLab, InterconnectLab, LogicalEffortLab } from "./labs/wireLabs";
import "./vlsi.css";

const LABS: Record<string, () => ReactElement> = {
  "mosfet-fundamentals": MosfetFundamentalsLab,
  "mosfet-iv": MosfetIvLab,
  "mos-capacitor": MosCapacitorLab,
  "cmos-inverter": CmosInverterLab,
  "cmos-vtc": CmosVtcLab,
  "cmos-power": CmosPowerLab,
  "propagation-delay": PropagationDelayLab,
  "cmos-nand": CmosNandLab,
  "cmos-nor": CmosNorLab,
  "complex-cmos": ComplexCmosLab,
  "transmission-gate": TransmissionGateLab,
  "pass-transistor": PassTransistorLab,
  "tri-state": TriStateLab,
  "sr-latch": SrLatchLab,
  "d-latch": DLatchLab,
  "d-flip-flop": DFlipFlopLab,
  "setup-hold": SetupHoldLab,
  metastability: MetastabilityLab,
  clocking: ClockingLab,
  "clock-distribution": ClockTreeLab,
  "combinational-timing": CombinationalTimingLab,
  "static-timing": StaticTimingLab,
  "timing-path": TimingPathLab,
  "logical-effort": LogicalEffortLab,
  "fanout-loading": FanoutLab,
  "interconnect-rc": InterconnectLab,
  crosstalk: CrosstalkLab,
  "layout-basics": LayoutBasicsLab,
  "stick-diagram": StickDiagramLab,
  "inverter-layout": InverterLayoutLab,
  "nand-nor-layout": NandNorLayoutLab,
  drc: DrcLab,
  lvs: LvsLab,
  "parasitic-extraction": ExtractionLab,
  "standard-cell": StandardCellLab,
  "cell-library": CellLibraryLab,
  "schematic-to-layout": FlowLab,
  "rtl-visualization": RtlLab,
  "logic-synthesis": SynthesisLab,
  "technology-mapping": MappingLab,
  "boolean-optimization": BooleanOptLab,
  "fsm-synthesis": FsmSynthLab,
  floorplanning: FloorplanLab,
  "power-planning": PowerPlanLab,
  placement: PlacementLab,
  "placement-optimization": PlacementOptLab,
  routing: RoutingLab,
  "routing-congestion": CongestionLab,
  "clock-tree": ClockTreeSynthLab,
  "ir-drop": IrDropLab,
  electromigration: ElectromigrationLab,
  "signal-integrity": SignalIntegrityLab,
  "pvt-corners": PvtLab,
  "process-variation": VariationLab,
  "power-gating": PowerGatingLab,
  "clock-gating": ClockGatingLab,
  "multi-vt": MultiVtLab,
  "multi-vdd": MultiVddLab,
  "sram-6t": Sram6tLab,
  "sram-array": SramArrayLab,
  "sram-read": SramReadLab,
  "sram-write": SramWriteLab,
  "sense-amplifier": SenseAmpLab,
  "dram-1t1c": DramCellLab,
  "memory-decoder": MemoryDecoderLab,
  "nonvolatile-cells": NonvolatileLab,
  finfet: FinfetLab,
  gaafet: GaafetLab,
  "technology-scaling": ScalingLab,
  "cmos-fabrication": FabricationLab,
  photolithography: LithographyLab,
  doping: ImplantLab,
  wells: WellLab,
  oxidation: OxidationLab,
  etching: EtchLab,
  cmp: CmpLab,
  metallization: MetallizationLab,
  "cross-section": CrossSectionLab,
  "wafer-die": WaferLab,
  yield: YieldLab,
  "scan-chain": ScanChainLab,
  "scan-test": ScanTestLab,
  atpg: AtpgLab,
  "stuck-at": StuckLab,
  jtag: JtagLab,
  bist: BistLab,
  "asic-flow": AsicFlowLab,
  "fpga-asic": FpgaAsicLab,
  "soc-floorplan": SocFloorLab,
  noc: NocLab,
  chiplet: ChipletLab,
  "packaging-3d": PackageLab,
  thermal: ThermalLab,
  ppa: PpaLab,
  "rtl-gdsii": RtlGdsLab,
};

function LabCard({ lab }: { lab: VlsiLabMeta }) {
  return (
    <Link className="vlsi-card" to={vlsiRoute(lab.slug)}>
      <CategoryMark category={lab.category} />
      <span>Lab {lab.number}</span>
      <strong>{lab.title}</strong>
      <em>{lab.summary}</em>
    </Link>
  );
}

function CategoryMark({ category }: { category: VlsiLabMeta["category"] }) {
  const paths: Record<VlsiLabMeta["category"], string> = {
    device: "M3 12h10M8 12V4M5 7h6",
    cmos: "M3 4h4v8H3zM9 4h4v8H9z",
    timing: "M2 12c2-8 4-8 6 0s4 8 6 0",
    layout: "M3 3h4v4H3zM9 3h4v4H9zM3 9h4v4H3zM9 9h4v4H9z",
    cells: "M2 4h12v8H2zM6 4v8M10 4v8",
    physical: "M3 13V5l5-2 5 2v8l-5 2z",
    power: "M8 2v6l3-1-4 7V8L4 9z",
    memory: "M3 3h10v10H3zM3 6h10M3 10h10",
    advanced: "M8 2l2 4h4l-3 3 1 4-4-2-4 2 1-4-3-3h4z",
    fab: "M8 2a6 6 0 100 12 6 6 0 000-12zM8 2v12",
    dft: "M2 8h3l2-4 2 8 2-4h3",
    soc: "M2 2h5v5H2zM9 2h5v5H9zM2 9h5v5H2zM9 9h5v5H9z",
    flow: "M2 3h5v3H2zM9 7h5v3H9zM2 11h5v3H2zM7 4h2M9 8H7M7 12h2",
  };
  return (
    <svg className="vlsi-mark" viewBox="0 0 16 16" aria-hidden="true">
      <path d={paths[category]} fill="none" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

export function VlsiHome() {
  const open = VLSI_CATEGORIES.filter((category) => VLSI_LABS.some((lab) => lab.category === category.id && lab.implemented));
  const later = VLSI_CATEGORIES.filter((category) => !open.some((item) => item.id === category.id));
  return (
    <div className="vlsi">
      <header className="vlsi-hero">
        <p>VLSI Studio</p>
        <h1>From transistor physics to silicon implementation</h1>
        <p>Change a voltage, a width, or a logic input and watch the silicon respond. {VLSI_LABS.filter((lab) => lab.implemented).length} labs are open.{later.length > 0 ? " The rest of the sequence stays listed until its simulator is ready." : " Every lab in the sequence has a simulator."}</p>
      </header>
      {open.map((category) => (
        <section key={category.id} className="vlsi-home-cat">
          <h2>{category.title}</h2>
          <p>{category.blurb}</p>
          <div className="vlsi-cards">
            {VLSI_LABS.filter((lab) => lab.category === category.id && lab.implemented).map((lab) => <LabCard key={lab.slug} lab={lab} />)}
          </div>
        </section>
      ))}
      {later.length > 0 ? (
        <section className="vlsi-later">
          <h2>Later in this studio</h2>
          <ul>
            {later.map((category) => <li key={category.id}>{category.title}</li>)}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

export function VlsiStudio() {
  const { labId } = useParams();
  if (!labId) return <VlsiHome />;
  const lab = vlsiLabBySlug(labId);
  if (!lab) {
    return (
      <div className="vlsi">
        <p>That VLSI lab is not in the registry.</p>
        <Link to={VLSI_HOME}>Return to VLSI Studio</Link>
      </div>
    );
  }
  if (!lab.implemented) {
    return (
      <div className="vlsi">
        <h1>Lab {lab.number} · {lab.title}</h1>
        <p>{lab.summary} This lab is part of a later phase, so there is no simulator here yet.</p>
        <Link to={VLSI_HOME}>Return to VLSI Studio</Link>
      </div>
    );
  }
  const Screen = LABS[lab.slug];
  if (!Screen) {
    return (
      <div className="vlsi">
        <p>Lab {lab.number} is marked open, but its screen is missing.</p>
        <Link to={VLSI_HOME}>Return to VLSI Studio</Link>
      </div>
    );
  }
  return (
    <VlsiFrame lab={lab}>
      <Screen />
    </VlsiFrame>
  );
}
