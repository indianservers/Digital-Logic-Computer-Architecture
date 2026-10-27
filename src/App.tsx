import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { AppShell } from "./layout/AppShell";
import { LabMotionBoundary } from "./design-system/LabMotion";
import { StudioLearningLayout } from "./theory/TheoryEntry";
const TheoryReader = lazy(() => import("./theory/TheoryReader").then(module => ({ default: module.TheoryReader })));
import { CheatPage, HomePage, LearnPage, NotesPage, PracticePage, ProjectsPage, StudiosPage, UpcomingPage } from "./pages/HomePages";
const AdderStudio = lazy(() => import("./studios/adders/AdderStudio").then(module => ({ default: module.AdderStudio })));
const AssemblyStudio = lazy(() => import("./studios/assembly/AssemblyStudio").then(module => ({ default: module.AssemblyStudio })));
const ControlStudio = lazy(() => import("./studios/control/ControlStudio").then(module => ({ default: module.ControlStudio })));
const FdeStudio = lazy(() => import("./studios/fde/FdeStudio").then(module => ({ default: module.FdeStudio })));
const BusStudio = lazy(() => import("./studios/bus/BusStudio").then(module => ({ default: module.BusStudio })));
const HazardStudio = lazy(() => import("./studios/hazards/HazardStudio").then(module => ({ default: module.HazardStudio })));
const HierarchyStudio = lazy(() => import("./studios/hierarchy/HierarchyStudio").then(module => ({ default: module.HierarchyStudio })));
const InterruptStudio = lazy(() => import("./studios/interrupts/InterruptStudio").then(module => ({ default: module.InterruptStudio })));
const IoStudio = lazy(() => import("./studios/io/IoStudio").then(module => ({ default: module.IoStudio })));
const MulticoreStudio = lazy(() => import("./studios/multicore/MulticoreStudio").then(module => ({ default: module.MulticoreStudio })));
const AcaStudio = lazy(() => import("./studios/aca/AcaStudio").then(module => ({ default: module.AcaStudio })));
const ParallelStudio = lazy(() => import("./studios/parallel/ParallelStudio").then(module => ({ default: module.ParallelStudio })));
const IsaStudio = lazy(() => import("./studios/isa/IsaStudio").then(module => ({ default: module.IsaStudio })));
const PipelineStudio = lazy(() => import("./studios/pipeline/PipelineStudio").then(module => ({ default: module.PipelineStudio })));
const AluStudio = lazy(() => import("./studios/alu/AluStudio").then(module => ({ default: module.AluStudio })));
const RtlStudio = lazy(() => import("./studios/rtl/RtlStudio").then(module => ({ default: module.RtlStudio })));
const BooleanStudio = lazy(() => import("./studios/boolean-algebra/BooleanStudio").then(module => ({ default: module.BooleanStudio })));
const CombinationalStudio = lazy(() => import("./studios/combinational/CombinationalStudio").then(module => ({ default: module.CombinationalStudio })));
const CacheStudio = lazy(() => import("./studios/cache/CacheStudio").then(module => ({ default: module.CacheStudio })));
const CounterStudio = lazy(() => import("./studios/counters/CounterStudio").then(module => ({ default: module.CounterStudio })));
const CpuStudio = lazy(() => import("./studios/cpu/CpuStudio").then(module => ({ default: module.CpuStudio })));
const FsmStudio = lazy(() => import("./studios/fsm/FsmStudio").then(module => ({ default: module.FsmStudio })));
const MemoryStudio = lazy(() => import("./studios/memory/MemoryStudio").then(module => ({ default: module.MemoryStudio })));
const FlipFlopStudio = lazy(() => import("./studios/flip-flops/FlipFlopStudio").then(module => ({ default: module.FlipFlopStudio })));
const KmapStudio = lazy(() => import("./studios/kmap/KmapStudio").then(module => ({ default: module.KmapStudio })));
const LogicGatesStudio = lazy(() => import("./studios/logic-gates/LogicGatesStudio").then(module => ({ default: module.LogicGatesStudio })));
const NumberSystemsStudio = lazy(() => import("./studios/number-systems/NumberSystemsStudio").then(module => ({ default: module.NumberSystemsStudio })));
const RegisterStudio = lazy(() => import("./studios/registers/RegisterStudio").then(module => ({ default: module.RegisterStudio })));
const RoutingStudio = lazy(() => import("./studios/routing/RoutingStudio").then(module => ({ default: module.RoutingStudio })));
const TimingStudio = lazy(() => import("./studios/timing/TimingStudio").then(module => ({ default: module.TimingStudio })));
const TruthStudio = lazy(() => import("./studios/truth-tables/TruthStudio").then(module => ({ default: module.TruthStudio })));
const VmStudio = lazy(() => import("./studios/vm/VmStudio").then(module => ({ default: module.VmStudio })));
const VlsiStudio = lazy(() => import("./studios/vlsi/VlsiStudio").then(module => ({ default: module.VlsiStudio })));
const MicrocontrollerStudio = lazy(() => import("./studios/microcontroller/MicrocontrollerStudio").then(module => ({ default: module.MicrocontrollerStudio })));
const MicrocontrollerProjectLab = lazy(() => import("./studios/microcontroller/MicrocontrollerProjectLab").then(module => ({ default: module.MicrocontrollerProjectLab })));
const MicrocontrollerLabRoute = lazy(() => import("./studios/microcontroller/labs/LabRoute").then(module => ({ default: module.MicrocontrollerLabRoute })));

