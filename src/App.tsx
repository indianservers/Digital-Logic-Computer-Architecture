import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { AppShell } from "./layout/AppShell";
import { CheatPage, HomePage, LearnPage, NotesPage, PracticePage, ProjectsPage, StudiosPage, UpcomingPage } from "./pages/HomePages";
import { AdderStudio } from "./studios/adders/AdderStudio";
import { AssemblyStudio } from "./studios/assembly/AssemblyStudio";
import { ControlStudio } from "./studios/control/ControlStudio";
import { FdeStudio } from "./studios/fde/FdeStudio";
import { HazardStudio } from "./studios/hazards/HazardStudio";
import { IsaStudio } from "./studios/isa/IsaStudio";
import { PipelineStudio } from "./studios/pipeline/PipelineStudio";
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

function UpcomingRoute() {
  const { id } = useParams();
  return <UpcomingPage id={id ?? ""} />;
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
        <Route path="/practice" element={<PracticePage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/cheat-sheet" element={<CheatPage />} />
        <Route path="/notes" element={<NotesPage />} />
        <Route path="/upcoming/:id" element={<UpcomingRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}
