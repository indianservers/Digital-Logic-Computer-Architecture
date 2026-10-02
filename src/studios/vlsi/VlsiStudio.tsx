import type { ReactElement } from "react";
import { Link, useParams } from "react-router-dom";
import { VLSI_HOME, vlsiLabBySlug } from "../../data/vlsiLabs";
import { VlsiHome } from "./home";
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

function renderPreview(slug: string): ReactElement | null {
  const Screen = LABS[slug];
  return Screen ? <Screen /> : null;
}

export function VlsiStudio() {
  const { labId } = useParams();
  if (!labId) return <VlsiHome renderPreview={renderPreview} />;
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
    <VlsiFrame key={lab.slug} lab={lab}>
      <Screen />
    </VlsiFrame>
  );
}
