import { useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { DesktopShell } from "./shell";
import { CachePage, CoresPage, HomePage, MemoryPage, PackagePage, PciePage, PracticePage } from "./pages";

import { DesktopExperiment, useDesktopExperiment } from "./DesktopExperiment";

const ALIAS: Record<string, string> = {
  home: "home",
  overview: "package",
  package: "package",
  cores: "cores",
  threads: "cores",
  internals: "cores",
  cache: "cache",
  interconnect: "memory",
  mc: "memory",
  ddr: "memory",
  memory: "memory",
  pcie: "pcie",
  igpu: "pcie",
  boost: "boost-power",
  "boost-power": "boost-power",
  thermal: "thermal",
  workload: "workloads",
  workloads: "workloads",
  practice: "practice",
};

export function DesktopStudio() {
  const experiment = useDesktopExperiment();
  const raw = useParams().labId ?? "home";
  const lab = ALIAS[raw];
  const [resetKey, setResetKey] = useState(0);
  if (!lab) return <Navigate to="/architecture/desktop" replace />;
  return (
    <DesktopShell lab={lab} onReset={() => { experiment.reset(); setResetKey((value) => value + 1); }}>
      <div key={resetKey}>
        {experiment.running && !["boost-power", "thermal", "workloads"].includes(lab) && <p>Package experiment running · {experiment.state.time.toFixed(1)} s <button onClick={() => experiment.setRunning(false)}>Pause experiment</button></p>}
        {lab === "home" && <HomePage />}
        {lab === "package" && <PackagePage />}
        {lab === "cores" && <CoresPage />}
        {lab === "cache" && <CachePage />}
        {lab === "memory" && <MemoryPage />}
        {lab === "pcie" && <PciePage />}
        {["boost-power", "thermal", "workloads"].includes(lab) && <DesktopExperiment experiment={experiment} view={lab} />}
        {lab === "practice" && <PracticePage />}
      </div>
    </DesktopShell>
  );
}

export default DesktopStudio;