const AcceleratorStudio = lazy(() => import("./studios/accelerator/AcceleratorStudio"));
const HeteroStudio = lazy(() => import("./studios/hetero/HeteroStudio"));
const SocStudio = lazy(() => import("./studios/soc/SocStudio"));
const Cpu8Studio = lazy(() => import("./studios/cpu8/Cpu8Studio"));
const Cpu16Studio = lazy(() => import("./studios/cpu16/Cpu16Studio"));
const MipsStudio = lazy(() => import("./studios/mips/MipsStudio"));
const RiscvStudio = lazy(() => import("./studios/riscv/RiscvStudio"));
const ArmStudio = lazy(() => import("./studios/arm/ArmStudio"));
const X86Studio = lazy(() => import("./studios/x86/X86Studio"));
const CompareStudio = lazy(() => import("./studios/compare/CompareStudio"));
const MobileStudio = lazy(() => import("./studios/mobile/MobileStudio"));
const DesktopStudio = lazy(() => import("./studios/desktop/DesktopStudio"));
const BuilderStudio = lazy(() => import("./studios/builder/BuilderStudio"));
const SandboxStudio = lazy(() => import("./studios/sandbox/SandboxStudio"));
const HowDevicesWorkStudio = lazy(() => import("./studios/how-devices-work/HowDevicesWorkStudio"));
const DevicePage = lazy(() => import("./studios/how-devices-work/HowDevicesWorkStudio").then(module => ({ default: module.DevicePage })));

function UpcomingRoute() {
  const { id } = useParams();
  return <UpcomingPage id={id ?? ""} />;
}

function Suspend({ children }: { children: ReactNode }) {
  return <Suspense fallback={<div className="card">Loading studio…</div>}>{children}</Suspense>;
}

