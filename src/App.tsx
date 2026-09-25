import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { AppShell } from "./layout/AppShell";
import { CheatPage, HomePage, LearnPage, NotesPage, PracticePage, ProjectsPage, StudiosPage, UpcomingPage } from "./pages/HomePages";
import { AdderStudio } from "./studios/adders/AdderStudio";
import { AssemblyStudio } from "./studios/assembly/AssemblyStudio";
import { ControlStudio } from "./studios/control/ControlStudio";
import { FdeStudio } from "./studios/fde/FdeStudio";
import { BusStudio } from "./studios/bus/BusStudio";
import { HazardStudio } from "./studios/hazards/HazardStudio";
import { HierarchyStudio } from "./studios/hierarchy/HierarchyStudio";
import { InterruptStudio } from "./studios/interrupts/InterruptStudio";
import { IoStudio } from "./studios/io/IoStudio";
import { MulticoreStudio } from "./studios/multicore/MulticoreStudio";
import { AcaStudio } from "./studios/aca/AcaStudio";
import { ParallelStudio } from "./studios/parallel/ParallelStudio";
import { IsaStudio } from "./studios/isa/IsaStudio";
import { PipelineStudio } from "./studios/pipeline/PipelineStudio";
import { AluStudio } from "./studios/alu/AluStudio";
import { RtlStudio } from "./studios/rtl/RtlStudio";
import { BooleanStudio } from "./studios/boolean-algebra/BooleanStudio";
import { CombinationalStudio } from "./studios/combinational/CombinationalStudio";
import { CacheStudio } from "./studios/cache/CacheStudio";
import { CounterStudio } from "./studios/counters/CounterStudio";
import { CpuStudio } from "./studios/cpu/CpuStudio";
import { FsmStudio } from "./studios/fsm/FsmStudio";
import { MemoryStudio } from "./studios/memory/MemoryStudio";
import { FlipFlopStudio } from "./studios/flip-flops/FlipFlopStudio";
import { KmapStudio } from "./studios/kmap/KmapStudio";
import { LogicGatesStudio } from "./studios/logic-gates/LogicGatesStudio";
import { NumberSystemsStudio } from "./studios/number-systems/NumberSystemsStudio";
import { RegisterStudio } from "./studios/registers/RegisterStudio";
import { RoutingStudio } from "./studios/routing/RoutingStudio";
import { TimingStudio } from "./studios/timing/TimingStudio";
import { TruthStudio } from "./studios/truth-tables/TruthStudio";
import { VmStudio } from "./studios/vm/VmStudio";

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
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/learn" element={<LearnPage />} />
        <Route path="/studios" element={<StudiosPage />} />
        <Route path="/studios/number-systems" element={<NumberSystemsStudio />} />
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
        <Route path="/studios/control" element={<ControlStudio />} />
        <Route path="/studios/pipeline" element={<PipelineStudio />} />
        <Route path="/studios/hazards" element={<HazardStudio />} />
        <Route path="/studios/hierarchy" element={<HierarchyStudio />} />
        <Route path="/studios/vm" element={<VmStudio />} />
        <Route path="/studios/io" element={<IoStudio />} />
        <Route path="/studios/interrupts" element={<InterruptStudio />} />
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}
