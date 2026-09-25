import { useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { DesktopShell } from "./shell";
import { BoostPage, CachePage, CoresPage, HomePage, MemoryPage, PackagePage, PciePage, PracticePage, ThermalPage, WorkloadPage } from "./pages";

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
  const raw = useParams().labId ?? "home";
  const lab = ALIAS[raw];
  const [resetKey, setResetKey] = useState(0);
  if (!lab) return <Navigate to="/architecture/desktop" replace />;
  return (
    <DesktopShell lab={lab} onReset={() => setResetKey((value) => value + 1)}>
      <div key={resetKey}>
        {lab === "home" && <HomePage />}
        {lab === "package" && <PackagePage />}
        {lab === "cores" && <CoresPage />}
        {lab === "cache" && <CachePage />}
        {lab === "memory" && <MemoryPage />}
        {lab === "pcie" && <PciePage />}
        {lab === "boost-power" && <BoostPage />}
        {lab === "thermal" && <ThermalPage />}
        {lab === "workloads" && <WorkloadPage />}
        {lab === "practice" && <PracticePage />}
      </div>
    </DesktopShell>
  );
}

export default DesktopStudio;