export function App() {
  return (
    <AppShell>
      <LabMotionBoundary><StudioLearningLayout><Suspend><Routes>
        <Route path="/encyclopedia" element={<Suspend><TheoryReader /></Suspend>} />
        <Route path="/" element={<HomePage />} />
        <Route path="/learn" element={<LearnPage />} />
        <Route path="/studios" element={<StudiosPage />} />
        <Route path="/studios/how-devices-work" element={<Suspend><HowDevicesWorkStudio /></Suspend>} />
        <Route path="/studios/how-devices-work/:category/:slug" element={<Suspend><DevicePage /></Suspend>} />
        <Route path="/studios/vlsi" element={<VlsiStudio />} />
        <Route path="/studios/vlsi/:labId" element={<VlsiStudio />} />
        <Route path="/studios/microcontroller" element={<MicrocontrollerStudio />} />
        <Route path="/studios/microcontroller/project/:slug" element={<MicrocontrollerProjectLab />} />
        <Route path="/studios/microcontroller/lab/:slug" element={<MicrocontrollerLabRoute />} />
        <Route path="/studios/number-systems" element={<Suspend><NumberSystemsStudio /></Suspend>} />
        <Route path="/studios/boolean-algebra" element={<BooleanStudio />} />
        <Route path="/studios/logic-gates" element={<LogicGatesStudio />} />
        <Route path="/studios/truth-tables" element={<TruthStudio />} />
        <Route path="/studios/kmap" element={<KmapStudio />} />
        <Route path="/studios/combinational" element={<CombinationalStudio />} />
        <Route path="/studios/adders" element={<AdderStudio />} />
        <Route path="/studios/routing" element={<RoutingStudio />} />
        <Route path="/studios/timing" element={<TimingStudio />} />
        <Route path="/studios/flip-flops" element={<FlipFlopStudio />} />
        <Route path="/studios/registers" element={<RegisterStudio />} />
        <Route path="/studios/counters" element={<CounterStudio />} />
        <Route path="/studios/fsm" element={<FsmStudio />} />
        <Route path="/studios/memory" element={<MemoryStudio />} />
        <Route path="/studios/cache" element={<CacheStudio />} />
        <Route path="/studios/cpu-blocks" element={<CpuStudio />} />
        <Route path="/studios/isa" element={<IsaStudio />} />
        <Route path="/studios/assembly" element={<AssemblyStudio />} />
        <Route path="/studios/fde" element={<FdeStudio />} />
        <Route path="/studios/rtl" element={<RtlStudio />} />
        <Route path="/studios/control" element={<Suspend><ControlStudio /></Suspend>} />
        <Route path="/studios/pipeline" element={<PipelineStudio />} />
        <Route path="/studios/hazards" element={<HazardStudio />} />
        <Route path="/studios/hierarchy" element={<HierarchyStudio />} />
        <Route path="/studios/vm" element={<VmStudio />} />
        <Route path="/studios/io" element={<IoStudio />} />
        <Route path="/studios/interrupts" element={<Suspend><InterruptStudio /></Suspend>} />
        <Route path="/studios/bus" element={<BusStudio />} />
        <Route path="/studios/parallel" element={<ParallelStudio />} />
        <Route path="/studios/multicore" element={<MulticoreStudio />} />
        <Route path="/studios/aca" element={<Navigate to="/studios/advanced-computer-architecture" replace />} />
        <Route path="/studios/advanced-computer-architecture" element={<AcaStudio />} />
        <Route path="/studios/advanced-computer-architecture/:labId" element={<AcaStudio />} />
        <Route path="/architecture/accelerator" element={<Suspend><AcceleratorStudio /></Suspend>} />
        <Route path="/architecture/accelerator/:labId" element={<Suspend><AcceleratorStudio /></Suspend>} />
        <Route path="/architecture/hetero" element={<Suspend><HeteroStudio /></Suspend>} />
        <Route path="/architecture/hetero/:labId" element={<Suspend><HeteroStudio /></Suspend>} />
        <Route path="/architecture/soc" element={<Suspend><SocStudio /></Suspend>} />
        <Route path="/architecture/soc/:labId" element={<Suspend><SocStudio /></Suspend>} />
        <Route path="/architecture/cpu8" element={<Suspend><Cpu8Studio /></Suspend>} />
        <Route path="/architecture/cpu8/:labId" element={<Suspend><Cpu8Studio /></Suspend>} />
        <Route path="/architecture/cpu16" element={<Suspend><Cpu16Studio /></Suspend>} />
        <Route path="/architecture/cpu16/:labId" element={<Suspend><Cpu16Studio /></Suspend>} />
        <Route path="/architecture/mips" element={<Suspend><MipsStudio /></Suspend>} />
        <Route path="/architecture/mips/:labId" element={<Suspend><MipsStudio /></Suspend>} />
        <Route path="/architecture/riscv" element={<Suspend><RiscvStudio /></Suspend>} />
        <Route path="/architecture/riscv/:labId" element={<Suspend><RiscvStudio /></Suspend>} />
        <Route path="/architecture/arm" element={<Suspend><ArmStudio /></Suspend>} />
        <Route path="/architecture/arm/:labId" element={<Suspend><ArmStudio /></Suspend>} />
        <Route path="/architecture/x86" element={<Suspend><X86Studio /></Suspend>} />
        <Route path="/architecture/x86/:labId" element={<Suspend><X86Studio /></Suspend>} />
        <Route path="/architecture/compare" element={<Suspend><CompareStudio /></Suspend>} />
        <Route path="/architecture/compare/:labId" element={<Suspend><CompareStudio /></Suspend>} />
        <Route path="/architecture/mobile" element={<Suspend><MobileStudio /></Suspend>} />
        <Route path="/architecture/mobile/:labId" element={<Suspend><MobileStudio /></Suspend>} />
        <Route path="/architecture/desktop" element={<Suspend><DesktopStudio /></Suspend>} />
        <Route path="/architecture/desktop/:labId" element={<Suspend><DesktopStudio /></Suspend>} />
        <Route path="/architecture/builder" element={<Suspend><BuilderStudio /></Suspend>} />
        <Route path="/architecture/builder/:labId" element={<Suspend><BuilderStudio /></Suspend>} />
        <Route path="/architecture/sandbox" element={<Suspend><SandboxStudio /></Suspend>} />
        <Route path="/architecture/sandbox/:labId" element={<Suspend><SandboxStudio /></Suspend>} />
        <Route path="/practice" element={<PracticePage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/cheat-sheet" element={<CheatPage />} />
        <Route path="/notes" element={<NotesPage />} />
        <Route path="/studios/alu" element={<AluStudio />} />
        <Route path="/upcoming/alu" element={<AluStudio />} />
        <Route path="/upcoming/:id" element={<UpcomingRoute />} />
        <Route path="*" element={<main className="card"><h1>Page not found</h1><p>This address does not identify a published lesson.</p><a href="/studios">Browse studios</a> · <a href="/textbook">Open the textbook</a></main>} />
      </Routes></Suspend></StudioLearningLayout></LabMotionBoundary>
    </AppShell>
  );
}
